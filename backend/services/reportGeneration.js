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
  const parseNum = (val, defaultVal = 0) => {
    if (typeof val === 'number' && !isNaN(val)) return val
    if (!val) return defaultVal
    const cleaned = String(val).replace(/[^0-9]/g, '')
    const num = parseInt(cleaned, 10)
    return isNaN(num) ? defaultVal : num
  }

  let apps = parseNum(answers.applications_count || answers.appsWeek, 60)
  // Sanity check: single candidate 90-day applications over 1000 is an input anomaly/concatenation
  if (apps > 1000) {
    apps = Math.min(Math.round(apps / 100), 250)
  }

  const calls = Math.min(parseNum(answers.recruiter_calls_count || answers.humanScreen, 5), apps)
  const interviews = Math.min(parseNum(answers.interviews_count || answers.aiScreen, 2), calls)
  const finals = Math.min(parseNum(answers.final_rounds_count, 1), interviews)
  const offers = Math.min(parseNum(answers.offers_count, 0), finals)
  const outreach = parseNum(answers.outreach || answers.recruiter_outreach_count || answers.coldEmails, 0)

  return {
    applications_count: apps,
    applications_period: 'month',
    outreach_count: outreach,
    outreach_period: 'month',
    recruiter_calls_count: calls,
    responses_period: 'month',
    interviews_count: interviews,
    final_rounds_count: finals,
    offers_count: offers,
    biggest_leak_stage: calls === 0 ? 'top_of_funnel' : 'technical_round',
  }
}

/**
 * Fixes common LLM shape deviations so the frontend always gets the contract
 * shape. Ensures objects (funnel_stages, mission_board, risk_heatmap) retain
 * their object schemas and arrays are coerced safely.
 */
