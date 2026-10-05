/**
 * Provider-Neutral LLM Gateway
 * Serves as the single point of entry for all LLM calls.
 * Ensures the Resume Agent is decoupled from specific providers and models.
 * Supports configurable production fallback (Groq 120B -> Groq 20B -> Gemini 3.8 Flash)
 * while strictly disabling fallback in benchmark mode.
 */

import { aiConfig } from '../config/aiConfig.js'
import { getModel, isModelAllowedForData } from '../config/modelRegistry.js'
import { GroqProvider } from './groqProvider.js'
import { OpenRouterProvider } from './openrouterProvider.js'
import { GeminiProvider } from './geminiProvider.js'
import { GrokProvider } from './grokProvider.js'
import { NvidiaProvider } from './nvidiaProvider.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'
import { AITelemetry } from '../telemetry/aiTelemetry.js'

// Production fallback chain in priority order
export const PRODUCTION_FALLBACK_CHAIN = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'gemini-3.8-flash',
]

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
    signal = null,
  }) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.BAD_REQUEST,
        message: 'Invalid or empty messages array provided to LLMGateway.',
        statusCode: 400,
        isRetryable: false,
      })
    }

    const requestedModelId = model || this.config.defaultResumeModel

    // In benchmark mode OR when fallback is disabled in config, test ONLY the requested model
    const allowFallback = !isBenchmark && this.config.fallbackEnabled

    // Determine execution plan
    let modelsToTry = [requestedModelId]
    if (allowFallback) {
      const remainingChain = PRODUCTION_FALLBACK_CHAIN.filter((m) => m !== requestedModelId)
      modelsToTry = [requestedModelId, ...remainingChain]
    }

    let lastError = null

    for (let i = 0; i < modelsToTry.length; i++) {
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

      const span = AITelemetry.startSpan({
        purpose,
        provider: providerKey,
        model: currentModelId,
      })

      try {
        const supportsJsonObject =
          responseFormat === 'json_object' && Boolean(modelMetadata.supportsJsonObject)

        const result = await providerInstance.generate({
          model: currentModelId,
          messages,
          supportsJsonObject,
          isBenchmark,
          temperature,
          topP,
          ...(maxTokens != null ? { maxTokens } : {}),
          signal,
        })

        span.finish({
          actualModel: result.actualModel || currentModelId,
          success: true,
          promptTokens: result.tokens?.prompt,
          completionTokens: result.tokens?.completion,
          totalTokens: result.tokens?.total,
        })

        return {
          ...result,
          requestId: span.requestId,
          provider: providerKey,
          requestedModel: requestedModelId,
          actualModel: result.actualModel || currentModelId,
          finishReason: result.finishReason || 'stop',
        }
      } catch (err) {
        span.finish({
          success: false,
          error: err,
        })

        lastError = err

        // V1.2 BENCHMARK RULE: Never fallback in benchmark mode
        if (!allowFallback) {
          throw err
        }

        // Production Fallback check: ONLY fallback for transient retryable conditions.
        // 413 (payload/context too large for this model) also falls back — a bigger
        // context model in the chain can still succeed.
        const isRetryable =
          err.isRetryable ||
          [408, 413, 429, 500, 502, 503].includes(err.statusCode) ||
          err.code === PROVIDER_ERROR_CODES.RATE_LIMIT ||
          err.code === PROVIDER_ERROR_CODES.TIMEOUT ||
          err.code === PROVIDER_ERROR_CODES.EMPTY_CONTENT

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
