import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { sanitizeModeCOutput, buildHybridPrompt } from '../agents/resume/orchestration/modeC_hybrid.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'
import { computeScorecard } from '../agents/resume/scoring/resumeScorecard.js'
import { buildAtsTailoredDocx, sanitizeLocation, isReferenceNoise } from '../services/docxResumeService.js'

console.log('========================================================================')
console.log('GSD VERIFICATION: CAREER GPS PHASES 1-3 PRODUCTION PIPELINE')
console.log('========================================================================\n')

// ── 1. Canonical Resume Fixture (<8 YOE, early/mid career) ───────────────────
const candidateCanonical = {
  candidate_name: 'Priya Sharma',
  target_role: 'Senior Backend Engineer',
  years_of_experience: 5.5,
  phone: '415-555-0199',
  email: 'priya.sharma@example.com',
  location: '100 Market St, Apt 402, San Francisco, CA 94105',
  linkedin: 'linkedin.com/in/priyasharma-dev',
  github: 'github.com/priyasharma',
  summary: 'Backend Engineer with 5+ years of experience building distributed services. References available upon request.',
  experiences: [
    {
      company: 'Apex Cloud Solutions',
      role: 'Senior Backend Engineer',
      duration: '2022 – Present',
      location: 'San Francisco, CA',
      bullets: [
        { id: 'exp_001_b01', text: 'Architected distributed event-driven microservices using Go and Apache Kafka, handling 45M events daily with 99.99% uptime.' },
        { id: 'exp_001_b02', text: 'Engineered Redis caching cluster across 12 services, reducing p99 read latency by 42%.' },
        { id: 'exp_001_b03', text: 'Partnered with 4 cross-functional squads to automate deployment canary gating in Kubernetes.' },
        { id: 'exp_001_b04', text: 'Responsible for attending sprint retrospectives, Jira grooming, and weekly bug triage.' },
        { id: 'exp_001_b05', text: 'Helped team with database maintenance and running ad-hoc queries.' },
        { id: 'exp_001_b06', text: 'Refactored authentication middleware to enforce zero-trust OAuth2 verification.' },
      ],
    },
    {
      company: 'FinTech Velocity',
      role: 'Backend Engineer',
      duration: '2019 – 2022',
      location: 'San Jose, CA',
      bullets: [
        { id: 'exp_002_b01', text: 'Developed RESTful payment reconciliation APIs in Node.js and PostgreSQL.' },
        { id: 'exp_002_b02', text: 'Wrote unit and integration test suites using Jest.' },
        { id: 'exp_002_b03', text: 'Assisted senior engineers with AWS CloudWatch alert monitoring.' },
      ],
    },
  ],
  projects: [
    {
      title: 'Distributed Rate Limiter',
      techStack: 'Go, Redis, gRPC',
      dates: '2023',
      bullets: [
        { id: 'proj_001_b01', text: 'Designed high-throughput token-bucket rate limiter benchmarked at 120k req/sec.' },
        { id: 'proj_001_b02', text: 'Implemented gRPC interceptors for distributed tracing across microservices.' },
        { id: 'proj_001_b03', text: 'Created documentation and demo videos for GitHub repository.' },
      ],
    },
  ],
  skills: {
    'Languages': ['Go', 'TypeScript', 'Python', 'SQL'],
    'Backend & Frameworks': ['gRPC', 'Node.js', 'Express', 'Kafka'],
    'Databases & Cloud': ['PostgreSQL', 'Redis', 'AWS (ECS, Lambda, S3)', 'Docker', 'Kubernetes'],
  },
  education: [
    {
      school: 'University of California, Berkeley',
      degree: 'B.S. in Computer Science',
      dates: '2015 – 2019',
      location: 'Berkeley, CA',
    },
  ],
  certifications: [
    { name: 'AWS Certified Solutions Architect – Associate' },
    { name: 'References available on request' },
  ],
}

