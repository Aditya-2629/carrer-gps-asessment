import KBDocument from '../models/KBDocument.js'
import KnowledgeBase from '../models/KnowledgeBase.js'
import defaultKnowledgeBase from './knowledgeBase.js'
import { embedContentWithFallback } from './geminiClient.js'

// ─────────────────────────────────────────────────
// VECTOR EMBEDDING ENGINE
// ─────────────────────────────────────────────────

// Generate real embedding via Gemini text-embedding-004 with multi-key fallback
export const generateEmbedding = async (text) => {
  if (!text || !text.trim()) return null
  return await embedContentWithFallback(text)
}

// Batch embed multiple texts efficiently with rate limiting
export const batchGenerateEmbeddings = async (texts) => {
  const results = []
  for (let i = 0; i < texts.length; i++) {
    const emb = await generateEmbedding(texts[i])
    results.push(emb)
    // Small delay to avoid rate limiting on free tier
    if (i < texts.length - 1) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  return results
}

// ─────────────────────────────────────────────────
// COSINE SIMILARITY (both vectors MUST be same dimension)
// ─────────────────────────────────────────────────

export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0
  if (vecA.length !== vecB.length) return 0 // dimension mismatch = incomparable

  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ─────────────────────────────────────────────────
// SMART TEXT CHUNKING ENGINE (paragraph/sentence-aware, with overlap)
// ─────────────────────────────────────────────────

export const chunkText = (text, maxChunkSize = 500, overlapChars = 80) => {
  if (!text) return []
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

  // Split into paragraphs first
  const paragraphs = cleanText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const rawChunks = []
  let currentChunk = ''

  for (const para of paragraphs) {
    if (!para) continue

    // If adding this paragraph stays within limit, append
    if (currentChunk.length + para.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para
    } else {
      // Flush current chunk
      if (currentChunk) rawChunks.push(currentChunk)

      // If paragraph itself exceeds max, split by sentences
      if (para.length > maxChunkSize) {
        const sentences = para.match(/[^.!?\n]+[.!?]+[\s]*/g) || [para]
        let subChunk = ''
        for (const sent of sentences) {
          if (subChunk.length + sent.length <= maxChunkSize) {
            subChunk += sent
          } else {
            if (subChunk.trim()) rawChunks.push(subChunk.trim())
            subChunk = sent
          }
        }
        currentChunk = subChunk.trim()
      } else {
        currentChunk = para
      }
    }
  }
  if (currentChunk.trim()) rawChunks.push(currentChunk.trim())

  // Apply overlapping window for contextual continuity
  if (rawChunks.length <= 1) return rawChunks.filter((c) => c.length > 15)

  const overlappedChunks = [rawChunks[0]]
  for (let i = 1; i < rawChunks.length; i++) {
    const prevChunk = rawChunks[i - 1]
    const overlapPrefix = prevChunk.slice(-overlapChars).trim()
    overlappedChunks.push(overlapPrefix + '\n' + rawChunks[i])
  }

  return overlappedChunks.filter((c) => c.length > 15)
}

// ─────────────────────────────────────────────────
// KEYWORD / BM25-STYLE SCORING (fallback when embeddings unavailable)
// ─────────────────────────────────────────────────

const tokenize = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

const computeKeywordScore = (queryTokens, chunkText) => {
  const chunkTokens = new Set(tokenize(chunkText))
  if (chunkTokens.size === 0 || queryTokens.length === 0) return 0

  let hits = 0
  for (const qt of queryTokens) {
    if (chunkTokens.has(qt)) hits++
    // Also check partial stem matches (e.g. "visa" matches "visas")
    for (const ct of chunkTokens) {
      if (ct !== qt && (ct.startsWith(qt) || qt.startsWith(ct)) && Math.abs(ct.length - qt.length) <= 3) {
        hits += 0.5
        break
      }
    }
  }

  // Normalized Jaccard-style overlap + tf-boost
  return hits / Math.max(queryTokens.length, 1)
}

// ─────────────────────────────────────────────────
// RAG RETRIEVAL ENGINE — HYBRID (Vector + Keyword fusion)
// ─────────────────────────────────────────────────

export const queryRAGSystem = async (queryText, topK = 6) => {
  if (!queryText || !queryText.trim()) return []

  try {
    // 1. Fetch all active documents
    const activeDocs = await KBDocument.find({ isActive: true })
    if (!activeDocs || activeDocs.length === 0) return []

    // 2. Generate query embedding
    const queryEmbedding = await generateEmbedding(queryText)
    const queryTokens = tokenize(queryText)

    // 3. Score every chunk with hybrid ranking
    const scoredChunks = []

    for (const doc of activeDocs) {
      if (!doc.chunks || doc.chunks.length === 0) continue

      for (const chunk of doc.chunks) {
        let vectorScore = 0
        let keywordScore = computeKeywordScore(queryTokens, chunk.text)

        // Only compute vector similarity if both query and chunk have real embeddings
        if (queryEmbedding && chunk.embedding && chunk.embedding.length > 0 && queryEmbedding.length === chunk.embedding.length) {
          vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding)
        }

        // Hybrid score = weighted combination (vector dominant when available)
        const hybridScore = queryEmbedding
          ? vectorScore * 0.65 + keywordScore * 0.35
          : keywordScore

        scoredChunks.push({
          documentId: doc._id,
          documentTitle: doc.title,
          fileType: doc.fileType,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          score: Math.round(hybridScore * 100), // percentage 0-100
          vectorScore: Math.round(vectorScore * 100),
          keywordScore: Math.round(keywordScore * 100),
          rawScore: hybridScore,
        })
      }
    }

    // 4. Sort by hybrid score descending
    scoredChunks.sort((a, b) => b.rawScore - a.rawScore)

    // 5. Return top K, but only chunks with meaningful scores (> 5%)
    return scoredChunks.filter((c) => c.score > 5).slice(0, topK)
  } catch (err) {
    console.error('[RAG] Error during retrieval:', err)
    return []
  }
}

