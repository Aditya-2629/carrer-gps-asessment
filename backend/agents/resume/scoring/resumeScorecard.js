/**
 * Resume Scorecard Engine — V3.1 (Phase: "The Magic Layer")
 *
 * Deterministic scoring — NO LLM call, runs in milliseconds. Fills the
 * `dashboard` field of the final analysis with the same kind of instant,
 * scannable verdict competitors show: a 0-100 Resume Health Score, per-category
 * letter grades, a pass/warn/fail checklist, and a per-bullet audit with
 * before→after rewrites.
 *
 * Input sources (all already computed by the pipeline):
 *  - analysis.issues / strengths (LLM synthesis, validated)
 *  - precomputedSignals (quantification rollup, bullet signals, contact merge)
 *  - usMarketSignals (non-US convention flags)
 *  - canonicalResume (bullets, certifications, page estimates)
 *  - validation warnings (fabrication/assumption warnings)
 *
 * Design rules:
 *  - Every score is explainable: each category grade derives from named facts.
 *  - A bullet is only marked "fix" when an issue cites it — we never invent problems.
 *  - Missing quantification alone never drops a bullet below "warn".
 */

import { normalizeGerundVerb, toPresentTense } from '../signals/patterns.js'
import { extractCleanPhoneNumber } from '../resumeAgent.normalizer.js'
import { computeKeywordAlignment } from '../market/keywordAlignment.js'
import { synthesizeWhyItWorks } from '../../../utils/humanizeReportCopy.js'
import { normalizeMetricOpportunities, generateFallbackMetricOpportunities } from '../impact/impactContract.js'

export const SCORECARD_VERSION = 'resume-scorecard-v2'

const SEVERITY_PENALTY = { high: 14, medium: 8, low: 4 }

export function balanceParentheses(str) {
  if (!str || typeof str !== 'string') return str
  const openCount = (str.match(/\(/g) || []).length
  const closeCount = (str.match(/\)/g) || []).length
  if (openCount > closeCount) {
    const diff = openCount - closeCount
    if (/\.\s*$/.test(str)) {
      return str.replace(/\.\s*$/, ')'.repeat(diff) + '.')
    }
    return str + ')'.repeat(diff)
  }
  return str
}

export function cleanRewriteText(text) {
  if (!text || typeof text !== 'string') return text
  // 1. Strip ALL [ADD: ...] bracketed placeholders along with any immediately preceding preposition (by, to, of, across, for, with, at, in, from)
  let cleaned = text.replace(/(\s+(?:by|to|of|across|for|with|at|in|from))?\s*\[ADD:[^\]]*\]/gi, '')
  // 2. Collapse duplicated prepositions
  cleaned = cleaned.replace(/\b(by|with|to|in|of|for|and|on|at|from)\s+\1\b/gi, '$1')
  // 3. Remove any dangling prepositions right before a period or comma (e.g. "time by." -> "time.")
  cleaned = cleaned.replace(/\s+\b(?:by|to|of|across|for|with|at|in|from)\s*([.,;])/gi, '$1')
  // 4. Normalize multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  if (!/[.!?]$/.test(cleaned) && cleaned.length > 0) {
    cleaned = `${cleaned}.`
  }
  return balanceParentheses(cleaned)
}

export function sanitizeSingleAddPlaceholder(text) {
  return cleanRewriteText(text)
}

export function toPastTense(verb) {
  if (!verb) return verb
  const v = verb.toLowerCase().trim()
  const irregulars = {
    build: 'Built',
    built: 'Built',
    run: 'Ran',
    ran: 'Ran',
    lead: 'Led',
    led: 'Led',
    drive: 'Drove',
    drove: 'Drove',
    write: 'Wrote',
    wrote: 'Wrote',
    make: 'Made',
    make: 'Made',
    keep: 'Kept',
    kept: 'Kept',
    take: 'Took',
    took: 'Took',
    grow: 'Grew',
    grew: 'Grew',
    set: 'Set',
    cut: 'Cut',
    meet: 'Met',
    met: 'Met',
    hold: 'Held',
    held: 'Held',
    send: 'Sent',
    sent: 'Sent',
    spend: 'Spent',
    spent: 'Spent',
    speak: 'Spoke',
    spoke: 'Spoke',
    choose: 'Chose',
    chose: 'Chose',
    find: 'Found',
    found: 'Found',
    win: 'Won',
    won: 'Won',
    sell: 'Sold',
    sold: 'Sold',
    buy: 'Bought',
    bought: 'Bought',
    bring: 'Brought',
    brought: 'Brought',
    teach: 'Taught',
    taught: 'Taught',
    oversee: 'Oversaw',
    oversaw: 'Oversaw',
    analyze: 'Analyzed',
    analyzed: 'Analyzed',
    analyse: 'Analysed',
    analysed: 'Analysed',
  }
  if (irregulars[v]) return irregulars[v]
  if (v.endsWith('ed')) return v.charAt(0).toUpperCase() + v.slice(1)
  if (v.endsWith('yze') || v.endsWith('ise')) return v.charAt(0).toUpperCase() + v.slice(1) + 'd'
  if (v.endsWith('e')) return v.charAt(0).toUpperCase() + v.slice(1) + 'd'
  if (v.endsWith('y') && !/[aeiou]y$/i.test(v)) return v.charAt(0).toUpperCase() + v.slice(1, -1) + 'ied'
  return v.charAt(0).toUpperCase() + v.slice(1) + 'ed'
}

/**
 * Promotes the opening verb to a strong active verb matching the role tense,
 * without appending any fake outcome, metrics, or trailing boilerplate clauses.
 */
export function applyLightVerbFix(bulletText, sig = null, isCurrentRole = false) {
  if (!bulletText || typeof bulletText !== 'string') return null
  let clean = bulletText.replace(/^[•\-*▪–—·\s]+/, '').trim()
  if (!clean) return null

  // Strip weak phrases at the start
  clean = clean
    .replace(/^(?:responsible for|was responsible for|tasked with|worked on|working on|helped with|helped to|assisted in|assisted with|participated in|supported|contributed to|utilized|using|managed to|handled)\s+(?:the\s+)?/i, '')
    .trim()

  const m = clean.match(/^([A-Za-z]+)\b(.*)$/s)
  if (!m) return clean

  const rawFirst = m[1]
  const rest = m[2]
  const lowerFirst = rawFirst.toLowerCase()

  const nonVerbOpeners = new Set([
    'monthly', 'quarterly', 'daily', 'weekly', 'annual', 'biannual', 'periodic', 'routine',
    'adhoc', 'ad-hoc', 'various', 'multiple', 'internal', 'external', 'client', 'financial',
    'excel', 'data', 'business', 'system', 'project', 'cross-functional', 'technical',
    'regular', 'key', 'core', 'new', 'existing', 'critical'
  ])

  if (nonVerbOpeners.has(lowerFirst)) {
    const defaultVerb = isCurrentRole ? 'Generate' : 'Generated'
    return cleanRewriteText(`${defaultVerb} ${clean}`)
  }

  let newVerb = rawFirst
  if (lowerFirst.endsWith('ing')) {
    newVerb = normalizeGerundVerb(rawFirst, isCurrentRole)
  } else if (isCurrentRole) {
    newVerb = toPresentTense(rawFirst)
  } else {
    newVerb = toPastTense(rawFirst)
  }

  if (newVerb && newVerb.length > 0) {
    newVerb = newVerb.charAt(0).toUpperCase() + newVerb.slice(1)
  }

  return cleanRewriteText(`${newVerb}${rest}`)
}

/**
 * Detects if a rewrite is merely an unchanged original bullet prefix with a lazy suffix appended.
 * Rejects rewrites matching: rewrite.toLowerCase().startsWith(original.toLowerCase().slice(0, 35))
 * or that preserve weak openers while tacking on "by [doing X]" / ", using [Y]".
 */
export function isLazySuffixAppend(rewrite, original) {
  if (!rewrite || !original || typeof rewrite !== 'string' || typeof original !== 'string') return false
  const cleanOrig = original.trim().replace(/^[•\-*▪–—·\s]+/, '').trim()
  const cleanRw = rewrite.trim().replace(/^[•\-*▪–—·\s]+/, '').trim()
  if (cleanOrig.length < 10 || cleanRw.length < 10) return false

  const origLower = cleanOrig.toLowerCase()
  const rwLower = cleanRw.toLowerCase()

  // 1. Core requirement: rewrite starts with the first 35 chars of original
  const checkLen = Math.min(35, origLower.replace(/[.!?]+$/, '').length)
  if (checkLen >= 15 && rwLower.startsWith(origLower.slice(0, checkLen))) {
    // If it starts with the unchanged prefix and appends a mechanism/metric at the tail
    if (rwLower.length > origLower.length || /\s+by\s+[a-z]+ing\b/i.test(rwLower) || /,\s*(?:using|with|via)\s+/i.test(rwLower)) {
      return true
    }
  }

  // 2. Weak opening preserved: e.g. "Worked on ... by establishing ..."
  const weakOpeners = /^(?:worked on|working on|helped with|helped to|assisted in|assisted with|responsible for|was responsible for|participated in|tasked with|utilized|using)\b/i
  if (weakOpeners.test(origLower) && weakOpeners.test(rwLower)) {
    return true
  }

  // 3. Known boilerplate suffix tacked onto original prefix
  if (/,\s*(?:using|by establishing|applying|powered by|containerized and automated via|adopting)\s+[^,.]+\s+(?:for|to|with)\s+[^.]+\.?$/i.test(rwLower) &&
      rwLower.slice(0, 25) === origLower.slice(0, 25)) {
    return true
  }

  // 4. Middle-body overlap check: even if first 1–2 verbs changed (e.g. "Worked on X" -> "Engineered X by ...")
  // Check if >65% of the original body words match the rewrite body without introducing a genuine new metric.
  const origWords = origLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  const rwWords = rwLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)

  if (origWords.length >= 5 && rwWords.length >= 5) {
    // Strip leading 1–2 words (verb swap)
    const origBody = origWords.slice(Math.min(2, Math.floor(origWords.length * 0.25)))
    const rwBodySet = new Set(rwWords.slice(Math.min(2, Math.floor(rwWords.length * 0.25))))

    let matchCount = 0
    for (const w of origBody) {
      if (rwBodySet.has(w)) matchCount++
    }
    const overlapRatio = matchCount / origBody.length

    // Check if rewrite contains any new metric token that wasn't already in original
    const origMetrics = origLower.match(/(\$?\d+(?:\.\d+)?%?|\b\d+x\b)/g) || []
    const rwMetrics = rwLower.match(/(\$?\d+(?:\.\d+)?%?|\b\d+x\b)/g) || []
    const origMetricSet = new Set(origMetrics)
    const hasNewMetric = rwMetrics.some((m) => !origMetricSet.has(m))

    // If >65% of the middle body words are identical and no new metric was introduced, it's a lazy verb swap
    if (overlapRatio >= 0.65 && !hasNewMetric) {
      return true
    }
  }

  return false
}

/**
 * Checks whether a candidate rewrite is empty, identical, or >85% word-for-word identical to the original bullet
 * (e.g. only the first word was changed, or the rest of the sentence is unchanged boilerplate).
 */
export function isWordForWordIdentical(rewrittenText, originalText, threshold = 0.85) {
  if (!rewrittenText || !originalText || typeof rewrittenText !== 'string' || typeof originalText !== 'string') return true
  const cleanRw = rewrittenText.trim().replace(/^[•\-*▪–—·\s]+/, '').replace(/[.!?]+$/, '').trim()
  const cleanOrig = originalText.trim().replace(/^[•\-*▪–—·\s]+/, '').replace(/[.!?]+$/, '').trim()
  if (!cleanRw || !cleanOrig) return true
  if (cleanRw.toLowerCase() === cleanOrig.toLowerCase()) return true

  const rwWords = cleanRw.toLowerCase().split(/\s+/)
  const origWords = cleanOrig.toLowerCase().split(/\s+/)
  if (rwWords.length === 0 || origWords.length === 0) return true

  // Single-word opening verb swap check (e.g. "Answered complex..." -> "Answer complex...")
  if (rwWords.length === origWords.length && rwWords.length > 3) {
    let sameWords = 0
    for (let i = 1; i < rwWords.length; i++) {
      if (rwWords[i] === origWords[i]) sameWords++
    }
    if (sameWords / (rwWords.length - 1) >= threshold) {
      return true
    }
  }

  // Jaccard / token overlap check
  const origSet = new Set(origWords)
  let matchingCount = 0
  for (const w of rwWords) {
    if (origSet.has(w)) matchingCount++
  }
  const overlap = matchingCount / Math.max(rwWords.length, origWords.length)
  if (overlap >= threshold && Math.abs(rwWords.length - origWords.length) <= 3) {
    return true
  }

  return false
}

