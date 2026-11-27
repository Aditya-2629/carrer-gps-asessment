/**
 * Resume Agent Controller — Career GPS
 *
 * Handles deterministic canonical parsing and evaluation endpoints for resume uploads.
 * Wires priority Market JD Fast-Sprint scraping directly into upload at T = 0s.
 */
import { ResumeAgent } from '../agents/resume/index.js'
import { ensurePriorityMarketBucket } from '../agents/resume/market/marketJdRetriever.js'
import { costTracker } from '../utils/costTracker.js'

/**
 * POST /api/resume-agent/parse-deterministic
 * Extracts canonical resume JSON deterministically without triggering LLM synthesis.
 * Safe for pre-OTP file dropzone preview (0 LLM calls).
 * Automatically triggers Priority Fast-Sprint Market Scraping non-blocking if bucket has < 8 JDs.
 */
export async function parseResumeDeterministic(req, res) {
  try {
    const canonicalCtx = await ResumeAgent.prepareCanonicalContext({
      buffer: req.file?.buffer || null,
      mimeType: req.file?.mimetype || '',
      filename: req.file?.originalname || '',
      resumeText: req.body?.resumeText || '',
      targetRole: req.body?.targetRole || '',
    })

    const extractedRole =
      canonicalCtx.targetRole ||
      canonicalCtx.canonicalResume?.candidate?.targetRole ||
      canonicalCtx.canonicalResume?.targetRole ||
      ''
    const extractedExp =
      canonicalCtx.canonicalResume?.candidate?.totalExperienceYears ||
      canonicalCtx.canonicalResume?.totalExperienceYears ||
      null

    // Fire priority Fast-Sprint non-blocking at T = 0s
    let marketPrefetch = { bucketKey: null, started: false, ready: false, totalJds: 0 }
    if (extractedRole) {
      try {
        const prefetchRes = await ensurePriorityMarketBucket({
          roleTitle: extractedRole,
          experienceYears: extractedExp,
          canonicalResume: canonicalCtx.canonicalResume,
        })
        marketPrefetch = {
          bucketKey: prefetchRes.bucketKey,
          started: prefetchRes.started,
          ready: prefetchRes.ready,
          totalJds: prefetchRes.totalJds,
        }
      } catch (pErr) {
        console.warn('[parseResumeDeterministic] Priority prefetch non-fatal error:', pErr.message)
      }
    }

    return res.status(200).json({
      success: true,
      canonicalResume: canonicalCtx.canonicalResume,
      targetRole: canonicalCtx.targetRole,
      marketPrefetch,
    })
  } catch (err) {
    if (err.statusCode === 422 || err.code === 'NOT_A_RESUME' || err.code === 'SCANNED_OR_EMPTY_FILE') {
      return res.status(422).json({
        success: false,
        code: err.code || 'NOT_A_RESUME',
        message: err.message,
        error: err.message,
      })
    }
    return res.status(500).json({ success: false, error: err.message, message: err.message })
  }
}

/**
 * POST /api/resume-agent/evaluate
 * Evaluates candidate resume via either multipart file upload or direct JSON text.
 * Gated behind user session authentication or admin key.
 */
export async function evaluateResume(req, res) {
  const runId = `eval_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const sessionId = req.body?.sessionId || req.headers['x-session-id'] || null
  const userId = req.body?.userId || req.user?._id || null
  costTracker.setActiveRunId(runId, userId, sessionId)

  try {
    const targetRole = req.body?.targetRole || ''
    const targetJobDescription = req.body?.targetJobDescription || req.body?.targetJd || ''
    const experienceLevel = req.body?.experienceLevel || ''
    const linkedinUrl = req.body?.linkedinUrl || req.body?.linkedin || ''
    const model = req.body?.model || null
    const isSynthetic = req.body?.isSynthetic === true || req.body?.isSynthetic === 'true'
    const resumeText = req.body?.resumeText || ''

    // Verify at least one input source is provided
    if (!req.file && (!resumeText || !resumeText.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a resume file (multipart field "resume") or "resumeText" in JSON body.',
      })
    }

    const evaluationResult = await ResumeAgent.evaluate({
      buffer: req.file?.buffer || null,
      mimeType: req.file?.mimetype || '',
      filename: req.file?.originalname || '',
      resumeText,
      targetRole,
      targetJobDescription,
      experienceLevel,
      linkedinUrl,
      model,
      isSynthetic,
    })

    if (!evaluationResult.success) {
      return res.status(422).json({
        success: false,
        error: evaluationResult.error,
        code: evaluationResult.code,
        telemetry: evaluationResult.telemetry,
      })
    }

    // Print end-to-end cost and token breakdown
    costTracker.printRunSummary(runId)

    // Ensure priority bucket in background if not already started
    const effectiveRole = targetRole || evaluationResult.canonicalResume?.candidate?.targetRole || ''
    let marketPrefetch = { bucketKey: null, started: false, ready: false, totalJds: 0 }
    if (effectiveRole) {
      try {
        const prefetchRes = await ensurePriorityMarketBucket({
          roleTitle: effectiveRole,
          experienceLevel,
          canonicalResume: evaluationResult.canonicalResume,
        })
        marketPrefetch = {
          bucketKey: prefetchRes.bucketKey,
          started: prefetchRes.started,
          ready: prefetchRes.ready,
          totalJds: prefetchRes.totalJds,
        }
      } catch (pErr) {
        console.warn('[evaluateResume] Priority prefetch non-fatal error:', pErr.message)
      }
    }

    // Return structured contract without internal prompts or secret keys
    return res.status(200).json({
      success: true,
      analysis: evaluationResult.analysis,
      marketContext: evaluationResult.marketContext,
      canonicalResume: evaluationResult.canonicalResume,
      document: evaluationResult.document,
      warnings: evaluationResult.warnings,
      telemetry: evaluationResult.telemetry,
      marketPrefetch,
    })
  } catch (err) {
    console.error('[ResumeAgentRoute] Evaluation error:', err)
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error evaluating resume.',
    })
  }
}

export default {
  parseResumeDeterministic,
  evaluateResume,
}
