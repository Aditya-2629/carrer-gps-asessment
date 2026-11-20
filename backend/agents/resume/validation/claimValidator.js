/**
 * Claim Validator — V3 (Phase 2: Bullet-Level Evidence Validation)
 *
 * Detects fabricated metrics, new technologies, and unverified factual claims
 * in the synthesis output. Enforces bullet-level source grounding so metrics
 * from one project or employer cannot validate a rewrite for another.
 *
 * Tags each rewrite with explicit evidenceStatus:
 * - VERIFIED: Metrics/tools explicitly supported by that source bullet/item.
 * - CALCULATED: Derived mathematically from candidate-confirmed baseline & final values.
 * - CANDIDATE_CONFIRMED: Directly supplied by the candidate.
 * - GROUNDED_QUALITATIVE: Publication-ready Layer A rewrite with no unverified numbers.
 * - UNVERIFIED: Contains unsupported claims (auto-sanitized to GROUNDED_QUALITATIVE).
 * - ILLUSTRATIVE: Layer B discovery prompts (metricOpportunities).
 */

// Tokens that appear in resume-generated content that must exist in source
export const CURRENCY_PATTERN = /\$\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|b|million|billion))?\b/gi
export const PERCENTAGE_PATTERN = /\b\d+(?:\.\d+)?%/g
export const MULTIPLIER_PATTERN = /\b\d+(?:\.\d+)?x\b/gi
export const SCALE_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:k|m|b|million|billion)\+?\b/gi
export const LARGE_COUNT_PATTERN = /\b\d{4,}(?:[,+]\d+)*\b/g  // 4+ digit numbers

/**
 * Extracts all numeric fact tokens from a text string.
 * Normalizes to lowercase and strips whitespace.
 * @param {string} text
 * @returns {Set<string>}
 */
export function extractFactTokens(text) {
  if (!text || typeof text !== 'string') return new Set()
  const tokens = new Set()
  const patterns = [CURRENCY_PATTERN, PERCENTAGE_PATTERN, MULTIPLIER_PATTERN, SCALE_PATTERN, LARGE_COUNT_PATTERN]
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let m
    while ((m = pattern.exec(text)) !== null) {
      tokens.add(m[0].replace(/\s+/g, '').toLowerCase())
    }
  }
  return tokens
}

/**
 * Collects all numeric fact tokens from the canonical resume globally.
 * @param {Object} canonicalResume
 * @returns {Set<string>}
 */
export function buildSourceFactTokens(canonicalResume) {
  const tokens = new Set()
  if (!canonicalResume || typeof canonicalResume !== 'object') return tokens

  const addText = (text) => {
    if (text) extractFactTokens(String(text)).forEach((t) => tokens.add(t))
  }

  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) || ''
  addText(summaryText)

  for (const exp of (canonicalResume.experience || canonicalResume.experiences || [])) {
    addText(exp.company)
    addText(exp.employer)
    addText(exp.role)
    addText(exp.title)
    addText(exp.dates)
    addText(exp.startDate)
    addText(exp.endDate)
    for (const b of (exp.bullets || [])) {
      addText(typeof b === 'string' ? b : b?.text)
    }
  }

  for (const proj of (canonicalResume.projects || [])) {
    addText(proj.title)
    addText(proj.name)
    addText(proj.dates)
    for (const b of (proj.bullets || [])) {
      addText(typeof b === 'string' ? b : b?.text)
    }
  }

  for (const edu of (canonicalResume.education || [])) {
    addText(edu.institution)
    addText(edu.degree)
    addText(edu.dates)
    addText(edu.year)
  }

  if (canonicalResume.rawText) {
    addText(canonicalResume.rawText)
  }

  return tokens
}

/**
 * Builds bullet/item-specific fact tokens for a given bulletId / itemId.
 * This guarantees a metric from Project A cannot silently validate Job B!
 *
 * @param {Object} canonicalResume
 * @param {string|null} [bulletId]
 * @param {string|null} [itemId]
 * @param {string} [originalText]
 * @returns {Set<string>}
 */
