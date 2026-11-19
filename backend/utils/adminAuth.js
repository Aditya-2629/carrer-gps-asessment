/**
 * Admin authentication — Zero-dependency HMAC session tokens & API Key Authentication.
 *
 * Credentials come from env (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_API_KEY);
 * Tokens are `base64url(payload).hmac` with an expiry, verified with timing-safe comparison.
 */

import crypto from 'crypto'

const isProd = process.env.NODE_ENV === 'production'

const getSessionSecret = () => {
  if (isProd && !process.env.ADMIN_SESSION_SECRET) {
    throw new Error('ADMIN_SESSION_SECRET environment variable must be set in production.')
  }
  return process.env.ADMIN_SESSION_SECRET || 'crafture-admin-dev-secret-change-me'
}

const getAdminEmail = () => {
  if (isProd && !process.env.ADMIN_EMAIL) {
    throw new Error('ADMIN_EMAIL environment variable must be set in production.')
  }
  return (process.env.ADMIN_EMAIL || 'inspiracustomer@gmail.com').toLowerCase()
}

const getAdminPassword = () => {
  if (isProd && !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD environment variable must be set in production.')
  }
  return process.env.ADMIN_PASSWORD || 'crafture-admin-2026'
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const sign = (data) => crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url')

const timingSafeEqual = (a, b) => {
  if (!a || !b) return false
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verifies admin credentials; returns a session token or null.
 */
export function adminLogin(email, password) {
  const emailOk = timingSafeEqual((email || '').trim().toLowerCase(), getAdminEmail())
  const passOk = timingSafeEqual(password || '', getAdminPassword())
  if (!emailOk || !passOk) return null

  const payload = { role: 'admin', email: getAdminEmail(), exp: Date.now() + TOKEN_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

/**
 * Verifies a session token. Returns { valid, email }.
 */
export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return { valid: false }
  const [body, sig] = token.split('.')
  if (!body || !sig) return { valid: false }

  const expected = sign(body)
  if (!timingSafeEqual(sig, expected)) return { valid: false }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) return { valid: false }
    return { valid: true, email: payload.email }
  } catch (_e) {
    return { valid: false }
  }
}

/**
 * Express guard — accepts:
 * 1. `x-admin-api-key` header (matched against process.env.ADMIN_API_KEY via timingSafeEqual)
 * 2. Authorization: Bearer <token> or x-admin-token
 */
export function adminGuard(req, res, next) {
  // 1. Check API Key header for external headless admin panels / microservices
  const apiKeyHeader = req.headers['x-admin-api-key'] || req.headers['x-api-key']
  const envApiKey = process.env.ADMIN_API_KEY

  if (apiKeyHeader && envApiKey) {
    if (timingSafeEqual(apiKeyHeader, envApiKey)) {
      req.adminAuthType = 'api_key'
      return next()
    }
  }

  // 2. Check Session Token
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-admin-token']
  const { valid, email } = verifyAdminToken(token)

  if (valid) {
    req.adminAuthType = 'bearer_token'
    req.adminEmail = email
    return next()
  }

  return res.status(401).json({ success: false, message: 'Admin authentication required.' })
}

export default { adminLogin, verifyAdminToken, adminGuard }
