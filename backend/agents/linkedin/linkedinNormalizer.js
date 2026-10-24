/**
 * LinkedIn Profile Normalizer
 *
 * Ingests raw scraped LinkedIn data (Apify scraper, JSON uploads, manual payloads)
 * and normalizes it into a standardized, sanitized Canonical LinkedIn Profile.
 *
 * 100% deterministic, zero LLM calls.
 */

const NOT_SPECIFIED = /^(?:not\s*specified|n\/?a|none|null|undefined|unknown|\s*)$/i

/**
 * Strips HTML tags, decodes common entities, and trims whitespace.
 *
 * @param {any} val
 * @returns {string} Sanitized string or empty string
 */
export function sanitizeText(val) {
  if (val === null || val === undefined) return ''
  let str = String(val)
  // Strip basic HTML tags
  str = str.replace(/<[^>]*>/g, ' ')
  // Replace HTML entities
  str = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  // Collapse whitespace
  str = str.replace(/[ \t]+/g, ' ').trim()
  return NOT_SPECIFIED.test(str) ? '' : str
}

/**
 * Extracts a numeric count from number or string (e.g. "500+", "150 connections", 3).
 *
 * @param {any} val
 * @returns {number|null}
 */
export function parseCount(val) {
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.max(0, Math.round(val))
  if (Array.isArray(val)) return val.length
  if (typeof val === 'string') {
    const clean = val.replace(/,/g, '').trim()
    const match = clean.match(/(\d+)/)
    if (match) return parseInt(match[1], 10)
  }
  return null
}

/**
 * Normalizes a single experience record.
 *
 * @param {Object} exp
 * @returns {Object|null}
 */
function normalizeExperience(exp) {
  if (!exp || typeof exp !== 'object') return null

  const title = sanitizeText(exp.title || exp.role || exp.position)
  const company = sanitizeText(exp.company || exp.companyName || exp.organization)
  if (!title && !company) return null

  const dates = sanitizeText(
    exp.dates ||
    exp.dateRange ||
    exp.timePeriod ||
    [exp.startDate, exp.endDate || (exp.isCurrent ? 'Present' : '')].filter(Boolean).join(' – ')
  )

  const description = sanitizeText(exp.description || exp.summary || exp.details)
  const location = sanitizeText(exp.location || exp.geo)

  return {
    title: title || 'Role Not Specified',
    company: company || 'Company Not Specified',
    dates,
    description,
    location,
    isCurrent: Boolean(exp.isCurrent || /present|current/i.test(dates)),
  }
}

/**
 * Normalizes a single education record.
 *
 * @param {Object} edu
 * @returns {Object|null}
 */
function normalizeEducation(edu) {
  if (!edu || typeof edu !== 'object') return null

  const school = sanitizeText(edu.school || edu.schoolName || edu.institution || edu.university)
  const degree = sanitizeText(edu.degree || edu.degreeName || edu.qualification)
  const fieldOfStudy = sanitizeText(edu.fieldOfStudy || edu.major || edu.field)
  if (!school && !degree) return null

  const dates = sanitizeText(
    edu.dates ||
    edu.dateRange ||
    [edu.startDate, edu.endDate].filter(Boolean).join(' – ')
  )

  return {
    school: school || 'Institution Not Specified',
    degree,
    fieldOfStudy,
    dates,
  }
}

/**
 * Normalizes a single certification record.
 *
 * @param {Object} cert
 * @returns {Object|null}
 */
function normalizeCertification(cert) {
  if (!cert || typeof cert !== 'object') return null
  const name = sanitizeText(cert.name || cert.title)
  if (!name) return null
  const issuer = sanitizeText(cert.issuer || cert.organization || cert.authority)
  const issueDate = sanitizeText(cert.issueDate || cert.date || cert.year)
  const url = sanitizeText(cert.url || cert.licenseUrl)
  return { name, issuer, issueDate, url }
}

/**
 * Normalizes a single project record.
 *
 * @param {Object} proj
 * @returns {Object|null}
 */
function normalizeProject(proj) {
  if (!proj || typeof proj !== 'object') return null
  const title = sanitizeText(proj.title || proj.name)
  if (!title) return null
  const description = sanitizeText(proj.description || proj.summary)
  const url = sanitizeText(proj.url || proj.link)
  const dates = sanitizeText(proj.dates || proj.dateRange)
  return { title, description, url, dates }
}

/**
 * Normalizes skills input (supports string array, object array, comma-separated string).
 *
 * @param {any} skillsInput
 * @returns {string[]} Deduplicated, sanitized skills list
 */
export function normalizeSkills(skillsInput) {
  const list = []
  if (Array.isArray(skillsInput)) {
    for (const item of skillsInput) {
      if (typeof item === 'string') {
        const split = item.split(/[,;\n]/)
        for (const s of split) {
          const cleaned = sanitizeText(s)
          if (cleaned) list.push(cleaned)
        }
      } else if (item && typeof item === 'object') {
        const cleaned = sanitizeText(item.name || item.skill || item.title)
        if (cleaned) {
          const split = cleaned.split(/[,;\n]/)
          for (const s of split) {
            const sc = sanitizeText(s)
            if (sc) list.push(sc)
          }
        }
      }
    }
  } else if (typeof skillsInput === 'string') {
    const split = skillsInput.split(/[,;\n]/)
    for (const s of split) {
      const cleaned = sanitizeText(s)
      if (cleaned) list.push(cleaned)
    }
  }

  // Deduplicate case-insensitively while preserving original capitalization
  const seen = new Set()
  const result = []
  for (const s of list) {
    const lower = s.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      result.push(s)
    }
  }
  return result
}

