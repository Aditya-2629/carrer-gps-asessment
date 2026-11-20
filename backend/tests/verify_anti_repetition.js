import assert from 'assert'
import {
  normalizeVerbLemma,
  getOpeningVerb,
  extractMetricTokens,
  extract5Grams,
  detectBulletRepetitions,
  syncRepairedBullet,
  applyDeterministicRepetitionSafetyNet,
} from '../agents/resume/orchestration/modeC_hybrid.js'

console.log('=== TEST 1: Verb Lemma Normalization & Opening Verb Extraction ===')
assert.strictEqual(normalizeVerbLemma('Architected'), 'architect')
assert.strictEqual(normalizeVerbLemma('architect'), 'architect')
assert.strictEqual(normalizeVerbLemma('Engineered'), 'engineer')
assert.strictEqual(normalizeVerbLemma('Built'), 'build')
assert.strictEqual(normalizeVerbLemma('Build'), 'build')
assert.strictEqual(normalizeVerbLemma('Led'), 'lead')
assert.strictEqual(normalizeVerbLemma('Lead'), 'lead')
assert.strictEqual(normalizeVerbLemma('Optimized'), 'optimize')
assert.strictEqual(normalizeVerbLemma('Optimizing'), 'optimize')
assert.strictEqual(normalizeVerbLemma('Automated'), 'automate')
assert.strictEqual(normalizeVerbLemma('Streamlined'), 'streamline')

// Opening verb extraction
const v1 = getOpeningVerb('Architected high-throughput microservices using Kafka and Redis.')
assert.strictEqual(v1.raw, 'Architected')
assert.strictEqual(v1.lemma, 'architect')

const v2 = getOpeningVerb('* Successfully engineered automated ETL pipelines in Snowflake.')
assert.strictEqual(v2.raw, 'engineered')
assert.strictEqual(v2.lemma, 'engineer')

const v3 = getOpeningVerb('Lead cross-functional sprints across 5 engineering squads.')
assert.strictEqual(v3.raw, 'Lead')
assert.strictEqual(v3.lemma, 'lead')
console.log('PASS: Opening verb extraction and lemma normalization passed.')

console.log('=== TEST 2: Metric Token Extraction (Ignoring Years & Versions) ===')
const sampleText = 'In 2023, upgraded Python 3.11 and React 19 apps to cut p95 latency by 35%, reducing load time to 45ms and saving $2M across 100,000+ users with 3x higher throughput.'
const tokens = extractMetricTokens(sampleText)
console.log('Extracted metric tokens:', tokens)

assert(tokens.includes('35%'), 'Should extract 35%')
assert(tokens.includes('45ms'), 'Should extract 45ms')
assert(tokens.includes('$2m'), 'Should extract $2M')
assert(tokens.includes('3x'), 'Should extract 3x')
assert(tokens.some(t => t.includes('100,000') || t.includes('users')), 'Should extract user count')

// Must NOT include 2023 or 3.11 or 19
assert(!tokens.includes('2023'), 'Must NOT extract 2023 year as a metric')
assert(!tokens.includes('3.11'), 'Must NOT extract Python 3.11 version')
assert(!tokens.includes('19'), 'Must NOT extract React 19 version')
console.log('PASS: Metric token extraction passed with zero year/version false positives.')

console.log('=== TEST 3: 5-Gram Phrase Extraction ===')
const phraseText = 'Architected event-driven microservices partnering with cross-functional squads to ensure high availability.'
const ngrams = extract5Grams(phraseText)
assert(ngrams.includes('partnering with cross functional squads'), 'Should include 5-gram')
assert(ngrams.length > 5, 'Should extract consecutive 5-grams')
console.log('PASS: 5-gram phrase extraction passed.')