function normalizeAtlasShapes(report, answers = {}) {
  if (!report || typeof report !== 'object') return report

  // mission_board: wrap into object if returned as an array
  if (Array.isArray(report.mission_board)) {
    report.mission_board = {
      xp_level: 'Level 3: Active Strategist',
      xp_current: 500,
      missions: report.mission_board,
    }
  }

  // funnel_stages: ensure object shape and seed from answers
  const userFunnel = deriveFunnelFromAnswers(answers)
  if (!report.funnel_stages || Array.isArray(report.funnel_stages) || typeof report.funnel_stages !== 'object') {
    report.funnel_stages = {
      ...userFunnel,
      diagnosis_message: userFunnel.applications_count >= 30 && (userFunnel.recruiter_calls_count / userFunnel.applications_count) < 0.05
        ? `You submitted ${userFunnel.applications_count} applications and ${userFunnel.outreach_count} direct recruiter outreach messages, yielding only ${userFunnel.recruiter_calls_count} responses (${((userFunnel.recruiter_calls_count / userFunnel.applications_count) * 100).toFixed(1)}% conversion rate).`
        : (userFunnel.recruiter_calls_count / (userFunnel.applications_count || 1)) > 0.25
        ? `Solid recruiter callback rate (${userFunnel.recruiter_calls_count} screens from ${userFunnel.applications_count} applications), but pipeline experiences steep drop-off between Recruiter Screens (${userFunnel.recruiter_calls_count}) and Final Offers (${userFunnel.offers_count}).`
        : 'High application drop-off detected at early recruiter screening.',
    }
  } else {
    report.funnel_stages.applications_count = userFunnel.applications_count !== undefined ? userFunnel.applications_count : report.funnel_stages.applications_count
    report.funnel_stages.applications_period = userFunnel.applications_period || report.funnel_stages.applications_period || 'month'
    report.funnel_stages.outreach_count = userFunnel.outreach_count !== undefined ? userFunnel.outreach_count : (report.funnel_stages.outreach_count ?? 0)
    report.funnel_stages.outreach_period = userFunnel.outreach_period || report.funnel_stages.outreach_period || userFunnel.applications_period
    report.funnel_stages.recruiter_calls_count = userFunnel.recruiter_calls_count !== undefined ? userFunnel.recruiter_calls_count : report.funnel_stages.recruiter_calls_count
    report.funnel_stages.responses_period = userFunnel.responses_period || report.funnel_stages.responses_period || userFunnel.applications_period
    report.funnel_stages.interviews_count = userFunnel.interviews_count !== undefined ? userFunnel.interviews_count : report.funnel_stages.interviews_count
    report.funnel_stages.final_rounds_count = userFunnel.final_rounds_count !== undefined ? userFunnel.final_rounds_count : report.funnel_stages.final_rounds_count
    report.funnel_stages.offers_count = userFunnel.offers_count !== undefined ? userFunnel.offers_count : report.funnel_stages.offers_count
    if (!report.funnel_stages.biggest_leak_stage) {
      report.funnel_stages.biggest_leak_stage = userFunnel.biggest_leak_stage
    }
  }

  // Enforce monotonic constraints without wiping raw applications_count
  if (report.funnel_stages && typeof report.funnel_stages === 'object') {
    let fApps = Number(report.funnel_stages.applications_count) || 0
    if (fApps > 1000) {
      fApps = Math.min(Math.round(fApps / 100), 250)
    }
    let fCalls = Math.min(Math.max(0, Number(report.funnel_stages.recruiter_calls_count) || 0), fApps > 0 ? fApps : 9999)
    let fInterviews = Math.min(Math.max(0, Number(report.funnel_stages.interviews_count) || 0), fCalls)
    let fFinals = Math.min(Math.max(0, Number(report.funnel_stages.final_rounds_count) || 0), fInterviews)
    let fOffers = Math.min(Math.max(0, Number(report.funnel_stages.offers_count) || 0), fFinals)

    report.funnel_stages.applications_count = fApps
    report.funnel_stages.recruiter_calls_count = fCalls
    report.funnel_stages.interviews_count = fInterviews
    report.funnel_stages.final_rounds_count = fFinals
    report.funnel_stages.offers_count = fOffers

    if (fApps >= 30 && (fCalls / fApps) < 0.05) {
      report.funnel_stages.biggest_leak_stage = `High-Volume Application Black Hole (${((fCalls / fApps) * 100).toFixed(1)}% Response Rate)`
      report.funnel_stages.diagnosis_message = `You submitted ${fApps} applications and ${report.funnel_stages.outreach_count || 0} direct recruiter outreach messages, yielding only ${fCalls} responses (${((fCalls / fApps) * 100).toFixed(1)}% conversion rate).`
    } else if (fApps > 0 && fCalls / fApps > 0.25) {
      if (!report.funnel_stages.biggest_leak_stage || report.funnel_stages.biggest_leak_stage.toLowerCase().includes('application')) {
        report.funnel_stages.biggest_leak_stage = `Recruiter Screens (${fCalls}) to Final Offers (${fOffers})`
      }
      if (!report.funnel_stages.diagnosis_message || report.funnel_stages.diagnosis_message.toLowerCase().includes('black-hole') || report.funnel_stages.diagnosis_message.toLowerCase().includes('early recruiter')) {
        report.funnel_stages.diagnosis_message = `Solid recruiter callback rate (${fCalls} screens from ${fApps} applications), but pipeline experiences steep drop-off between Recruiter Screens (${fCalls}) and Final Offers (${fOffers}).`
      }
    }
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
  // Phase E-fix: Atlas routes through the LLM gateway with gemini-3.5-flash-lite as primary
  // and groq (openai/gpt-oss-120b) as immediate failover so report synthesis never starves.
  try {
    const { text: responseText } = await llmGateway.generate({
      purpose: 'assessment_report',
      task: 'report_generation',
      model: 'gemini-3.5-flash-lite',
      messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + extraInstructions }],
      responseFormat: 'json_object',
      temperature: 0.4,
      maxTokens: 4096,
      maxRetries: 2,
      treatLengthAsRetryable: true,
    })
    return normalizeAtlasShapes(parseAtlasJson(responseText), userAnswers)
  } catch (primaryErr) {
    console.warn('[ReportGeneration] Atlas generation via primary model failed/timed out. Falling back to Groq (openai/gpt-oss-120b):', primaryErr.message)
    const { text: responseText } = await llmGateway.generate({
      purpose: 'assessment_report',
      task: 'report_generation',
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + extraInstructions }],
      responseFormat: 'json_object',
      temperature: 0.4,
      maxTokens: 3500,
      treatLengthAsRetryable: true,
      bypassCache: true,
    })
    return normalizeAtlasShapes(parseAtlasJson(responseText), userAnswers)
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

  const resumeTargetRole =
    effectiveSemanticProfile?.targetRole ||
    effectiveSemanticProfile?.target_role ||
    user.answers?.targetRole ||
    user.resumeJson?.target_role ||
    ''

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

    const canonicalForWeaving = activeResumeAgent?.canonicalResume || effectiveCanonicalResume || user.resumeJson
    if (canonicalForWeaving) {
      const { tailoredExperiences, interviewLedger: ledger } = weaveKeywordsAndBuildLedger({
        canonicalResume: canonicalForWeaving,
        missingKeywords: missingSkillsList,
      })
      if (tailoredExperiences && tailoredExperiences.length > 0) {
        if (activeResumeAgent && activeResumeAgent.canonicalResume) {
          activeResumeAgent.canonicalResume.experiences = tailoredExperiences
        }
        if (aiReport.resume_json) {
          aiReport.resume_json.experiences = tailoredExperiences
        }
      }
      interviewLedger = ledger || []
      if (activeResumeAgent) {
        activeResumeAgent.interviewLedger = interviewLedger
      }
    }
  } catch (_weaveErr) {
    console.warn('[reportGeneration] weaveKeywordsAndBuildLedger warning:', _weaveErr.message || _weaveErr)
  }

  aiReport.interview_ledger = interviewLedger

  // Attach verified agent diagnoses and V2 Career GPS metrics
  aiReport.resume_agent = activeResumeAgent
  aiReport.linkedin_agent = activeLinkedinAgent
  aiReport.assessment_agent = effectiveAssessmentAgent

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

  // Synchronize score_breakdown.resume with the Resume Agent scorecard
  if (activeResumeAgent?.dashboard?.score !== undefined) {
    if (!aiReport.score_breakdown) aiReport.score_breakdown = {}
    if (!aiReport.score_breakdown.resume) aiReport.score_breakdown.resume = {}
    aiReport.score_breakdown.resume.score = activeResumeAgent.dashboard.score
    aiReport.score_breakdown.resume.grade = activeResumeAgent.dashboard.grade || (activeResumeAgent.dashboard.score >= 85 ? 'A' : activeResumeAgent.dashboard.score >= 70 ? 'B' : activeResumeAgent.dashboard.score >= 55 ? 'C' : 'D')
  }

  // Synchronize score_breakdown.linkedin with the LinkedIn Agent
  const liScore = activeLinkedinAgent?.score ?? aiReport.score_breakdown?.linkedin?.score ?? 55
  const topLiIssue = activeLinkedinAgent?.discrepancies?.[0]?.title || activeLinkedinAgent?.topRecommendations?.[0] || 'missing featured project case studies and peer recommendations'
  if (!aiReport.score_breakdown) aiReport.score_breakdown = {}
  if (!aiReport.score_breakdown.linkedin) aiReport.score_breakdown.linkedin = {}
  aiReport.score_breakdown.linkedin.score = liScore
  aiReport.score_breakdown.linkedin.grade = activeLinkedinAgent?.grade || (liScore >= 85 ? 'A' : liScore >= 70 ? 'B' : liScore >= 55 ? 'C' : 'D')
  if (!aiReport.score_breakdown.linkedin.diagnosis || aiReport.score_breakdown.linkedin.diagnosis.length < 120) {
    aiReport.score_breakdown.linkedin.diagnosis = `Your LinkedIn profile scores ${liScore}/100 with strong role descriptions and network reach, but recruiter trust and inbound search visibility are held back by ${topLiIssue.toLowerCase()}.`
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
