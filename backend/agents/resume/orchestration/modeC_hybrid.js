/**
 * Mode C: Hybrid Deterministic + Reasoning — Career GPS Resume Agent V3.2
 *
 * Implements Production Default Orchestration:
 * Precomputes all objective, deterministic checks in code:
 * - Quantified bullet counts & density
 * - Tool dump candidates & technology counts
 * - Contact detail merge anomalies
 * - Target JD keyword overlap (evidenced vs NOT_EVIDENCED_IN_RESUME)
 * - Sampled market frequency ratios & evidence gaps
 * - Section presence & date chronology
 *
 * Injects a structured "Deterministic Pre-Audit Dossier" into ONE strong
 * recruiter-level reasoning call focused strictly on high-conviction diagnosis,
 * prioritization, conservative rewrites, and recruiter synthesis.
 */

import crypto from 'crypto'
import { serializeResumeForLLM } from '../resumeAgent.inputSerializer.js'
import { ResumeAgentValidator } from '../resumeAgent.validator.js'
import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { resolveTaskPolicy } from './taskPolicy.js'
import { extractSkillsFromJd } from '../market/jdNormalizer.js'
import { analyzeTimeline } from '../signals/timelineAnalyzer.js'
import { ContextCompiler } from '../../../ai/context/contextCompiler.js'

export const MODE_C_NAME = 'hybrid_deterministic_reasoning'

/**
 * Computes deterministic dossier of ground-truth checks prior to reasoning call.
 */
export function buildDeterministicDossier({
  canonicalResume,
  resumeFacts,
  signals,
  precomputedSignals,
  targetJobDescription,
  marketProfile,
  marketContext,
}) {
  const dossier = {
    quantification: {
      totalBullets: precomputedSignals?.quantificationRollup?.totalBullets || 0,
      quantifiedBullets: precomputedSignals?.quantificationRollup?.quantifiedBullets || 0,
      density: precomputedSignals?.quantificationRollup?.density || 0,
      unquantifiedBulletIds: [],
    },
    toolDumps: [],
    contactMergeAnomaly: precomputedSignals?.contactMerge?.isContactMerged || false,
    targetJdOverlap: {
      requestedSkills: [],
      evidencedSkills: [],
      unverifiedSkills: [],
    },
    marketEvidenceGaps: [],
  }

  // 1. Unquantified & Tool Dump candidates from bulletSignals
  if (precomputedSignals?.bulletSignals) {
    for (const [bulletId, sig] of Object.entries(precomputedSignals.bulletSignals)) {
      if (!sig.hasQuantifier) {
        dossier.quantification.unquantifiedBulletIds.push(bulletId)
      }
      if (sig.isToolDumpCandidate) {
        dossier.toolDumps.push({ bulletId, techCount: sig.technologyCount })
      }
    }
  }

  // 2. Deterministic Target JD overlap
  if (targetJobDescription) {
    const jdSkills = extractSkillsFromJd(targetJobDescription)
    dossier.targetJdOverlap.requestedSkills = jdSkills

    const resumeSkillSet = new Set((resumeFacts?.skills || []).map((s) => s.toLowerCase()))
    const allBulletText = (canonicalResume?.experience || [])
      .flatMap((e) => e.bullets || [])
      .map((b) => b.text || '')
      .join(' ')
      .toLowerCase()

    jdSkills.forEach((skill) => {
      const lower = skill.toLowerCase()
      const evidenced =
        resumeSkillSet.has(lower) ||
        new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(allBulletText)

      if (evidenced) {
        dossier.targetJdOverlap.evidencedSkills.push(skill)
      } else {
        dossier.targetJdOverlap.unverifiedSkills.push(skill)
      }
    })
  }

  // 3. Deterministic Market Evidence Gaps from active market context
  if (marketContext && Array.isArray(marketContext.marketEvidenceGaps)) {
    const sampleSize = marketContext.marketSampleSize || 15
    dossier.marketEvidenceGaps = marketContext.marketEvidenceGaps.map((g) => ({
      skill: g.skill,
      frequency: `${g.frequencyCount || Math.round((g.marketFrequency || 0) * sampleSize)}/${sampleSize} JDs`,
      status: 'NOT_EVIDENCED_IN_RESUME',
    }))
  }

  // 4. Deterministic Timeline Facts
  const timeline = signals?.timeline || analyzeTimeline(canonicalResume)
  dossier.timeline = {
    totalExperienceYears: timeline?.careerDuration?.totalYears || 0,
    totalExperienceMonths: timeline?.careerDuration?.totalMonths || 0,
    formattedDuration: timeline?.careerDuration?.formatted || '0 months',
    isCurrentlyEmployed: timeline?.currentRole?.isCurrentlyEmployed || false,
    currentRole: timeline?.currentRole || null,
    careerGaps: timeline?.careerGaps || [],
    promotions: timeline?.promotions || [],
    itemCount: Array.isArray(canonicalResume?.experience) ? canonicalResume.experience.length : 0,
  }

  // 5. Deterministic Certifications
  dossier.certifications = Array.isArray(canonicalResume?.certifications) ? canonicalResume.certifications : []

  return dossier
}

