import mongoose from 'mongoose'
import User from '../models/User.js'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import { sendAdminReportEmail, sendBookCallNotification } from '../utils/adminEmails.js'
import { scrapeLinkedInProfile } from '../utils/apifyLinkedInScraper.js'
import { buildRAGContext, buildSmartQuery } from '../utils/ragEngine.js'
import { generateContentWithFallback } from '../utils/geminiClient.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { analyzeLinkedInProfile } from '../agents/linkedin/linkedinAgent.js'

// Helper function to parse uploaded resume to JSON using Gemini API with multi-key & model fallback
const parseResumeToJSON = async (fileBuffer, mimeType, filename) => {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Resume file is empty or corrupted. Please upload a valid document.')
  }

  const prompt = `
    You are an expert Resume Parser and ATS Specialist.
    Analyze the attached resume document and convert it into a structured JSON object.
    
    CRITICAL: Return ONLY a valid, raw JSON object (NO markdown fences, NO backticks \`\`\`json, NO surrounding text).
    
    Use this exact schema:
    {
      "candidate_name": "Full name or Candidate",
      "target_role": "Target or current job title",
      "years_of_experience": "Estimated total years of tech experience",
      "contact": {
        "email": "Email if present or N/A",
        "phone": "Phone if present or N/A",
        "location": "City, State/Country or N/A"
      },
      "top_skills": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5", "Skill6"],
      "missing_ats_keywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4"],
      "ats_score": 65,
      "strengths": ["Strength 1 with quantitative evidence", "Strength 2"],
      "red_flags": ["Red Flag 1 (e.g. poor formatting, lack of metrics, gaps)", "Red Flag 2"],
      "experience_summary": ["Key achievement 1", "Key achievement 2"],
      "education": ["Degree / Institution"],
      "executive_ai_critique": "A direct, punchy 3-4 sentence text evaluation by executive AI recruiter 'Atlas' analyzing this resume's strengths, critical ATS flaws, and harsh reality feedback for the candidate."
    }
  `

  const filePart = {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType: mimeType || 'application/pdf',
    },
  }

  const { text: responseText } = await generateContentWithFallback({
    contents: [prompt, filePart],
    modelName: 'gemini-3.6-flash',
  })

  const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
  return JSON.parse(cleanJson)
}

