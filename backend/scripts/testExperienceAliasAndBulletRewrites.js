import assert from 'assert'
import { computeScorecard } from '../agents/resume/scoring/resumeScorecard.js'
import { computePrecomputedSignals } from '../agents/resume/signals/precomputedSignals.js'
import { weaveKeywordsAndBuildLedger } from '../agents/resume/market/smartKeywordWeaver.js'

console.log('Testing experience / experiences aliases and bullet rewrites...')

// Test 1: Canonical resume with 'experiences' (plural)
const canonicalPlural = {
  candidate: { name: 'Test Candidate', targetRole: 'Senior Software Engineer' },
  experiences: [
    {
      id: 'exp_001',
      company: 'Tech Corp',
      role: 'Software Engineer',
      bullets: [
        { id: 'exp_001_b01', text: 'Built backend services using Node.js and PostgreSQL.' },
        { id: 'exp_001_b02', text: 'Helped with team standups and worked on API features.' },
      ],
    },
  ],
  projects: [
    {
      id: 'proj_001',
      name: 'Project Delta',
      bullets: [
        { id: 'proj_001_b01', text: 'Designed real-time distributed data pipeline using Kafka.' },
      ],
    },
  ],
  skills: ['Node.js', 'PostgreSQL', 'Kafka'],
}

// Test 1.1: precomputedSignals with 'experiences'
const precomputed = computePrecomputedSignals(canonicalPlural)
assert(precomputed.bulletSignalsList.length === 3, `Expected 3 bullet signals, got ${precomputed.bulletSignalsList.length}`)
assert(precomputed.bulletSignals['exp_001_b01'], 'Expected exp_001_b01 to exist in bulletSignals')
assert(precomputed.bulletSignals['proj_001_b01'], 'Expected proj_001_b01 to exist in bulletSignals')
console.log('✓ 1.1 precomputedSignals extracted bullets from experiences[]')

// Test 1.2: scorecard with 'experiences'
const mockAnalysis = {
  candidateSnapshot: { name: 'Test Candidate', targetRole: 'Senior Software Engineer' },
  issues: [
    {
      id: 'iss_01',
      category: 'weak_verb',
      severity: 'medium',
      title: 'Weak Opener: Helped with',
      evidence: [{ bulletId: 'exp_001_b02', originalText: 'Helped with team standups and worked on API features.' }],
      correctedText: 'Spearheaded agile ceremonies and engineered REST API endpoints.',
    },
  ],
}

const scorecard = computeScorecard({
  analysis: mockAnalysis,
  canonicalResume: canonicalPlural,
  bulletSignalsList: precomputed.bulletSignalsList,
})

assert(Array.isArray(scorecard.bulletAudit), 'Expected bulletAudit array')
assert(scorecard.bulletAudit.length === 3, `Expected 3 audited bullets, got ${scorecard.bulletAudit.length}`)
const b2 = scorecard.bulletAudit.find((b) => b.bulletId === 'exp_001_b02')
assert(b2, 'Expected exp_001_b02 in bulletAudit')
assert(b2.status === 'warn' || b2.status === 'fix', `Expected warn/fix, got ${b2.status}`)
assert(b2.rewrite === 'Spearheaded agile ceremonies and engineered REST API endpoints.', 'Expected rewrite populated')
console.log('✓ 1.2 scorecard and buildBulletAudit properly processed experiences[]')

// Test 1.3: weaveKeywordsAndBuildLedger with 'experiences' and new aliases
const weaveResult = await weaveKeywordsAndBuildLedger({
  canonicalResume: canonicalPlural,
  missingKeywords: ['TypeScript', 'Redis', 'Unit Testing'],
})
assert(weaveResult.interviewLedger.length > 0, 'Expected interviewLedger items')
const firstLedger = weaveResult.interviewLedger[0]
assert(firstLedger.wovenBullet, 'Expected wovenBullet alias on ledger item')
assert(firstLedger.talkingScript, 'Expected talkingScript alias on ledger item')
console.log('✓ 1.3 weaveKeywordsAndBuildLedger returned wovenBullet and talkingScript aliases')

// Test 2: Canonical resume with 'experience' (singular)
const canonicalSingular = {
  candidate: { name: 'Test Candidate 2', targetRole: 'Backend Engineer' },
  experience: canonicalPlural.experiences,
  projects: canonicalPlural.projects,
  skills: canonicalPlural.skills,
}
const precomputedSingular = computePrecomputedSignals(canonicalSingular)
assert(precomputedSingular.bulletSignalsList.length === 3, 'Expected 3 bullets from singular experience[]')
const scorecardSingular = computeScorecard({
  analysis: mockAnalysis,
  canonicalResume: canonicalSingular,
  bulletSignalsList: precomputedSingular.bulletSignalsList,
})
assert(scorecardSingular.bulletAudit.length === 3, 'Expected 3 audited bullets from singular experience[]')
console.log('✓ 2.1 precomputedSignals and scorecard handle singular experience[] seamlessly')

console.log('\n================================================================')
console.log('ALL EXPERIENCE ALIAS & BULLET REWRITE TESTS PASSED!')
console.log('================================================================')
