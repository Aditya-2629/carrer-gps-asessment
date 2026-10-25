/**
 * LinkedIn Scorecard Engine — 100-Point Recruiter Rubric
 *
 * Evaluates LinkedIn profile across 4 weighted categories:
 * 1. Branding & Story (30%)
 * 2. Search Visibility & SEO (25%)
 * 3. Profile Completeness (20%)
 * 4. Resume-LinkedIn Alignment & Consistency (25%)
 *
 * Contract shape is 100% backward-compatible with ResumeScoreCard & LinkedInDeepDiagnosis.
 */

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

export function computeLinkedInScorecard(signals = {}, crossAnalysis = null, targetRole = '') {
  const headline = signals?.headline || {}
  const about = signals?.about || {}
  const visibility = signals?.visibility || {}
  const completeness = signals?.completeness || {}

  const penalties = { branding: 0, visibility: 0, completeness: 0, consistency: 0 }
  const issues = []
  const addIssue = (severity, category, title, diagnosis, recommendation) => {
    issues.push({
      id: `li_${String(issues.length + 1).padStart(3, '0')}`,
      severity,
      category,
      title,
      diagnosis,
      recommendation,
    })
  }

  // ── 1. Branding & Story (30%) ───────────────────────────────────────────
  let branding = 100
  if (headline.isMissing) {
    branding -= 40
    penalties.branding += 40
    addIssue(
      'high',
      'branding',
      'LinkedIn headline is missing',
      'Recruiters filter candidate searches by headline text. An empty or default headline leaves the profile invisible.',
      'Write a headline in the format: Target Role | Core Stack & Domain | Measurable Outcome.'
    )
  } else if (headline.isTooShort) {
    branding -= 20
    penalties.branding += 20
    addIssue(
      'medium',
      'branding',
      'Headline is too short for searchability',
      `"${headline.text}" gives recruiters minimal keyword surface. Recruiter searches combine role + stack keywords.`,
      'Expand to 8-15 words: "Target Role | Core Skills & Cloud | Quantified Win".'
    )
  } else if (headline.isTooLong) {
    branding -= 10
    penalties.branding += 10
    addIssue(
      'low',
      'branding',
      'Headline exceeds optimal length',
      `At ${headline.length} characters, your headline truncates on mobile and search result cards.`,
      'Keep your core value proposition within the first 120 characters before mobile truncation.'
    )
  }

  if (about.isMissing) {
    branding -= 35
    penalties.branding += 35
    addIssue(
      'high',
      'branding',
      'About section is empty',
      'The About section is the primary long-form narrative indexed by LinkedIn search. An empty About severely reduces keyword discoverability.',
      'Write a 3-paragraph story: The Hook → Quantified Proof from your career → Call to connect.'
    )
  } else if (about.isThin) {
    branding -= 15
    penalties.branding += 15
    addIssue(
      'medium',
      'branding',
      'About section is thin',
      `Only ~${about.length} characters. Recruiters skim for depth and proof of technical ownership.`,
      'Expand to 800-1500 characters highlighting 2-3 specific project wins with concrete outcomes.'
    )
  } else if (!about.hasMetrics) {
    branding -= 10
    penalties.branding += 10
    addIssue(
      'low',
      'branding',
      'About section lacks quantified proof',
      'Text-only claims read as unverified. Quantified metrics (e.g., scale, latency reduction, user counts) build immediate credibility.',
      'Weave 2-3 verified metrics into your About narrative.'
    )
  }

  // ── 2. Search Visibility & SEO (25%) ─────────────────────────────────────
  let visScore = 100
  if (visibility.connectionBracket === '<200') {
    visScore -= 25
    penalties.visibility += 25
    addIssue(
      'medium',
      'visibility',
      'Connection network is below recruiter benchmark',
      `${visibility.connectionsCount ?? 0} connections is below the 200 threshold where LinkedIn algorithms grant full search distribution.`,
      'Send personalized connection requests to colleagues, alumni, and tech recruiters to reach 200-500 connections.'
    )
  } else if (visibility.connectionBracket === '200-499') {
    visScore -= 10
    penalties.visibility += 10
    addIssue(
      'low',
      'visibility',
      'Approaching the 500+ connections threshold',
      `At ${visibility.connectionsCount} connections, you are close to the "500+" badge recruiters subconsciously view as established.`,
      'A few weeks of consistent networking will place you into the 500+ tier.'
    )
  }

  if (!visibility.hasRecommendations) {
    visScore -= 15
    penalties.visibility += 15
    addIssue(
      'medium',
      'visibility',
      'No recommendations on profile',
      'Zero recommendations removes third-party social proof. Recruiters look for peer and manager endorsements.',
      'Request 1-2 brief recommendations from former leads or senior teammates highlighting collaboration and technical delivery.'
    )
  }

  if (!visibility.hasCustomUrl) {
    visScore -= 10
    penalties.visibility += 10
    addIssue(
      'low',
      'visibility',
      'LinkedIn URL is not customized',
      'An uncustomized alphanumeric URL looks unpolished on your resume and communication channels.',
      'Claim a clean custom URL in LinkedIn profile settings (e.g. linkedin.com/in/firstnamelastname).'
    )
  }

  if (targetRole && !headline.isMissing && !headline.targetRoleMatches) {
    visScore -= 15
    penalties.visibility += 15
    addIssue(
      'medium',
      'visibility',
      'Headline does not match target job role',
      `Targeting "${targetRole}" but headline does not contain target role keywords. Recruiters filtering for ${targetRole} will miss you.`,
      `Incorporate "${targetRole}" directly into your headline.`
    )
  }

  // ── 3. Profile Completeness (20%) ────────────────────────────────────────
  let compScore = 100
  if (!completeness.hasExperiences) {
    compScore -= 40
    penalties.completeness += 40
    addIssue(
      'high',
      'completeness',
      'No experience entries found',
      'An empty experience section prevents recruiter evaluation and eliminates experience keyword matching.',
      'Add your core employment history with structured bullet points.'
    )
  } else if (completeness.expWithDescription < Math.min(2, completeness.experienceCount)) {
    compScore -= 20
    penalties.completeness += 20
    addIssue(
      'medium',
      'completeness',
      'Experience entries lack detailed descriptions',
      'Multiple roles have empty or thin descriptions without technical context.',
      'Add 2-3 metric-driven bullets to each experience entry, matching your resume.'
    )
  }

  if (!completeness.hasEducation) {
    compScore -= 10
    penalties.completeness += 10
    addIssue(
      'low',
      'completeness',
      'Education section is empty',
      'Recruiter enterprise filters often filter by degree or institution.',
      'Add your highest academic qualification and institution.'
    )
  }

  if (completeness.skillsCount < 5) {
    compScore -= 20
    penalties.completeness += 20
    addIssue(
      'medium',
      'completeness',
      'Skills list is sparse',
      `Only ${completeness.skillsCount} skills listed. LinkedIn ranks candidates in recruiter searches based on skill match counts.`,
      'Add at least 10-15 key technical skills directly aligned with your target domain.'
    )
  } else if (completeness.skillsCount < 10) {
    compScore -= 10
    penalties.completeness += 10
    addIssue(
      'low',
      'completeness',
      'Skills list below optimal depth',
      `${completeness.skillsCount} skills listed. Top-ranking candidates typically feature 15-25 curated skills.`,
      'Add 5-10 additional relevant technologies to increase search keyword breadth.'
    )
  }

  // ── 4. Resume-LinkedIn Alignment & Consistency (25%) ─────────────────────
  let consistency = 100
  if (crossAnalysis?.hasResumeContext) {
    for (const disc of crossAnalysis.discrepancies || []) {
      const type = disc.type
      const severity = disc.severity || (['title_drift', 'timeline_drift', 'education_mismatch', 'company_typo_unlinked_logo'].includes(type) ? 'high' : 'medium')
      
      if (type === 'company_typo_unlinked_logo') {
        consistency -= 20
        penalties.consistency += 20
        addIssue(severity, 'consistency', disc.title, disc.diagnosis, disc.recommendation)
      } else if (type === 'title_drift') {
        consistency -= 20
        penalties.consistency += 20
        addIssue(severity, 'consistency', disc.title, disc.diagnosis, disc.recommendation)
      } else if (type === 'timeline_drift') {
        consistency -= 20
        penalties.consistency += 20
        addIssue(severity, 'consistency', disc.title, disc.diagnosis, disc.recommendation)
      } else if (type === 'education_mismatch') {
        consistency -= 15
        penalties.consistency += 15
        addIssue(severity, 'consistency', disc.title, disc.diagnosis, disc.recommendation)
      } else if (type === 'incomplete_education_major') {
        compScore -= 10
        penalties.completeness += 10
        addIssue(severity, 'completeness', disc.title, disc.diagnosis, disc.recommendation)
      } else if (type === 'missing_modern_projects') {
        consistency -= 15
        penalties.consistency += 15
        addIssue(severity, 'consistency', disc.title, disc.diagnosis, disc.recommendation)
      } else if (type === 'headline_wasted_opener') {
        branding -= 15
        penalties.branding += 15
        addIssue(severity, 'branding', disc.title, disc.diagnosis, disc.recommendation)
      } else if (type === 'zero_recommendations') {
        if (visibility.hasRecommendations) {
          visScore -= 15
          penalties.visibility += 15
          addIssue(severity, 'visibility', disc.title, disc.diagnosis, disc.recommendation)
        }
      } else if (type === 'role_omission') {
        consistency -= 15
        penalties.consistency += 15
        addIssue(severity, 'consistency', disc.title, disc.diagnosis, disc.recommendation)
      } else if (type === 'skill_gap') {
        consistency -= 15
        penalties.consistency += 15
        addIssue(severity, 'consistency', disc.title, disc.diagnosis, disc.recommendation)
      } else {
        consistency -= 10
        penalties.consistency += 10
        addIssue(severity, 'consistency', disc.title, disc.diagnosis, disc.recommendation)
      }
    }

    if (crossAnalysis.droppedImpact?.length > 0) {
      consistency -= 10
      penalties.consistency += 10
      const drop = crossAnalysis.droppedImpact[0]
      addIssue('medium', 'consistency', `Dropped Impact: Missing quantified proof at ${drop.company}`, drop.diagnosis, drop.recommendation)
    }
  }

  const scores = {
    branding: clamp(branding, 5, 100),
    visibility: clamp(visScore, 5, 100),
    completeness: clamp(compScore, 5, 100),
    alignment: clamp(consistency, 5, 100),
    consistency: clamp(consistency, 5, 100),
  }

  const CATEGORY_META = [
    { key: 'branding', label: 'Branding & Story', weight: 0.30 },
    { key: 'visibility', label: 'Search Visibility & SEO', weight: 0.25 },
    { key: 'completeness', label: 'Profile Completeness', weight: 0.20 },
    { key: 'alignment', label: 'Resume Alignment', weight: 0.25 },
  ]

  let overall = 0
  for (const m of CATEGORY_META) overall += scores[m.key] * m.weight
  // Floor with worst category so severe gaps reflect on the overall score
  const worst = Math.min(...CATEGORY_META.map((m) => scores[m.key]))
  overall = Math.min(overall, worst + 40)
  const score = round(clamp(overall, 5, 100))
  const { grade, label } = gradeFor(score)

  const grades = {}
  for (const m of CATEGORY_META) {
    const g = gradeFor(scores[m.key])
    grades[m.key] = {
      label: m.label,
      score: scores[m.key],
      grade: g.grade,
      gradeLabel: g.label,
      facts: [
        m.key === 'branding'
          ? (headline.isMissing ? 'Headline missing' : `${headline.wordCount} word headline`)
          : m.key === 'visibility'
          ? `${visibility.connectionsCount ?? 'Unknown'} connections`
          : m.key === 'completeness'
          ? `${completeness.experienceCount} experiences, ${completeness.skillsCount} skills`
          : crossAnalysis?.hasResumeContext
          ? `${crossAnalysis.discrepancies?.length || 0} cross-channel discrepancies`
          : 'Resume not provided for cross-comparison',
      ],
    }
  }

  const checks = [
    {
      id: 'li_headline',
      label: 'Search-Optimized Headline',
      status: !headline.isMissing && !headline.isTooShort ? 'pass' : headline.isTooShort ? 'warn' : 'fail',
      detail: headline.text ? `"${headline.text.slice(0, 50)}${headline.text.length > 50 ? '…' : ''}"` : 'Missing headline',
      category: 'branding',
    },
    {
      id: 'li_about',
      label: 'Story-Driven About Section',
      status: !about.isMissing && !about.isThin && about.hasMetrics ? 'pass' : !about.isMissing ? 'warn' : 'fail',
      detail: about.text ? `${about.length} chars${about.hasMetrics ? ', includes numbers' : ', no numbers'}` : 'Missing About section',
      category: 'branding',
    },
    {
      id: 'li_connections',
      label: '500+ Connection Network',
      status: visibility.connectionBracket === '500+' ? 'pass' : visibility.connectionBracket === '200-499' ? 'warn' : 'fail',
      detail: visibility.connectionsCount !== null ? `${visibility.connectionsCount} connections` : 'Connection count unavailable',
      category: 'visibility',
    },
    {
      id: 'li_recommendations',
      label: 'Peer Recommendations',
      status: visibility.hasRecommendations ? 'pass' : 'fail',
      detail: visibility.recommendationsCount !== null ? `${visibility.recommendationsCount} recommendation(s)` : 'None found',
      category: 'visibility',
    },
    {
      id: 'li_custom_url',
      label: 'Clean Custom Profile URL',
      status: visibility.hasCustomUrl ? 'pass' : 'warn',
      detail: visibility.profileUrl || 'Standard auto-generated URL',
      category: 'visibility',
    },
    {
      id: 'li_experience',
      label: 'Detailed Experience Descriptions',
      status: completeness.expWithDescription >= 2 ? 'pass' : completeness.expWithDescription >= 1 ? 'warn' : 'fail',
      detail: `${completeness.expWithDescription} of ${completeness.experienceCount} roles have detailed descriptions`,
      category: 'completeness',
    },
    {
      id: 'li_skills',
      label: 'Skills Bank Coverage',
      status: completeness.skillsCount >= 10 ? 'pass' : completeness.skillsCount >= 5 ? 'warn' : 'fail',
      detail: `${completeness.skillsCount} skills listed on LinkedIn`,
      category: 'completeness',
    },
    {
      id: 'li_title_align',
      label: 'Job Title & Company Alignment',
      status: (crossAnalysis?.discrepancies || []).some((d) => d.type === 'title_drift') ? 'fail' : 'pass',
      detail: crossAnalysis?.hasResumeContext ? 'Cross-checked against resume roles' : 'Resume context unavailable',
      category: 'consistency',
    },
    {
      id: 'li_timeline_align',
      label: 'Employment Timeline Consistency',
      status: (crossAnalysis?.discrepancies || []).some((d) => d.type === 'timeline_drift') ? 'fail' : 'pass',
      detail: crossAnalysis?.hasResumeContext ? 'Dates cross-checked against background check criteria' : 'Resume context unavailable',
      category: 'consistency',
    },
    {
      id: 'li_skills_align',
      label: 'Resume Skills Coverage on LinkedIn',
      status: (crossAnalysis?.missingSkills || []).length > 3 ? 'warn' : 'pass',
      detail: `${crossAnalysis?.missingSkills?.length || 0} verified resume skills missing on LinkedIn`,
      category: 'consistency',
    },
  ]

  return {
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

export default { computeLinkedInScorecard }
