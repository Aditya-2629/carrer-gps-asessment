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
import { analyzeJdBatchWithGemini, analyzeAndAggregateJdCorpus, pruneJdText, deduplicateJds } from './llmJdSkillAnalyzer.js'
import { CONTROLLED_ROLES } from './marketBucketResolver.js'

export const MIN_SAMPLE_THRESHOLD = 8
export const MIN_SKILLS_THRESHOLD = 4

// In-flight deduplication locking to prevent duplicate fast-catch calls for cold buckets
export const inFlightFastCatch = (globalThis.__inFlightFastCatch ||= new Map())

/**
 * Helper to ensure a Fast-Catch run starts or returns existing in-flight Promise for a bucketKey.
 * @param {string} bucketKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function triggerFastCatchForBucket(bucketKey, options = {}) {
  const targetCount = options.targetCount || 35
  const timeoutMs = options.timeoutMs || 50000

  if (inFlightFastCatch.has(bucketKey)) {
    console.log(`[MarketJdRetriever] triggerFastCatchForBucket: Fast-Catch already in-flight for ${bucketKey}. Joining shared promise...`)
    return inFlightFastCatch.get(bucketKey)
  }

  const fastCatchPromise = (async () => {
    try {
      console.log(`[MarketJdRetriever] Triggering Fast-Catch (target: ${targetCount} JDs, timeout: ${timeoutMs}ms) for ${bucketKey}...`)
      const [roleKey, expBucket] = bucketKey.split('::')
      const roleDef = Array.isArray(CONTROLLED_ROLES) ? CONTROLLED_ROLES.find((r) => r.roleKey === roleKey) : null
      const roleClean = options.roleName || roleDef?.roleName || roleKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

      const fastJds = await fetchFastCatchJds({
        role: roleClean,
        bucketKey,
        targetCount,
        timeoutMs,
        mockJds: options.mockJds || null,
      })

      const uniqueFastJds = deduplicateJds(fastJds)

      if (Array.isArray(uniqueFastJds) && uniqueFastJds.length >= MIN_SAMPLE_THRESHOLD) {
        console.log(`[MarketJdJobs] Bucket verification passed (sampleSize >= ${MIN_SAMPLE_THRESHOLD}). Activating version...`)
        console.log(`[MarketJdRetriever] Fast-Catch captured ${uniqueFastJds.length} real JDs. Analyzing dynamically via Gemini Flash...`)
        const analysis = await analyzeJdBatchWithGemini(roleClean, uniqueFastJds, { experienceBucket: expBucket })
        const discoveredSkills = analysis.discoveredSkills || analysis.marketSkills || []

        const fastMarketProfile = {
          bucketKey,
          sampleSize: analysis.sampleSize || uniqueFastJds.length,
          skills: discoveredSkills,
          responsibilities: analysis.responsibilities || [],
          senioritySignals: analysis.senioritySignals || [],
          createdAt: new Date(),
        }

        let stagedVersion = 1
        try {
          const bucketDoc = await JobMarketBucket.findOne({ bucketKey })
          stagedVersion = (bucketDoc?.activeVersion || 0) + 1

          await JobMarketVersion.create({
            bucketKey,
            version: stagedVersion,
            jobs: uniqueFastJds.map((j, idx) => {
              const jdText = pruneJdText(j.description || j.text || '')
              return {
                title: j.title || roleClean,
                company: j.company || 'Enterprise Employer',
                location: j.location || 'United States',
                description: jdText,
                source: 'apify_fast_catch',
                sourceUrl: j.url || null,
                fingerprint: `${bucketKey}_fc_${stagedVersion}_${idx}_${Date.now()}`,
              }
            }),
            marketProfile: fastMarketProfile,
            metadata: {
              source: 'apify_live_batch_35',
              targetCount: uniqueFastJds.length,
            },
            validationSummary: {
              isValid: true,
              checkedAt: new Date(),
              jobCount: uniqueFastJds.length,
            },
            isArchived: false,
          })

          const [bRoleKey, bExpBucket] = (bucketKey || '').split('::')
          await JobMarketBucket.findOneAndUpdate(
            { bucketKey },
            {
              $set: {
                bucketKey,
                roleKey: bRoleKey || roleKey,
                experienceBucket: bExpBucket || expBucket,
                roleName: roleClean,
                activeVersion: stagedVersion,
                jobCount: uniqueFastJds.length,
                status: 'healthy',
                needsFullEnrichment: true,
                lastSuccessfulRefreshAt: new Date(),
              },
            },
            { upsert: true }
          )
          console.log(`[MarketJdRetriever] Fast-Catch version v${stagedVersion} persisted to MongoDB for ${bucketKey}.`)
        } catch (persistErr) {
          console.warn(`[MarketJdRetriever] Failed to persist Fast-Catch version: ${persistErr.message}`)
        }

        // Enqueue background 50-JD enrichment on success
        if (options.autoRefresh !== false) {
          console.log(`[MarketJdJobs] Background refresh queued for 50-JD enrichment.`)
          enqueueFullBackgroundBucket(bucketKey).catch(() => {})
        }

        return {
          status: 'healthy',
          bucketKey,
          version: stagedVersion,
          sampleSize: uniqueFastJds.length,
          marketProfile: fastMarketProfile,
        }
      } else {
        console.warn(`[MarketJdRetriever] Fast-Catch scrape returned insufficient sample (${uniqueFastJds?.length || 0} < ${MIN_SAMPLE_THRESHOLD}) for ${bucketKey}.`)
        return {
          status: 'unavailable',
          bucketKey,
          sampleSize: uniqueFastJds?.length || 0,
          marketProfile: null,
        }
      }
    } catch (err) {
      console.warn(`[MarketJdRetriever] Fast-Catch error for ${bucketKey}:`, err.message)
      return {
        status: 'failed',
        bucketKey,
        error: err.message,
        marketProfile: null,
      }
    } finally {
      inFlightFastCatch.delete(bucketKey)
    }
  })()

  inFlightFastCatch.set(bucketKey, fastCatchPromise)
  return fastCatchPromise
}

/**
 * Finds the nearest populated adjacent experience bucket for the same roleKey.
 * e.g., if "ui-ux-designer::6-8" is cold, checks "3-5", "8+", "0-2".
 */
