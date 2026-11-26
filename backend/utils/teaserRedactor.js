/**
 * Server-side teaser redactor.
 * Strips locked report fields BEFORE sending JSON over public HTTP/SSE endpoints
 * so locked content cannot be read through CSS blur or extracted in DevTools.
 *
 * NEVER apply this to `/api/admin/*` routes.
 */

function isHelpingBullet(item) {
  if (!item || typeof item !== 'object') return false
  if (item.verdict) return String(item.verdict).toLowerCase() === 'helping'
  return (
    item.status === 'pass' ||
    item.severity === 'PASS' ||
    (typeof item.impactScore === 'number' && item.impactScore >= 75)
  )
}

function redactBulletList(list, redactedBulletIds) {
  if (!Array.isArray(list) || list.length === 0) return list

  const hurtingIndices = []
  list.forEach((item, idx) => {
    if (!isHelpingBullet(item)) hurtingIndices.push(idx)
  })

  // Keep 100% of Helping bullets + first 40% (at least 1) of Hurting bullets
  const visibleHurtingCount = hurtingIndices.length > 0
    ? Math.max(1, Math.ceil(hurtingIndices.length * 0.4))
    : 0
  const visibleHurtingSet = new Set(hurtingIndices.slice(0, visibleHurtingCount))

  return list.map((item, idx) => {
    if (isHelpingBullet(item) || visibleHurtingSet.has(idx)) {
      return item
    }
    const bId = item?.bulletId || item?.id
    if (bId) redactedBulletIds.add(String(bId))
    return { locked: true, verdict: 'hurting' }
  })
}

function redactKeywordArray(arr, ratio = 0.5) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return { items: arr, lockedCount: 0 }
  }
  const keepCount = Math.max(1, Math.ceil(arr.length * ratio))
  const lockedCount = Math.max(0, arr.length - keepCount)
  const items = arr.map((item, idx) => (idx < keepCount ? item : { locked: true }))
  return { items, lockedCount }
}

function redactKeywordAlignment(ka) {
  if (!ka || typeof ka !== 'object') return ka

  const ranked = redactKeywordArray(ka.missingMarketSkillsRanked, 0.5)
  const missing = redactKeywordArray(ka.missingFromResume, 0.5)
  const skillsOnly = redactKeywordArray(ka.skillsOnlyUnverified, 0.5)

  return {
    ...ka,
    missingMarketSkillsRanked: ranked.items,
    missingFromResume: missing.items,
    skillsOnlyUnverified: skillsOnly.items,
    lockedMissingCount: ranked.lockedCount || missing.lockedCount,
    lockedSkillsOnlyCount: skillsOnly.lockedCount,
  }
}

function redactLinkedInOptimizations(opt) {
  if (!opt || typeof opt !== 'object') return opt

  const next = { ...opt }

  if (Array.isArray(next.headlines) && next.headlines.length > 1) {
    next.headlines = next.headlines.map((h, idx) => (idx === 0 ? h : { locked: true }))
  }

  if (typeof next.aboutRewrite === 'string') {
    const half = Math.ceil(next.aboutRewrite.length / 2)
    next.aboutRewrite = next.aboutRewrite.slice(0, half)
    next.aboutRewriteLocked = true
  } else if (next.aboutRewrite && typeof next.aboutRewrite === 'object') {
    const hookText =
      next.aboutRewrite.professionalJourney ||
      next.aboutRewrite.hook ||
      (typeof next.aboutRewrite.fullText === 'string'
        ? next.aboutRewrite.fullText.slice(0, Math.ceil(next.aboutRewrite.fullText.length / 2))
        : '')
    next.aboutRewrite = {
      professionalJourney: hookText,
      hook: hookText,
      locked: true,
    }
    next.aboutRewriteLocked = true
  }

  if (Array.isArray(next.experienceUpgrades) && next.experienceUpgrades.length > 0) {
    next.experienceUpgrades = next.experienceUpgrades.map(() => ({ locked: true }))
  }

  if (next.postingStrategy) next.postingStrategy = { locked: true }
  if (next.postingPlan) next.postingPlan = { locked: true }
  if (next.contentStrategy) next.contentStrategy = { locked: true }

  return next
}

/**
 * Redact locked teaser data from a report payload.
 * @param {object} reportData
 * @param {{ teaserModeEnabled?: boolean, reportUnlocked?: boolean }} options
 * @returns {object}
 */
