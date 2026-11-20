# Crafture Career GPS V2 — Architecture & System Lifecycle

This document provides a comprehensive technical overview of the Crafture Career GPS V2 platform architecture, including the end-to-end request lifecycle, real-time SSE streaming protocol, frontend state machine, multi-provider AI Gateway with circuit breaking, security specifications, and codebase structure.

---

## 1. End-to-End Request & SSE Report Lifecycle

The platform uses an asynchronous, non-blocking pipeline for generating deep career assessments. Because high-resolution multi-agent evaluation (resume parsing, deterministic signal extraction, market JD matching, LinkedIn auditing, and dynamic action planning) requires 10–25 seconds of compute, Career GPS decouples request acceptance from processing via background jobs and Server-Sent Events (SSE).

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate (Browser)
    participant Shell as AssessmentShell (React)
    participant OtpModal as OtpGateModal
    participant OtpApi as /api/otp (Express)
    participant JobApi as /api/report-jobs (Express)
    participant SSE as /api/report-jobs/:id/stream (SSE)
    participant Orch as orchestrator.js (Worker)
    participant Gateway as LLMGateway & Router
    participant DB as MongoDB Atlas

    Note over Candidate, Shell: Phase 1: Assessment (14 Steps)
    Candidate->>Shell: Completes 2 Setup Steps + 12 Core Questions
    Shell->>OtpModal: Triggers Security Gate (Email Required)

    Note over Candidate, OtpApi: Phase 2: Security Gate & Auth
    Candidate->>OtpModal: Enters Email & Phone
    OtpModal->>OtpApi: POST /api/otp/send-otp
    OtpApi-->>Candidate: 6-Digit Verification Code (Brevo / Console)
    Candidate->>OtpModal: Enters 6-Digit Code
    OtpModal->>OtpApi: POST /api/otp/verify-otp
    OtpApi-->>OtpModal: 200 OK + HMAC-SHA256 Signed sessionToken

    Note over Candidate, JobApi: Phase 3: Job Submission & Enqueue
    OtpModal->>JobApi: POST /api/report-jobs (sessionToken, resume file, answers)
    JobApi->>DB: Create ReportJob (status: 'PENDING', progress: 0)
    JobApi-->>Shell: 202 Accepted { jobId: "job_xyz" }

    Note over Shell, Orch: Phase 4: Live Progress Streaming & Orchestration
    Shell->>SSE: Connects EventSource('/api/report-jobs/job_xyz/stream')
    JobApi->>Orch: Dispatches runCareerAgents(jobId, payload)
    
    par Parallel Agent Execution
        Orch->>Gateway: Resume Agent (Mode C Hybrid)
        Orch->>Gateway: LinkedIn Agent (Apify Profile Scrape)
        Orch->>Gateway: Dynamic Action Plan Agent
        Orch->>DB: evaluateAssessmentPersona (100-pt Score)
    end

    Orch-->>SSE: Progress 20% (Resume Parsed & Signals Precomputed)
    SSE-->>Shell: Event { progress: 20, stage: "Parsing resume & extracting signals" }
    Orch-->>SSE: Progress 40% (Market JD & Skills Aligned)
    SSE-->>Shell: Event { progress: 40, stage: "Auditing LinkedIn & market alignment" }
    Orch-->>SSE: Progress 70% (Reasoning & Scorecard Computed)
    SSE-->>Shell: Event { progress: 70, stage: "Synthesizing executive recruiter diagnosis" }
    Orch-->>SSE: Progress 90% (Action Plan & Milestones Generated)
    SSE-->>Shell: Event { progress: 90, stage: "Finalizing custom 7-day action sprint" }

    Note over Orch, DB: Phase 5: Report Delivery
    Orch->>DB: Update ReportJob (status: 'COMPLETED', progress: 100, reportData)
    Orch->>DB: Upsert User record with full report & metrics
    Orch-->>SSE: Event { type: 'DONE', status: 'COMPLETED', report: {...} }
    SSE-->>Shell: Receives Complete Report Data
    Shell->>Candidate: Transitions to ReportDashboard (Tabs 1-3, Chat, PDF)
