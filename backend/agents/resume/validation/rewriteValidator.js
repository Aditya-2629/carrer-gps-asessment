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
import {
  buildBulletSourceTokens,
  tagEvidenceStatus,
  replaceUnverifiedNumericTokens,
} from './claimValidator.js'

// Patterns that indicate a potential new unsupported fact in correctedText
const NEW_METRIC_PATTERNS = [
  /\b\d+(?:\.\d+)?%\b/g,
  /\$\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|b|million|billion))?\b/gi,
  /\b\d+(?:,\d{3})*\+?\s*(?:users?|customers?|clients?|engineers?|teams?|members?)\b/gi,
  /\b\d+x\b/gi,
]

// Forbidden new claim keywords that should NOT appear unless in source
export const FORBIDDEN_NEW_CLAIMS = []

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
 * Extracts a comprehensive set of technology tokens from the entire canonical resume.
 * Inspects all experience bullets, project bullets, summary text, and skills.
 * @param {Object} canonicalResume
 * @returns {Set<string>}
 */
export function buildResumeTechTokens(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') return new Set()
  const texts = []

  // Summary
  if (canonicalResume.summary) {
    if (typeof canonicalResume.summary === 'string') texts.push(canonicalResume.summary)
    else if (typeof canonicalResume.summary.text === 'string') texts.push(canonicalResume.summary.text)
  }
  if (canonicalResume.candidate?.summary) {
    texts.push(canonicalResume.candidate.summary)
  }

  // Experience
  for (const exp of (canonicalResume.experience || [])) {
    if (exp?.role) texts.push(exp.role)
    if (exp?.company) texts.push(exp.company)
    if (Array.isArray(exp?.technologies)) texts.push(...exp.technologies)
    for (const b of (exp?.bullets || [])) {
      if (b?.text) texts.push(b.text)
    }
  }

  // Projects
  for (const proj of (canonicalResume.projects || [])) {
    if (proj?.name || proj?.title) texts.push(proj.name || proj.title)
    if (Array.isArray(proj?.technologies)) texts.push(...proj.technologies)
    for (const b of (proj?.bullets || [])) {
      if (b?.text) texts.push(b.text)
    }
  }

  // Skills
  if (Array.isArray(canonicalResume.skills)) {
    for (const sk of canonicalResume.skills) {
      if (typeof sk === 'string') texts.push(sk)
      else if (sk && typeof sk === 'object') {
        if (sk.name) texts.push(sk.name)
        if (sk.category) texts.push(sk.category)
        if (Array.isArray(sk.items)) texts.push(...sk.items)
        if (typeof sk.text === 'string') texts.push(sk.text)
      }
    }
  } else if (canonicalResume.skills && typeof canonicalResume.skills === 'object') {
    if (Array.isArray(canonicalResume.skills.items)) texts.push(...canonicalResume.skills.items)
    if (typeof canonicalResume.skills.text === 'string') texts.push(canonicalResume.skills.text)
  }

  // Certifications & Education
  for (const cert of (canonicalResume.certifications || [])) {
    if (cert?.name) texts.push(cert.name)
  }
  for (const edu of (canonicalResume.education || [])) {
    if (edu?.degree) texts.push(edu.degree)
    if (edu?.major) texts.push(edu.major)
  }

  const combinedText = texts.join(' ')
  return extractTechTokens(combinedText)
}

/**
 * Validates a single correctedText against its source originalText and resume-wide technologies.
 * Enforces bullet-level numeric evidence grounding and attaches an explicit evidenceStatus.
 *
 * @param {string} correctedText - The LLM-generated corrected bullet
 * @param {string} originalText  - The verbatim source bullet from canonical resume
 * @param {string} bulletId      - For error reporting
 * @param {Set<string>|null} [resumeTechTokens=null] - Allowed tech tokens across whole resume
 * @param {Object|null} [canonicalResume=null] - For bullet-level source context
 * @param {Object} [options={}] - { evidenceStatus }
 * @returns {{ valid: boolean, violations: string[], evidenceStatus: string, sanitizedText: string }}
 */
