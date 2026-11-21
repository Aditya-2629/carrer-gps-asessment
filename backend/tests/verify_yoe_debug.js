import assert from 'node:assert'
import { LINKEDIN_AGENT } from '../agents/core/agentContract.js'
import { LINKEDIN_AGENT_VERSION } from '../agents/linkedin/linkedinAgent.js'
import { buildTask1HeadlinesAndBannerPrompt } from '../agents/linkedin/linkedinSynthesis.prompt.js'
import { synthesizeLinkedInOptimizations } from '../agents/linkedin/linkedinSynthesis.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'

console.log('--- TEST 1: Agent Version Bump Check ---')
assert.strictEqual(LINKEDIN_AGENT.version, '4.1.0-v2', 'LINKEDIN_AGENT.version must be bumped')
assert.strictEqual(LINKEDIN_AGENT_VERSION, '4.1.0-v2', 'LINKEDIN_AGENT_VERSION must be bumped')
console.log('PASS: LINKEDIN_AGENT version is 4.1.0-v2 (stale MongoDB caches invalidated).')

console.log('--- TEST 2: LinkedIn Prompt Injection of Verified Experience ---')
const mockResumeContext = {
  canonicalResume: {
    totalExperienceYears: 8.4,
    years_of_experience: '8+ years',
    candidate: { name: 'Deepanjan Rane', targetRole: 'Senior Full Stack & AI Engineer' },
    experience: [
      { company: 'Acme', role: 'Software Engineer', dates: 'June 2018 - Present', bullets: ['Engineered scalable APIs.'] },
    ],
  },
  targetRole: 'Senior Full Stack & AI Engineer',
}
const mockProfile = {
  fullName: 'Deepanjan Rane',
  headline: 'Software Engineer',
  about: 'I am a software engineer.',
  experiences: [{ title: 'Software Engineer', company: 'Acme', dates: '2018 - Present' }],
}

const task1Prompt = buildTask1HeadlinesAndBannerPrompt({
  profile: mockProfile,
  resumeContext: mockResumeContext,
  discrepancies: [],
  missingSkills: [],
})

const userPromptContent = task1Prompt[1].content
assert(userPromptContent.includes('VERIFIED TOTAL EXPERIENCE: 8+ years'), 'Prompt must inject VERIFIED TOTAL EXPERIENCE: 8+ years')
assert(userPromptContent.includes('never understate as 3+ or 5+ years when 8+ years is verified'), 'Prompt must instruct never to understate')
console.log('PASS: Prompt includes verified total experience instructions.')

console.log('--- TEST 3: Deterministic Fallback About Section YOE Verification ---')
const fallbackOpts = await synthesizeLinkedInOptimizations(
  mockProfile,
  mockResumeContext,
  [],
  [],
  null,
  { bypassAI: true }
)
console.log('About paragraph 1:', fallbackOpts.aboutRewrite.professionalJourney)
assert(fallbackOpts.aboutRewrite.professionalJourney.includes('8+ years'), 'About must state 8+ years')
assert(!fallbackOpts.aboutRewrite.professionalJourney.includes('5+ years'), 'About must NOT state 5+ years')
console.log('PASS: Fallback About paragraph 1 correctly states 8+ years.')

console.log('--- TEST 4: Normalizer Deepanjan 8+ YOE ---')
const mockRaw = `Deepanjan Rane
Chicago, IL | +1 872-262-6228 | deepanjanrane6@gmail.com
Senior Full Stack & AI Engineer
EXPERIENCE
Senior Software Engineer | Tech Corp | June 2021 - Present
- Architected enterprise cloud systems.
Software Engineer | Startup X | June 2018 - May 2021
- Developed high-throughput microservices.
`
const canonical = ResumeNormalizer.normalize(mockRaw, 'Senior Full Stack & AI Engineer')
console.log('Canonical totalExperienceYears:', canonical.totalExperienceYears)
console.log('Canonical years_of_experience:', canonical.years_of_experience)
assert.strictEqual(canonical.years_of_experience, '8+ years')
assert(canonical.totalExperienceYears >= 8.0)
console.log('PASS: Normalizer computes 8+ years correctly.')

console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!')
