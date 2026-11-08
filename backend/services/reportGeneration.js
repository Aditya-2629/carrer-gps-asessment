/**
 * Report Generation Service — the shared engine behind both the blocking
 * controller and the async ReportJob worker (Phase C).
 *
 * Flow: prep (scrape/RAG) → [Atlas narrative ‖ orchestrator agents] →
 * attach agent bundle → persist to User → admin email.
 *
 * onProgress(stage, message) lets callers (job worker) stream live status.
 */

import mongoose from 'mongoose'
import User from '../models/User.js'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import { sendAdminReportEmail } from '../utils/adminEmails.js'
import { scrapeLinkedInProfile } from '../utils/apifyLinkedInScraper.js'
import { scrapeLinkedInPosts } from '../utils/apifyLinkedInPostsScraper.js'
import { buildRAGContext, buildSmartQuery } from '../utils/ragEngine.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'
import dynamicCompetencyClusterizer from '../agents/resume/market/dynamicCompetencyClusterizer.js'
import { runCareerAgents } from '../agents/orchestrator.js'
import { evaluateLinkedIn } from '../agents/linkedin/linkedinAgent.js'
import { judgeReport } from '../agents/judge/judgeAgent.js'
import { evaluateAssessmentPersona, parseRangeOrNumber } from '../agents/assessment/assessmentAgent.js'
import { weaveKeywordsAndBuildLedger } from '../agents/resume/market/smartKeywordWeaver.js'
import { inferRoleFromKeywordFrequency } from '../agents/resume/resumeAgent.normalizer.js'
import AgentRun from '../models/AgentRun.js'
import ReportJob from '../models/ReportJob.js'
import { jsonrepair } from 'jsonrepair'
import {
  build7DayRapidTriageSprint,
  buildGamifiedMissionBoard,
  build30_60_90MilestonePathway,
  buildStandard4WeekRoadmap,
} from './atlasDeterministicBuilders.js'

/**
 * Builds a dense, standardized candidate executive digest (~350 tokens)
 * replacing massive raw answer JSON dumps and saving ~70% prompt tokens.
 */
export function buildCompactAtlasDigest({ user, activeResumeAgent, activeLinkedinAgent, targetRole, phase }) {
  const ans = user?.answers || user || {}
  const canonical = activeResumeAgent?.canonicalResume || user?.resumeJson || {}
  const rawSkills = canonical?.skills || activeResumeAgent?.verifiedSkills || []
  const verifiedSkills = (Array.isArray(rawSkills) ? rawSkills.map((s) => (typeof s === 'string' ? s : s?.name || s?.skill)).filter(Boolean) : []).slice(0, 15).join(', ')

  const rawMissing = activeResumeAgent?.keywordAlignment?.missingKeywords || activeResumeAgent?.missingTargetKeywords || []
  const missingSkills = (Array.isArray(rawMissing) ? rawMissing.map((k) => (typeof k === 'string' ? k : k?.keyword || k?.name)).filter(Boolean) : []).slice(0, 6).join(', ')

  const topDiscrepancy = activeLinkedinAgent?.discrepancies?.[0]?.title || 'None'

  const apps30d = ans.apps30d || ans.applications30d || ans.applications_count || 0
  const screens = ans.funnel90d?.recruiterScreens || ans.recruiterScreens || ans.recruiter_calls_count || 0
  const oas = ans.funnel90d?.assessments || ans.assessments || 0
  const offers = ans.funnel90d?.offers || ans.offers || ans.offers_count || 0
  const visa = ans.visa || ans.visaStatus || 'Citizen / Unrestricted'
  const dropOff = ans.DropOffStage || ans.primaryBottleneck || 'Low recruiter callback rate'

  return `### CANDIDATE EXECUTIVE DIGEST
Target Role: ${targetRole || 'Software Professional'}
Detected Bottleneck Phase: Phase ${phase?.id || 1} (${phase?.name || 'Resume Screen'})
90-Day Funnel: ${apps30d} apps/mo | ${screens} screens | ${oas} OAs | ${offers} offers
Visa / Work Auth: ${visa}
Top Verified Skills: ${verifiedSkills || 'Engineering fundamentals'}
Critical Skill Gaps: ${missingSkills || 'None'}
Primary LinkedIn Flag: ${topDiscrepancy}
Candidate Drop-off Note: "${dropOff}"`
}

// ── Atlas completeness machinery (fixes truncated/incomplete reports) ───────
// The Atlas JSON is large (14 sections); without an explicit output budget
// models truncate it and whole widgets (funnel, risk heatmap, mission board)
// silently vanish. We now: budget 6144 output tokens, repair-parse, verify
// 14-section completeness, and retry once when the draft is incomplete.

export const ATLAS_SCHEMA_KEYS = [
  'career_health_score',
  'score_label',
  'score_breakdown',
  'market_reality_check',
  'career_journey',
  'funnel_stages',
  'rejection_factors',
  'rejection_insight',
  'risk_heatmap',
  'mission_board',
  'critical_issues',
  'roadmap',
  'recommended_tools',
  'coach_intervention',
]

