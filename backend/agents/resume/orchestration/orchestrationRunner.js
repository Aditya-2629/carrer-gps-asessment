/**
 * Orchestration Runner — Career GPS Resume Agent V3.1
 *
 * Coordinates execution across:
 * - Mode A: Baseline Single Synthesis (baseline_single_synthesis)
 * - Mode B: Specialized Parallel Agents (specialized_parallel_agents)
 * - Mode C: Hybrid Deterministic + Reasoning (hybrid_deterministic_reasoning)
 *
 * Implements Section 6: Strict no silent fallback during benchmarking.
 */

import { executeModeA, MODE_A_NAME } from './modeA_baseline.js'
import { executeModeB, MODE_B_NAME } from './modeB_parallel.js'
import { executeModeC, MODE_C_NAME } from './modeC_hybrid.js'

export const SUPPORTED_ORCHESTRATION_MODES = [
  MODE_A_NAME,
  MODE_B_NAME,
  MODE_C_NAME,
]

/**
 * Runs the Resume Agent evaluation using the specified orchestration mode.
 *
 * @param {Object} params
 * @param {'baseline_single_synthesis' | 'specialized_parallel_agents' | 'hybrid_deterministic_reasoning'} [params.mode='baseline_single_synthesis']
 * @param {Object} params.state - ResumeState instance
 * @param {Object} params.canonicalResume
 * @param {string} [params.targetRole]
 * @param {string} [params.targetJobDescription]
 * @param {Object} [params.taskPolicies]
 * @param {boolean} [params.isBenchmark=false]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function runOrchestratedSynthesis({
  mode = process.env.RESUME_AGENT_ORCHESTRATION_MODE || MODE_C_NAME,
  state,
  canonicalResume,
  targetRole = '',
  targetJobDescription = '',
  taskPolicies = {},
  model = null,
  isBenchmark = false,
  signal = null,
}) {
  const selectedMode = SUPPORTED_ORCHESTRATION_MODES.includes(mode)
    ? mode
    : (process.env.RESUME_AGENT_ORCHESTRATION_MODE || MODE_C_NAME)

  switch (selectedMode) {
    case MODE_B_NAME:
      return executeModeB({
        state,
        canonicalResume,
        targetRole,
        targetJobDescription,
        taskPolicies,
        model,
        isBenchmark,
        signal,
      })

    case MODE_C_NAME:
      return executeModeC({
        state,
        canonicalResume,
        targetRole,
        targetJobDescription,
        taskPolicies,
        model,
        isBenchmark,
        signal,
      })

    case MODE_A_NAME:
    default:
      return executeModeA({
        state,
        canonicalResume,
        targetRole,
        targetJobDescription,
        taskPolicies,
        model,
        isBenchmark,
        signal,
      })
  }
}

export default {
  SUPPORTED_ORCHESTRATION_MODES,
  runOrchestratedSynthesis,
  MODE_A_NAME,
  MODE_B_NAME,
  MODE_C_NAME,
}
