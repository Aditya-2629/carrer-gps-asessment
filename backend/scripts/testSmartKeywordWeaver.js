import assert from 'node:assert'
import { weaveKeywordsAndBuildLedger } from '../agents/resume/market/smartKeywordWeaver.js'
import { deriveOpenToWorkTitles } from '../agents/linkedin/linkedinSynthesis.js'
import { buildAtsTailoredDocx } from '../services/docxResumeService.js'

console.log('================================================================')
console.log('RUNNING SMART KEYWORD WEAVER & MASTER REPORT BUG TEST SUITE')
console.log('================================================================\n')

// -----------------------------------------------------------------------------
// TEST 1: Smart Keyword Weaver & Interview Talking Script Generation
// -----------------------------------------------------------------------------
console.log('[Test 1] Smart Keyword Weaver & Interview Talking Script:')

const mockResume = {
  experiences: [
    {
      company: 'Amazon',
      role: 'Full Stack Software Engineer',
      bullets: [
        'Built real-time customer analytics portal using React, improving dashboard load times by 45%.',
        'Engineered high-throughput event processing pipeline with asynchronous workers.',
      ],
    },
    {
      company: 'Microsoft',
      role: 'Software Engineer',
      bullets: [
        'Developed microservices endpoints serving 10M daily requests.',
      ],
    },
  ],
}

const missingKws = ['TypeScript', 'Kafka', 'Unit Testing', 'Git']

const result = weaveKeywordsAndBuildLedger({
  canonicalResume: mockResume,
  missingKeywords: missingKws,
})

assert(result.tailoredExperiences && result.tailoredExperiences.length === 2, 'Must return tailored experiences')
assert(Array.isArray(result.interviewLedger), 'Must return interview ledger')
assert(result.interviewLedger.length >= 3, 'Must have entries for TypeScript, Kafka, and Practice bullet')

const tsEntry = result.interviewLedger.find((l) => l.keyword === 'TypeScript')
assert(tsEntry, 'Must have TypeScript ledger entry')
assert(tsEntry.exactBullet.includes('TypeScript'), 'Bullet must contain TypeScript')
assert(tsEntry.exactBullet.includes('45%'), 'Must preserve 45% metric')
assert(tsEntry.interviewTalkingScript.includes('enforce static typing'), 'Must include TypeScript interview script')

const kafkaEntry = result.interviewLedger.find((l) => l.keyword === 'Kafka')
assert(kafkaEntry, 'Must have Kafka ledger entry')
assert(kafkaEntry.exactBullet.includes('Kafka'), 'Bullet must contain Kafka')
assert(kafkaEntry.interviewTalkingScript.includes('decoupled event streaming'), 'Must include Kafka interview script')

const practiceEntry = result.interviewLedger.find((l) => l.keyword.includes('Unit / Integration Testing'))
assert(practiceEntry, 'Must synthesize engineering practice bullet on experience 0')
assert(practiceEntry.exactBullet.includes('Jest and PyTest'), 'Must reference Jest and PyTest')
assert(practiceEntry.exactBullet.includes('Git/GitHub'), 'Must reference Git/GitHub')
assert(practiceEntry.interviewTalkingScript.includes('automated PR test gating'), 'Must include PR test gating script')

console.log('  ✓ 1.1 Missing keywords woven into natural clauses')
console.log('  ✓ 1.2 Engineering practice bullet synthesized with Jest, PyTest, and Git')
console.log('  ✓ 1.3 Interview Defense Sheet generated with concrete recruiter talking scripts')

// -----------------------------------------------------------------------------
// TEST 2: LinkedIn deriveOpenToWorkTitles Bug Fix
// -----------------------------------------------------------------------------
console.log('\n[Test 2] LinkedIn deriveOpenToWorkTitles Title Concatenation Guard:')

const titles = deriveOpenToWorkTitles('Senior Full Stack Software Developer')
assert.strictEqual(titles[0], 'Senior Full Stack Software Developer')
assert.strictEqual(titles[1], 'Senior Full Stack Software Developer')
assert.strictEqual(titles[2], 'Lead Full Stack Software Developer')
assert.strictEqual(titles[3], 'Staff Full Stack Software Developer')
assert.strictEqual(titles[4], 'Principal Full Stack Software Developer')

titles.forEach((t) => {
  assert(!t.includes('Senior Senior'), 'Must NEVER contain Senior Senior')
  assert(!t.includes('Lead Senior'), 'Must NEVER contain Lead Senior')
})

console.log('  ✓ 2.1 deriveOpenToWorkTitles completely eliminates duplicate prefixes')

// -----------------------------------------------------------------------------
// TEST 3: DOCX Generation with Smart Woven Experiences
// -----------------------------------------------------------------------------
console.log('\n[Test 3] DOCX Generation with Tailored Experiences:')

const docxInput = {
  candidate_name: 'Alekya Maddu',
  target_role: 'Senior Full Stack Software Developer',
  experiences: result.tailoredExperiences,
  education: [
    {
      school: 'Stevens Institute of Technology',
      degree: 'M.S. in Computer Science',
      location: 'Hoboken, NJ',
      dates: 'September 2022 – May 2024',
    },
  ],
  skills: ['TypeScript', 'Kafka', 'React', 'Node.js', 'Python', 'AWS'],
}

const docxRes = await buildAtsTailoredDocx(docxInput, [], ['TypeScript', 'Kafka'])
assert(docxRes.buffer && docxRes.buffer.length > 5000, 'Must produce valid buffer')
assert.strictEqual(docxRes.pages, 1, 'Must fit on 1 page')
console.log(`  ✓ 3.1 1:1 Alekya Gold Standard DOCX built with tailored experiences (length: ${docxRes.buffer.length} bytes)`)

console.log('\n================================================================')
console.log('ALL SMART KEYWORD WEAVER & MASTER REPORT BUG TESTS PASSED!')
console.log('================================================================')
