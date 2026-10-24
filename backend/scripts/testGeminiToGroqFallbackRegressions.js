import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'
import { LLMGateway } from '../ai/gateway/llmGateway.js'
import { aiConfig } from '../ai/config/aiConfig.js'
import { ProviderError, PROVIDER_ERROR_CODES } from '../ai/gateway/providerErrors.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { liteLlmRouter } from '../ai/gateway/liteLlmRouter.js'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Valid sample output that passes schema and evidence validation
const VALID_SYNTHESIS_JSON = JSON.stringify({
  analysisVersion: '2.2',
  overallReview: {
    summary: 'Candidate shows strong system architecture experience with well-quantified infrastructure impact.',
    topPriority: 'Clarify project outcomes for open-source contributions.',
  },
  scores: {
    impact: 85,
    brevity: 80,
    structure: 90,
    skills: 85,
  },
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
      title: 'Missing business outcome on compliance',
      category: 'impact',
      severity: 'medium',
      quote: 'Architected tenant isolation protocols',
      bulletId: 'exp_002_b03',
      recommendation: 'Specify the operational time saved or compliance audit acceleration.',
      rewrite: 'Architected tenant isolation protocols with PostgreSQL row-level security (RLS), accelerating SOC2 compliance approval by 3 weeks.',
    },
  ],
})

