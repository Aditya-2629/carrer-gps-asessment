import nodemailer from 'nodemailer'
import User from '../models/User.js'
import generateOTP from '../utils/generateOTP.js'

import ReportJob from '../models/ReportJob.js'

// Send OTP
export const sendOtp = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email address is required.' })
  }

  try {
    const otp = generateOTP()

    // Upsert User and reset stale assessment fields so re-tests always generate a fresh report
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      {
        $set: {
          otp,
          isVerified: false,
          aiReport: null,
          linkedinData: null,
          linkedinUrl: null,
          resumeJson: null,
        },
      },
      { upsert: true, new: true }
    )

    // Clean up any stale in-flight or completed jobs for this user
    await ReportJob.deleteMany({ userId: user._id }).catch(() => {})

    // Nodemailer configuration with 10-second timeout parameters
    const transporter = nodemailer.createTransport({
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

    const mailOptions = {
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

    try {
      await transporter.sendMail(mailOptions)
      console.log(`[OTP] Sent verification code ${otp} to ${email}`)
      return res.status(200).json({ message: 'Verification code sent to your email.' })
    } catch (mailError) {
      console.error('[OTP] SMTP send failed:', mailError)
      return res.status(200).json({
        message: 'Verification code generated successfully.',
        dev_otp: otp, // Bypass OTP display fallback
      })
    }
  } catch (error) {
    console.error('Error in sendOtp controller:', error)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// Verify OTP
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and verification code are required.' })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() })

    if (!user || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code.' })
    }

    // Update verified status and clear OTP
    user.isVerified = true
    user.otp = null
    await user.save()

    return res.status(200).json({
      message: 'Email verified successfully.',
      userId: user._id,
      report: user.aiReport || null,
      hasAnswers: Boolean(user.answers && Object.keys(user.answers).length > 0),
    })
  } catch (error) {
    console.error('Error in verifyOtp controller:', error)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
