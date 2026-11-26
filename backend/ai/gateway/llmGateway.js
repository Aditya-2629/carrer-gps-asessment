/**
 * Provider-Neutral LLM Gateway
 * Serves as the single point of entry for all LLM calls.
 * Ensures the Resume Agent is decoupled from specific providers and models.
 * Supports configurable production fallback (Groq 120B -> Groq 20B -> Gemini 3.8 Flash)
 * while strictly disabling fallback in benchmark mode.
 */

import { aiConfig } from '../config/aiConfig.js'
import { getModel, isModelAllowedForData, listModelsForPurpose } from '../config/modelRegistry.js'
import { GroqProvider } from './groqProvider.js'
import { OpenRouterProvider } from './openrouterProvider.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'
import { AITelemetry } from '../telemetry/aiTelemetry.js'
import { LLMCache, llmCache } from '../cache/llmCache.js'
import { llmQueue } from '../queue/llmQueue.js'
import { liteLlmRouter } from './liteLlmRouter.js'
import { costTracker } from '../../utils/costTracker.js'
import { jsonrepair } from 'jsonrepair'

// Production fallback chain in priority order:
// 1. Primary: OpenRouter (100% SLA, multi-model task routing)
// 2. Secondary: Groq (Multi-key fallback locked to gpt-oss-120b)
export const PRODUCTION_FALLBACK_CHAIN = [
  'openrouter', // Priority 1: 100% SLA, multi-model task routing
  'groq',       // Priority 2: Multi-key fallback locked to gpt-oss-120b
]

export const MAX_CONCURRENT_PER_PROVIDER = 4

export const TRAP_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
])

export const TASK_MODEL_ROUTING = {
  jd_extraction: 'google/gemini-2.5-flash-lite',
  fast_catch: 'google/gemini-2.5-flash-lite',
  resume_synthesis: 'google/gemini-3.5-flash',
  bullet_rewrites: 'openai/gpt-oss-120b',
  bullet_batch_rewrite: 'openai/gpt-oss-120b',
  bullet_repetition_repair: 'openai/gpt-oss-120b',
  bullet_batch_weave: 'google/gemini-3.5-flash-lite',
  linkedin_synthesis: 'google/gemini-3.5-flash-lite',
  thought_leadership: 'google/gemini-3.5-flash-lite',
  report_generation: 'google/gemini-3.5-flash-lite',
  judge_gate: 'google/gemini-2.5-flash-lite',
  unified_synthesis: 'google/gemini-3.5-flash-lite',
  action_plan_generation: 'openai/gpt-oss-120b',
  dynamic_action_plan: 'openai/gpt-oss-120b',
  jev_decision: 'typesafe/jev-1.14',
  skill_validation_decision: 'typesafe/jev-1.14',
  bullet_triage_decision: 'typesafe/jev-1.14',
  title_drift_decision: 'typesafe/jev-1.14',
  career_chatbot: 'google/gemini-3.5-flash-lite',
  resume_audit: 'google/gemini-3.5-flash',
  final_synthesis: 'google/gemini-3.5-flash-lite',
}

