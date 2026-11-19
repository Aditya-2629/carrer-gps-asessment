/**
 * Safely extracts a friendly human-readable error message from unknown error objects,
 * Axios errors, API error responses, or strings.
 *
 * @param {unknown} err - The error caught
 * @param {string} [fallback] - Fallback message
 * @returns {string} Friendly error message
 */
export function getFriendlyErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback

  if (typeof err === 'string') {
    const trimmed = err.trim()
    if (!trimmed || trimmed === '[object Object]') return fallback
    return trimmed
  }

  // Response data from axios/fetch wrapper
  const resData = err.response?.data
  if (resData) {
    if (typeof resData === 'string' && resData.trim()) return resData.trim()
    if (typeof resData.message === 'string' && resData.message.trim()) return resData.message.trim()
    if (typeof resData.error === 'string' && resData.error.trim()) return resData.error.trim()
    if (Array.isArray(resData.errors) && resData.errors.length > 0) {
      const first = resData.errors[0]
      if (typeof first === 'string') return first
      if (first?.message) return first.message
    }
  }

  // Standard Error.message
  if (err.message && typeof err.message === 'string') {
    const msg = err.message.trim()
    if (msg.includes('Network Error') || msg.includes('Failed to fetch')) {
      return 'Unable to connect to the server. Please check your internet connection.'
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'The request timed out. Please try again.'
    }
    // Clean common prefixes
    const cleaned = msg.replace(/^(Error|AxiosError|Uncaught):\s*/i, '')
    if (cleaned && cleaned !== '[object Object]') {
      return cleaned
    }
  }

  return fallback
}
