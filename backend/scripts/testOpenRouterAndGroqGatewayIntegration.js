import assert from 'assert'
import { OpenRouterProvider } from '../ai/gateway/openrouterProvider.js'
import {
  PRODUCTION_FALLBACK_CHAIN,
  PROVIDER_MODEL_FALLBACKS,
  TRAP_MODELS,
  llmGateway,
} from '../ai/gateway/llmGateway.js'
import { getModel, isModelAllowedForData } from '../ai/config/modelRegistry.js'
import { ProviderError, PROVIDER_ERROR_CODES } from '../ai/gateway/providerErrors.js'

async function runTests() {
  console.log('=== TEST SUITE: OpenRouter Paid Tier & Groq Fast Tier Integration ===\n')

  // ── TEST 1: Fallback Chain & Model Mapping ───────────────────────────────
  console.log('--- TEST 1: Fallback Chain & Model Mapping ---')

  assert.deepStrictEqual(
    PRODUCTION_FALLBACK_CHAIN,
    ['openrouter', 'groq', 'gemini-3.5-flash-lite'],
    'PRODUCTION_FALLBACK_CHAIN must prioritize openrouter -> groq -> gemini-3.5-flash-lite'
  )

  assert(PROVIDER_MODEL_FALLBACKS.openrouter, 'PROVIDER_MODEL_FALLBACKS.openrouter must be defined')
  assert.strictEqual(PROVIDER_MODEL_FALLBACKS.openrouter[0], 'google/gemini-3.5-flash')
  assert(PROVIDER_MODEL_FALLBACKS.openrouter.includes('google/gemini-3-flash-preview'))
  assert(PROVIDER_MODEL_FALLBACKS.openrouter.includes('google/gemini-3.1-pro-preview'))

  assert(PROVIDER_MODEL_FALLBACKS.groq, 'PROVIDER_MODEL_FALLBACKS.groq must be defined')
  assert.strictEqual(PROVIDER_MODEL_FALLBACKS.groq[0], 'llama-3.3-70b-versatile')
  assert(PROVIDER_MODEL_FALLBACKS.groq.includes('openai/gpt-oss-120b'))
  assert(PROVIDER_MODEL_FALLBACKS.groq.includes('openai/gpt-oss-20b'))

  assert(PROVIDER_MODEL_FALLBACKS.gemini, 'PROVIDER_MODEL_FALLBACKS.gemini must be defined')
  assert.strictEqual(PROVIDER_MODEL_FALLBACKS.gemini[0], 'gemini-3.5-flash-lite')
  assert(PROVIDER_MODEL_FALLBACKS.gemini.includes('gemini-3.8-flash'))

  // Verify TRAP_MODELS does not block Gemini 3.x
  assert(!TRAP_MODELS.has('gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite must not be trapped')
  assert(!TRAP_MODELS.has('gemini-3.8-flash'), 'gemini-3.8-flash must not be trapped')
  assert(!TRAP_MODELS.has('gemini-3.1-pro'), 'gemini-3.1-pro must not be trapped')
  assert(!TRAP_MODELS.has('google/gemini-3.5-flash'), 'google/gemini-3.5-flash must not be trapped')
  assert(TRAP_MODELS.has('gemini-2.5-flash-lite'), 'gemini-2.5-flash-lite must be trapped')
  assert(TRAP_MODELS.has('gemini-2.0-flash'), 'gemini-2.0-flash must be trapped')
  assert(TRAP_MODELS.has('gemini-1.5-flash'), 'gemini-1.5-flash must be trapped')

  console.log('✓ Fallback chain, provider fallbacks, and trap models configured as expected.')

  // ── TEST 2: Model Registry OpenRouter Registration ───────────────────────
  console.log('\n--- TEST 2: Model Registry OpenRouter Registration ---')

  const openRouterGemini = getModel('google/gemini-3.5-flash')
  assert(openRouterGemini, 'google/gemini-3.5-flash must be registered in MODEL_REGISTRY')
  assert.strictEqual(openRouterGemini.provider, 'openrouter')
  assert.strictEqual(openRouterGemini.supportsJsonObject, true)
  assert.strictEqual(openRouterGemini.allowPersonalData, true)

  const openRouterPreview = getModel('google/gemini-3-flash-preview')
  assert(openRouterPreview, 'google/gemini-3-flash-preview must be registered in MODEL_REGISTRY')
  assert.strictEqual(openRouterPreview.provider, 'openrouter')

  const openRouterPro = getModel('google/gemini-3.1-pro-preview')
  assert(openRouterPro, 'google/gemini-3.1-pro-preview must be registered in MODEL_REGISTRY')
  assert.strictEqual(openRouterPro.provider, 'openrouter')

  const groqLlama = getModel('llama-3.3-70b-versatile')
  assert(groqLlama, 'llama-3.3-70b-versatile must be registered in MODEL_REGISTRY')
  assert.strictEqual(groqLlama.provider, 'groq')

  // Aliases check
  assert.strictEqual(getModel('openrouter').id, 'google/gemini-3.5-flash')
  assert.strictEqual(getModel('groq').id, 'llama-3.3-70b-versatile')

  console.log('✓ Model registry contains OpenRouter paid tier models with full capabilities.')

  // ── TEST 3: OpenRouterProvider Implementation & Free-Suffix Stripping ────
  console.log('\n--- TEST 3: OpenRouterProvider Implementation & Model Stripping ---')

  const provider = new OpenRouterProvider({
    apiKey: 'test-key-mock-123',
    baseUrl: 'https://openrouter.ai/api/v1',
  })

  assert.strictEqual(provider.name, 'openrouter')
  assert.strictEqual(provider.baseUrl, 'https://openrouter.ai/api/v1/chat/completions')

  // Test missing API key validation
  const origKey = process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_KEY
  const emptyKeyProvider = new OpenRouterProvider({ apiKey: '' })
  emptyKeyProvider.apiKey = ''
  if (emptyKeyProvider.config) emptyKeyProvider.config.apiKey = ''
  try {
    await emptyKeyProvider.generate({ messages: [{ role: 'user', content: 'test' }] })
    assert.fail('Must throw when API key is missing')
  } catch (err) {
    assert(err instanceof ProviderError, 'Error must be an instance of ProviderError')
    assert(
      err.code === PROVIDER_ERROR_CODES.INVALID_AUTH || err.code === 'OPENROUTER_KEY_MISSING',
      'Error code must indicate invalid auth / key missing'
    )
  } finally {
    if (origKey) process.env.OPENROUTER_API_KEY = origKey
  }

  console.log('✓ OpenRouterProvider initializes cleanly, formats baseUrl, and enforces auth checks.')

  // ── TEST 4: ProviderError Polymorphic Arguments ─────────────────────────
  console.log('\n--- TEST 4: ProviderError Polymorphic Arguments ---')

  const errFromObj = new ProviderError({
    code: PROVIDER_ERROR_CODES.TIMEOUT,
    message: 'Timed out',
    provider: 'openrouter',
    statusCode: 408,
  })
  assert.strictEqual(errFromObj.code, 'TIMEOUT')
  assert.strictEqual(errFromObj.message, 'Timed out')
  assert.strictEqual(errFromObj.provider, 'openrouter')

  const errFromArgs = new ProviderError('OPENROUTER_KEY_MISSING', 'Key missing', {
    provider: 'openrouter',
    statusCode: 401,
  })
  assert.strictEqual(errFromArgs.code, 'OPENROUTER_KEY_MISSING')
  assert.strictEqual(errFromArgs.message, 'Key missing')
  assert.strictEqual(errFromArgs.provider, 'openrouter')
  assert.strictEqual(errFromArgs.statusCode, 401)

  console.log('✓ ProviderError handles both object signature and (code, message, details) signature.')

  // ── TEST 5: Module Imports & Controller Wiring ───────────────────────────
  console.log('\n--- TEST 5: Module Imports & Controller Wiring ---')

  const { deriveFunnelFromAnswers } = await import('../services/reportGeneration.js')
  const funnel = deriveFunnelFromAnswers({ appsWeek: 20, humanScreen: 4, aiScreen: 2 })
  assert.strictEqual(funnel.applications_count, 20)
  assert.strictEqual(funnel.recruiter_calls_count, 4)

  const { classifyChatIntent } = await import('../controllers/assessmentController.js')
  const intent = classifyChatIntent('Can you rewrite my resume summary bullet points?')
  assert.strictEqual(intent.id, 'resume')

  console.log('✓ reportGeneration and assessmentController wired and verified.')

  console.log('\n======================================================================')
  console.log(' ALL OPENROUTER & GROQ GATEWAY INTEGRATION TESTS PASSED (5/5)!')
  console.log('======================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
