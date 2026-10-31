import assert from 'node:assert'
import {
  weaveKeywordsIntoBullets,
  determineSemanticSlot,
  cleanTargetRoleTitle,
  buildInterviewTalkingPointsLedger,
  getTalkingPointsForKeyword,
  SEMANTIC_SLOTS,
} from '../agents/resume/market/keywordAlignment.js'
import {
  RESUME_SYNTHESIS_PROMPT_V4,
  renderResumeSynthesisPromptV4,
  SYNTHESIS_PROMPT_VERSION_V4,
} from '../agents/resume/synthesis/resumeSynthesis.prompt.js'
import {
  buildSynthesisMessages,
} from '../agents/resume/synthesis/resumeSynthesis.js'
import { buildAtsTailoredDocx } from '../services/docxResumeService.js'
import { decodeHtmlEntities, cleanPlaceholderGraceful } from '../services/resumeValidator.js'

console.log('================================================================')
console.log('RUNNING SENIOR RECRUITER ROAST & KEYWORD WEAVER TEST SUITE')
console.log('================================================================\n')

// -----------------------------------------------------------------------------
// TEST 1: Semantic Slot Mapping
// -----------------------------------------------------------------------------
console.log('[Test 1] Semantic Slot Mapping:')
assert.strictEqual(determineSemanticSlot('GraphQL'), 'api_slot')
assert.strictEqual(determineSemanticSlot('REST APIs'), 'api_slot')
assert.strictEqual(determineSemanticSlot('Swagger'), 'api_slot')
assert.strictEqual(determineSemanticSlot('WebSockets'), 'api_slot')

assert.strictEqual(determineSemanticSlot('AWS'), 'cloud_slot')
assert.strictEqual(determineSemanticSlot('Docker'), 'cloud_slot')
assert.strictEqual(determineSemanticSlot('Kubernetes'), 'cloud_slot')
assert.strictEqual(determineSemanticSlot('ECS'), 'cloud_slot')

assert.strictEqual(determineSemanticSlot('Kafka'), 'messaging_slot')
assert.strictEqual(determineSemanticSlot('RabbitMQ'), 'messaging_slot')
assert.strictEqual(determineSemanticSlot('SQS'), 'messaging_slot')
assert.strictEqual(determineSemanticSlot('Redis'), 'messaging_slot')

assert.strictEqual(determineSemanticSlot('React 19'), 'frontend_slot')
assert.strictEqual(determineSemanticSlot('Next.js'), 'frontend_slot')
assert.strictEqual(determineSemanticSlot('Redux'), 'frontend_slot')
assert.strictEqual(determineSemanticSlot('Tailwind'), 'frontend_slot')
console.log('  ✓ 1.1 All keywords mapped to exact semantic slots (api_slot, cloud_slot, messaging_slot, frontend_slot)')

// -----------------------------------------------------------------------------
// TEST 2: Keyword Weaver Algorithm & Natural Insertion
// -----------------------------------------------------------------------------
console.log('\n[Test 2] Keyword Weaver Algorithm & Natural Insertion:')

const testExperiences = [
  {
    id: 'exp_001',
    company: 'Stripe',
    role: 'Senior Backend Engineer',
    bullets: [
      { id: 'exp_001_b01', text: 'Engineered backend REST APIs for transaction processing, reducing latency by 40%.' },
      { id: 'exp_001_b02', text: 'Architected distributed messaging queue handling 50k transactions/sec.' },
      { id: 'exp_001_b03', text: 'Deployed microservices across clusters using Terraform with 99.99% uptime.' },
      { id: 'exp_001_b04', text: 'Developed frontend dashboard views for real-time risk analytics.' },
    ],
  },
]

const missingKeywords = ['Kafka', 'TypeScript'] // Priority 1
const strandedSkills = ['GraphQL', 'Docker']    // Priority 2

const wovenResults = weaveKeywordsIntoBullets(testExperiences, missingKeywords, strandedSkills)

assert(Array.isArray(wovenResults), 'Must return an array of woven bullet rewrites')
assert.strictEqual(wovenResults.length, 4, 'Must weave all 4 candidate keywords across matching bullets')

