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
import { jsonrepair } from 'jsonrepair'

// ── Atlas completeness machinery (fixes truncated/incomplete reports) ───────
// The Atlas JSON is large (13+ sections); without an explicit output budget
// Gemini truncates it and whole widgets (funnel, risk heatmap, mission board)
// silently vanish. We now: budget the output, repair-parse, verify section
// completeness, and retry once when the draft is incomplete.

const REQUIRED_ATLAS_FIELDS = ['career_health_score', 'score_label', 'score_breakdown', 'market_reality_check', 'critical_issues', 'roadmap']
const ATLAS_ARRAY_SECTIONS = ['roadmap', 'critical_issues', 'rejection_factors', 'recommended_tools']
const ATLAS_OBJECT_SECTIONS = ['score_breakdown', 'market_reality_check', 'career_journey', 'funnel_stages', 'risk_heatmap', 'mission_board', 'coach_intervention']

function atlasCompleteness(report) {
  if (!report || typeof report !== 'object') return 0
  let score = 0
  for (const key of REQUIRED_ATLAS_FIELDS) {
    if (report[key] !== undefined && report[key] !== null) score += 1
  }
  for (const key of ATLAS_OBJECT_SECTIONS) {
    if (report[key] && typeof report[key] === 'object' && !Array.isArray(report[key])) score += 1
  }
  for (const key of ATLAS_ARRAY_SECTIONS) {
    if (Array.isArray(report[key]) && report[key].length > 0) score += 1
  }
  return score
}

