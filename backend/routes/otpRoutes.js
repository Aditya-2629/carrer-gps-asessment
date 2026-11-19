import express from 'express'
import rateLimit from 'express-rate-limit'
import { sendOtp, resendOtp, verifyOtp } from '../controllers/otpController.js'

const router = express.Router()

// Max 5 OTP send/resend requests per email + IP per 15 min
const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email ? req.body.email.toLowerCase().trim() : 'noemail'
    return `${email}_${req.ip}`
  },
  message: {
    success: false,
    message: 'Too many verification code requests for this email. Please wait 15 minutes before requesting again.',
  },
})

// Max 10 verification attempts per IP per 15 min (brute-force defense)
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait 15 minutes before trying again.',
  },
})

router.post('/send-otp', sendLimiter, sendOtp)
router.post('/resend-otp', sendLimiter, resendOtp)
router.post('/verify-otp', verifyLimiter, verifyOtp)

export default router
