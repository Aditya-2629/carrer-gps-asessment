/**
 * Chat Controller — Career GPS Executive AI ("Atlas Copilot")
 *
 * Implements the Gemini-grade Executive Coaching Narrative for Atlas Chatbot.
 * Grounded in the candidate's exact Context Dossier (~1,200 tokens: past companies,
 * actual resume bullets, missing target skills, LinkedIn discrepancies, and funnel numbers).
 *
 * Routing:
 *   - Primary: OpenRouter 'google/gemini-3.5-flash-lite' ($0.15/1M tokens, sub-cent)
 *   - Secondary Failover: Groq 'openai/gpt-oss-120b' (sub-second response)
 *   - Tertiary Failover: OpenRouter 'deepseek/deepseek-chat'
 *
 * Endpoints:
 *   - handleChatStream: SSE token streaming (/api/assessment/chat-stream)
 *   - handleChatMessage: Non-streaming JSON fallback (/api/assessment/resume-talk)
 */

import mongoose from 'mongoose'
import { llmGateway } from '../ai/gateway/llmGateway.js'
import User from '../models/User.js'
import { buildRAGContext } from '../utils/ragEngine.js'
import { costTracker } from '../utils/costTracker.js'

export const CHAT_INTENTS = [
  {
    id: 'interview',
    section: 'interview-prep',
    label: 'Interview Strategy',
    match: /\b(interview|interviews|behavioral|star method|mock|screen|final round|tell me about a time|interview question|interview answer|answer)\b/i,
  },
  {
    id: 'outreach',
    section: 'funnel-analysis',
    label: 'Funnel & Outreach',
    match: /\b(outreach|cold email|cold message|cold dm|hiring manager|referral|networking|funnel|bottleneck|ghosting)\b/i,
  },
  {
    id: 'linkedin',
    section: 'linkedin-audit',
    label: 'LinkedIn Diagnostic',
    match: /\b(linkedin|headline|about section|linkedin profile|social presence)\b/i,
  },
  {
    id: 'resume',
    section: 'resume-ai',
    label: 'AI Resume Diagnosis',
    match: /\b(resume|cv|bullet|bullets|rewrite|quantif|ats|summary section|keyword alignment|work history)\b/i,
  },
  {
    id: 'roadmap',
    section: 'action-plan',
    label: '7-Day Action Plan',
    match: /\b(action plan|roadmap|next steps|week \d|priorities|checklist|schedule)\b/i,
  },
]

export function classifyChatIntent(question = '') {
  for (const intent of CHAT_INTENTS) {
    if (intent.match.test(question)) return intent
  }
  return { id: 'general', section: 'overview', label: 'Executive Overview' }
}

/**
 * Extracts high-signal candidate facts into a structured ~1,200-token Context Dossier.
 */
export function extractCandidateDossier(user = {}) {
  const report = user?.aiReport || {}
  const resume = user?.resumeJson || report?.resume_json || {}
  const answers = user?.answers || {}

  const rawExp = resume.experiences || resume.experience || []
  const topExperiences = rawExp.slice(0, 3).map((e) => ({
    company: e.company || e.employer || '',
    role: e.role || e.title || '',
    dates: e.dates || e.duration || '',
    bullets: (Array.isArray(e.bullets) ? e.bullets : (e.bullet ? [e.bullet] : [])).slice(0, 4).map((b) => (typeof b === 'string' ? b : b?.text || '')),
  }))

  const verifiedSkills = (
    report.resume_agent?.verifiedSkills ||
    report.resume_agent?.dashboard?.keywordAlignment?.matchedInExperience ||
    (Array.isArray(resume.skills) ? resume.skills : [])
  ).slice(0, 10).map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)

  const missingSkills = (
    report.resume_agent?.missingTargetKeywords ||
    report.resume_agent?.dashboard?.keywordAlignment?.missingFromResume ||
    []
  ).slice(0, 6).map((s) => (typeof s === 'string' ? s : s?.keyword || s?.name || '')).filter(Boolean)

  const discrepancies = (report.linkedin_agent?.discrepancies || []).slice(0, 3).map((d) => d.title || d.diagnosis || '')

  const funnel = {
    applications: report.funnel_stages?.applications_count || answers.applications90d || answers.apps30d || 0,
    recruiterScreens: report.funnel_stages?.recruiter_calls_count || 0,
    technicalRounds: report.funnel_stages?.interviews_count || 0,
    offers: report.funnel_stages?.offers_count || 0,
    biggestLeak: report.funnel_stages?.biggest_leak_stage || report.phase?.name || 'Top of Funnel',
  }

  return {
    candidateName: user?.name || resume.candidate?.name || 'Candidate',
    targetRole: report.target_role || resume.candidate?.targetRole || answers.targetRole || answers.target_role || 'Software Professional',
    seniorityTier: report.assessment_agent?.seniorityTier || 'Senior',
    careerHealthScore: report.career_health_score || report.gps_score || report.overallScore || 70,
    topExperiences,
    verifiedSkills,
    missingSkills,
    discrepancies,
    funnel,
    primaryBottleneck: report.primary_bottleneck?.title || 'ATS Keyword & Targeting Alignment',
  }
}

