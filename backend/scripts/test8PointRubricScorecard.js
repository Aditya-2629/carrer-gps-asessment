/**
 * 8-Point Human-First Resume Rubric & Scorecard Verification Suite
 *
 * Validates deterministic line-by-line bullet audit:
 * 1. Qualitative STAR/CAR outcomes (retiring legacy tools, enforcing RBAC, etc.) marked "pass" without numbers
 * 2. Gerund (-ing) opening ban
 * 3. Past role present tense verb detection
 * 4. Weak / supporting opening verbs (Using, Assisted, etc.)
 * 5. Repetitive action verbs across resume and within same entry
 * 6. AI buzzwords and corporate cliches
 * 7. Genuine missing CAR outcome
 * 8. Zero occurrences of the old "invisible at a glance" spam
 */

import { computePrecomputedSignals } from '../agents/resume/signals/precomputedSignals.js'
import { computeScorecard } from '../agents/resume/scoring/resumeScorecard.js'
import assert from 'assert'

console.log('================================================================')
console.log('8-POINT HUMAN-FIRST RESUME RUBRIC VERIFICATION SUITE')
console.log('================================================================\n')

const sampleCanonicalResume = {
  candidate: {
    name: 'Alex Developer',
    targetRole: 'Senior Full Stack Engineer',
  },
  experience: [
    {
      id: 'exp_001',
      company: 'Current FinTech Corp',
      role: 'Senior Staff Engineer',
      dates: 'April 2024 – Present',
      isCurrent: true,
      bullets: [
        // 1. Qualitative CAR outcome without metrics (retiring legacy OpenText CMS) -> MUST PASS
        {
          id: 'exp_001_b01',
          text: 'Architected modern responsive UI using React and TypeScript to retire legacy OpenText CMS.',
        },
        // 2. Gerund opening in current role -> MUST flag gerund_opening
        {
          id: 'exp_001_b02',
          text: 'Designing distributed microservices using Go, Redis, and gRPC.',
        },
        // 3. Weak opener -> MUST flag weakVerbIssue
        {
          id: 'exp_001_b03',
          text: 'Using prompt engineering to explore LLM integration for client search queries.',
        },
        // 4. Repetitive opener #1 in entry
        {
          id: 'exp_001_b04',
          text: 'Architected secure authentication boundary enforcing OAuth2 and JWT role-based access control.',
        },
      ],
    },
    {
      id: 'exp_002',
      company: 'Past Healthcare Systems',
      role: 'Full Stack Engineer',
      dates: 'Jan 2021 – Mar 2024',
      isCurrent: false,
      bullets: [
        // 5. Present tense verb in past role -> MUST flag wrong_tense
        {
          id: 'exp_002_b01',
          text: 'Develop internal dashboards for patient record management.',
        },
        // 6. AI buzzwords -> MUST flag buzzwordIssue
        {
          id: 'exp_002_b02',
          text: 'Engineered cutting-edge solutions in a fast-paced environment leveraging GraphQL.',
        },
        // 7. Repetitive opener #3 across resume ("Architected") -> MUST flag repetitiveVerbIssue
        {
          id: 'exp_002_b03',
          text: 'Architected database sharding scheme handling 10,000 requests per second.',
        },
        // 8. Genuine missing outcome (task/tool list without CAR outcome or metrics)
        {
          id: 'exp_002_b04',
          text: 'Configured Docker containers and Jenkins pipelines for testing.',
        },
      ],
    },
  ],
  projects: [],
}

const precomputedSignals = computePrecomputedSignals(sampleCanonicalResume)
const scorecard = computeScorecard({
  analysis: { issues: [], strengths: [] },
  canonicalResume: sampleCanonicalResume,
  precomputedSignals,
})

const auditMap = new Map(scorecard.bulletAudit.map((b) => [b.bulletId, b]))

// ── Test 1: Qualitative CAR outcome without number ─────────────────────────
console.log('--- Test 1: Qualitative STAR/CAR outcome without number ---')
const b1 = auditMap.get('exp_001_b01')
assert.strictEqual(b1.status, 'pass', 'Qualitative CAR outcome (to retire OpenText CMS) must pass (status: pass)')
assert.strictEqual(b1.reason, 'Clear, specific, no defects found')
console.log('PASS: Qualitative CAR bullet marked GOOD without demanding fake metrics.')

