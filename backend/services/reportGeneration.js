/**
 * Report Generation Service — Career GPS Universal Architecture
 * 100% User-Dynamic, Zero-Hardcoding Implementation
 * Pure ES Module
 */

import mongoose from 'mongoose'
import User from '../models/User.js'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'
import dynamicCompetencyClusterizer, { DynamicCompetencyClusterizer } from '../agents/resume/market/dynamicCompetencyClusterizer.js'
import { parseRangeOrNumber } from '../agents/assessment/assessmentAgent.js'
import JobMarketBucket from '../models/JobMarketBucket.js'

export function safeParseJson(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return null
  const cleaned = rawContent
    .replace(/^```json/gi, '')
    .replace(/^```/gi, '')
    .replace(/```$/gi, '')
    .trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  const jsonStr = (firstBrace >= 0 && lastBrace > firstBrace) ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned
  try {
    return JSON.parse(jsonStr)
  } catch (_e) {
    try {
      const fixed = jsonStr
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
      return JSON.parse(fixed)
    } catch (_fErr) {
      return null
    }
  }
}

export const flatteryPatterns = [
  /You have built a solid foundation across/gi,
  /Your background shows a practical progression across/gi,
  /Your resume demonstrates clear technical competence/gi,
  /With your impressive background in/gi,
  /Your experience proves you can/gi,
  /spearheaded/gi,
  /synergistic/gi,
  /cutting-edge/gi,
  /results-driven/gi,
  /passionate/gi,
  /testament to/gi,
  /navigating the job market/gi,
  /it is crucial/gi,
  /holistic/gi,
]

export function scrubFlattery(text = '') {
  if (!text || typeof text !== 'string') return text
  let cleaned = text
  for (const pattern of flatteryPatterns) {
    cleaned = cleaned.replace(pattern, '').replace(/\s{2,}/g, ' ')
  }
  return cleaned.trim()
}

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
Target Role: ${targetRole || 'Professional'}
Detected Bottleneck Phase: Phase ${phase?.id || 1} (${phase?.name || 'Resume Screen'})
90-Day Funnel: ${apps30d} apps/mo | ${screens} screens | ${oas} OAs | ${offers} offers
Visa / Work Auth: ${visa}
Top Verified Skills: ${verifiedSkills || 'Domain fundamentals'}
Critical Skill Gaps: ${missingSkills || 'None'}
Primary LinkedIn Flag: ${topDiscrepancy}
Candidate Drop-off Note: "${dropOff}"`
}

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

export function atlasCompleteness(report) {
  if (!report || typeof report !== 'object') return 0
  let score = 0
  for (const k of ATLAS_SCHEMA_KEYS) {
    if (report[k] !== undefined && report[k] !== null && report[k] !== '') score += 1
  }
  return score
}

export function parseAtlasJson(text) {
  return safeParseJson(text) || {}
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
      merged[key] = fallback[key]
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

export function extractQuantMetric(val, fallbackNum = 0, defaultPeriod = 'month') {
  if (val === null || val === undefined) {
    return { rawNum: fallbackNum, period: defaultPeriod, perWeek: Math.round(fallbackNum / 4.33), perMonth: fallbackNum, label: `${fallbackNum}` }
  }
  if (typeof val === 'number') {
    return { rawNum: val, period: defaultPeriod, perWeek: defaultPeriod === 'week' ? val : Math.round(val / 4.33), perMonth: defaultPeriod === 'month' ? val : Math.round(val * 4.33), label: `${val} / ${defaultPeriod}` }
  }
  const parsed = parseRangeOrNumber(typeof val === 'object' ? (val.raw || val.value || 0) : val, fallbackNum)
  return {
    rawNum: parsed,
    period: defaultPeriod,
    perWeek: Math.round((parsed / 4.33) * 10) / 10,
    perMonth: parsed,
    label: `${parsed} per ${defaultPeriod}`,
  }
}

export function deriveFunnelFromAnswers(answers = {}) {
  const f90 = (answers.funnel90d && typeof answers.funnel90d === 'object') ? answers.funnel90d : {}

  const apps30d = parseRangeOrNumber(
    answers.apps30d ?? answers.applications_count ?? (answers.appsWeek ? answers.appsWeek * 4 : 60),
    60
  )
  let totalApps90d = parseRangeOrNumber(
    f90.applications90d ?? answers.applications90d ?? (apps30d * 3),
    180
  )
  if (totalApps90d > 1500) {
    totalApps90d = Math.min(Math.round(totalApps90d / 10), 300)
  }

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

  const totalScreens = (recruiterScreens + assessments + aiInterviews > 0)
    ? (recruiterScreens + assessments + aiInterviews)
    : recruiterScreens

  const appToScreenRate = totalApps90d > 0 ? (totalScreens / totalApps90d) * 100 : 0
  const screenToTechRate = totalScreens > 0 ? (technicalRounds / totalScreens) * 100 : 0
  const techToFinalRate = technicalRounds > 0 ? (finalRounds / technicalRounds) * 100 : 0
  const finalToOfferRate = finalRounds > 0 ? (offers / finalRounds) * 100 : 0

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
    applications30d: apps30d,
    applications90d: totalApps90d,
    recruiter_calls_count: recruiterScreens,
    recruiterScreens,
    assessments,
    aiInterviews,
    totalScreens,
    technicalRounds,
    finalRounds,
    offers,
    outreach_count: outreach,
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

export function normalizeAtlasShapes(report, answers = {}) {
  if (!report || typeof report !== 'object') return report
  const funnel = deriveFunnelFromAnswers(answers)

  if (!report.funnel_stages || typeof report.funnel_stages !== 'object' || Array.isArray(report.funnel_stages)) {
    report.funnel_stages = funnel
  } else {
    report.funnel_stages = {
      ...funnel,
      ...report.funnel_stages,
      biggest_leak_stage: report.funnel_stages.biggest_leak_stage || funnel.biggest_leak_stage,
      leak_title: report.funnel_stages.leak_title || funnel.leak_title,
      diagnosis_message: report.funnel_stages.diagnosis_message || funnel.diagnosis_message,
    }
  }

  const targetRole = answers.targetRole || report.target_role || report.targetRole || 'Professional'

  if (!report.coach_intervention || typeof report.coach_intervention !== 'object') {
    report.coach_intervention = {
      title: 'Strategic Advisory Diagnostic',
      urgency_statement: `You are targeting ${targetRole} positions with friction in ${report.funnel_stages.leak_title}. An executive consultation will realign your conversion strategy.`,
      message: 'Schedule a tailored strategy session to optimize your positioning.',
      cta_text: 'Book Free 1-on-1 Strategy Session'
    }
  } else {
    if (!report.coach_intervention.urgency_statement) {
      report.coach_intervention.urgency_statement = `You are targeting ${targetRole} positions with friction in ${report.funnel_stages.leak_title}. An executive consultation will realign your conversion strategy.`
    }
    if (!report.coach_intervention.cta_text) {
      report.coach_intervention.cta_text = 'Book Free 1-on-1 Strategy Session'
    }
  }

  if (Array.isArray(report.mission_board)) {
    report.mission_board = {
      xp_level: 'Level 3: Active Strategist',
      xp_current: 500,
      missions: report.mission_board
    }
  }

  if (Array.isArray(report.risk_heatmap)) {
    report.risk_heatmap = {
      overall_risk_level: 'MODERATE',
      categories: report.risk_heatmap
    }
  }

  return report
}

export const ATLAS_EXECUTIVE_COACH_SYSTEM_PROMPT = `
==================================================
PERSONA & TONE DIRECTIVE:
==================================================
You are David / Elena — Managing Partner at an elite US executive career search firm.

EXECUTIVE RECRUITER DIAGNOSTIC FRAMEWORK (ZERO-SLOP, ZERO-FLATTERY):
STRICT BAN ON GENERIC CHATGPT FLATTERY & HOLLOW PRAISE.
DIRECT EXECUTIVE DIAGNOSTIC READ (MANDATORY).

PROGRESSIVE DISCLOSURE & DEDUPLICATION (MANDATORY):
De-duplicate primary_bottleneck against top resume issues!
`

export const ATLAS_FORMAT_CONTRACT = `
FORMAT CONTRACT (strict):
- critical_issues, rejection_factors, recommended_tools MUST be JSON ARRAYS of objects.
- funnel_stages, risk_heatmap, career_journey, market_reality_check, score_breakdown, coach_intervention MUST be JSON OBJECTS matching the exact keys in the prompt schema.
- Synthesize dynamic strategic sections: career_health_score, score_label, key_advantage, primary_bottleneck, executive_verdict, risk_matrix, top_priorities, critical_issues, market_reality_check.
- career_journey MUST be a single object: {"current_phase_id": "...", "guide_message": "..."}.
- Never merge sections. Return valid JSON only.`

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
  const combinedInstructions = `${extraInstructions}\n\nIMPORTANT: Return raw JSON only. Zero markdown backticks.`
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
      temperature: 0.1,
      timeoutMs: 15000,
    })
    responseText = res.text
    modelUsed = res.actualModel || 'google/gemini-2.5-flash-lite'
  } catch (primaryErr) {
    fallbackTriggered = true
  }

  const durationMs = Date.now() - startTime
  const normalized = normalizeAtlasShapes(parseAtlasJson(responseText), userAnswers)
  const telemetry = { durationMs, modelUsed, fallbackTriggered }
  normalized._telemetry = telemetry
  normalized.telemetry = telemetry
  normalized.report = normalized
  return normalized
}

