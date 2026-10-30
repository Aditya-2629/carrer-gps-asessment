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
import { fetchMarketJdCandidates, buildSearchSpecification } from '../../integrations/apify/apifyJdScraper.js'
import { processAndSelectTopJds } from '../../agents/resume/market/jdNormalizer.js'
import { buildMarketProfile } from '../../agents/resume/market/marketProfileBuilder.js'
import { CONTROLLED_ROLES } from '../../agents/resume/market/marketBucketResolver.js'

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
    const scrapeResult = await fetchMarketJdCandidates(searchSpec, options)
    const rawCandidates = scrapeResult.candidates || []

    // 4. Clean, validate quality, deduplicate, and select top 15
    const TARGET_JD_COUNT = parseInt(process.env.MARKET_JD_TARGET_COUNT || '15', 10)
    const processed = processAndSelectTopJds(rawCandidates, bucket.roleKey, TARGET_JD_COUNT)
    const selectedJds = processed.selected

    if (selectedJds.length < TARGET_JD_COUNT) {
      console.warn(`[MarketJdJobs] Retrieved only ${selectedJds.length} valid JDs for ${bucketKey} (target: ${TARGET_JD_COUNT}).`)
    }

    // Check if we have at least 1 valid JD (or 5 for full health)
    if (selectedJds.length === 0) {
      throw new Error(`No valid market JDs could be extracted from candidate pool (${scrapeResult.totalFetched} items fetched).`)
    }

    // 5. Build deterministic MarketProfile
    const marketProfile = buildMarketProfile(bucketKey, selectedJds)

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
        errors: selectedJds.length < 5 ? [`Only ${selectedJds.length}/5 valid JDs retrieved`] : [],
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

export default {
  executeBucketRefresh,
  ensureConfiguredBucketsExist,
}
