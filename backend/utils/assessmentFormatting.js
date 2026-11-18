/**
 * assessmentFormatting.js
 * Utilities for formatting assessment answers for display and persistence.
 */

export const VALID_FORM_KEYS = new Set([
  'opportunityType', 'targetRole', 'apps30d', 'appsWeek', 'targetedMatchPct',
  'searchMethods', 'searchStyle', 'externalHelp', 'outreach', 'referralsMonth', 'funnel90d',
  'applications90d', 'recruiterScreens', 'assessments', 'aiInterviews', 'technicalRounds', 'finalRounds', 'offers', 'joiningStatus',
  'interviews', 'humanScreen', 'DropOffStage', 'biggestChallenge', 'alreadyTried', 'frustration',
  'helpNeed', 'visa', 'location', 'experience', 'profileStage',
  'name', 'email', 'phone', 'linkedin', 'linkedinData',
  'searchDuration', 'prepLevel', 'SwitchReason',
])

export function formatAssessmentAnswer(keyOrVal, valIfKey, semanticProfile = null) {
  let key = typeof keyOrVal === 'string' && valIfKey !== undefined ? keyOrVal : ''
  let val = valIfKey !== undefined ? valIfKey : keyOrVal
  if (val == null) return ''

  if (semanticProfile && key && semanticProfile[key]?.displayValue) {
    const sVal = String(semanticProfile[key].displayValue).trim()
    if (sVal && sVal !== 'per') return sVal
  }

  if (Array.isArray(val)) {
    return val.filter(Boolean).join(', ')
  }

  if (typeof val === 'object') {
    if (val.formatted && typeof val.formatted === 'string' && val.formatted.trim() !== 'per') {
      return val.formatted.trim()
    }
    const raw = String(val.raw ?? val.value ?? '').trim()
    const period = String(val.period ?? '').trim()
    if (!raw) return ''
    return period ? `${raw} per ${period}` : raw
  }

  const str = String(val).trim()
  if (str === 'per' || str === 'undefined' || str === 'null') return ''
  return str
}
