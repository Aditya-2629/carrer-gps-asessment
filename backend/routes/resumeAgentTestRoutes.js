/**
 * Resume Agent Test Lab Routes
 * Dedicated endpoints for isolated developer testing, raw output inspection, and A/B model comparison.
 * Protected: Enabled only in development or when RESUME_AGENT_TEST_MODE=true.
 */

import express from 'express'
import multer from 'multer'
import { ResumeAgentTestService } from '../services/resumeAgentTestService.js'
import { listModelsForPurpose } from '../ai/config/modelRegistry.js'
import { aiConfig } from '../ai/config/aiConfig.js'
import { getAllGeminiKeys } from '../utils/geminiClient.js'

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

// Middleware: Development-only security guard
const testModeGuard = (req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production'
  const isExplicitlyEnabled = process.env.RESUME_AGENT_TEST_MODE === 'true'

  if (!isDev && !isExplicitlyEnabled) {
    return res.status(403).json({
      success: false,
      error: 'Test Lab routes are disabled in production. Set RESUME_AGENT_TEST_MODE=true to enable.',
    })
  }
  next()
}

router.use(testModeGuard)

/**
 * GET /api/resume-agent/test/health
 * Liveness and test service health check
 */
router.get('/health', (req, res) => {
  const health = ResumeAgentTestService.getHealth()
  return res.status(200).json(health)
})

/**
 * GET /api/resume-agent/test/models
 * Returns all candidate models registered for resume analysis with capabilities and configuration state.
 * Never exposes API keys or secrets.
 */
router.get('/models', (req, res) => {
  const models = listModelsForPurpose('resume_analysis')
  const geminiKeys = getAllGeminiKeys()

  const providerConfigured = {
    groq: Boolean(aiConfig.groq.apiKey),
    gemini: geminiKeys.length > 0,
    openrouter: Boolean(aiConfig.openRouter.apiKey),
    grok: Boolean(aiConfig.grok.apiKey),
    nvidia: Boolean(aiConfig.nvidia.apiKey),
  }

  return res.status(200).json({
    success: true,
    models: models.map((m) => {
      const isConfigured = Boolean(providerConfigured[m.provider])
      return {
        id: m.id,
        displayName: m.displayName,
        provider: m.provider,
        enabled: Boolean(m.enabled),
        supportsJsonObject: Boolean(m.supportsJsonObject),
        supportsJsonSchema: Boolean(m.supportsJsonSchema),
        supportsReasoning: Boolean(m.supportsReasoning),
        configured: isConfigured,
        benchmarkAllowed: Boolean(m.enabled && isConfigured),
        allowPersonalData: Boolean(m.allowPersonalData),
      }
    }),
  })
})

/**
 * POST /api/resume-agent/test/run
 * Run one specific model against one resume (file or text) in benchmark mode.
 */
router.post('/run', upload.single('resume'), async (req, res) => {
  try {
    const targetRole = req.body?.targetRole || ''
    const model = req.body?.model
    const inputMode = req.body?.inputMode || 'compact_text'
    const isSynthetic = req.body?.isSynthetic === true || req.body?.isSynthetic === 'true'
    const resumeText = req.body?.resumeText || ''

    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: "model". You must explicitly select a model to test.',
      })
    }

    if (!req.file && (!resumeText || !resumeText.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a resume file (multipart field "resume") or "resumeText" in JSON body.',
      })
    }

    const testResult = await ResumeAgentTestService.runSingleTest({
      buffer: req.file?.buffer || null,
      mimeType: req.file?.mimetype || '',
      filename: req.file?.originalname || '',
      resumeText,
      targetRole,
      model,
      inputMode,
      isSynthetic,
    })

    const statusCode = testResult.success ? 200 : testResult.status === 'blocked' ? 422 : 200
    return res.status(statusCode).json(testResult)
  } catch (err) {
    console.error('[ResumeAgentTestRoute] Run error:', err)
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error executing resume test run.',
    })
  }
})

/**
 * POST /api/resume-agent/test/compare
 * Run the exact same resume against multiple models independently (A/B testing).
 */
router.post('/compare', upload.single('resume'), async (req, res) => {
  try {
    const targetRole = req.body?.targetRole || ''
    const inputMode = req.body?.inputMode || 'compact_text'
    const isSynthetic = req.body?.isSynthetic === true || req.body?.isSynthetic === 'true'
    const resumeText = req.body?.resumeText || ''

    let models = req.body?.models
    if (typeof models === 'string') {
      try {
        models = JSON.parse(models)
      } catch (_e) {
        models = models.split(',').map((m) => m.trim()).filter(Boolean)
      }
    }

    if (!Array.isArray(models) || models.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or empty "models" array for comparison.',
      })
    }

    if (!req.file && (!resumeText || !resumeText.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a resume file (multipart field "resume") or "resumeText" in JSON body.',
      })
    }

    const compareResult = await ResumeAgentTestService.runComparisonTest({
      buffer: req.file?.buffer || null,
      mimeType: req.file?.mimetype || '',
      filename: req.file?.originalname || '',
      resumeText,
      targetRole,
      models,
      inputMode,
      isSynthetic,
    })

    return res.status(200).json(compareResult)
  } catch (err) {
    console.error('[ResumeAgentTestRoute] Compare error:', err)
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error executing model comparison.',
    })
  }
})

export default router
