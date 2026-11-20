/**
 * Unified Impact Contract (Layer A + Layer B) & Safe Metric Discovery
 * Single source of truth for resume bullet rewrites and impact quantification across Career GPS.
 */

export const IMPACT_POLICY_INSTRUCTIONS = `==================================================
UNIFIED IMPACT CONTRACT (LAYER A + LAYER B):
==================================================
Every experience bullet upgrade and issue rewrite MUST follow this two-layer architecture:

LAYER A: PUBLICATION-READY GROUNDED REWRITE (rewrittenText / correctedText)
1. SELECTIVE INJECTION RULE ("Add Only Where Needed"):
   - PRESERVE EXISTING METRICS: If a candidate bullet already contains a verified metric (e.g. 25%, 30+ queries, $2M, 3x, 100,000+ users, 2.5 seconds), PRESERVE that exact metric and outcome! Do NOT inject a second synthetic metric on top of it — only tighten its action verb, technical mechanism, and structure.
   - ONLY calibrate and suggest realistic metrics for bullets that currently lack measurable numbers or scale.
2. PER-RESUME METRIC DIVERSITY & ANTI-REPETITION GUARD:
   - Every quantified rewrite in the same resume MUST use a DISTINCT metric type and DISTINCT number (never reuse "32%", "35%", "500k+", "12+ hrs", or the same outcome phrase on two different bullets).
   - Integrate the metric naturally inside the sentence (never tack it on as a generic "partnering with cross-functional squads, cutting p99..." at the end of every bullet).
   - Match the metric strictly to what that specific bullet actually does:
     * QA / Testing -> test coverage %, automated regression count, bug escape reduction, CI test runtime
     * UI / Frontend / Figma -> Lighthouse/accessibility score, page load / LCP improvement, bundle size, UI delivery speed
     * Security / Auth -> CVE/vulnerability reduction, auth latency, audit pass rate, zero-incident compliance
     * Backend / APIs / DB -> p95/p99 response time, query execution time, throughput, uptime
     * Data / ETL / Reporting -> pipeline runtime, hours saved per week, data accuracy / reconciliation rate
     * GenAI / RAG / Agents -> retrieval accuracy, latency, support deflection %, eval pass rate
     * Non-Tech (Healthcare, Finance, Sales, Ops) -> patient throughput/charting accuracy, close cycle/variance reduction, quota/pipeline conversion, SLA turnaround.
3. STRICT TENSE DISCIPLINE (Present Company = Present Tense, Past Company/Project = Past Tense):
   - For bullets belonging to an active current role (dates indicating "Present", "Current", or "Till Date"): Lead with an active PRESENT-TENSE verb (e.g. Lead, Architect, Synthesize, Optimize, Develop, Partner, Automate).
   - For bullets belonging to completed past roles or projects: Strictly lead with an active PAST-TENSE verb (e.g. Led, Architected, Synthesized, Optimized, Developed, Partnered, Automated).
4. If the original bullet lacks numbers, focus the rewrite on the concrete engineering/operational mechanism and qualitative outcome (e.g., system reliability, modularity, automated testing, audit compliance, release velocity) WITHOUT fabricating fake numbers.
5. STRICTLY FORBID bracketed placeholders like "[ADD: ...]", "[insert metric]", or "<metric>".
6. STRICTLY FORBID lazy suffix appends where the first 35 characters match the original bullet. Every rewrite must be re-engineered from the ground up!
7. Adapt phrasing dynamically to the candidate's domain (Software, Data, Healthcare, Finance, Ops, Sales, etc.) — never force one rigid template.
8. STAKEHOLDER / TEAM COLLABORATION IS OPTIONAL:
   - Stakeholder or team collaboration clauses ('partnering with...', 'collaborating with...', 'in close partnership with...') are strictly OPTIONAL.
   - Include them ONLY when the original bullet naturally involves cross-functional work, stakeholders, leadership, or clients.
   - NEVER force 'collaborating with DBA squads' or 'partnering with SRE squads' or 'in close partnership with...' onto solo technical, backend, ETL, scripting, or coding bullets where no collaboration is mentioned in the original resume. Focus instead on direct action, technical mechanism, and business deliverable.

LAYER B: ROLE-SPECIFIC IMPACT DISCOVERY (metricOpportunities)
For every weak or unquantified bullet, generate 2–3 concise, bullet-specific measurement opportunities inside "metricOpportunities":
[
  {
    "label": "Short clickable chip (e.g., Reduced API p95 latency)",
    "question": "Targeted discovery question (e.g., Roughly how much faster did endpoint responses become after optimization?)",
    "unitHint": "% | ms | hours/week | $"
  }
]
- These are CANDIDATE DISCOVERY PROMPTS to help the candidate discover and supply their real achievements, NEVER presented as completed achievements inside rewrittenText.
`

/**
 * Normalizes metric opportunities safely.
 * Returns an array of clean validated objects with { label, question, unitHint }.
 */
export function normalizeMetricOpportunities(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const label = String(item.label || item.title || item.metric || '').trim()
      const question = String(item.question || item.discoveryQuestion || item.prompt || '').trim()
      const unitHint = String(item.unitHint || item.unit || item.hint || '').trim()
      if (!label && !question) return null
      return {
        label: label || 'Quantify Impact',
        question: question || 'Roughly how much impact or scale did this achieve?',
        unitHint: unitHint || '% | ms | hours/week | $',
      }
    })
    .filter(Boolean)
    .slice(0, 3)
}

