/**
 * testLinkedInActivityGoldenSuite.js
 * End-to-End Activity Golden Verification Suite (Phase 7)
 *
 * Validates the LinkedIn Activity, Post Frequency & Engagement Intelligence module:
 * - Gate 1: Deterministic Engine Execution & SLA (< 10ms)
 * - Gate 2: 5-Pillar Scorecard Integration & Rebalancing
 * - Gate 3: Thought Leadership LLM Fast-Path & Blueprint Structure
 * - Gate 4: Apify Error Resilience & SmartKeyPool Rotation
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

import { extractLinkedInActivitySignals } from '../agents/linkedin/linkedinActivityEngine.js'
import { computeLinkedInScorecard } from '../agents/linkedin/linkedinScorecard.js'
import {
  evaluateThoughtLeadershipAndSocialSeo,
  buildDeterministicThoughtLeadership,
} from '../agents/linkedin/linkedinThoughtLeadershipEvaluator.js'
import { scrapeLinkedInPosts } from '../utils/apifyLinkedInPostsScraper.js'
import { apifyKeyPool } from '../utils/smartKeyPool.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

console.log('================================================================')
console.log('LINKEDIN ACTIVITY GOLDEN VERIFICATION SUITE (PHASE 7)')
console.log('================================================================\n')

// Load Fixtures
const fixturesPath = path.join(rootDir, 'backend/tests/fixtures/linkedin-activity-fixtures.json')
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'))

const { ghostCandidate, activeTechLead, genericFluffPoster } = fixtures

assert(ghostCandidate, 'Fixture ghostCandidate must be present')
assert(activeTechLead, 'Fixture activeTechLead must be present')
assert(genericFluffPoster, 'Fixture genericFluffPoster must be present')

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1: Deterministic Engine Execution & Latency SLA (< 10ms)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- GATE 1: Deterministic Signal Engine Execution & Latency SLA (< 10ms) ---')

// Warm-up JIT compilation across all fixtures
for (let i = 0; i < 3; i++) {
  extractLinkedInActivitySignals(ghostCandidate, ghostCandidate.targetRole, ghostCandidate.coreSkills)
  extractLinkedInActivitySignals(activeTechLead, activeTechLead.targetRole, activeTechLead.coreSkills)
  extractLinkedInActivitySignals(genericFluffPoster, genericFluffPoster.targetRole, genericFluffPoster.coreSkills)
}

const t0 = performance.now()
const ghostSignals = extractLinkedInActivitySignals(
  ghostCandidate,
  ghostCandidate.targetRole,
  ghostCandidate.coreSkills
)
const activeSignals = extractLinkedInActivitySignals(
  activeTechLead,
  activeTechLead.targetRole,
  activeTechLead.coreSkills
)
const fluffSignals = extractLinkedInActivitySignals(
  genericFluffPoster,
  genericFluffPoster.targetRole,
  genericFluffPoster.coreSkills
)
const batchElapsedMs = performance.now() - t0

console.log(`  ⏱️  Batch execution latency across 3 golden fixtures: ${batchElapsedMs.toFixed(3)}ms`)
assert(
  batchElapsedMs < 10,
  `Deterministic engine SLA violation: ${batchElapsedMs.toFixed(3)}ms >= 10ms`
)

// Assert Ghost Candidate
assert.strictEqual(ghostSignals.recencyTier, 'Dormant', 'Ghost candidate recencyTier must be Dormant')
assert.strictEqual(ghostSignals.isGhostProfile, true, 'Ghost candidate isGhostProfile must be true')
assert.strictEqual(ghostSignals.postsAnalyzedCount, 0, 'Ghost candidate postsAnalyzedCount must be 0')

// Assert Active Tech Lead
assert.strictEqual(activeSignals.recencyTier, 'Highly Active', 'Active tech lead recencyTier must be Highly Active')
assert(
  activeSignals.daysSinceLastPost !== null && activeSignals.daysSinceLastPost <= 7,
  `Active tech lead daysSinceLastPost must be <= 7, got ${activeSignals.daysSinceLastPost}`
)
assert(
  activeSignals.domainAlignment.domainKeywordOverlapScore >= 75,
  `Active tech lead domainKeywordOverlapScore must be >= 75, got ${activeSignals.domainAlignment.domainKeywordOverlapScore}`
)
assert(
  activeSignals.cadenceHealth === 'Optimal' || activeSignals.cadenceHealth === 'High Volume',
  'Active tech lead cadence must be Optimal or High Volume'
)

// Assert Generic Fluff Poster
assert(
  fluffSignals.substance.fluffIndicatorCount >= 2,
  `Generic fluff poster fluffIndicatorCount must be >= 2, got ${fluffSignals.substance.fluffIndicatorCount}`
)
assert(
  fluffSignals.domainAlignment.domainKeywordOverlapScore < 30,
  `Generic fluff poster domainKeywordOverlapScore must be < 30, got ${fluffSignals.domainAlignment.domainKeywordOverlapScore}`
)

console.log('  ✅ Gate 1 Passed: Latency < 10ms and all deterministic signals accurately classified.')

// ─────────────────────────────────────────────────────────────────────────────
// GATE 2: 5-Pillar Scorecard Integration & Rebalancing
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- GATE 2: 5-Pillar Scorecard Integration & Rebalancing ---')

const mockStrongProfileSignals = {
  headline: {
    isMissing: false,
    isTooShort: false,
    isTooLong: false,
    text: 'Staff Distributed Systems Engineer | Go, Kubernetes, Kafka & AWS | Cloud Scale',
    wordCount: 11,
    targetRoleMatches: true,
  },
  about: {
    isMissing: false,
    isThin: false,
    hasMetrics: true,
    length: 1250,
  },
  visibility: {
    connectionBracket: '500+',
    connectionsCount: 780,
    hasRecommendations: true,
    hasCustomUrl: true,
  },
  completeness: {
    hasExperiences: true,
    expWithDescription: 3,
    experienceCount: 3,
    hasEducation: true,
    skillsCount: 18,
  },
}

// 1. Null Activity (Legacy 4-category fallback)
const nullActivityScorecard = computeLinkedInScorecard(
  mockStrongProfileSignals,
  null,
  'Staff Engineer',
  null
)
assert(nullActivityScorecard, 'Null activity scorecard must return valid object')
assert.strictEqual(
  Object.keys(nullActivityScorecard.categoryWeights).length,
  4,
  'Null activity scorecard must have exactly 4 categories'
)
const nullWeightsSum = Object.values(nullActivityScorecard.categoryWeights).reduce((a, b) => a + b, 0)
assert(
  Math.abs(nullWeightsSum - 1.0) < 0.0001,
  `Null activity category weights must sum to 1.0, got ${nullWeightsSum}`
)
assert.strictEqual(nullActivityScorecard.grades.activity, undefined, 'Null activity scorecard must not have activity grade')

// 2. Ghost Candidate (5 categories, Grade D or F, li_act_001 emitted, score >= 60)
const ghostScorecard = computeLinkedInScorecard(
  mockStrongProfileSignals,
  null,
  ghostCandidate.targetRole,
  ghostSignals
)
assert(ghostScorecard.grades.activity, 'Ghost scorecard must contain activity grade')
assert(
  ghostScorecard.grades.activity.grade === 'F' || ghostScorecard.grades.activity.grade === 'D',
  `Ghost candidate activity grade must be F or D, got ${ghostScorecard.grades.activity.grade}`
)
const ghostIssue001 = ghostScorecard.issues.find((i) => i.id === 'li_act_001')
assert(ghostIssue001, 'Ghost candidate must emit issue li_act_001')
assert.strictEqual(ghostIssue001.category, 'activity', 'Issue li_act_001 category must be activity')
assert(
  ghostScorecard.score >= 60,
  `Ghost candidate overall score with strong branding must remain >= 60, got ${ghostScorecard.score}`
)
assert.strictEqual(
  Object.keys(ghostScorecard.categoryWeights).length,
  5,
  'Rebalanced scorecard must have exactly 5 categories'
)
const fivePillarWeightsSum = Object.values(ghostScorecard.categoryWeights).reduce((a, b) => a + b, 0)
assert(
  Math.abs(fivePillarWeightsSum - 1.0) < 0.0001,
  `5-pillar category weights must sum to 1.0, got ${fivePillarWeightsSum}`
)

// 3. Active Tech Lead (Activity score >= 85, Grade A)
const atlScorecard = computeLinkedInScorecard(
  mockStrongProfileSignals,
  null,
  activeTechLead.targetRole,
  activeSignals
)
assert(
  atlScorecard.grades.activity.score >= 85,
  `Active tech lead activity score must be >= 85, got ${atlScorecard.grades.activity.score}`
)
assert.strictEqual(
  atlScorecard.grades.activity.grade,
  'A',
  `Active tech lead activity grade must be A, got ${atlScorecard.grades.activity.grade}`
)

// 4. Fluff Poster (li_act_003 and li_act_004 emitted)
const fluffScorecard = computeLinkedInScorecard(
  mockStrongProfileSignals,
  null,
  genericFluffPoster.targetRole,
  fluffSignals
)
const hasAct003 = fluffScorecard.issues.some((i) => i.id === 'li_act_003')
const hasAct004 = fluffScorecard.issues.some((i) => i.id === 'li_act_004')
assert(hasAct003, 'Fluff poster must emit issue li_act_003 (Generic / Low-Substance Content)')
assert(hasAct004, 'Fluff poster must emit issue li_act_004 (Posts Lack Target Domain Keywords)')

console.log('  ✅ Gate 2 Passed: 5-pillar scorecard weights rebalance to 1.0, and category issues emitted accurately.')

// ─────────────────────────────────────────────────────────────────────────────
// GATE 3: Thought Leadership LLM Fast-Path & Blueprint Structure
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- GATE 3: Thought Leadership LLM Fast-Path & Blueprint Structure ---')

let llmCallCount = 0
const originalGenerate = llmGateway.generate
llmGateway.generate = async (...args) => {
  llmCallCount++
  return originalGenerate.apply(llmGateway, args)
}

// 1. Ghost Profile Zero-LLM Fast-Path Verification
const ghostT0 = performance.now()
const ghostTL = await evaluateThoughtLeadershipAndSocialSeo({
  activitySignals: ghostSignals,
  posts: ghostCandidate.posts,
  resumeContext: {
    targetRole: ghostCandidate.targetRole,
    coreSkills: ghostCandidate.coreSkills,
  },
})
const ghostTLElapsed = performance.now() - ghostT0

console.log(`  ⏱️  Ghost candidate fast-path execution time: ${ghostTLElapsed.toFixed(3)}ms`)
assert(
  ghostTLElapsed < 15,
  `Fast-path execution should complete in < 15ms, took ${ghostTLElapsed.toFixed(3)}ms`
)
assert.strictEqual(
  llmCallCount,
  0,
  `Zero-LLM fast path failed: llmGateway was called ${llmCallCount} times for ghost candidate`
)
assert(ghostTL.actionablePostTemplates.length === 3, 'Ghost templates must have 3 items')
assert(ghostTL.thirtyDayCalendar.length === 4, 'Ghost 30-day calendar must have 4 weeks')

// 2. Active Tech Lead Blueprint Structure Verification
const atlTL = await evaluateThoughtLeadershipAndSocialSeo({
  activitySignals: activeSignals,
  posts: activeTechLead.posts,
  resumeContext: {
    targetRole: activeTechLead.targetRole,
    coreSkills: activeTechLead.coreSkills,
  },
  options: { runLlm: false }, // Use deterministic generator
})

assert(
  atlTL.thoughtLeadershipAudit.tier === 'Practitioner' ||
  atlTL.thoughtLeadershipAudit.tier === 'Industry Voice',
  `ATL tier must be Practitioner or Industry Voice, got ${atlTL.thoughtLeadershipAudit.tier}`
)
assert.strictEqual(
  atlTL.actionablePostTemplates.length,
  3,
  'Active tech lead must have exactly 3 actionable post templates'
)

for (const tmpl of atlTL.actionablePostTemplates) {
  assert(tmpl.hook && tmpl.hook.length > 10, 'Template hook must be populated')
  assert(tmpl.bodyOutline && tmpl.bodyOutline.length > 10, 'Template bodyOutline must be populated')
  assert(
    Array.isArray(tmpl.targetHashtags) && tmpl.targetHashtags.length > 0,
    'Template targetHashtags must be populated'
  )
}

assert.strictEqual(atlTL.thirtyDayCalendar.length, 4, 'Thirty-day calendar must have exactly 4 weekly items')
for (const week of atlTL.thirtyDayCalendar) {
  assert(week.week && week.theme && week.goal, 'Calendar week must have week, theme, and goal')
}

// Restore LLM Gateway
llmGateway.generate = originalGenerate

console.log('  ✅ Gate 3 Passed: Ghost profile fast-path verified (0 LLM calls) and 30-day blueprint complete.')

// ─────────────────────────────────────────────────────────────────────────────
// GATE 4: Apify Error Resilience & SmartKeyPool Rotation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- GATE 4: Apify Error Resilience & SmartKeyPool Rotation ---')

const origApifyKeys = apifyKeyPool.getAllKeys()

try {
  // Configure pool with a failed key followed by a backup key
  apifyKeyPool.keys = ['token_fail_429', 'token_backup_healthy']

  assert.strictEqual(
    apifyKeyPool.getActiveKey(),
    'token_fail_429',
    'Active key must initially be the primary token'
  )

  let rotationObserved = false

  // Test executeWithRetry rotation when 429 occurs
  const retryResult = await apifyKeyPool.executeWithRetry(async (activeToken) => {
    if (activeToken === 'token_fail_429') {
      throw new Error('429 Rate limit exceeded on Apify actor harvester')
    }
    if (activeToken === 'token_backup_healthy') {
      rotationObserved = true
      return { success: true, tokenUsed: activeToken }
    }
    throw new Error('Unexpected token in retry test')
  })

  assert(rotationObserved, 'SmartKeyPool must rotate to backup token on 429')
  assert.strictEqual(retryResult.success, true, 'Retry with backup token must succeed')
  assert.strictEqual(
    apifyKeyPool.getActiveKey(),
    'token_backup_healthy',
    'Sticky success must promote backup token to activeKey'
  )

  // Test scrapeLinkedInPosts No-Crash Guarantee on error
  const fallbackResult = await scrapeLinkedInPosts('https://www.linkedin.com/in/rate-limit-test-user')
  assert.strictEqual(fallbackResult.available, false, 'Fallback available must be false')
  assert.strictEqual(fallbackResult.isGhostProfile, true, 'Fallback isGhostProfile must be true')
  assert.strictEqual(Array.isArray(fallbackResult.posts), true, 'Fallback posts must be an empty array')
  assert.strictEqual(Array.isArray(fallbackResult.comments), true, 'Fallback comments must be an empty array')
} finally {
  // Always restore original keys
  apifyKeyPool.keys = origApifyKeys
}

console.log('  ✅ Gate 4 Passed: 429 rotation to backup token confirmed and fallback returned without throwing.')

console.log('\n================================================================')
console.log('🎉 ALL 4 LINKEDIN ACTIVITY GOLDEN QUALITY GATES PASSED!')
console.log('================================================================')
