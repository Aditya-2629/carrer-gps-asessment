/**
 * LinkedIn Agent Standalone API Routes
 * Dedicated evaluation endpoint with full Resume Agent context bridging & cross-orchestration.
 */

import express from 'express'
import multer from 'multer'
import { evaluateLinkedIn, analyzeLinkedInProfile, LINKEDIN_AGENT_VERSION } from '../agents/linkedin/index.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { scrapeLinkedInProfile } from '../utils/apifyLinkedInScraper.js'
import { listModelsForPurpose } from '../ai/config/modelRegistry.js'

const router = express.Router()

// Multer memory storage (5MB max)
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.pdf') || file.originalname.endsWith('.docx')) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF, DOCX, DOC, and TXT files are supported.'), false)
    }
  },
})

/**
 * POST /api/linkedin-agent/scrape
 * Background scrape endpoint: accepts { url }, calls scrapeLinkedInProfile(url),
 * and returns { success: true, profile } (or { success: false, profile: null } on non-fatal error).
 */
router.post('/scrape', async (req, res) => {
  const url = req.body?.url || req.body?.linkedinUrl || ''
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(200).json({
      success: false,
      profile: null,
      error: 'Missing or empty LinkedIn profile URL.',
    })
  }

  try {
    const profile = await scrapeLinkedInProfile(url.trim())
    if (!profile) {
      return res.status(200).json({
        success: false,
        profile: null,
        error: 'Scraping returned no data or Apify token not configured.',
      })
    }
    return res.status(200).json({
      success: true,
      profile,
    })
  } catch (err) {
    console.warn('[LinkedInAgentRoute] Scrape endpoint non-fatal error:', err.message)
    return res.status(200).json({
      success: false,
      profile: null,
      error: err.message,
    })
  }
})

/**
 * GET /api/linkedin-agent/status & /api/linkedin-agent/test/health
 * Returns LinkedIn Agent version, operational mode, Apify status, and models.
 */
router.get(['/status', '/health', '/test/health'], (req, res) => {
  const models = listModelsForPurpose('resume_analysis')
  return res.status(200).json({
    status: 'UP',
    success: true,
    agent: 'linkedin',
    version: LINKEDIN_AGENT_VERSION,
    usesLlm: true,
    persona: 'Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist',
    apifyConfigured: Boolean(process.env.APIFY_API_TOKEN),
    models: models.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      provider: m.provider,
      supportsJsonObject: m.supportsJsonObject,
      supportsReasoning: m.supportsReasoning,
    })),
  })
})

/**
 * GET /api/linkedin-agent/models & /api/linkedin-agent/test/models
 * Lists available models for LinkedIn profile analysis and generative synthesis.
 */
router.get(['/models', '/test/models'], (req, res) => {
  const models = listModelsForPurpose('resume_analysis')
  return res.status(200).json({
    success: true,
    models: models.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      provider: m.provider,
      supportsJsonObject: m.supportsJsonObject,
      supportsReasoning: m.supportsReasoning,
    })),
  })
})

/**
 * POST /api/linkedin-agent/evaluate & POST /api/linkedin-agent/test/run
 * Evaluates candidate LinkedIn profile with Resume Agent context orchestration.
 * Accepts:
 *  - multipart file ("resume") or "resumeText" in JSON body
 *  - "linkedinUrl" (optional string, scraped via Apify if available)
 *  - "linkedinData" (optional JSON object or stringified JSON)
 *  - "targetRole" (optional target role)
 *  - "runLlm" (boolean, default true)
 *  - "model" (optional model override)
 */
router.post(['/evaluate', '/test/run'], upload.single('resume'), async (req, res) => {
  const startedAt = Date.now()
  try {
    const targetRole = req.body?.targetRole || req.body?.role || ''
    const targetJobDescription = req.body?.targetJobDescription || req.body?.targetJd || req.body?.jd || ''
    const linkedinUrl = req.body?.linkedinUrl || ''
    const resumeText = req.body?.resumeText || ''
    const runLlm = req.body?.runLlm !== false && req.body?.runLlm !== 'false'

    // Parse raw linkedinData if passed
    let linkedinData = null
    if (req.body?.linkedinData) {
      if (typeof req.body.linkedinData === 'object') {
        linkedinData = req.body.linkedinData
      } else if (typeof req.body.linkedinData === 'string') {
        try {
          linkedinData = JSON.parse(req.body.linkedinData)
        } catch (_e) {
          console.warn('[LinkedInAgentRoute] Could not parse stringified linkedinData JSON')
        }
      }
    }

    // Validate that at least one relevant input source is provided
    const hasResume = Boolean(req.file || (resumeText && resumeText.trim()))
    const hasLinkedIn = Boolean(linkedinData || (linkedinUrl && linkedinUrl.trim()))
    if (!hasResume && !hasLinkedIn && !targetRole) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least a LinkedIn profile URL / JSON, or a Resume file / text for cross-orchestration.',
      })
    }

    // Stage 1A: Attempt live LinkedIn scrape if URL is provided and no data was supplied
    let scrapeWarning = null
    if (!linkedinData && linkedinUrl && linkedinUrl.trim()) {
      try {
        const scraped = await scrapeLinkedInProfile(linkedinUrl.trim())
        if (scraped) {
          linkedinData = scraped
        }
      } catch (scrapeErr) {
        scrapeWarning = `Apify LinkedIn scraping failed: ${scrapeErr.message}. Falling back to resume-inferred LinkedIn optimization.`
        console.warn(`[LinkedInAgentRoute] ${scrapeWarning}`)
      }
    }

    // Stage 1B: Prepare Canonical Resume Context (deterministic, 0 LLM calls)
    let resumeContext = {
      canonicalResume: null,
      extractedFacts: null,
      targetRole,
    }

    if (hasResume) {
      try {
        const prepared = await ResumeAgent.prepareCanonicalContext({
          buffer: req.file?.buffer || null,
          mimeType: req.file?.mimetype || '',
          filename: req.file?.originalname || '',
          resumeText,
          targetRole,
        })
        resumeContext = {
          canonicalResume: prepared.canonicalResume,
          extractedFacts: prepared.extractedFacts,
          targetRole: prepared.targetRole || targetRole,
        }
      } catch (resErr) {
        console.warn('[LinkedInAgentRoute] Could not prepare canonical resume context:', resErr.message)
      }
    }

    // Stage 2: Evaluate LinkedIn with cross-agent context bridging
    const evaluation = await evaluateLinkedIn({
      linkedinData,
      resumeContext,
      runLlm,
    })

    return res.status(200).json({
      success: true,
      analysis: evaluation,
      score: evaluation.score,
      grade: evaluation.grade,
      gradeLabel: evaluation.gradeLabel,
      checks: evaluation.checks,
      issues: evaluation.issues,
      timelineMismatches: evaluation.timelineMismatches,
      titleDrift: evaluation.titleDrift,
      skillGaps: evaluation.skillGaps,
      discrepancies: evaluation.discrepancies,
      missingSkills: evaluation.missingSkills,
      optimizations: evaluation.optimizations,
      inferredFromResume: evaluation.inferredFromResume || false,
      scrapeWarning,
      telemetry: {
        latencyMs: Date.now() - startedAt,
        hasResumeContext: Boolean(resumeContext.canonicalResume),
        profileSource: evaluation.inferredFromResume ? 'resume_inferred' : 'linkedin_scraped',
      },
    })
  } catch (err) {
    console.error('[LinkedInAgentRoute] Evaluation error:', err)
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error evaluating LinkedIn profile.',
    })
  }
})

export default router
