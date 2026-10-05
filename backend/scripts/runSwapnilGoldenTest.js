/**
 * Swapnil Jadhav Golden Test Script
 * Runs deterministic signal engine and Resume Agent evaluation on Swapnil fixture
 * and verifies expected observations per Section 24.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { DocumentParser } from '../services/documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { generateResumeSignals, formatCompactSignalSummary } from '../agents/resume/signals/signalEngine.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'

async function runGoldenTest() {
  console.log('================================================================')
  console.log('SWAPNIL JADHAV GOLDEN TEST — RESUME AGENT V2.3')
  console.log('================================================================\n')

  const fixturePath = path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt')
  const rawText = fs.readFileSync(fixturePath, 'utf8')

  // 1. Parse & Normalize
  const parsedDoc = await DocumentParser.parse({ text: rawText })
  const canonicalResume = ResumeNormalizer.normalize(parsedDoc, 'Senior Full Stack & AI Systems Engineer')

  // 2. Deterministic Signal Engine
  console.log('Generating Deterministic Resume Signals...')
  const signals = generateResumeSignals(canonicalResume)

  console.log('\n--- DETERMINISTIC SIGNALS GENERATED ---')

  // Skill gaps
  const skillGaps = signals.skills.skills.filter((s) => s.status === 'skillEvidenceGap').map((s) => s.skill)
  const skillsWithEvidence = signals.skills.skills.filter((s) => s.status === 'evidenceFound').map((s) => s.skill)

  console.log('\n[SKILLS ANALYSIS]')
  console.log(`Total Listed Skills: ${signals.skills.summary.totalListed}`)
  console.log(`With Verifiable Evidence (${skillsWithEvidence.length}): ${skillsWithEvidence.join(', ')}`)
  console.log(`Skill Evidence Gaps (${skillGaps.length}): ${skillGaps.join(', ')}`)

  // Quantified Evidence
  console.log('\n[QUANTIFIED EVIDENCE]')
  console.log(`Total Metrics Detected: ${signals.metrics.summary.totalMetrics}`)
  for (const [type, count] of Object.entries(signals.metrics.summary.byType)) {
    console.log(`  - ${type}: ${count}`)
  }
  console.log('Sample Extracted Metrics:')
  signals.metrics.metrics.slice(0, 15).forEach((m) => {
    console.log(`  * "${m.value}" (${m.type}) @ ${m.source.bulletId}`)
  })

  // Timeline & Parser Quality
  console.log('\n[TIMELINE OBSERVATIONS]')
  console.log(`Items with dates: ${signals.timeline.summary.totalItemsWithDates}, Overlaps: ${signals.timeline.summary.overlapCount}`)

  console.log('\n[PARSER QUALITY]')
  console.log(`Warnings (${signals.parserQuality.warnings.length}):`)
  signals.parserQuality.warnings.forEach((w) => {
    console.log(`  - [${w.severity}] ${w.itemId}: ${w.message}`)
  })

  // Compact Summary for Prompt
  console.log('\n--- COMPACT SIGNAL SUMMARY INJECTED INTO PROMPT ---')
  console.log(formatCompactSignalSummary(signals))

  // 3. Evaluate with LLM (using Groq / default configured provider)
  console.log('\n--- RUNNING RESUME AGENT EVALUATION ---')
  const evalResult = await ResumeAgent.evaluate({
    resumeText: rawText,
    targetRole: 'Senior Full Stack & AI Systems Engineer',
  })

  console.log(`\nSuccess: ${evalResult.success}`)
  console.log(`Status / Classification: ${evalResult.status}`)
  console.log(`Model Used: ${evalResult.metadata?.model || 'default'} (${evalResult.metadata?.provider})`)
  console.log(`Latency: ${evalResult.metadata?.latencyMs}ms`)

  if (evalResult.analysis) {
    console.log(`\nStrengths Count: ${evalResult.analysis.strengths?.length || 0}`)
    evalResult.analysis.strengths?.forEach((s, idx) => {
      console.log(`  ${idx + 1}. ${s.title} (Evidence: ${s.evidence?.[0]?.bulletId || s.evidence?.bulletId})`)
    })

    console.log(`\nIssues Count: ${evalResult.analysis.issues?.length || 0}`)
    evalResult.analysis.issues?.forEach((iss, idx) => {
      console.log(`  ${idx + 1}. [${iss.severity}] [${iss.category}] ${iss.title}`)
      console.log(`     Evidence: ${iss.evidence?.[0]?.bulletId || iss.evidence?.bulletId}`)
    })

    console.log(`\nPriority Actions Count: ${evalResult.analysis.priorityActions?.length || 0}`)
    evalResult.analysis.priorityActions?.forEach((pa) => {
      console.log(`  [Priority ${pa.priority}] ${pa.title}: ${pa.action}`)
    })
  }

  const valDetails = evalResult.validationDetails || {}
  console.log(`\nValidation Status:`)
  console.log(`  - Schema Valid: ${valDetails.isSchemaValid ?? evalResult.success}`)
  console.log(`  - Evidence Valid: ${valDetails.isEvidenceValid ?? (valDetails.errors?.length === 0)}`)
  console.log(`  - Unsupported Claims: ${valDetails.unsupportedClaims?.length || 0}`)
  console.log(`  - Unsupported Assumptions: ${valDetails.unsupportedAssumptionWarnings?.length || 0}`)

  if (valDetails.unsupportedClaims?.length > 0) {
    console.log('\nUnsupported Claims:')
    valDetails.unsupportedClaims.forEach((c) => console.log(`  - [${c.field}] ${c.claim}`))
  }
  if (valDetails.unsupportedAssumptionWarnings?.length > 0) {
    console.log('\nUnsupported Assumption Warnings:')
    valDetails.unsupportedAssumptionWarnings.forEach((w) => console.log(`  - [${w.field}] ${w.phrase}`))
  }

  console.log('\n================================================================')
  console.log('SWAPNIL GOLDEN TEST COMPLETE')
  console.log('================================================================\n')

  return { signals, evalResult }
}

runGoldenTest().catch((err) => {
  console.error('Golden test error:', err)
  process.exit(1)
})
