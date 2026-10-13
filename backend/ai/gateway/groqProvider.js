/**
 * Groq Provider Implementation (Primary for Resume Agent V1.2)
 * Connects directly to Groq's OpenAI-compatible API using native fetch.
 * Base URL: https://api.groq.com/openai/v1
 */

import { aiConfig } from '../config/aiConfig.js'
import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

/**
 * Extracts Retry-After or rate limit reset duration from Groq response headers or error message.
 * @param {Response} response
 * @param {Object} data
 * @returns {number|null} Delay in milliseconds
 */
export function parseGroqRetryAfter(response, data) {
  // 1. Retry-After header (seconds)
  const retryAfterHeader = response?.headers?.get ? response.headers.get('retry-after') : response?.headers?.['retry-after']
  if (retryAfterHeader) {
    const sec = parseFloat(retryAfterHeader)
    if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000)
  }

  // 2. x-ratelimit-reset-tokens or x-ratelimit-reset-requests header
  const resetTokens = response?.headers?.get
    ? (response.headers.get('x-ratelimit-reset-tokens') || response.headers.get('x-ratelimit-reset-requests'))
    : (response?.headers?.['x-ratelimit-reset-tokens'] || response?.headers?.['x-ratelimit-reset-requests'])
  if (resetTokens) {
    const sMatch = String(resetTokens).match(/([\d.]+)s/i)
    if (sMatch) return Math.ceil(parseFloat(sMatch[1]) * 1000)
    const msMatch = String(resetTokens).match(/([\d.]+)ms/i)
    if (msMatch) return Math.ceil(parseFloat(msMatch[1]))
  }

  // 3. Error message strings e.g. "Please try again in 1.42s" or "try again in 1420ms"
  const errMsg = data?.error?.message || ''
  const msgSecMatch = errMsg.match(/try again in ([\d.]+)s/i)
  if (msgSecMatch) {
    return Math.ceil(parseFloat(msgSecMatch[1]) * 1000)
  }
  const msgMsMatch = errMsg.match(/try again in ([\d.]+)ms/i)
  if (msgMsMatch) {
    return Math.ceil(parseFloat(msgMsMatch[1]))
  }

  return null
}

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
   * @param {number} [params.totalDeadlineMs=60000]
   * @param {Function} [params._sleepFn=null]
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
    totalDeadlineMs = 60000,
    _sleepFn = null,
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

    if (signal?.aborted) {
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.TIMEOUT,
        message: 'Groq request aborted prior to execution.',
        provider: this.name,
        model,
        statusCode: 408,
        isRetryable: false,
      })
    }

    let lastError = null
    const requestStartTime = Date.now()
    const deadline = requestStartTime + totalDeadlineMs

    for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
      if (signal?.aborted) {
        throw new ProviderError({
          code: PROVIDER_ERROR_CODES.TIMEOUT,
          message: 'Groq request aborted by caller.',
          provider: this.name,
          model,
          statusCode: 408,
          isRetryable: false,
        })
      }

      const apiKey = keys[keyIdx]
      const maskedKey = `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`
      const hasMoreKeys = keyIdx < keys.length - 1

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      }

      const attemptTimeoutMs = this.config.timeoutMs || 60000
      const attemptController = new AbortController()
      let attemptTimedOut = false

      const onParentAbort = () => {
        attemptController.abort(signal.reason || new Error('Parent request aborted'))
      }
      if (signal) {
        signal.addEventListener('abort', onParentAbort, { once: true })
      }

      const timeoutId = setTimeout(() => {
        attemptTimedOut = true
        attemptController.abort(new Error(`Timeout of ${attemptTimeoutMs}ms exceeded on groq key #${keyIdx + 1}`))
      }, attemptTimeoutMs)

      const startTime = Date.now()
      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: attemptController.signal,
        })

        clearTimeout(timeoutId)
        if (signal) signal.removeEventListener('abort', onParentAbort)
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
            const retryAfterMs = parseGroqRetryAfter(response, data)
            const remainingDeadlineMs = deadline - Date.now()
            const MAX_GROQ_429_WAIT_MS = 2500

            // If wait is bounded (<= 2500ms) and fits within remaining deadline (> wait + 1000ms),
            // wait once and retry on the same key before rotating!
            if (
              retryAfterMs != null &&
              retryAfterMs <= MAX_GROQ_429_WAIT_MS &&
              remainingDeadlineMs > retryAfterMs + 1000 &&
              !attemptController.signal.aborted
            ) {
              const sleepDurationMs = retryAfterMs + Math.floor(Math.random() * 50)
              console.log(
                `[GroqProvider] Key #${keyIdx + 1} (${maskedKey}) hit 429 TPM limit. Waiting ${sleepDurationMs}ms (Retry-After: ${retryAfterMs}ms) to retry on same key...`
              )
              const waitFn = _sleepFn || ((ms) => new Promise((res) => setTimeout(res, ms)))
              await waitFn(sleepDurationMs)

              if (!attemptController.signal.aborted && !signal?.aborted) {
                try {
                  const retryResp = await fetch(`${this.config.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: attemptController.signal,
                  })
                  if (retryResp.ok) {
                    const retryData = await retryResp.json().catch(() => null)
                    const choice = retryData?.choices?.[0]
                    const text = choice?.message?.content
                    if (text && text.trim()) {
                      clearTimeout(timeoutId)
                      if (signal) signal.removeEventListener('abort', onParentAbort)
                      console.log(`[GroqProvider] Key #${keyIdx + 1} (${maskedKey}) succeeded after 429 backoff!`)
                      let finishReason = choice?.finish_reason || 'stop'
                      if (finishReason === 'max_tokens' || finishReason === 'MAX_TOKENS') finishReason = 'length'
                      return {
                        text: text.trim(),
                        actualModel: retryData?.model || model,
                        finishReason,
                        requestId: retryData?.id || retryResp.headers.get('x-request-id') || null,
                        tokens: {
                          prompt: retryData?.usage?.prompt_tokens ?? null,
                          completion: retryData?.usage?.completion_tokens ?? null,
                          total: retryData?.usage?.total_tokens ?? null,
                          reasoning: retryData?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
                        },
                        latencyMs: Date.now() - startTime,
                        rawResponse: retryData,
                        keyIndex: keyIdx,
                      }
                    }
                  } else {
                    const retryErrData = await retryResp.json().catch(() => null)
                    console.warn(
                      `[GroqProvider] Retry on key #${keyIdx + 1} returned HTTP ${retryResp.status}: ${retryErrData?.error?.message || retryResp.statusText}`
                    )
                  }
                } catch (retryFetchErr) {
                  console.warn(`[GroqProvider] Retry fetch failed on key #${keyIdx + 1}: ${retryFetchErr.message}`)
                }
              }
            }
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
        if (signal) signal.removeEventListener('abort', onParentAbort)
        if (err instanceof ProviderError) throw err

        if (signal?.aborted) {
          throw new ProviderError({
            code: PROVIDER_ERROR_CODES.TIMEOUT,
            message: 'Groq request aborted by caller.',
            provider: this.name,
            model,
            statusCode: 408,
            isRetryable: false,
          })
        }

        const isAbort = err.name === 'AbortError' || attemptTimedOut
        const fetchError = new ProviderError({
          code: isAbort ? PROVIDER_ERROR_CODES.TIMEOUT : PROVIDER_ERROR_CODES.SERVER_ERROR,
          message: isAbort ? `Groq request timed out after ${attemptTimeoutMs}ms` : (err.message || 'Error communicating with Grok/Groq API'),
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
