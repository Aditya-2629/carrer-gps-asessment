/**
 * testUncappedMissingSkillsReverseMatching.js
 * Verification suite for:
 * 1. Removal of all .slice(0, 25) / .slice(0, 16) caps on target and missing keywords.
 * 2. True reverse-matching: Candidate existing skills (experience, projects, skills section)
 *    are filtered out FIRST and NEVER appear in missing skills list.
 * 3. 3-tier classification:
 *    - Red (>40% demand): priority: 'HIGH', priorityColor: 'red'
 *    - Yellow (20%-40% demand): priority: 'MEDIUM', priorityColor: 'yellow'
 *    - Grey (10%-20% demand): priority: 'LOW', priorityColor: 'grey'
 * 4. Pass-through of uncapped missingMarketSkillsRanked in resumeScorecard.
 */

import assert from 'assert'
import { computeKeywordAlignment, isGenuineTechnicalSkill } from '../agents/resume/market/keywordAlignment.js'
import { computeScorecard } from '../agents/resume/scoring/resumeScorecard.js'

console.log('=== RUNNING UNCAPPED MISSING SKILLS & REVERSE MATCHING VERIFICATION ===\n')

// ---------------------------------------------------------
// TEST 1: Existing Candidate Skills NEVER Appear in Missing List
// ---------------------------------------------------------
console.log('Test 1: Verifying Existing Candidate Skills are Filtered Out First...')

// Candidate has SQL, Python, Excel, Snowflake, Power BI
const mockCandidate = {
  candidate: { targetRole: 'Data Analyst' },
  skills: ['SQL', 'Python', 'Excel', 'Snowflake', 'Power BI', 'Pandas'],
  experience: [
    {
      company: 'TechCorp',
      role: 'Business Intelligence Analyst',
      bullets: [
        'Developed complex SQL queries and Python scripts to extract data from Snowflake warehouses.',
        'Built interactive Power BI executive dashboards for KPI tracking.',
      ],
    },
  ],
}

// Market has 35 unique skills across postings
const mockMarketProfile = {
  bucketKey: 'data-analyst::3-5',
  sampleSize: 100,
  skills: [
    { name: 'SQL', percentage: 95, priority: 'HIGH', category: 'database_warehousing' },
    { name: 'Power BI', percentage: 85, priority: 'HIGH', category: 'bi_visualization' },
    { name: 'Python', percentage: 80, priority: 'HIGH', category: 'languages' },
    { name: 'Snowflake', percentage: 65, priority: 'HIGH', category: 'database_warehousing' },
    { name: 'Excel', percentage: 55, priority: 'HIGH', category: 'tools' },
    // Genuinely missing skills (>40%):
    { name: 'Tableau', percentage: 50, priority: 'HIGH', category: 'bi_visualization' },
    { name: 'dbt', percentage: 45, priority: 'HIGH', category: 'data_engineering' },
    { name: 'BigQuery', percentage: 42, priority: 'HIGH', category: 'database_warehousing' },
    // Genuinely missing skills (20%-40%):
    { name: 'AWS', percentage: 38, priority: 'MEDIUM', category: 'cloud_devops' },
    { name: 'Databricks', percentage: 35, priority: 'MEDIUM', category: 'data_engineering' },
    { name: 'Apache Airflow', percentage: 30, priority: 'MEDIUM', category: 'data_engineering' },
    { name: 'Looker', percentage: 28, priority: 'MEDIUM', category: 'bi_visualization' },
    { name: 'PostgreSQL', percentage: 25, priority: 'MEDIUM', category: 'database_warehousing' },
    { name: 'Apache Spark', percentage: 22, priority: 'MEDIUM', category: 'data_engineering' },
    // Genuinely missing skills (10%-20%):
    { name: 'Docker', percentage: 18, priority: 'LOW', category: 'cloud_devops' },
    { name: 'Kubernetes', percentage: 15, priority: 'LOW', category: 'cloud_devops' },
    { name: 'Kafka', percentage: 14, priority: 'LOW', category: 'data_engineering' },
    { name: 'Jira', percentage: 12, priority: 'LOW', category: 'methodologies_processes' },
    { name: 'Git', percentage: 11, priority: 'LOW', category: 'cloud_devops' },
  ],
}

const alignment = computeKeywordAlignment({
  canonicalResume: mockCandidate,
  targetJobDescription: '',
  targetRole: 'Data Analyst',
  marketProfile: mockMarketProfile,
})

// Existing skills check:
const candidateOwned = ['SQL', 'Power BI', 'Python', 'Snowflake', 'Excel']
for (const skill of candidateOwned) {
  const isMissing = alignment.missingMarketSkillsRanked.some((m) => m.keyword.toLowerCase() === skill.toLowerCase())
  assert(!isMissing, `Existing candidate skill "${skill}" MUST NOT appear in missingMarketSkillsRanked!`)

  const inMissingFromResume = alignment.missingFromResume.some((s) => s.toLowerCase() === skill.toLowerCase())
  assert(!inMissingFromResume, `Existing candidate skill "${skill}" MUST NOT appear in missingFromResume!`)
}

