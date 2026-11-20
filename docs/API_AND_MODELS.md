# Crafture Career GPS V2 — API Routes & Data Models

This document provides an exhaustive reference of all 8 Express route groups, authentication guards, rate limits, and all 11 Mongoose schema models powering Crafture Career GPS V2.

---

## 1. Express API Route Groups

All endpoints are mounted on the base prefix `/api` inside `backend/server.js`.

### 1.1 OTP & Verification Routes (`/api/otp`)
Mounted in `backend/routes/otpRoutes.js`. Handles candidate email verification and cryptographic session token generation.

| Method | Endpoint | Auth | Rate Limit | Description | Payload / Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/otp/send-otp` | None | `sendLimiter` (3/10m) | Generates and sends a 6-digit verification code to candidate email via Brevo | `{ email, name? }` $\rightarrow$ `{ success: true, message: "OTP sent" }` |
| `POST` | `/api/otp/resend-otp` | None | `sendLimiter` (3/10m) | Re-sends code with cooldown timer check | `{ email }` $\rightarrow$ `{ success: true, message: "OTP re-sent" }` |
| `POST` | `/api/otp/verify-otp` | None | `verifyLimiter` (5/10m) | Validates 6-digit code and issues signed HMAC-SHA256 session token | `{ email, otp }` $\rightarrow$ `{ success: true, sessionToken, user: { id, email } }` |

---

### 1.2 Assessment & Report Routes (`/api/assessment`)
Mounted in `backend/routes/assessmentRoutes.js`. Handles candidate onboarding submissions, report downloads, and interactive chat.

| Method | Endpoint | Auth | Rate Limit | Description | Payload / Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/assessment/book-call` | None | None | Records Calendly/HubSpot strategy call booking | `{ email, scheduledAt, name }` $\rightarrow$ `{ success: true }` |
| `POST` | `/api/assessment/save-answers` | None | `aiLimiter` (POST) | Ingests resume file attachment (`multipart/form-data`) and assessment answers | `FormData(resume, answers, targetRole)` $\rightarrow$ `{ success: true, userId }` |
| `POST` | `/api/assessment/generate-report` | None | `aiLimiter` (POST) | Synchronously generates candidate assessment report | `{ userId, answers, resumeText? }` $\rightarrow$ `{ success: true, report }` |
| `GET` | `/api/assessment/generate-report-stream` | None | Bypassed (GET) | Synchronous SSE report generation stream | Query `?userId=...` $\rightarrow$ `text/event-stream` chunks |
| `GET` | `/api/assessment/report` | None | Bypassed (GET) | Retrieves report by query param `?userId=...` | `{ success: true, report }` |
| `GET` | `/api/assessment/report/:userId` | None | Bypassed (GET) | Retrieves candidate report by URL param | `{ success: true, report }` |
| `GET` | `/api/assessment/user/:userId/download-resume-docx` | None | Bypassed (GET) | Streams compiled single-column ATS-friendly `.docx` file | Binary stream `application/vnd.openxmlformats-...` |
| `POST` | `/api/assessment/download-resume-docx` | None | None | Generates ATS `.docx` from supplied JSON payload | Binary stream `.docx` |
| `POST` | `/api/assessment/chat-stream` | None | None | Streams Ask Atlas AI career advisor response via SSE | `{ message, history, dossier }` $\rightarrow$ `text/event-stream` |
| `POST` | `/api/assessment/resume-talk` | None | None | Ask Atlas non-streaming JSON conversation fallback | `{ message, history, dossier }` $\rightarrow$ `{ reply: "..." }` |

---

### 1.3 Asynchronous Report Job Routes (`/api/report-jobs`)
Mounted in `backend/routes/reportJobRoutes.js`. Recommended production ingress for generating comprehensive candidate reports.

