/**
 * Admin Market Library Controller — Career GPS Resume Agent V3
 *
 * Handles admin operations for the Role × Experience Job Market Library:
 * - Stats and listing of all buckets
 * - Single bucket details and version history
 * - Global "Update JD Library" trigger
 * - Single-bucket refresh trigger
 * - Refresh job progress status
 * - Atomic version rollback/activation
 */

import JobMarketBucket from '../models/JobMarketBucket.js'
import JobMarketVersion from '../models/JobMarketVersion.js'
import {
  enqueueBucketRefresh,
  enqueueAllBucketsRefresh,
  getJobStatus,
  getMarketLibraryStats,
} from '../jobs/marketJd/marketJdQueue.js'
import { activateMarketVersion, getMarketVersionHistory } from '../agents/resume/market/marketVersions.js'
import { ensureConfiguredBucketsExist } from '../jobs/marketJd/marketJdJobs.js'

/**
 * GET /api/admin/market-library
 * Returns summary stats and list of all buckets.
 */
export async function listMarketBuckets(req, res) {
  try {
    await ensureConfiguredBucketsExist()
    const stats = await getMarketLibraryStats()
    return res.status(200).json({
      success: true,
      ...stats,
    })
  } catch (err) {
    console.error('[AdminMarket] listMarketBuckets error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/admin/market-library/:bucketKey
 * Returns detailed state, active 5 JDs, market profile, and version history.
 */
export async function getMarketBucketDetail(req, res) {
  try {
    const { bucketKey } = req.params
    const bucket = await JobMarketBucket.findOne({ bucketKey }).lean()
    if (!bucket) {
      return res.status(404).json({ success: false, message: 'Bucket not found.' })
    }

    let activeVersion = null
    if (bucket.activeVersion > 0) {
      activeVersion = await JobMarketVersion.findOne({
        bucketKey,
        version: bucket.activeVersion,
      }).lean()
    }

    const history = await getMarketVersionHistory(bucketKey, 10)

    return res.status(200).json({
      success: true,
      bucket,
      activeVersion,
      history,
    })
  } catch (err) {
    console.error('[AdminMarket] getMarketBucketDetail error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/refresh
 * Global "Update JD Library" operation.
 * Refreshes every configured bucket with 5 fresh JDs and atomically activates.
 */
export async function refreshAllMarketBuckets(req, res) {
  try {
    const job = await enqueueAllBucketsRefresh()
    return res.status(202).json({
      success: true,
      message: 'Global JD Library refresh enqueued.',
      jobId: job.jobId,
      totalBuckets: job.totalBuckets,
    })
  } catch (err) {
    console.error('[AdminMarket] refreshAllMarketBuckets error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/refresh/:bucketKey
 * Single-bucket refresh operation.
 */
export async function refreshSingleMarketBucket(req, res) {
  try {
    const { bucketKey } = req.params
    const job = await enqueueBucketRefresh(bucketKey)
    return res.status(202).json({
      success: true,
      message: `Refresh enqueued for bucket ${bucketKey}.`,
      jobId: job.jobId,
      bucketKey,
    })
  } catch (err) {
    console.error('[AdminMarket] refreshSingleMarketBucket error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/admin/market-library/refresh/:jobId
 * Retrieves status/progress of a background refresh job.
 */
export async function getMarketRefreshJobStatus(req, res) {
  try {
    const { jobId } = req.params
    const job = getJobStatus(jobId)
    if (!job) {
      return res.status(404).json({ success: false, message: 'Refresh job not found or expired.' })
    }
    return res.status(200).json({
      success: true,
      job,
    })
  } catch (err) {
    console.error('[AdminMarket] getMarketRefreshJobStatus error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/activate/:bucketKey/:version
 * Atomically activates a specific historical version for rollback/switch.
 */
export async function activateBucketVersion(req, res) {
  try {
    const { bucketKey, version } = req.params
    const versionNum = parseInt(version, 10)
    if (isNaN(versionNum)) {
      return res.status(400).json({ success: false, message: 'Invalid version number.' })
    }

    const result = await activateMarketVersion(bucketKey, versionNum)
    return res.status(200).json({
      success: true,
      message: `Version ${versionNum} activated for ${bucketKey}.`,
      ...result,
    })
  } catch (err) {
    console.error('[AdminMarket] activateBucketVersion error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

export default {
  listMarketBuckets,
  getMarketBucketDetail,
  refreshAllMarketBuckets,
  refreshSingleMarketBucket,
  getMarketRefreshJobStatus,
  activateBucketVersion,
}
