# AI Gateway V4 Audit & Reliability Architecture
**Assessment Prototype — AI/LLM Infrastructure Audit**
*Date: October 2026 | Version: 4.0 Audit*

---

## Executive Summary

This document provides a comprehensive end-to-end trace and audit of all AI/LLM operations in the Career GPS platform. It details the complete execution flow from caller invocation through the gateway, provider routing, models, parsers, validators, and persistence layers.

The audit diagnoses two immediate critical issues:
1. **`textToIdMap is not defined` ReferenceError**: Missing destructuring in `backend/agents/resume/resumeAgent.validator.js` (line 625) crashes the self-healing evidence relinker.
2. **Provider Reliability & High Latency (503 SERVICE_UNAVAILABLE, 429, ~20s Gemini responses)**: Sequential multi-model/multi-key retry loops in `geminiClient.js` without per-attempt timeout controls, coupled with scattered fallback logic across providers and uneven error classification.

---

## 1. End-to-End AI Call Path Architecture

The Career GPS AI execution pipeline adheres to a single-reasoning production architecture:

```
[ Caller ]
   │  (modeC_hybrid.js / reportGeneration.js / assessmentController.js / resumeAgent.js)
   ▼
[ AI Gateway: LLMGateway ]
   │  (Input validation, telemetry span initiation, data privacy filtering, model lookup)
   ▼
[ Provider Router & Fallback Chain ]
   │  (Chain: requestedModel → listModelsForPurpose → PRODUCTION_FALLBACK_CHAIN)
   ├── GroqProvider        ──► api.groq.com/openai/v1 (GPT-OSS 120B / 20B)
   ├── GeminiProvider      ──► @google/generative-ai (Gemini 3.8/3.7/3.6 Flash)
   ├── NvidiaProvider      ──► integrate.api.nvidia.com/v1 (Nemotron 3 Super 120B)
   ├── OpenRouterProvider  ──► openrouter.ai/api/v1 (Gemma 4 26B, Nemotron Free)
   └── GrokProvider        ──► api.x.ai/v1 (Grok Beta)
   ▼
[ Model Execution ]
   │  (Timeout-bounded HTTP fetch / SDK execution with multi-key failover)
   ▼
[ Response Parser & Repair ]
   │  (Markdown code fence stripping, JSON.parse, jsonrepair fallback)
   ▼
[ Domain Validators & Schema Enforcers ]
   │  (ResumeAgentValidator / Atlas Normalizer / Bounded Retry Loop via structuredOutput.js)
   ▼
[ Persistence & Delivery ]
   │  (MongoDB User.aiReport / User.resumeJson / Client Response JSON)
```

---

## 2. Comprehensive Inventory of AI Callers

| Caller File | Invocation Method | Purpose / Contract | Target Models / Provider | Fallback & Retry Behavior |
| :--- | :--- | :--- | :--- | :--- |
| [`modeC_hybrid.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/orchestration/modeC_hybrid.js) | `llmGateway.generate()` | `resume_analysis` (ONE reasoning call for resume audit) | Groq GPT-OSS 120B (default), fallback chain | 2 synthesis attempts with error feedback injection; gateway handles provider failover |
| [`reportGeneration.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/services/reportGeneration.js) (`callAtlas`) | `llmGateway.generate()` | `assessment_report` (Atlas Executive Report generation) | Gemini 3.8 Flash / NVIDIA Nemotron / Groq 120B | Explicit 16,000 token output budget, `treatLengthAsRetryable: true`, shape normalization |
| [`resumeAgent.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/resumeAgent.js) | Dispatches to `ModeC_Hybrid` (or fallback `llmGateway.generate`) | `resume_analysis` | Configured default (`RESUME_PRIMARY_MODEL`) | Mode C delegation; single-reasoning fallback loop if invoked in Mode A |
| [`structuredOutput.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/core/structuredOutput.js) | `llmGateway.generate()` | Generic structured output runner | Any configured model | Bounded `validate(text)` retry loop (max 2 attempts) with error feedback |
| [`modeB_parallel.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/orchestration/modeB_parallel.js) | `llmGateway.generate()` | Sub-critic generation & final synthesis | Groq GPT-OSS 120B | Multi-call parallel critic mode (deprecated in favor of Mode C in prod) |
| [`modeA_baseline.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/orchestration/modeA_baseline.js) | `llmGateway.generate()` | `resume_analysis` legacy baseline | Groq GPT-OSS 120B | Single prompt execution |
| [`assessmentController.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/controllers/assessmentController.js) (`parseResumeToJSON`) | `generateContentWithFallback()` (Gemini direct) | Initial resume PDF/DOCX to JSON parsing | `gemini-3.6-flash` | Direct key & model iteration via `geminiClient.js` |
| [`assessmentController.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/controllers/assessmentController.js) (`chatResume`) | `generateContentWithFallback()` (Gemini direct) | Atlas real-time candidate chat | `gemini-3.6-flash` | Direct key & model iteration via `geminiClient.js` |
| [`judgeAgent.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/judge/judgeAgent.js) | `generateContentWithFallback()` (Gemini direct) | Evaluation & quality scoring | `gemini-3.8-flash` | Direct key & model iteration via `geminiClient.js` |
| [`ragEngine.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/utils/ragEngine.js) | `embedContentWithFallback()` (Gemini direct) | Vector embedding for RAG | `text-embedding-004` | Direct key iteration via `geminiClient.js` |

