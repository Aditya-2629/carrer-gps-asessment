/**
 * Test script for Phase 2: Bullet-Level Evidence Validation & 7-Dimension Quality Judge
 */
import assert from 'assert'
import {
  replaceUnverifiedNumericTokens,
  buildBulletSourceTokens,
  tagEvidenceStatus,
  validateClaims,
} from '../agents/resume/validation/claimValidator.js'
import {
  validateRewrite,
  validateAllRewrites,
} from '../agents/resume/validation/rewriteValidator.js'
import {
  judgeBulletRewrite,
  heuristicScore,
} from '../agents/judge/judgeAgent.js'

console.log('🧪 Starting Phase 2 Validation Test Suite...\n')

// ── Test 1: Real Metrics Resume ──
console.log('--- Test 1: Resume with Verified Metrics ---')
const canonicalResumeWithMetrics = {
  experience: [
    {
      id: 'exp_001',
      company: 'Stripe',
      role: 'Staff Software Engineer',
      bullets: [
        {
          id: 'exp_001_b01',
          text: 'Architected high-throughput payment microservices cutting p99 latency by 35% across 250k daily transactions using Redis and Kafka.',
        },
        {
          id: 'exp_001_b02',
          text: 'Automated CI/CD deployment pipelines on AWS EKS reducing release cycles from 4 hours to 25 minutes with 99.99% service availability.',
        },
      ],
    },
  ],
}

// 1a. Validate bullet-level source tokens isolation (Project/Job isolation)
const b01Tokens = buildBulletSourceTokens(canonicalResumeWithMetrics, 'exp_001_b01')
assert(b01Tokens.has('35%'), 'b01Tokens must contain 35%')
assert(b01Tokens.has('250k'), 'b01Tokens must contain 250k')
assert(!b01Tokens.has('99.99%'), 'b01Tokens must NOT contain metrics from b02!')

// 1b. Validate rewrite preserving verified metrics is tagged VERIFIED
const verifiedRewrite = 'Architected high-throughput payment microservices utilizing Redis and Kafka, cutting p99 latency by 35% across 250k daily transactions.'
const verifiedStatus = tagEvidenceStatus(verifiedRewrite, b01Tokens)
console.log('Verified Rewrite status:', verifiedStatus)
assert.strictEqual(verifiedStatus, 'VERIFIED', 'Status should be VERIFIED for source-grounded metrics')

// 1c. Verify replaceUnverifiedNumericTokens does NOT strip verified metrics
const sanitizedVerified = replaceUnverifiedNumericTokens(verifiedRewrite, b01Tokens, canonicalResumeWithMetrics, { bulletId: 'exp_001_b01' })
assert(sanitizedVerified.includes('35%'), 'Verified metric 35% must be preserved')
assert(sanitizedVerified.includes('250k'), 'Verified scale 250k must be preserved')
console.log('✅ Test 1 Passed: Real metrics preserved and correctly tagged as VERIFIED\n')

// ── Test 2: Unquantified Resume (0% metrics) with Fake Metric Injection ──
console.log('--- Test 2: 0% Metrics Resume with Injected Fake Metric ---')
const canonicalResumeZeroMetrics = {
  experience: [
    {
      id: 'exp_002',
      company: 'HealthTech Inc',
      role: 'Frontend Engineer',
      bullets: [
        {
          id: 'exp_002_b01',
          text: 'Developed patient intake forms and UI components using React and TypeScript.',
        },
      ],
    },
  ],
}

const b02Tokens = buildBulletSourceTokens(canonicalResumeZeroMetrics, 'exp_002_b01')
assert.strictEqual(b02Tokens.size, 0, 'Source bullet has 0 numeric fact tokens')

// Mock LLM output injecting fake metrics
const fakeInjectedRewrite = 'Engineered responsive patient intake components using React and TypeScript, accelerating form completion speed by 45% and supporting 10M+ daily transactions with 99.99% uptime.'
const injectedStatus = tagEvidenceStatus(fakeInjectedRewrite, b02Tokens)
console.log('Injected Rewrite initial status:', injectedStatus)
assert.strictEqual(injectedStatus, 'UNVERIFIED', 'Unverified numeric claim must be flagged UNVERIFIED')

// 2a. Sanitize via replaceUnverifiedNumericTokens
const sanitizedClean = replaceUnverifiedNumericTokens(fakeInjectedRewrite, b02Tokens, canonicalResumeZeroMetrics, {
  bulletId: 'exp_002_b01',
  sourceText: 'Developed patient intake forms and UI components using React and TypeScript.',
})
console.log('Original Injected Rewrite:\n ', fakeInjectedRewrite)
console.log('Sanitized Grounded Rewrite:\n ', sanitizedClean)

assert(!sanitizedClean.includes('45%'), 'Fake 45% must be removed')
assert(!sanitizedClean.includes('10M+'), 'Fake 10M+ must be sanitized')
assert(!sanitizedClean.includes('99.99%'), 'Fake 99.99% must be sanitized')
assert(!sanitizedClean.includes('[ADD:'), 'Must NEVER inject bracketed [ADD: ...] placeholders')
assert(sanitizedClean.includes('React and TypeScript'), 'Verified technologies must be preserved')

