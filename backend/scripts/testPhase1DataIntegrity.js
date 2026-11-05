/**
 * Phase 1 Data Integrity & 4-Pillar Scoring Verification Suite
 * (backend/scripts/testPhase1DataIntegrity.js)
 *
 * Validates:
 * 1. Midpoint Range Safety: "30-60" -> 45, "10–25" -> 18, "0–5" -> 3 (Zero digit-concatenation bugs).
 * 2. Deep Nested funnel90d Extraction vs Flat Fallback (Zero fallback to invented numbers).
 * 3. 4-Pillar Mathematical Identity: gps_score === resume + linkedin + outreach + interviews (25% each).
 * 4. All 6 Bottleneck Trigger Scenarios: readiness_stall, offer_onboarding, final_round_drop, technical_round, recruiter_screen, top_of_funnel.
 * 5. Dynamic Coach Bridge & Score Breakdown Synchronization.
 */

import assert from 'assert'
import {
  computeCareerGpsScore,
  parseRangeOrNumber,
} from '../agents/assessment/assessmentAgent.js'
import {
  deriveFunnelFromAnswers,
  normalizeAtlasShapes,
} from '../services/reportGeneration.js'

console.log('================================================================')
console.log('🧪 Starting Phase 1 Data Integrity & 4-Pillar Verification')
console.log('================================================================\n')

// ----------------------------------------------------
// Test 1: Midpoint Range Safety (Zero Digit Concatenation)
// ----------------------------------------------------
console.log('--- Test 1: Midpoint Range Safety (Zero Digit-Concatenation) ---')

assert.strictEqual(parseRangeOrNumber('30-60'), 45, '"30-60" should parse to midpoint 45')
assert.strictEqual(parseRangeOrNumber('30–60'), 45, '"30–60" (en-dash) should parse to midpoint 45')
assert.strictEqual(parseRangeOrNumber('10-25'), 18, '"10-25" should parse to midpoint 18')
assert.strictEqual(parseRangeOrNumber('0–5'), 3, '"0–5" should parse to midpoint 3')
assert.strictEqual(parseRangeOrNumber(50), 50, '50 number should return 50')
assert.strictEqual(parseRangeOrNumber(null, 10), 10, 'null should return fallback 10')

// Verify deriveFunnelFromAnswers range parsing
const rangeFunnel = deriveFunnelFromAnswers({
  apps30d: '30-60',
  outreach: '10–20',
  funnel90d: {
    recruiterScreens: '2–4',
    technicalRounds: '1-3',
    finalRounds: 1,
    offers: 0,
  },
})

assert.strictEqual(rangeFunnel.applications30d, 45, 'apps30d resolves to 45 (not 3060)')
assert.strictEqual(rangeFunnel.applications90d, 135, 'apps90d resolves to 135')
assert.strictEqual(rangeFunnel.recruiterScreens, 3, 'recruiterScreens resolves to 3')
assert.strictEqual(rangeFunnel.technicalRounds, 2, 'technicalRounds resolves to 2')
assert.ok(rangeFunnel.applications_count < 1000, 'Applications count is safely bounded < 1000')

console.log('✔ Test 1 Passed: Range strings safely resolve to midpoints with 0 digit concatenation.\n')

// ----------------------------------------------------
// Test 2: Deep Nested funnel90d Extraction vs Flat Fallback
// ----------------------------------------------------
console.log('--- Test 2: Deep Nested funnel90d Extraction vs Flat Fallback ---')

// 2a. Nested extraction
const nestedFunnel = deriveFunnelFromAnswers({
  apps30d: 50,
  funnel90d: {
    applications90d: 150,
    recruiterScreens: 5,
    assessments: 3,
    aiInterviews: 1,
    technicalRounds: 4,
    finalRounds: 2,
    offers: 1,
  },
  outreach: 20,
})

assert.strictEqual(nestedFunnel.applications90d, 150, 'Extracted nested applications90d')
assert.strictEqual(nestedFunnel.recruiterScreens, 5, 'Extracted nested recruiterScreens')
assert.strictEqual(nestedFunnel.assessments, 3, 'Extracted nested assessments')
assert.strictEqual(nestedFunnel.aiInterviews, 1, 'Extracted nested aiInterviews')
assert.strictEqual(nestedFunnel.totalScreens, 9, 'Total screens includes recruiter + assessments + AI')
assert.strictEqual(nestedFunnel.technicalRounds, 4, 'Extracted nested technicalRounds')
assert.strictEqual(nestedFunnel.finalRounds, 2, 'Extracted nested finalRounds')
assert.strictEqual(nestedFunnel.offers, 1, 'Extracted nested offers')

