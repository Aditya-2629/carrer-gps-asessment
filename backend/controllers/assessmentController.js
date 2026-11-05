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
import { generateStandardReportPdf, VALID_FORM_KEYS } from '../utils/reportPdfGenerator.js'
import { generateAtsResumeDocx } from '../utils/resumeDocxGenerator.js'
import { buildAtsTailoredDocx } from '../services/docxResumeService.js'
import { determineSkillBucket, cleanTargetRoleTitle, sanitizeAndValidateResume } from '../services/resumeValidator.js'
import { weaveKeywordsAndBuildLedger, batchWeaveBulletsWithLLM } from '../agents/resume/market/smartKeywordWeaver.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'
import { costTracker } from '../utils/costTracker.js'
import { DOCXParser } from '../services/documentParser/docxParser.js'
import { handleChatMessage } from './chatController.js'

// Helper to balance unclosed opening parentheses before a final period
export function balanceParentheses(str) {
  if (!str || typeof str !== 'string') return str
  const openCount = (str.match(/\(/g) || []).length
  const closeCount = (str.match(/\)/g) || []).length
  if (openCount > closeCount) {
    const diff = openCount - closeCount
    if (/\.\s*$/.test(str)) {
      return str.replace(/\.\s*$/, ')'.repeat(diff) + '.')
    }
    return str + ')'.repeat(diff)
  }
  return str
}

