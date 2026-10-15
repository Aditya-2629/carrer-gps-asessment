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
import { enqueueBucketRefresh } from '../../../jobs/marketJd/marketJdQueue.js'

/**
 * Retrieves market intelligence for a specific bucket key.
 *
 * @param {string} bucketKey - e.g. "software-engineer::6-8"
 * @param {Object} [options]
 * @param {boolean} [options.autoRefresh=true] - Auto-enqueue refresh if missing/empty
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

    // 1. Bucket exists and has active validated version with valid JDs
    if (bucket && bucket.activeVersion > 0 && bucket.jobCount > 0) {
      const activeVersion = await JobMarketVersion.findOne({
        bucketKey,
        version: bucket.activeVersion,
      }).lean()

      if (activeVersion && activeVersion.jobs && activeVersion.jobs.length > 0) {
        return {
          status: 'available',
          bucketKey,
          version: bucket.activeVersion,
          sampleSize: activeVersion.jobs.length,
          marketProfile: activeVersion.marketProfile,
          jobs: activeVersion.jobs,
          lastRefreshedAt: bucket.lastSuccessfulRefreshAt,
        }
      }
    }

    // 2. Bucket is currently refreshing
    if (bucket && bucket.status === 'refreshing') {
      return {
        status: 'refreshing',
        bucketKey,
        version: bucket.activeVersion || 0,
        sampleSize: bucket.jobCount || 0,
        message: 'Market data is actively refreshing in the background.',
      }
    }

    // 3. Bucket is empty or needs refresh: auto-trigger background refresh
    if (autoRefresh) {
      console.log(`[MarketJdRetriever] Bucket ${bucketKey} has insufficient data. Enqueueing background refresh...`)
      const job = await enqueueBucketRefresh(bucketKey)
      return {
        status: 'refreshing',
        bucketKey,
        jobId: job.jobId,
        version: bucket?.activeVersion || 0,
        sampleSize: 0,
        message: 'Market data refresh enqueued in background.',
      }
    }

    return {
      status: 'unavailable',
      bucketKey,
      reason: 'Bucket has no active market data.',
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
