/**
 * LinkedIn Agent — V1 (Multi-Agent Report Architecture)
 *
 * Deterministic analysis of the candidate's scraped LinkedIn profile.
 * Same design philosophy as the Resume Scorecard: no LLM call, runs in
 * milliseconds, every score explainable. Output shape mirrors the resume
 * scorecard (score/grade/grades/checks/issues) so report UI components
 * render it without modification.
 *
 * Evaluated dimensions (US-market recruiter lens):
 *  - Branding: headline quality, About section depth
 *  - Visibility: connections, recommendations, custom URL
 *  - Completeness: experiences, education, skills coverage
 *  - Consistency: headline/title alignment with the resume snapshot
 */

export const LINKEDIN_AGENT_VERSION = 'linkedin-agent-v1'

const GRADE_BANDS = [
  { min: 85, grade: 'A', label: 'Excellent' },
  { min: 70, grade: 'B', label: 'Good' },
  { min: 55, grade: 'C', label: 'Needs Work' },
  { min: 40, grade: 'D', label: 'Weak' },
  { min: 0, grade: 'F', label: 'Critical' },
]

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const gradeFor = (score) => GRADE_BANDS.find((b) => score >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1]
const round = (v) => Math.round(v)

const NOT_SPECIFIED = /not specified|^n\/a$|^$/i

/**
 * @param {Object} profile - scraped LinkedIn data (apifyLinkedInScraper shape)
 * @param {Object} [resumeSnapshot] - { targetRole, primaryProfile, currentTitle } for consistency checks
 * @returns {{agent: string, version: string, computedAt: string, score: number, grade: string,
 *   gradeLabel: string, grades: Object, checks: Array, issues: Array, summary: Object,
 *   dataAvailable: boolean}}
 */
