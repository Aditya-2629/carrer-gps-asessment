# Crafture Career GPS V2 — Multi-Agent Intelligence & Processing Pipelines

This document provides an in-depth specification of the specialized autonomous agents, deterministic signal layers, and data processing pipelines operating inside Crafture Career GPS V2.

---

## 1. Resume Agent (Mode C Hybrid Architecture)

The **Resume Specialist Agent** evaluates candidate resumes against target role benchmarks using a **Mode C Hybrid** design that couples deterministic pre-processing heuristics with an expert LLM synthesis pass and deterministic fallback playbooks.

```mermaid
flowchart TD
    RawDoc["Raw Resume File<br/>(PDF, DOCX, or Plain Text)"] --> Parser["Document Ingestion<br/>(pdf-parse / mammoth)"]
    
    Parser --> Normalizer["Resume Normalizer (resumeAgent.normalizer.js)<br/>• Extracts experiences, projects, skills<br/>• Assigns stable IDs: summary_001, exp_001_b01, proj_001_b01"]
    
    Normalizer --> Signals["Deterministic Precomputation (precomputedSignals.js)<br/>• BulletSignals: quantifier, techCount, toolDump<br/>• ContactMerge: email/phone anomaly detection<br/>• QuantificationRollup: totalBullets, density"]
    
    Signals --> CompactSerializer["Compact Text Serializer<br/>(Token-dense AST with stable IDs)"]
    
    CompactSerializer --> SynthesisLLM["Resume Synthesis LLM (resume-synthesis-v2.5)<br/>Injected with PRECOMPUTED SIGNALS & Candidate Context"]
    
    SynthesisLLM --> Checker{"Did LLM rewrite<br/>all weak bullets?"}
    
    Checker -->|Yes| Output["Raw LLM Issues & Rewrites"]
    Checker -->|No| FastLLM["Fast-LLM Batch Pass<br/>(gemini-2.5-flash-lite)"]
    FastLLM -->|Partial Missing| RuleFallback["Deterministic Playbook Fallback<br/>(buildFivePartPlaybookRewrite)"]
    RuleFallback --> Output
    
    Output --> Scorecard["Deterministic Scorecard (resumeScorecard.js)<br/>• Computes 100-pt Score<br/>• Enforces Hard Ceilings (0 quant -> Score <= 5)"]
    
    Scorecard --> DOCX_Pipeline{"Export ATS DOCX?"}
    DOCX_Pipeline -->|Yes| Weaver["Smart Keyword Weaver (smartKeywordWeaver.js)"]
    Weaver --> PyDocx["Native Python Engine (pythonDocxGenerator.py)<br/>Produces Single-Column High-ATS DOCX"]
    DOCX_Pipeline -->|No| Final["Return Standardized Resume Analysis"]
```

### Deterministic Pre-Processing & Stable Identification
Resumes are normalized before prompt synthesis to prevent positional drift and hallucination:
- **Stable IDs**: Every bullet receives a deterministic ID based on role index and bullet sequence:
  - `exp_001_b01`, `exp_001_b02` (First experience entry, bullets 1 and 2)
  - `proj_001_b01` (First project entry, bullet 1)
  - `summary_001` (Professional summary)
- **Precomputed Signal Engine (`precomputedSignals.js`)**:
  - `BulletSignals`: Pre-tags every bullet with boolean flags (`hasQuantifier`, `technologyCount`, `hasOutcomeVerb`, `isToolDumpCandidate`).
  - `ContactMergeSignal`: Detects whether contact metadata (email, phone, URLs) is merged into the body text.
  - `QuantificationRollup`: Pre-calculates exact ratio of quantified bullets ($D = \frac{\text{quantified}}{\text{total}}$).

### Mandatory Signal Review & Synthesis Prompt (`resume-synthesis-v2.5`)
The single LLM synthesis prompt is constrained by strict rules:
- **Ground Truth**: The LLM treats `PRECOMPUTED SIGNALS` as ground truth and is forbidden from re-estimating numbers.
- **Tool-Dump Review**: Every bullet tagged with `isToolDumpCandidate: true` must either be surfaced as an issue or deliberately filtered.
- **Contact Merge Categorization**: Phrased as an observation of extracted text under category `ats_readability` (never claiming visual layout or columns without direct evidence).

### 5-Part Executive Formula Fallback
When the LLM omits rewrites, `buildFivePartPlaybookRewrite` in `backend/agents/resume/scoring/resumeScorecard.js` synthesizes a replacement adhering to the 5-Part Playbook:

