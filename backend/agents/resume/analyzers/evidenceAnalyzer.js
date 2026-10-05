/**
 * Evidence Analyzer — V3
 *
 * Critical gatekeeper: every potential issue must answer
 * "WHAT EXACTLY SUPPORTS THIS?"
 *
 * Verifies that:
 * 1. Every observation from other analyzers has locatable evidence.
 * 2. Skill evidence gaps reference an actual bullet ID and item ID.
 * 3. Observations without evidence are flagged as low-confidence.
 *
 * If evidence cannot be located: the observation is marked `evidenceLocated: false`
 * and the synthesis agent should NOT promote it to a final issue.
 *
 * NO LLM calls. Fully deterministic.
 */

export const EVIDENCE_ANALYZER_VERSION = '1.0'

/**
 * Builds a comprehensive lookup of all item IDs and bullet IDs present
 * in the canonical resume.
 *
 * @param {Object} canonicalResume
 * @returns {{ itemIds: Set, bulletIds: Set, bulletTextMap: Map }}
 */
function buildEvidenceLookup(canonicalResume) {
  const itemIds = new Set()
  const bulletIds = new Set()
  const bulletTextMap = new Map() // bulletId -> text

  // Summary
  if (canonicalResume.summary) {
    itemIds.add('summary_001')
    bulletIds.add('summary_001')
    const txt = typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text || ''
    bulletTextMap.set('summary_001', txt)
  }

  // Experience
  for (const exp of (canonicalResume.experience || [])) {
    if (!exp?.id) continue
    itemIds.add(exp.id)
    for (const b of (exp.bullets || [])) {
      if (!b?.id) continue
      bulletIds.add(b.id)
      bulletTextMap.set(b.id, b.text || '')
    }
  }

  // Projects
  for (const proj of (canonicalResume.projects || [])) {
    if (!proj?.id) continue
    itemIds.add(proj.id)
    for (const b of (proj.bullets || [])) {
      if (!b?.id) continue
      bulletIds.add(b.id)
      bulletTextMap.set(b.id, b.text || '')
    }
  }

  // Skills
  itemIds.add('skills_001')
  bulletIds.add('skills_001')

  // Education
  for (const edu of (canonicalResume.education || [])) {
    if (edu?.id) {
      itemIds.add(edu.id)
      bulletIds.add(edu.id)
    }
  }

  // Certifications
  for (const cert of (canonicalResume.certifications || [])) {
    if (cert?.id) {
      itemIds.add(cert.id)
    }
  }

  return { itemIds, bulletIds, bulletTextMap }
}

/**
 * Validates a single observation against the evidence lookup.
 *
 * @param {Object} observation
 * @param {{ itemIds: Set, bulletIds: Set, bulletTextMap: Map }} lookup
 * @returns {{ evidenceLocated: boolean, reason: string | null }}
 */
function validateObservationEvidence(observation, lookup) {
  if (!observation.itemId && !observation.bulletId) {
    // Global observation — no specific evidence required
    return { evidenceLocated: true, reason: 'global_observation' }
  }

  if (observation.itemId && !lookup.itemIds.has(observation.itemId)) {
    return {
      evidenceLocated: false,
      reason: `itemId "${observation.itemId}" not found in canonical resume`,
    }
  }

  if (observation.bulletId && observation.bulletId !== observation.itemId) {
    if (!lookup.bulletIds.has(observation.bulletId)) {
      return {
        evidenceLocated: false,
        reason: `bulletId "${observation.bulletId}" not found in canonical resume`,
      }
    }
  }

  return { evidenceLocated: true, reason: null }
}

/**
 * Main evidence analyzer.
 * Verifies all analyser observations can be traced to canonical resume IDs.
 *
 * @param {Object} analyzerObservations - All analyser output from state.analyzerObservations
 * @param {Object} canonicalResume
 * @returns {{ version: string, verifiedObservations: Object, ungroundedCount: number }}
 */
export function analyzeEvidence(analyzerObservations, canonicalResume) {
  if (!canonicalResume || !analyzerObservations) {
    return {
      version: EVIDENCE_ANALYZER_VERSION,
      verifiedObservations: {},
      ungroundedCount: 0,
      totalObservations: 0,
    }
  }

  const lookup = buildEvidenceLookup(canonicalResume)
  const verifiedObservations = {}
  let totalObservations = 0
  let ungroundedCount = 0

  for (const [analyzerName, analyzerOutput] of Object.entries(analyzerObservations)) {
    if (!analyzerOutput || !Array.isArray(analyzerOutput.observations)) continue

    const verifiedList = []
    for (const obs of analyzerOutput.observations) {
      totalObservations++
      const { evidenceLocated, reason } = validateObservationEvidence(obs, lookup)
      if (!evidenceLocated) {
        ungroundedCount++
      }
      verifiedList.push({
        ...obs,
        evidenceLocated,
        evidenceLocatedReason: reason,
      })
    }

    verifiedObservations[analyzerName] = {
      ...analyzerOutput,
      observations: verifiedList,
    }
  }

  return {
    version: EVIDENCE_ANALYZER_VERSION,
    verifiedObservations,
    ungroundedCount,
    totalObservations,
    groundingRate: totalObservations > 0
      ? Number(((totalObservations - ungroundedCount) / totalObservations).toFixed(3))
      : 1.0,
  }
}

/**
 * Returns only observations that have verified evidence (evidenceLocated: true).
 * Used when building the synthesis input.
 *
 * @param {Object} verifiedObservations
 * @returns {Object} - Same structure but filtered
 */
export function filterGroundedObservations(verifiedObservations) {
  if (!verifiedObservations || typeof verifiedObservations !== 'object') return {}
  const filtered = {}
  for (const [name, output] of Object.entries(verifiedObservations)) {
    if (!output || typeof output !== 'object') continue
    filtered[name] = {
      ...output,
      observations: (output.observations || []).filter((o) => o && o.evidenceLocated !== false),
    }
  }
  return filtered
}

export default {
  EVIDENCE_ANALYZER_VERSION,
  analyzeEvidence,
  filterGroundedObservations,
}