/**
 * Builds the Atlas Executive Career Strategist system prompt.
 * Replaces the obsolete "Max 3-4 sentences" rule with substantive, actionable guidance.
 */
export const buildChatbotSystemPrompt = (dossier = {}) => {
  const candidateName = dossier.candidateName || 'Candidate'
  const targetRole = dossier.targetRole || dossier.role || 'Software Professional'
  const seniorityTier = dossier.seniorityTier || 'Senior'
  const careerHealthScore = dossier.careerHealthScore ?? dossier.overallScore ?? 70
  const topExperiences = dossier.topExperiences || []
  const verifiedSkillsStr = Array.isArray(dossier.verifiedSkills)
    ? dossier.verifiedSkills.join(', ')
    : String(dossier.verifiedSkills || 'N/A')
  const missingSkillsStr = Array.isArray(dossier.missingSkills)
    ? dossier.missingSkills.join(', ')
    : String(dossier.missingSkills || 'N/A')
  const primaryBottleneck = dossier.primaryBottleneck || 'ATS Keyword & Targeting Alignment'
  const funnel = dossier.funnel || {
    applications: 0,
    recruiterScreens: 0,
    technicalRounds: 0,
    offers: 0,
    biggestLeak: 'Top of Funnel',
  }
  const discrepanciesStr = Array.isArray(dossier.discrepancies)
    ? dossier.discrepancies.join('; ')
    : String(dossier.discrepancies || 'None detected')

  return `You are "Atlas", an elite Executive Technical Career Strategist and Veteran Silicon Valley Technical Recruiter.
You are live-coaching ${candidateName}, an accomplished ${seniorityTier} targeting "${targetRole}" (Current Career Health Score: ${careerHealthScore}/100).

CANDIDATE DOSSIER (USE EXACT FACTS — NEVER INVENT FICTIONAL WORK):
- Target Role: ${targetRole} (${seniorityTier} band)
- Overall Score: ${careerHealthScore}/100
- Verified Work History:
${JSON.stringify(topExperiences, null, 2)}
- Core Verified Skills: ${verifiedSkillsStr || 'N/A'}
- Verified Skills: ${verifiedSkillsStr || 'N/A'}
- High-Priority Missing Market Skills: ${missingSkillsStr || 'N/A'}
- Missing Market Skills: ${missingSkillsStr || 'N/A'}
- Primary Sourcing Bottleneck: ${primaryBottleneck}
- Primary Bottleneck: ${primaryBottleneck}
- Funnel Reality: ${funnel.applications} apps → ${funnel.recruiterScreens} screens → ${funnel.technicalRounds} techs → ${funnel.offers} offers (${funnel.biggestLeak})
- Cross-Document Discrepancies: ${discrepanciesStr || 'None detected'}

EXECUTIVE COACHING VOICE & RULES:
1. Speak directly ("you", "your"). Be direct, intellectually rigorous, candid, and encouraging. Never sound like a bland generic AI assistant.
2. BAN CORPORATE FILLER: Never write "navigating the job market", "delve", "it is crucial", "in conclusion", or "testament to".
3. PROVIDE EXACT SOLUTIONS: When asked to fix a bullet or write a message, write the EXACT ready-to-paste text inside fenced blocks (\`\`\`text ... \`\`\`).
   - Bullet formula: Google XYZ format: [Strong Action Verb] + [Context/Architecture/Scale] + [Measurable Business Outcome ($ / % / throughput / latency)] (matching [Action Verb] + [Context/Tech Stack] + [Measurable Business Outcome]).
   - InMail formula: Max 50-75 words, zero fluff, referencing a shared technical challenge or recent engineering initiative.
   - Interview prep: Deliver structured STAR answers highlighting architectural trade-offs ("Why this tool vs alternative?").
4. THE ADDICTIVE CURIOSITY LOOP: Conclude every substantive response with 1 compelling, natural tactical next step (e.g., "Want me to run a mock interview drill on this system design trade-off, or draft an InMail to engineering managers at your target companies?").`
}

/**
 * Streams tokens from OpenRouter completions with SSE chunks.
 */
async function streamFromOpenRouter({ model = 'google/gemini-3.5-flash-lite', messages, onToken, timeoutMs = 20000 }) {
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim()
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://careergps.ai',
      'X-Title': 'CareerGPS Atlas Copilot',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(':')) continue
      if (trimmed === 'data: [DONE]') return
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6).trim()
        if (jsonStr === '[DONE]') return
        try {
          const parsed = JSON.parse(jsonStr)
          const token = parsed.choices?.[0]?.delta?.content || ''
          if (token) onToken(token)
        } catch (_) {}
      }
    }
  }
}

