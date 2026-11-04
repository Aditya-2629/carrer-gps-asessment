/**
 * End-to-End Cost and Token Tracker — Career GPS Assessment Pipeline
 *
 * Monitors exact operational expenses across:
 * - LLM Token Usage (Prompt Tokens, Completion Tokens, Model Name, Provider, Stage)
 * - Scraper Costs (Apify LinkedIn runs based on execution/items)
 * - Converts cost in USD ($) and converted INR (₹) using live/configurable pricing rates.
 * - Formats a clean console table at the end of each run via `console.table`.
 */

export const DEFAULT_PRICING = {
  // Rates per 1M tokens in USD ($)
  models: {
    // Gemini Flash & Flash-Lite ($0.075 input / $0.30 output)
    'google/gemini-3.5-flash-lite': { input: 0.075, output: 0.30 },
    'gemini-3.5-flash-lite': { input: 0.075, output: 0.30 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'google/gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'google/gemini-3-flash-preview': { input: 0.075, output: 0.30 },
    'gemini-3.8-flash': { input: 0.075, output: 0.30 },
    'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'google/gemini-3.5-flash': { input: 0.075, output: 0.30 },

    // Groq / Llama ($0.59 input / $0.79 output)
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },

    // GPT-OSS & DeepSeek
    'openai/gpt-oss-120b': { input: 0.15, output: 0.60 },
    'openai/gpt-oss-20b': { input: 0.08, output: 0.20 },
    'deepseek/deepseek-chat': { input: 0.20, output: 0.80 },

    // Fallback default for unspecified models
    default: { input: 0.10, output: 0.40 },
  },

  // Apify Scraper default cost per successful run (~$0.008)
  apify_scrape_job: 0.008,

  // USD to INR conversion rate
  usd_to_inr: 86.5,
}

export class CostTracker {
  constructor(pricingConfig = DEFAULT_PRICING) {
    this.pricing = { ...DEFAULT_PRICING, ...pricingConfig }
    this.runs = new Map() // reqId -> Array<Record>
    this.activeRunId = null
  }

  /**
   * Sets the active request or run ID context for the current pipeline.
   * @param {string} runId
   */
  setActiveRunId(runId) {
    if (runId && typeof runId === 'string') {
      this.activeRunId = runId
    }
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
    stage = 'LLM_GENERATION',
    provider = 'unknown',
    model = 'unknown',
    promptTokens = 0,
    completionTokens = 0,
    directCost = null,
  } = {}) {
    try {
      const resolvedReqId = reqId || this.activeRunId || 'default_run'
      const pTokens = Math.max(0, parseInt(promptTokens, 10) || 0)
      const cTokens = Math.max(0, parseInt(completionTokens, 10) || 0)
      const totalTokens = pTokens + cTokens

      let costUsd = 0
      if (typeof directCost === 'number' && directCost > 0) {
        costUsd = directCost
      } else {
        const rates = this.getModelPricing(model)
        costUsd = (pTokens * rates.input + cTokens * rates.output) / 1_000_000
      }

      const usdToInr = parseFloat(process.env.USD_TO_INR_RATE) || this.pricing.usd_to_inr || 86.5
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
        timestamp: new Date().toISOString(),
      }

      if (!this.runs.has(resolvedReqId)) {
        this.runs.set(resolvedReqId, [])
      }
      this.runs.get(resolvedReqId).push(record)

      return {
        reqId: resolvedReqId,
        costUsd,
        costInr,
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
    stage = 'FAST_CATCH_JD_SCRAPE',
    itemsScraped = 0,
    durationMs = 0,
    costUsd = null,
  } = {}) {
    try {
      const resolvedReqId = reqId || this.activeRunId || 'default_run'
      const finalCostUsd = typeof costUsd === 'number' && costUsd >= 0
        ? costUsd
        : (this.pricing.apify_scrape_job || 0.008)

      const usdToInr = parseFloat(process.env.USD_TO_INR_RATE) || this.pricing.usd_to_inr || 86.5
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

      if (!this.runs.has(resolvedReqId)) {
        this.runs.set(resolvedReqId, [])
      }
      this.runs.get(resolvedReqId).push(record)

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

      const usdToInr = parseFloat(process.env.USD_TO_INR_RATE) || this.pricing.usd_to_inr || 86.5

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
