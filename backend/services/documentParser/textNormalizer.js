/**
 * Text Normalizer & Heuristic Detector
 * Cleans extracted text and computes quality/layout indicators.
 */

import { PARSER_WARNINGS } from './parserTypes.js'

export class TextNormalizer {
  /**
   * Cleans text: standardizes linebreaks, normalizes unicode punctuation, removes null bytes
   */
  static cleanText(text) {
    if (!text || typeof text !== 'string') return ''

    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u0000/g, '') // strip null bytes
      .replace(/[\u2018\u2019]/g, "'") // smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // smart double quotes
      .replace(/[\u2013\u2014]/g, '-') // en-dash, em-dash
      .replace(/\u00A0/g, ' ') // non-breaking spaces
      .replace(/[ \t]+/g, ' ') // collapse multiple spaces within a line
      .replace(/\n{3,}/g, '\n\n') // collapse excessive blank lines
      .trim()
  }

  /**
   * Detects multi-column layout patterns in plain text.
   * Multi-column documents typically present large gap spaces within lines
   * or abrupt short alternating line fragments.
   */
  static detectMultiColumn(rawText) {
    if (!rawText) return false
    const lines = rawText.split('\n')
    let multiColumnGaps = 0

    for (const line of lines) {
      // Look for lines having 4+ spaces between non-space words (column gutter)
      if (/[^\s]{3,}\s{4,}[^\s]{3,}/.test(line)) {
        multiColumnGaps++
      }
    }

    // If more than 5% of lines exhibit column gutters, flag likely multi-column
    return multiColumnGaps >= 3 && multiColumnGaps / Math.max(1, lines.length) > 0.04
  }

  /**
   * Computes extraction confidence score (0.0 to 1.0) and warns if scanned.
   */
  static evaluateExtraction(text, pageCount = 1) {
    const warnings = []
    const cleaned = this.cleanText(text)
    const charCount = cleaned.length
    const wordCount = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0

    // Scanned / Image PDF check: less than 50 characters for a whole page
    if (charCount < 50 * Math.max(1, pageCount) || wordCount < 10) {
      warnings.push(PARSER_WARNINGS.SCANNED_OR_EMPTY_PDF)
      return {
        confidence: 0.1,
        warnings,
        wordCount,
        charCount,
      }
    }

    if (this.detectMultiColumn(text)) {
      warnings.push(PARSER_WARNINGS.MULTI_COLUMN_LAYOUT_DETECTED)
    }

    // Check ratio of readable ASCII/common characters
    const readableChars = (cleaned.match(/[a-zA-Z0-9\s.,!?:;@#$%&*()_+=\-[\]{}/\\<>'"~`]/g) || []).length
    const readableRatio = charCount > 0 ? readableChars / charCount : 0

    let confidence = 0.95
    if (readableRatio < 0.85) {
      confidence -= 0.25
      warnings.push(PARSER_WARNINGS.NON_STANDARD_ENCODING)
    }
    if (wordCount < 100) {
      confidence -= 0.2
      warnings.push(PARSER_WARNINGS.LOW_EXTRACTION_CONFIDENCE)
    }

    return {
      confidence: Math.max(0.1, Math.min(1.0, Number(confidence.toFixed(2)))),
      warnings,
      wordCount,
      charCount,
    }
  }
}

export default TextNormalizer