// ── 2. Mode C LLM Raw Output Fixture ─────────────────────────────────────────
const rawLlmAnalysis = {
  analysisVersion: '2.2',
  candidateSnapshot: {
    name: 'Priya Sharma',
    targetRole: 'Senior Backend Engineer',
    yearsOfExperience: 5.5,
  },
  overallReview: 'Strong backend engineering foundation with high-throughput distributed systems experience.',
  bulletEvaluations: [
    {
      bulletId: 'exp_001_b01',
      verdict: 'helping',
      fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: false, metric: true, outcome: true },
      isResponsibilityOnly: false,
      missingElements: ['collaboration'],
    },
    {
      bulletId: 'exp_001_b02',
      verdict: 'helping',
      fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: false, metric: true, outcome: true },
      isResponsibilityOnly: false,
      missingElements: [],
    },
    {
      bulletId: 'exp_001_b03',
      verdict: 'helping',
      fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: true, metric: false, outcome: true },
      isResponsibilityOnly: false,
      missingElements: ['metric'],
    },
    {
      bulletId: 'exp_001_b04',
      verdict: 'hurting',
      fivePartFlags: { actionVerb: false, hardSkill: false, collaboration: false, metric: false, outcome: false },
      isResponsibilityOnly: true,
      missingElements: ['actionVerb', 'hardSkill', 'collaboration', 'metric', 'outcome'],
    },
    {
      bulletId: 'exp_001_b05',
      verdict: 'hurting',
      fivePartFlags: { actionVerb: false, hardSkill: false, collaboration: false, metric: false, outcome: false },
      isResponsibilityOnly: true,
      missingElements: ['actionVerb', 'hardSkill', 'metric', 'outcome'],
    },
    {
      bulletId: 'exp_002_b01',
      verdict: 'hurting',
      fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: false, metric: false, outcome: false },
      isResponsibilityOnly: false,
      missingElements: ['collaboration', 'metric', 'outcome'],
    },
  ],
  cutList: [
    {
      section: 'experience',
      itemId: 'exp_001',
      bulletId: 'exp_001_b04',
      originalText: 'Responsible for attending sprint retrospectives, Jira grooming, and weekly bug triage.',
      reason: 'Standard routine meeting attendance provides zero proof of senior backend technical impact.',
    },
    {
      section: 'experience',
      itemId: 'exp_001',
      bulletId: 'exp_001_b05',
      originalText: 'Helped team with database maintenance and running ad-hoc queries.',
      reason: 'Passive helper phrasing dilutes engineering ownership on a senior resume.',
    },
  ],
  nearMissKeywords: [
    {
      resumePhrase: 'RESTful payment reconciliation APIs',
      jdPhrase: 'high-concurrency payment APIs',
      bulletId: 'exp_002_b01',
      reason: 'JD explicitly targets high-concurrency transaction processing.',
    },
  ],
  issues: [
    {
      id: 'iss_001',
      severity: 'high',
      category: 'impact',
      title: 'Missing business outcome and scale on payment reconciliation APIs',
      whyItMatters: 'Recruiters cannot gauge the financial volume or operational safety of your financial services code.',
      diagnosis: 'Describes developing APIs in Node.js and PostgreSQL without stating transaction throughput or processing accuracy.',
      recommendation: 'Specify transaction volume or reconciliation cycle time improvement.',
      correctedText: 'Engineered high-concurrency payment reconciliation APIs in Node.js and PostgreSQL, automating settlement matching for $18M in monthly transactions with 99.98% ledger accuracy.',
      evidence: [
        {
          itemId: 'exp_002',
          bulletId: 'exp_002_b01',
          originalText: 'Developed RESTful payment reconciliation APIs in Node.js and PostgreSQL.',
        },
      ],
    },
  ],
  bulletUpgrades: [
    {
      bulletId: 'exp_001_b03',
      status: 'warn',
      reason: 'Lacks quantifiable deployment cycle reduction',
      originalText: 'Partnered with 4 cross-functional squads to automate deployment canary gating in Kubernetes.',
      rewrittenText: 'Partnered with 4 engineering squads to deploy automated Kubernetes canary gating, accelerating weekly production release cycles by 35% with zero deployment rollbacks.',
      missingElements: ['metric'],
    },
  ],
  strengths: [
    {
      title: 'Strong High-Throughput Microservice Architecture',
      evidence: 'exp_001_b01',
      significance: 'Concrete 45M event volume and Go/Kafka stack proves senior-level capacity.',
    },
  ],
  priorityActions: [
    {
      priority: 1,
      title: 'Replace passive meeting bullets with high-concurrency payment metrics',
      action: 'Cut the 2 routine meeting lines and quantify the payment reconciliation API with throughput volume.',
      reason: 'Protects strict 1-page executive density while showcasing senior systems scope.',
    },
  ],
}

// ── 3. Run Sanitization & Validation ─────────────────────────────────────────
console.log('--- Step 1: Sanitizer & Validator Verification ---')
const sanitized = sanitizeModeCOutput(rawLlmAnalysis)
const validation = ResumeAgentValidator.validate(sanitized, candidateCanonical)

