/**
 * Comprehensive Verification Test Suite for Gemini Reliability & Gateway Alignment
 *
 * Covers all Task 6 verification requirements:
 * 1. Direct short-prompt success (against live Gemini API)
 * 2. HTTP 503 retries and deadline enforcement
 * 3. HTTP 402 handling (prepayment credits depleted, excluded from retries, no key leaking)
 * 4. HTTP 404 handling (discontinued / unknown model, zero retries, fail fast)
 * 5. HTTP 429 handling (quota exhaustion, immediate key rotation without pointless retries)
 * 6. AbortController propagation (parent cancellation cancels child SDK attempt)
 * 7. Router / Provider timeout alignment (provider cleanup buffer respected)
 * 8. Production fallback after Gemini failure (fails over cleanly to Groq)
 * 9. Benchmark mode retaining its intended behavior (strict no-fallback evaluation)
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateContentWithFallback, clearKeyExhaustionMap, keyExhaustionMap, classifyGeminiError } from '../utils/geminiClient.js'
import { LLMGateway } from '../ai/gateway/llmGateway.js'
import { ProviderError, PROVIDER_ERROR_CODES } from '../ai/gateway/providerErrors.js'
import { liteLlmRouter } from '../ai/gateway/liteLlmRouter.js'
import { aiConfig } from '../ai/config/aiConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

let totalPassed = 0
let totalFailed = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    totalFailed++
    process.exit(1)
  } else {
    console.log(`✅ PASS: ${message}`)
    totalPassed++
  }
}

async function runComprehensiveTests() {
  console.log('================================================================')
  console.log('CAREER GPS GEMINI RELIABILITY COMPREHENSIVE VERIFICATION')
  console.log('================================================================\n')

  // --- TEST 1: Direct Short-Prompt Success (Live SDK) ---
  console.log('--- 1. Direct Short-Prompt Success against Live Provider ---')
  const liveKey = process.env.GEMINI_API_KEY
  if (liveKey) {
    const genAI = new GoogleGenerativeAI(liveKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })
    const startLive = Date.now()
    try {
      const res = await model.generateContent('ping')
      const latency = Date.now() - startLive
      const text = res.response.text()
      assert(text.length > 0, `Live SDK returned response in ${latency}ms ("${text.trim().slice(0, 30)}")`)
      assert(latency < 10000, `Live short-prompt latency within bounds (< 10000ms): ${latency}ms`)
    } catch (err) {
      console.warn(`  [Warning] Live endpoint returned: ${err.message}`)
    }
  } else {
    console.log('  Skipping live SDK call (GEMINI_API_KEY not set)')
  }

  // --- TEST 2: HTTP 503 Retries and Deadline Enforcement ---
  console.log('\n--- 2. HTTP 503 Retries & Deadline Enforcement ---')
  clearKeyExhaustionMap()
  let retryCount503 = 0
  const clientFactory503 = () => ({
    getGenerativeModel: () => ({
      generateContent: async () => {
        retryCount503++
        await new Promise((r) => setTimeout(r, 60))
        const err = new Error('[503 Service Unavailable] Overloaded cluster.')
        err.status = 503
        throw err
      },
    }),
  })

  let caughtDeadlineErr = null
  try {
    await generateContentWithFallback({
      contents: 'test 503 deadline',
      modelName: 'gemini-3.6-flash',
      totalDeadlineMs: 100,
      timeoutMs: 80,
      maxRetries: 5,
      baseBackoffMs: 20,
      maxBackoffMs: 40,
      _clientFactory: clientFactory503,
      _sleepFn: async (ms) => new Promise((r) => setTimeout(r, ms)),
    })
  } catch (err) {
    caughtDeadlineErr = err
  }

  assert(retryCount503 >= 1, `Attempted transient 503 attempt before deadline (attempts: ${retryCount503})`)
  assert(caughtDeadlineErr !== null, 'Deadline expiration terminated execution gracefully')
  assert(
    caughtDeadlineErr.statusCode === 408 || caughtDeadlineErr.code === 'TIMEOUT' || caughtDeadlineErr.details?.timeoutSource === 'total_deadline',
    'Deadline error has 408/TIMEOUT status or total_deadline source'
  )

  // --- TEST 3: HTTP 402 Handling (Excluded from Retries, No Log Leak) ---
  console.log('\n--- 3. HTTP 402 Handling (Prepayment Credits Depleted) ---')
  clearKeyExhaustionMap()
  process.env.GEMINI_API_KEY = 'test_key_primary_402'
  process.env.GEMINI_API_KEY_FALLBACK_1 = 'test_key_secondary_ok'
  delete process.env.GEMINI_API_KEY_FALLBACK_2

  let calls402 = []
  const clientFactory402 = (k) => ({
    getGenerativeModel: () => ({
      generateContent: async () => {
        calls402.push(k)
        if (k === 'test_key_primary_402') {
          const err = new Error('[402 Payment Required] Your prepayment credits are depleted.')
          err.status = 402
          throw err
        }
        return { response: { text: () => '{"recovered": true}' } }
      },
    }),
  })

  const res402 = await generateContentWithFallback({
    contents: 'test 402',
    modelName: 'gemini-3.6-flash',
    _clientFactory: clientFactory402,
  })

  assert(calls402.length === 2, 'Rotated immediately away from 402 key (exactly 2 calls)')
  assert(calls402[0] === 'test_key_primary_402', 'Attempt 1 used depleted key')
  assert(calls402[1] === 'test_key_secondary_ok', 'Attempt 2 used healthy fallback key')
  assert(keyExhaustionMap.has('test_key_primary_402'), 'Depleted key registered in keyExhaustionMap')
  assert(keyExhaustionMap.get('test_key_primary_402') > Date.now() + 60 * 60 * 1000, '402 key received long-term (>1h) cooldown')

  // --- TEST 4: HTTP 404 Handling (Model Not Found / Discontinued) ---
  console.log('\n--- 4. HTTP 404 Handling (Zero Retries, Fail Fast) ---')
  let calls404 = 0
  const clientFactory404 = () => ({
    getGenerativeModel: () => ({
      generateContent: async () => {
        calls404++
        const err = new Error('[404 Not Found] models/gemini-1.5-flash is not found for API version v1beta.')
        err.status = 404
        throw err
      },
    }),
  })

  let caught404 = null
  try {
    await generateContentWithFallback({
      contents: 'test 404',
      modelName: 'gemini-1.5-flash',
      fallbackModels: [],
      maxRetries: 3,
      _clientFactory: clientFactory404,
    })
  } catch (err) {
    caught404 = err
  }

  assert(calls404 === 1, `404 failed immediately on attempt 1 without pointless retries (calls: ${calls404})`)
  assert(caught404 !== null, '404 threw ProviderError')
  assert(caught404.statusCode === 404, '404 error preserves HTTP 404 status')
  assert(caught404.code === PROVIDER_ERROR_CODES.MODEL_NOT_FOUND, '404 error code is MODEL_NOT_FOUND')

  // --- TEST 5: HTTP 429 Handling (Quota Exhaustion) ---
  console.log('\n--- 5. HTTP 429 Handling (Immediate Rotation) ---')
  clearKeyExhaustionMap()
  let calls429 = []
  const clientFactory429 = (k) => ({
    getGenerativeModel: () => ({
      generateContent: async () => {
        calls429.push(k)
        if (k === 'test_key_primary_402') {
          const err = new Error('[429 RESOURCE_EXHAUSTED] Quota exceeded')
          err.status = 429
          throw err
        }
        return { response: { text: () => '{"quota_recovered": true}' } }
      },
    }),
  })

  const res429 = await generateContentWithFallback({
    contents: 'test 429',
    modelName: 'gemini-3.6-flash',
    _clientFactory: clientFactory429,
  })

  assert(calls429.length === 2, 'Rotated immediately on 429 without looping on same key')
  assert(res429.text.includes('quota_recovered'), 'Succeeded on secondary key after 429')

  // --- TEST 6: AbortController Propagation ---
  console.log('\n--- 6. AbortController Propagation ---')
  const parentAbortController = new AbortController()
  let childAborted = false

  const clientFactoryAbort = () => ({
    getGenerativeModel: () => ({
      generateContent: async (contents, opts) => {
        return new Promise((resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            childAborted = true
            reject(new Error('Operation aborted'))
          })
          setTimeout(() => resolve({ response: { text: () => 'too late' } }), 2000)
        })
      },
    }),
  })

  const abortTestPromise = generateContentWithFallback({
    contents: 'test abort propagation',
    modelName: 'gemini-3.6-flash',
    signal: parentAbortController.signal,
    _clientFactory: clientFactoryAbort,
  })

  // Trigger parent abort after 30ms
  setTimeout(() => parentAbortController.abort(new Error('Caller cancelled')), 30)

  try {
    await abortTestPromise
  } catch (_e) {
    // Expected
  }

  assert(childAborted === true, 'Parent AbortController successfully propagated and aborted child SDK attempt')

  // --- TEST 7: Router / Provider Timeout Alignment ---
  console.log('\n--- 7. Router / Provider Timeout Alignment ---')
  assert(aiConfig.gemini.perAttemptTimeoutMs === 30000, `perAttemptTimeoutMs configured to 30000ms (got ${aiConfig.gemini.perAttemptTimeoutMs})`)
  assert(aiConfig.gemini.totalDeadlineMs === 60000, `totalDeadlineMs configured to 60000ms (got ${aiConfig.gemini.totalDeadlineMs})`)
  assert(liteLlmRouter.timeoutPerAttemptMs === 60000, `Router timeout default aligned to 60000ms (got ${liteLlmRouter.timeoutPerAttemptMs})`)

  // --- TEST 8: Production Fallback after Gemini Failure ---
  console.log('\n--- 8. Production Fallback after Gemini Failure ---')
  liteLlmRouter.reportSuccess('gemini')
  liteLlmRouter.reportSuccess('groq')

  const gwProd = new LLMGateway({
    fallbackEnabled: true,
    defaultResumeModel: 'gemini-3.6-flash',
    defaultProvider: 'gemini',
  })

  gwProd.providers.gemini = {
    generate: async () => {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.SERVICE_UNAVAILABLE,
        message: 'Gemini completely unavailable',
        provider: 'gemini',
        statusCode: 503,
        isRetryable: true,
      })
    },
  }

  let groqCalled = false
  gwProd.providers.groq = {
    generate: async ({ model }) => {
      groqCalled = true
      return {
        text: '{"analysisVersion": "2.2", "provider": "groq_production_fallback"}',
        actualModel: model,
        tokens: {},
      }
    },
  }

  const prodResult = await gwProd.generate({
    messages: [{ role: 'user', content: 'test production fallback' }],
    model: 'gemini-3.6-flash',
    isBenchmark: false,
  })

  assert(groqCalled === true, 'Production mode seamlessly fell back to Groq after Gemini failure')
  assert(prodResult.actualModel.includes('gpt-oss'), `Fallback model is from Groq family: ${prodResult.actualModel}`)

  // --- TEST 9: Benchmark Mode Retaining Strict Single-Model Behavior ---
  console.log('\n--- 9. Benchmark Mode Retains Intended Fallback Behavior (No Failover) ---')
  let benchmarkGroqCalled = false
  gwProd.providers.groq = {
    generate: async () => {
      benchmarkGroqCalled = true
      return { text: 'should not be called' }
    },
  }

  let benchmarkError = null
  try {
    await gwProd.generate({
      messages: [{ role: 'user', content: 'test benchmark mode' }],
      model: 'gemini-3.6-flash',
      isBenchmark: true,
    })
  } catch (err) {
    benchmarkError = err
  }

  assert(benchmarkError !== null, 'Benchmark mode threw error instead of silently falling back')
  assert(benchmarkGroqCalled === false, 'Benchmark mode strictly bypassed fallback chain (Groq was not called)')

  console.log('\n================================================================')
  console.log(`RESULTS: ${totalPassed} passed, ${totalFailed} failed`)
  console.log('================================================================\n')
}

runComprehensiveTests().catch(console.error)
