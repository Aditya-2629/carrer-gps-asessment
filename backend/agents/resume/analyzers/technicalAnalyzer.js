/**
 * Technical Analyzer — V3
 *
 * Evaluates technical depth from explicit resume evidence.
 * Does NOT label work as "production", "enterprise", "advanced", or "senior-level"
 * unless the evidence explicitly supports the statement.
 *
 * Prefers: "demonstrates...", "shows evidence of...", "indicates..."
 *
 * Domains considered:
 * - Backend / API
 * - Frontend
 * - Cloud / Infrastructure
 * - AI / LLM / ML
 * - Data systems
 * - Security
 * - DevOps / CI-CD
 * - System design / Architecture
 * - Testing / Evaluation
 * - Integrations
 *
 * NO LLM calls. Fully deterministic.
 */

export const TECHNICAL_ANALYZER_VERSION = '1.0'

// Technical domain keyword mappings
const TECH_DOMAINS = {
  backend_api: ['api', 'rest', 'graphql', 'grpc', 'websocket', 'fastapi', 'express', 'django', 'flask', 'spring', 'endpoint', 'service', 'microservice'],
  frontend: ['react', 'vue', 'angular', 'next.js', 'svelte', 'ui', 'frontend', 'css', 'html', 'tailwind', 'component', 'rendering'],
  cloud_infra: ['aws', 'gcp', 'azure', 'ec2', 's3', 'lambda', 'kubernetes', 'k8s', 'docker', 'container', 'cloud', 'serverless', 'terraform', 'ecs', 'eks'],
  ai_ml: ['llm', 'rag', 'embedding', 'vector', 'fine-tuning', 'transformer', 'langchain', 'openai', 'huggingface', 'model', 'inference', 'retrieval', 'mcp', 'agent'],
  data_systems: ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'kafka', 'database', 'query', 'index', 'cache', 'data pipeline'],
  security: ['authentication', 'authorization', 'oauth', 'jwt', 'ssl', 'tls', 'encryption', 'xss', 'csrf', 'injection', 'vulnerability', 'secure', 'access control'],
  devops_cicd: ['ci/cd', 'jenkins', 'github actions', 'gitlab', 'pipeline', 'deployment', 'release', 'terraform', 'ansible', 'monitoring', 'alerting', 'observability'],
  architecture: ['architecture', 'design', 'pattern', 'scalable', 'distributed', 'event-driven', 'microservice', 'modular', 'system', 'schema'],
  testing: ['test', 'unit test', 'integration test', 'e2e', 'coverage', 'jest', 'pytest', 'evaluation', 'benchmark', 'regression'],
  integrations: ['integration', 'webhook', 'sdk', 'third-party', 'api integration', 'oauth', 'stripe', 'twilio', 'sendgrid'],
}

/**
 * Returns which technical domains are evidenced in a block of text.
 * @param {string} text
 * @returns {string[]}
 */
function detectTechDomains(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return Object.entries(TECH_DOMAINS)
    .filter(([, keywords]) => keywords.some((kw) => lower.includes(kw)))
    .map(([domain]) => domain)
}

/**
 * Collects all searchable text blocks from canonical resume.
 */
function collectAllText(canonicalResume) {
  const blocks = []

  // Summary
  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) || ''
  if (summaryText) blocks.push({ itemId: 'summary_001', bulletId: 'summary_001', text: summaryText })

  // Experience
  for (const exp of (canonicalResume.experience || [])) {
    const header = [exp.role, exp.company].filter(Boolean).join(' ')
    if (header) blocks.push({ itemId: exp.id, bulletId: `${exp.id}_header`, text: header })
    for (const b of (exp.bullets || [])) {
      if (b.text) blocks.push({ itemId: exp.id, bulletId: b.id, text: b.text })
    }
  }

  // Projects
  for (const proj of (canonicalResume.projects || [])) {
    if (proj.title) blocks.push({ itemId: proj.id, bulletId: `${proj.id}_header`, text: proj.title })
    for (const b of (proj.bullets || [])) {
      if (b.text) blocks.push({ itemId: proj.id, bulletId: b.id, text: b.text })
    }
  }

  return blocks
}

