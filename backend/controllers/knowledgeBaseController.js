import KnowledgeBase from '../models/KnowledgeBase.js'
import KBDocument from '../models/KBDocument.js'
import defaultKnowledgeBase from '../utils/knowledgeBase.js'
import {
  chunkText,
  batchGenerateEmbeddings,
  queryRAGSystem,
} from '../utils/ragEngine.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Import text parsers dynamically with fallbacks
let pdfParse = null
let mammoth = null

try {
  pdfParse = (await import('pdf-parse')).default
} catch (e) {
  console.warn('pdf-parse module load notice, will use Gemini fallback for PDF parsing if needed.')
}

try {
  mammoth = (await import('mammoth')).default
} catch (e) {
  console.warn('mammoth module load notice, will use Gemini fallback for DOCX parsing if needed.')
}

// Extract raw text from uploaded Buffer based on mimetype / extension
const extractTextFromBuffer = async (buffer, mimeType, originalName) => {
  const ext = originalName.split('.').pop().toLowerCase()

  // 1. Text or Markdown files (.txt, .md)
  if (ext === 'txt' || ext === 'md' || mimeType.includes('text/')) {
    return buffer.toString('utf-8')
  }

  // 2. Word documents (.docx, .doc)
  if (ext === 'docx' || ext === 'doc' || mimeType.includes('word')) {
    if (mammoth) {
      try {
        const result = await mammoth.extractRawText({ buffer })
        if (result && result.value && result.value.trim()) {
          return result.value.trim()
        }
      } catch (err) {
        console.warn('Mammoth docx parsing error, trying Gemini fallback:', err.message)
      }
    }
  }

  // 3. PDF documents (.pdf)
  if (ext === 'pdf' || mimeType.includes('pdf')) {
    if (pdfParse) {
      try {
        const parsed = await pdfParse(buffer)
        if (parsed && parsed.text && parsed.text.trim()) {
          return parsed.text.trim()
        }
      } catch (err) {
        console.warn('pdf-parse error, trying Gemini fallback:', err.message)
      }
    }
  }

  // 4. Gemini AI Fallback for PDF/DOCX if libraries fail or missing
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })
      const filePart = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: mimeType || 'application/pdf',
        },
      }
      const prompt = 'Extract all readable text from this document verbatim. Return raw text only with line breaks, no markdown formatting or comments.'
      const res = await model.generateContent([prompt, filePart])
      const text = res.response.text().trim()
      if (text) return text
    }
  } catch (err) {
    console.error('Gemini fallback text extraction error:', err.message)
  }

  // Final fallback: standard string conversion
  return buffer.toString('utf-8')
}

// Helper to parse markdown text to section objects
export const parseMarkdownToSections = (markdownText) => {
  if (!markdownText) return []
  const lines = markdownText.split('\n')
  const sections = []
  let currentSection = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('#### ') || trimmed.startsWith('### ')) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        title: trimmed.replace(/^#+\s*/, ''),
        points: [],
      }
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const point = trimmed.replace(/^[-*]\s*/, '')
      if (currentSection) {
        currentSection.points.push(point)
      } else {
        if (sections.length === 0 || sections[sections.length - 1].title !== 'General') {
          sections.push({ title: 'General Facts', points: [] })
        }
        sections[sections.length - 1].points.push(point)
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection)
  }

  return sections
}

// GET /api/knowledge-base (Fetch active baseline Knowledge Base)
export const getKnowledgeBase = async (req, res) => {
  try {
    let kbDoc = await KnowledgeBase.findOne().sort({ updatedAt: -1 })

    if (!kbDoc) {
      const initialSections = parseMarkdownToSections(defaultKnowledgeBase)
      kbDoc = await KnowledgeBase.create({
        content: defaultKnowledgeBase,
        sections: initialSections,
        isDefault: true,
        lastUpdatedBy: 'System Default',
      })
    }

    return res.status(200).json({
      success: true,
      content: kbDoc.content,
      sections: kbDoc.sections && kbDoc.sections.length > 0 ? kbDoc.sections : parseMarkdownToSections(kbDoc.content),
      isDefault: kbDoc.isDefault,
      updatedAt: kbDoc.updatedAt,
      lastUpdatedBy: kbDoc.lastUpdatedBy,
    })
  } catch (error) {
    console.error('Error fetching Knowledge Base:', error)
    return res.status(200).json({
      success: true,
      content: defaultKnowledgeBase,
      sections: parseMarkdownToSections(defaultKnowledgeBase),
      isDefault: true,
      updatedAt: new Date(),
      lastUpdatedBy: 'System Fallback',
    })
  }
}

