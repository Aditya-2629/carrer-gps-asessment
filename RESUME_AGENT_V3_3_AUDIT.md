# Career GPS — Resume Agent V3.3 Architecture & Implementation Audit
**Status:** Complete Forensic Audit  
**Date:** October 8, 2026  
**Target:** Transition from V3.2.1 Hybrid to V3.3 Recruiter-Level Engine  

---

## 1. Executive Summary

This document represents the baseline architectural and code-level audit of the Career GPS Resume Agent prior to the V3.3 implementation. The system operates as a **hybrid deterministic-reasoning architecture** (`hybrid_deterministic_reasoning` / Mode C), executing objective signal detection, timeline normalization, and market retrieval in deterministic JavaScript code before issuing **ONE** structured reasoning call to the AI Gateway, followed by multi-phase validation and deterministic scorecard generation.

### Core Findings
1. **Pipeline Integrity**: The single-reasoning hybrid kernel (`modeC_hybrid.js`) works effectively and avoids multi-hop LLM fragility or LangGraph overhead.
2. **Contact / ATS False Positive**: The normalizer (`resumeAgent.normalizer.js`) lumps pre-header contact lines into `sections.summary`. Consequently, standard contact lines (e.g. `John Smith | New York, NY | 555-555-5555 | email@example.com`) are evaluated by `precomputedSignals.js` as `isContactMerged = true`, falsely triggering ATS layout warnings on standard resumes.
3. **Timeline Analysis Gaps**: While `timelineAnalyzer.js` detects basic string date ranges and overlaps, it lacks recruiter-level understanding: career duration calculation, career gaps (>6 months), promotions vs job changes, and current vs past role status. Furthermore, `normalizer.js` leaves `startDate` and `endDate` empty in the canonical experience objects.
4. **Certification Detection**: `normalizer.js` only parses certifications if a distinct `CERTIFICATIONS` section heading exists. Certifications embedded in skills, summaries, or experience bullets (e.g., AWS Certified Solutions Architect, CKA, PMP) are missed.
5. **Validator Redundancy & Safety**: Validation logic is bifurcated between `backend/agents/resume/resumeAgent.validator.js` (monolithic 1624-line validator) and `backend/agents/resume/validation/*` (modular V3 validators).

---

## 2. End-to-End Execution Flow (Request → Report)

```
Candidate Upload / Input
   │
   ▼
[1] DocumentParser (backend/services/documentParser/index.js)
   │  - Supports PDF (pdfParser), DOCX (docxParser), and UTF-8 plain text.
   │  - Outputs: rawText, pages, pageCount, confidence, warnings.
   ▼
[2] ResumeNormalizer (backend/agents/resume/resumeAgent.normalizer.js)
   │  - Header extraction: name, email, phone, location.
   │  - Section segmentation: summary, experience, projects, education, skills, certifications.
   │  - Stable ID assignment: summary_001, exp_XXX_bYY, proj_XXX_bYY, edu_XXX, skill_XXX.
   ▼
[3] Deterministic Signal Layer
   │  - precomputedSignals.js: bulletSignals (quantifiers, tech mentions, outcome verbs, tool dumps),
   │    quantificationRollup (totalBullets, quantifiedBullets, density),
   │    contactMerge (email/phone/url detected in summary).
   │  - timelineAnalyzer.js: date token extraction, date range parsing, overlap detection.
   │  - domainClassifier.js: classifies IT vs non-IT and engineering sub-domains.
   │  - usMarketSignals.js: flags non-US conventions (photos, marital status, nationality).
   ▼
[4] Market Intelligence Layer (backend/agents/resume/market/)
   │  - marketBucketResolver.js: resolves Role × Experience bucket (e.g., software-engineer::3-5).
   │  - marketJdRetriever.js: retrieves 5 real cached market JDs (or triggers background Apify refresh).
   │  - marketProfileBuilder.js: aggregates required/preferred skills and frequency ratios.
   │  - marketEvidence.js: compares candidate resume against market profile without modifying candidate target JD.
   ▼
[5] Deterministic Pre-Audit Dossier (modeC_hybrid.js: buildDeterministicDossier)
   │  - Compiles ground truth into structured JSON: quantification, tool dumps,
   │    contactMerge, targetJdOverlap (evidenced vs unverified), marketEvidenceGaps.
   ▼
[6] AI Gateway Reasoning Call (modeC_hybrid.js: executeModeC)
   │  - ONE strong recruiter-level reasoning call using prompt: buildHybridPrompt().
   │  - Injects compact serialized resume + pre-audit dossier + target JD + market context.
   │  - Output: JSON matching synthesis schema (overallReview, strengths, issues, priorityActions).
   │  - Bounded validation retry (maxAttempts = 2) with diagnostic repair notes.
   ▼
[7] Hard Validators (resumeAgent.validator.js & validation/*)
   │  - JSON syntax & repair (jsonrepair).
   │  - Top-level schema compliance & issue count bounds (3–7 issues).
   │  - Evidence grounding: itemId, bulletId, originalText veracity.
   │  - ClaimValidator & RewriteValidator: zero fabricated metrics, ungrounded technologies, or new claims.
   │  - FillInSlots: enforces valid `[ADD: ...]` syntax without concrete numbers.
   │  - RecommendationValidator: prevents recommendation repeating diagnosis.
   ▼
[8] Deterministic Scorecard & Dashboard (scoring/resumeScorecard.js)
   │  - Computes 0–100 Resume Health Score and letter grades (Impact, Positioning, ATS Safety, Credibility, Brevity, US Alignment).
   │  - Builds pass/warn/fail checklist (no LLM hallucinations).
   │  - Generates line-by-line bullet audit with before→after comparisons.
   ▼
[9] Report Persistence & Frontend Delivery
   │  - Attached to user assessment report under aiReport.resume_agent.
   │  - Consumed by ResumeScoreCard.jsx, ResumeBulletAudit.jsx, and ResumeDeepDiagnosis.jsx.
```

