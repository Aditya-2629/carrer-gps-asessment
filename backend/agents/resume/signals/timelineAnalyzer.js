/**
 * Timeline Analyzer
 * Deterministically analyzes start/end dates across experience, education, and projects.
 * Identifies chronological ordering, timeline gaps, and concurrent overlapping periods
 * as objective facts without judging overlaps as errors.
 */

const MONTH_NAMES = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

/**
 * Parses raw date string into a comparable numeric epoch { year, month, raw, isPresent }
 */
export function parseDateToken(token) {
  if (!token || typeof token !== 'string') return null
  const clean = token.trim().toLowerCase()

  if (/^(?:present|current|now|ongoing)$/i.test(clean)) {
    return { year: 2026, month: 12, raw: token.trim(), isPresent: true }
  }

  // Format: "Month Year" (e.g. "March 2023", "June 2021", "Mar 2023")
  const monthYearMatch = clean.match(/^([a-z]+)\s+(\d{4})$/)
  if (monthYearMatch) {
    const month = MONTH_NAMES[monthYearMatch[1]] || 1
    const year = parseInt(monthYearMatch[2], 10)
    return { year, month, raw: token.trim(), isPresent: false }
  }

  // Format: "MM/YYYY" or "YYYY-MM"
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    return { year: parseInt(slashMatch[2], 10), month: parseInt(slashMatch[1], 10), raw: token.trim(), isPresent: false }
  }

  // Format: Year only "2021", "2017"
  const yearOnlyMatch = clean.match(/^(\d{4})$/)
  if (yearOnlyMatch) {
    return { year: parseInt(yearOnlyMatch[1], 10), month: 1, raw: token.trim(), isPresent: false }
  }

  return null
}

/**
 * Extracts start and end date from a range string (e.g. "March 2023 – Present", "June 2021 – February 2023", "2017 – 2021")
 */
export function parseDateRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return null
  const parts = rangeStr.split(/[–—\-–]|(?:\s+to\s+)/i).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const startParsed = parseDateToken(parts[0])
  const endParsed = parts.length > 1 ? parseDateToken(parts[1]) : (startParsed?.isPresent ? startParsed : null)

  if (!startParsed) return null

  return {
    rawRange: rangeStr.trim(),
    start: startParsed,
    end: endParsed || startParsed,
  }
}

/**
 * Checks if two date ranges overlap.
 */
function checkOverlap(rangeA, rangeB) {
  if (!rangeA || !rangeB || !rangeA.start || !rangeB.start) return false

  const aStartVal = rangeA.start.year * 12 + rangeA.start.month
  const aEndVal = (rangeA.end?.year || rangeA.start.year) * 12 + (rangeA.end?.month || 12)

  const bStartVal = rangeB.start.year * 12 + rangeB.start.month
  const bEndVal = (rangeB.end?.year || rangeB.start.year) * 12 + (rangeB.end?.month || 12)

  return aStartVal <= bEndVal && bStartVal <= aEndVal
}

/**
 * Main timeline analysis across canonical resume.
 *
 * @param {Object} canonicalResume
 * @returns {{ overlaps: Array, items: Array, summary: Object }}
 */
export function analyzeTimeline(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return { overlaps: [], items: [], summary: { totalItemsWithDates: 0, overlapCount: 0 } }
  }

  const timelineItems = []

  // 1. Experience dates
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp) continue
      const itemId = exp.id || 'exp_unknown'
      const dateText = exp.dates || exp.startDate || exp.company || ''
      const range = parseDateRange(dateText)
      if (range) {
        timelineItems.push({
          itemId,
          section: 'experience',
          title: exp.role || exp.company || itemId,
          range,
        })
      }
    }
  }

  // 2. Education dates
  if (Array.isArray(canonicalResume.education)) {
    for (const edu of canonicalResume.education) {
      if (!edu) continue
      const itemId = edu.id || 'edu_unknown'
      const dateText = edu.dates || edu.year || edu.degree || ''
      const range = parseDateRange(dateText)
      if (range) {
        timelineItems.push({
          itemId,
          section: 'education',
          title: edu.degree || edu.institution || itemId,
          range,
        })
      }
    }
  }

  // Detect overlaps between items
  const overlaps = []
  for (let i = 0; i < timelineItems.length; i++) {
    for (let j = i + 1; j < timelineItems.length; j++) {
      const itemA = timelineItems[i]
      const itemB = timelineItems[j]

      if (checkOverlap(itemA.range, itemB.range)) {
        overlaps.push({
          itemA: itemA.itemId,
          itemB: itemB.itemId,
          sectionA: itemA.section,
          sectionB: itemB.section,
          titleA: itemA.title,
          titleB: itemB.title,
          startA: itemA.range.start.raw,
          endA: itemA.range.end.raw,
          startB: itemB.range.start.raw,
          endB: itemB.range.end.raw,
        })
      }
    }
  }

  return {
    overlaps,
    items: timelineItems.map((it) => ({
      itemId: it.itemId,
      section: it.section,
      title: it.title,
      start: it.range.start.raw,
      end: it.range.end.raw,
    })),
    summary: {
      totalItemsWithDates: timelineItems.length,
      overlapCount: overlaps.length,
    },
  }
}

export default analyzeTimeline
