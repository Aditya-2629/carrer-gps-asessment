/**
 * End-to-End Cost and Token Tracker — Career GPS Assessment Pipeline
 *
 * Monitors exact operational expenses across:
 * - LLM Token Usage (Prompt Tokens, Completion Tokens, Model Name, Provider, Stage)
 * - Scraper Costs (Apify LinkedIn runs based on execution/items)
 * - Converts cost in USD ($) and converted INR (₹) using live/configurable pricing rates.
 * - Formats a clean console table at the end of each run via `console.table`.
 */

import mongoose from 'mongoose'
import LlmCallLog from '../models/LlmCallLog.js'
import User from '../models/User.js'
import AppSettings, { getGlobalSettings } from '../models/AppSettings.js'

const FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000
let _fxCache = { rate: null, fetchedAt: 0 }
let _latestEffectiveRate = 94

/**
 * Resolves the single dynamic USD -> INR exchange rate:
 * - autoSyncUsdRate === true: fetches live INR from open.er-api.com (12h cache), falling back to AppSettings.usdToInrRate.
 * - autoSyncUsdRate === false: uses manual AppSettings.usdToInrRate.
 */
export async function getEffectiveUsdToInrRate() {
  let settings = { usdToInrRate: 94, autoSyncUsdRate: true, usdRateLastSyncedAt: null }
  if (mongoose.connection?.readyState === 1) {
    try {
      settings = await getGlobalSettings()
    } catch {
      // use defaults
    }
  }

  const manualRate = Number(settings?.usdToInrRate) > 0 ? Number(settings.usdToInrRate) : 94
  const autoSync = settings?.autoSyncUsdRate !== false

  if (!autoSync) {
    _latestEffectiveRate = manualRate
    return {
      rate: Number(manualRate.toFixed(2)),
      source: 'manual_admin',
      autoSyncUsdRate: false,
      lastSyncedAt: settings?.usdRateLastSyncedAt || null,
    }
  }

  const now = Date.now()
  if (_fxCache.rate && now - _fxCache.fetchedAt < FX_CACHE_TTL_MS) {
    _latestEffectiveRate = _fxCache.rate
    return {
      rate: _fxCache.rate,
      source: 'live_fx',
      autoSyncUsdRate: true,
      lastSyncedAt: settings?.usdRateLastSyncedAt || new Date(_fxCache.fetchedAt),
    }
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const json = await res.json().catch(() => ({}))
      const inr = Number(json?.rates?.INR)
      if (Number.isFinite(inr) && inr > 10) {
        const cleanRate = Number(inr.toFixed(2))
        const syncedAt = new Date()
        _fxCache = { rate: cleanRate, fetchedAt: now }
        _latestEffectiveRate = cleanRate
        if (mongoose.connection?.readyState === 1) {
          AppSettings.updateOne(
            { key: 'global' },
            { $set: { usdToInrRate: cleanRate, usdRateLastSyncedAt: syncedAt }, $setOnInsert: { key: 'global' } },
            { upsert: true }
          ).catch(() => {})
        }
        return {
          rate: cleanRate,
          source: 'live_fx',
          autoSyncUsdRate: true,
          lastSyncedAt: syncedAt,
        }
      }
    }
  } catch {
    // Fall back cleanly to saved AppSettings.usdToInrRate
  }

  _latestEffectiveRate = manualRate
  return {
    rate: Number(manualRate.toFixed(2)),
    source: 'live_fx',
    autoSyncUsdRate: true,
    lastSyncedAt: settings?.usdRateLastSyncedAt || null,
  }
}

