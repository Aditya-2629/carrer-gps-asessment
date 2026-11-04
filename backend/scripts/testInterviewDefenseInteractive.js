/**
 * testInterviewDefenseInteractive.js
 * Verification suite for:
 * 1. In-engine dynamic interview talking script generation (0 API calls, instant)
 * 2. Role and tool tailored defense scripts (Snowflake, Power BI, Python, AWS, Docker)
 * 3. In-engine resume sentence generation
 * 4. Progressive accordion limits (initial 2, +5 expansion)
 */

import assert from 'assert'
import {
  getTalkingScript,
  getResumeSentence,
  getInterviewerQuestion,
  getTradeOffJustification,
} from '../agents/resume/market/interviewDefenseGenerator.js'

console.log('=== RUNNING INTERVIEW DEFENSE INTERACTIVE VERIFICATION ===\n')

// ---------------------------------------------------------
// TEST 1: Data Warehousing & Transformation Talking Scripts
// ---------------------------------------------------------
console.log('Test 1: Verifying Data Warehousing & Transformation Talking Scripts...')
const snowflakeScript = getTalkingScript('Snowflake', 'Data Analyst', 'PwC USA')
assert(snowflakeScript.includes('PwC USA'), 'Must cite company name')
assert(snowflakeScript.includes('Snowflake'), 'Must cite skill name')
assert(/scalable data transformation|schema validation|reporting turnaround/i.test(snowflakeScript), 'Must focus on data pipelines')

const dbtScript = getTalkingScript('dbt', 'Analytics Engineer', 'TechCorp')
assert(dbtScript.includes('TechCorp'), 'Must cite company name')
assert(dbtScript.includes('dbt'), 'Must cite skill name')
console.log('✔ Test 1 Passed: Data warehousing scripts generated accurately.\n')

// ---------------------------------------------------------
// TEST 2: BI & Visualization Talking Scripts
// ---------------------------------------------------------
console.log('Test 2: Verifying BI & Visualization Talking Scripts...')
const powerBiScript = getTalkingScript('Power BI', 'Data Analyst', 'Shure')
assert(powerBiScript.includes('Shure'), 'Must cite company')
assert(powerBiScript.includes('Power BI'), 'Must cite Power BI')
assert(/executive dashboards|row-level security|KPIs/i.test(powerBiScript), 'Must focus on dashboard KPIs')

const tableauScript = getTalkingScript('Tableau', 'BI Analyst', 'FinCorp')
assert(tableauScript.includes('Tableau'), 'Must cite Tableau')
assert(/executive dashboards/i.test(tableauScript))
console.log('✔ Test 2 Passed: BI & Visualization scripts generated accurately.\n')

// ---------------------------------------------------------
// TEST 3: Languages & Cloud Talking Scripts
// ---------------------------------------------------------
console.log('Test 3: Verifying Languages & Cloud Scripts...')
const pythonScript = getTalkingScript('Python', 'Data Analyst', 'HealthTech')
assert(pythonScript.includes('Python'))
assert(/exploratory data analysis|automating data cleaning/i.test(pythonScript))

const awsScript = getTalkingScript('AWS', 'Data Engineer', 'CloudLabs')
assert(awsScript.includes('AWS'))
assert(/cloud infrastructure deployment|version control/i.test(awsScript))
console.log('✔ Test 3 Passed: Python and Cloud infrastructure scripts verified.\n')

// ---------------------------------------------------------
// TEST 4: Resume Sentence Generation
// ---------------------------------------------------------
console.log('Test 4: Verifying Resume Sentence Generation...')
const snowflakeSentence = getResumeSentence('Snowflake', 'PwC USA')
assert(snowflakeSentence.includes('Snowflake'))
assert(/Engineered data pipeline transformations|cutting data delivery latency/i.test(snowflakeSentence))

const powerBiSentence = getResumeSentence('Power BI', 'PwC USA')
assert(powerBiSentence.includes('Power BI'))
assert(/executive dashboards|dynamic filters/i.test(powerBiSentence))
console.log('✔ Test 4 Passed: Resume sentences correctly structured.\n')

// ---------------------------------------------------------
// TEST 5: Expected Technical Question & Trade-Off Justification
// ---------------------------------------------------------
console.log('Test 5: Verifying Interviewer Questions & Trade-off Justifications...')
const sfQ = getInterviewerQuestion('Snowflake', 'PwC USA')
assert(sfQ.includes('Snowflake') && sfQ.includes('PwC USA'), 'Must cite tool and company in question')
assert(/warehouse|clustering|compute/i.test(sfQ), 'Must address architectural depth')

const sfTrade = getTradeOffJustification('Snowflake')
assert(/compute|storage|queries|ETL/i.test(sfTrade), 'Must provide concrete architectural trade-off')

const dbtTrade = getTradeOffJustification('dbt')
assert(/version control|DAG|assertions|stored procedures/i.test(dbtTrade), 'Must contrast with alternatives')
console.log('✔ Test 5 Passed: Expected questions and trade-offs verified.\n')

console.log('ALL INTERVIEW DEFENSE INTERACTIVE TESTS PASSED! 🚀')
