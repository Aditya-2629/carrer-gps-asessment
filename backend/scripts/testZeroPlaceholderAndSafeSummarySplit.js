import assert from 'node:assert'
import fs from 'node:fs'
import {
  splitIntoSentencesSafely,
  cleanGrammarArtifacts,
} from '../services/docxResumeService.js'
import {
  generateDeterministicRewrite,
} from '../agents/resume/scoring/resumeScorecard.js'
import { buildHybridPrompt } from '../agents/resume/orchestration/modeC_hybrid.js'
import { estimateHeightBudget } from '../services/pageFit.js'

console.log('================================================================')
console.log('TEST SUITE: ZERO PLACEHOLDER MANDATE & SAFE SENTENCE SPLITTING')
console.log('================================================================\n')

// ── Test 1: modeC_hybrid System Prompt & Schema Verification ────────────────
console.log('[Test 1] modeC_hybrid Zero-Placeholder Mandate & Schema:')
const dossier = {
  quantification: { density: 0.7, totalBullets: 10, quantifiedBullets: 7, unquantifiedBulletIds: [] },
  toolDumps: [],
  timeline: { totalExperienceYears: 6, itemCount: 2 },
  targetJdOverlap: { evidencedSkills: [], unverifiedSkills: [] },
  marketEvidenceGaps: [],
}
const messages = buildHybridPrompt({
  compactResume: 'Alex Doe | Staff Engineer',
  dossier,
  targetRole: 'Staff Software Engineer',
})
const sysPrompt = messages[0].content

assert.ok(
  sysPrompt.includes('CRITICAL HUMANIZATION MANDATE (ZERO PLACEHOLDERS)'),
  'Must include zero placeholder mandate heading'
)
assert.ok(
  sysPrompt.includes('NEVER output bracketed placeholders like "[ADD: ...]"'),
  'Must forbid bracketed placeholders'
)
assert.ok(
  sysPrompt.includes('STRICTLY NO [ADD: ...] or bracketed placeholders'),
  'Schema must forbid [ADD: ...] placeholders'
)
console.log('  ✓ 1.1 Zero-placeholder mandate and schema descriptions verified in modeC_hybrid')

// ── Test 2: Academic & Professional Abbreviation Protection ─────────────────
console.log('[Test 2] splitIntoSentencesSafely Abbreviation Defense:')
const academicBio = 'Principal Engineer holding an M.S. in Computer Science and B.S. in Electrical Engineering from Stanford. Spearheaded high-throughput event processing platform processing 10B+ daily messages. Earned a Ph.D. in Distributed Systems with distinction. Directed cross-functional engineering teams.'
const sentences = splitIntoSentencesSafely(academicBio)

assert.strictEqual(sentences.length, 4, `Expected 4 sentences, got ${sentences.length}`)
assert.ok(
  sentences[0].includes('M.S. in Computer Science and B.S. in Electrical Engineering'),
  'Sentence 0 must not split on M.S. or B.S.'
)
assert.strictEqual(
  sentences[0],
  'Principal Engineer holding an M.S. in Computer Science and B.S. in Electrical Engineering from Stanford.'
)
assert.strictEqual(
  sentences[1],
  'Spearheaded high-throughput event processing platform processing 10B+ daily messages.'
)
assert.strictEqual(
  sentences[2],
  'Earned a Ph.D. in Distributed Systems with distinction.'
)
assert.strictEqual(
  sentences[3],
  'Directed cross-functional engineering teams.'
)

// Test with 3-sentence summary budget
const truncated = sentences.slice(0, 3).join(' ')
assert.ok(
  !truncated.includes('M.S. in Computer Science and B.S. in Electrical Engineering from Stanford. Spearheaded high-throughput event processing platform processing 10B+ daily messages. Earned a Ph.D. in Distributed Systems with distinction. Directed'),
  'Must truncate cleanly after exactly 3 full sentences without mangling degree'
)
assert.ok(truncated.endsWith('distinction.'), 'Truncated 3-sentence summary must end with distinction.')
console.log('  ✓ 2.1 Academic titles (M.S., B.S., Ph.D.) protected from premature sentence splitting')

// ── Test 3: cleanGrammarArtifacts Verification ──────────────────────────────
console.log('[Test 3] cleanGrammarArtifacts Grammar & Placeholder Sanitation:')
const dirtyBullet1 = 'Engineered microservices by by optimizing gRPC routing with with Envoy, reducing latency by [ADD: 45%].'
const cleaned1 = cleanGrammarArtifacts(dirtyBullet1)
assert.ok(!cleaned1.includes('[ADD:'), 'Must strip [ADD: ...]')
assert.ok(!cleaned1.includes('by by'), 'Must collapse "by by" to "by"')
assert.ok(!cleaned1.includes('with with'), 'Must collapse "with with" to "with"')
assert.strictEqual(
  cleaned1,
  'Engineered microservices by optimizing gRPC routing with Envoy, reducing latency.'
)

