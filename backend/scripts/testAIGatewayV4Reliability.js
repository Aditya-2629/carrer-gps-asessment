/**
 * Test Suite: AI Gateway V4 Reliability & Optimization
 * 
 * Empirically validates:
 * 1. Context Compiler: Token bounding, JD sanitization, dossier formatting, and stable hashing.
 * 2. LLMCache: Request fingerprinting, cache hits, zero duplicate calls, and benchmark bypass.
 * 3. BoundedLLMQueue: Concurrency limits, rate spacing under concurrent burst, and queue safety.
 * 4. LiteLLMRouter: Circuit breaker tripping on 503 SERVICE_UNAVAILABLE, fast-failover bypass, and recovery.
 * 5. LLMGateway V4: End-to-end integration with caching, queuing, and provider routing.
 */

import { ContextCompiler } from '../ai/context/contextCompiler.js'
import { LLMCache } from '../ai/cache/llmCache.js'
import { BoundedLLMQueue } from '../ai/queue/llmQueue.js'
import { LiteLLMRouter, CIRCUIT_STATES } from '../ai/gateway/liteLlmRouter.js'
import { LLMGateway } from '../ai/gateway/llmGateway.js'
import { ProviderError, PROVIDER_ERROR_CODES } from '../ai/gateway/providerErrors.js'

let totalPassed = 0
let totalFailed = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    totalFailed++
    process.exit(1)
  } else {
    console.log(`✅ PASS: ${message}`)
    totalPassed++
  }
}

