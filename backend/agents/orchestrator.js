/**
 * Orchestrator — the supervisor. Controllers no longer coordinate agents; they
 * hand a CandidateBundle to the orchestrator and get a ReportBundle back.
 *
 * Responsibilities (Two-Stage Context-Bridged Architecture):
 *  - Stage 1: Deterministic resume parsing & fact extraction (runs in ms with zero LLM calls)
 *  - Stage 2: Parallel LLM synthesis with shared canonical context bridge between
 *    Resume Agent and LinkedIn Agent (sectioning pattern with per-agent isolation)
 *  - Dedupe/cache in AgentRun
 *  - Persist every run (success or failure) as an AgentRun row
 *  - Graceful degradation: failure or absence of one agent never breaks the other
 */

import crypto from 'crypto'
import mongoose from 'mongoose'
import AgentRun from '../models/AgentRun.js'
import JobMarketBucket from '../models/JobMarketBucket.js'
import { ResumeAgent } from './resume/resumeAgent.js'
import { evaluateLinkedIn } from './linkedin/linkedinAgent.js'
import { LINKEDIN_AGENT } from './core/agentContract.js'
import { resolveMarketBucket } from './resume/market/marketBucketResolver.js'
import { scrapeLinkedInProfile } from '../utils/apifyLinkedInScraper.js'
import { getModel } from '../ai/config/modelRegistry.js'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
// 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
const MONGO_CONNECTED = () => mongoose.connection.readyState === 1

const sha256 = (data) => crypto.createHash('sha256').update(String(data)).digest('hex').slice(0, 24)

/**
 * Computes deterministic analysis cache fingerprint participating in AgentRun deduplication.
 * Includes resume, target JD, target role, resolved bucket, and marketBucketVersion.
 * In benchmark mode (cacheMode === 'bypass'), returns null to force evaluation.
 */
export function computeAnalysisCacheFingerprint({
  resumeBuffer = null,
  resumeText = '',
  targetJobDescription = '',
  targetRole = '',
  bucketKey = '',
  experienceBucket = '',
  marketBucketVersion = 0,
  cacheMode = 'default',
}) {
  if (cacheMode === 'bypass') return null
  const resumeHash = crypto.createHash('sha256').update(resumeBuffer || resumeText || '').digest('hex')
  const jdHash = crypto.createHash('sha256').update(targetJobDescription || '').digest('hex')
  const bucket = bucketKey || (targetRole && experienceBucket ? `${targetRole}::${experienceBucket}` : 'default')
  return sha256(
    `resume:${resumeHash}:jd:${jdHash}:${targetRole}:${bucket}:v:${marketBucketVersion}`
  )
}

/**
 * Persists an AgentRun row. Fail-safe: analytics must never break the report.
 */
async function persistRun(row) {
  if (!MONGO_CONNECTED()) return
  try {
    await AgentRun.create(row)
  } catch (e) {
    console.warn('[Orchestrator] AgentRun persist failed (non-fatal):', e.message)
  }
}

/**
 * Looks up a fresh successful run for this exact input.
 */
async function findCachedRun(agent, inputHash) {
  if (!MONGO_CONNECTED()) return null
  try {
    AgentRun.deleteMany({ output: null, cached: true }).catch(() => {})
    const query = {
      agent,
      inputHash,
      status: 'SUCCESS',
      output: { $ne: null },
      createdAt: { $gte: new Date(Date.now() - CACHE_TTL_MS) },
    }
    if (agent === 'linkedin') {
      query['output.dataAvailable'] = true
    }
    return await AgentRun.findOne(query).sort({ createdAt: -1 }).lean()
  } catch (_e) {
    return null
  }
}

/**
 * Runs the Resume + LinkedIn agents for one candidate using a two-stage context bridge.
 *
 * Stage 1: Deterministic parsing & fact extraction from resume.
 * Stage 2: Parallel evaluation where LinkedIn Agent receives the verified resume context.
 *
 * @param {Object} bundle
 * @param {Buffer|null}  bundle.resumeBuffer
 * @param {string}       bundle.resumeName
 * @param {string|null}  bundle.resumeTargetRole
 * @param {string}       [bundle.targetJobDescription]
 * @param {Object|null}  bundle.linkedinData   - scraped LinkedIn profile
 * @param {string|null}  bundle.userId
 * @param {Function}     [bundle.onProgress]
 * @param {string}       [bundle.cacheMode]    - 'default' | 'bypass'
 * @returns {Promise<{ resumeAgent: Object|null, linkedinAgent: Object|null }>}
 *   ready-to-attach report fields (null when that agent has no data/failed)
 */
