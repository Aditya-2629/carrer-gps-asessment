/**
 * Resume Agent V2.4 — Unit Test Suite (10 Scenarios)
 * Tests Evidence Classification, Technology Density, Recommendation Validation,
 * Contradiction Resolution, and Guardrails.
 */

import { classifyBullet, classifyAllEvidence } from '../agents/resume/classification/evidenceClassifier.js'
import { CLASSIFICATION_VALUES } from '../agents/resume/classification/evidenceClassification.schema.js'
import { resolveEvidenceConsistency } from '../agents/resume/classification/consistencyChecker.js'
import { validateRecommendations, computeOverlapScore } from '../agents/resume/validation/recommendationValidator.js'
import { detectTechnologyDensity } from '../agents/resume/signals/technologyDensity.js'
import { detectUnsupportedAssumptions } from '../agents/resume/validation/assumptionValidator.js'
import { validateClaims } from '../agents/resume/validation/claimValidator.js'
import { validateRewrite } from '../agents/resume/validation/rewriteValidator.js'

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

console.log('================================================================')
console.log('RESUME AGENT V2.4 UNIT TEST SUITE (10 SCENARIOS)')
console.log('================================================================\n')

// ── Test 1: Strong quantified bullet → STRONG (§2) ───────────────────────────
test('Test 1: Strong quantified bullet → STRONG', () => {
  const bullets = [
    'Architected RAG agent pipeline integrating 9 tools, cutting manual support queries by 38%.',
    'Scaled real-time chat infrastructure to handle 3x concurrent capacity with page load <1 second for 5,000+ users.',
    'Developed automated data reconciliation service, eliminating 50+ hours of manual reconciliation per month.',
    'Re-indexed database tables and introduced Redis caching, cutting p95 API query latency from 850ms to 120ms.',
    'Automated continuous deployment pipeline delivering 20+ production releases with zero-downtime over 12 months.',
  ]

  for (const b of bullets) {
    const res = classifyBullet(b, { hasMetrics: true })
    assert(
      res.classification === CLASSIFICATION_VALUES.STRONG,
      `Expected STRONG for "${b.slice(0, 40)}...", got ${res.classification}`
    )
  }
})

// ── Test 2: Concrete technical work without metric → BORDERLINE or STRONG (§3, §10)
test('Test 2: Concrete technical work without metric → BORDERLINE or STRONG', () => {
  // Security bullet explicitly mentioned in spec §3 & §18
  const secBullet = 'Built secure APIs and remediated XSS and sensitive-key exposure through input validation and sanitization.'
  const secRes = classifyBullet(secBullet)
  assert(
    secRes.classification === CLASSIFICATION_VALUES.BORDERLINE,
    `Expected BORDERLINE for security bullet, got ${secRes.classification}`
  )
  assert(secRes.classification !== CLASSIFICATION_VALUES.WEAK, 'Security remediation must never be classified as WEAK')

  // Concrete technical work with active verb
  const techBullet = 'Implemented modular MCP server exposing 9 tools with streaming JSON-RPC responses for local LLM orchestration.'
  const techRes = classifyBullet(techBullet)
  assert(
    techRes.classification === CLASSIFICATION_VALUES.BORDERLINE || techRes.classification === CLASSIFICATION_VALUES.STRONG,
    `Expected BORDERLINE or STRONG for concrete technical work, got ${techRes.classification}`
  )
  assert(techRes.classification !== CLASSIFICATION_VALUES.WEAK, 'Concrete technical work without metric must NOT be WEAK')

  // SOC2 tenant isolation
  const socBullet = 'Designed role-based tenant isolation and audit logging middleware meeting SOC2 compliance requirements.'
  const socRes = classifyBullet(socBullet)
  assert(
    socRes.classification === CLASSIFICATION_VALUES.BORDERLINE || socRes.classification === CLASSIFICATION_VALUES.STRONG,
    `Expected BORDERLINE or STRONG for compliance architecture, got ${socRes.classification}`
  )
})

