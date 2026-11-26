/**
 * Admin Lead Controller — Enterprise Talent Monetization Pipeline
 *
 * Implements:
 * - Real-time Intent Scoring (0–100) from ATS gaps, scores, and recency
 * - Automated Lead Categorization (COACHING_HOT vs RECRUITER_READY)
 * - Personalized Outreach Script generation (Email & WhatsApp hooks)
 * - Pipeline Stage tracking (new -> contacted -> scheduled -> converted -> placed)
 * - CSV Streaming Export
 * - Candidate Dossier "God Mode" deep payload & bullet override
 */

import nodemailer from 'nodemailer'
import User from '../models/User.js'
import AgentRun from '../models/AgentRun.js'
import AppSettings, { getGlobalSettings, DEFAULT_MESSAGE_TEMPLATES } from '../models/AppSettings.js'
import { buildCandidateResumeDocx } from '../services/docxResumeService.js'
import { isR2Configured, uploadToR2 } from '../services/r2StorageService.js'
import { DEFAULT_PRICING } from '../utils/costTracker.js'

const INR_PER_USD = 94

function computeRunUsd(run) {
  if (typeof run?.cost?.estimatedUsd === 'number' && run.cost.estimatedUsd > 0) {
    return run.cost.estimatedUsd
  }
  const inTok = Number(run?.cost?.inputTokens || 0)
  const outTok = Number(run?.cost?.outputTokens || 0)
  if (inTok <= 0 && outTok <= 0) return 0
  const rates = DEFAULT_PRICING.models[String(run?.model || '').toLowerCase().trim()] || DEFAULT_PRICING.models.default
  return (inTok * rates.input + outTok * rates.output) / 1_000_000
}

async function aggregateCostByUserIds(userIds = []) {
  const map = new Map()
  if (!userIds.length) return map
  const runs = await AgentRun.find({ userId: { $in: userIds } })
    .select('userId cost model')
    .lean()
  for (const run of runs) {
    const key = String(run.userId)
    map.set(key, (map.get(key) || 0) + computeRunUsd(run))
  }
  return map
}

// ─── Helper: Calculate Intent Score & Lead Metadata ─────────────────────────

