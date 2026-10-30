import { GoogleGenerativeAI } from '@google/generative-ai'
import { ProviderError, PROVIDER_ERROR_CODES } from '../ai/gateway/providerErrors.js'
import { AITelemetry } from '../ai/telemetry/aiTelemetry.js'
import {
  getVerifiedGeminiAllowlist,
  markModelPermanentlyUnavailable,
  isModelPermanentlyUnavailable,
} from '../ai/gateway/geminiModelDiscovery.js'
import { geminiKeyPool } from './smartKeyPool.js'

/**
 * Collects and deduplicates all available Gemini API keys from environment variables
 * via the unified SmartKeyPool singleton.
 */
export const getAllGeminiKeys = () => {
  return geminiKeyPool.getAllKeys()
}

/**
 * Executes a task using Gemini API with automatic key retry & rotation via SmartKeyPool.
 */
export async function callGeminiApiWithRetry(taskFn, options = {}) {
  return await geminiKeyPool.executeWithRetry(taskFn, options)
}

export { geminiKeyPool }

// Track exhausted keys with cooldown timestamps: apiKey -> expiresAt (for 401/402 global key failures)
export const keyExhaustionMap = new Map()

// Track model-specific key quotas: `${apiKey}:${model}` -> expiresAt
export const keyModelQuotaMap = new Map()

// Track project-level model quota cooldown: model -> expiresAt
export const projectModelQuotaMap = new Map()

export const clearKeyExhaustionMap = () => {
  keyExhaustionMap.clear()
  keyModelQuotaMap.clear()
  projectModelQuotaMap.clear()
}

/**
 * Checks whether an API key is healthy for a specific model.
 */
export function isKeyHealthyForModel(key, model) {
  const now = Date.now()
  if ((keyExhaustionMap.get(key) || 0) > now) return false
  if (model && (keyModelQuotaMap.get(`${key}:${model}`) || 0) > now) return false
  return true
}

/**
 * Checks whether project-level quota is exhausted for a specific model.
 */
export function isProjectQuotaExhaustedForModel(model) {
  if (!model) return false
  const now = Date.now()
  return (projectModelQuotaMap.get(model) || 0) > now
}

/**
 * Parses Gemini 429 quota exhaustion errors into structured information:
 * identifies whether it is project-level (PerProject / PerDay), extracts retryDelay,
 * and calculates appropriate cooldown milliseconds.
 */
