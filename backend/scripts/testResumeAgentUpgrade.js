/**
 * Test Suite for Resume Agent Pipeline Upgrade
 */

import { buildHybridPrompt, sanitizeModeCOutput } from '../agents/resume/orchestration/modeC_hybrid.js'
import { validateRewrite, validateAllRewrites, buildResumeTechTokens } from '../agents/resume/validation/rewriteValidator.js'
import { buildSourceFactTokens } from '../agents/resume/validation/claimValidator.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'
import { computeScorecard, generateDeterministicRewrite } from '../agents/resume/scoring/resumeScorecard.js'
import fs from 'fs'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`PASS: ${name}`)
    passed++
  } catch (e) {
    console.error(`FAIL: ${name}`)
    console.error(`  → ${e.message}`)
    failed++
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed')
}

const SAMPLE_CANONICAL = {
  candidate: {
    name: 'Alex Developer',
    targetRole: 'Staff Software Engineer',
    summary: 'Full stack specialist with React, Node.js, and Docker.',
  },
  skills: [
    { name: 'Kubernetes', category: 'DevOps' },
    { name: 'PostgreSQL', category: 'Databases' },
  ],
  experience: [
    {
      id: 'exp_001',
      company: 'Acme Corp',
      role: 'Senior Software Engineer',
      bullets: [
        { id: 'exp_001_b01', text: 'Responsible for the backend microservices architecture.' },
        { id: 'exp_001_b02', text: 'Optimizing database queries to improve performance.' },
        { id: 'exp_001_b03', text: 'Engineered search service using Elasticsearch, reducing query latency by 40%.' },
      ],
    },
  ],
  projects: [
    {
      id: 'proj_001',
      name: 'Cloud Migrator',
      bullets: [
        { id: 'proj_001_b01', text: 'Worked on cloud migration pipeline using Docker.' },
      ],
    },
  ],
}

console.log('\n================================================================')
console.log('RESUME AGENT UPGRADE VERIFICATION SUITE')
console.log('================================================================\n')

// ── Test 1: modeC_hybrid prompt & schema ─────────────────────────────────────
console.log('--- Requirement 1: modeC_hybrid prompt & schema ---')
test('buildHybridPrompt contains Staff Engineer mandate and bulletUpgrades schema', () => {
  const dossier = {
    quantification: { density: 0.5, totalBullets: 4, quantifiedBullets: 2, unquantifiedBulletIds: [] },
    toolDumps: [],
    timeline: { totalExperienceYears: 5, itemCount: 1 },
    targetJdOverlap: { evidencedSkills: [], unverifiedSkills: [] },
    marketEvidenceGaps: [],
  }
  const messages = buildHybridPrompt({
    compactResume: 'RESUME_TEXT',
    dossier,
    targetRole: 'Staff Software Engineer',
  })
  const systemPrompt = messages[0].content
  assert(systemPrompt.includes('STAFF ENGINEER & SENIOR TECHNICAL RECRUITER AUDIT MANDATE'), 'Must include Staff Engineer mandate')
  assert(systemPrompt.includes('MANDATORY FULL REWRITES'), 'Must include mandatory full rewrites section')
  assert(!systemPrompt.includes('A missing numeric metric alone is NEVER sufficient reason to create an issue!'), 'Must remove missing metric alone restriction')
  assert(!systemPrompt.includes('set "correctedText": null and "correctionType": "none"'), 'Must remove null correctedText rule')
  assert(systemPrompt.includes('"bulletUpgrades"'), 'Must include bulletUpgrades in schema')
})

test('sanitizeModeCOutput normalizes and preserves bulletUpgrades', () => {
  const analysis = {
    analysisVersion: '2.2',
    bulletUpgrades: [
      { bulletId: 'exp_001_b01', status: 'warn', reason: 'Unquantified', rewrittenText: 'Architected backend...' },
    ],
  }
  const sanitized = sanitizeModeCOutput(analysis)
  assert(Array.isArray(sanitized.bulletUpgrades), 'bulletUpgrades must be an array')
  assert(sanitized.bulletUpgrades.length === 1, 'bulletUpgrades items preserved')
})

