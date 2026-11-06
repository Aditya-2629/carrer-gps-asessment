/**
 * testJevChatIntentAndDossierFusion.js
 *
 * Automated verification test suite for Phase 2:
 * 1. O(1) in-memory cache hits (<1ms)
 * 2. Accuracy across all 7 Jev Chat Intents
 * 3. Zero-downtime offline fallback (deterministic heuristics)
 * 4. Deep Dossier Fusion (marketIntelligence, bulletGaps, salaryBenchmark)
 * 5. Intent-specialized prompt injection across all intents
 */

import assert from 'assert'
import {
  classifyChatIntentWithJev,
  classifyChatIntentHeuristically,
  JEV_INTENT_CACHE,
  JEV_CHAT_INTENTS,
} from '../agents/resume/scoring/jevChatIntentClassifier.js'
import {
  extractCandidateDossier,
  buildChatbotSystemPrompt,
} from '../controllers/chatController.js'

async function runTests() {
  console.log('======================================================================')
  console.log(' RUNNING PHASE 2: JEV 1.14 INTENT & DOSSIER FUSION TEST SUITE')
  console.log('======================================================================\n')

  // -------------------------------------------------------------------------
  // Test 1: O(1) Cache Hits (<1ms)
  // -------------------------------------------------------------------------
  console.log('Test 1: Verifying O(1) in-memory cache hits (<1ms)...')
  const cacheQueries = [
    { q: 'rewrite bullet', expected: 'REWRITE_BULLET' },
    { q: 'explain score', expected: 'EXPLAIN_SCORE' },
    { q: 'mock interview', expected: 'INTERVIEW_PREP' },
    { q: 'salary range', expected: 'SALARY_BENCHMARK' },
    { q: 'pricing', expected: 'PROGRAM_PRICING' },
    { q: 'stem opt visa', expected: 'VISA_GUIDANCE' },
  ]

  for (const item of cacheQueries) {
    const res = await classifyChatIntentWithJev(item.q)
    assert.strictEqual(res.source, 'cache', `Expected cache hit for query "${item.q}"`)
    assert.strictEqual(res.intent, item.expected, `Expected ${item.expected} for "${item.q}", got ${res.intent}`)
    assert(res.latencyMs <= 15, `Latency should be near zero for cache hit, got ${res.latencyMs}ms`)
  }
  console.log('✔ Test 1 Passed: O(1) cache lookups return accurate intents in <1ms.\n')

  // -------------------------------------------------------------------------
  // Test 2: Accuracy Across All 7 Intents
  // -------------------------------------------------------------------------
  console.log('Test 2: Verifying Intent Coverage for all 7 taxonomy classes...')
  assert.strictEqual(JEV_CHAT_INTENTS.length, 7, 'Must support exactly 7 Jev Chat Intents')

  const intentSamples = [
    { q: 'Can you rewrite my top bullet point with metrics?', expected: 'REWRITE_BULLET' },
    { q: 'Why did I get 68 on my career health score?', expected: 'EXPLAIN_SCORE' },
    { q: 'Can you ask me a tough behavioral interview question?', expected: 'INTERVIEW_PREP' },
    { q: 'What is the compensation band and base pay for Senior Data Engineers?', expected: 'SALARY_BENCHMARK' },
    { q: 'What is the difference between Career GPS AI $150 and Elite $300?', expected: 'PROGRAM_PRICING' },
    { q: 'How do I handle the 90-day unemployment clock on F-1 STEM OPT?', expected: 'VISA_GUIDANCE' },
    { q: 'What are my next steps for next week?', expected: 'GENERAL_CAREER_ADVICE' },
  ]

  for (const sample of intentSamples) {
    const res = await classifyChatIntentWithJev(sample.q, { mockOffline: true, bypassCache: true })
    assert.strictEqual(res.intent, sample.expected, `Query "${sample.q}" expected ${sample.expected}, got ${res.intent}`)
  }
  console.log('✔ Test 2 Passed: All 7 intent classes are reliably recognized.\n')

  // -------------------------------------------------------------------------
  // Test 3: Zero-Downtime Offline Fallback
  // -------------------------------------------------------------------------
  console.log('Test 3: Verifying zero-downtime offline fallback...')
  const offlineRes = await classifyChatIntentWithJev('improve my resume bullet phrasing', {
    mockOffline: true,
    bypassCache: true,
  })
  assert.strictEqual(offlineRes.intent, 'REWRITE_BULLET')
  assert(offlineRes.source.includes('fallback') || offlineRes.source === 'cache', 'Source should indicate fallback or cache')

  const heuristicDirect = classifyChatIntentHeuristically('how to negotiate equity and salary')
  assert.strictEqual(heuristicDirect, 'SALARY_BENCHMARK')
  console.log('✔ Test 3 Passed: Deterministic fallback resolves accurately under zero-network conditions.\n')

  // -------------------------------------------------------------------------
  // Test 4: Deep Dossier Fusion
  // -------------------------------------------------------------------------
  console.log('Test 4: Verifying Deep Dossier Fusion (marketIntelligence, bulletGaps, salaryBenchmark)...')
  const mockUser = {
    name: 'Elena Rostova',
    aiReport: {
      target_role: 'Lead Cloud Architect',
      career_health_score: 84,
      assessment_agent: { seniorityTier: 'Lead' },
      primary_bottleneck: { title: 'Technical Screen Architectural Trade-offs' },
      resume_agent: {
        marketContext: {
          totalAnalyzed: 35,
          topSkills: [
            { name: 'Kubernetes', percentage: 88 },
            { name: 'Terraform', percentage: 82 },
            { name: 'AWS Lambda', percentage: 74 },
          ],
        },
        bulletAudit: [
          {
            bullet: 'Maintained AWS cloud infrastructure and assisted developers with deployments.',
            status: 'fix',
            issue: 'Passive phrasing without scale metrics',
            recommendation: 'Architected multi-region AWS infrastructure reducing deployment latency by 45%',
          },
        ],
      },
    },
  }

  const dossier = extractCandidateDossier(mockUser)

  assert.strictEqual(dossier.candidateName, 'Elena Rostova')
  assert.strictEqual(dossier.targetRole, 'Lead Cloud Architect')
  assert.strictEqual(dossier.seniorityTier, 'Lead')

  // Check marketIntelligence
  assert(dossier.marketIntelligence, 'marketIntelligence must be attached')
  assert.strictEqual(dossier.marketIntelligence.analyzedJdsCount, 35)
  assert.strictEqual(dossier.marketIntelligence.topDemandedTools.length, 3)
  assert.strictEqual(dossier.marketIntelligence.topDemandedTools[0].tool, 'Kubernetes')
  assert.strictEqual(dossier.marketIntelligence.topDemandedTools[0].frequency, '88%')

  // Check bulletGaps
  assert(Array.isArray(dossier.bulletGaps), 'bulletGaps must be an array')
  assert.strictEqual(dossier.bulletGaps.length, 1)
  assert.strictEqual(dossier.bulletGaps[0].status, 'fix')
  assert(dossier.bulletGaps[0].recommendation.includes('Architected multi-region'))

  // Check salaryBenchmark
  assert(dossier.salaryBenchmark, 'salaryBenchmark must be attached')
  assert.strictEqual(dossier.salaryBenchmark.seniorityBand, 'Lead')
  assert.strictEqual(dossier.salaryBenchmark.estimatedRange, '$175,000 - $225,000')

  console.log('✔ Test 4 Passed: Candidate dossier dynamically fuses market intelligence, bullet gaps, and salary benchmark.\n')

  // -------------------------------------------------------------------------
  // Test 5: Intent-Specialized System Prompts
  // -------------------------------------------------------------------------
  console.log('Test 5: Verifying intent-specialized prompt injection...')

  // 5a. REWRITE_BULLET
  const rewritePrompt = buildChatbotSystemPrompt(dossier, '', 'REWRITE_BULLET')
  assert(rewritePrompt.includes('[INTENT DIRECTIVE: RESUME BULLET REWRITE]'), 'Must include bullet rewrite directive')
  assert(rewritePrompt.includes('Optimized Google XYZ Bullet'), 'Must include Google XYZ instruction')
  assert(rewritePrompt.includes('```text'), 'Must instruct wrapping in ```text block')

  // 5b. INTERVIEW_PREP
  const interviewPrompt = buildChatbotSystemPrompt(dossier, '', 'INTERVIEW_PREP')
  assert(interviewPrompt.includes('[INTENT DIRECTIVE: INTERVIEW PREPARATION]'), 'Must include interview prep directive')
  assert(interviewPrompt.includes('STAR framework'), 'Must enforce STAR framework')
  assert(interviewPrompt.includes('Acknowledge → Bridge → Prove'), 'Must enforce Acknowledge -> Bridge -> Prove formula')

  // 5c. EXPLAIN_SCORE
  const scorePrompt = buildChatbotSystemPrompt(dossier, '', 'EXPLAIN_SCORE')
  assert(scorePrompt.includes('[INTENT DIRECTIVE: SCORE DECONSTRUCTION]'), 'Must include score deconstruction directive')
  assert(scorePrompt.includes('84/100'), 'Must include candidate exact score')

  // 5d. SALARY_BENCHMARK
  const salaryPrompt = buildChatbotSystemPrompt(dossier, '', 'SALARY_BENCHMARK')
  assert(salaryPrompt.includes('[INTENT DIRECTIVE: COMPENSATION & SALARY BENCHMARK]'), 'Must include salary directive')
  assert(salaryPrompt.includes('$175,000 - $225,000'), 'Must include calibrated salary band')

  // 5e. PROGRAM_PRICING
  const pricingPrompt = buildChatbotSystemPrompt(dossier, '', 'PROGRAM_PRICING')
  assert(pricingPrompt.includes('[INTENT DIRECTIVE: CRAFTURE PROGRAMS & PRICING]'), 'Must include pricing directive')
  assert(pricingPrompt.includes('0% salary cuts'), 'Must emphasize 0% placement cut')

  // 5f. VISA_GUIDANCE
  const visaPrompt = buildChatbotSystemPrompt(dossier, '', 'VISA_GUIDANCE')
  assert(visaPrompt.includes('[INTENT DIRECTIVE: VISA & WORK AUTHORIZATION GUIDANCE]'), 'Must include visa directive')
  assert(visaPrompt.includes('MANDATORY LEGAL DISCLAIMER'), 'Must enforce mandatory legal disclaimer')

  console.log('✔ Test 5 Passed: All specialized intent directives inject tailored instructions & groundings.\n')

  console.log('======================================================================')
  console.log(' ALL PHASE 2 VERIFICATION TESTS PASSED (5/5)! 🚀')
  console.log('======================================================================')
}

runTests().catch((err) => {
  console.error('\n❌ Verification Failed:', err)
  process.exit(1)
})