export function parseGeminiQuotaDetails(err) {
  const msg = (err?.message || String(err)).toLowerCase()
  const rawDetails = err?.errorDetails || []
  let isProjectLevel = false
  let isDaily = false
  let quotaId = null
  let retryDelayMs = null

  if (
    msg.includes('perproject') ||
    msg.includes('per_project') ||
    msg.includes('project') ||
    msg.includes('generaterequestsperdayperprojectpermodel') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('429')
  ) {
    isProjectLevel = true
  }

  if (msg.includes('perday') || msg.includes('per_day') || msg.includes('daily')) {
    isDaily = true
  }

  for (const detail of rawDetails) {
    if (detail?.quotaId) {
      quotaId = detail.quotaId
      const qLower = String(quotaId).toLowerCase()
      if (qLower.includes('perproject') || qLower.includes('project')) isProjectLevel = true
      if (qLower.includes('perday') || qLower.includes('daily')) isDaily = true
    }
    if (detail?.retryDelay) {
      const match = String(detail.retryDelay).match(/^(\d+(?:\.\d+)?)s?$/)
      if (match) {
        retryDelayMs = parseFloat(match[1]) * 1000
      }
    }
  }

  // Parse retryDelay from message: e.g. "retryDelay": "22557s" or "Please retry in 6h15m57s"
  if (!retryDelayMs) {
    const sMatch = msg.match(/retrydelay["\s:]+["']?(\d+)s/i) || msg.match(/retry in (\d+)s/i)
    if (sMatch) {
      retryDelayMs = parseInt(sMatch[1], 10) * 1000
    } else {
      const hmsMatch = msg.match(/retry in (\d+)h(?:(\d+)m)?(?:(\d+)s)?/i)
      if (hmsMatch) {
        const hours = parseInt(hmsMatch[1], 10) || 0
        const mins = parseInt(hmsMatch[2], 10) || 0
        const secs = parseInt(hmsMatch[3], 10) || 0
        retryDelayMs = (hours * 3600 + mins * 60 + secs) * 1000
      }
    }
  }

  // Default cooldown calculation: if daily quota, at least 1 hour; otherwise 5 minutes
  if (!retryDelayMs) {
    retryDelayMs = isDaily ? 60 * 60 * 1000 : 5 * 60 * 1000
  }

  return { isProjectLevel, isDaily, quotaId, retryDelayMs }
}


/**
 * Active Production Verified Models in priority order:
 */
export const VERIFIED_GEMINI_MODELS = [
  'gemini-2.0-flash', // Fast, highly capable current generation
  'gemini-1.5-flash-latest', // Ultra-reliable fallback
  'gemini-1.5-pro-latest', // Deep reasoning for complex recruiter diagnosis
  'gemini-1.5-flash',
]

export const DEPRECATED_TRAP_MODELS = new Set([
  'gemini-1.0-pro',
  'gemini-1.0-pro-001',
  'gemini-1.5-pro-001',
  'gemini-1.5-flash-001',
  'gemini-2.5-flash', // Note: returns 404 in standard Google AI Studio endpoint
  'gemini-3.8-flash',
  'gemini-3.8',
  'gemini-3.7-flash',
  'gemini-3.7',
])

export function getCleanModelName(requestedModel) {
  if (!requestedModel || DEPRECATED_TRAP_MODELS.has(requestedModel)) {
    return process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  }
  return requestedModel
}

/**
 * Model priority chain — verified active Gemini flash models.
 * Prioritizes configured GEMINI_MODEL (default gemini-2.0-flash),
 * followed by verified stable fallbacks.
 */
export const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  ...VERIFIED_GEMINI_MODELS,
  'gemini-3.5-flash-lite',
].filter((m, idx, arr) => m && arr.indexOf(m) === idx && !DEPRECATED_TRAP_MODELS.has(m))

/**
 * Classifies errors into key-level quota/auth, transient service/model, or client errors.
 */
export function classifyGeminiError(err) {
  const errMsg = (err?.message || String(err)).toLowerCase()
  const status = Number(err?.status || err?.statusCode || 0)

  // 1. Key / Auth errors
  const isKeyInvalid =
    status === 401 ||
    errMsg.includes('api_key_invalid') ||
    errMsg.includes('api key not valid') ||
    errMsg.includes('invalid api key')

  const isPaymentRequired =
    status === 402 ||
    errMsg.includes('402') ||
    errMsg.includes('prepayment') ||
    errMsg.includes('payment required')

  const isNotFound =
    status === 404 ||
    errMsg.includes('404') ||
    errMsg.includes('not found') ||
    errMsg.includes('is no longer available')

  const isKeyQuota =
    status === 429 ||
    isPaymentRequired ||
    errMsg.includes('quota') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('rate limit')

  const isAuthOrQuota = status === 403 || isKeyInvalid || isKeyQuota

  // 2. Service / Model Transient errors
  const isServiceUnavailable =
    status === 503 ||
    status === 502 ||
    status === 504 ||
    errMsg.includes('503') ||
    errMsg.includes('service unavailable') ||
    errMsg.includes('unavailable') ||
    errMsg.includes('overloaded') ||
    errMsg.includes('high demand')

  const isTimeout =
    status === 408 ||
    errMsg.includes('timeout') ||
    errMsg.includes('aborted') ||
    errMsg.includes('deadline')

  const isNetworkTransient =
    errMsg.includes('econnreset') ||
    errMsg.includes('etimedout') ||
    errMsg.includes('fetch failed') ||
    errMsg.includes('network error')

  const isTransient = isServiceUnavailable || isTimeout || isNetworkTransient || status >= 500

  let effectiveStatus = status
  if (!effectiveStatus) {
    if (isServiceUnavailable) effectiveStatus = 503
    else if (isNotFound) effectiveStatus = 404
    else if (isPaymentRequired) effectiveStatus = 402
    else if (isKeyQuota) effectiveStatus = 429
    else if (isKeyInvalid) effectiveStatus = 401
    else if (isTimeout) effectiveStatus = 408
    else effectiveStatus = 500
  }

  return {
    isKeyInvalid,
    isKeyQuota,
    isPaymentRequired,
    isNotFound,
    isAuthOrQuota,
    isServiceUnavailable,
    isTimeout,
    isNetworkTransient,
    isTransient,
    status: effectiveStatus,
  }
}

/**
 * Extracts Retry-After header or delay hints from error response or messages.
 */
export function parseRetryAfter(err) {
  if (!err) return null
  if (typeof err.retryAfterMs === 'number') return err.retryAfterMs
  if (typeof err.retryAfter === 'number') return err.retryAfter * 1000

  const headers = err.response?.headers || err.headers
  if (headers) {
    const raw = typeof headers.get === 'function' ? headers.get('retry-after') : headers['retry-after']
    if (raw) {
      const parsedSeconds = Number(raw)
      if (!isNaN(parsedSeconds)) return parsedSeconds * 1000
      const parsedDate = Date.parse(raw)
      if (!isNaN(parsedDate)) {
        const diff = parsedDate - Date.now()
        if (diff > 0) return diff
      }
    }
  }

  const msg = (err.message || '').toLowerCase()
  const match = msg.match(/retry(?:-|\s+)after[:\s]+(\d+)/i) || msg.match(/try again in[:\s]+(\d+)/i)
  if (match && match[1]) {
    return Number(match[1]) * 1000
  }

  if (Array.isArray(err.errorDetails)) {
    for (const detail of err.errorDetails) {
      if (detail?.retryDelay) {
        const sec = parseFloat(detail.retryDelay)
        if (!isNaN(sec)) return sec * 1000
      }
    }
  }

  return null
}

/**
 * Computes bounded exponential backoff with jitter, honoring Retry-After when available.
 */
export function calculateBackoffWithJitter(attempt, baseDelayMs = 500, maxDelayMs = 3000, retryAfterMs = null) {
  if (retryAfterMs != null && !isNaN(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(maxDelayMs, Math.max(100, Math.floor(retryAfterMs)))
  }
  const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1))
  const jitter = Math.random() * (baseDelayMs * 0.5)
  return Math.min(maxDelayMs, Math.floor(exp + jitter))
}

