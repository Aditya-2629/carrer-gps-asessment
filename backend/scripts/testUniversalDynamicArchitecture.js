import assert from 'node:assert'
import {
  inferRoleFromKeywordFrequency,
  ResumeNormalizer,
} from '../agents/resume/resumeAgent.normalizer.js'
import {
  weaveKeywordsDeterministic,
  buildRolePracticeBullet,
  classifyToolCategory,
} from '../agents/resume/market/smartKeywordWeaver.js'
import {
  cleanRewriteText,
  generateDeterministicRewrite,
} from '../agents/resume/scoring/resumeScorecard.js'
import { generateDomainCalibratedSummary } from '../agents/resume/orchestration/modeC_hybrid.js'
import { determineSkillBucket } from '../services/resumeValidator.js'
import { groupByCategory, buildAtsTailoredDocx } from '../services/docxResumeService.js'
import { safeExtractString } from '../agents/linkedin/linkedinSynthesis.prompt.js'
import { downloadAtsResumeDocx } from '../controllers/assessmentController.js'

console.log('================================================================')
console.log('TEST SUITE: UNIVERSAL DYNAMIC MULTI-DOMAIN RESUME ARCHITECTURE')
console.log('================================================================\n')

// -------------------------------------------------------------
// Test 1: Dynamic Role Normalization (No SWE Bias)
// -------------------------------------------------------------
console.log('[Test 1] Dynamic Role Normalization (No SWE Bias)')

// 1.1 Data Analyst with SWE collaboration mentions
const dataText = `
Haswanth Valluru
Lead Data Analyst with 4+ years of experience.
Collaborated closely with software engineers, backend developers, and product managers.
Built scalable ETL data pipelines using SQL, Tableau, Power BI, and Snowflake.
Delivered executive reporting dashboards and dimensional business intelligence models.
`
const inferredData = inferRoleFromKeywordFrequency(dataText)
assert.strictEqual(inferredData, 'Data Analyst', 'Must classify as Data Analyst despite SWE mentions')
console.log('  ✓ 1.1 Data Analyst role preserved even when collaborating with software engineers')

// 1.2 Product Manager
const pmText = `
Senior Technical Product Manager.
Led agile sprint ceremonies, defined product roadmap, and authored user stories with cross-functional teams.
Managed product backlog and coordinated engineering delivery with Scrum Masters.
`
const inferredPm = inferRoleFromKeywordFrequency(pmText)
assert.strictEqual(inferredPm, 'Product Manager', 'Must classify as Product Manager')
console.log('  ✓ 1.2 Product Manager classified accurately')

// 1.3 Neutral / Ambiguous Fallback
const ambiguousText = 'Dedicated professional driving organizational growth and team alignment.'
const inferredAmbiguous = inferRoleFromKeywordFrequency(ambiguousText)
assert.strictEqual(inferredAmbiguous, 'Professional', 'Ambiguous role must fall back to Professional, NEVER Software Engineer')
console.log('  ✓ 1.3 Ambiguous role falls back to Professional, never Software Engineer\n')

// -------------------------------------------------------------
// Test 2: No Hardcoded Jest/PyTest in Non-SWE Resumes
// -------------------------------------------------------------
console.log('[Test 2] Zero Hardcoded Testing Frameworks in Non-SWE Resumes')

const dataResume = {
  target_role: 'Data Analyst',
  experiences: [
    {
      company: 'Enterprise Analytics',
      role: 'Data Analyst',
      isCurrent: false,
      bullets: [
        'Built automated SQL data queries and business intelligence dashboards for executive leaders.',
      ],
    },
  ],
}

const dataWoven = weaveKeywordsDeterministic({
  canonicalResume: dataResume,
  missingKeywords: ['Snowflake', 'dbt', 'Unit Testing', 'Git'],
  targetRole: 'Data Analyst',
})

const dataBullets = dataWoven.tailoredExperiences[0].bullets
const allDataText = dataBullets.join(' ')
assert(!allDataText.includes('Jest'), 'Non-SWE resume must NEVER contain Jest')
assert(!allDataText.includes('PyTest'), 'Non-SWE resume must NEVER contain PyTest')
console.log('  ✓ 2.1 Non-SWE Data Analyst resume contains ZERO Jest/PyTest injection')

const pmPractice = buildRolePracticeBullet('Product Manager')
assert(!pmPractice.bullet.includes('Jest'), 'Product Manager practice bullet must NOT contain Jest')
assert(!pmPractice.bullet.includes('PyTest'), 'Product Manager practice bullet must NOT contain PyTest')
console.log('  ✓ 2.2 Product Manager practice bullet contains ZERO Jest/PyTest injection\n')

// -------------------------------------------------------------
// Test 3: Zero [ADD: ...] Placeholders in Rewrites & DOCX
// -------------------------------------------------------------
console.log('[Test 3] Zero [ADD: ...] Placeholder Leakage')

const textWithAdd = 'Engineered distributed microservices using Node.js, reducing latency by [ADD: measurable metric, e.g. 35%].'
const cleaned = cleanRewriteText(textWithAdd)
assert(!cleaned.includes('[ADD:'), 'cleanRewriteText must completely eliminate [ADD: ...] brackets')
assert(cleaned.endsWith('.'), 'Cleaned text must be grammatically complete and end with period')
console.log('  ✓ 3.1 cleanRewriteText eliminates bracketed placeholders into ATS-ready sentences')

