/**
 * Market Profile Builder — Career GPS Resume Agent V3
 *
 * Deterministically aggregates exactly 5 normalized JDs into a compact,
 * evidence-grounded MarketProfile.
 *
 * Enforces:
 * - Deterministic aggregation: NO LLM call
 * - Skill frequency, responsibility frequency, seniority signals
 * - Sample size calculation (target: 5)
 * - Traceable references to individual JD evidence snippets
 */

import { extractSkillsFromJd, extractResponsibilitiesFromJd, extractSenioritySignalsFromJd } from './jdNormalizer.js'

export const MARKET_PROFILE_VERSION = 'market-profile-v1'

/**
 * Builds a deterministic aggregated market profile from an array of normalized JDs.
 * Supports both (bucketKey, jobs) and (jobs, options) signatures.
 *
 * @param {string|Array<Object>} bucketKeyOrJobs
 * @param {Array<Object>|Object} jobsOrOptions
 * @returns {Object} Deterministic MarketProfile
 */
export function buildMarketProfile(bucketKeyOrJobs, jobsOrOptions = []) {
  let bucketKey = 'default'
  let jobs = []

  if (typeof bucketKeyOrJobs === 'string') {
    bucketKey = bucketKeyOrJobs
    jobs = Array.isArray(jobsOrOptions) ? jobsOrOptions : []
  } else if (Array.isArray(bucketKeyOrJobs)) {
    jobs = bucketKeyOrJobs
    if (typeof jobsOrOptions === 'string') {
      bucketKey = jobsOrOptions
    } else if (jobsOrOptions && typeof jobsOrOptions === 'object') {
      bucketKey = jobsOrOptions.bucketKey || 'default'
    }
  }

  const sampleSize = Array.isArray(jobs) ? jobs.length : 0
  if (sampleSize === 0) {
    return {
      bucketKey,
      sampleSize: 0,
      skills: [],
      responsibilities: [],
      senioritySignals: [],
      topKeywords: [],
      marketEvidence: [],
      version: MARKET_PROFILE_VERSION,
      generatedAt: new Date().toISOString(),
    }
  }

  const skillCounts = new Map()
  const skillEvidence = new Map()
  const responsibilityCounts = new Map()
  const seniorityCounts = new Map()

  jobs.forEach((job, idx) => {
    const jobId = job.sourceJobId || `job_${idx + 1}`

    // 1. Skills frequency & evidence snippets (auto extract if empty)
    const jobSkills = job.skills && job.skills.length > 0
      ? job.skills
      : extractSkillsFromJd(job.normalizedDescription || job.description || '')
    const uniqueJobSkills = new Set(jobSkills)

    uniqueJobSkills.forEach((skill) => {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1)

      if (!skillEvidence.has(skill)) {
        skillEvidence.set(skill, [])
      }
      skillEvidence.get(skill).push({
        jobId,
        company: job.company || 'Market Sample',
        title: job.title,
        signal: skill,
        source: 'market_jd',
      })
    })

    // 2. Responsibilities
    const uniqueJobResps = new Set(
      (job.responsibilities || []).map((r) => r.slice(0, 80).trim())
    )
    uniqueJobResps.forEach((resp) => {
      if (!resp) return
      responsibilityCounts.set(resp, (responsibilityCounts.get(resp) || 0) + 1)
    })

    // 3. Seniority signals
    const uniqueSeniority = new Set(job.senioritySignals || [])
    uniqueSeniority.forEach((sig) => {
      seniorityCounts.set(sig, (seniorityCounts.get(sig) || 0) + 1)
    })
  })

  // Format skills with frequency and frequencyRatio
  const skills = Array.from(skillCounts.entries())
    .map(([name, frequency]) => ({
      name,
      frequency,
      frequencyRatio: Number((frequency / sampleSize).toFixed(2)),
    }))
    .sort((a, b) => b.frequency - a.frequency)

  // Format responsibilities
  const responsibilities = Array.from(responsibilityCounts.entries())
    .map(([name, frequency]) => ({
      name,
      frequency,
      frequencyRatio: Number((frequency / sampleSize).toFixed(2)),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10)

  // Format seniority signals
  const senioritySignals = Array.from(seniorityCounts.entries())
    .map(([name, frequency]) => ({
      name,
      frequency,
      frequencyRatio: Number((frequency / sampleSize).toFixed(2)),
    }))
    .sort((a, b) => b.frequency - a.frequency)

  // Top keywords for search/indexing
  const topKeywords = skills.slice(0, 15).map((s) => s.name)

  // Flatten evidence snippets for top skills
  const marketEvidence = []
  skills.slice(0, 10).forEach((s) => {
    const snippets = skillEvidence.get(s.name) || []
    marketEvidence.push(...snippets.slice(0, 2))
  })

  return {
    bucketKey,
    sampleSize,
    skills,
    responsibilities,
    senioritySignals,
    topKeywords,
    marketEvidence,
    version: MARKET_PROFILE_VERSION,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Formats a MarketProfile into a compact, token-efficient text block for prompt injection.
 * (Section 18 & Section 36: NO full 5 raw JDs, only structured aggregate facts).
 *
 * @param {Object} marketProfile
 * @returns {string} Compact text representation
 */
export function formatMarketProfileForPrompt(marketProfile) {
  if (!marketProfile || !marketProfile.sampleSize || marketProfile.sampleSize === 0) {
    return ''
  }

  const { bucketKey, sampleSize, skills = [], responsibilities = [], senioritySignals = [] } = marketProfile

  const lines = [
    `## SAMPLED MARKET INTELLIGENCE (${bucketKey})`,
    `Aggregated from exactly ${sampleSize} active market JDs for this role & experience level.`,
    `Treat as factual market observations ("Appeared in X of ${sampleSize} sampled JDs"). Never frame frequency as an absolute requirement.\n`,
  ]

  if (skills.length > 0) {
    lines.push('Top Market Skills:')
    const topSkills = skills.slice(0, 12).map((s) => `- ${s.name}: ${s.frequency}/${sampleSize} JDs (${Math.round(s.frequencyRatio * 100)}%)`)
    lines.push(topSkills.join('\n'))
  }

  if (senioritySignals.length > 0) {
    lines.push('\nSeniority & Ownership Expectations in Market:')
    const topSeniority = senioritySignals.slice(0, 6).map((s) => `- ${s.name}: ${s.frequency}/${sampleSize} JDs`)
    lines.push(topSeniority.join('\n'))
  }

  if (responsibilities.length > 0) {
    lines.push('\nCommon Core Responsibilities:')
    const topResps = responsibilities.slice(0, 5).map((r) => `- ${r.name} (${r.frequency}/${sampleSize} JDs)`)
    lines.push(topResps.join('\n'))
  }

  return lines.join('\n')
}

export default {
  buildMarketProfile,
  formatMarketProfileForPrompt,
  MARKET_PROFILE_VERSION,
}