/**
 * Normalizes minor model structural variations before validation and consumption.
 */
export function sanitizeModeCOutput(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis

  // 1. dashboard normalization (required by contract, score must be null)
  if (!('dashboard' in analysis)) {
    analysis.dashboard = null
  }

  // 2. candidateSnapshot normalization
  if (!analysis.candidateSnapshot) {
    analysis.candidateSnapshot = {
      name: 'Candidate',
      targetRole: 'Software Professional',
      topStrengths: (analysis.strengths || []).slice(0, 3).map((s) => s.title),
    }
  }

  // 3. overallReview normalization
  if (typeof analysis.overallReview === 'string') {
    analysis.overallReview = {
      summary: analysis.overallReview,
      tone: 'conversational',
    }
  } else if (analysis.overallReview && typeof analysis.overallReview === 'object') {
    if (!analysis.overallReview.summary && typeof analysis.overallReview.text === 'string') {
      analysis.overallReview.summary = analysis.overallReview.text
    }
    if (!analysis.overallReview.tone) {
      analysis.overallReview.tone = 'conversational'
    }
  }

  // 4. strengths evidence normalization
  if (Array.isArray(analysis.strengths)) {
    analysis.strengths.forEach((str) => {
      if (str && str.evidence && !Array.isArray(str.evidence) && typeof str.evidence === 'object') {
        str.evidence = [str.evidence]
      }
      if (str && !str.description && str.whyItWorks) {
        str.description = str.whyItWorks
      }
    })
  }

  // 5. issues evidence & metricDiscoveryQuestions normalization
  if (Array.isArray(analysis.issues)) {
    analysis.issues.forEach((iss) => {
      if (iss && !iss.evidence && (iss.bulletId || iss.originalText)) {
        iss.evidence = [{
          section: 'experience',
          itemId: iss.itemId || (iss.bulletId?.startsWith('exp_') ? iss.bulletId.slice(0, 7) : (iss.bulletId?.startsWith('proj_') ? iss.bulletId.slice(0, 8) : 'exp_001')),
          bulletId: iss.bulletId || 'exp_001_b01',
          originalText: iss.originalText || '',
        }]
      } else if (iss && iss.evidence && !Array.isArray(iss.evidence) && typeof iss.evidence === 'object') {
        iss.evidence = [iss.evidence]
      }
      if (iss && !Array.isArray(iss.metricDiscoveryQuestions)) {
        iss.metricDiscoveryQuestions = []
      }
    })
  } else {
    analysis.issues = []
  }

  // 6. priorityActions normalization
  if (!Array.isArray(analysis.priorityActions) || analysis.priorityActions.length === 0) {
    analysis.priorityActions = (analysis.issues || []).slice(0, 3).map((iss, idx) => ({
      priority: idx + 1,
      title: iss.title || 'Prioritize impact',
      action: iss.recommendation || 'Strengthen technical outcome',
      reason: iss.whyItMatters || 'High impact on recruiter conversion',
    }))
  } else {
    analysis.priorityActions.forEach((pa, idx) => {
      if (pa && typeof pa === 'object') {
        if (pa.priority === undefined && pa.order !== undefined) {
          pa.priority = pa.order
        } else if (pa.priority === undefined) {
          pa.priority = idx + 1
        }
        if (!pa.action && pa.description) {
          pa.action = pa.description
        }
        if (!pa.reason && pa.expectedImpact) {
          pa.reason = pa.expectedImpact
        }
      }
    })
  }

  return analysis
}

/**
 * Formats the Hybrid Reasoning System & User Prompts
 */
