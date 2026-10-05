/**
 * Evidence Classifier — Resume Agent V2.4
 *
 * Classifies resume evidence into internal evaluation tiers:
 * - STRONG: Standout impact, explicit metrics, scale, performance, reliability, automation.
 * - BORDERLINE: Technically legitimate work, clear contribution, no standout metric/scale, no defect.
 * - WEAK: Genuine defect (vague responsibility, unclear ownership, pure meeting attendance, ticket pushing).
 * - NEUTRAL: Acceptable ordinary work, no meaningful defect, no strong standout signal.
 *
 * CRITICAL RULES:
 * 1. INTERNAL ONLY: These labels must NEVER appear in final user-facing API reports.
 * 2. NO FABRICATION: Do not classify based on assumed or inferred facts.
 * 3. NO "NO METRIC = WEAK" RULE: A missing number does NOT make a bullet WEAK!
 * 4. SECURITY BULLET RULE: Concrete security remediation (XSS, input validation, sanitization,
 *    key exposure, auth hardening) without a numeric metric is BORDERLINE, NEVER WEAK.
 * 5. TECHNOLOGY DENSITY RULE: Tool-dense bullets with clear ownership are BORDERLINE or STRONG,
 *    not automatically an issue.
 * 6. BORDERLINE NEUTRALITY: Prefer omission over an unreliable judgment.
 */

import { CLASSIFICATION_VALUES, CLASSIFICATION_THRESHOLDS } from './evidenceClassification.schema.js'

// ── Regex Pattern Catalogs ───────────────────────────────────────────────────

// Strong quantifiable metric & outcome indicators
const STRONG_METRIC_PATTERNS = [
  /\b\d+(?:\.\d+)?%/,
  /\b(?:cutt?ing|reduc(?:ed?|ing)|dropp(?:ed?|ing)|improv(?:ed?|ing))\s+[\w\s]{0,35}(?:latency|query|time|load|turnaround)/i,
  /\b\d+ms\b/i,
  /\b\d+(?:\.\d+)?x\b/i,
  /\b\d+\+\s*(?:hours|users|releases|production\s+releases|faculty|accounts|stars|engineers|sessions|records)\b/i,
  /\b(?:eliminat(?:ed|ing)|sav(?:ed|ing))\s+\d+\+?\s*hours\b/i,
  /\b(?:sub-\d+ms|<\s*1\s*second|\d+,\d+\s+users|\d+k\s+events|\$\d+[km]?)\b/i,
  /\b(?:zero-downtime|zero\s+double-charge|soc2\s+type\s+ii\s+compliance\s+approval)\b/i,
  /\belevating\s+[\w\s]+accuracy\s+from\s+\d+%\s+to\s+\d+%/i,
]

// Standout operational / scale outcome verbs
const STANDOUT_OUTCOME_PATTERNS = [
  /\b(?:resulting\s+in|eliminating|elevating|cutting|scaling|automated\s+continuous\s+deployment)\b/i,
]

// Specific security remediation indicators (§10)
const SECURITY_REMEDIATION_PATTERNS = [
  /\b(?:remediat(?:ed|ing)|mitigat(?:ed|ing)|prevent(?:ed|ing))\s+(?:xss|csrf|sql\s+injection|vulnerabilit(?:y|ies)|sensitive-key\s+exposure|secrets?|tampering)\b/i,
  /\b(?:built\s+secure\s+apis|input\s+validation\s+and\s+sanitization|role-based\s+tenant\s+isolation|auth(?:entication|orization)\s+(?:hardening|middleware)|meeting\s+soc2\s+compliance)\b/i,
]

// Vague responsibility / weak ownership indicators (§4)
const WEAK_RESPONSIBILITY_PATTERNS = [
  /^(?:responsible\s+for\s+(?:writing\s+code|maintaining|developing|bug\s+fixing|routine|tasks|tickets))/i,
  /^(?:assisted\s+(?:senior\s+)?developers|assisted\s+with\s+(?:backend\s+)?bug\s+fixing|helped\s+(?:with|to))/i,
  /^(?:worked\s+with\s+team\s+members\s+in\s+daily|participated\s+in\s+daily|attended\s+(?:daily|weekly|sprint)\s+(?:agile\s+)?(?:standup|status|planning)\s+meetings)/i,
  /^(?:handled\s+(?:customer\s+)?support\s+tickets\s+and\s+investigated)/i,
  /^(?:attended\s+weekly\s+project\s+status\s+meetings)/i,
]

// Concrete active technical verbs indicative of legitimate engineering contribution
const LEGITIMATE_TECHNICAL_VERBS = [
  /^(?:architected|engineered|designed|implemented|developed|built|refactored|migrated|authored|deployed|configured|orchestrated|containerized|automated|scaled|conducted|benchmarked|created|re-indexed|indexed|optimized|restructured|tuned|rewrote)\b/i,
]

