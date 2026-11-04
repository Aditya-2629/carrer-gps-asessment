/**
 * testLlmJdSkillAnalyzerAndMarketCache.js
 * Verification suite for:
 * 1. Canonical Skill Normalization & Synonym Mapping
 * 2. Purging English Noise & Prepositions from JD Extraction
 * 3. Batch Corpus Aggregation, Percentage Calculation & Priority Assignment
 * 4. MongoDB MarketProfile integration in keywordAlignment (Target Alignment & Missing Market Skills)
 */

import assert from 'assert'
import {
  normalizeCanonicalSkill,
  CANONICAL_SYNONYMS,
  analyzeAndAggregateJdCorpus,
} from '../agents/resume/market/llmJdSkillAnalyzer.js'
import { computeKeywordAlignment } from '../agents/resume/market/keywordAlignment.js'
import JobMarketVersion from '../models/JobMarketVersion.js'

console.log('=== RUNNING LLM JD SKILL ANALYZER & MARKET CACHE VERIFICATION ===\n')

// ---------------------------------------------------------
// TEST 1: Canonical Skill Normalization & Synonym Mapping
// ---------------------------------------------------------
console.log('Test 1: Verifying Canonical Skill Normalization & Synonym Resolution...')
assert.strictEqual(normalizeCanonicalSkill('Postgres'), 'PostgreSQL')
assert.strictEqual(normalizeCanonicalSkill('Postgre SQL'), 'PostgreSQL')
assert.strictEqual(normalizeCanonicalSkill('postgresql'), 'PostgreSQL')

assert.strictEqual(normalizeCanonicalSkill('PowerBI'), 'Power BI')
assert.strictEqual(normalizeCanonicalSkill('MS Power BI'), 'Power BI')
assert.strictEqual(normalizeCanonicalSkill('power-bi'), 'Power BI')

assert.strictEqual(normalizeCanonicalSkill('AWS'), 'AWS')
assert.strictEqual(normalizeCanonicalSkill('Amazon Web Services'), 'AWS')

assert.strictEqual(normalizeCanonicalSkill('GCP'), 'Google Cloud')
assert.strictEqual(normalizeCanonicalSkill('Google Cloud Platform'), 'Google Cloud')

assert.strictEqual(normalizeCanonicalSkill('dbt'), 'dbt')
assert.strictEqual(normalizeCanonicalSkill('DBT Core'), 'dbt')

assert.strictEqual(normalizeCanonicalSkill('k8s'), 'Kubernetes')
assert.strictEqual(normalizeCanonicalSkill('kube'), 'Kubernetes')

assert.strictEqual(normalizeCanonicalSkill('React.js'), 'React')
assert.strictEqual(normalizeCanonicalSkill('NodeJS'), 'Node.js')

console.log('✔ Test 1 Passed: Synonyms canonically normalize to industry standards.\n')

// ---------------------------------------------------------
// TEST 2: Rejection of Banned Words, Pronouns & Generic Nouns
// ---------------------------------------------------------
console.log('Test 2: Verifying Rejection of Banned Non-Skill Words...')
const bannedWords = ['into', 'your', 'our', 'us', 'position', 'overview', 'senior', 'insights', 'server', 'US', 'data', 'IT', 'with', 'from']
for (const bad of bannedWords) {
  const result = normalizeCanonicalSkill(bad)
  assert.strictEqual(result, null, `"${bad}" should be rejected by normalizeCanonicalSkill, but got "${result}"`)
}
console.log('✔ Test 2 Passed: English stop words, pronouns, and business nouns 100% rejected.\n')

// ---------------------------------------------------------
// TEST 3: Corpus Aggregation, Frequency Counts & Percentages
// ---------------------------------------------------------
console.log('Test 3: Verifying Corpus Aggregation across Sample JDs...')
const mockJds = [
  {
    title: 'Senior Data Analyst',
    company: 'FinTech Corp',
    description: 'We are seeking an analyst proficient in SQL, PostgreSQL, PowerBI, and Python for data pipelines.',
  },
  {
    title: 'BI Analyst',
    company: 'HealthPlus',
    description: 'Requirements: SQL, Power BI, Snowflake, and Tableau dashboarding experience.',
  },
  {
    title: 'Analytics Engineer',
    company: 'RetailHub',
    description: 'Stack includes SQL, dbt, PostgreSQL, Python, and Snowflake. Experience with into and position overview is not required.',
  },
  {
    title: 'Data Analyst III',
    company: 'CloudScale',
    description: 'Must have strong SQL, MS Power BI, Python, and AWS Redshift knowledge.',
  },
  {
    title: 'Product Analyst',
    company: 'SaaSFlow',
    description: 'Core skills: SQL, Python, Tableau, and dbt. Must understand database normalization.',
  },
]

const result = await analyzeAndAggregateJdCorpus(mockJds, 'data-analyst::3-5')
assert.strictEqual(result.totalAnalyzed, 5, 'Should analyze all 5 JDs')
assert(Array.isArray(result.marketSkills), 'marketSkills must be an array')
assert(result.marketSkills.length > 0, 'Should have extracted canonical market skills')

// SQL should be present in 100% (5 of 5) of the postings
const sqlSkill = result.marketSkills.find((s) => s.name === 'SQL')
assert(sqlSkill, 'SQL must be in marketSkills')
assert.strictEqual(sqlSkill.count, 5, 'SQL count should be 5')
assert.strictEqual(sqlSkill.percentage, 100, 'SQL percentage should be 100%')
assert.strictEqual(sqlSkill.priority, 'HIGH', 'SQL priority should be HIGH')