export const ATLAS_ARRAY_SECTIONS = ['roadmap', 'critical_issues', 'rejection_factors', 'recommended_tools']

function atlasCompleteness(report) {
  if (!report || typeof report !== 'object') return 0
  let score = 0

  if (report.career_health_score !== undefined && report.career_health_score !== null && report.career_health_score !== '') score += 1
  if (typeof report.score_label === 'string' && report.score_label.trim().length > 0) score += 1
  if (report.score_breakdown && typeof report.score_breakdown === 'object' && !Array.isArray(report.score_breakdown) && Object.keys(report.score_breakdown).length > 0) score += 1
  if (report.market_reality_check && typeof report.market_reality_check === 'object' && !Array.isArray(report.market_reality_check) && Object.keys(report.market_reality_check).length > 0) score += 1
  if (report.career_journey && typeof report.career_journey === 'object' && !Array.isArray(report.career_journey) && Object.keys(report.career_journey).length > 0) score += 1
  if (report.funnel_stages && typeof report.funnel_stages === 'object' && !Array.isArray(report.funnel_stages) && Object.keys(report.funnel_stages).length > 0) score += 1
  if (Array.isArray(report.rejection_factors) && report.rejection_factors.length > 0) score += 1
  if (typeof report.rejection_insight === 'string' && report.rejection_insight.trim().length > 0) score += 1
  if (report.risk_heatmap && typeof report.risk_heatmap === 'object' && !Array.isArray(report.risk_heatmap) && Object.keys(report.risk_heatmap).length > 0) score += 1
  if (report.mission_board && typeof report.mission_board === 'object' && !Array.isArray(report.mission_board) && Object.keys(report.mission_board).length > 0) score += 1
  if (Array.isArray(report.critical_issues) && report.critical_issues.length > 0) score += 1
  if (Array.isArray(report.roadmap) && report.roadmap.length > 0) score += 1
  if (Array.isArray(report.recommended_tools) && report.recommended_tools.length > 0) score += 1
  if (report.coach_intervention && typeof report.coach_intervention === 'object' && !Array.isArray(report.coach_intervention) && Object.keys(report.coach_intervention).length > 0) score += 1

  return score
}

function parseAtlasJson(text) {
  let cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim()
  const firstBrace = cleaned.indexOf('{')
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace)
  }
  try {
    return JSON.parse(cleaned)
  } catch (_e) {
    return JSON.parse(jsonrepair(cleaned)) // truncation artifacts & auto-healing
  }
}

export function mergeReportSections(primary = {}, fallback = {}) {
  if (!primary || typeof primary !== 'object') return fallback || {}
  if (!fallback || typeof fallback !== 'object') return primary

  const merged = { ...primary }

  for (const key of ATLAS_SCHEMA_KEYS) {
    const val = merged[key]
    const isMissing =
      val === undefined ||
      val === null ||
      (typeof val === 'string' && val.trim().length === 0) ||
      (Array.isArray(val) && val.length === 0) ||
      (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0)

    if (isMissing && fallback[key] !== undefined && fallback[key] !== null) {
      const fbVal = fallback[key]
      const fbValid =
        (typeof fbVal === 'string' && fbVal.trim().length > 0) ||
        (Array.isArray(fbVal) && fbVal.length > 0) ||
        (typeof fbVal === 'object' && !Array.isArray(fbVal) && Object.keys(fbVal).length > 0) ||
        typeof fbVal === 'number'

      if (fbValid) {
        merged[key] = fbVal
      }
    }
  }

  return merged
}

export function deCycle(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  const seen = new WeakSet()
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (key === 'resumeContext' || (typeof key === 'string' && key.startsWith('$')) || key === '_doc') {
        return undefined
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined
        seen.add(value)
      }
      return value
    })
  )
}

export { parseAtlasJson, atlasCompleteness }

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
    const num = parseRangeOrNumber(rawVal, fallbackNum)
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
  const parsed = parseRangeOrNumber(val, fallbackNum)
  const period = /week/i.test(String(val)) ? 'week' : /month/i.test(String(val)) ? 'month' : defaultPeriod
  return {
    rawNum: parsed,
    period,
    perWeek: period === 'week' ? parsed : Math.round((parsed / 4.33) * 10) / 10,
    perMonth: period === 'month' ? parsed : Math.round(parsed * 4.33),
    label: `${parsed} per ${period}`,
  }
}

