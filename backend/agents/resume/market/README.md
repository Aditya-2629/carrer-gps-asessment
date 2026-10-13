# Resume Agent V3 — Market Intelligence Layer

This directory contains the Market Intelligence subsystem for Career GPS Resume Agent V3.

## Modules

- `marketBucketResolver.js`: Resolves candidate resume + target JD into canonical `Role × Experience` bucket identity (e.g. `software-engineer::6-8`).
- `marketJdRetriever.js`: Retrieves active market snapshots (5 JDs) or enqueues background refresh.
- `jdNormalizer.js`: Cleans, validates, extracts signals from, and deduplicates raw job postings.
- `marketProfileBuilder.js`: Builds deterministic aggregated market profiles without LLM calls.
- `marketEvidence.js`: Evaluates resume against target JD and market profile with strict language guardrails.
- `marketVersions.js`: Manages atomic versioning and version history.
- `domainClassifier.js`: Domain playbooks for non-IT vs IT vocabulary (V3.1).
- `usMarketSignals.js`: Detects non-US resume conventions (V3.1).

## Key Principles

1. **Deterministic Pre-processing**: No LLM calls for frequency aggregation, deduplication, or bucket lookup.
2. **Target JD Priority**: Target JD is the primary authority; market data provides secondary context.
3. **Market Evidence Gap ≠ Skill Gap**: Missing evidence is framed accurately without claiming candidate lacks the skill.
4. **Atomic Swaps**: Updates never delete active data before validating the new version.
