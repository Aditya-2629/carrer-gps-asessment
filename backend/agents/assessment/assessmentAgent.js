/**
 * Assessment Personalization Agent & V2 Scoring Engine
 *
 * Implements:
 *  - 100-Point Weighted Scoring Rubric (Resume 25, LinkedIn 15, Job Search 20, Networking 15, Hiring Funnel 20, Career Readiness 5)
 *  - 4-Tier Resume ↔ LinkedIn Consistency Classifier
 *  - 5-Phase Hiring Detection Engine & Confidence Engine
 *  - Root Cause Matrix & Prioritized Top Actions
 *  - External Context & SDLC Market Cycle Intelligence
 *  - Persona & Agent Directives (preserved for Maya, Liam, Atlas Coach)
 */

import { classifyConsistencyTier } from '../linkedin/linkedinCrossAnalyzer.js'

// Helper: parse numbers from strings or quantitative objects
export function extractQuantMetric(val, fallbackNum = 0, defaultPeriod = 'month') {
  if (val === null || val === undefined) {
    return { rawNum: fallbackNum, period: defaultPeriod, perWeek: Math.round(fallbackNum / 4.33), perMonth: fallbackNum, label: `${fallbackNum}` }
  }
  if (typeof val === 'number') {
    return { rawNum: val, period: defaultPeriod, perWeek: defaultPeriod === 'week' ? val : Math.round(val / 4.33), perMonth: defaultPeriod === 'month' ? val : Math.round(val * 4.33), label: `${val} / ${defaultPeriod}` }
  }
  if (typeof val === 'object') {
    if (val.is_na || val.isNA || val.raw === 'N/A' || val.rawAnswer === 'N/A') {
      return { rawNum: 0, period: val.period || val.selectedPeriod || defaultPeriod, perWeek: 0, perMonth: 0, label: '0' }
    }
    const rawVal = val.raw ?? val.rawAnswer ?? val.value ?? val.normalizedPerMonth ?? val.normalizedPerWeek ?? ''
    const rawStr = String(rawVal).replace(/[^0-9.]/g, '')
    const num = rawStr !== '' ? Number(rawStr) : fallbackNum
    const period = val.period === 'week' || val.period === 'month'
      ? val.period
      : val.selectedPeriod === 'week' || val.selectedPeriod === 'month'
      ? val.selectedPeriod
      : defaultPeriod
    const perWeek = val.per_week != null ? Number(val.per_week) : val.normalizedPerWeek != null ? Number(val.normalizedPerWeek) : (period === 'week' ? num : Math.round((num / 4.33) * 10) / 10)
    const perMonth = val.per_month != null ? Number(val.per_month) : val.normalizedPerMonth != null ? Number(val.normalizedPerMonth) : (period === 'month' ? num : Math.round(num * 4.33))
    return {
      rawNum: isNaN(num) ? fallbackNum : num,
      period,
      perWeek: isNaN(perWeek) ? 0 : perWeek,
      perMonth: isNaN(perMonth) ? 0 : perMonth,
      label: `${isNaN(num) ? fallbackNum : num} per ${period}`,
    }
  }
  const match = String(val).match(/\d+(\.\d+)?/)
  const parsed = match ? Number(match[0]) : fallbackNum
  const period = /week/i.test(String(val)) ? 'week' : /month/i.test(String(val)) ? 'month' : defaultPeriod
  return {
    rawNum: parsed,
    period,
    perWeek: period === 'week' ? parsed : Math.round((parsed / 4.33) * 10) / 10,
    perMonth: period === 'month' ? parsed : Math.round(parsed * 4.33),
    label: `${parsed} per ${period}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 100-Point Weighted Scoring Rubric Engine
// ─────────────────────────────────────────────────────────────────────────────

export function computeCareerGpsScore({
  answers = {},
  resumeAgent = null,
  linkedinAgent = null,
  semanticProfile = null,
} = {}) {
  const ans = { ...answers }

  // ── Area 1: Resume (Max 25 pts, 12 checks) ──
  const resumeScore100 = resumeAgent?.dashboard?.score ?? 68
  const resumeTargetPts = Math.round((resumeScore100 / 100) * 25)
  const resumeRatio = resumeScore100 / 100

  const resumeChecks = [
    { name: 'Target-role alignment', max: 4, points: Math.round(4 * resumeRatio * 10) / 10 },
    { name: 'Recent & relevant experience', max: 3, points: Math.round(3 * resumeRatio * 10) / 10 },
    { name: 'Achievements & measurable impact', max: 4, points: Math.round(4 * resumeRatio * 10) / 10 },
    { name: 'Career timeline consistency', max: 3, points: Math.round(3 * resumeRatio * 10) / 10 },
    { name: 'Job-title consistency', max: 2, points: Math.round(2 * resumeRatio * 10) / 10 },
    { name: 'Relevant skills', max: 2, points: Math.round(2 * resumeRatio * 10) / 10 },
    { name: 'Repetitive / weak content', max: 2, points: Math.round(2 * resumeRatio * 10) / 10 },
    { name: 'Excessive AI / buzzwords', max: 1, points: Math.round(1 * resumeRatio * 10) / 10 },
    { name: 'Formatting & readability', max: 1, points: Math.round(1 * resumeRatio * 10) / 10 },
    { name: 'White space & layout', max: 1, points: Math.round(1 * resumeRatio * 10) / 10 },
    { name: 'Section completeness', max: 1, points: Math.round(1 * resumeRatio * 10) / 10 },
    { name: 'Overall resume relevance', max: 1, points: Math.round(1 * resumeRatio * 10) / 10 },
  ]
  // Adjust sum to precisely match resumeTargetPts
  let resumeSum = resumeChecks.reduce((acc, c) => acc + c.points, 0)
  const diffResume = Math.round(resumeTargetPts - resumeSum)
  if (diffResume !== 0 && resumeChecks.length > 0) {
    resumeChecks[0].points = Math.max(0, Math.min(resumeChecks[0].max, resumeChecks[0].points + diffResume))
  }
  const resumeEarned = resumeTargetPts

  // ── Area 2: LinkedIn (Max 15 pts, 9 checks) ──
  const liScore100 = linkedinAgent?.score ?? 65
  const liTargetPts = Math.round((liScore100 / 100) * 15)
  const liRatio = liScore100 / 100

  // Resume ↔ LinkedIn consistency
  const crossSummary = linkedinAgent?.discrepanciesAnalysis?.summary || {}
  const consistencyClassifier = classifyConsistencyTier({
    summary: crossSummary,
    discrepancies: linkedinAgent?.discrepancies || [],
    timelineMismatches: linkedinAgent?.discrepanciesAnalysis?.timelineMismatches || [],
    titleDrift: linkedinAgent?.discrepanciesAnalysis?.titleDrift || [],
  })
  const consistencyPts = consistencyClassifier.points ?? 1.5

  const liChecks = [
    { name: 'Headline & positioning', max: 2, points: Math.min(2, Math.round(2 * liRatio * 10) / 10) },
    { name: 'About section', max: 2, points: Math.min(2, Math.round(2 * liRatio * 10) / 10) },
    { name: 'Experience quality', max: 2, points: Math.min(2, Math.round(2 * liRatio * 10) / 10) },
    { name: 'Target-role alignment', max: 2, points: Math.min(2, Math.round(2 * liRatio * 10) / 10) },
    { name: 'Skills & expertise', max: 2, points: Math.min(2, Math.round(2 * liRatio * 10) / 10) },
    { name: 'Profile completeness', max: 1, points: Math.min(1, Math.round(1 * liRatio * 10) / 10) },
    { name: 'Featured / proof of work', max: 1, points: Math.min(1, Math.round(1 * liRatio * 10) / 10) },
    { name: 'Recommendations / social proof', max: 1, points: Math.min(1, Math.round(1 * liRatio * 10) / 10) },
    { name: 'Resume ↔ LinkedIn consistency', max: 2, points: consistencyPts },
  ]
  const liEarned = liTargetPts

  // ── Area 3: Job Search (Max 20 pts, 8 checks) ──
  const matchPctStr = String(ans.targetedMatchPct || '')
  let targetedAppPts = 2
  if (/80%|Highly/i.test(matchPctStr)) targetedAppPts = 4
  else if (/50%|Moderately/i.test(matchPctStr)) targetedAppPts = 3
  else if (/20%|Broad/i.test(matchPctStr)) targetedAppPts = 2
  else if (/Under/i.test(matchPctStr)) targetedAppPts = 1

  const methods = Array.isArray(ans.searchMethods) ? ans.searchMethods : [String(ans.searchMethods || '')]
  const hasDirectAts = methods.some((m) => /Career Pages|Direct ATS/i.test(m))
  const hasReferrals = methods.some((m) => /Referral/i.test(m))
  const hasDirectOutreach = methods.some((m) => /Recruiter|Hiring Manager Outreach/i.test(m))
  const hasOnlyJobBoards = methods.length === 1 && /Easy Apply|Job Boards/i.test(methods[0])

  let appStrategyPts = hasOnlyJobBoards ? 1 : (hasDirectAts && (hasReferrals || hasDirectOutreach) ? 3 : 2)
  let qualitySourcesPts = hasDirectAts || hasReferrals ? 2 : 1.5

  const alreadyTried = Array.isArray(ans.alreadyTried) ? ans.alreadyTried : [String(ans.alreadyTried || '')]
  let resumeCustomizationPts = alreadyTried.some((t) => /Rewrote|resume/i.test(t)) || targetedAppPts >= 3 ? 2 : 1

  let searchConsistencyPts = 2.5
  let companyResearchPts = targetedAppPts >= 3 ? 2 : 1

  // Application volume relative to goal (evaluates quality + sustainable pace, not raw blast)
  const rawApps30d = extractQuantMetric(ans.apps30d ?? (ans.appsWeek ? ans.appsWeek * 4.33 : null), 30, 'month').rawNum
  let volumeRelativePts = 1.5
  if (rawApps30d >= 15 && rawApps30d <= 80 && targetedAppPts >= 3) {
    volumeRelativePts = 2 // Quality + sustainable pace
  } else if (rawApps30d > 150 && targetedAppPts <= 2) {
    volumeRelativePts = 1 // High volume spray
  } else if (rawApps30d === 0) {
    volumeRelativePts = 0.5
  }

  // Strategy effectiveness based on screen conversion rate
  const screensMetric = ans.funnel90d?.screens ?? ans.interviews ?? ans.humanScreen ?? 0
  const screenConversionRate = rawApps30d > 0 ? (Number(screensMetric) / rawApps30d) * 100 : 0
  let strategyEffectivenessPts = screenConversionRate >= 5 ? 2 : (screenConversionRate >= 2 ? 1.5 : 1)

  const jobSearchChecks = [
    { name: 'Targeted application percentage', max: 4, points: targetedAppPts },
    { name: 'Application strategy', max: 3, points: appStrategyPts },
    { name: 'Quality of job sources', max: 2, points: qualitySourcesPts },
    { name: 'Resume customization', max: 2, points: resumeCustomizationPts },
    { name: 'Search consistency', max: 3, points: searchConsistencyPts },
    { name: 'Company / role research', max: 2, points: companyResearchPts },
    { name: 'Application volume relative to goal', max: 2, points: volumeRelativePts },
    { name: 'Strategy effectiveness', max: 2, points: strategyEffectivenessPts },
  ]
  const jobSearchEarned = Math.min(20, Math.round(jobSearchChecks.reduce((a, c) => a + c.points, 0)))

  // ── Area 4: Networking (Max 15 pts, 7 checks) ──
  const outreachRaw = extractQuantMetric(ans.outreach, 5, 'week').rawNum
  let personalizedOutreachPts = 1
  if (outreachRaw >= 30) personalizedOutreachPts = 3
  else if (outreachRaw >= 15) personalizedOutreachPts = 2.5
  else if (outreachRaw >= 5) personalizedOutreachPts = 2
  else if (outreachRaw > 0) personalizedOutreachPts = 1.5

  const refStr = String(ans.referralsMonth || '')
  let referralActivityPts = 1
  if (/10\+/i.test(refStr)) referralActivityPts = 3
  else if (/4[–-]10/i.test(refStr)) referralActivityPts = 2.5
  else if (/1[–-]3/i.test(refStr)) referralActivityPts = 1.5
  else if (/0/i.test(refStr)) referralActivityPts = 0.5

  const recruiterOutreachPts = hasDirectOutreach ? 2 : 1
  const newConnectionsPts = outreachRaw >= 10 ? 2 : 1
  const industryEngagementPts = hasReferrals || outreachRaw >= 15 ? 2 : 1
  const followUpPts = outreachRaw >= 5 ? 2 : 1
  const networkingStrategyPts = hasDirectOutreach && hasReferrals ? 1 : 0.5

  const networkingChecks = [
    { name: 'New professional connections', max: 2, points: newConnectionsPts },
    { name: 'Personalized outreach', max: 3, points: personalizedOutreachPts },
    { name: 'Recruiter / hiring-manager outreach', max: 2, points: recruiterOutreachPts },
    { name: 'Referral activity', max: 3, points: referralActivityPts },
    { name: 'Industry engagement', max: 2, points: industryEngagementPts },
    { name: 'Follow-up', max: 2, points: followUpPts },
    { name: 'Networking strategy', max: 1, points: networkingStrategyPts },
  ]
  const networkingEarned = Math.min(15, Math.round(networkingChecks.reduce((a, c) => a + c.points, 0)))

  // ── Area 5: Hiring Funnel (Max 20 pts, 7 checks) ──
  const funnelScreens = Number(ans.funnel90d?.screens ?? ans.interviews ?? ans.humanScreen ?? 0)
  const funnelTechs = Number(ans.funnel90d?.assessments ?? ans.assessments ?? 0)
  const funnelFinals = Number(ans.funnel90d?.finals ?? ans.finalRounds ?? 0)
  const funnelOffers = Number(ans.funnel90d?.offers ?? ans.offers ?? 0)

  let appToScreenPts = 1.5
  if (screenConversionRate >= 8) appToScreenPts = 4
  else if (screenConversionRate >= 4) appToScreenPts = 3
  else if (screenConversionRate >= 2) appToScreenPts = 2

  let screenToTechPts = funnelScreens > 0 ? (funnelTechs / funnelScreens >= 0.5 ? 3 : 2) : 1.5
  let techToFinalPts = funnelTechs > 0 ? (funnelFinals / funnelTechs >= 0.4 ? 3 : 2) : 1.5
  let finalToOfferPts = funnelOffers >= 1 ? 4 : (funnelFinals >= 1 ? 2.5 : 1.5)

  let prepPts = alreadyTried.some((t) => /mock|LeetCode/i.test(t)) ? 2 : 1
  let understandingRejectionPts = ans.DropOffStage ? 2 : 1
  let feedbackImprovementPts = alreadyTried.length >= 2 ? 2 : 1

  const hiringFunnelChecks = [
    { name: 'Application → Screening', max: 4, points: appToScreenPts },
    { name: 'Screening → Technical/Assessment', max: 3, points: screenToTechPts },
    { name: 'Technical/Interview → Final', max: 3, points: techToFinalPts },
    { name: 'Final → Offer', max: 4, points: finalToOfferPts },
    { name: 'Interview preparation', max: 2, points: prepPts },
    { name: 'Understanding rejection point', max: 2, points: understandingRejectionPts },
    { name: 'Feedback & improvement', max: 2, points: feedbackImprovementPts },
  ]
  const hiringFunnelEarned = Math.min(20, Math.round(hiringFunnelChecks.reduce((a, c) => a + c.points, 0)))

  // ── Area 6: Career Readiness (Max 5 pts, 5 checks) ──
  const hasClarity = Boolean(ans.opportunityType && ans.targetRole)
  const careerReadinessChecks = [
    { name: 'Career clarity', max: 1, points: hasClarity ? 1 : 0.5 },
    { name: 'Understanding target role', max: 1, points: ans.targetRole ? 1 : 0.5 },
    { name: 'Skill development', max: 1, points: alreadyTried.length >= 1 ? 1 : 0.5 },
    { name: 'Interview preparation', max: 1, points: alreadyTried.some((t) => /mock|LeetCode/i.test(t)) ? 1 : 0.5 },
    { name: 'Willingness to change strategy', max: 1, points: 1 },
  ]
  const careerReadinessEarned = Math.min(5, Math.round(careerReadinessChecks.reduce((a, c) => a + c.points, 0)))

  // Total GPS Score out of 100
  const gps_score = Math.min(100, Math.max(0,
    resumeEarned + liEarned + jobSearchEarned + networkingEarned + hiringFunnelEarned + careerReadinessEarned
  ))

  const grade = gps_score >= 85 ? 'A' : gps_score >= 70 ? 'B' : gps_score >= 55 ? 'C' : 'D'
  const gradeLabel = gps_score >= 85 ? 'Excellent' : gps_score >= 70 ? 'Good' : gps_score >= 55 ? 'Needs Optimization' : 'Critical Focus Required'

  return {
    gps_score,
    grade,
    gradeLabel,
    areas: {
      resume: {
        points: resumeEarned,
        maxPoints: 25,
        percentage: Math.round((resumeEarned / 25) * 100),
        title: 'Resume & Career Documents',
        checks: resumeChecks,
      },
      linkedin: {
        points: liEarned,
        maxPoints: 15,
        percentage: Math.round((liEarned / 15) * 100),
        title: 'LinkedIn & Professional Brand',
        consistencyTier: consistencyClassifier.tier,
        consistencyDetails: consistencyClassifier,
        checks: liChecks,
      },
      jobSearch: {
        points: jobSearchEarned,
        maxPoints: 20,
        percentage: Math.round((jobSearchEarned / 20) * 100),
        title: 'Job Search & Application Strategy',
        checks: jobSearchChecks,
      },
      networking: {
        points: networkingEarned,
        maxPoints: 15,
        percentage: Math.round((networkingEarned / 15) * 100),
        title: 'Networking & Referral Velocity',
        checks: networkingChecks,
      },
      hiringFunnel: {
        points: hiringFunnelEarned,
        maxPoints: 20,
        percentage: Math.round((hiringFunnelEarned / 20) * 100),
        title: 'Interview & Hiring Funnel',
        checks: hiringFunnelChecks,
      },
      careerReadiness: {
        points: careerReadinessEarned,
        maxPoints: 5,
        percentage: Math.round((careerReadinessEarned / 5) * 100),
        title: 'Career Readiness & Execution',
        checks: careerReadinessChecks,
      },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Configurable Six-Phase Detection Engine (Yash's Framework)
// ─────────────────────────────────────────────────────────────────────────────

export const PHASE_THRESHOLDS = {
  minApps30dForActiveSearch: 8,        // Below this -> Phase 6 (Readiness) or Provisional
  minResumeScoreForReadiness: 50,      // Below this with low apps -> Phase 6
  phase1MaxScreens30d: 10,             // < 10 screening calls + assessments + AI interviews in 30d -> Phase 1
  phase2MinScreens30d: 3,              // Opportunity gate to evaluate Phase 2 (or >= 6 in 90d)
  phase2MaxTechRounds30d: 5,           // < 5 technical rounds in 30d despite screens -> Phase 2
  phase3MinTechRounds30d: 2,           // Opportunity gate to evaluate Phase 3 (or >= 3 in 90d)
  phase3MaxFinalRounds30d: 3,          // < 3 final rounds in 30d despite tech rounds -> Phase 3
  phase4MinFinalRounds30d: 3,          // >= 3 final rounds (or >= 2 in 30d / >= 3 in 90d) with 0 offers -> Phase 4
}

export const HIRING_PHASES = {
  1: {
    id: 1,
    name: 'Application → Screening',
    shortName: 'Top of Funnel',
    stuckDescription: 'Submitting applications consistently, but receiving almost no recruiter screening calls or assessments.',
    metricGoal: 'Achieve >5% application-to-screen callback conversion.',
  },
  2: {
    id: 2,
    name: 'Screening / Assessment → Technical',
    shortName: 'Recruiter Screen Stage',
    stuckDescription: 'Getting recruiter calls or automated assessments, but not reaching live technical rounds.',
    metricGoal: 'Convert >50% of recruiter screens into hiring manager/tech rounds.',
  },
  3: {
    id: 3,
    name: 'Technical → Final Round',
    shortName: 'Technical Gate',
    stuckDescription: 'Passing screens, but dropping off in live coding, system design, or technical assessments.',
    metricGoal: 'Pass >40% of technical rounds to reach final onsite panels.',
  },
  4: {
    id: 4,
    name: 'Final Round → Offer',
    shortName: 'Final Decision Gate',
    stuckDescription: 'Reaching final managerial/onsite rounds, but not converting them into formal offers.',
    metricGoal: 'Convert final interview rounds into competitive formal written offers.',
  },
  5: {
    id: 5,
    name: 'Offer → Joining',
    shortName: 'Offer & Onboarding Gate',
    stuckDescription: 'Offer received, but onboarding, background verification, or joining is delayed or blocked.',
    metricGoal: 'Clear background verification and finalize onboarding smoothly.',
  },
  6: {
    id: 6,
    name: 'Resume → Application Readiness',
    shortName: 'Readiness & Asset Prep',
    stuckDescription: 'Not yet applying consistently (<8 apps/month) or core assets need baseline calibration before market launch.',
    metricGoal: 'Complete asset audit and build daily application habit (10–15 apps/week).',
  },
}

export function detectHiringPhase({ answers = {}, resumeAgent = null, linkedinAgent = null } = {}) {
  const ans = { ...answers }

  // 1. Funnel Metric Normalization (30-Day Pace & 90-Day Totals)
  const apps30d = extractQuantMetric(ans.apps30d ?? (ans.appsWeek ? ans.appsWeek * 4.33 : null), 0, 'month').rawNum
  const recruiterScreens = Number(ans.funnel90d?.recruiterScreens ?? ans.funnel90d?.screens ?? ans.interviews ?? ans.humanScreen ?? 0)
  const assessments = Number(ans.funnel90d?.assessments ?? 0)
  const aiInterviews = Number(ans.funnel90d?.aiInterviews ?? 0)

  const screens90d = recruiterScreens + assessments + aiInterviews
  const screens30d = Math.round(screens90d / 3)

  const techs90d = Number(ans.funnel90d?.technicalRounds ?? ans.technicalRounds ?? ans.technical ?? ans.funnel90d?.assessments ?? ans.assessments ?? 0)
  const techs30d = Math.max(Math.round(techs90d / 3), Number(ans.technicalRounds30d ?? ans.techs30d ?? 0))

  const finals90d = Number(ans.funnel90d?.finalRounds ?? ans.finalRounds ?? ans.finals ?? ans.funnel90d?.finals ?? 0)
  const finals30d = Math.max(Math.round(finals90d / 3), Number(ans.finalRounds30d ?? ans.finals30d ?? 0))

  const offers90d = Number(ans.funnel90d?.offers ?? ans.offers ?? 0)
  const joiningStatus = String(ans.funnel90d?.joiningStatus || ans.joiningStatus || '').trim()

  const resumeScore = resumeAgent?.dashboard?.score ?? 68
  const dropOffStage = String(ans.DropOffStage || '').toLowerCase()
  const phaseMatch = dropOffStage.match(/phase\s*(\d)/i)
  const selfReportedPhase = phaseMatch ? Number(phaseMatch[1]) : null

  let detectedPhaseId = 1
  let detectionSource = 'observed_funnel'

  // 2. Opportunity-Gated Exact Phase Evaluation
  if (offers90d >= 1 && (joiningStatus.toLowerCase().includes('delayed') || joiningStatus.toLowerCase().includes('blocked') || selfReportedPhase === 5 || dropOffStage.includes('joining'))) {
    detectedPhaseId = 5
  } else if (((finals90d >= 3 || finals30d >= 3) || (finals90d >= 2 && (selfReportedPhase === 4 || dropOffStage.includes('onsite')))) && offers90d === 0) {
    detectedPhaseId = 4
  } else if (finals90d >= 1 || finals30d >= 1) {
    // Candidate reached final round(s)! Never force into Phase 1.
    if (selfReportedPhase === 4 || finals90d >= 2) {
      detectedPhaseId = 4
    } else {
      detectedPhaseId = 3 // Technical -> Final Round
    }
  } else if (techs90d >= 1 || techs30d >= 1) {
    // Candidate reached live technical round(s)! Never force into Phase 1.
    if (techs90d >= 2 || selfReportedPhase === 3) {
      detectedPhaseId = 3
    } else {
      detectedPhaseId = 2 // Screening -> Technical
    }
  } else if ((screens90d >= 5 || screens30d >= PHASE_THRESHOLDS.phase2MinScreens30d) && techs30d < PHASE_THRESHOLDS.phase2MaxTechRounds30d && (screens90d === 0 || (techs90d / screens90d) < 0.45)) {
    detectedPhaseId = 2
  } else if (apps30d < PHASE_THRESHOLDS.minApps30dForActiveSearch || (resumeScore < PHASE_THRESHOLDS.minResumeScoreForReadiness && screens90d === 0) || selfReportedPhase === 6 || dropOffStage.includes('readiness')) {
    detectedPhaseId = 6
  } else if (apps30d >= PHASE_THRESHOLDS.minApps30dForActiveSearch && screens30d < PHASE_THRESHOLDS.phase1MaxScreens30d) {
    detectedPhaseId = 1
  } else if (selfReportedPhase) {
    // Priority 3: Self-Reported Stuck Stage fallback
    detectionSource = 'self_reported'
    detectedPhaseId = selfReportedPhase
  }

  // 3. Provisional & Confidence Logic
  let confidence = 'Medium'
  let isProvisional = false
  let provisionalLabel = null

  if (apps30d < 5 && screens90d === 0 && techs90d === 0) {
    isProvisional = true
    confidence = 'Low'
    provisionalLabel = 'Provisional Diagnosis (Insufficient 30-Day Funnel Volume)'
  } else if (apps30d >= 20 || screens90d >= 5) {
    confidence = 'High'
  } else if (apps30d >= 5) {
    confidence = 'Medium'
  } else {
    confidence = 'Low'
  }

  const phaseMeta = HIRING_PHASES[detectedPhaseId] || HIRING_PHASES[1]

  return {
    id: detectedPhaseId,
    name: phaseMeta.name,
    shortName: phaseMeta.shortName,
    stuckDescription: phaseMeta.stuckDescription,
    metricGoal: phaseMeta.metricGoal,
    confidence,
    isProvisional,
    provisionalLabel,
    detectionSource,
    funnelSummary: {
      applications30d: apps30d,
      applications90d: ans.funnel90d?.applications90d ?? (apps30d * 3),
      recruiterScreens,
      assessments,
      aiInterviews,
      screens90d,
      screens30d,
      technicalRounds: techs90d,
      finalRounds: finals90d,
      offers: offers90d,
      joiningStatus: joiningStatus || 'No Offer Yet',
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Root Cause Matrix & Action Mapping (6-Phase Library)
// ─────────────────────────────────────────────────────────────────────────────

export function synthesizeRootCauseAndActions({
  phase,
  scores,
  answers = {},
  resumeAgent = null,
  linkedinAgent = null,
} = {}) {
  const ans = { ...answers }
  const areas = scores?.areas || {}

  // Find strongest area by percentage
  let strongestAreaKey = 'resume'
  let maxPct = -1
  for (const [key, area] of Object.entries(areas)) {
    if (area.percentage > maxPct) {
      maxPct = area.percentage
      strongestAreaKey = key
    }
  }
  const strongestArea = `${areas[strongestAreaKey]?.title || 'Resume'} (${areas[strongestAreaKey]?.points || 0}/${areas[strongestAreaKey]?.maxPoints || 0})`

  // Select Primary Bottleneck & Secondary Problem based on Phase (1–6)
  let primary_bottleneck = {
    title: 'Top-of-Page ATS Keyword Alignment & Metric Gaps',
    category: 'ats_readability',
    whyItMatters: 'Recruiters scan applications in under 10 seconds. Missing metrics and generic task bullets cause automated screening drops before humans review.',
    evidence: resumeAgent?.issues?.[0]?.diagnosis || 'Resume bullets lack quantified metrics and Google XYZ achievement structure.',
  }

  let secondary_problem = {
    title: 'Low Direct Recruiter & Referral Outreach Volume',
    category: 'networking',
    description: 'Pipeline relies excessively on public Easy Apply job boards rather than direct hiring manager outreach or employee introductions.',
  }

  let next_best_action = 'Rewrite your top 5 resume achievement bullets with hard numbers and business impact metrics.'

  const parseNum = (v) => {
    if (v == null) return 0
    if (typeof v === 'number') return v
    if (typeof v === 'object') return Number(v.raw || v.value || 0)
    const m = String(v).match(/\d+/)
    return m ? Number(m[0]) : 0
  }

  const rawApps30 = parseNum(ans.apps30d) || (parseNum(ans.appsWeek) * 4) || 0
  const rawApps90 = parseNum(ans.applications90d) || parseNum(ans.funnel90d?.applications90d) || (rawApps30 * 3) || 0
  const rawScreens90 = parseNum(ans.recruiterScreens) || parseNum(ans.funnel90d?.recruiterScreens) || parseNum(ans.interviews) || 0
  const isHighVolumeLowCallback = (rawApps90 >= 250 || rawApps30 >= 70) && (rawScreens90 <= 3 || (rawScreens90 / Math.max(1, rawApps90)) < 0.01)

  if (isHighVolumeLowCallback) {
    primary_bottleneck = {
      title: 'High-Volume Portal Black Hole (ATS Keyword & Targeting Mismatch)',
      category: 'ats_readability',
      whyItMatters: 'Submitting hundreds of applications with near-zero callbacks (<1%) confirms applications are disappearing in ATS portal filters or untargeted keyword rejection.',
      evidence: `Candidate submitted ${rawApps90 || rawApps30}+ applications with fewer than ${Math.max(1, rawScreens90)} screening calls (<1% conversion rate).`,
    }
    secondary_problem = {
      title: 'Over-Reliance on High-Competition Portals Without Referral Outreach',
      category: 'job_search',
      description: 'Applying broadly on high-competition public job boards without direct hiring manager outreach or targeted ATS customization.',
    }
    next_best_action = 'Pause cold portal blasts; align resume bullets with exact job description keywords and initiate 5-to-1 targeted outreach to hiring managers.'
  } else if (phase.id === 6) {
    primary_bottleneck = {
      title: 'Incomplete / Unquantified Resume & Application Momentum Gaps',
      category: 'readiness',
      whyItMatters: 'Before scaling application volume, core documents and daily search rhythm must be established to avoid burning target employer opportunities.',
      evidence: ans.DropOffStage || 'Candidate submits fewer than 8 applications/month or is just beginning active search.',
    }
    secondary_problem = {
      title: 'Inconsistent Weekly Application Volume (<8 Applications / Month)',
      category: 'execution',
      description: 'Without a predictable daily outbound schedule, pipeline feedback loops cannot calibrate.',
    }
    next_best_action = 'Audit and calibrate your top 5 resume bullets to STAR format and commit to submitting 10 targeted applications per week.'
  } else if (phase.id === 1) {
      primary_bottleneck = {
        title: 'ATS Keyword & Role-Level Mismatch on Top-of-Funnel Submissions',
        category: 'resume_impact',
        whyItMatters: 'With applications submitting but almost no recruiter callbacks, the document is getting dropped in ATS filters or the recruiter 6-second scan.',
        evidence: resumeAgent?.issues?.[0]?.diagnosis || 'Resume bullets lack quantified metrics and direct keywords aligned with target job specifications.',
      }
      secondary_problem = {
        title: 'Over-Reliance on LinkedIn Easy Apply Without Direct ATS & Referral Outreach',
        category: 'job_search',
        description: 'Applying broadly on high-competition public job boards without direct career page submissions lowers callback probability.',
      }
      next_best_action = 'Diversify application volume to direct company ATS portals and send 15 personalized recruiter messages per week.'
  } else if (phase.id === 2) {
    primary_bottleneck = {
      title: 'Recruiter Screen Elevator Pitch & Technical Assessment Drop-off',
      category: 'screening_delivery',
      whyItMatters: 'Recruiter screens verify communication, technical summary clarity, and compensation alignment. Failing to convert calls means the live elevator pitch is stalling.',
      evidence: ans.biggestChallenge || 'Candidate reports receiving initial recruiter screens/assessments but struggling to advance to live technical rounds.',
    }
    secondary_problem = {
      title: 'Unclear Project Responsibility Framing on 15-Minute Recruiter Screens',
      category: 'communication',
      description: 'Stumbling on past project architecture or verbal ownership creates hesitation with talent acquisition screeners.',
    }
    next_best_action = 'Script and drill your crisp 60-second verbal project pitch and practice timed coding OA tests.'
  } else if (phase.id === 3) {
    primary_bottleneck = {
      title: 'Inability to Explain Project Architecture & Live Coding Execution',
      category: 'technical_execution',
      whyItMatters: 'You are advancing through recruiter screens but stalling at live coding, SQL, or system design rounds. Technical panels require structured trade-off reasoning.',
      evidence: ans.biggestChallenge || 'Candidate drops off during technical assessments or live problem-solving rounds.',
    }
    secondary_problem = {
      title: 'Low Verbal Confidence & Lack of Structured Trade-off Storytelling',
      category: 'technical_depth',
      description: 'Answering questions technically without articulating "Why this tool?" vs alternative approaches weakens senior impressions.',
    }
    next_best_action = 'Conduct 3 live timed mock technical interviews focusing on system design trade-offs and live coding.'
  } else if (phase.id === 4) {
    primary_bottleneck = {
      title: 'Weak Behavioral & Executive Value Alignment in Final Rounds',
      category: 'final_round_closing',
      whyItMatters: 'Reaching final onsite panels confirms your technical competence; losing offers at the finish line means other candidates articulated stronger business value and leadership culture fit.',
      evidence: 'Multiple final round appearances with zero offers indicates closing and differentiation gaps.',
    }
    secondary_problem = {
      title: 'Salary, Work Authorization, or Cultural Fit Friction at Decision Gate',
      category: 'closing_strategy',
      description: 'Final round hiring managers evaluate cross-functional collaboration and long-term commitment.',
    }
    next_best_action = 'Frame strategic closing answers for "Why this company?" and send high-touch thank-you follow-ups within 6 hours.'
  } else if (phase.id === 5) {
    primary_bottleneck = {
      title: 'Background Verification, Documentation Delays, or Onboarding Friction',
      category: 'offer_closing',
      whyItMatters: 'Delays or friction after receiving offers risk formal offer rescissions or extended bench downtime.',
      evidence: ans.DropOffStage || 'Offer received but background checks or contract negotiation created roadblocks.',
    }
    secondary_problem = {
      title: 'Work Authorization & Credential Verification Clarity',
      category: 'work_auth',
      description: 'Ensure all immigration documents and employer references are aligned for immediate E-Verify verification.',
    }
    next_best_action = 'Pre-compile W-2s, references, and official employment verification documents to clear HR checks within 48 hours.'
  }

  // Top 3 Prioritized Actions
  const top_actions = [
    {
      title: phase.id === 6
        ? 'Calibrate Core Resume & Build Daily Rhythm'
        : (phase.id === 1 ? 'Quantify Top 5 Resume Bullets' : (phase.id === 2 ? 'Script 60-Second Recruiter Pitch' : 'Master Live Technical Architecture Walkthrough')),
      category: phase.id === 6 ? 'Asset Preparation' : (phase.id === 1 ? 'Resume Optimization' : (phase.id === 2 ? 'Screening Pitch' : 'Technical Prep')),
      whyItMatters: primary_bottleneck.whyItMatters,
      whatToDo: next_best_action,
      resourceTool: phase.id === 1 || phase.id === 6 ? 'Crafture STAR Bullet Builder' : (phase.id === 2 ? 'Recruiter Scripting Framework' : 'System Design Primer & LeetCode'),
      duration: '3–5 hours',
      successMetric: phase.id === 1 || phase.id === 6 ? '100% of top role bullets include quantified metrics' : 'Scheduled recruiter calls convert at >50%',
      followUp: 'Track response rate over next 10 targeted applications.',
    },
    {
      title: 'Implement 5-to-1 Targeted Outbound System',
      category: 'Networking & Strategy',
      whyItMatters: 'Direct messages to hiring managers bypass portal queues and achieve 4x higher response rates.',
      whatToDo: 'Identify 5 verified hiring managers or alumni weekly at target firms; send personalized 50-word notes before applying.',
      resourceTool: 'LinkedIn Sales Navigator / Apollo & InMail Templates',
      duration: '45 mins / day',
      successMetric: 'At least 2 warm recruiter replies weekly',
      followUp: 'Log referral requests in your weekly tracking spreadsheet.',
    },
    {
      title: 'Synchronize LinkedIn & Resume Brand Authority',
      category: 'Digital Presence',
      whyItMatters: 'Recruiters cross-reference your profile during screening. Inconsistencies or weak headlines create instant doubt.',
      whatToDo: 'Update your LinkedIn headline with target role keywords and add 2 featured case studies demonstrating technical depth.',
      resourceTool: 'Crafture LinkedIn Recruiter Optimizer',
      duration: '2 hours',
      successMetric: 'Profile strength All-Star with target keywords indexed in search',
      followUp: 'Review LinkedIn search appearances after 7 days.',
    },
  ]

  // Guard: If candidate provided a valid LinkedIn URL/profile, NEVER assign Blank LinkedIn bottleneck
  const hasValidLinkedin = Boolean(
    (ans.linkedin && typeof ans.linkedin === 'string' && ans.linkedin.trim().length > 3) ||
    (ans.linkedinUrl && typeof ans.linkedinUrl === 'string' && ans.linkedinUrl.trim().length > 3) ||
    (typeof ans.contact?.linkedin === 'string' && ans.contact.linkedin.trim().length > 3) ||
    linkedinAgent?.dataAvailable === true
  )

  if (hasValidLinkedin && (primary_bottleneck.title.toLowerCase().includes('blank linkedin') || primary_bottleneck.title.toLowerCase().includes('blank profile'))) {
    primary_bottleneck = {
      title: 'Top-of-Page ATS Keyword Alignment & Metric Gaps',
      category: 'ats_readability',
      whyItMatters: 'Recruiters scan applications in under 10 seconds. Missing metrics and generic task bullets cause automated screening drops before humans review.',
      evidence: resumeAgent?.issues?.[0]?.diagnosis || 'Resume bullets lack quantified metrics and Google XYZ achievement structure.',
    }
  }

  return {
    primary_bottleneck,
    secondary_problem,
    strongest_area: strongestArea,
    next_best_action,
    top_actions,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. External Context & SDLC Market Cycle Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export function getExternalContext({ targetRole = '', answers = {}, semanticProfile = null } = {}) {
  const now = new Date()
  const month = now.getMonth() // 0-indexed

  let cycleTitle = 'Core Software & Engineering Wave'
  let cycleDesc = 'Mid-year hiring cycle actively screening for full-stack and cloud product engineering capacity.'
  let priorityRoles = 'Full-Stack, Backend, Distributed Systems'

  if (month >= 0 && month <= 2) {
    cycleTitle = 'Q1 Annual Budget Release & Strategic Expansion'
    cycleDesc = 'Enterprise hiring budgets unlock in January. Product Managers, Technical Leads, and Architecture roles see immediate opening surges.'
    priorityRoles = 'Engineering Leadership, Architecture, PM/PO'
  } else if (month >= 3 && month <= 5) {
    cycleTitle = 'Q2 Engineering Execution & Insights Wave'
    cycleDesc = 'Mid-spring hiring targets Core Software, Data Analytics, and AI/ML engineers to support product feature roadmap execution.'
    priorityRoles = 'Full Stack, Cloud, Data Engineering, AI/ML'
  } else if (month >= 6 && month <= 8) {
    cycleTitle = 'Q3 Mid-Year Testing & Infrastructure Optimization'
    cycleDesc = 'Summer hiring emphasizes QA/SDET, Platform Reliability (SRE), and Cloud Security to harden infrastructure before Q4 code freezes.'
    priorityRoles = 'DevOps, SRE, QA Automation, Security'
  } else {
    cycleTitle = 'Q4 Year-End Sprint & Advance Referral Seeding'
    cycleDesc = 'Formal corporate offers slow in late November. Elite candidates use this window to cultivate warm referrals and prep interviews for January budget release.'
    priorityRoles = 'Referral Pipeline, Contract/Burst Staffing'
  }

  // Recruiter Priority Funnel position based on candidate's primary sourcing method
  const methods = Array.isArray(answers.searchMethods) ? answers.searchMethods : [String(answers.searchMethods || '')]
  let funnelTier = 'Tier 5: Public Job Boards & Easy Apply'
  let funnelAdvise = 'Lowest recruiter conversion channel. Pivot at least 50% of your weekly volume to Tier 2 (Employee Referrals) and Tier 3 (Direct Company ATS).'

  if (methods.some((m) => /Referral/i.test(m))) {
    funnelTier = 'Tier 2: Employee Referrals & Warm Introductions'
    funnelAdvise = 'Highest conversion channel. Prioritize warm coffee chats and alumni introductions.'
  } else if (methods.some((m) => /Career Pages|Direct ATS/i.test(m))) {
    funnelTier = 'Tier 3: Direct Career Page ATS Submissions'
    funnelAdvise = 'Strong direct enterprise channel. Ensure single-column ATS formatted resumes with high keyword density.'
  } else if (methods.some((m) => /Recruiter|Hiring Manager Outreach/i.test(m))) {
    funnelTier = 'Tier 2: Direct Outreach to Talent Partners'
    funnelAdvise = 'High leverage. Focus notes on recent company engineering initiatives.'
  }

  // Constraints note (Never penalizing GPS score!)
  const rawVisa = String(answers.visa || semanticProfile?.visa?.rawAnswer || '').trim()
  let constraintsNote = 'Unrestricted market mobility across enterprise and federal sectors.'
  if (/CPT|OPT|H-?1B/i.test(rawVisa)) {
    constraintsNote = `Candidate has ${rawVisa || 'visa sponsorship'} requirements. Focus outbound pipeline on verified E-Verify tech employers without lowering GPS execution standards.`
  }

  // Consultancy & External Support Tracking (never penalizing score!)
  const rawHelp = String(answers.externalHelp || semanticProfile?.externalHelp?.rawAnswer || '').trim()
  let consultancyContext = {
    mode: 'Solo Search',
    description: '100% self-directed job hunt. You own full compensation negotiation and direct employer relationships.',
    recommendation: 'Prioritize internal employee referrals and direct career page submissions to maximize callback rates without middleman fee deductions.',
  }
  if (/C2C|Bench/i.test(rawHelp)) {
    consultancyContext = {
      mode: 'C2C Consultancy / Bench Marketing',
      description: 'Working with a consulting firm or vendor marketing your profile on corp-to-corp contracts.',
      recommendation: 'Ensure your verified resume aligns with vendor marketing claims and protect billable hourly rate margins with direct Tier-1 client visibility.',
    }
  } else if (/Staffing|Agency/i.test(rawHelp)) {
    consultancyContext = {
      mode: 'W2 Staffing / Placement Agency',
      description: 'Partnering with placement agencies on contract or direct-hire openings.',
      recommendation: 'Establish weekly touchpoints with account recruiters for exclusive job orders before they hit public boards.',
    }
  } else if (/Coach|Resume Writer|Prep/i.test(rawHelp)) {
    consultancyContext = {
      mode: 'External Coaching / Interview Prep',
      description: 'Using career mentoring or specialized interview preparation services.',
      recommendation: 'Translate mock interview learnings into live screening pitches with structured STAR storytelling.',
    }
  }

  return {
    sdlc_market_cycle: {
      title: cycleTitle,
      description: cycleDesc,
      priorityRoles,
      currentQuarter: `Q${Math.floor(month / 3) + 1}`,
    },
    recruiter_priority_funnel: {
      currentTier: funnelTier,
      recommendation: funnelAdvise,
      hierarchy: [
        '1. Internal Promotions & Team Moves',
        '2. Employee Referrals & Warm Introductions (Best external channel)',
        '3. Direct Career Page ATS Submissions',
        '4. Exclusive Staffing Agency Vendors',
        '5. Public Job Boards & LinkedIn Easy Apply (Lowest conversion)',
        '6. Sub-Contracting Bench Lists',
      ],
    },
    constraints_note: constraintsNote,
    consultancy_context: consultancyContext,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Full Assessment Persona & Directives (Preserves V1 compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateAssessmentPersona({
  answers = {},
  semanticProfile = {},
  resumeContext = {},
  resumeAgent = null,
  linkedinAgent = null,
} = {}) {
  const ans = { ...answers }

  // 1. Compute 100-Point Weighted Scoring Rubric
  const scores = computeCareerGpsScore({
    answers: ans,
    resumeAgent,
    linkedinAgent,
    semanticProfile,
  })

  // 2. Detect 5-Phase Hiring Stage & Confidence
  const phase = detectHiringPhase({
    answers: ans,
    resumeAgent,
    linkedinAgent,
  })

  // 3. Synthesize Root Cause & Prioritized Actions
  const rootCauses = synthesizeRootCauseAndActions({
    phase,
    scores,
    answers: ans,
    resumeAgent,
    linkedinAgent,
  })

  // 4. External SDLC Market Cycle Context
  const targetRole = resumeContext?.targetRole || ans.targetRole || 'Software Professional'
  const externalContext = getExternalContext({
    targetRole,
    answers: ans,
    semanticProfile,
  })

  // 5. Preserved Persona & Directives
  const rawVisa = String(ans.visa || semanticProfile?.visa?.rawAnswer || '').trim()
  let visaCategory = 'Other'
  let requiresSponsorship = true
  let isStudentOrOpt = false
  let urgencyNote = 'Candidate requires clarity on US work authorization pathways.'

  if (/CPT/i.test(rawVisa)) {
    visaCategory = 'CPT'
    isStudentOrOpt = true
    requiresSponsorship = true
    urgencyNote = 'F-1 Student CPT status.'
  } else if (/OPT/i.test(rawVisa)) {
    visaCategory = /STEM/i.test(rawVisa) ? 'STEM OPT' : 'Initial OPT'
    isStudentOrOpt = true
    requiresSponsorship = true
    urgencyNote = 'OPT runway requires E-Verify verified employer sponsors.'
  } else if (/H-?1B/i.test(rawVisa)) {
    visaCategory = 'H-1B'
    requiresSponsorship = true
    urgencyNote = 'Looking for clean H-1B transfer petition.'
  } else if (/Green Card|GC|Citizen|USC/i.test(rawVisa)) {
    visaCategory = /Citizen|USC/i.test(rawVisa) ? 'U.S. Citizen' : 'Green Card'
    requiresSponsorship = false
    urgencyNote = 'Unrestricted US employment authorization.'
  }

  const rawApps = extractQuantMetric(ans.apps30d ?? ans.appsWeek, 30, 'month')
  const rawOutreach = extractQuantMetric(ans.outreach, 5, 'week')
  const rawScreens = Number(ans.funnel90d?.screens ?? ans.interviews ?? ans.humanScreen ?? 0)

  // Directives for Downstream LLM Agents
  const resumeDirectives = [
    `TARGET ROLE FOCUS: Align bullet achievements directly with ${targetRole}.`,
    `HIRING PHASE DIRECTIVE: Candidate is in Phase ${phase.id} (${phase.name}). ${rootCauses.next_best_action}`,
  ]

  const linkedInDirectives = [
    `ALIGNMENT: Match headline and skills with target role "${targetRole}".`,
    `CONSISTENCY BADGE: Consistency is classified as "${scores.areas.linkedin.consistencyTier.badge}".`,
  ]

  const candidateContextBrief = `Candidate is a ${targetRole} targeting ${ans.opportunityType || 'Full-Time roles'}. Currently in Hiring Phase ${phase.id} (${phase.name}) with confidence: ${phase.confidence}. Primary bottleneck: ${rootCauses.primary_bottleneck.title}. Total Career GPS Score: ${scores.gps_score}/100.`

  return {
    gpsScore: scores.gps_score,
    grade: scores.grade,
    gradeLabel: scores.gradeLabel,
    scores,
    phase,
    rootCauses,
    primary_bottleneck: rootCauses.primary_bottleneck,
    secondary_problem: rootCauses.secondary_problem,
    strongest_area: rootCauses.strongest_area,
    next_best_action: rootCauses.next_best_action,
    top_actions: rootCauses.top_actions,
    external_context: externalContext,

    candidateProfile: {
      targetRole,
      opportunityType: ans.opportunityType || 'Full-Time W2',
      experienceLevel: ans.experience || 'Mid-Level',
      visa: ans.visa || 'Not specified',
    },
    candidatePersona: {
      archetype: phase.shortName,
      summary: phase.stuckDescription,
      confidence: phase.confidence === 'High' ? 0.95 : (phase.confidence === 'Medium' ? 0.75 : 0.55),
    },
    workAuthContext: {
      visa: visaCategory,
      rawVisa,
      requiresSponsorship,
      isStudentOrOpt,
      urgencyNote,
    },
    funnelMetrics: {
      applications_count: rawApps.rawNum,
      outreach_count: rawOutreach.rawNum,
      recruiter_calls_count: rawScreens,
      phaseId: phase.id,
      phaseName: phase.name,
    },
    agentDirectives: {
      forResumeAgent: resumeDirectives.join('\n'),
      forLinkedInAgent: linkedInDirectives.join('\n'),
      forChatbotAgent: candidateContextBrief,
    },
  }
}

export default {
  computeCareerGpsScore,
  detectHiringPhase,
  synthesizeRootCauseAndActions,
  getExternalContext,
  evaluateAssessmentPersona,
  extractQuantMetric,
  HIRING_PHASES,
}