| Method | Endpoint | Auth | Rate Limit | Description | Payload / Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/report-jobs` | Optional `userSessionGuard` | `aiLimiter` (POST) | Enqueues background multi-agent assessment run | `FormData` or JSON payload $\rightarrow$ `202 Accepted { success: true, jobId, status: 'PENDING' }` |
| `GET` | `/api/report-jobs/:id` | None | Bypassed (GET) | Polls status, stage progress, and completion payload | `{ jobId, status: 'PROCESSING', progress: 40, stage: "..." }` |
| `GET` | `/api/report-jobs/:id/stream` | None | Bypassed (GET) | Real-time Server-Sent Events stream emitting progress | `text/event-stream` emitting `PROGRESS` & `DONE` events |

---

### 1.4 Resume Specialist Agent Routes (`/api/resume-agent`)
Mounted in `backend/routes/resumeAgentRoutes.js`. Standalone testing and execution endpoints for Mode C Hybrid Resume Agent.

| Method | Endpoint | Auth | Rate Limit | Description | Payload / Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/resume-agent/models` | None | Bypassed (GET) | Returns supported and active models from `MODEL_REGISTRY` | `{ activeModel, availableModels: [...] }` |
| `GET` | `/api/resume-agent/market-context` | None | Bypassed (GET) | Queries market bucket skill frequencies for a target role | Query `?targetRole=...` $\rightarrow$ `{ skills: [...] }` |
| `POST` | `/api/resume-agent/parse-deterministic` | None | None | Parses PDF/DOCX and returns canonical AST with stable IDs | `multipart/form-data` $\rightarrow$ `{ canonicalResume, signals }` |
| `POST` | `/api/resume-agent/evaluate` | `userSessionGuard` | `aiLimiter` (POST) | Executes Mode C Hybrid resume evaluation | `multipart/form-data` $\rightarrow$ `{ success: true, analysis: {...} }` |

---

### 1.5 LinkedIn Specialist Agent Routes (`/api/linkedin-agent`)
Mounted in `backend/routes/linkedinAgentRoutes.js`. Dedicated profile scraper and recruiter headline studio endpoints.

| Method | Endpoint | Auth | Rate Limit | Description | Payload / Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/linkedin-agent/scrape` | None | `aiLimiter` (POST) | Triggers Apify LinkedIn profile scrape | `{ linkedinUrl }` $\rightarrow$ `{ success: true, profileData }` |
| `POST` | `/api/linkedin-agent/scrape-posts` | None | None | Deprecated post scraper (returns self-reported fallback) | `{ linkedinUrl }` $\rightarrow$ `{ posts: [] }` |
| `POST` | `/api/linkedin-agent/headline-rewrites` | None | None | Generates 3 strategic recruiter headline variants | `{ currentHeadline, targetRole, skills }` $\rightarrow$ `{ rewrites: [...] }` |
| `GET` | `/api/linkedin-agent/status` | None | Bypassed (GET) | Health check for Apify integration | `{ status: 'healthy', provider: 'apify' }` |
| `GET` | `/api/linkedin-agent/models` | None | Bypassed (GET) | Model routing options for LinkedIn synthesis | `{ activeModel, models: [...] }` |
| `POST` | `/api/linkedin-agent/evaluate` | `userSessionGuard` | `aiLimiter` (POST) | Executes full 5-section LinkedIn audit | `{ linkedinUrl, answers }` $\rightarrow$ `{ analysis: {...} }` |

---

### 1.6 Self-Learning Feedback Routes (`/api/feedback`)
Mounted in `backend/routes/feedbackRoutes.js`. Collects user ratings, accepted rewrites, and training signal adjustments.

| Method | Endpoint | Auth | Rate Limit | Description | Payload / Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/feedback` | None | `feedbackLimiter` (30/15m) | Records user feedback, upvotes/downvotes, and accepted bullet rewrites | `{ agent, findingId, rating, isAccepted, candidateRole, originalBullet, rewrittenBullet }` $\rightarrow$ `{ success: true }` |

---

### 1.7 Knowledge Base & RAG Routes (`/api/knowledge-base`)
Mounted in `backend/routes/knowledgeBaseRoutes.js`. Provides administrative document storage and vector/text indexing.

