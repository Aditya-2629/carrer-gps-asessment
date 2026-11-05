/**
 * testJudgeHumanizationGate.js
 *
 * Verifies Task 4:
 * 1. Judge Agent detects robotic AI slop (e.g. spearheaded, leveraged, cutting-edge)
 *    and caps score at <= 6 with explicit anti-slop flags.
 * 2. Judge Agent rewards clean, humanized, technical engineering narratives
 *    with score >= 8 and zero buzzword flags.
 */

import assert from 'node:assert/strict'
import { judgeReport, BANNED_AI_SLOP_REGEX } from '../agents/judge/judgeAgent.js'

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🧪 Running Test Suite: Judge Agent Humanization & Anti-Slop Gate')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// =========================================================================
// TEST 1: Negative Fixture — Robotic AI Slop Detection & Penalty
// =========================================================================
console.log('[Test 1] Testing Negative Fixture: Robotic AI Slop Detection...')

const slopReport = {
  career_health_score: 75,
  executive_verdict: 'Spearheaded the migration of microservices leveraging cutting-edge cloud tech.',
  critical_issues: [
    {
      title: 'Cloud Architecture',
      diagnosis: 'Leveraged Docker and Kubernetes to build synergistic microservices.',
      action_steps: ['Spearhead continuous deployment pipelines'],
      evidence: 'Spearheaded container platform',
    },
  ],
}

const slopResult = await judgeReport(slopReport)
assert.strictEqual(slopResult.success, true, 'Judge execution should succeed')
const slopJudge = slopResult.result

console.log(`  Slop Report Score: ${slopJudge.score}/10 (Tone subscore: ${slopJudge.subscores?.tone}/10)`)
console.log(`  Flags Emitted: ${JSON.stringify(slopJudge.flags)}`)

// 1. Assert score capped at <= 6
assert.ok(
  slopJudge.score <= 6,
  `Overall score must be capped at <= 6 when AI buzzwords are detected (got ${slopJudge.score})`
)

// 2. Assert tone subscore capped at <= 5
assert.ok(
  slopJudge.subscores.tone <= 5,
  `Tone subscore must be capped at <= 5 for robotic slop (got ${slopJudge.subscores.tone})`
)

// 3. Assert flags contains anti-slop warning
assert.ok(
  slopJudge.flags.some((f) => /robotic AI buzzwords|spearheaded|leveraged|synergistic/i.test(f)),
  'Flags must contain explicit robotic AI buzzwords warning'
)

console.log('  ✔ 1.1 Negative fixture penalized: Score capped at <= 6, tone subscore capped at <= 5, anti-slop flag emitted.\n')

// =========================================================================
// TEST 2: Positive Fixture — Humanized Technical Voice Approval
// =========================================================================
console.log('[Test 2] Testing Positive Fixture: Humanized Technical Engineering Voice...')

const cleanReport = {
  career_health_score: 85,
  executive_verdict: 'Alekya, your experience at Bank of America shows real enterprise scale. Migrated legacy monolith authentication to containerized Spring Boot services on Kubernetes, reducing p99 latency from 450ms to 120ms.',
  critical_issues: [
    {
      title: 'Single-Column ATS Architecture',
      diagnosis: 'Resume document structure parses with high fidelity across enterprise ATS engines.',
      action_steps: ['Maintain clean single-column PDF export format'],
      evidence: 'Direct plain-text work history entries at Bank of America',
    },
    {
      title: 'Connection Pool Timeout Hardening',
      diagnosis: 'Database connection starvation under concurrent peak traffic.',
      action_steps: ['Configure HikariCP maximumPoolSize and 30s connectionTimeout in production'],
      evidence: 'Configured transaction pool thresholds across 12 services',
    },
    {
      title: 'Direct Hiring Manager Outbound',
      diagnosis: 'Cold portal Easy Apply conversion is low; direct outbound achieves 18-24% callbacks.',
      action_steps: ['Send targeted 3-sentence technical pitch to Engineering Directors'],
      evidence: 'Direct engineering outreach log',
    },
  ],
  resume_agent: {
    overallReview: {
      summary: 'Alekya, your resume demonstrates verified backend architecture scale at Bank of America.',
    },
    issues: [
      {
        title: 'Kafka Partition Lag Metric',
        whyItMatters: 'Recruiters scan for high-throughput stream processing proof.',
        recommendation: 'Cite 50,000 events/sec throughput and zero consumer lag metric.',
        evidence: { originalText: 'Built Kafka event consumers handling payments.' },
      },
    ],
  },
}

const cleanResult = await judgeReport(cleanReport)
assert.strictEqual(cleanResult.success, true, 'Judge execution should succeed')
const cleanJudge = cleanResult.result

console.log(`  Clean Report Score: ${cleanJudge.score}/10 (Tone subscore: ${cleanJudge.subscores?.tone}/10)`)
console.log(`  Flags Emitted: ${JSON.stringify(cleanJudge.flags)}`)

// 1. Assert score >= 8
assert.ok(
  cleanJudge.score >= 8,
  `Clean humanized engineering report must score >= 8 (got ${cleanJudge.score})`
)

// 2. Assert tone subscore >= 8
assert.ok(
  cleanJudge.subscores.tone >= 8,
  `Tone subscore must be >= 8 for humanized voice (got ${cleanJudge.subscores.tone})`
)

// 3. Assert zero buzzword or corporate filler flags emitted
assert.strictEqual(
  cleanJudge.flags.some((f) => /robotic|buzzwords|spearheaded|leveraged|filler/i.test(f)),
  false,
  'Clean report must NOT emit buzzword or corporate filler flags'
)

console.log('  ✔ 2.1 Positive fixture approved: Score >= 8, tone subscore >= 8, zero buzzword flags emitted.\n')

// =========================================================================
// TEST 3: Regex Pattern Integrity
// =========================================================================
console.log('[Test 3] Verifying BANNED_AI_SLOP_REGEX pattern coverage...')

const testBuzzwords = [
  'spearheaded',
  'leveraged',
  'synergy',
  'synergistic',
  'cutting-edge',
  'results-driven',
  'passionate',
  'pivotal',
  'instrumental',
  'testament to',
  'proven track record',
  'delved',
  'thrives in fast-paced',
  'seamlessly integrated',
]

for (const buzz of testBuzzwords) {
  assert.ok(
    BANNED_AI_SLOP_REGEX.test(`We ${buzz} the project`),
    `BANNED_AI_SLOP_REGEX must match "${buzz}"`
  )
}

console.log(`  ✔ 3.1 All ${testBuzzwords.length} test buzzwords accurately matched by BANNED_AI_SLOP_REGEX.\n`)

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎉 ALL JUDGE HUMANIZATION & ANTI-SLOP TESTS PASSED!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

