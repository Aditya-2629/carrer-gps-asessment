/**
 * Resume Synthesis Agent — V3
 *
 * The ONLY stage in the pipeline that makes an LLM call.
 * Receives: compactResume + signals + facts + analyserObservations + targetRole.
 * Produces: final analysis in V2.2 JSON contract.
 *
 * Design rules:
 * - Synthesis decides what becomes an issue (NOT analysers, NOT signals).
 * - Context sent to LLM is compact — no full canonical JSON.
 * - Analyser observations are summarised compactly before injection.
 * - Maintains full V2.2 output contract for frontend compatibility.
 */

import { SYNTHESIS_SYSTEM_PROMPT, SYNTHESIS_PROMPT_VERSION } from './resumeSynthesis.prompt.js'
import { formatCompactSignalSummary } from '../signals/signalEngine.js'
import { formatCompactFactsSummary } from '../facts/resumeFactExtractor.js'
import { filterGroundedObservations } from '../analyzers/evidenceAnalyzer.js'
import { formatPrecomputedSignalsForPrompt } from '../signals/precomputedSignals.js'
import { formatSkillGuidanceForPrompt } from '../skillsEngine/index.js'
import { formatDomainContextForPrompt } from '../market/domainClassifier.js'
import { formatUsMarketSignalsForPrompt } from '../market/usMarketSignals.js'
import { formatMarketProfileForPrompt } from '../market/marketProfileBuilder.js'

export { SYNTHESIS_PROMPT_VERSION }

// ─── Observation Formatter ────────────────────────────────────────────────────

/**
 * Formats grounded analyser observations into a compact, token-efficient
 * block for injection into the synthesis user prompt.
 *
 * @param {Object} groundedObservations - Output from filterGroundedObservations()
 * @returns {string}
 */
