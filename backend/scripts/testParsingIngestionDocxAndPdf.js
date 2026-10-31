import assert from 'assert'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { cleanPlaceholderGraceful } from '../services/resumeValidator.js'
import { buildAtsTailoredDocx } from '../services/docxResumeService.js'
import { generateStandardReportPdf } from '../utils/reportPdfGenerator.js'

console.log('================================================================')
console.log('RUNNING COMPLETE ARCHITECTURAL INGESTION, DOCX & PDF TEST SUITE')
console.log('================================================================')

// ── Test 1: Compound Header Ingestion (EDUCATION & CERTIFICATIONS) ──
console.log('\n[Test 1] Compound Header Ingestion:')
const rawDoc = {
  rawText: `
HASWANTH VALLURU
haswanth@example.com | (555) 123-4567 | linkedin.com/in/haswanth

PROFESSIONAL SUMMARY
Data Analyst with 3+ years experience building analytics dashboards and data pipelines.

EXPERIENCE
Data Analyst Jul 2024 - May 2025
Shure Incorporated USA
• Designed automated ETL pipelines in Python and SQL reducing manual processing time by 30%.
• Built Tableau executive dashboards monitored daily by VP of Operations.

PROJECTS
E-Commerce Churn Prediction Model
• Developed random forest classification model achieving 85% accuracy on customer retention dataset.

EDUCATION & CERTIFICATIONS
Master of Science in Data Analytics
University of Illinois Chicago
May 2024
AWS Certified Cloud Practitioner
Google Data Analytics Professional Certificate
`,
}

const canonical = ResumeNormalizer.normalize(rawDoc, 'Data Analyst')

// Verify Education is populated and NOT swallowed into projects
assert(Array.isArray(canonical.education) && canonical.education.length >= 1, 'Education must be populated')
const hasDegree = canonical.education.some((e) => /master|data analytics|university/i.test(`${e.degree} ${e.institution}`))
assert(hasDegree, `Expected University of Illinois degree in education, found: ${JSON.stringify(canonical.education)}`)

// Verify Certifications are populated
assert(Array.isArray(canonical.certifications) && canonical.certifications.length >= 1, 'Certifications must be populated')
const hasAwsOrGoogle = canonical.certifications.some((c) => /aws|google|certified/i.test(c.name))
assert(hasAwsOrGoogle, `Expected AWS or Google certification, found: ${JSON.stringify(canonical.certifications)}`)

// Verify Projects contains ONLY true projects, NO degrees
const projectTitles = canonical.projects.map((p) => p.title)
assert(!projectTitles.some((t) => /university|college|master|bachelor/i.test(t)), 'Projects must not contain degrees')
assert(canonical.projects.some((p) => /churn|prediction|e-commerce/i.test(p.title)), 'Projects must contain true project')

console.log('  ✓ 1.1 EDUCATION & CERTIFICATIONS compound header split accurately into education and certifications')
console.log('  ✓ 1.2 Strict Separation Guard verified: degrees absent from projects, education has degree entries')

// ── Test 2: Company Name Defaulting Guard ──
console.log('\n[Test 2] Company Name Defaulting Guard:')
assert(canonical.experience.length >= 1, 'Experience must be populated')
const exp1 = canonical.experience[0]

// Company name must NOT be "Data Analyst Jul 2024 - May 2025" or contain date
assert(!/jul\s*2024/i.test(exp1.company), `Company must not contain dates, got: "${exp1.company}"`)
assert(!/^data\s+analyst/i.test(exp1.company), `Company must not be job title, got: "${exp1.company}"`)
assert(/shure\s+incorporated/i.test(exp1.company), `Company should match Shure Incorporated, got: "${exp1.company}"`)
assert.strictEqual(exp1.role, 'Data Analyst', `Role must be Data Analyst, got: "${exp1.role}"`)

// Test standalone header parseExperienceHeader directly
const headerWithDateFirst = ResumeNormalizer.parseExperienceHeader('Data Analyst Jul 2024 - May 2025', 'PwC USA')
assert.strictEqual(headerWithDateFirst.role, 'Data Analyst', 'Role parsed correctly')
assert.strictEqual(headerWithDateFirst.company, 'PwC USA', 'Company extracted from line2, not date line')

const fallbackNoCompany = ResumeNormalizer.parseExperienceHeader('Data Analyst Jul 2024 - May 2025')
assert.strictEqual(fallbackNoCompany.company, 'Enterprise Organization', 'Fallback used instead of date line')

console.log('  ✓ 2.1 Company name never defaults to date range or job title string')
console.log('  ✓ 2.2 Client/Employer line assigned cleanly to company')

