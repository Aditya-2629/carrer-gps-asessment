/**
 * testPhase5AtlasAndJudge.js
 *
 * Verification suite for Phase 5: Master Atlas System Prompt & Judge Agent Quality Gate.
 * Validates:
 * 1. Master Atlas prompt generation across 3 seniority tiers (Junior, Senior, Staff).
 *    - Strict negative constraints & zero corporate filler in prompt narrative.
 *    - Seniority-calibrated directives.
 *    - All 13 JSON schema sections strictly present.
 * 2. Overwrite protection in normalizeAtlasShapes (preserves candidate-specific LLM coach narrative).
 * 3. Judge Agent heuristic quality gate penalizes filler phrases and verifies mathematical integrity.
 */

import assert from 'assert'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import { normalizeAtlasShapes } from '../services/reportGeneration.js'
import { judgeReport } from '../agents/judge/judgeAgent.js'

console.log('================================================================')
console.log('CAREER GPS PHASE 5: MASTER ATLAS & JUDGE QUALITY VERIFICATION')
console.log('================================================================\n')

async function runTests() {
  // -----------------------------------------------------------------
  // TEST 1: Master Atlas Prompt Seniority Calibration & Zero Filler
  // -----------------------------------------------------------------
  console.log('--- TEST 1: Master Atlas Prompt Persona & Level Calibration ---')

  const personas = [
    {
      level: 'Junior',
      seniorityTier: 'Junior',
      trajectory: 'Career Transitioner / Pivot',
      name: 'Maya Patel',
      role: 'Junior Frontend Engineer',
      phase: { id: 1, name: 'Resume → Screening Call', shortName: 'Top of Funnel' },
      expectedDirectives: 'Junior (0–2 YOE)',
    },
    {
      level: 'Senior',
      seniorityTier: 'Senior',
      trajectory: 'High-Velocity Technical Accelerator',
      name: 'David Kim',
      role: 'Senior Full Stack Engineer',
      phase: { id: 2, name: 'Recruiter Screen → Technical Round', shortName: 'Screening Choke' },
      expectedDirectives: 'Senior (6–9 YOE)',
    },
    {
      level: 'Staff',
      seniorityTier: 'Staff / Principal / Lead',
      trajectory: 'Scaling Technical Leader',
      name: 'Alex Chen',
      role: 'Staff Backend Architect',
      phase: { id: 3, name: 'Technical Round → Final Round', shortName: 'Technical Gate' },
      expectedDirectives: 'Staff / Lead (10+ YOE)',
    },
  ]

  const requiredSections = [
    'career_health_score',
    'score_label',
    'score_breakdown',
    'market_reality_check',
    'career_journey',
    'funnel_stages',
    'rejection_factors',
    'rejection_insight',
    'risk_heatmap',
    'mission_board',
    'critical_issues',
    'roadmap',
    'recommended_tools',
    'coach_intervention',
  ]

  const bannedFillerWords = [
    'navigating the job market',
    'in conclusion',
    'it is crucial',
    'testament to',
    'delve',
    'synergies',
    'holistic',
  ]

  for (const p of personas) {
    const prompt = getGeminiPrompt(
      { visa: 'US Citizen' },
      { candidate: { name: p.name, targetRole: p.role } },
      null,
      null,
      null,
      null,
      null,
      { seniorityTier: p.seniorityTier, trajectory: p.trajectory, phase: p.phase }
    )

    assert.ok(typeof prompt === 'string', 'Prompt must be a string')
    assert.ok(prompt.length > 3000, `Prompt length (${prompt.length}) should be complete`)

    // Verify executive voice and directives
    assert.ok(
      prompt.includes('You are "Atlas"'),
      'Must define Atlas persona'
    )
    assert.ok(
      prompt.includes('ZERO AI FILLER TOLERANCE'),
      'Must contain ZERO AI FILLER TOLERANCE directive'
    )
    assert.ok(
      prompt.includes(p.expectedDirectives),
      `Must include level directive for ${p.level}`
    )
    assert.ok(
      prompt.includes(`CURRENT LEVEL FOR THIS CANDIDATE: ${p.seniorityTier}`),
      `Must include current level focus for ${p.seniorityTier}`
    )

    // Verify negative constraints explicitly listed in directive
    for (const banned of bannedFillerWords) {
      assert.ok(
        prompt.includes(banned),
        `Directive must explicitly ban "${banned}"`
      )
    }

    // Verify prompt does NOT use filler in its own instructions (outside directive line)
    const promptWithoutDirective = prompt.replace(/ZERO AI FILLER TOLERANCE:[^\n]+/g, '')
    for (const banned of bannedFillerWords) {
      assert.strictEqual(
        promptWithoutDirective.includes(banned),
        false,
        `Prompt narrative must not use banned filler phrase "${banned}"`
      )
    }

    // Verify all 13-14 schema sections are strictly present
    for (const sec of requiredSections) {
      assert.ok(
        prompt.includes(`"${sec}"`),
        `Prompt schema must include section "${sec}"`
      )
    }
  }

  console.log('✔ Test 1 Passed: Master Atlas prompt dynamically adapts to Junior, Senior, and Staff tiers with zero filler.\n')

  // -----------------------------------------------------------------
  // TEST 2: Dynamic Coach Intervention & Overwrite Protection
  // -----------------------------------------------------------------
  console.log('--- TEST 2: Coach Intervention Overwrite Protection ---')

  const customUrgency = 'Your 45 direct applications to Datadog and Stripe stalled at the system architecture round due to lack of trade-off defense.'
  const customValueProp = 'In your 1-on-1 Strategy Call, we run a live mock evaluation on your top distributed caching project and map 15 direct VP leads.'

  const modelReport = {
    funnel_stages: {
      applications_count: 45,
      recruiter_calls_count: 3,
      biggest_leak_stage: 'Technical Architecture Round',
    },
    coach_intervention: {
      urgency_statement: customUrgency,
      value_prop: customValueProp,
      cta_text: 'Book Free 1-on-1 Strategy Session',
    },
  }

  const normalized = normalizeAtlasShapes(modelReport, { targetRole: 'Senior Backend Engineer' })

  // Verify that LLM-generated narrative was preserved, NOT wiped by static strings
  assert.strictEqual(
    normalized.coach_intervention.urgency_statement,
    customUrgency,
    'normalizeAtlasShapes must PRESERVE valid model-generated urgency_statement'
  )
  assert.strictEqual(
    normalized.coach_intervention.value_prop,
    customValueProp,
    'normalizeAtlasShapes must PRESERVE valid model-generated value_prop'
  )
  assert.strictEqual(
    normalized.coach_intervention.cta_text,
    'Book Free 1-on-1 Strategy Session',
    'CTA text must be standard high-converting string'
  )

  // Verify fallback behavior when model returns empty coach_intervention
  const emptyReport = {
    funnel_stages: {
      applications_count: 50,
      recruiter_calls_count: 1,
      biggest_leak_stage: 'Recruiter Screening Choke Point',
    },
    coach_intervention: {},
  }
  const normalizedFallback = normalizeAtlasShapes(emptyReport, { targetRole: 'Data Architect' })
  assert.ok(
    normalizedFallback.coach_intervention.urgency_statement.includes('Recruiter Screening Choke Point') ||
    normalizedFallback.coach_intervention.urgency_statement.includes('Polished resume bullets'),
    'Fallback urgency statement must be dynamically anchored to leak title'
  )
  assert.ok(
    normalizedFallback.coach_intervention.value_prop.length > 30,
    'Fallback value prop must provide clear strategy call value'
  )

  console.log('✔ Test 2 Passed: Coach intervention preserves LLM personalization and provides robust fallback.\n')

  // -----------------------------------------------------------------
  // TEST 3: Judge Agent Strict Heuristic Quality Gate & Filler Penalty
  // -----------------------------------------------------------------
  console.log('--- TEST 3: Judge Agent Heuristic Quality Gate & Filler Penalty ---')

  // Report WITH corporate AI filler phrases
  const dirtyReport = {
    career_health_score: 64,
    market_reality_check: { headline: 'Navigating the job market requires synergies' },
    coach_intervention: {
      urgency_statement: 'In conclusion, it is crucial to delve into your resume strengths as a testament to your ability.',
    },
    critical_issues: [
      { title: 'Resume ATS gap', diagnosis: 'Missing keywords', action_steps: ['Add tools'] },
    ],
  }

  const dirtyResult = await judgeReport(dirtyReport)
  assert.strictEqual(dirtyResult.success, true, 'Judge execution should succeed')
  const dirtyScore = dirtyResult.result

  // Must cap tone and overall score due to filler
  assert.ok(dirtyScore.score <= 5, `Overall score should be capped at <= 5 when filler is detected (got ${dirtyScore.score})`)
  assert.strictEqual(dirtyScore.subscores.tone, 4, 'Tone subscore must be capped at 4/10 for filler')
  assert.ok(
    dirtyScore.flags.some((f) => /corporate filler/i.test(f)),
    'Flags must include corporate filler repair directive'
  )

  // Clean report WITHOUT corporate AI filler
  const cleanReport = {
    career_health_score: 82,
    resume_agent: {
      overallReview: {
        summary: 'Your resume shows strong hands-on distributed systems impact at Datadog with quantified latency reductions.',
      },
      issues: [
        {
          title: 'Missing AWS EKS Keyword',
          whyItMatters: 'ATS keyword filters drop applications before recruiter review.',
          recommendation: 'Add production EKS cluster orchestration metric to experience section.',
          evidence: { originalText: 'Managed Kubernetes infrastructure across 5 production clusters.' },
          severity: 'medium',
        },
        {
          title: 'Unquantified Migration Impact',
          whyItMatters: 'Recruiters cannot gauge cost savings or throughput scale.',
          recommendation: 'State exact latency drop and dollar savings.',
          evidence: { originalText: 'Migrated Postgres DB to CockroachDB.' },
          severity: 'high',
        },
      ],
    },
    critical_issues: [
      {
        title: 'ATS Parser Optimization',
        diagnosis: 'Single column layout extracts cleanly.',
        action_steps: ['Validate single-column PDF export'],
        evidence: 'Experience block in plain text',
      },
    ],
  }

  const cleanResult = await judgeReport(cleanReport)
  assert.strictEqual(cleanResult.success, true, 'Judge execution should succeed')
  const cleanScore = cleanResult.result

  assert.ok(cleanScore.score >= 7, `Clean report should score >= 7 (got ${cleanScore.score})`)
  assert.ok(cleanScore.subscores.tone >= 7, `Clean report tone should score >= 7 (got ${cleanScore.subscores.tone})`)
  assert.strictEqual(
    cleanScore.flags.some((f) => /corporate filler/i.test(f)),
    false,
    'Clean report must NOT have corporate filler flag'
  )

  console.log('✔ Test 3 Passed: Judge Agent quality gate strictly penalizes corporate filler and rewards grounded evidence.\n')

  console.log('================================================================')
  console.log('🎉 ALL PHASE 5 ATLAS & JUDGE QUALITY TESTS PASSED!')
  console.log('================================================================')
}

runTests().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})
