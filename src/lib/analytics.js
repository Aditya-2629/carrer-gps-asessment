const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')
const ATTRIBUTION_KEY = 'crafture_attribution'

export function getAttribution() {
  if (typeof window === 'undefined') {
    return { source: 'direct', medium: '', campaign: '', referrer: '' }
  }
  try {
    const params = new URLSearchParams(window.location.search || '')
    const utmSource = (params.get('utm_source') || '').trim().slice(0, 100)
    const utmMedium = (params.get('utm_medium') || '').trim().slice(0, 100)
    const utmCampaign = (params.get('utm_campaign') || '').trim().slice(0, 128)
    const referrer = (document.referrer || '').trim().slice(0, 256)

    const rawStored = sessionStorage.getItem(ATTRIBUTION_KEY)
    const stored = rawStored ? JSON.parse(rawStored) : null

    if (utmSource || utmMedium || utmCampaign || !stored) {
      const next = {
        source: utmSource || stored?.source || 'direct',
        medium: utmMedium || stored?.medium || '',
        campaign: utmCampaign || stored?.campaign || '',
        referrer: referrer || stored?.referrer || '',
      }
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next))
      return next
    }
    return stored
  } catch {
    return { source: 'direct', medium: '', campaign: '', referrer: '' }
  }
}

export function getVisitorSessionId() {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let id = sessionStorage.getItem('crafture_visitor_session_id')
    if (!id) {
      id = `vs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem('crafture_visitor_session_id', id)
    }
    return id
  } catch {
    return `vs_${Date.now()}`
  }
}

function getClientDevice() {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 640) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

/**
 * Non-blocking analytics heartbeat & abandoned lead draft tracker.
 * Uses navigator.sendBeacon when available with fetch(keepalive) fallback.
 */
export function trackAnalytics({ currentPhase, currentStep, abandonedDraft, userId } = {}) {
  if (typeof window === 'undefined') return
  try {
    const attribution = getAttribution()
    const payload = {
      sessionId: getVisitorSessionId(),
      currentPhase,
      currentStep: currentStep !== undefined ? String(currentStep) : undefined,
      device: getClientDevice(),
      referrer: attribution.referrer || document.referrer || '',
      attribution,
      userId: userId || undefined,
      abandonedDraft: abandonedDraft || undefined,
    }
    const body = JSON.stringify(payload)
    const url = `${API_BASE}/analytics/track`

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' })
      const sent = navigator.sendBeacon(url, blob)
      if (sent) return
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Non-blocking analytics must never throw
  }
}