export function validateRewrite(
  correctedText,
  originalText,
  bulletId,
  resumeTechTokens = null,
  canonicalResume = null,
  options = {}
) {
  const violations = []

  if (!correctedText || typeof correctedText !== 'string') {
    return { valid: true, violations: [], evidenceStatus: 'GROUNDED_QUALITATIVE', sanitizedText: correctedText }
  }
  if (!originalText || typeof originalText !== 'string') {
    return {
      valid: false,
      violations: [`[${bulletId}] correctedText present but originalText is missing — cannot validate`],
      evidenceStatus: 'UNVERIFIED',
      sanitizedText: correctedText,
    }
  }

  // 1. Check fill-in slots
  violations.push(
    ...findMalformedFillInSlots(correctedText).map((p) => `[${bulletId}] Malformed fill-in slot in correctedText: ${p}`)
  )
  const correctedForChecks = stripFillInSlots(correctedText)

  // 2. Bullet-level numeric evidence validation
  const bulletSourceTokens = buildBulletSourceTokens(canonicalResume, bulletId, null, originalText)
  let evidenceStatus = tagEvidenceStatus(correctedForChecks, bulletSourceTokens, options)
  let sanitizedText = correctedText

  if (evidenceStatus === 'UNVERIFIED') {
    sanitizedText = replaceUnverifiedNumericTokens(correctedText, bulletSourceTokens, canonicalResume, {
      bulletId,
      sourceText: originalText,
      evidenceStatus: options.evidenceStatus,
    })
    evidenceStatus = 'GROUNDED_QUALITATIVE'
    violations.push(`[${bulletId}] Unverified numeric claim in rewrite sanitized to grounded qualitative outcome.`)
  }

  // 3. Check for new tech tokens not in source or resumeTechTokens
  const sourceTech = extractTechTokens(originalText)
  const correctedTech = extractTechTokens(stripFillInSlots(sanitizedText))
  for (const tech of correctedTech) {
    if (!sourceTech.has(tech) && (!resumeTechTokens || !resumeTechTokens.has(tech))) {
      violations.push(`[${bulletId}] New technology in correctedText not in source: "${tech}"`)
    }
  }

  // 4. Check for forbidden new claims
  const lowerCorrected = sanitizedText.toLowerCase()
  const lowerSource = originalText.toLowerCase()
  for (const claim of FORBIDDEN_NEW_CLAIMS) {
    if (lowerCorrected.includes(claim) && !lowerSource.includes(claim)) {
      violations.push(`[${bulletId}] Forbidden unsupported claim in correctedText: "${claim}"`)
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    evidenceStatus,
    sanitizedText,
  }
}

/**
 * Validates all issues in an analysis for correctedText safety at bullet-level precision.
 * Attaches evidenceStatus and sanitizes unsupported numeric claims.
 *
 * @param {Array} issues - Parsed issues from analysis
 * @param {Object} canonicalResume - For looking up original bullet text and full-resume tech
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateAllRewrites(issues, canonicalResume) {
  if (!Array.isArray(issues)) return { valid: true, violations: [] }

  const resumeTechTokens = buildResumeTechTokens(canonicalResume)

  // Build bullet text lookup
  const bulletTextMap = new Map()
  for (const exp of (canonicalResume?.experience || canonicalResume?.experiences || [])) {
    for (const b of (exp?.bullets || [])) {
      if (b && (b.id || b.bulletId) && b.text) {
        bulletTextMap.set(b.id || b.bulletId, b.text)
      }
    }
  }
  for (const proj of (canonicalResume?.projects || [])) {
    for (const b of (proj?.bullets || [])) {
      if (b && (b.id || b.bulletId) && b.text) {
        bulletTextMap.set(b.id || b.bulletId, b.text)
      }
    }
  }

  const allViolations = []
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue

    // Layer B metric opportunities: tag as ILLUSTRATIVE
    if (Array.isArray(issue.metricOpportunities)) {
      issue.metricOpportunities.forEach((opp) => {
        if (opp && typeof opp === 'object') {
          opp.evidenceStatus = 'ILLUSTRATIVE'
        }
      })
    }

    if (!issue.correctedText) continue

    const evidenceItems = Array.isArray(issue.evidence) ? issue.evidence : [issue.evidence].filter(Boolean)
    const ev = evidenceItems[0] || {}
    const bulletId = ev.bulletId || ev.itemId || issue.bulletId || issue.id
    const sourceText = ev.originalText || bulletTextMap.get(bulletId) || issue.originalText || ''

    const result = validateRewrite(
      issue.correctedText,
      sourceText,
      bulletId || 'unknown',
      resumeTechTokens,
      canonicalResume,
      { evidenceStatus: issue.evidenceStatus }
    )

    issue.evidenceStatus = result.evidenceStatus
    if (result.sanitizedText && result.sanitizedText !== issue.correctedText) {
      issue.correctedText = result.sanitizedText
    }
    allViolations.push(...result.violations)
  }

  return {
    valid: allViolations.length === 0,
    violations: allViolations,
  }
}

export default {
  validateRewrite,
  validateAllRewrites,
  buildResumeTechTokens,
}

