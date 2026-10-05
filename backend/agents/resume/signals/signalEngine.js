/**
 * Deterministic Resume Signal Engine (V2.3)
 * Orchestrates deterministic signal extractors across skill evidence, metrics,
 * duplicates, timeline, section structure, parser quality, and claims.
 * Output is 100% reproducible and strictly deterministic.
 */

import { analyzeSkillEvidence } from './skillEvidence.js'
import { extractResumeMetrics } from './metricExtractor.js'
import { detectDuplicateContent } from './duplicateDetector.js'
import { analyzeTimeline } from './timelineAnalyzer.js'
import { analyzeSections } from './sectionAnalyzer.js'
import { detectParserQuality } from './parserQuality.js'
import { analyzeClaimEvidence } from './claimEvidence.js'
import { analyzeTechnologyDensity } from './technologyDensity.js'

export const SIGNAL_ENGINE_VERSION = '1.0'

/**
 * Main entry point: Generates deterministic resume signals.
 *
 * @param {Object} canonicalResume - Standard canonical resume representation
 * @returns {Object} Structured signals object
 */
export function generateResumeSignals(canonicalResume) {
  // Gracefully handle null, undefined, or empty canonical resume input
  const safeResume = canonicalResume && typeof canonicalResume === 'object' ? canonicalResume : {}

  const skills = analyzeSkillEvidence(safeResume)
  const metrics = extractResumeMetrics(safeResume)
  const duplicates = detectDuplicateContent(safeResume)
  const timeline = analyzeTimeline(safeResume)
  const sections = analyzeSections(safeResume)
  const parserQuality = detectParserQuality(safeResume)
  const claimEvidence = analyzeClaimEvidence(safeResume)
  const technologyDensity = analyzeTechnologyDensity(safeResume)

  return {
    version: SIGNAL_ENGINE_VERSION,
    skills,
    metrics,
    duplicates,
    timeline,
    sections,
    parserQuality,
    claimEvidence,
    technologyDensity,
  }
}

/**
 * Formats deterministic signals into a compact, human-readable summary
 * to inject into the LLM prompt without blowing up the token budget.
 *
 * @param {Object} signals - Output from generateResumeSignals()
 * @returns {string} Compact Markdown formatted text block
 */
export function formatCompactSignalSummary(signals) {
  if (!signals || typeof signals !== 'object') return ''

  const lines = ['## DETERMINISTIC RESUME SIGNALS']

  // 1. Skill Evidence Gaps
  const gaps = (signals.skills?.skills || [])
    .filter((s) => s.status === 'skillEvidenceGap')
    .map((s) => s.skill)

  lines.push('\nSkill evidence gaps:')
  if (gaps.length > 0) {
    for (const g of gaps.slice(0, 8)) {
      lines.push(`- ${g} → no supporting evidence found in experience/projects`)
    }
    if (gaps.length > 8) {
      lines.push(`- ...and ${gaps.length - 8} more`)
    }
  } else {
    lines.push('- none (all listed skills have supporting resume mentions)')
  }

  // 2. Strong Quantified Evidence
  lines.push('\nStrong quantified evidence:')
  const metrics = signals.metrics?.metrics || []
  if (metrics.length > 0) {
    for (const m of metrics.slice(0, 8)) {
      const loc = m.source?.bulletId || m.source?.itemId || 'resume'
      lines.push(`- ${m.value} (${m.type}) → ${loc}`)
    }
    if (metrics.length > 8) {
      lines.push(`- ...and ${metrics.length - 8} more quantified metrics`)
    }
  } else {
    lines.push('- no explicit quantitative numbers or metrics detected')
  }

  // 3. Possible Parser Warnings
  lines.push('\nPossible parser warnings:')
  const warnings = signals.parserQuality?.warnings || []
  if (warnings.length > 0) {
    for (const w of warnings) {
      lines.push(`- ${w.itemId}: ${w.message}`)
    }
  } else {
    lines.push('- none')
  }

  // 4. Duplicate Content
  lines.push('\nPotential duplicate content:')
  const dups = signals.duplicates?.duplicates || []
  if (dups.length > 0) {
    for (const d of dups.slice(0, 4)) {
      lines.push(`- ${d.pair.join(' vs ')} (${Math.round(d.similarity * 100)}% token similarity)`)
    }
  } else {
    lines.push('- none')
  }

  // 5. Timeline Overlaps
  lines.push('\nTimeline observations:')
  const overlaps = signals.timeline?.overlaps || []
  if (overlaps.length > 0) {
    for (const o of overlaps.slice(0, 4)) {
      lines.push(`- Overlapping dates: ${o.titleA} (${o.startA}–${o.endA}) and ${o.titleB} (${o.startB}–${o.endB})`)
    }
  } else {
    lines.push('- chronological progression appears contiguous without concurrent overlaps')
  }

  // 6. Technology Density Observations (§11, §12)
  const denseBullets = signals.technologyDensity?.signals || []
  if (denseBullets.length > 0) {
    lines.push('\nTechnology density observations:')
    for (const d of denseBullets.slice(0, 4)) {
      lines.push(`- ${d.bulletId}: ${d.technologyCount} technologies listed (${d.technologies.slice(0, 6).join(', ')}) — observation only, not automatically an issue`)
    }
  }

  return lines.join('\n')
}

export default {
  SIGNAL_ENGINE_VERSION,
  generateResumeSignals,
  formatCompactSignalSummary,
}