export const DEFAULT_PRICING = {
  // Rates per 1M tokens in USD ($)
  models: {
    // Gemini Flash & Flash-Lite
    'google/gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
    'google/gemini-3.5-flash-lite': { input: 0.075, output: 0.30 },
    'gemini-3.5-flash-lite': { input: 0.075, output: 0.30 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'google/gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'google/gemini-3-flash-preview': { input: 0.075, output: 0.30 },
    'gemini-3.8-flash': { input: 0.075, output: 0.30 },
    'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'google/gemini-3.5-flash': { input: 0.075, output: 0.30 },

    // OpenRouter Specialized & Groq models
    'meta-llama/llama-3.3-70b-instruct': { input: 0.13, output: 0.50 },
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
    'openai/gpt-oss-120b': { input: 0.15, output: 0.60 },
    'openai/gpt-oss-20b': { input: 0.08, output: 0.20 },
    'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek/deepseek-v3.2': { input: 0.26, output: 0.38 },

    // Fallback default for unspecified models
    default: { input: 0.10, output: 0.40 },
  },

  // Apify Scraper default cost per successful run (~$0.008)
  apify_scrape_job: 0.008,

  // USD to INR conversion rate
  usd_to_inr: 94,
}

export class CostTracker {
  constructor(pricingConfig = DEFAULT_PRICING, maxRuns = 200) {
    this.pricing = { ...DEFAULT_PRICING, ...pricingConfig }
    this.runs = new Map() // reqId -> Array<Record>
    this.runUserMap = new Map() // runId -> userId
    this.runSessionMap = new Map() // runId -> sessionId
    this.activeRunId = null
    this.maxRuns = maxRuns
  }

  /**
   * Internal helper to cap in-memory Map capacity and evict oldest runs (FIFO).
   * @param {string} reqId
   * @private
   */
  _ensureRunCapacity(reqId) {
    if (!this.runs.has(reqId)) {
      if (this.runs.size >= this.maxRuns) {
        const oldestKey = this.runs.keys().next().value
        if (oldestKey) {
          this.runs.delete(oldestKey)
          this.runUserMap.delete(oldestKey)
          this.runSessionMap.delete(oldestKey)
        }
      }
      this.runs.set(reqId, [])
    }
  }

  /**
   * Sets the active request or run ID context for the current pipeline.
   * @param {string} runId
   * @param {string} [userId]
   * @param {string} [sessionId]
   */
  setActiveRunId(runId, userId = null, sessionId = null) {
    if (runId && typeof runId === 'string') {
      this.activeRunId = runId
      if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
        this.runUserMap.set(runId, String(userId))
      }
      if (sessionId && typeof sessionId === 'string' && sessionId.trim()) {
        this.runSessionMap.set(runId, sessionId.trim().slice(0, 128))
      }
    }
  }

  _resolveUserId(explicitUserId, resolvedReqId) {
    if (explicitUserId && mongoose.Types.ObjectId.isValid(String(explicitUserId))) {
      return String(explicitUserId)
    }
    if (resolvedReqId && this.runUserMap.has(resolvedReqId)) {
      return this.runUserMap.get(resolvedReqId)
    }
    if (resolvedReqId && mongoose.Types.ObjectId.isValid(String(resolvedReqId))) {
      return String(resolvedReqId)
    }
    const chatMatch = String(resolvedReqId || '').match(/^chat_([a-f0-9]{24})_/i)
    return chatMatch ? chatMatch[1] : null
  }

  _persistCost({
    userId,
    sessionId = null,
    runId,
    stage,
    provider,
    model,
    promptTokens = 0,
    completionTokens = 0,
    totalTokens = 0,
    costUsd = 0,
    costInr = 0,
    costSource = 'unknown',
    costError = null,
  }) {
    if (mongoose.connection?.readyState !== 1) return
    const resolvedUserId = this._resolveUserId(userId, runId)
    const resolvedSessionId = (sessionId && String(sessionId).trim()) || (runId ? this.runSessionMap.get(runId) : null) || null
    LlmCallLog.create({
      userId: resolvedUserId || null,
      sessionId: resolvedSessionId,
      runId: runId || null,
      stage,
      provider,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      costInr,
      costSource,
      costError,
    }).catch((err) => {
      console.warn('[CostTracker] Failed to write LlmCallLog:', err.message)
    })

    if (resolvedUserId) {
      const stageKey = String(stage || 'LLM_GENERATION').toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      User.findByIdAndUpdate(resolvedUserId, {
        $inc: {
          totalCostUsd: Number(costUsd) || 0,
          totalCostInr: Number(costInr) || 0,
          [`costBreakdown.${stageKey}`]: Number(costUsd) || 0,
        },
      }).catch((err) => {
        console.warn('[CostTracker] Failed to $inc User cost:', err.message)
      })
    }
  }

  /**
   * Reconciles all LlmCallLog entries for a candidate (matching userId OR sessionId,
   * including early Step 1/2 Resume & LinkedIn calls) and writes the exact total to User.
   */
  async reconcileCandidateCosts({ userId, sessionId = null } = {}) {
    if (mongoose.connection?.readyState !== 1) return null
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return null
    const uid = new mongoose.Types.ObjectId(String(userId))
    const cleanSessionId = sessionId && typeof sessionId === 'string' ? sessionId.trim().slice(0, 128) : ''

    if (cleanSessionId) {
      await LlmCallLog.updateMany(
        { sessionId: cleanSessionId, userId: null },
        { $set: { userId: uid } }
      ).catch(() => {})
    }

    const match = cleanSessionId
      ? { $or: [{ userId: uid }, { sessionId: cleanSessionId }] }
      : { userId: uid }

    const rows = await LlmCallLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$stage',
          costUsd: { $sum: { $ifNull: ['$costUsd', 0] } },
          costInr: { $sum: { $ifNull: ['$costInr', 0] } },
        },
      },
    ])

    let totalUsd = 0
    let totalInr = 0
    const costBreakdown = {}
    for (const r of rows) {
      const usd = Number(r.costUsd || 0)
      const inr = Number(r.costInr || 0)
      totalUsd += usd
      totalInr += inr
      const stageKey = String(r._id || 'LLM_GENERATION').toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      costBreakdown[stageKey] = Number(((costBreakdown[stageKey] || 0) + usd).toFixed(5))
    }

    if (totalUsd > 0 || Object.keys(costBreakdown).length > 0) {
      await User.findByIdAndUpdate(uid, {
        $set: {
          totalCostUsd: Number(totalUsd.toFixed(5)),
          totalCostInr: Number(totalInr.toFixed(2)),
          costBreakdown,
        },
      }).catch(() => {})
    }
    return { totalCostUsd: Number(totalUsd.toFixed(5)), totalCostInr: Number(totalInr.toFixed(2)), costBreakdown }
  }

  /**
   * Gets the currently active run ID.
   * @returns {string|null}
   */
  getActiveRunId() {
    return this.activeRunId
  }

  /**
   * Finds matching model pricing rate per 1M tokens.
   * @param {string} modelName
   * @returns {{ input: number, output: number }}
   */
  getModelPricing(modelName = '') {
    const raw = String(modelName || '').toLowerCase().trim()
    if (this.pricing.models[raw]) return this.pricing.models[raw]

    // Strip leading provider path if present (e.g. "google/gemini-3.5-flash-lite" -> "gemini-3.5-flash-lite")
    const parts = raw.split('/')
    const baseModel = parts[parts.length - 1]
    if (this.pricing.models[baseModel]) return this.pricing.models[baseModel]

    // Partial pattern matching
    if (raw.includes('gemini-3.5-flash-lite') || raw.includes('gemini-1.5-flash') || raw.includes('flash-lite')) {
      return this.pricing.models['google/gemini-3.5-flash-lite']
    }
    if (raw.includes('llama-3.3-70b')) {
      return this.pricing.models['llama-3.3-70b-versatile']
    }
    if (raw.includes('gpt-oss-120b')) {
      return this.pricing.models['openai/gpt-oss-120b']
    }
    if (raw.includes('gpt-oss-20b')) {
      return this.pricing.models['openai/gpt-oss-20b']
    }
    if (raw.includes('deepseek')) {
      return this.pricing.models['deepseek/deepseek-chat']
    }

    return this.pricing.models.default
  }

  /**
   * Tracks an LLM invocation's token usage and cost.
   *
   * @param {Object} params
   * @param {string} [params.reqId]
   * @param {string} [params.stage='LLM_GENERATION']
   * @param {string} [params.provider='unknown']
   * @param {string} [params.model='unknown']
   * @param {number} [params.promptTokens=0]
   * @param {number} [params.completionTokens=0]
   * @param {number} [params.directCost=null] - Direct cost provided by provider (e.g. OpenRouter)
   * @returns {Object} Calculated cost metrics
   */
  trackLLM({
    reqId = null,
    runId = null,
    userId = null,
    stage = 'LLM_GENERATION',
    provider = 'unknown',
    model = 'unknown',
    promptTokens = 0,
    completionTokens = 0,
    directCost = null,
    costSource = null,
    costError = null,
  } = {}) {
    try {
      const explicitRunId = runId || (reqId && !String(reqId).startsWith('span_') ? reqId : null)
      const resolvedReqId = explicitRunId || this.activeRunId || reqId || 'default_run'
      const pTokens = Math.max(0, parseInt(promptTokens, 10) || 0)
      const cTokens = Math.max(0, parseInt(completionTokens, 10) || 0)
      const totalTokens = pTokens + cTokens
      const normalizedProvider = String(provider || 'unknown').toLowerCase()

      let costUsd = 0
      let source = 'estimated'
      if (normalizedProvider === 'openrouter') {
        if (typeof directCost === 'number' && Number.isFinite(directCost) && directCost >= 0 && costSource !== 'openrouter_cost_error') {
          costUsd = directCost
          source = costSource || 'openrouter_actual'
        } else {
          costUsd = 0
          source = 'openrouter_cost_error'
        }
      } else if (typeof directCost === 'number' && Number.isFinite(directCost) && directCost >= 0) {
        costUsd = directCost
        source = costSource || 'actual'
      } else {
        const rates = this.getModelPricing(model)
        costUsd = (pTokens * rates.input + cTokens * rates.output) / 1_000_000
      }

      const usdToInr = parseFloat(process.env.USD_TO_INR_RATE) || _latestEffectiveRate || this.pricing.usd_to_inr || 94
      const costInr = costUsd * usdToInr

      const record = {
        type: 'LLM',
        stage: String(stage || 'LLM_GENERATION').toUpperCase(),
        provider: String(provider || 'unknown'),
        model: String(model || 'unknown'),
        promptTokens: pTokens,
        completionTokens: cTokens,
        totalTokens,
        costUsd,
        costInr,
        source,
        costError: costError || null,
        timestamp: new Date().toISOString(),
      }

      this._ensureRunCapacity(resolvedReqId)
      this.runs.get(resolvedReqId).push(record)
      this._persistCost({
        userId,
        runId: resolvedReqId,
        stage: record.stage,
        provider: record.provider,
        model: record.model,
        promptTokens: pTokens,
        completionTokens: cTokens,
        totalTokens,
        costUsd,
        costInr,
        costSource: source,
        costError: costError || null,
      })

      return {
        reqId: resolvedReqId,
        costUsd,
        costInr,
        costSource: source,
        costError: costError || null,
        promptTokens: pTokens,
        completionTokens: cTokens,
        totalTokens,
      }
    } catch (err) {
      console.warn(`[CostTracker] Error tracking LLM tokens (non-fatal): ${err.message}`)
      return { costUsd: 0, costInr: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    }
  }

  /**
   * Alias for trackLLM for consistency.
   */
  trackLlmCall(params) {
    return this.trackLLM(params)
  }

  /**
   * Tracks an Apify scraper execution run.
   *
   * @param {Object} params
   * @param {string} [params.reqId]
   * @param {string} [params.stage='APIFY_SCRAPE']
   * @param {number} [params.itemsScraped=0]
   * @param {number} [params.durationMs=0]
   * @param {number} [params.costUsd=null]
   * @returns {Object} Calculated cost metrics
   */
  trackApify({
    reqId = null,
    runId = null,
    userId = null,
    stage = 'APIFY_SCRAPE',
    itemsScraped = 0,
    durationMs = 0,
    costUsd = null,
  } = {}) {
    try {
      const explicitRunId = runId || (reqId && !String(reqId).startsWith('span_') ? reqId : null)
      const resolvedReqId = explicitRunId || this.activeRunId || reqId || 'default_run'
      const finalCostUsd = typeof costUsd === 'number' && costUsd >= 0 ? costUsd : 0

      const usdToInr = parseFloat(process.env.USD_TO_INR_RATE) || _latestEffectiveRate || this.pricing.usd_to_inr || 94
      const costInr = finalCostUsd * usdToInr

      const record = {
        type: 'SCRAPER',
        stage: String(stage || 'APIFY_SCRAPE').toUpperCase(),
        provider: 'apify',
        model: 'linkedin-jobs-scraper',
        itemsScraped: parseInt(itemsScraped, 10) || 0,
        durationMs: parseInt(durationMs, 10) || 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: finalCostUsd,
        costInr,
        timestamp: new Date().toISOString(),
      }

      this._ensureRunCapacity(resolvedReqId)
      this.runs.get(resolvedReqId).push(record)
      this._persistCost({
        userId,
        runId: resolvedReqId,
        stage: record.stage,
        provider: 'apify',
        model: 'linkedin-jobs-scraper',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: finalCostUsd,
        costInr,
        costSource: 'apify_fixed',
      })

      return {
        reqId: resolvedReqId,
        costUsd: finalCostUsd,
        costInr,
        itemsScraped: record.itemsScraped,
      }
    } catch (err) {
      console.warn(`[CostTracker] Error tracking Apify run (non-fatal): ${err.message}`)
      return { costUsd: 0, costInr: 0, itemsScraped: 0 }
    }
  }

  /**
   * Generates summary metrics for a given run ID.
   * @param {string} [reqId]
   * @returns {Object}
   */
  getRunSummary(reqId = null) {
    const targetReqId = reqId || this.activeRunId || 'default_run'
    const records = this.runs.get(targetReqId) || []

    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalTokens = 0
    let totalCostUsd = 0
    let totalCostInr = 0
    let llmCount = 0
    let scraperCount = 0
    let totalItemsScraped = 0

    for (const r of records) {
      totalCostUsd += r.costUsd || 0
      totalCostInr += r.costInr || 0

      if (r.type === 'LLM') {
        llmCount++
        totalPromptTokens += r.promptTokens || 0
        totalCompletionTokens += r.completionTokens || 0
        totalTokens += r.totalTokens || 0
      } else if (r.type === 'SCRAPER') {
        scraperCount++
        totalItemsScraped += r.itemsScraped || 0
      }
    }

    return {
      reqId: targetReqId,
      totalLLMCalls: llmCount,
      totalScraperRuns: scraperCount,
      totalItemsScraped,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCostUsd,
      totalCostInr,
      records,
    }
  }

  /**
   * Formats a clean console table and prints structured ASCII breakdown of total cost in $ and ₹.
   *
   * @param {string} [reqId]
   * @returns {Object} Summary object
   */
  printRunSummary(reqId = null) {
    try {
      const summary = this.getRunSummary(reqId)
      const targetReqId = summary.reqId
      const records = summary.records

      if (records.length === 0) {
        console.log(`[CostTracker] No recorded usage metrics found for runId: "${targetReqId}"`)
        return summary
      }

      const usdToInr = parseFloat(process.env.USD_TO_INR_RATE) || this.pricing.usd_to_inr || 94

      const tableRows = records.map((r, i) => ({
        '#': i + 1,
        Stage: r.stage,
        Provider: r.provider,
        Model: r.model.length > 28 ? `${r.model.slice(0, 25)}...` : r.model,
        'Prompt Tok': r.promptTokens ? r.promptTokens.toLocaleString() : '-',
        'Compl Tok': r.completionTokens ? r.completionTokens.toLocaleString() : '-',
        'Total Tok': r.totalTokens ? r.totalTokens.toLocaleString() : '-',
        'Cost ($)': `$${r.costUsd < 0.00001 && r.costUsd > 0 ? r.costUsd.toExponential(2) : r.costUsd.toFixed(5)}`,
        'Cost (₹)': `₹${r.costInr.toFixed(3)}`,
        Source: r.source || 'estimated',
      }))

      console.log(`\n================================================================================`)
      console.log(`💰 PIPELINE COST & TOKEN AUDIT BREAKDOWN [Run: ${targetReqId}]`)
      console.log(`================================================================================`)
      console.table(tableRows)

      console.log(`--------------------------------------------------------------------------------`)
      console.log(`📊 TOTAL SUMMARY:`)
      console.log(`   • Total LLM Invocations: ${summary.totalLLMCalls}`)
      if (summary.totalScraperRuns > 0) {
        console.log(`   • Total Scraper Runs:    ${summary.totalScraperRuns} (${summary.totalItemsScraped} items scraped)`)
      }
      console.log(`   • Total Prompt Tokens:   ${summary.totalPromptTokens.toLocaleString()}`)
      console.log(`   • Total Compl Tokens:    ${summary.totalCompletionTokens.toLocaleString()}`)
      console.log(`   • Combined Tokens:       ${summary.totalTokens.toLocaleString()}`)
      console.log(`   • TOTAL RUN COST (USD):  $${summary.totalCostUsd.toFixed(5)}`)
      console.log(`   • TOTAL RUN COST (INR):  ₹${summary.totalCostInr.toFixed(3)} (Rate: ₹${usdToInr}/$)`)
      console.log(`================================================================================\n`)

      return summary
    } catch (err) {
      console.warn(`[CostTracker] Error printing run summary (non-fatal): ${err.message}`)
      return this.getRunSummary(reqId)
    }
  }

  /**
   * Alias for printRunSummary for backward compatibility.
   */
  printConsoleSummary(reqId = null) {
    return this.printRunSummary(reqId)
  }

  /**
   * Resets stored run records.
   * @param {string} [reqId] - If provided, clears only that run; otherwise clears all.
   */
  reset(reqId = null) {
    if (reqId) {
      this.runs.delete(reqId)
      if (this.activeRunId === reqId) this.activeRunId = null
    } else {
      this.runs.clear()
      this.activeRunId = null
    }
  }
}

// Global Singleton Instance
export const costTracker = new CostTracker()
export default costTracker

