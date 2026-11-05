/**
 * LinkedIn Activity & Engagement Signal Engine
 *
 * Computes 100% deterministic, zero-LLM activity signals from scraped LinkedIn
 * posts and comments in < 5ms. Evaluates posting recency, weekly cadence, engagement
 * velocity, content substance vs. fluff, target role alignment, and networking.
 *
 * Zero external network or LLM dependencies.
 */

// Common seniority prefixes stripped from target roles to extract core domain tokens
const SENIORITY_PREFIX_REGEX = /\b(senior|sr\.?|lead|staff|principal|junior|jr\.?|mid-level|mid|entry-level|associate|director|head of|vp|chief)\b/gi

// Generic platitudes and fluff patterns that degrade professional substance
export const FLUFF_PATTERNS = [
  /\bagree\s*\?/i,
  /\bthoughts\s*\?/i,
  /\bwhat do you think\s*\?/i,
  /\bhappy monday\b/i,
  /\bexcited to (share|announce)\b/i,
  /\bthrilled to (share|announce|join)\b/i,
  /\bhumbled and honored\b/i,
  /\bquote of the day\b/i,
  /\bpositive vibes\b/i,
  /\bgrind never stops\b/i,
  /\btype (yes|amen|agree) in the comments\b/i,
  /\bdo you agree\b/i,
  /\blet that sink in\b/i,
  /\bdrop your thoughts\b/i,
  /\bcomment below\b/i,
]

/**
 * Safely parses any date/timestamp representation into epoch milliseconds.
 * Supports numbers, ISO strings, Date instances, and nested objects.
 *
 * @param {any} rawDate
 * @returns {number|null} Epoch timestamp in milliseconds or null
 */
export function parseTimestampSafely(rawDate) {
  if (!rawDate) return null

  if (typeof rawDate === 'number' && Number.isFinite(rawDate)) {
    // Apify or UNIX timestamps may be in seconds (< 1e11)
    return rawDate < 1e11 ? Math.round(rawDate * 1000) : Math.round(rawDate)
  }

  if (typeof rawDate === 'object') {
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return rawDate.getTime()
    }
    if (rawDate.timestamp) return parseTimestampSafely(rawDate.timestamp)
    if (rawDate.date) return parseTimestampSafely(rawDate.date)
    if (rawDate.epochTime) return parseTimestampSafely(rawDate.epochTime)
  }

  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim()
    const numeric = Number(trimmed)
    if (!isNaN(numeric) && numeric > 1e9) {
      return numeric < 1e11 ? Math.round(numeric * 1000) : Math.round(numeric)
    }
    const parsed = Date.parse(trimmed)
    if (!isNaN(parsed)) return parsed
  }

  return null
}

/**
 * Checks whether a keyword or skill token exists in target text with boundary awareness.
 *
 * @param {string} token
 * @param {string} text
 * @returns {boolean}
 */
