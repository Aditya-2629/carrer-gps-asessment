/**
 * Analyzers README — V3
 *
 * Describes the role, inputs, outputs, and design rules for each analyzer.
 */

# Resume Agent V3 — Specialized Analyzers

## Architecture

Each analyzer is an **isolated deterministic code module**.

```
Canonical Resume ─────────────────────────────────────────┐
Resume Facts      ──── Positioning Analyzer ───────────── │
Signals           ──── Content Analyzer     ───────────── │
                  ──── Impact Analyzer      ───────────── ├──► Evidence Analyzer ──► Synthesis Agent
                  ──── Technical Analyzer   ───────────── │
                  ──── Structure Analyzer   ───────────── │
                                                          │
                       [All grounded observations]  ──────┘
```

---

## Design Rules

1. **Analyzers produce OBSERVATIONS, not ISSUES.**
   Final issues are selected exclusively by the Synthesis Agent (LLM).

2. **No LLM calls in analyzers.**
   All analyzers are 100% deterministic code.

3. **Evidence required per observation.**
   Every observation that references a specific bullet must include `itemId` and `bulletId`.
   Global observations (resume-level patterns) may have `itemId: null`.

4. **No pejorative language.**
   Observations must use `demonstrates...`, `shows evidence of...`, `indicates...`.
   Never assert: "broken", "fake", "misleading", "unprofessional".

5. **Security bullets are valid technical impact.**
   `impactAnalyzer` and `technicalAnalyzer` both carry `llmGuidance: 'SECURITY_BULLETS_ARE_VALID_IMPACT'`
   on security-related observations so the synthesis prompt knows not to penalize them.

6. **Evidence Analyzer is the final gatekeeper.**
   It filters all observations through the canonical ID lookup before passing to synthesis.
   Ungrounded observations (with invalid itemId/bulletId) are excluded from synthesis input.

---

## Analyzers

### positioningAnalyzer.js
- Target role alignment
- Summary vague language patterns
- Seniority signal consistency
- Skills breadth-to-depth ratio

### contentAnalyzer.js
- Weak / passive verb detection
- Excessive bullet length
- Achievement vs responsibility ratio
- Duplicate content from signals

### impactAnalyzer.js
- Explicit quantified metrics catalog
- Impact category mapping (performance, scale, security, automation, etc.)
- Security bullet protection (explicitly marks as valid impact)

### technicalAnalyzer.js
- Technical domain coverage across 10 domains
- AI/ML, cloud, security, DevOps, architecture detection

### structureAnalyzer.js
- Section completeness check
- Parser warning handling (conditional phrasing)
- Bullet count per experience item

### evidenceAnalyzer.js
- Cross-validates all observations against canonical resume IDs
- Returns `evidenceLocated: true/false` per observation
- Filters grounded observations for synthesis input

---

## Output Format

Every analyzer returns:

```js
{
  version: 'X.Y',
  observations: [
    {
      observationId: 'xxx_001',
      type: 'observation_type',
      description: 'Human-readable observation using neutral language.',
      itemId: 'exp_001' | null,
      bulletId: 'exp_001_b02' | null,
      sourceText: '...' | null,
      weight: 'low' | 'medium' | 'high',
      llmGuidance: 'OPTIONAL_HINT' | undefined,
    }
  ],
  evidence: [...],   // itemId/bulletId pairs for quick reference
}
```

---

## Future Extensions

Individual analyzers can be upgraded to use targeted LLM calls (e.g. role alignment scoring)
**after** benchmark evidence shows deterministic code alone is insufficient for that specific domain.
Until then, all analyzers remain deterministic to control cost and latency.
