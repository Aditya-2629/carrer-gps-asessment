/**
 * Phase 2 Verification Suite: US Tech Hiring Market Persona Calibration
 *
 * Verifies:
 * 1. Seniority leveling across 4 tiers (Junior 1 YOE, Mid 4 YOE, Senior 7 YOE, Staff 12 YOE with 'Principal Architect' title).
 * 2. Trajectory Archetype classification (SWE to Data Engineer -> Career Transitioner; 12 YOE SWE -> Scaling Technical Leader).
 * 3. US Work Authorization parsing (STEM OPT, H-1B, US Citizen) & Score non-penalty.
 * 4. Sourcing channel hierarchy warning when user only selects LinkedIn Easy Apply.
 * 5. Downstream agent directives reflect calibrated seniority tone and trajectory guidance.
 */

import assert from 'assert'
import {
  resolveMarketPerimeter,
  getExternalContext,
  evaluateAssessmentPersona,
  computeCareerGpsScore,
} from '../agents/assessment/assessmentAgent.js'

async function runPhase2PersonaTests() {
  console.log('================================================================')
  console.log('PHASE 2: US TECH HIRING MARKET PERSONA & PERIMETER TEST SUITE')
  console.log('================================================================\n')

  // ── Test 1: Seniority Leveling Across 4 Tiers ─────────────────────────────
  console.log('--- Test 1: Seniority Leveling Across 4 Tiers ---')

  // Tier 1: Junior (1 YOE)
  const juniorPerimeter = resolveMarketPerimeter(
    { answers: { experience: '1 yr' } },
    { candidate: { yearsOfExperience: 1 }, experiences: [{ title: 'Junior Software Engineer', dates: '2025 - Present' }] }
  )
  console.log(`Junior (1 YOE) -> ${juniorPerimeter.seniorityTier} (effectiveYoe: ${juniorPerimeter.effectiveYoe})`)
  assert.strictEqual(juniorPerimeter.seniorityTier, 'Junior', '1 YOE classified as Junior')

  // Tier 2: Mid-Level (4 YOE)
  const midPerimeter = resolveMarketPerimeter(
    { answers: { experience: '4 yrs' } },
    { candidate: { yearsOfExperience: 4 }, experiences: [{ title: 'Software Engineer II', dates: '2022 - Present' }] }
  )
  console.log(`Mid-Level (4 YOE) -> ${midPerimeter.seniorityTier} (effectiveYoe: ${midPerimeter.effectiveYoe})`)
  assert.strictEqual(midPerimeter.seniorityTier, 'Mid-Level', '4 YOE classified as Mid-Level')

  // Tier 3: Senior (7 YOE)
  const seniorPerimeter = resolveMarketPerimeter(
    { answers: { experience: '7 yrs' } },
    { candidate: { yearsOfExperience: 7 }, experiences: [{ title: 'Senior Software Engineer', dates: '2019 - Present' }] }
  )
  console.log(`Senior (7 YOE) -> ${seniorPerimeter.seniorityTier} (effectiveYoe: ${seniorPerimeter.effectiveYoe})`)
  assert.strictEqual(seniorPerimeter.seniorityTier, 'Senior', '7 YOE classified as Senior')

  // Tier 4: Staff / Principal / Lead (12 YOE with 'Principal Architect' title)
  const staffPerimeter = resolveMarketPerimeter(
    { answers: { experience: '12 yrs' } },
    {
      candidate: { yearsOfExperience: 12 },
      experiences: [{ title: 'Principal Software Architect', dates: '2014 - Present' }],
    }
  )
  console.log(`Staff / Principal (12 YOE, Principal title) -> ${staffPerimeter.seniorityTier} (effectiveYoe: ${staffPerimeter.effectiveYoe})`)
  assert.strictEqual(staffPerimeter.seniorityTier, 'Staff / Principal / Lead', '12 YOE with Principal title classified as Staff / Principal / Lead')

  console.log('PASS: All 4 Seniority Tiers accurately resolved.\n')

  // ── Test 2: Trajectory Archetype Classification ───────────────────────────
  console.log('--- Test 2: Trajectory Archetype Classification ---')

  // Scenario A: SWE to Data Engineer -> Career Transitioner / Pivot
  const pivotPerimeter = resolveMarketPerimeter(
    { targetRole: 'Data Engineer', answers: { targetRole: 'Data Engineer', apps30d: 25 } },
    {
      candidate: { targetRole: 'Data Engineer' },
      experiences: [
        { title: 'Full Stack Engineer', dates: '2022 - Present' },
        { title: 'Software Developer', dates: '2020 - 2022' },
      ],
    }
  )
  console.log(`SWE -> Data Engineer -> Archetype: "${pivotPerimeter.trajectoryArchetype}"`)
  assert.strictEqual(pivotPerimeter.trajectoryArchetype, 'Career Transitioner / Pivot', 'SWE pivoting to Data Engineer is classified as Career Transitioner / Pivot')

  // Scenario B: 12 YOE SWE -> Scaling Technical Leader
  const leaderPerimeter = resolveMarketPerimeter(
    { targetRole: 'Staff Software Engineer', answers: { targetRole: 'Staff Software Engineer', apps30d: 20 } },
    {
      candidate: { targetRole: 'Staff Software Engineer', yearsOfExperience: 12 },
      experiences: [
        { title: 'Lead Architect', dates: '2018 - Present' },
        { title: 'Senior Software Engineer', dates: '2014 - 2018' },
      ],
    }
  )
  console.log(`12 YOE Lead -> Archetype: "${leaderPerimeter.trajectoryArchetype}"`)
  assert.strictEqual(leaderPerimeter.trajectoryArchetype, 'Scaling Technical Leader', '12 YOE Lead is classified as Scaling Technical Leader')

  // Scenario C: Mid-Level Engineer -> High-Velocity Accelerator
  const acceleratorPerimeter = resolveMarketPerimeter(
    { targetRole: 'Senior Backend Engineer', answers: { targetRole: 'Senior Backend Engineer', apps30d: 30 } },
    {
      candidate: { targetRole: 'Senior Backend Engineer', yearsOfExperience: 4 },
      experiences: [{ title: 'Backend Engineer', dates: '2022 - Present' }],
    }
  )
  console.log(`Mid-Level SWE -> Archetype: "${acceleratorPerimeter.trajectoryArchetype}"`)
  assert.strictEqual(acceleratorPerimeter.trajectoryArchetype, 'High-Velocity Accelerator', 'Mid-level engineer aiming for Senior is High-Velocity Accelerator')

  // Scenario D: Low Momentum / Gap -> Stalled / Re-Entering Professional
  const stalledPerimeter = resolveMarketPerimeter(
    { targetRole: 'Software Engineer', answers: { targetRole: 'Software Engineer', apps30d: 3 } },
    {
      candidate: { targetRole: 'Software Engineer', yearsOfExperience: 3 },
      experiences: [{ title: 'Software Engineer', dates: '2021 - 2023', isCurrent: false }],
    }
  )
  console.log(`Low momentum (3 apps/mo, past gap) -> Archetype: "${stalledPerimeter.trajectoryArchetype}"`)
  assert.strictEqual(stalledPerimeter.trajectoryArchetype, 'Stalled / Re-Entering Professional', 'Candidate with gap or low volume is Stalled / Re-Entering')

  console.log('PASS: Trajectory Archetypes accurately classified.\n')

  // ── Test 3: US Work Authorization Parsing & Score Non-Penalty ────────────
  console.log('--- Test 3: US Work Authorization Parsing & Score Non-Penalty ---')

  // Subtest 3A: STEM OPT
  const stemOptCtx = getExternalContext({
    targetRole: 'Cloud Architect',
    answers: { visa: 'F1 STEM OPT' },
  })
  console.log(`STEM OPT Note: ${stemOptCtx.constraints_note}`)
  assert(stemOptCtx.constraints_note.includes('90-day maximum cumulative unemployment clock'), 'Includes 90-day clock')
  assert(stemOptCtx.constraints_note.includes('mandatory employer E-Verify registration'), 'Includes E-Verify requirement')
  assert(stemOptCtx.constraints_note.includes('75% on verified sponsor tech firms'), 'Includes 75% sponsor recommendation')

  // Subtest 3B: H-1B Transfer
  const h1bCtx = getExternalContext({
    targetRole: 'Senior Backend Engineer',
    answers: { visa: 'H-1B Transfer' },
  })
  console.log(`H-1B Note: ${h1bCtx.constraints_note}`)
  assert(h1bCtx.constraints_note.includes('60-day grace period between employers'), 'Includes 60-day grace period')
  assert(h1bCtx.constraints_note.includes('prevailing wage compliance'), 'Includes prevailing wage compliance')

  // Subtest 3C: US Citizen / Green Card
  const citizenCtx = getExternalContext({
    targetRole: 'Principal Architect',
    answers: { visa: 'US Citizen' },
  })
  console.log(`Citizen Note: ${citizenCtx.constraints_note}`)
  assert(citizenCtx.constraints_note.includes('Unrestricted federal, defense, and healthcare enterprise mobility'), 'Highlights unrestricted federal/defense mobility')

  // Subtest 3D: Strict Non-Penalty Guarantee (Scores must be identical regardless of visa)
  const baseAnswers = {
    targetRole: 'Senior Full Stack Engineer',
    apps30d: 40,
    outreach: 8,
    funnel90d: { screens: 5, technicalRounds: 2, finalRounds: 1, offers: 0 },
    searchMethods: ['Employee Referrals & Direct Outreach'],
  }
  const scoreVisaOpt = computeCareerGpsScore({ answers: { ...baseAnswers, visa: 'F1 STEM OPT' } })
  const scoreVisaCitizen = computeCareerGpsScore({ answers: { ...baseAnswers, visa: 'US Citizen' } })

  console.log(`Score (STEM OPT): ${scoreVisaOpt.gps_score} / 100`)
  console.log(`Score (US Citizen): ${scoreVisaCitizen.gps_score} / 100`)
  assert.strictEqual(
    scoreVisaOpt.gps_score,
    scoreVisaCitizen.gps_score,
    'Career GPS Score MUST NEVER be penalized for US visa or work authorization status'
  )
  console.log('PASS: Work Authorization correctly contextualized with strict zero-score-penalty guarantee.\n')

  // ── Test 4: Sourcing Channel Hierarchy & Easy Apply Warning ───────────────
  console.log('--- Test 4: Sourcing Channel Hierarchy & Warning ---')

  const easyApplyCtx = getExternalContext({
    targetRole: 'Software Engineer',
    answers: { searchMethods: ['LinkedIn Easy Apply'] },
  })
  console.log(`Funnel Tier: ${easyApplyCtx.recruiter_priority_funnel.currentTier}`)
  console.log(`Funnel Warning: ${easyApplyCtx.recruiter_priority_funnel.warning}`)
  console.log(`Funnel Recommendation: ${easyApplyCtx.recruiter_priority_funnel.recommendation}`)

  assert(easyApplyCtx.recruiter_priority_funnel.currentTier.includes('Tier 5'), 'Assigned Tier 5')
  assert(easyApplyCtx.recruiter_priority_funnel.recommendation.includes('WARNING'), 'Emits WARNING recommendation')
  assert(easyApplyCtx.recruiter_priority_funnel.recommendation.includes('reallocate at least 50%'), 'Advises 50% reallocation')
  assert.strictEqual(easyApplyCtx.recruiter_priority_funnel.hierarchy.length, 5, 'Hierarchy contains 5 tiers with US conversion rates')
  assert(easyApplyCtx.recruiter_priority_funnel.hierarchy[1].includes('18–25% response rate'), 'Tier 2 documents 18-25% conversion')
  assert(easyApplyCtx.recruiter_priority_funnel.hierarchy[2].includes('5–8% response rate'), 'Tier 3 documents 5-8% conversion')
  assert(easyApplyCtx.recruiter_priority_funnel.hierarchy[4].includes('<2% response rate'), 'Tier 5 documents <2% black hole conversion')

  console.log('PASS: Sourcing channel hierarchy and black hole warnings accurately verified.\n')

  // ── Test 5: Seniority Tone and Downstream Agent Directives ─────────────────
  console.log('--- Test 5: Seniority Tone and Downstream Agent Directives ---')

  // Scenario 5A: Junior Persona Directives
  const juniorPersona = evaluateAssessmentPersona({
    answers: { targetRole: 'Frontend Developer', experience: '1 yr' },
    resumeContext: {
      canonicalResume: {
        candidate: { yearsOfExperience: 1 },
        experiences: [{ title: 'Junior Web Developer', dates: '2025 - Present' }],
      },
    },
  })
  console.log(`Junior Directives: ${juniorPersona.agentDirectives.forResumeAgent}`)
  assert(
    juniorPersona.agentDirectives.forResumeAgent.includes('Focus on verifiable production repositories, unit test coverage, and avoiding generic tutorial clones.'),
    'Junior directive emphasizes production repos and unit test coverage'
  )
  assert.strictEqual(juniorPersona.candidateProfile.seniorityTier, 'Junior')

  // Scenario 5B: Mid-Level Persona Directives
  const midPersona = evaluateAssessmentPersona({
    answers: { targetRole: 'Backend Engineer', experience: '4 yrs' },
    resumeContext: {
      canonicalResume: {
        candidate: { yearsOfExperience: 4 },
        experiences: [{ title: 'Software Engineer II', dates: '2022 - Present' }],
      },
    },
  })
  assert(
    midPersona.agentDirectives.forResumeAgent.includes('Focus on end-to-end service ownership, business metrics, and database/API performance tuning.'),
    'Mid-level directive emphasizes service ownership and API tuning'
  )
  assert.strictEqual(midPersona.candidateProfile.seniorityTier, 'Mid-Level')

  // Scenario 5C: Senior Persona Directives
  const seniorPersona = evaluateAssessmentPersona({
    answers: { targetRole: 'Senior Infrastructure Engineer', experience: '7 yrs' },
    resumeContext: {
      canonicalResume: {
        candidate: { yearsOfExperience: 7 },
        experiences: [{ title: 'Senior SRE', dates: '2019 - Present' }],
      },
    },
  })
  assert(
    seniorPersona.agentDirectives.forResumeAgent.includes('Focus on system architecture, concurrency, distributed caching, cross-team impact, and mentorship.'),
    'Senior directive emphasizes distributed caching and cross-team impact'
  )
  assert.strictEqual(seniorPersona.candidateProfile.seniorityTier, 'Senior')

  // Scenario 5D: Staff / Principal Persona Directives
  const staffPersona = evaluateAssessmentPersona({
    answers: { targetRole: 'Staff Software Engineer', experience: '11 yrs' },
    resumeContext: {
      canonicalResume: {
        candidate: { yearsOfExperience: 11 },
        experiences: [{ title: 'Lead Architect', dates: '2015 - Present' }],
      },
    },
  })
  assert(
    staffPersona.agentDirectives.forResumeAgent.includes('Focus on multi-team technical strategy, business-critical architectural trade-offs, executive presence, and organizational leverage.'),
    'Staff directive emphasizes multi-team technical strategy and trade-off defense'
  )
  assert.strictEqual(staffPersona.candidateProfile.seniorityTier, 'Staff / Principal / Lead')
  assert(staffPersona.agentDirectives.forAtlas.includes('EXECUTIVE SUMMARY PERSONA'), 'Atlas directive includes executive persona summary')
  assert(staffPersona.agentDirectives.forAtlas.includes('US MARKET SOURCING CONSTRAINT'), 'Atlas directive includes US sourcing constraints')

  // Verify candidateProfile exposures
  assert.strictEqual(staffPersona.candidateProfile.trajectoryArchetype, 'Scaling Technical Leader')
  assert.ok(staffPersona.candidateProfile.workAuthDetails, 'workAuthDetails exposed on candidateProfile')
  assert.strictEqual(typeof staffPersona.candidateProfile.effectiveYoe, 'number')

  console.log('PASS: All agent directives and candidate profile attributes calibrated to seniority.\n')

  console.log('================================================================')
  console.log('ALL 5 PHASE 2 US PERSONA & MARKET PERIMETER TESTS PASSED! 🚀')
  console.log('================================================================\n')
}

runPhase2PersonaTests().catch((err) => {
  console.error('\nFAIL: Phase 2 US Persona Test Failed with Error:\n', err)
  process.exit(1)
})