// Routine / ordinary operational tasks indicative of NEUTRAL (§5)
const NEUTRAL_TASK_PATTERNS = [
  /^(?:updated\s+content\s+and\s+images|tested\s+website\s+links|tested\s+browser\s+compatibility|maintained\s+documentation|wrote\s+documentation\s+for\s+team)/i,
  /^(?:collaborated\s+with\s+business\s+stakeholders\s+to\s+gather\s+data\s+requirements)/i,
]

/**
 * Classifies a single resume bullet point text.
 *
 * @param {string} text - Raw bullet text
 * @param {Object} options - Optional context (duplicateScore, hasMetrics, techCount, etc.)
 * @returns {{ classification: string, reasons: string[], confidence: number }}
 */
export function classifyBullet(text, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      classification: CLASSIFICATION_VALUES.NEUTRAL,
      reasons: ['Empty or non-string bullet text'],
      confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_HIGH,
    }
  }

  const clean = text.trim()
  const reasons = []

  // 1. Check for WEAK criteria (§4)
  // Check for duplicate / redundancy
  if (options.duplicateScore && options.duplicateScore >= 0.8) {
    reasons.push(`Redundant content with high token similarity (${Math.round(options.duplicateScore * 100)}%)`)
    return {
      classification: CLASSIFICATION_VALUES.WEAK,
      reasons,
      confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_HIGH,
    }
  }

  // Check for vague responsibility / passive ownership
  for (const pattern of WEAK_RESPONSIBILITY_PATTERNS) {
    if (pattern.test(clean)) {
      reasons.push('Vague responsibility without demonstrated individual contribution or outcome')
      return {
        classification: CLASSIFICATION_VALUES.WEAK,
        reasons,
        confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_HIGH,
      }
    }
  }

  // Check for meeting attendance / ticket administration alone
  if (/\b(?:attended|participated\s+in)\s+(?:daily|weekly|sprint)\s+(?:standup|status|planning|meetings|ceremonies)\b/i.test(clean)) {
    reasons.push('Routine meeting attendance without an engineering outcome')
    return {
      classification: CLASSIFICATION_VALUES.WEAK,
      reasons,
      confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_HIGH,
    }
  }

  // Check for pure technology list obscuring actual work
  const commaCount = (clean.match(/,/g) || []).length
  const words = clean.split(/\s+/).length
  if (commaCount >= 5 && words < 12 && !/[a-z]{4,}ed\b/i.test(clean)) {
    reasons.push('Technology list obscures actual work with minimal action context')
    return {
      classification: CLASSIFICATION_VALUES.WEAK,
      reasons,
      confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_MEDIUM,
    }
  }

  // 2. Check for STRONG criteria (§2)
  let hasStrongMetric = false
  for (const pattern of STRONG_METRIC_PATTERNS) {
    if (pattern.test(clean)) {
      hasStrongMetric = true
      break
    }
  }

  if (hasStrongMetric) {
    // If has strong metric and an active verb or outcome
    const hasActiveVerb = LEGITIMATE_TECHNICAL_VERBS.some((p) => p.test(clean))
    const hasStandoutOutcome = STANDOUT_OUTCOME_PATTERNS.some((p) => p.test(clean))

    if (hasActiveVerb || hasStandoutOutcome || options.hasMetrics) {
      reasons.push('Explicit measurable impact, performance improvement, or scale outcome with clear ownership')
      return {
        classification: CLASSIFICATION_VALUES.STRONG,
        reasons,
        confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_HIGH,
      }
    }
  }

  // Check for standout non-numeric outcome (e.g. SOC2 Type II compliance approval, zero downtime)
  if (/\b(?:achieving\s+soc2\s+type\s+ii\s+compliance\s+approval|delivering\s+[\w\s]+\s+with\s+zero-downtime)\b/i.test(clean)) {
    reasons.push('High-stakes compliance or reliability outcome achieved')
    return {
      classification: CLASSIFICATION_VALUES.STRONG,
      reasons,
      confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_HIGH,
    }
  }

  // 3. Check for BORDERLINE criteria (§3, §10, §11)
  // Security bullet protection (§10)
  const isSecurityBullet = SECURITY_REMEDIATION_PATTERNS.some((p) => p.test(clean))
  if (isSecurityBullet) {
    reasons.push('Security remediation with concrete controls (XSS, sensitive-key, auth/sanitization) — legitimate work without standout metric')
    return {
      classification: CLASSIFICATION_VALUES.BORDERLINE,
      reasons,
      confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_HIGH,
    }
  }

  // Technology-dense bullet with architecture ownership (§11)
  if (options.techCount && options.techCount >= 4) {
    if (LEGITIMATE_TECHNICAL_VERBS.some((p) => p.test(clean)) || /\b(?:owned|architected|led)\b/i.test(clean)) {
      reasons.push('Technology-dense bullet with clear technical ownership; work is legitimate but lacks quantified result')
      return {
        classification: CLASSIFICATION_VALUES.BORDERLINE,
        reasons,
        confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_MEDIUM,
      }
    }
  }

  // Concrete technical work without metrics
  const startsWithTechnicalVerb = LEGITIMATE_TECHNICAL_VERBS.some((p) => p.test(clean))
  if (startsWithTechnicalVerb) {
    // Check if it's an ordinary routine task vs technical engineering work
    const isRoutine = NEUTRAL_TASK_PATTERNS.some((p) => p.test(clean))
    if (!isRoutine) {
      reasons.push('Technically legitimate engineering contribution with clear action, but lacks standout quantitative outcome')
      return {
        classification: CLASSIFICATION_VALUES.BORDERLINE,
        reasons,
        confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_MEDIUM,
      }
    }
  }

  // 4. Check for NEUTRAL (§5)
  for (const pattern of NEUTRAL_TASK_PATTERNS) {
    if (pattern.test(clean)) {
      reasons.push('Acceptable routine operational task without standout impact or significant defect')
      return {
        classification: CLASSIFICATION_VALUES.NEUTRAL,
        reasons,
        confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_HIGH,
      }
    }
  }

  // Default fallback: acceptable ordinary bullet
  reasons.push('Ordinary resume bullet without standout strength or material defect')
  return {
    classification: CLASSIFICATION_VALUES.NEUTRAL,
    reasons,
    confidence: CLASSIFICATION_THRESHOLDS.CONFIDENCE_LOW,
  }
}