export function calculateLeadMetrics(user) {
  const r = user.aiReport || {}
  const ra = r.resume_agent || {}
  const dash = ra.dashboard || {}
  const la = r.linkedin_agent || {}
  const rj = user.resumeJson || r.resume_json || {}
  const candidate = rj.candidate || {}

  const candidateName =
    candidate.name ||
    ra.candidateSnapshot?.name ||
    user.answers?.name ||
    user.resumeName?.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') ||
    user.email.split('@')[0]

  const firstName = candidateName.trim().split(/\s+/)[0] || 'there'

  const targetRole =
    rj.target_role ||
    ra.candidateSnapshot?.targetRole ||
    user.answers?.targetRole ||
    'Software Professional'

  const overallScore =
    typeof r.career_health_score === 'object' && r.career_health_score !== null
      ? r.career_health_score.overall
      : typeof r.career_health_score === 'number'
      ? r.career_health_score
      : typeof dash.score === 'number'
      ? dash.score
      : (r.gps_score || null)

  const resumeScore = typeof dash.score === 'number' ? dash.score : null
  const linkedinScore = typeof la.score === 'number' ? la.score : null

  // Discrepancies between Resume & LinkedIn
  const discrepancies = la.crossAudit?.discrepancies || la.discrepancyReport?.discrepancies || []
  const discrepancyCount = Array.isArray(discrepancies) ? discrepancies.length : 0

  // Missing Skills
  const rawMissing = [
    ...(Array.isArray(ra.keywordAlignment?.missingKeywords) ? ra.keywordAlignment.missingKeywords : []),
    ...(Array.isArray(ra.keywordAlignment?.missingFromResume) ? ra.keywordAlignment.missingFromResume : []),
    ...(Array.isArray(ra.keywordAlignment?.missingHardSkills) ? ra.keywordAlignment.missingHardSkills : []),
  ]
  const topMissingSkills = Array.from(
    new Set(
      rawMissing
        .map((s) => (typeof s === 'string' ? s : s?.keyword || s?.name || '').trim())
        .filter((s) => s.length >= 2)
    )
  ).slice(0, 5)

  // Matched Skills
  const rawMatched = [
    ...(Array.isArray(ra.keywordAlignment?.matchedKeywords) ? ra.keywordAlignment.matchedKeywords : []),
    ...(Array.isArray(ra.keywordAlignment?.matchedSkills) ? ra.keywordAlignment.matchedSkills : []),
  ]
  const topMatchedSkills = Array.from(
    new Set(
      rawMatched
        .map((s) => (typeof s === 'string' ? s : s?.keyword || s?.name || '').trim())
        .filter((s) => s.length >= 2)
    )
  ).slice(0, 5)

  // Recency Calculation
  const createdAt = user.createdAt ? new Date(user.createdAt) : new Date()
  const hoursSinceCreation = Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60))

  // Intent Score (0–100): Weighted pain + engagement + recency
  let intentScore = 35 // Base

  // 1. Pain multiplier: Lower ATS score = Higher urgency for paid resume rewrite
  if (overallScore !== null) {
    if (overallScore < 60) intentScore += 30
    else if (overallScore < 75) intentScore += 22
    else if (overallScore < 85) intentScore += 12
    else intentScore += 5
  } else {
    intentScore += 15
  }

  // 2. Market gaps: missing high-demand keywords indicates candidate is stuck
  intentScore += Math.min(20, topMissingSkills.length * 4)

  // 3. Recency: hot leads contacted within 48h convert 3x higher
  if (hoursSinceCreation <= 24) intentScore += 25
  else if (hoursSinceCreation <= 72) intentScore += 18
  else if (hoursSinceCreation <= 168) intentScore += 10
  else intentScore += 4

  // 4. Verification & Asset complete
  if (user.isVerified) intentScore += 5
  if (user.resumeData) intentScore += 5

  intentScore = Math.min(99, Math.max(15, Math.round(intentScore)))

  // Lead Tier:
  // RECRUITER_READY: Strong score (>=78) -> Ready for agency placement / employer submit
  // COACHING_HOT: Gaps detected (<78) -> Prime candidate for paid Career GPS coaching / rewrite
  const leadTier =
    (overallScore !== null && overallScore >= 78) || (resumeScore !== null && resumeScore >= 80)
      ? 'RECRUITER_READY'
      : 'COACHING_HOT'

  // CRM Pipeline Stage
  const pipeline = user.answers?.leadPipeline || {}
  const leadStage = user.pipelineStage || pipeline.stage || 'new'
  const leadNotes = user.adminNotes !== undefined && user.adminNotes !== '' ? user.adminNotes : (pipeline.notes || '')
  const lastContactedAt = pipeline.lastContactedAt || null

  // Outreach Scripts
  let personalizedPitch = ''
  let whatsappPitch = ''

  if (leadTier === 'RECRUITER_READY') {
    const verifiedStack = topMatchedSkills.slice(0, 3).join(', ') || 'modern engineering systems'
    personalizedPitch = `Hi ${firstName}, your verified profile scored an impressive ${overallScore || 82}/100 for ${targetRole} on Career GPS! With your background in ${verifiedStack}, our hiring partners have active openings matching your profile. Are you open to exploring exclusive roles this week?`
    whatsappPitch = `Hi ${firstName}, your ${targetRole} profile scored ${overallScore || 82}/100 on Career GPS. We have a direct hiring partner match for your stack — open to a quick intro?`
  } else {
    const missingStr = topMissingSkills.slice(0, 3).join(', ') || 'high-frequency market tools'
    personalizedPitch = `Hi ${firstName}, I reviewed your Career GPS assessment for ${targetRole}. You have solid foundational experience, but your resume is currently missing key high-demand keywords (${missingStr}) required by ATS filters. Our team can help bridge these gaps with guaranteed recruiter visibility. Would you be open to a quick 10-minute strategy review?`
    whatsappPitch = `Hi ${firstName}, saw your Career GPS assessment for ${targetRole}. Noticed a quick keyword fix (${topMissingSkills[0] || 'market alignment'}) that will boost recruiter screens. Open to a 5-min chat?`
  }

  return {
    id: String(user._id),
    userId: String(user._id),
    name: candidateName,
    candidateName,
    firstName,
    email: user.email,
    phone: user.answers?.phone || candidate.phone || '',
    jobTitle: user.answers?.currentRole || rj.experiences?.[0]?.role || '',
    yoe: user.answers?.experience || rj.years_of_experience || null,
    targetRole,
    atsScore: overallScore,
    overallScore,
    resumeScore,
    linkedinScore,
    bottleneckPhase: r.primary_bottleneck?.phase || r.bottleneck_phase || null,
    reportUnlocked: Boolean(user.reportUnlocked),
    unlockedAt: user.unlockedAt || null,
    deliveredAt: user.deliveredAt || null,
    callBooked: Boolean(user.callBooked || leadStage === 'call_booked' || leadStage === 'scheduled' || user.answers?.callBooked),
    callBookedAt: user.callBookedAt || null,
    followUpDate: user.followUpDate || null,
    discrepancyCount,
    missingSkills: topMissingSkills,
    topMissingSkills,
    matchedSkills: topMatchedSkills,
    topMatchedSkills,
    intentScore,
    tier: leadTier,
    leadTier,
    pipelineStage: leadStage,
    leadStage,
    adminNotes: leadNotes,
    leadNotes,
    lastContactedAt,
    hasResume: Boolean(user.resumeData),
    hasReport: Boolean(user.aiReport),
    linkedinUrl: user.linkedinUrl || candidate.linkedin || null,
    pitches: {
      email: personalizedPitch,
      whatsapp: whatsappPitch,
    },
    personalizedPitch,
    whatsappPitch,
    createdAt: user.createdAt,
  }
}

// ─── GET /api/admin/leads ───────────────────────────────────────────────────

