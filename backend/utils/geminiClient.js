import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Collects and deduplicates all available Gemini API keys from environment variables.
 * Supports:
 * - GEMINI_API_KEYS (comma or semicolon separated list: "key1,key2,key3")
 * - GEMINI_API_KEY
 * - GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.
 * - GEMINI_API_KEY_FALLBACK, GEMINI_API_KEY_BACKUP
 */
export const getAllGeminiKeys = () => {
  const keys = []

  // 1. Check GEMINI_API_KEYS list
  if (process.env.GEMINI_API_KEYS) {
    const splitKeys = process.env.GEMINI_API_KEYS.split(/[,;]/).map((k) => k.trim())
    keys.push(...splitKeys)
  }

  // 2. Check primary GEMINI_API_KEY
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY.trim())
  }

  // 3. Check indexed or named fallback keys
  const fallbackEnvNames = [
    'GEMINI_API_KEY_1',
    'GEMINI_API_KEY_2',
    'GEMINI_API_KEY_3',
    'GEMINI_API_KEY_4',
    'GEMINI_API_KEY_5',
    'GEMINI_API_KEY_FALLBACK',
    'GEMINI_API_KEY_FALLBACK_1',
    'GEMINI_API_KEY_FALLBACK_2',
    'GEMINI_API_KEY_BACKUP',
  ]

  for (const envName of fallbackEnvNames) {
    if (process.env[envName] && process.env[envName].trim()) {
      keys.push(process.env[envName].trim())
    }
  }

  // Deduplicate and filter out empty strings
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)))
  return uniqueKeys
}

/**
 * Model priority chain with gemini-3.8-flash as primary
 */
export const DEFAULT_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
]
/**
 * Generates content using Google Generative AI with multi-key and multi-model fallback.
 *
 * @param {Object} options
 * @param {string|Array} options.contents - Prompt string or contents array
 * @param {string} [options.modelName='gemini-3.8-flash'] - Primary model to use
 * @param {Array<string>} [options.fallbackModels] - List of fallback models
 * @param {Object} [options.generationConfig] - Optional generation configuration
 * @returns {Promise<{ text: string, modelUsed: string, keyIndex: number, rawResponse: any }>}
 */
export const generateContentWithFallback = async ({
  contents,
  modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  fallbackModels = DEFAULT_MODELS,
  generationConfig = {},
}) => {
  const keys = getAllGeminiKeys()

  if (keys.length === 0) {
    throw new Error(
      'No GEMINI_API_KEY found in environment variables. Please configure GEMINI_API_KEY or GEMINI_API_KEYS.'
    )
  }

  // Build model try list starting with the requested modelName
  const modelsToTry = Array.from(new Set([modelName, ...fallbackModels].filter(Boolean)))

  const errors = []

  // Iterate through available API keys
  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const currentKey = keys[keyIdx]
    const maskedKey = `${currentKey.slice(0, 6)}...${currentKey.slice(-4)}`
    const genAI = new GoogleGenerativeAI(currentKey)

    // For the current key, try models in priority order
    for (const modelToUse of modelsToTry) {
      try {
        console.log(`[Gemini] Attempting generation with key #${keyIdx + 1} (${maskedKey}) using model: ${modelToUse}`)
        const model = genAI.getGenerativeModel({ model: modelToUse, generationConfig })
        const result = await model.generateContent(contents)
        const responseText = result.response.text()

        console.log(`[Gemini] Success with key #${keyIdx + 1} (${maskedKey}) on model: ${modelToUse}`)
        return {
          text: responseText,
          modelUsed: modelToUse,
          keyIndex: keyIdx,
          rawResponse: result,
        }
      } catch (err) {
        const errMsg = err.message || String(err)
        console.warn(
          `[Gemini] Failed with key #${keyIdx + 1} (${maskedKey}) on model "${modelToUse}": ${errMsg}`
        )
        errors.push(`[Key #${keyIdx + 1} / ${modelToUse}]: ${errMsg}`)

        // If error indicates API key exhaustion/quota or invalid key, break model loop and switch to next key
        const isKeyExhausted =
          errMsg.includes('quota') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('403')

        if (isKeyExhausted) {
          console.warn(`[Gemini] Key #${keyIdx + 1} appears exhausted/invalid. Moving to next API key...`)
          break // move to next key in outer loop
        }

        // Otherwise (e.g. 503 UNAVAILABLE, 404 NOT_FOUND, model not supported), continue to try fallback models
      }
    }
  }

  const detailedSummary = errors.join('\n')
  throw new Error(
    `All Gemini API keys and model fallbacks exhausted. Attempted ${keys.length} key(s) across models [${modelsToTry.join(', ')}].\nErrors:\n${detailedSummary}`
  )
}

/**
 * Generates embeddings with multi-key fallback
 */
export const embedContentWithFallback = async (text, modelName = 'text-embedding-004') => {
  if (!text || !text.trim()) return null

  const keys = getAllGeminiKeys()
  if (keys.length === 0) {
    console.warn('[Gemini Embedding] No GEMINI_API_KEY found.')
    return null
  }

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const currentKey = keys[keyIdx]
    const maskedKey = `${currentKey.slice(0, 6)}...${currentKey.slice(-4)}`
    try {
      const genAI = new GoogleGenerativeAI(currentKey)
      const embeddingModel = genAI.getGenerativeModel({ model: modelName })
      const result = await embeddingModel.embedContent(text.slice(0, 2000))

      if (result?.embedding?.values && result.embedding.values.length > 0) {
        return result.embedding.values
      }
    } catch (err) {
      console.warn(`[Gemini Embedding] Key #${keyIdx + 1} (${maskedKey}) error: ${err.message}`)
    }
  }

  console.error('[Gemini Embedding] All API keys failed for embedding generation.')
  return null
}