test('ResumeAgentValidator.validate preserves bulletUpgrades in sanitizedAnalysis', () => {
  const analysis = {
    analysisVersion: '2.2',
    candidateSnapshot: { name: 'Alex', targetRole: 'Engineer' },
    dashboard: null,
    overallReview: { summary: 'Good experience.', tone: 'conversational' },
    strengths: [],
    issues: [
      {
        id: 'iss_001',
        severity: 'high',
        category: 'impact',
        title: 'Weak opener',
        diagnosis: 'Opens weak',
        whyItMatters: 'Matters for senior role',
        recommendation: 'Fix it',
        correctedText: 'Architected microservices.',
        correctionType: 'rewrite',
        evidence: [{ section: 'experience', itemId: 'exp_001', bulletId: 'exp_001_b01', originalText: 'Responsible for the backend microservices architecture.' }],
      },
    ],
    priorityActions: [{ priority: 1, title: 'Fix opener', action: 'Fix it', reason: 'Impact' }],
    bulletUpgrades: [
      { bulletId: 'exp_001_b02', status: 'warn', reason: 'Unquantified', rewrittenText: 'Optimized queries [ADD: latency reduction %]' },
    ],
  }
  const validation = ResumeAgentValidator.validate(analysis, SAMPLE_CANONICAL)
  assert(validation.sanitizedAnalysis, 'Must have sanitizedAnalysis')
  assert(Array.isArray(validation.sanitizedAnalysis.bulletUpgrades), 'Must preserve bulletUpgrades as array')
  assert(validation.sanitizedAnalysis.bulletUpgrades.length === 1, 'Must retain bulletUpgrades content')
})

// ── Test 2: rewriteValidator false-positive rejections ────────────────────────
console.log('\n--- Requirement 2: rewriteValidator false positives & resumeTechTokens ---')
test('buildResumeTechTokens captures tech across whole resume', () => {
  const techTokens = buildResumeTechTokens(SAMPLE_CANONICAL)
  assert(techTokens.has('react'), 'Should have React from summary')
  assert(techTokens.has('docker'), 'Should have Docker from summary/projects')
  assert(techTokens.has('kubernetes'), 'Should have Kubernetes from skills')
  assert(techTokens.has('postgresql'), 'Should have PostgreSQL from skills')
  assert(techTokens.has('elasticsearch'), 'Should have Elasticsearch from experience')
})

test('validateRewrite allows resume-wide tech not in single bullet', () => {
  const original = 'Responsible for the backend microservices architecture.'
  // Kubernetes is in candidate skills, not in this bullet
  const corrected = 'Architected backend microservices deployed on Kubernetes.'
  const resumeTech = buildResumeTechTokens(SAMPLE_CANONICAL)
  const { valid, violations } = validateRewrite(corrected, original, 'exp_001_b01', resumeTech)
  assert(valid === true, `Should accept Kubernetes from resume skills: ${violations.join(', ')}`)
})

test('validateRewrite rejects tech not anywhere in canonical resume', () => {
  const original = 'Responsible for the backend microservices architecture.'
  const corrected = 'Architected backend microservices deployed on Snowflake and Kafka.'
  const resumeTech = buildResumeTechTokens(SAMPLE_CANONICAL)
  const { valid, violations } = validateRewrite(corrected, original, 'exp_001_b01', resumeTech)
  assert(valid === false, 'Should reject Kafka which is not in resume')
  assert(violations.some((v) => v.includes('Kafka') || v.includes('kafka')))
})

test('validateRewrite allows words previously blocked by FORBIDDEN_NEW_CLAIMS', () => {
  const original = 'Responsible for the backend microservices architecture.'
  const corrected = 'Architected production-ready enterprise-grade high-scale mission-critical microservices.'
  const { valid, violations } = validateRewrite(corrected, original, 'exp_001_b01')
  assert(valid === true, `Production words must not be blocked: ${violations.join(', ')}`)
})

// ── Test 3: Stop Overwriting LLM Rewrites in resumeAgent ──────────────────────
console.log('\n--- Requirement 3: Stop overwriting LLM rewrites ---')
test('buildSourceFactTokens extracts ground truth numbers', () => {
  const tokens = buildSourceFactTokens(SAMPLE_CANONICAL)
  assert(tokens.has('40%'), 'Should contain 40% from exp_001_b03')
})

