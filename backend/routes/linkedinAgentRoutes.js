/**
 * LinkedIn Agent Standalone API Routes
 * Dedicated evaluation endpoint with full Resume Agent context bridging & cross-orchestration.
 */

import express from 'express'
import multer from 'multer'
import {
  evaluateLinkedIn,
  analyzeLinkedInProfile,
  calculateRecruiterSeoScore,
  LINKEDIN_AGENT_VERSION,
} from '../agents/linkedin/index.js'
import { buildDeterministicOptimizations } from '../agents/linkedin/linkedinSynthesis.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { scrapeLinkedInProfile } from '../utils/apifyLinkedInScraper.js'
import { listModelsForPurpose } from '../ai/config/modelRegistry.js'
import User from '../models/User.js'
import { userSessionGuard } from '../utils/userAuth.js'

const router = express.Router()

const LINKEDIN_PROFILE_REGEX = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/i

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
  const url = (req.body?.url || req.body?.linkedinUrl || '').trim()
  if (!url) {
    return res.status(200).json({
      success: false,
      profile: null,
      posts: null,
      error: 'Missing or empty LinkedIn profile URL.',
    })
  }

  if (!LINKEDIN_PROFILE_REGEX.test(url)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid LinkedIn URL format. Must be https://linkedin.com/in/username',
    })
  }

  try {
    const cleanUrl = url.trim()
    console.log(`[LinkedInAgentRoute] Launching Profile scrape for: ${cleanUrl}`)
    const profile = await scrapeLinkedInProfile(cleanUrl).catch((err) => {
      console.warn('[LinkedInAgentRoute] Profile scrape non-fatal error:', err.message)
      return null
    })

    if (!profile) {
      return res.status(200).json({
        success: false,
        profile: null,
        posts: null,
        error: 'Scraping returned no data or Apify token not configured.',
      })
    }
    return res.status(200).json({
      success: true,
      profile,
      posts: null,
    })
  } catch (err) {
    console.warn('[LinkedInAgentRoute] Scrape error:', err.message)
    return res.status(200).json({ success: false, profile: null, posts: null, error: err.message })
  }
})

/**
 * POST /api/linkedin-agent/scrape-posts
 * Decommissioned: Returns structured ghost profile fallback.
 */
router.post('/scrape-posts', async (req, res) => {
  return res.status(200).json({
    success: false,
    data: {
      posts: [],
      comments: [],
      isGhostProfile: true,
      available: false,
      error: 'POSTS_SCRAPING_DEPRECATED',
    },
    error: 'LinkedIn posts scraping has been decommissioned.',
  })
})

/**
 * POST /api/linkedin-agent/headline-rewrites
 * Generates 3 recruiter-optimized headlines and evaluates recruiter search visibility.
 * Accepts: { headline, about, role, targetRole, topSkills, yearsExp, company }
 */
router.post(['/headline-rewrites', '/optimize-headlines'], (req, res) => {
  try {
    const role = req.body?.role || req.body?.targetRole || 'Professional'
    const headline = req.body?.headline || ''
    const about = req.body?.about || ''
    const topSkills = Array.isArray(req.body?.topSkills) ? req.body.topSkills : []
    const yearsExp = Number(req.body?.yearsExp || req.body?.experienceYears || 3)
    const company = req.body?.company || ''

    const seo = calculateRecruiterSeoScore({
      headline,
      about,
      targetRole: role,
    })

    const opt = buildDeterministicOptimizations(
      { headline, about },
      { targetRole: role, verifiedSkills: topSkills, canonicalResume: { skills: topSkills } }
    )
    const headlines = opt?.headlines || []

    return res.status(200).json({
      success: true,
      seo,
      headlines,
    })
  } catch (err) {
    console.warn('[LinkedInAgentRoute] headline-rewrites error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/linkedin-agent/status & /api/linkedin-agent/health
 * Returns LinkedIn Agent version, operational mode, Apify status, and models.
 */
router.get(['/status', '/health'], (req, res) => {
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
 * GET /api/linkedin-agent/models
 * Lists available models for LinkedIn profile analysis and generative synthesis.
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
    })),
  })
})

/**
 * GET /api/linkedin-agent/avatar-proxy
 * Image proxy strictly for LinkedIn profile pictures from media.licdn.com to bypass CDN hotlinking / 403 blocks.
 * Security: Strictly validates that the URL belongs to *.licdn.com or media.licdn.com (SSRF prevention).
 */
router.get('/avatar-proxy', async (req, res) => {
  try {
    const targetUrl = (req.query.url || '').trim()
    if (!targetUrl) {
      return res.status(400).send('Missing url parameter')
    }

    let parsed
    try {
      parsed = new URL(targetUrl)
    } catch {
      return res.status(400).send('Invalid url format')
    }

    // Strict SSRF Guard: Only allow https and *.licdn.com domains
    if (parsed.protocol !== 'https:') {
      return res.status(403).send('Only HTTPS protocol allowed')
    }

    const host = parsed.hostname.toLowerCase()
    const isAllowedHost = host === 'media.licdn.com' || host === 'licdn.com' || host.endsWith('.licdn.com')
    if (!isAllowedHost) {
      return res.status(403).send('Host not allowed. Strictly restricted to licdn.com domains.')
    }

    const imageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.linkedin.com/',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!imageRes.ok) {
      return res.status(imageRes.status).send(`Upstream image fetch failed with status ${imageRes.status}`)
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')

    const arrayBuffer = await imageRes.arrayBuffer()
    return res.send(Buffer.from(arrayBuffer))
  } catch (err) {
    console.warn('[LinkedInAvatarProxy] Failed to proxy avatar:', err.message)
    return res.status(502).send('Error proxying image')
  }
})