// Check Priority 1 vs Priority 2 order and slot adherence
const b01Rewrite = wovenResults.find((r) => r.bulletId === 'exp_001_b01')
assert(b01Rewrite, 'exp_001_b01 must be woven')
assert.strictEqual(b01Rewrite.slot, 'api_slot')
assert.strictEqual(b01Rewrite.wovenKeyword, 'GraphQL')
assert(b01Rewrite.readyToUseRewrite.includes('GraphQL'), 'Rewrite must contain GraphQL')
assert(b01Rewrite.readyToUseRewrite.includes('40%'), 'Must preserve 40% metric verbatim')

const b02Rewrite = wovenResults.find((r) => r.bulletId === 'exp_001_b02')
assert(b02Rewrite, 'exp_001_b02 must be woven')
assert.strictEqual(b02Rewrite.slot, 'messaging_slot')
assert.strictEqual(b02Rewrite.wovenKeyword, 'Kafka')
assert(b02Rewrite.readyToUseRewrite.includes('Kafka'), 'Rewrite must contain Kafka')
assert(b02Rewrite.readyToUseRewrite.includes('50k transactions/sec'), 'Must preserve 50k metric verbatim')

const b03Rewrite = wovenResults.find((r) => r.bulletId === 'exp_001_b03')
assert(b03Rewrite, 'exp_001_b03 must be woven')
assert.strictEqual(b03Rewrite.slot, 'cloud_slot')
assert.strictEqual(b03Rewrite.wovenKeyword, 'Docker')
assert(b03Rewrite.readyToUseRewrite.includes('Docker'), 'Rewrite must contain Docker')
assert(b03Rewrite.readyToUseRewrite.includes('99.99% uptime'), 'Must preserve 99.99% uptime verbatim')

const b04Rewrite = wovenResults.find((r) => r.bulletId === 'exp_001_b04')
assert(b04Rewrite, 'exp_001_b04 must be woven')
assert.strictEqual(b04Rewrite.slot, 'frontend_slot')
assert.strictEqual(b04Rewrite.wovenKeyword, 'TypeScript')
assert(b04Rewrite.readyToUseRewrite.includes('TypeScript'), 'Rewrite must contain TypeScript')

// Rule verification: Never inject more than 1 new keyword per bullet
wovenResults.forEach((rw) => {
  assert.strictEqual(rw.wovenKeywords.length, 1, `Bullet ${rw.bulletId} must contain exactly 1 woven keyword`)
})

// Rule verification: Check cloned experiences attached property
assert(Array.isArray(wovenResults.wovenExperiences), 'wovenResults must attach wovenExperiences')
assert.strictEqual(wovenResults.wovenExperiences[0].bullets[0].text, b01Rewrite.readyToUseRewrite)

console.log('  ✓ 2.1 Priority 1 (Missing JD) and Priority 2 (Stranded Skills) successfully collected & routed')
console.log('  ✓ 2.2 Exactly 1 new keyword injected per bullet into tooling/method clauses')
console.log('  ✓ 2.3 Numbers, percentages, and metrics preserved 100% verbatim (40%, 50k transactions/sec, 99.99%)')

// -----------------------------------------------------------------------------
// TEST 3: Dynamic "WOW" Recruiter Prompt & Rendering
// -----------------------------------------------------------------------------
console.log('\n[Test 3] Dynamic "WOW" Recruiter Prompt (V4):')

assert(RESUME_SYNTHESIS_PROMPT_V4.includes('You are Alex, a Managing Director at an elite technical search firm in San Francisco'), 'Must define Alex Executive Recruiter persona')
assert(RESUME_SYNTHESIS_PROMPT_V4.includes('RULES:'), 'Must include 6-second verdict and zero generic templates rules')
assert(RESUME_SYNTHESIS_PROMPT_V4.includes('OUTPUT JSON FORMAT ONLY:'), 'Must enforce JSON output schema')