/**
 * Cancellable sleep utility.
 */
export function sleep(ms, signal = null) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(signal.reason || new Error('Aborted'))
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason || new Error('Aborted'))
    }
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

/**
 * Generates content using Google Generative AI with:
 * - Multi-model fallback across registered models
 * - Multi-key rotation strictly for key-specific quota/auth errors (never for 503)
 * - Bounded exponential backoff with jitter and Retry-After support for transient 503/5xx
 * - Separate per-attempt timeout and total request deadline
 * - Cancellation using AbortController on timed-out or aborted attempts
 * - Sanitized telemetry logging (never leaking API keys, prompts, or resume text)
 *
 * @param {Object} options
 * @param {string|Array} options.contents - Prompt string or contents array
 * @param {string} [options.modelName] - Primary model to use
 * @param {Array<string>} [options.fallbackModels] - List of fallback models
 * @param {Object} [options.generationConfig] - Optional generation configuration
 * @param {number} [options.timeoutMs=20000] - Hard per-attempt timeout in ms
 * @param {number} [options.totalDeadlineMs=45000] - Total request deadline across retries/fallbacks
 * @param {number} [options.maxRetries=2] - Maximum transient retries per model
 * @param {number} [options.baseBackoffMs=500] - Base delay for exponential backoff
 * @param {number} [options.maxBackoffMs=3000] - Maximum delay ceiling for backoff
 * @param {AbortSignal} [options.signal=null] - Caller cancellation signal
 * @param {string} [options.requestId=null] - Correlation request ID
 * @param {Function} [options._clientFactory=null] - Injected client factory for testing
 * @param {Function} [options._sleepFn=null] - Injected sleep function for testing
 * @returns {Promise<{ text: string, modelUsed: string, keyIndex: number, rawResponse: any }>}
 */
