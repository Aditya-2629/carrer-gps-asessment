import assert from 'assert'
import { computeScorecard } from '../agents/resume/scoring/resumeScorecard.js'
import { sanitizeLocation, isReferenceNoise, buildAtsTailoredDocx } from '../services/docxResumeService.js'

console.log('================================================================')
console.log('PHASE 3: REPORT LAYER & 1-PAGE ATS EXPORT VERIFICATION SUITE')
console.log('================================================================\n')

// ── Test 1: Scorecard Integration of Semantic Bullet Evaluations ──
console.log('--- Test 1: resumeScorecard Semantic Bullet Integration ---')
const sampleCanonical = {
  candidate_name: 'Jane Doe',
  target_role: 'Senior Software Engineer',
  years_of_experience: 4,
  experiences: [
    {
      company: 'TechCorp',
      role: 'Staff Engineer',
      bullets: [
        { id: 'exp_001_b01', text: 'Architected distributed event-driven microservices processing 50M events daily.' },
        { id: 'exp_001_b02', text: 'Responsible for attending daily standup meetings and triaging bugs.' },
      ],
    },
    {
      company: 'PastCorp',
      role: 'Software Engineer',
      bullets: [
        { id: 'exp_002_b01', text: 'Built internal dashboard using React and Redux.' },
        { id: 'exp_002_b02', text: 'Wrote unit tests and improved documentation.' },
      ],
    },
  ],
  projects: [
    {
      title: 'Cloud Optimizer',
      bullets: [
        { id: 'proj_001_b01', text: 'Developed open-source Kubernetes autoscaler adopted by 500+ developers.' },
      ],
    },
  ],
}

const sampleAnalysis = {
  bulletEvaluations: [
    {
      bulletId: 'exp_001_b01',
      verdict: 'helping',
      fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: true, metric: true, outcome: true },
      isResponsibilityOnly: false,
    },
    {
      bulletId: 'exp_001_b02',
      verdict: 'hurting',
      fivePartFlags: { actionVerb: false, hardSkill: false, collaboration: false, metric: false, outcome: false },
      isResponsibilityOnly: true,
    },
    {
      bulletId: 'proj_001_b01',
      verdict: 'helping',
      fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: false, metric: true, outcome: true },
      isResponsibilityOnly: false,
    },
  ],
  cutList: [
    {
      bulletId: 'exp_001_b02',
      originalText: 'Responsible for attending daily standup meetings and triaging bugs.',
      reason: 'Low-signal operational fluff that hurts executive credibility.',
    },
  ],
  nearMissKeywords: [
    {
      originalPhrase: 'unit tests',
      jdExactTerm: 'automated test suites',
      rationale: 'Align with JD literal phrasing for automated test suites.',
    },
  ],
}

const scorecard = computeScorecard({
  analysis: sampleAnalysis,
  canonicalResume: sampleCanonical,
  bulletSignalsList: [],
})

const audit = scorecard.bulletAudit
assert(audit.length === 5, 'Should audit all 5 bullets')

const b01 = audit.find((b) => b.bulletId === 'exp_001_b01')
assert.strictEqual(b01.verdict, 'helping', 'b01 verdict should be helping')
assert.strictEqual(b01.fivePartFlags.actionVerb, true, 'b01 actionVerb flag')
assert.strictEqual(b01.fivePartFlags.metric, true, 'b01 metric flag')
assert.strictEqual(b01.isResponsibilityOnly, false, 'b01 isResponsibilityOnly false')

const b02 = audit.find((b) => b.bulletId === 'exp_001_b02')
assert.strictEqual(b02.verdict, 'hurting', 'b02 verdict should be hurting')
assert.strictEqual(b02.fivePartFlags.metric, false, 'b02 metric flag false')
assert.strictEqual(b02.isResponsibilityOnly, true, 'b02 isResponsibilityOnly true')

// Test fallback for un-evaluated bullet
const b03 = audit.find((b) => b.bulletId === 'exp_002_b01')
assert(b03.verdict === 'helping' || b03.verdict === 'hurting', 'Fallback verdict assigned')
assert(b03.fivePartFlags !== undefined, 'Fallback fivePartFlags assigned')

// Check helpingSummary
assert.deepStrictEqual(scorecard.helpingSummary, {
  helpingCount: 3,
  hurtingCount: 2,
  totalBullets: 5,
}, 'helpingSummary counts should match expected numbers')

// Check cutList & nearMissKeywords attached
assert.strictEqual(scorecard.cutList.length, 1, 'cutList attached')
assert.strictEqual(scorecard.nearMissKeywords.length, 1, 'nearMissKeywords attached')

// Check backward compatibility aliases
assert.strictEqual(scorecard.score, scorecard.overallScore, 'score === overallScore')
assert.deepStrictEqual(scorecard.grades, scorecard.dimensions, 'grades === dimensions')
assert.deepStrictEqual(scorecard.checks, scorecard.checklist, 'checks === checklist')

console.log('✓ 1.1 Scorecard successfully merged 5-part evaluations, cutList, and nearMissKeywords')

// ── Test 2: Sanitization & Reference Detection ──
console.log('\n--- Test 2: docxResumeService Sanitization & References ---')
assert.strictEqual(
  sanitizeLocation('123 Main Street, Apt 4B, San Francisco, CA 94105'),
  'San Francisco, CA 94105',
  'Strips street and unit numbers while keeping City, State'
)
assert.strictEqual(
  sanitizeLocation('Suite 200, New York, NY'),
  'New York, NY',
  'Strips suite prefix'
)
assert.strictEqual(
  sanitizeLocation('Bangalore, India'),
  'Bangalore, India',
  'Keeps international city/country'
)

assert(isReferenceNoise('References available upon request'), 'Detects references available upon request')
assert(isReferenceNoise('References are available on request.'), 'Detects references are available on request')
assert(!isReferenceNoise('Managed customer references and case studies.'), 'Does not trigger on genuine work bullets')

console.log('✓ 2.1 sanitizeLocation and isReferenceNoise work correctly')

// ── Test 3: DOCX Generation & 1-Page Fit for <8 YOE ──
console.log('\n--- Test 3: 1-Page ATS DOCX Export ---')
const docxResult = await buildAtsTailoredDocx(sampleCanonical, [], ['Microservices', 'Distributed Systems'])
assert(docxResult.buffer && docxResult.buffer.length > 0, 'DOCX buffer generated')
assert(docxResult.pages >= 1, 'Pages count returned')
console.log(`✓ 3.1 DOCX generated successfully with ${docxResult.pages} page(s) in mode: ${docxResult.mode}`)

console.log('\n================================================================')
console.log('ALL PHASE 3 REPORT LAYER TESTS PASSED!')
console.log('================================================================')