export async function listLeads(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 20))
    const { tier, stage, role, q, sort = 'newest' } = req.query

    const query = {}

    // Search query on email or resumeName
    if (q && String(q).trim()) {
      const escaped = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [{ email: new RegExp(escaped, 'i') }, { resumeName: new RegExp(escaped, 'i') }]
    }

    // Role filter
    if (role && String(role).trim() && role !== 'ALL') {
      const roleEscaped = String(role).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [
        ...(query.$or || []),
        { 'aiReport.resume_json.target_role': new RegExp(roleEscaped, 'i') },
        { 'resumeJson.target_role': new RegExp(roleEscaped, 'i') },
        { 'answers.targetRole': new RegExp(roleEscaped, 'i') },
      ]
    }

    // Stage filter in mongo
    if (stage && stage !== 'ALL') {
      if (stage === 'new') {
        query.$or = [
          { 'answers.leadPipeline.stage': 'new' },
          { 'answers.leadPipeline.stage': { $exists: false } },
          { 'answers.leadPipeline': { $exists: false } },
        ]
      } else {
        query['answers.leadPipeline.stage'] = stage
      }
    }

    // Fetch matching users
    const allMatchingUsers = await User.find(query)
      .select('email isVerified createdAt resumeName resumeData linkedinUrl answers aiReport resumeJson reportUnlocked unlockedAt deliveredAt callBooked callBookedAt pipelineStage adminNotes followUpDate')
      .lean()

    // Transform and calculate metrics
    let computedLeads = allMatchingUsers.map(calculateLeadMetrics)

    // Tier filtering (COACHING_HOT vs RECRUITER_READY)
    if (tier && tier !== 'ALL') {
      computedLeads = computedLeads.filter((lead) => lead.leadTier === tier)
    }

    // Sorting
    computedLeads.sort((a, b) => {
      if (sort === 'intent_desc') {
        return (b.intentScore || 0) - (a.intentScore || 0)
      }
      if (sort === 'score_asc') {
        return (a.overallScore || 0) - (b.overallScore || 0)
      }
      if (sort === 'score_desc') {
        return (b.overallScore || 0) - (a.overallScore || 0)
      }
      if (sort === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      // default: newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const total = computedLeads.length
    const paginatedLeads = computedLeads.slice((page - 1) * limit, page * limit)
    const costMap = await aggregateCostByUserIds(paginatedLeads.map((l) => l.id))
    const leadsWithCost = paginatedLeads.map((l) => {
      const costUsd = Number((costMap.get(l.id) || 0).toFixed(5))
      return {
        ...l,
        costUsd,
        costInr: Number((costUsd * INR_PER_USD).toFixed(2)),
      }
    })

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      leads: leadsWithCost,
    })
  } catch (err) {
    console.error('[AdminLeadController] listLeads error:', err)
    return res.status(500).json({ success: false, message: 'Failed to retrieve leads.' })
  }
}

// ─── GET /api/admin/leads/stats ─────────────────────────────────────────────

export async function getLeadStats(_req, res) {
  try {
    const users = await User.find({})
      .select('email isVerified createdAt resumeName resumeData linkedinUrl answers aiReport resumeJson')
      .lean()

    const computed = users.map(calculateLeadMetrics)

    let coachingHotLeads = 0
    let recruiterReadyLeads = 0
    let totalIntent = 0

    const stages = {
      new: 0,
      contacted: 0,
      scheduled: 0,
      converted: 0,
      placed: 0,
    }

    computed.forEach((lead) => {
      if (lead.leadTier === 'COACHING_HOT') coachingHotLeads++
      if (lead.leadTier === 'RECRUITER_READY') recruiterReadyLeads++
      totalIntent += lead.intentScore || 0

      const st = lead.leadStage || 'new'
      if (stages[st] !== undefined) {
        stages[st]++
      } else {
        stages.new++
      }
    })

    const totalLeads = computed.length
    const avgIntentScore = totalLeads > 0 ? Math.round(totalIntent / totalLeads) : 0
    const convertedOrPlaced = stages.converted + stages.placed + stages.scheduled
    const conversionRate = totalLeads > 0 ? `${((convertedOrPlaced / totalLeads) * 100).toFixed(1)}%` : '0.0%'

    return res.status(200).json({
      success: true,
      totalLeads,
      coachingHotLeads,
      recruiterReadyLeads,
      stages,
      avgIntentScore,
      conversionRate,
    })
  } catch (err) {
    console.error('[AdminLeadController] getLeadStats error:', err)
    return res.status(500).json({ success: false, message: 'Failed to load lead stats.' })
  }
}

// ─── PATCH /api/admin/leads/:id ─────────────────────────────────────────────

