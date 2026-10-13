# Resume Agent V3.1: AI Orchestration Audit

## 1. Executive Summary

This document provides a comprehensive audit of the AI orchestration, LLM call sites, deterministic pre-processing stages, validation loops, and telemetry pipelines in the Career GPS Resume Agent V3.

The audit identifies:
1. The exact end-to-end execution path from resume upload to persisted report response.
2. Every existing AI/LLM call site and its operational characteristics (provider, model, prompt, input/output size, retry policy, validation, caching).
3. The potential to run specialized reasoning tasks in parallel vs. preserving a single synthesis call vs. a hybrid deterministic architecture.
4. Existing infrastructural components: AI Gateway, telemetry, cache, validators, market services, orchestrator, report schemas, and legacy assessment boundaries.

---

## 2. End-to-End Resume Agent Execution Path

The execution flow of the current Resume Agent V3 is organized into a sequential pipeline:

```text
1. Resume Upload / Ingestion
   └─ User uploads PDF/DOCX buffer or raw text string
   └─ Parameters: buffer, mimeType, filename, resumeText, targetRole, targetJobDescription, experienceLevel
   └─ Endpoint: POST /api/resume-agent/evaluate or internal Orchestrator runCareerAgents

2. Document Parsing (Deterministic, Zero AI)
   └─ File: backend/services/documentParser/index.js (DocumentParser.parse)
   └─ Extracts raw text, sections, metadata, pageCount, clean markdown

3. Canonical Resume Normalization (Deterministic, Zero AI)
   └─ File: backend/agents/resume/resumeAgent.normalizer.js (ResumeNormalizer.normalize)
   └─ Assigns stable deterministic identifiers:
      • summary_001
      • exp_001_b01, exp_001_b02...
      • proj_001_b01...
      • skills_001, edu_001
   └─ Computes canonical JSON structure and canonicalInputHash

4. Compact Serialization (Deterministic, Zero AI)
   └─ File: backend/agents/resume/resumeAgent.inputSerializer.js (serializeResumeForLLM)
   └─ Reduces token overhead by 60–70% compared to canonical JSON
   └─ Outputs compact text formatted with stable IDs

5. Fact Extraction & Normalization (Deterministic, Zero AI)
   └─ File: backend/agents/resume/facts/resumeFactExtractor.js & resumeFactNormalizer.js
   └─ Extracts facts: candidate identity, quantified metrics, technology references, action verbs, dates

6. Precomputed Signals & Heuristic Engines (Deterministic, Zero AI)
   └─ File: backend/agents/resume/signals/signalEngine.js & precomputedSignals.js
   └─ Computes:
      • bulletSignals (hasQuantifier, technologyCount, isToolDumpCandidate, hasOutcomeVerb)
      • contactMerge (emailDetected, phoneDetected, urlDetected, isContactMerged)
      • quantificationRollup (totalBullets, quantifiedBullets, density)

7. Deterministic Category Analyzers (Deterministic, Zero AI)
   └─ Files: backend/agents/resume/analyzers/
      • positioningAnalyzer.js
      • contentAnalyzer.js
      • impactAnalyzer.js
      • technicalAnalyzer.js
      • structureAnalyzer.js
      • evidenceAnalyzer.js (Evidence Gatekeeper: grounds observations against source text)

8. Evidence Classification & Market Signals (Deterministic, Zero AI)
   └─ Files: backend/agents/resume/classification/index.js, domainClassifier.js, usMarketSignals.js
   └─ Classifies evidence strength (verified, weak, unverified), domain (IT vs. non-IT), and US-market compliance

9. Market Intelligence Layer (Deterministic Aggregation + Scraper Background Worker)
   └─ Files: backend/agents/resume/market/
      • marketBucketResolver.js: Resolves canonical bucket (e.g. software-engineer::6-8)
      • marketJdRetriever.js: Looks up active 5 JDs from JobMarketBucket/JobMarketVersion; enqueues background refresh if deficient
      • jdNormalizer.js: Clean text stripping, fingerprint deduplication, quality filter
      • marketProfileBuilder.js: Aggregates top skills, responsibilities, and seniority signals deterministically
      • marketEvidence.js: Evaluates Target JD priority and market evidence gaps

10. LLM Synthesis Message Construction
    └─ File: backend/agents/resume/synthesis/resumeSynthesis.js (buildSynthesisMessages)
    └─ Combines:
       • System Prompt: SYNTHESIS_SYSTEM_PROMPT (recruiter persona, rules, schema, categories)
       • User Prompt: Serialized resume, target JD, sampled market profile, precomputed signals

11. Primary LLM Synthesis Call (AI / LLM)
    └─ File: backend/agents/resume/resumeAgent.js (lines 359–372) via llmGateway.generate
    └─ Calls LLMGateway with purpose 'resume_analysis'
    └─ Formats output as JSON object

12. Multi-Stage Validation Pipeline (Deterministic, Zero AI)
    └─ Files:
       • resumeAgent.validator.js: Schema check, JSON parsing, verbatim evidence match, metric/tool hallucination checks
       • rewriteValidator.js: Checks that correctedText does not fabricate new facts or escalate claims
       • assumptionValidator.js: Flags unsupported assumptions ("student project", "basic CRUD")
       • claimValidator.js: Detects ungrounded metrics and non-existent integrations
       • recommendationValidator.js: Detects duplication between issues and recommendations
       • resolveEvidenceConsistency: Resolves contradictions between strengths and issues
    └─ If schema/evidence validation fails: Bounded retry loop (up to maxSynthesisAttempts = 2) with repair instruction

13. Deterministic Scorecard Engine (Deterministic, Zero AI)
    └─ File: backend/agents/resume/scoring/resumeScorecard.js (computeScorecard)
    └─ Computes deterministic 0–100 score, letter grade (A/B/C/D/F), and pass/fail audit checks

14. Report Assembly & Persistence
    └─ File: backend/agents/orchestrator.js (runCareerAgents)
    └─ Consolidates resume analysis, scorecard dashboard, marketContext, and LinkedIn evaluation
    └─ Persists run metadata into AgentRun collection with input hash
    └─ Returns finalized report to user or client endpoint
```

