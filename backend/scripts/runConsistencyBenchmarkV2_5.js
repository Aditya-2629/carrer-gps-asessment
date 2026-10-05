/**
 * Resume Agent V2.5.1 — Deterministic Consistency Benchmark
 *
 * Runs 5 controlled iterations against Swapnil Jadhav with frozen configuration:
 * - temperature: 0.2
 * - topP: 0.9
 * - model: openai/gpt-oss-120b (Groq)
 * - inputMode: compact_text
 * - isBenchmark: true
 *
 * Evaluates issue-selection variance, strength consistency, and Jaccard overlap.
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

function computeJaccard(setA, setB) {
  const sA = new Set(setA)
  const sB = new Set(setB)
  if (sA.size === 0 && sB.size === 0) return 1.0
  const union = new Set([...sA, ...sB])
  let intersectionCount = 0
  for (const item of sA) {
    if (sB.has(item)) intersectionCount++
  }
  return intersectionCount / union.size
}

function extractIssueKeys(issues = []) {
  return issues.map((iss) => {
    const ev = Array.isArray(iss.evidence) ? iss.evidence[0]?.bulletId : iss.evidence?.bulletId
    return `${iss.category || 'unknown'}:${ev || iss.title || 'no_ev'}`
  })
}

function extractStrengthKeys(strengths = []) {
  return strengths.map((str) => {
    const ev = Array.isArray(str.evidence) ? str.evidence[0]?.bulletId : str.evidence?.bulletId
    return ev || str.title || 'no_ev'
  })
}

async function main() {
  const targetModel = process.argv[2] || process.env.BENCHMARK_MODEL || 'openai/gpt-oss-20b'

  console.log('================================================================')
  console.log('RESUME AGENT V2.5.1 — DETERMINISTIC CONSISTENCY BENCHMARK')
  console.log(`5 Iterations | Frozen Config: temp=0.2, topP=0.9 | Model: ${targetModel}`)
  console.log(`Synthesis Prompt Version: ${SYNTHESIS_PROMPT_VERSION}`)
  console.log('================================================================\n')

  const resumeText = fs.readFileSync(
    path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )
  const targetRole = 'Senior AI & Full Stack Engineer'

  const NUM_RUNS = 5
  const runs = []

  for (let i = 1; i <= NUM_RUNS; i++) {
    console.log(`\n>>> [Iteration ${i}/${NUM_RUNS}] Executing Resume Agent...`)
    let attempt = 0
    let iterSuccess = false

    while (attempt < 3 && !iterSuccess) {
      attempt++
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
          const errMsg = result.error || ''
          const is429 = errMsg.includes('429') || errMsg.includes('Rate limit')
          if (is429 && attempt < 3) {
            const waitMatch = errMsg.match(/try again in ([\d.]+)s/i)
            const waitSeconds = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) + 3 : 48
            console.log(`  [Iter ${i}] Rate limit (429) hit on attempt ${attempt}. Cooling down for ${waitSeconds}s before retrying...`)
            await new Promise((res) => setTimeout(res, waitSeconds * 1000))
            continue
          }

          console.error(`  [Iter ${i}] FAILED: ${result.error}`)
          runs.push({ iteration: i, success: false, error: result.error, latencyMs })
          break
        }

        const analysis = result.analysis || {}
        const strengths = analysis.strengths || []
        const issues = analysis.issues || []
        const priorityActions = analysis.priorityActions || []
        const reviewText = typeof analysis.overallReview === 'string'
          ? analysis.overallReview
          : analysis.overallReview?.summary || ''
        const wordCount = reviewText.split(/\s+/).filter(Boolean).length

        const issueKeys = extractIssueKeys(issues)
        const strengthKeys = extractStrengthKeys(strengths)

        console.log(`  [Iter ${i} SUCCESS] ${latencyMs}ms | Strengths: ${strengths.length} | Issues: ${issues.length} | Review Words: ${wordCount}`)
        console.log(`    Strengths: ${strengthKeys.join(', ')}`)
        console.log(`    Issues: ${issueKeys.join(', ')}`)

        runs.push({
          iteration: i,
          success: true,
          latencyMs,
          strengths,
          issues,
          priorityActions,
          strengthKeys,
          issueKeys,
          reviewWordCount: wordCount,
          reviewText,
          validationDetails: {
            recommendationWarnings: result.validationDetails?.v3RecommendationWarnings?.length || 0,
            consistencyResolutions: result.validationDetails?.v3ConsistencyResolutions?.length || 0,
            unsupportedAssumptions: result.validationDetails?.v3UnsupportedAssumptions?.length || 0,
            rewriteViolations: result.validationDetails?.v3RewriteViolations?.length || 0,
          },
        })
        iterSuccess = true
      } catch (err) {
        const errMsg = err.message || ''
        const is429 = errMsg.includes('429') || errMsg.includes('Rate limit')
        if (is429 && attempt < 3) {
          const waitMatch = errMsg.match(/try again in ([\d.]+)s/i)
          const waitSeconds = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) + 3 : 48
          console.log(`  [Iter ${i}] Rate limit (429) hit on attempt ${attempt}. Cooling down for ${waitSeconds}s before retrying...`)
          await new Promise((res) => setTimeout(res, waitSeconds * 1000))
          continue
        }
        console.error(`  [Iter ${i}] EXCEPTION: ${err.message}`)
        runs.push({ iteration: i, success: false, error: err.message, latencyMs: Date.now() - startTime })
        break
      }
    }

    // Cool down between iterations
    if (i < NUM_RUNS && iterSuccess) {
      const isGroq = targetModel.includes('gpt-oss') || targetModel.includes('llama')
      const cooldownSec = isGroq ? 45 : 5
      console.log(`  Cooling down ${cooldownSec}s before Iteration ${i + 1}...`)
      await new Promise((res) => setTimeout(res, cooldownSec * 1000))
    }
  }

  // ── Metrics Analysis ─────────────────────────────────────────────────────────
  const successfulRuns = runs.filter((r) => r.success)
  console.log('\n================================================================')
  console.log('CONSISTENCY & VARIANCE ANALYSIS')
  console.log('================================================================')
  console.log(`Successful Runs: ${successfulRuns.length}/${NUM_RUNS}`)

  if (successfulRuns.length < 2) {
    console.error('Not enough successful runs to compute consistency metrics.')
    process.exit(1)
  }

  // 1. Issue Counts
  const issueCounts = successfulRuns.map((r) => r.issues.length)
  const strengthCounts = successfulRuns.map((r) => r.strengths.length)
  const wordCounts = successfulRuns.map((r) => r.reviewWordCount)

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const stdDev = (arr) => {
    const m = avg(arr)
    return Math.sqrt(arr.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / arr.length)
  }

  console.log(`\nCount Statistics:`)
  console.log(`  Issues Count:      Mean=${avg(issueCounts).toFixed(2)}, Min=${Math.min(...issueCounts)}, Max=${Math.max(...issueCounts)}, StdDev=${stdDev(issueCounts).toFixed(2)}`)
  console.log(`  Strengths Count:   Mean=${avg(strengthCounts).toFixed(2)}, Min=${Math.min(...strengthCounts)}, Max=${Math.max(...strengthCounts)}, StdDev=${stdDev(strengthCounts).toFixed(2)}`)
  console.log(`  Review Word Count: Mean=${avg(wordCounts).toFixed(0)}, Min=${Math.min(...wordCounts)}, Max=${Math.max(...wordCounts)} (Target: 100–180)`)

  // 2. Pairwise Jaccard Overlap
  const pairwiseIssueJaccards = []
  const pairwiseStrengthJaccards = []

  for (let a = 0; a < successfulRuns.length; a++) {
    for (let b = a + 1; b < successfulRuns.length; b++) {
      const jIssue = computeJaccard(successfulRuns[a].issueKeys, successfulRuns[b].issueKeys)
      const jStrength = computeJaccard(successfulRuns[a].strengthKeys, successfulRuns[b].strengthKeys)
      pairwiseIssueJaccards.push(jIssue)
      pairwiseStrengthJaccards.push(jStrength)
    }
  }

  const avgIssueJaccard = avg(pairwiseIssueJaccards)
  const avgStrengthJaccard = avg(pairwiseStrengthJaccards)

  console.log(`\nPairwise Jaccard Consistency:`)
  console.log(`  Issue Selection Overlap:    ${(avgIssueJaccard * 100).toFixed(1)}%`)
  console.log(`  Strength Selection Overlap: ${(avgStrengthJaccard * 100).toFixed(1)}%`)

  // 3. Issue Frequency Distribution
  const issueFreq = {}
  successfulRuns.forEach((r) => {
    const seenInRun = new Set(r.issueKeys)
    seenInRun.forEach((k) => {
      issueFreq[k] = (issueFreq[k] || 0) + 1
    })
  })

  console.log(`\nIssue Recurrence Distribution (across ${successfulRuns.length} runs):`)
  for (const [key, count] of Object.entries(issueFreq).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / successfulRuns.length) * 100).toFixed(0)
    console.log(`  [${count}/${successfulRuns.length} runs | ${pct}%] ${key}`)
  }

  // 4. Strength Frequency Distribution
  const strengthFreq = {}
  successfulRuns.forEach((r) => {
    const seenInRun = new Set(r.strengthKeys)
    seenInRun.forEach((k) => {
      strengthFreq[k] = (strengthFreq[k] || 0) + 1
    })
  })

  console.log(`\nStrength Recurrence Distribution (across ${successfulRuns.length} runs):`)
  for (const [key, count] of Object.entries(strengthFreq).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / successfulRuns.length) * 100).toFixed(0)
    console.log(`  [${count}/${successfulRuns.length} runs | ${pct}%] ${key}`)
  }

  // 5. Findings & Conclusion
  console.log('\n================================================================')
  console.log('EXPERIMENT CONCLUSION & DIAGNOSIS')
  console.log('================================================================')
  const isHighConsistency = avgIssueJaccard >= 0.8 && avgStrengthJaccard >= 0.8
  const isModerateConsistency = avgIssueJaccard >= 0.6 && avgStrengthJaccard >= 0.6

  if (isHighConsistency) {
    console.log('RESULT: HIGH CONSISTENCY (≥80% overlap).')
    console.log('The consistency layer and deterministic evidence classifier have successfully stabilized issue and strength selection.')
  } else if (isModerateConsistency) {
    console.log('RESULT: MODERATE CONSISTENCY (60–79% overlap).')
    console.log('Core issues and strengths recur reliably; residual variance is primarily sampling variability from generative temperature/topP rather than signal gaps.')
  } else {
    console.log('RESULT: HIGH VARIANCE (<60% overlap).')
    console.log('Issue variance is elevated, indicating that deterministic issue coverage requires further narrowing.')
  }

  // Save report to JSON
  const reportPath = path.join(__dirname, 'consistency_v251_benchmark_results.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        benchmarkVersion: '2.5.1',
        timestamp: new Date().toISOString(),
        configuration: {
          model: targetModel,
          provider: targetModel.includes('gemini') ? 'gemini' : 'groq',
          temperature: 0.2,
          topP: 0.9,
          inputMode: 'compact_text',
          targetRole,
        },
        summary: {
          totalRuns: NUM_RUNS,
          successfulRuns: successfulRuns.length,
          avgIssueJaccard: Number((avgIssueJaccard * 100).toFixed(1)),
          avgStrengthJaccard: Number((avgStrengthJaccard * 100).toFixed(1)),
          issueCountMean: Number(avg(issueCounts).toFixed(2)),
          strengthCountMean: Number(avg(strengthCounts).toFixed(2)),
          reviewWordMean: Number(avg(wordCounts).toFixed(0)),
        },
        issueFrequency: issueFreq,
        strengthFrequency: strengthFreq,
        runs,
      },
      null,
      2
    )
  )
  console.log(`\nSaved detailed experiment report to: ${reportPath}\n`)
}

main().catch((err) => {
  console.error('Fatal benchmark error:', err)
  process.exit(1)
})
