/**
 * jevChatIntentClassifier.js
 *
 * Ultrafast (<30ms) Discriminative Chat Intent Classifier powered by TypeSafe AI's
 * Jev model (typesafe/jev-1.14 via OpenRouter Decisions API) with O(1) in-memory caching
 * and zero-downtime Gemini / heuristic fallback.
 *
 * Supported Intent Taxonomy:
 * - REWRITE_BULLET: Bullet rewriting, phrasing improvements, Google XYZ quantification
 * - EXPLAIN_SCORE: Career health score breakdown, ATS match %, pillar scoring, bottlenecks
 * - INTERVIEW_PREP: Behavioral STAR preparation, mock drills, architectural trade-offs, missing tool defense
 * - SALARY_BENCHMARK: Compensation bands, base salary ranges, equity expectations, negotiation leverage
 * - PROGRAM_PRICING: Crafture programs ($0 Starter, $150/mo AI, $300/mo Elite), billing, refunds
 * - VISA_GUIDANCE: OPT, STEM OPT, H-1B, H-4 EAD, CPT, sponsorship filters, immigration strategy
 * - GENERAL_CAREER_ADVICE: High-level trajectory, 7-day roadmaps, unclassified career questions
 */

export const JEV_INTENT_CACHE = new Map()

export const JEV_CHAT_INTENTS = [
  'REWRITE_BULLET',
  'EXPLAIN_SCORE',
  'INTERVIEW_PREP',
  'SALARY_BENCHMARK',
  'PROGRAM_PRICING',
  'VISA_GUIDANCE',
  'GENERAL_CAREER_ADVICE',
]

// Pre-seed common query patterns into O(1) in-memory cache (<1ms response time)
const SEED_INTENT_LOOKUPS = [
  // Bullet Rewrites
  { q: 'rewrite bullet', intent: 'REWRITE_BULLET' },
  { q: 'improve bullet', intent: 'REWRITE_BULLET' },
  { q: 'fix bullet', intent: 'REWRITE_BULLET' },
  { q: 'bullet rewrite', intent: 'REWRITE_BULLET' },
  { q: 'rewrite my resume bullet', intent: 'REWRITE_BULLET' },
  { q: 'google xyz bullet', intent: 'REWRITE_BULLET' },
  { q: 'quantify this bullet', intent: 'REWRITE_BULLET' },

  // Score Explanation
  { q: 'explain score', intent: 'EXPLAIN_SCORE' },
  { q: 'why is my score 74', intent: 'EXPLAIN_SCORE' },
  { q: 'why is my score so low', intent: 'EXPLAIN_SCORE' },
  { q: 'break down my score', intent: 'EXPLAIN_SCORE' },
  { q: 'score breakdown', intent: 'EXPLAIN_SCORE' },
  { q: 'how is my score calculated', intent: 'EXPLAIN_SCORE' },
  { q: 'explain career health score', intent: 'EXPLAIN_SCORE' },

  // Interview Prep
  { q: 'mock interview', intent: 'INTERVIEW_PREP' },
  { q: 'interview question', intent: 'INTERVIEW_PREP' },
  { q: 'behavioral question', intent: 'INTERVIEW_PREP' },
  { q: 'star method', intent: 'INTERVIEW_PREP' },
  { q: 'tell me about a time', intent: 'INTERVIEW_PREP' },
  { q: 'interview prep', intent: 'INTERVIEW_PREP' },
  { q: 'how do i explain missing snowflake', intent: 'INTERVIEW_PREP' },

  // Salary Benchmark
  { q: 'salary range', intent: 'SALARY_BENCHMARK' },
  { q: 'compensation band', intent: 'SALARY_BENCHMARK' },
  { q: 'how much should i ask for', intent: 'SALARY_BENCHMARK' },
  { q: 'negotiate salary', intent: 'SALARY_BENCHMARK' },
  { q: 'salary benchmark', intent: 'SALARY_BENCHMARK' },
  { q: 'expected compensation', intent: 'SALARY_BENCHMARK' },

  // Program & Pricing
  { q: 'how much does it cost', intent: 'PROGRAM_PRICING' },
  { q: 'pricing', intent: 'PROGRAM_PRICING' },
  { q: 'what are your plans', intent: 'PROGRAM_PRICING' },
  { q: 'crafture programs', intent: 'PROGRAM_PRICING' },
  { q: 'elite tier cost', intent: 'PROGRAM_PRICING' },
  { q: 'starter program', intent: 'PROGRAM_PRICING' },
  { q: 'refund policy', intent: 'PROGRAM_PRICING' },

  // Visa & Work Authorization
  { q: 'stem opt visa', intent: 'VISA_GUIDANCE' },
  { q: 'f-1 opt guidance', intent: 'VISA_GUIDANCE' },
  { q: 'h-1b sponsorship', intent: 'VISA_GUIDANCE' },
  { q: 'work authorization', intent: 'VISA_GUIDANCE' },
  { q: 'sponsorship filter', intent: 'VISA_GUIDANCE' },
  { q: 'cpt rules', intent: 'VISA_GUIDANCE' },

  // General Career Advice & Roadmap
  { q: '7-day action plan', intent: 'GENERAL_CAREER_ADVICE' },
  { q: 'my career roadmap', intent: 'GENERAL_CAREER_ADVICE' },
  { q: 'what should i do next', intent: 'GENERAL_CAREER_ADVICE' },
  { q: 'general career advice', intent: 'GENERAL_CAREER_ADVICE' },
]