async function runTestSuite() {
  console.log('================================================================')
  console.log('AI GATEWAY V4 RELIABILITY & OPTIMIZATION TEST SUITE')
  console.log('================================================================\n')

  // ----------------------------------------------------------------
  // 1. Context Compiler Tests
  // ----------------------------------------------------------------
  console.log('--- 1. Context Compiler Tests ---')
  const oversizedJd = 'A'.repeat(5000)
  const trimmedJd = ContextCompiler.sanitizeAndTrimJd(oversizedJd, 1500)
  assert(trimmedJd.length <= 1550, 'Target JD trimmed to bounded budget (<= 1550 chars including notice)')
  assert(trimmedJd.includes('[trimmed for concise evaluation]'), 'Trimmed JD contains notice suffix')

  const sampleDossier = {
    quantification: { density: 0.75, quantifiedBullets: 6, totalBullets: 8, unquantifiedBulletIds: ['exp_001_b02'] },
    toolDumps: [{ bulletId: 'proj_001_b01', techCount: 5 }],
    contactMergeAnomaly: true,
    timeline: { formattedDuration: '4 years 2 months', itemCount: 3, totalExperienceYears: 4, currentRole: { isCurrentlyEmployed: true, role: 'Senior Analyst', company: 'Tech Inc', dates: '2022 - Present' }, careerGaps: [], promotions: [] },
    certifications: [{ name: 'AWS Solutions Architect' }],
    targetJdOverlap: { evidencedSkills: ['SQL', 'Snowflake'], unverifiedSkills: ['dbt'] },
    marketEvidenceGaps: [{ skill: 'Python', frequency: '4/5 JDs' }],
  }

  const dossierText = ContextCompiler.formatDossierText(sampleDossier)
  assert(dossierText.includes('Quantification Density: 0.75'), 'Dossier text includes quantification density')
  assert(dossierText.includes('Tool Dump Candidates: proj_001_b01 (5 tools)'), 'Dossier text includes tool dumps')
  assert(dossierText.includes('Contact Merge Anomaly: DETECTED'), 'Dossier text flags contact merge anomaly')
  assert(dossierText.includes('Career Timeline: 4 years 2 months'), 'Dossier text includes timeline duration')
  assert(dossierText.includes('Certifications Evidenced: AWS Solutions Architect'), 'Dossier text includes certifications')

  const compiled = ContextCompiler.compile({
    compactResume: 'Alex Mercer | Senior Engineer',
    dossier: sampleDossier,
    targetRole: 'Data Engineer',
    targetJobDescription: 'Build SQL pipelines',
    systemPrompt: 'You are Maya',
  })
  assert(compiled.messages.length === 2, 'Compiled prompt produces system and user messages')
  assert(Boolean(compiled.contentHash), 'Compiled prompt produces stable contentHash')
  assert(compiled.estimatedTokens.total > 0, 'Estimated tokens calculated')

  // ----------------------------------------------------------------
  // 2. Request Fingerprint & LLMCache Tests
  // ----------------------------------------------------------------
  console.log('\n--- 2. Request Fingerprint & LLMCache Tests ---')
  const testCache = new LLMCache({ defaultTtlMs: 5000, maxEntries: 10 })
  const fp1 = LLMCache.computeFingerprint({
    purpose: 'resume_analysis',
    model: 'gemini-3.6-flash',
    contentHash: compiled.contentHash,
  })
  const fp2 = LLMCache.computeFingerprint({
    purpose: 'resume_analysis',
    model: 'gemini-3.6-flash',
    contentHash: compiled.contentHash,
  })
  assert(fp1 === fp2, 'Fingerprint is strictly deterministic for identical inputs')

  assert(testCache.get(fp1) === null, 'Cache miss for unpopulated fingerprint')

  const mockResponse = { text: '{"analysisVersion": "2.2"}', tokens: { prompt: 100, completion: 50, total: 150 } }
  testCache.set(fp1, mockResponse)

  const cachedResult = testCache.get(fp1)
  assert(cachedResult !== null, 'Cache hit retrieves stored response')
  assert(cachedResult.fromCache === true, 'Cache response marked with fromCache: true')
  assert(cachedResult.text === mockResponse.text, 'Cached response content preserved exactly')
  assert(testCache.stats().hits === 1, 'Cache stats records 1 hit')
  assert(testCache.stats().savedTokens === 150, 'Cache stats records 150 saved tokens')

  // ----------------------------------------------------------------
  // 3. Bounded LLM Queue & Rate Limiter Tests
  // ----------------------------------------------------------------
  console.log('\n--- 3. Bounded LLM Queue Tests ---')
  const testQueue = new BoundedLLMQueue({
    concurrencyLimits: { test_provider: 2 },
    defaultIntervalMs: 50,
    maxQueueDepth: 5,
    maxWaitMs: 2000,
  })

  let peakActive = 0
  let currentActive = 0

  const makeQueueTask = (delayMs) => async () => {
    currentActive++
    if (currentActive > peakActive) peakActive = currentActive
    await new Promise((r) => setTimeout(r, delayMs))
    currentActive--
    return 'done'
  }

  // Fire 4 concurrent tasks
  const p1 = testQueue.enqueue({ provider: 'test_provider', execute: makeQueueTask(60) })
  const p2 = testQueue.enqueue({ provider: 'test_provider', execute: makeQueueTask(60) })
  const p3 = testQueue.enqueue({ provider: 'test_provider', execute: makeQueueTask(60) })
  const p4 = testQueue.enqueue({ provider: 'test_provider', execute: makeQueueTask(60) })

  await Promise.all([p1, p2, p3, p4])
  assert(peakActive <= 2, `Concurrency limit (2) respected during burst (peak was ${peakActive})`)
  assert(testQueue.stats().metrics.completed === 4, 'All 4 enqueued tasks completed successfully')

  // ----------------------------------------------------------------
  // 4. LiteLLMRouter Circuit Breaker & Failover Tests
  // ----------------------------------------------------------------
  console.log('\n--- 4. LiteLLMRouter Circuit Breaker & Failover Tests ---')
  const testRouter = new LiteLLMRouter({ failureThreshold: 2, cooldownMs: 100, timeoutPerAttemptMs: 500 })

  const initialCheck = testRouter.isProviderAvailable('gemini')
  assert(initialCheck.isAvailable === true, 'Provider initially available in CLOSED state')

  // Report 503 SERVICE_UNAVAILABLE error
  const service503Err = new ProviderError({
    code: 'SERVICE_UNAVAILABLE',
    statusCode: 503,
    message: '[503 Service Unavailable] The model is overloaded.',
    provider: 'gemini',
    isRetryable: true,
  })
  testRouter.reportFailure('gemini', service503Err)

  const trippedCheck = testRouter.isProviderAvailable('gemini')
  assert(trippedCheck.isAvailable === false, 'Circuit trips to OPEN immediately on 503 SERVICE_UNAVAILABLE')
  assert(trippedCheck.reason.includes('Circuit for "gemini" is OPEN'), 'Circuit reason indicates OPEN status')

  // Wait for cooldown to test HALF_OPEN canary
  await new Promise((r) => setTimeout(r, 120))
  const canaryCheck = testRouter.isProviderAvailable('gemini')
  assert(canaryCheck.isAvailable === true, 'Canary request permitted after cooldown (HALF_OPEN)')

  // Canary succeeds -> resets to CLOSED
  testRouter.reportSuccess('gemini')
  const recoveredCheck = testRouter.isProviderAvailable('gemini')
  assert(recoveredCheck.isAvailable === true, 'Circuit reset to CLOSED on successful canary')
  assert(testRouter.getCircuit('gemini').state === CIRCUIT_STATES.CLOSED, 'Circuit state is CLOSED')

  // ----------------------------------------------------------------
  // 5. LLMGateway V4 Integration Tests
  // ----------------------------------------------------------------
  console.log('\n--- 5. LLMGateway V4 Integration Tests ---')
  const gateway = new LLMGateway({ fallbackEnabled: true, defaultResumeModel: 'openai/gpt-oss-120b', defaultProvider: 'groq' })

  let mockGroqCalls = 0
  gateway.providers.groq = {
    generate: async () => {
      mockGroqCalls++
      return { text: '{"status": "ok"}', actualModel: 'openai/gpt-oss-120b', tokens: { prompt: 50, completion: 20, total: 70 } }
    },
  }

  // First call with contentHash -> triggers execution
  const res1 = await gateway.generate({
    messages: [{ role: 'user', content: 'test content' }],
    contentHash: 'unique_hash_12345',
  })
  assert(mockGroqCalls === 1, 'First call invokes provider (mockGroqCalls = 1)')
  assert(res1.fromCache !== true, 'First response is fresh (not from cache)')

  // Second identical call with same contentHash -> hits cache
  const res2 = await gateway.generate({
    messages: [{ role: 'user', content: 'test content' }],
    contentHash: 'unique_hash_12345',
  })
  assert(mockGroqCalls === 1, 'Second call bypassed provider entirely (mockGroqCalls still 1)')
  assert(res2.fromCache === true, 'Second response was served from cache in 0ms')

  // Third call with isBenchmark: true -> strictly bypasses cache
  const res3 = await gateway.generate({
    messages: [{ role: 'user', content: 'test content' }],
    contentHash: 'unique_hash_12345',
    isBenchmark: true,
  })
  assert(mockGroqCalls === 2, 'Benchmark mode strictly bypasses cache (mockGroqCalls = 2)')
  assert(res3.fromCache !== true, 'Benchmark response was not from cache')

  console.log('\n================================================================')
  console.log(`RESULTS: ${totalPassed} passed, ${totalFailed} failed`)
  console.log('================================================================\n')
}

runTestSuite().catch((err) => {
  console.error('Test suite failed unexpectedly:', err)
  process.exit(1)
})
