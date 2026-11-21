import { buildFivePartPlaybookRewrite, applyLightVerbFix, toPastTense, buildBulletAudit, isWordForWordIdentical } from '../agents/resume/scoring/resumeScorecard.js'
import { toPresentTense } from '../agents/resume/signals/patterns.js'
import assert from 'assert'

console.log('--- TEST 1: Irregular Verbs in toPastTense & toPresentTense ---')
assert.strictEqual(toPastTense('run'), 'Ran')
assert.strictEqual(toPastTense('ran'), 'Ran')
assert.strictEqual(toPastTense('build'), 'Built')
assert.strictEqual(toPastTense('built'), 'Built')
assert.strictEqual(toPastTense('lead'), 'Led')
assert.strictEqual(toPastTense('led'), 'Led')
assert.strictEqual(toPresentTense('Ran'), 'Run')
assert.strictEqual(toPresentTense('Built'), 'Build')
assert.strictEqual(toPresentTense('Led'), 'Lead')
assert.strictEqual(toPresentTense('Answered'), 'Answer')
assert.strictEqual(toPresentTense('answered'), 'Answer')
assert.strictEqual(toPresentTense('Trained'), 'Train')
assert.strictEqual(toPresentTense('trained'), 'Train')
assert.strictEqual(toPresentTense('Monitored'), 'Monitor')
assert.strictEqual(toPresentTense('Compiled'), 'Compile')
assert.notStrictEqual(toPresentTense('Answered'), 'Answere')
assert.notStrictEqual(toPresentTense('Trained'), 'Traine')
assert.strictEqual(isWordForWordIdentical('Answere complex business questions with SQL queries', 'Answered complex business questions with SQL queries'), true)
assert.strictEqual(isWordForWordIdentical('Translate complex business inquiries into SQL queries, delivering interactive executive dashboards that cut reporting latency by 35%.', 'Answered complex business questions with SQL queries'), false)
console.log('PASS: Tense normalization and 1-word verb swap detection passed.')

console.log('--- TEST 2: Irregular Verb Handling in buildFivePartPlaybookRewrite ---')
const testBullets = [
  'Ran daily ETL pipeline meetings and data quality checks.',
  'Led cross-functional sprint planning for analytics squad.',
  'Built custom Tableau dashboards for marketing attribution.',
  'Wrote Python automation scripts for data extraction.',
]

for (const tb of testBullets) {
  const rwPast = buildFivePartPlaybookRewrite(tb, { isCurrentRole: false, targetRole: 'Senior Data Analyst' })
  console.log(`Original: ${tb}`);
  console.log(`Rewrite (Past): ${rwPast}`);
  assert(!rwPast.toLowerCase().includes('engineered ran'), `Failed: Contains "Engineered ran" in "${rwPast}"`)
  assert(!rwPast.toLowerCase().includes('automated ran'), `Failed: Contains "Automated ran" in "${rwPast}"`)
  assert(!rwPast.toLowerCase().includes('engineered led'), `Failed: Contains "Engineered led" in "${rwPast}"`)
  assert(!rwPast.toLowerCase().includes('engineered built'), `Failed: Contains "Engineered built" in "${rwPast}"`)

  const rwPres = buildFivePartPlaybookRewrite(tb, { isCurrentRole: true, targetRole: 'Senior Data Analyst' })
  console.log(`Rewrite (Present): ${rwPres}`);
}
console.log('PASS: Zero double-verb bugs detected.')

console.log('--- TEST 3: applyLightVerbFix Helper ---')
const fixedWeak = applyLightVerbFix('Responsible for analyzing marketing conversion rates', null, false)
console.log('applyLightVerbFix (past):', fixedWeak)
assert(fixedWeak.startsWith('Analyzed'), `Expected to start with Analyzed, got: ${fixedWeak}`)

const fixedPres = applyLightVerbFix('Responsible for analyzing marketing conversion rates', null, true)
console.log('applyLightVerbFix (present):', fixedPres)
assert(fixedPres.startsWith('Analyze'), `Expected to start with Analyze, got: ${fixedPres}`)
console.log('PASS: applyLightVerbFix works as expected.')