assert(alignment.matchedInExperience.includes('SQL'), 'SQL must be in matchedInExperience')
assert(alignment.matchedInExperience.includes('Power BI'), 'Power BI must be in matchedInExperience')
assert(alignment.matchedInExperience.includes('Python'), 'Python must be in matchedInExperience')
assert(alignment.matchedInExperience.includes('Snowflake'), 'Snowflake must be in matchedInExperience')

console.log('✔ Test 1 Passed: Existing candidate skills are filtered out and NEVER appear in missing lists.\n')

// ---------------------------------------------------------
// TEST 2: Uncapped List & Full Coverage (No .slice(0, 25))
// ---------------------------------------------------------
console.log('Test 2: Verifying NO .slice(0, 25) or truncation on missing skills...')
// Total missing should be exactly 14 skills (Tableau, dbt, BigQuery, AWS, Databricks, Airflow, Looker, PostgreSQL, Spark, Docker, Kubernetes, Kafka, Jira, Git)
assert.strictEqual(alignment.missingMarketSkillsRanked.length, 14, `Expected 14 missing skills, got ${alignment.missingMarketSkillsRanked.length}`)
assert.strictEqual(alignment.missingFromResume.length, 14, `Expected 14 missingFromResume items, got ${alignment.missingFromResume.length}`)

// Target keywords should include ALL 19 market skills uncapped
assert.strictEqual(alignment.targetKeywords.length, 19, `Expected 19 target keywords, got ${alignment.targetKeywords.length}`)
console.log('✔ Test 2 Passed: Target keywords and missing skills lists are completely uncapped.\n')

// ---------------------------------------------------------
// TEST 3: 3-Tier Priority Classification (Red, Yellow, Grey)
// ---------------------------------------------------------
console.log('Test 3: Verifying 3-Tier Priority Color & Percentage Grouping...')

const redTier = alignment.missingMarketSkillsRanked.filter((s) => s.percentage >= 40)
const yellowTier = alignment.missingMarketSkillsRanked.filter((s) => s.percentage >= 20 && s.percentage < 40)
const greyTier = alignment.missingMarketSkillsRanked.filter((s) => s.percentage < 20)

// Red Tier (>40%): Tableau (50%), dbt (45%), BigQuery (42%)
assert.strictEqual(redTier.length, 3, 'Red tier should have 3 items')
for (const item of redTier) {
  assert.strictEqual(item.priority, 'HIGH')
  assert.strictEqual(item.priorityColor, 'red')
  assert(item.badge.includes('% of JDs'))
  assert(item.talkingScript.includes(item.keyword))
}

// Yellow Tier (20%-40%): AWS, Databricks, Apache Airflow, Looker, PostgreSQL, Apache Spark (6 items)
assert.strictEqual(yellowTier.length, 6, 'Yellow tier should have 6 items')
for (const item of yellowTier) {
  assert.strictEqual(item.priority, 'MEDIUM')
  assert.strictEqual(item.priorityColor, 'yellow')
}

// Grey Tier (10%-20%): Docker, Kubernetes, Kafka, Jira, Git (5 items)
assert.strictEqual(greyTier.length, 5, 'Grey tier should have 5 items')
for (const item of greyTier) {
  assert.strictEqual(item.priority, 'LOW')
  assert.strictEqual(item.priorityColor, 'grey')
}

console.log('✔ Test 3 Passed: Missing skills accurately classified into Red (>40%), Yellow (20%-40%), and Grey (10%-20%).\n')

// ---------------------------------------------------------
// TEST 4: Scorecard Pass-Through (Uncapped)
// ---------------------------------------------------------
console.log('Test 4: Verifying resumeScorecard passes uncapped missingMarketSkillsRanked...')
const scorecard = computeScorecard({
  canonicalResume: mockCandidate,
  precomputedSignals: {},
  issues: [],
  strengths: [],
  targetRole: 'Data Analyst',
  marketProfile: mockMarketProfile,
})

assert(scorecard.keywordAlignment, 'scorecard must have keywordAlignment')
assert.strictEqual(
  scorecard.keywordAlignment.missingMarketSkillsRanked.length,
  14,
  'Scorecard keywordAlignment.missingMarketSkillsRanked must have all 14 items uncapped'
)
console.log('✔ Test 4 Passed: Scorecard delivers full uncapped missingMarketSkillsRanked to dashboard.\n')

console.log('ALL UNCAPPED MISSING SKILLS & REVERSE MATCHING TESTS PASSED! 🚀')
