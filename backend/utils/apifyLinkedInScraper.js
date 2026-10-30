import { ApifyClient } from 'apify-client'
import { apifyKeyPool } from './smartKeyPool.js'

/**
 * Scrapes a complete LinkedIn profile using Apify's cookieless actor:
 * Default: "BHzefUZlZRKWxkTck" (configurable via APIFY_LINKEDIN_ACTOR_ID)
 * 
 * Behavior:
 * - If APIFY_API_TOKEN is not set in backend/.env, logs a warning and skips LinkedIn scraping safely.
 * - If APIFY_API_TOKEN is set, strictly validates the URL and executes live Apify scraping.
 * - Throws an error if the user's provided LinkedIn URL is invalid or scraping fails.
 * 
 * @param {string} linkedinUrl - Candidate's public LinkedIn profile URL
 * @returns {Promise<Object|null>} Structured LinkedIn profile JSON object or null if token not configured
 */
export const extractImageUrl = (val) => {
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
 * Pure mapper converting raw Apify profile (including harvestapi/linkedin-profile-scraper schema)
 * into a standardized Canonical LinkedIn Profile object.
 */
export function mapApifyProfileToCanonical(profile = {}, formattedUrl = '', actorId = 'harvestapi/linkedin-profile-scraper') {
  const fullName =
    profile.fullName ||
    profile.name ||
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
    'Not Specified'

  const rawPicture =
    profile.pictureUrl ||
    profile.profilePicture ||
    profile.avatar ||
    profile.photoUrl ||
    profile.displayPictureUrl ||
    ''
  const pictureUrl = extractImageUrl(rawPicture)
  const hasPicture = Boolean(pictureUrl && !/ghost|default|placeholder|camera\.png/i.test(pictureUrl))

  const rawBanner =
    profile.bannerUrl ||
    profile.coverUrl ||
    profile.backgroundUrl ||
    profile.coverPicture ||
    profile.backgroundPicture ||
    profile.banner ||
    ''
  const bannerUrl = extractImageUrl(rawBanner)
  const isDefaultBanner = !bannerUrl || /default-banner|banner-default|default_banner/i.test(bannerUrl)
  const hasBanner = !isDefaultBanner && bannerUrl.length > 0

  const location =
    typeof profile.location === 'string'
      ? profile.location
      : profile.location?.parsed?.text ||
        profile.location?.linkedinText ||
        profile.location?.text ||
        profile.location?.name ||
        'Not Specified'

  const rawExperiences =
    profile.experience ||
    profile.experiences ||
    profile.positions ||
    []

  const experiences = rawExperiences.map((exp) => {
    const formattedDateRange = [
      exp.startDate?.text || (exp.startDate?.year ? `${exp.startDate.month ? exp.startDate.month + '/' : ''}${exp.startDate.year}` : exp.startDate),
      exp.endDate?.text || (exp.endDate?.year ? `${exp.endDate.month ? exp.endDate.month + '/' : ''}${exp.endDate.year}` : (exp.isCurrent ? 'Present' : exp.endDate)),
    ]
      .filter(Boolean)
      .join(' – ')

    return {
      title: exp.position || exp.title || exp.role || 'N/A',
      company: exp.companyName || exp.company || 'N/A',
      companyLogo: exp.companyLogo === null ? null : (extractImageUrl(exp.companyLogo) || null),
      companyId: exp.companyId || exp.companyLinkedinUrl || null,
      duration: exp.duration || exp.dateRange || formattedDateRange || 'N/A',
      startDate: exp.startDate?.text || (exp.startDate?.year ? `${exp.startDate.month ? exp.startDate.month + '/' : ''}${exp.startDate.year}` : (typeof exp.startDate === 'string' ? exp.startDate : null)),
      endDate: exp.endDate?.text || (exp.endDate?.year ? `${exp.endDate.month ? exp.endDate.month + '/' : ''}${exp.endDate.year}` : (typeof exp.endDate === 'string' ? exp.endDate : null)),
      location: typeof exp.location === 'string' ? exp.location : (exp.location?.parsed?.text || exp.location?.linkedinText || ''),
      description: exp.description || '',
    }
  })

  const rawEducation = profile.education || profile.educations || []
  const education = rawEducation.map((edu) => {
    const dates =
      edu.period ||
      edu.dateRange ||
      [
        edu.startDate?.text || (edu.startDate?.year ? String(edu.startDate.year) : edu.startDate),
        edu.endDate?.text || (edu.endDate?.year ? String(edu.endDate.year) : edu.endDate),
      ]
        .filter(Boolean)
        .join(' – ')

    return {
      school: edu.schoolName || edu.school || edu.institution || edu.university || 'N/A',
      degree: edu.degree || edu.degreeName || edu.qualification || '',
      fieldOfStudy: edu.fieldOfStudy || edu.major || null,
      dates,
    }
  })

  const rawCerts = Array.isArray(profile.certifications)
    ? profile.certifications
    : Array.isArray(profile.licensesAndCertifications)
    ? profile.licensesAndCertifications
    : Array.isArray(profile.licenses)
    ? profile.licenses
    : []

  const certifications = rawCerts.map((c) => ({
    name: c.title || c.name || 'Certification',
    issuer: c.issuedBy || c.issuer || c.organization || c.authority || 'N/A',
    issueDate: c.issuedAt || c.issueDate || c.date || c.year || '',
    url: c.url || c.licenseUrl || '',
  }))

  const rawProjects = Array.isArray(profile.projects)
    ? profile.projects
    : Array.isArray(profile.featuredProjects)
    ? profile.featuredProjects
    : Array.isArray(profile.portfolio)
    ? profile.portfolio
    : []

  const projects = rawProjects.map((p) => {
    const dates =
      p.dates ||
      p.dateRange ||
      [p.startDate?.text || p.startDate, p.endDate?.text || p.endDate].filter(Boolean).join(' – ')

    return {
      title: p.title || p.name || 'Project',
      description: p.description || p.summary || '',
      url: p.url || p.link || '',
      dates,
    }
  })

  const topSkills = Array.isArray(profile.topSkills)
    ? profile.topSkills.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
    : typeof profile.topSkills === 'string'
    ? profile.topSkills.split(/\s*[•·|,]\s*/).filter(Boolean)
    : []

  const skills = (profile.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
    .slice(0, 100)

  const sectionTotals = profile.sectionTotals || null
  const featured = Array.isArray(profile.featured?.slides)
    ? profile.featured.slides
    : Array.isArray(profile.featured)
    ? profile.featured
    : []

  const recommendationsCount =
    profile.receivedRecommendations ??
    profile.recommendationsCount ??
    (Array.isArray(profile.recommendations) ? profile.recommendations.length : 0)

  return {
    scraped_via: actorId,
    url: formattedUrl || profile.url || '',
    fullName,
    headline: profile.headline || 'Not Specified',
    about: profile.about || profile.summary || 'Not Specified',
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
    connectionsCount: profile.connectionsCount || profile.connections || 'N/A',
    recommendationsCount,
  }
}

/**
 * Helper to collect and deduplicate all configured Apify tokens
 * from comma-separated list or numbered env variables.
 */
export function getApifyTokens() {
  return apifyKeyPool.getAllKeys()
}

/**
 * Scrapes a complete LinkedIn profile using Apify's cookieless actor:
 * Default: "harvestapi/linkedin-profile-scraper" (configurable via APIFY_LINKEDIN_ACTOR_ID)
 *
 * Automatically rotates across available Apify tokens on failure or 50-run limits via SmartKeyPool.
 * If all tokens fail or quota is reached, gracefully returns null so linkedinAgent
 * falls back to Resume-Bridged LLM synthesis instead of crashing.
 */
export const scrapeLinkedInProfile = async (linkedinUrl, options = {}) => {
  if (!linkedinUrl || typeof linkedinUrl !== 'string' || !linkedinUrl.trim()) {
    return null
  }

  let formattedUrl = linkedinUrl.trim()

  // Ensure URL starts with https://
  if (!formattedUrl.startsWith('https://')) {
    if (formattedUrl.startsWith('http://')) {
      formattedUrl = formattedUrl.replace(/^http:\/\//i, 'https://')
    } else {
      formattedUrl = `https://${formattedUrl}`
    }
  }

  // LinkedIn URL format validation (must start with https:// and match profile pattern)
  const linkedinRegex = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w\-%.]+\/?$/i
  if (!linkedinRegex.test(formattedUrl)) {
    throw new Error('Invalid LinkedIn URL format. Must be a valid profile link (e.g. https://www.linkedin.com/in/username).')
  }

  if (apifyKeyPool.getKeyCount() === 0) {
    console.warn('[Apify Warning] No APIFY_API_TOKEN or APIFY_API_TOKENS configured in backend/.env. Skipping live LinkedIn profile scraping.')
    return null
  }

  const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || 'harvestapi/linkedin-profile-scraper'
  const maxItemsLimit = Number(process.env.APIFY_LINKEDIN_MAX_ITEMS) || 100

  try {
    return await apifyKeyPool.executeWithRetry(
      async (activeToken) => {
        const tokenMask = activeToken.length > 8 ? `${activeToken.slice(0, 4)}...${activeToken.slice(-4)}` : 'token'
        const client = new ApifyClient({ token: activeToken })

        // Execute Apify actor with token, item, row, and memory limits
        const run = await client.actor(actorId).call(
          {
            urls: [formattedUrl],
            profileUrls: [formattedUrl],
            rows: maxItemsLimit,
            maxRowsPerUrl: maxItemsLimit,
            maxRows: maxItemsLimit,
            maxItems: maxItemsLimit,
            limit: maxItemsLimit,
            maxSkills: 100,
            maxProfiles: 1,
            companyProfile: false, // Disables company sub-crawls!
            enrichCompany: false,
            scrapeCompanyDetails: false,
          },
          {
            maxItems: maxItemsLimit,
            waitSecs: 90,
          }
        )

        // Retrieve items from dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
          limit: maxItemsLimit,
        })

        if (!items || items.length === 0) {
          throw new Error('Empty dataset returned from Apify actor run.')
        }

        const firstItem = items[0]
        const itemStr = typeof firstItem === 'string' ? firstItem : JSON.stringify(firstItem || {})

        // Quota / rate limit / run limit detection
        const isQuotaHit =
          typeof firstItem === 'string' ||
          /limited to \d+ runs|upgrade to a paid plan|rate limit|quota exceeded|free users are limited/i.test(itemStr)

        const hasBasicFields = Boolean(
          firstItem &&
          typeof firstItem === 'object' &&
          (firstItem.fullName ||
            firstItem.firstName ||
            firstItem.name ||
            firstItem.headline ||
            (Array.isArray(firstItem.experience) && firstItem.experience.length > 0) ||
            (Array.isArray(firstItem.experiences) && firstItem.experiences.length > 0) ||
            (Array.isArray(firstItem.positions) && firstItem.positions.length > 0))
        )

        if (isQuotaHit || !hasBasicFields) {
          console.warn(`[Apify Quota/Limit Reached]: Free 50-run limit hit on current token (${tokenMask}): ${itemStr.slice(0, 160)}`)
          throw new Error(`Apify quota or invalid dataset returned on token ${tokenMask}: ${itemStr.slice(0, 80)}`)
        }

        // Valid profile extracted successfully
        return mapApifyProfileToCanonical(firstItem, formattedUrl, actorId)
      },
      { maxAttempts: options.maxRetries || apifyKeyPool.getKeyCount() }
    )
  } catch (err) {
    console.warn(`[Apify Exhausted]: All Apify tokens failed or hit quota limits (${err.message}). Falling back to Resume-Bridged profile.`)
    return null
  }
}

