import {
  computeCareerGpsScore,
  detectHiringPhase,
  synthesizeRootCauseAndActions,
  getExternalContext,
  evaluateAssessmentPersona,
} from '../agents/assessment/assessmentAgent.js'
import { classifyConsistencyTier } from '../agents/linkedin/linkedinCrossAnalyzer.js'

console.log('=== TESTING ASSESSMENT AGENT V2 COMPREHENSIVE SUITE ===\n')

// ── Test 1: Full scoring calculation & consistency check ──
const mockAnswers = {
  opportunityType: 'Full-Time W2 Role 🏢',
  targetRole: 'Senior Full Stack Software Engineer',
  experience: '5–8 yrs (Senior)',
  apps30d: '60',
  targetedMatchPct: '80%–100% (Highly Targeted 🎯)',
  searchMethods: [
    'Company Career Pages (Direct ATS)',
    'Direct Recruiter / Hiring Manager Outreach',
    'Employee Referrals & Warm Introductions',
  ],
  outreach: '15',
  referralsMonth: '4–10',
  funnel90d: { screens: 4, assessments: 2, finals: 1, offers: 0 },
  DropOffStage: 'Phase 3: Technical → Final Round (Pass screens, stuck in technicals)',
  biggestChallenge: 'Passing live coding / system design / case assessments',
  alreadyTried: [
    'Rewrote my resume',
    'Updated LinkedIn profile',
    'Messaged recruiters on LinkedIn',
    'Practiced mock interviews / LeetCode',
  ],
  frustration: 'I freeze or underperform in technical/final interviews',
}

const mockResumeAgent = {
  dashboard: {
    score: 84,
  },
  issues: [
    {
      title: 'Missing quantified metric on backend concurrency bullet',
      category: 'impact',
      diagnosis: 'Bullet lacks throughput numbers and scale measurements.',
    },
  ],
}

const mockLinkedInAgent = {
  score: 78,
  discrepanciesAnalysis: {
    summary: { high: 0, medium: 1, low: 1 },
    timelineMismatches: [],
    titleDrift: [{ resumeTitle: 'Senior Software Engineer', linkedinTitle: 'Senior Full Stack Developer' }],
  },
}

const scoreResult = computeCareerGpsScore({
  answers: mockAnswers,
  resumeAgent: mockResumeAgent,
  linkedinAgent: mockLinkedInAgent,
})

console.log('1. Score Result:')
console.log('   Total Score:', scoreResult.gps_score, '/ 100')
console.log('   Grade:', scoreResult.grade, `(${scoreResult.gradeLabel})`)
console.log('   LinkedIn Consistency Tier:', scoreResult.areas.linkedin.consistencyTier)
for (const [key, area] of Object.entries(scoreResult.areas)) {
  console.log(`     - ${area.title}: ${area.points}/${area.maxPoints} pts (${area.percentage}%)`)
}

// ── Test 2: Phase Detection Scenarios ──
console.log('\n2. Testing 5-Phase Detection Scenarios:')

// Scenario A: Phase 1 (100 apps, 1 screen)
const phase1 = detectHiringPhase({
  answers: { ...mockAnswers, apps30d: '100', funnel90d: { screens: 1, assessments: 0, finals: 0, offers: 0 } },
})
console.log(`   [Scenario A] 100 apps, 1 screen -> Phase ${phase1.id}: ${phase1.name} (Confidence: ${phase1.confidence})`)
if (phase1.id !== 1) throw new Error(`Expected Phase 1, got Phase ${phase1.id}`)

// Scenario B: Phase 2 (50 apps, 6 screens, 0 tech)
const phase2 = detectHiringPhase({
  answers: { ...mockAnswers, apps30d: '50', funnel90d: { screens: 6, assessments: 0, finals: 0, offers: 0 } },
})
console.log(`   [Scenario B] 50 apps, 6 screens, 0 tech -> Phase ${phase2.id}: ${phase2.name} (Confidence: ${phase2.confidence})`)
if (phase2.id !== 2) throw new Error(`Expected Phase 2, got Phase ${phase2.id}`)

// Scenario C: Phase 3 (100 apps, 8 screens, 4 techs, 0 finals, 0 offers)
const phase3 = detectHiringPhase({
  answers: { ...mockAnswers, apps30d: '100', funnel90d: { screens: 8, technicalRounds: 4, finalRounds: 0, offers: 0 } },
})
console.log(`   [Scenario C] 100 apps, 8 screens, 4 techs, 0 finals -> Phase ${phase3.id}: ${phase3.name} (Confidence: ${phase3.confidence})`)
if (phase3.id !== 3) throw new Error(`Expected Phase 3, got Phase ${phase3.id}`)

