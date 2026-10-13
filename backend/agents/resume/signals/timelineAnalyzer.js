/**
 * Timeline Analyzer
 * Deterministically analyzes start/end dates across experience, education, and projects.
 * Identifies chronological ordering, career duration, current role, career gaps,
 * promotions/progressions, and concurrent overlapping periods as objective facts.
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
 * Resolves dynamic year and month (1-indexed) based on system clock or optional reference date.
 */
export function getCurrentDate(referenceDate = new Date()) {
  const d = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  }
}

/**
 * Parses raw date string into a comparable numeric epoch { year, month, raw, isPresent, isYearOnly }
 */
export function parseDateToken(token, referenceDate = new Date()) {
  if (!token || typeof token !== 'string') return null
  const clean = token.trim().toLowerCase()

  if (/^(?:present|current|now|ongoing)$/i.test(clean)) {
    const { year, month } = getCurrentDate(referenceDate)
    return { year, month, raw: token.trim(), isPresent: true }
  }

  // Format: "Month Year" (e.g. "March 2023", "June 2021", "Mar 2023", "Sept 2020")
  const monthYearMatch = clean.match(/^([a-z]+)\.?\s+(\d{4})$/)
  if (monthYearMatch) {
    const monthKey = monthYearMatch[1].slice(0, 3)
    const month = MONTH_NAMES[monthKey] || MONTH_NAMES[monthYearMatch[1]] || 1
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
    return { year: parseInt(yearOnlyMatch[1], 10), month: 1, raw: token.trim(), isPresent: false, isYearOnly: true }
  }

  return null
}

/**
 * Extracts start and end date from a range string (e.g. "March 2023 – Present", "June 2021 – February 2023", "2017 – 2021")
 */
export function parseDateRange(rangeStr, referenceDate = new Date()) {
  if (!rangeStr || typeof rangeStr !== 'string') return null
  const parts = rangeStr.split(/[–—\-–]|(?:\s+to\s+)/i).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const startParsed = parseDateToken(parts[0], referenceDate)
  let endParsed = parts.length > 1 ? parseDateToken(parts[1], referenceDate) : (startParsed?.isPresent ? startParsed : null)

  if (!startParsed) return null

  if (endParsed && endParsed.isYearOnly) {
    endParsed = { ...endParsed, month: 12 }
  }

  const startVal = startParsed.year * 12 + startParsed.month
  const endVal = (endParsed || startParsed).year * 12 + (endParsed || startParsed).month
  const durationMonths = Math.max(1, endVal - startVal + 1)

  return {
    rawRange: rangeStr.trim(),
    start: startParsed,
    end: endParsed || startParsed,
    startVal,
    endVal,
    durationMonths,
  }
}

/**
 * Checks if two date ranges overlap.
 */
function checkOverlap(rangeA, rangeB) {
  if (!rangeA || !rangeB || !rangeA.start || !rangeB.start) return false

  const aStartVal = rangeA.startVal ?? (rangeA.start.year * 12 + rangeA.start.month)
  const aEndVal = rangeA.endVal ?? ((rangeA.end?.year || rangeA.start.year) * 12 + (rangeA.end?.month || 12))

  const bStartVal = rangeB.startVal ?? (rangeB.start.year * 12 + rangeB.start.month)
  const bEndVal = rangeB.endVal ?? ((rangeB.end?.year || rangeB.start.year) * 12 + (rangeB.end?.month || 12))

  return aStartVal <= bEndVal && bStartVal <= aEndVal
}

/**
 * Main timeline analysis across canonical resume.
 *
 * @param {Object} canonicalResume
 * @param {Object} [options]
 * @param {Date|string} [options.referenceDate=new Date()] - Dynamic reference date for current employment calculations
 * @returns {{
 *   careerDuration: Object,
 *   currentRole: Object,
 *   careerGaps: Array,
 *   promotions: Array,
 *   overlaps: Array,
 *   items: Array,
 *   summary: Object
 * }}
 */
