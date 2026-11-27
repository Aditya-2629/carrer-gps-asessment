/**
 * Market Auto Scheduler — Traffic-Aware, Staggered 1-Bucket-at-a-Time Background Scheduler
 * 
 * Logic:
 * 1. Checks every 3 minutes for system idle state (zero recent visitors, zero running report jobs, zero in-flight Fast-Catch).
 * 2. If system is active with live candidate traffic, defers immediately ('deferred_traffic_active') and re-checks next tick.
 * 3. Enforces single mutex lock (`isEnriching`) + minimum 10-minute cooldown between bucket enrichments.
 * 4. Priority 1 (35 -> 100 JD Enrichment): Finds ONE bucket with needsFullEnrichment: true (or jobCount >= 8 and < 100).
 * 5. Priority 2 (Staggered Monthly Refresh): If Priority 1 is empty, finds ONE bucket older than 30 days.
 * 6. Exposes live schedulerState for Admin Market Library telemetry.
 */

import JobMarketBucket from '../../models/JobMarketBucket.js'
import VisitorSession from '../../models/VisitorSession.js'
import ReportJob from '../../models/ReportJob.js'
import { inFlightFastCatch } from '../../agents/resume/market/marketJdRetriever.js'
import { runDetachedBackgroundScrape, executeBucketRefresh } from './marketJdJobs.js'
import { runSelfLearningRollup } from '../../agents/resume/market/marketLearning.js'

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
export const ENRICHMENT_COOLDOWN_MS = 10 * 60 * 1000 // 10 minutes minimum cooldown
export const TICK_FREQUENCY_MS = 3 * 60 * 1000 // Evaluate every 3 minutes

// Internal mutex and telemetry state
let isEnriching = false
let lastEnrichmentFinishedAt = null
let lastRunAt = null
let currentBucket = null
let schedulerStatus = 'idle' // 'idle' | 'enriching' | 'deferred_traffic_active' | 'cooling_down'
let deferredReason = null

/**
 * Traffic & Load Guard: Checks whether the system is truly idle.
 * Defer if any user had a heartbeat in the last 5 minutes, if any report jobs are running/queued,
 * or if any Fast-Catch scrapes are in flight.
 * @returns {Promise<{ idle: boolean, reason?: string, details?: Object }>}
 */
export async function isSystemIdle() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const [activeVisitors, runningJobs] = await Promise.all([
    VisitorSession.countDocuments({ lastHeartbeatAt: { $gte: fiveMinutesAgo } }).catch(() => 0),
    ReportJob.countDocuments({ status: { $in: ['queued', 'running'] } }).catch(() => 0),
  ])

  const fastCatchCount = inFlightFastCatch?.size || 0

  if (activeVisitors > 0) {
    return {
      idle: false,
      reason: `Live candidate traffic active (${activeVisitors} active session${activeVisitors === 1 ? '' : 's'})`,
      details: { activeVisitors, runningJobs, fastCatchCount },
    }
  }

  if (runningJobs > 0) {
    return {
      idle: false,
      reason: `Report generation jobs in progress (${runningJobs} job${runningJobs === 1 ? '' : 's'})`,
      details: { activeVisitors, runningJobs, fastCatchCount },
    }
  }

  if (fastCatchCount > 0) {
    return {
      idle: false,
      reason: `Real-time Fast-Catch scrape in flight (${fastCatchCount} active)`,
      details: { activeVisitors, runningJobs, fastCatchCount },
    }
  }

  return {
    idle: true,
    details: { activeVisitors: 0, runningJobs: 0, fastCatchCount: 0 },
  }
}

/**
 * Returns current scheduler telemetry for Admin Market Library.
 */
export async function getSchedulerTelemetry() {
  const cutoffDate = new Date(Date.now() - THIRTY_DAYS_MS)

  const [pendingEnrichmentCount, staleBucketsCount] = await Promise.all([
    JobMarketBucket.countDocuments({
      $or: [
        { needsFullEnrichment: true },
        { jobCount: { $gte: 8, $lt: 100 } },
      ],
      status: { $ne: 'refreshing' },
    }).catch(() => 0),
    JobMarketBucket.countDocuments({
      $or: [
        { lastSuccessfulRefreshAt: { $lt: cutoffDate } },
        { lastSuccessfulRefreshAt: { $exists: false } },
        { lastSuccessfulRefreshAt: null },
        { activeVersion: 0 },
      ],
      status: { $ne: 'refreshing' },
    }).catch(() => 0),
  ])

  const nextEligibleAt = lastEnrichmentFinishedAt
    ? new Date(lastEnrichmentFinishedAt.getTime() + ENRICHMENT_COOLDOWN_MS)
    : new Date()

  return {
    status: schedulerStatus,
    currentBucket,
    isEnriching,
    deferredReason,
    pendingEnrichmentCount,
    staleBucketsCount,
    lastRunAt,
    lastEnrichmentFinishedAt,
    nextEligibleAt,
    cooldownRemainingMs: lastEnrichmentFinishedAt
      ? Math.max(0, ENRICHMENT_COOLDOWN_MS - (Date.now() - lastEnrichmentFinishedAt.getTime()))
      : 0,
  }
}