$$\text{Rewrite} = \underbrace{\text{Action Verb}}_{\text{Part 1}} + \underbrace{\text{Core Task \& Scope}}_{\text{Part 2}} + \underbrace{\text{Stakeholders \& Methodology}}_{\text{Part 3}} + \underbrace{\text{Operational Metric}}_{\text{Part 4}} + \underbrace{\text{Business Outcome}}_{\text{Part 5}}$$

- **Compound Verb Stripping**: Cleans compound verbal openers (e.g., `"Automate and testing of..."` becomes `"Automated component testing..."`).
- **Domain-Matched Metric Pools**: Detects the bullet's domain from text keywords (`qa`, `frontend`, `backend`, `database`, `devops`, `security`, `ai`, `general`) to rotate contextually appropriate metrics (e.g. test coverage and defect leakage for QA; latency and throughput for backend; Lighthouse and accessibility for frontend).

### Deterministic Rubric Ceilings (`resumeScorecard.js`)
To prevent contradictory praise, the scorecard enforces hard ceilings on the candidate's Experience score:
- If `quantifiedBullets === 0`: `sectionAudit.experience.score10` is capped at $\le 5/10$ with status `warn` (`NEEDS POLISH`) and reason `"0 of N bullets (0%) contain measurable metrics"`.
- If `quantificationRate < 0.5`: Capped at $\le 7/10$ with status `warn`.
- Technology version numbers (e.g., `Java 17`, `Angular 14`, `WCAG 2.1`) and calendar years are explicitly stripped before evaluating metrics.

### Native Python ATS DOCX Generation
Exporting the ATS-optimized resume invokes `backend/services/docxResumeService.js`, which pipes canonical JSON and woven keywords into `backend/services/pythonDocxGenerator.py`. Built using `python-docx`, the generator produces clean, single-column documents with zero text boxes, tables, or parsing traps.

---

## 2. Market JD & JEV Skill Decision Cache

Career GPS aligns candidate skills against real-time live market demand using an automated scraping and classification pipeline.

```mermaid
flowchart TD
    CandidateRole["Target Role & YOE<br/>(e.g., Software Engineer, 6-8 YOE)"] --> Bucket["Resolve Market Bucket<br/>(marketBucketResolver.js)"]
    
    Bucket --> CacheCheck{"Active Snapshot in<br/>JobMarketBucket?"}
    
    CacheCheck -->|Cache Hit & Fresh| Library["Retrieve Verified Skills<br/>& JDs (JobMarketVersion)"]
    CacheCheck -->|Cache Miss or Stale| Scraper["Apify Live JD Scraper<br/>(apifyJdScraper.js)"]
    
    Scraper --> TwoPhase["Two-Phase Ingestion Engine"]
    TwoPhase --> FastCatch["Phase 1: Fast-Catch (10-15 JDs)<br/>Immediate Assessment Response"]
    TwoPhase --> AsyncCatch["Phase 2: Background Enrichment<br/>(60-80 JDs for Market Depth)"]
    
    FastCatch & AsyncCatch --> Clean["Deduplicate & Prune JDs<br/>(deduplicateJds, pruneJdText: 2,200 chars)"]
    
    Clean --> LLM_Extractor["Skill Extractor (llmJdSkillAnalyzer.js)"]
    
    LLM_Extractor --> JEV_Check{"Skill Cached in<br/>SkillDecisionCache?"}
    
    JEV_Check -->|Cache Hit| JEV_Result["Apply Stored Decision<br/>(valid, invalid, contextual)"]
    JEV_Check -->|Cache Miss| JEV_Classifier["JEV Decision Classifier<br/>(typesafe/jev-1.14 via LLMGateway)"]
    
    JEV_Classifier --> SaveCache["Persist in SkillDecisionCache"]
    SaveCache --> JEV_Result
    
    JEV_Result --> Alignment["Keyword Alignment Matrix<br/>• Verified (Resume Experience)<br/>• Skills-Only (Unverified)<br/>• Missing (Market Demand)"]
```

### Two-Phase Scraping Protocol
1. **Phase 1: Fast-Catch (10–15 JDs)**: Fetches an initial snapshot of live postings within 3–5 seconds so the candidate's live assessment does not stall.
2. **Phase 2: Background Enrichment (60–80 JDs)**: Asynchronously ingests broader industry postings to populate comprehensive market frequencies.