/**
 * POST /api/linkedin-agent/evaluate
 * Evaluates candidate LinkedIn profile with Resume Agent context orchestration.
 * Gated behind user session authentication or admin key.
 */
router.post('/evaluate', userSessionGuard, upload.single('resume'), async (req, res) => {
  const startedAt = Date.now()
  try {
    const targetRole = req.body?.targetRole || req.body?.role || ''
    const targetJobDescription = req.body?.targetJobDescription || req.body?.targetJd || req.body?.jd || ''
    const linkedinUrl = (req.body?.linkedinUrl || '').trim()
    const resumeText = req.body?.resumeText || ''
    const runLlm = req.body?.runLlm !== false && req.body?.runLlm !== 'false'

    if (linkedinUrl && !LINKEDIN_PROFILE_REGEX.test(linkedinUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid LinkedIn URL format. Must be https://linkedin.com/in/username',
      })
    }

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

    // Parse raw activityData if passed
    let activityData = null
    if (req.body?.activityData) {
      if (typeof req.body.activityData === 'object') {
        activityData = req.body.activityData
      } else if (typeof req.body.activityData === 'string') {
        try {
          activityData = JSON.parse(req.body.activityData)
        } catch (_e) {
          console.warn('[LinkedInAgentRoute] Could not parse stringified activityData JSON')
        }
      }
    }

    // Parse direct resumeJson or canonicalResume if passed in body
    let directResumeJson = null
    if (req.body?.resumeJson) {
      directResumeJson = typeof req.body.resumeJson === 'object' ? req.body.resumeJson : null
      if (!directResumeJson && typeof req.body.resumeJson === 'string') {
        try { directResumeJson = JSON.parse(req.body.resumeJson) } catch (_e) {}
      }
    } else if (req.body?.canonicalResume) {
      directResumeJson = typeof req.body.canonicalResume === 'object' ? req.body.canonicalResume : null
      if (!directResumeJson && typeof req.body.canonicalResume === 'string') {
        try { directResumeJson = JSON.parse(req.body.canonicalResume) } catch (_e) {}
      }
    }

    // If userId is provided, look up persisted user resumeJson
    if (!directResumeJson && req.body?.userId) {
      try {
        const foundUser = await User.findById(req.body.userId).lean()
        if (foundUser?.resumeJson) directResumeJson = foundUser.resumeJson
      } catch (_uErr) {}
    }

    // Validate that at least one relevant input source is provided
    const hasResume = Boolean(req.file || (resumeText && resumeText.trim()) || directResumeJson)
    const hasLinkedIn = Boolean(linkedinData || (linkedinUrl && linkedinUrl.trim()))
    if (!hasResume && !hasLinkedIn && !targetRole) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least a LinkedIn profile URL / JSON, or a Resume file / text for cross-orchestration.',
      })
    }

    // Stage 1A: Attempt live LinkedIn profile & posts scrape concurrently if URL is provided
    let scrapeWarning = null
    if (linkedinUrl && linkedinUrl.trim()) {
      const cleanUrl = linkedinUrl.trim()
      const scrapeTasks = []
      if (!linkedinData) {
        scrapeTasks.push(
          scrapeLinkedInProfile(cleanUrl)
            .then((scraped) => {
              if (scraped) linkedinData = scraped
            })
            .catch((scrapeErr) => {
              scrapeWarning = `Apify LinkedIn profile scraping failed: ${scrapeErr.message}. Falling back to resume-inferred LinkedIn optimization.`
              console.warn(`[LinkedInAgentRoute] ${scrapeWarning}`)
            })
        )
      }
      if (scrapeTasks.length > 0) {
        await Promise.all(scrapeTasks)
      }
    }

    // Stage 1B: Prepare Canonical Resume Context (deterministic, 0 LLM calls)
    let resumeContext = {
      canonicalResume: null,
      extractedFacts: null,
      targetRole,
      coreSkills: [],
    }

    if (directResumeJson) {
      const skills = Array.isArray(directResumeJson.skills)
        ? directResumeJson.skills.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
        : (typeof directResumeJson.skills === 'object' ? Object.values(directResumeJson.skills).flat().filter(Boolean) : [])
      resumeContext = {
        canonicalResume: directResumeJson,
        extractedFacts: directResumeJson.candidateSnapshot || directResumeJson.facts || null,
        targetRole: directResumeJson.targetRole || directResumeJson.candidate?.targetRole || targetRole,
        coreSkills: skills,
      }
    } else if (hasResume) {
      try {
        const prepared = await ResumeAgent.prepareCanonicalContext({
          buffer: req.file?.buffer || null,
          mimeType: req.file?.mimetype || '',
          filename: req.file?.originalname || '',
          resumeText,
          targetRole,
        })
        const skills = Array.isArray(prepared.canonicalResume?.skills)
          ? prepared.canonicalResume.skills.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
          : []
        resumeContext = {
          canonicalResume: prepared.canonicalResume,
          extractedFacts: prepared.extractedFacts,
          targetRole: prepared.targetRole || targetRole,
          coreSkills: skills,
        }
      } catch (resErr) {
        console.warn('[LinkedInAgentRoute] Could not prepare canonical resume context:', resErr.message)
      }
    }

    // Stage 2: Evaluate LinkedIn with cross-agent context bridging
    const evaluation = await evaluateLinkedIn({
      linkedinData,
      activityData,
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
      activitySignals: evaluation.activitySignals || null,
      thoughtLeadership: evaluation.thoughtLeadership || null,
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
