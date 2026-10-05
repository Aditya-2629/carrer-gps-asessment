/**
 * Parser Quality Signals
 * Detects possible parsing artifacts and anomalies without asserting definite document formatting errors.
 * Uses conditional terms: "possible", "suspected", "warning".
 */

import { PARSER_WARNING_TYPES } from './signalTypes.js'

export function detectParserQuality(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return { warnings: [] }
  }

  const warnings = []

  // 1. Check if contact details are merged into summary
  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) ||
    canonicalResume.candidate?.summary ||
    ''

  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
  const urlRegex = /(?:linkedin\.com|github\.com|http:\/\/|https:\/\/)/i

  if (summaryText) {
    const hasEmailInSummary = emailRegex.test(summaryText)
    const hasPhoneInSummary = phoneRegex.test(summaryText)
    const hasUrlInSummary = urlRegex.test(summaryText)

    if (hasEmailInSummary || hasPhoneInSummary || hasUrlInSummary) {
      warnings.push({
        type: PARSER_WARNING_TYPES.POSSIBLE_HEADER_SUMMARY_MERGE,
        severity: 'warning',
        itemId: 'summary_001',
        message: 'summary_001 may contain merged header or contact content (email, phone, or links detected in summary block).',
      })
    }

    // Suspiciously long summary without paragraph breaks (> 800 chars in single unbroken block)
    if (summaryText.length > 800 && !summaryText.includes('\n\n')) {
      warnings.push({
        type: PARSER_WARNING_TYPES.SUSPICIOUSLY_LONG_SUMMARY,
        severity: 'warning',
        itemId: 'summary_001',
        message: 'summary_001 is unusually long (>800 characters) in a single block; suspected missing paragraph boundary.',
      })
    }
  }

  // 2. Check for unusual character sequences / corrupted UTF-8 artifacts
  const rawText = JSON.stringify(canonicalResume)
  if (/[\uFFFD]|â€™|ï¿½|â€“|â€”/.test(rawText)) {
    warnings.push({
      type: PARSER_WARNING_TYPES.UNUSUAL_CHARACTER_SEQUENCES,
      severity: 'warning',
      itemId: 'document',
      message: 'Suspected character encoding artifacts or replacement characters detected in parsed text.',
    })
  }

  // 3. Check for broken bullet formatting (e.g. bullets starting with stray numbers or orphaned punctuation)
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp || !Array.isArray(exp.bullets)) continue
      for (const b of exp.bullets) {
        if (b && typeof b.text === 'string') {
          const t = b.text.trim()
          if (/^[,.:;]/.test(t) || t.length < 5) {
            warnings.push({
              type: PARSER_WARNING_TYPES.BROKEN_BULLET_FORMATTING,
              severity: 'warning',
              itemId: b.id || exp.id,
              message: `Possible fragmented bullet or orphaned leading punctuation detected in ${b.id || exp.id}.`,
            })
          }
        }
      }
    }
  }

  // 4. Missing major section boundaries when document has substantial content
  const totalBullets =
    (Array.isArray(canonicalResume.experience)
      ? canonicalResume.experience.reduce((acc, e) => acc + (Array.isArray(e?.bullets) ? e.bullets.length : 0), 0)
      : 0) +
    (Array.isArray(canonicalResume.projects)
      ? canonicalResume.projects.reduce((acc, p) => acc + (Array.isArray(p?.bullets) ? p.bullets.length : 0), 0)
      : 0)

  if (totalBullets === 0 && rawText.length > 500) {
    warnings.push({
      type: PARSER_WARNING_TYPES.MISSING_SECTION_BOUNDARIES,
      severity: 'warning',
      itemId: 'document',
      message: 'Possible missing section boundaries: substantial document text parsed but 0 experience/project bullets segmented.',
    })
  }

  return { warnings }
}

export default detectParserQuality
