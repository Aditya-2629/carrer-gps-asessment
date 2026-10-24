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
import { judgeReport } from '../agents/judge/judgeAgent.js'
import AgentRun from '../models/AgentRun.js'
import { jsonrepair } from 'jsonrepair'

// ── Atlas completeness machinery (fixes truncated/incomplete reports) ───────
// The Atlas JSON is large (13+ sections); without an explicit output budget
// Gemini truncates it and whole widgets (funnel, risk heatmap, mission board)
// silently vanish. We now: budget the output, repair-parse, verify section
// completeness, and retry once when the draft is incomplete.

const REQUIRED_ATLAS_FIELDS = ['career_health_score', 'score_label', 'score_breakdown', 'market_reality_check', 'critical_issues', 'roadmap']
const ATLAS_ARRAY_SECTIONS = ['funnel_stages', 'risk_heatmap', 'mission_board', 'roadmap', 'critical_issues', 'rejection_factors']

function atlasCompleteness(report) {
  if (!report || typeof report !== 'object') return 0
  let score = 0
  for (const key of REQUIRED_ATLAS_FIELDS) {
    if (report[key] !== undefined && report[key] !== null) score += 1
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

/**
 * Fixes common LLM shape deviations so the frontend always gets the contract
 * shape. Non-Gemini models (nemotron etc.) sometimes return section objects
 * instead of arrays — e.g. mission_board: {xp_level, missions: [...]} or
 * funnel_stages: {applications_count: 100, ...}. Coerce to arrays.
 */
function normalizeAtlasShapes(report) {
  if (!report || typeof report !== 'object') return report

  // mission_board: { xp_level, missions: [...] } → lift the missions array
  if (report.mission_board && !Array.isArray(report.mission_board) && Array.isArray(report.mission_board.missions)) {
    report.mission_board = report.mission_board.missions
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
- funnel_stages, risk_heatmap, mission_board, rejection_factors, critical_issues, roadmap, recommended_tools MUST be JSON ARRAYS of objects — never objects with named keys.
- career_journey MUST be a single object: {"current_phase_id": "...", "guide_message": "..."}.
- Never wrap arrays inside wrapper objects. Never merge sections. Return every section fully populated.`

async function callAtlas(promptText, extraInstructions = '') {
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
      maxTokens: 16000,
      maxRetries: 2,
      treatLengthAsRetryable: true,
    })
    return normalizeAtlasShapes(parseAtlasJson(responseText))
  } catch (primaryErr) {
    console.warn('[ReportGeneration] Atlas generation via primary model failed/timed out. Falling back to Groq (openai/gpt-oss-120b):', primaryErr.message)
    const { text: responseText } = await llmGateway.generate({
      purpose: 'assessment_report',
      task: 'report_generation',
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: promptText + ATLAS_FORMAT_CONTRACT + extraInstructions }],
      responseFormat: 'json_object',
      temperature: 0.4,
      maxTokens: 16000,
      treatLengthAsRetryable: true,
      bypassCache: true,
    })
    return normalizeAtlasShapes(parseAtlasJson(responseText))
  }
}

export async function generateReportBundle({
  userId,
  semanticProfile,
  precomputedResumeAgent = null,
  precomputedResumeJson = null,
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

  const effectiveLinkedinUrl = user.linkedinUrl || user.answers?.linkedin || user.answers?.linkedinUrl || ''

  report('preparing', 'Building knowledge context and orchestrating agents…')

  // RAG-enhanced Knowledge Base context (baseline + uploaded documents)
  let dynamicKbContent = null
  try {
    const smartQuery = buildSmartQuery(user.answers, user.resumeJson)
    dynamicKbContent = await buildRAGContext(smartQuery)
  } catch (kbErr) {
    console.error('Error building RAG context, using default fallback:', kbErr)
  }

  const effectiveSemanticProfile = semanticProfile || user.semanticProfile || null

  const promptText = getGeminiPrompt(user.answers, user.resumeJson, user.linkedinData, dynamicKbContent, effectiveSemanticProfile)

  const resumeTargetRole =
    effectiveSemanticProfile?.targetRole ||
    effectiveSemanticProfile?.target_role ||
    user.answers?.targetRole ||
    user.resumeJson?.target_role ||
    ''

  // Atlas narrative and the agent orchestrator run in parallel (Phase B).
  report('agents_running', 'Resume + LinkedIn agents analyzing in parallel with Atlas…')

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
        canonicalResume: precomputedResumeAgent.canonicalResume || user.resumeJson || null,
        resumeTargetRole,
        linkedinUrl: effectiveLinkedinUrl,
        linkedinData: user.linkedinData || null,
        userId: user._id,
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
      canonicalResume: user.resumeJson || null,
      resumeTargetRole,
      linkedinUrl: effectiveLinkedinUrl,
      linkedinData: user.linkedinData || null,
      userId: user._id,
      onProgress: (e) => {
        const st = e.stage.startsWith('agent_') ? e.stage : `agent_${e.agent}_${e.stage}`
        report(st, e.message)
      },
    })
  }

  // Atlas draft with completeness guard: if the model returns a partial JSON
  // (missing sections), retry ONCE with an explicit completeness instruction
  // and keep whichever draft is more complete.
  report('atlas_roadmap', 'Generating Atlas strategic career roadmap & executive diagnostic…')
  let aiReport = await callAtlas(promptText)
  let draftCompleteness = atlasCompleteness(aiReport)
  if (draftCompleteness < REQUIRED_ATLAS_FIELDS.length + ATLAS_ARRAY_SECTIONS.length - 2) {
    report('composing', 'First draft was incomplete — asking Atlas for the full report…')
    try {
      const retryDraft = await callAtlas(
        promptText,
        '\n\nIMPORTANT: Your previous response was incomplete. Return the COMPLETE JSON object with EVERY section fully populated — especially funnel_stages, risk_heatmap, mission_board, rejection_factors, career_journey, and recommended_tools. Do not skip or shorten any array. If a section is long, prioritize completeness over prose length.'
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
  if (user.resumeJson) {
    aiReport.resume_json = user.resumeJson
  }
  if (user.linkedinData) {
    aiReport.linkedin_json = user.linkedinData
  }

  // Attach both agent diagnoses once the orchestrator settles. Either agent
  // can be null (no data / failed) without breaking the report.
  const result = await agentsPromise
  aiReport.resume_agent = result?.resumeAgent || null
  aiReport.linkedin_agent = result?.linkedinAgent || null
  if (!aiReport.linkedin_json && result?.linkedinData) {
    aiReport.linkedin_json = result.linkedinData
    user.linkedinData = result.linkedinData
  }

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
        for (const key of ['resume_json', 'linkedin_json', 'resume_agent', 'linkedin_agent', 'dashboard']) {
          if (source[key] !== undefined) target[key] = source[key]
        }
        return target
      }

      if (typeof judge?.score === 'number' && judge.score < 7 && judge.fallback !== true) {
        report('quality_pass', 'Judge found quality gaps — regenerating the narrative once with its notes…')
        try {
          const repairNotes = (judge.flags || []).join('; ') || 'Be more specific and warmer; cite the candidate’s actual words.'
          const retryPrompt = `${promptText}\n\nQUALITY NOTES FROM YOUR REVIEWER (fix these in your JSON):\n- ${repairNotes}`
          const retryReport = await callAtlas(retryPrompt)
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