// Scenario User: Candidate with 2 recruiter screens, 3 OAs, 2 tech rounds, 1 final round, 0 offers -> Phase 4!
const userCandidatePhase = detectHiringPhase({
  answers: {
    ...mockAnswers,
    apps30d: '90',
    funnel90d: { recruiterScreens: 2, assessments: 3, technicalRounds: 2, finalRounds: 1, offers: 0 },
  },
})
console.log(`   [Scenario User] 2 screens, 3 OAs (5 total), 2 tech, 1 final, 0 offers -> Phase ${userCandidatePhase.id}: ${userCandidatePhase.name}`)
if (userCandidatePhase.id !== 4) throw new Error(`Expected Phase 4, got Phase ${userCandidatePhase.id}`)

// Scenario D: Phase 4 (60 apps, 6 screens, 4 techs, 3 finals, 0 offers)
const phase4 = detectHiringPhase({
  answers: { ...mockAnswers, apps30d: '60', funnel90d: { screens: 6, assessments: 4, finals: 3, offers: 0 } },
})
console.log(`   [Scenario D] 60 apps, 3 finals, 0 offers -> Phase ${phase4.id}: ${phase4.name} (Confidence: ${phase4.confidence})`)
if (phase4.id !== 4) throw new Error(`Expected Phase 4, got Phase ${phase4.id}`)

// Scenario E: Phase 5 (1 offer, onboarding friction)
const phase5 = detectHiringPhase({
  answers: {
    ...mockAnswers,
    apps30d: '30',
    funnel90d: { recruiterScreens: 3, assessments: 2, finalRounds: 2, offers: 1, joiningStatus: 'Offer Delayed / Background / Joining Blocked' },
    DropOffStage: 'Phase 5: Offer → Joining — Got an offer, but joining/onboarding/background check got stuck',
  },
})
console.log(`   [Scenario E] 1 offer + Phase 5 DropOff -> Phase ${phase5.id}: ${phase5.name} (Confidence: ${phase5.confidence})`)
if (phase5.id !== 5) throw new Error(`Expected Phase 5, got Phase ${phase5.id}`)

// Scenario F: Phase 6 (Low apps < 8 -> Readiness)
const phase6 = detectHiringPhase({
  answers: {
    ...mockAnswers,
    apps30d: '3',
    funnel90d: { recruiterScreens: 0, assessments: 0, finalRounds: 0, offers: 0 },
    DropOffStage: 'Phase 6: Resume / Readiness — Haven’t started applying consistently yet',
  },
})
console.log(`   [Scenario F] 3 apps, 0 screens -> Phase ${phase6.id}: ${phase6.name} (isProvisional: ${phase6.isProvisional})`)
if (phase6.id !== 6) throw new Error(`Expected Phase 6, got Phase ${phase6.id}`)
if (!phase6.isProvisional) throw new Error('Expected isProvisional=true for <5 apps')

const highVolResult = synthesizeRootCauseAndActions({
  phase: { id: 1, name: 'Phase 1: Application → Screening' },
  scores: scoreResult,
  answers: {
    ...mockAnswers,
    applications90d: 500,
    recruiterScreens: 2,
    funnel90d: { applications90d: 500, recruiterScreens: 2 },
  },
  resumeAgent: mockResumeAgent,
  linkedinAgent: mockLinkedInAgent,
})
console.log(`   [Scenario G] 500 apps, 2 screens -> Bottleneck: "${highVolResult.primary_bottleneck.title}"`)
if (highVolResult.primary_bottleneck.title !== 'High-Volume Portal Black Hole (ATS Keyword & Targeting Mismatch)') {
  throw new Error(`Expected High-Volume Portal Black Hole, got: ${highVolResult.primary_bottleneck.title}`)
}

// Scenario H: Haswanth / Deepanjan late-stage funnel (200 apps, 2 tech rounds, 1 final round)
// Candidate completed technical and final rounds -> MUST detect Phase 4: Final Round → Offer!
const lateStagePhase = detectHiringPhase({
  answers: {
    ...mockAnswers,
    apps30d: '70',
    funnel90d: { applications90d: 200, recruiterScreens: 3, technicalRounds: 2, finalRounds: 1, offers: 0 },
    DropOffStage: 'Phase 4: Final Round → Offer',
  },
})
console.log(`   [Scenario H] Haswanth/Deepanjan (200 apps, 2 tech, 1 final) -> Phase ${lateStagePhase.id}: ${lateStagePhase.name}`)
if (lateStagePhase.id !== 4) {
  throw new Error(`Expected Phase 4 for late-stage interview candidate with final round, got Phase ${lateStagePhase.id}`)
}

