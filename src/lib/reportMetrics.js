/**
 * src/lib/reportMetrics.js
 * Single source of truth for Health Score math (4 pillars /25)
 * and the 6-Axis Career Health Radar across both Web Cockpit and PDF.
 */

/**
 * Resolves the 4 equal-weight pillars (/25 each) and guarantees that
 * overallScore = resume25 + linkedin25 + outbound25 + interview25 (0–100).
 */
export function resolveFourPillars(reportData) {
  const sb = reportData?.score_breakdown || reportData?.gps_scores?.four_pillars || reportData?.four_pillars || {}

  let resume25 = sb?.resume?.points ?? (typeof sb?.resume?.score === 'number' && sb?.resume?.score <= 25 ? sb?.resume?.score : null)
  let linkedin25 = sb?.linkedin?.points ?? (typeof sb?.linkedin?.score === 'number' && sb?.linkedin?.score <= 25 ? sb?.linkedin?.score : null)
  let outbound25 = sb?.outbound?.points ?? sb?.outreach?.points ?? (typeof (sb?.outbound?.score ?? sb?.outreach?.score) === 'number' && (sb?.outbound?.score ?? sb?.outreach?.score) <= 25 ? (sb?.outbound?.score ?? sb?.outreach?.score) : null)
  let interview25 = sb?.interview?.points ?? sb?.interviews?.points ?? (typeof (sb?.interview?.score ?? sb?.interviews?.score) === 'number' && (sb?.interview?.score ?? sb?.interviews?.score) <= 25 ? (sb?.interview?.score ?? sb?.interviews?.score) : null)

  if (resume25 == null) {
    const r100 = reportData?.resume_agent?.dashboard?.score ?? (sb?.resume?.score && sb.resume.score > 25 ? sb.resume.score : null) ?? 72
    resume25 = Math.round((r100 / 100) * 25)
  }
  if (linkedin25 == null) {
    const l100 = reportData?.linkedin_agent?.score ?? (sb?.linkedin?.score && sb.linkedin.score > 25 ? sb.linkedin.score : null) ?? 68
    linkedin25 = Math.round((l100 / 100) * 25)
  }
  if (outbound25 == null) {
    const o100 = reportData?.scores?.outreach?.score ?? (sb?.outreach?.score && sb.outreach.score > 25 ? sb.outreach.score : null) ?? 56
    outbound25 = Math.round((o100 / 100) * 25)
  }
  if (interview25 == null) {
    const i100 = reportData?.scores?.interview?.score ?? (sb?.interviews?.score && sb.interviews.score > 25 ? sb.interviews.score : null) ?? 64
    interview25 = Math.round((i100 / 100) * 25)
  }

  resume25 = Math.max(0, Math.min(25, Math.round(Number(resume25) || 18)))
  linkedin25 = Math.max(0, Math.min(25, Math.round(Number(linkedin25) || 17)))
  outbound25 = Math.max(0, Math.min(25, Math.round(Number(outbound25) || 14)))
  interview25 = Math.max(0, Math.min(25, Math.round(Number(interview25) || 16)))

  const overallScore = Math.max(0, Math.min(100, resume25 + linkedin25 + outbound25 + interview25))

  return {
    resume25,
    linkedin25,
    outbound25,
    interview25,
    overallScore,
  }
}

export function resolveOverallScore(reportData) {
  return resolveFourPillars(reportData).overallScore
}

export function getCareerHealthAxes(reportData) {
  const pillars = resolveFourPillars(reportData)
  const overall = pillars.overallScore

  const grades = reportData?.resume_agent?.dashboard?.grades || {}
  const rawScores =
    reportData?.heroScore ||
    (typeof reportData?.career_health_score === 'object' && reportData?.career_health_score !== null
      ? reportData.career_health_score
      : null)

  const impactScore = Math.round(grades.impact?.score ?? rawScores?.impactAndMetrics ?? Math.round((pillars.resume25 / 25) * 88))
  const atsScore = Math.round(grades.ats_readability?.score ?? rawScores?.atsCompatibility ?? 88)
  const marketScore = Math.round(rawScores?.marketAlignment ?? 76)
  const positioningScore = Math.round(grades.positioning?.score ?? Math.round((pillars.linkedin25 / 25) * 92))
  const outreachScore = Math.round(reportData?.scores?.outreach?.score ?? Math.round((pillars.outbound25 / 25) * 100))
  const interviewScore = Math.round(reportData?.scores?.interview?.score ?? Math.round((pillars.interview25 / 25) * 100))

  const axes = [
    {
      key: 'impact',
      subject: 'Impact Metrics',
      label: 'Impact & Quantification',
      current: impactScore,
      target: Math.min(98, impactScore + 28),
      fullMark: 100,
      desc: 'Quantified CAR achievement density',
    },
    {
      key: 'ats',
      subject: 'ATS Safety',
      label: 'ATS Safety & Readability',
      current: atsScore,
      target: Math.min(100, atsScore + 10),
      fullMark: 100,
      desc: 'Layout, headers & parsing safety',
    },
    {
      key: 'market',
      subject: 'Market Match',
      label: 'Market Keyword Alignment',
      current: marketScore,
      target: Math.min(96, marketScore + 18),
      fullMark: 100,
      desc: 'Core stack & keyword alignment',
    },
    {
      key: 'positioning',
      subject: 'Positioning',
      label: 'Executive Role Positioning',
      current: positioningScore,
      target: Math.min(95, positioningScore + 22),
      fullMark: 100,
      desc: 'Seniority specialization proof',
    },
    {
      key: 'outbound',
      subject: 'Outbound',
      label: 'Outbound & Referral Velocity',
      current: outreachScore,
      target: Math.min(92, outreachScore + 38),
      fullMark: 100,
      desc: 'Recruiter networking velocity',
    },
    {
      key: 'interview',
      subject: 'Interview',
      label: 'Technical & Interview Loop',
      current: interviewScore,
      target: Math.min(95, interviewScore + 32),
      fullMark: 100,
      desc: 'Screen-to-offer pass rate',
    },
  ]

  return {
    axes,
    overallScore: overall,
    impactScore,
    atsScore,
    marketScore,
    positioningScore,
    outreachScore,
    interviewScore,
  }
}

export default getCareerHealthAxes
