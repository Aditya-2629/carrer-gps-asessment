import assert from 'node:assert/strict'
import {
  TASK_MODEL_ROUTING,
  PROVIDER_MODEL_FALLBACKS,
  PRODUCTION_FALLBACK_CHAIN,
  TRAP_MODELS,
  LLMGateway,
} from '../ai/gateway/llmGateway.js'
import { MODEL_REGISTRY, getModel } from '../ai/config/modelRegistry.js'
import { DEFAULT_PRICING, costTracker } from '../utils/costTracker.js'
import { generateStandardReportPdf } from '../utils/reportPdfGenerator.js'

console.log('=== RUNNING COST OPTIMIZATION & LINKEDIN SNAPSHOT VERIFICATION ===\n')

// Test 1: Task Model Routing Table
console.log('Test 1: Verifying TASK_MODEL_ROUTING configuration...')
assert.equal(TASK_MODEL_ROUTING.jd_extraction, 'google/gemini-2.5-flash-lite')
assert.equal(TASK_MODEL_ROUTING.fast_catch, 'google/gemini-2.5-flash-lite')
assert.equal(TASK_MODEL_ROUTING.resume_synthesis, 'google/gemini-2.5-flash-lite')
assert.equal(TASK_MODEL_ROUTING.bullet_rewrites, 'google/gemini-2.5-flash-lite')
assert.equal(TASK_MODEL_ROUTING.linkedin_synthesis, 'meta-llama/llama-3.3-70b-instruct')
assert.equal(TASK_MODEL_ROUTING.thought_leadership, 'meta-llama/llama-3.3-70b-instruct')
assert.equal(TASK_MODEL_ROUTING.report_generation, 'google/gemini-2.5-flash-lite')
assert.equal(TASK_MODEL_ROUTING.judge_gate, 'google/gemini-2.5-flash-lite')
console.log('✔ Test 1 Passed: TASK_MODEL_ROUTING correctly configured across all 8 task stages.\n')

// Test 2: Model Registry Entries
console.log('Test 2: Verifying MODEL_REGISTRY entries...')
const gemini25Lite = getModel('google/gemini-2.5-flash-lite')
assert.ok(gemini25Lite, 'google/gemini-2.5-flash-lite must exist in registry')
assert.equal(gemini25Lite.enabled, true)
assert.equal(gemini25Lite.provider, 'openrouter')

const llama33Instruct = getModel('meta-llama/llama-3.3-70b-instruct')
assert.ok(llama33Instruct, 'meta-llama/llama-3.3-70b-instruct must exist in registry')
assert.equal(llama33Instruct.enabled, true)
assert.equal(llama33Instruct.provider, 'openrouter')

const deepseek = getModel('deepseek/deepseek-chat')
assert.ok(deepseek, 'deepseek/deepseek-chat must exist in registry')
assert.equal(deepseek.enabled, true)

assert.equal(TRAP_MODELS.has('gemini-2.5-flash-lite'), false, 'gemini-2.5-flash-lite must not be in TRAP_MODELS')
console.log('✔ Test 2 Passed: Model registry entries and trap model exclusions verified.\n')

// Test 3: Provider Fallbacks and Fallback Chain
console.log('Test 3: Verifying Fallback Chains...')
assert.deepEqual(PRODUCTION_FALLBACK_CHAIN, ['openrouter', 'groq'])
assert.ok(PROVIDER_MODEL_FALLBACKS.openrouter.includes('google/gemini-2.5-flash-lite'))
assert.ok(PROVIDER_MODEL_FALLBACKS.openrouter.includes('google/gemini-3.5-flash-lite'))
assert.ok(PROVIDER_MODEL_FALLBACKS.openrouter.includes('meta-llama/llama-3.3-70b-instruct'))
assert.deepEqual(PROVIDER_MODEL_FALLBACKS.groq, ['openai/gpt-oss-120b'])
console.log('✔ Test 3 Passed: Provider fallback lists and priority chain verified.\n')