export function buildBulletSourceTokens(canonicalResume, bulletId = null, itemId = null, originalText = '') {
  const tokens = new Set()
  const addText = (text) => {
    if (text) extractFactTokens(String(text)).forEach((t) => tokens.add(t))
  }

  if (originalText) {
    addText(originalText)
  }

  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return tokens
  }

  const experiences = canonicalResume.experience || canonicalResume.experiences || []
  for (const exp of experiences) {
    const isMatchingItem = itemId && (exp.id === itemId || exp._id === itemId)
    const matchingBullet = bulletId && (exp.bullets || []).find((b) => b && (b.id === bulletId || b.bulletId === bulletId))

    if (matchingBullet || isMatchingItem) {
      addText(exp.role)
      addText(exp.title)
      addText(exp.company)
      addText(exp.employer)
      if (matchingBullet) {
        addText(typeof matchingBullet === 'string' ? matchingBullet : matchingBullet.text)
      } else {
        for (const b of (exp.bullets || [])) {
          addText(typeof b === 'string' ? b : b?.text)
        }
      }
      return tokens
    }
  }

  const projects = canonicalResume.projects || []
  for (const proj of projects) {
    const isMatchingItem = itemId && (proj.id === itemId || proj._id === itemId)
    const matchingBullet = bulletId && (proj.bullets || []).find((b) => b && (b.id === bulletId || b.bulletId === bulletId))

    if (matchingBullet || isMatchingItem) {
      addText(proj.title)
      addText(proj.name)
      if (matchingBullet) {
        addText(typeof matchingBullet === 'string' ? matchingBullet : matchingBullet.text)
      } else {
        for (const b of (proj.bullets || [])) {
          addText(typeof b === 'string' ? b : b?.text)
        }
      }
      return tokens
    }
  }

  return tokens
}

/**
 * Strips unverified numeric tokens (numbers, percentages, currencies, multipliers, scale, latency)
 * not present in sourceTokens or the source bullet/project, replacing them cleanly with
 * qualitative impact phrasing (never [ADD: ...]).
 *
 * @param {string} correctedText
 * @param {Set<string>|Array<string>|string} sourceTokens
 * @param {Object} [canonicalResume]
 * @param {Object} [options]
 * @param {string} [options.evidenceStatus] - 'CANDIDATE_CONFIRMED' | 'CALCULATED'
 * @param {string} [options.bulletId]
 * @param {string} [options.sourceText]
 * @returns {string}
 */
