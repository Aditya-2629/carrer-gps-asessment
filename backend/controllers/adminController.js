/**
 * Admin Panel Controller — complete user records, filters, stats, CSV export.
 *
 * All list endpoints share one filter builder so the UI table and the CSV
 * export always agree on what "current filters" mean.
 */

import User from '../models/User.js'
import AgentRun from '../models/AgentRun.js'
import FindingFeedback from '../models/FindingFeedback.js'
import { adminLogin } from '../utils/adminAuth.js'

// ─── Auth ────────────────────────────────────────────────────────────────────

export const adminLoginController = async (req, res) => {
  const { email, password } = req.body || {}
  const token = adminLogin(email, password)
  if (!token) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials.' })
  }
  return res.status(200).json({ success: true, token, expiresInHours: 24 })
}

// ─── Shared filter builder ───────────────────────────────────────────────────

function buildUserFilters(query) {
  const filters = {}

  if (query.q && String(query.q).trim()) {
    const q = String(query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filters.$or = [{ email: new RegExp(q, 'i') }, { resumeName: new RegExp(q, 'i') }]
  }
  if (query.verified === 'true') filters.isVerified = true
  if (query.verified === 'false') filters.isVerified = false
  if (query.hasResume === 'true') filters.resumeData = { $type: 'binData' }
  if (query.hasReport === 'true') filters['aiReport.career_health_score'] = { $exists: true }
  if (query.hasLinkedIn === 'true') filters.linkedinUrl = { $nin: [null, ''] }

  if (query.from) {
    const from = new Date(query.from)
    if (!isNaN(from.getTime())) {
      filters.createdAt = { ...(filters.createdAt || {}), $gte: from }
    }
  }
  if (query.to) {
    const to = new Date(query.to)
    if (!isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999)
      filters.createdAt = { ...(filters.createdAt || {}), $lte: to }
    }
  }

  return filters
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  score_desc: { 'aiReport.career_health_score': -1 },
  email: { email: 1 },
}

// Helper: pull the agent scores out of the stored report shape
function extractScores(user) {
  const r = user.aiReport || {}
  return {
    careerScore: typeof r.career_health_score === 'number' ? r.career_health_score : null,
    resumeScore: r.resume_agent?.dashboard?.score ?? null,
    linkedinScore: r.linkedin_agent?.score ?? null,
    targetRole: r.resume_json?.target_role || r.target_role || null,
    primaryProfile: r.resume_agent?.candidateSnapshot?.primaryProfile || null,
  }
}

// ─── Users list (filtered + paginated) ───────────────────────────────────────

export const listUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 20))
    const sort = SORTS[req.query.sort] || SORTS.newest

    const filters = buildUserFilters(req.query)
    const [total, users] = await Promise.all([
      User.countDocuments(filters),
      User.find(filters)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('email isVerified createdAt resumeName linkedinUrl aiReport.career_health_score aiReport.resume_agent.dashboard.score aiReport.linkedin_agent.score aiReport.resume_json.target_role aiReport.resume_agent.candidateSnapshot.primaryProfile')
        .lean(),
    ])

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        isVerified: u.isVerified,
        createdAt: u.createdAt,
        resumeName: u.resumeName,
        hasResume: Boolean(u.resumeName),
        linkedinUrl: u.linkedinUrl,
        ...extractScores(u),
      })),
    })
  } catch (err) {
    console.error('Admin listUsers error:', err)
    return res.status(500).json({ success: false, message: 'Failed to load users.' })
  }
}

// ─── Full user detail ────────────────────────────────────────────────────────

export const getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean()
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

    const { resumeData, ...rest } = user
    return res.status(200).json({
      success: true,
      user: {
        ...rest,
        hasResume: Boolean(resumeData),
        ...extractScores(user),
      },
    })
  } catch (err) {
    console.error('Admin getUserDetail error:', err)
    return res.status(500).json({ success: false, message: 'Failed to load user.' })
  }
}

