# Resume Specialist Agent — V1 Architecture

The **Resume Specialist Agent** is an isolated, provider-neutral intelligence module designed to evaluate candidate resumes with deep, human recruiter-grade reasoning without relying on RAG, static Knowledge Bases, or arbitrary heuristic checklists.

---

## 1. Core Architecture

```
HTTP Request (POST /api/resume-agent/evaluate)
   ↓
Document Parser (PDF, DOCX, Plain Text via pdf-parse & mammoth)
   ↓
Canonical Resume Normalizer (Assigns deterministic stable IDs: exp_001_b01, etc.)
   ↓
Resume Expert Prompt (Recruiter persona, evidence-first constraints, no RAG)
   ↓
LLM Gateway (Single provider-neutral abstraction)
   ↓
OpenRouter API (or fallback provider)
   ↓
Structured Output Validation & Evidence Fidelity Checker
   ↓
Telemetry Logger (Sanitized, zero candidate PII)
   ↓
Client Response
```

---

## 2. Key Principles

1. **Provider Neutrality**: The agent logic does not import or know about OpenRouter, Gemini, or Grok SDKs. All requests flow through `llmGateway.generate()`.
2. **Deterministic Stable IDs**: Every experience bullet and project item receives an immutable ID (e.g. `exp_001_b01`) allowing exact evidence verification and future UI card hover-linking.
3. **No RAG Injection**: The agent reasons purely from the candidate's canonical resume, target role, and system instructions.
4. **Evidence-First Diagnosis**: Every reported issue must cite verbatim `originalText` and the exact `bulletId` from the parsed resume.
5. **No Hallucinated Metrics**: The validator checks whether suggested rewrites introduce fabricated metrics (`%`, `$`, multiplier), stripping out invalid edits.
6. **No Invented Dashboard Scores**: `dashboard.score` and dimensions are deliberately kept `null` in V1 until a deterministic scoring engine is attached.
7. **Candidate Privacy**: Models marked `allowPersonalData: false` (e.g. `thinkingmachines/inkling-small:free`) reject real resumes unless explicitly flagged as `isSynthetic: true`.

---

## 3. Endpoints

- `POST /api/resume-agent/evaluate`
  - Accepts `multipart/form-data` with `resume` file and `targetRole`.
  - Also accepts JSON payload with `resumeText`, `targetRole`, and optional `model`.