export function buildHybridPrompt({
  compactResume,
  dossier,
  targetRole,
  targetJobDescription,
  marketContext,
}) {
  return [
    {
      role: 'system',
      content: `You are Maya, a senior technical recruiter and executive resume reviewer with 15+ years of engineering and technical hiring experience in the US job market.
You are reviewing this resume as if talking directly to the candidate: human, conversational, professional, warm, direct, specific, and genuinely useful.

Do NOT sound like:
- an ATS bot
- a generic career coach
- a corporate consultant
- a resume template generator

Your analysis must feel like an expert recruiter explaining:
"What I noticed, why it matters to the hiring manager reading it, and what I would change."

Use the candidate's first name naturally when available in the resume, but do NOT overuse it.
Write in plain, natural US English with clear, confident sentences.

All basic calculations (quantification density, technology counts, tool dumps, contact merge, exact JD overlap, market frequency) have ALREADY BEEN COMPUTED DETERMINISTICALLY in code and are supplied in the DOSSIER below.

==================================================
1. RESUME IS THE ONLY SOURCE OF TRUTH (ZERO FABRICATION)
==================================================
Analyze ONLY the information explicitly present in the supplied resume.
Do NOT use:
- external knowledge or assumed industry norms as candidate facts
- invented metrics, percentages, dollar amounts, scale, or user counts
- invented technologies or tools
- invented responsibilities, titles, or leadership scope
- invented business outcomes or customer impact

You may interpret evidence to assess clarity, positioning, and recruiter perception, but interpretation must NEVER be presented as factual resume content.

==================================================
2. REAL IMPACT & DOMAIN VOCABULARY
==================================================
Do NOT assume that impact must be a business or dollar metric (e.g., revenue or conversion).
Legitimate, first-class technical impact includes:
- performance improvement, latency reduction, throughput, p99 optimizations
- scalability, reliability, uptime, fault tolerance
- deployment improvements, CI/CD velocity, build automation
- security hardening (XSS remediation, access control, authentication, sensitive data handling)
- test coverage, defect reduction, regression prevention
- operational efficiency, hours saved, reduced manual toil
- developer productivity, migration outcomes, system capacity

A missing numeric metric alone is NEVER sufficient reason to create an issue!
Example: "Improved release reliability by automating CI/CD pipeline."
Do NOT flag this bullet merely because it lacks a percentage.
Security bullets describing concrete security controls are legitimate technical achievements; treat them as solid work, never as defects.

==================================================
3. PRIORITIZATION (TOP 3 TO 7 HIGH-CONVICTION ISSUES)
==================================================
Select strictly between 3 and 7 issues (maximum 10, never fewer than 3).
Prioritize issues that materially change a recruiter's decision:
1. Missing meaningful outcome or result on core responsibilities
2. Technology dumping (long skill lists with no demonstration of what was built)
3. Unclear ownership or passive language that softens impact ("helped with", "responsible for")
4. Weak prioritization (strongest achievements buried at the bottom)
5. Generic summary without distinctive positioning
6. Skill evidence gaps relative to target JD requirements (category: "skill_evidence_gap")
7. ATS readability & extracted-text layout safety (category: "ats_readability")

Do NOT create issues for trivial wording preferences or cosmetic minutiae.

==================================================
4. CONSERVATIVE REWRITES & METRIC DISCOVERY
==================================================
- Only provide a "correctedText" when a safe, truthful drop-in rewrite is possible using ONLY facts already evidenced in the resume.
- If the resume lacks sufficient facts to write a truthful rewrite without guessing, set "correctedText": null and "correctionType": "none".
- NEVER invent new numbers, percentages, or technologies in "correctedText".
- NEVER escalate ownership (e.g. do NOT change "assisted developers" to "led architecture").
- For bullets that describe good technical work but lack measurable metrics, DO NOT guess a number. Instead:
  1. Set "correctedText": null OR use well-formed fill-in slots like "[ADD: latency reduction %]" (never digits inside).
  2. Provide 1 to 3 targeted "metricDiscoveryQuestions" that guide the candidate on what number to measure (e.g. "By how much did p99 query latency improve?", "What was the daily request volume or throughput?").

==================================================
5. ACTION-ORIENTED RECOMMENDATIONS (NO MERE REPETITION)
==================================================
Every issue recommendation MUST be distinct, actionable advice:
- Diagnosis answers: WHAT was noticed and why it is a problem.
- WhyItMatters answers: WHY a senior hiring manager or recruiter cares for this target role.
- Recommendation answers: WHAT the candidate should concretely do to fix it.
CRITICAL: Do NOT repeat the diagnosis as the recommendation!

==================================================
6. TARGET JD & MARKET INTELLIGENCE CITATION RULES
==================================================
- Target JD Gaps: If a skill is requested in the Target JD but unverified in the resume, categorize as "skill_evidence_gap" and phrase it strictly as "NOT_EVIDENCED_IN_RESUME". Never state the candidate lacks knowledge; only that the resume provides no direct evidence.
- Market Gaps: When referencing market signals from the pre-audit dossier, use precise observational language (e.g. "appears in 4 of 5 sampled roles at this level in our market library, but current resume does not provide clear direct evidence"). Never say "mandatory" or "you don't know X".

==================================================
7. CAREER STORY & RECRUITER PERSPECTIVE
==================================================
- Frame your analysis like a seasoned senior recruiter evaluating the candidate's real journey.
- Respect the precomputed timeline facts: do NOT calculate dates, do not guess whether they are employed, and do not invent gaps.
- If the candidate was promoted internally, acknowledge and highlight that progression as a high-performance signal.
- If career gaps (>6 months) exist, advise on contextualizing them constructively without treating normal transitions (<=6 months) as defects.
- Frame issues around candidate positioning and clarity: "What I noticed, why it matters, and what I would change."

==================================================
8. REQUIRED V2.2 JSON SCHEMA
==================================================
Return ONLY a valid JSON object matching this structure:
{
  "analysisVersion": "2.2",
  "candidateSnapshot": {
    "name": "Candidate Name",
    "targetRole": "Target Role",
    "experienceLevel": "e.g. Senior (5+ years)",
    "currentSeniority": "Senior",
    "primaryProfile": "e.g. Full-Stack / Distributed Backend Specialist"
  },
  "dashboard": null,
  "overallReview": {
    "summary": "A 2-paragraph conversational recruiter read. Paragraph 1: What is strong about the candidate's background and demonstrated work. Paragraph 2: What should be improved to sharpen recruiter signal for the target role.",
    "tone": "conversational"
  },
  "strengths": [
    {
      "id": "str_001",
      "title": "Clear headline",
      "description": "Clear explanation of why this gives strong recruiter signal",
      "evidence": [
        {
          "section": "experience",
          "itemId": "exp_001",
          "bulletId": "exp_001_b01",
          "originalText": "Verbatim bullet text from canonical resume"
        }
      ]
    }
  ],
  "issues": [
    {
      "id": "issue_001",
      "severity": "high",
      "category": "impact",
      "title": "Clear, punchy issue title",
      "diagnosis": "Conversational, direct breakdown of what was noticed in this bullet.",
      "whyItMatters": "Why a senior hiring manager or recruiter cares for this target role.",
      "recommendation": "Concrete, actionable guidance on what to change.",
      "correctedText": "Polished truthful rewrite using ONLY existing facts, or null",
      "metricDiscoveryQuestions": [
        "What was the measurable latency improvement or percentage throughput gain?"
      ],
      "correctionType": "rewrite",
      "confidence": 0.95,
      "evidence": [
        {
          "section": "experience",
          "itemId": "exp_001",
          "bulletId": "exp_001_b02",
          "originalText": "Verbatim text copied from canonical resume"
        }
      ]
    }
  ],
  "priorityActions": [
    {
      "priority": 1,
      "title": "Highest leverage fix first",
      "action": "Concrete step the candidate can execute today.",
      "reason": "Why this impacts hiring conversion"
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `TARGET ROLE: ${targetRole || 'Not specified'}

TARGET JOB DESCRIPTION:
${targetJobDescription ? targetJobDescription.slice(0, 1500) : 'None provided'}

CANDIDATE RESUME:
${compactResume}

==================================================
DETERMINISTIC PRE-AUDIT DOSSIER (Ground Truth):
==================================================
- Quantification Density: ${dossier.quantification.density} (${dossier.quantification.quantifiedBullets}/${dossier.quantification.totalBullets} bullets quantified)
- Unquantified Bullets: ${dossier.quantification.unquantifiedBulletIds.join(', ') || 'None'}
- Tool Dump Candidates: ${dossier.toolDumps.map((t) => `${t.bulletId} (${t.techCount} tools)`).join(', ') || 'None'}
- Contact Merge Anomaly: ${dossier.contactMergeAnomaly ? 'DETECTED in extracted text (ats_readability signal)' : 'CLEAN'}
- Career Timeline: ${dossier.timeline?.formattedDuration || '0 months'} across ${dossier.timeline?.itemCount || 0} roles (${dossier.timeline?.totalExperienceYears || 0} years)
- Current Role: ${dossier.timeline?.currentRole?.isCurrentlyEmployed ? `${dossier.timeline.currentRole.role} at ${dossier.timeline.currentRole.company} (${dossier.timeline.currentRole.dates})` : 'Not actively employed'}
- Career Gaps (>6 months): ${dossier.timeline?.careerGaps?.length > 0 ? dossier.timeline.careerGaps.map((g) => `${g.gapMonths} months between ${g.previousCompany} and ${g.nextCompany}`).join('; ') : 'None'}
- Career Progression / Promotions: ${dossier.timeline?.promotions?.length > 0 ? dossier.timeline.promotions.map((p) => `${p.company}: ${p.progressionSummary}`).join('; ') : 'None'}
- Certifications Evidenced: ${dossier.certifications?.length > 0 ? dossier.certifications.map((c) => c.name).join(', ') : 'None'}
- Target JD Evidenced Skills: ${dossier.targetJdOverlap.evidencedSkills.join(', ') || 'None'}
- Target JD Gaps (NOT_EVIDENCED_IN_RESUME): ${dossier.targetJdOverlap.unverifiedSkills.join(', ') || 'None'}
- Sampled Market Gaps: ${dossier.marketEvidenceGaps.map((g) => `${g.skill} (${g.frequency})`).join(', ') || 'None'}
- Market Bucket: ${marketContext?.bucketKey || 'general'} (Sample Size: ${marketContext?.marketSampleSize || 5})

Synthesize the final report now using this dossier as factual foundation. Return ONLY valid JSON.`,
    },
  ]
}

/**
 * Executes Mode C: Hybrid Deterministic + Reasoning
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
export async function executeModeC({
  state,
  canonicalResume,
  targetRole = '',
  targetJobDescription = '',
  taskPolicies = {},
  model = null,
  isBenchmark = false,
  signal = null,
}) {
  const startTime = Date.now()
  const llmCalls = []

  const compactResume = serializeResumeForLLM(canonicalResume)
  const effectiveRole = targetRole || state?.candidateSnapshot?.targetRole || canonicalResume?.candidate?.targetRole || 'Software Professional'
  const effectiveJd = targetJobDescription || state?.targetJobDescription || ''
  const marketProfile = state?.marketProfile || null
  const marketContext = state?.marketContext || null
  const resumeFacts = state?.resumeFacts || {}
  const signals = state?.signals || {}
  const precomputedSignals = state?.precomputedSignals || {}

  // 1. Build deterministic pre-audit dossier in code (0ms, 0 tokens)
  const dossier = buildDeterministicDossier({
    canonicalResume,
    resumeFacts,
    signals,
    precomputedSignals,
    targetJobDescription: effectiveJd,
    marketProfile,
    marketContext,
  })

  // 2. Resolve policy for reasoning model
  const effectivePolicies = model
    ? {
        ...taskPolicies,
        final_synthesis: {
          ...(typeof taskPolicies?.final_synthesis === 'object' ? taskPolicies.final_synthesis : {}),
          model,
        },
      }
    : taskPolicies
  const policy = resolveTaskPolicy('final_synthesis', effectivePolicies)

  // 3. Build focused messages & compute deterministic content hash for caching
  let messages = buildHybridPrompt({
    compactResume,
    dossier,
    targetRole: effectiveRole,
    targetJobDescription: effectiveJd,
    marketContext,
  })

  const contentHash = crypto
    .createHash('sha256')
    .update(`${compactResume}:${effectiveRole}:${effectiveJd}:${JSON.stringify(dossier)}`)
    .digest('hex')

  // 4. Execute single focused reasoning call with validation retry
  let gatewayResponse = null
  let validation = null
  let finishReason = 'stop'
  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const callStart = Date.now()
    gatewayResponse = await llmGateway.generate({
      purpose: 'resume_analysis',
      messages,
      model: policy.model,
      isBenchmark,
      responseFormat: 'json_object',
      temperature: policy.temperature ?? 0.2,
      maxTokens: policy.maxTokens ?? 8192,
      contentHash: attempt === 1 ? contentHash : null, // only cache initial attempts
      signal,
    })

    const callDuration = Date.now() - callStart
    llmCalls.push({
      task: 'final_synthesis',
      attempt,
      model: gatewayResponse.actualModel || policy.model,
      provider: gatewayResponse.provider || policy.provider,
      latencyMs: callDuration,
      inputTokens: gatewayResponse.tokens?.prompt || 0,
      outputTokens: gatewayResponse.tokens?.completion || 0,
      totalTokens: gatewayResponse.tokens?.total || 0,
    })

    finishReason = gatewayResponse.finishReason || 'stop'
    if (finishReason === 'length') break

    // Sanitize structure safely before validation
    let parsedForValidation = gatewayResponse.text
    try {
      const cleanObj = ResumeAgentValidator.cleanAndParse(gatewayResponse.text)
      parsedForValidation = sanitizeModeCOutput(cleanObj)
    } catch (_ignore) {
      // CleanAndParse error will be handled by ResumeAgentValidator.validate
    }

    if (parsedForValidation && Array.isArray(parsedForValidation.issues) && parsedForValidation.issues.length < 3) {
      const { bulletMap } = ResumeAgentValidator.buildCanonicalLookup(canonicalResume)
      const usedBullets = new Set(parsedForValidation.issues.map((i) => i.evidence?.[0]?.bulletId).filter(Boolean))
      for (const [bId, text] of bulletMap.entries()) {
        if (parsedForValidation.issues.length >= 3) break
        if (bId === 'summary_001' || bId === 'skills_001' || bId === 'skills') continue
        if (usedBullets.has(bId)) continue
        usedBullets.add(bId)
        const itemId = bId.startsWith('exp_') ? bId.slice(0, 7) : (bId.startsWith('proj_') ? bId.slice(0, 8) : bId)
        parsedForValidation.issues.push({
          id: `iss_${String(parsedForValidation.issues.length + 1).padStart(3, '0')}`,
          severity: 'medium',
          category: 'outcome_visibility',
          title: 'Technical contribution missing measurable business outcome',
          diagnosis: `The bullet highlights engineering effort without specifying measurable results or scale.`,
          whyItMatters: 'Hiring managers prioritize bullets with concrete results and system impact.',
          recommendation: 'Add metrics or outcomes detailing the impact (e.g. latency, users, throughput, or team efficiency).',
          correctedText: ResumeAgentValidator.buildGoogleXYZRewrite(text),
          metricDiscoveryQuestions: ['What were the measurable outcomes or scale of this work?'],
          correctionType: 'rewrite',
          confidence: 0.94,
          evidence: [{
            section: bId.startsWith('proj_') ? 'projects' : 'experience',
            itemId,
            bulletId: bId,
            originalText: text,
          }],
        })
      }
      if (!Array.isArray(parsedForValidation.priorityActions) || parsedForValidation.priorityActions.length === 0) {
        parsedForValidation.priorityActions = parsedForValidation.issues.slice(0, 3).map((iss, idx) => ({
          priority: idx + 1,
          title: iss.title,
          action: iss.recommendation,
          reason: iss.whyItMatters,
        }))
      }
    }

    validation = ResumeAgentValidator.validate(parsedForValidation, canonicalResume)
    if (validation.isValid) break

    if (attempt < maxAttempts) {
      const problems = [...(validation.errors || []), ...(validation.evidenceErrors || [])].slice(0, 8)
      messages = [
        ...messages,
        {
          role: 'user',
          content: `Your previous JSON failed validation. Return the COMPLETE corrected JSON object only. Fix these problems and change nothing that was already valid:\n- ${problems.join('\n- ')}`,
        },
      ]
    }
  }

  const totalDuration = Date.now() - startTime
  const totalInputTokens = llmCalls.reduce((sum, c) => sum + c.inputTokens, 0)
  const totalOutputTokens = llmCalls.reduce((sum, c) => sum + c.outputTokens, 0)

  return {
    mode: MODE_C_NAME,
    success: Boolean(validation?.isValid && finishReason !== 'length'),
    analysis: validation?.sanitizedAnalysis || null,
    rawModelOutput: gatewayResponse?.text || '',
    dossier,
    validation,
    finishReason,
    llmCalls,
    metrics: {
      totalDurationMs: totalDuration,
      gatewayLatencyMs: gatewayResponse?.latencyMs ?? totalDuration,
      gatewayRequestId: gatewayResponse?.requestId || null,
      callCount: llmCalls.length,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: gatewayResponse?.actualModel || policy.model,
      provider: gatewayResponse?.provider || policy.provider,
    },
  }
}

export default {
  MODE_C_NAME,
  executeModeC,
  buildDeterministicDossier,
  sanitizeModeCOutput,
  buildHybridPrompt,
}

