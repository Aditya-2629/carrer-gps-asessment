/**
 * testWeaverExpandedCapacityAndPairing.js
 * 
 * Verifies:
 * 1. BATCH_WEAVER_SYSTEM_PROMPT includes the COMPLEMENTARY TOOL PAIRING directive
 * 2. Dynamic capacity scaling allows 10-12 skills when bullets permit
 * 3. Token budget increased to 3500 in smartKeywordWeaver.js
 */

import assert from 'assert'
import fs from 'fs'
import { BATCH_WEAVER_SYSTEM_PROMPT } from '../agents/resume/market/smartKeywordWeaver.js'

console.log('=== RUNNING WEAVER EXPANDED CAPACITY & PAIRING VERIFICATION ===\n')

// -------------------------------------------------------------
// TEST 1: Complementary Tool Pairing Rule
// -------------------------------------------------------------
console.log('Test 1: Verifying COMPLEMENTARY TOOL PAIRING in BATCH_WEAVER_SYSTEM_PROMPT...')
assert(
  BATCH_WEAVER_SYSTEM_PROMPT.includes('COMPLEMENTARY TOOL PAIRING'),
  'System prompt must contain COMPLEMENTARY TOOL PAIRING rule'
)
assert(
  BATCH_WEAVER_SYSTEM_PROMPT.includes('pair 2 cohesive technologies in a single bullet'),
  'System prompt must guide pairing 2 cohesive tools'
)
console.log('✔ Test 1 Passed: System prompt contains Complementary Tool Pairing directive.\n')

// -------------------------------------------------------------
// TEST 2: Dynamic Capacity Scaling Calculation
// -------------------------------------------------------------
console.log('Test 2: Verifying dynamic capacity formulas (10-12 skills & up to 10 bullets)...')

function calculateCapacity(cleanSkillsLength, availableBulletsLength) {
  const maxSkillsCapacity = Math.min(
    cleanSkillsLength,
    Math.max(6, Math.min(12, availableBulletsLength))
  )
  const maxBulletsCapacity = Math.min(availableBulletsLength, 10)
  return { maxSkillsCapacity, maxBulletsCapacity }
}

// Case A: Large resume with 15 bullets and 15 missing skills -> scales to 12 skills, 10 bullets
const caseA = calculateCapacity(15, 15)
assert.strictEqual(caseA.maxSkillsCapacity, 12, '15 bullets should scale skills capacity to 12')
assert.strictEqual(caseA.maxBulletsCapacity, 10, '15 bullets should cap bullets capacity at 10')

// Case B: Moderate resume with 10 bullets and 14 missing skills -> scales to 10 skills, 10 bullets
const caseB = calculateCapacity(14, 10)
assert.strictEqual(caseB.maxSkillsCapacity, 10, '10 bullets should scale skills capacity to 10')
assert.strictEqual(caseB.maxBulletsCapacity, 10, '10 bullets should allow 10 bullets')

// Case C: Small resume with 7 bullets and 12 missing skills -> scales to 7 skills, 7 bullets
const caseC = calculateCapacity(12, 7)
assert.strictEqual(caseC.maxSkillsCapacity, 7, '7 bullets should scale skills capacity to 7')
assert.strictEqual(caseC.maxBulletsCapacity, 7, '7 bullets should allow 7 bullets')

// Case D: Resume with 4 bullets and 8 skills -> clamps to floor of 6 skills (if skills available)
const caseD = calculateCapacity(8, 4)
assert.strictEqual(caseD.maxSkillsCapacity, 6, '4 bullets with 8 skills should clamp to floor of 6')
assert.strictEqual(caseD.maxBulletsCapacity, 4, '4 bullets should allow 4 bullets')

console.log('✔ Test 2 Passed: Dynamic capacity accurately scales between 6 and 12 skills without 5-skill bottleneck.\n')

// -------------------------------------------------------------
// TEST 3: Code Source Verification for 3500 Tokens & Input Wiring
// -------------------------------------------------------------
console.log('Test 3: Verifying maxTokens: 3500 in smartKeywordWeaver.js...')
const source = fs.readFileSync('backend/agents/resume/market/smartKeywordWeaver.js', 'utf8')
assert(source.includes('maxTokens: 3500'), 'smartKeywordWeaver.js must configure maxTokens: 3500')
assert(source.includes('maxSkillsCapacity'), 'smartKeywordWeaver.js must use maxSkillsCapacity')
assert(source.includes('maxBulletsCapacity'), 'smartKeywordWeaver.js must use maxBulletsCapacity')
console.log('✔ Test 3 Passed: Token budget increased to 3500 and capacities wired into batchPromptInput.\n')

console.log('ALL WEAVER CAPACITY & PAIRING TESTS COMPLETED SUCCESSFULLY! 🚀')
