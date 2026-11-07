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

import User from '../models/User.js'

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
    typeof r.career_health_score === 'number'
      ? r.career_health_score
      : typeof dash.score === 'number'
      ? dash.score
      : null

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
  const leadStage = pipeline.stage || 'new'
  const leadNotes = pipeline.notes || ''
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
    targetRole,
    atsScore: overallScore,
    overallScore,
    resumeScore,
    linkedinScore,
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
    const { tier, stage, role, q, sort = 'intent_desc' } = req.query

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
      .select('email isVerified createdAt resumeName resumeData linkedinUrl answers aiReport resumeJson')
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

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      leads: paginatedLeads,
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
    const { stage, notes } = req.body || {}

    const validStages = ['new', 'contacted', 'scheduled', 'converted', 'placed']
    if (stage && !validStages.includes(stage)) {
      return res.status(400).json({ success: false, message: `Invalid stage. Must be one of: ${validStages.join(', ')}` })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate user not found.' })
    }

    user.answers = user.answers || {}
    const existingPipeline = user.answers.leadPipeline || {}

    user.answers.leadPipeline = {
      ...existingPipeline,
      stage: stage || existingPipeline.stage || 'new',
      notes: notes !== undefined ? notes : existingPipeline.notes || '',
      lastContactedAt: stage === 'contacted' || stage === 'scheduled' ? new Date() : existingPipeline.lastContactedAt,
      updatedAt: new Date(),
    }

    user.markModified('answers')
    await user.save()

    return res.status(200).json({
      success: true,
      message: 'Lead pipeline metadata updated successfully.',
      leadPipeline: user.answers.leadPipeline,
    })
  } catch (err) {
    console.error('[AdminLeadController] updateLeadStage error:', err)
    return res.status(500).json({ success: false, message: 'Failed to update lead pipeline.' })
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
        originalText: b.text || '',
        status: b.status || (b.issues?.length > 0 ? 'Fix' : 'Pass'), // Pass, Warn, Fix
        issue: b.issue || b.diagnosis || (b.issues && b.issues[0]?.message) || null,
        proposedRewrite: matchedRewrite?.rewrite || matchedRewrite?.suggestedRewrite || b.proposedRewrite || null,
        whyItMatters: b.whyItMatters || matchedRewrite?.whyItMatters || null,
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

    return res.status(200).json({
      success: true,
      lead: leadInfo,
      candidate: leadInfo,
      resumeProfile,
      linkedinProfile,
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

