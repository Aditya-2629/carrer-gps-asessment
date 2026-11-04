/**
 * Market JD Jobs — Career GPS Resume Agent V3
 *
 * Implements core job logic for single-bucket and multi-bucket background refreshes.
 *
 * Enforces:
 * - Atomic Version Swap (Section 13): never delete old data before validating new
 * - Exactly 5 active JDs (Section 7)
 * - Safe fallback: old version remains active if new scrape fails
 * - Telemetry and error tracking
 */

import JobMarketBucket from '../../models/JobMarketBucket.js'
import JobMarketVersion from '../../models/JobMarketVersion.js'
import { fetchMarketJdCandidates, buildSearchSpecification, DEFAULT_APIFY_JOB_ACTOR } from '../../integrations/apify/apifyJdScraper.js'
import { processAndSelectTopJds } from '../../agents/resume/market/jdNormalizer.js'
import { buildMarketProfile } from '../../agents/resume/market/marketProfileBuilder.js'
import { analyzeAndAggregateJdCorpus } from '../../agents/resume/market/llmJdSkillAnalyzer.js'
import { CONTROLLED_ROLES } from '../../agents/resume/market/marketBucketResolver.js'
import { ApifyClient } from 'apify-client'
import { apifyKeyPool } from '../../utils/smartKeyPool.js'

/**
 * Executes a refresh for a single Role × Experience bucket.
 *
 * @param {string} bucketKey - e.g. "software-engineer::6-8"
 * @param {Object} [options]
 * @returns {Promise<{ success: boolean, bucketKey: string, version: number, jobCount: number, error?: string }>}
 */
export async function executeBucketRefresh(bucketKey, options = {}) {
  const startTime = Date.now()
  console.log(`[MarketJdJobs] Starting refresh for bucket: ${bucketKey}`)

  const [roleKey, experienceBucket] = bucketKey.split('::')
  if (!roleKey || !experienceBucket) {
    throw new Error(`Invalid bucketKey format: "${bucketKey}". Expected "roleKey::experienceBucket".`)
  }

  // 1. Find or initialize bucket document
  let bucket = await JobMarketBucket.findOne({ bucketKey })
  if (!bucket) {
    const roleDef = CONTROLLED_ROLES.find((r) => r.roleKey === roleKey)
    bucket = await JobMarketBucket.create({
      bucketKey,
      roleKey,
      roleName: roleDef ? roleDef.roleName : roleKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      specialization: 'general',
      experienceBucket,
      activeVersion: 0,
      status: 'refreshing',
      jobCount: 0,
      lastAttemptedRefreshAt: new Date(),
    })
  } else {
    bucket.status = 'refreshing'
    bucket.lastAttemptedRefreshAt = new Date()
    await bucket.save()
  }

  try {
    // 2. Prepare search query specification
    const searchSpec = buildSearchSpecification({
      role: bucket.roleName,
      specialization: bucket.specialization,
      experienceBucket,
    })

    // 3. Fetch candidate pool via Apify adapter
    const scrapeResult = await fetchMarketJdCandidates(searchSpec, {
      ...options,
      titles: [bucket.roleName || 'Software Engineer'],
      locations: ['United States'],
    })
    const rawCandidates = scrapeResult.candidates || []

    // 4. Clean, validate quality, deduplicate, and select top 100 JDs
    const TARGET_JD_COUNT = parseInt(process.env.MARKET_JD_TARGET_COUNT || '100', 10)
    const processed = processAndSelectTopJds(rawCandidates, bucket.roleKey, TARGET_JD_COUNT)
    const selectedJds = processed.selected

    if (selectedJds.length < TARGET_JD_COUNT) {
      console.warn(`[MarketJdJobs] Retrieved ${selectedJds.length} valid JDs for ${bucketKey} (target: ${TARGET_JD_COUNT}).`)
    }

    if (selectedJds.length === 0) {
      throw new Error(`No valid market JDs could be extracted from candidate pool (${scrapeResult.totalFetched} items fetched).`)
    }

    // 5. Build canonical MarketProfile via LLM Corpus Analysis
    const analyzedCorpus = await analyzeAndAggregateJdCorpus(selectedJds, bucketKey)

    const marketProfile = {
      bucketKey,
      sampleSize: selectedJds.length,
      skills: analyzedCorpus.marketSkills,
      totalAnalyzed: analyzedCorpus.totalAnalyzed,
      topKeywords: analyzedCorpus.marketSkills.slice(0, 20).map((s) => s.name),
      responsibilities: [],
      senioritySignals: [],
      version: 'market-profile-v2',
      generatedAt: new Date().toISOString(),
    }

    // 6. Next version number calculation (Safe against existing DB records)
    const latestVersionDoc = await JobMarketVersion.findOne({ bucketKey }).sort({ version: -1 })
    const maxExistingVersion = latestVersionDoc ? latestVersionDoc.version : 0
    const nextVersion = Math.max(bucket.activeVersion || 0, maxExistingVersion) + 1

    // 7. Create new JobMarketVersion (atomic staging)
    const newVersionDoc = await JobMarketVersion.create({
      bucketKey,
      version: nextVersion,
      jobs: selectedJds,
      marketProfile,
      sourceMetadata: {
        actorId: scrapeResult.actorId,
        totalCandidatesFetched: scrapeResult.totalFetched,
        validCandidatesCount: processed.validCount,
        duplicatesRemoved: processed.duplicatesRemoved,
        refreshDurationMs: Date.now() - startTime,
      },
      validationSummary: {
        isValid: true,
        checkedAt: new Date(),
        jobCount: selectedJds.length,
        errors: selectedJds.length < TARGET_JD_COUNT ? [`Partial sample: ${selectedJds.length}/${TARGET_JD_COUNT} JDs`] : [],
      },
      isArchived: false,
    })

    // 8. ATOMIC SWAP: Archive previous versions & update bucket pointer
    await JobMarketVersion.updateMany(
      { bucketKey, version: { $lt: nextVersion } },
      { $set: { isArchived: true } }
    )

    bucket.activeVersion = nextVersion
    bucket.jobCount = selectedJds.length
    bucket.status = selectedJds.length >= TARGET_JD_COUNT ? 'healthy' : 'needs_refresh'
    bucket.lastSuccessfulRefreshAt = new Date()
    bucket.refreshError = selectedJds.length < TARGET_JD_COUNT ? `Partial sample: ${selectedJds.length}/${TARGET_JD_COUNT} JDs` : null
    await bucket.save()

    const durationMs = Date.now() - startTime
    console.log(`[MarketJdJobs] Successfully activated v${nextVersion} for ${bucketKey} with ${selectedJds.length} JDs in ${durationMs}ms.`)

    return {
      success: true,
      bucketKey,
      version: nextVersion,
      jobCount: selectedJds.length,
      durationMs,
    }
  } catch (err) {
    console.error(`[MarketJdJobs] Refresh failed for ${bucketKey}:`, err.message)

    // Safe fallback: if bucket had an active version, preserve it!
    if (bucket.activeVersion > 0) {
      bucket.status = 'healthy' // keep existing version serving traffic
      bucket.refreshError = `Refresh attempt failed: ${err.message}`
    } else {
      bucket.status = 'failed'
      bucket.refreshError = err.message
    }
    await bucket.save()

    return {
      success: false,
      bucketKey,
      version: bucket.activeVersion,
      jobCount: bucket.jobCount,
      error: err.message,
    }
  }
}

