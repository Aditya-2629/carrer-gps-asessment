/**
 * Market Auto Scheduler — Automatic Monthly JD Refresh with 5-Minute Staggered Queue
 * 
 * Logic:
 * 1. Checks every hour for any JobMarketBucket where lastSuccessfulRefreshAt is > 30 days old, missing, or jobCount < 20.
 * 2. If multiple buckets are stale, schedules them with a 5-minute (300,000 ms) gap between each.
 * 3. Never overwhelms Apify; preserves rate limits and respects zero-downtime atomic swaps.
 */

import JobMarketBucket from '../../models/JobMarketBucket.js'
import { enqueueBucketRefresh } from './marketJdQueue.js'

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
export const STAGGER_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes between buckets
const CHECK_FREQUENCY_MS = 60 * 60 * 1000 // Run health check every 1 hour

let isRunningCheck = false

export async function checkAndScheduleStaleBuckets() {
  if (isRunningCheck) return
  isRunningCheck = true

  try {
    const cutoffDate = new Date(Date.now() - THIRTY_DAYS_MS)

    // Find buckets not refreshed in 30 days or having tiny sample sizes (<20 JDs)
    const staleBuckets = await JobMarketBucket.find({
      $or: [
        { lastSuccessfulRefreshAt: { $lt: cutoffDate } },
        { lastSuccessfulRefreshAt: { $exists: false } },
        { lastSuccessfulRefreshAt: null },
        { activeVersion: 0 },
        { jobCount: { $lt: 20 } },
      ],
      status: { $ne: 'refreshing' },
    }).sort({ lastSuccessfulRefreshAt: 1 })

    if (staleBuckets.length === 0) {
      console.log('[MarketAutoScheduler] All market buckets are current (within 30 days). No refresh required.')
      return
    }

    console.log(`[MarketAutoScheduler] Found ${staleBuckets.length} bucket(s) due for monthly refresh. Enqueueing...`)

    staleBuckets.forEach((bucket, index) => {
      const delayMs = index * STAGGER_INTERVAL_MS
      setTimeout(async () => {
        try {
          await enqueueBucketRefresh(bucket.bucketKey, { source: 'monthly_auto_scheduler' })
        } catch (err) {
          console.error(`[MarketAutoScheduler] Error refreshing ${bucket.bucketKey}:`, err.message)
        }
      }, delayMs)
    })
  } catch (error) {
    console.error('[MarketAutoScheduler] Error checking stale buckets:', error.message)
  } finally {
    isRunningCheck = false
  }
}

/**
 * Initializes the background scheduler on server startup.
 */
export function initMarketAutoScheduler() {
  console.log('[MarketAutoScheduler] Initializing automated monthly JD refresh scheduler...')

  // Initial check 30 seconds after server boot
  setTimeout(() => {
    checkAndScheduleStaleBuckets()
  }, 30000)

  // Recurring check every 1 hour
  setInterval(() => {
    checkAndScheduleStaleBuckets()
  }, CHECK_FREQUENCY_MS)
}

export default {
  checkAndScheduleStaleBuckets,
  initMarketAutoScheduler,
  THIRTY_DAYS_MS,
  STAGGER_INTERVAL_MS,
}
