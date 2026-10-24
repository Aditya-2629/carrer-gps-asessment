import { normalizeLinkedInProfile } from './linkedinNormalizer.js'

function normalizeName(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSkill(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\.js$/i, '')
    .replace(/js$/i, '')
    .replace(/[^\w]/g, '')
    .trim()
}

function extractYears(dateStr) {
  if (!dateStr) return []
  const matches = String(dateStr).match(/\b(19\d\d|20\d\d)\b/g)
  return matches ? matches.map((y) => parseInt(y, 10)) : []
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function getCompanySegments(comp) {
  if (!comp) return []
  const norm = normalizeName(comp)
  const parts = String(comp)
    .split(/[/|\\]/)
    .map(normalizeName)
    .filter(Boolean)
  return Array.from(new Set([norm, ...parts]))
}

function matchCompany(rComp, lComp) {
  if (!rComp || !lComp) return null
  const rNorm = normalizeName(rComp)
  const lNorm = normalizeName(lComp)
  if (!rNorm || !lNorm) return null

  // 1. Exact or substring match
  if (rNorm === lNorm || rNorm.includes(lNorm) || lNorm.includes(rNorm)) {
    return { matched: true, exact: rNorm === lNorm, diff: 0 }
  }

  // 2. Segment match (e.g. "It America / Abbott Laboratories" vs "Abbot Laboratories")
  const rSegs = getCompanySegments(rComp)
  const lSegs = getCompanySegments(lComp)
  for (const rs of rSegs) {
    for (const ls of lSegs) {
      if (rs === ls || rs.includes(ls) || ls.includes(rs)) {
        return { matched: true, exact: rs === ls, diff: 0 }
      }
      // Check word level Levenshtein
      const rWords = rs.split(' ').filter((w) => w.length >= 4)
      const lWords = ls.split(' ').filter((w) => w.length >= 4)
      for (const rw of rWords) {
        for (const lw of lWords) {
          const dist = levenshtein(rw, lw)
          if (dist > 0 && dist <= 2 && Math.max(rw.length, lw.length) >= 5) {
            return { matched: true, exact: false, diff: dist, rWord: rw, lWord: lw }
          }
        }
      }
    }
  }

  return null
}

const PRIORITY_TECH = [
  'LangGraph',
  'LangChain',
  'RAG',
  'ChromaDB',
  'FastAPI',
  'Spring AI',
  'Next.js',
  'TypeScript',
  'GraphQL',
  'Redis',
  'Kubernetes',
  'AWS',
  'Azure',
  'Docker',
  'PostgreSQL',
  'MongoDB',
  'Microservices',
  'REST APIs',
]

/**
 * Cross-analyzes a LinkedIn profile with the candidate's canonical resume.
 *
 * @param {Object} rawOrNormalizedProfile - raw scraped or normalized LinkedIn profile
 * @param {Object} resumeContext - { canonicalResume, extractedFacts, targetRole }
 * @param {Object} [linkedInSignals] - deterministic signals from linkedinSignalEngine
 * @returns {Object} Structured cross-agent discrepancy report
 */
export function analyzeCrossAgentDiscrepancies(rawOrNormalizedProfile = {}, resumeContext = {}, linkedInSignals = null) {
  const profile = rawOrNormalizedProfile?.isValid !== undefined
    ? rawOrNormalizedProfile
    : normalizeLinkedInProfile(rawOrNormalizedProfile)

  const canonicalResume = resumeContext?.canonicalResume || null
  const extractedFacts = resumeContext?.extractedFacts?.facts || []
  const targetRole = (
    resumeContext?.targetRole ||
    canonicalResume?.candidate?.targetRole ||
    ''
  ).trim()

  const timelineMismatches = []
  const titleDrift = []
  const skillGaps = []
  const droppedImpact = []
  const discrepancies = []
  const missingSkills = []
  const missingSections = []

  // ── 0. Visual & Trust Presence Audit ─────────────────────────────────────
  const hasPhoto = Boolean(profile.hasPicture && profile.pictureUrl)
  const hasBanner = Boolean(profile.hasBanner && profile.bannerUrl)
  const hasCustomUrl = Boolean(
    profile.hasCustomUrl ??
    (profile.url && /linkedin\.com\/in\/[a-zA-Z0-9_-]{3,35}\/?$/i.test(profile.url) && !/-\d{6,}/.test(profile.url))
  )
  const visualIssues = []

  if (!hasPhoto) {
    const photoObs = {
      id: 'visual_photo_missing',
      type: 'missing_profile_photo',
      severity: 'high',
      title: 'Missing Profile Photo (21x View Penalty)',
      resumeClaim: 'Professional Profile Presence',
      linkedinClaim: 'No profile picture detected (default / ghost avatar)',
      diagnosis: 'Profiles with a professional headshot receive up to 21x more views and 36x more recruiter messages. Operating without a profile photo triggers an immediate search penalty in LinkedIn algorithms.',
      recommendation: 'Upload a crisp, high-resolution headshot with soft lighting, solid contrast, and professional framing.',
    }
    visualIssues.push(photoObs)
    discrepancies.push(photoObs)
  }

  if (!hasBanner) {
    const bannerObs = {
      id: 'visual_banner_default',
      type: 'default_cover_banner',
      severity: 'medium',
      title: 'Default Gray Background Banner Detected',
      resumeClaim: targetRole || 'Target Career Positioning',
      linkedinClaim: 'Default LinkedIn gray pattern banner',
      diagnosis: 'Your profile still uses LinkedIn’s generic gray banner. The banner is prime visual real estate (1584x396px) seen above the fold that establishes your role focus, core stack, and engineering value proposition in the first 3 seconds.',
      recommendation: 'Design a branded Canva banner (1584x396px) featuring your target role, top 3-4 technologies, and a concise engineering tagline.',
    }
    visualIssues.push(bannerObs)
    discrepancies.push(bannerObs)
  }

  if (profile.url && !hasCustomUrl) {
    const urlObs = {
      id: 'visual_custom_url_missing',
      type: 'default_numeric_url',
      severity: 'low',
      title: 'Default Non-Custom Vanity URL (Trailing Numbers)',
      resumeClaim: 'Clean Professional Branding',
      linkedinClaim: profile.url || 'Default auto-generated URL with random numbers',
      diagnosis: 'Your public profile URL appears to be an uncustomized default with trailing alphanumeric numbers. Custom vanity URLs (linkedin.com/in/yourname) look cleaner on resumes, email signatures, and rank higher in search results.',
      recommendation: 'Edit your public profile URL in LinkedIn settings to claim a clean vanity slug (e.g., linkedin.com/in/firstnamelastname).',
    }
    visualIssues.push(urlObs)
    discrepancies.push(urlObs)
  }

  const connCount = profile.connectionsCount ?? linkedInSignals?.visibility?.connectionsCount ?? null
  if (connCount !== null && connCount !== undefined && typeof connCount === 'number' && connCount < 500) {
    const connObs = {
      id: 'trust_connections_under_500',
      type: 'low_connection_count',
      severity: 'medium',
      title: 'Under 500 Connections (<500 Badge)',
      resumeClaim: 'Established Professional Network',
      linkedinClaim: `${connCount} connections`,
      diagnosis: 'Profiles with fewer than 500 connections lack the "500+ connections" trust badge, signaling an inactive or newly created profile. Recruiter search algorithms give distribution preference to profiles in wider 2nd and 3rd degree networks.',
      recommendation: 'Expand your professional network past 500 by connecting with former colleagues, alumni, and peers in your target industry.',
    }
    visualIssues.push(connObs)
    discrepancies.push(connObs)
  }

  // Red Flag 7B: 0 Recommendations Despite Strong Network / Experience
  const recCount = profile.recommendationsCount ?? linkedInSignals?.visibility?.recommendationsCount ?? 0
  const rawResumeExperiences = Array.isArray(canonicalResume?.experience)
    ? canonicalResume.experience
    : Array.isArray(canonicalResume?.experiences)
    ? canonicalResume.experiences
    : []
  if (
    recCount === 0 &&
    (connCount >= 500 || (profile.experiences && profile.experiences.length >= 2) || rawResumeExperiences.length >= 2)
  ) {
    const zeroRecObs = {
      id: 'trust_zero_recommendations',
      type: 'zero_recommendations',
      severity: 'medium',
      title: '0 Recommendations Despite Established Enterprise Career',
      resumeClaim: `${rawResumeExperiences.length} verified enterprise roles`,
      linkedinClaim: `${connCount ? `${connCount}+` : '500+'} connections, 0 recommendations`,
      diagnosis: 'Your profile has strong connections and multiple engineering positions but zero recommendations. Public social proof from engineering managers or tech leads acts as a decisive trust signal for recruiters.',
      recommendation: 'Request 2-3 brief recommendations from former engineering managers or senior colleagues highlighting your technical delivery and team collaboration.',
    }
    visualIssues.push(zeroRecObs)
    discrepancies.push(zeroRecObs)
  }

  // ── 0B. Above-The-Fold About Hook Audit (<210 Characters) ─────────────────
  const rawAbout = (profile.about || '').trim()
  if (!rawAbout || rawAbout.length < 50) {
    const aboutMissingObs = {
      id: 'about_section_missing',
      type: 'missing_about_summary',
      severity: 'high',
      title: 'Missing or Minimal LinkedIn About Section',
      resumeClaim: targetRole || 'Target Career Narrative',
      linkedinClaim: 'About section is empty or under 50 characters',
      diagnosis: 'Your LinkedIn About summary is empty or minimal. The About section is the #1 narrative space recruiters read to understand your career trajectory, technical depth, and communication ability.',
      recommendation: 'Add a 3-paragraph conversational About narrative with a strong first-line hook, bulleted quantified wins, and an SEO Core Skills block.',
    }
    discrepancies.push(aboutMissingObs)
  } else {
    const foldText = rawAbout.slice(0, 210)
    const roleTokens = targetRole.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const hasRoleInFold = roleTokens.length === 0 || roleTokens.some((tok) => foldText.toLowerCase().includes(tok))
    const hasMetricInFold = /\d+[%xXkKMbB]?|\b\d+\b/.test(foldText)

    if (!hasRoleInFold || !hasMetricInFold) {
      const foldObs = {
        id: 'about_above_the_fold_weak',
        type: 'weak_above_the_fold_hook',
        severity: 'medium',
        title: 'Weak Above-The-Fold About Hook (<210 Characters)',
        resumeClaim: targetRole ? `${targetRole} with proven impact` : 'Direct Career Hook',
        linkedinClaim: `"${foldText.slice(0, 90)}..."`,
        diagnosis: 'On desktop LinkedIn, your About section is truncated behind a "...see more" fold after ~210 characters. Your first 210 characters currently lack either your target role or a concrete proof metric to compel recruiters to click and read further.',
        recommendation: 'Rewrite the opening 1-2 sentences of your About section to immediately state your target role and top scale metric before the fold.',
      }
      discrepancies.push(foldObs)
    }
  }

  const visualAudit = {
    hasPicture: hasPhoto,
    hasBanner,
    hasCustomUrl,
    connectionsCount: connCount,
    pictureUrl: profile.pictureUrl || null,
    bannerUrl: profile.bannerUrl || null,
    issues: visualIssues,
  }

  // If no resume is available, return empty cross-agent analysis with visual audit
  if (!canonicalResume) {
    return {
      hasResumeContext: false,
      timelineMismatches,
      timelineWarnings: [],
      titleDrift,
      skillGaps,
      droppedImpact,
      missingSections,
      visualAudit,
      discrepancies,
      missingSkills,
      summary: {
        total: discrepancies.length,
        high: discrepancies.filter((d) => d.severity === 'high').length,
        medium: discrepancies.filter((d) => d.severity === 'medium').length,
        low: discrepancies.filter((d) => d.severity === 'low').length,
        timelineMismatchesCount: 0,
        titleDriftCount: 0,
        skillGapsCount: 0,
        droppedImpactCount: 0,
        missingSkillsCount: 0,
        missingSectionsCount: 0,
      },
    }
  }

  const resumeExperiences = rawResumeExperiences
  const linkedInExperiences = Array.isArray(profile.experiences) ? profile.experiences : []
  const linkedInSkills = Array.isArray(profile.skills) ? profile.skills : []
  const normalizedLinkedInSkills = new Set(linkedInSkills.map(normalizeSkill).filter(Boolean))

  // ── 1. Headline vs Target Role Title Drift & Wasted Opener (Red Flag 7A) ───
  if (profile.headline) {
    const isWastedOpener =
      /^(actively\s+seeking|seeking|looking\s+for|open\s+to|searching\s+for|aspiring)\b/i.test(profile.headline.trim()) ||
      /\|\s*UCM\s*\|/i.test(profile.headline)

    if (isWastedOpener) {
      const wastedHlObs = {
        id: 'headline_wasted_prefix',
        type: 'headline_wasted_opener',
        severity: 'medium',
        title: 'Passive Job-Seeker Opener Wasting Prime Headline SEO (First 50 Chars)',
        resumeClaim: targetRole || 'Target Role Positioning',
        linkedinClaim: profile.headline,
        diagnosis:
          'Recruiters only see the first ~50–60 characters in search cards and mobile feeds. Leading with "Actively seeking..." or school acronyms instead of your target engineering role wastes prime SEO real estate and lowers click-through rate.',
        recommendation:
          'Lead immediately with your target title and core technical stack (e.g., "Senior Full Stack Software Developer | Java · Spring Boot · React · Microservices").',
      }
      titleDrift.push(wastedHlObs)
      discrepancies.push(wastedHlObs)
    }

    if (targetRole) {
      const roleTokens = targetRole.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
      const hlLower = profile.headline.toLowerCase()
      const matches = roleTokens.filter((token) => hlLower.includes(token)).length
      if (roleTokens.length > 0 && matches === 0 && !isWastedOpener) {
        const headlineObservation = {
          id: `drift_headline_001`,
          type: 'headline_target_drift',
          severity: 'medium',
          title: `Headline Diverges from Target Role ("${targetRole}")`,
          resumeClaim: targetRole,
          linkedinClaim: profile.headline,
          diagnosis: `Your resume is positioned toward "${targetRole}", but your LinkedIn headline reads "${profile.headline}". Recruiter boolean searches for "${targetRole}" will fail to index your profile.`,
          recommendation: `Align your headline with "${targetRole}" to maintain a single unified career narrative across all channels.`,
        }
        titleDrift.push(headlineObservation)
        discrepancies.push(headlineObservation)
      }
    }
  }

  // ── 2. Experience Role, Company & Timeline Analysis ────────────────────────
  for (const rExp of resumeExperiences) {
    let matchedExp = null
    let matchMeta = null
    for (const le of linkedInExperiences) {
      const match = matchCompany(rExp.company, le.company)
      if (match?.matched) {
        matchedExp = le
        matchMeta = match
        break
      }
    }

    if (!matchedExp) {
      // Role present on resume but omitted on LinkedIn
      if (rExp.isCurrent || (rExp.bullets && rExp.bullets.length >= 2)) {
        const omission = {
          id: `timeline_omission_${timelineMismatches.length + 1}`,
          type: 'role_omission',
          severity: 'medium',
          title: `Role at "${rExp.company}" missing from LinkedIn`,
          company: rExp.company,
          resumeClaim: `${rExp.role} (${rExp.dates || `${rExp.startDate || ''} - ${rExp.endDate || ''}` || 'Dates not specified'})`,
          linkedinClaim: 'Not listed in LinkedIn experience section',
          diagnosis: `Your resume highlights experience at ${rExp.company} as ${rExp.role}, but this position is completely absent from your LinkedIn profile. Cross-channel verification flags missing employment records as inconsistencies.`,
          recommendation: `Add the ${rExp.role} role at ${rExp.company} to your LinkedIn profile with matching dates.`,
        }
        timelineMismatches.push(omission)
        discrepancies.push(omission)
      }
      continue
    }

    const lExp = matchedExp

    // Red Flag 1: Company Name Typo & Missing Logo
    const hasSpellingMismatch = matchMeta?.diff > 0
    const hasNullLogo = lExp.companyLogo === null
    if (hasSpellingMismatch || hasNullLogo) {
      const typoObs = {
        id: `company_typo_${timelineMismatches.length + 1}`,
        type: 'company_typo_unlinked_logo',
        severity: 'high',
        title: 'Company Name Typo & Missing Official Logo on LinkedIn',
        company: rExp.company,
        resumeClaim: rExp.company,
        linkedinClaim: `${lExp.company}${hasNullLogo ? ' (Unlinked Company Page — Grey Placeholder Logo)' : ''}`,
        diagnosis: `Misspelling the employer name on LinkedIn ("${lExp.company}" vs "${rExp.company}") prevents LinkedIn from binding the official company page entity and leaves a generic placeholder logo, immediately raising authenticity flags during recruiter screening.`,
        recommendation: `Fix the spelling to match the official LinkedIn Company Page ("${rExp.company}") and select the verified organization from the dropdown so the official logo renders.`,
      }
      timelineMismatches.push(typoObs)
      discrepancies.push(typoObs)
    }

    // Red Flag 2: Check Title Drift at this company
    const rRoleNorm = normalizeName(rExp.role)
    const lRoleNorm = normalizeName(lExp.title)
    if (rRoleNorm && lRoleNorm && rRoleNorm !== lRoleNorm) {
      const rTokens = rRoleNorm.split(' ').filter((w) => w.length > 1)
      const lTokens = lRoleNorm.split(' ').filter((w) => w.length > 1)
      const common = rTokens.filter((t) => lTokens.includes(t))
      const matchRatio = common.length / Math.max(rTokens.length, lTokens.length, 1)

      const SENIORITY = ['senior', 'sr', 'lead', 'staff', 'principal', 'head', 'director', 'manager', 'architect', 'vp', 'junior', 'jr', 'intern']
      const rHasSeniority = rTokens.some((t) => SENIORITY.includes(t))
      const lHasSeniority = lTokens.some((t) => SENIORITY.includes(t))
      const seniorityMismatch = rHasSeniority !== lHasSeniority

      if (matchRatio < 0.75 || seniorityMismatch) {
        const titleObs = {
          id: `title_drift_${titleDrift.length + 1}`,
          type: 'title_drift',
          severity: 'high',
          title: `Job Title Mismatch at "${rExp.company}"`,
          company: rExp.company,
          resumeClaim: rExp.role,
          linkedinClaim: lExp.title,
          diagnosis: `Your resume lists your title as "${rExp.role}", while LinkedIn displays "${lExp.title}". Discrepant job titles across channels trigger background check scrutiny and make recruiters question seniority or role accuracy.`,
          recommendation: `Synchronize the job title at ${rExp.company} across both documents. Use "${rExp.role}" on both to maintain consistency.`,
        }
        titleDrift.push(titleObs)
        discrepancies.push(titleObs)
      }
    }

    // Check Timeline Drift
    const rRawDates = rExp.dates || `${rExp.startDate || ''} - ${rExp.endDate || ''}`
    const rYears = extractYears(rRawDates)
    const lYears = extractYears(lExp.dates)
    if (rYears.length > 0 && lYears.length > 0) {
      const rStart = rYears[0]
      const lStart = lYears[0]
      if (Math.abs(rStart - lStart) >= 1) {
        const timelineObs = {
          id: `timeline_drift_${timelineMismatches.length + 1}`,
          type: 'timeline_drift',
          severity: 'high',
          title: `Employment Timeline Drift at "${rExp.company}"`,
          company: rExp.company,
          resumeClaim: rExp.dates || `${rStart}`,
          linkedinClaim: lExp.dates || `${lStart}`,
          diagnosis: `Start year at ${rExp.company} differs between Resume (${rStart}) and LinkedIn (${lStart}). Automated employment verification and recruiter screenings flag differing employment spans as high-risk discrepancies.`,
          recommendation: `Align the start and end dates for ${rExp.company} exactly across your resume and LinkedIn profile.`,
        }
        timelineMismatches.push(timelineObs)
        discrepancies.push(timelineObs)
      }
    }

    // ── 3. Dropped Impact Check ─────────────────────────────────────────────
    const rBullets = Array.isArray(rExp.bullets) ? rExp.bullets : []
    const quantifiedBullets = rBullets.filter((b) => /\d+[%xXkKMbB]?|\b\d+\b/.test(b.text || ''))
    const lDesc = (lExp.description || '').trim()
    const lHasMetrics = /\d+[%xXkKMbB]?|\b\d+\b/.test(lDesc)

    if (quantifiedBullets.length > 0 && (!lDesc || lDesc.length < 60 || !lHasMetrics)) {
      const topBullet = quantifiedBullets[0].text
      const impactObs = {
        id: `drop_${droppedImpact.length + 1}`,
        type: 'dropped_impact',
        severity: 'medium',
        title: `Unquantified / Missing Role Description at "${rExp.company}"`,
        company: rExp.company,
        role: rExp.role,
        sampleResumeProof: topBullet,
        diagnosis: `Your resume features strong quantified impact at ${rExp.company} ("${topBullet.slice(0, 100)}..."), but your LinkedIn description for this role is ${!lDesc ? 'completely empty' : 'missing hard metrics'}. Recruiters scanning LinkedIn see claims without evidence.`,
        recommendation: `Transfer 2-3 of your best outcome-driven bullets from your resume directly into the LinkedIn description for ${rExp.company}.`,
      }
      droppedImpact.push(impactObs)
      discrepancies.push(impactObs)
    }
  }

  // ── 4. Skill Coverage Gap Check & Prioritized Tech (Red Flag 6) ────────────
  const resumeSkills = []
  if (Array.isArray(canonicalResume.skills)) {
    for (const s of canonicalResume.skills) {
      const name = typeof s === 'string' ? s : s?.name
      if (name && !resumeSkills.includes(name)) resumeSkills.push(name)
    }
  }
  for (const fact of extractedFacts) {
    if (fact.factType === 'TECHNOLOGY' && fact.value) {
      if (!resumeSkills.includes(fact.value)) resumeSkills.push(fact.value)
    }
  }

  // Also scan projects and experiences for priority technologies
  for (const p of canonicalResume.projects || []) {
    for (const t of p.technologies || p.skills || []) {
      if (!resumeSkills.includes(t)) resumeSkills.push(t)
    }
    for (const b of p.bullets || []) {
      const text = typeof b === 'string' ? b : b.text || ''
      for (const pt of PRIORITY_TECH) {
        const regex = new RegExp(`\\b${pt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (regex.test(text) && !resumeSkills.includes(pt)) {
          resumeSkills.push(pt)
        }
      }
    }
  }
  for (const e of canonicalResume.experience || canonicalResume.experiences || []) {
    for (const b of e.bullets || []) {
      const text = typeof b === 'string' ? b : b.text || ''
      for (const pt of PRIORITY_TECH) {
        const regex = new RegExp(`\\b${pt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (regex.test(text) && !resumeSkills.includes(pt)) {
          resumeSkills.push(pt)
        }
      }
    }
  }

  for (const skill of resumeSkills) {
    const norm = normalizeSkill(skill)
    if (!norm) continue
    if (!normalizedLinkedInSkills.has(norm)) {
      if (!missingSkills.includes(skill)) {
        missingSkills.push(skill)
      }
    }
  }

  // Sort missing skills so modern in-demand technologies are at the top
  missingSkills.sort((a, b) => {
    const aPri = PRIORITY_TECH.some((pt) => pt.toLowerCase() === a.toLowerCase()) ? 1 : 0
    const bPri = PRIORITY_TECH.some((pt) => pt.toLowerCase() === b.toLowerCase()) ? 1 : 0
    return bPri - aPri
  })

  if (missingSkills.length >= 3) {
    const topMissingPreview = missingSkills.slice(0, 5).join(', ')
    const skillGapObs = {
      id: `skill_gap_${skillGaps.length + 1}`,
      type: 'skill_gap',
      severity: missingSkills.length >= 6 ? 'high' : 'medium',
      title: `${missingSkills.length} Verified Resume Skills Missing from LinkedIn`,
      company: 'Skills Bank',
      resumeClaim: `${resumeSkills.length} verified technical skills`,
      linkedinClaim: `${linkedInSkills.length} listed LinkedIn skills`,
      diagnosis: `Your resume demonstrates proficiency in core technologies (${topMissingPreview}) that are not in your LinkedIn Skills bank. Recruiter search algorithms rank candidates directly by exact skills matches.`,
      recommendation: `Add the top missing skills (${topMissingPreview}) to your LinkedIn Skills section and pin the top 3 relevant to ${targetRole || 'your target role'}.`,
    }
    skillGaps.push(skillGapObs)
    discrepancies.push(skillGapObs)
  }

  // ── 5. Missing Sections Check (Projects, Education, Certifications) ───────
  // Red Flag 3: Projects Check
  const resumeProjects = Array.isArray(canonicalResume.projects) ? canonicalResume.projects : []
  const linkedInProjects = Array.isArray(profile.projects) ? profile.projects : []

  if (resumeProjects.length > 0) {
    const isProjectMatch = (rp, lp) => {
      const rTitle = normalizeName(rp.title || rp.name)
      const lTitle = normalizeName(lp.title || lp.name)
      if (!rTitle || !lTitle) return false
      if (rTitle === lTitle || rTitle.includes(lTitle) || lTitle.includes(rTitle)) return true
      const rWords = rTitle.split(' ').filter((w) => w.length >= 4)
      const lWords = lTitle.split(' ').filter((w) => w.length >= 4)
      const common = rWords.filter((w) => lWords.includes(w))
      return common.length >= 2
    }

    const missingModernProjects = resumeProjects.filter((rp) => !linkedInProjects.some((lp) => isProjectMatch(rp, lp)))

    if (missingModernProjects.length > 0) {
      const projectNames = missingModernProjects.map((p) => p.title || p.name).filter(Boolean).slice(0, 3).join(', ')
      const projectOmission = {
        id: `section_missing_projects_${missingSections.length + 1}`,
        type: 'missing_modern_projects',
        severity: 'high',
        title: `Top Resume Projects Missing from LinkedIn (${projectNames})`,
        company: 'Featured Projects',
        resumeClaim: `Key verified technical projects: ${projectNames}`,
        linkedinClaim: linkedInProjects.length > 0
          ? `Only older / legacy projects listed (${linkedInProjects.map((p) => p.title || p.name).slice(0, 3).join(', ')})`
          : 'No matching projects found on LinkedIn profile',
        diagnosis:
          'Recruiters checking LinkedIn only see outdated academic/legacy projects while your strongest modern engineering projects from the resume are completely absent from your LinkedIn Projects and Featured sections.',
        recommendation: `Add your top modern resume projects (${projectNames}) to your LinkedIn Projects and Featured sections with GitHub links and architecture overviews.`,
      }
      const omissionType = linkedInProjects.length === 0 ? 'missing_projects' : 'missing_modern_projects'
      missingSections.push({ ...projectOmission, type: omissionType })
      discrepancies.push(projectOmission)
    }
  }

  // Red Flag 4 & 5: Education Discrepancies
  const resumeEdu = Array.isArray(canonicalResume.education) ? canonicalResume.education : []
  const linkedInEdu = Array.isArray(profile.education) ? profile.education : []

  if (linkedInEdu.length > 0 && resumeEdu.length > 0) {
    for (const lEdu of linkedInEdu) {
      const lSchoolNorm = normalizeName(lEdu.school)
      if (!lSchoolNorm) continue

      const matchedResumeEdu = resumeEdu.find((re) => {
        const rSchoolNorm = normalizeName(re.institution || re.school || re.degree)
        return (
          rSchoolNorm &&
          (rSchoolNorm.includes(lSchoolNorm) ||
            lSchoolNorm.includes(rSchoolNorm) ||
            rSchoolNorm.split(' ')[0] === lSchoolNorm.split(' ')[0])
        )
      })

      if (!matchedResumeEdu) {
        // Red Flag 4: Unlisted LinkedIn Degree Missing from Resume
        const rSummary =
          resumeEdu.map((e) => e.institution || e.school || e.degree).filter(Boolean).join(', ') || 'Listed resume education'
        const unlistedEduObs = {
          id: `edu_unlisted_${missingSections.length + 1}`,
          type: 'education_mismatch',
          severity: 'high',
          title: `Unlisted LinkedIn Degree / Institution ("${lEdu.school}") Missing from Resume`,
          company: 'Education',
          resumeClaim: rSummary,
          linkedinClaim: `${lEdu.degree || 'Degree'}${lEdu.fieldOfStudy ? ` (${lEdu.fieldOfStudy})` : ''} at ${lEdu.school} (${lEdu.dates || 'Dates unlisted'})`,
          diagnosis: `Having an active or doctoral program (${lEdu.degree || 'Degree'} at ${lEdu.school}) on LinkedIn that is omitted from the resume triggers immediate recruiter confusion regarding student status, work authorization (CPT/OPT), and full-time availability.`,
          recommendation: `Align your academic timeline across both documents. If this is an active degree program, state it consistently or provide context on your full-time availability.`,
        }
        missingSections.push(unlistedEduObs)
        discrepancies.push(unlistedEduObs)
      } else {
        // Red Flag 5: Incomplete Education Metadata on LinkedIn — Missing fieldOfStudy
        const hasFieldOfStudy = Boolean(lEdu.fieldOfStudy && lEdu.fieldOfStudy.trim())
        const degreeHasField = /\b(computer science|engineering|software|electrical|data|information|business|mathematics)\b/i.test(lEdu.degree || '')
        if (!hasFieldOfStudy && !degreeHasField) {
          const missingFieldObs = {
            id: `edu_missing_field_${missingSections.length + 1}`,
            type: 'incomplete_education_major',
            severity: 'medium',
            title: `Missing Field of Study for ${lEdu.degree || 'Degree'} at ${lEdu.school}`,
            company: 'Education',
            resumeClaim: matchedResumeEdu.degree || 'Bachelor\'s with specified major',
            linkedinClaim: `Degree: "${lEdu.degree}", Field of Study: Not Specified (null)`,
            diagnosis: `Leaving the Field of Study blank prevents LinkedIn Recruiter filters for technical degrees (e.g. Computer Science, Electrical Engineering) from qualifying your profile.`,
            recommendation: `Edit the education entry for ${lEdu.school} on LinkedIn to explicitly set the Field of Study.`,
          }
          missingSections.push(missingFieldObs)
          discrepancies.push(missingFieldObs)
        }
      }
    }
  } else if (resumeEdu.length > 0 && linkedInEdu.length === 0) {
    const institutions = resumeEdu.map((e) => e.institution || e.school).filter(Boolean).join(', ')
    const degree = resumeEdu[0]?.degree || 'Degree'
    const eduOmission = {
      id: `section_missing_education_${missingSections.length + 1}`,
      type: 'missing_education',
      severity: 'medium',
      title: 'Education Section Missing or Incomplete on LinkedIn',
      company: 'Education',
      resumeClaim: `${degree} from ${institutions || 'University'}`,
      linkedinClaim: 'No education entries listed on LinkedIn profile',
      diagnosis: `Your resume lists degrees from ${institutions || 'University'}, but your LinkedIn Education section is absent. Many recruiter automated screening pipelines filter strictly on verified education credentials.`,
      recommendation: `Add your complete education background (${institutions || 'University'}) to your LinkedIn profile.`,
    }
    missingSections.push(eduOmission)
    discrepancies.push(eduOmission)
  }

  // Certifications
  const resumeCerts = Array.isArray(canonicalResume.certifications) ? canonicalResume.certifications : []
  const linkedInCerts = Array.isArray(profile.certifications) ? profile.certifications : []

  if (resumeCerts.length > 0) {
    const missingCerts = resumeCerts.filter((rc) => {
      const rName = normalizeName(rc.name || rc.title)
      if (!rName) return false
      return !linkedInCerts.some((lc) => {
        const lName = normalizeName(lc.name || lc.title)
        return lName && (lName.includes(rName) || rName.includes(lName))
      })
    })

    if (missingCerts.length > 0) {
      const certNames = missingCerts.map((c) => c.name || c.title).slice(0, 3).join(', ')
      const certOmission = {
        id: `section_missing_cert_${missingSections.length + 1}`,
        type: 'missing_certifications',
        severity: 'medium',
        title: `${missingCerts.length} Verified Resume Certification${missingCerts.length > 1 ? 's' : ''} Missing from LinkedIn`,
        company: 'Licenses & Certifications',
        resumeClaim: `${resumeCerts.length} verified certification(s) (${certNames})`,
        linkedinClaim: linkedInCerts.length === 0 ? 'Licenses & Certifications section is empty' : `${linkedInCerts.length} listed certification(s)`,
        diagnosis: `Your resume demonstrates verified credentials (${certNames}) that are missing from your LinkedIn Licenses & Certifications section. Certifications are actively indexed by recruiter search filters.`,
        recommendation: `Add ${certNames} to your LinkedIn Licenses & Certifications section with issuing authorities and credential URLs.`,
      }
      missingSections.push(certOmission)
      discrepancies.push(certOmission)
    }
  }

  const timelineWarnings = [...timelineMismatches]

  const summary = {
    total: discrepancies.length + droppedImpact.length,
    high: discrepancies.filter((d) => d.severity === 'high').length,
    medium: discrepancies.filter((d) => d.severity === 'medium').length,
    low: discrepancies.filter((d) => d.severity === 'low').length,
    timelineMismatchesCount: timelineMismatches.length,
    timelineWarningsCount: timelineWarnings.length,
    titleDriftCount: titleDrift.length,
    skillGapsCount: skillGaps.length,
    droppedImpactCount: droppedImpact.length,
    missingSkillsCount: missingSkills.length,
    missingSectionsCount: missingSections.length,
  }

  return {
    hasResumeContext: true,
    timelineMismatches,
    timelineWarnings,
    titleDrift,
    skillGaps,
    droppedImpact,
    missingSections,
    visualAudit,
    discrepancies,
    missingSkills: missingSkills.slice(0, 10),
    summary,
  }
}

export default { analyzeCrossAgentDiscrepancies }

