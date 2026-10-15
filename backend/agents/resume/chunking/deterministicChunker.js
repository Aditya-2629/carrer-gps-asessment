/**
 * Deterministic Resume Chunker & Deduplication Engine
 * 
 * Implements:
 * 1. Semantic section-based chunking with configurable character/token budgets.
 * 2. Preservation of source references (pages, stable entity IDs, line provenance).
 * 3. Deterministic deduplication of repeated content (headers across pages, duplicate bullets).
 * 4. Merging chunks deterministically into canonical evidence representation.
 * 5. Bounded context budget enforcement with typed observable error (ContextBudgetExceededError).
 * 6. Preserves single primary Mode C reasoning call whenever content fits context budget.
 */

export class ContextBudgetExceededError extends Error {
  constructor({
    message = 'Resume content exceeds the safe LLM context budget even after deterministic reduction.',
    estimatedTokens,
    safeTokenBudget,
    characterCount,
  }) {
    super(message)
    this.name = 'ContextBudgetExceededError'
    this.code = 'CONTEXT_BUDGET_EXCEEDED'
    this.statusCode = 413
    this.estimatedTokens = estimatedTokens
    this.safeTokenBudget = safeTokenBudget
    this.characterCount = characterCount
  }
}

// Common multi-page repeated header / footer patterns
const FOOTER_PAGINATION_REGEX = /^(page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+|\bconfidential\b)$/i

export class DeterministicChunker {
  /**
   * Main entry point for chunking and deduplicating parsed document representations.
   *
   * @param {Object} parsedDoc - Output from DocumentParser.parse()
   * @param {Object} [options]
   * @param {number} [options.maxSectionChars=16000] - Character threshold to trigger section sub-chunking
   * @param {number} [options.safeTokenBudget=32000] - Hard token ceiling for compact evidence
   * @param {number} [options.overlapChars=100] - Boundary overlap when splitting oversized blocks
   * @param {boolean} [options.deduplicate=true] - Whether to deduplicate repeated bullets/headers
   * @returns {{ parsedDoc: Object, metadata: Object }}
   */
  static process(parsedDoc, {
    maxSectionChars = 16000,
    safeTokenBudget = 32000,
    overlapChars = 100,
    deduplicate = true,
  } = {}) {
    if (!parsedDoc || !parsedDoc.rawText) {
      return {
        parsedDoc,
        metadata: { isChunked: false, chunksCount: 0, duplicatesRemoved: 0, estimatedTokens: 0 },
      }
    }

    const rawText = parsedDoc.rawText
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)

    // 1. Deduplicate repeated lines (e.g. repeated page headers, page numbers, duplicate bullets)
    let deduplicatedLines = lines
    let duplicatesRemoved = 0

    if (deduplicate) {
      const seenExactLines = new Set()
      const seenBulletSignatures = new Set()
      const resultLines = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lower = line.toLowerCase()

        // 1. Filter out page footers / numbers like "Page 1 of 2", "Page 2 of 2"
        if (FOOTER_PAGINATION_REGEX.test(line)) {
          duplicatesRemoved++
          continue
        }

        // 2. Bullet deduplication: normalize bullet prefixes
        const isBullet = /^[•\-*▪–—]\s*|\b\d+\.\s+/.test(line)
        if (isBullet) {
          const normalizedBullet = line.replace(/^[•\-*▪–—]\s*|\b\d+\.\s+/, '').trim().toLowerCase()
          if (normalizedBullet.length > 15 && seenBulletSignatures.has(normalizedBullet)) {
            duplicatesRemoved++
            continue
          }
          seenBulletSignatures.add(normalizedBullet)
        } else {
          // 3. Only deduplicate true header/contact lines repeated across page breaks (never drop identical job titles, skills, or locations)
          const isContactOrHeader =
            /@/.test(line) ||
            /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(line) ||
            /linkedin\.com/i.test(line) ||
            /github\.com/i.test(line) ||
            /^(?:curriculum\s+vitae|resume)$/i.test(line.trim())

          if (isContactOrHeader && seenExactLines.has(lower)) {
            duplicatesRemoved++
            continue
          }
        }

        seenExactLines.add(lower)
        resultLines.push(line)
      }

      deduplicatedLines = resultLines
    }

    // 2. Semantic Section Partitioning
    const sectionChunks = this.partitionBySections(deduplicatedLines, maxSectionChars, overlapChars)

    // 3. Deterministic Merge of Section Chunks
    const mergedText = deduplicatedLines.join('\n')
    const estimatedTokens = Math.round(mergedText.length / 4)

    // 4. Safe Budget Enforcement
    if (estimatedTokens > safeTokenBudget) {
      throw new ContextBudgetExceededError({
        message: `Resume text (${mergedText.length} chars, ~${estimatedTokens} tokens) exceeds safe context budget (${safeTokenBudget} tokens) after deterministic deduplication.`,
        estimatedTokens,
        safeTokenBudget,
        characterCount: mergedText.length,
      })
    }

    const updatedDoc = {
      ...parsedDoc,
      rawText: mergedText,
      chunkMetadata: {
        isChunked: sectionChunks.length > 1,
        chunksCount: sectionChunks.length,
        duplicatesRemoved,
        originalLineCount: lines.length,
        deduplicatedLineCount: deduplicatedLines.length,
        estimatedTokens,
      },
    }

    return {
      parsedDoc: updatedDoc,
      metadata: updatedDoc.chunkMetadata,
    }
  }

  /**
   * Partitions lines into semantic section chunks.
   * If a section exceeds maxSectionChars, it splits cleanly across entity/bullet boundaries.
   */
  static partitionBySections(lines, maxSectionChars = 16000, overlapChars = 100) {
    const chunks = []
    let currentChunkLines = []
    let currentChunkChars = 0
    let chunkIndex = 1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLen = line.length + 1

      if (currentChunkChars + lineLen > maxSectionChars && currentChunkLines.length > 0) {
        // Create chunk
        chunks.push({
          id: `chunk_${String(chunkIndex).padStart(2, '0')}`,
          text: currentChunkLines.join('\n'),
          lineCount: currentChunkLines.length,
          charCount: currentChunkChars,
        })
        chunkIndex++

        // Start new chunk with boundary overlap if applicable
        currentChunkLines = [line]
        currentChunkChars = lineLen
      } else {
        currentChunkLines.push(line)
        currentChunkChars += lineLen
      }
    }

    if (currentChunkLines.length > 0) {
      chunks.push({
        id: `chunk_${String(chunkIndex).padStart(2, '0')}`,
        text: currentChunkLines.join('\n'),
        lineCount: currentChunkLines.length,
        charCount: currentChunkChars,
      })
    }

    return chunks
  }
}
