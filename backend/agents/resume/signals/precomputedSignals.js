/**
 * Pre-computed Deterministic Signals — V2.5 Phase 1
 *
 * Computes deterministic signals directly before the LLM synthesis call:
 * 1. Per-bullet signals (wordCount, quantifiers, technology mentions from declared skills, outcome verbs, tool dump candidates)
 * 2. Document-level contact merge signal for summary_001
 * 3. Resume-level quantification rollup (totalBullets, quantifiedBullets, density)
 *
 * Injects structured facts into the prompt to fix issue-selection drift
 * without adding non-deterministic LLM hops.
 */

import {
  QUANTIFIER_PATTERNS,
  OUTCOME_VERBS_REGEX,
  CONTACT_PATTERNS,
} from './patterns.js'

/**
 * Escapes regex special characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extracts a normalized dictionary of candidate-declared skills from skills_001 text
 * or canonical resume skills array.
 *
 * @param {string|Array<Object>} skillsInput - skills_001 text or canonical.skills
 * @returns {string[]} Array of unique declared skill names/phrases
 */
export function extractDeclaredSkillDictionary(skillsInput) {
  if (!skillsInput) return []

  const rawSkills = new Set()

  if (Array.isArray(skillsInput)) {
    // Array of skill objects: { id, name, category }
    for (const item of skillsInput) {
      if (!item) continue
      const name = typeof item === 'string' ? item : item.name || item.text || ''
      if (name) {
        // May contain category prefixes like "Languages: Python"
        const clean = name.includes(':') ? name.split(':')[1] : name
        clean.split(/[,;|]/).forEach((s) => {
          const trimmed = s.trim().replace(/^[-•*]\s*/, '')
          if (trimmed) rawSkills.add(trimmed)
        })
      }
    }
  } else if (typeof skillsInput === 'string') {
    // Plain text block of skills (e.g. from skills_001)
    const lines = skillsInput.split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      // If line has category prefix like "Backend & Cloud: Node.js, FastAPI..."
      const content = line.includes(':') ? line.split(':').slice(1).join(':') : line
      // Split by commas, semicolons, pipe
      const tokens = content.split(/[,;|]/)
      for (let token of tokens) {
        token = token.trim().replace(/^[-•*]\s*/, '')
        if (!token) continue
        // Extract parenthetical items: e.g. "Vector DBs (Pinecone, ChromaDB)" -> "Vector DBs", "Pinecone", "ChromaDB"
        const parenMatch = token.match(/^(.*?)\((.*?)\)$/)
        if (parenMatch) {
          const mainPart = parenMatch[1].trim()
          if (mainPart) rawSkills.add(mainPart)
          parenMatch[2].split(',').forEach((sub) => {
            const subTrimmed = sub.trim()
            if (subTrimmed) rawSkills.add(subTrimmed)
          })
        } else {
          rawSkills.add(token)
        }
      }
    }
  }

  // Filter out noise tokens and sort by length descending to match longest phrases first
  return Array.from(rawSkills)
    .filter((s) => s.length >= 2 && !/^(and|or|etc|with|in|for)$/i.test(s))
    .sort((a, b) => b.length - a.length)
}

/**
 * Computes deterministic signals for a single bullet.
 *
 * @param {string} bulletId - Unique bullet ID (e.g. 'exp_001_b01', 'proj_002_b01')
 * @param {string} text - Verbatim bullet text
 * @param {string[]} skillDictionary - Declared skills list
 * @returns {Object} BulletSignals
 */
