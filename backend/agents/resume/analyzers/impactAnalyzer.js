/**
 * Impact Analyzer — V3
 *
 * Analyzes explicit measurable outcomes from resume evidence.
 * Categories: performance, scale, reliability, security, automation,
 * efficiency, accessibility, operational impact, business impact.
 *
 * IMPORTANT:
 * - Uses extracted facts as input — does NOT re-parse resume text.
 * - Does NOT invent missing outcomes.
 * - A bullet without a number is NOT automatically flagged as weak.
 * - Technical outcomes count as first-class impact.
 * - NO LLM calls.
 */

import { FACT_TYPES } from '../state/resumeState.schema.js'

export const IMPACT_ANALYZER_VERSION = '1.0'

// Outcome keyword groups mapped to impact categories
const IMPACT_CATEGORIES = {
  performance: ['latency', 'speed', 'load time', 'throughput', 'rps', 'response time', 'faster', 'reduced', 'optimized', 'accelerated', 'millisecond', 'second'],
  scale: ['users', 'requests', 'concurrent', 'capacity', 'volume', 'scale', 'traffic', 'load', 'events', 'sessions'],
  reliability: ['uptime', 'downtime', 'availability', 'zero-downtime', 'sla', 'recovery', 'failover', 'resilient', 'fault-tolerant'],
  security: ['vulnerability', 'xss', 'injection', 'authentication', 'authorization', 'encryption', 'compliance', 'audit', 'access control', 'secure', 'sanitization', 'validation'],
  automation: ['automated', 'ci/cd', 'pipeline', 'workflow', 'scripted', 'eliminated manual', 'reduced manual', 'hours/week', 'hours/month'],
  efficiency: ['reduced', 'decreased', 'eliminated', 'saved', 'streamlined', 'simplified', 'consolidat'],
  developer_productivity: ['deployment', 'release', 'integration', 'test coverage', 'developer', 'build time', 'iteration'],
  data: ['accuracy', 'retrieval', 'precision', 'recall', 'f1', 'model', 'evaluation', 'dataset'],
}

/**
 * Detects impact categories present in a text.
 * @param {string} text
 * @returns {string[]} matched category names
 */
function detectImpactCategories(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return Object.entries(IMPACT_CATEGORIES)
    .filter(([, keywords]) => keywords.some((kw) => lower.includes(kw)))
    .map(([category]) => category)
}

/**
 * Main impact analyzer.
 *
 * @param {Object} resumeFacts - Output from extractResumeFacts()
 * @param {Object} signals - Output from generateResumeSignals()
 * @param {Object} canonicalResume - Immutable canonical resume
 * @returns {{ version: string, observations: Array, evidence: Array, impactMap: Object }}
 */
export function analyzeImpact(resumeFacts, signals, canonicalResume) {
  const observations = []
  const evidence = []
  const impactMap = {} // category -> [{factId, value, itemId, bulletId, sourceText}]

  if (!resumeFacts || !resumeFacts.facts) {
    return { version: IMPACT_ANALYZER_VERSION, observations, evidence, impactMap }
  }

  let obsCounter = 1
  const addObs = (obs) => {
    observations.push({ observationId: `imp_${String(obsCounter++).padStart(3, '0')}`, ...obs })
  }

  // 1. Catalog all metrics by impact category
  const metricFacts = resumeFacts.facts.filter((f) => f.type === FACT_TYPES.METRIC)
  const achievementFacts = resumeFacts.facts.filter((f) => f.type === FACT_TYPES.ACHIEVEMENT)

  for (const fact of achievementFacts) {
    const categories = detectImpactCategories(fact.sourceText || fact.value)
    for (const cat of categories) {
      if (!impactMap[cat]) impactMap[cat] = []
      impactMap[cat].push({
        factId: fact.factId,
        value: fact.value,
        itemId: fact.itemId,
        bulletId: fact.bulletId,
        sourceText: fact.sourceText,
      })
      evidence.push({ itemId: fact.itemId, bulletId: fact.bulletId, sourceText: fact.sourceText })
    }
  }

  // 2. Observe strong quantified impact
  if (metricFacts.length >= 5) {
    addObs({
      type: 'strong_quantified_evidence',
      description: `Resume contains ${metricFacts.length} quantified metrics across experience and projects, indicating measurable impact documentation.`,
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  } else if (metricFacts.length === 0) {
    addObs({
      type: 'no_quantified_metrics',
      description: 'No explicit quantified metrics (percentages, counts, multipliers, durations) were detected in the resume.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'medium',
    })
  }

  // 3. Security bullets without specific outcomes
  const securityBullets = achievementFacts.filter((f) =>
    detectImpactCategories(f.sourceText || '').includes('security')
  )
  for (const sb of securityBullets) {
    const hasMetricInBullet = metricFacts.some((m) => m.bulletId === sb.bulletId)
    // NOTE: We do NOT flag security bullets as weak just because they lack a metric.
    // Security outcomes (XSS remediation, access control, sanitization) are valid first-class impact.
    if (!hasMetricInBullet && /(secure|xss|vulnerability|sanitiz|injection)/i.test(sb.sourceText || '')) {
      addObs({
        type: 'security_impact_observation',
        description: `Security-related bullet at ${sb.bulletId} describes a specific technical control. No numeric metric is present, which is common for security work. The LLM should treat this as valid technical impact unless there is a specific positioning reason to flag it.`,
        itemId: sb.itemId,
        bulletId: sb.bulletId,
        sourceText: sb.sourceText,
        weight: 'low',
        llmGuidance: 'DO_NOT_FLAG_AS_MISSING_METRIC',
      })
    }
  }

  // 4. Automation impact detection
  const automationBullets = achievementFacts.filter((f) =>
    detectImpactCategories(f.sourceText || '').includes('automation')
  )
  if (automationBullets.length > 0) {
    addObs({
      type: 'automation_evidence_found',
      description: `${automationBullets.length} bullet(s) demonstrate automation outcomes (CI/CD, pipeline, reduced manual work).`,
      itemId: automationBullets[0].itemId,
      bulletId: automationBullets[0].bulletId,
      sourceText: automationBullets[0].sourceText,
      weight: 'low',
    })
  }

  // 5. Impact categories present summary
  const categoriesFound = Object.keys(impactMap)
  if (categoriesFound.length > 0) {
    addObs({
      type: 'impact_categories_summary',
      description: `Resume demonstrates impact across ${categoriesFound.length} categories: ${categoriesFound.join(', ')}.`,
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  }

  return {
    version: IMPACT_ANALYZER_VERSION,
    observations,
    evidence,
    impactMap,
    summary: {
      totalMetrics: metricFacts.length,
      impactCategoriesFound: Object.keys(impactMap),
      securityBulletsCount: securityBullets.length,
      automationBulletsCount: automationBullets.length,
    },
  }
}

export default analyzeImpact
