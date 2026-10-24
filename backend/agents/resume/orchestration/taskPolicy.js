/**
 * AI Task Policy Configuration — Career GPS Resume Agent V3.1
 *
 * Implements Section 7: Config-driven model routing for multi-agent and
 * benchmark orchestration without hardcoded provider/model strings.
 */

import { aiConfig } from '../../../ai/config/aiConfig.js'
import { getModel } from '../../../ai/config/modelRegistry.js'

/**
 * @typedef {'resume_audit' | 'jd_match' | 'market_gap' | 'evidence_validation' | 'final_synthesis'} AITaskType
 *
 * @typedef {Object} AITaskPolicy
 * @property {AITaskType} task
 * @property {string} provider
 * @property {string} model
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 */

/**
 * Default Task Policies for Resume Agent Orchestration
 */
export const DEFAULT_TASK_POLICIES = {
  // Mode A & General Primary Synthesis
  final_synthesis: {
    task: 'final_synthesis',
    provider: 'auto',
    model: aiConfig.defaultResumeModel || 'gemini-3.5-flash-lite',
    temperature: 0.2,
    maxTokens: 8192,
  },

  // Mode B: Agent 1 — Resume Auditor
  resume_audit: {
    task: 'resume_audit',
    provider: 'auto',
    model: aiConfig.defaultResumeModel || 'gemini-3.5-flash-lite',
    temperature: 0.1,
    maxTokens: 4096,
  },

  // Mode B: Agent 2 — Target JD Matcher
  jd_match: {
    task: 'jd_match',
    provider: 'auto',
    model: aiConfig.defaultResumeModel || 'gemini-3.5-flash-lite',
    temperature: 0.1,
    maxTokens: 3072,
  },

  // Mode B: Agent 3 — Market Gap Analyst
  market_gap: {
    task: 'market_gap',
    provider: 'auto',
    model: aiConfig.defaultResumeModel || 'gemini-3.5-flash-lite',
    temperature: 0.1,
    maxTokens: 3072,
  },

  // Mode B: Agent 4 — Evidence / Claim Validator
  evidence_validation: {
    task: 'evidence_validation',
    provider: 'auto',
    model: 'openai/gpt-oss-120b',
    temperature: 0.0,
    maxTokens: 3072,
  },
}

/**
 * Resolves effective policy for a given task, merging defaults with custom overrides.
 *
 * @param {AITaskType} task
 * @param {Object} [overrides]
 * @returns {AITaskPolicy}
 */
export function resolveTaskPolicy(task, overrides = {}) {
  const base = DEFAULT_TASK_POLICIES[task] || DEFAULT_TASK_POLICIES.final_synthesis
  const custom = overrides[task] || overrides

  const policy = {
    ...base,
    ...(custom.model ? { model: custom.model } : {}),
    ...(custom.provider ? { provider: custom.provider } : {}),
    ...(custom.temperature !== undefined ? { temperature: custom.temperature } : {}),
    ...(custom.maxTokens !== undefined ? { maxTokens: custom.maxTokens } : {}),
  }

  // Infer provider from model registry if not explicitly matching
  const modelMeta = getModel(policy.model)
  if (modelMeta && modelMeta.provider && (!custom.provider || custom.provider === 'auto')) {
    policy.provider = modelMeta.provider
  }

  return policy
}

export default {
  DEFAULT_TASK_POLICIES,
  resolveTaskPolicy,
}
