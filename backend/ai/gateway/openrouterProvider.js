/**
 * OpenRouter Provider Implementation
 * Uses native fetch to interact with OpenRouter's OpenAI-compatible completions API.
 * Configured for Paid Priority tier with Google Gemini 3.5 Flash and fast failover models.
 */

import { aiConfig } from '../config/aiConfig.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

export class OpenRouterProvider {
  constructor(config = {}) {
    this.name = 'openrouter'
    this.config = config
    this.apiKey = process.env.OPENROUTER_API_KEY || config.apiKey || ''
    const rawBase = config.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    this.baseUrl = rawBase.endsWith('/chat/completions')
      ? rawBase
      : `${rawBase.replace(/\/+$/, '')}/chat/completions`
  }

  async generate({
    model = 'google/gemini-3.5-flash',
    messages = [],
    temperature = 0.3,
    maxTokens = 4096,
    responseFormat = 'json_object',
    supportsJsonObject = false,
    signal = null,
    timeoutMs = 60000,
    requestId = null,
  } = {}) {
    const activeApiKey = (process.env.OPENROUTER_API_KEY || this.apiKey || this.config.apiKey || '').trim()
    if (!activeApiKey) {
      throw new ProviderError('OPENROUTER_KEY_MISSING', 'OpenRouter API key is not configured in .env', {
        provider: 'openrouter',
        code: PROVIDER_ERROR_CODES.INVALID_AUTH,
        statusCode: 401,
      })
    }

    // Always use paid priority slug (strip :free to prevent hitting public throttled queue)
    const targetModel = String(model || 'google/gemini-3.5-flash').replace(/:free$/, '')

    const payload = {
      model: targetModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    }

    if (
      responseFormat === 'json_object' ||
      responseFormat?.type === 'json_object' ||
      supportsJsonObject
    ) {
      payload.response_format = { type: 'json_object' }
    }

    const effectiveTimeoutMs = timeoutMs || this.config.timeoutMs || 60000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs)

    if (signal) {
      if (signal.aborted) {
        controller.abort()
      } else {
        signal.addEventListener('abort', () => controller.abort(), { once: true })
      }
    }

    const startTime = Date.now()
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeApiKey}`,
          'HTTP-Referer': process.env.APP_URL || this.config.appUrl || 'http://localhost:5000',
          'X-Title': 'Career GPS Executive AI',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timer)
      const latencyMs = Date.now() - startTime

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        let errorCode = `OPENROUTER_HTTP_${res.status}`
        if (res.status === 429) errorCode = PROVIDER_ERROR_CODES.RATE_LIMIT
        else if (res.status === 401 || res.status === 403) errorCode = PROVIDER_ERROR_CODES.INVALID_AUTH
        else if (res.status === 408 || res.status === 504) errorCode = PROVIDER_ERROR_CODES.TIMEOUT

        throw new ProviderError(
          errorCode,
          `[OpenRouter ${res.status}] ${errText || res.statusText}`,
          {
            provider: 'openrouter',
            statusCode: res.status,
            model: targetModel,
            details: errText,
            isRetryable: res.status === 429 || res.status >= 500,
          }
        )
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || ''
      const finishReason = data.choices?.[0]?.finish_reason || 'stop'

      return {
        text: text.trim(),
        actualModel: data?.model || targetModel,
        provider: 'openrouter',
        finishReason,
        requestId: data?.id || requestId,
        latencyMs,
        usage: data.usage || {},
        tokens: {
          prompt: data.usage?.prompt_tokens ?? null,
          completion: data.usage?.completion_tokens ?? null,
          total: data.usage?.total_tokens ?? null,
        },
        rawResponse: data,
      }
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof ProviderError) throw err

      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new ProviderError('OPENROUTER_TIMEOUT', `OpenRouter request timed out after ${effectiveTimeoutMs}ms`, {
          provider: 'openrouter',
          code: PROVIDER_ERROR_CODES.TIMEOUT,
          model: targetModel,
          statusCode: 504,
          isRetryable: true,
        })
      }

      throw new ProviderError(
        PROVIDER_ERROR_CODES.SERVER_ERROR,
        err.message || 'Network error communicating with OpenRouter',
        {
          provider: 'openrouter',
          model: targetModel,
          statusCode: 500,
          details: err.stack,
          isRetryable: true,
        }
      )
    }
  }
}

export default OpenRouterProvider