const renderedV4 = renderResumeSynthesisPromptV4({
  targetRole: 'Senior Full Stack Engineer',
  candidateName: 'Aditya Sharma',
  currentTitle: 'Lead Software Developer',
  currentCompany: 'Bank of America',
  yearsOfExperience: '6 years',
  missingKeywords: ['Kafka', 'TypeScript'],
  skillsOnlyKeywords: ['GraphQL', 'Docker'],
  experienceBullets: '- [exp_001_b01]: Built APIs in Node.js',
})

assert(!renderedV4.includes('{{targetRole}}'), 'All targetRole placeholders must be replaced')
assert(!renderedV4.includes('{{candidateName}}'), 'All candidateName placeholders must be replaced')
assert(!renderedV4.includes('{{currentCompany}}'), 'All currentCompany placeholders must be replaced')
assert(renderedV4.includes('Aditya Sharma'), 'Rendered prompt must contain candidate name')
assert(renderedV4.includes('Bank of America'), 'Rendered prompt must contain current company')
assert(renderedV4.includes('Kafka, TypeScript'), 'Rendered prompt must list missing keywords')
assert(renderedV4.includes('GraphQL, Docker'), 'Rendered prompt must list stranded skills')
console.log('  ✓ 3.1 RESUME_SYNTHESIS_PROMPT_V4 template rendered with 100% replacement of facts')

// -----------------------------------------------------------------------------
// TEST 4: Integration with buildSynthesisMessages
// -----------------------------------------------------------------------------
console.log('\n[Test 4] Synthesis Message Builder Integration:')

const state = {
  canonicalResume: {
    candidate: { name: 'Aditya Sharma' },
    target_role: 'Senior Full Stack Engineer',
    years_of_experience: 6,
    experience: testExperiences,
    skills: ['Node.js', 'Express', 'GraphQL', 'Docker'],
  },
  keywordAlignment: {
    missingFromResume: ['Kafka', 'TypeScript'],
    skillsOnlyUnverified: ['GraphQL', 'Docker'],
  },
}

const messages = buildSynthesisMessages(state)
assert.strictEqual(messages.length, 2, 'Must return [system, user] messages')
assert.strictEqual(messages[0].role, 'system')
assert.strictEqual(messages[1].role, 'user')
assert(messages[1].content.includes('SENIOR SILICON VALLEY EXECUTIVE RECRUITER TEARDOWN INSTRUCTIONS (V4)'))
assert(messages[1].content.includes('DETERMINISTIC KEYWORD WEAVER BENCHMARKS'))
assert(Array.isArray(state.wovenBulletRewrites), 'State must store wovenBulletRewrites')
assert.strictEqual(state.wovenBulletRewrites.length, 4)
console.log('  ✓ 4.1 Synthesis user prompt enriched with V4 Senior Recruiter Teardown and Deterministic Woven Benchmarks')

// -----------------------------------------------------------------------------
// TEST 5: DOCX Generation with Woven Rewrites
// -----------------------------------------------------------------------------
console.log('\n[Test 5] DOCX Generation with Woven Rewrites:')

const docxCanonical = {
  candidate_name: 'Aditya Sharma',
  target_role: 'Senior Full Stack Engineer',
  experiences: [
    {
      company: 'Stripe',
      role: 'Senior Backend Engineer',
      bullets: [
        'Engineered backend REST APIs for transaction processing, reducing latency by 40%.',
      ],
    },
  ],
}

const docxRes = await buildAtsTailoredDocx(docxCanonical, wovenResults, ['Kafka', 'TypeScript'])
assert(docxRes.buffer && docxRes.buffer.length > 5000, 'Must generate valid DOCX buffer')
assert.strictEqual(docxRes.pages, 1, 'Must fit on 1 page')
console.log(`  ✓ 5.1 ATS DOCX tailored buffer built successfully with woven bullet rewrites (length: ${docxRes.buffer.length} bytes)`)

// -----------------------------------------------------------------------------
// TEST 6: Title Concatenation Bug Fix (cleanTargetRoleTitle)
// -----------------------------------------------------------------------------
console.log('\n[Test 6] Title Concatenation Bug Fix (cleanTargetRoleTitle):')

