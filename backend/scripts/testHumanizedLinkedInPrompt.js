/**
 * testHumanizedLinkedInPrompt.js
 *
 * Verifies Task 2 deliverables:
 * 1. Task 1 About section prompt humanization, First-Person ("I") voice, 3-paragraph arc, and purge of tag clouds.
 * 2. Thought leadership prompt mandating the 3 High-Converting Technical Archetypes and zero-fluff rule.
 * 3. Deterministic thought leadership generator producing all 3 archetypes with concrete tool citations and no platitudes.
 * 4. Fallback About section containing clean narrative without trailing tag clouds.
 */

import assert from 'assert'
import {
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT,
  buildThoughtLeadershipSystemPrompt,
} from '../agents/linkedin/linkedinSynthesis.prompt.js'
import {
  buildDeterministicThoughtLeadership,
} from '../agents/linkedin/linkedinThoughtLeadershipEvaluator.js'
import {
  synthesizeLinkedInOptimizations,
} from '../agents/linkedin/linkedinSynthesis.js'

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🧪 Running Test Suite: Humanized LinkedIn Prompt & Thought Leadership')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// =========================================================================
// TEST 1: Task 1 Headlines & About Section System Prompt
// =========================================================================
console.log('Test 1: Verifying Task 1 About Section Prompt Architecture...')

// Must include the humanized architecture header
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('ABOUT SECTION HUMANIZED ARCHITECTURE (180–240 WORDS, 3 PARAGRAPHS)'),
  'Prompt must include "ABOUT SECTION HUMANIZED ARCHITECTURE (180–240 WORDS, 3 PARAGRAPHS)"'
)

// Must mandate First-Person ("I") voice
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('Strict FIRST-PERSON ("I", "my") practitioner voice'),
  'Prompt must instruct strict First-Person ("I", "my") voice'
)

// Must strictly forbid third-person phrasing
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('NEVER write in the third-person'),
  'Prompt must explicitly forbid third-person phrasing'
)

// Must define the 3-paragraph narrative arc
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('PARAGRAPH 1 (Technical Identity & Engineering Obsession):'),
  'Prompt must define Paragraph 1: Technical Identity & Engineering Obsession'
)
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('PARAGRAPH 2 (Architecture Proof & Engineering Pillars):'),
  'Prompt must define Paragraph 2: Architecture Proof & Engineering Pillars'
)
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('PARAGRAPH 3 (Where I\'m Headed & Engineering Philosophy):'),
  'Prompt must define Paragraph 3: Where I\'m Headed & Engineering Philosophy'
)

// Must ban raw resume bullet dumps
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('NEVER copy-paste raw resume bullets'),
  'Prompt must forbid copy-pasting raw resume bullets'
)

// Must purge trailing tag clouds and keyword lists
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('PURGE TRAILING KEYWORD LISTS'),
  'Prompt must instruct "PURGE TRAILING KEYWORD LISTS"'
)
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('Strictly FORBID appending raw keyword lists or tag clouds'),
  'Prompt must strictly forbid appending raw keyword lists or tag clouds'
)

// Schema must enforce no trailing keyword lists
assert.ok(
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('strictly NO trailing keyword lists or tag clouds'),
  'JSON schema callToAction must enforce NO trailing keyword lists'
)

console.log('  ✅ Test 1 Passed: Task 1 About section prompt strictly mandates First-Person ("I") voice, 3-paragraph arc, and bans tag clouds.\n')

// =========================================================================
// TEST 2: Thought Leadership System Prompt & 3 Archetypes
// =========================================================================
console.log('Test 2: Verifying Thought Leadership Prompt & 3 Archetypes...')

const tlPrompt = buildThoughtLeadershipSystemPrompt()

// Must include the 3 archetypes
assert.ok(
  tlPrompt.includes('Archetype 1: "The Production Post-Mortem & Silent Bug"'),
  'Prompt must define Archetype 1: The Production Post-Mortem & Silent Bug'
)
assert.ok(
  tlPrompt.includes('Archetype 2: "The Tooling Trade-Off & Migration Reality"'),
  'Prompt must define Archetype 2: The Tooling Trade-Off & Migration Reality'
)
assert.ok(
  tlPrompt.includes('Archetype 3: "The Architecture Deep-Dive / Counter-Intuitive Lesson"'),
  'Prompt must define Archetype 3: The Architecture Deep-Dive / Counter-Intuitive Lesson'
)

// Must enforce Zero-Fluff Rule
assert.ok(
  tlPrompt.includes('ZERO-FLUFF RULE: Strictly forbid engagement bait or corporate platitudes'),
  'Prompt must enforce ZERO-FLUFF RULE'
)
assert.ok(
  tlPrompt.includes('Happy Monday!') && tlPrompt.includes('Agree? Thoughts?'),
  'Prompt must explicitly ban "Happy Monday!" and "Agree? Thoughts?"'
)

// Must require concrete technology citation
assert.ok(
  tlPrompt.includes('CONCRETE TECHNOLOGY CITATION: Every template hook MUST cite at least 2 real technologies'),
  'Prompt must require citing at least 2 real technologies'
)

console.log('  ✅ Test 2 Passed: Thought Leadership prompt enforces 3 technical archetypes, zero-fluff, and 2+ tool citations.\n')