// POST /api/knowledge-base (Update baseline Knowledge Base)
export const updateKnowledgeBase = async (req, res) => {
  const { content, sections, updatedBy } = req.body

  if (!content && (!sections || sections.length === 0)) {
    return res.status(400).json({ message: 'Content or sections are required.' })
  }

  try {
    let finalContent = content
    let finalSections = sections

    if (!finalContent && finalSections && finalSections.length > 0) {
      finalContent = `### CAREER GPS EXTERNAL KNOWLEDGE BASE (STRICT FACTS)\nUse the following facts to base your analysis and recommendations. Do not contradict this data.\n\n`
      finalSections.forEach((sec) => {
        finalContent += `#### ${sec.title}\n`
        sec.points.forEach((pt) => {
          finalContent += `- ${pt}\n`
        })
        finalContent += `\n`
      })
    }

    if ((!finalSections || finalSections.length === 0) && finalContent) {
      finalSections = parseMarkdownToSections(finalContent)
    }

    let kbDoc = await KnowledgeBase.findOne().sort({ updatedAt: -1 })

    if (kbDoc) {
      kbDoc.content = finalContent
      kbDoc.sections = finalSections
      kbDoc.isDefault = false
      kbDoc.lastUpdatedBy = updatedBy || 'Admin'
      await kbDoc.save()
    } else {
      kbDoc = await KnowledgeBase.create({
        content: finalContent,
        sections: finalSections,
        isDefault: false,
        lastUpdatedBy: updatedBy || 'Admin',
      })
    }

    return res.status(200).json({
      message: 'Knowledge Base updated successfully.',
      content: kbDoc.content,
      sections: kbDoc.sections,
      isDefault: kbDoc.isDefault,
      updatedAt: kbDoc.updatedAt,
      lastUpdatedBy: kbDoc.lastUpdatedBy,
    })
  } catch (error) {
    console.error('Error updating Knowledge Base:', error)
    return res.status(500).json({ message: 'Failed to update Knowledge Base.' })
  }
}

// POST /api/knowledge-base/reset (Reset baseline Knowledge Base)
export const resetKnowledgeBase = async (req, res) => {
  try {
    await KnowledgeBase.deleteMany({})
    const defaultSections = parseMarkdownToSections(defaultKnowledgeBase)
    const kbDoc = await KnowledgeBase.create({
      content: defaultKnowledgeBase,
      sections: defaultSections,
      isDefault: true,
      lastUpdatedBy: 'System Reset',
    })

    return res.status(200).json({
      message: 'Knowledge Base reset to original default successfully.',
      content: kbDoc.content,
      sections: kbDoc.sections,
      isDefault: true,
      updatedAt: kbDoc.updatedAt,
    })
  } catch (error) {
    console.error('Error resetting Knowledge Base:', error)
    return res.status(500).json({ message: 'Failed to reset Knowledge Base.' })
  }
}

// ---------------------------------------------------------
// RAG DOCUMENT MANAGEMENT ENDPOINTS (PDF, DOCX, TXT, MD)
// ---------------------------------------------------------

