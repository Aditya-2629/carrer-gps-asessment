/**
 * agents/core — shared Agent Kernel (Phase A of the platform blueprint).
 * Every agent (resume, linkedin, judge, …) builds on these primitives.
 */

export {
  defineAgent,
  AGENT_REGISTRY,
  RESUME_AGENT,
  LINKEDIN_AGENT,
  OVERALL_AGENT,
  makeEnvelope,
} from './agentContract.js'
export { runAgentLifecycle } from './BaseAgent.js'
export { generateStructured } from './structuredOutput.js'
export {
  registerPrompt,
  getPromptMeta,
  getPrompt,
  listPrompts,
} from './promptRegistry.js'