export async function updateLeadStage(req, res) {
  try {
    const { id } = req.params
    const { pipelineStage, stage, adminNotes, notes, followUpDate, callBooked, name, email, phone, targetRole } = req.body || {}
    const nextStage = pipelineStage ?? stage

    const validStages = ['new', 'call_booked', 'follow_up', 'unlocked', 'converted', 'lost', 'contacted', 'scheduled', 'placed']
    if (nextStage && !validStages.includes(nextStage)) {
      return res.status(400).json({ success: false, message: `Invalid stage. Must be one of: ${validStages.join(', ')}` })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate user not found.' })
    }

    user.answers = user.answers || {}

    if (typeof name === 'string' && name.trim()) {
      user.name = name.trim()
      user.answers.name = name.trim()
    }
    if (typeof email === 'string' && email.trim()) {
      user.email = email.trim().toLowerCase()
    }
    if (typeof phone === 'string') {
      user.answers.phone = phone.trim()
    }
    if (typeof targetRole === 'string' && targetRole.trim()) {
      user.targetRole = targetRole.trim()
      user.answers.targetRole = targetRole.trim()
    }

    if (nextStage) user.pipelineStage = nextStage
    const nextNotes = adminNotes !== undefined ? adminNotes : notes
    if (nextNotes !== undefined) user.adminNotes = String(nextNotes)
    if (followUpDate !== undefined) {
      user.followUpDate = followUpDate ? new Date(followUpDate) : null
    }
    if (typeof callBooked === 'boolean') {
      user.callBooked = callBooked
      if (callBooked && !user.callBookedAt) user.callBookedAt = new Date()
    } else if (nextStage === 'call_booked' || nextStage === 'scheduled') {
      user.callBooked = true
      if (!user.callBookedAt) user.callBookedAt = new Date()
    }

    const existingPipeline = user.answers.leadPipeline || {}

    user.answers.leadPipeline = {
      ...existingPipeline,
      stage: nextStage || user.pipelineStage || existingPipeline.stage || 'new',
      notes: nextNotes !== undefined ? String(nextNotes) : (existingPipeline.notes || ''),
      lastContactedAt:
        nextStage === 'contacted' || nextStage === 'scheduled' || nextStage === 'call_booked' || nextStage === 'follow_up'
          ? new Date()
          : existingPipeline.lastContactedAt,
      updatedAt: new Date(),
    }

    user.markModified('answers')
    await user.save()

    return res.status(200).json({
      success: true,
      message: 'Lead pipeline metadata updated successfully.',
      lead: calculateLeadMetrics(user),
      leadPipeline: user.answers.leadPipeline,
    })
  } catch (err) {
    console.error('[AdminLeadController] updateLeadStage error:', err)
    return res.status(500).json({ success: false, message: 'Failed to update lead pipeline.' })
  }
}

export async function deleteLead(req, res) {
  try {
    const { id } = req.params
    const user = await User.findByIdAndDelete(id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' })
    }
    await AgentRun.deleteMany({ userId: id }).catch(() => {})
    return res.status(200).json({ success: true, deletedId: id })
  } catch (err) {
    console.error('[AdminLeadController] deleteLead error:', err)
    return res.status(500).json({ success: false, message: 'Failed to delete candidate.' })
  }
}

// ─── GET /api/admin/leads/export.csv ────────────────────────────────────────

export async function exportLeadsCsv(req, res) {
  try {
    const users = await User.find({})
      .select('email isVerified createdAt resumeName resumeData linkedinUrl answers aiReport resumeJson')
      .lean()

    const leads = users.map(calculateLeadMetrics)

    // Build CSV
    const headers = [
      'Candidate Name',
      'Email',
      'Target Role',
      'Overall ATS Score',
      'Resume Score',
      'LinkedIn Score',
      'Lead Tier',
      'Pipeline Stage',
      'Intent Score',
      'Top Missing Skills',
      'Top Matched Skills',
      'LinkedIn URL',
      'Created At',
      'Lead Notes',
    ]

    const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`

    const rows = leads.map((l) => [
      csvEscape(l.candidateName),
      csvEscape(l.email),
      csvEscape(l.targetRole),
      csvEscape(l.overallScore ?? '—'),
      csvEscape(l.resumeScore ?? '—'),
      csvEscape(l.linkedinScore ?? '—'),
      csvEscape(l.leadTier),
      csvEscape(l.leadStage),
      csvEscape(l.intentScore),
      csvEscape(l.topMissingSkills.join(', ')),
      csvEscape(l.topMatchedSkills.join(', ')),
      csvEscape(l.linkedinUrl ?? ''),
      csvEscape(l.createdAt ? new Date(l.createdAt).toISOString() : ''),
      csvEscape(l.leadNotes),
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="career_gps_leads_${new Date().toISOString().slice(0, 10)}.csv"`)
    return res.status(200).send(csvContent)
  } catch (err) {
    console.error('[AdminLeadController] exportLeadsCsv error:', err)
    return res.status(500).json({ success: false, message: 'Failed to export leads CSV.' })
  }
}

// ─── GET /api/admin/leads/:id/dossier ───────────────────────────────────────

