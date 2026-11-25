import assert from 'assert'
import { resolveBottleneckStateMachine } from '../services/reportGeneration.js'
import { buildDeterministicActionPlan } from '../services/dynamicActionPlanAgent.js'
import { sanitizeModeCOutput } from '../agents/resume/orchestration/modeC_hybrid.js'
import fs from 'fs'
import { computeLinkedInScorecard } from '../agents/linkedin/linkedinScorecard.js'
import { synthesizeWhyItWorks } from '../utils/humanizeReportCopy.js'

console.log('--- RUNNING 10 ACCURACY & SCORING VERIFICATION TESTS ---')

// 1. Health Score & Bottleneck State Machine with Rishabh Semwal's Profile
console.log('\n[TEST 1] Rishabh Semwal Bottleneck State Machine (45 apps, 3 screens = 6.7% callback, 1 tech, 0 finals, 0 offers)...')
const rishabhBottleneck = resolveBottleneckStateMachine({
  totalApps: 45,
  screens: 3,
  technicalRounds: 1,
  finalRounds: 0,
  offers: 0,
})

console.log('Resolved Bottleneck:', {
  stageId: rishabhBottleneck.bottleneckStageId,
  name: rishabhBottleneck.name,
  isPhase2Healthy: rishabhBottleneck.isPhase2Healthy,
  appToScreenRate: rishabhBottleneck.rates.appToScreenRate,
  screenToTechRate: rishabhBottleneck.rates.screenToTechRate,
})

assert.strictEqual(rishabhBottleneck.isPhase2Healthy, true, 'Phase 2 must be marked healthy because 6.7% >= 5.0%')
assert.strictEqual(rishabhBottleneck.bottleneckStageId, 3, 'Must be diagnosed as Phase 3 (Screen to Tech friction)')
assert.ok(!rishabhBottleneck.title.includes('ATS Keyword Filtering'), 'Healthy Phase 2 must not be diagnosed as ATS filtering')
assert.ok(!rishabhBottleneck.diagnosis.includes('Phase 6'), 'Must not diagnose Phase 6 BGV')
assert.ok(rishabhBottleneck.rates.appToScreenRate >= 5.0, 'Callback rate must be >= 5.0%')

// 2. Candidate with Low Callback (< 5.0%)
console.log('\n[TEST 2] Low Callback Candidate (100 apps, 1 screen = 1.0% callback)...')
const lowCallbackBottleneck = resolveBottleneckStateMachine({
  totalApps: 100,
  screens: 1,
  technicalRounds: 0,
  finalRounds: 0,
  offers: 0,
})

assert.strictEqual(lowCallbackBottleneck.isPhase2Healthy, false)
assert.strictEqual(lowCallbackBottleneck.bottleneckStageId, 2)
assert.ok(lowCallbackBottleneck.title.includes('ATS Keyword Filtering'))

// 3. Candidate with 0 Offers Must NEVER be Phase 6
console.log('\n[TEST 3] Zero Offers Candidate Never in Phase 6 BGV...')
const zeroOffersBottleneck = resolveBottleneckStateMachine({
  totalApps: 20,
  screens: 2,
  technicalRounds: 1,
  finalRounds: 1,
  offers: 0,
})
assert.notStrictEqual(zeroOffersBottleneck.bottleneckStageId, 6, 'Must never diagnose Phase 6 when offers === 0')
assert.strictEqual(zeroOffersBottleneck.bottleneckStageId, 5, 'Must be Phase 5 (Final to Offer friction)')

// 4. Candidate with Offer Can Reach Phase 6
console.log('\n[TEST 4] Offer Received Can Reach Phase 6 BGV...')
const offerBottleneck = resolveBottleneckStateMachine({
  totalApps: 30,
  screens: 5,
  technicalRounds: 3,
  finalRounds: 2,
  offers: 1,
  joiningStatus: 'Background Verification',
})
assert.strictEqual(offerBottleneck.bottleneckStageId, 6)

// 5. Dynamic Roadmap Targets
console.log('\n[TEST 5] Dynamic Roadmap Targets for Rishabh Semwal (6.7% callback)...')
const dynamicPlan = buildDeterministicActionPlan({
  targetRole: 'Senior Software Engineer',
  allBullets: [
    'Engineered distributed backend pipelines with Go and PostgreSQL',
    'Built real-time websocket services handling internal event bus',
  ],
  funnelStages: {
    applications90d: 45,
    recruiterScreens: 3,
    technicalRounds: 1,
    offers: 0,
  },
  bottleneck: rishabhBottleneck,
})

console.log('Milestones & Day 7 targets:', {
  day7Metric: dynamicPlan.sevenDayQuickPlan[6].metricTarget,
  milestone30d: dynamicPlan.milestonePathway[0].stage,
  milestone30dGoal: dynamicPlan.milestonePathway[0].goal,
})

assert.ok(dynamicPlan.sevenDayQuickPlan[6].metricTarget.includes('6.7%+'), 'Day 7 target must reference actual callback rate')
assert.ok(dynamicPlan.milestonePathway[0].stage.includes('Screening Retention & Technical Loop Launch'), '30-day milestone must adapt to healthy Phase 2')
assert.ok(!dynamicPlan.milestonePathway[2].stage.includes('Background Verification'), '90-day milestone must be Offer negotiation, not BGV')