export function computeBulletSignals(bulletId, text = '', skillDictionary = []) {
  const cleanText = (text || '').trim()
  const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0

  // 1. Quantifiers
  const quantifierMatches = []
  for (const pattern of QUANTIFIER_PATTERNS) {
    // Clone regex with sticky/global index reset
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(cleanText)) !== null) {
      quantifierMatches.push(match[0].trim())
    }
  }
  const uniqueQuantifierMatches = Array.from(new Set(quantifierMatches))
  const hasQuantifier = uniqueQuantifierMatches.length > 0

  // 2. Technology Mentions from Declared Skills Dictionary
  const technologyMentions = []
  for (const skill of skillDictionary) {
    if (!skill) continue
    // Match skill as complete word or phrase
    const escaped = escapeRegex(skill)
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+.-])${escaped}(?:$|[^a-zA-Z0-9_#+.-])`, 'i')
    if (regex.test(cleanText)) {
      technologyMentions.push(skill)
    }
  }
  const uniqueTechnologies = Array.from(new Set(technologyMentions))
  const technologyCount = uniqueTechnologies.length

  // 3. Outcome Verbs
  const hasOutcomeVerb = OUTCOME_VERBS_REGEX.test(cleanText)

  // 4. Tool Dump Candidate: technologyCount >= 3 AND hasOutcomeVerb === false AND hasQuantifier === false
  const isToolDumpCandidate =
    technologyCount >= 3 && hasOutcomeVerb === false && hasQuantifier === false

  return {
    bulletId,
    wordCount,
    hasQuantifier,
    quantifierMatches: uniqueQuantifierMatches,
    technologyMentions: uniqueTechnologies,
    technologyCount,
    hasOutcomeVerb,
    isToolDumpCandidate,
  }
}

/**
 * Computes contact-merge signal for summary_001.
 *
 * @param {string} summaryText - Text of summary_001
 * @returns {Object} ContactMergeSignal
 */
export function computeContactMergeSignal(summaryText = '') {
  const text = summaryText || ''
  const emailDetected = CONTACT_PATTERNS.email.test(text)
  const phoneDetected = CONTACT_PATTERNS.phone.test(text)

  // Strip email from text before testing URL to ensure email domain is not double-counted as URL
  const textWithoutEmail = emailDetected
    ? text.replace(new RegExp(CONTACT_PATTERNS.email.source, 'gi'), '')
    : text
  const urlDetected = CONTACT_PATTERNS.url.test(textWithoutEmail)

  const detectedCount =
    (emailDetected ? 1 : 0) + (phoneDetected ? 1 : 0) + (urlDetected ? 1 : 0)
  const isContactMerged = detectedCount >= 2

  return {
    section: 'summary',
    itemId: 'summary_001',
    bulletId: 'summary_001',
    emailDetected,
    phoneDetected,
    urlDetected,
    isContactMerged,
  }
}

/**
 * Computes resume-level quantification rollup.
 * Excludes summary and skills, counts experience + projects.
 *
 * @param {Array<Object>} bulletSignals - Array of BulletSignals for experience and project bullets
 * @returns {Object} QuantificationRollup
 */
export function computeQuantificationRollup(bulletSignals = []) {
  const totalBullets = bulletSignals.length
  const quantifiedBullets = bulletSignals.filter((b) => b.hasQuantifier).length
  const density = totalBullets > 0 ? Number((quantifiedBullets / totalBullets).toFixed(2)) : 0.0

  return {
    totalBullets,
    quantifiedBullets,
    density,
  }
}

/**
 * Computes the complete pre-computed signal package from a canonical resume
 * or parsed resume object.
 *
 * @param {Object} resumeInput - Canonical resume object or parsed JSON with bullets
 * @returns {{ bulletSignals: Object<string, Object>, bulletSignalsList: Object[], contactMerge: Object, quantification: Object }}
 */