/**
 * Classifies all evidence bullets across canonical resume.
 *
 * @param {Object} resumeFacts - Output from extractResumeFacts()
 * @param {Object} signals - Output from generateResumeSignals()
 * @param {Object} canonicalResume - Canonical resume representation
 * @returns {{ byBulletId: Object, items: Array, summary: Object }}
 */
export function classifyAllEvidence(resumeFacts, signals, canonicalResume) {
  const items = []
  const byBulletId = {}

  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return { byBulletId, items, summary: { total: 0 } }
  }

  // Extract duplicate bullet IDs if any
  const duplicateScores = {}
  if (signals?.duplicates?.duplicates) {
    for (const d of signals.duplicates.duplicates) {
      if (d.bulletA) duplicateScores[d.bulletA] = Math.max(duplicateScores[d.bulletA] || 0, d.similarity || 0)
      if (d.bulletB) duplicateScores[d.bulletB] = Math.max(duplicateScores[d.bulletB] || 0, d.similarity || 0)
    }
  }

  // Extract tech density map if available
  const techCounts = {}
  if (signals?.technologyDensity?.signals) {
    for (const td of signals.technologyDensity.signals) {
      if (td.bulletId) techCounts[td.bulletId] = td.technologyCount || 0
    }
  }

  // 1. Process Experience Bullets
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp || !Array.isArray(exp.bullets)) continue
      for (const bullet of exp.bullets) {
        if (!bullet || !bullet.id) continue
        const bText = (bullet.text || '').trim()
        const classification = classifyBullet(bText, {
          duplicateScore: duplicateScores[bullet.id] || 0,
          techCount: techCounts[bullet.id] || 0,
        })

        const item = {
          bulletId: bullet.id,
          itemId: exp.id || 'exp_unknown',
          section: 'experience',
          text: bText,
          classification: classification.classification,
          reasons: classification.reasons,
          confidence: classification.confidence,
        }
        items.push(item)
        byBulletId[bullet.id] = item
      }
    }
  }

  // 2. Process Project Bullets
  if (Array.isArray(canonicalResume.projects)) {
    for (const proj of canonicalResume.projects) {
      if (!proj || !Array.isArray(proj.bullets)) continue
      for (const bullet of proj.bullets) {
        if (!bullet || !bullet.id) continue
        const bText = (bullet.text || '').trim()
        const classification = classifyBullet(bText, {
          duplicateScore: duplicateScores[bullet.id] || 0,
          techCount: techCounts[bullet.id] || 0,
        })

        const item = {
          bulletId: bullet.id,
          itemId: proj.id || 'proj_unknown',
          section: 'projects',
          text: bText,
          classification: classification.classification,
          reasons: classification.reasons,
          confidence: classification.confidence,
        }
        items.push(item)
        byBulletId[bullet.id] = item
      }
    }
  }

  const counts = {
    STRONG: items.filter((i) => i.classification === CLASSIFICATION_VALUES.STRONG).length,
    BORDERLINE: items.filter((i) => i.classification === CLASSIFICATION_VALUES.BORDERLINE).length,
    WEAK: items.filter((i) => i.classification === CLASSIFICATION_VALUES.WEAK).length,
    NEUTRAL: items.filter((i) => i.classification === CLASSIFICATION_VALUES.NEUTRAL).length,
  }

  return {
    byBulletId,
    items,
    summary: {
      total: items.length,
      ...counts,
    },
  }
}

export default {
  classifyBullet,
  classifyAllEvidence,
}
