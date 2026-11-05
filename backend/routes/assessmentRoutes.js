import express from 'express'
import multer from 'multer'
import { saveAnswers, generateReport, generateReportStream, bookCall, chatResume, getReport, downloadReportPdf, downloadAtsResumeDocx } from '../controllers/assessmentController.js'
import { handleChatStream, handleChatMessage } from '../controllers/chatController.js'

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

// Configure routes
router.post('/save-answers', upload.single('resume'), saveAnswers)
router.post('/generate-report', generateReport)
router.get('/generate-report-stream', generateReportStream)
router.get('/report', getReport)
router.get('/report/:userId', getReport)
router.get('/report-pdf', downloadReportPdf)
router.get('/user/:userId/download-resume-docx', downloadAtsResumeDocx)
router.post('/user/:userId/download-resume-docx', downloadAtsResumeDocx)
router.get('/report/:userId/download-resume-docx', downloadAtsResumeDocx)
router.post('/report/:userId/download-resume-docx', downloadAtsResumeDocx)
router.get('/download-resume-docx', downloadAtsResumeDocx)
router.post('/download-resume-docx', downloadAtsResumeDocx)
router.post('/resume-talk', handleChatMessage)
router.post('/chat', handleChatMessage)
router.post('/chat-stream', handleChatStream)
router.post('/book-call', bookCall)

export default router

