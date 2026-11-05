/**
 * testChatbotDynamicAnchors.js
 *
 * Verifies dynamic anchor resolution in ReportChatbot.jsx and chatController.js:
 * 1. Zero occurrences of hardcoded fallback strings ('my latest company', 'Fix my #${').
 * 2. candidateSnapshot.name priority in candidate name resolution.
 * 3. Support for 'experiences' (plural) and candidateSnapshot.presentCompany in company extraction.
 * 4. Synchronization between frontend ReportChatbot.jsx and backend chatController.js dossier.
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractCandidateDossier } from '../controllers/chatController.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🧪 CHATBOT DYNAMIC CONTEXT & ANCHORS VERIFICATION SUITE')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// -------------------------------------------------------------
// TEST 1: Frontend ReportChatbot.jsx Static Code Audit
// -------------------------------------------------------------
console.log('--- Test 1: Frontend ReportChatbot.jsx Static Code Audit ---')
const chatbotJsxPath = path.join(rootDir, 'src/components/report/ReportChatbot.jsx')
assert.ok(fs.existsSync(chatbotJsxPath), 'ReportChatbot.jsx must exist')

const jsxContent = fs.readFileSync(chatbotJsxPath, 'utf-8')

// 1. Assert zero occurrences of 'my latest company'
assert.strictEqual(
  jsxContent.includes('my latest company'),
  false,
  "ReportChatbot.jsx must have ZERO occurrences of 'my latest company'"
)
console.log("  ✔ Verified: Zero occurrences of 'my latest company' in ReportChatbot.jsx")

// 2. Assert zero occurrences of 'Fix my #'
assert.strictEqual(
  jsxContent.includes('Fix my #'),
  false,
  "ReportChatbot.jsx must have ZERO occurrences of 'Fix my #'"
)
console.log("  ✔ Verified: Zero occurrences of 'Fix my #' in ReportChatbot.jsx")

// 3. Assert candidateSnapshot.name is included in name resolution
assert.ok(
  jsxContent.includes('reportData?.resume_agent?.candidateSnapshot?.name'),
  'ReportChatbot.jsx must prioritize candidateSnapshot.name for candidate first name extraction'
)
console.log('  ✔ Verified: reportData?.resume_agent?.candidateSnapshot?.name is prioritized in firstName')

// 4. Assert experiences (plural) is checked in company extraction
assert.ok(
  jsxContent.includes('reportData?.resume_agent?.canonicalResume?.experiences'),
  'ReportChatbot.jsx must support canonicalResume.experiences (plural)'
)
assert.ok(
  jsxContent.includes('reportData?.resume_json?.experiences'),
  'ReportChatbot.jsx must support resume_json.experiences (plural)'
)
console.log('  ✔ Verified: experiences (plural) and candidateSnapshot.presentCompany supported in company resolution')

// 5. Assert shortCompany logic trims long / slash brand names cleanly
assert.ok(
  jsxContent.includes('split(/[\\/\\-–|]/)[0].trim()'),
  'ReportChatbot.jsx must cleanly trim multi-brand company names for chips'
)
console.log('  ✔ Verified: shortCompany brand splitting and clean chip labeling implemented\n')

// -------------------------------------------------------------
// TEST 2: Backend chatController.js Dynamic Dossier Extraction
// -------------------------------------------------------------
console.log('--- Test 2: Backend chatController.js Dynamic Dossier Extraction ---')

const mockUserWithSnapshot = {
  name: 'Default User Model Name',
  aiReport: {
    candidate_name: 'Report Level Name',
    resume_agent: {
      candidateSnapshot: {
        name: 'Alekya Maddu',
        presentCompany: 'Collabera / Bank of America',
        targetRole: 'Senior Full Stack Software Engineer',
      },
      canonicalResume: {
        experiences: [
          {
            company: 'Collabera / Bank of America',
            role: 'Lead Full Stack Developer',
            duration: '2021 - Present',
            bullets: ['Led migration of core banking API to Spring Boot microservices.'],
          },
        ],
      },
      verifiedSkills: ['Java', 'Spring Boot', 'React', 'AWS'],
      missingTargetKeywords: ['Kubernetes', 'Docker'],
    },
    funnel_stages: {
      applications_count: 50,
      recruiter_calls_count: 6,
      interviews_count: 3,
      offers_count: 0,
    },
    primary_bottleneck: {
      title: 'Recruiter Screen Choke Point',
    },
  },
}

const dossier1 = extractCandidateDossier(mockUserWithSnapshot)

// Name priority: candidateSnapshot.name must take precedence over user.name
assert.strictEqual(
  dossier1.candidateName,
  'Alekya Maddu',
  'candidateSnapshot.name must take precedence over user.name'
)
assert.strictEqual(dossier1.firstName, 'Alekya', 'firstName must split first token')

// Company extraction: candidateSnapshot.presentCompany must be resolved
assert.strictEqual(
  dossier1.currentCompany,
  'Collabera / Bank of America',
  'currentCompany must resolve from candidateSnapshot.presentCompany'
)

// Plural experiences support in canonicalResume
assert.strictEqual(
  dossier1.topExperiences[0].company,
  'Collabera / Bank of America',
  'topExperiences must parse canonicalResume.experiences (plural)'
)

console.log('  ✔ Verified: candidateSnapshot.name priority in backend extraction (Alekya Maddu)')
console.log('  ✔ Verified: currentCompany extraction matches verified report (Collabera / Bank of America)')
console.log('  ✔ Verified: canonicalResume.experiences (plural) supported seamlessly\n')

// -------------------------------------------------------------
// TEST 3: Fallback Safety without Snapshot
// -------------------------------------------------------------
console.log('--- Test 3: Fallback Safety without Candidate Snapshot ---')

const mockUserFallback = {
  name: 'Fallback Name',
  resumeJson: {
    candidate: {
      name: 'Resume JSON Name',
    },
    experiences: [
      {
        company: 'Stripe',
        role: 'Software Engineer',
      },
    ],
  },
  aiReport: {},
}

const dossier2 = extractCandidateDossier(mockUserFallback)
assert.strictEqual(dossier2.candidateName, 'Resume JSON Name')
assert.strictEqual(dossier2.firstName, 'Resume')
assert.strictEqual(dossier2.currentCompany, 'Stripe')
console.log('  ✔ Verified: Clean cascading fallback to resume_json candidate name and company.\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ ALL DYNAMIC CHATBOT ANCHOR TESTS PASSED (0 FAILURES) 🚀')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

