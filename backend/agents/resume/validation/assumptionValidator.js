/**
 * Assumption Validator — V3
 *
 * Detects unsupported assumption language in LLM analysis output.
 * Scans: issue diagnosis, whyItMatters, recommendation, correctedText,
 *        overallReview, priorityActions, strengths.
 *
 * Unsupported assumption = a claim about the resume that is NOT explicitly
 * present in the resume text.
 *
 * Returns: unsupportedAssumptions[] with location and matched pattern.
 */

// Phrases that assume context not present in resume
const UNSUPPORTED_ASSUMPTION_PATTERNS = [
  // Seniority assumptions
  { pattern: /\bproduction.?ready\b/i, label: 'production_ready' },
  { pattern: /\benterprise.?grade\b/i, label: 'enterprise_grade' },
  { pattern: /\benterprise.?scale\b/i, label: 'enterprise_scale' },
  { pattern: /\bhigh.?scale\b/i, label: 'high_scale' },
  { pattern: /\bmission.?critical\b/i, label: 'mission_critical' },
  { pattern: /\bbusiness.?critical\b/i, label: 'business_critical' },

  // Project type assumptions
  { pattern: /\bstudent.?(?:project|level|work)\b/i, label: 'student_level' },
  { pattern: /\bacademic.?project\b/i, label: 'academic_project' },
  { pattern: /\btutorial.?project\b/i, label: 'tutorial_project' },
  { pattern: /\bbasic\s+crud\b/i, label: 'basic_crud' },
  { pattern: /\bpersonal\s+project\b/i, label: 'personal_project_assumed' },

  // Team/leadership assumptions
  { pattern: /\bled\s+a\s+team\b/i, label: 'led_a_team' },
  { pattern: /\bmanaged\s+(?:a\s+team|engineers|developers)\b/i, label: 'managed_engineers' },
  { pattern: /\bteam\s+of\s+\d+\b/i, label: 'specific_team_size' },

  // Deployment/environment assumptions
  { pattern: /\bproduction\s+system\b/i, label: 'production_system' },
  { pattern: /\bcustomer.?facing\b/i, label: 'customer_facing' },
  { pattern: /\bopen.?source\b/i, label: 'open_source' },

  // Hiring outcome fabrication
  { pattern: /\bwill\s+(?:definitely|certainly|always|never)\b/i, label: 'hiring_guarantee' },
  { pattern: /\byou\s+(?:will|won't)\s+(?:get|pass|fail|succeed|land)\b/i, label: 'outcome_prediction' },
  { pattern: /\bguarantee(?:d)?\b/i, label: 'guarantee' },
]

/**
 * Scans a text block for unsupported assumption patterns.
 * @param {string} text
 * @param {string} location - Descriptor for where the text came from (e.g., "issue_001.diagnosis")
 * @returns {Array<{ location: string, label: string, match: string }>}
 */
export function scanForUnsupportedAssumptions(text, location) {
  if (!text || typeof text !== 'string') return []
  const found = []
  for (const { pattern, label } of UNSUPPORTED_ASSUMPTION_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      found.push({ location, label, match: match[0] })
    }
  }
  return found
}

/**
 * Scans all relevant fields in the parsed analysis output.
 *
 * @param {Object} parsedAnalysis
 * @returns {Array<{ location: string, label: string, match: string }>}
 */
export function detectUnsupportedAssumptions(parsedAnalysis) {
  if (!parsedAnalysis || typeof parsedAnalysis !== 'object') return []

  const allAssumptions = []

  // Overall review
  const reviewText = parsedAnalysis.overallReview?.summary || ''
  allAssumptions.push(...scanForUnsupportedAssumptions(reviewText, 'overallReview.summary'))

  // Strengths
  for (const str of (parsedAnalysis.strengths || [])) {
    allAssumptions.push(...scanForUnsupportedAssumptions(str.description || '', `${str.id}.description`))
  }

  // Issues
  for (const iss of (parsedAnalysis.issues || [])) {
    allAssumptions.push(...scanForUnsupportedAssumptions(iss.diagnosis || '', `${iss.id}.diagnosis`))
    allAssumptions.push(...scanForUnsupportedAssumptions(iss.whyItMatters || '', `${iss.id}.whyItMatters`))
    allAssumptions.push(...scanForUnsupportedAssumptions(iss.recommendation || '', `${iss.id}.recommendation`))
    allAssumptions.push(...scanForUnsupportedAssumptions(iss.correctedText || '', `${iss.id}.correctedText`))
  }

  // Priority actions
  for (const pa of (parsedAnalysis.priorityActions || [])) {
    allAssumptions.push(...scanForUnsupportedAssumptions(pa.action || '', `priority_${pa.priority}.action`))
    allAssumptions.push(...scanForUnsupportedAssumptions(pa.reason || '', `priority_${pa.priority}.reason`))
  }

  return allAssumptions
}

export default {
  scanForUnsupportedAssumptions,
  detectUnsupportedAssumptions,
}
