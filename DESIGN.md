# Career GPS Design System (DESIGN.md)

> **Single Source of Truth** for Career GPS Diagnostic Dashboard interfaces, based on **Impeccable** (Director-Grade Craft) and **UI/UX Pro Max** (Data-Dense Diagnostic Dashboard) standards.

---

## 1. Product & Surface Mode

- **Application:** Career GPS Assessment & Career Intelligence Cockpit
- **Surface Mode:** `Operate` (Diagnostic Dashboard)
  - Prioritizes scanability, high information density, numerical precision, and zero visual friction.
  - Calm, authoritative chrome that gives stage to actionable findings, recruiter feedback, diff rewrites, and conversion telemetry.

---

## 2. Color System & Contrast Floor

Every text element must satisfy WCAG AA contrast (minimum **4.5:1** for body/labels, **3:1** for large headings).

### 2.1 Core Palette (Light Mode — Default)

| Token | Value | Tailwind / CSS Variable | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **Canvas Base** | `#F8FAFC` | `bg-[var(--surface-base)]` | Root background for all cockpit views. |
| **Card Surface** | `#FFFFFF` | `bg-[var(--surface-card)]` | Diagnostic cards, paper sheets, dropdown cards. |
| **Sunken Surface** | `#F1F5F9` | `bg-[var(--surface-sunken)]` | Embedded containers, code snippets, metadata bars. |
| **Strong Surface** | `#EEF2FF` | `bg-[var(--surface-strong)]` | Brand-tinted subtle containers, selected states. |
| **Hairline Border** | `#E2E8F0` | `border-[var(--border-default)]` | Standard 1px card boundaries and dividers. |
| **Primary Text** | `#0F172A` | `text-[var(--text-primary)]` | Headings, titles, high-emphasis text (**15.8:1** contrast). |
| **Secondary Text** | `#334155` | `text-[var(--text-secondary)]` | Descriptive body copy, bullet points (**9.6:1** contrast). |
| **Muted Text** | `#475569` | `text-[var(--text-muted)]` | Micro-copy, metadata, secondary timestamps (**5.2:1** contrast; replaces `text-slate-400`). |

### 2.2 Dark Mode Palette

| Token | Value | Tailwind / CSS Variable | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **Canvas Base** | `#08090D` | `.dark bg-[var(--surface-base)]` | Deep obsidian background. |
| **Card Surface** | `#0F111A` | `.dark bg-[var(--surface-card)]` | Dark elevated card containers. |
| **Sunken Surface** | `#0B0D13` | `.dark bg-[var(--surface-sunken)]` | Sunken input boxes, secondary containers. |
| **Hairline Border** | `rgba(255,255,255,0.08)` | `.dark border-[var(--border-default)]` | Hairline border dividers. |
| **Primary Text** | `#F8FAFC` | `.dark text-[var(--text-primary)]` | Light crisp headings. |
| **Secondary Text** | `#CBD5E1` | `.dark text-[var(--text-secondary)]` | Readable body text. |
| **Muted Text** | `#94A3B8` | `.dark text-[var(--text-muted)]` | Muted metadata and supporting labels. |

### 2.3 Semantic Brand & Diagnostic Accents

- **Brand Accent:** `#6366F1` (Electric Indigo)
  - Used strictly for active navigation pills, primary CTAs, active focus rings, and primary telemetry highlights. Never as decorative wallpaper.
- **Positive / Pass:** `#16A34A` / `#10B981` (`--emerald`)
  - Used for verified skills, passing scorecard checks, and helping resume bullets.
- **Warning / Attention:** `#D97706` / `#F59E0B` (`--warning`)
  - Used for moderate bottleneck warnings, missing optional keywords, and borderline scores.
- **Critical / Hurting:** `#DC2626` / `#F43F5E` (`--error`)
  - Used for critical drop stages, hurting resume lines, and severe ATS parsing risks.

---

## 3. Typography Scale & Hierarchy

### 3.1 Font Families
- **Primary / Body / Headings:** `'Poppins', system-ui, -apple-system, sans-serif`
  - Allowed font weights: `400` (Regular), `500` (Medium), `600` (SemiBold / Bold).
  - **Banned:** `font-extrabold` (800) and `font-black` (900).
- **Telemetry / Code / Numbers:** `'Fira Code', monospace`
  - Mandatory for scores, percentages, counters, timestamps, and bullet IDs.
  - Always accompanied by `tabular-nums` to prevent layout jitter on number rolls.

### 3.2 Type Scale

| Class | Pixel Size | Line Height | Usage |
| :--- | :--- | :--- | :--- |
| `text-2xl` | `24px` | `1.25` | Main Dashboard / View Titles |
| `text-xl` | `20px` | `1.3` | Major Diagnostic Section Headings |
| `text-lg` | `18px` | `1.4` | Card Headers & Scorecard Summaries |
| `text-sm` | `14px` | `1.5` | Standard Body Copy & Bullet Rewrites |
| `text-xs` | `12px` | `1.4` | **Minimum Label Floor** (Badges, Chips, Metadata, Tooltips) |

> [!IMPORTANT]
> **Sub-12px micro-text (`text-[9px]`, `text-[10px]`) is strictly prohibited.** All badges, category pills, and chart labels must render at `text-xs` (`12px`) or higher in clean Sentence case.

---

## 4. Spacing, Geometry & Radii

### 4.1 Border Radii
- **Cards & Primary Modules:** `12px` (`rounded-xl` / `--radius-md`)
- **Buttons, Controls & Inputs:** `8px` (`rounded-lg` / `--radius-sm`)
- **Chips, Pills & Status Tags:** `6px` (`rounded-md` / `--radius-xs`)
- **Circular Indicators:** `9999px` (`rounded-full`)

### 4.2 Spacing Grid (4px Scale)
- Card Inner Padding: `p-5` (`20px`) for standard cards, `p-6` (`24px`) for large hero modules.
- Item Gap in Grids: `gap-3` (`12px`) or `gap-4` (`16px`).
- Section Separation: `space-y-6` (`24px`) or `space-y-8` (`32px`).
- Hairline Dividers: `border-b border-[var(--border-default)] pb-4 mb-4`.

---

## 5. Motion & Interaction Standards

- **Standard Transition:**
  ```css
  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),
              background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
              border-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
  ```
- **Allowed Utilities:** `transition-colors duration-150`, `transition-[transform,opacity] duration-150`.
- **Banned:**
  - `transition-all` (causes unnecessary repaints and performance degradation).
  - `animate-pulse` and `animate-ping` on static cards or labels (reserved solely for active loading spinners).
- **Interactive Affordance:**
  - Every interactive button, chip, tab, checkbox, accordion header, and copy trigger **must** carry `cursor-pointer`.

---

## 6. Anti-Patterns & Quality Floor (Unslop Enforcement)

1. **No Decorative Slop:** No purple/pink gradient overlays (`bg-gradient-to-*` on card surfaces is banned). Cards must be solid `#FFFFFF` or `#F8FAFC`.
2. **No Low-Contrast Gray:** `text-slate-400` or `text-gray-400` on white/light backgrounds fails WCAG contrast and is banned. Use `text-[var(--text-muted)]` (`#475569`).
3. **No Unanchored Numbers:** Every metric must have an explicit denominator or unit (e.g., `85/100`, `45%`, `2,000 sent / month`).
4. **No Raw String Bullets Without Actions:** Every hurting line must provide a recruiter diagnosis and a 1-click copyable rewrite.
