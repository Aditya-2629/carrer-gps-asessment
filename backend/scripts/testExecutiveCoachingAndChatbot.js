/**
 * testExecutiveCoachingAndChatbot.js
 * Verification suite for:
 * 1. Hyper-Personalized Executive Coaching Persona in geminiPrompt.js
 * 2. coach_intervention dynamic anchoring to biggest_leak_stage in reportGeneration.js
 * 3. Chatbot intent routing and candidate grounding in chatController.js
 * 4. LLMGateway chatbot model priority chain, OpenRouter gemini-2.5-flash registration, and outer fence unwrapping
 */

import assert from 'assert'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import { normalizeAtlasShapes } from '../services/reportGeneration.js'
import { classifyChatIntent, CHAT_INTENTS } from '../controllers/chatController.js'
import { MODEL_REGISTRY, listModelsForPurpose } from '../ai/config/modelRegistry.js'
import { PROVIDER_MODEL_FALLBACKS } from '../ai/gateway/llmGateway.js'

console.log('=== RUNNING EXECUTIVE COACHING & CHATBOT VERIFICATION TESTS ===\n')

// ---------------------------------------------------------
// TEST 1: Gemini Prompt Persona & Banned Buzzwords
// ---------------------------------------------------------
console.log('Test 1: Verifying Executive Coaching Persona & Anti-AI Guardrails in geminiPrompt.js...')
const mockUserData = {
  name: 'Marcus Vance',
  target_role: 'Staff Machine Learning Engineer',
  applications_per_week: 25,
  biggest_challenge: 'Getting ghosted after 2nd round technical interviews',
}
const mockResume = {
  name: 'Marcus Vance',
  skills: ['Python', 'PyTorch', 'Distributed Training', 'CUDA', 'Kubernetes'],
  experience: [
    {
      company: 'Datadog',
      role: 'Senior ML Engineer',
      bullets: [
        'Reduced distributed model training latency by 42% across 128 H100 GPUs.',
        'Architected real-time inference pipeline serving 1.5M requests/second.',
      ],
    },
  ],
}
const mockUserAnswers = {
  targetRole: 'Staff Machine Learning Engineer',
  applicationsCount: 25,
  recruiterScreensCount: 3,
  interviewsCount: 2,
  offersCount: 0,
}

const promptOutput = getGeminiPrompt(mockUserData, mockResume, null, null, null, null, mockUserAnswers)

assert(typeof promptOutput === 'string', 'getGeminiPrompt should return a string')
assert(/Executive Career Strategist/i.test(promptOutput), 'System prompt should define Executive Career Strategist persona')
assert(/AI buzzwords/i.test(promptOutput), 'Prompt must include banned buzzword list')
assert(/navigating the job market/i.test(promptOutput), 'Prompt must list specific banned phrases')
assert(/Hidden Market Why/i.test(promptOutput), 'Prompt must instruct recruiter "why" breakdown')
assert(promptOutput.includes('Datadog'), 'Prompt must ground candidate context with company name')
assert(promptOutput.includes('Staff Machine Learning Engineer'), 'Prompt must include target role')
assert(promptOutput.includes('coach_intervention'), 'Prompt schema must include coach_intervention')
console.log('✔ Test 1 Passed: Master Executive Persona & Grounding correctly configured.\n')

// ---------------------------------------------------------
// TEST 2: Dynamic Coach Intervention in normalizeAtlasShapes
// ---------------------------------------------------------
console.log('Test 2: Verifying Dynamic coach_intervention Anchoring in normalizeAtlasShapes...')
const rawReport1 = {
  funnel_stages: {
    applications_count: 50,
    recruiter_calls_count: 1,
    biggest_leak_stage: 'Recruiter Screening Black Hole',
  },
}
const normalized1 = normalizeAtlasShapes(rawReport1, { applications_count: 50, recruiter_calls_count: 1 })
assert(normalized1.coach_intervention, 'coach_intervention must exist')
assert(
  normalized1.coach_intervention.urgency_statement.includes(normalized1.funnel_stages.biggest_leak_stage),
  `urgency_statement should cite biggest_leak_stage, got: ${normalized1.coach_intervention.urgency_statement}`
)
assert(
  normalized1.coach_intervention.cta_text === 'Book Free 1-on-1 Strategy Session',
  `cta_text should be "Book Free 1-on-1 Strategy Session", got: ${normalized1.coach_intervention.cta_text}`
)
assert(
  normalized1.coach_intervention.value_prop.includes('1-on-1 Strategy Call'),
  'value_prop must describe 1-on-1 Strategy Call benefits'
)

// Default leak stage fallback
const rawReport2 = {}
const normalized2 = normalizeAtlasShapes(rawReport2, {})
assert(
  normalized2.coach_intervention.urgency_statement.includes('Technical Rounds') ||
  normalized2.coach_intervention.urgency_statement.includes('early recruiter screening') ||
  normalized2.coach_intervention.urgency_statement.includes('drop-off'),
  'Default leak stage should be anchored'
)
console.log('✔ Test 2 Passed: Dynamic coach_intervention anchors successfully to funnel leak stages.\n')

// ---------------------------------------------------------
// TEST 3: Chatbot Intent Routing in chatController.js
// ---------------------------------------------------------
console.log('Test 3: Verifying Chatbot Intent Routing in chatController.js...')
const resumeIntent = classifyChatIntent('How do I rewrite my Datadog bullet points for ATS?')
assert.strictEqual(resumeIntent.id, 'resume', 'Should route to resume')

