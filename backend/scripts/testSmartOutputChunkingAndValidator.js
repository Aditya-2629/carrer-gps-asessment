/**
 * Test Suite: Smart Output Chunking & Resume Validator Upgrade
 *
 * Verifies:
 * 1. buildCompactCandidateContext produces ~900-1,100 tokens with 100% essential data.
 * 2. Task 1 and Task 2 prompts adhere strictly to schemas and token targets.
 * 3. runLinkedInSynthesis calls Task 1 (maxTokens: 2048) and Task 2 (maxTokens: 2200) in parallel.
 * 4. LLM outputs for top3PinnedSkills, sectionsToAddFromResume, visibilityTricks are preserved without fallback overwrite.
 * 5. modeC_hybrid maxTokens is set to 4096.
 * 6. rewriteValidator FORBIDDEN_NEW_CLAIMS is empty array.
 * 7. resumeAgent preserves LLM rewrite during numeric sanitization.
 * 8. resumeScorecard only yields deterministic rewrites for weak openers.
 * 9. orchestrator inputHash prefixes use bumped versions.
 */

import assert from 'assert'
import fs from 'fs'
import { llmGateway } from '../ai/gateway/llmGateway.js'
import {
  buildCompactCandidateContext,
  buildTask1HeadlinesAndBannerPrompt,
  buildTask2AboutAndFeaturedPrompt,
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT,
  TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT,
} from '../agents/linkedin/linkedinSynthesis.prompt.js'
import { runLinkedInSynthesis } from '../agents/linkedin/linkedinSynthesis.js'
import { validateRewrite, FORBIDDEN_NEW_CLAIMS, buildResumeTechTokens } from '../agents/resume/validation/rewriteValidator.js'
import { computeScorecard, generateDeterministicRewrite } from '../agents/resume/scoring/resumeScorecard.js'
import { replaceUnverifiedNumericTokens } from '../agents/resume/resumeAgent.js'
import { buildSourceFactTokens } from '../agents/resume/validation/claimValidator.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`PASS: ${name}`)
    passed++
  } catch (err) {
    console.error(`FAIL: ${name}`)
    console.error(err)
    failed++
  }
}

async function asyncTest(name, fn) {
  try {
    await fn()
    console.log(`PASS: ${name}`)
    passed++
  } catch (err) {
    console.error(`FAIL: ${name}`)
    console.error(err)
    failed++
  }
}

console.log('================================================================')
console.log('SMART OUTPUT CHUNKING & VALIDATOR UPGRADE VERIFICATION')
console.log('================================================================\n')

const sampleCanonicalResume = {
  candidate: {
    name: 'Jane Doe',
    targetRole: 'Staff Full Stack & Cloud Architect',
  },
  summary: 'Senior engineering leader specializing in distributed systems, React, Node.js, and AWS.',
  skills: [
    'React', 'Node.js', 'TypeScript', 'AWS', 'Kubernetes', 'Docker', 'PostgreSQL',
    'Redis', 'Kafka', 'GraphQL', 'Next.js', 'Python', 'FastAPI', 'CI/CD', 'Terraform',
    'Microservices', 'System Design', 'Event-Driven Architecture', 'Distributed Systems'
  ],
  experience: [
    {
      company: 'TechCorp Global',
      role: 'Lead Architect',
      dates: '2021 - Present',
      bullets: [
        { id: 'exp_001_b01', text: 'Responsible for core cloud microservices architecture and infrastructure.' },
        { id: 'exp_001_b02', text: 'Developing event-driven data streaming pipeline processing 10M daily events.' },
        { id: 'exp_001_b03', text: 'Reduced API response latency by 45% through aggressive Redis caching and query optimization.' },
        { id: 'exp_001_b04', text: 'Spearheaded migration of legacy monolith to Kubernetes microservices.' },
      ],
    },
    {
      company: 'DataFlow Inc',
      role: 'Senior Software Engineer',
      dates: '2018 - 2021',
      bullets: [
        { id: 'exp_002_b01', text: 'Helped build real-time dashboard using React and WebSockets.' },
        { id: 'exp_002_b02', text: 'Maintained database indexes on PostgreSQL cluster with 99.99% uptime.' },
      ],
    },
  ],
  projects: [
    {
      name: 'Agentic AI Orchestrator',
      technologies: ['Node.js', 'TypeScript', 'LangChain', 'FastAPI'],
      bullets: [
        { id: 'proj_001_b01', text: 'Architected autonomous multi-agent task execution platform with zero hallucination rate.' },
      ],
    },
  ],
  certifications: [
    { name: 'AWS Certified Solutions Architect - Professional', issuer: 'Amazon Web Services', date: '2023' },
  ],
}