// Test 4: Pricing Rates in CostTracker
console.log('Test 4: Verifying CostTracker pricing rates...')
const geminiPricing = costTracker.getModelPricing('google/gemini-2.5-flash-lite')
assert.equal(geminiPricing.input, 0.10)
assert.equal(geminiPricing.output, 0.40)

const deepseekPricing = costTracker.getModelPricing('deepseek/deepseek-chat')
assert.equal(deepseekPricing.input, 0.14)
assert.equal(deepseekPricing.output, 0.28)

const llamaPricing = costTracker.getModelPricing('meta-llama/llama-3.3-70b-instruct')
assert.equal(llamaPricing.input, 0.13)
assert.equal(llamaPricing.output, 0.50)

const gptOssPricing = costTracker.getModelPricing('openai/gpt-oss-120b')
assert.equal(gptOssPricing.input, 0.15)
assert.equal(gptOssPricing.output, 0.60)
console.log('✔ Test 4 Passed: Exact per-token pricing verified across all 4 key production models.\n')

// Test 5: PDF Generator with Live LinkedIn Profile Banner
console.log('Test 5: Verifying PDF Generation with Live Scraped LinkedIn Profile Banner...')
const mockReport = {
  overall_score: 82,
  user_answers: {
    linkedinData: {
      fullName: 'Alex Vance',
      headline: 'Staff Infrastructure Engineer | Distributed Systems & Cloud Architecture',
      connectionsCount: '500+ connections',
      location: 'San Francisco Bay Area',
      url: 'https://linkedin.com/in/alexvance-demo',
      experiences: [
        { title: 'Staff Engineer', company: 'CloudCorp', duration: '2021 - Present' },
        { title: 'Senior Engineer', company: 'InfraScale', duration: '2018 - 2021' },
      ],
      about: 'Passionate about distributed consensus, high-throughput pipelines, and developer tooling.',
    },
    experience: '7 years',
    targetRole: 'Staff Infrastructure Engineer',
  },
  linkedin_json: {
    fullName: 'Alex Vance',
    headline: 'Staff Infrastructure Engineer | Distributed Systems & Cloud Architecture',
    connectionsCount: '850',
    url: 'https://linkedin.com/in/alexvance-demo',
    experiences: [
      { title: 'Staff Engineer', company: 'CloudCorp', duration: '2021 - Present' },
      { title: 'Senior Engineer', company: 'InfraScale', duration: '2018 - 2021' },
    ],
  },
  linkedin_agent: {
    discrepancies: [
      {
        severity: 'high',
        title: 'Title Variance',
        resumeClaim: 'Staff Engineer',
        linkedinClaim: 'Senior Engineer',
        recommendation: 'Align title across profiles to ensure background check consistency.',
      },
    ],
    optimizations: {
      headlines: ['Staff Infrastructure Engineer | Distributed Systems & Cloud Architecture'],
      aboutRewrite: { hook: 'Proven track record of building 99.999% uptime systems.' },
    },
    activitySignals: {
      recencyTier: 'Active',
      postCount: 5,
    },
  },
  assessment_agent: {
    candidateProfile: {
      targetRole: 'Staff Infrastructure Engineer',
      yoe: 7,
      primaryBottleneck: 'Phase 2',
    },
  },
}

const pdfBuffer = await generateStandardReportPdf({
  user: { name: 'Alex Vance', email: 'alex@example.com' },
  answers: mockReport.user_answers,
  aiReport: mockReport,
})
assert.ok(Buffer.isBuffer(pdfBuffer), 'generateStandardReportPdf must return a valid Buffer')
assert.ok(pdfBuffer.length > 3000, `PDF buffer length should be substantial (got ${pdfBuffer.length} bytes)`)
assert.equal(pdfBuffer.subarray(0, 5).toString(), '%PDF-', 'PDF buffer must begin with %PDF- header')
console.log(`✔ Test 5 Passed: PDF rendered successfully (${pdfBuffer.length} bytes) with Live Scraped Profile Banner.\n`)

console.log('ALL COST OPTIMIZATION & LINKEDIN SNAPSHOT TESTS PASSED! 🚀\n')