// ─────────────────────────────────────────────────
// FULL RAG CONTEXT BUILDER (used by report generation & chatbot)
// Combines: baseline KB + RAG document retrieval
// ─────────────────────────────────────────────────

export const buildRAGContext = async (queryText) => {
  // 1. Get baseline KB content
  let baselineKB = defaultKnowledgeBase
  try {
    const activeKb = await KnowledgeBase.findOne().sort({ updatedAt: -1 })
    if (activeKb?.content) {
      baselineKB = activeKb.content
    }
  } catch (_err) {
    // use default
  }

  // 2. Run RAG retrieval
  let ragSection = ''
  try {
    const retrievedChunks = await queryRAGSystem(queryText, 6)
    if (retrievedChunks && retrievedChunks.length > 0) {
      ragSection = `\n\n#### RETRIEVED KNOWLEDGE BASE DOCUMENTS (Auto-retrieved via RAG vector search):\n`
      for (const chunk of retrievedChunks) {
        ragSection += `[Source: ${chunk.documentTitle} | Match: ${chunk.score}%]\n${chunk.text}\n\n`
      }
    }
  } catch (_err) {
    // non-fatal
  }

  return baselineKB + ragSection
}

// Helper to build a smart RAG query from user data (not raw JSON dump)
export const buildSmartQuery = (answers, resumeJson) => {
  const parts = []

  // Extract key answers (target role, visa, experience level, industry, etc.)
  if (answers) {
    if (typeof answers === 'object') {
      for (const [key, val] of Object.entries(answers)) {
        if (typeof val === 'string' && val.length > 2 && val.length < 300) {
          parts.push(val)
        } else if (val && typeof val === 'object' && val.formatted && val.formatted !== 'N/A') {
          parts.push(`${key}: ${val.formatted}`)
        }
      }
    }
  }

  // Extract resume keywords
  if (resumeJson) {
    if (resumeJson.target_role) parts.push(resumeJson.target_role)
    if (resumeJson.top_skills) parts.push(resumeJson.top_skills.join(', '))
    if (resumeJson.missing_ats_keywords) parts.push(resumeJson.missing_ats_keywords.join(', '))
  }

  // Limit total query length to keep embeddings focused
  const joined = parts.join('. ').slice(0, 1200)
  return joined || 'career job search strategy US IT market'
}
