// ─── Live API Layer connected to Node.js Backend ───
import axios from 'axios'

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

  // POST /api/assessment/generate-report
  generateReport: async ({ userId, formData }) => {
    try {
      // 1. Build multipart/form-data to support Multer resume upload
      const allAnswers = { ...formData }
      
      // Safe extraction of the resume File object from react-hook-form value
      let resumeFile = null
      if (formData.resume) {
        if (formData.resume instanceof FileList && formData.resume.length > 0) {
          resumeFile = formData.resume[0]
        } else if (Array.isArray(formData.resume) && formData.resume.length > 0) {
          resumeFile = formData.resume[0]
        } else if (formData.resume instanceof File) {
          resumeFile = formData.resume
        }
      }

      // Remove resume from JSON text answers object to avoid serialization errors
      delete allAnswers.resume

      const bodyFormData = new FormData()
      bodyFormData.append('userId', userId)
      bodyFormData.append('answers', JSON.stringify(allAnswers))
      if (resumeFile) {
        bodyFormData.append('resume', resumeFile)
      }

      // Save answers with multipart/form-data
      await client.post('/assessment/save-answers', bodyFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // 2. Generate report from Gemini
      const res = await client.post('/assessment/generate-report', { userId })
      const data = res.data

      // Normalize backend Schema to UI expectations
      const normalized = {
        career_health_score: data.career_health_score ?? 60,
        score_label: data.score_label ?? 'Survival Mode',
        scores: {
          resume: {
            score: data.score_breakdown?.resume?.score ?? data.score_breakdown?.resume ?? 50,
            diagnosis: data.score_breakdown?.resume?.diagnosis ?? 'Lacks customized keyword matching.'
          },
          linkedin: {
            score: data.score_breakdown?.linkedin?.score ?? data.score_breakdown?.linkedin ?? 50,
            diagnosis: data.score_breakdown?.linkedin?.diagnosis ?? 'Profile activity is low.'
          },
          outreach: {
            score: data.score_breakdown?.outreach?.score ?? data.score_breakdown?.outreach ?? 50,
            diagnosis: data.score_breakdown?.outreach?.diagnosis ?? 'Needs multi-channel networking.'
          },
          interview: {
            score: data.score_breakdown?.interviews?.score ?? data.score_breakdown?.interview?.score ?? 50,
            diagnosis: data.score_breakdown?.interviews?.diagnosis ?? data.score_breakdown?.interview?.diagnosis ?? 'Needs more structured practice.'
          },
        },
        market_reality_check: data.market_reality_check ?? null,
        critical_issues: (data.critical_issues || []).map((issue, idx) => ({
          id: `ci-${idx}`,
          title: issue.title,
          description: issue.diagnosis || issue.fix,
          severity: issue.severity || 'High',
          icon: issue.icon_suggestion || (idx === 0 ? 'alert-triangle' : idx === 1 ? 'zap-off' : 'shield-off'),
          action_steps: issue.action_steps || []
        })),
        roadmap: (data.roadmap || []).map((w, idx) => ({
          week: idx + 1,
          title: w.theme || w.goal || 'Action Sprint',
          goal: w.goal || 'Urgent Sprint Objective',
          tasks: w.tasks || [],
        })),
        recommended_tools: (data.recommended_tools || []).map((tool, idx) => {
          const defaultUrls = {
            'jobscan': 'https://jobscan.co',
            'teal': 'https://tealhq.com',
            'otta': 'https://otta.com',
            'lemlist': 'https://lemlist.com',
            'pramp': 'https://pramp.com',
            'levels': 'https://levels.fyi',
          }
          const lowerName = tool.tool_name?.toLowerCase() || ''
          let matchedUrl = 'https://google.com'
          for (const [key, url] of Object.entries(defaultUrls)) {
            if (lowerName.includes(key)) {
              matchedUrl = url
              break
            }
          }
          const icons = ['🎯', '📊', '💼', '📧', '🎤', '💰']
          return {
            name: tool.tool_name,
            category: tool.category || 'Job Search Tool',
            reason: tool.reason || 'To track applications and optimize outreach.',
            url: matchedUrl,
            icon: icons[idx % icons.length],
          }
        }),
        coach_intervention: data.coach_intervention ?? null,
        summary: 'Your custom AI assessment report has been successfully generated and compiled based on your 31 answers.',
      }

      return normalized
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to generate AI report.')
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

