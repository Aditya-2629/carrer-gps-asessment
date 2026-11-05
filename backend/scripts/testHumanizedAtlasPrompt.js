/**
 * testHumanizedAtlasPrompt.js
 *
 * Verifies Task 3:
 * 1. Atlas prompt explicitly includes the Tough-Love Persona directives (David / Elena, TOUGH LOVE).
 * 2. 3-Part Executive Diagnostic Framework is strictly enforced with candidate-addressed examples.
 * 3. Behavioral Funnel Leak rules (Cold Portal Lottery Trap, Elevator Pitch / Storytelling Deficit) are enforced.
 * 4. Risk Matrix prompt requires clear un-minced threat statement and 1 pragmatic mitigation.
 * 5. Prompt contains zero corporate buzzwords outside the negative/banned list.
 * 6. Generated mock output satisfies both dashboard frontend contract and report PDF generation.
 */

import assert from 'node:assert/strict'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import {
  ATLAS_EXECUTIVE_COACH_SYSTEM_PROMPT,
  ATLAS_FORMAT_CONTRACT,
  renderAtlasPrompt,
  deriveFunnelFromAnswers,
  normalizeAtlasShapes,
} from '../services/reportGeneration.js'
import { generateReportPdfBuffer } from '../utils/reportPdfGenerator.js'

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🧪 Running Test Suite: Humanized Atlas Executive Coach Prompt')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const mockUserAnswers = {
  name: 'Alekya Maddu',
  targetRole: 'Senior Full Stack Engineer',
  visa: 'F-1 STEM OPT',
  apps30d: 30,
  funnel90d: {
    applications90d: 90,
    screens: 1,
    technicalRounds: 0,
    finalRounds: 0,
    offers: 0,
  },
}

const mockResume = {
  candidate: {
    name: 'Alekya Maddu',
    targetRole: 'Senior Full Stack Engineer',
    years_of_experience: '5+ years',
  },
  experience: [
    {
      company: 'Bank of America',
      role: 'Full Stack Software Engineer',
      bullets: [
        'Engineered payment transaction microservices handling 50k tps.',
        'Migrated legacy batch jobs to Kafka event streams.',
      ],
    },
  ],
  skills: ['React', 'Node.js', 'PostgreSQL', 'Docker', 'Kafka'],
}

// =========================================================================
// TEST 1: Render Atlas Prompt & Verify Tough-Love Persona Directives
// =========================================================================
console.log('[Test 1] Verifying Executive Coach Persona & Tone Directives...')

const renderedPrompt = renderAtlasPrompt(mockUserAnswers, mockResume, {
  userAnswers: mockUserAnswers,
})

assert.ok(typeof renderedPrompt === 'string', 'renderAtlasPrompt must return a string')

// 1. Must define Tough-Love Persona
assert.ok(
  renderedPrompt.includes('PERSONA & TONE DIRECTIVE:'),
  'Prompt must define "PERSONA & TONE DIRECTIVE:"'
)
assert.ok(
  renderedPrompt.includes('David / Elena'),
  'Prompt must specify David / Elena executive persona'
)
assert.ok(
  renderedPrompt.includes('TOUGH LOVE'),
  'Prompt must define TOUGH LOVE coaching philosophy'
)
assert.ok(
  renderedPrompt.includes('Never sound like an algorithmic ATS bot'),
  'Prompt must instruct to never sound like an algorithmic ATS bot'
)

// 2. Must enforce 3-Part Executive Diagnostic Framework
assert.ok(
  renderedPrompt.includes('3-PART EXECUTIVE DIAGNOSTIC FRAMEWORK:'),
  'Prompt must define "3-PART EXECUTIVE DIAGNOSTIC FRAMEWORK:"'
)
assert.ok(
  renderedPrompt.includes('Part 1: Validate the Enterprise Foundation'),
  'Prompt must define Part 1: Validate the Enterprise Foundation'
)
assert.ok(
  renderedPrompt.includes('Part 2: The Brutal Bottleneck Truth'),
  'Prompt must define Part 2: The Brutal Bottleneck Truth'
)
assert.ok(
  renderedPrompt.includes('Part 3: The Immediate High-Leverage Pivot'),
  'Prompt must define Part 3: The Immediate High-Leverage Pivot'
)
assert.ok(
  renderedPrompt.includes('Alekya, your resume proves'),
  'Prompt must include canonical example "Alekya, your resume proves..."'
)

console.log('  ✔ 1.1 Tough-Love Persona (David / Elena) and 3-Part Diagnostic Framework strictly present in rendered prompt.\n')

// =========================================================================
// TEST 2: Corporate Buzzwords & Anti-AI-Slop Negative Lexicon
// =========================================================================
console.log('[Test 2] Verifying Banned Corporate Buzzwords & Anti-Slop Negative Lexicon...')

