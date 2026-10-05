/**
 * BaseAgent — the shared lifecycle every agent runs through.
 *
 * Lifecycle: validateInput → prepare → execute → postProcess → envelope
 * with progress events emitted between stages (the orchestrator's SSE stream
 * and the admin analytics both consume these).
 *
 * Agents do NOT subclass this — they pass hooks. Less inheritance, more
 * explicit. The contract (agentContract.js) travels with the result envelope
 * so AgentRun rows and the scoreboard can always identify the producer.
 */

import { makeEnvelope } from './agentContract.js'

/**
 * @param {Object} params
 * @param {Object}   params.contract     - frozen manifest from defineAgent()
 * @param {Object}   params.params       - raw input (resume text/buffer, profile…)
 * @param {Object}   params.hooks
 * @param {Function} params.hooks.validateInput - (params) => normalized input; throw to abort
 * @param {Function} params.hooks.prepare       - (input) => anything execute() needs
 * @param {Function} params.hooks.execute       - (input, ctx) => result (may be async)
 * @param {Function} [params.hooks.postProcess] - (result, input) => final result
 * @param {Function} [params.onProgress] - (event: {stage, agent, message, at}) => void
 * @returns {Promise<Object>} standardized envelope (makeEnvelope shape)
 */
export async function runAgentLifecycle({ contract, params = {}, hooks, onProgress }) {
  const startedAt = Date.now()
  const emit = (stage, message) => {
    if (onProgress) {
      try {
        onProgress({ stage, agent: contract.id, agentName: contract.name, message, at: new Date().toISOString() })
      } catch (_e) {
        /* progress listeners must never break the pipeline */
      }
    }
  }

  try {
    emit('validate_input', `${contract.name}: validating input`)
    const input = hooks.validateInput ? hooks.validateInput(params) : params

    emit('prepare', `${contract.name}: preparing analysis context`)
    const prepared = hooks.prepare ? await hooks.prepare(input) : {}

    emit('execute', `${contract.name}: analyzing`)
    let result = await hooks.execute(input, prepared)

    if (hooks.postProcess) {
      emit('post_process', `${contract.name}: scoring and validating`)
      result = await hooks.postProcess(result, input)
    }

    const envelope = makeEnvelope(contract, { success: true, status: 'SUCCESS', result })
    envelope.telemetry.durationMs = Date.now() - startedAt
    emit('done', `${contract.name}: complete`)
    return envelope
  } catch (err) {
    const envelope = makeEnvelope(contract, {
      success: false,
      status: err.code || 'AGENT_FAILED',
      error: { message: err.message || 'Agent failed', code: err.code || null },
    })
    envelope.telemetry.durationMs = Date.now() - startedAt
    emit('error', `${contract.name}: ${err.message}`)
    return envelope
  }
}

export default { runAgentLifecycle }