/**
 * Main Scheduler Tick: Processes strictly 1 bucket at a time when system is idle.
 */
export async function checkAndScheduleStaleBuckets() {
  if (isEnriching) {
    console.log(`[MarketAutoScheduler] Already enriching bucket "${currentBucket}". Skipping tick.`)
    return
  }

  // Check 10-minute cooldown
  if (lastEnrichmentFinishedAt) {
    const elapsed = Date.now() - lastEnrichmentFinishedAt.getTime()
    if (elapsed < ENRICHMENT_COOLDOWN_MS) {
      schedulerStatus = 'cooling_down'
      const remainingSec = Math.round((ENRICHMENT_COOLDOWN_MS - elapsed) / 1000)
      console.log(`[MarketAutoScheduler] Cooldown active. Next bucket eligible in ${remainingSec}s.`)
      return
    }
  }

  // Check system idle
  const idleCheck = await isSystemIdle()
  if (!idleCheck.idle) {
    schedulerStatus = 'deferred_traffic_active'
    deferredReason = idleCheck.reason
    console.log(`[MarketAutoScheduler] Deferring background enrichment: ${idleCheck.reason}`)
    return
  }

  deferredReason = null
  lastRunAt = new Date()

  try {
    // ── Priority 1: Pick ONE bucket needing 35 -> 100 JD enrichment ──
    let targetBucket = await JobMarketBucket.findOne({
      $or: [
        { needsFullEnrichment: true },
        { jobCount: { $gte: 8, $lt: 100 } },
      ],
      status: { $ne: 'refreshing' },
    }).sort({ updatedAt: 1 })

    let isEnrichmentTask = true

    // ── Priority 2: Staggered Monthly Refresh (Only when Priority 1 is empty) ──
    if (!targetBucket) {
      isEnrichmentTask = false
      const cutoffDate = new Date(Date.now() - THIRTY_DAYS_MS)
      targetBucket = await JobMarketBucket.findOne({
        $or: [
          { lastSuccessfulRefreshAt: { $lt: cutoffDate } },
          { lastSuccessfulRefreshAt: { $exists: false } },
          { lastSuccessfulRefreshAt: null },
          { activeVersion: 0 },
        ],
        status: { $ne: 'refreshing' },
      }).sort({ lastSuccessfulRefreshAt: 1 })
    }

    if (!targetBucket) {
      schedulerStatus = 'idle'
      currentBucket = null
      console.log('[MarketAutoScheduler] All market buckets are enriched (>= 100 JDs) and up to date. Zero jobs needed.')
      // Run self-learning rollup when quiet
      await runSelfLearningRollup().catch(() => {})
      return
    }

    // Acquire mutex lock
    isEnriching = true
    currentBucket = targetBucket.bucketKey
    schedulerStatus = 'enriching'

    console.log(`[MarketAutoScheduler] Starting isolated ${isEnrichmentTask ? '35->100 JD enrichment' : 'monthly refresh'} for bucket: "${targetBucket.bucketKey}"`)

    try {
      if (isEnrichmentTask) {
        await runDetachedBackgroundScrape(targetBucket.bucketKey)
        await JobMarketBucket.updateOne(
          { bucketKey: targetBucket.bucketKey },
          { $set: { needsFullEnrichment: false } }
        ).catch(() => {})
      } else {
        await executeBucketRefresh(targetBucket.bucketKey, { source: 'auto_scheduler' })
      }
      console.log(`[MarketAutoScheduler] Successfully completed ${targetBucket.bucketKey}. Cooldown started (10m).`)
    } catch (bucketErr) {
      console.error(`[MarketAutoScheduler] Error processing ${targetBucket.bucketKey}:`, bucketErr.message)
    } finally {
      isEnriching = false
      currentBucket = null
      lastEnrichmentFinishedAt = new Date()
      schedulerStatus = 'cooling_down'
    }
  } catch (error) {
    console.error('[MarketAutoScheduler] Error in scheduler tick:', error.message)
    schedulerStatus = 'idle'
    currentBucket = null
    isEnriching = false
  }
}

/**
 * Initializes the background scheduler on server startup.
 */
export function initMarketAutoScheduler() {
  console.log('[MarketAutoScheduler] Initializing traffic-aware 1-bucket background scheduler (3m tick, 10m cooldown)...')

  // Initial check 45 seconds after server boot
  setTimeout(() => {
    checkAndScheduleStaleBuckets().catch(() => {})
  }, 45000)

  // Recurring check every 3 minutes
  setInterval(() => {
    checkAndScheduleStaleBuckets().catch(() => {})
  }, TICK_FREQUENCY_MS)
}

export default {
  checkAndScheduleStaleBuckets,
  initMarketAutoScheduler,
  isSystemIdle,
  getSchedulerTelemetry,
  THIRTY_DAYS_MS,
  ENRICHMENT_COOLDOWN_MS,
  TICK_FREQUENCY_MS,
}

