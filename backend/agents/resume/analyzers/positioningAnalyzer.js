/**
 * Positioning Analyzer — V3
 *
 * Analyzes: target role alignment, professional identity, summary positioning,
 * experience hierarchy, seniority consistency, technical profile coherence.
 *
 * IMPORTANT:
 * - Produces observations, NOT final issues.
 * - Does NOT infer unsupported seniority labels.
 * - Uses "demonstrates...", "suggests...", "indicates..." language.
 * - Output feeds the Synthesis Agent for final issue selection.
 * - NO LLM calls. Fully deterministic.
 */

import { FACT_TYPES } from '../state/resumeState.schema.js'

export const POSITIONING_ANALYZER_VERSION = '1.0'

// Signals that suggest a senior-leaning profile (based on explicit evidence only)
const SENIOR_SIGNAL_PATTERNS = [
  /\b(?:senior|lead|principal|staff|architect|head|director|vp|chief)\b/i,
  /\b(?:designed|architected|owned|drove|led|established|founded|scaled)\b/i,
]

// Signals that suggest IC/mid-level profile
const IC_SIGNAL_PATTERNS = [
  /\b(?:implemented|built|developed|integrated|configured|maintained|supported|deployed)\b/i,
]

// Vague cliché patterns in summary that reduce positioning clarity
const VAGUE_SUMMARY_PATTERNS = [
  /passionate\s+(?:about|developer)/i,
  /results.?driven/i,
  /self.?motivated/i,
  /team\s+player/i,
  /go.?getter/i,
  /think\s+outside\s+the\s+box/i,
  /dynamic\s+professional/i,
  /detail.?oriented/i,
  /problem\s+solver/i,
  /excellent\s+communication/i,
]

/**
 * Main positioning analyzer.
 *
 * @param {Object} resumeFacts - Output from extractResumeFacts()
 * @param {Object} signals - Output from generateResumeSignals()
 * @param {Object} canonicalResume - Immutable canonical resume
 * @returns {{ version: string, observations: Array, evidence: Array }}
 */
export function analyzePositioning(resumeFacts, signals, canonicalResume) {
  const observations = []
  const evidence = []

  if (!canonicalResume || !resumeFacts) {
    return { version: POSITIONING_ANALYZER_VERSION, observations, evidence }
  }

  const facts = resumeFacts.facts || []

  // 1. Target role clarity
  const targetRoleFact = facts.find((f) => f.type === FACT_TYPES.TARGET_ROLE)
  if (!targetRoleFact) {
    observations.push({
      observationId: 'pos_001',
      type: 'target_role_missing',
      description: 'No explicit target role was specified. The resume may lack clear directional positioning.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  }

  // 2. Summary positioning — vague language check
  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) || ''

  const vagueClichesFound = VAGUE_SUMMARY_PATTERNS.filter((p) => p.test(summaryText)).length
  if (vagueClichesFound >= 2) {
    observations.push({
      observationId: 'pos_002',
      type: 'vague_summary_language',
      description: `The summary contains ${vagueClichesFound} generic cliché phrase(s) that may dilute the candidate's specific professional positioning.`,
      itemId: 'summary_001',
      bulletId: 'summary_001',
      sourceText: summaryText.slice(0, 200),
      weight: 'medium',
    })
    evidence.push({ itemId: 'summary_001', bulletId: 'summary_001', sourceText: summaryText.slice(0, 200) })
  } else if (!summaryText.trim()) {
    observations.push({
      observationId: 'pos_003',
      type: 'summary_absent',
      description: 'No professional summary section was detected. This may reduce opening positioning impact.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'medium',
    })
  }

  // 3. Seniority signal consistency (observation only — NOT a label)
  const experienceItems = Array.isArray(canonicalResume.experience) ? canonicalResume.experience : []
  let seniorSignalCount = 0
  let icSignalCount = 0

  for (const exp of experienceItems) {
    const role = exp.role || ''
    if (SENIOR_SIGNAL_PATTERNS.some((p) => p.test(role))) seniorSignalCount++
    if (IC_SIGNAL_PATTERNS.some((p) => p.test(role))) icSignalCount++

    if (Array.isArray(exp.bullets)) {
      for (const b of exp.bullets) {
        if (!b.text) continue
        if (SENIOR_SIGNAL_PATTERNS.some((p) => p.test(b.text))) seniorSignalCount++
        if (IC_SIGNAL_PATTERNS.some((p) => p.test(b.text))) icSignalCount++
      }
    }
  }

  if (seniorSignalCount > 0 && icSignalCount === 0) {
    observations.push({
      observationId: 'pos_004',
      type: 'strong_senior_signals',
      description: `Resume language includes ${seniorSignalCount} senior-leaning action verbs or role signals (e.g. "led", "architected", "owned"). These terms suggest leadership or design ownership, which aligns well with senior-level roles.`,
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  }

  // 4. Technology breadth vs depth
  const techFacts = facts.filter((f) => f.type === FACT_TYPES.TECHNOLOGY)
  const evidenceGaps = signals?.skills?.summary?.evidenceGaps ?? 0
  const totalTech = techFacts.length

  if (totalTech > 15 && evidenceGaps > totalTech * 0.5) {
    observations.push({
      observationId: 'pos_005',
      type: 'broad_skills_low_evidence',
      description: `The resume lists ${totalTech} technologies, but ${evidenceGaps} (${Math.round((evidenceGaps / totalTech) * 100)}%) lack supporting evidence in experience or project bullets. This breadth-to-depth ratio may reduce perceived technical credibility for specific roles.`,
      itemId: 'skills_001',
      bulletId: 'skills_001',
      sourceText: null,
      weight: 'medium',
    })
  }

  // 5. Experience count sanity
  const expCount = experienceItems.length
  if (expCount === 0) {
    observations.push({
      observationId: 'pos_006',
      type: 'no_experience_items',
      description: 'No structured experience items were detected in the resume.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'high',
    })
  }

  return {
    version: POSITIONING_ANALYZER_VERSION,
    observations,
    evidence,
  }
}

export default analyzePositioning