```

---

## 2. Frontend State Machine & Architecture

The frontend client manages candidate state via a reactive 4-phase state machine implemented in Zustand (`src/store/useAppStore.js`).

```mermaid
stateDiagram-v2
    [*] --> ASSESSMENT: User lands on platform

    state ASSESSMENT {
        [*] --> SetupSteps
        SetupSteps --> CoreQuestions: Resume Uploaded & LinkedIn Set
        CoreQuestions --> Review: 12 Diagnostic Steps Complete
    }

    ASSESSMENT --> GATE: Click "Analyze My Career Profile"

    state GATE {
        [*] --> EmailPhoneEntry
        EmailPhoneEntry --> OtpVerification: OTP Sent via Email
        OtpVerification --> TokenIssued: 6-Digit Code Verified
    }

    GATE --> LOADING: POST /api/report-jobs (202 Accepted)

    state LOADING {
        [*] --> SseConnecting
        SseConnecting --> StreamingProgress: EventSource Active
        StreamingProgress --> HydratingReport: Progress 100% / 'DONE'
    }

    LOADING --> REPORT: Report Hydrated in Zustand

    state REPORT {
        [*] --> Tab1_Executive
        Tab1_Executive --> Tab2_ResumeXRay: Select Tab
        Tab1_Executive --> Tab3_LinkedIn: Select Tab
        Tab2_ResumeXRay --> AskAtlasChat: Open Interactive Drawer
        Tab1_Executive --> EditorialPdfExport: Click Download PDF
    }
```

### Key Frontend Components

- **`AssessmentShell.jsx`**: Manages step navigation, progress tracking, and validation across all 14 steps.
- **`StepRenderer.jsx`**: Renders custom UI controls per question (quantitative sliders, pill selects, multi-toggles, and timeframes).
- **`OtpGateModal.jsx`**: Enforces email/phone collection, triggers OTP dispatch, and verifies candidate identity before report processing.
- **`AnalysisLoader.jsx`**: Connects to the SSE stream, renders stage-by-stage progress feedback, and displays interactive curiosity cards during processing.
- **`ReportDashboard.jsx`**: The unified executive reporting view containing:
  - **Tab 1 (Executive Summary & Funnel)**: `ReportHero`, `PrimaryBottleneck`, `FunnelAndConversionSection`, `RoadmapTimeline`, `FinalNextAction`.
  - **Tab 2 (Resume Deep Diagnosis)**: `ResumeScoreCard`, `ResumeDeepDiagnosis`, `ResumeBulletAudit`, `compare-bars`.
  - **Tab 3 (LinkedIn Recruiter Intelligence)**: `LinkedInDeepDiagnosis`, `LinkedInHeadlineStudio`, `RiskHeatMap`.
- **`CareerReportPdf.jsx`**: Editorial multi-page PDF generation engine using `@react-pdf/renderer` with seamless edge-mask illustration banners and strict scoring rubric ceilings.
- **`AskAtlasDrawer.jsx`**: Interactive recruiter career advisor chatbot with streaming token response and context dossier grounding.

---

## 3. AI Gateway & Circuit Breaker Architecture

All AI inference across Career GPS routes through the custom enterprise **AI Gateway** located in `backend/ai/gateway/llmGateway.js` and `backend/ai/gateway/liteLlmRouter.js`.

### Circuit Breaker States & Transitions

The circuit breaker prevents cascade failures, 429 quota exhaustion, and slow timeouts (e.g., waiting 60 seconds on degraded third-party providers) by isolating failing providers.

```mermaid
stateDiagram-v2
    [*] --> CLOSED: Initial System Startup

    state CLOSED {
        description: Normal Operation. All requests routed to primary provider.
    }

    CLOSED --> OPEN: >= 2 Consecutive Failures OR 503/502/Timeout
    
    state OPEN {
        description: Provider Degraded. Requests immediately fast-failover to backup candidate.
    }

    OPEN --> HALF_OPEN: Cooldown Elapsed (45,000ms)
    
    state HALF_OPEN {
        description: Canary Mode. Dispatches 1 probe request to test provider recovery.
    }

    HALF_OPEN --> CLOSED: Canary Request Succeeds
    HALF_OPEN --> OPEN: Canary Request Fails (Reset Cooldown)
```

### Provider Fallback Chain

When an agent initiates a task, `llmGateway` resolves the prioritized provider chain:

```mermaid
flowchart LR
    TaskRequest["Agent Task Request<br/>(e.g., resume_synthesis)"] --> Router{"liteLlmRouter<br/>Available?"}
    
    Router -->|Healthy| P1["OpenRouter<br/>(gemini-2.5-flash-lite)"]
    Router -->|Degraded| P2["Groq<br/>(gpt-oss-120b)"]
    
    P1 -->|Success| Complete["Deliver Validated JSON"]
    P1 -->|Failure / Timeout| P2
    
    P2 -->|Success| Complete
    P2 -->|Failure / Timeout| P3["Google Gemini Direct<br/>(gemini-2.5-flash-lite)"]
    
    P3 -->|Success| Complete
    P3 -->|Failure / Timeout| P4["TypeSafe JEV / DeepSeek<br/>(Fallback Tier)"]
    
    P4 --> Complete
