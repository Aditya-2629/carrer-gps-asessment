// ─── Live API Layer connected to Node.js Backend ───
import axios from 'axios'
import { buildSemanticAssessmentPayload } from './assessmentSteps'
import { getResumeFileFromStorage } from './resumeStorage'
import { sanitizeFormData } from '../store/useAppStore'

// Reads VITE_API_URL from environment at build time.
// In development: falls back to localhost:5000
// In production (Render): set VITE_API_URL = https://your-backend.onrender.com/api
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const api = {
  // POST /api/otp/send-otp
  sendOtp: async ({ email }) => {
    try {
      const res = await client.post('/otp/send-otp', { email })
      return res.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to send verification code.')
    }
  },

  // POST /api/otp/verify-otp
  verifyOtp: async ({ email, otp }) => {
    try {
      const res = await client.post('/otp/verify-otp', { email, otp })
      return res.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Invalid verification code.')
    }
  },

  // Immediate background resume agent evaluation on upload (Step 5) or LinkedIn step advance (Step 11)
  evaluateResume: async ({ file, resumeText = '', targetRole = '', targetJobDescription = '', linkedinUrl = '', signal }) => {
    try {
      const form = new FormData()
      if (file) {
        form.append('resume', file)
      } else if (resumeText) {
        form.append('resumeText', resumeText)
      }
      if (targetRole) form.append('targetRole', targetRole)
      if (targetJobDescription) form.append('targetJobDescription', targetJobDescription)
      if (linkedinUrl) form.append('linkedinUrl', linkedinUrl)

      const res = await client.post('/resume-agent/evaluate', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
        signal,
      })
      return res.data
    } catch (err) {
      if (axios.isCancel?.(err) || err.name === 'CanceledError' || err.name === 'AbortError') {
        throw err
      }
      throw new Error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to evaluate resume.')
    }
  },

  // Background scrape LinkedIn profile on Step 11
  scrapeLinkedInProfile: async (url) => {
    return client
      .post('/linkedin-agent/scrape', { url })
      .then((r) => r.data)
      .catch(() => ({ success: false, profile: null }))
  },

  // Phase C: async job flow — save answers, then create a report job and
  // stream progress via SSE instead of holding one request open.
  startReportJob: async ({ userId, formData }) => {
    try {
      const cleanFormData = sanitizeFormData(formData)
      const semanticProfile = buildSemanticAssessmentPayload(cleanFormData)
      let resumeAnalysis = typeof window !== 'undefined' ? window.__useAppStore?.getState()?.resumeAnalysis?.data : null
      if (!resumeAnalysis && typeof sessionStorage !== 'undefined') {
        try {
          const cached = sessionStorage.getItem('craftureResumeReport')
          if (cached) {
            const parsed = JSON.parse(cached)
            resumeAnalysis = {
              analysis: parsed.analysis,
              canonicalResume: parsed.meta?.canonicalResume,
              marketContext: parsed.meta?.marketContext,
            }
          }
        } catch (_e) {}
      }

      const allAnswers = { ...cleanFormData }

      // Retrieve pre-scraped LinkedIn profile from formData, sessionStorage, or in-flight promise
      let preScrapedLinkedin = cleanFormData.linkedinData || null
      if (!preScrapedLinkedin && typeof sessionStorage !== 'undefined') {
        try {
          const cached = sessionStorage.getItem('craftureLinkedinScrape')
          if (cached) preScrapedLinkedin = JSON.parse(cached)
        } catch (_e) {}
      }
      if (!preScrapedLinkedin && typeof window !== 'undefined' && window.__linkedinScrapePromise) {
        try {
          preScrapedLinkedin = await Promise.race([
            window.__linkedinScrapePromise,
            new Promise((r) => setTimeout(() => r(null), 6000)),
          ])
        } catch (_e) {}
      }
      if (preScrapedLinkedin) {
        allAnswers.linkedinData = preScrapedLinkedin
      }

      let resumeFile = null
      if (formData.resume instanceof File) {
        resumeFile = formData.resume
      } else if (formData.resume instanceof FileList && formData.resume.length > 0) {
        resumeFile = formData.resume[0]
      } else if (Array.isArray(formData.resume) && formData.resume.length > 0 && formData.resume[0] instanceof File) {
        resumeFile = formData.resume[0]
      }

      // Recover original raw File if formData.resume was sanitized to { name, size, type } by localStorage
      if (!resumeFile && typeof window !== 'undefined') {
        const storeResume = window.__useAppStore?.getState()?.resumeFile
        if (storeResume instanceof File) {
          resumeFile = storeResume
        } else if (window.__uploadedResumeFile instanceof File) {
          resumeFile = window.__uploadedResumeFile
        } else {
          try {
            const storedFile = await getResumeFileFromStorage()
            if (storedFile instanceof File) {
              resumeFile = storedFile
              window.__useAppStore?.getState()?.setResumeFile?.(storedFile)
            }
          } catch (_e) {}
        }
      }
      delete allAnswers.resume

      // Guarantee at least baseline answers exist so save-answers and generateReportBundle succeed
      if (Object.keys(allAnswers).length === 0) {
        allAnswers.resumeVersions = '1'
        allAnswers.customizeResume = 'Yes'
        if (resumeAnalysis?.canonicalResume?.candidate?.targetRole) {
          allAnswers.targetRole = resumeAnalysis.canonicalResume.candidate.targetRole
        }
      }

      const bodyFormData = new FormData()
      bodyFormData.append('userId', userId)
      bodyFormData.append('answers', JSON.stringify(allAnswers))
      bodyFormData.append('semanticProfile', JSON.stringify(semanticProfile))
      if (resumeFile) {
        bodyFormData.append('resume', resumeFile)
      }
      if (resumeAnalysis?.canonicalResume) {
        bodyFormData.append('precomputedResumeJson', JSON.stringify(resumeAnalysis.canonicalResume))
      }

      await client.post('/assessment/save-answers', bodyFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const res = await client.post('/report-jobs', {
        userId,
        semanticProfile,
        precomputedResumeAgent: resumeAnalysis?.analysis || null,
        precomputedResumeJson: resumeAnalysis?.canonicalResume || null,
        linkedinData: preScrapedLinkedin || null,
      })
      if (!res.data?.jobId) throw new Error('Failed to start report job.')
      return { jobId: res.data.jobId, semanticProfile }
    } catch (err) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to start report job.')
    }
  },

  // GET /api/report-jobs/:id — poll fallback when SSE unavailable
  getReportJob: async (jobId) => {
    const res = await client.get(`/report-jobs/${jobId}`)
    return res.data
  },

  // POST /api/assessment/generate-report
  generateReport: async ({ userId, formData }) => {
    try {
      // 1. Build Layer-2 AI Semantic Assessment Profile
      const semanticProfile = buildSemanticAssessmentPayload(formData)

      // 2. Build multipart/form-data to support Multer resume upload
      const allAnswers = { ...formData }
      
      // Safe extraction of the resume File object from react-hook-form value
      let resumeFile = null
      if (formData.resume instanceof File) {
        resumeFile = formData.resume
      } else if (formData.resume instanceof FileList && formData.resume.length > 0) {
        resumeFile = formData.resume[0]
      } else if (Array.isArray(formData.resume) && formData.resume.length > 0 && formData.resume[0] instanceof File) {
        resumeFile = formData.resume[0]
      }

      // Recover original raw File if formData.resume was sanitized to { name, size, type } by localStorage
      if (!resumeFile && typeof window !== 'undefined') {
        const storeResume = window.__useAppStore?.getState()?.resumeFile
        if (storeResume instanceof File) {
          resumeFile = storeResume
        } else if (window.__uploadedResumeFile instanceof File) {
          resumeFile = window.__uploadedResumeFile
        } else {
          try {
            const storedFile = await getResumeFileFromStorage()
            if (storedFile instanceof File) {
              resumeFile = storedFile
              window.__useAppStore?.getState()?.setResumeFile?.(storedFile)
            }
          } catch (_e) {}
        }
      }

      // Remove resume from JSON text answers object to avoid serialization errors
      delete allAnswers.resume

      const bodyFormData = new FormData()
      bodyFormData.append('userId', userId)
      bodyFormData.append('answers', JSON.stringify(allAnswers))
      bodyFormData.append('semanticProfile', JSON.stringify(semanticProfile))
      if (resumeFile) {
        bodyFormData.append('resume', resumeFile)
      }

      // Save answers & AI-semantic profile with multipart/form-data
      await client.post('/assessment/save-answers', bodyFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // 3. Generate report from Gemini with semantic profile
      const res = await client.post('/assessment/generate-report', { userId, semanticProfile })
      return normalizeReportData(res.data)
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to generate AI report.')
    }
  },

  // GET /api/assessment/report?userId=... or email=...
  getReport: async ({ userId, email }) => {
    try {
      const params = {}
      if (userId) params.userId = userId
      if (email) params.email = email
      const res = await client.get('/assessment/report', { params })
      if (!res.data) return null
      return normalizeReportData(res.data)
    } catch (err) {
      if (err.response?.status === 404) {
        return null
      }
      throw new Error(err.response?.data?.message || 'Failed to retrieve AI report.')
    }
  },

  // POST /api/feedback — candidate's 👍/👎 on an agent finding (Phase E)
  sendFindingFeedback: async ({ userId, agent, findingId, rating, comment }) => {
    try {
      const res = await client.post('/feedback', { userId, agent, findingId, rating, comment })
      return res.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to record feedback.')
    }
  },

  // POST /api/assessment/resume-talk
  askResumeAI: async ({ userId, question }) => {
    try {
      const res = await client.post('/assessment/resume-talk', { userId, question })
      return res.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to talk with AI Resume Coach.')
    }
  },

  // POST /api/assessment/book-call
  bookCall: async ({ email }) => {
    try {
      const res = await client.post('/assessment/book-call', { email })
      return res.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to send call request.')
    }
  },
}

