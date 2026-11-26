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
  Path,
  Image,
  Link,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// Import Verified Brand & Scene Assets
import craftureLogo from '../../assets/images/crafture-logo.jpg'
import pdfHeroBanner from '../../assets/images/pdf-hero-banner.png'
import pdfCtaBanner from '../../assets/images/pdf-cta-banner.jpg'
import { getCareerHealthAxes, resolveFourPillars } from '../../lib/reportMetrics'

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

function isTrueQuantifiedPdf(text) {
  if (!text || typeof text !== 'string') return false
  const clean = text
    .replace(/\b(?:react|angular|vue|python|d3|node|es|oauth|jwt|html|css|java|ecma|c\+\+|c#|dot net|\.net)\.?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\bv\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b(?:19|20)\d{2}\b/g, '')

  if (/\d+(?:\.\d+)?%/.test(clean)) return true
  if (/\b\d+(?:\.\d+)?[xX]\b/.test(clean)) return true
  if (/(?:(?:[\$€£₹]|(?:Rs\.?|INR|CAD|AUD)\s*)\s*[\d,]+(?:\.\d+)?(?:\s*[kmb]\b|\s*million|\s*billion|\s*lakhs?|\s*crores?)?|\b[\d,]+(?:\.\d+)?\s*(?:lakhs?|crores?)\s*(?:INR|Rs\.?)?\b)/i.test(clean)) return true
  if (/\b\d+(?:\.\d+)?\+?\s*(?:(?:manual|working|analytical|engineering|operational|labor)\s+)?(?:ms|milliseconds?|seconds?|sec|mins?|minutes?|hours?|hrs?|days?|weeks?|months?)\b/i.test(clean)) return true
  if (/\b\d+\s*(?:hours?|hrs?|days?|weeks?|mins?|minutes?)\s*(?:to|–|-)\s*(?:under\s+)?\d+\s*(?:hours?|hrs?|days?|weeks?|mins?|minutes?|seconds?|ms)\b/i.test(clean)) return true
  if (/\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|million|billion)\+?/i.test(clean)) return true
  if (/\b\d+(?:,\d{3})*\+?(?:-(?:person|member|engineer|developer|query|model|tool|node|cluster|pipeline|report|server|table))?\s*(?:users|qps|rps|tps|events|requests|records|rows|bank employees|employees|clients|customers|patients|queries|reports|dashboards|features|releases|deployments|transactions|microservices|services|endpoints|tables|models|cves|vulnerabilities|tickets|bugs|defects|test cases|builds|pipelines|nodes|clusters|servers|containers|pods|members|engineers|developers|analysts|people|beds|team|accounts|leads|subscribers)\b/i.test(clean)) return true
  if (/\b(?:\d+\s*-\s*person(?:\s+team)?|team\s+of\s+\d+|led\s+\d+\s+(?:engineers|developers|people|analysts|members))\b/i.test(clean)) return true
  if (/\b\d{2,}\+?\s+(?:production|enterprise|distributed|active|concurrent|client|bed)\b/i.test(clean)) return true
  if (/\bwcag\s*(?:2\.[012]|2\s*aa)\b/i.test(clean)) return true

  return false
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
 * Unified Editorial Banner with guaranteed non-overlapping 2-column flex row layout.
 * Left: Children copy/meta/pills (width: '50%')
 * Right: Crisp scene illustration (width: '48%', objectFit: 'contain')
 */
function EditorialBanner({
  imageSrc,
  children,
  style = {},
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        padding: 18,
        gap: 14,
        marginBottom: 8,
        ...style,
      }}
      wrap={false}
    >
      <View
        style={{
          width: '50%',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {children}
      </View>

      {imageSrc && (
        <View
          style={{
            width: '46%',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <Image
            src={imageSrc}
            style={{
              width: '100%',
              maxHeight: 165,
              objectFit: 'contain',
            }}
          />
        </View>
      )}
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
    reportData?.resume_json?.candidate?.name ||
    reportData?.resume_agent?.candidateSnapshot?.name ||
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

  // 1. Overall & Pillar Scores via Canonical Metric Resolver
  const healthMetrics = getCareerHealthAxes(reportData)
  const { resume25, linkedin25, outbound25, interview25, overallScore } = resolveFourPillars(reportData)
  const radarAxes = healthMetrics.axes
  const radarScores = radarAxes.map((a) => a.current)
  const targetScores = radarAxes.map((a) => a.target)

  const scoreLabel = overallScore >= 75 ? 'Strong' : overallScore >= 50 ? 'Developing' : 'Emerging'

  const pResume = resume25
  const pLinkedin = linkedin25
  const pOutbound = outbound25
  const pInterview = interview25

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

  const numScreenRate = Number(screenRate) || 0
  const numTechPassRate = Number(techPassRate) || 0
  const numTechFinalRate = Number(finalPassRate) || 0

  // Deterministic Bottleneck State Machine matching backend
  const isPhase2Healthy = numScreenRate >= 5.0
  const resolvedPhaseId = Number(
    reportData?.bottleneckStageId ||
    reportData?.funnel_stages?.bottleneckStageId ||
    reportData?.phase?.id ||
    (offers >= 1
      ? 6
      : finals >= 1 && offers === 0
      ? 5
      : isPhase2Healthy && numTechPassRate >= 40 && numTechFinalRate < 35 && techs >= 1
      ? 4
      : isPhase2Healthy && numTechPassRate < 40
      ? 3
      : 2)
  )

  const currentPhaseId = resolvedPhaseId
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
    : 'Onboarding & BGV'

  const currentPhaseName = `Phase ${currentPhaseId}: ${currentPhaseShort}`

  // Dynamic targets calculated relative to candidate's actual numbers
  const targetCallbackRate = Math.min(25, Math.max(5, Math.ceil(numScreenRate * 1.35)))
  const targetScreenToTech = Math.min(85, Math.max(40, Math.ceil(numTechPassRate * 1.25)))

  // Primary Bottleneck & Phase Identification
  const phase = reportData?.phase || {
    shortName: currentPhaseShort,
    name: currentPhaseName,
    metricGoal: isPhase2Healthy ? `Target technical pass rate >= ${targetScreenToTech}%.` : `Achieve >= ${targetCallbackRate}% application-to-screen conversion.`,
  }
  const bottleneck = reportData?.primary_bottleneck || {
    title: reportData?.critical_issues?.[0]?.title || (isPhase2Healthy ? 'Recruiter Screen to Technical Handoff Friction' : 'Application Filtering & Low Screen Velocity'),
    whyItMatters: isPhase2Healthy
      ? 'Resume is clearing ATS filters, but conversation drops before live technical rounds.'
      : 'Recruiters scan resumes in under 10 seconds. Missing target keywords and unquantified achievements cause automated ATS drop-off.',
    evidence: isPhase2Healthy
      ? `Technical pass rate is ${techPassRate}% despite healthy ${screenRate}% screening callback rate.`
      : 'High application volume yielding below-benchmark recruiter callbacks.',
  }

  const bookingUrl =
    reportData?.callBookingUrl ||
    reportData?.teaserSettings?.bookingUrl ||
    reportData?.strategy_call_url ||
    reportData?.booking_url ||
    'https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe'
  const rawWaStr = String(
    reportData?.whatsappCtaNumber || reportData?.teaserSettings?.whatsappNumber || ''
  ).trim()
  let cleanWaNum = rawWaStr.replace(/\D/g, '')
  if (rawWaStr.startsWith('00')) {
    cleanWaNum = cleanWaNum.slice(2)
  } else if (!rawWaStr.startsWith('+') && cleanWaNum.length === 10) {
    cleanWaNum = /^[6-9]/.test(cleanWaNum) ? `91${cleanWaNum}` : `1${cleanWaNum}`
  }
  const waMsg = `Hi Crafture team, I'm ${candidateName} targeting ${targetRole} (Career Health Score: ${overallScore}/100) and would like to unlock my complete Career GPS Report.`
  const whatsappUrl = cleanWaNum
    ? `https://wa.me/${cleanWaNum}?text=${encodeURIComponent(waMsg)}`
    : `https://wa.me/?text=${encodeURIComponent(waMsg)}`

  const isReportUnlocked = Boolean(reportData?.reportUnlocked) && !Boolean(reportData?.__teaserRedacted)
  const socialLinksConfig = reportData?.socialLinksConfig || reportData?.teaserSettings?.socialLinksConfig || null
  const socialMasterEnabled = Boolean(socialLinksConfig?.enabled)
  const showCommunityCta =
    socialMasterEnabled &&
    Boolean(socialLinksConfig?.communityEnabled) &&
    Boolean(String(socialLinksConfig?.communityUrl || '').trim())
  const communityLabel = String(socialLinksConfig?.communityLabel || 'Join Our Community').trim() || 'Join Our Community'
  const communityUrl = String(socialLinksConfig?.communityUrl || '').trim()
  const activeSocialItems = socialMasterEnabled
    ? (Array.isArray(socialLinksConfig?.items)
        ? socialLinksConfig.items.filter((i) => i?.enabled && String(i?.url || '').trim())
        : [])
    : []
  const rawPhotoCandidate =
    reportData?.resolvedLinkedinPhotoDataUri ||
    reportData?.linkedin_agent?.profilePic ||
    reportData?.linkedin_agent?.avatarUrl ||
    reportData?.linkedinActivityData?.profilePic ||
    reportData?.linkedinActivityData?.avatarUrl ||
    null
  const safeLinkedinPhoto =
    typeof rawPhotoCandidate === 'string' &&
    (/^data:image\/(png|jpeg|jpg);base64,/i.test(rawPhotoCandidate) ||
      /^https?:\/\/.+\.(png|jpe?g)(\?.*)?$/i.test(rawPhotoCandidate))
      ? rawPhotoCandidate
      : null
  const linkedinProfileUrl =
    reportData?.linkedin_agent?.profileUrl ||
    reportData?.user_answers?.linkedin ||
    reportData?.linkedinUrl ||
    ''
  const linkedinScoreVal =
    reportData?.linkedin_agent?.score ??
    reportData?.linkedin_score ??
    null
  const candidateInitials = String(candidateName || 'C')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'C'

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
  const isRedacted = Boolean(reportData?.__teaserRedacted)
  const actionPlan = reportData?.dynamic_action_plan || reportData?.action_plan || {}
  const sevenDayTasks = (Array.isArray(actionPlan.sevenDayQuickPlan) && actionPlan.sevenDayQuickPlan.length > 0)
    ? actionPlan.sevenDayQuickPlan.slice(0, 7)
    : (Array.isArray(reportData?.sevenDayQuickPlan) && reportData.sevenDayQuickPlan.length > 0)
    ? reportData.sevenDayQuickPlan.slice(0, 7)
    : isRedacted
    ? [{ locked: true, lockedReason: 'Locked - Book Free 1:1 Call to Unlock' }]
    : [
        {
          day: 1,
          title: 'Target Keyword & Skills-Only Evidence Audit',
          action: 'Audit your experience bullets against top target job descriptions to weave missing high-demand tools (TypeScript, Spring Boot, Kafka, Kubernetes) directly into production bullet context. Move unverified skills from your bottom skills list into measurable project outcomes.',
          deliverable: 'Keyword-Mapped Experience Matrix',
          metricTarget: '5+ missing skills evidenced in bullets',
        },
        {
          day: 2,
          title: 'Google XYZ Bullet Overhaul (Phase 2 Recovery)',
          action: 'Rewrite your weakest unquantified work bullets using Accomplished [X] as measured by [Y] by doing [Z] syntax. Anchor every Spring Boot and TypeScript deliverable with latency reductions, throughput gains, or user-scale metrics to lift Phase 2 callback above 5.0%.',
          deliverable: 'Quantified Core Experience Bullets',
          metricTarget: '100% rewritten bullets with hard KPIs',
        },
        {
          day: 3,
          title: 'Executive Summary & Single-Column ATS Calibration',
          action: 'Replace your generic top summary with a role-aligned positioning pitch highlighting TypeScript, Spring Boot, Kafka, and Kubernetes scale. Strip multi-column grids or merged contact headers so Greenhouse and Workday parsers index 100% of your timeline cleanly.',
          deliverable: 'ATS-Safe Single-Column Resume',
          metricTarget: '0 parser errors / 100% field extraction',
        },
        {
          day: 4,
          title: 'LinkedIn Headline SEO & About Hook Rewrite',
          action: 'Deploy your recruiter-searchable Option 01 headline leading with your target title and core stack (TypeScript, Spring Boot, Kafka, Kubernetes). Publish Paragraph 1-3 of your story-driven About section and pin your top 3 core skills to rank in Boolean recruiter searches.',
          deliverable: 'SEO-Indexed Headline & About Narrative',
          metricTarget: '3x recruiter search appearance lift',
        },
        {
          day: 5,
          title: 'LinkedIn Featured Section & Skills Bank Expansion',
          action: 'Populate your empty LinkedIn Featured section with 2 flagship architecture case studies or live repos demonstrating Kafka event pipelines and Kubernetes deployments. Expand your Skills Bank from 30/50 toward 50/50 role-indexed skills for full All-Star search weighting.',
          deliverable: '2 Featured Case Studies + 50/50 Skills',
          metricTarget: 'Featured populated + 50/50 skills',
        },
        {
          day: 6,
          title: 'Targeted Hiring Manager Outbound Sprint',
          action: 'Run the LinkedIn Boolean query to build a focused list of 25 Engineering Managers and Staff Recruiters hiring for TypeScript and Spring Boot teams. Send concise, achievement-led connection notes referencing your Kafka and Kubernetes production wins instead of cold Easy Apply.',
          deliverable: '25-Lead Hiring Manager Tracker',
          metricTarget: '15+ direct manager outreach DMs sent',
        },
        {
          day: 7,
          title: 'Phase 2 Funnel Audit & Technical Defense Prep',
          action: isPhase2Healthy
            ? 'Review technical round feedback across TypeScript, Spring Boot, and distributed Kafka architecture trade-offs. Document failure-mode recovery stories and latency benchmarks for each flagship system so live panel rounds convert consistently.'
            : 'Audit your Phase 2 conversion funnel (moving from 0.1% callback toward >= 5.0% target) across your first 20 tailored applications. Double down on direct referral channels and refine weak bullet hooks where recruiter screens lag.',
          deliverable: '7-Day Funnel & Defense Calibration Log',
          metricTarget: isPhase2Healthy ? `Technical pass rate >= ${targetScreenToTech}%` : `Phase 2 callback >= ${targetCallbackRate}%`,
        },
      ]

  const rawMilestonePathway = (Array.isArray(actionPlan.milestonePathway) && actionPlan.milestonePathway.length > 0)
    ? actionPlan.milestonePathway.slice(0, 3)
    : (Array.isArray(reportData?.milestonePathway) && reportData.milestonePathway.length > 0)
    ? reportData.milestonePathway.slice(0, 3)
    : (Array.isArray(actionPlan.pathway30_60_90) && actionPlan.pathway30_60_90.length > 0)
    ? actionPlan.pathway30_60_90.slice(0, 3)
    : (Array.isArray(reportData?.strategicRoadmap) && reportData.strategicRoadmap.length > 0)
    ? reportData.strategicRoadmap.slice(0, 3)
    : [
        {
          period: '30 Days',
          stage: isPhase2Healthy ? 'Screening Retention & Technical Loop Launch' : 'Phase 2 Callback Recovery (0.1% -> 5%+)',
          goal: isPhase2Healthy
            ? `Sustain your ${screenRate}% screening callback while weaving TypeScript, Spring Boot, Kafka, and Kubernetes proof into live technical architecture walkthroughs and daily manager outreach.`
            : `Eliminate Phase 2 ATS drop-offs (0.1% -> 5%+ callback) by quantizing weak bullets, adding TypeScript, Spring Boot, Kafka, and Kubernetes evidence, populating LinkedIn Featured, and running 25/week direct manager outreach.`,
          deliverable: 'Quantified ATS Resume + Featured LinkedIn + 60 Manager DMs',
          successSignal: isPhase2Healthy ? `Screening maintained at ${screenRate}%+` : `Phase 2 callback >= 5.0%`,
        },
        {
          period: '60 Days',
          stage: 'Technical Panel Defense & Multi-Loop Velocity',
          goal: `Convert >= ${targetScreenToTech}% of recruiter screens into technical panels by rehearsing distributed Kafka throughput, Kubernetes scaling trade-offs, and 5 STAR ownership stories across 3+ concurrent interview pipelines.`,
          deliverable: 'System Design Blueprints + 3+ Active Technical Loops',
          successSignal: `Screen-to-tech conversion >= ${targetScreenToTech}%`,
        },
        {
          period: '90 Days',
          stage: 'Final Onsite Closing & Compensation Leverage',
          goal: 'Advance through final director and architecture rounds across parallel opportunities, benchmark total compensation bands, and negotiate base, equity, and sign-on terms from a position of multi-offer leverage.',
          deliverable: 'Written Competitive Offer & Total Comp Benchmark',
          successSignal: 'Accepted offer at target compensation band',
        },
      ]
  const milestonePathway = isRedacted
    ? rawMilestonePathway.map((m, idx) =>
        idx === 0 ? m : { locked: true, lockedReason: m?.lockedReason || 'Locked - Book Free 1:1 Call to Unlock' }
      )
    : rawMilestonePathway

  // 4. Resume Deep Diagnosis Data
  const resumeAgent = reportData?.resume_agent || {}
  const resumeDashboard = resumeAgent.dashboard || {}
  const canonicalResume = reportData?.resume_json || resumeAgent.canonicalResume || {}

  const rawAudit = resumeAgent.sectionAudit || resumeDashboard.sectionAudit || reportData?.resume_agent?.sectionAudit || null
  const bulletAuditList = (Array.isArray(resumeDashboard?.bulletAudit) && resumeDashboard.bulletAudit.length > 0)
    ? resumeDashboard.bulletAudit
    : (Array.isArray(reportData?.bullet_rewrites) ? reportData.bullet_rewrites : [])
  const totalExpCount = resumeDashboard?.quantification?.totalBullets ||
                        resumeDashboard?.bulletStats?.totalBullets ||
                        resumeAgent?.quantification?.totalBullets ||
                        bulletAuditList.length ||
                        (Array.isArray(canonicalResume?.experiences)
                          ? canonicalResume.experiences.reduce((sum, e) => sum + (e.bullets?.length || 0), 0)
                          : 0)
  const quantCount = resumeDashboard?.quantification?.quantifiedBullets ??
                     resumeDashboard?.bulletStats?.quantifiedBullets ??
                     resumeAgent?.quantification?.quantifiedBullets ??
                     bulletAuditList.filter((b) => b.hasQuantifier || b.status === 'pass' || isTrueQuantifiedPdf(b.text || b.originalText || b.original || '')).length

  let resumeSectionAudit = {}
  if (rawAudit && typeof rawAudit === 'object' && Object.keys(rawAudit).length > 0) {
    resumeSectionAudit = JSON.parse(JSON.stringify(rawAudit))
  } else {
    const expDensity = totalExpCount > 0 ? quantCount / totalExpCount : 0
    resumeSectionAudit = {
      headerAndContact: { name: 'Header & Contact Parsing', score10: 10, status: 'pass', hurtingReason: null, requiredImprovement: 'Format contact info as a clean single line at the top: Name | Location | Phone | Email | LinkedIn.' },
      summary: { name: 'Professional Summary', score10: 7, status: 'warn', hurtingReason: 'Generic summary lacking target role keyword anchoring and hard proof metrics.', requiredImprovement: 'Open with exact target title and core technical specializations.' },
      experience: {
        name: 'Work Experience & Bullets',
        score10: expDensity >= 0.5 ? 9 : expDensity > 0 ? 7 : 5,
        status: expDensity >= 0.5 ? 'pass' : 'warn',
        hurtingReason: expDensity >= 0.5
          ? null
          : expDensity === 0
          ? `0 of ${totalExpCount} bullets (0%) contain measurable metrics. Without quantified outcomes (% or $ scale), recruiters cannot verify your engineering impact.`
          : `Only ${quantCount} of ${totalExpCount} bullets (${Math.round(expDensity * 100)}%) contain measurable metrics, falling below the 50% recruiter benchmark.`,
        requiredImprovement: 'Quantify impact using Accomplished [X] measured by [Y] by doing [Z].'
      },
      skills: { name: 'Technical Skills Architecture', score10: 8, status: 'pass', hurtingReason: null, requiredImprovement: 'Group technical tools into categoric clusters.' },
      formatting: { name: 'Document Layout & ATS Formatting', score10: 9, status: 'pass', hurtingReason: null, requiredImprovement: 'Maintain clean single-column structure with standard ATS section headings.' },
    }
  }

  // Ensure experience numbers are dynamically synchronized with real counts:
  if (resumeSectionAudit?.experience && totalExpCount > 0) {
    const expDensity = quantCount / totalExpCount
    if (quantCount === 0) {
      resumeSectionAudit.experience.score10 = Math.min(resumeSectionAudit.experience.score10 || 5, 5)
      resumeSectionAudit.experience.status = 'warn'
      resumeSectionAudit.experience.hurtingReason = `0 of ${totalExpCount} bullets (0%) contain measurable metrics. Without quantified outcomes (% or $ scale), recruiters cannot verify your engineering impact.`
    } else if (expDensity < 0.5) {
      resumeSectionAudit.experience.score10 = Math.min(resumeSectionAudit.experience.score10 || 7, 7)
      resumeSectionAudit.experience.status = 'warn'
      if (!resumeSectionAudit.experience.hurtingReason || resumeSectionAudit.experience.hurtingReason.includes('0 of')) {
        resumeSectionAudit.experience.hurtingReason = `Only ${quantCount} of ${totalExpCount} bullets (${Math.round(expDensity * 100)}%) contain measurable metrics, falling below the 50% recruiter benchmark.`
      }
    } else {
      if ((resumeSectionAudit.experience.score10 || 0) < 8) resumeSectionAudit.experience.score10 = 9
      resumeSectionAudit.experience.status = 'pass'
      resumeSectionAudit.experience.hurtingReason = null
    }
  }

  // Professional Summary Rewrite
  const summaryOpt = resumeAgent?.summaryOptimization || reportData?.summary_optimization || {}
  const rawCandidateSkills = (Array.isArray(canonicalResume?.skills) ? canonicalResume.skills : (Array.isArray(canonicalResume?.top_skills) ? canonicalResume.top_skills : []))
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill || ''))
    .filter(Boolean)
  const topCandidateStack = rawCandidateSkills.slice(0, 6).join(', ') || 'enterprise architecture and cloud technologies'

  const rawRewrittenSummary = summaryOpt.rewrittenSummary || summaryOpt.executiveSummaryRewrite || reportData?.summary_rewrite || ''
  const isGenericSummary = !rawRewrittenSummary ||
    /specializing in scalable architecture,\s*technical execution,\s*and robust workflow automation/i.test(rawRewrittenSummary) ||
    /proven expertise in engineering scalable architectures/i.test(rawRewrittenSummary)

  const rewrittenSummary = isGenericSummary
    ? `Experienced ${targetRole} specializing in ${topCandidateStack}. Proven track record of delivering resilient, high-availability architecture, optimizing production workflows, and eliminating system bottlenecks.`
    : safeStr(rawRewrittenSummary)

  const originalSummary = safeStr(
    summaryOpt.currentSummary ||
    summaryOpt.originalSummary ||
    (typeof canonicalResume?.summary === 'string' ? canonicalResume.summary : canonicalResume?.summary?.text),
    `Experienced ${targetRole} with background in technical execution, system delivery, and project leadership.`
  )

  // ATS Keyword Alignment — Robust Dynamic Multi-Alias Mapping (Zero Hardcoded Mock Arrays)
  const kwData = resumeDashboard?.keywordAlignment || resumeAgent?.keywordAlignment || reportData?.keyword_alignment || {}

  const rawVerified = (
    (Array.isArray(kwData.matchedInExperience) && kwData.matchedInExperience.length > 0 && kwData.matchedInExperience) ||
    (Array.isArray(kwData.verifiedExperience) && kwData.verifiedExperience.length > 0 && kwData.verifiedExperience) ||
    (Array.isArray(kwData.matchedKeywords) && kwData.matchedKeywords.length > 0 && kwData.matchedKeywords) ||
    (Array.isArray(kwData.matchedSkills) && kwData.matchedSkills.length > 0 && kwData.matchedSkills) ||
    (Array.isArray(reportData?.verified_skills) && reportData.verified_skills.length > 0 && reportData.verified_skills) ||
    (Array.isArray(resumeAgent?.verifiedSkills) && resumeAgent.verifiedSkills.length > 0 && resumeAgent.verifiedSkills) ||
    []
  )
  const verifiedKeywords = rawVerified.slice(0, 24).map((k) => (typeof k === 'string' ? k : k?.keyword || k?.name || k?.skill)).filter(Boolean)

  const rawSkillsOnly = (
    (Array.isArray(kwData.skillsOnlyUnverified) && kwData.skillsOnlyUnverified.length > 0 && kwData.skillsOnlyUnverified) ||
    (Array.isArray(kwData.skillsOnly) && kwData.skillsOnly.length > 0 && kwData.skillsOnly) ||
    (Array.isArray(reportData?.skills_only) && reportData.skills_only.length > 0 && reportData.skills_only) ||
    []
  )
  const lockedSkillsOnlyCount =
    rawSkillsOnly.filter((k) => k && typeof k === 'object' && k.locked).length ||
    Number(kwData.lockedSkillsOnlyCount || 0)
  const skillsOnlyKeywords = rawSkillsOnly
    .filter((k) => !(k && typeof k === 'object' && k.locked))
    .slice(0, 20)
    .map((k) => (typeof k === 'string' ? k : k?.keyword || k?.name || k?.skill))
    .filter(Boolean)

  const rawMissing = (
    (Array.isArray(kwData.missingFromResume) && kwData.missingFromResume.length > 0 && kwData.missingFromResume) ||
    (Array.isArray(kwData.missingMarketSkillsRanked) && kwData.missingMarketSkillsRanked.length > 0 && kwData.missingMarketSkillsRanked) ||
    (Array.isArray(kwData.criticalMissing) && kwData.criticalMissing.length > 0 && kwData.criticalMissing) ||
    (Array.isArray(kwData.missingKeywords) && kwData.missingKeywords.length > 0 && kwData.missingKeywords) ||
    (Array.isArray(reportData?.missing_skills) && reportData.missing_skills.length > 0 && reportData.missing_skills) ||
    (Array.isArray(resumeAgent?.missingTargetKeywords) && resumeAgent.missingTargetKeywords.length > 0 && resumeAgent.missingTargetKeywords) ||
    []
  )
  const lockedMissingCount =
    rawMissing.filter((k) => k && typeof k === 'object' && k.locked).length ||
    Number(kwData.lockedMissingCount || 0)
  const missingKeywords = rawMissing
    .filter((k) => !(k && typeof k === 'object' && k.locked))
    .slice(0, 20)
    .map((k) => (typeof k === 'string' ? k : k?.keyword || k?.name || k?.skill))
    .filter(Boolean)

  // Bullet Rewrites: Un-capped dynamic aggregation across all sources (Zero Hardcoded Dummy Arrays)
  const candidateBulletSources = [
    ...(Array.isArray(resumeAgent.bulletUpgrades) ? resumeAgent.bulletUpgrades : []),
    ...(Array.isArray(resumeAgent.bulletRewrites) ? resumeAgent.bulletRewrites : []),
    ...(Array.isArray(resumeAgent.bulletSuggestions) ? resumeAgent.bulletSuggestions : []),
    ...(Array.isArray(resumeDashboard.bulletAudit) ? resumeDashboard.bulletAudit : []),
    ...(Array.isArray(reportData?.bulletRewrites) ? reportData.bulletRewrites : []),
    ...(Array.isArray(reportData?.bullet_rewrites) ? reportData.bullet_rewrites : []),
  ]

  const bulletMap = new Map()
  for (const b of candidateBulletSources) {
    if (!b || typeof b !== 'object') continue
    const rewritten = b.rewritten || b.rewrittenText || b.suggestedRewrite || b.correctedText || b.improved
    if (!rewritten || typeof rewritten !== 'string' || !rewritten.trim()) continue

    const original = b.original || b.bullet || b.originalText || b.text || ''
    if (original && rewritten) {
      const cleanOrig = original.trim().replace(/^[•\-*▪–—·\s]+/, '').replace(/[.!?]+$/, '').toLowerCase()
      const cleanRw = rewritten.trim().replace(/^[•\-*▪–—·\s]+/, '').replace(/[.!?]+$/, '').toLowerCase()
      if (cleanOrig === cleanRw) continue
      const origWords = cleanOrig.split(/\s+/)
      const rwWords = cleanRw.split(/\s+/)
      if (origWords.length === rwWords.length && origWords.length > 3) {
        let sameCount = 0
        for (let i = 1; i < origWords.length; i++) {
          if (origWords[i] === rwWords[i]) sameCount++
        }
        if (sameCount / (origWords.length - 1) >= 0.85) continue
      }
    }
    const bulletId = b.bulletId || b.id || (original ? original.slice(0, 45).toLowerCase().replace(/\s+/g, ' ') : null)
    if (!bulletId) continue

    if (!bulletMap.has(bulletId)) {
      bulletMap.set(bulletId, {
        bulletId,
        original,
        rewritten: rewritten.trim(),
        whyItWorks: b.whyItWorks || b.why || b.reason || b.critique || 'Restructures bullet into verified Google XYZ format: Action + Technical Mechanism + Measurable Impact.',
        critique: b.critique || b.issue || b.reason || null,
        metricOpportunities: Array.isArray(b.metricOpportunities) ? b.metricOpportunities : [],
        evidenceStatus: b.evidenceStatus || null,
        confirmedMetric: b.confirmedMetric || null,
      })
    }
  }

  const effectiveLockedBulletsCount = Array.isArray(resumeDashboard?.bulletAudit)
    ? resumeDashboard.bulletAudit.filter((b) => b?.locked).length
    : candidateBulletSources.filter((b) => b?.locked).length

  const bulletRewrites = Array.from(bulletMap.values())

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
        { headline: `${targetRole} | Full Stack Systems | React, Node.js, Python | Cloud & Distributed APIs | AWS`, formula: 'Best Overall • Recommended', whyItWorks: 'Role-first indexing optimized for recruiter Boolean searches and technical screening.' },
        { headline: `${targetRole} | Specialized in Distributed Systems, High-Concurrency APIs & Fault-Tolerant Cloud`, formula: 'Specialized Focus', whyItWorks: 'Highlights deep architectural specialization and high-demand domain keywords.' },
        { headline: `${targetRole} | Software Engineering & Cloud Solutions | Microservices, DevOps & CI/CD`, formula: 'Broad Opportunities', whyItWorks: 'Broadens recruiter reach across software engineering and cloud infrastructure queries.' },
      ]

  const aboutRewrite = linkedinAgent.optimizations?.aboutRewrite || {
    professionalJourney: `Over the past years as a ${targetRole}, I have focused on solving high-concurrency challenges, modernizing legacy systems, and delivering low-latency software.`,
    specializationAndProof: 'My core specialization pairs clean system design with automated test suites and continuous delivery, focusing on maintainable solutions that scale predictable engineering impact.',
    directionAndNetworking: `Holding verified engineering experience, I am focused on scaling high-impact initiatives. If you are looking for a ${targetRole}, let's connect!`,
    keywordsUsed: ['Distributed Systems', 'Cloud Architecture', 'APIs', 'CI/CD'],
  }

  const journeyText = safeStr(aboutRewrite?.professionalJourney || aboutRewrite?.hook)
  const specializationText = safeStr(aboutRewrite?.specializationAndProof || aboutRewrite?.approachAndSkills)
  const legacyAudienceText = safeStr(aboutRewrite?.audienceAndProblem)
  const networkingText = safeStr(aboutRewrite?.directionAndNetworking || aboutRewrite?.closingCta || aboutRewrite?.callToAction)
  const aboutKeywords = Array.isArray(aboutRewrite?.keywordsUsed)
    ? aboutRewrite.keywordsUsed.map(safeStr).filter(Boolean)
    : []

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

  // Crafture Network Recommendation
  const networkingRec = linkedinAgent.networkingRecommendation ||
    linkedinAgent.optimizations?.networkingRecommendation ||
    linkedinAgent.activitySignals?.networkingRecommendation || {
      isRecommended: true,
      bottleneck: 'Low posting, commenting, and connection activity is limiting your inbound visibility to hiring managers.',
      recommendation: 'To maximize visibility without spending hours daily on manual outreach, connect with the Crafture team to activate Crafture Network -- our automated LinkedIn networking agent that manages daily connection requests and engagement limits safely.',
    }

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
        {/* Unified Editorial Hero Banner */}
        <EditorialBanner imageSrc={pdfHeroBanner}>
          {/* Top Brand Strip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image src={craftureLogo} style={{ width: 18, height: 18, borderRadius: 3 }} />
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              CRAFTURE CAREER GPS • EXECUTIVE REPORT
            </Text>
          </View>

          {/* Candidate Name */}
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0F172A', letterSpacing: -0.3, lineHeight: 1.22, marginTop: 2, marginBottom: 6 }}>
            {candidateName}
          </Text>

          {/* Target Role & Meta */}
          <Text style={{ fontSize: 7.8, color: '#475569', lineHeight: 1.28, marginTop: 2, marginBottom: 6 }}>
            {targetRole} • Senior Engineering • {reportDate}
          </Text>

          {/* 1-Line Diagnostic Summary */}
          <Text style={{ fontSize: 7.2, color: '#334155', lineHeight: 1.32 }}>
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
              borderColor: '#E2E8F0',
              borderRadius: 7,
              paddingVertical: 5,
              paddingHorizontal: 10,
              marginTop: 4,
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
              {isPhase2Healthy
                ? `Screening callback velocity is healthy at ${screenRate}% (exceeding 5.0% benchmark). Pipeline conversion stalls at ${currentPhaseName} (${techPassRate}% technical pass rate vs 40% target). ${safeStr(reportData?.recruiterVerdict || reportData?.sixSecondRecruiterVerdict || bottleneck.diagnosis || 'Advancing to onsite panels requires sharper technical storytelling and system design trade-off articulation.')}`
                : `Pipeline conversion stalls at ${currentPhaseName} (${screenRate}% actual callback vs 5.0% industry target). ${safeStr(reportData?.recruiterVerdict || reportData?.sixSecondRecruiterVerdict || bottleneck.diagnosis || 'Automated ATS keyword filtering is discarding applications before recruiter screening.')}`}
            </Text>
          </View>
        </View>

        {/* Primary Bottleneck Callout Box */}
        <View style={styles.cardHighlighted} wrap={false}>
          <View style={[styles.rowBetween, { marginBottom: 2 }]}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#DC2626', textTransform: 'uppercase' }}>
              RECOVERY TARGET • {safeStr(currentPhaseShort, 'Screening')}
            </Text>
            <Text style={styles.tagCritical}>ACTION REQUIRED</Text>
          </View>
          <Text style={{ fontSize: 8.8, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
            {safeStr(bottleneck.title, 'Pipeline Conversion Optimization')}
          </Text>
          <Text style={{ fontSize: 7.2, color: '#475569', lineHeight: 1.3 }}>
            {safeStr(
              bottleneck.recoveryTarget || bottleneck.recommendedPivot,
              isPhase2Healthy
                ? `Maintain screening callback velocity while optimizing technical interview conversion from ${techPassRate}% to >= ${targetScreenToTech}%.`
                : `Deploy single-column Google XYZ achievements with verified technical stack to elevate callback velocity from ${screenRate}% to >= ${targetCallbackRate}%.`
            )}
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
                  points={getRadarCoords(105, 75, 46, targetScores)}
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

                <Text x={105} y={19} fontSize={6.2} textAnchor="middle" fill="#0F172A" fontFamily="Helvetica-Bold">
                  {radarAxes[0]?.subject} {radarAxes[0]?.current}%
                </Text>
                <Text x={155} y={51} fontSize={6.2} textAnchor="start" fill="#0F172A" fontFamily="Helvetica-Bold">
                  {radarAxes[1]?.subject} {radarAxes[1]?.current}%
                </Text>
                <Text x={155} y={103} fontSize={6.2} textAnchor="start" fill="#0F172A" fontFamily="Helvetica-Bold">
                  {radarAxes[2]?.subject} {radarAxes[2]?.current}%
                </Text>
                <Text x={105} y={135} fontSize={6.2} textAnchor="middle" fill="#0F172A" fontFamily="Helvetica-Bold">
                  {radarAxes[3]?.subject} {radarAxes[3]?.current}%
                </Text>
                <Text x={55} y={103} fontSize={6.2} textAnchor="end" fill="#0F172A" fontFamily="Helvetica-Bold">
                  {radarAxes[4]?.subject} {radarAxes[4]?.current}%
                </Text>
                <Text x={55} y={51} fontSize={6.2} textAnchor="end" fill="#0F172A" fontFamily="Helvetica-Bold">
                  {radarAxes[5]?.subject} {radarAxes[5]?.current}%
                </Text>
              </Svg>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                <Text style={{ fontSize: 6.2, color: '#6366F1' }}>■ Current</Text>
                <Text style={{ fontSize: 6.2, color: '#10B981' }}>-- Post-Fix Target</Text>
              </View>
            </View>
          </View>

          {/* Right: Category Performance Horizontal Progress Bars */}
          <View style={styles.col2}>
            <View style={[styles.card, { padding: 8, gap: 4 }]}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 1 }}>
                Category Performance Benchmarks
              </Text>

              {radarAxes.map((row, idx) => {
                const isPass = row.current >= row.target
                const color = isPass ? '#16A34A' : row.current >= 60 ? '#D97706' : '#DC2626'
                return (
                  <View key={idx} style={{ marginBottom: 2 }}>
                    <View style={styles.rowBetween}>
                      <Text style={{ fontSize: 6.8, color: '#334155' }}>{row.label || row.subject}</Text>
                      <Text style={{ fontSize: 6.8, fontFamily: 'Courier-Bold', color }}>
                        {row.current}% <Text style={{ fontSize: 5.8, color: '#94A3B8' }}>(Tgt {row.target}%)</Text>
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={{ width: `${Math.min(100, row.current)}%`, height: 5, backgroundColor: color, borderRadius: 2.5 }} />
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
                {pa?.locked ? (
                  <Text style={{ fontSize: 7, color: '#64748B', fontStyle: 'italic' }}>
                    Locked - Book Free 1:1 Strategy Call to Unlock
                  </Text>
                ) : (
                  <>
                    <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
                      {safeStr(pa.title)}
                    </Text>
                    <Text style={{ fontSize: 7, color: '#334155', lineHeight: 1.25 }}>
                      {safeStr(pa.action || pa.description)}
                    </Text>
                  </>
                )}
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
          {sevenDayTasks.some((t) => t?.locked) ? (
            <View style={[styles.card, { padding: 5 }]} wrap={false}>
              <Text style={{ fontSize: 7.2, color: '#64748B', fontStyle: 'italic' }}>
                Locked - Book Free 1:1 Call to Unlock
              </Text>
            </View>
          ) : (
            sevenDayTasks.map((t, idx) => (
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
          ))
          )}
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
                  {p?.locked ? (
                    <Text style={{ fontSize: 7, color: '#64748B', fontStyle: 'italic' }}>
                      {safeStr(p.lockedReason, 'Locked - Book Free 1:1 Call to Unlock')}
                    </Text>
                  ) : (
                    <>
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
                    </>
                  )}
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

        <View style={styles.card}>
          {Object.entries(resumeSectionAudit)
            .filter(([secKey]) => secKey !== 'header' || !resumeSectionAudit.headerAndContact)
            .map(([secKey, secVal]) => {
            const score = secVal?.score10 ?? 7
            const isCrit = score < 6
            const isWarn = score >= 6 && score < 8
            const title = secVal?.name || secKey.replace(/([A-Z])/g, ' $1')
            return (
              <View key={secKey} wrap={false} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 2.5 }}>
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
                <Text style={summaryOpt?.summaryRewriteLocked || isRedacted ? styles.tagNeutral : styles.tagPass}>
                  {summaryOpt?.summaryRewriteLocked || isRedacted ? 'LOCKED' : 'OPTIMIZED'}
                </Text>
              </View>
              {summaryOpt?.summaryRewriteLocked || isRedacted ? (
                <Text style={{ fontSize: 7, color: '#64748B', fontStyle: 'italic' }}>
                  Locked - Book Free 1:1 Call to Unlock
                </Text>
              ) : (
                <Text style={styles.monoBold}>
                  {rewrittenSummary}
                </Text>
              )}
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
                <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#16A34A' }}>DEMONSTRATED IN WORK EXPERIENCE</Text>
                <Text style={styles.tagPass}>{verifiedKeywords.length}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {verifiedKeywords.length > 0 ? (
                  verifiedKeywords.map((kw, idx) => (
                    <Text key={idx} style={styles.chipVerified}>{safeStr(kw)}</Text>
                  ))
                ) : (
                  <Text style={{ fontSize: 6.5, color: '#64748B', fontStyle: 'italic' }}>No verified skills identified in experience bullets.</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.col3}>
            <View style={styles.card}>
              <View style={[styles.rowBetween, { marginBottom: 3 }]}>
                <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#D97706' }}>LISTED IN SKILLS ONLY (NOT DEMONSTRATED)</Text>
                <Text style={styles.tagWarn}>{skillsOnlyKeywords.length}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {skillsOnlyKeywords.length > 0 ? (
                  skillsOnlyKeywords.map((kw, idx) => (
                    <Text key={idx} style={styles.chipSkillsOnly}>{safeStr(kw)}</Text>
                  ))
                ) : (
                  <Text style={{ fontSize: 6.5, color: '#64748B', fontStyle: 'italic' }}>None listed exclusively in skills section.</Text>
                )}
                {lockedSkillsOnlyCount > 0 && (
                  <Text style={{ fontSize: 6.2, color: '#64748B', fontStyle: 'italic' }}>
                    +{lockedSkillsOnlyCount} more locked - Book Free 1:1 Strategy Call to Unlock
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.col3}>
            <View style={styles.card}>
              <View style={[styles.rowBetween, { marginBottom: 3 }]}>
                <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#DC2626' }}>MISSING TARGET KEYWORDS (UNPROVEN)</Text>
                <Text style={styles.tagCritical}>{missingKeywords.length + lockedMissingCount}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {missingKeywords.length > 0 ? (
                  missingKeywords.map((kw, idx) => (
                    <Text key={idx} style={styles.chipMissing}>{safeStr(kw)}</Text>
                  ))
                ) : (
                  <Text style={{ fontSize: 6.5, color: '#64748B', fontStyle: 'italic' }}>No missing critical skills detected.</Text>
                )}
                {lockedMissingCount > 0 && (
                  <Text style={{ fontSize: 6.2, color: '#64748B', fontStyle: 'italic' }}>
                    +{lockedMissingCount} more locked - Book Free 1:1 Strategy Call to Unlock
                  </Text>
                )}
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

        {bulletRewrites.length > 0 ? (
          <>
            {bulletRewrites.map((b, idx) => (
            <View key={idx} style={styles.bulletBentoCard} wrap={false}>
              <View style={[styles.rowBetween, { marginBottom: 2 }]}>
                <Text style={{ fontSize: 7.8, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                  Bullet Rewrite #{idx + 1}
                </Text>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {b.evidenceStatus === 'CANDIDATE_CONFIRMED' && (
                    <Text style={[styles.tagPass, { backgroundColor: '#DCFCE7', color: '#15803D' }]}>
                      CONFIRMED METRIC
                    </Text>
                  )}
                  {b.evidenceStatus === 'CALCULATED' && (
                    <Text style={[styles.tagPass, { backgroundColor: '#EEF2FF', color: '#4338CA' }]}>
                      CALCULATED IMPACT
                    </Text>
                  )}
                  <Text style={styles.tagNeutral}>GOOGLE XYZ SYNTAX</Text>
                </View>
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

              {(b.whyItWorks || b.why || b.critique) && (
                <View style={{ marginTop: 2, paddingTop: 2, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                  {b.critique && (
                    <Text style={{ fontSize: 6.5, color: '#DC2626', marginBottom: 1 }}>
                      <Text style={{ fontFamily: 'Helvetica-Bold', color: '#991B1B' }}>Issue: </Text>
                      {safeStr(b.critique)}
                    </Text>
                  )}
                  <Text style={{ fontSize: 6.8, color: '#166534' }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: '#14532D' }}>Why it works: </Text>
                    {safeStr(b.whyItWorks || b.why || 'Restructures task description into verified Google XYZ format: Action + Technical Tool + Measurable Outcome.')}
                  </Text>
                </View>
              )}
            </View>
            ))}
            {effectiveLockedBulletsCount > 0 &&
              Array.from({ length: effectiveLockedBulletsCount }).map((_, lIdx) => (
                <View key={`locked_b_${lIdx}`} style={[styles.card, { padding: 5, marginBottom: 4 }]} wrap={false}>
                  <View style={styles.rowBetween}>
                    <Text style={{ fontSize: 7.4, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                      Bullet Rewrite #{bulletRewrites.length + lIdx + 1}
                    </Text>
                    <Text style={{ fontSize: 7, color: '#64748B', fontStyle: 'italic' }}>
                      Locked - Book Free 1:1 Call to Unlock
                    </Text>
                  </View>
                </View>
              ))}
          </>
        ) : (
          <View style={[styles.card, { padding: 12, alignItems: 'center' }]} wrap={false}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#16A34A', marginBottom: 2 }}>
              PASS: All Experience Bullets Meet Recruiter Standards
            </Text>
            <Text style={{ fontSize: 7.2, color: '#475569', textAlign: 'center' }}>
              All experience bullets meet quantification and action-verb benchmarks.
            </Text>
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────
            6. LINKEDIN STUDIO, 2x2 BENTO ABOUT & STRATEGY CALL CTA
            ───────────────────────────────────────────────────────────── */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>LinkedIn Studio & Recruiter Search SEO</Text>
          <Text style={styles.sectionTag}>PROFILE AUDIT</Text>
        </View>

        {/* Candidate LinkedIn Identity & Score Header */}
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }]} wrap={false}>
          {safeLinkedinPhoto ? (
            <Image
              src={safeLinkedinPhoto}
              style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#E2E8F0', objectFit: 'cover' }}
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#EEF2FF',
                borderWidth: 1,
                borderColor: '#C7D2FE',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#4F46E5' }}>
                {candidateInitials}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0F172A' }}>
                {candidateName}
              </Text>
              {linkedinScoreVal != null && (
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#4F46E5' }}>
                  LinkedIn Score: {Math.round(Number(linkedinScoreVal))}/100
                </Text>
              )}
            </View>
            {linkedinProfileUrl ? (
              <Link src={linkedinProfileUrl} style={{ textDecoration: 'none', marginTop: 2 }}>
                <Text style={{ fontSize: 7, color: '#6366F1' }}>{safeStr(linkedinProfileUrl)}</Text>
              </Link>
            ) : (
              <Text style={{ fontSize: 7, color: '#64748B', marginTop: 2 }}>
                Target Positioning: {targetRole}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          {Object.entries(linkedinAudit).map(([secKey, secVal]) => {
            const score = secVal?.score10 ?? 7
            const isCrit = score < 6
            const isWarn = score >= 6 && score < 8
            const title = secVal?.name || secKey.replace(/([A-Z])/g, ' $1')
            return (
              <View key={secKey} wrap={false} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 2 }}>
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
          <Text style={styles.sectionTitle}>Recruiter-Searchable Headline Options (Recruiter-SEO Optimized)</Text>
          <Text style={styles.sectionTag}>SEARCH INDEXED</Text>
        </View>

        {linkedinHeadlines.map((h, idx) => {
          if (h?.locked) {
            return (
              <View key={idx} style={[styles.card, { padding: 5, marginBottom: 4 }]} wrap={false}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                    Option 0{idx + 1}
                  </Text>
                  <Text style={{ fontSize: 7, color: '#64748B', fontStyle: 'italic' }}>
                    {safeStr(h.lockedReason, 'Locked - Book Free 1:1 Call to Unlock')}
                  </Text>
                </View>
              </View>
            )
          }
          const headlineStr = safeStr(h.headline)
          return (
            <View key={idx} style={styles.card} wrap={false}>
              <View style={[styles.rowBetween, { marginBottom: 1 }]}>
                <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                  Option 0{idx + 1} • {safeStr(h.formula || h.style || 'Best Overall • Recommended')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#64748B', backgroundColor: '#F1F5F9', paddingVertical: 1, paddingHorizontal: 3.5, borderRadius: 2 }}>
                    {headlineStr.length}/220 chars
                  </Text>
                  <Text style={styles.tagNeutral}>RECRUITER-SEO</Text>
                </View>
              </View>
              <Text style={{ fontSize: 7.6, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 1 }}>
                {headlineStr}
              </Text>
              {h.whyItWorks && (
                <Text style={{ fontSize: 6.8, color: '#64748B' }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>Why it works: </Text>
                  {safeStr(h.whyItWorks)}
                </Text>
              )}
            </View>
          )
        })}

        {/* 3-Paragraph Storytelling About Narrative */}
        <View style={styles.sectionTitleRow} minPresenceAhead={90} wrap={false}>
          <Text style={styles.sectionTitle}>Story-Driven LinkedIn About Rewrite (3-Paragraph Architecture)</Text>
          <Text style={styles.sectionTag}>~1,000 CHARACTERS</Text>
        </View>

        <View style={styles.card} wrap={false}>
          {/* Paragraph 1 */}
          <View style={[styles.aboutPillar, { marginBottom: 3 }]}>
            <Text style={styles.aboutPillarLabel}>1. PROFESSIONAL JOURNEY & CREDIBILITY HOOK</Text>
            <Text style={styles.aboutPillarText}>{journeyText}</Text>
          </View>

          {(aboutRewrite?.locked || linkedinAgent.optimizations?.aboutRewriteLocked) ? (
            <View style={styles.aboutPillar}>
              <Text style={styles.aboutPillarLabel}>2 & 3. SPECIALIZATION, PROOF & CTA</Text>
              <Text style={{ fontSize: 7, color: '#64748B', fontStyle: 'italic' }}>
                Locked - Book Free 1:1 Strategy Call to Unlock the remaining About rewrite & Experience upgrades
              </Text>
            </View>
          ) : (
            <>
              {/* Legacy Audience block if present in older saved report */}
              {Boolean(legacyAudienceText) && (
                <View style={[styles.aboutPillar, { marginBottom: 3 }]}>
                  <Text style={styles.aboutPillarLabel}>TARGET AUDIENCE & PROBLEM</Text>
                  <Text style={styles.aboutPillarText}>{legacyAudienceText}</Text>
                </View>
              )}

              {/* Paragraph 2 */}
              <View style={[styles.aboutPillar, { marginBottom: 3 }]}>
                <Text style={styles.aboutPillarLabel}>2. SPECIALIZATION & CONCRETE PROOF</Text>
                <Text style={styles.aboutPillarText}>{specializationText}</Text>
              </View>

              {/* Paragraph 3 */}
              <View style={[styles.aboutPillar, { marginBottom: aboutKeywords.length > 0 ? 3 : 0 }]}>
                <Text style={styles.aboutPillarLabel}>3. EDUCATION, DIRECTION & NETWORKING CTA</Text>
                <Text style={styles.aboutPillarText}>{networkingText}</Text>
              </View>
            </>
          )}

          {/* Keywords Weaved Footer if present & unlocked */}
          {!aboutRewrite?.locked && !linkedinAgent.optimizations?.aboutRewriteLocked && aboutKeywords.length > 0 && (
            <View style={[styles.rowBetween, { marginTop: 2, paddingTop: 3, borderTopWidth: 0.5, borderTopColor: '#E2E8F0' }]}>
              <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                INDEXED KEYWORDS WEAVED:
              </Text>
              <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica', color: '#64748B' }}>
                {aboutKeywords.slice(0, 8).join(' • ')}
              </Text>
            </View>
          )}
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
              {(linkedinAgent?.optimizations?.recommendedSkillsLocked || recommendedSkills.some((sk) => sk?.locked)) ? (
                <Text style={{ fontSize: 6.8, color: '#64748B', fontStyle: 'italic' }}>
                  Locked - Book Free 1:1 Call to Unlock
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                  {recommendedSkills.map((sk, idx) => (
                    <Text key={idx} style={styles.chipSkillsOnly}>{safeStr(sk)}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Visual Identity & Crafture Network Card */}
        <View style={styles.grid2} wrap={false}>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 }}>
                PROFILE PHOTO AI STUDIO PROMPT
              </Text>
              {(linkedinAgent?.optimizations?.visualPromptsLocked || visualPrompts?.locked) ? (
                <Text style={{ fontSize: 6.8, color: '#64748B', fontStyle: 'italic', lineHeight: 1.25 }}>
                  Locked - Book Free 1:1 Call to Unlock
                </Text>
              ) : (
                <Text style={{ fontSize: 6.8, color: '#475569', lineHeight: 1.25 }}>
                  {safeStr(visualPrompts.profilePicturePrompt || visualPrompts.profilePhotoPrompt)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.col2}>
            <View style={styles.cardHighlighted}>
              <View style={[styles.rowBetween, { marginBottom: 2 }]}>
                <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#6366F1' }}>
                  CRAFTURE NETWORK
                </Text>
                <Text style={styles.tagPass}>RECOMMENDED</Text>
              </View>
              <Text style={{ fontSize: 6.8, color: '#334155', lineHeight: 1.25 }}>
                {safeStr(networkingRec.recommendation || networkingRec.bottleneck)}
              </Text>
            </View>
          </View>
        </View>

        {/* 7. Final Conversion, Community & Socials Section (flows naturally without orphan half-empty pages) */}
        <View style={{ marginTop: 10 }}>
          <EditorialBanner imageSrc={pdfCtaBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Image src={craftureLogo} style={{ width: 15, height: 15, borderRadius: 3 }} />
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6366F1', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                {isReportUnlocked ? 'FULL REPORT UNLOCKED • NEXT STEPS' : 'EXECUTIVE PREVIEW • UNLOCK FULL ROADMAP'}
              </Text>
            </View>

            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0F172A', letterSpacing: -0.2, lineHeight: 1.25, marginTop: 4 }}>
              {isReportUnlocked
                ? `Ready to Execute Your ${targetRole} Transition Live?`
                : `Unlock Your Complete Career GPS Report & Updated ATS Resume`}
            </Text>

            <Text style={{ fontSize: 7.8, color: '#334155', lineHeight: 1.38, marginTop: 4 }}>
              {isReportUnlocked
                ? `Your full Career GPS diagnostic is unlocked. Book your complimentary 1:1 strategy session to implement your 30/60/90 roadmap live, access free career tools, and connect with our tech community.`
                : `This is a short executive preview. To unlock your complete bottleneck breakdown, full 7-day & 30/60/90 roadmap, rewritten resume bullets, free career tools & personalized guidance — book your free 1:1 strategy call.`}
            </Text>

            {/* Primary Action Row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Link
                src={bookingUrl}
                style={{
                  backgroundColor: '#6366F1',
                  borderRadius: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 11,
                  textDecoration: 'none',
                }}
              >
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>
                  Book Free 1-on-1 Strategy Call {'->'}
                </Text>
              </Link>

              <Link
                src={whatsappUrl}
                style={{
                  backgroundColor: '#059669',
                  borderRadius: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 11,
                  textDecoration: 'none',
                }}
              >
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>
                  Connect on WhatsApp
                </Text>
              </Link>

              {showCommunityCta && (
                <Link
                  src={communityUrl}
                  style={{
                    backgroundColor: '#0F172A',
                    borderRadius: 6,
                    paddingVertical: 7,
                    paddingHorizontal: 11,
                    textDecoration: 'none',
                  }}
                >
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>
                    {communityLabel} {'->'}
                  </Text>
                </Link>
              )}
            </View>
          </EditorialBanner>

          {/* Free Career Resources & Community Card */}
          <View style={[styles.card, { marginTop: 12, padding: 10 }]} wrap={false}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 4 }}>
              What You Get on Your Free 1:1 Strategy Session
            </Text>
            <Text style={{ fontSize: 7.4, color: '#475569', lineHeight: 1.4 }}>
              • Full line-by-line ATS bullet rewrites &amp; recruiter keyword calibration for {targetRole}{'\n'}
              • Complete 7-Day Rapid Triage &amp; 30/60/90-Day Milestone Execution Roadmap{'\n'}
              • Free career tools, interview prep frameworks &amp; personalized guidance
            </Text>
          </View>

          {/* Company Social Media Footer (Strictly gated by Admin socialLinksConfig.enabled) */}
          {socialMasterEnabled && activeSocialItems.length > 0 && (
            <View
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: '#E2E8F0',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              wrap={false}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Image src={craftureLogo} style={{ width: 14, height: 14, borderRadius: 3 }} />
                <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: '#334155' }}>
                  Crafture Career GPS
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {activeSocialItems.map((item) => {
                  const hasValidCustomLogo =
                    typeof item.customLogoUrl === 'string' &&
                    (/^data:image\/(png|jpeg|jpg);base64,/i.test(item.customLogoUrl) ||
                      /^https?:\/\/.+\.(png|jpe?g)(\?.*)?$/i.test(item.customLogoUrl))
                  const iconColor =
                    item.iconType === 'linkedin'
                      ? '#0A66C2'
                      : item.iconType === 'instagram'
                        ? '#E1306C'
                        : item.iconType === 'youtube'
                          ? '#DC2626'
                          : item.iconType === 'x'
                            ? '#0F172A'
                            : '#4F46E5'
                  return (
                    <Link key={item.key || item.label} src={item.url} style={{ textDecoration: 'none', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {hasValidCustomLogo ? (
                        <Image src={item.customLogoUrl} style={{ width: 11, height: 11, borderRadius: 2, objectFit: 'contain' }} />
                      ) : (
                        <Svg width={10} height={10} viewBox="0 0 24 24">
                          {item.iconType === 'linkedin' && (
                            <Path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" fill={iconColor} />
                          )}
                          {item.iconType === 'instagram' && (
                            <Path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill={iconColor} />
                          )}
                          {item.iconType === 'youtube' && (
                            <Path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" fill={iconColor} />
                          )}
                          {(item.iconType === 'website' || item.iconType === 'x' || item.iconType === 'custom') && (
                            <Path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8M12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96M4.26 14A8.1 8.1 0 0 1 4 12c0-.69.09-1.36.26-2h3.38a16.52 16.52 0 0 0-.14 2c0 .68.05 1.35.14 2H4.26m.81 2h2.95a15.65 15.65 0 0 0 1.38 3.56A8.03 8.03 0 0 1 5.07 16m2.95-8H5.07a8.03 8.03 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.02 8M12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96M14.34 14H9.66a14.7 14.7 0 0 1-.16-2c0-.68.06-1.35.16-2h4.68c.1.65.16 1.32.16 2 0 .68-.06 1.35-.16 2m.26 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56M16.36 14c.09-.65.14-1.32.14-2 0-.68-.05-1.35-.14-2h3.38c.17.64.26 1.31.26 2 0 .69-.09 1.36-.26 2h-3.38z" fill={iconColor} />
                          )}
                        </Svg>
                      )}
                      <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: iconColor }}>
                        {item.label}
                      </Text>
                    </Link>
                  )
                })}
              </View>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
