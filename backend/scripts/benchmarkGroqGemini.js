/**
 * Benchmark Script: Groq GPT-OSS 120B vs Groq GPT-OSS 20B vs Gemini 3.8 Flash
 * Tests models independently in benchmark mode (zero silent fallback).
 * Captures exact raw outputs, validation results, and telemetry.
 *
 * Usage:
 *   node backend/scripts/benchmarkGroqGemini.js --all
 *   node backend/scripts/benchmarkGroqGemini.js --model openai/gpt-oss-120b
 *   node backend/scripts/benchmarkGroqGemini.js --model openai/gpt-oss-20b
 *   node backend/scripts/benchmarkGroqGemini.js --model gemini-3.6-flash
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { ResumeAgentTestService } from '../services/resumeAgentTestService.js'

const MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'gemini-3.6-flash',
]

const TARGET_ROLE = 'Senior Full Stack & Cloud Systems Engineer'

async function runBenchmark() {
  const args = process.argv.slice(2)
  let modelsToRun = []

  const modelArgIdx = args.indexOf('--model')
  if (modelArgIdx !== -1 && args[modelArgIdx + 1]) {
    modelsToRun = [args[modelArgIdx + 1]]
  } else if (args.includes('--120b')) {
    modelsToRun = ['openai/gpt-oss-120b']
  } else if (args.includes('--20b')) {
    modelsToRun = ['openai/gpt-oss-20b']
  } else if (args.includes('--gemini')) {
    modelsToRun = ['gemini-3.6-flash']
  } else {
    // Default to --all
    modelsToRun = MODELS
  }

  // Load synthetic fixture
  const fixturePath = path.resolve(__dirname, '../tests/fixtures/strong-fullstack.txt')
  const resumeText = fs.readFileSync(fixturePath, 'utf8')

  console.log('='.repeat(70))
  console.log('  CAREER GPS — RESUME AGENT V1.2 BENCHMARK')
  console.log('  Models to test:', modelsToRun.join(', '))
  console.log('  Target Role:', TARGET_ROLE)
  console.log('  Synthetic Fixture:', path.basename(fixturePath))
  console.log('  Zero-Fallback Mode: ACTIVE (Isolated single-model test)')
  console.log('='.repeat(70) + '\n')

  const results = []

  for (const model of modelsToRun) {
    console.log(`\n>>> [STARTING BENCHMARK] Model: ${model} ...`)
    const startTime = Date.now()

    try {
      const result = await ResumeAgentTestService.runSingleTest({
        resumeText,
        targetRole: TARGET_ROLE,
        model,
        isSynthetic: true,
      })

      const elapsedMs = Date.now() - startTime
      results.push({ model, result, elapsedMs })

      console.log(`<<< [COMPLETED] Model: ${model} | Status: ${result.status} | Time: ${elapsedMs}ms`)
      console.log(`    Success: ${result.success}`)
      console.log(`    Validation: JSON=${result.validation?.jsonValid ?? 'N/A'}, Schema=${result.validation?.schemaValid ?? 'N/A'}, Evidence=${result.validation?.evidenceValid ?? 'N/A'}, Fabrication=${result.validation?.fabricationDetected ?? 'N/A'}`)
      if (result.telemetry) {
        console.log(`    Tokens: prompt=${result.telemetry.inputTokens}, completion=${result.telemetry.outputTokens}, latency=${result.telemetry.providerLatencyMs}ms`)
      }

      console.log('\n' + '-'.repeat(70))
      console.log(`--- REVIEW EXPORT FOR: ${model} ---`)
      console.log('-'.repeat(70))
      console.log(result.reviewExport?.text || '(No review export generated)')
      console.log('-'.repeat(70) + '\n')

    } catch (err) {
      console.error(`<<< [FAILED] Model: ${model} threw unhandled exception:`, err.message)
      results.push({
        model,
        result: {
          success: false,
          status: 'provider_failure',
          error: { message: err.message },
          rawModelOutput: null,
          parsedOutput: null,
          validation: null,
        },
        elapsedMs: Date.now() - startTime,
      })
    }
  }

  // Summary Table
  console.log('\n' + '='.repeat(70))
  console.log('  BENCHMARK SUMMARY TABLE')
  console.log('='.repeat(70))
  console.table(
    results.map((r) => ({
      Model: r.model,
      Status: r.result.status,
      Success: r.result.success,
      'JSON Valid': r.result.validation?.jsonValid ?? 'N/A',
      'Schema Valid': r.result.validation?.schemaValid ?? 'N/A',
      'Evidence Valid': r.result.validation?.evidenceValid ?? 'N/A',
      'Prompt Tokens': r.result.telemetry?.inputTokens ?? 'N/A',
      'Completion Tokens': r.result.telemetry?.outputTokens ?? 'N/A',
      'Latency (ms)': r.elapsedMs,
    }))
  )
}

runBenchmark().catch((err) => {
  console.error('[Benchmark Runner Error]:', err)
  process.exit(1)
})
