/**
 * NVIDIA NIM Provider Implementation
 * Connects to NVIDIA NIM OpenAI-compatible API endpoint.
 * Base URL: https://integrate.api.nvidia.com/v1
 */

import { aiConfig } from '../config/aiConfig.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

export class NvidiaProvider {
  constructor(config = aiConfig.nvidia) {
    this.config = config
    this.name = 'nvidia'
  }

  /**
   * Execute chat completion via NVIDIA NIM completions endpoint.
   *
   * @param {Object} params
   * @param {string} [params.model='nvidia/nemotron-3-super-120b-a12b']
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} [params.temperature=0.2]
   * @param {number} [params.topP=null]
   * @param {number} [params.maxTokens=4096]
   * @param {boolean} [params.supportsJsonObject=true]
   * @param {AbortSignal} [params.signal=null]
   * @returns {Promise<{ text: string, actualModel: string, tokens: object, latencyMs: number, rawResponse: any }>}
   */
  async generate({
    model = 'nvidia/nemotron-3-super-120b-a12b',
    messages,
    temperature = 0.2,
    topP = null,
    maxTokens = 4096,
    supportsJsonObject = true,
    signal = null,
  }) {
    const apiKey = (this.config.apiKey || process.env.NVIDIA_API_KEY || '').trim()
    if (!apiKey) {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        message: 'NVIDIA API key is missing. Please set NVIDIA_API_KEY in environment variables.',
        provider: this.name,
        model,
        statusCode: 500,
        isRetryable: false,
      })
    }

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }

    if (topP != null) {
      payload.top_p = topP
    }

    if (supportsJsonObject) {
      payload.response_format = { type: 'json_object' }
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    const timeoutController = new AbortController()
    // Large report generations (16k output tokens) legitimately run 2-3 min —
    // scale the timeout with the requested budget instead of a flat 60s.
    const baseTimeoutMs = this.config.timeoutMs || 60000
    const scaledTimeoutMs = maxTokens != null && maxTokens > 4000 ? Math.max(baseTimeoutMs, maxTokens * 12) : baseTimeoutMs
    const timeoutId = setTimeout(() => timeoutController.abort(), scaledTimeoutMs)
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
        let errorCode = PROVIDER_ERROR_CODES.SERVER_ERROR
        const status = response.status
        const isRetryable = [408, 429, 500, 502, 503].includes(status)

        if (status === 429) {
          errorCode = PROVIDER_ERROR_CODES.RATE_LIMIT
        } else if (status === 400) {
          errorCode = PROVIDER_ERROR_CODES.BAD_REQUEST
        } else if (status === 401 || status === 403) {
          errorCode = PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED
        } else if (status === 408) {
          errorCode = PROVIDER_ERROR_CODES.TIMEOUT
        }

        const safeMessage = data?.error?.message || data?.detail || response.statusText || 'NVIDIA NIM request failed'

        throw new ProviderError({
          code: errorCode,
          message: `[NVIDIA ${status}] ${safeMessage}`,
          provider: this.name,
          model,
          statusCode: status,
          isRetryable,
          details: data?.error || data || null,
        })
      }

      const choice = data?.choices?.[0]
      const text = choice?.message?.content || choice?.message?.reasoning_content || choice?.message?.reasoning || null
      let finishReason = choice?.finish_reason || 'stop'
      if (finishReason === 'max_tokens' || finishReason === 'MAX_TOKENS') {
        finishReason = 'length'
      }
      const requestId = data?.id || response.headers.get('x-request-id') || null

      if (!text || !text.trim()) {
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.EMPTY_CONTENT,
          message: 'NVIDIA returned empty response content.',
          provider: this.name,
          model,
          statusCode: 200,
          isRetryable: true,
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
          reasoning: data?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
        },
        latencyMs,
        rawResponse: data,
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof ProviderError) throw err

      const isAbort = err.name === 'AbortError' || combinedSignal.aborted
      throw new ProviderError({
        code: isAbort ? PROVIDER_ERROR_CODES.TIMEOUT : PROVIDER_ERROR_CODES.SERVER_ERROR,
        message: isAbort ? 'NVIDIA request timed out' : (err.message || 'Error communicating with NVIDIA API'),
        provider: this.name,
        model,
        statusCode: isAbort ? 408 : 500,
        isRetryable: true,
        details: err.stack,
      })
    }
  }
}

export default NvidiaProvider
