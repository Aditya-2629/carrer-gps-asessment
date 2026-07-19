import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import otpRoutes from './routes/otpRoutes.js'
import assessmentRoutes from './routes/assessmentRoutes.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// CORS — allow the deployed Render frontend + localhost for development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL, // e.g. https://career-gps.onrender.com
].filter(Boolean) // remove undefined if env var not set

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin} not in allowed list`))
  },
  credentials: true,
}))
app.use(express.json())

// Mount routes
app.use('/api/otp', otpRoutes)
app.use('/api/assessment', assessmentRoutes)

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

    app.listen(PORT, () => {
      console.log(`Server is currently listening on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to initialize connection or start server:', error)
    process.exit(1)
  }
}

startServer()