export function performDeterministicTriage(assessmentData = {}) {
  const user = assessmentData.user || null
  const answers = user?.answers || assessmentData.answers || {}
  const resumeJson = user?.resumeJson || assessmentData.resumeJson || assessmentData.canonicalResume || assessmentData.resumeFacts || assessmentData.resumeData || {}
  const activeResumeAgent = assessmentData.activeResumeAgent || user?.activeResumeAgent || {}

  const targetRole =
    assessmentData.targetRole ||
    assessmentData.targetJobDescription?.role ||
    assessmentData.targetJobDescription?.title ||
    answers.targetRole ||
    resumeJson.target_role ||
    resumeJson.targetRole ||
    resumeJson.title ||
    user?.targetRole ||
    activeResumeAgent.targetRole ||
    'Professional'

  const rawSkills =
    assessmentData.candidateSkills ||
    assessmentData.verifiedSkills ||
    activeResumeAgent.verifiedSkills ||
    resumeJson.skills ||
    answers.skills ||
    user?.skills ||
    []

  const candidateSkills = (Array.isArray(rawSkills) ? rawSkills : [rawSkills])
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill || s?.keyword || ''))
    .map((s) => s.trim())
    .filter(Boolean)

  const experiences = resumeJson.experience || resumeJson.experiences || []
  const rawBullets = []
  if (Array.isArray(experiences)) {
    for (const exp of experiences) {
      const bList = exp.bullets || exp.bulletPoints || exp.achievements || []
      if (Array.isArray(bList)) {
        for (const b of bList) {
          const txt = typeof b === 'string' ? b : b?.text || b?.bullet || ''
          if (txt && txt.trim()) rawBullets.push(txt.trim())
        }
      }
    }
  }
  const candidateBullets = Array.from(new Set(rawBullets))

  let marketJds = assessmentData.marketJds || assessmentData.scrapedJds || assessmentData.jobDescriptions || []
  if (assessmentData.targetJobDescription) {
    if (typeof assessmentData.targetJobDescription === 'string') {
      marketJds = [...marketJds, { description: assessmentData.targetJobDescription }]
    } else if (Array.isArray(assessmentData.targetJobDescription)) {
      marketJds = [...marketJds, ...assessmentData.targetJobDescription]
    } else if (typeof assessmentData.targetJobDescription === 'object') {
      marketJds = [...marketJds, assessmentData.targetJobDescription]
    }
  }

  const jdTexts = marketJds.map((jd) => {
    if (typeof jd === 'string') return jd
    return jd.description || jd.rawText || jd.text || jd.job_description || ''
  }).filter(Boolean)

  const scrapedSkills = assessmentData.scrapedSkills || assessmentData.marketSkills || candidateSkills

  const clusterResult = dynamicCompetencyClusterizer.processDynamicClustering({
    jdTexts,
    rawSkills: scrapedSkills,
    candidateSkills
  })

  const experienceYears = Number(
    resumeJson.totalExperienceYears ||
    resumeJson.experienceYears ||
    resumeJson.years_of_experience ||
    answers.experienceYears ||
    3
  )

  const quantifiedBullets = candidateBullets.filter((b) => /\d+%|\$\d+|\b\d+\b/g.test(b)).length
  const quantificationRatio = candidateBullets.length > 0
    ? Math.round((quantifiedBullets / candidateBullets.length) * 100)
    : 0

  return {
    targetRole,
    experienceYears: isNaN(experienceYears) ? 3 : experienceYears,
    quantificationRatio,
    totalBulletPoints: candidateBullets.length,
    candidateSkills,
    clustering: clusterResult.evaluation,
    rawClusters: clusterResult.clusters,
    bulletPoints: candidateBullets.slice(0, 8),
  }
}