---

## 3. Detailed Component Audit

### 3.1 Document Parser (`backend/services/documentParser/`)
- **Status**: Production-ready.
- **Implementation**:
  - `index.js`: Routes by MIME type/extension (`application/pdf`, `.docx`, plain text).
  - `pdfParser.js`: Extracts per-page text using `pdf-parse` with coordinate tracking.
  - `docxParser.js`: Uses `mammoth` for text and layout extraction.
  - `textNormalizer.js`: Cleans UTF-8 artifacts, whitespace, and evaluates extraction confidence.

### 3.2 Canonical Resume Model (`resumeAgent.normalizer.js`)
- **Status**: Functional with key data model defects.
- **Current Model**:
  ```json
  {
    "document": { "type": "pdf", "pageCount": 1, "extractionConfidence": 0.95 },
    "candidate": {
      "name": "Marcus Vance",
      "targetRole": "Senior Backend Engineer",
      "contact": { "email": "marcus@example.com", "phone": "555-1234", "location": "Seattle, WA" }
    },
    "summary": { "text": "...", "source": { "page": 1 } },
    "experience": [
      {
        "id": "exp_001",
        "company": "CloudScale Networks | Seattle, WA",
        "role": "",
        "startDate": "",
        "endDate": "",
        "bullets": [{ "id": "exp_001_b01", "text": "..." }]
      }
    ],
    "projects": [...],
    "education": [...],
    "skills": [...],
    "certifications": [...]
  }
  ```
- **Defects**:
  1. Header lines before the first section header are pushed into `sections.summary`. If the candidate has no `PROFESSIONAL SUMMARY` header, contact lines become `summary.text`.
  2. Experience header lines often lump company, role, and dates into `company` without splitting into `startDate`, `endDate`, and `role`.
  3. Certifications only populate if a section header matches `/^(certifications|licenses|courses|awards)$/i`.

### 3.3 Deterministic Signal Layer (`backend/agents/resume/signals/`)
- **`precomputedSignals.js`**:
  - `computeBulletSignals`: Correctly calculates word count, quantifiers, declared tech mentions, and `isToolDumpCandidate`.
  - `computeQuantificationRollup`: Correctly aggregates `totalBullets`, `quantifiedBullets`, `density`.
  - `computeContactMergeSignal`: **Defective**. Counts detected emails, phones, and URLs in `summaryText`. Because `normalizer.js` includes the contact block in `summary`, this yields 100% false positives on standard resume headers.
- **`timelineAnalyzer.js`**:
  - Only checks raw date tokens (`Month YYYY`, `MM/YYYY`, `YYYY`).
  - Does not compute total career years, current position flag, career progression, or gap thresholds.

### 3.4 Orchestration Kernel (`modeC_hybrid.js` & `orchestrationRunner.js`)
- **Status**: Stable & Verified.
- **Architecture**:
  - `modeC_hybrid.js` computes `buildDeterministicDossier()` at 0ms and 0 tokens.
  - Passes dossier + compact resume to single synthesis call via `llmGateway`.
  - Supports validation retries (up to 2 attempts) injecting specific error feedback.
  - Model selection fix applied: correctly routes user-selected model from Test Lab.

