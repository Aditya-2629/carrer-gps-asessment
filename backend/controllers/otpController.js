import nodemailer from 'nodemailer'
import User from '../models/User.js'
import generateOTP from '../utils/generateOTP.js'
import ReportJob from '../models/ReportJob.js'
import { generateUserToken } from '../utils/userAuth.js'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  })
}

function getMailOptions(email, otp) {
  return {
    from: process.env.SMTP_FROM || '"Career GPS" <noreply@careergps.com>',
    to: email.toLowerCase().trim(),
    subject: 'Your Career GPS Verification Code',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #10b981;">Career GPS</h2>
        <p>Your Career GPS verification code is:</p>
        <div style="background: #f3f4f6; padding: 12px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; border-radius: 4px; color: #111827;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">It expires in 10 minutes.</p>
      </div>
    `,
  }
}

// Send OTP (First-time or re-test)
export const sendOtp = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required.' })
  }

  try {
    const normalizedEmail = email.toLowerCase().trim()
    const otp = generateOTP()
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

    let user = await User.findOne({ email: normalizedEmail })
    if (user) {
      user.otp = otp
      user.otpExpiresAt = otpExpiresAt
      user.isVerified = false
      user.aiReport = null // Reset previous report on re-test, but keep linkedinData & resumeJson intact
      await user.save()
    } else {
      user = await User.create({
        email: normalizedEmail,
        otp,
        otpExpiresAt,
        isVerified: false,
      })
    }

    // Clean up any stale in-flight or completed jobs for this user
    await ReportJob.deleteMany({ userId: user._id }).catch(() => {})

    const transporter = createTransporter()
    const mailOptions = getMailOptions(normalizedEmail, otp)

    try {
      await transporter.sendMail(mailOptions)
      console.log(`[OTP] Sent verification code ${otp} to ${normalizedEmail}`)
      return res.status(200).json({ success: true, message: 'Verification code sent to your email.' })
    } catch (mailError) {
      console.error('[OTP] SMTP send failed:', mailError.message)
      const resPayload = {
        success: true,
        message: 'Verification code generated successfully.',
      }
      // if (process.env.NODE_ENV !== 'production') {
        resPayload.dev_otp = otp
      // }
      return res.status(200).json(resPayload)
    }
  } catch (error) {
    console.error('Error in sendOtp controller:', error)
    return res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}

// Resend OTP
export const resendOtp = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required.' })
  }

  try {
    const normalizedEmail = email.toLowerCase().trim()
    let user = await User.findOne({ email: normalizedEmail })

    const otp = generateOTP()
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        otp,
        otpExpiresAt,
        isVerified: false,
      })
    } else {
      user.otp = otp
      user.otpExpiresAt = otpExpiresAt
      user.isVerified = false
      await user.save()
    }

    await ReportJob.deleteMany({ userId: user._id }).catch(() => {})

    const transporter = createTransporter()
    const mailOptions = getMailOptions(normalizedEmail, otp)

    try {
      await transporter.sendMail(mailOptions)
      console.log(`[OTP] Resent verification code ${otp} to ${normalizedEmail}`)
      return res.status(200).json({ success: true, message: 'Verification code resent to your email.' })
    } catch (mailError) {
      console.error('[OTP] SMTP resend failed:', mailError.message)
      const resPayload = {
        success: true,
        message: 'Verification code regenerated successfully.',
      }
      if (process.env.NODE_ENV !== 'production') {
        resPayload.dev_otp = otp
      }
      return res.status(200).json(resPayload)
    }
  } catch (error) {
    console.error('Error in resendOtp controller:', error)
    return res.status(500).json({ success: false, message: 'Failed to resend verification code.' })
  }
}

// Verify OTP
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required.' })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() })

    if (!user || user.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' })
    }

    // Expiry check (10 minutes)
    if (user.otpExpiresAt && new Date() > new Date(user.otpExpiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please click Resend OTP.',
      })
    }

    // Update verified status and clear OTP
    user.isVerified = true
    user.otp = null
    user.otpExpiresAt = null
    await user.save()

    const sessionToken = generateUserToken(user._id)

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      userId: user._id,
      sessionToken,
      report: user.aiReport || null,
      hasAnswers: Boolean(user.answers && Object.keys(user.answers).length > 0),
    })
  } catch (error) {
    console.error('Error in verifyOtp controller:', error)
    return res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}
