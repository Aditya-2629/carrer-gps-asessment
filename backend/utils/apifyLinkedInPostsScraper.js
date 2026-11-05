/**
 * Apify LinkedIn Profile Posts Scraper & SmartKeyPool Integration
 *
 * Scrapes a candidate's recent public LinkedIn posts and comments using:
 * Default Actor: "harvestapi/linkedin-profile-posts" (configurable via APIFY_LINKEDIN_POSTS_ACTOR_ID)
 *
 * Guarantees:
 * 1. URL sanitization and regex validation for public /in/ profiles.
 * 2. Automatic token rotation and failover via SmartKeyPool.
 * 3. No-Crash Guarantee: Never throws an unhandled error; returns a clean structured fallback.
 */

import { ApifyClient } from 'apify-client'
import { apifyKeyPool } from './smartKeyPool.js'

export const DEFAULT_POSTS_ACTOR_ID = 'harvestapi/linkedin-profile-posts'

/**
 * Standard LinkedIn profile regex: https://(www.)linkedin.com/in/{slug}/?
 */
export const LINKEDIN_PROFILE_REGEX = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w\-%.]+\/?$/i

/**
 * Cleans post content string by trimming and collapsing excessive whitespace.
 */
export function cleanPostText(text = '') {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Normalizes raw Apify post dataset items into a clean, canonical posts object.
 *
 * @param {Array} rawItems - Array of raw items from Apify dataset
 * @param {string} formattedUrl - Profile URL
 * @returns {Object} Canonical posts bundle
 */
export function mapApifyPostsToCanonical(rawItems = [], formattedUrl = '') {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      posts: [],
      comments: [],
      author: null,
      totalPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      totalReposts: 0,
      isGhostProfile: true,
      available: true,
      profileUrl: formattedUrl,
    }
  }

  // Handle both flat array of posts and envelope object { posts: [...] }
  let itemsToProcess = []
  let authorMeta = null

  if (rawItems.length === 1 && Array.isArray(rawItems[0]?.posts)) {
    itemsToProcess = rawItems[0].posts
    authorMeta = rawItems[0].author || rawItems[0].profile || null
  } else {
    itemsToProcess = rawItems
  }

  const posts = []
  const allComments = []

  let totalLikes = 0
  let totalComments = 0
  let totalReposts = 0

  itemsToProcess.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return

    // Extract post text/commentary
    const text = cleanPostText(
      item.text ||
      item.content ||
      item.commentary ||
      item.postContent ||
      item.description ||
      item.body ||
      ''
    )

    const rawComments = Array.isArray(item.comments)
      ? item.comments
      : Array.isArray(item.postComments)
      ? item.postComments
      : []

    const normalizedComments = rawComments.slice(0, 10).map((c, cIdx) => {
      const commentText = cleanPostText(c.text || c.content || c.comment || '')
      const commentAuthor = c.author || c.commenter || c.user || null
      const authorName = typeof commentAuthor === 'string'
        ? commentAuthor
        : (commentAuthor?.name || commentAuthor?.fullName || 'LinkedIn Member')

      return {
        id: String(c.id || c.urn || `comment_${idx + 1}_${cIdx + 1}`),
        text: typeof commentText === 'string' ? commentText.trim() : '',
        authorName: String(authorName),
        authorUrl: String(commentAuthor?.profileUrl || commentAuthor?.url || ''),
        postedAt: c.postedAt || c.createdAt || c.date || null,
        likesCount: Number(c.likesCount || c.numLikes || c.likes || 0),
      }
    })

    const likesCount = Number(item.likesCount || item.numLikes || item.likes || item.reactionCount || item.engagement?.likes || 0)
    const commentsCount = Number(item.commentsCount || item.numComments || item.engagement?.comments || normalizedComments.length || 0)
    const repostsCount = Number(item.repostsCount || item.numShares || item.shares || item.numReposts || item.engagement?.shares || 0)

    totalLikes += likesCount
    totalComments += commentsCount
    totalReposts += repostsCount

    if (normalizedComments.length > 0) {
      allComments.push(...normalizedComments)
    }

    if (!authorMeta && (item.author || item.actor)) {
      const a = item.author || item.actor
      authorMeta = {
        name: String(a.name || a.fullName || ''),
        headline: String(a.headline || a.description || ''),
        profileUrl: String(a.profileUrl || a.url || formattedUrl),
      }
    }

    const isRepost = Boolean(item.isRepost || item.repostedPost || item.repost || item.sharedPost || (typeof text === 'string' && text.startsWith('Shared:')))
    const postUrl = String(item.url || item.postUrl || item.link || item.shareUrl || item.linkedinUrl || '')

    const cleanTimestamp = item.postedAt?.timestamp || (item.postedAt?.date ? new Date(item.postedAt.date).getTime() : (typeof item.postedAt === 'string' && !isNaN(Date.parse(item.postedAt)) ? new Date(item.postedAt).getTime() : null))
    const cleanDate = item.postedAt?.date || (typeof item.postedAt === 'string' ? item.postedAt : (typeof item.postedDate === 'string' ? item.postedDate : null))
    const postedAgoShort = String(item.postedAt?.postedAgoShort || item.postedAgo || '')

    posts.push({
      id: String(item.id || item.urn || item.postUrn || `post_${idx + 1}`),
      linkedinUrl: postUrl,
      url: postUrl,
      content: typeof text === 'string' ? text.trim() : '',
      text: typeof text === 'string' ? text.trim() : '',
      postedAt: (cleanTimestamp || cleanDate || postedAgoShort) ? {
        timestamp: cleanTimestamp,
        date: cleanDate,
        postedAgoShort,
      } : null,
      engagement: {
        likes: likesCount,
        comments: commentsCount,
        shares: repostsCount,
      },
      likesCount,
      commentsCount,
      repostsCount,
      isRepost,
      media: Array.isArray(item.media)
        ? item.media.map((m) => (typeof m === 'string' ? m : m?.url || '')).filter(Boolean)
        : Array.isArray(item.images)
        ? item.images.map((m) => (typeof m === 'string' ? m : m?.url || '')).filter(Boolean)
        : item.image
        ? [typeof item.image === 'string' ? item.image : item.image?.url || '']
        : [],
      comments: normalizedComments,
    })
  })

  return {
    posts,
    comments: allComments,
    author: authorMeta,
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    totalReposts,
    isGhostProfile: posts.length === 0,
    available: true,
    profileUrl: formattedUrl,
  }
}