/**
 * Deterministically generates 2–3 role-calibrated impact discovery opportunities
 * when the LLM returns none or for fallback rewrites.
 */
export function generateFallbackMetricOpportunities(bulletText = '', targetRole = '') {
  const lower = String(bulletText || '').toLowerCase()

  // QA & Testing
  if (/test|qa\b|quality|automation|cypress|selenium|playwright|jest|junit/i.test(lower)) {
    return [
      { label: 'Test Coverage Gain', question: 'By what percentage did automated test coverage increase across the codebase?', unitHint: '%' },
      { label: 'Defect Reduction', question: 'How much did production defect escapes or bug ticket volume decrease?', unitHint: '% or bugs/sprint' },
      { label: 'Regression Cycle Time', question: 'How much faster were QA test cycles completed before each release?', unitHint: 'hours or minutes' },
    ]
  }

  // Frontend & UI/UX
  if (/frontend|front-end|ui\b|ux\b|react|angular|vue|component|css|lighthouse|web vitals/i.test(lower)) {
    return [
      { label: 'Page Load / FCP Latency', question: 'Roughly how much did page load time or First Contentful Paint (FCP) improve?', unitHint: 'ms or %' },
      { label: 'Lighthouse Score', question: 'What was the improved Google Lighthouse or performance benchmark score?', unitHint: 'score / 100' },
      { label: 'User Workflow Speed', question: 'How much did workflow completion time or bounce rate improve for end users?', unitHint: '%' },
    ]
  }

  // Database & Queries
  if (/database|sql\b|query|queries|postgres|mysql|mongodb|snowflake|indexing/i.test(lower)) {
    return [
      { label: 'Query Execution Speed', question: 'Roughly how much did query execution time or p95 database latency decrease?', unitHint: 'ms or %' },
      { label: 'Dataset / Record Scale', question: 'What was the approximate volume of records, transactions, or rows processed?', unitHint: 'records or rows' },
      { label: 'Batch Processing Window', question: 'How much was the daily batch ingestion or ETL processing window shortened by?', unitHint: 'hours or minutes' },
    ]
  }

  // DevOps & Cloud Infrastructure
  if (/devops|ci\/cd|cloud|kubernetes|docker|terraform|aws|gcp|azure|pipeline/i.test(lower)) {
    return [
      { label: 'Deployment Lead Time', question: 'How much faster did build-to-deploy or release pipeline cycles become?', unitHint: 'minutes' },
      { label: 'Service Uptime', question: 'What was the maintained production infrastructure availability or uptime level?', unitHint: '% uptime' },
      { label: 'Infrastructure Cost Savings', question: 'Roughly what percentage or dollar reduction was achieved in cloud compute costs?', unitHint: '% or $' },
    ]
  }

  // Data Analyst & BI
  if (/data|analyst|analytics|bi\b|power\s*bi|tableau|dashboard|reporting/i.test(lower)) {
    return [
      { label: 'Reporting Turnaround Time', question: 'How much faster were executive briefings or weekly reports generated?', unitHint: 'hours/week saved' },
      { label: 'Dashboard Adoption', question: 'Roughly how many cross-functional business stakeholders or teams use the dashboard?', unitHint: 'users or teams' },
      { label: 'Data Discrepancy Reduction', question: 'What percentage of cross-system data errors or audit discrepancies were eliminated?', unitHint: '%' },
    ]
  }

  // Security & Compliance
  if (/security|vulnerability|cve|soc2|hipaa|audit|compliance|auth/i.test(lower)) {
    return [
      { label: 'Vulnerability Elimination', question: 'How many critical or high-severity CVE vulnerabilities were resolved?', unitHint: 'CVEs resolved' },
      { label: 'Audit Compliance Rate', question: 'What was the verified security audit or compliance pass rate?', unitHint: '100% or standard' },
      { label: 'Remediation Turnaround (MTTR)', question: 'How quickly were security patches or auth issues remediated?', unitHint: 'hours or days' },
    ]
  }

  // AI & ML
  if (/ai\b|ml\b|llm|rag\b|model|embeddings|inference|token/i.test(lower)) {
    return [
      { label: 'Retrieval / Inference Latency', question: 'Roughly how much did model inference or RAG vector retrieval latency drop?', unitHint: 'ms or %' },
      { label: 'Response Precision', question: 'What was the verified factual accuracy or precision rate of the model?', unitHint: '%' },
      { label: 'Document / Token Scale', question: 'What scale of corpus, documents, or active queries was the pipeline tested on?', unitHint: 'documents or QPS' },
    ]
  }

  // General Software / Professional
  return [
    { label: 'Efficiency / Time Saved', question: 'Roughly how many hours per week or sprint were saved through this improvement?', unitHint: 'hours/week' },
    { label: 'Throughput / Scale', question: 'What volume of users, transactions, or operations did this system handle?', unitHint: 'users or items' },
    { label: 'Turnaround Acceleration', question: 'By what percentage was delivery or response cycle time accelerated?', unitHint: '%' },
  ]
}

export default {
  IMPACT_POLICY_INSTRUCTIONS,
  normalizeMetricOpportunities,
  generateFallbackMetricOpportunities,
}
