import assert from 'assert'
import {
  ResumeNormalizer,
  isValidRoleTitle,
  isValidCompanyName,
  cleanRoleTitle,
} from '../agents/resume/resumeAgent.normalizer.js'
import {
  computeKeywordAlignment,
  KEYWORD_SYNONYMS,
  keywordMatchesText,
} from '../agents/resume/market/keywordAlignment.js'
import { computeScorecard } from '../agents/resume/scoring/resumeScorecard.js'
import { generateDeterministicRewrite } from '../agents/resume/scoring/resumeScorecard.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'

console.log('================================================================')
console.log('MASTER PROMPT 3 VERIFICATION TEST SUITE')
console.log('================================================================\n')

// ── TEST 1: Role Title & Company Name Guards ─────────────────────────────
console.log('--- TEST 1: Role Title & Company Name Guards ---')

// 1.1 Reject lowercase prepositions and sentence fragments
assert.strictEqual(
  isValidRoleTitle('across lower environments'),
  false,
  'Must reject "across lower environments"'
)
assert.strictEqual(
  isValidRoleTitle('healthcare business objectives throughout the SDLC.'),
  false,
  'Must reject strings ending with period and containing narrative clauses'
)
assert.strictEqual(
  isValidRoleTitle('responsible for developing backend services'),
  false,
  'Must reject strings with duty phrases'
)
assert.strictEqual(
  isValidRoleTitle('throughout the release cycle'),
  false,
  'Must reject starting with throughout'
)
assert.strictEqual(
  isValidRoleTitle(''),
  false,
  'Must reject empty strings'
)
assert.strictEqual(
  isValidRoleTitle('A'.repeat(70)),
  false,
  'Must reject titles longer than 65 chars'
)

// 1.2 Accept valid role titles
assert.strictEqual(
  isValidRoleTitle('Senior Full Stack Software Developer'),
  true,
  'Must accept valid Senior role'
)
assert.strictEqual(
  isValidRoleTitle('Data Analyst'),
  true,
  'Must accept valid Data Analyst'
)
assert.strictEqual(
  isValidRoleTitle('Cloud Solutions Architect'),
  true,
  'Must accept valid Architect'
)

console.log('PASS: Role title guards verified.\n')

// ── TEST 2: Single Source of Truth: Structured AI Chunker Input ──────────
console.log('--- TEST 2: Structured AI Chunker Input Direct Mapping ---')

const structuredDoc = {
  rawText: 'Candidate full resume text...',
  experiences: [
    {
      role: 'Senior Full Stack Software Developer',
      company: 'Bank of America',
      location: 'Chicago, IL',
      startDate: 'April 2024',
      endDate: 'Present',
      isCurrent: true,
      bullets: [
        'Architected high-throughput financial transaction processing engine.',
        'Optimized PostgreSQL query execution plans reducing latency by 45%.',
      ],
    },
    {
      role: 'Software Developer',
      company: 'Abbott Laboratories',
      location: 'Abbott Park, IL',
      startDate: 'January 2022',
      endDate: 'March 2024',
      isCurrent: false,
      bullets: [
        'Engineered microservices using Spring Boot and Java 17.',
      ],
    },
  ],
  projects: [
    {
      title: 'Healthcare Analytics Dashboard',
      techStack: 'React, Node.js, AWS',
      bullets: [
        'Built real-time visualization portal for patient monitoring metrics.',
      ],
    },
  ],
  skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
  certifications: ['AWS Certified Solutions Architect - Associate'],
}

const canonicalStructured = ResumeNormalizer.normalize(structuredDoc)

assert.strictEqual(canonicalStructured.experience.length, 2, 'Must map both experiences directly')
assert.strictEqual(canonicalStructured.experience[0].role, 'Senior Full Stack Software Developer')
assert.strictEqual(canonicalStructured.experience[0].company, 'Bank of America')
assert.strictEqual(canonicalStructured.experience[0].bullets.length, 2)
assert.strictEqual(canonicalStructured.experience[0].bullets[0].id, 'exp_001_b01')
assert.strictEqual(canonicalStructured.projects.length, 1)
assert.strictEqual(canonicalStructured.projects[0].techStack, 'React, Node.js, AWS')
assert.strictEqual(canonicalStructured.skills.length, 6)
assert.strictEqual(canonicalStructured.certifications.length, 1)
assert.strictEqual(canonicalStructured.candidate.presentRole, 'Senior Full Stack Software Developer')
assert.strictEqual(canonicalStructured.candidate.presentCompany, 'Bank of America')

