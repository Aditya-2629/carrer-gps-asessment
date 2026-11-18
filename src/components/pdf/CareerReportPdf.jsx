import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Circle,
  Rect,
  StyleSheet,
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
  grid2: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  col2: {
    flex: 1,
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

export default function CareerReportPdf({ reportData = {} }) {
  // Extract Candidate & Target Role
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

  // 1. Overall & Pillar Scores
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

  // 2. Monthly Funnel Metrics
  const answers = reportData?.user_answers || reportData?.answers || {}
  const funnelStages = reportData?.funnel_stages || {}
  const f90 = answers.funnel90d || {}

  const apps30d = Number(answers.apps30d || answers.applications_count || 0)
  const totalAppsMonthly = apps30d > 0
    ? apps30d
    : Number(funnelStages.applications30d || funnelStages.applications_count || f90.applications90d || 45)

  const screens = Number(funnelStages.recruiterScreens ?? f90.recruiterScreens ?? 4)
  const oas = Number(funnelStages.assessments ?? f90.assessments ?? 2)
  const techs = Number(funnelStages.technicalRounds ?? f90.technicalRounds ?? 1)
  const finals = Number(funnelStages.finalRounds ?? f90.finalRounds ?? 0)
  const offers = Number(funnelStages.offers ?? f90.offers ?? 0)

  const screenRate = totalAppsMonthly > 0 ? ((screens / totalAppsMonthly) * 100).toFixed(1) : '0.0'
  const techPassRate = screens > 0 ? ((techs / screens) * 100).toFixed(1) : '0.0'
  const finalPassRate = techs > 0 ? ((finals / techs) * 100).toFixed(1) : '0.0'
  const offerRate = finals > 0 ? ((offers / finals) * 100).toFixed(1) : '0.0'

  // Primary Bottleneck
  const phase = reportData?.phase || {
    shortName: 'Top of Funnel',
    name: 'Application → Screening Velocity',
    metricGoal: 'Achieve >5% application-to-screen conversion.',
  }
  const bottleneck = reportData?.primary_bottleneck || {
    title: reportData?.critical_issues?.[0]?.title || 'Application Filtering & Low Screen Velocity',
    whyItMatters: 'Recruiters scan resumes in under 10 seconds. Missing target keywords and unquantified achievements cause early ATS drop-off.',
    evidence: 'High application volume yielding below-benchmark recruiter callbacks.',
  }

  // 3. Dynamic Action Plan (7-Day & 30/60/90)
  const actionPlan = reportData?.dynamic_action_plan || {}
  const sevenDayTasks = Array.isArray(actionPlan.sevenDayQuickPlan) && actionPlan.sevenDayQuickPlan.length > 0
    ? actionPlan.sevenDayQuickPlan.slice(0, 7)
    : [
        { day: 1, title: 'Keyword & Competency Alignment', action: 'Audit resume against top 10 target job descriptions to identify missing technical keywords.', deliverable: '10-JD Keyword Matrix', metricTarget: 'Add 5+ verified keywords' },
        { day: 2, title: 'Google XYZ Bullet Overhaul', action: 'Restructure top 4 achievement bullets to format: Accomplished [X] measured by [Y] by doing [Z].', deliverable: '4 Restructured bullets', metricTarget: '100% bullets with metrics' },
        { day: 3, title: 'Single-Column ATS Calibration', action: 'Reformat document to single-column layout without tables or multi-column grids for parsing safety.', deliverable: 'ATS-Compliant Document', metricTarget: '100% clean plain-text parse' },
        { day: 4, title: 'LinkedIn Headline & About Rewrite', action: 'Deploy 15-20 word hook-first headline and 4-pillar narrative about section.', deliverable: 'Updated LinkedIn profile', metricTarget: '3x profile view velocity' },
        { day: 5, title: 'Recruiter Outreach Sourcing List', action: 'Build list of 25 engineering managers and recruiters at target high-growth companies.', deliverable: '25-Lead Outbound Tracker', metricTarget: 'Send 10 personalized notes' },
        { day: 6, title: 'Technical Defense Blueprint', action: 'Document architecture, data models, and latency trade-offs for your flagship project.', deliverable: '1-Page Project Blueprint', metricTarget: 'Ready for 3-minute pitch' },
        { day: 7, title: 'Weekly Funnel Audit & Calibration', action: 'Review callback conversions and adjust application targeting strategy.', deliverable: 'Funnel Progress Log', metricTarget: 'Callback rate > 5%' },
      ]

  const milestonePathway = Array.isArray(actionPlan.pathway30_60_90) && actionPlan.pathway30_60_90.length > 0
    ? actionPlan.pathway30_60_90.slice(0, 3)
    : [
        { period: '30 Days', stage: 'Asset Calibration & Outbound Engine', goal: `Overcome ATS drop-offs and generate consistent recruiter screen calls for ${targetRole}.`, deliverable: 'ATS Resume + 30 Target Account Tracker', successSignal: 'Callback rate >= 5%' },
        { period: '60 Days', stage: 'Screening Mastery & Technical Loops', goal: 'Convert recruiter screens into technical rounds and advance through panel assessments.', deliverable: '3+ Concurrent Technical Interview Loops', successSignal: 'Screen-to-tech conversion >= 40%' },
        { period: '90 Days', stage: 'Final Rounds, Offers & Negotiation', goal: 'Advance through onsite interview loops and secure a competitive, written job offer.', deliverable: 'Signed competitive offer letter', successSignal: 'Offer-to-joining acceptance' },
      ]

  // 4. Resume Deep Diagnosis Data
  const resumeAgent = reportData?.resume_agent || {}
  const resumeDashboard = resumeAgent.dashboard || {}
  const resumeSectionAudit = resumeAgent.sectionAudit || resumeDashboard.sectionAudit || {
    summary: { score10: 7, status: 'warn', hurtingReason: 'Generic summary lacking target role keyword anchoring and hard proof metrics.', requiredImprovement: 'Open with exact target title and 3 core technical specializations.' },
    experience: { score10: 6, status: 'warn', hurtingReason: 'Bullets focus on passive responsibilities rather than quantified outcomes.', requiredImprovement: 'Quantify impact using Accomplished [X] measured by [Y] by doing [Z].' },
    skills: { score10: 8, status: 'pass', hurtingReason: null, requiredImprovement: 'Group technical tools into categoric clusters (Languages, Cloud, Data).' },
    layout: { score10: 9, status: 'pass', hurtingReason: null, requiredImprovement: 'Maintain clean single-column structure with standard ATS section headings.' },
  }

  const bulletRewrites = Array.isArray(resumeAgent.bulletRewrites || resumeAgent.bulletSuggestions || resumeDashboard.bulletAudit)
    ? (resumeAgent.bulletRewrites || resumeAgent.bulletSuggestions || resumeDashboard.bulletAudit)
        .filter((b) => b.rewritten || b.suggestedRewrite)
        .slice(0, 4)
    : [
        {
          original: 'Responsible for maintaining backend APIs and fixing bugs across our platform.',
          rewritten: 'Architected and deployed 12 RESTful microservices in Node.js & PostgreSQL, reducing p99 API latency by 34% across 250k daily active users.',
          why: 'Replaces passive maintenance duties with verified ownership, architecture scale, and latency impact.',
        },
        {
          original: 'Worked with the data team to build dashboards in SQL and Tableau for reporting.',
          rewritten: 'Engineered automated ETL pipelines and 6 star-schema Tableau dashboards, accelerating executive reporting turnaround from 3 days to under 2 hours.',
          why: 'Replaces generic collaboration with quantified pipeline speed and operational turnaround efficiency.',
        },
      ]

  // 5. LinkedIn Studio Data
  const linkedinAgent = reportData?.linkedin_agent || {}
  const linkedinAudit = linkedinAgent.sectionAudit || {
    headline: { score10: 6, status: 'warn', hurtingReason: 'Title-only headline without curiosity hook, business outcome, or proof metrics.', requiredImprovement: 'Deploy 15-20 word headline with proof hook + 3 recruiter keywords.' },
    about: { score10: 6, status: 'warn', hurtingReason: 'Reads like a dense resume repeat rather than an executive career story.', requiredImprovement: 'Structure into 4 parts: Hook, Audience & Problem, Approach & Skills, Call to Action.' },
    skills: { score10: 8, status: 'pass', hurtingReason: null, requiredImprovement: 'Pin top 3 core skills matching recruiter search algorithms.' },
    photoAndBanner: { score10: 5, status: 'warn', hurtingReason: 'Default banner misses high-value visual positioning real estate.', requiredImprovement: 'Deploy custom branded banner with value proposition and core tech stack.' },
  }

  const linkedinHeadlines = Array.isArray(linkedinAgent.optimizations?.headlines) && linkedinAgent.optimizations.headlines.length > 0
    ? linkedinAgent.optimizations.headlines.slice(0, 3)
    : [
        { headline: `${targetRole} | Scaling High-Availability Cloud Backends & Distributed APIs | AWS & Node.js`, formula: 'Proof & Milestone First', whyItWorks: 'Anchors on concrete production scale and recruiter-indexed technical keywords.' },
        { headline: `Helping Engineering Teams Eliminate Latency & Scale Microservices | ${targetRole} | Cloud & APIs`, formula: 'Problem Solver', whyItWorks: 'Communicates clear business value to hiring managers within the first 8 words.' },
        { headline: `Specialist in Distributed Systems, High-Concurrency APIs & Fault-Tolerant Cloud Architecture`, formula: 'Specialist Authority', whyItWorks: 'Maximizes recruiter keyword discovery for senior engineering roles.' },
      ]

  const aboutRewrite = linkedinAgent.optimizations?.aboutRewrite || {
    hook: `Over the past years as a ${targetRole}, I have focused on solving high-concurrency challenges, modernizing legacy systems, and delivering low-latency software.`,
    audienceAndProblem: 'I partner with cross-functional engineering teams and product leaders looking to sustain reliable releases and eliminate architectural bottlenecks.',
    approachAndSkills: 'My approach pairs clean system design with automated test suites and continuous delivery, focusing on maintainable solutions that scale.',
    callToAction: `If you are scaling high-impact engineering initiatives or looking for a ${targetRole}, let's connect!`,
  }

  // Circular gauge circumference calculation (r = 24)
  const radius = 24
  const circumference = 2 * Math.PI * radius // ~150.8
  const strokeDash = (overallScore / 100) * circumference

  return (
    <Document
      title={`Career GPS Report - ${candidateName}`}
      author="Crafture Career GPS"
      subject="Candidate Career Diagnostic Report"
      keywords="Career GPS, ATS Audit, Resume Analysis, LinkedIn Studio"
    >
      {/* ─────────────────────────────────────────────────────────────
          PAGE 1: EXECUTIVE OVERVIEW & CAREER HEALTH DIAGNOSTIC
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        {/* Fixed Running Header */}
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        {/* Hero Banner with SVG Gauge */}
        <View style={styles.heroBanner} wrap={false}>
          <View style={{ flex: 1, paddingRight: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#818CF8', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                CONFIDENTIAL CANDIDATE REPORT
              </Text>
              <Text style={{ fontSize: 7, color: '#94A3B8' }}>•</Text>
              <Text style={{ fontSize: 8, color: '#CBD5E1' }}>{targetRole}</Text>
            </View>
            <Text style={styles.heroTitle}>{candidateName}</Text>
            <Text style={styles.heroSubtitle}>
              Target Role: <Text style={{ color: '#FFFFFF', fontFamily: 'Helvetica-Bold' }}>{targetRole}</Text> • Generated on {reportDate}
            </Text>
          </View>

          {/* Vector SVG Circular Gauge */}
          <View style={styles.scoreBadgeContainer}>
            <Svg width="60" height="60" viewBox="0 0 60 60">
              <Circle
                cx="30"
                cy="30"
                r={radius}
                stroke="#334155"
                strokeWidth="5"
                fill="none"
              />
              <Circle
                cx="30"
                cy="30"
                r={radius}
                stroke="#6366F1"
                strokeWidth="5"
                fill="none"
                strokeDasharray={`${strokeDash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 30 30)"
              />
            </Svg>
            <Text style={styles.gaugeScoreText}>{overallScore}</Text>
            <Text style={styles.gaugeSubText}>/ 100</Text>
          </View>
        </View>

        {/* 4 Pillar Breakdown */}
        <View style={styles.grid4} wrap={false}>
          <View style={styles.col4}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Resume</Text>
              <Text style={styles.kpiVal}>{pResume}<Text style={{ fontSize: 8, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiSub}>ATS & Impact</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>LinkedIn</Text>
              <Text style={styles.kpiVal}>{pLinkedin}<Text style={{ fontSize: 8, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiSub}>Recruiter SEO</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Outbound</Text>
              <Text style={styles.kpiVal}>{pOutbound}<Text style={{ fontSize: 8, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiSub}>Funnel Velocity</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Interview</Text>
              <Text style={styles.kpiVal}>{pInterview}<Text style={{ fontSize: 8, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiSub}>Technical Loop</Text>
            </View>
          </View>
        </View>

        {/* Primary Bottleneck Diagnosis */}
        <View style={styles.cardHighlighted} wrap={false}>
          <View style={[styles.rowBetween, { marginBottom: 4 }]}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              PRIMARY CAREER BOTTLENECK • {safeStr(phase.shortName, 'Top of Funnel')}
            </Text>
            <Text style={styles.tagCritical}>ACTION REQUIRED</Text>
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 3 }}>
            {safeStr(bottleneck.title, 'Top-of-Funnel Conversion Friction')}
          </Text>
          <Text style={{ fontSize: 8.5, color: '#475569', marginBottom: 4 }}>
            {safeStr(bottleneck.whyItMatters, 'Missing target keywords and unquantified achievements cause automated filtering.')}
          </Text>
          <View style={{ backgroundColor: '#FFFFFF', padding: 6, borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6366F1', marginBottom: 1 }}>
              PRIMARY RECOVERY TARGET:
            </Text>
            <Text style={{ fontSize: 8, color: '#1E293B' }}>
              {safeStr(phase.metricGoal, 'Achieve >5% application-to-screen conversion within 14 days.')}
            </Text>
          </View>
        </View>

        {/* Monthly Funnel & Conversion Velocity */}
        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>Monthly Funnel Outcomes & Conversion Velocity</Text>
          <Text style={styles.sectionTag}>STAGE METRICS</Text>
        </View>

        {/* Horizontal Stage Progression Bars */}
        <View style={styles.card} wrap={false}>
          <View style={[styles.rowBetween, { marginBottom: 6 }]}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
              Monthly Application Pipeline: {formatNum(totalAppsMonthly)} Sent
            </Text>
            <Text style={{ fontSize: 8, color: '#64748B' }}>
              Screen Rate: <Text style={{ fontFamily: 'Helvetica-Bold', color: Number(screenRate) < 5 ? '#DC2626' : '#16A34A' }}>{screenRate}%</Text> (Target: ≥ 5.0%)
            </Text>
          </View>

          {/* Stage KPIs Row */}
          <View style={styles.grid4}>
            <View style={styles.col4}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Applications</Text>
                <Text style={styles.kpiVal}>{formatNum(totalAppsMonthly)}</Text>
                <Text style={styles.kpiSub}>sent / month</Text>
              </View>
            </View>
            <View style={styles.col4}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Screens</Text>
                <Text style={styles.kpiVal}>{formatNum(screens)}</Text>
                <Text style={styles.kpiSub}>{screenRate}% callback</Text>
              </View>
            </View>
            <View style={styles.col4}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Tech Rounds</Text>
                <Text style={styles.kpiVal}>{formatNum(techs)}</Text>
                <Text style={styles.kpiSub}>{techPassRate}% pass</Text>
              </View>
            </View>
            <View style={styles.col4}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Offers</Text>
                <Text style={styles.kpiVal}>{formatNum(offers)}</Text>
                <Text style={styles.kpiSub}>{offerRate}% final conv</Text>
              </View>
            </View>
          </View>

          {/* Benchmark Comparison Micro-Bars */}
          <View style={{ marginTop: 4 }}>
            <View style={[styles.rowBetween, { marginBottom: 1 }]}>
              <Text style={{ fontSize: 7.5, color: '#475569' }}>Application to Screen Callback (Actual vs 5.0% Benchmark)</Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: Number(screenRate) < 5 ? '#DC2626' : '#16A34A' }}>
                {screenRate}% {Number(screenRate) < 5 ? '(BELOW)' : '(HEALTHY)'}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={{ width: `${Math.min(100, (Number(screenRate) / 10) * 100)}%`, height: 6, backgroundColor: Number(screenRate) < 5 ? '#DC2626' : '#16A34A', borderRadius: 3 }} />
            </View>
          </View>
        </View>

        {/* Fixed Running Footer */}
        <View fixed style={styles.footer}>
          <Text style={styles.footerLeft}>Crafture Career GPS • Confidential Diagnostic Report</Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* ─────────────────────────────────────────────────────────────
          PAGE 2: DYNAMIC ACTION PLAN (7-DAY + 30/60/90 PATHWAY)
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        {/* Fixed Running Header */}
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>7-Day Rapid Triage Action Plan</Text>
          <Text style={styles.sectionTag}>EXECUTION CHECKLIST</Text>
        </View>

        {/* 7-Day Quick Plan Grid */}
        <View style={{ marginBottom: 10 }}>
          {sevenDayTasks.map((t, idx) => (
            <View key={idx} style={styles.card} wrap={false}>
              <View style={[styles.rowBetween, { marginBottom: 2 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2 }}>
                    DAY {t.day || idx + 1}
                  </Text>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                    {safeStr(t.title)}
                  </Text>
                </View>
                {t.metricTarget && (
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#16A34A', backgroundColor: '#DCFCE7', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                    {safeStr(t.metricTarget)}
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>
                {safeStr(t.action)}
              </Text>
              {t.deliverable && (
                <Text style={{ fontSize: 7, color: '#64748B' }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: '#475569' }}>Deliverable: </Text>
                  {safeStr(t.deliverable)}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>30 / 60 / 90 Day Milestone Pathway</Text>
          <Text style={styles.sectionTag}>STRATEGIC ROADMAP</Text>
        </View>

        {/* 30/60/90 Pathway Row */}
        <View style={styles.grid3} wrap={false}>
          {milestonePathway.map((p, idx) => (
            <View key={idx} style={styles.col3}>
              <View style={[styles.card, { height: '100%' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                    {safeStr(p.period)}
                  </Text>
                  <Text style={{ fontSize: 7, color: '#94A3B8' }}>Phase 0{idx + 1}</Text>
                </View>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 3 }}>
                  {safeStr(p.stage)}
                </Text>
                <Text style={{ fontSize: 7.5, color: '#475569', marginBottom: 4 }}>
                  {safeStr(p.goal)}
                </Text>
                <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 3, marginTop: 'auto' }}>
                  <Text style={{ fontSize: 7, color: '#64748B' }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>Target: </Text>
                    {safeStr(p.successSignal || p.deliverable)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Fixed Running Footer */}
        <View fixed style={styles.footer}>
          <Text style={styles.footerLeft}>Crafture Career GPS • Confidential Diagnostic Report</Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* ─────────────────────────────────────────────────────────────
          PAGE 3: RESUME DEEP DIAGNOSIS & BULLET REWRITES
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        {/* Fixed Running Header */}
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>Resume Deep Diagnosis & ATS Audit</Text>
          <Text style={styles.sectionTag}>SECTION-BY-SECTION /10</Text>
        </View>

        {/* Section Audit Table */}
        <View style={styles.card} wrap={false}>
          <View style={{ marginBottom: 4 }}>
            {Object.entries(resumeSectionAudit).map(([secKey, secVal]) => {
              const score = secVal?.score10 ?? 7
              const isCrit = score < 6
              const isWarn = score >= 6 && score < 8
              return (
                <View key={secKey} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 4 }}>
                  <View style={styles.rowBetween}>
                    <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', textTransform: 'capitalize' }}>
                      {secKey.replace(/([A-Z])/g, ' $1')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: isCrit ? '#DC2626' : isWarn ? '#D97706' : '#16A34A' }}>
                        {score}/10
                      </Text>
                      <Text style={isCrit ? styles.tagCritical : isWarn ? styles.tagWarn : styles.tagPass}>
                        {isCrit ? 'FIX REQUIRED' : isWarn ? 'NEEDS POLISH' : 'PASS'}
                      </Text>
                    </View>
                  </View>
                  {secVal?.hurtingReason && (
                    <Text style={{ fontSize: 7.5, color: '#DC2626', marginTop: 1 }}>
                      <Text style={{ fontFamily: 'Helvetica-Bold' }}>Issue: </Text>
                      {secVal.hurtingReason}
                    </Text>
                  )}
                  {secVal?.requiredImprovement && (
                    <Text style={{ fontSize: 7.5, color: '#475569', marginTop: 1 }}>
                      <Text style={{ fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>Fix: </Text>
                      {secVal.requiredImprovement}
                    </Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        {/* High-Impact Bullet Rewrites */}
        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>Quantified High-Impact Bullet Rewrites</Text>
          <Text style={styles.sectionTag}>GOOGLE XYZ SYNTAX</Text>
        </View>

        {bulletRewrites.map((b, idx) => (
          <View key={idx} style={styles.diffBlock} wrap={false}>
            <View style={[styles.rowBetween, { marginBottom: 3 }]}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                Bullet Rewrite #{idx + 1}
              </Text>
              <Text style={styles.tagNeutral}>ATS OPTIMIZED</Text>
            </View>

            {/* Original Bullet */}
            <View style={styles.diffOriginal}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#DC2626', marginBottom: 1 }}>
                BEFORE (ORIGINAL WEAK / TASK-BASED):
              </Text>
              <Text style={styles.monoText}>{safeStr(b.original || b.bullet)}</Text>
            </View>

            {/* Rewritten Bullet */}
            <View style={styles.diffRewritten}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#16A34A', marginBottom: 1 }}>
                AFTER (MEASURABLE IMPACT & OUTCOME):
              </Text>
              <Text style={styles.monoText}>{safeStr(b.rewritten || b.suggestedRewrite)}</Text>
            </View>

            {b.why && (
              <Text style={{ fontSize: 7, color: '#64748B', marginTop: 2 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: '#475569' }}>Why it works: </Text>
                {safeStr(b.why)}
              </Text>
            )}
          </View>
        ))}

        {/* Fixed Running Footer */}
        <View fixed style={styles.footer}>
          <Text style={styles.footerLeft}>Crafture Career GPS • Confidential Diagnostic Report</Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* ─────────────────────────────────────────────────────────────
          PAGE 4: LINKEDIN STUDIO & RECRUITER SEO AUDIT
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        {/* Fixed Running Header */}
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>LinkedIn Studio & Recruiter Search SEO</Text>
          <Text style={styles.sectionTag}>PROFILE AUDIT</Text>
        </View>

        {/* Section-by-Section /10 Audit */}
        <View style={styles.card} wrap={false}>
          {Object.entries(linkedinAudit).map(([secKey, secVal]) => {
            const score = secVal?.score10 ?? 7
            const isCrit = score < 6
            const isWarn = score >= 6 && score < 8
            return (
              <View key={secKey} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 3 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A', textTransform: 'capitalize' }}>
                    {secKey.replace(/([A-Z])/g, ' $1')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: isCrit ? '#DC2626' : isWarn ? '#D97706' : '#16A34A' }}>
                      {score}/10
                    </Text>
                    <Text style={isCrit ? styles.tagCritical : isWarn ? styles.tagWarn : styles.tagPass}>
                      {isCrit ? 'FIX' : isWarn ? 'POLISH' : 'PASS'}
                    </Text>
                  </View>
                </View>
                {secVal?.hurtingReason && (
                  <Text style={{ fontSize: 7, color: '#DC2626', marginTop: 1 }}>
                    {secVal.hurtingReason}
                  </Text>
                )}
              </View>
            )
          })}
        </View>

        {/* Top 3 AI Recruiter Headlines */}
        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>Recruiter-Searchable Headline Options (15–20 Words)</Text>
          <Text style={styles.sectionTag}>SEARCH INDEXED</Text>
        </View>

        {linkedinHeadlines.map((h, idx) => (
          <View key={idx} style={styles.card} wrap={false}>
            <View style={[styles.rowBetween, { marginBottom: 2 }]}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                Option 0{idx + 1} • {safeStr(h.formula || h.style || 'High-Impact')}
              </Text>
              <Text style={styles.tagNeutral}>15–20 WORDS</Text>
            </View>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
              {safeStr(h.headline)}
            </Text>
            {h.whyItWorks && (
              <Text style={{ fontSize: 7, color: '#64748B' }}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Why it works: </Text>
                {safeStr(h.whyItWorks)}
              </Text>
            )}
          </View>
        ))}

        {/* 4-Part Video Copywriting About Rewrite */}
        <View style={styles.card} wrap={false}>
          <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 4 }}>
            LinkedIn About Rewrite (4-Part Video Copywriting Architecture)
          </Text>
          <View style={{ gap: 4 }}>
            <View style={{ backgroundColor: '#FFFFFF', padding: 5, borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>1. HOOK & PROOF</Text>
              <Text style={{ fontSize: 7.5, color: '#334155', marginTop: 1 }}>{safeStr(aboutRewrite.hook)}</Text>
            </View>
            <View style={{ backgroundColor: '#FFFFFF', padding: 5, borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>2. AUDIENCE & PROBLEM</Text>
              <Text style={{ fontSize: 7.5, color: '#334155', marginTop: 1 }}>{safeStr(aboutRewrite.audienceAndProblem)}</Text>
            </View>
            <View style={{ backgroundColor: '#FFFFFF', padding: 5, borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>3. METHODOLOGY & SKILLS</Text>
              <Text style={{ fontSize: 7.5, color: '#334155', marginTop: 1 }}>{safeStr(aboutRewrite.approachAndSkills)}</Text>
            </View>
            <View style={{ backgroundColor: '#FFFFFF', padding: 5, borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>4. CALL TO ACTION</Text>
              <Text style={{ fontSize: 7.5, color: '#334155', marginTop: 1 }}>{safeStr(aboutRewrite.callToAction)}</Text>
            </View>
          </View>
        </View>

        {/* Fixed Running Footer */}
        <View fixed style={styles.footer}>
          <Text style={styles.footerLeft}>Crafture Career GPS • Confidential Diagnostic Report</Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