export function isTrueQuantified(text) {
  if (!text || typeof text !== 'string') return false
  const clean = text
    .replace(/\b(?:react|angular|vue|python|d3|node|es|oauth|jwt|html|css|java|ecma|c\+\+|c#|dot net|\.net)\.?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\bv\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b(?:19|20)\d{2}\b/g, '')

  // 1. Percentage
  if (/\d+(?:\.\d+)?%/.test(clean)) return true
  // 2. Multiplier (e.g. 3x, 10x, 2.5x)
  if (/\b\d+(?:\.\d+)?[xX]\b/.test(clean)) return true
  // 3. Currency (e.g. $2M, $500k, $10,000, Rs, INR, €, £)
  if (/(?:(?:[\$€£₹]|(?:Rs\.?|INR|CAD|AUD)\s*)\s*[\d,]+(?:\.\d+)?(?:\s*[kmb]\b|\s*million|\s*billion|\s*lakhs?|\s*crores?)?|\b[\d,]+(?:\.\d+)?\s*(?:lakhs?|crores?)\s*(?:INR|Rs\.?)?\b)/i.test(clean)) return true
  // 4. Latency, time savings or duration measurements (e.g. 40+ manual hours, 8 hours to 4 hours, 90 minutes, 6+ hours, 250ms, 2.5 seconds)
  if (/\b\d+(?:\.\d+)?\+?\s*(?:(?:manual|working|analytical|engineering|operational|labor)\s+)?(?:ms|milliseconds?|seconds?|sec|mins?|minutes?|hours?|hrs?|days?|weeks?|months?)\b/i.test(clean)) return true
  if (/\b(?:from\s+)?\d+\s*(?:hours?|hrs?|days?|weeks?|mins?|minutes?|seconds?|ms)?\s*(?:to|–|-|down to)\s*(?:under\s+)?\d+\s*(?:hours?|hrs?|days?|weeks?|mins?|minutes?|seconds?|ms)\b/i.test(clean)) return true
  // 5. Scale / volume / team size / count metrics (e.g. 50,000+ transactions, 15-person team, 100K+ users, 15+ reports, 30+ queries)
  if (/\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|million|billion)\+?/i.test(clean)) return true
  if (/\b\d+(?:,\d{3})*\+?(?:-(?:person|member|engineer|developer|query|model|tool|node|cluster|pipeline|report|server|table))?\s*(?:[a-z]+-)?(?:financial|operational|clinical|concurrent|active|daily|monthly|annual|historical|enterprise|production|unique|cross-functional|internal)?\s*(?:users|qps|rps|tps|events|requests|records|rows|bank employees|employees|clients|customers|patients|queries|reports|dashboards|features|releases|deployments|transactions|microservices|services|endpoints|tables|models|cves|vulnerabilities|tickets|bugs|defects|test cases|builds|pipelines|nodes|clusters|servers|containers|pods|members|engineers|developers|analysts|people|beds|team|accounts|leads|subscribers)\b/i.test(clean)) return true
  // 6. Explicit team size patterns
  if (/\b(?:\d+\s*-?\s*person(?:\s+(?:team|squad|pod|group|department|org|organization|engineers|staff|members))?|team\s+of\s+\d+|led\s+\d+\s*(?:engineers|developers|people|analysts|members|designers))\b/i.test(clean)) return true
  // 7. Production scale descriptors with numbers (e.g. 24-bed ICU, 50+ enterprise clients)
  if (/\b\d{2,}\+?\s+(?:production|enterprise|distributed|active|concurrent|client|bed)\b/i.test(clean)) return true
  // 8. WCAG compliance standards with specific version or levels
  if (/\bwcag\s*(?:2\.[012]|2\s*aa)\b/i.test(clean)) return true

  return false
}

export const DOMAIN_METRIC_POOLS = {
  qa: [
    { key: 'qa_cov_32', outcome: 'increasing automated test suite coverage by 32% to prevent defect escapes' },
    { key: 'qa_speed_45', outcome: 'accelerating CI/CD test execution speed by 45% and eliminating regression testing bottlenecks' },
    { key: 'qa_bugs_40', outcome: 'resolving 40+ critical edge-case defects and maintaining zero production test regression escapes' },
    { key: 'qa_time_45m', outcome: 'shortening pre-release QA validation cycles from 6 hours to under 45 minutes across environments' },
    { key: 'qa_pass_98', outcome: 'achieving 98% end-to-end test pass rates and eliminating manual release verification toil' },
  ],
  frontend: [
    { key: 'ui_vel_28', outcome: 'accelerating UI delivery velocity by 28% across responsive layouts' },
    { key: 'ui_bundle_35', outcome: 'reducing client-side bundle size by 35% and eliminating layout shifts' },
    { key: 'ui_lh_98', outcome: 'elevating Google Lighthouse accessibility scores to 98/100' },
    { key: 'ui_flow_22', outcome: 'accelerating core user workflow completion rates by 22%' },
    { key: 'ui_fcp_sub', outcome: 'optimizing rendering pipelines to deliver consistent sub-second First Contentful Paint (FCP) across devices' },
  ],
  security: [
    { key: 'sec_cve_15', outcome: 'eliminating 15+ potential attack vectors and achieving zero auth vulnerabilities' },
    { key: 'sec_tok_100', outcome: 'protecting enterprise user workflows with 100% token validation compliance' },
    { key: 'sec_auth_25', outcome: 'hardening API gateways, cutting authorization latency by 25% while blocking unauthorized access attempts' },
    { key: 'sec_audit_0', outcome: 'ensuring full adherence to enterprise security governance with zero audit findings' },
  ],
  database: [
    { key: 'db_query_42', outcome: 'reducing complex query execution times by 42% via compound indexing' },
    { key: 'db_lock_35', outcome: 'eliminating database lock contention and reducing I/O wait by 35%' },
    { key: 'db_lat_50ms', outcome: 'optimizing aggregation pipelines to sustain sub-50ms read latency across 500k+ collection records' },
    { key: 'db_thru_3x', outcome: 'streamlining data access layers, accelerating data retrieval throughput by 3x during peak transaction windows' },
  ],
  data: [
    { key: 'data_brief_35', outcome: 'delivering executive briefings that accelerated decision-making turnaround by 35%' },
    { key: 'data_leads_24', outcome: 'identifying high-value customer cohorts to accelerate targeted campaign conversion by 24%' },
    { key: 'data_hrs_15', outcome: 'saving 15+ analytical hours per week and eliminating manual spreadsheet reconciliation errors' },
    { key: 'data_ing_50', outcome: 'accelerating daily batch data ingestion throughput by 50%' },
    { key: 'data_acc_99', outcome: 'achieving 99.9% data reconciliation accuracy across cross-system operational data syncs' },
    { key: 'data_turn_2h', outcome: 'shortening reporting turnaround from 3 days to under 2 hours for downstream business consumers' },
  ],
  ai: [
    { key: 'ai_ret_sub', outcome: 'achieving sub-second semantic retrieval across enterprise document corpora' },
    { key: 'ai_inf_30', outcome: 'reducing model inference latency by 30% with automated context caching' },
    { key: 'ai_prec_92', outcome: 'evaluating LLM providers to achieve 92% retrieval precision while minimizing token compute overhead' },
    { key: 'ai_tok_40', outcome: 'accelerating token generation throughput by 40% and eliminating context window latency bottlenecks' },
  ],
  backend: [
    { key: 'back_p95_38', outcome: 'reducing endpoint p95 latency by 38% under high concurrency' },
    { key: 'back_avail_99', outcome: 'sustaining 99.99% service availability with zero-downtime rolling deploys' },
    { key: 'back_bw_28', outcome: 'optimizing payload serializations, reducing network bandwidth consumption by 28% across microservices' },
    { key: 'back_qps_4x', outcome: 'decoupling legacy services to scale concurrent request handling capacity from 2,000 to 12,000 req/sec' },
  ],
  devops: [
    { key: 'dev_lead_50', outcome: 'reducing CI/CD build-to-deploy lead time by 50% across environments' },
    { key: 'dev_avail_99', outcome: 'sustaining 99.99% infrastructure availability with automated rollouts' },
    { key: 'dev_cost_25', outcome: 'optimizing container compute footprints, achieving a 25% reduction in cloud infrastructure resource overhead' },
    { key: 'dev_mttr_40', outcome: 'automating multi-region failover, slashing mean time to recovery (MTTR) by 40% during outages' },
  ],
  healthcare: [
    { key: 'hc_wait_25', outcome: 'reducing patient intake wait times by 25%' },
    { key: 'hc_med_0', outcome: 'maintaining zero medication administration discrepancies across 500+ patient shifts' },
    { key: 'hc_flow_30m', outcome: 'streamlining clinical shift handovers, cutting documentation overhead by 30 minutes per shift' },
    { key: 'hc_hipaa_100', outcome: 'ensuring full HIPAA compliance with zero protocol deficiencies' },
  ],
  finance: [
    { key: 'fin_close_4d', outcome: 'accelerating monthly financial close cycles from 10 days to 4 days with zero audit discrepancies' },
    { key: 'fin_var_18', outcome: 'optimizing operational expenditure variance forecasting, improving budget accuracy by 18%' },
    { key: 'fin_gaap_100', outcome: 'ensuring 100% GAAP compliance and audit readiness with zero material balance sheet deficiencies' },
    { key: 'fin_opex_12', outcome: 'identifying 12% operational cost savings across departmental budgets' },
  ],
  sales: [
    { key: 'sales_quota_125', outcome: 'accelerating enterprise sales cycle velocity by 30% and exceeding annual quota by 125%' },
    { key: 'sales_conv_22', outcome: 'expanding outbound B2B pipeline conversion by 22% through consultative discovery frameworks' },
    { key: 'sales_arr_2m', outcome: 'closing $2M+ in new annual recurring revenue (ARR)' },
    { key: 'sales_cycle_35', outcome: 'shortening average deal closing cycles from 90 days to 58 days across enterprise accounts' },
  ],
  general: [
    { key: 'gen_vel_25', outcome: 'accelerating sprint release velocity by 25%' },
    { key: 'gen_toil_10h', outcome: 'streamlining operational workflows to eliminate 10+ hours of weekly manual toil' },
    { key: 'gen_mttr_32', outcome: 'maintaining high operational reliability and reducing mean time to incident resolution (MTTR) by 32%' },
    { key: 'gen_uptime_99', outcome: 'sustaining 99.9% uptime across production services' },
  ],
}

/**
 * Enforces the 5-Part Resume Playbook Formula on any bullet:
 * 1. Strong Action Verb (Engineered, Architected, Automated, Reduced, Led, Spearheaded, Optimized)
 * 2. Hard Skill & Scope (verified tools/skills naturally woven without stuffing)
 * 3. Scale / Collaboration (team/stakeholder/system scope)
 * 4. Natural Calibrated Metric (~20–35% latency/efficiency, 10–15 hrs/wk, 3x throughput, 99.9% uptime, 250k+ records)
 * 5. Business Outcome (clear deliverable impact)
 * Target length: 18–32 words (crisp 1–2 lines)
 */
export function buildFivePartPlaybookRewrite(bulletText, {
  targetRole = '',
  isCurrentRole = false,
  skills = [],
  sig = null,
  company = '',
  bulletIndex = 0,
  usedMetricsSet = new Set(),
} = {}) {
  if (!bulletText || typeof bulletText !== 'string') return ''
  let clean = bulletText
    .replace(/^[•\-*▪–—·\s]+/, '')
    .trim()

  const lowerRole = (targetRole || '').toLowerCase()
  const isSoftwareRole = /developer|engineer|software|full\s*stack|backend|frontend|devops|architect|data|programmer|coder/i.test(lowerRole)
  const isHealthcareRole = /nurse|nursing|clinical|physician|doctor|triage|bedside/i.test(lowerRole) && !isSoftwareRole
  const isFinanceRole = /finance|financial|fp&a|accounting|accountant|auditor|treasury/i.test(lowerRole) && !isSoftwareRole
  const isSalesRole = /sales|account\s+exec|quota|pipeline|bdr|sdr|business\s+dev/i.test(lowerRole) && !isSoftwareRole

  // 1. Check if bullet is CAR structure (Challenge / Action / Result)
  const actionMatch = clean.match(/Action:\s*([^]+?)(?=\s*Result:|$)/i)
  const resultMatch = clean.match(/Result:\s*([^]+?)$/i)
  const challengeMatch = clean.match(/Challenge:\s*([^]+?)(?=\s*Action:|$)/i)

  const hasCarStructure = Boolean(actionMatch)
  let actionClause = actionMatch ? actionMatch[1].trim() : clean
  let resultClause = resultMatch ? resultMatch[1].trim() : ''
  let challengeClause = challengeMatch ? challengeMatch[1].trim() : ''

  // Clean trailing punctuation
  actionClause = actionClause.replace(/[.,;:\s]+$/, '').trim()
  resultClause = resultClause.replace(/[.,;:\s]+$/, '').trim()

  // 2. Check if bullet is already quantified
  const alreadyQuantified = isTrueQuantified(clean) || isTrueQuantified(resultClause) || isTrueQuantified(actionClause)

  // 3. Verb extraction and normalization from action clause
  let coreAction = actionClause.trim()

  // Handle: "Collaborated with <group> using <tools> to <verb> <rest>" -> "<VerbPast> <rest> using <tools> in collaboration with <group>"
  const collabUsingMatch = coreAction.match(/^(?:collaborated with|collaborating with|partnered with|partnering with)\s+([^,]+?)\s+using\s+([^,]+?)\s+to\s+([a-zA-Z]+)\s+([^]+)$/i)
  if (collabUsingMatch) {
    const [, partners, tool, verb, rest] = collabUsingMatch
    const pastVerb = toPastTense(verb)
    coreAction = `${pastVerb} ${rest.trim()} using ${tool.trim()} in collaboration with ${partners.trim()}`
  } else {
    // Handle: "Collaborated with <group> to <verb> <rest>" -> "<VerbPast> <rest> in collaboration with <group>"
    const collabToMatch = coreAction.match(/^(?:collaborated with|collaborating with|partnered with|partnering with)\s+([^,]+?)\s+to\s+([a-zA-Z]+)\s+([^]+)$/i)
    if (collabToMatch) {
      const [, partners, verb, rest] = collabToMatch
      const pastVerb = toPastTense(verb)
      coreAction = `${pastVerb} ${rest.trim()} in close partnership with ${partners.trim()}`
    }
  }

  // Handle: "Wrote Python/bash scripts to automate <task>" -> "Automated <task> using Python scripts"
  const wroteScriptMatch = coreAction.match(/^(?:wrote|developed|created)\s+([a-zA-Z0-9\/\s]+scripts?)\s+to\s+automate\s+([^]+)$/i)
  if (wroteScriptMatch) {
    const [, scriptTool, task] = wroteScriptMatch
    coreAction = `Automated ${task.trim()} utilizing ${scriptTool.trim()}`
  }

  // Handle: "Built and maintained MERN stack..." or "Designed and developed..."
  coreAction = coreAction
    .replace(/^(?:built and maintained|designed and developed|built and deployed|developed and enhanced|engineered and deployed|automated and tested)\s+/i, (m) => {
      const first = m.split(/\s+/)[0]
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() + ' '
    })
    .replace(/^(?:drove\s+automated\s+testing|drove\s+testing)\s*,?\s*/i, 'Automated ')
    .replace(/^(?:responsible for|was responsible for|tasked with|worked on|working on|helped with|helped to|assisted in|assisted with|participated in|supported|contributed to|utilized|using|managed to|handled)\s+(?:the\s+)?/i, '')
    .trim()

  // Detect existing leading verb if strong
  const firstWordMatch = coreAction.match(/^([A-Za-z]+)\b/)
  const rawFirstWord = firstWordMatch ? firstWordMatch[1] : ''
  const lowerFirst = rawFirstWord.toLowerCase()

  const strongActionVerbs = new Map([
    ['architected', 'Architected'], ['architect', 'Architect'],
    ['engineered', 'Engineered'], ['engineer', 'Engineer'],
    ['automated', 'Automated'], ['automate', 'Automate'],
    ['built', 'Built'], ['build', 'Build'],
    ['developed', 'Developed'], ['develop', 'Develop'],
    ['designed', 'Designed'], ['design', 'Design'],
    ['implemented', 'Implemented'], ['implement', 'Implement'],
    ['optimized', 'Optimized'], ['optimize', 'Optimize'],
    ['modernized', 'Modernized'], ['modernize', 'Modernize'],
    ['spearheaded', 'Spearheaded'], ['spearhead', 'Spearhead'],
    ['orchestrated', 'Orchestrated'], ['orchestrate', 'Orchestrate'],
    ['hardened', 'Hardened'], ['harden', 'Harden'],
    ['secured', 'Secured'], ['secure', 'Secure'],
    ['prototyped', 'Prototyped'], ['prototype', 'Prototype'],
    ['remediated', 'Remediated'], ['remediate', 'Remediate'],
    ['redesigned', 'Redesigned'], ['redesign', 'Redesign'],
    ['migrated', 'Migrated'], ['migrate', 'Migrate'],
    ['integrated', 'Integrated'], ['integrate', 'Integrate'],
    ['deployed', 'Deployed'], ['deploy', 'Deploy'],
    ['synthesized', 'Synthesized'], ['synthesize', 'Synthesize'],
    ['standardized', 'Standardized'], ['standardize', 'Standardize'],
    ['coordinated', 'Coordinated'], ['coordinate', 'Coordinate'],
    ['accelerated', 'Accelerated'], ['accelerate', 'Accelerate'],
    ['delivered', 'Delivered'], ['deliver', 'Deliver'],
    ['applied', 'Applied'], ['apply', 'Applied'],
    ['led', 'Led'], ['lead', 'Lead'],
    ['ran', 'Ran'], ['run', 'Run'],
    ['drove', 'Drove'], ['drive', 'Drive'],
    ['wrote', 'Wrote'], ['write', 'Write'],
    ['made', 'Made'], ['make', 'Make'],
    ['sent', 'Sent'], ['send', 'Send'],
    ['held', 'Held'], ['hold', 'Hold'],
    ['kept', 'Kept'], ['keep', 'Keep'],
    ['sold', 'Sold'], ['sell', 'Sell'],
    ['paid', 'Paid'], ['pay', 'Pay'],
    ['met', 'Met'], ['meet', 'Meet'],
    ['read', 'Read'],
    ['grew', 'Grew'], ['grow', 'Grow'],
    ['taught', 'Taught'], ['teach', 'Teach'],
    ['brought', 'Brought'], ['bring', 'Bring'],
    ['found', 'Found'], ['find', 'Find'],
    ['set', 'Set'],
    ['translated', 'Translated'], ['translate', 'Translate'],
    ['validated', 'Validated'], ['validate', 'Validate'],
    ['analyzed', 'Analyzed'], ['analyze', 'Analyze'],
    ['answered', 'Synthesized'], ['answer', 'Synthesize'],
    ['answering', 'Synthesized'],
    ['handled', 'Resolved'], ['handle', 'Resolve'],
    ['handling', 'Resolved'],
    ['addressed', 'Remediated'], ['address', 'Remediate'],
    ['gathered', 'Synthesized'], ['gather', 'Synthesize'],
    ['tracked', 'Monitored'], ['track', 'Monitor'],
    ['wrote', 'Automated'],
    ['drove', 'Automated'],
  ])

  const isDataRole = /data|analyst|analytics|bi\b|business\s+intelligence|tableau|power\s*bi/i.test(lowerRole) && !/software|developer|swe|sde/i.test(lowerRole)

  // Determine domainKey
  const lowerText = clean.toLowerCase()
  let domainKey = 'general'

  if (isHealthcareRole) {
    domainKey = 'healthcare'
  } else if (isFinanceRole) {
    domainKey = 'finance'
  } else if (isSalesRole) {
    domainKey = 'sales'
  } else if (isDataRole) {
    domainKey = 'data'
  } else if (/test|jasmine|karma|jest|cypress|selenium|playwright|junit|pytest|cucumber|qa\b|automation|tdd\b|root\s*cause/i.test(lowerText)) {
    domainKey = 'qa'
  } else if (/security|spring security|jwt|csrf|auth|oauth|rbac|vulnerabilit|cve|encryption|sanitize|xss/i.test(lowerText)) {
    domainKey = 'security'
  } else if (/frontend|front-end|ui\b|ux\b|react|vue|angular|component|css|html|figma|zeplin|bootstrap|tailwind|wcag|accessibility|screen reader|wireframe|dom\b/i.test(lowerText)) {
    domainKey = 'frontend'
  } else if (/database|mongodb|postgres|nosql|indexing|aggregation|schema|store|table/i.test(lowerText) && !/python.*script/i.test(lowerText)) {
    domainKey = 'database'
  } else if (/python|script|automate data|migration|etl|pipeline|reporting|dbt|snowflake|tableau|analytics|sql\b|query|queries/i.test(lowerText)) {
    domainKey = 'data'
  } else if (/ai\b|machine learning|ml\b|llm|nlp|rag\b|spring ai|embeddings|vector|prompt/i.test(lowerText)) {
    domainKey = 'ai'
  } else if (/kubernetes|docker|terraform|ci\/cd|aws|gcp|azure|devops|sre/i.test(lowerText)) {
    domainKey = 'devops'
  } else if (/api|service|microservice|backend|spring boot|express|node|rest|cms|monolith/i.test(lowerText)) {
    domainKey = 'backend'
  }

  // Determine leading verb
  let leadingVerb = ''
  let remainingAction = coreAction

  // If coreAction starts with answered / handling / weak verbs, map them cleanly
  if (lowerFirst === 'answered' || lowerFirst === 'answering' || lowerFirst === 'answer') {
    leadingVerb = isCurrentRole ? 'Synthesize' : 'Synthesized'
    remainingAction = coreAction.slice(rawFirstWord.length).trim()
  } else if (lowerFirst === 'handled' || lowerFirst === 'handling' || lowerFirst === 'handle') {
    leadingVerb = isCurrentRole ? 'Resolve' : 'Resolved'
    remainingAction = coreAction.slice(rawFirstWord.length).trim()
  } else if (strongActionVerbs.has(lowerFirst) || /^[A-Za-z]+ed\b/.test(coreAction)) {
    leadingVerb = strongActionVerbs.get(lowerFirst) || (rawFirstWord.charAt(0).toUpperCase() + rawFirstWord.slice(1).toLowerCase())
    if (isCurrentRole) {
      leadingVerb = toPresentTense(leadingVerb)
    } else {
      leadingVerb = toPastTense(leadingVerb)
    }
    remainingAction = coreAction.slice(rawFirstWord.length).trim()
  } else {
    // Pick default by domain
    if (domainKey === 'qa') leadingVerb = isCurrentRole ? 'Automate' : 'Automated'
    else if (domainKey === 'security') leadingVerb = isCurrentRole ? 'Harden' : 'Hardened'
    else if (domainKey === 'frontend') leadingVerb = isCurrentRole ? 'Modernize' : 'Modernized'
    else if (domainKey === 'database') leadingVerb = isCurrentRole ? 'Optimize' : 'Optimized'
    else if (domainKey === 'data') leadingVerb = isCurrentRole ? 'Automate' : 'Automated'
    else if (domainKey === 'ai') leadingVerb = isCurrentRole ? 'Deploy' : 'Deployed'
    else if (domainKey === 'backend') leadingVerb = isCurrentRole ? 'Architect' : 'Architected'
    else if (domainKey === 'healthcare') leadingVerb = isCurrentRole ? 'Coordinate' : 'Coordinated'
    else if (domainKey === 'finance') leadingVerb = isCurrentRole ? 'Standardize' : 'Standardized'
    else if (domainKey === 'sales') leadingVerb = isCurrentRole ? 'Accelerate' : 'Accelerated'
    else leadingVerb = isCurrentRole ? 'Engineer' : 'Engineered'
  }

  // Strip repeated verb or participle from remainingAction to avoid double verbs:
  // e.g. "Automated automated testing", "Hardened secured", "Modernized applied", "Engineered ran"
  remainingAction = remainingAction
    .replace(/^(?:automated|automating|drove|driven|driving|secured|securing|applied|applying|redesigned|redesigning|prototyped|prototyping|built|building|developed|developing|engineered|engineering|architected|architecting|tested|testing|implemented|implementing|maintained|maintaining|conducted|conducting|performed|performing|executed|executing|wrote|writing|answered|answering|handled|handling|addressed|addressing|gathered|gathering|tracked|tracking|monitored|monitoring|analyzed|analyzing|served|serving|provided|providing|ran|running|run|led|leading|lead|made|making|sent|sending|held|holding|kept|keeping|sold|selling|met|meeting|grew|growing|taught|teaching|brought|bringing|found|finding)\s+/i, '')
    .trim()

  // Clean specific phrase remnants
  remainingAction = remainingAction
    .replace(/^integration testing,\s*and\s+/i, 'unit and integration testing with ')
    .replace(/^(?:and|of|the|to|for|in|on|with|across)\s+/i, '')
    .trim()

  // If first character is lowercase, adjust, preserving acronyms and proper tech nouns
  if (remainingAction.length > 0) {
    if (!/^[A-Z]{2,}\b/.test(remainingAction) && !/^(?:Spring|React|Angular|Vue|Python|Java|Node|MongoDB|SQL|AWS|Docker|Kubernetes|Bootstrap|PostgreSQL|TypeScript|JavaScript|Jest|Karma|Jasmine|Zeplin|D3|MERN|EHR|Epic|HIPAA|GAAP|SAP|REST|QA|UI|UX|API|CMS)\b/i.test(remainingAction)) {
      remainingAction = remainingAction.charAt(0).toLowerCase() + remainingAction.slice(1)
    }
  }

  // Case A: PRESERVE EXISTING METRIC if already quantified
  if (alreadyQuantified) {
    if (hasCarStructure && resultClause) {
      // Check if challenge had scale e.g. 100,000+ bank employees
      let challengeContext = ''
      const challengeScale = challengeClause.match(/\b\d+(?:,\d{3})*\+?\s*(?:bank employees|employees|users|clients|customers|transactions)\b/i)
      if (challengeScale && !new RegExp(challengeScale[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(remainingAction)) {
        challengeContext = ` serving ${challengeScale[0]}`
      }

      // Convert resultClause to gerund if needed
      let formattedResult = resultClause
        .replace(/^Achieved\s+/i, 'achieving ')
        .replace(/^Delivered\s+/i, 'delivering ')
        .replace(/^Reduced\s+/i, 'reducing ')
        .replace(/^Cut\s+/i, 'cutting ')
        .replace(/^Improved\s+/i, 'improving ')
        .replace(/^Enabled\s+/i, 'enabling ')
        .replace(/^Strengthened\s+/i, 'strengthening ')
        .replace(/^Produced\s+/i, 'producing ')
        .replace(/^Supported\s+/i, 'supporting ')
        .replace(/^Streamlined\s+/i, 'streamlining ')
        .replace(/^Speeding\s+up\s+/i, 'accelerating ')

      if (/^[A-Z]/.test(formattedResult)) {
        formattedResult = formattedResult.charAt(0).toLowerCase() + formattedResult.slice(1)
      }

      let res = `${leadingVerb} ${remainingAction}${challengeContext}, ${formattedResult}.`
      return cleanRewriteText(res)
    } else {
      // Standard quantified bullet without CAR
      let res = `${leadingVerb} ${remainingAction}.`
      return cleanRewriteText(res)
    }
  }

  // Case B: UNQUANTIFIED BULLET -> Calibrate unique context-matched metric
  // If remainingAction ends with an unquantified trailing outcome clause (e.g. ", identifying high-value leads and driving targeted engagement strategies")
  // strip that unquantified clause so we replace it with the calibrated outcome rather than appending a duplicate outcome
  const trailingOutcomeMatch = remainingAction.match(/,\s*(?:identifying|driving|enabling|resulting in|improving|reducing|cutting|delivering|ensuring|increasing|supporting|streamlining|accelerating|saving)\b.*$/i)
  if (trailingOutcomeMatch) {
    remainingAction = remainingAction.slice(0, trailingOutcomeMatch.index).trim()
  }

  const pool = DOMAIN_METRIC_POOLS[domainKey] || DOMAIN_METRIC_POOLS.general
  let selectedVariant = null
  for (const v of pool) {
    if (!usedMetricsSet.has(v.key)) {
      selectedVariant = v
      break
    }
  }
  if (!selectedVariant) {
    selectedVariant = pool[bulletIndex % pool.length]
  }
  usedMetricsSet.add(selectedVariant.key)

  let res = `${leadingVerb} ${remainingAction}, ${selectedVariant.outcome}.`
  return cleanRewriteText(res)
}

/**
 * Generates a deterministic action-oriented rewrite for a bullet.
 * Normalizes opening gerund participles (-ing) into direct action verbs and
 * ensures every IMPROVE or FIX bullet has a concrete ready-to-copy rewrite.
 */
export function generateDeterministicRewrite(bulletText, sig, isCurrentRole, targetRole = '', usedMetricsSet = new Set()) {
  if (!bulletText) return null
  let clean = bulletText
    .replace(/^[•\-*▪–—\s]+/, '')
    .replace(/^(?:action|task|situation|result|challenge):\s*/i, '')
    .trim()
  const originalClean = clean
  const openingWord = sig?.openingWord || clean.split(/\s+/)[0] || ''

  // Special case: AI / Copilot prompt engineering
  if (/^using prompt engineering with (?:microsoft\s+copilot|copilot|ai tools)/i.test(clean)) {
    const copilotRewrite = 'Engineered automated unit tests and surfaced critical edge cases (null payloads, expired JWT tokens, RBAC boundaries) using Microsoft Copilot prompt engineering by architecting production validation guardrails, enhancing operational throughput and reducing defect leakage.'
    return sanitizeSingleAddPlaceholder(copilotRewrite)
  }

  let matchedOpener = false

  // Special case: "Analyze complex business questions..." or "Answered complex business questions..."
  if (/^(?:analyze|analyzed|answered?|answering)\s+complex\s+business\s+questions\b/i.test(clean)) {
    if (isCurrentRole) {
      clean = clean.replace(/^(?:analyze|analyzed|answered?|answering)\s+complex\s+business\s+questions(?:\s+with\s+sql)?\b/i, 'Translate complex business questions into SQL-backed executive briefings')
    } else {
      clean = clean.replace(/^(?:analyze|analyzed|answered?|answering)\s+complex\s+business\s+questions(?:\s+with\s+sql)?\b/i, 'Synthesized complex business questions with SQL and delivered executive briefings')
    }
    matchedOpener = true
  } else if (!isCurrentRole && /^analyze\b/i.test(clean)) {
    clean = clean.replace(/^analyze\b/i, 'Analyzed')
  }

  // 1. Handle "Collaborated with <noun> to <verb>" or "Partnered with <noun> to <verb>"
  const collabToVerbMatch = clean.match(/^(?:collaborated with|collaborating with|partnered with|partnering with)\s+(.+?)\s+to\s+([a-zA-Z]+)\s+(.*)$/i)
  if (collabToVerbMatch) {
    const [, partners, rawVerb, rest] = collabToVerbMatch
    const promotedVerb = isCurrentRole ? (rawVerb.charAt(0).toUpperCase() + rawVerb.slice(1).toLowerCase()) : toPastTense(rawVerb)
    clean = `${promotedVerb} ${rest.trim().replace(/[.]+$/, '')} in close partnership with ${partners.trim()}`
    matchedOpener = true
  } else if (!matchedOpener && /^(?:collaborated with|collaborating with)\b/i.test(clean)) {
    const partnerVerb = isCurrentRole ? 'Partner with' : 'Partnered with'
    clean = clean.replace(/^(?:collaborated with|collaborating with)\s+(?:the\s+)?/i, `${partnerVerb} `)
    matchedOpener = true
  }

  // 2. Replace weak/passive openers with strong ownership verbs
  if (!matchedOpener) {
    const weakOpeners = [
      { pattern: /^(?:responsible for|tasked with|was responsible for)\s+(?:the\s+)?/i, verb: isCurrentRole ? 'Architect' : 'Architected' },
      { pattern: /^(?:worked on|working on)\s+(?:the\s+)?/i, verb: isCurrentRole ? 'Engineer' : 'Engineered' },
      { pattern: /^(?:helped with|helped to|assisted with|assisted in|participated in|helped)\s+(?:the\s+)?/i, verb: isCurrentRole ? 'Lead' : 'Led' },
      { pattern: /^(?:supported|supporting)\s+(?:the\s+)?/i, verb: isCurrentRole ? 'Deliver and maintain' : 'Delivered and maintained' },
      { pattern: /^(?:contributed to decomposing|decomposing)\s+(?:the\s+)?/i, verb: isCurrentRole ? 'Decompose' : 'Decomposed' },
      { pattern: /^(?:contributed to|contributed in|contributing to)\s+(?:the\s+)?/i, verb: isCurrentRole ? 'Spearhead' : 'Spearheaded' },
      { pattern: /^(?:partnered with|partnering with)\s+(?:the\s+)?/i, verb: isCurrentRole ? 'Partner with' : 'Partnered with' },
      { pattern: /^(?:managing|managed to)\s+(?:the\s+)?/i, verb: isCurrentRole ? 'Direct' : 'Directed' },
      { pattern: /^(?:using|utilized)\s+/i, verb: isCurrentRole ? 'Apply' : 'Applied' },
      { pattern: /^(?:implemented|implementing)\s+(?:the\s+)?/i, verb: null },
      { pattern: /^(?:integrated|integrating)\s+(?:the\s+)?/i, verb: null },
      { pattern: /^(?:developed|built|created|wrote|handled)\s+/i, verb: null },
    ]

    for (const { pattern, verb } of weakOpeners) {
      if (pattern.test(clean)) {
        clean = clean.replace(pattern, '')
        const firstWord = clean.split(/\s+/)[0] || ''
        if (/^[a-zA-Z]+ing$/i.test(firstWord)) {
          const targetVerb = normalizeGerundVerb(firstWord, isCurrentRole)
          clean = clean.replace(new RegExp(`^${firstWord}\\b`, 'i'), targetVerb)
        } else if (verb) {
          clean = `${verb} ${clean}`
        } else {
          // Domain-calibrated power verb replacement
          let domainVerb = isCurrentRole ? 'Engineer' : 'Engineered'
          const lower = clean.toLowerCase()
          if (/nurse|nursing|clinical|health|patient|medical/i.test(targetRole) || /patient|clinical|triage|care/i.test(lower)) {
            domainVerb = isCurrentRole ? 'Administer' : 'Administered'
          } else if (/finance|accounting|accountant|cpa|auditor/i.test(targetRole) || /reconciliation|financial|audit|tax/i.test(lower)) {
            domainVerb = isCurrentRole ? 'Reconcile' : 'Reconciled'
          } else if (/sales|account\s+exec|b2b/i.test(targetRole) || /pipeline|quota|prospecting|deal/i.test(lower)) {
            domainVerb = isCurrentRole ? 'Accelerate' : 'Accelerated'
          } else if (/product/i.test(targetRole) || /roadmap|user stories|backlog/i.test(lower)) {
            domainVerb = isCurrentRole ? 'Spearhead' : 'Spearheaded'
          } else if (lower.includes('api') || lower.includes('microservice') || lower.includes('backend') || lower.includes('system') || lower.includes('service')) {
            domainVerb = isCurrentRole ? 'Architect' : 'Architected'
          } else if (lower.includes('security') || lower.includes('auth') || lower.includes('jwt') || lower.includes('oauth') || lower.includes('hipaa')) {
            domainVerb = isCurrentRole ? 'Harden' : 'Hardened'
          } else if (lower.includes('performance') || lower.includes('latency') || lower.includes('sql') || lower.includes('query') || lower.includes('caching')) {
            domainVerb = isCurrentRole ? 'Optimize' : 'Optimized'
          } else if (lower.includes('ui') || lower.includes('component') || lower.includes('frontend') || lower.includes('react') || lower.includes('wcag') || lower.includes('d3')) {
            domainVerb = isCurrentRole ? 'Modernize' : 'Modernized'
          } else if (lower.includes('test') || lower.includes('ci/cd') || lower.includes('pipeline') || lower.includes('automation') || lower.includes('jest') || lower.includes('qa')) {
            domainVerb = isCurrentRole ? 'Automate' : 'Automated'
          }
          clean = `${domainVerb} ${clean}`
        }
        matchedOpener = true
        break
      }
    }
  }

  // 3. If starts with gerund (-ing) participle
  if (!matchedOpener && /^[a-zA-Z]+ing$/i.test(openingWord)) {
    let targetVerb = normalizeGerundVerb(openingWord, isCurrentRole)
    if (/^using$/i.test(openingWord)) {
      targetVerb = isCurrentRole ? 'Apply' : 'Applied'
    }
    clean = clean.replace(new RegExp(`^${openingWord}\\b`, 'i'), targetVerb)
  }

  // 4. Domain Archetype & Google XYZ Architectural Mechanism Enforcement
  const isHealthcare = /nurse|nursing|clinical|health|patient|medical|hospital/i.test(targetRole) || /patient|clinical|triage|bedside|vitals|ehr|hipaa|medication/i.test(clean)
  const isFinance = /finance|accounting|accountant|cpa|auditor|financial|tax|treasury|controller/i.test(targetRole) || /gaap|reconciliation|general ledger|month-end|financial statements|audit|tax|invoice|fp&a/i.test(clean)
  const isSalesMarketing = /sales|marketing|account executive|business development|growth|crm/i.test(targetRole) || /pipeline|quota|crm|lead generation|conversion rate|campaign|b2b/i.test(clean)
  const isProduct = /product\s*(manager|owner|lead)/i.test(targetRole) || /roadmap|backlog|user stories|prd\b|feature prioritization/i.test(clean)
  const isOperations = /operations|supply\s+chain|logistics|procurement|warehouse/i.test(targetRole) || /inventory|supply chain|logistics|sla|procurement/i.test(clean)
  const isDataRole = /data|analyst|analytics|bi\b|business\s+intelligence|tableau|power\s*bi/i.test(targetRole) || /tableau|power\s*bi|sql|looker|star-schema|dbt|bigquery|snowflake/i.test(clean)
  const isAiRole = /ai\b|artificial\s+intelligence|machine\s+learning|ml\b|llm|nlp|prompt|rag\b/i.test(targetRole) || /llm|langchain|rag|pytorch|vector/i.test(clean)
  const isDevopsRole = /devops|cloud|sre|infrastructure|platform|kubernetes/i.test(targetRole) || /kubernetes|docker|terraform|ci\/cd|aws|gcp|azure/i.test(clean)

  let domainMechanism = ''
  let domainOutcome = ''

  if (/security|xss|vulnerabilit|cve|sanitize|input validation|auth|jwt|oauth/i.test(clean)) {
    domainMechanism = 'by implementing automated DevSecOps vulnerability scanning and strict payload validation'
    domainOutcome = 'eliminating high-severity CVEs and ensuring 100% security audit compliance across release pipelines'
  } else if (isHealthcare) {
    domainMechanism = 'by standardizing clinical documentation workflows and patient care protocols'
    domainOutcome = 'improving patient safety outcomes, ensuring HIPAA compliance, and elevating quality of care scores'
  } else if (isFinance) {
    domainMechanism = 'by streamlining reconciliation controls and financial reporting workflows'
    domainOutcome = 'accelerating month-end close velocity, reducing variance errors, and ensuring GAAP audit compliance'
  } else if (isSalesMarketing) {
    domainMechanism = 'by implementing targeted pipeline qualification frameworks and CRM automation'
    domainOutcome = 'accelerating deal cycle velocity, increasing lead conversion rates, and exceeding quarterly quota targets'
  } else if (isProduct) {
    domainMechanism = 'by instituting data-driven user discovery sprints and cross-functional roadmap alignment'
    domainOutcome = 'accelerating feature delivery velocity, driving user adoption, and aligning product execution with strategic KPIs'
  } else if (isOperations) {
    domainMechanism = 'by standardizing operational fulfillment processes and vendor SLAs'
    domainOutcome = 'optimizing supply chain throughput, reducing cycle times, and sustaining high fulfillment reliability'
  } else if (isDataRole) {
    domainMechanism = 'by architecting automated star-schema data models and dbt test assertions'
    domainOutcome = 'enhancing reporting adoption, reducing turnaround time, and enabling data-driven executive decisions'
  } else if (isAiRole) {
    domainMechanism = 'by architecting production vector retrieval pipelines with automated context-caching guardrails'
    domainOutcome = 'minimizing token latency, eliminating hallucination risks, and sustaining reliable sub-second inference'
  } else if (isDevopsRole) {
    domainMechanism = 'by orchestrating multi-stage Docker builds and automated Kubernetes rolling deployments'
    domainOutcome = 'sustaining 99.99% service availability, accelerating release velocity, and ensuring zero-downtime rollouts'
  } else {
    // Default / Software / Backend Engineer
    domainMechanism = 'by establishing decoupled microservice boundaries and resilient caching'
    domainOutcome = 'enhancing operational throughput, reducing execution latency, and ensuring continuous production uptime'
  }

  const cleanWithoutVersions = clean
    .replace(/\b(?:react|angular|vue|python|d3|node|es|wcag|oauth|jwt|html|css)\.?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\bv\d+(?:\.\d+)?\b/gi, '')
  const hasRealMetric =
    sig?.hasQuantifier ||
    sig?.hasMetric ||
    /\d+(?:\.\d+)?%|\b\d+\s*(?:ms|milliseconds?|seconds?|mins?|minutes?|hours?|k|m|million|billion|users|rps|qps|requests|tps|events)\b|\$\s*\d+|\b\d{2,}\s+(?:production|enterprise|distributed|active|concurrent|client)/i.test(cleanWithoutVersions)

  const hasArchitecturalMechanism = /\bby\s+(?:architecting|engineering|transitioning|developing|implementing|establishing|building|automating|optimizing|orchestrating|designing|deploying|adopting|utilizing)\b/i.test(clean)

  // If the rewrite is a lazy suffix append or lacks a real metric/mechanism, use applyLightVerbFix instead of patching canned playbook text
  if (isLazySuffixAppend(clean, originalClean) || (!hasRealMetric && !hasArchitecturalMechanism)) {
    return applyLightVerbFix(originalClean, sig, isCurrentRole)
  }

  // 5. Clean punctuation and whitespace
  clean = clean.replace(/\s{2,}/g, ' ').trim()
  if (!/[.!?]$/.test(clean) && !clean.endsWith(']')) {
    clean = `${clean}.`
  }

  return sanitizeSingleAddPlaceholder(clean)
}

export const GRADE_BANDS = [
  { min: 85, grade: 'A', label: 'Excellent' },
  { min: 70, grade: 'B', label: 'Good' },
  { min: 55, grade: 'C', label: 'Needs Work' },
  { min: 40, grade: 'D', label: 'Weak' },
  { min: 0, grade: 'F', label: 'Critical' },
]

const CATEGORY_META = [
  { key: 'impact', label: 'Impact', weight: 0.26 },
  { key: 'positioning', label: 'Positioning', weight: 0.18 },
  { key: 'ats_readability', label: 'ATS Safety', weight: 0.16 },
  { key: 'credibility', label: 'Credibility', weight: 0.15 },
  { key: 'brevity', label: 'Brevity', weight: 0.14 },
  { key: 'us_market_alignment', label: 'US Alignment', weight: 0.11 },
]

const gradeFor = (score) => GRADE_BANDS.find((b) => score >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const round = (v) => Math.round(v)

const ISSUE_CATEGORY_MAP = {
  impact: 'impact',
  outcome_visibility: 'impact',
  positioning: 'positioning',
  clarity: 'positioning',
  ownership_clarity: 'positioning',
  structure: 'ats_readability',
  ats_readability: 'ats_readability',
  repetition: 'ats_readability',
  credibility: 'credibility',
  skill_evidence_gap: 'credibility',
  us_market_alignment: 'us_market_alignment',
  brevity: 'brevity',
}

/**
 * Words per bullet, averaged — used for the brevity category.
 */
function bulletLengthStats(canonicalResume) {
  const lengths = []
  const rawExperiences = canonicalResume?.experiences || canonicalResume?.experience || []
  for (const section of [rawExperiences, canonicalResume?.projects]) {
    for (const item of section || []) {
      for (const b of item.bullets || []) {
        if (b?.text) lengths.push(b.text.trim().split(/\s+/).length)
      }
    }
  }
  if (lengths.length === 0) return { avg: 0, over35: 0, total: 0 }
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length
  return { avg: Number(avg.toFixed(1)), over35: lengths.filter((l) => l > 35).length, total: lengths.length }
}

/**
 * Computes the full scorecard. Pure function.
 */
export function computeScorecard({
  analysis,
  canonicalResume,
  precomputedSignals,
  bulletSignalsList: directBulletSignalsList = [],
  usMarketSignals,
  validation,
  pageCount = null,
  targetJobDescription = '',
  targetRole = '',
  marketProfile = null,
  rawResumeText: passedRawResumeText = '',
  state = null,
  parsedDoc = null,
  userAnswers = null,
  answers = null,
}) {
  const issues = Array.isArray(analysis?.issues) ? analysis.issues.filter(Boolean) : []
  const strengths = Array.isArray(analysis?.strengths) ? analysis.strengths.filter(Boolean) : []
  const flags = usMarketSignals?.flags || {}
  const usObs = usMarketSignals?.observations || []
  const quant = precomputedSignals?.quantification || {}
  let bulletSignalsList = precomputedSignals?.bulletSignalsList || directBulletSignalsList || []
  if (bulletSignalsList.length === 0 && precomputedSignals?.bulletSignals && typeof precomputedSignals.bulletSignals === 'object') {
    bulletSignalsList = Object.entries(precomputedSignals.bulletSignals).map(([bulletId, sig]) => ({ bulletId, ...sig }))
  }
  const contactMerge = precomputedSignals?.contactMerge || {}

  // ── 0. Keyword & JD Alignment (Deterministic) ──────────────────────────────
  const keywordAlignment = computeKeywordAlignment({
    canonicalResume,
    targetJobDescription,
    targetRole,
    marketProfile,
  })

  const cutList = Array.isArray(analysis?.cutList) ? analysis.cutList : []
  const nearMissKeywords = Array.isArray(analysis?.nearMissKeywords) ? analysis.nearMissKeywords : []

  // ── 1. Bullet audit (Computed first so verdicts feed into dimensions & checks) ──
  const bulletAudit = buildBulletAudit({
    analysis,
    canonicalResume,
    bulletSignalsList,
    llmBulletRewrites: analysis?.bulletRewrites || analysis?.llmBulletRewrites || [],
    targetRole: targetRole || analysis?.candidateSnapshot?.targetRole || canonicalResume?.candidate?.targetRole || canonicalResume?.targetRole || '',
  })

  const helpingCount = bulletAudit.filter((b) => b.verdict === 'helping').length
  const hurtingCount = bulletAudit.filter((b) => b.verdict === 'hurting').length
  const totalBullets = bulletAudit.length
  const helpingSummary = { helpingCount, hurtingCount, totalBullets }

  // YOE & 1-page overflow check (<8 YOE should fit on 1 page)
  const rawYoe = canonicalResume?.candidate?.totalExperienceYears ?? precomputedSignals?.timeline?.totalExperienceYears
  const yoe = typeof rawYoe === 'number' ? rawYoe : 3
  const isUnder8Yoe = yoe < 8
  const isPageOverflowUnder8 = isUnder8Yoe && typeof pageCount === 'number' && pageCount > 1

  // ── 2. Category scores ─────────────────────────────────────────────────────
  const categoryPenalties = {}
  for (const meta of CATEGORY_META) categoryPenalties[meta.key] = 0

  for (const issue of issues) {
    const key = ISSUE_CATEGORY_MAP[issue.category]
    if (key && categoryPenalties[key] !== undefined) {
      categoryPenalties[key] += SEVERITY_PENALTY[issue.severity] || SEVERITY_PENALTY.low
    }
  }

  const scores = {}

  // Impact: issues + quantification bonus + strength bonus - hurting bullets penalty + 5-part completeness
  const activeParts = bulletAudit.reduce((sum, b) => sum + Object.values(b.fivePartFlags || {}).filter(Boolean).length, 0)
  const totalPossibleParts = Math.max(1, totalBullets * 5)
  const fivePartRatio = activeParts / totalPossibleParts
  const fivePartBonus = fivePartRatio >= 0.7 ? 5 : 0
  const hurtingPenalty = Math.min(hurtingCount * 2, 12)

  scores.impact = clamp(
    100 - categoryPenalties.impact + (quant.density || 0) * 12 + Math.min(strengths.length, 4) * 2 - hurtingPenalty + fivePartBonus,
    5,
    100
  )

  // Positioning: issues - responsibility-only bullets penalty - near-miss keywords penalty
  const respOnlyCount = bulletAudit.filter((b) => b.isResponsibilityOnly).length
  const respOnlyPenalty = Math.min(respOnlyCount * 3, 12)
  const nearMissPenalty = Math.min(nearMissKeywords.length * 2, 8)
  scores.positioning = clamp(100 - categoryPenalties.positioning - respOnlyPenalty - nearMissPenalty, 5, 100)

  // ATS safety: issues + contact-merge structural signal
  const contactPenalty = contactMerge.isContactMerged ? 8 : 0
  scores.ats_readability = clamp(100 - categoryPenalties.ats_readability - contactPenalty, 5, 100)

  // Credibility: issues + fabrication/assumption warnings
  const fabricationWarnings = (validation?.warnings || []).filter(
    (w) => /fabricated|unsupported|assumption|placeholder/i.test(String(w))
  ).length
  scores.credibility = clamp(100 - categoryPenalties.credibility - Math.min(fabricationWarnings * 4, 20), 5, 100)

  // Brevity: bullet length stats + brevity issues + page count + cutList penalty + overflow for <8 YOE
  const len = bulletLengthStats(canonicalResume)
  let brevity = 100 - categoryPenalties.brevity
  if (len.avg > 38) brevity -= Math.min((len.avg - 38) * 1.5, 20)
  if (len.over35 > 0) brevity -= Math.min(len.over35 * 1.5, 8)
  if (typeof pageCount === 'number' && pageCount > 2) brevity -= 15
  if (isPageOverflowUnder8) brevity -= 15
  if (cutList.length > 0) brevity -= Math.min(cutList.length * 3, 12)
  scores.brevity = clamp(brevity, 5, 100)

  // US alignment: from deterministic signal observations (high=25, med=12, low=6)
  let usScore = 100
  for (const obs of usObs) {
    usScore -= obs.weight === 'high' ? 25 : obs.weight === 'medium' ? 12 : 6
  }
  scores.us_market_alignment = clamp(usScore, 5, 100)

  // ── 3. Overall weighted score ──────────────────────────────────────────────
  let overall = 0
  for (const meta of CATEGORY_META) {
    overall += scores[meta.key] * meta.weight
  }

  // Ensure non-formatting categories (impact, positioning, credibility) are preserved
  // Only cap by worst category if the failing category is a CORE category (impact, positioning, credibility)
  const coreCategories = ['impact', 'positioning', 'credibility']
  const worstCoreCategory = Math.min(...coreCategories.map((k) => scores[k]))

  // Cap overall score gracefully: worst core category + 45 (minimum 5, maximum 100)
  overall = Math.min(overall, Math.max(worstCoreCategory + 45, 80))
  const score = clamp(round(overall), 5, 100)
  const { grade, label } = gradeFor(score)

  const grades = {}
  for (const meta of CATEGORY_META) {
    const g = gradeFor(round(scores[meta.key]))
    grades[meta.key] = {
      label: meta.label,
      score: round(scores[meta.key]),
      grade: g.grade,
      gradeLabel: g.label,
      facts: factLines(meta.key, { quant, len, usObs, flags, categoryPenalties, fabricationWarnings, contactMerge, helpingSummary, cutList, nearMissKeywords }),
    }
  }

  // ── 4. Checklist (pass/warn/fail rows) ─────────────────────────────────────
  const checks = buildChecks({
    issues,
    quant,
    bulletSignalsList,
    contactMerge,
    flags,
    len,
    pageCount,
    canonicalResume,
    bulletAudit,
    cutList,
    nearMissKeywords,
    helpingSummary,
    isPageOverflowUnder8,
  })

  // ── 5. Section-by-Section /10 Audit (Video-Style Playbook Framework) ─────
  const contact = canonicalResume?.candidate?.contact || {}
  const effectiveAnswers = userAnswers || answers || state?.answers || {}
  const rawResumeText = passedRawResumeText ||
                        canonicalResume?.rawText ||
                        canonicalResume?.text ||
                        canonicalResume?.metadata?.rawTextPreview ||
                        precomputedSignals?.rawText ||
                        state?.resumeText ||
                        parsedDoc?.rawText ||
                        parsedDoc?.text ||
                        ''

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{4,5}|\b\d{10,12}\b/
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in\/[a-zA-Z0-9_%-]+|[a-zA-Z0-9_%-]+)/i

  const hasEmail = Boolean(contact.email && contact.email !== 'N/A') ||
                   Boolean(canonicalResume?.candidate?.email && canonicalResume.candidate.email !== 'N/A') ||
                   Boolean(canonicalResume?.candidate?.contact?.email && canonicalResume.candidate.contact.email !== 'N/A') ||
                   Boolean(precomputedSignals?.contactMerge?.emailDetected) ||
                   Boolean(rawResumeText && emailRegex.test(rawResumeText)) ||
                   Boolean(effectiveAnswers?.email && emailRegex.test(effectiveAnswers.email)) ||
                   Boolean(state?.candidateEmail && emailRegex.test(state.candidateEmail))

  const hasPhone = Boolean(contact.phone && contact.phone !== 'N/A') ||
                   Boolean(canonicalResume?.candidate?.phone && canonicalResume.candidate.phone !== 'N/A') ||
                   Boolean(canonicalResume?.candidate?.contact?.phone && canonicalResume.candidate.contact.phone !== 'N/A') ||
                   Boolean(precomputedSignals?.contactMerge?.phoneDetected) ||
                   Boolean(rawResumeText && (extractCleanPhoneNumber(rawResumeText) || phoneRegex.test(rawResumeText))) ||
                   Boolean(effectiveAnswers?.phone && (extractCleanPhoneNumber(effectiveAnswers.phone) || phoneRegex.test(effectiveAnswers.phone))) ||
                   Boolean(state?.candidatePhone && (extractCleanPhoneNumber(state.candidatePhone) || phoneRegex.test(state.candidatePhone)))

  const hasLinkedin = Boolean(contact.linkedin) ||
                      Boolean(canonicalResume?.candidate?.linkedin) ||
                      Boolean(canonicalResume?.candidate?.contact?.linkedin) ||
                      Boolean(precomputedSignals?.contactMerge?.urlDetected) ||
                      Boolean(rawResumeText && linkedinRegex.test(rawResumeText)) ||
                      Boolean(effectiveAnswers?.linkedin && linkedinRegex.test(effectiveAnswers.linkedin)) ||
                      Boolean(effectiveAnswers?.linkedinUrl && linkedinRegex.test(effectiveAnswers.linkedinUrl)) ||
                      Boolean(state?.linkedinUrl && linkedinRegex.test(state.linkedinUrl))

  const hasNonUsPersonal = Boolean(flags.photoPresent || flags.maritalStatusPresent || flags.dobPresent || flags.fullAddressPresent)

  // 1. Header & Contact Parsing (/10)
  let headerScore = 10
  if (contactMerge.isContactMerged) headerScore -= 3
  if (!hasEmail || !hasPhone) headerScore -= 4
  if (!hasLinkedin) headerScore -= 2
  if (hasNonUsPersonal) headerScore -= 3
  const headerScore10 = clamp(headerScore, 1, 10)
  const headerStatus = headerScore10 >= 9 ? 'pass' : headerScore10 >= 6 ? 'warn' : 'fail'
  const headerHurting = headerScore10 >= 9
    ? null
    : contactMerge.isContactMerged
    ? 'Extracted contact details merged into summary text, creating ATS parsing hazards for phone and LinkedIn links.'
    : (!hasEmail || !hasPhone)
    ? 'Missing direct email or phone number in contact header, preventing recruiter outreach.'
    : !hasLinkedin
    ? 'No LinkedIn profile URL detected in contact header, missing instant recruiter verification.'
    : hasNonUsPersonal
    ? 'Header contains personal details (photo, DOB, or marital status) that US hiring teams filter out for compliance.'
    : null
  const headerImprovement = 'Format contact info as a clean single line at the top: Name | Location | Phone | Email | LinkedIn (no tables, text boxes, or embedded graphics).'

  // 2. Professional Summary (/10)
  const rawSum = canonicalResume?.summary ?? canonicalResume?.candidate?.summary ?? ''
  const sumText = (typeof rawSum === 'string' ? rawSum : (rawSum?.text || rawSum?.summary || '')).trim()
  const sumIssues = issues.filter((i) => i.category === 'generic_summary' || i.category === 'weak_positioning' || i.bulletId === 'summary_001')
  let summaryScore = 10
  if (!sumText || sumText.length < 40) {
    summaryScore = 2
  } else if (sumText.length > 550) {
    summaryScore = 5
  } else {
    if (sumIssues.length > 0) summaryScore -= 3
    if (targetRole && !sumText.toLowerCase().includes(targetRole.toLowerCase())) summaryScore -= 2
  }
  const summaryScore10 = clamp(summaryScore, 1, 10)
  const summaryStatus = summaryScore10 >= 9 ? 'pass' : summaryScore10 >= 6 ? 'warn' : 'fail'
  const summaryHurting = (!sumText || sumText.length < 40)
    ? 'Professional summary is missing or empty, leaving your role positioning unindexed.'
    : sumText.length > 550
    ? 'Summary is overly dense (>550 characters) and reads like a cover letter instead of an executive elevator pitch.'
    : sumIssues.length > 0
    ? 'Summary relies on generic buzzwords without specifying your target role, years of experience, or measurable specialty.'
    : (targetRole && !sumText.toLowerCase().includes(targetRole.toLowerCase()))
    ? `Summary does not explicitly state your target role keyword "${targetRole}".`
    : null
  const summaryImprovement = 'Write a 3-sentence executive pitch: [Target Role] with [X]+ years experience in [Core Stack], with a proven track record of [Primary Measurable Achievement].'

  // 3. Experience Bullets & Quantified Impact (/10)
  const allExpBullets = bulletAudit.length > 0 ? bulletAudit : []
  const realQuantifiedCount = allExpBullets.filter((b) => b.hasQuantifier === true || isTrueQuantified(b.text || b.originalText || '')).length
  const expTotalBullets = allExpBullets.length > 0 ? allExpBullets.length : (quant.totalBullets || 1)
  const realDensity = expTotalBullets > 0 ? realQuantifiedCount / expTotalBullets : 0
  const effectiveQuant = {
    totalBullets: expTotalBullets,
    quantifiedBullets: realQuantifiedCount,
    density: realDensity,
  }

  let rawExpScore10 = Math.round(scores.impact / 10)
  let expStatus = 'pass'

  // Enforce deterministic rubric ceilings:
  // quantifiedBullets === 0 -> score10 = Math.min(score10, 5) and status = 'warn'
  // quantificationRate < 0.5 -> score10 = Math.min(score10, 7) and status = 'warn'
  if (realQuantifiedCount === 0 || realDensity === 0) {
    rawExpScore10 = Math.min(rawExpScore10, 5)
    expStatus = 'warn'
  } else if (realDensity < 0.5) {
    rawExpScore10 = Math.min(rawExpScore10, 7)
    expStatus = 'warn'
  } else {
    expStatus = rawExpScore10 >= 9 ? 'pass' : rawExpScore10 >= 6 ? 'warn' : 'fail'
  }

  const expScore10 = clamp(rawExpScore10, 1, 10)
  const expHurting = (realQuantifiedCount === 0 || realDensity === 0)
    ? `0 of ${expTotalBullets} bullets (0%) contain measurable metrics. Without quantified outcomes (% or $ scale), recruiters cannot verify your engineering impact.`
    : realDensity < 0.5
    ? `Only ${realQuantifiedCount} of ${expTotalBullets} bullets (${Math.round(realDensity * 100)}%) contain measurable metrics, falling below the 50% recruiter benchmark.`
    : hurtingCount > 2
    ? `${hurtingCount} bullets describe passive responsibilities rather than verified business outcomes.`
    : null
  const expImprovement = 'Rewrite bullets using the formula: Action Verb + Technical Mechanism + Quantified Business Impact (% or $ gain).'

  // 4. Skills & Market Keyword Alignment (/10)
  const kwScore = keywordAlignment?.score ?? 70
  const missingCore = keywordAlignment?.missingCoreKeywords || []
  const skillsCount = canonicalResume?.skills?.length || 0
  const skillsScore10 = clamp(Math.round(kwScore / 10), 1, 10)
  const skillsStatus = skillsScore10 >= 9 ? 'pass' : skillsScore10 >= 6 ? 'warn' : 'fail'
  const skillsHurting = missingCore.length > 0
    ? `Missing ${missingCore.length} priority market keywords (e.g. ${missingCore.slice(0, 3).join(', ')}) expected for ${targetRole || 'your target role'}.`
    : skillsCount < 10
    ? `Only ${skillsCount} skills listed, severely throttling ATS boolean search matching.`
    : null
  const skillsImprovement = 'Add missing core market tools directly to your Skills section and mirror them within your work experience bullet points.'

  // 5. Formatting, Length & ATS Safety (/10)
  const atsScore = scores.ats_readability ?? 80
  const rawFmtScore10 = isPageOverflowUnder8
    ? Math.min(6, Math.round(atsScore / 10))
    : Math.round(atsScore / 10)
  const formattingScore10 = clamp(rawFmtScore10, 1, 10)
  const formattingStatus = formattingScore10 >= 9 ? 'pass' : formattingScore10 >= 6 ? 'warn' : 'fail'
  const formattingHurting = isPageOverflowUnder8
    ? `Resume spans ${pageCount} pages with under 8 years of experience. US recruiters expect strictly 1 page.`
    : len.over35 > 2
    ? `${len.over35} bullets exceed 35 words, creating dense walls of text that recruiters skip during 6-second scans.`
    : atsScore < 75
    ? 'Formatting or layout structure flags potential ATS parsing friction.'
    : null
  const formattingImprovement = isPageOverflowUnder8
    ? 'Trim older roles or secondary bullets to fit cleanly on exactly 1 page.'
    : 'Keep bullet points between 15-28 words with standard clean margins and standard single-column headers.'

  const headerAuditObj = {
    score10: headerScore10,
    status: headerStatus,
    label: 'Header & Contact Parsing',
    name: 'Header & Contact Parsing',
    whatsHurting: headerHurting,
    hurtingReason: headerHurting,
    requiredImprovement: headerImprovement,
  }

  const sectionAudit = {
    headerAndContact: headerAuditObj,
    summary: {
      score10: summaryScore10,
      status: summaryStatus,
      label: 'Professional Summary',
      name: 'Professional Summary',
      whatsHurting: summaryHurting,
      hurtingReason: summaryHurting,
      requiredImprovement: summaryImprovement,
    },
    experience: {
      score10: expScore10,
      status: expStatus,
      label: 'Experience Bullets & Quantified Impact',
      name: 'Work Experience & Bullets',
      whatsHurting: expHurting,
      hurtingReason: expHurting,
      requiredImprovement: expImprovement,
    },
    skills: {
      score10: skillsScore10,
      status: skillsStatus,
      label: 'Skills & Market Keyword Alignment',
      name: 'Technical Skills Architecture',
      whatsHurting: skillsHurting,
      hurtingReason: skillsHurting,
      requiredImprovement: skillsImprovement,
    },
    formatting: {
      score10: formattingScore10,
      status: formattingStatus,
      label: 'Formatting, Length & ATS Safety',
      name: 'Document Layout & ATS Formatting',
      whatsHurting: formattingHurting,
      hurtingReason: formattingHurting,
      requiredImprovement: formattingImprovement,
    },
  }

  return {
    version: SCORECARD_VERSION,
    computedAt: new Date().toISOString(),
    score,
    overallScore: score, // alias for backwards compatibility
    grade,
    gradeLabel: label,
    grades,
    dimensions: grades, // alias for backwards compatibility
    sectionAudit,
    quantification: effectiveQuant,
    bulletStats: effectiveQuant,
    checks,
    checklist: checks, // alias for backwards compatibility
    bulletAudit,
    cutList,
    nearMissKeywords,
    helpingSummary,
    keywordAlignment: {
      ...keywordAlignment,
      missingMarketSkillsRanked: keywordAlignment?.missingMarketSkillsRanked || [], // Full uncapped list
    },
    summary: {
      fix: bulletAudit.filter((b) => b.status === 'fix').length,
      warn: bulletAudit.filter((b) => b.status === 'warn').length,
      pass: bulletAudit.filter((b) => b.status === 'pass').length,
      checksPassed: checks.filter((c) => c.status === 'pass').length,
      checksTotal: checks.length,
      strengths: strengths.length,
      issues: issues.length,
      helping: helpingCount,
      hurting: hurtingCount,
      cutListCount: cutList.length,
      nearMissCount: nearMissKeywords.length,
    },
  }
}

/**
 * One-line factual basis per category grade (shown as tooltip/subtext in UI).
 */
function factLines(key, ctx) {
  const { quant, len, usObs, flags, categoryPenalties, fabricationWarnings, contactMerge, helpingSummary, cutList, nearMissKeywords } = ctx
  switch (key) {
    case 'impact':
      return [
        `${quant.quantifiedBullets ?? '?'} of ${quant.totalBullets ?? '?'} bullets include a hard number`,
        helpingSummary ? `${helpingSummary.helpingCount} helping vs ${helpingSummary.hurtingCount} hurting bullets` : '',
        `Impact issues: ${categoryPenalties.impact > 0 ? 'yes' : 'none'}`,
      ].filter(Boolean)
    case 'positioning':
      return [
        nearMissKeywords?.length > 0 ? `${nearMissKeywords.length} near-miss synonym(s) detected` : 'Direct keyword alignment',
        `Positioning/ownership issues: ${categoryPenalties.positioning > 0 ? 'yes' : 'none'}`,
      ]
    case 'ats_readability':
      return [
        contactMerge.isContactMerged ? 'Contact details merged with summary text' : 'Contact header parses cleanly',
        `ATS issues: ${categoryPenalties.ats_readability > 0 ? 'yes' : 'none'}`,
      ]
    case 'credibility':
      return [
        `Fabrication/assumption warnings: ${fabricationWarnings}`,
        `Skill evidence issues: ${categoryPenalties.credibility > 0 ? 'yes' : 'none'}`,
      ]
    case 'brevity':
      return [
        `Average bullet length: ${len.avg} words`,
        cutList?.length > 0 ? `${cutList.length} filler item(s) on cut-list` : 'Zero fluff items on cut-list',
        len.over35 > 0 ? `${len.over35} bullets over 35 words` : 'All bullets within length',
      ]
    case 'us_market_alignment':
      return [
        usObs.length === 0 ? 'No non-US conventions detected' : `${usObs.length} non-US convention signal(s) detected`,
        flags.personalDetailsDetected ? 'Personal details present' : 'No personal details',
      ]
    default:
      return []
  }
}

/**
 * Builds the Rezi-style pass/warn/fail checklist.
 */
function buildChecks({
  issues,
  quant,
  bulletSignalsList,
  contactMerge,
  flags,
  len,
  pageCount,
  canonicalResume,
  bulletAudit = [],
  cutList = [],
  nearMissKeywords = [],
  helpingSummary = null,
  isPageOverflowUnder8 = false,
}) {
  const checks = []
  const hasIssue = (cat, minSeverity = 'low') =>
    issues.some((i) => i.category === cat && (SEVERITY_PENALTY[i.severity] || 0) >= SEVERITY_PENALTY[minSeverity])

  // 1. Quantified achievements
  const density = quant.density || 0
  checks.push({
    id: 'quantified_evidence',
    label: 'Quantified achievements',
    status: density >= 0.4 ? 'pass' : density >= 0.2 ? 'warn' : 'fail',
    detail: `${quant.quantifiedBullets ?? 0} of ${quant.totalBullets ?? 0} bullets include a hard number`,
    category: 'impact',
  })

  // 2. Outcome verbs & qualitative CAR outcomes + Gerund participle consistency
  const gerundBullets = (bulletSignalsList || []).filter((b) => b?.tenseIssue === 'gerund_opening')
  const withOutcome = (bulletSignalsList || []).filter((b) => b?.hasOutcomeVerb !== false || b?.hasQualitativeOutcome === true).length
  const totalBullets = (bulletSignalsList || []).length
  const outcomeShare = totalBullets > 0 ? withOutcome / totalBullets : 1

  let outcomeStatus = outcomeShare >= 0.7 ? 'pass' : outcomeShare >= 0.4 ? 'warn' : 'fail'
  let outcomeDetail = `${withOutcome} of ${totalBullets} bullets show a clear action/outcome verb or CAR result`

  if (gerundBullets.length >= 3) {
    outcomeStatus = 'warn'
    outcomeDetail = `${gerundBullets.length} bullets open with '-ing' participles (e.g. "${gerundBullets[0].openingWord}") — lead directly with strong present/past action verbs`
  }

  checks.push({
    id: 'outcome_verbs',
    label: 'Bullets lead with outcome or action verbs',
    status: outcomeStatus,
    detail: outcomeDetail,
    category: 'impact',
  })

  // 3. Tool-dump bullets
  const toolDumps = bulletSignalsList.filter((b) => b.isToolDumpCandidate).length
  checks.push({
    id: 'no_tool_dump',
    label: 'No tool-dump bullets',
    status: toolDumps === 0 ? 'pass' : toolDumps <= 2 ? 'warn' : 'fail',
    detail: toolDumps === 0 ? 'Every bullet explains the work, not just the stack' : `${toolDumps} bullet(s) read as a tool list`,
    category: 'impact',
  })

  // 4. Contact header
  checks.push({
    id: 'contact_header',
    label: 'Contact details parse cleanly',
    status: contactMerge.isContactMerged ? 'warn' : 'pass',
    detail: contactMerge.isContactMerged
      ? 'Contact info sits alongside other text — check ATS parsing'
      : 'Email/phone/location are separate and machine-readable',
    category: 'ats_readability',
  })

  // 5-7. US market conventions
  checks.push({
    id: 'no_personal_details',
    label: 'No personal details (US norm)',
    status: flags.personalDetailsDetected ? 'fail' : 'pass',
    detail: flags.personalDetailsDetected
      ? 'US resumes omit DOB, marital status, nationality, photos'
      : 'Nothing a US recruiter would expect removed',
    category: 'us_market_alignment',
  })
  checks.push({
    id: 'no_declaration',
    label: 'No declaration/signature block',
    status: flags.declarationBlockDetected ? 'warn' : 'pass',
    detail: flags.declarationBlockDetected ? 'Common abroad, unused on US resumes' : 'None found',
    category: 'us_market_alignment',
  })
  checks.push({
    id: 'no_objective_section',
    label: 'Uses a summary, not an Objective',
    status: flags.objectiveSectionDetected ? 'warn' : 'pass',
    detail: flags.objectiveSectionDetected ? 'Objective sections are dated for the US market' : 'No Objective section found',
    category: 'us_market_alignment',
  })

  // 8. Skill evidence
  const skillGaps = issues.filter((i) => i.category === 'skill_evidence_gap').length
  checks.push({
    id: 'skill_evidence',
    label: 'Skills backed by evidence',
    status: skillGaps === 0 ? 'pass' : 'warn',
    detail: skillGaps === 0 ? 'Listed skills appear in your experience or projects' : `${skillGaps} skill evidence gap(s) flagged`,
    category: 'credibility',
  })

  // 9. Bullet length
  checks.push({
    id: 'bullet_length',
    label: 'Bullet length (1-2 lines)',
    status: len.avg <= 30 && len.over35 === 0 ? 'pass' : len.avg <= 35 ? 'warn' : 'fail',
    detail: `Average ${len.avg} words${len.over35 > 0 ? `, ${len.over35} over 35` : ''}`,
    category: 'brevity',
  })

  // 10. Page count
  if (typeof pageCount === 'number' && pageCount > 0) {
    checks.push({
      id: 'page_count',
      label: '1-2 page length',
      status: pageCount <= 2 ? 'pass' : 'warn',
      detail: `Parsed document is approximately ${pageCount} page(s)`,
      category: 'brevity',
    })
  }

  // 11. Certifications present
  const certCount = (canonicalResume?.certifications || []).length
  checks.push({
    id: 'certifications',
    label: 'Certifications / licenses included',
    status: certCount > 0 ? 'pass' : 'warn',
    detail: certCount > 0 ? `${certCount} certification(s) found` : 'No certifications listed — add any you hold',
    category: 'credibility',
  })

  // 12. Duplicate content
  const repIssues = issues.filter((i) => i.category === 'repetition').length
  checks.push({
    id: 'no_repetition',
    label: 'No repeated achievements',
    status: repIssues === 0 ? 'pass' : 'warn',
    detail: repIssues === 0 ? 'Each bullet carries distinct content' : `${repIssues} repetition issue(s) flagged`,
    category: 'impact',
  })

  // 13. 5-Part winning bullet formula (helping vs hurting)
  const hurtingCount = helpingSummary?.hurtingCount ?? 0
  const totalAuditBullets = helpingSummary?.totalBullets ?? bulletAudit.length
  checks.push({
    id: 'five_part_bullets',
    label: '5-Part winning bullet formula',
    status: hurtingCount === 0 ? 'pass' : hurtingCount <= 2 ? 'warn' : 'fail',
    detail: hurtingCount === 0
      ? `All ${totalAuditBullets} bullets satisfy the 5-part winning formula`
      : `${helpingSummary?.helpingCount ?? (totalAuditBullets - hurtingCount)} helping, ${hurtingCount} hurting — strengthen action verbs, metrics, or outcomes`,
    category: 'impact',
  })

  // 14. 1-Page discipline & fluff elimination (Cut List)
  const cutCount = (cutList || []).length
  checks.push({
    id: 'cut_list_discipline',
    label: '1-Page discipline & fluff elimination',
    status: isPageOverflowUnder8 ? 'warn' : cutCount === 0 ? 'pass' : 'warn',
    detail: isPageOverflowUnder8
      ? `Resume exceeds 1 page (${pageCount} pages) for candidate <8 YOE — prune secondary bullets to fit 1 page`
      : cutCount > 0
      ? `${cutCount} filler item(s) flagged for removal to preserve 1-page vertical density`
      : 'Zero filler or obsolete items detected',
    category: 'brevity',
  })

  // 15. Literal ATS keyword alignment (Near-miss synonyms)
  const nearMissCount = (nearMissKeywords || []).length
  checks.push({
    id: 'literal_ats_mirroring',
    label: 'Literal ATS keyword alignment',
    status: nearMissCount === 0 ? 'pass' : 'warn',
    detail: nearMissCount === 0
      ? 'Resume phrasing aligns directly with target JD terminology'
      : `${nearMissCount} near-miss synonym(s) should be literally swapped for exact JD phrases`,
    category: 'positioning',
  })

  return checks
}

/**
 * Builds the per-bullet audit: every experience/project bullet gets a status,
 * a one-line reason, and the before→after rewrite when an issue cites it.
 */
export function buildBulletAudit({ analysis, canonicalResume, bulletSignalsList, llmBulletRewrites = [], targetRole = '' }) {
  const roleTarget =
    targetRole ||
    analysis?.candidateSnapshot?.targetRole ||
    canonicalResume?.candidate?.targetRole ||
    canonicalResume?.targetRole ||
    ''

  // Index LLM bullet rewrites by bulletId or roleIndex/bulletIndex
  const llmRewriteMap = new Map()
  if (Array.isArray(llmBulletRewrites)) {
    llmBulletRewrites.forEach((rw) => {
      if (rw?.bulletId) llmRewriteMap.set(rw.bulletId, rw)
      if (rw?.id) llmRewriteMap.set(rw.id, rw)
      if (rw?.original && typeof rw.original === 'string') llmRewriteMap.set(rw.original.trim(), rw)
      if (rw?.text && typeof rw.text === 'string') llmRewriteMap.set(rw.text.trim(), rw)
    })
  }

  // 1. Build lookup map upgradeByBullet keyed by bulletId and trimmed text
  const upgradeByBullet = new Map()
  if (Array.isArray(analysis?.bulletUpgrades)) {
    analysis.bulletUpgrades.forEach((upg) => {
      if (upg?.bulletId) upgradeByBullet.set(upg.bulletId, upg)
      if (upg?.id) upgradeByBullet.set(upg.id, upg)
      if (upg?.originalText) upgradeByBullet.set(upg.originalText.trim(), upg)
      if (upg?.text) upgradeByBullet.set(upg.text.trim(), upg)
    })
  }

  // 1b. Build lookup map evalByBullet keyed by bulletId and trimmed text
  const evalByBullet = new Map()
  if (Array.isArray(analysis?.bulletEvaluations)) {
    analysis.bulletEvaluations.forEach((ev) => {
      if (ev?.bulletId) evalByBullet.set(ev.bulletId, ev)
      if (ev?.id) evalByBullet.set(ev.id, ev)
      if (ev?.originalText) evalByBullet.set(ev.originalText.trim(), ev)
      if (ev?.text) evalByBullet.set(ev.text.trim(), ev)
    })
  }

  const issues = Array.isArray(analysis?.issues) ? analysis.issues.filter(Boolean) : []

  // Map bulletId and text → worst issue affecting it
  const sevRank = { high: 3, medium: 2, low: 1 }
  const issueByBullet = new Map()
  for (const issue of issues) {
    const evList = Array.isArray(issue.evidence) ? issue.evidence : [issue.evidence].filter(Boolean)
    for (const ev of evList) {
      if (ev?.bulletId) {
        const existing = issueByBullet.get(ev.bulletId)
        if (!existing || (sevRank[issue.severity] || 0) > (sevRank[existing.severity] || 0)) {
          issueByBullet.set(ev.bulletId, issue)
        }
      }
      const evText = (ev?.originalText || ev?.text || '').trim()
      if (evText) {
        const existing = issueByBullet.get(evText)
        if (!existing || (sevRank[issue.severity] || 0) > (sevRank[existing.severity] || 0)) {
          issueByBullet.set(evText, issue)
        }
      }
    }
    if (issue.originalText) {
      const ot = issue.originalText.trim()
      const existing = issueByBullet.get(ot)
      if (!existing || (sevRank[issue.severity] || 0) > (sevRank[existing.severity] || 0)) {
        issueByBullet.set(ot, issue)
      }
    }
  }

  const signalByBullet = new Map()
  for (const sig of bulletSignalsList || []) {
    if (sig?.bulletId) signalByBullet.set(sig.bulletId, sig)
    if (sig?.text) signalByBullet.set(sig.text.trim(), sig)
    if (sig?.originalText) signalByBullet.set(sig.originalText.trim(), sig)
  }

  const audit = []
  const usedMetricsSet = new Set()
  const isDateLike = (s) => !s || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(s.trim())
  const rawExperiences =
    canonicalResume?.experiences ||
    canonicalResume?.experience ||
    canonicalResume?.work_experience ||
    canonicalResume?.workExperience ||
    []

  const sections = [
    { key: 'experience', label: 'Experience', items: rawExperiences, nameFields: ['company', 'role', 'employer', 'title'] },
    { key: 'projects', label: 'Projects', items: canonicalResume?.projects || [], nameFields: ['name', 'title'] },
  ]

  for (const section of sections) {
    for (let itemIndex = 0; itemIndex < (section.items || []).length; itemIndex++) {
      const item = section.items[itemIndex]
      let itemName = section.label
      for (const field of section.nameFields) {
        if (item?.[field] && !isDateLike(item[field])) {
          itemName = item[field]
          break
        }
      }
      if (typeof itemName === 'string' && itemName.includes('|')) {
        itemName = itemName.split('|')[0].trim()
      }
      const hasPresentDate = /present|current|now/i.test(item?.endDate || '') || /present|current|now/i.test(item?.dates || '') || /present|current|now/i.test(item?.duration || '') || item?.isCurrent === true
      const isCurrentRole = section.key === 'experience' && (item?.isCurrent === true || hasPresentDate)

      const rawBullets = Array.isArray(item.bullets) ? item.bullets : []
      for (let bIdx = 0; bIdx < rawBullets.length; bIdx++) {
        const rawB = rawBullets[bIdx]
        if (!rawB) continue
        const bText = typeof rawB === 'string' ? rawB.trim() : (rawB.text || rawB.original || '').trim()
        if (!bText) continue
        const bId = (typeof rawB === 'object' && rawB?.id) ? rawB.id : `${section.key}_${itemIndex}_b${bIdx}`
        const b = { id: bId, text: bText }
        const sig = signalByBullet.get(b.id) || signalByBullet.get(b.text.trim())
        const issue = issueByBullet.get(b.id) || issueByBullet.get(b.text.trim())
        const upgrade = upgradeByBullet.get(b.id) || upgradeByBullet.get(b.text.trim())
        const llmMatch = llmRewriteMap.get(b.id) || llmRewriteMap.get(b.text.trim())

        const bEval = evalByBullet.get(b.id) || evalByBullet.get(b.text.trim())
        const isEvalHurting = Boolean(bEval && (bEval.verdict === 'hurting' || (Array.isArray(bEval.missingElements) && bEval.missingElements.length > 0)))

        let status = 'pass'
        let reason = 'Clear, specific, no defects found'
        let quickPolishNote = null
        let rewrite = null
        let whyItWorks = null

        if (upgrade) {
          rewrite = upgrade.rewrittenText || null
          reason = upgrade.reason || upgrade.critique || null
          whyItWorks = upgrade.whyItWorks || null
          if (upgrade.status) status = upgrade.status
        } else if (llmMatch) {
          rewrite = llmMatch.rewrittenText || llmMatch.rewritten || llmMatch.rewrite || null
          if (llmMatch.critique || llmMatch.reason) {
            reason = llmMatch.critique || llmMatch.reason
          }
          if (llmMatch.whyItWorks) {
            whyItWorks = llmMatch.whyItWorks
          }
        }

        const isAccomplished = sig && (sig.hasQuantifier === true || sig.hasQualitativeOutcome === true) && !sig.isToolDumpCandidate
        const hasWeakOpener = Boolean(sig?.weakVerbIssue) || /^(?:responsible for|worked on|helped|contributed to)\b/i.test(b.text.trim().replace(/^[•\-*▪–—\s]+/, ''))
        const lacksOutcome = Boolean(sig && !sig.hasQuantifier && !sig.hasQualitativeOutcome)

        if (issue) {
          status = issue.severity === 'low' ? 'warn' : 'fix'
          reason = issue.title || issue.diagnosis || 'Flagged by analysis'
          if (issue.correctedText) rewrite = issue.correctedText
          if (issue.whyItMatters) whyItWorks = issue.whyItMatters
        } else if (upgrade) {
          status = upgrade.status || 'warn'
          reason = upgrade.reason || upgrade.critique || 'Bullet upgraded for stronger recruiter signal'
          rewrite = upgrade.rewrittenText || rewrite
        } else if (isEvalHurting) {
          status = 'warn'
          const evalCritique = bEval?.critique || (bEval?.missingElements?.length ? `Lacks ${bEval.missingElements.slice(0, 2).join(' and ')} required for senior recruiter scan` : null)
          reason = evalCritique || 'Omits measurable business impact and technical scale needed for senior recruiter scan.'
        } else if (hasWeakOpener) {
          status = 'warn'
          reason = `Opens with weak/supporting phrasing ('${sig?.weakVerbMatch || 'weak verb'}') — start with a strong ownership action verb (e.g., Architected, Engineered, Spearheaded)`
        } else if (sig?.tenseIssue === 'gerund_opening') {
          const targetVerb = normalizeGerundVerb(sig.openingWord, isCurrentRole)
          quickPolishNote = `Change '${sig.openingWord}' to '${targetVerb}' for direct action tense`
          if (isAccomplished) {
            status = 'pass'
            reason = 'Strong accomplishment with verified outcomes'
          } else {
            status = 'warn'
            reason = `Starts with an '-ing' participle ('${sig.openingWord}') — recommend ${isCurrentRole ? 'present-tense verb' : 'past-tense verb'} for direct action tense`
          }
        } else if (sig?.tenseIssue === 'wrong_tense') {
          status = 'warn'
          reason = `Past role uses present-tense verb ('${sig.openingWord}') — switch to past tense for completed roles`
        } else if (sig?.repetitiveVerbIssue) {
          status = 'warn'
          reason = `Repeats opening verb '${sig.openingWord}' (used ${sig.openingVerbCount}x) — vary your action verbs to keep each bullet distinct`
        } else if (sig?.buzzwordIssue) {
          status = 'warn'
          reason = `Contains generic/AI-sounding buzzword ('${sig.buzzwordMatch}') — replace with plain, authentic human phrasing`
        } else if (sig?.isToolDumpCandidate) {
          status = 'warn'
          reason = 'Lists multiple technologies without demonstrating the concrete system built or delivered'
        } else if (lacksOutcome) {
          status = 'warn'
          const opener = sig?.openingWord || 'Bullet'
          const techMention = sig?.technologies?.[0] ? ` for ${sig.technologies[0]}` : ''
          const cleanItemName = typeof itemName === 'string' ? itemName.split('|')[0].trim() : String(itemName || '')
          const locationPhrase = section.key === 'projects' ? `in your ${cleanItemName} project` : `at ${cleanItemName}`
          reason = `'${opener}'${techMention} describes the technical task ${locationPhrase} but omits the business result — add measurable impact`
        } else {
          status = 'pass'
          reason = 'Clear, specific, no defects found'
          if (!llmMatch && !upgrade) {
            rewrite = null
          }
        }

        let cleanImproved = rewrite ? cleanRewriteText(rewrite) : null
        // Reject 1-word verb swaps or identical rewrites
        if (cleanImproved && isWordForWordIdentical(cleanImproved, b.text, 0.85)) {
          if (upgrade?.rewrittenText && !isWordForWordIdentical(upgrade.rewrittenText, b.text, 0.85)) {
            cleanImproved = cleanRewriteText(upgrade.rewrittenText)
          } else if (llmMatch?.rewrittenText && !isWordForWordIdentical(llmMatch.rewrittenText, b.text, 0.85)) {
            cleanImproved = cleanRewriteText(llmMatch.rewrittenText)
          } else {
            cleanImproved = null
          }
        }

        let verdict
        let fivePartFlags
        let isResponsibilityOnly

        if (bEval) {
          verdict = bEval.verdict === 'hurting' ? 'hurting' : 'helping'
          const flags = bEval.fivePartFlags && typeof bEval.fivePartFlags === 'object' ? bEval.fivePartFlags : {}
          fivePartFlags = {
            actionVerb: Boolean(flags.actionVerb),
            hardSkill: Boolean(flags.hardSkill),
            collaboration: Boolean(flags.collaboration),
            metric: Boolean(flags.metric),
            outcome: Boolean(flags.outcome),
          }
          isResponsibilityOnly = Boolean(bEval.isResponsibilityOnly)
        } else {
          const hasVerb = !hasWeakOpener && sig?.tenseIssue !== 'gerund_opening'
          const hasSkill = Boolean(sig?.technologyCount > 0 || (sig?.technologies && sig.technologies.length > 0))
          const hasCollab = /team|cross-functional|stakeholder|partner|mentor|lead|client|engineer/i.test(b.text)
          const hasMetric = Boolean(sig?.hasQuantifier || /\d+%?|\$\d+/i.test(b.text))
          const hasOutcome = Boolean(sig?.hasQuantifier || sig?.hasQualitativeOutcome || /result|improv|reduc|increas|achiev|accelerat/i.test(b.text))

          fivePartFlags = {
            actionVerb: hasVerb,
            hardSkill: hasSkill,
            collaboration: hasCollab,
            metric: hasMetric,
            outcome: hasOutcome,
          }
          isResponsibilityOnly = Boolean(hasWeakOpener && !hasMetric && !hasOutcome)
          verdict = (status === 'pass' && !hasWeakOpener && (hasMetric || hasOutcome)) ? 'helping' : 'hurting'
        }

        if (verdict === 'hurting' || isEvalHurting || status !== 'pass') {
          verdict = 'hurting'
          if (status === 'pass') {
            status = 'warn'
          }
          if (!reason || reason === 'Clear, specific, no defects found' || /clear,\s*specific,\s*no defects found/i.test(reason)) {
            const evalCritique = bEval?.critique || upgrade?.critique || llmMatch?.critique
            if (evalCritique && !/no defects found/i.test(evalCritique)) {
              reason = evalCritique
            } else if (bEval?.missingElements?.length) {
              reason = `Lacks ${bEval.missingElements.slice(0, 2).join(' and ')} required for senior recruiter scan.`
            } else {
              const missing = []
              if (!fivePartFlags.metric) missing.push('quantified business metrics')
              if (!fivePartFlags.outcome) missing.push('measurable business outcome')
              if (!fivePartFlags.actionVerb) missing.push('an active ownership verb')
              if (!fivePartFlags.hardSkill) missing.push('concrete technical tooling')

              if (missing.length > 0) {
                reason = `Lacks ${missing.slice(0, 2).join(' and ')} required to demonstrate senior analytical/engineering ownership.`
              } else {
                reason = 'Omits measurable business impact and technical scale needed for senior recruiter scan.'
              }
            }
          }
          if (!cleanImproved && upgrade?.rewrittenText && !isWordForWordIdentical(upgrade.rewrittenText, b.text, 0.85)) {
            cleanImproved = cleanRewriteText(upgrade.rewrittenText)
          }
          if (!cleanImproved) {
            const fallbackRw = buildFivePartPlaybookRewrite(b.text, { targetRole: roleTarget, isCurrentRole, usedMetricsSet, bulletIndex: bIdx })
            if (fallbackRw && !isWordForWordIdentical(fallbackRw, b.text, 0.85)) {
              cleanImproved = cleanRewriteText(fallbackRw)
            }
          }
        }

        if (cleanImproved && isWordForWordIdentical(cleanImproved, b.text, 0.85)) {
          cleanImproved = null
        }

        const finalWhyItWorks =
          whyItWorks ||
          llmMatch?.whyItWorks ||
          llmMatch?.why ||
          upgrade?.whyItWorks ||
          upgrade?.why ||
          synthesizeWhyItWorks(b.text, cleanImproved)

        const rawMetricOpps = llmMatch?.metricOpportunities || upgrade?.metricOpportunities || issue?.metricOpportunities || []
        const metricOpportunities = Array.isArray(rawMetricOpps) && rawMetricOpps.length > 0
          ? normalizeMetricOpportunities(rawMetricOpps)
          : generateFallbackMetricOpportunities(b.text, roleTarget)

        const isOrigQuant = isTrueQuantified(b.text) || Boolean(sig?.hasQuantifier)
        const isRwQuant = cleanImproved ? isTrueQuantified(cleanImproved) : false
        const metricSource = isOrigQuant ? 'resume_verified' : (isRwQuant ? 'ai_calibrated' : null)

        // Final assertion: If verdict === 'hurting' or status !== 'pass', reason and critique MUST NEVER be 'Clear, specific, no defects found'
        let finalReason = reason
        if (verdict === 'hurting' || status !== 'pass') {
          if (status === 'pass') status = 'warn'
          if (!finalReason || /clear,\s*specific,\s*no defects found/i.test(finalReason)) {
            finalReason = 'Omits measurable business impact and technical scale needed for senior recruiter scan.'
          }
        }

        audit.push({
          bulletId: b.id,
          section: section.key,
          itemName,
          text: b.text,
          original: b.text,
          status,
          reason: balanceParentheses(finalReason),
          critique: balanceParentheses(finalReason),
          whyItWorks: finalWhyItWorks,
          why: finalWhyItWorks,
          guidance: lacksOutcome ? 'Consider adding a quantified percentage or business impact metric if verifiable.' : null,
          quickPolishNote,
          rewrite: cleanImproved,
          rewritten: cleanImproved,
          improved: cleanImproved,
          hasQuantifier: isOrigQuant,
          isQuantified: isOrigQuant,
          metricSource,
          metricOpportunities,
          issueId: issue?.id || null,
          category: issue?.category || null,
          verdict,
          fivePartFlags,
          isResponsibilityOnly,
          impactScore: status === 'pass' ? 92 : status === 'warn' ? 68 : 35,
        })
      }
    }
  }

  // Fallback: If no experience bullets were found in canonical sections, but LLM bullet rewrites exist
  if (audit.length === 0 && Array.isArray(llmBulletRewrites) && llmBulletRewrites.length > 0) {
    llmBulletRewrites.forEach((rw, idx) => {
      const orig = rw.original || rw.text || ''
      if (!orig) return
      const cleanRw = cleanRewriteText(rw.rewritten || rw.rewrite || rw.rewrittenText || orig)
      const isPass = rw.status === 'pass' || rw.severity === 'PASS'
      const whyItWorks = rw.whyItWorks || rw.why || synthesizeWhyItWorks(orig, cleanRw)
      const rawMetricOpps = rw.metricOpportunities || rw.discoveryOpportunities || []
      const metricOpportunities = Array.isArray(rawMetricOpps) && rawMetricOpps.length > 0
        ? normalizeMetricOpportunities(rawMetricOpps)
        : generateFallbackMetricOpportunities(orig, roleTarget)
      audit.push({
        bulletId: rw.bulletId || rw.id || `llm_b_${idx}`,
        section: 'experience',
        itemName: 'Experience',
        text: orig,
        original: orig,
        status: isPass ? 'pass' : 'warn',
        reason: balanceParentheses(rw.critique || rw.reason || 'Flagged for impact enhancement'),
        critique: balanceParentheses(rw.critique || rw.reason || 'Flagged for impact enhancement'),
        whyItWorks,
        why: whyItWorks,
        rewrite: cleanRw,
        rewritten: cleanRw,
        improved: cleanRw,
        metricOpportunities,
        verdict: isPass ? 'helping' : 'hurting',
        fivePartFlags: rw.fiveParts || rw.fivePartFlags || {
          actionVerb: true,
          hardSkill: true,
          collaboration: false,
          metric: isPass,
          outcome: isPass,
        },
        isResponsibilityOnly: Boolean(rw.isResponsibilityOnly),
        impactScore: isPass ? 92 : 60,
      })
    })
  }

  return audit
}

export default { computeScorecard, SCORECARD_VERSION, GRADE_BANDS }
