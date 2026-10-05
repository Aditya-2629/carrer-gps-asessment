/**
 * Claim Evidence Analyzer
 * Identifies statements containing quantitative, performance, scale, outcome,
 * or technology claims across resume bullet points, mapping them back to exact evidence coordinates.
 * Does NOT judge whether a claim is true or false; identifies where claims exist.
 */

import { CLAIM_TYPES } from './signalTypes.js'

// Curated patterns for different claim types
const PERFORMANCE_PATTERN =
  /\b(?:latency|throughput|response\s+time|page\s+load|roundtrip|query\s+time|dispatch|speed|faster|reduced\s+latency|sub-\d+ms|\d+ms)\b/i

const SCALE_PATTERN =
  /\b(?:\d+x\s+concurrent|\d+,\d+\s+users|\d+\+\s+(?:users|faculty|members|engineers|sessions)|concurrent\s+capacity|zero-downtime|\d+\+\s+production\s+releases|enterprise\s+scale|multi-region|distributed|high-throughput)\b/i

const OUTCOME_PATTERN =
  /\b(?:resulting\s+in|eliminating|elevating|elevated|cutting|reducing|reduced|automated|delivered|increased|achieving|achieved)\b/i

const QUANTITATIVE_PATTERN =
  /\b(?:\d+%\s+(?:faster|reduction|increase|accuracy)|\d+-\w+|\d+\+\s+hours|\$\d+|\d+,\d+|\d+x)\b/i

const TECH_CLAIM_PATTERN =
  /\b(?:fastmcp(?:\s+protocol)?|rag\s+architecture|vector\s+dbs?|read-aside\s+caching|tenant\s+isolation|soc2\s+compliance|json-rpc)\b/i

/**
 * Evaluates a single bullet text for present claims.
 */
export function extractClaimsFromBullet(text, source) {
  if (!text || typeof text !== 'string') return []
  const clean = text.trim()
  const claims = []

  const testAndAdd = (pattern, claimType) => {
    if (pattern.test(clean)) {
      claims.push({
        claimType,
        text: clean,
        itemId: source?.itemId || '',
        bulletId: source?.bulletId || '',
      })
    }
  }

  testAndAdd(PERFORMANCE_PATTERN, CLAIM_TYPES.PERFORMANCE)
  testAndAdd(SCALE_PATTERN, CLAIM_TYPES.SCALE)
  testAndAdd(OUTCOME_PATTERN, CLAIM_TYPES.OUTCOME)
  testAndAdd(QUANTITATIVE_PATTERN, CLAIM_TYPES.QUANTITATIVE)
  testAndAdd(TECH_CLAIM_PATTERN, CLAIM_TYPES.TECHNOLOGY)

  return claims
}

/**
 * Main function: Analyzes all claims across experience and project bullets.
 *
 * @param {Object} canonicalResume
 * @returns {{ claims: Array, summary: Object }}
 */
export function analyzeClaimEvidence(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return { claims: [], summary: { totalClaims: 0, byType: {} } }
  }

  const allClaims = []

  // Collect from experience
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp || !Array.isArray(exp.bullets)) continue
      const itemId = exp.id || 'exp_unknown'
      for (const b of exp.bullets) {
        if (!b || !b.text) continue
        const claims = extractClaimsFromBullet(b.text, {
          itemId,
          bulletId: b.id || `${itemId}_b`,
        })
        allClaims.push(...claims)
      }
    }
  }

  // Collect from projects
  if (Array.isArray(canonicalResume.projects)) {
    for (const proj of canonicalResume.projects) {
      if (!proj || !Array.isArray(proj.bullets)) continue
      const itemId = proj.id || 'proj_unknown'
      for (const b of proj.bullets) {
        if (!b || !b.text) continue
        const claims = extractClaimsFromBullet(b.text, {
          itemId,
          bulletId: b.id || `${itemId}_b`,
        })
        allClaims.push(...claims)
      }
    }
  }

  const byType = {}
  for (const c of allClaims) {
    byType[c.claimType] = (byType[c.claimType] || 0) + 1
  }

  return {
    claims: allClaims,
    summary: {
      totalClaims: allClaims.length,
      byType,
    },
  }
}

export default analyzeClaimEvidence
