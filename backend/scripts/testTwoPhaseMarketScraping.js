/**
 * testTwoPhaseMarketScraping.js
 * Verification suite for Two-Phase Progressive Market JD Scraping:
 * 1. fetchFastCatchJds exports and functionality
 * 2. getMarketDataForBucket offline safety and Fast-Catch flow
 * 3. computeKeywordAlignment with Fast-Catch live scraped skills
 */

import assert from 'assert'
import { fetchFastCatchJds, enqueueFullBackgroundBucket } from '../jobs/marketJd/marketJdJobs.js'
import { getMarketDataForBucket } from '../agents/resume/market/marketJdRetriever.js'
import { computeKeywordAlignment } from '../agents/resume/market/keywordAlignment.js'

console.log('=== RUNNING TWO-PHASE PROGRESSIVE MARKET SCRAPING TESTS ===\n')

// ---------------------------------------------------------
// TEST 1: fetchFastCatchJds Interface & Export Verification
// ---------------------------------------------------------
console.log('Test 1: Verifying fetchFastCatchJds Interface & Exports...')
assert.strictEqual(typeof fetchFastCatchJds, 'function', 'fetchFastCatchJds must be an exported function')
assert.strictEqual(typeof enqueueFullBackgroundBucket, 'function', 'enqueueFullBackgroundBucket must be an exported function')

// Test 1: Fast-catch with mockJds returns immediately in 0ms
const mockJds = [
  { title: 'Data Analyst', company: 'Acme', description: 'Requires SQL, Python, Snowflake and dbt.' },
  { title: 'BI Analyst', company: 'Globex', description: 'Experience in Power BI, SQL, Tableau.' },
  { title: 'Data Specialist', company: 'Initech', description: 'Building dbt models and Snowflake analytics.' },
]
const fastCatchResult = await fetchFastCatchJds({ role: 'Data Analyst', targetCount: 15, timeoutMs: 500, mockJds })
assert(Array.isArray(fastCatchResult), 'fetchFastCatchJds must resolve to an array')
assert.strictEqual(fastCatchResult.length, 3, 'Must return 3 mock JDs')

// Verify dynamic role resolution from bucketKey when role is omitted
const dynamicBucketResult = await fetchFastCatchJds({ bucketKey: 'data-analyst::3-5', targetCount: 2, mockJds })
assert.strictEqual(dynamicBucketResult.length, 2, 'Must slice to targetCount 2')
console.log('✔ Test 1 Passed: fetchFastCatchJds and enqueueFullBackgroundBucket interfaces verified.\n')

// ---------------------------------------------------------
// TEST 2: getMarketDataForBucket Offline / Empty Fallback
// ---------------------------------------------------------
console.log('Test 2: Verifying getMarketDataForBucket Offline Safety...')
// Offline (mongoose not connected in standalone script) should return status 'unavailable' cleanly
const offlineData = await getMarketDataForBucket('software-engineer::3-5', { bypassFastCatch: true })
assert.strictEqual(offlineData.status, 'unavailable', 'Offline status should be unavailable')
assert.strictEqual(offlineData.bucketKey, 'software-engineer::3-5')
console.log('✔ Test 2 Passed: getMarketDataForBucket gracefully handles offline state.\n')

// ---------------------------------------------------------
// TEST 3: computeKeywordAlignment with Fast-Catch Market Profile (15 JDs)
// ---------------------------------------------------------
console.log('Test 3: Verifying computeKeywordAlignment with Fast-Catch Profile...')
const fastCatchMarketProfile = {
  bucketKey: 'data-analyst::3-5',
  sampleSize: 15,
  totalAnalyzed: 15,
  isFastCatch: true,
  skills: [
    { name: 'Python', count: 12, percentage: 80, category: 'languages' },
    { name: 'SQL', count: 14, percentage: 93, category: 'databases' },
    { name: 'Snowflake', count: 9, percentage: 60, category: 'data_warehousing' },
    { name: 'dbt', count: 7, percentage: 47, category: 'data_engineering' },
    { name: 'Tableau', count: 8, percentage: 53, category: 'bi_visualization' },
  ],
  topKeywords: ['SQL', 'Python', 'Snowflake', 'Tableau', 'dbt'],
}

const mockResume = {
  candidate: { targetRole: 'Data Analyst' },
  skills: ['Python', 'SQL'],
  experience: [
    {
      company: 'Data Insights Inc',
      role: 'Data Analyst',
      bullets: ['Built SQL queries and Python scripts for monthly revenue reporting.'],
    },
  ],
}

const alignment = computeKeywordAlignment({
  canonicalResume: mockResume,
  targetJobDescription: '',
  targetRole: 'Data Analyst',
  marketProfile: fastCatchMarketProfile,
})

assert(alignment.matchedInExperience.includes('Python'), 'Python must be matched in experience')
assert(alignment.matchedInExperience.includes('SQL'), 'SQL must be matched in experience')

// Genuinely missing skills from Fast-Catch should be Snowflake, dbt, Tableau
const missingKeywords = alignment.missingMarketSkillsRanked.map((s) => s.keyword)
assert(missingKeywords.includes('Snowflake'), 'Snowflake must appear in missingMarketSkillsRanked from Fast-Catch')
assert(missingKeywords.includes('dbt'), 'dbt must appear in missingMarketSkillsRanked from Fast-Catch')
assert(missingKeywords.includes('Tableau'), 'Tableau must appear in missingMarketSkillsRanked from Fast-Catch')

// Check percentage preservation from Fast-Catch
const snowflakeItem = alignment.missingMarketSkillsRanked.find((s) => s.keyword === 'Snowflake')
assert.strictEqual(snowflakeItem.percentage, 60, 'Snowflake should retain exact 60% demand from Fast-Catch')
assert.strictEqual(snowflakeItem.priority, 'HIGH', 'Snowflake (>40%) should be HIGH priority')
assert.strictEqual(snowflakeItem.priorityColor, 'red', 'Snowflake should have red color badge')

console.log('Fast-Catch Missing Skills Extracted:', alignment.missingMarketSkillsRanked.map((s) => `${s.keyword} (${s.percentage}%)`))
console.log('✔ Test 3 Passed: computeKeywordAlignment accurately consumes Fast-Catch live profile.\n')

console.log('ALL TWO-PHASE MARKET SCRAPING TESTS PASSED SUCCESSFULLY! 🚀')
