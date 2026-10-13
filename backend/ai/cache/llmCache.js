/**
 * Career GPS AI Gateway V4 — Request Fingerprint & LLM Cache
 * 
 * Provides deterministic deduplication of identical requests to eliminate:
 * - duplicate LLM calls from user double-clicks or page re-renders
 * - redundant quota consumption
 * - unnecessary latency and provider strain
 * 
 * In-memory LRU-style cache with TTL expiration.
 */

import crypto from 'crypto'

export class LLMCache {
  /**
   * @param {Object} options
   * @param {number} [options.defaultTtlMs=3600000] - 1 hour TTL default
   * @param {number} [options.maxEntries=500] - Max cache size
   */
  constructor({ defaultTtlMs = 3600000, maxEntries = 500 } = {}) {
    this.defaultTtlMs = defaultTtlMs
    this.maxEntries = maxEntries
    this.store = new Map() // fingerprint -> { response, expiresAt, createdAt, tokens }
    this.hits = 0
    this.misses = 0
    this.savedTokens = 0
  }

  /**
   * Generates a deterministic SHA-256 fingerprint from request attributes.
   *
   * @param {Object} params
   * @param {string} params.purpose
   * @param {string} params.model
   * @param {string} params.contentHash - SHA-256 of compiled prompt content
   * @param {string} [params.responseFormat='json_object']
   * @param {number} [params.temperature=0.2]
   * @param {string} [params.version='v4']
   * @returns {string} 64-char hex fingerprint
   */
  static computeFingerprint({
    purpose = 'resume_analysis',
    model = 'default',
    contentHash,
    responseFormat = 'json_object',
    temperature = 0.2,
    version = 'v4',
  }) {
    if (!contentHash) {
      throw new Error('contentHash is required to compute LLM request fingerprint.')
    }
    return crypto
      .createHash('sha256')
      .update(`${version}:${purpose}:${model}:${contentHash}:${responseFormat}:${temperature}`)
      .digest('hex')
  }

  /**
   * Retrieves a cached response if valid and not expired.
   *
   * @param {string} fingerprint
   * @returns {Object|null}
   */
  get(fingerprint) {
    if (!fingerprint || !this.store.has(fingerprint)) {
      this.misses++
      return null
    }

    const entry = this.store.get(fingerprint)
    const now = Date.now()

    if (now >= entry.expiresAt) {
      this.store.delete(fingerprint)
      this.misses++
      return null
    }

    // Refresh LRU order (delete & re-insert)
    this.store.delete(fingerprint)
    this.store.set(fingerprint, entry)

    this.hits++
    if (entry.tokens?.total) {
      this.savedTokens += entry.tokens.total
    }

    return {
      ...entry.response,
      fromCache: true,
      cachedAt: entry.createdAt,
      fingerprint,
    }
  }

  /**
   * Stores a response in cache with TTL.
   *
   * @param {string} fingerprint
   * @param {Object} response
   * @param {number} [ttlMs]
   */
  set(fingerprint, response, ttlMs = this.defaultTtlMs) {
    if (!fingerprint || !response) return

    // Evict oldest entry if at capacity
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey) this.store.delete(oldestKey)
    }

    const now = Date.now()
    this.store.set(fingerprint, {
      response,
      expiresAt: now + ttlMs,
      createdAt: now,
      tokens: response.tokens || {},
    })
  }

  /**
   * Removes a specific key or invalidates by prefix/filter
   * @param {string} fingerprint
   */
  delete(fingerprint) {
    return this.store.delete(fingerprint)
  }

  /**
   * Clears entire cache
   */
  clear() {
    this.store.clear()
    this.hits = 0
    this.misses = 0
    this.savedTokens = 0
  }

  /**
   * Performance and observability metrics
   */
  stats() {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? (this.hits / total).toFixed(3) : '0.000'
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: parseFloat(hitRate),
      savedTokens: this.savedTokens,
    }
  }
}

export const llmCache = new LLMCache()
export default llmCache