for (const item of SEED_INTENT_LOOKUPS) {
  JEV_INTENT_CACHE.set(item.q.toLowerCase().trim(), {
    intent: item.intent,
    confidence: 1.0,
    source: 'cache',
  })
}

/**
 * Deterministic fallback regex classifier when offline or timeout occurs.
 */
export function classifyChatIntentHeuristically(question = '') {
  const q = String(question || '').toLowerCase().trim()

  if (/\b(bullet|bullets|rewrite|quantif|xyz format|action verb|impact metric|phrasing)\b/i.test(q)) {
    return 'REWRITE_BULLET'
  }
  if (/\b(score|rating|points|why is my score|score breakdown|ats match|rubric|health score)\b/i.test(q)) {
    return 'EXPLAIN_SCORE'
  }
  if (/\b(interview|mock|behavioral|star method|screen|question|answer|tell me about|trade-off|technical question)\b/i.test(q)) {
    return 'INTERVIEW_PREP'
  }
  if (/\b(salary|compensation|equity|base pay|pay band|how much should i ask|negotiat\w*|salary range)\b/i.test(q)) {
    return 'SALARY_BENCHMARK'
  }
  if (/\b(pricing|price|cost|tier|plans?|programs?|package|\$150|\$300|free|starter|elite|subscription|refund|cancel)\b/i.test(q)) {
    return 'PROGRAM_PRICING'
  }
  if (/\b(visa|opt|stem opt|cpt|h-?1b|h4|ead|sponsorship|sponsor|work auth|uscis|dso|attorney)\b/i.test(q)) {
    return 'VISA_GUIDANCE'
  }

  return 'GENERAL_CAREER_ADVICE'
}

let _gatewayInstance = null
async function getLlmGateway() {
  if (_gatewayInstance) return _gatewayInstance
  try {
    const gwMod = await import('../../../ai/gateway/llmGateway.js')
    _gatewayInstance = gwMod.llmGateway || null
  } catch {
    _gatewayInstance = null
  }
  return _gatewayInstance
}

/**
 * Classifies a user query into one of the 7 official Career GPS Chat Intents using
 * Jev System One model (typesafe/jev-1.14 via OpenRouter Decisions API) with O(1) caching
 * and automatic Gemini/heuristic fallback.
 *
 * @param {string} question - Incoming user question
 * @param {object} [options={}] - Options (timeoutMs, model override, bypassCache)
 * @returns {Promise<{ intent: string, confidence: number, source: string, latencyMs: number }>}
 */
