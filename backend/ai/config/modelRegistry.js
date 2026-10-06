/**
 * Model Registry
 * Centralizes model definitions, capabilities, and data-privacy constraints.
 * Do not hardcode model IDs across individual agent files.
 */

export const MODEL_REGISTRY = {
  // --- Groq Primary & Fallback Models for Resume Agent V1.2 ---
  'openai/gpt-oss-120b': {
    id: 'openai/gpt-oss-120b',
    displayName: 'Groq GPT-OSS 120B (Primary)',
    provider: 'groq',
    purpose: ['resume_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: true,
  },

  'openai/gpt-oss-20b': {
    id: 'openai/gpt-oss-20b',
    displayName: 'Groq GPT-OSS 20B (Fallback)',
    provider: 'groq',
    purpose: ['resume_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: true,
  },

  // --- OpenRouter Free Tier Candidates for Resume Agent V1 ---
  'google/gemma-4-26b-a4b-it:free': {
    id: 'google/gemma-4-26b-a4b-it:free',
    displayName: 'Google Gemma 4 26B A4B (Free)',
    provider: 'openrouter',
    purpose: ['resume_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: false,
    supportsReasoning: false,
    allowPersonalData: true,
    contextWindow: 8192,
    enabled: true,
  },

  'nvidia/nemotron-3-super-120b-a12b:free': {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    displayName: 'Nvidia Nemotron 3 Super 120B A12B (Free)',
    provider: 'openrouter',
    purpose: ['resume_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: false,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 8192,
    enabled: true,
  },

  'thinkingmachines/inkling-small:free': {
    id: 'thinkingmachines/inkling-small:free',
    displayName: 'Thinking Machines Inkling Small (Free)',
    provider: 'openrouter',
    purpose: ['resume_analysis'],
    supportsJsonObject: false,
    supportsJsonSchema: false,
    supportsReasoning: false,
    // CRITICAL: DO NOT use with real candidate resumes during V1 testing.
    // Allow it ONLY for synthetic/anonymized test data.
    allowPersonalData: false,
    contextWindow: 4096,
    enabled: true,
  },

  // --- Fallback / Secondary Providers (for future or explicit comparison) ---
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    displayName: 'Google Gemini 3.8 Flash (Latest)',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'gemini-3.7-flash': {
    id: 'gemini-3.7-flash',
    displayName: 'Google Gemini 3.7 Flash',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'gemini-3.6-flash': {
    id: 'gemini-3.6-flash',
    displayName: 'Google Gemini 3.6 Flash',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'grok-beta': {
    id: 'grok-beta',
    displayName: 'xAI Grok Beta',
    provider: 'grok',
    purpose: ['resume_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: false,
    supportsReasoning: false,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: true,
  },

  // --- NVIDIA NIM Models ---
  'nvidia/nemotron-3-super-120b-a12b': {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    displayName: 'NVIDIA Nemotron 3 Super 120B A12B',
    provider: 'nvidia',
    // Multi-provider resilience: serves Atlas when Gemini capacity/quota fails
    purpose: ['resume_analysis', 'assessment_report'],
    supportsJsonObject: true,
    supportsJsonSchema: false,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: true,
  },
}

/**
 * Retrieve model entry by ID
 */
export const getModel = (modelId) => {
  if (!modelId) return null
  return MODEL_REGISTRY[modelId] || null
}

/**
 * Check if a model is allowed to process the given data payload.
 * If data contains real personal data (not marked synthetic),
 * models with allowPersonalData: false will be rejected.
 */
export const isModelAllowedForData = (modelId, isSynthetic = false) => {
  const model = getModel(modelId)
  if (!model) return { allowed: false, reason: `Model "${modelId}" is not registered in MODEL_REGISTRY.` }
  if (!model.enabled) return { allowed: false, reason: `Model "${modelId}" is currently disabled.` }
  if (!isSynthetic && !model.allowPersonalData) {
    return {
      allowed: false,
      reason: `Model "${modelId}" does not permit real candidate personal data in V1. Use synthetic/anonymized data or select an approved model.`,
    }
  }
  return { allowed: true }
}

/**
 * List models enabled for a specific purpose
 */
export const listModelsForPurpose = (purpose = 'resume_analysis') => {
  return Object.values(MODEL_REGISTRY).filter((m) => m.enabled && m.purpose.includes(purpose))
}
