/**
 * Mode A: Baseline Single Synthesis — Career GPS Resume Agent V3.1
 *
 * Preserves the existing architecture:
 * Single comprehensive LLM synthesis call receiving compact serialized resume,
 * target JD, sampled market profile, and deterministic precomputed signals.
 */

import { buildSynthesisMessages, SYNTHESIS_PROMPT_VERSION } from '../synthesis/resumeSynthesis.js'
import { ResumeAgentValidator } from '../resumeAgent.validator.js'
import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { resolveTaskPolicy } from './taskPolicy.js'

export const MODE_A_NAME = 'baseline_single_synthesis'

/**
 * Executes Mode A: Baseline Single Synthesis
 *
 * @param {Object} params
 * @param {Object} params.state - ResumeState instance
 * @param {Object} params.canonicalResume - Normalized canonical resume
 * @param {string} [params.targetRole]
 * @param {string} [params.targetJobDescription]
 * @param {Object} [params.taskPolicies]
 * @param {boolean} [params.isBenchmark=false]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function executeModeA({
  state,
  canonicalResume,
  taskPolicies = {},
  model = null,
  isBenchmark = false,
  signal = null,
}) {
  const effectivePolicies = model
    ? {
        ...taskPolicies,
        final_synthesis: {
          ...(typeof taskPolicies?.final_synthesis === 'object' ? taskPolicies.final_synthesis : {}),
          model,
        },
      }
    : taskPolicies
  const policy = resolveTaskPolicy('final_synthesis', effectivePolicies)
  const startTime = Date.now()
  const llmCalls = []

  let messages = buildSynthesisMessages(state)
  const promptVersion = SYNTHESIS_PROMPT_VERSION

  let gatewayResponse = null
  let validation = null
  let finishReason = 'stop'
  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const callStart = Date.now()
    gatewayResponse = await llmGateway.generate({
      purpose: 'resume_analysis',
      messages,
      model: policy.model,
      isBenchmark,
      responseFormat: 'json_object',
      temperature: policy.temperature ?? 0.2,
      maxTokens: policy.maxTokens ?? 8192,
      signal,
    })

    const callDuration = Date.now() - callStart
    llmCalls.push({
      task: 'final_synthesis',
      attempt,
      model: gatewayResponse.actualModel || policy.model,
      provider: gatewayResponse.provider || policy.provider,
      latencyMs: callDuration,
      inputTokens: gatewayResponse.tokens?.prompt || 0,
      outputTokens: gatewayResponse.tokens?.completion || 0,
      totalTokens: gatewayResponse.tokens?.total || 0,
    })

    finishReason = gatewayResponse.finishReason || 'stop'
    if (finishReason === 'length') break

    validation = ResumeAgentValidator.validate(gatewayResponse.text, canonicalResume)
    if (validation.isValid) break

    if (attempt < maxAttempts) {
      const problems = [...(validation.errors || []), ...(validation.evidenceErrors || [])].slice(0, 8)
      messages = [
        ...messages,
        {
          role: 'user',
          content: `Your previous JSON failed validation. Return the COMPLETE corrected JSON object only. Fix these problems and change nothing that was already valid:\n- ${problems.join('\n- ')}`,
        },
      ]
    }
  }

  const totalDuration = Date.now() - startTime
  const totalInputTokens = llmCalls.reduce((sum, c) => sum + c.inputTokens, 0)
  const totalOutputTokens = llmCalls.reduce((sum, c) => sum + c.outputTokens, 0)

  return {
    mode: MODE_A_NAME,
    success: Boolean(validation?.isValid && finishReason !== 'length'),
    analysis: validation?.sanitizedAnalysis || null,
    rawModelOutput: gatewayResponse?.text || '',
    validation,
    finishReason,
    llmCalls,
    metrics: {
      totalDurationMs: totalDuration,
      callCount: llmCalls.length,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: gatewayResponse?.actualModel || policy.model,
      provider: gatewayResponse?.provider || policy.provider,
      promptVersion,
    },
  }
}

export default {
  MODE_A_NAME,
  executeModeA,
}