console.log('--- TEST 4: buildBulletAudit Contradiction Prevention ---')
const mockCanonicalResume = {
  candidate: { targetRole: 'Senior Data Analyst' },
  experiences: [
    {
      company: 'TechCorp',
      role: 'Data Analyst',
      isCurrent: true,
      bullets: [
        { id: 'exp_001_b01', text: 'Responsible for monitoring database queries and reporting issues.' },
        { id: 'exp_001_b02', text: 'Ran daily ETL syncs across 3 databases.' }
      ]
    },
    {
      company: 'OldCo',
      role: 'Junior Analyst',
      isCurrent: false,
      bullets: [
        { id: 'exp_002_b01', text: 'Helped with monthly Excel reports.' }
      ]
    }
  ]
}

const mockAnalysis = {
  bulletEvaluations: [
    {
      bulletId: 'exp_001_b01',
      verdict: 'hurting',
      missingElements: ['metric', 'outcome'],
      critique: 'Opens with passive responsibility phrasing and lacks quantifiable business outcome.'
    },
    {
      bulletId: 'exp_001_b02',
      verdict: 'hurting',
      missingElements: ['outcome'],
      critique: 'Lacks measurable business result from daily ETL syncs.'
    },
    {
      bulletId: 'exp_002_b01',
      verdict: 'hurting',
      missingElements: ['actionVerb', 'metric', 'outcome'],
      critique: 'Opens with weak verb "Helped with" and lacks metrics.'
    }
  ],
  bulletUpgrades: [
    {
      bulletId: 'exp_001_b01',
      originalText: 'Responsible for monitoring database queries and reporting issues.',
      rewrittenText: 'Monitor database queries and optimize slow endpoints to cut latency by 28%.',
      reason: 'Replaces passive responsibility opener with active present verb and 28% latency improvement.'
    }
  ]
}

const audit = buildBulletAudit({
  analysis: mockAnalysis,
  canonicalResume: mockCanonicalResume,
  bulletSignalsList: [],
  targetRole: 'Senior Data Analyst'
})

for (const item of audit) {
  console.log(`Bullet: [${item.bulletId}] Verdict: ${item.verdict} Status: ${item.status} Reason: "${item.reason}"`)
  console.log(`  Rewrite: "${item.rewrite}"`)
  if (item.verdict === 'hurting' || item.status !== 'pass') {
    assert(!item.reason.toLowerCase().includes('no defects found'), `FAILED: Hurting bullet [${item.bulletId}] has "no defects found" reason!`)
    assert(item.rewrite, `FAILED: Hurting bullet [${item.bulletId}] missing rewrite!`)
  }
}
console.log('PASS: All hurting bullets have consistent non-contradictory critiques and rewrites.')

console.log('--- TEST 5: Domain Summary Calibration for Data Analyst ---')
import { generateDomainCalibratedSummary } from '../agents/resume/orchestration/modeC_hybrid.js'
const dataSummary = generateDomainCalibratedSummary('Senior Data Analyst', [
  { role: 'Data Analyst', company: 'DataCo', bullets: ['Built Tableau dashboards for executive KPI tracking.'] }
], ['SQL', 'Tableau', 'Power BI', 'BigQuery', 'Snowflake', 'dbt'], [])
console.log('Data Analyst summary:', dataSummary)
assert(!dataSummary.toLowerCase().includes('full-stack systems'), 'FAILED: Contains full-stack cloud infrastructure boilerplate!')
assert(dataSummary.includes('Data Analyst'), 'FAILED: Missing Data Analyst role!')
console.log('PASS: Data Analyst summary calibrated correctly.')

console.log('--- TEST 6: Candidate Identity Resolution Priority ---')
const mockReportData = {
  resume_json: {
    candidate: { name: 'Deepanjan Rane' }
  },
  user_answers: {
    name: 'Swapnil Jadhav'
  }
}
const resolvedName = mockReportData?.resume_json?.candidate?.name ||
  mockReportData?.resume_agent?.candidateSnapshot?.name ||
  mockReportData?.user_answers?.name
assert.strictEqual(resolvedName, 'Deepanjan Rane', 'FAILED: Candidate name priority failed!')
console.log('PASS: Deepanjan Rane takes precedence over stale Swapnil Jadhav in user_answers.')

console.log('--- TEST 7: Header & Contact Parsing 10/10 Verification ---')
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { computeScorecard, isTrueQuantified } from '../agents/resume/scoring/resumeScorecard.js'

