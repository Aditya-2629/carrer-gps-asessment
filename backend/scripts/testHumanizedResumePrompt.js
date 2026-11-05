/**
 * testHumanizedResumePrompt.js
 *
 * Verifies Task 1:
 * 1. renderResumeSynthesisPromptV4 renders with zero [ADD: ...] and zero {{...}} placeholders.
 * 2. Prompt contains the expanded Banned Word list (spearheaded, leveraged, pivotal, etc.).
 * 3. SYNTHESIS_SYSTEM_PROMPT contains the anti-slop rules and 3-part mechanism formula.
 * 4. buildHumanizedTalkingPoint returns a natural, spoken 3-sentence technical defense without corporate filler.
 */

import assert from 'node:assert/strict'
import {
  renderResumeSynthesisPromptV4,
  RESUME_SYNTHESIS_PROMPT_V4,
  SYNTHESIS_SYSTEM_PROMPT,
} from '../agents/resume/synthesis/resumeSynthesis.prompt.js'
import {
  buildHumanizedTalkingPoint,
  generateInterviewScript,
} from '../agents/resume/market/smartKeywordWeaver.js'

console.log('=== RUNNING RESUME PROMPT HUMANIZATION & STAR REWRITER VERIFICATION ===\n')

// -----------------------------------------------------------------------------
// TEST 1: Verify renderResumeSynthesisPromptV4 Rendering & Placeholders
// -----------------------------------------------------------------------------
console.log('[Test 1] Verifying renderResumeSynthesisPromptV4 and Zero Placeholders...')

const mockCandidate = {
  candidateName: 'Alekya Maddu',
  targetRole: 'Senior Full Stack Software Engineer',
  currentTitle: 'Full Stack Developer',
  currentCompany: 'Collabera / Bank of America',
  yearsOfExperience: '5+ years',
  missingKeywords: ['Docker', 'Kubernetes', 'Kafka'],
  skillsOnlyKeywords: ['GraphQL', 'Redis'],
  experienceBullets: [
    { id: 'exp_001_b01', text: 'Engineered REST APIs in Node.js and Express for transaction workflows.' },
    { id: 'exp_001_b02', text: 'Migrated legacy Oracle queries to PostgreSQL databases.' },
  ],
}

const renderedPrompt = renderResumeSynthesisPromptV4(mockCandidate)

// Assert zero {{...}} template placeholders leak
assert.ok(!renderedPrompt.includes('{{'), 'Prompt must contain zero {{ placeholders')
assert.ok(!renderedPrompt.includes('}}'), 'Prompt must contain zero }} placeholders')

// Assert candidate facts section contains zero [ADD: placeholders
const candidateFactsSection = renderedPrompt.slice(
  renderedPrompt.indexOf('CANDIDATE FACTS:'),
  renderedPrompt.indexOf('STRICTLY BANNED ROBOTIC CLICHÉS')
)
assert.ok(!candidateFactsSection.includes('[ADD:'), 'Candidate facts section must contain zero [ADD: placeholders')
assert.ok(!candidateFactsSection.includes('[INSERT METRIC]'), 'Candidate facts section must contain zero [INSERT METRIC] placeholders')

// Assert rules explicitly ban bracketed placeholders from LLM output
assert.ok(
  renderedPrompt.includes('Never output bracketed placeholders like "[ADD: ...]"'),
  'Prompt instructions must explicitly ban [ADD: ...] output'
)

// Verify candidate data injected properly
assert.ok(renderedPrompt.includes('Alekya Maddu'), 'Prompt must contain candidate name')
assert.ok(renderedPrompt.includes('Senior Full Stack Software Engineer'), 'Prompt must contain target role')
assert.ok(renderedPrompt.includes('Docker, Kubernetes, Kafka'), 'Prompt must list missing keywords')

console.log('  ✔ 1.1 renderResumeSynthesisPromptV4 rendered cleanly with 0 template placeholders and 0 bracketed prompt slots.')

// -----------------------------------------------------------------------------
// TEST 2: Verify Anti-AI-Slop Negative Lexicon & 3-Part Mechanism Formula
// -----------------------------------------------------------------------------
console.log('\n[Test 2] Verifying Banned Corporate Buzzwords & Engineering Mechanism Formula...')

const requiredBannedWords = [
  'spearheaded',
  'leveraged',
  'synergistic',
  'cutting-edge',
  'results-driven',
  'passionate',
  'dynamic',
  'pivotal',
  'instrumental',
  'testament to',
  'proven track record',
  'hands-on experience with',
  'in order to',
  'seamlessly integrated',
  'delved',
  'thrives in fast-paced',
  'responsible for',
]

// Verify both prompts contain the expanded banned list
for (const word of requiredBannedWords) {
  assert.ok(
    RESUME_SYNTHESIS_PROMPT_V4.toLowerCase().includes(word.toLowerCase()),
    `RESUME_SYNTHESIS_PROMPT_V4 must ban "${word}"`
  )
  assert.ok(
    SYNTHESIS_SYSTEM_PROMPT.toLowerCase().includes(word.toLowerCase()),
    `SYNTHESIS_SYSTEM_PROMPT must ban "${word}"`
  )
}
console.log(`  ✔ 2.1 All ${requiredBannedWords.length} banned AI slop and corporate clichés explicitly present in negative lexicons.`)

