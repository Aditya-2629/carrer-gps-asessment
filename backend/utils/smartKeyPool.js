/**
 * SmartKeyPool: In-memory dynamic key manager with Sticky Success & Queue Deprioritization.
 *
 * Behavior:
 * 1. Reads multiple keys from comma-separated env vars OR indexed env vars.
 * 2. Always picks the first key in queue (activeKey).
 * 3. On failure: The failed key is penalized and moved to the VERY END of the queue with a cooldown.
 * 4. On success: If a fallback key succeeded, it is PROMOTED to index 0 (Sticky Success) so all future tasks use it.
 */

export class SmartKeyPool {
  constructor(serviceName, envVarConfigs = {}) {
    this.serviceName = serviceName
    this.primaryListEnv = envVarConfigs.listEnv // e.g. 'APIFY_API_KEYS' or ['APIFY_API_KEYS', 'APIFY_API_TOKENS']
    this.singleEnv = envVarConfigs.singleEnv // e.g. 'APIFY_API_TOKEN' or ['APIFY_API_TOKEN', 'APIFY_API_KEY']
    this.fallbackPrefixes = envVarConfigs.prefixes || [] // e.g. ['APIFY_API_TOKEN_', 'APIFY_API_KEY_']

    this.keys = []
    this.cooldowns = new Map() // key -> cooldownExpiryTimestamp
    this.cooldownDurationMs = envVarConfigs.cooldownMs || 15 * 60 * 1000 // 15 mins default

    this.reloadKeys()
  }

  reloadKeys() {
    const rawKeys = []

    // 1. Check comma/semicolon separated list env var(s)
    const listEnvs = Array.isArray(this.primaryListEnv)
      ? this.primaryListEnv
      : [this.primaryListEnv].filter(Boolean)

    for (const envName of listEnvs) {
      if (process.env[envName]) {
        const parts = process.env[envName].split(/[,;]/).map((k) => k.trim())
        rawKeys.push(...parts)
      }
    }

    // 2. Check primary single env var(s)
    const singleEnvs = Array.isArray(this.singleEnv)
      ? this.singleEnv
      : [this.singleEnv].filter(Boolean)

    for (const envName of singleEnvs) {
      if (process.env[envName]) {
        rawKeys.push(process.env[envName].trim())
      }
    }

    // 3. Check numbered fallbacks (e.g. KEY_1, KEY_2, KEY_FALLBACK, KEY_BACKUP)
    for (const prefix of this.fallbackPrefixes) {
      for (let i = 1; i <= 10; i++) {
        const val = process.env[`${prefix}${i}`]
        if (val && val.trim()) rawKeys.push(val.trim())
      }
      if (process.env[`${prefix}FALLBACK`]) rawKeys.push(process.env[`${prefix}FALLBACK`].trim())
      if (process.env[`${prefix}BACKUP`]) rawKeys.push(process.env[`${prefix}BACKUP`].trim())
    }

    // Deduplicate preserving initial order
    this.keys = Array.from(new Set(rawKeys.filter(Boolean)))
    if (this.keys.length > 0) {
      console.log(`[SmartKeyPool:${this.serviceName}] Initialized with ${this.keys.length} key(s). Active key ends with ...${this.keys[0].slice(-4)}`)
    } else {
      console.warn(`[SmartKeyPool:${this.serviceName}] Warning: No keys configured in environment!`)
    }
  }

  getKeyCount() {
    return this.keys.length
  }

  getActiveKey() {
    if (this.keys.length === 0) {
      this.reloadKeys()
    }
    if (this.keys.length === 0) return null
    return this.keys[0]
  }

  getAllKeys() {
    if (this.keys.length === 0) {
      this.reloadKeys()
    }
    return [...this.keys]
  }

