import assert from 'node:assert/strict'
import { CostTracker, DEFAULT_PRICING, costTracker } from '../utils/costTracker.js'

console.log('=== RUNNING COST TRACKER & TOKEN AUDIT INTEGRATION TESTS ===\n')

// Test 1: Verify Pricing Configuration & Model Matching
console.log('Test 1: Verifying Pricing Configuration & Model Lookup...')
const tracker = new CostTracker()

const geminiRates = tracker.getModelPricing('google/gemini-3.5-flash-lite')
assert.equal(geminiRates.input, 0.075, 'Gemini input rate should be $0.075 / 1M')
assert.equal(geminiRates.output, 0.30, 'Gemini output rate should be $0.30 / 1M')

const llamaRates = tracker.getModelPricing('llama-3.3-70b-versatile')
assert.equal(llamaRates.input, 0.59, 'Llama input rate should be $0.59 / 1M')
assert.equal(llamaRates.output, 0.79, 'Llama output rate should be $0.79 / 1M')

const gptRates = tracker.getModelPricing('openai/gpt-oss-120b')
assert.equal(gptRates.input, 0.15, 'GPT-OSS input rate should be $0.15 / 1M')
assert.equal(gptRates.output, 0.60, 'GPT-OSS output rate should be $0.60 / 1M')

assert.equal(DEFAULT_PRICING.apify_scrape_job, 0.008, 'Apify scrape run should be $0.008')
assert.equal(DEFAULT_PRICING.usd_to_inr, 86.5, 'USD to INR should default to 86.5')

console.log('✔ Test 1 Passed: Default pricing rates and model resolution verified.\n')

// Test 2: Verify LLM Token Cost Calculation (USD & INR)
console.log('Test 2: Verifying LLM Token Cost Calculation...')
const testRunId = 'test_run_' + Date.now()

// Example: 10,000 prompt tokens and 1,000 completion tokens on gemini-3.5-flash-lite
// Prompt cost = 10,000 * 0.075 / 1M = $0.00075
// Output cost = 1,000 * 0.30 / 1M = $0.00030
// Total USD = $0.00105
// Total INR = 0.00105 * 86.5 = ₹0.090825
const resLLM = tracker.trackLLM({
  reqId: testRunId,
  stage: 'RESUME_SYNTHESIS',
  provider: 'openrouter',
  model: 'google/gemini-3.5-flash-lite',
  promptTokens: 10000,
  completionTokens: 1000,
})

assert.equal(resLLM.totalTokens, 11000)
assert.equal(Number(resLLM.costUsd.toFixed(5)), 0.00105)
assert.equal(Number(resLLM.costInr.toFixed(4)), 0.0908)

console.log(`  -> 11,000 tokens cost: $${resLLM.costUsd.toFixed(5)} (₹${resLLM.costInr.toFixed(4)})`)
console.log('✔ Test 2 Passed: LLM Token Cost Calculation is mathematically exact.\n')

// Test 3: Direct Cost Handling (e.g. OpenRouter direct usage.cost)
console.log('Test 3: Verifying Direct Cost Handling from OpenRouter...')
const resDirect = tracker.trackLLM({
  reqId: testRunId,
  stage: 'REPORT_CHATBOT',
  provider: 'openrouter',
  model: 'google/gemini-3.5-flash-lite',
  promptTokens: 500,
  completionTokens: 150,
  directCost: 0.00045, // Direct cost from OpenRouter
})
assert.equal(resDirect.costUsd, 0.00045)
assert.equal(Number(resDirect.costInr.toFixed(4)), Number((0.00045 * 86.5).toFixed(4)))
console.log('✔ Test 3 Passed: Direct cost parameter honored.\n')

// Test 4: Apify Scraper Cost Tracking
console.log('Test 4: Verifying Apify Scraper Cost Tracking...')
const resApify = tracker.trackApify({
  reqId: testRunId,
  stage: 'FAST_CATCH_JD_SCRAPE',
  itemsScraped: 30,
  durationMs: 42000,
})
assert.equal(resApify.costUsd, 0.008)
assert.equal(Number(resApify.costInr.toFixed(3)), Number((0.008 * 86.5).toFixed(3)))
console.log('✔ Test 4 Passed: Apify scraper execution tracked at $0.008 (₹0.692).\n')

// Test 5: Print Run Summary & Table Breakdown
console.log('Test 5: Verifying console.table formatting and printRunSummary...')
const summary = tracker.printRunSummary(testRunId)
assert.equal(summary.reqId, testRunId)
assert.equal(summary.totalLLMCalls, 2)
assert.equal(summary.totalScraperRuns, 1)
assert.equal(summary.totalItemsScraped, 30)
assert.equal(summary.totalTokens, 11650)
assert.ok(summary.totalCostUsd > 0.009)
assert.ok(summary.totalCostInr > 0.8)
console.log('✔ Test 5 Passed: printRunSummary generated table and audit breakdown cleanly.\n')

// Test 6: Safe Error Handling
console.log('Test 6: Verifying Safe Defensive Exception Handling...')
const safeResult = tracker.trackLLM({
  reqId: null,
  promptTokens: 'invalid',
  completionTokens: null,
  model: null,
})
assert.equal(safeResult.totalTokens, 0)
assert.equal(safeResult.costUsd, 0)
console.log('✔ Test 6 Passed: Invalid input handled safely without throwing.\n')

// Test 7: Verify Singleton Export
console.log('Test 7: Verifying Singleton costTracker export...')
assert.ok(typeof costTracker.trackLLM === 'function')
assert.ok(typeof costTracker.trackApify === 'function')
assert.ok(typeof costTracker.printRunSummary === 'function')
console.log('✔ Test 7 Passed: Singleton instance verified.\n')

console.log('ALL COST TRACKER & TOKEN AUDIT INTEGRATION TESTS PASSED! 🚀')