export const TASK_METADATA = {
  jd_extraction: { label: 'JD Skill Extraction', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 1800, avgOutputTokens: 450 },
  fast_catch: { label: 'Fast-Catch Market Scrape', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 2200, avgOutputTokens: 600 },
  resume_synthesis: { label: 'Resume Synthesis & Audit', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 4200, avgOutputTokens: 1600 },
  resume_audit: { label: 'Resume Audit (Parallel)', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 3800, avgOutputTokens: 1400 },
  bullet_rewrites: { label: 'Bullet Rewrites', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 2600, avgOutputTokens: 900 },
  bullet_batch_rewrite: { label: 'Bullet Batch Rewrite', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 2400, avgOutputTokens: 850 },
  bullet_repetition_repair: { label: 'Bullet Repetition Repair', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 1500, avgOutputTokens: 500 },
  bullet_batch_weave: { label: 'Keyword Batch Weave', fallbackModel: 'openai/gpt-oss-120b', avgInputTokens: 2100, avgOutputTokens: 700 },
  linkedin_synthesis: { label: 'LinkedIn Audit & Synthesis', fallbackModel: 'openai/gpt-oss-120b', avgInputTokens: 3400, avgOutputTokens: 1300 },
  thought_leadership: { label: 'LinkedIn Thought Leadership', fallbackModel: 'google/gemini-2.5-flash-lite', avgInputTokens: 1600, avgOutputTokens: 550 },
  report_generation: { label: 'Report Generation', fallbackModel: 'openai/gpt-oss-120b', avgInputTokens: 4500, avgOutputTokens: 1800 },
  judge_gate: { label: 'Synthesis Quality Judge Gate', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 2800, avgOutputTokens: 400 },
  unified_synthesis: { label: 'Unified Career Synthesis', fallbackModel: 'openai/gpt-oss-120b', avgInputTokens: 5200, avgOutputTokens: 2000 },
  final_synthesis: { label: 'Final Synthesis (Mode A)', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 4800, avgOutputTokens: 1900 },
  action_plan_generation: { label: 'Action Plan Generation', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 2900, avgOutputTokens: 1200 },
  dynamic_action_plan: { label: 'Dynamic Action Plan', fallbackModel: 'google/gemini-3.5-flash-lite', avgInputTokens: 2900, avgOutputTokens: 1200 },
  career_chatbot: { label: 'Atlas Career Chatbot', fallbackModel: 'openai/gpt-oss-120b', avgInputTokens: 2200, avgOutputTokens: 450 },
  jev_decision: { label: 'Jev Intent Decision', fallbackModel: 'google/gemini-2.5-flash-lite', avgInputTokens: 600, avgOutputTokens: 120 },
  skill_validation_decision: { label: 'Skill Validation Decision', fallbackModel: 'google/gemini-2.5-flash-lite', avgInputTokens: 650, avgOutputTokens: 140 },
  bullet_triage_decision: { label: 'Bullet Triage Decision', fallbackModel: 'google/gemini-2.5-flash-lite', avgInputTokens: 700, avgOutputTokens: 150 },
  title_drift_decision: { label: 'Title Drift Decision', fallbackModel: 'google/gemini-2.5-flash-lite', avgInputTokens: 550, avgOutputTokens: 100 },
}

let _runtimeModelOverrides = {}
let _overridesLoadedAt = 0

export function setModelOverrides(overrides = {}) {
  const clean = {}
  const ALIAS_MAP = {
    resumeAudit: ['resume_audit', 'resume_synthesis'],
    linkedin: ['linkedin_synthesis'],
    unifiedSynthesis: ['unified_synthesis', 'final_synthesis', 'report_generation'],
    actionPlan: ['action_plan_generation', 'dynamic_action_plan'],
    jdExtraction: ['jd_extraction', 'fast_catch'],
    atlasChatbot: ['career_chatbot'],
  }
  if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides)) {
      if (typeof v === 'string' && v.trim()) {
        const val = v.trim()
        clean[k] = val
        if (ALIAS_MAP[k]) {
          for (const targetKey of ALIAS_MAP[k]) {
            clean[targetKey] = val
          }
        }
      }
    }
  }
  _runtimeModelOverrides = clean
  _overridesLoadedAt = Date.now()
}

export function getModelOverrides() {
  return { ..._runtimeModelOverrides }
}

async function ensureModelOverridesLoaded() {
  if (Date.now() - _overridesLoadedAt < 60_000) return
  _overridesLoadedAt = Date.now()
  try {
    const { default: AppSettings } = await import('../../models/AppSettings.js')
    const doc = await AppSettings.findOne({ key: 'global' }).select('modelOverrides').lean()
    if (doc?.modelOverrides && typeof doc.modelOverrides === 'object') {
      setModelOverrides(doc.modelOverrides)
    }
  } catch {
    // Non-fatal if DB not yet connected
  }
}

