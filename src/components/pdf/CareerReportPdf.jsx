import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Circle,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// Disable automatic hyphenation across the entire document to avoid ugly "En-gineer" breaks
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 42,
    paddingHorizontal: 36,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#0F172A',
    lineHeight: 1.35,
  },
  header: {
    position: 'absolute',
    top: 18,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 5,
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
    fontSize: 7.5,
    color: '#64748B',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 5,
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
    marginTop: 10,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionTag: {
    fontSize: 7,
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
    marginBottom: 6,
  },
  cardHighlighted: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  heroBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 8.5,
    color: '#94A3B8',
  },
  scoreBadgeContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScoreText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    lineHeight: 1,
    textAlign: 'center',
  },
  gaugeSubText: {
    fontSize: 6.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid2: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  col2: {
    flex: 1,
  },
  grid3: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  col3: {
    flex: 1,
  },
  grid4: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
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
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  kpiVal: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  kpiSub: {
    fontSize: 6.5,
    color: '#94A3B8',
    marginTop: 1,
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
    marginTop: 3,
    marginBottom: 3,
    flexDirection: 'row',
  },
  dayCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 7,
    marginBottom: 5,
    flexDirection: 'column',
    gap: 3,
  },
  milestoneCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 8,
    flexDirection: 'column',
    gap: 3,
  },
  diffBlock: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 7,
    marginBottom: 5,
  },
  diffOriginal: {
    backgroundColor: '#FFF1F2',
    borderLeftWidth: 3,
    borderLeftColor: '#F43F5E',
    padding: 5,
    borderRadius: 3,
    marginBottom: 3,
  },
  diffRewritten: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
    padding: 5,
    borderRadius: 3,
    marginBottom: 3,
  },
  monoText: {
    fontFamily: 'Courier',
    fontSize: 7.5,
    color: '#1E293B',
    lineHeight: 1.3,
  },
  chipVerified: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  chipSkillsOnly: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  chipMissing: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  aboutPillar: {
    backgroundColor: '#FFFFFF',
    padding: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 3,
  },
  aboutPillarLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#6366F1',
    letterSpacing: 0.4,
  },
  aboutPillarText: {
    fontSize: 7.5,
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
    'Professional'
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
    name: 'Application -> Screening Velocity',
    metricGoal: 'Achieve >= 5.0% application-to-screen conversion.',
  }
  const bottleneck = reportData?.primary_bottleneck || {
    title: reportData?.critical_issues?.[0]?.title || 'Application Filtering & Low Screen Velocity',
    whyItMatters: 'Recruiters scan resumes in under 10 seconds. Missing target keywords and unquantified achievements cause automated ATS drop-off.',
    evidence: 'High application volume yielding below-benchmark recruiter callbacks.',
  }

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

  // 3. Dynamic Action Plan (7-Day & 30/60/90)
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
    summary: { score10: 7, status: 'warn', hurtingReason: 'Generic summary lacking target role keyword anchoring and hard proof metrics.', requiredImprovement: 'Open with exact target title and 3 core technical specializations.' },
    experience: { score10: 6, status: 'warn', hurtingReason: 'Bullets focus on passive responsibilities rather than quantified outcomes.', requiredImprovement: 'Quantify impact using Accomplished [X] measured by [Y] by doing [Z].' },
    skills: { score10: 8, status: 'pass', hurtingReason: null, requiredImprovement: 'Group technical tools into categoric clusters (Languages, Cloud, Data).' },
    layout: { score10: 9, status: 'pass', hurtingReason: null, requiredImprovement: 'Maintain clean single-column structure with standard ATS section headings.' },
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
    headline: { score10: 6, status: 'warn', hurtingReason: 'Title-only headline without curiosity hook, business outcome, or proof metrics.', requiredImprovement: 'Deploy 15-20 word headline with proof hook + 3 recruiter keywords.' },
    about: { score10: 6, status: 'warn', hurtingReason: 'Reads like a dense resume repeat rather than an executive career story.', requiredImprovement: 'Structure into 4 parts: Hook, Audience & Problem, Approach & Skills, Call to Action.' },
    skills: { score10: 8, status: 'pass', hurtingReason: null, requiredImprovement: 'Pin top 3 core skills matching recruiter search algorithms.' },
    photoAndBanner: { score10: 5, status: 'warn', hurtingReason: 'Default banner misses high-value visual positioning real estate.', requiredImprovement: 'Deploy custom branded banner with value proposition and core tech stack.' },
    activity: { score10: 5, status: 'warn', hurtingReason: 'Dormant post frequency limits profile reach to hiring managers.', requiredImprovement: 'Engage weekly on relevant industry case studies or activate automated networking.' },
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

  // Circular gauge circumference calculation (r = 26, width = 64)
  const radius = 26
  const circumference = 2 * Math.PI * radius // ~163.36
  const strokeDash = (overallScore / 100) * circumference

  return (
    <Document
      title={`Career GPS Report - ${candidateName}`}
      author="Crafture Career GPS"
      subject="Candidate Career Diagnostic Report"
      keywords="Career GPS, ATS Audit, Resume Analysis, LinkedIn Studio"
    >
      {/* ─────────────────────────────────────────────────────────────
          PAGE 1: EXECUTIVE OVERVIEW, CAREER HEALTH & MONTHLY FUNNEL
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        {/* Hero Banner with Centered Vector SVG Gauge */}
        <View style={styles.heroBanner} wrap={false}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#818CF8', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                CONFIDENTIAL CANDIDATE REPORT
              </Text>
              <Text style={{ fontSize: 7, color: '#94A3B8' }}>*</Text>
              <Text style={{ fontSize: 7.5, color: '#CBD5E1' }}>{targetRole}</Text>
            </View>
            <Text style={styles.heroTitle}>{candidateName}</Text>
            <Text style={styles.heroSubtitle}>
              Target Role: <Text style={{ color: '#FFFFFF', fontFamily: 'Helvetica-Bold' }}>{targetRole}</Text> • Generated on {reportDate}
            </Text>
          </View>

          {/* Perfectly Centered Score Badge */}
          <View style={styles.scoreBadgeContainer}>
            <Svg width="64" height="64" viewBox="0 0 64 64">
              <Circle
                cx="32"
                cy="32"
                r={radius}
                stroke="#334155"
                strokeWidth="5"
                fill="none"
              />
              <Circle
                cx="32"
                cy="32"
                r={radius}
                stroke="#6366F1"
                strokeWidth="5"
                fill="none"
                strokeDasharray={`${strokeDash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
            </Svg>
            <View style={styles.gaugeOverlay}>
              <Text style={styles.gaugeScoreText}>{overallScore}</Text>
              <Text style={styles.gaugeSubText}>/ 100</Text>
            </View>
          </View>
        </View>

        {/* 4 Pillar Breakdown */}
        <View style={styles.grid4} wrap={false}>
          <View style={styles.col4}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Resume</Text>
              <Text style={styles.kpiVal}>{pResume}<Text style={{ fontSize: 7.5, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiSub}>ATS & Impact</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>LinkedIn</Text>
              <Text style={styles.kpiVal}>{pLinkedin}<Text style={{ fontSize: 7.5, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiSub}>Recruiter SEO</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Outbound</Text>
              <Text style={styles.kpiVal}>{pOutbound}<Text style={{ fontSize: 7.5, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiSub}>Funnel Velocity</Text>
            </View>
          </View>
          <View style={styles.col4}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Interview</Text>
              <Text style={styles.kpiVal}>{pInterview}<Text style={{ fontSize: 7.5, color: '#94A3B8' }}>/25</Text></Text>
              <Text style={styles.kpiSub}>Technical Loop</Text>
            </View>
          </View>
        </View>

        {/* Primary Bottleneck Diagnosis */}
        <View style={styles.cardHighlighted} wrap={false}>
          <View style={[styles.rowBetween, { marginBottom: 3 }]}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              PRIMARY CAREER BOTTLENECK • {safeStr(phase.shortName, 'Top of Funnel')}
            </Text>
            <Text style={styles.tagCritical}>ACTION REQUIRED</Text>
          </View>
          <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
            {safeStr(bottleneck.title, 'Top-of-Funnel Conversion Friction')}
          </Text>
          <Text style={{ fontSize: 8, color: '#475569', marginBottom: 4, lineHeight: 1.3 }}>
            {safeStr(bottleneck.whyItMatters, 'Missing target keywords and unquantified achievements cause automated ATS filtering.')}
          </Text>
          <View style={{ backgroundColor: '#FFFFFF', padding: 5, borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1', marginBottom: 1 }}>
              PRIMARY RECOVERY TARGET:
            </Text>
            <Text style={{ fontSize: 7.5, color: '#1E293B' }}>
              {safeStr(phase.metricGoal, 'Achieve >= 5.0% application-to-screen conversion within 14 days.')}
            </Text>
          </View>
        </View>

        {/* Top 3 Prioritized Actions */}
        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>Top Strategic Priorities</Text>
          <Text style={styles.sectionTag}>IMMEDIATE LEVERAGE</Text>
        </View>

        <View style={styles.grid3} wrap={false}>
          {priorityActions.map((pa, idx) => (
            <View key={idx} style={styles.col3}>
              <View style={[styles.card, { height: '100%' }]}>
                <View style={[styles.rowBetween, { marginBottom: 2 }]}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                    PRIORITY 0{pa.priority || idx + 1}
                  </Text>
                  <Text style={styles.tagNeutral}>PHASE 1</Text>
                </View>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
                  {safeStr(pa.title)}
                </Text>
                <Text style={{ fontSize: 7.5, color: '#334155', lineHeight: 1.25 }}>
                  {safeStr(pa.action || pa.description)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Monthly Funnel & Conversion Velocity */}
        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>Monthly Funnel Outcomes & Conversion Velocity</Text>
          <Text style={styles.sectionTag}>STAGE METRICS</Text>
        </View>

        <View style={styles.card} wrap={false}>
          <View style={[styles.rowBetween, { marginBottom: 5 }]}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
              Monthly Application Pipeline: {formatNum(totalAppsMonthly)} Sent
            </Text>
            <Text style={{ fontSize: 7.5, color: '#64748B' }}>
              Screen Rate: <Text style={{ fontFamily: 'Helvetica-Bold', color: Number(screenRate) < 5 ? '#DC2626' : '#16A34A' }}>{screenRate}%</Text> (Target: {'>='} 5.0%)
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
              <Text style={{ fontSize: 7.2, color: '#475569' }}>Application to Screen Callback (Actual vs 5.0% Benchmark)</Text>
              <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: Number(screenRate) < 5 ? '#DC2626' : '#16A34A' }}>
                {screenRate}% {Number(screenRate) < 5 ? '(BELOW BENCHMARK)' : '(HEALTHY)'}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={{ width: `${Math.min(100, (Number(screenRate) / 10) * 100)}%`, height: 5, backgroundColor: Number(screenRate) < 5 ? '#DC2626' : '#16A34A', borderRadius: 2.5 }} />
            </View>
          </View>
        </View>

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
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>7-Day Rapid Triage Action Plan</Text>
          <Text style={styles.sectionTag}>EXECUTION CHECKLIST</Text>
        </View>

        {/* 7-Day Quick Plan - Vertical Column Flow with Zero Collisions */}
        <View style={{ marginBottom: 8 }}>
          {sevenDayTasks.map((t, idx) => (
            <View key={idx} style={styles.dayCard} wrap={false}>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, paddingRight: 6 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                    DAY {t.day || idx + 1}
                  </Text>
                  <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                    {safeStr(t.title)}
                  </Text>
                </View>
                {t.metricTarget && (
                  <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#16A34A', backgroundColor: '#DCFCE7', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                    {safeStr(t.metricTarget)}
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 7.8, color: '#334155', lineHeight: 1.25 }}>
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

        {/* 30/60/90 Pathway Row - Hugging Content Without Giant Gaps */}
        <View style={styles.grid3} wrap={false}>
          {milestonePathway.map((p, idx) => (
            <View key={idx} style={styles.col3}>
              <View style={styles.milestoneCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                    {safeStr(p.period)}
                  </Text>
                  <Text style={{ fontSize: 6.8, color: '#94A3B8' }}>Phase 0{idx + 1}</Text>
                </View>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
                  {safeStr(p.stage)}
                </Text>
                <Text style={{ fontSize: 7.3, color: '#475569', lineHeight: 1.25, marginBottom: 3 }}>
                  {safeStr(p.goal)}
                </Text>
                <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 3 }}>
                  <Text style={{ fontSize: 6.8, color: '#64748B' }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>Target: </Text>
                    {safeStr(p.successSignal || p.deliverable)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View fixed style={styles.footer}>
          <Text style={styles.footerLeft}>Crafture Career GPS • Confidential Diagnostic Report</Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* ─────────────────────────────────────────────────────────────
          PAGE 3: RESUME COMPLETE AUDIT & KEYWORD ARCHITECTURE
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>Resume Deep Diagnosis & ATS Scoring</Text>
          <Text style={styles.sectionTag}>SECTION-BY-SECTION /10</Text>
        </View>

        {/* Section Audit Table */}
        <View style={styles.card} wrap={false}>
          {Object.entries(resumeSectionAudit).map(([secKey, secVal]) => {
            const score = secVal?.score10 ?? 7
            const isCrit = score < 6
            const isWarn = score >= 6 && score < 8
            return (
              <View key={secKey} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 3 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A', textTransform: 'capitalize' }}>
                    {secKey.replace(/([A-Z])/g, ' $1')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: isCrit ? '#DC2626' : isWarn ? '#D97706' : '#16A34A' }}>
                      {score}/10
                    </Text>
                    <Text style={isCrit ? styles.tagCritical : isWarn ? styles.tagWarn : styles.tagPass}>
                      {isCrit ? 'FIX REQUIRED' : isWarn ? 'NEEDS POLISH' : 'PASS'}
                    </Text>
                  </View>
                </View>
                {secVal?.hurtingReason && (
                  <Text style={{ fontSize: 7.2, color: '#DC2626', marginTop: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>Issue: </Text>
                    {safeStr(secVal.hurtingReason)}
                  </Text>
                )}
                {secVal?.requiredImprovement && (
                  <Text style={{ fontSize: 7.2, color: '#475569', marginTop: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>Fix: </Text>
                    {safeStr(secVal.requiredImprovement)}
                  </Text>
                )}
              </View>
            )
          })}
        </View>

        {/* Professional Summary Rewrite */}
        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>Executive Professional Summary Rewrite</Text>
          <Text style={styles.sectionTag}>POSITIONING HOOK</Text>
        </View>

        <View style={styles.card} wrap={false}>
          <View style={styles.diffOriginal}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#DC2626', marginBottom: 1 }}>
              ORIGINAL / WEAK GENERIC SUMMARY:
            </Text>
            <Text style={{ fontSize: 7.5, color: '#334155', lineHeight: 1.25 }}>
              {originalSummary}
            </Text>
          </View>
          <View style={styles.diffRewritten}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#16A34A', marginBottom: 1 }}>
              OPTIMIZED EXECUTIVE REWRITE (ROLE-ALIGNED):
            </Text>
            <Text style={{ fontSize: 7.5, color: '#166534', fontFamily: 'Helvetica-Bold', lineHeight: 1.3 }}>
              {rewrittenSummary}
            </Text>
          </View>
        </View>

        {/* ATS Keyword Alignment */}
        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>ATS Technical Keyword Alignment</Text>
          <Text style={styles.sectionTag}>MARKET ALIGNMENT</Text>
        </View>

        <View style={styles.grid3} wrap={false}>
          {/* Verified in Work Experience */}
          <View style={styles.col3}>
            <View style={[styles.card, { height: '100%' }]}>
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

          {/* In Skills Section Only */}
          <View style={styles.col3}>
            <View style={[styles.card, { height: '100%' }]}>
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

          {/* Critical Missing Market Keywords */}
          <View style={styles.col3}>
            <View style={[styles.card, { height: '100%' }]}>
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

        <View fixed style={styles.footer}>
          <Text style={styles.footerLeft}>Crafture Career GPS • Confidential Diagnostic Report</Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* ─────────────────────────────────────────────────────────────
          PAGE 4: QUANTIFIED BULLET REWRITES (GOOGLE XYZ FRAMEWORK)
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>High-Impact Bullet Rewrites (Full Suite)</Text>
          <Text style={styles.sectionTag}>GOOGLE XYZ SYNTAX</Text>
        </View>

        {bulletRewrites.map((b, idx) => (
          <View key={idx} style={styles.diffBlock} wrap={false}>
            <View style={[styles.rowBetween, { marginBottom: 2 }]}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                Bullet Rewrite #{idx + 1}
              </Text>
              <Text style={styles.tagNeutral}>5-PART PLAYBOOK FORMULA</Text>
            </View>

            {/* Original Weak Bullet */}
            <View style={styles.diffOriginal}>
              <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#DC2626', marginBottom: 1 }}>
                BEFORE (ORIGINAL WEAK / UNQUANTIFIED):
              </Text>
              <Text style={styles.monoText}>{safeStr(b.original || b.bullet || b.originalText)}</Text>
            </View>

            {/* Rewritten Result-Driven Bullet */}
            <View style={styles.diffRewritten}>
              <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#16A34A', marginBottom: 1 }}>
                AFTER (MEASURABLE IMPACT & OUTCOME):
              </Text>
              <Text style={styles.monoText}>{safeStr(b.rewritten || b.suggestedRewrite || b.correctedText || b.improved)}</Text>
            </View>

            {(b.why || b.critique || b.recommendation) && (
              <Text style={{ fontSize: 6.8, color: '#64748B', marginTop: 1 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: '#475569' }}>Why it works: </Text>
                {safeStr(b.why || b.critique || b.recommendation)}
              </Text>
            )}
          </View>
        ))}

        <View fixed style={styles.footer}>
          <Text style={styles.footerLeft}>Crafture Career GPS • Confidential Diagnostic Report</Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* ─────────────────────────────────────────────────────────────
          PAGE 5: LINKEDIN STUDIO & RECRUITER SEARCH OPTIMIZATION
          ───────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.header}>
          <Text style={styles.headerLeft}>Crafture Career GPS • Diagnostic Report</Text>
          <Text style={styles.headerRight}>{candidateName} | {reportDate}</Text>
        </View>

        <View style={styles.sectionTitleRow} wrap={false}>
          <Text style={styles.sectionTitle}>LinkedIn Studio & Recruiter Search SEO</Text>
          <Text style={styles.sectionTag}>PROFILE AUDIT</Text>
        </View>

        {/* Section-by-Section /10 Audit Table */}
        <View style={styles.card} wrap={false}>
          {Object.entries(linkedinAudit).map(([secKey, secVal]) => {
            const score = secVal?.score10 ?? 7
            const isCrit = score < 6
            const isWarn = score >= 6 && score < 8
            return (
              <View key={secKey} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 2.5 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 7.8, fontFamily: 'Helvetica-Bold', color: '#0F172A', textTransform: 'capitalize' }}>
                    {secKey.replace(/([A-Z])/g, ' $1')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: isCrit ? '#DC2626' : isWarn ? '#D97706' : '#16A34A' }}>
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
        <View style={styles.sectionTitleRow} wrap={false}>
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
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 1 }}>
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

        {/* 4-Part Video Copywriting About Rewrite */}
        <View style={styles.card} wrap={false}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 3 }}>
            Story-Driven LinkedIn About Rewrite (Clean Narrative Architecture)
          </Text>
          <View style={styles.aboutPillar}>
            <Text style={styles.aboutPillarLabel}>1. HOOK & PROOF</Text>
            <Text style={styles.aboutPillarText}>{safeStr(aboutRewrite.hook)}</Text>
          </View>
          <View style={styles.aboutPillar}>
            <Text style={styles.aboutPillarLabel}>2. AUDIENCE & CORE PROBLEM</Text>
            <Text style={styles.aboutPillarText}>{safeStr(aboutRewrite.audienceAndProblem)}</Text>
          </View>
          <View style={styles.aboutPillar}>
            <Text style={styles.aboutPillarLabel}>3. METHODOLOGY & SKILLS</Text>
            <Text style={styles.aboutPillarText}>{safeStr(aboutRewrite.approachAndSkills)}</Text>
          </View>
          {Boolean(ctaText) && (
            <View style={styles.aboutPillar}>
              <Text style={styles.aboutPillarLabel}>4. CLOSING CALL TO ACTION</Text>
              <Text style={styles.aboutPillarText}>{ctaText}</Text>
            </View>
          )}
        </View>

        {/* Top Pinned & Missing Skills Bank */}
        <View style={styles.grid2} wrap={false}>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1', marginBottom: 2 }}>
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
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#475569', marginBottom: 2 }}>
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

        {/* Visual Identity & Crafture OutFox Networking Recommendation */}
        <View style={styles.grid2} wrap={false}>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
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
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
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
