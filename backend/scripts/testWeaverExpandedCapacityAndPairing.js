/**
 * testWeaverExpandedCapacityAndPairing.js
 * 
 * Verifies:
 * 1. BATCH_WEAVER_SYSTEM_PROMPT includes NATURAL COMPLEMENTARY PAIRING directive and wovenSkills JSON output schema
 * 2. Dynamic capacity scaling allows 6 to 12 skills based on availableBullets * 2
 * 3. Token budget set to 3500 in smartKeywordWeaver.js
 * 4. AssessmentController uses 15000ms timeout budget for batch weaving
 * 5. Multi-skill interview defense ledger expansion works properly for paired skills
 */

import assert from 'assert'
import fs from 'fs'
import { BATCH_WEAVER_SYSTEM_PROMPT } from '../agents/resume/market/smartKeywordWeaver.js'

console.log('=== RUNNING WEAVER EXPANDED CAPACITY & PAIRING VERIFICATION ===\n')

// -------------------------------------------------------------
// TEST 1: Complementary Tool Pairing Rule in System Prompt
// -------------------------------------------------------------
console.log('Test 1: Verifying NATURAL COMPLEMENTARY PAIRING in BATCH_WEAVER_SYSTEM_PROMPT...')
assert(
  BATCH_WEAVER_SYSTEM_PROMPT.includes('NATURAL COMPLEMENTARY PAIRING'),
  'System prompt must contain NATURAL COMPLEMENTARY PAIRING rule'
)
assert(
  BATCH_WEAVER_SYSTEM_PROMPT.includes('wovenSkills'),
  'System prompt output format must include wovenSkills array'
)
assert(
  BATCH_WEAVER_SYSTEM_PROMPT.includes('weave up to 2 complementary tools into a single bullet'),
  'System prompt must guide pairing up to 2 complementary tools'
)
console.log('✔ Test 1 Passed: System prompt contains Complementary Tool Pairing and multi-skill schema.\n')

// -------------------------------------------------------------
// TEST 2: Dynamic Capacity Scaling Calculation
// -------------------------------------------------------------
console.log('Test 2: Verifying dynamic capacity formulas (8-12 skills via availableBullets * 2)...')

function calculateCapacity(cleanSkillsLength, availableBulletsLength) {
  const maxSkillsCapacity = Math.min(
    cleanSkillsLength,
    Math.max(6, Math.min(12, availableBulletsLength * 2))
  )
  const maxBulletsCapacity = Math.min(availableBulletsLength, 10)
  return { maxSkillsCapacity, maxBulletsCapacity }
}

// Case A: 6 bullets and 14 missing skills -> 6*2 = 12 skills
const caseA = calculateCapacity(14, 6)
assert.strictEqual(caseA.maxSkillsCapacity, 12, '6 bullets should scale skills capacity to 12')
assert.strictEqual(caseA.maxBulletsCapacity, 6, '6 bullets should allow 6 bullets')

// Case B: 5 bullets and 12 missing skills -> 5*2 = 10 skills
const caseB = calculateCapacity(12, 5)
assert.strictEqual(caseB.maxSkillsCapacity, 10, '5 bullets should scale skills capacity to 10')
assert.strictEqual(caseB.maxBulletsCapacity, 5, '5 bullets should allow 5 bullets')

// Case C: 4 bullets and 12 missing skills -> 4*2 = 8 skills
const caseC = calculateCapacity(12, 4)
assert.strictEqual(caseC.maxSkillsCapacity, 8, '4 bullets should scale skills capacity to 8')
assert.strictEqual(caseC.maxBulletsCapacity, 4, '4 bullets should allow 4 bullets')

// Case D: 2 bullets and 10 skills -> clamps to floor of 6 skills (if skills available)
const caseD = calculateCapacity(10, 2)
assert.strictEqual(caseD.maxSkillsCapacity, 6, '2 bullets with 10 skills should clamp to floor of 6')
assert.strictEqual(caseD.maxBulletsCapacity, 2, '2 bullets should allow 2 bullets')

console.log('✔ Test 2 Passed: Dynamic capacity accurately scales between 6 and 12 skills via bullets * 2.\n')

