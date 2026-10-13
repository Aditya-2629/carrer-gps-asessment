import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { computePrecomputedSignals } from '../agents/resume/signals/precomputedSignals.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('=== VERIFYING CONTACT MERGE FIX ===\n')

// Test 1: User's exact John Smith example
const johnResume = `John Smith
New York, NY | 555-555-5555 | john@email.com | linkedin.com/in/johnsmith

Professional Summary
Data analyst with 4+ years of experience in data visualization and SQL.`

const normJohn = ResumeNormalizer.normalize({ rawText: johnResume })
const sigJohn = computePrecomputedSignals(normJohn)

console.log('--- TEST 1: John Smith (Header + Professional Summary) ---')
console.log('Header lines:', normJohn.header)
console.log('Summary text:', JSON.stringify(normJohn.summary.text))
console.log('isContactMerged:', sigJohn.contactMerge.isContactMerged)
if (sigJohn.contactMerge.isContactMerged === false && normJohn.summary.text.startsWith('Data analyst')) {
  console.log('✅ TEST 1 PASSED: Header separated cleanly, isContactMerged is FALSE\n')
} else {
  console.error('❌ TEST 1 FAILED\n')
}

// Test 2: True positive contact merge inside summary
const trueMerged = `John Smith

Professional Summary
Data analyst with 4+ years of experience. Contact me at john@email.com or 555-555-5555 for roles.`

const normTrue = ResumeNormalizer.normalize({ rawText: trueMerged })
const sigTrue = computePrecomputedSignals(normTrue)

console.log('--- TEST 2: True Contact Merge Inside Summary ---')
console.log('Summary text:', JSON.stringify(normTrue.summary.text))
console.log('isContactMerged:', sigTrue.contactMerge.isContactMerged)
if (sigTrue.contactMerge.isContactMerged === true) {
  console.log('✅ TEST 2 PASSED: Real contact merge detected accurately\n')
} else {
  console.error('❌ TEST 2 FAILED\n')
}

// Test 3: Swapnil Jadhav Fixture
const swapnilRaw = fs.readFileSync(path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt'), 'utf8')
const normSwapnil = ResumeNormalizer.normalize({ rawText: swapnilRaw })
const sigSwapnil = computePrecomputedSignals(normSwapnil)

console.log('--- TEST 3: Swapnil Jadhav Fixture ---')
console.log('Header lines:', normSwapnil.header)
console.log('Summary text preview:', normSwapnil.summary.text.slice(0, 60) + '...')
console.log('isContactMerged:', sigSwapnil.contactMerge.isContactMerged)
if (sigSwapnil.contactMerge.isContactMerged === false) {
  console.log('✅ TEST 3 PASSED: Swapnil header separated, isContactMerged is FALSE\n')
} else {
  console.error('❌ TEST 3 FAILED\n')
}

// Test 4: Unheaded resume (No "Professional Summary" heading, but has narrative summary before EXPERIENCE)
const unheadedResume = `Jane Doe
jane@example.com | (555) 123-4567 | San Francisco, CA

Senior Full Stack Engineer with 6+ years of experience architecting distributed cloud systems. Specialized in Node.js, Go, and high-concurrency event-driven architectures.

WORK EXPERIENCE
Senior Engineer | Acme Corp
2021 - Present
• Built platform serving 10M users.`

const normUnheaded = ResumeNormalizer.normalize({ rawText: unheadedResume })
const sigUnheaded = computePrecomputedSignals(normUnheaded)

console.log('--- TEST 4: Unheaded Summary Resume ---')
console.log('Header lines:', normUnheaded.header)
console.log('Summary text:', JSON.stringify(normUnheaded.summary.text))
console.log('isContactMerged:', sigUnheaded.contactMerge.isContactMerged)
if (sigUnheaded.contactMerge.isContactMerged === false && normUnheaded.summary.text.includes('Senior Full Stack Engineer with 6+ years')) {
  console.log('✅ TEST 4 PASSED: Unheaded narrative summary separated from contact header\n')
} else {
  console.error('❌ TEST 4 FAILED\n')
}
