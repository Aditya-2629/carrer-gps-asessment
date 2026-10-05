/**
 * Admin authentication — zero-dependency HMAC session tokens.
 *
 * Credentials come from env (ADMIN_EMAIL / ADMIN_PASSWORD); tokens are
 * `base64url(payload).hmac` with an expiry, verified with a timing-safe
 * comparison. Good enough for a single-admin panel; swap for JWT/OAuth when
 * multi-admin roles arrive.
 */

import crypto from 'crypto'

const getSessionSecret = () =>
  process.env.ADMIN_SESSION_SECRET || 'crafture-admin-dev-secret-change-me'
const getAdminEmail = () =>
  (process.env.ADMIN_EMAIL || 'inspiracustomer@gmail.com').toLowerCase()
const getAdminPassword = () => process.env.ADMIN_PASSWORD || 'crafture-admin-2026'
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const sign = (data) => crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url')

const timingSafeEqual = (a, b) => {
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
 * Verifies a session token. Returns { valid, email } .
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
 * Express guard — accepts the token via Authorization: Bearer or x-admin-token.
 */
export function adminGuard(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-admin-token']
  const { valid } = verifyAdminToken(token)
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Admin authentication required.' })
  }
  return next()
}

export default { adminLogin, verifyAdminToken, adminGuard }
