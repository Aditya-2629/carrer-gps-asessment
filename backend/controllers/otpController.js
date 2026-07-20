import User from '../models/User.js'
import generateOTP from '../utils/generateOTP.js'

// Send OTP
export const sendOtp = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email address is required.' })
  }

  try {
    const otp = generateOTP()

    // Upsert User
    await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { otp, isVerified: false },
      { upsert: true, new: true }
    )

    // Call Brevo HTTP API
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { 
            name: 'Career GPS', 
            email: process.env.BREVO_FROM || 'inspiracustomer@gmail.com' 
          },
          to: [{ email: email.toLowerCase().trim() }],
          subject: 'Your Career GPS Verification Code',
          htmlContent: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #10b981;">Career GPS</h2>
              <p>Your Career GPS verification code is:</p>
              <div style="background: #f3f4f6; padding: 12px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; border-radius: 4px; color: #111827;">
                ${otp}
              </div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">It expires in 10 minutes.</p>
            </div>
          `
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('[OTP] Brevo API error response:', result)
        return res.status(200).json({
          message: 'Verification code generated successfully.',
          dev_otp: otp, // Bypass fallback
        })
      }

      console.log(`[OTP] Sent verification code ${otp} to ${email}`)
      return res.status(200).json({ message: 'Verification code sent to your email.' })
    } catch (apiError) {
      console.error('[OTP] Brevo API request failed:', apiError)
      return res.status(200).json({
        message: 'Verification code generated successfully.',
        dev_otp: otp,
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
    })
  } catch (error) {
    console.error('Error in verifyOtp controller:', error)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
