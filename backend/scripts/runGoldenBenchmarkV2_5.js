/**
 * Resume Agent V2.5 Phase 1 — Golden Run Benchmark
 *
 * Runs 5 controlled iterations against Swapnil Jadhav to verify:
 * 1. proj_002_b01 (tool-dump candidate) appears in issues[] in >= 4 of 5 runs
 * 2. contactMerge issue uses category "ats_readability" (not "formatting")
 * 3. contactMerge phrasing uses extracted-text language without claiming visual layout/text boxes
 * 4. Overall issue count stays stable (3-7 issues)
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

async function main() {
  const targetModel = process.argv[2] || process.env.BENCHMARK_MODEL || 'gemini-3.6-flash'

  console.log('================================================================')
  console.log('RESUME AGENT V2.5 PHASE 1 — GOLDEN BENCHMARK (5 ITERATIONS)')
  console.log(`Model: ${targetModel} | Prompt: ${SYNTHESIS_PROMPT_VERSION}`)
  console.log('Target: proj_002_b01 flagged in >= 4/5 runs | ats_readability category used')
  console.log('================================================================\n')

  const resumeText = fs.readFileSync(
    path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )
  const targetRole = 'Senior AI & Full Stack Engineer'

  const NUM_RUNS = 5
  const runs = []

  let proj002FlaggedCount = 0
  let atsReadabilityUsedCount = 0
  let layoutSafePhrasingCount = 0

  for (let i = 1; i <= NUM_RUNS; i++) {
    console.log(`\n>>> [Iteration ${i}/${NUM_RUNS}] Running Resume Agent...`)
    const startTime = Date.now()

    try {
      const result = await ResumeAgent.evaluate({
        resumeText,
        targetRole,
        model: targetModel,
        inputMode: 'compact_text',
        isBenchmark: true,
        useV3Pipeline: true,
        temperature: 0.2,
        topP: 0.9,
      })

      const latencyMs = Date.now() - startTime

      if (!result.success) {
        console.error(`  [Iter ${i}] FAILED: ${result.error}`)
        runs.push({ iteration: i, success: false, error: result.error, latencyMs })
        continue
      }

      const analysis = result.analysis || {}
      const issues = analysis.issues || []
      const strengths = analysis.strengths || []

      // 1. Check for proj_002_b01 in issues
      const proj002Issue = issues.find((iss) => {
        const evList = Array.isArray(iss.evidence) ? iss.evidence : [iss.evidence]
        return evList.some((e) => e?.bulletId === 'proj_002_b01')
      })
      const isProj002Flagged = Boolean(proj002Issue)
      if (isProj002Flagged) proj002FlaggedCount++

      // 2. Check for contactMerge / summary_001 issue and category
      const summaryIssue = issues.find((iss) => {
        const evList = Array.isArray(iss.evidence) ? iss.evidence : [iss.evidence]
        return evList.some((e) => e?.bulletId === 'summary_001')
      })

      let usedAtsReadability = false
      let layoutSafePhrasing = false

      if (summaryIssue) {
        if (summaryIssue.category === 'ats_readability') {
          usedAtsReadability = true
          atsReadabilityUsedCount++
        }

        const issueText = `${summaryIssue.title} ${summaryIssue.diagnosis} ${summaryIssue.whyItMatters} ${summaryIssue.recommendation}`.toLowerCase()
        const mentionsExtractedText = issueText.includes('extracted text') || issueText.includes('parsing') || issueText.includes('ats') || issueText.includes('alongside')
        const avoidsVisualClaims = !issueText.includes('text box') && !issueText.includes('text boxes') && !issueText.includes('visual columns')
        if (mentionsExtractedText && avoidsVisualClaims) {
          layoutSafePhrasing = true
          layoutSafePhrasingCount++
        }
      }

      console.log(`  [Iter ${i} SUCCESS] ${latencyMs}ms | Strengths: ${strengths.length} | Issues: ${issues.length}`)
      console.log(`    proj_002_b01 Flagged: ${isProj002Flagged ? 'YES (PASS)' : 'NO'}`)
      if (summaryIssue) {
        console.log(`    summary_001 Category: "${summaryIssue.category}" (Expected: ats_readability)`)
        console.log(`    summary_001 Extracted-Text Phrasing: ${layoutSafePhrasing ? 'YES' : 'NO'}`)
      }

      runs.push({
        iteration: i,
        success: true,
        latencyMs,
        issueCount: issues.length,
        strengthCount: strengths.length,
        isProj002Flagged,
        summaryIssueCategory: summaryIssue?.category || null,
        layoutSafePhrasing,
        proj002IssueDetails: proj002Issue
          ? {
              category: proj002Issue.category,
              title: proj002Issue.title,
              diagnosis: proj002Issue.diagnosis,
            }
          : null,
        summaryIssueDetails: summaryIssue
          ? {
              category: summaryIssue.category,
              title: summaryIssue.title,
              diagnosis: summaryIssue.diagnosis,
            }
          : null,
      })
    } catch (err) {
      console.error(`  [Iter ${i}] EXCEPTION: ${err.message}`)
      runs.push({ iteration: i, success: false, error: err.message, latencyMs: Date.now() - startTime })
    }

    // Cooling down briefly between iterations
    if (i < NUM_RUNS) {
      const isGroq = targetModel.includes('gpt-oss') || targetModel.includes('llama')
      const coolSec = isGroq ? 45 : 5
      await new Promise((res) => setTimeout(res, coolSec * 1000))
    }
  }

  // ── Results Summary ──────────────────────────────────────────────────────────
  console.log('\n================================================================')
  console.log('GOLDEN BENCHMARK RESULTS')
  console.log('================================================================')
  console.log(`Total Runs: ${NUM_RUNS} | Successful: ${runs.filter((r) => r.success).length}`)
  console.log(`proj_002_b01 Flagged in Issues: ${proj002FlaggedCount}/${NUM_RUNS} runs (Target: >= 4/5 runs)`)
  console.log(`Summary Issue Category is ats_readability: ${atsReadabilityUsedCount}/${runs.filter((r) => r.summaryIssueCategory).length}`)
  console.log(`Summary Issue uses Extracted-Text Phrasing: ${layoutSafePhrasingCount}/${runs.filter((r) => r.summaryIssueCategory).length}`)

  const passedGolden = proj002FlaggedCount >= 4
  console.log(`\nOVERALL GOLDEN BENCHMARK STATUS: ${passedGolden ? 'PASSED (>= 4/5)' : 'FAILED (< 4/5)'}`)
  console.log('================================================================\n')

  // Save detailed golden report
  const reportPath = path.join(__dirname, 'golden_benchmark_v25_results.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        benchmark: 'Resume Agent V2.5 Phase 1 Golden Run',
        timestamp: new Date().toISOString(),
        model: targetModel,
        runs,
        summary: {
          totalRuns: NUM_RUNS,
          proj002FlaggedCount,
          proj002FlaggedTarget: '>= 4',
          passed: passedGolden,
          atsReadabilityUsedCount,
          layoutSafePhrasingCount,
        },
      },
      null,
      2
    )
  )
  console.log(`Saved golden benchmark report to: ${reportPath}`)

  if (!passedGolden) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error in golden benchmark:', err)
  process.exit(1)
})