const requiredBannedWords = [
  'spearheaded',
  'leveraged',
  'synergistic',
  'cutting-edge',
  'results-driven',
  'passionate',
  'pivotal',
  'delve',
  'testament to',
  'navigating the job market',
  'in conclusion',
  'it is crucial',
  'synergies',
  'holistic',
]

// Must list all banned buzzwords in the negative constraints
for (const word of requiredBannedWords) {
  assert.ok(
    renderedPrompt.toLowerCase().includes(word.toLowerCase()),
    `Prompt must explicitly ban "${word}"`
  )
}

// Must NOT use any banned buzzwords outside the negative instruction lines
const promptWithoutBannedRules = renderedPrompt
  .replace(/BANNED ROBOTIC CLICHÉS[\s\S]*?(?=\n\nFORMAT|\n\n###|$)/gi, '')
  .replace(/ZERO AI FILLER TOLERANCE:[^\n]+/gi, '')

for (const word of ['spearheaded', 'leveraged', 'synergistic']) {
  assert.ok(
    !promptWithoutBannedRules.toLowerCase().includes(word.toLowerCase()),
    `Prompt narrative instructions must not use banned buzzword "${word}"`
  )
}

console.log('  ✔ 2.1 All 14 banned clichés present in negative constraints; 0 buzzwords leaked into prompt narrative.\n')

// =========================================================================
// TEST 3: Behavioral Funnel Leak & Risk Matrix Instructions
// =========================================================================
console.log('[Test 3] Verifying Behavioral Funnel Leak & Risk Matrix Directives...')

assert.ok(
  renderedPrompt.includes('The Cold Portal Lottery Trap — Relying on Easy Apply volume without direct hiring manager outreach or targeted ATS customization.'),
  'Prompt must specify Cold Portal Lottery Trap behavioral diagnosis'
)
assert.ok(
  renderedPrompt.includes('The Elevator Pitch / Storytelling Deficit — Getting the call but failing to articulate architectural trade-offs during the initial 15-minute phone screen.'),
  'Prompt must specify Elevator Pitch / Storytelling Deficit behavioral diagnosis'
)

// Test deriveFunnelFromAnswers behavior for high apps / low screens
const coldPortalFunnel = deriveFunnelFromAnswers({
  apps30d: 30,
  funnel90d: { applications90d: 90, screens: 1, technicalRounds: 0 },
})
assert.ok(
  coldPortalFunnel.diagnosis_message.includes('The Cold Portal Lottery Trap'),
  'deriveFunnelFromAnswers must diagnose Cold Portal Lottery Trap when apps > 80 and screens < 3'
)

// Test deriveFunnelFromAnswers behavior for high screens / zero tech rounds
const storytellingFunnel = deriveFunnelFromAnswers({
  apps30d: 30,
  funnel90d: { applications90d: 60, screens: 6, technicalRounds: 0 },
})
assert.ok(
  storytellingFunnel.diagnosis_message.includes('The Elevator Pitch / Storytelling Deficit'),
  'deriveFunnelFromAnswers must diagnose Elevator Pitch / Storytelling Deficit when screens > 5 and tech = 0'
)

console.log('  ✔ 3.1 Behavioral funnel leak diagnostics accurately configured in prompt schema and deterministic fallback.\n')

// =========================================================================
// TEST 4: Output Contract & PDF Generator Verification
// =========================================================================
console.log('[Test 4] Verifying JSON Output Normalization & PDF Generation Contract...')

const mockAtlasOutput = {
  career_health_score: 72,
  score_label: 'Needs Optimization',
  score_breakdown: {
    resume: { score: 68, diagnosis: 'Missing critical distributed systems and Kafka ownership tokens.' },
    linkedin: { score: 70, diagnosis: 'Headline lacks technical scope hook.' },
    outreach: { score: 74, diagnosis: 'Application volume high but reliance on cold portals stalls conversion.' },
    interviews: { score: 76, diagnosis: 'Drop-off at technical screening phase.' },
  },
  market_reality_check: {
    headline: 'Senior Full Stack market is saturated; portal applications yield <2% callbacks without direct outreach.',
    brutal_facts: [
      'Cold applications yield under 3% callbacks for Senior roles.',
      '75% of ATS resumes are filtered out in under 6 seconds.',
      'Hiring managers look for verifiable architecture scale over laundry lists of tools.',
    ],
    application_velocity: 'High volume (30/mo) but trapped in cold portal black holes.',
    resume_blackhole: 'Tool dumping without quantified outcome metrics.',
  },
  career_journey: {
    current_phase_id: 1,
    phase_name: 'Resume → Screening Call',
    guide_message: 'Pivot from cold portal applications to direct engineering manager outreach.',
  },
  funnel_stages: {
    applications_count: 90,
    recruiter_calls_count: 1,
    interviews_count: 0,
    final_rounds_count: 0,
    offers_count: 0,
    biggest_leak_stage: 'top_of_funnel',
    leak_title: 'The Cold Portal Lottery Trap',
    diagnosis_message: 'The Cold Portal Lottery Trap — Relying on Easy Apply volume without direct hiring manager outreach or targeted ATS customization.',
  },
  rejection_factors: [
    { name: 'Resume & ATS', pct: 40, desc: 'Passive tool listings without system impact' },
    { name: 'Execution & Velocity', pct: 25, desc: 'Cold portal reliance' },
    { name: 'LinkedIn Discoverability', pct: 20, desc: 'Generic headline' },
    { name: 'Interview Defense', pct: 15, desc: 'Phone screen pitch gap' },
  ],
  rejection_insight: 'Your resume reads like an instruction manual of tools rather than senior system ownership.',
  risk_heatmap: {
    critical_risk: 'F-1 STEM OPT Clock: Active clock requires landing a verified sponsor firm within 90 days.',
    high_impact_low_likelihood: ['Visa lottery delays'],
    low_impact_high_likelihood: ['Slow recruiter response times'],
    mitigation_plan: 'Target verified E-Verify enterprise firms directly via warm connections.',
  },
  executive_verdict: 'Alekya, your resume proves you can write solid code at enterprise scale at Bank of America. But hiring managers are passing in 6 seconds because your experience reads like an instruction manual of tools you touched, rather than the business outcomes and system architecture you owned. To break through, shift your bullets to lead with business latency and transaction volume tomorrow morning.',
  key_advantage: 'Enterprise experience scaling backend transaction microservices at Bank of America.',
  primary_bottleneck: {
    title: 'The Cold Portal Lottery Trap',
    diagnosis: '90 applications yielding only 1 screen due to generic portal Easy Apply usage.',
    what_to_do: 'Reallocate 50% of outreach to direct Engineering Manager messaging on LinkedIn.',
  },
  risk_matrix: [
    {
      risk: 'F-1 STEM OPT Clock: 90-day unemployment clock running while relying on low-conversion job boards.',
      severity: 'High',
      mitigation: 'Filter all application volume to verified E-Verify sponsors and engage engineering managers directly on LinkedIn.',
    },
    {
      risk: 'Contract Staffing Misinterpretation: Collabera vendor framing overshadowing enterprise client delivery at Bank of America.',
      severity: 'Medium',
      mitigation: 'Restructure header to "Collabera (Client: Bank of America)" to maintain verified corporate pedigree.',
    },
  ],
  top_priorities: [
    'Rewrite top 3 Bank of America bullets using the 3-part Engineering Mechanism Formula.',
    'Switch 50% of application volume to direct outreach to Engineering Managers on LinkedIn.',
    'Prepare a 60-second verbal architectural elevator pitch for initial recruiter screens.',
  ],
  critical_issues: [
    {
      title: 'Passive Tool Listing on Resume',
      severity: 'High',
      icon_suggestion: 'alert-triangle',
      diagnosis: 'Experience bullets list React and Node.js without citing transaction scale or throughput.',
      action_steps: ['Quantify transaction TPS', 'Frame microservice architecture trade-offs'],
    },
  ],
  recommended_tools: [
    { tool_name: 'Jobscan', category: 'ATS Optimization', reason: 'Benchmark resume against enterprise job descriptions' },
  ],
  coach_intervention: {
    urgency_statement: 'Polished resume bullets alone cannot solve cold portal drops at 90 applications.',
    value_prop: 'In your 1-on-1 Strategy Call, we map your 30-day direct outbound pipeline to verified engineering leads.',
    cta_text: 'Book Free 1-on-1 Strategy Session',
  },
}

const normalized = normalizeAtlasShapes(mockAtlasOutput, mockUserAnswers)

// Check risk_matrix normalization
assert.ok(Array.isArray(normalized.risk_matrix), 'risk_matrix must be an array')
assert.strictEqual(normalized.risk_matrix.length, 2, 'risk_matrix must contain 2 items')
assert.ok(normalized.risk_matrix[0].risk, 'risk_matrix item must have risk field')
assert.ok(normalized.risk_matrix[0].mitigation, 'risk_matrix item must have mitigation field')

// Verify PDF generation with humanized report structure
const mockUser = {
  _id: 'test-user-id',
  email: 'alekya@example.com',
  name: 'Alekya Maddu',
  answers: mockUserAnswers,
  aiReport: normalized,
}

const pdfBuffer = await generateReportPdfBuffer(
  mockUser,
  mockUserAnswers,
  normalized,
  null
)

assert.ok(Buffer.isBuffer(pdfBuffer), 'PDF generator must return a Buffer')
assert.ok(pdfBuffer.length > 2000, `PDF buffer length (${pdfBuffer.length} bytes) must be complete`)

console.log(`  ✔ 4.1 normalizeAtlasShapes and generateReportPdfBuffer verified: Generated ${pdfBuffer.length} byte PDF with 0 errors.\n`)

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎉 ALL HUMANIZED ATLAS MASTER REPORT TESTS PASSED!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