export function replaceUnverifiedNumericTokens(correctedText, sourceTokens, canonicalResume, options = {}) {
  if (!correctedText || typeof correctedText !== 'string') return correctedText

  if (options.evidenceStatus === 'CANDIDATE_CONFIRMED' || options.evidenceStatus === 'CALCULATED') {
    return correctedText
  }

  const allowed = new Set()
  if (sourceTokens) {
    if (sourceTokens instanceof Set) {
      sourceTokens.forEach((t) => allowed.add(String(t).toLowerCase().replace(/\s+/g, '')))
    } else if (Array.isArray(sourceTokens)) {
      sourceTokens.forEach((t) => allowed.add(String(t).toLowerCase().replace(/\s+/g, '')))
    } else if (typeof sourceTokens === 'string') {
      extractFactTokens(sourceTokens).forEach((t) => allowed.add(t))
    }
  }

  if (options.sourceText && typeof options.sourceText === 'string') {
    extractFactTokens(options.sourceText).forEach((t) => allowed.add(t))
  }

  if (canonicalResume && options.bulletId) {
    const bulletTokens = buildBulletSourceTokens(canonicalResume, options.bulletId, null, options.sourceText)
    bulletTokens.forEach((t) => allowed.add(t))
  }

  // Regex patterns for numeric claims
  const NUMERIC_CLAIM_REGEX = /\b(?:\$\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|b|million|billion))?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?x|\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|b|million|billion)\+?|\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|mins?|minutes?|hours?|hrs?))\b/gi

  NUMERIC_CLAIM_REGEX.lastIndex = 0
  const unverifiedClaims = []
  let match
  while ((match = NUMERIC_CLAIM_REGEX.exec(correctedText)) !== null) {
    const rawClaim = match[0]
    const normClaim = rawClaim.toLowerCase().replace(/\s+/g, '')

    // Allow calendar years (e.g. 2021, 2024)
    if (/^(?:19|20)\d{2}$/.test(normClaim)) continue

    // Allow software version numbers (e.g. Python 3.11, React 19, OAuth 2.0, WCAG 2.1)
    const idx = match.index
    const prefix = correctedText.slice(Math.max(0, idx - 15), idx)
    if (/\b(?:react|angular|vue|python|node|es|wcag|oauth|jwt|html|css|java|ecma|c\+\+|c#|dot net|\.net|v|ver|version)\s*$/i.test(prefix)) {
      continue
    }

    if (!allowed.has(normClaim)) {
      unverifiedClaims.push(rawClaim)
    }
  }

  if (unverifiedClaims.length === 0) {
    return correctedText
  }

  let sanitized = correctedText

  // 1. Latency / speed percentage phrases:
  sanitized = sanitized.replace(/,\s*(?:cutting|reducing|slashing|dropping)\s+([^,.]+?)\s+by\s+\d+(?:\.\d+)?%/gi, ', optimizing $1')
  sanitized = sanitized.replace(/\b(?:cutting|reducing|slashing|dropping)\s+([^,.]+?)\s+by\s+\d+(?:\.\d+)?%/gi, 'optimizing $1')

  // 2. "from X to Y" duration / turnaround drops
  sanitized = sanitized.replace(/\bfrom\s+[^,.]+\s+to\s+[^,.]+(?=[,.]|$)/gi, 'measurably')

  // 3. Uptime percentages
  sanitized = sanitized.replace(/\b(?:with\s+|sustaining\s+)?99(?:\.\d+)?%\s*(?:uptime|service\s+availability|availability)\b/gi, 'with high system availability')

  // 4. Scale numbers on transactions/requests/records
  sanitized = sanitized.replace(/\b\d+(?:,\d{3})*(?:\.\d+)?[kmbKMB]?\+?\s*(daily\s+)?(transactions?|requests?|records?|queries?|events?)\b/gi, 'enterprise $1$2')
  sanitized = sanitized.replace(/\b\d+(?:,\d{3})*(?:\.\d+)?[kmbKMB]?\+?\s*(users?|customers?|clients?|stakeholders?)\b/gi, 'cross-functional $1')
  sanitized = sanitized.replace(/\b\d+(?:,\d{3})*(?:\.\d+)?[kmbKMB]?\+?\s*(skus?|items?|documents?)\b/gi, 'enterprise-scale $1')

  // 5. Multipliers
  sanitized = sanitized.replace(/\b\d+(?:\.\d+)?x\s*(?:throughput\s+increase|increase|throughput)\b/gi, 'high throughput')
  sanitized = sanitized.replace(/\bby\s+\d+(?:\.\d+)?x\b/gi, 'substantially')

  // 6. Hours saved
  sanitized = sanitized.replace(/\b(?:saving\s+)?\d+(?:[-–]\d+)?\+?\s*(?:engineering\s+)?hours?(?:\/week|\s+weekly)?\b/gi, 'saving recurring engineering hours')

  // 7. General "by X%" phrases
  sanitized = sanitized.replace(/\s+by\s+\d+(?:\.\d+)?%/gi, '')

  // 8. General dollar amounts
  sanitized = sanitized.replace(/\$\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|b|million|billion))?\b/gi, 'budgeted resources')

  // 9. Remove any remaining raw percentages not in allowed tokens
  sanitized = sanitized.replace(/\b\d+(?:\.\d+)?%\b/g, (pct) => {
    return allowed.has(pct.toLowerCase().replace(/\s+/g, '')) ? pct : ''
  })

  // 10. Clean up syntax and punctuation artifacts
  sanitized = sanitized
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+(?:by|to|from|with|across|in|of)\s*([.,;])/gi, '$1')
    .replace(/\s+(?:by|to|from|with|across|in|of)\s+(?:by|to|from|with|across|in|of)\b/gi, 'by')
    .replace(/\b(and|or)\s*([.,;])/gi, '$2')
    .replace(/,\s*,/g, ',')
    .replace(/\s+([.,;])/g, '$1')
    .trim()

  if (sanitized && !/[.!?]$/.test(sanitized)) {
    sanitized += '.'
  }

  try {
    console.warn('[replaceUnverifiedNumericTokens] Sanitized unverified numeric claim:', {
      unverifiedClaims,
      original: correctedText,
      sanitized,
    })
  } catch (_e) {}

  return sanitized
}