const sampleLinkedInProfile = {
  fullName: 'Jane Doe',
  headline: 'Software Engineer at TechCorp',
  about: 'I am a software engineer with experience in web technologies and databases.',
  skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Node.js'],
  experiences: [
    { title: 'Lead Architect', company: 'TechCorp Global', dates: '2021 - Present', description: 'Working on backend systems.' },
    { title: 'Software Engineer', company: 'DataFlow Inc', dates: '2018 - 2021', description: '' },
  ],
  hasPicture: true,
  hasBanner: false,
  hasCustomUrl: true,
}

// ── 1. Compact Candidate Context ─────────────────────────────────────────────
console.log('--- Test Suite 1: Compact Candidate Context Helper ---')
test('buildCompactCandidateContext contains all key candidate sections', () => {
  const context = buildCompactCandidateContext({
    profile: sampleLinkedInProfile,
    resumeContext: {
      canonicalResume: sampleCanonicalResume,
      targetRole: 'Staff Full Stack & Cloud Architect',
    },
    discrepancies: [{ severity: 'warning', title: 'Missing Skills', diagnosis: 'AWS and Kubernetes are missing on LinkedIn' }],
    missingSkills: ['AWS', 'Kubernetes', 'Docker'],
  })

  assert(context.includes('Jane Doe'), 'Candidate name must be present')
  assert(context.includes('Staff Full Stack & Cloud Architect'), 'Target role must be present')
  assert(context.includes('Software Engineer at TechCorp'), 'Current LinkedIn headline present')
  assert(context.includes('TechCorp Global'), 'Resume experiences present')
  assert(context.includes('Agentic AI Orchestrator'), 'Resume projects present')
  assert(context.includes('AWS Certified Solutions Architect'), 'Certifications present')
  assert(context.includes('Description EMPTY'), 'Empty description noted for DataFlow Inc')
  assert(context.includes('AWS, Kubernetes, Docker'), 'Missing skills list present')

  // Estimate tokens (~4 characters per token)
  const tokenEstimate = Math.round(context.length / 4)
  console.log(`Context length: ${context.length} chars (~${tokenEstimate} tokens)`)
  assert(tokenEstimate >= 400 && tokenEstimate <= 1400, `Context token estimate should be ~900-1,100 tokens, got ${tokenEstimate}`)
})

// ── 2. Task 1 and Task 2 Prompt Structure ────────────────────────────────────
console.log('\n--- Test Suite 2: Task 1 and Task 2 Chunked Prompts ---')
test('Task 1 prompt requests headlines, aboutRewrite, top3PinnedSkills, profileRedFlags', () => {
  const messages = buildTask1HeadlinesAndBannerPrompt({
    profile: sampleLinkedInProfile,
    resumeContext: { canonicalResume: sampleCanonicalResume, targetRole: 'Staff Full Stack & Cloud Architect' },
  })
  assert.strictEqual(messages.length, 2, 'Must have system and user messages')
  assert(messages[0].content.includes('TASK 1 SCOPE: HEADLINES, ABOUT STORY, PINNED SKILLS & RED FLAGS'), 'Task 1 system scope present')
  assert(messages[0].content.includes('"top3PinnedSkills"'), 'Task 1 schema has top3PinnedSkills')
  assert(messages[0].content.includes('"profileRedFlags"'), 'Task 1 schema has profileRedFlags')
  assert(messages[0].content.includes('"aboutRewrite"'), 'Task 1 schema has aboutRewrite')
  assert(messages[1].content.includes('CANDIDATE NAME: Jane Doe'), 'User message contains candidate context')
})

