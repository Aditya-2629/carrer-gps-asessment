import { trackEvent, identifyCandidate } from './posthog'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')
const ATTRIBUTION_KEY = 'crafture_attribution'
const VISITOR_ID_KEY = 'crafture_visitor_id'

const _sentFunnelEvents = new Set()

export function trackFunnelEvent(eventName, props = {}) {
  if (typeof window === 'undefined' || !eventName) return
  trackEvent(eventName, {
    sessionId: getVisitorSessionId(),
    visitorId: getVisitorId(),
    ...props,
  })
}

export function getVisitorId() {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY)
    if (!id) {
      id = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(VISITOR_ID_KEY, id)
    }
    return id
  } catch {
    return `vid_${Date.now()}`
  }
}

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
      visitorId: getVisitorId(),
      currentPhase,
      currentStep: currentStep !== undefined ? String(currentStep) : undefined,
      device: getClientDevice(),
      referrer: attribution.referrer || document.referrer || '',
      attribution,
      userId: userId || undefined,
      abandonedDraft: abandonedDraft || undefined,
    }

    if (abandonedDraft?.email) {
      identifyCandidate(abandonedDraft.email, {
        name: abandonedDraft.name,
        phone: abandonedDraft.phone,
        targetRole: abandonedDraft.targetRole,
      })
    }

    // Mirror key funnel events to PostHog when VITE_POSTHOG_KEY is configured
    const phaseLower = String(currentPhase || '').toLowerCase()
    const stepLower = String(currentStep || '').toLowerCase()
    if ((phaseLower === 'landing' || stepLower === 'landing') && !_sentFunnelEvents.has('landing_viewed')) {
      _sentFunnelEvents.add('landing_viewed')
      trackFunnelEvent('landing_viewed')
    }
    if (abandonedDraft?.resumeFilename && !_sentFunnelEvents.has('step1_resume_uploaded')) {
      _sentFunnelEvents.add('step1_resume_uploaded')
      trackFunnelEvent('step1_resume_uploaded', { filename: abandonedDraft.resumeFilename })
    }
    if (abandonedDraft?.linkedin && !_sentFunnelEvents.has('step2_linkedin_entered')) {
      _sentFunnelEvents.add('step2_linkedin_entered')
      trackFunnelEvent('step2_linkedin_entered')
    }
    if ((stepLower === 'email' || stepLower === 'otp' || stepLower === 'step3_context') && !_sentFunnelEvents.has('step3_context_submitted')) {
      _sentFunnelEvents.add('step3_context_submitted')
      trackFunnelEvent('step3_context_submitted')
    }
    if ((phaseLower === 'report' || stepLower === 'report') && !_sentFunnelEvents.has('report_viewed')) {
      _sentFunnelEvents.add('report_viewed')
      trackFunnelEvent('report_viewed', { userId })
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