const dirtyBullet2 = 'Automated continuous deployment pipeline delivering 20+ production releases to to production with [ADD: zero downtime].'
const cleaned2 = cleanGrammarArtifacts(dirtyBullet2)
assert.strictEqual(
  cleaned2,
  'Automated continuous deployment pipeline delivering 20+ production releases to production.'
)
console.log('  ✓ 3.1 [ADD: ...] brackets stripped and duplicated prepositions collapsed cleanly')

// ── Test 4: resumeScorecard generateDeterministicRewrite Zero Placeholders ──
console.log('[Test 4] resumeScorecard Deterministic Rewrites:')
const rwSWE = generateDeterministicRewrite(
  'Responsible for data caching architecture.',
  { weakVerbIssue: true },
  false,
  'Senior Software Engineer'
)
assert.ok(!rwSWE.includes('[ADD:'), 'SWE rewrite must NOT contain [ADD:]')
assert.ok(
  rwSWE.includes('enhancing operational throughput, reducing execution latency, and ensuring continuous production uptime'),
  'SWE rewrite must use natural operational outcome'
)

const rwDA = generateDeterministicRewrite(
  'Worked on business metrics dashboards.',
  { weakVerbIssue: true },
  false,
  'Senior Data Analyst'
)
assert.ok(!rwDA.includes('[ADD:'), 'DA rewrite must NOT contain [ADD:]')
assert.ok(
  rwDA.includes('enhancing reporting adoption, reducing turnaround time, and enabling data-driven executive decisions'),
  'DA rewrite must use domain-appropriate outcome'
)

const rwCopilot = generateDeterministicRewrite(
  'using prompt engineering with Microsoft Copilot to write tests.',
  {},
  false
)
assert.ok(!rwCopilot.includes('[ADD:'), 'Copilot rewrite must NOT contain [ADD:]')
assert.ok(
  rwCopilot.includes('enhancing operational throughput and reducing defect leakage'),
  'Copilot rewrite must contain natural defect leakage outcome'
)
console.log('  ✓ 4.1 Deterministic scorecard rewrites deliver executive-grade natural outcomes with zero [ADD:] slots')

// ── Test 5: Height Budgeting Integration ────────────────────────────────────
console.log('[Test 5] Height Budgeting Integration:')
const resumeWithDegrees = {
  summary: academicBio,
  experiences: [
    {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      bullets: ['Architected cloud infrastructure.', 'Led 8 engineers.'],
    },
  ],
  skills: ['TypeScript', 'Node.js', 'Go', 'Docker', 'AWS'],
}
const pages = estimateHeightBudget(resumeWithDegrees, { shortenSummary: true, tightMargin: false })
assert.strictEqual(pages, 1, 'Calibrated height budget with safe summary split should fit in 1 page')
console.log('  ✓ 5.1 Height budgeting uses splitIntoSentencesSafely smoothly')

// ── Test 6: Frontend cleanRewriteText Functions ─────────────────────────────
console.log('[Test 6] Frontend cleanRewriteText Sanitation Check:')
const bulletAuditSrc = fs.readFileSync('src/components/report/ResumeBulletAudit.jsx', 'utf8')
const deepDiagnosisSrc = fs.readFileSync('src/components/report/ResumeDeepDiagnosis.jsx', 'utf8')
const oppListSrc = fs.readFileSync('src/components/report/OpportunitiesList.jsx', 'utf8')

assert.ok(bulletAuditSrc.includes('.replace(/(\\\\s+(?:by|to|of|across|for|with|at|in|from))?\\\\s*\\\\[ADD:[^\\\\]]*\\\\]/gi, \'\')') || bulletAuditSrc.includes('.replace(/(\\s+(?:by|to|of|across|for|with|at|in|from))?\\s*\\[ADD:[^\\]]*\\]/gi, \'\')'), 'ResumeBulletAudit must strip [ADD:...]')
assert.ok(deepDiagnosisSrc.includes('.replace(/(\\\\s+(?:by|to|of|across|for|with|at|in|from))?\\\\s*\\\\[ADD:[^\\\\]]*\\\\]/gi, \'\')') || deepDiagnosisSrc.includes('.replace(/(\\s+(?:by|to|of|across|for|with|at|in|from))?\\s*\\[ADD:[^\\]]*\\]/gi, \'\')'), 'ResumeDeepDiagnosis must strip [ADD:...]')
assert.ok(oppListSrc.includes('.replace(/(\\\\s+(?:by|to|of|across|for|with|at|in|from))?\\\\s*\\\\[ADD:[^\\\\]]*\\\\]/gi, \'\')') || oppListSrc.includes('.replace(/(\\s+(?:by|to|of|across|for|with|at|in|from))?\\s*\\[ADD:[^\\]]*\\]/gi, \'\')'), 'OpportunitiesList must strip [ADD:...]')

console.log('  ✓ 6.1 Frontend components verified for complete [ADD: ...] bracket stripping')

console.log('\n================================================================')
console.log('ALL ZERO PLACEHOLDER & SAFE SENTENCE SPLITTING TESTS PASSED!')
console.log('================================================================')