// ── Test 3: Vague responsibility → WEAK (§4) ──────────────────────────────────
test('Test 3: Vague responsibility → WEAK', () => {
  const weakBullets = [
    'Responsible for writing code for web applications using JavaScript and React.',
    'Assisted senior developers with backend bug fixing and routine database maintenance tasks.',
    'Worked with team members in daily agile standup meetings.',
    'Handled customer support tickets and investigated client issues in production.',
    'Attended weekly project status meetings with project managers.',
  ]

  for (const b of weakBullets) {
    const res = classifyBullet(b)
    assert(
      res.classification === CLASSIFICATION_VALUES.WEAK,
      `Expected WEAK for "${b.slice(0, 40)}...", got ${res.classification}`
    )
  }
})

// ── Test 4: Acceptable ordinary bullet → NEUTRAL (§5) ─────────────────────────
test('Test 4: Acceptable ordinary bullet → NEUTRAL', () => {
  const neutralBullets = [
    'Updated content and images on WordPress websites.',
    'Tested website links and browser compatibility across Chrome and Safari.',
    'Collaborated with business stakeholders to gather data requirements and clarify metric definitions.',
  ]

  for (const b of neutralBullets) {
    const res = classifyBullet(b)
    assert(
      res.classification === CLASSIFICATION_VALUES.NEUTRAL,
      `Expected NEUTRAL for "${b.slice(0, 40)}...", got ${res.classification}`
    )
  }
})

// ── Test 5: Same evidence cannot appear as both strength and issue (§9, §17) ──
test('Test 5: Same evidence cannot appear as both strength and issue', () => {
  // Scenario A: Bullet is STRONG → Retain in strength, remove from issues
  const mockAnalysisA = {
    strengths: [
      { id: 'str_001', title: 'High scale chat', evidence: { bulletId: 'exp_001_b03' } },
    ],
    issues: [
      { id: 'iss_001', title: 'Missing business revenue', evidence: { bulletId: 'exp_001_b03' } },
      { id: 'iss_002', title: 'Vague ticket bullet', evidence: { bulletId: 'exp_001_b04' } },
    ],
  }
  const classificationsA = {
    exp_001_b03: { classification: 'STRONG' },
    exp_001_b04: { classification: 'WEAK' },
  }
  const resA = resolveEvidenceConsistency(mockAnalysisA, classificationsA)
  assert(resA.contradictions.length === 1, 'Should detect 1 contradiction for exp_001_b03')
  assert(resA.sanitizedAnalysis.strengths.length === 1, 'Should retain STRONG bullet in strengths')
  assert(resA.sanitizedAnalysis.issues.length === 1, 'Should remove STRONG bullet from issues')
  assert(resA.sanitizedAnalysis.issues[0].evidence.bulletId === 'exp_001_b04', 'Remaining issue should be exp_001_b04')

  // Scenario B: Bullet is WEAK → Retain in issues, remove from strengths
  const mockAnalysisB = {
    strengths: [
      { id: 'str_001', title: 'Agile collaboration', evidence: { bulletId: 'exp_002_b03' } },
    ],
    issues: [
      { id: 'iss_001', title: 'Meeting attendance only', evidence: { bulletId: 'exp_002_b03' } },
    ],
  }
  const classificationsB = {
    exp_002_b03: { classification: 'WEAK' },
  }
  const resB = resolveEvidenceConsistency(mockAnalysisB, classificationsB)
  assert(resB.sanitizedAnalysis.strengths.length === 0, 'Should remove WEAK bullet from strengths')
  assert(resB.sanitizedAnalysis.issues.length === 1, 'Should retain WEAK bullet in issues')

  // Scenario C: Bullet is BORDERLINE → Remove from BOTH!
  const mockAnalysisC = {
    strengths: [
      { id: 'str_001', title: 'API security work', evidence: { bulletId: 'exp_002_b04' } },
    ],
    issues: [
      { id: 'iss_001', title: 'Security bullet lacks metric', evidence: { bulletId: 'exp_002_b04' } },
    ],
  }
  const classificationsC = {
    exp_002_b04: { classification: 'BORDERLINE' },
  }
  const resC = resolveEvidenceConsistency(mockAnalysisC, classificationsC)
  assert(resC.sanitizedAnalysis.strengths.length === 0, 'Should remove BORDERLINE bullet from strengths')
  assert(resC.sanitizedAnalysis.issues.length === 0, 'Should remove BORDERLINE bullet from issues')
})

