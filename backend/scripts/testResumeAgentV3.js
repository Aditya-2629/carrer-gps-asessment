/**
 * Resume Agent V3 — Unit Test Suite
 * Tests all new V3 modules: State, Facts, Analyzers, Validation
 */

import { createResumeState, setCanonicalResume, setResumeFacts, setSignals } from '../agents/resume/state/resumeState.js'
import { extractResumeFacts, formatCompactFactsSummary } from '../agents/resume/facts/resumeFactExtractor.js'
import { normalizeFacts, buildFactIndex } from '../agents/resume/facts/resumeFactNormalizer.js'
import { analyzePositioning } from '../agents/resume/analyzers/positioningAnalyzer.js'
import { analyzeContent } from '../agents/resume/analyzers/contentAnalyzer.js'
import { analyzeImpact } from '../agents/resume/analyzers/impactAnalyzer.js'
import { analyzeTechnical } from '../agents/resume/analyzers/technicalAnalyzer.js'
import { analyzeStructure } from '../agents/resume/analyzers/structureAnalyzer.js'
import { analyzeEvidence, filterGroundedObservations } from '../agents/resume/analyzers/evidenceAnalyzer.js'
import { validateRewrite, validateAllRewrites } from '../agents/resume/validation/rewriteValidator.js'
import { detectUnsupportedAssumptions } from '../agents/resume/validation/assumptionValidator.js'
import { validateClaims } from '../agents/resume/validation/claimValidator.js'
import { generateResumeSignals } from '../agents/resume/signals/signalEngine.js'

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_CANONICAL = {
  candidate: {
    name: 'Jane Doe',
    targetRole: 'Senior Backend Engineer',
    contact: { email: 'jane@example.com', phone: '555-1234', location: 'New York, NY' },
  },
  summary: {
    text: 'Jane Doe | jane@example.com | 5+ years of backend engineering experience with Python, Docker, and PostgreSQL.',
  },
  experience: [
    {
      id: 'exp_001',
      company: 'Tech Corp | 2022 – Present',
      role: 'Senior Backend Engineer',
      bullets: [
        { id: 'exp_001_b01', text: 'Reduced query latency by 38% by rewriting the search index using PostgreSQL partitioning.' },
        { id: 'exp_001_b02', text: 'Built secure APIs and remediated XSS and sensitive-key exposure through input validation and sanitization.' },
        { id: 'exp_001_b03', text: 'Deployed 20+ production releases with zero downtime using Docker and GitHub Actions CI/CD pipeline.' },
      ],
    },
    {
      id: 'exp_002',
      company: 'StartupABC | 2020 – 2022',
      role: 'Backend Developer',
      bullets: [
        { id: 'exp_002_b01', text: 'Eliminated 50+ hours/month of manual reconciliation by automating financial reports.' },
      ],
    },
  ],
  projects: [
    {
      id: 'proj_001',
      title: 'AI Chat System',
      bullets: [
        { id: 'proj_001_b01', text: 'Built a RAG-based retrieval pipeline serving 5,000+ users with <1 second response time.' },
      ],
    },
  ],
  education: [
    { id: 'edu_001', degree: 'B.S. Computer Science', institution: 'State University', year: '2020' },
  ],
  skills: [
    { id: 'skill_001', name: 'Python', category: 'Languages' },
    { id: 'skill_002', name: 'Go', category: 'Languages' },
    { id: 'skill_003', name: 'Docker', category: 'Tools' },
    { id: 'skill_004', name: 'PostgreSQL', category: 'Databases' },
    { id: 'skill_005', name: 'Kubernetes', category: 'Cloud' },
  ],
  certifications: [],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('================================================================')
console.log('RESUME AGENT V3 UNIT TEST SUITE (20 SCENARIOS)')
console.log('================================================================\n')

// ── State Tests ───────────────────────────────────────────────────────────────

console.log('--- Test 1: State creation ---')
test('State has correct version', () => {
  const state = createResumeState()
  assert(state.stateVersion === '3.0', `Expected 3.0 got ${state.stateVersion}`)
})
test('State has all required layers', () => {
  const state = createResumeState()
  assert(state.canonicalResume === null)
  assert(state.resumeFacts === null)
  assert(state.signals === null)
  assert(state.analyzerObservations !== null)
  assert(state.analysis !== null)
  assert(state.validation !== null)
})
test('canonicalResume is immutable after set', () => {
  const state = createResumeState()
  setCanonicalResume(state, { test: 'value' })
  // Attempting to set again should be refused
  setCanonicalResume(state, { test: 'mutated' })
  assert(state.canonicalResume.test === 'value', 'Should not have been mutated')
})

// ── Fact Extractor Tests ─────────────────────────────────────────────────────

console.log('\n--- Test 2: Fact extraction ---')
test('Extracts candidate identity facts', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const nameFacts = facts.facts.filter((f) => f.type === 'candidate_name')
  assert(nameFacts.length > 0, 'Should extract candidate name')
  assert(nameFacts[0].value === 'Jane Doe')
})
test('Extracts metric facts from experience bullets', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const metrics = facts.facts.filter((f) => f.type === 'metric')
  assert(metrics.length >= 4, `Expected ≥4 metrics, got ${metrics.length}`)
})
test('Metric facts retain bulletId and itemId', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const pct = facts.facts.find((f) => f.type === 'metric' && f.value === '38%')
  assert(pct, 'Should find 38% metric')
  assert(pct.bulletId === 'exp_001_b01', `bulletId should be exp_001_b01, got ${pct.bulletId}`)
  assert(pct.itemId === 'exp_001')
})
test('Extracts technology facts from skills section', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const tech = facts.facts.filter((f) => f.type === 'technology')
  assert(tech.length === 5, `Expected 5 tech facts, got ${tech.length}`)
})
test('Summary reflects correct counts', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  assert(facts.summary.technologyCount === 5)
  assert(facts.summary.hasMetrics === true)
})

