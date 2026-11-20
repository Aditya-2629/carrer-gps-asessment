/**
 * Resume Agent Test & Benchmark Routes
 * Isolated development & evaluation endpoint without OTP or 31-question assessment gating.
 */

import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { ResumeAgent } from '../agents/resume/index.js'
import { listModelsForPurpose, getModel } from '../ai/config/modelRegistry.js'
import { costTracker } from '../utils/costTracker.js'
import { userSessionGuard } from '../utils/userAuth.js'
import User from '../models/User.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'
import { replaceUnverifiedNumericTokens } from '../agents/resume/validation/claimValidator.js'

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
 * POST /api/resume-agent/parse-deterministic
 * Extracts canonical resume JSON deterministically without triggering LLM synthesis.
 * Safe for pre-OTP file dropzone preview (0 LLM calls).
 */
router.post('/parse-deterministic', upload.single('resume'), async (req, res) => {
  try {
    const canonicalCtx = await ResumeAgent.prepareCanonicalContext({
      buffer: req.file?.buffer || null,
      mimeType: req.file?.mimetype || '',
      filename: req.file?.originalname || '',
      resumeText: req.body?.resumeText || '',
      targetRole: req.body?.targetRole || '',
    })
    return res.status(200).json({
      success: true,
      canonicalResume: canonicalCtx.canonicalResume,
      targetRole: canonicalCtx.targetRole,
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/resume-agent/evaluate
 * Evaluates candidate resume via either multipart file upload or direct JSON text.
 * Gated behind user session authentication or admin key.
 */
router.post('/evaluate', userSessionGuard, upload.single('resume'), async (req, res) => {
  const runId = `eval_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  costTracker.setActiveRunId(runId)

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

/**
 * Deterministic metric calculation helper (Node.js math only — zero LLM hallucination).
 */
export function computeDeterministicMetric({
  mode,
  baselineValue,
  finalValue,
  directMetric,
  unit = '',
  metricLabel = '',
}) {
  const cleanUnit = (unit || '').trim()

  const hasBaseline =
    baselineValue !== undefined &&
    baselineValue !== null &&
    String(baselineValue).trim() !== ''
  const hasFinal =
    finalValue !== undefined &&
    finalValue !== null &&
    String(finalValue).trim() !== ''

  if (mode === 'calculator' || (hasBaseline && hasFinal)) {
    const b = parseFloat(String(baselineValue).replace(/[^0-9.]/g, ''))
    const f = parseFloat(String(finalValue).replace(/[^0-9.]/g, ''))

    if (!isNaN(b) && !isNaN(f) && b > 0) {
      if (b > f) {
        const pct = Math.round(((b - f) / b) * 100)
        return {
          confirmedMetric: `${pct}% reduction`,
          confirmedDetails: cleanUnit
            ? `${pct}% reduction (from ${b}${cleanUnit} to ${f}${cleanUnit})`
            : `${pct}% reduction (from ${b} to ${f})`,
          evidenceStatus: 'CALCULATED',
          improvementPct: pct,
          type: 'reduction',
        }
      } else if (f > b) {
        const pct = Math.round(((f - b) / b) * 100)
        const mult = (f / b).toFixed(1)
        if (f / b >= 2) {
          return {
            confirmedMetric: `${mult}x increase`,
            confirmedDetails: cleanUnit
              ? `${mult}x increase (from ${b}${cleanUnit} to ${f}${cleanUnit})`
              : `${mult}x increase (from ${b} to ${f})`,
            evidenceStatus: 'CALCULATED',
            multiplier: mult,
            type: 'increase_multiplier',
          }
        }
        return {
          confirmedMetric: `+${pct}% increase`,
          confirmedDetails: cleanUnit
            ? `+${pct}% increase (from ${b}${cleanUnit} to ${f}${cleanUnit})`
            : `+${pct}% increase (from ${b} to ${f})`,
          evidenceStatus: 'CALCULATED',
          improvementPct: pct,
          type: 'increase_percentage',
        }
      } else {
        const valWithUnit = cleanUnit ? `${f} ${cleanUnit}` : `${f}`
        return {
          confirmedMetric: valWithUnit,
          confirmedDetails: valWithUnit,
          evidenceStatus: 'CALCULATED',
          type: 'steady',
        }
      }
    }
  }

  // Direct value mode
  const rawDirect = String(directMetric || '').trim()
  const hasUnit = cleanUnit && rawDirect.toLowerCase().includes(cleanUnit.toLowerCase())
  const finalMetricStr = hasUnit || !cleanUnit ? rawDirect : `${rawDirect} ${cleanUnit}`
  return {
    confirmedMetric: finalMetricStr,
    confirmedDetails: finalMetricStr,
    evidenceStatus: 'CANDIDATE_CONFIRMED',
    type: 'direct',
  }
}

/**
 * POST /api/resume-agent/confirm-metric
 * Layer C Interactive Metric Confirmation:
 * Takes candidate's confirmed metric or baseline/final values, computes exact math deterministically,
 * regenerates a publication-ready 5-part bullet via LLM (or deterministic fallback),
 * and persists the updated bullet into MongoDB User (aiReport and resume_agent).
 */
router.post('/confirm-metric', userSessionGuard, async (req, res) => {
  try {
    const {
      userId,
      bulletId,
      originalText = '',
      currentRewrite = '',
      targetRole = '',
      metricLabel = '',
      mode = 'direct',
      baselineValue,
      finalValue,
      directMetric = '',
      unit = '',
    } = req.body || {}

    if (!originalText && !currentRewrite) {
      return res.status(400).json({
        success: false,
        error: 'originalText or currentRewrite is required.',
      })
    }

    // 1. Deterministic Metric Calculation (0 LLM math hallucinations)
    const metricCalc = computeDeterministicMetric({
      mode,
      baselineValue,
      finalValue,
      directMetric,
      unit,
      metricLabel,
    })

    if (!metricCalc.confirmedMetric) {
      return res.status(400).json({
        success: false,
        error: 'A valid metric or before/after numbers must be provided.',
      })
    }

    // 2. Fast Single-Bullet LLM Regeneration
    const systemPrompt = `You are a senior technical recruiter and executive resume writer.
Your job is to rewrite a single resume bullet point by incorporating the candidate's confirmed metric into a powerful Google XYZ / 5-Part formula:
[Active Ownership Verb] + [Hard Skill / Mechanism] + [Collaboration / Scope] + [Confirmed Metric] + [Measurable Business Outcome].

STRICT CONSTRAINTS:
1. WORD COUNT: Exactly 18 to 32 words in a single high-impact sentence.
2. MUST INCORPORATE CONFIRMED METRIC: You must feature the confirmed metric ("${metricCalc.confirmedMetric}" or "${metricCalc.confirmedDetails}").
3. ZERO NUMERIC HALLUCINATIONS: Do NOT invent any new percentages, latency numbers, scale numbers, dollar amounts, or timeframes. ONLY use the confirmed metric and any existing facts explicitly present in the source bullet or draft.
4. ZERO PLACEHOLDERS: Never produce [ADD: ...] or any bracketed placeholders.
5. NO REPETITIVE CANNED PHRASES: Adapt naturally to the candidate's exact tools and domain.
6. OUTPUT FORMAT: Return ONLY a valid JSON object matching this schema:
{
  "rewrittenText": "string",
  "whyItWorks": "string"
}`

    const userPrompt = `TARGET ROLE: ${targetRole || 'Software Engineer'}
ORIGINAL BULLET: "${originalText || currentRewrite}"
CURRENT DRAFT: "${currentRewrite || originalText}"
METRIC FOCUS: "${metricLabel || 'Operational Scale'}"
CONFIRMED METRIC TO WEAVE: "${metricCalc.confirmedMetric}" (${metricCalc.confirmedDetails})

Write the single 18-32 word publication-ready bullet now.`

    let rewrittenText = ''
    let whyItWorks = ''

    try {
      const resp = await llmGateway.generate({
        purpose: 'resume_analysis',
        task: 'bullet_rewrites',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'google/gemini-2.5-flash-lite',
        preferredProvider: 'openrouter',
        responseFormat: 'json_object',
      })

      if (resp && resp.text) {
        try {
          const parsed = JSON.parse(resp.text)
          rewrittenText = (parsed.rewrittenText || parsed.rewrite || '').trim()
          whyItWorks = (parsed.whyItWorks || parsed.why || '').trim()
        } catch (_e) {
          const jsonMatch = resp.text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            rewrittenText = (parsed.rewrittenText || parsed.rewrite || '').trim()
            whyItWorks = (parsed.whyItWorks || parsed.why || '').trim()
          }
        }
      }
    } catch (llmErr) {
      console.warn('[ResumeAgentRoutes] LLM confirmed metric generation failed, using deterministic fallback:', llmErr.message)
    }

    // 3. Deterministic Fallback if LLM failed or was empty
    if (!rewrittenText) {
      const baseClean = (currentRewrite || originalText)
        .replace(/\[ADD:[^\]]*\]/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .replace(/[.,;]+$/, '')

      if (baseClean.toLowerCase().includes('reducing') || baseClean.toLowerCase().includes('improving') || baseClean.toLowerCase().includes('cutting')) {
        rewrittenText = `${baseClean}, achieving a ${metricCalc.confirmedMetric}.`
      } else {
        rewrittenText = `${baseClean}, resulting in ${metricCalc.confirmedDetails}.`
      }
    }

    if (!whyItWorks) {
      whyItWorks = `Restructured into verified Google XYZ format incorporating candidate-confirmed metric of ${metricCalc.confirmedMetric} with measurable outcome.`
    }

    // 4. Sanitize and validate via replaceUnverifiedNumericTokens with candidate-confirmed status
    rewrittenText = replaceUnverifiedNumericTokens(
      rewrittenText,
      null,
      null,
      {
        evidenceStatus: metricCalc.evidenceStatus,
        sourceText: originalText,
        bulletId,
      }
    )
    rewrittenText = rewrittenText.replace(/\[ADD:[^\]]*\]/gi, '').replace(/\s{2,}/g, ' ').trim()
    if (!/[.!?]$/.test(rewrittenText)) {
      rewrittenText = `${rewrittenText}.`
    }

    // 5. MongoDB Persistence (if user is authenticated / userId provided)
    const effectiveUserId = req.userId || userId
    if (effectiveUserId && mongoose.Types.ObjectId.isValid(effectiveUserId)) {
      try {
        const user = await User.findById(effectiveUserId)
        if (user) {
          let aiReportModified = false
          let resumeAgentModified = false

          const updateBulletObj = (obj) => {
            if (!obj || typeof obj !== 'object') return false
            const idMatch = bulletId && (obj.bulletId === bulletId || obj.id === bulletId)
            const textMatch = originalText && (
              (obj.original && obj.original.trim().toLowerCase() === originalText.trim().toLowerCase()) ||
              (obj.originalText && obj.originalText.trim().toLowerCase() === originalText.trim().toLowerCase()) ||
              (obj.text && obj.text.trim().toLowerCase() === originalText.trim().toLowerCase())
            )
            if (idMatch || textMatch) {
              if (obj.rewritten !== undefined) obj.rewritten = rewrittenText
              if (obj.rewrittenText !== undefined) obj.rewrittenText = rewrittenText
              if (obj.rewrite !== undefined) obj.rewrite = rewrittenText
              if (obj.improved !== undefined) obj.improved = rewrittenText
              obj.evidenceStatus = metricCalc.evidenceStatus
              obj.confirmedMetric = metricCalc.confirmedMetric
              obj.confirmedDetails = metricCalc.confirmedDetails
              obj.whyItWorks = whyItWorks
              return true
            }
            return false
          }

          const scanAndReplace = (root) => {
            if (!root || typeof root !== 'object') return
            const targetArrays = [
              root.bulletUpgrades,
              root.bulletRewrites,
              root.bulletAudit,
              root.bulletSuggestions,
              root.dashboard?.bulletAudit,
              root.resumeDashboard?.bulletAudit,
              root.resume_agent?.bulletUpgrades,
              root.resume_agent?.bulletRewrites,
              root.resume_agent?.bulletAudit,
              root.resume_agent?.dashboard?.bulletAudit,
            ]
            for (const arr of targetArrays) {
              if (Array.isArray(arr)) {
                for (const item of arr) {
                  if (updateBulletObj(item)) {
                    aiReportModified = true
                  }
                }
              }
            }

            const issuesList = [
              ...(Array.isArray(root.issues) ? root.issues : []),
              ...(Array.isArray(root.resume_agent?.issues) ? root.resume_agent.issues : []),
            ]
            for (const iss of issuesList) {
              const matchesEv = Array.isArray(iss.evidence) && iss.evidence.some((ev) =>
                (bulletId && (ev.bulletId === bulletId || ev.itemId === bulletId)) ||
                (originalText && (ev.text === originalText || ev.sourceText === originalText))
              )
              if (matchesEv || (iss.bulletId && iss.bulletId === bulletId)) {
                iss.correctedText = rewrittenText
                iss.evidenceStatus = metricCalc.evidenceStatus
                iss.confirmedMetric = metricCalc.confirmedMetric
                iss.confirmedDetails = metricCalc.confirmedDetails
                iss.whyItWorks = whyItWorks
                aiReportModified = true
              }
            }
          }

          if (user.aiReport) {
            scanAndReplace(user.aiReport)
          }
          if (user.resume_agent) {
            scanAndReplace(user.resume_agent)
            resumeAgentModified = true
          }

          if (aiReportModified) user.markModified('aiReport')
          if (resumeAgentModified) user.markModified('resume_agent')
          if (aiReportModified || resumeAgentModified) {
            await user.save()
          }
        }
      } catch (dbErr) {
        console.warn('[ResumeAgentRoutes] Failed to persist confirmed metric to User DB:', dbErr.message)
      }
    }

    return res.status(200).json({
      success: true,
      bulletId,
      originalText,
      rewrittenText,
      evidenceStatus: metricCalc.evidenceStatus,
      confirmedMetric: metricCalc.confirmedMetric,
      confirmedDetails: metricCalc.confirmedDetails,
      whyItWorks,
    })
  } catch (err) {
    console.error('[ResumeAgentRoutes] confirm-metric error:', err)
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error confirming metric.',
    })
  }
})

export default router
