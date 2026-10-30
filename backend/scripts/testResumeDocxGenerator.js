import assert from 'assert'
import { generateAtsResumeDocx } from '../utils/resumeDocxGenerator.js'

async function runDocxTests() {
  console.log('================================================================')
  console.log('TESTING ATS RESUME (.DOCX) GENERATOR')
  console.log('================================================================')

  const sampleCandidate = {
    candidateName: 'Aditya &amp; Sharma',
    targetRole: 'Data &amp; Business Analyst',
    contact: {
      phone: '+1 (555) 123-4567',
      email: 'aditya.sharma@example.com',
      location: 'Chicago, IL',
      linkedin: 'https://linkedin.com/in/aditya-sharma',
      github: 'https://github.com/aditya-sharma',
    },
    summaryText: 'Results-driven Data &amp; Business Analyst with 3+ years of experience transforming enterprise datasets into automated reporting pipelines [ADD: measurable metric].',
    skills: ['SQL &amp; Query Optimization', 'Python', 'Power BI &amp; DAX', 'Snowflake', 'dbt Core'],
    experiences: [
      {
        role: 'Senior Data Analyst',
        company: 'PwC &amp; Associates',
        dates: '2022 – Present',
        location: 'Chicago, IL',
        bullets: [
          'Engineered executive KPI dashboards in Power BI and SQL, improving reporting velocity by 45% [ADD: cost saved].',
          'Automated weekly ETL workflows across 1.2M transactions using Python scripts and BigQuery views.',
        ],
      },
      {
        role: 'Data Analyst',
        company: 'Shure Incorporated',
        dates: '2020 – 2022',
        location: 'Niles, IL',
        bullets: [
          'Analyzed supply chain demand patterns with SQL and statistical models in close partnership with procurement.',
        ],
      },
    ],
    projects: [
      {
        title: 'Enterprise ELT Pipeline',
        technologies: ['Snowflake', 'dbt Core', 'Airflow'],
        bullets: [
          'Deployed scalable star-schema pipelines processing 500K+ daily events with automated schema testing.',
        ],
      },
    ],
    education: [
      {
        school: 'University of Illinois',
        degree: 'B.S. in Information Systems &amp; Analytics',
        dates: '2016 – 2020',
      },
    ],
    certifications: [
      {
        name: 'AWS Certified Cloud Practitioner',
        issuer: 'Amazon Web Services',
      },
    ],
  }

  const startTime = Date.now()
  const buffer = await generateAtsResumeDocx(sampleCandidate)
  const duration = Date.now() - startTime

  assert(Buffer.isBuffer(buffer), 'Result must be a Node.js Buffer')
  assert(buffer.length > 5000, `Buffer size (${buffer.length} bytes) must be substantial for a valid docx`)

  // Verify docx PK header (magic bytes: 50 4B 03 04)
  assert.strictEqual(buffer[0], 0x50, 'Byte 0 must be 0x50 (P)')
  assert.strictEqual(buffer[1], 0x4b, 'Byte 1 must be 0x4B (K)')
  assert.strictEqual(buffer[2], 0x03, 'Byte 2 must be 0x03')
  assert.strictEqual(buffer[3], 0x04, 'Byte 3 must be 0x04')

  console.log(`PASS: Generated valid .docx buffer of ${buffer.length} bytes in ${duration}ms (in-memory, 0 LLM calls).`)
  console.log('================================================================')
  console.log('ALL ATS RESUME DOCX GENERATOR TESTS PASSED!')
  console.log('================================================================')
}

runDocxTests().catch((err) => {
  console.error('FAIL: Test failed with error:', err)
  process.exit(1)
})
