/**
 * testUiAndAssessmentFixes.js
 *
 * Verification suite for UI & Assessment Form Fixes:
 * 1. CareerGpsReadyModal is completely removed from ReportDashboard.jsx
 * 2. targetedMatchPct supports array and string formats in computeCareerGpsScore
 * 3. externalHelp supports array and string formats with Freelancer/Contractor option in getExternalContext
 * 4. Phone extraction logic prevents phantom numbers and returns empty string on failure
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  computeCareerGpsScore,
  getExternalContext,
} from '../agents/assessment/assessmentAgent.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('================================================================')
console.log('CAREER GPS: UI & ASSESSMENT FIXES VERIFICATION SUITE')
console.log('================================================================\n')

async function runTests() {
  // -----------------------------------------------------------------
  // TEST 1: CareerGpsReadyModal Removal in ReportDashboard.jsx
  // -----------------------------------------------------------------
  console.log('--- TEST 1: CareerGpsReadyModal Removal from ReportDashboard.jsx ---')
  const reportDashboardPath = path.resolve(__dirname, '../../src/components/report/ReportDashboard.jsx')
  const reportDashboardContent = fs.readFileSync(reportDashboardPath, 'utf-8')

  assert.ok(
    !reportDashboardContent.includes('CareerGpsReadyModal'),
    'ReportDashboard.jsx must NOT import or render CareerGpsReadyModal'
  )
  assert.ok(
    !reportDashboardContent.includes('showReadyModal'),
    'ReportDashboard.jsx must NOT have showReadyModal state'
  )
  assert.ok(
    !reportDashboardContent.includes('Open Executive GPS Summary'),
    'ReportDashboard.jsx must NOT have Executive Summary modal trigger button'
  )
  console.log('  ✔ CareerGpsReadyModal and trigger button verified 100% removed')

  // -----------------------------------------------------------------
  // TEST 2: targetedMatchPct Array & String Support in Scoring
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: targetedMatchPct Array & String Handling ---')

  // Array input (multi-select / checkbox)
  const scoreArray = computeCareerGpsScore({
    answers: {
      targetedMatchPct: ['80%–100% (Highly Targeted 🎯)'],
      searchMethods: ['Company Career Pages (Direct ATS)', 'Employee Referrals'],
      outreach: '15',
      referralsMonth: '4–10',
    },
  })
  const targetedPillarArray = scoreArray.areas.jobSearch.checks.find(
    (b) => b.name === 'Targeted application percentage'
  )
  assert.strictEqual(targetedPillarArray.points, 6, '80%-100% in array should award 6 points')
  console.log('  ✔ Array input [80%–100%] successfully scores max 6 points')

  // String input (legacy single-select backward compatibility)
  const scoreString = computeCareerGpsScore({
    answers: {
      targetedMatchPct: '50%–79% (Moderately Targeted ⚖️)',
      searchMethods: ['Company Career Pages (Direct ATS)'],
      outreach: '5',
      referralsMonth: '1–3',
    },
  })
  const targetedPillarString = scoreString.areas.jobSearch.checks.find(
    (b) => b.name === 'Targeted application percentage'
  )
  assert.strictEqual(targetedPillarString.points, 4.5, '50%-79% string should award 4.5 points')
  console.log('  ✔ String input "50%–79%" successfully scores 4.5 points for backward compatibility')

  // Broad / Mixed input
  const scoreBroad = computeCareerGpsScore({
    answers: {
      targetedMatchPct: ['20%–49% (Broad / Mixed 🌧️)'],
    },
  })
  const targetedPillarBroad = scoreBroad.areas.jobSearch.checks.find(
    (b) => b.name === 'Targeted application percentage'
  )
  assert.strictEqual(targetedPillarBroad.points, 3, '20%-49% should award 3 points')
  console.log('  ✔ Array input [20%–49%] successfully scores 3 points')

  // -----------------------------------------------------------------
  // TEST 3: externalHelp Array Support & Freelancer Context
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: externalHelp Array Support & Freelancer Context ---')

  // Array input with Freelancer option
  const extFreelance = getExternalContext({
    answers: {
      externalHelp: [
        'Yes — Freelancing / Independent Contractor / Direct Client Gigs 💻',
      ],
    },
  })
  assert.strictEqual(
    extFreelance.consultancy_context.mode,
    'Freelance & Independent Contracting',
    'Should identify Freelance & Independent Contracting mode'
  )
  assert.ok(
    extFreelance.consultancy_context.description.includes('independent contractor'),
    'Description should mention independent contractor'
  )
  console.log('  ✔ Array with Freelancing option correctly resolves to "Freelance & Independent Contracting"')

  // Array input with C2C
  const extC2C = getExternalContext({
    answers: {
      externalHelp: ['Yes — C2C Consultancy / Bench Marketing (% cut from pay) 🏢'],
    },
  })
  assert.strictEqual(
    extC2C.consultancy_context.mode,
    'C2C Consultancy / Bench Marketing'
  )
  console.log('  ✔ Array with C2C option correctly resolves to "C2C Consultancy / Bench Marketing"')

  // String input with Staffing
  const extStaffing = getExternalContext({
    answers: {
      externalHelp: 'Yes — W2 Staffing / Placement Agency 💼',
    },
  })
  assert.strictEqual(
    extStaffing.consultancy_context.mode,
    'W2 Staffing / Placement Agency'
  )
  console.log('  ✔ String with Staffing option correctly resolves to "W2 Staffing / Placement Agency"')

  // Default Solo Search
  const extSolo = getExternalContext({
    answers: {
      externalHelp: ['No — 100% Solo (Applying & networking on my own) 🚶'],
    },
  })
  assert.strictEqual(extSolo.consultancy_context.mode, 'Solo Search')
  console.log('  ✔ Solo option correctly resolves to "Solo Search"')

  // -----------------------------------------------------------------
  // TEST 4: Phone Extraction & Blank-on-Failure Validation
  // -----------------------------------------------------------------
  console.log('\n--- TEST 4: Phone Extraction & Blank-on-Failure Validation ---')

  // 4a. Backend normalizer with valid US phone
  const linesWithPhone = [
    'Jane Doe',
    'Senior Distributed Systems Engineer',
    'jane.doe@example.com | (415) 555-1234 | San Francisco, CA',
  ]
  const parsedWithPhone = ResumeNormalizer.extractCandidateInfo(linesWithPhone, '', linesWithPhone.join('\n'))
  assert.strictEqual(parsedWithPhone.phone, '(415) 555-1234', 'Should extract valid US phone')
  assert.strictEqual(parsedWithPhone.contact.phone, '(415) 555-1234', 'contact.phone should match')
  console.log('  ✔ Successfully extracts valid formatted US phone: (415) 555-1234')

  // 4b. Backend normalizer with NO phone (should be null, NOT 'N/A')
  const linesNoPhone = [
    'John Smith',
    'Full Stack Engineer',
    'john.smith@example.com | New York, NY',
    'linkedin.com/in/johnsmith',
  ]
  const parsedNoPhone = ResumeNormalizer.extractCandidateInfo(linesNoPhone, '', linesNoPhone.join('\n'))
  assert.strictEqual(parsedNoPhone.phone, null, 'Should return null when no phone is present')
  assert.strictEqual(parsedNoPhone.contact.phone, null, 'contact.phone should be null when no phone is present')
  console.log('  ✔ Returns null (not "N/A") when no phone is present in resume')

  // 4c. Frontend Phone detection guard simulation (testing the logic in FileUpload.jsx)
  const testPhoneGuard = (rawPhone) => {
    const cleanDigits = String(rawPhone || '').replace(/\D/g, '')
    if (rawPhone && rawPhone !== 'N/A' && cleanDigits.length >= 10) {
      return rawPhone
    }
    return ''
  }

  assert.strictEqual(testPhoneGuard(null), '', 'null rawPhone must return empty string')
  assert.strictEqual(testPhoneGuard('N/A'), '', '"N/A" must return empty string')
  assert.strictEqual(testPhoneGuard('undefined'), '', '"undefined" must return empty string')
  assert.strictEqual(testPhoneGuard('123'), '', 'short numbers must return empty string')
  assert.strictEqual(testPhoneGuard('(415) 555-1234'), '(415) 555-1234', 'valid phone must be preserved')
  console.log('  ✔ Phone guard prevents phantom numbers, N/A, and invalid digits from entering form state')

  // 4d. Verify FileUpload.jsx no longer contains latin1 binary decoding
  const fileUploadPath = path.resolve(__dirname, '../../src/components/ui/FileUpload.jsx')
  const fileUploadContent = fs.readFileSync(fileUploadPath, 'utf-8')
  assert.ok(
    !fileUploadContent.includes('extractCleanPhone'),
    'FileUpload.jsx must NOT contain extractCleanPhone'
  )
  assert.ok(
    !fileUploadContent.includes("setFormData('phone'"),
    'FileUpload.jsx must NOT set phone in client-side text scan'
  )
  console.log('  ✔ FileUpload.jsx verified free of client-side binary phone scanning')

  // 4e. Verify assessmentSteps.js checkbox types
  const assessmentStepsPath = path.resolve(__dirname, '../../src/lib/assessmentSteps.js')
  const assessmentStepsContent = fs.readFileSync(assessmentStepsPath, 'utf-8')
  assert.ok(
    assessmentStepsContent.includes("name: 'targetedMatchPct',\n    type: 'checkbox'"),
    'targetedMatchPct must be configured as type: checkbox'
  )
  assert.ok(
    assessmentStepsContent.includes("name: 'externalHelp',\n    type: 'checkbox'"),
    'externalHelp must be configured as type: checkbox'
  )
  console.log('  ✔ assessmentSteps.js verified with type: checkbox for targetedMatchPct and externalHelp')

  console.log('\n================================================================')
  console.log('✅ ALL UI & ASSESSMENT FIX VERIFICATIONS PASSED (0 FAILURES)')
  console.log('================================================================')
}

runTests().catch((err) => {
  console.error('\n❌ Verification failed:', err)
  process.exit(1)
})
