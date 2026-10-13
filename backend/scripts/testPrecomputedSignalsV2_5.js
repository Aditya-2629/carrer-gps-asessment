/**
 * Resume Agent V2.5 Phase 1 — Deterministic Signal Unit Tests
 *
 * Validates deterministic pre-processing signals (no LLM needed):
 * - Swapnil Jadhav fixture assertions (proj_002_b01, contactMerge, quantification)
 * - Second fixture (mixed-experience.txt) assertions
 * - Edge case assertions for outcome verbs, quantifiers, and tool dump logic
 */

import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import { DocumentParser } from '../services/documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import {
  computeBulletSignals,
  computeContactMergeSignal,
  computeQuantificationRollup,
  computePrecomputedSignals,
  extractDeclaredSkillDictionary,
  formatPrecomputedSignalsForPrompt,
} from '../agents/resume/signals/precomputedSignals.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`PASS: ${message}`)
    passed++
  } else {
    console.error(`FAIL: ${message}`)
    failed++
  }
}

async function runTests() {
  console.log('================================================================')
  console.log('RESUME AGENT V2.5 PHASE 1 — DETERMINISTIC SIGNAL UNIT TESTS')
  console.log('================================================================\n')

  // ── Test 1: Swapnil Jadhav Fixture ───────────────────────────────────────────
  console.log('--- TEST SUITE 1: Swapnil Jadhav Fixture ---')
  const swapnilRaw = fs.readFileSync(
    path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )
  const swapnilDoc = await DocumentParser.parse({ text: swapnilRaw })
  const swapnilCanonical = ResumeNormalizer.normalize(swapnilDoc, 'Senior AI & Full Stack Engineer')
  const swapnilSignals = computePrecomputedSignals(swapnilCanonical)

  // 1.1 proj_002_b01 Tool Dump Detection
  const proj002Sig = swapnilSignals.bulletSignals['proj_002_b01']
  assert(Boolean(proj002Sig), 'proj_002_b01 signal exists in bulletSignals map')
  assert(proj002Sig?.isToolDumpCandidate === true, 'proj_002_b01.isToolDumpCandidate === true')
  assert(proj002Sig?.technologyCount >= 3, `proj_002_b01 technologyCount (${proj002Sig?.technologyCount}) >= 3`)
  assert(proj002Sig?.hasOutcomeVerb === false, 'proj_002_b01.hasOutcomeVerb === false')
  assert(proj002Sig?.hasQuantifier === false, 'proj_002_b01.hasQuantifier === false')
  assert(proj002Sig?.wordCount === 6, `proj_002_b01.wordCount === 6 (got ${proj002Sig?.wordCount})`)

  // 1.2 Contact Merge Signal on summary_001 (Clean header separated from summary in V3.3)
  const cm = swapnilSignals.contactMerge
  assert(cm.isContactMerged === false, 'contactMerge.isContactMerged === false for Swapnil (header separated cleanly)')
  assert(cm.emailDetected === false, 'contactMerge.emailDetected === false in summary body')
  assert(cm.phoneDetected === false, 'contactMerge.phoneDetected === false in summary body')
  assert(cm.urlDetected === false, 'contactMerge.urlDetected === false in summary body')
  assert(cm.section === 'summary' && cm.bulletId === 'summary_001', 'contactMerge targets summary_001')

  // Direct unit check on computeContactMergeSignal for actual merged text
  const mergedSynthetic = computeContactMergeSignal('Contact: john@example.com | (555) 123-4567 | linkedin.com/in/john')
  assert(mergedSynthetic.isContactMerged === true, 'Synthetic merged summary correctly triggers isContactMerged === true')
  assert(mergedSynthetic.emailDetected === true, 'Synthetic merged summary emailDetected === true')
  assert(mergedSynthetic.phoneDetected === true, 'Synthetic merged summary phoneDetected === true')

  // 1.3 Quantification Rollup on Swapnil
  const qr = swapnilSignals.quantification
  assert(qr.totalBullets === 10, `Swapnil totalBullets === 10 (got ${qr.totalBullets})`)
  assert(qr.quantifiedBullets === 7, `Swapnil quantifiedBullets === 7 (got ${qr.quantifiedBullets})`)
  const expectedDensity = Number((7 / 10).toFixed(2))
  assert(qr.density === expectedDensity, `Swapnil quantification density === ${expectedDensity} (got ${qr.density})`)

  // ── Test 2: Second Fixture (mixed-experience.txt / Elena Rostova) ─────────────
  console.log('\n--- TEST SUITE 2: Second Sample (mixed-experience.txt) ---')
  const elenaRaw = fs.readFileSync(
    path.join(__dirname, '../agents/resume/fixtures/mixed-experience.txt'),
    'utf8'
  )
  const elenaDoc = await DocumentParser.parse({ text: elenaRaw })
  const elenaCanonical = ResumeNormalizer.normalize(elenaDoc, 'Full Stack Engineer')
  const elenaSignals = computePrecomputedSignals(elenaCanonical)

  // 2.1 Contact Merge on Elena (Clean header separated from summary)
  const elenaCM = elenaSignals.contactMerge
  assert(elenaCM.isContactMerged === false, 'contactMerge.isContactMerged === false for Elena Rostova (header separated cleanly)')
  assert(elenaCM.emailDetected === false, 'Elena contactMerge emailDetected === false in summary body')
  assert(elenaCM.urlDetected === false, 'Elena contactMerge urlDetected === false in summary body')

  // 2.2 Quantification Rollup on Elena
  const elenaQR = elenaSignals.quantification
  assert(elenaQR.totalBullets === 9, `Elena totalBullets === 9 (got ${elenaQR.totalBullets})`)
  assert(elenaQR.quantifiedBullets === 5, `Elena quantifiedBullets === 5 (got ${elenaQR.quantifiedBullets})`)
  const expectedElenaDensity = Number((5 / 9).toFixed(2))
  assert(elenaQR.density === expectedElenaDensity, `Elena density === ${expectedElenaDensity} (got ${elenaQR.density})`)

  // ── Test 3: Outcome Verbs, Quantifiers & Tool Dump Boundaries ─────────────────
  console.log('\n--- TEST SUITE 3: Synthetic Edge Cases ---')
  const declaredSkills = ['Docker', 'Kubernetes', 'AWS', 'Grafana', 'Jenkins', 'Terraform']

  // 3.1 Tool dump bullet: 4 tools, no outcome verb, no quantifier
  const dumpBullet = computeBulletSignals('test_001', 'Kubernetes, Docker, AWS, Grafana infrastructure.', declaredSkills)
  assert(dumpBullet.isToolDumpCandidate === true, 'Pure 4-tool list without outcome/quantifier is tool dump candidate')

  // 3.2 Tool dump negated by outcome verb (e.g. "improved", "reduced")
  const outcomeBullet = computeBulletSignals('test_002', 'Improved Kubernetes, Docker, and AWS deployment reliability.', declaredSkills)
  assert(outcomeBullet.hasOutcomeVerb === true, 'Detects "improved" as outcome verb')
  assert(outcomeBullet.isToolDumpCandidate === false, 'Outcome verb negates tool dump candidate')

  // 3.3 Tool dump negated by quantifier
  const quantBullet = computeBulletSignals('test_003', 'Managed Kubernetes, Docker, and AWS clusters for 500+ users.', declaredSkills)
  assert(quantBullet.hasQuantifier === true, 'Detects "500+ users" as quantifier')
  assert(quantBullet.isToolDumpCandidate === false, 'Quantifier negates tool dump candidate')

  // 3.4 Contact merge requires >= 2 channels
  const singleChannelCM = computeContactMergeSignal('Experienced engineer with 5 years experience. Contact: me@example.com')
  assert(singleChannelCM.emailDetected === true, 'Email detected')
  assert(singleChannelCM.phoneDetected === false, 'Phone not detected')
  assert(singleChannelCM.urlDetected === false, 'URL not detected')
  assert(singleChannelCM.isContactMerged === false, 'Single channel does NOT trigger contact merge (requires 2+)')

  // 3.5 Prompt block formatting matches specification
  const formattedPrompt = formatPrecomputedSignalsForPrompt(swapnilSignals)
  assert(formattedPrompt.includes('PRECOMPUTED SIGNALS (deterministic, do not recompute'), 'Prompt contains precomputed header')
  assert(formattedPrompt.includes('quantification: { totalBullets: 10, quantifiedBullets: 7, density: 0.70 }'), 'Prompt contains quantification line')
  assert(formattedPrompt.includes('proj_002_b01: hasQuantifier=false, technologyCount=5, hasOutcomeVerb=false, isToolDumpCandidate=true'), 'Prompt contains tool dump candidate line')
  assert(formattedPrompt.includes('contactMerge: { emailDetected=false, phoneDetected=false, urlDetected=false, isContactMerged=false }'), 'Prompt contains clean contactMerge line for Swapnil')

  // Verify synthetic contactMerge formatting
  const formattedMerged = formatPrecomputedSignalsForPrompt({
    bulletSignalsList: [],
    quantification: { totalBullets: 0, quantifiedBullets: 0, density: 0 },
    contactMerge: { emailDetected: true, phoneDetected: true, urlDetected: true, isContactMerged: true }
  })
  assert(formattedMerged.includes('contactMerge: { emailDetected=true, phoneDetected=true, urlDetected=true, isContactMerged=true }'), 'Prompt formats positive contactMerge line accurately')

  console.log('\n================================================================')
  console.log(`RESULTS: ${passed} passed, ${failed} failed`)
  console.log('================================================================\n')

  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