  /**
   * Penalizes a failed key by moving it to the back of the queue and setting a cooldown.
   */
  reportFailure(failedKey, errorReason = 'Rate limit or Quota error') {
    if (!failedKey) return
    const keySuffix = failedKey.length > 4 ? failedKey.slice(-4) : failedKey

    // Set cooldown
    const expiresAt = Date.now() + this.cooldownDurationMs
    this.cooldowns.set(failedKey, expiresAt)

    // Push to back of the queue
    const oldIdx = this.keys.indexOf(failedKey)
    if (oldIdx !== -1) {
      this.keys.splice(oldIdx, 1)
      this.keys.push(failedKey)
    }

    console.warn(`[SmartKeyPool:${this.serviceName}] Key (...${keySuffix}) failed [${errorReason}]. Moved to END of queue. Cooldown: ${Math.round(this.cooldownDurationMs / 60000)}m. Next active key: ...${this.keys[0]?.slice(-4) || 'none'}`)
  }

  /**
   * Promotes a successful key to index 0 (Sticky Success) so next operations immediately use it.
   */
  reportSuccess(successfulKey) {
    if (!successfulKey || this.keys.length <= 1) return

    // Clear any previous cooldown for this key
    this.cooldowns.delete(successfulKey)

    const currentIdx = this.keys.indexOf(successfulKey)
    if (currentIdx > 0) {
      // It wasn't the first key, so promote it to index 0!
      this.keys.splice(currentIdx, 1)
      this.keys.unshift(successfulKey)
      console.log(`[SmartKeyPool:${this.serviceName}] Key (...${successfulKey.slice(-4)}) SUCCEEDED and promoted to PRIMARY! Future requests will use this key.`)
    }
  }

  /**
   * Executes an async operation with automatic retry & rotation through all available keys.
   * @param {Function} taskFn - async function(activeKey) => Promise<result>
   * @param {Object} [options]
   * @param {number} [options.maxAttempts]
   */
  async executeWithRetry(taskFn, options = {}) {
    if (this.keys.length === 0) {
      // Re-check once in case process.env was loaded late
      this.reloadKeys()
      if (this.keys.length === 0) {
        throw new Error(`[SmartKeyPool:${this.serviceName}] No API keys available to execute operation.`)
      }
    }

    const maxAttempts = options.maxAttempts || this.keys.length
    let lastError = null

    // Snapshot keys order for this execution cycle
    const candidateKeys = [...this.keys]

    for (let attempt = 0; attempt < Math.min(candidateKeys.length, maxAttempts); attempt++) {
      const currentKey = candidateKeys[attempt]

      // Check cooldown (only skip if we have other non-cooling keys)
      const isCooling = this.cooldowns.has(currentKey) && this.cooldowns.get(currentKey) > Date.now()
      if (isCooling && candidateKeys.length > 1 && attempt < candidateKeys.length - 1) {
        continue
      }

      try {
        const result = await taskFn(currentKey)
        // Mark sticky success!
        this.reportSuccess(currentKey)
        return result
      } catch (err) {
        lastError = err
        const errMsg = err?.message || String(err)
        const isAuthOrRateLimit = /401|402|429|quota|rate limit|exhausted|unauthorized|invalid token|insufficient balance|free users are limited|limited to \d+ runs/i.test(errMsg)

        this.reportFailure(currentKey, isAuthOrRateLimit ? 'Quota/RateLimit' : errMsg.slice(0, 60))
      }
    }

    throw new Error(`[SmartKeyPool:${this.serviceName}] All ${this.keys.length} key(s) failed. Last error: ${lastError?.message || lastError}`)
  }
}

// Global Singletons
export const apifyKeyPool = new SmartKeyPool('Apify', {
  listEnv: ['APIFY_API_KEYS', 'APIFY_API_TOKENS'],
  singleEnv: ['APIFY_API_TOKEN', 'APIFY_API_KEY'],
  prefixes: ['APIFY_API_TOKEN_', 'APIFY_API_KEY_'],
  cooldownMs: 20 * 60 * 1000, // 20 min cooldown on rate limit
})

export const geminiKeyPool = new SmartKeyPool('Gemini', {
  listEnv: 'GEMINI_API_KEYS',
  singleEnv: 'GEMINI_API_KEY',
  prefixes: ['GEMINI_API_KEY_FALLBACK_', 'GEMINI_API_KEY_'],
  cooldownMs: 15 * 60 * 1000,
})
