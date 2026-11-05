/**
 * testPipelineCrashResistance.js
 *
 * Verification suite for Emergency Bugfix: Recursion, String Slicing & LLM Routing.
 * Validates:
 * 1. safeExtractString handles strings, nested objects, arrays, and undefined without throwing.
 * 2. deCycle strips circular references, Mongoose $ properties, and resumeContext without stack overflow.
 * 3. mapApifyPostsToCanonical creates pure POJOs without prototype leakage.
 * 4. Groq model fallback list uses active models (llama-3.3-70b-versatile, llama3-70b-8192).
 */

import assert from 'assert'
import { safeExtractString, buildThoughtLeadershipUserPrompt } from '../agents/linkedin/linkedinSynthesis.prompt.js'
import { deCycle } from '../services/reportGeneration.js'
import { mapApifyPostsToCanonical } from '../utils/apifyLinkedInPostsScraper.js'
import { PROVIDER_MODEL_FALLBACKS, PRODUCTION_FALLBACK_CHAIN } from '../ai/gateway/llmGateway.js'
import { getModel } from '../ai/config/modelRegistry.js'

console.log('================================================================')
console.log('CAREER GPS: PIPELINE CRASH RESISTANCE & ROUTING VERIFICATION')
console.log('================================================================\n')

async function runTests() {
  // -----------------------------------------------------------------
  // TEST 1: Defensive safeExtractString Handling
  // -----------------------------------------------------------------
  console.log('--- TEST 1: safeExtractString Defensive Coercion ---')

  assert.strictEqual(safeExtractString('Standard String'), 'Standard String')
  assert.strictEqual(safeExtractString(12345), '12345')
  assert.strictEqual(safeExtractString(null), '')
  assert.strictEqual(safeExtractString(undefined), '')
  assert.strictEqual(safeExtractString(['bullet 1', 'bullet 2']), 'bullet 1 bullet 2')
  assert.strictEqual(safeExtractString({ text: 'Object Text' }), 'Object Text')
  assert.strictEqual(safeExtractString({ description: 'Description Text' }), 'Description Text')
  assert.strictEqual(safeExtractString({ content: { text: 'Deeply Nested Text' } }), 'Deeply Nested Text')
  assert.strictEqual(safeExtractString({ summary: ['Nested Bullet 1', 'Nested Bullet 2'] }), 'Nested Bullet 1 Nested Bullet 2')
  assert.strictEqual(safeExtractString({}), '')

  // Non-primitive inputs that previously caused desc.slice is not a function
  const weirdPost = {
    description: { text: 'Architected distributed event bus processing 50k events/sec' },
    summary: ['Bullet 1', 'Bullet 2'],
    content: null,
  }
  const extracted = safeExtractString(weirdPost.description)
  assert.strictEqual(typeof extracted, 'string')
  assert.ok(extracted.slice(0, 20).length > 0)

  // Verify buildThoughtLeadershipUserPrompt with object descriptions in projects
  const promptUser = buildThoughtLeadershipUserPrompt({
    targetRole: 'Staff Distributed Systems Engineer',
    coreSkills: ['Kafka', 'Kubernetes'],
    projects: [
      {
        name: 'Event Ingestion Engine',
        description: { text: 'Scaled Kafka cluster handling 100k msgs/sec' },
        bullets: [{ text: 'Cut latency by 45%' }],
      },
    ],
    activitySignals: { recencyTier: 'Active', weeklyPostingCadence: 2 },
    recentPosts: [
      {
        id: 'post_1',
        content: { text: 'Excited to share our insights on high throughput Kafka streaming.' },
        likesCount: 42,
        commentsCount: 8,
      },
    ],
  })
  assert.ok(promptUser.includes('Scaled Kafka cluster'), 'Prompt should include extracted project description')
  assert.ok(promptUser.includes('Excited to share'), 'Prompt should include extracted post content')
  console.log('  ✔ safeExtractString handles primitive strings, numbers, arrays, objects, and nested content with zero slice crashes')

  // -----------------------------------------------------------------
  // TEST 2: Circular Reference Elimination via deCycle
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: deCycle Circular Reference & Stack Overflow Protection ---')

  const cyclicReport = {
    title: 'Executive Career Report',
    career_health_score: 84,
    scores: { resume: 80, linkedin: 85 },
  }
  // Inject intentional circular cycles
  cyclicReport.self = cyclicReport
  cyclicReport.nested = { parent: cyclicReport }
  cyclicReport.resumeContext = { cyclic: cyclicReport }
  cyclicReport.$__ = { mongooseInternal: true }
  cyclicReport._doc = { rawDoc: true }

  // deCycle must eliminate cycles without throwing "Maximum call stack size exceeded"
  const sanitized = deCycle(cyclicReport)
  assert.strictEqual(sanitized.title, 'Executive Career Report')
  assert.strictEqual(sanitized.career_health_score, 84)
  assert.strictEqual(sanitized.self, undefined, 'Circular reference must be stripped')
  assert.strictEqual(sanitized.resumeContext, undefined, 'resumeContext key must be stripped')
  assert.strictEqual(sanitized.$__, undefined, 'Mongoose internal $__ must be stripped')
  assert.strictEqual(sanitized._doc, undefined, 'Mongoose _doc must be stripped')

  // Must cleanly serialize with native JSON.stringify()
  const serialized = JSON.stringify(sanitized)
  assert.ok(typeof serialized === 'string')
  const parsedBack = JSON.parse(serialized)
  assert.strictEqual(parsedBack.scores.linkedin, 85)
  console.log('  ✔ deCycle strips circular loops, resumeContext, and Mongoose internals with zero stack overflow')

  // -----------------------------------------------------------------
  // TEST 3: Apify LinkedIn Posts Scraper POJO Sanitization
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: Apify LinkedIn Posts Scraper POJO Sanitization ---')

  const rawApifyItems = [
    {
      id: 'urn:li:activity:123456789',
      text: 'Deep dive into Kubernetes resource management and CPU throttling.',
      postedAt: '2026-10-15T12:00:00Z',
      url: 'https://linkedin.com/posts/activity-123456789',
      likesCount: 15,
      commentsCount: 3,
      repostsCount: 1,
      comments: [
        {
          id: 'c1',
          text: 'Great post on cgroups v2!',
          author: { name: 'Dev Lead', profileUrl: 'https://linkedin.com/in/devlead' },
        },
      ],
      author: {
        name: 'Alex Chen',
        headline: 'Staff SRE',
      },
    },
  ]

  const canonicalPosts = mapApifyPostsToCanonical(rawApifyItems, 'https://linkedin.com/in/alexchen')
  assert.strictEqual(canonicalPosts.totalPosts, 1)
  assert.strictEqual(canonicalPosts.totalLikes, 15)
  assert.strictEqual(canonicalPosts.posts[0].content, 'Deep dive into Kubernetes resource management and CPU throttling.')
  assert.strictEqual(canonicalPosts.posts[0].comments[0].authorName, 'Dev Lead')
  assert.strictEqual(typeof canonicalPosts.posts[0].engagement.likes, 'number')
  assert.strictEqual(canonicalPosts.author.name, 'Alex Chen')

  // Verify pure POJO serializability
  const postsJson = JSON.stringify(canonicalPosts)
  assert.ok(postsJson.includes('cgroups v2'))
  console.log('  ✔ mapApifyPostsToCanonical normalizes scraped posts into clean POJOs')

  // -----------------------------------------------------------------
  // TEST 4: Groq Model Fallbacks & Gateway TPM Protection
  // -----------------------------------------------------------------
  console.log('\n--- TEST 4: Groq Model Fallbacks & OpenRouter Priority ---')

  assert.strictEqual(PRODUCTION_FALLBACK_CHAIN[0], 'openrouter', 'Priority 1 must remain OpenRouter to protect TPM budget')
  assert.ok(
    PROVIDER_MODEL_FALLBACKS.groq.includes('llama-3.3-70b-versatile'),
    'Groq fallbacks must include active llama-3.3-70b-versatile endpoint'
  )
  assert.ok(
    PROVIDER_MODEL_FALLBACKS.groq.includes('llama3-70b-8192'),
    'Groq fallbacks must include llama3-70b-8192'
  )

  const groqModel = getModel('llama-3.3-70b-versatile')
  assert.ok(groqModel, 'llama-3.3-70b-versatile must be defined in MODEL_REGISTRY')
  assert.strictEqual(groqModel.provider, 'groq')

  const groqAlias = getModel('groq')
  assert.strictEqual(groqAlias.id, 'llama-3.3-70b-versatile')
  console.log('  ✔ Groq model registry and fallbacks updated to active endpoints (llama-3.3-70b-versatile, llama3-70b-8192)')

  console.log('\n================================================================')
  console.log('✅ ALL PIPELINE CRASH RESISTANCE & ROUTING TESTS PASSED (0 FAILURES)')
  console.log('================================================================')
}

runTests().catch((err) => {
  console.error('\n❌ Crash resistance test failed:', err)
  process.exit(1)
})

