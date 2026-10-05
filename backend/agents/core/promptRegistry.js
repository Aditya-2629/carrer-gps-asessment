/**
 * Prompt Registry — every prompt an agent uses is registered with an id +
 * version and content-hashed. Hashes land in telemetry and AgentRun rows, so
 * any historical output can be traced to the exact prompt text that produced
 * it (auditability) and prompt A/B tests compare by hash.
 */

import crypto from 'crypto'

const registry = new Map() // id -> { version, text, hash, registeredAt }

/**
 * Registers (or re-registers) a prompt. Idempotent per (id, version, text).
 * @param {string} id      - 'resume-synthesis', 'judge-quality', …
 * @param {string} version - 'resume-synthesis-v3.1'
 * @param {string} text    - the full prompt text
 */
export function registerPrompt(id, version, text) {
  if (!id || !version || !text) throw new Error('registerPrompt requires id, version, text')
  const hash = 'sha256:' + crypto.createHash('sha256').update(`${version}::${text}`).digest('hex').slice(0, 16)
  registry.set(id, { id, version, text, hash, registeredAt: new Date().toISOString() })
  return registry.get(id)
}

/** Returns { version, hash } for a registered prompt, or null. */
export function getPromptMeta(id) {
  const entry = registry.get(id)
  if (!entry) return null
  return { version: entry.version, hash: entry.hash }
}

/** Full entry (text included) — used by the test lab's prompt inspector. */
export function getPrompt(id) {
  return registry.get(id) || null
}

/** All registered prompts — for the admin/debug surface. */
export function listPrompts() {
  return Array.from(registry.values()).map(({ id, version, hash, registeredAt }) => ({ id, version, hash, registeredAt }))
}

export default { registerPrompt, getPromptMeta, getPrompt, listPrompts }