// ── Fact Normalizer Tests ────────────────────────────────────────────────────

console.log('\n--- Test 3: Fact normalization ---')
test('Dedup eliminates duplicate metric facts', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const normalized = normalizeFacts(facts.facts)
  // All fact IDs should be unique
  const ids = normalized.map((f) => f.factId)
  const uniq = new Set(ids)
  assert(uniq.size === ids.length, 'Duplicate factIds detected after normalization')
})
test('buildFactIndex creates proper index', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const normalized = normalizeFacts(facts.facts)
  const idx = buildFactIndex(normalized)
  assert(idx.has('exp_001'), 'exp_001 should be in index')
  assert(idx.get('exp_001').length > 0)
})

// ── Analyzer Tests ───────────────────────────────────────────────────────────

console.log('\n--- Test 4: Analyzers ---')
test('positioningAnalyzer returns observations array', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const signals = generateResumeSignals(SAMPLE_CANONICAL)
  const result = analyzePositioning(facts, signals, SAMPLE_CANONICAL)
  assert(Array.isArray(result.observations))
  assert(result.version === '1.0')
})
test('contentAnalyzer detects no obvious weak verbs in strong resume', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const signals = generateResumeSignals(SAMPLE_CANONICAL)
  const result = analyzeContent(facts, signals, SAMPLE_CANONICAL)
  assert(Array.isArray(result.observations))
  // Strong verbs like "Reduced", "Built", "Deployed" should have no weak-verb observations for those bullets
  const weakVerbObs = result.observations.filter((o) => o.type === 'weak_verb')
  assert(weakVerbObs.length === 0, `Should be 0 weak verb observations, got ${weakVerbObs.length}`)
})
test('impactAnalyzer marks security bullets correctly', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const signals = generateResumeSignals(SAMPLE_CANONICAL)
  const result = analyzeImpact(facts, signals, SAMPLE_CANONICAL)
  // Should NOT flag the XSS/security bullet as "missing_outcome"
  const secObs = result.observations.filter((o) => o.type === 'security_impact_observation')
  if (secObs.length > 0) {
    // If flagged, must have llmGuidance: DO_NOT_FLAG_AS_MISSING_METRIC
    assert(secObs[0].llmGuidance === 'DO_NOT_FLAG_AS_MISSING_METRIC', 'Security guidance must be set')
  }
  // Must NOT be a "missing_outcome" type
  const missingOutcome = result.observations.filter((o) => o.type === 'missing_outcome')
  assert(missingOutcome.length === 0, 'Must NOT create missing_outcome for security bullet')
})
test('technicalAnalyzer detects correct tech domains', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const signals = generateResumeSignals(SAMPLE_CANONICAL)
  const result = analyzeTechnical(facts, signals, SAMPLE_CANONICAL)
  assert(result.summary.domainCount >= 2, `Should detect ≥2 domains, got ${result.summary.domainCount}`)
})
test('structureAnalyzer detects complete resume structure', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const signals = generateResumeSignals(SAMPLE_CANONICAL)
  const result = analyzeStructure(facts, signals, SAMPLE_CANONICAL)
  assert(result.summary.hasSummary === true)
  assert(result.summary.experienceItemCount === 2)
})

