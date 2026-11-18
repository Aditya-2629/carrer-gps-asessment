import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Circle,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

function safeStr(val, fallback = '') {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') return val.trim() || fallback
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) return val.map((v) => safeStr(v)).filter(Boolean).join(', ') || fallback
  if (typeof val === 'object') {
    return val.title || val.text || val.description || val.action || val.headline || val.name || fallback
  }
  return fallback
}

function formatNum(num) {
  const n = Number(num)
  if (isNaN(n)) return '0'
  return n.toLocaleString('en-US')
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 44,
    paddingHorizontal: 36,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0F172A',
    lineHeight: 1.35,
  },
  header: {
    position: 'absolute',
    top: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6366F1',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerRight: {
    fontSize: 8,
    color: '#64748B',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerLeft: {
    fontSize: 7.5,
    color: '#64748B',
  },
  footerRight: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionTag: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#6366F1',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  cardHighlighted: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    color: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 9,
    color: '#94A3B8',
  },
  scoreBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  gaugeScoreText: {
    position: 'absolute',
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  gaugeSubText: {
    position: 'absolute',
    top: 36,
    fontSize: 7,
    color: '#94A3B8',
    textAlign: 'center',
  },
  grid3: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  col3: {
    flex: 1,
  },
  grid4: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  col4: {
    flex: 1,
  },
  kpiBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 6,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  kpiVal: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  kpiSub: {
    fontSize: 6.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  tagPass: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  tagWarn: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  tagCritical: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  tagNeutral: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  barTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 3,
    marginBottom: 4,
    flexDirection: 'row',
  },
  diffBlock: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  diffOriginal: {
    backgroundColor: '#FFF1F2',
    borderLeftWidth: 3,
    borderLeftColor: '#F43F5E',
    padding: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  diffRewritten: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
    padding: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  monoText: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#1E293B',
    lineHeight: 1.3,
  },
})