export async function getCandidateDossier(req, res) {
  try {
    const { id } = req.params
    const user = await User.findById(id).lean()
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' })
    }

    const leadInfo = calculateLeadMetrics(user)
    const aiReport = user.aiReport || {}
    const ra = aiReport.resume_agent || {}
    const la = aiReport.linkedin_agent || {}
    const dash = ra.dashboard || {}

    // Side-by-side: Resume vs LinkedIn comparison data
    const resumeProfile = {
      name: leadInfo.candidateName,
      targetRole: leadInfo.targetRole,
      summary: user.resumeJson?.summary || ra.candidateSnapshot?.summary || '',
      experiences: user.resumeJson?.experiences || user.resumeJson?.experience || [],
      skills: user.resumeJson?.skills || [],
      education: user.resumeJson?.education || [],
    }

    const linkedinProfile = {
      url: user.linkedinUrl || null,
      headline: la.profile?.headline || user.linkedinData?.headline || '',
      summary: la.profile?.summary || user.linkedinData?.about || '',
      experiences: la.profile?.experiences || user.linkedinData?.positions || [],
      skills: la.profile?.skills || user.linkedinData?.skills || [],
      activitySignals: la.activitySignals || user.linkedinActivitySignals || null,
    }

    // Bullet audit list with Jev triage statuses
    const rawAudit = dash.bulletAudit || ra.bulletAudit || []
    const rawRewrites = ra.bulletRewrites || ra.tailoredBullets || []

    const bullets = rawAudit.map((b, idx) => {
      const matchedRewrite = rawRewrites.find(
        (rw) => rw.bulletId === b.bulletId || rw.originalText === b.text
      )
      return {
        bulletId: b.bulletId || `bullet_${idx + 1}`,
        section: b.section || 'experience',
        roleOrProject: b.role || b.company || b.title || 'Work Experience',
        originalText: b.text || b.originalText || '',
        status: b.status || (b.issues?.length > 0 ? 'Fix' : 'Pass'), // Pass, Warn, Fix
        issue: b.issue || b.diagnosis || (b.issues && b.issues[0]?.message) || null,
        proposedRewrite: matchedRewrite?.rewrite || matchedRewrite?.suggestedRewrite || b.proposedRewrite || null,
        whyItMatters: b.whyItMatters || matchedRewrite?.whyItMatters || null,
        anatomy: b.anatomy || b.tags || b.signals || null,
        isOverriddenByAdmin: Boolean(matchedRewrite?.isOverriddenByAdmin),
      }
    })

    // Target alignment: Matched vs Missing
    const keywordAlignment = {
      targetRole: leadInfo.targetRole,
      matchRate: ra.keywordAlignment?.matchPercent || 70,
      matchedSkills: leadInfo.topMatchedSkills,
      missingSkills: leadInfo.topMissingSkills,
      allMatched: ra.keywordAlignment?.matchedKeywords || [],
      allMissing: ra.keywordAlignment?.missingKeywords || [],
    }

    // Discrepancies
    const discrepancies = la.crossAudit?.discrepancies || la.discrepancyReport?.discrepancies || []

    // LinkedIn Studio Audit
    const laOpt = la.optimizations || {}
    const linkedinAudit = {
      score: leadInfo.linkedinScore,
      url: linkedinProfile.url,
      currentHeadline: linkedinProfile.headline,
      recommendedHeadline:
        laOpt.headline?.recommended ||
        laOpt.headlineRewrite ||
        la.recommendedHeadline ||
        linkedinProfile.headline ||
        '',
      aboutAudit:
        laOpt.about?.recommended ||
        laOpt.aboutRewrite ||
        laOpt.summary?.recommended ||
        la.aboutAudit ||
        linkedinProfile.summary ||
        '',
      experienceFeedback: laOpt.experience || la.experienceFeedback || [],
      skillsFeedback: laOpt.skills || la.skillsFeedback || [],
      bannerFeedback: laOpt.banner || laOpt.visuals || null,
      activitySignals: linkedinProfile.activitySignals,
      discrepancies,
    }

    // Original vs Updated ATS Resume JSON for Diff Viewer
    const originalResumeJson = user.resumeJson || resumeProfile
    const updatedResumeJson =
      ra.canonicalResume ||
      ra.tailoredResume || {
        ...originalResumeJson,
        summary: ra.summaryRewrite || originalResumeJson.summary,
        bulletRewrites: bullets.map((b) => ({
          bulletId: b.bulletId,
          section: b.section,
          originalText: b.originalText,
          proposedRewrite: b.proposedRewrite,
        })),
      }

    // 4-Phase / Agent Scorecards
    const phases = [
      { name: 'Career Health', score: leadInfo.overallScore ?? 0, summary: aiReport.primary_bottleneck?.headline || '' },
      { name: 'Resume Lab', score: leadInfo.resumeScore ?? 0, summary: dash.gradeLabel || '' },
      { name: 'LinkedIn Studio', score: leadInfo.linkedinScore ?? 0, summary: linkedinProfile.activitySignals?.recencyTier || '' },
      { name: 'Intent Score', score: leadInfo.intentScore ?? 0, summary: leadInfo.leadTier || '' },
    ]

    const costMap = await aggregateCostByUserIds([user._id])
    const costUsd = Number((costMap.get(String(user._id)) || 0).toFixed(5))
    const costInr = Number((costUsd * INR_PER_USD).toFixed(2))
    const leadWithCost = { ...leadInfo, costUsd, costInr }

    // Repeat-candidate score history matching same normalized email or last-10-digit phone
    const historyFilters = []
    if (user.email) {
      historyFilters.push({ email: String(user.email).trim().toLowerCase() })
    }
    const rawPhone = String(leadInfo.phone || '').replace(/\D/g, '')
    if (rawPhone.length >= 10) {
      const last10 = rawPhone.slice(-10)
      historyFilters.push({ 'answers.phone': new RegExp(`${last10}$`) })
      historyFilters.push({ 'resumeJson.candidate.phone': new RegExp(`${last10}$`) })
    }
    const priorDocs = historyFilters.length
      ? await User.find({ $or: historyFilters })
          .select('_id answers.targetRole resumeJson.target_role aiReport.career_health_score createdAt')
          .sort({ createdAt: 1 })
          .lean()
      : []

    const scoreHistory = priorDocs.map((doc) => {
      const rawScore = doc.aiReport?.career_health_score
      const overallScore =
        typeof rawScore === 'object' && rawScore !== null
          ? Number(rawScore.overall ?? null)
          : typeof rawScore === 'number'
            ? rawScore
            : null
      return {
        _id: String(doc._id),
        targetRole: doc.answers?.targetRole || doc.resumeJson?.target_role || 'General',
        overallScore: Number.isFinite(overallScore) ? overallScore : null,
        createdAt: doc.createdAt,
      }
    })

    return res.status(200).json({
      success: true,
      lead: leadWithCost,
      candidate: leadWithCost,
      costUsd,
      costInr,
      scoreHistory,
      phases,
      resumeProfile,
      linkedinProfile,
      linkedinAudit,
      originalResumeJson,
      updatedResumeJson,
      discrepancies,
      autopsy: {
        headline: linkedinProfile.headline,
        isConsistent: discrepancies.length === 0,
        findings: discrepancies.map((d) => (typeof d === 'string' ? d : `${d.field || 'Field'}: ${d.issue || d.description || JSON.stringify(d)}`)),
        discrepancies,
        resumeProfile,
        linkedinProfile,
      },
      bullets,
      bulletTriage: bullets,
      keywordAlignment,
      skillAlignment: {
        matched: (keywordAlignment.allMatched?.length > 0 ? keywordAlignment.allMatched : leadInfo.topMatchedSkills) || [],
        missing: (keywordAlignment.allMissing?.length > 0 ? keywordAlignment.allMissing : leadInfo.topMissingSkills) || [],
      },
      pitches: leadInfo.pitches,
      hasOriginalResume: Boolean(user.resumeData),
      resumeFileName: user.resumeName || 'resume.pdf',
    })
  } catch (err) {
    console.error('[AdminLeadController] getCandidateDossier error:', err)
    return res.status(500).json({ success: false, message: 'Failed to retrieve candidate dossier.' })
  }
}

