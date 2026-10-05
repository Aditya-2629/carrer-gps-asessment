/**
 * Comprehensive Test Suite for Resume Agent V1.1 Test Lab Endpoints
 */

import express from 'express'
import resumeAgentTestRoutes from '../routes/resumeAgentTestRoutes.js'
import { SYNTHETIC_BENCHMARK_RESUME } from './benchmarkResumeAgent.js'

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`PASS: ${msg}`)
}

async function runTestLabSuite() {
  const app = express()
  app.use(express.json())
  app.use('/api/resume-agent/test', resumeAgentTestRoutes)

  const server = app.listen(5098)
  const baseUrl = 'http://127.0.0.1:5098/api/resume-agent/test'

  try {
    console.log('\n--- 1. Testing GET /api/resume-agent/test/health ---')
    const healthRes = await fetch(`${baseUrl}/health`)
    const health = await healthRes.json()
    assert(healthRes.status === 200, 'Health endpoint returns 200')
    assert(health.service === 'resume-agent-test', 'Service name is resume-agent-test')
    assert(health.gatewayAvailable === true, 'Gateway is available')
    assert(health.registeredModels >= 3, 'Registered models count >= 3')

    console.log('\n--- 2. Testing GET /api/resume-agent/test/models ---')
    const modelsRes = await fetch(`${baseUrl}/models`)
    const modelsData = await modelsRes.json()
    assert(modelsRes.status === 200, 'Models endpoint returns 200')
    assert(Array.isArray(modelsData.models), 'Returns models array')

    const gemma = modelsData.models.find((m) => m.id === 'google/gemma-4-26b-a4b-it:free')
    assert(gemma && gemma.allowPersonalData === true, 'Gemma allows personal data')

    const inkling = modelsData.models.find((m) => m.id === 'thinkingmachines/inkling-small:free')
    assert(inkling && inkling.allowPersonalData === false, 'Inkling Small prohibits real personal data')

    console.log('\n--- 3. Testing POST /api/resume-agent/test/run Validation ---')
    // Missing model
    const noModelRes = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: SYNTHETIC_BENCHMARK_RESUME }),
    })
    assert(noModelRes.status === 400, 'Rejects run without explicit model selection (400)')

    // Missing resume
    const noResumeRes = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemma-4-26b-a4b-it:free' }),
    })
    assert(noResumeRes.status === 400, 'Rejects run without resume text or file (400)')

    console.log('\n--- 4. Testing POST /api/resume-agent/test/run Privacy Gating ---')
    const privacyRes = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: SYNTHETIC_BENCHMARK_RESUME,
        model: 'thinkingmachines/inkling-small:free',
        isSynthetic: false, // Disallowed!
      }),
    })
    const privacyData = await privacyRes.json()
    assert(privacyRes.status === 422, 'Returns 422 for unapproved model with real data')
    assert(privacyData.code === 'DATA_PRIVACY_ERROR', 'Returns DATA_PRIVACY_ERROR code')
    assert(privacyData.validation.errors.length > 0, 'Records privacy error in validation')

    console.log('\n--- 5. Testing POST /api/resume-agent/test/compare ---')
    const compareRes = await fetch(`${baseUrl}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: SYNTHETIC_BENCHMARK_RESUME,
        targetRole: 'Staff Full Stack Engineer',
        models: [
          'google/gemma-4-26b-a4b-it:free',
          'thinkingmachines/inkling-small:free',
        ],
        isSynthetic: false, // Gemma allowed, inkling blocked!
      }),
    })
    const compareData = await compareRes.json()
    assert(compareRes.status === 200, 'Compare returns 200')
    assert(compareData.comparisonRunId.startsWith('cmp_'), 'Generates comparisonRunId')
    assert(Boolean(compareData.inputHash), 'Generates deterministic inputHash')
    assert(compareData.runs.length === 2, 'Runs array has 2 model entries')

    const inklingRun = compareData.runs.find((r) => r.model === 'thinkingmachines/inkling-small:free')
    assert(inklingRun && inklingRun.status === 'blocked', 'Inkling is marked blocked when isSynthetic=false')
    assert(
      inklingRun.reviewExport &&
        (inklingRun.reviewExport.text.toLowerCase().includes('blocked') ||
          inklingRun.reviewExport.header.includes('BLOCKED')),
      'Review export reflects blocked status'
    )

    console.log('\n========================================')
    console.log('ALL RESUME AGENT V1.1 TEST LAB ROUTES PASSED!')
    console.log('========================================\n')
  } finally {
    server.close()
  }
}

runTestLabSuite().catch((e) => {
  console.error('Test suite failed:', e)
  process.exit(1)
})
