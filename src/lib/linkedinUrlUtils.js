/**
 * Shared LinkedIn URL Normalizer
 * Normalizes full URLs, bare URLs without protocol, PDF /URI annotations,
 * and handles trailing punctuation or quotes.
 */
export function normalizeLinkedInUrl(raw) {
  if (!raw || typeof raw !== 'string') return ''
  const trimmed = raw.trim()

  // 1. Direct match for linkedin.com/in/<username>
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_%-]+)\/?/i)
  if (match && match[1]) {
    const username = match[1].replace(/[.,;)>\]"']+$/, '').trim()
    if (username) {
      return `https://www.linkedin.com/in/${username}`
    }
  }

  // 2. Direct match for bare in/<username> or /in/<username>
  const bareInMatch = trimmed.match(/(?:^|[\s/])in\/([a-zA-Z0-9_%-]+)\/?/i)
  if (bareInMatch && bareInMatch[1]) {
    const username = bareInMatch[1].replace(/[.,;)>\]"']+$/, '').trim()
    if (username) {
      return `https://www.linkedin.com/in/${username}`
    }
  }

  return ''
}

export default { normalizeLinkedInUrl }