// Scenario I: Candidate with valid LinkedIn URL -> Never assigned Blank LinkedIn bottleneck
const linkedInGuardResult = synthesizeRootCauseAndActions({
  phase: { id: 1, name: 'Phase 1: Application → Screening' },
  scores: scoreResult,
  answers: {
    ...mockAnswers,
    linkedin: 'https://www.linkedin.com/in/haswanth-deepanjan',
  },
  resumeAgent: mockResumeAgent,
  linkedinAgent: { dataAvailable: false },
})
console.log(`   [Scenario I] Valid LinkedIn provided -> Primary Bottleneck: "${linkedInGuardResult.primary_bottleneck.title}"`)
if (linkedInGuardResult.primary_bottleneck.title.toLowerCase().includes('blank linkedin')) {
  throw new Error(`Expected non-blank LinkedIn bottleneck, got: ${linkedInGuardResult.primary_bottleneck.title}`)
}

// Scenario J: evaluateAssessmentPersona returns candidateProfile
const personaResult = evaluateAssessmentPersona({
  answers: {
    ...mockAnswers,
    targetRole: 'Data Analytics Engineer',
    opportunityType: 'Full-Time W2 Role 🏢',
    experience: '3–5 yrs (Mid-Level)',
    visa: 'F1 OPT / STEM OPT / CPT',
  },
  resumeAgent: mockResumeAgent,
  linkedinAgent: mockLinkedInAgent,
})
console.log(`   [Scenario J] evaluateAssessmentPersona candidateProfile:`, personaResult.candidateProfile)
if (!personaResult.candidateProfile || personaResult.candidateProfile.targetRole !== 'Data Analytics Engineer') {
  throw new Error('Expected candidateProfile with targetRole="Data Analytics Engineer"')
}

// ── Test 3: Consistency Classifier 4 Tiers ──
console.log('\n3. Testing 4-Tier Consistency Classifier:')
const tier1 = classifyConsistencyTier({ summary: { high: 0, medium: 0, low: 0 } })
const tier2 = classifyConsistencyTier({
  summary: { high: 0, medium: 1, low: 0 },
  titleDrift: [{ resumeTitle: 'Data Analyst', linkedinTitle: 'Senior Data Analyst' }],
})
const tier3 = classifyConsistencyTier({ summary: { high: 0, medium: 3, low: 1 } })
const tier4 = classifyConsistencyTier({
  summary: { high: 2, medium: 1, low: 0 },
  timelineMismatches: [{ company: 'Acme', monthsDiff: 6 }],
})

console.log(`   Tier 1: ${tier1.tier} (${tier1.points}/2 pts)`)
console.log(`   Tier 2: ${tier2.tier} (${tier2.points}/2 pts)`)
console.log(`   Tier 3: ${tier3.tier} (${tier3.points}/2 pts)`)
console.log(`   Tier 4: ${tier4.tier} (${tier4.points}/2 pts)`)

if (tier1.tier !== 'Strong Match') throw new Error('Tier 1 should be Strong Match')
if (tier2.tier !== 'Minor Differences') throw new Error('Tier 2 should be Minor Differences')
if (tier3.tier !== 'Potential Inconsistency') throw new Error('Tier 3 should be Potential Inconsistency')
if (tier4.tier !== 'Major Inconsistency') throw new Error('Tier 4 should be Major Inconsistency')

// ── Test 4: Top 3 Action Format Verification ──
console.log('\n4. Verifying Action Attributes (All 8 Fields):')
const actionsResult = synthesizeRootCauseAndActions({
  phase: phase3,
  scores: scoreResult,
  answers: mockAnswers,
  resumeAgent: mockResumeAgent,
  linkedinAgent: mockLinkedInAgent,
})

for (const act of actionsResult.top_actions) {
  const required = ['title', 'category', 'whyItMatters', 'whatToDo', 'resourceTool', 'duration', 'successMetric', 'followUp']
  for (const field of required) {
    if (!act[field]) throw new Error(`Missing field ${field} in top action: ${act.title}`)
  }
  console.log(`   ✓ Action [${act.category}] "${act.title}" - duration: ${act.duration}, tool: ${act.resourceTool}`)
}

console.log('\n=== ALL COMPREHENSIVE V2 TESTS PASSED! ===')
