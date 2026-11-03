import assert from 'node:assert'
import fs from 'node:fs'
import { generateDeterministicRewrite } from '../agents/resume/scoring/resumeScorecard.js'
import { weaveKeywordsDeterministic } from '../agents/resume/market/smartKeywordWeaver.js'
import { buildDeterministicOptimizations } from '../agents/linkedin/linkedinSynthesis.js'
import { truncateAtWord } from '../agents/assessment/assessmentAgent.js'
import { cleanPlaceholderGraceful } from '../services/resumeValidator.js'

console.log('================================================================')
console.log('TEST SUITE: RESPONSE-DRIVEN ARCHITECTURAL MAGNET OVERHAUL')
console.log('================================================================\n')

// ── Test 1: Google XYZ + Architectural Mechanism Across Domain Archetypes ─────
console.log('[Test 1] Domain-Calibrated Architectural Mechanism Rewrites:')

// 1.1 SWE / Backend Role
const sweRewrite = generateDeterministicRewrite(
  'Responsible for the payment gateway services.',
  { weakVerbIssue: true },
  false,
  'Senior Backend Engineer'
)
assert.ok(sweRewrite.startsWith('Architected'), 'SWE rewrite must lead with Architected')
assert.ok(
  sweRewrite.includes('by establishing decoupled microservice boundaries and resilient caching'),
  'SWE rewrite must inject architectural mechanism'
)
assert.ok(
  sweRewrite.includes('enhancing operational throughput, reducing execution latency, and ensuring continuous production uptime'),
  'SWE rewrite must inject operational outcome'
)
console.log('  ✓ 1.1 Software / Backend Engineer archetype verified with architectural mechanism')

// 1.2 Data & Business Analyst Role
const dataRewrite = generateDeterministicRewrite(
  'Worked on SQL queries and executive dashboards.',
  { weakVerbIssue: true },
  false,
  'Lead Data & Business Analyst'
)
assert.ok(dataRewrite.startsWith('Engineered'), 'Data rewrite must lead with strong verb')
assert.ok(
  dataRewrite.includes('by architecting automated star-schema data models and dbt test assertions'),
  'Data rewrite must inject star-schema / dbt mechanism'
)
assert.ok(
  dataRewrite.includes('enhancing reporting adoption, reducing turnaround time, and enabling data-driven executive decisions'),
  'Data rewrite must inject decision-support outcome'
)
console.log('  ✓ 1.2 Data & Business Analyst archetype verified with star-schema and dbt mechanism')

// 1.3 Generative AI & ML Engineer Role
const aiRewrite = generateDeterministicRewrite(
  'Helped with RAG pipeline and LLM tool calling.',
  { weakVerbIssue: true },
  false,
  'Generative AI & ML Engineer'
)
assert.ok(aiRewrite.startsWith('Led'), 'AI rewrite must lead with strong verb')
assert.ok(
  aiRewrite.includes('by architecting production vector retrieval pipelines with automated context-caching guardrails'),
  'AI rewrite must inject vector retrieval and context-caching mechanism'
)
assert.ok(
  aiRewrite.includes('minimizing token latency, eliminating hallucination risks, and sustaining reliable sub-second inference'),
  'AI rewrite must inject hallucination & latency outcome'
)
console.log('  ✓ 1.3 Generative AI & ML Engineer archetype verified with RAG and hallucination defense mechanism')

// 1.4 DevOps & Cloud Engineer Role
const devopsRewrite = generateDeterministicRewrite(
  'Supported the deployment pipelines.',
  { weakVerbIssue: true },
  false,
  'Senior Cloud & DevOps Engineer'
)
assert.ok(
  devopsRewrite.includes('by orchestrating multi-stage Docker builds and automated Kubernetes rolling deployments'),
  'DevOps rewrite must inject Docker and Kubernetes rolling deployment mechanism'
)
assert.ok(
  devopsRewrite.includes('sustaining 99.99% service availability, accelerating release velocity, and ensuring zero-downtime rollouts'),
  'DevOps rewrite must inject zero-downtime rollout outcome'
)
console.log('  ✓ 1.4 DevOps & Cloud Engineer archetype verified with Kubernetes and zero-downtime mechanism')