export function deriveFunnelFromAnswers(answers = {}) {
  const f90 = (answers.funnel90d && typeof answers.funnel90d === 'object') ? answers.funnel90d : {}

  // 1. Deep extraction of applications (preventing digit-concatenation bugs like "30-60" -> 3060)
  const apps30d = parseRangeOrNumber(
    answers.apps30d ?? answers.applications_count ?? (answers.appsWeek ? answers.appsWeek * 4.33 : null),
    60
  )
  let totalApps90d = parseRangeOrNumber(
    f90.applications90d ?? answers.applications90d ?? (apps30d * 3),
    180
  )
  // Sanity check: single candidate 90-day applications over 1500 is an input anomaly/concatenation -> cap at 300 max
  if (totalApps90d > 1500) {
    totalApps90d = Math.min(Math.round(totalApps90d / 10), 300)
  }

  // 2. Deep extraction of interview stages
  const recruiterScreens = parseRangeOrNumber(
    f90.recruiterScreens ?? f90.screens ?? answers.recruiterScreens ?? answers.humanScreen ?? 0
  )
  const assessments = parseRangeOrNumber(
    f90.assessments ?? answers.assessments ?? answers.oas ?? 0
  )
  const aiInterviews = parseRangeOrNumber(
    f90.aiInterviews ?? answers.aiInterviews ?? 0
  )
  const technicalRounds = parseRangeOrNumber(
    f90.technicalRounds ?? f90.technicals ?? answers.technicalRounds ?? answers.technical ?? 0
  )
  const finalRounds = parseRangeOrNumber(
    f90.finalRounds ?? f90.finals ?? answers.finalRounds ?? answers.finals ?? 0
  )
  const offers = parseRangeOrNumber(
    f90.offers ?? answers.offers ?? 0
  )
  const outreach = parseRangeOrNumber(
    answers.outreach ?? answers.recruiter_outreach_count ?? answers.coldEmails ?? 0
  )

  const totalScreens = recruiterScreens + assessments + aiInterviews > 0
    ? recruiterScreens + assessments + aiInterviews
    : recruiterScreens

  // 3. Conversion rates
  const appToScreenRate = totalApps90d > 0 ? (totalScreens / totalApps90d) * 100 : 0
  const screenToTechRate = totalScreens > 0 ? (technicalRounds / totalScreens) * 100 : 0
  const techToFinalRate = technicalRounds > 0 ? (finalRounds / technicalRounds) * 100 : 0
  const finalToOfferRate = finalRounds > 0 ? (offers / finalRounds) * 100 : 0

  // 4. Six US-tech leak stages diagnosis
  let biggest_leak_stage = 'top_of_funnel'
  let leak_title = 'Top-of-Funnel Application Black Hole'
  let diagnosis_message = `You submitted ${totalApps90d} applications yielding only ${totalScreens} recruiter screens (${appToScreenRate.toFixed(1)}% conversion rate), indicating ATS keyword filtering or cold portal black holes.`

  if (totalApps90d > 80 && totalScreens < 3) {
    diagnosis_message = 'The Cold Portal Lottery Trap — Relying on Easy Apply volume without direct hiring manager outreach or targeted ATS customization.'
  }

  if (totalApps90d < 15 && totalScreens === 0) {
    biggest_leak_stage = 'readiness_stall'
    leak_title = 'Application Readiness & Search Inactivity'
    diagnosis_message = 'Pipeline has stalled before launch with under 15 applications and 0 recruiter screens. Focus on resume tailoring and initiating active outreach.'
  } else if (offers >= 1) {
    biggest_leak_stage = 'offer_onboarding'
    leak_title = 'Offer Decision & Negotiation Strategy'
    diagnosis_message = 'You have secured at least one formal offer. Focus on compensation benchmarking, multiple offer leverage, and final team alignment.'
  } else if (finalRounds >= 1 && offers === 0) {
    biggest_leak_stage = 'final_round_drop'
    leak_title = 'Final Executive & Hiring Manager Conversion'
    diagnosis_message = 'Reaching final rounds indicates strong technical baseline, but converting to written offers requires sharper executive alignment and strategic business ROI demonstration.'
  } else if (totalScreens > 5 && technicalRounds === 0) {
    biggest_leak_stage = 'recruiter_screen'
    leak_title = 'Recruiter Screen to Hiring Manager Handoff'
    diagnosis_message = 'The Elevator Pitch / Storytelling Deficit — Getting the call but failing to articulate architectural trade-offs during the initial 15-minute phone screen.'
  } else if (totalScreens >= 4 && technicalRounds <= 1 && screenToTechRate <= 20) {
    biggest_leak_stage = 'recruiter_screen'
    leak_title = 'Recruiter Screen to Hiring Manager Handoff'
    diagnosis_message = 'Recruiter screens are occurring, but failure to advance to technical rounds signals a disconnect in salary alignment, visa sponsorship clarity, or behavioral positioning.'
  } else if (technicalRounds >= 1 && finalRounds === 0) {
    biggest_leak_stage = 'technical_round'
    leak_title = 'Technical Architecture & Coding Assessments'
    diagnosis_message = 'Clearing recruiter screens confirms resume credibility, but dropping out at technical/system design rounds points to live problem-solving friction.'
  } else if (totalScreens >= 3 && technicalRounds === 0) {
    biggest_leak_stage = 'recruiter_screen'
    leak_title = 'Recruiter Screen to Hiring Manager Handoff'
    diagnosis_message = 'Recruiter screens are occurring, but failure to advance to technical rounds signals a disconnect in salary alignment, visa sponsorship clarity, or behavioral positioning.'
  }

  return {
    applications_count: totalApps90d,
    applications_period: '90d',
    applications30d: apps30d,
    applications90d: totalApps90d,
    outreach_count: outreach,
    outreach_period: 'month',
    recruiter_calls_count: recruiterScreens,
    recruiterScreens,
    assessments,
    aiInterviews,
    totalScreens,
    interviews_count: technicalRounds || totalScreens,
    technicalRounds,
    final_rounds_count: finalRounds,
    finalRounds,
    offers_count: offers,
    offers,
    rates: {
      appToScreenRate: Math.round(appToScreenRate * 10) / 10,
      screenToTechRate: Math.round(screenToTechRate * 10) / 10,
      techToFinalRate: Math.round(techToFinalRate * 10) / 10,
      finalToOfferRate: Math.round(finalToOfferRate * 10) / 10,
    },
    biggest_leak_stage,
    leak_title,
    diagnosis_message,
  }
}

