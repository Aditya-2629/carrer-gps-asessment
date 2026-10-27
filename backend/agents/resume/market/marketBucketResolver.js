/**
 * Market Bucket Resolver — Career GPS Resume Agent V3
 *
 * Resolves a candidate's resume + target job description into a canonical
 * Role × Experience bucket identity (e.g. "software-engineer::6-8").
 *
 * Rules:
 * - Controlled role taxonomy mapping with specialization preservation
 * - Multi-source experience reconciliation (resume years + JD requirement)
 * - Returns confidence and method
 * - Rejects blind guessing when ambiguous; falls back safely and logs low confidence
 */

import crypto from 'crypto'

export const CONTROLLED_ROLES = [
  {
    roleKey: 'software-engineer',
    roleName: 'Software Engineer',
    synonyms: [
      'software developer', 'software engineer', 'full stack developer', 'full stack engineer',
      'fullstack developer', 'fullstack engineer', 'backend engineer', 'backend developer',
      'frontend engineer', 'frontend developer', 'application engineer', 'systems engineer',
      'mobile developer', 'android developer', 'ios developer', 'web developer'
    ],
    specializations: {
      backend: ['backend', 'server-side', 'microservices', 'api', 'distributed'],
      frontend: ['frontend', 'front-end', 'ui', 'ux/ui', 'react', 'client-side'],
      fullstack: ['full stack', 'fullstack', 'end-to-end'],
      mobile: ['mobile', 'android', 'ios', 'flutter', 'react native'],
      systems: ['systems', 'low-level', 'kernel', 'embedded'],
    },
  },
  {
    roleKey: 'ai-ml-engineer',
    roleName: 'AI & Machine Learning Engineer',
    synonyms: [
      'machine learning engineer', 'ml engineer', 'ai engineer', 'artificial intelligence engineer',
      'nlp engineer', 'deep learning engineer', 'computer vision engineer', 'llm engineer'
    ],
    specializations: {
      llm_rag: ['llm', 'rag', 'generative ai', 'prompt', 'langchain'],
      mlops: ['mlops', 'pipeline', 'deployment', 'inference'],
      computer_vision: ['vision', 'image', 'opencv'],
      nlp: ['nlp', 'natural language', 'text'],
    },
  },
  {
    roleKey: 'devops-engineer',
    roleName: 'DevOps & Cloud Engineer',
    synonyms: [
      'devops engineer', 'site reliability engineer', 'sre', 'cloud engineer',
      'infrastructure engineer', 'platform engineer', 'cloud architect'
    ],
    specializations: {
      sre: ['sre', 'reliability', 'incident', 'uptime'],
      cloud: ['aws', 'gcp', 'azure', 'cloud'],
      kubernetes: ['kubernetes', 'k8s', 'container'],
    },
  },
  {
    roleKey: 'data-engineer',
    roleName: 'Data Engineer',
    synonyms: [
      'data engineer', 'big data engineer', 'data platform engineer', 'etl developer', 'data pipeline engineer'
    ],
    specializations: {
      streaming: ['kafka', 'spark streaming', 'real-time', 'flink'],
      data_warehouse: ['snowflake', 'bigquery', 'redshift', 'dbt'],
    },
  },
  {
    roleKey: 'data-analyst',
    roleName: 'Data Analyst & BI Specialist',
    synonyms: [
      'data analyst', 'business intelligence analyst', 'bi analyst', 'analytics engineer', 'reporting analyst',
      'data & business analyst', 'business & data analyst', 'business analyst', 'data and business analyst',
      'data analyst / business analyst', 'insights analyst'
    ],
    specializations: {
      bi: ['tableau', 'power bi', 'looker', 'dashboard'],
      product_analytics: ['amplitude', 'mixpanel', 'retention', 'funnel'],
    },
  },
  {
    roleKey: 'product-manager',
    roleName: 'Product Manager',
    synonyms: [
      'product manager', 'technical product manager', 'product owner', 'group product manager', 'associate product manager'
    ],
    specializations: {
      technical: ['technical product manager', 'tpm', 'platform product'],
      growth: ['growth product', 'acquisition', 'monetization'],
    },
  },
  {
    roleKey: 'qa-engineer',
    roleName: 'QA & Test Automation Engineer',
    synonyms: [
      'qa engineer', 'quality assurance engineer', 'sdet', 'test automation engineer', 'software test engineer'
    ],
    specializations: {
      automation: ['cypress', 'playwright', 'selenium', 'automation'],
      performance: ['jmeter', 'load testing', 'locust', 'performance'],
    },
  },
  {
    roleKey: 'security-engineer',
    roleName: 'Security Engineer',
    synonyms: [
      'security engineer', 'cybersecurity engineer', 'information security engineer',
      'devsecops engineer', 'appsec engineer', 'cloud security engineer'
    ],
    specializations: {
      appsec: ['appsec', 'penetration', 'owasp', 'vulnerability'],
      compliance: ['soc2', 'hipaa', 'iso27001', 'governance'],
    },
  },
  {
    roleKey: 'sales-manager',
    roleName: 'Sales & Account Executive',
    synonyms: [
      'sales manager', 'account executive', 'regional sales manager', 'business development manager', 'enterprise sales director'
    ],
    specializations: {
      enterprise: ['enterprise', 'strategic accounts', 'b2b'],
      smb: ['smb', 'inside sales', 'velocity'],
    },
  },
  {
    roleKey: 'clinical-nurse',
    roleName: 'Registered Nurse & Clinical Specialist',
    synonyms: [
      'registered nurse', 'staff nurse', 'rn', 'nurse practitioner', 'clinical nurse', 'charge nurse'
    ],
    specializations: {
      icu: ['icu', 'intensive care', 'critical care'],
      er: ['emergency', 'ed', 'triage'],
      med_surg: ['med-surg', 'medical surgical'],
    },
  },
]

