/**
 * Mode B: Specialized Parallel Agents — Career GPS Resume Agent V3.1
 *
 * Implements Section 4: Runs specialized reasoning tasks in parallel:
 * - Agent 1: Resume Auditor (Internal resume quality, ownership, quantification, ATS signals)
 * - Agent 2: Target JD Matcher (Target JD alignment, keyword/responsibility match, NOT_EVIDENCED_IN_RESUME)
 * - Agent 3: Market Gap Analyst (Market profile & seniority signals comparison, Market gap != skill gap)
 *
 * Followed by:
 * - Agent 4 / Consolidator: Validates findings and consolidates into canonical report schema.
 */

import { serializeResumeForLLM } from '../resumeAgent.inputSerializer.js'
import { formatCompactSignalSummary } from '../signals/signalEngine.js'
import { formatMarketProfileForPrompt } from '../market/marketProfileBuilder.js'
import { ResumeAgentValidator } from '../resumeAgent.validator.js'
import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { resolveTaskPolicy } from './taskPolicy.js'

export const MODE_B_NAME = 'specialized_parallel_agents'

// ── Agent 1: Resume Auditor Prompt ────────────────────────────────────────────
function buildAuditorPrompt(compactResume, signals, precomputedSignals) {
  const signalSummary = formatCompactSignalSummary(signals)
  return [
    {
      role: 'system',
      content: `You are a Senior Technical Resume Auditor.
Analyze ONLY internal resume quality, language strength, ownership, quantification, structure, and ATS readability.
Do NOT invent facts, numbers, or technologies not present in the resume.

Output a valid JSON object:
{
  "auditorReview": "2-3 sentences on overall resume execution",
  "internalStrengths": [
    { "title": "string", "observation": "string", "evidenceBulletId": "string" }
  ],
  "internalIssues": [
    {
      "category": "impact" | "clarity" | "ownership_clarity" | "repetition" | "ats_readability" | "credibility",
      "severity": "high" | "medium" | "low",
      "title": "string",
      "bulletId": "string",
      "originalText": "exact verbatim quote from resume",
      "diagnosis": "string",
      "whyItMatters": "string",
      "recommendation": "string",
      "suggestedRewrite": "conservative text using ONLY resume facts, or null"
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `CANDIDATE RESUME:
${compactResume}

DETERMINISTIC SIGNALS:
${signalSummary}
Quantification Density: ${precomputedSignals?.quantificationRollup?.density ?? 'N/A'}
Contact Merged: ${precomputedSignals?.contactMerge?.isContactMerged ?? false}

Audit this resume now. Return ONLY the valid JSON object.`,
    },
  ]
}

// ── Agent 2: Target JD Matcher Prompt ─────────────────────────────────────────
function buildJdMatcherPrompt(compactResume, targetRole, targetJobDescription) {
  return [
    {
      role: 'system',
      content: `You are a Technical Hiring Matcher evaluating a resume against a specific target Job Description.
Evaluate alignment, required technical competencies, and responsibility overlap.

CRITICAL RULES:
1. Never state that the candidate lacks a skill simply because it is not mentioned. Use "NOT_EVIDENCED_IN_RESUME".
2. Match explicitly against the candidate resume and target JD only.

Output a valid JSON object:
{
  "alignmentSummary": "2-3 sentences summarizing target role fit",
  "targetStrengths": [
    { "skill": "string", "evidence": "string", "bulletId": "string" }
  ],
  "targetGaps": [
    {
      "skill": "string",
      "status": "NOT_EVIDENCED_IN_RESUME",
      "importance": "high" | "medium" | "low",
      "observation": "Explicitly requested by target JD, but current resume does not provide direct evidence."
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `TARGET ROLE: ${targetRole || 'Not specified'}

TARGET JOB DESCRIPTION:
${targetJobDescription || 'No explicit target job description provided.'}

CANDIDATE RESUME:
${compactResume}

Analyze target JD alignment now. Return ONLY the valid JSON object.`,
    },
  ]
}

// ── Agent 3: Market Gap Analyst Prompt ────────────────────────────────────────
function buildMarketAnalystPrompt(compactResume, targetRole, marketProfile, marketContext) {
  const marketProfileText = marketProfile
    ? formatMarketProfileForPrompt(marketProfile)
    : 'No active market profile available.'

  return [
    {
      role: 'system',
      content: `You are a Technical Job Market Analyst.
Compare the candidate resume against real-world sampled market requirements for this role & seniority level.

CRITICAL RULES:
1. Market gap != candidate skill gap.
2. Frame observations as: "Appears in X of 5 sampled market JDs, but is not evidenced in the current resume."
3. Never claim "Candidate does not know X" or "X is mandatory for this role".

Output a valid JSON object:
{
  "marketContextSummary": "2-3 sentences on market positioning",
  "marketStrengths": [
    { "skill": "string", "frequency": number, "observation": "string" }
  ],
  "marketObservations": [
    {
      "skill": "string",
      "marketFrequency": number,
      "sampleSize": number,
      "observation": "string"
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `TARGET ROLE: ${targetRole || 'Software Professional'}
BUCKET: ${marketContext?.bucketKey || 'general'}

${marketProfileText}

CANDIDATE RESUME:
${compactResume}

Evaluate market positioning now. Return ONLY the valid JSON object.`,
    },
  ]
}

// ── Agent 4 / Consolidator Prompt ─────────────────────────────────────────────
function buildConsolidatorPrompt(
  compactResume,
  auditorOutput,
  jdMatcherOutput,
  marketAnalystOutput,
  precomputedSignals
) {
  return [
    {
      role: 'system',
      content: `You are a Principal Executive Recruiter consolidating specialist findings into the final Career GPS Resume Analysis Report.
You must synthesize the findings into a cohesive, non-contradictory report conforming strictly to the V2.2 schema.

CRITICAL RULES:
1. Return 3 to 7 high-impact issues only.
2. Every issue MUST contain verbatim originalText from the candidate resume.
3. Distinguish Resume Quality issues, Target JD Alignment, and Market Context.
4. Rewrites must NEVER invent new metrics, escalate ownership (supported -> led), or add new tools.
5. Follow all language guardrails: no "You don't know", no ungrounded rejection threats.

REQUIRED JSON SCHEMA:
{
  "analysisVersion": "2.2",
  "candidateSnapshot": {
    "name": "string",
    "targetRole": "string",
    "experienceLevel": "string",
    "currentSeniority": "string",
    "primaryProfile": "string"
  },
  "dashboard": null,
  "overallReview": "2-4 paragraphs conversational, direct recruiter assessment",
  "strengths": [
    {
      "title": "string",
      "evidence": { "section": "string", "itemId": "string", "bulletId": "string", "originalText": "verbatim text" },
      "whyItWorks": "string",
      "impact": "string"
    }
  ],
  "issues": [
    {
      "id": "iss_001",
      "severity": "high" | "medium" | "low",
      "category": "impact" | "clarity" | "positioning" | "structure" | "credibility" | "outcome_visibility" | "repetition" | "ats_readability" | "ownership_clarity" | "skill_evidence_gap" | "us_market_alignment",
      "title": "string",
      "evidence": { "section": "string", "itemId": "string", "bulletId": "string", "originalText": "verbatim text from resume" },
      "diagnosis": "string",
      "whyItMatters": "string",
      "recommendation": "string",
      "correctedText": "string or null",
      "metricDiscoveryQuestions": [],
      "correctionType": "rewrite" | "trim" | "clarification" | "restructure" | "none",
      "confidence": number
    }
  ],
  "priorityActions": [
    { "order": 1, "title": "string", "description": "string", "expectedImpact": "string" },
    { "order": 2, "title": "string", "description": "string", "expectedImpact": "string" },
    { "order": 3, "title": "string", "description": "string", "expectedImpact": "string" }
  ]
}`,
    },
    {
      role: 'user',
      content: `CANDIDATE RESUME:
${compactResume}

SPECIALIST FINDINGS:
1. RESUME AUDITOR:
${JSON.stringify(auditorOutput || {}, null, 2)}

2. TARGET JD MATCHER:
${JSON.stringify(jdMatcherOutput || {}, null, 2)}

3. MARKET GAP ANALYST:
${JSON.stringify(marketAnalystOutput || {}, null, 2)}

Consolidate these findings into the required V2.2 JSON schema now. Return ONLY valid JSON.`,
    },
  ]
}

/**
 * Executes Mode B: Specialized Parallel Agents
 *
 * @param {Object} params
 * @param {Object} params.state - ResumeState instance
 * @param {Object} params.canonicalResume
 * @param {string} [params.targetRole]
 * @param {string} [params.targetJobDescription]
 * @param {Object} [params.taskPolicies]
 * @param {boolean} [params.isBenchmark=false]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function executeModeB({
  state,
  canonicalResume,
  taskPolicies = {},
  model = null,
  isBenchmark = false,
  signal = null,
}) {
  const startTime = Date.now()
  const llmCalls = []

  const compactResume = serializeResumeForLLM(canonicalResume)
  const targetRole = state?.candidateSnapshot?.targetRole || 'Software Professional'
  const targetJobDescription = state?.targetJobDescription || ''
  const marketProfile = state?.marketProfile || null
  const marketContext = state?.marketContext || null
  const signals = state?.signals || {}
  const precomputedSignals = state?.precomputedSignals || {}

  // 1. Resolve Policies for parallel agents
  const effectivePolicies = model
    ? {
        resume_audit: { model, ...(typeof taskPolicies?.resume_audit === 'object' ? taskPolicies.resume_audit : {}) },
        jd_match: { model, ...(typeof taskPolicies?.jd_match === 'object' ? taskPolicies.jd_match : {}) },
        market_gap: { model, ...(typeof taskPolicies?.market_gap === 'object' ? taskPolicies.market_gap : {}) },
        final_synthesis: { model, ...(typeof taskPolicies?.final_synthesis === 'object' ? taskPolicies.final_synthesis : {}) },
        ...taskPolicies,
      }
    : taskPolicies

  const auditPolicy = resolveTaskPolicy('resume_audit', effectivePolicies)
  const jdPolicy = resolveTaskPolicy('jd_match', effectivePolicies)
  const marketPolicy = resolveTaskPolicy('market_gap', effectivePolicies)
  const synthPolicy = resolveTaskPolicy('final_synthesis', effectivePolicies)

  // 2. Launch Agents 1, 2, and 3 concurrently in parallel
  const parallelCalls = [
    // Agent 1: Resume Auditor
    (async () => {
      const callStart = Date.now()
      const messages = buildAuditorPrompt(compactResume, signals, precomputedSignals)
      const res = await llmGateway.generate({
        purpose: 'resume_analysis',
        messages,
        model: auditPolicy.model,
        isBenchmark,
        responseFormat: 'json_object',
        temperature: auditPolicy.temperature ?? 0.1,
        maxTokens: auditPolicy.maxTokens ?? 4096,
        signal,
      })
      const dur = Date.now() - callStart
      llmCalls.push({
        task: 'resume_audit',
        model: res.actualModel || auditPolicy.model,
        provider: res.provider || auditPolicy.provider,
        latencyMs: dur,
        inputTokens: res.tokens?.prompt || 0,
        outputTokens: res.tokens?.completion || 0,
        totalTokens: res.tokens?.total || 0,
      })
      try {
        return JSON.parse(res.text)
      } catch (_e) {
        return { auditorReview: res.text, internalIssues: [] }
      }
    })(),

    // Agent 2: Target JD Matcher
    (async () => {
      const callStart = Date.now()
      const messages = buildJdMatcherPrompt(compactResume, targetRole, targetJobDescription)
      const res = await llmGateway.generate({
        purpose: 'resume_analysis',
        messages,
        model: jdPolicy.model,
        isBenchmark,
        responseFormat: 'json_object',
        temperature: jdPolicy.temperature ?? 0.1,
        maxTokens: jdPolicy.maxTokens ?? 3072,
        signal,
      })
      const dur = Date.now() - callStart
      llmCalls.push({
        task: 'jd_match',
        model: res.actualModel || jdPolicy.model,
        provider: res.provider || jdPolicy.provider,
        latencyMs: dur,
        inputTokens: res.tokens?.prompt || 0,
        outputTokens: res.tokens?.completion || 0,
        totalTokens: res.tokens?.total || 0,
      })
      try {
        return JSON.parse(res.text)
      } catch (_e) {
        return { alignmentSummary: res.text, targetGaps: [] }
      }
    })(),

    // Agent 3: Market Gap Analyst
    (async () => {
      const callStart = Date.now()
      const messages = buildMarketAnalystPrompt(compactResume, targetRole, marketProfile, marketContext)
      const res = await llmGateway.generate({
        purpose: 'resume_analysis',
        messages,
        model: marketPolicy.model,
        isBenchmark,
        responseFormat: 'json_object',
        temperature: marketPolicy.temperature ?? 0.1,
        maxTokens: marketPolicy.maxTokens ?? 3072,
        signal,
      })
      const dur = Date.now() - callStart
      llmCalls.push({
        task: 'market_gap',
        model: res.actualModel || marketPolicy.model,
        provider: res.provider || marketPolicy.provider,
        latencyMs: dur,
        inputTokens: res.tokens?.prompt || 0,
        outputTokens: res.tokens?.completion || 0,
        totalTokens: res.tokens?.total || 0,
      })
      try {
        return JSON.parse(res.text)
      } catch (_e) {
        return { marketContextSummary: res.text, marketObservations: [] }
      }
    })(),
  ]

  const [auditorResult, jdResult, marketResult] = await Promise.all(parallelCalls)

  // 3. Final Consolidation Call
  const consolidatorMessages = buildConsolidatorPrompt(
    compactResume,
    auditorResult,
    jdResult,
    marketResult,
    precomputedSignals
  )

  const consCallStart = Date.now()
  const synthResponse = await llmGateway.generate({
    purpose: 'resume_analysis',
    messages: consolidatorMessages,
    model: synthPolicy.model,
    isBenchmark,
    responseFormat: 'json_object',
    temperature: synthPolicy.temperature ?? 0.2,
    maxTokens: synthPolicy.maxTokens ?? 8192,
    signal,
  })

  llmCalls.push({
    task: 'final_synthesis',
    model: synthResponse.actualModel || synthPolicy.model,
    provider: synthResponse.provider || synthPolicy.provider,
    latencyMs: Date.now() - consCallStart,
    inputTokens: synthResponse.tokens?.prompt || 0,
    outputTokens: synthResponse.tokens?.completion || 0,
    totalTokens: synthResponse.tokens?.total || 0,
  })

  const validation = ResumeAgentValidator.validate(synthResponse.text, canonicalResume)

  const totalDuration = Date.now() - startTime
  const totalInputTokens = llmCalls.reduce((sum, c) => sum + c.inputTokens, 0)
  const totalOutputTokens = llmCalls.reduce((sum, c) => sum + c.outputTokens, 0)

  return {
    mode: MODE_B_NAME,
    success: Boolean(validation.isValid),
    analysis: validation.sanitizedAnalysis || null,
    rawModelOutput: synthResponse.text,
    specialistFindings: {
      auditor: auditorResult,
      jdMatcher: jdResult,
      marketAnalyst: marketResult,
    },
    validation,
    llmCalls,
    metrics: {
      totalDurationMs: totalDuration,
      callCount: llmCalls.length,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: synthPolicy.model,
      provider: synthPolicy.provider,
    },
  }
}

export default {
  MODE_B_NAME,
  executeModeB,
}