/**
 * Fixes common LLM shape deviations so the frontend always gets the contract
 * shape. Ensures objects (funnel_stages, mission_board, risk_heatmap) retain
 * their object schemas and arrays are coerced safely.
 */
export function normalizeAtlasShapes(report, answers = {}) {
  if (!report || typeof report !== 'object') return report

  // mission_board: wrap into object if array, or build if missing
  if (Array.isArray(report.mission_board)) {
    report.mission_board = {
      xp_level: 'Level 3: Active Strategist',
      xp_current: 500,
      xp_progress: '500 / 1000 XP',
      missions: report.mission_board,
    }
  } else if (!report.mission_board || typeof report.mission_board !== 'object') {
    report.mission_board = buildGamifiedMissionBoard([], report.career_journey?.current_phase_id || 1, report.career_health_score || 70)
  }

  // roadmap: ensure 4-week roadmap is present
  if (!report.roadmap || !Array.isArray(report.roadmap) || report.roadmap.length === 0) {
    report.roadmap = buildStandard4WeekRoadmap(report.career_journey?.current_phase_id || 1)
  }

  // risk_heatmap / risk_matrix normalization and fallback
  if (Array.isArray(report.risk_matrix) && report.risk_matrix.length > 0) {
    report.risk_matrix = report.risk_matrix.map((r) => ({
      risk: r.risk || r.factor || 'Market Friction & Application Stall',
      factor: r.factor || r.risk || 'Market Friction & Application Stall',
      severity: r.severity || 'Medium',
      mitigation: r.mitigation || 'Activate direct hiring manager outbound immediately.',
    }))
  }
  if (!report.risk_heatmap && Array.isArray(report.risk_matrix) && report.risk_matrix.length > 0) {
    const primaryRisk = report.risk_matrix[0]
    const riskText = primaryRisk.risk || primaryRisk.factor || 'Market Friction and Application Stall'
    report.risk_heatmap = {
      critical_risk: `${riskText}: ${primaryRisk.mitigation || 'Active mitigation required'}`,
      high_impact_low_likelihood: report.risk_matrix.slice(1, 3).map((r) => r.risk || r.factor || 'Extended hiring team deliberation'),
      low_impact_high_likelihood: ['Delayed recruiter screening feedback'],
      mitigation_plan: primaryRisk.mitigation || 'Activate direct hiring manager outbound immediately.',
    }
  }

  // funnel_stages: ensure object shape and anchor to deep userFunnel
  const userFunnel = deriveFunnelFromAnswers(answers)
  if (!report.funnel_stages || Array.isArray(report.funnel_stages) || typeof report.funnel_stages !== 'object') {
    report.funnel_stages = { ...userFunnel }
  } else {
    report.funnel_stages = {
      ...userFunnel,
      ...report.funnel_stages,
      // Anchor critical diagnostic fields to userFunnel while preserving model specifics if present
      biggest_leak_stage: report.funnel_stages.biggest_leak_stage || userFunnel.biggest_leak_stage,
      leak_title: report.funnel_stages.leak_title || userFunnel.leak_title,
      diagnosis_message: report.funnel_stages.diagnosis_message || userFunnel.diagnosis_message,
      rates: userFunnel.rates,
    }
  }

  // Monotonic validation without wiping or mutating valid candidate counts
  if (report.funnel_stages && typeof report.funnel_stages === 'object') {
    let fApps = Number(report.funnel_stages.applications_count) || userFunnel.applications_count
    if (fApps > 1500) {
      fApps = Math.min(Math.round(fApps / 10), 300)
    }
    report.funnel_stages.applications_count = fApps
    report.funnel_stages.biggest_leak_stage = report.funnel_stages.biggest_leak_stage || userFunnel.biggest_leak_stage
    report.funnel_stages.leak_title = report.funnel_stages.leak_title || userFunnel.leak_title
    report.funnel_stages.diagnosis_message = report.funnel_stages.diagnosis_message || userFunnel.diagnosis_message
    report.funnel_stages.rates = userFunnel.rates
  }

  for (const key of ATLAS_ARRAY_SECTIONS) {
    const v = report[key]
    if (v && !Array.isArray(v) && typeof v === 'object') {
      // object-of-items → array of {name, ...item}
      report[key] = Object.entries(v).map(([k, val]) =>
        val && typeof val === 'object' && !Array.isArray(val) ? { name: k, ...val } : { name: k, value: val }
      )
    } else if (v !== undefined && v !== null && !Array.isArray(v)) {
      report[key] = [v]
    }
  }

  // career_journey must be an object — if an array came back, take the first item
  if (Array.isArray(report.career_journey)) {
    report.career_journey = report.career_journey[0] || null
  }

  // Ensure "Execution Bridge" CTA is dynamically anchored to funnel_stages.leak_title with overwrite protection
  if (!report.coach_intervention || typeof report.coach_intervention !== 'object') {
    report.coach_intervention = {}
  }
  const leakTitle =
    report.funnel_stages?.leak_title ||
    userFunnel.leak_title ||
    report.funnel_stages?.biggest_leak_stage ||
    'Technical & System Design Rounds'
  const leakStage = report.funnel_stages?.biggest_leak_stage || userFunnel.biggest_leak_stage || ''
  const targetRole = answers.targetRole || answers.role || report.target_role || ''

  if (!report.coach_intervention.urgency_statement || report.coach_intervention.urgency_statement.length < 30) {
    const roleClause = targetRole ? ` for ${targetRole}` : ''
    const stageCitation = (leakStage && leakStage !== leakTitle && !leakTitle.toLowerCase().includes(leakStage.toLowerCase()))
      ? `${leakTitle} [${leakStage}]`
      : leakTitle
    report.coach_intervention.urgency_statement = `Polished resume bullets alone cannot solve interview drop-offs at ${stageCitation}${roleClause}. Bypassing cold portal filters requires an active hiring manager referral engine and live project architecture defense.`
  }
  if (!report.coach_intervention.value_prop || report.coach_intervention.value_prop.length < 30) {
    report.coach_intervention.value_prop = `In your 1-on-1 Strategy Call, we map your 30-day direct outbound pipeline to verified engineering leads, resolve cross-document verification flags, and run live mock evaluations on your top architecture projects.`
  }
  report.coach_intervention.cta_text = 'Book Free 1-on-1 Strategy Session'

  return report
}