---

## 3. Gateway Architecture & Provider Analysis

### 3.1 LLMGateway (`backend/ai/gateway/llmGateway.js`)
- **Single Entry Point**: Universal `generate()` interface for chat and structured completions.
- **Telemetry Integration**: Emits spans via `AITelemetry.startSpan()` and `span.finish()` capturing latency, token usage, requestId, and errors.
- **Data Privacy Gatekeeper**: Checks `isModelAllowedForData(modelId, isSynthetic)` using `MODEL_REGISTRY`. Non-compliant models (e.g. `thinkingmachines/inkling-small:free` with real user data) are rejected with HTTP 403 `DATA_PRIVACY_ERROR`.
- **Benchmark Protection**: When `isBenchmark: true`, fallback is strictly disabled to guarantee empirical model isolation.
- **Fallback Chain Resolution**:
  1. Primary target model (e.g. `openai/gpt-oss-120b`).
  2. Registered models for the logical purpose (e.g. `resume_analysis` or `assessment_report`).
  3. `PRODUCTION_FALLBACK_CHAIN`:
     - `openai/gpt-oss-120b` (Groq)
     - `openai/gpt-oss-20b` (Groq)
     - `gemini-3.8-flash` (Gemini)
- **Retryable Error Filter**: Triggers fallback on HTTP 408, 413, 429, 500, 502, 503, `RATE_LIMIT`, `TIMEOUT`, and `EMPTY_CONTENT`.

### 3.2 Provider Implementations & Observed Failure Modes

#### A. GroqProvider (`backend/ai/gateway/groqProvider.js`)
- **Transport**: Native `fetch` with `AbortController` (60s default timeout).
- **Key Rotation**: Rotates through all keys returned by `getAllGroqKeys()` on 429, 401, 403, 500, 502, 503, or timeout.
- **Failure Modes Observed**:
  - `429 Too Many Requests`: Fast failover to next key or next model.
  - Context size limits on large outputs if maxTokens is uncalibrated.

#### B. GeminiProvider (`backend/ai/gateway/geminiProvider.js`) & `geminiClient.js`
- **Transport**: Official `@google/generative-ai` SDK wrapped in `generateContentWithFallback()`.
- **Failure Modes Observed**:
  - **Latency Spikes (~20–30s)**: Gemini free/flash endpoints experience high congestion. `geminiClient.js` has nested loops: for each key, it tries `gemini-3.8-flash`, then `gemini-3.7-flash`, then `gemini-3.6-flash`. A congested model hangs for 15–25s before erroring; multiplying by 3 models and N keys causes 60–120s stalls!
  - **`503 Service Unavailable` / `The model is overloaded`**: Google Cloud returns 503 during peak load. If string matching in `geminiProvider.js` fails to identify non-standard error text, it defaults to generic 500 instead of `SERVICE_UNAVAILABLE`.
  - **Lack of Per-Request Timeout**: `@google/generative-ai` SDK call does not take an AbortSignal in its standard options, allowing requests to block indefinitely until socket timeout.

#### C. NvidiaProvider (`backend/ai/gateway/nvidiaProvider.js`)
- **Transport**: Native `fetch` to `integrate.api.nvidia.com/v1`.
- **Dynamic Timeout**: Scales timeout proportionally for large token jobs (`maxTokens * 12ms`).
- **Failure Modes Observed**:
  - Intermittent rate limits (429) during peak hours.

#### D. OpenRouterProvider (`backend/ai/gateway/openrouterProvider.js`)
- **Transport**: Native `fetch` to `openrouter.ai/api/v1`.
- **Failure Modes Observed**:
  - Free tier models experience upstream provider dropouts and queue delays.

---

## 4. Root Cause Analysis of Specific Bugs

