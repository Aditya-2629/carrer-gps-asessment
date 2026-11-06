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
import { buildRAGContext, buildSmartQuery } from '../utils/ragEngine.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'
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
3-PART EXECUTIVE DIAGNOSTIC FRAMEWORK:
==================================================
Enforce this 3-Part Diagnostic Framework across executive_verdict, primary_bottleneck, and critical_issues:
- Part 1: Validate the Enterprise Foundation: Acknowledge their real accomplishments, recognized company logos (e.g. Bank of America, Abbott), and core technical stack so they know you have actually reviewed their career.
- Part 2: The Brutal Bottleneck Truth: Explain the exact human screening reality causing drop-offs.
  Example: "Alekya, your resume proves you can write solid code at enterprise scale. But hiring managers are passing in 6 seconds because your experience reads like an instruction manual of tools you touched, rather than the business outcomes and system architecture you owned. They see a developer executing tickets, not a Senior Engineer driving solutions."
- Part 3: The Immediate High-Leverage Pivot: Give them the single most impactful tactical shift they must make tomorrow morning to unblock recruiter callbacks.

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

export async function generateReportBundle({
  userId,
  semanticProfile,
  precomputedResumeAgent = null,
  precomputedResumeJson = null,
  precomputedLinkedinData = null,
  onProgress = () => {},
}) {
  const totalStart = Date.now()
  const report = (stage, message) => {
    try {
      onProgress({ stage, message, at: new Date().toISOString() })
    } catch (_e) {
      /* listeners must never break generation */
    }
  }

  const user = await User.findById(userId)
  if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 })
  if (!user.isVerified) throw Object.assign(new Error('Unauthorized. Email not verified.'), { statusCode: 403 })

  const hasAnswers = user.answers && Object.keys(user.answers).length > 0
  if (!hasAnswers) throw Object.assign(new Error('No answers found. Please submit the assessment first.'), { statusCode: 400 })

  if (precomputedResumeJson && !user.resumeJson) {
    user.resumeJson = precomputedResumeJson
  }

  if (precomputedLinkedinData && !user.linkedinData) {
    user.linkedinData = precomputedLinkedinData
  }

  let precomputedLinkedinActivityData = user.linkedinActivityData || user.answers?.linkedinActivityData || null

  const effectiveCanonicalResume =
    precomputedResumeJson ||
    precomputedResumeAgent?.canonicalResume ||
    (Array.isArray(user.resumeJson?.experience) || Array.isArray(user.resumeJson?.experiences) ? user.resumeJson : null)

  const effectiveLinkedinUrl = user.linkedinUrl || user.answers?.linkedin || user.answers?.linkedinUrl || ''

  report('preparing', 'Building knowledge context and orchestrating agents…')

  // Run RAG context preparation and LinkedIn live scrape in parallel
  const smartQuery = buildSmartQuery(user.answers, user.resumeJson)
  const shouldScrapeLinkedin = Boolean(effectiveLinkedinUrl && !user.linkedinData && !precomputedLinkedinData)

  const [dynamicKbContent, liveLinkedinData] = await Promise.all([
    buildRAGContext(smartQuery).catch((err) => {
      console.warn('[ReportGen] RAG context fallback:', err.message)
      return null
    }),
    shouldScrapeLinkedin
      ? scrapeLinkedInProfile(effectiveLinkedinUrl).catch((err) => {
          console.warn('[ReportGen] LinkedIn scrape fallback to resume data:', err.message)
          return null
        })
      : Promise.resolve(null),
  ])

  if (liveLinkedinData && !user.linkedinData) {
    user.linkedinData = liveLinkedinData
  }

  const effectiveSemanticProfile = semanticProfile || user.semanticProfile || null

  // Safely extract string targetRole from semantic profile or user answers
  const rawTargetRole =
    (typeof effectiveSemanticProfile?.targetRole === 'object'
      ? effectiveSemanticProfile?.targetRole?.rawAnswer || effectiveSemanticProfile?.targetRole?.value || effectiveSemanticProfile?.targetRole?.title
      : effectiveSemanticProfile?.targetRole) ||
    (typeof effectiveSemanticProfile?.target_role === 'object'
      ? effectiveSemanticProfile?.target_role?.rawAnswer || effectiveSemanticProfile?.target_role?.value || effectiveSemanticProfile?.target_role?.title
      : effectiveSemanticProfile?.target_role) ||
    (typeof user.answers?.targetRole === 'object'
      ? user.answers?.targetRole?.rawAnswer || user.answers?.targetRole?.value || user.answers?.targetRole?.title
      : user.answers?.targetRole) ||
    user.resumeJson?.target_role ||
    user.targetRole ||
    ''

  const resumeTextForRole =
    effectiveCanonicalResume?.summary?.text ||
    (effectiveCanonicalResume?.experience || effectiveCanonicalResume?.experiences || []).map((e) => `${e.role || ''} ${e.title || ''}`).join(' ') ||
    ''
  const inferredRole = inferRoleFromKeywordFrequency(resumeTextForRole)
  const resumeTargetRole = (typeof rawTargetRole === 'string' && rawTargetRole.trim())
    ? rawTargetRole.trim()
    : (inferredRole && inferredRole !== 'Professional' ? inferredRole : 'Technical Professional')

  // Evaluate rich assessment intelligence & directives across all agents
  const assessmentPersona = evaluateAssessmentPersona({
    answers: user.answers || {},
    semanticProfile: effectiveSemanticProfile || {},
    resumeContext: {
      canonicalResume: effectiveCanonicalResume,
      targetRole: resumeTargetRole,
    },
  })

  report('agents_running', 'Running Resume and LinkedIn specialized diagnostic agents…')

  // If precomputedResumeAgent is already supplied from upload-time execution,
  // skip duplicate ResumeAgent LLM execution and only run LinkedIn agent if needed,
  // while still bridging the canonical resume facts to evaluateLinkedIn.
  let agentsPromise
  if (precomputedResumeAgent) {
    report('agent_resume_agent_done', 'Precomputed Resume Agent diagnosis attached.')
    agentsPromise = (async () => {
      const linkedinRes = await runCareerAgents({
        resumeBuffer: user.resumeData && user.resumeData.length > 0 ? user.resumeData : null,
        resumeName: user.resumeName || '',
        canonicalResume: effectiveCanonicalResume,
        resumeTargetRole,
        answers: user.answers || {}, // INJECT QUESTIONNAIRE DATA
        linkedinUrl: effectiveLinkedinUrl,
        linkedinData: user.linkedinData || precomputedLinkedinData || null,
        linkedinActivityData: user.linkedinActivityData || precomputedLinkedinActivityData || null,
        userId: user._id,
        assessmentPersona,
        skipResumeSynthesis: true,
        onProgress: (e) => {
          if (e.agent !== 'resume') {
            const st = e.stage.startsWith('agent_') ? e.stage : `agent_${e.agent}_${e.stage}`
            report(st, e.message)
          }
        },
      })
      return {
        resumeAgent: precomputedResumeAgent,
        linkedinAgent: linkedinRes.linkedinAgent,
        linkedinData: linkedinRes.linkedinData,
      }
    })()
  } else {
    agentsPromise = runCareerAgents({
      resumeBuffer: user.resumeData && user.resumeData.length > 0 ? user.resumeData : null,
      resumeName: user.resumeName || '',
      canonicalResume: effectiveCanonicalResume,
      resumeTargetRole,
      answers: user.answers || {}, // INJECT QUESTIONNAIRE DATA
      linkedinUrl: effectiveLinkedinUrl,
      linkedinData: user.linkedinData || precomputedLinkedinData || null,
      linkedinActivityData: user.linkedinActivityData || precomputedLinkedinActivityData || null,
      userId: user._id,
      assessmentPersona,
      onProgress: (e) => {
        const st = e.stage.startsWith('agent_') ? e.stage : `agent_${e.agent}_${e.stage}`
        report(st, e.message)
      },
    })
  }

  // Await agentsPromise before callAtlas: ResumeAgent is precomputed in 0ms and LinkedInAgent
  // executes in ~2.5s on Groq. Awaiting here gives Atlas the verified agent diagnoses
  // and freshly scraped LinkedIn data so the report is 100% dynamic.
  const result = await agentsPromise
  const activeResumeAgent = result?.resumeAgent || precomputedResumeAgent || null
  let activeLinkedinAgent = result?.linkedinAgent || null
  const isPoisonedLinkedin = (data) =>
    data &&
    typeof data === 'object' &&
    data.fullName === 'Not Specified' &&
    (!data.experiences || data.experiences.length === 0)

  if (isPoisonedLinkedin(user.linkedinData)) {
    console.warn('[ReportGeneration] Discarding poisoned/empty Apify profile in user.linkedinData')
    user.linkedinData = null
  }
  if (isPoisonedLinkedin(precomputedLinkedinData)) {
    precomputedLinkedinData = null
  }

  let activeLinkedinData = user.linkedinData || precomputedLinkedinData || result?.linkedinData || null
  if (isPoisonedLinkedin(activeLinkedinData)) {
    activeLinkedinData = null
    user.linkedinData = null
  }
  if (!user.linkedinData && activeLinkedinData) {
    user.linkedinData = activeLinkedinData
  }

  // Persist LinkedIn Activity data & signals from orchestrator results
  if (result?.activityData && !user.linkedinActivityData) {
    user.linkedinActivityData = result.activityData
  } else if (result?.linkedinActivityData) {
    user.linkedinActivityData = result.linkedinActivityData
  }
  if (result?.activitySignals && !user.linkedinActivitySignals) {
    user.linkedinActivitySignals = result.activitySignals
  } else if (result?.linkedinActivitySignals) {
    user.linkedinActivitySignals = result.linkedinActivitySignals
  } else if (activeLinkedinAgent?.activitySignals) {
    user.linkedinActivitySignals = activeLinkedinAgent.activitySignals
  }

  // Safety net: ensure linkedin_agent is evaluated if missing or dataAvailable was false
  if ((!activeLinkedinAgent || activeLinkedinAgent.dataAvailable === false) && (activeLinkedinData || effectiveLinkedinUrl || effectiveCanonicalResume || user.resumeJson)) {
    try {
      console.log('[ReportGeneration] Running safety net evaluateLinkedIn directly...')
      const directLi = await evaluateLinkedIn({
        profile: isPoisonedLinkedin(activeLinkedinData) ? null : activeLinkedinData,
        resumeContext: {
          canonicalResume: activeResumeAgent?.canonicalResume || effectiveCanonicalResume || user.resumeJson,
          targetRole: resumeTargetRole,
        },
        answers: user.answers || {},
        runLlm: true,
        preferredProvider: 'groq',
      })
      if (directLi) {
        activeLinkedinAgent = directLi
      }
    } catch (directErr) {
      console.warn('[ReportGeneration] Safety net evaluateLinkedIn failed:', directErr.message)
    }
  }

  const compactDigest = buildCompactAtlasDigest({
    user,
    activeResumeAgent,
    activeLinkedinAgent,
    targetRole: resumeTargetRole,
    phase: assessmentPersona?.phase,
  })

  const promptText = getGeminiPrompt(
    user.answers,
    effectiveCanonicalResume || user.resumeJson,
    user.linkedinData || activeLinkedinData,
    dynamicKbContent,
    effectiveSemanticProfile,
    activeResumeAgent,
    activeLinkedinAgent,
    assessmentPersona,
    null,
    compactDigest
  )

  // Atlas draft with completeness guard: if the model returns a partial JSON
  // (missing sections), retry ONCE with an explicit completeness instruction
  // and keep whichever draft is more complete.
  report('atlas_roadmap', 'Generating Atlas strategic career roadmap & executive diagnostic…')
  let atlasResult = await callAtlas(promptText, '', user.answers)
  let aiReport = atlasResult.report || atlasResult
  let atlasTelemetry = atlasResult.telemetry || atlasResult._telemetry || {
    durationMs: 0,
    modelUsed: 'google/gemini-3.5-flash-lite',
    fallbackTriggered: false,
  }
  let draftCompleteness = atlasCompleteness(aiReport)
  if (draftCompleteness < 11) {
    report('composing', 'First draft was incomplete — asking Atlas for the full report…')
    try {
      const retryResult = await callAtlas(
        promptText,
        '\n\nIMPORTANT: Your previous response was incomplete. Return the COMPLETE JSON object with EVERY section fully populated — especially funnel_stages, risk_heatmap, mission_board, rejection_factors, career_journey, and recommended_tools. Do not skip or shorten any array. If a section is long, prioritize completeness over prose length.',
        user.answers
      )
      const retryReport = retryResult.report || retryResult
      const retryTelemetry = retryResult.telemetry || retryResult._telemetry
      if (retryTelemetry) {
        atlasTelemetry = retryTelemetry
      }
      const retryCompleteness = atlasCompleteness(retryReport)
      if (retryCompleteness >= draftCompleteness) {
        aiReport = mergeReportSections(retryReport, aiReport)
        draftCompleteness = atlasCompleteness(aiReport)
      } else {
        aiReport = mergeReportSections(aiReport, retryReport)
        draftCompleteness = atlasCompleteness(aiReport)
      }
    } catch (retryErr) {
      console.warn('[ReportGeneration] Atlas completeness retry failed, using first draft:', retryErr.message)
    }
  }

  // Include structured resume & linkedin json in final report output
  if (effectiveCanonicalResume || user.resumeJson) {
    aiReport.resume_json = effectiveCanonicalResume || user.resumeJson
  }
  if (user.linkedinData || activeLinkedinData) {
    aiReport.linkedin_json = user.linkedinData || activeLinkedinData
  }

  // Re-evaluate assessmentPersona with resolved agents
  let effectiveAssessmentAgent = assessmentPersona
  try {
    effectiveAssessmentAgent = evaluateAssessmentPersona({
      answers: user.answers || {},
      semanticProfile: user.semanticProfile || effectiveSemanticProfile || {},
      resumeAgent: activeResumeAgent,
      linkedinAgent: activeLinkedinAgent,
    })
  } catch (_e) {
    console.warn('[reportGeneration] evaluateAssessmentPersona error:', _e.message || _e)
  }

  // Smart Keyword Weaver & Defensible Interview Ledger Integration
  let interviewLedger = []
  try {
    const rawMissing = [
      ...(Array.isArray(activeResumeAgent?.keywordAlignment?.missingKeywords) ? activeResumeAgent.keywordAlignment.missingKeywords : []),
      ...(Array.isArray(activeResumeAgent?.keywordAlignment?.missingFromResume) ? activeResumeAgent.keywordAlignment.missingFromResume : []),
      ...(Array.isArray(aiReport?.missing_ats_keywords) ? aiReport.missing_ats_keywords : []),
      ...(Array.isArray(activeResumeAgent?.missingKeywords) ? activeResumeAgent.missingKeywords : []),
    ]
    const missingSkillsList = []
    const seenKw = new Set()
    for (const item of rawMissing) {
      const kw = typeof item === 'string' ? item.trim() : (item?.keyword || item?.name || item?.skill || '').trim()
      if (kw && kw.length >= 2 && !seenKw.has(kw.toLowerCase())) {
        seenKw.add(kw.toLowerCase())
        missingSkillsList.push(kw)
      }
    }

    const strandedSkillsOnly = (Array.isArray(activeResumeAgent?.keywordAlignment?.skillsOnlyUnverified) ? activeResumeAgent.keywordAlignment.skillsOnlyUnverified : [])
      .map((s) => (typeof s === 'string' ? s.trim() : (s?.keyword || s?.name || '').trim()))
      .filter((s) => s && s.length >= 2)

    // Deep clone canonicalResume so properties can be mutated safely (fixes Mongoose frozen object error):
    const canonicalForWeaving = JSON.parse(JSON.stringify(
      activeResumeAgent?.canonicalResume || effectiveCanonicalResume || user.resumeJson || {}
    ))
    if (canonicalForWeaving && (canonicalForWeaving.experiences || canonicalForWeaving.experience)) {
      const { tailoredExperiences, interviewLedger: ledger } = await weaveKeywordsAndBuildLedger({
        canonicalResume: canonicalForWeaving,
        missingKeywords: missingSkillsList,
        targetRole: resumeTargetRole,
        skillsOnlyKeywords: strandedSkillsOnly,
      })
      if (tailoredExperiences && tailoredExperiences.length > 0) {
        if (activeResumeAgent && activeResumeAgent.canonicalResume) {
          activeResumeAgent.canonicalResume.experiences = tailoredExperiences
          activeResumeAgent.canonicalResume.experience = tailoredExperiences
        }
        if (aiReport.resume_json) {
          aiReport.resume_json.experiences = tailoredExperiences
          aiReport.resume_json.experience = tailoredExperiences
        }
      }
      interviewLedger = ledger || []
      if (activeResumeAgent) {
        activeResumeAgent.interviewLedger = interviewLedger
        activeResumeAgent.wovenKeywords = interviewLedger
      }
    }
  } catch (_weaveErr) {
    console.warn('[reportGeneration] weaveKeywordsAndBuildLedger warning:', _weaveErr.message || _weaveErr)
  }

  aiReport.interview_ledger = interviewLedger
  aiReport.woven_keywords = interviewLedger
  aiReport.target_role = resumeTargetRole

  // Attach verified agent diagnoses and V2 Career GPS metrics
  aiReport.resume_agent = activeResumeAgent
  aiReport.linkedin_agent = activeLinkedinAgent
  aiReport.assessment_agent = effectiveAssessmentAgent
  aiReport.linkedin_activity_signals = user.linkedinActivitySignals || activeLinkedinAgent?.activitySignals || result?.linkedinActivitySignals || null
  aiReport.linkedin_activity_data = user.linkedinActivityData || result?.linkedinActivityData || null
  aiReport.linkedinActivitySignals = aiReport.linkedin_activity_signals
  aiReport.linkedinActivityData = aiReport.linkedin_activity_data

  const v2Score = effectiveAssessmentAgent?.gpsScore ?? aiReport.career_health_score ?? 68
  aiReport.gps_score = v2Score
  aiReport.career_health_score = v2Score
  aiReport.score_label = effectiveAssessmentAgent?.gradeLabel || aiReport.score_label || 'Good'
  aiReport.phase = effectiveAssessmentAgent?.phase ?? { id: 1, name: 'Resume → Screening Call', confidence: 'Medium' }
  aiReport.primary_bottleneck = effectiveAssessmentAgent?.primary_bottleneck ?? null
  aiReport.secondary_problem = effectiveAssessmentAgent?.secondary_problem ?? null
  aiReport.strongest_area = effectiveAssessmentAgent?.strongest_area ?? null
  aiReport.next_best_action = effectiveAssessmentAgent?.next_best_action ?? null
  aiReport.top_actions = effectiveAssessmentAgent?.top_actions ?? []
  aiReport.gps_scores = effectiveAssessmentAgent?.scores ?? null
  aiReport.external_context = effectiveAssessmentAgent?.external_context ?? null

  // Merge deterministic hybrid templates (7-Day Sprint, XP mission board, 30-60-90 milestone pathway)
  const rawSkills = activeResumeAgent?.canonicalResume?.skills || activeResumeAgent?.verifiedSkills || []
  const verifiedSkillsList = (Array.isArray(rawSkills) ? rawSkills.map((s) => (typeof s === 'string' ? s : s?.name || s?.skill)).filter(Boolean) : []).slice(0, 10)

  aiReport.seven_day_sprint = build7DayRapidTriageSprint(aiReport.phase, resumeTargetRole, verifiedSkillsList)
  aiReport.mission_board = buildGamifiedMissionBoard(aiReport.top_actions, aiReport.phase?.id, aiReport.career_health_score)
  aiReport.milestone_pathway = build30_60_90MilestonePathway(aiReport.phase?.id, resumeTargetRole, verifiedSkillsList)
  if (!aiReport.roadmap || !Array.isArray(aiReport.roadmap) || aiReport.roadmap.length === 0) {
    aiReport.roadmap = buildStandard4WeekRoadmap(aiReport.phase?.id, resumeTargetRole, verifiedSkillsList)
  }

  // Synchronize score_breakdown across all 4 balanced pillars (25% each)
  const fourPillars = effectiveAssessmentAgent?.scores?.four_pillars || {}
  if (!aiReport.score_breakdown) aiReport.score_breakdown = {}

  // 1. Resume Pillar
  const resPillar = fourPillars.resume
  const resumeScore = resPillar?.score ?? activeResumeAgent?.dashboard?.score ?? 68
  aiReport.score_breakdown.resume = {
    score: resumeScore,
    points: resPillar?.points ?? Math.round((resumeScore / 100) * 25),
    maxPoints: 25,
    weight: '25%',
    grade: activeResumeAgent?.dashboard?.grade || (resumeScore >= 85 ? 'A' : resumeScore >= 70 ? 'B' : resumeScore >= 55 ? 'C' : 'D'),
    diagnosis: aiReport.score_breakdown?.resume?.diagnosis || `Resume integrity scores ${resumeScore}/100 based on ATS keyword alignment and quantified achievement density.`,
  }

  // 2. LinkedIn Pillar
  const liPillar = fourPillars.linkedin
  const liScore = liPillar?.score ?? activeLinkedinAgent?.score ?? 65
  const topLiIssue = activeLinkedinAgent?.discrepancies?.[0]?.title || activeLinkedinAgent?.topRecommendations?.[0] || 'missing featured project case studies and peer recommendations'
  aiReport.score_breakdown.linkedin = {
    score: liScore,
    points: liPillar?.points ?? Math.round((liScore / 100) * 25),
    maxPoints: 25,
    weight: '25%',
    grade: activeLinkedinAgent?.grade || (liScore >= 85 ? 'A' : liScore >= 70 ? 'B' : liScore >= 55 ? 'C' : 'D'),
    consistencyTier: liPillar?.consistencyTier || 'Strong Match',
    diagnosis: aiReport.score_breakdown?.linkedin?.diagnosis && aiReport.score_breakdown.linkedin.diagnosis.length >= 100
      ? aiReport.score_breakdown.linkedin.diagnosis
      : `Your LinkedIn profile scores ${liScore}/100 with strong role descriptions and network reach, but recruiter trust and inbound search visibility are held back by ${topLiIssue.toLowerCase()}.`,
  }

  // 3. Outreach Pillar
  const outreachPillar = fourPillars.outreach
  const outreachScore = outreachPillar?.score ?? 60
  aiReport.score_breakdown.outreach = {
    score: outreachScore,
    points: outreachPillar?.points ?? Math.round((outreachScore / 100) * 25),
    maxPoints: 25,
    weight: '25%',
    grade: outreachScore >= 85 ? 'A' : outreachScore >= 70 ? 'B' : outreachScore >= 55 ? 'C' : 'D',
    diagnosis: aiReport.score_breakdown?.outreach?.diagnosis || `Outreach velocity scores ${outreachScore}/100 reflecting current targeted application rates and multi-channel referral sourcing mix.`,
  }

  // 4. Interviews Pillar
  const interviewPillar = fourPillars.interviews
  const interviewScore = interviewPillar?.score ?? 65
  aiReport.score_breakdown.interviews = {
    score: interviewScore,
    points: interviewPillar?.points ?? Math.round((interviewScore / 100) * 25),
    maxPoints: 25,
    weight: '25%',
    grade: interviewScore >= 85 ? 'A' : interviewScore >= 70 ? 'B' : interviewScore >= 55 ? 'C' : 'D',
    diagnosis: aiReport.score_breakdown?.interviews?.diagnosis || `Interview defense scores ${interviewScore}/100 reflecting pipeline progression from screening calls through final rounds.`,
  }

  aiReport.user_answers = user.answers || {}
  aiReport.semantic_profile = user.semanticProfile || effectiveSemanticProfile || null

  // ── Phase D: Judge Agent quality gate ──────────────────────────────────────
  // Every report is scored on a fixed rubric before shipping. Below-threshold
  // reports get ONE regeneration with the judge's notes; the result ships with
  // a warning flag either way (never blocks the candidate).
  if (process.env.JUDGE_ENABLED !== 'false') {
    try {
      report('quality_gate', 'Judge agent is auditing report quality…')
      let judgeRun = await judgeReport(aiReport)
      let judge = judgeRun.result
      let regenerated = false

      const keepAgentBundle = (source, target) => {
        for (const key of [
          'resume_json', 'linkedin_json', 'resume_agent', 'linkedin_agent',
          'assessment_agent', 'dashboard', 'user_answers', 'semantic_profile',
          'gps_score', 'career_health_score', 'phase', 'primary_bottleneck',
          'secondary_problem', 'strongest_area', 'next_best_action', 'top_actions',
          'gps_scores', 'external_context', 'interview_ledger',
          'seven_day_sprint', 'mission_board', 'milestone_pathway', 'roadmap'
        ]) {
          if (source[key] !== undefined) target[key] = source[key]
        }
        return target
      }

      if (typeof judge?.score === 'number' && judge.score < 7 && judge.fallback !== true) {
        report('quality_pass', 'Judge found quality gaps — regenerating the narrative once with its notes…')
        try {
          const repairNotes = (judge.flags || []).join('; ') || 'Be more specific and warmer; cite the candidate’s actual words.'
          const retryPrompt = `${promptText}\n\nQUALITY NOTES FROM YOUR REVIEWER (fix these in your JSON):\n- ${repairNotes}`
          const retryResult = await callAtlas(retryPrompt, '', user.answers)
          const retryReport = retryResult.report || retryResult
          // Anti-degradation guard: a regeneration that LOSES sections (truncation,
          // lazy model) is worse than a below-threshold complete report — keep the
          // current draft unless the retry is at least as complete.
          const retryCompleteness = atlasCompleteness(retryReport)
          if (retryCompleteness >= draftCompleteness) {
            keepAgentBundle(aiReport, retryReport)
            aiReport = mergeReportSections(retryReport, aiReport)
            draftCompleteness = atlasCompleteness(aiReport)
            regenerated = true
            judgeRun = await judgeReport(aiReport)
            judge = judgeRun.result
          } else {
            console.warn(`[ReportGeneration] Judge regen less complete (${retryCompleteness} < ${draftCompleteness}) — keeping current draft`)
          }
        } catch (regenErr) {
          console.warn('[ReportGeneration] Judge-triggered regeneration failed, shipping first draft:', regenErr.message)
        }
      }

      aiReport.judge = {
        score: judge?.score ?? null,
        subscores: judge?.subscores || {},
        flags: judge?.flags || [],
        summary: judge?.summary || '',
        fallback: Boolean(judge?.fallback),
        regenerated,
        warning: typeof judge?.score === 'number' && judge.score < 7,
      }

      // Judge run is itself an auditable AgentRun row
      if (mongoose.connection.readyState === 1) {
        AgentRun.create({
          agent: 'judge',
          agentVersion: '1.0.0',
          inputHash: `report:${Date.now()}`,
          userId: user._id,
          status: 'SUCCESS',
          latencyMs: judgeRun.telemetry?.durationMs ?? 0,
          judgeScore: aiReport.judge.score,
          output: { flags: aiReport.judge.flags, summary: aiReport.judge.summary },
        }).catch(() => {})
      }
    } catch (judgeErr) {
      console.warn('[ReportGeneration] Judge gate failed (non-fatal):', judgeErr.message)
    }
  }

  const totalDurationMs = Date.now() - totalStart

  aiReport._meta = {
    generatedAt: new Date().toISOString(),
    engineVersion: '2.5.0-executive',
    totalDurationMs,
    atlasModelUsed: atlasTelemetry.modelUsed || 'google/gemini-3.5-flash-lite',
    atlasDurationMs: atlasTelemetry.durationMs || 0,
    fallbackTriggered: Boolean(atlasTelemetry.fallbackTriggered),
    completenessScore: atlasCompleteness(aiReport),
    judgeScore: aiReport.judge?.score ?? null,
  }

  // Update running ReportJob if available
  if (mongoose.connection.readyState === 1 && user._id) {
    try {
      await ReportJob.updateMany(
        { userId: user._id, status: 'running' },
        { $set: { 'aiReport._meta': aiReport._meta } }
      ).catch(() => {})
    } catch (_e) {}
  }

  // Save overall AgentRun telemetry row
  if (mongoose.connection.readyState === 1) {
    AgentRun.create({
      agent: 'overall',
      agentVersion: '2.5.0-executive',
      inputHash: `report:${user._id || 'anon'}:${Date.now()}`,
      userId: user._id,
      status: 'SUCCESS',
      model: aiReport._meta.atlasModelUsed,
      latencyMs: totalDurationMs,
      judgeScore: aiReport._meta.judgeScore,
      output: {
        _meta: aiReport._meta,
        completenessScore: aiReport._meta.completenessScore,
      },
    }).catch((err) => {
      console.warn('[ReportGeneration] AgentRun overall save failed:', err.message)
    })
  }

  // Save report to User DB (sanitized POJO without circular references)
  const sanitizedReport = deCycle(aiReport)
  user.aiReport = sanitizedReport
  await user.save()

  // Trigger Admin Email asynchronously (so candidate doesn't wait)
  sendAdminReportEmail(user.email, user.answers, sanitizedReport, user.resumeData, user.resumeName)

  report('done', 'Report ready.')

  return { user, aiReport: sanitizedReport }
}

export default { generateReportBundle }
