import assert from 'assert'
import {
  groupByCategory,
  buildAtsTailoredDocx,
} from '../services/docxResumeService.js'
import {
  normalizeEducationItem,
  formatEducationDates,
  cleanPlaceholderClause,
  buildRewriteLookup,
  determineSkillBucket,
  sanitizeAndValidateResume,
} from '../services/resumeValidator.js'

console.log('================================================================')
console.log('RUNNING ATS DOCX GENERATOR COMPREHENSIVE VERIFICATION SUITE')
console.log('================================================================\n')

// -----------------------------------------------------------------------------
// TEST 1: Education 2-Line Format & Date Normalization
// -----------------------------------------------------------------------------
console.log('[Test 1] Education 2-Line Format & Month Normalization:')

// 1.1 Full month expansion
assert.strictEqual(
  formatEducationDates('Sep 2024 - May 2026'),
  'September 2024 – May 2026',
  'Must expand abbreviated months to full month names with en-dash'
)
assert.strictEqual(
  formatEducationDates('Jan 2022 - May 2023'),
  'January 2022 – May 2023',
  'Must format Jan 2022 - May 2023'
)
assert.strictEqual(
  formatEducationDates('2024'),
  '2024',
  'Single year preserved'
)
console.log('  ✓ 1.1 Date range normalization to full month names verified')

// 1.2 Education object normalizer
const eduObj = {
  school: 'Stevens Institute of Technology',
  degree: 'M.S. in Computer Science',
  location: 'Hoboken, NJ',
  dates: 'Sep 2024 - May 2026',
}
const normEdu = normalizeEducationItem(eduObj)
assert.strictEqual(normEdu.school, 'Stevens Institute of Technology')
assert.strictEqual(normEdu.degree, 'M.S. in Computer Science')
assert.strictEqual(normEdu.location, 'Hoboken, NJ')
assert.strictEqual(normEdu.dates, 'September 2024 – May 2026')
console.log('  ✓ 1.2 Structured education normalized with school, degree, location, dates')

// 1.3 String education parsing & location recovery
const eduStr = 'M.S. in Computer Science, Stevens Institute of Technology, Hoboken, NJ, Sep 2024 - May 2026'
const normStrEdu = normalizeEducationItem(eduStr)
assert.strictEqual(normStrEdu.school, 'Stevens Institute of Technology')
assert.strictEqual(normStrEdu.degree, 'M.S. in Computer Science')
assert.strictEqual(normStrEdu.location, 'Hoboken, NJ')
assert.strictEqual(normStrEdu.dates, 'September 2024 – May 2026')

// 1.4 School string containing trailing location
const eduWithTrailingLoc = {
  school: 'Stevens Institute of Technology, Hoboken, NJ',
  degree: 'M.S. in Computer Science',
  dates: '2024',
}
const normTrailing = normalizeEducationItem(eduWithTrailingLoc)
assert.strictEqual(normTrailing.school, 'Stevens Institute of Technology')
assert.strictEqual(normTrailing.location, 'Hoboken, NJ')
console.log('  ✓ 1.3 String & embedded location education entries cleanly extracted')

// -----------------------------------------------------------------------------
// TEST 2: Resume Rewrites Wiring (String bullets, Multi-Strategy Matching, Placeholders)
// -----------------------------------------------------------------------------
console.log('\n[Test 2] Resume Rewrites Wiring & Graceful Placeholder Cleaning:')

// 2.1 Placeholder clause cleaning
const rawPlaceholderRw = 'Engineered microservices using Node.js and Kafka, reducing approval latency by [ADD: 40%].'
const cleanedRw = cleanPlaceholderClause(rawPlaceholderRw)
assert.strictEqual(
  cleanedRw,
  'Engineered microservices using Node.js and Kafka.',
  'Must strip placeholder clause gracefully and end with clean period'
)

const rawPlaceholderRw2 = 'Automated deployments via GitHub Actions, achieving [ADD: 30% speedup] across teams.'
const cleanedRw2 = cleanPlaceholderClause(rawPlaceholderRw2)
assert.strictEqual(
  cleanedRw2,
  'Automated deployments via GitHub Actions.',
  'Must strip achieving placeholder clause'
)
console.log('  ✓ 2.1 Placeholder clauses stripped gracefully leaving clean period')

