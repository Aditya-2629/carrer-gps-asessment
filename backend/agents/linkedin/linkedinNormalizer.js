/**
 * LinkedIn Profile Normalizer
 *
 * Ingests raw scraped LinkedIn data (Apify scraper, JSON uploads, manual payloads)
 * and normalizes it into a standardized, sanitized Canonical LinkedIn Profile.
 *
 * 100% deterministic, zero LLM calls.
 */

const NOT_SPECIFIED = /^(?:not\s*specified|n\/?a|none|null|undefined|unknown|\s*)$/i

export function extractImageUrl(val) {
  if (!val) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'object') {
    if (typeof val.url === 'string') return val.url.trim()
    if (Array.isArray(val.sizes) && val.sizes.length > 0) {
      const largest = val.sizes[val.sizes.length - 1]
      if (typeof largest?.url === 'string') return largest.url.trim()
    }
  }
  return ''
}

/**
 * Strips HTML tags, decodes common entities, and trims whitespace.
 * Never outputs "[object Object]".
 *
 * @param {any} val
 * @returns {string} Sanitized string or empty string
 */
export function sanitizeText(val) {
  if (val === null || val === undefined) return ''
  let str = ''
  if (typeof val === 'object') {
    str = val.url || val.parsed?.text || val.linkedinText || val.text || val.name || ''
  } else {
    str = String(val)
  }
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

  const title = sanitizeText(exp.position || exp.title || exp.role)
  const company = sanitizeText(exp.companyName || exp.company || exp.organization)
  if (!title && !company) return null

  const formattedDateRange = [
    exp.startDate?.text || (exp.startDate?.year ? `${exp.startDate.month ? exp.startDate.month + '/' : ''}${exp.startDate.year}` : exp.startDate),
    exp.endDate?.text || (exp.endDate?.year ? `${exp.endDate.month ? exp.endDate.month + '/' : ''}${exp.endDate.year}` : (exp.isCurrent ? 'Present' : exp.endDate)),
  ]
    .filter(Boolean)
    .join(' – ')

  const dates = sanitizeText(
    exp.duration ||
    exp.dateRange ||
    exp.dates ||
    exp.timePeriod ||
    formattedDateRange
  )

  const description = sanitizeText(exp.description || exp.summary || exp.details)
  const location = sanitizeText(exp.location?.parsed?.text || exp.location?.linkedinText || exp.location || exp.geo)
  const companyLogo = exp.companyLogo === null ? null : (extractImageUrl(exp.companyLogo) || null)

  return {
    title: title || 'Role Not Specified',
    company: company || 'Company Not Specified',
    companyLogo,
    companyId: exp.companyId || exp.companyLinkedinUrl || null,
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

  const school = sanitizeText(edu.schoolName || edu.school || edu.institution || edu.university)
  const degree = sanitizeText(edu.degree || edu.degreeName || edu.qualification)
  const fieldOfStudy = sanitizeText(edu.fieldOfStudy || edu.major || edu.field) || null
  if (!school && !degree) return null

  const dates = sanitizeText(
    edu.period ||
    edu.dateRange ||
    edu.dates ||
    [
      edu.startDate?.text || (edu.startDate?.year ? String(edu.startDate.year) : edu.startDate),
      edu.endDate?.text || (edu.endDate?.year ? String(edu.endDate.year) : edu.endDate),
    ]
      .filter(Boolean)
      .join(' – ')
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
  const name = sanitizeText(cert.title || cert.name)
  if (!name) return null
  const issuer = sanitizeText(cert.issuedBy || cert.issuer || cert.organization || cert.authority) || 'N/A'
  const issueDate = sanitizeText(cert.issuedAt || cert.issueDate || cert.date || cert.year)
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
  const dates = sanitizeText(
    proj.dates ||
    proj.dateRange ||
    [proj.startDate?.text || proj.startDate, proj.endDate?.text || proj.endDate].filter(Boolean).join(' – ')
  )
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
      location: 'Not Specified',
      pictureUrl: '',
      bannerUrl: '',
      hasPicture: false,
      hasBanner: false,
      experiences: [],
      education: [],
      certifications: [],
      projects: [],
      skills: [],
      topSkills: [],
      sectionTotals: null,
      featured: [],
      connectionsCount: null,
      recommendationsCount: null,
      url: '',
      hasCustomUrl: false,
      isValid: false,
    }
  }

  const fullName = sanitizeText(
    rawProfile.fullName ||
    rawProfile.name ||
    [rawProfile.firstName, rawProfile.lastName].filter(Boolean).join(' ')
  )
  const headline = sanitizeText(rawProfile.headline || rawProfile.title)
  const about = sanitizeText(rawProfile.about || rawProfile.summary || rawProfile.bio)
  const location =
    sanitizeText(
      rawProfile.location?.parsed?.text ||
      rawProfile.location?.linkedinText ||
      rawProfile.location?.text ||
      rawProfile.location?.name ||
      rawProfile.location
    ) || 'Not Specified'

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

  // Skills (preserve all up to 100)
  const skills = normalizeSkills(rawProfile.skills || rawProfile.skillsList).slice(0, 100)

  // Top Skills
  const topSkills = Array.isArray(rawProfile.topSkills)
    ? rawProfile.topSkills.map((s) => typeof s === 'string' ? s : s?.name).filter(Boolean)
    : typeof rawProfile.topSkills === 'string'
    ? rawProfile.topSkills.split(/\s*[•·|,]\s*/).filter(Boolean)
    : []

  const sectionTotals = rawProfile.sectionTotals || null
  const featured = Array.isArray(rawProfile.featured?.slides)
    ? rawProfile.featured.slides
    : Array.isArray(rawProfile.featured)
    ? rawProfile.featured
    : []

  // Visual Branding
  const pictureUrl = extractImageUrl(
    rawProfile.pictureUrl || rawProfile.profilePicture || rawProfile.avatar || rawProfile.photoUrl || rawProfile.displayPictureUrl || ''
  )
  const isGhostPicture = !pictureUrl || /ghost_person|ghost-person|default-avatar|no-photo|camera\.png/i.test(pictureUrl)
  const hasPicture = typeof rawProfile.hasPicture === 'boolean'
    ? rawProfile.hasPicture
    : (!isGhostPicture && Boolean(pictureUrl))

  const bannerUrl = extractImageUrl(
    rawProfile.bannerUrl || rawProfile.coverUrl || rawProfile.backgroundUrl || rawProfile.coverPicture || rawProfile.backgroundPicture || rawProfile.banner || ''
  )
  const isDefaultBanner = !bannerUrl || /default-banner|banner-default|default_banner/i.test(bannerUrl)
  const hasBanner = typeof rawProfile.hasBanner === 'boolean'
    ? rawProfile.hasBanner
    : (!isDefaultBanner && Boolean(bannerUrl))

  // Visibility / Social Proof
  const connectionsCount = parseCount(
    rawProfile.connectionsCount ?? rawProfile.connections ?? rawProfile.connectionCount
  )
  const recommendationsCount = parseCount(
    rawProfile.recommendationsCount ?? rawProfile.recommendations ?? rawProfile.recommendationCount ?? rawProfile.receivedRecommendations
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
    location,
    pictureUrl,
    bannerUrl,
    hasPicture,
    hasBanner,
    experiences,
    education,
    certifications,
    projects,
    skills,
    topSkills,
    sectionTotals,
    featured,
    connectionsCount,
    recommendationsCount,
    url,
    hasCustomUrl,
    isValid,
    inferredFromResume: Boolean(rawProfile.inferredFromResume),
    apifyQuotaFallback: Boolean(rawProfile.apifyQuotaFallback),
    profileSource: rawProfile.profileSource || (rawProfile.inferredFromResume ? 'resume_inferred' : 'scraped'),
  }
}

export default {
  normalizeLinkedInProfile,
  sanitizeText,
  parseCount,
  normalizeSkills,
}
