/**
 * Resume Fact Extractor — V3
 *
 * Deterministically extracts structured facts from the canonical resume JSON.
 * No LLM calls. No inference. Strictly what the resume says.
 *
 * Every fact retains:
 *   - factId    (stable sequential ID)
 *   - type      (from FACT_TYPES)
 *   - value     (verbatim or lightly normalised)
 *   - itemId    (canonical section item ID)
 *   - bulletId  (canonical bullet ID or null)
 *   - sourceText (original text the fact was drawn from)
 *   - section   (experience | projects | summary | education | skills | certifications)
 */

import { FACT_TYPES } from '../state/resumeState.schema.js'
import { extractMetricsFromText } from '../signals/metricExtractor.js'
import { extractListedSkills } from '../signals/skillEvidence.js'

export const FACT_EXTRACTOR_VERSION = '1.0'

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _factCounter = 0

function nextFactId() {
  _factCounter++
  return `fact_${String(_factCounter).padStart(3, '0')}`
}

function resetFactCounter() {
  _factCounter = 0
}

/**
 * Creates a fact record.
 */
function makeFact(type, value, itemId, bulletId, sourceText, section, extra = {}) {
  return {
    factId: nextFactId(),
    type,
    value,
    itemId,
    bulletId: bulletId || null,
    sourceText: sourceText || '',
    section,
    ...extra,
  }
}

// ─── Extractors ───────────────────────────────────────────────────────────────

/**
 * Extracts candidate identity facts (name, contact, target role).
 */
function extractIdentityFacts(canonicalResume) {
  const facts = []
  const candidate = canonicalResume.candidate || {}

  if (candidate.name && candidate.name !== 'Candidate') {
    facts.push(makeFact(FACT_TYPES.CANDIDATE_NAME, candidate.name, 'header_001', null, candidate.name, 'header'))
  }

  if (candidate.targetRole) {
    facts.push(makeFact(FACT_TYPES.TARGET_ROLE, candidate.targetRole, 'header_001', null, candidate.targetRole, 'header'))
  }

  if (candidate.contact) {
    const { email, phone, location } = candidate.contact
    if (email && email !== 'N/A') {
      facts.push(makeFact('contact_email', email, 'header_001', null, email, 'header'))
    }
    if (phone && phone !== 'N/A') {
      facts.push(makeFact('contact_phone', phone, 'header_001', null, phone, 'header'))
    }
    if (location && location !== 'N/A') {
      facts.push(makeFact(FACT_TYPES.LOCATION, location, 'header_001', null, location, 'header'))
    }
  }

  return facts
}

/**
 * Extracts summary facts.
 */
function extractSummaryFacts(canonicalResume) {
  const facts = []
  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) || ''

  if (!summaryText.trim()) return facts

  // Extract metrics from summary
  const summaryMetrics = extractMetricsFromText(summaryText, {
    itemId: 'summary_001',
    bulletId: 'summary_001',
    originalText: summaryText,
  })

  for (const m of summaryMetrics) {
    facts.push(makeFact(FACT_TYPES.METRIC, m.value, 'summary_001', 'summary_001', summaryText, 'summary', {
      metricType: m.type,
    }))
  }

  return facts
}

/**
 * Extracts facts from a single experience item.
 */
