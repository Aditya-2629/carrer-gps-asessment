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
import { computeKeywordAlignment } from '../market/keywordAlignment.js'
import { synthesizeWhyItWorks } from '../../../utils/humanizeReportCopy.js'

export const SCORECARD_VERSION = 'resume-scorecard-v1'

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
    run: 'Ran',
    lead: 'Led',
    drive: 'Drove',
    write: 'Wrote',
    make: 'Made',
    keep: 'Kept',
    take: 'Took',
    grow: 'Grew',
    set: 'Set',
    cut: 'Cut',
    meet: 'Met',
    hold: 'Held',
    analyze: 'Analyzed',
    analyse: 'Analysed',
  }
  if (irregulars[v]) return irregulars[v]
  if (v.endsWith('yze') || v.endsWith('ise')) return v.charAt(0).toUpperCase() + v.slice(1) + 'd'
  if (v.endsWith('e')) return v.charAt(0).toUpperCase() + v.slice(1) + 'd'
  if (v.endsWith('y') && !/[aeiou]y$/i.test(v)) return v.charAt(0).toUpperCase() + v.slice(1, -1) + 'ied'
  return v.charAt(0).toUpperCase() + v.slice(1) + 'ed'
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

export function isTrueQuantified(text) {
  if (!text || typeof text !== 'string') return false
  const clean = text
    .replace(/\b(?:react|angular|vue|python|d3|node|es|wcag|oauth|jwt|html|css|java|ecma|c\+\+|c#|dot net|\.net)\.?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .replace(/\bv\d+(?:\.\d+)?\b/gi, '')
  return /\d+(?:\.\d+)?%|\b\d+\s*(?:ms|milliseconds?|seconds?|mins?|minutes?|hours?|k|m|million|billion|users|rps|qps|requests|tps|events)\b|\$\s*\d+|\b\d{2,}\s+(?:production|enterprise|distributed|active|concurrent|client)/i.test(clean)
}

const DOMAIN_METRIC_POOLS = {
  qa: [
    { scope: 'partnering with QA and release engineering squads', outcome: 'increasing automated test coverage to 85%+ and reducing defect leakage by 40%' },
    { scope: 'collaborating with test automation engineers', outcome: 'reducing regression testing cycles from 4 hours to 25 minutes' },
    { scope: 'partnering with cross-functional release squads', outcome: 'eliminating manual QA bottlenecks and ensuring zero critical regression escapes' },
    { scope: 'partnering with QA leads and developers', outcome: 'accelerating CI test execution speed by 35% with 100% test reliability' },
  ],
  frontend: [
    { scope: 'partnering with UX designers and backend engineers', outcome: 'achieving 98+ Google Lighthouse scores and sub-second first contentful paint (FCP)' },
    { scope: 'collaborating with design systems and accessibility leads', outcome: 'ensuring 100% WCAG 2.1 AA accessibility compliance across all production views' },
    { scope: 'partnering with product designers and frontend squads', outcome: 'slashing client-side render latency by 35% and improving core web vitals' },
    { scope: 'collaborating with UI/UX engineers', outcome: 'accelerating user workflow completion rates by 28% and eliminating layout shifts' },
  ],
  backend: [
    { scope: 'collaborating with distributed platform teams', outcome: 'cutting p99 API response times by 38% and supporting 10k+ concurrent requests' },
    { scope: 'partnering with backend engineering squads', outcome: 'reducing payload overhead by 45% while maintaining 99.99% service availability' },
    { scope: 'collaborating with microservices architects', outcome: 'handling 5M+ daily API transactions with zero downtime deployments' },
    { scope: 'partnering with core infrastructure engineers', outcome: 'slashing service-to-service communication latency by 30% under peak load' },
  ],
  database: [
    { scope: 'partnering with DBA and data platform engineers', outcome: 'reducing complex query execution time from 14s to 850ms via composite indexing' },
    { scope: 'collaborating with database administrators', outcome: 'optimizing connection pool utilization and eliminating database lock contention' },
    { scope: 'partnering with data engineering leads', outcome: 'accelerating daily batch processing throughput by 50% across millions of records' },
    { scope: 'collaborating with platform engineers', outcome: 'reducing storage I/O bottlenecks and cutting query latency by 40%' },
  ],
  devops: [
    { scope: 'partnering with DevOps and platform reliability engineers', outcome: 'cutting CI/CD build-to-deploy pipeline times from 45 to 8 minutes' },
    { scope: 'collaborating with cloud infrastructure leads', outcome: 'sustaining 99.99% cloud infrastructure availability with zero-downtime rollouts' },
    { scope: 'partnering with SRE squads', outcome: 'optimizing container compute footprint and slashing cloud infrastructure costs by 28%' },
    { scope: 'collaborating with platform reliability teams', outcome: 'automating multi-region failover and reducing MTTR by 60%' },
  ],
  security: [
    { scope: 'collaborating with InfoSec and compliance teams', outcome: 'eliminating high-severity CVE vulnerabilities and achieving 100% SOC-2 compliance' },
    { scope: 'partnering with security architects', outcome: 'protecting user identity workflows with zero unauthorized auth boundary breaches' },
    { scope: 'collaborating with security and release squads', outcome: 'hardening API gateway endpoints and ensuring 100% audit trail compliance' },
  ],
  ai: [
    { scope: 'collaborating with ML researchers and data engineers', outcome: 'reducing retrieval latency by 32% while sustaining 99.2% factual precision' },
    { scope: 'partnering with AI platform teams', outcome: 'optimizing embedding inference throughput and reducing GPU compute overhead by 30%' },
    { scope: 'collaborating with ML platform engineers', outcome: 'slashing token generation latency and eliminating context window bottlenecks' },
  ],
  general: [
    { scope: 'partnering with cross-functional engineering squads', outcome: 'cutting delivery turnaround by 35% and elevating system reliability' },
    { scope: 'collaborating with technical leads and stakeholders', outcome: 'accelerating feature velocity and reducing production bug escalations by 40%' },
    { scope: 'partnering with product and engineering leads', outcome: 'sustaining 99.9% operational availability and eliminating delivery blockers' },
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
export function buildFivePartPlaybookRewrite(bulletText, { targetRole = '', isCurrentRole = false, skills = [], sig = null, company = '', bulletIndex = 0 } = {}) {
  if (!bulletText || typeof bulletText !== 'string') return ''
  let clean = bulletText
    .replace(/^[•\-*▪–—·\s]+/, '')
    .replace(/^(?:action|task|situation|result|challenge|accomplished):\s*/i, '')
    .trim()

  const lowerText = clean.toLowerCase()

  // 1. Detect bullet-specific domain from the actual bullet text first (NOT broad targetRole)
  const isQaBullet = /test|jasmine|karma|jest|cypress|selenium|playwright|junit|pytest|cucumber|qa\b|automation/i.test(lowerText)
  const isFrontendBullet = /frontend|front-end|ui\b|ux\b|react|vue|angular|component|css|html|figma|tailwind|wcag|accessibility|screen reader|dom\b/i.test(lowerText)
  const isDataBullet = /data|analyst|analytics|bi\b|sql\b|tableau|power\s*bi|snowflake|dbt|etl|query|queries|database/i.test(lowerText)
  const isAiBullet = /ai\b|machine learning|ml\b|llm|nlp|rag\b|vector|embeddings|pytorch|tensorflow|langchain/i.test(lowerText)
  const isDevopsBullet = /devops|cloud|sre|platform|infra|kubernetes|docker|terraform|ci\/cd|aws|gcp|azure|ansible/i.test(lowerText)
  const isSecurityBullet = /security|cyber|soc2|cve|vulnerabilit|jwt|oauth|auth|sanitize/i.test(lowerText)

  let domainKey = 'general'
  let defaultActionVerb = isCurrentRole ? 'Engineer' : 'Engineered'

  if (isQaBullet) {
    domainKey = 'qa'
    defaultActionVerb = isCurrentRole ? 'Automate' : 'Automated'
  } else if (isFrontendBullet) {
    domainKey = 'frontend'
    defaultActionVerb = isCurrentRole ? 'Modernize' : 'Modernized'
  } else if (isSecurityBullet) {
    domainKey = 'security'
    defaultActionVerb = isCurrentRole ? 'Harden' : 'Hardened'
  } else if (isDevopsBullet) {
    domainKey = 'devops'
    defaultActionVerb = isCurrentRole ? 'Orchestrate' : 'Orchestrated'
  } else if (isDataBullet) {
    domainKey = 'database'
    defaultActionVerb = isCurrentRole ? 'Optimize' : 'Optimized'
  } else if (isAiBullet) {
    domainKey = 'ai'
    defaultActionVerb = isCurrentRole ? 'Deploy' : 'Deployed'
  } else if (/api|service|microservice|backend|system|pipeline|infrastructure/i.test(lowerText)) {
    domainKey = 'backend'
    defaultActionVerb = isCurrentRole ? 'Architect' : 'Architected'
  }

  // 2. Clean verb stripping: remove compound verbal phrases, weak openers, and opening verbs cleanly
  let coreTask = clean
    // Strip compound phrases like "Automate and testing of...", "Design and develop...", "Built and deployed..."
    .replace(/^(?:automate(?:d)?|design(?:ed)?|build|built|develop(?:ed)?|engineer(?:ed)?|test(?:ed)?|maintain(?:ed)?|implement(?:ed)?)\s+and\s+(?:testing|developing|building|deploying|maintaining|designing|implementing)\s+(?:of\s+)?/i, '')
    // Strip weak/passive openers
    .replace(/^(?:responsible for|was responsible for|tasked with|worked on|working on|helped with|helped to|assisted in|assisted with|participated in|supported|contributed to|utilized|using|managed to|handled|collaborated with|partnered with)\s+(?:the\s+)?/i, '')
    // Strip common single opening verbs
    .replace(/^(?:drove|driven|driving|led|leading|spearheaded|spearheading|engineered|engineering|architected|architecting|developed|developing|designed|designing|built|building|automated|automating|tested|testing|created|creating|optimized|optimizing|implemented|implementing|configured|configuring|maintained|maintaining|conducted|conducting|performed|performing|executed|executing|modernized|modernizing)\s+(?:the\s+)?/i, '')
    .trim()

  // Remove trailing boilerplate suffixes
  coreTask = coreTask.replace(/,?\s*by establishing decoupled microservice boundaries and resilient caching(?:,\s*enhancing operational throughput,\s*reducing execution latency,\s*and ensuring continuous production uptime)?\.?/gi, '')
  coreTask = coreTask.replace(/,?\s*enhancing operational throughput,\s*reducing execution latency,\s*and ensuring continuous production uptime\.?/gi, '')
  coreTask = coreTask.replace(/,?\s*by implementing automated DevSecOps vulnerability scanning.*?compliance across release pipelines\.?/gi, '')
  coreTask = coreTask.replace(/,?\s*using\s+[^,.]+\s+for\s+scalable\s+(?:transformation|analytical)\s+[^.]+\.?/gi, '')
  coreTask = coreTask.replace(/[.,;:\s]+$/, '').trim()

  // Remove any remaining opening verb if present
  const firstWord = coreTask.split(/\s+/)[0] || ''
  const knownActionVerbs = new Set([
    'automate', 'automated', 'automating',
    'engineer', 'engineered', 'engineering',
    'architect', 'architected', 'architecting',
    'develop', 'developed', 'developing',
    'design', 'designed', 'designing',
    'implement', 'implemented', 'implementing',
    'test', 'tested', 'testing',
    'maintain', 'maintained', 'maintaining',
    'create', 'created', 'creating',
    'optimize', 'optimized', 'optimizing',
    'lead', 'led', 'leading',
    'manage', 'managed', 'managing',
    'conduct', 'conducted', 'conducting',
    'perform', 'performed', 'performing',
    'execute', 'executed', 'executing',
    'configure', 'configured', 'configuring',
    'coordinate', 'coordinated', 'coordinating',
    'direct', 'directed', 'directing',
    'spearhead', 'spearheaded', 'spearheading',
    'deploy', 'deployed', 'deploying',
    'modernize', 'modernized', 'modernizing',
    'drive', 'drove', 'driving',
    'integrate', 'integrated', 'integrating',
  ])
  if (knownActionVerbs.has(firstWord.toLowerCase()) || /^[a-zA-Z]+ing$/i.test(firstWord)) {
    coreTask = coreTask.replace(/^[A-Za-z]+\s+/i, '').trim()
  }

  // Strip prepositions left at start
  coreTask = coreTask.replace(/^(?:and|of|the|to|for|in|on|with|across)\s+/i, '').trim()

  if (coreTask.length > 0) {
    coreTask = coreTask.charAt(0).toLowerCase() + coreTask.slice(1)
  }

  // 3. Resolve Skills & Tools (Part 2)
  let skillPhrase = ''
  const skillList = Array.isArray(skills) ? skills.filter(Boolean) : []
  if (skillList.length > 0) {
    const topSkills = skillList.slice(0, 2).join(' and ')
    if (!new RegExp(`\\b${topSkills.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(coreTask)) {
      skillPhrase = ` using ${topSkills}`
    }
  }

  // 4. Resolve Dynamic Non-Repeating Metric Outcome (Parts 3, 4, 5)
  const pool = DOMAIN_METRIC_POOLS[domainKey] || DOMAIN_METRIC_POOLS.general
  let hash = 0
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0
  }
  const variantIndex = (hash + (bulletIndex || 0)) % pool.length
  const variant = pool[variantIndex]

  const collabScope = variant.scope
  const metricAndOutcome = variant.outcome

  let result = `${defaultActionVerb} ${coreTask}${skillPhrase} ${collabScope}, ${metricAndOutcome}.`
  result = result.replace(/\s{2,}/g, ' ').replace(/\.+$/, '.').trim()
  return cleanRewriteText(result)
}

/**
 * Generates a deterministic action-oriented rewrite for a bullet.
 * Normalizes opening gerund participles (-ing) into direct action verbs and
 * ensures every IMPROVE or FIX bullet has a concrete ready-to-copy rewrite.
 */
export function generateDeterministicRewrite(bulletText, sig, isCurrentRole, targetRole = '') {
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

  // Special case: "Analyze complex business questions..." or weak/present-tense opening verbs
  if (/^analyze\s+complex\s+business\s+questions\b/i.test(clean)) {
    if (isCurrentRole) {
      clean = clean.replace(/^analyze\s+complex\s+business\s+questions(?:\s+with\s+sql)?\b/i, 'Translate complex business questions into SQL-backed executive briefings')
    } else {
      clean = clean.replace(/^analyze\s+complex\s+business\s+questions(?:\s+with\s+sql)?\b/i, 'Synthesized complex business questions with SQL and delivered executive briefings')
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

  // If the rewrite is a lazy suffix append or lacks a real metric/mechanism, build a complete 5-Part Playbook Rewrite
  if (isLazySuffixAppend(clean, originalClean) || (!hasRealMetric && !hasArchitecturalMechanism)) {
    return buildFivePartPlaybookRewrite(originalClean, {
      targetRole,
      isCurrentRole,
      sig,
    })
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
  const hasEmail = Boolean(contact.email || canonicalResume?.candidate?.email || precomputedSignals?.contactMerge?.emailDetected)
  const hasPhone = Boolean(contact.phone || canonicalResume?.candidate?.phone || precomputedSignals?.contactMerge?.phoneDetected)
  const hasLinkedin = Boolean(contact.linkedin || canonicalResume?.candidate?.linkedin || precomputedSignals?.contactMerge?.urlDetected)
  const hasNonUsPersonal = Boolean(flags.photoPresent || flags.maritalStatusPresent || flags.dobPresent || flags.fullAddressPresent)

  // 1. Header & Contact Parsing (/10)
  let headerScore = 10
  if (contactMerge.isContactMerged) headerScore -= 3
  if (!hasEmail || !hasPhone) headerScore -= 4
  if (!hasLinkedin) headerScore -= 2
  if (hasNonUsPersonal) headerScore -= 3
  const headerScore10 = clamp(headerScore, 1, 10)
  const headerStatus = headerScore10 >= 9 ? 'pass' : headerScore10 >= 6 ? 'warn' : 'fail'
  const headerHurting = contactMerge.isContactMerged
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
  const realQuantifiedCount = allExpBullets.filter((b) => isTrueQuantified(b.text || b.originalText || '')).length
  const expTotalBullets = allExpBullets.length > 0 ? allExpBullets.length : (quant.totalBullets || 1)
  const realDensity = expTotalBullets > 0 ? realQuantifiedCount / expTotalBullets : 0

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

  const sectionAudit = {
    headerAndContact: {
      score10: headerScore10,
      status: headerStatus,
      label: 'Header & Contact Parsing',
      whatsHurting: headerHurting,
      hurtingReason: headerHurting,
      requiredImprovement: headerImprovement,
    },
    summary: {
      score10: summaryScore10,
      status: summaryStatus,
      label: 'Professional Summary',
      whatsHurting: summaryHurting,
      hurtingReason: summaryHurting,
      requiredImprovement: summaryImprovement,
    },
    experience: {
      score10: expScore10,
      status: expStatus,
      label: 'Experience Bullets & Quantified Impact',
      whatsHurting: expHurting,
      hurtingReason: expHurting,
      requiredImprovement: expImprovement,
    },
    skills: {
      score10: skillsScore10,
      status: skillsStatus,
      label: 'Skills & Market Keyword Alignment',
      whatsHurting: skillsHurting,
      hurtingReason: skillsHurting,
      requiredImprovement: skillsImprovement,
    },
    formatting: {
      score10: formattingScore10,
      status: formattingStatus,
      label: 'Formatting, Length & ATS Safety',
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
function buildBulletAudit({ analysis, canonicalResume, bulletSignalsList, llmBulletRewrites = [], targetRole = '' }) {
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

  // 1. Build lookup map upgradeByBullet keyed by bulletId
  const upgradeByBullet = new Map()
  if (Array.isArray(analysis?.bulletUpgrades)) {
    analysis.bulletUpgrades.forEach((upg) => {
      if (upg?.bulletId) upgradeByBullet.set(upg.bulletId, upg)
      else if (upg?.id) upgradeByBullet.set(upg.id, upg)
    })
  }

  // 1b. Build lookup map evalByBullet keyed by bulletId
  const evalByBullet = new Map()
  if (Array.isArray(analysis?.bulletEvaluations)) {
    analysis.bulletEvaluations.forEach((ev) => {
      if (ev?.bulletId) evalByBullet.set(ev.bulletId, ev)
    })
  }

  const issues = Array.isArray(analysis?.issues) ? analysis.issues.filter(Boolean) : []

  // Map bulletId → worst issue affecting it
  const sevRank = { high: 3, medium: 2, low: 1 }
  const issueByBullet = new Map()
  for (const issue of issues) {
    const evList = Array.isArray(issue.evidence) ? issue.evidence : [issue.evidence].filter(Boolean)
    for (const ev of evList) {
      if (!ev?.bulletId) continue
      const existing = issueByBullet.get(ev.bulletId)
      if (!existing || (sevRank[issue.severity] || 0) > (sevRank[existing.severity] || 0)) {
        issueByBullet.set(ev.bulletId, issue)
      }
    }
  }

  const signalByBullet = new Map()
  for (const sig of bulletSignalsList || []) {
    if (sig?.bulletId) signalByBullet.set(sig.bulletId, sig)
  }

  const audit = []
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
        const sig = signalByBullet.get(b.id)
        const issue = issueByBullet.get(b.id)
        const upgrade = upgradeByBullet.get(b.id)
        const llmMatch = llmRewriteMap.get(b.id) || llmRewriteMap.get(b.text.trim())

        let status = 'pass'
        let reason = 'Clear, specific, no defects found'
        let quickPolishNote = null
        let rewrite = null

        if (llmMatch) {
          rewrite = llmMatch.rewritten || llmMatch.rewrittenText || llmMatch.rewrite || null
          if (llmMatch.critique || llmMatch.reason) {
            reason = llmMatch.critique || llmMatch.reason
          }
        }

        const isAccomplished = sig && (sig.hasQuantifier === true || sig.hasQualitativeOutcome === true) && !sig.isToolDumpCandidate
        const hasWeakOpener = Boolean(sig?.weakVerbIssue) || /^(?:responsible for|worked on|helped|contributed to)\b/i.test(b.text.trim().replace(/^[•\-*▪–—\s]+/, ''))
        const lacksOutcome = Boolean(sig && !sig.hasQuantifier && !sig.hasQualitativeOutcome)

        if (issue) {
          status = issue.severity === 'low' ? 'warn' : 'fix'
          reason = issue.title || issue.diagnosis || 'Flagged by analysis'
          rewrite = issue.correctedText || null
        } else if (upgrade) {
          status = upgrade.status || 'warn'
          reason = upgrade.reason || 'Bullet upgraded for stronger recruiter signal'
          rewrite = upgrade.rewrittenText || null
        } else if (hasWeakOpener) {
          status = 'warn'
          reason = `Opens with weak/supporting phrasing ('${sig?.weakVerbMatch || 'weak verb'}') — start with a strong ownership action verb (e.g., Architected, Engineered, Spearheaded)`
          rewrite = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
        } else if (sig?.tenseIssue === 'gerund_opening') {
          const targetVerb = normalizeGerundVerb(sig.openingWord, isCurrentRole)
          quickPolishNote = `Change '${sig.openingWord}' to '${targetVerb}' for direct action tense`
          if (isAccomplished) {
            status = 'pass'
            reason = 'Strong accomplishment with verified outcomes'
            rewrite = null
          } else {
            status = 'warn'
            reason = `Starts with an '-ing' participle ('${sig.openingWord}') — recommend ${isCurrentRole ? 'present-tense verb' : 'past-tense verb'} for direct action tense`
            rewrite = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
          }
        } else if (sig?.tenseIssue === 'wrong_tense') {
          status = 'warn'
          reason = `Past role uses present-tense verb ('${sig.openingWord}') — switch to past tense for completed roles`
          rewrite = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
        } else if (sig?.repetitiveVerbIssue) {
          status = 'warn'
          reason = `Repeats opening verb '${sig.openingWord}' (used ${sig.openingVerbCount}x) — vary your action verbs to keep each bullet distinct`
          rewrite = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
        } else if (sig?.buzzwordIssue) {
          status = 'warn'
          reason = `Contains generic/AI-sounding buzzword ('${sig.buzzwordMatch}') — replace with plain, authentic human phrasing`
          rewrite = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
        } else if (sig?.isToolDumpCandidate) {
          status = 'warn'
          reason = 'Lists multiple technologies without demonstrating the concrete system built or delivered'
          rewrite = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
        } else if (lacksOutcome) {
          status = 'warn'
          const opener = sig?.openingWord || 'Bullet'
          const techMention = sig?.technologies?.[0] ? ` for ${sig.technologies[0]}` : ''
          const cleanItemName = typeof itemName === 'string' ? itemName.split('|')[0].trim() : String(itemName || '')
          const locationPhrase = section.key === 'projects' ? `in your ${cleanItemName} project` : `at ${cleanItemName}`
          reason = `'${opener}'${techMention} describes the technical task ${locationPhrase} but omits the business result — add measurable impact`
          rewrite = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
        } else {
          status = 'pass'
          reason = 'Clear, specific, no defects found'
          rewrite = null
        }

        // Fallback to legacy llmMatch if no rewrite and no quickPolishNote
        if (!rewrite && !quickPolishNote && llmRewriteMap.has(b.id)) {
          rewrite = llmRewriteMap.get(b.id)?.rewrittenText || null
        }

        // Safety guarantee: EVERY bullet marked 'warn' or 'fix' MUST have a non-null rewrite!
        if ((status === 'warn' || status === 'fix') && !rewrite) {
          rewrite = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
        }

        if (rewrite) {
          rewrite = sanitizeSingleAddPlaceholder(rewrite)
          if (isCurrentRole) {
            const m = rewrite.match(/^([•\-*▪–—\s]*)([A-Za-z]+)\b(.*)$/s)
            if (m) {
              const prefix = m[1]
              const firstWord = m[2]
              const rest = m[3]
              const presentWord = toPresentTense(firstWord)
              if (presentWord && presentWord.toLowerCase() !== firstWord.toLowerCase()) {
                rewrite = `${prefix}${presentWord}${rest}`
              }
            }
          }
        }

        let cleanImproved = rewrite ? cleanRewriteText(rewrite) : null

        const bEval = evalByBullet.get(b.id)
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

        if (verdict === 'hurting' && !cleanImproved) {
          const fallbackRw = generateDeterministicRewrite(b.text, sig, isCurrentRole, roleTarget)
          cleanImproved = fallbackRw ? cleanRewriteText(fallbackRw) : null
        }

        const finalWhyItWorks =
          llmMatch?.whyItWorks ||
          llmMatch?.why ||
          upgrade?.whyItWorks ||
          upgrade?.why ||
          synthesizeWhyItWorks(b.text, cleanImproved)

        audit.push({
          bulletId: b.id,
          section: section.key,
          itemName,
          text: b.text,
          original: b.text,
          status,
          reason: balanceParentheses(reason),
          critique: balanceParentheses(reason),
          whyItWorks: finalWhyItWorks,
          why: finalWhyItWorks,
          guidance: lacksOutcome ? 'Consider adding a quantified percentage or business impact metric if verifiable.' : null,
          quickPolishNote,
          rewrite: cleanImproved,
          rewritten: cleanImproved,
          improved: cleanImproved,
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
