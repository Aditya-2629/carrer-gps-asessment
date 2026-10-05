/**
 * Technology Density Signal Detector — Resume Agent V2.4
 *
 * Implements Spec §11 & §12:
 * Detects resume bullets with high technology density (e.g. 4+ or 5+ tools listed in a single bullet).
 *
 * CRITICAL RULE:
 * This is an OBSERVATION. It is NOT automatically an issue.
 * The LLM must decide whether tooling materially harms readability or obscures contribution.
 */

import { SIGNAL_TYPES } from './signalTypes.js'

export const TECHNOLOGY_DENSITY_VERSION = '1.0'

// Curated list of known technologies, ordered with longer multi-word phrases first
const KNOWN_TECHNOLOGIES = [
  'AWS Inspector',
  'AWS ECS',
  'AWS EKS',
  'AWS Lambda',
  'AWS RDS',
  'AWS S3',
  'AWS EC2',
  'Google Cloud Platform',
  'Google Cloud',
  'GitHub Actions',
  'GitLab CI',
  'Spring Boot',
  'REST APIs',
  'JSON-RPC',
  'PostgreSQL',
  'DynamoDB',
  'ChromaDB',
  'Pinecone',
  'FastMCP',
  'LangChain',
  'LlamaIndex',
  'Kubernetes',
  'Terraform',
  'OpenTelemetry',
  'Elasticsearch',
  'RabbitMQ',
  'Jenkins',
  'Grafana',
  'Prometheus',
  'Trivy',
  'Datadog',
  'Docker',
  'Redis',
  'Kafka',
  'Node.js',
  'FastAPI',
  'Express',
  'React',
  'Next.js',
  'Redux',
  'Vue',
  'Angular',
  'TypeScript',
  'JavaScript',
  'Python',
  'Golang',
  'MySQL',
  'MongoDB',
  'GraphQL',
  'gRPC',
  'Jest',
  'Cypress',
  'Ansible',
  'AWS',
  'GCP',
  'Azure',
  'Go',
  'Java',
  'Rust',
  'Git',
  'Linux',
  'SQL',
]

// Precompile word-boundary regular expressions for each technology
const TECH_REGEXES = KNOWN_TECHNOLOGIES.map((tech) => {
  const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\b${escaped}\\b`, 'i')
  return { name: tech, regex: pattern }
})

/**
 * Extracts matched technologies from a bullet string.
 *
 * @param {string} text - Bullet text
 * @returns {string[]} Matched technology names
 */
export function extractTechnologiesFromText(text) {
  if (!text || typeof text !== 'string') return []

  const matched = []
  let remainingText = text

  for (const { name, regex } of TECH_REGEXES) {
    if (regex.test(remainingText)) {
      matched.push(name)
      // Mask out the matched occurrence to avoid substring collisions
      remainingText = remainingText.replace(regex, ' ___ ')
    }
  }

  return matched
}

/**
 * Analyzes technology density across experience and project bullets.
 *
 * @param {Object} canonicalResume
 * @param {Object} options - Threshold for technology count (default: 4)
 * @returns {{ version: string, signals: Array, summary: Object }}
 */
export function analyzeTechnologyDensity(canonicalResume, options = {}) {
  const threshold = options.threshold || 4
  const signals = []

  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return { version: TECHNOLOGY_DENSITY_VERSION, signals, summary: { totalDenseBullets: 0 } }
  }

  const checkBullet = (bullet, itemId) => {
    if (!bullet || !bullet.text || !bullet.id) return
    const techs = extractTechnologiesFromText(bullet.text)
    if (techs.length >= threshold) {
      signals.push({
        type: SIGNAL_TYPES.TECHNOLOGY_DENSITY,
        itemId,
        bulletId: bullet.id,
        technologyCount: techs.length,
        technologies: techs,
      })
    }
  }

  // Check experience bullets
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp || !Array.isArray(exp.bullets)) continue
      for (const bullet of exp.bullets) {
        checkBullet(bullet, exp.id || 'exp_unknown')
      }
    }
  }

  // Check project bullets
  if (Array.isArray(canonicalResume.projects)) {
    for (const proj of canonicalResume.projects) {
      if (!proj || !Array.isArray(proj.bullets)) continue
      for (const bullet of proj.bullets) {
        checkBullet(bullet, proj.id || 'proj_unknown')
      }
    }
  }

  return {
    version: TECHNOLOGY_DENSITY_VERSION,
    signals,
    summary: {
      totalDenseBullets: signals.length,
    },
  }
}

export const detectTechnologyDensity = analyzeTechnologyDensity

export default {
  TECHNOLOGY_DENSITY_VERSION,
  extractTechnologiesFromText,
  analyzeTechnologyDensity,
  detectTechnologyDensity,
}