/**
 * Secondary streaming failover via Groq (GPT-OSS 120B).
 */
async function streamFromGroq({ model = 'openai/gpt-oss-120b', messages, onToken, timeoutMs = 15000 }) {
  const apiKey = (process.env.GROQ_API_KEY || '').trim()
  if (!apiKey) throw new Error('Missing GROQ_API_KEY')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(':')) continue
      if (trimmed === 'data: [DONE]') return
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6).trim()
        if (jsonStr === '[DONE]') return
        try {
          const parsed = JSON.parse(jsonStr)
          const token = parsed.choices?.[0]?.delta?.content || ''
          if (token) onToken(token)
        } catch (_) {}
      }
    }
  }
}

/**
 * Real-Time Token Streaming Handler (SSE: Server-Sent Events)
 * Endpoint: POST /api/assessment/chat-stream
 */
export async function handleChatStream(req, res) {
  try {
    const rawQuestion = req.body.message || req.body.question || ''
    const conversationHistory = req.body.conversationHistory || req.body.history || []
    const userId = req.user?._id || req.body.userId

    if (!rawQuestion) {
      return res.status(400).json({ message: 'message or question is required.' })
    }

    let user = null
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).lean()
    }
    if (!user) {
      user = await User.findOne().sort({ createdAt: -1 }).lean()
    }

    const dossier = extractCandidateDossier(user || {})
    const systemPrompt = buildChatbotSystemPrompt(dossier)

    // Sliding memory window: keep only last 6 turns; truncate user inputs to 300 chars
    const historyMessages = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-6).map((m) => ({
          role: m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.text || m.content || '').slice(0, 300),
        }))
      : []

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: String(rawQuestion).slice(0, 500) },
    ]

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const onToken = (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`)
    }

    let streamedSuccess = false

    // Primary: OpenRouter Gemini 3.5 Flash Lite
    try {
      await streamFromOpenRouter({
        model: 'google/gemini-3.5-flash-lite',
        messages,
        onToken,
        timeoutMs: 20000,
      })
      streamedSuccess = true
    } catch (primaryErr) {
      console.warn('[ChatController] OpenRouter streaming primary failed, trying Groq fallback:', primaryErr.message)
      // Secondary: Groq GPT-OSS 120B
      try {
        await streamFromGroq({
          model: 'openai/gpt-oss-120b',
          messages,
          onToken,
          timeoutMs: 15000,
        })
        streamedSuccess = true
      } catch (groqErr) {
        console.warn('[ChatController] Groq streaming fallback failed, trying OpenRouter DeepSeek:', groqErr.message)
        // Tertiary: OpenRouter DeepSeek V3
        try {
          await streamFromOpenRouter({
            model: 'deepseek/deepseek-chat',
            messages,
            onToken,
            timeoutMs: 25000,
          })
          streamedSuccess = true
        } catch (tertiaryErr) {
          console.warn('[ChatController] Tertiary streaming failed, falling back to non-streaming generation:', tertiaryErr.message)
        }
      }
    }

    // Final safety fallback: non-streaming via llmGateway
    if (!streamedSuccess) {
      try {
        const fallbackRes = await llmGateway.generate({
          purpose: 'assessment_report',
          task: 'report_chatbot',
          stage: 'REPORT_CHATBOT',
          preferredProvider: 'openrouter',
          model: 'google/gemini-3.5-flash-lite',
          messages,
          responseFormat: 'text',
          temperature: 0.3,
          maxTokens: 1024,
          timeoutMs: 20000,
        })
        const text = fallbackRes.text || ''
        onToken(text)
      } catch (err) {
        onToken(`I'm analyzing your profile for **${dossier.targetRole}**. The primary priority is resolving your **${dossier.primaryBottleneck}**. What specific section should we drill down on first?`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[ChatController] Fatal error in handleChatStream:', err)
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Streaming failed' })
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
}

/**
 * Non-Streaming Chat Handler (Backward Compatibility)
 * Endpoint: POST /api/assessment/resume-talk
 */