export function matchTokenInText(token, text) {
  if (!token || !text || typeof token !== 'string' || typeof text !== 'string') return false
  const lowerText = text.toLowerCase()
  const lowerToken = token.trim().toLowerCase()
  if (!lowerToken) return false

  // If token contains punctuation/special symbols (e.g. node.js, c++, c#, .net, ci/cd)
  if (/[^a-z0-9]/.test(lowerToken)) {
    const escaped = lowerToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(^|\\s|[,.;:!?"'()\\[\\]{}/])${escaped}($|\\s|[,.;:!?"'()\\[\\]{}/])`, 'i')
    if (regex.test(lowerText)) return true

    // Also check alphanumeric stripped alias (e.g., nodejs for node.js)
    const stripped = lowerToken.replace(/[^a-z0-9]/g, '')
    if (stripped.length >= 2) {
      const strippedRegex = new RegExp(`\\b${stripped}\\b`, 'i')
      if (strippedRegex.test(lowerText)) return true
    }
    return false
  }

  const regex = new RegExp(`\\b${lowerToken}\\b`, 'i')
  return regex.test(lowerText)
}

/**
 * Extracts deterministic LinkedIn activity and engagement signals.
 *
 * @param {Object} [activityData] - Canonical scraped posts & comments bundle
 * @param {string|Object} [targetRole=''] - Candidate's target role or title
 * @param {string[]} [coreSkills=[]] - Verified technical/functional skills from resume
 * @returns {Object} Standardized activity signal contract
 */
export function extractLinkedInActivitySignals(activityData, targetRole = '', coreSkills = []) {
  // Defensive input normalization
  const hasData = Boolean(activityData && typeof activityData === 'object')
  const available = hasData ? Boolean(activityData.available ?? true) : false
  const rawPosts = hasData && Array.isArray(activityData.posts) ? activityData.posts : []
  const rawComments = hasData && Array.isArray(activityData.comments) ? activityData.comments : []

  // Filter valid post objects
  const posts = rawPosts.filter((p) => p && typeof p === 'object')
  const comments = rawComments.filter((c) => c && typeof c === 'object')
  const postsAnalyzedCount = posts.length

  // 1. Recency & Velocity Metrics
  const validTimestamps = []
  for (const p of posts) {
    const ts = parseTimestampSafely(
      p.postedAt || p.postedDate || p.createdAt || p.time || p.date
    )
    if (ts !== null && Number.isFinite(ts)) {
      validTimestamps.push(ts)
    }
  }

  let daysSinceLastPost = null
  let recencyTier = 'Dormant'
  let weeklyPostingCadence = 0
  let isGhostProfile = !hasData || !available || postsAnalyzedCount === 0 || Boolean(activityData?.isGhostProfile)

  if (validTimestamps.length > 0) {
    const newestTs = Math.max(...validTimestamps)
    const oldestTs = Math.min(...validTimestamps)
    const now = Date.now()
    const diffMs = Math.max(0, now - newestTs)
    daysSinceLastPost = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // Recency tier categorization
    if (daysSinceLastPost <= 7) {
      recencyTier = 'Highly Active'
    } else if (daysSinceLastPost <= 21) {
      recencyTier = 'Regular'
    } else if (daysSinceLastPost <= 60) {
      recencyTier = 'Occasional'
    } else {
      recencyTier = 'Dormant'
    }

    // Weekly posting cadence: total posts / max(1, span in weeks between newest and oldest)
    const spanInWeeks = (newestTs - oldestTs) / (7 * 24 * 60 * 60 * 1000)
    weeklyPostingCadence = Math.round((postsAnalyzedCount / Math.max(1, spanInWeeks)) * 10) / 10

    // Ghost profile: 0 posts, explicit ghost flag, or > 90 days dormant
    if (daysSinceLastPost > 90) {
      isGhostProfile = true
    }
  } else if (postsAnalyzedCount > 0) {
    // Posts exist but timestamps were missing or unparseable
    recencyTier = 'Occasional'
    weeklyPostingCadence = Math.min(postsAnalyzedCount, 1.0)
    isGhostProfile = Boolean(activityData?.isGhostProfile)
  }

  // Cadence Health
  let cadenceHealth = 'Dormant'
  if (isGhostProfile || postsAnalyzedCount === 0 || recencyTier === 'Dormant') {
    cadenceHealth = 'Dormant'
  } else if (weeklyPostingCadence >= 5) {
    cadenceHealth = 'High Volume'
  } else if (weeklyPostingCadence >= 1) {
    cadenceHealth = 'Optimal'
  } else {
    cadenceHealth = 'Low/Inconsistent'
  }

  // Status computation
  let status = 'unscraped'
  if (!hasData || !available) {
    status = 'unscraped'
  } else if (isGhostProfile || postsAnalyzedCount === 0) {
    status = 'ghost_profile'
  } else {
    status = 'active'
  }

  // 2. Engagement & Amplification Metrics
  let totalLikes = 0
  let totalComments = 0
  let totalShares = 0
  let originalPostsCount = 0
  let mediaRichPostsCount = 0
  let substantivePostsCount = 0
  let fluffIndicatorCount = 0

  const allPostTexts = []

  for (const p of posts) {
    const likes = Math.max(0, Number(p.likesCount || p.numLikes || p.likes || 0) || 0)
    const comms = Math.max(
      0,
      Number(
        p.commentsCount ||
          p.numComments ||
          (Array.isArray(p.comments) ? p.comments.length : 0)
      ) || 0
    )
    const shares = Math.max(
      0,
      Number(p.repostsCount || p.sharesCount || p.numShares || p.shares || 0) || 0
    )

    totalLikes += likes
    totalComments += comms
    totalShares += shares

    // Original vs Repost check
    const isRepost = Boolean(
      p.isRepost || p.repostedPost || p.isQuotePost || p.repost || p.type === 'repost'
    )
    if (!isRepost) {
      originalPostsCount++
    }

    // Media Rich check (slides, documents, carousels, images, video)
    const hasMedia = Boolean(
      (Array.isArray(p.media) && p.media.length > 0) ||
        (Array.isArray(p.images) && p.images.length > 0) ||
        p.image ||
        p.document ||
        p.video ||
        p.hasMedia ||
        p.hasDocument ||
        p.hasCarousel ||
        p.hasVideo
    )
    if (hasMedia) {
      mediaRichPostsCount++
    }

    // Post content text
    const text = String(
      p.text || p.content || p.commentary || p.postContent || p.description || ''
    ).trim()
    if (text) {
      allPostTexts.push(text)
    }

    // 3. Substance vs Fluff Heuristics
    if (text.length >= 160) {
      substantivePostsCount++
    }

    const hasFluff = FLUFF_PATTERNS.some((pattern) => pattern.test(text))
    if (hasFluff) {
      fluffIndicatorCount++
    }
  }

  const totalEngagements = totalLikes + totalComments + totalShares
  const avgLikes = postsAnalyzedCount > 0 ? Math.round((totalLikes / postsAnalyzedCount) * 10) / 10 : 0
  const avgComments = postsAnalyzedCount > 0 ? Math.round((totalComments / postsAnalyzedCount) * 10) / 10 : 0
  const avgShares = postsAnalyzedCount > 0 ? Math.round((totalShares / postsAnalyzedCount) * 10) / 10 : 0
  const originalPostRatio = postsAnalyzedCount > 0 ? Math.round((originalPostsCount / postsAnalyzedCount) * 100) / 100 : 0
  const mediaRichRatio = postsAnalyzedCount > 0 ? Math.round((mediaRichPostsCount / postsAnalyzedCount) * 100) / 100 : 0

  // Substance score: 0 - 100
  let substanceScore = 0
  if (postsAnalyzedCount > 0) {
    const substantiveRatio = substantivePostsCount / postsAnalyzedCount
    const fluffRatio = fluffIndicatorCount / postsAnalyzedCount
    const rawScore = substantiveRatio * 100 - fluffRatio * 20
    substanceScore = Math.max(0, Math.min(100, Math.round(rawScore)))
  }

  // 4. Target Role Domain Alignment
  const roleStr = typeof targetRole === 'string'
    ? targetRole
    : (targetRole?.title || targetRole?.targetRole || targetRole?.role || '')

  // Strip seniority prefixes and extract role keywords
  const cleanedRole = roleStr.replace(SENIORITY_PREFIX_REGEX, ' ').trim()
  const roleTokens = cleanedRole
    .toLowerCase()
    .split(/[\s,/_\\|&+-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^(and|for|the|with|in|of|to)$/.test(t))

  // Clean and preserve coreSkills
  const cleanCoreSkills = Array.isArray(coreSkills)
    ? coreSkills
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length >= 2)
    : []

  // Aggregate searchable corpus: all post text + all comments text
  const commentTexts = comments.map((c) => String(c.text || c.content || c.comment || '').trim())
  const fullSearchCorpus = [...allPostTexts, ...commentTexts].join('\n\n')

  // Target tokens to test: unique combination of role tokens and core skills (lowercased)
  const tokenMap = new Map() // lowercase -> original label
  for (const rt of roleTokens) {
    if (!tokenMap.has(rt)) tokenMap.set(rt, rt)
  }
  for (const cs of cleanCoreSkills) {
    const lower = cs.toLowerCase()
    if (!tokenMap.has(lower)) tokenMap.set(lower, cs)
  }

  const allTargetTokens = Array.from(tokenMap.keys())
  const matchedKeywords = []
  const topTopicsDetected = []

  for (const token of allTargetTokens) {
    if (matchTokenInText(token, fullSearchCorpus)) {
      const originalLabel = tokenMap.get(token) || token
      matchedKeywords.push(originalLabel)
      if (topTopicsDetected.length < 5) {
        topTopicsDetected.push(originalLabel)
      }
    }
  }

  // Missing core skills: Skills from candidate's resume absent from their posts/activity
  const missingCoreKeywords = []
  for (const cs of cleanCoreSkills) {
    const isMatched = matchTokenInText(cs, fullSearchCorpus)
    if (!isMatched) {
      missingCoreKeywords.push(cs)
    }
  }

  // Domain keyword overlap score (0 to 100):
  // Score = min(100, round((matched unique domain tokens / min(8, total target tokens)) * 100))
  const denom = Math.min(8, allTargetTokens.length)
  const domainKeywordOverlapScore = denom > 0
    ? Math.min(100, Math.round((matchedKeywords.length / denom) * 100))
    : 0

  // 5. Outbound Commenting & Networking Activity
  const outboundCommentsCount = comments.length
  let totalCommentLength = 0
  let substantiveDiscussionsCount = 0

  for (const c of comments) {
    const cText = String(c.text || c.content || c.comment || '').trim()
    totalCommentLength += cText.length
    if (cText.length >= 60) {
      substantiveDiscussionsCount++
    }
  }

  const avgOutboundCommentLength = outboundCommentsCount > 0
    ? Math.round(totalCommentLength / outboundCommentsCount)
    : 0

  const hasActiveDiscussions = substantiveDiscussionsCount >= 2

  // Return Standardized Signal Contract
  return {
    status,
    available,
    isGhostProfile,
    postsAnalyzedCount,
    daysSinceLastPost,
    recencyTier,
    weeklyPostingCadence,
    cadenceHealth,
    engagement: {
      avgLikes,
      avgComments,
      avgShares,
      totalEngagements,
      originalPostRatio,
      mediaRichRatio,
    },
    substance: {
      substantivePostsCount,
      fluffIndicatorCount,
      substanceScore,
    },
    domainAlignment: {
      domainKeywordOverlapScore,
      matchedKeywords,
      missingCoreKeywords,
      topTopicsDetected,
    },
    networking: {
      outboundCommentsCount,
      avgOutboundCommentLength,
      hasActiveDiscussions,
    },
  }
}