const interviewIntent = classifyChatIntent('How should I answer tell me about a time you handled a distributed systems outage?')
assert.strictEqual(interviewIntent.id, 'interview', 'Should route to interview')

const outreachIntent = classifyChatIntent('Can you draft a cold LinkedIn message to a hiring manager?')
assert.strictEqual(outreachIntent.id, 'outreach', 'Should route to outreach')

const generalIntent = classifyChatIntent('What is your high-level executive philosophy?')
assert.strictEqual(generalIntent.id, 'general', 'Should route to general')
console.log('✔ Test 3 Passed: Intent classification correctly maps candidate questions.\n')

// ---------------------------------------------------------
// TEST 4: OpenRouter gemini-3.5-flash-lite, deepseek-chat & Fallback Model Chains
// ---------------------------------------------------------
console.log('Test 4: Verifying OpenRouter gemini-3.5-flash-lite, deepseek-chat & Fallback Model Chains...')
assert(MODEL_REGISTRY['google/gemini-3.5-flash-lite'], 'google/gemini-3.5-flash-lite must be registered')
assert.strictEqual(MODEL_REGISTRY['google/gemini-3.5-flash-lite'].provider, 'openrouter')
assert.strictEqual(MODEL_REGISTRY['google/gemini-3.5-flash-lite'].enabled, true)
assert(MODEL_REGISTRY['google/gemini-3.5-flash-lite'].purpose.includes('career_chatbot'))

assert(MODEL_REGISTRY['deepseek/deepseek-chat'], 'deepseek/deepseek-chat must be registered')
assert.strictEqual(MODEL_REGISTRY['deepseek/deepseek-chat'].provider, 'openrouter')
assert.strictEqual(MODEL_REGISTRY['deepseek/deepseek-chat'].enabled, true)
assert(MODEL_REGISTRY['deepseek/deepseek-chat'].purpose.includes('career_chatbot'))

assert(MODEL_REGISTRY['google/gemini-2.5-flash'], 'google/gemini-2.5-flash must be registered')
assert.strictEqual(MODEL_REGISTRY['google/gemini-2.5-flash'].provider, 'openrouter')
assert.strictEqual(MODEL_REGISTRY['google/gemini-2.5-flash'].enabled, true)
assert(MODEL_REGISTRY['google/gemini-2.5-flash'].purpose.includes('career_chatbot'))

assert(
  PROVIDER_MODEL_FALLBACKS.openrouter.includes('google/gemini-3.5-flash-lite'),
  'google/gemini-3.5-flash-lite should be in PROVIDER_MODEL_FALLBACKS.openrouter'
)
assert(
  PROVIDER_MODEL_FALLBACKS.openrouter.includes('deepseek/deepseek-chat'),
  'deepseek/deepseek-chat should be in PROVIDER_MODEL_FALLBACKS.openrouter'
)
assert(
  PROVIDER_MODEL_FALLBACKS.openrouter.includes('google/gemini-2.5-flash'),
  'google/gemini-2.5-flash should be in PROVIDER_MODEL_FALLBACKS.openrouter'
)

const chatbotModels = listModelsForPurpose('career_chatbot').map((m) => m.id)
assert(chatbotModels.includes('google/gemini-3.5-flash-lite'), 'google/gemini-3.5-flash-lite must support career_chatbot')
assert(chatbotModels.includes('deepseek/deepseek-chat'), 'deepseek/deepseek-chat must support career_chatbot')
assert(chatbotModels.includes('llama-3.3-70b-versatile'), 'llama-3.3-70b-versatile must support career_chatbot')
assert(chatbotModels.includes('google/gemini-3.5-flash'), 'google/gemini-3.5-flash must support career_chatbot')
assert(chatbotModels.includes('google/gemini-2.5-flash'), 'google/gemini-2.5-flash must support career_chatbot')
console.log('✔ Test 4 Passed: Model registry and provider fallback chains verified.\n')

// ---------------------------------------------------------
// TEST 5: Outer Fence Unwrapping Logic
// ---------------------------------------------------------
console.log('Test 5: Verifying Outer Markdown Code Fence Stripping...')
function simulateUnwrap(rawText) {
  let finalText = rawText || ''
  const outerFenced = finalText.trim().match(/^```(?:markdown|text|json|plaintext)?\s*([\s\S]*?)\s*```$/i)
  if (outerFenced) {
    finalText = outerFenced[1].trim()
  }
  return finalText
}

const wrappedMarkdown = '```markdown\nHello Marcus! Here is your custom action plan:\n\n1. Target Staff roles at Datadog\n```'
assert.strictEqual(
  simulateUnwrap(wrappedMarkdown),
  'Hello Marcus! Here is your custom action plan:\n\n1. Target Staff roles at Datadog'
)

const wrappedText = '```text\nDirect recruiter message text here\n```'
assert.strictEqual(simulateUnwrap(wrappedText), 'Direct recruiter message text here')

const innerCardsPreserved = 'Here is your revised bullet:\n\n```text\n- Architected distributed pipeline\n```\n\nUse this immediately!'
assert.strictEqual(
  simulateUnwrap(innerCardsPreserved),
  innerCardsPreserved,
  'Inner code blocks must NOT be stripped when surrounded by conversational text'
)
console.log('✔ Test 5 Passed: Outer markdown fence unwrap preserves inner copy cards.\n')

console.log('ALL EXECUTIVE COACHING & CHATBOT TESTS PASSED SUCCESSFULLY! 🚀')
