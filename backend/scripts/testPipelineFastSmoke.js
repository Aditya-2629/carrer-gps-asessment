/**
 * Fast Pipeline Smoke Test
 *
 * Verifies:
 * 1. LLM Gateway OpenRouter high-speed task routing to google/gemini-2.5-flash-lite (<4s latency).
 * 2. SmartKeyPool error differentiation: local Mongoose/code errors throw immediately without penalizing the key.
 * 3. All 8 task stages in TASK_MODEL_ROUTING and clean provider fallbacks.
 */

import assert from 'assert'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../')
dotenv.config({ path: path.join(rootDir, 'backend/.env') })
dotenv.config({ path: path.join(rootDir, '.env') })

import {
  llmGateway,
  TASK_MODEL_ROUTING,
  PROVIDER_MODEL_FALLBACKS,
} from '../ai/gateway/llmGateway.js'
import { apifyKeyPool } from '../utils/smartKeyPool.js'

async function runSmokeTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🚀 PIPELINE FAST SMOKE TEST: UNLOCKED OPENROUTER & SMARTKEYPOOL')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 1. Verify routing table constants
  console.log('--- Test 1: Verifying Task Model Routing Table ---')
  assert.strictEqual(TASK_MODEL_ROUTING.jd_extraction, 'google/gemini-2.5-flash-lite')
  assert.strictEqual(TASK_MODEL_ROUTING.fast_catch, 'google/gemini-2.5-flash-lite')
  assert.strictEqual(TASK_MODEL_ROUTING.resume_synthesis, 'google/gemini-2.5-flash-lite')
  assert.strictEqual(TASK_MODEL_ROUTING.bullet_rewrites, 'google/gemini-2.5-flash-lite')
  assert.strictEqual(TASK_MODEL_ROUTING.linkedin_synthesis, 'meta-llama/llama-3.3-70b-instruct')
  assert.strictEqual(TASK_MODEL_ROUTING.thought_leadership, 'meta-llama/llama-3.3-70b-instruct')
  assert.strictEqual(TASK_MODEL_ROUTING.report_generation, 'google/gemini-2.5-flash-lite')
  assert.strictEqual(TASK_MODEL_ROUTING.judge_gate, 'google/gemini-2.5-flash-lite')

  assert.deepStrictEqual(PROVIDER_MODEL_FALLBACKS.groq, ['openai/gpt-oss-120b'])
  assert.ok(PROVIDER_MODEL_FALLBACKS.openrouter.includes('google/gemini-2.5-flash-lite'))
  assert.ok(!PROVIDER_MODEL_FALLBACKS.openrouter.includes('deepseek/deepseek-chat'), 'deepseek/deepseek-chat must not be in openrouter fallbacks')
  console.log('  ✔ Task model routing and provider fallback tables validated.\n')

  // 2. Test LLMGateway OpenRouter generation
  console.log('--- Test 2: Live OpenRouter Generation via report_generation Task ---')
  const startTime = Date.now()
  const res = await llmGateway.generate({
    task: 'report_generation',
    preferredProvider: 'openrouter',
    messages: [
      {
        role: 'user',
        content: 'Return a raw JSON object with keys: {"status": "ok", "service": "CareerGPS"}. Zero markdown code fences.',
      },
    ],
    responseFormat: 'json_object',
    temperature: 0.1,
    maxTokens: 50,
    timeoutMs: 10000,
  })
  const latencyMs = Date.now() - startTime

  console.log(`  Actual model used: ${res.actualModel}`)
  console.log(`  Latency: ${latencyMs}ms`)
  console.log(`  Response: ${res.text.slice(0, 100)}`)

  assert.ok(latencyMs < 4000, `Expected latency < 4000ms, got ${latencyMs}ms`)
  assert.strictEqual(
    res.actualModel,
    'google/gemini-2.5-flash-lite',
    'Generated model must be google/gemini-2.5-flash-lite'
  )

  const parsedJson = JSON.parse(res.text)
  assert.strictEqual(parsedJson.status, 'ok', 'Response must be valid parsed JSON with status=ok')
  console.log('  ✔ OpenRouter generation completed in <4s with google/gemini-2.5-flash-lite.\n')

  // 3. Test SmartKeyPool error differentiation
  console.log('--- Test 3: SmartKeyPool Error Differentiation (Local Mongoose Error Shield) ---')
  const activeKey = apifyKeyPool.getActiveKey() || 'mock_apify_key_placeholder'
  const cooldownsBefore = apifyKeyPool.cooldowns.size

  let errorCaught = false
  try {
    await apifyKeyPool.executeWithRetry(async (key) => {
      // Simulate local Mongoose validation failure
      throw new Error('JobMarketBucket validation failed: roleKey: Path `roleKey` is required.')
    })
  } catch (err) {
    errorCaught = true
    assert.ok(
      err.message.includes('JobMarketBucket validation failed'),
      'Original Mongoose error must be rethrown immediately'
    )
  }

  assert.strictEqual(errorCaught, true, 'executeWithRetry must propagate local errors')
  assert.strictEqual(
    apifyKeyPool.cooldowns.has(activeKey),
    false,
    'Apify active key must NOT be placed on cooldown for a local error'
  )
  assert.strictEqual(
    apifyKeyPool.cooldowns.size,
    cooldownsBefore,
    'Cooldowns map must not grow for local errors'
  )
  console.log('  ✔ SmartKeyPool immediately rethrew local Mongoose error without penalizing active Apify key.\n')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ ALL SMOKE TESTS PASSED (0 FAILURES) 🚀')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

runSmokeTest().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})