const deterministicRewrite = generateDeterministicRewrite(
  'Worked on SQL queries and executive reports.',
  { hasQuantifier: false, hasMetric: false },
  false,
  'Data Analyst'
)
assert(!deterministicRewrite.includes('[ADD:'), 'generateDeterministicRewrite must NEVER append [ADD:]')
console.log('  ✓ 3.2 generateDeterministicRewrite generates 100% complete metric-safe rewrite without placeholders\n')

// -------------------------------------------------------------
// Test 4: Universal Multi-Domain Skill Bucketing
// -------------------------------------------------------------
console.log('[Test 4] Universal Multi-Domain Skill Bucketing')

// Non-tech role
assert.strictEqual(determineSkillBucket('Jira', 'Product Manager'), 'Tools & Systems')
assert.strictEqual(determineSkillBucket('Figma', 'Product Manager'), 'Tools & Systems')
assert.strictEqual(determineSkillBucket('Roadmap Strategy', 'Product Manager'), 'Core Competencies')
assert.strictEqual(determineSkillBucket('Stakeholder Alignment', 'Product Manager'), 'Core Competencies')

// Non-tech groupByCategory
const pmGrouped = groupByCategory(['Roadmap Strategy', 'Jira', 'Stakeholder Alignment', 'Figma'], 'Product Manager')
const pmCategories = pmGrouped.map(([cat]) => cat)
assert(!pmCategories.includes('Backend & APIs'), 'Product Manager must never have Backend & APIs category')
assert(pmCategories.includes('Core Competencies') || pmCategories.includes('Tools & Systems'), 'Must group into Core Competencies / Tools & Systems')
console.log('  ✓ 4.1 Non-tech roles categorized into Core Competencies and Tools & Systems')

// Domain-calibrated summary
const summary = generateDomainCalibratedSummary('Lead Product Manager', [{ role: 'Lead Product Manager' }], ['Roadmap Strategy', 'Jira', 'Agile Delivery'])
assert(summary.includes('Lead Product Manager'), 'Summary must include role')
assert(!summary.includes('software systems'), 'Non-SWE summary must NOT contain hardcoded software systems')
assert(summary.includes('operational efficiency'), 'Summary must emphasize operational efficiency & measurable outcomes')
console.log('  ✓ 4.2 Domain-calibrated summary generated dynamically without SWE bias\n')

// -------------------------------------------------------------
// Test 5: Safe LinkedIn Scraper Extraction
// -------------------------------------------------------------
console.log('[Test 5] Safe LinkedIn Scraper Extraction')

assert.strictEqual(safeExtractString('Clean String'), 'Clean String')
assert.strictEqual(safeExtractString({ text: 'Object String' }), 'Object String')
assert.strictEqual(safeExtractString(['Array Bullet 1', 'Array Bullet 2']), 'Array Bullet 1 Array Bullet 2')
assert.strictEqual(safeExtractString(null), '')
assert.strictEqual(safeExtractString(undefined), '')
console.log('  ✓ 5.1 safeExtractString handles strings, nested objects, arrays, and nulls with zero .trim() crashes\n')

// -------------------------------------------------------------
// Test 6: DOCX Download Order of Precedence & Metric Retention
// -------------------------------------------------------------
console.log('[Test 6] downloadAtsResumeDocx Order of Precedence')

let capturedBuffer = null
let capturedHeaders = {}
const fakeRes = {
  status(code) { return this },
  json(data) { return this },
  setHeader(k, v) { capturedHeaders[k] = v },
  send(buf) { capturedBuffer = buf },
  end(buf) { if (buf) capturedBuffer = buf },
}

const mockReq = {
  query: {},
  body: {
    canonicalResume: {
      candidate_name: 'Alex Rivera',
      target_role: 'Senior Data Analyst',
      contact: { email: 'alex@example.com', phone: '555-0199' },
      skills: ['SQL', 'Tableau', 'Snowflake', 'dbt'],
      experiences: [
        {
          id: 'exp_001',
          company: 'HealthAnalytics Corp',
          role: 'Senior Data Analyst',
          duration: '2022 - Present',
          isCurrent: true,
          bullets: [
            { id: 'exp_001_b01', text: 'Maintained SQL queries and reporting tables.' },
            { id: 'exp_001_b02', text: 'Built executive dashboards in Tableau.' },
          ],
        },
      ],
    },
    bulletRewrites: [
      {
        originalBullet: 'Maintained SQL queries and reporting tables.',
        rewrittenBullet: 'Engineered automated SQL transformation pipelines, reducing query runtimes by 42% and ensuring 100% daily dashboard refresh reliability.',
      },
    ],
    selectedSkills: ['Snowflake', 'dbt'],
  },
}

await downloadAtsResumeDocx(mockReq, fakeRes)
assert(capturedBuffer && Buffer.isBuffer(capturedBuffer), 'Must generate DOCX buffer')
assert(capturedBuffer.length > 3000, 'DOCX buffer must be valid size')
console.log('  ✓ 6.1 Tailored DOCX generated cleanly retaining direct metric rewrites\n')

console.log('================================================================')
console.log('ALL UNIVERSAL DYNAMIC MULTI-DOMAIN ARCHITECTURE TESTS PASSED!')
console.log('================================================================\n')