export function analyzeLinkedInProfile(profile, resumeSnapshot = {}) {
  if (!profile || NOT_SPECIFIED.test(profile.fullName || '') === true && NOT_SPECIFIED.test(profile.headline || '')) {
    return {
      agent: 'linkedin',
      version: LINKEDIN_AGENT_VERSION,
      computedAt: new Date().toISOString(),
      dataAvailable: false,
      score: 0,
      grade: 'F',
      gradeLabel: 'No Data',
      grades: {},
      checks: [],
      issues: [],
      summary: { fix: 0, warn: 0, pass: 0 },
    }
  }

  const headline = (profile.headline || '').trim()
  const about = (profile.about || '').trim()
  const experiences = Array.isArray(profile.experiences) ? profile.experiences.filter((e) => !NOT_SPECIFIED.test(e?.title || '')) : []
  const education = Array.isArray(profile.education) ? profile.education.filter((e) => !NOT_SPECIFIED.test(e?.school || '')) : []
  const skills = Array.isArray(profile.skills) ? profile.skills.filter(Boolean) : []
  const connections = typeof profile.connectionsCount === 'number' ? profile.connectionsCount : null
  const recommendations = typeof profile.recommendationsCount === 'number' ? profile.recommendationsCount : null
  const hasCustomUrl = /linkedin\.com\/in\/[^/]+/.test(profile.url || '') && !/pub-|ACoAA/i.test(profile.url || '')

  // ── Category scores ─────────────────────────────────────────────────────────
  const penalties = { branding: 0, visibility: 0, completeness: 0, consistency: 0 }
  const issues = []
  const addIssue = (severity, category, title, diagnosis, recommendation) => {
    issues.push({ id: `li_${String(issues.length + 1).padStart(3, '0')}`, severity, category, title, diagnosis, recommendation })
  }

  // Branding: headline
  let branding = 100
  const headlineWords = headline.split(/\s+/).filter(Boolean).length
  if (NOT_SPECIFIED.test(headline)) {
    branding -= 40
    penalties.branding += 40
    addIssue('high', 'branding', 'LinkedIn headline is missing', 'Recruiters filter candidate searches by headline text — an empty or default headline makes the profile invisible in recruiter searches.', 'Write a headline in the format: Target Role | Core Domain & Stack | Key Outcome or Value.')
  } else if (headlineWords < 5) {
    branding -= 20
    penalties.branding += 20
    addIssue('medium', 'branding', 'Headline is too short to be searchable', `"${headline}" gives recruiters very little to match on. Most recruiter searches combine role + skills keywords.`, 'Expand to "Target Role | Domain & Core Skills | Distinctive Win" — around 8-15 words.')
  } else if (headline.length > 220) {
    branding -= 10
    penalties.branding += 10
  }

  // Branding: About
  if (NOT_SPECIFIED.test(about)) {
    branding -= 35
    penalties.branding += 35
    addIssue('high', 'branding', 'About section is empty', 'The About section is the only long-form space LinkedIn search reads. Empty About = no keyword surface beyond the headline.', 'Write 3-5 short paragraphs: what you do, proof (numbers), what you want next.')
  } else if (about.length < 200) {
    branding -= 15
    penalties.branding += 15
    addIssue('medium', 'branding', 'About section is thin', `Only ~${about.length} characters — recruiters and LinkedIn search both reward a fuller story with concrete outcomes.`, 'Aim for 1200-2000 characters: your positioning, 2-3 quantified wins, and a closing line about the role you want.')
  } else if (!/\d/.test(about)) {
    branding -= 8
    penalties.branding += 8
    addIssue('low', 'branding', 'About section has no numbers', 'A text-only About reads as claims without proof — one or two metrics (users, %, scale) make it credible.', 'Add 2-3 hard numbers from your best work into the About section.')
  }

  // Visibility
  let visibility = 100
  if (connections !== null && connections < 200) {
    visibility -= 25
    penalties.visibility += 25
    addIssue('medium', 'visibility', 'Connection count is low', `${connections} connections is below the 200-500 threshold where LinkedIn shows your profile as a credible peer in search results.`, 'Send 10-15 personalized connection requests per week to relevant recruiters and peers in your target domain.')
  } else if (connections !== null && connections < 500) {
    visibility -= 10
    penalties.visibility += 10
    addIssue('low', 'visibility', 'Below the 500-connections bracket', `At ${connections} connections you sit just under the 500+ bracket that recruiters read as "well-networked".`, 'A few weeks of consistent 10/day personalized invitations gets you over the 500 mark.')
  }
  if (recommendations !== null && recommendations < 1) {
    visibility -= 15
    penalties.visibility += 15
    addIssue('medium', 'visibility', 'No recommendations on the profile', 'Zero recommendations removes the only third-party proof on the profile — recruiters notice an empty recommendations rail.', 'Ask 2-3 former managers or senior colleagues for a short recommendation referencing a specific project.')
  }
  if (!hasCustomUrl) {
    visibility -= 5
    penalties.visibility += 5
    addIssue('low', 'visibility', 'LinkedIn URL is not customized', 'A raw auto-generated URL looks unpolished on a resume and is harder to type or trust.', 'Set a custom URL (linkedin.com/in/firstname-lastname) in profile settings and update it on the resume.')
  }

  // Completeness
  let completeness = 100
  const expWithDescription = experiences.filter((e) => e.description && !NOT_SPECIFIED.test(e.description) && e.description.length > 80).length
  if (experiences.length === 0) {
    completeness -= 40
    penalties.completeness += 40
    addIssue('high', 'completeness', 'No experiences listed on LinkedIn', 'An empty experience section fails recruiter profile reviews and removes all keyword surface for LinkedIn search.', 'Mirror the top 2-3 roles from your resume with 2-3 bullet descriptions each.')
  } else if (expWithDescription < Math.min(2, experiences.length)) {
    completeness -= 15
    penalties.completeness += 15
    addIssue('medium', 'completeness', 'Experience entries lack descriptions', 'Most experience entries have no description — LinkedIn search only matches skills that appear in text, and recruiters skim for proof.', 'Add 2-3 short, metric-led bullets to each role, consistent with the resume.')
  }
  if (education.length === 0) {
    completeness -= 10
    penalties.completeness += 10
    addIssue('low', 'completeness', 'Education section is empty', 'Many recruiter filters still include education fields; an empty section can silently exclude the profile.', 'Add your highest qualification with the institution name.')
  }
  if (skills.length < 5) {
    completeness -= 15
    penalties.completeness += 15
    addIssue('medium', 'completeness', 'Skills list is sparse', `${skills.length} skills listed. LinkedIn ranks profiles in recruiter search partly by skills coverage — fewer than 10 sharply reduces discoverability.`, 'List up to 15 skills that match your target role, ordered by strength.')
  } else if (skills.length < 10) {
    completeness -= 7
    penalties.completeness += 7
    addIssue('low', 'completeness', 'Skills below the 15-skill maximum', `${skills.length} of 15 skill slots used — each added skill is another search keyword recruiters can match.`, 'Top up to 10-15 skills aligned with the target role.')
  }

  // Consistency with resume snapshot
  let consistency = 100
  const targetRole = (resumeSnapshot.targetRole || '').trim()
  if (targetRole && !NOT_SPECIFIED.test(headline)) {
    const roleTokens = targetRole.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    const headlineLower = headline.toLowerCase()
    const matches = roleTokens.filter((w) => headlineLower.includes(w)).length
    if (roleTokens.length > 0 && matches === 0) {
      consistency -= 20
      penalties.consistency += 20
      addIssue('medium', 'consistency', 'Headline does not reflect the target role', `The resume targets "${targetRole}" but the LinkedIn headline never mentions it — a recruiter cross-checking the two sees a mismatch.`, 'Align the headline (and About closing line) with the same target role as the resume.')
    }
  }

  const scores = {
    branding: clamp(branding, 5, 100),
    visibility: clamp(visibility, 5, 100),
    completeness: clamp(completeness, 5, 100),
    consistency: clamp(consistency, 5, 100),
  }

  const CATEGORY_META = [
    { key: 'branding', label: 'Branding & Story', weight: 0.32 },
    { key: 'visibility', label: 'Search Visibility', weight: 0.28 },
    { key: 'completeness', label: 'Profile Completeness', weight: 0.25 },
    { key: 'consistency', label: 'Resume Consistency', weight: 0.15 },
  ]

  let overall = 0
  for (const m of CATEGORY_META) overall += scores[m.key] * m.weight
  const worst = Math.min(...CATEGORY_META.map((m) => scores[m.key]))
  overall = Math.min(overall, worst + 38)
  const score = round(overall)
  const { grade, label } = gradeFor(score)

  const factsFor = {
    branding: [headlineWords < 5 ? 'Headline too short' : 'Headline present', about.length >= 200 ? 'About section has depth' : 'About section needs work'],
    visibility: [connections !== null ? `${connections} connections` : 'Connections unknown', recommendations !== null ? `${recommendations} recommendations` : 'Recommendations unknown'],
    completeness: [`${experiences.length} experiences (${expWithDescription} with descriptions)`, `${skills.length} skills listed`],
    consistency: [targetRole ? `Target role: ${targetRole}` : 'Target role unknown'],
  }

  const grades = {}
  for (const m of CATEGORY_META) {
    const g = gradeFor(scores[m.key])
    grades[m.key] = { label: m.label, score: scores[m.key], grade: g.grade, gradeLabel: g.label, facts: factsFor[m.key] }
  }

  const checks = [
    { id: 'li_headline', label: 'Searchable headline', status: headlineWords >= 5 ? 'pass' : headlineWords >= 3 ? 'warn' : 'fail', detail: headlineWords >= 5 ? `"${headline.slice(0, 60)}${headline.length > 60 ? '…' : ''}"` : 'Too short for recruiter searches', category: 'branding' },
    { id: 'li_about', label: 'About section with proof', status: about.length >= 200 ? (/\d/.test(about) ? 'pass' : 'warn') : 'fail', detail: `~${about.length} characters${/\d/.test(about) ? ', includes numbers' : ', no numbers yet'}`, category: 'branding' },
    { id: 'li_connections', label: '500+ connections bracket', status: connections === null ? 'warn' : connections >= 500 ? 'pass' : connections >= 200 ? 'warn' : 'fail', detail: connections !== null ? `${connections} connections` : 'Connection count unavailable', category: 'visibility' },
    { id: 'li_recommendations', label: 'At least one recommendation', status: recommendations === null ? 'warn' : recommendations >= 1 ? 'pass' : 'fail', detail: recommendations !== null ? `${recommendations} recommendation(s)` : 'Unavailable', category: 'visibility' },
    { id: 'li_experience', label: 'Experiences with descriptions', status: expWithDescription >= 2 ? 'pass' : expWithDescription >= 1 ? 'warn' : 'fail', detail: `${expWithDescription} of ${experiences.length} roles have descriptions`, category: 'completeness' },
    { id: 'li_skills', label: 'Skills coverage (10-15)', status: skills.length >= 10 ? 'pass' : skills.length >= 5 ? 'warn' : 'fail', detail: `${skills.length} skills listed`, category: 'completeness' },
    { id: 'li_role_match', label: 'Headline matches target role', status: penalties.consistency === 0 ? 'pass' : 'warn', detail: targetRole ? `Resume targets: ${targetRole}` : 'Target role unknown', category: 'consistency' },
  ]

  return {
    agent: 'linkedin',
    version: LINKEDIN_AGENT_VERSION,
    computedAt: new Date().toISOString(),
    dataAvailable: true,
    score,
    grade,
    gradeLabel: label,
    grades,
    checks,
    issues,
    summary: {
      fix: issues.filter((i) => i.severity === 'high' || i.severity === 'medium').length,
      warn: issues.filter((i) => i.severity === 'low').length,
      pass: checks.filter((c) => c.status === 'pass').length,
      checksTotal: checks.length,
    },
  }
}

export default { analyzeLinkedInProfile, LINKEDIN_AGENT_VERSION }
