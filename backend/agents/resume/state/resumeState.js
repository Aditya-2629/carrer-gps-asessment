/**
 * Resume Agent V3 — Shared Resume State
 *
 * Typed container that flows through the pipeline:
 *   Parser → Canonical Resume → Facts → Signals → Analyzers → Synthesis → Validation
 *
 * DESIGN PRINCIPLES
 * - canonicalResume is the immutable source of truth. Never mutate it after creation.
 * - Each pipeline stage appends its own field (facts, signals, analysis, etc.)
 * - State is serialisable JSON — no circular references, no class instances.
 * - Downstream consumers must read only their declared input layers.
 */

export const STATE_VERSION = '3.0'

/**
 * Creates a fresh, empty Resume State container.
 *
 * @param {Object} opts
 * @param {string} [opts.documentId]   - Unique identifier for the source document
 * @param {string} [opts.parserVersion]
 * @returns {ResumeState}
 */
export function createResumeState({ documentId = null, parserVersion = null } = {}) {
  return {
    stateVersion: STATE_VERSION,

    // ── Layer 0: Source metadata ──────────────────────────────────────────────
    source: {
      documentId: documentId || `doc_${Date.now()}`,
      parserVersion: parserVersion || 'unknown',
      createdAt: new Date().toISOString(),
    },

    // ── Layer 1: Canonical Resume (immutable after set) ───────────────────────
    canonicalResume: null,

    // ── Layer 2: Compact Serialised Text (for LLM) ───────────────────────────
    compactResume: null,

    // ── Layer 3: Structured Resume Facts (deterministic extraction) ───────────
    resumeFacts: null,

    // ── Layer 4: Deterministic Signals (V2.3 engine output) ──────────────────
    signals: null,

    // ── Layer 4.5: Precomputed Signals (V2.5 Phase 1) ────────────────────────
    precomputedSignals: null,

    // ── Layer 4.8: Market Context (V3 Market Intelligence) ───────────────────
    marketContext: null,

    // ── Layer 5: Analyser Observations (deterministic code analysers) ─────────
    analyzerObservations: {
      positioning: null,
      content: null,
      impact: null,
      technical: null,
      structure: null,
      evidence: null,
    },

    // ── Layer 6: Synthesis (single LLM call result) ───────────────────────────
    analysis: {
      candidateSnapshot: null,
      overallReview: null,
      strengths: [],
      issues: [],
      priorityActions: [],
      analysisVersion: '2.2',
      dashboard: null,
    },

    // ── Layer 7: Validation Results ───────────────────────────────────────────
    validation: {
      schemaValid: null,
      evidenceValid: null,
      unsupportedClaims: [],
      unsupportedAssumptions: [],
      fabricatedMetrics: [],
      hallucinations: [],
      errors: [],
      warnings: [],
    },

    // ── Layer 8: Run Metadata ─────────────────────────────────────────────────
    metadata: {
      targetRole: null,
      model: null,
      provider: null,
      promptVersion: null,
      inputMode: null,
      canonicalInputHash: null,
      llmInputHash: null,
      canonicalInputCharacters: 0,
      compactInputCharacters: 0,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      finishReason: null,
      requestId: null,
      isBenchmark: false,
    },
  }
}

/**
 * Attaches canonical resume to state. Freezes it to prevent accidental mutation.
 *
 * @param {ResumeState} state
 * @param {Object} canonicalResume
 * @returns {ResumeState}
 */
export function setCanonicalResume(state, canonicalResume) {
  if (state.canonicalResume !== null) {
    console.warn('[ResumeState] canonicalResume is already set. Refusing mutation.')
    return state
  }
  // Deep-freeze to prevent downstream mutation
  state.canonicalResume = deepFreeze(canonicalResume)
  return state
}

/**
 * Attaches resume facts to state.
 *
 * @param {ResumeState} state
 * @param {Object} resumeFacts
 * @returns {ResumeState}
 */
export function setResumeFacts(state, resumeFacts) {
  state.resumeFacts = resumeFacts
  return state
}

/**
 * Attaches deterministic signals to state.
 *
 * @param {ResumeState} state
 * @param {Object} signals
 * @returns {ResumeState}
 */
export function setSignals(state, signals) {
  state.signals = signals
  return state
}

/**
 * Attaches pre-computed deterministic signals (V2.5 Phase 1) to state.
 *
 * @param {ResumeState} state
 * @param {Object} precomputedSignals
 * @returns {ResumeState}
 */
export function setPrecomputedSignals(state, precomputedSignals) {
  state.precomputedSignals = precomputedSignals
  return state
}

/**
 * Attaches market intelligence context (V3 Market Intelligence) to state.
 *
 * @param {ResumeState} state
 * @param {Object} marketContext
 * @returns {ResumeState}
 */
export function setMarketContext(state, marketContext) {
  state.marketContext = marketContext
  return state
}

/**
 * Attaches a specific analyser's observations to state.
 *
 * @param {ResumeState} state
 * @param {'positioning'|'content'|'impact'|'technical'|'structure'|'evidence'} analyzerName
 * @param {Object} observations
 * @returns {ResumeState}
 */
export function setAnalyzerObservations(state, analyzerName, observations) {
  if (!Object.prototype.hasOwnProperty.call(state.analyzerObservations, analyzerName)) {
    console.warn(`[ResumeState] Unknown analyzer: ${analyzerName}`)
    return state
  }
  state.analyzerObservations[analyzerName] = observations
  return state
}

/**
 * Attaches final synthesis output to state.analysis.
 *
 * @param {ResumeState} state
 * @param {Object} synthesisOutput
 * @returns {ResumeState}
 */
export function setSynthesisOutput(state, synthesisOutput) {
  if (synthesisOutput && typeof synthesisOutput === 'object') {
    state.analysis = {
      ...state.analysis,
      ...synthesisOutput,
    }
  }
  return state
}

/**
 * Attaches validation results to state.
 *
 * @param {ResumeState} state
 * @param {Object} validationResult
 * @returns {ResumeState}
 */
export function setValidation(state, validationResult) {
  state.validation = {
    ...state.validation,
    ...validationResult,
  }
  return state
}

/**
 * Attaches LLM/gateway metadata to state.
 *
 * @param {ResumeState} state
 * @param {Object} meta
 * @returns {ResumeState}
 */
export function setMetadata(state, meta) {
  state.metadata = {
    ...state.metadata,
    ...meta,
  }
  return state
}

/**
 * Extracts the public API-compatible analysis result from state.
 * Preserves the existing frontend contract (analysisVersion: "2.2").
 *
 * @param {ResumeState} state
 * @returns {Object}
 */
export function extractFinalAnalysis(state) {
  return {
    ...state.analysis,
    metadata: {
      provider: state.metadata.provider,
      model: state.metadata.model,
      latencyMs: state.metadata.latencyMs,
      requestId: state.metadata.requestId,
      inputTokens: state.metadata.inputTokens,
      outputTokens: state.metadata.outputTokens,
      finishReason: state.metadata.finishReason,
      inputMode: state.metadata.inputMode,
    },
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Deep-freezes an object to prevent mutation. Handles circular references gracefully.
 * @param {*} obj
 * @returns {*}
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj
  Object.freeze(obj)
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key])
  }
  return obj
}

export default {
  STATE_VERSION,
  createResumeState,
  setCanonicalResume,
  setResumeFacts,
  setSignals,
  setPrecomputedSignals,
  setMarketContext,
  setAnalyzerObservations,
  setSynthesisOutput,
  setValidation,
  setMetadata,
  extractFinalAnalysis,
}