| Method | Endpoint | Auth | Rate Limit | Description | Payload / Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/knowledge-base` | None | None | Retrieves root Knowledge Base metadata | `{ kb: {...} }` |
| `POST` / `PUT` | `/api/knowledge-base` | `adminAuthMiddleware` | None | Updates Knowledge Base global settings | `{ settings: {...} }` $\rightarrow$ `{ success: true }` |
| `POST` | `/api/knowledge-base/reset` | `adminAuthMiddleware` | None | Resets KB documents to baseline | `{ success: true }` |
| `POST` | `/api/knowledge-base/upload` | `adminAuthMiddleware` | None | Ingests PDF/TXT reference document (`multipart/form-data`) | `FormData(document)` $\rightarrow$ `{ success: true, docId }` |
| `GET` | `/api/knowledge-base/documents` | None | None | Lists ingested reference documents | `{ documents: [...] }` |
| `GET` | `/api/knowledge-base/documents/:id` | None | None | Fetches document detail and parsed chunks | `{ document: {...} }` |
| `PATCH` | `/api/knowledge-base/documents/:id/toggle` | `adminAuthMiddleware` | None | Toggles active status of an indexed document | `{ success: true, isActive: boolean }` |
| `DELETE` | `/api/knowledge-base/documents/:id` | `adminAuthMiddleware` | None | Deletes indexed document and its chunks | `{ success: true }` |
| `POST` | `/api/knowledge-base/rag-test` | None | None | Runs test query against indexed KB documents | `{ query: "..." }` $\rightarrow$ `{ results: [...] }` |

---

### 1.8 Admin Dashboard Routes (`/api/admin`)
Mounted in `backend/routes/adminRoutes.js`. Protected administration portal for monitoring leads, engine config, market buckets, and telemetry.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/login` | None | Verifies admin password and issues JWT token |
| `GET` | `/api/admin/leads` | `adminAuthMiddleware` | Lists candidate leads with stage, funnel metrics, and contact details |
| `GET` | `/api/admin/leads/stats` | `adminAuthMiddleware` | Returns lead conversion KPIs and funnel aggregates |
| `GET` | `/api/admin/leads/export.csv` | `adminAuthMiddleware` | Exports candidate leads as downloadable CSV |
| `GET` | `/api/admin/leads/:id/dossier` | `adminAuthMiddleware` | Fetches complete candidate diagnostic dossier and AST |
| `PATCH` | `/api/admin/leads/:id` | `adminAuthMiddleware` | Updates candidate CRM status (e.g. `NEW` $\rightarrow$ `CONTACTED` $\rightarrow$ `BOOKED`) |
| `POST` | `/api/admin/leads/:id/override-bullet` | `adminAuthMiddleware` | Manually overrides an AI bullet rewrite with recruiter text |
| `GET` | `/api/admin/health` | `adminAuthMiddleware` | Engine health status, MongoDB state, and provider latencies |
| `GET` | `/api/admin/engine/config` | `adminAuthMiddleware` | Returns active engine configuration and active model assignments |
| `PATCH` | `/api/admin/engine/config` | `adminAuthMiddleware` | Dynamically updates runtime model routing and concurrency |
| `POST` | `/api/admin/engine/roles` | `adminAuthMiddleware` | Registers a new custom role archetype in the taxonomy |
| `POST` | `/api/admin/engine/keys` | `adminAuthMiddleware` | Injects dynamic API keys into the multi-provider pool |
| `POST` | `/api/admin/engine/scrape/:bucketKey` | `adminAuthMiddleware` | Manually triggers live JD scrape for a specific market bucket |
| `GET` | `/api/admin/telemetry/fallbacks-and-errors` | `adminAuthMiddleware` | Telemetry logs showing provider failovers and error rates |
| `GET` | `/api/admin/telemetry/llm-calls-and-quotas` | `adminAuthMiddleware` | Live token usage, USD expenditures, and quota headroom |
| `POST` | `/api/admin/telemetry/reset-cooldowns` | `adminAuthMiddleware` | Clears circuit breaker trips and resets provider cooldowns |
| `POST` | `/api/admin/telemetry/ping-jev` | `adminAuthMiddleware` | Tests TypeSafe JEV connectivity and returns classification latency |
| `GET` | `/api/admin/learning/insights` | `adminAuthMiddleware` | Aggregated few-shot acceptance statistics from `LearningSignal` |
| `GET` | `/api/admin/market-library` | `adminAuthMiddleware` | Lists all indexed market role-experience buckets |
| `POST` | `/api/admin/market-library/refresh` | `adminAuthMiddleware` | Triggers batch refresh across all active market buckets |
| `POST` | `/api/admin/market-library/create-specialized` | `adminAuthMiddleware` | Creates a specialized niche bucket (e.g. `ai-engineer::3-5`) |
| `GET` | `/api/admin/market-library/:bucketKey/skills` | `adminAuthMiddleware` | Fetches skill taxonomy and frequency weights for a bucket |
| `POST` | `/api/admin/market-library/:bucketKey/skills` | `adminAuthMiddleware` | Adds or updates a skill in the market taxonomy |
| `DELETE` | `/api/admin/market-library/:bucketKey` | `adminAuthMiddleware` | Deletes a market bucket and cascades to its versions |

