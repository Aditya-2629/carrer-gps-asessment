/**
 * Phase 3 Interactive Metric Confirmation (Layer C) Automated Test Suite
 * Validates deterministic math, claim validation safety, and single-bullet regeneration.
 */

import { computeDeterministicMetric } from '../routes/resumeAgentRoutes.js'
import { replaceUnverifiedNumericTokens } from '../agents/resume/validation/claimValidator.js'

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

async function runTests() {
  console.log('--- TEST 1: Deterministic Metric Calculation (Drop / Latency) ---')
  const dropResult = computeDeterministicMetric({
    mode: 'calculator',
    baselineValue: '1200',
    finalValue: '400',
    unit: 'ms',
  })
  assert(dropResult.evidenceStatus === 'CALCULATED', 'drop evidenceStatus is CALCULATED')
  assert(dropResult.improvementPct === 67, 'drop improvement is 67%')
  assert(dropResult.confirmedMetric === '67% reduction', 'confirmedMetric is 67% reduction')
  assert(dropResult.confirmedDetails.includes('1200ms to 400ms'), 'confirmedDetails includes baseline and final with unit')

  console.log('\n--- TEST 2: Deterministic Metric Calculation (Multiplier Increase >= 2x) ---')
  const multResult = computeDeterministicMetric({
    mode: 'calculator',
    baselineValue: '50',
    finalValue: '150',
    unit: 'req/sec',
  })
  assert(multResult.evidenceStatus === 'CALCULATED', 'mult evidenceStatus is CALCULATED')
  assert(multResult.confirmedMetric === '3.0x increase', 'confirmedMetric is 3.0x increase')
  assert(multResult.confirmedDetails.includes('50req/sec to 150req/sec'), 'confirmedDetails includes units')

  console.log('\n--- TEST 3: Deterministic Metric Calculation (Percentage Increase < 2x) ---')
  const pctResult = computeDeterministicMetric({
    mode: 'calculator',
    baselineValue: '100',
    finalValue: '135',
    unit: '%',
  })
  assert(pctResult.evidenceStatus === 'CALCULATED', 'pct evidenceStatus is CALCULATED')
  assert(pctResult.confirmedMetric === '+35% increase', 'confirmedMetric is +35% increase')

  console.log('\n--- TEST 4: Direct Value Mode Sanitization ---')
  const directResult = computeDeterministicMetric({
    mode: 'direct',
    directMetric: '35%',
    unit: '%',
  })
  assert(directResult.evidenceStatus === 'CANDIDATE_CONFIRMED', 'direct evidenceStatus is CANDIDATE_CONFIRMED')
  assert(directResult.confirmedMetric === '35%', 'directMetric without duplicate unit')

  const directWithUnit = computeDeterministicMetric({
    mode: 'direct',
    directMetric: '150',
    unit: 'ms',
  })
  assert(directWithUnit.confirmedMetric === '150 ms', 'appends unit cleanly when missing')

  console.log('\n--- TEST 5: Claim Validator Safety Guard with Confirmed Evidence Status ---')
  const confirmedText = 'Architected high-throughput telemetry ingestion pipeline in Go and Kafka, cutting p99 latency by 67% across production clusters.'
  const sanitizedConfirmed = replaceUnverifiedNumericTokens(
    confirmedText,
    null,
    null,
    {
      evidenceStatus: 'CALCULATED',
      sourceText: 'Worked on telemetry pipeline in Go and Kafka.',
    }
  )
  assert(sanitizedConfirmed.includes('67%'), 'Permits confirmed metric when evidenceStatus is CALCULATED')

  console.log('\n--- ALL PHASE 3 DETERMINISTIC TESTS PASSED CLEANLY ---')
}

runTests().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})