export function redactReportForTeaser(reportData, { teaserModeEnabled = false, reportUnlocked = false } = {}) {
  if (!reportData || typeof reportData !== 'object') return reportData
  if (!teaserModeEnabled || reportUnlocked) return reportData

  const cloned = JSON.parse(JSON.stringify(reportData))
  const redactedBulletIds = new Set()

  // 1. Resume Bullet Audits & Keyword Alignment
  if (cloned.resume_agent && typeof cloned.resume_agent === 'object') {
    if (cloned.resume_agent.dashboard && typeof cloned.resume_agent.dashboard === 'object') {
      cloned.resume_agent.dashboard.bulletAudit = redactBulletList(
        cloned.resume_agent.dashboard.bulletAudit,
        redactedBulletIds
      )
      cloned.resume_agent.dashboard.keywordAlignment = redactKeywordAlignment(
        cloned.resume_agent.dashboard.keywordAlignment
      )
    }
    cloned.resume_agent.bulletAudit = redactBulletList(cloned.resume_agent.bulletAudit, redactedBulletIds)
    cloned.resume_agent.bulletRewrites = redactBulletList(cloned.resume_agent.bulletRewrites, redactedBulletIds)
    cloned.resume_agent.bullet_rewrites = redactBulletList(cloned.resume_agent.bullet_rewrites, redactedBulletIds)
    cloned.resume_agent.keywordAlignment = redactKeywordAlignment(cloned.resume_agent.keywordAlignment)

    if (Array.isArray(cloned.resume_agent.issues)) {
      cloned.resume_agent.issues = cloned.resume_agent.issues.map((iss) => {
        const evList = Array.isArray(iss?.evidence) ? iss.evidence : []
        const matchesRedacted = evList.some((ev) => {
          const id = ev?.bulletId || ev?.itemId
          return id && redactedBulletIds.has(String(id))
        })
        if (!matchesRedacted) return iss
        return { locked: true, severity: iss.severity || 'medium' }
      })
    }
  }

  cloned.bulletRewrites = redactBulletList(cloned.bulletRewrites, redactedBulletIds)
  cloned.bullet_rewrites = redactBulletList(cloned.bullet_rewrites, redactedBulletIds)
  cloned.keywordAlignment = redactKeywordAlignment(cloned.keywordAlignment)

  // 2. LinkedIn Studio
  if (cloned.linkedin_agent && typeof cloned.linkedin_agent === 'object') {
    if (cloned.linkedin_agent.optimizations) {
      cloned.linkedin_agent.optimizations = redactLinkedInOptimizations(cloned.linkedin_agent.optimizations)
    }
    if (cloned.linkedin_agent.aiOptimizations) {
      cloned.linkedin_agent.aiOptimizations = redactLinkedInOptimizations(cloned.linkedin_agent.aiOptimizations)
    }
    if (cloned.linkedin_agent.postingStrategy) {
      cloned.linkedin_agent.postingStrategy = { locked: true }
    }
    if (cloned.linkedin_agent.postingPlan) {
      cloned.linkedin_agent.postingPlan = { locked: true }
    }
  }

  // 3. Overview: Action #3 & 30-Day Roadmap
  if (Array.isArray(cloned.top_actions) && cloned.top_actions.length > 2) {
    cloned.top_actions = cloned.top_actions.map((act, idx) => (idx < 2 ? act : { locked: true }))
  }

  if (Array.isArray(cloned.roadmap) && cloned.roadmap.length > 0) {
    cloned.roadmap = cloned.roadmap.map(() => ({ locked: true }))
  }
  if (Array.isArray(cloned.milestonePathway) && cloned.milestonePathway.length > 0) {
    cloned.milestonePathway = cloned.milestonePathway.map(() => ({ locked: true }))
  }
  if (Array.isArray(cloned.seven_day_plan) && cloned.seven_day_plan.length > 0) {
    cloned.seven_day_plan = cloned.seven_day_plan.map(() => ({ locked: true }))
  }
  if (cloned.action_plan && typeof cloned.action_plan === 'object') {
    if (Array.isArray(cloned.action_plan.milestonePathway)) {
      cloned.action_plan.milestonePathway = cloned.action_plan.milestonePathway.map(() => ({ locked: true }))
    }
    if (Array.isArray(cloned.action_plan.sevenDayPlan)) {
      cloned.action_plan.sevenDayPlan = cloned.action_plan.sevenDayPlan.map(() => ({ locked: true }))
    }
  }

  cloned.__teaserRedacted = true
  return cloned
}
