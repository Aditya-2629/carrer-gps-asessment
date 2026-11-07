/**
 * Admin Dynamic Engine Controller — Zero-Restart Dynamic Controls & Telemetry
 *
 * Implements:
 * - Dynamic target role creation across all 4 experience tiers (0-2, 3-5, 6-8, 8+)
 * - Live scrape slider adjustment (Fast-Catch 25/35/50 & Background Targets)
 * - In-memory key injection with sticky promotion (Apify, Gemini, OpenRouter)
 * - 1-Click live scrape execution on individual role buckets
 * - Live key telemetry & bucket health configuration retrieval
 */

import JobMarketBucket from '../models/JobMarketBucket.js'
import { apifyKeyPool, geminiKeyPool } from '../utils/smartKeyPool.js'
import {
  fetchFastCatchJds,
  runDetachedBackgroundScrape,
} from '../jobs/marketJd/marketJdJobs.js'
import { enqueueBucketRefresh } from '../jobs/marketJd/marketJdQueue.js'

// In-Memory Runtime Engine Configuration (allows real-time slider updates without restarting node)
export const runtimeEngineConfig = {
  fastCatchTargetJds: parseInt(process.env.FAST_CATCH_TARGET_JDS || '35', 10),
  backgroundTargetJds: parseInt(process.env.MARKET_JD_TARGET_COUNT || '50', 10),
  lastUpdated: new Date(),
}

function maskKey(key) {
  if (!key || typeof key !== 'string') return 'Not Configured'
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••' + trimmed.slice(-2)
  return trimmed.slice(0, 4) + '••••' + trimmed.slice(-4)
}

// ─── GET /api/admin/engine/config ───────────────────────────────────────────

export async function getEngineConfig(_req, res) {
  try {
    // 1. Scrape Targets
    const scrapeTargets = {
      fastCatchTargetJds: runtimeEngineConfig.fastCatchTargetJds,
      backgroundTargetJds: runtimeEngineConfig.backgroundTargetJds,
      lastUpdated: runtimeEngineConfig.lastUpdated,
    }

    // 2. Key Pools Telemetry
    const apifyKeys = apifyKeyPool.getAllKeys()
    const activeApifyKey = apifyKeyPool.getActiveKey()
    const geminiKeys = geminiKeyPool.getAllKeys()
    const activeGeminiKey = geminiKeyPool.getActiveKey()
    const openRouterKey = process.env.OPENROUTER_API_KEY || ''

    const keyPools = {
      apify: {
        service: 'Apify',
        count: apifyKeys.length,
        activeKeyMasked: maskKey(activeApifyKey),
        keys: apifyKeys.map((k, idx) => ({
          index: idx,
          masked: maskKey(k),
          isPrimary: k === activeApifyKey,
          isCooling: apifyKeyPool.cooldowns.has(k) && apifyKeyPool.cooldowns.get(k) > Date.now(),
        })),
        cooldownCount: apifyKeyPool.cooldowns.size,
      },
      gemini: {
        service: 'Gemini',
        count: geminiKeys.length,
        activeKeyMasked: maskKey(activeGeminiKey),
        keys: geminiKeys.map((k, idx) => ({
          index: idx,
          masked: maskKey(k),
          isPrimary: k === activeGeminiKey,
        })),
      },
      openrouter: {
        service: 'OpenRouter',
        configured: Boolean(openRouterKey),
        activeKeyMasked: maskKey(openRouterKey),
        defaultModel: 'typesafe/jev-1.14',
      },
    }

    // 3. Bucket Health Summary
    const buckets = await JobMarketBucket.find({}).lean()
    const bucketSummary = {
      total: buckets.length,
      healthy: buckets.filter((b) => b.status === 'healthy').length,
      needs_refresh: buckets.filter((b) => b.status === 'needs_refresh').length,
      refreshing: buckets.filter((b) => b.status === 'refreshing').length,
      empty: buckets.filter((b) => b.status === 'empty').length,
      failed: buckets.filter((b) => b.status === 'failed').length,
      totalJds: buckets.reduce((acc, b) => acc + (b.jobCount || 0), 0),
    }

    return res.status(200).json({
      success: true,
      scrapeTargets,
      keyPools,
      bucketSummary,
    })
  } catch (err) {
    console.error('[AdminDynamicController] getEngineConfig error:', err)
    return res.status(500).json({ success: false, message: 'Failed to retrieve engine config.' })
  }
}

// ─── POST /api/admin/engine/roles ───────────────────────────────────────────

export async function createDynamicRole(req, res) {
  try {
    const { roleName, specialization = 'general' } = req.body || {}

    if (!roleName || !String(roleName).trim()) {
      return res.status(400).json({ success: false, message: 'roleName is required.' })
    }

    const cleanRoleName = String(roleName).trim()
    const roleKey = cleanRoleName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const EXPERIENCE_TIERS = ['0-2', '3-5', '6-8', '8+']
    const createdBuckets = []

    for (const exp of EXPERIENCE_TIERS) {
      const bucketKey = `${roleKey}::${exp}`
      let bucket = await JobMarketBucket.findOne({ bucketKey })

      if (!bucket) {
        bucket = await JobMarketBucket.create({
          bucketKey,
          roleKey,
          roleName: cleanRoleName,
          specialization: String(specialization || 'general').trim(),
          experienceBucket: exp,
          activeVersion: 0,
          status: 'empty',
          jobCount: 0,
        })
      }
      createdBuckets.push(bucket)
    }

    return res.status(201).json({
      success: true,
      message: `Successfully created 4 experience tier buckets for "${cleanRoleName}".`,
      roleKey,
      roleName: cleanRoleName,
      createdBuckets,
    })
  } catch (err) {
    console.error('[AdminDynamicController] createDynamicRole error:', err)
    return res.status(500).json({ success: false, message: 'Failed to create dynamic role.' })
  }
}