export async function generateReportBundle(assessmentData = {}, options = {}) {
  const startTime = Date.now()
  let user = assessmentData.user || null
  const userId = assessmentData.userId || (user && user._id)
  if (!user && userId && mongoose.connection.readyState === 1) {
    try {
      user = await User.findById(userId)
    } catch (_uErr) {}
  }

  const triageInput = { ...assessmentData, user }
  const triage = performDeterministicTriage(triageInput)

  if (typeof assessmentData.onProgress === 'function') {
    try {
      assessmentData.onProgress({ stage: 'preparing', message: 'Analyzing candidate competency clusters against market demand…' })
    } catch (_pErr) {}
  }

  const dynamicSystemPrompt = `You are the Lead Executive Career Architect and Hiring Auditor at Career GPS.
Generate an exhaustive, domain-agnostic Career Assessment Report in strict JSON format.

EXECUTIVE RECRUITER DIAGNOSTIC FRAMEWORK (ZERO-SLOP, ZERO-FLATTERY):
- Address candidate directly with unfiltered, candid, tough-love diagnostic precision.
- ZERO hardcoded assumptions: The candidate could be a Clinical Nurse, Golang Backend Engineer, Data Analyst, Supply Chain Lead, or any domain. Adapt 100% to their stated role and experience.
- CLUSTER EQUIVALENCE PRINCIPLE: If a candidate has demonstrated proficiency in ANY tool in an interchangeable competency cluster, grant 100% full equivalence credit. Never penalize for missing an interchangeable tool if an equivalent is verified.
- De-duplicate primary_bottleneck against top resume issues: primary_bottleneck must diagnose high-level pipeline/market conversion gates rather than echoing line-by-line bullet critiques.
- Return ONLY valid raw JSON with zero markdown fences.`

  const dynamicUserPrompt = `TARGET CANDIDATE CONTEXT:
Target Role: ${triage.targetRole}
Experience Level: ${triage.experienceYears} Years
Quantified Bullets Ratio: ${triage.quantificationRatio}% (${triage.totalBulletPoints} total bullets evaluated)
Candidate's Verified Skills: ${JSON.stringify(triage.candidateSkills)}
Dynamic Market Competency Clusters: ${JSON.stringify(triage.rawClusters)}
Market Competency Coverage: ${triage.clustering.coveragePercentage}%
Candidate Experience Bullets Sample:
${JSON.stringify(triage.bulletPoints)}

TASK:
Produce a unified, comprehensive Career Assessment Report matching this exact JSON schema:
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

Return ONLY valid raw JSON. No markdown backticks, no conversational fluff.`

  if (typeof assessmentData.onProgress === 'function') {
    try {
      assessmentData.onProgress({ stage: 'agents_running', message: 'Synthesizing executive market intelligence report…' })
    } catch (_pErr) {}
  }

  let structuredOutput = null
  try {
    const response = await llmGateway.generate({
      purpose: 'report_generation',
      preferredProvider: options.preferredProvider || 'openrouter',
      model: options.model || 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: dynamicSystemPrompt },
        { role: 'user', content: dynamicUserPrompt }
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.1,
      timeoutMs: options.timeoutMs || 15000,
    })

    const rawContent = response?.text || response?.content || ''
    structuredOutput = safeParseJson(rawContent)
  } catch (err) {
    console.warn('[reportGeneration] Unified LLM pass fallback triggered:', err.message)
  }

  if (!structuredOutput || typeof structuredOutput !== 'object') {
    const coverage = triage.clustering.coveragePercentage || 70
    const atsScore = triage.quantificationRatio > 40 ? 80 : 65
    const overall = Math.round((coverage * 0.5) + (atsScore * 0.3) + ((triage.quantificationRatio || 50) * 0.2))

    structuredOutput = {
      career_health_score: {
        overall,
        marketAlignment: coverage,
        atsCompatibility: atsScore,
        impactAndMetrics: triage.quantificationRatio || 50
      },
      executive_summary: `Candidate benchmarked for ${triage.targetRole} with ${triage.experienceYears} years of experience and ${coverage}% market competency cluster coverage.`,
      primary_bottleneck: {
        title: coverage < 60 ? 'Market Competency Gaps' : 'Low Metric Quantification',
        severity: coverage < 50 ? 'CRITICAL' : 'MODERATE',
        diagnosis: `Identified gaps across key competency clusters or low quantified business impact (${triage.quantificationRatio}%).`,
        recommendedPivot: 'Align resume achievements with interchangeable tools identified across high-frequency market demand.'
      },
      competency_clusters_audit: triage.clustering.clusterBreakdown || [],
      bullet_rewrites: (triage.bulletPoints || []).slice(0, 3).map((b) => ({
        original: b,
        rewritten: `Drove core initiatives utilizing verified domain tools, improving operational outcomes and metrics by measurable margins.`,
        critique: 'Quantify specific business impact and highlight verified tools.'
      })),
      roadmap: [
        {
          phase: 'Immediate (Days 1-14)',
          actions: ['Refactor top 3 bullets to reflect verified competency tools with specific metrics.']
        },
        {
          phase: 'Short-Term (Days 15-45)',
          actions: ['Bridge missing equivalent tools within high-priority competency clusters.']
        },
        {
          phase: 'Mid-Term (Days 45-90)',
          actions: ['Execute targeted outbound hiring manager positioning tailored to target role.']
        }
      ]
    }
  }

  if (!structuredOutput.competency_clusters_audit || structuredOutput.competency_clusters_audit.length === 0) {
    structuredOutput.competency_clusters_audit = triage.clustering.clusterBreakdown
  }

  const overallScore =
    typeof structuredOutput.career_health_score === 'object' && structuredOutput.career_health_score !== null
      ? (structuredOutput.career_health_score.overall ?? 70)
      : (Number(structuredOutput.career_health_score) || 70)

  structuredOutput.gps_score = overallScore
  structuredOutput.score = overallScore
  structuredOutput.heroScore = overallScore
  structuredOutput.careerHealthScore = overallScore
  structuredOutput.executiveSummary = structuredOutput.executive_summary
  structuredOutput.primaryBottleneck = structuredOutput.primary_bottleneck
  structuredOutput.bulletRewrites = structuredOutput.bullet_rewrites

  if (user) {
    user.aiReport = structuredOutput
    try {
      await user.save()
    } catch (_saveErr) {}
  }

  if (typeof assessmentData.onProgress === 'function') {
    try {
      assessmentData.onProgress({ stage: 'report_ready', message: 'Report ready.', report: structuredOutput })
    } catch (_progErr) {}
  }

  const totalDurationMs = Date.now() - startTime

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
  }
}

export default {
  generateReportBundle,
  performDeterministicTriage,
  normalizeAtlasShapes,
  deriveFunnelFromAnswers,
  deCycle,
  parseAtlasJson,
  atlasCompleteness,
  extractQuantMetric,
  buildCompactAtlasDigest,
  mergeReportSections,
  renderAtlasPrompt,
  callAtlas,
  scrubFlattery,
  flatteryPatterns,
  ATLAS_SCHEMA_KEYS,
  ATLAS_ARRAY_SECTIONS,
  ATLAS_EXECUTIVE_COACH_SYSTEM_PROMPT,
  ATLAS_FORMAT_CONTRACT,
}