### JEV Skill Classification (`jevDecisionClassifier.js`)
Extracted raw terms are passed through TypeSafe JEV (`typesafe/jev-1.14`) to eliminate noise and normalize skill taxonomy:
- **`valid`**: Genuine technical skills, tools, or frameworks (e.g., `PostgreSQL`, `Kubernetes`, `GraphQL`).
- **`invalid`**: Non-technical buzzwords or corporate filler (e.g., `fast learner`, `team player`, `results-driven`).
- **`contextual`**: Broad domain terms requiring explicit experience proof (e.g., `Agile`, `Leadership`).
All decisions are persisted in MongoDB under `SkillDecisionCache` to eliminate repeated LLM spend.

### Automated Hourly Scheduler (`marketAutoScheduler.js`)
A background cron job runs hourly to:
- Identify stale market buckets ($> 7$ days old).
- Trigger background Apify scrapes.
- Execute `runSelfLearningRollup()` to consolidate feedback metrics.

---

## 3. LinkedIn Recruiter Visibility Agent

The LinkedIn Specialist Agent evaluates a candidate's profile through the eyes of an executive technical recruiter looking for inbound search visibility and domain credibility.

```mermaid
flowchart TD
    ProfileInput["LinkedIn Profile URL<br/>(e.g., linkedin.com/in/username)"] --> Dedupe["Concurrency Deduplication<br/>(apifyLinkedInScraper.js)"]
    
    Dedupe --> ApifyScrape["Apify Actor Scrape<br/>(Profile, Headline, About, Roles)"]
    
    ApifyScrape --> Normalizer["LinkedIn Normalizer<br/>(Standardized Candidate Profile AST)"]
    
    Normalizer --> ActivityEngine["Self-Reported Activity Engine<br/>(linkedinActivityEngine.js)<br/>Evaluates post frequency & network reach"]
    
    Normalizer & ActivityEngine --> Scorecard["5-Section Recruiter Scorecard (linkedinScorecard.js)<br/>1. Headline Optimization (/10)<br/>2. About / Summary Narrative (/10)<br/>3. Experience & Proof Alignment (/10)<br/>4. Skills & Endorsements (/10)<br/>5. Thought Leadership & Activity (/10)"]
    
    Scorecard --> Synthesis["LinkedIn Synthesis LLM (linkedinSynthesis.js)<br/>• Strategic Recruiter Diagnosis<br/>• 3 Tailored Headline Rewrites<br/>• Search Keyword Density Deficits"]
    
    Synthesis --> Studio["Headline Studio & Profile Roadmap<br/>(Presented in Tab 3 of Report)"]
```

### Note on Deprecated Public Post Scraping
In Career GPS V1, the agent attempted to scrape public post feeds via Apify actors. In production, this led to frequent rate limits, CAPTCHA blocks, and high failure rates. In V2, **live post scraping is officially deprecated** in favor of candidate self-reported activity signals collected during assessment onboarding and audited deterministically by `linkedinActivityEngine.js`.

### 5-Section Recruiter Rubric
Every profile is scored on a standardized 10-point scale across 5 dimensions:
1. **Headline Optimization**: Keyword density, target role specialization, and proof of domain authority.
2. **About / Summary Narrative**: Narrative arc, technical positioning, and elimination of first-person filler.
3. **Experience & Proof Alignment**: Consistency with resume claims and presence of verifiable achievements.
4. **Skills & Endorsements**: Alignment between top 3 pinned skills and target role job market requirements.
5. **Thought Leadership & Activity**: Engagement frequency and platform visibility to recruiter search algorithms.

### Headline Studio Rewrites
The agent synthesizes three distinct, ready-to-paste headline archetypes:
- **Role Specialist**: Targeted at corporate ATS and recruiters searching for exact keywords.
- **High-Growth Operator**: Focused on scale, metrics, and business outcomes.
- **Technical Architect**: Highlights architectural depth, distributed systems, or specialized domain engineering.

---

## 4. Dynamic Action Plan & Ask Atlas Chatbot

