/**
 * Zero-dependency HMAC user session authentication & IDOR defense.
 * Issues and validates 24h session tokens bound to user._id.
 */
import crypto from 'crypto'
import { verifyAdminToken } from './adminAuth.js'

const isProd = process.env.NODE_ENV === 'production'

const getUserSessionSecret = () => {
  return (
    process.env.USER_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    (isProd ? '' : 'crafture-user-dev-secret-change-me')
  )
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

const sign = (data) => {
  const secret = getUserSessionSecret()
  if (!secret) throw new Error('USER_SESSION_SECRET must be configured in production.')
  return crypto.createHmac('sha256', secret).update(data).digest('base64url')
}

const timingSafeEqual = (a, b) => {
  if (!a || !b) return false
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function generateUserToken(userId) {
  if (!userId) return null
  const payload = {
    userId: String(userId),
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyUserToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return { valid: false }
  const [body, sig] = token.split('.')
  if (!body || !sig) return { valid: false }

  const expected = sign(body)
  if (!timingSafeEqual(sig, expected)) return { valid: false }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) return { valid: false }
    return { valid: true, userId: payload.userId }
  } catch (_e) {
    return { valid: false }
  }
}

/**
 * Express Guard to prevent IDOR and unauthenticated access.
 * Allows Admin tokens (API key / Bearer) or valid User session tokens.
 */
export async function userSessionGuard(req, res, next) {
  // 1. Admin bypass (API Key or Admin session token)
  const apiKeyHeader = req.headers['x-admin-api-key'] || req.headers['x-api-key']
  const envApiKey = process.env.ADMIN_API_KEY
  if (apiKeyHeader && envApiKey) {
    const bufA = Buffer.from(String(apiKeyHeader))
    const bufB = Buffer.from(String(envApiKey))
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      req.isAdmin = true
      return next()
    }
  }

  const authHeader = req.headers.authorization || ''
  const adminToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token']
  if (adminToken) {
    const { valid } = verifyAdminToken(adminToken)
    if (valid) {
      req.isAdmin = true
      return next()
    }
  }

  // 2. User session token check (Bearer header, x-user-token, or query param for SSE streams)
  const userToken =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    req.headers['x-user-token'] ||
    req.query?.token

  if (!userToken) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please verify your email via OTP.',
    })
  }

  const { valid, userId } = verifyUserToken(userToken)
  if (!valid || !userId) {
    return res.status(401).json({
      success: false,
      message: 'Session token invalid or expired. Please verify your email via OTP.',
    })
  }

  req.userId = userId

  // 3. IDOR Prevention: If a target userId is in params, body, or query, enforce match
  const targetUserId = req.params?.userId || req.body?.userId || req.query?.userId
  if (targetUserId && String(targetUserId) !== String(userId)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to access this resource.',
    })
  }

  return next()
}

export default { generateUserToken, verifyUserToken, userSessionGuard }
