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
import { GeminiProvider } from './geminiProvider.js'
import { GrokProvider } from './grokProvider.js'
import { NvidiaProvider } from './nvidiaProvider.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'
import { AITelemetry } from '../telemetry/aiTelemetry.js'
import { LLMCache, llmCache } from '../cache/llmCache.js'
import { llmQueue } from '../queue/llmQueue.js'
import { liteLlmRouter } from './liteLlmRouter.js'

// Production fallback chain in priority order:
// 1. Primary: Gemini 3.5 Flash Lite (Google instant fast inference)
// 2. 1st Fallback: Gemini 3.5 Flash
// 3. 2nd Fallback: Groq (GPT-OSS 120B / 20B)
// 4. 3rd Fallback: NVIDIA NIM (Nemotron 3 Super 120B)
// 5. 4th Fallback: OpenRouter
// 6. 5th Fallback: OpenAI
export const PRODUCTION_FALLBACK_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'groq',
  'nvidia',
  'openrouter',
  'openai',
]

export const MAX_CONCURRENT_PER_PROVIDER = 4

export const TRAP_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.8',
  'gemini-3.7-flash',
  'gemini-3.7',
])

const PROVIDER_MODEL_FALLBACKS = {
  groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
  nvidia: ['nvidia/nemotron-3-super-120b-a12b'],
  openrouter: ['google/gemma-4-26b-a4b-it:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
  openai: ['openai/gpt-oss-120b'],
}

export class LLMGateway {
  constructor(config = aiConfig) {
    this.config = config
    this.providers = {
      groq: new GroqProvider(config.groq),
      gemini: new GeminiProvider(),
      openrouter: new OpenRouterProvider(config.openRouter),
      grok: new GrokProvider(config.grok),
      nvidia: new NvidiaProvider(config.nvidia),
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
    excludeProvider = null,
    preferredProvider = null,
  }) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.BAD_REQUEST,
        message: 'Invalid or empty messages array provided to LLMGateway.',
        statusCode: 400,
        isRetryable: false,
      })
    }

    const effectiveTotalDeadlineMs = totalDeadlineMs || this.config.totalDeadlineMs || 60000
    const requestStartTime = Date.now()

    const requestedModelId = model || this.config.defaultResumeModel

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
      const chain = new Set()
      if (!model) {
        for (const m of listModelsForPurpose(purpose)) {
          if (!TRAP_MODELS.has(m.id)) chain.add(m.id)
        }
      }
      if (requestedModelId && !TRAP_MODELS.has(requestedModelId)) {
        chain.add(requestedModelId)
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
        remainingDeadlineMs = Math.max(remainingDeadlineMs, 25000)
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

      const currentModelId = modelsToTry[i]
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
          providerKey === 'gemini'
            ? (this.config.gemini?.totalDeadlineMs || this.config.gemini?.timeoutMs || 60000)
            : (this.config[providerKey]?.timeoutMs || 60000)
        const timeoutMs = Math.min(configuredTimeout, remainingDeadlineMs)
        const perAttemptTimeoutMs =
          providerKey === 'gemini'
            ? (this.config.gemini?.perAttemptTimeoutMs || this.config.gemini?.timeoutMs || 20000)
            : timeoutMs

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

        const finalResponse = {
          ...result,
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
          [402, 408, 413, 429, 500, 502, 503].includes(err.statusCode) ||
          (err.statusCode === 404 && i < modelsToTry.length - 1) ||
          (err.code === PROVIDER_ERROR_CODES.MODEL_NOT_FOUND && i < modelsToTry.length - 1) ||
          err.code === PROVIDER_ERROR_CODES.RATE_LIMIT ||
          err.code === PROVIDER_ERROR_CODES.TIMEOUT ||
          err.code === PROVIDER_ERROR_CODES.EMPTY_CONTENT ||
          err.code === PROVIDER_ERROR_CODES.SERVICE_UNAVAILABLE ||
          err.code === 'SERVICE_UNAVAILABLE'

        if (!isRetryable || i === modelsToTry.length - 1) {
          throw err
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
}

export const llmGateway = new LLMGateway()
export default llmGateway