```

### Task-to-Model Routing (`TASK_MODEL_ROUTING`)

Specific tasks are routed to calibrated models to optimize token economics and latency:

| Task Key | Primary Model | Provider | Context & Reasoning |
| :--- | :--- | :--- | :--- |
| `resume_synthesis` | `google/gemini-2.5-flash-lite` | OpenRouter / Groq | Primary resume audit, issues, and executive summary |
| `bullet_rewrites` | `google/gemini-2.5-flash-lite` | OpenRouter / Groq | Fast batch bullet rewrites using Google XYZ syntax |
| `linkedin_synthesis` | `google/gemini-2.5-flash-lite` | OpenRouter / Groq | 5-section LinkedIn audit and headline generation |
| `report_generation` | `google/gemini-2.5-flash-lite` | OpenRouter / Groq | Executive diagnostic copy and bottleneck summary |
| `jev_decision` | `typesafe/jev-1.14` | JEV / OpenRouter | Deterministic market skill classification |
| `bullet_triage_decision` | `typesafe/jev-1.14` | JEV / OpenRouter | Classifies bullet proof level (`strong`, `adequate`, `weak`) |

### Trap Model Filtering (`TRAP_MODELS`)

The gateway explicitly bans known failure-prone or rate-limited models:
```javascript
export const TRAP_MODELS = new Set([
  'gemini-2.5-flash',       // Chronic 429 quota exhaustion in production
  'gemini-2.0-flash',       // Legacy version deprecations
  'gemini-1.5-flash',       // Sub-tier reasoning on complex resume ASTs
  'gemini-1.5-pro',         // High latency (25s+) exceeding SSE timeout budgets
])
```

### Telemetry & Cost Tracking

- **`costTracker.js`**: Calculates exact USD expenditure per provider call using prompt and completion token counts.
- **`llmCache.js`**: Exact-hash caching for repeated identical candidate inputs, yielding 0ms latency and $0.00 cost.
- **`aiTelemetry.js`**: Aggregates latency, provider fallbacks, and error rates exposed via the Admin dashboard.

---

## 4. Security & Hardening Architecture

Career GPS processes sensitive candidate career data and resumes. The backend employs strict security controls:

```mermaid
flowchart TD
    Req["Inbound HTTP Request"] --> LIMIT["Rate Limiters (express-rate-limit)"]
    LIMIT --> PARSE["JSON / URL-Encoded Parser (2MB Limit)"]
    PARSE --> SANITIZE["NoSQL Injection Sanitizer (sanitizeMongoInputs)"]
    SANITIZE --> AUTH{"Route Security Check"}
    
    AUTH -->|Public Route| EXEC["Execute Controller"]
    AUTH -->|Protected Candidate Route| USER_AUTH["userSessionGuard (HMAC-SHA256 Token)"]
    AUTH -->|Protected Admin Route| ADMIN_AUTH["adminAuthMiddleware (JWT Verification)"]
    
    USER_AUTH --> IDOR{"IDOR Check<br/>token.userId == req.params.userId"}
    IDOR -->|Authorized| EXEC
    IDOR -->|Mismatch| REJECT["403 Forbidden"]
    ADMIN_AUTH -->|Authorized| EXEC
    ADMIN_AUTH -->|Unauthorized| REJECT_ADMIN["401 Unauthorized"]
