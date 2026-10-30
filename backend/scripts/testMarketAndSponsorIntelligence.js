import { analyzeMarketJdCorpus } from '../agents/resume/market/marketJdAnalyzer.js'
import { getCompanySponsorStatus, VERIFIED_SPONSOR_REGISTRY } from '../utils/sponsorIntelligence.js'

console.log('=== TEST 1: SPONSOR INTELLIGENCE ===')
const testCompanies = [
  'PwC',
  'PricewaterhouseCoopers LLP',
  'Shure Incorporated',
  'KPIT Technologies',
  'Amazon Web Services',
  'Deloitte Consulting',
  'Random Unknown Startup Inc',
  ''
]

for (const comp of testCompanies) {
  const status = getCompanySponsorStatus(comp)
  console.log(`[Company: "${comp}"] -> Verified: ${status.isVerified}, Tier: ${status.tier}, Approvals: ${status.approvals}`)
}

if (!getCompanySponsorStatus('PwC').isVerified) throw new Error('PwC should be verified')
if (!getCompanySponsorStatus('Shure').isVerified) throw new Error('Shure should be verified')
if (!getCompanySponsorStatus('KPIT').isVerified) throw new Error('KPIT should be verified')
if (getCompanySponsorStatus('Random Unknown Startup Inc').isVerified) throw new Error('Random startup should not be verified')
console.log('✔ Sponsor Intelligence test PASSED.')

console.log('\n=== TEST 2: STATISTICAL MARKET JD ANALYZER ===')
const mockJds = [
  `Senior Data Analyst role requiring strong SQL, Python, Snowflake, and dbt. Must be proficient in Power BI dashboards and dimensional data modeling.`,
  `Business Intelligence Engineer: Expert in SQL, Python, Tableau, and Snowflake. Experience with Airflow, ETL pipelines, and Git.`,
  `Data Analyst with 4+ years of experience in SQL, Excel, Power BI, and statistical analysis. A/B testing and Snowflake experience preferred.`,
  `Analytics Engineer: dbt, Snowflake, SQL, Python, Git. Knowledge of BigQuery and data modeling.`
]

const candidateSkills = ['SQL', 'Excel', 'Tableau']
const startTime = performance.now()
const result = analyzeMarketJdCorpus(mockJds, candidateSkills)
const duration = performance.now() - startTime

console.log(`Execution time: ${duration.toFixed(2)}ms (0 LLM cost)`)
console.log('Total Analyzed:', result.totalAnalyzed)
console.log('Top Demanded Skills:', result.topDemandedSkills)
console.log('Missing High-Demand Skills:', result.missingHighDemandSkills)
console.log('Top Tool Pairings:', result.topToolPairings)

if (result.totalAnalyzed !== 4) throw new Error('Expected 4 analyzed JDs')
if (result.topDemandedSkills.length === 0) throw new Error('Expected top demanded skills')
if (!result.missingHighDemandSkills.some(s => s.tool === 'Python' || s.tool === 'Snowflake')) {
  throw new Error('Expected Python or Snowflake in missing high-demand skills')
}
console.log('✔ Statistical Market JD Analyzer test PASSED.')