// 1.5 Security & Vulnerability Non-Absurdity
const secRewrite = generateDeterministicRewrite(
  'Assisted with input sanitization and XSS vulnerability remediation across user endpoints.',
  { weakVerbIssue: true },
  false,
  'Senior Software Engineer'
)
assert.ok(
  secRewrite.includes('by implementing automated DevSecOps vulnerability scanning and strict payload validation'),
  'Security rewrite must inject DevSecOps vulnerability scanning mechanism'
)
assert.ok(
  secRewrite.includes('eliminating high-severity CVEs and ensuring 100% security audit compliance across release pipelines'),
  'Security rewrite must anchor on CVE elimination and audit compliance, never latency or throughput'
)
assert.ok(!secRewrite.includes('reducing execution latency'), 'Security rewrite must never claim sanitization speeds up latency')
console.log('  ✓ 1.5 Security & Vulnerability non-absurdity verified with CVE elimination and zero latency claims')

// ── Test 2: Organic Skill Weaving with Architectural Rationale ─────────────────
console.log('\n[Test 2] Organic Skill Weaving with Architectural Rationale:')
const mockResume = {
  experiences: [
    {
      company: 'Stripe',
      role: 'Staff Infrastructure Engineer',
      bullets: [
        'Engineered event ingestion workers processing high transaction volumes.',
        'Developed customer portal backend services with Node.js and React.',
        'Maintained database clusters and caching layers under peak loads.',
      ],
    },
  ],
}

const missingKws = ['Kafka', 'TypeScript', 'Redis']
const wovenResult = weaveKeywordsDeterministic({
  canonicalResume: mockResume,
  missingKeywords: missingKws,
})

const kafkaItem = wovenResult.interviewLedger.find((l) => l.keyword === 'Kafka')
assert.ok(kafkaItem, 'Kafka must be woven')
assert.ok(
  kafkaItem.exactBullet.includes('utilizing Kafka event topics to decouple asynchronous workers, eliminating request drops during high-volume spikes'),
  'Kafka must inject full architectural rationale, never bare keyword'
)

const tsItem = wovenResult.interviewLedger.find((l) => l.keyword === 'TypeScript')
assert.ok(tsItem, 'TypeScript must be woven')
assert.ok(
  tsItem.exactBullet.includes('adopting TypeScript to enforce strict API payload contracts, eliminating runtime type errors across service boundaries'),
  'TypeScript must inject payload contract safety rationale'
)

const redisItem = wovenResult.interviewLedger.find((l) => l.keyword === 'Redis')
assert.ok(redisItem, 'Redis must be woven')
assert.ok(
  redisItem.exactBullet.includes('implementing a Redis read-aside caching layer with TTL eviction, offloading 70% of read queries from the primary database'),
  'Redis must inject read-aside caching rationale'
)
console.log('  ✓ 2.1 Missing keywords woven with deep architectural rationale and interview scripts')

// ── Test 3: Full 180–250 Word 3-Paragraph LinkedIn Storytelling ───────────────
console.log('\n[Test 3] Full 180–250 Word 3-Paragraph LinkedIn Storytelling:')
const linkedinOptimization = buildDeterministicOptimizations(
  { headline: 'Senior Backend Engineer', about: 'Short stub' },
  {
    canonicalResume: {
      candidate: { targetRole: 'Senior Backend Engineer' },
      years_of_experience: '5+ years',
      experience: [
        {
          company: 'Uber',
          role: 'Senior Backend Engineer',
          bullets: ['Scaled dispatch pipeline cutting p99 latency by 35% across 2M daily rides.'],
        },
      ],
      skills: ['Python', 'Go', 'Kafka', 'Redis', 'Docker', 'Kubernetes', 'PostgreSQL'],
    },
  },
  ['Kubernetes', 'Kafka']
)

