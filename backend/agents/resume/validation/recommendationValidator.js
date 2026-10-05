/**
 * Recommendation Duplication Validator — Resume Agent V2.4
 *
 * Implements Spec §13 & §14:
 * Detects when an issue's recommendation merely repeats its diagnosis
 * instead of answering "WHAT should the candidate do?".
 *
 * Example of failure:
 * Diagnosis: "Skills have limited evidence."
 * Recommendation: "Skills have limited evidence."
 *
 * Returns RECOMMENDATION_TOO_SIMILAR classification.
 * Does NOT fail the analysis. Adds a validation warning without triggering another LLM call.
 */

export const RECOMMENDATION_VALIDATOR_VERSION = '1.0'

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for',
  'of', 'and', 'or', 'with', 'this', 'that', 'these', 'those', 'it', 'its', 'as',
  'by', 'from', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'if',
  'into', 'more', 'some', 'such', 'than', 'too', 'very', 'can', 'will', 'just',
  'should', 'now', 'any', 'not', 'no',
])

/**
 * Tokenizes text into a normalized set of meaningful words.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeMeaningfulWords(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
}

/**
 * Computes semantic / token overlap between diagnosis and recommendation.
 *
 * @param {string} diagnosis
 * @param {string} recommendation
 * @returns {number} Overlap score between 0.0 and 1.0
 */
export function computeOverlapScore(diagnosis, recommendation) {
  if (!diagnosis || !recommendation) return 0

  const diagClean = diagnosis.trim().toLowerCase()
  const recClean = recommendation.trim().toLowerCase()

  // Exact or near-exact match
  if (diagClean === recClean) return 1.0

  const tokensA = tokenizeMeaningfulWords(diagnosis)
  const tokensB = tokenizeMeaningfulWords(recommendation)

  if (tokensA.length === 0 || tokensB.length === 0) return 0

  const setA = new Set(tokensA)
  const setB = new Set(tokensB)

  let intersectionCount = 0
  for (const token of setA) {
    if (setB.has(token)) intersectionCount++
  }

  const unionSize = new Set([...tokensA, ...tokensB]).size
  const jaccard = unionSize > 0 ? intersectionCount / unionSize : 0

  // Containment ratio relative to the shorter text
  const minLength = Math.min(tokensA.length, tokensB.length)
  const containmentRatio = minLength > 0 ? intersectionCount / minLength : 0

  // If one string is almost entirely contained in the other and lengths are close
  if (containmentRatio >= 0.85 && Math.abs(tokensA.length - tokensB.length) <= 3) {
    return Math.max(jaccard, containmentRatio)
  }

  return jaccard
}

/**
 * Validates all issue recommendations against their diagnoses.
 *
 * @param {Array} issues - Array of issue objects
 * @param {Object} options - Threshold option (default 0.65)
 * @returns {{ valid: boolean, classification: string, violations: Array, warnings: Array }}
 */
export function validateRecommendations(issues, options = {}) {
  const threshold = options.threshold ?? 0.65
  const violations = []

  if (!Array.isArray(issues) || issues.length === 0) {
    return {
      valid: true,
      classification: 'VALID',
      violations: [],
      warnings: [],
    }
  }

  for (const iss of issues) {
    if (!iss || typeof iss !== 'object') continue
    const diagnosis = iss.diagnosis || ''
    const recommendation = iss.recommendation || ''

    if (!diagnosis || !recommendation) continue

    const overlap = computeOverlapScore(diagnosis, recommendation)
    if (overlap >= threshold) {
      violations.push({
        issueId: iss.id || 'iss_unknown',
        diagnosis,
        recommendation,
        overlapScore: Number(overlap.toFixed(2)),
        classification: 'RECOMMENDATION_TOO_SIMILAR',
        message: `Issue ${iss.id || ''}: Recommendation repeats diagnosis without providing action-oriented guidance (overlap: ${(overlap * 100).toFixed(0)}%)`,
      })
    }
  }

  const valid = violations.length === 0
  return {
    valid,
    classification: valid ? 'VALID' : 'RECOMMENDATION_TOO_SIMILAR',
    violations,
    warnings: violations.map((v) => v.message),
  }
}

export default {
  RECOMMENDATION_VALIDATOR_VERSION,
  tokenizeMeaningfulWords,
  computeOverlapScore,
  validateRecommendations,
}
