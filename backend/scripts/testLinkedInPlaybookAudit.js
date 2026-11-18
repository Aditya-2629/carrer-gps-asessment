import assert from 'assert'
import { evaluateLinkedIn, analyzeLinkedInProfile } from '../agents/linkedin/index.js'
import { computeLinkedInScorecard } from '../agents/linkedin/linkedinScorecard.js'
import { extractLinkedInSignals } from '../agents/linkedin/linkedinSignalEngine.js'
import { buildDeterministicOptimizations, buildCategorizedSkillsBank } from '../agents/linkedin/linkedinSynthesis.js'
import { extractLinkedInActivitySignals } from '../agents/linkedin/linkedinActivityEngine.js'

console.log('================================================================')
console.log('TEST SUITE: SHRADDHA LINKEDIN AUDIT PLAYBOOK & SECTION AUDIT')
console.log('================================================================\n')

// ── Test 1: Sparse Student Profile /10 Audit ──────────────────────────────
console.log('--- Test 1: Sparse Student Profile /10 Audit ---')
const studentProfile = {
  fullName: 'Alex Student',
  headline: 'Student at State University | Looking for opportunities',
  about: 'Hi, I am a student interested in tech. Contact me for roles.',
  experiences: [],
  skills: ['C++', 'Java', 'Python'],
  connectionsCount: 85,
  recommendationsCount: 0,
  featured: [],
}

const studentSignals = extractLinkedInSignals(studentProfile, { targetRole: 'Cloud Architect' })
const studentScorecard = computeLinkedInScorecard(studentSignals, null, 'Cloud Architect', null)

assert(studentScorecard.sectionAudit, 'sectionAudit must be defined on scorecard')
const sAudit = studentScorecard.sectionAudit

console.log('Student Headline /10:', sAudit.headline.score10, '| Hurting:', sAudit.headline.hurtingReason)
assert.strictEqual(sAudit.headline.score10, 1, 'Headline must score 1/10 for student/seeking headline')
assert.strictEqual(sAudit.headline.status, 'fail', 'Headline status must be fail')
assert(sAudit.headline.hurtingReason.includes('student status'), 'Headline hurtingReason must flag student status')

console.log('Student About /10:', sAudit.about.score10, '| Hurting:', sAudit.about.hurtingReason)
assert.strictEqual(sAudit.about.score10, 2, 'About must score 2/10 for < 150 chars')
assert.strictEqual(sAudit.about.status, 'fail', 'About status must be fail')
assert(sAudit.about.hurtingReason.includes('< 150 characters'), 'About hurtingReason must flag < 150 characters')

console.log('Student Featured /10:', sAudit.featured.score10, '| Hurting:', sAudit.featured.hurtingReason)
assert.strictEqual(sAudit.featured.score10, 0, 'Featured must score 0/10 for empty featured section')
assert.strictEqual(sAudit.featured.status, 'fail', 'Featured status must be fail')
assert(sAudit.featured.hurtingReason.includes('empty'), 'Featured hurtingReason must note empty section')

console.log('Student Skills /10:', sAudit.skills.score10, '| Hurting:', sAudit.skills.hurtingReason)
assert(sAudit.skills.score10 <= 4, 'Skills must be penalized for < 15 skills')
assert.strictEqual(sAudit.skills.status, 'fail', 'Skills status must be fail')
assert(sAudit.skills.hurtingReason.includes('Listing under 15 skills'), 'Skills hurtingReason must flag < 15 skills')

console.log('Student Activity /10:', sAudit.activityAndNetworking.score10, '| Hurting:', sAudit.activityAndNetworking.hurtingReason)
assert(sAudit.activityAndNetworking.score10 <= 4, 'Activity & Networking must score <= 4 for < 500 connections & no activity')
assert.strictEqual(sAudit.activityAndNetworking.status, 'fail')
console.log('✔ Test 1 Passed: Sparse student profile receives strict /10 penalties and explicit hurting reasons.\n')

// ── Test 2: Non-Tech Dynamic Prompts & Visual Prompts ───────────────────────
console.log('--- Test 2: Non-Tech Profile (Clinical / Nurse) Dynamic Prompts ---')
const nurseResumeContext = {
  targetRole: 'Clinical Nurse Manager',
  canonicalResume: {
    candidate: { name: 'Sarah Jenkins', targetRole: 'Clinical Nurse Manager' },
    years_of_experience: 8,
    skills: [{ name: 'Patient Triage' }, { name: 'Epic Systems' }, { name: 'Care Coordination' }, { name: 'HIPAA' }],
    experience: [
      {
        company: 'Mercy General Hospital',
        role: 'Charge Nurse',
        bullets: ['Supervised 24-bed telemetry unit reducing medication errors by 35% through standardized barcode scanning.'],
      },
    ],
    projects: [
      {
        title: 'Telemetry Safety Protocol',
        description: 'Standardized barcode medication scanning reducing documentation errors by 35%.',
      },
    ],
  },
}

const nurseOpts = buildDeterministicOptimizations({}, nurseResumeContext)

assert(nurseOpts.visualPrompts, 'visualPrompts must exist on optimizations')
console.log('Profile Picture Prompt:\n', nurseOpts.visualPrompts.profilePicturePrompt)
assert(nurseOpts.visualPrompts.profilePicturePrompt.includes('Clinical Nurse Manager'), 'PFP prompt must include candidate targetRole')
assert(nurseOpts.visualPrompts.profilePicturePrompt.includes('studio butterfly lighting'), 'PFP prompt must specify studio lighting')