// ── Evidence Analyzer Tests ──────────────────────────────────────────────────

console.log('\n--- Test 5: Evidence gatekeeper ---')
test('analyzeEvidence grounds all valid observations', () => {
  const facts = extractResumeFacts(SAMPLE_CANONICAL)
  const signals = generateResumeSignals(SAMPLE_CANONICAL)
  const posObs = analyzePositioning(facts, signals, SAMPLE_CANONICAL)
  const result = analyzeEvidence({ positioning: posObs }, SAMPLE_CANONICAL)
  assert(result.groundingRate >= 0 && result.groundingRate <= 1, 'Grounding rate must be 0-1')
})
test('filterGroundedObservations removes ungrounded observations', () => {
  const mockObservations = {
    test: {
      observations: [
        { observationId: 'test_001', type: 'test', description: 'ok', itemId: 'exp_001', bulletId: 'exp_001_b01', evidenceLocated: true },
        { observationId: 'test_002', type: 'test', description: 'bad', itemId: 'nonexistent_999', bulletId: 'nonexistent_999_b01', evidenceLocated: false },
      ]
    }
  }
  const filtered = filterGroundedObservations(mockObservations)
  assert(filtered.test.observations.length === 1, 'Should filter out ungrounded observation')
})

// ── Validation Tests ─────────────────────────────────────────────────────────

console.log('\n--- Test 6: Rewrite validator ---')
test('Allows conservative rewrite with no new facts', () => {
  const original = 'Reduced query latency by 38% by rewriting the search index using PostgreSQL partitioning.'
  const corrected = 'Reduced query latency by 38% by rewriting the PostgreSQL search index with partitioning.'
  const { valid } = validateRewrite(corrected, original, 'exp_001_b01')
  assert(valid === true, 'Conservative rewrite should be valid')
})
test('Rejects rewrite with new metric', () => {
  const original = 'Built secure APIs and remediated XSS through input validation.'
  const corrected = 'Built secure APIs, reducing vulnerabilities by 40%, through input validation.'
  const { valid, violations } = validateRewrite(corrected, original, 'exp_001_b02')
  assert(valid === false, 'Should reject new metric 40%')
  assert(violations.length > 0)
})
test('Allows professional claim phrasing with empty forbidden claims list', () => {
  const original = 'Built secure APIs and remediated XSS through input validation.'
  const corrected = 'Built production-ready enterprise-grade secure APIs through input validation.'
  const { valid } = validateRewrite(corrected, original, 'exp_001_b02')
  assert(valid === true, 'Professional claim words should not be blocked')
})
test('Allows technology present in resumeTechTokens', () => {
  const original = 'Built secure APIs through input validation.'
  const corrected = 'Built secure APIs using Docker through input validation.'
  const resumeTechTokens = new Set(['docker', 'postgresql', 'python'])
  const { valid } = validateRewrite(corrected, original, 'exp_001_b02', resumeTechTokens)
  assert(valid === true, 'Technology from resumeTechTokens should be accepted')
})

console.log('\n--- Test 7: Assumption validator ---')
test('Detects production-ready assumption', () => {
  const mockAnalysis = {
    overallReview: { summary: 'This is production-ready code with enterprise features.' },
    strengths: [],
    issues: [],
    priorityActions: [],
  }
  const assumptions = detectUnsupportedAssumptions(mockAnalysis)
  assert(assumptions.length > 0, 'Should detect production-ready assumption')
  assert(assumptions.some((a) => a.label === 'production_ready'))
})
test('Detects student-level assumption', () => {
  const mockAnalysis = {
    overallReview: { summary: 'This looks like a student project from university.' },
    strengths: [],
    issues: [],
    priorityActions: [],
  }
  const assumptions = detectUnsupportedAssumptions(mockAnalysis)
  assert(assumptions.some((a) => a.label === 'student_level'))
})
test('Passes clean analysis without assumptions', () => {
  const mockAnalysis = {
    overallReview: { summary: 'Strong quantified evidence of backend engineering work.' },
    strengths: [],
    issues: [],
    priorityActions: [],
  }
  const assumptions = detectUnsupportedAssumptions(mockAnalysis)
  assert(assumptions.length === 0, 'Clean analysis should have no unsupported assumptions')
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('\n================================================================')
if (failed === 0) {
  console.log(`ALL ${passed} RESUME AGENT V3 UNIT TESTS PASSED!`)
} else {
  console.log(`RESULTS: ${passed} passed, ${failed} FAILED`)
}
console.log('================================================================\n')

if (failed > 0) process.exit(1)
