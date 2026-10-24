/**
 * Apify Job Description Scraper Adapter — Career GPS Resume Agent V3
 *
 * Reuses the official `apify-client` library.
 * Executes an Apify job-scraping actor (configurable via APIFY_JOB_ACTOR_ID),
 * retrieves candidate job postings from the dataset, and handles
 * exponential backoff, retry logic, and timeouts.
 */

import { ApifyClient } from 'apify-client'

export const DEFAULT_APIFY_JOB_ACTOR = 'bebity/linkedin-jobs-scraper'
export const DEFAULT_MAX_CANDIDATES = 35
export const DEFAULT_TIMEOUT_MS = 120000
export const DEFAULT_MAX_RETRIES = 3

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
  const token = process.env.APIFY_API_TOKEN
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
    parseInt(process.env.MARKET_JD_REFRESH_TIMEOUT_MS || '120000', 10) ||
    DEFAULT_TIMEOUT_MS

  if (!token) {
    console.warn('[Apify JdScraper] APIFY_API_TOKEN is not configured in backend/.env.')
    return {
      candidates: [],
      totalFetched: 0,
      actorId,
      durationMs: 0,
      warning: 'APIFY_API_TOKEN not configured.',
    }
  }

  const client = new ApifyClient({ token, timeoutSecs: Math.round(timeoutMs / 1000) })
  const startTime = Date.now()
  let lastError = null

  // Universal input contract adaptable across LinkedIn/Indeed job scrapers (e.g. bebity/linkedin-jobs-scraper)
  const actorInput = {
    queries: [searchSpec.query],
    query: searchSpec.query,
    title: searchSpec.query,
    rows: maxCandidates,            // MUST BE 35, NEVER 0!
    maxRowsPerUrl: maxCandidates,   // MUST BE 35, NEVER 0!
    maxRows: maxCandidates,
    limit: maxCandidates,
    maxItems: maxCandidates,
    location: 'United States',
    country: 'us',
    companyProfile: false,          // Disables 1,000s of company sub-crawls!
    enrichCompany: false,
    scrapeCompanyDetails: false,
    easyApply: false,
    under10Applicants: false,
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Apify JdScraper] Starting Actor run "${actorId}" (attempt ${attempt}/${maxRetries}) for query: "${searchSpec.query}"...`)

      // Run actor and wait for finish with bounded timeout and maxItems limit
      const run = await client.actor(actorId).call(actorInput, {
        waitSecs: Math.round(timeoutMs / 1000),
        maxItems: maxCandidates,
      })

      if (!run || !run.defaultDatasetId) {
        throw new Error(`Apify run failed or returned no datasetId. Status: ${run?.status}`)
      }

      const { items } = await client.dataset(run.defaultDatasetId).listItems({
        limit: maxCandidates,
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
    } catch (err) {
      lastError = err
      const isRetryable =
        err.statusCode === 429 ||
        err.statusCode === 500 ||
        err.statusCode === 502 ||
        err.statusCode === 503 ||
        err.message?.includes('timeout') ||
        err.message?.includes('network')

      console.warn(`[Apify JdScraper] Attempt ${attempt} failed: ${err.message}`)

      if (!isRetryable || attempt === maxRetries) {
        break
      }

      // Exponential backoff with jitter
      const delayMs = Math.min(10000, Math.pow(2, attempt) * 1000 + Math.random() * 500)
      await new Promise((res) => setTimeout(res, delayMs))
    }
  }

  const durationMs = Date.now() - startTime
  throw new Error(`Apify scraping failed after ${maxRetries} attempts (${durationMs}ms): ${lastError?.message}`)
}

export default {
  buildSearchSpecification,
  fetchMarketJdCandidates,
  DEFAULT_APIFY_JOB_ACTOR,
  DEFAULT_MAX_CANDIDATES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
}
