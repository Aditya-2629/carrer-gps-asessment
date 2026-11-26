/**
 * Server-side teaser redactor.
 * Strips locked report fields BEFORE sending JSON over public HTTP/SSE endpoints
 * so locked content cannot be read through CSS blur or extracted in DevTools.
 *
 * NEVER apply this to `/api/admin/*` routes.
 */

function isCleanHelpingBullet(item) {
  if (!item || typeof item !== 'object' || item.locked) return false
  const verdictStr = item.verdict ? String(item.verdict).toLowerCase() : ''
  const isPass =
    verdictStr === 'helping' ||
    (!verdictStr &&
      (item.status === 'pass' ||
        item.severity === 'PASS' ||
        (typeof item.impactScore === 'number' && item.impactScore >= 75)))
  if (!isPass) return false

  const orig = String(item.original || item.originalText || item.text || item.bullet || '').trim()
  const rew = String(
    item.correctedText ||
      item.rewrittenText ||
      item.rewritten ||
      item.rewrite ||
      item.improved ||
      item.upgrade ||
      item.readyToUseRewrite ||
      ''
  ).trim()
  const hasRephrase = Boolean(rew && orig && rew.toLowerCase() !== orig.toLowerCase())
  const hasIssues =
    (Array.isArray(item.issues) && item.issues.length > 0) ||
    (Array.isArray(item.missingParts) && item.missingParts.length > 0)

  return !hasRephrase && !hasIssues
}

function redactBulletList(list, redactedBulletIds) {
  if (!Array.isArray(list) || list.length === 0) return list

  const normalized = list.map((item) => {
    if (!item || typeof item !== 'object') return item
    if (isCleanHelpingBullet(item)) {
      return { ...item, verdict: 'helping' }
    }
    return { ...item, verdict: 'hurting' }
  })

  const hurtingIndices = []
  normalized.forEach((item, idx) => {
    if (!isCleanHelpingBullet(item)) hurtingIndices.push(idx)
  })

  // Keep 100% of genuinely clean Helping bullets + first 40% (at least 1) of Hurting bullets
  const visibleHurtingCount = hurtingIndices.length > 0
    ? Math.max(1, Math.ceil(hurtingIndices.length * 0.4))
    : 0
  const visibleHurtingSet = new Set(hurtingIndices.slice(0, visibleHurtingCount))

  return normalized.map((item, idx) => {
    if (isCleanHelpingBullet(item) || visibleHurtingSet.has(idx)) {
      return item
    }
    const bId = item?.bulletId || item?.id || `b_${idx}`
    if (item?.bulletId || item?.id) redactedBulletIds.add(String(bId))
    return { id: String(bId), verdict: 'hurting', locked: true }
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

  // Keep 40% of Missing Target Keywords (lock 60%) and 50% of Skills-Only
  const ranked = redactKeywordArray(ka.missingMarketSkillsRanked, 0.4)
  const missing = redactKeywordArray(ka.missingFromResume, 0.4)
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

  if (Array.isArray(next.recommendedSkillsToAdd) && next.recommendedSkillsToAdd.length > 0) {
    next.recommendedSkillsToAdd = next.recommendedSkillsToAdd.map(() => ({ locked: true }))
    next.recommendedSkillsLocked = true
  }

  if (next.visualPrompts) {
    next.visualPrompts = { locked: true }
    next.visualPromptsLocked = true
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

  // 1. Resume Bullet Audits & Keyword Alignment across all known array paths
  const redactBulletFieldsOnObj = (obj) => {
    if (!obj || typeof obj !== 'object') return
    for (const key of [
      'bulletAudit',
      'bulletAudits',
      'bulletRewrites',
      'bullet_rewrites',
      'bulletUpgrades',
      'hurtingBullets',
    ]) {
      if (Array.isArray(obj[key])) {
        obj[key] = redactBulletList(obj[key], redactedBulletIds)
      }
    }
    if (obj.resumeAudit && Array.isArray(obj.resumeAudit.bullets)) {
      obj.resumeAudit.bullets = redactBulletList(obj.resumeAudit.bullets, redactedBulletIds)
    }
  }

  if (cloned.resume_agent && typeof cloned.resume_agent === 'object') {
    if (cloned.resume_agent.dashboard && typeof cloned.resume_agent.dashboard === 'object') {
      redactBulletFieldsOnObj(cloned.resume_agent.dashboard)
      cloned.resume_agent.dashboard.keywordAlignment = redactKeywordAlignment(
        cloned.resume_agent.dashboard.keywordAlignment
      )
    }
    redactBulletFieldsOnObj(cloned.resume_agent)
    cloned.resume_agent.keywordAlignment = redactKeywordAlignment(cloned.resume_agent.keywordAlignment)

    // Strip Summary Rewrite (keep original/before intact)
    if (cloned.resume_agent.summaryOptimization && typeof cloned.resume_agent.summaryOptimization === 'object') {
      cloned.resume_agent.summaryOptimization = {
        ...cloned.resume_agent.summaryOptimization,
        rewrittenSummary: undefined,
        rewritten: undefined,
        after: undefined,
        summaryRewriteLocked: true,
      }
    }
    if (cloned.resume_agent.dashboard?.summaryOptimization && typeof cloned.resume_agent.dashboard.summaryOptimization === 'object') {
      cloned.resume_agent.dashboard.summaryOptimization = {
        ...cloned.resume_agent.dashboard.summaryOptimization,
        rewrittenSummary: undefined,
        rewritten: undefined,
        after: undefined,
        summaryRewriteLocked: true,
      }
    }

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

  redactBulletFieldsOnObj(cloned)
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
    if (cloned.linkedin_agent.visualPrompts) {
      cloned.linkedin_agent.visualPrompts = { locked: true }
    }
  }

  // 3. Overview: Action #3, 7-Day Plan, and 60/90-Day Milestones (keep 30-Day Phase 1 visible)
  if (Array.isArray(cloned.top_actions) && cloned.top_actions.length > 2) {
    cloned.top_actions = cloned.top_actions.map((act, idx) => (idx < 2 ? act : { locked: true }))
  }

  if (Array.isArray(cloned.roadmap) && cloned.roadmap.length > 0) {
    cloned.roadmap = cloned.roadmap.map((m, idx) => (idx === 0 ? m : { locked: true }))
  }
  if (Array.isArray(cloned.milestonePathway) && cloned.milestonePathway.length > 0) {
    cloned.milestonePathway = cloned.milestonePathway.map((m, idx) => (idx === 0 ? m : { locked: true }))
  }
  if (Array.isArray(cloned.seven_day_plan) && cloned.seven_day_plan.length > 0) {
    cloned.seven_day_plan = cloned.seven_day_plan.map(() => ({ locked: true }))
  }
  if (cloned.action_plan && typeof cloned.action_plan === 'object') {
    if (Array.isArray(cloned.action_plan.milestonePathway)) {
      cloned.action_plan.milestonePathway = cloned.action_plan.milestonePathway.map((m, idx) => (idx === 0 ? m : { locked: true }))
    }
    if (Array.isArray(cloned.action_plan.sevenDayPlan)) {
      cloned.action_plan.sevenDayPlan = cloned.action_plan.sevenDayPlan.map(() => ({ locked: true }))
    }
  }

  cloned.__teaserRedacted = true
  return cloned
}