// =========================================================================
// TEST 3: Deterministic Thought Leadership Generator
// =========================================================================
console.log('Test 3: Testing Deterministic Thought Leadership Generator with Real Skills...')

const candidateSkills = ['React', 'Node.js', 'PostgreSQL', 'Docker']
const tlResult = buildDeterministicThoughtLeadership(
  'Senior Full Stack Engineer',
  candidateSkills,
  [{ name: 'CloudEventPlatform' }]
)

assert.ok(tlResult.actionablePostTemplates, 'Must return actionablePostTemplates')
assert.strictEqual(tlResult.actionablePostTemplates.length, 3, 'Must return exactly 3 post templates')

const t1 = tlResult.actionablePostTemplates[0]
const t2 = tlResult.actionablePostTemplates[1]
const t3 = tlResult.actionablePostTemplates[2]

// Check format archetypes
assert.strictEqual(t1.format, 'The Production Post-Mortem & Silent Bug', 'Template 1 format must match Archetype 1')
assert.strictEqual(t2.format, 'The Tooling Trade-Off & Migration Reality', 'Template 2 format must match Archetype 2')
assert.strictEqual(t3.format, 'The Architecture Deep-Dive / Counter-Intuitive Lesson', 'Template 3 format must match Archetype 3')

// Check tool citations across templates
const allHooks = [t1.hook, t2.hook, t3.hook].join(' ')
console.log(`  Combined Hooks Output:\n  ${allHooks}\n`)

assert.ok(allHooks.includes('React'), 'Hooks must cite React')
assert.ok(allHooks.includes('Node.js'), 'Hooks must cite Node.js')
assert.ok(allHooks.includes('PostgreSQL'), 'Hooks must cite PostgreSQL')
assert.ok(allHooks.includes('Docker'), 'Hooks must cite Docker')

// Check each individual hook cites at least 2 skills
for (let i = 0; i < 3; i++) {
  const hook = tlResult.actionablePostTemplates[i].hook
  const citedSkills = candidateSkills.filter((s) => hook.includes(s))
  assert.ok(
    citedSkills.length >= 2,
    `Template ${i + 1} hook must cite at least 2 candidate skills (found: ${citedSkills.join(', ')})`
  )
}

// Check zero generic platitudes in hooks and callToAction
const bannedPhrases = [/happy monday/i, /always keep learning/i, /\bagree\s*\?/i, /\bthoughts\s*\?/i]
for (const tmpl of tlResult.actionablePostTemplates) {
  for (const re of bannedPhrases) {
    assert.ok(!re.test(tmpl.hook), `Hook must not contain generic platitude: ${re}`)
    assert.ok(!re.test(tmpl.callToAction), `CTA must not contain generic platitude: ${re}`)
  }
}

console.log('  ✅ Test 3 Passed: Deterministic thought leadership produces all 3 archetypes, cites all candidate tools, and has 0 platitudes.\n')

// =========================================================================
// TEST 4: Fallback About Narrative & Elimination of Trailing Tag Clouds
// =========================================================================
console.log('Test 4: Verifying Fallback About Narrative Arc & Purge of Tag Clouds...')

const testProfile = {
  id: 'test-user',
  fullName: 'Morgan Blake',
  headline: 'Software Engineer',
  about: 'I am a software engineer.',
  experiences: [{ company: 'Stripe', title: 'Senior Backend Engineer', description: 'Built payment systems.' }],
  skills: ['Node.js', 'PostgreSQL', 'Docker', 'AWS'],
  projects: [{ title: 'LedgerService', description: 'Core ledger platform' }],
}

const testResume = {
  candidate: { name: 'Morgan Blake', targetRole: 'Senior Distributed Systems Engineer', years_of_experience: '6+ years' },
  experience: [{ company: 'Stripe', role: 'Senior Backend Engineer', bullets: ['Engineered payment pipeline handling 50k tps.'] }],
  projects: [{ title: 'LedgerService', description: 'Distributed ledger service' }],
  skills: ['Node.js', 'PostgreSQL', 'Docker', 'AWS'],
}

const optimizations = await synthesizeLinkedInOptimizations(
  testProfile,
  testResume,
  [],
  [],
  null,
  { bypassAI: true }
)

assert.ok(optimizations.aboutRewrite, 'Must return aboutRewrite')
const fullText = optimizations.aboutRewrite.fullText
const cta = optimizations.aboutRewrite.callToAction

// Assert first person ("I")
assert.ok(fullText.startsWith('I am a') || fullText.startsWith('I '), 'About text must start in First-Person ("I")')

// Assert NO trailing tag cloud or "Core Competencies:"
assert.ok(!fullText.includes('Core Competencies:'), 'About fullText must NOT contain trailing "Core Competencies:" tag cloud')
assert.ok(!cta.includes('Core Competencies:'), 'About callToAction must NOT contain trailing "Core Competencies:" tag cloud')

console.log(`  Full Narrative Sample (Excerpt):\n  ${fullText.slice(0, 200)}...\n`)
console.log('  ✅ Test 4 Passed: Fallback About narrative is in first-person and has zero trailing tag clouds.\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎉 ALL 4 LINKEDIN HUMANIZATION & ARCHETYPE TESTS PASSED!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

