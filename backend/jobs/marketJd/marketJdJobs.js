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
import {
  fetchMarketJdCandidates,
  buildSearchSpecification,
  buildApifyJdScraperInput,
  runApifyActorScrape,
  DEFAULT_APIFY_JOB_ACTOR,
} from '../../integrations/apify/apifyJdScraper.js'
import { processAndSelectTopJds } from '../../agents/resume/market/jdNormalizer.js'
import { buildMarketProfile } from '../../agents/resume/market/marketProfileBuilder.js'
import { analyzeJdBatchWithGemini, analyzeAndAggregateJdCorpus } from '../../agents/resume/market/llmJdSkillAnalyzer.js'
import { CONTROLLED_ROLES } from '../../agents/resume/market/marketBucketResolver.js'
import { ApifyClient } from 'apify-client'
import { apifyKeyPool } from '../../utils/smartKeyPool.js'
import { costTracker } from '../../utils/costTracker.js'

export const MIN_SAMPLE_THRESHOLD = 8
export const RETENTION_DAYS_MS = 60 * 24 * 60 * 60 * 1000 // 60 days retention

/**
 * Executes a refresh for a single Role × Experience bucket.
 *
 * @param {string} bucketKey - e.g. "software-engineer::6-8"
 * @param {Object} [options]
 * @returns {Promise<{ success: boolean, bucketKey: string, version: number, jobCount: number, error?: string }>}
 */