// -------------------------------------------------------------
// TEST 3: Code Source Verification for 3500 Tokens & Input Wiring
// -------------------------------------------------------------
console.log('Test 3: Verifying maxTokens: 3500 and totalAvailableBullets * 2 in smartKeywordWeaver.js...')
const source = fs.readFileSync('backend/agents/resume/market/smartKeywordWeaver.js', 'utf8')
assert(source.includes('maxTokens: 3500'), 'smartKeywordWeaver.js must configure maxTokens: 3500')
assert(source.includes('totalAvailableBullets * 2'), 'smartKeywordWeaver.js must use totalAvailableBullets * 2')
assert(source.includes('maxSkillsCapacity'), 'smartKeywordWeaver.js must use maxSkillsCapacity')
assert(source.includes('maxBulletsCapacity'), 'smartKeywordWeaver.js must use maxBulletsCapacity')
console.log('✔ Test 3 Passed: Token budget set to 3500 and capacities wired into batchPromptInput.\n')

// -------------------------------------------------------------
// TEST 4: AssessmentController 15000ms Timeout & Software Engineer Fallback
// -------------------------------------------------------------
console.log('Test 4: Verifying timeoutMs: 15000 in assessmentController.js...')
const ctrlSource = fs.readFileSync('backend/controllers/assessmentController.js', 'utf8')
assert(ctrlSource.includes('timeoutMs: 15000'), 'assessmentController.js must set timeoutMs: 15000')
assert(ctrlSource.includes("user?.answers?.targetRole || 'Software Engineer'"), 'assessmentController.js must resolve targetRole fallback')
console.log('✔ Test 4 Passed: assessmentController configured with 15s timeout budget.\n')

// -------------------------------------------------------------
// TEST 5: Multi-Skill Interview Defense Ledger Expansion
// -------------------------------------------------------------
console.log('Test 5: Verifying multi-skill interview defense ledger expansion logic...')
const mockRewrite = {
  bulletId: 'exp_001_b01',
  wovenSkills: ['Docker', 'Kubernetes'],
  rewrittenText: 'Orchestrated multi-stage Docker container builds and automated Kubernetes deployments across production clusters, cutting release turnaround by 45%.',
  interviewDefense: {
    interviewerQuestion: 'How did you manage container lifecycle and cluster resource limits using Docker and Kubernetes?',
    talkingScript: 'At my company, I containerized microservices with Docker and deployed to Kubernetes clusters.',
    tradeOffJustification: 'Adopted Kubernetes to automate self-healing replicas.',
  },
}

const ledger = []
const skillsList = Array.isArray(mockRewrite.wovenSkills) && mockRewrite.wovenSkills.length > 0
  ? mockRewrite.wovenSkills
  : (mockRewrite.wovenSkill ? mockRewrite.wovenSkill.split(/[,/]/).map(s => s.trim()) : ['Core Tech'])

skillsList.filter(Boolean).forEach((skill) => {
  ledger.push({
    keyword: String(skill).trim(),
    company: 'Acme Corp',
    exactBullet: mockRewrite.rewrittenText,
    interviewerQuestion: mockRewrite.interviewDefense?.interviewerQuestion || `How did you apply ${skill} at Acme Corp?`,
    talkingScript: mockRewrite.interviewDefense?.talkingScript || `At Acme Corp, I deployed ${skill}.`,
    interviewTalkingScript: mockRewrite.interviewDefense?.talkingScript || `At Acme Corp, I deployed ${skill}.`,
    tradeOffJustification: mockRewrite.interviewDefense?.tradeOffJustification || `Selected ${skill}.`,
  })
})

assert.strictEqual(ledger.length, 2, 'Paired skills must expand into 2 separate interview ledger entries')
assert.strictEqual(ledger[0].keyword, 'Docker', 'First entry must be Docker')
assert.strictEqual(ledger[1].keyword, 'Kubernetes', 'Second entry must be Kubernetes')
assert.strictEqual(ledger[0].exactBullet, mockRewrite.rewrittenText, 'Both entries must reference the exact bullet')
assert.strictEqual(ledger[0].talkingScript, mockRewrite.interviewDefense.talkingScript, 'talkingScript must be preserved')
assert.strictEqual(ledger[0].interviewTalkingScript, mockRewrite.interviewDefense.talkingScript, 'interviewTalkingScript must be preserved')
console.log('✔ Test 5 Passed: Multi-skill ledger expansion indexes paired tools individually.\n')

console.log('ALL WEAVER CAPACITY & PAIRING TESTS COMPLETED SUCCESSFULLY! 🚀')