// 2b. Flat fallback
const flatFunnel = deriveFunnelFromAnswers({
  appsWeek: 15,
  humanScreen: 4,
  oas: 2,
  technical: 2,
  finals: 1,
  offers: 0,
  recruiter_outreach_count: 10,
})

assert.strictEqual(flatFunnel.recruiterScreens, 4, 'Flat fallback extracted humanScreen')
assert.strictEqual(flatFunnel.assessments, 2, 'Flat fallback extracted oas')
assert.strictEqual(flatFunnel.technicalRounds, 2, 'Flat fallback extracted technical')
assert.strictEqual(flatFunnel.finalRounds, 1, 'Flat fallback extracted finals')
assert.strictEqual(flatFunnel.outreach_count, 10, 'Flat fallback extracted recruiter_outreach_count')

console.log('✔ Test 2 Passed: Deep telemetry extracted accurately with seamless flat fallbacks.\n')

// ----------------------------------------------------
// Test 3: 4-Pillar Mathematical Identity
// ----------------------------------------------------
console.log('--- Test 3: 4-Pillar Mathematical Identity (Sum === GPS Score) ---')

const candidateScenarios = [
  {
    name: 'Active Senior Engineer',
    answers: {
      apps30d: 60,
      targetedMatchPct: '80%–100% (Highly Targeted 🎯)',
      searchMethods: ['Company Career Pages (Direct ATS)', 'Employee Referrals & Warm Introductions'],
      outreach: 25,
      referralsMonth: '4–10',
      funnel90d: { screens: 4, technicalRounds: 2, finalRounds: 1, offers: 0 },
    },
    resumeAgent: { dashboard: { score: 84 } },
    linkedinAgent: { score: 76 },
  },
  {
    name: 'Early-Stage / Inactive Candidate',
    answers: {
      apps30d: 5,
      targetedMatchPct: 'Under 20%',
      searchMethods: ['Easy Apply / Job Boards only'],
      outreach: 0,
      referralsMonth: '0',
      funnel90d: { screens: 0, technicalRounds: 0, finalRounds: 0, offers: 0 },
    },
    resumeAgent: { dashboard: { score: 45 } },
    linkedinAgent: { score: 40 },
  },
  {
    name: 'High-Volume Applicant with Drop-Off',
    answers: {
      apps30d: 120,
      targetedMatchPct: '50%–79%',
      searchMethods: ['Company Career Pages (Direct ATS)', 'Direct Recruiter / Hiring Manager Outreach'],
      outreach: 15,
      referralsMonth: '1–3',
      funnel90d: { screens: 2, technicalRounds: 1, finalRounds: 0, offers: 0 },
    },
    resumeAgent: { dashboard: { score: 72 } },
    linkedinAgent: { score: 68 },
  },
]

for (const scenario of candidateScenarios) {
  const result = computeCareerGpsScore({
    answers: scenario.answers,
    resumeAgent: scenario.resumeAgent,
    linkedinAgent: scenario.linkedinAgent,
  })

  const { resume, linkedin, outreach, interviews } = result.four_pillars

  // Check individual bounds
  assert.ok(resume.points >= 0 && resume.points <= 25, `${scenario.name}: Resume points within 0-25`)
  assert.ok(linkedin.points >= 0 && linkedin.points <= 25, `${scenario.name}: LinkedIn points within 0-25`)
  assert.ok(outreach.points >= 0 && outreach.points <= 25, `${scenario.name}: Outreach points within 0-25`)
  assert.ok(interviews.points >= 0 && interviews.points <= 25, `${scenario.name}: Interviews points within 0-25`)

  // Check weights
  assert.strictEqual(resume.weight, '25%', 'Resume weight is 25%')
  assert.strictEqual(linkedin.weight, '25%', 'LinkedIn weight is 25%')
  assert.strictEqual(outreach.weight, '25%', 'Outreach weight is 25%')
  assert.strictEqual(interviews.weight, '25%', 'Interviews weight is 25%')

  // Mathematical identity check: exact sum
  const sumOfPillars = resume.points + linkedin.points + outreach.points + interviews.points
  assert.strictEqual(
    result.gps_score,
    sumOfPillars,
    `${scenario.name}: GPS Score (${result.gps_score}) must EXACTLY equal sum of 4 pillars (${sumOfPillars})`
  )
}

console.log('✔ Test 3 Passed: 4-Pillar mathematical identity verified (Sum of 4 pillars === GPS Score).\n')

// ----------------------------------------------------
// Test 4: All 6 Bottleneck Trigger Scenarios
// ----------------------------------------------------
console.log('--- Test 4: All 6 Bottleneck Trigger Scenarios ---')

