/**
 * Consistency Checker & Contradiction Resolver — Resume Agent V2.4
 *
 * Implements Spec §9 & §17:
 * Checks whether the same evidence (bulletId) is used by both a strength and an issue.
 * If a contradiction is detected:
 * - STRONG → Retained in strengths, removed from issues
 * - WEAK → Retained in issues, removed from strengths
 * - BORDERLINE → Removed from BOTH strengths and issues
 *
 * Silently resolves contradictions before final output.
 * Does NOT expose contradiction handling to the end user.
 */

import { CLASSIFICATION_VALUES } from './evidenceClassification.schema.js'

/**
 * Extracts bullet IDs from an evidence structure (array, object, or string).
 *
 * @param {Object|Array|string} evidence
 * @returns {string[]}
 */
export function extractBulletIds(evidence) {
  if (!evidence) return []
  if (Array.isArray(evidence)) {
    return evidence.map((e) => (typeof e === 'object' ? e?.bulletId : e)).filter(Boolean)
  }
  if (typeof evidence === 'object') {
    return evidence.bulletId ? [evidence.bulletId] : []
  }
  if (typeof evidence === 'string') {
    return [evidence]
  }
  return []
}

/**
 * Resolves contradictions between strengths and issues.
 *
 * @param {Object} analysis - The parsed analysis object containing strengths, issues, priorityActions
 * @param {Object} evidenceClassifications - Map of bulletId -> { classification, ... }
 * @returns {{ sanitizedAnalysis: Object, contradictions: Array, resolutionSummary: Object }}
 */
export function resolveEvidenceConsistency(analysis, evidenceClassifications = {}) {
  if (!analysis || typeof analysis !== 'object') {
    return { sanitizedAnalysis: analysis, contradictions: [], resolutionSummary: { totalContradictions: 0 } }
  }

  const strengths = Array.isArray(analysis.strengths) ? [...analysis.strengths] : []
  const issues = Array.isArray(analysis.issues) ? [...analysis.issues] : []
  const contradictions = []

  // Map bullet IDs in strengths
  const strengthBulletMap = new Map() // bulletId -> [strengthIndex]
  strengths.forEach((s, idx) => {
    const bulletIds = extractBulletIds(s.evidence)
    for (const bId of bulletIds) {
      if (!strengthBulletMap.has(bId)) strengthBulletMap.set(bId, [])
      strengthBulletMap.get(bId).push(idx)
    }
  })

  // Map bullet IDs in issues
  const issueBulletMap = new Map() // bulletId -> [issueIndex]
  issues.forEach((iss, idx) => {
    const bulletIds = extractBulletIds(iss.evidence)
    for (const bId of bulletIds) {
      if (!issueBulletMap.has(bId)) issueBulletMap.set(bId, [])
      issueBulletMap.get(bId).push(idx)
    }
  })

  // Find all conflicting bullet IDs present in BOTH strengths and issues
  const strengthsToRemove = new Set()
  const issuesToRemove = new Set()

  for (const [bulletId, strIndices] of strengthBulletMap.entries()) {
    if (issueBulletMap.has(bulletId)) {
      const issIndices = issueBulletMap.get(bulletId)
      const classificationInfo = evidenceClassifications[bulletId]
      const classification = classificationInfo?.classification || CLASSIFICATION_VALUES.BORDERLINE

      const contradictionRecord = {
        bulletId,
        strengthIndices: strIndices,
        issueIndices: issIndices,
        classification,
        action: '',
      }

      if (classification === CLASSIFICATION_VALUES.STRONG) {
        // Retained in strengths, removed from issues unless that would drop issues below 3
        if (issues.length - issuesToRemove.size > 3) {
          for (const idx of issIndices) issuesToRemove.add(idx)
          contradictionRecord.action = 'retained_in_strengths_removed_from_issues'
        } else {
          for (const idx of strIndices) strengthsToRemove.add(idx)
          contradictionRecord.action = 'retained_in_issues_to_preserve_minimum'
        }
      } else if (classification === CLASSIFICATION_VALUES.WEAK) {
        // Retained in issues, removed from strengths
        for (const idx of strIndices) strengthsToRemove.add(idx)
        contradictionRecord.action = 'retained_in_issues_removed_from_strengths'
      } else {
        // BORDERLINE or default: remove from both if safe, otherwise prioritize keeping issue count >= 3
        for (const idx of strIndices) strengthsToRemove.add(idx)
        if (issues.length - issuesToRemove.size > 3) {
          for (const idx of issIndices) issuesToRemove.add(idx)
          contradictionRecord.action = 'omitted_from_both'
        } else {
          contradictionRecord.action = 'retained_in_issues_omitted_from_strengths'
        }
      }

      contradictions.push(contradictionRecord)
    }
  }

  // Filter out removed items and assign sequential IDs safely
  const sanitizedStrengths = strengths
    .filter((_, idx) => !strengthsToRemove.has(idx))
    .map((s, idx) => ({
      ...s,
      id: `str_${String(idx + 1).padStart(3, '0')}`,
    }))

  const sanitizedIssues = issues
    .filter((_, idx) => !issuesToRemove.has(idx))
    .map((iss, idx) => ({
      ...iss,
      id: `iss_${String(idx + 1).padStart(3, '0')}`,
    }))

  // Filter and re-index priorityActions if an action referenced a removed issue
  let sanitizedActions = Array.isArray(analysis.priorityActions)
    ? analysis.priorityActions.map((pa) => ({ ...pa }))
    : []
  if (issuesToRemove.size > 0) {
    const removedIssueIds = new Set(
      issues.filter((_, idx) => issuesToRemove.has(idx)).map((iss) => iss.id)
    )
    sanitizedActions = sanitizedActions
      .filter((pa) => !pa.issueId || !removedIssueIds.has(pa.issueId))
      .map((pa, idx) => ({
        ...pa,
        ...(typeof pa.priority === 'number' ? { priority: idx + 1 } : {}),
        ...(typeof pa.order === 'number' ? { order: idx + 1 } : {}),
      }))
  }

  const sanitizedAnalysis = {
    ...analysis,
    strengths: sanitizedStrengths,
    issues: sanitizedIssues,
    priorityActions: sanitizedActions,
  }

  return {
    sanitizedAnalysis,
    contradictions,
    resolutionSummary: {
      totalContradictions: contradictions.length,
      strengthsRemoved: strengthsToRemove.size,
      issuesRemoved: issuesToRemove.size,
    },
  }
}

export default {
  extractBulletIds,
  resolveEvidenceConsistency,
}
