/**
 * Resume Agent V3 — 5-Fixture Benchmark
 * Measures: JSON validity, schema validity, evidence accuracy, issue count,
 * unsupported claim rate, assumption rate, rewrite violation rate, latency, tokens.
 *
 * Saves golden test record per run (inputHash, promptVersion, signals, rawOutput, etc.)
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { SYNTHESIS_PROMPT_VERSION } from '../agents/resume/synthesis/resumeSynthesis.js'

const FIXTURES = [
  {
    name: 'GOLDEN (Swapnil Jadhav — Strong AI/Backend)',
    file: '../agents/resume/fixtures/swapnil-jadhav.txt',
    targetRole: 'Senior AI & Full Stack Engineer',
    type: 'strong_technical',
  },
  {
    name: 'WEAK (Jordan Miller — Junior Fullstack)',
    file: '../agents/resume/fixtures/weak-fullstack.txt',
    targetRole: 'Junior Full Stack Developer',
    type: 'weak',
  },
  {
    name: 'MIXED (Mixed Experience)',
    file: '../agents/resume/fixtures/mixed-experience.txt',
    targetRole: 'Full Stack Software Engineer',
    type: 'mixed',
  },
  {
    name: 'STRONG FULLSTACK (Marcus Vance)',
    file: '../agents/resume/fixtures/strong-fullstack.txt',
    targetRole: 'Senior Full Stack & Cloud Systems Engineer',
    type: 'strong_fullstack',
  },
  {
    name: 'NON-IT US (Marcus Reed — Sales)',
    file: '../agents/resume/fixtures/sales-us-professional.txt',
    targetRole: 'Regional Sales Manager',
    type: 'non_it_sales',
  },
  {
    name: 'NON-IT NON-US (Priya Sharma — Nurse)',
    file: '../agents/resume/fixtures/nurse-healthcare.txt',
    targetRole: 'Registered Nurse',
    type: 'non_it_healthcare_nonus',
  },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function runBenchmarkFixture(fixture, model = 'openai/gpt-oss-120b') {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`FIXTURE: ${fixture.name}`)
  console.log(`Type: ${fixture.type} | Role: ${fixture.targetRole}`)
  console.log('='.repeat(70))

  const resumeText = fs.readFileSync(path.join(__dirname, fixture.file), 'utf8')
  const start = Date.now()

  let result = null
  let attempts = 0
  while (attempts < 3) {
    attempts++
    result = await ResumeAgent.evaluate({
      resumeText,
      targetRole: fixture.targetRole,
      model,
      inputMode: 'compact_text',
      // isBenchmark=false so the gateway can use the production fallback chain —
      // Groq free-tier TPM (8k) can no longer fit the v3.1 prompt + output budget
      // for larger resumes. The actual model used is recorded per run.
      isBenchmark: false,
      useV3Pipeline: true,
    })
    if (result.success) break
    const isRateLimit = (result.error || '').toLowerCase().includes('rate limit') || (result.error || '').includes('429')
    if (isRateLimit && attempts < 3) {
      console.log(`[Rate limit] Waiting 30s before retry ${attempts + 1}...`)
      await sleep(30000)
    } else break
  }

  const latency = Date.now() - start

  // Metrics
  const metrics = {
    fixture: fixture.name,
    type: fixture.type,
    promptVersion: SYNTHESIS_PROMPT_VERSION,
    pipelineVersion: result.telemetry?.pipelineVersion || 'v2',
    model: result.metadata?.model || model,
    provider: result.metadata?.provider || 'unknown',
    latencyMs: latency,
    inputTokens: result.metadata?.inputTokens ?? null,
    outputTokens: result.metadata?.outputTokens ?? null,
    canonicalInputHash: result.canonicalInputHash || null,
    llmInputHash: result.llmInputHash || null,
    success: result.success,
    classification: result.classification || result.status,
    jsonValid: result.success,
    schemaValid: result.validationDetails?.isSchemaValid ?? (result.success ? true : false),
    evidenceValid: result.validationDetails?.isEvidenceValid ?? false,
    issueCount: result.analysis?.issues?.length ?? 0,
    strengthCount: result.analysis?.strengths?.length ?? 0,
    unsupportedAssumptionCount: result.validationDetails?.v3UnsupportedAssumptions?.length ?? 0,
    rewriteViolationCount: result.validationDetails?.v3RewriteViolations?.length ?? 0,
    rawOutputLength: result.rawModelOutput?.length ?? 0,
    analysisVersion: result.analysis?.analysisVersion ?? null,
    dashboardIsNull: result.analysis?.dashboard === null,
  }

  // Print results
  console.log(`Success: ${metrics.success} | Classification: ${metrics.classification}`)
  console.log(`Latency: ${metrics.latencyMs}ms`)
  console.log(`Tokens: in=${metrics.inputTokens} out=${metrics.outputTokens}`)
  console.log(`Schema Valid: ${metrics.schemaValid} | Evidence Valid: ${metrics.evidenceValid}`)
  console.log(`Strengths: ${metrics.strengthCount} | Issues: ${metrics.issueCount}`)
  console.log(`Unsupported Assumptions: ${metrics.unsupportedAssumptionCount}`)
  console.log(`Rewrite Violations: ${metrics.rewriteViolationCount}`)
  console.log(`Dashboard = null: ${metrics.dashboardIsNull}`)

  if (result.success && result.analysis) {
    const issues = result.analysis.issues || []
    if (issues.length > 0) {
      console.log('\nIssues:')
      for (const iss of issues.slice(0, 5)) {
        const ev = Array.isArray(iss.evidence) ? iss.evidence.map(e => e.bulletId).join(', ') : iss.evidence?.bulletId
        console.log(`  [${iss.severity}/${iss.category}] ${iss.title} (@${ev})`)
      }
    }

    if (result.validationDetails?.v3UnsupportedAssumptions?.length > 0) {
      console.log('\nAssumption Warnings:')
      for (const a of result.validationDetails.v3UnsupportedAssumptions.slice(0, 3)) {
        console.log(`  - ${a.location}: ${a.label} ("${a.match}")`)
      }
    }

    if (result.validationDetails?.v3RewriteViolations?.length > 0) {
      console.log('\nRewrite Violations:')
      for (const v of result.validationDetails.v3RewriteViolations.slice(0, 3)) {
        console.log(`  - ${v}`)
      }
    }
  } else if (!result.success) {
    console.log(`Error: ${result.error}`)
  }

  // Golden test record
  const goldenRecord = {
    timestamp: new Date().toISOString(),
    fixture: fixture.name,
    type: fixture.type,
    inputHash: metrics.canonicalInputHash,
    llmInputHash: metrics.llmInputHash,
    promptVersion: metrics.promptVersion,
    pipelineVersion: metrics.pipelineVersion,
    model: metrics.model,
    provider: metrics.provider,
    signals: result.state?.signals
      ? {
          skillGaps: result.state.signals.skills?.summary?.evidenceGaps,
          totalMetrics: result.state.signals.metrics?.summary?.totalMetrics,
          parserWarnings: result.state.signals.parserQuality?.warnings?.length,
        }
      : null,
    parsedOutput: result.success ? result.analysis : null,
    validationResult: {
      schemaValid: metrics.schemaValid,
      evidenceValid: metrics.evidenceValid,
      unsupportedAssumptions: result.validationDetails?.v3UnsupportedAssumptions?.length ?? 0,
      rewriteViolations: result.validationDetails?.v3RewriteViolations?.length ?? 0,
    },
    latencyMs: latency,
    tokenUsage: { input: metrics.inputTokens, output: metrics.outputTokens },
    classification: metrics.classification,
  }

  return { metrics, goldenRecord, result }
}

async function main() {
  console.log('================================================================')
  console.log('RESUME AGENT V3 — 5-FIXTURE BENCHMARK')
  console.log(`Prompt Version: ${SYNTHESIS_PROMPT_VERSION}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log('================================================================')

  const allMetrics = []
  const goldenRecords = []

  for (let i = 0; i < FIXTURES.length; i++) {
    const fixture = FIXTURES[i]
    const { metrics, goldenRecord } = await runBenchmarkFixture(fixture)
    allMetrics.push(metrics)
    goldenRecords.push(goldenRecord)

    if (i < FIXTURES.length - 1) {
      console.log('\n[Rate limit guard] Waiting 20s...')
      await sleep(20000)
    }
  }

  // ── Summary Table ───────────────────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(100))
  console.log('V3 BENCHMARK SUMMARY')
  console.log('='.repeat(100))
  console.log(
    'Fixture'.padEnd(40) +
    'OK'.padEnd(5) +
    'Schema'.padEnd(8) +
    'Evidence'.padEnd(10) +
    'Issues'.padEnd(8) +
    'Assumpt'.padEnd(9) +
    'Rewrites'.padEnd(10) +
    'Latency'
  )
  console.log('-'.repeat(100))

  for (const m of allMetrics) {
    const name = m.fixture.slice(0, 38).padEnd(40)
    const ok = (m.success ? 'YES' : 'NO').padEnd(5)
    const schema = (m.schemaValid ? 'YES' : 'NO').padEnd(8)
    const evidence = (m.evidenceValid ? 'YES' : 'NO').padEnd(10)
    const issues = String(m.issueCount).padEnd(8)
    const assumpt = String(m.unsupportedAssumptionCount).padEnd(9)
    const rewrites = String(m.rewriteViolationCount).padEnd(10)
    const latency = `${m.latencyMs}ms`
    console.log(name + ok + schema + evidence + issues + assumpt + rewrites + latency)
  }

  console.log('='.repeat(100))

  // Aggregates
  const totalSuccess = allMetrics.filter((m) => m.success).length
  const avgLatency = Math.round(allMetrics.reduce((s, m) => s + m.latencyMs, 0) / allMetrics.length)
  const totalAssumptions = allMetrics.reduce((s, m) => s + m.unsupportedAssumptionCount, 0)
  const totalViolations = allMetrics.reduce((s, m) => s + m.rewriteViolationCount, 0)

  console.log(`\nTotal Success Rate: ${totalSuccess}/${allMetrics.length}`)
  console.log(`Avg Latency: ${avgLatency}ms`)
  console.log(`Total Assumption Warnings: ${totalAssumptions}`)
  console.log(`Total Rewrite Violations: ${totalViolations}`)

  // Save benchmark results
  const resultsPath = path.join(__dirname, 'benchmark_v3_results.json')
  fs.writeFileSync(resultsPath, JSON.stringify({ timestamp: new Date().toISOString(), summary: allMetrics, goldenRecords }, null, 2))
  console.log(`\nBenchmark results saved to: ${resultsPath}`)
}

main().catch((err) => {
  console.error('Benchmark fatal failure:', err)
  process.exit(1)
})
