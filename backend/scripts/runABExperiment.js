import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load backend .env explicitly
dotenv.config({ path: path.join(__dirname, '../.env') })

import { ResumeAgentTestService } from '../services/resumeAgentTestService.js'

async function runABExperiment() {
  console.log('================================================================')
  console.log('CAREER GPS RESUME AGENT V1.4 — A/B INPUT EXPERIMENT')
  console.log('Model: openai/gpt-oss-120b')
  console.log('Test A: canonical_json')
  console.log('Test B: compact_text')
  console.log('================================================================\n')

  const fixturePath = path.join(__dirname, '../agents/resume/fixtures/strong-fullstack.txt')
  const resumeText = fs.readFileSync(fixturePath, 'utf8')
  const targetRole = 'Senior Full Stack & Cloud Systems Engineer'

  console.log('[1/2] Launching TEST A: canonical_json on openai/gpt-oss-120b...')
  const startA = Date.now()
  const resultA = await ResumeAgentTestService.runSingleTest({
    resumeText,
    targetRole,
    model: 'openai/gpt-oss-120b',
    inputMode: 'canonical_json',
    isSynthetic: true,
  })
  const timeA = Date.now() - startA
  console.log(`[TEST A COMPLETE] Status: ${resultA.status} | Latency: ${timeA}ms | Success: ${resultA.success}`)

  console.log('\n[2/2] Launching TEST B: compact_text on openai/gpt-oss-120b...')
  const startB = Date.now()
  const resultB = await ResumeAgentTestService.runSingleTest({
    resumeText,
    targetRole,
    model: 'openai/gpt-oss-120b',
    inputMode: 'compact_text',
    isSynthetic: true,
  })
  const timeB = Date.now() - startB
  console.log(`[TEST B COMPLETE] Status: ${resultB.status} | Latency: ${timeB}ms | Success: ${resultB.success}`)

  // Comparison Metrics Summary
  console.log('\n================================================================')
  console.log('A/B EXPERIMENT COMPARATIVE METRICS')
  console.log('================================================================')
  console.log(`Input Representation:`)
  console.log(`  Test A (Canonical JSON): ${resultA.testRun?.canonicalInputCharacters || resultA.inputSummary?.canonicalInputCharacters} chars (~${resultA.testRun?.canonicalEstimatedTokens || resultA.inputSummary?.canonicalEstimatedTokens} est. tokens) | Hash: ${resultA.canonicalInputHash}`)
  console.log(`  Test B (Compact Text):   ${resultB.testRun?.compactInputCharacters || resultB.inputSummary?.compactInputCharacters} chars (~${resultB.testRun?.compactEstimatedTokens || resultB.inputSummary?.compactEstimatedTokens} est. tokens) | Hash: ${resultB.llmInputHash}`)
  console.log(`  Input Size Reduction:    ${resultB.inputSizeReductionPercent}%`)

  console.log(`\nExecution & Latency:`)
  console.log(`  Test A Latency: ${resultA.testRun?.latencyMs}ms (Provider: ${resultA.telemetry?.providerLatencyMs}ms)`)
  console.log(`  Test B Latency: ${resultB.testRun?.latencyMs}ms (Provider: ${resultB.telemetry?.providerLatencyMs}ms)`)

  console.log(`\nValidation & Quality:`)
  console.log(`  Test A JSON Valid:        ${resultA.validation?.jsonValid ? 'PASS' : 'FAIL'}`)
  console.log(`  Test A Schema Valid:      ${resultA.validation?.schemaValid ? 'PASS' : 'FAIL'}`)
  console.log(`  Test A Evidence Valid:    ${resultA.validation?.evidenceValid ? 'PASS' : 'FAIL'}`)
  console.log(`  Test A Fabrication:       ${resultA.validation?.fabricationDetected ? 'DETECTED' : 'NONE'}`)

  console.log(`\n  Test B JSON Valid:        ${resultB.validation?.jsonValid ? 'PASS' : 'FAIL'}`)
  console.log(`  Test B Schema Valid:      ${resultB.validation?.schemaValid ? 'PASS' : 'FAIL'}`)
  console.log(`  Test B Evidence Valid:    ${resultB.validation?.evidenceValid ? 'PASS' : 'FAIL'}`)
  console.log(`  Test B Fabrication:       ${resultB.validation?.fabricationDetected ? 'DETECTED' : 'NONE'}`)

  console.log(`\nTokens Telemetry:`)
  console.log(`  Test A Tokens: Prompt: ${resultA.telemetry?.inputTokens ?? 'N/A'}, Completion: ${resultA.telemetry?.outputTokens ?? 'N/A'}`)
  console.log(`  Test B Tokens: Prompt: ${resultB.telemetry?.inputTokens ?? 'N/A'}, Completion: ${resultB.telemetry?.outputTokens ?? 'N/A'}`)

  // Save raw artifacts and results
  const summaryPackage = {
    testA: {
      inputMode: 'canonical_json',
      model: 'openai/gpt-oss-120b',
      testRun: resultA.testRun,
      validation: resultA.validation,
      telemetry: resultA.telemetry,
      rawOutputLength: (resultA.rawModelOutput || '').length,
      parsedOutput: resultA.parsedOutput,
      reviewExport: resultA.reviewExport?.text,
    },
    testB: {
      inputMode: 'compact_text',
      model: 'openai/gpt-oss-120b',
      testRun: resultB.testRun,
      validation: resultB.validation,
      telemetry: resultB.telemetry,
      rawOutputLength: (resultB.rawModelOutput || '').length,
      parsedOutput: resultB.parsedOutput,
      reviewExport: resultB.reviewExport?.text,
    },
  }

  const outPath = path.join(__dirname, 'ab_experiment_results.json')
  fs.writeFileSync(outPath, JSON.stringify(summaryPackage, null, 2), 'utf8')
  console.log(`\nFull A/B experiment package written to: ${outPath}`)

  console.log('\n================================================================')
  console.log('COMPLETE REVIEW PACKAGE: TEST A (CANONICAL JSON)')
  console.log('================================================================')
  console.log(resultA.reviewExport?.text || '(No export)')

  console.log('\n================================================================')
  console.log('COMPLETE REVIEW PACKAGE: TEST B (COMPACT TEXT)')
  console.log('================================================================')
  console.log(resultB.reviewExport?.text || '(No export)')
}

runABExperiment().catch((err) => {
  console.error('Fatal A/B experiment failure:', err)
  process.exit(1)
})
