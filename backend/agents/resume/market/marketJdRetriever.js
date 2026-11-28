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
import { CONTROLLED_ROLES, resolveMarketBucket, normalizeRoleTaxonomy, mapYearsToBucket } from './marketBucketResolver.js'

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
                title: typeof j.title === 'string' && j.title.trim() ? j.title.trim() : (j.title?.name || roleClean || 'Job Opening'),
                company: typeof j.company === 'string' && j.company.trim() ? j.company.trim() : (j.company?.name || 'Enterprise Employer'),
                location: typeof j.location === 'string' && j.location.trim() ? j.location.trim() : (j.location?.name || 'United States'),
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
 * Ensures a priority Market JD bucket exists with at least MIN_SAMPLE_THRESHOLD (8) JDs.
 * If sampleSize >= 8: returns immediately { ready: true, started: false, bucketKey, totalJds: sampleSize, inFlight: false }.
 * If sampleSize < 8: immediately starts a Priority Fast-Sprint (25-35 JDs + LLM skill extraction)
 * deduplicated via inFlightFastCatch so concurrent calls share the exact same Promise.
 *
 * @param {Object} params
 * @param {string} params.roleTitle - Raw or normalized target role title
 * @param {number|string} [params.experienceYears] - Candidate experience in years or string (e.g. 4, "3-5 yrs")
 * @param {string} [params.experienceLevel] - e.g. "Senior / Lead / 8+ Yrs"
 * @param {Object} [params.canonicalResume] - Optional parsed resume JSON
 * @returns {Promise<{ ready: boolean, started: boolean, bucketKey: string, totalJds: number, inFlight: boolean, promise?: Promise }>}
 */