---

## 2. Mongoose Schema Models

Career GPS uses 11 Mongoose models defined in `backend/models/`.

### 2.1 Candidate & Assessment Data

#### `User` (`backend/models/User.js`)
Stores candidate identity, authentication state, raw onboarding answers, and the final synthesized assessment report.
- **Primary Fields**:
  - `email` (String, required, unique, lowercase, trimmed)
  - `otp` (String, default: null)
  - `otpExpiresAt` (Date)
  - `isVerified` (Boolean, default: false)
  - `answers` (Mixed, candidate answers across 14 steps)
  - `report` (Mixed, completed Career GPS report JSON)
  - `resumeUrl` (String, URL or local path to uploaded resume)
  - `resumeFileName` (String)
  - `resumeText` (String, raw extracted text)
  - `crmStage` (String, enum: `['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']`, default: `'NEW'`)
  - `lastActive` (Date)
- **Indexes**: `email: 1` (unique)

#### `ReportJob` (`backend/models/ReportJob.js`)
Manages asynchronous background assessment runs for real-time SSE streaming.
- **Primary Fields**:
  - `userId` (ObjectId, ref: `'User'`)
  - `status` (String, enum: `['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']`, default: `'PENDING'`)
  - `progress` (Number, 0 to 100)
  - `currentStage` (String, human-readable status message)
  - `result` (Mixed, completed report data)
  - `error` (String, default: null)
- **Indexes**: `{ createdAt: 1 }` with `{ expireAfterSeconds: 86400 }` (auto-purged after 24 hours).

---

### 2.2 Market Intelligence & Taxonomies

#### `JobMarketBucket` (`backend/models/JobMarketBucket.js`)
Represents an aggregated role and experience segment (e.g. `software-engineer::6-8`).
- **Primary Fields**:
  - `bucketKey` (String, required, unique, e.g. `'frontend-engineer::3-5'`)
  - `roleKey` (String, required)
  - `experienceBucket` (String, required, e.g. `'0-2'`, `'3-5'`, `'6-8'`, `'9+'`)
  - `status` (String, enum: `['ACTIVE', 'REFRESHING', 'STALE', 'DEPRECATED']`, default: `'ACTIVE'`)
  - `lastScrapedAt` (Date)
  - `totalJdsParsed` (Number, default: 0)
  - `activeVersionId` (ObjectId, ref: `'JobMarketVersion'`)
- **Indexes**: `{ roleKey: 1, experienceBucket: 1 }`, `{ status: 1, updatedAt: -1 }`

#### `JobMarketVersion` (`backend/models/JobMarketVersion.js`)
Immutable snapshot of market job postings and extracted skill distributions for a bucket.
- **Primary Fields**:
  - `bucketKey` (String, required)
  - `version` (Number, required)
  - `jds` (Array of objects: `{ title, company, location, text, cleanedText, url, publishedAt }`)
  - `extractedSkills` (Array of objects: `{ skill, count, frequency, category }`)
  - `sampleCount` (Number)
  - `isArchived` (Boolean, default: false)
- **Indexes**: `{ bucketKey: 1, version: -1 }` (unique), `{ bucketKey: 1, isArchived: 1 }`

#### `SkillDecisionCache` (`backend/models/SkillDecisionCache.js`)
Deterministic cache storing TypeSafe JEV skill classifications to eliminate repeated LLM spend.
- **Primary Fields**:
  - `termLower` (String, required, unique, lowercase, trimmed)
  - `decision` (String, required, enum: `['VALID_SKILL', 'LOCATION', 'BOILERPLATE', 'GENERIC_NOISE']`)
  - `isSkill` (Boolean, required)
  - `canonical` (String, canonical normalized skill name)
  - `reason` (String)
  - `confidence` (Number)