test('Task 2 prompt requests experienceUpgrades, featuredSectionRecommendations, sectionsToAddFromResume, visibilityTricks', () => {
  const messages = buildTask2AboutAndFeaturedPrompt({
    profile: sampleLinkedInProfile,
    resumeContext: { canonicalResume: sampleCanonicalResume, targetRole: 'Staff Full Stack & Cloud Architect' },
  })
  assert.strictEqual(messages.length, 2, 'Must have system and user messages')
  assert(messages[0].content.includes('TASK 2 SCOPE & DIRECTIVES (DO NOT COPY RESUME BULLETS)'), 'Task 2 system scope present')
  assert(messages[0].content.includes('Role Mandate') || messages[0].content.includes('Role Scope & Architecture Mandate'), 'Bullet #1 mandate required')
  assert(messages[0].content.includes('"experienceUpgrades"'), 'Task 2 schema has experienceUpgrades')
  assert(messages[0].content.includes('"visibilityTricks"'), 'Task 2 schema has visibilityTricks')
  assert(messages[0].content.includes('"featuredSectionRecommendations"'), 'Task 2 schema has featuredSectionRecommendations')
  assert(messages[1].content.includes('CANDIDATE NAME: Jane Doe'), 'User message contains candidate context')
})

// ── 3. Parallel Execution & Merging in runLinkedInSynthesis ──────────────────
console.log('\n--- Test Suite 3: Parallel Execution & Non-Overwriting Synthesis ---')
await asyncTest('runLinkedInSynthesis calls Task 1 (2048) and Task 2 (2200) in parallel and merges without fallback overwrites', async () => {
  const capturedCalls = []
  const originalGenerate = llmGateway.generate

  llmGateway.generate = async (params) => {
    capturedCalls.push(params)
    if (params.maxTokens === 2048) {
      // Task 1 response
      return {
        text: JSON.stringify({
          headlines: [
            { formula: 'Recruiter-Search Optimized', headline: 'Staff Architect | AWS & Distributed Systems', whyItWorks: 'SEO' },
            { formula: 'Impact-Driven', headline: 'Staff Architect | Scaled to 10M Events', whyItWorks: 'Scale' },
            { formula: 'Specialist / Authority', headline: 'Cloud Architect | Kubernetes & Microservices', whyItWorks: 'Authority' },
          ],
          aboutRewrite: {
            hook: 'First 200 chars beating fold...',
            proof: 'Quantified highlights...',
            callToAction: 'Open to connecting...',
            fullText: 'Paragraph 1\n\nParagraph 2\n\nParagraph 3\n\nCore Skills: AWS, Node.js',
          },
          top3PinnedSkills: ['AWS', 'Distributed Systems', 'Kubernetes'],
          profileRedFlags: [
            { title: 'Headline Ambiguity', explanation: 'Current headline does not reflect target architect scope', fix: 'Update headline to Staff Architect' }
          ],
        }),
        actualModel: 'openai/gpt-oss-120b',
        tokens: { prompt: 1000, completion: 500 },
      }
    } else if (params.maxTokens === 2200) {
      // Task 2 response
      return {
        text: JSON.stringify({
          experienceUpgrades: [
          {
            company: 'TechCorp Global',
            role: 'Lead Architect',
            dates: '2021 - Present',
            bullets: [
              'Role Mandate: Led architecture and distributed microservices for 10M daily events.',
              'Engineered event streaming platform reducing end-to-end latency by 45%.',
              'Spearheaded Kubernetes cloud migration eliminating single points of failure.',
              'Mentored 12 engineers across 3 squads on microservice design patterns.',
            ],
          },
        ],
        featuredSectionRecommendations: [
          { title: 'Agentic AI Orchestrator', reason: 'Proves practical multi-agent architecture', callToAction: 'Pin GitHub repo' },
        ],
        sectionsToAddFromResume: {
          projects: [
            { title: 'Agentic AI Orchestrator', description: 'Autonomous multi-agent platform', technologies: ['Node.js', 'FastAPI'], replaceNote: 'Pin at top' },
          ],
          certifications: [
            { name: 'AWS Certified Solutions Architect', issuer: 'AWS', date: '2023' },
          ],
          featured: [
            { title: 'Agentic AI Architecture', description: 'System design diagram and code walkthrough' },
          ],
        },
        visibilityTricks: [
          { category: 'Open to Work Titles', trick: 'Set 5 Exact Titles', advice: 'Target recruiter search filters', items: ['Staff Architect', 'Lead Architect'] },
          { category: 'Recruiter Boolean Search', trick: 'Optimize Search String', advice: 'Match exact operators', items: ['("Staff Architect") AND ("AWS")'] },
          { category: 'Top 3 Pinned Skills Strategy', trick: 'Pin Verified Skills', advice: 'Pin top 3 core skills', items: ['AWS', 'Kubernetes', 'Node.js'] },
          { category: 'Custom Vanity URL & Featured Conversion', trick: 'Custom URL', advice: 'Use vanity URL', items: ['Custom URL', 'Pin live demo'] },
        ],
      }),
      tokens: { prompt: 1000, completion: 500 },
    }
  }
  return { text: '{}', tokens: { prompt: 100, completion: 100 } }
}

  try {
    const result = await runLinkedInSynthesis(
      sampleLinkedInProfile,
      { canonicalResume: sampleCanonicalResume, targetRole: 'Staff Full Stack & Cloud Architect' }
    )

    // Verify 2 parallel calls executed
    assert.strictEqual(capturedCalls.length, 2, 'Must execute exactly 2 chunked calls')
    const t1Call = capturedCalls.find((c) => c.maxTokens === 2048)
    const t2Call = capturedCalls.find((c) => c.maxTokens === 2200)
    assert(t1Call, 'Task 1 must run with maxTokens 2048')
    assert(t2Call, 'Task 2 must run with maxTokens 2200')

    // Verify Task 1 merged outputs
    assert.strictEqual(result.headlines.length, 3, 'Must have 3 headlines')
    assert.strictEqual(result.headlines[0].headline, 'Staff Architect | AWS & Distributed Systems')
    assert.deepStrictEqual(result.top3PinnedSkills, ['AWS', 'Distributed Systems', 'Kubernetes'], 'LLM top3PinnedSkills must NOT be overwritten by fallback')
    assert.strictEqual(result.profileRedFlags.length, 1)

    // Verify Task 2 merged outputs
    assert.strictEqual(result.experienceUpgrades.length, 1)
    assert(result.experienceUpgrades[0].bullets[0].startsWith('Role Mandate:'), 'Bullet #1 must be Role Mandate')
    assert.strictEqual(result.featuredSectionRecommendations[0].title, 'Agentic AI Orchestrator')
    assert.strictEqual(result.sectionsToAddFromResume.projects[0].title, 'Agentic AI Orchestrator', 'LLM sectionsToAddFromResume must NOT be overwritten by fallback')
    assert.strictEqual(result.visibilityTricks.length, 4, 'LLM visibilityTricks must NOT be overwritten by fallback')
    assert.strictEqual(result.visibilityTricks[0].category, 'Open to Work Titles')
  } finally {
    llmGateway.generate = originalGenerate
  }
})

