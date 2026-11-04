import assert from 'assert'
import { isConcreteTechSkill, extractSkillsHeuristically, BANNED_GENERIC_WORDS } from '../agents/resume/market/dynamicSkillExtractor.js'
import { computeKeywordAlignment } from '../agents/resume/market/keywordAlignment.js'
import { deterministicWeave, weaveKeywordsDeterministic } from '../agents/resume/market/smartKeywordWeaver.js'
import { extractSkillsFromJd } from '../agents/resume/market/jdNormalizer.js'

async function runTests() {
  console.log('=== TEST SUITE: Purge English Stop-Words & Strict Tech Entity Validation ===\n')

  // ── TEST 1: isConcreteTechSkill Validation Guard ──────────────────────────
  console.log('--- TEST 1: isConcreteTechSkill Validation Guard ---')

  const bannedWords = [
    'into', 'your', 'our', 'their', 'his', 'her', 'its', 'us', 'we', 'you', 'them',
    'with', 'from', 'about', 'above', 'below', 'under', 'over', 'across', 'through',
    'overview', 'Overview', 'position', 'Position', 'role', 'insights', 'insight', 'server', 'servers',
    'senior', 'Senior', 'junior', 'lead', 'staff', 'principal', 'intern', 'entry', 'level',
    'candidate', 'applicant', 'requirements', 'qualifications', 'responsibilities',
    'opportunity', 'company', 'organization', 'client', 'stakeholders', 'teams',
    'experience', 'years', 'working', 'ability', 'skills', 'knowledge', 'understanding',
    'solutions', 'environment', 'business', 'process', 'management', 'delivery',
    'data', 'it', 'ai', 'bi', 'information', 'technology', 'system', 'systems',
    'desktop', 'mobile', 'web', 'application', 'applications', 'platform', 'platforms',
    'pipeline', 'pipelines', 'dashboard', 'dashboards', 'report', 'reports', 'reporting',
    'development', 'developer', 'engineer', 'analyst', 'specialist', 'manager',
    'high', 'scale', 'fast', 'deep', 'strong', 'solid', 'proven', 'excellent',
    'US', 'IT', 'AT', 'OR', 'IN', 'TO', 'DO', '123', '...', '---',
  ]

  for (const word of bannedWords) {
    assert.strictEqual(
      isConcreteTechSkill(word),
      false,
      `Word "${word}" must be rejected by isConcreteTechSkill`
    )
  }

  const validTechSkills = [
    'FastMCP', 'LangGraph', 'dbt', 'PostgreSQL', 'DuckDB', 'Python',
    'SQL', 'AWS', 'GCP', 'Docker', 'Kubernetes', 'Kafka', 'Redis',
    'Tableau', 'Power BI', 'ETL', 'ELT', 'RAG', 'TypeScript', 'Node.js',
    'React', 'Next.js', 'PyTorch', 'Snowflake', 'BigQuery', 'Terraform',
  ]

  for (const skill of validTechSkills) {
    assert.strictEqual(
      isConcreteTechSkill(skill),
      true,
      `Skill "${skill}" must be accepted by isConcreteTechSkill`
    )
  }
  console.log('✓ isConcreteTechSkill correctly rejects English prepositions, pronouns, business nouns and 2-letter non-skills while accepting true tech entities.')

  // ── TEST 2: extractSkillsHeuristically and extractSkillsFromJd ────────────
  console.log('\n--- TEST 2: Heuristic & Normalizer Stop-Word Purge ---')
  const dirtyJd = `
    Job Overview: Senior Data Engineer
    Position Requirements:
    - 5+ years of experience with FastMCP, DuckDB, and LangGraph.
    - Proficiency in into your position as well as PostgreSQL and dbt in the US.
    - Strong knowledge of AWS, ETL, and Docker platforms.
    - Must collaborate across teams and deliver solutions.
  `

  const heuristicSkills = extractSkillsHeuristically(dirtyJd).skills
  console.log('Heuristic Extracted Skills:', heuristicSkills)

  assert(heuristicSkills.includes('FastMCP'), 'Must extract FastMCP')
  assert(heuristicSkills.includes('DuckDB'), 'Must extract DuckDB')
  assert(heuristicSkills.includes('LangGraph'), 'Must extract LangGraph')
  assert(heuristicSkills.includes('PostgreSQL'), 'Must extract PostgreSQL')
  assert(heuristicSkills.includes('dbt'), 'Must extract dbt')
  assert(heuristicSkills.includes('AWS'), 'Must extract AWS')
  assert(heuristicSkills.includes('ETL'), 'Must extract ETL')
  assert(heuristicSkills.includes('Docker'), 'Must extract Docker')

  // Banned words must NOT be extracted
  assert(!heuristicSkills.includes('US'), 'Must NOT extract "US"')
  assert(!heuristicSkills.includes('Overview'), 'Must NOT extract "Overview"')
  assert(!heuristicSkills.includes('Position'), 'Must NOT extract "Position"')
  assert(!heuristicSkills.includes('Senior'), 'Must NOT extract "Senior"')
  assert(!heuristicSkills.includes('into'), 'Must NOT extract "into"')
  assert(!heuristicSkills.includes('your'), 'Must NOT extract "your"')

  const normalizerSkills = extractSkillsFromJd(dirtyJd)
  assert(!normalizerSkills.includes('US'), 'Normalizer must NOT extract "US"')
  assert(!normalizerSkills.includes('into'), 'Normalizer must NOT extract "into"')
  assert(!normalizerSkills.includes('your'), 'Normalizer must NOT extract "your"')
  console.log('✓ extractSkillsHeuristically and extractSkillsFromJd purged all prepositions, pronouns, and sentence openers.')

  // ── TEST 3: keywordAlignment.js Banned Token Cleanse ─────────────────────
  console.log('\n--- TEST 3: keywordAlignment Banned Token Cleanse ---')

  const dirtyResume = {
    candidate: { targetRole: 'Data Engineer' },
    summary: { text: 'Experienced engineer with into your position background.' },
    skills: ['Python', 'SQL', 'into', 'your', 'position', 'Overview', 'US'],
    experience: [
      {
        company: 'Cloud Corp',
        role: 'Data Engineer',
        bullets: ['Built data pipelines using PostgreSQL, DuckDB, and AWS.'],
      },
    ],
  }

  const dirtyMarketProfile = {
    skills: [
      { name: 'FastMCP', frequency: 10 },
      { name: 'DuckDB', frequency: 9 },
      { name: 'into', frequency: 8 },
      { name: 'your', frequency: 7 },
      { name: 'position', frequency: 6 },
      { name: 'US', frequency: 5 },
      { name: 'dbt', frequency: 5 },
    ],
  }

  const alignment = computeKeywordAlignment({
    canonicalResume: dirtyResume,
    targetRole: 'Data Engineer',
    marketProfile: dirtyMarketProfile,
  })

  // All 3 buckets must be 100% clean of stop words
  const allAlignmentSkills = [
    ...alignment.matchedInExperience,
    ...alignment.skillsOnlyUnverified,
    ...alignment.missingFromResume,
  ]
  console.log('Cleaned Alignment Target Keywords:', allAlignmentSkills)

  assert(allAlignmentSkills.includes('DuckDB'), 'DuckDB must be present')
  assert(allAlignmentSkills.includes('FastMCP'), 'FastMCP must be present')
  assert(allAlignmentSkills.includes('dbt'), 'dbt must be present')

  assert(!allAlignmentSkills.includes('into'), 'Must not contain "into"')
  assert(!allAlignmentSkills.includes('your'), 'Must not contain "your"')
  assert(!allAlignmentSkills.includes('position'), 'Must not contain "position"')
  assert(!allAlignmentSkills.includes('US'), 'Must not contain "US"')
  assert(!allAlignmentSkills.includes('Overview'), 'Must not contain "Overview"')

  // missingMarketSkillsRanked must also be free of stop words
  for (const ranked of alignment.missingMarketSkillsRanked) {
    assert(isConcreteTechSkill(ranked.keyword), `Ranked skill "${ranked.keyword}" must be a concrete tech skill`)
  }
  console.log('✓ keywordAlignment guarantees zero English stop words in matched, skillsOnly, or missing buckets.')

  // ── TEST 4: smartKeywordWeaver.js Zero Nonsensical Talking Scripts ────────
  console.log('\n--- TEST 4: smartKeywordWeaver Zero Nonsensical Talking Scripts ---')

  const testExperiences = [
    {
      company: 'Data AI Labs',
      role: 'Data Engineer',
      bullets: [
        'Architected data pipelines to process high volume events.',
        'Optimized query performance on PostgreSQL databases.',
      ],
    },
  ]

  const woven = deterministicWeave(
    testExperiences,
    ['into', 'your', 'position', 'Overview', 'US', 'DuckDB', 'FastMCP'],
    'Data Engineer'
  )

  // Verify interview ledger
  console.log('Interview Ledger Generated:')
  woven.interviewLedger.forEach((entry) => {
    console.log(`  - Keyword: ${entry.keyword} (${entry.company})`)
  })

  const ledgerKeywords = woven.interviewLedger.map((l) => l.keyword)
  assert(ledgerKeywords.includes('DuckDB') || ledgerKeywords.includes('FastMCP'), 'Real tools must be in ledger')
  assert(!ledgerKeywords.includes('into'), 'Ledger must NEVER have talking script for "into"')
  assert(!ledgerKeywords.includes('your'), 'Ledger must NEVER have talking script for "your"')
  assert(!ledgerKeywords.includes('position'), 'Ledger must NEVER have talking script for "position"')
  assert(!ledgerKeywords.includes('US'), 'Ledger must NEVER have talking script for "US"')
  assert(!ledgerKeywords.includes('Overview'), 'Ledger must NEVER have talking script for "Overview"')

  // Verify woven bullets
  const wovenBullets = woven.tailoredExperiences[0].bullets.join(' ')
  assert(!/\binto your position\b/i.test(wovenBullets), 'Must not weave nonsense phrase')
  console.log('✓ smartKeywordWeaver generated talking scripts exclusively for valid technical entities.')

  console.log('\n======================================================================')
  console.log(' ALL STOP-WORD PURGE & STRICT ENTITY VALIDATION TESTS PASSED (4/4)!')
  console.log('======================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})