// ── Test 3: Dangling Verb Elimination ──
console.log('\n[Test 3] Dangling Verb Elimination:')
const cleanedVerb1 = cleanPlaceholderGraceful('Engineered payment gateway integration, reducing approval latency by [ADD: 40%].')
assert.strictEqual(cleanedVerb1, 'Engineered payment gateway integration.', 'Trailing placeholder clause cleanly stripped')

const cleanedVerb2 = cleanPlaceholderGraceful('Scaled real-time chat infrastructure utilized by [ADD: 50k requests/sec].')
assert.strictEqual(cleanedVerb2, 'Scaled real-time chat infrastructure.', 'Dangling "utilized by [ADD: ...]" stripped')

const cleanedVerb3 = cleanPlaceholderGraceful('Architected event-driven microservices leveraged by [ADD: 30% speedup] and improved fault tolerance.')
assert(cleanedVerb3.includes('and improved fault tolerance.'), 'Subsequent clause preserved')
assert(!cleanedVerb3.includes('leveraged by [ADD:'), 'Placeholder stripped')

const cleanedVerb4 = cleanPlaceholderGraceful('Designed container orchestration framework utilizing.')
assert.strictEqual(cleanedVerb4, 'Designed container orchestration framework.', 'Dangling verb before period stripped')

console.log('  ✓ 3.1 Dangling verbs (utilized, leveraged, utilizing) cleanly stripped')
console.log('  ✓ 3.2 Trailing punctuation normalized to clean single period')

// ── Test 4: 1:1 DOCX Generation with Alekya Geometry & Tailored Experiences ──
console.log('\n[Test 4] DOCX Tailored Generation:')
const tailoredBullets = [
  {
    bulletId: 'exp_001_b01',
    originalText: exp1.bullets[0]?.text || 'Designed automated ETL pipelines in Python and SQL reducing manual processing time by 30%.',
    rewrittenText: 'Architected automated ETL pipelines in Python and SQL, cutting manual processing overhead by 45%.',
  },
]
const jdKeywords = [{ keyword: 'Kafka', count: 1 }, { keyword: 'PostgreSQL', count: 1 }]
const docxResult = await buildAtsTailoredDocx(canonical, tailoredBullets, jdKeywords)

assert(docxResult.buffer && Buffer.isBuffer(docxResult.buffer), 'DOCX buffer generated')
assert(docxResult.buffer.length > 8000, `DOCX buffer must be valid size, got ${docxResult.buffer.length}`)
assert.strictEqual(docxResult.pages, 1, 'Target 1-page fit')
console.log(`  ✓ 4.1 ATS DOCX tailored buffer built successfully (${docxResult.buffer.length} bytes, ${docxResult.pages} page)`)

// ── Test 5: Server-Side PDF Generation with Bullet Rewrites ──
console.log('\n[Test 5] Server-Side PDF Generation:')
const mockAiReport = {
  career_health_score: 88,
  score_label: 'Exceptional',
  primary_bottleneck: {
    title: 'High-Volume ATS Alignment',
    diagnosis: 'Resume requires verified outcome metrics and direct keyword density.',
    what_to_do: 'Deploy tailored ATS DOCX and align top 3 technical skills.',
  },
  critical_issues: [
    { title: 'Top-of-Page Metric Density', severity: 'HIGH', diagnosis: 'Unquantified achievement bullets', action_steps: ['Quantify top 5 bullets'] },
  ],
  roadmap: [
    { week: 'Week 1', theme: 'ATS Calibration', tasks: ['Tailor resume for 5 roles'] },
  ],
  resume_agent: {
    dashboard: {
      score: 92,
      bulletAudit: [
        {
          company: 'Shure Incorporated USA',
          originalText: 'Designed automated ETL pipelines in Python and SQL.',
          rewrittenText: 'Architected automated ETL pipelines in Python and SQL, reducing data latency by 45%.',
          needsRewrite: true,
        },
      ],
    },
    overallReview: { summary: 'Strong data analytics profile with clear technical execution.' },
  },
  linkedin_agent: {
    score: 82,
    optimizations: {
      headlines: [{ headline: 'Data Analyst | Python, SQL, Tableau | High-Throughput Analytics' }],
    },
  },
}

const pdfBuffer = await generateStandardReportPdf({
  user: { name: 'Haswanth Valluru', email: 'haswanth@example.com' },
  answers: { targetRole: 'Data Analyst', apps30d: 40 },
  aiReport: mockAiReport,
})

assert(pdfBuffer && Buffer.isBuffer(pdfBuffer), 'PDF buffer generated')
assert(pdfBuffer.length > 3000, `PDF buffer length must be > 3000 bytes, got ${pdfBuffer.length}`)
console.log(`  ✓ 5.1 Standardized Report PDF generated successfully (${pdfBuffer.length} bytes)`)

console.log('\n================================================================')
console.log('ALL INGESTION, DOCX & PDF TESTS PASSED WITH 100% SUCCESS!')
console.log('================================================================')
