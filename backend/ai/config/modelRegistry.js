/**
 * Model Registry
 * Centralizes model definitions, capabilities, and data-privacy constraints.
 * Do not hardcode model IDs across individual agent files.
 */

export const MODEL_REGISTRY = {
  // --- Groq Primary & Consolidated Model for Career GPS ---
  'openai/gpt-oss-120b': {
    id: 'openai/gpt-oss-120b',
    displayName: 'Groq GPT-OSS 120B (Consolidated Groq Engine)',
    provider: 'groq',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'resume-parsing', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    supportsSystemRole: true,
    maxOutputTokens: 4096,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: true,
  },

  'openai/gpt-oss-20b': {
    id: 'openai/gpt-oss-20b',
    displayName: 'Groq GPT-OSS 20B (Decommissioned)',
    provider: 'groq',
    purpose: ['resume_analysis', 'linkedin_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: false,
  },

  'llama-3.1-70b-versatile': {
    id: 'llama-3.1-70b-versatile',
    displayName: 'Groq Llama 3.1 70B Versatile (Decommissioned)',
    provider: 'groq',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'resume-parsing', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: false,
  },

  'llama3-70b-8192': {
    id: 'llama3-70b-8192',
    displayName: 'Groq Llama 3 70B 8192 (Decommissioned)',
    provider: 'groq',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'resume-parsing', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 8192,
    enabled: false,
  },

  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    displayName: 'Groq Llama 3.3 70B Versatile (Decommissioned)',
    provider: 'groq',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'resume-parsing', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: false,
  },

  // --- OpenRouter Paid Priority Tier ---
  'google/gemini-2.5-flash-lite': {
    id: 'google/gemini-2.5-flash-lite',
    displayName: 'Google Gemini 2.5 Flash Lite (OpenRouter Paid Primary)',
    provider: 'openrouter',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'meta-llama/llama-3.3-70b-instruct': {
    id: 'meta-llama/llama-3.3-70b-instruct',
    displayName: 'Meta Llama 3.3 70B Instruct (OpenRouter)',
    provider: 'openrouter',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 131072,
    enabled: true,
  },

  'google/gemini-3.5-flash-lite': {
    id: 'google/gemini-3.5-flash-lite',
    displayName: 'Google Gemini 3.5 Flash Lite (OpenRouter Paid Primary)',
    provider: 'openrouter',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'deepseek/deepseek-chat': {
    id: 'deepseek/deepseek-chat',
    displayName: 'DeepSeek V3 (OpenRouter Paid Failover)',
    provider: 'openrouter',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 65536,
    enabled: true,
  },

  'google/gemini-3.5-flash': {
    id: 'google/gemini-3.5-flash',
    displayName: 'Google Gemini 3.5 Flash (OpenRouter Paid)',
    provider: 'openrouter',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'google/gemini-2.5-flash': {
    id: 'google/gemini-2.5-flash',
    displayName: 'Google Gemini 2.5 Flash (OpenRouter)',
    provider: 'openrouter',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'linkedin_analysis', 'market_jd_analysis', 'bullet_batch_weave'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'google/gemini-3-flash-preview': {
    id: 'google/gemini-3-flash-preview',
    displayName: 'Google Gemini 3 Flash Preview (OpenRouter)',
    provider: 'openrouter',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'linkedin_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'google/gemini-3.1-pro-preview': {
    id: 'google/gemini-3.1-pro-preview',
    displayName: 'Google Gemini 3.1 Pro Preview (OpenRouter)',
    provider: 'openrouter',
    purpose: ['resume_analysis', 'assessment_report', 'career_chatbot', 'linkedin_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 2097152,
    enabled: true,
  },

  // --- OpenRouter Free Tier Candidates for Resume Agent V1 (Discontinued 404 models disabled) ---
  'google/gemma-4-26b-a4b-it:free': {
    id: 'google/gemma-4-26b-a4b-it:free',
    displayName: 'Google Gemma 4 26B A4B (Free - Discontinued)',
    provider: 'openrouter',
    purpose: ['resume_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: false,
    supportsReasoning: false,
    allowPersonalData: true,
    contextWindow: 8192,
    enabled: false,
  },

  'nvidia/nemotron-3-super-120b-a12b:free': {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    displayName: 'Nvidia Nemotron 3 Super 120B A12B (Free - Discontinued)',
    provider: 'openrouter',
    purpose: ['resume_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: false,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 8192,
    enabled: false,
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
    displayName: 'Google Gemini 3.8 Flash',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report', 'linkedin_analysis'],
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
    purpose: ['resume_analysis', 'assessment_report', 'linkedin_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    displayName: 'Google Gemini 3.5 Flash',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    displayName: 'Google Gemini 3.5 Flash Lite',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report', 'linkedin_analysis', 'market_jd_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Google Gemini 3.1 Pro (Preview)',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 2097152,
    enabled: true,
  },

  'gemini-3.1-pro': {
    id: 'gemini-3.1-pro',
    displayName: 'Google Gemini 3.1 Pro',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 2097152,
    enabled: true,
  },

  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    displayName: 'Google Gemini 2.5 Flash Lite',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report', 'linkedin_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: true,
  },

  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    displayName: 'Google Gemini 2.5 Flash (Discontinued)',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report', 'linkedin_analysis'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: true,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: false,
  },

  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    displayName: 'Google Gemini 1.5 Flash (Discontinued)',
    provider: 'gemini',
    purpose: ['resume_analysis', 'assessment_report'],
    supportsJsonObject: true,
    supportsJsonSchema: true,
    supportsReasoning: false,
    allowPersonalData: true,
    contextWindow: 1048576,
    enabled: false,
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
    purpose: ['resume_analysis', 'assessment_report', 'linkedin_analysis'],
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
  if (modelId === 'openrouter') return MODEL_REGISTRY['google/gemini-2.5-flash-lite'] || MODEL_REGISTRY['google/gemini-3.5-flash-lite'] || MODEL_REGISTRY['google/gemini-3.5-flash']
  if (modelId === 'groq') return MODEL_REGISTRY['openai/gpt-oss-120b']
  if (modelId === 'gemini') return MODEL_REGISTRY['gemini-2.5-flash-lite'] || MODEL_REGISTRY['gemini-3.5-flash-lite']
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
  const normalizedPurpose = purpose === 'resume-parsing' ? 'resume_analysis' : purpose
  return Object.values(MODEL_REGISTRY).filter((m) => m.enabled && (m.purpose.includes(purpose) || m.purpose.includes(normalizedPurpose)))
}
