/**
 * Regression Test Suite: Reliability Hard Gates & Quota Handling
 *
 * Verifies:
 * 1. Hard Gate: Under NO condition can `success=true` be returned when evidence is invalid.
 *    Untypeable evidence failures strictly return typed EVIDENCE_VALIDATION_ERROR.
 *    Safe recovery (pruning invalid issues when remaining >= 3) preserves validity.
 * 2. Quota-aware cooldown: Gemini 429 project quota stops key spinning and advances to next model / Groq.
 * 3. Groq TPM 429 handling: Respects Retry-After and remaining deadline with bounded single retry.
 * 4. All-provider failure: Clean sanitized error without credential leaks.
 */

import assert from 'assert'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import {
  generateContentWithFallback,
  clearKeyExhaustionMap,
  projectModelQuotaMap,
  parseGeminiQuotaDetails,
  isProjectQuotaExhaustedForModel,
} from '../utils/geminiClient.js'
import { GroqProvider, parseGroqRetryAfter } from '../ai/gateway/groqProvider.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'

let totalTests = 0
let passedTests = 0

async function test(name, fn) {
  totalTests++
  try {
    await fn()
    passedTests++
    console.log(`  ✅ PASS: ${name}`)
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`)
    console.error(err)
  }
}

const sampleCanonicalResume = {
  candidate: {
    name: 'Jane Doe',
    targetRole: 'Staff Software Engineer',
    contact: { email: 'jane@example.com', location: 'San Francisco, CA' },
  },
  summary: {
    id: 'summary_001',
    text: 'Experienced distributed systems engineer with 8 years building scalable services.',
  },
  experience: [
    {
      id: 'exp_001',
      company: 'TechCorp',
      role: 'Senior Software Engineer',
      startDate: '2021-01',
      endDate: '2024-01',
      bullets: [
        { id: 'exp_001_b01', text: 'Architected real-time streaming pipeline processing 100k events/sec with Apache Flink.' },
        { id: 'exp_001_b02', text: 'Mentored 5 junior engineers and led quarterly sprint planning sessions.' },
        { id: 'exp_001_b03', text: 'Optimized database indexing to reduce p99 query latency from 450ms to 85ms.' },
        { id: 'exp_001_b04', text: 'Migrated legacy monolith services to Docker containers on AWS ECS.' },
      ],
    },
  ],
  skills: [
    { name: 'Languages', items: ['Java', 'Python', 'Go'] },
    { name: 'Infrastructure', items: ['AWS', 'Docker', 'Kubernetes'] },
  ],
}

async function main() {
  console.log('\n===============================================================')
  console.log('RELIABILITY HARD GATES & COOLDOWN REGRESSION TESTS')
  console.log('===============================================================\n')

  // ── TEST GROUP 1: Evidence Validation Hard Gate & Safe Recovery ─────────────
  console.log('--- 1. Evidence Validation Hard Gate Tests ---')

  await test('Hard Gate: Analysis with ungrounded evidence cannot produce success=true', async () => {
    const invalidSynthesis = {
      analysisVersion: '2.2',
      candidateSnapshot: {
        name: 'Jane Doe',
        targetRole: 'Staff Software Engineer',
        experienceYears: 8,
      },
      dashboard: null,
      overallReview: { summary: 'Strong resume overall.', tone: 'conversational' },
      issues: [
        {
          id: 'iss_1',
          title: 'Weak metric',
          category: 'impact',
          severity: 'medium',
          correctionType: 'rewrite',
          evidence: {
            itemId: 'fake_job',
            bulletId: 'fake_bullet_999',
            originalText: 'Completely made up text that does not exist anywhere in canonical resume',
          },
          diagnosis: 'Needs more data',
          whyItMatters: 'Hiring managers want to see impact',
          recommendation: 'Add metrics',
          correctedText: 'Improved made up text',
        },
        {
          id: 'iss_2',
          title: 'Unclear role',
          category: 'clarity',
          severity: 'low',
          correctionType: 'rewrite',
          evidence: {
            itemId: 'fake_job_2',
            bulletId: 'fake_bullet_888',
            originalText: 'Another fabricated bullet text with zero evidence',
          },
          diagnosis: 'Vague description',
          whyItMatters: 'Clarity is essential',
          recommendation: 'Be specific',
          correctedText: 'Clarified text',
        },
      ],
      strengths: [
        {
          id: 'str_1',
          title: 'Good systems background',
          category: 'technical_depth',
          evidence: {
            itemId: 'exp_001',
            bulletId: 'exp_001_b01',
            originalText: 'Architected real-time streaming pipeline processing 100k events/sec with Apache Flink.',
          },
          description: 'Demonstrates distributed streaming expertise',
        },
      ],
      priorityActions: [
        { title: 'Update metrics', action: 'Add quantified impact to all bullets' },
      ],
    }

    const originalGenerate = llmGateway.generate
    try {
      llmGateway.generate = async () => ({
        text: JSON.stringify(invalidSynthesis),
        actualModel: 'mock-model',
        provider: 'mock-provider',
        latencyMs: 100,
        finishReason: 'stop',
        tokens: { prompt: 500, completion: 500, total: 1000 },
      })

      const result = await ResumeAgent.evaluate({
        resumeText: 'Jane Doe\nStaff Software Engineer\nArchitected real-time streaming pipeline',
        canonicalResumeOverride: sampleCanonicalResume,
        orchestrationMode: 'baseline_single_synthesis',
      })

      assert.strictEqual(result.success, false, 'Result MUST have success=false')
      assert.strictEqual(result.status, 'EVIDENCE_VALIDATION_ERROR', 'Status must be EVIDENCE_VALIDATION_ERROR')
      assert.strictEqual(result.classification, 'EVIDENCE_VALIDATION_ERROR')
      assert.strictEqual(result.code, 'EVIDENCE_VALIDATION_ERROR')
      assert.strictEqual(result.validationDetails.isEvidenceValid, false)
    } finally {
      llmGateway.generate = originalGenerate
    }
  })

  await test('Safe Recovery: Prunes 1 ungrounded issue when 3 valid issues remain', async () => {
    const synthesisWithOneBadIssue = {
      analysisVersion: '2.2',
      candidateSnapshot: {
        name: 'Jane Doe',
        targetRole: 'Staff Software Engineer',
        experienceYears: 8,
      },
      dashboard: null,
      overallReview: { summary: 'Strong systems background.', tone: 'conversational' },
      issues: [
        {
          id: 'iss_1',
          title: 'Add business impact',
          category: 'outcome_visibility',
          severity: 'medium',
          correctionType: 'rewrite',
          evidence: {
            itemId: 'exp_001',
            bulletId: 'exp_001_b01',
            originalText: 'Architected real-time streaming pipeline processing 100k events/sec with Apache Flink.',
          },
          diagnosis: 'Lacks business outcome',
          whyItMatters: 'Shows ROI',
          recommendation: 'Highlight reliability and latency impact',
          correctedText: 'Architected real-time streaming pipeline processing 100k events/sec with Apache Flink, optimizing stream processing.',
        },
        {
          id: 'iss_2',
          title: 'Mentoring outcome',
          category: 'clarity',
          severity: 'low',
          correctionType: 'rewrite',
          evidence: {
            itemId: 'exp_001',
            bulletId: 'exp_001_b02',
            originalText: 'Mentored 5 junior engineers and led quarterly sprint planning sessions.',
          },
          diagnosis: 'Missing team outcome',
          whyItMatters: 'Shows mentorship value',
          recommendation: 'Mention team outcomes',
          correctedText: 'Mentored 5 junior engineers and led quarterly sprint planning sessions, improving team delivery consistency.',
        },
        {
          id: 'iss_3',
          title: 'Clarify migration scale',
          category: 'clarity',
          severity: 'medium',
          correctionType: 'rewrite',
          evidence: {
            itemId: 'exp_001',
            bulletId: 'exp_001_b04',
            originalText: 'Migrated legacy monolith services to Docker containers on AWS ECS.',
          },
          diagnosis: 'Scope unclear',
          whyItMatters: 'Scope demonstrates senior impact',
          recommendation: 'Specify architecture outcomes',
          correctedText: 'Migrated legacy monolith services to Docker containers on AWS ECS, modernizing deployment pipelines.',
        },
        {
          id: 'iss_4',
          title: 'Bogus issue with fake evidence',
          category: 'clarity',
          severity: 'high',
          correctionType: 'rewrite',
          evidence: {
            itemId: 'exp_999',
            bulletId: 'bogus_bullet_id',
            originalText: 'Fabricated bullet text that never existed anywhere in canonical resume.',
          },
          diagnosis: 'Fake diagnosis',
          whyItMatters: 'Fake why',
          recommendation: 'Fake rec',
          correctedText: 'Fake rewrite',
        },
      ],
      strengths: [
        {
          id: 'str_1',
          title: 'Latency optimization',
          category: 'technical_depth',
          evidence: {
            itemId: 'exp_001',
            bulletId: 'exp_001_b03',
            originalText: 'Optimized database indexing to reduce p99 query latency from 450ms to 85ms.',
          },
          description: 'Hard latency engineering achievement',
        },
      ],
      priorityActions: [
        { title: 'Highlight uptime', action: 'Add uptime metrics to streaming pipeline' },
      ],
    }

    const originalGenerate = llmGateway.generate
    try {
      llmGateway.generate = async () => ({
        text: JSON.stringify(synthesisWithOneBadIssue),
        actualModel: 'mock-model',
        provider: 'mock-provider',
        latencyMs: 120,
        finishReason: 'stop',
        tokens: { prompt: 500, completion: 500, total: 1000 },
      })

      const result = await ResumeAgent.evaluate({
        resumeText: 'Jane Doe\nStaff Software Engineer\nArchitected real-time streaming pipeline',
        canonicalResumeOverride: sampleCanonicalResume,
        orchestrationMode: 'baseline_single_synthesis',
      })

      assert.strictEqual(result.success, true, 'Result should succeed via safe recovery')
      assert.strictEqual(result.analysis.issues.length, 3, 'Invalid issue was safely pruned, leaving 3 valid issues')
      assert.strictEqual(result.validationDetails.isEvidenceValid, true, 'Final evidenceValid must be true')
      assert.ok(
        result.validationDetails.warnings.some((w) => w.includes('Safe recovery applied')),
        'Should log safe recovery warning'
      )
    } finally {
      llmGateway.generate = originalGenerate
    }
  })

  // ── TEST GROUP 2: Gemini Quota Parsing & Project-Level Cooldown ─────────────
  console.log('\n--- 2. Gemini Quota Cooldown Tests ---')

  await test('Gemini Quota Parser: Parses GenerateRequestsPerDayPerProjectPerModel & retryDelay', async () => {
    const googleQuotaErr = new Error(
      'Resource has been exhausted (e.g. check quota). [violations { quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" quotaDimensions { model: "gemini-3.6-flash" } }] retryDelay: "22557s"'
    )
    googleQuotaErr.status = 429
    googleQuotaErr.errorDetails = [
      {
        quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
        retryDelay: '22557s',
      },
    ]

    const details = parseGeminiQuotaDetails(googleQuotaErr)
    assert.strictEqual(details.isProjectLevel, true, 'Must identify project-level quota')
    assert.strictEqual(details.isDaily, true, 'Must identify daily quota')
    assert.strictEqual(details.retryDelayMs, 22557 * 1000, 'Must parse retryDelay in ms')
  })

  await test('Gemini Multi-Key Cooldown: Skips spinning keys sharing exhausted project quota', async () => {
    clearKeyExhaustionMap()

    const keysAttempted = []
    const mockFactory = (key) => ({
      getGenerativeModel: ({ model }) => ({
        generateContent: async () => {
          keysAttempted.push(key)
          const err = new Error(
            'Resource has been exhausted (check quota). quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" retryDelay: "3600s"'
          )
          err.status = 429
          err.errorDetails = [
            { quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', retryDelay: '3600s' },
          ]
          throw err
        },
      }),
    })

    const originalKeys = process.env.GEMINI_API_KEYS
    process.env.GEMINI_API_KEYS = 'test-key-1,test-key-2,test-key-3'

    try {
      let caughtErr = null
      try {
        await generateContentWithFallback({
          contents: 'Test prompt',
          modelName: 'gemini-3.6-flash',
          fallbackModels: ['gemini-3.6-flash'],
          _clientFactory: mockFactory,
        })
      } catch (err) {
        caughtErr = err
      }

      assert.ok(caughtErr, 'Must throw ProviderError on quota exhaustion')
      assert.strictEqual(caughtErr.statusCode, 429)
      assert.strictEqual(keysAttempted.length, 1, 'Must only attempt 1 key before marking project cooldown')
      assert.strictEqual(isProjectQuotaExhaustedForModel('gemini-3.6-flash'), true, 'Model must be in project quota cooldown')

      // Second call to same model should be fast-skipped in 0ms without calling any keys
      keysAttempted.length = 0
      try {
        await generateContentWithFallback({
          contents: 'Second prompt',
          modelName: 'gemini-3.6-flash',
          fallbackModels: ['gemini-3.6-flash'],
          _clientFactory: mockFactory,
        })
      } catch (_err) {
        // expected
      }
      assert.strictEqual(keysAttempted.length, 0, 'Subsequent call must fast-skip all keys for cooled-down model')
    } finally {
      process.env.GEMINI_API_KEYS = originalKeys
      clearKeyExhaustionMap()
    }
  })

  await test('Gemini Fallback: Model 1 project quota exhaustion advances cleanly to Model 2', async () => {
    clearKeyExhaustionMap()

    const modelsAttempted = []
    const mockFactory = (key) => ({
      getGenerativeModel: ({ model }) => ({
        generateContent: async () => {
          modelsAttempted.push(model)
          if (model === 'gemini-3.6-flash') {
            const err = new Error('Resource exhausted. quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" retryDelay: "3600s"')
            err.status = 429
            err.errorDetails = [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', retryDelay: '3600s' }]
            throw err
          }
          return { text: '{"success": true, "model": "gemini-3.8-flash"}' }
        },
      }),
    })

    const originalKeys = process.env.GEMINI_API_KEYS
    process.env.GEMINI_API_KEYS = 'key-alpha,key-beta'

    try {
      const result = await generateContentWithFallback({
        contents: 'Test prompt',
        modelName: 'gemini-3.6-flash',
        fallbackModels: ['gemini-3.6-flash', 'gemini-3.8-flash'],
        _clientFactory: mockFactory,
      })

      assert.strictEqual(result.modelUsed, 'gemini-3.8-flash', 'Must fall back to gemini-3.8-flash')
      assert.ok(modelsAttempted.includes('gemini-3.6-flash'), 'Must attempt model 1')
      assert.ok(modelsAttempted.includes('gemini-3.8-flash'), 'Must attempt model 2')
      assert.strictEqual(isProjectQuotaExhaustedForModel('gemini-3.6-flash'), true, 'Model 1 marked in cooldown')
      assert.strictEqual(isProjectQuotaExhaustedForModel('gemini-3.8-flash'), false, 'Model 2 not marked in cooldown')
    } finally {
      process.env.GEMINI_API_KEYS = originalKeys
      clearKeyExhaustionMap()
    }
  })

  // ── TEST GROUP 3: Groq TPM 429 Handling ─────────────────────────────────────
  console.log('\n--- 3. Groq TPM 429 Handling Tests ---')

  await test('Groq Retry-After Parser: Parses header seconds, reset-tokens, and text message', async () => {
    const resp1 = { headers: new Map([['retry-after', '1.42']]) }
    assert.strictEqual(parseGroqRetryAfter(resp1, null), 1420)

    const resp2 = { headers: new Map([['x-ratelimit-reset-tokens', '850ms']]) }
    assert.strictEqual(parseGroqRetryAfter(resp2, null), 850)

    const body3 = { error: { message: 'Rate limit reached for model on TPM. Please try again in 1.25s.' } }
    assert.strictEqual(parseGroqRetryAfter({ headers: new Map() }, body3), 1250)
  })

  await test('Groq TPM 429: Bounded Retry-After waits and retries on same key successfully', async () => {
    const originalFetch = global.fetch
    let callCount = 0
    let waitedMs = 0

    const mockSleep = async (ms) => {
      waitedMs += ms
    }

    global.fetch = async () => {
      callCount++
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['retry-after', '1.2']]),
          json: async () => ({
            error: { message: 'Rate limit reached on tokens per minute (TPM). Please try again in 1.2s.' },
          }),
        }
      }

      return {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({
          id: 'groq_success_id',
          model: 'openai/gpt-oss-120b',
          choices: [{ message: { content: '{"status": "ok"}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      }
    }

    try {
      const provider = new GroqProvider({ apiKey: 'gsk_single_test_key', baseUrl: 'https://mock.groq.com' })
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'test' }],
        totalDeadlineMs: 30000,
        _sleepFn: mockSleep,
      })

      assert.strictEqual(result.keyIndex, 0, 'Succeeded on the same key (index 0)')
      assert.strictEqual(callCount, 2, 'Made exactly 2 attempts (initial + 1 bounded retry)')
      assert.ok(waitedMs >= 1200, 'Waited for parsed Retry-After duration')
      assert.strictEqual(result.text, '{"status": "ok"}')
    } finally {
      global.fetch = originalFetch
    }
  })

  await test('Groq TPM 429: Does NOT wait if Retry-After exceeds bound (> 2500ms)', async () => {
    const originalFetch = global.fetch
    let callCount = 0
    let waitedMs = 0

    const mockSleep = async (ms) => {
      waitedMs += ms
    }

    global.fetch = async (url, opts) => {
      callCount++
      const auth = opts.headers?.Authorization || ''
      if (auth.includes('key_1')) {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['retry-after', '60.0']]),
          json: async () => ({ error: { message: 'Rate limit exceeded. Please try again in 60s.' } }),
        }
      }
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({
          choices: [{ message: { content: '{"status": "key_2_success"}' }, finish_reason: 'stop' }],
        }),
      }
    }

    try {
      const provider = new GroqProvider({
        apiKeys: ['gsk_key_1', 'gsk_key_2'],
        baseUrl: 'https://mock.groq.com',
      })
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'test' }],
        totalDeadlineMs: 30000,
        _sleepFn: mockSleep,
      })

      assert.strictEqual(waitedMs, 0, 'Must NOT sleep 60 seconds; should immediately rotate')
      assert.strictEqual(result.keyIndex, 1, 'Rotated to key 2')
    } finally {
      global.fetch = originalFetch
    }
  })

  // ── TEST GROUP 4: All-Provider Failure Clean Handling ───────────────────────
  console.log('\n--- 4. All-Provider Failure Sanitized Error Tests ---')

  await test('All Providers Fail: Returns clean ProviderError without credential leaks', async () => {
    const originalGenerate = llmGateway.generate
    try {
      llmGateway.generate = async () => {
        throw new Error('All providers exhausted (Groq and Gemini quota depleted). Sensitive key: gsk_SECRET_123456789')
      }

      const result = await ResumeAgent.evaluate({
        resumeText: 'Jane Doe\nSoftware Engineer',
        orchestrationMode: 'baseline_single_synthesis',
      })

      assert.strictEqual(result.success, false, 'Must return success=false when gateway fails completely')
      const errMsg = result.error || ''
      assert.ok(!errMsg.includes('gsk_SECRET_123456789'), 'Error message must not leak raw secret key')
      assert.ok(errMsg.includes('All providers exhausted'), 'Error message must preserve failure description')
    } finally {
      llmGateway.generate = originalGenerate
    }
  })

  console.log('\n===============================================================')
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`)
  console.log('===============================================================\n')

  if (passedTests < totalTests) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
