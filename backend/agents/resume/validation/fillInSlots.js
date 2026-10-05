/**
 * Fill-In Metric Slots — V3.1 (Phase 1)
 *
 * A real resume writer's most valuable move is: "here's your bullet rewritten,
 * with a blank where the number goes — your job is to go find that number."
 * The pre-V3.1 pipeline banned all placeholder metrics outright, which forced
 * rewrites to stay structure-only and made the advice feel like proofreading.
 *
 * The compromise: the synthesis agent MAY use fill-in slots in correctedText
 * and recommendation text, in the strict form:
 *
 *     [ADD: short description of the metric to find]
 *
 * Hard rules (enforced here and in the prompt):
 * 1. Slots MUST use the exact `[ADD: ...]` bracket format.
 * 2. Slot content MUST NOT contain digits — a slot can never be mistaken for
 *    a real metric by candidates, validators, or downstream parsers.
 * 3. Slots are only allowed in correctedText, recommendation, and
 *    priorityActions[].action — never in diagnosis, whyItMatters, strengths,
 *    overallReview, or anywhere factual claims are made.
 * 4. Every slot implies homework: the prompt requires the recommendation to
 *    tell the candidate to find their real number.
 *
 * Validators strip slot content before numeric/tech/fabrication checks, so a
 * well-formed slot never trips fabrication detection, and a malformed slot
 * (digits inside, wrong bracket format) is reported as a violation.
 */

export const FILL_IN_SLOT_PATTERN = /\[ADD:\s*([^\]]*)\]/g

/**
 * Strips all well-formed fill-in slots from text, leaving normal prose.
 * Use before running numeric-token, tech-token, or fabrication checks.
 * @param {string} text
 * @returns {string}
 */
export function stripFillInSlots(text) {
  if (!text || typeof text !== 'string') return text || ''
  return text.replace(FILL_IN_SLOT_PATTERN, ' ')
}

/**
 * Finds malformed fill-in slots — bracket-like tokens that use ADD without
 * matching the strict format, or slots that contain digits.
 *
 * @param {string} text
 * @returns {string[]} descriptions of each malformed slot found
 */
export function findMalformedFillInSlots(text) {
  if (!text || typeof text !== 'string') return []
  const problems = []

  // Digits inside a well-formed slot
  FILL_IN_SLOT_PATTERN.lastIndex = 0
  let m
  while ((m = FILL_IN_SLOT_PATTERN.exec(text)) !== null) {
    if (/\d/.test(m[1])) {
      problems.push(`"[ADD: ${m[1]}]" — slot content must not contain digits`)
    }
  }

  // ADD-like tokens that don't match the strict format (e.g. "[add: x]",
  // "[ADD] x", "[ADD:x]") — catch variants the prompt forbids
  const loosePattern = /\[add\b[^\]]*\]/gi
  while ((m = loosePattern.exec(text)) !== null) {
    if (!FILL_IN_SLOT_PATTERN.test(m[0])) {
      problems.push(`"${m[0]}" — slots must use the exact format [ADD: description]`)
      FILL_IN_SLOT_PATTERN.lastIndex = 0
    }
  }

  FILL_IN_SLOT_PATTERN.lastIndex = 0
  return problems
}

/**
 * Counts well-formed fill-in slots in a text.
 * @param {string} text
 * @returns {number}
 */
export function countFillInSlots(text) {
  if (!text || typeof text !== 'string') return 0
  FILL_IN_SLOT_PATTERN.lastIndex = 0
  const count = (text.match(FILL_IN_SLOT_PATTERN) || []).length
  FILL_IN_SLOT_PATTERN.lastIndex = 0
  return count
}

export default { FILL_IN_SLOT_PATTERN, stripFillInSlots, findMalformedFillInSlots, countFillInSlots }
