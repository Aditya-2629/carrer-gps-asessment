/**
 * OpenRouter Provider Implementation
 * Uses native fetch to interact with OpenRouter's OpenAI-compatible completions API.
 */

import { aiConfig } from '../config/aiConfig.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

export class OpenRouterProvider {
  constructor(config = aiConfig.openRouter) {
    this.config = config
    this.name = 'openrouter'
  }

  async generate({
    model,
    messages,
    temperature = 0.2,
    maxTokens = 4096,
    supportsJsonObject = false,
    signal = null,
  }) {
    const apiKey = (this.config.apiKey || process.env.OPENROUTER_API_KEY || '').trim()
    if (!apiKey) {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        message: 'OpenRouter API key is missing. Please set OPENROUTER_API_KEY.',
        provider: this.name,
        model,
        statusCode: 500,
      })
    }

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }

    // Only inject response_format if the model supports json_object
    if (supportsJsonObject) {
      payload.response_format = { type: 'json_object' }
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': this.config.appUrl,
      'X-Title': this.config.appName,
    }

    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), this.config.timeoutMs)

    // Handle external signal combined with timeout
    const combinedSignal = signal || timeoutController.signal

    const startTime = Date.now()
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: combinedSignal,
      })

      clearTimeout(timeoutId)
      const latencyMs = Date.now() - startTime

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const errorMsg = data?.error?.message || response.statusText || 'Unknown OpenRouter error'
        let code = PROVIDER_ERROR_CODES.SERVER_ERROR

        if (response.status === 429) {
          code = PROVIDER_ERROR_CODES.RATE_LIMIT
        } else if (response.status === 401 || response.status === 403) {
          code = PROVIDER_ERROR_CODES.BAD_REQUEST
        } else if (response.status === 400) {
          if (errorMsg.toLowerCase().includes('context') || errorMsg.toLowerCase().includes('token')) {
            code = PROVIDER_ERROR_CODES.CONTEXT_LIMIT
          } else {
            code = PROVIDER_ERROR_CODES.BAD_REQUEST
          }
        }

        const safeHeaders = {}
        for (const [headerName, headerVal] of response.headers.entries()) {
          const lower = headerName.toLowerCase()
          if (
            lower.includes('rate') ||
            lower.includes('limit') ||
            lower.includes('retry') ||
            lower.includes('request-id') ||
            lower.includes('cf-ray') ||
            lower.includes('model') ||
            lower.includes('provider') ||
            lower.includes('date')
          ) {
            safeHeaders[headerName] = headerVal
          }
        }

        const details = {
          rawError: data?.error || data,
          errorCode: data?.error?.code || response.status,
          errorMetadata: data?.error?.metadata || null,
          rateLimitHeaders: safeHeaders,
          requestId: safeHeaders['x-request-id'] || safeHeaders['cf-ray'] || data?.id || null,
          calledUrl: `${this.config.baseUrl}/chat/completions`,
          requestedModel: model,
          responseFormatSent: Boolean(payload.response_format),
        }

        console.log('[OpenRouter 429 Diagnostic]', {
          httpStatus: response.status,
          errorCode: details.errorCode,
          errorMessage: errorMsg,
          errorMetadata: details.errorMetadata,
          model,
          rateLimitHeaders: safeHeaders,
          responseFormatSent: details.responseFormatSent,
        })

        throw new ProviderError({
          code,
          message: `[OpenRouter ${response.status}] ${errorMsg}`,
          provider: this.name,
          model,
          statusCode: response.status,
          details,
          isRetryable: response.status === 429 || response.status >= 500,
        })
      }

      const choice = data?.choices?.[0]
      const text = choice?.message?.content
      let finishReason = choice?.finish_reason || 'stop'
      if (finishReason === 'max_tokens' || finishReason === 'MAX_TOKENS') {
        finishReason = 'length'
      }
      const requestId = data?.id || response.headers.get('x-request-id') || null

      if (!text || !text.trim()) {
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.EMPTY_CONTENT,
          message: 'OpenRouter returned empty content in response choice.',
          provider: this.name,
          model,
          statusCode: 200,
          details: data,
        })
      }

      return {
        text: text.trim(),
        actualModel: data?.model || model,
        finishReason,
        requestId,
        tokens: {
          prompt: data?.usage?.prompt_tokens ?? null,
          completion: data?.usage?.completion_tokens ?? null,
          total: data?.usage?.total_tokens ?? null,
        },
        latencyMs,
        rawResponse: data,
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof ProviderError) throw err

      if (err.name === 'AbortError') {
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.TIMEOUT,
          message: `OpenRouter request timed out after ${this.config.timeoutMs}ms.`,
          provider: this.name,
          model,
          statusCode: 504,
          isRetryable: true,
        })
      }

      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.SERVER_ERROR,
        message: err.message || 'Network error communicating with OpenRouter',
        provider: this.name,
        model,
        statusCode: 500,
        details: err.stack,
        isRetryable: true,
      })
    }
  }
}

export default OpenRouterProvider