export function analyzeTimeline(canonicalResume, options = {}) {
  const referenceDate = options.referenceDate || new Date()
  const { year: currentYear, month: currentMonth } = getCurrentDate(referenceDate)

  const emptyResult = {
    careerDuration: { totalMonths: 0, totalYears: 0, formatted: '0 months' },
    currentRole: { isCurrentlyEmployed: false, role: null, company: null, dates: null, startDate: null, tenureMonths: 0 },
    careerGaps: [],
    promotions: [],
    overlaps: [],
    items: [],
    summary: { totalItemsWithDates: 0, overlapCount: 0, gapCount: 0, promotionCount: 0, totalExperienceYears: 0, isCurrentlyEmployed: false },
  }

  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return emptyResult
  }

  const timelineItems = []
  const experienceEntries = []

  // 1. Experience dates
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp) continue
      const itemId = exp.id || 'exp_unknown'
      const dateText = exp.dates || (exp.startDate && exp.endDate ? `${exp.startDate} - ${exp.endDate}` : '') || exp.startDate || exp.company || ''
      const range = parseDateRange(dateText, referenceDate)
      if (range) {
        const entry = {
          itemId,
          section: 'experience',
          title: exp.role || exp.company || itemId,
          role: exp.role || '',
          company: exp.company || '',
          range,
        }
        timelineItems.push(entry)
        experienceEntries.push(entry)
      }
    }
  }

  // 2. Education dates
  if (Array.isArray(canonicalResume.education)) {
    for (const edu of canonicalResume.education) {
      if (!edu) continue
      const itemId = edu.id || 'edu_unknown'
      const dateText = edu.dates || edu.year || edu.degree || ''
      const range = parseDateRange(dateText, referenceDate)
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

  // 3. Detect overlaps between items
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

  // 4. Compute Career Duration across Experience (merging overlapping periods)
  const sortedExp = [...experienceEntries].sort((a, b) => a.range.startVal - b.range.startVal)
  const mergedIntervals = []

  for (const exp of sortedExp) {
    const { startVal, endVal } = exp.range
    if (mergedIntervals.length === 0) {
      mergedIntervals.push({ startVal, endVal })
    } else {
      const prev = mergedIntervals[mergedIntervals.length - 1]
      if (startVal <= prev.endVal) {
        prev.endVal = Math.max(prev.endVal, endVal)
      } else {
        mergedIntervals.push({ startVal, endVal })
      }
    }
  }

  let totalExperienceMonths = 0
  for (const intv of mergedIntervals) {
    totalExperienceMonths += Math.max(1, intv.endVal - intv.startVal + 1)
  }
  const totalExperienceYears = Math.round((totalExperienceMonths / 12) * 10) / 10
  const yrs = Math.floor(totalExperienceMonths / 12)
  const mos = totalExperienceMonths % 12
  const formattedDuration = yrs > 0 ? (mos > 0 ? `${yrs} yrs ${mos} mos` : `${yrs} years`) : `${mos} months`

  // 5. Detect Current Role (isPresent or most recent within 3 months)
  let currentRole = {
    isCurrentlyEmployed: false,
    role: null,
    company: null,
    dates: null,
    startDate: null,
    tenureMonths: 0,
  }

  const activeExp = experienceEntries.find((e) => e.range.end?.isPresent) ||
    sortedExp.filter((e) => (currentYear * 12 + currentMonth) - e.range.endVal <= 3).pop()

  if (activeExp) {
    currentRole = {
      isCurrentlyEmployed: true,
      role: activeExp.role || activeExp.title,
      company: activeExp.company,
      dates: activeExp.range.rawRange,
      startDate: activeExp.range.start.raw,
      tenureMonths: Math.max(1, (currentYear * 12 + currentMonth) - activeExp.range.startVal + 1),
    }
  }

  // 6. Detect Career Gaps (> 6 months between consecutive professional jobs)
  const careerGaps = []
  for (let i = 0; i < sortedExp.length - 1; i++) {
    const prevJob = sortedExp[i]
    const nextJob = sortedExp[i + 1]

    if (nextJob.range.startVal > prevJob.range.endVal + 1) {
      const gapMonths = nextJob.range.startVal - prevJob.range.endVal - 1
      if (gapMonths > 6) {
        careerGaps.push({
          gapMonths,
          previousCompany: prevJob.company || prevJob.title,
          nextCompany: nextJob.company || nextJob.title,
          previousRole: prevJob.role || '',
          nextRole: nextJob.role || '',
          fromDate: prevJob.range.end.raw,
          toDate: nextJob.range.start.raw,
          isSignificant: true,
        })
      }
    }
  }

  // 7. Detect Promotions & Career Progressions (multiple roles at same company)
  const promotions = []
  const companyMap = new Map()

  for (const exp of sortedExp) {
    const rawComp = (exp.company || '').split('|')[0].trim().toLowerCase()
    if (!rawComp || rawComp.length < 3) continue
    if (!companyMap.has(rawComp)) {
      companyMap.set(rawComp, [])
    }
    companyMap.get(rawComp).push(exp)
  }

  for (const [compKey, roles] of companyMap.entries()) {
    if (roles.length >= 2) {
      promotions.push({
        company: roles[0].company || compKey,
        roleCount: roles.length,
        roles: roles.map((r) => r.role || r.title),
        progressionSummary: roles.map((r) => r.role || r.title).join(' → '),
      })
    }
  }

  return {
    careerDuration: {
      totalMonths: totalExperienceMonths,
      totalYears: totalExperienceYears,
      formatted: formattedDuration,
    },
    currentRole,
    careerGaps,
    promotions,
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
      gapCount: careerGaps.length,
      promotionCount: promotions.length,
      totalExperienceYears,
      isCurrentlyEmployed: currentRole.isCurrentlyEmployed,
    },
  }
}

export default analyzeTimeline
