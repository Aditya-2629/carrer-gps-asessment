/**
 * AI Resume Parser Agent Verification Suite
 * Tests AI Resume Parser Agent, ResumeNormalizer.normalizeAsync, and parseResumeToJSON.
 */

import assert from 'assert'
import { parseResumeWithAI } from '../agents/resume/parser/aiResumeParserAgent.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { parseResumeToJSON } from '../controllers/assessmentController.js'

const SAMPLE_RESUME_TEXT = `
HASWANTH VALLURU
haswanth.valluru@email.com | (312) 555-0199 | Chicago, IL | linkedin.com/in/haswanth-valluru | github.com/haswanthv

PROFESSIONAL SUMMARY
Senior Data Analyst with 4+ years of experience leading analytics engineering, building scalable data pipelines, and implementing real-time BI dashboards.

WORK EXPERIENCE
PwC USA / Shure Incorporated USA | Chicago, IL
Data Analyst | July 2024 – May 2025
- Architected automated ETL pipelines processing 10M+ daily telemetry records using Python and PostgreSQL, reducing latency by 42%.
- Developed executive Power BI dashboards tracking product usage metrics, driving a 15% increase in cross-functional feature adoption.

Recibo Technologies | Bengaluru, India
Data Engineer | June 2021 – July 2023
- Built automated data ingestion framework using Apache Spark, AWS S3, and Snowflake, decreasing pipeline maintenance overhead by 30%.
- Designed relational schemas and optimized complex SQL queries across 50+ enterprise tables, accelerating reporting queries by 3x.

EDUCATION
University of Illinois Chicago (UIC) | Chicago, IL
M.S. in Business Analytics | August 2023 – May 2025

KIT College of Engineering | Kolhapur, India
B.Tech in Computer Science and Engineering | August 2017 – June 2021

PROJECTS
Enterprise Telemetry Streaming Platform | Python, Kafka, PostgreSQL, Docker
- Engineered real-time event streaming platform handling 50k events/sec with fault-tolerant dead-letter queues.

SKILLS
Programming Languages: Python, SQL, R, JavaScript
Databases & Cloud: PostgreSQL, Snowflake, AWS (S3, EC2), Docker
BI & Analytics: Power BI, Tableau, Advanced Excel, Looker

CERTIFICATIONS
- Google Data Analytics Professional Certificate
- AWS Certified Cloud Practitioner
`

