import express from 'express'
import rateLimit from 'express-rate-limit'
import { sendOtp, verifyOtp } from '../controllers/otpController.js'

const router = express.Router()

// Rate limiting: max 3 OTP requests per email (or IP) per 15 minutes
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: {
    message: 'Too many OTP requests from this email. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Limit by email address in request body if present, fallback to IP
    return req.body.email ? req.body.email.toLowerCase().trim() : req.ip
  },
})

router.post('/send-otp', otpLimiter, sendOtp)
router.post('/verify-otp', verifyOtp)

export default router
