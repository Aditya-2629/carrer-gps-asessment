import express from 'express'
import multer from 'multer'
import {
  getKnowledgeBase,
  updateKnowledgeBase,
  resetKnowledgeBase,
  uploadRAGDocument,
  listRAGDocuments,
  getRAGDocumentDetail,
  toggleRAGDocument,
  deleteRAGDocument,
  testRAGQuery,
} from '../controllers/knowledgeBaseController.js'

const router = express.Router()

// Multer in-memory storage for PDF, DOCX, TXT, MD document uploads (Max 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

// Baseline KB endpoints
router.get('/', getKnowledgeBase)
router.post('/', updateKnowledgeBase)
router.put('/', updateKnowledgeBase)
router.post('/reset', resetKnowledgeBase)

// RAG Document Ingestion & Management endpoints
router.post('/upload', upload.single('document'), uploadRAGDocument)
router.get('/documents', listRAGDocuments)
router.get('/documents/:id', getRAGDocumentDetail)
router.patch('/documents/:id/toggle', toggleRAGDocument)
router.delete('/documents/:id', deleteRAGDocument)

// RAG Semantic Vector Retrieval Test endpoint
router.post('/rag-test', testRAGQuery)

export default router
