# Resume Agent V2.3 — Deterministic Signal Engine

The Deterministic Signal Engine runs **BEFORE** the Resume Expert LLM in the analysis pipeline:

```
Document
→ Parser
→ Canonical JSON
→ Deterministic Signal Engine
→ Compact Resume
→ Resume Expert LLM + Signals
→ Validator
→ Final Analysis
```

## Guiding Principles

1. **Deterministic & Reproducible**: Given the same canonical resume input, the engine generates the exact same signals.
2. **Observations, Not Conclusions**: Signals are evidence for the LLM to inspect, not final judgments.
3. **No Pejorative Terminology**: Gaps are termed `skillEvidenceGap`, never `fakeSkill` or `invalidSkill`.
4. **Recruiter Reasoning Authority**: The LLM independently decides whether a signal represents a meaningful resume issue.
5. **No Visual Hallucinations**: Parser quality warnings are marked conditional (`possible`, `suspected`, `warning`) to prevent the LLM from diagnosing parser artifacts as resume defects.

## Signal Modules

| Module | Description | Key Outputs |
| :--- | :--- | :--- |
| `skillEvidence.js` | Maps listed skills to verifiable evidence in experience/projects | `listed`, `evidenceFound`, `evidenceLocations`, `skillEvidenceGap` |
| `metricExtractor.js` | Extracts explicit quantitative tokens | `percentage`, `count`, `duration`, `time`, `currency`, `multiplier`, `range` |
| `duplicateDetector.js` | Measures semantic overlap between bullets | `pair`, `similarity`, `high_similarity` |
| `timelineAnalyzer.js` | Analyzes chronological dates and concurrent periods | `overlaps`, `items`, start/end dates |
| `sectionAnalyzer.js` | Structural fact reporting across resume sections | `characterCount`, `items`, `bullets`, `contact` |
| `parserQuality.js` | Flags possible document parsing artifacts | `possible_header_summary_merge`, `unusual_character_sequences` |
| `claimEvidence.js` | Maps claims to source bullets | `performance`, `scale`, `outcome`, `quantitative`, `technology` |
