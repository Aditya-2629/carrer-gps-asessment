/**
 * Structure Analyzer — V3
 *
 * Analyzes resume structural completeness and formatting.
 * Uses section signals and parser quality signals.
 *
 * - Treats parser warnings as UNCERTAIN, not definitive formatting errors.
 * - Does NOT assert "formatting is broken" from a parser warning.
 * - Produces observations only — NOT final issues.
 * - NO LLM calls.
 */

export const STRUCTURE_ANALYZER_VERSION = '1.0'

// Recommended sections for a complete resume
const RECOMMENDED_SECTIONS = ['summary', 'experience', 'projects', 'education', 'skills']
const OPTIONAL_SECTIONS = ['certifications']

/**
 * Main structure analyzer.
 *
 * @param {Object} resumeFacts
 * @param {Object} signals - Output from generateResumeSignals()
 * @param {Object} canonicalResume
 * @returns {{ version: string, observations: Array }}
 */
export function analyzeStructure(resumeFacts, signals, canonicalResume) {
  const observations = []

  if (!canonicalResume) {
    return { version: STRUCTURE_ANALYZER_VERSION, observations }
  }

  let obsCounter = 1
  const addObs = (obs) => {
    observations.push({ observationId: `str_${String(obsCounter++).padStart(3, '0')}`, ...obs })
  }

  const sectionSignals = signals?.sections || {}

  // 1. Header / contact
  const contactSignals = sectionSignals.contact || {}
  if (!contactSignals.email) {
    addObs({
      type: 'missing_contact_email',
      description: 'No email address detected in the resume. This is a critical contact requirement.',
      itemId: 'header_001',
      bulletId: null,
      sourceText: null,
      weight: 'high',
    })
  }

  // 2. Summary
  const hasSummary = sectionSignals.summary?.exists ?? (
    typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary.trim().length > 20
      : (canonicalResume.summary?.text || '').trim().length > 20
  )
  if (!hasSummary) {
    addObs({
      type: 'missing_summary',
      description: 'No professional summary section detected. A concise summary improves opening positioning.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'medium',
    })
  }

  // 3. Experience
  const expItems = Array.isArray(canonicalResume.experience) ? canonicalResume.experience.length : 0
  if (expItems === 0) {
    addObs({
      type: 'missing_experience',
      description: 'No structured experience items detected. This is a critical section.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'high',
    })
  }

  // 4. Projects
  const projItems = Array.isArray(canonicalResume.projects) ? canonicalResume.projects.length : 0
  // Only flag missing projects for profiles where projects are expected (technical roles)
  if (projItems === 0 && expItems < 2) {
    addObs({
      type: 'no_projects_low_experience',
      description: 'No project entries detected and limited experience items. Projects can supplement experience for early-career profiles.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'medium',
    })
  }

  // 5. Education
  const eduItems = Array.isArray(canonicalResume.education) ? canonicalResume.education.length : 0
  if (eduItems === 0) {
    addObs({
      type: 'missing_education',
      description: 'No education entries detected. Some roles require explicit educational credentials.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  }

  // 6. Skills
  const hasSkills = (signals?.skills?.summary?.totalListed ?? 0) > 0 ||
    (Array.isArray(canonicalResume.skills) && canonicalResume.skills.length > 0)
  if (!hasSkills) {
    addObs({
      type: 'missing_skills_section',
      description: 'No skills section detected. A skills section aids ATS scanning and recruiter quick-assessment.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'medium',
    })
  }

  // 7. Parser quality signals (CONDITIONAL — treated as uncertain)
  const parserWarnings = signals?.parserQuality?.warnings || []
  for (const warning of parserWarnings) {
    if (warning.type === 'possible_header_summary_merge') {
      addObs({
        type: 'possible_parser_header_merge',
        // Phrasing is conditional per Section 6 of the prompt spec
        description: `The parser may have detected that the header/contact block and summary section appear merged in the same text block (flagged at ${warning.itemId}). If the actual document layout separates these, this is a non-issue. If they are combined, separating them may improve scanability.`,
        itemId: warning.itemId,
        bulletId: warning.itemId,
        sourceText: null,
        weight: 'low',
        llmGuidance: 'CONDITIONAL_PARSER_OBSERVATION',
      })
    }
  }

  // 8. Bullet counts per job
  const shortJobItems = (canonicalResume.experience || []).filter(
    (exp) => Array.isArray(exp.bullets) && exp.bullets.length < 2
  )
  if (shortJobItems.length > 0) {
    addObs({
      type: 'low_bullet_count_experience',
      description: `${shortJobItems.length} experience item(s) have fewer than 2 bullets. More detail can provide stronger evidence of contributions.`,
      itemId: shortJobItems[0]?.id || null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  }

  return {
    version: STRUCTURE_ANALYZER_VERSION,
    observations,
    summary: {
      hasSummary,
      experienceItemCount: expItems,
      projectItemCount: projItems,
      educationItemCount: eduItems,
      hasSkills,
      parserWarningCount: parserWarnings.length,
    },
  }
}

export default analyzeStructure
