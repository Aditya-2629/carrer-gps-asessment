/**
 * Test Suite: Gemini Provider Resilience & Gateway Failover
 *
 * Validates Requirement 10:
 * 1. 503 followed by success (bounded exponential backoff with jitter, no key rotation)
 * 2. Repeated 503 followed by fallback (model cascade / gateway fallback reached)
 * 3. Timeout followed by fallback (cancellation signal triggered, fallback succeeds)
 * 4. Quota-exhausted 429 without pointless retries (immediate rotation to key #2)
 * 5. Invalid key handling (API_KEY_INVALID marks key, rotates to key #2)
 * 6. Total deadline enforcement (terminates promptly without exceeding deadline)
 * 7. No concurrent retry storm (bounded concurrency limiter strictly respected)
 */

import { generateContentWithFallback, clearKeyExhaustionMap, keyExhaustionMap, parseRetryAfter, calculateBackoffWithJitter } from '../utils/geminiClient.js'
import { LLMGateway } from '../ai/gateway/llmGateway.js'
import { ProviderError, PROVIDER_ERROR_CODES } from '../ai/gateway/providerErrors.js'
import { BoundedLLMQueue } from '../ai/queue/llmQueue.js'
import { liteLlmRouter } from '../ai/gateway/liteLlmRouter.js'

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

// Mock sleep function to fast-forward backoff delays in tests while recording sleep calls
function createMockSleep() {
  const sleptDelays = []
  const sleepFn = async (ms, signal) => {
    if (signal?.aborted) throw signal.reason || new Error('Aborted')
    sleptDelays.push(ms)
  }
  return { sleptDelays, sleepFn }
}