console.log('PASS: Structured data maps directly without regex distortion.\n')

// ── TEST 3: Certification Broad Section & Inline Detection ──────────────
console.log('--- TEST 3: Certification Section & Inline Detection ---')

// 3.1 Broad section headers
const sectionsWithLicensesAndCerts = ResumeNormalizer.segmentSections([
  'PROFESSIONAL CERTIFICATIONS',
  'AWS Certified Solutions Architect',
  'Google Cloud Professional Data Engineer',
])
assert.strictEqual(
  sectionsWithLicensesAndCerts.certifications.length,
  2,
  'Must match PROFESSIONAL CERTIFICATIONS header'
)

// 3.2 Single-line bulleted certification list splitting
const parsedCerts = ResumeNormalizer.parseCertifications([
  'Google Data Analytics Professional Certificate • Meta Introduction to Data Analytics • IBM Python for Data Science',
])
assert.strictEqual(
  parsedCerts.length,
  3,
  'Must split single-line bulleted certification list into 3 distinct items'
)
assert.strictEqual(parsedCerts[0].name, 'Google Data Analytics Professional Certificate')
assert.strictEqual(parsedCerts[1].name, 'Meta Introduction to Data Analytics')
assert.strictEqual(parsedCerts[2].name, 'IBM Python for Data Science')

// 3.3 Inline fallback scan when dedicated section is absent
const resumeWithInlineCert = {
  rawText: `
Deepanjan Rane
deepanjan.rane@example.com | (555) 019-2834 | Chicago, IL

SUMMARY
Data Analyst with 4 years of experience. Holds AWS Certified Cloud Practitioner.

EXPERIENCE
Data Analyst | Enterprise Inc
- Built automated reporting pipelines using Python and SQL.

EDUCATION
B.S. in Computer Science | University of Illinois
Google Data Analytics Professional Certificate
  `,
}
const canonicalInline = ResumeNormalizer.normalize(resumeWithInlineCert)
assert.strictEqual(
  canonicalInline.certifications.length >= 1,
  true,
  'Inline certifications must be detected when section is absent'
)

// Scorecard checklist check must pass
const scorecard = computeScorecard({
  analysis: { issues: [], strengths: [] },
  canonicalResume: canonicalInline,
  precomputedSignals: { bulletSignals: [], quantification: {}, contactMerge: {} },
  targetRole: 'Data Analyst',
})
const certCheck = scorecard.checks.find((c) => c.id === 'certifications')
assert.strictEqual(certCheck.status, 'pass', 'Certifications checklist must pass when inline certs exist')

console.log('PASS: Certification broad matching & inline fallback passed.\n')

// ── TEST 4: Keyword Synonym Engine & Skills Capping ──────────────────────
console.log('--- TEST 4: Keyword Synonym Engine & Skills Capping ---')

const deepanjanResume = {
  candidate: {
    targetRole: 'Data Analyst',
  },
  summary: {
    text: 'Experienced Data Analyst specializing in high-performance cloud data warehouses and analytical systems.',
  },
  skills: [
    { name: 'Google Cloud' },
    { name: 'cloud data pipelines' },
    { name: 'MS SQL Server' },
    { name: 'Postgres' },
    { name: 'MS Excel' },
    { name: 'Tableau' },
    { name: 'Power BI' },
    { name: 'Snowflake' },
    { name: 'BigQuery' },
    { name: 'Python' },
    { name: 'SQL' },
    { name: 'Airflow' },
    { name: 'dbt' },
    { name: 'Kafka' },
    { name: 'Spark' },
    { name: 'PySpark' },
    { name: 'Looker' },
    { name: 'Git' },
    { name: 'Reporting' },
    { name: 'Docker' },
    { name: 'Kubernetes' },
    { name: 'Linux' },
    { name: 'Bash' },
    { name: 'CI/CD' },
    { name: 'Jenkins' },
    { name: 'Jira' },
    { name: 'Confluence' },
    { name: 'Figma' },
    { name: 'Agile' },
    { name: 'Scrum' },
  ],
  experience: [
    {
      id: 'exp_001',
      role: 'Data Analyst',
      company: 'Enterprise Analytics Corp',
      bullets: [
        {
          id: 'exp_001_b01',
          text: 'Data modeling and pipeline optimization: Designs star schemas and optimizes BigQuery/Cloud SQL pipelines.',
        },
        {
          id: 'exp_001_b02',
          text: 'Created advanced financial reconciliation sheets in MS Excel using complex lookups and pivot tables.',
        },
        {
          id: 'exp_001_b03',
          text: 'Optimized reporting queries on Postgres warehouse cutting query execution time by 40%.',
        },
        {
          id: 'exp_001_b04',
          text: 'Maintained analytical codebases and automated test workflows using GitHub pull requests.',
        },
      ],
    },
  ],
  projects: [],
}

