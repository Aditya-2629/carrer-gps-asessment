/**
 * Test standalone LinkedIn Agent API routes
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import linkedinAgentRoutes from '../routes/linkedinAgentRoutes.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runRouteTests() {
  console.log('================================================================')
  console.log('LINKEDIN AGENT STANDALONE API ROUTE TEST')
  console.log('================================================================\n')

  const app = express()
  app.use(express.json())
  app.use('/api/linkedin-agent', linkedinAgentRoutes)

  const server = app.listen(0)
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}`

  const origGenerate = llmGateway.generate
  try {
    // Mock LLM generation for isolated fast route testing
    llmGateway.generate = async () => ({
      text: JSON.stringify({
        headlines: [
          {
            formula: 'Recruiter-Search Optimized',
            headline: 'Senior Full Stack Engineer | React, Node.js, Python & AWS',
            whyItWorks: 'Matches high-volume recruiter boolean search filters for full-stack leads.',
          },
          {
            formula: 'Impact-Driven',
            headline: 'Senior Full Stack Engineer | Scaled Platforms for 4M+ Users',
            whyItWorks: 'Leads with verified production scale and reliability impact.',
          },
          {
            formula: 'Specialist / Authority',
            headline: 'Distributed Systems Architect | Cloud Platforms & High Throughput',
            whyItWorks: 'Positions candidate as a domain authority in distributed architectures.',
          },
        ],
        aboutRewrite: {
          hook: 'I am a Senior Full Stack Engineer specializing in resilient cloud platforms.',
          proof: 'At Apex Intelligence Labs, I architected distributed microservices serving 4M active users.',
          callToAction: 'Connect with me to discuss high-scale engineering challenges.',
          fullText:
            'I am a Senior Full Stack Engineer specializing in resilient cloud platforms.\n\nAt Apex Intelligence Labs, I architected distributed microservices serving 4M active users.\n\nConnect with me to discuss high-scale engineering challenges.',
        },
        recommendedSkillsToAdd: ['System Design', 'PostgreSQL'],
        profileRedFlags: [
          {
            title: 'Unconfigured LinkedIn headline',
            explanation: 'Recruiters cannot index your profile without Stack keywords',
            fix: 'Update headline with primary engineering stack',
          },
        ],
      }),
      actualModel: 'mock-llm',
      tokens: { prompt: 150, completion: 150 },
    })

    // Test 1: GET /api/linkedin-agent/status
    console.log('--- Test 1: GET /api/linkedin-agent/status ---')
    const statusRes = await fetch(`${baseUrl}/api/linkedin-agent/status`)
    assert.strictEqual(statusRes.status, 200)
    const statusBody = await statusRes.json()
    assert.strictEqual(statusBody.success, true)
    assert.strictEqual(statusBody.agent, 'linkedin')
    assert.strictEqual(statusBody.version, '2.0.0')
    console.log('PASS: GET /api/linkedin-agent/status returned valid agent status')

    // Test 2: GET /api/linkedin-agent/models
    console.log('\n--- Test 2: GET /api/linkedin-agent/models ---')
    const modelsRes = await fetch(`${baseUrl}/api/linkedin-agent/models`)
    assert.strictEqual(modelsRes.status, 200)
    const modelsBody = await modelsRes.json()
    assert.strictEqual(modelsBody.success, true)
    assert(Array.isArray(modelsBody.models) && modelsBody.models.length > 0)
    console.log(`PASS: GET /api/linkedin-agent/models returned ${modelsBody.models.length} registered models`)

    // Load fixture
    const swapnilRaw = fs.readFileSync(
      path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt'),
      'utf8'
    )

    // Test 3: POST /api/linkedin-agent/evaluate with JSON body (resumeText + targetRole)
    console.log('\n--- Test 3: POST /api/linkedin-agent/evaluate (JSON: Resume + Inferred Profile) ---')
    const evalRes = await fetch(`${baseUrl}/api/linkedin-agent/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: swapnilRaw,
        targetRole: 'Senior AI & Full Stack Engineer',
        runLlm: true,
      }),
    })
    assert.strictEqual(evalRes.status, 200)
    const evalBody = await evalRes.json()
    assert.strictEqual(evalBody.success, true)
    assert.strictEqual(evalBody.inferredFromResume, true)
    assert(evalBody.score > 0)
    assert.strictEqual(evalBody.optimizations.headlines.length, 3)
    assert(evalBody.optimizations.aboutRewrite?.fullText)
    console.log(`PASS: Resume-inferred evaluation succeeded with score ${evalBody.score}/100 and 3 headlines`)

    // Test 4: POST /api/linkedin-agent/evaluate with multipart form-data (Resume file + Profile JSON)
    console.log('\n--- Test 4: POST /api/linkedin-agent/evaluate (Multipart Form: Resume file + Scraped profile) ---')
    const formData = new FormData()
    const blob = new Blob([swapnilRaw], { type: 'text/plain' })
    formData.append('resume', blob, 'swapnil-jadhav.txt')
    formData.append('targetRole', 'Senior AI & Full Stack Engineer')
    formData.append(
      'linkedinData',
      JSON.stringify({
        fullName: 'Swapnil Jadhav',
        headline: 'Full Stack Developer',
        about: 'Working on software.',
        experiences: [
          {
            title: 'Full Stack Developer',
            company: 'Apex Intelligence Labs',
            dates: '2020 – Present',
            isCurrent: true,
          },
        ],
        skills: ['Python', 'Node.js'],
      })
    )

    const multiRes = await fetch(`${baseUrl}/api/linkedin-agent/evaluate`, {
      method: 'POST',
      body: formData,
    })
    assert.strictEqual(multiRes.status, 200)
    const multiBody = await multiRes.json()
    assert.strictEqual(multiBody.success, true)
    assert.strictEqual(multiBody.inferredFromResume, false)
    assert(multiBody.discrepancies.length > 0, 'Discrepancies identified')
    assert(multiBody.timelineMismatches.length > 0, 'Timeline mismatch identified')
    assert.strictEqual(multiBody.optimizations.headlines.length, 3)
    console.log(`PASS: Multipart evaluation succeeded with cross-platform discrepancy detection`)

    // Test 5: Validation - Bad request when no inputs given
    console.log('\n--- Test 5: Validation - 400 when missing inputs ---')
    const emptyRes = await fetch(`${baseUrl}/api/linkedin-agent/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.strictEqual(emptyRes.status, 400)
    console.log('PASS: Correctly rejected request with 400 when no resume or LinkedIn data provided')

    console.log('\n================================================================')
    console.log('ALL LINKEDIN AGENT API ROUTE TESTS PASSED!')
    console.log('================================================================\n')
  } finally {
    llmGateway.generate = origGenerate
    server.close()
  }
}

runRouteTests().catch((err) => {
  console.error('Route test failed:', err)
  process.exit(1)
})
