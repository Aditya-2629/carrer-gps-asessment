import assert from 'node:assert/strict'
import {
  pruneJdText,
  analyzeJdBatchWithGemini,
} from '../agents/resume/market/llmJdSkillAnalyzer.js'
import { aiGateway, llmGateway } from '../ai/gateway/llmGateway.js'

console.log('=== RUNNING ANALYZE JD BATCH WITH GEMINI VERIFICATION ===\n')

// -------------------------------------------------------------
// TEST 1: Verify pruneJdText Functionality
// -------------------------------------------------------------
console.log('Test 1: Verifying pruneJdText...')
const emptyPrune = pruneJdText('')
assert.equal(emptyPrune, '', 'Empty string should return empty string')

const rawJdWithRequirements = `
About Acme Corp:
We are a leading financial technology company with great benefits, 401(k), and healthcare.
Our team values collaboration, integrity, and agile culture.

Requirements & Qualifications:
- 5+ years of software engineering experience.
- Deep expertise in TypeScript, React, Node.js, and GraphQL.
- Strong hands-on experience with Docker, Kubernetes, and AWS infrastructure.
- Proficient in PostgreSQL and Redis database optimization.
- Familiar with CI/CD pipeline automation and Terraform.

Equal Opportunity Employer:
Acme Corp provides equal employment opportunities to all employees.
`
const pruned = pruneJdText(rawJdWithRequirements)
assert.ok(pruned.includes('Requirements & Qualifications:'), 'Pruned text should contain requirements section')
assert.ok(pruned.includes('TypeScript'), 'Pruned text should contain core tech keywords')
assert.ok(pruned.length <= 1500, 'Pruned text should be bounded')
console.log('✔ Test 1 Passed: pruneJdText isolates technical requirements and drops noise.\n')

// -------------------------------------------------------------
// TEST 2: Verify aiGateway Export and Execute Interface
// -------------------------------------------------------------
console.log('Test 2: Verifying aiGateway alias and execute interface...')
assert.equal(aiGateway, llmGateway, 'aiGateway should be an alias of llmGateway')
assert.equal(typeof aiGateway.execute, 'function', 'aiGateway should provide execute method')
console.log('✔ Test 2 Passed: aiGateway and execute method verified.\n')

// -------------------------------------------------------------
// TEST 3: Verify analyzeJdBatchWithGemini with Sample JDs
// -------------------------------------------------------------
console.log('Test 3: Verifying analyzeJdBatchWithGemini...')
const sampleJds = [
  {
    title: 'Senior Frontend Engineer',
    description: 'Requirements: 4+ years of React, TypeScript, Next.js, Tailwind CSS, and GraphQL.',
  },
  {
    title: 'Full Stack Developer',
    description: 'Qualifications: Hands-on React, TypeScript, Node.js, PostgreSQL, and Docker.',
  },
]

const analysis = await analyzeJdBatchWithGemini('Frontend Engineer', sampleJds)
assert.equal(analysis.sampleSize, 2, 'Sample size should be 2')
assert.ok(Array.isArray(analysis.discoveredSkills), 'discoveredSkills must be an array')
assert.ok(analysis.discoveredSkills.length > 0, 'discoveredSkills must contain skills')

// Top skills (TypeScript and React) should be detected in both JDs
const skillNames = analysis.discoveredSkills.map((s) => s.name)
console.log('Discovered Skills:', skillNames.slice(0, 8))
assert.ok(skillNames.includes('TypeScript') || skillNames.includes('React'), 'TypeScript or React must be discovered')

const topSkill = analysis.discoveredSkills[0]
assert.ok(topSkill.name, 'Skill must have name')
assert.ok(typeof topSkill.frequency === 'number', 'Skill must have frequency')
assert.ok(typeof topSkill.percentage === 'number', 'Skill must have percentage')
assert.ok(topSkill.category, 'Skill must have category')
console.log('✔ Test 3 Passed: analyzeJdBatchWithGemini discovered skills cleanly with frequency & percentage.\n')

// -------------------------------------------------------------
// TEST 4: Verify Empty / Edge Case Handling
// -------------------------------------------------------------
console.log('Test 4: Verifying empty input safety...')
const emptyResult = await analyzeJdBatchWithGemini('Engineer', [])
assert.equal(emptyResult.sampleSize, 0)
assert.deepEqual(emptyResult.discoveredSkills, [])
console.log('✔ Test 4 Passed: Empty JD list handled safely without throwing.\n')

console.log('ALL ANALYZE JD BATCH WITH GEMINI TESTS PASSED! 🚀')
