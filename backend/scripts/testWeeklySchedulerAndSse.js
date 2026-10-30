import assert from 'assert'
import {
  VERIFIED_GEMINI_MODELS,
  DEPRECATED_TRAP_MODELS,
  getCleanModelName,
  DEFAULT_MODELS,
} from '../utils/geminiClient.js'
import { checkAndScheduleStaleBuckets, initMarketAutoScheduler } from '../jobs/marketJd/marketAutoScheduler.js'

async function runTests() {
  console.log('--- TEST 1: Gemini Discontinued Models Guardrail & Active Fallback Filter ---')

  // Verify deprecated trap models are filtered
  assert(DEPRECATED_TRAP_MODELS.has('gemini-1.0-pro'))
  assert(DEPRECATED_TRAP_MODELS.has('gemini-1.5-flash-001'))
  assert(DEPRECATED_TRAP_MODELS.has('gemini-2.5-flash'))

  // Verify getCleanModelName returns verified model for trap models
  const clean1 = getCleanModelName('gemini-2.5-flash')
  assert.strictEqual(clean1, process.env.GEMINI_MODEL || 'gemini-2.0-flash')

  const clean2 = getCleanModelName('gemini-1.0-pro')
  assert.strictEqual(clean2, process.env.GEMINI_MODEL || 'gemini-2.0-flash')

  // Valid model passes through
  const clean3 = getCleanModelName('gemini-1.5-pro-latest')
  assert.strictEqual(clean3, 'gemini-1.5-pro-latest')

  // Verify DEFAULT_MODELS contains verified models and no trap models
  for (const trap of DEPRECATED_TRAP_MODELS) {
    assert(!DEFAULT_MODELS.includes(trap), `DEFAULT_MODELS should not include trap model: ${trap}`)
  }
  console.log('✓ Model guardrail passed. Trap models cleanly blocked.')

  console.log('\n--- TEST 2: Market Auto Scheduler Exports & In-Memory Logic ---')
  assert.strictEqual(typeof checkAndScheduleStaleBuckets, 'function')
  assert.strictEqual(typeof initMarketAutoScheduler, 'function')
  console.log('✓ Market Auto Scheduler methods defined.')

  console.log('\n--- TEST 3: SSE Endpoint Mounting ---')
  const assessmentRoutes = (await import('../routes/assessmentRoutes.js')).default
  const routes = assessmentRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }))

  const sseRoute = routes.find((r) => r.path === '/generate-report-stream')
  assert(sseRoute, 'Expected /generate-report-stream route to be registered')
  assert(sseRoute.methods.includes('get'), 'Expected GET method on /generate-report-stream')
  console.log('✓ GET /generate-report-stream SSE route properly mounted on router.')

  console.log('\n========================================')
  console.log(' ALL AUTOMATION & SSE TESTS PASSED (3/3)!')
  console.log('========================================')
}

runTests().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