assert.strictEqual(
  cleanTargetRoleTitle('Senior', 'Senior Full Stack Software Developer'),
  'Senior Full Stack Software Developer',
  'Must not duplicate Senior'
)
assert.strictEqual(
  cleanTargetRoleTitle('Lead', 'Senior Full Stack Software Developer'),
  'Lead Full Stack Software Developer',
  'Must replace Senior with Lead cleanly'
)
assert.strictEqual(
  cleanTargetRoleTitle('Staff', 'Senior Full Stack Software Developer'),
  'Staff Full Stack Software Developer',
  'Must replace Senior with Staff cleanly'
)
assert.strictEqual(
  cleanTargetRoleTitle('Principal', 'Senior Full Stack Software Developer'),
  'Principal Full Stack Software Developer',
  'Must replace Senior with Principal cleanly'
)
assert.strictEqual(
  cleanTargetRoleTitle('Senior', 'Full Stack Software Developer'),
  'Senior Full Stack Software Developer',
  'Must prepend Senior to un-prefixed role'
)
assert.strictEqual(
  cleanTargetRoleTitle('', 'Senior Senior Full Stack Software Developer'),
  'Senior Full Stack Software Developer',
  'Must deduplicate repeated prefix in baseRole'
)
console.log('  ✓ 6.1 cleanTargetRoleTitle eliminates title duplication across Senior, Lead, Staff, and Principal prefixes')

// -----------------------------------------------------------------------------
// TEST 7: Context-Anchored Weaving for High-Frequency Keywords (Kafka, TypeScript, Unit Testing, Git)
// -----------------------------------------------------------------------------
console.log('\n[Test 7] Context-Anchored Weaving for High-Frequency JD Keywords:')

const highFreqExperiences = [
  {
    id: 'exp_002',
    company: 'Fintech Corp',
    role: 'Senior Software Engineer',
    bullets: [
      { id: 'exp_002_b01', text: 'Designed and shipped an event-driven telemetry ingestion engine in Go, scaling throughput from 5,000 to 45,000 events/second.' },
      { id: 'exp_002_b02', text: 'Built real-time transaction reconciliation dashboard in React, Node.js serving 250,000 monthly active retail users.' },
      { id: 'exp_002_b03', text: 'Authored comprehensive Jest and Cypress test suites, elevating code coverage from 61% to 89%.' },
      { id: 'exp_002_b04', text: 'Automated multi-region AWS infrastructure using Terraform and GitHub Actions, cutting production deployment lead time from 4 hours to 18 minutes.' },
    ],
  },
]

const highFreqKeywords = ['Kafka', 'TypeScript', 'Unit Testing', 'Git']
const highFreqWoven = weaveKeywordsIntoBullets(highFreqExperiences, highFreqKeywords, [])

assert.strictEqual(highFreqWoven.length, 4, 'Must weave all 4 high-frequency keywords')

const kafkaRw = highFreqWoven.find((r) => r.wovenKeyword === 'Kafka')
assert(kafkaRw, 'Must weave Kafka')
assert.strictEqual(kafkaRw.slot, 'messaging_slot')
assert(kafkaRw.readyToUseRewrite.includes('Kafka'), 'Must contain Kafka')
assert(kafkaRw.readyToUseRewrite.includes('5,000 to 45,000 events/second'), 'Must preserve telemetry metric verbatim')

const tsRw = highFreqWoven.find((r) => r.wovenKeyword === 'TypeScript')
assert(tsRw, 'Must weave TypeScript')
assert.strictEqual(tsRw.slot, 'frontend_slot')
assert(tsRw.readyToUseRewrite.includes('TypeScript'), 'Must contain TypeScript')
assert(tsRw.readyToUseRewrite.includes('250,000 monthly active retail users'), 'Must preserve user count metric verbatim')

const utRw = highFreqWoven.find((r) => r.wovenKeyword === 'Unit Testing')
assert(utRw, 'Must weave Unit Testing')
assert.strictEqual(utRw.slot, 'testing_slot')
assert(utRw.readyToUseRewrite.includes('Unit Testing'), 'Must contain Unit Testing')
assert(utRw.readyToUseRewrite.includes('61% to 89%'), 'Must preserve coverage metric verbatim')