// ── Test 4: Wire bulletUpgrades & eliminate 1-word rewrites in scorecard ──────
console.log('\n--- Requirement 4: Wire bulletUpgrades & eliminate fake 1-word rewrites ---')
test('generateDeterministicRewrite uses strong verbs and clean [ADD: ...] slot', () => {
  const rw1 = generateDeterministicRewrite('Responsible for microservices architecture.', { weakVerbIssue: true }, false)
  assert(rw1.startsWith('Architected'), `Should lead with Architected, got: ${rw1}`)
  assert(rw1.includes('[ADD: measurable outcome, e.g., latency reduction %, system scale, or engineering hours saved]'), 'Should append clean ADD slot')

  const rw2 = generateDeterministicRewrite('Worked on database indexing.', { weakVerbIssue: true }, false)
  assert(rw2.startsWith('Engineered'), `Should lead with Engineered, got: ${rw2}`)

  const rw3 = generateDeterministicRewrite('Contributed to UI design.', { weakVerbIssue: true }, false)
  assert(rw3.startsWith('Spearheaded'), `Should lead with Spearheaded, got: ${rw3}`)
})

test('buildBulletAudit wires bulletUpgrades into audit', () => {
  const analysis = {
    issues: [
      {
        id: 'iss_001',
        severity: 'high',
        category: 'impact',
        title: 'Issue on b01',
        correctedText: 'Architected microservices [ADD: measurable metric].',
        evidence: [{ bulletId: 'exp_001_b01' }],
      },
    ],
    bulletUpgrades: [
      {
        bulletId: 'proj_001_b01',
        status: 'warn',
        reason: 'Lacks quantitative outcome',
        rewrittenText: 'Automated cloud migration pipeline reducing deployment cycle by [ADD: specific metric].',
      },
    ],
  }
  const scorecard = computeScorecard({
    analysis,
    canonicalResume: SAMPLE_CANONICAL,
    bulletSignalsList: [
      { bulletId: 'exp_001_b01', weakVerbIssue: true },
      { bulletId: 'exp_001_b02', tenseIssue: 'gerund_opening', openingWord: 'Optimizing' },
      { bulletId: 'exp_001_b03', hasQuantifier: true },
      { bulletId: 'proj_001_b01', hasQuantifier: false },
    ],
  })

  const audit = scorecard.bulletAudit

  // 1. Issue bullet uses issue.correctedText
  const b01 = audit.find((b) => b.bulletId === 'exp_001_b01')
  assert(b01.rewrite === 'Architected microservices [ADD: measurable metric].', 'b01 must use issue.correctedText')
  assert(b01.status === 'fix', 'High severity issue should have status fix')

  // 2. Upgrade bullet uses upgrade.rewrittenText
  const projB01 = audit.find((b) => b.bulletId === 'proj_001_b01')
  assert(projB01.rewrite.includes('Automated cloud migration'), 'proj_001_b01 must use upgrade.rewrittenText')
  assert(projB01.reason === 'Lacks quantitative outcome', 'Must use upgrade reason')

  // 3. Gerund opening bullet sets quickPolishNote and provides full non-null rewrite
  const b02 = audit.find((b) => b.bulletId === 'exp_001_b02')
  assert(b02.quickPolishNote && b02.quickPolishNote.includes("Change 'Optimizing' to 'Optimized'"), 'Must set quickPolishNote')
  assert(b02.rewrite !== null && typeof b02.rewrite === 'string', `b02 rewrite must be non-null, got: ${b02.rewrite}`)
})

// ── Test 5: orchestrator inputHash prefix ─────────────────────────────────────
console.log('\n--- Requirement 5: orchestrator inputHash prefix ---')
test('orchestrator.js uses resume_v6/v7: prefix', () => {
  const orchestratorCode = fs.readFileSync('backend/agents/orchestrator.js', 'utf8')
  assert(orchestratorCode.includes('resume_v7:') || orchestratorCode.includes('resume_v6:'), 'Must include resume_v6/v7: prefix in orchestrator.js')
})

console.log('\n================================================================')
if (failed === 0) {
  console.log(`ALL ${passed} UPGRADE TESTS PASSED!`)
} else {
  console.log(`RESULTS: ${passed} passed, ${failed} FAILED`)
}
console.log('================================================================\n')

if (failed > 0) process.exit(1)
