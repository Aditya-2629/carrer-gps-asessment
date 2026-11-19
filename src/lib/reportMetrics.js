/**
 * src/lib/reportMetrics.js
 * Single source of truth for the 6-Axis Career Health Radar and Overall Score
 * across both the Web Cockpit (ReportHero.jsx) and the PDF (CareerReportPdf.jsx).
 */

export function resolveOverallScore(reportData) {
  const rawScores =
    reportData?.heroScore ||
    (typeof reportData?.career_health_score === 'object' && reportData?.career_health_score !== null
      ? reportData.career_health_score
      : null)

  const overall =
    typeof rawScores?.overall === 'number'
      ? rawScores.overall
      : typeof reportData?.career_health_score === 'number'
      ? reportData.career_health_score
      : typeof reportData?.score === 'number'
      ? reportData.score
      : Number(reportData?.score) || 74

  return Math.max(0, Math.min(100, Math.round(overall)))
}

export function getCareerHealthAxes(reportData) {
  const rawScores =
    reportData?.heroScore ||
    (typeof reportData?.career_health_score === 'object' && reportData?.career_health_score !== null
      ? reportData.career_health_score
      : null)

  const grades = reportData?.resume_agent?.dashboard?.grades || {}

  const impactScore = Math.round(grades.impact?.score ?? rawScores?.impactAndMetrics ?? 62)
  const atsScore = Math.round(grades.ats_readability?.score ?? rawScores?.atsCompatibility ?? 88)
  const marketScore = Math.round(rawScores?.marketAlignment ?? 76)
  const positioningScore = Math.round(grades.positioning?.score ?? 68)
  const outreachScore = Math.round(reportData?.scores?.outreach?.score ?? 38)
  const interviewScore = Math.round(reportData?.scores?.interview?.score ?? 48)

  const overall = resolveOverallScore(reportData)

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