export function normalizeReportData(data) {
  if (!data) return null

  const scoresResume = data.resume_agent?.dashboard?.score ?? data.scores?.resume?.score ?? data.score_breakdown?.resume?.score ?? data.resume_json?.ats_score ?? 50
  const scoresResumeDiag = data.scores?.resume?.diagnosis ?? data.score_breakdown?.resume?.diagnosis ?? data.resume_agent?.overallReview?.summary ?? data.resume_agent?.issues?.[0]?.diagnosis ?? 'Lacks customized keyword matching.'
  const scoresLinkedin = data.linkedin_agent?.score ?? data.scores?.linkedin?.score ?? data.score_breakdown?.linkedin?.score ?? 50
  const scoresLinkedinDiag = data.scores?.linkedin?.diagnosis ?? data.score_breakdown?.linkedin?.diagnosis ?? data.linkedin_agent?.issues?.[0]?.diagnosis ?? 'Profile activity is low.'
  const scoresOutreach = data.scores?.outreach?.score ?? data.score_breakdown?.outreach?.score ?? data.score_breakdown?.outreach ?? 50
  const scoresOutreachDiag = data.scores?.outreach?.diagnosis ?? data.score_breakdown?.outreach?.diagnosis ?? 'Needs multi-channel networking.'
  const scoresInterview = data.scores?.interview?.score ?? data.score_breakdown?.interviews?.score ?? data.score_breakdown?.interview?.score ?? 50
  const scoresInterviewDiag = data.scores?.interview?.diagnosis ?? data.score_breakdown?.interviews?.diagnosis ?? data.score_breakdown?.interview?.diagnosis ?? 'Needs more structured practice.'

  const critical_issues = (data.critical_issues || []).map((issue, idx) => ({
    id: issue.id || `ci-${idx}`,
    title: issue.title,
    description: issue.description || issue.diagnosis || issue.fix || '',
    severity: issue.severity || 'High',
    icon: issue.icon || issue.icon_suggestion || (idx === 0 ? 'alert-triangle' : idx === 1 ? 'zap-off' : 'shield-off'),
    action_steps: issue.action_steps || []
  }))

  const roadmap = (data.roadmap || []).map((w, idx) => {
    const rawTasks = Array.isArray(w.tasks) && w.tasks.length > 0
      ? w.tasks
      : Array.isArray(w.actions) && w.actions.length > 0
      ? w.actions
      : [w.action, w.description, w.impact].filter(Boolean)
    return {
      week: w.week || w.timeframe || `Phase ${idx + 1}`,
      title: w.title || w.theme || w.stage || w.goal || `Phase ${idx + 1}`,
      goal: w.goal || w.impact || w.objective || '',
      tasks: rawTasks,
      successSignal: w.successSignal || w.success_signal || w.impact || '',
    }
  })

  const defaultUrls = {
    'jobscan': 'https://jobscan.co',
    'teal': 'https://tealhq.com',
    'otta': 'https://otta.com',
    'lemlist': 'https://lemlist.com',
    'pramp': 'https://pramp.com',
    'levels': 'https://levels.fyi',
  }

  const recommended_tools = (data.recommended_tools || []).map((tool, idx) => {
    const name = tool.name || tool.tool_name || ''
    const lowerName = name.toLowerCase()
    let matchedUrl = tool.url || 'https://google.com'
    if (!tool.url) {
      for (const [key, url] of Object.entries(defaultUrls)) {
        if (lowerName.includes(key)) {
          matchedUrl = url
          break
        }
      }
    }
    const icons = ['🎯', '📊', '💼', '📧', '🎤', '💰']
    return {
      name,
      category: tool.category || 'Job Search Tool',
      reason: tool.reason || 'To track applications and optimize outreach.',
      url: matchedUrl,
      icon: tool.icon || icons[idx % icons.length],
    }
  })

  return {
    career_health_score: data.career_health_score ?? 60,
    score_label: data.score_label ?? 'Survival Mode',
    scores: {
      resume: { score: scoresResume, diagnosis: scoresResumeDiag },
      linkedin: { score: scoresLinkedin, diagnosis: scoresLinkedinDiag },
      outreach: { score: scoresOutreach, diagnosis: scoresOutreachDiag },
      interview: { score: scoresInterview, diagnosis: scoresInterviewDiag },
    },
    market_reality_check: data.market_reality_check ?? null,
    critical_issues,
    roadmap,
    recommended_tools,
    coach_intervention: data.coach_intervention ?? null,
    career_journey: data.career_journey ?? null,
    funnel_stages: data.funnel_stages ?? null,
    rejection_factors: data.rejection_factors ?? null,
    rejection_insight: data.rejection_insight ?? null,
    risk_heatmap: data.risk_heatmap ?? null,
    mission_board: data.mission_board ?? null,
    resume_json: data.resume_json ?? null,
    linkedin_json: data.linkedin_json ?? null,
    resume_agent: data.resume_agent ?? null,
    linkedin_agent: data.linkedin_agent ?? null,
    judge: data.judge ?? null,
    dashboard: data.dashboard ?? null,
    user_answers: data.user_answers ?? null,
    semantic_profile: data.semantic_profile ?? null,
    summary: data.summary || 'Your custom AI assessment report has been successfully generated and compiled based on your 31 answers.',
  }
}


