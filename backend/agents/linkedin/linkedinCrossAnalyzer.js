/**
 * LinkedIn Cross-Agent Discrepancy Engine
 *
 * Compares normalized LinkedIn profile against Resume Agent's canonical facts:
 * 1. timelineMismatches: Checks if dates or company names contradict between Resume & LinkedIn
 * 2. titleDrift: Flags when LinkedIn title differs from target role or resume title
 * 3. skillGaps: Compares top verified skills on resume against LinkedIn skills
 * 4. droppedImpact: Checks if top quantified resume achievements are missing from LinkedIn descriptions
 *
 * 100% deterministic, zero LLM calls.
 */

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

  const resumeExperiences = Array.isArray(canonicalResume.experience)
    ? canonicalResume.experience
    : Array.isArray(canonicalResume.experiences)
    ? canonicalResume.experiences
    : []
  const linkedInExperiences = Array.isArray(profile.experiences) ? profile.experiences : []
  const linkedInSkills = Array.isArray(profile.skills) ? profile.skills : []
  const normalizedLinkedInSkills = new Set(linkedInSkills.map(normalizeSkill).filter(Boolean))

  // ── 1. Headline vs Target Role Title Drift ─────────────────────────────────
  if (targetRole && profile.headline) {
    const roleTokens = targetRole.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const hlLower = profile.headline.toLowerCase()
    const matches = roleTokens.filter((token) => hlLower.includes(token)).length
    if (roleTokens.length > 0 && matches === 0) {
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

  // ── 2. Experience Role, Company & Timeline Analysis ────────────────────────
  for (const rExp of resumeExperiences) {
    const rCompanyNorm = normalizeName(rExp.company)
    if (!rCompanyNorm) continue

    // Find matching company in LinkedIn experiences
    const lExp = linkedInExperiences.find((le) => {
      const lCompanyNorm = normalizeName(le.company)
      return (
        lCompanyNorm &&
        (rCompanyNorm.includes(lCompanyNorm) ||
          lCompanyNorm.includes(rCompanyNorm) ||
          rCompanyNorm.split(' ')[0] === lCompanyNorm.split(' ')[0])
      )
    })

    if (!lExp) {
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

    // Check Title Drift at this company
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

  // ── 4. Skill Coverage Gap Check ──────────────────────────────────────────
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

  for (const skill of resumeSkills) {
    const norm = normalizeSkill(skill)
    if (!norm) continue
    if (!normalizedLinkedInSkills.has(norm)) {
      if (!missingSkills.includes(skill)) {
        missingSkills.push(skill)
      }
    }
  }

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

  // ── 5. Missing Sections Check (Certifications, Projects / Featured, Education) ──
  // A. Resume Certifications Missing on LinkedIn
  const resumeCerts = Array.isArray(canonicalResume.certifications)
    ? canonicalResume.certifications
    : []
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

  // B. Verified Resume Projects Missing from LinkedIn Featured / Projects
  const resumeProjects = Array.isArray(canonicalResume.projects) ? canonicalResume.projects : []
  const linkedInProjects = Array.isArray(profile.projects) ? profile.projects : []

  if (resumeProjects.length > 0 && linkedInProjects.length === 0) {
    const projectNames = resumeProjects.map((p) => p.title || p.name).filter(Boolean).slice(0, 3).join(', ')
    const projectOmission = {
      id: `section_missing_projects_${missingSections.length + 1}`,
      type: 'missing_projects',
      severity: 'medium',
      title: 'Verified Technical Projects Missing from LinkedIn Featured',
      company: 'Featured Projects',
      resumeClaim: `${resumeProjects.length} key projects on resume (${projectNames || 'Technical Projects'})`,
      linkedinClaim: 'No featured projects or portfolio items found on profile',
      diagnosis: `Your resume highlights substantial technical projects (${projectNames || 'projects'}), but your LinkedIn profile has no Featured Projects or portfolio items pinned. Technical hiring managers scan the Featured section for architecture depth.`,
      recommendation: `Feature 2-3 of your top projects (${projectNames || 'projects'}) in your LinkedIn Featured section with GitHub links or live demos.`,
    }
    missingSections.push(projectOmission)
    discrepancies.push(projectOmission)
  }

  // C. Education Credentials Missing on LinkedIn
  const resumeEdu = Array.isArray(canonicalResume.education) ? canonicalResume.education : []
  const linkedInEdu = Array.isArray(profile.education) ? profile.education : []

  if (resumeEdu.length > 0 && linkedInEdu.length === 0) {
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
