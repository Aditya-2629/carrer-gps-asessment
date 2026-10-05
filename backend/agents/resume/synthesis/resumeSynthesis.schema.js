/**
 * Resume Synthesis Schema — V3
 * Maintains V2.2 output contract for full frontend compatibility.
 */

import { REQUIRED_ANALYSIS_FIELDS, ISSUE_CATEGORIES, ISSUE_SEVERITIES } from '../resumeAgent.schema.js'

export { REQUIRED_ANALYSIS_FIELDS, ISSUE_CATEGORIES, ISSUE_SEVERITIES }

// Re-export for synthesis layer consumers
export const SYNTHESIS_OUTPUT_VERSION = '2.2'

/**
 * Validates that synthesis output conforms to the V2.2 contract.
 * @param {Object} output - Parsed synthesis JSON
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSynthesisOutput(output) {
  const errors = []
  if (!output || typeof output !== 'object') return { valid: false, errors: ['Not an object'] }

  for (const field of REQUIRED_ANALYSIS_FIELDS) {
    if (!(field in output)) errors.push(`Missing required field: ${field}`)
  }

  if (output.analysisVersion !== SYNTHESIS_OUTPUT_VERSION) {
    errors.push(`analysisVersion must be "${SYNTHESIS_OUTPUT_VERSION}", got "${output.analysisVersion}"`)
  }

  if (output.dashboard !== null) {
    errors.push('dashboard must be null (score computed deterministically)')
  }

  if (Array.isArray(output.issues) && output.issues.length > 10) {
    errors.push(`Maximum 10 issues allowed, got ${output.issues.length}`)
  }

  return { valid: errors.length === 0, errors }
}

export default {
  SYNTHESIS_OUTPUT_VERSION,
  validateSynthesisOutput,
}
