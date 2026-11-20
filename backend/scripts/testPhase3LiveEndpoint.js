/**
 * Live End-to-End Test for POST /api/resume-agent/confirm-metric
 */

import dotenv from 'dotenv'
dotenv.config({ path: './backend/.env' })
dotenv.config({ path: '.env' })
import { generateUserToken } from '../utils/userAuth.js'

async function testEndpoint() {
  const dummyUserId = '673cd7a5f1e8a2b3c4d5e6f7'
  const token = generateUserToken(dummyUserId)

  console.log('--- TEST 1: POST /api/resume-agent/confirm-metric (Calculator Mode) ---')
  const payload1 = {
    userId: dummyUserId,
    bulletId: 'exp_001_b01',
    originalText: 'Responsible for optimizing database queries and backend API endpoints.',
    currentRewrite: 'Optimized PostgreSQL database queries and backend API endpoints to enhance throughput.',
    targetRole: 'Senior Backend Engineer',
    metricLabel: 'Query Latency Reduction',
    mode: 'calculator',
    baselineValue: '1200',
    finalValue: '400',
    unit: 'ms',
  }

  const res1 = await fetch('http://localhost:5000/api/resume-agent/confirm-metric', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload1),
  })

  const data1 = await res1.json()
  console.log('HTTP Status:', res1.status)
  console.log('Response:', JSON.stringify(data1, null, 2))

  if (res1.status !== 200 || !data1.success) {
    console.error('❌ Test 1 Failed!')
    process.exit(1)
  }

  if (data1.evidenceStatus !== 'CALCULATED') {
    console.error('❌ Test 1 evidenceStatus is not CALCULATED:', data1.evidenceStatus)
    process.exit(1)
  }

  if (!data1.rewrittenText.includes('67%')) {
    console.error('❌ Test 1 rewrittenText does not include 67%:', data1.rewrittenText)
    process.exit(1)
  }

  if (data1.rewrittenText.includes('[ADD:')) {
    console.error('❌ Test 1 contains [ADD: placeholder:', data1.rewrittenText)
    process.exit(1)
  }

  console.log('✅ Test 1 Passed! Rewritten bullet:', data1.rewrittenText)

  console.log('\n--- TEST 2: POST /api/resume-agent/confirm-metric (Direct Mode) ---')
  const payload2 = {
    userId: dummyUserId,
    bulletId: 'exp_001_b02',
    originalText: 'Built customer onboarding funnel in React and TypeScript.',
    currentRewrite: 'Architected and deployed customer onboarding funnel in React and TypeScript.',
    targetRole: 'Senior Full Stack Engineer',
    metricLabel: 'Funnel Conversion Rate',
    mode: 'direct',
    directMetric: '35%',
    unit: '%',
  }

  const res2 = await fetch('http://localhost:5000/api/resume-agent/confirm-metric', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload2),
  })

  const data2 = await res2.json()
  console.log('HTTP Status:', res2.status)
  console.log('Response:', JSON.stringify(data2, null, 2))

  if (res2.status !== 200 || !data2.success) {
    console.error('❌ Test 2 Failed!')
    process.exit(1)
  }

  if (data2.evidenceStatus !== 'CANDIDATE_CONFIRMED') {
    console.error('❌ Test 2 evidenceStatus is not CANDIDATE_CONFIRMED:', data2.evidenceStatus)
    process.exit(1)
  }

  if (!data2.rewrittenText.includes('35%')) {
    console.error('❌ Test 2 rewrittenText does not include 35%:', data2.rewrittenText)
    process.exit(1)
  }

  console.log('✅ Test 2 Passed! Rewritten bullet:', data2.rewrittenText)
  console.log('\n🎉 ALL LIVE ENDPOINT TESTS PASSED CLEANLY!')
}

testEndpoint().catch((err) => {
  console.error('Live test error:', err)
  process.exit(1)
})