---

## 3. Inventory of AI / LLM Calls

In the complete Resume Agent evaluation flow, there is **EXACTLY ONE primary LLM call**:

### Call 1: Resume Synthesis Agent

| Attribute | Specification |
|---|---|
| **File** | `backend/agents/resume/resumeAgent.js` (invoked at line 360) |
| **Function** | `llmGateway.generate()` within `ResumeAgent.evaluate()` |
| **Purpose** | Synthesizes qualitative resume review, strengths, issues (3–7), verbatim evidence quotes, explanations, and conservative rewrites |
| **Provider** | Groq (Primary), with configured fallback to Gemini / OpenRouter / Grok / NVIDIA |
| **Model** | `openai/gpt-oss-120b` (Primary default via `MODEL_REGISTRY`), `openai/gpt-oss-20b` (Fallback), `gemini-3.8-flash` |
| **Prompt / Config Source** | `backend/agents/resume/synthesis/resumeSynthesis.prompt.js` (`SYNTHESIS_SYSTEM_PROMPT`) + `resumeSynthesis.js` |
| **Input Size** | ~2,500 – 4,500 prompt tokens (compact serialized resume + target JD + market profile + signals) |
| **Expected Output** | JSON object adhering to canonical schema (`overallReview`, `strengths[]`, `issues[]`) with verbatim evidence |
| **Output Token Budget** | Scaled dynamically: `min(12000, max(6144, compactEstimatedTokens * 3))` tokens |
| **Retry Behavior** | Bounded validation repair loop (`maxSynthesisAttempts = 2`). If validation fails, injects specific error note and requests corrected JSON. Truncation (`finish_reason === 'length'`) is treated as fatal. |
| **Validation** | Verified by 6 deterministic validators (`ResumeAgentValidator`, `rewriteValidator`, `claimValidator`, `assumptionValidator`, `recommendationValidator`, `resolveEvidenceConsistency`) |
| **Cache Behavior** | Deduplicated in `AgentRun` using deterministic input hash: `sha256(resumeHash:jdHash:targetRole:bucketKey:v:marketBucketVersion)`. Benchmark mode enforces `cacheMode: 'bypass'`. |
| **Necessity** | **High / Indispensable.** Natural language explanation, recruiter-style nuanced diagnosis, contextual sentence restructuring, and conversational delivery cannot be performed by regex or rules. |
| **Can it Run in Parallel?** | Yes, if split into specialized sub-reasoning tasks (e.g. Resume Internal Audit vs. Target JD Alignment vs. Market Gap Analysis). |
| **Can it be Replaced by Logic?** | Partially. The factual checks (missing metrics, tool dumps, contact merge, domain classification) are *already* calculated deterministically and fed into the prompt. The qualitative synthesis and natural language rewrites require reasoning. |

### Other AI Calls in Repository (Non-Resume Agent)
- `backend/services/reportGeneration.js` (`callAtlas`): Used exclusively for the legacy comprehensive assessment report bundle (`purpose: 'assessment_report'`). It is decoupled from the standalone Resume Agent and must not be modified.
- `backend/agents/linkedin/linkedinAgent.js`: Fully deterministic (zero LLM calls).

