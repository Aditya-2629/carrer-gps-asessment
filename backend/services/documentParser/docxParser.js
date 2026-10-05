/**
 * DOCX Document Parser
 * Uses mammoth to extract paragraphs, preserve headings, bullets, hyperlinks, and table content.
 */

import mammoth from 'mammoth'
import { TextNormalizer } from './textNormalizer.js'
import { PARSER_WARNINGS } from './parserTypes.js'

export class DOCXParser {
  /**
   * Parses DOCX file buffer
   * @param {Buffer} buffer
   * @returns {Promise<{ text: string, pages: Array<{ pageNumber: number, text: string }>, pageCount: number, confidence: number, warnings: string[] }>}
   */
  static async parse(buffer) {
    if (!buffer || buffer.length === 0) {
      return {
        text: '',
        pages: [],
        pageCount: 0,
        confidence: 0,
        warnings: [PARSER_WARNINGS.LOW_EXTRACTION_CONFIDENCE],
      }
    }

    try {
      // 1. Extract HTML representation to retain headings, lists, tables, and links
      const htmlResult = await mammoth.convertToHtml({ buffer })
      const rawHtml = htmlResult.value || ''

      // 2. Extract plain text as fallback/comparison
      const rawTextResult = await mammoth.extractRawText({ buffer })
      const rawText = rawTextResult.value || ''

      // 3. Convert HTML structure to structured markdown/text preserving headings & bullets
      const structuredText = this.htmlToStructuredText(rawHtml)
      const finalText = structuredText || TextNormalizer.cleanText(rawText)

      const warnings = []
      if (htmlResult.messages && htmlResult.messages.length > 0) {
        for (const msg of htmlResult.messages) {
          if (msg.type === 'warning') {
            warnings.push(msg.message)
          }
        }
      }

      const evaluation = TextNormalizer.evaluateExtraction(finalText, 1)

      return {
        text: finalText,
        pages: [
          {
            pageNumber: 1,
            text: finalText,
          },
        ],
        pageCount: 1, // DOCX does not have fixed physical pages without layout engine
        confidence: evaluation.confidence,
        warnings: [...warnings, ...evaluation.warnings],
      }
    } catch (err) {
      console.error('[DOCXParser] Parsing error:', err)
      return {
        text: '',
        pages: [],
        pageCount: 0,
        confidence: 0.1,
        warnings: [PARSER_WARNINGS.LOW_EXTRACTION_CONFIDENCE, err.message],
      }
    }
  }

  /**
   * Converts HTML fragments into structured markdown-like text
   */
  static htmlToStructuredText(html) {
    if (!html) return ''

    let text = html
      // Headings
      .replace(/<h[1-2][^>]*>(.*?)<\/h[1-2]>/gi, '\n\n## $1\n')
      .replace(/<h[3-6][^>]*>(.*?)<\/h[3-6]>/gi, '\n\n### $1\n')
      // List items & bullets
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n• $1')
      .replace(/<\/ul>|<\/ol>/gi, '\n')
      // Hyperlinks
      .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
      // Tables: rows and cells
      .replace(/<tr[^>]*>(.*?)<\/tr>/gi, '\n$1')
      .replace(/<td[^>]*>(.*?)<\/td>/gi, ' | $1')
      .replace(/<th[^>]*>(.*?)<\/th>/gi, ' | $1')
      // Paragraphs & line breaks
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Strip any remaining HTML tags
      .replace(/<[^>]+>/g, '')

    return TextNormalizer.cleanText(text)
  }
}

export default DOCXParser
