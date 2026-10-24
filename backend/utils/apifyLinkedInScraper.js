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
  const maxItemsLimit = Number(process.env.APIFY_LINKEDIN_MAX_ITEMS) || 35

  try {
    const client = new ApifyClient({ token })

    // Execute Apify actor with token, item, row, and memory limits
    const run = await client.actor(actorId).call(
      {
        urls: [formattedUrl],
        profileUrls: [formattedUrl],
        rows: maxItemsLimit,            // MUST BE 35, NEVER 0!
        maxRowsPerUrl: maxItemsLimit,   // MUST BE 35, NEVER 0!
        maxRows: maxItemsLimit,
        maxItems: maxItemsLimit,
        limit: maxItemsLimit,
        maxSkills: 35,
        maxProfiles: 1,
        companyProfile: false,          // Disables company sub-crawls!
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

    const profile = items[0]

    const rawPicture = profile.pictureUrl || profile.profilePicture || profile.avatar || profile.photoUrl || profile.displayPictureUrl || ''
    const pictureUrl = typeof rawPicture === 'string' ? rawPicture.trim() : ''
    const hasPicture = Boolean(pictureUrl && !/ghost|default|placeholder|camera\.png/i.test(pictureUrl))

    const rawBanner = profile.bannerUrl || profile.coverUrl || profile.backgroundUrl || profile.coverPicture || profile.backgroundPicture || profile.banner || ''
    const bannerUrl = typeof rawBanner === 'string' ? rawBanner.trim() : ''
    const isDefaultBanner = !bannerUrl || /default-banner|banner-default|default_banner/i.test(bannerUrl)
    const hasBanner = !isDefaultBanner && bannerUrl.length > 0

    const rawCerts = Array.isArray(profile.certifications)
      ? profile.certifications
      : Array.isArray(profile.licensesAndCertifications)
      ? profile.licensesAndCertifications
      : Array.isArray(profile.licenses)
      ? profile.licenses
      : []
    const certifications = rawCerts.map((c) => ({
      name: c.name || c.title || 'Certification',
      issuer: c.issuer || c.organization || c.authority || 'Issuing Organization',
      issueDate: c.issueDate || c.date || c.year || '',
      url: c.url || c.licenseUrl || '',
    }))

    const rawProjects = Array.isArray(profile.projects)
      ? profile.projects
      : Array.isArray(profile.featuredProjects)
      ? profile.featuredProjects
      : Array.isArray(profile.portfolio)
      ? profile.portfolio
      : []
    const projects = rawProjects.map((p) => ({
      title: p.title || p.name || 'Project',
      description: p.description || p.summary || '',
      url: p.url || '',
      dates: p.dates || p.dateRange || '',
    }))

    // Return structured JSON formatted specifically for AI context understanding
    return {
      scraped_via: actorId,
      url: formattedUrl,
      fullName: profile.fullName || profile.name || 'Not Specified',
      headline: profile.headline || 'Not Specified',
      about: profile.about || profile.summary || 'Not Specified',
      location: profile.location || 'Not Specified',
      pictureUrl,
      bannerUrl,
      hasPicture,
      hasBanner,
      experiences: (profile.experiences || profile.positions || []).slice(0, 10).map((exp) => ({
        title: exp.title || exp.role || 'N/A',
        company: exp.company || exp.companyName || 'N/A',
        duration: exp.duration || exp.dateRange || 'N/A',
        description: exp.description || 'N/A',
      })),
      education: (profile.educations || profile.education || []).map((edu) => ({
        school: edu.school || edu.schoolName || 'N/A',
        degree: edu.degree || edu.degreeName || 'N/A',
      })),
      certifications,
      projects,
      skills: (profile.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean).slice(0, 35),
      connectionsCount: profile.connectionsCount || profile.connections || 'N/A',
      recommendationsCount: profile.recommendationsCount || (profile.recommendations ? profile.recommendations.length : 0),
    }
  } catch (error) {
    console.error('[Apify LinkedIn Scraper Error]:', error.message)
    throw new Error(error.message.includes('LinkedIn Scraping Error') ? error.message : `LinkedIn Scraping Error: ${error.message}`)
  }
}
