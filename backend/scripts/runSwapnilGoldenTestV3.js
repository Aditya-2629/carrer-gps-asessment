/**
 * Swapnil Jadhav Golden Test — Resume Agent V3
 * Verifies: strong evidence recognition, no false positives on security bullet,
 * correct signal pipeline, V3 state output.
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
import { generateResumeSignals } from '../agents/resume/signals/signalEngine.js'
import { extractResumeFacts } from '../agents/resume/facts/resumeFactExtractor.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { DocumentParser } from '../services/documentParser/index.js'

async function main() {
  console.log('================================================================')
  console.log('SWAPNIL JADHAV GOLDEN TEST — RESUME AGENT V3')
  console.log(`Synthesis Prompt Version: ${SYNTHESIS_PROMPT_VERSION}`)
  console.log('================================================================\n')

  const resumeText = fs.readFileSync(
    path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt'), 'utf8'
  )

  // Step 1: Run deterministic pipeline to show pre-LLM state
  const parsedDoc = await DocumentParser.parse({ text: resumeText })
  const canonicalResume = ResumeNormalizer.normalize(parsedDoc, 'Senior AI & Full Stack Engineer')
  const signals = generateResumeSignals(canonicalResume)
  const facts = extractResumeFacts(canonicalResume)

  console.log('--- PRE-LLM STATE ---')
  console.log(`[Facts] Total: ${facts.summary.totalFacts}`)
  console.log(`  Metrics: ${facts.summary.metricCount}`)
  console.log(`  Technologies: ${facts.summary.technologyCount}`)
  console.log(`  Achievements: ${facts.summary.achievementCount}`)
  console.log(`  Responsibilities: ${facts.summary.responsibilityCount}`)
  console.log(`[Signals] Skills listed: ${signals.skills?.summary?.totalListed}`)
  console.log(`  Evidence gaps: ${signals.skills?.summary?.evidenceGaps}`)
  console.log(`  Total metrics: ${signals.metrics?.summary?.totalMetrics}`)

  // Check key metrics are present
  const keyMetrics = ['38%', '5,000+', '<1 second', '3x', '50+', '20+', '35%']
  console.log('\n[Golden Metrics Check]')
  for (const metric of keyMetrics) {
    const found = facts.facts.some((f) => f.type === 'metric' && f.value.includes(metric.replace('+', '').replace('<', '')))
    console.log(`  ${found ? 'FOUND' : 'MISSING'}: ${metric}`)
  }

  // Step 2: Full V3 agent run
  console.log('\n--- RUNNING V3 PIPELINE ---')
  const startTime = Date.now()
  const result = await ResumeAgent.evaluate({
    resumeText,
    targetRole: 'Senior AI & Full Stack Engineer',
    model: 'openai/gpt-oss-120b',
    inputMode: 'compact_text',
    isBenchmark: true,
    useV3Pipeline: true,
  })
  const latency = Date.now() - startTime

  console.log(`\nResult in ${latency}ms:`)
  console.log(`Success: ${result.success}`)
  console.log(`Classification: ${result.classification}`)
  console.log(`Pipeline Version: ${result.telemetry?.pipelineVersion || 'v2'}`)
  console.log(`Model: ${result.metadata?.model}`)

  if (result.success && result.analysis) {
    const a = result.analysis
    console.log(`\nAnalysis Version: ${a.analysisVersion}`)
    console.log(`Strengths: ${a.strengths?.length}`)
    console.log(`Issues: ${a.issues?.length}`)
    console.log(`Priority Actions: ${a.priorityActions?.length}`)

    console.log('\nStrengths:')
    for (const s of (a.strengths || [])) {
      const ev = Array.isArray(s.evidence) ? s.evidence.map(e => e.bulletId).join(', ') : s.evidence?.bulletId
      console.log(`  - ${s.title} (${ev})`)
    }

    console.log('\nIssues:')
    for (const iss of (a.issues || [])) {
      const ev = Array.isArray(iss.evidence) ? iss.evidence.map(e => e.bulletId).join(', ') : iss.evidence?.bulletId
      console.log(`  - [${iss.severity}/${iss.category}] ${iss.title}`)
      console.log(`    Evidence: ${ev}`)
      console.log(`    CorrectedText: ${iss.correctedText ? `"${iss.correctedText.slice(0, 80)}..."` : 'null'}`)
    }

    // Security bullet check
    console.log('\n[GOLDEN CHECK: Security Bullet]')
    const securityIssues = (a.issues || []).filter(i =>
      i.diagnosis?.toLowerCase().includes('secret management') ||
      i.diagnosis?.toLowerCase().includes('vulnerability count') ||
      i.recommendation?.toLowerCase().includes('secret management') ||
      i.correctedText?.toLowerCase().includes('secret management')
    )
    if (securityIssues.length === 0) {
      console.log('PASS: No invented "secret management" or "vulnerability count" in issues')
    } else {
      console.log('FAIL: Invented security claims detected:', securityIssues.map(i => i.id))
    }

    const missingOutcomeForSecurity = (a.issues || []).filter(i =>
      (i.category === 'missing_outcome' || i.type === 'missing_outcome') &&
      (Array.isArray(i.evidence) ? i.evidence : [i.evidence]).some(e => e?.bulletId === 'exp_002_b01' || e?.bulletId === 'exp_001_b02')
    )
    if (missingOutcomeForSecurity.length === 0) {
      console.log('PASS: No "missing_outcome" created for security bullet')
    } else {
      console.log('FAIL: missing_outcome created for security bullet')
    }

    // V3 validation report
    if (result.validationDetails?.v3UnsupportedAssumptions?.length > 0) {
      console.log(`\n[V3 Assumption Warnings]: ${result.validationDetails.v3UnsupportedAssumptions.length}`)
      for (const a of result.validationDetails.v3UnsupportedAssumptions.slice(0, 5)) {
        console.log(`  - ${a.location}: ${a.label} "${a.match}"`)
      }
    } else {
      console.log('\n[V3 Assumption Warnings]: 0 (PASS)')
    }

    if (result.validationDetails?.v3RewriteViolations?.length > 0) {
      console.log(`[V3 Rewrite Violations]: ${result.validationDetails.v3RewriteViolations.length}`)
    } else {
      console.log('[V3 Rewrite Violations]: 0 (PASS)')
    }

    // State output
    if (result.state) {
      console.log(`\n[V3 State] analyzerObservations keys: ${Object.keys(result.state.analyzerObservations).join(', ')}`)
      for (const [name, obs] of Object.entries(result.state.analyzerObservations)) {
        const count = obs?.observations?.length ?? 0
        console.log(`  ${name}: ${count} observations`)
      }
    }
  } else {
    console.log(`Error: ${result.error}`)
  }

  console.log('\n================================================================')
  console.log('SWAPNIL GOLDEN TEST V3 COMPLETE')
  console.log('================================================================\n')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
