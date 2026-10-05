/**
 * Grok (xAI) Provider Implementation (Fallback / Comparison)
 * Uses native fetch to interact with xAI's OpenAI-compatible completions API.
 */

import { aiConfig } from '../config/aiConfig.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

export class GrokProvider {
  constructor(config = aiConfig.grok) {
    this.config = config
    this.name = 'grok'
  }

  async generate({
    model = 'grok-beta',
    messages,
    temperature = 0.2,
    maxTokens = 4096,
    signal = null,
  }) {
    const apiKey = (this.config.apiKey || process.env.GROK_API_KEY || '').trim()
    if (!apiKey) {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        message: 'Grok API key is missing. Please set GROK_API_KEY.',
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

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), this.config.timeoutMs)
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
        throw new ProviderError({
          code: response.status === 429 ? PROVIDER_ERROR_CODES.RATE_LIMIT : PROVIDER_ERROR_CODES.SERVER_ERROR,
          message: `[Grok ${response.status}] ${data?.error?.message || response.statusText}`,
          provider: this.name,
          model,
          statusCode: response.status,
          details: data?.error || null,
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
          message: 'Grok returned empty response content.',
          provider: this.name,
          model,
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
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.SERVER_ERROR,
        message: err.message || 'Error communicating with Grok API',
        provider: this.name,
        model,
      })
    }
  }
}

export default GrokProvider
