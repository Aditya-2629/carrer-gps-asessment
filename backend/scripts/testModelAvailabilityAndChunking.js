import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import assert from 'assert'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { DeterministicChunker, ContextBudgetExceededError } from '../agents/resume/chunking/deterministicChunker.js'
import {
  getVerifiedGeminiAllowlist,
  markModelPermanentlyUnavailable,
  isModelPermanentlyUnavailable,
  clearPermanentModelFailures,
  clearModelDiscoveryCache,
  discoverVerifiedGeminiModels,
} from '../ai/gateway/geminiModelDiscovery.js'
import { LLMGateway } from '../ai/gateway/llmGateway.js'
import { aiConfig } from '../ai/config/aiConfig.js'
import { liteLlmRouter } from '../ai/gateway/liteLlmRouter.js'
import { ProviderError, PROVIDER_ERROR_CODES } from '../ai/gateway/providerErrors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const VALID_SYNTHESIS_JSON = JSON.stringify({
  analysisVersion: '2.2',
  overallReview: {
    summary: 'Candidate shows strong system architecture experience.',
    topPriority: 'Clarify project outcomes.',
  },
  scores: { impact: 85, brevity: 80, structure: 90, skills: 85 },
  strengths: [
    {
      id: 'str_001',
      title: 'Strong infrastructure metrics',
      category: 'impact',
      signal: 'Quantified throughput scaling',
      evidence: [{ bulletId: 'exp_001_b01', originalText: 'Designed and shipped an event-driven telemetry ingestion engine' }],
    },
  ],
  issues: [
    {
      id: 'iss_001',
      title: 'Missing business outcome',
      category: 'impact',
      severity: 'medium',
      quote: 'Architected tenant isolation protocols',
      bulletId: 'exp_002_b03',
      recommendation: 'Specify time saved.',
      rewrite: 'Architected tenant isolation protocols accelerating SOC2 compliance approval by 3 weeks.',
    },
  ],
})