// ── Test 6: Diagnosis/recommendation cannot be near-identical (§13, §14) ──────
test('Test 6: Diagnosis/recommendation cannot be near-identical', () => {
  // Identical / near-identical bad pair
  const badIssues = [
    {
      id: 'iss_001',
      diagnosis: 'Skills have limited evidence in experience.',
      recommendation: 'Skills have limited evidence in experience.',
    },
  ]
  const badResult = validateRecommendations(badIssues)
  assert(!badResult.valid, 'Identical diagnosis and recommendation must fail validation')
  assert(badResult.classification === 'RECOMMENDATION_TOO_SIMILAR', 'Must return RECOMMENDATION_TOO_SIMILAR')
  assert(badResult.violations.length === 1, 'Must report 1 violation')

  // Distinct action-oriented good pair
  const goodIssues = [
    {
      id: 'iss_001',
      diagnosis: 'The skills section lists tools with limited supporting evidence in experience entries.',
      recommendation: 'Reduce prominence for tools that are not supported by existing project evidence, while keeping the strongest demonstrated technologies prominent.',
    },
  ]
  const goodResult = validateRecommendations(goodIssues)
  assert(goodResult.valid, 'Distinct action-oriented recommendation must pass validation')
  assert(goodResult.classification === 'VALID', 'Must return VALID')
  assert(goodResult.violations.length === 0, 'Must have 0 violations')
})

// ── Test 7: Overall review 100–180 words (§15) ─────────────────────────────────
test('Test 7: Overall review target length 100–180 words', () => {
  const goodReview = `
    Swapnil demonstrates a strong technical track record across distributed systems and AI infrastructure, highlighted by concrete performance and scale outcomes. His work architecting FastMCP multi-tool orchestration pipelines, reducing support queries by 38%, and optimizing database queries down to 120ms provides immediate, high-value recruiter signal for senior engineering roles.

    To sharpen recruiter impact even further, the resume would benefit from tightening bullets where technical implementation is sound but explicit operational outcomes are not fully visible. In addition, aligning every listed tool in the skills section with demonstrated project evidence will present a more cohesive narrative to engineering hiring managers, ensuring every claim is backed by direct experience.
  `.trim()

  const wordCount = goodReview.split(/\s+/).filter(Boolean).length
  assert(wordCount >= 100 && wordCount <= 180, `Word count ${wordCount} should be between 100 and 180 words`)

  const paragraphs = goodReview.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  assert(paragraphs.length === 2, `Expected 2 short paragraphs, got ${paragraphs.length}`)
})

// ── Test 8: No unsupported assumptions (§16) ──────────────────────────────────
test('Test 8: No unsupported assumptions', () => {
  const mockAnalysisWithBuzzwords = {
    overallReview: {
      summary: 'Candidate built production-ready and enterprise-grade systems with advanced exceptional performance.',
    },
    issues: [
      {
        id: 'iss_001',
        diagnosis: 'This project is merely a student-level CRUD project.',
      },
    ],
  }

  const detected = detectUnsupportedAssumptions(mockAnalysisWithBuzzwords)
  assert(detected.length >= 3, `Expected at least 3 unsupported assumptions detected, got ${detected.length}`)

  const foundLabels = detected.map((d) => d.match.toLowerCase())
  assert(foundLabels.some((l) => l.includes('production-ready')), 'Should catch production-ready')
  assert(foundLabels.some((l) => l.includes('enterprise-grade')), 'Should catch enterprise-grade')
  assert(foundLabels.some((l) => l.includes('student-level')), 'Should catch student-level')
})

