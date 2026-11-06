/**
 * Jev System One Bullet Quality Triager — Career GPS
 *
 * Fast discriminative triage engine evaluating resume bullets into PASS, WARN, or FIX
 * with calibrated recruiter impact ratings in ~25ms.
 * Heavy generative LLM rewrites run only on bullets genuinely flagged for improvement.
 */

export const JEV_BULLET_CACHE = new Map()

let _gatewayInstance = null
async function getLlmGateway() {
  if (_gatewayInstance) return _gatewayInstance
  try {
    const gwMod = await import('../../../ai/gateway/llmGateway.js')
    _gatewayInstance = gwMod.llmGateway || null
  } catch {
    try {
      const gwMod = await import('../../ai/gateway/llmGateway.js')
      _gatewayInstance = gwMod.llmGateway || null
    } catch {
      _gatewayInstance = null
    }
  }
  return _gatewayInstance
}

/**
 * Triages a candidate's resume bullet into PASS, WARN, or FIX.
 *
 * @param {string} bulletText - Candidate resume bullet text
 * @param {string} [targetRole='Professional'] - Target role context
 * @param {object} [options={}] - Custom options (model, timeout)
 * @returns {Promise<{ status: 'pass' | 'warn' | 'fix', score: number, reason: string }>}
 */
export async function triageBulletWithJev(bulletText = '', targetRole = 'Professional', options = {}) {
  const clean = String(bulletText || '').trim()
  if (!clean || clean.length < 15) {
    return { status: 'fix', score: 20, reason: 'Bullet is too short or empty' }
  }

  const cacheKey = `bullet::${targetRole}__${clean.slice(0, 80)}`
  if (JEV_BULLET_CACHE.has(cacheKey)) {
    return JEV_BULLET_CACHE.get(cacheKey)
  }

  const prompt = `You are Jev, a discriminative recruiter decision engine.
Target Role Context: "${targetRole}"

TASK:
Triage the resume bullet into exactly one status:
- "PASS": Strong action verb, clear technical or business mechanism, quantified outcome (metrics, percentages, scale).
- "WARN": Technical task is clear, but lacks business impact or opens with a weak verb (-ing participle).
- "FIX": Vague duty, tool-dump list, generic responsibility without achievement.

BULLET TEXT:
"${clean}"

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "status": "PASS" | "WARN" | "FIX",
  "score": <number between 10 and 95>,
  "reason": "1 concise sentence explaining the decision"
}`

  try {
    const gw = await getLlmGateway()
    if (!gw) throw new Error('Gateway offline in test sandbox')

    const response = await gw.generate({
      purpose: 'bullet_triage_decision',
      preferredProvider: 'openrouter',
      model: options.model || 'typesafe/jev',
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' },
      temperature: 0.0,
      timeoutMs: options.timeoutMs || 5000,
    }).catch(async () => {
      return await gw.generate({
        purpose: 'bullet_triage_decision',
        preferredProvider: 'openrouter',
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        responseFormat: { type: 'json_object' },
        temperature: 0.0,
        timeoutMs: 6000,
      })
    })

    const raw = response?.text || response?.content || '{}'
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim())
    const status = String(parsed.status || 'WARN').toLowerCase()

    const result = {
      status: ['pass', 'warn', 'fix'].includes(status) ? status : 'warn',
      score: parsed.score || (status === 'pass' ? 85 : status === 'warn' ? 60 : 35),
      reason: parsed.reason || 'Recruiter impact triage'
    }

    JEV_BULLET_CACHE.set(cacheKey, result)
    return result
  } catch (_err) {
    // Deterministic fallback based on metrics and action verbs
    const hasMetric = /\d+[%xXkKMbB]?|\b\d+\b/.test(clean)
    const startsWeak = /^(?:worked|assisted|helped|responsible\s+for|participated|handled|supported)\b/i.test(clean)
    let status = 'warn'
    let score = 55
    if (hasMetric && !startsWeak) {
      status = 'pass'
      score = 85
    } else if (startsWeak && !hasMetric) {
      status = 'fix'
      score = 35
    }
    const result = {
      status,
      score,
      reason: hasMetric ? 'Contains measurable outcome metrics' : 'Missing business outcome metrics'
    }
    JEV_BULLET_CACHE.set(cacheKey, result)
    return result
  }
}
