# Component Catalog — Crafture Career GPS™

This catalog documents the layout, props, and interaction models for all React components in `src/components/`.

---

## 1. Directory Structure

```text
src/components/
├── admin/
│   └── KnowledgeBaseManager.jsx     # RAG document management dashboard
├── assessment/
│   ├── AssessmentShell.jsx          # Wizard shell: progress bar, chapters, buttons
│   └── StepRenderer.jsx             # Dispatches question step to matching UI input
├── gate/
│   ├── EmailStep.jsx                # Step 1 of Gate: Email capture & validation
│   ├── GatePhase.jsx                # Gate container & state toggle (email vs OTP)
│   └── OTPStep.jsx                  # Step 2 of Gate: 6-digit verification code
├── loading/
│   └── AnalysisLoader.jsx           # Animated radar & analysis message sequence
├── report/
│   ├── CareerHealthBreakdown.jsx    # Radar chart & 4 category diagnostic cards
│   ├── CareerJourneyPhases.jsx      # Interactive 5-phase career progression line
│   ├── CriticalIssues.jsx           # Top 3 high-impact bottlenecks & action items
│   ├── FunnelLeakDiagram.jsx        # Step-down funnel from Applications to Offers
│   ├── GoalRoadmapPath.jsx          # 4-Week strategic sprint roadmap
│   ├── HeroScore.jsx                # Overall Career Health Score display & badge
│   ├── MissionBoard.jsx             # Gamified XP missions & impact ratings
│   ├── RejectionDonutChart.jsx      # Donut distribution of rejection root causes
│   ├── ReportDashboard.jsx          # Executive report layout & GSAP orchestrator
│   ├── ReportHeaderCard.jsx         # Candidate summary card with PDF export trigger
│   ├── ResumeAIBreakdown.jsx        # Deep ATS inspection, keyword gaps, and critique
│   ├── RiskHeatMap.jsx              # Matrix of immigration, market, and skill risks
│   └── ToolStack.jsx                # Curated software recommendations (e.g. Jobscan)
└── ui/
    ├── CheckboxGroup.jsx            # Multi-select card list with icons & animations
    ├── FileUpload.jsx               # Drag-and-drop resume uploader with PDF parsing
    ├── NumberNAInput.jsx            # Numerical input with "Not Applicable" fallback
    ├── PhoneInput.jsx               # Formatted US/International telephone input
    ├── QuantitativeInput.jsx        # Week/Month cadence switcher, presets, live math
    ├── RadioGroup.jsx               # Single-choice interactive selection cards
    ├── TextInput.jsx                # Standard single-line text field
    └── TextareaInput.jsx            # Multi-line expandable text area
```

---

## 2. Assessment Wizard Components

### `AssessmentShell.jsx`
- **Location**: `src/components/assessment/AssessmentShell.jsx`
- **Props**: None (reads from `useAppStore.js`).
- **Features**:
  - Cosmic glass header displaying current Chapter (1 through 5) and progress percentage.
  - Back and Skip / Continue navigation buttons with keyboard shortcuts (`Enter` to advance).
  - Quick-fill development button ("🎲 Random Pick") for rapid testing and QA.
  - Responsive layout constrained to `max-w-2xl` with micro-animations on question transitions.

### `StepRenderer.jsx`
- **Location**: `src/components/assessment/StepRenderer.jsx`
- **Props**: `{ step, register, control, errors, setValue, watch, onNext }`
- **Responsibilities**:
  - Inspects `step.type` and mounts the corresponding component from `src/components/ui/`.
  - Maps `type === 'quantitative'` to `QuantitativeInput`.
  - Maps `type === 'radio'` to `RadioGroup`.
  - Maps `type === 'checkbox'` to `CheckboxGroup`.
  - Maps `type === 'file'` to `FileUpload`.
  - Displays dynamic instant reaction feedback badges when candidate selects specific visa statuses or answers.

---

## 3. UI Input Components

### `QuantitativeInput.jsx`
- **Location**: `src/components/ui/QuantitativeInput.jsx`
- **Features**:
  - Dual pill switcher: `[ 📅 Per Week ]` vs `[ 🗓️ Per Month ]`.
  - Real-time conversion badge (e.g. *"≈ 23 per week"*).
  - Contextual one-click presets that automatically scale depending on the active timeframe.
  - "None / Not doing this" toggle button for candidates not currently active in that channel.
- **Output Format**:
  ```json
  {
    "raw": "100",
    "period": "month",
    "per_week": 23,
    "per_month": 100,
    "formatted": "100 per month",
    "is_na": false
  }
  ```

### `RadioGroup.jsx` & `CheckboxGroup.jsx`
- Interactive card selection containers styled with glass surfaces, glowing borders on focus, and high-contrast typography.
- Displays custom emojis or Phosphor SVG icons for every option.
- Handles keyboard navigation and auto-advance on single-selection radios where configured.

---

## 4. Executive Report Dashboard Components

### `ReportDashboard.jsx`
- Master dashboard view orchestrating sections with GSAP staggered entrance animations (`gsap.from('.gsap-reveal')`).
- Sticky top navigation bar featuring candidate score badge and one-click consultation call-to-action.
- Dark obsidian cosmic theme with zero eye-strain and high-contrast metrics.

### Key Visual Diagnostic Cards
- **`HeroScore.jsx`**: Radial or metric card displaying score (0-100) and tier badge (*Survival Mode*, *Emerging Contender*, *Market Leader*).
- **`CareerHealthBreakdown.jsx`**: 4-pillar breakdown (Resume, LinkedIn, Outreach, Interviews) with diagnostic bullet points.
- **`FunnelLeakDiagram.jsx`**: Step-by-step conversion funnel highlighting the primary leak where candidate drops out.
- **`ResumeAIBreakdown.jsx`**: ATS score comparison, missing keyword pills, and raw executive recruiter critique from Atlas.
- **`GoalRoadmapPath.jsx`**: Week 1 through Week 4 progressive milestone sprint with hyper-specific tool assignments.
