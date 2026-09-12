# Developer Guide & Rules of Engagement

Welcome to the **Crafture Career GPS** codebase. This guide outlines conventions, architectural rules, and standard workflows for both human software engineers and AI coding agents.

---

## 1. Non-Negotiable Rules of Engagement

1. **Strictly JavaScript + JSX**:
   - **DO NOT** create `.ts` or `.tsx` files.
   - **DO NOT** install `@types/*` or TypeScript compiler toolchains.
   - All modules use standard ECMAScript Modules (`import` / `export`).
2. **Preserve Existing Technology Stack**:
   - Do not swap libraries (e.g. replacing Zustand with Redux or replacing Vite with Webpack).
   - Do not rewrite functional code simply for personal stylistic preference.
3. **Dual-Layer Contract**:
   - Never alter a question's user-facing wording in `assessmentSteps.js` without ensuring its machine-readable `SEMANTIC_REGISTRY` entry remains accurate and unambiguous.
   - The AI must never be forced to deduce meaning from creative or metaphorical language.
4. **Theme & CSS Tokens**:
   - All styling must use CSS custom properties defined in `src/index.css`:
     - Background: `var(--surface-base)` (`#08090D`)
     - Glass Surface: `var(--surface-glass)` (`rgba(15, 17, 26, 0.75)`)
     - Accent: `var(--accent-indigo)` (`#6366F1`)
     - Secondary: `var(--accent-violet)` (`#8B5CF6`)
     - Emerald Growth: `var(--neon-emerald)` (`#10B981`)
     - Cost / Blocker Rose: `var(--crimson-rose)` (`#F43F5E`)
   - Avoid hardcoded ad-hoc hexadecimal colors in JSX elements.

---

## 2. How to Add or Modify an Assessment Question

When introducing or modifying a question in the 31-step assessment, follow this 4-step checklist:

### Step 1: Define Experience & Creative Wording (Layer 1)
In [`src/lib/assessmentSteps.js`](../src/lib/assessmentSteps.js), locate the `EXPERIENCE` dictionary and configure the chapter scene:
```javascript
32: {
  scene: 'negotiation-table',
  sceneTitle: 'Salary Negotiation Readiness',
  chapter: 'Build Your Route',
  title: 'When an offer lands on the table, do you counter or accept?',
  helper: 'Negotiating the initial offer yields an average $8,000–$15,000 base salary increase.',
  visual: 'handshake',
  icon: '🤝',
}
```

### Step 2: Define Machine-Readable AI Semantics (Layer 2)
In the same file, define the exact semantic metadata within `SEMANTIC_REGISTRY`:
```javascript
salaryNegotiation: {
  field: 'salaryNegotiation',
  semanticKey: 'salary_counter_offer_readiness',
  questionIntent: 'Measure candidate comfort and playbook readiness to counter-offer base salary upon receiving an initial job offer.',
  answerType: 'category',
  possibleValues: ['Always Counter', 'Accept As-Is', 'Unsure'],
  interpretationRules: 'Candidates who accept as-is leave substantial equity and compensation on the table; requires script rehearsal.'
}
```

### Step 3: Register in Step Array
Add the step object into `RAW_STEPS` with its input type (`radio`, `quantitative`, `text`, `checkbox`, etc.).

### Step 4: Verify Payload Compilation
`buildSemanticAssessmentPayload(formData)` will automatically couple the candidate's answer with the semantic registry entry and transmit it to the backend.

---

## 3. Local Development Workflows

### Starting Development Servers
Use two separate terminal sessions:

```bash
# Terminal 1 — Backend API (Express + Nodemailer + Gemini)
cd backend
npm run dev

# Terminal 2 — Frontend Client (Vite)
npm run dev
```

The frontend will run on `http://localhost:5173` (or `http://localhost:5174` if port 5173 is occupied).

### Automated Testing & Linting
```bash
# Verify backend files syntax
node --check backend/server.js
node --check backend/controllers/assessmentController.js
node --check backend/utils/geminiPrompt.js

# Verify frontend production bundle builds cleanly
npm run build
```

---

## 4. Rapid Testing via Quick Fill
During local development, you do not need to manually fill all 31 steps:
- Click the **"🎲 Random Pick"** button on individual steps to populate random valid inputs.
- Or click the **"Quick Fill Demo Answers"** button in the top progress header to automatically populate all answers and jump directly to the final submission step.