console.log('\nCover Banner Prompt:\n', nurseOpts.visualPrompts.coverBannerPrompt)
assert(nurseOpts.visualPrompts.coverBannerPrompt.includes('Clinical Nurse Manager'), 'Banner prompt must include Clinical Nurse Manager')
assert(nurseOpts.visualPrompts.coverBannerPrompt.includes('1584x396 px'), 'Banner prompt must specify LinkedIn dimensions')
assert(nurseOpts.visualPrompts.coverBannerPrompt.includes('35%'), 'Banner prompt must include verified 35% error reduction metric')
assert(nurseOpts.visualPrompts.bannerShowcaseOptions.length === 3, 'Must provide 3 banner layout directions')

console.log('\nCategorized Skills Bank:')
const skillsBank = nurseOpts.categorizedSkills || buildCategorizedSkillsBank(['Patient Triage', 'Epic Systems', 'Care Coordination'], 'Clinical Nurse Manager')
console.log('Tools:', skillsBank.toolsAndPlatforms.length, '| Core:', skillsBank.coreFunctional.length, '| Industry:', skillsBank.industrySpecific.length, '| Transferable:', skillsBank.transferable.length, '| Total:', skillsBank.totalCount)
assert(skillsBank.totalCount >= 40, `Skills bank must have >= 40 categorized skills (got ${skillsBank.totalCount})`)
assert(skillsBank.industrySpecific.some(s => s.includes('HIPAA') || s.includes('Patient Safety')), 'Nurse industry skills must include clinical standards')
console.log('✔ Test 2 Passed: Non-tech candidate receives authentic, metric-grounded visual prompts and 40+ categorized skills.\n')

// ── Test 3: OutFox Recommendation Activation ──────────────────────────────
console.log('--- Test 3: OutFox Recommendation Activation Logic ---')
const ghostActivityData = {
  available: true,
  isGhostProfile: true,
  posts: [],
  comments: [],
}

const ghostSignals = extractLinkedInActivitySignals(ghostActivityData, 'Cloud Architect', ['AWS', 'Docker'])
assert(ghostSignals.networkingRecommendation, 'networkingRecommendation must be present on activity signals')
console.log('Ghost OutFox Recommendation:\n', ghostSignals.networkingRecommendation)
assert.strictEqual(ghostSignals.networkingRecommendation.isRecommended, true, 'OutFox must be recommended for ghost profile')
assert(ghostSignals.networkingRecommendation.recommendation.includes('OutFox'), 'Recommendation must mention OutFox')
assert(ghostSignals.networkingRecommendation.flags.isDormant, 'Dormant flag must be true')

// Test active profile where OutFox is NOT recommended
const activeActivityData = {
  available: true,
  isGhostProfile: false,
  posts: [
    { text: 'Deep dive into distributed systems and socket pooling in high-scale architectures.', postedAt: Date.now() - 2 * 86400000 },
    { text: 'Benchmark comparison of query execution plans and index selectivity.', postedAt: Date.now() - 9 * 86400000 },
    { text: 'Architectural lessons from operating multi-region failover clusters.', postedAt: Date.now() - 16 * 86400000 },
  ],
  comments: [
    { text: 'Great breakdown of connection pool starvation! We saw similar p99 latency spikes until configuring TCP keep-alive timeouts.' },
    { text: 'Have you benchmarked memory consumption between jemalloc and standard glibc malloc under 50k concurrent websockets?' },
  ],
}

const activeSignals = extractLinkedInActivitySignals(activeActivityData, 'Cloud Architect', ['AWS', 'Docker'])
console.log('Active Profile OutFox isRecommended:', activeSignals.networkingRecommendation.isRecommended)
assert.strictEqual(activeSignals.networkingRecommendation.isRecommended, false, 'OutFox should NOT be recommended for active candidate with substantive discussions')
console.log('✔ Test 3 Passed: OutFox triggers accurately only when posting/networking is low or generic.\n')

// ── Test 4: Full evaluateLinkedIn Integration with Section Audit & Prompts ───
console.log('--- Test 4: Full evaluateLinkedIn Integration Test ---')
const evaluated = await evaluateLinkedIn({
  profile: studentProfile,
  activityData: ghostActivityData,
  resumeContext: nurseResumeContext,
  runLlm: false,
})

assert(evaluated.sectionAudit, 'evaluateLinkedIn result must contain sectionAudit')
assert.strictEqual(typeof evaluated.sectionAudit.headline.score10, 'number', 'sectionAudit.headline must have score10')
assert(evaluated.visualPrompts, 'evaluateLinkedIn result must contain visualPrompts')
assert(evaluated.visualPrompts.profilePicturePrompt, 'visualPrompts must contain profilePicturePrompt')
assert(evaluated.visualPrompts.coverBannerPrompt, 'visualPrompts must contain coverBannerPrompt')
assert(evaluated.networkingRecommendation, 'evaluateLinkedIn result must contain networkingRecommendation')
assert.strictEqual(evaluated.networkingRecommendation.isRecommended, true, 'OutFox must be recommended in full pipeline for student/ghost')

console.log('Full Pipeline Section Audit Scores:')
for (const [key, audit] of Object.entries(evaluated.sectionAudit)) {
  console.log(`  - ${audit.label}: ${audit.score10}/10 [${audit.status}] ${audit.hurtingReason ? `(${audit.hurtingReason.slice(0, 45)}…)` : '✔'}`)
}

console.log('\n================================================================')
console.log('ALL SHRADDHA LINKEDIN PLAYBOOK AUDIT & PROMPT TESTS PASSED! 🚀')
console.log('================================================================')
