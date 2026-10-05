/**
 * Quantitative Metric Extractor
 * Extracts explicitly stated quantitative evidence across resume bullet points
 * into structured categories: percentage, count, duration, time, currency, multiplier, range.
 */

import { METRIC_CATEGORIES } from './signalTypes.js'

/**
 * Extracts all metrics from a specific bullet text with source coordinates.
 *
 * @param {string} text - The raw bullet text
 * @param {Object} source - { itemId, bulletId, originalText }
 * @returns {Array<{ value: string, type: string, source: Object }>}
 */
export function extractMetricsFromText(text, source) {
  if (!text || typeof text !== 'string') return []
  const clean = text.trim()
  const results = []
  const matchedSet = new Set()
  const takenPositions = new Set()

  const addMatch = (value, type, start, end) => {
    if (!value) return
    const key = `${type}_${start}_${end}`
    if (matchedSet.has(key)) return
    matchedSet.add(key)

    if (type !== METRIC_CATEGORIES.RANGE) {
      for (let pos = start; pos < end; pos++) {
        takenPositions.add(pos)
      }
    }

    results.push({
      value: value.trim(),
      type,
      source: {
        itemId: source?.itemId || '',
        bulletId: source?.bulletId || '',
        originalText: source?.originalText || clean,
      },
    })
  }

  // Pre-filter phone numbers (e.g. "(555) 345-6789", "345-6789") to avoid parsing them as numbers or ranges
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3}-\d{4}\b/g
  let pMatch
  while ((pMatch = phoneRegex.exec(clean)) !== null) {
    for (let pos = pMatch.index; pos < pMatch.index + pMatch[0].length; pos++) {
      takenPositions.add(pos)
    }
  }

  // 1. Range metrics (e.g. "72% to 94%", "850ms to 120ms", "5 to 10", "10–20", "5-10%")
  const rangeRegex = /\b\d+(?:\.\d+)?(?:%|ms|s|x)?\s*(?:to|–)\s*\d+(?:\.\d+)?(?:%|ms|s|x)?\b|\b\d+(?:\.\d+)?(?:%|ms|s|x)\s*-\s*\d+(?:\.\d+)?(?:%|ms|s|x)?\b|\b\d+\s*-\s*\d+%/gi
  let match
  while ((match = rangeRegex.exec(clean)) !== null) {
    if (!takenPositions.has(match.index)) {
      addMatch(match[0], METRIC_CATEGORIES.RANGE, match.index, match.index + match[0].length)
    }
  }

  // 2. Percentage metrics (e.g. "38%", "35%", "94%")
  const percentRegex = /\b\d+(?:\.\d+)?%/g
  while ((match = percentRegex.exec(clean)) !== null) {
    addMatch(match[0], METRIC_CATEGORIES.PERCENTAGE, match.index, match.index + match[0].length)
  }

  // 3. Multiplier metrics (e.g. "3x", "10x", "2.5x")
  const multRegex = /\b\d+(?:\.\d+)?x\b/gi
  while ((match = multRegex.exec(clean)) !== null) {
    addMatch(match[0], METRIC_CATEGORIES.MULTIPLIER, match.index, match.index + match[0].length)
  }

  // 4. Currency metrics (e.g. "$50M", "$100k", "$2.5 million")
  const currencyRegex = /\$\s*\d+(?:[.,]\d+)?\s*(?:k|m|b|million|billion)?\b/gi
  while ((match = currencyRegex.exec(clean)) !== null) {
    addMatch(match[0], METRIC_CATEGORIES.CURRENCY, match.index, match.index + match[0].length)
  }

  // 5. Time & latency metrics (e.g. "<1 second", "< 1 second", "sub-50ms", "850ms", "120ms")
  const timeRegex = /(?:<|sub-)?\s*\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|sec|minutes?|mins?|hours?|hrs?)\b/gi
  while ((match = timeRegex.exec(clean)) !== null) {
    const val = match[0].trim()
    // Distinguish duration vs latency/time
    const isDuration = /\b(?:hours?\/month|hours?\/week|hours?|hrs?|days?|weeks?|months?|years?)\b/i.test(val) &&
      !/(?:<|sub-|ms|millisecond)/i.test(val)
    if (isDuration) {
      addMatch(val, METRIC_CATEGORIES.DURATION, match.index, match.index + match[0].length)
    } else {
      addMatch(val, METRIC_CATEGORIES.TIME, match.index, match.index + match[0].length)
    }
  }

  // 6. Explicit compound durations (e.g. "50+ hours/month", "25+ hours/week", "20+ hours", "12 months")
  const durationRegex = /\b\d+\+?\s*(?:hours?|hrs?|days?|weeks?|months?|years?)(?:\/(?:month|week|day|year))?\b/gi
  while ((match = durationRegex.exec(clean)) !== null) {
    addMatch(match[0], METRIC_CATEGORIES.DURATION, match.index, match.index + match[0].length)
  }

  // 7. Counts with units or plus signs (e.g. "5,000+", "200+", "170-query", "20+ production releases", "9 tools", "100 simulated")
  const countWithUnitRegex = /\b\d+(?:,\d{3})*\+?(?:-(?:query|model|tool|node|cluster|pipeline))?\s*(?:tools?|queries|releases?|users?|members?|faculty|engineers?|sessions?|requests?|events\/second|events|records?|transactions?|tables?|deployments?|services?)?\b/gi
  while ((match = countWithUnitRegex.exec(clean)) !== null) {
    const matchedStr = match[0].trim()
    // Must contain numbers
    if (/\d/.test(matchedStr) && !takenPositions.has(match.index)) {
      // Don't capture plain standalone calendar years (e.g. 2021, 2023) as counts
      const isYear = /^(?:19|20)\d{2}$/.test(matchedStr)
      if (!isYear) {
        addMatch(matchedStr, METRIC_CATEGORIES.COUNT, match.index, match.index + matchedStr.length)
      }
    }
  }

  return results
}