/**
 * Main technical analyzer.
 *
 * @param {Object} resumeFacts
 * @param {Object} signals
 * @param {Object} canonicalResume
 * @returns {{ version: string, observations: Array, domainMap: Object }}
 */
export function analyzeTechnical(resumeFacts, signals, canonicalResume) {
  const observations = []
  const domainMap = {} // domain -> [{itemId, bulletId, text}]

  if (!canonicalResume) {
    return { version: TECHNICAL_ANALYZER_VERSION, observations, domainMap }
  }

  let obsCounter = 1
  const addObs = (obs) => {
    observations.push({ observationId: `tch_${String(obsCounter++).padStart(3, '0')}`, ...obs })
  }

  const allBlocks = collectAllText(canonicalResume)

  // Build domain map from all text blocks
  for (const block of allBlocks) {
    const domains = detectTechDomains(block.text)
    for (const domain of domains) {
      if (!domainMap[domain]) domainMap[domain] = []
      domainMap[domain].push({ itemId: block.itemId, bulletId: block.bulletId, text: block.text.slice(0, 150) })
    }
  }

  const domainsPresent = Object.keys(domainMap)
  const domainCount = domainsPresent.length

  // 1. Technical breadth observation
  if (domainCount >= 5) {
    addObs({
      type: 'broad_technical_coverage',
      description: `Resume shows evidence of ${domainCount} technical domains: ${domainsPresent.join(', ')}. This indicates broad full-stack or multi-discipline technical exposure.`,
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  } else if (domainCount >= 2) {
    addObs({
      type: 'focused_technical_profile',
      description: `Resume demonstrates ${domainCount} technical domains: ${domainsPresent.join(', ')}. This suggests a more focused technical specialization.`,
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  } else if (domainCount <= 1) {
    addObs({
      type: 'narrow_technical_evidence',
      description: 'Technical domain coverage in resume bullets is narrow. The resume may benefit from clarifying the technical breadth of work performed.',
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'medium',
    })
  }

  // 2. AI/LLM engineering detection
  if (domainMap.ai_ml && domainMap.ai_ml.length >= 2) {
    addObs({
      type: 'ai_ml_evidence',
      description: `Resume demonstrates AI/ML engineering experience across ${domainMap.ai_ml.length} evidence locations. This includes evidence of: RAG, embeddings, LLMs, or agent-based architecture based on explicit text.`,
      itemId: domainMap.ai_ml[0]?.itemId || null,
      bulletId: domainMap.ai_ml[0]?.bulletId || null,
      sourceText: domainMap.ai_ml[0]?.text || null,
      weight: 'low',
    })
  }

  // 3. Security evidence observation (NOT a flag — security work without metrics is still valid)
  if (domainMap.security && domainMap.security.length >= 1) {
    addObs({
      type: 'security_domain_evidence',
      description: `Resume shows evidence of security-related work (${domainMap.security.length} location(s)). Security technical controls, input validation, and vulnerability remediation are valid first-class technical outcomes — treat with appropriate weight.`,
      itemId: domainMap.security[0]?.itemId || null,
      bulletId: domainMap.security[0]?.bulletId || null,
      sourceText: domainMap.security[0]?.text || null,
      weight: 'low',
      llmGuidance: 'SECURITY_BULLETS_ARE_VALID_IMPACT',
    })
  }

  // 4. Architecture evidence
  if (domainMap.architecture && domainMap.architecture.length >= 1) {
    addObs({
      type: 'architecture_evidence',
      description: `Resume shows evidence of system/architecture-level thinking across ${domainMap.architecture.length} location(s).`,
      itemId: null,
      bulletId: null,
      sourceText: null,
      weight: 'low',
    })
  }

  return {
    version: TECHNICAL_ANALYZER_VERSION,
    observations,
    domainMap,
    summary: {
      domainCount,
      domainsPresent,
      hasAIML: !!domainMap.ai_ml,
      hasSecurity: !!domainMap.security,
      hasArchitecture: !!domainMap.architecture,
      hasDevOps: !!domainMap.devops_cicd,
    },
  }
}

export default analyzeTechnical
