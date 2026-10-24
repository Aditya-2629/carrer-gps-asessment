import { ApifyClient } from 'apify-client'

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
 * Scrapes a complete LinkedIn profile using Apify's cookieless actor:
 * Default: "harvestapi/linkedin-profile-scraper" (configurable via APIFY_LINKEDIN_ACTOR_ID)
 */
export const scrapeLinkedInProfile = async (linkedinUrl) => {
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

  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    console.warn('[Apify Warning] APIFY_API_TOKEN is not set in backend/.env. Skipping live LinkedIn profile scraping.')
    return null
  }

  // LinkedIn URL format validation (must start with https:// and match profile pattern)
  const linkedinRegex = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w\-%.]+\/?$/i
  if (!linkedinRegex.test(formattedUrl)) {
    throw new Error('Invalid LinkedIn URL format. Must be a valid profile link (e.g. https://www.linkedin.com/in/username).')
  }

  const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || 'harvestapi/linkedin-profile-scraper'
  const maxItemsLimit = Number(process.env.APIFY_LINKEDIN_MAX_ITEMS) || 100

  try {
    const client = new ApifyClient({ token })

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
      throw new Error('Unable to extract profile data. Please ensure your LinkedIn profile is public and accessible.')
    }

    return mapApifyProfileToCanonical(items[0], formattedUrl, actorId)
  } catch (error) {
    console.error('[Apify LinkedIn Scraper Error]:', error.message)
    throw new Error(error.message.includes('LinkedIn Scraping Error') ? error.message : `LinkedIn Scraping Error: ${error.message}`)
  }
}
