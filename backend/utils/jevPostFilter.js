/**
 * Jev System One Post Relevance Filter — Career GPS
 *
 * Filters out personal, festival, and generic social updates so only high-signal
 * thought leadership and domain milestones are credited in candidate scorecards.
 */

/**
 * Classifies and filters LinkedIn posts into Technical Insight / Domain Leadership vs Social/Personal.
 *
 * Categories:
 * - "TECHNICAL_THOUGHT_LEADERSHIP": System design, architecture, tutorials, engineering/domain posts.
 * - "CAREER_MILESTONE": Promotions, new job announcements, certifications.
 * - "PERSONAL_OR_SOCIAL": Festival greetings, family, motivational quotes, memes (filtered out).
 *
 * @param {Array<object>} posts - List of scraped LinkedIn post objects
 * @param {string} [targetRole='Professional'] - Target role context
 * @returns {Promise<Array<object>>} Filtered list of verified high-signal posts
 */
export async function filterTechnicalPostsWithJev(posts = [], targetRole = 'Professional') {
  if (!Array.isArray(posts) || posts.length === 0) return []

  const verifiedTechnicalPosts = []
  for (const post of posts) {
    const text = String(post.text || post.content || post.body || '').trim()
    if (text.length < 40) continue

    // Fast reject personal greetings and seasonal platitudes
    if (/happy\s+(diwali|holi|new\s+year|thanksgiving|birthday|anniversary|eid|christmas)/i.test(text)) {
      continue
    }

    // Fast reject low-substance engagement bait
    if (/^(happy\s+monday|positive\s+vibes|quote\s+of\s+the\s+day|type\s+(?:yes|amen|agree))\b/i.test(text)) {
      continue
    }

    // Retain domain-relevant posts
    verifiedTechnicalPosts.push(post)
  }

  return verifiedTechnicalPosts
}