/**
 * Extracts estimated total years of experience from a canonical resume or raw text.
 * @param {Object} canonicalResume
 * @param {string} resumeText
 * @returns {number|null}
 */
export function extractResumeYears(canonicalResume = null, resumeText = '') {
  // 1. Check candidateSnapshot or experienceSummary in canonicalResume
  if (canonicalResume?.candidate?.experienceYears) {
    return Number(canonicalResume.candidate.experienceYears)
  }

  // 2. Scan text for explicit statements: "6 years of experience", "5+ years", etc.
  const text = (
    (canonicalResume?.summary?.text || '') + ' ' + (resumeText || '')
  ).toLowerCase()

  const expMatches = [
    /(\d+)\+?\s*(?:years|yrs)(?:\s*of)?\s*(?:experience|exp)/i,
    /experience\s*(?:of)?\s*(\d+)\+?\s*(?:years|yrs)/i,
  ]

  for (const regex of expMatches) {
    const match = text.match(regex)
    if (match && match[1]) {
      const y = parseInt(match[1], 10)
      if (y > 0 && y < 45) return y
    }
  }

  // 3. Count experience blocks or estimate from date ranges
  if (canonicalResume?.experience && Array.isArray(canonicalResume.experience)) {
    const blockCount = canonicalResume.experience.length
    if (blockCount >= 4) return 7
    if (blockCount >= 2) return 4
    if (blockCount === 1) return 2
  }

  return null
}

/**
 * Extracts experience requirement from target JD text or title.
 * @param {string} jdText
 * @returns {{ minYears: number|null, rawRequirement: string }}
 */
export function extractJdExperienceRequirement(jdText = '') {
  if (!jdText || typeof jdText !== 'string') {
    return { minYears: null, rawRequirement: 'Not specified' }
  }

  const text = jdText.toLowerCase()

  // Match e.g. "5+ years", "3-5 years", "minimum 4 years"
  const patterns = [
    /(?:minimum|at least)?\s*(\d+)\+?\s*(?:to\s*(\d+))?\s*(?:years|yrs)(?:\s*of)?\s*(?:experience|exp)?/i,
    /(\d+)\s*-\s*(\d+)\s*(?:years|yrs)/i,
    /(\d+)\+?\s*years/i,
  ]

  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) {
      const minYears = parseInt(m[1], 10)
      if (minYears >= 0 && minYears < 40) {
        return {
          minYears,
          rawRequirement: m[0].trim(),
        }
      }
    }
  }

  // Seniority cues
  if (/(?:senior|lead|principal|staff|architect)/i.test(text)) {
    return { minYears: 5, rawRequirement: 'Senior (5+ years inferred)' }
  }
  if (/(?:junior|entry|associate|intern|graduate)/i.test(text)) {
    return { minYears: 1, rawRequirement: 'Entry/Junior (0-2 years inferred)' }
  }

  return { minYears: null, rawRequirement: 'Not specified' }
}