// 2b. Validate rewriteValidator integration
const validationResult = validateRewrite(
  fakeInjectedRewrite,
  'Developed patient intake forms and UI components using React and TypeScript.',
  'exp_002_b01',
  new Set(['react', 'typescript']),
  canonicalResumeZeroMetrics
)
console.log('validateRewrite output:', {
  evidenceStatus: validationResult.evidenceStatus,
  sanitizedText: validationResult.sanitizedText,
})
assert.strictEqual(validationResult.evidenceStatus, 'GROUNDED_QUALITATIVE', 'After sanitization, evidenceStatus must be GROUNDED_QUALITATIVE')
assert(!validationResult.sanitizedText.includes('45%'), 'Sanitized text must not contain 45%')
console.log('✅ Test 2 Passed: Unverified metrics caught, sanitized to qualitative phrasing, and tagged GROUNDED_QUALITATIVE\n')

// ── Test 3: validateClaims with Layer B Metric Opportunities ──
console.log('--- Test 3: Full Analysis Validation with Layer B Metric Opportunities ---')
const mockAnalysis = {
  analysisVersion: '2.2',
  overallReview: {
    summary: 'Strong frontend engineering background with modern component architectures.',
  },
  strengths: [
    {
      id: 'str_001',
      description: 'Solid demonstrated expertise across React and TypeScript.',
    },
  ],
  issues: [
    {
      id: 'issue_001',
      severity: 'high',
      category: 'impact',
      title: 'Unquantified Component Deliverables',
      diagnosis: 'Candidate Activity (Task): Developed patient intake forms. Outcome Deficit: Lacks technical scale or operational outcome.',
      recommendation: 'Quantify impact on user completion velocity and form rendering performance.',
      correctedText: 'Engineered modular patient intake workflows in React and TypeScript, optimizing client-side render performance and eliminating layout regressions.',
      metricOpportunities: [
        {
          label: 'Form Completion Velocity',
          question: 'How much faster did patient form completion become after redesign?',
          unitHint: '% or minutes',
        },
        {
          label: 'Client-Side Render Latency',
          question: 'By how many milliseconds did First Contentful Paint drop?',
          unitHint: 'ms',
        },
      ],
      evidence: [
        {
          bulletId: 'exp_002_b01',
          originalText: 'Developed patient intake forms and UI components using React and TypeScript.',
        },
      ],
    },
  ],
}

const claimResult = validateClaims(mockAnalysis, canonicalResumeZeroMetrics)
console.log('validateClaims valid:', claimResult.valid)
console.log('issue_001 evidenceStatus:', mockAnalysis.issues[0].evidenceStatus)
console.log('metricOpportunities[0] evidenceStatus:', mockAnalysis.issues[0].metricOpportunities[0].evidenceStatus)

assert.strictEqual(mockAnalysis.issues[0].evidenceStatus, 'GROUNDED_QUALITATIVE', 'Layer A rewrite with zero fake % must be GROUNDED_QUALITATIVE')
assert.strictEqual(mockAnalysis.issues[0].metricOpportunities[0].evidenceStatus, 'ILLUSTRATIVE', 'Layer B metric opportunities must be tagged ILLUSTRATIVE')
assert(
  !claimResult.violations.some((v) => v.includes('metricOpportunities')),
  'metricOpportunities must NEVER be flagged as fabricated claims'
)
console.log('✅ Test 3 Passed: validateClaims correctly tags Layer A as GROUNDED_QUALITATIVE and Layer B as ILLUSTRATIVE\n')

// ── Test 4: 7-Dimension Quality Judge ──
console.log('--- Test 4: 7-Dimension Quality Judge Evaluation ---')

// 4a. Grounded Qualitative Rewrite (0% numbers, strong operational outcome)
const judgeQualitativeResult = judgeBulletRewrite({
  rewrite: mockAnalysis.issues[0].correctedText,
  originalText: mockAnalysis.issues[0].evidence[0].originalText,
  targetRole: 'Frontend Engineer',
  evidenceStatus: 'GROUNDED_QUALITATIVE',
})
console.log('Grounded Qualitative Judge Score:', judgeQualitativeResult.totalScore, '/ 100')
console.log('Dimensions:', judgeQualitativeResult.dimensions)
assert(
  judgeQualitativeResult.totalScore >= 80,
  `Strong qualitative rewrite must score >= 80/100 (got ${judgeQualitativeResult.totalScore})`
)
assert.strictEqual(judgeQualitativeResult.passesThreshold, true, 'passesThreshold must be true')

// 4b. Fake Injected Rewrite (with unverified numbers)
const judgeFakeResult = judgeBulletRewrite({
  rewrite: fakeInjectedRewrite,
  originalText: mockAnalysis.issues[0].evidence[0].originalText,
  targetRole: 'Frontend Engineer',
  evidenceStatus: 'UNVERIFIED',
})
console.log('Unverified Injected Judge Score:', judgeFakeResult.totalScore, '/ 100')
console.log('Flags:', judgeFakeResult.flags)
assert(
  judgeFakeResult.totalScore < judgeQualitativeResult.totalScore,
  'Unverified rewrite must score lower than grounded qualitative rewrite'
)
assert(
  judgeFakeResult.flags.some((f) => f.includes('Unverified numeric claim penalized')),
  'Must penalize unverified numeric claims in judge flags'
)

console.log('\n🎉 ALL PHASE 2 VALIDATION TESTS PASSED!')
