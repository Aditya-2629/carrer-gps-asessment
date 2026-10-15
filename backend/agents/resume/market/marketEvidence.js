/**
 * Market Evidence Engine — Career GPS Resume Agent V3
 *
 * Compares Candidate Resume × Target JD × Market Profile.
 *
 * Enforces:
 * - Section 15: Target JD has absolute priority over market data
 * - Section 16: "Market Evidence Gap" is strictly separated from "Skill Gap"
 * - Section 19: Distinguishes Resume Quality, Target JD Alignment, and Market Context
 * - Section 33: Strict phrasing rules (prohibits "You don't know X" or "Mandatory for role")
 */

import { extractSkillsFromJd } from './jdNormalizer.js'

export const FORBIDDEN_MARKET_PHRASES = [
  /you don't know/i,
  /you do not know/i,
  /mandatory for this role/i,
  /you will be rejected/i,
  /will increase your (?:interview )?chances by/i,
  /you lack/i,
]

/**
 * Validates that finding text does not violate Section 33 market language rules.
 * @param {string} text
 * @returns {boolean}
 */
export function isMarketLanguageSafe(text) {
  if (!text || typeof text !== 'string') return true
  return !FORBIDDEN_MARKET_PHRASES.some((regex) => regex.test(text))
}

/**
 * Validates text against market language rules, returning detailed violation report.
 * @param {string} text
 * @returns {{ isValid: boolean, violations: string[] }}
 */
export function validateMarketLanguage(text) {
  if (!text || typeof text !== 'string') return { isValid: true, violations: [] }
  const violations = []
  for (const regex of FORBIDDEN_MARKET_PHRASES) {
    const match = text.match(regex)
    if (match) {
      violations.push(`Forbidden phrase detected: "${match[0]}"`)
    }
  }
  return {
    isValid: violations.length === 0,
    violations,
  }
}

/**
 * Helper to build market context report structure.
 */
export function buildMarketContextReport({
  bucketKey = '',
  marketVersion = 1,
  evidenceAnalysis = {},
}) {
  return {
    bucketKey,
    marketVersion,
    targetAlignment: evidenceAnalysis.targetAlignment || [],
    marketEvidenceGaps: (evidenceAnalysis.marketEvidenceGaps || []).map((gap) => ({
      ...gap,
      observation: gap.message || `${gap.skill} appears in sampled roles but resume lacks clear evidence.`,
    })),
    marketStrengths: evidenceAnalysis.marketStrengths || [],
    marketSampleSize: evidenceAnalysis.marketSampleSize || 5,
  }
}

/**
 * Computes comparative market evidence and target JD alignment.
 *
 * @param {Object} params
 * @param {Object} [params.canonicalResume]
 * @param {Object} [params.resumeFacts]
 * @param {string} [params.targetJobDescription]
 * @param {string} [params.targetJdText]
 * @param {Object} [params.marketProfile]
 * @returns {Object} Structured market evidence comparison
 */
export function evaluateMarketEvidence(params = {}) {
  const {
    canonicalResume,
    resumeFacts,
    targetJobDescription = params.targetJdText || '',
    marketProfile = null,
  } = params

  // 1. Collect all skills evidenced in candidate resume
  const candidateSkills = new Set()
  const candidateSkillTexts = []

  // From skills section
  for (const s of canonicalResume?.skills || []) {
    if (s.name) {
      candidateSkills.add(s.name.toLowerCase().trim())
      candidateSkillTexts.push(s.name)
    }
  }

  // From resumeFacts if provided
  if (resumeFacts && Array.isArray(resumeFacts.skills)) {
    for (const s of resumeFacts.skills) {
      if (typeof s === 'string') {
        candidateSkills.add(s.toLowerCase().trim())
        candidateSkillTexts.push(s)
      }
    }
  }
  if (resumeFacts && Array.isArray(resumeFacts.technologies)) {
    for (const t of resumeFacts.technologies) {
      if (typeof t === 'string') {
        candidateSkills.add(t.toLowerCase().trim())
      }
    }
  }

  // From experience & project bullets
  const allBullets = [
    ...(canonicalResume?.experience || []).flatMap((e) => e.bullets || []),
    ...(canonicalResume?.projects || []).flatMap((p) => p.bullets || []),
    ...(resumeFacts?.bullets || []),
  ]

  const fullBulletText = allBullets.map((b) => b.text || '').join(' ').toLowerCase()

  const hasResumeEvidence = (skillName) => {
    const lower = skillName.toLowerCase().trim()
    if (candidateSkills.has(lower)) return true
    const wordRegex = new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    return wordRegex.test(fullBulletText)
  }

  // 2. Extract Target JD Requirements (Priority 1)
  const targetJdSkills = targetJobDescription
    ? extractSkillsFromJd(targetJobDescription)
    : []

  const targetAlignment = []
  targetJdSkills.forEach((skill) => {
    const evidenced = hasResumeEvidence(skill)
    targetAlignment.push({
      skill,
      status: evidenced ? 'evidenced' : 'unverified_in_resume',
      source: 'target_jd',
      message: evidenced
        ? `Explicitly requested by your target JD and demonstrated in your resume.`
        : `Explicitly requested by your target JD, but your current resume does not provide clear direct evidence.`,
    })
  })

  // 3. Market Context & Evidence Gaps (Priority 2 / Contextual)
  const marketEvidenceGaps = []
  const marketStrengths = []
  const sampleSize = marketProfile?.sampleSize || 15

  if (marketProfile && Array.isArray(marketProfile.skills)) {
    for (const item of marketProfile.skills) {
      const skillName = item.name
      const frequency = item.frequency
      const frequencyRatio = item.frequencyRatio
      const evidenced = hasResumeEvidence(skillName)

      // High market frequency skill: appears in >= 35% of sampled JDs (or >= 3 if small sample)
      const minThreshold = sampleSize >= 10 ? Math.ceil(sampleSize * 0.35) : 3
      if (frequency >= minThreshold) {
        if (evidenced) {
          marketStrengths.push({
            skill: skillName,
            marketFrequency: frequencyRatio,
            sampleSize,
            message: `${skillName} is demonstrated on your resume and appeared in ${frequency}/${sampleSize} sampled market JDs for this role.`,
          })
        } else {
          // Check if already covered under target JD alignment
          const coveredByTargetJd = targetAlignment.some(
            (t) => t.skill.toLowerCase() === skillName.toLowerCase()
          )

          marketEvidenceGaps.push({
            type: 'market_evidence_gap',
            skill: skillName,
            marketFrequency: frequencyRatio,
            frequencyCount: frequency,
            sampleSize,
            resumeEvidence: 'none_found',
            coveredByTargetJd,
            targetJdRequested: coveredByTargetJd,
            confidence: 'high',
            message: `${skillName} appeared in ${frequency} of ${sampleSize} sampled roles at this experience level, but your current resume does not provide clear direct evidence.`,
          })
        }
      }
    }
  }

  return {
    targetAlignment,
    marketEvidenceGaps: marketEvidenceGaps.slice(0, 10),
    marketStrengths: marketStrengths.slice(0, 10),
    marketSampleSize: sampleSize,
    targetJdCovered: targetJdSkills.length > 0,
  }
}

export const analyzeMarketEvidence = evaluateMarketEvidence

export default {
  evaluateMarketEvidence,
  analyzeMarketEvidence,
  buildMarketContextReport,
  isMarketLanguageSafe,
  validateMarketLanguage,
  FORBIDDEN_MARKET_PHRASES,
}
