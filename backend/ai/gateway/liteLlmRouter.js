/**
 * Career GPS AI Gateway V4 — LiteLLM Provider Router & Circuit Breaker
 * 
 * Provides:
 * 1. Circuit Breaker: Automatically detects 503 SERVICE_UNAVAILABLE, 502, or consecutive timeouts,
 *    tripping the circuit to OPEN so subsequent requests immediately bypass the degraded provider
 *    without wasting 20 seconds waiting for dead endpoints.
 * 2. Canary Recovery: Transitions from OPEN to HALF_OPEN after a cooldown period to probe provider recovery.
 * 3. Exponential Backoff with Jitter: Eliminates retry storms during transient rate limits.
 * 4. Fast Fallback Routing: Seamlessly routes from Gemini -> Groq -> NVIDIA -> OpenRouter.
 */

import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Degraded / Failing: fast-failover active
  HALF_OPEN: 'HALF_OPEN', // Testing recovery with canary request
}

export class LiteLLMRouter {
  /**
   * @param {Object} options
   * @param {number} [options.failureThreshold=2] - Failures before tripping circuit
   * @param {number} [options.cooldownMs=45000] - 45s cooldown when circuit trips
   * @param {number} [options.timeoutPerAttemptMs=60000] - 60s hard timeout per provider attempt
   */
  constructor({
    failureThreshold = 2,
    cooldownMs = 45000,
    timeoutPerAttemptMs = parseInt(process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS || '60000', 10),
  } = {}) {
    this.failureThreshold = failureThreshold
    this.cooldownMs = cooldownMs
    this.timeoutPerAttemptMs = timeoutPerAttemptMs

    // providerKey -> { state: CIRCUIT_STATES, consecutiveFailures: number, lastFailureTime: number, tripCount: number }
    this.circuitRegistry = new Map()
  }

  getCircuit(providerKey) {
    if (!this.circuitRegistry.has(providerKey)) {
      this.circuitRegistry.set(providerKey, {
        state: CIRCUIT_STATES.CLOSED,
        consecutiveFailures: 0,
        lastFailureTime: 0,
        tripCount: 0,
      })
    }
    return this.circuitRegistry.get(providerKey)
  }

  /**
   * Checks if provider is healthy or ready for a canary attempt.
   * @param {string} providerKey
   * @returns {{ isAvailable: boolean, reason?: string }}
   */
  isProviderAvailable(providerKey) {
    const circuit = this.getCircuit(providerKey)
    const now = Date.now()

    if (circuit.state === CIRCUIT_STATES.CLOSED) {
      return { isAvailable: true }
    }

    if (circuit.state === CIRCUIT_STATES.OPEN) {
      if (now - circuit.lastFailureTime > this.cooldownMs) {
        // Cooldown passed: allow one canary request in HALF_OPEN state
        circuit.state = CIRCUIT_STATES.HALF_OPEN
        console.log(`[LiteLLMRouter] Circuit for "${providerKey}" transitioned to HALF_OPEN (probing canary request).`)
        return { isAvailable: true }
      }
      return {
        isAvailable: false,
        reason: `Circuit for "${providerKey}" is OPEN (${Math.ceil((this.cooldownMs - (now - circuit.lastFailureTime)) / 1000)}s cooldown remaining).`,
      }
    }

    // HALF_OPEN allows the canary
    return { isAvailable: true }
  }

  /**
   * Reports a successful provider execution. Resets circuit to CLOSED.
   * @param {string} providerKey
   */
  reportSuccess(providerKey) {
    const circuit = this.getCircuit(providerKey)
    if (circuit.state !== CIRCUIT_STATES.CLOSED) {
      console.log(`[LiteLLMRouter] Provider "${providerKey}" recovered successfully. Circuit reset to CLOSED.`)
    }
    circuit.state = CIRCUIT_STATES.CLOSED
    circuit.consecutiveFailures = 0
  }

