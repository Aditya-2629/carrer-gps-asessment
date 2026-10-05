# Crafture Multi-Agent Platform — Master Blueprint (Phase-wise)

> **Status:** Approved architecture plan (2026-10-05). This document breaks the
> multi-agent platform into build phases, each mapped to researched best
> practices from Anthropic's *Building Effective Agents*, OpenAI/Google
> structured-output guidance, and 2026 AI-UX loading/streaming patterns.
>
> **North star:** every phase must move three needles —
> 1. **Platform feel** (instant, transparent, trustworthy like a big SaaS)
> 2. **Marginal agent cost → ~1 day** (shared kernel does the heavy lifting)
> 3. **Quality is measurable** (judge scores, golden tests, cost per report)

---

## Research foundation (what we follow and why)

| Source | What we adopt |
|---|---|
| [Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) | **Workflows > autonomous agents** for our use case (fixed pipeline = predictable cost/latency). Patterns adopted: parallelization (sectioning), routing (chat), evaluator-optimizer (judge agent), orchestrator-workers (report assembly). "Start simple", call APIs directly (no LangGraph — our Express stack + `llmGateway` already does this; frameworks add abstraction that obscures prompts), invest in ACI (our serializer/validator discipline is exactly this). |
| [Structured outputs guides](https://agenta.ai) ([2026 deep-dive](https://collinwilkins.com), [Humanloop](https://humanloop.com)) | API-native JSON mode everywhere (`responseFormat: 'json_object'` — already in gateway), schema validation **with a bounded retry loop** (retry cost/latency budget per agent, not infinite), `jsonrepair` fallback already present, per-provider handling in one place (gateway). |
| [Orchestration build-vs-buy](https://www.augmentcode.com) / [LangGraph in production](https://www.alphabold.com) | Custom orchestrator + Mongo-backed job records (fits strict-JS stack, Render deployment, no Redis dependency on day one). Supervisor pattern, not swarm. |
| [AI loading UX patterns](https://uxpatterns.dev/patterns/ai-intelligence/ai-loading-states), [skeleton loaders](https://www.aiuxplayground.com/pattern/skeleton-loader/), [Telerik AI loading](https://www.telerik.com/blogs/loading-ui-ux-patterns-ai-applications) | Match loading feedback to wait duration; **skeletons shaped like the incoming output** (scorecard/audit card ghosts); transparent "thinking" states; perceived performance > raw speed; progressive disclosure; `prefers-reduced-motion` respected everywhere. |

---

## Target architecture (end state)

```
                        ┌──────────────────────────────┐
                        │   CLIENT (React 19 + Vite)   │
                        │  SSE progress · skeletons ·  │
                        │  framer-motion reveals       │
                        └──────────────┬───────────────┘
                                       │ POST /api/report-jobs + GET /stream
                        ┌──────────────▼───────────────┐
                        │   ORCHESTRATOR (supervisor)  │
                        │  job state · retries · cache │
                        │  concurrency · events        │
                        └──┬─────────┬─────────┬───────┘
              parallel    │         │         │
        ┌─────────────────▼──┐ ┌────▼─────┐ ┌─▼──────────┐
        │ RESUME AGENT v3.1  │ │ LINKEDIN │ │ ASSESSMENT │
        │ core/kernel        │ │ AGENT v1 │ │ (Atlas)    │
        └─────────┬──────────┘ └────┬─────┘ └─┬──────────┘
                  │                 │         │
              [scorecard]      [scorecard]  [scores]
                  └────────┬────────┴─────────┘
                    ┌──────▼──────────┐   ┌──────────────┐
                    │ OVERALL (Atlas) │   │ JUDGE AGENT   │
                    │ narrative+plan  │   │ rubric + gate │
                    └──────┬──────────┘   └──────┬───────┘
                           │                     │
                    ┌──────▼─────────────────────▼──────┐
                    │  AgentRun store (Mongo)            │
                    │  cost · latency · judgeScore · v   │
                    └───────────────────────────────────┘
```

---

## PHASE A — Shared Agent Kernel (`backend/agents/core/`)  ← START HERE

**Goal:** one shared skeleton so every agent is config + analyzers + prompts.
**Best practice applied:** Anthropic's "invest in shared infrastructure, keep
agents simple"; direct-API discipline (extend `llmGateway`, don't add a framework).

**Build:**
1. `core/BaseAgent.js` — lifecycle: `validateInput → prepare → run → validate →
   scorecard → persist AgentRun`; emits progress events.
2. `core/agentContract.js` — per-agent manifest: `{ id, name, version, persona,
   model purpose, retryPolicy {maxRetries, budgetUsd}, outputSchema }`.
3. `core/structuredOutput.js` — bounded validate→retry loop (2 attempts max,
   then jsonrepair; hard-stop on budget) wrapping gateway calls.
4. `core/promptRegistry.js` — every prompt versioned + hash-stamped; prompt
   text lives beside agent, never inline in controllers.
5. Migrate Resume + LinkedIn agents onto kernel (behavior-neutral, verified by
   existing golden tests).

**UX:** none yet (backend only). **Accept:** both agents produce byte-identical
outputs pre/post migration on fixtures.

---

## PHASE B — Orchestrator + AgentRun persistence

**Goal:** controllers stop coordinating agents; a supervisor owns execution.
**Best practice:** orchestrator-workers pattern; caching by input hash
(`llmInputHash` exists); AgentRun records give cost/quality analytics.

**Build:**
1. `agents/orchestrator.js` — takes CandidateBundle (resume bytes, linkedin,
   answers), builds the execution plan, runs agents in parallel with
   concurrency limit + per-agent timeouts, assembles `ReportBundle`.
2. `models/AgentRun.js` (Mongo) — `{ agent, version, inputHash, status,
   output, cost, latencyMs, judgeScore, error, createdAt }`.
3. Cache: `inputHash` lookup before any LLM call (dedupe within 7 days).
4. Move `generateReport` body → orchestrator call (controller = 10 lines).
5. Overall Agent consumes the bundle (Atlas prompt gains agent outputs).

**Accept:** report generated for a repeat upload hits cache (<1s); AgentRun
rows exist per agent with cost/latency; latency ≤ current baseline.

---

## PHASE C — Async jobs + streaming progress (the "big SaaS feel")

**Goal:** kill the 40–80s blind wait; make 60s feel like 15s.
**Best practices:** skeleton screens shaped like incoming output; progress
feedback matched to wait time; transparent states ([uxpatterns.dev](https://uxpatterns.dev/patterns/ai-intelligence/ai-loading-states), [aiuxplayground](https://www.aiuxplayground.com/pattern/skeleton-loader/)).

**Build:**
1. Job model + worker loop (Mongo-backed; BullMQ/Redis only if Render adds
   Redis — decision deferred).
2. `GET /api/report-jobs/:id/stream` (SSE) — events: `agent_started`,
   `agent_progress`, `agent_done`, `report_ready`.
3. **AnalysisLoader v2 (the showpiece):**
   - Horizontal **agent pipeline**: Maya (Resume) → LinkedIn → Atlas (Overall),
     each with an SVG avatar; states queued → pulsing "working" → spring
     check-in (framer-motion `layout` + `AnimatePresence`).
   - Live per-agent one-liners streamed from SSE ("Scanning 11 bullets for
     weak ownership…").
   - **Shape-matched skeletons** behind the pipeline: ghost scorecard ring +
     ghost audit rows that fill in when the report lands.
   - Score ring count-up + checklist rows stagger via GSAP/framer-motion on
     report reveal (both already in the stack).
4. All animations gated by `prefers-reduced-motion`.

**Accept:** user sees per-agent live status; report sections animate in on
arrival; no spinner-only waits >3s anywhere.

---

## PHASE D — Judge agent + per-agent eval harness

**Goal:** quality drift becomes impossible to miss.
**Best practice:** evaluator-optimizer loop with a bounded retry budget;
golden fixtures per agent (resume agent already has this — generalize).

**Build:**
1. `agents/judge/judgeAgent.js` — cheap fast model scores every report on:
   tone warmth, specificity (evidence-citation rate), fabrication risk,
   US-norm correctness, structure. Outputs 0–10 + flags.
2. Orchestrator policy: judgeScore < 7 → one regeneration with judge notes
   injected; second fail → ship with warning flag (never block the user).
3. `agents/core/harness.js` — golden-fixture regression runner generalized
   from `runBenchmarkV3.js`; runs per prompt-version bump.
4. Prompt A/B: registry keeps 2 variants live; harness compares.

**Accept:** every AgentRun has a judgeScore; regression suite runs in CI-style
script; no prompt change ships without a benchmark diff.

---

## PHASE E — Feedback loop + Admin agent analytics

**Goal:** learn which agent findings users act on; surface platform health.
**Best practice:** measurable quality loops; big-SaaS observability.

**Build:**
1. 👍/👎 on every issue/check card → `FindingFeedback` collection.
2. Admin page: per-agent cost, latency p50/p95, judge scores, acceptance
   rate, cache hit rate (reads AgentRun + feedback).
3. Weekly "worst finding" review hook into prompt iteration.

**Accept:** admin can answer "which agent earns its cost?" in one screen.

---

## PHASE F — Router chat + next agents

**Goal:** chat becomes the front desk; new agents land fast.
**Best practice:** routing pattern (Anthropic) — classify question → load that
agent's context; cite report sections with deep links.

**Build:**
1. Chat router: intent → agent context (resume findings / linkedin findings /
   roadmap) + section deep-link buttons in replies.
2. New agents via kernel (each ≈ 1 day): **Interview Agent** (question bank
   from resume evidence), **Cover Letter Agent** (from strongest strengths),
   **Skill-Gap Agent** (skills-without-evidence patterns).
3. Each new agent ships with: manifest, golden fixture, judge rubric line,
   scoreboard card, report section, nav pill.

**Accept:** a new agent goes from idea → live section in ≤ 2 days.

---

## Animation & illustration standards (all phases)

- **Library policy:** framer-motion (reveals, layout, presence) + GSAP
  (ring count-up, timeline draw) — both already installed; **no Lottie** until
  a need is proven (bundle size + consistency).
- **Agent identity:** simple geometric SVG marks per agent (not stock art) —
  Maya = document/pen motif, LinkedIn Agent = node-graph motif, Atlas = compass.
- **Motion rules:** reveal ≤ 400ms, stagger 40–60ms, spring check-ins,
  counters ease-out 800ms; everything honors `prefers-reduced-motion`.
- **Skeletons always match final shape** — never generic spinners for >1s waits.
- Dark/light: all agent components theme-token driven (`var(--…)`) — proven in
  `ResumeDeepDiagnosis`.

## Cost & model routing (per agent, via registry)

| Agent | Model class | Rationale |
|---|---|---|
| Resume/LinkedIn synthesis | Gemini Flash (now) → Cerebras gpt-oss-120b when billing added | quality per $ |
| Judge | cheapest capable (flash/small) | high volume, rubric task |
| Chat router | cheapest capable | classification task |
| Atlas narrative | Flash | long-context, cheap |
| Embeddings/RAG | existing KB engine | unchanged |

## Immediate next step
**Phase A + Phase B together** (one refactor), then **Phase C** for the visible
"wow". Every phase ends committed, benchmarked, and browser-verified.
