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

import mongoose from 'mongoose'
import JobMarketBucket from '../models/JobMarketBucket.js'
import AppSettings, { getGlobalSettings } from '../models/AppSettings.js'
import AgentRun from '../models/AgentRun.js'
import { apifyKeyPool, geminiKeyPool } from '../utils/smartKeyPool.js'
import {
  keyPools,
  getAllKeyPoolStats,
  toggleProviderKey,
  applyDbApiKeys,
  syncDbApiKeys,
} from '../ai/gateway/roundRobinKeyManager.js'
import {
  TASK_MODEL_ROUTING,
  TASK_METADATA,
  setModelOverrides,
} from '../ai/gateway/llmGateway.js'
import {
  fetchFastCatchJds,
  runDetachedBackgroundScrape,
} from '../jobs/marketJd/marketJdJobs.js'
import { enqueueBucketRefresh } from '../jobs/marketJd/marketJdQueue.js'

// In-Memory Runtime Engine Configuration (allows real-time slider updates without restarting node)
export const runtimeEngineConfig = {
  fastCatchTargetJds: parseInt(process.env.FAST_CATCH_TARGET_JDS || '35', 10),
  backgroundTargetJds: parseInt(process.env.MARKET_JD_TARGET_COUNT || '50', 10),
  primaryModel: process.env.PRIMARY_MODEL || 'google/gemini-2.5-flash-lite',
  fallbackModel: process.env.FALLBACK_MODEL || 'openai/gpt-oss-120b',
  enableLinkedinPlaybook: process.env.ENABLE_LINKEDIN_PLAYBOOK !== 'false',
  taskModels: {
    resumeAudit: process.env.RESUME_MODEL || 'google/gemini-2.5-flash-lite',
    linkedin: process.env.LINKEDIN_MODEL || 'google/gemini-2.5-flash-lite',
    unifiedSynthesis: process.env.SYNTHESIS_MODEL || 'openai/gpt-oss-120b',
    actionPlan: process.env.ACTION_PLAN_MODEL || 'google/gemini-2.5-flash-lite',
    jdExtraction: process.env.JD_MODEL || 'google/gemini-2.5-flash-lite',
    atlasChatbot: process.env.CHATBOT_MODEL || 'openai/gpt-oss-120b',
  },
  lastUpdated: new Date(),
}

function maskKey(key) {
  if (!key || typeof key !== 'string') return 'Not Configured'
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••' + trimmed.slice(-2)
  return trimmed.slice(0, 4) + '••••' + trimmed.slice(-4)
}

function inferProviderFromModel(modelId = '') {
  const m = String(modelId).toLowerCase()
  if (m.includes('gpt-oss') || m.startsWith('llama-')) return 'groq/openrouter'
  if (m.startsWith('typesafe/')) return 'openrouter-decisions'
  return 'openrouter'
}

async function buildTaskModelsPayload(overrides = {}) {
  const recentRuns = await AgentRun.find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .select('model cost')
    .lean()
    .catch(() => [])

  const modelTokenAgg = new Map()
  for (const r of recentRuns) {
    const m = r.model
    const inTok = Number(r?.cost?.inputTokens || 0)
    const outTok = Number(r?.cost?.outputTokens || 0)
    if (!m || (inTok <= 0 && outTok <= 0)) continue
    const cur = modelTokenAgg.get(m) || { inSum: 0, outSum: 0, count: 0 }
    cur.inSum += inTok
    cur.outSum += outTok
    cur.count += 1
    modelTokenAgg.set(m, cur)
  }

  return Object.entries(TASK_MODEL_ROUTING).map(([taskKey, defaultModel]) => {
    const meta = TASK_METADATA[taskKey] || {}
    const override = overrides?.[taskKey]
    const activeModel = typeof override === 'string' && override.trim() ? override.trim() : defaultModel
    const obs = modelTokenAgg.get(activeModel) || modelTokenAgg.get(defaultModel)
    const avgInputTokens = obs && obs.count > 0 ? Math.round(obs.inSum / obs.count) : (meta.avgInputTokens || 2000)
    const avgOutputTokens = obs && obs.count > 0 ? Math.round(obs.outSum / obs.count) : (meta.avgOutputTokens || 700)

    return {
      taskKey,
      label: meta.label || taskKey,
      provider: inferProviderFromModel(activeModel),
      activeModel,
      defaultModel,
      fallbackModel: meta.fallbackModel || 'google/gemini-3.5-flash-lite',
      avgInputTokens,
      avgOutputTokens,
      isOverridden: Boolean(typeof override === 'string' && override.trim() && override.trim() !== defaultModel),
    }
  })
}