// Executive Coach Persona & Tone Directives (David / Elena — Tough-Love Managing Partner)
export const ATLAS_EXECUTIVE_COACH_SYSTEM_PROMPT = `
==================================================
PERSONA & TONE DIRECTIVE:
==================================================
You are David / Elena — Managing Partner at an elite US executive career search firm. You have guided 1,500+ engineers from senior individual contributors to Staff Engineers, Engineering Leads, and VPs.

Your coaching philosophy is TOUGH LOVE:
- Warm, grounded, and deeply empathetic to the candidate's hard work and enterprise grit.
- Brutally honest and candid about why their current pipeline is stalling. No sugarcoating, no corporate jargon.
- Address the candidate directly by first name in the second person ("you", "your").
- Never sound like an algorithmic ATS bot, a stiff corporate audit, or an academic researcher.

==================================================
EXECUTIVE RECRUITER DIAGNOSTIC FRAMEWORK (ZERO-SLOP, ZERO-FLATTERY):
==================================================
STRICT BAN ON GENERIC CHATGPT FLATTERY & HOLLOW PRAISE:
- NEVER open with praise, corporate filler, or hollow validation:
  * BANNED: "You have built a solid foundation across major enterprise domains like..."
  * BANNED: "Your background shows a practical progression across..."
  * BANNED: "Your resume demonstrates clear technical competence..."
  * BANNED: "With your impressive background in..."
  * BANNED: "Your experience proves you can write solid code..."
- DIRECT EXECUTIVE DIAGNOSTIC READ (MANDATORY):
  Cut straight to the recruiter's unfiltered diagnostic read in sentence 1:
  "You have [X] years in [industry/domain], but your bullets read like a junior maintenance developer. Only [Y] of [Z] bullets contain numbers. Here is your exact fix."
  Contrast their verified seniority/years of experience against how a 6-second recruiter screen perceives their resume right now.

==================================================
PROGRESSIVE DISCLOSURE & DEDUPLICATION (MANDATORY):
==================================================
DO NOT repeat the exact same defect title, company name, or diagnosis verbatim across multiple sections!
Every section MUST provide a UNIQUE, PROGRESSIVE insight:
1. executive_verdict: High-level market positioning reality (Seniority perception vs Market reality).
2. primary_bottleneck: Funnel drop-off gate (Behavioral conversion failure — e.g. cold portal lottery trap, screening pitch stall).
3. critical_issues: 3 distinct, non-overlapping operational defects:
   - Issue 1: High-level narrative / positioning defect (e.g. Vendor framing vs Client ownership).
   - Issue 2: Concrete technical evidence gap (e.g. Unverified distributed systems or cloud tools).
   - Issue 3: Search visibility / outbound strategy gap (e.g. Missing boolean search keywords or 0 referral outreach).
4. rejection_factors: 3 unique candidate drop-off causes (e.g. automated ATS knockout, recruiter phone screen lack of ownership, compensation/visa misalignment).
5. risk_matrix: Forward-looking career threats (e.g. Market saturation for target role, work authorization timeline, title down-leveling).

==================================================
BEHAVIORAL FUNNEL LEAK & RISK MATRIX DIRECTIVES:
==================================================
1. Funnel Leak Diagnosis (funnel_stages.diagnosis_message):
   - Prohibit generic math repetitions like "Conversion rate is 5.6% which is low".
   - Enforce behavioral diagnosis:
     * If applications > 80 and recruiter screens < 3: Diagnose as "The Cold Portal Lottery Trap — Relying on Easy Apply volume without direct hiring manager outreach or targeted ATS customization."
     * If recruiter screens > 5 and technical rounds = 0: Diagnose as "The Elevator Pitch / Storytelling Deficit — Getting the call but failing to articulate architectural trade-offs during the initial 15-minute phone screen."
2. Risk Matrix (What Are My Biggest Job Search Risks?):
   - Frame risks with real career implications (e.g. F1 OPT timeline pressure, market compensation mismatch, recruiter misinterpretation of contract staffing vs client framing).
   - Each risk item in risk_matrix MUST include:
     * "risk": Clear, un-minced threat statement.
     * "mitigation": 1 pragmatic, immediately executable counter-measure.

==================================================
BANNED ROBOTIC CLICHÉS & AI BUZZWORDS:
==================================================
Strictly FORBID using: "spearheaded", "leveraged", "synergistic", "cutting-edge", "results-driven", "passionate", "pivotal", "delve", "testament to", "navigating the job market", "in conclusion", "it is crucial", "synergies", "holistic".
`

