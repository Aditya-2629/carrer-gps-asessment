/**
 * Groq Provider Implementation (Primary for Resume Agent V1.2)
 * Connects directly to Groq's OpenAI-compatible API using native fetch.
 * Base URL: https://api.groq.com/openai/v1
 */

import { aiConfig } from '../config/aiConfig.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

export class GroqProvider {
  constructor(config = aiConfig.groq) {
    this.config = config
    this.name = 'groq'
  }

  /**
   * Retrieves all configured Groq API keys
   * @returns {string[]}
   */
  getKeys() {
    if (this.config.apiKeys && Array.isArray(this.config.apiKeys) && this.config.apiKeys.length > 0) {
      return this.config.apiKeys
    }
    const singleKey = (this.config.apiKey || process.env.GROQ_API_KEY || '').trim()
    return singleKey ? [singleKey] : []
  }

  /**
   * Execute chat completion via Groq's OpenAI-compatible completions endpoint.
   * Supports automatic key failover across all configured fallback keys upon
   * rate limits (429), quota exhaustion, or retryable errors.
   *
   * @param {Object} params
   * @param {string} [params.model='openai/gpt-oss-120b']
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} [params.temperature=0.2]
   * @param {number} [params.maxTokens=4096]
   * @param {boolean} [params.supportsJsonObject=true]
   * @param {Object} [params.jsonSchema=null]
   * @param {AbortSignal} [params.signal=null]
   * @returns {Promise<{ text: string, actualModel: string, tokens: object, latencyMs: number, rawResponse: any, keyIndex: number }>}
   */
  async generate({
    model = 'openai/gpt-oss-120b',
    messages,
    temperature = 0.2,
    topP = null,
    maxTokens = 4096,
    supportsJsonObject = true,
    jsonSchema = null,
    signal = null,
  }) {
    const keys = this.getKeys()
    if (keys.length === 0) {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        message: 'Groq API key is missing. Please set GROQ_API_KEY in environment variables.',
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

    if (jsonSchema) {
      payload.response_format = {
        type: 'json_schema',
        json_schema: jsonSchema,
      }
    } else if (supportsJsonObject) {
      payload.response_format = { type: 'json_object' }
    }

    let lastError = null

    for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
      const apiKey = keys[keyIdx]
      const maskedKey = `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`
      const hasMoreKeys = keyIdx < keys.length - 1

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      }

      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => timeoutController.abort(), this.config.timeoutMs || 60000)
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

        // Extract safe rate limit and diagnostics headers
        const rateLimitHeaders = {
          limitRequests: response.headers.get('x-ratelimit-limit-requests'),
          remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
          resetRequests: response.headers.get('x-ratelimit-reset-requests'),
          limitTokens: response.headers.get('x-ratelimit-limit-tokens'),
          remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
          resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
          retryAfter: response.headers.get('retry-after'),
        }

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

          const safeMessage = data?.error?.message || response.statusText || 'Groq API request failed'
          const providerErr = new ProviderError({
            code: errorCode,
            message: `[Groq ${status}] ${safeMessage}`,
            provider: this.name,
            model,
            statusCode: status,
            isRetryable,
            details: {
              keyIndex: keyIdx,
              rateLimitHeaders,
              rawError: data?.error || null,
            },
          })

          // If key hit rate limit (429), quota issue (401/403), timeout or server error, and we have fallback keys:
          if (hasMoreKeys && (status === 429 || status === 401 || status === 403 || isRetryable)) {
            console.warn(
              `[GroqProvider] Key #${keyIdx + 1} (${maskedKey}) failed with HTTP ${status}: ${safeMessage}. Falling back to key #${keyIdx + 2}...`
            )
            lastError = providerErr
            continue
          }

          throw providerErr
        }

        const choice = data?.choices?.[0]
        const text = choice?.message?.content
        let finishReason = choice?.finish_reason || 'stop'
        if (finishReason === 'max_tokens' || finishReason === 'MAX_TOKENS') {
          finishReason = 'length'
        }
        const requestId = data?.id || response.headers.get('x-request-id') || null

        if (!text || !text.trim()) {
          const emptyError = new ProviderError({
            code: PROVIDER_ERROR_CODES.EMPTY_CONTENT,
            message: 'Groq returned an empty response content.',
            provider: this.name,
            model,
            statusCode: 200,
            isRetryable: true,
          })

          if (hasMoreKeys) {
            console.warn(`[GroqProvider] Key #${keyIdx + 1} (${maskedKey}) returned empty content. Falling back to key #${keyIdx + 2}...`)
            lastError = emptyError
            continue
          }

          throw emptyError
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
          keyIndex: keyIdx,
        }
      } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof ProviderError) throw err

        const isAbort = err.name === 'AbortError' || combinedSignal.aborted
        const fetchError = new ProviderError({
          code: isAbort ? PROVIDER_ERROR_CODES.TIMEOUT : PROVIDER_ERROR_CODES.SERVER_ERROR,
          message: isAbort ? 'Groq request timed out' : (err.message || 'Error communicating with Grok/Groq API'),
          provider: this.name,
          model,
          statusCode: isAbort ? 408 : 500,
          isRetryable: true,
          details: err.stack,
        })

        if (hasMoreKeys) {
          console.warn(
            `[GroqProvider] Key #${keyIdx + 1} (${maskedKey}) network error: ${err.message}. Falling back to key #${keyIdx + 2}...`
          )
          lastError = fetchError
          continue
        }

        throw fetchError
      }
    }

    throw lastError || new ProviderError({
      code: PROVIDER_ERROR_CODES.SERVER_ERROR,
      message: 'All Groq API keys failed.',
      provider: this.name,
      model,
      statusCode: 500,
      isRetryable: true,
    })
  }
}

export default GroqProvider
