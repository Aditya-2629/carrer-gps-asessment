import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

/**
 * Collects and deduplicates all available Groq API keys from environment variables.
 * Supports:
 * - GROQ_API_KEYS (comma or semicolon separated list: "key1,key2,key3")
 * - GROQ_API_KEY (primary)
 * - GROQ_API_KEY_FALLBACK_1, GROQ_API_KEY_FALLBACK_2, etc.
 * - GROQ_API_KEY_1, GROQ_API_KEY_2, GROQ_API_KEY_3, etc.
 * - GROQ_API_KEY_FALLBACK, GROQ_API_KEY_BACKUP
 */
export const getAllGroqKeys = () => {
  const keys = []

  // 1. Check GROQ_API_KEYS list
  if (process.env.GROQ_API_KEYS) {
    const splitKeys = process.env.GROQ_API_KEYS.split(/[,;]/).map((k) => k.trim())
    keys.push(...splitKeys)
  }

  // 2. Check primary GROQ_API_KEY
  if (process.env.GROQ_API_KEY) {
    keys.push(process.env.GROQ_API_KEY.trim())
  }

  // 3. Check indexed or named fallback keys
  const fallbackEnvNames = [
    'GROQ_API_KEY_FALLBACK_1',
    'GROQ_API_KEY_FALLBACK_2',
    'GROQ_API_KEY_FALLBACK_3',
    'GROQ_API_KEY_FALLBACK_4',
    'GROQ_API_KEY_FALLBACK_5',
    'GROQ_API_KEY_1',
    'GROQ_API_KEY_2',
    'GROQ_API_KEY_3',
    'GROQ_API_KEY_4',
    'GROQ_API_KEY_5',
    'GROQ_API_KEY_FALLBACK',
    'GROQ_API_KEY_BACKUP',
  ]

  for (const envName of fallbackEnvNames) {
    if (process.env[envName] && process.env[envName].trim()) {
      keys.push(process.env[envName].trim())
    }
  }

  return Array.from(new Set(keys.filter(Boolean)))
}

/**
 * AI Gateway Configuration with dynamic environment resolution
 */
export const aiConfig = {
  get defaultProvider() {
    return process.env.RESUME_AGENT_PROVIDER || process.env.AI_RESUME_PROVIDER || 'gemini'
  },
  get fallbackEnabled() {
    return process.env.AI_RESUME_FALLBACK_ENABLED !== 'false'
  },
  get defaultResumeModel() {
    if (process.env.RESUME_PRIMARY_MODEL) return process.env.RESUME_PRIMARY_MODEL
    return 'gemini-3.5-flash-lite'
  },
  get defaultTimeoutMs() {
    return parseInt(process.env.AI_DEFAULT_TIMEOUT_MS || '20000', 10)
  },
  groq: {
    get baseUrl() {
      return process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
    },
    get apiKeys() {
      return getAllGroqKeys()
    },
    get apiKey() {
      const keys = getAllGroqKeys()
      return keys.length > 0 ? keys[0] : (process.env.GROQ_API_KEY || '').trim()
    },
    get primaryModel() {
      return process.env.GROQ_RESUME_MODEL_PRIMARY || 'openai/gpt-oss-120b'
    },
    get fallbackModel() {
      return process.env.GROQ_RESUME_MODEL_FALLBACK || 'openai/gpt-oss-20b'
    },
    get timeoutMs() {
      return parseInt(process.env.GROQ_TIMEOUT_MS || '60000', 10)
    },
  },
  openRouter: {
    get baseUrl() {
      return process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    },
    get apiKey() {
      return (process.env.OPENROUTER_API_KEY || '').trim()
    },
    get appUrl() {
      return process.env.APP_URL || 'https://crafture.com'
    },
    get appName() {
      return 'Crafture Career GPS - Resume Agent V1'
    },
    get timeoutMs() {
      return parseInt(process.env.OPENROUTER_TIMEOUT_MS || '60000', 10)
    },
  },
  grok: {
    get baseUrl() {
      return process.env.GROK_BASE_URL || 'https://api.x.ai/v1'
    },
    get apiKey() {
      return (process.env.GROK_API_KEY || '').trim()
    },
    get defaultModel() {
      return process.env.GROK_RESUME_MODEL || 'grok-beta'
    },
    get timeoutMs() {
      return parseInt(process.env.GROK_TIMEOUT_MS || '60000', 10)
    },
  },
  get totalDeadlineMs() {
    return parseInt(process.env.AI_TOTAL_DEADLINE_MS || '120000', 10)
  },
  gemini: {
    get defaultModel() {
      return process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
    },
    get perAttemptTimeoutMs() {
      return parseInt(process.env.GEMINI_PER_ATTEMPT_TIMEOUT_MS || '20000', 10)
    },
    get timeoutMs() {
      return parseInt(process.env.GEMINI_TIMEOUT_MS || '20000', 10)
    },
    get totalDeadlineMs() {
      return parseInt(process.env.GEMINI_TOTAL_DEADLINE_MS || process.env.AI_TOTAL_DEADLINE_MS || '60000', 10)
    },
  },
  nvidia: {
    get baseUrl() {
      return process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'
    },
    get apiKey() {
      return (process.env.NVIDIA_API_KEY || '').trim()
    },
    get defaultModel() {
      return process.env.NVIDIA_RESUME_MODEL || 'nvidia/nemotron-3-super-120b-a12b'
    },
    get timeoutMs() {
      return parseInt(process.env.NVIDIA_TIMEOUT_MS || '60000', 10)
    },
  },
}

export default aiConfig
