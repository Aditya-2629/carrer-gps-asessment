/**
 * Chat Controller — Career GPS Executive AI
 *
 * Implements the Hyper-Personalized Executive Coaching Narrative for Atlas Chatbot.
 * Grounded in the candidate's exact data, resume facts, audit findings, and friction points.
 * Employs Hybrid Fast-Tier Execution: Groq primary (<1s) -> OpenRouter failover.
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
 * High-Speed Chatbot System Prompt Builder
 * Minimizes token usage with conversation context window control and strict brevity enforcement.
 */
export const buildChatbotSystemPrompt = (reportData = {}) => {
  return `You are the CareerGPS Strategy Coach for candidate targeting "${reportData.role || 'your target role'}".
Your job is to answer questions strictly based on the generated evaluation report.

REPORT SNAPSHOT:
- Target Role: ${reportData.role || 'N/A'}
- Overall Score: ${reportData.overallScore ?? 79}/100
- Verified Skills: ${reportData.verifiedSkills?.join(', ') || 'N/A'}
- Missing Market Skills: ${reportData.missingSkills?.join(', ') || 'N/A'}
- Primary Bottleneck: ${reportData.primaryBottleneck || 'N/A'}

RULES:
- Be concise, direct, and constructive (Max 3-4 sentences per response).
- Do not repeat boilerplate greetings. Jump straight to the strategy.
- If asked to rewrite a bullet, use the formula: [Action Verb] + [Context/Tech Stack] + [Measurable Business Outcome], and wrap it in triple backticks (\`\`\`text ... \`\`\`) for the 1-click copy button.
- Do not invent experience or skills not present in the candidate profile.`;
};

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

    const reportData = {
      role: targetRole,
      overallScore: report.overall_score || report.career_health_score || report.overallScore || 79,
      verifiedSkills: Array.isArray(verifiedSkillsList) ? verifiedSkillsList.slice(0, 5) : (topSkills ? topSkills.split(', ') : []),
      missingSkills: Array.isArray(missingSkillsList) ? missingSkillsList.slice(0, 5) : (missingSkills ? missingSkills.split(', ') : []),
      primaryBottleneck: topRootCause,
    }

    const systemPrompt = buildChatbotSystemPrompt(reportData)

    // Format conversation history - control window for strict token brevity
    const historyMessages = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-4).map((m) => ({
          role: m.role === 'agent' || m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.text || m.content || '').slice(0, 400),
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

    // Paid Priority Execution: Gemini 3.5 Flash Lite -> DeepSeek V3 -> Gemini 3 Flash Preview -> Gemini 3.5 Flash
    let replyText = ''
    try {
      // Priority 1: OpenRouter Paid Gemini (1.05M Context, Instant Response)
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
        maxTokens: 1024,
        maxRetries: 2,
        timeoutMs: 30000,
      })
      replyText = response.text
    } catch (openRouterErr) {
      console.warn('[ChatController] Chatbot primary model failed, falling back to OpenRouter flash-preview:', openRouterErr.message)
      try {
        const fallbackResponse = await llmGateway.generate({
          purpose: 'assessment_report',
          task: 'report_chatbot',
          stage: 'REPORT_CHATBOT',
          reqId: chatReqId,
          preferredProvider: 'openrouter',
          model: 'google/gemini-3-flash-preview',
          messages,
          responseFormat: 'text',
          temperature: 0.3,
          maxTokens: 1024,
          timeoutMs: 30000,
        })
        replyText = fallbackResponse.text
      } catch (fallbackErr) {
        console.error('[ChatController] Chatbot fallback model failed:', fallbackErr.message)
        replyText = `I'm analyzing your profile for **${targetRole || 'your target role'}**. Based on your background at **${currentCompany || 'your current company'}**, the most critical priority is proving hands-on impact with **${topSkills || 'your core technical tools'}** while targeting key market requirements.\n\nLet's dive into specifics—which section of your report would you like to drill down on first?`
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
  chatResume,
  classifyChatIntent,
  CHAT_INTENTS,
}