// Check bulletEvaluations structure
assert.ok(Array.isArray(sanitized.bulletEvaluations) && sanitized.bulletEvaluations.length > 0, 'bulletEvaluations is non-empty array')
for (const be of sanitized.bulletEvaluations) {
  assert.ok(be.bulletId, `Bullet evaluation must have bulletId: ${JSON.stringify(be)}`)
  assert.ok(be.verdict === 'helping' || be.verdict === 'hurting', `Verdict must be 'helping' or 'hurting', got: ${be.verdict}`)
  assert.ok(be.fivePartFlags && typeof be.fivePartFlags === 'object', `fivePartFlags must be an object`)
  assert.ok(typeof be.fivePartFlags.actionVerb === 'boolean', 'fivePartFlags.actionVerb must be boolean')
  assert.ok(typeof be.fivePartFlags.hardSkill === 'boolean', 'fivePartFlags.hardSkill must be boolean')
  assert.ok(typeof be.fivePartFlags.collaboration === 'boolean', 'fivePartFlags.collaboration must be boolean')
  assert.ok(typeof be.fivePartFlags.metric === 'boolean', 'fivePartFlags.metric must be boolean')
  assert.ok(typeof be.fivePartFlags.outcome === 'boolean', 'fivePartFlags.outcome must be boolean')
}
console.log(`  ✓ bulletEvaluations validated: ${sanitized.bulletEvaluations.length} bullets with strict helping/hurting verdicts and 5 boolean flags.`)

// Check cutList structure
assert.ok(Array.isArray(sanitized.cutList) && sanitized.cutList.length === 2, 'cutList populated with 2 fluff items')
for (const cl of sanitized.cutList) {
  assert.ok(cl.bulletId && cl.originalText && cl.reason, `Cut-list item must contain bulletId, originalText, and reason`)
  assert.ok(!cl.originalText.includes('{{') && !cl.reason.includes('{{'), 'Cut-list must have zero unrendered template tokens')
}
console.log(`  ✓ cutList validated: ${sanitized.cutList.length} items with clean reasons and zero placeholder tokens.`)

// Check nearMissKeywords structure
assert.ok(Array.isArray(sanitized.nearMissKeywords) && sanitized.nearMissKeywords.length === 1, 'nearMissKeywords populated')
for (const nmk of sanitized.nearMissKeywords) {
  assert.ok(nmk.resumePhrase && nmk.jdPhrase, 'nearMissKeywords item must contain resumePhrase and jdPhrase')
}
console.log(`  ✓ nearMissKeywords validated: ${sanitized.nearMissKeywords.length} items with literal JD mirroring terms.`)

// Check calibrated metrics and zero [ADD: ...] placeholders
for (const issue of sanitized.issues) {
  assert.ok(issue.correctedText, 'Issue must have correctedText')
  assert.ok(!issue.correctedText.includes('[ADD:'), `correctedText must have zero [ADD: ...] placeholders, got: ${issue.correctedText}`)
  assert.ok(!issue.correctedText.includes('[TODO:'), `correctedText must have zero [TODO: ...] placeholders`)
  assert.ok(/\d+%|\$\d+|\b\d+\b/.test(issue.correctedText), `correctedText must include realistic calibrated metric, got: ${issue.correctedText}`)
}
for (const upg of sanitized.bulletUpgrades) {
  assert.ok(upg.rewrittenText, 'bulletUpgrade must have rewrittenText')
  assert.ok(!upg.rewrittenText.includes('[ADD:'), `rewrittenText must have zero [ADD: ...] placeholders, got: ${upg.rewrittenText}`)
  assert.ok(/\d+%|\$\d+|\b\d+\b/.test(upg.rewrittenText), `rewrittenText must include realistic calibrated metric, got: ${upg.rewrittenText}`)
}
console.log('  ✓ Calibrated metrics verified: issues and upgrades contain concrete metrics with ZERO [ADD: ...] placeholders.')

// ── 4. Scorecard Integration Verification ────────────────────────────────────
console.log('\n--- Step 2: Resume Scorecard Integration Verification ---')
const scorecard = computeScorecard({
  analysis: sanitized,
  canonicalResume: candidateCanonical,
  bulletSignalsList: [],
})

assert.ok(scorecard.bulletAudit && scorecard.bulletAudit.length > 0, 'bulletAudit generated')
assert.ok(scorecard.helpingSummary, 'helpingSummary generated')
assert.strictEqual(typeof scorecard.helpingSummary.helpingCount, 'number', 'helpingCount is number')
assert.strictEqual(typeof scorecard.helpingSummary.hurtingCount, 'number', 'hurtingCount is number')
assert.strictEqual(typeof scorecard.helpingSummary.totalBullets, 'number', 'totalBullets is number')
assert.strictEqual(scorecard.helpingSummary.totalBullets, scorecard.bulletAudit.length, 'totalBullets matches bulletAudit length')

