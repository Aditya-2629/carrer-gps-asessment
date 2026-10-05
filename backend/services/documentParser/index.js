/**
 * Unified Document Parser
 * Entry point for parsing PDF, DOCX, and plain-text resumes.
 */

import { PDFParser } from './pdfParser.js'
import { DOCXParser } from './docxParser.js'
import { TextNormalizer } from './textNormalizer.js'
import { DOCUMENT_TYPES, PARSER_WARNINGS } from './parserTypes.js'

export class DocumentParser {
  /**
   * Universal parser method
   *
   * @param {Object} options
   * @param {Buffer} [options.buffer] - Raw file buffer
   * @param {string} [options.mimeType] - MIME type (e.g. 'application/pdf')
   * @param {string} [options.filename] - Original filename
   * @param {string} [options.text] - Plain text if already supplied
   * @returns {Promise<{ type: string, rawText: string, pages: Array, pageCount: number, confidence: number, warnings: string[] }>}
   */
  static async parse({ buffer, mimeType = '', filename = '', text = '' }) {
    // 1. Direct text mode
    if (text && typeof text === 'string' && text.trim().length > 0) {
      const cleaned = TextNormalizer.cleanText(text)
      const evaluation = TextNormalizer.evaluateExtraction(cleaned, 1)
      return {
        type: DOCUMENT_TYPES.PLAIN_TEXT,
        rawText: cleaned,
        pages: [{ pageNumber: 1, text: cleaned }],
        pageCount: 1,
        confidence: evaluation.confidence,
        warnings: evaluation.warnings,
      }
    }

    if (!buffer || buffer.length === 0) {
      return {
        type: DOCUMENT_TYPES.PLAIN_TEXT,
        rawText: '',
        pages: [],
        pageCount: 0,
        confidence: 0,
        warnings: [PARSER_WARNINGS.SCANNED_OR_EMPTY_PDF],
      }
    }

    const lowerMime = (mimeType || '').toLowerCase()
    const lowerFilename = (filename || '').toLowerCase()

    // 2. PDF
    if (
      lowerMime.includes('pdf') ||
      lowerFilename.endsWith('.pdf')
    ) {
      const parsed = await PDFParser.parse(buffer)
      return {
        type: DOCUMENT_TYPES.PDF,
        rawText: parsed.text,
        pages: parsed.pages,
        pageCount: parsed.pageCount,
        confidence: parsed.confidence,
        warnings: parsed.warnings,
      }
    }

    // 3. DOCX / DOC
    if (
      lowerMime.includes('word') ||
      lowerMime.includes('officedocument') ||
      lowerFilename.endsWith('.docx') ||
      lowerFilename.endsWith('.doc')
    ) {
      const parsed = await DOCXParser.parse(buffer)
      return {
        type: DOCUMENT_TYPES.DOCX,
        rawText: parsed.text,
        pages: parsed.pages,
        pageCount: parsed.pageCount,
        confidence: parsed.confidence,
        warnings: parsed.warnings,
      }
    }

    // 4. Fallback: treat buffer as UTF-8 text
    const fallbackText = TextNormalizer.cleanText(buffer.toString('utf-8'))
    const evaluation = TextNormalizer.evaluateExtraction(fallbackText, 1)

    return {
      type: DOCUMENT_TYPES.PLAIN_TEXT,
      rawText: fallbackText,
      pages: [{ pageNumber: 1, text: fallbackText }],
      pageCount: 1,
      confidence: evaluation.confidence,
      warnings: [PARSER_WARNINGS.UNSUPPORTED_FORMAT, ...evaluation.warnings],
    }
  }
}

export { DOCUMENT_TYPES, PARSER_WARNINGS }
export default DocumentParser
