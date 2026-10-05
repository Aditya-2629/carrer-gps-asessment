/**
 * Duplicate & Redundancy Detector
 * Deterministically compares resume bullet points and summary text to detect
 * high-similarity text pairs across experience and projects.
 */

// Common English stopwords to ignore in similarity calculation
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'the', 'this', 'then', 'into', 'over', 'across', 'using'
])

/**
 * Tokenizes text into a clean set of word tokens.
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/**
 * Computes Jaccard / Sorensen-Dice similarity between two text strings.
 */
export function computeTextSimilarity(textA, textB) {
  const tokensA = tokenize(textA)
  const tokensB = tokenize(textB)

  if (tokensA.length === 0 || tokensB.length === 0) return 0

  const setA = new Set(tokensA)
  const setB = new Set(tokensB)

  let intersectionCount = 0
  for (const t of setA) {
    if (setB.has(t)) {
      intersectionCount++
    }
  }

  // Sorensen-Dice coefficient: 2 * |A ∩ B| / (|A| + |B|)
  const similarity = (2 * intersectionCount) / (setA.size + setB.size)
  return Number(similarity.toFixed(2))
}

/**
 * Detects near-duplicate content across bullets in the canonical resume.
 *
 * @param {Object} canonicalResume
 * @param {Object} [options]
 * @param {number} [options.threshold=0.75]
 * @returns {{ duplicates: Array, count: number }}
 */
export function detectDuplicateContent(canonicalResume, options = {}) {
  const threshold = options.threshold || 0.75
  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return { duplicates: [], count: 0 }
  }

  const items = []

  // Collect experience bullets
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp || !Array.isArray(exp.bullets)) continue
      for (const b of exp.bullets) {
        if (b && b.text && b.text.trim().length > 20) {
          items.push({
            id: b.id || `${exp.id}_b`,
            section: 'experience',
            text: b.text.trim(),
          })
        }
      }
    }
  }

  // Collect project bullets
  if (Array.isArray(canonicalResume.projects)) {
    for (const proj of canonicalResume.projects) {
      if (!proj || !Array.isArray(proj.bullets)) continue
      for (const b of proj.bullets) {
        if (b && b.text && b.text.trim().length > 20) {
          items.push({
            id: b.id || `${proj.id}_b`,
            section: 'projects',
            text: b.text.trim(),
          })
        }
      }
    }
  }

  const duplicateSignals = []

  // Pairwise comparison
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const itemA = items[i]
      const itemB = items[j]

      const sim = computeTextSimilarity(itemA.text, itemB.text)
      if (sim >= threshold) {
        duplicateSignals.push({
          pair: [itemA.id, itemB.id],
          similarity: sim,
          type: 'high_similarity',
          snippetA: itemA.text.slice(0, 100),
          snippetB: itemB.text.slice(0, 100),
        })
      }
    }
  }

  return {
    duplicates: duplicateSignals,
    count: duplicateSignals.length,
  }
}

export default detectDuplicateContent
