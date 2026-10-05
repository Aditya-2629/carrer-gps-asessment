# Evidence Classification Layer (V2.4)

The Evidence Classification Layer provides internal, deterministic reasoning categories for all bullet points in a candidate resume.

## Classification Tiers

1. **STRONG**:
   - Meaningful measurable impact, performance optimizations, high scale, reliability improvements, automated releases with zero downtime, clear ownership + explicit result.
   - Recommended for inclusion as strengths.
   - Target count: 2–5 normally. No artificial minimum.

2. **BORDERLINE**:
   - Work is technically legitimate and contribution is clear enough, but evidence is not strong enough to call it a standout strength, and there is no meaningful defect to criticize.
   - Includes security remediation without scale/numeric metrics (e.g. XSS remediation, sensitive-key exposure, input validation, sanitization).
   - Includes architecture ownership with tool density where ownership is intact.
   - **Reasoning Rule**: If a resume item is neither clearly strong nor clearly problematic, do NOT force it into either strengths or issues. Prefer omission over an unreliable judgment.

3. **WEAK**:
   - Meaningful defects only: vague responsibilities without demonstrated individual contribution ("Responsible for writing code"), unclear ownership ("Assisted developers"), routine meeting attendance without engineering outcomes, ticket pushing, duplicate content, tool lists obscuring work.
   - **Critical Rule**: Missing a numeric metric does NOT make a bullet WEAK!

4. **NEUTRAL**:
   - Acceptable ordinary maintenance or routine operational tasks without standout impact or significant defect (e.g. updating documentation, testing website links).
   - Normally does NOT appear in the final report.

## Internal Reasoning Only

- These labels (`STRONG`, `BORDERLINE`, `WEAK`, `NEUTRAL`) are strictly internal.
- They must NEVER be exposed in final user-facing API JSON outputs (`analysisVersion: "2.2"`).
- They are accessible in dev/test mode via `state.evidenceClassifications`.

## Consistency & Contradiction Resolution

If the same evidence bullet is cited as both a strength and an issue in the model's raw response, the contradiction is resolved before final output:
- `STRONG` → Retained as strength, removed from issues
- `WEAK` → Retained as issue, removed from strengths
- `BORDERLINE` → Omitted from both
