import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
  Line,
  Polygon,
  Image,
  Link,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// Import Verified Brand & Scene Assets
import craftureLogo from '../../assets/images/crafture-logo.jpg'
import pdfHeroBanner from '../../assets/images/pdf-hero-banner.jpg'
import pdfCtaBanner from '../../assets/images/pdf-cta-banner.jpg'

// Disable automatic hyphenation across the entire document to avoid awkward "En-gineer" splits
Font.registerHyphenationCallback((word) => [word])

/**
 * Sanitizes Unicode characters that break in standard Helvetica (PDF Type 1 fonts).
 * Replaces non-ASCII symbols with clean ASCII characters (e.g. >= instead of broken "e").
 */
function sanitizeAscii(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .replace(/[≥]/g, '>=')
    .replace(/[≤]/g, '<=')
    .replace(/[→]/g, '->')
    .replace(/[←]/g, '<-')
    .replace(/[↔]/g, '<->')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•▪·]/g, '*')
    .replace(/[…]/g, '...')
}

function safeStr(val, fallback = '') {
  if (val === null || val === undefined) return fallback
  let s = ''
  if (typeof val === 'string') s = val.trim() || fallback
  else if (typeof val === 'number') s = String(val)
  else if (Array.isArray(val)) s = val.map((v) => safeStr(v)).filter(Boolean).join(', ') || fallback
  else if (typeof val === 'object') {
    s = val.title || val.text || val.description || val.action || val.headline || val.name || fallback
  } else {
    s = fallback
  }
  return sanitizeAscii(s)
}

function formatNum(num) {
  const n = Number(num)
  if (isNaN(n)) return '0'
  return n.toLocaleString('en-US')
}

/**
 * Computes polygon points for regular 6-axis radar charts.
 */
function getRadarCoords(cx, cy, R, scores) {
  return scores.map((s, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI / 3)
    const clamped = Math.max(15, Math.min(100, s || 0))
    const r = R * (clamped / 100)
    const x = Math.round((cx + r * Math.cos(angle)) * 10) / 10
    const y = Math.round((cy + r * Math.sin(angle)) * 10) / 10
    return `${x},${y}`
  }).join(' ')
}

/**
 * Seamless Editorial Banner with zero color seam.
 * Layer 1: Full-bleed image (objectFit: 'cover')
 * Layer 2: Soft white fade SVG gradient mask
 * Layer 3: Foreground copy (maxWidth: '55%', padding: 16, gap: 5)
 */
function EditorialBanner({
  imageSrc,
  minHeight = 180,
  gradientId = 'fadeLeft',
  children,
  style = {},
}) {
  return (
    <View
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        minHeight,
        marginBottom: 8,
        ...style,
      }}
      wrap={false}
    >
      {/* Layer 1: Full-Bleed Image */}
      {imageSrc && (
        <Image
          src={imageSrc}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Layer 2: Unslop Soft White Fade Mask */}
      <Svg
        viewBox="0 0 530 190"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="42%" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="64%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="530" height="190" fill={`url(#${gradientId})`} />
      </Svg>

      {/* Layer 3: Foreground Copy with gap: 5 */}
      <View
        style={{
          position: 'relative',
          maxWidth: '55%',
          padding: 16,
          gap: 5,
        }}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#0F172A',
    lineHeight: 1.35,
  },
  header: {
    position: 'absolute',
    top: 18,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#6366F1',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerRight: {
    fontSize: 7.5,
    color: '#64748B',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
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
    marginTop: 8,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionTag: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#6366F1',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 5,
  },
  cardHighlighted: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 4,
    padding: 8,
    marginBottom: 5,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid2: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 5,
  },
  col2: {
    flex: 1,
  },
  grid3: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 5,
  },
  col3: {
    flex: 1,
  },
  grid4: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 5,
  },
  col4: {
    flex: 1,
  },
  kpiTile: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 2,
  },
  kpiTileLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  kpiTileVal: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  kpiTileSub: {
    fontSize: 6.5,
    color: '#94A3B8',
  },
  tagPass: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  tagWarn: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  tagCritical: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  tagNeutral: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  barTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 2.5,
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 2,
    flexDirection: 'row',
  },
  dayCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 6,
    marginBottom: 4,
    flexDirection: 'column',
    gap: 2,
  },
  milestoneCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 7,
    flexDirection: 'column',
    gap: 3,
  },
  bulletBentoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 7,
    marginBottom: 5,
  },
  diffOriginalCard: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderLeftWidth: 3,
    borderLeftColor: '#F43F5E',
    padding: 6,
    borderRadius: 3,
  },
  diffRewrittenCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
    padding: 6,
    borderRadius: 3,
  },
  monoText: {
    fontFamily: 'Courier',
    fontSize: 7.2,
    color: '#1E293B',
    lineHeight: 1.3,
  },
  monoBold: {
    fontFamily: 'Courier-Bold',
    fontSize: 7.2,
    color: '#166534',
    lineHeight: 1.3,
  },
  chipVerified: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  chipSkillsOnly: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  chipMissing: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  aboutPillar: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  aboutPillarLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#6366F1',
    letterSpacing: 0.4,
  },
  aboutPillarText: {
    fontSize: 7.3,
    color: '#334155',
    marginTop: 1,
    lineHeight: 1.3,
  },
})