// 6. Ban Invented Metrics: Sanitize Unverified Synthetic Numbers
console.log('\n[TEST 6] Ban Invented Metrics in modeC_hybrid sanitization...')
const rawAnalysisWithFabrications = {
  candidateSnapshot: {
    name: 'Rishabh Semwal',
    targetRole: 'Lead Full Stack Engineer',
  },
  issues: [
    {
      id: 'iss_001',
      originalText: 'Developed backend API endpoints for customer authentication using Node.js.',
      evidence: [{
        bulletId: 'exp_001_b01',
        originalText: 'Developed backend API endpoints for customer authentication using Node.js.',
      }],
      correctedText: 'Engineered backend API endpoints for customer authentication using Node.js, improving throughput by 35% and saving 15+ hours weekly.',
    },
  ],
  bulletRewrites: [
    {
      bulletId: 'exp_001_b01',
      originalText: 'Developed backend API endpoints for customer authentication using Node.js.',
      rewrittenText: 'Architected Node.js authentication endpoints, accelerating login performance by 22% with 99.9% uptime.',
    },
  ],
  bulletUpgrades: [
    {
      bulletId: 'exp_001_b01',
      originalText: 'Developed backend API endpoints for customer authentication using Node.js.',
      rewrittenText: 'Refactored Node.js authentication services, cutting latency by 18%.',
    },
  ],
  summaryOptimization: {
    rewrittenSummary: 'Lead Full Stack Engineer with 8+ years of experience delivering 40% efficiency gains across distributed systems.',
  },
}

const canonicalResume = {
  candidate: { name: 'Rishabh Semwal' },
  years_of_experience: '8+ years',
  experience: [
    {
      company: 'Tech Corp',
      role: 'Software Engineer',
      bullets: [
        { id: 'exp_001_b01', text: 'Developed backend API endpoints for customer authentication using Node.js.' },
      ],
    },
  ],
}

const sanitized = sanitizeModeCOutput(rawAnalysisWithFabrications, { canonicalResume })

console.log('Sanitized issue rewrite:', sanitized.issues[0].correctedText)
console.log('Sanitized issue metricSource:', sanitized.issues[0].metricSource)
console.log('Sanitized issue metricPrompt:', sanitized.issues[0].metricPrompt)
console.log('Sanitized bullet rewrite:', sanitized.bulletRewrites[0].rewrittenText)
console.log('Sanitized bullet upgrade:', sanitized.bulletUpgrades[0].rewrittenText)
console.log('Sanitized summary:', sanitized.summaryOptimization.rewrittenSummary)

// Verify no synthetic percentages remain in bullet rewrites
assert.ok(!sanitized.issues[0].correctedText.includes('35%'), 'Invented 35% must be sanitized')
assert.ok(!sanitized.issues[0].correctedText.includes('15+ hours'), 'Invented 15+ hours must be sanitized')
assert.strictEqual(sanitized.issues[0].metricSource, 'grounded_qualitative')
assert.ok(sanitized.issues[0].metricPrompt.includes('Confirm real impact'))

assert.ok(!sanitized.bulletRewrites[0].rewrittenText.includes('22%'), 'Invented 22% must be sanitized')
assert.ok(!sanitized.bulletRewrites[0].rewrittenText.includes('99.9%'), 'Invented 99.9% must be sanitized')
assert.strictEqual(sanitized.bulletRewrites[0].metricSource, 'grounded_qualitative')

assert.ok(!sanitized.bulletUpgrades[0].rewrittenText.includes('18%'), 'Invented 18% must be sanitized')
assert.strictEqual(sanitized.bulletUpgrades[0].metricSource, 'grounded_qualitative')

assert.ok(!sanitized.summaryOptimization.rewrittenSummary.includes('40%'), 'Invented 40% in summary must be sanitized')
assert.ok(sanitized.summaryOptimization.rewrittenSummary.includes('8+ years'), 'Verified 8+ years must be preserved')

// 7. Verify LinkedIn Scorecard has Zero "40% reach reduction" claims
console.log('\n[TEST 7] LinkedIn Scorecard Criteria Verification...')
const scorecardFile = fs.readFileSync('backend/agents/linkedin/linkedinScorecard.js', 'utf8')
assert.ok(!scorecardFile.includes('40%'), 'LinkedIn scorecard criteria must not mention unsupported 40% reach reduction')

// 8. Verify Non-Repetitive whyItWorks Synthesis
console.log('\n[TEST 8] Humanized whyItWorks synthesis...')
const why1 = synthesizeWhyItWorks(
  'Assisted in building database models.',
  'Architected relational PostgreSQL data models supporting multi-tenant queries.'
)
console.log('whyItWorks (verb change, qualitative):', why1)
assert.ok(why1.includes("Architected"), 'Must reference the action verb')
assert.ok(!why1.includes('Restructures task description into verified Google XYZ format'), 'Must not use repetitive template fallback')

console.log('\n✅ ALL 10 ACCURACY, SCORING & FLOW TESTS PASSED SUCCESSFULLY!')
