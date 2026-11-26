/**
 * True Round-Robin API Key Manager with Instant Fail-Over & Cooldowns.
 *
 * Supports:
 * - Multi-format env loading (comma-separated lists, primary single vars, numbered *_1..20, *_FALLBACK, *_BACKUP)
 * - Per-provider rotating Round-Robin cursor: cursor = (cursor + 1) % pool.length
 * - Instant roll-over:
 *   - HTTP 429 -> 90s cooldown on that key only
 *   - HTTP 401 / 402 / 403 -> 30m exhausted state on that key only
 * - Runtime enable/disable toggles & per-key stats for Admin UI
 */

export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '••••'
  const clean = key.trim()
  if (clean.length <= 10) return `${clean.slice(0, 2)}••••${clean.slice(-2)}`
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`
}

export class RoundRobinKeyPool {
  constructor(providerName, envConfig = {}) {
    this.providerName = providerName
    this.envConfig = envConfig
    this.cursor = -1
    this.dbKeys = []
    this.entries = [] // Array<{ key, maskedKey, source, requestsServed, failures, cooldownUntil, exhaustedUntil, disabled, lastUsedAt, lastError }>
    this.reloadKeys()
  }

  setDbKeys(keys = []) {
    this.dbKeys = Array.isArray(keys)
      ? Array.from(new Set(keys.map((k) => String(k || '').trim()).filter(Boolean)))
      : []
    this.reloadKeys()
  }

  reloadKeys() {
    const rawEnvKeys = []
    const { listEnvs = [], singleEnvs = [], prefixes = [] } = this.envConfig

    for (const envName of listEnvs) {
      if (process.env[envName]) {
        rawEnvKeys.push(...process.env[envName].split(/[,;]/).map((k) => k.trim()))
      }
    }
    for (const envName of singleEnvs) {
      if (process.env[envName]) {
        rawEnvKeys.push(process.env[envName].trim())
      }
    }
    for (const prefix of prefixes) {
      for (let i = 1; i <= 20; i++) {
        const val = process.env[`${prefix}${i}`]
        if (val && val.trim()) rawEnvKeys.push(val.trim())
      }
      if (process.env[`${prefix}FALLBACK`]) rawEnvKeys.push(process.env[`${prefix}FALLBACK`].trim())
      if (process.env[`${prefix}BACKUP`]) rawEnvKeys.push(process.env[`${prefix}BACKUP`].trim())
    }

    const envSet = new Set(rawEnvKeys.filter(Boolean))
    const merged = Array.from(new Set([...envSet, ...(this.dbKeys || [])]))
    const existingByKey = new Map(this.entries.map((e) => [e.key, e]))

    this.entries = merged.map((key) => {
      const source = envSet.has(key) ? 'env' : 'db'
      const prev = existingByKey.get(key)
      if (prev) {
        prev.source = source
        return prev
      }
      return {
        key,
        maskedKey: maskApiKey(key),
        source,
        requestsServed: 0,
        failures: 0,
        cooldownUntil: 0,
        exhaustedUntil: 0,
        disabled: false,
        lastUsedAt: null,
        lastError: null,
      }
    })
  }

  _ensureLoaded() {
    if (this.entries.length === 0) {
      this.reloadKeys()
    }
  }

  _getEntryStatus(entry, now = Date.now()) {
    if (entry.disabled) return 'disabled'
    if (entry.exhaustedUntil > now) return 'exhausted'
    if (entry.cooldownUntil > now) return 'cooldown'
    return 'active'
  }

  /**
   * Returns keys ordered by true Round-Robin rotation starting at the next cursor.
   * Healthy keys come first; cooling/exhausted keys are omitted unless all keys are cooling.
   */
  acquireOrderedKeys() {
    this._ensureLoaded()
    const total = this.entries.length
    if (total === 0) return []

    const now = Date.now()
    this.cursor = (this.cursor + 1) % total

    const rotated = []
    for (let offset = 0; offset < total; offset++) {
      const entry = this.entries[(this.cursor + offset) % total]
      if (!entry.disabled) {
        rotated.push(entry)
      }
    }

    const healthy = rotated.filter(
      (e) => e.cooldownUntil <= now && e.exhaustedUntil <= now
    )
    if (healthy.length > 0) {
      return healthy.map((e) => e.key)
    }

    // Fallback: if all non-disabled keys are in cooldown, sort by earliest expiry
    return rotated
      .sort(
        (a, b) =>
          Math.max(a.cooldownUntil, a.exhaustedUntil) -
          Math.max(b.cooldownUntil, b.exhaustedUntil)
      )
      .map((e) => e.key)
  }

  recordSuccess(key) {
    const entry = this.entries.find((e) => e.key === key)
    if (!entry) return
    entry.requestsServed += 1
    entry.lastUsedAt = new Date().toISOString()
    entry.cooldownUntil = 0
    entry.exhaustedUntil = 0
    entry.lastError = null
  }

  recordFailure(key, statusCode = 0, reason = '') {
    const entry = this.entries.find((e) => e.key === key)
    if (!entry) return
    const now = Date.now()
    entry.failures += 1
    entry.lastUsedAt = new Date().toISOString()
    entry.lastError = reason || (statusCode ? `HTTP ${statusCode}` : 'Error')

    if (statusCode === 401 || statusCode === 402 || statusCode === 403) {
      // Invalid or out-of-credits -> 30 minutes exhausted
      entry.exhaustedUntil = now + 30 * 60_000
      entry.cooldownUntil = 0
    } else if (statusCode === 429) {
      // Rate limit -> 90s cooldown on this key only
      entry.cooldownUntil = now + 90_000
    } else {
      entry.cooldownUntil = now + 90_000
    }
  }

  toggleKey(index, enabled) {
    this._ensureLoaded()
    const entry = this.entries[index]
    if (!entry) return null
    entry.disabled = enabled !== undefined ? !enabled : !entry.disabled
    if (!entry.disabled) {
      entry.cooldownUntil = 0
      entry.exhaustedUntil = 0
    }
    return this.getStats()[index]
  }

  purgeCooldowns() {
    let cleared = 0
    const now = Date.now()
    for (const entry of this.entries) {
      if (entry.cooldownUntil > now || entry.exhaustedUntil > now) {
        cleared += 1
      }
      entry.cooldownUntil = 0
      entry.exhaustedUntil = 0
    }
    return cleared
  }

  getStats() {
    this._ensureLoaded()
    const now = Date.now()
    return this.entries.map((e, index) => {
      const status = this._getEntryStatus(e, now)
      const until = Math.max(e.cooldownUntil, e.exhaustedUntil)
      const cooldownRemainingSec =
        status === 'cooldown' || status === 'exhausted'
          ? Math.max(0, Math.ceil((until - now) / 1000))
          : 0
      return {
        index,
        provider: this.providerName,
        maskedKey: e.maskedKey,
        source: e.source || 'env',
        status,
        requestsServed: e.requestsServed,
        failures: e.failures,
        cooldownRemainingSec,
        lastUsedAt: e.lastUsedAt,
        lastError: e.lastError,
      }
    })
  }

  async executeWithRoundRobin(taskFn) {
    const keys = this.acquireOrderedKeys()
    if (keys.length === 0) {
      throw new Error(`[RoundRobin:${this.providerName}] No active API keys configured.`)
    }

    let lastErr = null
    for (const key of keys) {
      try {
        const result = await taskFn(key)
        this.recordSuccess(key)
        return result
      } catch (err) {
        lastErr = err
        const status = err?.statusCode || err?.status || 0
        const isKeyFailure =
          status === 429 ||
          status === 401 ||
          status === 402 ||
          status === 403 ||
          /rate limit|quota|insufficient|credit|unauthorized|forbidden|429|401|402|403/i.test(
            err?.message || ''
          )
        this.recordFailure(key, status, err?.message)
        if (!isKeyFailure) {
          throw err
        }
      }
    }
    throw lastErr
  }
}

export const keyPools = {
  openrouter: new RoundRobinKeyPool('openrouter', {
    listEnvs: ['OPENROUTER_API_KEYS'],
    singleEnvs: ['OPENROUTER_API_KEY'],
    prefixes: ['OPENROUTER_API_KEY_'],
  }),
  groq: new RoundRobinKeyPool('groq', {
    listEnvs: ['GROQ_API_KEYS'],
    singleEnvs: ['GROQ_API_KEY'],
    prefixes: ['GROQ_API_KEY_'],
  }),
  gemini: new RoundRobinKeyPool('gemini', {
    listEnvs: ['GEMINI_API_KEYS'],
    singleEnvs: ['GEMINI_API_KEY'],
    prefixes: ['GEMINI_API_KEY_FALLBACK_', 'GEMINI_API_KEY_'],
  }),
  apify: new RoundRobinKeyPool('apify', {
    listEnvs: ['APIFY_API_KEYS', 'APIFY_API_TOKENS'],
    singleEnvs: ['APIFY_API_TOKEN', 'APIFY_API_KEY'],
    prefixes: ['APIFY_API_TOKEN_', 'APIFY_API_KEY_'],
  }),
}

export function getAllKeyPoolStats() {
  return {
    openrouter: keyPools.openrouter.getStats(),
    groq: keyPools.groq.getStats(),
    gemini: keyPools.gemini.getStats(),
    apify: keyPools.apify.getStats(),
  }
}

export function toggleProviderKey(provider, index, enabled) {
  const pool = keyPools[String(provider || '').toLowerCase()]
  if (!pool) return null
  return pool.toggleKey(Number(index), enabled)
}

export function purgeAllKeyCooldowns() {
  let total = 0
  for (const pool of Object.values(keyPools)) {
    total += pool.purgeCooldowns()
  }
  return total
}

export function applyDbApiKeys(apiKeys = {}) {
  for (const [provider, pool] of Object.entries(keyPools)) {
    const list = Array.isArray(apiKeys?.[provider]) ? apiKeys[provider] : []
    pool.setDbKeys(list)
  }
}

export async function syncDbApiKeys() {
  try {
    const { default: AppSettings } = await import('../../models/AppSettings.js')
    const doc = await AppSettings.findOne({ key: 'global' }).select('apiKeys').lean()
    if (doc?.apiKeys) {
      applyDbApiKeys(doc.apiKeys)
    }
  } catch {
    // Non-fatal if DB not yet connected
  }
}