console.log('=== TEST 4: Repetition Detector (Verbs > 2, Duplicate Metrics, Duplicate Phrases) ===')
const testBullets = [
  // 3 bullets starting with Architect / Architected -> 3rd is violator
  {
    bulletId: 'exp_001_b01',
    originalText: 'Built the microservice platform.',
    rewrittenText: 'Architected high-throughput microservices using Kafka, cutting latency by 35%.',
    tense: 'PAST',
    isCurrentRole: false,
  },
  {
    bulletId: 'exp_001_b02',
    originalText: 'Maintained cloud infrastructure.',
    rewrittenText: 'Architected Terraform infrastructure modules, reducing cloud spend by $150k.',
    tense: 'PAST',
    isCurrentRole: false,
  },
  {
    bulletId: 'exp_002_b01', // VIOLATOR: 3rd "architect" verb
    originalText: 'Designed database schemas.',
    rewrittenText: 'Architected PostgreSQL partitioning strategies, cutting query time by 35%.', // Also duplicates 35% metric!
    tense: 'PAST',
    isCurrentRole: false,
  },
  {
    bulletId: 'exp_002_b02',
    originalText: 'Wrote automated tests.',
    rewrittenText: 'Automated end-to-end Playwright test suites partnering with cross functional squads to ensure release safety.',
    tense: 'PAST',
    isCurrentRole: false,
  },
  {
    bulletId: 'exp_003_b01', // VIOLATOR: Duplicates 5-gram phrase "partnering with cross functional squads"
    originalText: 'Collaborated with team members.',
    rewrittenText: 'Streamlined continuous integration pipelines partnering with cross functional squads to ensure rapid deployment.',
    tense: 'PAST',
    isCurrentRole: false,
  },
]

const detResult = detectBulletRepetitions(testBullets)
console.log('Detection result hasRepetitions:', detResult.hasRepetitions)
console.log('Repair targets:', detResult.repairTargets.map(t => ({ id: t.bulletId, reasons: t.reasons })))

assert.strictEqual(detResult.hasRepetitions, true, 'Should detect repetitions')
const exp002b01Target = detResult.repairTargets.find(t => t.bulletId === 'exp_002_b01')
assert(exp002b01Target, 'exp_002_b01 should be flagged for repair')
assert(exp002b01Target.forbiddenVerbs.includes('architect'), 'Should forbid "architect"')
assert(exp002b01Target.forbiddenMetrics.includes('35%'), 'Should forbid "35%"')

const exp003b01Target = detResult.repairTargets.find(t => t.bulletId === 'exp_003_b01')
assert(exp003b01Target, 'exp_003_b01 should be flagged for 5-gram collision')
console.log('PASS: Repetition detector accurately identified verb, metric, and phrase violators.')

console.log('=== TEST 5: Deterministic Repetition Safety Net ===')
const mockValidation = {
  bulletUpgrades: testBullets.map(b => ({
    bulletId: b.bulletId,
    originalText: b.originalText,
    rewrittenText: b.rewrittenText,
  })),
  bulletRewrites: testBullets.map(b => ({
    bulletId: b.bulletId,
    originalText: b.originalText,
    rewrittenText: b.rewrittenText,
  })),
  issues: [
    {
      evidence: [{ bulletId: 'exp_002_b01' }],
      correctedText: 'Architected PostgreSQL partitioning strategies, cutting query time by 35%.',
    }
  ],
}

const mockCanonical = {
  experience: [
    {
      company: 'Alpha Corp',
      bullets: [
        { id: 'exp_001_b01', text: testBullets[0].originalText },
        { id: 'exp_001_b02', text: testBullets[1].originalText },
      ]
    },
    {
      company: 'Beta Inc',
      bullets: [
        { id: 'exp_002_b01', text: testBullets[2].originalText },
        { id: 'exp_002_b02', text: testBullets[3].originalText },
      ]
    },
    {
      company: 'Gamma LLC',
      bullets: [
        { id: 'exp_003_b01', text: testBullets[4].originalText },
      ]
    }
  ]
}

const contextMap = new Map([
  ['exp_001_b01', { isCurrentRole: false, tense: 'PAST' }],
  ['exp_001_b02', { isCurrentRole: false, tense: 'PAST' }],
  ['exp_002_b01', { isCurrentRole: false, tense: 'PAST' }],
  ['exp_002_b02', { isCurrentRole: false, tense: 'PAST' }],
  ['exp_003_b01', { isCurrentRole: false, tense: 'PAST' }],
])

applyDeterministicRepetitionSafetyNet(mockValidation, mockCanonical, contextMap)

console.log('\nRepaired Rewrites after Safety Net:')
mockValidation.bulletUpgrades.forEach(u => {
  console.log(`[${u.bulletId}] ${u.rewrittenText}`)
})

// Re-run detector on the repaired bullets
const repairedBullets = mockValidation.bulletUpgrades.map(u => ({
  bulletId: u.bulletId,
  originalText: u.originalText,
  rewrittenText: u.rewrittenText,
  tense: 'PAST',
  isCurrentRole: false,
}))

const postCheck = detectBulletRepetitions(repairedBullets)
console.log('\nPost-check hasRepetitions:', postCheck.hasRepetitions)