- **Indexes**: `termLower: 1` (unique), `isSkill: 1`

---

### 2.3 Self-Learning & Continuous Improvement

#### `PromptExample` (`backend/models/PromptExample.js`)
Stores high-performing, vetted few-shot demonstration examples for dynamic prompt injection.
- **Primary Fields**:
  - `roleKey` (String, required, e.g. `'software-engineer'`)
  - `sectionType` (String, required, e.g. `'bullet_rewrite'`, `'summary_rewrite'`)
  - `originalText` (String, required)
  - `rewrittenText` (String, required)
  - `explanation` (String)
  - `score` (Number, default: 5)
  - `upVotes` (Number, default: 1)
  - `downVotes` (Number, default: 0)
- **Indexes**: `{ roleKey: 1, sectionType: 1, score: -1, upVotes: -1 }`

#### `FindingFeedback` (`backend/models/FindingFeedback.js`)
Captures raw candidate ratings on specific report findings, bullet rewrites, or recruiter diagnoses.
- **Primary Fields**:
  - `userId` (ObjectId, ref: `'User'`)
  - `agent` (String, required, enum: `['resume', 'linkedin', 'action_plan', 'assessment']`)
  - `findingId` (String, required)
  - `rating` (Number, 1 to 5)
  - `isAccepted` (Boolean, default: true)
  - `userCorrection` (String)
  - `candidateRole` (String)
- **Indexes**: `{ agent: 1, createdAt: -1 }`, `{ userId: 1, agent: 1, findingId: 1 }`

#### `LearningSignal` (`backend/models/LearningSignal.js`)
Aggregated statistical confidence signals produced by `runSelfLearningRollup()`.
- **Primary Fields**:
  - `roleKey` (String, required)
  - `experienceBucket` (String, required)
  - `signalType` (String, required, e.g. `'bullet_pattern'`, `'skill_priority'`)
  - `signal` (String, required)
  - `confidence` (Number, 0.0 to 1.0)
  - `sampleSize` (Number, default: 0)
  - `status` (String, enum: `['ACTIVE', 'OBSOLETE', 'EXPERIMENTAL']`, default: `'ACTIVE'`)
- **Indexes**: `{ roleKey: 1, experienceBucket: 1, signalType: 1, signal: 1 }`, `{ status: 1, confidence: -1 }`

---

### 2.4 Telemetry & Knowledge Base

#### `AgentRun` (`backend/models/AgentRun.js`)
Audits individual agent execution passes, token costs, latencies, and output hashes.
- **Primary Fields**:
  - `agent` (String, required, e.g. `'resume_mode_c'`, `'linkedin_audit'`)
  - `model` (String, required)
  - `provider` (String, required)
  - `durationMs` (Number)
  - `promptTokens` (Number)
  - `completionTokens` (Number)
  - `estimatedCostUsd` (Number)
  - `status` (String, enum: `['SUCCESS', 'FALLBACK', 'FAILED']`)
  - `inputHash` (String)
- **Indexes**: `{ agent: 1, createdAt: -1 }`, `{ inputHash: 1, agent: 1, createdAt: -1 }`

#### `KnowledgeBase` (`backend/models/KnowledgeBase.js`)
Stores metadata and global settings for RAG vector/text stores.
- **Primary Fields**:
  - `name` (String, default: `'Crafture Knowledge Base'`)
  - `description` (String)
  - `version` (String, default: `'2.0'`)
  - `totalDocuments` (Number, default: 0)
  - `lastSyncedAt` (Date)

#### `KBDocument` (`backend/models/KBDocument.js`)
Parsed and chunked reference documents used in background retrieval.
- **Primary Fields**:
  - `title` (String, required)
  - `category` (String, enum: `['MARKET_BENCHMARK', 'INTERVIEW_RUBRIC', 'VISA_GUIDELINE', 'RESUME_GUIDE']`)
  - `fileType` (String, e.g. `'pdf'`, `'txt'`)
  - `rawContent` (String)
  - `chunks` (Array of objects: `{ chunkIndex, text, tokenEstimate }`)
  - `isActive` (Boolean, default: true)
