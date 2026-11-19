import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import rateLimit from 'express-rate-limit'
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

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Public Rate Limiter for expensive generation routes (30 requests per 15 min per IP)
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again shortly.',
  },
})

// Mount rate limiters on public entrypoints
app.use('/api/assessment', publicApiLimiter)
app.use('/api/otp', publicApiLimiter)
app.use('/api/resume-agent', publicApiLimiter)
app.use('/api/linkedin-agent', publicApiLimiter)

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