### 4.1 Bug: `textToIdMap is not defined`
- **Location**: [`backend/agents/resume/resumeAgent.validator.js:625`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/resumeAgent.validator.js#L625)
- **Mechanism**:
  - In `buildCanonicalLookup(canonicalResume)`:
    ```javascript
    // Lines 123-186
    const textToIdMap = new Map() // lower-cased trimmed bullet text -> bulletId (exact)
    ...
    return { bulletMap, textSet, itemMap, textToIdMap }
    ```
  - In `validate()`:
    ```javascript
    // Line 625: OMISSION
    const { bulletMap, textSet, itemMap } = this.buildCanonicalLookup(canonicalResume)
    ```
  - In self-healing relink logic:
    ```javascript
    // Lines 730-738
    if (!isBullet && !isItem && originalText) {
      const key = originalText.toLowerCase().replace(/\s+/g, ' ').trim()
      let relinkId = textToIdMap.get(key) || null // <-- ReferenceError: textToIdMap is not defined
      if (!relinkId) {
        for (const [txt, id] of textToIdMap) { ... }
      }
    }
    ```
- **Consequence**: When the LLM outputs an issue that quotes real bullet text but hallucinates or modifies the bullet ID (e.g., outputs `exp_001_b1` instead of `exp_001_b01`), the self-healing relink triggers and crashes with `ReferenceError`, aborting the entire assessment.
- **Fix**: Destructure `textToIdMap` alongside `bulletMap, textSet, itemMap` on line 625.

### 4.2 Bug: `SERVICE_UNAVAILABLE` & 20s Gemini Hanging
- **Location**: [`backend/utils/geminiClient.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/utils/geminiClient.js) & [`backend/ai/gateway/geminiProvider.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/ai/gateway/geminiProvider.js)
- **Mechanism**:
  1. `geminiClient.js` contains internal multi-model fallback (`DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash']`) and multi-key fallback without individual timeouts.
  2. When Google's infrastructure is under high load, `gemini-3.8-flash` takes 20s before returning a 503 or 429.
  3. `geminiClient` catches the error and immediately tries `gemini-3.7-flash`, waiting another 20s, then `gemini-3.6-flash` (another 20s). Total wall time easily exceeds 60s, triggering client or gateway timeouts.
  4. Furthermore, error classification in `geminiProvider.js` relies on fragile substring checks (`errMsg.includes('503')`), missing variations such as `SERVICE_UNAVAILABLE`, `503 Service Unavailable`, `upstream connect error`, or HTTP status codes embedded on error objects.
- **Fix**:
  - Add explicit per-attempt timeout guards (e.g. 15-20s timeout budget per call) using `Promise.race` with an AbortSignal or timer.
  - Fail fast on 503/429 overload instead of cascading through 3 slow models sequentially on the same overloaded provider, letting the Gateway router immediately switch to Groq or NVIDIA.
  - Standardize error code detection across all providers with canonical `SERVICE_UNAVAILABLE` classification.

---

## 5. Parser, Validator & Structured Output Pipeline

### 5.1 JSON Parsing & Fault Tolerance
1. **Clean Extraction**:
   - `cleanAndParse()` in `ResumeAgentValidator` strips markdown syntax (````json` and `````).
   - Uses native `JSON.parse()`.
2. **`jsonrepair` Resiliency**:
   - If `JSON.parse()` fails (common with LLMs emitting unescaped quotes or trailing commas), `jsonrepair(rawString)` is executed.
   - If malformed JSON cannot be repaired, regex extracts the widest balanced `{ ... }` substring.
3. **Shape Normalization**:
   - For Atlas report (`reportGeneration.js`), `normalizeAtlasShapes()` ensures that fields expected as arrays (e.g. `mission_board`, `funnel_stages`) are not wrapped inside single-key objects.

### 5.2 Validation & Grounding Enforcement
- **Envelope Validation**: Checks mandatory fields (`analysisVersion`, `overallReview`, `issues`, `priorityActions`, `targetRoleAlignment`).
- **Evidence Cross-Verification**: Every cited `bulletId` and `originalText` in `issues[].evidence` must match canonical resume text.
- **Self-Healing Relink**: Real text with wrong IDs is repaired into correct stable IDs via `textToIdMap`.
- **Claim Grounding**: Fact tokens in diagnoses and recommendations are matched against `factCorpus`.
- **Bounded Retry Loop (`structuredOutput.js` / `modeC_hybrid.js`)**:
  - Maximum 2 attempts.
  - Validation failures are compiled into concise repair instructions and injected into the second attempt prompt.

---

## 6. Architecture Modernization Plan (AI Gateway V4)

To resolve all identified reliability, latency, and provider routing problems without modifying the Resume Agent pipeline:

1. **Provider Abstraction Clean-up**:
   - Create unified request options across all providers: `timeoutMs`, `abortSignal`, `supportsJsonObject`, `temperature`, `maxTokens`.
   - Unified error mapping via `ProviderError` with standard HTTP codes: `503 SERVICE_UNAVAILABLE`, `429 RATE_LIMIT`, `408 TIMEOUT`, `400 BAD_REQUEST`, `403 FORBIDDEN`.

2. **Gemini Latency & Fail-Fast Optimization**:
   - Introduce strict per-call timeouts (e.g., 20s cap) for Gemini calls.
   - When Gemini returns 503 or times out, immediately yield to the gateway fallback chain rather than grinding through 3 consecutive slow models on the same degraded endpoint.

3. **Self-Healing Relink Fix**:
   - Destructure `textToIdMap` in `ResumeAgentValidator.validate()`.

4. **Telemetry & Observability**:
   - Log provider attempt latencies, failover transitions, and token usage uniformly in `AITelemetry`.