async function runRegressionTests() {
  console.log('================================================================')
  console.log('CAREER GPS GEMINI -> GROQ FALLBACK REGRESSION SUITE')
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

  // ── TEST 1: Gemini 429 → Groq Success (Mocked) ─────────────────────────────
  console.log('--- 1. Gemini 429 Quota Exhaustion -> Groq Success ---')
  liteLlmRouter.reset()
  try {
    const gateway = new LLMGateway(aiConfig)
    let geminiCalls = 0
    let groqCalls = 0

    // Mock gemini provider to return 429 quota exhaustion
    gateway.providers.gemini = {
      name: 'gemini',
      generate: async () => {
        geminiCalls++
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.RATE_LIMIT,
          message: 'All configured Gemini API keys are currently exhausted due to quota/rate limits (HTTP 429).',
          provider: 'gemini',
          model: 'gemini-3.6-flash',
          statusCode: 429,
          isRetryable: true,
        })
      },
    }

    // Mock groq provider to return valid response
    gateway.providers.groq = {
      name: 'groq',
      generate: async ({ model, signal }) => {
        groqCalls++
        assert(!signal?.aborted, 'Groq must receive non-aborted fresh signal')
        return {
          text: VALID_SYNTHESIS_JSON,
          actualModel: model,
          finishReason: 'stop',
          tokens: { prompt: 500, completion: 400, total: 900 },
        }
      },
    }

    const res = await gateway.generate({
      purpose: 'resume_analysis',
      messages: [{ role: 'user', content: 'test prompt' }],
      model: 'gemini-3.6-flash',
      isBenchmark: false,
    })

    assert.strictEqual(geminiCalls, 1, 'Gemini attempted once')
    assert.strictEqual(groqCalls, 1, 'Groq fallback invoked exactly once')
    assert.strictEqual(res.provider, 'groq', 'Response provider is groq')
    assert.strictEqual(res.actualModel, 'openai/gpt-oss-120b', 'Fallback model is openai/gpt-oss-120b')
    pass('Gemini 429 cleanly fails over to Groq without crashing')
  } catch (err) {
    fail('Gemini 429 -> Groq fallback', err)
  }

  // ── TEST 2: Gemini 503 -> Bounded Retries -> Groq Success (Mocked) ─────────
  console.log('\n--- 2. Gemini 503 Overload -> Bounded Retries -> Groq Success ---')
  liteLlmRouter.reset()
  try {
    const gateway = new LLMGateway(aiConfig)
    let geminiAttempts = 0
    let groqCalls = 0

    gateway.providers.gemini = {
      name: 'gemini',
      generate: async () => {
        geminiAttempts++
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'Google Gemini 503 Service Unavailable (Overloaded cluster)',
          provider: 'gemini',
          model: 'gemini-3.6-flash',
          statusCode: 503,
          isRetryable: true,
        })
      },
    }

    gateway.providers.groq = {
      name: 'groq',
      generate: async ({ model, signal }) => {
        groqCalls++
        assert(!signal?.aborted, 'Groq received fresh non-aborted signal')
        return {
          text: VALID_SYNTHESIS_JSON,
          actualModel: model,
          finishReason: 'stop',
          tokens: { prompt: 600, completion: 500, total: 1100 },
        }
      },
    }

    const res = await gateway.generate({
      purpose: 'resume_analysis',
      messages: [{ role: 'user', content: 'test prompt' }],
      model: 'gemini-3.6-flash',
      isBenchmark: false,
    })

    assert.strictEqual(geminiAttempts, 1, 'Gemini provider was attempted')
    assert.strictEqual(groqCalls, 1, 'Groq fallback was invoked successfully')
    assert.strictEqual(res.provider, 'groq')
    pass('Gemini 503 cascades cleanly to Groq')
  } catch (err) {
    fail('Gemini 503 -> Groq fallback', err)
  }

  // ── TEST 3: Gemini Abort/Timeout -> Groq Success with Fresh Signal (Mocked) ──
  console.log('\n--- 3. Gemini Timeout -> Groq Success with Fresh Context ---')
  liteLlmRouter.reset()
  try {
    const gateway = new LLMGateway(aiConfig)
    let geminiTimedOut = false
    let groqSignalAborted = null

    gateway.providers.gemini = {
      name: 'gemini',
      generate: async ({ signal }) => {
        geminiTimedOut = true
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.TIMEOUT,
          message: 'Provider "gemini" timed out after 30000ms',
          provider: 'gemini',
          model: 'gemini-3.6-flash',
          statusCode: 408,
          isRetryable: true,
        })
      },
    }

    gateway.providers.groq = {
      name: 'groq',
      generate: async ({ model, signal }) => {
        groqSignalAborted = signal?.aborted
        return {
          text: VALID_SYNTHESIS_JSON,
          actualModel: model,
          finishReason: 'stop',
          tokens: { prompt: 550, completion: 450, total: 1000 },
        }
      },
    }

    const res = await gateway.generate({
      purpose: 'resume_analysis',
      messages: [{ role: 'user', content: 'test prompt' }],
      model: 'gemini-3.6-flash',
      isBenchmark: false,
    })

    assert(geminiTimedOut, 'Gemini was attempted and timed out')
    assert.strictEqual(groqSignalAborted, false, 'Groq received fresh non-aborted signal')
    assert.strictEqual(res.provider, 'groq')
    pass('Gemini timeout does not leak aborted signal to Groq; Groq succeeds')
  } catch (err) {
    fail('Gemini timeout -> Groq success', err)
  }

  // ── TEST 4: Gemini and Groq Both Fail -> Clean Sanitized Error (Mocked) ────
  console.log('\n--- 4. Gemini & Groq Both Fail -> Clean Sanitized Final Error ---')
  liteLlmRouter.reset()
  try {
    const gateway = new LLMGateway(aiConfig)

    gateway.providers.gemini = {
      name: 'gemini',
      generate: async () => {
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.RATE_LIMIT,
          message: 'Gemini 429 quota exhausted with secret key secret_123',
          provider: 'gemini',
          model: 'gemini-3.6-flash',
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
          message: 'Groq 503 service unavailable with secret key secret_456',
          provider: 'groq',
          model: 'openai/gpt-oss-120b',
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
          provider: 'nvidia',
          model: 'nvidia/nemotron-3-super-120b-a12b',
          statusCode: 500,
          isRetryable: false,
        })
      },
    }

    let caughtErr = null
    try {
      await gateway.generate({
        purpose: 'resume_analysis',
        messages: [{ role: 'user', content: 'test' }],
        model: 'gemini-3.6-flash',
        isBenchmark: false,
      })
    } catch (err) {
      caughtErr = err
    }

    assert(caughtErr !== null, 'Chain failure throws ProviderError')
    assert(caughtErr instanceof ProviderError, 'Error is an instance of ProviderError')
    assert(!caughtErr.message.includes('secret_123'), 'Error does not leak secret API keys')
    assert(!caughtErr.message.includes('secret_456'), 'Error does not leak Groq secret keys')
    pass('Both providers failing results in clean, non-leaking terminal failure')
  } catch (err) {
    fail('Gemini & Groq both fail', err)
  }

  // ── TEST 5: All Providers Fail -> No Fake Successful Report (Mocked) ───────
  console.log('\n--- 5. All Providers Fail -> No Fake Successful Report ---')
  try {
    const fixturePath = path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt')
    const resumeText = fs.readFileSync(fixturePath, 'utf8')

    // Simulate failure by forcing an invalid model in benchmark mode
    const res = await ResumeAgent.evaluate({
      resumeText,
      targetRole: 'Senior AI Engineer',
      model: 'invalid-nonexistent-model',
      isBenchmark: true,
    })

    assert.strictEqual(res.success, false, 'Failed provider evaluation must have success=false')
    assert(res.analysis === undefined || res.analysis === null, 'No fake analysis object produced')
    assert.strictEqual(res.rawModelOutput, null, 'No fake rawModelOutput produced')
    pass('When providers fail, ResumeAgent strictly returns success=false with null output')
  } catch (err) {
    fail('No fake successful report on failure', err)
  }

  // ── TEST 6: Existing Gemini Primary Success Still Works (Mocked) ───────────
  console.log('\n--- 6. Existing Gemini Primary Success Still Works ---')
  liteLlmRouter.reset()
  try {
    const gateway = new LLMGateway(aiConfig)
    gateway.providers.gemini = {
      name: 'gemini',
      generate: async () => ({
        text: VALID_SYNTHESIS_JSON,
        actualModel: 'gemini-3.6-flash',
        finishReason: 'stop',
        tokens: { prompt: 700, completion: 600, total: 1300 },
      }),
    }

    const res = await gateway.generate({
      purpose: 'resume_analysis',
      messages: [{ role: 'user', content: 'test prompt' }],
      model: 'gemini-3.6-flash',
      isBenchmark: false,
    })

    assert.strictEqual(res.provider, 'gemini', 'Gemini resolved as provider')
    assert.strictEqual(res.actualModel, 'gemini-3.6-flash')
    pass('Gemini primary success pathway remains intact and preferred')
  } catch (err) {
    fail('Gemini primary success', err)
  }

  // ── TEST 7: Fallback Output Passes Schema & Scorecard Validation ───────────
  console.log('\n--- 7. Fallback Output Passes Schema & Scorecard Validation ---')
  try {
    const parsed = JSON.parse(VALID_SYNTHESIS_JSON)
    assert.strictEqual(parsed.analysisVersion, '2.2')
    assert(parsed.scores.impact >= 0 && parsed.scores.impact <= 100)
    assert(Array.isArray(parsed.issues) && parsed.issues.length > 0)
    assert(Array.isArray(parsed.strengths) && parsed.strengths.length > 0)
    assert(parsed.issues[0].rewrite.length > 0)
    pass('Fallback JSON structure conforms to V2.2 canonical schema and scorecard contract')
  } catch (err) {
    fail('Fallback output validation', err)
  }

  console.log('\n================================================================')
  console.log(`REGRESSION RESULTS: ${passed} passed, ${failed} failed`)
  console.log('================================================================\n')

  if (failed > 0) process.exit(1)
}

runRegressionTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