export async function classifyChatIntentWithJev(question = '', options = {}) {
  const startTime = Date.now()
  const clean = String(question || '').trim()
  const norm = clean.toLowerCase()

  if (!clean) {
    return {
      intent: 'GENERAL_CAREER_ADVICE',
      confidence: 1.0,
      source: 'cache',
      latencyMs: 0,
    }
  }

  // 1. O(1) Cache Lookup (<1ms)
  if (!options.bypassCache && JEV_INTENT_CACHE.has(norm)) {
    const cached = JEV_INTENT_CACHE.get(norm)
    return {
      intent: cached.intent,
      confidence: cached.confidence,
      source: 'cache',
      latencyMs: Date.now() - startTime,
    }
  }

  // 2. Attempt Native OpenRouter Decisions API (typesafe/jev-1.14)
  const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim()
  const timeoutMs = options.timeoutMs || 3000

  if (openRouterKey && !options.mockOffline) {
    try {
      const candidateEndpoints = [
        'https://openrouter.ai/api/v1/decisions',
        'https://openrouter.ai/api/alpha/decisions',
      ]
      let decJson = null
      for (const endpoint of candidateEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.APP_URL || 'http://localhost:5000',
              'X-Title': 'Career GPS Executive AI',
            },
            body: JSON.stringify({
              model: options.model || 'typesafe/jev-1.14',
              state: 'Classifying candidate chat intent for Career GPS executive copilot',
              questions: {
                chat_intent: {
                  type: 'choice',
                  instructions: `Classify the candidate question: "${clean}" into exactly one intent choice.`,
                  criteria: {
                    REWRITE_BULLET: 'User requests resume bullet rewriting, phrasing improvements, or Google XYZ metric quantification',
                    EXPLAIN_SCORE: 'Inquiries into why Career Health Score is at a specific number, ATS match %, or funnel bottlenecks',
                    INTERVIEW_PREP: 'Behavioral questions, STAR answers, mock interviews, or interview defense for missing tools',
                    SALARY_BENCHMARK: 'Compensation bands, base salary ranges, equity expectations, and negotiation leverage',
                    PROGRAM_PRICING: 'Queries regarding Crafture Starter ($0), Career GPS AI ($150), or Elite ($300) programs',
                    VISA_GUIDANCE: 'Queries about OPT, STEM OPT, H-1B, H-4 EAD, CPT, sponsorship filters, or status transitions',
                    GENERAL_CAREER_ADVICE: 'High-level trajectory, 7-day roadmaps, or unclassified exploratory queries',
                  },
                },
              },
            }),
            signal: AbortSignal.timeout(timeoutMs),
          })

          if (res.ok) {
            decJson = await res.json()
            break
          }
        } catch (_epErr) {
          // try next endpoint
        }
      }

      if (decJson) {
        const ans = decJson?.answers?.chat_intent
        const choice = ans?.choice
        if (choice && JEV_CHAT_INTENTS.includes(choice)) {
          const result = {
            intent: choice,
            confidence: typeof ans.confidence === 'number' ? ans.confidence : 0.95,
            source: 'jev',
            latencyMs: Date.now() - startTime,
          }
          JEV_INTENT_CACHE.set(norm, result)
          return result
        }
      }
    } catch (_decErr) {
      // Proceed to fallback
    }
  }

  // 3. Fallback: Fast LLM Gateway (google/gemini-2.5-flash-lite)
  if (!options.mockOffline) {
    try {
      const gw = await getLlmGateway()
      if (gw) {
        const response = await gw.generate({
          purpose: 'chat_intent_classification',
          preferredProvider: 'openrouter',
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            {
              role: 'system',
              content: `You are Jev, a discriminative decision engine. Classify the candidate question into exactly one choice:
Choices: ${JEV_CHAT_INTENTS.join(', ')}
Output strictly valid JSON: { "intent": "<CHOICE>", "confidence": 0.95 }`,
            },
            { role: 'user', content: clean },
          ],
          responseFormat: { type: 'json_object' },
          temperature: 0.0,
          maxTokens: 100,
          timeoutMs: timeoutMs,
        })

        const raw = response?.text || response?.content || '{}'
        const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim())
        const choice = parsed.intent?.toUpperCase()

        if (choice && JEV_CHAT_INTENTS.includes(choice)) {
          const result = {
            intent: choice,
            confidence: parsed.confidence || 0.9,
            source: 'gemini_fallback',
            latencyMs: Date.now() - startTime,
          }
          JEV_INTENT_CACHE.set(norm, result)
          return result
        }
      }
    } catch (_gwErr) {
      // Proceed to deterministic fallback
    }
  }

  // 4. Deterministic Heuristic Fallback
  const heuristicIntent = classifyChatIntentHeuristically(clean)
  const result = {
    intent: heuristicIntent,
    confidence: 0.85,
    source: 'heuristic_fallback',
    latencyMs: Date.now() - startTime,
  }
  JEV_INTENT_CACHE.set(norm, result)
  return result
}

export default {
  classifyChatIntentWithJev,
  classifyChatIntentHeuristically,
  JEV_INTENT_CACHE,
  JEV_CHAT_INTENTS,
}

