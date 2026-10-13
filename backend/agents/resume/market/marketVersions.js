/**
 * Market Versions Manager — Career GPS Resume Agent V3
 *
 * Provides inspection, retrieval, and lifecycle management for
 * versioned JobMarketVersion snapshots and historical rollbacks.
 */

import JobMarketVersion from '../../../models/JobMarketVersion.js'
import JobMarketBucket from '../../../models/JobMarketBucket.js'

/**
 * Retrieves the currently active version document for a given bucket.
 * @param {string} bucketKey
 * @returns {Promise<Object|null>}
 */
export async function getActiveMarketVersion(bucketKey) {
  const bucket = await JobMarketBucket.findOne({ bucketKey }).lean()
  if (!bucket || !bucket.activeVersion) return null

  return JobMarketVersion.findOne({
    bucketKey,
    version: bucket.activeVersion,
  }).lean()
}

/**
 * Retrieves version history for a bucket.
 * @param {string} bucketKey
 * @param {number} [limit=10]
 * @returns {Promise<Array<Object>>}
 */
export async function getMarketVersionHistory(bucketKey, limit = 10) {
  return JobMarketVersion.find({ bucketKey })
    .sort({ version: -1 })
    .limit(limit)
    .select('bucketKey version validationSummary sourceMetadata isArchived createdAt')
    .lean()
}

/**
 * Atomically swaps the active version pointer of a bucket to a specific target version.
 * @param {string} bucketKey
 * @param {number} targetVersion
 * @returns {Promise<{ success: boolean, bucketKey: string, activeVersion: number }>}
 */
export async function activateMarketVersion(bucketKey, targetVersion) {
  const versionDoc = await JobMarketVersion.findOne({ bucketKey, version: targetVersion })
  if (!versionDoc) {
    throw new Error(`Version ${targetVersion} not found for bucket ${bucketKey}.`)
  }

  // Archive others
  await JobMarketVersion.updateMany(
    { bucketKey, version: { $ne: targetVersion } },
    { $set: { isArchived: true } }
  )

  versionDoc.isArchived = false
  await versionDoc.save()

  await JobMarketBucket.updateOne(
    { bucketKey },
    {
      $set: {
        activeVersion: targetVersion,
        jobCount: versionDoc.jobs.length,
        status: versionDoc.jobs.length >= 5 ? 'healthy' : 'needs_refresh',
      },
    }
  )

  return {
    success: true,
    bucketKey,
    activeVersion: targetVersion,
  }
}

/**
 * Creates an immutable version document record representation.
 */
export function createVersionRecord({
  bucketKey,
  versionNumber = 1,
  jobs = [],
  marketProfile = null,
  sourceMetadata = {},
}) {
  const isValid = Array.isArray(jobs) && jobs.length >= 5 && marketProfile != null
  return {
    bucketKey,
    version: versionNumber,
    jobs,
    marketProfile,
    sourceMetadata,
    validationSummary: {
      isValid,
      jobCount: jobs.length,
      errors: isValid ? [] : ['Fewer than 5 valid jobs or missing market profile'],
    },
    isArchived: false,
    createdAt: new Date(),
  }
}

/**
 * Evaluates candidate version against current bucket for atomic pointer transition safety.
 */
export function prepareAtomicSwap({
  currentBucket = {},
  newVersionRecord = {},
}) {
  const isValid = Boolean(newVersionRecord?.validationSummary?.isValid)
  if (!isValid) {
    return {
      canActivate: false,
      retainedVersion: currentBucket?.activeVersion || 0,
      reason: 'New version failed validation. Retaining existing active version.',
    }
  }
  return {
    canActivate: true,
    previousVersion: currentBucket?.activeVersion || 0,
    targetVersion: newVersionRecord.version,
  }
}

export default {
  getActiveMarketVersion,
  getMarketVersionHistory,
  activateMarketVersion,
  createVersionRecord,
  prepareAtomicSwap,
}
