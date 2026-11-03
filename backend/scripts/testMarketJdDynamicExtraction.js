import assert from 'assert'
import { computeKeywordAlignment } from '../agents/resume/market/keywordAlignment.js'
import { extractSkillsFromJd } from '../agents/resume/market/jdNormalizer.js'
import { analyzeMarketJdCorpus } from '../agents/resume/market/marketJdAnalyzer.js'
import { getMarketDemandedSkills } from '../agents/resume/market/marketSkillDemandRegistry.js'

async function runTests() {
  console.log('=== TEST SUITE: Scraped Market JDs & Dynamic Skill Extraction ===\n')

  // ── TEST 1: computeKeywordAlignment uses marketProfile.skills (Priority 1) ──
  console.log('--- TEST 1: keywordAlignment connects to marketProfile.skills ---')
  const mockResume = {
    candidate: { name: 'Alex Rivera', targetRole: 'Data Analyst' },
    summary: { text: 'Analytical data specialist with experience in Snowflake and SQL.' },
    skills: ['Snowflake', 'SQL', 'Tableau'],
    experience: [
      {
        company: 'Retail Metrics',
        role: 'Data Analyst',
        bullets: ['Queried large datasets using SQL and modeled data in Snowflake.'],
      },
    ],
    projects: [],
  }

  const scrapedMarketProfile = {
    skills: [
      { name: 'DuckDB', frequency: 5, frequencyRatio: 1.0 },
      { name: 'FastMCP', frequency: 4, frequencyRatio: 0.8 },
      { name: 'dbt', frequency: 4, frequencyRatio: 0.8 },
      { name: 'PowerBI', frequency: 3, frequencyRatio: 0.6 },
      { name: 'PostgreSQL', frequency: 3, frequencyRatio: 0.6 },
      { name: 'ETL', frequency: 3, frequencyRatio: 0.6 },
    ],
  }

  const alignmentWithMarket = computeKeywordAlignment({
    canonicalResume: mockResume,
    targetRole: 'Data Analyst',
    marketProfile: scrapedMarketProfile,
  })

  // Verify that marketProfile skills were used as target keywords
  assert(alignmentWithMarket.totalTargetKeywords >= 6)
  assert(alignmentWithMarket.missingFromResume.includes('DuckDB'), 'DuckDB from scraped JDs must be targeted')
  assert(alignmentWithMarket.missingFromResume.includes('FastMCP'), 'FastMCP from scraped JDs must be targeted')
  assert(alignmentWithMarket.missingFromResume.includes('dbt'), 'dbt from scraped JDs must be targeted')
  console.log('✓ Priority 1 verified: marketProfile.skills directly drives target keywords when provided.')

  // ── TEST 2: Fallback to role packs when marketProfile is empty ─────────────
  console.log('\n--- TEST 2: Fallback to Market Pack when marketProfile is absent ---')
  const alignmentWithoutMarket = computeKeywordAlignment({
    canonicalResume: mockResume,
    targetRole: 'Data Analyst',
    marketProfile: null,
  })

  // When marketProfile is null, falls back to data-analyst pack (SQL, Python, Tableau, Excel, etc.)
  assert(alignmentWithoutMarket.totalTargetKeywords >= 6)
  assert(alignmentWithoutMarket.matchedInExperience.includes('SQL'), 'SQL from static role pack matched')
  console.log('✓ Priority 2 verified: Cleanly falls back to MARKET_ROLE_KEYWORD_PACKS when no scraped JDs exist.')

  // ── TEST 3: Enhanced extractSkillsFromJd (CamelCase, Acronyms, Indicators) ─
  console.log('\n--- TEST 3: Dynamic Skill Extraction from JD Text ---')
  const rawJdText = `
    Job Description: Senior Data & AI Analytics Engineer
    About the role: We are looking for an engineer to join our high-performing team.
    Requirements:
    - 5+ years of experience with DuckDB, LangGraph, and FastMCP.
    - Proficient in PostgreSQL, Databricks, and PowerBI.
    - Strong knowledge of ETL, ELT, RAG, and SSIS pipelines.
    - Hands-on with dbt, Snowflake, and AWS.
    Benefits include Health, Dental, Vision, 401k, and competitive salary.
    Equal Opportunity Employer.
  `

  const extracted = extractSkillsFromJd(rawJdText)
  console.log('Extracted Skills from Raw JD:', extracted)

  // 1. CamelCase / PascalCase
  assert(extracted.includes('DuckDB'), 'Must extract DuckDB via CamelCase regex')
  assert(extracted.includes('LangGraph'), 'Must extract LangGraph via CamelCase regex')
  assert(extracted.includes('FastMCP'), 'Must extract FastMCP via CamelCase regex')
  assert(extracted.includes('PostgreSQL'), 'Must extract PostgreSQL via CamelCase/dict')
  assert(extracted.includes('Databricks'), 'Must extract Databricks via CamelCase regex')
  assert(extracted.includes('PowerBI') || extracted.includes('Power BI'), 'Must extract PowerBI')

  // 2. Uppercase acronyms
  assert(extracted.includes('ETL'), 'Must extract ETL via uppercase acronym regex')
  assert(extracted.includes('ELT'), 'Must extract ELT via uppercase acronym regex')
  assert(extracted.includes('RAG'), 'Must extract RAG via uppercase acronym regex')
  assert(extracted.includes('SSIS'), 'Must extract SSIS via uppercase acronym regex')
  assert(extracted.includes('AWS'), 'Must extract AWS via acronym/dict')

  // 3. Indicator phrase extraction
  assert(extracted.includes('dbt'), 'Must extract dbt via indicator phrase')

  // 4. Stop word exclusion
  assert(!extracted.includes('The'), 'Must not extract stop word "The"')
  assert(!extracted.includes('Team'), 'Must not extract stop word "Team"')
  assert(!extracted.includes('Years'), 'Must not extract stop word "Years"')
  assert(!extracted.includes('Health'), 'Must not extract benefit "Health"')
  assert(!extracted.includes('Dental'), 'Must not extract benefit "Dental"')
  console.log('✓ Dynamic regex extraction verified: CamelCase, acronyms, and indicator phrases extracted with stop words filtered.')

  // ── TEST 4: Corpus Frequency in analyzeMarketJdCorpus ─────────────────────
  console.log('\n--- TEST 4: Dynamic Corpus Frequency in analyzeMarketJdCorpus ---')
  const corpusJds = [
    'We require experience with DuckDB and FastMCP. Hands-on with ETL and SQL.',
    'Looking for DuckDB developer with LangGraph experience. Strong SQL and ETL background.',
    'Senior engineer proficient in FastMCP, DuckDB, and PostgreSQL. Familiarity with ETL.',
    'Data role requiring SQL, Snowflake, and PostgreSQL. Some LangGraph is a plus.',
  ]

  const corpusAnalysis = analyzeMarketJdCorpus(corpusJds, ['SQL', 'Snowflake'])
  console.log('Corpus Top Demanded Skills:', corpusAnalysis.topDemandedSkills)

  // DuckDB appears in 3 out of 4 JDs (75%)
  const duckDbEntry = corpusAnalysis.topDemandedSkills.find((s) => s.tool.toLowerCase() === 'duckdb')
  assert(duckDbEntry, 'DuckDB must rank in topDemandedSkills')
  assert.strictEqual(duckDbEntry.percentage, 75, 'DuckDB must have 75% occurrence')

  // FastMCP appears in 2 out of 4 JDs (50%)
  const fastMcpEntry = corpusAnalysis.topDemandedSkills.find((s) => s.tool.toLowerCase() === 'fastmcp')
  assert(fastMcpEntry, 'FastMCP must rank in topDemandedSkills')
  assert.strictEqual(fastMcpEntry.percentage, 50, 'FastMCP must have 50% occurrence')

  // ETL appears in 3 out of 4 JDs (75%)
  const etlEntry = corpusAnalysis.topDemandedSkills.find((s) => s.tool.toLowerCase() === 'etl')
  assert(etlEntry, 'ETL must rank in topDemandedSkills')
  assert.strictEqual(etlEntry.percentage, 75, 'ETL must have 75% occurrence')

  // Candidate has SQL and Snowflake, so missing high demand skills must include DuckDB and ETL
  console.log('Missing High Demand Skills for Candidate:', corpusAnalysis.missingHighDemandSkills)
  assert(
    corpusAnalysis.missingHighDemandSkills.some((s) => s.tool.toLowerCase() === 'duckdb'),
    'DuckDB must appear in missingHighDemandSkills for candidate'
  )

  console.log('✓ analyzeMarketJdCorpus dynamically extracted emerging tools and ranked them by corpus frequency.')

  // ── TEST 5: getMarketDemandedSkills dynamic computation ─────────────────
  console.log('\n--- TEST 5: getMarketDemandedSkills dynamic computation ---')
  const dynamicProfile = {
    sampleSize: 10,
    skills: [
      { name: 'FastMCP', frequency: 8, frequencyRatio: 0.8 },
      { name: 'DuckDB', frequency: 4, frequencyRatio: 0.4 },
      { name: 'Redis', frequency: 2, frequencyRatio: 0.2 },
      { name: 'Jenkins', frequency: 1, frequencyRatio: 0.1 },
    ],
  }
  const demands = getMarketDemandedSkills('Healthcare AI Engineer', dynamicProfile)
  assert.strictEqual(demands.length, 4)
  assert.strictEqual(demands[0].skill, 'FastMCP')
  assert.strictEqual(demands[0].percentage, 80)
  assert.strictEqual(demands[0].priority, 'HIGH')
  assert.strictEqual(demands[0].category, 'AI/ML')

  assert.strictEqual(demands[1].skill, 'DuckDB')
  assert.strictEqual(demands[1].percentage, 40)
  assert.strictEqual(demands[1].priority, 'HIGH')

  assert.strictEqual(demands[2].skill, 'Redis')
  assert.strictEqual(demands[2].percentage, 20)
  assert.strictEqual(demands[2].priority, 'MEDIUM')

  assert.strictEqual(demands[3].skill, 'Jenkins')
  assert.strictEqual(demands[3].percentage, 10)
  assert.strictEqual(demands[3].priority, 'LOW')
  console.log('✓ getMarketDemandedSkills dynamically computed percentages, priorities and categories without binary role switches.')

  // ── TEST 6: 24 target keywords capacity & stopword filtering ─────────────
  console.log('\n--- TEST 6: 24 target keywords capacity & stopword filtering ---')
  const largeProfile = {
    skills: [
      ...Array.from({ length: 30 }, (_, i) => ({ name: `SkillTool_${i + 1}`, frequency: 5 })),
      { name: 'the', frequency: 10 },
      { name: 'and', frequency: 10 },
      { name: 'team', frequency: 10 },
    ],
  }
  const largeAlignment = computeKeywordAlignment({
    canonicalResume: mockResume,
    targetRole: 'Data Analyst',
    marketProfile: largeProfile,
  })
  assert.strictEqual(largeAlignment.totalTargetKeywords, 24, 'Must evaluate up to 24 target keywords')
  assert(!largeAlignment.missingFromResume.includes('the'), 'Stop word "the" must be filtered')
  assert(!largeAlignment.missingFromResume.includes('and'), 'Stop word "and" must be filtered')
  assert(!largeAlignment.missingFromResume.includes('team'), 'Stop word "team" must be filtered')
  console.log('✓ Dynamic capacity capped at 24 keywords and English stop words filtered successfully.')

  console.log('\n======================================================================')
  console.log(' ALL SCRAPED MARKET JD & DYNAMIC SKILL EXTRACTION TESTS PASSED (6/6)!')
  console.log('======================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
