/**
 * Market JD Retriever — Career GPS Resume Agent V3
 *
 * Retrieves the exactly 15 active market JDs and their deterministic MarketProfile
 * for a resolved bucket. If the bucket has insufficient JDs, automatically enqueues
 * a background refresh and returns a transparent status.
 *
 * Enforces:
 * - Never fabricate market data
 * - Transparent status ("available", "refreshing", "unavailable")
 * - Automatic background queueing for missing or stale buckets
 */

import mongoose from 'mongoose'
import JobMarketBucket from '../../../models/JobMarketBucket.js'
import JobMarketVersion from '../../../models/JobMarketVersion.js'
import { fetchFastCatchJds, enqueueFullBackgroundBucket } from '../../../jobs/marketJd/marketJdJobs.js'
import { analyzeAndAggregateJdCorpus } from './llmJdSkillAnalyzer.js'

/**
 * Retrieves market intelligence for a specific bucket key.
 *
 * Implements Two-Phase Progressive Scraping:
 * - Phase 1: Fast-catch 12-15 JDs synchronously if bucket is empty/cold (~8-10s)
 * - Phase 2: Asynchronously enqueues full 85 JDs in background to reach 100 JDs
 *
 * @param {string} bucketKey - e.g. "software-engineer::6-8"
 * @param {Object} [options]
 * @param {boolean} [options.autoRefresh=true] - Auto-enqueue refresh if missing/empty
 * @param {boolean} [options.bypassFastCatch=false] - Skip synchronous fast-catch
 * @returns {Promise<Object>} Market intelligence state
 */
export async function getMarketDataForBucket(bucketKey, options = {}) {
  const autoRefresh = options.autoRefresh !== false

  if (!bucketKey || typeof bucketKey !== 'string') {
    return {
      status: 'unavailable',
      bucketKey: null,
      reason: 'No valid bucketKey specified.',
    }
  }

  // Gracefully degrade when running in offline tests/benchmarks without MongoDB connection
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return {
      status: 'unavailable',
      bucketKey,
      reason: 'Database not connected (offline mode).',
    }
  }

  try {
    const bucket = await JobMarketBucket.findOne({ bucketKey }).lean()

    // 1. If valid active version exists in MongoDB (>= 10 JDs), serve instantly (0ms)
    if (bucket && (bucket.activeVersion > 0 || bucket.status === 'refreshing')) {
      const activeVersion =
        (await JobMarketVersion.findOne({ bucketKey, version: bucket.activeVersion }).lean()) ||
        (await JobMarketVersion.findOne({ bucketKey, isArchived: false }).sort({ version: -1 }).lean())

      if (
        activeVersion &&
        activeVersion.marketProfile &&
        Array.isArray(activeVersion.marketProfile.skills) &&
        activeVersion.marketProfile.skills.length >= 3 &&
        (activeVersion.jobs?.length >= 10 || (activeVersion.marketProfile.sampleSize || 0) >= 10)
      ) {
        return {
          status: 'available',
          bucketKey,
          version: activeVersion.version,
          sampleSize: activeVersion.jobs?.length || activeVersion.marketProfile.sampleSize || 0,
          marketProfile: activeVersion.marketProfile,
          jobs: activeVersion.jobs || [],
          lastRefreshedAt: bucket.lastSuccessfulRefreshAt,
        }
      }
    }

    // 2. EMPTY / COLD BUCKET: Trigger Phase-1 Fast-Catch (12-15 JDs live)
    if (!options.bypassFastCatch) {
      console.log(`[MarketJdRetriever] Bucket ${bucketKey} is empty or cold. Triggering Phase-1 Fast-Catch scrape...`)
      try {
        const [roleKey, expBucket] = bucketKey.split('::')
        const roleClean = bucket?.roleName || roleKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

        const fastCatchJds = await fetchFastCatchJds({
          role: roleClean,
          bucketKey,
          targetCount: 15,
          timeoutMs: 35000, // 35s budget for Apify live batch
        })

        if (Array.isArray(fastCatchJds) && fastCatchJds.length >= 3) {
          console.log(`[MarketJdRetriever] Fast-Catch acquired ${fastCatchJds.length} live JDs. Analyzing dynamically...`)
          const analyzed = await analyzeAndAggregateJdCorpus(fastCatchJds, bucketKey)

          const fastMarketProfile = {
            bucketKey,
            sampleSize: fastCatchJds.length,
            skills: analyzed.marketSkills,
            totalAnalyzed: analyzed.totalAnalyzed,
            topKeywords: analyzed.marketSkills.slice(0, 20).map((s) => s.name),
            isFastCatch: true,
          }

          // Enqueue Phase-2 full 100-JD background completion in parallel
          if (autoRefresh) {
            enqueueFullBackgroundBucket(bucketKey).catch(() => {})
          }

          return {
            status: 'available',
            bucketKey,
            version: 1,
            sampleSize: fastCatchJds.length,
            marketProfile: fastMarketProfile,
            jobs: fastCatchJds,
          }
        }
      } catch (fastErr) {
        console.warn(`[MarketJdRetriever] Fast-catch failed: ${fastErr.message}. Enqueueing full background job.`)
        if (autoRefresh) {
          enqueueFullBackgroundBucket(bucketKey).catch(() => {})
        }
      }
    }

    // 3. Graceful fallback if fast-catch yielded < 3 JDs or was bypassed
    if (autoRefresh) {
      console.log(`[MarketJdRetriever] Enqueueing full background refresh for ${bucketKey}...`)
      enqueueFullBackgroundBucket(bucketKey).catch(() => {})
      return {
        status: 'refreshing',
        bucketKey,
        version: bucket?.activeVersion || 0,
        sampleSize: bucket?.jobCount || 0,
        message: 'Market data is actively refreshing in the background.',
        marketProfile: null,
      }
    }

    return {
      status: 'unavailable',
      bucketKey,
      reason: 'Bucket has no active market data.',
      marketProfile: null,
    }
  } catch (err) {
    console.error(`[MarketJdRetriever] Error retrieving data for ${bucketKey}:`, err.message)
    return {
      status: 'unavailable',
      bucketKey,
      reason: err.message,
    }
  }
}

export default {
  getMarketDataForBucket,
}