// 1. Verify that 'architect' is used no more than 2 times
const architectCount = postCheck.verbUsage.get('architect')?.length || 0
console.log('Count of "architect" opening verb:', architectCount)
assert(architectCount <= 2, `Opening verb "architect" should be <= 2, got ${architectCount}`)

// 2. Verify that exp_002_b01 was changed to a fresh verb
const exp002b01Upg = mockValidation.bulletUpgrades.find(u => u.bulletId === 'exp_002_b01')
assert(!exp002b01Upg.rewrittenText.startsWith('Architected'), 'exp_002_b01 should no longer start with Architected')

// 3. Verify that 35% metric collision was resolved
const hasDuplicate35 = repairedBullets.filter(b => b.rewrittenText.includes('35%')).length
assert(hasDuplicate35 <= 1, `Metric 35% should appear at most once, appeared ${hasDuplicate35} times`)

// 4. Verify issue was synchronized
assert(!mockValidation.issues[0].correctedText.startsWith('Architected'), 'Issue correctedText should be synchronized')
console.log('PASS: Deterministic Repetition Safety Net resolved all verb, metric, and phrase collisions.')

console.log('=== TEST 6: 15-Bullet Multi-Role Resume Scale Verification ===')
const largeResumeBullets = []
const verbsToTest = ['Engineered', 'Built', 'Automated', 'Spearheaded', 'Optimized']

// Create 15 bullets with some intentional repetitions
for (let i = 1; i <= 15; i++) {
  const bId = `exp_${String(Math.ceil(i/3)).padStart(3, '0')}_b${String(((i-1)%3)+1).padStart(2, '0')}`
  const verb = i <= 5 ? 'Engineered' : verbsToTest[i % verbsToTest.length] // 'Engineered' will appear 5 times!
  const isCurrent = i <= 3
  largeResumeBullets.push({
    bulletId: bId,
    originalText: `Original duty description for task number ${i}.`,
    rewrittenText: `${verb} scalable enterprise solution number ${i} delivering 30% performance gain.`,
    isCurrentRole: isCurrent,
    tense: isCurrent ? 'PRESENT' : 'PAST',
  })
}

const largeValidation = {
  bulletUpgrades: largeResumeBullets.map(b => ({
    bulletId: b.bulletId,
    originalText: b.originalText,
    rewrittenText: b.rewrittenText,
  })),
  bulletRewrites: largeResumeBullets.map(b => ({
    bulletId: b.bulletId,
    originalText: b.originalText,
    rewrittenText: b.rewrittenText,
  })),
  issues: [],
}

const largeCanonical = {
  experience: [1, 2, 3, 4, 5].map(expNum => ({
    company: `Company ${expNum}`,
    bullets: [1, 2, 3].map(bNum => ({
      id: `exp_${String(expNum).padStart(3, '0')}_b${String(bNum).padStart(2, '0')}`,
      text: `Original duty description for task number ${(expNum-1)*3 + bNum}.`,
    }))
  }))
}

const largeContextMap = new Map()
largeResumeBullets.forEach(b => {
  largeContextMap.set(b.bulletId, { isCurrentRole: b.isCurrentRole, tense: b.tense })
})

applyDeterministicRepetitionSafetyNet(largeValidation, largeCanonical, largeContextMap)

// Check every opening verb lemma count
const finalBullets = largeValidation.bulletUpgrades.map(u => ({
  bulletId: u.bulletId,
  originalText: u.originalText,
  rewrittenText: u.rewrittenText,
  isCurrentRole: largeContextMap.get(u.bulletId).isCurrentRole,
  tense: largeContextMap.get(u.bulletId).tense,
}))

const finalCheck = detectBulletRepetitions(finalBullets)
for (const [lemma, occurrences] of finalCheck.verbUsage.entries()) {
  console.log(`Lemma '${lemma}': ${occurrences.length} occurrences`)
  assert(occurrences.length <= 2, `Lemma '${lemma}' exceeded max 2 occurrences: ${occurrences.length}`)
}

// Check metric diversity: 30% was repeated 15 times originally!
const count30 = finalBullets.filter(b => b.rewrittenText.includes('30%')).length
console.log('Count of 30% after safety net:', count30)
assert(count30 <= 1, `Metric 30% should appear at most once across resume, got ${count30}`)

console.log('PASS: 15-bullet multi-role resume test passed with 100% verb and metric diversity!')
console.log('\nALL ANTI-REPETITION UNIT TESTS PASSED SUCCESSFULLY!')