export default function CareerReportPdf({ reportData = {} }) {
  // Candidate & Target Role Identification
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

  const scoreLabel = overallScore >= 75 ? 'Strong' : overallScore >= 50 ? 'Developing' : 'Emerging'

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
  const techs = Number(funnelStages.technicalRounds ?? f90.technicalRounds ?? 1)
  const finals = Number(funnelStages.finalRounds ?? f90.finalRounds ?? 0)
  const offers = Number(funnelStages.offers ?? f90.offers ?? 0)

  const screenRate = totalAppsMonthly > 0 ? ((screens / totalAppsMonthly) * 100).toFixed(1) : '0.0'
  const techPassRate = screens > 0 ? ((techs / screens) * 100).toFixed(1) : '0.0'
  const finalPassRate = techs > 0 ? ((finals / techs) * 100).toFixed(1) : '0.0'
  const offerRate = finals > 0 ? ((offers / finals) * 100).toFixed(1) : '0.0'

  // Primary Bottleneck & Phase Identification
  const phase = reportData?.phase || {
    shortName: 'Top of Funnel',
    name: 'Application -> Screening Velocity',
    metricGoal: 'Achieve >= 5.0% application-to-screen conversion.',
  }
  const bottleneck = reportData?.primary_bottleneck || {
    title: reportData?.critical_issues?.[0]?.title || 'Application Filtering & Low Screen Velocity',
    whyItMatters: 'Recruiters scan resumes in under 10 seconds. Missing target keywords and unquantified achievements cause automated ATS drop-off.',
    evidence: 'High application volume yielding below-benchmark recruiter callbacks.',
  }

  // Active Phase for 6-Phase Hiring Journey (1 to 6)
  const currentPhaseId = Number(reportData?.current_phase_id || (Number(screenRate) < 5 ? 2 : Number(techPassRate) < 40 ? 3 : offers === 0 ? 5 : 2))
  const currentPhaseShort = currentPhaseId === 1
    ? 'Resume Foundation'
    : currentPhaseId === 2
    ? 'Screening Velocity'
    : currentPhaseId === 3
    ? 'Technical Loops'
    : currentPhaseId === 4
    ? 'Final Rounds'
    : currentPhaseId === 5
    ? 'Offer Acquisition'
    : 'Joining & Transition'

  const currentPhaseName = `Phase ${currentPhaseId}: ${currentPhaseShort}`

  const bookingUrl = reportData?.strategy_call_url || reportData?.booking_url || 'https://crafture.io/strategy-call'

  // Top 3 Prioritized Actions
  const priorityActions = Array.isArray(reportData?.top_priorities) && reportData.top_priorities.length > 0
    ? reportData.top_priorities.slice(0, 3)
    : Array.isArray(reportData?.priority_actions) && reportData.priority_actions.length > 0
    ? reportData.priority_actions.slice(0, 3)
    : Array.isArray(reportData?.action_plan?.priorityActions) && reportData.action_plan.priorityActions.length > 0
    ? reportData.action_plan.priorityActions.slice(0, 3)
    : Array.isArray(reportData?.resume_agent?.priorityActions) && reportData.resume_agent.priorityActions.length > 0
    ? reportData.resume_agent.priorityActions.slice(0, 3)
    : [
        { priority: 1, title: 'Quantify Experience Bullets', action: 'Restructure top achievement bullets using Google XYZ syntax with hard metrics.', reason: 'Increases recruiter scan velocity and interview conversion.' },
        { priority: 2, title: 'Align Technical Keywords to Market', action: 'Incorporate verified domain tools into both Experience and Skills clusters.', reason: 'Matches recruiter Boolean search strings and ATS filters.' },
        { priority: 3, title: 'Optimize LinkedIn Headline & About', action: 'Deploy proof-first headline and 4-part value narrative to boost inbound recruiter discovery.', reason: 'Improves semantic ranking on LinkedIn Recruiter searches.' },
      ]

  // Dynamic Action Plan (7-Day & 30/60/90)
  const actionPlan = reportData?.dynamic_action_plan || reportData?.action_plan || {}
  const sevenDayTasks = Array.isArray(actionPlan.sevenDayQuickPlan) && actionPlan.sevenDayQuickPlan.length > 0
    ? actionPlan.sevenDayQuickPlan.slice(0, 7)
    : [
        { day: 1, title: 'Keyword & Competency Alignment', action: 'Audit resume against top 10 target job descriptions to identify missing technical keywords.', deliverable: '10-JD Keyword Matrix', metricTarget: 'Add 5+ verified keywords' },
        { day: 2, title: 'Google XYZ Bullet Overhaul', action: 'Restructure top 4 achievement bullets to format: Accomplished [X] measured by [Y] by doing [Z].', deliverable: '4 Restructured bullets', metricTarget: '100% bullets with metrics' },
        { day: 3, title: 'Single-Column ATS Calibration', action: 'Reformat document to single-column layout without tables or multi-column grids for parsing safety.', deliverable: 'ATS-Compliant Document', metricTarget: '100% clean plain-text parse' },
        { day: 4, title: 'LinkedIn Headline & About Rewrite', action: 'Deploy 15-20 word hook-first headline and 4-pillar narrative about section.', deliverable: 'Updated LinkedIn profile', metricTarget: '3x profile view velocity' },
        { day: 5, title: 'Recruiter Outreach Sourcing List', action: 'Build list of 25 engineering managers and recruiters at target high-growth companies.', deliverable: '25-Lead Outbound Tracker', metricTarget: 'Send 10 personalized notes' },
        { day: 6, title: 'Technical Defense Blueprint', action: 'Document architecture, data models, and latency trade-offs for your flagship project.', deliverable: '1-Page Project Blueprint', metricTarget: 'Ready for 3-minute pitch' },
        { day: 7, title: 'Weekly Funnel Audit & Calibration', action: 'Review callback conversions and adjust application targeting strategy.', deliverable: 'Funnel Progress Log', metricTarget: 'Callback rate >= 5.0%' },
      ]

  const milestonePathway = Array.isArray(actionPlan.pathway30_60_90) && actionPlan.pathway30_60_90.length > 0
    ? actionPlan.pathway30_60_90.slice(0, 3)
    : [
        { period: '30 Days', stage: 'Asset Calibration & Outbound Engine', goal: `Overcome ATS drop-offs and generate consistent recruiter screen calls for ${targetRole}.`, deliverable: 'ATS Resume + 30 Target Account Tracker', successSignal: 'Callback rate >= 5.0%' },
        { period: '60 Days', stage: 'Screening Mastery & Technical Loops', goal: 'Convert recruiter screens into technical rounds and advance through panel assessments.', deliverable: '3+ Concurrent Technical Interview Loops', successSignal: 'Screen-to-tech conversion >= 40%' },
        { period: '90 Days', stage: 'Final Rounds, Offers & Negotiation', goal: 'Advance through onsite interview loops and secure a competitive, written job offer.', deliverable: 'Signed competitive offer letter', successSignal: 'Offer-to-joining acceptance' },
      ]

  // 4. Resume Deep Diagnosis Data
  const resumeAgent = reportData?.resume_agent || {}
  const resumeDashboard = resumeAgent.dashboard || {}
  const canonicalResume = reportData?.resume_json || resumeAgent.canonicalResume || {}

  const resumeSectionAudit = resumeAgent.sectionAudit || resumeDashboard.sectionAudit || {
    summary: { name: 'Professional Summary', score10: 7, status: 'warn', hurtingReason: 'Generic summary lacking target role keyword anchoring and hard proof metrics.', requiredImprovement: 'Open with exact target title and 3 core technical specializations.' },
    experience: { name: 'Work Experience & Bullets', score10: 6, status: 'warn', hurtingReason: 'Bullets focus on passive responsibilities rather than quantified outcomes.', requiredImprovement: 'Quantify impact using Accomplished [X] measured by [Y] by doing [Z].' },
    skills: { name: 'Technical Skills Architecture', score10: 8, status: 'pass', hurtingReason: null, requiredImprovement: 'Group technical tools into categoric clusters (Languages, Cloud, Data).' },
    layout: { name: 'Document Layout & ATS Formatting', score10: 9, status: 'pass', hurtingReason: null, requiredImprovement: 'Maintain clean single-column structure with standard ATS section headings.' },
    atsDensity: { name: 'ATS Keyword Density & Indexing', score10: 7, status: 'warn', hurtingReason: 'Core target keywords appear in skills list only, not validated within experience bullets.', requiredImprovement: 'Weave at least 4 missing domain keywords directly into role achievement bullet points.' },
  }

  // Professional Summary Rewrite
  const summaryOpt = resumeAgent?.summaryOptimization || reportData?.summary_optimization || {}
  const rewrittenSummary = safeStr(
    summaryOpt.rewrittenSummary ||
    summaryOpt.executiveSummaryRewrite ||
    reportData?.summary_rewrite,
    `Results-driven ${targetRole} with proven expertise in engineering scalable architectures, automating high-throughput pipelines, and delivering resilient enterprise solutions. Track record of cutting operational latency and accelerating delivery cycles in high-concurrency environments.`
  )
  const originalSummary = safeStr(
    summaryOpt.currentSummary ||
    summaryOpt.originalSummary ||
    (typeof canonicalResume?.summary === 'string' ? canonicalResume.summary : canonicalResume?.summary?.text),
    `Experienced ${targetRole} seeking new growth opportunities in software engineering, technical execution, and system delivery.`
  )

  // ATS Keyword Alignment
  const kwData = resumeDashboard?.keywordAlignment || resumeAgent?.keywordAlignment || reportData?.keyword_alignment || {}
  const verifiedKeywords = Array.isArray(kwData.verifiedExperience) && kwData.verifiedExperience.length > 0
    ? kwData.verifiedExperience.slice(0, 10).map((k) => (typeof k === 'string' ? k : k.keyword || k.name))
    : (Array.isArray(reportData?.verified_skills) ? reportData.verified_skills.slice(0, 10) : ['Python', 'SQL', 'Data Modeling', 'REST APIs', 'Git', 'Agile'])

  const skillsOnlyKeywords = Array.isArray(kwData.skillsOnly) && kwData.skillsOnly.length > 0
    ? kwData.skillsOnly.slice(0, 8).map((k) => (typeof k === 'string' ? k : k.keyword || k.name))
    : ['Docker', 'AWS', 'PostgreSQL', 'CI/CD']

  const missingKeywords = Array.isArray(kwData.criticalMissing) && kwData.criticalMissing.length > 0
    ? kwData.criticalMissing.slice(0, 8).map((k) => (typeof k === 'string' ? k : k.keyword || k.name))
    : (Array.isArray(reportData?.missing_skills) ? reportData.missing_skills.slice(0, 8) : ['Snowflake', 'dbt', 'Kubernetes', 'Kafka'])

  // Bullet Rewrites: Un-capped list
  const rawBullets = Array.isArray(resumeAgent.bulletRewrites || resumeAgent.bulletSuggestions || resumeDashboard.bulletAudit)
    ? (resumeAgent.bulletRewrites || resumeAgent.bulletSuggestions || resumeDashboard.bulletAudit)
        .filter((b) => b && (b.rewritten || b.suggestedRewrite || b.correctedText || b.improved))
    : []

  const bulletRewrites = rawBullets.length > 0
    ? rawBullets
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
        {
          original: 'Helped with testing and continuous integration setup across our repositories.',
          rewritten: 'Automated end-to-end CI/CD test pipelines using Docker and GitHub Actions, cutting release deployment cycles by 45% and eliminating regression downtime.',
          why: 'Frames tentative support role as definitive automation ownership with concrete time savings.',
        },
      ]

  // 5. LinkedIn Studio Data
  const linkedinAgent = reportData?.linkedin_agent || {}
  const linkedinAudit = linkedinAgent.sectionAudit || {
    headline: { name: 'Headline Positioning', score10: 6, status: 'warn', hurtingReason: 'Title-only headline without curiosity hook, business outcome, or proof metrics.', requiredImprovement: 'Deploy 15-20 word headline with proof hook + 3 recruiter keywords.' },
    about: { name: 'About Narrative Architecture', score10: 6, status: 'warn', hurtingReason: 'Reads like a dense resume repeat rather than an executive career story.', requiredImprovement: 'Structure into 4 parts: Hook, Audience & Problem, Approach & Skills, Call to Action.' },
    skills: { name: 'Pinned Skills Searchability', score10: 8, status: 'pass', hurtingReason: null, requiredImprovement: 'Pin top 3 core skills matching recruiter search algorithms.' },
    photoAndBanner: { name: 'Visual Studio & Brand Assets', score10: 5, status: 'warn', hurtingReason: 'Default banner misses high-value visual positioning real estate.', requiredImprovement: 'Deploy custom branded banner with value proposition and core tech stack.' },
    activity: { name: 'Network Engagement Velocity', score10: 5, status: 'warn', hurtingReason: 'Dormant post frequency limits profile reach to hiring managers.', requiredImprovement: 'Engage weekly on relevant industry case studies or activate automated networking.' },
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
    closingCta: `If you are scaling high-impact engineering initiatives or looking for a ${targetRole}, let's connect!`,
  }

  const ctaText = safeStr(aboutRewrite?.closingCta || aboutRewrite?.callToAction)

  // Top Pinned Skills & Skills Bank
  const pinnedSkills = Array.isArray(linkedinAgent.optimizations?.top3PinnedSkills) && linkedinAgent.optimizations.top3PinnedSkills.length > 0
    ? linkedinAgent.optimizations.top3PinnedSkills
    : verifiedKeywords.slice(0, 3)

  const recommendedSkills = Array.isArray(linkedinAgent.optimizations?.recommendedSkillsToAdd) && linkedinAgent.optimizations.recommendedSkillsToAdd.length > 0
    ? linkedinAgent.optimizations.recommendedSkillsToAdd.slice(0, 8)
    : [...missingKeywords, ...skillsOnlyKeywords].slice(0, 8)

  // Visual Identity Prompts
  const visualPrompts = linkedinAgent.visualPrompts || linkedinAgent.optimizations?.visualPrompts || {
    profilePicturePrompt: `Professional studio headshot of a candidate targeting ${targetRole}. Maintain authentic facial features, natural hairstyle, and confident approachable expression. Modern tailored blazer in dark charcoal or navy, soft butterfly studio lighting, clean minimalist defocused background. 8k resolution, cinematic commercial photography style.`,
    coverBannerPrompt: `Design a high-converting LinkedIn Cover Banner (1584x396 px) for a ${targetRole}. Features: 1) Authority Headline: "${targetRole} | Enterprise Systems & Scalable Impact", 2) Core Value Pillars: ${pinnedSkills.join(' * ')}, 3) High-contrast executive layout with dark navy/slate base, keeping lower-left 30% clear for circular avatar photo.`,
  }

  // Crafture OutFox Networking Recommendation
  const networkingRec = linkedinAgent.networkingRecommendation ||
    linkedinAgent.optimizations?.networkingRecommendation ||
    linkedinAgent.activitySignals?.networkingRecommendation || {
      isRecommended: true,
      bottleneck: 'Low posting, commenting, and connection activity is limiting your inbound visibility to hiring managers.',
      recommendation: 'To maximize visibility without spending hours daily on manual outreach, connect with the Crafture team to activate OutFox -- our automated LinkedIn networking agent that manages daily connection requests and engagement limits safely.',
    }

  // 6 Radar Scores
  const sResume = Math.round((pResume / 25) * 100)
  const sMarket = Math.round((verifiedKeywords.length / Math.max(1, verifiedKeywords.length + missingKeywords.length)) * 100) || 68
  const sLinkedin = Math.round((pLinkedin / 25) * 100)
  const sActivity = Math.round((pOutbound / 25) * 100)
  const sInterview = Math.round((pInterview / 25) * 100)
  const sFunnel = Math.min(100, Math.max(20, Math.round((Number(screenRate) / 5) * 70))) || 55
  const radarScores = [sResume, sMarket, sLinkedin, sActivity, sInterview, sFunnel]

  // Stepper 6 Phases
  const stepperPhases = [
    { id: 1, name: '1. Resume', short: 'Resume' },
    { id: 2, name: '2. Screening', short: 'Screen' },
    { id: 3, name: '3. Technical', short: 'Technical' },
    { id: 4, name: '4. Final', short: 'Final' },
    { id: 5, name: '5. Offer', short: 'Offer' },
    { id: 6, name: '6. Joining', short: 'Joining' },
  ]

  return (
    <Document
      title={`Career GPS Report - ${candidateName}`}
      author="Crafture Career GPS"
      subject="Executive Candidate Diagnostic Report"
      keywords="Career GPS, ATS Audit, Resume Analysis, LinkedIn Studio"
    >
      {/* ─────────────────────────────────────────────────────────────
          SINGLE CONTINUOUS FLOWING PAGE (wrap={true})
          Eliminates awkward 35-40% blank bottoms on Pages 1-3.
          Content packs naturally, cards keep wrap={false}, and
          section titles use minPresenceAhead={90} to prevent orphans.
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page} wrap>
        {/* Fixed Running Header on every page */}
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Executive Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        {/* Fixed Running Footer with dynamic Page X of Y on every page */}
        <View fixed style={styles.footer}>
          <Text style={styles.footerLeft}>Crafture Career GPS • Confidential Diagnostic Report</Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

        {/* ─────────────────────────────────────────────────────────────
            1. EXECUTIVE COVER & 6-PHASE HIRING JOURNEY
            ───────────────────────────────────────────────────────────── */}
        {/* Seamless Editorial Hero Banner with Edge-Mask Blending */}
        <EditorialBanner imageSrc={pdfHeroBanner} minHeight={185} gradientId="fadeLeftHero">
          {/* Top Brand Strip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image src={craftureLogo} style={{ width: 18, height: 18, borderRadius: 3 }} />
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              CRAFTURE CAREER GPS • EXECUTIVE REPORT
            </Text>
          </View>

          {/* Candidate Name with generous bottom margin */}
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0F172A', letterSpacing: -0.3, marginTop: 2, marginBottom: 6 }}>
            {candidateName}
          </Text>

          {/* Target Role & Meta */}
          <Text style={{ fontSize: 7.8, color: '#475569' }}>
            {targetRole} • Senior Engineering • {reportDate}
          </Text>

          {/* 1-Line Diagnostic Summary */}
          <Text style={{ fontSize: 7.2, color: '#334155', lineHeight: 1.3, marginTop: 1 }}>
            Comprehensive multi-agent career diagnostic auditing resume ATS readability, market keyword alignment, and LinkedIn inbound discovery.
          </Text>

          {/* Fixed Non-Wrapping Health Index Pill */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              alignSelf: 'flex-start',
              backgroundColor: '#F8FAFC',
              borderWidth: 1,
              borderColor: '#C7D2FE',
              borderRadius: 7,
              paddingVertical: 5,
              paddingHorizontal: 10,
              marginTop: 6,
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontFamily: 'Helvetica-Bold',
                color: '#0F172A',
                flexShrink: 0,
              }}
            >
              {overallScore}/100
            </Text>
            <View style={{ width: 1, height: 13, backgroundColor: '#CBD5E1' }} />
            <View style={{ flexDirection: 'column' }}>
              <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#6366F1', letterSpacing: 0.4 }}>
                HEALTH INDEX
              </Text>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: overallScore >= 75 ? '#16A34A' : overallScore >= 50 ? '#D97706' : '#DC2626' }}>
                {scoreLabel} Stage
              </Text>
            </View>
          </View>
        </EditorialBanner>

        {/* 4 Compact KPI Tiles */}
        <View style={styles.grid4} wrap={false}>
          <View style={styles.col4}>
            <View style={styles.kpiTile}>
              <Text style={styles.kpiTileLabel}>Resume</Text>
              <Text style={styles.kpiTileVal}>{pResume}<Text style={{ fontSize: 7.5, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiTileSub}>ATS & Impact</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiTile}>
              <Text style={styles.kpiTileLabel}>LinkedIn</Text>
              <Text style={styles.kpiTileVal}>{pLinkedin}<Text style={{ fontSize: 7.5, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiTileSub}>Recruiter SEO</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiTile}>
              <Text style={styles.kpiTileLabel}>Outbound</Text>
              <Text style={styles.kpiTileVal}>{pOutbound}<Text style={{ fontSize: 7.5, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiTileSub}>Funnel Velocity</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiTile}>
              <Text style={styles.kpiTileLabel}>Interview</Text>
              <Text style={styles.kpiTileVal}>{pInterview}<Text style={{ fontSize: 7.5, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiTileSub}>Technical Loop</Text>
            </View>
          </View>
        </View>

        {/* 6-Phase Hiring Journey Stepper */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>6-Phase Candidate Hiring Journey Stepper</Text>
          <Text style={styles.sectionTag}>ACTIVE PIPELINE TRACK</Text>
        </View>

        <View style={styles.card} wrap={false}>
          <Svg width="480" height="44" viewBox="0 0 480 44">
            {[0, 1, 2, 3, 4].map((i) => {
              const x1 = 36 + i * 84 + 11
              const x2 = 36 + (i + 1) * 84 - 11
              const isPast = (i + 1) < currentPhaseId
              return (
                <Line
                  key={i}
                  x1={x1}
                  y1={14}
                  x2={x2}
                  y2={14}
                  stroke={isPast ? '#16A34A' : '#CBD5E1'}
                  strokeWidth={isPast ? 2 : 1.5}
                />
              )
            })}

            {stepperPhases.map((sp, idx) => {
              const x = 36 + idx * 84
              const isCompleted = sp.id < currentPhaseId
              const isCurrent = sp.id === currentPhaseId

              return (
                <React.Fragment key={sp.id}>
                  {isCurrent && (
                    <Circle cx={x} cy={14} r={11} fill="none" stroke="#C7D2FE" strokeWidth={1.5} />
                  )}
                  <Circle
                    cx={x}
                    cy={14}
                    r={8.5}
                    fill={isCompleted ? '#DCFCE7' : isCurrent ? '#EEF2FF' : '#F8FAFC'}
                    stroke={isCompleted ? '#16A34A' : isCurrent ? '#6366F1' : '#CBD5E1'}
                    strokeWidth={isCurrent ? 2 : 1.2}
                  />
                  <Text
                    x={x}
                    y={17}
                    fontSize={6.2}
                    textAnchor="middle"
                    fill={isCompleted ? '#16A34A' : isCurrent ? '#6366F1' : '#94A3B8'}
                  >
                    {isCompleted ? 'OK' : String(sp.id)}
                  </Text>
                  <Text
                    x={x}
                    y={30}
                    fontSize={6.5}
                    textAnchor="middle"
                    fill={isCurrent ? '#0F172A' : isCompleted ? '#16A34A' : '#64748B'}
                  >
                    {sp.short}
                  </Text>
                  <Text
                    x={x}
                    y={39}
                    fontSize={5}
                    textAnchor="middle"
                    fill={isCurrent ? '#DC2626' : isCompleted ? '#16A34A' : '#94A3B8'}
                  >
                    {isCurrent ? 'BOTTLENECK' : isCompleted ? 'DONE' : 'PENDING'}
                  </Text>
                </React.Fragment>
              )
            })}
          </Svg>

          {/* Concise 1-Line Diagnosis Callout Underneath */}
          <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 4, padding: 5, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }} wrap={false}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#DC2626' }}>BOTTLENECK DIAGNOSIS:</Text>
            <Text style={{ fontSize: 7, color: '#991B1B', flex: 1 }}>
              Candidate pipeline is currently bottlenecked at {currentPhaseName}. {safeStr(bottleneck.whyItMatters || 'Automated ATS keyword filtering is discarding applications before recruiter screening.')}
            </Text>
          </View>
        </View>

        {/* Primary Bottleneck Callout Box */}
        <View style={styles.cardHighlighted} wrap={false}>
          <View style={[styles.rowBetween, { marginBottom: 2 }]}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#DC2626', textTransform: 'uppercase' }}>
              RECOVERY TARGET • {safeStr(phase.shortName, 'Top of Funnel')}
            </Text>
            <Text style={styles.tagCritical}>ACTION REQUIRED</Text>
          </View>
          <Text style={{ fontSize: 8.8, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
            {safeStr(bottleneck.title, 'Application Filtering & Low Callback Velocity')}
          </Text>
          <Text style={{ fontSize: 7.2, color: '#475569', lineHeight: 1.3 }}>
            {safeStr(bottleneck.whyItMatters)}
          </Text>
        </View>

        {/* ─────────────────────────────────────────────────────────────
            2. CAREER HEALTH RADAR & MONTHLY FUNNEL
            ───────────────────────────────────────────────────────────── */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>Career Health Telemetry & Funnel Economics</Text>
          <Text style={styles.sectionTag}>RADAR & CONVERSION</Text>
        </View>

        {/* 2-Column Telemetry: 6-Axis Radar + Progress Bars */}
        <View style={styles.grid2} wrap={false}>
          {/* Left: 6-Axis SVG Radar Chart */}
          <View style={{ width: 220 }}>
            <View style={[styles.card, { padding: 6, alignItems: 'center' }]}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
                6-Axis Career Health Radar
              </Text>
              <Svg width="210" height="150" viewBox="0 0 210 150">
                {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => (
                  <Polygon
                    key={idx}
                    points={getRadarCoords(105, 75, 46 * frac, [100, 100, 100, 100, 100, 100])}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth={0.8}
                  />
                ))}

                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const angle = -Math.PI / 2 + (i * Math.PI / 3)
                  return (
                    <Line
                      key={i}
                      x1={105}
                      y1={75}
                      x2={105 + 46 * Math.cos(angle)}
                      y2={75 + 46 * Math.sin(angle)}
                      stroke="#E2E8F0"
                      strokeWidth={0.8}
                    />
                  )
                })}

                <Polygon
                  points={getRadarCoords(105, 75, 46 * 0.8, [100, 100, 100, 100, 100, 100])}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />

                <Polygon
                  points={getRadarCoords(105, 75, 46, radarScores)}
                  fill="rgba(99, 102, 241, 0.22)"
                  stroke="#6366F1"
                  strokeWidth={1.8}
                />

                {radarScores.map((s, i) => {
                  const angle = -Math.PI / 2 + (i * Math.PI / 3)
                  const r = 46 * (Math.max(15, Math.min(100, s)) / 100)
                  return (
                    <Circle
                      key={i}
                      cx={105 + r * Math.cos(angle)}
                      cy={75 + r * Math.sin(angle)}
                      r={2.2}
                      fill="#6366F1"
                    />
                  )
                })}

                <Text x={105} y={19} fontSize={6.5} textAnchor="middle" fill="#0F172A" fontFamily="Helvetica-Bold">
                  Resume {sResume}%
                </Text>
                <Text x={155} y={51} fontSize={6.5} textAnchor="start" fill="#0F172A" fontFamily="Helvetica-Bold">
                  Market {sMarket}%
                </Text>
                <Text x={155} y={103} fontSize={6.5} textAnchor="start" fill="#0F172A" fontFamily="Helvetica-Bold">
                  LinkedIn {sLinkedin}%
                </Text>
                <Text x={105} y={135} fontSize={6.5} textAnchor="middle" fill="#0F172A" fontFamily="Helvetica-Bold">
                  Activity {sActivity}%
                </Text>
                <Text x={55} y={103} fontSize={6.5} textAnchor="end" fill="#0F172A" fontFamily="Helvetica-Bold">
                  Interview {sInterview}%
                </Text>
                <Text x={55} y={51} fontSize={6.5} textAnchor="end" fill="#0F172A" fontFamily="Helvetica-Bold">
                  Funnel {sFunnel}%
                </Text>
              </Svg>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                <Text style={{ fontSize: 6.2, color: '#6366F1' }}>■ Pipeline</Text>
                <Text style={{ fontSize: 6.2, color: '#10B981' }}>-- Target (80%)</Text>
              </View>
            </View>
          </View>

          {/* Right: Category Performance Horizontal Progress Bars */}
          <View style={styles.col2}>
            <View style={[styles.card, { padding: 8, gap: 4 }]}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 1 }}>
                Category Performance Benchmarks
              </Text>

              {[
                { label: 'Resume & ATS Readability', score: sResume, target: 85 },
                { label: 'Market Keyword Alignment', score: sMarket, target: 80 },
                { label: 'LinkedIn & Brand Authority', score: sLinkedin, target: 80 },
                { label: 'Outbound & Referral Velocity', score: sActivity, target: 75 },
                { label: 'Technical & Interview Loop', score: sInterview, target: 75 },
                { label: 'Funnel Conversion Velocity', score: sFunnel, target: 70 },
              ].map((row, idx) => {
                const isPass = row.score >= row.target
                const color = isPass ? '#16A34A' : row.score >= 60 ? '#D97706' : '#DC2626'
                return (
                  <View key={idx} style={{ marginBottom: 2 }}>
                    <View style={styles.rowBetween}>
                      <Text style={{ fontSize: 6.8, color: '#334155' }}>{row.label}</Text>
                      <Text style={{ fontSize: 6.8, fontFamily: 'Courier-Bold', color }}>
                        {row.score}% <Text style={{ fontSize: 5.8, color: '#94A3B8' }}>(Tgt {row.target}%)</Text>
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={{ width: `${Math.min(100, row.score)}%`, height: 5, backgroundColor: color, borderRadius: 2.5 }} />
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        </View>

        {/* Monthly Funnel Outcomes & Conversion Velocity */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>Monthly Funnel Outcomes & Proportional Flow</Text>
          <Text style={styles.sectionTag}>STAGE METRICS</Text>
        </View>

        <View style={styles.card} wrap={false}>
          <View style={[styles.rowBetween, { marginBottom: 4 }]}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
              Monthly Pipeline: {formatNum(totalAppsMonthly)} Applications Sent
            </Text>
            <Text style={{ fontSize: 7.2, color: '#64748B' }}>
              Screen Callback: <Text style={{ fontFamily: 'Helvetica-Bold', color: Number(screenRate) < 5 ? '#DC2626' : '#16A34A' }}>{screenRate}%</Text> (Target: {'>='} 5.0%)
            </Text>
          </View>

          {/* 4 Clean Stage Cards */}
          <View style={styles.grid4}>
            <View style={styles.col4}>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiTileLabel}>Applications</Text>
                <Text style={styles.kpiTileVal}>{formatNum(totalAppsMonthly)}</Text>
                <Text style={styles.kpiTileSub}>sent / month</Text>
              </View>
            </View>
            <View style={styles.col4}>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiTileLabel}>Screens</Text>
                <Text style={styles.kpiTileVal}>{formatNum(screens)}</Text>
                <Text style={styles.kpiTileSub}>{screenRate}% callback</Text>
              </View>
            </View>
            <View style={styles.col4}>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiTileLabel}>Tech Rounds</Text>
                <Text style={styles.kpiTileVal}>{formatNum(techs)}</Text>
                <Text style={styles.kpiTileSub}>{techPassRate}% pass</Text>
              </View>
            </View>
            <View style={styles.col4}>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiTileLabel}>Offers</Text>
                <Text style={styles.kpiTileVal}>{formatNum(offers)}</Text>
                <Text style={styles.kpiTileSub}>{offerRate}% final conv</Text>
              </View>
            </View>
          </View>

          {/* Clean Flexbox Proportional Funnel Flow Bars (No text collision) */}
          <View style={{ marginTop: 6, marginBottom: 4 }} wrap={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {/* Stage 1: Applications */}
              <View style={{ flex: 1, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 5, padding: 6, alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6366F1', textTransform: 'uppercase' }}>
                  100% Volume
                </Text>
                <Text style={{ fontSize: 8.5, fontFamily: 'Courier-Bold', color: '#0F172A', marginTop: 1 }}>
                  {formatNum(totalAppsMonthly)}
                </Text>
                <Text style={{ fontSize: 5.8, color: '#64748B' }}>Applications</Text>
              </View>

              {/* Stage 2: Screens */}
              <View style={{ flex: 1, backgroundColor: Number(screenRate) < 5 ? '#FFF1F2' : '#EEF2FF', borderWidth: 1, borderColor: Number(screenRate) < 5 ? '#FECDD3' : '#C7D2FE', borderRadius: 5, padding: 6, alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: Number(screenRate) < 5 ? '#DC2626' : '#6366F1', textTransform: 'uppercase' }}>
                  {screenRate}% Callback
                </Text>
                <Text style={{ fontSize: 8.5, fontFamily: 'Courier-Bold', color: Number(screenRate) < 5 ? '#DC2626' : '#0F172A', marginTop: 1 }}>
                  {formatNum(screens)}
                </Text>
                <Text style={{ fontSize: 5.8, color: '#64748B' }}>Recruiter Screens</Text>
              </View>

              {/* Stage 3: Tech Rounds */}
              <View style={{ flex: 1, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 5, padding: 6, alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#D97706', textTransform: 'uppercase' }}>
                  {techPassRate}% Pass
                </Text>
                <Text style={{ fontSize: 8.5, fontFamily: 'Courier-Bold', color: '#0F172A', marginTop: 1 }}>
                  {formatNum(techs)}
                </Text>
                <Text style={{ fontSize: 5.8, color: '#64748B' }}>Tech Rounds</Text>
              </View>

              {/* Stage 4: Offers */}
              <View style={{ flex: 1, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 5, padding: 6, alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#16A34A', textTransform: 'uppercase' }}>
                  {offerRate}% Offer
                </Text>
                <Text style={{ fontSize: 8.5, fontFamily: 'Courier-Bold', color: '#0F172A', marginTop: 1 }}>
                  {formatNum(offers)}
                </Text>
                <Text style={{ fontSize: 5.8, color: '#64748B' }}>Job Offers</Text>
              </View>
            </View>
          </View>

          {/* Horizontal Callback Benchmark Bar */}
          <View style={{ marginTop: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, padding: 7 }}>
            <View style={[styles.rowBetween, { marginBottom: 2 }]}>
              <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                Application-to-Screen Callback Velocity
              </Text>
              <Text style={{ fontSize: 7.2, fontFamily: 'Courier-Bold', color: Number(screenRate) < 5 ? '#DC2626' : '#16A34A' }}>
                {screenRate}% Actual vs 5.0% Industry Benchmark
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={{ width: `${Math.min(100, (Number(screenRate) / 5) * 50)}%`, height: 5, backgroundColor: Number(screenRate) < 5 ? '#DC2626' : '#16A34A', borderRadius: 2.5 }} />
            </View>
            <Text style={{ fontSize: 6.8, color: Number(screenRate) < 5 ? '#DC2626' : '#16A34A', marginTop: 2 }}>
              {Number(screenRate) < 5
                ? `CRITICAL BOTTLENECK: Actual callback (${screenRate}%) is lagging behind the 5.0% competitive baseline. High application volume without interview conversion indicates automated ATS keyword drop-off.`
                : `HEALTHY PIPELINE: Callback rate (${screenRate}%) meets or exceeds the competitive 5.0% benchmark.`}
            </Text>
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────
            3. PERSONALIZED ACTION ROADMAP
            ───────────────────────────────────────────────────────────── */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>Top Strategic Priorities</Text>
          <Text style={styles.sectionTag}>IMMEDIATE LEVERAGE</Text>
        </View>

        {/* Top 3 Strategic Priorities */}
        <View style={styles.grid3} wrap={false}>
          {priorityActions.map((pa, idx) => (
            <View key={idx} style={styles.col3}>
              <View style={styles.card}>
                <View style={[styles.rowBetween, { marginBottom: 2 }]}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                    PRIORITY 0{pa.priority || idx + 1}
                  </Text>
                  <Text style={styles.tagNeutral}>PHASE 1</Text>
                </View>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
                  {safeStr(pa.title)}
                </Text>
                <Text style={{ fontSize: 7, color: '#334155', lineHeight: 1.25 }}>
                  {safeStr(pa.action || pa.description)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>7-Day Rapid Triage Checklist</Text>
          <Text style={styles.sectionTag}>DAILY SPRINT</Text>
        </View>

        {/* 7-Day Quick-Win Plan */}
        <View style={{ marginBottom: 6 }}>
          {sevenDayTasks.map((t, idx) => (
            <View key={idx} style={styles.dayCard} wrap={false}>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, paddingRight: 6 }}>
                  <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                    DAY {t.day || idx + 1}
                  </Text>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                    {safeStr(t.title)}
                  </Text>
                </View>
                {t.metricTarget && (
                  <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#16A34A', backgroundColor: '#DCFCE7', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                    {safeStr(t.metricTarget)}
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 7.3, color: '#334155', lineHeight: 1.25 }}>
                {safeStr(t.action)}
              </Text>
              {t.deliverable && (
                <Text style={{ fontSize: 6.8, color: '#64748B' }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: '#475569' }}>Deliverable: </Text>
                  {safeStr(t.deliverable)}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>30 / 60 / 90-Day Connected Milestone Track</Text>
          <Text style={styles.sectionTag}>LONG-TERM PATHWAY</Text>
        </View>

        {/* 30/60/90 Connected Horizontal SVG Timeline */}
        <View style={styles.card} wrap={false}>
          <Svg width="480" height="26" viewBox="0 0 480 26">
            <Line x1={116} y1={13} x2={204} y2={13} stroke="#C7D2FE" strokeWidth={2} />
            <Line x1={276} y1={13} x2={364} y2={13} stroke="#CBD5E1" strokeWidth={2} />

            <Rect x={44} y={2} width={72} height={20} rx={10} fill="#EEF2FF" stroke="#6366F1" strokeWidth={1.5} />
            <Text x={80} y={15} fontSize={7.5} textAnchor="middle" fill="#6366F1">30 DAYS</Text>

            <Rect x={204} y={2} width={72} height={20} rx={10} fill="#F8FAFC" stroke="#94A3B8" strokeWidth={1} />
            <Text x={240} y={15} fontSize={7.5} textAnchor="middle" fill="#0F172A">60 DAYS</Text>

            <Rect x={364} y={2} width={72} height={20} rx={10} fill="#F8FAFC" stroke="#94A3B8" strokeWidth={1} />
            <Text x={400} y={15} fontSize={7.5} textAnchor="middle" fill="#0F172A">90 DAYS</Text>
          </Svg>

          {/* 3 Milestone Detail Cards */}
          <View style={[styles.grid3, { marginTop: 4, marginBottom: 0 }]}>
            {milestonePathway.map((p, idx) => (
              <View key={idx} style={styles.col3}>
                <View style={styles.milestoneCard}>
                  <Text style={{ fontSize: 7.8, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                    {safeStr(p.stage)}
                  </Text>
                  <Text style={{ fontSize: 6.8, color: '#475569', lineHeight: 1.25 }}>
                    {safeStr(p.goal)}
                  </Text>
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 2 }}>
                    <Text style={{ fontSize: 6.5, color: '#64748B' }}>
                      <Text style={{ fontFamily: 'Helvetica-Bold' }}>Target: </Text>
                      {safeStr(p.successSignal || p.deliverable)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────
            4. RESUME AUDIT & SIDE-BY-SIDE SUMMARY REWRITE
            ───────────────────────────────────────────────────────────── */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>Resume Deep Diagnosis & ATS Scoring</Text>
          <Text style={styles.sectionTag}>5-POINT RUBRIC</Text>
        </View>

        <View style={styles.card} wrap={false}>
          {Object.entries(resumeSectionAudit).map(([secKey, secVal]) => {
            const score = secVal?.score10 ?? 7
            const isCrit = score < 6
            const isWarn = score >= 6 && score < 8
            const title = secVal?.name || secKey.replace(/([A-Z])/g, ' $1')
            return (
              <View key={secKey} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 2.5 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 7.6, fontFamily: 'Helvetica-Bold', color: '#0F172A', textTransform: 'capitalize' }}>
                    {title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: isCrit ? '#DC2626' : isWarn ? '#D97706' : '#16A34A' }}>
                      {score}/10
                    </Text>
                    <Text style={isCrit ? styles.tagCritical : isWarn ? styles.tagWarn : styles.tagPass}>
                      {isCrit ? 'FIX REQUIRED' : isWarn ? 'NEEDS POLISH' : 'PASS'}
                    </Text>
                  </View>
                </View>
                {secVal?.hurtingReason && (
                  <Text style={{ fontSize: 6.8, color: '#DC2626', marginTop: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>Issue: </Text>
                    {safeStr(secVal.hurtingReason)}
                  </Text>
                )}
                {secVal?.requiredImprovement && (
                  <Text style={{ fontSize: 6.8, color: '#475569', marginTop: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>Fix: </Text>
                    {safeStr(secVal.requiredImprovement)}
                  </Text>
                )}
              </View>
            )
          })}
        </View>

        {/* Side-by-Side Executive Summary Rewrite */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>Side-by-Side Executive Summary Rewrite</Text>
          <Text style={styles.sectionTag}>SIDE-BY-SIDE DIFF</Text>
        </View>

        <View style={styles.grid2} wrap={false}>
          <View style={styles.col2}>
            <View style={styles.diffOriginalCard}>
              <View style={[styles.rowBetween, { marginBottom: 2 }]}>
                <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#DC2626' }}>
                  BEFORE: GENERIC SUMMARY
                </Text>
                <Text style={styles.tagCritical}>WEAK</Text>
              </View>
              <Text style={styles.monoText}>
                {originalSummary}
              </Text>
            </View>
          </View>

          <View style={styles.col2}>
            <View style={styles.diffRewrittenCard}>
              <View style={[styles.rowBetween, { marginBottom: 2 }]}>
                <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#16A34A' }}>
                  AFTER: ROLE-ALIGNED EXECUTIVE REWRITE
                </Text>
                <Text style={styles.tagPass}>OPTIMIZED</Text>
              </View>
              <Text style={styles.monoBold}>
                {rewrittenSummary}
              </Text>
            </View>
          </View>
        </View>

        {/* ATS Technical Keyword Alignment Matrix */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>ATS Technical Keyword Alignment Matrix</Text>
          <Text style={styles.sectionTag}>MARKET ALIGNMENT</Text>
        </View>

        <View style={styles.grid3} wrap={false}>
          <View style={styles.col3}>
            <View style={styles.card}>
              <View style={[styles.rowBetween, { marginBottom: 3 }]}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#16A34A' }}>VERIFIED IN ROLES</Text>
                <Text style={styles.tagPass}>{verifiedKeywords.length}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {verifiedKeywords.map((kw, idx) => (
                  <Text key={idx} style={styles.chipVerified}>{safeStr(kw)}</Text>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.col3}>
            <View style={styles.card}>
              <View style={[styles.rowBetween, { marginBottom: 3 }]}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#D97706' }}>SKILLS ONLY (UNPROVEN)</Text>
                <Text style={styles.tagWarn}>{skillsOnlyKeywords.length}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {skillsOnlyKeywords.map((kw, idx) => (
                  <Text key={idx} style={styles.chipSkillsOnly}>{safeStr(kw)}</Text>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.col3}>
            <View style={styles.card}>
              <View style={[styles.rowBetween, { marginBottom: 3 }]}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#DC2626' }}>CRITICAL MISSING</Text>
                <Text style={styles.tagCritical}>{missingKeywords.length}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {missingKeywords.map((kw, idx) => (
                  <Text key={idx} style={styles.chipMissing}>{safeStr(kw)}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────
            5. SIDE-BY-SIDE BULLET REWRITES
            ───────────────────────────────────────────────────────────── */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>High-Impact Bullet Rewrites (Google XYZ Framework)</Text>
          <Text style={styles.sectionTag}>FULL SUITE</Text>
        </View>

        <View style={[styles.card, { padding: 5, marginBottom: 5 }]} wrap={false}>
          <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#6366F1', marginBottom: 1 }}>
            5-PART RESUME PLAYBOOK FORMULA:
          </Text>
          <Text style={{ fontSize: 6.8, color: '#334155' }}>
            Strong Action Verb + Hard Technical Tool/Scope + Scale/Collaboration + Natural Calibrated Metric + Business Outcome.
          </Text>
        </View>

        {bulletRewrites.map((b, idx) => (
          <View key={idx} style={styles.bulletBentoCard} wrap={false}>
            <View style={[styles.rowBetween, { marginBottom: 2 }]}>
              <Text style={{ fontSize: 7.8, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                Bullet Rewrite #{idx + 1}
              </Text>
              <Text style={styles.tagNeutral}>GOOGLE XYZ SYNTAX</Text>
            </View>

            <View style={styles.grid2}>
              <View style={styles.col2}>
                <View style={styles.diffOriginalCard}>
                  <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#DC2626', marginBottom: 2 }}>
                    BEFORE (ORIGINAL WEAK / UNQUANTIFIED):
                  </Text>
                  <Text style={styles.monoText}>{safeStr(b.original || b.bullet || b.originalText)}</Text>
                </View>
              </View>

              <View style={styles.col2}>
                <View style={styles.diffRewrittenCard}>
                  <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#16A34A', marginBottom: 2 }}>
                    AFTER (MEASURABLE IMPACT & OUTCOME):
                  </Text>
                  <Text style={styles.monoBold}>{safeStr(b.rewritten || b.suggestedRewrite || b.correctedText || b.improved)}</Text>
                </View>
              </View>
            </View>

            {(b.why || b.critique || b.recommendation) && (
              <View style={{ marginTop: 2, paddingTop: 2, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 6.8, color: '#475569' }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>Why it works: </Text>
                  {safeStr(b.why || b.critique || b.recommendation)}
                </Text>
              </View>
            )}
          </View>
        ))}

        {/* ─────────────────────────────────────────────────────────────
            6. LINKEDIN STUDIO, 2x2 BENTO ABOUT & STRATEGY CALL CTA
            ───────────────────────────────────────────────────────────── */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>LinkedIn Studio & Recruiter Search SEO</Text>
          <Text style={styles.sectionTag}>PROFILE AUDIT</Text>
        </View>

        <View style={styles.card} wrap={false}>
          {Object.entries(linkedinAudit).map(([secKey, secVal]) => {
            const score = secVal?.score10 ?? 7
            const isCrit = score < 6
            const isWarn = score >= 6 && score < 8
            const title = secVal?.name || secKey.replace(/([A-Z])/g, ' $1')
            return (
              <View key={secKey} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 2 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', textTransform: 'capitalize' }}>
                    {title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: isCrit ? '#DC2626' : isWarn ? '#D97706' : '#16A34A' }}>
                      {score}/10
                    </Text>
                    <Text style={isCrit ? styles.tagCritical : isWarn ? styles.tagWarn : styles.tagPass}>
                      {isCrit ? 'FIX' : isWarn ? 'POLISH' : 'PASS'}
                    </Text>
                  </View>
                </View>
                {secVal?.hurtingReason && (
                  <Text style={{ fontSize: 6.8, color: '#DC2626', marginTop: 1 }}>
                    {safeStr(secVal.hurtingReason)}
                  </Text>
                )}
              </View>
            )
          })}
        </View>

        {/* 3 AI Recruiter Headlines */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>Recruiter-Searchable Headline Options (15-20 Words)</Text>
          <Text style={styles.sectionTag}>SEARCH INDEXED</Text>
        </View>

        {linkedinHeadlines.map((h, idx) => (
          <View key={idx} style={styles.card} wrap={false}>
            <View style={[styles.rowBetween, { marginBottom: 1 }]}>
              <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                Option 0{idx + 1} • {safeStr(h.formula || h.style || 'High-Impact')}
              </Text>
              <Text style={styles.tagNeutral}>15-20 WORDS</Text>
            </View>
            <Text style={{ fontSize: 7.6, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 1 }}>
              {safeStr(h.headline)}
            </Text>
            {h.whyItWorks && (
              <Text style={{ fontSize: 6.8, color: '#64748B' }}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Why it works: </Text>
                {safeStr(h.whyItWorks)}
              </Text>
            )}
          </View>
        ))}

        {/* 2x2 Bento Grid for 4-Part About Narrative */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>Story-Driven LinkedIn About Rewrite (2x2 Architecture)</Text>
          <Text style={styles.sectionTag}>EXECUTIVE NARRATIVE</Text>
        </View>

        <View style={styles.card} wrap={false}>
          <View style={[styles.grid2, { marginBottom: 4 }]}>
            <View style={styles.col2}>
              <View style={styles.aboutPillar}>
                <Text style={styles.aboutPillarLabel}>1. HOOK & PROOF</Text>
                <Text style={styles.aboutPillarText}>{safeStr(aboutRewrite.hook)}</Text>
              </View>
            </View>
            <View style={styles.col2}>
              <View style={styles.aboutPillar}>
                <Text style={styles.aboutPillarLabel}>2. AUDIENCE & CORE PROBLEM</Text>
                <Text style={styles.aboutPillarText}>{safeStr(aboutRewrite.audienceAndProblem)}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.grid2, { marginBottom: 0 }]}>
            <View style={styles.col2}>
              <View style={styles.aboutPillar}>
                <Text style={styles.aboutPillarLabel}>3. METHODOLOGY & SKILLS</Text>
                <Text style={styles.aboutPillarText}>{safeStr(aboutRewrite.approachAndSkills)}</Text>
              </View>
            </View>
            <View style={styles.col2}>
              {Boolean(ctaText) ? (
                <View style={styles.aboutPillar}>
                  <Text style={styles.aboutPillarLabel}>4. CLOSING CALL TO ACTION</Text>
                  <Text style={styles.aboutPillarText}>{ctaText}</Text>
                </View>
              ) : (
                <View style={[styles.aboutPillar, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                  <Text style={styles.aboutPillarLabel}>4. ENGAGEMENT FOCUS</Text>
                  <Text style={styles.aboutPillarText}>
                    Open to technical leadership and high-impact engineering initiatives in {targetRole}.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Top Pinned & Missing Skills Bank */}
        <View style={styles.grid2} wrap={false}>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#6366F1', marginBottom: 2 }}>
                TOP 3 PINNED SKILLS (RECRUITER CARDS)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {pinnedSkills.map((sk, idx) => (
                  <Text key={idx} style={styles.chipVerified}>{safeStr(sk)}</Text>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#475569', marginBottom: 2 }}>
                HIGH-DEMAND SKILLS TO ADD
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {recommendedSkills.map((sk, idx) => (
                  <Text key={idx} style={styles.chipSkillsOnly}>{safeStr(sk)}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Visual Identity & Crafture OutFox Networking Card */}
        <View style={styles.grid2} wrap={false}>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
                PROFILE PHOTO AI STUDIO PROMPT
              </Text>
              <Text style={{ fontSize: 6.8, color: '#475569', lineHeight: 1.25 }}>
                {safeStr(visualPrompts.profilePicturePrompt || visualPrompts.profilePhotoPrompt)}
              </Text>
            </View>
          </View>
          <View style={styles.col2}>
            <View style={styles.cardHighlighted}>
              <View style={[styles.rowBetween, { marginBottom: 2 }]}>
                <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                  CRAFTURE OUTFOX NETWORKING AGENT
                </Text>
                <Text style={styles.tagPass}>RECOMMENDED</Text>
              </View>
              <Text style={{ fontSize: 6.8, color: '#334155', lineHeight: 1.25 }}>
                {safeStr(networkingRec.recommendation || networkingRec.bottleneck)}
              </Text>
            </View>
          </View>
        </View>

        {/* 7. Final Page 1-on-1 Strategy Call CTA Banner */}
        <EditorialBanner
          imageSrc={pdfCtaBanner}
          minHeight={160}
          gradientId="fadeLeftCta"
          style={{ marginTop: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              NEXT STEP • LIVE EXECUTION BRIDGE
            </Text>
          </View>

          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0F172A', letterSpacing: -0.2, lineHeight: 1.25, marginTop: 2 }}>
            Stuck at Phase {currentPhaseId} ({currentPhaseShort})? Fix It Live in a 1-on-1 Strategy Call
          </Text>

          <Text style={{ fontSize: 7.5, color: '#334155', lineHeight: 1.3, marginTop: 2 }}>
            Work directly with an executive technical recruiter to calibrate your {targetRole} positioning, rewrite your highest-leverage bullets, and implement your customized execution plan live.
          </Text>

          <Link
            src={bookingUrl}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#6366F1',
              borderRadius: 6,
              paddingVertical: 7,
              paddingHorizontal: 14,
              marginTop: 6,
              textDecoration: 'none',
            }}
          >
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>
              Book Free 1-on-1 Strategy Call {'->'}
            </Text>
          </Link>
        </EditorialBanner>
      </Page>
    </Document>
  )
}
