import express from 'express'
import multer from 'multer'
import { saveAnswers, generateReport, generateReportStream, bookCall, chatResume, getReport, getTeaserConfig, downloadAtsResumeDocx, prefetchMarket } from '../controllers/assessmentController.js'
import { handleChatStream, handleChatMessage } from '../controllers/chatController.js'
import { userSessionGuard } from '../utils/userAuth.js'

const router = express.Router()

// Multer configuration: Store uploaded resume files in memory as Buffers
const storage = multer.memoryStorage()
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
      'application/x-zip-compressed',
      'text/plain',
    ]
    const ext = (file.originalname || '').toLowerCase()
    const isAllowedExt = ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc') || ext.endsWith('.txt')

    if (allowedMimeTypes.includes(file.mimetype) || isAllowedExt) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed.'), false)
    }
  },
})

// Public booking & teaser config endpoints
router.post('/book-call', bookCall)
router.get('/teaser-config', getTeaserConfig)
router.post('/prefetch-market', prefetchMarket)

// Protect all remaining assessment, report generation, and AI chat endpoints
router.use(userSessionGuard)

// Configure routes
router.post('/save-answers', upload.single('resume'), saveAnswers)
router.post('/generate-report', generateReport)
router.get('/generate-report-stream', generateReportStream)
router.get('/report', getReport)
router.get('/report/:userId', getReport)
router.get('/user/:userId/download-resume-docx', downloadAtsResumeDocx)
router.post('/user/:userId/download-resume-docx', downloadAtsResumeDocx)
router.get('/report/:userId/download-resume-docx', downloadAtsResumeDocx)
router.post('/report/:userId/download-resume-docx', downloadAtsResumeDocx)
router.get('/download-resume-docx', downloadAtsResumeDocx)
router.post('/download-resume-docx', downloadAtsResumeDocx)
router.post('/resume-talk', handleChatMessage)
router.post('/chat', handleChatMessage)
router.post('/chat-stream', handleChatStream)

export default router