// Every Atlas call carries this contract — array sections are non-negotiable
// for the dashboard widgets, and models deviate without it.
export const ATLAS_FORMAT_CONTRACT = `
${ATLAS_EXECUTIVE_COACH_SYSTEM_PROMPT}

FORMAT CONTRACT (strict):
- critical_issues, rejection_factors, recommended_tools MUST be JSON ARRAYS of objects.
- funnel_stages, risk_heatmap, career_journey, market_reality_check, score_breakdown, coach_intervention MUST be JSON OBJECTS matching the exact keys in the prompt schema.
- Synthesize dynamic strategic sections: career_health_score, score_label, key_advantage, primary_bottleneck, executive_verdict, risk_matrix, top_priorities, critical_issues, market_reality_check.
- career_journey MUST be a single object: {"current_phase_id": "...", "guide_message": "..."}.
- Never merge sections. Return valid JSON only.`

/**
 * Renders the complete Atlas Master Report prompt combining candidate profile context
 * and executive coach formatting contracts.
 */
export function renderAtlasPrompt(userData = {}, resumeData = null, options = {}) {
  const promptText = getGeminiPrompt(
    userData,
    resumeData,
    options.linkedinData || null,
    options.dynamicKnowledgeBase || null,
    options.semanticProfile || null,
    options.resumeAgent || null,
    options.linkedinAgent || null,
    options.assessmentPersona || null,
    options.userAnswers || userData?.answers || userData,
    options.compactDigest || null
  )
  return promptText + ATLAS_FORMAT_CONTRACT
}

export async function callAtlas(promptText, extraInstructions = '', userAnswers = {}) {
  const executiveDirective = '\n\nIMPORTANT: Return raw JSON only. Zero markdown backticks. Write with the authoritative tough-love voice of David / Elena — elite executive career coach.'
  const combinedInstructions = `${extraInstructions}${executiveDirective}`
  const estimatedPromptTokens = Math.round((promptText.length + ATLAS_FORMAT_CONTRACT.length + combinedInstructions.length) / 4)
  console.log(`[ReportGeneration] Calling Atlas with prompt size ~${estimatedPromptTokens} tokens (${promptText.length} chars)`)

  const startTime = Date.now()
  let modelUsed = 'google/gemini-2.5-flash-lite'
  let fallbackTriggered = false
  let responseText = null

  try {
    const res = await llmGateway.generate({
      purpose: 'assessment_report',
      task: 'report_generation',
      preferredProvider: 'openrouter',
      model: 'google/gemini-2.5-flash-lite',
      systemPrompt: ATLAS_EXECUTIVE_COACH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + combinedInstructions }],
      responseFormat: 'json_object',
      temperature: 0.2,
      maxTokens: 8192,
      maxRetries: 2,
      timeoutMs: 50000,
    })
    responseText = res.text
    modelUsed = res.actualModel || 'google/gemini-2.5-flash-lite'
  } catch (primaryErr) {
    console.warn('[ReportGeneration] Gemini 2.5 Flash Lite failed, routing to Gemini 3.5 Flash Lite:', primaryErr.message)
    fallbackTriggered = true
    try {
      const res = await llmGateway.generate({
        purpose: 'assessment_report',
        task: 'report_generation',
        preferredProvider: 'openrouter',
        model: 'google/gemini-3.5-flash-lite',
        systemPrompt: ATLAS_EXECUTIVE_COACH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + combinedInstructions }],
        responseFormat: 'json_object',
        temperature: 0.2,
        maxTokens: 8192,
        maxRetries: 2,
        timeoutMs: 50000,
      })
      responseText = res.text
      modelUsed = res.actualModel || 'google/gemini-3.5-flash-lite'
    } catch (fallback1Err) {
      console.warn('[ReportGeneration] Gemini 3.5 Flash Lite failed, falling back to Gemini 3 Flash Preview:', fallback1Err.message)
      const res = await llmGateway.generate({
        purpose: 'assessment_report',
        task: 'report_generation',
        preferredProvider: 'openrouter',
        model: 'google/gemini-3-flash-preview',
        systemPrompt: ATLAS_EXECUTIVE_COACH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + combinedInstructions }],
        responseFormat: 'json_object',
        temperature: 0.2,
        maxTokens: 8192,
        maxRetries: 2,
        timeoutMs: 50000,
      })
      responseText = res.text
      modelUsed = res.actualModel || 'google/gemini-3-flash-preview'
    }
  }

  const durationMs = Date.now() - startTime
  const normalized = normalizeAtlasShapes(parseAtlasJson(responseText), userAnswers)
  const telemetry = {
    durationMs,
    modelUsed,
    fallbackTriggered,
  }
  normalized._telemetry = telemetry
  normalized.telemetry = telemetry
  normalized.report = normalized
  return normalized
}