function extractExperienceFacts(exp) {
  const facts = []
  const itemId = exp.id || 'exp_unknown'

  // Company fact
  if (exp.company || exp.title) {
    const company = exp.company || exp.title || ''
    if (company) {
      facts.push(makeFact(FACT_TYPES.COMPANY, company, itemId, null, company, 'experience'))
    }
  }

  // Role fact
  if (exp.role) {
    facts.push(makeFact(FACT_TYPES.ROLE, exp.role, itemId, null, exp.role, 'experience'))
  }

  // Date facts
  if (exp.startDate) {
    facts.push(makeFact(FACT_TYPES.DATE, exp.startDate, itemId, null, exp.startDate, 'experience', {
      dateType: 'start',
    }))
  }
  if (exp.endDate) {
    facts.push(makeFact(FACT_TYPES.DATE, exp.endDate, itemId, null, exp.endDate, 'experience', {
      dateType: 'end',
    }))
  }

  // Per-bullet facts
  if (Array.isArray(exp.bullets)) {
    for (const bullet of exp.bullets) {
      if (!bullet || !bullet.text) continue
      const bulletId = bullet.id || `${itemId}_b`
      const text = bullet.text.trim()

      // Extract metrics from bullet
      const bulletMetrics = extractMetricsFromText(text, {
        itemId,
        bulletId,
        originalText: text,
      })
      for (const m of bulletMetrics) {
        facts.push(makeFact(FACT_TYPES.METRIC, m.value, itemId, bulletId, text, 'experience', {
          metricType: m.type,
        }))
      }

      // Achievement vs responsibility classification (heuristic)
      const isAchievement = /(?:\d+%|\d+x|\breduced\b|\bincreased\b|\bimproved\b|\bdelivered\b|\bcut\b|\bsaved\b|\beliminated\b|\bauomated\b|\bfaster\b|\blowered\b|\braised\b|\bachieved\b)/i.test(text)
      const factType = isAchievement ? FACT_TYPES.ACHIEVEMENT : FACT_TYPES.RESPONSIBILITY

      facts.push(makeFact(factType, text, itemId, bulletId, text, 'experience'))
    }
  }

  return facts
}

/**
 * Extracts facts from experience section.
 */
function extractAllExperienceFacts(canonicalResume) {
  const facts = []
  if (!Array.isArray(canonicalResume.experience)) return facts
  for (const exp of canonicalResume.experience) {
    if (!exp) continue
    facts.push(...extractExperienceFacts(exp))
  }
  return facts
}

/**
 * Extracts facts from projects section.
 */
function extractProjectFacts(canonicalResume) {
  const facts = []
  if (!Array.isArray(canonicalResume.projects)) return facts

  for (const proj of canonicalResume.projects) {
    if (!proj) continue
    const itemId = proj.id || 'proj_unknown'

    if (proj.title) {
      facts.push(makeFact('project_title', proj.title, itemId, null, proj.title, 'projects'))
    }

    if (Array.isArray(proj.bullets)) {
      for (const bullet of proj.bullets) {
        if (!bullet || !bullet.text) continue
        const bulletId = bullet.id || `${itemId}_b`
        const text = bullet.text.trim()

        const bulletMetrics = extractMetricsFromText(text, { itemId, bulletId, originalText: text })
        for (const m of bulletMetrics) {
          facts.push(makeFact(FACT_TYPES.METRIC, m.value, itemId, bulletId, text, 'projects', {
            metricType: m.type,
          }))
        }

        facts.push(makeFact(FACT_TYPES.ACHIEVEMENT, text, itemId, bulletId, text, 'projects'))
      }
    }
  }

  return facts
}

/**
 * Extracts education facts.
 */
function extractEducationFacts(canonicalResume) {
  const facts = []
  if (!Array.isArray(canonicalResume.education)) return facts

  for (const edu of canonicalResume.education) {
    if (!edu) continue
    const itemId = edu.id || 'edu_unknown'
    const degreeText = [edu.degree, edu.institution, edu.year].filter(Boolean).join(' ')
    if (degreeText) {
      facts.push(makeFact(FACT_TYPES.EDUCATION, degreeText, itemId, null, degreeText, 'education'))
    }
    if (edu.institution) {
      facts.push(makeFact(FACT_TYPES.COMPANY, edu.institution, itemId, null, edu.institution, 'education', {
        context: 'institution',
      }))
    }
  }

  return facts
}

/**
 * Extracts technology facts from the skills section.
 */
function extractTechnologyFacts(canonicalResume) {
  const facts = []
  const listedSkills = extractListedSkills(canonicalResume)
  const itemId = 'skills_001'

  for (const skill of listedSkills) {
    facts.push(makeFact(FACT_TYPES.TECHNOLOGY, skill.originalName, itemId, itemId, skill.originalName, 'skills', {
      normalized: skill.normalized,
    }))
  }

  return facts
}

/**
 * Extracts certification facts.
 */
function extractCertificationFacts(canonicalResume) {
  const facts = []
  if (!Array.isArray(canonicalResume.certifications)) return facts

  for (const cert of canonicalResume.certifications) {
    if (!cert) continue
    const itemId = cert.id || 'cert_unknown'
    const certText = [cert.name, cert.issuer, cert.year].filter(Boolean).join(', ')
    if (certText) {
      facts.push(makeFact(FACT_TYPES.CERTIFICATION, certText, itemId, null, certText, 'certifications'))
    }
  }

  return facts
}

