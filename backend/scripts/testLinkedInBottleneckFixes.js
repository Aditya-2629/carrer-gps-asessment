/**
 * testLinkedInBottleneckFixes.js
 * 
 * Verifies all 7 fixes for LinkedIn bottlenecks:
 * 1. "500+" connections parsing and 0 visibility penalty
 * 2. Non-SWE domain headlines (Registered Nurse, Financial Analyst) without Cloud Architecture bias
 * 3. Modern data warehouse tools (Snowflake, BigQuery, dbt) retained for Software Engineers
 * 4. Timeline year-boundary resilience (Jan 2024 vs Dec 2023: no false timeline_drift)
 * 5. Normalized scorecard floor cap (minFloor 75 when branding & completeness >= 85/80)
 * 6. Skeleton / private profile graceful inference without false role omissions
 */

import assert from 'assert'
import { extractLinkedInSignals } from '../agents/linkedin/linkedinSignalEngine.js'
import { computeLinkedInScorecard } from '../agents/linkedin/linkedinScorecard.js'
import { buildDeterministicOptimizations } from '../agents/linkedin/linkedinSynthesis.js'
import { analyzeCrossAgentDiscrepancies } from '../agents/linkedin/linkedinCrossAnalyzer.js'
import { resolveEffectiveProfile, inferProfileFromResume } from '../agents/linkedin/linkedinAgent.js'

console.log('================================================================')
console.log('RUNNING LINKEDIN BOTTLENECK FIXES VERIFICATION')
console.log('================================================================\n')

// -----------------------------------------------------------------
// 1. "500+" Connections Parsing & Zero Visibility Penalty
// -----------------------------------------------------------------
console.log('--- Test 1: "500+" Connections String Parsing & Visibility Score ---')
const profileWith500Plus = {
  isValid: true,
  fullName: 'Jordan Smith',
  headline: 'Senior Software Engineer | Python | Distributed Systems',
  about: 'Experienced software engineer.',
  experiences: [{ title: 'SWE', company: 'Tech', dates: '2020 - Present' }],
  connectionsCount: '500+',
  recommendationsCount: 3,
}

const signals500 = extractLinkedInSignals(profileWith500Plus)
assert.strictEqual(
  signals500.visibility.connectionBracket,
  '500+',
  `Expected connectionBracket '500+', got '${signals500.visibility.connectionBracket}'`
)

const scorecard500 = computeLinkedInScorecard(signals500, null, 'Senior Software Engineer')
const visIssues = scorecard500.issues.filter(i => i.category === 'visibility' && /connection/i.test(i.title))
assert.strictEqual(
  visIssues.length,
  0,
  '500+ connections must not receive any connection penalty issues'
)
console.log('✔ Test 1 Passed: "500+" connections resolves to bracket "500+" with 0 penalty.\n')

// -----------------------------------------------------------------
// 2. Non-Tech Domain Playbooks (Nurse & Financial Analyst)
// -----------------------------------------------------------------
console.log('--- Test 2: Non-Tech Domain Playbooks (Nurse & Financial Analyst) ---')

// Registered Nurse
const nurseResumeContext = {
  targetRole: 'Registered Nurse',
  canonicalResume: {
    candidate: { name: 'Sarah Connor', targetRole: 'Registered Nurse' },
    skills: ['Patient Assessment', 'EHR Systems', 'HIPAA Protocol', 'Acute Care'],
    experiences: [{ company: 'General Hospital', role: 'Registered Nurse', dates: '2020 - Present' }],
  },
}
const nurseOpts = buildDeterministicOptimizations(
  { fullName: 'Sarah Connor', experiences: [] },
  nurseResumeContext,
  []
)

