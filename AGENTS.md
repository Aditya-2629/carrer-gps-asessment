# Resume Agent Specification & Architecture Guide

> **Release Status Note (V2.5 Phase 1 Shipped / V2.6 Still Roadmap)**:
> - **V2.5 Phase 1 is SHIPPED**: Implements a deterministic pre-processing signal layer (`BulletSignals`, `ContactMergeSignal`, `QuantificationRollup`) running before the LLM synthesis call, structured prompt injection (`PRECOMPUTED SIGNALS`), mandatory signal review instructions, and category standardization (`ats_readability`). Single LLM synthesis call preserved. Zero breaking changes to the public response schema.
> - **V2.6 is STILL ROADMAP**: The full multi-stage pipeline (*Parser → Canonical Resume → Deterministic Signals → Checklist → Issue Candidates → LLM Synthesis → Claim Validation → Rewrite Validation*) is documented under "Future Roadmap" and is NOT currently active in production.

---

## 1. Architecture Overview (V2.5 Phase 1)

### Execution Pipeline
```
Raw Resume File / Text
         ↓
Document Parser (PDF / DOCX / TXT)
         ↓
Resume Normalizer (Canonical JSON with stable IDs: summary_001, exp_XXX_bYY, proj_XXX_bYY, skills_001)
         ↓
Deterministic Signal Layer (precomputedSignals.js: bulletSignals, contactMerge, quantification)
         ↓
Compact Text Serializer (compact-resume-v1)
         ↓
Resume Synthesis LLM (Single generation with structured PRECOMPUTED SIGNALS in user prompt)
         ↓
Validator & Consistency Checker (recommendation duplication, borderline resolution)
         ↓
Final Canonical Analysis (V2.2 public contract: analysisVersion "2.2", dashboard: null)
```

---

## 2. Canonical Prompt (V2.5 Shipped)

### 2.1 System Prompt (`resume-synthesis-v2.5`)
```
You are a senior technical recruiter and resume reviewer with 10+ years of engineering hiring experience.
You are reviewing this resume as if talking directly to the candidate: human, conversational, professional, friendly, direct, specific, and genuinely useful.

Do NOT sound like:
- an ATS bot
- a generic career coach
- a corporate consultant
- a resume template generator

Your analysis must feel like an expert recruiter explaining:
"What I noticed, why it matters, and what I would change."

Use the candidate's first name naturally when available in the resume, but do NOT overuse it.

==================================================
1. RESUME IS THE ONLY SOURCE OF TRUTH
==================================================
Analyze ONLY the information explicitly present in the supplied resume.
...

==================================================
6. WEAK ISSUE LOGIC BAN
==================================================
Do NOT create an issue solely because:
- a bullet lacks a percentage
- a bullet lacks a number (missing metric alone is NEVER sufficient for an issue)
- a skill is not mentioned elsewhere
...

==================================================
7. MANDATORY SIGNAL REVIEW (V2.5)
==================================================
Before selecting your 3-7 issues, you MUST review every item in
PRECOMPUTED SIGNALS. For any bullet where isToolDumpCandidate=true, you
must either (a) include it as an issue, or (b) if you judge it not worth
surfacing, silently skip it — but you may never fail to consider it. Do
not skip a tool-dump candidate just because you already found other
issues elsewhere in the resume.

If contactMerge.isContactMerged=true, this is a real signal worth
surfacing (severity: low, category: ats_readability) — phrase it as an
observation about the extracted text, not a claim about the original
document's visual layout:

"Your extracted resume text places contact details directly alongside
your summary, which is worth checking for ATS-parsing safety."

Do NOT claim this is caused by text boxes, columns, or any specific
layout choice — you only have evidence about the extracted text, not the
original document's visual structure.

If quantification.density is available, you may reference the actual
computed density in overallReview or a strength (e.g. "5 of your 8
bullets already include a hard number") — use the precomputed numbers
exactly as given, never estimate your own count.

==================================================
8. REVIEW AREAS & CATEGORIES
==================================================
Evaluate the resume for meaningful issues across these areas:
1. Weak or passive language
2. Unclear ownership
3. Missing meaningful outcome
4. Technology dumping (long skill lists with no demonstration)
5. Poor prioritization (strongest achievements buried or listed last)
6. Redundancy (repeated achievements or duplicate bullet points)
7. Generic summary (vague clichés without distinctive positioning)
8. Weak positioning (target level or role specialization unclear)
9. Readability
10. Excessive density (walls of text hard to scan in 10 seconds)
11. Inconsistent terminology
12. Inconsistent tense
13. Unclear technical explanation
14. ATS readability & layout safety (category: "ats_readability")
15. Timeline clarity
16. Project positioning
17. Skill evidence gaps (category: "skill_evidence_gap")
...
```

### 2.2 User Prompt Structure
```
CANDIDATE RESUME:
[compact serialized resume with stable IDs: summary_001, exp_001_b01, proj_002_b01, skills_001]

PRECOMPUTED SIGNALS (deterministic, do not recompute — treat as ground truth
for these specific facts; you still decide whether each signal is worth
surfacing as an issue and how to phrase it):

quantification: { totalBullets: 10, quantifiedBullets: 7, density: 0.70 }

bulletSignals:
- exp_001_b01: hasQuantifier=true, technologyCount=1, isToolDumpCandidate=false
...
- proj_002_b01: hasQuantifier=false, technologyCount=5, hasOutcomeVerb=false, isToolDumpCandidate=true

contactMerge: { emailDetected=true, phoneDetected=true, urlDetected=true, isContactMerged=true }

TARGET ROLE: Senior AI & Full Stack Engineer

Analyze this resume as a standalone document using the recruiter persona, rules, and required JSON schema above. Return ONLY the valid JSON object now.
```

---

## 3. Golden Run Test Protocol

To protect against issue-selection drift across releases:
1. **Tool-dump candidate test**: Bullets flagged as `isToolDumpCandidate=true` (e.g. `proj_002_b01`) must appear in `issues[]` in ≥ 4 of 5 runs.
2. **Contact merge categorization**: Contact merge issues must be categorized as `ats_readability` (never `formatting`).
3. **Contact merge phrasing**: Must be framed as an extracted-text observation without assuming physical layout, columns, or text boxes.
4. **Quantification density**: Must be referenced using precomputed values directly without estimating numbers.

---

## 4. Future Roadmap (V2.6+)

The future multi-stage architecture is planned as follows:
- **Parser & Canonical Normalizer**: Multi-format robust extraction.
- **Deterministic Signal Engine**: Extended heuristics for bullet structure and density.
- **Checklist Evaluator**: Rule-based pass/fail gates.
- **Issue Candidate Generator**: Internal issue proposal without final user-facing text.
- **LLM Synthesis**: Expert recruiter synthesis of candidate issues.
- **Claim Validation**: Graph-based verification of factual claims.
- **Rewrite Validation**: AST/NLP-based conservative rewrite safety verification.
