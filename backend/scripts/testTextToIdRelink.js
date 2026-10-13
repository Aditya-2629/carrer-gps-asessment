import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`PASS: ${msg}`)
}

console.log('Testing ResumeAgentValidator self-healing relink with textToIdMap...')

const canonicalResume = {
  header: { name: 'Jane Doe', email: 'jane@example.com' },
  summary: { id: 'summary_001', text: 'Senior Engineer with 8 years of experience building distributed systems.' },
  experience: [
    {
      id: 'exp_001',
      company: 'Tech Corp',
      role: 'Staff Engineer',
      bullets: [
        { id: 'exp_001_b01', text: 'Architected high throughput payment pipeline processing $10M daily.' },
        { id: 'exp_001_b02', text: 'Led a team of 6 engineers across 3 time zones.' },
      ],
    },
  ],
  education: [],
  skills: ['Go', 'Kubernetes'],
}

// Case 1: Model provides wrong bulletId ('exp_001_b999' or 'exp_001_wrong')
// but verbatim matches originalText: 'Architected high throughput payment pipeline processing $10M daily.'
const analysisOutputWithWrongId = {
  analysisVersion: '2.2',
  candidateSnapshot: {
    name: 'Jane Doe',
    targetRole: 'Staff Engineer',
  },
  dashboard: null,
  strengths: ['High impact distributed systems.'],
  overallReview: {
    summary: 'Strong experience across the board.',
    strengths: ['High impact distributed systems.'],
    criticalFlaws: ['Could quantify team metrics.'],
  },
  targetRoleAlignment: {
    targetRole: 'Staff Engineer',
    currentLevelEstimated: 'Staff Engineer',
    alignmentScore: 90,
    gapAnalysis: [],
  },
  priorityActions: [
    { title: 'Action 1', action: 'Expand on payment pipeline architecture.' },
  ],
  issues: [
    {
      id: 'issue_001',
      title: 'Payment pipeline metric phrasing',
      category: 'impact',
      severity: 'medium',
      correctionType: 'rewrite',
      diagnosis: 'The payment pipeline metric could emphasize latency reductions.',
      whyItMatters: 'Demonstrates end-to-end performance.',
      recommendation: 'Highlight latency reductions alongside throughput.',
      evidence: [
        {
          itemId: 'exp_001',
          bulletId: 'exp_001_wrong_hallucinated_id', // WRONG ID
          originalText: 'Architected high throughput payment pipeline processing $10M daily.', // MATCHES EXACTLY
        },
      ],
    },
  ],
}

// Validate should NOT crash with ReferenceError: textToIdMap is not defined
// And should successfully heal/relink or validate the evidence
const result = ResumeAgentValidator.validate(analysisOutputWithWrongId, canonicalResume)

console.log('Result isValid:', result.isValid)
console.log('Errors:', result.errors)
console.log('Evidence Errors:', result.evidenceErrors)
console.log('Warnings:', result.warnings)

assert(result.isValid === true, 'Validator should accept the output when self-healing relink succeeds')
assert(result.errors.length === 0, 'No fatal errors should be reported')
const healedBulletId = result.sanitizedAnalysis.issues[0].evidence[0].bulletId
assert(healedBulletId === 'exp_001_b01', `Self-healing relink correctly fixed bulletId to exp_001_b01 (got: ${healedBulletId})`)

console.log('ALL textToIdMap RELINK TESTS PASSED!')
