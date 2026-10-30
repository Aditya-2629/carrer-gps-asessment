import assert from 'assert'
import { SmartKeyPool } from '../utils/smartKeyPool.js'

async function runTests() {
  console.log('--- TEST 1: Initialization & Key Deduplication ---')
  process.env.TEST_KEYS_LIST = 'key_A, key_B ; key_C'
  process.env.TEST_KEY_SINGLE = 'key_A' // duplicate
  process.env.TEST_KEY_1 = 'key_D'
  process.env.TEST_KEY_FALLBACK = 'key_E'

  const pool = new SmartKeyPool('TestService', {
    listEnv: 'TEST_KEYS_LIST',
    singleEnv: 'TEST_KEY_SINGLE',
    prefixes: ['TEST_KEY_'],
    cooldownMs: 5000,
  })

  assert.strictEqual(pool.getKeyCount(), 5)
  assert.strictEqual(pool.getActiveKey(), 'key_A')
  assert.deepStrictEqual(pool.getAllKeys(), ['key_A', 'key_B', 'key_C', 'key_D', 'key_E'])
  console.log('✓ Initialization passed.')

  console.log('\n--- TEST 2: Sticky Success & Queue Deprioritization Protocol ---')
  // Simulated keys: first is bad (rate limit), second is good
  const mockPool = new SmartKeyPool('MockApi', {
    cooldownMs: 60000,
  })
  mockPool.keys = ['invalid_test_key_123', 'real_valid_key_xyz']

  assert.strictEqual(mockPool.getActiveKey(), 'invalid_test_key_123')

  let callCount = 0
  const attemptedKeys = []

  // Execution 1: First key fails with 429 quota error, second key succeeds
  const res1 = await mockPool.executeWithRetry(async (key) => {
    callCount++
    attemptedKeys.push(key)
    if (key === 'invalid_test_key_123') {
      throw new Error('429 Resource has been exhausted (e.g. check quota)')
    }
    return { ok: true, usedKey: key }
  })

  assert.strictEqual(res1.ok, true)
  assert.strictEqual(res1.usedKey, 'real_valid_key_xyz')
  assert.strictEqual(callCount, 2)
  assert.deepStrictEqual(attemptedKeys, ['invalid_test_key_123', 'real_valid_key_xyz'])

  // Check state after Execution 1:
  // 'real_valid_key_xyz' must now be primary (index 0) due to Sticky Success!
  // 'invalid_test_key_123' must be at the end of queue with active cooldown
  assert.strictEqual(mockPool.getActiveKey(), 'real_valid_key_xyz')
  assert.deepStrictEqual(mockPool.getAllKeys(), ['real_valid_key_xyz', 'invalid_test_key_123'])
  console.log('✓ Sticky Success verified: real_valid_key_xyz is now PRIMARY at index 0.')
  console.log('✓ Deprioritization verified: invalid_test_key_123 moved to END of queue.')

  console.log('\n--- TEST 3: Subsequent Operation Starts With Promoted Key ---')
  const attemptedKeys2 = []
  let callCount2 = 0

  const res2 = await mockPool.executeWithRetry(async (key) => {
    callCount2++
    attemptedKeys2.push(key)
    return { ok: true, data: 'second_task_success', key }
  })

  assert.strictEqual(res2.ok, true)
  assert.strictEqual(res2.key, 'real_valid_key_xyz')
  assert.strictEqual(callCount2, 1) // Only called ONCE, directly using sticky primary key!
  assert.deepStrictEqual(attemptedKeys2, ['real_valid_key_xyz'])
  console.log('✓ Second task immediately used promoted key without trying failed key.')

  console.log('\n--- TEST 4: Cooldown Handling When All Keys Cool Down ---')
  // If only 1 key is configured and fails, retry still attempts it if no non-cooling alternatives exist
  const singleKeyPool = new SmartKeyPool('SingleKeyService', { cooldownMs: 10000 })
  singleKeyPool.keys = ['only_key_1']
  let attempts = 0
  try {
    await singleKeyPool.executeWithRetry(async (k) => {
      attempts++
      throw new Error('401 Unauthorized: Invalid token')
    })
    assert.fail('Expected error')
  } catch (err) {
    assert(err.message.includes('All 1 key(s) failed'))
  }
  assert.strictEqual(attempts, 1)
  console.log('✓ Single key pool failure handled gracefully.')

  console.log('\n========================================')
  console.log(' ALL SMART KEY POOL TESTS PASSED (4/4)! ')
  console.log('========================================')
}

runTests().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