/**
 * Canonical LinkedIn Profile Normalizer
 *
 * @param {Object} rawProfile - Scraped LinkedIn profile data from Apify, API, or manual JSON
 * @returns {Object} Canonical, sanitized LinkedIn profile
 */
export function normalizeLinkedInProfile(rawProfile = {}) {
  if (!rawProfile || typeof rawProfile !== 'object') {
    return {
      fullName: '',
      headline: '',
      about: '',
      pictureUrl: '',
      bannerUrl: '',
      hasPicture: false,
      hasBanner: false,
      experiences: [],
      education: [],
      certifications: [],
      projects: [],
      skills: [],
      connectionsCount: null,
      recommendationsCount: null,
      url: '',
      hasCustomUrl: false,
      isValid: false,
    }
  }

  const fullName = sanitizeText(rawProfile.fullName || rawProfile.name)
  const headline = sanitizeText(rawProfile.headline || rawProfile.title)
  const about = sanitizeText(rawProfile.about || rawProfile.summary || rawProfile.bio)

  // Experiences
  const rawExperiences = Array.isArray(rawProfile.experiences)
    ? rawProfile.experiences
    : Array.isArray(rawProfile.experience)
    ? rawProfile.experience
    : Array.isArray(rawProfile.positions)
    ? rawProfile.positions
    : []
  const experiences = rawExperiences.map(normalizeExperience).filter(Boolean)

  // Education
  const rawEducation = Array.isArray(rawProfile.education)
    ? rawProfile.education
    : Array.isArray(rawProfile.educations)
    ? rawProfile.educations
    : []
  const education = rawEducation.map(normalizeEducation).filter(Boolean)

  // Certifications
  const rawCertifications = Array.isArray(rawProfile.certifications)
    ? rawProfile.certifications
    : Array.isArray(rawProfile.licensesAndCertifications)
    ? rawProfile.licensesAndCertifications
    : Array.isArray(rawProfile.licenses)
    ? rawProfile.licenses
    : []
  const certifications = rawCertifications.map(normalizeCertification).filter(Boolean)

  // Projects
  const rawProjects = Array.isArray(rawProfile.projects)
    ? rawProfile.projects
    : Array.isArray(rawProfile.featuredProjects)
    ? rawProfile.featuredProjects
    : Array.isArray(rawProfile.portfolio)
    ? rawProfile.portfolio
    : []
  const projects = rawProjects.map(normalizeProject).filter(Boolean)

  // Skills
  const skills = normalizeSkills(rawProfile.skills || rawProfile.skillsList)

  // Visual Branding
  const rawPicture = sanitizeText(
    rawProfile.pictureUrl || rawProfile.profilePicture || rawProfile.avatar || rawProfile.photoUrl || ''
  )
  const pictureUrl = rawPicture.startsWith('http') ? rawPicture : ''
  const isGhostPicture = !pictureUrl || /ghost_person|ghost-person|default-avatar|no-photo|camera\.png/i.test(pictureUrl)
  const hasPicture = typeof rawProfile.hasPicture === 'boolean'
    ? rawProfile.hasPicture
    : (!isGhostPicture && Boolean(pictureUrl))

  const rawBanner = sanitizeText(
    rawProfile.bannerUrl || rawProfile.coverUrl || rawProfile.backgroundUrl || rawProfile.coverPicture || rawProfile.backgroundPicture || ''
  )
  const bannerUrl = rawBanner.startsWith('http') ? rawBanner : ''
  const isDefaultBanner = !bannerUrl || /default-banner|banner-default|default_banner/i.test(bannerUrl)
  const hasBanner = typeof rawProfile.hasBanner === 'boolean'
    ? rawProfile.hasBanner
    : (!isDefaultBanner && Boolean(bannerUrl))

  // Visibility / Social Proof
  const connectionsCount = parseCount(
    rawProfile.connectionsCount ?? rawProfile.connections ?? rawProfile.connectionCount
  )
  const recommendationsCount = parseCount(
    rawProfile.recommendationsCount ?? rawProfile.recommendations ?? rawProfile.recommendationCount
  )

  const rawUrl = sanitizeText(rawProfile.url || rawProfile.profileUrl || rawProfile.publicIdentifier)
  const url = rawUrl.startsWith('http')
    ? rawUrl
    : rawUrl
    ? `https://www.linkedin.com/in/${rawUrl.replace(/^\/+/, '')}`
    : ''
  const hasCustomUrl =
    /linkedin\.com\/in\/[^/]+/i.test(url) && !/pub-|ACoAA/i.test(url)

  const isValid = Boolean(fullName || headline || experiences.length > 0)

  return {
    fullName,
    headline,
    about,
    pictureUrl,
    bannerUrl,
    hasPicture,
    hasBanner,
    experiences,
    education,
    certifications,
    projects,
    skills,
    connectionsCount,
    recommendationsCount,
    url,
    hasCustomUrl,
    isValid,
  }
}

export default {
  normalizeLinkedInProfile,
  sanitizeText,
  parseCount,
  normalizeSkills,
}
