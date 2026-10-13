/**
 * Orchestrator — the supervisor. Controllers no longer coordinate agents; they
 * hand a CandidateBundle to the orchestrator and get a ReportBundle back.
 *
 * Responsibilities (blueprint Phase B):
 *  - build a stable inputHash per agent input → dedupe/cache in AgentRun
 *  - run agents in parallel (sectioning pattern) with per-agent isolation:
 *    one agent failing never breaks the others or the report
 *  - persist every run (success or failure) as an AgentRun row
 *  - emit progress events (consumed by SSE in Phase C)
 */

import crypto from 'crypto'
import mongoose from 'mongoose'
import AgentRun from '../models/AgentRun.js'
import JobMarketBucket from '../models/JobMarketBucket.js'
import { ResumeAgent } from './resume/resumeAgent.js'
import { analyzeLinkedInProfile } from './linkedin/linkedinAgent.js'
import { LINKEDIN_AGENT } from './core/agentContract.js'
import { resolveMarketBucket } from './resume/market/marketBucketResolver.js'

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
    return await AgentRun.findOne({
      agent,
      inputHash,
      status: 'SUCCESS',
      createdAt: { $gte: new Date(Date.now() - CACHE_TTL_MS) },
    })
      .sort({ createdAt: -1 })
      .lean()
  } catch (_e) {
    return null
  }
}

/**
 * Runs the Resume + LinkedIn agents for one candidate.
 *
 * @param {Object} bundle
 * @param {Buffer|null}  bundle.resumeBuffer
 * @param {string}       bundle.resumeName
 * @param {string|null}  bundle.resumeTargetRole
 * @param {Object|null}  bundle.linkedinData   - scraped LinkedIn profile
 * @param {string|null}  bundle.userId
 * @param {Function}     [bundle.onProgress]
 * @returns {Promise<{ resumeAgent: Object|null, linkedinAgent: Object|null }>}
 *   ready-to-attach report fields (null when that agent has no data/failed)
 */
export async function runCareerAgents(bundle) {
  const {
    resumeBuffer = null,
    resumeName = '',
    resumeTargetRole = '',
    targetJobDescription = '',
    linkedinData = null,
    userId = null,
    onProgress = null,
    cacheMode = 'default', // 'default' | 'bypass'
  } = bundle

  const jobs = []

  // ── Resume Agent (LLM) ──────────────────────────────────────────────────────
  if (resumeBuffer && resumeBuffer.length > 0) {
    jobs.push(
      (async () => {
        // Resolve market bucket and version for cache fingerprinting (Section 25)
        let marketBucketVersion = 0
        let bucketKey = 'default'
        try {
          const resolved = resolveMarketBucket({
            targetRole: resumeTargetRole,
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

        const resumeHash = crypto.createHash('sha256').update(resumeBuffer).digest('hex')
        const jdHash = crypto.createHash('sha256').update(targetJobDescription || '').digest('hex')
        const inputHash = sha256(
          `resume:${resumeHash}:jd:${jdHash}:${resumeTargetRole}:${bucketKey}:v:${marketBucketVersion}`
        )

        // Cache lookup only when cacheMode !== 'bypass'
        const cached = cacheMode !== 'bypass' ? await findCachedRun('resume', inputHash) : null
        if (cached) {
          if (onProgress) onProgress({ stage: 'cache_hit', agent: 'resume', message: 'Resume Agent: reused cached analysis' })
          await persistRun({
            agent: 'resume',
            agentVersion: cached.agentVersion,
            inputHash,
            userId,
            status: 'SUCCESS',
            cached: true,
            output: null, // don't duplicate the blob — the original run holds it
            latencyMs: 0,
            model: cached.model,
          })
          return { key: 'resumeAgent', analysis: cached.output }
        }

        if (onProgress) onProgress({ stage: 'agent_started', agent: 'resume', message: 'Resume Agent: analyzing' })
        const startedAt = Date.now()
        const result = await ResumeAgent.evaluate({
          buffer: resumeBuffer,
          filename: resumeName || 'resume',
          targetRole: resumeTargetRole,
          targetJobDescription,
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
          return { key: 'resumeAgent', analysis: result.analysis }
        }
        console.warn('[Orchestrator] Resume Agent failed:', result.status, result.error)
        if (onProgress) onProgress({ stage: 'agent_error', agent: 'resume', message: `Resume Agent failed: ${result.status}` })
        return { key: 'resumeAgent', analysis: null }
      })()
    )
  }

  // ── LinkedIn Agent (deterministic) ──────────────────────────────────────────
  if (linkedinData) {
    jobs.push(
      (async () => {
        const inputHash = sha256(`linkedin:${linkedinData.url || linkedinData.fullName || 'profile'}`)
        if (onProgress) onProgress({ stage: 'agent_started', agent: 'linkedin', message: 'LinkedIn Agent: auditing profile' })
        const startedAt = Date.now()
        try {
          const analysis = analyzeLinkedInProfile(linkedinData, {
            targetRole: resumeTargetRole || '',
            primaryProfile: '',
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
          return { key: 'linkedinAgent', analysis }
        } catch (err) {
          console.warn('[Orchestrator] LinkedIn Agent failed:', err.message)
          await persistRun({
            agent: 'linkedin',
            agentVersion: LINKEDIN_AGENT.version,
            inputHash,
            userId,
            status: 'AGENT_FAILED',
            output: null,
            latencyMs: Date.now() - startedAt,
            error: { message: err.message },
          })
          if (onProgress) onProgress({ stage: 'agent_error', agent: 'linkedin', message: `LinkedIn Agent failed: ${err.message}` })
          return { key: 'linkedinAgent', analysis: null }
        }
      })()
    )
  }

  const settled = await Promise.all(jobs)

  const out = { resumeAgent: null, linkedinAgent: null }
  for (const r of settled) {
    if (r.key === 'resumeAgent') out.resumeAgent = r.analysis
    if (r.key === 'linkedinAgent') out.linkedinAgent = r.analysis
  }
  return out
}

export default { runCareerAgents }