// ─── POST /api/admin/leads/:id/override-bullet ──────────────────────────────

export async function overrideBulletRewrite(req, res) {
  try {
    const { id } = req.params
    const { bulletId, newText, overrideText } = req.body || {}
    const textToSave = newText || overrideText

    if (!bulletId || !textToSave || !String(textToSave).trim()) {
      return res.status(400).json({ success: false, message: 'bulletId and newText/overrideText are required.' })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' })
    }

    user.aiReport = user.aiReport || {}
    user.aiReport.resume_agent = user.aiReport.resume_agent || {}
    const ra = user.aiReport.resume_agent

    // Update or push into bulletRewrites
    ra.bulletRewrites = Array.isArray(ra.bulletRewrites) ? ra.bulletRewrites : []
    const existingRwIdx = ra.bulletRewrites.findIndex((rw) => rw.bulletId === bulletId)
    if (existingRwIdx >= 0) {
      ra.bulletRewrites[existingRwIdx].rewrite = String(textToSave).trim()
      ra.bulletRewrites[existingRwIdx].isOverriddenByAdmin = true
    } else {
      ra.bulletRewrites.push({
        bulletId,
        rewrite: String(textToSave).trim(),
        isOverriddenByAdmin: true,
        updatedAt: new Date(),
      })
    }

    // Also update bulletAudit if present
    if (ra.dashboard?.bulletAudit && Array.isArray(ra.dashboard.bulletAudit)) {
      const bAudit = ra.dashboard.bulletAudit.find((b) => b.bulletId === bulletId)
      if (bAudit) {
        bAudit.proposedRewrite = String(textToSave).trim()
        bAudit.status = 'Pass'
      }
    }

    user.markModified('aiReport')
    await user.save()

    return res.status(200).json({
      success: true,
      message: 'Bullet rewrite successfully overridden and saved.',
      bulletId,
      newText: String(textToSave).trim(),
    })
  } catch (err) {
    console.error('[AdminLeadController] overrideBulletRewrite error:', err)
    return res.status(500).json({ success: false, message: 'Failed to override bullet rewrite.' })
  }
}