// 2.2 Plain string bullets in exp.bullets matched by bulletId, exact text, and 35-char prefix
const candidateResumeWithStrings = {
  candidate_name: 'Jordan Belfort',
  target_role: 'Senior Full Stack Engineer',
  experiences: [
    {
      company: 'TechCorp',
      role: 'Staff Engineer',
      startDate: 'Jan 2022',
      endDate: 'Present',
      isCurrent: true,
      bullets: [
        // Bullet 1: Will match by ID (synthetic exp_001_b01)
        'Developed backend services for processing customer payments.',
        // Bullet 2: Will match by exact text match
        'Maintained high-throughput data pipelines using Apache Kafka and Redis.',
        // Bullet 3: Will match by 35-char prefix match
        'Built event-driven microservices architecture handling millions of requests with Node.js.',
      ],
    },
  ],
}

const auditRewrites = [
  {
    bulletId: 'exp_001_b01',
    rewrite: 'Architected high-reliability payment gateway microservices using Node.js, reducing processing failures by [ADD: 20%].',
  },
  {
    originalText: 'Maintained high-throughput data pipelines using Apache Kafka and Redis.',
    rewriteOption: 'Engineered high-throughput event pipelines using Kafka and Redis with sub-second response times.',
  },
  {
    originalText: 'Built event-driven microservices architecture handling millions of requests with Node.js and Express.',
    suggestedRewrite: 'Spearheaded event-driven microservices architecture processing high-volume daily transactions using Node.js.',
  },
]

const { sanitizedResume: resRewritten } = sanitizeAndValidateResume(candidateResumeWithStrings, auditRewrites)

const expBullets = resRewritten.experiences[0].bullets
assert.strictEqual(
  expBullets[0],
  'Architected high-reliability payment gateway microservices using Node.js.',
  'Bullet 1 matched by ID and placeholder cleaned'
)
assert.strictEqual(
  expBullets[1],
  'Engineered high-throughput event pipelines using Kafka and Redis with sub-second response times.',
  'Bullet 2 matched by exact text'
)
assert.strictEqual(
  expBullets[2],
  'Spearheaded event-driven microservices architecture processing high-volume daily transactions using Node.js.',
  'Bullet 3 matched by 35-char prefix'
)
console.log('  ✓ 2.2 Plain string bullets matched by ID, exact text, and 35-char prefix')

// -----------------------------------------------------------------------------
// TEST 3: Missing Target Skills & Broken Brackets Guard
// -----------------------------------------------------------------------------
console.log('\n[Test 3] Missing Target Skills & Parenthesis Bracket Guards:')

// 3.1 determineSkillBucket categorization
assert.strictEqual(determineSkillBucket('TypeScript', 'Software Engineer'), 'Programming Languages')
assert.strictEqual(determineSkillBucket('Java', 'Software Engineer'), 'Programming Languages')
assert.strictEqual(determineSkillBucket('Spring Boot', 'Software Engineer'), 'Backend & APIs')
assert.strictEqual(determineSkillBucket('JWT / OAuth 2.0', 'Software Engineer'), 'Backend & APIs')
assert.strictEqual(determineSkillBucket('Kafka', 'Software Engineer'), 'Databases & Messaging')
console.log('  ✓ 3.1 Missing target skills categorized into Programming Languages, Backend & APIs, Databases & Messaging')

// 3.2 Parenthesis stitching across array elements
const brokenSkillArray = [
  'Java',
  'Python',
  'AWS (ECS Fargate',
  'Lambda',
  'S3',
  'SQS)',
  'CI/CD',
  'PostgreSQL',
  'Kafka',
  'Spring Boot',
  'TypeScript',
  'JWT / OAuth 2.0',
]

const grouped = groupByCategory(brokenSkillArray, 'Software Engineer')
const groupMap = Object.fromEntries(grouped)

