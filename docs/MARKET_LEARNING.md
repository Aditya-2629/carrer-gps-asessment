# Continuous Improvement & Versioned Learning Architecture

## 1. Principles of Self-Improvement

In Career GPS Resume Agent V3:
> **"Self-learning" means versioned, evidence-driven improvement, NOT automatic model retraining or uncontrolled prompt mutation.**

Under no circumstances does production observation or user interaction automatically alter:
- System prompts
- Heuristic weights
- Taxonomy mappings
- Validation rules

All modifications follow a disciplined human-in-the-loop review workflow:
```text
Production Analyses & User Feedback
                  │
                  ▼
       Learning Signal Capture
  (Versioned Observation Tracking)
                  │
                  ▼
       Aggregation & Confidence
      (Threshold & Sample Sizing)
                  │
                  ▼
         Admin Review Queue
                  │
       ┌──────────┴──────────┐
   Approved?               Rejected?
       │                       │
      YES                      NO
       │                       │
  Versioned Config        Archived
  & Prompt Release
```

---

## 2. Learning Signal Data Model (`LearningSignal`)

Observations are recorded with supporting evidence, confidence metrics, and sample counts:

```javascript
{
  signalType: "MARKET_SKILL_TREND", // "MARKET_SKILL_TREND" | "MARKET_RESPONSIBILITY_TREND" | "REPORT_QUALITY_SIGNAL" | ...
  roleKey: "software-engineer",
  experienceBucket: "6-8",
  signal: "Kafka",                  // Normalized skill or pattern
  observationCount: 18,             // Number of independent times observed
  supportingEvidence: [
    { sourceJobId: "apify_001", company: "DataFlow", context: "High frequency across 18/20 sampled JDs" }
  ],
  confidence: 0.92,                 // Calculated confidence score
  source: "market_analysis",        // "market_analysis" | "user_feedback" | "recruiter_review"
  status: "candidate",              // "candidate" | "reviewed" | "approved" | "rejected"
  firstObservedAt: ISODate("..."),
  lastObservedAt: ISODate("..."),
  version: 1
}
```

---

## 3. Supported Signal Types

1. `MARKET_SKILL_TREND`: Emerging or high-velocity technologies appearing across multiple market scrape cycles.
2. `MARKET_RESPONSIBILITY_TREND`: Evolving expectations (e.g. system design ownership, security compliance in full-stack roles).
3. `REPORT_QUALITY_SIGNAL`: Candidate or reviewer feedback on report utility.
4. `CLASSIFICATION_ERROR`: Mappings where role taxonomy or experience bucket required correction.
5. `RECOMMENDATION_FEEDBACK`: Tracking candidate satisfaction on specific recommended improvements.
6. `HUMAN_REVIEW_SIGNAL`: Structured notes submitted by expert human recruiters.

---

## 4. Prompt & Model Versioning Contract

To ensure complete reproducibility and measure improvement across iterations, every report records full provenance metadata:

```json
{
  "agentVersion": "3.0",
  "analysisVersion": "2.2",
  "marketProfileVersion": "market-profile-v1",
  "marketBucketVersion": 1,
  "promptVersion": "resume-synthesis-v2.5",
  "model": "gpt-oss-120b",
  "provider": "openai"
}
```

### Cache Invalidation Guarantee (Section 25)
The orchestrator incorporates `marketBucketVersion` directly into the deterministic analysis cache fingerprint:
```text
resumeHash + targetJdHash + targetRole + bucketKey + marketBucketVersion
```
Whenever an admin updates the JD library and activates a new bucket version:
- `marketBucketVersion` increments (e.g. `1` → `2`).
- Existing cached analyses automatically miss, ensuring candidates immediately receive evaluations grounded in fresh market data.
- Benchmark evaluations utilize `cacheMode: 'bypass'` to guarantee zero cache interference.
