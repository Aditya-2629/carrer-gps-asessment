/**
 * Apify Job Description Scraper Adapter — Career GPS Resume Agent V3
 *
 * Reuses the official `apify-client` library.
 * Executes an Apify job-scraping actor (configurable via APIFY_JOB_ACTOR_ID),
 * retrieves candidate job postings from the dataset, and handles
 * exponential backoff, retry logic, and timeouts.
 */

import { ApifyClient } from 'apify-client'
import { apifyKeyPool } from '../../utils/smartKeyPool.js'

export const DEFAULT_APIFY_JOB_ACTOR = 'bebity/linkedin-jobs-scraper'
export const DEFAULT_MAX_CANDIDATES = 100 // Scaled to 100 JDs
export const DEFAULT_TIMEOUT_MS = 300000  // 5 minutes for 100 items
export const DEFAULT_MAX_RETRIES = 3

/**
 * Scrapes live job descriptions using SmartKeyPool rotation with sticky success.
 */
export async function scrapeLiveJobDescriptions(searchParams, options = {}) {
  return await apifyKeyPool.executeWithRetry(async (activeToken) => {
    const timeoutMs = options.timeoutMs || 45000
    const client = new ApifyClient({
      token: activeToken,
      timeoutSecs: Math.round(timeoutMs / 1000),
    })

    const actorId = process.env.APIFY_JOB_ACTOR_ID || DEFAULT_APIFY_JOB_ACTOR
    const payload = typeof searchParams === 'object' && searchParams !== null
      ? {
          titles: Array.isArray(searchParams.titles) && searchParams.titles.length > 0
            ? searchParams.titles
            : [searchParams.role || searchParams.title || searchParams.query || 'Software Engineer'],
          locations: Array.isArray(searchParams.locations) && searchParams.locations.length > 0
            ? searchParams.locations
            : ['United States'],
          ...searchParams,
        }
      : searchParams
    const run = await client.actor(actorId).call(payload)
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return items || []
  }, { maxAttempts: options.maxRetries || 3 })
}

/**
 * Builds a search query and keyword specification for Apify.
 *
 * @param {Object} params
 * @param {string} params.role
 * @param {string} params.specialization
 * @param {string} params.experienceBucket
 * @param {Array<string>} [params.keywords]
 * @returns {Object} Search specification
 */
export function buildSearchSpecification({
  role = 'Software Engineer',
  specialization = 'general',
  experienceBucket = '3-5',
  keywords = [],
}) {
  const queryTerms = [role]
  if (specialization && specialization !== 'general') {
    queryTerms.push(specialization)
  }

  // Add experience-aligned search query term
  if (experienceBucket === '6-8' || experienceBucket === '8+') {
    if (!/senior|lead|principal|staff/i.test(role)) {
      queryTerms.unshift('Senior')
    }
  } else if (experienceBucket === '0-2') {
    if (!/junior|entry|associate/i.test(role)) {
      queryTerms.push('Junior')
    }
  }

  const cleanKeywords = Array.isArray(keywords)
    ? keywords.filter(Boolean).slice(0, 5)
    : []

  return {
    query: queryTerms.join(' '),
    role,
    specialization,
    experienceBucket,
    keywords: cleanKeywords,
  }
}

/**
 * Fetches candidate JDs from Apify using official ApifyClient.
 *
 * @param {Object} searchSpec
 * @param {Object} [options]
 * @param {number} [options.maxCandidates]
 * @param {string} [options.actorId]
 * @param {number} [options.maxRetries]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ candidates: Array<Object>, totalFetched: number, actorId: string, durationMs: number }>}
 */
export async function fetchMarketJdCandidates(searchSpec, options = {}) {
  const actorId =
    options.actorId ||
    process.env.APIFY_JOB_ACTOR_ID ||
    DEFAULT_APIFY_JOB_ACTOR

  const maxCandidates =
    (options.maxCandidates && options.maxCandidates > 0 ? options.maxCandidates : null) ||
    (parseInt(process.env.MARKET_JD_MAX_CANDIDATES, 10) > 0 ? parseInt(process.env.MARKET_JD_MAX_CANDIDATES, 10) : null) ||
    DEFAULT_MAX_CANDIDATES

  const maxRetries =
    options.maxRetries ||
    parseInt(process.env.MARKET_JD_APIFY_MAX_RETRIES || '3', 10) ||
    DEFAULT_MAX_RETRIES

  const timeoutMs =
    options.timeoutMs ||
    parseInt(process.env.MARKET_JD_REFRESH_TIMEOUT_MS || '180000', 10) ||
    DEFAULT_TIMEOUT_MS

  if (apifyKeyPool.getKeyCount() === 0) {
    console.warn('[Apify JdScraper] No Apify tokens configured in environment.')
    return {
      candidates: [],
      totalFetched: 0,
      actorId,
      durationMs: 0,
      warning: 'No Apify token configured.',
    }
  }

  const startTime = Date.now()

  // Input contract supporting both legacy and modern bebity actor schemas
  const actorInput = {
    titles: Array.isArray(options.titles) && options.titles.length > 0
      ? options.titles
      : [searchSpec.role || searchSpec.query || 'Software Engineer'],
    locations: Array.isArray(options.locations) && options.locations.length > 0
      ? options.locations
      : ['United States'],
    queries: [searchSpec.query],
    query: searchSpec.query,
    title: searchSpec.query,
    rows: maxCandidates,
    maxRowsPerUrl: maxCandidates,
    maxRows: maxCandidates,
    limit: maxCandidates,
    maxItems: maxCandidates,
    location: 'United States',
    country: 'us',
    companyProfile: false,
    enrichCompany: false,
    scrapeCompanyDetails: false,
    easyApply: false,
    under10Applicants: false,
    ...(options.actorInput || {}),
  }

  return await apifyKeyPool.executeWithRetry(async (activeToken) => {
    // Set 300s (5-minute) timeout so LinkedIn scraper has time to paginate and retrieve 100 items without dropping
    const timeoutSecs = Math.max(300, Math.round(timeoutMs / 1000))
    const client = new ApifyClient({
      token: activeToken,
      timeoutSecs,
      maxRetries: 3,
    })
    console.log(`[Apify JdScraper] Starting Actor run "${actorId}" with key ...${activeToken.slice(-4)} for query: "${searchSpec.query}" (Target: ${maxCandidates} JDs, Timeout: ${timeoutSecs}s)...`)

    const run = await client.actor(actorId).call(actorInput, {
      waitSecs: timeoutSecs,
      maxItems: maxCandidates,
    })

    if (!run || !run.defaultDatasetId) {
      throw new Error(`Apify run failed or returned no datasetId. Status: ${run?.status}`)
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems({
      limit: maxCandidates,
      clean: true,
    })

    const durationMs = Date.now() - startTime
    console.log(`[Apify JdScraper] Run finished in ${durationMs}ms. Retrieved ${items?.length || 0} candidate items.`)

    return {
      candidates: items || [],
      totalFetched: items?.length || 0,
      actorId,
      runId: run.id,
      durationMs,
    }
  }, { maxAttempts: maxRetries })
}

export default {
  buildSearchSpecification,
  fetchMarketJdCandidates,
  scrapeLiveJobDescriptions,
  DEFAULT_APIFY_JOB_ACTOR,
  DEFAULT_MAX_CANDIDATES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
}

