/**
 * Eval Suite Runner — generalized regression harness (Phase D).
 *
 * Runs the resume agent across all fixtures (IT + non-IT + non-US) and checks
 * platform invariants: success, schema validity, scorecard present, judge
 * score, fabrication warnings. Saves a timestamped results file so every
 * prompt-version bump produces a comparable diff.
 *
 * Usage:  node scripts/runEvalSuite.js [--quick]   (--quick = 3 fixtures)
 *
 * NOTE: uses the live LLM (falls back across providers). Groq free tier cannot
 * fit the v3.1 prompt — expect Gemini. Each fixture ~30-90s.
 */

import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env', import.meta.url).pathname })

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { judgeReport } from '../agents/judge/judgeAgent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, '../agents/resume/fixtures')
const OUT_PATH = path.join(__dirname, 'eval_suite_results.json')

const ALL_FIXTURES = [
  { file: 'swapnil-jadhav.txt', role: 'Senior AI & Full Stack Engineer', type: 'it_strong' },
  { file: 'weak-fullstack.txt', role: 'Junior Full Stack Developer', type: 'it_weak' },
  { file: 'sales-us-professional.txt', role: 'Regional Sales Manager', type: 'non_it_us' },
  { file: 'nurse-healthcare.txt', role: 'Registered Nurse', type: 'non_it_nonus' },
  { file: 'mixed-experience.txt', role: 'Full Stack Software Engineer', type: 'it_mixed' },
  { file: 'strong-fullstack.txt', role: 'Senior Full Stack & Cloud Systems Engineer', type: 'it_strong' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function runFixture(fixture) {
  const text = fs.readFileSync(path.join(FIXTURES_DIR, fixture.file), 'utf8')
  const startedAt = Date.now()

  const result = await ResumeAgent.evaluate({
    resumeText: text,
    targetRole: fixture.role,
    isBenchmark: false, // allow provider fallback — free-tier reality
  })

  const row = {
    fixture: fixture.file,
    type: fixture.type,
    success: result.success,
    status: result.status || null,
    model: result.metadata?.model || null,
    latencyMs: Date.now() - startedAt,
    score: result.analysis?.dashboard?.score ?? null,
    grade: result.analysis?.dashboard?.grade ?? null,
    issueCount: result.analysis?.issues?.length ?? null,
    strengthsCount: result.analysis?.strengths?.length ?? null,
    rewriteViolations: result.validationDetails?.v3RewriteViolations?.length ?? null,
    unsupportedAssumptions: result.validationDetails?.v3UnsupportedAssumptions?.length ?? null,
    usMarketIssues: (result.analysis?.issues || []).filter((i) => i.category === 'us_market_alignment').length,
    judgeScore: null,
    judgeFallback: null,
  }

  // Judge gate on the successful analysis
  if (result.success && result.analysis) {
    try {
      const judge = await judgeReport(result.analysis)
      row.judgeScore = judge.result?.score ?? null
      row.judgeFallback = Boolean(judge.result?.fallback)
    } catch (_e) {
      row.judgeScore = null
    }
  }

  return row
}

const invariants = (row) => ({
  succeeded: row.success === true,
  hasScorecard: row.score !== null && row.grade !== null,
  noRewriteViolations: row.rewriteViolations === 0,
  noAssumptions: row.unsupportedAssumptions === 0,
  judgePassed: row.judgeScore === null ? null : row.judgeScore >= 7,
})

async function main() {
  const quick = process.argv.includes('--quick')
  const fixtures = quick ? ALL_FIXTURES.slice(0, 3) : ALL_FIXTURES

  console.log(`EVAL SUITE — ${fixtures.length} fixtures (prompt: resume-synthesis, judge gate: on)\n`)

  const rows = []
  for (const [i, fixture] of fixtures.entries()) {
    process.stdout.write(`[${i + 1}/${fixtures.length}] ${fixture.file} … `)
    try {
      const row = await runFixture(fixture)
      rows.push(row)
      const inv = invariants(row)
      console.log(
        `${row.success ? 'OK' : 'FAIL'} | score ${row.score ?? '—'} ${row.grade ?? ''} | judge ${row.judgeScore ?? '—'} | ${row.latencyMs}ms | ${row.model || ''}`
      )
      if (!inv.succeeded) console.log(`   ↳ status: ${row.status}`)
    } catch (e) {
      rows.push({ fixture: fixture.file, type: fixture.type, success: false, error: e.message })
      console.log(`ERROR: ${e.message}`)
    }
    if (i < fixtures.length - 1) await sleep(2000)
  }

  const summary = {
    timestamp: new Date().toISOString(),
    fixtureCount: rows.length,
    successRate: rows.filter((r) => r.success).length / rows.length,
    avgScore: (() => {
      const s = rows.map((r) => r.score).filter((v) => typeof v === 'number')
      return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null
    })(),
    avgJudge: (() => {
      const s = rows.map((r) => r.judgeScore).filter((v) => typeof v === 'number')
      return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null
    })(),
    totalViolations: rows.reduce((a, r) => a + (r.rewriteViolations || 0), 0),
    rows,
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2))
  console.log(
    `\nSUMMARY — success ${(summary.successRate * 100).toFixed(0)}% | avg score ${summary.avgScore} | avg judge ${summary.avgJudge} | violations ${summary.totalViolations}`
  )
  console.log(`Saved: ${OUT_PATH}`)
}

main().catch((e) => {
  console.error('Eval suite crashed:', e)
  process.exit(1)
})
