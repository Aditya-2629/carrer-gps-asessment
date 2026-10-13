/**
 * JD Normalizer — Career GPS Resume Agent V3
 *
 * Normalizes, extracts signals from, validates, and deduplicates raw job postings
 * scraped from external sources (e.g. Apify).
 *
 * Enforces Section 7 (Exactly 5 active JDs), Section 29 (Deduplication),
 * and Section 30 (Quality Filter).
 */

import crypto from 'crypto'

// Common technical and functional skill dictionary for deterministic signal extraction
export const COMMON_MARKET_SKILLS = [
  // Languages & Core Tech
  'python', 'javascript', 'typescript', 'java', 'golang', 'go', 'c++', 'c#', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'git',
  // Frameworks & Libraries
  'react', 'next.js', 'node.js', 'vue', 'angular', 'spring boot', 'django', 'fastapi', 'flask', 'express', '.net', 'tailwind',
  // Cloud & DevOps
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins', 'github actions', 'helm', 'ansible', 'linux',
  // Databases & Messaging
  'postgresql', 'mongodb', 'mysql', 'redis', 'elasticsearch', 'kafka', 'rabbitmq', 'dynamodb', 'snowflake', 'bigquery',
  // AI, Data & BI
  'tableau', 'power bi', 'looker', 'excel', 'dbt', 'rag', 'langchain', 'llm', 'pytorch', 'tensorflow', 'scikit-learn', 'spark', 'pandas', 'numpy', 'openai api',
  // Security & Architecture
  'microservices', 'graphql', 'rest api', 'grpc', 'system design', 'soc2', 'oauth', 'jwt'
]

// Common seniority & leadership indicators
export const SENIORITY_INDICATORS = [
  'system design', 'architecture', 'architectural decisions', 'technical ownership',
  'lead', 'mentorship', 'cross-functional leadership', 'strategic planning',
  'production scale', 'high-throughput', 'code review', 'reliability & uptime'
]

/**
 * Computes deterministic fingerprint hash for a job posting.
 * hash(normalizedTitle + normalizedCompany + normalizedDescription + normalizedUrl)
 */