```

### 1. Cryptographic Candidate Sessions (`userAuth.js`)
- Tokens are signed with `HMAC-SHA256` using `SESSION_SECRET` with an embedded payload `{ userId, email, exp }`.
- Valid for 30 days. Protects candidate data without requiring cumbersome passwords.
- **IDOR Protection**: Enforces that the `userId` in the session token matches the target document/report parameter.

### 2. Admin Authentication (`adminAuth.js`)
- Signed JSON Web Tokens (JWT) verified against `JWT_SECRET`.
- Admin endpoints reject missing, expired, or malformed tokens with `401 Unauthorized`.

### 3. NoSQL Injection Prevention
- Middleware runs regex sanitization across `req.body`, `req.query`, and `req.params`.
- Strips any keys containing leading `$` (MongoDB operators like `$gt`, `$ne`, `$where`) and embedded `.` characters.

### 4. Granular Rate Limiting
Configured via `express-rate-limit`:
- **`aiLimiter`**: 15 requests per 15 minutes on AI trigger endpoints (`POST /api/assessment`, `POST /api/report-jobs`, `POST /api/resume-agent`). **GET polling requests are explicitly bypassed** to prevent SSE and status check timeouts.
- **`sendLimiter`**: 3 OTP dispatches per 10 minutes per IP/email.
- **`verifyLimiter`**: 5 verification attempts per 10 minutes.
- **`feedbackLimiter`**: 30 feedback submissions per 15 minutes.

### 5. Memory & Payload Protection
- `express.json({ limit: '2mb' })` and `express.urlencoded({ limit: '2mb', extended: true })`.
- File uploads restricted to PDF, DOCX, and TXT up to 10MB via `multer`.

---

## 5. Codebase Directory Map

```text
carrer-gps-asessment/
├── backend/                               # Node.js/Express Backend
│   ├── agents/                            # Multi-Agent Intelligence Core
│   │   ├── core/                          # Structured JSON output parser
│   │   ├── linkedin/                      # LinkedIn Agent & Activity Engine
│   │   ├── resume/                        # Resume Specialist Agent (Mode C Hybrid)
│   │   │   ├── facts/                     # Deterministic fact normalization
│   │   │   ├── market/                    # JD analyzers, clustering, & JEV
│   │   │   ├── orchestration/             # Mode C Hybrid orchestration & fallbacks
│   │   │   ├── parser/                    # PDF/DOCX parser & normalizer
│   │   │   ├── scoring/                   # Resume scorecard & deterministic rubrics
│   │   │   ├── signals/                   # Precomputed signals (quant, contact, dump)
│   │   │   └── synthesis/                 # Prompt builders & synthesis runner
│   │   └── orchestrator.js                # Parallel multi-agent pipeline coordinator
│   ├── ai/                                # Enterprise AI Gateway Layer
│   │   ├── cache/                         # Deterministic LLM response cache
│   │   ├── config/                        # Model registry & configuration
│   │   ├── gateway/                       # LLMGateway & liteLlmRouter circuit breaker
│   │   └── telemetry/                     # Quota & latency tracking
│   ├── controllers/                       # Express Route Controllers
│   │   ├── assessmentController.js        # Answer saving & report retrieval
│   │   ├── chatController.js              # Ask Atlas streaming chatbot
│   │   └── otpController.js               # Brevo email & OTP verification
│   ├── integrations/                      # Third-party platform connectors
│   │   └── apify/                         # Apify LinkedIn & JD scrapers
│   ├── jobs/                              # Scheduled background tasks
│   │   └── marketJd/                      # Hourly market cache scheduler
│   ├── models/                            # Mongoose Schema Definitions (11 models)
│   ├── routes/                            # Express Endpoint Groupings (8 groups)
│   ├── services/                          # Core backend support services
│   │   ├── docxResumeService.js           # ATS resume DOCX service
│   │   ├── dynamicActionPlanAgent.js      # Dynamic 7-Day & 30/60/90d action plan
│   │   ├── promptExampleService.js        # Self-learning dynamic prompt injection
│   │   ├── pythonDocxGenerator.py         # Native Python python-docx builder
│   │   └── reportGeneration.js            # Unified report synthesizer
│   ├── utils/                             # Utilities, Auth Guards, & Helpers
│   └── server.js                          # Express application entrypoint
├── docs/                                  # Architectural & Technical Documentation
│   ├── AGENTS_AND_PIPELINES.md            # Multi-agent pipelines deep-dive
│   ├── API_AND_MODELS.md                  # Complete API routes & Mongoose models
│   └── ARCHITECTURE.md                    # System architecture & lifecycle (This file)
├── src/                                   # Frontend Client (React 19 + Vite 8)
│   ├── assets/                            # Brand assets, Mascot, & Editorial images
│   ├── components/                        # React UI Components
│   │   ├── assessment/                    # AssessmentShell & StepRenderer (14 steps)
│   │   ├── chat/                          # Ask Atlas interactive drawer
│   │   ├── gate/                          # OtpGateModal security gate
│   │   ├── loading/                       # AnalysisLoader live SSE progression
│   │   ├── pdf/                           # CareerReportPdf (@react-pdf/renderer)
│   │   ├── report/                        # Executive report cards, tabs, & charts
│   │   └── ui/                            # Atoms (QuantitativeInput, Buttons, Cards)
│   ├── lib/                               # Client libraries & assessment definitions
│   │   ├── api.js                         # Axios client & payload normalizer
│   │   └── assessmentSteps.js             # 14 assessment steps & SEMANTIC_REGISTRY
│   ├── store/                             # Zustand State Management
│   │   └── useAppStore.js                 # Global candidate & report state store
│   ├── App.jsx                            # Root application & phase router
│   ├── index.css                          # Tailwind CSS v4 & theme variables
│   └── main.jsx                           # React DOM mount point
├── DESIGN.md                              # V2 Design System & Editorial PDF rules
├── package.json                           # Root dependencies & scripts
└── README.md                              # Main project overview & quickstart
```
