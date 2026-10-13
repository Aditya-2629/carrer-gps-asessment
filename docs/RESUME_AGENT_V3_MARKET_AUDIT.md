# Resume Agent V3 Market Intelligence — Repository Audit

**Document Version:** 1.0.0  
**Date:** October 2026  
**Auditor:** Antigravity Agent  
**Target:** Career GPS Assessment Prototype (`carrer-gps-asessment`)

---

## 1. Executive Summary

This audit assesses the current state of the Career GPS codebase before implementing the **Resume Agent V3 Market Intelligence layer**. The objective is to identify existing patterns, reusable services, data models, integration points, and architectural constraints to ensure zero breakage to existing features (Assessment flow, Resume Agent V1/V2/V2.5/V3, Test Lab, Admin panel, and AI Gateway).

---

## 2. Inventory of Existing Relevant Files

### 2.1 Backend Core & Server
- `backend/server.js`: Express application setup, CORS configuration, MongoDB Mongoose connection, route registrations:
  - `/api/otp` (`otpRoutes.js`)
  - `/api/assessment` (`assessmentRoutes.js`)
  - `/api/knowledge-base` (`knowledgeBaseRoutes.js`)
  - `/api/resume-agent` (`resumeAgentRoutes.js`)
  - `/api/resume-agent/test` (`resumeAgentTestRoutes.js`)
  - `/api/admin` (`adminRoutes.js`)
  - `/api/report-jobs` (`reportJobRoutes.js`)
  - `/api/feedback` (`feedbackRoutes.js`)

### 2.2 Resume Agent Pipeline (`backend/agents/resume/`)
- `resumeAgent.js`: Master evaluation orchestrator (`ResumeAgent.evaluate()`). Implements the V3 deterministic pipeline:
  - Document Parser (`DocumentParser.parse()`)
  - Canonical Normalizer (`ResumeNormalizer.normalize()`)
  - Compact Serializer (`serializeResumeForLLM()`)
  - Signal Engine (`generateResumeSignals()`)
  - Precomputed Signals (`computePrecomputedSignals()`)
  - Facts Extraction & Normalization (`extractResumeFacts()`, `normalizeFacts()`)
  - Specialized Analyzers (`positioning`, `content`, `impact`, `technical`, `structure`, `evidenceAnalyzer`)
  - Evidence Classification (`classifyAllEvidence()`)
  - Domain Profile & US-Market Signals (`classifyDomain()`, `detectUsMarketSignals()`)
  - Synthesis Message Builder (`buildSynthesisMessages()`)
  - Single LLM call with retry/repair loop via `llmGateway.generate()`
  - Post-synthesis validators (`rewriteValidator`, `assumptionValidator`, `claimValidator`, `recommendationValidator`, `resolveEvidenceConsistency`)
  - Scorecard Engine (`computeScorecard()` populating `dashboard`)
- `resumeAgent.normalizer.js`: Produces immutable canonical JSON resume structure with stable IDs (`summary_001`, `exp_XXX_bYY`, `proj_XXX_bYY`, `skills_001`).
- `resumeAgent.validator.js`: Validates schema conformance, verbatim evidence matching, forbidden claims, metric fabrication ($ and %), new technologies, and maximum issue counts.
- `resumeAgent.schema.js`: JSON schema definitions for analysis contract (version `2.2`).
- `resumeAgent.inputSerializer.js`: Deterministic compact serializer and hash calculation.
- `state/resumeState.js`: Pipeline state container with deep-freeze protection.
- `market/domainClassifier.js`: Deterministic domain taxonomy (IT, healthcare, finance, marketing, etc.).
- `market/usMarketSignals.js`: Deterministic detection of non-US resume formatting conventions.

### 2.3 AI Gateway & Provider System (`backend/ai/`)
- `gateway/llmGateway.js`: Provider-neutral LLM gateway managing requests, timeouts, retries, and fallback chains (`groq` -> `gemini` -> `openrouter` -> `grok` -> `nvidia`).
- `config/aiConfig.js`: Multi-key environment parser and provider settings.
- `config/modelRegistry.js`: Model definitions, context windows, pricing, reasoning capabilities, and synthetic data permissions.
- `telemetry/aiTelemetry.js`: Span metrics tracking latency, token usage, requestId, and errors.

### 2.4 Document Parsing (`backend/services/documentParser/`)
- `index.js`, `pdfParser.js`, `docxParser.js`, `textParser.js`: Robust local extraction using `pdf-parse` and `mammoth` with page count and extraction confidence scoring.