/**
 * Scrapes a candidate's recent LinkedIn posts using Apify & SmartKeyPool.
 *
 * @param {string} linkedinUrl - Candidate's public LinkedIn profile URL
 * @param {Object} [options]
 * @param {number} [options.maxPosts=15] - Maximum posts to retrieve
 * @param {boolean} [options.scrapeComments=true] - Whether to scrape comments
 * @param {number} [options.maxComments=10] - Maximum comments per post
 * @param {boolean} [options.includeReposts=true] - Include reposts in harvest
 * @param {boolean} [options.includeQuotePosts=true] - Include quote posts
 * @returns {Promise<Object>} Structured posts object with No-Crash Guarantee
 */
export async function scrapeLinkedInPosts(linkedinUrl, options = {}) {
  // 1. URL Sanitization & Validation
  if (!linkedinUrl || typeof linkedinUrl !== 'string' || !linkedinUrl.trim()) {
    return {
      posts: [],
      comments: [],
      isGhostProfile: true,
      available: false,
      error: 'INVALID_URL',
    }
  }

  let formattedUrl = linkedinUrl.trim()
  if (!formattedUrl.startsWith('https://')) {
    if (formattedUrl.startsWith('http://')) {
      formattedUrl = formattedUrl.replace(/^http:\/\//i, 'https://')
    } else {
      formattedUrl = `https://${formattedUrl}`
    }
  }

  if (!LINKEDIN_PROFILE_REGEX.test(formattedUrl)) {
    return {
      posts: [],
      comments: [],
      isGhostProfile: true,
      available: false,
      error: 'INVALID_URL',
    }
  }

  // 2. SmartKeyPool Token Verification
  if (apifyKeyPool.getKeyCount() === 0) {
    console.warn('[Apify Warning] No APIFY_API_TOKEN or APIFY_API_TOKENS configured. Skipping LinkedIn posts scraping.')
    return {
      posts: [],
      comments: [],
      isGhostProfile: true,
      available: false,
      fallbackReason: 'NO_TOKEN',
    }
  }

  const actorId = process.env.APIFY_LINKEDIN_POSTS_ACTOR_ID || DEFAULT_POSTS_ACTOR_ID

  // 3. Execution with SmartKeyPool Automatic Key Rotation & Retry
  try {
    return await apifyKeyPool.executeWithRetry(
      async (activeToken) => {
        const tokenMask = activeToken.length > 8 ? `${activeToken.slice(0, 4)}...${activeToken.slice(-4)}` : 'token'
        const client = new ApifyClient({ token: activeToken })

        const run = await client.actor(actorId).call(
          {
            targetUrls: [formattedUrl],
            maxPosts: Number(options.maxPosts) || 15,
            scrapeComments: options.scrapeComments ?? true,
            maxComments: Number(options.maxComments) || 10,
            includeReposts: options.includeReposts ?? true,
            includeQuotePosts: options.includeQuotePosts ?? true,
          },
          {
            maxItems: 50,
            waitSecs: 75,
          }
        )

        // Retrieve items from default dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
          limit: 50,
        })

        if (!items || items.length === 0) {
          // Empty dataset indicates profile has no public posts (ghost profile)
          return mapApifyPostsToCanonical([], formattedUrl)
        }

        const firstItem = items[0]
        const itemStr = typeof firstItem === 'string' ? firstItem : JSON.stringify(firstItem || {})

        // Detect quota / rate limit / run limit messages in dataset output
        const isQuotaHit =
          typeof firstItem === 'string' ||
          /limited to \d+ runs|upgrade to a paid plan|rate limit|quota exceeded|free users are limited/i.test(itemStr)

        if (isQuotaHit) {
          console.warn(`[Apify Quota Reached on token ${tokenMask}]: ${itemStr.slice(0, 160)}`)
          throw new Error(`Apify quota limit or rate limit hit on token ${tokenMask}`)
        }

        return mapApifyPostsToCanonical(items, formattedUrl)
      },
      { maxAttempts: apifyKeyPool.getKeyCount() }
    )
  } catch (err) {
    console.warn(`[Apify Posts Scraper Non-Fatal Error]: ${err.message}. Returning structured fallback.`)
    return {
      posts: [],
      comments: [],
      totalPosts: 0,
      isGhostProfile: true,
      available: false,
      error: err.message,
      fallbackReason: 'APIFY_FAILED',
      profileUrl: formattedUrl,
    }
  }
}

export default {
  scrapeLinkedInPosts,
  mapApifyPostsToCanonical,
  cleanPostText,
  DEFAULT_POSTS_ACTOR_ID,
  LINKEDIN_PROFILE_REGEX,
}
