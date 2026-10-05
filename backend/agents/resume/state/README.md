# Resume State — V3

## Purpose

`resumeState.js` implements the **shared typed container** that flows through the Career GPS Resume Agent V3 pipeline.

It is inspired by the _typed shared state_ pattern used in graph-based multi-agent systems, adapted deterministically for a single-LLM pipeline without requiring LangGraph or similar frameworks.

---

## Layer Architecture

| # | Layer | Module | When Set |
|---|-------|--------|----------|
| 0 | Source metadata | `createResumeState()` | Pipeline entry |
| 1 | Canonical Resume | `setCanonicalResume()` | After Parser/Normalizer |
| 2 | Compact Resume | `state.compactResume` | After input serializer |
| 3 | Resume Facts | `setResumeFacts()` | After FactExtractor |
| 4 | Signals | `setSignals()` | After Signal Engine |
| 5 | Analyser Observations | `setAnalyzerObservations()` | After each Analyser |
| 6 | Synthesis | `setSynthesisOutput()` | After LLM call |
| 7 | Validation | `setValidation()` | After Validator |
| 8 | Metadata | `setMetadata()` | After gateway response |

---

## Key Design Rules

1. **`canonicalResume` is immutable**: `setCanonicalResume()` deep-freezes it. Any attempt to mutate after setting will throw or be silently rejected.

2. **Facts ≠ Signals ≠ Interpretation**: Each layer has strict read boundaries. The Signal Engine reads `canonicalResume`. Analysers read `facts` + `signals`. Synthesis reads `analyzerObservations` + `signals` + `compactResume`.

3. **Single LLM Call**: Only the Synthesis stage makes an LLM call. All analysers are deterministic code.

4. **Future Orchestrator Compatible**: The state shape exposes `resumeAnalysis` as a sub-field suitable for embedding in a future `CandidateState` that also holds `linkedinAnalysis`, `assessmentAnalysis`, etc.

---

## Future `CandidateState` Integration

```js
// Future (not yet implemented):
const candidateState = {
  candidateId: '...',
  resumeAnalysis: resumeState,        // ← today's state
  linkedinAnalysis: null,             // ← future agent
  assessmentAnalysis: null,           // ← existing assessment system
  jobSearchAnalysis: null,            // ← future
  careerReport: null,                 // ← future synthesis
}
```

The current `resumeState` is independently usable and will slot in without changes.
