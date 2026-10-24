/**
 * Resume Agent Test & Benchmark Routes
 * Isolated development & evaluation endpoint without OTP or 31-question assessment gating.
 */

import express from 'express'
import multer from 'multer'
import { ResumeAgent } from '../agents/resume/index.js'
import { listModelsForPurpose, getModel } from '../ai/config/modelRegistry.js'

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
 * GET /api/resume-agent/models
 * Lists available models and their capabilities
 */
router.get('/models', (req, res) => {
  const models = listModelsForPurpose('resume_analysis')
  return res.status(200).json({
    success: true,
    models: models.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      provider: m.provider,
      supportsJsonObject: m.supportsJsonObject,
      supportsReasoning: m.supportsReasoning,
      allowPersonalData: m.allowPersonalData,
    })),
  })
})

import { resolveMarketBucket } from '../agents/resume/market/marketBucketResolver.js'
import { getMarketDataForBucket } from '../agents/resume/market/marketJdRetriever.js'

/**
 * GET /api/resume-agent/market-context
 * Returns active market status and bucket info for a given role and experience level.
 */
router.get('/market-context', async (req, res) => {
  try {
    const targetRole = req.query.role || req.query.targetRole || ''
    const targetJobDescription = req.query.jd || req.query.targetJobDescription || ''
    const bucketResolution = resolveMarketBucket({
      targetRole,
      targetJobDescription,
    })

    const marketData = await getMarketDataForBucket(bucketResolution.bucketKey, { autoRefresh: false })

    return res.status(200).json({
      success: true,
      marketContext: {
        status: marketData.status,
        bucketKey: bucketResolution.bucketKey,
        role: bucketResolution.roleName,
        experienceBucket: bucketResolution.experienceBucket,
        marketVersion: marketData.version || 0,
        sampleSize: marketData.sampleSize || 0,
      },
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
})

/**
 * POST /api/resume-agent/evaluate
 * Evaluates candidate resume via either multipart file upload or direct JSON text.
 */
router.post('/evaluate', upload.single('resume'), async (req, res) => {
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

    // Return structured contract without internal prompts or secret keys
    return res.status(200).json({
      success: true,
      analysis: evaluationResult.analysis,
      marketContext: evaluationResult.marketContext,
      canonicalResume: evaluationResult.canonicalResume,
      document: evaluationResult.document,
      warnings: evaluationResult.warnings,
      telemetry: evaluationResult.telemetry,
    })
  } catch (err) {
    console.error('[ResumeAgentRoute] Evaluation error:', err)
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error evaluating resume.',
    })
  }
})

export default router
