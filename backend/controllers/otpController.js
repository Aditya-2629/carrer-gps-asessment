import User from '../models/User.js'
import generateOTP from '../utils/generateOTP.js'
import ReportJob from '../models/ReportJob.js'
import { generateUserToken } from '../utils/userAuth.js'
import { sendOtpEmail } from '../utils/adminEmails.js'

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

    const mailResult = await sendOtpEmail(normalizedEmail, otp)
    if (!mailResult.ok) {
      console.error('[OTP] Email send failed:', mailResult.error)
      return res.status(502).json({
        success: false,
        message: 'Failed to send verification code. Please check your email and try again.',
      })
    }

    return res.status(200).json({ success: true, message: 'Verification code sent to your email.' })
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

    const mailResult = await sendOtpEmail(normalizedEmail, otp)
    if (!mailResult.ok) {
      console.error('[OTP] Email resend failed:', mailResult.error)
      return res.status(502).json({
        success: false,
        message: 'Failed to resend verification code. Please try again.',
      })
    }

    return res.status(200).json({ success: true, message: 'Verification code resent to your email.' })
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
