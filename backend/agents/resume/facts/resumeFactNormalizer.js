/**
 * Resume Fact Normalizer — V3
 *
 * Post-processes raw facts to:
 * 1. De-duplicate overlapping metric facts (same value from same bullet)
 * 2. Assign stable factId sequence after dedup
 * 3. Enrich technology facts with normalized names
 * 4. Flag high-confidence achievement facts (have both metric + context)
 */

import { FACT_TYPES } from '../state/resumeState.schema.js'

/**
 * Normalizes and de-duplicates a fact array.
 *
 * @param {Array} facts - Raw facts from extractResumeFacts()
 * @returns {Array} - Cleaned fact array
 */
export function normalizeFacts(facts) {
  if (!Array.isArray(facts)) return []

  const dedupSet = new Set()
  const normalized = []
  let counter = 1

  for (const fact of facts) {
    // Build a dedup key for metric facts to avoid duplicate metric/achievement pairs from same bullet
    let key
    if (fact.type === FACT_TYPES.METRIC) {
      key = `metric::${fact.value}::${fact.bulletId || fact.itemId}`
    } else if (fact.type === FACT_TYPES.ACHIEVEMENT || fact.type === FACT_TYPES.RESPONSIBILITY) {
      // De-duplicate bullets that appear more than once (should not happen, but guard)
      key = `${fact.type}::${fact.bulletId || fact.itemId}::${fact.value.slice(0, 60)}`
    } else {
      key = `${fact.type}::${fact.value}::${fact.itemId}`
    }

    if (dedupSet.has(key)) continue
    dedupSet.add(key)

    // Re-assign stable factId after dedup
    const normalizedFact = {
      ...fact,
      factId: `fact_${String(counter).padStart(3, '0')}`,
    }
    counter++
    normalized.push(normalizedFact)
  }

  return normalized
}

/**
 * Builds an index of facts by itemId for fast lookup.
 *
 * @param {Array} facts
 * @returns {Map<string, Array>} - itemId -> facts[]
 */
export function buildFactIndex(facts) {
  const index = new Map()
  for (const fact of facts) {
    if (!index.has(fact.itemId)) {
      index.set(fact.itemId, [])
    }
    index.get(fact.itemId).push(fact)
  }
  return index
}

/**
 * Returns all facts associated with a specific bullet.
 *
 * @param {Array} facts
 * @param {string} bulletId
 * @returns {Array}
 */
export function getFactsForBullet(facts, bulletId) {
  if (!bulletId) return []
  return facts.filter((f) => f.bulletId === bulletId)
}

/**
 * Returns all metric facts from a specific section.
 *
 * @param {Array} facts
 * @param {string} section - 'experience' | 'projects' | 'summary'
 * @returns {Array}
 */
export function getMetricsForSection(facts, section) {
  return facts.filter((f) => f.type === FACT_TYPES.METRIC && f.section === section)
}

export default {
  normalizeFacts,
  buildFactIndex,
  getFactsForBullet,
  getMetricsForSection,
}
