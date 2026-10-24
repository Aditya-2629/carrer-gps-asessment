/**
 * Gemini Provider Implementation (Fallback / Comparison)
 * Wraps existing geminiClient with gateway-compatible interface and key rotation.
 */

import { generateContentWithFallback } from '../../utils/geminiClient.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

export class GeminiProvider {
  constructor() {
    this.name = 'gemini'
  }

  async generate({
    model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    messages,
    supportsJsonObject = false,
    responseFormat = null,
    isBenchmark = false,
    temperature = 0.2,
    topP = 0.9,
    maxTokens = null,
    timeoutMs = 18000,
    totalDeadlineMs = 38000,
    signal = null,
    requestId = null,
  }) {
    const startTime = Date.now()
    let targetModel = model
    if (targetModel === 'gemini-3.8') targetModel = 'gemini-3.8-flash'
    if (targetModel === 'gemini-3.1-pro') targetModel = 'gemini-3.1-pro-preview'
    if (!targetModel) targetModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'

    try {
      // Concatenate chat messages into prompt string
      const promptText = messages
        .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
        .join('\n\n')

      // In benchmark mode, strictly disable fallback to other models
      const fallbackModels = isBenchmark ? [] : undefined

      const generationConfig = {}
      if (temperature != null) generationConfig.temperature = temperature
      if (topP != null) generationConfig.topP = topP
      if (maxTokens != null) generationConfig.maxOutputTokens = maxTokens
      if (supportsJsonObject || responseFormat === 'json_object') {
        generationConfig.responseMimeType = 'application/json'
      }

      const result = await generateContentWithFallback({
        contents: promptText,
        modelName: targetModel,
        fallbackModels,
        generationConfig,
        timeoutMs,
        totalDeadlineMs,
        signal,
        requestId,
      })

      const latencyMs = Date.now() - startTime
      const candidate = result.rawResponse?.response?.candidates?.[0] || result.rawResponse?.candidates?.[0]
      let finishReason = 'stop'
      if (candidate?.finishReason === 'MAX_TOKENS') {
        finishReason = 'length'
      } else if (candidate?.finishReason) {
        finishReason = candidate.finishReason.toLowerCase()
      }

      const usage = result.rawResponse?.response?.usageMetadata || result.rawResponse?.usageMetadata

      return {
        text: result.text.trim(),
        actualModel: result.modelUsed || model,
        finishReason,
        requestId: requestId || null,
        tokens: {
          prompt: usage?.promptTokenCount ?? null,
          completion: usage?.candidatesTokenCount ?? null,
          total: usage?.totalTokenCount ?? null,
        },
        latencyMs,
        rawResponse: result.rawResponse,
      }
    } catch (err) {
      if (err instanceof ProviderError) {
        if (!err.provider || err.provider === 'unknown') err.provider = this.name
        if (!err.model || err.model === 'unknown') err.model = model
        throw err
      }

      const errMsg = err.message || 'Gemini generation failure'
      const isRateLimit =
        errMsg.includes('429') ||
        errMsg.includes('402') ||
        errMsg.includes('quota') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Rate limit') ||
        errMsg.includes('prepayment') ||
        errMsg.includes('Payment Required') ||
        errMsg.includes('payment required')
      const isUnavailable =
        errMsg.includes('503') ||
        errMsg.includes('Unavailable') ||
        errMsg.includes('SERVICE_UNAVAILABLE') ||
        errMsg.includes('overloaded') ||
        errMsg.includes('high demand')
      const isTimeout =
        errMsg.includes('timeout') ||
        errMsg.includes('Timeout') ||
        errMsg.includes('aborted') ||
        errMsg.includes('408')
      const isNotFound =
        errMsg.includes('404') ||
        errMsg.includes('not found') ||
        errMsg.includes('is no longer available')
      const isConfigError =
        errMsg.includes('api_key') ||
        errMsg.includes('api key') ||
        errMsg.includes('no gemini_api_key found')

      let code = PROVIDER_ERROR_CODES.SERVER_ERROR
      let statusCode = 500
      let isRetryable = true

      if (isRateLimit) {
        code = PROVIDER_ERROR_CODES.RATE_LIMIT
        statusCode = errMsg.includes('402') || errMsg.includes('prepayment') ? 402 : 429
      } else if (isUnavailable) {
        code = PROVIDER_ERROR_CODES.SERVICE_UNAVAILABLE
        statusCode = 503
      } else if (isTimeout) {
        code = PROVIDER_ERROR_CODES.TIMEOUT
        statusCode = 408
      } else if (isNotFound) {
        code = PROVIDER_ERROR_CODES.MODEL_NOT_FOUND
        statusCode = 404
        isRetryable = false
      } else if (isConfigError) {
        code = PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED
        statusCode = 401
        isRetryable = false
      }

      throw new ProviderError({
        code,
        message: errMsg,
        provider: this.name,
        model,
        statusCode,
        isRetryable,
        details: err.stack,
      })
    }
  }
}

export default GeminiProvider