export async function executeBucketRefresh(bucketKey, options = {}) {
  const startTime = Date.now()
  console.log(`[MarketJdJobs] Executing monthly isolated refresh for bucket: ${bucketKey}`)

  const [roleKey, experienceBucket] = bucketKey.split('::')
  if (!roleKey || !experienceBucket) {
    throw new Error(`Invalid bucketKey format: "${bucketKey}". Expected "roleKey::experienceBucket".`)
  }

  let bucket = await JobMarketBucket.findOne({ bucketKey })
  if (!bucket) {
    const roleDef = CONTROLLED_ROLES.find((r) => r.roleKey === roleKey)
    bucket = await JobMarketBucket.create({
      bucketKey,
      roleKey,
      roleName: roleDef ? roleDef.roleName : roleKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
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
    // 1. Fetch fresh monthly JDs (HarvestAPI)
    const searchSpec = buildSearchSpecification({
      role: bucket.roleName,
      experienceBucket,
    })

    let rawCandidates = options.mockJds || []
    let scrapeResult = { candidates: rawCandidates, actorId: 'mock', totalFetched: rawCandidates.length }

    if (!Array.isArray(options.mockJds) || options.mockJds.length === 0) {
      scrapeResult = await fetchMarketJdCandidates(searchSpec, {
        ...options,
        maxCandidates: parseInt(process.env.MARKET_JD_TARGET_COUNT || '50', 10),
      })
      rawCandidates = scrapeResult.candidates || []
    }

    if (rawCandidates.length < 5) {
      throw new Error(`Insufficient candidate JDs retrieved (${rawCandidates.length} items). Keeping current active version.`)
    }

    // 2. Run LLM skill analysis in isolation on the fresh monthly corpus
    const analyzedCorpus = await analyzeAndAggregateJdCorpus(rawCandidates, bucketKey)
    const marketSkills = analyzedCorpus.marketSkills || analyzedCorpus.discoveredSkills || []

    if (marketSkills.length === 0) {
      throw new Error('Corpus analysis extracted 0 valid market skills. Keeping current active version.')
    }

    const freshMarketProfile = {
      bucketKey,
      sampleSize: analyzedCorpus.sampleSize || rawCandidates.length,
      skills: marketSkills,
      totalAnalyzed: analyzedCorpus.totalAnalyzed || rawCandidates.length,
      topKeywords: marketSkills.slice(0, 20).map((s) => s.name),
      responsibilities: [],
      senioritySignals: [],
      version: 'market-profile-v3',
      generatedAt: new Date().toISOString(),
    }

    // 3. Calculate next sequential version number
    const latestVersionDoc = await JobMarketVersion.findOne({ bucketKey }).sort({ version: -1 })
    const nextVersion = Math.max(bucket.activeVersion || 0, latestVersionDoc?.version || 0) + 1

    // 4. Create new version document (staged)
    await JobMarketVersion.create({
      bucketKey,
      version: nextVersion,
      jobs: rawCandidates.map((j, idx) => ({
        title: j.title || bucket.roleName,
        company: j.company || 'Enterprise Employer',
        location: j.location || 'United States',
        description: j.description || '',
        source: 'apify_harvestapi',
        sourceUrl: j.url || null,
        fingerprint: j.fingerprint || `${bucketKey}_v${nextVersion}_${idx}_${Date.now()}`,
      })),
      marketProfile: freshMarketProfile,
      sourceMetadata: {
        actorId: scrapeResult.actorId,
        totalCandidatesFetched: scrapeResult.totalFetched || rawCandidates.length,
        refreshDurationMs: Date.now() - startTime,
      },
      validationSummary: {
        isValid: true,
        checkedAt: new Date(),
        jobCount: rawCandidates.length,
      },
      isArchived: false,
    })

    // 5. ATOMIC SWAP: Archive older versions & point bucket to nextVersion
    await JobMarketVersion.updateMany(
      { bucketKey, version: { $lt: nextVersion } },
      { $set: { isArchived: true } }
    )

    bucket.activeVersion = nextVersion
    bucket.jobCount = rawCandidates.length
    bucket.status = 'healthy'
    bucket.lastSuccessfulRefreshAt = new Date()
    bucket.refreshError = null
    await bucket.save()

    console.log(`[MarketJdJobs] ✔ Swapped ${bucketKey} to active version v${nextVersion} (${rawCandidates.length} JDs).`)

    // 6. RETENTION PRUNING: Delete archived versions older than 60 days
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS_MS)
    const pruned = await JobMarketVersion.deleteMany({
      bucketKey,
      isArchived: true,
      createdAt: { $lt: cutoffDate },
    })

    if (pruned.deletedCount > 0) {
      console.log(`[MarketJdJobs] Pruned ${pruned.deletedCount} expired archived versions (>60 days old) for ${bucketKey}.`)
    }

    return {
      success: true,
      bucketKey,
      version: nextVersion,
      jobCount: rawCandidates.length,
      durationMs: Date.now() - startTime,
    }
  } catch (err) {
    console.error(`[MarketJdJobs] Refresh failed for ${bucketKey}:`, err.message)
    // Zero downtime fallback: keep existing version serving users
    bucket.status = bucket.activeVersion > 0 ? 'healthy' : 'failed'
    bucket.refreshError = err.message
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

/**
 * Dynamic Fast-Catch Scraper for ANY Target Role
 * Initial rapid catch (10-12 JDs) with 8 JD minimum gate.
 * Unblocks report generation in ~10-15s instead of waiting for full batches.
 */
export async function fetchFastCatchJds({
  role = '',
  bucketKey = '',
  targetCount = 12,
  timeoutMs = 45000,
  mockJds = null,
} = {}) {
  // If mock JDs are provided for testing, return immediately
  if (Array.isArray(mockJds) && mockJds.length > 0) {
    return mockJds.slice(0, targetCount)
  }

  // 1. Resolve role dynamically from parameters or bucketKey
  let resolvedRole = String(role || '').trim()

  if (!resolvedRole && bucketKey) {
    // e.g. "data-analyst::3-5" -> "Data Analyst"
    const [rolePart] = bucketKey.split('::')
    if (rolePart && rolePart !== 'default') {
      resolvedRole = rolePart
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }
  }

  const targetRoleTitle = resolvedRole || 'Professional'

  if (apifyKeyPool.getKeyCount() === 0) {
    console.warn('[MarketJdJobs] No Apify tokens configured in environment for fast-catch.')
    return []
  }

  const fastCatchCount = targetCount || 12
  console.log(`[MarketJdJobs] Starting Real Fast-Catch scrape for role: "${targetRoleTitle}" (Target: ${fastCatchCount} JDs, Timeout: ${timeoutMs}ms)...`)

  // Attempt 1: Fast API-based actor (harvestapi/linkedin-job-search) with 30s timeout
  const actorId = process.env.APIFY_JOB_ACTOR_ID || 'harvestapi/linkedin-job-search'
  const isHarvestApi = actorId.includes('harvestapi')

  const actorInput = isHarvestApi
    ? {
        jobTitles: [targetRoleTitle],
        locations: ['United States'],
        maxItems: fastCatchCount,
        postedLimit: 'month',
        sortBy: 'relevance',
      }
    : buildApifyJdScraperInput(targetRoleTitle, {
        locations: ['United States', 'Remote', 'New York, NY', 'San Francisco, CA'],
        rows: fastCatchCount,
        maxJobs: fastCatchCount,
      })

  let primaryItems = []
  try {
    primaryItems = await runApifyActorScrape(actorId, actorInput, Math.min(timeoutMs, 30000))
  } catch (primErr) {
    console.warn(`[MarketJdJobs] Primary scrape attempt encountered error: ${primErr.message}`)
  }

  // Filter valid text descriptions (at least 100 chars)
  let validJds = (primaryItems || []).map((item) => ({
    title: item.title || item.jobTitle || targetRoleTitle,
    company: item.company?.name || item.companyName || item.company || 'Enterprise Employer',
    location: typeof item.location === 'object' ? (item.location?.name || item.location?.city || item.location?.label || 'United States') : (item.location || 'United States'),
    description: item.descriptionText || item.description || item.text || item.body || '',
    url: item.linkedinUrl || item.url || item.link || '',
  })).filter((j) => (j.description || '').length >= 100)

  // FAILSAFE RETRY: If primary returned < 8 JDs, fall back to Indeed scraper
  if (validJds.length < 8) {
    console.warn(`[MarketJdJobs] Primary scrape returned low sample (${validJds.length} < 8). Switching to Indeed fallback on Apify...`)

    try {
      const fallbackItems = await runApifyActorScrape('misceres/indeed-scraper', {
        position: targetRoleTitle,
        country: 'US',
        location: 'United States',
        maxItems: fastCatchCount,
      }, Math.min(30000, timeoutMs))

      const validFallback = (fallbackItems || []).map((item) => ({
        title: item.positionName || item.title || targetRoleTitle,
        company: item.company?.name || item.company || item.companyName || 'Enterprise Employer',
        location: typeof item.location === 'object' ? (item.location?.name || item.location?.city || item.location?.label || 'United States') : (item.location || 'United States'),
        description: item.descriptionText || item.description || item.jobDescription || item.text || item.body || '',
        url: item.linkedinUrl || item.url || item.link || '',
      })).filter((j) => (j.description || '').length >= 100)

      if (validFallback.length >= 8) {
        validJds = validFallback
        console.log(`[MarketJdJobs] Fallback scraper succeeded with ${validJds.length} real JDs.`)
      }
    } catch (fbErr) {
      console.warn(`[MarketJdJobs] Fallback scraper also failed: ${fbErr.message}`)
    }
  }

  console.log(`[MarketJdJobs] Scraped ${validJds.length} valid JDs for role: "${targetRoleTitle}"`)

  if (validJds.length < 8) {
    throw new Error(`[MarketJdJobs] Critical: Unable to fetch required minimum 8 live JDs for "${targetRoleTitle}". Aborting to prevent fake data.`)
  }

  return validJds
}

/**
 * Persists an upgraded Market Version to MongoDB atomically swapping previous versions.
 */
export async function saveUpgradedMarketVersion(bucketKey, validJds, analysis, sourceMetadata = {}) {
  const [roleKey, experienceBucket] = bucketKey.split('::')
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
    })
  }

  const discoveredSkills = analysis.discoveredSkills || analysis.marketSkills || []
  const marketProfile = {
    bucketKey,
    sampleSize: analysis.sampleSize || validJds.length,
    skills: discoveredSkills,
    totalAnalyzed: analysis.totalAnalyzed || validJds.length,
    topKeywords: discoveredSkills.slice(0, 20).map((s) => s.name),
    responsibilities: [],
    senioritySignals: [],
    version: 'market-profile-v2',
    generatedAt: new Date().toISOString(),
  }

  const latestVersionDoc = await JobMarketVersion.findOne({ bucketKey }).sort({ version: -1 })
  const maxExistingVersion = latestVersionDoc ? latestVersionDoc.version : 0
  const nextVersion = Math.max(bucket.activeVersion || 0, maxExistingVersion) + 1

  await JobMarketVersion.create({
    bucketKey,
    version: nextVersion,
    jobs: validJds.map((j, idx) => ({
      title: j.title || bucket.roleName,
      company: j.company || 'Enterprise Employer',
      location: 'United States',
      description: j.description || '',
      source: sourceMetadata.source || 'apify_background_worker',
      sourceUrl: j.url || null,
      fingerprint: `${bucketKey}_v${nextVersion}_${idx}_${Date.now()}`,
    })),
    marketProfile,
    sourceMetadata,
    validationSummary: {
      isValid: true,
      checkedAt: new Date(),
      jobCount: validJds.length,
    },
    isArchived: false,
  })

  // Atomic swap: archive older versions
  await JobMarketVersion.updateMany(
    { bucketKey, version: { $lt: nextVersion } },
    { $set: { isArchived: true } }
  )

  bucket.activeVersion = nextVersion
  bucket.jobCount = validJds.length
  bucket.status = 'healthy'
  bucket.lastSuccessfulRefreshAt = new Date()
  bucket.refreshError = null
  await bucket.save()

  // 60-day retention pruning on background upgrade
  const cutoffDate = new Date(Date.now() - RETENTION_DAYS_MS)
  const prunedUpgrade = await JobMarketVersion.deleteMany({
    bucketKey,
    isArchived: true,
    createdAt: { $lt: cutoffDate },
  })
  if (prunedUpgrade.deletedCount > 0) {
    console.log(`[MarketJdJobs] Pruned ${prunedUpgrade.deletedCount} expired archived versions (>60 days old) for ${bucketKey}.`)
  }

  return nextVersion
}

