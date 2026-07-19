import mongoose from 'mongoose'
import { GoogleGenerativeAI } from '@google/generative-ai'
import User from '../models/User.js'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import { sendAdminReportEmail, sendBookCallNotification } from '../utils/adminEmails.js'

// Save answers and resume upload
export const saveAnswers = async (req, res) => {
  const { userId } = req.body
  let { answers } = req.body

  if (!userId || !answers) {
    return res.status(400).json({ message: 'User ID and answers are required.' })
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid User ID format.' })
  }

  // Parse answers JSON string if sent via multipart/form-data
  if (typeof answers === 'string') {
    try {
      answers = JSON.parse(answers)
    } catch (e) {
      return res.status(400).json({ message: 'Invalid answers JSON format.' })
    }
  }

  try {
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Unauthorized. Email not verified.' })
    }

    // Save answers
    user.answers = answers

    // Handle uploaded file if present via Multer
    if (req.file) {
      user.resumeData = req.file.buffer
      user.resumeName = req.file.originalname
    }

    await user.save()
    return res.status(200).json({ message: 'Answers saved successfully.' })
  } catch (error) {
    console.error('Error in saveAnswers controller:', error)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// Generate report and notify admin
export const generateReport = async (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' })
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid User ID format.' })
  }

  try {
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    // Back-Gate check: Verify user is verified
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Unauthorized. Email not verified.' })
    }

    const hasAnswers = user.answers && Object.keys(user.answers).length > 0
    if (!hasAnswers) {
      return res.status(400).json({ message: 'No answers found. Please submit the assessment first.' })
    }

    // Call Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' })

    const promptText = getGeminiPrompt(user.answers)

    const result = await model.generateContent(promptText)
    const responseText = result.response.text()

    // Sanitization Logic
    const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
    const aiReport = JSON.parse(cleanJsonString)

    // Save report to User DB
    user.aiReport = aiReport
    await user.save()

    // Trigger Admin Email asynchronously (so candidate doesn't wait)
    sendAdminReportEmail(
      user.email,
      user.answers,
      aiReport,
      user.resumeData,
      user.resumeName
    )

    return res.status(200).json(aiReport)
  } catch (error) {
    console.error('Error in generateReport controller:', error)
    return res.status(500).json({ message: 'Failed to generate AI report. Please try again.' })
  }
}

// Book a call lead notification
export const bookCall = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' })
  }

  try {
    // Send email alert to admin
    await sendBookCallNotification(email)
    return res.status(200).json({ message: 'Call request received. We will contact you shortly.' })
  } catch (error) {
    console.error('Error in bookCall controller:', error)
    return res.status(500).json({ message: 'Failed to process request.' })
  }
}
