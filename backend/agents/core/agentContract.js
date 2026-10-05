/**
 * Agent Contract — the per-agent manifest every agent must declare.
 *
 * An agent = contract + kernel + model routing + evals + surface.
 * The contract is the machine-readable deal between the agent, the
 * orchestrator, and the admin analytics: who it is, which model it talks to,
 * how it may retry, and what its output envelope looks like.
 *
 * Best practice (Anthropic, Building Effective Agents): keep agents simple and
 * predictable — fixed pipelines with explicit contracts beat autonomous loops
 * for our use case.
 */

/**
 * @param {Object} def
 * @param {string} def.id            - kebab-case id ('resume', 'linkedin')
 * @param {string} def.name          - display name ('Resume Agent')
 * @param {string} def.version       - semver-ish ('1.0.0')
 * @param {string} def.purpose       - model registry purpose ('resume_analysis')
 * @param {string} [def.persona]     - short persona label for UI surfaces
 * @param {Object} [def.retryPolicy] - { maxAttempts, budgetUsd }
 * @param {boolean} [def.usesLlm]    - false for pure-deterministic agents
 */
export function defineAgent(def) {
  const required = ['id', 'name', 'version', 'purpose']
  for (const key of required) {
    if (!def[key]) throw new Error(`Agent contract missing required field: ${key}`)
  }
  if (!/^[a-z][a-z0-9-]*$/.test(def.id)) {
    throw new Error(`Agent id must be kebab-case, got "${def.id}"`)
  }

  return Object.freeze({
    usesLlm: true,
    retryPolicy: { maxAttempts: 2, budgetUsd: 0.05 },
    persona: def.name,
    ...def,
  })
}

// ─── Registered agent contracts ──────────────────────────────────────────────

export const RESUME_AGENT = defineAgent({
  id: 'resume',
  name: 'Resume Agent',
  version: '3.1.0',
  purpose: 'resume_analysis',
  persona: 'Maya — 15-year US resume writer',
  retryPolicy: { maxAttempts: 2, budgetUsd: 0.05 },
})

export const LINKEDIN_AGENT = defineAgent({
  id: 'linkedin',
  name: 'LinkedIn Agent',
  version: '1.0.0',
  purpose: 'resume_analysis', // deterministic today; LLM synthesis may reuse this purpose later
  persona: 'US recruiter visibility specialist',
  usesLlm: false,
})

export const OVERALL_AGENT = defineAgent({
  id: 'overall',
  name: 'Overall Report Agent',
  version: '1.0.0',
  purpose: 'assessment_report',
  persona: 'Atlas — executive career strategist',
  retryPolicy: { maxAttempts: 2, budgetUsd: 0.08 },
})

/** All contracts the orchestrator may dispatch. */
export const AGENT_REGISTRY = { resume: RESUME_AGENT, linkedin: LINKEDIN_AGENT, overall: OVERALL_AGENT }

/**
 * Standardized result envelope every agent run returns — the orchestrator and
 * the AgentRun store depend on this shape.
 */
export function makeEnvelope(contract, { success, status = 'SUCCESS', result = null, error = null, telemetry = {} }) {
  return {
    success,
    status,
    agent: contract.id,
    agentName: contract.name,
    agentVersion: contract.version,
    result,
    error,
    telemetry: {
      durationMs: 0,
      attempts: 1,
      cached: false,
      ...telemetry,
    },
  }
}

export default { defineAgent, AGENT_REGISTRY, makeEnvelope, RESUME_AGENT, LINKEDIN_AGENT, OVERALL_AGENT }