/**
 * Main extractor across the canonical resume.
 *
 * @param {Object} canonicalResume
 * @returns {{ metrics: Array, summary: Object }}
 */
export function extractResumeMetrics(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return { metrics: [], summary: { totalMetrics: 0, byType: {} } }
  }

  const allMetrics = []

  // 1. Summary
  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) ||
    canonicalResume.candidate?.summary ||
    ''
  if (summaryText.trim()) {
    const metrics = extractMetricsFromText(summaryText, {
      itemId: 'summary_001',
      bulletId: 'summary_001',
      originalText: summaryText.trim(),
    })
    allMetrics.push(...metrics)
  }

  // 2. Experience
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp || !Array.isArray(exp.bullets)) continue
      const itemId = exp.id || 'exp_unknown'
      for (const b of exp.bullets) {
        if (!b || !b.text) continue
        const metrics = extractMetricsFromText(b.text, {
          itemId,
          bulletId: b.id || `${itemId}_b`,
          originalText: b.text.trim(),
        })
        allMetrics.push(...metrics)
      }
    }
  }

  // 3. Projects
  if (Array.isArray(canonicalResume.projects)) {
    for (const proj of canonicalResume.projects) {
      if (!proj || !Array.isArray(proj.bullets)) continue
      const itemId = proj.id || 'proj_unknown'
      for (const b of proj.bullets) {
        if (!b || !b.text) continue
        const metrics = extractMetricsFromText(b.text, {
          itemId,
          bulletId: b.id || `${itemId}_b`,
          originalText: b.text.trim(),
        })
        allMetrics.push(...metrics)
      }
    }
  }

  // Build summary breakdown by metric type
  const byType = {}
  for (const m of allMetrics) {
    byType[m.type] = (byType[m.type] || 0) + 1
  }

  return {
    metrics: allMetrics,
    summary: {
      totalMetrics: allMetrics.length,
      byType,
    },
  }
}

export default extractResumeMetrics