function parseAtlasJson(text) {
  const cleaned = String(text).replace(/```json/g, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch (_e) {
    return JSON.parse(jsonrepair(cleaned)) // truncation artifacts
  }
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

  // mission_board: wrap into object if returned as an array
  if (Array.isArray(report.mission_board)) {
    report.mission_board = {
      xp_level: 'Level 3: Active Strategist',
      xp_current: 500,
      missions: report.mission_board,
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
      // Anchor critical diagnostic fields directly to userFunnel
      biggest_leak_stage: userFunnel.biggest_leak_stage,
      leak_title: userFunnel.leak_title,
      diagnosis_message: userFunnel.diagnosis_message,
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
    report.funnel_stages.biggest_leak_stage = userFunnel.biggest_leak_stage
    report.funnel_stages.leak_title = userFunnel.leak_title
    report.funnel_stages.diagnosis_message = userFunnel.diagnosis_message
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

  // Ensure "Execution Bridge" CTA is dynamically anchored to funnel_stages.leak_title and candidate target role
  if (!report.coach_intervention || typeof report.coach_intervention !== 'object') {
    report.coach_intervention = {}
  }
  const leakTitle = userFunnel.leak_title || report.funnel_stages?.leak_title || report.funnel_stages?.biggest_leak_stage || 'Technical Rounds'
  const targetRole = answers.targetRole || answers.role || report.target_role || 'your target role'
  report.coach_intervention.urgency_statement = 
    `Polished bullet points and optimized headlines alone will not fix your drop-off at ${leakTitle} for ${targetRole}. Bypassing cold portal black holes requires a targeted direct-referral protocol and live technical storytelling.`
  report.coach_intervention.value_prop = 
    `In your 1-on-1 Strategy Call, we will map out your exact 30-day hiring manager referral pipeline, resolve cross-document background flags, and conduct live mock storytelling for your top projects.`
  report.coach_intervention.cta_text = 'Book Free 1-on-1 Strategy Session'

  return report
}

// Every Atlas call carries this contract — array sections are non-negotiable
// for the dashboard widgets, and models deviate without it.
const ATLAS_FORMAT_CONTRACT = `

FORMAT CONTRACT (strict):
- critical_issues, roadmap, rejection_factors, recommended_tools MUST be JSON ARRAYS of objects.
- funnel_stages, risk_heatmap, mission_board, career_journey, market_reality_check, score_breakdown, coach_intervention MUST be JSON OBJECTS matching the exact keys in the prompt schema.
- career_journey MUST be a single object: {"current_phase_id": "...", "guide_message": "..."}.
- Never merge sections. Return every section fully populated.`

async function callAtlas(promptText, extraInstructions = '', userAnswers = {}) {
  const estimatedPromptTokens = Math.round((promptText.length + ATLAS_FORMAT_CONTRACT.length + extraInstructions.length) / 4)
  console.log(`[ReportGeneration] Calling Atlas with prompt size ~${estimatedPromptTokens} tokens (${promptText.length} chars)`)

  try {
    const { text: responseText } = await llmGateway.generate({
      purpose: 'assessment_report',
      task: 'report_generation',
      preferredProvider: 'openrouter',
      model: 'google/gemini-3.5-flash-lite',
      messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + extraInstructions }],
      responseFormat: 'json_object',
      temperature: 0.2,
      maxTokens: 4096,
      maxRetries: 2,
      timeoutMs: 45000,
    })
    return normalizeAtlasShapes(parseAtlasJson(responseText), userAnswers)
  } catch (primaryErr) {
    console.warn('[ReportGeneration] Gemini 3.5 Flash Lite failed, routing to DeepSeek V3:', primaryErr.message)
    try {
      const { text: responseText } = await llmGateway.generate({
        purpose: 'assessment_report',
        task: 'report_generation',
        preferredProvider: 'openrouter',
        model: 'deepseek/deepseek-chat',
        messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + extraInstructions }],
        responseFormat: 'json_object',
        temperature: 0.2,
        maxTokens: 4096,
        maxRetries: 2,
        timeoutMs: 45000,
      })
      return normalizeAtlasShapes(parseAtlasJson(responseText), userAnswers)
    } catch (deepseekErr) {
      console.warn('[ReportGeneration] DeepSeek V3 failed, falling back to Gemini 3 Flash Preview:', deepseekErr.message)
      const { text: responseText } = await llmGateway.generate({
        purpose: 'assessment_report',
        task: 'report_generation',
        preferredProvider: 'openrouter',
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + extraInstructions }],
        responseFormat: 'json_object',
        temperature: 0.2,
        maxTokens: 4096,
        maxRetries: 2,
        timeoutMs: 45000,
      })
      return normalizeAtlasShapes(parseAtlasJson(responseText), userAnswers)
    }
  }
}

export async function generateReportBundle({
  userId,
  semanticProfile,
  precomputedResumeAgent = null,
  precomputedResumeJson = null,
  precomputedLinkedinData = null,
  onProgress = () => {},
}) {
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

  const promptText = getGeminiPrompt(
    user.answers,
    effectiveCanonicalResume || user.resumeJson,
    user.linkedinData || activeLinkedinData,
    dynamicKbContent,
    effectiveSemanticProfile,
    activeResumeAgent,
    activeLinkedinAgent,
    assessmentPersona
  )

  // Atlas draft with completeness guard: if the model returns a partial JSON
  // (missing sections), retry ONCE with an explicit completeness instruction
  // and keep whichever draft is more complete.
  report('atlas_roadmap', 'Generating Atlas strategic career roadmap & executive diagnostic…')
  let aiReport = await callAtlas(promptText, '', user.answers)
  let draftCompleteness = atlasCompleteness(aiReport)
  if (draftCompleteness < REQUIRED_ATLAS_FIELDS.length + ATLAS_ARRAY_SECTIONS.length + ATLAS_OBJECT_SECTIONS.length - 4) {
    report('composing', 'First draft was incomplete — asking Atlas for the full report…')
    try {
      const retryDraft = await callAtlas(
        promptText,
        '\n\nIMPORTANT: Your previous response was incomplete. Return the COMPLETE JSON object with EVERY section fully populated — especially funnel_stages, risk_heatmap, mission_board, rejection_factors, career_journey, and recommended_tools. Do not skip or shorten any array. If a section is long, prioritize completeness over prose length.',
        user.answers
      )
      const retryCompleteness = atlasCompleteness(retryDraft)
      if (retryCompleteness > draftCompleteness) {
        aiReport = retryDraft
        draftCompleteness = retryCompleteness
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
          'gps_scores', 'external_context', 'interview_ledger'
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
          const retryReport = await callAtlas(retryPrompt, '', user.answers)
          // Anti-degradation guard: a regeneration that LOSES sections (truncation,
          // lazy model) is worse than a below-threshold complete report — keep the
          // current draft unless the retry is at least as complete.
          const retryCompleteness = atlasCompleteness(retryReport)
          if (retryCompleteness >= draftCompleteness) {
            keepAgentBundle(aiReport, retryReport)
            aiReport = retryReport
            draftCompleteness = retryCompleteness
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

  // Save report to User DB
  user.aiReport = aiReport
  await user.save()

  // Trigger Admin Email asynchronously (so candidate doesn't wait)
  sendAdminReportEmail(user.email, user.answers, aiReport, user.resumeData, user.resumeName)

  report('done', 'Report ready.')

  return { user, aiReport }
}

export default { generateReportBundle }
