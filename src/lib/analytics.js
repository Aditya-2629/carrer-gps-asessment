const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')

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
    const payload = {
      sessionId: getVisitorSessionId(),
      currentPhase,
      currentStep: currentStep !== undefined ? String(currentStep) : undefined,
      device: getClientDevice(),
      referrer: document.referrer || '',
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