// ── Test 9: No hypothetical metrics (§3, §9) ──────────────────────────────────
test('Test 9: No hypothetical metrics in recommendations or rewrites', () => {
  const canonical = {
    experience: [
      {
        id: 'exp_001',
        bullets: [{ id: 'exp_001_b01', text: 'Built secure APIs through input validation.' }],
      },
    ],
  }

  // Analysis introducing a fake 45% metric
  const mockAnalysisWithFakeMetric = {
    issues: [
      {
        id: 'iss_001',
        category: 'impact',
        diagnosis: 'API security work lacks a quantified metric.',
        recommendation: 'Add metric e.g. reducing vulnerabilities by 45% or saving $50,000.',
        correctedText: null,
      },
    ],
  }

  const claimResult = validateClaims(mockAnalysisWithFakeMetric, canonical)
  assert(claimResult.violations.length >= 1, 'Should flag invented metric in recommendation')
  assert(claimResult.violations.some((v) => v.includes('45%') || v.includes('$50,000')), 'Should catch 45% or $50,000')
})

// ── Test 10: No new factual claims in correctedText ───────────────────────────
test('Test 10: No new factual claims in correctedText', () => {
  const canonical = {
    experience: [
      {
        id: 'exp_001',
        bullets: [
          {
            id: 'exp_001_b01',
            text: 'Built secure APIs and remediated XSS through input validation.',
          },
        ],
      },
    ],
  }

  // Rewrite that invents GraphQL and Kubernetes (which were not in the original bullet)
  const badRewrite = 'Built secure GraphQL APIs deployed to Kubernetes with automated input validation.'
  const resBad = validateRewrite(badRewrite, 'Built secure APIs and remediated XSS through input validation.', canonical)
  assert(!resBad.valid, 'Should reject rewrite introducing ungrounded technologies (GraphQL, Kubernetes)')
  assert(resBad.violations.length >= 1, 'Should report violations for ungrounded technologies')

  // Safe conservative rewrite using only existing facts
  const safeRewrite = 'Remediated XSS vulnerabilities by building secure APIs with robust input validation.'
  const resGood = validateRewrite(safeRewrite, 'Built secure APIs and remediated XSS through input validation.', canonical)
  assert(resGood.valid, 'Should accept truthful, conservative rephrasing')
})

// ── Additional Test: Technology Density Signal (§11, §12) ─────────────────────
test('Extra: Technology Density Signal detection', () => {
  const canonical = {
    projects: [
      {
        id: 'proj_002',
        bullets: [
          {
            id: 'proj_002_b01',
            text: 'Owned the microservices architecture and backend deploying on AWS ECS with Jenkins, Trivy, AWS Inspector, and Grafana.',
          },
        ],
      },
    ],
  }

  const tdResult = detectTechnologyDensity(canonical, { threshold: 4 })
  assert(tdResult.signals.length === 1, 'Should detect 1 technology-dense bullet')
  const sig = tdResult.signals[0]
  assert(sig.bulletId === 'proj_002_b01', 'Should match proj_002_b01')
  assert(sig.technologyCount >= 4, `Expected at least 4 technologies, found ${sig.technologyCount}`)
  assert(sig.technologies.includes('Jenkins'), 'Should include Jenkins')
  assert(sig.technologies.includes('AWS ECS') || sig.technologies.includes('AWS'), 'Should include AWS/ECS')
})

console.log('\n================================================================')
console.log(`RESULTS: ${passed} passed, ${failed} failed`)
console.log('================================================================\n')

if (failed > 0) {
  process.exit(1)
}