const nurseHeadlines = nurseOpts.headlines.map(h => h.headline).join(' | ')
assert(
  !nurseHeadlines.includes('Cloud Architecture'),
  'Nurse headlines must NOT include "Cloud Architecture"'
)
assert(
  nurseHeadlines.includes('Clinical Operations') || nurseHeadlines.includes('Patient'),
  'Nurse headlines must feature healthcare clinical domain'
)
console.log('✔ Nurse headline output:', nurseOpts.headlines[2].headline)

// Financial Analyst
const financeResumeContext = {
  targetRole: 'Financial Analyst',
  canonicalResume: {
    candidate: { name: 'David Miller', targetRole: 'Financial Analyst' },
    skills: ['Financial Modeling', 'Variance Analysis', 'ERP Systems', 'GAAP / IFRS'],
    experiences: [{ company: 'Apex Capital', role: 'Financial Analyst', dates: '2021 - Present' }],
  },
}
const financeOpts = buildDeterministicOptimizations(
  { fullName: 'David Miller', experiences: [] },
  financeResumeContext,
  []
)

const financeHeadlines = financeOpts.headlines.map(h => h.headline).join(' | ')
assert(
  !financeHeadlines.includes('Cloud Architecture'),
  'Finance headlines must NOT include "Cloud Architecture"'
)
assert(
  financeHeadlines.includes('Financial Reporting') || financeHeadlines.includes('Variance Modeling'),
  'Finance headlines must feature financial domain expertise'
)
console.log('✔ Finance headline output:', financeOpts.headlines[2].headline)
console.log('✔ Test 2 Passed: Non-tech domains receive authentic domain headlines without cloud bias.\n')

// -----------------------------------------------------------------
// 3. Modern Data Warehouse Tools Retained for Software Engineers
// -----------------------------------------------------------------
console.log('--- Test 3: Retaining Snowflake, BigQuery, dbt for Software Engineers ---')
const sweWithDataStack = {
  targetRole: 'Software Engineer',
  canonicalResume: {
    candidate: { name: 'Alex Rivera', targetRole: 'Software Engineer' },
    skills: ['Python', 'Snowflake', 'BigQuery', 'dbt', 'PostgreSQL', 'Docker'],
    experiences: [{ company: 'DataTech', role: 'Software Engineer', dates: '2022 - Present' }],
  },
}
const sweOpts = buildDeterministicOptimizations(
  { fullName: 'Alex Rivera', experiences: [] },
  sweWithDataStack,
  ['Snowflake', 'BigQuery', 'dbt']
)

const sweTopSkills = sweOpts.top3PinnedSkills.join(' ')
const allRecommended = sweOpts.recommendedSkillsToAdd.join(' ')
assert(
  sweTopSkills.includes('Snowflake') || sweTopSkills.includes('BigQuery') || sweTopSkills.includes('dbt'),
  'Software Engineer candidate skills must retain verified Snowflake/BigQuery/dbt'
)
console.log('✔ Top pinned skills for SWE:', sweOpts.top3PinnedSkills)
console.log('✔ Test 3 Passed: Modern data warehouse tools are safely preserved for SWE roles.\n')

// -----------------------------------------------------------------
// 4. Timeline Boundary Resilience (Jan 2024 vs Dec 2023)
// -----------------------------------------------------------------
console.log('--- Test 4: Calendar Year Boundary Resilience (Jan 2024 vs Dec 2023) ---')
const resumeExpBoundary = {
  candidate: { name: 'Taylor Swift' },
  experience: [
    {
      company: 'Stripe',
      role: 'Staff Engineer',
      dates: 'Jan 2024 - Present',
      bullets: [{ text: 'Built payment reconciliation.' }],
    },
  ],
}
const linkedInProfileBoundary = {
  isValid: true,
  fullName: 'Taylor Swift',
  headline: 'Staff Engineer at Stripe',
  experiences: [
    {
      company: 'Stripe',
      title: 'Staff Engineer',
      dates: 'Dec 2023 – Present',
    },
  ],
}

const crossBoundaryResult = analyzeCrossAgentDiscrepancies(linkedInProfileBoundary, {
  canonicalResume: resumeExpBoundary,
  targetRole: 'Staff Engineer',
})

