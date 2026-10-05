/**
 * Claim Validator — V3
 *
 * Detects fabricated metrics, new technologies, and new factual claims
 * in the synthesis output that are not present in the canonical resume.
 *
 * Integrates with the existing V2.2 validator's fabrication detection logic,
 * now exposed as a standalone V3 validation module.
 */

// Tokens that appear in resume-generated content that must exist in source
const CURRENCY_PATTERN = /\$\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|b|million|billion))?\b/gi
const PERCENTAGE_PATTERN = /\b\d+(?:\.\d+)?%/g
const MULTIPLIER_PATTERN = /\b\d+(?:\.\d+)?x\b/gi
const LARGE_COUNT_PATTERN = /\b\d{4,}(?:[,+]\d+)*\b/g  // 4+ digit numbers

/**
 * Extracts all numeric fact tokens from a text string.
 * @param {string} text
 * @returns {Set<string>}
 */
function extractFactTokens(text) {
  if (!text) return new Set()
  const tokens = new Set()
  const patterns = [CURRENCY_PATTERN, PERCENTAGE_PATTERN, MULTIPLIER_PATTERN, LARGE_COUNT_PATTERN]
  for (const pattern of patterns) {
    // Reset lastIndex
    pattern.lastIndex = 0
    let m
    while ((m = pattern.exec(text)) !== null) {
      tokens.add(m[0].replace(/\s+/g, '').toLowerCase())
    }
  }
  return tokens
}

/**
 * Collects all numeric fact tokens from the canonical resume.
 * @param {Object} canonicalResume
 * @returns {Set<string>}
 */
function buildSourceFactTokens(canonicalResume) {
  const tokens = new Set()
  const addText = (text) => {
    if (text) extractFactTokens(text).forEach((t) => tokens.add(t))
  }

  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) || ''
  addText(summaryText)

  for (const exp of (canonicalResume.experience || [])) {
    addText(exp.company)
    addText(exp.role)
    for (const b of (exp.bullets || [])) addText(b.text)
  }

  for (const proj of (canonicalResume.projects || [])) {
    addText(proj.title)
    for (const b of (proj.bullets || [])) addText(b.text)
  }

  return tokens
}

/**
 * Validates a single text block against the source tokens.
 *
 * @param {string} text - Text to validate
 * @param {Set<string>} sourceTokens - Tokens from canonical resume
 * @param {string} location - For error reporting
 * @returns {Array<string>} violations
 */
function validateTextClaims(text, sourceTokens, location) {
  if (!text) return []
  const violations = []
  const generatedTokens = extractFactTokens(text)
  for (const token of generatedTokens) {
    if (!sourceTokens.has(token)) {
      violations.push(`[${location}] Fabricated metric or claim detected: "${token}" not found in source resume`)
    }
  }
  return violations
}

/**
 * Validates all claim-bearing fields in the synthesis output.
 *
 * @param {Object} parsedAnalysis
 * @param {Object} canonicalResume
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateClaims(parsedAnalysis, canonicalResume) {
  if (!parsedAnalysis || !canonicalResume) return { valid: false, violations: ['Missing input'] }

  const sourceTokens = buildSourceFactTokens(canonicalResume)
  const allViolations = []

  // Overall review
  allViolations.push(...validateTextClaims(
    parsedAnalysis.overallReview?.summary,
    sourceTokens,
    'overallReview.summary'
  ))

  // Strengths
  for (const str of (parsedAnalysis.strengths || [])) {
    allViolations.push(...validateTextClaims(str.description, sourceTokens, `${str.id}.description`))
  }

  // Issues
  for (const iss of (parsedAnalysis.issues || [])) {
    allViolations.push(...validateTextClaims(iss.diagnosis, sourceTokens, `${iss.id}.diagnosis`))
    allViolations.push(...validateTextClaims(iss.recommendation, sourceTokens, `${iss.id}.recommendation`))
    allViolations.push(...validateTextClaims(iss.correctedText, sourceTokens, `${iss.id}.correctedText`))
  }

  // Priority actions
  for (const pa of (parsedAnalysis.priorityActions || [])) {
    allViolations.push(...validateTextClaims(pa.action, sourceTokens, `priority_${pa.priority}.action`))
  }

  return {
    valid: allViolations.length === 0,
    violations: allViolations,
  }
}

export default {
  validateClaims,
}
