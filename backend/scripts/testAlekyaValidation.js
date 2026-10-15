import fs from 'fs'
import assert from 'assert'
import { DocumentParser } from '../services/documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'

async function runAlekyaValidation() {
  console.log('================================================================')
  console.log('ALEKYA RESUME & PIPELINE VERIFICATION SUITE')
  console.log('================================================================\n')

  const pdfPath = 'backend/agents/resume/fixtures/alekya/Alekya_Maddu_Resume.pdf'
  assert(fs.existsSync(pdfPath), `PDF file must exist at ${pdfPath}`)

  const buf = fs.readFileSync(pdfPath)
  const parsedDoc = await DocumentParser.parse({
    buffer: buf,
    filename: 'Alekya_Maddu_Resume.pdf',
    mimeType: 'application/pdf',
  })

  // 1. Normalize
  const canonical = ResumeNormalizer.normalize(parsedDoc)

  console.log('--- 1. Experience Normalization Verification ---')
  console.log(`Experience items count: ${canonical.experience.length}`)
  assert.strictEqual(canonical.experience.length >= 3, true, 'Must have at least 3 experience items')

  const exp1 = canonical.experience[0]
  const exp2 = canonical.experience[1]
  const exp3 = canonical.experience[2]

  console.log(`[exp_001] Company: "${exp1.company}" | Role: "${exp1.role}" | Bullets: ${exp1.bullets.length}`)
  console.log(`[exp_002] Company: "${exp2.company}" | Role: "${exp2.role}" | Bullets: ${exp2.bullets.length}`)
  console.log(`[exp_003] Company: "${exp3.company}" | Role: "${exp3.role}" | Bullets: ${exp3.bullets.length}`)

  // Verify Objective 4 Experience Company extractions
  assert.strictEqual(exp1.company, 'Collabera / Bank of America', 'exp_001 company must be Collabera / Bank of America')
  assert.strictEqual(exp2.company, 'It America / Abbott Laboratories', 'exp_002 company must be It America / Abbott Laboratories')
  assert.strictEqual(exp3.company, 'Capgemini Technology Services', 'exp_003 company must be Capgemini Technology Services')
  console.log('PASS: All 3 experience companies extracted cleanly without header leakage.\n')

  // Verify wrapped text fragments were NOT treated as companies or headers
  canonical.experience.forEach((e) => {
    assert(!e.company.toLowerCase().includes('across enterprise hr'), 'Company must not be wrapped bullet text')
    assert(!e.company.toLowerCase().includes('tokens,'), 'Company must not be wrapped token text')
    assert(!e.company.endsWith('.'), 'Company must not end with period')
  })
  console.log('PASS: Zero wrapped bullet fragments leaked into company names.\n')

  // Verify page footers like "1 of 2" were not treated as bullets
  canonical.experience.forEach((e) => {
    e.bullets.forEach((b) => {
      assert(!/^\s*(?:--\s*)?\d+\s+of\s+\d+/i.test(b.text), `Bullet must not be a page footer: "${b.text}"`)
    })
  })
  console.log('PASS: Page footers ("1 of 2") stripped completely from bullet extraction.\n')

  // 2. Full Pipeline Synthesis & Validation
  console.log('--- 2. Resume Synthesis & Issue Clustering Verification ---')
  const evalResult = await ResumeAgent.evaluate({
    resumeText: parsedDoc.rawText,
    targetRoleOverride: 'Senior Full Stack Software Developer',
    enableBenchmarkMode: true,
  })

  console.log(`Evaluation status: ${evalResult.status} | success: ${evalResult.success}`)
  if (!evalResult.success) {
    console.log('Error message:', evalResult.error)
    console.log('Validation details:', evalResult.validationDetails)
  }
  assert.strictEqual(evalResult.success, true, 'Resume evaluation must succeed')

  const analysis = evalResult.analysis
  assert.strictEqual(analysis.analysisVersion, '2.2', 'analysisVersion must strictly be 2.2')
  console.log('PASS: analysisVersion is strictly 2.2')

  // Verify Issue Title Deduplication
  console.log(`Total issues returned: ${analysis.issues.length}`)
  const titles = analysis.issues.map((i) => i.title)
  const uniqueTitles = new Set(titles.map((t) => t.trim().toLowerCase()))
  console.log('Issue titles:', titles)

  assert.strictEqual(titles.length, uniqueTitles.size, 'All issue titles must be strictly unique (0 duplicates)')
  console.log('PASS: Zero duplicate issue titles (strict clustering confirmed).\n')

  // Verify Recruiter Rewrites: Medium and High severity MUST have non-null correctedText
  console.log('--- 3. Recruiter Rewrites Verification ---')
  analysis.issues.forEach((iss, idx) => {
    console.log(`[Issue ${idx + 1}] (${iss.severity}) "${iss.title}"`)
    console.log(`   correctedText: ${iss.correctedText ? `"${iss.correctedText.slice(0, 80)}..."` : 'null'}`)
    if (iss.severity === 'medium' || iss.severity === 'high') {
      assert(iss.correctedText !== null && typeof iss.correctedText === 'string' && iss.correctedText.length > 0, `Issue "${iss.title}" of severity "${iss.severity}" must have non-null correctedText`)
      // Verify at most one [ADD: ...] slot
      const slots = iss.correctedText.match(/\[ADD:\s*([^\]]*)\]/g) || []
      assert(slots.length <= 1, `correctedText must have at most one [ADD: ...] slot (found ${slots.length})`)
      if (slots.length === 1) {
        assert(!/\d/.test(slots[0]), `[ADD: ...] slot must not contain digits: ${slots[0]}`)
      }
    }
  })
  console.log('PASS: All medium and high severity issues have non-null Google X-Y-Z rewrites with at most one [ADD: metric] slot.\n')

  console.log('================================================================')
  console.log('ALL ALEKYA VERIFICATION TESTS PASSED SUCCESSFULLY!')
  console.log('================================================================')
}

runAlekyaValidation().catch((err) => {
  console.error('\nFAIL:', err)
  process.exit(1)
})