const gitRw = highFreqWoven.find((r) => r.wovenKeyword === 'Git')
assert(gitRw, 'Must weave Git')
assert.strictEqual(gitRw.slot, 'cloud_slot')
assert(gitRw.readyToUseRewrite.includes('Git'), 'Must contain Git')
assert(gitRw.readyToUseRewrite.includes('4 hours to 18 minutes'), 'Must preserve lead time metric verbatim')

console.log('  ✓ 7.1 High-frequency keywords (Kafka, TypeScript, Unit Testing, Git) context-anchored into exact semantic slots')
console.log('  ✓ 7.2 All numeric metrics, scale counts, and deltas preserved 100% verbatim without corruption')

// -----------------------------------------------------------------------------
// TEST 8: Companion Interview Talking Points & Keyword Transparency Ledger
// -----------------------------------------------------------------------------
console.log('\n[Test 8] Companion Interview Talking Points & Keyword Transparency Ledger:')

assert(Array.isArray(highFreqWoven.keywordTransparencyLedger), 'Must generate keywordTransparencyLedger')
assert.strictEqual(highFreqWoven.keywordTransparencyLedger.length, 4, 'Ledger must contain 4 items')

highFreqWoven.keywordTransparencyLedger.forEach((entry) => {
  assert(entry.keyword, 'Entry must have keyword')
  assert(entry.slot, 'Entry must have slot')
  assert(entry.bulletId, 'Entry must have bulletId')
  assert(entry.originalBullet, 'Entry must have originalBullet')
  assert(entry.wovenBullet, 'Entry must have wovenBullet')
  assert(entry.whyRecruiterLookedForThis && entry.whyRecruiterLookedForThis.length > 20, 'Must have detailed recruiter rationale')
  assert(entry.howToSpeakToIt && entry.howToSpeakToIt.length > 20, 'Must have interview talking points')
  assert(entry.sampleInterviewAnswer && entry.sampleInterviewAnswer.length > 20, 'Must have concrete interview sample answer')
  assert(Array.isArray(entry.keyConceptsToMention) && entry.keyConceptsToMention.length >= 3, 'Must have key technical concepts')
})

const kafkaLedger = highFreqWoven.keywordTransparencyLedger.find((e) => e.keyword === 'Kafka')
assert(kafkaLedger.whyRecruiterLookedForThis.includes('event streaming'), 'Kafka rationale must explain event streaming')
assert(kafkaLedger.keyConceptsToMention.includes('Partitions & Consumer Groups'), 'Must list Kafka concepts')

console.log('  ✓ 8.1 Companion Interview Cheat Sheet & Keyword Transparency Ledger fully populated with recruiter screening rationale, talking points, sample answers, and key concepts')

// -----------------------------------------------------------------------------
// TEST 9: HTML Entity Decoding and Template Placeholder Cleaning
// -----------------------------------------------------------------------------
console.log('\n[Test 9] HTML Entity Decoding and Template Placeholder Cleaning:')

assert.strictEqual(
  decodeHtmlEntities('P&amp;C &lt;Cloud&gt; &#39;Platform&#39; &quot;Enterprise&quot;'),
  'P&C <Cloud> \'Platform\' "Enterprise"',
  'Must decode all HTML entities'
)

const cleanedPlaceholder1 = cleanPlaceholderGraceful('Engineered payment gateway integration, reducing approval latency by [ADD: 40%].')
assert.strictEqual(cleanedPlaceholder1, 'Engineered payment gateway integration.', 'Must gracefully clean trailing placeholder clause')

const cleanedPlaceholder2 = cleanPlaceholderGraceful('Scaled real-time chat infrastructure by [ADD: 3x concurrent capacity] and boosted system throughput.')
assert(cleanedPlaceholder2.includes('and boosted system throughput.'), 'Must preserve subsequent clause after placeholder')
assert(!cleanedPlaceholder2.includes('[ADD:'), 'Must not contain [ADD: ...]')

console.log('  ✓ 9.1 HTML entities cleanly decoded and [ADD: ...] placeholders gracefully removed without sentence corruption')

console.log('\n================================================================')
console.log('ALL SENIOR RECRUITER ROAST & KEYWORD WEAVER TESTS PASSED!')
console.log('================================================================')

