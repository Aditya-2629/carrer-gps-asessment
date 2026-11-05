/**
 * Test Suite for LinkedIn Activity & Engagement Signal Engine
 * (backend/agents/linkedin/linkedinActivityEngine.js)
 *
 * Verifies:
 * 1. Active profile metrics (recency tier, cadence, cadence health).
 * 2. Engagement & amplification calculations (likes, comments, reposts, original & media ratios).
 * 3. Substance vs fluff heuristics and scoring.
 * 4. Target role domain alignment with seniority stripping and core skills matching.
 * 5. Outbound commenting and networking activity.
 * 6. Ghost profile & dormant profile detection (> 90 days or 0 posts).
 * 7. Defensive resilience on null, undefined, malformed, and unscraped payloads.
 * 8. Performance benchmark (< 5ms latency guarantee).
 */

import {
  extractLinkedInActivitySignals,
  parseTimestampSafely,
  matchTokenInText,
} from '../agents/linkedin/linkedinActivityEngine.js'

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    throw new Error(message)
  }
  console.log(`  ✅ PASSED: ${message}`)
}

console.log('====================================================')
console.log('🧪 Starting LinkedIn Activity Engine Test Suite')
console.log('====================================================\n')

// Helper for generating relative dates
const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()

// ----------------------------------------------------
// Test 1: Date Parser & Keyword Token Matcher
// ----------------------------------------------------
console.log('Test 1: parseTimestampSafely and matchTokenInText helper verification')

assert(parseTimestampSafely(null) === null, 'null returns null')
assert(parseTimestampSafely('invalid-date') === null, 'invalid string returns null')
assert(parseTimestampSafely(1730000000000) === 1730000000000, 'ms timestamp preserved')
assert(parseTimestampSafely(1730000000) === 1730000000000, 'sec timestamp converted to ms')
assert(typeof parseTimestampSafely('2026-10-01T12:00:00Z') === 'number', 'ISO string parsed')
assert(parseTimestampSafely({ timestamp: 1730000000000 }) === 1730000000000, 'nested object timestamp parsed')

assert(matchTokenInText('node.js', 'We built this with Node.js and Redis'), 'Matches punctuated node.js')
assert(matchTokenInText('node.js', 'We built this with nodejs and Redis'), 'Matches nodejs alias')
assert(matchTokenInText('aws', 'Deployed on AWS cloud infra'), 'Matches AWS case-insensitively')
assert(!matchTokenInText('python', 'We built this with Node.js and Redis'), 'Does not match absent token')
assert(!matchTokenInText('java', 'Javascript is popular'), 'Does not falsely match Java in Javascript')

// ----------------------------------------------------
// Test 2: Active Profile with High Cadence & Strong Alignment
// ----------------------------------------------------
console.log('\nTest 2: Active profile with optimal cadence, media, substance, and domain alignment')

const mockActiveData = {
  available: true,
  isGhostProfile: false,
  posts: [
    {
      id: 'p1',
      text: 'Architected high-throughput message streaming with Node.js and Kafka handling 50k events/sec. Implemented distributed partitioning and backpressure regulation across our microservices architecture.',
      postedAt: now - 2 * DAY_MS, // 2 days ago
      likesCount: 45,
      commentsCount: 8,
      repostsCount: 5,
      isRepost: false,
      media: [{ type: 'image', url: 'https://cdn.example.com/arch.png' }],
    },
    {
      id: 'p2',
      text: 'Deep dive into PostgreSQL connection pooling and indexing strategies under high concurrency. Here are 4 query optimization techniques we used to reduce p99 latency by 65%.',
      postedAt: now - 5 * DAY_MS, // 5 days ago
      likesCount: 80,
      commentsCount: 14,
      repostsCount: 12,
      isRepost: false,
      images: ['https://cdn.example.com/chart.png'],
    },
    {
      id: 'p3',
      text: 'Configured automated AWS ECS Fargate deployment pipelines with Terraform and Docker. Consistent zero-downtime blue/green rollouts have simplified our releases drastically.',
      postedAt: now - 12 * DAY_MS, // 12 days ago
      likesCount: 30,
      commentsCount: 4,
      repostsCount: 2,
      isRepost: false,
      document: { name: 'slides.pdf' },
    },
    {
      id: 'p4',
      text: 'Great article on distributed consensus algorithms. Worth a read!',
      postedAt: now - 18 * DAY_MS, // 18 days ago
      likesCount: 10,
      commentsCount: 1,
      repostsCount: 0,
      isRepost: true,
    },
  ],
  comments: [
    {
      id: 'c1',
      text: 'Completely agree on using connection pooling proxies like PgBouncer for handling sudden traffic spikes without starving database worker threads.',
      likesCount: 4,
    },
    {
      id: 'c2',
      text: 'Have you benchmarked Kafka consumer group rebalances with cooperative sticky assignors? It made a huge difference in our multi-partition throughput.',
      likesCount: 6,
    },
  ],
}

