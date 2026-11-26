import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let initialized = false

function ensureInitialized() {
  if (typeof window === 'undefined' || !POSTHOG_KEY) return false
  if (!initialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      session_recording: { maskAllInputs: false },
    })
    initialized = true
  }
  return true
}

// Initialize eagerly on client load when VITE_POSTHOG_KEY is configured
if (typeof window !== 'undefined' && POSTHOG_KEY) {
  ensureInitialized()
}

export function trackEvent(eventName, props = {}) {
  if (!eventName || !ensureInitialized()) return
  try {
    posthog.capture(eventName, props)
  } catch {
    // Non-blocking analytics
  }
}

export function identifyCandidate(email, traits = {}) {
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!cleanEmail || !cleanEmail.includes('@') || !ensureInitialized()) return
  try {
    const cleanTraits = { email: cleanEmail }
    if (traits.name) cleanTraits.name = String(traits.name).trim()
    if (traits.phone) cleanTraits.phone = String(traits.phone).trim()
    if (traits.targetRole) cleanTraits.targetRole = String(traits.targetRole).trim()
    posthog.identify(cleanEmail, cleanTraits)
  } catch {
    // Non-blocking analytics
  }
}
