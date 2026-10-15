/**
 * Gemini Dynamic Model Discovery & Verification Service
 * 
 * Implements:
 * 1. Configurable allowlist of verified, active Gemini models.
 * 2. Official Gemini Models API discovery filtering for `generateContent` support.
 * 3. Bounded-period in-memory caching to avoid calling discovery on every user request.
 * 4. Permanent failure tracking for HTTP 404 / unsupported models.
 * 5. Safe, sanitized logging with zero exposure of API keys or secrets.
 */

import { ProviderError, PROVIDER_ERROR_CODES } from './providerErrors.js'

// Canonical verified allowlist defaults — flash models verified across production keys
const DEFAULT_ALLOWLIST = [
  'gemini-3.8-flash',
  'gemini-3.8',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
]

// Track models that have returned HTTP 404 / unsupported to permanently skip further attempts
const permanentModelFailureSet = new Set()

// Bounded cache: apiKeyHash -> { timestamp, verifiedModels, rawSupportedModels }
const discoveryCache = new Map()
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Returns the configured allowlist of verified Gemini models.
 */
export function getVerifiedGeminiAllowlist() {
  const envAllowlist = process.env.GEMINI_VERIFIED_MODELS
  if (envAllowlist && envAllowlist.trim()) {
    return envAllowlist
      .split(',')
      .map((m) => m.trim())
      .filter((m) => Boolean(m) && !permanentModelFailureSet.has(m))
  }
  return DEFAULT_ALLOWLIST.filter((m) => !permanentModelFailureSet.has(m))
}

/**
 * Marks a model as permanently unavailable (e.g. HTTP 404 not found).
 * Once marked, the model will be immediately skipped without further retries.
 */
export function markModelPermanentlyUnavailable(modelId) {
  if (!modelId) return
  permanentModelFailureSet.add(modelId)
  console.warn(`[Gemini Discovery] Model "${modelId}" marked permanently unavailable (HTTP 404/unsupported).`)
}

export function isModelPermanentlyUnavailable(modelId) {
  return permanentModelFailureSet.has(modelId)
}

export function clearPermanentModelFailures() {
  permanentModelFailureSet.clear()
}

export function clearModelDiscoveryCache() {
  discoveryCache.clear()
}

/**
 * Hashes an API key simply for in-memory cache lookup without exposing key values.
 */
function hashKey(key) {
  if (!key) return 'anon'
  return `key_${key.slice(-6)}_${key.length}`
}

/**
 * Discovers available models for a given API key via the official Gemini Models API,
 * filters for `generateContent` support, intersects with the allowlist, and caches for TTL.
 * 
 * @param {string} apiKey - Gemini API Key
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @param {number} [options.ttlMs=3600000]
 * @param {number} [options.timeoutMs=6000]
 * @returns {Promise<string[]>} List of verified model IDs
 */
export async function discoverVerifiedGeminiModels(
  apiKey,
  {
    forceRefresh = false,
    ttlMs = DEFAULT_CACHE_TTL_MS,
    timeoutMs = 6000,
  } = {}
) {
  const allowlist = getVerifiedGeminiAllowlist()
  if (!apiKey) return allowlist

  const cacheKey = hashKey(apiKey)
  const now = Date.now()
  const cached = discoveryCache.get(cacheKey)

  if (!forceRefresh && cached && now - cached.timestamp < ttlMs) {
    // Return cached verified models, excluding any newly marked 404 models
    return cached.verifiedModels.filter((m) => !permanentModelFailureSet.has(m))
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      // If listing models fails (e.g. 403, 400), fall back to allowlist without throwing
      console.warn(`[Gemini Discovery] Models API returned HTTP ${res.status}. Falling back to verified allowlist.`)
      return allowlist
    }

    const data = await res.json()
    const modelsList = data.models || []

    // Filter models supporting generateContent
    const contentModels = new Set(
      modelsList
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => (m.name || '').replace(/^models\//, ''))
        .filter(Boolean)
    )

    // Intersect available content models with the verified allowlist
    const verifiedModels = allowlist.filter((candidate) => contentModels.has(candidate))

    // Fall back to allowlist if intersection is empty to prevent complete stoppage
    const finalModels = verifiedModels.length > 0 ? verifiedModels : allowlist

    discoveryCache.set(cacheKey, {
      timestamp: now,
      verifiedModels: finalModels,
      allSupportedModels: Array.from(contentModels),
    })

    return finalModels
  } catch (err) {
    // Graceful degradation: never break request on discovery failure; return allowlist
    const isAbort = err.name === 'AbortError' || err.code === 'ABORT_ERR'
    console.warn(`[Gemini Discovery] Discovery fetch ${isAbort ? 'timed out' : 'failed'}. Using verified allowlist.`)
    return allowlist
  }
}