export const PROVIDER_MODEL_FALLBACKS = {
  openrouter: [
    'google/gemini-3.5-flash-lite',
    'google/gemini-2.5-flash-lite',
    'google/gemini-3.5-flash',
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek/deepseek-v3.2',
  ],
  groq: [
    'openai/gpt-oss-120b', // ONLY active model for Groq
  ],
}

export class LLMGateway {
  constructor(config = aiConfig) {
    this.config = config
    this.providers = {
      openrouter: new OpenRouterProvider(config.openRouter),
      groq: new GroqProvider(config.groq),
    }
  }

  /**
   * Universal generation interface.
   *
   * @param {Object} params
   * @param {string} [params.purpose='resume_analysis'] - Logical purpose
   * @param {Array<{role: string, content: string}>} params.messages - Chat messages
   * @param {string} [params.model] - Specific model ID to execute
   * @param {boolean} [params.isSynthetic=false] - Flag indicating synthetic/anonymized data
   * @param {string} [params.responseFormat='json_object'] - Desired format
   * @param {boolean} [params.isBenchmark=false] - Benchmark flag (STRICTLY disables fallback)
   * @param {string} [params.contentHash] - Content hash for cache fingerprinting
   * @param {boolean} [params.bypassCache=false] - Explicitly bypass request cache
   * @param {AbortSignal} [params.signal] - Abort signal
   * @returns {Promise<{ text: string, actualModel: string, latencyMs: number, requestId: string, tokens: object }>}
   */
  async generate({
    purpose = 'resume_analysis',
    messages,
    model = null,
    isSynthetic = false,
    responseFormat = 'json_object',
    isBenchmark = false,
    maxTokens = null,
    temperature = 0.2,
    topP = 0.9,
    treatLengthAsRetryable = false,
    contentHash = null,
    bypassCache = false,
    signal = null,
    totalDeadlineMs = null,
    timeoutMs: callerTimeoutMs = null,
    excludeProvider = null,
    preferredProvider = null,
    stage = null,
    task = null,
    reqId = null,
    runId = null,
  }) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.BAD_REQUEST,
        message: 'Invalid or empty messages array provided to LLMGateway.',
        statusCode: 400,
        isRetryable: false,
      })
    }

    const effectiveTotalDeadlineMs =
      totalDeadlineMs ||
      callerTimeoutMs ||
      (purpose === 'bullet_batch_weave' ? 30000 : (this.config.totalDeadlineMs || 60000))
    const requestStartTime = Date.now()

    await ensureModelOverridesLoaded()

    let requestedModelId = model
    const routingTask = task || purpose
    if (!requestedModelId && routingTask && _runtimeModelOverrides[routingTask]) {
      requestedModelId = _runtimeModelOverrides[routingTask]
    }
    if (!requestedModelId && routingTask && TASK_MODEL_ROUTING[routingTask]) {
      requestedModelId = TASK_MODEL_ROUTING[routingTask]
    }
    if (!requestedModelId) {
      requestedModelId = this.config.defaultResumeModel
    }

    if (
      typeof requestedModelId === 'string' &&
      (requestedModelId.startsWith('llama-') ||
       requestedModelId.startsWith('llama3-') ||
       requestedModelId === 'openai/gpt-oss-20b' ||
       (preferredProvider === 'groq' && requestedModelId.includes('llama')))
    ) {
      requestedModelId = 'openai/gpt-oss-120b'
    }

    // 1. Request Fingerprinting & Cache Lookup
    let fingerprint = null
    if (!isBenchmark && !bypassCache && contentHash) {
      fingerprint = LLMCache.computeFingerprint({
        purpose,
        model: requestedModelId,
        contentHash,
        responseFormat,
        temperature,
      })

      const cached = llmCache.get(fingerprint)
      if (cached) {
        console.log(`[LLMGateway] Cache hit for fingerprint ${fingerprint.slice(0, 10)}... (0ms, 0 tokens)`)
        return cached
      }
    }

    // In benchmark mode OR when fallback is disabled in config, test ONLY the requested model
    const allowFallback = !isBenchmark && this.config.fallbackEnabled

    // Determine execution plan. Purpose-aware: when no explicit model is
    // requested, every registered model serving this purpose joins the chain
    // (registry order) before the production fallback chain — so a Gemini
    // quota/503 outage can be absorbed by NVIDIA/Groq models.
    let modelsToTry = [requestedModelId]
    if (allowFallback) {
      if (purpose === 'bullet_batch_weave') {
        modelsToTry = Array.from(new Set([
          requestedModelId || 'google/gemini-3.5-flash-lite',
          'google/gemini-3.5-flash-lite',
          'openai/gpt-oss-120b',
          'google/gemini-2.5-flash-lite',
          'google/gemini-3.5-flash',
        ].filter(Boolean)))
      } else if ((purpose === 'career_chatbot' || purpose === 'market_jd_analysis') && !model && !task) {
        modelsToTry = [
          'google/gemini-3.5-flash-lite',
          'openai/gpt-oss-120b',
          'deepseek/deepseek-chat',
        ]
      } else {
        const chain = new Set()
        if (requestedModelId && !TRAP_MODELS.has(requestedModelId)) {
          chain.add(requestedModelId)
        }
        if (!model && !task) {
          for (const m of listModelsForPurpose(purpose)) {
            if (!TRAP_MODELS.has(m.id)) chain.add(m.id)
          }
        }
        for (const entry of PRODUCTION_FALLBACK_CHAIN) {
          if (entry === requestedModelId || TRAP_MODELS.has(entry)) continue
          if (PROVIDER_MODEL_FALLBACKS[entry]) {
            for (const m of PROVIDER_MODEL_FALLBACKS[entry]) {
              if (m !== requestedModelId && !TRAP_MODELS.has(m)) chain.add(m)
            }
          } else {
            chain.add(entry)
          }
        }
        modelsToTry = Array.from(chain)
      }
    }

    // Provider isolation / preference ordering:
    // If preferredProvider is set, prepend its models.
    // If excludeProvider is set, move models from that provider behind other candidates as a last-resort fallback.
    if (preferredProvider || excludeProvider) {
      const preferred = []
      const regular = []
      const excluded = []

      for (const mId of modelsToTry) {
        const meta = getModel(mId)
        const prov = meta?.provider
        if (excludeProvider && prov === excludeProvider) {
          excluded.push(mId)
        } else if (preferredProvider && prov === preferredProvider) {
          preferred.push(mId)
        } else {
          regular.push(mId)
        }
      }

      modelsToTry = [...preferred, ...regular, ...excluded]
    }

    let lastError = null

    for (let i = 0; i < modelsToTry.length; i++) {
      let remainingDeadlineMs = effectiveTotalDeadlineMs - (Date.now() - requestStartTime)
      // When cascading to the next candidate, guarantee at least 25000ms timeout budget so upstream timeouts never starve fallback
      if (i > 0) {
        remainingDeadlineMs = Math.max(remainingDeadlineMs, purpose === 'bullet_batch_weave' ? 6000 : 25000)
      }
      if (remainingDeadlineMs <= 0) {
        lastError = new ProviderError({
          code: PROVIDER_ERROR_CODES.TIMEOUT,
          message: `Total request deadline of ${effectiveTotalDeadlineMs}ms exceeded across fallback chain.`,
          statusCode: 408,
          isRetryable: false,
          details: { timeoutSource: 'total_request_deadline', totalDeadlineMs: effectiveTotalDeadlineMs },
        })
        throw lastError
      }

      let currentModelId = modelsToTry[i]
      if (typeof currentModelId === 'string' && (currentModelId.includes('llama') || currentModelId === 'openai/gpt-oss-20b')) {
        currentModelId = 'openai/gpt-oss-120b'
      }
      const modelMetadata = getModel(currentModelId)

      if (!modelMetadata) {
        lastError = new ProviderError({
          code: PROVIDER_ERROR_CODES.MODEL_NOT_FOUND,
          message: `Model "${currentModelId}" is not registered in MODEL_REGISTRY.`,
          model: currentModelId,
          statusCode: 400,
          isRetryable: false,
        })
        if (!allowFallback) throw lastError
        continue
      }

      // Check data privacy constraints
      const eligibility = isModelAllowedForData(currentModelId, isSynthetic)
      if (!eligibility.allowed) {
        lastError = new ProviderError({
          code: PROVIDER_ERROR_CODES.DATA_PRIVACY_ERROR,
          message: eligibility.reason,
          provider: modelMetadata.provider,
          model: currentModelId,
          statusCode: 403,
          isRetryable: false,
        })
        if (!allowFallback) throw lastError
        continue
      }

      const providerKey = modelMetadata.provider || this.config.defaultProvider
      const providerInstance = this.providers[providerKey]

      if (!providerInstance) {
        lastError = new ProviderError({
          code: PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
          message: `No provider instance available for provider key "${providerKey}".`,
          provider: providerKey,
          model: currentModelId,
          statusCode: 500,
          isRetryable: false,
        })
        if (!allowFallback) throw lastError
        continue
      }

      // 2. LiteLLMRouter Circuit Breaker Check (Fast Failover)
      const availability = liteLlmRouter.isProviderAvailable(providerKey)
      const hasAlternativeProviders = modelsToTry
        .slice(i + 1)
        .some((m) => {
          const meta = getModel(m)
          return meta && meta.provider !== providerKey && liteLlmRouter.isProviderAvailable(meta.provider).isAvailable
        })
      if (allowFallback && !availability.isAvailable && hasAlternativeProviders) {
        console.warn(`[LLMGateway] Fast-failover: Skipping degraded provider "${providerKey}" (${availability.reason}) in favor of remaining candidates.`)
        continue
      }

      const span = AITelemetry.startSpan({
        purpose,
        provider: providerKey,
        model: currentModelId,
      })

      try {
        const isJsonFormat =
          responseFormat === 'json_object' ||
          (typeof responseFormat === 'object' && responseFormat?.type === 'json_object')
        const supportsJsonObject = isJsonFormat && Boolean(modelMetadata.supportsJsonObject)

        const configuredTimeout =
          purpose === 'bullet_batch_weave'
            ? (callerTimeoutMs || 6000)
            : (this.config[providerKey]?.timeoutMs || 45000)
        const timeoutMs = Math.min(configuredTimeout, remainingDeadlineMs)
        const perAttemptTimeoutMs = timeoutMs

        // Provider deadline is bounded slightly within router timeout (1500ms safety buffer)
        // to allow internal provider error handling and telemetry cleanup before router-level abort
        const providerDeadlineMs = timeoutMs <= 2000 ? timeoutMs : Math.max(1000, timeoutMs - 1500)

        // 3. Bounded Queue & Rate Limiter Execution
        const result = await llmQueue.enqueue({
          provider: providerKey,
          signal,
          execute: () =>
            liteLlmRouter.executeWithTimeout(
              (attemptSignal) =>
                providerInstance.generate({
                  model: currentModelId,
                  messages,
                  supportsJsonObject,
                  isBenchmark,
                  temperature,
                  topP,
                  ...(maxTokens != null ? { maxTokens } : {}),
                  signal: attemptSignal || signal,
                  timeoutMs: perAttemptTimeoutMs,
                  totalDeadlineMs: providerDeadlineMs,
                  requestId: span.requestId,
                }),
              timeoutMs,
              providerKey,
              signal
            ),
        })

        // Phase E-fix: JSON outputs cut by a token-limit (finishReason 'length')
        // are unusable — callers can opt into treating them as a provider
        // failure so the next (bigger-context) model takes the shot.
        if (treatLengthAsRetryable && result.finishReason === 'length' && i < modelsToTry.length - 1) {
          span.finish({ success: false, error: { code: 'MODEL_OUTPUT_INCOMPLETE', message: 'Truncated output — falling to next model' } })
          lastError = new ProviderError({
            code: 'MODEL_OUTPUT_INCOMPLETE',
            message: `[${currentModelId}] output truncated (finishReason: length)`,
            statusCode: 500,
            isRetryable: true,
          })
          continue
        }

        // Report success to router circuit breaker
        liteLlmRouter.reportSuccess(providerKey)

        span.finish({
          actualModel: result.actualModel || currentModelId,
          success: true,
          promptTokens: result.tokens?.prompt,
          completionTokens: result.tokens?.completion,
          totalTokens: result.tokens?.total,
        })

        // Cost & Token Tracking
        try {
          costTracker.trackLlmCall({
            reqId: runId || reqId || costTracker.getActiveRunId() || span.requestId,
            runId: runId || costTracker.getActiveRunId() || null,
            stage: stage || task || purpose || 'LLM_GENERATION',
            provider: providerKey,
            model: result.actualModel || currentModelId,
            promptTokens: result.tokens?.prompt || 0,
            completionTokens: result.tokens?.completion || 0,
            directCost: result.tokens?.cost ?? result.usage?.cost ?? null,
          })
        } catch (_costErr) {
          // Graceful handling: never break generation
        }

        let finalText = result.text || ''
        if (purpose === 'career_chatbot' && typeof finalText === 'string') {
          const outerFenced = finalText.trim().match(/^```(?:markdown|text|json|plaintext)?\s*([\s\S]*?)\s*```$/i)
          if (outerFenced) {
            finalText = outerFenced[1].trim()
          }
        }

        // Validate JSON if responseFormat is json_object or requested as JSON
        if (isJsonFormat && typeof finalText === 'string') {
          let isValidJson = false
          try {
            JSON.parse(finalText)
            isValidJson = true
          } catch {
            try {
              let stripped = finalText.trim()
              const codeBlockMatch = stripped.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
              if (codeBlockMatch && codeBlockMatch[1]) {
                stripped = codeBlockMatch[1].trim()
              }
              JSON.parse(jsonrepair(stripped))
              isValidJson = true
            } catch {
              isValidJson = false
            }
          }

          if (!isValidJson && i < modelsToTry.length - 1 && allowFallback) {
            span.finish({
              success: false,
              error: { code: PROVIDER_ERROR_CODES.INVALID_JSON, message: 'Provider returned invalid or unparseable JSON' },
            })
            console.warn(
              `[LLMGateway] Invalid JSON response on ${currentModelId} (${providerKey}). Escalating to fallback candidate: ${modelsToTry[i + 1]}`
            )
            lastError = new ProviderError({
              code: PROVIDER_ERROR_CODES.INVALID_JSON,
              message: `[${currentModelId}] output could not be parsed as valid JSON: ${(finalText || '').slice(0, 100)}...`,
              provider: providerKey,
              model: currentModelId,
              statusCode: 500,
              isRetryable: true,
            })
            // Fast-failover: if OpenRouter returned invalid JSON, escalate Groq to next attempt
            if (providerKey === 'openrouter') {
              const altIdx = modelsToTry.findIndex((m, idx) => {
                if (idx <= i) return false
                const meta = getModel(m)
                return meta && meta.provider === 'groq' && liteLlmRouter.isProviderAvailable('groq').isAvailable
              })
              if (altIdx > i + 1) {
                const [groqModel] = modelsToTry.splice(altIdx, 1)
                modelsToTry.splice(i + 1, 0, groqModel)
                console.warn(`[LLMGateway] Fast-failover: Escalated Groq (${groqModel}) to next position after invalid JSON from OpenRouter.`)
              }
            }
            continue
          }
        }

        const finalResponse = {
          ...result,
          text: finalText,
          requestId: span.requestId,
          provider: providerKey,
          requestedModel: requestedModelId,
          actualModel: result.actualModel || currentModelId,
          finishReason: result.finishReason || 'stop',
        }

        // Cache valid response
        if (fingerprint && !isBenchmark) {
          llmCache.set(fingerprint, finalResponse)
        }

        return finalResponse
      } catch (err) {
        // Report failure to circuit breaker
        liteLlmRouter.reportFailure(providerKey, err)

        span.finish({
          success: false,
          error: err,
        })

        lastError = err

        // V1.2 BENCHMARK RULE: Never fallback in benchmark mode
        if (!allowFallback) {
          throw err
        }

        // Production Fallback check: fallback for transient retryable conditions OR model 404 when remaining candidates exist
        const isRetryable =
          err.isRetryable ||
          (typeof err.statusCode === 'number' && err.statusCode >= 500 && err.statusCode < 600) ||
          [402, 408, 413, 429].includes(err.statusCode) ||
          (err.statusCode === 404 && i < modelsToTry.length - 1) ||
          (err.code === PROVIDER_ERROR_CODES.MODEL_NOT_FOUND && i < modelsToTry.length - 1) ||
          err.code === PROVIDER_ERROR_CODES.RATE_LIMIT ||
          err.code === PROVIDER_ERROR_CODES.TIMEOUT ||
          err.code === PROVIDER_ERROR_CODES.EMPTY_CONTENT ||
          err.code === PROVIDER_ERROR_CODES.SERVICE_UNAVAILABLE ||
          err.code === PROVIDER_ERROR_CODES.INVALID_JSON ||
          err.code === 'INVALID_JSON_RESPONSE' ||
          err.code === 'SERVICE_UNAVAILABLE' ||
          /timeout|aborted|rate limit|quota|5\d\d|invalid json/i.test(err.message || '')

        if (!isRetryable || i === modelsToTry.length - 1) {
          throw err
        }

        // Fast-failover: if OpenRouter encountered timeout, 429, 5xx, or network failure, escalate Groq to next attempt
        if (providerKey === 'openrouter') {
          const altIdx = modelsToTry.findIndex((m, idx) => {
            if (idx <= i) return false
            const meta = getModel(m)
            return meta && meta.provider === 'groq' && liteLlmRouter.isProviderAvailable('groq').isAvailable
          })
          if (altIdx > i + 1) {
            const [groqModel] = modelsToTry.splice(altIdx, 1)
            modelsToTry.splice(i + 1, 0, groqModel)
            console.warn(`[LLMGateway] Fast-failover: Escalated Groq (${groqModel}) to next position ahead of remaining OpenRouter models.`)
          }
        }

        console.warn(
          `[LLMGateway] Transient failure on ${currentModelId} (${err.message}). Falling back to next candidate: ${modelsToTry[i + 1]}`
        )
      }
    }

    throw lastError || new ProviderError({
      code: PROVIDER_ERROR_CODES.SERVER_ERROR,
      message: 'All models in fallback chain failed.',
      statusCode: 500,
    })
  }

  /**
   * Convenience execution interface compatible with standard aiGateway.execute calls.
   */
  async execute({
    provider = null,
    preferredProvider = null,
    model = null,
    systemPrompt = null,
    prompt = null,
    messages = null,
    temperature = 0.2,
    responseFormat = 'json',
    stage = null,
    task = null,
    maxTokens = null,
    timeoutMs = null,
  } = {}) {
    const formattedMessages = messages || [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...(prompt ? [{ role: 'user', content: prompt }] : []),
    ]

    return this.generate({
      preferredProvider: preferredProvider || provider,
      model,
      messages: formattedMessages,
      temperature,
      responseFormat: responseFormat === 'json' ? 'json_object' : responseFormat,
      stage: stage || task || 'LLM_EXECUTE',
      maxTokens,
      timeoutMs,
    })
  }
}

export const llmGateway = new LLMGateway()
export const aiGateway = llmGateway
export default llmGateway
