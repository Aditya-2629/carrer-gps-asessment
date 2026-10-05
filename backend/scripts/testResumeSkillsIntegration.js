/**
 * Resume Skills Integration Test Suite
 *
 * Verifies that the ResumeSkills frameworks (Google X-Y-Z formula, power verbs,
 * duty-to-achievement conversion, 6 metric dimensions, and discovery prompts)
 * are properly operationalized within the Resume Agent pipeline.
 */

import {
  POWER_VERBS,
  ALL_POWER_VERBS_SET,
  WEAK_DUTY_PATTERNS,
  METRIC_DIMENSIONS,
  analyzeBulletSkills,
  formatSkillGuidanceForPrompt,
} from '../agents/resume/skillsEngine/index.js'
import { validateRewrite } from '../agents/resume/validation/rewriteValidator.js'
import { buildSynthesisMessages, SYNTHESIS_PROMPT_VERSION } from '../agents/resume/synthesis/resumeSynthesis.js'
import { createResumeState, setCanonicalResume } from '../agents/resume/state/resumeState.js'

function assert(condition, message) {
  if (!condition) {
    console.error(`FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`PASS: ${message}`)
}

console.log('================================================================')
console.log('RESUME SKILLS INTEGRATION TEST SUITE')
console.log('================================================================\n')

// ── Test 1: Power Verbs Taxonomy ──────────────────────────────────────────────
console.log('--- Test 1: Power Verbs Taxonomy ---')
assert(Array.isArray(POWER_VERBS.leadership) && POWER_VERBS.leadership.includes('Led'), 'Leadership category includes "Led"')
assert(Array.isArray(POWER_VERBS.creation) && POWER_VERBS.creation.includes('Architected'), 'Creation category includes "Architected"')
assert(Array.isArray(POWER_VERBS.optimization) && POWER_VERBS.optimization.includes('Streamlined'), 'Optimization category includes "Streamlined"')
assert(Array.isArray(POWER_VERBS.problem_solving) && POWER_VERBS.problem_solving.includes('Remediated'), 'Problem-Solving category includes "Remediated"')
assert(ALL_POWER_VERBS_SET.has('built'), 'ALL_POWER_VERBS_SET contains "built"')
assert(ALL_POWER_VERBS_SET.has('reduced'), 'ALL_POWER_VERBS_SET contains "reduced"')

// ── Test 2: Duty Verb Detection & Power Verb Suggestion ───────────────────────
console.log('\n--- Test 2: Duty Verb Detection & Power Verb Suggestion ---')
const dutyBullet = 'Responsible for developing the authentication backend using Node.js.'
const dutyAnalysis = analyzeBulletSkills(dutyBullet)
assert(dutyAnalysis.hasDutyVerb === true, 'Detects "Responsible for" duty pattern')
assert(dutyAnalysis.dutyMatch === 'responsible for', 'Identifies exact duty match')
assert(dutyAnalysis.suggestedPowerVerbs.length > 0, 'Offers suggested power verbs')

const helpedBullet = 'Helped with optimizing database queries as part of a team.'
const helpedAnalysis = analyzeBulletSkills(helpedBullet)
assert(helpedAnalysis.hasDutyVerb === true, 'Detects "Helped with" duty pattern')
assert(helpedAnalysis.fillerWordsFound.includes('as part of a team'), 'Detects "as part of a team" filler phrase')

const powerBullet = 'Architected distributed caching layer using Redis, reducing query latency by 40%.'
const powerAnalysis = analyzeBulletSkills(powerBullet)
assert(powerAnalysis.hasDutyVerb === false, 'Power verb bullet has hasDutyVerb = false')
assert(powerAnalysis.startsWithPowerVerb === true, 'Power verb bullet has startsWithPowerVerb = true')
assert(powerAnalysis.xyzReady === true, 'Power verb with metric is xyzReady')

// ── Test 3: 6-Dimensional Metric Categorization ───────────────────────────────
console.log('\n--- Test 3: 6-Dimensional Metric Categorization ---')
const timeMetricBullet = 'Reduced page load latency from 4.2s to 1.1s by optimizing bundle size.'
const timeAnalysis = analyzeBulletSkills(timeMetricBullet)
assert(timeAnalysis.detectedMetricDimensions.includes('time'), 'Detects Time metric dimension')

const volumeMetricBullet = 'Scaled microservice to support 150,000+ daily active users and 5,000 RPS.'
const volumeAnalysis = analyzeBulletSkills(volumeMetricBullet)
assert(volumeAnalysis.detectedMetricDimensions.includes('scale_volume'), 'Detects Scale/Volume metric dimension')

const qualityMetricBullet = 'Achieved 99.95% system uptime across all production regions.'
const qualityAnalysis = analyzeBulletSkills(qualityMetricBullet)
assert(qualityAnalysis.detectedMetricDimensions.includes('quality'), 'Detects Quality/Uptime metric dimension')

const moneyMetricBullet = 'Reduced AWS cloud hosting costs by $45,000 annually by rightsizing EC2 instances.'
const moneyAnalysis = analyzeBulletSkills(moneyMetricBullet)
assert(moneyAnalysis.detectedMetricDimensions.includes('money'), 'Detects Money metric dimension')

// ── Test 4: Metric Discovery Question Generation ─────────────────────────────
console.log('\n--- Test 4: Metric Discovery Question Generation ---')
const unquantifiedBullet = 'Refactored backend API endpoints using FastAPI and PostgreSQL.'
const unquantifiedAnalysis = analyzeBulletSkills(unquantifiedBullet)
assert(unquantifiedAnalysis.detectedMetricDimensions.length === 0, 'No metrics detected in qualitative bullet')
assert(unquantifiedAnalysis.metricDiscoveryQuestions.length > 0, 'Generates metric discovery questions')
assert(
  unquantifiedAnalysis.metricDiscoveryQuestions.some((q) => q.toLowerCase().includes('speed') || q.toLowerCase().includes('user') || q.toLowerCase().includes('volume')),
  'Discovery questions prompt for scale or performance'
)

// ── Test 5: Prompt Guidance Injection ────────────────────────────────────────
console.log('\n--- Test 5: Prompt Guidance Injection ---')
const sampleBullets = [
  { id: 'exp_001_b01', text: 'Responsible for managing database migration as part of a team.' },
  { id: 'exp_001_b02', text: 'Built user dashboard using React and Tailwind.' },
]
const guidanceText = formatSkillGuidanceForPrompt(sampleBullets)
assert(guidanceText.includes('RESUME SKILL FRAMEWORK GUIDANCE'), 'Guidance header present')
assert(guidanceText.includes('exp_001_b01'), 'Cites bullet exp_001_b01')
assert(guidanceText.includes('responsible for'), 'Notes duty phrase')
assert(guidanceText.includes('as part of a team'), 'Notes filler phrase')

// ── Test 6: Synthesis Message Integration ────────────────────────────────────
console.log('\n--- Test 6: Synthesis Message Integration ---')
const mockCanonical = {
  candidate: { name: 'Jordan Lee', targetRole: 'Senior Backend Engineer' },
  experience: [
    {
      id: 'exp_001',
      title: 'Backend Engineer',
      company: 'TechCorp',
      bullets: [
        { id: 'exp_001_b01', text: 'Responsible for building authentication services with JWT.' },
      ],
    },
  ],
  projects: [],
  skills: [],
}
const state = createResumeState()
setCanonicalResume(state, mockCanonical)
state.compactResume = 'NAME: Jordan Lee\nEXPERIENCE:\n[exp_001] Backend Engineer at TechCorp\n- [exp_001_b01] Responsible for building authentication services with JWT.'

const messages = buildSynthesisMessages(state)
assert(messages.length === 2, 'Builds system and user messages')
assert(messages[0].role === 'system', 'First message is system')
assert(messages[0].content.includes('GOOGLE X-Y-Z FRAMEWORK'), 'System prompt contains Google X-Y-Z framework')
assert(messages[0].content.includes('METRIC DISCOVERY QUESTIONS'), 'System prompt contains Metric Discovery framework')
assert(messages[1].role === 'user', 'Second message is user')
assert(messages[1].content.includes('RESUME SKILL FRAMEWORK GUIDANCE'), 'User prompt contains injected skill guidance block')

// ── Test 7: Google X-Y-Z Rewrite Validation Safety ───────────────────────────
console.log('\n--- Test 7: Google X-Y-Z Rewrite Validation Safety ---')
// Valid X-Y-Z restructure (reorders existing facts, replaces weak verb)
const source1 = 'Worked on database optimization using Redis to decrease query latency by 45%.'
const validRewrite = 'Decreased query latency by 45% through Redis caching and database optimization.'
const check1 = validateRewrite(validRewrite, source1, 'exp_001_b01')
assert(check1.valid === true, 'Conservative X-Y-Z restructure passes rewriteValidator')

// Invalid rewrite (hallucinates 10,000 users)
const invalidRewrite = 'Decreased query latency by 45% for 10,000 users through Redis caching.'
const check2 = validateRewrite(invalidRewrite, source1, 'exp_001_b01')
assert(check2.valid === false, 'Rewrite with fabricated user count fails rewriteValidator')
assert(check2.violations.some((v) => v.includes('10,000')), 'Violation specifically flags the fabricated number')

console.log('\n================================================================')
console.log('ALL 7 RESUME SKILLS INTEGRATION TESTS PASSED!')
console.log('================================================================\n')
