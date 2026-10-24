import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Explicitly load backend .env
dotenv.config({ path: path.join(__dirname, '../.env') })

import { ResumeAgentTestService } from '../services/resumeAgentTestService.js'

async function runBenchmarkV15() {
  console.log('================================================================')
  console.log('CAREER GPS RESUME AGENT V1.5 — BENCHMARK CONTROL RUN')
  console.log('Model: openai/gpt-oss-120b')
  console.log('Provider: groq')
  console.log('Input Representation: compact_text')
  console.log('Prompt: resume-expert-v1.5')
  console.log('================================================================\n')

  const fixturePath = path.join(__dirname, '../tests/fixtures/strong-fullstack.txt')
  const resumeText = fs.readFileSync(fixturePath, 'utf8')
  const targetRole = 'Senior Full Stack & Cloud Systems Engineer'

  console.log('Executing single benchmark test (no fallback, no retries)...')
  const startTime = Date.now()

  try {
    const result = await ResumeAgentTestService.runSingleTest({
      resumeText,
      targetRole,
      model: 'openai/gpt-oss-120b',
      inputMode: 'compact_text',
      isSynthetic: true,
    })

    const duration = Date.now() - startTime
    console.log(`\nExecution finished in ${duration}ms.\n`)

    const reviewExport = result.reviewExport?.text || ''
    console.log('======================= FULL REVIEW PACKAGE =======================\n')
    console.log(reviewExport)
    console.log('===================================================================')

    // Persist full results to json
    const outputPath = path.join(__dirname, 'benchmark_v15_results.json')
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
    console.log(`\nDetailed results saved to ${outputPath}`)
  } catch (err) {
    console.error('Benchmark execution failed:', err)
    process.exit(1)
  }
}

runBenchmarkV15()
