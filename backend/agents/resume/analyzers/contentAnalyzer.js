/**
 * Content Analyzer — V3
 *
 * Analyzes: bullet clarity, responsibility vs achievement ratio,
 * redundancy patterns, vague language, technology-heavy bullets,
 * and missing context.
 *
 * IMPORTANT:
 * - A missing number is NOT automatically a weakness.
 * - Technical outcomes count as valid impact.
 * - Produces observations only — NOT final issues.
 * - NO LLM calls.
 */

export const CONTENT_ANALYZER_VERSION = '1.0'

// Vague action verbs that carry little signal without context
const WEAK_VERBS = [
  'worked', 'helped', 'assisted', 'participated', 'involved',
  'responsible for', 'handled', 'managed', 'supported', 'contributed to',
]

// Strong ownership verbs that indicate clear responsibility
const STRONG_VERBS = [
  'built', 'designed', 'architected', 'implemented', 'developed', 'led', 'created',
  'deployed', 'migrated', 'reduced', 'improved', 'increased', 'automated', 'scaled',
  'optimized', 'eliminated', 'integrated', 'launched', 'delivered', 'established',
  'owned', 'drove', 'engineered', 'refactored', 'introduced',
]

// Passive constructions
const PASSIVE_PATTERNS = [
  /\b(?:was|were)\s+(?:responsible|tasked|asked|involved)\b/i,
  /\b(?:assisted in|participated in|helped with|contributed to)\b/i,
]

/**
 * Analyzes a single bullet for content quality signals.
 *
 * @param {string} text
 * @param {string} itemId
 * @param {string} bulletId
 * @returns {Array<Object>} observations
 */
function analyzeBullet(text, itemId, bulletId) {
  const observations = []
  if (!text || text.length < 10) return observations

  const lower = text.toLowerCase()

  // 1. Weak verb detection
  const weakVerbFound = WEAK_VERBS.find((v) => lower.startsWith(v) || lower.includes(` ${v} `))
  if (weakVerbFound) {
    observations.push({
      type: 'weak_verb',
      description: `Bullet starts with or prominently uses a weak action verb: "${weakVerbFound}". Stronger ownership verbs give recruiters clearer signal.`,
      itemId,
      bulletId,
      sourceText: text,
      weight: 'low',
    })
  }

  // 2. Passive construction
  const passiveFound = PASSIVE_PATTERNS.find((p) => p.test(text))
  if (passiveFound) {
    observations.push({
      type: 'passive_language',
      description: 'Bullet uses passive or indirect construction, which can obscure ownership and contribution.',
      itemId,
      bulletId,
      sourceText: text,
      weight: 'medium',
    })
  }

  // 3. Strong verb presence (positive)
  const strongVerbFound = STRONG_VERBS.find((v) => lower.startsWith(v))
  if (!strongVerbFound && !weakVerbFound) {
    // Bullet doesn't start with a standard action verb at all
    observations.push({
      type: 'no_action_verb',
      description: 'Bullet does not begin with a clear action verb, which can make it harder to parse quickly.',
      itemId,
      bulletId,
      sourceText: text,
      weight: 'low',
    })
  }

  // 4. Excessively long bullet (walls of text)
  if (text.length > 250) {
    observations.push({
      type: 'excessive_length',
      description: `Bullet is ${text.length} characters long. Bullets over 250 characters are harder to scan in a 10-second resume review.`,
      itemId,
      bulletId,
      sourceText: text.slice(0, 200) + '...',
      weight: 'low',
    })
  }

  return observations
}

/**
 * Main content analyzer.
 *
 * @param {Object} resumeFacts - Output from extractResumeFacts()
 * @param {Object} signals - Output from generateResumeSignals()
 * @param {Object} canonicalResume - Immutable canonical resume
 * @returns {{ version: string, observations: Array, evidence: Array }}
 */
export function analyzeContent(resumeFacts, signals, canonicalResume) {
  const observations = []
  const evidence = []

  if (!canonicalResume) {
    return { version: CONTENT_ANALYZER_VERSION, observations, evidence }
  }

  let obsCounter = 1
  const addObs = (obs) => {
    observations.push({ observationId: `cnt_${String(obsCounter++).padStart(3, '0')}`, ...obs })
    if (obs.itemId && obs.sourceText) {
      evidence.push({ itemId: obs.itemId, bulletId: obs.bulletId, sourceText: obs.sourceText })
    }
  }

  // 1. Analyze experience bullets
  const experienceItems = Array.isArray(canonicalResume.experience) ? canonicalResume.experience : []
  const achievementCount = (resumeFacts?.summary?.achievementCount ?? 0)
  const responsibilityCount = (resumeFacts?.summary?.responsibilityCount ?? 0)

  for (const exp of experienceItems) {
    if (!Array.isArray(exp.bullets)) continue
    for (const bullet of exp.bullets) {
      if (!bullet.text) continue
      const bulletObs = analyzeBullet(bullet.text, exp.id, bullet.id)
      for (const obs of bulletObs) addObs(obs)
    }
  }

  // 2. Analyze project bullets
  const projectItems = Array.isArray(canonicalResume.projects) ? canonicalResume.projects : []
  for (const proj of projectItems) {
    if (!Array.isArray(proj.bullets)) continue
    for (const bullet of proj.bullets) {
      if (!bullet.text) continue
      const bulletObs = analyzeBullet(bullet.text, proj.id, bullet.id)
      for (const obs of bulletObs) addObs(obs)
    }
  }

  // 3. Achievement-to-responsibility ratio observation
  const totalBullets = achievementCount + responsibilityCount
  if (totalBullets > 3 && responsibilityCount > achievementCount * 2) {
    addObs({
      type: 'high_responsibility_ratio',
      description: `${responsibilityCount} of ${totalBullets} bullets appear to describe responsibilities rather than outcomes. A higher achievement-to-responsibility ratio typically provides stronger recruiter signal.`,
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'medium',
    })
  }

  // 4. Duplicate content (from signals)
  const dups = signals?.duplicates?.duplicates || []
  for (const dup of dups.slice(0, 5)) {
    addObs({
      type: 'duplicate_content',
      description: `${Math.round(dup.similarity * 100)}% token similarity detected between "${dup.pair[0]}" and "${dup.pair[1]}".`,
      itemId: dup.pair[0],
      bulletId: dup.pair[0],
      sourceText: dup.textA || null,
      weight: 'low',
    })
  }

  return {
    version: CONTENT_ANALYZER_VERSION,
    observations,
    evidence,
  }
}

export default analyzeContent
