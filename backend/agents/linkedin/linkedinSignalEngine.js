/**
 * LinkedIn Signal Engine — Deterministic Pre-Audit Signals
 *
 * Computes deterministic SEO and profile health signals:
 * 1. Headline strength (word count, role presence, separator formatting)
 * 2. About section depth (char count, paragraph count, presence of hard metrics /\d/)
 * 3. Social proof brackets (connections: <200, 200-500, 500+; recommendations count)
 * 4. Custom vanity URL check
 *
 * 100% deterministic, 0 LLM calls, runs in < 2ms.
 */

import { normalizeLinkedInProfile } from './linkedinNormalizer.js'

/**
 * Computes deterministic SEO and profile health signals from a LinkedIn profile.
 *
 * @param {Object} rawOrNormalizedProfile - raw scraped data or pre-normalized profile
 * @param {Object} [resumeContext] - optional resume facts/targetRole
 * @returns {Object} Deterministic profile signals
 */
export function extractLinkedInSignals(rawOrNormalizedProfile = {}, resumeContext = {}) {
  const profile = rawOrNormalizedProfile?.isValid !== undefined
    ? rawOrNormalizedProfile
    : normalizeLinkedInProfile(rawOrNormalizedProfile)

  const headline = profile.headline || ''
  const about = profile.about || ''
  const experiences = profile.experiences || []
  const education = profile.education || []
  const skills = profile.skills || []

  const connections = profile.connectionsCount
  const recommendations = profile.recommendationsCount
  const hasCustomUrl = profile.hasCustomUrl

  // ── 1. Headline Strength Signals ──────────────────────────────────────────
  const headlineWords = headline ? headline.split(/\s+/).filter(Boolean) : []
  const headlineLength = headline.length
  const headlineWordCount = headlineWords.length
  const isHeadlineMissing = headlineWordCount === 0
  const isHeadlineTooShort = !isHeadlineMissing && headlineWordCount < 5
  const isHeadlineTooLong = headlineLength > 220

  // Separator formatting: '|', '•', '/', '—', '-'
  const hasStructuredSeparators = /[|•/—–]/.test(headline)
  const separatorCount = (headline.match(/[|•/—–]/g) || []).length

  // Target role / role presence check
  const targetRole = (
    resumeContext?.targetRole ||
    resumeContext?.canonicalResume?.candidate?.targetRole ||
    ''
  ).trim()

  let targetRoleKeywordsMatched = 0
  let targetRoleMatches = false
  if (targetRole && !isHeadlineMissing) {
    const roleTokens = targetRole.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const hlLower = headline.toLowerCase()
    targetRoleKeywordsMatched = roleTokens.filter((token) => hlLower.includes(token)).length
    targetRoleMatches = roleTokens.length > 0 && targetRoleKeywordsMatched > 0
  }

  // General professional role keyword presence
  const COMMON_ROLES = [
    'engineer', 'developer', 'architect', 'lead', 'manager', 'director',
    'specialist', 'consultant', 'analyst', 'scientist', 'designer', 'head', 'vp',
  ]
  const hasProfessionalRoleTitle = COMMON_ROLES.some((r) => headline.toLowerCase().includes(r))

  // ── 2. About Section Depth Signals ────────────────────────────────────────
  const aboutLength = about.length
  const isAboutMissing = aboutLength === 0
  const isAboutThin = !isAboutMissing && aboutLength < 200
  const isAboutOptimal = aboutLength >= 800 && aboutLength <= 2600
  const hasAboutMetrics = /\d/.test(about)
  const aboutParagraphs = about ? about.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length : 0

  // ── 3. Social Proof Brackets ──────────────────────────────────────────────
  let connectionBracket = 'unknown'
  if (connections !== null) {
    if (connections >= 500) connectionBracket = '500+'
    else if (connections >= 200) connectionBracket = '200-500'
    else connectionBracket = '<200'
  }

  // ── 4. Completeness & Experience Signals ──────────────────────────────────
  const expWithDescription = experiences.filter(
    (e) => e.description && e.description.length > 60
  ).length

  return {
    headline: {
      text: headline,
      length: headlineLength,
      wordCount: headlineWordCount,
      isMissing: isHeadlineMissing,
      isTooShort: isHeadlineTooShort,
      isTooLong: isHeadlineTooLong,
      hasStructuredSeparators,
      separatorCount,
      targetRoleMatches,
      targetRoleKeywordsMatched,
      hasProfessionalRoleTitle,
    },
    about: {
      text: about,
      charCount: aboutLength,
      length: aboutLength,
      isMissing: isAboutMissing,
      isThin: isAboutThin,
      isOptimal: isAboutOptimal,
      hasMetrics: hasAboutMetrics,
      paragraphCount: aboutParagraphs,
    },
    visibility: {
      connectionsCount: connections,
      connectionBracket,
      recommendationsCount: recommendations,
      hasRecommendations: recommendations !== null && recommendations > 0,
      profileUrl: profile.url,
      hasCustomUrl,
    },
    completeness: {
      experienceCount: experiences.length,
      expWithDescription,
      hasExperiences: experiences.length > 0,
      educationCount: education.length,
      hasEducation: education.length > 0,
      skillsCount: skills.length,
      skills,
    },
    raw: {
      experiences,
      education,
    },
  }
}

export default { extractLinkedInSignals }