const UI_TASK_ALIASES = {
  resumeAudit: 'resume_synthesis',
  linkedin: 'linkedin_synthesis',
  unifiedSynthesis: 'unified_synthesis',
  actionPlan: 'action_plan_generation',
  jdExtraction: 'jd_extraction',
  atlasChatbot: 'career_chatbot',
}

async function buildTaskModelsSummary(overrides = {}) {
  const details = await buildTaskModelsPayload(overrides)
  const byKey = new Map(details.map((d) => [d.taskKey, d]))

  const taskModels = {}
  const avgTokens = {}
  for (const [uiKey, backendKey] of Object.entries(UI_TASK_ALIASES)) {
    const info = byKey.get(backendKey)
    const directOverride = overrides?.[uiKey]
    const activeModel =
      (typeof directOverride === 'string' && directOverride.trim()) ||
      info?.activeModel ||
      TASK_MODEL_ROUTING[backendKey] ||
      'google/gemini-3.5-flash-lite'
    taskModels[uiKey] = activeModel
    avgTokens[uiKey] = {
      input: info?.avgInputTokens || 2000,
      output: info?.avgOutputTokens || 700,
    }
  }
  return { taskModels, avgTokens, taskDetails: details }
}

export async function getEngineConfig(_req, res) {
  try {
    const settings = await getGlobalSettings().catch(() => ({ modelOverrides: {} }))
    const modelOverrides = settings?.modelOverrides && typeof settings.modelOverrides === 'object'
      ? settings.modelOverrides
      : {}
    setModelOverrides(modelOverrides)

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

    const { taskModels, avgTokens, taskDetails } = await buildTaskModelsSummary(modelOverrides)

    return res.status(200).json({
      success: true,
      scrapeTargets,
      routing: {
        primaryModel: runtimeEngineConfig.primaryModel,
        fallbackModel: runtimeEngineConfig.fallbackModel,
        enableLinkedinPlaybook: runtimeEngineConfig.enableLinkedinPlaybook,
      },
      modelOverrides,
      taskModels,
      avgTokens,
      taskDetails,
      keyPools,
      bucketSummary,
    })
  } catch (err) {
    console.error('[AdminDynamicController] getEngineConfig error:', err)
    return res.status(500).json({ success: false, message: 'Failed to retrieve engine config.' })
  }
}

// ─── POST /api/admin/engine/roles ───────────────────────────────────────────

export const addCustomTargetRole = async (req, res) => {
  try {
    const { roleName, specialization = 'general', experienceBucket = '3-5' } = req.body || {}

    if (!roleName || typeof roleName !== 'string' || roleName.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Valid roleName is required.' })
    }

    const cleanRoleName = roleName.trim()
    const roleKey = cleanRoleName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const spec = (specialization || 'general').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
    const exp = ['0-2', '3-5', '6-8', '8+'].includes(experienceBucket) ? experienceBucket : '3-5'

    const bucketKey = spec !== 'general' ? `${roleKey}::${spec}::${exp}` : `${roleKey}::${exp}`

    let bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket) {
      bucket = await JobMarketBucket.create({
        bucketKey,
        roleKey,
        roleName: cleanRoleName,
        specialization: spec,
        experienceBucket: exp,
        activeVersion: 0,
        status: 'empty',
        jobCount: 0,
      })
    }

    return res.status(201).json({
      success: true,
      message: `Bucket "${bucketKey}" created successfully.`,
      roleKey,
      bucket,
    })
  } catch (err) {
    console.error('[AdminDynamicController] addCustomTargetRole failed:', err)
    return res.status(500).json({ success: false, message: 'Could not add custom target role.' })
  }
}

export const createDynamicRole = addCustomTargetRole

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
    const provider = String(req.body?.provider || req.body?.service || '').toLowerCase().trim()
    const cleanToken = String(req.body?.key || req.body?.token || '').trim()

    if (!provider || !cleanToken) {
      return res.status(400).json({ success: false, message: 'provider and key are required.' })
    }

    if (!['openrouter', 'groq', 'gemini', 'apify'].includes(provider)) {
      return res.status(400).json({ success: false, message: `Unknown provider "${provider}". Use openrouter, groq, gemini, or apify.` })
    }

    // Persist into AppSettings.apiKeys[provider]
    const settingsDoc = await AppSettings.findOne({ key: 'global' })
    const currentKeys = settingsDoc?.apiKeys?.[provider] || []
    const nextList = Array.from(new Set([...currentKeys, cleanToken]))
    const updated = await AppSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: { [`apiKeys.${provider}`]: nextList }, $setOnInsert: { key: 'global' } },
      { upsert: true, new: true }
    ).lean()

    applyDbApiKeys(updated?.apiKeys || {})

    if (provider === 'apify') apifyKeyPool.addKey(cleanToken, true)
    if (provider === 'gemini') geminiKeyPool.addKey(cleanToken, true)
    if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
      process.env.OPENROUTER_API_KEY = cleanToken
    }

    return res.status(200).json({
      success: true,
      message: `API key added to ${provider} Round-Robin pool.`,
      provider,
      pools: getAllKeyPoolStats(),
    })
  } catch (err) {
    console.error('[AdminDynamicController] injectDynamicKey error:', err)
    return res.status(500).json({ success: false, message: 'Failed to inject key.' })
  }
}