assert(groupMap['Programming Languages'].includes('Java'), 'Java in Programming Languages')
assert(groupMap['Programming Languages'].includes('TypeScript'), 'TypeScript in Programming Languages')
assert(groupMap['Backend & APIs'].includes('Spring Boot'), 'Spring Boot in Backend & APIs')
assert(groupMap['Backend & APIs'].includes('JWT / OAuth 2.0'), 'JWT / OAuth 2.0 in Backend & APIs')
assert(groupMap['Databases & Messaging'].includes('Kafka'), 'Kafka in Databases & Messaging')

// Verify AWS (...) was stitched together in Cloud & DevOps and SQS) did NOT leak into Databases
assert(groupMap['Cloud & DevOps'], 'Cloud & DevOps group exists')
const cloudText = groupMap['Cloud & DevOps'].join(', ')
assert(cloudText.includes('AWS (ECS Fargate, Lambda, S3, SQS)'), 'AWS group stitched cleanly')
assert(!groupMap['Databases & Messaging'].some((s) => s.includes('SQS)')), 'SQS) does not leak to Databases')

// Verify parenthesis balance in each group
for (const [catName, skillList] of grouped) {
  const line = skillList.join(', ')
  const openP = (line.match(/\(/g) || []).length
  const closeP = (line.match(/\)/g) || []).length
  assert.strictEqual(openP, closeP, `Parentheses must be balanced in category "${catName}": "${line}"`)
}
console.log('  ✓ 3.2 Unclosed parentheses stitched and balanced strictly within category')

// -----------------------------------------------------------------------------
// TEST 4: Full End-to-End ATS DOCX Generation with Education 2-Line & Rewrites
// -----------------------------------------------------------------------------
console.log('\n[Test 4] Full End-to-End ATS DOCX Generation:')

const fullResumeInput = {
  candidate_name: 'Aditya Kulkarni',
  target_role: 'Senior AI & Full Stack Engineer',
  contact: {
    location: 'Hoboken, NJ',
    email: 'aditya@example.com',
    linkedin: 'https://linkedin.com/in/adityak',
    github: 'https://github.com/adityak',
  },
  summary: 'AI & Full Stack Engineer with 4+ years building production applications.',
  skills: [
    'Python',
    'JavaScript',
    'AWS (ECS Fargate, Lambda, S3, SQS)',
    'Docker',
    'PostgreSQL',
    'TypeScript',
    'Spring Boot',
    'Java',
    'JWT / OAuth 2.0',
    'Kafka',
  ],
  experiences: [
    {
      company: 'Tech Innovations',
      role: 'Full Stack Engineer',
      location: 'Hoboken, NJ',
      startDate: 'Jan 2022',
      endDate: 'Present',
      isCurrent: true,
      bullets: [
        'Built microservices using Node.js and PostgreSQL.',
        'Implemented Kafka messaging for event processing.',
      ],
    },
  ],
  projects: [
    {
      title: 'Real-Time Analytics Platform',
      techStack: 'Node.js, Kafka, PostgreSQL, Docker',
      bullets: ['Engineered ingestion pipeline processing live sensor data.'],
    },
  ],
  education: [
    {
      school: 'Stevens Institute of Technology',
      degree: 'M.S. in Computer Science',
      location: 'Hoboken, NJ',
      dates: 'Sep 2024 - May 2026',
    },
  ],
}

const bulletRewrites = [
  {
    bulletId: 'exp_001_b01',
    rewrite: 'Architected scalable microservices using Node.js and PostgreSQL, reducing latency by [ADD: 30%].',
  },
]

const result = await buildAtsTailoredDocx(fullResumeInput, bulletRewrites, [
  { keyword: 'Kafka', count: 3 },
  { keyword: 'TypeScript', count: 2 },
])

assert(result.buffer && Buffer.isBuffer(result.buffer), 'DOCX buffer generated')
assert(result.buffer.length > 5000, 'DOCX buffer non-empty and valid')
assert.strictEqual(result.pages, 1, 'Fits within 1 page')
console.log('  ✓ 4.1 ATS DOCX tailored buffer built successfully (length: ' + result.buffer.length + ' bytes)')

console.log('\n================================================================')
console.log('ALL ATS DOCX GENERATOR COMPREHENSIVE TESTS PASSED!')
console.log('================================================================')