export const generateContentWithFallback = async ({
  contents,
  modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  fallbackModels = DEFAULT_MODELS,
  generationConfig = {},
  timeoutMs = process.env.GEMINI_TIMEOUT_MS ? parseInt(process.env.GEMINI_TIMEOUT_MS, 10) : 15000,
  totalDeadlineMs = 60000,
  maxRetries = 2,
  baseBackoffMs = 500,
  maxBackoffMs = 3000,
  signal = null,
  requestId = null,
  _clientFactory = null,
  _sleepFn = null,
}) => {
  const allKeys = getAllGeminiKeys()

  if (allKeys.length === 0) {
    throw new ProviderError({
      code: PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
      message: 'No GEMINI_API_KEY found in environment variables. Please configure GEMINI_API_KEY or GEMINI_API_KEYS.',
      provider: 'gemini',
      model: modelName,
      statusCode: 401,
      isRetryable: false,
    })
  }

  const reqId = requestId || (AITelemetry.createRequestId ? AITelemetry.createRequestId() : `gem_${Date.now()}`)
  const requestStartTime = Date.now()
  const deadline = requestStartTime + totalDeadlineMs
  const errors = []

  const makeGenAI = _clientFactory || ((k) => new GoogleGenerativeAI(k))
  const waitFn = _sleepFn || sleep

  const resolveAlias = (m) => {
    if (m === 'gemini-3.1-pro') return 'gemini-3.1-pro-preview'
    return m
  }

  const cleanRequestedModel = getCleanModelName(modelName)
  const resolvedModelName = resolveAlias(cleanRequestedModel)
  const resolvedFallbacks = (fallbackModels || [])
    .map(resolveAlias)
    .filter((m) => !DEPRECATED_TRAP_MODELS.has(m))

  // Build model try list starting with the requested modelName, filtering out slow/hanging models unless forced
  const rawCandidates = Array.from(new Set([resolvedModelName, ...resolvedFallbacks].filter(Boolean)))
  const explicitAllowed = new Set(
    (process.env.GEMINI_FORCE_MODELS || process.env.GEMINI_EXPLICIT_MODELS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  const isCustomFallback = Boolean(fallbackModels && fallbackModels !== DEFAULT_MODELS)
  const candidateModels = rawCandidates.filter((m) => {
    if (DEPRECATED_TRAP_MODELS.has(m)) return false
    if (!isCustomFallback && m === 'gemini-3.6-flash' && !explicitAllowed.has(m) && cleanRequestedModel !== m) {
      return false
    }
    return true
  })
  if (candidateModels.length === 0) {
    candidateModels.push(process.env.GEMINI_MODEL || 'gemini-2.0-flash')
  }
  const modelsToTry = candidateModels.filter((m) => !isModelPermanentlyUnavailable(m))
  let lastModelError = null

  if (modelsToTry.length === 0) {
    throw new ProviderError({
      code: PROVIDER_ERROR_CODES.MODEL_NOT_FOUND,
      message: `All specified Gemini candidate models [${candidateModels.join(', ')}] are permanently unavailable or discontinued (HTTP 404).`,
      provider: 'gemini',
      model: modelName,
      statusCode: 404,
      isRetryable: true,
    })
  }

  // Outer loop: Models
  for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
    const currentModel = modelsToTry[modelIdx]

    // Check if currentModel has an active project-level quota cooldown
    if (isProjectQuotaExhaustedForModel(currentModel)) {
      const exp = projectModelQuotaMap.get(currentModel)
      console.warn(
        `[Gemini] Model "${currentModel}" is in active project quota cooldown until ${new Date(exp).toISOString()}. Skipping all keys for this model.`
      )
      continue
    }

    // Determine healthy keys for this model attempt
    const healthyKeys = allKeys.filter((k) => isKeyHealthyForModel(k, currentModel))
    if (healthyKeys.length === 0) {
      console.warn(`[Gemini] No healthy keys available for model "${currentModel}". Advancing to next candidate model.`)
      continue
    }
    const keysToTry = healthyKeys

    let modelFailedWithTransient = false
    let breakKeysForModel = false

    // Inner loop: Keys (for key-specific quota or auth issues)
    for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
      if (breakKeysForModel) break
      const currentKey = keysToTry[keyIdx]
      const keyDisplay = `key #${keyIdx + 1}`

      // Transient retry loop for this model & key
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        const attemptStartTime = Date.now()
        const remainingDeadlineMs = deadline - attemptStartTime

        if (remainingDeadlineMs <= 0) {
          const deadlineErr = new ProviderError({
            code: PROVIDER_ERROR_CODES.TIMEOUT,
            message: `[Gemini Timeout] Request deadline of ${totalDeadlineMs}ms exceeded on model ${currentModel}.`,
            provider: 'gemini',
            model: currentModel,
            statusCode: 408,
            isRetryable: true,
            details: { timeoutSource: 'total_deadline', totalDeadlineMs },
          })
          AITelemetry.logAttempt?.({
            requestId: reqId,
            model: currentModel,
            attempt,
            durationMs: Date.now() - attemptStartTime,
            httpStatus: 408,
            timeoutSource: 'total_deadline',
            fallbackOutcome: 'deadline_exceeded',
          })
          throw deadlineErr
        }

        if (signal?.aborted) {
          throw (signal.reason || new Error('Request aborted by caller'))
        }

        const effectiveTimeoutMs = Math.min(timeoutMs, remainingDeadlineMs)
        const attemptController = new AbortController()

        // Link parent signal to attempt controller
        const onParentAbort = () => attemptController.abort(signal.reason || new Error('Parent aborted'))
        if (signal) signal.addEventListener('abort', onParentAbort, { once: true })

        let timeoutTriggered = false
        const timer = setTimeout(() => {
          timeoutTriggered = true
          attemptController.abort(new Error(`Attempt timed out after ${effectiveTimeoutMs}ms`))
        }, effectiveTimeoutMs)

        try {
          console.log(
            `[Gemini] Attempting generation with key index #${keyIdx + 1} using model: ${currentModel} (attempt ${attempt}/${maxRetries + 1})`
          )

          const genAI = makeGenAI(currentKey)
          const model = genAI.getGenerativeModel(
            { model: currentModel, generationConfig },
            { timeout: effectiveTimeoutMs, signal: attemptController.signal }
          )

          const result = await model.generateContent(contents, {
            signal: attemptController.signal,
            timeout: effectiveTimeoutMs,
          })

          clearTimeout(timer)
          if (signal) signal.removeEventListener('abort', onParentAbort)

          const durationMs = Date.now() - attemptStartTime
          const responseText = typeof result?.response?.text === 'function' ? result.response.text() : (result?.text || '')

          // Clear exhaustion on successful key usage
          keyExhaustionMap.delete(currentKey)
          keyModelQuotaMap.delete(`${currentKey}:${currentModel}`)
          geminiKeyPool.reportSuccess(currentKey)

          console.log(`[Gemini] Success with key index #${keyIdx + 1} on model: ${currentModel} (${durationMs}ms)`)

          AITelemetry.logAttempt?.({
            requestId: reqId,
            model: currentModel,
            attempt,
            durationMs,
            httpStatus: 200,
            timeoutSource: null,
            fallbackOutcome: modelIdx > 0 ? 'fallback_success' : 'success',
          })

          return {
            text: responseText,
            modelUsed: currentModel,
            keyIndex: keyIdx,
            rawResponse: result,
          }
        } catch (err) {
          clearTimeout(timer)
          if (signal) signal.removeEventListener('abort', onParentAbort)

          const durationMs = Date.now() - attemptStartTime
          const classification = classifyGeminiError(err)
          const timeoutSource = timeoutTriggered ? 'attempt_timeout' : (classification.isTimeout ? 'sdk_timeout' : null)
          lastModelError = err

          const errMsg = err.message || String(err)
          console.warn(`[Gemini] Failed with key index #${keyIdx + 1} on model "${currentModel}" (attempt ${attempt}): ${errMsg}`)
          errors.push(`[${keyDisplay} / ${currentModel} / attempt ${attempt}]: ${errMsg}`)

          // 1. Key-specific errors (quota / auth):
          if (classification.isKeyInvalid || classification.isKeyQuota) {
            const isUnrecoverable = classification.isKeyInvalid || classification.isPaymentRequired
            if (isUnrecoverable) {
              const cooldownMs = 24 * 60 * 60 * 1000
              const reason = classification.isPaymentRequired ? 'prepayment credits depleted' : 'invalid key'
              console.warn(
                `[Gemini] ${keyDisplay} marked globally exhausted (${reason}). Rotating to next API key...`
              )
              keyExhaustionMap.set(currentKey, Date.now() + cooldownMs)
              geminiKeyPool.reportFailure(currentKey, reason)

              AITelemetry.logAttempt?.({
                requestId: reqId,
                model: currentModel,
                attempt,
                durationMs,
                httpStatus: classification.status,
                timeoutSource,
                fallbackOutcome: 'key_rotation',
              })

              break
            }

            // Quota exhaustion (429)
            const quotaInfo = parseGeminiQuotaDetails(err)
            const cooldownMs = quotaInfo.retryDelayMs
            const expiresAt = Date.now() + cooldownMs

            if (quotaInfo.isProjectLevel) {
              // Keys share this exhausted project quota for currentModel
              projectModelQuotaMap.set(currentModel, expiresAt)
              console.warn(
                `[Gemini] Shared project quota exhausted for model "${currentModel}" (${quotaInfo.quotaId || 'PerProject'}). Cooldown for ${Math.round(cooldownMs / 1000)}s until ${new Date(expiresAt).toISOString()}. Advancing to next model immediately without spinning remaining keys.`
              )

              AITelemetry.logAttempt?.({
                requestId: reqId,
                model: currentModel,
                attempt,
                durationMs,
                httpStatus: 429,
                timeoutSource,
                fallbackOutcome: 'project_quota_model_skip',
              })

              breakKeysForModel = true
              break
            } else {
              // Key-specific quota on this model
              keyModelQuotaMap.set(`${currentKey}:${currentModel}`, expiresAt)
              geminiKeyPool.reportFailure(currentKey, 'Quota/RateLimit')
              console.warn(
                `[Gemini] ${keyDisplay} marked exhausted for model "${currentModel}" (cooldown ${Math.round(cooldownMs / 1000)}s). Rotating to next API key...`
              )

              AITelemetry.logAttempt?.({
                requestId: reqId,
                model: currentModel,
                attempt,
                durationMs,
                httpStatus: 429,
                timeoutSource,
                fallbackOutcome: 'key_rotation',
              })

              break
            }
          }

          // 2. Transient model / service errors (503, 502, timeout, network error):
          if (classification.isTransient) {
            const isLastAttempt = attempt >= maxRetries + 1
            const remainingAfterAttempt = deadline - Date.now()

            AITelemetry.logAttempt?.({
              requestId: reqId,
              model: currentModel,
              attempt,
              durationMs,
              httpStatus: classification.status,
              timeoutSource,
              fallbackOutcome: isLastAttempt
                ? (modelIdx < modelsToTry.length - 1 ? 'model_fallback' : 'provider_failover')
                : 'retry',
            })

            // Check if attempt timed out or service is transiently degraded
            const isTimeoutError = classification.status === 408 || classification.isTimeout || timeoutTriggered

            if (!isLastAttempt && remainingAfterAttempt > 500) {
              const retryAfter = parseRetryAfter(err)
              const backoffMs = classification.status === 503
                ? Math.min(2500, Math.max(1500, calculateBackoffWithJitter(attempt, 1500, 2500, retryAfter)))
                : calculateBackoffWithJitter(attempt, baseBackoffMs, maxBackoffMs, retryAfter)
              const safeSleepMs = Math.min(backoffMs, remainingAfterAttempt - 200)

              if (safeSleepMs > 0) {
                console.log(
                  `[Gemini] Transient error (${classification.status || 408}) on ${currentModel}. Retrying in ${safeSleepMs}ms (attempt ${attempt}/${maxRetries + 1})...`
                )
                await waitFn(safeSleepMs, signal)
                continue // retry next attempt on same key & model
              }
            }

            // If we reached here on this key, retries are exhausted for this key.
            // If this is the last key available, set a short 30-second model cooldown (NOT 5 minutes!)
            // and cascade to the next model candidate/provider.
            const isLastKey = keyIdx >= keysToTry.length - 1
            if (isLastKey) {
              const cooldownMs = 30 * 1000 // 30 seconds cooldown for transient 503/timeout
              projectModelQuotaMap.set(currentModel, Date.now() + cooldownMs)
              console.warn(
                `[Gemini] Model "${currentModel}" failed all retries across keys with ${classification.status || 408} (${isTimeoutError ? 'attempt_timeout' : 'high_demand'}). 30s cooldown set. Cascading to next candidate...`
              )
              modelFailedWithTransient = true
              breakKeysForModel = true
              break
            } else {
              console.warn(
                `[Gemini] Key #${keyIdx + 1} exhausted retries for ${currentModel} (${classification.status || 408}). Rotating to next key...`
              )
              break // break attempt loop to try next keyIdx
            }
          }

          // 3. Client error (400, 404, bad request, invalid params):
          if (classification.isNotFound) {
            markModelPermanentlyUnavailable(currentModel)
            console.warn(
              `[Gemini] Model "${currentModel}" returned HTTP 404 (model not found/unsupported). Marking model as permanently unavailable. Advancing to next candidate model...`
            )
            AITelemetry.logAttempt?.({
              requestId: reqId,
              model: currentModel,
              attempt,
              durationMs,
              httpStatus: 404,
              timeoutSource,
              fallbackOutcome: 'model_not_found_skip',
            })
            lastModelError = new ProviderError({
              code: PROVIDER_ERROR_CODES.MODEL_NOT_FOUND,
              message: `Model "${currentModel}" not found or discontinued by Google Gemini API (HTTP 404).`,
              provider: 'gemini',
              model: currentModel,
              statusCode: 404,
              isRetryable: true,
            })
            // Break key loop immediately — do not retry other keys for a 404 model
            break
          }

          AITelemetry.logAttempt?.({
            requestId: reqId,
            model: currentModel,
            attempt,
            durationMs,
            httpStatus: classification.status,
            timeoutSource,
            fallbackOutcome: 'client_error',
          })
          throw err
        }
      }

      // If the model failed with a transient error (e.g. 503 or persistent timeout after retries),
      // do not rotate to another key for the same unavailable model.
      if (modelFailedWithTransient) {
        console.warn(
          `[Gemini] Service unavailable or persistent timeout on model "${currentModel}". Cascading to next fallback model/provider...`
        )
        break // break keys loop -> proceed to next model in modelIdx loop
      }
    }
  }

  // If all models were skipped due to active quota cooldowns:
  const hasActiveQuotaCooldown = modelsToTry.every((m) => isProjectQuotaExhaustedForModel(m) || !allKeys.some((k) => isKeyHealthyForModel(k, m)))
  if (hasActiveQuotaCooldown && !lastModelError) {
    throw new ProviderError({
      code: PROVIDER_ERROR_CODES.RATE_LIMIT,
      message: `All Gemini candidate models [${modelsToTry.join(', ')}] are currently in active quota cooldown (HTTP 429).`,
      provider: 'gemini',
      model: modelName,
      statusCode: 429,
      isRetryable: true,
    })
  }

  const detailedSummary = errors.join('\n')
  const lastErr = lastModelError
  const lastStatus = lastErr?.status || lastErr?.statusCode || 500
  const isDeadlineExceeded = Date.now() >= deadline
  const isLastUnavailable =
    lastStatus === 503 ||
    (lastErr?.message && lastErr.message.includes('503')) ||
    (lastErr?.message && lastErr.message.includes('Unavailable')) ||
    (lastErr?.message && lastErr.message.includes('high demand'))
  const isLastNotFound =
    lastStatus === 404 ||
    lastErr?.code === PROVIDER_ERROR_CODES.MODEL_NOT_FOUND ||
    (lastErr?.message && lastErr.message.includes('404')) ||
    (lastErr?.message && lastErr.message.includes('not found'))

  const errorCode = isDeadlineExceeded
    ? PROVIDER_ERROR_CODES.TIMEOUT
    : isLastUnavailable
    ? PROVIDER_ERROR_CODES.SERVICE_UNAVAILABLE
    : lastStatus === 429
    ? PROVIDER_ERROR_CODES.RATE_LIMIT
    : lastStatus === 408
    ? PROVIDER_ERROR_CODES.TIMEOUT
    : isLastNotFound
    ? PROVIDER_ERROR_CODES.MODEL_NOT_FOUND
    : PROVIDER_ERROR_CODES.SERVER_ERROR

  const finalStatusCode = isDeadlineExceeded ? 408 : lastStatus

  throw new ProviderError({
    code: errorCode,
    message: isDeadlineExceeded
      ? `[Gemini Timeout] Total request deadline of ${totalDeadlineMs}ms exceeded across models [${modelsToTry.join(', ')}].\nErrors:\n${detailedSummary}`
      : `All Gemini API keys and model fallbacks exhausted. Attempted ${allKeys.length} key(s) across models [${modelsToTry.join(', ')}].\nErrors:\n${detailedSummary}`,
    provider: 'gemini',
    model: modelName,
    statusCode: finalStatusCode,
    isRetryable:
      isDeadlineExceeded ||
      isLastUnavailable ||
      isLastNotFound ||
      lastStatus === 429 ||
      lastStatus === 402 ||
      lastStatus === 408 ||
      lastStatus === 404 ||
      lastStatus >= 500,
    details: { errors, modelsAttempted: modelsToTry, timeoutSource: isDeadlineExceeded ? 'total_deadline' : null },
  })
}

/**
 * Generates embeddings with multi-key fallback without logging API keys.
 */
export const embedContentWithFallback = async (text, modelName = 'text-embedding-004') => {
  if (!text || !text.trim()) return null

  if (geminiKeyPool.getKeyCount() === 0) {
    console.warn('[Gemini Embedding] No GEMINI_API_KEY found.')
    return null
  }

  try {
    return await geminiKeyPool.executeWithRetry(async (activeKey) => {
      const genAI = new GoogleGenerativeAI(activeKey)
      const embeddingModel = genAI.getGenerativeModel({ model: modelName })
      const result = await embeddingModel.embedContent(text.slice(0, 2000))

      if (result?.embedding?.values && result.embedding.values.length > 0) {
        return result.embedding.values
      }
      throw new Error('Empty embedding values returned')
    })
  } catch (err) {
    console.warn(`[Gemini Embedding] All API keys failed for embedding generation: ${err.message}`)
    return null
  }
}
