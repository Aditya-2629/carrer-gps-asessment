import { buildFivePartPlaybookRewrite, applyLightVerbFix, toPastTense, buildBulletAudit } from '../agents/resume/scoring/resumeScorecard.js'
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
console.log('PASS: Tense normalization passed.')

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

console.log('\nALL VERIFICATION CHECKS PASSED!')
