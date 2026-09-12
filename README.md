# Crafture Career GPS™ — AI-Powered Career Health & ATS Assessment

**Crafture Career GPS** is an enterprise-grade, curiosity-driven career assessment platform that evaluates job seekers across **31 multidimensional criteria** (ATS optimization, LinkedIn visibility, application velocity, outreach strategy, interview readiness, and market positioning).

Built with **JavaScript + JSX**, the platform utilizes a **Dual-Layer Assessment Architecture** that combines conversational visual storytelling for candidates with explicit, machine-readable semantic definitions for downstream analysis by **Atlas** — an AI Executive Strategist powered by **Gemini 3.6 Flash**.

---

## 🧭 System Architecture & Highlights

- **Dual-Layer Architecture**:
  - **Layer 1 (Candidate UX)**: Friendly, curiosity-driven questions with visual scenes, contextual helpers, live timeframe switchers (`Per Week` / `Per Month`), presets, and random fillers.
  - **Layer 2 (AI Semantic Profile)**: Every question maps to a strictly typed, machine-readable entry in `SEMANTIC_REGISTRY` with canonical `field`, `semanticKey`, `questionIntent`, `unit`, `timeframe`, and normalized counts.
- **RAG-Enhanced Career Intelligence**:
  - Dynamic RAG vector/text search engine retrieves hyper-relevant market statistics, visa compliance data, and interview benchmarks from the Knowledge Base to eliminate AI hallucination.
- **Automated Document & Profile Auditing**:
  - Direct PDF/Word resume ingestion parsed into structured JSON via Gemini Multimodal API.
  - Automated LinkedIn profile scraping and signal extraction via Apify actor.
- **Comprehensive Executive Report**:
  - Interactive dashboard featuring Career Health Score, Funnel Leak analysis, Rejection Breakdown, Risk Heatmap, 4-Week Action Roadmap, Gamified Mission Board, and 1-on-1 Consultation Booking.

---

## 📂 Project Structure

```text
├── src/                               # Frontend Client (React 19 + Vite + Tailwind v4)
│   ├── assets/                        # Static brand assets and imagery
│   ├── components/
│   │   ├── admin/                     # RAG Knowledge Base management dashboard
│   │   ├── assessment/                # AssessmentShell, StepRenderer & navigation
│   │   ├── gate/                      # Pre-assessment email & OTP verification
│   │   ├── loading/                   # AnalysisLoader with live status progression
│   │   ├── report/                    # Executive Career Health Report components
│   │   └── ui/                        # Reusable form controls & QuantitativeInput
│   ├── lib/
│   │   ├── api.js                     # Axios HTTP client & semantic payload builders
│   │   ├── assessmentSteps.js         # 31 Steps definitions & SEMANTIC_REGISTRY
│   │   └── randomQuizFiller.js        # Quick-fill testing engine
│   ├── store/
│   │   └── useAppStore.js             # Zustand global application state
│   ├── App.jsx                        # Phase orchestrator & unlinked /admin/kb route
│   ├── index.css                      # Design tokens, obsidian cosmic theme & typography
│   └── main.jsx                       # React DOM root
│
├── backend/                           # Backend API Server (Express + Node.js)
│   ├── controllers/                   # Assessment, OTP, and KnowledgeBase controllers
│   ├── models/                        # Mongoose schemas (User, KBDocument, KnowledgeBase)
│   ├── routes/                        # API route routers
│   ├── utils/                         # Gemini prompt, RAG engine, Apify scraper, Nodemailer
│   └── server.js                      # Express server entry point & CORS configuration
│
├── docs/                              # Centralized Project Documentation
│   ├── ARCHITECTURE.md                # System topology, state flow & dual-layer design
│   ├── ASSESSMENT_SCHEMA.md           # 31 Questions, field catalog & normalization rules
│   ├── API_REFERENCE.md               # Endpoints, payloads, and response contracts
│   ├── AI_PIPELINE.md                 # Gemini 3.6 Flash, RAG engine & Apify integration
│   ├── COMPONENT_CATALOG.md           # Visual breakdown of all UI & layout components
│   ├── DEVELOPER_GUIDE.md             # Rules of engagement & onboarding instructions
│   └── DEPLOYMENT_AND_ENV.md          # Environment variables & Render deployment
│
├── public/                            # Static public web assets
├── render.yaml                        # Blueprint configuration for Render deployment
└── vite.config.js                     # Vite build configuration
```

---

## 📚 Centralized Documentation

For complete technical documentation, refer to the [`docs/`](file:///c:/Users/hp/Desktop/ADITYA/sass/Asessment/docs) folder:

| Document | Description |
| :--- | :--- |
| 🏗️ [**Architecture Guide**](docs/ARCHITECTURE.md) | In-depth breakdown of system design, Zustand state machine, and dual-layer principles. |
| 📋 [**Assessment Schema**](docs/ASSESSMENT_SCHEMA.md) | Complete inventory of all 31 assessment questions, types, units, and `SEMANTIC_REGISTRY`. |
| 🔌 [**API Reference**](docs/API_REFERENCE.md) | Full endpoint contracts, request schemas, status codes, and sample payloads. |
| 🧠 [**AI Pipeline**](docs/AI_PIPELINE.md) | Prompt engineering for "Atlas", RAG knowledge retrieval, and resume/LinkedIn scraping. |
| 🧩 [**Component Catalog**](docs/COMPONENT_CATALOG.md) | Comprehensive UI inventory of forms, interactive charts, and dashboard cards. |
| 🚀 [**Developer Guide**](docs/DEVELOPER_GUIDE.md) | Rules of engagement (Strict JS/JSX), conventions, and step-by-step feature guides. |
| ⚙️ [**Deployment & Environment**](docs/DEPLOYMENT_AND_ENV.md) | Environment configuration (.env), build commands, and Render hosting setup. |

---

## 🛠️ Technology Stack

- **Frontend**:
  - React 19 (`react`, `react-dom`)
  - Vite 8
  - Tailwind CSS v4 (`@tailwindcss/vite`, `tailwindcss`)
  - Zustand 5 (Lightweight client state management)
  - TanStack Query v5 (`@tanstack/react-query`)
  - React Hook Form 7
  - Phosphor Icons React (`@phosphor-icons/react`)
  - Framer Motion 12 & GSAP 3 (Fluid animations)
  - Axios (HTTP client)
- **Backend**:
  - Node.js (ES Modules, `>=20.x`)
  - Express 4
  - MongoDB & Mongoose 8
  - Google Generative AI (`@google/generative-ai` — `gemini-3.6-flash`)
  - Apify Client (`apify-client`)
  - Resend & Nodemailer
  - Multer, pdf-parse, mammoth
- **Language Policy**:
  - **Strictly JavaScript + JSX** (`.js`, `.jsx`).
  - No TypeScript, no `.ts` / `.tsx`, zero unnecessary compile steps.

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- **Node.js** `>=20.x` or **Bun** `>=1.1.x`
- **MongoDB** running locally (`mongodb://localhost:27017`) or a MongoDB Atlas URI
- Google Gemini API Key

### 2. Backend Setup
```bash
cd backend
npm install
# Create .env based on docs/DEPLOYMENT_AND_ENV.md
npm run dev
# Server listens on http://localhost:5000
```

### 3. Frontend Setup
```bash
# In the repository root
npm install
npm run dev
# App is available at http://localhost:5173 (or 5174)
```

---

## ⚖️ License
Proprietary & Confidential — Crafture Career GPS™. All Rights Reserved.
