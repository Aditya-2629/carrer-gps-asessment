import mongoose from 'mongoose'
import User from '../models/User.js'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import { sendAdminReportEmail, sendBookCallNotification } from '../utils/adminEmails.js'
import { scrapeLinkedInProfile } from '../utils/apifyLinkedInScraper.js'
import { buildRAGContext, buildSmartQuery } from '../utils/ragEngine.js'
import { generateContentWithFallback } from '../utils/geminiClient.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { analyzeLinkedInProfile } from '../agents/linkedin/linkedinAgent.js'
import { runCareerAgents } from '../agents/orchestrator.js'
import { generateReportBundle } from '../services/reportGeneration.js'

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
        "location": "City, State/Country or N/A",
        "linkedin": "LinkedIn URL if present or N/A",
        "github": "GitHub URL if present or N/A"
      },
      "experiences": [
        {
          "role": "Exact role title (must NOT end with period, max 65 chars, no prepositions like 'across' or 'throughout')",
          "company": "Company name",
          "location": "City, State or Remote",
          "startDate": "Start Date (e.g. Month Year)",
          "endDate": "End Date (e.g. Month Year or Present)",
          "isCurrent": true,
          "bullets": [
            "Verbatim bullet point 1",
            "Verbatim bullet point 2"
          ]
        }
      ],
      "projects": [
        {
          "title": "Project Title",
          "techStack": "Technologies used (e.g. React, Node.js, AWS)",
          "bullets": [
            "Verbatim bullet point"
          ]
        }
      ],
      "skills": ["Skill1", "Skill2", "Skill3"],
      "certifications": ["Certification name 1", "Certification name 2"],
      "top_skills": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5", "Skill6"],
      "missing_ats_keywords": [],
      "ats_score": 65,
      "strengths": ["Strength 1 with quantitative evidence", "Strength 2"],
      "red_flags": ["Red Flag 1 (e.g. poor formatting, lack of metrics, gaps)", "Red Flag 2"],
      "experience_summary": ["Key achievement 1", "Key achievement 2"],
      "education": ["Degree / Institution"],
      "executive_ai_critique": "A direct, punchy 3-4 sentence text evaluation by executive AI recruiter 'Atlas' analyzing this resume's strengths, critical ATS flaws, and harsh reality feedback for the candidate."
    }

    NOTE ON missing_ats_keywords: Return an array of genuine technical skills, frameworks, or tools that are expected for the candidate's target role but completely missing from this resume. If the resume already has strong coverage or no specific technical gaps are identified, return an empty array []. NEVER return placeholder values like 'Keyword1', 'Quantified ROI Metrics', or generic phrases.
  `

  const filePart = {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType: mimeType || 'application/pdf',
    },
  }

  const { text: responseText } = await generateContentWithFallback({
    contents: [prompt, filePart],
    modelName: 'gemini-3.5-flash-lite',
  })

  const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleanJson)

  // Sanitize missing_ats_keywords to remove any placeholder values
  const placeholderPatterns = [
    /^keyword\d+$/i,
    /quantified roi metrics/i,
    /star achievement bullets/i,
    /ci\/cd automation/i,
    /kubernetes orchestration/i,
  ]
  if (Array.isArray(parsed.missing_ats_keywords)) {
    parsed.missing_ats_keywords = parsed.missing_ats_keywords
      .map((kw) => (typeof kw === 'string' ? kw.trim() : ''))
      .filter((kw) => kw && !placeholderPatterns.some((p) => p.test(kw)))
  } else {
    parsed.missing_ats_keywords = []
  }

  return parsed
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

    // Check if linkedinData was already pre-scraped from Step 11
    if (answers.linkedinData) {
      try {
        user.linkedinData = typeof answers.linkedinData === 'string'
          ? JSON.parse(answers.linkedinData)
          : answers.linkedinData
      } catch (_e) {
        user.linkedinData = answers.linkedinData
      }
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
      // If not yet pre-scraped, attempt live scrape (non-fatal, never reject saveAnswers with 400)
      if (!user.linkedinData) {
        try {
          const scrapedProfile = await scrapeLinkedInProfile(extractedLinkedinUrl)
          if (scrapedProfile) {
            user.linkedinData = scrapedProfile
          }
        } catch (scrapeErr) {
          console.warn('[AssessmentController] Live Apify LinkedIn scraping non-fatal error:', scrapeErr.message)
        }
      }
    }

    // Handle uploaded file if present via Multer
    if (req.file) {
      user.resumeData = req.file.buffer
      user.resumeName = req.file.originalname
      
      if (req.body?.precomputedResumeJson) {
        try {
          user.resumeJson = typeof req.body.precomputedResumeJson === 'string'
            ? JSON.parse(req.body.precomputedResumeJson)
            : req.body.precomputedResumeJson
        } catch (_e) {
          // fallback
        }
      }
      
      if (!user.resumeJson) {
        try {
          // Convert resume to structured JSON via Gemini (non-fatal so resumeData buffer is always preserved)
          const resumeJson = await parseResumeToJSON(req.file.buffer, req.file.mimetype, req.file.originalname)
          user.resumeJson = resumeJson
        } catch (parseErr) {
          console.warn('[AssessmentController] Non-fatal parseResumeToJSON error (resumeData buffer preserved):', parseErr.message)
        }
      }
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
    // Phase C: the generation engine lives in services/reportGeneration.js —
    // shared by this blocking controller and the async ReportJob worker.
    const { user, aiReport } = await generateReportBundle({ userId, semanticProfile })
    return res.status(200).json(aiReport)
  } catch (error) {
    console.error('Error in generateReport controller:', error)
    const status = error.statusCode || 400
    return res.status(status).json({ message: error.message || 'Failed to generate AI report. Please try again.' })
  }
}

// Chat / Ask questions about resume & LinkedIn to AI — NOW WITH RAG KNOWLEDGE BASE
// Phase F: this is now a ROUTER agent (Anthropic routing pattern) — it
// classifies the question, loads ONLY the relevant agent's findings, and the
// reply carries deep-links to the report sections it references.

const CHAT_INTENTS = [
  { id: 'resume', section: 'resume-ai', label: 'Resume diagnosis', match: /\b(resume|bullet|rewrite|quantif|ats|score (on )?my resume|cover letter|achievement)\b/i },
  { id: 'linkedin', section: 'linkedin-ai', label: 'LinkedIn audit', match: /\b(linkedin|headline|profile pic|connection|network(ing)?|recommendation)\b/i },
  { id: 'roadmap', section: 'priorities', label: 'Action plan', match: /\b(plan|roadmap|this week|first|priorit|next step|what (should|do) i do|30|60|90)\b/i },
  { id: 'assessment', section: 'snapshot', label: 'Career health', match: /\b(health|score|bottleneck|funnel|conversion|stat|overall|summary)\b/i },
]

function classifyChatIntent(question) {
  for (const intent of CHAT_INTENTS) {
    if (intent.match.test(question)) return intent
  }
  return { id: 'general', section: 'agent-team', label: 'Full report' }
}

export const chatResume = async (req, res) => {
  const { userId, question } = req.body

  if (!userId || !question) {
    return res.status(400).json({ message: 'userId and question are required.' })
  }

  try {
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const intent = classifyChatIntent(question)

    // Phase F: route context by intent — the agent whose findings the question
    // is about, plus a compact shared base. Nothing else.
    const r = user.aiReport || {}
    const contextParts = [`CANDIDATE: ${user.resumeJson?.candidate_name || user.email} | target: ${r.resume_json?.target_role || 'unknown'}`]

    if (intent.id === 'resume' || intent.id === 'general') {
      const ra = r.resume_agent
      if (ra) {
        contextParts.push(
          `RESUME AGENT DIAGNOSIS (score ${ra.dashboard?.score ?? '?'}/${ra.dashboard?.grade ?? '?'}):\n` +
          `checklist: ${(ra.checks || []).map((c) => `${c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗'} ${c.label}`).join(' | ')}\n` +
          `issues: ${(ra.issues || []).slice(0, 5).map((i) => `- [${i.severity}/${i.category}] ${i.title} → ${String(i.recommendation || '').slice(0, 120)}`).join('\n')}\n` +
          `overall: ${String(ra.overallReview?.summary || '').slice(0, 400)}`
        )
      }
    }
    if (intent.id === 'linkedin' || intent.id === 'general') {
      const la = r.linkedin_agent
      if (la?.dataAvailable) {
        contextParts.push(
          `LINKEDIN AGENT DIAGNOSIS (score ${la.score}/${la.grade}):\n` +
          `checklist: ${(la.checks || []).map((c) => `${c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗'} ${c.label}`).join(' | ')}\n` +
          `fixes: ${(la.issues || []).slice(0, 5).map((i) => `- [${i.severity}] ${i.title} → ${String(i.recommendation || '').slice(0, 120)}`).join('\n')}`
        )
      }
    }
    if (intent.id === 'roadmap' || intent.id === 'assessment' || intent.id === 'general') {
      if (r.career_health_score) {
        contextParts.push(
          `ASSESSMENT SNAPSHOT: career health ${r.career_health_score}/100 (${r.score_label || '—'})\n` +
          `scores: ${JSON.stringify(r.scores || {})}\n` +
          `critical issues: ${(r.critical_issues || []).slice(0, 3).map((i) => `- ${i.title}`).join('\n')}\n` +
          `top priorities: ${(r.mission_board || []).slice(0, 3).map((m) => `- ${m.title || m.mission || JSON.stringify(m).slice(0, 80)}`).join('\n')}`
        )
      }
    }

    const resumeContext = contextParts.join('\n\n')

    // RAG context using the question + user profile as query
    let ragKnowledgeContext = ''
    try {
      const ragQuery = `${question} ${user.resumeJson?.target_role || ''} ${user.resumeJson?.top_skills?.join(' ') || ''}`
      ragKnowledgeContext = await buildRAGContext(ragQuery)
    } catch (_ragErr) {
      // non-fatal, continue without RAG
    }

    const prompt = `
      You are "Atlas", a $2000/hour Elite Executive Career Strategist, Senior Technical Recruiter, and ATS Expert who has placed 500+ candidates into FAANG and Fortune 500 companies.

      You are having a REAL-TIME conversation with a candidate who has completed a career assessment run by a team of specialist AI agents (Resume Agent, LinkedIn Agent, Assessment Agent). Their findings are below.

      CRITICAL PERSONA RULES:
      - You are NOT a generic chatbot. You are a fierce, authoritative career coach who speaks with extreme specificity.
      - EVERY answer MUST reference specific data points from the candidate's diagnosis below (checklist items, issue titles, scores).
      - Name their actual skills, roles, scores, and gaps. Never say generic things like "your resume needs work" — say exactly WHAT needs fixing and HOW.
      - Be direct, punchy, and brutally honest but constructive. Use concrete numbers, percentages, and actionable tactics.
      - Answer in 3-5 impactful sentences. Longer if the question demands depth.
      - Use bullet points for action items when appropriate.

      ### KNOWLEDGE BASE (Verified Career Intelligence):
      ${ragKnowledgeContext}

      ### AGENT FINDINGS (routed for this question — intent: ${intent.label}):

      ${resumeContext}

      Candidate Question: "${question}"
    `

    const { text: replyText } = await generateContentWithFallback({
      contents: prompt,
      modelName: 'gemini-3.5-flash-lite',
    })

    return res.status(200).json({
      answer: replyText.trim(),
      routedIntent: intent.label,
      sectionLink: `#${intent.section}`,
    })
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