export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str
  return str
    .replace(/&(?:amp|Amp);?/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

// Helper function to parse uploaded resume to JSON using Gemini API with multi-key & model fallback
const parseResumeToJSON = async (fileBuffer, mimeType = '', filename = '') => {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Resume file is empty or corrupted. Please upload a valid document.')
  }

  const prompt = `
You are an expert Resume Parser and ATS Specialist.
Analyze the attached resume document and convert it into a structured JSON object.

CRITICAL: Return ONLY a valid, raw JSON object (NO markdown fences, NO backticks, NO surrounding text).

STRICT EXPERIENCE & BOUNDARY RULES:
1. EXPERIENCE BOUNDARIES: A company name, employment date range, or location header must NEVER be placed inside the "bullets" array of any experience block.
2. If you encounter a new company name (e.g. "Recibo Technologies", "Kitcoek", "Accenture"), treat it as the START of a completely new experience object.
3. In each experience object:
   - "role": ONLY the candidate's exact title (e.g. "Software Engineer", "Full Stack Developer"). NEVER put company name or dates inside "role".
   - "company": ONLY the employer organization name (e.g. "Kitcoek", "Recibo Technologies").
   - "location": City and State/Country (e.g. "Maharashtra, India", "Bengaluru, India"). NEVER put programming languages or skills in "location".
   - "startDate" and "endDate": The timeline (e.g. "Jul 2022", "Jun 2024").
4. "bullets": Every item MUST be an actual technical achievement or responsibility starting with an active action verb. Discard any bullet that is simply a company name, date, or location header.
5. "skills": Return an array of discrete, individual technical skills (e.g. ["Python", "Go", "Docker", "AWS"]). Do not return malformed strings with unbalanced parentheses.

Use this exact schema:
{
  "candidate_name": "Full name",
  "target_role": "Target or current job title",
  "years_of_experience": "Estimated total years of experience",
  "contact": {
    "email": "Email address or N/A",
    "phone": "Phone number or N/A",
    "location": "City, State/Country or N/A",
    "linkedin": "LinkedIn URL or N/A",
    "github": "GitHub URL or N/A"
  },
  "experiences": [
    {
      "role": "Software Engineer",
      "company": "Company Name",
      "location": "City, State",
      "startDate": "Mon YYYY",
      "endDate": "Mon YYYY or Present",
      "isCurrent": false,
      "bullets": [
        "Verbatim achievement starting with action verb..."
      ]
    }
  ],
  "projects": [
    {
      "title": "Project Title",
      "techStack": "Technologies used",
      "bullets": ["Verbatim bullet..."]
    }
  ],
  "skills": ["Skill1", "Skill2"],
  "education": ["Degree, Institution, Year"]
}
`

  const cleanFilename = String(filename || '').toLowerCase()
  const cleanMime = String(mimeType || '').toLowerCase()
  const isDocx =
    cleanFilename.endsWith('.docx') ||
    cleanFilename.endsWith('.doc') ||
    cleanMime.includes('word') ||
    cleanMime.includes('officedocument')

  let contents = []

  if (isDocx) {
    // 1. DOCX Support: Extract structured text & bullets via Mammoth
    console.log(`[AssessmentController] Parsing Word document (${filename || 'resume.docx'}) via DOCXParser...`)
    const docxResult = await DOCXParser.parse(fileBuffer)
    const extractedText = docxResult?.text?.trim() || ''

    if (!extractedText || extractedText.length < 30) {
      throw new Error('Could not extract text from Word document. The file may be empty, password-protected, or corrupted.')
    }

    contents = [
      prompt,
      `CANDIDATE WORD (.DOCX) RESUME TEXT CONTENT:\n\n${extractedText}`,
    ]
  } else {
    // 2. PDF / Image Support via native Gemini inlineData
    const filePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: mimeType || 'application/pdf',
      },
    }
    contents = [prompt, filePart]
  }

  const { text: responseText } = await generateContentWithFallback({
    contents,
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
  const allExtractedSkills = [
    ...(Array.isArray(parsed.skills) ? parsed.skills : []),
    ...(Array.isArray(parsed.top_skills) ? parsed.top_skills : [])
  ].map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)

  if (Array.isArray(parsed.missing_ats_keywords)) {
    parsed.missing_ats_keywords = parsed.missing_ats_keywords
      .map((kw) => (typeof kw === 'string' ? kw.trim() : ''))
      .filter((kw) => {
        if (!kw || placeholderPatterns.some((p) => p.test(kw))) return false
        const kwLower = kw.toLowerCase()
        const isAlreadyPresent = allExtractedSkills.some((s) => {
          const sLower = s.toLowerCase()
          if (sLower === kwLower || sLower.includes(kwLower) || kwLower.includes(sLower)) return true
          const tokens = sLower.split(/[^a-z0-9+#.]+/).filter(Boolean)
          return tokens.includes(kwLower)
        })
        return !isAlreadyPresent
      })
  } else {
    parsed.missing_ats_keywords = []
  }

  if (parsed.candidate_name) parsed.candidate_name = decodeHtmlEntities(parsed.candidate_name)
  if (parsed.target_role) parsed.target_role = decodeHtmlEntities(parsed.target_role)
  if (Array.isArray(parsed.skills)) parsed.skills = parsed.skills.map(s => typeof s === 'string' ? decodeHtmlEntities(s) : s)
  if (Array.isArray(parsed.top_skills)) parsed.top_skills = parsed.top_skills.map(s => typeof s === 'string' ? decodeHtmlEntities(s) : s)

  if (parsed.executive_ai_critique) {
    parsed.executive_ai_critique = balanceParentheses(decodeHtmlEntities(parsed.executive_ai_critique))
  }
  if (Array.isArray(parsed.experiences)) {
    parsed.experiences.forEach((exp) => {
      if (exp.role) exp.role = decodeHtmlEntities(exp.role)
      if (exp.company) exp.company = decodeHtmlEntities(exp.company)
      if (Array.isArray(exp.bullets)) {
        exp.bullets = exp.bullets.map((b) => (typeof b === 'string' ? balanceParentheses(decodeHtmlEntities(b)) : b))
      }
    })
  }
  if (Array.isArray(parsed.projects)) {
    parsed.projects.forEach((proj) => {
      if (proj.title) proj.title = decodeHtmlEntities(proj.title)
      if (Array.isArray(proj.bullets)) {
        proj.bullets = proj.bullets.map((b) => (typeof b === 'string' ? balanceParentheses(decodeHtmlEntities(b)) : b))
      }
    })
  }
  if (Array.isArray(parsed.strengths)) {
    parsed.strengths = parsed.strengths.map((s) => (typeof s === 'string' ? balanceParentheses(decodeHtmlEntities(s)) : s))
  }
  if (Array.isArray(parsed.red_flags)) {
    parsed.red_flags = parsed.red_flags.map((rf) => (typeof rf === 'string' ? balanceParentheses(decodeHtmlEntities(rf)) : rf))
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

    // Save answers & AI-semantic profile (sanitized to valid 12-step form keys)
    const sanitizedAnswers = {}
    for (const [k, v] of Object.entries(answers || {})) {
      if (VALID_FORM_KEYS.has(k)) {
        sanitizedAnswers[k] = v
      }
    }
    user.answers = sanitizedAnswers
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

    if (answers.linkedinActivityData) {
      try {
        user.linkedinActivityData = typeof answers.linkedinActivityData === 'string'
          ? JSON.parse(answers.linkedinActivityData)
          : answers.linkedinActivityData
      } catch (_e) {
        user.linkedinActivityData = answers.linkedinActivityData
      }
    }

    if (answers.linkedinActivitySignals) {
      try {
        user.linkedinActivitySignals = typeof answers.linkedinActivitySignals === 'string'
          ? JSON.parse(answers.linkedinActivitySignals)
          : answers.linkedinActivitySignals
      } catch (_e) {
        user.linkedinActivitySignals = answers.linkedinActivitySignals
      }
    }

    const assessmentResults = req.body?.assessmentResults || answers?.assessmentResults || null
    if (assessmentResults) {
      if (assessmentResults.linkedinActivityData) {
        user.linkedinActivityData = assessmentResults.linkedinActivityData
      }
      if (assessmentResults.linkedinActivitySignals) {
        user.linkedinActivitySignals = assessmentResults.linkedinActivitySignals
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
      linkedinData: user.linkedinData,
      linkedinActivityData: user.linkedinActivityData,
      linkedinActivitySignals: user.linkedinActivitySignals,
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
    const reportRunId = `report_${userId}_${Date.now()}`
    costTracker.setActiveRunId(reportRunId)

    // Phase C: the generation engine lives in services/reportGeneration.js —
    // shared by this blocking controller and the async ReportJob worker.
    const { user, aiReport } = await generateReportBundle({ userId, semanticProfile })
    costTracker.printRunSummary(reportRunId)
    const responsePayload = {
      ...aiReport,
      linkedinActivityData: user?.linkedinActivityData || aiReport?.linkedin_activity_data || null,
      linkedinActivitySignals: user?.linkedinActivitySignals || aiReport?.linkedin_activity_signals || null,
    }
    return res.status(200).json(responsePayload)
  } catch (error) {
    console.error('Error in generateReport controller:', error)
    const status = error.statusCode || 400
    return res.status(status).json({ message: error.message || 'Failed to generate AI report. Please try again.' })
  }
}

// Live Server-Sent Events (SSE) Report Stream
export const generateReportStream = async (req, res) => {
  const { userId } = req.query

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Valid User ID required.' })
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const sendProgress = (percent, message) => {
    res.write(`data: ${JSON.stringify({ percent, message, timestamp: Date.now() })}\n\n`)
  }

  try {
    sendProgress(10, 'Initializing knowledge context & market baselines...')

    const { user, aiReport } = await generateReportBundle({
      userId,
      onProgress: ({ stage, message }) => {
        let percent = 30
        if (stage === 'preparing') percent = 20
        if (stage === 'agents_running') percent = 50
        if (stage === 'agent_resume_agent_done') percent = 70
        if (stage === 'persisting') percent = 90
        sendProgress(percent, message)
      },
    })

    sendProgress(100, 'Assessment complete! Rendering dashboard...')
    const streamedReport = {
      ...aiReport,
      linkedinActivityData: user?.linkedinActivityData || aiReport?.linkedin_activity_data || null,
      linkedinActivitySignals: user?.linkedinActivitySignals || aiReport?.linkedin_activity_signals || null,
    }
    res.write(`data: ${JSON.stringify({ complete: true, report: streamedReport })}\n\n`)
    res.end()
  } catch (err) {
    console.error('SSE Report Stream Error:', err)
    res.write(`data: ${JSON.stringify({ error: err.message || 'Generation failed' })}\n\n`)
    res.end()
  }
}

// Chat / Ask questions about resume & LinkedIn to AI — NOW WITH RAG KNOWLEDGE BASE
// Phase F: this is now a ROUTER agent (Anthropic routing pattern) — it
// classifies the question, loads ONLY the relevant agent's findings, and the
// reply carries deep-links to the report sections it references.

export const CHAT_INTENTS = [
  {
    id: 'resume',
    section: 'resume-ai',
    label: 'AI Resume Diagnosis',
    match: /\b(resume|cv|bullet|rewrite|quantif|ats|summary|keyword|skill|project|experience|achievement)\b/i,
  },
  {
    id: 'linkedin',
    section: 'linkedin-ai',
    label: 'LinkedIn Profile Audit',
    match: /\b(linkedin|headline|about|banner|connection|profile|endorsement|recommendation|boolean|open to work)\b/i,
  },
  {
    id: 'outreach',
    section: 'funnel-risks',
    label: 'Conversion & Outreach Strategy',
    match: /\b(dm|message|cold|outreach|referral|recruiter|network|ghost|response|apply|application|portal|funnel|rate)\b/i,
  },
  {
    id: 'interview',
    section: 'roadmap',
    label: 'Interview & Execution Plan',
    match: /\b(interview|mock|prep|question|star|technical|round|offer|salary|negotiat|behavioral)\b/i,
  },
  {
    id: 'roadmap',
    section: 'roadmap',
    label: '30/60/90 Day Roadmap',
    match: /\b(plan|roadmap|week|day|first|priorit|next step|what (should|do) i do|30|60|90|checklist|action)\b/i,
  },
  {
    id: 'assessment',
    section: 'snapshot',
    label: 'Career Health Snapshot',
    match: /\b(health|score|bottleneck|conversion|stat|overall|diagnos|stuck|barrier)\b/i,
  },
]

export function classifyChatIntent(question = '') {
  for (const intent of CHAT_INTENTS) {
    if (intent.match.test(question)) return intent
  }
  return { id: 'general', section: 'overview', label: 'Executive Overview' }
}

export function formatQuantAnswer(val, unitLabel = '') {
  if (val == null) return 'Not specified'
  if (typeof val === 'number') return `${val} ${unitLabel}`.trim()
  if (typeof val === 'object') {
    if (val.is_na || val.raw === 'N/A') return '0'
    const raw = String(val.raw ?? val.value ?? '').trim()
    const period = String(val.period ?? 'month').trim()
    if (!raw) return '0'
    return `${raw}${unitLabel ? ` ${unitLabel}` : ''} per ${period}`
  }
  return String(val)
}


export const chatResume = async (req, res) => {
  const { userId, question, history = [] } = req.body

  if (!question) {
    return res.status(400).json({ message: 'question is required.' })
  }

  try {
    let user = null
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).lean()
    }
    if (!user) {
      user = await User.findOne().sort({ createdAt: -1 }).lean()
    }
    if (!user) {
      return res.status(404).json({ message: 'Candidate report not found.' })
    }

    const intent = classifyChatIntent(question)
    const r = user.aiReport || {}
    const ans = user.answers || {}
    const ra = r.resume_agent || {}
    const la = r.linkedin_agent || {}
    const resumeData = user.resumeJson || {}

    const candidateName = r.candidateName || user.name || resumeData.candidate_name || 'Candidate'
    const firstName = candidateName.trim().split(/\s+/)[0]
    const targetRole = r.target_role || ans.targetRole || resumeData.target_role || 'Software Engineer'
    const overallScore = r.career_health_score || 79

    const experiences = resumeData.experiences || resumeData.experience || []
    const currentExp = experiences[0] || {}
    const recentCompany = currentExp.company || 'Latest Employer'
    const recentRole = currentExp.role || targetRole
    const allCompanyNames = experiences.map((e) => e.company).filter(Boolean).slice(0, 3).join(', ')

    const verifiedStack = (
      ra.verifiedSkills ||
      ra.dashboard?.keywordAlignment?.matchedInExperience ||
      resumeData.skills ||
      []
    ).slice(0, 8).join(', ')

    const missingStack = (
      ra.missingTargetKeywords ||
      ra.dashboard?.keywordAlignment?.missingFromResume ||
      []
    ).map((s) => (typeof s === 'string' ? s : s?.keyword || s?.name || '')).slice(0, 6).join(', ')

    const topIssueObj = r.critical_issues?.[0] || {}
    const primaryBottleneck = topIssueObj.title || r.funnel_stages?.biggest_leak_stage || 'Profile Alignment'
    const bottleneckFix = topIssueObj.description || topIssueObj.action_steps?.[0] || 'Align LinkedIn experience with resume dates.'

    const topDiscrepancy = la.discrepancies?.[0] || {}
    const discrepancyNote = topDiscrepancy.title
      ? `${topDiscrepancy.title}: ${topDiscrepancy.description || topDiscrepancy.fix || ''}`
      : 'No critical LinkedIn discrepancies found.'

    const weakestBullet =
      (ra.bulletAudit || []).find((b) => b?.tag === 'fix' || b?.status === 'fix')?.originalText ||
      currentExp.bullets?.[0]?.text || currentExp.bullets?.[0] || 'Managed backend services.'

    const week1Plan = r.roadmap?.[0]?.tasks?.slice(0, 2)?.join('; ') || 'Resolve primary profile bottleneck and update LinkedIn.'

    const executiveDossier = `
[CANDIDATE DOSSIER]
- Name: ${firstName} (${candidateName})
- Target Role: ${targetRole} | Health Score: ${overallScore}/100
- Career History: ${allCompanyNames} (Anchor: ${recentRole} at ${recentCompany})
- Verified Skills: ${verifiedStack || 'React, AWS, Microservices, CI/CD'}
- High-Priority Missing Keywords: ${missingStack || 'TypeScript, Spring Boot, Java, Kafka'}
- #1 Primary Bottleneck: "${primaryBottleneck}"
  -> Context & Fix: ${bottleneckFix}
- LinkedIn Flag: ${discrepancyNote}
- Candidate Weakest Bullet to Rewrite: "${weakestBullet}"
- 7-Day Roadmap Focus: ${week1Plan}
`.trim()

    const systemPrompt = `You are "Atlas", ${firstName}'s dedicated Executive Career Coach & Principal Recruiter.
Chat with ${firstName} in real time to solve bottlenecks, rewrite bullets, and prepare for interviews.

RULES:
1. Address ${firstName} directly with sharp, authoritative, encouraging guidance.
2. Keep replies punchy (100–160 words max). Use "- " bullets and **bold key terms**.
3. ACCURACY: Ground every recommendation in their actual background at ${recentCompany}. When asked about "${primaryBottleneck}", cite their real tenure and provide the exact 3-step resolution.
4. READY-TO-PASTE: When providing a rewritten bullet, headline, cold DM, or interview answer, wrap the final copy in triple backticks (\`\`\`text ... \`\`\`) so the UI displays a Copy button.
5. Suggest booking a 1-on-1 strategy call naturally for deeper interview or negotiation practice.`

    const cleanHistory = (Array.isArray(history) ? history.slice(-4) : []).map((m) => ({
      role: m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.text || m.content || '').slice(0, 400),
    }))

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: executiveDossier },
      ...cleanHistory,
      { role: 'user', content: question },
    ]

    const chatReqId = `chat_${userId || 'anon'}_${Date.now()}`
    costTracker.setActiveRunId(chatReqId)

    let replyText = ''
    try {
      // Priority 1: OpenRouter Paid Tier (1.05M Context, Instant 1.5s Response)
      const response = await llmGateway.generate({
        purpose: 'assessment_report',
        task: 'report_chatbot',
        stage: 'REPORT_CHATBOT',
        reqId: chatReqId,
        preferredProvider: 'openrouter',
        model: 'google/gemini-3.5-flash-lite',
        messages: chatMessages,
        responseFormat: 'text',
        temperature: 0.3,
        maxTokens: 800,
        timeoutMs: 25000,
      })
      replyText = response?.text || ''
    } catch (openRouterErr) {
      console.warn('[ChatController] OpenRouter primary failed, trying fallback:', openRouterErr.message)
      try {
        const fallbackResponse = await llmGateway.generate({
          purpose: 'assessment_report',
          task: 'report_chatbot',
          stage: 'REPORT_CHATBOT',
          reqId: chatReqId,
          preferredProvider: 'gemini',
          model: 'gemini-3.5-flash-lite',
          messages: chatMessages,
          responseFormat: 'text',
          temperature: 0.3,
          maxTokens: 800,
          timeoutMs: 20000,
        })
        replyText = fallbackResponse?.text || ''
      } catch (geminiErr) {
        replyText = `Regarding your primary bottleneck with **${primaryBottleneck}**: to fix this immediately, update your LinkedIn Experience section to include your tenure at **${recentCompany}** (${recentRole}) matching your resume dates. This eliminates background check discrepancies.\n\nWould you like me to generate the exact description bullets to paste into your LinkedIn role?`
      }
    }

    let cleanAnswer = (replyText || '').trim()

    // 1. Strip outer code fences if the model wrapped the entire JSON in ```
    const outerMatch = cleanAnswer.match(/^```(?:markdown|text|json|plaintext)?\s*([\s\S]*?)\s*```$/i)
    if (outerMatch) {
      cleanAnswer = outerMatch[1].trim()
    }

    // 2. Extract structured coach_response and format copy_block for CopyableSnippetCard
    if (cleanAnswer.startsWith('{') && cleanAnswer.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleanAnswer)
        if (parsed.coach_response || parsed.copy_block) {
          const responseText = (parsed.coach_response || parsed.answer || parsed.reply || '').trim()
          const copySnippet = parsed.copy_block
            ? `\n\n\`\`\`text\n${parsed.copy_block.replace(/^```(?:text)?\s*|\s*```$/gi, '').trim()}\n\`\`\``
            : ''
          cleanAnswer = `${responseText}${copySnippet}`
        } else if (parsed.answer || parsed.reply) {
          cleanAnswer = (parsed.answer || parsed.reply).trim()
        }
      } catch (_) {}
    }

    costTracker.printRunSummary(chatReqId)

    return res.status(200).json({
      answer: cleanAnswer,
      reply: cleanAnswer,
      sender: 'Atlas',
      routedIntent: intent.label || intent.id,
      sectionLink: intent.section ? (intent.section.startsWith('#') ? intent.section : `#${intent.section}`) : '#overview',
      suggestCall: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in chatResume controller:', error)
    return res.status(200).json({
      answer: 'Atlas is momentarily reviewing candidate files. Please try again in a moment or book your 1-on-1 strategy call below!',
      sender: 'Atlas',
      suggestCall: true,
    })
  }
}

