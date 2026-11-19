import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import otpRoutes from './routes/otpRoutes.js'
import assessmentRoutes from './routes/assessmentRoutes.js'
import knowledgeBaseRoutes from './routes/knowledgeBaseRoutes.js'
import resumeAgentRoutes from './routes/resumeAgentRoutes.js'
import linkedinAgentRoutes from './routes/linkedinAgentRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import reportJobRoutes from './routes/reportJobRoutes.js'
import feedbackRoutes from './routes/feedbackRoutes.js'
import { initMarketAutoScheduler } from './jobs/marketJd/marketAutoScheduler.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Trust reverse proxy for accurate req.ip on Render
app.set('trust proxy', 1)

// Hardening: Disable x-powered-by header
app.disable('x-powered-by')

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})

// Recursive NoSQL Injection Sanitizer
function sanitizeMongoInputs(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeMongoInputs)
  const clean = {}
  for (const [key, val] of Object.entries(obj)) {
    // Strip keys starting with $ or containing . to prevent operator injection and path traversal
    if (key.startsWith('$') || key.includes('.')) continue
    clean[key] = sanitizeMongoInputs(val)
  }
  return clean
}

app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') req.body = sanitizeMongoInputs(req.body)
  if (req.query && typeof req.query === 'object') req.query = sanitizeMongoInputs(req.query)
  if (req.params && typeof req.params === 'object') req.params = sanitizeMongoInputs(req.params)
  next()
})

// Parse optional admin frontend URLs (comma-separated support)
const adminOrigins = (process.env.ADMIN_FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// CORS — public web, external admin panels, and localhost
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
  ...adminOrigins,
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    const normalizedOrigin = origin.replace(/\/$/, '')
    const isAllowed = allowedOrigins.some((allowed) => allowed.replace(/\/$/, '') === normalizedOrigin)
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)
    const isRenderFallback = normalizedOrigin.includes('carrer-gps') && normalizedOrigin.includes('onrender.com')

    if (isAllowed || isLocalhost || isRenderFallback) {
      return callback(null, true)
    }
    callback(new Error(`CORS blocked: ${origin} not in allowed list`))
  },
  credentials: true,
}))

// Reduce JSON/URL-encoded payload limit to 2mb (Multer manages 10mb file uploads separately)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ limit: '2mb', extended: true }))

// AI Evaluation & Heavy Job Limiter (15 req / 15 min per IP)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests to AI evaluation services. Please try again in 15 minutes.',
  },
})

// Feedback Limiter (10 req / 15 min per IP)
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many feedback submissions. Please try again in 15 minutes.',
  },
})

// Mount rate limiters on public entrypoints
app.use('/api/assessment', aiLimiter)
app.use('/api/report-jobs', aiLimiter)
app.use('/api/resume-agent', aiLimiter)
app.use('/api/linkedin-agent', aiLimiter)
app.use('/api/feedback', feedbackLimiter)

// Mount routes
app.use('/api/otp', otpRoutes)
app.use('/api/assessment', assessmentRoutes)
app.use('/api/knowledge-base', knowledgeBaseRoutes)
app.use('/api/admin/knowledge-base', knowledgeBaseRoutes) // Admin unified alias
app.use('/api/resume-agent', resumeAgentRoutes)
app.use('/api/linkedin-agent', linkedinAgentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/report-jobs', reportJobRoutes)
app.use('/api/feedback', feedbackRoutes)

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Career GPS API is running smoothly.' })
})

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Must define 4 arguments (err, req, res, next) so Express treats it as error middleware
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }

  // 1. Multer upload errors (File size limits, unexpected fields, etc.)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File is too large. Please upload a PDF or DOCX under 10MB.',
      })
    }
    return res.status(400).json({
      success: false,
      message: 'Invalid file upload. Please upload a single PDF or DOCX resume.',
    })
  }

  // 2. Unsupported file type errors from Multer fileFilter (e.g., .png, .exe, .zip)
  if (
    err.message &&
    (err.message.includes('Only PDF') ||
      err.message.includes('supported') ||
      err.message.includes('allowed'))
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
    })
  }

  // 3. Malformed JSON payload errors from body-parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request payload.',
    })
  }

  // 4. Other explicit client/validation errors (HTTP 400–499)
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({
      success: false,
      message: err.message || 'Bad request.',
    })
  }

  // 5. Unhandled internal server errors (HTTP 500)
  // Log err.stack internally ONLY; never leak database or stack details to the client
  console.error('[UnhandledServerError]', err?.stack || err?.message || err)
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
  })
})

// Database Connection & Server Startup
const startServer = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/career-gps'
    await mongoose.connect(mongoUri)
    console.log('Successfully connected to MongoDB database.')

    initMarketAutoScheduler()

    app.listen(PORT, () => {
      console.log(`Server is currently listening on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to initialize connection or start server:', error)
    process.exit(1)
  }
}

startServer()
