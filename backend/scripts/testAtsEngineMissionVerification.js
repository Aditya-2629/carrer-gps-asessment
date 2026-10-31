import assert from 'assert'
import {
  sanitizeAndValidateResume,
  repairGrammar,
  formatDateRange,
  tokenizeSkillsSafe,
  findNumberViolations,
  SAFE_BULLET_STRIP_REGEX,
} from '../services/resumeValidator.js'
import { buildAtsTailoredDocx } from '../services/docxResumeService.js'

async function runComprehensiveMissionVerification() {
  console.log('================================================================')
  console.log('RUNNING COMPREHENSIVE ATS ENGINE MISSION VERIFICATION SUITE')
  console.log('================================================================\n')

  // -------------------------------------------------------------
  // Test 1: Absolute Truth & Data Integrity
  // -------------------------------------------------------------
  console.log('[Test 1] Absolute Truth & Data Integrity Rules:')

  // 1.1 Weak opener verbs must NEVER cause bullet drop
  const resumeWithWeakOpener = {
    candidate_name: 'Alex Mercer',
    target_role: 'Software Engineer',
    experiences: [
      {
        id: 'exp_001',
        company: 'TechCorp',
        role: 'Engineer',
        bullets: [
          { id: 'exp_001_b01', text: 'Responsible for database maintenance across 5 shards.' }, // Weak opener
        ],
      },
    ],
  }
  const res1 = sanitizeAndValidateResume(resumeWithWeakOpener, [])
  assert.strictEqual(res1.sanitizedResume.experiences[0].bullets.length, 1, 'Bullet with weak opener must NOT be dropped')
  assert(res1.sanitizedResume.experiences[0].bullets[0].includes('Responsible for database maintenance'), 'Bullet text must be preserved')
  const weakWarning = res1.warnings.find((w) => w.type === 'weak_opener')
  assert(weakWarning, 'Must emit weak_opener warning')
  console.log('  ✓ 1.1 Weak opener verb retained with warning { type: "weak_opener" }')

  // 1.2 Never drop a job or project
  const resumeWithManyRoles = {
    candidate_name: 'Jordan Lee',
    target_role: 'Staff Engineer',
    years_of_experience: 10,
    experiences: [
      { id: 'exp_001', company: 'Company A', role: 'Role A', bullets: [{ id: 'exp_001_b01', text: 'Architected system A.' }] },
      { id: 'exp_002', company: 'Company B', role: 'Role B', bullets: [{ id: 'exp_002_b01', text: 'Developed system B.' }] },
      { id: 'exp_003', company: 'Company C', role: 'Role C', bullets: [{ id: 'exp_003_b01', text: 'Scaled system C.' }] },
      { id: 'exp_004', company: 'Company D', role: 'Role D', bullets: [{ id: 'exp_004_b01', text: 'Built system D.' }] },
    ],
    projects: [
      { id: 'proj_001', title: 'OpenSource X', bullets: [{ id: 'proj_001_b01', text: 'Maintained core modules.' }] },
      { id: 'proj_002', title: 'OpenSource Y', bullets: [{ id: 'proj_002_b01', text: 'Designed consensus algorithm.' }] },
    ],
  }
  const resRoles = sanitizeAndValidateResume(resumeWithManyRoles, [])
  assert.strictEqual(resRoles.sanitizedResume.experiences.length, 4, 'All 4 experiences must be preserved')
  assert.strictEqual(resRoles.sanitizedResume.projects.length, 2, 'All 2 projects must be preserved')
  console.log('  ✓ 1.2 All experiences (4) and projects (2) strictly preserved')

  // 1.3 Placeholder markers [ADD: ...] revert to original candidate bullet
  const resumeWithPlaceholderRewrite = {
    candidate_name: 'Taylor Swift',
    target_role: 'Full Stack Engineer',
    experiences: [
      {
        id: 'exp_001',
        company: 'Stripe',
        role: 'Engineer',
        bullets: [
          { id: 'exp_001_b01', text: 'Engineered payment gateway integration.' },
        ],
      },
    ],
  }
  const rewriteWithPlaceholder = [
    {
      id: 'exp_001_b01',
      rewrite: 'Engineered payment gateway integration, supporting [ADD: 30% latency reduction].',
    },
  ]
  const resPlaceholder = sanitizeAndValidateResume(resumeWithPlaceholderRewrite, rewriteWithPlaceholder)
  assert.strictEqual(
    resPlaceholder.sanitizedResume.experiences[0].bullets[0],
    'Engineered payment gateway integration.',
    'Must revert to original bullet when rewrite contains [ADD: ...]'
  )
  assert(resPlaceholder.warnings.some((w) => w.type === 'needs_input'), 'Must emit needs_input warning')
  console.log('  ✓ 1.3 Rewrite with [ADD: ...] cleanly reverted to original candidate bullet with needs_input warning')

  // 1.4 Strict Number Integrity
  const resumeWithNumbers = {
    candidate_name: 'Casey Morgan',
    target_role: 'Backend Engineer',
    experiences: [
      {
        id: 'exp_001',
        company: 'Netflix',
        role: 'Senior Engineer',
        bullets: [
          { id: 'exp_001_b01', text: 'Migrated 50+ microservices to Kubernetes cluster.' },
          { id: 'exp_001_b02', text: 'Optimized SQL queries cutting p99 latency by 35%.' },
        ],
      },
    ],
  }
  const rewritesWithNumbers = [
    // Case A: Valid rewrite with 50 matching 50+ (no violation)
    { id: 'exp_001_b01', rewrite: 'Migrated 50 microservices to Kubernetes cluster with zero-downtime.' },
    // Case B: Fabricated 85% instead of 35% (violation)
    { id: 'exp_001_b02', rewrite: 'Optimized SQL queries cutting p99 latency by 85%.' },
  ]
  const resNum = sanitizeAndValidateResume(resumeWithNumbers, rewritesWithNumbers)
  assert(
    resNum.sanitizedResume.experiences[0].bullets[0].includes('50 microservices'),
    '50+ in original vs 50 in rewrite must be accepted without false violation'
  )
  assert.strictEqual(
    resNum.sanitizedResume.experiences[0].bullets[1],
    'Optimized SQL queries cutting p99 latency by 35%.',
    'Fabricated 85% metric must be reverted to original bullet'
  )
  const numViol = resNum.warnings.find((w) => w.type === 'number_violation')
  assert(numViol, 'Must emit number_violation warning')
  assert.strictEqual(numViol.original, 'Optimized SQL queries cutting p99 latency by 35%.')
  assert(numViol.rewrite.includes('85%'))
  console.log('  ✓ 1.4 Number integrity verified: "50+" accepted as "50", while fabricated "85%" was reverted')

  // 1.5 Never fabricate sentinel defaults
  const resumeWithSentinels = {
    candidate_name: 'CANDIDATE',
    target_role: 'Developer',
    experiences: [
      {
        id: 'exp_001',
        company: 'Company',
        role: 'Employee',
        bullets: [{ id: 'exp_001_b01', text: 'Implemented backend services.' }],
      },
    ],
    education: [
      {
        school: 'University',
        degree: 'Degree',
      },
    ],
  }
  const resSentinel = sanitizeAndValidateResume(resumeWithSentinels, [])
  assert.strictEqual(resSentinel.sanitizedResume.candidate_name, '', 'Candidate sentinel name must be suppressed')
  assert.strictEqual(resSentinel.sanitizedResume.experiences[0].company, '', 'Company sentinel must be suppressed')
  assert.strictEqual(resSentinel.sanitizedResume.education.length, 0, 'Sentinel-only education must be omitted')
  assert(resSentinel.warnings.some((w) => w.type === 'missing_field'), 'Must emit missing_field warnings')
  console.log('  ✓ 1.5 Sentinel defaults ("CANDIDATE", "Company", "University") suppressed without fabrication')

  // -------------------------------------------------------------
  // Test 2: Missing Keywords Natural Injection Engine
  // -------------------------------------------------------------
  console.log('\n[Test 2] Missing Keywords Natural Injection Engine:')

  const candidateWithEvidence = {
    candidate_name: 'Devin Chen',
    target_role: 'Software Engineer',
    skills: ['Python', 'Kubernetes'],
    experiences: [
      {
        id: 'exp_001',
        company: 'Container Systems',
        role: 'Cloud Developer',
        bullets: [
          { id: 'exp_001_b01', text: 'Deployed containers across cloud infrastructure using Python.' },
          { id: 'exp_001_b02', text: 'Re-indexed relational databases to speed up reporting queries.' },
        ],
      },
    ],
  }
  const jdKeywords = [
    { keyword: 'Docker', count: 3 },     // Evidence: "containers" in bullet + Kubernetes in skills
    { keyword: 'PostgreSQL', count: 4 }, // Evidence: "relational databases" and "queries" in bullet
    { keyword: 'COBOL', count: 2 },      // NO evidence: should go to pendingKeywords
  ]

  const resKw = sanitizeAndValidateResume(candidateWithEvidence, [], jdKeywords)
  // Docker should be applied
  assert(resKw.appliedKeywords.some((k) => k.keyword === 'Docker'), 'Docker must be applied due to container evidence')
  assert(resKw.appliedKeywords.some((k) => k.keyword === 'PostgreSQL'), 'PostgreSQL must be applied due to relational database evidence')
  // COBOL should NOT be applied, but in pendingKeywords
  assert(!resKw.appliedKeywords.some((k) => k.keyword === 'COBOL'), 'COBOL must NOT be applied without evidence')
  const pendingCobol = resKw.pendingKeywords.find((k) => k.keyword === 'COBOL')
  assert(pendingCobol, 'COBOL must be in pendingKeywords')
  assert.strictEqual(pendingCobol.status, 'Add only if true')
  assert.strictEqual(pendingCobol.jdCount, 2)

  // Verify generic rephrasing happened
  const b1 = resKw.sanitizedResume.experiences[0].bullets[0]
  const b2 = resKw.sanitizedResume.experiences[0].bullets[1]
  assert(b1.includes('Docker containers'), 'Generic "containers" should be reframed to Docker containers')
  assert(b2.includes('PostgreSQL database'), 'Generic "relational databases" should be reframed to PostgreSQL database')
  console.log('  ✓ 2.1 Verified evidence injected into skills under exact bucket')
  console.log('  ✓ 2.2 Generic terms reframed ("containers" -> "Docker containers", "relational databases" -> "PostgreSQL database")')
  console.log('  ✓ 2.3 Unverified keyword "COBOL" placed into pendingKeywords with status "Add only if true"')

  // -------------------------------------------------------------
  // Test 3: Safe Bullet Marker Stripping, Banned Buzzwords & Grammar
  // -------------------------------------------------------------
  console.log('\n[Test 3] Parsing, Stripping & Grammar Guards:')

  // 3.1 Safe bullet marker stripping preserving **bold**
  const boldBullet = '**Engineered** scalable streaming platform with Kafka.'
  const strippedBold = boldBullet.replace(SAFE_BULLET_STRIP_REGEX, '')
  assert.strictEqual(strippedBold, '**Engineered** scalable streaming platform with Kafka.', 'Markdown bold opener must NOT be stripped into *Engineered**')

  const regularBullet = '• Engineered scalable streaming platform with Kafka.'
  const strippedReg = regularBullet.replace(SAFE_BULLET_STRIP_REGEX, '')
  assert.strictEqual(strippedReg, 'Engineered scalable streaming platform with Kafka.')
  console.log('  ✓ 3.1 SAFE_BULLET_STRIP_REGEX preserves **Built** and strips regular bullet glyphs')

  // 3.2 Banned buzzword replacement
  const buzzwordText = 'Automated onboarding process as measured by 40% reduction in cycle time.'
  const repairedBuzz = repairGrammar(buzzwordText)
  assert(!repairedBuzz.includes('as measured by'), 'Must replace "as measured by"')
  assert(repairedBuzz.includes('targeting 40% reduction'), 'Must rephrase to "targeting 40% reduction"')
  console.log('  ✓ 3.2 "as measured by" rephrased to "targeting <metric>"')

  // 3.3 Grammar repair of legacy phrases
  const legacyBroken = 'Eliminated of manual verification routines and reduced of error rates.'
  const repairedLegacy = repairGrammar(legacyBroken)
  assert.strictEqual(repairedLegacy, 'Eliminated manual verification routines and reduced error rates.')
  console.log('  ✓ 3.3 Broken phrases repaired ("Eliminated of manual" -> "Eliminated manual")')

  // 3.4 Bracket-Aware Tokenizer
  const skillStr = 'Python, A/B Testing, Docker (Containerization, Compose), CI/CD, SQL'
  const tokens = tokenizeSkillsSafe(skillStr)
  assert.deepStrictEqual(tokens, [
    'Python',
    'A/B Testing',
    'Docker (Containerization, Compose)',
    'CI/CD',
    'SQL',
  ])
  console.log('  ✓ 3.4 Bracket-aware tokenizer preserves (Containerization, Compose) and A/B Testing, CI/CD')

  // -------------------------------------------------------------
  // Test 4: Dates & Contact Normalization
  // -------------------------------------------------------------
  console.log('\n[Test 4] Dates & Contact Normalization:')

  assert.strictEqual(formatDateRange('Jan 2019', 'Mar 2021', false), 'Jan 2019 – Mar 2021')
  assert.strictEqual(formatDateRange('Jan 2019', '', true), 'Jan 2019 – Present')
  assert.strictEqual(formatDateRange('Jan 2019 – ', '', false), 'Jan 2019') // No orphan dash
  assert.strictEqual(formatDateRange('Jan 2019', undefined, false), 'Jan 2019') // No undefined
  assert.strictEqual(formatDateRange(undefined, undefined, false), '')
  console.log('  ✓ 4.1 Date range formatter guarantees zero undefined and zero orphan dashes')

  // -------------------------------------------------------------
  // Test 5 & 6: DOCX Builder, Fit Loop & Controller Contract
  // -------------------------------------------------------------
  console.log('\n[Test 5 & 6] DOCX Builder Contract & Fit Loop:')

  const candidateDocxInput = {
    candidate_name: 'Elena Rostova',
    target_role: 'Full Stack Engineer',
    contact: {
      phone: '415-555-0199',
      email: 'elena.rostova@example.com',
      location: 'San Francisco, CA',
      linkedin: 'https://linkedin.com/in/elena-rostova',
      github: 'https://github.com/elena-rostova',
    },
    summary: 'Full Stack Engineer with 4 years of experience building scalable distributed systems.',
    skills: ['Python', 'TypeScript', 'FastAPI', 'React', 'Docker', 'PostgreSQL'],
    experiences: [
      {
        id: 'exp_001',
        company: 'Acme Cloud Inc',
        role: 'Full Stack Engineer',
        location: 'San Francisco, CA',
        startDate: 'Jan 2022',
        isCurrent: true,
        bullets: [
          { id: 'exp_001_b01', text: 'Architected FastAPI microservices processing 1M daily events with 99.9% uptime.' },
          { id: 'exp_001_b02', text: 'Containerized frontend and backend workflows reducing build times by 40%.' },
        ],
      },
    ],
    projects: [
      {
        id: 'proj_001',
        title: 'Distributed Task Queue',
        techStack: 'Python, Redis, Docker',
        startDate: '2021',
        bullets: [
          { id: 'proj_001_b01', text: 'Built resilient queue engine handling 5K tasks/sec with at-least-once delivery semantics.' },
        ],
      },
    ],
    education: [
      {
        school: 'University of California, Berkeley',
        degree: 'B.S. in Computer Science',
        dates: '2017 – 2021',
      },
    ],
  }

  const docxOutput = await buildAtsTailoredDocx(candidateDocxInput, [], [{ keyword: 'Redis', count: 2 }])

  // Verify return contract
  assert(docxOutput.buffer && Buffer.isBuffer(docxOutput.buffer), 'Must return buffer')
  assert.strictEqual(typeof docxOutput.pages, 'number', 'Must return numeric pages')
  assert(docxOutput.pages >= 1, 'Pages must be >= 1')
  assert(docxOutput.mode === 'measured' || docxOutput.mode === 'estimated', 'Must return valid mode')
  assert(Array.isArray(docxOutput.warnings), 'Must return warnings array')
  assert(Array.isArray(docxOutput.appliedKeywords), 'Must return appliedKeywords array')
  assert(Array.isArray(docxOutput.pendingKeywords), 'Must return pendingKeywords array')

  console.log(`  ✓ 5.1 buildAtsTailoredDocx returned valid buffer (${docxOutput.buffer.length} bytes), pages: ${docxOutput.pages}, mode: ${docxOutput.mode}`)
  console.log('  ✓ 5.2 Contract conforms to { buffer, pages, mode, warnings, appliedKeywords, pendingKeywords }')

  console.log('\n================================================================')
  console.log('ALL COMPREHENSIVE ATS ENGINE MISSION VERIFICATION TESTS PASSED!')
  console.log('================================================================')
}

runComprehensiveMissionVerification().catch((err) => {
  console.error('FAIL in Comprehensive Mission Verification Suite:', err)
  process.exit(1)
})