export const handleChatMessage = chatResume

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

// Stream generated standardized Report PDF directly
export const downloadReportPdf = async (req, res) => {
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
    if (!user && userId && userId.includes('@')) {
      user = await User.findOne({ email: userId.toLowerCase().trim() })
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim() })
    }
    if (!user && userId) {
      user = await User.findOne({ _id: userId })
    }

    const directPayload = req.body?.reportData || req.body?.report || null

    if (!user && !directPayload) {
      return res.status(404).json({ message: 'No completed report found for this user.' })
    }

    const effectiveUser = user || {
      name: directPayload?.resume_agent?.candidateSnapshot?.name || directPayload?.user_answers?.fullName || 'Candidate',
      email: email || directPayload?.user_answers?.email || 'candidate@example.com',
      answers: directPayload?.user_answers || {},
      semanticProfile: directPayload?.semantic_profile || null,
      aiReport: directPayload,
    }

    const pdfBuffer = await generateStandardReportPdf({
      user: effectiveUser,
      answers: effectiveUser.answers || {},
      semanticProfile: effectiveUser.semanticProfile || effectiveUser.aiReport?.semantic_profile || null,
      aiReport: effectiveUser.aiReport,
    })

    const candidateName =
      effectiveUser.aiReport?.resume_agent?.candidateSnapshot?.name ||
      effectiveUser.answers?.fullName ||
      effectiveUser.answers?.name ||
      effectiveUser.name ||
      (effectiveUser.email ? effectiveUser.email.split('@')[0] : 'Candidate')
    const safeName = candidateName.replace(/[^a-zA-Z0-9_-]/g, '_')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="Career_GPS_Report_${safeName}.pdf"`)
    return res.send(pdfBuffer)
  } catch (error) {
    console.error('Error in downloadReportPdf controller:', error)
    return res.status(500).json({ message: 'Failed to generate report PDF.' })
  }
}

export const downloadAtsResumeDocx = async (req, res) => {
  try {
    const rawUserId = req.params?.userId || req.query?.userId || req.body?.userId
    const rawEmail = req.query?.email || req.body?.email

    const cleanUserId = (rawUserId && rawUserId !== 'undefined' && rawUserId !== 'null') ? String(rawUserId).trim() : null
    const cleanEmail = (rawEmail && rawEmail !== 'undefined' && rawEmail !== 'null') ? String(rawEmail).toLowerCase().trim() : null

    let user = null
    if (cleanUserId && mongoose.Types.ObjectId.isValid(cleanUserId)) {
      user = await User.findById(cleanUserId)
    }
    if (!user && cleanUserId && cleanUserId.includes('@')) {
      user = await User.findOne({ email: cleanUserId.toLowerCase() })
    }
    if (!user && cleanEmail) {
      user = await User.findOne({ email: cleanEmail })
    }
    if (!user && cleanUserId) {
      user = await User.findOne({ _id: cleanUserId })
    }

    const directPayload = req.body?.reportData || req.body?.canonicalResume ? req.body : null
    if (!user && !directPayload) {
      return res.status(404).json({ message: 'User assessment not found.' })
    }

    const aiReport = user?.aiReport || directPayload?.reportData || {}
    const ra = aiReport.resume_agent || user?.resume_agent || directPayload?.resume_agent || {}
    const rawCanonical = directPayload?.canonicalResume || ra.canonicalResume || user?.resumeJson || {
      candidate_name: user?.name || directPayload?.candidateName || 'Candidate',
      target_role: user?.targetRole || user?.answers?.targetRole || directPayload?.targetRole || 'Professional',
      skills: user?.skills || [],
    }

    const canonical = JSON.parse(JSON.stringify(rawCanonical))
    canonical.target_role = cleanTargetRoleTitle('', canonical.target_role || user.targetRole || user.answers?.targetRole || 'Professional')

    // 1. Executive Summary Rewrite wiring
    const summaryRewrite =
      ra.summaryOptimization?.rewrittenSummary ||
      ra.executiveSummaryRewrite ||
      ra.dashboard?.summaryOptimization?.rewrittenSummary ||
      ra.overallReview?.summary ||
      aiReport.summaryOptimization?.rewrittenSummary ||
      aiReport.executiveSummaryRewrite ||
      null

    if (summaryRewrite) {
      canonical.summary = summaryRewrite
    }

    // 2. Missing target keywords collection and skills injection
    const querySkills = req.query.skills
      ? String(req.query.skills).split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const bodySkills = [
      ...(Array.isArray(req.body?.selectedSkills) ? req.body.selectedSkills : []),
      ...(Array.isArray(req.body?.skills) ? req.body.skills : []),
    ].map((s) => (typeof s === 'string' ? s.trim() : (s?.keyword || s?.name || '').trim())).filter(Boolean)

    const userSelectedSkills = Array.from(new Set([...querySkills, ...bodySkills]))

    const strandedSkillsOnly = (Array.isArray(ra.keywordAlignment?.skillsOnlyUnverified) ? ra.keywordAlignment.skillsOnlyUnverified : [])
      .map((s) => (typeof s === 'string' ? s.trim() : (s?.keyword || s?.name || '').trim()))
      .filter((s) => s && s.length >= 2)

    // Priority: If user selected missing skills, weave ONLY them! If user selected nothing, automatically weave stranded skills from "In Skills Section Only"!
    const rawMissing = userSelectedSkills.length > 0
      ? userSelectedSkills
      : (strandedSkillsOnly.length > 0 ? strandedSkillsOnly : [
          ...(Array.isArray(ra.keywordAlignment?.missingKeywords) ? ra.keywordAlignment.missingKeywords : []),
          ...(Array.isArray(ra.keywordAlignment?.missingFromResume) ? ra.keywordAlignment.missingFromResume : []),
        ])

    const missingSkillsList = []
    const seenKw = new Set()
    for (const item of rawMissing) {
      const kw = typeof item === 'string' ? item.trim() : (item?.keyword || item?.name || item?.skill || '').trim()
      if (kw && kw.length >= 2 && !seenKw.has(kw.toLowerCase())) {
        seenKw.add(kw.toLowerCase())
        missingSkillsList.push(kw)
      }
    }

    // Verified skills injection check: do NOT blindly push unverified missing keywords
    const { appliedKeywords: verifiedApplied = [] } = sanitizeAndValidateResume(
      canonical,
      [],
      missingSkillsList
    )
    const verifiedSet = new Set((verifiedApplied || []).map((a) => a.keyword.toLowerCase().trim()))
    const userSelectedSet = new Set(userSelectedSkills.map((s) => s.toLowerCase().trim()))

    const skillsToInject = []
    for (const kw of missingSkillsList) {
      const kwLow = kw.toLowerCase().trim()
      if (verifiedSet.has(kwLow)) {
        // Demonstrable evidence in corpus: safe to inject directly
        skillsToInject.push(kw)
      } else if (userSelectedSet.has(kwLow)) {
        // Explicitly requested by candidate: append indicator so recruiters do not flag as keyword stuffing
        skillsToInject.push(`${kw} (In-Progress)`)
      }
      // Otherwise unverified and not user-selected: omit to prevent blind keyword stuffing
    }

    if (skillsToInject.length > 0) {
      if (Array.isArray(canonical.skills)) {
        const existing = new Set(
          canonical.skills.map((s) => (typeof s === 'string' ? s.toLowerCase().trim() : (s?.name || '').toLowerCase().trim()))
        )
        for (const kw of skillsToInject) {
          if (!existing.has(kw.toLowerCase())) {
            existing.add(kw.toLowerCase())
            canonical.skills.push(kw)
          }
        }
      } else if (typeof canonical.skills === 'object' && canonical.skills !== null) {
        for (const kw of skillsToInject) {
          const rawKw = kw.replace(/\s*\([^)]*\)$/, '').trim()
          const bucket = determineSkillBucket(rawKw, canonical.target_role || '')
          canonical.skills[bucket] = canonical.skills[bucket] || []
          if (!canonical.skills[bucket].some((s) => (typeof s === 'string' ? s.toLowerCase() : s?.name?.toLowerCase()) === kw.toLowerCase())) {
            canonical.skills[bucket].push(kw)
          }
        }
      } else {
        canonical.skills = [...skillsToInject]
      }
    }

    // 2.5. Prioritize applying the LLM's dynamic bulletRewrites / tailoredBullets directly into canonical experiences FIRST
    const rawDirectRewrites = [
      ...(Array.isArray(ra.bulletRewrites) ? ra.bulletRewrites : []),
      ...(Array.isArray(ra.tailoredBullets) ? ra.tailoredBullets : []),
      ...(Array.isArray(directPayload?.bulletRewrites) ? directPayload.bulletRewrites : []),
      ...(Array.isArray(directPayload?.tailoredBullets) ? directPayload.tailoredBullets : []),
      ...(Array.isArray(ra.dashboard?.bulletAudit) ? ra.dashboard.bulletAudit : []),
      ...(Array.isArray(ra.bulletAudit) ? ra.bulletAudit : []),
    ]

    const upgradedBulletIds = new Set()
    if (rawDirectRewrites.length > 0 && Array.isArray(canonical.experiences)) {
      const rewriteMap = new Map()
      rawDirectRewrites.forEach((rw) => {
        const orig = (rw.originalBullet || rw.original || rw.originalText || rw.sourceText || '').trim().toLowerCase()
        const target = (rw.rewrittenBullet || rw.rewrite || rw.tailoredBullet || rw.text || rw.rewrittenText || '').trim()
        if (orig && target) {
          rewriteMap.set(orig, target)
          if (orig.length >= 35) {
            rewriteMap.set(orig.slice(0, 35), target)
          }
        }
      })

      canonical.experiences.forEach((exp) => {
        if (Array.isArray(exp.bullets)) {
          exp.bullets = exp.bullets.map((b) => {
            const bId = b?.id || null
            const bText = typeof b === 'string' ? b : (b?.text || '')
            const low = bText.trim().toLowerCase()
            const match = rewriteMap.get(low) || (low.length >= 35 ? rewriteMap.get(low.slice(0, 35)) : null)
            if (match) {
              if (bId) upgradedBulletIds.add(bId)
              upgradedBulletIds.add(low)
              return typeof b === 'string' ? match : { ...b, id: bId, text: match }
            }
            return b
          })
        }
      })
    }

    // 3. Smart Single-Batch Natural Bullet Weaver & Interview Defense Integration
    const { tailoredExperiences, interviewLedger } = await batchWeaveBulletsWithLLM({
      experiences: canonical.experiences || canonical.experience || [],
      targetSkills: missingSkillsList,
      targetRole: canonical.target_role || ra.targetRole || user?.answers?.targetRole || 'Software Engineer',
      company: canonical.experiences?.[0]?.company || 'my organization',
      timeoutMs: 15000, // 15s budget ensures LLM finishes without script fallback
    })

    if (tailoredExperiences && tailoredExperiences.length > 0) {
      canonical.experiences = tailoredExperiences
    }

    // Cache updated interview defense ledger on user report
    if (user?.aiReport && interviewLedger && interviewLedger.length > 0) {
      user.aiReport.interview_ledger = interviewLedger
      user.aiReport.interviewLedger = interviewLedger
      if (user.aiReport.resume_agent) {
        user.aiReport.resume_agent.interviewLedger = interviewLedger
      }
      user.markModified?.('aiReport')
      if (typeof user.save === 'function') {
        await user.save().catch((err) => console.warn('Non-fatal: failed to cache interviewLedger:', err.message))
      }
    }

    // 4. Bullet Audit wiring (prioritize dashboard, bulletRewrites, bulletAudit, bulletUpgrades, tailoredBullets)
    const bulletAudit =
      (Array.isArray(ra.dashboard?.bulletAudit) && ra.dashboard.bulletAudit.length > 0)
        ? ra.dashboard.bulletAudit
        : (Array.isArray(ra.bulletRewrites) && ra.bulletRewrites.length > 0)
          ? ra.bulletRewrites
          : (Array.isArray(ra.bulletAudit) && ra.bulletAudit.length > 0)
            ? ra.bulletAudit
            : (Array.isArray(ra.bulletUpgrades) && ra.bulletUpgrades.length > 0)
              ? ra.bulletUpgrades
              : (Array.isArray(ra.tailoredBullets) && ra.tailoredBullets.length > 0)
                ? ra.tailoredBullets
                : []

    const jdKeywords = missingSkillsList.map((kw) => ({ keyword: kw, count: 1 }))
    const { buffer: docxBuffer, pages, mode, warnings, appliedKeywords, pendingKeywords } = await buildAtsTailoredDocx(canonical, bulletAudit, jdKeywords)

    const candidateName = (
      canonical.candidate_name ||
      canonical.name ||
      user?.resumeJson?.candidate_name ||
      user?.name ||
      directPayload?.candidateName ||
      ra.candidateName ||
      'Candidate'
    ).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Candidate'

    const filename = `${candidateName}_Tailored_ATS_Resume.docx`

    if (user) {
      if (!user.aiReport) user.aiReport = {}
      user.aiReport.interview_ledger = interviewLedger
      if (user.resume_agent) user.resume_agent.interviewLedger = interviewLedger
      if (!user.assessmentReport) user.assessmentReport = {}
      if (!user.assessmentReport.resume_agent) user.assessmentReport.resume_agent = {}
      user.assessmentReport.resume_agent.interviewLedger = interviewLedger
      user.assessmentReport.resume_agent.canonicalResume = canonical
      user.resumeJson = canonical
      if (typeof user.markModified === 'function') {
        user.markModified('aiReport')
        user.markModified('assessmentReport')
        user.markModified('resume_agent')
      }
      if (typeof user.save === 'function') {
        try {
          await user.save().catch((saveErr) => console.warn('Could not save user report with interview ledger:', saveErr.message))
        } catch (_saveErr) {
          console.warn('Could not save user report with interview ledger:', _saveErr.message)
        }
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Resume-Pages, X-Resume-Fit-Mode, X-Interview-Ledger-Count, X-Interview-Ledger, X-Tailored-Experiences')
    res.setHeader('X-Interview-Ledger-Count', String(interviewLedger?.length || 0))
    res.setHeader('X-Interview-Ledger', Buffer.from(JSON.stringify(interviewLedger || [])).toString('base64'))
    res.setHeader('X-Tailored-Experiences', Buffer.from(JSON.stringify(tailoredExperiences || [])).toString('base64'))
    res.setHeader('X-Resume-Pages', String(pages))
    res.setHeader('X-Resume-Fit-Mode', mode || 'measured')
    res.setHeader('Content-Length', docxBuffer.length)
    return res.end(docxBuffer)
  } catch (err) {
    console.error('Error generating ATS docx resume:', err)
    return res.status(500).json({ message: 'Failed to generate tailored Word document.', error: err.message })
  }
}

/**
 * Persists activity signals and data from orchestrator assessment results onto User document.
 * @param {Object} user - Mongoose User document
 * @param {Object} assessmentResults - outputs from runCareerAgents / orchestrateAssessment
 */
export function persistAssessmentActivitySignals(user, assessmentResults = {}) {
  if (assessmentResults?.linkedinActivityData) {
    user.linkedinActivityData = assessmentResults.linkedinActivityData
  }
  if (assessmentResults?.linkedinActivitySignals) {
    user.linkedinActivitySignals = assessmentResults.linkedinActivitySignals
  }
  return user
}