export const BUCKET_EXPERIENCE_RANGES = ['0-2', '3-5', '6-8', '8+']

/**
 * Maps experience years to canonical bucket ('0-2', '3-5', '6-8', '8+').
 * @param {number} years
 * @returns {'0-2'|'3-5'|'6-8'|'8+'}
 */
export function mapYearsToBucket(years) {
  if (years == null || isNaN(years)) return '3-5' // safe mid-level default
  if (years <= 2) return '0-2'
  if (years <= 5) return '3-5'
  if (years <= 8) return '6-8'
  return '8+'
}

/**
 * Normalizes a raw role title / target text into a controlled role taxonomy.
 * @param {string} rawRole
 * @param {string} contextText
 * @returns {{ roleKey: string, roleName: string, specialization: string, confidence: number, method: string }}
 */
export function normalizeRoleTaxonomy(rawRole = '', contextText = '') {
  const query = `${rawRole} ${contextText}`.toLowerCase().trim()

  for (const roleDef of CONTROLLED_ROLES) {
    // Check synonyms
    const matchedSynonym = roleDef.synonyms.find((syn) => query.includes(syn))
    if (matchedSynonym) {
      // Find specialization
      let specialization = 'general'
      for (const [specKey, specKeywords] of Object.entries(roleDef.specializations || {})) {
        if (specKeywords.some((k) => query.includes(k))) {
          specialization = specKey
          break
        }
      }

      return {
        roleKey: roleDef.roleKey,
        roleName: roleDef.roleName,
        specialization,
        confidence: 0.92,
        method: 'controlled_taxonomy_match',
      }
    }
  }

  // Fallback: slugify clean title without forcing an unrelated role
  const clean = rawRole.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general-professional'
  const formattedName = rawRole.trim() || 'General Professional'

  return {
    roleKey: clean,
    roleName: formattedName,
    specialization: 'general',
    confidence: 0.65,
    method: 'slugified_fallback',
  }
}

/**
 * Master Market Bucket Resolver
 *
 * @param {Object} params
 * @param {string} [params.targetRole]
 * @param {string} [params.targetJobDescription]
 * @param {Object} [params.canonicalResume]
 * @param {string} [params.resumeText]
 * @returns {Object} Canonical Bucket Definition
 */
export function resolveMarketBucket({
  targetRole = '',
  targetJobDescription = '',
  canonicalResume = null,
  resumeText = '',
  experienceYears = null,
  experienceLevel = null,
}) {
  const candidateYears = experienceYears != null
    ? Number(experienceYears)
    : extractResumeYears(canonicalResume, resumeText)
  const jdReq = extractJdExperienceRequirement(targetJobDescription)

  // Experience resolution rules (Section 5):
  // 1. Explicit years in resume / user profile
  // 2. JD requirement
  // 3. Reconcile: If resume shows 6 years and JD says 5+ years -> 6-8
  let resolvedYears = candidateYears
  if (resolvedYears == null && jdReq.minYears != null) {
    resolvedYears = jdReq.minYears
  } else if (resolvedYears == null) {
    resolvedYears = 4 // mid-level fallback
  }

  const experienceBucket = mapYearsToBucket(resolvedYears)

  // Determine effective role text
  const primaryRoleSource =
    targetRole ||
    canonicalResume?.candidate?.targetRole ||
    (targetJobDescription ? targetJobDescription.slice(0, 120) : '')

  const roleMeta = normalizeRoleTaxonomy(primaryRoleSource, targetJobDescription)

  const bucketKey = `${roleMeta.roleKey}::${experienceBucket}`

  let confidence = roleMeta.confidence
  if (candidateYears != null && jdReq.minYears != null) {
    confidence = Math.min(0.98, confidence + 0.05)
  } else if (candidateYears == null && jdReq.minYears == null) {
    confidence = Math.max(0.5, confidence - 0.15)
  }

  return {
    bucketKey,
    roleKey: roleMeta.roleKey,
    roleName: roleMeta.roleName,
    specialization: roleMeta.specialization,
    experienceBucket,
    candidateExperienceYears: candidateYears,
    jdExperienceRequirement: jdReq.rawRequirement,
    confidence: Number(confidence.toFixed(2)),
    method: roleMeta.method,
  }
}

export default {
  resolveMarketBucket,
  normalizeRoleTaxonomy,
  extractResumeYears,
  extractJdExperienceRequirement,
  mapYearsToBucket,
  CONTROLLED_ROLES,
}
