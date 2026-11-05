/**
 * testChatbotCopilotEngine.js
 *
 * Verification Suite for Career GPS Chatbot ("Atlas Copilot"):
 * 1. extractCandidateDossier extracts ~1,200 token context envelope with exact company, skills, and funnel numbers.
 * 2. buildChatbotSystemPrompt injects candidate facts, bans corporate filler, and purges "Max 3-4 sentences".
 * 3. classifyChatIntent accurately maps queries to report sections.
 * 4. End-to-end contract validation.
 */

import assert from 'node:assert/strict'
import {
  extractCandidateDossier,
  buildChatbotSystemPrompt,
  classifyChatIntent,
  CHAT_INTENTS,
} from '../controllers/chatController.js'

console.log('=== RUNNING CHATBOT COPILOT ENGINE VERIFICATION ===\n')

// -------------------------------------------------------------
// TEST 1: extractCandidateDossier with Rich Mock User Payload
// -------------------------------------------------------------
console.log('Test 1: Verifying extractCandidateDossier...')

const mockUser = {
  name: 'Alekya Maddu',
  answers: {
    targetRole: 'Senior Full Stack Software Engineer',
    applications90d: 45,
  },
  resumeJson: {
    candidate: {
      name: 'Alekya Maddu',
      targetRole: 'Senior Full Stack Software Engineer',
    },
    experiences: [
      {
        company: 'Collabera / Bank of America',
        role: 'Full Stack Developer',
        dates: '2022 - Present',
        bullets: [
          'Engineered transaction processing workflows using Node.js, Express, and PostgreSQL.',
          'Migrated legacy monolithic queries to optimized indexed tables, dropping query latency by 35%.',
        ],
      },
      {
        company: 'Tata Consultancy Services',
        role: 'Software Engineer',
        dates: '2019 - 2022',
        bullets: [
          'Developed responsive React component modules and integrated REST endpoints.',
        ],
      },
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
  },
  aiReport: {
    target_role: 'Senior Full Stack Software Engineer',
    career_health_score: 74,
    primary_bottleneck: {
      title: 'Top of Funnel Recruiter Screen Drop-off',
    },
    assessment_agent: {
      seniorityTier: 'Senior',
    },
    resume_agent: {
      verifiedSkills: ['Node.js', 'React', 'PostgreSQL', 'Express', 'TypeScript'],
      missingTargetKeywords: ['Kubernetes', 'Kafka', 'GraphQL'],
    },
    linkedin_agent: {
      discrepancies: [
        {
          title: 'Title Variance: Developer vs Senior Engineer',
          diagnosis: 'Headline states Senior Software Engineer but resume lists Full Stack Developer',
        },
      ],
    },
    funnel_stages: {
      applications_count: 45,
      recruiter_calls_count: 5,
      interviews_count: 2,
      offers_count: 0,
      biggest_leak_stage: 'Recruiter Screen Choke Point',
    },
  },
}

const dossier = extractCandidateDossier(mockUser)

assert.strictEqual(dossier.candidateName, 'Alekya Maddu', 'Candidate name must match')
assert.strictEqual(dossier.targetRole, 'Senior Full Stack Software Engineer', 'Target role must match')
assert.strictEqual(dossier.seniorityTier, 'Senior', 'Seniority tier must match')
assert.strictEqual(dossier.careerHealthScore, 74, 'Career health score must match')
assert.strictEqual(dossier.topExperiences.length, 2, 'Must extract top experiences')
assert.strictEqual(dossier.topExperiences[0].company, 'Collabera / Bank of America', 'Must extract exact recent company')
assert.ok(dossier.topExperiences[0].bullets.length >= 2, 'Must preserve actual bullets')
assert.strictEqual(dossier.funnel.applications, 45, 'Funnel applications count must match')
assert.strictEqual(dossier.funnel.recruiterScreens, 5, 'Funnel recruiter screens must match')
assert.strictEqual(dossier.funnel.technicalRounds, 2, 'Funnel technical rounds must match')
assert.strictEqual(dossier.funnel.offers, 0, 'Funnel offers must match')
assert.strictEqual(dossier.primaryBottleneck, 'Top of Funnel Recruiter Screen Drop-off', 'Bottleneck must match')
assert.ok(dossier.verifiedSkills.includes('Node.js'), 'Must contain verified skills')
assert.ok(dossier.missingSkills.includes('Kubernetes'), 'Must contain missing skills')
assert.ok(dossier.discrepancies.length > 0, 'Must extract LinkedIn discrepancies')

console.log('✔ Test 1 Passed: extractCandidateDossier extracts complete high-signal context envelope.\n')

// -------------------------------------------------------------
// TEST 2: buildChatbotSystemPrompt Persona & Rules
// -------------------------------------------------------------
console.log('Test 2: Verifying buildChatbotSystemPrompt...')

const systemPrompt = buildChatbotSystemPrompt(dossier)

// Must contain candidate's exact company and target role
assert.ok(systemPrompt.includes('Collabera / Bank of America'), 'System prompt must include exact company name')
assert.ok(systemPrompt.includes('Senior Full Stack Software Engineer'), 'System prompt must include target role')
assert.ok(systemPrompt.includes('Alekya Maddu'), 'System prompt must include candidate name')
assert.ok(systemPrompt.includes('Recruiter Screen Choke Point'), 'System prompt must include funnel leak stage')

// Must NOT contain the obsolete "Max 3-4 sentences" limitation
assert.ok(
  !systemPrompt.includes('Max 3-4 sentences per response'),
  'System prompt must NOT contain obsolete "Max 3-4 sentences per response" restriction'
)

// Must ban AI slop and corporate filler
const bannedFillerWords = [
  'navigating the job market',
  'delve',
  'it is crucial',
  'in conclusion',
  'testament to',
]
for (const filler of bannedFillerWords) {
  assert.ok(
    systemPrompt.toLowerCase().includes(filler.toLowerCase()),
    `System prompt must explicitly ban "${filler}" in negative constraints`
  )
}

// Must enforce Google XYZ bullet formula and 1-click copy cards
assert.ok(systemPrompt.includes('Google XYZ format'), 'Must mandate Google XYZ format')
assert.ok(systemPrompt.includes('```text'), 'Must instruct wrapping in ```text code blocks')
assert.ok(systemPrompt.includes('THE ADDICTIVE CURIOSITY LOOP'), 'Must enforce curiosity loop closing hook')

console.log('✔ Test 2 Passed: buildChatbotSystemPrompt enforces Atlas Executive Partner persona, facts, and rules.\n')

// -------------------------------------------------------------
// TEST 3: classifyChatIntent Across Query Categories
// -------------------------------------------------------------
console.log('Test 3: Verifying classifyChatIntent mapping...')

const interviewIntent = classifyChatIntent('How should I answer tell me about a time I failed in a technical screen?')
assert.strictEqual(interviewIntent.id, 'interview', 'Must classify as interview intent')
assert.strictEqual(interviewIntent.section, 'interview-prep', 'Must route to interview section')

const outreachIntent = classifyChatIntent('Can you draft a cold email to the engineering manager at Stripe?')
assert.strictEqual(outreachIntent.id, 'outreach', 'Must classify as outreach intent')

const resumeIntent = classifyChatIntent('Can you rewrite my Collabera bullet with quantitative metrics?')
assert.strictEqual(resumeIntent.id, 'resume', 'Must classify as resume intent')

const roadmapIntent = classifyChatIntent('What is my 7-day action plan for week 1?')
assert.strictEqual(roadmapIntent.id, 'roadmap', 'Must classify as roadmap intent')

const generalIntent = classifyChatIntent('What is your high-level perspective on my background?')
assert.strictEqual(generalIntent.id, 'general', 'Unmatched query routes to general overview')

console.log('✔ Test 3 Passed: classifyChatIntent accurately routes candidate queries.\n')

// -------------------------------------------------------------
// TEST 4: CHAT_INTENTS Export Integrity
// -------------------------------------------------------------
console.log('Test 4: Verifying CHAT_INTENTS export structure...')
assert.strictEqual(CHAT_INTENTS.length, 5, 'Must export 5 core chat intents')
CHAT_INTENTS.forEach((intent) => {
  assert.ok(intent.id, 'Intent must have id')
  assert.ok(intent.section, 'Intent must have section')
  assert.ok(intent.label, 'Intent must have label')
  assert.ok(intent.match instanceof RegExp, 'Intent must have regex match')
})
console.log('✔ Test 4 Passed: CHAT_INTENTS export structure is valid.\n')

console.log('======================================================================')
console.log(' ALL CHATBOT COPILOT ENGINE VERIFICATION TESTS PASSED (4/4)!')
console.log('======================================================================\n')