---

## 4. Reusable Infrastructure & Services

1. **AI Gateway (`backend/ai/gateway/llmGateway.js`)**:
   - Universal multi-provider abstraction supporting Groq, Gemini, OpenRouter, Grok, and NVIDIA.
   - Built-in fallback chains (`openai/gpt-oss-120b` → `openai/gpt-oss-20b` → `gemini-3.8-flash`).
   - Supports `isBenchmark: true` which **strictly disables fallback** to ensure clean comparative evaluations.
2. **Model Registry (`backend/ai/config/modelRegistry.js`)**:
   - Centralizes model declarations, capability flags (`supportsJsonObject`, `supportsReasoning`), privacy flags (`allowPersonalData`), and context window limits.
3. **AI Telemetry (`backend/telemetry/aiTelemetry.js`)**:
   - Centralized structured telemetry logging latency, tokens, requestId, provider, model, schema validity, and evidence validity without PII leakage.
4. **Structured Output Runner (`backend/agents/core/structuredOutput.js`)**:
   - Bounded validate-repair loop wrapper around `llmGateway.generate`.
5. **Prompt Registry (`backend/agents/core/promptRegistry.js`)**:
   - Tracks prompt text, versions, and SHA-256 hashes for reproducibility.
6. **Market Intelligence Layer (`backend/agents/resume/market/`)**:
   - Manages role/experience taxonomy, top-5 JD selection, deduplication, atomic version swaps, and deterministic profile generation.
7. **Cache Layer (`backend/agents/orchestrator.js`)**:
   - Deduplicates identical runs via `AgentRun` with versioned fingerprints.

---

## 5. Architectural Options for V3.1 Orchestration Benchmark

To determine the optimal balance of quality, latency, cost, and reliability, the system will compare three orchestration modes under identical benchmark conditions:

### Mode A: Baseline Single Synthesis (`baseline_single_synthesis`)
- **Structure**: Preprocessing → Compact Context → Single LLM Synthesis Call → Post-Validation.
- **Latency**: 1 round-trip network call (~1,200 – 2,500 ms on Groq).
- **Cost**: 1 prompt + 1 completion token budget.
- **Strength**: Maximum contextual coherence across strengths, issues, and rewrites.

### Mode B: Specialized Parallel Reasoning (`specialized_parallel_agents`)
- **Structure**: Runs 3 specialized reasoning agents concurrently:
  1. `Agent 1 — Resume Auditor`: Focuses purely on resume internal quality, ownership, impact, quantification, and language.
  2. `Agent 2 — Target JD Matcher`: Focuses purely on target JD alignment, keyword matches, and `NOT_EVIDENCED_IN_RESUME` requirements.
  3. `Agent 3 — Market Gap Analyst`: Compares resume evidence against sampled market profile and seniority expectations.
  - Followed by `Agent 4 / Synthesis Consolidator`: Validates and consolidates specialized evidence into the final canonical schema.
- **Latency**: Max latency of parallel calls + consolidation call.
- **Cost**: ~2.5x to 3.5x token usage due to multiple prompt envelopes.
- **Strength**: Specialized reasoning focus per domain; isolation of concerns.

### Mode C: Hybrid Deterministic + Focused Reasoning (`hybrid_deterministic_reasoning`)
- **Structure**: Offloads all quantifiable tasks (metrics counting, tool dump candidate detection, contact merge, exact JD keyword overlap, domain classification) to deterministic heuristics. Injects structured candidate diagnosis proposals into **ONE focused reasoning model** tasked strictly with qualitative explanation, prioritization, and conservative rewriting.
- **Latency**: 1 network call, potentially with shorter prompt and constrained output tokens.
- **Cost**: Minimal token waste, zero duplication.
- **Strength**: Best token efficiency, deterministic consistency, lower hallucination risk.

---

## 6. Recommendations & Benchmark Protocol

1. Implement an orchestration runner capable of switching between `baseline_single_synthesis`, `specialized_parallel_agents`, and `hybrid_deterministic_reasoning`.
2. Model routing must be governed by an `AITaskPolicy` abstraction rather than hardcoded model strings.
3. For benchmark evaluation:
   - Enforce `cacheMode: 'bypass'`.
   - Enforce `isBenchmark: true` on `llmGateway` (no silent fallback).
   - Evaluate against the 3 golden fixtures (`swapnil`, `alekya`, `weak-resume`).
   - Measure: Schema validity, evidence validity, total latency, input/output tokens, and qualitative issue accuracy.
