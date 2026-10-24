/**
 * Test Suite for LinkedIn Agent & Cross-Agent Orchestration
 *
 * Verifies:
 * 1. Clean barrel exports via backend/agents/linkedin/index.js
 * 2. Deterministic data cleaning and normalization (Apify HTML, missing values, counts)
 * 3. ResumeAgent.prepareCanonicalContext deterministic execution
 * 4. LinkedIn deterministic signals (SEO, completeness, visibility)
 * 5. Cross-agent discrepancy engine (timelineMismatches, titleDrift, skillGaps, droppedImpact)
 * 6. 100-point rubric scorecard compliance with report contract (branding, visibility, completeness, alignment)
 * 7. Fallback behavior when LinkedIn data is null
 * 8. Fallback behavior when resume context is null
 * 9. Structured prompt builder & persona verification
 * 10. Generative optimizer (headlines, aboutRewrite, recommendedSkillsToAdd, profileRedFlags)
 * 11. LLM error recovery: graceful deterministic fallback
 * 12. End-to-end orchestrator runCareerAgents context bridging
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import {
  normalizeLinkedInProfile,
  extractLinkedInSignals,
  analyzeCrossAgentDiscrepancies,
  computeLinkedInScorecard,
  synthesizeLinkedInOptimizations,
  buildDeterministicOptimizations,
  buildLinkedInUserPrompt,
  LINKEDIN_SYSTEM_PROMPT,
  analyzeLinkedInProfile,
  evaluateLinkedIn,
  LINKEDIN_AGENT_VERSION,
} from '../agents/linkedin/index.js'
import { runCareerAgents } from '../agents/orchestrator.js'
import { judgeReport } from '../agents/judge/judgeAgent.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runTests() {
  console.log('================================================================')
  console.log('LINKEDIN AGENT PHASE 2 & CROSS-ORCHESTRATION VERIFICATION SUITE')
  console.log('================================================================\n')

  // ── Test 1: Barrel Imports & Normalizer ───────────────────────────────────
  console.log('--- Test 1: Data Cleaning & Normalization (linkedinNormalizer) ---')
  const rawScrapedMessy = {
    fullName: '   <b>Swapnil Jadhav</b>   ',
    headline: 'Software Engineer &amp; Builder | not specified',
    about: '<p>Building distributed systems with <b>Python</b> and Node.js.</p>',
    experiences: [
      {
        title: 'Full Stack Developer',
        company: 'Apex Intelligence Labs',
        dates: '2020 – Present',
        description: '   Working on <span class="highlight">internal web tools</span>.   ',
        isCurrent: true,
      },
      {
        title: 'n/a',
        company: 'not specified',
      },
    ],
    skills: ['Python', { name: 'Docker' }, 'python', 'Go, SQL'],
    connections: '500+ connections',
    recommendations: '2 recommendations',
    url: 'https://www.linkedin.com/in/swapnil-jadhav-dev',
  }

  const normalized = normalizeLinkedInProfile(rawScrapedMessy)
  assert.strictEqual(normalized.fullName, 'Swapnil Jadhav', 'HTML stripped from name')
  assert.strictEqual(normalized.about, 'Building distributed systems with Python and Node.js.', 'HTML stripped from about')
  assert.strictEqual(normalized.connectionsCount, 500, '500+ connections parsed as 500')
  assert.strictEqual(normalized.recommendationsCount, 2, '2 recommendations parsed as 2')
  assert.strictEqual(normalized.hasCustomUrl, true, 'Custom vanity URL identified')
  assert.strictEqual(normalized.experiences.length, 1, 'Empty/placeholder experience filtered out')
  assert(normalized.skills.includes('Python'), 'Skills extracted and deduplicated')
  assert(normalized.skills.includes('Docker'), 'Object skills extracted')
  assert(normalized.skills.includes('SQL'), 'Delimited skills parsed')
  console.log('PASS: Normalizer cleanly handled HTML, placeholders, counts, and skills arrays')

  // Load a test resume fixture from backend/tests/fixtures/
  const swapnilRaw = fs.readFileSync(
    path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )

  // ── Test 2: Stage 1 Deterministic Fact Extraction ─────────────────────────
  console.log('\n--- Test 2: ResumeAgent.prepareCanonicalContext ---')
  const resumeContext = await ResumeAgent.prepareCanonicalContext({
    resumeText: swapnilRaw,
    targetRole: 'Senior AI & Full Stack Engineer',
  })

  assert(resumeContext.canonicalResume, 'canonicalResume must be produced')
  assert(resumeContext.extractedFacts?.facts?.length > 0, 'Extracted facts must be populated')
  assert.strictEqual(resumeContext.targetRole, 'Senior AI & Full Stack Engineer')
  assert(resumeContext.signals, 'Signals must be computed')
  assert(resumeContext.precomputedSignals, 'Precomputed signals must be present')
  console.log(`PASS: Extracted ${resumeContext.extractedFacts.facts.length} facts in Stage 1 without LLM`)

  // ── Test 3: LinkedIn Deterministic Signal Engine ──────────────────────────
  console.log('\n--- Test 3: Deterministic Pre-Audit Signals ---')
  const sampleProfile = {
    fullName: 'Swapnil Jadhav',
    headline: 'Software Engineer',
    about: 'I write code and build software applications.',
    connectionsCount: 150,
    recommendationsCount: 0,
    url: 'https://www.linkedin.com/in/swapnil-jadhav-123456',
    experiences: [
      {
        company: 'Apex Intelligence Labs',
        title: 'Full Stack Developer',
        dates: '2020 – Present',
        description: 'Working on internal web tools.',
      },
    ],
    skills: ['Python', 'Docker'],
  }

  const signals = extractLinkedInSignals(sampleProfile, resumeContext)
  assert.strictEqual(signals.headline.isTooShort, true, 'Headline should be flagged as too short (<5 words)')
  assert.strictEqual(signals.headline.hasStructuredSeparators, false, 'No separator formatting in basic headline')
  assert.strictEqual(signals.about.isThin, true, 'About should be flagged as thin (<200 chars)')
  assert.strictEqual(signals.about.hasMetrics, false, 'About has no metrics')
  assert.strictEqual(signals.visibility.connectionBracket, '<200', 'Connection bracket should be <200')
  assert.strictEqual(signals.visibility.hasRecommendations, false, 'No recommendations')
  console.log('PASS: Correctly extracted all deterministic SEO and visibility signals')

  // ── Test 4: Cross-Agent Discrepancy Engine ───────────────────────────────
  console.log('\n--- Test 4: Cross-Agent Discrepancy Detection ---')
  const cross = analyzeCrossAgentDiscrepancies(sampleProfile, resumeContext, signals)

  assert(Array.isArray(cross.titleDrift) && cross.titleDrift.length > 0, 'titleDrift array populated')
  const titleDrift = cross.titleDrift.find((d) => d.type === 'title_drift')
  assert(titleDrift, 'Must detect Title Drift at Apex Intelligence Labs')
  console.log(`PASS: Detected titleDrift: Resume ("${titleDrift.resumeClaim}") vs LinkedIn ("${titleDrift.linkedinClaim}")`)

  assert(Array.isArray(cross.timelineMismatches) && cross.timelineMismatches.length > 0, 'timelineMismatches array populated')
  const timelineDrift = cross.timelineMismatches.find((d) => d.type === 'timeline_drift')
  assert(timelineDrift, 'Must detect timelineMismatches at Apex Intelligence Labs')
  console.log(`PASS: Detected timelineMismatches: Resume (${timelineDrift.resumeClaim}) vs LinkedIn (${timelineDrift.linkedinClaim})`)

  assert(Array.isArray(cross.droppedImpact) && cross.droppedImpact.length > 0, 'droppedImpact array populated')
  console.log(`PASS: Detected droppedImpact from resume: "${cross.droppedImpact[0].sampleResumeProof.slice(0, 60)}..."`)

  assert(Array.isArray(cross.skillGaps) && cross.skillGaps.length > 0, 'skillGaps array populated')
  console.log(`PASS: Detected skillGaps: ${cross.missingSkills.length} verified resume skills missing from LinkedIn: ${cross.missingSkills.slice(0, 4).join(', ')}`)

  // ── Test 5: 100-Point Scorecard Rubric ───────────────────────────────────
  console.log('\n--- Test 5: 100-Point Scorecard Rubric ---')
  const scorecard = computeLinkedInScorecard(signals, cross, resumeContext.targetRole)
  assert(typeof scorecard.score === 'number' && scorecard.score >= 0 && scorecard.score <= 100, 'Score must be 0-100')
  assert(scorecard.grade, 'Grade must be present')
  assert(scorecard.grades.branding, 'Branding category (30%) must exist')
  assert(scorecard.grades.visibility, 'Visibility category (25%) must exist')
  assert(scorecard.grades.completeness, 'Completeness category (20%) must exist')
  assert(scorecard.grades.alignment, 'Alignment category (25%) must exist')
  assert(scorecard.grades.consistency, 'Consistency alias must exist')
  assert(scorecard.checks.length >= 8, 'Must have at least 8 checks')
  assert(scorecard.issues.length > 0, 'Must surface issues')
  console.log(`PASS: Scorecard generated cleanly: Score ${scorecard.score}/100 (Grade: ${scorecard.grade}) with 4 weighted categories`)

  // ── Test 6: Fallback Behavior (Null Profile & Null Resume) ───────────────
  console.log('\n--- Test 6: Graceful Degradation & Fallbacks ---')
  const nullProfileResult = analyzeLinkedInProfile(null, resumeContext)
  assert.strictEqual(nullProfileResult.dataAvailable, false, 'Null profile returns dataAvailable: false')
  assert.strictEqual(nullProfileResult.score, 0, 'Null profile score is 0')
  assert.strictEqual(nullProfileResult.grade, 'F', 'Null profile grade is F')
  console.log('PASS: Handled null profile with zero exceptions')

  const standaloneProfileResult = analyzeLinkedInProfile(sampleProfile, null)
  assert.strictEqual(standaloneProfileResult.dataAvailable, true, 'Standalone profile without resume audits properly')
  assert(standaloneProfileResult.score > 0, 'Standalone profile receives valid audit score')
  console.log('PASS: Handled standalone profile audit without resume context')

  // ── Test 7: Prompt Builder & Persona ─────────────────────────────────────
  console.log('\n--- Test 7: Prompt Builder & Persona Verification ---')
  assert(LINKEDIN_SYSTEM_PROMPT.includes('Liam / Sophia'), 'Prompt has Liam / Sophia recruiter persona')
  assert(LINKEDIN_SYSTEM_PROMPT.includes('ZERO-HALLUCINATION'), 'Prompt enforces zero-hallucination guardrail')
  const userPrompt = buildLinkedInUserPrompt({
    profile: sampleProfile,
    resumeContext,
    discrepancies: cross.discrepancies,
    signals,
  })
  assert(userPrompt.includes('TARGET ROLE: Senior AI & Full Stack Engineer'), 'User prompt embeds target role')
  assert(userPrompt.includes('VERIFIED RESUME EVIDENCE'), 'User prompt embeds resume ground truth')
  assert(userPrompt.includes('PRIORITY RESUME SKILLS MISSING'), 'User prompt embeds missing skills')
  console.log('PASS: Prompt builder generates complete recruiter evidence payload')

  // ── Setup Mock LLM for Generative Tests ─────────────────────────────────
  const origGenerate = llmGateway.generate
  llmGateway.generate = async (params) => {
    const isLinkedIn = (params.messages || []).some(
      (m) => typeof m.content === 'string' && m.content.includes('LinkedIn Profile Strategist')
    )

    if (isLinkedIn) {
      return {
        text: JSON.stringify({
          headlines: [
            {
              formula: 'Recruiter-Search Optimized',
              headline: 'Senior AI & Full Stack Engineer | Python, FastMCP, React',
              whyItWorks: 'Direct search match for core stack.',
            },
            {
              formula: 'Impact-Driven',
              headline: 'Senior AI Engineer | 35% Faster Retrieval with FastMCP Agents',
              whyItWorks: 'Highlights verified performance benchmark.',
            },
            {
              formula: 'Specialist / Authority',
              headline: 'Principal AI Systems Specialist | Scalable RAG Architectures',
              whyItWorks: 'High-level technical authority.',
            },
          ],
          aboutRewrite: {
            hook: 'I engineer high-concurrency distributed AI backends and RAG agent pipelines.',
            proof: 'At Apex Intelligence Labs, I architected a 9-tool FastMCP agent yielding 35% faster retrieval.',
            callToAction: "Currently looking for Senior AI & Full Stack roles. Let's connect!",
            fullText: "I engineer high-concurrency distributed AI backends and RAG agent pipelines.\n\nAt Apex Intelligence Labs, I architected a 9-tool FastMCP agent yielding 35% faster retrieval.\n\nCurrently looking for Senior AI & Full Stack roles. Let's connect!",
          },
          recommendedSkillsToAdd: ['FastMCP', 'ChromaDB', 'Redis', 'Docker'],
          profileRedFlags: [
            {
              title: 'Headline omits target role keywords',
              explanation: 'Generic titles like Software Engineer reduce clickthroughs in recruiter candidate searches.',
              fix: 'Update headline to Senior AI & Full Stack Engineer.',
            },
            {
              title: 'Zero metrics in experience descriptions',
              explanation: 'Hiring managers skim for proof of business outcome and latency reduction.',
              fix: 'Include 35% retrieval improvement metric directly in role description.',
            },
          ],
        }),
        actualModel: 'mock-llm',
        tokens: { prompt: 120, completion: 180 },
      }
    }

    return {
      text: JSON.stringify({
        analysisVersion: '2.2',
        candidateSnapshot: {
          name: 'Swapnil Jadhav',
          targetRole: 'Senior AI & Full Stack Engineer',
          presentRole: 'Senior AI & Full Stack Engineer',
          presentCompany: 'Apex Intelligence Labs',
        },
        overallReview: {
          score: 88,
          summary: 'Excellent engineering resume with strong quantifiable outcomes.',
        },
        issues: [
          {
            id: 'iss_001',
            bulletId: 'exp_001_b01',
            severity: 'low',
            category: 'ats_readability',
            title: 'Streamline phrasing for faster skimming',
            diagnosis: 'Slightly dense technical description.',
            recommendation: 'Keep opening verbs punchy.',
          },
        ],
        strengths: [
          {
            id: 'str_001',
            bulletId: 'exp_001_b01',
            title: 'Quantified retrieval benchmark',
            description: 'Direct measurement of 35% latency reduction.',
          },
        ],
      }),
      actualModel: 'mock-llm',
      tokens: { prompt: 300, completion: 250 },
    }
  }

  try {
    // ── Test 8: Generative Optimizer & Zero-Hallucination Guardrails ───────
    console.log('\n--- Test 8: Generative Optimizer & Zero-Hallucination Output ---')
    const synth = await synthesizeLinkedInOptimizations(
      sampleProfile,
      resumeContext,
      cross.missingSkills,
      cross.discrepancies,
      signals
    )
    assert(Array.isArray(synth.headlines) && synth.headlines.length === 3, 'Must produce exactly 3 headline formulas')
    assert(synth.aboutRewrite?.hook && synth.aboutRewrite?.proof && synth.aboutRewrite?.callToAction, 'Must produce 3-paragraph About rewrite')
    assert(Array.isArray(synth.recommendedSkillsToAdd) && synth.recommendedSkillsToAdd.length > 0, 'Must produce recommendedSkillsToAdd')
    assert(Array.isArray(synth.profileRedFlags) && synth.profileRedFlags.length >= 2, 'Must produce profileRedFlags')

    const formulas = synth.headlines.map((h) => h.formula)
    assert(formulas.includes('Recruiter-Search Optimized'), 'Must include Recruiter-Search Optimized formula')
    assert(formulas.includes('Impact-Driven'), 'Must include Impact-Driven formula')
    assert(formulas.includes('Specialist / Authority'), 'Must include Specialist / Authority formula')
    console.log('PASS: Produced 3 targeted headline formulas, 3-paragraph About rewrite, and recruiter red flags')

    // ── Test 9: Full evaluateLinkedIn Pipeline ──────────────────────────────
    console.log('\n--- Test 9: Full evaluateLinkedIn Pipeline ---')
    const fullEval = await evaluateLinkedIn({
      linkedinData: sampleProfile,
      resumeContext,
      runLlm: true,
    })
    assert.strictEqual(fullEval.agent, 'linkedin')
    assert.strictEqual(fullEval.version, LINKEDIN_AGENT_VERSION)
    assert(fullEval.discrepancies.length > 0, 'Discrepancies must be surfaced')
    assert(fullEval.timelineMismatches.length > 0, 'timelineMismatches must be populated')
    assert(fullEval.titleDrift.length > 0, 'titleDrift must be populated')
    assert(fullEval.skillGaps.length > 0, 'skillGaps must be populated')
    assert(fullEval.optimizations?.headlines?.length === 3, 'Optimizations must be populated')
    assert(fullEval.optimizations?.profileRedFlags?.length >= 2, 'Red flags must be populated')
    assert(fullEval.checks.length > 0, 'Scorecard checks must be populated')
    console.log('PASS: Full evaluateLinkedIn pipeline executed with discrete cross-analysis arrays and optimizations')

    // ── Test 10: Graceful Fallback When LLM Fails ──────────────────────────
    console.log('\n--- Test 10: LLM Failure Graceful Degradation ---')
    llmGateway.generate = async () => {
      throw new Error('503 Service Unavailable: Groq/Gemini overloaded')
    }
    const fallbackResult = await evaluateLinkedIn({
      linkedinData: sampleProfile,
      resumeContext,
      runLlm: true,
    })
    assert.strictEqual(fallbackResult.dataAvailable, true, 'Analysis completes even when LLM fails')
    assert(fallbackResult.optimizations?.isFallback === true, 'Fallback flag is true')
    assert(fallbackResult.optimizations?.headlines?.length === 3, 'Fallback still provides 3 headlines')
    assert(fallbackResult.optimizations?.aboutRewrite?.fullText, 'Fallback still provides About rewrite')
    console.log('PASS: Gracefully fell back to deterministic optimizations when LLM threw error')

    // ── Test 11: End-to-End Orchestrator Graceful Execution ────────────────
    console.log('\n--- Test 11: Orchestrator runCareerAgents Graceful Execution ---')
    // Restore mock response for orchestrator
    llmGateway.generate = async () => ({
      text: JSON.stringify({
        analysisVersion: '2.2',
        candidateSnapshot: { name: 'Swapnil Jadhav', targetRole: 'Senior AI & Full Stack Engineer' },
        overallReview: { score: 88, summary: 'Strong resume' },
        issues: [{ id: 'iss_001', bulletId: 'exp_001_b01', severity: 'low', category: 'ats_readability', title: 'Streamline', diagnosis: 'Dense', recommendation: 'Punchy' }],
        strengths: [],
      }),
      actualModel: 'mock-llm',
      tokens: { prompt: 200, completion: 200 },
    })

    const orchestratorResult = await runCareerAgents({
      resumeBuffer: Buffer.from(swapnilRaw),
      resumeName: 'swapnil-jadhav.txt',
      resumeTargetRole: 'Senior AI & Full Stack Engineer',
      linkedinData: sampleProfile,
      cacheMode: 'bypass',
    })
    assert(orchestratorResult.linkedinAgent, 'Orchestrator returned linkedinAgent analysis')
    assert.strictEqual(orchestratorResult.linkedinAgent.dataAvailable, true)
    assert(orchestratorResult.linkedinAgent.score > 0)
    assert(orchestratorResult.resumeAgent, 'Orchestrator returned resumeAgent analysis')
    console.log(`PASS: Orchestrator completed with linkedinAgent score: ${orchestratorResult.linkedinAgent.score}`)

    // ── Test 12: Isolation Verification (LinkedIn Failure Never Halts Resume) ─
    console.log('\n--- Test 12: Isolation Verification (LinkedIn Failure Never Halts Resume) ---')
    // Simulate LinkedIn failure by passing invalid profile that throws or fails synthesis
    const isolationResult = await runCareerAgents({
      resumeBuffer: Buffer.from(swapnilRaw),
      resumeName: 'swapnil-jadhav.txt',
      resumeTargetRole: 'Senior AI & Full Stack Engineer',
      linkedinData: {
        get url() { throw new Error('Simulated scraper network crash') },
      },
      cacheMode: 'bypass',
    })
    assert(isolationResult.resumeAgent, 'Resume Agent must succeed even if LinkedIn throws')
    assert.strictEqual(isolationResult.linkedinAgent, null, 'LinkedIn Agent safely returns null on failure')
    console.log('PASS: Resume Agent successfully generated even when LinkedIn agent threw an exception')

    // ── Test 13: Guaranteed Execution (Null LinkedIn Data With Resume Context) ─
    console.log('\n--- Test 13: Guaranteed Execution (Null LinkedIn Data With Resume Context) ---')
    const nullLinkedInResult = await runCareerAgents({
      resumeBuffer: Buffer.from(swapnilRaw),
      resumeName: 'swapnil-jadhav.txt',
      resumeTargetRole: 'Senior AI & Full Stack Engineer',
      linkedinData: null,
      cacheMode: 'bypass',
    })
    assert(nullLinkedInResult.resumeAgent, 'Resume Agent must succeed when linkedinData is null')
    assert(nullLinkedInResult.linkedinAgent, 'LinkedIn Agent must NOT be skipped when resumeBuffer is supplied')
    assert.strictEqual(nullLinkedInResult.linkedinAgent.inferredFromResume, true, 'LinkedIn Agent correctly infers profile from resume')
    assert.strictEqual(nullLinkedInResult.linkedinAgent.dataAvailable, true, 'LinkedIn Agent dataAvailable is true')
    assert(nullLinkedInResult.linkedinAgent.score > 0, 'LinkedIn Agent generates score based on inferred profile')

    // Verify complete null fallback when neither resume nor profile is provided
    const completeNullResult = await runCareerAgents({
      resumeBuffer: null,
      linkedinData: null,
      cacheMode: 'bypass',
    })
    assert.strictEqual(completeNullResult.resumeAgent, null)
    assert.strictEqual(completeNullResult.linkedinAgent, null, 'LinkedIn Agent safely returns null when no inputs exist')
    console.log('PASS: Guaranteed LinkedIn Agent executed with inferred profile, and complete null safely returned null')

    // ── Test 14: Report Generation Bundle Integration ────────────────────────
    console.log('\n--- Test 14: Report Generation Bundle Integration ---')
    const mockReport = {
      career_health_score: 82,
      critical_issues: [],
    }
    // Simulate reportGeneration.js bundling
    mockReport.resume_agent = orchestratorResult.resumeAgent
    mockReport.linkedin_agent = orchestratorResult.linkedinAgent

    assert(mockReport.resume_agent, 'aiReport.resume_agent cleanly bundled')
    assert(mockReport.linkedin_agent, 'aiReport.linkedin_agent cleanly bundled')
    assert.strictEqual(mockReport.linkedin_agent.version, '4.0.0')
    assert(mockReport.linkedin_agent.checks.length > 0)
    console.log('PASS: aiReport cleanly bundles resume_agent and upgraded linkedin_agent (V4.0.0)')

    // ── Test 15: Judge Agent Quality Checks with Upgraded LinkedIn Agent ──────
    console.log('\n--- Test 15: Judge Agent Recognition of Upgraded LinkedIn Agent ---')
    const judgeResult = await judgeReport(mockReport)
    assert(judgeResult.success, 'Judge report successfully audited the report bundle')
    assert(typeof judgeResult.result?.score === 'number', 'Judge produced a numerical score')
    console.log(`PASS: Judge successfully evaluated report with linkedin_agent (score: ${judgeResult.result.score}/10, fallback: ${judgeResult.result.fallback})`)
  } finally {
    llmGateway.generate = origGenerate
  }

  console.log('\n================================================================')
  console.log('ALL 15 LINKEDIN AGENT PHASE 1, 2 & 3 TESTS PASSED!')
  console.log('================================================================\n')
}

runTests().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})