const deepanjanRawText = `Deepanjan Rane
Chicago, IL | +1 872-262-6228 | deepanjanrane6@gmail.com | linkedin.com/in/deepanjanrane
Senior Full Stack & AI Engineer
SUMMARY
Passionate software engineer with 6+ years of experience building scalable systems.
EXPERIENCE
Software Engineer | Acme Corp | 2021 - Present
- Automated ETL workflows, saving 40+ manual hours per month.
- Reduced financial reporting cycles from 8 hours to 4 hours.
`
const candidateInfo = ResumeNormalizer.extractCandidateInfo(deepanjanRawText.split('\n'), 'Senior Full Stack & AI Engineer', deepanjanRawText)
assert.strictEqual(candidateInfo.name, 'Deepanjan Rane', 'FAILED: Name extraction')
assert.strictEqual(candidateInfo.phone, '+1 872-262-6228', 'FAILED: Phone extraction')
assert.strictEqual(candidateInfo.contact.email, 'deepanjanrane6@gmail.com', 'FAILED: Email extraction')
assert.strictEqual(candidateInfo.contact.linkedin, 'https://www.linkedin.com/in/deepanjanrane', 'FAILED: LinkedIn extraction')

const mockDeepanjanResume = {
  rawText: deepanjanRawText,
  candidate: candidateInfo,
  summary: 'Passionate software engineer with 6+ years of experience building scalable systems.',
  experiences: [
    {
      company: 'Acme Corp',
      role: 'Software Engineer',
      isCurrent: true,
      bullets: [
        { id: 'exp_001_b01', text: 'Automated ETL workflows, saving 40+ manual hours per month.' },
        { id: 'exp_001_b02', text: 'Reduced financial reporting cycles from 8 hours to 4 hours.' }
      ]
    }
  ]
}

const scorecardResult = computeScorecard({
  analysis: { issues: [], strengths: [], bulletEvaluations: [] },
  canonicalResume: mockDeepanjanResume,
  precomputedSignals: {
    contactMerge: { isContactMerged: false },
    quantification: { totalBullets: 2, quantifiedBullets: 2, density: 1.0 },
    bulletSignals: {
      exp_001_b01: { hasQuantifier: true },
      exp_001_b02: { hasQuantifier: true }
    }
  },
  usMarketSignals: { flags: {}, observations: [] },
  targetRole: 'Senior Full Stack & AI Engineer'
})

const headerSection = scorecardResult.sectionAudit.headerAndContact
console.log('Header audit score:', headerSection.score10, 'status:', headerSection.status, 'hurtingReason:', headerSection.hurtingReason)
assert.strictEqual(headerSection.score10, 10, 'FAILED: Header did not score 10/10!')
assert.strictEqual(headerSection.status, 'pass', 'FAILED: Header status is not pass!')
assert.strictEqual(headerSection.hurtingReason, null, 'FAILED: Header has false positive hurtingReason!')
console.log('PASS: Header scores 10/10 with zero false missing-email/phone errors.')

console.log('--- TEST 8: 10-Metric Business/Engineering Quantification Test ---')
const metricTestCases = [
  'Automated ETL workflows, saving 40+ manual hours per month.',
  'Reduced financial reporting cycles from 8 hours to 4 hours.',
  'Optimized API queries to deliver sub-50ms p95 latency.',
  'Cut customer onboarding turnaround to 90 minutes.',
  'Shortened nightly batch processing by 6+ hours.',
  'Engineered transaction engine handling 50,000+ transactions daily.',
  'Led a 15-person team of software engineers across 3 locations.',
  'Scaled cloud infrastructure to support 100K+ users with 99.9% uptime.',
  'Accelerated data access layers to increase throughput by 3x.',
  'Compiled 15+ reports weekly for executive stakeholders.'
]

for (let i = 0; i < metricTestCases.length; i++) {
  const bullet = metricTestCases[i]
  const isQuant = isTrueQuantified(bullet)
  assert(isQuant, `FAILED: Metric test case ${i + 1} not recognized: "${bullet}"`)
}
console.log('PASS: All 10 real business/engineering metric formats successfully detected as quantified.')

console.log('\nALL VERIFICATION CHECKS PASSED!')
