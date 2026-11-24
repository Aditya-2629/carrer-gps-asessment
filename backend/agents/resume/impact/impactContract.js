/**
 * Unified Impact Contract (Layer A + Layer B) & Safe Metric Discovery
 * Single source of truth for resume bullet rewrites and impact quantification across Career GPS.
 */

export const IMPACT_POLICY_INSTRUCTIONS = `==================================================
UNIFIED IMPACT CONTRACT (LAYER A + LAYER B):
==================================================
Every experience bullet upgrade and issue rewrite MUST follow this two-layer architecture:

LAYER A: PUBLICATION-READY GROUNDED REWRITE (rewrittenText / correctedText)
1. ZERO INVENTED NUMBERS MANDATE ("Strict Grounding in Source"):
   - ZERO HALLUCINATED METRICS: Strictly PROHIBIT inventing or guessing unverified percentages (e.g. 22%, 18%, 35%, 24%), time savings (e.g. 15+ hours), uptime (e.g. 99.9%), throughput numbers, or user counts not explicitly stated in the candidate's source resume.
   - PRESERVE EXISTING METRICS: If a candidate bullet already contains a verified metric (e.g. 25%, 30+ queries, $2M, 3x, 100,000+ users, 2.5 seconds), PRESERVE that exact verified metric and outcome. Tighten its action verb, technical mechanism, and structure.
   - GROUNDED QUALITATIVE REWRITES FOR UNQUANTIFIED BULLETS: If the original bullet lacks numbers, focus the rewrite entirely on verified tools, concrete technical mechanisms, architectural scope, and honest qualitative outcomes (e.g., system reliability, modularity, automated test coverage, audit compliance, release velocity) WITHOUT fabricating synthetic numbers.
   - CONFIRMATION PROMPTS OUTSIDE REWRITE: For unquantified bullets, attach a confirmation discovery prompt in "metricOpportunities" or "metricPrompt" (e.g., metricPrompt: "Confirm real impact (e.g., hours saved/week or % turnaround gain)") OUTSIDE the verified claim text so the candidate can provide verified numbers.
2. PER-RESUME ACTION VERB DIVERSITY & ANTI-REPETITION GUARD:
   - NO REPEATED OPENING VERBS: Never start more than 2 bullets across the entire resume with the same action verb (e.g., maximum 2 bullets starting with "Architected", 2 with "Engineered", 2 with "Automated", etc.). Vary opening verbs naturally across strong, domain-appropriate action verbs (e.g., Architected, Engineered, Developed, Built, Spearheaded, Automated, Optimized, Streamlined, Designed, Orchestrated, Scaled, Deployed, Standardized, Modernized; or for active current roles: Architect, Engineer, Develop, Build, Spearhead, Automate, Optimize, Streamline, Design, Orchestrate, Scale, Deploy, Standardize, Modernize).
   - VARIED SENTENCE STRUCTURE & OPENINGS: Do NOT use a rigid formula or identical grammatical pattern on consecutive bullets. Vary openings and clause orders naturally across the resume (e.g., some bullets lead with the decisive action verb + technical mechanism, while others lead with the delivered business outcome or system deliverable + technical architecture; 16–28 words).
   - Integrate outcomes naturally inside the sentence (never tack them on as generic "partnering with cross-functional squads, cutting p99..." at the end of every bullet).
   - Match outcomes strictly to what that specific bullet actually does:
     * QA / Testing -> automated regression coverage, defect escapes, CI test runtime
     * UI / Frontend / Figma -> page load, accessibility compliance, bundle size, UI delivery cadence
     * Security / Auth -> vulnerability mitigation, auth flow latency, zero-incident compliance
     * Backend / APIs / DB -> response latency, query execution efficiency, throughput, high availability
     * Data / ETL / Reporting -> pipeline runtime, workflow automation, data accuracy / reconciliation
     * GenAI / RAG / Agents -> retrieval precision, response latency, support deflection, eval pass rate
     * Non-Tech (Healthcare, Finance, Sales, Ops) -> patient charting accuracy, SLA turnaround, reporting cycle velocity.
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
   - NEVER force collaborating or partnering clauses onto solo technical, backend, ETL, scripting, or coding bullets where no collaboration is mentioned in the original resume. Focus instead on direct action, technical mechanism, and business deliverable.

LAYER B: ROLE-SPECIFIC METRIC OPPORTUNITIES (metricOpportunities)
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
 * Deterministically generates 2–3 role-calibrated metric opportunities
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
