import { ApifyClient } from 'apify-client'

/**
 * Scrapes a complete LinkedIn profile using Apify's cookieless actor:
 * "harvestapi/linkedin-profile-scraper"
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
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`
  }

  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    console.warn('[Apify Warning] APIFY_API_TOKEN is not set in backend/.env. Skipping live LinkedIn profile scraping.')
    return null
  }

  // LinkedIn URL format validation
  const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w\-%.]+\/?$/i
  if (!linkedinRegex.test(formattedUrl)) {
    throw new Error('Invalid LinkedIn URL format. Must be a valid profile link (e.g. https://www.linkedin.com/in/username).')
  }

  try {
    const client = new ApifyClient({ token })

    // Execute Apify cookieless actor: harvestapi/linkedin-profile-scraper
    // Pass both 'urls' and 'profileUrls' for maximum compatibility
    const run = await client.actor('harvestapi/linkedin-profile-scraper').call({
      urls: [formattedUrl],
      profileUrls: [formattedUrl],
    })

    // Retrieve items from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    if (!items || items.length === 0) {
      throw new Error('Unable to extract profile data. Please ensure your LinkedIn profile is public and accessible.')
    }

    const profile = items[0]

    // Return structured JSON formatted specifically for AI context understanding
    return {
      scraped_via: 'harvestapi/linkedin-profile-scraper',
      url: formattedUrl,
      fullName: profile.fullName || profile.name || 'Not Specified',
      headline: profile.headline || 'Not Specified',
      about: profile.about || profile.summary || 'Not Specified',
      location: profile.location || 'Not Specified',
      experiences: (profile.experiences || profile.positions || []).map((exp) => ({
        title: exp.title || exp.role || 'N/A',
        company: exp.company || exp.companyName || 'N/A',
        duration: exp.duration || exp.dateRange || 'N/A',
        description: exp.description || 'N/A',
      })),
      education: (profile.educations || profile.education || []).map((edu) => ({
        school: edu.school || edu.schoolName || 'N/A',
        degree: edu.degree || edu.degreeName || 'N/A',
      })),
      skills: (profile.skills || []).map((s) => (typeof s === 'string' ? s : s.name)),
      connectionsCount: profile.connectionsCount || profile.connections || 'N/A',
      recommendationsCount: profile.recommendationsCount || (profile.recommendations ? profile.recommendations.length : 0),
    }
  } catch (error) {
    console.error('[Apify LinkedIn Scraper Error]:', error.message)
    throw new Error(error.message.includes('LinkedIn Scraping Error') ? error.message : `LinkedIn Scraping Error: ${error.message}`)
  }
}
