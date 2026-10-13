# Career GPS — Resume Agent V3.2 Quality Audit
**Document Version:** 1.0.0  
**Date:** October 2026  
**Status:** Audit Complete — Pre-Implementation Baseline  
**Scope:** Architecture & Reasoning Trace for Resume Agent V3.1 → V3.2 Quality Upgrade

---

## Executive Summary

The V3.1 AI orchestration benchmark rigorously established the following performance across orchestration paradigms:
* **Mode A (Baseline Single Synthesis):** ~3,500 tokens, ~1.15s latency, 94–96 quality score.
* **Mode B (Specialized Parallel Agents — 4 LLM calls):** ~12,400 tokens, ~1.40s latency, 94–96 quality score (zero measurable quality gain despite ~4× token burn and high concurrency overhead).
* **Mode C (Hybrid Deterministic + Reasoning):** ~3,350 tokens, ~1.05s latency, 94–96 quality score.

**Decision for V3.2:**
`hybrid_deterministic_reasoning` (Mode C) is the **PRODUCTION DEFAULT**. Mode A and Mode B remain strictly as experimental/benchmark modes.

The focus of V3.2 is **not** architectural complexity. It is:
1. **Higher Resume Analysis Quality**
2. **Stronger Evidence Grounding**
3. **Better, High-Craft Rewrites**
4. **Sharper Prioritization (Top 3–7 High-Conviction Issues)**
5. **Recruiter-Level Reasoning ("What I noticed, why it matters, and what I would change")**
6. **Zero Unsupported Claims**

---

## 1. Current Input Layer

### 1.1 Ingestion Points
1. **HTTP API:** `POST /api/resume-agent/evaluate` in [`backend/routes/resumeAgentRoutes.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/routes/resumeAgentRoutes.js). Accepts multipart form upload (`req.file`) or JSON payload (`resumeText`), along with `targetRole`, `targetJobDescription`, `experienceLevel`, and optional `model`.
2. **Global Orchestrator:** `runAssessment()` in [`backend/agents/orchestrator.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/orchestrator.js). Coordinates Resume Agent alongside LinkedIn and Assessment agents.
3. **Internal Lab & Benchmarks:** `ResumeAgentTestService.js`, `benchmarkOrchestration.js`, and golden test suites.

### 1.2 Parsing & Normalization
* **DocumentParser:** [`DocumentParser.parse({ buffer, mimeType, filename, text })`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/services/documentParser/index.js) extracts raw text, page count, and parsing confidence.
* **ResumeNormalizer:** [`ResumeNormalizer.normalize(parsedDoc, targetRole)`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/resumeAgent.normalizer.js) builds the Canonical Resume with deterministic stable IDs:
  * `summary_001`
  * `exp_001`, `exp_001_b01`, `exp_001_b02`, ...
  * `proj_001`, `proj_001_b01`, ...
  * `edu_001`, ...
  * `skills_001` (and `skills`)
  * `cert_001` (certifications)
* **Text Serialization:** [`serializeResumeForLLM(canonicalResume)`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/resumeAgent.inputSerializer.js) serializes the resume into a compact, bracket-tagged representation (`[exp_001_b01] Bullet text`), cutting input token volume by 60–70% compared to raw JSON.

---

## 2. Deterministic Preprocessing Pipeline

The entire fact-extraction, signal-detection, and comparative market layer runs **100% deterministically in Node.js (0ms LLM overhead, 0 tokens)**:

```text
Raw Resume / Text
        ↓
Document Parser & Canonical Normalizer
        ↓
┌─────────────────────────────────────────────────────────────┐
│                 Deterministic Preprocessing                  │
│                                                             │
│ 1. Resume Facts Extraction & Normalization                 │
│    (extractResumeFacts, normalizeFacts)                     │
│ 2. Signal Engine & Precomputed Signals                      │
│    (generateResumeSignals, computePrecomputedSignals)       │
│    • Quantification density & unquantified bullet list       │
│    • Tool-dump candidates (techCount >= 4, no outcome verb) │
│    • Contact detail merge anomaly in extracted text         │
│ 3. Specialized Rule Analyzers & Evidence Gatekeeper         │
│    • Positioning, Content, Impact, Technical, Structure     │
│    • analyzeEvidence: Verifies 100% verbatim grounding     │
│ 4. Domain Classification & US Market Signals                │
│    • classifyDomain (IT vs Healthcare, Sales, Finance...)   │
│    • detectUsMarketSignals (Non-US photos, DOB, status...)  │
│ 5. Market Intelligence Retrieval & Comparison               │
│    • resolveMarketBucket (Role × Experience bucket)         │
│    • getMarketDataForBucket (5 normalized market JDs)       │
│    • buildMarketProfile (Aggregated skill frequencies)      │
│    • evaluateMarketEvidence (Target alignment vs Gaps)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Deterministic Pre-Audit Dossier

Implemented in [`buildDeterministicDossier()`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/orchestration/modeC_hybrid.js#L29):
* **Quantification Rollup:** Total bullets, quantified bullets count, density ratio (e.g. 0.40), exact list of unquantified bullet IDs.
* **Tool-Dump Candidates:** Flagged bullets containing 4+ technologies without an active outcome verb (e.g., `proj_002_b01: 5 tools`).
* **Contact Merge Anomaly:** Flagged if email/phone/LinkedIn were extracted adjacent to the summary.
* **Target JD Overlap:** Exact skill extraction from the candidate's target JD partitioned into:
  * `evidencedSkills`: Explicitly present in the resume.
  * `unverifiedSkills`: Tagged strictly as `NOT_EVIDENCED_IN_RESUME`.
* **Sampled Market Evidence Gaps:** Top competencies appearing in 3+ of the 5 sampled market JDs not found in the resume.

---

## 4. LLM Prompt Architecture & V3.1 Audit Findings

### 4.1 Audit Findings in Current V3.1 Implementation
1. **Persona Depth Gap in Mode C:**  
   In V3.1, Mode C used a minimal prototype system prompt ("You are an elite Executive Recruiter..."). It lacked the rich, empathetic, human-level recruiter persona present in `resumeSynthesis.prompt.js` (Maya, 15 years experience, conversational US English, domain-specific impact definitions, anti-buzzword bans, and metric discovery questions).
2. **Schema Inconsistencies:**
   * In `modeC_hybrid.js`, `overallReview` was specified as a plain string, while the frontend (`ResumeDeepDiagnosis.jsx`) and validators check for `overallReview.summary`.
   * In `modeC_hybrid.js`, `evidence` was defined as a single object `{ section, itemId, bulletId, originalText }`, whereas `ResumeAgentValidator` and the public schema contract require an array of objects `evidence: [{ ... }]`.
   * In `modeC_hybrid.js`, `priorityActions` used `order`/`description`/`expectedImpact`, whereas the frontend and validators expect `priority`/`title`/`action`/`reason`.
3. **Diagnosis & Recommendation Quality:**
   * Mode C must strictly enforce the 3-part recruiter read:
     1. **What I noticed** (factual observation tied to bullet ID)
     2. **Why it matters** (recruiter perspective for this specific target role)
     3. **What I would change** (concrete actionable recommendation + conservative rewrite where safe)
   * Where quantification is missing, the model must provide domain-tailored `metricDiscoveryQuestions` instead of generic "add metrics" advice.
   * Rewrites must be strictly conservative: **ZERO new metrics, ZERO new technologies, ZERO ownership escalation** (e.g., turning "assisted" into "led"), and well-formed fill-in slots `[ADD: ...]` only when appropriate.

---

## 5. LLM Output Contract (V2.2 Public Contract)

The reasoning call produces a valid JSON object matching the contract:
```json
{
  "analysisVersion": "2.2",
  "candidateSnapshot": {
    "name": "Candidate Name",
    "targetRole": "Target Role",
    "experienceLevel": "e.g. Senior (5+ years)",
    "currentSeniority": "Senior",
    "primaryProfile": "Full Stack / Distributed Systems"
  },
  "dashboard": null,
  "overallReview": {
    "summary": "2 short conversational paragraphs explaining what is strong and what should be improved.",
    "tone": "conversational"
  },
  "strengths": [
    {
      "id": "str_001",
      "title": "Clear headline",
      "description": "Why this gives strong recruiter signal",
      "evidence": [
        {
          "section": "experience",
          "itemId": "exp_001",
          "bulletId": "exp_001_b01",
          "originalText": "Verbatim bullet text"
        }
      ]
    }
  ],
  "issues": [
    {
      "id": "issue_001",
      "severity": "high",
      "category": "impact",
      "title": "Clear, punchy issue title",
      "diagnosis": "What was noticed in this bullet",
      "whyItMatters": "Why a recruiter cares for this target role",
      "recommendation": "What the candidate should do",
      "correctedText": "Conservative drop-in rewrite using ONLY existing facts, or null",
      "metricDiscoveryQuestions": [
        "What was the measurable latency improvement (e.g. in ms or %)?"
      ],
      "correctionType": "rewrite",
      "confidence": 0.95,
      "evidence": [
        {
          "section": "experience",
          "itemId": "exp_001",
          "bulletId": "exp_001_b02",
          "originalText": "Verbatim bullet text"
        }
      ]
    }
  ],
  "priorityActions": [
    {
      "priority": 1,
      "title": "Highest leverage fix first",
      "action": "Concrete step the candidate can execute today.",
      "reason": "Why this impacts hiring conversion"
    }
  ]
}
```

---

## 6. Hard Validation Layer

Every output passes through a multi-stage validation gauntlet:
1. **JSON Cleaning & Repair:** [`jsonrepair`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/resumeAgent.validator.js#L67) handles unclosed brackets, unquoted keys, and minor syntax anomalies.
2. **Schema & Count Enforcement:** Confirms required fields, version `2.2`, `dashboard = null`, and issue count within 3–10 (3–7 preferred).
3. **Evidence Fidelity & Self-Healing:**
   * Bullet IDs are looked up against `canonicalResume`.
   * `originalText` must match the canonical text verbatim.
   * If a model cites an incorrect bullet ID but the text matches a real bullet verbatim, the self-healing relinker fixes the ID pointer.
4. **Unsupported Claim Validator:** [`claimValidator.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/validation/claimValidator.js) scans for fabricated currencies, percentages, entity counts (users, customers), and technologies not present in the canonical resume.
5. **Rewrite Safety Validator:** [`rewriteValidator.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/validation/rewriteValidator.js) checks `correctedText` against `originalText`. Strictly rejects new numbers, new technologies, forbidden buzzwords, and malformed fill-in slots.
6. **Assumption Validator:** [`assumptionValidator.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/validation/assumptionValidator.js) flags unevidenced claims such as "student project", "basic CRUD", "production-ready", "enterprise-grade", "customer-facing", or "led a team".
7. **Recommendation Duplication Validator:** [`recommendationValidator.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/validation/recommendationValidator.js) calculates Jaccard and containment similarity to prevent recommendations from simply repeating the diagnosis.
8. **Contradiction Resolver:** [`consistencyChecker.js`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/classification/consistencyChecker.js) resolves conflicts if the same `bulletId` appears in both `strengths` and `issues` (STRONG retained in strengths; WEAK retained in issues; BORDERLINE dropped from both).
9. **Market Language Safety:** [`isMarketLanguageSafe()`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/market/marketEvidence.js#L29) bans aggressive or dismissive phrasing ("you don't know", "mandatory for this role", "you will be rejected").

---

## 7. Consolidation & Deterministic Scorecard

Post-validation, the application layer enriches the response with zero LLM cost:
1. **Scorecard Engine:** [`computeScorecard()`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/resume/scoring/resumeScorecard.js) populates `dashboard`:
   * `dashboard.score` (0–100 overall score)
   * `dashboard.dimensions` (impact, clarity, positioning, structure)
   * `dashboard.checks` (Rezi-style pass/warn/fail checklist for quantified evidence, outcome verbs, tool dumps, contact header, US norms)
   * `dashboard.bulletAudit` (line-by-line categorization of all canonical bullets)
2. **Metadata & Market Context:** Injects `marketContext` (role, experience bucket, sampled JDs, target alignment, market evidence gaps) and telemetry metadata.

---

## 8. Persistence & Caching

* **Run Persistence:** [`persistRun()`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/backend/agents/orchestrator.js#L164) saves the execution run with `agent: 'resume'`, `agentVersion: '3.2.0'`, input hash, token cost, latency, attempt count, and sanitized analysis.
* **Content Hash Caching:** If a resume with identical content hash has been analyzed, orchestrator returns cached analysis with 0ms latency.

---

## 9. Frontend & Report Consumption

* **Report Dashboard:** [`ReportDashboard.jsx`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/src/components/report/ReportDashboard.jsx) embeds [`ResumeDeepDiagnosis.jsx`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/src/components/report/ResumeDeepDiagnosis.jsx).
* **Rendered Sections:**
  1. **Scorecard:** Letter grade and dimension scores from `dashboard`.
  2. **The Recruiter's Read:** Conversational summary from `overallReview.summary`.
  3. **Line-by-Line Audit:** Bullet audit table from `dashboard.bulletAudit`.
  4. **Deep Diagnosis:** List of issues with severity badges, diagnosis, action recommendations, and interactive metric discovery prompts (`metricDiscoveryQuestions`).
  5. **Do These First:** Numbered priority action list from `priorityActions` (`priority`, `title`, `action`).
  6. **Interactive Test Lab:** [`ResumeAgentTestLab.jsx`](file:///c:/Users/hp/Desktop/ADITYA/sass/Assessment%20prototype/carrer-gps-asessment/src/pages/ResumeAgentTestLab.jsx) provides live developer testing, prompt inspection, and signal visualization.

---

## 10. Required V3.2 Upgrades

1. **Set Mode C as Production Default:** Update `resumeAgent.js` to default `orchestrationMode` to `'hybrid_deterministic_reasoning'` (or `process.env.RESUME_AGENT_ORCHESTRATION_MODE || 'hybrid_deterministic_reasoning'`). Keep Mode A and Mode B as benchmark/experimental modes.
2. **Strengthen Mode C Recruiter Reasoning & Persona:** Upgrade `modeC_hybrid.js` prompt to embed:
   * Recruiter Persona ("Maya", 15 years experience, conversational US English).
   * Strict 3-part diagnosis: *"What I noticed, why it matters, and what I would change."*
   * Sharp prioritization: Exactly 3–7 high-leverage issues ranked by hiring impact.
   * Grounded, conservative drop-in rewrites with zero new metrics or ownership escalation.
   * Domain-specific metric discovery questions for unquantified bullets.
   * Exact schema alignment with `ResumeDeepDiagnosis.jsx` and `ResumeAgentValidator` (`evidence: [...]`, `priorityActions: [{ priority, title, action, reason }]`, `overallReview: { summary, tone }`).
3. **Verify Full Test Suite & Benchmarks:** Ensure all units, V3 suite, market intelligence tests, and orchestration benchmarks pass 100%.