export function performDeterministicTriage(assessmentData = {}) {
  const resumeFacts = assessmentData.resumeFacts || assessmentData.resumeData || {};
  const marketJds = assessmentData.marketJds || assessmentData.jobDescriptions || [];
  const targetRole = assessmentData.targetRole || resumeFacts.targetRole || 'Specialist';
  const scrapedSkills = assessmentData.scrapedSkills || assessmentData.marketSkills || [];

  const candidateSkills = (resumeFacts.skills || []).map((s) =>
    (typeof s === 'string' ? s : s?.name || '')
  ).filter(Boolean);

  const jdTexts = marketJds.map((jd) => {
    if (typeof jd === 'string') return jd;
    return jd.description || jd.rawText || jd.text || '';
  }).filter(Boolean);

  const clusterResult = dynamicCompetencyClusterizer.processDynamicClustering({
    jdTexts,
    rawSkills: scrapedSkills,
    candidateSkills
  });

  const experienceYears = Number(
    resumeFacts.totalExperienceYears || resumeFacts.experienceYears || 0
  );
  const bulletPoints = resumeFacts.bulletPoints || resumeFacts.experienceBullets || [];
  const quantifiedBullets = bulletPoints.filter((b) =>
    /\d+%|\$\d+|\b\d+\b/g.test(typeof b === 'string' ? b : b?.text || '')
  ).length;
  const quantificationRatio =
    bulletPoints.length > 0 ? quantifiedBullets / bulletPoints.length : 0;

  return {
    targetRole,
    experienceYears,
    quantificationRatio: Math.round(quantificationRatio * 100),
    totalBulletPoints: bulletPoints.length,
    candidateSkills,
    clustering: clusterResult.evaluation,
    rawClusters: clusterResult.clusters,
    bulletPoints: bulletPoints.map((b) => (typeof b === 'string' ? b : b?.text || '')).slice(0, 10)
  };
}

