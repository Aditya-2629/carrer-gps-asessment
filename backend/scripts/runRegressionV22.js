import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

import { ResumeAgentPrompt, PROMPT_VERSION } from '../agents/resume/resumeAgent.prompt.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'

async function runRegression() {
  console.log('='.repeat(80))
  console.log(`CAREER GPS RESUME AGENT V2.2 — BENCHMARK REGRESSION RUN`)
  console.log(`Prompt Version: ${PROMPT_VERSION}`)
  console.log(`Model: openai/gpt-oss-120b via Groq`)
  console.log('='.repeat(80))

  const rawResume = fs.readFileSync(path.join(__dirname, '../tests/fixtures/strong-fullstack.txt'), 'utf8')
  const canonical = ResumeNormalizer.normalize({ rawText: rawResume }, 'Senior Full Stack & Cloud Systems Engineer')
  const messages = ResumeAgentPrompt.buildMessages(canonical, 'Senior Full Stack & Cloud Systems Engineer', { inputMode: 'compact_text' })

  const startTime = Date.now()
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  })

  const latencyMs = Date.now() - startTime
  const data = await res.json()
  if (!res.ok) {
    console.error('Groq API error:', data.error)
    process.exit(1)
  }

  const rawModelOutput = data.choices[0].message.content
  console.log(`\nModel responded in ${latencyMs}ms (${rawModelOutput.length} chars).`)

  const parsedOutput = ResumeAgentValidator.cleanAndParse(rawModelOutput)
  const validation = ResumeAgentValidator.validate(parsedOutput, canonical)

  console.log('\n--- VALIDATION RESULTS ---')
  console.log('JSON Valid: true')
  console.log(`Schema Valid: ${validation.isValid}`)
  console.log(`Evidence Valid: ${validation.isValid && validation.warnings.length === 0}`)
  console.log(`Fabrication Warnings / Claims: ${validation.unsupportedClaims.length}`)
  console.log(`Placeholder / Fabricated Number Warnings: ${validation.placeholderWarnings.length}`)
  console.log(`Total Errors: ${validation.errors.length}`)
  console.log(`Total Warnings: ${validation.warnings.length}`)

  if (validation.placeholderWarnings.length > 0) {
    console.log('\n[FLAGGED] Placeholder/Fabrication Warnings Details:')
    for (const pw of validation.placeholderWarnings) {
      console.log(`  - [${pw.code}] ${pw.field}: "${pw.token || pw.claim}" (issue: ${pw.issueId || 'n/a'})`)
    }
  } else {
    console.log('\n[CLEAN] Zero placeholder metric or fabricated number warnings detected.')
  }

  console.log('\n--- OVERALL REVIEW ---')
  console.log(parsedOutput.overallReview)

  console.log('\n--- STRENGTHS ---')
  for (const str of parsedOutput.strengths || []) {
    console.log(`- [${str.id}] ${str.title}: ${str.signal} (Evidence: ${str.evidence?.bulletId})`)
  }

  console.log('\n--- ISSUES & RECOMMENDATIONS ---')
  for (const iss of parsedOutput.issues || []) {
    console.log(`\nIssue [${iss.id}] (${iss.severity} / ${iss.category}): "${iss.title}"`)
    console.log(`  Evidence [${iss.evidence?.bulletId}]: "${iss.evidence?.originalText}"`)
    console.log(`  Diagnosis: ${iss.diagnosis}`)
    console.log(`  Recommendation: "${iss.recommendation}"`)
    console.log(`  CorrectedText: ${iss.correctedText ? `"${iss.correctedText}"` : 'null'} (${iss.correctionType})`)
  }

  console.log('\n--- PRIORITY ACTIONS ---')
  for (const pa of parsedOutput.priorityActions || []) {
    console.log(`${pa.order}. [${pa.impact}] ${pa.title}: "${pa.action}"`)
  }

  // Persist full regression output
  const regressionArtifact = {
    promptVersion: PROMPT_VERSION,
    model: 'openai/gpt-oss-120b',
    provider: 'groq',
    latencyMs,
    rawModelOutput,
    parsedOutput,
    validation,
    timestamp: new Date().toISOString(),
  }

  const outputPath = path.join(__dirname, 'regression_v22_results.json')
  fs.writeFileSync(outputPath, JSON.stringify(regressionArtifact, null, 2), 'utf8')
  console.log(`\nFull regression package persisted to: ${outputPath}`)
}

runRegression().catch((err) => {
  console.error('Regression run failed:', err)
  process.exit(1)
})
