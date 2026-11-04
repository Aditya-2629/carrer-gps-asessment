/**
 * Chat Controller — Career GPS Executive AI
 *
 * Implements the Hyper-Personalized Executive Coaching Narrative for Atlas Chatbot.
 * Grounded in the candidate's exact data, resume facts, audit findings, and friction points.
 * Employs Hybrid Fast-Tier Execution: Groq primary (<1s) -> OpenRouter failover.
 */

import { llmGateway } from '../ai/gateway/llmGateway.js'
import User from '../models/User.js'
import { buildRAGContext } from '../utils/ragEngine.js'

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

export async function handleChatMessage(req, res) {
  try {
    const rawQuestion = req.body.message || req.body.question || ''
    const conversationHistory = req.body.conversationHistory || req.body.history || []
    const userId = req.user?._id || req.body.userId

    if (!userId || !rawQuestion) {
      return res.status(400).json({ message: 'userId and message/question are required.' })
    }

    const user = await User.findById(userId).lean()
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const report = user.aiReport || {}
    const resumeData = user.resumeJson || {}
    const answers = user.answers || {}

    // Extract core grounding anchors
    const candidateName = user.name || resumeData.candidate_name || resumeData.candidate?.name || 'there'
    const firstName = candidateName.split(' ')[0] || 'there'
    const targetRole = report.target_role || resumeData.target_role || resumeData.candidate?.targetRole || answers.target_role || answers.role || 'your target role'

    // Extract current or recent anchor company
    const rawExp = resumeData.experiences || resumeData.experience || []
    const currentCompany = rawExp[0]?.company || rawExp[0]?.employer || 'your previous company'
    const topRootCause = report.funnel_stages?.biggest_leak_stage || report.risk_heatmap?.critical_risk || answers.biggestChallenge || 'interview drop-offs'

    // Extract verified skills & missing market skills
    const verifiedSkillsList =
      report.resume_agent?.verifiedSkills ||
      report.resume_agent?.dashboard?.keywordAlignment?.matchedInExperience ||
      (Array.isArray(resumeData.skills) ? resumeData.skills.slice(0, 5) : [])
    const topSkills = (Array.isArray(verifiedSkillsList) ? verifiedSkillsList : []).slice(0, 4).join(', ') || 'SQL, Python'

    const missingSkillsList =
      report.resume_agent?.missingTargetKeywords ||
      report.resume_agent?.dashboard?.keywordAlignment?.missingFromResume ||
      []
    const missingSkills = (Array.isArray(missingSkillsList) ? missingSkillsList : []).slice(0, 3).join(', ') || 'modern cloud tools'

    const appsPace = answers.applications_count || answers.appsWeek || 'unspecified'
    const intent = classifyChatIntent(rawQuestion)

    // Optional RAG context enrichment
    let ragKnowledgeContext = ''
    try {
      const ragQuery = `${rawQuestion} ${targetRole} ${topSkills}`
      ragKnowledgeContext = await buildRAGContext(ragQuery)
    } catch (_ragErr) {
      // non-fatal, continue without RAG
    }

    const systemPrompt = `You are Atlas, ${candidateName}'s dedicated Executive Career Coach and Senior Technical Recruiter.
You are speaking directly with ${candidateName} in their live 1-on-1 strategy chat.

CANDIDATE GROUND TRUTH:
- Name: ${candidateName}
- Target Role: ${targetRole}
- Current/Recent Anchor: ${currentCompany}
- Core Verified Stack: ${topSkills}
- Primary Search Bottleneck: ${topRootCause}
- High-Priority Missing Market Skills: ${missingSkills}
- Stated Weekly Application Pace: ${appsPace} applications/period

COACHING RULES:
1. Always address ${firstName} with warmth, intensity, and deep personal context. Never speak in generic abstractions.
2. When ${firstName} asks how to improve their resume, interview answers, or applications:
   - Cite their actual projects and companies (e.g. at ${currentCompany}).
   - Use Google XYZ framing (Accomplished [X], measured by [Y], by doing [Z]).
   - Keep answers punchy, structured (use short bullets), and immediately actionable.
3. Whenever you provide a ready-to-paste bullet rewrite, LinkedIn message, cold outreach, or interview answer, wrap it in a triple backtick block (\`\`\`text ... \`\`\`) so the UI renders a 1-click Copy card.
4. Keep the tone empathetic but fiercely execution-oriented.
5. When appropriate (e.g. complex interview prep, referral outreach, or background flags), naturally advise them:
   "This is exactly what we rehearse in depth during our free 1-on-1 Strategy Session. Make sure you book your slot on the dashboard so we can script this out live."
6. Never exceed 200 words unless explicitly asked for a complete script or template.`

    // Format conversation history
    const historyMessages = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-6).map((m) => ({
          role: m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.text || m.content || '').slice(0, 800),
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

    // Hybrid Fast-Tier Execution: Groq primary (instant <1s response) -> OpenRouter failover
    let replyText = ''
    try {
      const response = await llmGateway.generate({
        purpose: 'career_chatbot',
        preferredProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.4,
        maxTokens: 600,
        timeoutMs: 15000,
      })
      replyText = response.text
    } catch (groqErr) {
      console.warn('[ChatController] Groq fast tier failed, falling back to OpenRouter:', groqErr.message)
      const fallbackResponse = await llmGateway.generate({
        purpose: 'career_chatbot',
        preferredProvider: 'openrouter',
        model: 'google/gemini-3.5-flash',
        messages,
        temperature: 0.4,
        maxTokens: 600,
        timeoutMs: 25000,
        bypassCache: true,
      })
      replyText = fallbackResponse.text
    }

    let cleanAnswer = (replyText || '').trim()
    const outerMatch = cleanAnswer.match(/^```(?:markdown|text|json|plaintext)?\s*([\s\S]*?)\s*```$/i)
    if (outerMatch) {
      cleanAnswer = outerMatch[1].trim()
    }
    if (cleanAnswer.startsWith('{') && cleanAnswer.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleanAnswer)
        if (parsed.answer || parsed.reply) cleanAnswer = parsed.answer || parsed.reply
      } catch (_e) {
        // ignore
      }
    }

    const shouldSuggestCall =
      /(\b(call|strategy session|book|coach|coaching|referral|mock|interview prep|negotiate|offer)\b)/i.test(
        rawQuestion + ' ' + cleanAnswer
      )

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
    return res.status(500).json({
      error: 'Atlas is momentarily reviewing candidate files. Please try again in a moment.',
      message: 'Atlas is momentarily reviewing candidate files. Please try again in a moment.',
    })
  }
}

export const chatResume = handleChatMessage

export default {
  handleChatMessage,
  chatResume,
  classifyChatIntent,
  CHAT_INTENTS,
}