const kwResult = computeKeywordAlignment({
  canonicalResume: deepanjanResume,
  targetRole: 'Data Analyst',
})

console.log('Target Role Evaluated:', kwResult.targetRole)
console.log('Matched in Experience:', kwResult.matchedInExperience)
console.log('Skills Only (Unverified):', kwResult.skillsOnlyUnverified)
console.log('Missing From Resume:', kwResult.missingFromResume)

// Verify Synonym Matching:
// 1. "Data Modeling" should be in matchedInExperience (because of "Designs star schemas")
assert.ok(
  kwResult.matchedInExperience.includes('Data Modeling'),
  'Data Modeling must match via synonym "star schemas"'
)

// 2. "Excel" should be in matchedInExperience (because of "MS Excel")
assert.ok(
  kwResult.matchedInExperience.includes('Excel'),
  'Excel must match via synonym "MS Excel"'
)

// 3. "PostgreSQL" should be in matchedInExperience (because of "Postgres")
assert.ok(
  kwResult.matchedInExperience.includes('PostgreSQL'),
  'PostgreSQL must match via synonym "Postgres"'
)

// 4. "Git" should be in matchedInExperience (because of "GitHub")
assert.ok(
  kwResult.matchedInExperience.includes('Git'),
  'Git must match via synonym "GitHub"'
)

// 5. "BigQuery" / "Google Cloud" is verified in experience
assert.ok(
  kwResult.matchedInExperience.includes('BigQuery'),
  'BigQuery must be verified in experience'
)

// 6. "Data Modeling", "Excel", "PostgreSQL", "Git" must NEVER be in missingFromResume
assert.strictEqual(
  kwResult.missingFromResume.includes('Data Modeling'),
  false,
  'Data Modeling must NOT be in missingFromResume'
)
assert.strictEqual(
  kwResult.missingFromResume.includes('Excel'),
  false,
  'Excel must NOT be in missingFromResume'
)
assert.strictEqual(
  kwResult.missingFromResume.includes('PostgreSQL'),
  false,
  'PostgreSQL must NOT be in missingFromResume'
)
assert.strictEqual(
  kwResult.missingFromResume.includes('Git'),
  false,
  'Git must NOT be in missingFromResume'
)

// 7. Verify Capping: skillsOnlyUnverified must NOT dump all 30 skills; must be capped at <= 8
assert.ok(
  kwResult.skillsOnlyUnverified.length <= 8,
  `skillsOnlyUnverified must be capped at <= 8 (got ${kwResult.skillsOnlyUnverified.length})`
)

console.log('PASS: Keyword synonym matching and skills capping verified.\n')

// ── TEST 5: Elimination of [ADD: ...] Brackets from Rewrites ─────────────
console.log('--- TEST 5: Elimination of [ADD: ...] Brackets from Rewrites ---')

const sampleSig = {
  hasQuantifier: false,
  hasQualitativeOutcome: false,
  openingWord: 'Developing',
}
const rewrite = generateDeterministicRewrite(
  'Developing REST APIs in Node.js and Express.',
  sampleSig,
  true
)
console.log('Generated Rewrite:', rewrite)

assert.strictEqual(
  rewrite.includes('[ADD:'),
  false,
  'Deterministic rewrite must NEVER contain [ADD: ...] brackets'
)
assert.ok(
  rewrite.endsWith('.'),
  'Deterministic rewrite must be a complete, punctuated sentence'
)

const googleRewrite = ResumeAgentValidator.buildGoogleXYZRewrite(
  'Assisted with database query optimization across postgres clusters.'
)
console.log('Google XYZ Fallback Rewrite:', googleRewrite)
assert.strictEqual(
  googleRewrite.includes('[ADD:'),
  false,
  'Validator Google XYZ rewrite must NEVER contain [ADD: ...] brackets'
)

console.log('PASS: [ADD: ...] brackets eliminated from rewrites.\n')

console.log('================================================================')
console.log('ALL MASTER PROMPT 3 VERIFICATION TESTS PASSED PERFECTLY!')
console.log('================================================================')
