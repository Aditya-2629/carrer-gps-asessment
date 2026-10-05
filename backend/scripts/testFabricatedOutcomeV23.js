import assert from 'assert'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'
import { PROMPT_VERSION, buildResumeAgentSystemPrompt } from '../agents/resume/resumeAgent.prompt.js'

console.log('=== CAREER GPS V2.3 TEST: FABRICATED OUTCOMES & PROMPT VALIDATION ===\n')

// ---------------------------------------------------------------------------
// 1. Verify PROMPT_VERSION and Prompt Text Updates
// ---------------------------------------------------------------------------
console.log('--- 1. Testing PROMPT_VERSION & Prompt Content ---')
assert.strictEqual(PROMPT_VERSION, 'resume-expert-v2.3', 'PROMPT_VERSION must be resume-expert-v2.3')

const systemPrompt = buildResumeAgentSystemPrompt()
assert(
  systemPrompt.includes('RECOMMENDATION FIELD — CATEGORY INVENTION (STRICT)'),
  'System prompt includes strengthened RECOMMENDATION FIELD — CATEGORY INVENTION (STRICT) section'
)
assert(
  systemPrompt.includes('When suggesting what kind of result to add, you may name AT MOST the categories that are already implied'),
  'System prompt includes category invention strict rule'
)
assert(
  systemPrompt.includes('Before finalizing ANY correctedText, perform this word-by-word check'),
  'System prompt includes correctedText word-by-word re-check'
)
assert(
  systemPrompt.includes('list every claim, adjective, or outcome phrase in your correctedText that describes a RESULT or BENEFIT'),
  'System prompt specifies outcome phrase check'
)
assert(
  systemPrompt.includes('built X that improved performance'),
  'System prompt includes built X -> improved performance example'
)
console.log('PASS: Prompt version and text additions verified.\n')

// ---------------------------------------------------------------------------
// 2. Testing detectFabricatedOutcomeInCorrectedText with Bad Samples
// ---------------------------------------------------------------------------
console.log('--- 2. Testing detectFabricatedOutcomeInCorrectedText with Bad Samples ---')

const badAnalysis = {
  issues: [
    {
      id: 'iss_001',
      evidence: {
        bulletId: 'exp_001_b01',
        originalText: 'Built appointment booking service in React and Node.js for client accounts.',
      },
      recommendation: 'If you tracked a result here, add it — even an approximate one helps.',
      correctedText: 'Built appointment scheduling system in React and Node.js, enabled faster appointment booking.',
    },
    {
      id: 'iss_002',
      evidence: {
        bulletId: 'exp_001_b02',
        originalText: 'Maintained and deployed microservices to Kubernetes cluster.',
      },
      recommendation: 'If you tracked a result here, add it.',
      correctedText: 'Maintained microservices on Kubernetes that improved system reliability.',
    },
    {
      id: 'iss_003',
      evidence: {
        bulletId: 'exp_001_b03',
        originalText: 'Refactored checkout component structure using React hooks.',
      },
      recommendation: 'Add metrics if available.',
      correctedText: 'Refactored checkout components for a smoother user experience.',
    },
    {
      id: 'iss_004',
      evidence: {
        bulletId: 'exp_001_b04',
        originalText: 'Participated in agile ceremonies and sprint planning sessions.',
      },
      recommendation: 'Add scope if tracked.',
      correctedText: 'Led sprint planning sessions, resulting in streamlined workflow.',
    },
  ],
}

const badResults = ResumeAgentValidator.detectFabricatedOutcomeInCorrectedText(badAnalysis)
console.log(`Bad results detected count: ${badResults.length}`)
for (const r of badResults) {
  console.log(`  [${r.code}] ${r.field}: keyword="${r.keyword}" phrase="${r.phrase}" (issue: ${r.issueId})`)
}

// iss_001 should flag "enabled" and/or "faster"
const iss001Flags = badResults.filter((r) => r.issueId === 'iss_001')
assert(iss001Flags.length >= 1, 'iss_001 flagged for fabricated outcome')
assert(
  iss001Flags.some((r) => r.keyword === 'faster' || r.keyword === 'enabled'),
  'iss_001 detected ungrounded keyword faster/enabled'
)
assert(
  iss001Flags.some((r) => r.phrase.includes('appointment booking') || r.phrase.includes('faster')),
  'iss_001 includes specific outcome phrase'
)

// iss_002 should flag "improved"
const iss002Flags = badResults.filter((r) => r.issueId === 'iss_002')
assert(iss002Flags.some((r) => r.keyword === 'improved'), 'iss_002 flagged for ungrounded improved')

// iss_003 should flag "smoother"
const iss003Flags = badResults.filter((r) => r.issueId === 'iss_003')
assert(iss003Flags.some((r) => r.keyword === 'smoother'), 'iss_003 flagged for ungrounded smoother')

// iss_004 should flag "streamlined"
const iss004Flags = badResults.filter((r) => r.issueId === 'iss_004')
assert(iss004Flags.some((r) => r.keyword === 'streamlined'), 'iss_004 flagged for ungrounded streamlined')

console.log('PASS: All bad outcome samples flagged accurately.\n')

// ---------------------------------------------------------------------------
// 3. Testing detectFabricatedOutcomeInCorrectedText with Grounded / Clean Output
// ---------------------------------------------------------------------------
console.log('--- 3. Testing detectFabricatedOutcomeInCorrectedText with Grounded / Clean Output ---')

