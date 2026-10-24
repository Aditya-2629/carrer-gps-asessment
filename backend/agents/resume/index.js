/**
 * Resume Agent Module Exports — V3 Standardized Barrel
 */

import { ResumeAgent } from './resumeAgent.js'
export { ResumeAgent }
export { ResumeAgentPrompt, PROMPT_VERSION } from './resumeAgent.prompt.js'
export { ResumeNormalizer } from './resumeAgent.normalizer.js'
export { ResumeAgentValidator } from './resumeAgent.validator.js'
export { ResumeAgentTelemetry } from './resumeAgent.telemetry.js'
export { serializeResumeForLLM, INPUT_SERIALIZER_VERSION } from './resumeAgent.inputSerializer.js'
export * from './resumeAgent.schema.js'

// V3 deterministic facts, signals, and scoring exports
export { extractResumeFacts } from './facts/resumeFactExtractor.js'
export { normalizeFacts, buildFactIndex } from './facts/resumeFactNormalizer.js'
export { generateResumeSignals } from './signals/signalEngine.js'
export { computePrecomputedSignals } from './signals/precomputedSignals.js'
export { computeScorecard } from './scoring/resumeScorecard.js'
export { createResumeState } from './state/resumeState.js'
export * from './validation/index.js'

export default ResumeAgent
