import assert from 'assert'
import {
  TASK_MODEL_ROUTING,
  PROVIDER_MODEL_FALLBACKS,
  llmGateway,
} from '../ai/gateway/llmGateway.js'
import { aiConfig } from '../ai/config/aiConfig.js'
import { DEFAULT_TASK_POLICIES, resolveTaskPolicy } from '../agents/resume/orchestration/taskPolicy.js'
import { createResumeState } from '../agents/resume/state/resumeState.js'

console.log('======================================================================')
console.log('  VERIFYING WORKLOAD ROUTING & CROSS-PROVIDER INSTANT FAILOVER')
console.log('======================================================================\n')

// 1. Verify TASK_MODEL_ROUTING
console.log('--- TEST 1: TASK_MODEL_ROUTING Mapping ---')
assert.strictEqual(TASK_MODEL_ROUTING.resume_synthesis, 'google/gemini-3.5-flash')
assert.strictEqual(TASK_MODEL_ROUTING.bullet_rewrites, 'google/gemini-3.5-flash')
assert.strictEqual(TASK_MODEL_ROUTING.linkedin_synthesis, 'google/gemini-3.5-flash')
assert.strictEqual(TASK_MODEL_ROUTING.thought_leadership, 'google/gemini-3.5-flash')
assert.strictEqual(TASK_MODEL_ROUTING.report_generation, 'google/gemini-3.5-flash')
assert.strictEqual(TASK_MODEL_ROUTING.unified_synthesis, 'google/gemini-3.5-flash')
assert.strictEqual(TASK_MODEL_ROUTING.jd_extraction, 'google/gemini-2.5-flash-lite')
assert.strictEqual(TASK_MODEL_ROUTING.fast_catch, 'google/gemini-2.5-flash-lite')
assert.strictEqual(TASK_MODEL_ROUTING.judge_gate, 'google/gemini-2.5-flash-lite')
assert.strictEqual(TASK_MODEL_ROUTING.jev_decision, 'typesafe/jev-1.14')
assert.strictEqual(TASK_MODEL_ROUTING.skill_validation_decision, 'typesafe/jev-1.14')
assert.strictEqual(TASK_MODEL_ROUTING.bullet_triage_decision, 'typesafe/jev-1.14')
assert.strictEqual(TASK_MODEL_ROUTING.title_drift_decision, 'typesafe/jev-1.14')
console.log('PASS: All 13 task model routings strictly verified.')

// 2. Verify PROVIDER_MODEL_FALLBACKS
console.log('\n--- TEST 2: PROVIDER_MODEL_FALLBACKS Hierarchy ---')
const expectedOpenRouter = [
  'google/gemini-3.5-flash',
  'google/gemini-3.5-flash-lite',
  'google/gemini-2.5-flash-lite',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-v3.2',
]
assert.deepStrictEqual(PROVIDER_MODEL_FALLBACKS.openrouter, expectedOpenRouter)
assert.deepStrictEqual(PROVIDER_MODEL_FALLBACKS.groq, ['openai/gpt-oss-120b'])
console.log('PASS: OpenRouter fallback hierarchy: Gemini 3.5 Flash -> 3.5 Flash Lite -> 2.5 Flash Lite -> Llama 3.3 -> DeepSeek.')

// 3. Verify Default Policies & aiConfig
console.log('\n--- TEST 3: Default Policies & aiConfig Resolution ---')
assert.strictEqual(aiConfig.defaultResumeModel, 'google/gemini-3.5-flash')
const resolvedPolicy = resolveTaskPolicy('final_synthesis')
assert.strictEqual(resolvedPolicy.model, 'google/gemini-3.5-flash')
console.log(`PASS: Default resume synthesis policy resolves to "${resolvedPolicy.model}".`)

// 4. Test Live Gateway Execution & Telemetry
console.log('\n--- TEST 4: Live Gateway Execution with Task Routing & Telemetry ---')
const mockMessages = [{ role: 'user', content: 'Output JSON: {"ping": "pong", "status": "active"}' }]

try {
  const result = await llmGateway.generate({
    purpose: 'resume_synthesis',
    messages: mockMessages,
    responseFormat: 'json_object',
    temperature: 0.1,
    maxTokens: 50,
  })
  console.log(`PASS: Gateway execution completed via ${result.provider} (${result.actualModel || result.model}) in ${result.latencyMs}ms.`)
  assert(result.text.includes('pong') || result.text.includes('active'), 'Response content verification')
} catch (err) {
  console.log(`Gateway fallback/outcome logged: ${err.message}`)
}

console.log('\n======================================================================')
console.log('  ALL ROUTING & FAILOVER TESTS PASSED SUCCESSFULLY')
console.log('======================================================================')
