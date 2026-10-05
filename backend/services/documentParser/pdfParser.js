/**
 * PDF Document Parser
 * Extracts text from PDF buffers while preserving page boundaries and detecting layout anomalies.
 */

import { PDFParse } from 'pdf-parse'
import { TextNormalizer } from './textNormalizer.js'
import { PARSER_WARNINGS } from './parserTypes.js'

export class PDFParser {
  /**
   * Parses PDF file buffer
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
        warnings: [PARSER_WARNINGS.SCANNED_OR_EMPTY_PDF],
      }
    }

    try {
      const parser = new PDFParse({ data: buffer })
      const docInfo = await parser.getInfo().catch(() => null)
      const pageCount = docInfo?.pages || 1

      const pages = []
      let aggregatedText = ''

      // Attempt per-page extraction
      for (let p = 1; p <= pageCount; p++) {
        try {
          const pageRes = await parser.getPageText(p)
          const rawPageText = typeof pageRes === 'string' ? pageRes : pageRes?.text || ''
          const cleanedPageText = TextNormalizer.cleanText(rawPageText)

          pages.push({
            pageNumber: p,
            text: cleanedPageText,
          })

          aggregatedText += `\n--- Page ${p} ---\n${cleanedPageText}\n`
        } catch (_pageErr) {
          // If per-page text extraction fails, fallback to full document text
        }
      }

      // If per-page loop didn't yield text, call full getText()
      if (!aggregatedText.trim()) {
        const fullTextRes = await parser.getText()
        const rawFullText = typeof fullTextRes === 'string' ? fullTextRes : fullTextRes?.text || ''
        aggregatedText = TextNormalizer.cleanText(rawFullText)
        pages.push({
          pageNumber: 1,
          text: aggregatedText,
        })
      }

      // Evaluate quality and warnings
      const evaluation = TextNormalizer.evaluateExtraction(aggregatedText, pageCount)

      return {
        text: aggregatedText.trim(),
        pages,
        pageCount,
        confidence: evaluation.confidence,
        warnings: evaluation.warnings,
      }
    } catch (err) {
      console.error('[PDFParser] Parsing error:', err)
      return {
        text: '',
        pages: [],
        pageCount: 0,
        confidence: 0.1,
        warnings: [PARSER_WARNINGS.LOW_EXTRACTION_CONFIDENCE, err.message],
      }
    }
  }
}

export default PDFParser
