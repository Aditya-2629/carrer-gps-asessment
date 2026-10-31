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
import { llmGateway } from '../ai/gateway/llmGateway.js'

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
const parseResumeToJSON = async (fileBuffer, mimeType, filename) => {
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
    res.write(`data: ${JSON.stringify({ complete: true, report: aiReport })}\n\n`)
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

  if (!userId || !question) {
    return res.status(400).json({ message: 'userId and question are required.' })
  }

  try {
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const intent = classifyChatIntent(question)
    const r = user.aiReport || {}
    const ans = user.answers || {}

    // 1. Assessment Agent & Funnel Context (Always Included)
    const candidateName =
      r?.resume_agent?.canonicalResume?.contact?.name ||
      user.resumeJson?.candidate_name ||
      ans?.name ||
      'Candidate'
    const firstName = candidateName.trim().split(/\s+/)[0]
    const targetRole =
      r?.assessment_agent?.candidateProfile?.targetRole ||
      ans?.targetRole ||
      r?.resume_json?.target_role ||
      'Target Role'
    const careerHealthScore = `${r?.career_health_score ?? 65}/100 (${r?.score_label || 'Needs Work'})`
    const primaryBottleneck = `${r?.assessment_agent?.primaryBottleneck?.title || r?.critical_issues?.[0]?.title || 'Conversion Bottleneck'} — ${r?.assessment_agent?.primaryBottleneck?.whyItMatters || r?.critical_issues?.[0]?.diagnosis || ''}`

    const questionnaireContext = [
      `- Candidate Name: ${candidateName} (First Name: ${firstName})`,
      `- Target Role: ${targetRole}`,
      `- Overall Career Health Score: ${careerHealthScore}`,
      `- Detected Hiring Phase: ${r?.phase?.name ? `Phase ${r.phase.id}: ${r.phase.name}` : `Phase ${r?.career_journey?.current_phase_id || '?'}`} (${r?.phase?.confidence || 'Active'} Confidence${r?.phase?.isProvisional ? ', Provisional Diagnosis' : ''})`,
      `- Primary Bottleneck: ${primaryBottleneck}`,
      `- Work Authorization / Visa: ${ans?.visa || ans?.visaStatus || 'US Citizen / Green Card'}`,
      `- External Support / Consultancy: ${ans?.externalHelp || '100% Solo'}`,
      `- 30-Day Applications: ${ans?.apps30d || formatQuantAnswer(ans?.appsWeek, 'applications')}`,
      `- 90-Day 8-Stage Funnel: Apps (90d): ${ans?.applications90d || 'N/A'}, Recruiter Screens: ${ans?.recruiterScreens || '0'}, Online Assessments: ${ans?.assessments || '0'}, AI Interviews: ${ans?.aiInterviews || '0'}, Technical Rounds: ${ans?.technicalRounds || '0'}, Final Rounds: ${ans?.finalRounds || '0'}, Offers: ${ans?.offers || '0'}, Joining Status: ${ans?.joiningStatus || 'No Offer Yet'}`,
      `- Primary Drop-Off Stage: ${ans?.DropOffStage || 'Application Black Hole'}`,
      `- Primary Interview Challenge: ${ans?.biggestChallenge || 'N/A'}`,
      `- Biggest Frustration: ${ans?.frustration || 'Low response rate'}`,
      `- Help Needed: ${Array.isArray(ans?.helpNeed) ? ans.helpNeed.join(', ') : (ans?.helpNeed || 'End-to-end strategy')}`,
      r?.assessment_agent?.chatbotContext ? `- Assessment Agent Coach Summary: ${r.assessment_agent.chatbotContext}` : '',
    ].filter(Boolean).join('\n')

    // 2. Resume Agent Intelligence
    const ra = r?.resume_agent
    const resumeScore = `${ra?.dashboard?.score ?? r?.score_breakdown?.resume?.score ?? '?'}/100 (Grade: ${ra?.dashboard?.grade || 'B'})`
    const summaryRewrite = ra?.summaryOptimization?.rewrittenSummary || ra?.overallReview?.summary || ''
    const verifiedKeywords = (ra?.keywordAlignment?.verifiedKeywords || []).map((k) => k.keyword || k).slice(0, 10).join(', ')
    const missingKeywords = (ra?.keywordAlignment?.missingKeywords || []).map((k) => k.keyword || k).join(', ')
    const skillsOnlyKeywords = (ra?.keywordAlignment?.skillsOnlyKeywords || []).map((k) => k.keyword || k).join(', ')

    const weakBullets = (ra?.bulletAudit || [])
      .filter((b) => b && (b.tag === 'fix' || b.tag === 'improve' || b.status === 'fix' || b.status === 'warn'))
      .slice(0, 5)
      .map(
        (b, idx) =>
          `  ${idx + 1}. [${b.company || b.section || b.itemName || 'Role'} - ${b.role || ''}] Original: "${b.originalText || b.text || ''}" | Issue: ${b.issue || b.diagnosis || b.reason || ''} | Ready Rewrite: "${b.rewriteOption || b.rewrite || b.suggestedRewrite || ''}"`
      )
      .join('\n')

    const resumeContext = [
      `Score: ${resumeScore}`,
      summaryRewrite ? `Executive Summary Rewrite: "${summaryRewrite}"` : '',
      verifiedKeywords ? `Verified Skills: ${verifiedKeywords}` : '',
      missingKeywords ? `Missing Target Keywords: ${missingKeywords}` : '',
      skillsOnlyKeywords ? `Skills-Only (Unproven in Bullets): ${skillsOnlyKeywords}` : '',
      weakBullets ? `Weak Bullets to Fix:\n${weakBullets}` : '',
    ].filter(Boolean).join('\n')

    // 3. LinkedIn Agent Intelligence
    const la = r?.linkedin_agent
    const linkedinScore = `${la?.score ?? r?.score_breakdown?.linkedin?.score ?? '?'}/100 (Grade: ${la?.grade || 'B'})`
    const currentHeadline = la?.headline ? `"${la.headline}"` : '""'
    const recommendedHeadline = la?.optimizations?.headlines?.[0]?.headline ? `"${la.optimizations.headlines[0].headline}"` : '""'
    const top3PinnedSkills = (la?.optimizations?.top3PinnedSkills || []).join(', ')
    const keyDiscrepancies = (la?.discrepancies || la?.issues || [])
      .slice(0, 4)
      .map((d) => `${d.title} (${d.recommendation || d.diagnosis || ''})`)
      .join(' | ')

    const linkedinContext = [
      `Score: ${linkedinScore}`,
      `Current Headline: ${currentHeadline}`,
      `Recommended Headline #1: ${recommendedHeadline}`,
      top3PinnedSkills ? `Top 3 Pinned Skills: ${top3PinnedSkills}` : '',
      keyDiscrepancies ? `Key Discrepancies / Fixes: ${keyDiscrepancies}` : '',
    ].filter(Boolean).join('\n')

    // 4. Roadmap & Mission Board (Safely unwrapping r.mission_board)
    const rawMissions = Array.isArray(r?.mission_board)
      ? r.mission_board
      : Array.isArray(r?.mission_board?.missions)
      ? r.mission_board.missions
      : []
    const topMissions = rawMissions.slice(0, 4).map((m) => m.title || m.mission || '').filter(Boolean).join(' | ')

    // Multi-turn conversation history
    const recentHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'CANDIDATE' : 'ATLAS'}:${String(m.text || '').slice(0, 600)}`)
          .join('\n')
      : ''

    // RAG context using question + candidate profile as query
    let ragKnowledgeContext = ''
    try {
      const ragQuery = `${question} ${targetRole} ${verifiedKeywords || ''}`
      ragKnowledgeContext = await buildRAGContext(ragQuery)
    } catch (_ragErr) {
      // non-fatal, continue without RAG
    }

    const systemPrompt = `You are "Atlas", a sharp, warm $2,000/hr Executive Career Coach and Senior Technical Recruiter with 10+ years of engineering hiring experience.
You are advising ${firstName} in real time.

CORE DIRECTIVES:
1. Address the candidate by their first name (${firstName}) and speak like a sharp, warm $2,000/hr Executive Career Coach.
2. Cite their exact companies, metrics, missing keywords, and questionnaire numbers (appsWeek: ${formatQuantAnswer(ans?.appsWeek, 'apps')}, outreach: ${formatQuantAnswer(ans?.outreach, 'messages')}, interviews: ${formatQuantAnswer(ans?.interviews, 'responses')}, DropOffStage: ${ans?.DropOffStage || 'Application Black Hole'}).
3. Whenever the candidate asks for a bullet rewrite, LinkedIn headline/about, cold DM, or interview answer, wrap the ready-to-paste copy inside triple backticks (\`\`\`text ... \`\`\`) so the UI renders a 1-click Copy card for them.
4. Keep explanations concise (100–170 words max) using clean "- " bullet points and "**bold**" key terms.`

    const userPrompt = `CANDIDATE INTELLIGENCE & AGENT FINDINGS:
[1. Assessment Agent & Funnel Context]
${questionnaireContext}

[2. Resume Agent Intelligence]
${resumeContext || 'Resume analysis pending'}

[3. LinkedIn Agent Intelligence]
${linkedinContext || 'LinkedIn analysis pending'}

${topMissions ? `[4. Top Action Missions]\n${topMissions}\n\n` : ''}${ragKnowledgeContext ? `VERIFIED CAREER KNOWLEDGE BASE:\n${ragKnowledgeContext}\n\n` : ''}${recentHistory ? `CONVERSATION HISTORY:\n${recentHistory}\n\n` : ''}CURRENT CANDIDATE QUESTION:
"${question}"

Provide your expert coaching answer following the directives above.`

    let replyText = ''
    try {
      const { text: responseText } = await llmGateway.generate({
        purpose: 'assessment_report',
        task: 'report_chatbot',
        model: 'gemini-3.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: 'text',
        temperature: 0.3,
        maxTokens: 1024,
        maxRetries: 2,
      })
      replyText = responseText
    } catch (err) {
      console.warn('[AssessmentController] Chatbot primary model failed, falling back to Groq:', err.message)
      const { text: fallbackText } = await llmGateway.generate({
        purpose: 'assessment_report',
        task: 'report_chatbot',
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: 'text',
        temperature: 0.3,
        maxTokens: 1024,
        bypassCache: true,
      })
      replyText = fallbackText
    }

    let cleanAnswer = (replyText || '').trim()
    if (cleanAnswer.startsWith('{') && cleanAnswer.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleanAnswer)
        if (parsed.answer) cleanAnswer = parsed.answer
      } catch (_) {}
    }

    const shouldSuggestCall =
      ['outreach', 'interview', 'assessment', 'roadmap'].includes(intent.id) ||
      /\b(call|help|coach|stuck|reject|ghost|interview|offer|salary|strategy)\b/i.test(question) ||
      (Array.isArray(history) && history.filter((m) => m.role === 'user').length >= 2)

    return res.status(200).json({
      answer: cleanAnswer.trim(),
      routedIntent: intent.label,
      sectionLink: `#${intent.section}`,
      suggestCall: shouldSuggestCall,
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
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim() })
    }

    if (!user || !user.aiReport) {
      return res.status(404).json({ message: 'No completed report found for this user.' })
    }

    const pdfBuffer = await generateStandardReportPdf({
      user,
      answers: user.answers || {},
      semanticProfile: user.semanticProfile || user.aiReport?.semantic_profile || null,
      aiReport: user.aiReport,
    })

    const candidateName =
      user.aiReport?.resume_agent?.candidateSnapshot?.name ||
      user.answers?.fullName ||
      user.answers?.name ||
      user.name ||
      (user.email ? user.email.split('@')[0] : 'Candidate')
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
    const rawUserId = req.params?.userId || req.query?.userId
    const rawEmail = req.query?.email

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

    if (!user) {
      return res.status(404).json({ message: 'User assessment not found.' })
    }

    const aiReport = user.aiReport || {}
    const ra = aiReport.resume_agent || user.resume_agent || {}
    const canonical = ra.canonicalResume || user.resumeJson || {
      candidate_name: user.name || 'Candidate',
      target_role: user.targetRole || user.answers?.targetRole || 'Professional',
      skills: user.skills || [],
    }

    const bulletAudit = ra.dashboard?.bulletAudit || ra.bulletAudit || []
    const jdKeywords = aiReport.missing_ats_keywords || ra.keywordAlignment?.missingKeywords || []
    const { buffer: docxBuffer, pages, mode, warnings, appliedKeywords, pendingKeywords } = await buildAtsTailoredDocx(canonical, bulletAudit, jdKeywords)

    const candidateName = (
      canonical.candidate_name ||
      canonical.name ||
      user.resumeJson?.candidate_name ||
      ra.candidateName ||
      'Candidate'
    ).replace(/\s+/g, '_')

    const filename = `${candidateName}_Tailored_ATS_Resume.docx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Resume-Pages, X-Resume-Fit-Mode')
    res.setHeader('X-Resume-Pages', String(pages))
    res.setHeader('X-Resume-Fit-Mode', mode || 'measured')
    res.setHeader('Content-Length', docxBuffer.length)
    return res.end(docxBuffer)
  } catch (err) {
    console.error('Error generating ATS docx resume:', err)
    return res.status(500).json({ message: 'Failed to generate tailored Word document.', error: err.message })
  }
}