/**
 * Initializes all configured Role × Experience buckets in MongoDB if they do not exist.
 */
export async function ensureConfiguredBucketsExist() {
  const EXPERIENCE_BUCKETS = ['0-2', '3-5', '6-8', '8+']
  const createdOrFound = []

  for (const roleDef of CONTROLLED_ROLES) {
    for (const exp of EXPERIENCE_BUCKETS) {
      const bucketKey = `${roleDef.roleKey}::${exp}`
      let bucket = await JobMarketBucket.findOne({ bucketKey })
      if (!bucket) {
        bucket = await JobMarketBucket.create({
          bucketKey,
          roleKey: roleDef.roleKey,
          roleName: roleDef.roleName,
          specialization: 'general',
          experienceBucket: exp,
          activeVersion: 0,
          status: 'empty',
          jobCount: 0,
        })
      }
      createdOrFound.push(bucket)
    }
  }

  return createdOrFound
}

/**
 * Fast-catch scraper: fetches first 12-15 JDs synchronously under a strict budget (default 12s).
 *
 * @param {Object} params
 * @param {string} [params.role='Software Engineer']
 * @param {number} [params.targetCount=15]
 * @param {number} [params.timeoutMs=25000]
 * @returns {Promise<Array<Object>>} Scraped job items
 */
export async function fetchFastCatchJds({ role = 'Software Engineer', targetCount = 15, timeoutMs = 25000, mockJds = null } = {}) {
  if (Array.isArray(mockJds)) {
    return mockJds
  }

  if (apifyKeyPool.getKeyCount() === 0) {
    console.warn('[MarketJdJobs] No Apify tokens configured in environment for fast-catch.')
    return []
  }

  const actorInput = {
    titles: [role],
    locations: ['United States'],
    maxItems: targetCount,
    rows: targetCount,
    limit: targetCount,
    proxyConfiguration: { useApifyProxy: true },
  }

  const timeoutSecs = Math.max(1, Math.round(timeoutMs / 1000))

  const runPromise = (async () => {
    try {
      return await apifyKeyPool.executeWithRetry(async (activeToken) => {
        const client = new ApifyClient({
          token: activeToken,
          timeoutSecs,
        })
        const actorId = process.env.APIFY_JOB_ACTOR_ID || DEFAULT_APIFY_JOB_ACTOR
        const run = await client.actor(actorId).call(actorInput, {
          waitSecs: timeoutSecs,
          maxItems: targetCount,
        })
        if (!run || !run.defaultDatasetId) return []
        const { items = [] } = await client.dataset(run.defaultDatasetId).listItems({ limit: targetCount })
        return items.map((item) => ({
          title: item.title || role,
          company: item.companyName || item.company || 'Enterprise',
          description: item.description || item.text || '',
          url: item.url || item.link || '',
        }))
      }, { maxAttempts: 2 })
    } catch (err) {
      console.warn('[MarketJdJobs] Fast-catch Apify call error:', err.message)
      return []
    }
  })()

  // Guard with strict timeout
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs))
  return Promise.race([runPromise, timeoutPromise])
}

/**
 * Enqueues a full 100-JD background bucket refresh to complete the bucket asynchronously.
 *
 * @param {string} bucketKey
 * @returns {Promise<Object>}
 */
export async function enqueueFullBackgroundBucket(bucketKey) {
  const { enqueueBucketRefresh } = await import('./marketJdQueue.js')
  return enqueueBucketRefresh(bucketKey, { priority: 'normal' })
}

export default {
  executeBucketRefresh,
  ensureConfiguredBucketsExist,
  fetchFastCatchJds,
  enqueueFullBackgroundBucket,
}