const boundaryDrift = crossBoundaryResult.discrepancies.filter(d => d.type === 'timeline_drift')
assert.strictEqual(
  boundaryDrift.length,
  0,
  `Dec 2023 vs Jan 2024 must NOT trigger timeline_drift (got ${boundaryDrift.length})`
)
console.log('✔ Test 4 Passed: 1-year boundary difference does NOT trigger high-severity timeline drift.\n')

// -----------------------------------------------------------------
// 5. Normalized Scorecard Floor Cap
// -----------------------------------------------------------------
console.log('--- Test 5: Normalized Scorecard Floor Cap ---')
const signalsStrongProfile = {
  headline: { isMissing: false, isTooShort: false, isTooLong: false, wordCount: 12, length: 80 },
  about: { isMissing: false, isThin: false, charCount: 1200 },
  visibility: { connectionBracket: '500+', connectionsCount: '500+', hasRecommendations: true, hasCustomUrl: true },
  completeness: { experienceCount: 4, skillsCount: 20, hasExperiences: true, hasEducation: true, expWithDescription: 4 },
}
// Simulated crossAnalysis with low consistency (e.g. 1 title drift)
const mockCrossLowAlignment = {
  hasResumeContext: true,
  discrepancies: [
    { type: 'title_drift', severity: 'high', title: 'Title drift' },
  ],
}

const scorecardFloorTest = computeLinkedInScorecard(signalsStrongProfile, mockCrossLowAlignment, 'Software Engineer')
assert(
  scorecardFloorTest.score >= 75,
  `Strong profile with isolated discrepancy must not be brutally capped below 75 (got ${scorecardFloorTest.score})`
)
console.log(`✔ Test 5 Passed: Score is gracefully capped at ${scorecardFloorTest.score}/100 (>= 75 floor).\n`)

// -----------------------------------------------------------------
// 6. Graceful Handling for Private / Skeleton Profiles
// -----------------------------------------------------------------
console.log('--- Test 6: Graceful Handling for Private / Skeleton LinkedIn Profiles ---')
const skeletonRaw = {
  fullName: 'Not Specified',
  experiences: [],
  isValid: true,
}
const verifiedResume = {
  targetRole: 'Cloud Architect',
  canonicalResume: {
    candidate: { name: 'Elena Rostova', targetRole: 'Cloud Architect' },
    experience: [
      { company: 'Google Cloud', role: 'Cloud Architect', dates: '2021 - Present', bullets: [{ text: 'Designed multi-region VPCs' }] },
      { company: 'Cisco', role: 'Network Engineer', dates: '2018 - 2021', bullets: [{ text: 'Maintained core routing' }] },
    ],
    skills: ['GCP', 'Terraform', 'Kubernetes', 'BGP'],
  },
}

const effectiveProfile = resolveEffectiveProfile(skeletonRaw, verifiedResume)
assert.strictEqual(effectiveProfile.inferredFromResume, true, 'inferredFromResume must be true')
assert.strictEqual(effectiveProfile.isPrivateProfile, true, 'isPrivateProfile must be true')
assert.strictEqual(effectiveProfile.experiences.length, 2, 'Inferred experiences must match resume')

const skeletonCrossResult = analyzeCrossAgentDiscrepancies(effectiveProfile, verifiedResume)
const roleOmissions = skeletonCrossResult.discrepancies.filter(d => d.type === 'role_omission')
assert.strictEqual(
  roleOmissions.length,
  0,
  'Skeleton profile must not trigger role omission discrepancies'
)
console.log('✔ Test 6 Passed: Skeleton profile inferred cleanly from resume with 0 false role omissions.\n')

console.log('================================================================')
console.log('ALL 6 LINKEDIN BOTTLENECK FIX VERIFICATION TESTS PASSED! 🚀')
console.log('================================================================')