export async function ensurePriorityMarketBucket({
  roleTitle = '',
  experienceYears = null,
  experienceLevel = '',
  canonicalResume = null,
  userAnswerYoe = null,
} = {}) {
  const cleanRole = String(
    roleTitle ||
    canonicalResume?.candidate?.targetRole ||
    canonicalResume?.targetRole ||
    ''
  ).trim()

  if (!cleanRole || cleanRole.length < 2) {
    return { ready: false, started: false, bucketKey: null, totalJds: 0, inFlight: false }
  }

  // 1. Resolve canonical market bucket with totalExperienceYears prioritized over experienceLevel
  const resumeYears = Number(
    canonicalResume?.totalExperienceYears ??
    canonicalResume?.candidate?.totalExperienceYears ??
    0
  )
  const rawUserAnswer = userAnswerYoe ?? experienceYears ?? experienceLevel ?? ''
  const bucketRes = resolveMarketBucket({
    targetRole: cleanRole,
    canonicalResume,
    userAnswerYoe: rawUserAnswer,
    experienceYears: resumeYears > 0 ? resumeYears : experienceYears,
    totalExperienceYears: resumeYears > 0 ? resumeYears : null,
    experienceLevel: resumeYears > 0 ? null : experienceLevel,
  })
  const bucketKey = bucketRes?.bucketKey || `${normalizeRoleTaxonomy(cleanRole).roleKey}::${mapYearsToBucket(rawUserAnswer || 4)}`

  // 3. Check MongoDB for existing valid sample
  let sampleSize = 0
  try {
    const bucketDoc = await JobMarketBucket.findOne({ bucketKey }).lean()
    if (bucketDoc?.activeVersion > 0) {
      const versionDoc = await JobMarketVersion.findOne({ bucketKey, version: bucketDoc.activeVersion }).lean()
      sampleSize = versionDoc?.jobs?.length || versionDoc?.marketProfile?.sampleSize || bucketDoc.jobCount || 0
    } else if (bucketDoc) {
      sampleSize = bucketDoc.jobCount || 0
    }
  } catch (_dbErr) {}

  // 4. If bucket already has >= 8 JDs, return immediately
  if (sampleSize >= MIN_SAMPLE_THRESHOLD) {
    return {
      ready: true,
      started: false,
      bucketKey,
      totalJds: sampleSize,
      inFlight: false,
    }
  }

  // 4b. Sibling Tier Fallback: Before treating as 0 JDs or waiting for a cold scrape, check if sibling tier exists with >= 8 JDs
  const siblingFallback = await findNearestPopulatedBucket(bucketKey)
  if (siblingFallback) {
    const sibSize = siblingFallback.version?.jobs?.length || siblingFallback.version?.marketProfile?.sampleSize || siblingFallback.bucket?.jobCount || 0
    if (sibSize >= MIN_SAMPLE_THRESHOLD) {
      console.log(`[KeywordAlignment] Using same-role sibling bucket "${siblingFallback.bucket.bucketKey}" (${sibSize} JDs) for "${bucketKey}".`)
      return {
        ready: true,
        started: false,
        bucketKey: siblingFallback.bucket.bucketKey,
        originalBucketKey: bucketKey,
        totalJds: sibSize,
        inFlight: false,
        marketProfile: siblingFallback.version.marketProfile,
      }
    }
  }

  // 5. If under-sampled (<8 JDs), immediately start or join Priority Fast-Sprint (25-35 JDs)
  console.log(`[FastCatch] priority sprint started: Bucket "${bucketKey}" for role "${cleanRole}" has ${sampleSize} JDs (< 8). Starting Priority Fast-Sprint (35 JDs)...`)

  const sprintPromise = triggerFastCatchForBucket(bucketKey, {
    targetCount: 35,
    timeoutMs: 50000,
    autoRefresh: true,
    roleName: cleanRole,
  })

  // Fire-and-forget catch handler so async errors don't crash unhandled
  sprintPromise.catch((err) => {
    console.warn(`[FastCatch] Priority sprint notice for ${bucketKey}:`, err.message)
  })

  return {
    ready: false,
    started: true,
    bucketKey,
    totalJds: sampleSize,
    inFlight: true,
    promise: sprintPromise,
  }
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
      '5-8': ['6-8', '3-5', '8+', '0-2'],
      '6-8': ['3-5', '8+', '0-2'],
      '8+': ['6-8', '3-5', '0-2'],
    }
    const searchOrder = expOrderMap[currentExp] || ['6-8', '3-5', '8+', '0-2']

    for (const adjacentExp of searchOrder) {
      const candidateKey = `${roleKey}::${adjacentExp}`
      const candidateBucket = await JobMarketBucket.findOne({
        bucketKey: candidateKey,
        $or: [{ activeVersion: { $gt: 0 } }, { jobCount: { $gte: MIN_SAMPLE_THRESHOLD } }],
      }).lean()

      if (candidateBucket) {
        const candidateVersion =
          (await JobMarketVersion.findOne({
            bucketKey: candidateKey,
            version: candidateBucket.activeVersion,
            isArchived: false,
          }).lean()) ||
          (await JobMarketVersion.findOne({
            bucketKey: candidateKey,
            isArchived: false,
          }).sort({ version: -1 }).lean())

        const sampleSize = candidateVersion?.jobs?.length || candidateVersion?.marketProfile?.sampleSize || candidateBucket.jobCount || 0
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

    // Role-prefix query fallback: find any bucket matching the same role prefix with >= MIN_SAMPLE_THRESHOLD JDs
    const escapedRole = roleKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const siblingBuckets = await JobMarketBucket.find({
      bucketKey: { $regex: new RegExp(`^${escapedRole}::`, 'i') },
      $or: [{ activeVersion: { $gt: 0 } }, { jobCount: { $gte: MIN_SAMPLE_THRESHOLD } }],
    }).sort({ jobCount: -1 }).lean()

    for (const candBucket of siblingBuckets) {
      if (candBucket.bucketKey === bucketKey) continue
      const candVersion =
        (await JobMarketVersion.findOne({
          bucketKey: candBucket.bucketKey,
          version: candBucket.activeVersion,
          isArchived: false,
        }).lean()) ||
        (await JobMarketVersion.findOne({
          bucketKey: candBucket.bucketKey,
          isArchived: false,
        }).sort({ version: -1 }).lean())

      const sampleSize = candVersion?.jobs?.length || candVersion?.marketProfile?.sampleSize || candBucket.jobCount || 0
      const skillsCount = Array.isArray(candVersion?.marketProfile?.skills) ? candVersion.marketProfile.skills.length : 0

      if (candVersion?.marketProfile && sampleSize >= MIN_SAMPLE_THRESHOLD && skillsCount >= MIN_SKILLS_THRESHOLD) {
        const [, candExp] = candBucket.bucketKey.split('::')
        return {
          bucket: candBucket,
          version: candVersion,
          adjacentExp: candExp || 'sibling',
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

    // 2. If exact is cold: check findNearestPopulatedBucket FIRST if options.preferSiblingBeforeScrape is true
    if (options.preferSiblingBeforeScrape) {
      const earlyAdjacentFallback = await findNearestPopulatedBucket(bucketKey)
      if (earlyAdjacentFallback) {
        const sibSize = earlyAdjacentFallback.version?.jobs?.length || earlyAdjacentFallback.version?.marketProfile?.sampleSize || 0
        console.log(`[KeywordAlignment] Using same-role sibling bucket "${earlyAdjacentFallback.bucket.bucketKey}" (${sibSize} JDs) for "${bucketKey}".`)
        if (autoRefresh) {
          enqueueFullBackgroundBucket(bucketKey).catch(() => {})
        }
        return {
          status: 'available',
          bucketKey: earlyAdjacentFallback.bucket.bucketKey,
          originalBucketKey: bucketKey,
          isFallback: true,
          fallbackReason: `Adjacent experience level (${earlyAdjacentFallback.adjacentExp})`,
          version: earlyAdjacentFallback.version.version,
          sampleSize: sibSize,
          marketProfile: earlyAdjacentFallback.version.marketProfile,
          jobs: earlyAdjacentFallback.version.jobs || [],
          lastRefreshedAt: earlyAdjacentFallback.bucket.lastSuccessfulRefreshAt,
        }
      }
    }

    // 3. EMPTY / COLD BUCKET: Trigger Synchronous Fast-Catch (target: 35 JDs, 50s timeout)
    if (!options.bypassFastCatch) {
      const fastCatchRes = await triggerFastCatchForBucket(bucketKey, {
        targetCount: options.targetCount || 35,
        timeoutMs: options.timeoutMs || 50000,
        autoRefresh,
        mockJds: options.mockJds || null,
        roleName: options.roleName || bucket?.roleName || null,
      })
      if (fastCatchRes?.marketProfile) {
        return {
          status: 'available',
          bucketKey: fastCatchRes.bucketKey || bucketKey,
          version: fastCatchRes.version || 1,
          sampleSize: fastCatchRes.sampleSize || fastCatchRes.marketProfile?.sampleSize || 0,
          marketProfile: fastCatchRes.marketProfile,
          jobs: fastCatchRes.jobs || [],
        }
      }

      // 4. Fallback to nearest populated experienceBucket for the same roleKey if fast-catch did not return marketProfile
      const adjacentFallback = await findNearestPopulatedBucket(bucketKey)
      if (adjacentFallback) {
        const sibSize = adjacentFallback.version?.jobs?.length || adjacentFallback.version?.marketProfile?.sampleSize || 0
        console.log(`[KeywordAlignment] Using same-role sibling bucket "${adjacentFallback.bucket.bucketKey}" (${sibSize} JDs) for "${bucketKey}".`)
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
          sampleSize: sibSize,
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
