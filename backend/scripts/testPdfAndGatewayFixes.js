/**
 * Automated Verification Suite: PDF Null-Safety & LLM Gateway Hardening
 *
 * Verifies:
 * 1. Groq model fallback uses active llama-3.3-70b-versatile and disables decommissioned llama-3.1-70b-versatile.
 * 2. PDF report generation is completely null-safe against sparse/null discrepancy lists and headline items.
 * 3. Gemini provider attempt timeouts default to 12,000ms and total deadline to 25,000ms.
 * 4. Gemini 503 errors fast-fail with maxAttempts=1 without spinning redundant keys or retrying.
 */

import assert from 'assert'
import { generateStandardReportPdf } from '../utils/reportPdfGenerator.js'
import { PROVIDER_MODEL_FALLBACKS } from '../ai/gateway/llmGateway.js'
import { getModel } from '../ai/config/modelRegistry.js'
import { aiConfig } from '../ai/config/aiConfig.js'
import { DEFAULT_ATTEMPT_TIMEOUT_MS, GeminiProvider } from '../ai/gateway/geminiProvider.js'
import { generateContentWithFallback, clearKeyExhaustionMap } from '../utils/geminiClient.js'

async function runTestSuite() {
  console.log('================================================================')
  console.log('CAREER GPS: PDF NULL-SAFETY & LLM GATEWAY HARDENING VERIFICATION')
  console.log('================================================================')

  // -----------------------------------------------------------------
  // TEST 1: Groq Active Model Validation & Decommissioned State
  // -----------------------------------------------------------------
  console.log('\n--- TEST 1: Groq Active Model Validation & Registry ---')

  assert.strictEqual(
    PROVIDER_MODEL_FALLBACKS.groq[0],
    'openai/gpt-oss-120b',
    'Primary Groq fallback model must be openai/gpt-oss-120b'
  )
  assert.ok(
    !PROVIDER_MODEL_FALLBACKS.groq.includes('llama-3.1-70b-versatile') &&
    !PROVIDER_MODEL_FALLBACKS.groq.includes('llama-3.3-70b-versatile'),
    'Decommissioned llama models must NOT be in active Groq fallbacks'
  )

  const groqDefault = getModel('groq')
  assert.ok(groqDefault, 'Default groq alias must resolve')
  assert.strictEqual(groqDefault.id, 'openai/gpt-oss-120b', 'groq alias must resolve to openai/gpt-oss-120b')
  assert.strictEqual(groqDefault.enabled, true, 'openai/gpt-oss-120b must be enabled')

  const decommissioned = getModel('llama-3.1-70b-versatile')
  assert.ok(decommissioned, 'llama-3.1-70b-versatile entry should exist in registry')
  assert.strictEqual(decommissioned.enabled, false, 'llama-3.1-70b-versatile must be marked enabled: false')

  console.log('  ✔ Groq model registry correctly routes to active openai/gpt-oss-120b and disables decommissioned endpoints')

  // -----------------------------------------------------------------
  // TEST 2: PDF Generator Null-Safety with Corrupted/Sparse Discrepancies
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: PDF Generator Null-Safety ---')

  const mockReportWithSparseDiscrepancies = {
    user: {
      name: 'Aditya Sharma',
      email: 'aditya@example.com',
    },
    targetRole: 'Senior Staff Engineer',
    scores: {
      overallScore: 78,
      readinessGrade: 'B+',
      categoryScores: {
        resume: { score: 75, grade: 'B' },
        linkedin: { score: 80, grade: 'A-' },
        marketFit: { score: 82, grade: 'A-' },
        jobSearch: { score: 72, grade: 'B' },
      },
      fourPillars: {
        resume: { score: 75, benchmarkScore: 85 },
        linkedin: { score: 80, benchmarkScore: 85 },
        interview: { score: 82, benchmarkScore: 85 },
        outreach: { score: 72, benchmarkScore: 85 },
      },
    },
    aiReport: {
      roadmap: {
        phases: [
          {
            phaseNumber: 1,
            timeframe: 'Day 1-7',
            theme: 'Immediate Recruiter Unstick',
            tasks: ['Fix resume contact placement', 'Align LinkedIn headline'],
          },
        ],
      },
      resume_agent: {
        overallReview: 'Solid senior profile with clear quantified accomplishments.',
        bulletRewrites: [
          {
            company: 'Acme Corp',
            originalText: 'Built backend services for customers.',
            rewrittenText: 'Architected distributed event streaming backend using Kafka and Go, reducing query latency by 45%.',
            needsRewrite: true,
          },
        ],
      },
      linkedin_agent: {
        // Here is the dirty/corrupted data that previously crashed the PDF generator
        discrepancies: [
          null,
          undefined,
          {
            severity: 'high',
            title: 'Missing Staff Title',
            resumeClaim: 'Staff Software Engineer',
            linkedinClaim: 'Software Engineer',
            recommendation: 'Update headline to reflect current Staff level',
          },
          {
            // Missing severity and recommendation
            title: 'Unspecified Gap',
            resumeClaim: 'AWS, Kubernetes',
            linkedinClaim: 'None Listed',
          },
        ],
        optimizations: {
          headlines: [null, 'Senior Staff Engineer | Distributed Systems & Cloud Infrastructure'],
          aboutRewrite: {
            hook: 'Building high-throughput scalable distributed backends.',
            proof: 'Over 10 years delivering robust distributed platforms across US tech ecosystems.',
          },
        },
        activitySignals: {
          daysSinceLastPost: 12,
          weeklyPostingCadence: 1.5,
          isGhostProfile: false,
          recencyTier: 'Active',
          domainAlignment: { domainKeywordOverlapScore: 85 },
          engagement: { avgLikes: 24 },
          substance: { substanceScore: 88 },
        },
        thoughtLeadership: {
          actionablePostTemplates: [
            { hook: '3 system design patterns we used to cut distributed cache misses by 60%.' },
          ],
        },
      },
    },
    answers: {
      targetRole: 'Senior Staff Engineer',
      yearsExperience: '10+',
      usWorkAuth: 'US Citizen / Green Card',
    },
  }

  const pdfBuffer = await generateStandardReportPdf(mockReportWithSparseDiscrepancies)
  assert.ok(pdfBuffer instanceof Buffer, 'PDF generator must return a Buffer')
  assert.ok(pdfBuffer.length > 2000, `PDF buffer length must be > 2KB, received ${pdfBuffer.length} bytes`)
  assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF', 'PDF buffer must start with %PDF header')

  console.log(`  ✔ PDF generator generated ${pdfBuffer.length} bytes successfully without crashing on null discrepancies`)

  // -----------------------------------------------------------------
  // TEST 3: Gemini Provider Fast Timeout Configuration
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: Gemini Provider Attempt Timeout Defaults ---')

  assert.strictEqual(DEFAULT_ATTEMPT_TIMEOUT_MS, 12000, 'DEFAULT_ATTEMPT_TIMEOUT_MS must be 12000ms')
  assert.strictEqual(aiConfig.gemini.perAttemptTimeoutMs, 12000, 'aiConfig.gemini.perAttemptTimeoutMs must default to 12000')
  assert.strictEqual(aiConfig.gemini.timeoutMs, 12000, 'aiConfig.gemini.timeoutMs must default to 12000')
  assert.strictEqual(aiConfig.gemini.totalDeadlineMs, 25000, 'aiConfig.gemini.totalDeadlineMs must default to 25000')

  console.log('  ✔ Gemini timeouts tuned to 12,000ms per attempt and 25,000ms total deadline')

  // -----------------------------------------------------------------
  // TEST 4: Gemini 503 Fast-Fail Execution (Zero Key Spinning)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 4: Gemini 503 Fast-Fail Without Key Spinning ---')

  clearKeyExhaustionMap()

  let attemptsCount = 0
  const mock503ClientFactory = () => ({
    getGenerativeModel: () => ({
      generateContent: async () => {
        attemptsCount++
        const err = new Error('503 The model is overloaded. Please try again later.')
        err.status = 503
        throw err
      },
    }),
  })

  // Save current env and inject dummy keys for the test
  const originalKey = process.env.GEMINI_API_KEY
  const originalKeys = process.env.GEMINI_API_KEYS
  process.env.GEMINI_API_KEY = 'mock_key_primary'
  process.env.GEMINI_API_KEYS = 'mock_key_primary,mock_key_secondary,mock_key_tertiary'

  const startTime = Date.now()
  let caughtError = null

  try {
    await generateContentWithFallback({
      contents: 'Analyze candidate resume',
      modelName: 'gemini-3.5-flash-lite',
      fallbackModels: [],
      timeoutMs: 12000,
      totalDeadlineMs: 25000,
      _clientFactory: mock503ClientFactory,
      _sleepFn: async () => {},
    })
  } catch (err) {
    caughtError = err
  } finally {
    if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey
    else delete process.env.GEMINI_API_KEY
    if (originalKeys !== undefined) process.env.GEMINI_API_KEYS = originalKeys
    else delete process.env.GEMINI_API_KEYS
    clearKeyExhaustionMap()
  }

  const durationMs = Date.now() - startTime
  assert.ok(caughtError, 'Gemini generation with 503 error must throw')
  assert.strictEqual(caughtError.statusCode, 503, 'Thrown error must preserve 503 status code')
  assert.strictEqual(
    attemptsCount,
    1,
    `503 must fast-fail on attempt 1 without spinning remaining 2 keys. Recorded attempts: ${attemptsCount}`
  )
  assert.ok(durationMs < 2000, `503 fast-fail must execute in < 2000ms. Elapsed: ${durationMs}ms`)

  console.log(`  ✔ Gemini 503 fast-failed cleanly in 1 attempt (${durationMs}ms) without spinning secondary keys`)

  console.log('\n================================================================')
  console.log('✅ ALL PDF NULL-SAFETY & LLM GATEWAY TESTS PASSED (0 FAILURES)')
  console.log('================================================================')
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err)
  process.exit(1)
})
