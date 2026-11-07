import assert from 'assert'
import { calculateLeadMetrics } from '../controllers/adminLeadController.js'
import { runtimeEngineConfig } from '../controllers/adminDynamicController.js'
import { apifyKeyPool } from '../utils/smartKeyPool.js'

console.log('================================================================')
console.log('RUNNING ENTERPRISE ADMIN COMMAND CENTER UNIT & INTEGRATION TESTS')
console.log('================================================================')

// Test 1: calculateLeadMetrics - Recruiter Ready Candidate
console.log('\n[Test 1] Testing Recruiter Ready Lead Metrics Calculation...')
const recruiterReadyUser = {
  _id: '672bd8f12345678901234567',
  email: 'haswanth@example.com',
  isVerified: true,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  resumeData: Buffer.from('mock pdf'),
  resumeName: 'Haswanth_Valluru_Resume.pdf',
  resumeJson: {
    candidate: { name: 'Haswanth Valluru', linkedin: 'https://linkedin.com/in/haswanth' },
    target_role: 'Data Analyst',
    skills: ['Python', 'SQL', 'Tableau'],
  },
  aiReport: {
    career_health_score: 82,
    resume_agent: {
      dashboard: { score: 85 },
      keywordAlignment: {
        matchedKeywords: ['Python', 'SQL', 'Tableau'],
        missingKeywords: ['Snowflake', 'dbt'],
      },
    },
    linkedin_agent: {
      score: 79,
      crossAudit: { discrepancies: [{ issue: 'Minor title difference' }] },
    },
  },
}

const lead1 = calculateLeadMetrics(recruiterReadyUser)
assert.strictEqual(lead1.leadTier, 'RECRUITER_READY', 'Tier must be RECRUITER_READY for high score')
assert.strictEqual(lead1.candidateName, 'Haswanth Valluru')
assert.strictEqual(lead1.targetRole, 'Data Analyst')
assert.strictEqual(lead1.overallScore, 82)
assert.strictEqual(lead1.resumeScore, 85)
assert.strictEqual(lead1.discrepancyCount, 1)
assert(lead1.intentScore >= 50 && lead1.intentScore <= 99, 'Intent score must be in valid range')
assert(lead1.personalizedPitch.includes('impressive 82/100'), 'Pitch must include score')
assert(lead1.personalizedPitch.includes('Data Analyst'), 'Pitch must include target role')
console.log('  ✓ 1.1 Recruiter-ready classification verified with intent score:', lead1.intentScore)
console.log('  ✓ 1.2 Pitch generated:', lead1.personalizedPitch)

// Test 2: calculateLeadMetrics - Coaching Hot Candidate
console.log('\n[Test 2] Testing Coaching Hot Lead Metrics Calculation...')
const coachingHotUser = {
  _id: '672bd8f98765432109876543',
  email: 'struggling_cand@gmail.com',
  isVerified: false,
  createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
  resumeData: Buffer.from('mock pdf'),
  resumeName: 'Resume_Draft.pdf',
  resumeJson: {
    candidate: { name: 'Alex Rivera' },
    target_role: 'Cloud Architect',
  },
  aiReport: {
    career_health_score: 58,
    resume_agent: {
      dashboard: { score: 55 },
      keywordAlignment: {
        missingKeywords: ['Terraform', 'Kubernetes', 'AWS IAM', 'CloudWatch', 'Ansible'],
      },
    },
  },
}

const lead2 = calculateLeadMetrics(coachingHotUser)
assert.strictEqual(lead2.leadTier, 'COACHING_HOT', 'Tier must be COACHING_HOT for low ATS score')
assert(lead2.intentScore >= 60, 'Low ATS score + multiple missing keywords must yield high intent score')
assert(lead2.personalizedPitch.includes('missing key high-demand keywords'), 'Pitch must address ATS gaps')
assert(lead2.whatsappPitch.includes('Alex'), 'WhatsApp hook must include first name')
console.log('  ✓ 2.1 Coaching-hot classification verified with high intent score:', lead2.intentScore)
console.log('  ✓ 2.2 WhatsApp hook generated:', lead2.whatsappPitch)

// Test 3: Zero-Restart Dynamic Engine Sliders
console.log('\n[Test 3] Testing Zero-Restart Engine Slider Runtime Mutation...')
const initialFastCatch = runtimeEngineConfig.fastCatchTargetJds
runtimeEngineConfig.fastCatchTargetJds = 45
assert.strictEqual(runtimeEngineConfig.fastCatchTargetJds, 45, 'fastCatchTargetJds must be mutable in-memory')
runtimeEngineConfig.fastCatchTargetJds = initialFastCatch
console.log('  ✓ 3.1 Live in-memory slider mutation confirmed without restart')

// Test 4: Dynamic SmartKeyPool Key Injection with Sticky Promotion
console.log('\n[Test 4] Testing SmartKeyPool Dynamic Injection & Sticky Promotion...')
const testToken = 'apify_test_token_live_12345'
const initialCount = apifyKeyPool.getKeyCount()
const success = apifyKeyPool.addKey(testToken, true)
assert.strictEqual(success, true)
assert.strictEqual(apifyKeyPool.getActiveKey(), testToken, 'Injected key with promotion must become active primary')
assert.strictEqual(apifyKeyPool.getKeyCount(), initialCount + 1)
console.log('  ✓ 4.1 Key injected and immediately promoted to index 0 (Sticky Success)')

console.log('\n================================================================')
console.log('ALL ENTERPRISE ADMIN BACKEND TESTS PASSED! 🚀')
console.log('================================================================')