// ─── POST /api/admin/engine/scrape-slider ───────────────────────────────────

export async function updateScrapeSlider(req, res) {
  try {
    const { fastCatchTargetJds, backgroundTargetJds } = req.body || {}

    if (fastCatchTargetJds !== undefined) {
      const count = parseInt(fastCatchTargetJds, 10)
      if (isNaN(count) || count < 10 || count > 100) {
        return res.status(400).json({ success: false, message: 'fastCatchTargetJds must be between 10 and 100.' })
      }
      runtimeEngineConfig.fastCatchTargetJds = count
      process.env.FAST_CATCH_TARGET_JDS = String(count)
    }

    if (backgroundTargetJds !== undefined) {
      const count = parseInt(backgroundTargetJds, 10)
      if (isNaN(count) || count < 20 || count > 150) {
        return res.status(400).json({ success: false, message: 'backgroundTargetJds must be between 20 and 150.' })
      }
      runtimeEngineConfig.backgroundTargetJds = count
      process.env.MARKET_JD_TARGET_COUNT = String(count)
    }

    runtimeEngineConfig.lastUpdated = new Date()

    return res.status(200).json({
      success: true,
      message: 'Scraping slider targets updated live without restarting.',
      scrapeTargets: {
        fastCatchTargetJds: runtimeEngineConfig.fastCatchTargetJds,
        backgroundTargetJds: runtimeEngineConfig.backgroundTargetJds,
        lastUpdated: runtimeEngineConfig.lastUpdated,
      },
    })
  } catch (err) {
    console.error('[AdminDynamicController] updateScrapeSlider error:', err)
    return res.status(500).json({ success: false, message: 'Failed to update scrape sliders.' })
  }
}

// ─── POST /api/admin/engine/keys ────────────────────────────────────────────

export async function injectDynamicKey(req, res) {
  try {
    const { service, token } = req.body || {}

    if (!service || !token || !String(token).trim()) {
      return res.status(400).json({ success: false, message: 'service and token are required.' })
    }

    const s = String(service).toLowerCase().trim()
    const cleanToken = String(token).trim()

    if (s === 'apify') {
      apifyKeyPool.addKey(cleanToken, true)
      return res.status(200).json({
        success: true,
        message: 'New Apify token successfully injected into SmartKeyPool with primary priority.',
        service: 'apify',
        activeKeyMasked: maskKey(apifyKeyPool.getActiveKey()),
        totalKeys: apifyKeyPool.getKeyCount(),
      })
    }

    if (s === 'gemini') {
      geminiKeyPool.addKey(cleanToken, true)
      return res.status(200).json({
        success: true,
        message: 'New Gemini key successfully injected into SmartKeyPool with primary priority.',
        service: 'gemini',
        activeKeyMasked: maskKey(geminiKeyPool.getActiveKey()),
        totalKeys: geminiKeyPool.getKeyCount(),
      })
    }

    if (s === 'openrouter') {
      process.env.OPENROUTER_API_KEY = cleanToken
      return res.status(200).json({
        success: true,
        message: 'OpenRouter API key updated live in process memory.',
        service: 'openrouter',
        activeKeyMasked: maskKey(cleanToken),
      })
    }

    return res.status(400).json({ success: false, message: `Unknown service "${service}". Use apify, gemini, or openrouter.` })
  } catch (err) {
    console.error('[AdminDynamicController] injectDynamicKey error:', err)
    return res.status(500).json({ success: false, message: 'Failed to inject key.' })
  }
}

// ─── POST /api/admin/engine/scrape/:bucketKey ───────────────────────────────

export async function triggerLiveBucketScrape(req, res) {
  try {
    const { bucketKey } = req.params
    const { mode = 'fast_catch' } = req.body || {}

    const bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket) {
      return res.status(404).json({ success: false, message: `Bucket ${bucketKey} not found.` })
    }

    bucket.status = 'refreshing'
    bucket.lastAttemptedRefreshAt = new Date()
    await bucket.save()

    if (mode === 'fast_catch') {
      // Execute fast-catch asynchronously so response is instant
      fetchFastCatchJds({
        bucketKey,
        targetCount: runtimeEngineConfig.fastCatchTargetJds,
      })
        .then(async (jds) => {
          bucket.status = 'healthy'
          bucket.jobCount = Array.isArray(jds) ? jds.length : bucket.jobCount
          bucket.lastSuccessfulRefreshAt = new Date()
          await bucket.save()
        })
        .catch(async (err) => {
          bucket.status = 'failed'
          bucket.refreshError = err.message
          await bucket.save()
        })

      return res.status(202).json({
        success: true,
        message: `Fast-Catch scrape initiated for ${bucketKey} (Target: ${runtimeEngineConfig.fastCatchTargetJds} JDs).`,
        mode: 'fast_catch',
        bucketKey,
      })
    } else {
      // Full background scrape
      enqueueBucketRefresh(bucketKey)
        .then(() => {})
        .catch((err) => {
          console.warn(`[AdminDynamicController] Queue refresh fallback for ${bucketKey}:`, err.message)
          runDetachedBackgroundScrape(bucketKey).catch(() => {})
        })

      return res.status(202).json({
        success: true,
        message: `Full background scrape enqueued for ${bucketKey} (Target: ${runtimeEngineConfig.backgroundTargetJds} JDs).`,
        mode: 'full',
        bucketKey,
      })
    }
  } catch (err) {
    console.error('[AdminDynamicController] triggerLiveBucketScrape error:', err)
    return res.status(500).json({ success: false, message: 'Failed to trigger bucket scrape.' })
  }
}

