/**
 * End-to-End LinkedIn Agent Pipeline Verification Test Suite
 *
 * Scenarios tested:
 * - Scenario A: Normal Profile + Matching Resume → Check that scorecard generates,
 *   cross-analyzer passes, and headlines are generated.
 * - Scenario B: Role / Date Discrepancy → Profile says "Junior Dev", Resume says "Senior Engineer"
 *   → Verify discrepancy engine flags title drift and timeline mismatch.
 * - Scenario C: Missing Skills → Resume has "Kubernetes, Next.js", Profile has 0 tech skills
 *   → Verify skill gaps are identified and listed in missingSkills.
 * - Scenario D: Graceful Degradation → Pass linkedinData = null / network crash
 *   → Confirm system returns dataAvailable: false and handles failures without crashing.
 */

import assert from 'assert'
import {
  evaluateLinkedIn,
  analyzeLinkedInProfile,
  normalizeLinkedInProfile,
  extractLinkedInSignals,
  analyzeCrossAgentDiscrepancies,
  computeLinkedInScorecard,
  LINKEDIN_AGENT_VERSION,
} from '../agents/linkedin/index.js'
import { runCareerAgents } from '../agents/orchestrator.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'

async function runPipelineTests() {
  console.log('================================================================')
  console.log('LINKEDIN AGENT PHASE 5 — PIPELINE VERIFICATION SUITE')
  console.log('================================================================\n')

  const origGenerate = llmGateway.generate

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO A: Normal Profile + Matching Resume
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- Scenario A: Normal Profile + Matching Resume ---')

    const matchingResumeContext = {
      targetRole: 'Senior Full Stack Engineer',
      canonicalResume: {
        candidate: { name: 'Alex Morgan', targetRole: 'Senior Full Stack Engineer' },
        summary: 'Senior Full Stack Engineer with 7+ years building enterprise SaaS platforms.',
        experiences: [
          {
            id: 'exp_001',
            role: 'Senior Full Stack Engineer',
            company: 'TechFlow Solutions',
            startDate: '2021',
            endDate: 'Present',
            isCurrent: true,
            bullets: [
              {
                id: 'exp_001_b01',
                text: 'Architected distributed event-driven microservices serving 4M active users with 99.99% uptime.',
              },
            ],
          },
        ],
        skills: [
          { name: 'Python' },
          { name: 'React' },
          { name: 'Node.js' },
          { name: 'AWS' },
          { name: 'Docker' },
        ],
      },
      extractedFacts: {
        facts: [
          { type: 'technology', value: 'Python' },
          { type: 'technology', value: 'React' },
          { type: 'technology', value: 'Node.js' },
          { type: 'technology', value: 'AWS' },
          { type: 'technology', value: 'Docker' },
        ],
      },
    }

    const matchingLinkedInProfile = {
      fullName: 'Alex Morgan',
      headline: 'Senior Full Stack Engineer | React, Node.js, Python & AWS | Distributed Systems',
      about:
        'Senior Full Stack Engineer with 7+ years of experience building scalable enterprise web platforms.\n\nAt TechFlow Solutions, I architected distributed microservices serving 4M active users with 99.99% uptime.\n\nOpen to discussing leadership and senior engineering opportunities in high-growth cloud environments.',
      experiences: [
        {
          title: 'Senior Full Stack Engineer',
          company: 'TechFlow Solutions',
          dates: '2021 – Present',
          isCurrent: true,
          description: 'Architecting distributed microservices and modern cloud applications.',
        },
      ],
      skills: ['React', 'Node.js', 'Python', 'AWS', 'Docker'],
      connections: '500+ connections',
      recommendations: '5 recommendations',
      url: 'https://www.linkedin.com/in/alex-morgan-swe',
    }

    // Mock LLM generation for Scenario A
    llmGateway.generate = async () => ({
      text: JSON.stringify({
        headlines: [
          {
            formula: 'Recruiter-Search Optimized',
            headline: 'Senior Full Stack Engineer | React, Node.js, Python & AWS',
            whyItWorks: 'Matches high-volume recruiter boolean search filters for full-stack leads.',
          },
          {
            formula: 'Impact-Driven',
            headline: 'Senior Full Stack Engineer | Architected Systems for 4M+ Active Users',
            whyItWorks: 'Leads with verified production scale and reliability impact.',
          },
          {
            formula: 'Specialist / Authority',
            headline: 'Distributed Systems & Cloud Engineer | React & Cloud Architect',
            whyItWorks: 'Positions candidate as a domain authority in distributed architectures.',
          },
        ],
        aboutRewrite: {
          hook: 'I am a Senior Full Stack Engineer specializing in resilient cloud platforms.',
          proof: 'At TechFlow Solutions, I architected distributed microservices serving 4M active users.',
          callToAction: 'Connect with me to discuss high-scale engineering challenges.',
          fullText:
            'I am a Senior Full Stack Engineer specializing in resilient cloud platforms.\n\nAt TechFlow Solutions, I architected distributed microservices serving 4M active users.\n\nConnect with me to discuss high-scale engineering challenges.',
        },
        recommendedSkillsToAdd: ['System Design', 'PostgreSQL'],
        profileRedFlags: [],
      }),
      actualModel: 'mock-llm',
      tokens: { prompt: 150, completion: 150 },
    })

    const resultA = await evaluateLinkedIn({
      profile: matchingLinkedInProfile,
      resumeContext: matchingResumeContext,
      runLlm: true,
    })

    assert.strictEqual(resultA.dataAvailable, true, 'Scenario A: dataAvailable must be true')
    assert(resultA.score >= 60, `Scenario A: matching profile should have solid score (got ${resultA.score})`)
    assert.strictEqual(resultA.timelineMismatches.length, 0, 'Scenario A: no timeline mismatches')
    assert.strictEqual(resultA.titleDrift.length, 0, 'Scenario A: no title drift')
    assert(resultA.optimizations, 'Scenario A: optimizations generated')
    assert.strictEqual(resultA.optimizations.headlines.length, 3, 'Scenario A: 3 headlines generated')
    assert(resultA.optimizations.aboutRewrite?.fullText, 'Scenario A: About narrative generated')
    console.log(`PASS Scenario A: Clean matching profile generated score ${resultA.score}/100 (${resultA.grade}) with 0 discrepancies and 3 headline strategies.`)

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO B: Role / Date Discrepancy (Title Drift & Timeline Mismatch)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario B: Role / Date Discrepancy (Title Drift & Timeline Mismatch) ---')

    const seniorResumeContext = {
      targetRole: 'Senior Staff Engineer',
      canonicalResume: {
        candidate: { name: 'Jordan Lee', targetRole: 'Senior Staff Engineer' },
        experiences: [
          {
            id: 'exp_001',
            role: 'Senior Staff Engineer',
            company: 'OmniCloud Technologies',
            startDate: 'January 2022',
            endDate: 'Present',
            isCurrent: true,
            bullets: [{ text: 'Led infrastructure modernization reducing compute costs by 35%.' }],
          },
        ],
        skills: [{ name: 'Go' }, { name: 'Kubernetes' }],
      },
    }

    const driftedLinkedInProfile = {
      fullName: 'Jordan Lee',
      headline: 'Junior Web Developer at OmniCloud | Learning React',
      about: 'Enthusiastic beginner web developer building side projects.',
      experiences: [
        {
          title: 'Junior Web Developer',
          company: 'OmniCloud Technologies',
          dates: '2019 – 2021', // Timeline divergence: 2019-2021 vs Resume Jan 2022 - Present
          isCurrent: false,
        },
      ],
      skills: ['HTML', 'CSS'],
    }

    const resultB = analyzeLinkedInProfile(driftedLinkedInProfile, seniorResumeContext)

    assert.strictEqual(resultB.dataAvailable, true)
    assert(resultB.discrepancies.length > 0, 'Scenario B: Discrepancies must be detected')

    const titleDriftFound = resultB.discrepancies.some(
      (d) => d.type === 'title_drift' || /title/i.test(d.title)
    )
    assert(titleDriftFound, 'Scenario B: Must flag title drift (Junior Web Developer vs Senior Staff Engineer)')

    const timelineDriftFound = resultB.discrepancies.some(
      (d) => d.type === 'timeline_drift' || /timeline|date/i.test(d.title)
    )
    assert(timelineDriftFound, 'Scenario B: Must flag timeline mismatch')

    // Check checks array contains warnings for discrepancies
    const titleCheck = resultB.checks.find((c) => c.id === 'li_title_align')
    assert(titleCheck, 'Scenario B: li_title_align check must exist')
    assert.strictEqual(titleCheck.status, 'fail', 'Scenario B: li_title_align check must fail due to drift')

    const timelineCheck = resultB.checks.find((c) => c.id === 'li_timeline_align')
    assert(timelineCheck, 'Scenario B: li_timeline_align check must exist')
    assert.strictEqual(timelineCheck.status, 'fail', 'Scenario B: li_timeline_align check must fail due to timeline drift')
    console.log('PASS Scenario B: Discrepancy engine accurately flagged title drift and timeline mismatch.')

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO C: Missing Skills Gaps
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario C: Missing Skills Gaps ---')

    const heavyTechResumeContext = {
      targetRole: 'Cloud Native Architect',
      canonicalResume: {
        candidate: { name: 'Sam Taylor', targetRole: 'Cloud Native Architect' },
        skills: [
          { name: 'Kubernetes' },
          { name: 'Next.js' },
          { name: 'Terraform' },
          { name: 'TypeScript' },
          { name: 'Kafka' },
        ],
      },
      extractedFacts: {
        facts: [
          { type: 'technology', value: 'Kubernetes' },
          { type: 'technology', value: 'Next.js' },
          { type: 'technology', value: 'Terraform' },
          { type: 'technology', value: 'TypeScript' },
          { type: 'technology', value: 'Kafka' },
        ],
      },
    }

    const zeroTechLinkedInProfile = {
      fullName: 'Sam Taylor',
      headline: 'Architect | Team Builder',
      about: 'Passionate about leading engineering teams and building great software.',
      experiences: [
        {
          title: 'Cloud Native Architect',
          company: 'Acme Cloud',
          dates: '2022 – Present',
          isCurrent: true,
        },
      ],
      skills: [], // Zero tech skills on profile
    }

    const resultC = analyzeLinkedInProfile(zeroTechLinkedInProfile, heavyTechResumeContext)

    assert(resultC.missingSkills.length >= 2, 'Scenario C: Must detect missing skills')
    assert(
      resultC.missingSkills.includes('Kubernetes'),
      'Scenario C: Must identify Kubernetes as missing'
    )
    assert(
      resultC.missingSkills.includes('Next.js'),
      'Scenario C: Must identify Next.js as missing'
    )

    const skillCheck = resultC.checks.find((c) => c.id === 'li_skills' || c.id === 'li_skills_align')
    assert(skillCheck, 'Scenario C: Skills check must exist')
    assert.notStrictEqual(skillCheck.status, 'pass', 'Scenario C: Skills check must not pass when zero skills present')
    console.log(`PASS Scenario C: Identified ${resultC.missingSkills.length} missing verified skills (${resultC.missingSkills.join(', ')})`)

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO D: Graceful Degradation & Fault Tolerance
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario D: Graceful Degradation & Fault Tolerance ---')

    // Test D1: Pass null profile to evaluateLinkedIn
    const nullResult = await evaluateLinkedIn({ linkedinData: null, profile: null })
    assert.strictEqual(nullResult.dataAvailable, false, 'D1: dataAvailable must be false')
    assert.strictEqual(nullResult.score, 0, 'D1: score must be 0')
    assert.strictEqual(nullResult.grade, 'F', 'D1: grade must be F')
    assert.deepStrictEqual(nullResult.checks, [], 'D1: checks must be empty array')
    assert.deepStrictEqual(nullResult.issues, [], 'D1: issues must be empty array')
    console.log('PASS Scenario D1: Null profile returns dataAvailable: false safely without throwing')

    // Test D2: Pass empty string / corrupted profile
    const corruptedResult = analyzeLinkedInProfile('not a profile object')
    assert.strictEqual(corruptedResult.dataAvailable, false, 'D2: corrupt input handled gracefully')
    console.log('PASS Scenario D2: Corrupted profile input handled gracefully')

    // Test D3: Orchestrator isolation when linkedinData is null
    const orchResultNull = await runCareerAgents({
      resumeBuffer: null,
      linkedinData: null,
      cacheMode: 'bypass',
    })
    assert.strictEqual(orchResultNull.resumeAgent, null)
    assert.strictEqual(orchResultNull.linkedinAgent, null)
    console.log('PASS Scenario D3: Orchestrator cleanly returns null agents when inputs are null')

    // Test D4: Fallback optimizations when LLM throws error
    llmGateway.generate = async () => {
      throw new Error('503 Service Unavailable: Rate limit reached')
    }
    const fallbackResult = await evaluateLinkedIn({
      profile: matchingLinkedInProfile,
      resumeContext: matchingResumeContext,
      runLlm: true,
    })
    assert.strictEqual(fallbackResult.dataAvailable, true)
    assert(fallbackResult.optimizations?.isFallback === true, 'D4: Fallback flag must be set')
    assert.strictEqual(fallbackResult.optimizations.headlines.length, 3, 'D4: Fallback must provide 3 headlines')
    assert(fallbackResult.optimizations.aboutRewrite?.fullText, 'D4: Fallback must provide About rewrite')
    console.log('PASS Scenario D4: Deterministic fallback successfully generated optimizations when LLM threw error')
  } finally {
    llmGateway.generate = origGenerate
  }

  console.log('\n================================================================')
  console.log('ALL LINKEDIN AGENT PIPELINE VERIFICATION SCENARIOS PASSED!')
  console.log('================================================================\n')
}

runPipelineTests().catch((err) => {
  console.error('Scenario test failed:', err)
  process.exit(1)
})