export function buildCareerReportDocument(reportData = {}) {
  const candidateName = safeStr(
    reportData?.resume_agent?.candidateSnapshot?.name ||
    reportData?.resume_json?.candidate?.name ||
    reportData?.resume_json?.candidate_name ||
    reportData?.user_answers?.name,
    'Candidate'
  )

  const targetRole = safeStr(
    reportData?.resume_agent?.candidateSnapshot?.targetRole ||
    reportData?.targetRole ||
    reportData?.target_role ||
    reportData?.resume_json?.target_role ||
    reportData?.user_answers?.targetRole,
    'Software Engineer'
  )

  const reportDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const rawScores = reportData?.heroScore || reportData?.career_health_score || {}
  const overallScore = Math.max(0, Math.min(100, Math.round(
    typeof rawScores?.overall === 'number'
      ? rawScores.overall
      : typeof reportData?.score === 'number'
      ? reportData.score
      : 72
  )))

  const pResume = Math.round(reportData?.score_breakdown?.resume?.score ?? 18)
  const pLinkedin = Math.round(reportData?.score_breakdown?.linkedin?.score ?? 17)
  const pOutbound = Math.round(reportData?.score_breakdown?.outbound?.score ?? 14)
  const pInterview = Math.round(reportData?.score_breakdown?.interview?.score ?? 16)

  const answers = reportData?.user_answers || reportData?.answers || {}
  const funnelStages = reportData?.funnel_stages || {}
  const f90 = answers.funnel90d || {}

  const apps30d = Number(answers.apps30d || answers.applications_count || 0)
  const totalAppsMonthly = apps30d > 0
    ? apps30d
    : Number(funnelStages.applications30d || funnelStages.applications_count || f90.applications90d || 45)

  const screens = Number(funnelStages.recruiterScreens ?? f90.recruiterScreens ?? 4)
  const techs = Number(funnelStages.technicalRounds ?? f90.technicalRounds ?? 1)
  const offers = Number(funnelStages.offers ?? f90.offers ?? 0)

  const screenRate = totalAppsMonthly > 0 ? ((screens / totalAppsMonthly) * 100).toFixed(1) : '0.0'
  const techPassRate = screens > 0 ? ((techs / screens) * 100).toFixed(1) : '0.0'
  const offerRate = techs > 0 ? ((offers / techs) * 100).toFixed(1) : '0.0'

  const phase = reportData?.phase || {
    shortName: 'Top of Funnel',
    name: 'Application → Screening Velocity',
    metricGoal: 'Achieve >5% application-to-screen conversion.',
  }
  const bottleneck = reportData?.primary_bottleneck || {
    title: reportData?.critical_issues?.[0]?.title || 'Application Filtering & Low Screen Velocity',
    whyItMatters: 'Recruiters scan resumes in under 10 seconds. Missing target keywords and unquantified achievements cause early ATS drop-off.',
  }

  const radius = 24
  const circumference = 2 * Math.PI * radius
  const strokeDash = (overallScore / 100) * circumference

  const createRunningHeader = () =>
    React.createElement(
      View,
      { fixed: true, style: styles.header },
      React.createElement(Text, { style: styles.headerLeft }, 'Crafture Career GPS • Diagnostic Report'),
      React.createElement(Text, { style: styles.headerRight }, `${candidateName} | ${reportDate}`)
    )

  const createRunningFooter = () =>
    React.createElement(
      View,
      { fixed: true, style: styles.footer },
      React.createElement(Text, { style: styles.footerLeft }, 'Crafture Career GPS • Confidential Diagnostic Report'),
      React.createElement(Text, {
        style: styles.footerRight,
        render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`,
      })
    )

  // Page 1: Executive Overview & Monthly Funnel
  const page1 = React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    createRunningHeader(),
    React.createElement(
      View,
      { style: styles.heroBanner, wrap: false },
      React.createElement(
        View,
        { style: { flex: 1, paddingRight: 14 } },
        React.createElement(
          View,
          { style: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 } },
          React.createElement(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#818CF8' } }, 'CONFIDENTIAL CANDIDATE REPORT'),
          React.createElement(Text, { style: { fontSize: 7, color: '#94A3B8' } }, '•'),
          React.createElement(Text, { style: { fontSize: 8, color: '#CBD5E1' } }, targetRole)
        ),
        React.createElement(Text, { style: styles.heroTitle }, candidateName),
        React.createElement(Text, { style: styles.heroSubtitle }, `Target Role: ${targetRole} • Generated on ${reportDate}`)
      ),
      React.createElement(
        View,
        { style: styles.scoreBadgeContainer },
        React.createElement(
          Svg,
          { width: 60, height: 60, viewBox: '0 0 60 60' },
          React.createElement(Circle, { cx: 30, cy: 30, r: radius, stroke: '#334155', strokeWidth: 5, fill: 'none' }),
          React.createElement(Circle, {
            cx: 30,
            cy: 30,
            r: radius,
            stroke: '#6366F1',
            strokeWidth: 5,
            fill: 'none',
            strokeDasharray: `${strokeDash} ${circumference}`,
            strokeLinecap: 'round',
            transform: 'rotate(-90 30 30)',
          })
        ),
        React.createElement(Text, { style: styles.gaugeScoreText }, String(overallScore)),
        React.createElement(Text, { style: styles.gaugeSubText }, '/ 100')
      )
    ),
    React.createElement(
      View,
      { style: styles.grid4, wrap: false },
      React.createElement(
        View,
        { style: styles.col4 },
        React.createElement(
          View,
          { style: styles.kpiBox },
          React.createElement(Text, { style: styles.kpiLabel }, 'Resume'),
          React.createElement(Text, { style: styles.kpiVal }, `${pResume}/25`),
          React.createElement(Text, { style: styles.kpiSub }, 'ATS & Impact')
        )
      ),
      React.createElement(
        View,
        { style: styles.col4 },
        React.createElement(
          View,
          { style: styles.kpiBox },
          React.createElement(Text, { style: styles.kpiLabel }, 'LinkedIn'),
          React.createElement(Text, { style: styles.kpiVal }, `${pLinkedin}/25`),
          React.createElement(Text, { style: styles.kpiSub }, 'Recruiter SEO')
        )
      ),
      React.createElement(
        View,
        { style: styles.col4 },
        React.createElement(
          View,
          { style: styles.kpiBox },
          React.createElement(Text, { style: styles.kpiLabel }, 'Outbound'),
          React.createElement(Text, { style: styles.kpiVal }, `${pOutbound}/25`),
          React.createElement(Text, { style: styles.kpiSub }, 'Funnel Velocity')
        )
      ),
      React.createElement(
        View,
        { style: styles.col4 },
        React.createElement(
          View,
          { style: styles.kpiBox },
          React.createElement(Text, { style: styles.kpiLabel }, 'Interview'),
          React.createElement(Text, { style: styles.kpiVal }, `${pInterview}/25`),
          React.createElement(Text, { style: styles.kpiSub }, 'Technical Loop')
        )
      )
    ),
    React.createElement(
      View,
      { style: styles.cardHighlighted, wrap: false },
      React.createElement(
        View,
        { style: [styles.rowBetween, { marginBottom: 4 }] },
        React.createElement(Text, { style: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#DC2626' } }, `PRIMARY CAREER BOTTLENECK • ${safeStr(phase.shortName)}`),
        React.createElement(Text, { style: styles.tagCritical }, 'ACTION REQUIRED')
      ),
      React.createElement(Text, { style: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 3 } }, safeStr(bottleneck.title)),
      React.createElement(Text, { style: { fontSize: 8.5, color: '#475569', marginBottom: 4 } }, safeStr(bottleneck.whyItMatters)),
      React.createElement(
        View,
        { style: { backgroundColor: '#FFFFFF', padding: 6, borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' } },
        React.createElement(Text, { style: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6366F1' } }, 'PRIMARY RECOVERY TARGET:'),
        React.createElement(Text, { style: { fontSize: 8, color: '#1E293B' } }, safeStr(phase.metricGoal))
      )
    ),
    React.createElement(
      View,
      { style: styles.sectionTitleRow, wrap: false },
      React.createElement(Text, { style: styles.sectionTitle }, 'Monthly Funnel Outcomes & Conversion Velocity'),
      React.createElement(Text, { style: styles.sectionTag }, 'STAGE METRICS')
    ),
    React.createElement(
      View,
      { style: styles.card, wrap: false },
      React.createElement(
        View,
        { style: [styles.rowBetween, { marginBottom: 6 }] },
        React.createElement(Text, { style: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0F172A' } }, `Monthly Application Pipeline: ${formatNum(totalAppsMonthly)} Sent`),
        React.createElement(Text, { style: { fontSize: 8, color: '#64748B' } }, `Screen Rate: ${screenRate}% (Target: ≥ 5.0%)`)
      ),
      React.createElement(
        View,
        { style: styles.grid4 },
        React.createElement(
          View,
          { style: styles.col4 },
          React.createElement(
            View,
            { style: styles.kpiBox },
            React.createElement(Text, { style: styles.kpiLabel }, 'Applications'),
            React.createElement(Text, { style: styles.kpiVal }, formatNum(totalAppsMonthly)),
            React.createElement(Text, { style: styles.kpiSub }, 'sent / month')
          )
        ),
        React.createElement(
          View,
          { style: styles.col4 },
          React.createElement(
            View,
            { style: styles.kpiBox },
            React.createElement(Text, { style: styles.kpiLabel }, 'Screens'),
            React.createElement(Text, { style: styles.kpiVal }, formatNum(screens)),
            React.createElement(Text, { style: styles.kpiSub }, `${screenRate}% callback`)
          )
        ),
        React.createElement(
          View,
          { style: styles.col4 },
          React.createElement(
            View,
            { style: styles.kpiBox },
            React.createElement(Text, { style: styles.kpiLabel }, 'Tech Rounds'),
            React.createElement(Text, { style: styles.kpiVal }, formatNum(techs)),
            React.createElement(Text, { style: styles.kpiSub }, `${techPassRate}% pass`)
          )
        ),
        React.createElement(
          View,
          { style: styles.col4 },
          React.createElement(
            View,
            { style: styles.kpiBox },
            React.createElement(Text, { style: styles.kpiLabel }, 'Offers'),
            React.createElement(Text, { style: styles.kpiVal }, formatNum(offers)),
            React.createElement(Text, { style: styles.kpiSub }, `${offerRate}% conv`)
          )
        )
      )
    ),
    createRunningFooter()
  )

  return React.createElement(
    Document,
    { title: `Career GPS Report - ${candidateName}`, author: 'Crafture Career GPS' },
    page1
  )
}

export async function renderCareerReportPdfBuffer(reportData = {}) {
  const doc = buildCareerReportDocument(reportData)
  return await renderToBuffer(doc)
}

export default renderCareerReportPdfBuffer