function normalizeTemplatesArray(rawList) {
  const byKey = new Map()
  for (const def of DEFAULT_MESSAGE_TEMPLATES) {
    byKey.set(def.key, { ...def })
  }
  if (Array.isArray(rawList)) {
    for (const t of rawList) {
      if (!t || typeof t.key !== 'string' || !t.key.trim()) continue
      const k = t.key.trim()
      byKey.set(k, {
        key: k,
        label: String(t.label || k).trim(),
        channel: t.channel === 'email' ? 'email' : 'whatsapp',
        subject: String(t.subject || ''),
        body: String(t.body || ''),
      })
    }
  } else if (rawList && typeof rawList === 'object') {
    for (const [k, t] of Object.entries(rawList)) {
      if (!k || !t) continue
      byKey.set(k.trim(), {
        key: k.trim(),
        label: String(t.label || k).trim(),
        channel: t.channel === 'email' ? 'email' : 'whatsapp',
        subject: String(t.subject || ''),
        body: String(t.body || ''),
      })
    }
  }
  return Array.from(byKey.values())
}

// ─── GET /api/admin/settings ────────────────────────────────────────────────

export async function getAppSettings(req, res) {
  try {
    const settings = await getGlobalSettings()
    return res.status(200).json({
      success: true,
      settings: {
        teaserModeEnabled: Boolean(settings.teaserModeEnabled),
        teaserVisiblePercent: Number(settings.teaserVisiblePercent ?? 50),
        teaserPercentage: Number(settings.teaserVisiblePercent ?? 50),
        callBookingUrl: settings.callBookingUrl || '',
        whatsappCtaNumber: settings.whatsappCtaNumber || '',
        ctaHeadline: settings.ctaHeadline || '',
        fomoHeadline: settings.ctaHeadline || '',
        ctaButtonLabel: settings.ctaButtonLabel || '',
        fomoCtaLabel: settings.ctaButtonLabel || '',
        aiPaused: Boolean(settings.aiPaused),
        maintenanceMessage: settings.maintenanceMessage || '',
        messageTemplates: normalizeTemplatesArray(settings.messageTemplates),
      },
    })
  } catch (err) {
    console.error('[AdminLeadController] getAppSettings error:', err)
    return res.status(500).json({ success: false, message: 'Failed to retrieve app settings.' })
  }
}

// ─── PATCH /api/admin/settings ──────────────────────────────────────────────

export async function updateAppSettings(req, res) {
  try {
    const {
      teaserModeEnabled,
      teaserVisiblePercent,
      teaserPercentage,
      callBookingUrl,
      whatsappCtaNumber,
      ctaHeadline,
      fomoHeadline,
      ctaButtonLabel,
      fomoCtaLabel,
      aiPaused,
      maintenanceMessage,
      messageTemplates,
    } = req.body || {}
    const update = {}
    if (typeof teaserModeEnabled === 'boolean') update.teaserModeEnabled = teaserModeEnabled
    const pct = teaserVisiblePercent ?? teaserPercentage
    if (typeof pct === 'number' && Number.isFinite(pct)) {
      update.teaserVisiblePercent = Math.min(95, Math.max(10, pct))
    }
    if (typeof callBookingUrl === 'string') update.callBookingUrl = callBookingUrl.trim()
    if (typeof whatsappCtaNumber === 'string') update.whatsappCtaNumber = whatsappCtaNumber.trim()
    const headline = ctaHeadline ?? fomoHeadline
    if (typeof headline === 'string') update.ctaHeadline = headline.trim()
    const btnLabel = ctaButtonLabel ?? fomoCtaLabel
    if (typeof btnLabel === 'string') update.ctaButtonLabel = btnLabel.trim()
    if (typeof aiPaused === 'boolean') update.aiPaused = aiPaused
    if (typeof maintenanceMessage === 'string') update.maintenanceMessage = maintenanceMessage.trim()
    if (messageTemplates !== undefined) {
      update.messageTemplates = normalizeTemplatesArray(messageTemplates)
    }

    const updated = await AppSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: update, $setOnInsert: { key: 'global' } },
      { upsert: true, new: true }
    ).lean()

    return res.status(200).json({
      success: true,
      settings: {
        teaserModeEnabled: Boolean(updated.teaserModeEnabled),
        teaserVisiblePercent: Number(updated.teaserVisiblePercent ?? 50),
        teaserPercentage: Number(updated.teaserVisiblePercent ?? 50),
        callBookingUrl: updated.callBookingUrl || '',
        whatsappCtaNumber: updated.whatsappCtaNumber || '',
        ctaHeadline: updated.ctaHeadline || '',
        fomoHeadline: updated.ctaHeadline || '',
        ctaButtonLabel: updated.ctaButtonLabel || '',
        fomoCtaLabel: updated.ctaButtonLabel || '',
        aiPaused: Boolean(updated.aiPaused),
        maintenanceMessage: updated.maintenanceMessage || '',
        messageTemplates: normalizeTemplatesArray(updated.messageTemplates),
      },
    })
  } catch (err) {
    console.error('[AdminLeadController] updateAppSettings error:', err)
    return res.status(500).json({ success: false, message: 'Failed to update app settings.' })
  }
}

// ─── PATCH /api/admin/leads/:id/unlock ──────────────────────────────────────

