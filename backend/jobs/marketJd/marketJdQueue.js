/**
 * Market JD Queue — Career GPS Resume Agent V3
 *
 * Provides a unified queue interface for market refresh jobs.
 * Enforces bounded concurrency (default: 3) to prevent overwhelming Apify.
 *
 * Implements:
 * - market-jd-refresh (single bucket)
 * - market-jd-refresh-all (all configured buckets)
 * - Job status inspection
 * - Bounded worker concurrency
 */

import crypto from 'crypto'
import { EventEmitter } from 'events'
import { executeBucketRefresh, ensureConfiguredBucketsExist } from './marketJdJobs.js'
import JobMarketBucket from '../../models/JobMarketBucket.js'

export const DEFAULT_CONCURRENCY = 3
const getConcurrency = () =>
  parseInt(process.env.MARKET_JD_REFRESH_CONCURRENCY || '3', 10) || DEFAULT_CONCURRENCY

// In-memory job state store for status queries
const jobRegistry = (globalThis.__marketJdJobRegistry ||= new Map())
const jobBus = (globalThis.__marketJdJobBus ||= new EventEmitter())
jobBus.setMaxListeners(100)

let isProcessingQueue = false
const taskQueue = []

/**
 * Enqueues a single bucket refresh job.
 *
 * @param {string} bucketKey
 * @param {Object} [options]
 * @returns {Promise<{ jobId: string, status: string, bucketKey: string }>}
 */
export async function enqueueBucketRefresh(bucketKey, options = {}) {
  const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const jobRecord = {
    id: jobId,
    type: 'market-jd-refresh',
    bucketKey,
    status: 'queued',
    progress: 0,
    result: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  jobRegistry.set(jobId, jobRecord)
  taskQueue.push({ jobId, type: 'single', bucketKey, options })
  triggerWorker()

  return { jobId, status: 'queued', bucketKey }
}

/**
 * Enqueues a full refresh across all configured Role × Experience buckets.
 *
 * @param {Object} [options]
 * @returns {Promise<{ jobId: string, status: string, totalBuckets: number }>}
 */
export async function enqueueAllBucketsRefresh(options = {}) {
  const buckets = await ensureConfiguredBucketsExist()
  const jobId = `global_refresh_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

  const jobRecord = {
    id: jobId,
    type: 'market-jd-refresh-all',
    totalBuckets: buckets.length,
    completedBuckets: 0,
    status: 'queued',
    progress: 0,
    results: [],
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  jobRegistry.set(jobId, jobRecord)

  // Enqueue each bucket under this parent global job
  taskQueue.push({
    jobId,
    type: 'all',
    bucketKeys: buckets.map((b) => b.bucketKey),
    options,
  })
  triggerWorker()

  return {
    jobId,
    status: 'queued',
    totalBuckets: buckets.length,
  }
}

/**
 * Retrieves current status of an enqueued or finished job.
 * @param {string} jobId
 * @returns {Object|null}
 */
export function getJobStatus(jobId) {
  return jobRegistry.get(jobId) || null
}

/**
 * Returns summary statistics of the market library buckets.
 */
export async function getMarketLibraryStats() {
  const allBuckets = await JobMarketBucket.find({}).lean()
  const total = allBuckets.length
  const healthy = allBuckets.filter((b) => b.status === 'healthy' && b.jobCount >= 5).length
  const needsRefresh = allBuckets.filter((b) => b.status === 'needs_refresh' || b.jobCount < 5).length
  const refreshing = allBuckets.filter((b) => b.status === 'refreshing').length
  const empty = allBuckets.filter((b) => b.status === 'empty' || b.status === 'failed').length

  const lastFullRefresh = allBuckets
    .map((b) => b.lastSuccessfulRefreshAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null

  return {
    totalBuckets: total,
    healthy,
    needsRefresh,
    refreshing,
    empty,
    lastFullRefresh,
    buckets: allBuckets,
  }
}

/**
 * Worker loop with bounded concurrency.
 */
async function triggerWorker() {
  if (isProcessingQueue) return
  isProcessingQueue = true

  try {
    while (taskQueue.length > 0) {
      const task = taskQueue.shift()
      const jobRecord = jobRegistry.get(task.jobId)

      if (jobRecord) {
        jobRecord.status = 'running'
        jobRecord.updatedAt = new Date()
      }

      if (task.type === 'single') {
        try {
          const res = await executeBucketRefresh(task.bucketKey, task.options)
          if (jobRecord) {
            jobRecord.status = res.success ? 'completed' : 'failed'
            jobRecord.result = res
            jobRecord.error = res.error || null
            jobRecord.progress = 100
            jobRecord.updatedAt = new Date()
          }
        } catch (err) {
          if (jobRecord) {
            jobRecord.status = 'failed'
            jobRecord.error = err.message
            jobRecord.updatedAt = new Date()
          }
        }
      } else if (task.type === 'all') {
        const bucketKeys = task.bucketKeys || []
        const concurrency = getConcurrency()
        const results = []

        // Process bucket chunks with bounded concurrency
        for (let i = 0; i < bucketKeys.length; i += concurrency) {
          const chunk = bucketKeys.slice(i, i + concurrency)
          const chunkPromises = chunk.map((key) => executeBucketRefresh(key, task.options))
          const chunkResults = await Promise.all(chunkPromises)
          results.push(...chunkResults)

          if (jobRecord) {
            jobRecord.completedBuckets = results.length
            jobRecord.progress = Math.round((results.length / bucketKeys.length) * 100)
            jobRecord.results = results
            jobRecord.updatedAt = new Date()
            jobBus.emit(task.jobId, { ...jobRecord })
          }
        }

        if (jobRecord) {
          jobRecord.status = 'completed'
          jobRecord.progress = 100
          jobRecord.updatedAt = new Date()
        }
      }
    }
  } catch (loopErr) {
    console.error('[MarketJdQueue] Worker loop error:', loopErr)
  } finally {
    isProcessingQueue = false
    if (taskQueue.length > 0) {
      triggerWorker()
    }
  }
}

export const marketJdQueue = {
  concurrency: DEFAULT_CONCURRENCY,
  enqueueBucketRefresh,
  enqueueAllBucketsRefresh,
  getJobStatus,
  getMarketLibraryStats,
  getStatus: () => ({
    active: isProcessingQueue ? 1 : 0,
    pending: taskQueue.length,
    concurrency: getConcurrency(),
  }),
}

export default {
  marketJdQueue,
  enqueueBucketRefresh,
  enqueueAllBucketsRefresh,
  getJobStatus,
  getMarketLibraryStats,
}