// ─── Summary builders ─────────────────────────────────────────────────────────

/**
 * Builds a structured summary of the extracted facts for easy consumption.
 */
function buildFactSummary(facts) {
  const byType = {}
  for (const f of facts) {
    byType[f.type] = (byType[f.type] || 0) + 1
  }

  const metrics = facts.filter((f) => f.type === FACT_TYPES.METRIC)
  const technologies = facts.filter((f) => f.type === FACT_TYPES.TECHNOLOGY)
  const achievements = facts.filter((f) => f.type === FACT_TYPES.ACHIEVEMENT)
  const responsibilities = facts.filter((f) => f.type === FACT_TYPES.RESPONSIBILITY)

  return {
    totalFacts: facts.length,
    byType,
    metricCount: metrics.length,
    technologyCount: technologies.length,
    achievementCount: achievements.length,
    responsibilityCount: responsibilities.length,
    hasIdentity: byType[FACT_TYPES.CANDIDATE_NAME] > 0,
    hasMetrics: metrics.length > 0,
    hasTechnologies: technologies.length > 0,
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Main fact extractor.
 * Produces deterministic structured facts from canonical resume JSON.
 *
 * @param {Object} canonicalResume - Immutable canonical resume from state.
 * @returns {{ version: string, facts: Array, summary: Object }}
 */
export function extractResumeFacts(canonicalResume) {
  resetFactCounter()

  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return {
      version: FACT_EXTRACTOR_VERSION,
      facts: [],
      summary: {
        totalFacts: 0,
        byType: {},
        metricCount: 0,
        technologyCount: 0,
        achievementCount: 0,
        responsibilityCount: 0,
        hasIdentity: false,
        hasMetrics: false,
        hasTechnologies: false,
      },
    }
  }

  const facts = [
    ...extractIdentityFacts(canonicalResume),
    ...extractSummaryFacts(canonicalResume),
    ...extractAllExperienceFacts(canonicalResume),
    ...extractProjectFacts(canonicalResume),
    ...extractEducationFacts(canonicalResume),
    ...extractTechnologyFacts(canonicalResume),
    ...extractCertificationFacts(canonicalResume),
  ]

  return {
    version: FACT_EXTRACTOR_VERSION,
    facts,
    summary: buildFactSummary(facts),
  }
}

/**
 * Returns a compact human-readable facts summary for injecting into the LLM prompt.
 * Deliberately condensed to avoid token explosion.
 *
 * @param {Object} resumeFacts - Output from extractResumeFacts()
 * @returns {string}
 */
export function formatCompactFactsSummary(resumeFacts) {
  if (!resumeFacts || !Array.isArray(resumeFacts.facts)) return ''

  const lines = ['## RESUME FACTS (Deterministic)']
  const { summary } = resumeFacts

  lines.push(`\nFact counts: ${summary.totalFacts} total`)
  lines.push(`  - Metrics: ${summary.metricCount}`)
  lines.push(`  - Technologies listed: ${summary.technologyCount}`)
  lines.push(`  - Achievement bullets: ${summary.achievementCount}`)
  lines.push(`  - Responsibility bullets: ${summary.responsibilityCount}`)

  // Key metrics
  const metricFacts = resumeFacts.facts
    .filter((f) => f.type === FACT_TYPES.METRIC)
    .slice(0, 12)

  if (metricFacts.length > 0) {
    lines.push('\nKey metrics found:')
    for (const f of metricFacts) {
      const loc = f.bulletId || f.itemId
      lines.push(`  - ${f.value} (${f.metricType}) @ ${loc}`)
    }
  }

  // Roles
  const roles = resumeFacts.facts.filter((f) => f.type === FACT_TYPES.ROLE).slice(0, 3)
  if (roles.length > 0) {
    lines.push('\nRoles:')
    for (const r of roles) {
      lines.push(`  - ${r.value} @ ${r.itemId}`)
    }
  }

  return lines.join('\n')
}

export default {
  FACT_EXTRACTOR_VERSION,
  extractResumeFacts,
  formatCompactFactsSummary,
}