// Save answers and resume upload
export const saveAnswers = async (req, res) => {
  const { userId } = req.body
  let { answers, semanticProfile } = req.body

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

  // Parse semanticProfile JSON string if sent via multipart/form-data
  if (typeof semanticProfile === 'string') {
    try {
      semanticProfile = JSON.parse(semanticProfile)
    } catch (e) {
      console.warn('Could not parse semanticProfile JSON in saveAnswers:', e)
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

    // Save answers & AI-semantic profile
    user.answers = answers
    if (semanticProfile) {
      user.semanticProfile = semanticProfile
    }

    // Detect LinkedIn URL in submitted answers
    let extractedLinkedinUrl = null
    for (const [key, val] of Object.entries(answers)) {
      if (typeof val === 'string' && val.includes('linkedin.com/in/')) {
        extractedLinkedinUrl = val.trim()
        break
      }
    }

    if (extractedLinkedinUrl) {
      user.linkedinUrl = extractedLinkedinUrl
      // Trigger Apify LinkedIn Scraper (throws error on invalid URL or scraping failure)
      const scrapedProfile = await scrapeLinkedInProfile(extractedLinkedinUrl)
      user.linkedinData = scrapedProfile
    }

    // Handle uploaded file if present via Multer
    if (req.file) {
      user.resumeData = req.file.buffer
      user.resumeName = req.file.originalname
      
      // Convert resume to structured JSON via Gemini (throws error on failure)
      const resumeJson = await parseResumeToJSON(req.file.buffer, req.file.mimetype, req.file.originalname)
      user.resumeJson = resumeJson
    }

    await user.save()

    return res.status(200).json({
      message: 'Answers, resume, and LinkedIn data processed successfully.',
      resumeJson: user.resumeJson,
      linkedinData: user.linkedinData
    })
  } catch (error) {
    console.error('Error in saveAnswers controller:', error)
    return res.status(400).json({ message: error.message || 'Internal server error.' })
  }
}

// Generate report and notify admin
export const generateReport = async (req, res) => {
  const { userId } = req.body
  let { semanticProfile } = req.body

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' })
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid User ID format.' })
  }

  if (typeof semanticProfile === 'string') {
    try {
      semanticProfile = JSON.parse(semanticProfile)
    } catch (e) {
      console.warn('Could not parse semanticProfile JSON in generateReport:', e)
    }
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

    // If LinkedIn URL was provided but profile wasn't scraped yet, scrape now via Apify
    if (user.linkedinUrl && !user.linkedinData) {
      try {
        const scrapedProfile = await scrapeLinkedInProfile(user.linkedinUrl)
        if (scrapedProfile) {
          user.linkedinData = scrapedProfile
        }
      } catch (e) {
        console.error('Apify LinkedIn scraping failed during report generation:', e)
      }
    }

    // Build RAG-enhanced Knowledge Base context (baseline + uploaded documents)
    let dynamicKbContent = null
    try {
      const smartQuery = buildSmartQuery(user.answers, user.resumeJson)
      dynamicKbContent = await buildRAGContext(smartQuery)
    } catch (kbErr) {
      console.error('Error building RAG context, using default fallback:', kbErr)
    }

    const effectiveSemanticProfile = semanticProfile || user.semanticProfile || null

    const promptText = getGeminiPrompt(user.answers, user.resumeJson, user.linkedinData, dynamicKbContent, effectiveSemanticProfile)

    // Call Gemini API with gemini-3.6-flash and multi-key / multi-model fallback.
    // V3.1: the Resume Specialist Agent (deep diagnosis + scorecard) runs IN
    // PARALLEL with the Atlas report so its latency stays hidden.
    const atlasReportPromise = generateContentWithFallback({
      contents: promptText,
      modelName: 'gemini-3.6-flash',
    })

    let resumeAgentPromise = null
    if (user.resumeData && user.resumeData.length > 0) {
      const resumeTargetRole =
        effectiveSemanticProfile?.targetRole ||
        effectiveSemanticProfile?.target_role ||
        user.answers?.targetRole ||
        user.resumeJson?.target_role ||
        ''
      resumeAgentPromise = ResumeAgent.evaluate({
        buffer: user.resumeData,
        filename: user.resumeName || 'resume',
        targetRole: resumeTargetRole,
      }).catch((agentErr) => {
        console.error('Resume Agent failed during report generation:', agentErr.message)
        return null
      })
    }

    const { text: responseText } = await atlasReportPromise

    const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
    const aiReport = JSON.parse(cleanJsonString)

    // Include structured resume & linkedin json in final report output
    if (user.resumeJson) {
      aiReport.resume_json = user.resumeJson
    }
    if (user.linkedinData) {
      aiReport.linkedin_json = user.linkedinData
    }

    // V3.1: attach the Resume Specialist Agent's deep diagnosis (scorecard,
    // bullet audit, coach-card issues) once the parallel run settles.
    if (resumeAgentPromise) {
      const agentResult = await resumeAgentPromise
      if (agentResult?.success && agentResult.analysis) {
        aiReport.resume_agent = agentResult.analysis
      } else if (agentResult) {
        console.warn('Resume Agent did not succeed; report continues without resume_agent:', agentResult.error || agentResult.status)
      }
    }

    // Multi-Agent Architecture: LinkedIn Agent (deterministic, instant).
    // Analyzes the scraped profile with the same scorecard contract the
    // Resume Agent uses, so the report UI renders both identically.
    if (user.linkedinData) {
      try {
        aiReport.linkedin_agent = analyzeLinkedInProfile(user.linkedinData, {
          targetRole: user.resumeJson?.target_role || '',
          primaryProfile: user.resumeJson?.primary_profile || '',
        })
      } catch (liErr) {
        console.warn('LinkedIn Agent failed; report continues without linkedin_agent:', liErr.message)
      }
    }

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
    return res.status(400).json({ message: error.message || 'Failed to generate AI report. Please try again.' })
  }
}

