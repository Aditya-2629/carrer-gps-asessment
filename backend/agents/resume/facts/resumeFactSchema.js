/**
 * Resume Fact Schema — V3
 * Type definitions and allowed values for the fact layer.
 */

// Allowed fact types (mirrors FACT_TYPES in resumeState.schema.js for portability)
export const FACT_TYPE_VALUES = [
  'metric',
  'technology',
  'role',
  'company',
  'date',
  'achievement',
  'responsibility',
  'certification',
  'education',
  'location',
  'candidate_name',
  'target_role',
  'contact_email',
  'contact_phone',
  'project_title',
]

// Metric sub-types (from signal engine)
export const METRIC_TYPE_VALUES = [
  'percentage',
  'count',
  'duration',
  'time',
  'currency',
  'multiplier',
  'range',
]

/**
 * Example of a valid fact record:
 * {
 *   factId: "fact_001",
 *   type: "metric",
 *   value: "38%",
 *   itemId: "exp_001",
 *   bulletId: "exp_001_b01",
 *   sourceText: "Reduced manual support queries by 38% via RAG pipeline.",
 *   section: "experience",
 *   metricType: "percentage"
 * }
 */

/**
 * Validates a fact record has the minimum required fields.
 * @param {Object} fact
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFact(fact) {
  const errors = []
  if (!fact || typeof fact !== 'object') return { valid: false, errors: ['Not an object'] }
  if (!fact.factId) errors.push('Missing factId')
  if (!FACT_TYPE_VALUES.includes(fact.type)) errors.push(`Invalid type: ${fact.type}`)
  if (fact.value === undefined || fact.value === null) errors.push('Missing value')
  if (!fact.itemId) errors.push('Missing itemId')
  if (!fact.section) errors.push('Missing section')
  return { valid: errors.length === 0, errors }
}

export default {
  FACT_TYPE_VALUES,
  METRIC_TYPE_VALUES,
  validateFact,
}
