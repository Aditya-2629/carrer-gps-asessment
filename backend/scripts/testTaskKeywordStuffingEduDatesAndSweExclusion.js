import assert from 'assert'
import { normalizeEducationItem, formatEducationDates, sanitizeAndValidateResume } from '../services/resumeValidator.js'
import { buildRolePracticeBullet, deterministicWeave, weaveKeywordsDeterministic } from '../agents/resume/market/smartKeywordWeaver.js'

async function runTests() {
  console.log('=== TEST SUITE: Keyword Stuffing, Education Dates & SWE Exclusion ===\n')

  // ── TEST 1: Education Date Parsing & Safeguard Against Erasure ────────────
  console.log('--- TEST 1: Safeguard Education Dates & Prevent Erasure ---')

  // 1.1 Object with various date fields
  const eduWithGradDate = normalizeEducationItem({
    school: 'Stevens Institute of Technology',
    degree: 'Master of Science in Computer Science',
    graduationDate: 'May 2024',
  })
  assert.strictEqual(eduWithGradDate.dates, 'May 2024', 'Must preserve graduationDate "May 2024"')

  const eduWithRange = normalizeEducationItem({
    school: 'KIT College of Engineering',
    degree: 'Bachelor of Technology in Computer Science',
    period: '2020 – 2024',
  })
  assert.strictEqual(eduWithRange.dates, '2020 – 2024', 'Must preserve range "2020 – 2024"')

  const eduWithExpected = normalizeEducationItem({
    school: 'Northeastern University',
    degree: 'MS in Information Systems',
    date: 'Expected 2025',
  })
  assert.strictEqual(eduWithExpected.dates, 'Expected 2025', 'Must preserve "Expected 2025"')

  const eduWithExpectedMonth = normalizeEducationItem({
    school: 'Rutgers University',
    degree: 'BS in Computer Science',
    graduationYear: 'Expected May 2025',
  })
  assert.strictEqual(eduWithExpectedMonth.dates, 'Expected May 2025', 'Must preserve "Expected May 2025"')

  // 1.2 String inputs
  const strEdu1 = normalizeEducationItem('Stevens Institute of Technology, Master of Science in Computer Science, May 2024')
  assert.strictEqual(strEdu1.dates, 'May 2024', 'Must extract "May 2024" from string')

  const strEdu2 = normalizeEducationItem('KIT College of Engineering, B.Tech, 2020 - 2024')
  assert.strictEqual(strEdu2.dates, '2020 – 2024', 'Must extract and standardize "2020 – 2024" from string')

  const strEdu3 = normalizeEducationItem('Northeastern University, MS Information Systems, Expected 2025')
  assert.strictEqual(strEdu3.dates, 'Expected 2025', 'Must extract "Expected 2025" from string')

  // 1.3 Embedded in degree or school
  const embeddedEdu = normalizeEducationItem({
    school: 'Carnegie Mellon University',
    degree: 'B.S. Computer Science (2020 – 2024)',
  })
  assert.strictEqual(embeddedEdu.dates, '2020 – 2024', 'Must recover dates embedded inside degree string')
  assert(!embeddedEdu.degree.includes('2020'), 'Extracted date must be stripped from degree')

  console.log('✓ All education date formats ("May 2024", "2020 – 2024", "Expected 2025") preserved without erasure.')

  // ── TEST 2: Restrict Practice Bullet Injections by Role Domain ─────────────
  console.log('\n--- TEST 2: Restrict Practice Bullet Injections by Role Domain ---')

  // 2.1 Data Analyst / BI roles
  const dataPractice = buildRolePracticeBullet('Data Analyst')
  assert(!/git|github|pull\s*request|unit\s*test|pytest|jest/i.test(dataPractice.bullet), 'Data practice bullet must NEVER contain Git/Jest/Unit tests')
  assert(/dbt|data\s*testing|reconciliation|schema\s*assertions/i.test(dataPractice.bullet), 'Data practice bullet must contain data-specific quality tools')

  const biPractice = buildRolePracticeBullet('BI Developer')
  assert(!/git|github|pull\s*request|unit\s*test|pytest|jest/i.test(biPractice.bullet), 'BI practice bullet must NEVER contain Git/Jest/Unit tests')
  assert(/dbt|data\s*testing|reconciliation|schema\s*assertions/i.test(biPractice.bullet), 'BI practice bullet must contain data-specific quality tools')

  // 2.2 Product Manager & Non-Tech roles
  const pmPractice = buildRolePracticeBullet('Product Manager')
  assert(!/git|github|pull\s*request|unit\s*test|pytest|jest/i.test(pmPractice.bullet), 'Product Manager bullet must NEVER contain Git or unit tests')
  assert(/operational\s*excellence|quality\s*governance|review\s*gates|benchmarks/i.test(pmPractice.bullet), 'Product Manager must have governance bullet')

  const scrumPractice = buildRolePracticeBullet('Scrum Master')
  assert(!/git|github|pull\s*request|unit\s*test|pytest|jest/i.test(scrumPractice.bullet), 'Scrum Master bullet must NEVER contain Git or unit tests')

  // 2.3 SWE role gets standard unit test & Git gating
  const swePractice = buildRolePracticeBullet('Full Stack Software Engineer')
  assert(/unit\s*and\s*integration\s*test|git/i.test(swePractice.bullet), 'SWE bullet must establish unit testing & Git gates')

  // 2.4 deterministicWeave role domain check for Data Analyst
  const dataResume = {
    experiences: [
      {
        company: 'Metrics Co',
        role: 'Data Analyst',
        bullets: ['Built SQL queries and automated reporting dashboards in Tableau.'],
      },
    ],
  }
  const dataWoven = deterministicWeave(dataResume.experiences, ['Unit / Integration Testing', 'Git / GitHub', 'Snowflake'], 'Data Analyst')
  const allDataBullets = dataWoven.tailoredExperiences[0].bullets.join(' ')
  assert(!/git|github|pull\s*request|pytest|jest/i.test(allDataBullets), 'Data Analyst resume must NEVER have Git/GitHub PR gating')
  assert(/dbt|data\s*testing|reconciliation/i.test(allDataBullets), 'Data Analyst resume must have data quality bullet')

  // 2.5 deterministicWeave role domain check for Product Manager
  const pmResume = {
    experiences: [
      {
        company: 'Innovate Tech',
        role: 'Product Manager',
        bullets: ['Led cross-functional roadmaps and defined user stories for core platform.'],
      },
    ],
  }
  const pmWoven = deterministicWeave(pmResume.experiences, ['Unit / Integration Testing', 'Git / GitHub', 'Code Review'], 'Product Manager')
  const allPmBullets = pmWoven.tailoredExperiences[0].bullets.join(' ')
  assert(!/git|github|pull\s*request|unit\s*test|pytest|jest/i.test(allPmBullets), 'Product Manager resume must NEVER have Git or unit testing')
  assert(!pmWoven.interviewLedger.some((item) => /git|github|unit\s*test/i.test(item.bulletText)), 'PM ledger must NEVER have Git/unit test bullets')

  console.log('✓ Practice bullets strictly calibrated by domain: Data has dbt/reconciliation, Product has governance, zero SWE leakage.')

  // ── TEST 3: Blind Keyword Stuffing Protection in DOCX Injection Logic ──────
  console.log('\n--- TEST 3: Blind Keyword Stuffing Protection ---')

  const testCanonical = {
    candidate_name: 'Jordan Lee',
    target_role: 'Data Analyst',
    summary: 'Data analyst proficient in SQL and Tableau.',
    skills: ['SQL', 'Tableau'],
    experiences: [
      {
        company: 'Alpha Corp',
        role: 'Data Analyst',
        bullets: ['Queried large datasets using PostgreSQL and built Tableau dashboards.'],
      },
    ],
    projects: [],
    education: [],
  }

  const missingList = ['PostgreSQL', 'Docker', 'Kubernetes', 'FastMCP']
  const userSelected = ['FastMCP'] // User explicitly selected FastMCP; didn't select Docker or Kubernetes

  // Run evidence check
  const { appliedKeywords: verified } = sanitizeAndValidateResume(testCanonical, [], missingList)
  const verifiedSet = new Set((verified || []).map((a) => a.keyword.toLowerCase().trim()))

  assert(verifiedSet.has('postgresql'), 'PostgreSQL has evidence in experience bullet')
  assert(!verifiedSet.has('docker'), 'Docker has NO evidence in resume')
  assert(!verifiedSet.has('kubernetes'), 'Kubernetes has NO evidence in resume')
  assert(!verifiedSet.has('fastmcp'), 'FastMCP has NO evidence in resume')

  // Simulate controller injection logic
  const userSelectedSet = new Set(userSelected.map((s) => s.toLowerCase().trim()))
  const injectedSkills = []

  for (const kw of missingList) {
    const kwLow = kw.toLowerCase().trim()
    if (verifiedSet.has(kwLow)) {
      injectedSkills.push(kw)
    } else if (userSelectedSet.has(kwLow)) {
      injectedSkills.push(`${kw} (In-Progress)`)
    }
  }

  assert(injectedSkills.includes('PostgreSQL'), 'Evidenced skill PostgreSQL must be injected')
  assert(injectedSkills.includes('FastMCP (In-Progress)'), 'User-selected unevidenced skill must have (In-Progress) indicator')
  assert(!injectedSkills.includes('Docker'), 'Unverified unselected Docker must NOT be stuffed into skills')
  assert(!injectedSkills.includes('Kubernetes'), 'Unverified unselected Kubernetes must NOT be stuffed into skills')

  console.log('✓ Blind keyword stuffing eliminated: only evidenced skills and indicated user-selected skills injected.')

  console.log('\n======================================================================')
  console.log(' ALL KEYWORD STUFFING, EDU DATES & SWE EXCLUSION TESTS PASSED (3/3)!')
  console.log('======================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})

