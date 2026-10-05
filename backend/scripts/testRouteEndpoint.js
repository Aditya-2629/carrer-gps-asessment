/**
 * HTTP Route Integration Test
 * Verifies Express route handling, input parsing, error responses, and model listing.
 */

import express from 'express'
import resumeAgentRoutes from '../routes/resumeAgentRoutes.js'
import { SYNTHETIC_BENCHMARK_RESUME } from './benchmarkResumeAgent.js'

async function runRouteTests() {
  const app = express()
  app.use(express.json())
  app.use('/api/resume-agent', resumeAgentRoutes)

  const server = app.listen(5099)
  const baseUrl = 'http://127.0.0.1:5099/api/resume-agent'

  try {
    console.log('\n--- Testing GET /api/resume-agent/models ---')
    const modelsRes = await fetch(`${baseUrl}/models`)
    const modelsData = await modelsRes.json()
    console.log('Status:', modelsRes.status)
    console.log('Models returned:', modelsData.models?.length)
    if (modelsRes.status !== 200 || !modelsData.models || modelsData.models.length < 3) {
      throw new Error('GET /models failed or returned insufficient models.')
    }
    console.log('PASS: GET /models returned model registry entries.')

    console.log('\n--- Testing POST /api/resume-agent/evaluate (Missing inputs validation) ---')
    const emptyPostRes = await fetch(`${baseUrl}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const emptyPostData = await emptyPostRes.json()
    console.log('Status:', emptyPostRes.status, 'Error message:', emptyPostData.error)
    if (emptyPostRes.status !== 400) {
      throw new Error('Expected 400 Bad Request when neither file nor text provided.')
    }
    console.log('PASS: Rejects empty input with 400 Bad Request.')

    console.log('\n--- Testing POST /api/resume-agent/evaluate (Data privacy rejection for inkling-small on real data) ---')
    const privacyPostRes = await fetch(`${baseUrl}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: SYNTHETIC_BENCHMARK_RESUME,
        targetRole: 'Senior Engineer',
        model: 'thinkingmachines/inkling-small:free',
        isSynthetic: false, // Intentionally marked false to test privacy gating!
      }),
    })
    const privacyData = await privacyPostRes.json()
    console.log('Status:', privacyPostRes.status, 'Error message:', privacyData.error)
    if (privacyPostRes.status !== 422 || !privacyData.error.includes('does not permit real candidate personal data')) {
      throw new Error('Expected 422 with privacy restriction error for inkling-small on real data.')
    }
    console.log('PASS: Privacy gating caught unapproved model for real candidate data.')

    console.log('\n========================================')
    console.log('ALL RESUME AGENT ROUTE TESTS PASSED!')
    console.log('========================================\n')
  } finally {
    server.close()
  }
}

runRouteTests().catch((e) => {
  console.error('Route test error:', e)
  process.exit(1)
})