export function computePrecomputedSignals(resumeInput) {
  if (!resumeInput || typeof resumeInput !== 'object') {
    return {
      bulletSignals: {},
      bulletSignalsList: [],
      contactMerge: computeContactMergeSignal(''),
      quantification: computeQuantificationRollup([]),
    }
  }

  // 1. Extract Summary Text
  let summaryText = ''
  if (typeof resumeInput.summary_001 === 'string') {
    summaryText = resumeInput.summary_001
  } else if (resumeInput.summary) {
    summaryText = typeof resumeInput.summary === 'string' ? resumeInput.summary : resumeInput.summary.text || ''
  }

  // 2. Extract Declared Skills
  let skillsInput = null
  if (typeof resumeInput.skills_001 === 'string') {
    skillsInput = resumeInput.skills_001
  } else if (resumeInput.skills) {
    skillsInput = resumeInput.skills
  }
  const skillDictionary = extractDeclaredSkillDictionary(skillsInput)

  // 3. Extract Experience and Project Bullets
  const bulletEntries = [] // Array of { bulletId, text }

  // Case A: Canonical resume shape with experience[] and projects[]
  if (Array.isArray(resumeInput.experience)) {
    for (const exp of resumeInput.experience) {
      if (!exp || !Array.isArray(exp.bullets)) continue
      for (const b of exp.bullets) {
        if (!b || !b.text) continue
        const bulletId = b.id || `${exp.id}_b01`
        bulletEntries.push({ bulletId, text: b.text })
      }
    }
  }

  if (Array.isArray(resumeInput.projects)) {
    for (const proj of resumeInput.projects) {
      if (!proj || !Array.isArray(proj.bullets)) continue
      for (const b of proj.bullets) {
        if (!b || !b.text) continue
        const bulletId = b.id || `${proj.id}_b01`
        bulletEntries.push({ bulletId, text: b.text })
      }
    }
  }

  // Case B: Flattened object with bulletId keys (e.g., { exp_001_b01: '...', proj_002_b01: '...' })
  if (bulletEntries.length === 0) {
    for (const [key, val] of Object.entries(resumeInput)) {
      if ((key.startsWith('exp_') || key.startsWith('proj_')) && typeof val === 'string') {
        bulletEntries.push({ bulletId: key, text: val })
      }
    }
  }

  // 4. Compute Bullet Signals
  const bulletSignalsList = []
  const bulletSignalsMap = {}

  for (const entry of bulletEntries) {
    const sig = computeBulletSignals(entry.bulletId, entry.text, skillDictionary)
    bulletSignalsList.push(sig)
    bulletSignalsMap[entry.bulletId] = sig
  }

  // 5. Compute Rollup and Contact Merge
  const contactMerge = computeContactMergeSignal(summaryText)
  const quantification = computeQuantificationRollup(bulletSignalsList)

  return {
    bulletSignals: bulletSignalsMap,
    bulletSignalsList,
    contactMerge,
    quantification,
    skillDictionary,
  }
}

/**
 * Formats pre-computed signals into the exact prompt block specified in V2.5 Phase 1.
 *
 * @param {Object} signalsPackage - Output from computePrecomputedSignals()
 * @returns {string} Text block ready for LLM prompt injection
 */
export function formatPrecomputedSignalsForPrompt(signalsPackage) {
  if (!signalsPackage) return ''

  const { bulletSignalsList = [], contactMerge, quantification } = signalsPackage

  const lines = [
    'PRECOMPUTED SIGNALS (deterministic, do not recompute — treat as ground truth',
    'for these specific facts; you still decide whether each signal is worth',
    'surfacing as an issue and how to phrase it):\n',
  ]

  // 1. Quantification Rollup
  if (quantification) {
    lines.push(
      `quantification: { totalBullets: ${quantification.totalBullets}, quantifiedBullets: ${quantification.quantifiedBullets}, density: ${quantification.density.toFixed(2)} }\n`
    )
  }

  // 2. Bullet Signals
  lines.push('bulletSignals:')
  for (const b of bulletSignalsList) {
    if (b.isToolDumpCandidate) {
      lines.push(
        `- ${b.bulletId}: hasQuantifier=false, technologyCount=${b.technologyCount}, hasOutcomeVerb=false, isToolDumpCandidate=true`
      )
    } else {
      lines.push(
        `- ${b.bulletId}: hasQuantifier=${b.hasQuantifier}, technologyCount=${b.technologyCount}, isToolDumpCandidate=false`
      )
    }
  }
  lines.push('')

  // 3. Contact Merge
  if (contactMerge) {
    lines.push(
      `contactMerge: { emailDetected=${contactMerge.emailDetected}, phoneDetected=${contactMerge.phoneDetected}, urlDetected=${contactMerge.urlDetected}, isContactMerged=${contactMerge.isContactMerged} }`
    )
  }

  return lines.join('\n')
}

export default {
  extractDeclaredSkillDictionary,
  computeBulletSignals,
  computeContactMergeSignal,
  computeQuantificationRollup,
  computePrecomputedSignals,
  formatPrecomputedSignalsForPrompt,
}
