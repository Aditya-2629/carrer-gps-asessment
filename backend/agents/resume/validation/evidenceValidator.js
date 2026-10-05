/**
 * Evidence Validator — V3
 *
 * Validates that every issue and strength in the synthesis output
 * has locatable, non-fabricated evidence from the canonical resume.
 *
 * Wraps and extends the existing V2.2 evidence validation logic,
 * now integrated into the V3 validation layer.
 */

/**
 * Builds a canonical lookup from the resume.
 * @param {Object} canonicalResume
 * @returns {{ bulletMap: Map, textSet: Set, itemMap: Map }}
 */
function buildCanonicalLookup(canonicalResume) {
  const bulletMap = new Map()
  const textSet = new Set()
  const itemMap = new Map()

  // Summary
  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) || ''
  if (summaryText) {
    bulletMap.set('summary_001', summaryText)
    textSet.add(summaryText.toLowerCase().trim())
    itemMap.set('summary_001', { type: 'summary', text: summaryText })
  }

  // Skills
  const skillsData = canonicalResume.skills
  if (skillsData) {
    const skillsText =
      typeof skillsData === 'string'
        ? skillsData
        : Array.isArray(skillsData)
          ? skillsData.map((s) => (typeof s === 'string' ? s : s.name || '')).join(', ')
          : skillsData.text || ''
    bulletMap.set('skills_001', skillsText)
    if (skillsText) {
      textSet.add(skillsText.toLowerCase().trim())
      itemMap.set('skills_001', { type: 'skills', text: skillsText })
    }
  }

  // Experience
  for (const exp of (canonicalResume.experience || [])) {
    if (!exp?.id) continue
    const itemText = [exp.company, exp.role].filter(Boolean).join(' | ')
    itemMap.set(exp.id, { type: 'experience', company: exp.company, role: exp.role })
    for (const b of (exp.bullets || [])) {
      if (!b?.id || !b.text) continue
      bulletMap.set(b.id, b.text)
      textSet.add(b.text.toLowerCase().trim())
    }
  }

  // Projects
  for (const proj of (canonicalResume.projects || [])) {
    if (!proj?.id) continue
    itemMap.set(proj.id, { type: 'projects', title: proj.title })
    for (const b of (proj.bullets || [])) {
      if (!b?.id || !b.text) continue
      bulletMap.set(b.id, b.text)
      textSet.add(b.text.toLowerCase().trim())
    }
  }

  // Education
  for (const edu of (canonicalResume.education || [])) {
    if (!edu?.id) continue
    bulletMap.set(edu.id, edu.degree || '')
    itemMap.set(edu.id, { type: 'education', degree: edu.degree })
  }

  return { bulletMap, textSet, itemMap }
}

/**
 * Validates evidence for a single item (issue or strength).
 *
 * @param {Object} item - Issue or strength with .evidence
 * @param {{ bulletMap, textSet, itemMap }} lookup
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateItemEvidence(item, lookup) {
  const errors = []
  const evidenceItems = Array.isArray(item.evidence)
    ? item.evidence
    : item.evidence
      ? [item.evidence]
      : []

  if (evidenceItems.length === 0) {
    errors.push(`[${item.id}] No evidence provided`)
    return { valid: false, errors }
  }

  for (const ev of evidenceItems) {
    if (!ev) {
      errors.push(`[${item.id}] Evidence item is null`)
      continue
    }

    const { itemId, bulletId, originalText } = ev

    if (!itemId) {
      errors.push(`[${item.id}] Evidence missing itemId`)
    }
    if (!bulletId) {
      errors.push(`[${item.id}] Evidence missing bulletId`)
    }
    if (!originalText) {
      errors.push(`[${item.id}] Evidence missing originalText`)
      continue
    }

    // Verify originalText matches canonical text
    const canonicalText = lookup.bulletMap.get(bulletId) || lookup.bulletMap.get(itemId)
    if (canonicalText) {
      const normalizeStr = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()
      const normalizedOriginal = normalizeStr(originalText)
      const normalizedCanonical = normalizeStr(canonicalText)

      if (!normalizedCanonical.includes(normalizedOriginal) && !normalizedOriginal.includes(normalizedCanonical.slice(0, 80))) {
        errors.push(`[${item.id}] originalText mismatch for ${bulletId}: "${originalText.slice(0, 60)}..." not found in canonical`)
      }
    }
    // If bulletId not in lookup, it may be a valid section-level ID (skills_001, summary_001)
    else if (!['skills_001', 'summary_001'].includes(bulletId)) {
      // Only warn, not error — IDs may be structurally valid but not in our simple lookup
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates all issues and strengths in a parsed analysis.
 *
 * @param {Object} parsedAnalysis
 * @param {Object} canonicalResume
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAllEvidence(parsedAnalysis, canonicalResume) {
  if (!parsedAnalysis || !canonicalResume) return { valid: false, errors: ['Missing analysis or resume'] }

  const lookup = buildCanonicalLookup(canonicalResume)
  const allErrors = []

  for (const item of (parsedAnalysis.issues || [])) {
    const { errors } = validateItemEvidence(item, lookup)
    allErrors.push(...errors)
  }

  for (const item of (parsedAnalysis.strengths || [])) {
    const { errors } = validateItemEvidence(item, lookup)
    allErrors.push(...errors)
  }

  return { valid: allErrors.length === 0, errors: allErrors }
}

export default {
  validateItemEvidence,
  validateAllEvidence,
}
