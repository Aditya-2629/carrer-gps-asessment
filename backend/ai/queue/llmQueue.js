/**
 * Career GPS AI Gateway V4 — Bounded LLM Queue & Concurrency Limiter
 * 
 * Prevents:
 * - Concurrent request spikes overwhelming upstream provider quotas
 * - Burst 429 rate limit errors
 * - Retry storms cascading across multiple worker threads
 * 
 * Provides per-provider concurrency slots and rate-paced interval dispatching.
 */

import { ProviderError, PROVIDER_ERROR_CODES } from '../gateway/providerErrors.js'

export class BoundedLLMQueue {
  /**
   * @param {Object} options
   * @param {Object} [options.concurrencyLimits] - Max active calls per provider
   * @param {number} [options.defaultConcurrency=2]
   * @param {number} [options.defaultIntervalMs=200] - Spacing between calls to same provider
   * @param {number} [options.maxQueueDepth=50] - Max waiting queue size
   * @param {number} [options.maxWaitMs=30000] - Max time an item may wait in queue
   */
  constructor({
    concurrencyLimits = {
      gemini: 2,
      groq: 3,
      nvidia: 2,
      openrouter: 2,
      grok: 2,
    },
    defaultConcurrency = 2,
    defaultIntervalMs = 200,
    maxQueueDepth = 50,
    maxWaitMs = 30000,
  } = {}) {
    this.concurrencyLimits = concurrencyLimits
    this.defaultConcurrency = defaultConcurrency
    this.defaultIntervalMs = defaultIntervalMs
    this.maxQueueDepth = maxQueueDepth
    this.maxWaitMs = maxWaitMs

    // provider -> Array<{ id, execute, resolve, reject, queuedAt, timeoutId, signal }>
    this.queues = new Map()
    // provider -> number
    this.activeCounts = new Map()
    // provider -> number (timestamp of last dispatch)
    this.lastDispatchTimes = new Map()

    this.metrics = {
      enqueued: 0,
      completed: 0,
      rejected: 0,
      timeouts: 0,
    }
  }

  getConcurrencyLimit(provider) {
    return this.concurrencyLimits[provider] || this.defaultConcurrency
  }

  getActiveCount(provider) {
    return this.activeCounts.get(provider) || 0
  }

  getQueue(provider) {
    if (!this.queues.has(provider)) {
      this.queues.set(provider, [])
    }
    return this.queues.get(provider)
  }

  /**
   * Enqueue an asynchronous LLM call with provider concurrency and rate limiting.
   *
   * @param {Object} params
   * @param {string} params.provider - Provider key (e.g. 'gemini', 'groq')
   * @param {Function} params.execute - Async function returning the LLM result
   * @param {AbortSignal} [params.signal] - Caller abort signal
   * @returns {Promise<any>}
   */
  async enqueue({ provider = 'default', execute, signal = null }) {
    this.metrics.enqueued++
    const queue = this.getQueue(provider)

    // Check backpressure depth
    if (queue.length >= this.maxQueueDepth) {
      this.metrics.rejected++
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.RATE_LIMIT,
        message: `AI Queue backpressure exceeded for provider "${provider}" (${queue.length} waiting).`,
        provider,
        statusCode: 429,
        isRetryable: true,
      })
    }

    return new Promise((resolve, reject) => {
      const item = {
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        execute,
        resolve,
        reject,
        queuedAt: Date.now(),
        timeoutId: null,
        signal,
      }

      // Queue wait timeout safety
      item.timeoutId = setTimeout(() => {
        const idx = queue.findIndex((i) => i.id === item.id)
        if (idx !== -1) {
          queue.splice(idx, 1)
          this.metrics.timeouts++
          reject(
            new ProviderError({
              code: PROVIDER_ERROR_CODES.TIMEOUT,
              message: `AI Queue wait timeout (${this.maxWaitMs}ms) exceeded for provider "${provider}".`,
              provider,
              statusCode: 408,
              isRetryable: true,
            })
          )
        }
      }, this.maxWaitMs)

      // Handle caller abort
      if (signal) {
        if (signal.aborted) {
          clearTimeout(item.timeoutId)
          return reject(new Error('Operation aborted prior to execution'))
        }
        signal.addEventListener('abort', () => {
          clearTimeout(item.timeoutId)
          const idx = queue.findIndex((i) => i.id === item.id)
          if (idx !== -1) {
            queue.splice(idx, 1)
            reject(new Error('Operation aborted by caller'))
          }
        }, { once: true })
      }

      queue.push(item)
      this.pump(provider)
    })
  }

  /**
   * Pumps the next eligible task from the provider's queue.
   */
  async pump(provider) {
    const queue = this.getQueue(provider)
    const limit = this.getConcurrencyLimit(provider)
    const active = this.getActiveCount(provider)

    if (queue.length === 0 || active >= limit) {
      return
    }

    // Rate pacing / interval spacing
    const lastDispatch = this.lastDispatchTimes.get(provider) || 0
    const now = Date.now()
    const elapsed = now - lastDispatch
    if (elapsed < this.defaultIntervalMs) {
      const delay = this.defaultIntervalMs - elapsed
      setTimeout(() => this.pump(provider), delay)
      return
    }

    const item = queue.shift()
    if (!item) return

    clearTimeout(item.timeoutId)
    this.activeCounts.set(provider, active + 1)
    this.lastDispatchTimes.set(provider, Date.now())

    try {
      const result = await item.execute()
      this.metrics.completed++
      item.resolve(result)
    } catch (err) {
      item.reject(err)
    } finally {
      const currentActive = this.getActiveCount(provider)
      this.activeCounts.set(provider, Math.max(0, currentActive - 1))
      // Trigger next task in queue
      setImmediate(() => this.pump(provider))
    }
  }

  /**
   * Observability metrics
   */
  stats() {
    const activeByProvider = {}
    const queueByProvider = {}
    for (const [p, count] of this.activeCounts.entries()) {
      activeByProvider[p] = count
    }
    for (const [p, q] of this.queues.entries()) {
      queueByProvider[p] = q.length
    }
    return {
      active: activeByProvider,
      waiting: queueByProvider,
      metrics: { ...this.metrics },
    }
  }
}

export const llmQueue = new BoundedLLMQueue()
export default llmQueue