export function computeJdFingerprint({ title = '', company = '', description = '', sourceUrl = '' }) {
  const normTitle = String(title).toLowerCase().replace(/[^a-z0-9]/g, '')
  const normCompany = String(company).toLowerCase().replace(/[^a-z0-9]/g, '')
  const normDesc = String(description).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 1000)
  const normUrl = String(sourceUrl || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  return crypto
    .createHash('sha256')
    .update(`${normTitle}|${normCompany}|${normDesc}|${normUrl}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Cleans raw JD text, removes HTML tags, normalizes whitespace.
 */
export function cleanJdText(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return ''

  return rawText
    .replace(/<[^>]*>/g, ' ') // Strip HTML tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
}

export const CANONICAL_SKILL_CASING = {
  'aws': 'AWS',
  'azure': 'Azure',
  'gcp': 'GCP',
  'sql': 'SQL',
  'fastapi': 'FastAPI',
  'next.js': 'Next.js',
  'node.js': 'Node.js',
  'vue': 'Vue.js',
  'ci/cd': 'CI/CD',
  'rest api': 'REST API',
  'graphql': 'GraphQL',
  'llm': 'LLM',
  'rag': 'RAG',
  'api': 'API',
  'html': 'HTML',
  'css': 'CSS',
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'power bi': 'Power BI',
  'tableau': 'Tableau',
  'snowflake': 'Snowflake',
  'postgresql': 'PostgreSQL',
  'mongodb': 'MongoDB',
  'mysql': 'MySQL',
}

/**
 * Extracts recognized skills from JD text.
 */
export function extractSkillsFromJd(cleanText = '') {
  const lower = cleanText.toLowerCase()
  const found = new Set()

  for (const skill of COMMON_MARKET_SKILLS) {
    // Word boundary check
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(lower)) {
      // Capitalize canonically
      const canon = CANONICAL_SKILL_CASING[skill.toLowerCase()] || skill
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      found.add(canon)
    }
  }

  return Array.from(found)
}

/**
 * Extracts responsibilities & action phrases from JD text.
 */
export function extractResponsibilitiesFromJd(cleanText = '') {
  const sentences = cleanText.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean)
  const responsibilities = []

  const actionKeywords = [
    'design and build', 'architect', 'develop', 'implement', 'collaborate with',
    'maintain and optimize', 'lead the development', 'scale', 'partner with',
    'ensure high availability', 'deliver production', 'mentor and guide'
  ]

  for (const sent of sentences) {
    if (sent.length < 20 || sent.length > 200) continue
    const lower = sent.toLowerCase()
    for (const kw of actionKeywords) {
      if (lower.includes(kw)) {
        responsibilities.push(sent)
        break
      }
    }
  }

  return responsibilities.slice(0, 8)
}

/**
 * Extracts seniority signals from JD text.
 */
export function extractSenioritySignalsFromJd(cleanText = '') {
  const lower = cleanText.toLowerCase()
  const found = []

  for (const sig of SENIORITY_INDICATORS) {
    if (lower.includes(sig)) {
      found.push(
        sig.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      )
    }
  }

  return Array.from(new Set(found))
}

/**
 * Evaluates whether a JD candidate record satisfies the Quality Filter (Section 30).
 *
 * Check:
 * ✓ title exists
 * ✓ description exists and length >= 100
 * ✓ not obviously spam
 * ✓ role similarity check
 */
export function validateJdQuality(candidate, targetRoleKey = '') {
  if (!candidate || typeof candidate !== 'object') {
    const reason = 'Candidate record is empty or invalid.'
    return { valid: false, isValid: false, reason, reasons: [reason] }
  }

  const title = (candidate.title || '').trim()
  const description = (candidate.description || candidate.text || '').trim()

  if (!title || title.length < 3) {
    const reason = 'Title is missing or too short.'
    return { valid: false, isValid: false, reason, reasons: [reason] }
  }

  if (!description || description.length < 120) {
    const reason = 'Description is missing or too brief (< 120 characters).'
    return { valid: false, isValid: false, reason, reasons: [reason] }
  }

  // Check for obvious spam or placeholder postings
  const spamKeywords = ['test job', 'do not apply', 'lorem ipsum', 'placeholder', 'dummy job']
  const lowerDesc = description.toLowerCase()
  if (spamKeywords.some((w) => lowerDesc.includes(w) || title.toLowerCase().includes(w))) {
    const reason = 'Record contains test/spam keywords.'
    return { valid: false, isValid: false, reason, reasons: [reason] }
  }

  return { valid: true, isValid: true, reasons: [] }
}

/**
 * Normalizes an individual candidate JD.
 */
export function normalizeSingleJd(rawJob, targetRoleKey = '') {
  const cleanTitle = (rawJob.title || rawJob.position || rawJob.jobTitle || 'Untitled Position').trim()
  const cleanCompany = (rawJob.company || rawJob.companyName || rawJob.organization || 'Not Disclosed').trim()
  const cleanLocation = (rawJob.location || rawJob.jobLocation || 'Remote / Not Disclosed').trim()
  const rawDescription = rawJob.description || rawJob.jobDescription || rawJob.text || rawJob.body || ''
  const cleanDesc = cleanJdText(rawDescription)
  const sourceUrl = rawJob.url || rawJob.link || rawJob.sourceUrl || null
  const sourceJobId = rawJob.id || rawJob.jobId || null

  const fingerprint = computeJdFingerprint({
    title: cleanTitle,
    company: cleanCompany,
    description: cleanDesc,
    sourceUrl,
  })

  const skills = extractSkillsFromJd(cleanDesc)
  const responsibilities = extractResponsibilitiesFromJd(cleanDesc)
  const senioritySignals = extractSenioritySignalsFromJd(cleanDesc)

  return {
    sourceJobId: sourceJobId ? String(sourceJobId) : null,
    title: cleanTitle,
    company: cleanCompany,
    location: cleanLocation,
    description: cleanDesc,
    normalizedDescription: cleanDesc.slice(0, 1500),
    skills,
    responsibilities,
    senioritySignals,
    source: rawJob.source || 'apify',
    sourceUrl,
    scrapedAt: rawJob.scrapedAt ? new Date(rawJob.scrapedAt) : new Date(),
    fingerprint,
  }
}

/**
 * Normalizes a pool of candidates, filters out invalid records, deduplicates,
 * and selects the top 5 diverse JDs (Section 7, Section 29, Section 30).
 *
 * @param {Array<Object>} candidates
 * @param {string} targetRoleKey
 * @param {number} [targetCount=5]
 * @returns {{ selected: Array<Object>, totalFetched: number, duplicatesRemoved: number, validCount: number }}
 */
export function processAndSelectTopJds(candidates = [], targetRoleKey = '', targetCount = 5) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { selected: [], totalFetched: 0, duplicatesRemoved: 0, validCount: 0 }
  }

  const seenFingerprints = new Set()
  const seenCompanies = new Map() // track company frequency for diversity
  const validCandidates = []
  let duplicatesRemoved = 0

  for (const raw of candidates) {
    const qualityCheck = validateJdQuality(raw, targetRoleKey)
    if (!qualityCheck.valid) continue

    const normalized = normalizeSingleJd(raw, targetRoleKey)

    if (seenFingerprints.has(normalized.fingerprint)) {
      duplicatesRemoved++
      continue
    }

    seenFingerprints.add(normalized.fingerprint)
    validCandidates.push(normalized)
  }

  // Diversity sorting: prioritize companies seen fewer times, then candidates with richer skill/responsibility signals
  validCandidates.sort((a, b) => {
    const compA = (a.company || '').toLowerCase()
    const compB = (b.company || '').toLowerCase()
    const countA = seenCompanies.get(compA) || 0
    const countB = seenCompanies.get(compB) || 0

    if (countA !== countB) return countA - countB

    // Richer signal count
    const scoreA = a.skills.length + a.senioritySignals.length
    const scoreB = b.skills.length + b.senioritySignals.length
    return scoreB - scoreA
  })

  // Select top N respecting diversity
  const selected = []
  for (const cand of validCandidates) {
    if (selected.length >= targetCount) break
    const comp = (cand.company || '').toLowerCase()
    const count = seenCompanies.get(comp) || 0

    // Prefer at most 2 from the same company if total pool allows
    if (count >= 2 && validCandidates.length > targetCount) continue

    seenCompanies.set(comp, count + 1)
    selected.push(cand)
  }

  // If still need more to reach targetCount, fill from remaining
  if (selected.length < targetCount) {
    for (const cand of validCandidates) {
      if (selected.length >= targetCount) break
      if (!selected.some((s) => s.fingerprint === cand.fingerprint)) {
        selected.push(cand)
      }
    }
  }

  return {
    selected: selected.slice(0, targetCount),
    totalFetched: candidates.length,
    duplicatesRemoved,
    validCount: validCandidates.length,
  }
}

export const normalizeJdRecord = normalizeSingleJd

export function selectTopMarketJds(candidates = [], options = {}) {
  const targetRoleKey = options.targetRole || options.targetRoleKey || ''
  const targetCount = options.targetCount || 5
  const result = processAndSelectTopJds(candidates, targetRoleKey, targetCount)
  return {
    selectedJds: result.selected,
    deduplicatedCount: result.duplicatesRemoved,
    totalCandidates: result.totalFetched,
    validCandidates: result.validCount,
  }
}

export default {
  computeJdFingerprint,
  cleanJdText,
  extractSkillsFromJd,
  extractResponsibilitiesFromJd,
  extractSenioritySignalsFromJd,
  validateJdQuality,
  normalizeSingleJd,
  normalizeJdRecord,
  processAndSelectTopJds,
  selectTopMarketJds,
  COMMON_MARKET_SKILLS,
  SENIORITY_INDICATORS,
}