const targetRole = 'Staff Backend Systems Engineer'
const coreSkills = ['Node.js', 'Kafka', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes']

const activeSignals = extractLinkedInActivitySignals(mockActiveData, targetRole, coreSkills)

assert(activeSignals.status === 'active', 'Status is "active"')
assert(activeSignals.available === true, 'Available is true')
assert(activeSignals.isGhostProfile === false, 'isGhostProfile is false')
assert(activeSignals.postsAnalyzedCount === 4, 'postsAnalyzedCount is 4')
assert(activeSignals.daysSinceLastPost === 2, 'daysSinceLastPost is 2 days')
assert(activeSignals.recencyTier === 'Highly Active', 'recencyTier is "Highly Active"')
assert(activeSignals.weeklyPostingCadence >= 1.0, 'weeklyPostingCadence is >= 1.0')
assert(activeSignals.cadenceHealth === 'Optimal', 'cadenceHealth is "Optimal"')

// Engagement checks
assert(activeSignals.engagement.totalEngagements === (45+8+5) + (80+14+12) + (30+4+2) + (10+1+0), 'totalEngagements sum is correct')
assert(activeSignals.engagement.avgLikes === 41.3, `avgLikes is 41.3 (got ${activeSignals.engagement.avgLikes})`)
assert(activeSignals.engagement.originalPostRatio === 0.75, 'originalPostRatio is 0.75 (3 out of 4)')
assert(activeSignals.engagement.mediaRichRatio === 0.75, 'mediaRichRatio is 0.75 (3 out of 4)')

// Substance checks
assert(activeSignals.substance.substantivePostsCount === 3, 'substantivePostsCount is 3')
assert(activeSignals.substance.fluffIndicatorCount === 0, 'fluffIndicatorCount is 0')
assert(activeSignals.substance.substanceScore === 75, `substanceScore is 75 (got ${activeSignals.substance.substanceScore})`)

// Domain alignment checks
assert(activeSignals.domainAlignment.domainKeywordOverlapScore >= 60, `domainKeywordOverlapScore is high (${activeSignals.domainAlignment.domainKeywordOverlapScore})`)
assert(activeSignals.domainAlignment.matchedKeywords.includes('Node.js'), 'Node.js matched')
assert(activeSignals.domainAlignment.matchedKeywords.includes('Kafka'), 'Kafka matched')
assert(activeSignals.domainAlignment.matchedKeywords.includes('PostgreSQL'), 'PostgreSQL matched')
assert(activeSignals.domainAlignment.matchedKeywords.includes('AWS'), 'AWS matched')
assert(activeSignals.domainAlignment.missingCoreKeywords.includes('Kubernetes'), 'Kubernetes is missing from posts')

// Outbound comments
assert(activeSignals.networking.outboundCommentsCount === 2, 'outboundCommentsCount is 2')
assert(activeSignals.networking.hasActiveDiscussions === true, 'hasActiveDiscussions is true (both comments >= 60 chars)')
assert(activeSignals.networking.avgOutboundCommentLength > 100, 'avgOutboundCommentLength is substantive')

// ----------------------------------------------------
// Test 3: Fluff & Platitude Detection
// ----------------------------------------------------
console.log('\nTest 3: Fluff and platitude detection with low substance score')

const mockFluffData = {
  available: true,
  posts: [
    {
      id: 'f1',
      text: 'Happy Monday everyone! The grind never stops. Do you agree?',
      postedAt: now - 1 * DAY_MS,
      likesCount: 5,
    },
    {
      id: 'f2',
      text: 'Excited to announce that I have reached 5,000 connections! What do you think about networking on LinkedIn? Thoughts?',
      postedAt: now - 3 * DAY_MS,
      likesCount: 12,
    },
    {
      id: 'f3',
      text: 'Humbled and honored by this inspirational quote of the day. Positive vibes only! Type AGREE in the comments.',
      postedAt: now - 6 * DAY_MS,
      likesCount: 8,
    },
  ],
  comments: [],
}

const fluffSignals = extractLinkedInActivitySignals(mockFluffData, 'Software Engineer', ['React', 'TypeScript'])
assert(fluffSignals.substance.substantivePostsCount === 0, '0 substantive posts (all < 160 chars)')
assert(fluffSignals.substance.fluffIndicatorCount === 3, `All 3 posts detected as fluff (got ${fluffSignals.substance.fluffIndicatorCount})`)
assert(fluffSignals.substance.substanceScore === 0, 'substanceScore is 0')
assert(fluffSignals.domainAlignment.domainKeywordOverlapScore <= 20, 'Very low domain alignment score')

// ----------------------------------------------------
// Test 4: Ghost Profile (0 Posts)
// ----------------------------------------------------
console.log('\nTest 4: Ghost profile with 0 posts')

const mockGhostData = {
  available: true,
  isGhostProfile: true,
  posts: [],
  comments: [],
}

const ghostSignals = extractLinkedInActivitySignals(mockGhostData, 'Senior Product Manager', ['Agile', 'Roadmapping'])
assert(ghostSignals.status === 'ghost_profile', 'Status is "ghost_profile"')
assert(ghostSignals.isGhostProfile === true, 'isGhostProfile is true')
assert(ghostSignals.postsAnalyzedCount === 0, 'postsAnalyzedCount is 0')
assert(ghostSignals.daysSinceLastPost === null, 'daysSinceLastPost is null')
assert(ghostSignals.recencyTier === 'Dormant', 'recencyTier is "Dormant"')
assert(ghostSignals.weeklyPostingCadence === 0, 'weeklyPostingCadence is 0')
assert(ghostSignals.cadenceHealth === 'Dormant', 'cadenceHealth is "Dormant"')
assert(ghostSignals.domainAlignment.domainKeywordOverlapScore === 0, 'domainKeywordOverlapScore is 0')
assert(ghostSignals.domainAlignment.missingCoreKeywords.length === 2, 'All core skills marked missing')

// ----------------------------------------------------
// Test 5: Dormant Profile (> 90 Days Inactive)
// ----------------------------------------------------
console.log('\nTest 5: Dormant profile (> 90 days inactive)')

const mockDormantData = {
  available: true,
  isGhostProfile: false,
  posts: [
    {
      id: 'd1',
      text: 'Old post from several months ago describing an achievement in software engineering.',
      postedAt: now - 120 * DAY_MS, // 120 days ago
      likesCount: 10,
    },
  ],
  comments: [],
}

const dormantSignals = extractLinkedInActivitySignals(mockDormantData, 'Senior Developer', ['Java', 'Spring Boot'])
assert(dormantSignals.isGhostProfile === true, 'isGhostProfile is true due to > 90 days dormant')
assert(dormantSignals.status === 'ghost_profile', 'Status is "ghost_profile"')
assert(dormantSignals.recencyTier === 'Dormant', 'recencyTier is "Dormant"')
assert(dormantSignals.daysSinceLastPost >= 119, 'daysSinceLastPost is ~120 days')
assert(dormantSignals.cadenceHealth === 'Dormant', 'cadenceHealth is "Dormant"')

// ----------------------------------------------------
// Test 6: Defensive Resilience (null, undefined, malformed inputs)
// ----------------------------------------------------
console.log('\nTest 6: Defensive resilience against null, undefined, malformed inputs')

const nullResult = extractLinkedInActivitySignals(null, null, null)
assert(nullResult.status === 'unscraped', 'null activityData returns status "unscraped"')
assert(nullResult.available === false, 'available is false')
assert(nullResult.isGhostProfile === true, 'isGhostProfile is true')
assert(nullResult.postsAnalyzedCount === 0, 'postsAnalyzedCount is 0')
assert(nullResult.daysSinceLastPost === null, 'daysSinceLastPost is null')
assert(nullResult.engagement.totalEngagements === 0, 'totalEngagements is 0')
assert(nullResult.substance.substanceScore === 0, 'substanceScore is 0')

const malformedData = {
  available: true,
  posts: [null, undefined, 'not-an-object', { id: 'p_bad', text: null, postedAt: 'invalid' }],
  comments: ['invalid-comment', null],
}
const malformedResult = extractLinkedInActivitySignals(malformedData, { title: 'Lead Architect' }, [null, 123, 'React'])
assert(malformedResult.status === 'active', 'Filters out bad items safely')
assert(malformedResult.postsAnalyzedCount === 1, 'Only 1 valid post object kept')
assert(malformedResult.daysSinceLastPost === null, 'Handled invalid date safely')
assert(malformedResult.networking.outboundCommentsCount === 0, '0 valid comments kept')

// ----------------------------------------------------
// Test 7: Performance Benchmark (< 5ms Latency Guarantee)
// ----------------------------------------------------
console.log('\nTest 7: Performance benchmark (< 5ms latency guarantee)')

const ITERATIONS = 100
const startTime = performance.now()

for (let i = 0; i < ITERATIONS; i++) {
  extractLinkedInActivitySignals(mockActiveData, targetRole, coreSkills)
}

const totalTimeMs = performance.now() - startTime
const avgTimeMs = totalTimeMs / ITERATIONS

console.log(`  ⏱️ Executed ${ITERATIONS} iterations in ${totalTimeMs.toFixed(2)}ms (Avg: ${avgTimeMs.toFixed(3)}ms / call)`)
assert(avgTimeMs < 5.0, `Average execution time is under 5ms (actual: ${avgTimeMs.toFixed(3)}ms)`)
assert(avgTimeMs < 1.0, `Ultra-fast optimization passed (< 1ms target: ${avgTimeMs.toFixed(3)}ms)`)

console.log('\n====================================================')
console.log('🎉 ALL 7 TESTS IN LINKEDIN ACTIVITY ENGINE PASSED!')
console.log('====================================================')