export async function deleteDynamicKey(req, res) {
  try {
    const provider = String(req.body?.provider || req.query?.provider || '').toLowerCase().trim()
    const indexParam = req.body?.index ?? req.query?.index
    const rawKey = String(req.body?.key || '').trim()

    if (!['openrouter', 'groq', 'gemini', 'apify'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'Valid provider is required.' })
    }

    await syncDbApiKeys()
    const pool = keyPools[provider]
    let targetKey = rawKey
    if (!targetKey && indexParam !== undefined && indexParam !== null && pool?.entries?.[Number(indexParam)]) {
      const entry = pool.entries[Number(indexParam)]
      if (entry.source === 'env') {
        return res.status(400).json({ success: false, message: 'Cannot delete read-only .env key.' })
      }
      targetKey = entry.key
    }

    if (!targetKey) {
      return res.status(404).json({ success: false, message: 'DB key entry not found.' })
    }

    const settingsDoc = await AppSettings.findOne({ key: 'global' }).lean()
    const currentList = Array.isArray(settingsDoc?.apiKeys?.[provider]) ? settingsDoc.apiKeys[provider] : []
    const nextList = currentList.filter((k) => k !== targetKey)

    const updated = await AppSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: { [`apiKeys.${provider}`]: nextList } },
      { new: true }
    ).lean()

    applyDbApiKeys(updated?.apiKeys || {})

    return res.status(200).json({
      success: true,
      message: `Removed custom ${provider} key.`,
      provider,
      pools: getAllKeyPoolStats(),
    })
  } catch (err) {
    console.error('[AdminDynamicController] deleteDynamicKey error:', err)
    return res.status(500).json({ success: false, message: 'Failed to delete key.' })
  }
}

