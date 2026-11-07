/**
 * Test Suite: Admin Telemetry, Fallback Frequency & SmartKeyPool Quota Cockpit
 * Run: node --env-file=backend/.env backend/scripts/testAdminTelemetry.js
 */

import assert from 'node:assert'
import mongoose from 'mongoose'
import {
  getFallbackAndErrorAnalytics,
  getLlmCallsAndQuotas,
  purgeKeyCooldowns,
} from '../controllers/adminTelemetryController.js'
import { apifyKeyPool } from '../utils/smartKeyPool.js'
import AgentRun from '../models/AgentRun.js'
import User from '../models/User.js'

async function runTestSuite() {
  console.log('\n================================================================')
  console.log('RUNNING ADMIN TELEMETRY & OBSERVABILITY COCKPIT TESTS')
  console.log('================================================================\n')

  const mongoUri = process.env.MONGO_URI
  assert.ok(mongoUri, 'MONGO_URI must be defined in backend/.env')
  await mongoose.connect(mongoUri)
  console.log('[Test 1] Connected to MongoDB Atlas Cluster...')

  try {
    // ── Test 1: Fallbacks and Error Analytics ──
    console.log('\n[Test 2] Testing getFallbackAndErrorAnalytics...')
    let fallbackData = null
    const mockRes1 = {
      status(code) {
        assert.strictEqual(code, 200)
        return {
          json(d) {
            fallbackData = d
          },
        }
      },
    }

    await getFallbackAndErrorAnalytics({}, mockRes1)
    assert.ok(fallbackData.success, 'Response success is true')
    assert.ok(Array.isArray(fallbackData.fallbackTriggers), 'fallbackTriggers is an array')
    assert.ok(fallbackData.fallbackTriggers.length >= 2, 'Has at least 2 fallback triggers configured')
    assert.strictEqual(fallbackData.fallbackTriggers[0].from, 'typesafe/jev-1.14')
    assert.strictEqual(fallbackData.fallbackTriggers[0].to, 'google/gemini-2.5-flash-lite')
    assert.ok(Array.isArray(fallbackData.topFailingEndpoints), 'topFailingEndpoints is an array')
    assert.ok(fallbackData.userBottlenecks, 'userBottlenecks object returned')
    assert.strictEqual(typeof fallbackData.userBottlenecks.missingLinkedIn, 'number')
    assert.strictEqual(typeof fallbackData.userBottlenecks.unverifiedOtp, 'number')
    console.log('  ✓ 2.1 Fallback triggers and user error triage data verified cleanly.')

    // ── Test 2: LLM Calls & Quotas ──
    console.log('\n[Test 3] Testing getLlmCallsAndQuotas...')
    let llmData = null
    const mockRes2 = {
      status(code) {
        assert.strictEqual(code, 200)
        return {
          json(d) {
            llmData = d
          },
        }
      },
    }

    await getLlmCallsAndQuotas({}, mockRes2)
    assert.ok(llmData.success, 'Response success is true')
    assert.ok(llmData.summary, 'Summary object returned')
    assert.ok(llmData.summary.totalTokensBurned >= 0, 'Total tokens burned is a number')
    assert.ok(llmData.summary.p50LatencySec, 'p50LatencySec returned')
    assert.ok(llmData.summary.p95LatencySec, 'p95LatencySec returned')
    assert.ok(Array.isArray(llmData.costByModel), 'costByModel is an array')
    assert.ok(Array.isArray(llmData.detailedCalls), 'detailedCalls is an array')
    assert.ok(llmData.keyPools?.apify, 'Apify key pool quota telemetry returned')
    assert.ok(llmData.keyPools?.openRouter, 'OpenRouter telemetry returned')
    console.log(`  ✓ 3.1 LLM Telemetry aggregated with ${llmData.detailedCalls.length} granular audit records.`)
    console.log(`  ✓ 3.2 Live assessment spend: $${llmData.summary.avgCostPerRunUsd} / ${llmData.summary.avgCostPerRunInr}`)

    // ── Test 3: Purge Cooldowns ──
    console.log('\n[Test 4] Testing purgeKeyCooldowns...')
    // Inject a simulated cooldown
    apifyKeyPool.cooldowns.set('test_dummy_cooling_key', Date.now() + 600000)
    assert.strictEqual(apifyKeyPool.cooldowns.has('test_dummy_cooling_key'), true)

    let purgeData = null
    const mockRes3 = {
      status(code) {
        assert.strictEqual(code, 200)
        return {
          json(d) {
            purgeData = d
          },
        }
      },
    }

    await purgeKeyCooldowns({}, mockRes3)
    assert.ok(purgeData.success, 'Purge was successful')
    assert.ok(purgeData.purgedCount >= 1, 'At least 1 cooldown was purged')
    assert.strictEqual(apifyKeyPool.cooldowns.size, 0, 'All cooldowns cleared')
    console.log('  ✓ 4.1 1-Click cooldown purge executed and verified.')

    console.log('\n================================================================')
    console.log('ALL ADMIN TELEMETRY TESTS PASSED! 🚀')
    console.log('================================================================\n')
  } finally {
    await mongoose.disconnect()
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})
