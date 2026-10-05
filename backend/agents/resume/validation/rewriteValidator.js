/**
 * Rewrite Validator — V3
 *
 * Validates that correctedText in each issue is source-grounded.
 * Only compares correctedText to the bullet's originalText from canonical resume.
 *
 * Forbidden in correctedText:
 * - New metrics / percentages
 * - New technologies
 * - New companies / users / customers
 * - New business outcomes
 * - New responsibilities or architecture claims
 * - New security controls
 * - New production claims
 */

import { stripFillInSlots, findMalformedFillInSlots } from './fillInSlots.js'

// Patterns that indicate a potential new unsupported fact in correctedText
const NEW_METRIC_PATTERNS = [
  /\b\d+(?:\.\d+)?%\b/g,
  /\$\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|b|million|billion))?\b/gi,
  /\b\d+(?:,\d{3})*\+?\s*(?:users?|customers?|clients?|engineers?|teams?|members?)\b/gi,
  /\b\d+x\b/gi,
]

// Forbidden new claim keywords that should NOT appear unless in source
const FORBIDDEN_NEW_CLAIMS = [
  'secret management',
  'compliance',
  'zero-trust',
  'automated vulnerability',
  'production-ready',
  'enterprise-grade',
  'high-scale',
  'mission-critical',
  'customer-facing',
  'led a team',
  'managed engineers',
  'real-time monitoring',
]

/**
 * Extracts all numeric tokens from a text string.
 * @param {string} text
 * @returns {Set<string>}
 */
function extractNumericTokens(text) {
  if (!text) return new Set()
  const tokens = new Set()
  const patterns = [
    /\b\d+(?:\.\d+)?%\b/g,
    /\b\d+(?:,\d{3})*\+?\b/g,
    /\$\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|b|million|billion))?\b/gi,
    /\b\d+x\b/gi,
  ]
  for (const pattern of patterns) {
    let m
    while ((m = pattern.exec(text)) !== null) {
      tokens.add(m[0].replace(/\s+/g, '').toLowerCase())
    }
  }
  return tokens
}

/**
 * Extracts named technology tokens from a text string.
 * Uses an explicit curated list of technology names to avoid false positives
 * from broad regex patterns matching common English words.
 * @param {string} text
 * @returns {Set<string>}
 */
function extractTechTokens(text) {
  if (!text) return new Set()
  const tokens = new Set()

  // Explicit named tech list — only these are checked
  const TECH_NAMES = [
    'kubernetes', 'k8s', 'langchain', 'langgraph', 'terraform', 'ansible',
    'grafana', 'prometheus', 'fastapi', 'fastmcp', 'chromadb', 'pinecone',
    'redis', 'postgres', 'postgresql', 'mysql', 'mongodb', 'elasticsearch',
    'kafka', 'rabbitmq', 'celery', 'nginx', 'docker', 'aws', 'gcp', 'azure',
    'openai', 'anthropic', 'cohere', 'huggingface', 'pytorch', 'tensorflow',
    'react', 'reactjs', 'angular', 'angularjs', 'vue', 'vuejs', 'svelte',
    'nextjs', 'gatsby', 'express', 'fastify', 'flask', 'django', 'spring',
    'graphql', 'grpc', 'websocket', 'tailwind', 'webpack', 'vite',
    'github actions', 'gitlab ci', 'jenkins', 'circleci',
  ]

  const lower = text.toLowerCase()
  for (const tech of TECH_NAMES) {
    // Word-boundary safe check
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(lower)) {
      tokens.add(tech)
    }
  }

  // Also check .js and .py file extension patterns (e.g., "index.js", "app.py")
  const extPattern = /\b[a-z][a-z0-9_-]+\.(?:js|py|ts|go|rb|java|rs)\b/gi
  let m
  while ((m = extPattern.exec(text)) !== null) {
    tokens.add(m[0].toLowerCase())
  }

  return tokens
}

/**
 * Validates a single correctedText against its source originalText.
 *
 * @param {string} correctedText - The LLM-generated corrected bullet
 * @param {string} originalText  - The verbatim source bullet from canonical resume
 * @param {string} bulletId      - For error reporting
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateRewrite(correctedText, originalText, bulletId) {
  const violations = []

  if (!correctedText || typeof correctedText !== 'string') {
    return { valid: true, violations: [] } // null correctedText is always OK
  }
  if (!originalText || typeof originalText !== 'string') {
    return {
      valid: false,
      violations: [`[${bulletId}] correctedText present but originalText is missing — cannot validate`],
    }
  }

  // V3.1: fill-in metric slots ([ADD: ...]) are allowed in correctedText, but
  // must be well-formed (no digits inside). Slot content is stripped before
  // numeric/tech/claim checks so a valid slot never trips fabrication detection.
  violations.push(
    ...findMalformedFillInSlots(correctedText).map((p) => `[${bulletId}] Malformed fill-in slot in correctedText: ${p}`)
  )
  const correctedForChecks = stripFillInSlots(correctedText)

  // 1. Check for new numeric tokens not in source
  const sourceNums = extractNumericTokens(originalText)
  const correctedNums = extractNumericTokens(correctedForChecks)
  for (const num of correctedNums) {
    if (!sourceNums.has(num)) {
      violations.push(`[${bulletId}] New numeric token in correctedText not in source: "${num}"`)
    }
  }

  // 2. Check for new tech tokens not in source
  const sourceTech = extractTechTokens(originalText)
  const correctedTech = extractTechTokens(correctedForChecks)
  for (const tech of correctedTech) {
    if (!sourceTech.has(tech)) {
      violations.push(`[${bulletId}] New technology in correctedText not in source: "${tech}"`)
    }
  }

  // 3. Check for forbidden new claims
  const lowerCorrected = correctedText.toLowerCase()
  const lowerSource = originalText.toLowerCase()
  for (const claim of FORBIDDEN_NEW_CLAIMS) {
    if (lowerCorrected.includes(claim) && !lowerSource.includes(claim)) {
      violations.push(`[${bulletId}] Forbidden unsupported claim in correctedText: "${claim}"`)
    }
  }

  return { valid: violations.length === 0, violations }
}

/**
 * Validates all issues in an analysis for correctedText safety.
 *
 * @param {Array} issues - Parsed issues from analysis
 * @param {Object} canonicalResume - For looking up original bullet text
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateAllRewrites(issues, canonicalResume) {
  if (!Array.isArray(issues)) return { valid: true, violations: [] }

  // Build bullet text lookup
  const bulletTextMap = new Map()
  for (const exp of (canonicalResume.experience || [])) {
    for (const b of (exp.bullets || [])) {
      if (b.id && b.text) bulletTextMap.set(b.id, b.text)
    }
  }
  for (const proj of (canonicalResume.projects || [])) {
    for (const b of (proj.bullets || [])) {
      if (b.id && b.text) bulletTextMap.set(b.id, b.text)
    }
  }

  const allViolations = []
  for (const issue of issues) {
    if (!issue.correctedText) continue

    const evidenceItems = Array.isArray(issue.evidence) ? issue.evidence : [issue.evidence].filter(Boolean)
    for (const ev of evidenceItems) {
      if (!ev) continue
      const bulletId = ev.bulletId || ev.itemId
      const sourceText = ev.originalText || bulletTextMap.get(bulletId) || ''
      const { violations } = validateRewrite(issue.correctedText, sourceText, bulletId || 'unknown')
      allViolations.push(...violations)
    }
  }

  return {
    valid: allViolations.length === 0,
    violations: allViolations,
  }
}

export default {
  validateRewrite,
  validateAllRewrites,
}