export async function handleChatMessage(req, res) {
  try {
    const rawQuestion = req.body.message || req.body.question || ''
    const conversationHistory = req.body.conversationHistory || req.body.history || []
    const userId = req.user?._id || req.body.userId

    if (!rawQuestion) {
      return res.status(400).json({ message: 'message or question is required.' })
    }

    let user = null
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).lean()
    }
    if (!user) {
      user = await User.findOne().sort({ createdAt: -1 }).lean()
    }

    const dossier = extractCandidateDossier(user || {})
    const intent = classifyChatIntent(rawQuestion)

    // Optional RAG context enrichment
    let ragKnowledgeContext = ''
    try {
      const ragQuery = `${rawQuestion} ${dossier.targetRole} ${dossier.verifiedSkills.slice(0, 3).join(' ')}`
      ragKnowledgeContext = await buildRAGContext(ragQuery)
    } catch (_ragErr) {}

    const systemPrompt = buildChatbotSystemPrompt(dossier)

    // Sliding memory window: last 6 turns, user turns max 300 chars
    const historyMessages = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-6).map((m) => ({
          role: m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.text || m.content || '').slice(0, 300),
        }))
      : []

    const userMessageContent = ragKnowledgeContext
      ? `[RELEVANT BENCHMARK INTELLIGENCE]\n${ragKnowledgeContext}\n\n[CANDIDATE QUESTION]\n${rawQuestion}`
      : rawQuestion

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessageContent },
    ]

    const chatReqId = `chat_${user?._id || 'anon'}_${Date.now()}`
    costTracker.setActiveRunId(chatReqId)

    let replyText = ''
    try {
      // Priority 1: OpenRouter Gemini 3.5 Flash Lite
      const response = await llmGateway.generate({
        purpose: 'assessment_report',
        task: 'report_chatbot',
        stage: 'REPORT_CHATBOT',
        reqId: chatReqId,
        preferredProvider: 'openrouter',
        model: 'google/gemini-3.5-flash-lite',
        messages,
        responseFormat: 'text',
        temperature: 0.3,
        maxTokens: 1500,
        timeoutMs: 20000,
      })
      replyText = response.text
    } catch (openRouterErr) {
      console.warn('[ChatController] Chatbot primary model failed, falling back to Groq:', openRouterErr.message)
      try {
        // Priority 2: Groq OpenAI GPT-OSS 120B
        const fallbackResponse = await llmGateway.generate({
          purpose: 'assessment_report',
          task: 'report_chatbot',
          stage: 'REPORT_CHATBOT',
          reqId: chatReqId,
          preferredProvider: 'groq',
          model: 'openai/gpt-oss-120b',
          messages,
          responseFormat: 'text',
          temperature: 0.3,
          maxTokens: 1500,
          timeoutMs: 15000,
        })
        replyText = fallbackResponse.text
      } catch (groqErr) {
        console.warn('[ChatController] Groq fallback failed, falling back to DeepSeek:', groqErr.message)
        // Priority 3: OpenRouter DeepSeek V3
        try {
          const tertiaryResponse = await llmGateway.generate({
            purpose: 'assessment_report',
            task: 'report_chatbot',
            stage: 'REPORT_CHATBOT',
            reqId: chatReqId,
            preferredProvider: 'openrouter',
            model: 'deepseek/deepseek-chat',
            messages,
            responseFormat: 'text',
            temperature: 0.3,
            maxTokens: 1500,
            timeoutMs: 20000,
          })
          replyText = tertiaryResponse.text
        } catch (tertiaryErr) {
          replyText = `I'm analyzing your profile for **${dossier.targetRole}**. The most critical priority right now is addressing **${dossier.primaryBottleneck}** with hands-on proof for **${dossier.verifiedSkills.slice(0, 3).join(', ') || 'your core stack'}**.\n\nWhich section of your report would you like to drill down on first?`
        }
      }
    }

    let cleanAnswer = (replyText || '').trim()

    // Strip outer code fences if wrapped entirely in ```
    const outerMatch = cleanAnswer.match(/^```(?:markdown|text|json|plaintext)?\s*([\s\S]*?)\s*```$/i)
    if (outerMatch) {
      cleanAnswer = outerMatch[1].trim()
    }

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

    const shouldSuggestCall =
      /(\b(call|strategy session|book|coach|coaching|referral|mock|interview prep|negotiate|offer)\b)/i.test(
        rawQuestion + ' ' + cleanAnswer
      )

    costTracker.printRunSummary(chatReqId)

    return res.status(200).json({
      answer: cleanAnswer,
      reply: cleanAnswer,
      sender: 'Atlas',
      routedIntent: intent.id,
      sectionLink: intent.section,
      suggestCall: shouldSuggestCall,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[ChatController] Error generating chat response:', err.message)
    return res.status(200).json({
      answer: 'Atlas is momentarily reviewing candidate files. Please try again in a moment or book your 1-on-1 strategy call below!',
      routedIntent: 'Executive Overview',
      sectionLink: '#overview',
      suggestCall: true,
    })
  }
}

export const chatResume = handleChatMessage

export default {
  handleChatMessage,
  handleChatStream,
  chatResume,
  classifyChatIntent,
  extractCandidateDossier,
  buildChatbotSystemPrompt,
  CHAT_INTENTS,
}