### 3.5 AI Gateway (`backend/ai/gateway/`)
- **Status**: Robust multi-provider router.
- **Providers Active**:
  - `groq`: `openai/gpt-oss-120b` (Primary), `openai/gpt-oss-20b` (Fallback).
  - `gemini`: `gemini-3.8-flash` (Latest), `gemini-3.7-flash`, `gemini-3.6-flash`.
  - `nvidia`: `nvidia/nemotron-3-super-120b-a12b`.
  - `openrouter`: Free tier models (Gemma, Nemotron).
- **Features**: Circuit breaking, key rotation, zero silent fallbacks in benchmark mode, telemetry spans.

### 3.6 Validation Subsystem
- **Monolithic Validator (`resumeAgent.validator.js`)**:
  - 1624 lines containing JSON repair, top-level schema validation, evidence matching, fact traceability, placeholder pattern matching, fill-in slot syntax checking.
- **Modular Validators (`backend/agents/resume/validation/`)**:
  - `claimValidator.js`: Checks numeric fact tokens ($/%, numbers) against source.
  - `evidenceValidator.js`: Ensures `itemId` and `bulletId` exist and match canonical text.
  - `rewriteValidator.js`: Enforces conservative rewrites with no new technologies, metrics, or claims.
  - `recommendationValidator.js`: Computes token overlap (Jaccard & containment) to flag copy-paste recommendations.
  - `assumptionValidator.js`: Scans for forbidden assumptions (`production-ready`, `enterprise-grade`, `led a team`).
  - `fillInSlots.js`: Manages `[ADD: metric]` syntax.

### 3.7 Scorecard Engine (`backend/agents/resume/scoring/resumeScorecard.js`)
- **Status**: High performance deterministic engine.
- **Weights**: Impact (26%), Positioning (18%), ATS Safety (16%), Credibility (15%), Brevity (14%), US Alignment (11%).
- **Current Issue**: ATS Safety score and checklist item `contact_header` are penalized whenever `contactMerge.isContactMerged = true`, inheriting the normalizer false positive.

### 3.8 Frontend Consumption (`src/components/report/`)
- `ResumeDeepDiagnosis.jsx`: Renders the section when `resumeAgent.dashboard` or `resumeAgent.issues` exist.
- `ResumeScoreCard.jsx`: Displays 0–100 score, grade letter, breakdown bars, and pass/warn/fail checklist.
- `ResumeBulletAudit.jsx`: Renders per-bullet before & after view with status badges (`pass`, `warn`, `fix`).

---

## 4. Current Defect Matrix & V3.3 Opportunities

| Area | Current Behavior | Problem / Defect | V3.3 Solution |
| :--- | :--- | :--- | :--- |
| **Contact / ATS** | Top contact line placed in `summary.text` → `isContactMerged = true` | Standard contact header flagged as ATS risk (false positive) | Isolate header contact cleanly; only flag contact merge if contact is genuinely in a narrative paragraph |
| **Timeline** | Regex matches date tokens on `company` string | No career duration, gap detection, current role detection, or promotion awareness | Build Intelligent Career Timeline engine in deterministic code; compute duration, gaps, overlaps, promotions |
| **Certifications** | Only parses if `CERTIFICATIONS` heading exists | Misses AWS, CKA, PMP, CISSP in skills or bullets | Implement deterministic Certification Detector across skills, summary, and experience |
| **Rewrites** | Generic template-like rewrites | Sometimes lacks senior recruiter punch or conversational nuance | Recruiter-Grade Rewrite Guidelines: preserve candidate voice, add context, use `[ADD: ...]` cleanly |
| **Recruiter Tone** | Diagnostic tone can feel like ATS checker | Sounds like automated rule engine | Inject authentic recruiter persona: "What I noticed, why it matters, what I'd change" |

---

## 5. Architectural Principles for V3.3

1. **Hybrid Architecture Preserved**: Deterministic code does 100% of the math, date parsing, gap finding, and certification detection. The LLM does 100% of the recruiter explanation, prioritization, and rewrite crafting.
2. **Zero New Agents / Frameworks**: Single reasoning call in Mode C preserved. No LangGraph, no multi-agent chatter.
3. **Evidence Safety & Grounding**: Strict zero-fabrication rules enforced.
4. **Backward Compatibility**: Schema remains fully compatible with `ResumeScoreCard.jsx`, `ResumeBulletAudit.jsx`, and existing saved reports.

---
*Audit completed. Ready for V3.3 specification and phased execution.*
