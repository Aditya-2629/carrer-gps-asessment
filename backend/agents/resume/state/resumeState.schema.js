/**
 * Resume State Schema & Type Contracts
 *
 * Defines the expected shape of every layer in ResumeState.
 * Used for documentation, validation, and type-checking hints.
 */

// ─── Layer Contracts ─────────────────────────────────────────────────────────

/**
 * Layer 0: Source metadata
 * @typedef {Object} SourceMeta
 * @property {string} documentId
 * @property {string} parserVersion
 * @property {string} createdAt - ISO 8601
 */

/**
 * Layer 3: Resume Facts
 * Individual facts carry itemId + bulletId for full traceability.
 *
 * @typedef {Object} ResumeFact
 * @property {string} factId        - e.g. "fact_001"
 * @property {string} type          - 'metric' | 'technology' | 'role' | 'company' | 'date' |
 *                                    'achievement' | 'responsibility' | 'certification' | 'education'
 * @property {string} value         - Extracted value (verbatim or normalized)
 * @property {string} itemId        - Canonical item ID (e.g. "exp_001")
 * @property {string|null} bulletId - Canonical bullet ID (e.g. "exp_001_b02") or null
 * @property {string} sourceText    - Original source text the fact was extracted from
 * @property {string} section       - 'experience' | 'projects' | 'summary' | 'education' | 'skills'
 */

/**
 * Layer 5: Analyser Observation
 * @typedef {Object} AnalyzerObservation
 * @property {string} observationId
 * @property {string} type          - e.g. 'positioning_gap', 'vague_language', etc.
 * @property {string} description   - Human-readable observation (NOT a final issue)
 * @property {string|null} itemId
 * @property {string|null} bulletId
 * @property {string|null} sourceText
 * @property {'low'|'medium'|'high'} [weight]  - Signal weight for synthesis
 */

/**
 * Layer 6: Analysis (final synthesis output — LLM-produced)
 * Keeps full V2.2 API contract.
 * @typedef {Object} AnalysisOutput
 * @property {string} analysisVersion   - "2.2"
 * @property {Object} candidateSnapshot
 * @property {null}   dashboard
 * @property {Object} overallReview
 * @property {Array}  strengths
 * @property {Array}  issues
 * @property {Array}  priorityActions
 */

/**
 * Layer 7: Validation
 * @typedef {Object} ValidationResult
 * @property {boolean|null} schemaValid
 * @property {boolean|null} evidenceValid
 * @property {Array<string>} unsupportedClaims
 * @property {Array<string>} unsupportedAssumptions
 * @property {Array<string>} fabricatedMetrics
 * @property {Array<string>} hallucinations
 * @property {Array<string>} errors
 * @property {Array<string>} warnings
 */

// ─── Allowed Fact Types ───────────────────────────────────────────────────────

export const FACT_TYPES = {
  METRIC: 'metric',
  TECHNOLOGY: 'technology',
  ROLE: 'role',
  COMPANY: 'company',
  DATE: 'date',
  ACHIEVEMENT: 'achievement',
  RESPONSIBILITY: 'responsibility',
  CERTIFICATION: 'certification',
  EDUCATION: 'education',
  LOCATION: 'location',
  CANDIDATE_NAME: 'candidate_name',
  TARGET_ROLE: 'target_role',
}

// ─── Allowed Analyser Names ───────────────────────────────────────────────────

export const ANALYZER_NAMES = {
  POSITIONING: 'positioning',
  CONTENT: 'content',
  IMPACT: 'impact',
  TECHNICAL: 'technical',
  STRUCTURE: 'structure',
  EVIDENCE: 'evidence',
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Checks that a layer payload has the minimum required fields.
 * @param {Object} facts
 * @returns {boolean}
 */
export function isValidFactsPayload(facts) {
  if (!facts || typeof facts !== 'object') return false
  return Array.isArray(facts.facts) && typeof facts.summary === 'object'
}

/**
 * Checks that a signals payload has the minimum required fields.
 * @param {Object} signals
 * @returns {boolean}
 */
export function isValidSignalsPayload(signals) {
  if (!signals || typeof signals !== 'object') return false
  return (
    typeof signals.version === 'string' &&
    typeof signals.skills === 'object' &&
    typeof signals.metrics === 'object'
  )
}

export default {
  FACT_TYPES,
  ANALYZER_NAMES,
  isValidFactsPayload,
  isValidSignalsPayload,
}
