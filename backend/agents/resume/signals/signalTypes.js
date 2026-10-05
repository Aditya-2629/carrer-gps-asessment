/**
 * Centralized Signal Types and Category Constants for Deterministic Signal Engine
 */

export const SIGNAL_TYPES = {
  SKILL_EVIDENCE_GAP: 'SKILL_EVIDENCE_GAP',
  METRIC_PRESENT: 'METRIC_PRESENT',
  DUPLICATE_CONTENT: 'DUPLICATE_CONTENT',
  TIMELINE_OVERLAP: 'TIMELINE_OVERLAP',
  PARSER_WARNING: 'PARSER_WARNING',
  SECTION_STRUCTURE: 'SECTION_STRUCTURE',
  CLAIM_EVIDENCE: 'CLAIM_EVIDENCE',
  TECHNOLOGY_DENSITY: 'technology_density',
}

export const SKILL_STATUS = {
  EVIDENCE_FOUND: 'evidenceFound',
  SKILL_EVIDENCE_GAP: 'skillEvidenceGap',
}

export const METRIC_CATEGORIES = {
  PERCENTAGE: 'percentage',
  COUNT: 'count',
  DURATION: 'duration',
  TIME: 'time',
  CURRENCY: 'currency',
  MULTIPLIER: 'multiplier',
  RANGE: 'range',
}

export const CLAIM_TYPES = {
  QUANTITATIVE: 'quantitative',
  PERFORMANCE: 'performance',
  SCALE: 'scale',
  OUTCOME: 'outcome',
  TECHNOLOGY: 'technology',
}

export const PARSER_WARNING_TYPES = {
  POSSIBLE_HEADER_SUMMARY_MERGE: 'possible_header_summary_merge',
  REPEATED_HEADER_TEXT: 'repeated_header_text',
  SUSPICIOUSLY_LONG_SUMMARY: 'suspiciously_long_summary',
  DUPLICATED_TEXT_BLOCKS: 'duplicated_text_blocks',
  MISSING_SECTION_BOUNDARIES: 'missing_section_boundaries',
  UNUSUAL_CHARACTER_SEQUENCES: 'unusual_character_sequences',
  BROKEN_BULLET_FORMATTING: 'broken_bullet_formatting',
}

export default {
  SIGNAL_TYPES,
  SKILL_STATUS,
  METRIC_CATEGORIES,
  CLAIM_TYPES,
  PARSER_WARNING_TYPES,
}