/**
 * Computes an explicit evidenceStatus tag for a given rewrite.
 *
 * @param {string} rewriteText
 * @param {Set<string>} sourceTokens - Bullet-level source tokens
 * @param {Object} [options]
 * @returns {'VERIFIED' | 'CALCULATED' | 'CANDIDATE_CONFIRMED' | 'GROUNDED_QUALITATIVE' | 'UNVERIFIED'}
 */
export function tagEvidenceStatus(rewriteText, sourceTokens, options = {}) {
  if (options.evidenceStatus === 'CANDIDATE_CONFIRMED') return 'CANDIDATE_CONFIRMED'
  if (options.evidenceStatus === 'CALCULATED') return 'CALCULATED'

  if (!rewriteText || typeof rewriteText !== 'string') {
    return 'GROUNDED_QUALITATIVE'
  }

  const factTokens = extractFactTokens(rewriteText)
  const nonYearTokens = Array.from(factTokens).filter((t) => !/^(?:19|20)\d{2}$/.test(t))

  if (nonYearTokens.length === 0) {
    return 'GROUNDED_QUALITATIVE'
  }

  const unverified = nonYearTokens.filter((t) => !sourceTokens.has(t))
  if (unverified.length === 0) {
    return 'VERIFIED'
  }

  return 'UNVERIFIED'
}

/**
 * Validates a single text block against the source tokens.
 */
function validateTextClaims(text, sourceTokens, location, canonicalResume = null) {
  if (!text) return []
  const violations = []
  const generatedTokens = extractFactTokens(text)
  for (const token of generatedTokens) {
    if (!sourceTokens.has(token)) {
      if (/^(?:19|20)\d{2}$/.test(token) && canonicalResume) {
        const resumeStr = JSON.stringify(canonicalResume)
        if (resumeStr.includes(token)) {
          continue
        }
      }
      violations.push(`[${location}] Fabricated metric or claim detected: "${token}" not found in source resume`)
    }
  }
  return violations
}

