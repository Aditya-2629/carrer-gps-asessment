import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('--- TEST 1: Resume Summary Optimization Sanitizer and Validator ---')

import { sanitizeModeCOutput } from '../agents/resume/orchestration/modeC_hybrid.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'

// Test case 1A: LLM outputs valid summaryOptimization
const mockOutputWithSummary = {
  overallReview: { summary: 'Strong engineering background.' },
  grades: { atsReadability: { score: 85, rationale: 'Clear layout' } },
  issues: [
    {
      id: 'iss_1',
      category: 'weak_verb',
      severity: 'medium',
      title: 'Vague verb in bullet',
      location: 'exp_001_b01',
      evidence: 'Helped build backend APIs',
      whyItMatters: 'Lacks ownership and scale proof',
      recommendation: {
        action: 'Lead with architecture verb',
        example: 'Architected RESTful microservices reducing latency by 35%'
      }
    }
  ],
  strengths: [
    { id: 'str_1', title: 'Strong metrics', description: 'Quantified outcomes across roles' }
  ],
  summaryOptimization: {
    status: 'needs_rewrite',
    currentSummary: 'Results-driven engineer looking for a role.',
    diagnosis: 'Current summary is generic and does not highlight your distributed systems experience.',
    rewrittenSummary: 'Senior Software Engineer with 5+ years of experience specializing in high-throughput cloud platforms. Led architectural redesigns driving 40% latency reductions across distributed microservices. Proficient in Node.js, Go, Kubernetes, and event-driven architecture.'
  }
}

const sanitized = sanitizeModeCOutput(mockOutputWithSummary, { targetRole: 'Senior Cloud Engineer' })
assert(sanitized.summaryOptimization, 'summaryOptimization must exist on sanitized output')
assert.strictEqual(sanitized.summaryOptimization.status, 'needs_rewrite')
assert(sanitized.summaryOptimization.rewrittenSummary.includes('Senior Cloud Engineer') || sanitized.summaryOptimization.rewrittenSummary.includes('Software Engineer'))
console.log('✓ sanitizeModeCOutput preserves LLM summaryOptimization')

// Test case 1B: Fallback when LLM omits summaryOptimization
const mockOutputNoSummary = {
  overallReview: { summary: 'Senior developer.' },
  grades: {},
  issues: [],
  strengths: ['Great experience in Node.js']
}
const sanitizedFallback = sanitizeModeCOutput(mockOutputNoSummary, { targetRole: 'Staff AI Engineer' })
assert(sanitizedFallback.summaryOptimization, 'summaryOptimization fallback must be generated')
assert.strictEqual(sanitizedFallback.summaryOptimization.status, 'missing')
assert(sanitizedFallback.summaryOptimization.rewrittenSummary.length > 50, 'Fallback rewrittenSummary must be substantive')
console.log('✓ sanitizeModeCOutput generates clean fallback summaryOptimization')

// Test with ResumeAgentValidator
const validated = ResumeAgentValidator.validate(sanitized, { targetRole: 'Senior Cloud Engineer' })
assert(validated.sanitizedAnalysis.summaryOptimization, 'ResumeAgentValidator must preserve summaryOptimization')
assert.strictEqual(validated.sanitizedAnalysis.summaryOptimization.status, 'needs_rewrite')
console.log('✓ ResumeAgentValidator preserves summaryOptimization')

console.log('\n--- TEST 2: LinkedIn Copywriting Prompt & Fallback Assertions ---')
import {
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT,
  TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT
} from '../agents/linkedin/linkedinSynthesis.prompt.js'

assert(TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('NEVER copy-paste resume bullets'), 'Prompt must forbid copying resume bullets into aboutRewrite')
assert(TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT.includes('3 thematic domain pillars'), 'Prompt must instruct 3 thematic domain pillars')
assert(TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT.includes('Role Mandate:'), 'Task 2 prompt must instruct Role Mandate')
assert(TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT.includes('projectShowcases'), 'Task 2 schema must include projectShowcases')
console.log('✓ Task 1 and Task 2 prompts enforce non-copying executive copywriting')

import { synthesizeLinkedInOptimizations } from '../agents/linkedin/linkedinSynthesis.js'

const testProfile = {
  id: 'test-user',
  fullName: 'Alex Morgan',
  headline: 'Software Engineer at Acme Corp',
  about: 'I am a software engineer.',
  experiences: [{ company: 'Acme Corp', title: 'Software Engineer', description: 'Worked on backend services.' }],
  skills: ['Node.js', 'PostgreSQL', 'Docker'],
  projects: [{ title: 'Legacy Project', description: 'Old project' }]
}

const testResume = {
  canonicalResume: {
    candidate: { name: 'Alex Morgan', targetRole: 'Senior Backend Engineer' },
    skills: ['Node.js', 'Go', 'Docker', 'Kubernetes', 'Redis', 'PostgreSQL', 'Kafka'],
    experience: [
      {
        company: 'Acme Corp',
        role: 'Senior Backend Engineer',
        dates: '2021 - Present',
        bullets: [
          'Architected high-throughput message bus handling 2.5M events/sec with 99.99% availability.',
          'Reduced API latency by 45% by deploying distributed Redis caching.'
        ]
      }
    ],
    projects: [
      {
        title: 'Distributed Log Engine',
        technologies: ['Go', 'Kafka', 'Docker'],
        bullets: ['Built real-time log ingestion engine streaming 50k logs/sec with sub-second indexing.']
      }
    ]
  },
  targetRole: 'Senior Backend Engineer'
}

// Test deterministic fallback
const fallbackSynthesis = await synthesizeLinkedInOptimizations(testProfile, testResume, [], [], null, { bypassAI: true })
assert(fallbackSynthesis.aboutRewrite.proof.includes('▸ System Architecture & Scale:'), 'Fallback about proof must use domain pillars')
assert(!fallbackSynthesis.aboutRewrite.proof.includes('• Senior Backend Engineer at Acme Corp:'), 'Fallback about proof must not dump resume bullets')
console.log('✓ Fallback aboutRewrite.proof uses 3 domain pillars, no raw bullet dumps')

assert(fallbackSynthesis.sectionsToAddFromResume.projects[0].description.includes('Go, Kafka, Docker'), 'Fallback project pitch must use project true stack')
console.log('✓ Fallback sectionsToAddFromResume.projects creates clean project copy around true tech stack')

console.log('\n--- TEST 3: Orchestrator Cache Key Bumps ---')
const orchestratorContent = fs.readFileSync(path.resolve(__dirname, '../agents/orchestrator.js'), 'utf8')
assert(orchestratorContent.includes('resume_v7:'), 'Orchestrator must use resume_v7 cache key')
assert(orchestratorContent.includes('linkedin_v7:'), 'Orchestrator must use linkedin_v7 cache key')
console.log('✓ Orchestrator cache keys bumped to resume_v7 and linkedin_v7')

console.log('\nALL EMPIRICAL TESTS PASSED SUCCESSFULLY! 🎉')