async function runTests() {
  console.log('================================================================')
  console.log('RUNNING AI RESUME PARSER AGENT & ASYNC NORMALIZER TEST SUITE')
  console.log('================================================================\n')

  // ── TEST 1: AI Parser Unit Structure ──────────────────────────
  console.log('[Test 1] AI Resume Parser Agent Extraction:')
  
  // Test fallback / short text validation
  let caughtShort = false
  try {
    await parseResumeWithAI('Too short text')
  } catch (e) {
    caughtShort = true
  }
  assert.strictEqual(caughtShort, true, 'parseResumeWithAI must throw on rawText < 40 chars')
  console.log('  ✓ 1.1 Throws properly on empty or too-short resume text')

  // Test structured normalization with AI parsed output
  const mockAiOutput = {
    candidate: {
      name: 'Haswanth Valluru',
      targetRole: 'Data Analyst',
      contact: {
        email: 'haswanth.valluru@email.com',
        phone: '(312) 555-0199',
        location: 'Chicago, IL',
        linkedin: 'https://linkedin.com/in/haswanth-valluru',
        github: 'https://github.com/haswanthv',
      },
    },
    summary: 'Senior Data Analyst with 4+ years of experience leading analytics engineering.',
    experiences: [
      {
        company: 'Shure Incorporated USA',
        role: 'Data Analyst',
        location: 'Chicago, IL',
        startDate: 'July 2024',
        endDate: 'May 2025',
        isCurrent: false,
        bullets: [
          'Architected automated ETL pipelines processing 10M+ daily telemetry records using Python and PostgreSQL, reducing latency by 42%.',
          'Developed executive Power BI dashboards tracking product usage metrics, driving a 15% increase in cross-functional feature adoption.',
        ],
      },
      {
        company: 'Recibo Technologies',
        role: 'Data Engineer',
        location: 'Bengaluru, India',
        startDate: 'June 2021',
        endDate: 'July 2023',
        isCurrent: false,
        bullets: [
          'Built automated data ingestion framework using Apache Spark, AWS S3, and Snowflake.',
        ],
      },
    ],
    projects: [
      {
        title: 'Enterprise Telemetry Streaming Platform',
        techStack: 'Python, Kafka, PostgreSQL, Docker',
        bullets: [
          'Engineered real-time event streaming platform handling 50k events/sec.',
        ],
      },
    ],
    education: [
      {
        school: 'University of Illinois Chicago (UIC)',
        degree: 'M.S. in Business Analytics',
        location: 'Chicago, IL',
        dates: 'August 2023 – May 2025',
      },
      {
        school: 'KIT College of Engineering',
        degree: 'B.Tech in Computer Science and Engineering',
        location: 'Kolhapur, India',
        dates: 'August 2017 – June 2021',
      },
    ],
    skills: [
      { category: 'Programming Languages', skills: ['Python', 'SQL', 'R'] },
      { category: 'Databases & Cloud', skills: ['PostgreSQL', 'Snowflake', 'AWS'] },
    ],
    certifications: [
      'Google Data Analytics Professional Certificate',
      'AWS Certified Cloud Practitioner',
    ],
  }

  // ── TEST 2: ResumeNormalizer.normalize with AI output ───────────
  console.log('\n[Test 2] ResumeNormalizer with Structured AI Data:')
  const canonical = ResumeNormalizer.normalize({
    rawText: SAMPLE_RESUME_TEXT,
    ...mockAiOutput,
  }, 'Senior Data Analyst')

  assert.strictEqual(canonical.candidate.name, 'Haswanth Valluru')
  assert.strictEqual(canonical.candidate.targetRole, 'Senior Data Analyst')
  assert.strictEqual(canonical.candidate.contact.location, 'Chicago, IL')
  console.log('  ✓ 2.1 Candidate contact & target role verified')

  // Verify Experience
  assert.strictEqual(canonical.experience.length, 2, 'Must have 2 experiences')
  assert.strictEqual(canonical.experience[0].company, 'Shure Incorporated USA')
  assert.strictEqual(canonical.experience[0].role, 'Data Analyst')
  assert.strictEqual(canonical.experience[0].bullets.length, 2)
  assert.strictEqual(canonical.experience[0].bullets[0].id, 'exp_001_b01')
  console.log('  ✓ 2.2 Experience entries and stable bullet IDs verified')

  // Verify 4-Field Education
  assert.strictEqual(canonical.education.length, 2, 'Must have 2 education items')
  assert.strictEqual(canonical.education[0].school, 'University of Illinois Chicago (UIC)')
  assert.strictEqual(canonical.education[0].degree, 'M.S. in Business Analytics')
  assert.strictEqual(canonical.education[0].location, 'Chicago, IL')
  assert.strictEqual(canonical.education[0].dates, 'August 2023 – May 2025')
  assert.strictEqual(canonical.education[0].institution, 'University of Illinois Chicago (UIC)', 'Backward compatible institution alias')
  assert.strictEqual(canonical.education[0].year, 'August 2023 – May 2025', 'Backward compatible year alias')
  assert.strictEqual(canonical.education[0].id, 'edu_001')
  console.log('  ✓ 2.3 Strict 4-field Education verified (school, degree, location, dates + aliases)')

  // Verify Categorized Skills Flattening
  assert(canonical.skills.length >= 5, 'Skills must be flattened into atomic items')
  assert(canonical.skills.some((s) => s.name === 'Python' && s.category === 'Programming Languages'))
  assert(canonical.skills.some((s) => s.name === 'PostgreSQL' && s.category === 'Databases & Cloud'))
  console.log('  ✓ 2.4 Categorized skills flattened with correct bucket categories')

  // Verify Certifications
  assert.strictEqual(canonical.certifications.length, 2)
  assert(canonical.certifications.some((c) => c.name.includes('Google Data Analytics')))
  console.log('  ✓ 2.5 Certifications isolated with stable IDs')

  // ── TEST 3: parseResumeToJSON Controller Pipeline ──────────────
  console.log('\n[Test 3] parseResumeToJSON Controller Pipeline:')
  const mockBuffer = Buffer.from(SAMPLE_RESUME_TEXT, 'utf8')
  const jsonResult = await parseResumeToJSON(mockBuffer, 'text/plain', 'sample_resume.txt')

  assert.strictEqual(jsonResult.candidate_name, 'Haswanth Valluru')
  assert.strictEqual(jsonResult.contact.email, 'haswanth.valluru@email.com')
  assert(Array.isArray(jsonResult.experiences) && jsonResult.experiences.length >= 2)
  assert(Array.isArray(jsonResult.education) && jsonResult.education.length >= 2)
  assert(Array.isArray(jsonResult.skills) && jsonResult.skills.length >= 3)
  assert(Array.isArray(jsonResult.top_skills) && jsonResult.top_skills.length <= 8)
  assert(Array.isArray(jsonResult.certifications) && jsonResult.certifications.length >= 1)

  // Verify education format in parseResumeToJSON
  const firstEdu = jsonResult.education[0]
  assert(firstEdu.school, 'firstEdu must have school')
  assert(firstEdu.degree, 'firstEdu must have degree')
  assert(firstEdu.dates || firstEdu.year, 'firstEdu must have dates/year')
  console.log('  ✓ 3.1 parseResumeToJSON returned canonical JSON with 4-field education and clean skills')

  // ── TEST 4: ResumeNormalizer.normalizeAsync ────────────────────
  console.log('\n[Test 4] ResumeNormalizer.normalizeAsync:')
  const asyncCanonical = await ResumeNormalizer.normalizeAsync({
    rawText: SAMPLE_RESUME_TEXT,
    ...mockAiOutput,
  }, 'Data Analyst')

  assert.strictEqual(asyncCanonical.candidate.name, 'Haswanth Valluru')
  assert.strictEqual(asyncCanonical.experience.length, 2)
  assert.strictEqual(asyncCanonical.education.length, 2)
  console.log('  ✓ 4.1 normalizeAsync successfully returns canonical resume')

  console.log('\n================================================================')
  console.log('ALL AI RESUME PARSER AGENT & ASYNC NORMALIZER TESTS PASSED!')
  console.log('================================================================')
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