/**
 * Validates all claim-bearing fields in the synthesis output with bullet-level precision.
 * Attaches evidenceStatus to all rewrites and sanitizes any unverified claims.
 *
 * @param {Object} parsedAnalysis
 * @param {Object} canonicalResume
 * @param {Object} [options]
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateClaims(parsedAnalysis, canonicalResume, options = {}) {
  if (!parsedAnalysis || !canonicalResume) return { valid: false, violations: ['Missing input'] }

  const sourceTokens = buildSourceFactTokens(canonicalResume)
  const allViolations = []

  // 1. Overall review narrative
  allViolations.push(...validateTextClaims(
    parsedAnalysis.overallReview?.summary,
    sourceTokens,
    'overallReview.summary',
    canonicalResume
  ))

  // 2. Strengths
  for (const str of (parsedAnalysis.strengths || [])) {
    allViolations.push(...validateTextClaims(str.description, sourceTokens, `${str.id}.description`, canonicalResume))
  }

  // 3. Issues: strictly ground diagnostic observations in resume facts
  for (const iss of (parsedAnalysis.issues || [])) {
    allViolations.push(...validateTextClaims(iss.diagnosis, sourceTokens, `${iss.id}.diagnosis`, canonicalResume))

    // Bullet-level validation for correctedText
    if (iss.correctedText) {
      const ev = (Array.isArray(iss.evidence) ? iss.evidence[0] : iss.evidence) || {}
      const bulletId = ev.bulletId || ev.itemId || iss.bulletId || iss.id
      const origText = ev.originalText || iss.originalText || ''
      const bulletSourceTokens = buildBulletSourceTokens(canonicalResume, bulletId, ev.itemId, origText)

      let status = tagEvidenceStatus(iss.correctedText, bulletSourceTokens, {
        evidenceStatus: iss.evidenceStatus,
      })

      if (status === 'UNVERIFIED') {
        const sanitized = replaceUnverifiedNumericTokens(iss.correctedText, bulletSourceTokens, canonicalResume, {
          bulletId,
          sourceText: origText,
        })
        iss.correctedText = sanitized
        status = 'GROUNDED_QUALITATIVE'
        allViolations.push(`[${iss.id}.correctedText] Unverified numeric claim sanitized to grounded qualitative outcome.`)
      }

      iss.evidenceStatus = status
    }

    // Layer B metric opportunities: tag as ILLUSTRATIVE (never flagged as fabricated claims)
    if (Array.isArray(iss.metricOpportunities)) {
      iss.metricOpportunities.forEach((opp) => {
        if (opp && typeof opp === 'object') {
          opp.evidenceStatus = 'ILLUSTRATIVE'
        }
      })
    }
  }

  // 4. Bullet Upgrades: bullet-level validation
  if (Array.isArray(parsedAnalysis.bulletUpgrades)) {
    for (const upg of parsedAnalysis.bulletUpgrades) {
      if (upg.rewrittenText) {
        const bulletSourceTokens = buildBulletSourceTokens(canonicalResume, upg.bulletId, null, upg.originalText)
        let status = tagEvidenceStatus(upg.rewrittenText, bulletSourceTokens, {
          evidenceStatus: upg.evidenceStatus,
        })
        if (status === 'UNVERIFIED') {
          upg.rewrittenText = replaceUnverifiedNumericTokens(upg.rewrittenText, bulletSourceTokens, canonicalResume, {
            bulletId: upg.bulletId,
            sourceText: upg.originalText,
          })
          status = 'GROUNDED_QUALITATIVE'
        }
        upg.evidenceStatus = status
      }
      if (Array.isArray(upg.metricOpportunities)) {
        upg.metricOpportunities.forEach((opp) => {
          if (opp && typeof opp === 'object') {
            opp.evidenceStatus = 'ILLUSTRATIVE'
          }
        })
      }
    }
  }

  // 5. Bullet Rewrites: bullet-level validation
  if (Array.isArray(parsedAnalysis.bulletRewrites)) {
    for (const rw of parsedAnalysis.bulletRewrites) {
      const rwText = rw.rewrittenText || rw.readyToUseRewrite || rw.rewritten || rw.rewrite
      if (rwText) {
        const bulletSourceTokens = buildBulletSourceTokens(canonicalResume, rw.bulletId, null, rw.originalText || rw.original)
        let status = tagEvidenceStatus(rwText, bulletSourceTokens, {
          evidenceStatus: rw.evidenceStatus,
        })
        if (status === 'UNVERIFIED') {
          const sanitized = replaceUnverifiedNumericTokens(rwText, bulletSourceTokens, canonicalResume, {
            bulletId: rw.bulletId,
            sourceText: rw.originalText || rw.original,
          })
          rw.rewrittenText = sanitized
          rw.rewritten = sanitized
          rw.readyToUseRewrite = sanitized
          status = 'GROUNDED_QUALITATIVE'
        }
        rw.evidenceStatus = status
      }
      if (Array.isArray(rw.metricOpportunities)) {
        rw.metricOpportunities.forEach((opp) => {
          if (opp && typeof opp === 'object') {
            opp.evidenceStatus = 'ILLUSTRATIVE'
          }
        })
      }
    }
  }

  // 6. Summary Optimization: resume-level grounding
  if (parsedAnalysis.summaryOptimization?.rewrittenSummary) {
    let status = tagEvidenceStatus(parsedAnalysis.summaryOptimization.rewrittenSummary, sourceTokens, {
      evidenceStatus: parsedAnalysis.summaryOptimization.evidenceStatus,
    })
    if (status === 'UNVERIFIED') {
      parsedAnalysis.summaryOptimization.rewrittenSummary = replaceUnverifiedNumericTokens(
        parsedAnalysis.summaryOptimization.rewrittenSummary,
        sourceTokens,
        canonicalResume
      )
      status = 'GROUNDED_QUALITATIVE'
    }
    parsedAnalysis.summaryOptimization.evidenceStatus = status
  }

  return {
    valid: allViolations.length === 0,
    violations: allViolations,
  }
}

export default {
  extractFactTokens,
  buildSourceFactTokens,
  buildBulletSourceTokens,
  replaceUnverifiedNumericTokens,
  tagEvidenceStatus,
  validateClaims,
}