  /**
   * Reports a provider failure. Evaluates whether to trip circuit to OPEN.
   * @param {string} providerKey
   * @param {Error|ProviderError} err
   */
  reportFailure(providerKey, err) {
    const circuit = this.getCircuit(providerKey)
    circuit.lastFailureTime = Date.now()
    circuit.consecutiveFailures++

    const statusCode = err?.statusCode || 500
    const code = err?.code || ''
    const msg = (err?.message || '').toLowerCase()

    const isServiceUnavailable =
      statusCode === 503 ||
      statusCode === 502 ||
      code === 'SERVICE_UNAVAILABLE' ||
      msg.includes('503') ||
      msg.includes('service unavailable') ||
      msg.includes('overloaded')

    const isConsecutiveTimeout =
      (statusCode === 408 || code === PROVIDER_ERROR_CODES.TIMEOUT) &&
      circuit.consecutiveFailures >= this.failureThreshold

    if (isServiceUnavailable || isConsecutiveTimeout) {
      circuit.state = CIRCUIT_STATES.OPEN
      circuit.tripCount++
      console.warn(
        `[LiteLLMRouter] Tripped circuit to OPEN for provider "${providerKey}" due to: ${err.message || 'service outage'}. Cooldown: ${this.cooldownMs / 1000}s.`
      )
    }
  }

  /**
   * Computes exponential backoff with jitter
   * @param {number} attempt - 1-indexed attempt number
   * @param {number} [baseDelayMs=300]
   * @param {number} [maxDelayMs=3000]
   * @returns {number} delay in milliseconds
   */
  calculateBackoff(attempt, baseDelayMs = 300, maxDelayMs = 3000) {
    const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1))
    const jitter = Math.random() * (baseDelayMs * 0.5)
    return Math.floor(exp + jitter)
  }

  /**
   * Wraps an execution in a per-attempt hard timeout with native cancellation.
   * @param {Function} task - (signal?: AbortSignal) => Promise<any>
   * @param {number} timeoutMs
   * @param {string} providerKey
   * @param {AbortSignal} [parentSignal=null]
   * @returns {Promise<any>}
   */
  async executeWithTimeout(task, timeoutMs = this.timeoutPerAttemptMs, providerKey = 'provider', parentSignal = null) {
    const controller = new AbortController()
    let timeoutHandle = null

    const onParentAbort = () => {
      controller.abort(parentSignal.reason || new Error('Aborted by caller'))
    }
    if (parentSignal) {
      if (parentSignal.aborted) {
        throw (parentSignal.reason || new Error('Operation aborted prior to execution'))
      }
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
    }

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort(new Error(`Timeout of ${timeoutMs}ms exceeded on ${providerKey}`))
        reject(
          new ProviderError({
            code: PROVIDER_ERROR_CODES.TIMEOUT,
            message: `Provider "${providerKey}" timed out after ${timeoutMs}ms.`,
            provider: providerKey,
            statusCode: 408,
            isRetryable: true,
            details: { timeoutSource: 'router_timeout', timeoutMs },
          })
        )
      }, timeoutMs)
    })

    try {
      const result = await Promise.race([task(controller.signal), timeoutPromise])
      clearTimeout(timeoutHandle)
      if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort)
      return result
    } catch (err) {
      clearTimeout(timeoutHandle)
      if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort)
      controller.abort(err)
      throw err
    }
  }

  /**
   * Observability metrics
   */
  stats() {
    const circuits = {}
    for (const [key, c] of this.circuitRegistry.entries()) {
      circuits[key] = {
        state: c.state,
        failures: c.consecutiveFailures,
        trips: c.tripCount,
        lastFailure: c.lastFailureTime ? new Date(c.lastFailureTime).toISOString() : null,
      }
    }
    return circuits
  }

  /**
   * Reset all circuits to CLOSED. Useful for testing and manual recovery.
   */
  reset() {
    this.circuitRegistry.clear()
  }
}

export const liteLlmRouter = new LiteLLMRouter()
export default liteLlmRouter