// ─── Resume file download ────────────────────────────────────────────────────

export const downloadResume = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('resumeData resumeName').lean()
    if (!user?.resumeData) {
      return res.status(404).json({ success: false, message: 'No resume on file.' })
    }
    const name = user.resumeName || 'resume.pdf'
    res.setHeader('Content-Type', name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : name.endsWith('.txt') ? 'text/plain' : 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^\w.\- ]/g, '_')}"`)
    return res.send(Buffer.from(user.resumeData))
  } catch (err) {
    console.error('Admin downloadResume error:', err)
    return res.status(500).json({ success: false, message: 'Failed to download resume.' })
  }
}

// ─── Report JSON download ────────────────────────────────────────────────────

export const downloadReport = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('email aiReport').lean()
    if (!user?.aiReport) return res.status(404).json({ success: false, message: 'No report generated yet.' })
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="report_${user.email.replace(/[^\w.\-]/g, '_')}.json"`)
    return res.send(JSON.stringify(user.aiReport, null, 2))
  } catch (err) {
    console.error('Admin downloadReport error:', err)
    return res.status(500).json({ success: false, message: 'Failed to download report.' })
  }
}

// ─── Delete user (permanent) ─────────────────────────────────────────────────

export const deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: 'User not found.' })
    return res.status(200).json({ success: true, message: `User ${deleted.email} deleted.` })
  } catch (err) {
    console.error('Admin deleteUser error:', err)
    return res.status(500).json({ success: false, message: 'Failed to delete user.' })
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export const getStats = async (_req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [totalUsers, verifiedUsers, withResume, withReport, newThisWeek, reportAgg, newToday] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ resumeData: { $type: 'binData' } }),
      User.countDocuments({ 'aiReport.career_health_score': { $exists: true } }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.aggregate([
        { $match: { 'aiReport.career_health_score': { $exists: true } } },
        {
          $group: {
            _id: null,
            avgCareer: { $avg: { $toDouble: '$aiReport.career_health_score' } },
            avgResume: {
              $avg: {
                $cond: [
                  { $ifNull: ['$aiReport.resume_agent.dashboard.score', false] },
                  { $toDouble: '$aiReport.resume_agent.dashboard.score' },
                  null,
                ],
              },
            },
            avgLinkedin: {
              $avg: {
                $cond: [
                  { $ifNull: ['$aiReport.linkedin_agent.score', false] },
                  { $toDouble: '$aiReport.linkedin_agent.score' },
                  null,
                ],
              },
            },
          },
        },
      ]),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
    ])

    const agg = reportAgg[0] || {}
    const round1 = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null)

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        verifiedUsers,
        withResume,
        withReport,
        newThisWeek,
        newToday,
        avgCareerScore: round1(agg.avgCareer),
        avgResumeScore: round1(agg.avgResume),
        avgLinkedinScore: round1(agg.avgLinkedin),
      },
    })
  } catch (err) {
    console.error('Admin getStats error:', err)
    return res.status(500).json({ success: false, message: 'Failed to load stats.' })
  }
}

// ─── CSV export (same filters as the table) ──────────────────────────────────

const csvEscape = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const exportUsersCsv = async (req, res) => {
  try {
    const filters = buildUserFilters(req.query)
    const sort = SORTS[req.query.sort] || SORTS.newest
    const users = await User.find(filters)
      .sort(sort)
      .limit(5000)
      .select('email isVerified createdAt resumeName linkedinUrl aiReport.career_health_score aiReport.resume_agent.dashboard.score aiReport.linkedin_agent.score aiReport.resume_json.target_role aiReport.resume_agent.candidateSnapshot.primaryProfile')
      .lean()

    const header = ['Email', 'Joined', 'Verified', 'Has Resume', 'Resume File', 'LinkedIn URL', 'Target Role', 'Career Score', 'Resume Score', 'LinkedIn Score', 'Profile']
    const rows = users.map((u) => {
      const s = extractScores(u)
      return [
        u.email,
        new Date(u.createdAt).toISOString().slice(0, 10),
        u.isVerified ? 'yes' : 'no',
        u.resumeName ? 'yes' : 'no',
        u.resumeName || '',
        u.linkedinUrl || '',
        s.targetRole || '',
        s.careerScore ?? '',
        s.resumeScore ?? '',
        s.linkedinScore ?? '',
        s.primaryProfile || '',
      ]
    })

    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="crafture_users_${new Date().toISOString().slice(0, 10)}.csv"`)
    return res.send('\ufeff' + csv)
  } catch (err) {
    console.error('Admin exportUsersCsv error:', err)
    return res.status(500).json({ success: false, message: 'Failed to export CSV.' })
  }
}

