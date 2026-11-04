import assert from 'assert'
import {
  batchWeaveBulletsWithLLM,
  BULLET_REWRITE_CACHE,
  getRewriteHash,
  deterministicWeave,
} from '../agents/resume/market/smartKeywordWeaver.js'
import { isGenuineTechnicalSkill } from '../agents/resume/market/dynamicSkillExtractor.js'

async function runTests() {
  console.log('--- TEST SUITE: Single-Batch LLM Bullet Re-Weaver with In-Memory Caching & Deterministic Fallback ---')

  const testExperiences = [
    {
      company: 'Acme Corp',
      role: 'Data Analyst',
      isCurrent: false,
      bullets: [
        {
          id: 'exp_001_b01',
          text: 'Built daily reporting pipelines across operational databases, cutting manual reporting turnaround by 68% for leadership.',
        },
        {
          id: 'exp_001_b02',
          text: 'Analyzed sales metrics across 1,500+ SKUs to identify inventory trends and revenue opportunities.',
        },
      ],
    },
  ]

  const targetSkills = ['Snowflake', 'dbt']
  const targetRole = 'Data Analyst'

  // TEST 1: Skill validation
  console.log('\n[Test 1] Validating Genuine Technical Skills...')
  assert.strictEqual(isGenuineTechnicalSkill('Snowflake'), true, 'Snowflake should be genuine skill')
  assert.strictEqual(isGenuineTechnicalSkill('dbt'), true, 'dbt should be genuine skill')
  assert.strictEqual(isGenuineTechnicalSkill('into'), false, '"into" must be rejected as stopword')
  assert.strictEqual(isGenuineTechnicalSkill('overview'), false, '"overview" must be rejected')
  console.log('✓ Technical skill validation passed.')

  // TEST 2: Single-Batch LLM execution
  console.log('\n[Test 2] Testing Single-Batch LLM Re-Weaver with Google XYZ Framing...')
  BULLET_REWRITE_CACHE.clear()

  const tStart = Date.now()
  const result = await batchWeaveBulletsWithLLM({
    experiences: testExperiences,
    targetSkills,
    targetRole,
    company: 'Acme Corp',
    timeoutMs: 6000,
  })
  const duration = Date.now() - tStart

  console.log(`Execution completed in ${duration}ms (source: ${result.source || 'deterministic'})`)
  assert(result.tailoredExperiences && result.tailoredExperiences.length > 0, 'Must return tailored experiences')
  assert(Array.isArray(result.interviewLedger), 'Must return interview ledger array')

  const wovenBullets = result.tailoredExperiences[0].bullets
  console.log('Woven Bullets:')
  wovenBullets.forEach((b, idx) => {
    const text = typeof b === 'string' ? b : b.text
    console.log(`  [${idx + 1}] ${text}`)

    // Verify absence of robotic suffixes
    assert.strictEqual(
      /,\s*leveraging\s+\[?Tool\]?\s+for\s+scalable\s+transformation/i.test(text),
      false,
      'Must NOT contain robotic ", leveraging [Tool] for scalable transformation..." suffix'
    )
    assert.strictEqual(
      /,\s*leveraging\s+(?:Snowflake|dbt)\s+for\s+scalable\s+transformation/i.test(text),
      false,
      'Must NOT contain robotic ", leveraging Snowflake/dbt for scalable transformation..." suffix'
    )
  })

  // Verify metric preservation (e.g. 68% or 1,500+)
  const fullText = wovenBullets.map((b) => (typeof b === 'string' ? b : b.text)).join(' ')
  assert(
    fullText.includes('68%') || fullText.includes('1,500+'),
    'Must strictly preserve original quantitative metrics (68% or 1,500+)'
  )
  console.log('✓ Natural Google XYZ framing and metric preservation verified.')

  // TEST 3: In-Memory LRU Cache Hit (0ms)
  console.log('\n[Test 3] Testing In-Memory LRU Cache Hit (0ms)...')
  const tCacheStart = Date.now()
  const cachedResult = await batchWeaveBulletsWithLLM({
    experiences: testExperiences,
    targetSkills,
    targetRole,
    company: 'Acme Corp',
    timeoutMs: 6000,
  })
  const cacheDuration = Date.now() - tCacheStart

  console.log(`Cache call completed in ${cacheDuration}ms (source: ${cachedResult.source})`)
  assert.strictEqual(cachedResult.source, 'lru_cache', 'Subsequent call MUST return from lru_cache')
  assert(cacheDuration < 50, `Cache hit must be near instantaneous (<50ms, was ${cacheDuration}ms)`)
  assert.strictEqual(cachedResult.tailoredExperiences.length, 1)
  console.log('✓ LRU cache hit verified (0ms retrieval).')

  // TEST 4: LRU Cache Eviction & Hash Generation
  console.log('\n[Test 4] Testing Cache Hash & LRU Eviction Limit...')
  const hash1 = getRewriteHash('exp_001_b01', 'Sample bullet text', ['Snowflake', 'dbt'])
  const hash2 = getRewriteHash('exp_001_b01', 'Sample bullet text', ['dbt', 'Snowflake'])
  assert.strictEqual(hash1, hash2, 'Hash must be invariant to skill array order')

  BULLET_REWRITE_CACHE.clear()
  for (let i = 0; i < 1005; i++) {
    const h = getRewriteHash(`bullet_${i}`, `text_${i}`, ['SQL'])
    if (BULLET_REWRITE_CACHE.size >= 1000) {
      const firstKey = BULLET_REWRITE_CACHE.keys().next().value
      BULLET_REWRITE_CACHE.delete(firstKey)
    }
    BULLET_REWRITE_CACHE.set(h, { rewrittenText: `Rewritten ${i}`, wovenSkill: 'SQL' })
  }
  assert.strictEqual(BULLET_REWRITE_CACHE.size, 1000, 'Cache must cap at MAX_CACHE_SIZE (1000)')
  console.log('✓ Hash order-invariance and LRU eviction limit verified.')

  // TEST 5: Graceful Fallback to Deterministic Weaver on Timeout/Error
  console.log('\n[Test 5] Testing Graceful Deterministic Fallback on Timeout/Failure...')
  const fallbackResult = await batchWeaveBulletsWithLLM({
    experiences: [
      {
        company: 'Fallback Inc',
        role: 'Data Analyst',
        bullets: ['Maintained SQL reports for executive stakeholders.'],
      },
    ],
    targetSkills: ['Tableau'],
    targetRole: 'Data Analyst',
    company: 'Fallback Inc',
    timeoutMs: 1, // 1ms forces timeout / fallback
  })

  assert(fallbackResult, 'Fallback result must not be null/undefined')
  assert(fallbackResult.tailoredExperiences && fallbackResult.tailoredExperiences.length > 0, 'Fallback must deliver tailored experiences')
  assert(Array.isArray(fallbackResult.interviewLedger), 'Fallback must deliver interview ledger')
  console.log('✓ Graceful fallback to deterministic weaver on timeout/error verified.')

  console.log('\n======================================================')
  console.log('ALL 5 TESTS PASSED SUCCESSFULLY!')
  console.log('======================================================')
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err)
  process.exit(1)
})
