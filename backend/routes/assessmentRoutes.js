import express from 'express'
import multer from 'multer'
import { saveAnswers, generateReport, generateReportStream, bookCall, chatResume, getReport, downloadReportPdf, downloadAtsResumeDocx } from '../controllers/assessmentController.js'

const router = express.Router()

// Multer configuration: Store uploaded resume files in memory as Buffers
const storage = multer.memoryStorage()
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (allowedMimeTypes.includes(file.mimetype)) {
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
router.get('/report/:userId/download-resume-docx', downloadAtsResumeDocx)
router.get('/download-resume-docx', downloadAtsResumeDocx)
router.post('/resume-talk', chatResume)
router.post('/book-call', bookCall)

export default router

