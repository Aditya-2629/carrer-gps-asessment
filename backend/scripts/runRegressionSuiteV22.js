/**
 * Regression Suite for Resume Agent V2.2 (Live Execution)
 * Tests:
 * 1. Golden test: Swapnil Jadhav fixture
 * 2. Small resume: weak-fullstack.txt
 * 3. Medium resume: mixed-experience.txt
 * 4. Large resume: strong-fullstack.txt
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { PROMPT_VERSION } from '../agents/resume/resumeAgent.prompt.js'

async function runLiveEvaluation(name, fixturePath, targetRole, model = 'openai/gpt-oss-120b') {
  console.log('\n' + '='.repeat(80))
  console.log(`TEST RUN: ${name}`)
  console.log(`Fixture: ${fixturePath}`)
  console.log(`Target Role: ${targetRole}`)
  console.log(`Model: ${model}`)
  console.log('='.repeat(80))

  const resumeText = fs.readFileSync(path.join(__dirname, fixturePath), 'utf8')
  const startTime = Date.now()

  let result = null
  let attempts = 0
  const maxAttempts = 3
  while (attempts < maxAttempts) {
    attempts++
    result = await ResumeAgent.evaluate({
      resumeText,
      targetRole,
      model,
      inputMode: 'compact_text',
      isBenchmark: true,
    })
    if (result.success) break
    const isRateLimit =
      (result.error || '').toLowerCase().includes('rate limit') || (result.error || '').includes('429')
    if (isRateLimit && attempts < maxAttempts) {
      console.log(`[Rate Limit Hit] Waiting 30s before retry attempt ${attempts + 1}...`)
      await new Promise((r) => setTimeout(r, 30000))
    } else {
      break
    }
  }

  const durationMs = Date.now() - startTime

  console.log(`Response received in ${durationMs}ms:`)
  console.log(`  Success: ${result.success}`)
  console.log(`  Classification: ${result.classification || result.status}`)
  console.log(`  Finish Reason: ${result.metadata?.finishReason || result.telemetry?.finishReason || 'N/A'}`)
  console.log(`  Provider: ${result.metadata?.provider}`)
  console.log(`  Model: ${result.metadata?.model}`)
  console.log(`  Prompt Capture: ${result.promptCapture ? 'Present (OK)' : 'MISSING'}`)
  console.log(`  Prompt Version: ${result.promptCapture?.version || PROMPT_VERSION}`)

  if (result.success && result.analysis) {
    const analysis = result.analysis
    console.log(`  Analysis Version: ${analysis.analysisVersion}`)
    console.log(`  Dashboard: ${JSON.stringify(analysis.dashboard)}`)
    console.log(`  Strengths Count: ${analysis.strengths?.length || 0}`)
    console.log(`  Issues Count: ${analysis.issues?.length || 0}`)
    console.log(`  Priority Actions Count: ${analysis.priorityActions?.length || 0}`)

    console.log('\n  Sample Strengths:')
    for (const str of (analysis.strengths || []).slice(0, 3)) {
      const evText = Array.isArray(str.evidence)
        ? str.evidence.map((e) => e.bulletId || e.itemId).join(', ')
        : str.evidence?.bulletId || str.evidence?.itemId || 'N/A'
      console.log(`    - [${str.id}] ${str.title} (Evidence: ${evText})`)
    }

    console.log('\n  Sample Issues:')
    for (const iss of (analysis.issues || []).slice(0, 3)) {
      const evText = Array.isArray(iss.evidence)
        ? iss.evidence.map((e) => e.bulletId || e.itemId).join(', ')
        : iss.evidence?.bulletId || iss.evidence?.itemId || 'N/A'
      console.log(`    - [${iss.id}] (${iss.severity} / ${iss.category}): "${iss.title}" (Evidence: ${evText})`)
      console.log(`      CorrectedText: ${iss.correctedText ? `"${iss.correctedText.slice(0, 80)}..."` : 'null'}`)
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log(`\n  Advisory Warnings (${result.warnings.length}):`)
      result.warnings.slice(0, 3).forEach((w) => console.log(`    * ${w}`))
    }
  } else {
    console.log(`  Error: ${result.error}`)
    console.log(`  Validation Details: ${JSON.stringify(result.validationDetails?.errors || [])}`)
  }

  return { name, durationMs, result }
}

async function main() {
  console.log('STARTING RESUME AGENT V2.2 FULL REGRESSION SUITE')
  console.log(`Prompt Version: ${PROMPT_VERSION}`)

  const runs = []

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // 1. Golden Test: Swapnil Jadhav
  runs.push(
    await runLiveEvaluation(
      'GOLDEN TEST (Swapnil Jadhav)',
      '../agents/resume/fixtures/swapnil-jadhav.txt',
      'Senior AI & Full Stack Engineer'
    )
  )

  console.log('\n[RateLimit Guard] Waiting 20s before next run...')
  await sleep(20000)

  // 2. Small Resume: weak-fullstack.txt
  runs.push(
    await runLiveEvaluation(
      'SMALL RESUME (Jordan Miller)',
      '../agents/resume/fixtures/weak-fullstack.txt',
      'Junior Full Stack Developer'
    )
  )

  console.log('\n[RateLimit Guard] Waiting 20s before next run...')
  await sleep(20000)

  // 3. Medium Resume: mixed-experience.txt
  runs.push(
    await runLiveEvaluation(
      'MEDIUM RESUME (Mixed Experience)',
      '../agents/resume/fixtures/mixed-experience.txt',
      'Full Stack Software Engineer'
    )
  )

  console.log('\n[RateLimit Guard] Waiting 20s before next run...')
  await sleep(20000)

  // 4. Large Resume: strong-fullstack.txt
  runs.push(
    await runLiveEvaluation(
      'LARGE RESUME (Marcus Vance)',
      '../agents/resume/fixtures/strong-fullstack.txt',
      'Senior Full Stack & Cloud Systems Engineer'
    )
  )

  console.log('\n' + '='.repeat(80))
  console.log('REGRESSION SUITE RUN SUMMARY')
  console.log('='.repeat(80))
  for (const { name, durationMs, result } of runs) {
    const status = result.classification || (result.success ? 'SUCCESS' : 'FAILED')
    console.log(`- ${name.padEnd(35)} : ${status.padEnd(25)} (${durationMs}ms)`)
  }
  console.log('='.repeat(80) + '\n')
}

main().catch((err) => {
  console.error('Regression suite fatal failure:', err)
  process.exit(1)
})