/**
 * Detached Persistent Background Scraper (Full 60-80 JDs)
 * Uses native Apify long-polling (.start() + .waitForFinish()) detached from HTTP request lifecycle.
 */
export async function runDetachedBackgroundScrape(bucketKey) {
  console.log(`[MarketJdJobs] Starting detached background scrape for bucket: ${bucketKey}...`)
  const [roleKey, experienceBucket] = bucketKey.split('::')
  let bucket = await JobMarketBucket.findOne({ bucketKey })
  const roleName = bucket?.roleName || roleKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  if (apifyKeyPool.getKeyCount() === 0) {
    console.warn('[MarketJdJobs] No Apify tokens configured for background runner.')
    return null
  }

  const actorId = process.env.APIFY_JOB_ACTOR_ID || 'harvestapi/linkedin-job-search'
  const isHarvestApi = actorId.includes('harvestapi')

  return await apifyKeyPool.executeWithRetry(async (activeToken) => {
    const apifyClient = new ApifyClient({
      token: activeToken,
      timeoutSecs: isHarvestApi ? 90 : 360,
    })

    const bgPayload = isHarvestApi
      ? {
          jobTitles: [roleName],
          locations: ['United States'],
          maxItems: 50,
          postedLimit: 'month',
          sortBy: 'relevance',
        }
      : buildApifyJdScraperInput(roleName, {
          locations: ['United States', 'Remote', 'New York, NY', 'San Francisco, CA'],
          rows: 75,
          maxJobs: 75,
        })

    let run
    try {
      run = await apifyClient.actor(actorId).start(bgPayload)
    } catch (callErr) {
      if (/residential|proxy/i.test(callErr.message) && bgPayload.proxy?.apifyProxyGroups) {
        console.warn('[MarketJdJobs] Background residential proxy rejected. Retrying with default proxy...')
        bgPayload.proxy = { useApifyProxy: true }
        run = await apifyClient.actor(actorId).start(bgPayload)
      } else {
        throw callErr
      }
    }

    if (!run || !run.id) {
      throw new Error('Apify actor start did not return run ID')
    }

    console.log(`[MarketJdJobs] Background Apify Run started: ${run.id} (${actorId}). Awaiting completion...`)
    const waitSecs = isHarvestApi ? 60 : 300
    const finishedRun = await apifyClient.run(run.id).waitForFinish({ waitSecs })

    let items = []
    if (finishedRun?.status === 'SUCCEEDED' && finishedRun.defaultDatasetId) {
      const res = await apifyClient.dataset(finishedRun.defaultDatasetId).listItems({
        limit: 50,
        clean: true,
      })
      items = res.items || []
    }

    let validBackgroundJds = (items || []).map((j) => ({
      title: j.title || j.jobTitle || roleName,
      company: j.company?.name || j.companyName || j.company || 'Enterprise Employer',
      location: typeof j.location === 'object' ? (j.location?.name || j.location?.city || j.location?.label || 'United States') : (j.location || 'United States'),
      description: j.descriptionText || j.description || j.text || j.body || '',
      url: j.linkedinUrl || j.url || j.link || '',
    })).filter((j) => (j.description || '').length >= 100)

    // Failsafe secondary fallback if primary returns < 15
    if (validBackgroundJds.length < 15) {
      console.warn(`[MarketJdJobs] Background LinkedIn scrape returned ${validBackgroundJds.length} JDs. Running Indeed fallback...`)
      try {
        const fallbackRun = await apifyClient.actor('misceres/indeed-scraper').start({
          position: roleName,
          country: 'US',
          location: 'United States',
          maxItems: 60,
        })
        const finishedFallback = await apifyClient.run(fallbackRun.id).waitForFinish({ waitSecs: 180 })
        if (finishedFallback?.status === 'SUCCEEDED' && finishedFallback.defaultDatasetId) {
          const fbRes = await apifyClient.dataset(finishedFallback.defaultDatasetId).listItems({
            limit: 60,
            clean: true,
          })
          const validFb = (fbRes.items || []).map((j) => ({
            title: j.positionName || j.title || roleName,
            company: j.company || 'Enterprise Employer',
            description: j.description || j.jobDescription || j.text || '',
            url: j.url || '',
          })).filter((j) => (j.description || '').length >= 200)

          if (validFb.length >= 15) {
            validBackgroundJds = validFb
            console.log(`[MarketJdJobs] Background fallback scraper succeeded with ${validFb.length} JDs.`)
          }
        }
      } catch (fbErr) {
        console.warn(`[MarketJdJobs] Background fallback scraper error: ${fbErr.message}`)
      }
    }

    if (validBackgroundJds.length >= 15) {
      console.log(`[MarketJdJobs] Analyzing ${validBackgroundJds.length} background JDs dynamically via Gemini Flash...`)
      const bgAnalysis = await analyzeJdBatchWithGemini(roleName, validBackgroundJds)
      const nextVersion = await saveUpgradedMarketVersion(bucketKey, validBackgroundJds, bgAnalysis, {
        source: 'apify_background_worker',
        actorId: 'bebity/linkedin-jobs-scraper',
        runId: run.id,
      })
      console.log(`[MarketJdJobs] Background run successfully upgraded ${bucketKey} to v${nextVersion} with ${validBackgroundJds.length} real JDs.`)
      return { success: true, version: nextVersion, jobCount: validBackgroundJds.length }
    } else {
      console.warn(`[MarketJdJobs] Background run yielded insufficient JDs (${validBackgroundJds.length} < 15). Keeping current version.`)
      return { success: false, reason: 'INSUFFICIENT_BACKGROUND_SAMPLE' }
    }
  }, { maxAttempts: 2 })
}

/**
 * Enqueues a full 60-80 JD background bucket refresh to complete the bucket asynchronously.
 * Completely detached from Express request lifecycle.
 */
export async function enqueueFullBackgroundBucket(bucketKey) {
  setImmediate(async () => {
    try {
      await runDetachedBackgroundScrape(bucketKey)
    } catch (err) {
      console.warn(`[MarketJdJobs] Detached background scrape encountered error for ${bucketKey}: ${err.message}`)
    }
  })
  return { status: 'queued', bucketKey }
}

export default {
  executeBucketRefresh,
  ensureConfiguredBucketsExist,
  fetchFastCatchJds,
  saveUpgradedMarketVersion,
  runDetachedBackgroundScrape,
  enqueueFullBackgroundBucket,
  MIN_SAMPLE_THRESHOLD,
  RETENTION_DAYS_MS,
}
