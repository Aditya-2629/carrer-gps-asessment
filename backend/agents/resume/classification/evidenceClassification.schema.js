/**
 * Evidence Classification Schema & Constants
 *
 * Defines the internal classification taxonomy for resume evidence items:
 * STRONG, BORDERLINE, WEAK, NEUTRAL.
 *
 * CRITICAL RULE: These are INTERNAL classifications only.
 * They must NEVER be exposed in final user-facing API responses.
 */

export const CLASSIFICATION_VALUES = {
  STRONG: 'STRONG',
  BORDERLINE: 'BORDERLINE',
  WEAK: 'WEAK',
  NEUTRAL: 'NEUTRAL',
}

export const CLASSIFICATION_THRESHOLDS = {
  CONFIDENCE_HIGH: 0.9,
  CONFIDENCE_MEDIUM: 0.8,
  CONFIDENCE_LOW: 0.7,
}

/**
 * Validates a single evidence classification result object.
 *
 * @param {Object} item - Classification result
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEvidenceClassification(item) {
  const errors = []
  if (!item || typeof item !== 'object') {
    return { valid: false, errors: ['Item must be an object'] }
  }

  const validValues = Object.values(CLASSIFICATION_VALUES)
  if (!validValues.includes(item.classification)) {
    errors.push(`Invalid classification: "${item.classification}". Expected one of: ${validValues.join(', ')}`)
  }

  if (typeof item.bulletId !== 'string' && typeof item.id !== 'string') {
    errors.push('Missing bulletId/id in classification result')
  }

  if (!Array.isArray(item.reasons)) {
    errors.push('reasons must be an array of strings')
  }

  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) {
    errors.push('confidence must be a number between 0 and 1')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export default {
  CLASSIFICATION_VALUES,
  CLASSIFICATION_THRESHOLDS,
  validateEvidenceClassification,
}