export async function toggleLeadUnlock(req, res) {
  try {
    const { id } = req.params
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' })
    }

    const nextUnlocked = typeof req.body?.reportUnlocked === 'boolean'
      ? req.body.reportUnlocked
      : (req.method === 'POST' ? true : !Boolean(user.reportUnlocked))

    user.reportUnlocked = nextUnlocked
    user.unlockedAt = nextUnlocked ? (user.unlockedAt || new Date()) : null
    await user.save()

    return res.status(200).json({
      success: true,
      userId: user._id,
      reportUnlocked: user.reportUnlocked,
      unlockedAt: user.unlockedAt,
    })
  } catch (err) {
    console.error('[AdminLeadController] toggleLeadUnlock error:', err)
    return res.status(500).json({ success: false, message: 'Failed to update report unlock status.' })
  }
}

// ─── POST /api/admin/leads/:id/deliver-full ─────────────────────────────────

export async function deliverFullReport(req, res) {
  try {
    const { id } = req.params
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' })
    }

    // 1. Unlock report immediately & stamp timestamps
    const now = new Date()
    user.reportUnlocked = true
    user.unlockedAt = user.unlockedAt || now
    user.deliveredAt = now
    await user.save()

    const frontendBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')
    const reportUrl = `${frontendBase}/report/${user._id}`
    const candidateName =
      user.resumeJson?.candidate?.name ||
      user.resumeJson?.candidate_name ||
      user.answers?.name ||
      user.email.split('@')[0]

    // 2. Build tailored .docx resume on-demand (supports ?version=updated|original)
    const version = String(req.body?.version || req.query?.version || 'updated').toLowerCase()
    let docxBuffer = null
    let docxFilename = `${String(candidateName).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Candidate'}_Updated_ATS_Resume.docx`
    try {
      const built = await buildCandidateResumeDocx(user, version)
      docxBuffer = built?.buffer || null
      if (built?.filename) docxFilename = built.filename
      if (docxBuffer && isR2Configured()) {
        uploadToR2(`deliveries/${user._id}/${docxFilename}`, docxBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').catch(() => {})
      }
    } catch (docxErr) {
      console.warn('[AdminLeadController] Non-fatal docx generation error:', docxErr.message)
    }

    // 3. Send email with full report link & attached .docx (Resend first if configured, else SMTP)
    let emailSent = false
    let emailError = null
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a;">
        <h2 style="color: #4f46e5;">Hi ${candidateName},</h2>
        <p>Your complete <strong>Crafture Career GPS Diagnostic Report</strong> has been unlocked and is ready to view.</p>
        <p style="margin: 24px 0;">
          <a href="${reportUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Open Full Career GPS Report
          </a>
        </p>
        ${docxBuffer ? '<p>We have also attached your updated <strong>ATS-Tailored Resume (.docx)</strong> directly to this email.</p>' : ''}
        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Direct link: ${reportUrl}</p>
      </div>
    `
    if (process.env.RESEND_API_KEY && user.email) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Crafture Career GPS <onboarding@resend.dev>',
            to: [user.email],
            subject: 'Your Full Career GPS Report & Tailored ATS Resume Are Ready',
            html: htmlBody,
            attachments: docxBuffer
              ? [{ filename: docxFilename, content: docxBuffer.toString('base64') }]
              : [],
          }),
          signal: AbortSignal.timeout(10000),
        })
        if (resendRes.ok) {
          emailSent = true
        } else {
          emailError = `Resend HTTP ${resendRes.status}`
        }
      } catch (resendErr) {
        emailError = resendErr.message
      }
    } else if (process.env.SMTP_USER && process.env.SMTP_PASS && user.email) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '465', 10),
          secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === true,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        })
        await transporter.sendMail({
          from: `"Crafture Career GPS" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Your Full Career GPS Report & Tailored ATS Resume Are Ready',
          html: htmlBody,
          attachments: docxBuffer ? [{ filename: docxFilename, content: docxBuffer }] : [],
        })
        emailSent = true
      } catch (mailErr) {
        emailError = mailErr.message
        console.warn('[AdminLeadController] deliverFullReport email error:', mailErr.message)
      }
    }

    // 4. Construct pre-filled WhatsApp delivery URL
    const rawPhone = String(user.answers?.phone || user.resumeJson?.candidate?.phone || '').replace(/\D/g, '')
    const whatsappMessage = `Hi ${candidateName}, your full Crafture Career GPS Report is now unlocked! View it here: ${reportUrl}`
    const whatsappUrl = rawPhone
      ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(whatsappMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`

    return res.status(200).json({
      success: true,
      delivered: true,
      userId: user._id,
      reportUnlocked: true,
      unlockedAt: user.unlockedAt,
      deliveredAt: user.deliveredAt,
      reportUrl,
      docxAttached: Boolean(docxBuffer),
      emailSent,
      emailError,
      whatsappUrl,
    })
  } catch (err) {
    console.error('[AdminLeadController] deliverFullReport error:', err)
    return res.status(500).json({ success: false, message: 'Failed to deliver full report.' })
  }
}