```mermaid
flowchart TD
    subgraph Action_Plan["Dynamic Action Plan Agent (dynamicActionPlanAgent.js)"]
        Inputs["Candidate Profile, Missing Skills,<br/>Funnel Conversion & Bullets"] --> PlanAgent["Action Plan Synthesizer<br/>(14,000ms Timeout)"]
        PlanAgent -->|LLM Success| PlanOutput["Personalized 7-Day Sprint<br/>+ 30/60/90-Day Pathway"]
        PlanAgent -->|Fallback| DetPlan["buildDeterministicActionPlan<br/>• Dynamically injects actual missing skills<br/>• Embeds exact unquantified bullet counts<br/>• Injects referral caps for low-conversion funnels"]
        DetPlan --> PlanOutput
    end

    subgraph Ask_Atlas["Ask Atlas Recruiter Chatbot (chatController.js)"]
        ChatMsg["Candidate Chat Message<br/>(/api/assessment/chat-stream)"] --> Dossier["Pocket Context Dossier (~1,200 tokens)<br/>(Target role, companies, bottleneck phase)"]
        Dossier --> LLM1{"Tier 1 Provider<br/>gemini-2.5-flash-lite"}
        LLM1 -->|Success| StreamSSE["Stream Tokens (SSE)"]
        LLM1 -->|Timeout / 429| LLM2{"Tier 2 Provider<br/>Groq gpt-oss-120b"}
        LLM2 -->|Success| StreamSSE
        LLM2 -->|Timeout / 429| LLM3{"Tier 3 Provider<br/>DeepSeek / OpenRouter"}
        LLM3 -->|Success| StreamSSE
        LLM3 -->|Fail| JsonFallback["Non-Streaming JSON Fallback"]
    end
```

### Dynamic Action Plan Features
- **High-Volume / Low-Callback Guard**: Candidates submitting $\ge 100$ applications with $\le 1.0\%$ callback rates (e.g. 2,000 applications yielding 2 screens) receive explicit mandates in Day 5 and the 30-Day Milestone to halt mass untargeted applications and cap outreach at **15 targeted referrals/week**.
- **Real Missing Skills**: Injects verified market missing skills (e.g. AWS, Kafka, Terraform) directly into Day 1 ATS alignment.
- **Dynamic Recruiter Search Strings**: Produces custom LinkedIn Boolean queries matching candidate tools and target titles:
  ```text
  ("Engineering Manager" OR "Director of Engineering" OR "VP of Engineering") AND ("Software Engineer") AND ("React" OR "Node.js")
  ```

### Ask Atlas Chatbot
- **Context Grounding**: Every prompt is prefixed with a concise ~1,200-token Pocket Dossier containing candidate profile coordinates, primary hiring bottleneck, and top bullet findings.
- **Token Streaming**: Delivers sub-second initial token latency over Server-Sent Events (`/api/assessment/chat-stream`).
- **Resilient Fallback**: 3-tier provider failover ensures conversational continuity even during major AI API outages.

---

## 5. Self-Learning Feedback Loop

Career GPS improves its bullet rewrites and diagnostic accuracy over time using candidate feedback.

```mermaid
flowchart TD
    Candidate["Candidate in Report Dashboard"] --> Action{"User Action on Finding / Rewrite"}
    
    Action -->|Thumbs Up / Accept| Pos["POST /api/feedback<br/>{ rating: 5, accepted: true }"]
    Action -->|Thumbs Down / Reject| Neg["POST /api/feedback<br/>{ rating: 1, accepted: false }"]
    
    Pos & Neg --> Sanitize["PII Stripping & Anonymization"]
    Sanitize --> DB_Feedback["Save FindingFeedback & PromptExample"]
    
    DB_Feedback --> Scheduler["Hourly Scheduler<br/>(marketAutoScheduler.js)"]
    Scheduler --> Rollup["runSelfLearningRollup()"]
    
    Rollup --> Signals["Compute Acceptance Ratios<br/>& Update LearningSignal Records"]
    
    Signals --> Gate{"Quality Filter:<br/>upVotes >= 3 AND<br/>upVotes > downVotes * 2"}
    
    Gate -->|Pass| Vetted["Vetted Few-Shot Example Pool"]
    Gate -->|Fail| Discard["Excluded from Prompt Injection"]
    
    Vetted --> Injection["getDynamicFewShotExamples()<br/>(Injected into future agent prompts)"]
```

### Continuous Quality Improvement
1. **Feedback Collection (`POST /api/feedback`)**: Records rating, category, candidate target role, original bullet, and rewritten bullet.
2. **PII Stripping**: Normalizes role keys (`software-engineer`, `product-manager`), strips candidate names, company references, and personal data.
3. **Statistical Rollup (`runSelfLearningRollup`)**: Runs hourly to calculate acceptance ratios and update `LearningSignal` documents.
4. **Few-Shot Prompt Injection (`getDynamicFewShotExamples`)**: Only examples with strong community validation ($\ge 3$ upvotes and $\text{upvotes} > 2 \times \text{downvotes}$) are injected as few-shot demonstrations into live agent synthesis prompts.