const cleanAnalysis = {
  issues: [
    {
      id: 'iss_101',
      evidence: {
        bulletId: 'exp_001_b01',
        originalText: 'Automated multi-region AWS infrastructure using Terraform and GitHub Actions, cutting production deployment lead time from 4 hours to 18 minutes.',
      },
      recommendation: 'Highlight the automation tooling earlier in the bullet.',
      correctedText: 'Automated AWS infrastructure with Terraform and GitHub Actions, reducing deployment time from 4 hours to 18 minutes.',
    },
    {
      id: 'iss_102',
      evidence: {
        bulletId: 'exp_001_b02',
        originalText: 'Reduced PostgreSQL p99 query latency by 58% by restructuring composite B-tree indexes and implementing Redis read-aside caching.',
      },
      recommendation: 'Lead with the index optimization approach.',
      correctedText: 'Restructured composite B-tree indexes with Redis caching, reducing PostgreSQL p99 query latency by 58%.',
    },
    {
      id: 'iss_103',
      evidence: {
        bulletId: 'exp_001_b03',
        originalText: 'Authored comprehensive Jest and Cypress test suites, elevating code coverage from 61% to 89%.',
      },
      recommendation: 'Streamline the testing tooling description.',
      correctedText: 'Authored Jest and Cypress test suites, increasing code coverage from 61% to 89%.',
    },
    {
      id: 'iss_104',
      evidence: {
        bulletId: 'exp_001_b04',
        originalText: 'Mentored 4 mid-level software engineers through structured weekly design reviews and system architecture teardowns.',
      },
      recommendation: 'If you tracked a result here, add it — even an approximate one helps.',
      correctedText: 'Mentored 4 mid-level software engineers through weekly design reviews and architecture teardowns.',
    },
    {
      id: 'iss_105',
      evidence: {
        bulletId: 'exp_001_b05',
        originalText: 'Designed real-time transaction reconciliation dashboard in React and TypeScript.',
      },
      recommendation: 'If you tracked a result here, add it — even an approximate one helps.',
      correctedText: null,
    },
  ],
}

const cleanResults = ResumeAgentValidator.detectFabricatedOutcomeInCorrectedText(cleanAnalysis)
console.log(`Clean results count (must be 0): ${cleanResults.length}`)
for (const r of cleanResults) {
  console.log(`  Unexpected flag: [${r.code}] ${r.field}: keyword="${r.keyword}" (issue: ${r.issueId})`)
}
assert.strictEqual(cleanResults.length, 0, 'Clean grounded output produced 0 warnings')
console.log('PASS: Grounded and neutral rewrites pass without warnings.\n')

// ---------------------------------------------------------------------------
// 4. Testing Full Validation Flow (ResumeAgentValidator.validate)
// ---------------------------------------------------------------------------
console.log('--- 4. Testing Full ResumeAgentValidator.validate Integration ---')

const canonicalResume = {
  candidate: { name: 'Alex Mercer' },
  experience: [
    {
      id: 'exp_001',
      bullets: [
        {
          id: 'exp_001_b01',
          text: 'Built appointment booking service in React and Node.js for client accounts.',
        },
      ],
    },
  ],
}

const mockAnalysisWithFabricatedOutcome = {
  analysisVersion: '2.1',
  candidateSnapshot: {
    name: 'Alex Mercer',
    targetRole: 'Full Stack Engineer',
    experienceLevel: 'Mid-Level',
    primaryProfile: 'Full Stack',
  },
  dashboard: {
    score: null,
    dimensions: { impact: null, clarity: null, positioning: null, structure: null },
  },
  overallReview: 'Great background in React and Node.js.',
  strengths: [
    {
      id: 'str_001',
      title: 'Full stack development',
      signal: 'Built backend and frontend services',
      evidence: {
        section: 'experience',
        itemId: 'exp_001',
        bulletId: 'exp_001_b01',
        originalText: 'Built appointment booking service in React and Node.js for client accounts.',
      },
    },
  ],
  issues: [
    {
      id: 'iss_001',
      severity: 'medium',
      category: 'impact',
      title: 'Missing measurable outcome',
      evidence: {
        section: 'experience',
        itemId: 'exp_001',
        bulletId: 'exp_001_b01',
        originalText: 'Built appointment booking service in React and Node.js for client accounts.',
      },
      diagnosis: 'The bullet describes what was built but not what resulted.',
      whyItMatters: 'Recruiters want to see the effect of your engineering work.',
      recommendation: 'If you tracked a result here, add it — even an approximate one helps.',
      correctedText: 'Built appointment scheduling system in React and Node.js, enabled faster appointment booking.',
      correctionType: 'rewrite',
      confidence: 0.9,
    },
  ],
  priorityActions: [
    {
      order: 1,
      title: 'Clarify appointment booking impact',
      action: 'If you tracked a result here, add it — even an approximate one helps.',
      impact: 'High',
    },
  ],
  metadata: { provider: 'test', model: 'test', latencyMs: 10 },
}

const valResult = ResumeAgentValidator.validate(mockAnalysisWithFabricatedOutcome, canonicalResume)

assert(valResult.isValid === true, 'Validator remains valid (treated as monitoring signal, not hard block)')
assert(valResult.fabricatedOutcomeWarnings.length > 0, 'fabricatedOutcomeWarnings has entries')
assert(
  valResult.warnings.some((w) => w.includes('fabricated_outcome_in_corrected_text')),
  'Warnings array contains fabricated_outcome_in_corrected_text warning'
)
console.log('PASS: Full ResumeAgentValidator.validate produces monitoring warnings as expected.\n')

console.log('========================================')
console.log('ALL V2.3 VALIDATOR & PROMPT TESTS PASSED!')
console.log('========================================')