const about = linkedinOptimization.aboutRewrite
assert.ok(about, 'Must return aboutRewrite')
assert.ok(about.hook, 'Must return paragraph 1 (hook)')
assert.ok(about.proof, 'Must return paragraph 2 (proof)')
assert.ok(about.callToAction, 'Must return paragraph 3 (callToAction)')

const fullText = about.fullText
const wordCount = (fullText.match(/\b\w+\b/g) || []).length
console.log(`  → LinkedIn About Rewrite word count: ${wordCount} words`)
assert.ok(wordCount >= 180, `Must be at least 180 words, got ${wordCount}`)
assert.ok(wordCount <= 265, `Must be bounded around 250 words, got ${wordCount}`)

const paragraphs = fullText.split(/\n\n+/).filter((p) => p.trim().length > 0)
assert.ok(paragraphs.length >= 3, `Must contain at least 3 distinct paragraphs, got ${paragraphs.length}`)
console.log('  ✓ 3.1 LinkedIn About rewrite delivers 180–250 words across 3 executive paragraphs')

// ── Test 4: Clean Whole-Word Truncation (Zero "recrui...") ─────────────────────
console.log('\n[Test 4] Clean Whole-Word Truncation Defense:')
const rawChallenge = 'Getting ghosted before talking to any human recruiter'
const truncated65 = truncateAtWord(rawChallenge, 65)
assert.strictEqual(
  truncated65,
  'Getting ghosted before talking to any human recruiter',
  'Short strings under 65 chars must never be truncated'
)

const longChallenge = 'Getting ghosted before talking to any human recruiter or executive hiring manager at target tier-1 tech firms'
const truncatedLong = truncateAtWord(longChallenge, 65)
assert.ok(!truncatedLong.includes('recrui...'), 'Must NEVER slice words into "recrui..."')
assert.ok(truncatedLong.endsWith('...'), 'Truncated string must end with ellipsis')
const lastWord = truncatedLong.replace(/\.\.\.$/, '').split(/\s+/).pop()
assert.ok(
  ['recruiter', 'or', 'human', 'any', 'before', 'talking', 'to'].includes(lastWord.toLowerCase()),
  `Must cut cleanly at whole word boundary, got last word: "${lastWord}"`
)
console.log('  ✓ 4.1 truncateAtWord cleanly cuts at word boundaries with zero chopped words')

// ── Test 5: Frontend 1-Click Metric Generator & Validator ─────────────────────
console.log('\n[Test 5] Frontend 1-Click Metric Options & Validator:')
const auditSrc = fs.readFileSync('src/components/report/ResumeBulletAudit.jsx', 'utf8')
assert.ok(auditSrc.includes('1-Click Realistic Metric Generator:'), 'ResumeBulletAudit must include 1-Click Generator UI')
assert.ok(auditSrc.includes('Option A (Conservative)'), 'Must include Option A chip')
assert.ok(auditSrc.includes('Option B (Standard)'), 'Must include Option B chip')
assert.ok(auditSrc.includes('Option C (High-Scale)'), 'Must include Option C chip')

const cleanedPl = cleanPlaceholderGraceful('Refactored API endpoint by by with with [ADD: 40% reduction] by.')
assert.ok(!cleanedPl.includes('[ADD:'), 'Must strip bracket placeholders')
assert.ok(!cleanedPl.includes('by by'), 'Must collapse duplicate by')
assert.ok(!cleanedPl.includes('with with'), 'Must collapse duplicate with')
assert.ok(!cleanedPl.endsWith('by.'), 'Must eliminate hanging prepositions')
console.log('  ✓ 5.1 Frontend 1-Click chips and validator grammar guards verified')

console.log('\n================================================================')
console.log('ALL RESPONSE-DRIVEN ARCHITECTURAL MAGNET TESTS PASSED!')
console.log('================================================================')