// POST /api/knowledge-base/upload
export const uploadRAGDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No document file uploaded.' })
  }

  const { originalname, buffer, mimetype, size } = req.file
  const fileExt = originalname.split('.').pop().toLowerCase()
  
  const allowedExts = ['pdf', 'docx', 'doc', 'txt', 'md']
  if (!allowedExts.includes(fileExt)) {
    return res.status(400).json({ message: `Unsupported file format .${fileExt}. Allowed formats: PDF, DOCX, TXT, MD` })
  }

  try {
    // 1. Extract raw text from file buffer
    const extractedText = await extractTextFromBuffer(buffer, mimetype, originalname)

    if (!extractedText || extractedText.trim().length < 10) {
      return res.status(400).json({ message: 'Could not extract readable text from document.' })
    }

    // 2. Intelligent Chunking
    const textChunks = chunkText(extractedText)

    // 3. Batch compute embeddings for all chunks
    const embeddings = await batchGenerateEmbeddings(textChunks)
    const processedChunks = textChunks.map((chunkStr, i) => ({
      chunkIndex: i,
      text: chunkStr,
      embedding: embeddings[i] || [],
    }))

    const docTitle = originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')

    // 4. Save to KBDocument Collection
    const kbDoc = await KBDocument.create({
      title: docTitle,
      filename: originalname,
      fileType: fileExt === 'doc' ? 'docx' : fileExt,
      originalSize: size,
      rawText: extractedText,
      chunkCount: processedChunks.length,
      chunks: processedChunks,
      isActive: true,
      uploadedBy: 'Admin (RAG Upload)',
    })

    return res.status(200).json({
      message: `Document "${originalname}" processed and ingested into RAG vector engine successfully.`,
      document: {
        id: kbDoc._id,
        title: kbDoc.title,
        filename: kbDoc.filename,
        fileType: kbDoc.fileType,
        originalSize: kbDoc.originalSize,
        chunkCount: kbDoc.chunkCount,
        isActive: kbDoc.isActive,
        createdAt: kbDoc.createdAt,
      },
    })
  } catch (error) {
    console.error('Error uploading RAG Document:', error)
    return res.status(500).json({ message: error.message || 'Failed to process RAG document.' })
  }
}

// GET /api/knowledge-base/documents
export const listRAGDocuments = async (req, res) => {
  try {
    const docs = await KBDocument.find().sort({ createdAt: -1 }).select('-rawText')
    return res.status(200).json({ success: true, documents: docs })
  } catch (error) {
    console.error('Error listing RAG Documents:', error)
    return res.status(500).json({ message: 'Failed to list RAG documents.' })
  }
}

// GET /api/knowledge-base/documents/:id (View raw text)
export const getRAGDocumentDetail = async (req, res) => {
  try {
    const doc = await KBDocument.findById(req.params.id)
    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' })
    }
    return res.status(200).json({ success: true, document: doc })
  } catch (error) {
    console.error('Error fetching document detail:', error)
    return res.status(500).json({ message: 'Failed to fetch document.' })
  }
}

// PATCH /api/knowledge-base/documents/:id/toggle
export const toggleRAGDocument = async (req, res) => {
  try {
    const doc = await KBDocument.findById(req.params.id)
    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' })
    }
    doc.isActive = !doc.isActive
    await doc.save()

    return res.status(200).json({
      message: `Document "${doc.title}" ${doc.isActive ? 'enabled' : 'disabled'}.`,
      isActive: doc.isActive,
    })
  } catch (error) {
    console.error('Error toggling document:', error)
    return res.status(500).json({ message: 'Failed to toggle document.' })
  }
}

// DELETE /api/knowledge-base/documents/:id
export const deleteRAGDocument = async (req, res) => {
  try {
    const doc = await KBDocument.findByIdAndDelete(req.params.id)
    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' })
    }
    return res.status(200).json({ message: `Document "${doc.title}" deleted from RAG engine.` })
  } catch (error) {
    console.error('Error deleting document:', error)
    return res.status(500).json({ message: 'Failed to delete document.' })
  }
}

// POST /api/knowledge-base/rag-test (Interactive Query Search Test)
export const testRAGQuery = async (req, res) => {
  const { queryText, topK } = req.body

  if (!queryText || !queryText.trim()) {
    return res.status(400).json({ message: 'Query text is required.' })
  }

  const startTime = Date.now()
  try {
    const results = await queryRAGSystem(queryText, topK || 4)
    const durationMs = Date.now() - startTime

    return res.status(200).json({
      success: true,
      query: queryText,
      durationMs,
      resultCount: results.length,
      retrievedChunks: results,
    })
  } catch (error) {
    console.error('Error testing RAG query:', error)
    return res.status(500).json({ message: 'RAG query test failed.' })
  }
}
