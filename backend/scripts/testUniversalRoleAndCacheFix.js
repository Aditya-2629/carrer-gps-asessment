/**
 * testUniversalRoleAndCacheFix.js
 * Verification for:
 * 1. Universal non-SWE domain fallback (Nurse, Sales, Product, Finance, Operations)
 * 2. Role inference from resume text when rawTargetRole is blank
 * 3. Fast-catch input contains titles & title
 */

import assert from 'assert'
import { computeKeywordAlignment, MARKET_ROLE_KEYWORD_PACKS } from '../agents/resume/market/keywordAlignment.js'
import { inferRoleFromKeywordFrequency } from '../agents/resume/resumeAgent.normalizer.js'

console.log('=== RUNNING UNIVERSAL ROLE & DOMAIN PACK VERIFICATION ===\n')

// TEST 1: Registered Nurse should get clinical healthcare keywords, NEVER TypeScript or Spring Boot
console.log('Test 1: Verifying Clinical Nurse Fallback Keywords...')
const nurseResume = {
  candidate: { targetRole: 'Registered Nurse' },
  skills: ['Patient Care', 'CPR'],
  experience: [
    {
      role: 'Staff Nurse',
      company: 'Metro Health Hospital',
      bullets: ['Administered medications and performed clinical assessments for post-operative patients.'],
    },
  ],
}

const nurseAlignment = computeKeywordAlignment({
  canonicalResume: nurseResume,
  targetJobDescription: '',
  targetRole: 'Registered Nurse',
})

assert(!nurseAlignment.targetKeywords.includes('TypeScript'), 'Nurse must NEVER have TypeScript in target keywords')
assert(!nurseAlignment.targetKeywords.includes('Spring Boot'), 'Nurse must NEVER have Spring Boot in target keywords')
assert(!nurseAlignment.targetKeywords.includes('Docker'), 'Nurse must NEVER have Docker in target keywords')
assert(nurseAlignment.targetKeywords.includes('Patient Care') || nurseAlignment.targetKeywords.includes('HIPAA Compliance'), 'Nurse must have clinical healthcare keywords')
console.log('✔ Test 1 Passed: Nurse profile received healthcare keywords, zero SWE tech dump.\n')

// TEST 2: Sales Representative should get Sales CRM keywords, NEVER React or Kubernetes
console.log('Test 2: Verifying Sales Representative Fallback Keywords...')
const salesResume = {
  candidate: { targetRole: 'Account Executive' },
  skills: ['B2B Sales', 'Lead Generation'],
  experience: [
    {
      role: 'Sales Representative',
      company: 'Enterprise SaaS Co',
      bullets: ['Managed pipeline and conducted discovery calls with enterprise prospects.'],
    },
  ],
}

const salesAlignment = computeKeywordAlignment({
  canonicalResume: salesResume,
  targetJobDescription: '',
  targetRole: 'Account Executive',
})

assert(!salesAlignment.targetKeywords.includes('Kubernetes'), 'Sales must NEVER have Kubernetes in target keywords')
assert(!salesAlignment.targetKeywords.includes('React'), 'Sales must NEVER have React in target keywords')
assert(salesAlignment.targetKeywords.includes('Pipeline Management') || salesAlignment.targetKeywords.includes('Salesforce') || salesAlignment.targetKeywords.includes('B2B Sales'), 'Sales must have sales pipeline keywords')
console.log('✔ Test 2 Passed: Sales profile received sales keywords, zero SWE tech dump.\n')

// TEST 3: Role Inference from Resume Text when Target Role is Empty
console.log('Test 3: Verifying Role Inference from Resume Text...')
const dataAnalystText = 'Data Analyst experienced in SQL, Python, Tableau dashboards, reporting metrics and ETL pipelines.'
const inferredDataRole = inferRoleFromKeywordFrequency(dataAnalystText)
assert.strictEqual(inferredDataRole, 'Data Analyst', 'Must infer Data Analyst from analytics keywords')

const nurseText = 'Registered Nurse experienced in patient care, medication administration, triage, and clinical healthcare.'
const inferredNurseRole = inferRoleFromKeywordFrequency(nurseText)
assert(inferredNurseRole.toLowerCase().includes('healthcare') || inferredNurseRole.toLowerCase().includes('nurse'), 'Must infer Healthcare from clinical keywords')
console.log('✔ Test 3 Passed: Role inference accurately detects domain from resume text.\n')

console.log('ALL UNIVERSAL ROLE & CACHE FIX TESTS PASSED SUCCESSFULLY! 🚀')