// Power BI should combine "PowerBI", "Power BI", and "MS Power BI" (3 of 5 = 60%)
const powerBiSkill = result.marketSkills.find((s) => s.name === 'Power BI')
assert(powerBiSkill, 'Power BI must be in marketSkills')
assert.strictEqual(powerBiSkill.count, 3, 'Power BI count should be 3 (normalized from PowerBI, Power BI, MS Power BI)')
assert.strictEqual(powerBiSkill.percentage, 60, 'Power BI percentage should be 60%')
assert.strictEqual(powerBiSkill.priority, 'HIGH', 'Power BI priority should be HIGH')

// Verify zero banned non-skill words in marketSkills
for (const s of result.marketSkills) {
  assert(
    !/^(into|your|our|us|position|overview|senior|insights?|server|data|it)$/i.test(s.name),
    `Banned token "${s.name}" found in marketSkills!`
  )
}

// Verify descending sort order by percentage
for (let i = 0; i < result.marketSkills.length - 1; i++) {
  assert(
    result.marketSkills[i].percentage >= result.marketSkills[i + 1].percentage,
    'Skills must be sorted descending by percentage'
  )
}
console.log('✔ Test 3 Passed: Corpus aggregation accurately computes counts, canonical names, and percentages.\n')

// ---------------------------------------------------------
// TEST 4: MongoDB JobMarketVersion Schema Validation
// ---------------------------------------------------------
console.log('Test 4: Verifying JobMarketVersion Mongoose Schema compatibility...')
const mockVersionDoc = new JobMarketVersion({
  bucketKey: 'data-analyst::3-5',
  version: 1,
  jobs: [
    {
      title: 'Data Analyst',
      company: 'Test Co',
      description: 'Testing JD description',
      fingerprint: 'fp_123',
    },
  ],
  marketProfile: {
    bucketKey: 'data-analyst::3-5',
    sampleSize: 5,
    totalAnalyzed: 5,
    skills: result.marketSkills,
    topKeywords: result.marketSkills.slice(0, 5).map((s) => s.name),
    version: 'market-profile-v2',
  },
})

const validationError = mockVersionDoc.validateSync()
assert(!validationError, `JobMarketVersion schema validation should pass, but failed: ${validationError?.message}`)
console.log('✔ Test 4 Passed: JobMarketVersion schema accommodates normalized skill matrix.\n')

// ---------------------------------------------------------
// TEST 5: Instant Cached Market Skills in keywordAlignment.js
// ---------------------------------------------------------
console.log('Test 5: Verifying Instant Market Cache in keywordAlignment.js...')
const mockResume = {
  candidate: { targetRole: 'Data Analyst' },
  skills: ['Python', 'Excel', 'Pandas'],
  experience: [
    {
      role: 'Junior Analyst',
      company: 'DataCorp',
      bullets: ['Automated financial models in Python and Excel for reporting.'],
    },
  ],
}

const mockMarketProfile = {
  bucketKey: 'data-analyst::3-5',
  sampleSize: 100,
  skills: [
    { name: 'SQL', percentage: 92, priority: 'HIGH', category: 'database_warehousing' },
    { name: 'Power BI', percentage: 78, priority: 'HIGH', category: 'bi_visualization' },
    { name: 'Python', percentage: 65, priority: 'HIGH', category: 'languages' },
    { name: 'Snowflake', percentage: 48, priority: 'HIGH', category: 'database_warehousing' },
    { name: 'dbt', percentage: 38, priority: 'MEDIUM', category: 'data_engineering' },
    { name: 'Tableau', percentage: 32, priority: 'MEDIUM', category: 'bi_visualization' },
  ],
}

const alignment = computeKeywordAlignment({
  canonicalResume: mockResume,
  targetJobDescription: '',
  targetRole: 'Data Analyst',
  marketProfile: mockMarketProfile,
})

// Priority 1 verification: targetKeywords drive directly from marketProfile.skills
assert(alignment.targetKeywords.includes('SQL'), 'targetKeywords must include SQL from marketProfile')
assert(alignment.targetKeywords.includes('Power BI'), 'targetKeywords must include Power BI from marketProfile')
assert(alignment.targetKeywords.includes('Snowflake'), 'targetKeywords must include Snowflake from marketProfile')

// Missing market skills verification:
// Python is in candidate's resume -> NOT missing
// SQL, Power BI, Snowflake, dbt, Tableau are NOT in resume -> MUST be missing with exact percentages
assert(alignment.matchedInExperience.includes('Python'), 'Python should be matched in experience')
assert(alignment.missingFromResume.includes('SQL'), 'SQL should be in missingFromResume')
assert(alignment.missingFromResume.includes('Power BI'), 'Power BI should be in missingFromResume')

const missingSql = alignment.missingMarketSkillsRanked.find((s) => s.keyword === 'SQL')
assert(missingSql, 'SQL must be in missingMarketSkillsRanked')
assert.strictEqual(missingSql.percentage, 92, 'SQL percentage must be 92%')
assert.strictEqual(missingSql.badge, '92% of JDs', 'SQL badge must be "92% of JDs"')

const missingPowerBi = alignment.missingMarketSkillsRanked.find((s) => s.keyword === 'Power BI')
assert(missingPowerBi, 'Power BI must be in missingMarketSkillsRanked')
assert.strictEqual(missingPowerBi.percentage, 78, 'Power BI percentage must be 78%')
assert.strictEqual(missingPowerBi.badge, '78% of JDs', 'Power BI badge must be "78% of JDs"')

console.log('✔ Test 5 Passed: keywordAlignment loads pre-computed market percentages instantly.\n')

console.log('ALL LLM JD SKILL ANALYZER & MARKET CACHE TESTS PASSED SUCCESSFULLY! 🚀')