function formatCompactObservations(groundedObservations) {
  if (!groundedObservations || typeof groundedObservations !== 'object') return ''

  const lines = ['## ANALYSER OBSERVATIONS (Pre-computed, Grounded)']
  lines.push('These are evidence and context — NOT automatic issues. Use recruiter judgment to decide significance.\n')

  const WEIGHT_EMOJI = { high: '[HIGH]', medium: '[MED]', low: '[LOW]' }

  for (const [analyzerName, output] of Object.entries(groundedObservations)) {
    const obs = (output?.observations || []).filter((o) => o.evidenceLocated !== false)
    if (obs.length === 0) continue

    const label = analyzerName.replace(/([A-Z])/g, ' $1').toUpperCase().trim()
    lines.push(`### ${label}`)

    for (const o of obs) {
      const weight = WEIGHT_EMOJI[o.weight] || '[LOW]'
      const location = [o.itemId, o.bulletId].filter(Boolean).join(' / ')
      lines.push(`${weight} [${o.type}]${location ? ` @${location}` : ''}`)
      lines.push(`   ${o.description}`)
      if (o.llmGuidance) {
        lines.push(`   GUIDANCE: ${o.llmGuidance}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Classification Formatter (V2.4) ──────────────────────────────────────────

/**
 * Formats evidence classifications into a compact summary for the LLM prompt.
 *
 * @param {Object} evidenceClassifications - Output from classifyAllEvidence()
 * @returns {string}
 */
function formatCompactClassificationSummary(evidenceClassifications) {
  if (!evidenceClassifications?.items?.length) return ''
  const lines = ['## INTERNAL EVIDENCE CLASSIFICATION (V2.4 Consistency Context)']
  lines.push('Guidelines: Prefer STRONG for strengths. Prefer WEAK for issues. Omit BORDERLINE/NEUTRAL unless strongly justified. Do NOT use the same bullet as both strength and issue.\n')

  const strongItems = evidenceClassifications.items.filter((i) => i.classification === 'STRONG')
  const borderlineItems = evidenceClassifications.items.filter((i) => i.classification === 'BORDERLINE')
  const weakItems = evidenceClassifications.items.filter((i) => i.classification === 'WEAK')

  if (strongItems.length > 0) {
    lines.push('Strong Evidence Candidates (prefer for strengths):')
    for (const item of strongItems.slice(0, 6)) {
      lines.push(`- [${item.bulletId}] STRONG: "${item.text.slice(0, 80)}..." (${item.reasons[0] || 'standout impact'})`)
    }
  }

  if (borderlineItems.length > 0) {
    lines.push('\nBorderline Evidence (legitimate technical work, do NOT force into strengths or issues):')
    for (const item of borderlineItems.slice(0, 6)) {
      lines.push(`- [${item.bulletId}] BORDERLINE: "${item.text.slice(0, 80)}..." (${item.reasons[0] || 'legitimate work without metric'})`)
    }
  }

  if (weakItems.length > 0) {
    lines.push('\nWeak Evidence (meaningful defects, prefer for issues):')
    for (const item of weakItems.slice(0, 6)) {
      lines.push(`- [${item.bulletId}] WEAK: "${item.text.slice(0, 80)}..." (${item.reasons[0] || 'vague responsibility or ownership'})`)
    }
  }

  return lines.join('\n')
}

// ─── Role-Specific Context Builder ───────────────────────────────────────────

/**
 * Builds a dynamic ROLE CONTEXT block based on the target role string.
 * Gives the LLM recruiter-specific focus areas for the role level.
 *
 * @param {string} targetRole
 * @returns {string}
 */
function buildRoleContextBlock(targetRole) {
  if (!targetRole || typeof targetRole !== 'string') return ''

  const role = targetRole.toLowerCase()
  const hints = []

  // Seniority signals
  if (/senior|lead|principal|staff|architect|director/i.test(role)) {
    hints.push('Look for: system design ownership, architectural decisions, cross-team impact, mentorship evidence, and initiative beyond assigned tasks.')
    hints.push('Weakness signal: bullets that describe execution only with no ownership or strategic framing.')
  } else if (/junior|entry|graduate|intern|associate/i.test(role)) {
    hints.push('Look for: learning trajectory, project quality, code contribution clarity, and skill application evidence.')
    hints.push('Context: Do NOT penalize for missing leadership or business metrics — focus on demonstrated technical ability and growth signals.')
  } else if (/mid|engineer ii|software engineer|developer/i.test(role)) {
    hints.push('Look for: independent ownership of features, measurable technical outcomes, and clear demonstration of core stack skills.')
  }

  // Domain signals
  if (/ai|ml|machine learning|deep learning|llm|nlp/i.test(role)) {
    hints.push('Domain focus: evaluate model deployment, MLOps evidence, research-to-production signals, and dataset/training pipeline ownership. Generic "used PyTorch" bullets without outcome context are a weak signal.')
  }
  if (/full.?stack|frontend|backend|web/i.test(role)) {
    hints.push('Domain focus: assess API design quality, frontend-backend integration evidence, and performance optimization outcomes.')
  }
  if (/data|analytics|bi|reporting/i.test(role)) {
    hints.push('Domain focus: look for pipeline ownership, data quality outcomes, query/dashboard impact, and stakeholder communication evidence.')
  }
  if (/security|devsecops|cybersec/i.test(role)) {
    hints.push('Domain focus: security controls, compliance outcomes, vulnerability reduction, and proactive threat modeling are first-class impact for this role.')
  }
  if (/devops|sre|platform|infrastructure|cloud/i.test(role)) {
    hints.push('Domain focus: uptime/reliability improvements, deployment velocity, automation scope, and infrastructure cost outcomes are the primary strength signals.')
  }

  if (hints.length === 0) return ''

  return `ROLE CONTEXT (${targetRole}):\n${hints.map((h) => `- ${h}`).join('\n')}`
}

// ─── Message Builder ──────────────────────────────────────────────────────────

/**
 * Builds the system and user messages for the Synthesis LLM call.
 *
 * @param {Object} state - Full ResumeState
 * @returns {Array<{role: string, content: string}>}
 */
export function buildSynthesisMessages(state) {
  const compactResume = state.compactResume || ''
  const signals = state.signals
  const resumeFacts = state.resumeFacts
  const analyzerObservations = state.analyzerObservations || {}
  const evidenceClassifications = state.evidenceClassifications || null
  const targetRole = state.metadata?.targetRole || ''

  // Format compact signal summary (existing V2.3 format)
  const signalSummary = signals ? formatCompactSignalSummary(signals) : ''

  // Format compact facts summary (new V3 layer)
  const factsSummary = resumeFacts ? formatCompactFactsSummary(resumeFacts) : ''

  // Format grounded analyser observations
  const groundedObs = filterGroundedObservations(analyzerObservations)
  const observationsSummary = formatCompactObservations(groundedObs)

  // Format evidence classifications (V2.4 layer)
  const classificationSummary = evidenceClassifications ? formatCompactClassificationSummary(evidenceClassifications) : ''

  // Build user prompt — send only compact context
  let userPrompt = `CANDIDATE RESUME:\n${compactResume}`

  // Precomputed Signals Block (V2.5 Phase 1) injected right after resume content
  if (state.precomputedSignals) {
    const formattedSignals = formatPrecomputedSignalsForPrompt(state.precomputedSignals)
    if (formattedSignals) {
      userPrompt += `\n\n${formattedSignals}`
    }
  }

  if (targetRole) {
    userPrompt += `\n\nTARGET ROLE: ${targetRole}`
  }

  // Target Job Description (Primary Benchmark — Section 15 priority)
  if (state.targetJobDescription && state.targetJobDescription.trim()) {
    userPrompt += `\n\nTARGET JOB DESCRIPTION (Primary Priority Goal):\n${state.targetJobDescription.trim().slice(0, 2500)}`
  }

  // Sampled Market Intelligence block (V3 Market Intelligence — Section 18)
  const activeMarketProfile = state.marketProfile || state.marketContext?.marketProfile
  if (activeMarketProfile) {
    const marketBlock = formatMarketProfileForPrompt(activeMarketProfile)
    if (marketBlock) {
      userPrompt += `\n\n${marketBlock}`
    }
  }

  // Domain Context block (V3.1 — IT vs non-IT impact vocabulary & metric discovery)
  if (state.domainProfile) {
    const domainContext = formatDomainContextForPrompt(state.domainProfile)
    if (domainContext) {
      userPrompt += `\n\n${domainContext}`
    }
  }

  // US Market Signals block (V3.1 — non-US convention coaching)
  if (state.usMarketSignals) {
    const usMarketContext = formatUsMarketSignalsForPrompt(state.usMarketSignals)
    if (usMarketContext) {
      userPrompt += `\n\n${usMarketContext}`
    }
  }

  // Role-specific context block (Phase 2.4 — V2.6 injection)
  const roleContext = buildRoleContextBlock(targetRole)
  if (roleContext) {
    userPrompt += `\n\n${roleContext}`
  }

  if (signalSummary && signalSummary.trim()) {
    userPrompt += `\n\n${signalSummary.trim()}`
  }

  if (factsSummary && factsSummary.trim()) {
    userPrompt += `\n\n${factsSummary.trim()}`
  }

  if (observationsSummary && observationsSummary.trim()) {
    userPrompt += `\n\n${observationsSummary.trim()}`
  }

  if (classificationSummary && classificationSummary.trim()) {
    userPrompt += `\n\n${classificationSummary.trim()}`
  }

  // Skill Framework Guidance (Google X-Y-Z and Metric Discovery)
  const allBullets = []
  for (const exp of state.canonicalResume?.experience || []) {
    for (const b of exp.bullets || []) {
      if (b.id && b.text) allBullets.push({ id: b.id, text: b.text })
    }
  }
  for (const proj of state.canonicalResume?.projects || []) {
    for (const b of proj.bullets || []) {
      if (b.id && b.text) allBullets.push({ id: b.id, text: b.text })
    }
  }
  const skillGuidance = formatSkillGuidanceForPrompt(allBullets)
  if (skillGuidance && skillGuidance.trim()) {
    userPrompt += `\n\n${skillGuidance.trim()}`
  }

  userPrompt += `\n\nAnalyze this resume as a standalone document using the recruiter persona, rules, and required JSON schema above. Return ONLY the valid JSON object now.`

  return [
    { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
}

export class ResumeSynthesis {
  /**
   * Builds synthesis messages for the LLM.
   *
   * @param {Object} state - Full ResumeState (V3)
   * @returns {Array<{role: string, content: string}>}
   */
  static buildMessages(state) {
    return buildSynthesisMessages(state)
  }

  /**
   * Returns the current synthesis prompt version.
   * @returns {string}
   */
  static get promptVersion() {
    return SYNTHESIS_PROMPT_VERSION
  }
}

export default ResumeSynthesis