// 1. readiness_stall: totalApps90d < 15 && totalScreens === 0
const fReadiness = deriveFunnelFromAnswers({
  apps30d: 3,
  funnel90d: { applications90d: 9, screens: 0, technicalRounds: 0, finalRounds: 0, offers: 0 },
})
assert.strictEqual(fReadiness.biggest_leak_stage, 'readiness_stall', 'Triggered readiness_stall')
assert.strictEqual(fReadiness.leak_title, 'Application Readiness & Search Inactivity')

// 2. offer_onboarding: offers >= 1
const fOffer = deriveFunnelFromAnswers({
  apps30d: 40,
  funnel90d: { screens: 5, technicalRounds: 3, finalRounds: 2, offers: 1 },
})
assert.strictEqual(fOffer.biggest_leak_stage, 'offer_onboarding', 'Triggered offer_onboarding')
assert.strictEqual(fOffer.leak_title, 'Offer Decision & Negotiation Strategy')

// 3. final_round_drop: finalRounds >= 1 && offers === 0
const fFinalDrop = deriveFunnelFromAnswers({
  apps30d: 50,
  funnel90d: { screens: 6, technicalRounds: 4, finalRounds: 2, offers: 0 },
})
assert.strictEqual(fFinalDrop.biggest_leak_stage, 'final_round_drop', 'Triggered final_round_drop')
assert.strictEqual(fFinalDrop.leak_title, 'Final Executive & Hiring Manager Conversion')

// 4. technical_round: technicalRounds >= 1 && finalRounds === 0
const fTechDrop = deriveFunnelFromAnswers({
  apps30d: 45,
  funnel90d: { screens: 5, technicalRounds: 2, finalRounds: 0, offers: 0 },
})
assert.strictEqual(fTechDrop.biggest_leak_stage, 'technical_round', 'Triggered technical_round')
assert.strictEqual(fTechDrop.leak_title, 'Technical Architecture & Coding Assessments')

// 5. recruiter_screen: totalScreens >= 3 && technicalRounds === 0
const fScreenDrop = deriveFunnelFromAnswers({
  apps30d: 60,
  funnel90d: { screens: 4, technicalRounds: 0, finalRounds: 0, offers: 0 },
})
assert.strictEqual(fScreenDrop.biggest_leak_stage, 'recruiter_screen', 'Triggered recruiter_screen')
assert.strictEqual(fScreenDrop.leak_title, 'Recruiter Screen to Hiring Manager Handoff')

// 6. top_of_funnel: Default high apps but callbacks < 3%
const fTopOfFunnel = deriveFunnelFromAnswers({
  apps30d: 50,
  funnel90d: { applications90d: 150, screens: 2, technicalRounds: 0, finalRounds: 0, offers: 0 },
})
assert.strictEqual(fTopOfFunnel.biggest_leak_stage, 'top_of_funnel', 'Triggered top_of_funnel')
assert.strictEqual(fTopOfFunnel.leak_title, 'Top-of-Funnel Application Black Hole')

console.log('✔ Test 4 Passed: All 6 bottleneck trigger scenarios correctly identified.\n')

// ----------------------------------------------------
// Test 5: Dynamic Coach Bridge & Shape Normalization
// ----------------------------------------------------
console.log('--- Test 5: Dynamic Coach Bridge & Shape Normalization ---')

const normalizedReport = normalizeAtlasShapes(
  {
    career_health_score: 75,
    target_role: 'Staff Platform Engineer',
  },
  {
    targetRole: 'Staff Platform Engineer',
    apps30d: 45,
    funnel90d: { screens: 4, technicalRounds: 2, finalRounds: 0, offers: 0 },
  }
)

assert.strictEqual(normalizedReport.funnel_stages.biggest_leak_stage, 'technical_round', 'Normalized leak stage is technical_round')
assert.strictEqual(normalizedReport.funnel_stages.leak_title, 'Technical Architecture & Coding Assessments')
assert.ok(
  normalizedReport.coach_intervention.urgency_statement.includes('Technical Architecture & Coding Assessments'),
  'Urgency statement dynamically cites leak_title'
)
assert.ok(
  normalizedReport.coach_intervention.urgency_statement.includes('Staff Platform Engineer'),
  'Urgency statement dynamically cites candidate target role'
)

console.log('✔ Test 5 Passed: Coach bridge and shape normalization dynamically anchored.\n')

console.log('================================================================')
console.log('🎉 ALL PHASE 1 DATA INTEGRITY & 4-PILLAR SCORING TESTS PASSED!')
console.log('================================================================')
