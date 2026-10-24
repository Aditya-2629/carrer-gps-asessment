import fs from 'fs'
import assert from 'assert'
import { DocumentParser } from '../services/documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { computeScorecard } from '../agents/resume/scoring/resumeScorecard.js'
import { computeKeywordAlignment } from '../agents/resume/market/keywordAlignment.js'
import { computePrecomputedSignals } from '../agents/resume/signals/precomputedSignals.js'

async function run() {
  console.log('================================================================')
  console.log('ALEKYA PROMPT 2 REQUIREMENTS VERIFICATION')
  console.log('================================================================\n')

  const pdfPath = 'backend/tests/fixtures/alekya/Alekya_Maddu_Resume.pdf'
  const buf = fs.readFileSync(pdfPath)
  const parsedDoc = await DocumentParser.parse({
    buffer: buf,
    filename: 'Alekya_Maddu_Resume.pdf',
    mimeType: 'application/pdf',
  })

  // 1. Target Role & Experience Extraction
  const canonical = ResumeNormalizer.normalize(parsedDoc)
  console.log('--- 1. Target Role Auto-Inference ---')
  console.log(`Inferred targetRole: "${canonical.candidate?.targetRole}"`)
  assert.strictEqual(
    canonical.candidate?.targetRole,
    'Senior Full Stack Software Developer',
    'Target role must be inferred as Senior Full Stack Software Developer'
  )
  assert.strictEqual(canonical.experience.length >= 3, true, 'Must have at least 3 experience entries')
  console.log('PASS: Issue 1 target role inference and experience extraction verified.\n')

  // 2. Keyword & JD Alignment
  console.log('--- 2. Keyword & JD Alignment Engine ---')
  const kw = computeKeywordAlignment({
    canonicalResume: canonical,
    targetRole: canonical.candidate.targetRole,
  })
  console.log(`Target Role evaluated: "${kw.targetRole}"`)
  console.log(`Match Score: ${kw.matchedCount}/${kw.totalTargetKeywords} (${kw.matchPercent}%)`)
  console.log(`Matched in Experience (${kw.matchedInExperience.length}):`, kw.matchedInExperience)
  console.log(`Skills Only (${kw.skillsOnlyUnverified.length}):`, kw.skillsOnlyUnverified)
  console.log(`Missing (${kw.missingFromResume.length}):`, kw.missingFromResume)

  assert.strictEqual(kw.matchedInExperience.length > 0, true, 'Must have verified experience matches')
  assert.strictEqual(kw.totalTargetKeywords > 0, true, 'Must have target keywords')
  assert.strictEqual(typeof kw.matchPercent, 'number', 'matchPercent must be a number')
  console.log('PASS: Issue 2 keyword alignment verified.\n')

  // 3. Bullet Grading & Rewrites
  console.log('--- 3. Scorecard Bullet Grading & Rewrites ---')
  const precomputedSignals = computePrecomputedSignals(canonical)
  const scorecard = computeScorecard({
    analysis: { issues: [], strengths: [] },
    canonicalResume: canonical,
    precomputedSignals,
    targetRole: canonical.candidate.targetRole,
  })

  // Test synthetic gerund with outcome
  const syntheticResume = {
    ...canonical,
    experience: [
      {
        id: 'exp_synth',
        company: 'Test Company',
        role: 'Senior Full Stack Software Developer',
        isCurrent: true,
        bullets: [
          {
            id: 'b_gerund_quant',
            text: 'Remediating accessibility issues across enterprise HR portal to achieve 100% WCAG 2.1 AA compliance.',
          },
          {
            id: 'b_gerund_no_outcome',
            text: 'Working on web components and internal systems.',
          },
        ],
      },
    ],
  }
  const synthSignals = computePrecomputedSignals(syntheticResume)
  const synthScorecard = computeScorecard({
    analysis: { issues: [], strengths: [] },
    canonicalResume: syntheticResume,
    precomputedSignals: synthSignals,
    targetRole: 'Senior Full Stack Software Developer',
  })

  const b1 = synthScorecard.bulletAudit.find((b) => b.bulletId === 'b_gerund_quant')
  assert.strictEqual(b1.status, 'pass', 'Gerund with quantifier must remain pass (GOOD)')
  assert.ok(b1.quickPolishNote, 'Gerund with quantifier must have quickPolishNote')
  assert.ok(b1.rewrite, 'Gerund with quantifier must have rewrite')
  console.log(`[SYNTHETIC PASS + POLISH] ${b1.text}`)
  console.log(`  -> Note: ${b1.quickPolishNote}`)
  console.log(`  -> Rewrite: ${b1.rewrite}`)

  const b2 = synthScorecard.bulletAudit.find((b) => b.bulletId === 'b_gerund_no_outcome')
  assert.strictEqual(b2.status, 'warn', 'Weak bullet without outcome must be warn')
  assert.ok(b2.rewrite, 'Warn bullet must have rewrite')
  console.log(`[SYNTHETIC WARN + REWRITE] ${b2.text}`)
  console.log(`  -> Rewrite: ${b2.rewrite}`)

  const audit = scorecard.bulletAudit || []
  console.log(`Total bullets audited: ${audit.length}`)

  // Find bullets with quickPolishNote
  const polished = audit.filter((b) => b.quickPolishNote)
  console.log(`Bullets with quickPolishNote: ${polished.length}`)
  polished.forEach((p) => {
    console.log(`[PASS + POLISH] "${p.text.slice(0, 60)}..."`)
    console.log(`  -> Note: "${p.quickPolishNote}"`)
    console.log(`  -> Rewrite: "${p.rewrite?.slice(0, 70)}..."`)
    assert.strictEqual(p.status, 'pass', 'Bullet with quickPolishNote must remain pass (GOOD)')
    assert.ok(p.rewrite, 'Bullet with quickPolishNote must have rewrite')
  })

  // Verify all warn / fix bullets have rewrites
  const needsWork = audit.filter((b) => b.status === 'warn' || b.status === 'fix')
  console.log(`Bullets requiring work (warn/fix): ${needsWork.length}`)
  let missingRewrites = 0
  needsWork.forEach((b) => {
    if (!b.rewrite) {
      missingRewrites++
      console.error(`MISSING REWRITE for [${b.status}] "${b.text.slice(0, 50)}..."`)
    }
  })
  assert.strictEqual(missingRewrites, 0, 'Every warn/fix bullet MUST have a concrete rewrite')
  console.log('PASS: Issue 3 bullet grading and rewrites verified.\n')

  console.log('================================================================')
  console.log('ALL PROMPT 2 BACKEND VERIFICATIONS PASSED!')
  console.log('================================================================')
}

run().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