export async function generateReportBundle(assessmentData = {}, options = {}) {
  const startTime = Date.now();
  let user = null;

  // Dual-mode compatibility: support { userId } from assessmentController.js / reportJobRoutes.js
  let effectiveData = { ...assessmentData };
  const userId = assessmentData.userId;
  if (userId && !assessmentData.resumeFacts && !assessmentData.targetRole) {
    user = await User.findById(userId);
    if (user) {
      const answers = user.answers || {};
      const resumeJson = user.resumeJson || {};
      const expBullets = (resumeJson.experience || resumeJson.experiences || []).flatMap((e) =>
        (e.bullets || []).map((b) => (typeof b === 'string' ? b : b?.text || ''))
      );

      effectiveData = {
        targetRole: answers.targetRole || resumeJson.target_role || user.targetRole || 'Specialist',
        resumeFacts: {
          skills: resumeJson.skills || answers.skills || [],
          experienceYears: resumeJson.totalExperienceYears || answers.experienceYears || 3,
          bulletPoints: expBullets.length > 0 ? expBullets : ['Delivered strategic projects and led cross-functional execution.']
        },
        marketJds: assessmentData.marketJds || [],
        scrapedSkills: assessmentData.scrapedSkills || (resumeJson.skills || []).map((s) => (typeof s === 'string' ? s : s?.name || ''))
      };
    }
  }

  const triage = performDeterministicTriage(effectiveData);

  const systemPrompt = `You are the Lead Career Architect and ATS Auditor at Career GPS.
Generate an exhaustive, domain-agnostic Career Assessment Report in strict JSON format.
STRICT ZERO-HARDCODING POLICY: Adapt directly to the provided role, experience level, and market competency clusters.
Cluster Equivalence Principle: If a candidate has evidenced one tool in an interchangeable group, grant 100% equivalence credit for that competency.`;

  const userPrompt = `TARGET CANDIDATE CONTEXT:
Role: ${triage.targetRole}
Experience: ${triage.experienceYears} Years
Quantified Bullets: ${triage.quantificationRatio}% (${triage.totalBulletPoints} total)
Verified Candidate Skills: ${JSON.stringify(triage.candidateSkills)}
Dynamic Market Competency Clusters: ${JSON.stringify(triage.rawClusters)}
Market Skill Coverage: ${triage.clustering.coveragePercentage}%
Candidate Bullets Sample:
${JSON.stringify(triage.bulletPoints)}

Generate a unified JSON response matching this exact schema:
{
  "career_health_score": {
    "overall": number (0-100),
    "marketAlignment": number (0-100),
    "atsCompatibility": number (0-100),
    "impactAndMetrics": number (0-100)
  },
  "executive_summary": string,
  "primary_bottleneck": {
    "title": string,
    "severity": "CRITICAL" | "MODERATE" | "LOW",
    "diagnosis": string,
    "recommendedPivot": string
  },
  "competency_clusters_audit": [
    {
      "clusterName": string,
      "satisfied": boolean,
      "matchedTool": string,
      "recommendation": string
    }
  ],
  "bullet_rewrites": [
    {
      "original": string,
      "rewritten": string,
      "critique": string
    }
  ],
  "roadmap": [
    {
      "phase": "Immediate (Days 1-14)" | "Short-Term (Days 15-45)" | "Mid-Term (Days 45-90)",
      "actions": [string]
    }
  ]
}
Return ONLY valid raw JSON. No markdown backticks, no introductory commentary.`;

  let structuredOutput = null;

  try {
    const response = await llmGateway.generate({
      purpose: 'report_generation',
      preferredProvider: options.preferredProvider || 'openrouter',
      model: options.model || 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.1,
      timeoutMs: options.timeoutMs || 15000
    });

    const rawContent = response?.text || response?.content || '{}';
    const cleanJson = rawContent
      .replace(/^```json/gi, '')
      .replace(/^```/gi, '')
      .replace(/```$/gi, '')
      .trim();

    structuredOutput = JSON.parse(cleanJson);
  } catch (err) {
    console.error('[reportGeneration] Gateway or JSON parse error:', err.message);

    structuredOutput = {
      career_health_score: {
        overall: triage.clustering.coveragePercentage || 70,
        marketAlignment: triage.clustering.coveragePercentage || 70,
        atsCompatibility: triage.quantificationRatio > 40 ? 80 : 65,
        impactAndMetrics: triage.quantificationRatio || 50
      },
      executive_summary: `Candidate benchmarked for ${triage.targetRole} with ${triage.experienceYears} years of experience and ${triage.clustering.coveragePercentage}% market competency cluster coverage.`,
      primary_bottleneck: {
        title: triage.clustering.coveragePercentage < 60 ? 'Market Competency Gaps' : 'Low Metric Quantification',
        severity: triage.clustering.coveragePercentage < 50 ? 'CRITICAL' : 'MODERATE',
        diagnosis: `Identified gaps across key competency clusters or low quantified business impact (${triage.quantificationRatio}%).`,
        recommendedPivot: 'Align resume achievements with interchangeable tools identified across high-frequency market demand.'
      },
      competency_clusters_audit: triage.clustering.clusterBreakdown || [],
      bullet_rewrites: (triage.bulletPoints || []).slice(0, 3).map((b) => ({
        original: b,
        rewritten: `Spearheaded initiatives by leveraging core tools, improving efficiency and project deliverables by measurable margins.`,
        critique: 'Quantify specific metrics and highlight direct outcomes.'
      })),
      roadmap: [
        {
          phase: 'Immediate (Days 1-14)',
          actions: ['Refactor top 3 bullets to reflect verified competency tools.']
        },
        {
          phase: 'Short-Term (Days 15-45)',
          actions: ['Target missing equivalent tools within high-priority clusters.']
        }
      ]
    };
  }

  if (!structuredOutput.competency_clusters_audit || structuredOutput.competency_clusters_audit.length === 0) {
    structuredOutput.competency_clusters_audit = triage.clustering.clusterBreakdown;
  }

  // Cross-compatibility mappings for frontend consumers (ReportDashboard.jsx, ResumeReportPage.jsx)
  structuredOutput.heroScore = structuredOutput.career_health_score;
  structuredOutput.executiveSummary = structuredOutput.executive_summary;
  structuredOutput.primaryBottleneck = structuredOutput.primary_bottleneck;
  structuredOutput.bulletRewrites = structuredOutput.bullet_rewrites;

  // Persist if user was loaded
  if (user) {
    user.aiReport = structuredOutput;
    try {
      await user.save();
    } catch (_saveErr) {
      console.warn('[reportGeneration] User aiReport save warning:', _saveErr.message);
    }
  }

  if (typeof assessmentData.onProgress === 'function') {
    try {
      assessmentData.onProgress({ stage: 'report_ready', message: 'Report ready.', report: structuredOutput });
    } catch (_progErr) {}
  }

  const totalDurationMs = Date.now() - startTime;

  return {
    success: true,
    user,
    aiReport: structuredOutput,
    data: structuredOutput,
    report: structuredOutput,
    telemetry: {
      latencyMs: totalDurationMs,
      targetAchieved: totalDurationMs < 10000,
      triageCoverage: triage.clustering.coveragePercentage
    }
  };
}

export default {
  generateReportBundle,
  performDeterministicTriage,
  normalizeAtlasShapes,
  deriveFunnelFromAnswers,
  deCycle,
};
