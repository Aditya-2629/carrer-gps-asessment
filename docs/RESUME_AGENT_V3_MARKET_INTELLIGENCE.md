# Resume Agent V3: Market Intelligence Architecture

## 1. Executive Summary

Career GPS Resume Agent V3 extends the deterministic and evidence-grounded resume analysis pipeline with a production-ready **Market Intelligence Layer**.

When a user submits a Resume + Target Job Description, the agent:
1. Reconciles the candidate's background and target role into a canonical **Role × Experience bucket** (e.g. `software-engineer::6-8`).
2. Retrieves **exactly 5 active, validated market job descriptions** from the internal JD library.
3. Automatically kicks off a background Apify refresh if the bucket lacks sufficient JDs or is missing.
4. Generates a compact, deterministic **Market Profile** (skill frequencies, responsibility patterns, seniority indicators) without performing costly multiple LLM calls.
5. Injects the market profile alongside the candidate resume and target JD into a single synthesis call, strictly enforcing that **Target JD has primary priority** and **Market Gap ≠ Skill Deficiency**.
6. Passes the resulting report through claim, ownership, assumption, and language validators before returning the final response.

---

## 2. End-to-End Pipeline

```text
User Input: Resume + Target JD + Target Role
                     │
                     ▼
       Document Parser & Normalizer
                     │
                     ▼
         Market Bucket Resolver
   (Controlled Taxonomy + Experience Years)
                     │
                     ▼
          Internal Bucket Lookup
                     │
         ┌───────────┴───────────┐
   Has 5 Valid JDs?        Fewer than 5 JDs?
         │                       │
        YES                      NO
         │                       │
         │             Enqueue Background Scrape
         │             (Apify Actor + Worker)
         ▼                       │
    Active Version               ▼
     (Top 5 JDs)         Return "refreshing" state
         │               (or standalone analysis)
         ▼
  Deterministic Market Profile Builder
  (Skills, Responsibilities, Seniority)
         │
         ▼
  Market Evidence Grounding & Language Check
  (Target JD Priority + Evidence Gaps)
         │
         ▼
  Resume Agent Synthesis (LLM Call)
         │
         ▼
  Multi-Stage Validation Pipeline
  (Claim + Rewrite + Ownership + Language)
         │
         ▼
  Final Canonical Report with `marketContext`
```

---

## 3. Strict Market Intelligence Guardrails

To protect candidates and ensure high credibility, the system enforces the following core architectural rules:

1. **Target JD Has Absolute Priority (Section 15)**:
   - The candidate's uploaded target JD is the primary source of truth for role requirements.
   - If the target JD requires a technology (e.g., Kafka) but only 2 of 5 sampled market JDs mention it, the report still highlights Kafka as explicitly required by the target JD.
2. **Market Gap ≠ Skill Gap (Section 16)**:
   - The engine never infers that a candidate lacks a skill merely because it is absent from the resume.
   - Findings are framed as evidence gaps:
     > *"AWS appears in 4 of 5 sampled Senior Software Engineer roles, but your current resume does not provide clear direct evidence."*
3. **Strict Language Ban (Section 33)**:
   - Prohibits judgmental, ungrounded, or predatory claims:
     - ❌ *"You don't know Kubernetes."*
     - ❌ *"Kubernetes is mandatory for this role."*
     - ❌ *"You will be rejected without Kafka."*
     - ❌ *"Adding AWS will boost your interview chance by 40%."*
   - Compliant language only:
     - ✅ *"Appears in 4 of 5 sampled JDs."*
     - ✅ *"The target JD explicitly requests..."*
     - ✅ *"The current resume does not provide clear direct evidence of..."*
4. **Ownership Preservation (Section 21)**:
   - No rewrite or recommendation may escalate ownership level (`supported` → `led`, `assisted` → `architected`, `POC` → `production`) without explicit source evidence.
5. **No Per-JD LLM Calls (Section 36)**:
   - Market JDs are normalized and aggregated deterministically into a single compact profile block before the LLM call. Cost and latency remain predictable.

---

## 4. Public API & Response Schema

The V3 engine preserves complete backward compatibility with the existing `analysisVersion: "2.2"` public schema, attaching an optional, non-breaking `marketContext` block:

```json
{
  "success": true,
  "analysisVersion": "2.2",
  "overallReview": "...",
  "strengths": [...],
  "issues": [...],
  "marketContext": {
    "status": "available",
    "role": "Software Engineer",
    "experienceBucket": "6-8",
    "bucketKey": "software-engineer::6-8",
    "marketSampleSize": 5,
    "marketVersion": 1,
    "targetAlignment": [
      {
        "skill": "Kafka",
        "status": "unverified_in_resume",
        "source": "target_jd",
        "message": "Explicitly requested by your target JD, but your current resume does not provide clear direct evidence."
      }
    ],
    "marketEvidenceGaps": [
      {
        "type": "market_evidence_gap",
        "skill": "AWS",
        "marketFrequency": 0.8,
        "frequencyCount": 4,
        "sampleSize": 5,
        "resumeEvidence": "none_found",
        "coveredByTargetJd": true,
        "confidence": "high",
        "message": "AWS appeared in 4 of 5 sampled roles at this experience level, but your current resume does not provide clear direct evidence."
      }
    ],
    "marketStrengths": [
      {
        "skill": "Python",
        "marketFrequency": 1.0,
        "sampleSize": 5,
        "message": "Python is demonstrated on your resume and appeared in 5/5 sampled market JDs for this role."
      }
    ]
  }
}
```

---

## 5. Telemetry & Observability

Every market operation logs structured JSON telemetry via the centralized AI Telemetry system:
- `market_bucket_lookup`
- `market_bucket_hit` / `market_bucket_miss`
- `market_refresh_queued`
- `market_refresh_started`
- `market_refresh_completed`
- `market_refresh_failed`
- `market_profile_generated`
- `market_analysis_started`
- `market_analysis_completed`

**Privacy Guarantee:** Raw resume text, candidate names, contact details, full JD texts, and Apify API tokens are never emitted to logs or traces.