// ─── Per-agent analytics (Phase E) ───────────────────────────────────────────
// Reads AgentRun (runs, latency, tokens, judge) + FindingFeedback (acceptance)
// for the last 30 days. Answers: "which agent earns its cost?"

const percentile = (sorted, p) => {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

export const getAgentAnalytics = async (_req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [runAgg, feedbackAgg] = await Promise.all([
      AgentRun.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$agent',
            runs: { $sum: 1 },
            successes: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
            cached: { $sum: { $cond: [{ $eq: ['$cached', true] }, 1, 0] } },
            latencies: { $push: '$latencyMs' },
            inputTokens: { $sum: { $ifNull: ['$cost.inputTokens', 0] } },
            outputTokens: { $sum: { $ifNull: ['$cost.outputTokens', 0] } },
            avgJudge: { $avg: { $cond: [{ $ifNull: ['$judgeScore', false] }, '$judgeScore', null] } },
            models: { $addToSet: { $ifNull: ['$model', 'unknown'] } },
          },
        },
        { $sort: { runs: -1 } },
      ]),
      FindingFeedback.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$agent',
            up: { $sum: { $cond: [{ $eq: ['$rating', 'up'] }, 1, 0] } },
            down: { $sum: { $cond: [{ $eq: ['$rating', 'down'] }, 1, 0] } },
          },
        },
      ]),
    ])

    const fbByAgent = Object.fromEntries(feedbackAgg.map((f) => [f._id, f]))

    const agents = runAgg.map((a) => {
      const latencies = [...(a.latencies || [])].sort((x, y) => x - y)
      const fb = fbByAgent[a._id] || { up: 0, down: 0 }
      return {
        agent: a._id,
        runs: a.runs,
        successRate: a.runs ? Math.round((a.successes / a.runs) * 100) : null,
        cacheRate: a.runs ? Math.round((a.cached / a.runs) * 100) : null,
        avgLatencyMs: latencies.length ? Math.round(latencies.reduce((x, y) => x + y, 0) / latencies.length) : null,
        p50LatencyMs: percentile(latencies, 50),
        p95LatencyMs: percentile(latencies, 95),
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        avgJudgeScore: a.avgJudge !== null && a.avgJudge !== undefined ? Math.round(a.avgJudge * 10) / 10 : null,
        models: (a.models || []).filter(Boolean).slice(0, 3),
        thumbsUp: fb.up,
        thumbsDown: fb.down,
        acceptanceRate: fb.up + fb.down > 0 ? Math.round((fb.up / (fb.up + fb.down)) * 100) : null,
      }
    })

    return res.status(200).json({
      success: true,
      windowDays: 30,
      feedbackTotal: feedbackAgg.reduce((a, f) => a + f.up + f.down, 0),
      agents,
    })
  } catch (err) {
    console.error('Admin getAgentAnalytics error:', err)
    return res.status(500).json({ success: false, message: 'Failed to load agent analytics.' })
  }
}

export default {
  adminLoginController,
  listUsers,
  getUserDetail,
  downloadResume,
  downloadReport,
  deleteUser,
  getStats,
  exportUsersCsv,
  getAgentAnalytics,
}
