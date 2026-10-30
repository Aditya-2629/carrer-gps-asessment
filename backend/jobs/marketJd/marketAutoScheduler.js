/**
 * Market Auto Scheduler — Automatic Weekly JD Refresh with 10-Minute Staggered Queue
 * 
 * Logic:
 * 1. Checks every hour for any JobMarketBucket where lastSuccessfulRefreshAt is > 7 days old or missing.
 * 2. If multiple buckets are stale, schedules them with a 10-minute (600,000 ms) gap between each.
 * 3. Never overwhelms Apify; preserves rate limits and respects zero-downtime atomic swaps.
 */

import JobMarketBucket from '../../models/JobMarketBucket.js'
import { enqueueBucketRefresh } from './marketJdQueue.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const STAGGER_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes between each Apify scrape
const CHECK_FREQUENCY_MS = 60 * 60 * 1000 // Run health check every 1 hour

let isRunningCheck = false

export async function checkAndScheduleStaleBuckets() {
  if (isRunningCheck) return
  isRunningCheck = true

  try {
    const cutoffDate = new Date(Date.now() - SEVEN_DAYS_MS)

    // Find buckets that haven't been successfully refreshed in the last 7 days
    const staleBuckets = await JobMarketBucket.find({
      $or: [
        { lastSuccessfulRefreshAt: { $lt: cutoffDate } },
        { lastSuccessfulRefreshAt: { $exists: false } },
        { lastSuccessfulRefreshAt: null },
        { activeVersion: 0 },
      ],
      status: { $ne: 'refreshing' }, // Don't pick currently running buckets
    }).sort({ lastSuccessfulRefreshAt: 1 }) // Oldest first

    if (staleBuckets.length === 0) {
      console.log('[MarketAutoScheduler] All JD market buckets are fresh (within 7 days). No action needed.')
      return
    }

    console.log(`[MarketAutoScheduler] Found ${staleBuckets.length} stale bucket(s). Enqueuing with 10-minute stagger gap...`)

    staleBuckets.forEach((bucket, index) => {
      const delayMs = index * STAGGER_INTERVAL_MS
      const scheduledTime = new Date(Date.now() + delayMs).toLocaleTimeString()

      setTimeout(async () => {
        try {
          console.log(`[MarketAutoScheduler] Executing scheduled refresh for "${bucket.bucketKey}" (Scheduled for ${scheduledTime})...`)
          await enqueueBucketRefresh(bucket.bucketKey, { source: 'auto_weekly_scheduler' })
        } catch (err) {
          console.error(`[MarketAutoScheduler] Error refreshing bucket ${bucket.bucketKey}:`, err?.message)
        }
      }, delayMs)

      console.log(`  -> Bucket [${bucket.bucketKey}] scheduled at +${index * 10} min (${scheduledTime})`)
    })
  } catch (error) {
    console.error('[MarketAutoScheduler] Error checking stale buckets:', error?.message)
  } finally {
    isRunningCheck = false
  }
}

/**
 * Initializes the background scheduler on server startup.
 */
export function initMarketAutoScheduler() {
  console.log('[MarketAutoScheduler] Initializing automated weekly JD refresh scheduler...')

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
}