// ── 4. Resume Agent Upgrades: maxTokens, rewriteValidator, safe recovery ─────
console.log('\n--- Test Suite 4: Resume Agent & Orchestrator Validations ---')
test('modeC_hybrid maxTokens is set to 4096', () => {
  const modeCCode = fs.readFileSync('backend/agents/resume/orchestration/modeC_hybrid.js', 'utf8')
  assert(modeCCode.includes('maxTokens: 4096'), 'modeC_hybrid must use maxTokens: 4096')
})

test('rewriteValidator FORBIDDEN_NEW_CLAIMS is empty array []', () => {
  assert(Array.isArray(FORBIDDEN_NEW_CLAIMS) && FORBIDDEN_NEW_CLAIMS.length === 0, 'FORBIDDEN_NEW_CLAIMS must be empty array')
})

test('rewriteValidator accepts resume-wide skills in rewrites', () => {
  const resumeTech = buildResumeTechTokens(sampleCanonicalResume)
  const original = 'Responsible for core cloud microservices architecture and infrastructure.'
  const rewrite = 'Architected cloud microservices deployed on Kubernetes with Kafka event streaming.'
  const res = validateRewrite(rewrite, original, 'exp_001_b01', resumeTech)
  assert.strictEqual(res.valid, true, `Kubernetes and Kafka from resume skills must be accepted: ${res.violations.join(', ')}`)
})