async function runTestSuite() {
  console.log('================================================================')
  console.log('GEMINI PROVIDER RESILIENCE & GATEWAY FAILOVER TEST SUITE')
  console.log('================================================================\n')

  // Set test environment keys
  process.env.GEMINI_API_KEY = 'test_key_primary_11111111'
  process.env.GEMINI_API_KEY_FALLBACK_1 = 'test_key_secondary_22222222'
  process.env.GEMINI_API_KEY_FALLBACK_2 = 'test_key_tertiary_33333333'
  process.env.GEMINI_MODEL = 'gemini-3.6-flash'

  // ----------------------------------------------------------------
  // Scenario 1: 503 followed by success (with backoff & zero key rotation)
  // ----------------------------------------------------------------
  console.log('--- 1. Scenario: 503 followed by success ---')
  clearKeyExhaustionMap()
  const mockSleep1 = createMockSleep()
  let scenario1Calls = []

  const clientFactory1 = (key) => ({
    getGenerativeModel: ({ model }, requestOptions) => ({
      generateContent: async (contents, genOptions) => {
        scenario1Calls.push({ key, model, signal: genOptions?.signal || requestOptions?.signal })
        if (scenario1Calls.length === 1) {
          const err = new Error(
            '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: [503 Service Unavailable] This model is currently experiencing high demand.'
          )
          err.status = 503
          err.retryAfterMs = 350
          throw err
        }
        return {
          response: { text: () => '{"analysisVersion": "2.2", "recovered": true}' },
        }
      },
    }),
  })

  const result1 = await generateContentWithFallback({
    contents: 'Analyze resume',
    modelName: 'gemini-3.6-flash',
    fallbackModels: ['gemini-2.5-flash'],
    maxRetries: 2,
    baseBackoffMs: 200,
    maxBackoffMs: 1000,
    _clientFactory: clientFactory1,
    _sleepFn: mockSleep1.sleepFn,
  })

  assert(scenario1Calls.length === 2, 'Exactly 2 attempts made for 503 retry')
  assert(
    scenario1Calls[0].key === scenario1Calls[1].key,
    'Key was NOT rotated on 503 Service Unavailable (attempt 1 and 2 used same key)'
  )
  assert(
    scenario1Calls[0].model === 'gemini-3.6-flash' && scenario1Calls[1].model === 'gemini-3.6-flash',
    'Both attempts targeted the same model gemini-3.6-flash'
  )
  assert(mockSleep1.sleptDelays.length === 1, 'Exponential backoff sleep occurred before retry')
  assert(mockSleep1.sleptDelays[0] === 350, 'Retry-After (350ms) was honored in backoff delay')
  assert(result1.text.includes('"recovered": true'), 'Result returned successfully after 503 recovery')
  assert(result1.modelUsed === 'gemini-3.6-flash', 'Model used is gemini-3.6-flash')

  // ----------------------------------------------------------------
  // Scenario 2: Repeated 503 followed by fallback
  // ----------------------------------------------------------------
  console.log('\n--- 2. Scenario: Repeated 503 followed by fallback ---')
  clearKeyExhaustionMap()
  const mockSleep2 = createMockSleep()
  let scenario2GeminiCalls = []

  const clientFactory2 = (key) => ({
    getGenerativeModel: ({ model }) => ({
      generateContent: async () => {
        scenario2GeminiCalls.push({ key, model })
        const err = new Error(
          '[GoogleGenerativeAI Error]: [503 Service Unavailable] Overloaded cluster.'
        )
        err.status = 503
        throw err
      },
    }),
  })

  const gw2 = new LLMGateway({
    fallbackEnabled: true,
    defaultResumeModel: 'gemini-3.6-flash',
    defaultProvider: 'gemini',
  })

  // Mock Gemini provider using the scenario 2 client factory
  gw2.providers.gemini = {
    generate: async ({ model, messages, signal, timeoutMs, totalDeadlineMs }) => {
      return generateContentWithFallback({
        contents: 'test',
        modelName: model,
        fallbackModels: [], // test failover out of Gemini
        maxRetries: 1,
        baseBackoffMs: 50,
        maxBackoffMs: 200,
        signal,
        timeoutMs,
        totalDeadlineMs,
        _clientFactory: clientFactory2,
        _sleepFn: mockSleep2.sleepFn,
      })
    },
  }

  // Fallback groq provider succeeds
  let groqFallbackCalls = []
  gw2.providers.groq = {
    generate: async ({ model }) => {
      groqFallbackCalls.push(model)
      return {
        text: '{"analysisVersion": "2.2", "provider": "groq"}',
        actualModel: model,
        tokens: { prompt: 10, completion: 20, total: 30 },
      }
    },
  }

  const result2 = await gw2.generate({
    messages: [{ role: 'user', content: 'test' }],
    model: 'gemini-3.6-flash',
    isBenchmark: false,
  })

  assert(scenario2GeminiCalls.length === 2, 'Gemini attempted max retries (2 attempts) on gemini-3.6-flash')
  assert(
    scenario2GeminiCalls.every((c) => c.key === scenario2GeminiCalls[0].key),
    'Gemini did NOT rotate keys during repeated 503s on the same model'
  )
  assert(groqFallbackCalls.length === 1, 'Gateway successfully fell back to Groq provider')
  assert(groqFallbackCalls[0] === 'openai/gpt-oss-120b', 'Fallback model was openai/gpt-oss-120b')
  assert(result2.provider === 'groq', 'Final response provider is groq')

  // ----------------------------------------------------------------
  // Scenario 3: Timeout followed by fallback (with cancellation)
  // ----------------------------------------------------------------
  console.log('\n--- 3. Scenario: Timeout followed by fallback ---')
  clearKeyExhaustionMap()
  liteLlmRouter.reportSuccess('gemini')
  liteLlmRouter.reportSuccess('groq')
  let scenario3Cancelled = false

  const gw3 = new LLMGateway({
    fallbackEnabled: true,
    defaultResumeModel: 'gemini-3.6-flash',
    defaultProvider: 'gemini',
  })

  gw3.providers.gemini = {
    generate: async ({ signal, timeoutMs }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({ text: 'late' })
        }, 5000)

        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer)
            scenario3Cancelled = true
            reject(new ProviderError({
              code: PROVIDER_ERROR_CODES.TIMEOUT,
              message: `Gemini timed out after ${timeoutMs}ms`,
              statusCode: 408,
              isRetryable: true,
            }))
          }, { once: true })
        }
      })
    },
  }

  let groqTimeoutFallbackCalls = []
  gw3.providers.groq = {
    generate: async ({ model }) => {
      groqTimeoutFallbackCalls.push(model)
      return {
        text: '{"analysisVersion": "2.2", "provider": "groq_after_timeout"}',
        actualModel: model,
        tokens: {},
      }
    },
  }

  // Set short attempt timeout for Gemini to trigger timeout quickly
  gw3.config.gemini = { timeoutMs: 80 }

  const result3 = await gw3.generate({
    messages: [{ role: 'user', content: 'test timeout' }],
    model: 'gemini-3.6-flash',
    isBenchmark: false,
  })

  assert(scenario3Cancelled === true, 'Timed-out attempt was cancelled via AbortSignal')
  assert(groqTimeoutFallbackCalls.length === 1, 'Gateway successfully chained to Groq fallback on timeout')
  assert(result3.actualModel === 'openai/gpt-oss-120b', 'Fallback successfully handled request')

  // ----------------------------------------------------------------
  // Scenario 4: Quota-exhausted 429 without pointless retries
  // ----------------------------------------------------------------
  console.log('\n--- 4. Scenario: Quota-exhausted 429 without pointless retries ---')
  clearKeyExhaustionMap()
  let scenario4Calls = []

  const clientFactory4 = (key) => ({
    getGenerativeModel: ({ model }) => ({
      generateContent: async () => {
        scenario4Calls.push({ key, model })
        if (key === process.env.GEMINI_API_KEY) {
          const err = new Error(
            '[GoogleGenerativeAI Error]: [429 RESOURCE_EXHAUSTED] Quota exceeded for your project.'
          )
          err.status = 429
          throw err
        }
        return {
          response: { text: () => '{"analysisVersion": "2.2", "key2_success": true}' },
        }
      },
    }),
  })

  const result4 = await generateContentWithFallback({
    contents: 'test quota',
    modelName: 'gemini-3.6-flash',
    maxRetries: 2,
    _clientFactory: clientFactory4,
  })

  assert(scenario4Calls.length === 2, 'Total 2 calls made (1 on key #1, 1 on key #2)')
  assert(scenario4Calls[0].key === process.env.GEMINI_API_KEY, 'First call was on key #1')
  assert(scenario4Calls[1].key === process.env.GEMINI_API_KEY_FALLBACK_1, 'Second call immediately rotated to key #2')
  assert(keyExhaustionMap.has(process.env.GEMINI_API_KEY), 'Key #1 was recorded in keyExhaustionMap')
  assert(result4.text.includes('"key2_success": true'), 'Key #2 returned success')
  assert(result4.keyIndex === 1, 'Result reflects keyIndex 1 (key #2)')

  // ----------------------------------------------------------------
  // Scenario 5: Invalid key handling
  // ----------------------------------------------------------------
  console.log('\n--- 5. Scenario: Invalid key handling ---')
  clearKeyExhaustionMap()
  let scenario5Calls = []

  const clientFactory5 = (key) => ({
    getGenerativeModel: ({ model }) => ({
      generateContent: async () => {
        scenario5Calls.push({ key, model })
        if (key === process.env.GEMINI_API_KEY) {
          const err = new Error(
            '[GoogleGenerativeAI Error]: API_KEY_INVALID. The provided API key is invalid.'
          )
          err.status = 400
          throw err
        }
        return {
          response: { text: () => '{"validKeyResult": true}' },
        }
      },
    }),
  })

  const result5 = await generateContentWithFallback({
    contents: 'test invalid key',
    modelName: 'gemini-3.6-flash',
    maxRetries: 2,
    _clientFactory: clientFactory5,
  })

  assert(scenario5Calls.length === 2, 'Exactly 2 calls made')
  assert(scenario5Calls[0].key === process.env.GEMINI_API_KEY, 'Key #1 attempted first')
  assert(scenario5Calls[1].key === process.env.GEMINI_API_KEY_FALLBACK_1, 'Immediately rotated to Key #2')
  assert(keyExhaustionMap.has(process.env.GEMINI_API_KEY), 'Key #1 marked exhausted')
  assert(result5.text.includes('validKeyResult'), 'Succeeded on healthy key')

  // ----------------------------------------------------------------
  // Scenario 6: Total deadline enforcement
  // ----------------------------------------------------------------
  console.log('\n--- 6. Scenario: Total deadline enforcement ---')
  clearKeyExhaustionMap()
  const mockSleep6 = createMockSleep()

  const clientFactory6 = () => ({
    getGenerativeModel: () => ({
      generateContent: async () => {
        // simulate 60ms delay
        await new Promise((r) => setTimeout(r, 60))
        const err = new Error('[503 Service Unavailable]')
        err.status = 503
        throw err
      },
    }),
  })

  let deadlineErrorCaught = null
  try {
    await generateContentWithFallback({
      contents: 'test deadline',
      modelName: 'gemini-3.6-flash',
      totalDeadlineMs: 100, // tight 100ms deadline
      timeoutMs: 80,
      maxRetries: 5,
      baseBackoffMs: 30,
      maxBackoffMs: 50,
      _clientFactory: clientFactory6,
      _sleepFn: async (ms) => new Promise((r) => setTimeout(r, ms)),
    })
  } catch (err) {
    deadlineErrorCaught = err
  }

  assert(deadlineErrorCaught !== null, 'Request threw an error when total deadline was exceeded')
  assert(
    deadlineErrorCaught.statusCode === 408 || deadlineErrorCaught.code === 'TIMEOUT',
    'Deadline failure is classified as 408 / TIMEOUT'
  )
  assert(
    deadlineErrorCaught.message.includes('deadline') || deadlineErrorCaught.details?.timeoutSource === 'total_deadline',
    'Error message or details flags total deadline expiration'
  )

  // ----------------------------------------------------------------
  // Scenario 7: No concurrent retry storm (bounded concurrency limiter)
  // ----------------------------------------------------------------
  console.log('\n--- 7. Scenario: No concurrent retry storm ---')
  const testQueue = new BoundedLLMQueue({
    concurrencyLimits: { gemini: 2 },
    defaultIntervalMs: 20,
    maxQueueDepth: 20,
    maxWaitMs: 5000,
  })

  let peakActiveCalls = 0
  let currentActiveCalls = 0

  const makeBurstTask = (id) => async () => {
    currentActiveCalls++
    if (currentActiveCalls > peakActiveCalls) peakActiveCalls = currentActiveCalls
    // simulate task with backoff/retry
    await new Promise((r) => setTimeout(r, 40))
    currentActiveCalls--
    return `success_${id}`
  }

  // Fire 5 concurrent requests under load
  const burstPromises = [
    testQueue.enqueue({ provider: 'gemini', execute: makeBurstTask(1) }),
    testQueue.enqueue({ provider: 'gemini', execute: makeBurstTask(2) }),
    testQueue.enqueue({ provider: 'gemini', execute: makeBurstTask(3) }),
    testQueue.enqueue({ provider: 'gemini', execute: makeBurstTask(4) }),
    testQueue.enqueue({ provider: 'gemini', execute: makeBurstTask(5) }),
  ]

  const burstResults = await Promise.all(burstPromises)
  assert(burstResults.length === 5, 'All 5 concurrent requests completed successfully')
  assert(peakActiveCalls <= 2, `Peak concurrency was ${peakActiveCalls} (bounded strictly <= 2 slots)`)

  console.log('\n================================================================')
  console.log(`RESULTS: ${totalPassed} passed, ${totalFailed} failed`)
  console.log('================================================================\n')
}

runTestSuite().catch((err) => {
  console.error('Test suite failed unexpectedly:', err)
  process.exit(1)
})
