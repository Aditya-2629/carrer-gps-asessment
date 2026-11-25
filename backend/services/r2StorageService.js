import crypto from 'crypto'

/**
 * Optional Cloudflare R2 Storage Hook (Zero external SDK required).
 * Activates ONLY when R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY
 * are all configured in environment variables. Gracefully no-ops otherwise.
 */
export function isR2Configured() {
  return Boolean(
    process.env.R2_BUCKET &&
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  )
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function buildSigV4Headers({ method, host, path, contentType, payloadHash }) {
  const accessKey = process.env.R2_ACCESS_KEY_ID
  const secretKey = process.env.R2_SECRET_ACCESS_KEY
  const region = 'auto'
  const service = 's3'

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (contentType) headers['content-type'] = contentType

  const sortedKeys = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join('')
  const signedHeaders = sortedKeys.join(';')

  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n')

  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  const kSigning = hmacSha256(kService, 'aws4_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

export async function uploadToR2(key, buffer, contentType = 'application/octet-stream') {
  if (!isR2Configured() || !buffer) {
    return { configured: false, uploaded: false, key: null }
  }
  try {
    const accountId = process.env.R2_ACCOUNT_ID.trim()
    const bucket = process.env.R2_BUCKET.trim()
    const cleanKey = String(key).replace(/^\/+/, '')
    const host = `${accountId}.r2.cloudflarestorage.com`
    const path = `/${bucket}/${cleanKey}`
    const payloadHash = sha256Hex(buffer)

    const headers = buildSigV4Headers({
      method: 'PUT',
      host,
      path,
      contentType,
      payloadHash,
    })

    const res = await fetch(`https://${host}${path}`, {
      method: 'PUT',
      headers,
      body: buffer,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.warn(`[R2Storage] Upload failed (${res.status}) for ${cleanKey}`)
      return { configured: true, uploaded: false, key: null }
    }
    return { configured: true, uploaded: true, key: cleanKey }
  } catch (err) {
    console.warn('[R2Storage] Upload error (non-fatal):', err.message)
    return { configured: true, uploaded: false, key: null }
  }
}