export async function runCareerAgents(bundle) {
  const {
    resumeBuffer = null,
    resumeText = '',
    canonicalResume = null,
    resumeContextOverride = null,
    resumeName = '',
    resumeTargetRole = '',
    targetJobDescription = '',
    linkedinData = null,
    linkedinUrl = '',
    userId = null,
    onProgress = null,
    cacheMode = 'default',
    skipResumeSynthesis = false,
  } = bundle

  // ── Stage 0 (Background Apify Scraping Pipeline) ───────────────────────────
  // When linkedinUrl is provided, start scrapeLinkedInProfile immediately in the background and hold the promise.
  let apifyScrapePromise = null
  let effectiveLinkedinUrl = linkedinUrl || ''
  if (!effectiveLinkedinUrl && linkedinData) {
    try {
      effectiveLinkedinUrl = linkedinData.url || linkedinData.linkedinUrl || ''
    } catch (_e) {}
  }
  if (!linkedinData && effectiveLinkedinUrl) {
    if (onProgress) {
      onProgress({ stage: 'apify_started', agent: 'linkedin', message: 'Apify background scrape: retrieving public LinkedIn profile & visual branding…' })
    }
    try {
      apifyScrapePromise = scrapeLinkedInProfile(effectiveLinkedinUrl)
        .then((res) => {
          if (onProgress && res) {
            onProgress({ stage: 'apify_done', agent: 'linkedin', message: 'Apify scrape complete: profile data & visual branding retrieved' })
          }
          return res
        })
        .catch((scrapeErr) => {
          console.warn('[Orchestrator] Background Apify scrape failed or skipped:', scrapeErr.message)
          return null
        })
    } catch (scrapeErr) {
      console.warn('[Orchestrator] Background Apify scrape failed to start:', scrapeErr.message)
      apifyScrapePromise = Promise.resolve(null)
    }
  }

  // ── Stage 1 (Fast Fact Extraction) ─────────────────────────────────────────
  // Runs deterministically in ~15ms with zero LLM calls.
  // Extracts canonical resume facts, verified skills, and experience timeline first.
  let resumeContext = resumeContextOverride || null
  if (!resumeContext && ((resumeBuffer && resumeBuffer.length > 0) || resumeText || canonicalResume)) {
    try {
      if (onProgress) {
        onProgress({ stage: 'resume_parsing', agent: 'resume', message: 'Parsing resume structure & extracting canonical facts…' })
      }
      const isRealCanonicalResume = canonicalResume && (Array.isArray(canonicalResume.experience) || Array.isArray(canonicalResume.experiences))
      resumeContext = await ResumeAgent.prepareCanonicalContext({
        buffer: resumeBuffer,
        text: resumeText,
        canonicalResumeOverride: isRealCanonicalResume ? canonicalResume : null,
        filename: resumeName || 'resume',
        targetRole: resumeTargetRole,
      })
    } catch (parseErr) {
      console.warn('[Orchestrator] Stage 1 deterministic parsing failed (will attempt standard evaluate):', parseErr.message)
    }
  }

  const effectiveTargetRole = resumeContext?.targetRole || resumeTargetRole || ''

  // ── Stage 2 (Pipelined Execution) ──────────────────────────────────────────
  // Stage 2A: Resume Agent (LLM Synthesis)
  let resumeJobPromise = null
  if (!skipResumeSynthesis && ((resumeBuffer && resumeBuffer.length > 0) || resumeText || canonicalResume)) {
    resumeJobPromise = (async () => {
      const startedAt = Date.now()
      try {
        let marketBucketVersion = 0
        let bucketKey = 'default'
        try {
          const resolved = resolveMarketBucket({
            targetRole: effectiveTargetRole,
            targetJobDescription,
          })
          bucketKey = resolved.bucketKey
          if (MONGO_CONNECTED()) {
            const bucketDoc = await JobMarketBucket.findOne({ bucketKey }).select('activeVersion').lean()
            marketBucketVersion = bucketDoc?.activeVersion || 0
          }
        } catch (_bErr) {
          /* fallback to 0 */
        }

        const resumePayload = resumeBuffer || resumeText || JSON.stringify(canonicalResume || '')
        const resumeHash = crypto.createHash('sha256').update(resumePayload).digest('hex')
        const jdHash = crypto.createHash('sha256').update(targetJobDescription || '').digest('hex')
        const inputHash = sha256(
          `resume:${resumeHash}:jd:${jdHash}:${effectiveTargetRole}:${bucketKey}:v:${marketBucketVersion}`
        )

        const cached = cacheMode !== 'bypass' ? await findCachedRun('resume', inputHash) : null
        if (cached && cached.output) {
          if (onProgress) onProgress({ stage: 'cache_hit', agent: 'resume', message: 'Resume Agent: reused cached analysis' })
          return { key: 'resumeAgent', analysis: cached.output }
        }

        if (onProgress) onProgress({ stage: 'agent_started', agent: 'resume', message: 'Resume Agent: analyzing' })
        const result = await ResumeAgent.evaluate({
          buffer: resumeBuffer,
          resumeText,
          filename: resumeName || 'resume',
          targetRole: effectiveTargetRole,
          targetJobDescription,
          linkedinUrl: effectiveLinkedinUrl,
          documentOverride: resumeContext?.parsedDoc || null,
          canonicalResumeOverride: resumeContext?.canonicalResume || null,
        })

        await persistRun({
          agent: 'resume',
          agentVersion: '3.2.0',
          inputHash,
          userId,
          status: result.success ? 'SUCCESS' : 'AGENT_FAILED',
          output: result.success ? result.analysis : null,
          cost: {
            inputTokens: result.metadata?.inputTokens ?? null,
            outputTokens: result.metadata?.outputTokens ?? null,
          },
          latencyMs: Date.now() - startedAt,
          attempts: result.metadata?.synthesisAttempts ?? 1,
          model: result.metadata?.model ?? null,
          error: result.success ? null : { message: result.error, status: result.status },
        })

        if (result.success) {
          if (onProgress) onProgress({ stage: 'agent_done', agent: 'resume', message: 'Resume Agent: complete' })
          const modelMeta = result.metadata?.model ? getModel(result.metadata.model) : null
          const provider = modelMeta?.provider || (result.metadata?.model?.includes('gemini') ? 'gemini' : (result.metadata?.model?.includes('gpt-oss') ? 'groq' : null))
          return { key: 'resumeAgent', analysis: result.analysis, provider }
        }
        console.warn('[Orchestrator] Resume Agent failed:', result.status, result.error)
        if (onProgress) onProgress({ stage: 'agent_error', agent: 'resume', message: `Resume Agent failed: ${result.status}` })
        return { key: 'resumeAgent', analysis: null }
      } catch (resErr) {
        console.warn('[Orchestrator] Resume Agent unexpected error:', resErr.message)
        await persistRun({
          agent: 'resume',
          agentVersion: '3.2.0',
          inputHash: sha256(`resume_err:${effectiveTargetRole}:${Date.now()}`),
          userId,
          status: 'AGENT_FAILED',
          output: null,
          latencyMs: Date.now() - startedAt,
          error: { message: resErr.message },
        })
        if (onProgress) onProgress({ stage: 'agent_error', agent: 'resume', message: `Resume Agent error: ${resErr.message}` })
        return { key: 'resumeAgent', analysis: null }
      }
    })()
  }

  // Stage 2B: LinkedIn Agent (Pipelined Execution with verified facts + background Apify scrape)
  let linkedinJobPromise = null
  if (linkedinData || effectiveLinkedinUrl || (resumeBuffer && resumeBuffer.length > 0) || resumeText || canonicalResume || resumeTargetRole) {
    linkedinJobPromise = (async () => {
      const startedAt = Date.now()
      try {
        // Decoupled Parallel Execution: LinkedIn Agent does NOT await ResumeAgent LLM synthesis.
        // It immediately uses the deterministic Stage 1 verified canonical resume and facts (<150ms).
        const verifiedCanonicalResume = resumeContext?.canonicalResume || canonicalResume || null
        const verifiedFacts = resumeContext?.extractedFacts || null
        const resumeProvider = 'gemini'

        // Await background Apify scrape if one was started
        let activeProfile = linkedinData
        if (!activeProfile && apifyScrapePromise) {
          try {
            activeProfile = await apifyScrapePromise
          } catch (_scrapeErr) {
            activeProfile = null
          }
        }

        const linkedinId =
          activeProfile?.publicIdentifier ||
          activeProfile?.url ||
          activeProfile?.linkedinUrl ||
          activeProfile?.fullName ||
          activeProfile?.id ||
          effectiveLinkedinUrl ||
          'profile'

        const resumeFingerprint =
          verifiedCanonicalResume?.candidate?.name ||
          (resumeBuffer ? crypto.createHash('sha256').update(resumeBuffer).digest('hex').slice(0, 16) : '') ||
          effectiveTargetRole ||
          'none'

        const inputHash = sha256(`linkedin:${linkedinId}:${resumeFingerprint}:${effectiveTargetRole}:v:${LINKEDIN_AGENT.version}`)

        const cached = cacheMode !== 'bypass' ? await findCachedRun('linkedin', inputHash) : null
        if (cached && cached.output) {
          if (onProgress) onProgress({ stage: 'cache_hit', agent: 'linkedin', message: 'LinkedIn Agent: reused cached audit' })
          return { key: 'linkedinAgent', analysis: cached.output, linkedinData: activeProfile }
        }

        if (onProgress) onProgress({ stage: 'agent_started', agent: 'linkedin', message: 'LinkedIn Agent: auditing & optimizing' })

        // Execute LinkedIn Agent's dedicated AI call via LLM Gateway with provider isolation
        const analysis = await evaluateLinkedIn({
          profile: activeProfile,
          resumeContext: {
            canonicalResume: verifiedCanonicalResume,
            extractedFacts: verifiedFacts,
            targetRole: effectiveTargetRole,
            provider: resumeProvider,
          },
          runLlm: true,
          preferredProvider: 'groq',
          excludeProvider: resumeProvider,
          onProgress,
        })

        await persistRun({
          agent: 'linkedin',
          agentVersion: LINKEDIN_AGENT.version,
          inputHash,
          userId,
          status: 'SUCCESS',
          output: analysis,
          latencyMs: Date.now() - startedAt,
          cached: false,
        })
        if (onProgress) onProgress({ stage: 'agent_done', agent: 'linkedin', message: 'LinkedIn Agent: complete' })
        return { key: 'linkedinAgent', analysis, linkedinData: activeProfile }
      } catch (err) {
        console.warn('[Orchestrator] LinkedIn Agent failed (graceful isolation):', err.message)
        let fallbackHash = 'linkedin_err'
        try {
          fallbackHash = sha256(`linkedin:${effectiveTargetRole}:${Date.now()}`)
        } catch (_e) {}
        await persistRun({
          agent: 'linkedin',
          agentVersion: LINKEDIN_AGENT.version,
          inputHash: fallbackHash,
          userId,
          status: 'AGENT_FAILED',
          output: null,
          latencyMs: Date.now() - startedAt,
          error: { message: err.message },
        })
        if (onProgress) onProgress({ stage: 'agent_error', agent: 'linkedin', message: `LinkedIn Agent failed: ${err.message}` })
        return { key: 'linkedinAgent', analysis: null, linkedinData: null }
      }
    })()
  }

  // Merge both agent outputs into the report bundle
  const [resumeSettled, linkedinSettled] = await Promise.all([
    resumeJobPromise || Promise.resolve(null),
    linkedinJobPromise || Promise.resolve(null),
  ])

  return {
    resumeAgent: resumeSettled?.analysis || null,
    linkedinAgent: linkedinSettled?.analysis || null,
    linkedinData: linkedinSettled?.linkedinData || null,
  }
}

export default { runCareerAgents, computeAnalysisCacheFingerprint }