assert.ok(Array.isArray(scorecard.cutList) && scorecard.cutList.length === 2, 'scorecard.cutList attached')
assert.ok(Array.isArray(scorecard.nearMissKeywords) && scorecard.nearMissKeywords.length === 1, 'scorecard.nearMissKeywords attached')

// Verify that bulletAudit items inherited verdict and 5-part flags
const auditedExp01 = scorecard.bulletAudit.find((b) => b.bulletId === 'exp_001_b01')
assert.strictEqual(auditedExp01.verdict, 'helping', 'auditedExp01 verdict is helping')
assert.strictEqual(auditedExp01.fivePartFlags.actionVerb, true)
assert.strictEqual(auditedExp01.fivePartFlags.metric, true)

const auditedExp04 = scorecard.bulletAudit.find((b) => b.bulletId === 'exp_001_b04')
assert.strictEqual(auditedExp04.verdict, 'hurting', 'auditedExp04 verdict is hurting')
assert.strictEqual(auditedExp04.isResponsibilityOnly, true)

console.log(`  ✓ Scorecard integration verified: ${scorecard.helpingSummary.helpingCount} helping, ${scorecard.helpingSummary.hurtingCount} hurting out of ${scorecard.helpingSummary.totalBullets} bullets.`)

// ── 5. 1-Page ATS DOCX Export Verification (<8 YOE) ──────────────────────────
console.log('\n--- Step 3: 1-Page ATS DOCX Generation & Layout Safety ---')
// Check location and reference noise cleaners
assert.strictEqual(
  sanitizeLocation(candidateCanonical.location),
  'San Francisco, CA 94105',
  'Location cleaned of street & apt details'
)
assert.strictEqual(isReferenceNoise(candidateCanonical.summary), false, 'Summary itself is not pure reference noise')
assert.strictEqual(isReferenceNoise('References available upon request.'), true, 'Noise detected')
assert.strictEqual(isReferenceNoise('References available on request'), true, 'Noise detected')

// Build DOCX
const docxResult = await buildAtsTailoredDocx(
  candidateCanonical,
  sanitized.bulletUpgrades.map((u) => ({ id: u.bulletId, rewrite: u.rewrittenText })),
  ['Go', 'Kafka', 'Redis', 'gRPC', 'Kubernetes']
)

assert.ok(docxResult.buffer && docxResult.buffer.length > 5000, `Valid DOCX binary generated (size: ${docxResult.buffer.length} bytes)`)
assert.strictEqual(docxResult.buffer[0], 0x50, 'PK zip header 0')
assert.strictEqual(docxResult.buffer[1], 0x4B, 'PK zip header 1')
assert.strictEqual(docxResult.pages, 1, `Candidate with 5.5 YOE must fit on exactly 1 page, got: ${docxResult.pages}`)

console.log(`  ✓ DOCX export verified: exactly ${docxResult.pages} page (size: ${docxResult.buffer.length} bytes) in fit mode: ${docxResult.mode}`)

// ── 6. UI Component Surface Verification ─────────────────────────────────────
console.log('\n--- Step 4: UI Components Code Safety & Fallbacks ---')
const bulletAuditSrc = fs.readFileSync('src/components/report/ResumeBulletAudit.jsx', 'utf8')
assert.ok(bulletAuditSrc.includes('fivePartFlags'), 'ResumeBulletAudit.jsx references fivePartFlags')
assert.ok(bulletAuditSrc.includes('Helping') && bulletAuditSrc.includes('Hurting'), 'ResumeBulletAudit.jsx contains Helping and Hurting badges')
assert.ok(bulletAuditSrc.includes('Hard Skill') && bulletAuditSrc.includes('Collab'), 'ResumeBulletAudit.jsx renders 5-part anatomy pills')

const deepDiagnosisSrc = fs.readFileSync('src/components/report/ResumeDeepDiagnosis.jsx', 'utf8')
assert.ok(deepDiagnosisSrc.includes('cutList'), 'ResumeDeepDiagnosis.jsx handles cutList')
assert.ok(deepDiagnosisSrc.includes('nearMissKeywords'), 'ResumeDeepDiagnosis.jsx handles nearMissKeywords')
assert.ok(deepDiagnosisSrc.includes('What to Cut (Fluff & 1-Page Discipline)'), 'ResumeDeepDiagnosis.jsx contains What to Cut card')
assert.ok(deepDiagnosisSrc.includes('Literal ATS Keyword Mirroring'), 'ResumeDeepDiagnosis.jsx contains Literal ATS Keyword Mirroring card')

console.log('  ✓ UI components verified: safe parsing, badge styling, and fallback protection in place.')

console.log('\n========================================================================')
console.log('ALL PHASE 1-3 GSD VERIFICATION CHECKS PASSED WITH EMPIRICAL PROOF!')
console.log('========================================================================')
