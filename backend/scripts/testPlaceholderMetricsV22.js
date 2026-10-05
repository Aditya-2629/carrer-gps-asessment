import assert from 'assert'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'
import { PROMPT_VERSION, buildResumeAgentSystemPrompt } from '../agents/resume/resumeAgent.prompt.js'

console.log('--- 1. Testing PROMPT_VERSION & Prompt Content ---')
assert(PROMPT_VERSION === 'resume-expert-v2.2' || PROMPT_VERSION === 'resume-expert-v2.3', 'PROMPT_VERSION must be resume-expert-v2.2 or resume-expert-v2.3')
const systemPrompt = buildResumeAgentSystemPrompt()
assert(systemPrompt.includes('PLACEHOLDER METRIC BAN (EXPANDED)'), 'System prompt has expanded placeholder ban')
assert(systemPrompt.includes('migrated 150+ shared components'), 'System prompt includes 150+ example')
assert(systemPrompt.includes('reduced bundle size by 2MB'), 'System prompt includes 2MB example')
assert(systemPrompt.includes('cut defects by 15'), 'System prompt includes cut defects by 15 example')
assert(systemPrompt.includes('4. Avoided inventing facts, invented metric categories, AND concrete-looking fabricated numbers/examples'), 'Self-check item 4 updated')
console.log('PASS: Prompt content and version verified.')

console.log('\n--- 2. Testing detectPlaceholderMetricSuggestions with Known Bad Samples ---')
const badAnalysis = {
  issues: [
    {
      id: 'iss_001',
      evidence: { bulletId: 'exp_001_b04', originalText: 'Identified and prioritized technical debt across core customer workflows.' },
      recommendation: 'consider rephrasing to highlight the scope (e.g., "migrated 150+ shared components")',
      correctedText: 'Refactored technical debt across core workflows.',
    },
    {
      id: 'iss_002',
      evidence: { bulletId: 'exp_001_b04', originalText: 'Identified and prioritized technical debt across core customer workflows.' },
      recommendation: 'reduced bundle size by 2MB',
      correctedText: null,
    },
    {
      id: 'iss_003',
      evidence: { bulletId: 'exp_001_b04', originalText: 'Identified and prioritized technical debt across core customer workflows.' },
      recommendation: 'cut defects by 15',
      correctedText: null,
    },
    {
      id: 'iss_004',
      evidence: { bulletId: 'exp_001_b04', originalText: 'Identified and prioritized technical debt across core customer workflows.' },
      recommendation: 'Add metrics (e.g., % reduction in mean time to resolution)',
      correctedText: null,
    },
  ],
  priorityActions: [
    {
      order: 1,
      issueId: 'iss_001',
      action: 'Migrate 50 services to cloud infrastructure',
    }
  ]
}

const badResults = ResumeAgentValidator.detectPlaceholderMetricSuggestions(badAnalysis)
console.log('Bad results detected count:', badResults.length)
for (const r of badResults) {
  console.log(`  [${r.code}] ${r.field}: token="${r.token || ''}" claim="${r.claim}" (issue: ${r.issueId})`)
}

// iss_001 -> 150+
const has150 = badResults.some((r) => r.code === 'fabricated_number_in_recommendation' && r.token === '150+' && r.issueId === 'iss_001')
assert(has150, 'Detected fabricated token 150+ in iss_001 recommendation')

// iss_002 -> 2MB
const has2MB = badResults.some((r) => r.code === 'fabricated_number_in_recommendation' && r.token === '2MB' && r.issueId === 'iss_002')
assert(has2MB, 'Detected fabricated token 2MB in iss_002 recommendation')

// iss_003 -> 15
const has15 = badResults.some((r) => r.code === 'fabricated_number_in_recommendation' && r.token === '15' && r.issueId === 'iss_003')
assert(has15, 'Detected fabricated token 15 in iss_003 recommendation')

// iss_004 -> placeholder category
const hasPlaceholderCat = badResults.some((r) => r.code === 'placeholder_metric_category_not_in_evidence' && r.issueId === 'iss_004')
assert(hasPlaceholderCat, 'Detected placeholder category in iss_004 recommendation')

// priorityActions -> 50
const has50InPA = badResults.some((r) => r.code === 'fabricated_number_in_recommendation' && r.token === '50' && r.field.includes('priorityActions[0]'))
assert(has50InPA, 'Detected fabricated token 50 in priorityActions[0].action')
console.log('PASS: All bad samples flagged accurately.')

console.log('\n--- 3. Testing detectPlaceholderMetricSuggestions with Clean Output ---')
const cleanAnalysis = {
  issues: [
    {
      id: 'iss_001',
      evidence: { bulletId: 'exp_001_b04', originalText: 'Mentored 4 mid-level software engineers through structured weekly design reviews.' },
      recommendation: 'If you tracked a result here, add it — even an approximate one helps.',
      correctedText: 'Mentored 4 mid-level software engineers through weekly design reviews.',
    },
    {
      id: 'iss_002',
      evidence: { bulletId: 'exp_001_b04', originalText: 'Mentored 4 mid-level software engineers through structured weekly design reviews.' },
      recommendation: 'Focus on the 4 engineers you mentored and clarify if promotions resulted.',
      correctedText: null,
    },
    {
      id: 'iss_003',
      evidence: { bulletId: 'exp_002_b01', originalText: 'Built real-time transaction reconciliation dashboard in React, TypeScript, and Node.js serving 250,000 monthly active retail users.' },
      recommendation: 'The 250,000 active user count demonstrates great scale; highlight your architectural decisions.',
      correctedText: null,
    }
  ],
  priorityActions: [
    {
      order: 1,
      issueId: 'iss_001',
      action: 'Document the outcomes achieved with the 4 mentored engineers.',
    }
  ]
}

const cleanResults = ResumeAgentValidator.detectPlaceholderMetricSuggestions(cleanAnalysis)
console.log('Clean results count (must be 0):', cleanResults.length)
assert.strictEqual(cleanResults.length, 0, 'Clean output must produce zero placeholder / fabricated number warnings')
console.log('PASS: Clean output produced 0 warnings.')

console.log('\n--- 4. Testing that correctedText is NOT flagged by detectPlaceholderMetricSuggestions ---')
const correctedTextAnalysis = {
  issues: [
    {
      id: 'iss_001',
      evidence: { bulletId: 'exp_001_b01', originalText: 'Telemetry ingestion engine in Go and Kafka.' },
      recommendation: 'State what technologies were used.',
      correctedText: 'Migrated 100 components to microservices.', // would be caught by correctedText traceability, NOT placeholder metric check
    }
  ],
  priorityActions: []
}
const correctedTextResults = ResumeAgentValidator.detectPlaceholderMetricSuggestions(correctedTextAnalysis)
assert.strictEqual(correctedTextResults.length, 0, 'correctedText is not checked by detectPlaceholderMetricSuggestions')
console.log('PASS: correctedText scoped away from detectPlaceholderMetricSuggestions.')

console.log('\n========================================')
console.log('ALL V2.2 PATCH UNIT TESTS PASSED!')
console.log('========================================\n')