// Chat / Ask questions about resume & LinkedIn to AI — NOW WITH RAG KNOWLEDGE BASE
export const chatResume = async (req, res) => {
  const { userId, question } = req.body

  if (!userId || !question) {
    return res.status(400).json({ message: 'User ID and question are required.' })
  }

  try {
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const resumeContext = user.resumeJson ? JSON.stringify(user.resumeJson) : 'No structured resume JSON available.'
    const linkedinContext = user.linkedinData ? JSON.stringify(user.linkedinData) : 'No LinkedIn profile scraped.'
    const answersContext = user.answers ? JSON.stringify(user.answers) : 'No assessment answers available.'
    const reportContext = user.aiReport ? JSON.stringify(user.aiReport) : 'No AI report generated yet.'

    // Build RAG context using the question + user profile as query
    let ragKnowledgeContext = ''
    try {
      const ragQuery = `${question} ${user.resumeJson?.target_role || ''} ${user.resumeJson?.top_skills?.join(' ') || ''}`
      ragKnowledgeContext = await buildRAGContext(ragQuery)
    } catch (_ragErr) {
      // non-fatal, continue without RAG
    }

    const prompt = `
      You are "Atlas", a $2000/hour Elite Executive Career Strategist, Senior Technical Recruiter, and ATS Expert who has placed 500+ candidates into FAANG and Fortune 500 companies.

      You are having a REAL-TIME conversation with a candidate who has completed a career assessment. You have access to their FULL profile data below.

      CRITICAL PERSONA RULES:
      - You are NOT a generic chatbot. You are a fierce, authoritative career coach who speaks with extreme specificity.
      - EVERY answer MUST reference specific data points from the candidate's resume, LinkedIn, or assessment answers.
      - Name their actual skills, roles, scores, and gaps. Never say generic things like "your resume needs work" — say exactly WHAT needs fixing and HOW.
      - Be direct, punchy, and brutally honest but constructive. Use concrete numbers, percentages, and actionable tactics.
      - Answer in 3-5 impactful sentences. Longer if the question demands depth.
      - Use bullet points for action items when appropriate.

      ### KNOWLEDGE BASE (Verified Career Intelligence):
      ${ragKnowledgeContext}

      ### CANDIDATE'S FULL PROFILE:

      Candidate Question: "${question}"

      Parsed Resume JSON:
      ${resumeContext}

      LinkedIn Profile JSON:
      ${linkedinContext}

      Assessment Answers (31 questions about job search strategy, visa status, application methods, etc.):
      ${answersContext}

      Previously Generated AI Career Report:
      ${reportContext}
    `

    const { text: replyText } = await generateContentWithFallback({
      contents: prompt,
      modelName: 'gemini-3.6-flash',
    })

    return res.status(200).json({ answer: replyText.trim() })
  } catch (error) {
    console.error('Error in chatResume controller:', error)
    return res.status(500).json({ message: 'Failed to process query.' })
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

// Retrieve existing persisted report for a user
export const getReport = async (req, res) => {
  const userId = req.params?.userId || req.query?.userId
  const email = req.query?.email

  if (!userId && !email) {
    return res.status(400).json({ message: 'User ID or Email is required.' })
  }

  try {
    let user = null
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId)
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim() })
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (!user.aiReport) {
      return res.status(404).json({
        message: 'No report found for this user.',
        isVerified: user.isVerified,
        hasAnswers: Boolean(user.answers && Object.keys(user.answers).length > 0),
      })
    }

    return res.status(200).json(user.aiReport)
  } catch (error) {
    console.error('Error in getReport controller:', error)
    return res.status(500).json({ message: 'Failed to retrieve report.' })
  }
}