async function findNearestPopulatedBucket(bucketKey) {
  try {
    const [roleKey, currentExp] = String(bucketKey || '').split('::')
    if (!roleKey) return null

    const expOrderMap = {
      '0-2': ['3-5', '6-8', '8+'],
      '3-5': ['6-8', '0-2', '8+'],
      '6-8': ['3-5', '8+', '0-2'],
      '8+': ['6-8', '3-5', '0-2'],
    }
    const searchOrder = expOrderMap[currentExp] || ['3-5', '6-8', '0-2', '8+']

    for (const adjacentExp of searchOrder) {
      const candidateKey = `${roleKey}::${adjacentExp}`
      const candidateBucket = await JobMarketBucket.findOne({
        bucketKey: candidateKey,
        status: { $in: ['healthy', 'refreshing'] },
        activeVersion: { $gt: 0 },
      }).lean()

      if (candidateBucket) {
        const candidateVersion = await JobMarketVersion.findOne({
          bucketKey: candidateKey,
          version: candidateBucket.activeVersion,
          isArchived: false,
        }).lean()

        const sampleSize = candidateVersion?.jobs?.length || candidateVersion?.marketProfile?.sampleSize || 0
        const skillsCount = Array.isArray(candidateVersion?.marketProfile?.skills) ? candidateVersion.marketProfile.skills.length : 0

        if (candidateVersion?.marketProfile && sampleSize >= MIN_SAMPLE_THRESHOLD && skillsCount >= MIN_SKILLS_THRESHOLD) {
          return {
            bucket: candidateBucket,
            version: candidateVersion,
            adjacentExp,
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[MarketJdRetriever] Nearest bucket search failed for ${bucketKey}:`, err.message)
  }
  return null
}

/**
 * Retrieves market intelligence for a specific bucket key.
 *
 * Implements Two-Phase Progressive Scraping:
 * - Phase 1: Fast-catch 12-15 JDs synchronously if bucket is empty/cold (~8-10s)
 * - Phase 2: Asynchronously enqueues full 50 JDs in background
 * - In-Flight Locking: Prevents thundering herd on cold buckets
 * - Adjacent Fallback: Reuses populated adjacent experience bucket when available
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

  // In-flight locking: deduplicate concurrent fast-catch calls for the exact same bucketKey
  if (inFlightFastCatch.has(bucketKey)) {
    console.log(`[MarketJdRetriever] Fast-Catch already in-flight for bucket ${bucketKey}. Awaiting shared promise...`)
    return inFlightFastCatch.get(bucketKey)
  }

  try {
    const bucket = await JobMarketBucket.findOne({ bucketKey }).lean()

    // 1. If valid active version exists in MongoDB (sampleSize >= 10 and skills >= 4), serve instantly (0ms)
    if (bucket && (bucket.activeVersion > 0 || bucket.status === 'refreshing' || bucket.status === 'healthy')) {
      const activeVersion =
        (await JobMarketVersion.findOne({ bucketKey, version: bucket.activeVersion }).lean()) ||
        (await JobMarketVersion.findOne({ bucketKey, isArchived: false }).sort({ version: -1 }).lean())

      const sampleSize = activeVersion?.jobs?.length || activeVersion?.marketProfile?.sampleSize || 0
      const skillsCount = Array.isArray(activeVersion?.marketProfile?.skills) ? activeVersion.marketProfile.skills.length : 0

      if (
        activeVersion &&
        activeVersion.marketProfile &&
        sampleSize >= MIN_SAMPLE_THRESHOLD &&
        skillsCount >= MIN_SKILLS_THRESHOLD
      ) {
        return {
          status: 'available',
          bucketKey,
          version: activeVersion.version,
          sampleSize,
          marketProfile: activeVersion.marketProfile,
          jobs: activeVersion.jobs || [],
          lastRefreshedAt: bucket.lastSuccessfulRefreshAt,
        }
      } else if (activeVersion) {
        console.warn(
          `[MarketJdRetriever] Bucket ${bucketKey} active version v${activeVersion.version} has insufficient sample (${sampleSize} JDs < ${MIN_SAMPLE_THRESHOLD} or ${skillsCount} skills < ${MIN_SKILLS_THRESHOLD}). Treating as cold to prevent cache poisoning.`
        )
      }
    }

    // 2. EMPTY / COLD BUCKET: Trigger Synchronous Fast-Catch (target: 35 JDs, 50s timeout)
    if (!options.bypassFastCatch) {
      const fastCatchRes = await triggerFastCatchForBucket(bucketKey, {
        targetCount: options.targetCount || 35,
        timeoutMs: options.timeoutMs || 50000,
        autoRefresh,
        mockJds: options.mockJds || null,
        roleName: options.roleName || bucket?.roleName || null,
      })
      if (fastCatchRes?.status === 'healthy' && fastCatchRes.marketProfile) {
        return fastCatchRes
      }

      // 3. Fallback to nearest populated experienceBucket for the same roleKey
      const adjacentFallback = await findNearestPopulatedBucket(bucketKey)
      if (adjacentFallback) {
        console.log(`[MarketJdRetriever] Serving adjacent populated bucket ${adjacentFallback.bucket.bucketKey} for ${bucketKey}`)
        if (autoRefresh) {
          enqueueFullBackgroundBucket(bucketKey).catch(() => {})
        }
        return {
          status: 'available',
          bucketKey: adjacentFallback.bucket.bucketKey,
          originalBucketKey: bucketKey,
          isFallback: true,
          fallbackReason: `Adjacent experience level (${adjacentFallback.adjacentExp})`,
          version: adjacentFallback.version.version,
          sampleSize: adjacentFallback.version.jobs?.length || adjacentFallback.version.marketProfile?.sampleSize || 0,
          marketProfile: adjacentFallback.version.marketProfile,
          jobs: adjacentFallback.version.jobs || [],
          lastRefreshedAt: adjacentFallback.bucket.lastSuccessfulRefreshAt,
        }
      }

      // 4. Background queue fallback if no adjacent bucket exists
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
    }

    // If fast-catch was explicitly bypassed, check adjacent fallback or enqueue
    const adjacentFallback = await findNearestPopulatedBucket(bucketKey)
    if (adjacentFallback) {
      if (autoRefresh) {
        enqueueFullBackgroundBucket(bucketKey).catch(() => {})
      }
      return {
        status: 'available',
        bucketKey: adjacentFallback.bucket.bucketKey,
        originalBucketKey: bucketKey,
        isFallback: true,
        fallbackReason: `Adjacent experience level (${adjacentFallback.adjacentExp})`,
        version: adjacentFallback.version.version,
        sampleSize: adjacentFallback.version.jobs?.length || adjacentFallback.version.marketProfile?.sampleSize || 0,
        marketProfile: adjacentFallback.version.marketProfile,
        jobs: adjacentFallback.version.jobs || [],
        lastRefreshedAt: adjacentFallback.bucket.lastSuccessfulRefreshAt,
      }
    }

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
  MIN_SAMPLE_THRESHOLD,
  MIN_SKILLS_THRESHOLD,
}