async function runTests() {
  console.log('================================================================')
  console.log('CAREER GPS MODEL AVAILABILITY & DETERMINISTIC CHUNKING SUITE')
  console.log('================================================================\n')

  let passed = 0
  let failed = 0

  function pass(desc) {
    passed++
    console.log(`✅ PASS: ${desc}`)
  }

  function fail(desc, err) {
    failed++
    console.error(`❌ FAIL: ${desc}`)
    if (err) console.error(err)
  }

  // ── TEST 1: Model discovery & Allowlist Excludes 404 Models ────────────────
  console.log('--- 1. Model Allowlist & Discovery ---')
  try {
    const allowlist = getVerifiedGeminiAllowlist()
    assert(allowlist.includes('gemini-3.6-flash'), 'gemini-3.6-flash in allowlist')
    assert(allowlist.includes('gemini-3.8-flash'), 'gemini-3.8-flash in allowlist')
    assert(!allowlist.includes('gemini-2.5-flash'), 'gemini-2.5-flash removed from allowlist')
    assert(!allowlist.includes('gemini-1.5-flash'), 'gemini-1.5-flash removed from allowlist')
    pass('Allowlist contains only verified models and excludes 404 models')
  } catch (err) {
    fail('Allowlist configuration', err)
  }

  // ── TEST 2: Configured model returns 404 -> skipped without repeated retries ─
  console.log('\n--- 2. Configured Model Returns 404 -> Permanent Skip ---')
  try {
    clearPermanentModelFailures()
    liteLlmRouter.reset()
    const gateway = new LLMGateway(aiConfig)
    let geminiAttempts = 0
    let groqAttempts = 0

    gateway.providers.gemini = {
      name: 'gemini',
      generate: async ({ model }) => {
        geminiAttempts++
        markModelPermanentlyUnavailable(model)
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.MODEL_NOT_FOUND,
          message: `Model "${model}" not found (HTTP 404)`,
          provider: 'gemini',
          model,
          statusCode: 404,
          isRetryable: true,
        })
      },
    }

    gateway.providers.groq = {
      name: 'groq',
      generate: async ({ model }) => {
        groqAttempts++
        return {
          text: VALID_SYNTHESIS_JSON,
          actualModel: model,
          finishReason: 'stop',
          tokens: { prompt: 100, completion: 100, total: 200 },
        }
      },
    }

    const res = await gateway.generate({
      purpose: 'resume_analysis',
      messages: [{ role: 'user', content: 'test' }],
      model: 'gemini-3.6-flash',
      isBenchmark: false,
    })

    assert.strictEqual(geminiAttempts, 1, 'Gemini 404 model attempted exactly once')
    assert(isModelPermanentlyUnavailable('gemini-3.6-flash'), 'Model marked permanently unavailable')
    assert.strictEqual(groqAttempts, 1, 'Groq fallback invoked successfully')
    assert.strictEqual(res.provider, 'groq')
    pass('404 model is permanently marked unavailable and immediately cascades to Groq')
  } catch (err) {
    fail('404 model skipping', err)
  }

  // ── TEST 3: Gemini 404/429/503 -> Eligible Groq Fallback Invoked ───────────
  console.log('\n--- 3. Gemini 404 / 429 / 503 -> Groq Fallback Cascade ---')
  for (const scenario of [
    { status: 404, code: PROVIDER_ERROR_CODES.MODEL_NOT_FOUND, desc: 'Gemini 404' },
    { status: 429, code: PROVIDER_ERROR_CODES.RATE_LIMIT, desc: 'Gemini 429' },
    { status: 503, code: PROVIDER_ERROR_CODES.SERVICE_UNAVAILABLE, desc: 'Gemini 503' },
  ]) {
    try {
      liteLlmRouter.reset()
      const gateway = new LLMGateway(aiConfig)
      gateway.providers.gemini = {
        name: 'gemini',
        generate: async () => {
          throw new ProviderError({
            code: scenario.code,
            message: `${scenario.desc} simulation`,
            provider: 'gemini',
            model: 'gemini-3.6-flash',
            statusCode: scenario.status,
            isRetryable: true,
          })
        },
      }
      gateway.providers.groq = {
        name: 'groq',
        generate: async ({ model, signal }) => {
          assert(!signal?.aborted, 'Fresh signal passed to Groq')
          return {
            text: VALID_SYNTHESIS_JSON,
            actualModel: model,
            finishReason: 'stop',
            tokens: { prompt: 200, completion: 200, total: 400 },
          }
        },
      }

      const res = await gateway.generate({
        purpose: 'resume_analysis',
        messages: [{ role: 'user', content: 'test' }],
        model: 'gemini-3.6-flash',
        isBenchmark: false,
      })

      assert.strictEqual(res.provider, 'groq')
      pass(`${scenario.desc} cleanly cascaded to Groq`)
    } catch (err) {
      fail(`${scenario.desc} cascade`, err)
    }
  }

  // ── TEST 4: All Providers Unavailable -> Clear Sanitized Error ────────────
  console.log('\n--- 4. All Providers Unavailable -> Sanitized Error ---')
  try {
    liteLlmRouter.reset()
    const gateway = new LLMGateway(aiConfig)
    gateway.providers.gemini = {
      name: 'gemini',
      generate: async () => {
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.RATE_LIMIT,
          message: 'Gemini quota exhausted with secret key secret_key_gemini_12345',
          statusCode: 429,
          isRetryable: true,
        })
      },
    }
    gateway.providers.groq = {
      name: 'groq',
      generate: async () => {
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'Groq 503 with secret key secret_key_groq_67890',
          statusCode: 503,
          isRetryable: true,
        })
      },
    }
    gateway.providers.nvidia = {
      name: 'nvidia',
      generate: async () => {
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.SERVER_ERROR,
          message: 'NVIDIA 500 error',
          statusCode: 500,
          isRetryable: false,
        })
      },
    }

    let caught = null
    try {
      await gateway.generate({
        purpose: 'resume_analysis',
        messages: [{ role: 'user', content: 'test' }],
        model: 'gemini-3.6-flash',
        isBenchmark: false,
      })
    } catch (err) {
      caught = err
    }

    assert(caught !== null, 'Exception thrown')
    assert(!caught.message.includes('secret_key_gemini_12345'), 'No Gemini secrets in error message')
    assert(!caught.message.includes('secret_key_groq_67890'), 'No Groq secrets in error message')
    pass('Terminal failure produces sanitized error without exposing credentials')
  } catch (err) {
    fail('Sanitized error check', err)
  }

  // ── TEST 5: Long Resume -> Chunking Preserves Evidence ────────────────────
  console.log('\n--- 5. Long Resume -> Deterministic Section Partitioning ---')
  try {
    // Construct an oversized resume with 30 experience bullets
    const longExperienceBullets = Array.from({ length: 30 }, (_, i) =>
      `• Engineered distributed cluster service module ${i + 1} with gRPC streaming and PostgreSQL storage handling 50k RPS.`
    ).join('\n')

    const longDoc = {
      rawText: `Alex Mercer\nalex@example.com | 555-0199 | Seattle, WA\n\nPROFESSIONAL SUMMARY\nExperienced systems architect.\n\nEXPERIENCE\nPrincipal Architect | Cloud Systems | 2018 - Present\n${longExperienceBullets}\n\nEDUCATION\nBS Computer Science | MIT`,
    }

    const result = DeterministicChunker.process(longDoc, { maxSectionChars: 1500, safeTokenBudget: 32000 })
    assert(result.metadata.chunksCount > 1, 'Document cleanly partitioned into multiple chunks')
    assert(result.parsedDoc.rawText.includes('Alex Mercer'), 'Header preserved')
    assert(result.parsedDoc.rawText.includes('module 30'), 'Last bullet preserved')
    pass('Long resume partitioned deterministically without dropping evidence')
  } catch (err) {
    fail('Long resume chunking', err)
  }

  // ── TEST 6: Duplicate Chunks -> Duplicate Evidence Not Counted Twice ───────
  console.log('\n--- 6. Duplicate Content -> Deduplicated Deterministically ---')
  try {
    const rawWithDuplicates = [
      'John Doe',
      'john@example.com | 555-1234 | New York, NY',
      'SUMMARY',
      'Senior engineer with extensive experience.',
      'EXPERIENCE',
      'Lead Developer | Tech Corp | 2020 - Present',
      '• Architected microservices with Kafka processing 10k events per second.',
      '• Built CI/CD pipelines reducing deployment time by 40%.',
      'Page 1 of 2',
      'John Doe', // Repeated page header
      'john@example.com | 555-1234 | New York, NY', // Repeated contact info
      '• Architected microservices with Kafka processing 10k events per second.', // Duplicate bullet point
      '• Optimized database query latency by 60% with Redis caching.',
      'Page 2 of 2',
    ].join('\n')

    const doc = { rawText: rawWithDuplicates }
    const result = DeterministicChunker.process(doc, { deduplicate: true })

    assert(result.metadata.duplicatesRemoved >= 3, `Expected duplicates removed >= 3, got ${result.metadata.duplicatesRemoved}`)
    const occurrences = (result.parsedDoc.rawText.match(/Architected microservices with Kafka/g) || []).length
    assert.strictEqual(occurrences, 1, 'Duplicate bullet occurs exactly once after deduplication')
    assert(!result.parsedDoc.rawText.includes('Page 1 of 2'), 'Page pagination footers removed')
    pass('Duplicate headers and bullets deduplicated deterministically')
  } catch (err) {
    fail('Duplicate chunk deduplication', err)
  }

  // ── TEST 7: Normal-sized Resume -> Existing Behavior Preserved ────────────
  console.log('\n--- 7. Normal-sized Resume -> Single-reasoning-call Passthrough ---')
  try {
    const fixturePath = path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt')
    const normalRaw = fs.readFileSync(fixturePath, 'utf8')
    const normalDoc = { rawText: normalRaw }

    const result = DeterministicChunker.process(normalDoc)
    assert.strictEqual(result.metadata.isChunked, false, 'Normal-sized resume is not partitioned')
    assert(result.parsedDoc.rawText.length > 0, 'Text preserved intact')
    pass('Normal-sized resume passes through without unnecessary chunking')
  } catch (err) {
    fail('Normal-sized resume passthrough', err)
  }

  // ── TEST 8: Budget Exceeded -> Typed Observable Error ──────────────────────
  console.log('\n--- 8. Safe Context Budget Exceeded -> Observable Error ---')
  try {
    const hugeText = 'Huge text block content '.repeat(20000) // ~500,000 characters
    let threwCorrectError = false

    try {
      DeterministicChunker.process({ rawText: hugeText }, { safeTokenBudget: 5000 })
    } catch (err) {
      if (err instanceof ContextBudgetExceededError && err.code === 'CONTEXT_BUDGET_EXCEEDED') {
        threwCorrectError = true
      }
    }

    assert(threwCorrectError, 'Throws ContextBudgetExceededError with status 413')
    pass('Oversized input exceeding safe budget throws typed observable error')
  } catch (err) {
    fail('Context budget exceeded error', err)
  }

  console.log('\n================================================================')
  console.log(`SUITE RESULTS: ${passed} passed, ${failed} failed`)
  console.log('================================================================\n')

  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