// ── Test 2: Gerund (-ing) opening ban ────────────────────────────────────────
console.log('\n--- Test 2: Gerund opening ban ---')
const b2 = auditMap.get('exp_001_b02')
assert.strictEqual(b2.status, 'warn', 'Gerund opening must be flagged (status: warn)')
assert(b2.reason.includes("Starts with an '-ing' participle ('Designing')"), 'Reason must specify gerund opening')
assert(b2.reason.includes('present-tense verb'), 'In current role, recommends present-tense verb')
console.log(`PASS: Gerund opener flagged correctly: "${b2.reason}"`)

// ── Test 3: Weak opening verbs ───────────────────────────────────────────────
console.log('\n--- Test 3: Weak / supporting opening verbs ---')
const b3 = auditMap.get('exp_001_b03')
assert.strictEqual(b3.status, 'warn', 'Weak opener must be flagged (status: warn)')
assert(b3.reason.includes("Opens with weak/supporting phrasing ('Using')"), 'Reason must specify weak phrasing')
console.log(`PASS: Weak opener flagged correctly: "${b3.reason}"`)

// ── Test 4: Repetitive opener in same entry ─────────────────────────────────
console.log('\n--- Test 4: Repetitive opener in same entry ---')
const b4 = auditMap.get('exp_001_b04')
assert.strictEqual(b4.status, 'warn', 'Repetitive opener in same entry must be flagged')
assert(b4.reason.includes("Repeats opening verb 'Architected'"), 'Reason must diagnose repetition')
console.log(`PASS: Repetitive opener in same entry flagged: "${b4.reason}"`)

// ── Test 5: Wrong tense in past role ────────────────────────────────────────
console.log('\n--- Test 5: Wrong tense in past role ---')
const b5 = auditMap.get('exp_002_b01')
assert.strictEqual(b5.status, 'warn', 'Present tense in past role must be flagged')
assert(b5.reason.includes("Past role uses present-tense verb ('Develop')"), 'Reason must diagnose wrong tense')
console.log(`PASS: Wrong tense in past role flagged: "${b5.reason}"`)

// ── Test 6: AI buzzwords ────────────────────────────────────────────────────
console.log('\n--- Test 6: AI buzzwords & corporate cliches ---')
const b6 = auditMap.get('exp_002_b02')
assert.strictEqual(b6.status, 'warn', 'AI buzzword must be flagged')
assert(b6.reason.includes('generic/AI-sounding buzzword'), 'Reason must diagnose buzzword')
console.log(`PASS: Buzzword flagged: "${b6.reason}"`)

// ── Test 7: Repetitive opener 3x across resume ──────────────────────────────
console.log('\n--- Test 7: Repetitive opener 3x across resume ---')
const b7 = auditMap.get('exp_002_b03')
assert.strictEqual(b7.status, 'warn', 'Opener used 3x across resume must be flagged')
assert(b7.reason.includes("Repeats opening verb 'Architected' (used 3x)"), 'Reason must show 3x count')
console.log(`PASS: 3x repetitive opener across resume flagged: "${b7.reason}"`)

// ── Test 8: Genuine missing CAR outcome ─────────────────────────────────────
console.log('\n--- Test 8: Genuine missing CAR outcome ---')
const b8 = auditMap.get('exp_002_b04')
assert.strictEqual(b8.status, 'warn', 'Bullet without outcome or quantifier must be warned')
assert(
  b8.reason.includes('omits the business result') || b8.reason.includes('omits the result'),
  'Reason must diagnose missing outcome'
)
console.log(`PASS: Genuine missing outcome message: "${b8.reason}"`)

// ── Test 9: Zero occurrences of old message ─────────────────────────────────
console.log('\n--- Test 9: Zero old spam messages ---')
for (const item of scorecard.bulletAudit) {
  assert(!item.reason.includes('invisible at a glance'), 'Old spam string must never appear')
}
console.log('PASS: Confirmed zero occurrences of "invisible at a glance" spam.')

console.log('\n================================================================')
console.log('ALL 9 RUBRIC & SCORECARD TESTS PASSED PERFECTLY!')
console.log('================================================================')