### 2.5 Orchestration & Job Infrastructure
- `agents/orchestrator.js`: Supervisor running Resume Agent + LinkedIn Agent in parallel, with MongoDB-backed `AgentRun` cache lookups and telemetry persistence.
- `models/ReportJob.js` & `routes/reportJobRoutes.js`: In-process async job handling using Mongoose state transitions (`queued` -> `running` -> `done`/`failed`) and in-memory `EventEmitter` SSE bus.
- `models/AgentRun.js`: Audit log and execution cache keyed by `inputHash` with 7-day TTL.

### 2.6 External Integrations
- `backend/utils/apifyLinkedInScraper.js`: Scrapes LinkedIn using official `apify-client` (v2.24.0) with Actor `harvestapi/linkedin-profile-scraper`. Reads `process.env.APIFY_API_TOKEN`.

### 2.7 Admin Panel & Authentication
- `backend/utils/adminAuth.js`: Zero-dependency timing-safe HMAC tokens (`ADMIN_SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`), verified via `adminGuard` middleware.
- `backend/routes/adminRoutes.js` & `backend/controllers/adminController.js`: Analytics, user detail, resume/report downloads.
- `src/pages/admin/AdminPanel.jsx` & `AdminLogin.jsx`: React frontend for admin monitoring.

---

## 3. Sources of Truth Analysis

| Entity | Current Source of Truth | Notes & Constraints for V3 |
| :--- | :--- | :--- |
| **Uploaded Resume** | Multer buffer (`req.file`) or `resumeText` string | Parsed by `DocumentParser`, normalized by `ResumeNormalizer`. Canonical resume is immutable. |
| **Uploaded Target JD** | Previously not captured in Resume Agent endpoints; only `targetRole` string was passed | Needs explicit support in `/api/resume-agent/evaluate` (`targetJobDescription` or `targetJd`) while maintaining backward compatibility if omitted. |
| **Target Role** | Passed as `targetRole` in request body or extracted from resume candidate snapshot | Needs canonical normalization into controlled role taxonomy (`roleKey`, `roleName`, `specialization`). |
| **Experience Level** | Stated in resume summary / calculated from job dates | Must combine resume experience with target JD requirement to resolve experience bucket (`0-2`, `3-5`, `6-8`, `8+`). |
| **Report Contract** | `analysisVersion: "2.2"`, `dashboard: Scorecard`, `strengths[]`, `issues[]`, `priorityActions[]` | Public schema must NOT break. Market intelligence attached under optional `marketContext` object. |
| **User Ownership** | `User._id` | Associated with `ReportJob` and `AgentRun.userId`. |
| **Admin Auth** | `adminGuard` using `ADMIN_SESSION_SECRET` HMAC tokens | Admin endpoints must use `adminGuard`. |
| **Apify Config** | `APIFY_API_TOKEN` in `backend/.env` | Actor execution must use `apify-client` with configurable job search Actor and fallback strategy. |

---

## 4. Reusable Services & Components

1. **`apify-client` (v2.24.0)**:
   - Already installed in `backend/package.json`.
   - Used in `apifyLinkedInScraper.js` with `new ApifyClient({ token: process.env.APIFY_API_TOKEN })`.
   - Reusable directly for market JD querying.
2. **`llmGateway.js`**:
   - Central entry point for LLM synthesis. Must be preserved; no separate OpenAI/Gemini client should be created.
3. **`DocumentParser` & `ResumeNormalizer`**:
   - Parse and normalize resumes without any external dependencies.
4. **Validation Suite (`validation/`)**:
   - `rewriteValidator.js`: Strict prevention of scope/metric/seniority escalation.
   - `claimValidator.js`: Verifies claims against resume facts.
   - `assumptionValidator.js`: Flags ungrounded assumptions.
   - `recommendationValidator.js`: Deduplicates recommendations.
5. **Admin Guard (`adminAuth.js`)**:
   - Protects admin endpoints.

---

## 5. Queue & Redis Infrastructure Assessment

