/**
 * Swapnil Jadhav Golden Test — Resume Agent V2.4
 * Verifies:
 * - Internal evidence classifications (STRONG / BORDERLINE / WEAK / NEUTRAL)
 * - Security bullet exp_002_b04 -> BORDERLINE (neither strength nor issue)
 * - exp_001_b01, exp_001_b02, exp_001_b03, exp_002_b01 -> STRONG
 * - Recommendation similarity validation (RECOMMENDATION_TOO_SIMILAR)
 * - Consistency resolution between strengths and issues
 * - Clean recruiter overall review (100–180 words) without invented buzzwords
 * - CorrectedText source-grounding
 * - No internal classification labels exposed in final API response
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
import { classifyAllEvidence, classifyBullet } from '../agents/resume/classification/evidenceClassifier.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { DocumentParser } from '../services/documentParser/index.js'

async function main() {
  console.log('================================================================')
  console.log('SWAPNIL JADHAV REGRESSION TEST — RESUME AGENT V2.4')
  console.log(`Synthesis Prompt Version: ${SYNTHESIS_PROMPT_VERSION}`)
  console.log('================================================================\n')

  const resumeText = fs.readFileSync(
    path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )

  // Step 1: Pre-LLM State & Deterministic Classification
  const parsedDoc = await DocumentParser.parse({ text: resumeText })
  const canonicalResume = ResumeNormalizer.normalize(parsedDoc, 'Senior AI & Full Stack Engineer')
  const signals = generateResumeSignals(canonicalResume)
  const facts = extractResumeFacts(canonicalResume)
  const classifications = classifyAllEvidence(facts, signals, canonicalResume)

  console.log('--- 1. PRE-LLM INTERNAL CLASSIFICATIONS ---')
  console.log(`Total Classified Bullets: ${classifications.summary.total}`)
  console.log(`  STRONG: ${classifications.summary.STRONG}`)
  console.log(`  BORDERLINE: ${classifications.summary.BORDERLINE}`)
  console.log(`  WEAK: ${classifications.summary.WEAK}`)
  console.log(`  NEUTRAL: ${classifications.summary.NEUTRAL}\n`)

  console.log('[Key Bullet Classifications]')
  for (const item of classifications.items) {
    console.log(`  [${item.bulletId}] ${item.classification}: "${item.text.slice(0, 65)}..."`)
  }

  // Verify Spec §18 explicit bullets
  console.log('\n--- 2. VERIFY SPEC §18 EXPECTED CLASSIFICATIONS ---')
  const secBulletText = 'Built secure APIs and remediated XSS and sensitive-key exposure through input validation and sanitization.'
  const secClassification = classifyBullet(secBulletText)
  console.log(`  exp_002_b04 ("${secBulletText.slice(0, 50)}..."):`)
  console.log(`    → Classification: ${secClassification.classification}`)
  console.log(`    → Expected: BORDERLINE (PASS: ${secClassification.classification === 'BORDERLINE'})`)

  const b01Class = classifications.byBulletId['exp_001_b01']?.classification
  console.log(`  exp_001_b01 → ${b01Class} (Expected: STRONG, PASS: ${b01Class === 'STRONG'})`)

  const b02Class = classifications.byBulletId['exp_001_b02']?.classification
  console.log(`  exp_001_b02 → ${b02Class} (Expected: STRONG, PASS: ${b02Class === 'STRONG'})`)

  const b03Class = classifications.byBulletId['exp_001_b03']?.classification
  console.log(`  exp_001_b03 → ${b03Class} (Expected: STRONG, PASS: ${b03Class === 'STRONG'})`)

  const exp2b01Class = classifications.byBulletId['exp_002_b01']?.classification
  console.log(`  exp_002_b01 → ${exp2b01Class} (Expected: STRONG, PASS: ${exp2b01Class === 'STRONG'})`)

  const proj002Text = 'Owned the microservices architecture and backend deploying on AWS ECS with Jenkins, Trivy, AWS Inspector, and Grafana.'
  const proj002Class = classifyBullet(proj002Text, { techCount: 5 })
  console.log(`  proj_002_b01 (tech-dense) → ${proj002Class.classification} (Expected: BORDERLINE or STRONG, PASS: ${proj002Class.classification === 'BORDERLINE' || proj002Class.classification === 'STRONG'})`)

  // Step 2: Full Resume Agent Evaluation
  console.log('\n--- 3. RUNNING FULL RESUME AGENT V2.4 EVALUATION ---')
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

  console.log(`\nAgent Evaluation completed in ${latency}ms:`)
  console.log(`Success: ${result.success}`)
  console.log(`Status / Classification: ${result.classification}`)

  if (result.success && result.analysis) {
    const a = result.analysis
    console.log(`Analysis Version: ${a.analysisVersion}`)
    console.log(`Strengths count: ${a.strengths?.length || 0}`)
    console.log(`Issues count: ${a.issues?.length || 0}`)
    console.log(`Priority Actions count: ${a.priorityActions?.length || 0}`)

    // Verify internal classifications are NOT exposed in user-facing JSON
    const jsonStr = JSON.stringify(a)
    const exposesInternalClassification =
      jsonStr.includes('"STRONG"') ||
      jsonStr.includes('"BORDERLINE"') ||
      jsonStr.includes('"WEAK"') ||
      jsonStr.includes('"NEUTRAL"')
    console.log(`\nInternal labels exposed in final JSON: ${exposesInternalClassification ? 'FAIL (Exposed!)' : 'PASS (Strictly Hidden)'}`)

    console.log('\n--- 4. FINAL STRENGTHS ---')
    for (const s of a.strengths || []) {
      const ev = Array.isArray(s.evidence) ? s.evidence.map((e) => e.bulletId).join(', ') : s.evidence?.bulletId
      console.log(`  - [${s.id}] ${s.title} (${ev})`)
    }

    console.log('\n--- 5. FINAL ISSUES ---')
    for (const iss of a.issues || []) {
      const ev = Array.isArray(iss.evidence) ? iss.evidence.map((e) => e.bulletId).join(', ') : iss.evidence?.bulletId
      console.log(`  - [${iss.id}] [${iss.severity}/${iss.category}] ${iss.title} (${ev})`)
      console.log(`    Diagnosis: "${iss.diagnosis}"`)
      console.log(`    Recommendation: "${iss.recommendation}"`)
      if (iss.correctedText) {
        console.log(`    CorrectedText: "${iss.correctedText.slice(0, 80)}..."`)
      }
    }

    console.log('\n--- 6. FINAL PRIORITIES ---')
    for (const pa of a.priorityActions || []) {
      console.log(`  ${pa.priority || pa.order}. [${pa.title}] ${pa.action}`)
    }

    console.log('\n--- 7. OVERALL REVIEW AUDIT ---')
    const reviewText = typeof a.overallReview === 'string' ? a.overallReview : a.overallReview?.summary || ''
    const words = reviewText.split(/\s+/).filter(Boolean).length
    console.log(`Overall review words: ${words} (Target: 100–180 words)`)
    console.log(`Review:\n"${reviewText}"\n`)

    console.log('--- 8. VALIDATION DETAILS & WARNINGS ---')
    const vDetails = result.validationDetails || {}
    console.log(`Recommendation Warnings: ${vDetails.v3RecommendationWarnings?.length || 0}`)
    if (vDetails.v3RecommendationWarnings?.length > 0) {
      for (const rw of vDetails.v3RecommendationWarnings) {
        console.log(`  - ${rw.message}`)
      }
    }

    console.log(`Consistency Resolutions (Contradictions resolved): ${vDetails.v3ConsistencyResolutions?.length || 0}`)
    if (vDetails.v3ConsistencyResolutions?.length > 0) {
      for (const cr of vDetails.v3ConsistencyResolutions) {
        console.log(`  - ${cr.bulletId} (${cr.classification}) → ${cr.action}`)
      }
    }

    console.log(`Unsupported Assumptions: ${vDetails.v3UnsupportedAssumptions?.length || 0}`)
    if (vDetails.v3UnsupportedAssumptions?.length > 0) {
      for (const ua of vDetails.v3UnsupportedAssumptions) {
        console.log(`  - ${ua.label || ua}: "${ua.match || ''}"`)
      }
    }

    console.log(`Rewrite Violations: ${vDetails.v3RewriteViolations?.length || 0}`)
    if (vDetails.v3RewriteViolations?.length > 0) {
      for (const rv of vDetails.v3RewriteViolations) {
        console.log(`  - ${rv.message || rv}`)
      }
    }

    console.log(`Evidence Validation: ${vDetails.isEvidenceValid ? 'PASS' : 'WARNING'}`)
  } else {
    console.error(`Evaluation failed: ${result.error}`)
  }

  console.log('\n================================================================')
  console.log('SWAPNIL JADHAV REGRESSION TEST COMPLETE')
  console.log('================================================================\n')
}

main().catch((err) => {
  console.error('Fatal error in regression test:', err)
  process.exit(1)
})
