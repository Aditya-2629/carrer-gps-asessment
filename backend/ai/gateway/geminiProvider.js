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

  async generate({ model = 'gemini-3.8-flash', messages, isBenchmark = false, temperature = 0.2, topP = 0.9 }) {
    const startTime = Date.now()
    try {
      // Concatenate chat messages into prompt string
      const promptText = messages
        .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
        .join('\n\n')

      // In benchmark mode, strictly disable fallback to other models (e.g. gemini-3.6-flash)
      // Key rotation across GEMINI_API_KEYS still operates to utilize configured quota.
      const fallbackModels = isBenchmark ? [] : undefined

      const generationConfig = {}
      if (temperature != null) generationConfig.temperature = temperature
      if (topP != null) generationConfig.topP = topP

      const result = await generateContentWithFallback({
        contents: promptText,
        modelName: model,
        fallbackModels,
        generationConfig,
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
        requestId: null,
        tokens: {
          prompt: usage?.promptTokenCount ?? null,
          completion: usage?.candidatesTokenCount ?? null,
          total: usage?.totalTokenCount ?? null,
        },
        latencyMs,
        rawResponse: result.rawResponse,
      }
    } catch (err) {
      const errMsg = err.message || 'Gemini generation failure'
      const isRateLimit = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')
      const isUnavailable = errMsg.includes('503') || errMsg.includes('Unavailable') || errMsg.includes('high demand')
      const isTimeout = errMsg.includes('timeout') || errMsg.includes('408')
      const isConfigError = errMsg.includes('API_KEY') || errMsg.includes('not found')

      let code = PROVIDER_ERROR_CODES.SERVER_ERROR
      let statusCode = 500
      let isRetryable = true

      if (isRateLimit) {
        code = PROVIDER_ERROR_CODES.RATE_LIMIT
        statusCode = 429
      } else if (isUnavailable) {
        code = PROVIDER_ERROR_CODES.SERVER_ERROR
        statusCode = 503
      } else if (isTimeout) {
        code = PROVIDER_ERROR_CODES.TIMEOUT
        statusCode = 408
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