- **Current State**: The repository does **NOT** currently run a Redis instance. `PLATFORM_BLUEPRINT.md` notes that day-one deployment on Render is single-instance Node with Mongo-backed job records.
- **Job Pattern**: `ReportJob.js` and `reportJobRoutes.js` implement asynchronous background execution using an in-process worker + Mongo status tracking + in-memory event bus.
- **Requirement for Market JD Jobs**:
  - The specification recommends BullMQ with Redis if no queue exists, while Rule 8 states: *"Do NOT create another Redis client if Redis infrastructure already exists"* and Rule 10 states: *"Use the existing queue infrastructure if present. If no queue exists, use BullMQ with Redis."*
  - **Architecture Decision**: Provide a unified queue abstraction (`marketJdQueue.js` / `marketJdWorker.js`):
    - When `REDIS_URL` is set, it uses BullMQ for distributed queueing, retries, and worker concurrency.
    - When `REDIS_URL` is absent (default local dev / Render without Redis add-on), it seamlessly uses an in-process Mongo-backed bounded concurrency task queue with exact same job interface (`add`, `process`, status tracking, retries, backoff).
    - This ensures **zero crashes** in all environments while fulfilling production-grade background refresh requirements.

---

## 6. Identified Risks & Guardrails

1. **Risk: LLM Context Bloat (5 JDs in Prompt)**:
   - *Guardrail*: Never send 5 complete raw JDs into the LLM synthesis call. Extract and aggregate a deterministic, compact `MarketProfile` (frequency of skills, responsibilities, seniority signals, sample size 5) and inject at most compact relevant snippets.
2. **Risk: Target JD Override**:
   - *Guardrail*: The candidate's target JD remains the primary authority. Market data only provides context. Low market frequency of a skill explicitly requested by target JD must never downgrade the requirement.
3. **Risk: "Market Gap" Conflated with "Skill Deficiency"**:
   - *Guardrail*: Distinct wording guardrail: "Skill appears frequently in sampled roles, but resume does not provide clear evidence" vs "Candidate lacks skill".
4. **Risk: Data Deletion During Refresh**:
   - *Guardrail*: Atomic version swap: new version `v(N+1)` is scraped, validated, and stored before `activeVersion` pointer is updated. If scraping or validation fails, `v(N)` remains active with zero downtime.
5. **Risk: Prompt Mutation**:
   - *Guardrail*: Self-learning layer stores versioned `LearningSignal` documents in MongoDB for human/admin review. No automatic runtime prompt rewrites.

---

## 7. Migration & Implementation Plan

### Phase A: Audit (Current Phase)
- Completed with this document.

### Phase B: Data Models
- `JobMarketBucket.js`: Bucket metadata, `bucketKey`, `activeVersion`, status, timestamps.
- `JobMarketVersion.js`: Versioned records containing exactly 5 normalized JDs, `marketProfile`, validation summaries.
- `LearningSignal.js`: Captured observation signals without prompt mutation.

### Phase C: JD Normalization & Role Taxonomy
- `marketBucketResolver.js`: Resolves `roleKey`, `specialization`, and `experienceBucket` (`0-2`, `3-5`, `6-8`, `8+`) from JD + resume.
- `jdNormalizer.js`: Cleans, deduplicates (fingerprint hash), filters spam, and validates JDs.

### Phase D: Apify Adapter
- `apifyJdScraper.js`: Queries Apify Actor for candidate job postings with exponential backoff and candidate pool selection (15–25 fetched, top 5 selected).

### Phase E: Background Queue & Worker
- `marketJdQueue.js`, `marketJdWorker.js`: Bounded concurrency queue handling `market-jd-refresh` and `market-jd-refresh-all`.

### Phase F: Market Profile Builder
- `marketProfileBuilder.js`: Aggregates 5 JDs into deterministic skill, responsibility, and seniority frequencies without LLM calls.

### Phase G: Resume Agent V3 Integration
- Integrate market context into `resumeAgent.js` and `resumeSynthesis.js`.
- Output `marketContext` in response.

### Phase H: Validation & Guardrails
- Ensure market evidence respects ownership preservation and claim validation.

### Phase I: Admin Refresh API & UI
- `POST /api/admin/market-library/refresh`
- `POST /api/admin/market-library/refresh/:bucketKey`
- `GET /api/admin/market-library`
- Admin UI tab in `AdminPanel.jsx`.

### Phase J: Cache Key Integration
- Include `marketBucketVersion` in analysis cache fingerprint.

### Phase K: Learning Signals Storage
- Capture market trends and candidate gap signals into `LearningSignal`.

### Phase L: Testing & Golden Fixtures
- Test bucket resolution, atomic swap, fallback behavior, and benchmark evaluation.

---

**Audit Status:** APPROVED TO PROCEED TO PHASE B.
