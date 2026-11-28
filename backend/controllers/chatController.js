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
import {
  CRAFTURE_BRAND,
  CAREER_GPS_PHASES,
  CRAFTURE_PROGRAMS,
  CRAFTURE_SAFETY_RULES,
  mapToCareerGpsPhase,
  getCraftureFaqContext,
} from '../utils/craftureKnowledgeBase.js'
import {
  classifyChatIntentWithJev,
  JEV_INTENT_CACHE,
  JEV_CHAT_INTENTS,
} from '../agents/resume/scoring/jevChatIntentClassifier.js'

/**
 * Guardrail: Converts any accidental LLM raw JSON responses into clean conversational Markdown.
 */
export function formatJsonChatResponse(text) {
  if (!text || typeof text !== 'string') return ''
  const trimmed = text.trim()

  const isJsonCandidate =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (/^```(?:json)?\s*\{[\s\S]*\}\s*```$/i.test(trimmed))

  if (!isJsonCandidate) return text

  try {
    const rawJson = trimmed.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim()
    const parsed = JSON.parse(rawJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return text

    const parts = []

    // 1. Primary commentary / conversational text
    const mainText =
      parsed.coach ||
      parsed.coach_response ||
      parsed.response ||
      parsed.message ||
      parsed.answer ||
      parsed.reply ||
      parsed.summary ||
      parsed.overview ||
      ''
    if (mainText && typeof mainText === 'string') {
      parts.push(mainText.trim())
    }

    // 2. Actionable feedback / critique / analysis
    const feedback =
      parsed.actionable_feedback ||
      parsed.feedback ||
      parsed.critique ||
      parsed.analysis ||
      parsed.assessment ||
      ''
    if (feedback && typeof feedback === 'string' && feedback.trim() !== mainText.trim()) {
      parts.push(`### Actionable Feedback\n${feedback.trim()}`)
    }

    // 3. Bullet fix / example / copy block
    const bulletExample =
      parsed.bullet_fix_example ||
      parsed.bullet_example ||
      parsed.copy_block ||
      parsed.rewrite ||
      parsed.example ||
      parsed.sample ||
      ''
    if (bulletExample && typeof bulletExample === 'string') {
      const cleanSnippet = bulletExample.replace(/^```(?:text)?\s*|\s*```$/gi, '').trim()
      parts.push(`### Recommended Bullet Fix\n\`\`\`text\n${cleanSnippet}\n\`\`\``)
    }

    // 4. Tactical next step / recommendation
    const nextStep =
      parsed.tactical_next_step ||
      parsed.next_step ||
      parsed.recommendation ||
      parsed.action_item ||
      ''
    if (nextStep && typeof nextStep === 'string') {
      parts.push(`**Tactical Next Step**: ${nextStep.trim()}`)
    }

    // Fallback: If no recognized keys, format any string key-values nicely
    if (parts.length === 0) {
      const stringValues = Object.entries(parsed)
        .filter(([_, v]) => typeof v === 'string' && v.trim().length > 0)
        .map(([k, v]) => {
          const title = k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
          return `**${title}**:\n${v.trim()}`
        })
      if (stringValues.length > 0) {
        return stringValues.join('\n\n')
      }
    } else {
      return parts.join('\n\n')
    }
  } catch (_) {
    // Return original text if parsing fails
  }

  return text
}

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

export const EXTENDED_CHAT_INTENTS = [
  {
    id: 'pricing',
    section: 'programs-pricing',
    label: 'Programs & Pricing',
    match: /\b(pricing|price|cost|tier|plans?|program|packages?|\$150|\$300|free|starter|elite|subscription|membership|refund|cancel)\b/i,
  },
  {
    id: 'visa',
    section: 'visa-work-auth',
    label: 'Visa & Work Authorization',
    match: /\b(visa|opt|stem opt|cpt|h-?1b|h4|ead|sponsorship|sponsor|work auth|work authorization|uscis|dso|attorney)\b/i,
  },
  {
    id: 'escalation',
    section: 'human-consultant',
    label: 'Human Consultant Escalation',
    match: /\b(human|consultant|coach|speak to a person|advisor|1-on-1|strategy session|talk to someone|book a call)\b/i,
  },
  {
    id: 'phase',
    section: 'career-gps-phase',
    label: '6-Phase Career GPS Framework',
    match: /\b(phase [1-6]|framework|journey|choke point|pipeline stages?|stages? of hiring)\b/i,
  },
]

export function classifyChatIntent(question = '') {
  for (const intent of CHAT_INTENTS) {
    if (intent.match.test(question)) return intent
  }
  for (const intent of EXTENDED_CHAT_INTENTS) {
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

  const rawExp =
    report.resume_agent?.canonicalResume?.experiences ||
    report.resume_agent?.canonicalResume?.experience ||
    resume.experiences ||
    resume.experience ||
    []

  const currentCompany =
    report.resume_agent?.candidateSnapshot?.presentCompany ||
    rawExp[0]?.company ||
    rawExp[0]?.employer ||
    'your previous company'

  const topExperiences = rawExp.slice(0, 3).map((e) => ({
    company: e.company || e.employer || '',
    role: e.role || e.title || '',
    dates: e.dates || e.duration || '',
    bullets: (Array.isArray(e.bullets) ? e.bullets : (e.bullet ? [e.bullet] : []))
      .slice(0, 2)
      .map((b) => (typeof b === 'string' ? b : b?.text || '').slice(0, 140))
      .filter(Boolean),
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
  ).slice(0, 8).map((s) => (typeof s === 'string' ? s : s?.keyword || s?.name || '')).filter(Boolean)

  const discrepancies = (report.linkedin_agent?.discrepancies || []).slice(0, 2).map((d) => d.title || d.diagnosis || '')

  const funnel = {
    applications: report.funnel_stages?.applications_count || answers.applications90d || answers.apps30d || 0,
    recruiterScreens: report.funnel_stages?.recruiter_calls_count || 0,
    technicalRounds: report.funnel_stages?.interviews_count || 0,
    offers: report.funnel_stages?.offers_count || 0,
    biggestLeak: report.funnel_stages?.biggest_leak_stage || report.phase?.name || 'Top of Funnel',
  }

  const candidateName =
    report.resume_agent?.candidateSnapshot?.name ||
    report.resume_json?.candidate?.name ||
    report.resume_json?.candidate_name ||
    resume.candidate?.name ||
    resume.candidate_name ||
    resume.name ||
    report.candidate_name ||
    user?.name ||
    'there'
  const firstName = candidateName.split(' ')[0] || 'there'

  const primaryBottleneck = report.primary_bottleneck?.title || 'ATS Keyword & Targeting Alignment'
  const leakStage = report.funnel_stages?.biggest_leak_stage || report.phase?.name || primaryBottleneck
  const careerGpsPhase = mapToCareerGpsPhase(`${primaryBottleneck} ${leakStage}`)

  const targetRole =
    report.target_role ||
    resume.candidate?.targetRole ||
    answers.targetRole ||
    answers.target_role ||
    'Software Professional'

  const seniorityBand = report.assessment_agent?.seniorityTier || 'Senior'

  // Live Market Intelligence extraction
  const marketContext =
    report.resume_agent?.marketContext ||
    report.market_context ||
    report.marketContext ||
    report.market_reality_check ||
    {}
  const rawDemanded = marketContext.topSkills || marketContext.skills || marketContext.demandedTools || []
  const topDemandedTools = Array.isArray(rawDemanded) && rawDemanded.length > 0
    ? rawDemanded
        .slice(0, 8)
        .map((s) => ({
          tool: typeof s === 'string' ? s : s?.name || s?.tool || '',
          frequency: s?.frequency || s?.percentage ? `${s.frequency || s.percentage}%` : '50%+',
        }))
        .filter((s) => Boolean(s.tool))
    : (report.resume_agent?.missingTargetKeywords || [])
        .slice(0, 5)
        .map((k) => ({
          tool: typeof k === 'string' ? k : k?.keyword || k?.name || '',
          frequency: '65%',
        }))
        .filter((s) => Boolean(s.tool))
  const analyzedJdsCount = marketContext.totalAnalyzed || marketContext.analyzedJds || 35
  const marketIntelligence = {
    topDemandedTools,
    seniorityBand,
    analyzedJdsCount,
    marketSummary: `${seniorityBand} ${targetRole} market demand across ${analyzedJdsCount} analyzed job postings.`,
  }

  // Bullet Audit Gaps extraction (jevBulletTriager / rule-based audit)
  const rawBulletAudit =
    report.resume_agent?.bulletAudit ||
    report.resume_agent?.dashboard?.bulletAudit ||
    report.resume_agent?.bulletRewrites ||
    report.bullet_audit ||
    []
  const bulletGaps = (Array.isArray(rawBulletAudit) ? rawBulletAudit : []).slice(0, 3).map((b) => ({
    bullet: (typeof b === 'string' ? b : b?.bullet || b?.text || b?.original || '').slice(0, 100),
    status: b?.status || (b?.severity === 'high' ? 'fix' : 'warn'),
    issue: b?.issue || b?.diagnosis || b?.reason || 'Missing quantified business metrics',
    recommendation: b?.recommendation || b?.rewrite || 'State the concrete outcome with clear numbers.',
  }))

  // Salary Benchmark calibration
  const salaryBenchmark = {
    seniorityBand,
    targetRole,
    estimatedRange:
      seniorityBand === 'Lead' || seniorityBand === 'Principal'
        ? '$175,000 - $225,000'
        : seniorityBand === 'Senior'
        ? '$145,000 - $185,000'
        : '$115,000 - $145,000',
    equityExpectation: '0.05% - 0.25% or $25k-$60k annual RSU grant',
  }

  return {
    candidateName,
    firstName,
    currentCompany,
    targetRole,
    seniorityTier: seniorityBand,
    careerHealthScore: (typeof report.career_health_score === 'object' && report.career_health_score !== null ? report.career_health_score.overall : report.career_health_score) || report.gps_score || report.overallScore || 70,
    topExperiences,
    verifiedSkills,
    missingSkills,
    discrepancies,
    funnel,
    primaryBottleneck,
    careerGpsPhase,
    marketIntelligence,
    bulletGaps,
    salaryBenchmark,
  }
}

/**
 * Builds the Atlas Executive Career Strategist system prompt.
 * Replaces the obsolete "Max 3-4 sentences" rule with substantive, actionable guidance.
 */
export const buildChatbotSystemPrompt = (dossier = {}, extraContext = '', intentId = null) => {
  const candidateName = dossier.candidateName || 'Candidate'
  const targetRole = dossier.targetRole || dossier.role || 'Software Professional'
  const seniorityTier = dossier.seniorityTier || dossier.seniorityBand || 'Senior'
  const careerHealthScore = dossier.careerHealthScore ?? dossier.overallScore ?? 70
  const topExperiences = dossier.topExperiences || []
  const verifiedSkillsStr = Array.isArray(dossier.verifiedSkills)
    ? dossier.verifiedSkills.join(', ')
    : String(dossier.verifiedSkills || 'N/A')
  const missingSkillsStr = Array.isArray(dossier.missingSkills)
    ? dossier.missingSkills.join(', ')
    : String(dossier.missingSkills || 'N/A')
  const primaryBottleneck = dossier.primaryBottleneck || 'ATS Keyword & Targeting Alignment'
  const careerGpsPhase = dossier.careerGpsPhase || mapToCareerGpsPhase(primaryBottleneck)
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

  const marketIntelligence = dossier.marketIntelligence || {}
  const topDemandedStr = Array.isArray(marketIntelligence.topDemandedTools) && marketIntelligence.topDemandedTools.length > 0
    ? marketIntelligence.topDemandedTools.map((t) => `${t.tool} (${t.frequency})`).join(', ')
    : missingSkillsStr || 'High-demand industry tools'
  const analyzedJds = marketIntelligence.analyzedJdsCount || 35

  const bulletGaps = dossier.bulletGaps || []
  const bulletGapsStr = bulletGaps.length > 0
    ? bulletGaps.map((b, i) => `${i + 1}. [${b.status?.toUpperCase() || 'WARN'}] "${b.bullet.slice(0, 80)}" → Issue: ${b.issue} → Recommendation: ${b.recommendation}`).join('\n')
    : 'No severe bullet gaps detected.'

  const salaryBenchmark = dossier.salaryBenchmark || {
    estimatedRange: '$145,000 - $185,000',
    equityExpectation: '0.05% - 0.25% or $25k-$60k annual RSU grant',
  }

  const extraContextBlock = extraContext ? `\n\n[RELEVANT CRAFTURE FAQS & INTELLIGENCE]\n${extraContext}` : ''

  let intentSpecializedBlock = ''
  if (intentId === 'REWRITE_BULLET') {
    intentSpecializedBlock = `\n\n[INTENT DIRECTIVE: RESUME BULLET REWRITE]
You are fulfilling a bullet rewrite request.
Format your output clearly with:
1. **Original Bullet**: Note the identified issue or passive phrasing.
2. **Optimized Google XYZ Bullet**: Write the exact polished bullet enclosed in \`\`\`text ... \`\`\`.
   - Formula: [Strong Action Verb] + [Context/Architecture/Scale] + [Measurable Business Outcome ($ / % / throughput / latency)].
3. **Weaved Market Keywords**: List which high-penetration target skills were naturally integrated.
4. **Impact Metric Calibration**: Explain why the chosen metric establishes seniority and credibility.`
  } else if (intentId === 'INTERVIEW_PREP') {
    intentSpecializedBlock = `\n\n[INTENT DIRECTIVE: INTERVIEW PREPARATION]
Deliver structured interview coaching using the STAR framework (Situation, Task, Action, Result).
Highlight architectural, business, or organizational trade-offs ("Why this technology or strategy vs the industry alternative?").
If the discussion touches on a missing tool (${missingSkillsStr}), enforce the **Acknowledge → Bridge → Prove** formula:
- Acknowledge: Candidly acknowledge no formal production title on the specific proprietary tool.
- Bridge: Connect immediately to an analogous underlying foundation in verified skills (${verifiedSkillsStr}).
- Prove: Demonstrate immediate ability to deploy production-quality outcomes within 48 hours.`
  } else if (intentId === 'EXPLAIN_SCORE') {
    intentSpecializedBlock = `\n\n[INTENT DIRECTIVE: SCORE DECONSTRUCTION]
Explain the candidate's Career Health Score (${careerHealthScore}/100) with radical transparency.
Deconstruct it into:
1. Resume & Credibility Impact: Quantified metric density and action verb ownership.
2. Market & ATS Alignment: Coverage against the ${analyzedJds} analyzed target JDs (${missingSkillsStr || 'Core stacks verified'}).
3. Funnel Velocity: Stage of maximum drop-off (${funnel.biggestLeak}) and its primary root cause (${primaryBottleneck}).
Never apologize or be defensive; provide the concrete math and the immediate 2–3 actions to reclaim 15–25 points.`
  } else if (intentId === 'SALARY_BENCHMARK') {
    intentSpecializedBlock = `\n\n[INTENT DIRECTIVE: COMPENSATION & SALARY BENCHMARK]
Ground your advice strictly in the candidate's calibrated salary benchmark:
- Target Role: ${targetRole} (${seniorityTier} band)
- Calibrated Base Salary Range: ${salaryBenchmark.estimatedRange}
- Equity / Incentive Benchmark: ${salaryBenchmark.equityExpectation}
Instruct the candidate on executive compensation leverage:
1. Never disclose current salary or state a fixed number first.
2. Anchor expectations at the top quartile of the market range.
3. Batch counter-offers across total compensation (base, signing bonus, RSUs, remote flexibility).`
  } else if (intentId === 'PROGRAM_PRICING') {
    intentSpecializedBlock = `\n\n[INTENT DIRECTIVE: CRAFTURE PROGRAMS & PRICING]
Explicitly quote Crafture's 3 official transparent programs:
1. Starter Experience ($0 Free Forever): 100-Point Weighted Career Health Report, ATS audit, LinkedIn cross-diagnosis, bottleneck breakdown, and 7-day triage.
2. Career GPS AI ($150/month): Tailored resume generator, automated tracking, cold InMail generators, and live AI interview drills. Cancel anytime.
3. Elite ($300/month): Dedicated U.S.-based executive talent consultant, bi-weekly 1-on-1 strategy sessions, live mock interview critiques, complete resume overhaul, and hands-on salary negotiation representation. Cancel anytime.
Strictly emphasize: Crafture charges 0% salary cuts and zero post-placement commission. Transparent monthly subscription.`
  } else if (intentId === 'VISA_GUIDANCE') {
    intentSpecializedBlock = `\n\n[INTENT DIRECTIVE: VISA & WORK AUTHORIZATION GUIDANCE]
Deliver actionable career strategy for international candidates navigating U.S. hiring:
- OPT (12-month) & STEM OPT (24-month extension): How to maximize the 90/150-day unemployment clock and target E-Verify employers.
- H-1B lottery strategy: Balancing cap-subject vs cap-exempt employers (universities, research non-profits).
- Direct outreach filtering to bypass automated ATS visa screening filters.
MANDATORY LEGAL DISCLAIMER: You must always explicitly state that this advice represents strategic career coaching and process education, not legal immigration advice, and advise the candidate to consult their DSO or a licensed U.S. immigration attorney.`
  } else if (intentId === 'GENERAL_CAREER_ADVICE') {
    intentSpecializedBlock = `\n\n[INTENT DIRECTIVE: EXECUTIVE CAREER TRIAGE]
Provide rapid, high-impact career triage aligned directly with the candidate's primary bottleneck (${primaryBottleneck}) and current hiring stage (Phase ${careerGpsPhase.number}: ${careerGpsPhase.name}). Provide high-leverage guidance and end with 1 focused tactical next step.`
  }

  const expSummary = topExperiences.length > 0
    ? topExperiences.map((e) => `* ${e.company} (${e.role}, ${e.dates}): ${e.bullets.join('; ') || 'No bullets listed'}`).join('\n')
    : 'No work history provided.'

  return `You are "Atlas", a friendly senior career coach on the Crafture team.
We help professionals get hired across engineering, data, product, healthcare, finance, marketing, and operations.
You speak as a core Crafture team member using "we", "our", and "us" when describing our services, and direct personal coaching ("you", "your") for the candidate.
You are chatting with ${candidateName}, who is targeting "${targetRole}" (${seniorityTier} level, Current Score: ${careerHealthScore}/100).

CANDIDATE SUMMARY (USE REAL FACTS ONLY — NEVER MAKE UP EXPERIENCE):
- Target Role: ${targetRole} (${seniorityTier})
- Score: ${careerHealthScore}/100
- Hiring Stage: Phase ${careerGpsPhase.number} (${careerGpsPhase.name})
- Recent Experience:
${expSummary}
- Verified Skills: ${verifiedSkillsStr || 'N/A'}
- Missing Skills to Add: ${missingSkillsStr || 'N/A'}
- Top In-Demand Tools (${analyzedJds} JDs): ${topDemandedStr}
- Key Bullet Fixes:
${bulletGapsStr}
- Salary Range: ${salaryBenchmark.estimatedRange}
- Main Roadblock: ${primaryBottleneck}
- Funnel Stats: ${funnel.applications} apps → ${funnel.recruiterScreens} screens → ${funnel.technicalRounds} techs → ${funnel.offers} offers (${funnel.biggestLeak})
- Profile Notes: ${discrepanciesStr || 'None detected'}

CRAFTURE'S 6 HIRING STEPS:
1. Resume & ATS Setup: Clear layout, matching skills, no fluff.
2. Applications to Phone Screens: 40-60 targeted apps/week + direct messages.
3. Screens to First Interviews: Quick pitch and role clarity.
4. Interviews to Final Rounds: Clear STAR stories with real metrics.
5. Final Rounds to Offers: Strong closing and smart pay negotiation.
6. Offer to Start Date: Clean background check and onboarding.

CRAFTURE PLANS & PRICING:
- Starter ($0 Free): Career Health Report, ATS audit, LinkedIn check, 7-day plan.
- Career GPS AI ($150/mo): Tailored resumes, tracker, outreach templates, interview drills. Cancel anytime.
- Elite ($300/mo): Dedicated human coach, 1-on-1 calls, mock interviews, salary negotiation help. Cancel anytime.
Strict rule: Only mention these three plans. Never mention cuts of salary or placement fees.

RULES & PLAIN-ENGLISH STYLE (MANDATORY):
0. CONVERSATIONAL MARKDOWN ONLY (NEVER JSON): Always respond in natural, short conversational Markdown. NEVER output raw JSON objects, JSON keys, or { "coach": ... } structures.
1. PLAIN-ENGLISH STYLE: Write in simple, clear, everyday English that anyone can read and understand in one glance. Use short sentences and common words. Strictly ban AI/corporate buzzwords (no leverage, utilize, spearhead, holistic, synergy, paradigm, trajectory, delve, foster, robust, elevate, optimize, ecosystem, actionable insights, or stiff academic phrasing). Keep all answers short, direct, friendly, and practical.
2. ZERO GUARANTEES: Never promise or guarantee a job offer or interview.
3. VISA ADVICE: For visa questions (OPT, STEM, H-1B), share helpful tips but remind them to check with their DSO or an immigration lawyer.
4. READY-TO-USE EXAMPLES: When asked to write a bullet or message, write the EXACT ready-to-copy text in a \`\`\`text ... \`\`\` block.
5. NEXT STEP: End every response with 1 simple, natural next step or question.${intentSpecializedBlock}${extraContextBlock}`
}

/**
 * Streams tokens from OpenRouter completions with SSE chunks.
 */
async function streamFromOpenRouter({ model = 'google/gemini-2.5-flash-lite', messages, onToken, timeoutMs = 20000 }) {
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
      max_tokens: 800,
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
      max_tokens: 800,
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
    const rawQuestion = String(req.body?.message || req.body?.question || '').trim().slice(0, 600)
    const conversationHistory = req.body?.conversationHistory || req.body?.history || []
    const userId = req.user?._id || req.userId || req.body?.userId || req.query?.userId

    if (!rawQuestion) {
      return res.status(400).json({ success: false, message: 'message or question is required.' })
    }

    // Strict Security Guard: Never leak latest user's dossier
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Session expired or user not found. Please reload your report.' })
    }

    const user = await User.findById(userId).lean()
    if (!user) {
      return res.status(401).json({ success: false, message: 'Session expired or user not found. Please reload your report.' })
    }

    const dossier = extractCandidateDossier(user)

    // Optional RAG context enrichment with 2s timeout guard
    let ragKnowledgeContext = ''
    try {
      const ragQuery = `${rawQuestion} ${dossier.targetRole} ${dossier.verifiedSkills.slice(0, 3).join(' ')}`
      ragKnowledgeContext = await Promise.race([
        buildRAGContext(ragQuery),
        new Promise((_, reject) => setTimeout(() => reject(new Error('RAG timeout')), 2000)),
      ])
    } catch (_ragErr) {}

    const faqContext = getCraftureFaqContext(rawQuestion)
    let intentId = 'GENERAL_CAREER_ADVICE'
    try {
      const classified = await classifyChatIntentWithJev(rawQuestion)
      intentId = classified?.intent || 'GENERAL_CAREER_ADVICE'
    } catch (_clErr) {
      intentId = 'GENERAL_CAREER_ADVICE'
    }

    const combinedExtraContext = [ragKnowledgeContext, faqContext].filter(Boolean).join('\n\n')
    const systemPrompt = buildChatbotSystemPrompt(dossier, combinedExtraContext, intentId)

    // Sliding memory window: keep only last 6 turns; expand truncation to 800 chars for bullet memory
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
      { role: 'user', content: String(userMessageContent).slice(0, 1200) },
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
        console.warn('[ChatController] Groq streaming fallback failed, trying OpenRouter DeepSeek Chat:', groqErr.message)
        // Tertiary: OpenRouter DeepSeek Chat
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
        const text = formatJsonChatResponse(fallbackRes.text || '')
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
    const rawQuestion = String(req.body?.message || req.body?.question || '').trim().slice(0, 600)
    const conversationHistory = req.body?.conversationHistory || req.body?.history || []
    const userId = req.user?._id || req.userId || req.body?.userId || req.query?.userId

    if (!rawQuestion) {
      return res.status(400).json({ success: false, message: 'message or question is required.' })
    }

    // Strict Security Guard: Never leak latest user's dossier
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Session expired or user not found. Please reload your report.' })
    }

    const user = await User.findById(userId).lean()
    if (!user) {
      return res.status(401).json({ success: false, message: 'Session expired or user not found. Please reload your report.' })
    }

    const dossier = extractCandidateDossier(user)
    const intent = classifyChatIntent(rawQuestion)

    // Optional RAG context enrichment with 2s timeout guard & Crafture FAQ injection
    let ragKnowledgeContext = ''
    try {
      const ragQuery = `${rawQuestion} ${dossier.targetRole} ${dossier.verifiedSkills.slice(0, 3).join(' ')}`
      ragKnowledgeContext = await Promise.race([
        buildRAGContext(ragQuery),
        new Promise((_, reject) => setTimeout(() => reject(new Error('RAG timeout')), 2000)),
      ])
    } catch (_ragErr) {}

    const faqContext = getCraftureFaqContext(rawQuestion)
    let intentId = 'GENERAL_CAREER_ADVICE'
    try {
      const classified = await classifyChatIntentWithJev(rawQuestion)
      intentId = classified?.intent || 'GENERAL_CAREER_ADVICE'
    } catch (_clErr) {
      intentId = 'GENERAL_CAREER_ADVICE'
    }
    const combinedExtraContext = [ragKnowledgeContext, faqContext].filter(Boolean).join('\n\n')
    const systemPrompt = buildChatbotSystemPrompt(dossier, combinedExtraContext, intentId)

    // Sliding memory window: last 6 turns, expanded to 800 chars for bullet memory
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
      { role: 'user', content: String(userMessageContent).slice(0, 1200) },
    ]

    const chatReqId = `chat_${user._id}_${Date.now()}`
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
        maxTokens: 800,
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
          maxTokens: 800,
          timeoutMs: 15000,
        })
        replyText = fallbackResponse.text
      } catch (groqErr) {
        console.warn('[ChatController] Groq fallback failed, falling back to DeepSeek Chat:', groqErr.message)
        // Priority 3: OpenRouter DeepSeek Chat
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

    let cleanAnswer = formatJsonChatResponse(replyText || '')

    // Strip outer code fences if wrapped entirely in ```
    const outerMatch = cleanAnswer.match(/^```(?:markdown|text|json|plaintext)?\s*([\s\S]*?)\s*```$/i)
    if (outerMatch) {
      cleanAnswer = formatJsonChatResponse(outerMatch[1].trim())
    }

    const shouldSuggestCall =
      /(\b(call|strategy session|book|coach|coaching|referral|mock|interview prep|negotiate|offer|elite|human|consultant|pricing|program)\b)/i.test(
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
  classifyChatIntentWithJev,
  JEV_CHAT_INTENTS,
  JEV_INTENT_CACHE,
  extractCandidateDossier,
  buildChatbotSystemPrompt,
  CHAT_INTENTS,
  EXTENDED_CHAT_INTENTS,
}