// Verify 3-Part Engineering Mechanism Formula presence
assert.ok(
  RESUME_SYNTHESIS_PROMPT_V4.includes('ENGINEERING MECHANISM BULLET FORMULA'),
  'V4 prompt must include ENGINEERING MECHANISM BULLET FORMULA'
)
assert.ok(
  RESUME_SYNTHESIS_PROMPT_V4.includes('1. Architectural Context'),
  'V4 prompt must mandate Architectural Context'
)
assert.ok(
  RESUME_SYNTHESIS_PROMPT_V4.includes('2. Specific Mechanism'),
  'V4 prompt must mandate Specific Mechanism'
)
assert.ok(
  RESUME_SYNTHESIS_PROMPT_V4.includes('3. Operational Outcome'),
  'V4 prompt must mandate Operational Outcome'
)

assert.ok(
  SYNTHESIS_SYSTEM_PROMPT.includes('ENGINEERING MECHANISM BULLET FORMULA'),
  'System prompt must include ENGINEERING MECHANISM BULLET FORMULA'
)
console.log('  ✔ 2.2 3-Part Engineering Mechanism Formula strictly enforced across prompts.')

// Verify Humanized Recruiter Voice in recruiterCritique
assert.ok(
  RESUME_SYNTHESIS_PROMPT_V4.includes('HUMANIZED RECRUITER VOICE IN recruiterCritique'),
  'V4 prompt must include Humanized Recruiter Voice directive'
)
assert.ok(
  SYNTHESIS_SYSTEM_PROMPT.includes('HUMANIZED RECRUITER VOICE IN recruiterCritique'),
  'System prompt must include Humanized Recruiter Voice directive'
)
console.log('  ✔ 2.3 Peer-level coffee chat recruiter critique persona enforced.')

// -----------------------------------------------------------------------------
// TEST 3: Verify buildHumanizedTalkingPoint Spoken Defense
// -----------------------------------------------------------------------------
console.log('\n[Test 3] Verifying buildHumanizedTalkingPoint Spoken Defense...')

const talkingPoint = buildHumanizedTalkingPoint('Docker', 'Bank of America', 'Full Stack Developer')

assert.ok(talkingPoint, 'Must return talking point object')
assert.ok(talkingPoint.targetInterviewQuestion, 'Must have targetInterviewQuestion')
assert.ok(talkingPoint.wordForWordTalkingScript, 'Must have wordForWordTalkingScript')
assert.ok(talkingPoint.engineeringTradeOff, 'Must have engineeringTradeOff')

// Verify no robotic filler
const roboticFillers = ['synergistic', 'efficiency gains', 'spearheaded', 'leveraged', 'operational workflows to deliver measurable']
for (const filler of roboticFillers) {
  assert.ok(
    !talkingPoint.wordForWordTalkingScript.toLowerCase().includes(filler),
    `Talking script must not contain robotic filler: "${filler}"`
  )
}

// Verify spoken 3-sentence technical defense structure
const script = talkingPoint.wordForWordTalkingScript.trim()
const sentences = script.split(/(?<=[.!?])\s+/).filter(Boolean)

console.log('Generated Spoken Talking Script:\n', script)
console.log('Sentence Count:', sentences.length)

assert.strictEqual(sentences.length, 3, 'Spoken defense must have exactly 3 sentences (Problem -> Trade-off -> Result)')
assert.ok(script.includes('Bank of America'), 'Script must reference the candidate company')
assert.ok(script.includes('Full Stack Developer'), 'Script must reference candidate role')
assert.ok(script.includes('Docker'), 'Script must reference the target skill')
assert.ok(script.includes('p99 latency') || script.includes('connection pooling') || script.includes('schema boundaries'), 'Script must cite concrete engineering mechanism')

console.log('  ✔ 3.1 buildHumanizedTalkingPoint generates conversational, 3-sentence spoken defense with zero robotic filler.')

// -----------------------------------------------------------------------------
// TEST 4: Verify generateInterviewScript Natural Spoken Format
// -----------------------------------------------------------------------------
console.log('\n[Test 4] Verifying generateInterviewScript Across Categories...')

const cloudScript = generateInterviewScript('Kubernetes', 'cloud_devops', 'Full Stack Engineer', 'Collabera')
assert.ok(cloudScript.includes('Collabera'), 'Must mention company')
assert.ok(!cloudScript.toLowerCase().includes('leveraged'), 'Must not use "leveraged"')
assert.ok(!cloudScript.toLowerCase().includes('operational workflows to deliver measurable efficiency gains'), 'Must not use robotic template')
const cloudSentences = cloudScript.split(/(?<=[.!?])\s+/).filter(Boolean)
assert.strictEqual(cloudSentences.length, 3, 'Cloud interview script must have 3 sentences')

const uiScript = generateInterviewScript('TypeScript', 'frontend_ui', 'Full Stack Engineer', 'Bank of America')
assert.ok(uiScript.includes('enforce static typing'), 'Must preserve static typing phrase')
assert.ok(!uiScript.toLowerCase().includes('leveraged'), 'Must not use "leveraged"')
const uiSentences = uiScript.split(/(?<=[.!?])\s+/).filter(Boolean)
assert.strictEqual(uiSentences.length, 3, 'Frontend interview script must have 3 sentences')

console.log('  ✔ 4.1 generateInterviewScript outputs spoken 3-sentence answers with natural cadence across categories.')

console.log('\n======================================================================')
console.log(' ALL RESUME PROMPT HUMANIZATION & STAR REWRITER TESTS PASSED (4/4)!')
console.log('======================================================================\n')