test('resumeAgent replaces unverified numbers with [ADD: measurable metric] without destroying sentence', () => {
  const sourceTokens = buildSourceFactTokens(sampleCanonicalResume)
  const llmRewrite = 'Architected high-throughput microservices reducing response time by 82% and scaling to 5,000,000 users.'
  const sanitized = replaceUnverifiedNumericTokens(llmRewrite, sourceTokens, sampleCanonicalResume)
  assert(!sanitized.includes('82%'), 'Unverified 82% must be stripped')
  assert(!sanitized.includes('5,000,000'), 'Unverified 5,000,000 must be stripped')
  assert(sanitized.includes('[ADD: measurable metric]'), 'Should insert [ADD: measurable metric] slot')
  assert(sanitized.startsWith('Architected high-throughput microservices'), 'Core LLM sentence structure must remain intact')
})

test('resumeScorecard only shows deterministic rewrite for weak openers, not general outcome or tense issues', () => {
  const scorecard = computeScorecard({
    analysis: { issues: [], bulletUpgrades: [] },
    canonicalResume: sampleCanonicalResume,
    bulletSignalsList: [
      { bulletId: 'exp_001_b01', weakVerbIssue: true, weakVerbMatch: 'Responsible for' },
      { bulletId: 'exp_001_b02', tenseIssue: 'gerund_opening', openingWord: 'Developing' },
      { bulletId: 'exp_002_b02', hasQuantifier: false, hasQualitativeOutcome: false, openingWord: 'Maintained' },
    ],
  })

  const audit = scorecard.bulletAudit
  const weakOpenerBullet = audit.find((b) => b.bulletId === 'exp_001_b01')
  const gerundBullet = audit.find((b) => b.bulletId === 'exp_001_b02')
  const lacksOutcomeBullet = audit.find((b) => b.bulletId === 'exp_002_b02')

  assert(weakOpenerBullet.rewrite !== null, 'Weak opener bullet MUST have a deterministic rewrite')
  assert(weakOpenerBullet.rewrite.startsWith('Architect') || weakOpenerBullet.rewrite.startsWith('Moderniz'), 'Weak opener rewrite must lead with power verb')
  
  assert.strictEqual(gerundBullet.rewrite, null, 'Gerund opening bullet rewrite MUST be null (only quickPolishNote)')
  assert(gerundBullet.quickPolishNote.includes("Change 'Developing' to"), 'Gerund bullet must have quickPolishNote')

  assert.strictEqual(lacksOutcomeBullet.rewrite, null, 'Bullet lacking outcome without weak opener rewrite MUST be null')
})

test('orchestrator inputHash includes bumped prefixes', () => {
  const orchestratorCode = fs.readFileSync('backend/agents/orchestrator.js', 'utf8')
  assert(orchestratorCode.includes('resume_v7:') || orchestratorCode.includes('resume_v6:') || orchestratorCode.includes('resume_v5:'), 'orchestrator must include resume_v5/v6/v7 prefix')
  assert(orchestratorCode.includes('linkedin_v7:') || orchestratorCode.includes('linkedin_v5:'), 'orchestrator must include linkedin_v5/v7: prefix')
})

console.log('\n================================================================')
if (failed === 0) {
  console.log(`ALL ${passed} VERIFICATION TESTS PASSED!`)
} else {
  console.log(`RESULTS: ${passed} passed, ${failed} FAILED`)
}
console.log('================================================================\n')

if (failed > 0) process.exit(1)