export async function testDynamicKey(req, res) {
  try {
    const provider = String(req.body?.provider || '').toLowerCase().trim()
    const indexParam = req.body?.index
    let testKey = String(req.body?.key || '').trim()

    await syncDbApiKeys()
    if (!testKey && indexParam !== undefined && indexParam !== null && keyPools[provider]?.entries?.[Number(indexParam)]) {
      testKey = keyPools[provider].entries[Number(indexParam)].key
    }

    if (!provider || !testKey) {
      return res.status(400).json({ success: false, message: 'provider and key (or index) are required.' })
    }

    let url = ''
    const headers = {}
    if (provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/auth/key'
      headers.Authorization = `Bearer ${testKey}`
    } else if (provider === 'groq') {
      url = 'https://api.groq.com/openai/v1/models'
      headers.Authorization = `Bearer ${testKey}`
    } else if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(testKey)}`
    } else if (provider === 'apify') {
      url = `https://api.apify.com/v2/users/me?token=${encodeURIComponent(testKey)}`
    } else {
      return res.status(400).json({ success: false, message: `Unsupported provider "${provider}".` })
    }

    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    return res.status(200).json({
      success: true,
      valid: r.ok,
      status: r.status,
      message: r.ok ? `${provider} key verified (HTTP ${r.status}).` : `${provider} key failed (HTTP ${r.status}).`,
    })
  } catch (err) {
    return res.status(200).json({
      success: true,
      valid: false,
      status: 0,
      message: err.message || 'Key verification request failed.',
    })
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

// Add PATCH /api/admin/engine/config
export async function updateEngineConfig(req, res) {
  try {
    const {
      fastCatchTargetJds,
      backgroundTargetJds,
      primaryModel,
      fallbackModel,
      enableLinkedinPlaybook,
      taskModels,
      modelOverrides,
      taskKey,
      modelId,
    } = req.body || {}

    if (fastCatchTargetJds !== undefined) {
      const val = parseInt(fastCatchTargetJds, 10)
      if (!isNaN(val) && val >= 5 && val <= 100) {
        runtimeEngineConfig.fastCatchTargetJds = val
      }
    }
    if (backgroundTargetJds !== undefined) {
      const val = parseInt(backgroundTargetJds, 10)
      if (!isNaN(val) && val >= 10 && val <= 200) {
        runtimeEngineConfig.backgroundTargetJds = val
      }
    }
    if (primaryModel !== undefined && typeof primaryModel === 'string') {
      runtimeEngineConfig.primaryModel = primaryModel.trim()
    }
    if (fallbackModel !== undefined && typeof fallbackModel === 'string') {
      runtimeEngineConfig.fallbackModel = fallbackModel.trim()
    }
    if (enableLinkedinPlaybook !== undefined) {
      runtimeEngineConfig.enableLinkedinPlaybook = Boolean(enableLinkedinPlaybook)
    }

    let persistedOverrides = null
    if (
      (taskModels && typeof taskModels === 'object' && !Array.isArray(taskModels)) ||
      (modelOverrides && typeof modelOverrides === 'object') ||
      (typeof taskKey === 'string' && taskKey.trim())
    ) {
      const current = await getGlobalSettings().catch(() => ({ modelOverrides: {} }))
      const nextOverrides = { ...(current?.modelOverrides || {}) }

      const applyMap = (src) => {
        for (const [k, v] of Object.entries(src)) {
          if (typeof v === 'string' && v.trim()) {
            nextOverrides[k] = v.trim()
            if (runtimeEngineConfig.taskModels) runtimeEngineConfig.taskModels[k] = v.trim()
          } else {
            delete nextOverrides[k]
          }
        }
      }

      if (taskModels && typeof taskModels === 'object' && !Array.isArray(taskModels)) applyMap(taskModels)
      if (modelOverrides && typeof modelOverrides === 'object') applyMap(modelOverrides)
      if (typeof taskKey === 'string' && taskKey.trim()) {
        if (typeof modelId === 'string' && modelId.trim()) {
          nextOverrides[taskKey.trim()] = modelId.trim()
        } else {
          delete nextOverrides[taskKey.trim()]
        }
      }

      const updatedDoc = await AppSettings.findOneAndUpdate(
        { key: 'global' },
        { $set: { modelOverrides: nextOverrides }, $setOnInsert: { key: 'global' } },
        { upsert: true, new: true }
      ).lean()
      persistedOverrides = updatedDoc?.modelOverrides || nextOverrides
      setModelOverrides(persistedOverrides)
    }

    runtimeEngineConfig.lastUpdated = new Date()

    const activeOverrides = persistedOverrides ?? (await getGlobalSettings().catch(() => ({})))?.modelOverrides ?? {}
    const { taskModels: nextTaskModels, avgTokens, taskDetails } = await buildTaskModelsSummary(activeOverrides)

    return res.status(200).json({
      success: true,
      message: 'Engine runtime configuration updated successfully.',
      runtimeEngineConfig,
      modelOverrides: activeOverrides,
      taskModels: nextTaskModels,
      avgTokens,
      taskDetails,
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/engine/keys & POST /api/admin/engine/keys/toggle ────────

export async function getEngineKeys(_req, res) {
  try {
    await syncDbApiKeys()
    return res.status(200).json({
      success: true,
      pools: getAllKeyPoolStats(),
    })
  } catch (err) {
    console.error('[AdminDynamicController] getEngineKeys error:', err)
    return res.status(500).json({ success: false, message: 'Failed to retrieve key pools.' })
  }
}

export async function toggleEngineKey(req, res) {
  try {
    const { provider, index, enabled } = req.body || {}
    if (!provider || index === undefined || index === null) {
      return res.status(400).json({ success: false, message: 'provider and index are required.' })
    }
    const updated = toggleProviderKey(provider, index, enabled)
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Key entry not found.' })
    }
    return res.status(200).json({
      success: true,
      key: updated,
      pools: getAllKeyPoolStats(),
    })
  } catch (err) {
    console.error('[AdminDynamicController] toggleEngineKey error:', err)
    return res.status(500).json({ success: false, message: 'Failed to toggle key.' })
  }
}

// Add GET /api/admin/health
export async function getAdminHealth(_req, res) {
  try {
    const mongoStateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    }
    const mongoState = mongoStateMap[mongoose.connection.readyState] || 'unknown'
    const apifyKeys = apifyKeyPool.getAllKeys()
    const geminiKeys = geminiKeyPool.getAllKeys()

    return res.status(200).json({
      success: true,
      status: mongoState === 'connected' ? 'HEALTHY' : 'DEGRADED',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      mongo: {
        state: mongoState,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host || 'unknown',
      },
      keyPools: {
        apify: {
          total: apifyKeys.length,
          cooling: apifyKeyPool.cooldowns.size,
        },
        gemini: {
          total: geminiKeys.length,
          cooling: geminiKeyPool.cooldowns.size,
        },
      },
      config: runtimeEngineConfig,
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}



