import assert from 'assert'
import {
  llmGateway,
  PRODUCTION_FALLBACK_CHAIN,
  PROVIDER_MODEL_FALLBACKS,
  TASK_MODEL_ROUTING,
} from '../ai/gateway/llmGateway.js'
import { aiConfig, getAllGroqKeys } from '../ai/config/aiConfig.js'

console.log('=== VERIFYING CLEAN GATEWAY BOOT & ROUTING ===\n')

// 1. Verify llmGateway.providers contains only openrouter and groq
console.log('Test 1: Verifying active gateway providers...')
const activeProviders = Object.keys(llmGateway.providers).sort()
console.log(`- Active providers: ${JSON.stringify(activeProviders)}`)
assert.deepStrictEqual(
  activeProviders,
  ['groq', 'openrouter'],
  `llmGateway.providers must contain only 'groq' and 'openrouter' (got ${JSON.stringify(activeProviders)})`
)
console.log('✔ Test 1 Passed: Only openrouter and groq providers are initialized in LLMGateway.\n')

// 2. Verify PROVIDER_MODEL_FALLBACKS
console.log('Test 2: Verifying PROVIDER_MODEL_FALLBACKS...')
assert.deepStrictEqual(
  PROVIDER_MODEL_FALLBACKS.groq,
  ['openai/gpt-oss-120b'],
  "Groq model fallback must be locked strictly to ['openai/gpt-oss-120b']"
)
assert.ok(
  PROVIDER_MODEL_FALLBACKS.openrouter.includes('google/gemini-2.5-flash-lite'),
  'OpenRouter fallback must include google/gemini-2.5-flash-lite'
)
assert.ok(
  PROVIDER_MODEL_FALLBACKS.openrouter.includes('meta-llama/llama-3.3-70b-instruct'),
  'OpenRouter fallback must include meta-llama/llama-3.3-70b-instruct'
)
assert.strictEqual(
  PROVIDER_MODEL_FALLBACKS.nvidia,
  undefined,
  'NVIDIA must not exist in PROVIDER_MODEL_FALLBACKS'
)
assert.strictEqual(
  PROVIDER_MODEL_FALLBACKS.grok,
  undefined,
  'Grok must not exist in PROVIDER_MODEL_FALLBACKS'
)
console.log('✔ Test 2 Passed: Model fallbacks locked strictly to gpt-oss-120b for Groq and clean list for OpenRouter.\n')

// 3. Verify PRODUCTION_FALLBACK_CHAIN contains zero dead providers
console.log('Test 3: Verifying PRODUCTION_FALLBACK_CHAIN...')
console.log(`- Production fallback chain: ${JSON.stringify(PRODUCTION_FALLBACK_CHAIN)}`)
assert.deepStrictEqual(
  PRODUCTION_FALLBACK_CHAIN,
  ['openrouter', 'groq'],
  "PRODUCTION_FALLBACK_CHAIN must strictly be ['openrouter', 'groq']"
)
console.log('✔ Test 3 Passed: Fallback chain contains zero dead providers.\n')

// 4. Assert that TASK_MODEL_ROUTING maps all stages cleanly
console.log('Test 4: Verifying TASK_MODEL_ROUTING...')
const expectedRouting = {
  jd_extraction: 'google/gemini-2.5-flash-lite',
  fast_catch: 'google/gemini-2.5-flash-lite',
  resume_synthesis: 'google/gemini-2.5-flash-lite',
  bullet_rewrites: 'google/gemini-2.5-flash-lite',
  linkedin_synthesis: 'meta-llama/llama-3.3-70b-instruct',
  thought_leadership: 'meta-llama/llama-3.3-70b-instruct',
  report_generation: 'google/gemini-2.5-flash-lite',
  judge_gate: 'google/gemini-2.5-flash-lite',
}

for (const [task, model] of Object.entries(expectedRouting)) {
  assert.strictEqual(
    TASK_MODEL_ROUTING[task],
    model,
    `TASK_MODEL_ROUTING[${task}] must be "${model}", got "${TASK_MODEL_ROUTING[task]}"`
  )
}
console.log('✔ Test 4 Passed: All 8 pipeline stages mapped to validated models.\n')

// 5. Verify purged configs in aiConfig
console.log('Test 5: Verifying deprecated provider blocks in aiConfig...')
assert.strictEqual(aiConfig.grok, undefined, 'aiConfig.grok must be undefined')
assert.strictEqual(aiConfig.nvidia, undefined, 'aiConfig.nvidia must be undefined')
assert.strictEqual(aiConfig.groq.defaultModel, 'openai/gpt-oss-120b')
assert.strictEqual(aiConfig.groq.primaryModel, 'openai/gpt-oss-120b')
assert.strictEqual(aiConfig.groq.fallbackModel, 'openai/gpt-oss-120b')
assert.ok(aiConfig.openRouter.apiKey.length > 0, 'OpenRouter API key must be configured')

const groqKeys = getAllGroqKeys()
console.log(`- Detected ${groqKeys.length} Groq key(s) in pool.`)
assert.ok(groqKeys.length >= 1, 'At least 1 Groq API key must be available in pool')
console.log('✔ Test 5 Passed: Grok and Nvidia blocks purged, Groq pool and OpenRouter configured cleanly.\n')

console.log('================================================================')
console.log('🚀 CLEAN GATEWAY BOOT & ROUTING VERIFICATION: ALL TESTS PASSED')
console.log('================================================================')
