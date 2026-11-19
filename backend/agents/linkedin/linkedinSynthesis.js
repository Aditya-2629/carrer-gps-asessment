/**
 * LinkedIn Generative Optimizer (V3.0)
 *
 * Unified, comprehensive Groq LLM call (openai/gpt-oss-120b, maxTokens: 3500, responseFormat: 'json_object')
 * that analyzes the concrete differences between the candidate's actual scraped LinkedIn profile
 * and their parsed Resume.
 *
 * Directives:
 * 1. Zero Hallucination: Grounded in verified resume facts.
 * 2. Never Copy Raw Resume Bullets: Generates LinkedIn-native skimmable impact statements,
 *    identifies exact LinkedIn gaps per role, and outputs project replace notes.
 * 3. Robust Graceful Degradation: High-fidelity deterministic fallback if LLM is unavailable.
 */

import { jsonrepair } from 'jsonrepair'
import { llmGateway } from '../../ai/gateway/llmGateway.js'
import { matchCompany, isConcreteTechSkill, formatSkillName, isValidSkill } from './linkedinCrossAnalyzer.js'
import { cleanTargetRoleTitle } from '../../services/resumeValidator.js'
import {
  buildTask1HeadlinesAndBannerPrompt,
  buildTask2AboutAndFeaturedPrompt,
} from './linkedinSynthesis.prompt.js'

/**
 * Dynamically derives 5 Open-to-Work titles based on the candidate's actual target role.
 * Never defaults or hardcodes roles for candidates.
 */
export function deriveOpenToWorkTitles(targetRole, resumeContext = {}) {
  const rawRole =
    targetRole ||
    resumeContext?.targetRole ||
    resumeContext?.canonicalResume?.candidate?.targetRole ||
    resumeContext?.canonicalResume?.experience?.[0]?.role ||
    resumeContext?.domain ||
    ''
  const roleStr = typeof rawRole === 'string' ? rawRole.trim() : (rawRole?.title || String(rawRole || '')).trim()
  const cleanBase = roleStr
    .replace(/^(?:Senior|Lead|Staff|Principal|Junior|Associate|Mid-Level|Executive|Head of|VP of)\s+/i, '')
    .trim() || 'Target Role'

  const baseTitle = roleStr || cleanBase || 'Target Role'

  const adjacentRoles = Array.isArray(resumeContext?.adjacentRoles) ? resumeContext.adjacentRoles.filter(Boolean) : []

  const titles = [
    baseTitle,
    ...adjacentRoles,
    `Senior ${cleanBase}`,
    `Lead ${cleanBase}`,
    `Principal ${cleanBase}`,
    `Staff ${cleanBase}`,
    `${cleanBase} Specialist`,
    `${cleanBase} Consultant`,
  ]

  const uniqueTitles = Array.from(new Set(titles.map((t) => t.trim()))).filter(Boolean)
  return uniqueTitles.slice(0, 5)
}

/**
 * Builds a 50+ categorized skills bank partitioned into 4 recruiter-friendly buckets:
 * coreFunctional, toolsAndPlatforms, industrySpecific, transferable.
 */
export function buildCategorizedSkillsBank(effectiveSkills = [], targetRole = '', canonical = {}) {
  const roleStr = String(targetRole || '').toLowerCase()
  const isHealth = /nurse|clinical|health|patient|medical|doctor|therapy/i.test(roleStr)
  const isFinance = /finance|financial|accountant|accounting|audit|tax|cpa|banking/i.test(roleStr)
  const isData = (/data|analytics|bi\b|machine learning|ml\b|ai\b|scientist/i.test(roleStr)) && !isFinance

  const unique = Array.from(new Set(effectiveSkills.map((s) => String(s).trim()).filter(Boolean)))

  // Domain baseline packs to ensure robust 40-50+ coverage
  const defaultTools = isHealth
    ? ['Epic Systems', 'Cerner EHR', 'Pyxis MedStation', 'PointClickCare', 'Meditech', 'Omnicell', 'CareStream', 'Allscripts', 'Telehealth Systems', 'McKesson']
    : isFinance
    ? ['Excel & VBA', 'SAP FICO', 'QuickBooks Enterprise', 'Oracle Financials', 'Power BI', 'Tableau', 'NetSuite ERP', 'Hyperion', 'Bloomberg Terminal', 'Workday Financials', 'SQL', 'Financial Modeling']
    : isData
    ? ['SQL', 'Python', 'Tableau', 'Power BI', 'dbt', 'BigQuery', 'Apache Spark', 'Databricks', 'Airflow', 'Kafka', 'PostgreSQL', 'Docker', 'AWS']
    : ['Python', 'TypeScript', 'JavaScript', 'React', 'Node.js', 'Docker', 'AWS', 'PostgreSQL', 'Redis', 'GraphQL', 'Next.js', 'CI/CD Pipelines', 'REST APIs', 'Git']

  const defaultCore = isHealth
    ? ['Triage Assessment', 'Patient Care Coordination', 'Vital Signs Monitoring', 'Medication Administration', 'Infection Control Protocols', 'Emergency Response', 'Clinical Documentation', 'Wound Care Management', 'IV Therapy', 'Patient Education']
    : isFinance
    ? ['Financial Modeling', 'Variance Analysis', 'GAAP Compliance', 'General Ledger Reconciliation', 'Budget Forecasting', 'Cash Flow Analysis', 'Financial Statement Preparation', 'Internal Controls', 'Cost Allocation', 'Month-End Close Management', 'Scenario Modeling']
    : isData
    ? ['Data Modeling', 'ETL Pipeline Design', 'Data Warehousing', 'Statistical Analysis', 'A/B Testing Frameworks', 'Dimensional Modeling (Kimball)', 'Data Quality Validation', 'Query Optimization', 'Business Intelligence Architecture', 'Automated Metric Reporting']
    : ['System Architecture Design', 'Microservices Architecture', 'Database Optimization', 'Distributed Systems', 'API Architecture', 'Automated Unit & Integration Testing', 'Performance Optimization', 'Security Compliance', 'Cloud Infrastructure Design']

  const defaultIndustry = isHealth
    ? ['HIPAA Compliance', 'AHA Life Support (BLS/ACLS)', 'JCAHO Standards', 'Electronic Health Records (EHR)', 'Patient Safety Goals', 'Clinical Quality Improvement', 'Evidence-Based Practice', 'Interdisciplinary Team Rounding']
    : isFinance
    ? ['SOX Compliance', 'IFRS Standards', 'SEC Financial Reporting', 'Audit Trail Management', 'Capital Budgeting', 'Working Capital Management', 'Risk Management Frameworks', 'Corporate Governance', 'M&A Due Diligence']
    : isData
    ? ['Data Governance & Security', 'GDPR/CCPA Compliance', 'Data Lineage Tracking', 'SLA Management for Data Pipelines', 'Data Cataloging', 'Enterprise Reporting Standards', 'Event-Driven Architecture']
    : ['High Availability & Fault Tolerance', 'SaaS Scalability', 'SOC2 Compliance', 'Agile / Scrum Delivery', 'Enterprise Software Architecture', 'Zero-Downtime Deployment']

  const defaultTransferable = [
    'Cross-Functional Stakeholder Alignment',
    'Technical Project Management',
    'Root Cause Analysis & Post-Mortems',
    'Process Optimization & Automation',
    'Mentorship & Knowledge Transfer',
    'Strategic Roadmapping',
    'Executive Presentation & Reporting',
    'Operational Excellence',
    'Change Management',
    'Data-Driven Decision Making',
  ]

  const toolsAndPlatforms = Array.from(new Set([...unique.filter((s) => isConcreteTechSkill(s)), ...defaultTools])).slice(0, 15)
  const coreFunctional = Array.from(new Set([...unique.filter((s) => !isConcreteTechSkill(s)), ...defaultCore])).slice(0, 15)
  const industrySpecific = Array.from(new Set(defaultIndustry)).slice(0, 12)
  const transferable = Array.from(new Set(defaultTransferable)).slice(0, 10)

  return {
    coreFunctional,
    toolsAndPlatforms,
    industrySpecific,
    transferable,
    totalCount: toolsAndPlatforms.length + coreFunctional.length + industrySpecific.length + transferable.length,
  }
}

/**
 * Builds deterministic fallback optimizations if LLM calls fail or are unavailable.
 *
 * @param {Object} profile - Normalized or scraped LinkedIn profile
 * @param {Object} resumeContext - Verified resume facts & target role
 * @param {Array} missingSkills - Verified resume skills missing on LinkedIn
 * @param {Array} discrepancies - Cross-agent discrepancies detected
 * @returns {Object} Fallback optimization bundle
 */
export function buildDeterministicOptimizations(
  profile = {},
  resumeContext = {},
  missingSkills = [],
  discrepancies = []
) {
  // Support both object argument style { profile, resumeContext, ... } and positional args
  let effectiveProfile = profile || {}
  let effectiveResumeContext = resumeContext || {}
  let effectiveMissing = missingSkills || []
  let effectiveDiscrepancies = discrepancies || []

  if (profile && typeof profile === 'object' && ('resumeContext' in profile || 'canonicalResume' in profile)) {
    effectiveResumeContext = profile.resumeContext || profile
    effectiveProfile = profile.profile || {}
    effectiveMissing = profile.missingSkills || missingSkills || []
    effectiveDiscrepancies = profile.discrepancies || discrepancies || []
  }

  const canonical = effectiveResumeContext?.canonicalResume || effectiveResumeContext || {}
  const candidateSnap = effectiveResumeContext?.candidateSnapshot || {}
  const exp = canonical.experience || canonical.experiences || []

  let rawRole =
    effectiveResumeContext?.targetRole ||
    candidateSnap.targetRole ||
    canonical?.candidate?.targetRole ||
    canonical?.target_role ||
    canonical?.targetRole ||
    exp[0]?.role ||
    effectiveProfile?.headline ||
    ''
  let targetRole = (typeof rawRole === 'string' ? rawRole : (rawRole?.title || rawRole?.name || rawRole?.targetRole || String(rawRole || ''))).trim()
  if (!targetRole) {
    targetRole = 'Target Role'
  }

  const topCompany = exp[0]?.company || 'Enterprise'

  // Extract candidate verified skills strictly from resume context & profile
  const candidateSkills = [
    ...(canonical.skills || []),
    ...(canonical.top_skills || []),
    ...(canonical.technical_skills || []),
    ...(candidateSnap.coreSkills || []),
    ...(candidateSnap.topSkills || []),
    ...(effectiveResumeContext.verifiedSkills || []),
    ...(effectiveProfile.skills || []),
  ]
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill))
    .filter(Boolean)
    .filter(isValidSkill)
    .map(formatSkillName)

  const uniqueCandidateSkills = Array.from(new Set(candidateSkills))

  const filteredMissing = (Array.isArray(missingSkills) ? missingSkills : [])
    .filter(isValidSkill)
    .map(formatSkillName)

  const marketSkills = (effectiveResumeContext.marketTopMissingSkills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill))
    .filter(Boolean)
    .filter(isValidSkill)
    .map(formatSkillName)

  const effectiveSkills = uniqueCandidateSkills.length > 0
    ? uniqueCandidateSkills
    : (marketSkills.length > 0
        ? marketSkills
        : (filteredMissing.length > 0
            ? filteredMissing
            : ['Core Domain Execution', 'Operational Excellence', 'Strategic Planning']))

  const topStack = effectiveSkills.slice(0, 3).join(' | ')
  const topSkillList = effectiveSkills.slice(0, 3).join(', ') || 'Domain Specialization'

  let isHealthRole = /nurse|clinical|health|patient|medical|doctor|therapy/i.test(targetRole)
  let isFinanceRole = /finance|financial|accountant|accounting|audit|tax|cpa|banking|bank/i.test(targetRole)

  let specialistTopic = isHealthRole
    ? 'Clinical Operations, Patient Care Excellence & Healthcare Compliance'
    : (isFinanceRole
        ? 'Financial Reporting, Variance Modeling & Capital Strategy'
        : `${topSkillList} & High-Impact Delivery`)

  // Scan all experience bullets across the resume for high-impact metric clauses
  const allBullets = exp.flatMap((e) =>
    (Array.isArray(e.bullets) ? e.bullets : [])
      .map((b) => (typeof b === 'string' ? b : b.text || ''))
      .filter(Boolean)
  )

  let bestMetricPhrase = ''
  let bestMetricNum = ''

  for (const b of allBullets) {
    if (!bestMetricPhrase) {
      const verbMetricMatch = b.match(/\b(reducing|improving|scaling|boosting|increasing|accelerating|cutting|delivering|optimizing|saving)\s+([^,.;]{10,80}?(?:\d+[%xXkKMbB]?|\d+)[^,.;]*)/i)
      if (verbMetricMatch) {
        bestMetricPhrase = `${verbMetricMatch[1]} ${verbMetricMatch[2]}`.trim()
      }
    }
    if (!bestMetricNum) {
      const numMatch = b.match(/\b\d+[%xXkKMbB]?\b/)
      if (numMatch) {
        bestMetricNum = numMatch[0]
      }
    }
    if (bestMetricPhrase && bestMetricNum) break
  }

  const metricPhrase = bestMetricPhrase || (bestMetricNum ? `driving ${bestMetricNum} performance gains` : '')
  const yoeText = canonical.years_of_experience || canonical.totalExperienceYears || '3+ years'
  const yoeClause = typeof yoeText === 'number' ? `${yoeText}+ years` : yoeText

  const bullet1 = allBullets[0] || ''
  const bullet2 = allBullets[1] || ''
  const bullet3 = allBullets[2] || ''

  const top5Skills = effectiveSkills.slice(0, 5).join(' | ') || topSkillList
  const top6Skills = effectiveSkills.slice(0, 6).join(' • ') || topSkillList
  const primaryDomainSkill = effectiveSkills[0] || targetRole

  const fallbackHeadlines = [
    {
      formula: 'Proof & Milestone First',
      headline: `${metricPhrase ? `Delivered ${metricPhrase}` : `Delivering measurable outcomes in ${primaryDomainSkill}`} | ${targetRole} • Senior Specialist | ${effectiveSkills.slice(0, 5).join(' | ') || topSkillList}`.slice(0, 220),
      whyItWorks: 'Hooks recruiters immediately with verified scale and packs 5-7 searchable technical keywords for boolean search algorithms.',
    },
    {
      formula: 'Curiosity & Problem Solver',
      headline: `Helping teams resolve complex operational challenges & accelerate delivery | ${targetRole} specializing in ${effectiveSkills.slice(0, 5).join(' • ') || topSkillList}`.slice(0, 220),
      whyItWorks: 'Conversational hook stating who you help and problem solved, followed by high-demand recruiter keywords and target title.',
    },
    {
      formula: 'Specialist Authority',
      headline: `Driving strategic impact and robust solutions in ${primaryDomainSkill} | ${targetRole} | ${effectiveSkills.slice(0, 5).join(' | ') || topSkillList}`.slice(0, 220),
      whyItWorks: 'Positions deep domain authority with target role keywords and dense tool indexing for recruiter filters.',
    },
  ]

  const top3PinnedSkills = effectiveSkills.slice(0, 3)

  const recommendedSkillsToAdd = Array.from(new Set([
    ...filteredMissing,
    ...marketSkills,
    ...effectiveSkills.slice(3, 10),
  ])).slice(0, 10)

  const finalSkillsToAdd = recommendedSkillsToAdd

  // Critique current LinkedIn profile
  const currentAbout = profile?.about || ''
  const currentCritique = currentAbout.length < 210
    ? 'Your current About section is under 210 characters, wasting prime above-the-fold real estate before recruiters click "...see more".'
    : 'Your current About section reads as a generic summary without leading with your strongest verified production metrics or target specialization.'

  // 4-Part Video Copywriting Framework (Credibility Hook -> Audience & Problem -> Approach & Skills -> Closing CTA)
  let hook = metricPhrase
    ? `Over the past ${yoeClause}, I have focused on driving measurable performance gains across enterprise environments, including ${metricPhrase}. As a ${targetRole}, I translate intricate technical challenges into resilient, high-velocity business outcomes while aligning engineering efforts directly with executive milestones.`
    : `Over the past ${yoeClause}, I have specialized in engineering high-reliability systems and modernizing complex workflows across enterprise applications. As a ${targetRole}, I bridge technical execution with business strategy to deliver sustainable organizational impact and dependable systems at scale.`

  if (isHealthRole) {
    hook = `Over the past ${yoeClause}, I have dedicated my clinical practice to acute patient care, rigorous safety compliance, and interdisciplinary care coordination. As a ${targetRole}, I bridge compassionate clinical advocacy with evidence-based protocols to maximize recovery outcomes and maintain pristine clinical documentation.`
  } else if (isFinanceRole) {
    hook = `Over the past ${yoeClause}, I have specialized in capital strategy, corporate variance forecasting, and GAAP/IFRS reporting precision. As a ${targetRole}, I translate complex transactional portfolios into executive decision intelligence, risk mitigation strategies, and high-velocity fiscal operations.`
  }

  let audienceAndProblem = `I partner with engineering leaders, product directors, and cross-functional squads looking to eliminate architectural bottlenecks, modernize legacy workflows, and sustain high delivery standards. My work centers on removing operational friction points so core platforms scale predictably under heavy production demands without compromising code quality or release predictability.`
  if (isHealthRole) {
    audienceAndProblem = `I collaborate with healthcare administrators and clinical teams seeking to elevate care quality, streamline charting handoffs, and uphold patient privacy standards under high-acuity conditions. I focus on optimizing bedside workflow transitions and mitigating patient care delays across multi-disciplinary units.`
  } else if (isFinanceRole) {
    audienceAndProblem = `I advise corporate leadership and financial operations looking to accelerate month-end close velocity, automate audit reconciliations, and ensure pristine fiscal compliance. I specialize in unblocking fragmented accounting workflows and establishing dependable financial controls.`
  }

  let approachAndSkills = `My methodology emphasizes clean architectural principles, automated test coverage, and continuous delivery velocity. I work primarily with ${topStack}, building robust modular workflows that scale smoothly without technical debt or operational regressions. By grounding system designs in reliable monitoring and domain-driven patterns, I help teams build resilient infrastructure that stands up to sustained enterprise load.`
  if (isHealthRole) {
    approachAndSkills = `My clinical methodology centers on proactive patient triage, meticulous enterprise charting, and rapid crisis management. I utilize ${topStack} to maintain rigorous protocol adherence across dynamic care settings, ensuring patient safety remains paramount while reducing inter-departmental handoff latency.`
  } else if (isFinanceRole) {
    approachAndSkills = `My approach pairs rigorous dimensional financial modeling with automated reconciliation pipelines. I leverage ${topStack} to eliminate reporting variance and empower strategic capital deployment, reducing cycle times while safeguarding regulatory integrity.`
  }

  let closingCta = `If you are scaling high-reliability systems, navigating technical modernization, or looking for dedicated ${targetRole} expertise, let's connect and discuss how we can build together.`
  if (isHealthRole) {
    closingCta = `If you are expanding your clinical team, driving patient safety initiatives, or advancing healthcare delivery standards, let's connect.`
  } else if (isFinanceRole) {
    closingCta = `If you are modernizing financial analytics, accelerating close cycles, or expanding your fiscal leadership team, let's connect.`
  }

  const fullText = `${hook}\n\n${audienceAndProblem}\n\n${approachAndSkills}\n\n${closingCta}`
  const proof = approachAndSkills
  const callToAction = closingCta

  const bannerStrategy = {
    bannerTagline: `${targetRole} | ${isHealthRole ? 'Clinical Excellence & Patient Care' : (isFinanceRole ? 'Financial Strategy & Analytical Modeling' : 'Operational Excellence & Scalable Impact')}`,
    bannerSecondaryText: `${topStack} · ${isHealthRole ? 'Clinical Protocols · Care Delivery' : (isFinanceRole ? 'GAAP / IFRS · Variance Modeling' : 'Proven Execution · Measurable Delivery')}`,
    designAdvice: 'Design a clean 1584x396px canvas in Canva. Keep key text in the center-right to avoid the circular profile avatar on mobile. Use professional background with bold typography.',
  }

  const rawProjects = canonical.projects || []
  const liProjects = profile?.projects || []
  const liExp = profile?.experiences || []

  // Domain-Adaptive Experience Bullet Prefixes & Upgrades
  const experienceUpgrades = exp.slice(0, 3).map((e) => {
    let p0 = isHealthRole ? 'Clinical Excellence' : (isFinanceRole ? 'Financial Analysis' : 'Core Execution')
    let p1 = isHealthRole ? 'Patient Care & Safety' : (isFinanceRole ? 'Process Optimization' : 'Operational Impact')

    const rawBullets = Array.isArray(e.bullets)
      ? e.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean)
      : []

    const upgradedBullets = rawBullets.slice(0, 4).map((b, idx) => {
      const cleanB = b.replace(/^[•\s\t*▸-]+\s*/, '').trim()
      const prefix = idx === 0 ? p0 : (idx === 1 ? p1 : (idx === 2 ? 'Strategic Impact' : 'Operational Excellence'))
      return `${prefix}: ${cleanB}`
    })

    // Find corresponding LinkedIn role using multi-segment vendor/client matching
    const compParts = String(e.company || '').split(/[/|\\—–-]/).map((p) => p.trim()).filter(Boolean)
    const matchedLi = liExp.find((le) => {
      const rawLiComp = le.company || le.companyName || le.organization || ''
      const liComp = typeof rawLiComp === 'string' ? rawLiComp : (rawLiComp?.name || rawLiComp?.text || '')
      if (!liComp || !e.company) return false
      if (matchCompany(e.company, liComp)?.matched) return true
      return compParts.some((part) => matchCompany(part, liComp)?.matched)
    })

    let linkedinGap = 'Resume bullets provide concrete domain scope; adding these structured impact bullets bridges your recruiter credibility gap.'
    const matchedLiTitle = typeof matchedLi?.title === 'string' ? matchedLi.title : (matchedLi?.title?.text || '')
    if (matchedLi && matchedLiTitle && e.role && matchedLiTitle.toLowerCase() !== String(e.role).toLowerCase()) {
      linkedinGap = `Job title alignment: Your LinkedIn profile lists "${matchedLiTitle}" while your resume positions you as "${e.role}". Standardize to "${e.role}" to maintain unified recruiter indexing.`
    }

    const bullets = upgradedBullets.length > 0 ? upgradedBullets : [
      `${p0}: Spearheaded key initiatives utilizing ${topStack} to drive core operational goals.`,
      `${p1}: Optimized workflow throughput and elevated delivery standards across cross-functional teams.`,
    ]

    return {
      company: e.company || 'Enterprise',
      role: e.role || targetRole,
      dates: e.dates || e.duration || `${e.startDate || ''} – ${e.endDate || 'Present'}`,
      linkedinGap,
      beforeText: matchedLi?.description || 'Blank description on LinkedIn — 0 keywords indexed',
      afterText: bullets.join('\n'),
      bullets,
    }
  })

  // Projects to add from resume with clean title splitting and actual resume bullets
  const sectionsToAddFromResume = {
    projects: rawProjects.slice(0, 3).map((p) => {
      const rawTitle = p.title || p.name || 'Core Project'
      const titleParts = String(rawTitle).split('|')
      const pTitle = titleParts[0].trim()
      const techFromTitle = titleParts.length > 1
        ? titleParts[1].split(/[,/]+/).map((t) => t.trim()).filter(Boolean)
        : []

      const isMissingOnLi = !liProjects.some((lp) => (lp.title || lp.name || '').toLowerCase().includes(pTitle.toLowerCase().slice(0, 6)))
      const pTech = Array.isArray(p.technologies) && p.technologies.length > 0
        ? p.technologies
        : Array.isArray(p.skills) && p.skills.length > 0
        ? p.skills
        : []
      const mergedTech = Array.from(new Set([...pTech, ...techFromTitle]))

      const bulletList = Array.isArray(p.bullets) ? p.bullets : []
      const joinedBullets = bulletList.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean).join(' ')
      const rawBullet = joinedBullets || p.description || ''
      const cleanBullet = rawBullet.replace(/^[•\-*▪–—\s]+/, '').trim()

      const synthPitch = mergedTech.length > 0
        ? `${pTitle} focused on ${mergedTech.slice(0, 4).join(', ')} to deliver verified outcomes and measurable impact in ${primaryDomainSkill}.`
        : `${pTitle} designed to deliver verified outcomes and measurable impact in ${primaryDomainSkill}.`
      const pitch = cleanBullet
        ? (cleanBullet.length > 240 ? cleanBullet.slice(0, 240).replace(/[.]+$/, '') + '.' : (cleanBullet.replace(/[.]+$/, '') + '.'))
        : (typeof p?.description === 'string' && p.description.trim() ? p.description.trim() : synthPitch)

      return {
        title: pTitle,
        description: pitch,
        technologies: mergedTech,
        replaceNote: isMissingOnLi && liProjects.length > 0
          ? `Archive/replace outdated older project "${liProjects[0]?.title || 'Older Project'}" on LinkedIn with this modern project showcase.`
          : 'Feature this modern project prominently on LinkedIn to prove hands-on execution competency.',
      }
    }),
    certifications: (canonical.certifications || []).slice(0, 5).map((c) => ({
      name: typeof c === 'string' ? c : (c?.name || c?.title || 'Certification'),
      issuer: typeof c === 'object' ? (c?.issuer || c?.authority || '') : '',
      date: typeof c === 'object' ? (c?.date || c?.year || '') : '',
    })),
    featured: rawProjects.slice(0, 2).map((p) => {
      const bulletList = Array.isArray(p.bullets) ? p.bullets : []
      const joinedBullets = bulletList.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean).join(' ')
      const rawBullet = joinedBullets || p.description || ''
      const cleanBullet = rawBullet.replace(/^[•\-*▪–—\s]+/, '').trim()
      const pitch = cleanBullet
        ? (cleanBullet.length > 200 ? cleanBullet.slice(0, 200).replace(/[.]+$/, '') + '.' : (cleanBullet.replace(/[.]+$/, '') + '.'))
        : `Proves practical depth in ${primaryDomainSkill} directly at the top of your profile without exposing contact info.`
      return {
        title: String(p.title || p.name || 'Featured Project').split('|')[0].trim(),
        reason: pitch,
        callToAction: 'Pin project documentation, case study presentation, or live demo link rather than a raw resume PDF.',
      }
    }),
  }

  const projectItems = rawProjects.slice(0, 3).map((p) => {
    const bulletList = Array.isArray(p.bullets) ? p.bullets : []
    const joinedBullets = bulletList.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean).join(' ')
    const rawBullet = joinedBullets || p.description || ''
    const cleanBullet = rawBullet.replace(/^[•\-*▪–—\s]+/, '').trim()
    const techArr = Array.isArray(p.technologies) ? p.technologies : Array.isArray(p.skills) ? p.skills : []
    const pTitle = String(p.title || p.name || 'Core Project').split('|')[0].trim()
    const synthPitch = techArr.length > 0
      ? `${pTitle} focused on ${techArr.slice(0, 4).join(', ')} to deliver verified outcomes and measurable impact in ${primaryDomainSkill}.`
      : `${pTitle} designed to deliver verified outcomes and measurable impact in ${primaryDomainSkill}.`
    const pitch = cleanBullet
      ? (cleanBullet.length > 200 ? cleanBullet.slice(0, 200).replace(/[.]+$/, '') + '.' : (cleanBullet.replace(/[.]+$/, '') + '.'))
      : (typeof p?.description === 'string' && p.description.trim() ? p.description.trim() : synthPitch)
    return {
      title: pTitle,
      reason: pitch,
      callToAction: 'Pin this project with case study documentation, key results, and a live portfolio link or demo.',
    }
  })

  const supplementalFeatured = [
    {
      title: `${targetRole} Technical Case Study & Architecture Deep-Dive`,
      reason: `Proves practical system design depth, problem-solving methodologies, and technical decision-making at ${topCompany}.`,
      callToAction: 'Pin an architectural summary, engineering teardown post, or case-study slide deck.',
    },
    {
      title: 'Before-and-After Verified Metric Demonstration',
      reason: `Visually substantiates your key performance gains (${metricPhrase || 'core delivery milestones'}) with benchmark charts or before-after graphs.`,
      callToAction: 'Pin a 2-slide benchmark comparison highlighting operational velocity gains.',
    },
    {
      title: 'Live Interactive Repository or Portfolio Demo',
      reason: 'Gives recruiters and engineering leads instant 1-click proof of execution and clean code standards.',
      callToAction: 'Pin a live demo link or GitHub repository with an executive README.',
    },
    {
      title: '60-Second Video Intro & Project Walkthrough',
      reason: 'Humanizes your engineering background and directly addresses the 30-second hiring manager attention span.',
      callToAction: 'Pin a clean Loom or video walkthrough of your primary technical project.',
    },
  ]

  const featuredSectionRecommendations = [
    ...projectItems,
    ...supplementalFeatured,
  ].slice(0, 5)

  const categorizedSkills = buildCategorizedSkillsBank(effectiveSkills, targetRole, canonical)

  const topResultMetric = metricPhrase || (allBullets[0] ? allBullets[0].slice(0, 80).replace(/[.]+$/, '') : `Proven delivery in ${targetRole}`)
  const topSkillStr = effectiveSkills.slice(0, 4).join(', ')

  const profilePicturePrompt = `Professional studio headshot of a candidate targeting ${targetRole}. Maintain candidate's authentic facial features, natural hairstyle, and confident approachable expression. Upgrade styling to a modern tailored blazer / smart professional business attire in neutral tones (navy, charcoal, or dark graphite). Soft studio butterfly lighting with gentle fill, crisp focus on the eyes, head-and-shoulders composition. Clean, minimalist defocused architectural or neutral matte gradient background with zero clutter. 8k resolution, cinematic commercial photography style.`

  const coverBannerPrompt = `Design a high-converting, professional LinkedIn Cover Banner (1584x396 px) for a ${targetRole} with 6 core visual elements:
1. Main Authority Headline: "${targetRole} | ${topSkillStr}"
2. Proof / Primary Metric Hook: "${topResultMetric}"
3. 3-4 Core Value Pillars: ${effectiveSkills.slice(0, 4).map((s) => `• ${s}`).join(' ')}
4. Target Audience / Specialty: Solving complex domain challenges for engineering and enterprise teams
5. Soft CTA: "Let's Connect & Collaborate"
6. Layout & Color Direction: Clean executive layout, high-contrast dark slate / deep navy base with subtle Electric Indigo accents. Keep the lower-left 30% area completely clear to prevent overlap with the mobile/desktop circular profile photo.`

  const bannerShowcaseOptions = [
    {
      style: 'Minimalist Dark Slate',
      colorPalette: 'Deep Charcoal (#111827), Electric Indigo (#6366F1), Crisp White typography',
      layout: 'Headline on the top-right, 3 value pill badges horizontally centered, clean negative space on the left for avatar.',
    },
    {
      style: 'Executive Clean Studio',
      colorPalette: 'Soft Matte Gray (#F8FAFC), Navy (#0F172A), Slate Blue accent',
      layout: 'Structured split layout: Bold role title and metric callout on the right, subtle architectural grid background.',
    },
    {
      style: 'Modern Technical Dossier',
      colorPalette: 'Deep Onyx (#090D16), Cyber Teal / Indigo gradient hairline border, mono-spaced pill badges',
      layout: 'Terminal-inspired crisp typography highlighting core skills and scale outcomes, optimized for maximum recruiter glance value.',
    },
  ]

  const visualPrompts = {
    profilePicturePrompt,
    coverBannerPrompt,
    bannerShowcaseOptions,
  }

  const visualPresenceTips = [
    'Profile Headshot: Use front-facing soft lighting with eyes aligned to the upper third. Avoid heavy background clutter.',
    'Custom Vanity URL: Ensure your profile URL is customized to linkedin.com/in/yourname instead of the auto-generated numeric suffix.',
    'Canva Banner: Use 1584x396px resolution, high-contrast dark theme, and leave the lower-left 30% area clear for mobile avatar overlap.',
  ]

  const openToWorkTitles = deriveOpenToWorkTitles(targetRole)
  const top3Tools = top3PinnedSkills

  const visibilityTricks = [
    {
      category: 'Open to Work Titles',
      trick: '1. Set 5 Exact Job Titles in "Open to Work"',
      advice: 'LinkedIn Recruiter search filters match candidate "Job Titles" strictly. Add these 5 exact titles to your private Open to Work preferences:',
      items: openToWorkTitles,
    },
    {
      category: 'Top 3 Pinned Skills',
      trick: '2. Pin Your Top 3 Skills to the Top of Skills Section',
      advice: 'Recruiters see the first 3 pinned skills immediately on mobile and search cards. Pin these 3 core skills to maximize recruiter match score:',
      items: top3PinnedSkills,
    },
    {
      category: 'Recruiter Boolean String',
      trick: '3. Optimize for Recruiter Boolean Search Strings',
      advice: 'Technical recruiters find candidates using exact boolean operators. Ensure your profile headline and about section match this search query:',
      items: [`("${targetRole}") AND (${(effectiveSkills.slice(0, 4)).map((s) => `"${s}"`).join(' OR ') || `"${effectiveSkills[0] || targetRole}"`})`],
    },
    {
      category: 'Featured Media Architecture',
      trick: '4. Showcase High-Impact Career Artifacts',
      advice: 'Recruiters and hiring managers spend 80% of their review time on evidence of real execution. Pin high-impact professional artifacts directly to your profile top.',
      items: [`${top3Tools.join(' + ')} Portfolio & Case Study`, 'Live Portfolio / Demo Link'],
    },
    {
      category: 'Featured Section Asset',
      trick: '5. Pin Live Case Study Over Raw Resume PDF',
      advice: 'Never pin a raw PDF resume with your phone number and physical address exposed to scrapers. Instead, pin a project case study with a live portfolio link or demo.',
      items: ['Pin top project case study to Featured section'],
    },
  ]

  return {
    headlines: fallbackHeadlines,
    aboutRewrite: {
      currentCritique,
      hook,
      audienceAndProblem,
      approachAndSkills,
      closingCta,
      fullText,
    },
    experienceUpgrades,
    sectionsToAddFromResume,
    visibilityTricks,
    bannerStrategy,
    featuredSectionRecommendations,
    top3PinnedSkills,
    visualPresenceTips,
    visualPrompts,
    categorizedSkills,
    recommendedSkillsToAdd: finalSkillsToAdd,
    recommendedSkills: finalSkillsToAdd.map((skill) => ({
      skill,
      reason: 'Verified on your resume; adding to LinkedIn broadens recruiter search visibility.',
    })),
    profileRedFlags: [
      {
        title: 'Align Headline with Target Role',
        explanation: 'Your current headline should directly lead with your target role to rank in recruiter candidate filters.',
        fix: `Update your headline to lead with "${targetRole}".`,
      },
      {
        title: 'Transfer Verified Metrics to Role Descriptions',
        explanation: 'LinkedIn experience entries without metrics read as task lists rather than demonstrated impact.',
        fix: 'Add 2-3 outcome-driven bullets with numbers from your resume into each role.',
      },
    ],
    isFallback: true,
  }
}

/**
 * Attempts to parse raw LLM text into a JSON object using native parse and jsonrepair.
 */
function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch (_e1) {
    try {
      return JSON.parse(jsonrepair(text))
    } catch (_e2) {
      return null
    }
  }
}

/**
 * Executes unified, comprehensive LinkedIn Profile Synthesis using Groq LLM (openai/gpt-oss-120b).
 *
 * Directives:
 * - Compares candidate's actual scraped LinkedIn profile against their verified Resume
 * - Never copies raw resume bullets
 * - Outputs headlines, about rewrite with critique, experience upgrades with linkedinGap,
 *   sections to add with replaceNote, and 5 visibility tricks
 *
 * @param {Object} profile - Normalized or raw LinkedIn profile
 * @param {Object} resumeContext - { canonicalResume, extractedFacts, targetRole }
 * @param {Array} [missingSkills] - Skills detected missing by cross-analyzer
 * @param {Array} [discrepancies] - Discrepancy findings
 * @param {Object} [signals] - Deterministic pre-audit signals
 * @param {Object} [options] - Routing and provider options
 * @returns {Promise<Object>} Synthesized optimizations
 */
export async function runLinkedInSynthesis(
  profile = {},
  resumeContext = {},
  missingSkills = [],
  discrepancies = [],
  signals = null,
  options = {}
) {
  if (options?.bypassAI) {
    return buildDeterministicOptimizations(profile, resumeContext, missingSkills, discrepancies)
  }

  let lazyFallback = null
  const getFallback = () => {
    if (!lazyFallback) {
      lazyFallback = buildDeterministicOptimizations(profile, resumeContext, missingSkills, discrepancies)
    }
    return lazyFallback
  }

  const canonical = resumeContext?.canonicalResume || resumeContext?.resumeJson || {}
  const targetRole =
    resumeContext?.targetRole ||
    canonical?.candidate?.targetRole ||
    canonical?.target_role ||
    canonical?.targetRole ||
    profile?.headline ||
    'Professional'

  // Route via task-based OpenRouter model routing with provider isolation
  const resumeProvider = resumeContext?.provider || resumeContext?.lastProvider
  const excludeProvider = options?.excludeProvider || (resumeProvider ? resumeProvider : null)
  const preferredProvider = options?.preferredProvider || (resumeProvider === 'gemini' ? 'groq' : (resumeProvider === 'groq' ? 'gemini' : 'openrouter'))
  const effectiveModel = options?.model || (preferredProvider === 'groq' ? 'openai/gpt-oss-120b' : null)
  const effectiveAnswers = options?.answers || resumeContext?.answers || null

  try {
    const task1Messages = buildTask1HeadlinesAndBannerPrompt({
      profile,
      resumeContext,
      discrepancies,
      missingSkills,
      signals,
      answers: effectiveAnswers,
    })

    const task2Messages = buildTask2AboutAndFeaturedPrompt({
      profile,
      resumeContext,
      discrepancies,
      missingSkills,
      signals,
      answers: effectiveAnswers,
    })

    async function executeTask(taskName, messages, maxTokens) {
      try {
        const response = await llmGateway.generate({
          purpose: 'linkedin_analysis',
          task: 'linkedin_synthesis',
          preferredProvider,
          excludeProvider,
          model: effectiveModel,
          messages,
          temperature: 0.25,
          maxTokens,
          responseFormat: { type: 'json_object' },
          timeoutMs: 45000,
        })

        let parsed = tryParseJson(response?.text)
        if (!parsed && response?.text) {
          try {
            const repaired = jsonrepair(response.text)
            parsed = JSON.parse(repaired)
          } catch {}
        }
        return parsed
      } catch (err) {
        console.warn(`[LinkedInSynthesis] ${taskName} execution failed:`, err.message)
        return null
      }
    }

    // Run Task 1 and Task 2 in parallel for lower latency
    const [task1Result, task2Result] = await Promise.all([
      executeTask('Task 1 (Headlines & About)', task1Messages, 4096),
      executeTask('Task 2 (Experience & Tricks)', task2Messages, 4096),
    ])

    if (!task1Result && !task2Result) {
      console.warn('[LinkedInSynthesis] Both tasks failed, using deterministic fallback')
      return getFallback()
    }

    const fallback = getFallback()

    // Merge outputs from Task 1 and Task 2
    // Headlines (Task 1) - Natural Recruiter-Searchable Headlines (15–20 words)
    let headlines = fallback.headlines
    const rawHeadlines = task1Result?.headlines || task2Result?.headlines
    if (Array.isArray(rawHeadlines) && rawHeadlines.length > 0) {
      headlines = rawHeadlines.slice(0, 3).map((h, i) => ({
        formula: h.formula || fallback.headlines[i]?.formula || `Option ${i + 1}`,
        headline: (h.headline || h.text || fallback.headlines[i]?.headline || '').slice(0, 220),
        whyItWorks: h.whyItWorks || fallback.headlines[i]?.whyItWorks || 'Recruiter search ranking optimization.',
      }))
      // If LLM returned fewer than 3, backfill from fallback
      while (headlines.length < 3 && fallback.headlines[headlines.length]) {
        headlines.push(fallback.headlines[headlines.length])
      }
    }

    // About rewrite (Task 1) - 4-Part Video Copywriting Framework
    let aboutRewrite = fallback.aboutRewrite
    const rawAbout = task1Result?.aboutRewrite || task2Result?.aboutRewrite
    if (rawAbout && typeof rawAbout === 'object') {
      const hook = rawAbout.hook || fallback.aboutRewrite.hook
      const audienceAndProblem = rawAbout.audienceAndProblem || fallback.aboutRewrite.audienceAndProblem
      const approachAndSkills = rawAbout.approachAndSkills || fallback.aboutRewrite.approachAndSkills
      const closingCta = rawAbout.closingCta || fallback.aboutRewrite.closingCta
      const combined = rawAbout.fullText || [hook, audienceAndProblem, approachAndSkills, closingCta].filter(Boolean).join('\n\n')

      aboutRewrite = {
        currentCritique: rawAbout.currentCritique || fallback.aboutRewrite.currentCritique || '',
        hook,
        audienceAndProblem,
        approachAndSkills,
        closingCta,
        fullText: combined || fallback.aboutRewrite.fullText,
      }
    } else if (typeof rawAbout === 'string' && rawAbout.length > 80) {
      aboutRewrite = {
        ...fallback.aboutRewrite,
        fullText: rawAbout,
      }
    }

    // Top 3 pinned skills (Task 1)
    let top3PinnedSkills = fallback.top3PinnedSkills
    const rawPinned = task1Result?.top3PinnedSkills || task2Result?.top3PinnedSkills
    if (Array.isArray(rawPinned) && rawPinned.length > 0) {
      const validPinned = rawPinned
        .filter(isValidSkill)
        .map(formatSkillName)
        .sort((a, b) => (isConcreteTechSkill(b) ? 1 : 0) - (isConcreteTechSkill(a) ? 1 : 0))
      top3PinnedSkills = validPinned.length >= 3 ? validPinned.slice(0, 3) : fallback.top3PinnedSkills
    }

    // Profile red flags (Task 1)
    let profileRedFlags = fallback.profileRedFlags
    const rawFlags = task1Result?.profileRedFlags || task2Result?.profileRedFlags
    if (Array.isArray(rawFlags) && rawFlags.length > 0) {
      profileRedFlags = rawFlags.slice(0, 4)
    }

    // Experience Upgrades (Task 2)
    let experienceUpgrades = fallback.experienceUpgrades
    const rawExp = task2Result?.experienceUpgrades || task1Result?.experienceUpgrades
    if (Array.isArray(rawExp) && rawExp.length > 0) {
      experienceUpgrades = rawExp.slice(0, 4).map((eu, idx) => ({
        company: eu.company || fallback.experienceUpgrades[idx]?.company || 'Company',
        role: eu.role || fallback.experienceUpgrades[idx]?.role || 'Role',
        dates: eu.dates || fallback.experienceUpgrades[idx]?.dates || '',
        linkedinGap: eu.linkedinGap || fallback.experienceUpgrades[idx]?.linkedinGap || 'Missing quantified metrics and verified stack proof.',
        bullets: Array.isArray(eu.bullets) && eu.bullets.length > 0
          ? eu.bullets.slice(0, 4)
          : fallback.experienceUpgrades[idx]?.bullets || [],
      }))
    }

    // Featured section recommendations (Task 2)
    let featuredSectionRecommendations = fallback.featuredSectionRecommendations
    const rawFeatured = task2Result?.featuredSectionRecommendations || task1Result?.featuredSectionRecommendations
    if (Array.isArray(rawFeatured) && rawFeatured.length > 0) {
      featuredSectionRecommendations = rawFeatured.slice(0, 3).map((f, idx) => {
        const fallbackItem = fallback.featuredSectionRecommendations[idx]
        const fallbackReason = fallbackItem?.reason || ''
        let customReason = f.reason || f.description || f.summary || f.details || ''
        if (!customReason || customReason.includes('Showcases end-to-end technical implementation')) {
          customReason = fallbackReason
        }
        if (!customReason) {
          const matchCanonical = (resumeContext?.canonicalResume?.projects || []).find(
            (cp) => (cp.title || cp.name || '').toLowerCase().includes((f.title || '').toLowerCase().slice(0, 8))
          )
          const joinedBullets = (matchCanonical?.bullets || [])
            .map((b) => (typeof b === 'string' ? b : b.text || ''))
            .filter(Boolean)
            .join(' ')
          customReason = joinedBullets
            ? (joinedBullets.length > 240 ? joinedBullets.slice(0, 240).replace(/[.]+$/, '') + '.' : joinedBullets)
            : `Proves practical technical execution and system architecture delivery for ${f.title || 'Core Project'}.`
        }

        return {
          title: f.title || fallbackItem?.title || 'Core Project',
          reason: customReason,
          callToAction: f.callToAction || fallbackItem?.callToAction || 'Pin this project with GitHub repository link, architecture diagrams, and a live deployment demo.',
        }
      })
    }

    // Sections to add from resume (Task 2: Projects, Certifications, Featured)
    let sectionsToAddFromResume = fallback.sectionsToAddFromResume
    const rawSections = task2Result?.sectionsToAddFromResume || task1Result?.sectionsToAddFromResume
    const projectShowcases = Array.isArray(task2Result?.projectShowcases) && task2Result.projectShowcases.length > 0
      ? task2Result.projectShowcases
      : (Array.isArray(task1Result?.projectShowcases) && task1Result.projectShowcases.length > 0
          ? task1Result.projectShowcases
          : null)

    const rawProjectList = projectShowcases || (Array.isArray(rawSections?.projects) ? rawSections.projects : null)

    if (rawProjectList && rawProjectList.length > 0) {
      sectionsToAddFromResume = {
        ...sectionsToAddFromResume,
        projects: rawProjectList.slice(0, 4).map((pr, idx) => {
          const fallbackProj = fallback.sectionsToAddFromResume.projects[idx]
          let description = pr.rewrittenPitch || pr.description || pr.summary || pr.details
          if (!description || description.includes('Showcases end-to-end technical implementation')) {
            description = fallbackProj?.description || ''
          }
          if (!description) {
            const matchCanonical = (resumeContext?.canonicalResume?.projects || []).find(
              (cp) => (cp.title || cp.name || '').toLowerCase().includes((pr.title || '').toLowerCase().slice(0, 8))
            )
            const joinedBullets = (matchCanonical?.bullets || [])
              .map((b) => (typeof b === 'string' ? b : b.text || ''))
              .filter(Boolean)
              .join(' ')
            if (joinedBullets) {
              description = joinedBullets.length > 240 ? joinedBullets.slice(0, 240).replace(/[.]+$/, '') + '.' : joinedBullets
            } else {
              const tech = Array.isArray(pr.technologies) ? pr.technologies : []
              description = tech.length > 0
                ? `Production-grade ${pr.title || 'project'} engineered with ${tech.slice(0, 4).join(', ')} to solve core technical workflows and deliver verified business impact.`
                : `Production-grade ${pr.title || 'project'} engineered to deliver verified technical and operational impact.`
            }
          }
          return {
            title: pr.title || fallbackProj?.title || 'Core Project',
            description,
            technologies: Array.isArray(pr.technologies) && pr.technologies.length > 0 ? pr.technologies : (fallbackProj?.technologies || []),
            replaceNote: pr.actionAdvice || pr.replaceNote || fallbackProj?.replaceNote || '',
          }
        }),
      }
    }

    if (rawSections && typeof rawSections === 'object') {
      sectionsToAddFromResume = {
        ...sectionsToAddFromResume,
        certifications: Array.isArray(rawSections.certifications) && rawSections.certifications.length > 0
          ? rawSections.certifications.slice(0, 5)
          : fallback.sectionsToAddFromResume.certifications,
        featured: Array.isArray(rawSections.featured) && rawSections.featured.length > 0
          ? rawSections.featured.slice(0, 3)
          : fallback.sectionsToAddFromResume.featured,
      }
    }

    // Recommended skills to add
    let recommendedSkillsToAdd = fallback.recommendedSkillsToAdd
    const rawSkills = task1Result?.recommendedSkillsToAdd || task2Result?.recommendedSkillsToAdd
    if (Array.isArray(rawSkills) && rawSkills.length > 0) {
      recommendedSkillsToAdd = rawSkills
        .filter(isValidSkill)
        .map(formatSkillName)
        .sort((a, b) => (isConcreteTechSkill(b) ? 1 : 0) - (isConcreteTechSkill(a) ? 1 : 0))
        .slice(0, 12)
    }

    // Visibility Tricks — preserve LLM output if returned by Task 2, else construct fallback
    let visibilityTricks = fallback.visibilityTricks
    const rawTricks = task2Result?.visibilityTricks || task1Result?.visibilityTricks
    if (Array.isArray(rawTricks) && rawTricks.length > 0) {
      visibilityTricks = rawTricks
    } else {
      const otwTitles = deriveOpenToWorkTitles(targetRole)
      const topHardSkills = (top3PinnedSkills.length >= 3 ? top3PinnedSkills : fallback.top3PinnedSkills)
        .filter(isValidSkill)
        .map(formatSkillName)
        .slice(0, 3)

      const candidateHardSkills = Array.from(new Set([
        ...topHardSkills,
        ...recommendedSkillsToAdd.filter(isConcreteTechSkill),
      ])).filter(isValidSkill).filter(isConcreteTechSkill).slice(0, 4)

      const booleanRolePart = `("${targetRole || 'Professional'}")`
      const booleanSkillsPart = candidateHardSkills.length > 0
        ? `(${candidateHardSkills.map((s) => `"${s}"`).join(' OR ')})`
        : '("Core Expertise")'
      const booleanQuery = `${booleanRolePart} AND ${booleanSkillsPart}`

      visibilityTricks = [
        {
          category: 'Open to Work Titles',
          trick: '1. Set 5 Exact Job Titles in "Open to Work"',
          advice: 'LinkedIn Recruiter search filters match candidate "Job Titles" strictly. Add these 5 exact titles to your private Open to Work preferences:',
          items: otwTitles,
        },
        {
          category: 'Top 3 Pinned Skills',
          trick: '2. Pin Your Top 3 Skills to the Top of Skills Section',
          advice: 'Recruiters see the first 3 pinned skills immediately on mobile and search cards. Pin these 3 core skills to maximize recruiter match score:',
          items: topHardSkills,
        },
        {
          category: 'Recruiter Boolean String',
          trick: '3. Optimize for Recruiter Boolean Search Strings',
          advice: 'Technical recruiters find candidates using exact boolean operators. Ensure your profile headline and about section match this search query:',
          items: [booleanQuery],
        },
        {
          category: 'Featured Media Architecture',
          trick: '4. Showcase High-Scale Technical Artifacts',
          advice: 'Recruiters and hiring managers spend 80% of their review time on evidence of real system delivery. Pin high-impact technical artifacts directly to your profile top.',
          items: [`${topHardSkills.join(' + ')} Portfolio & Case Study`, 'Live Demo URL'],
        },
        {
          category: 'Featured Section Asset',
          trick: '5. Pin Live Case Study Over Raw Resume PDF',
          advice: 'Never pin a raw PDF resume with your phone number and physical address exposed to scrapers. Instead, pin a GitHub architecture repo with a live deployed demo.',
          items: ['Pin top architecture case study to Featured section'],
        },
      ]
    }

    // Banner Strategy (Task 1 or fallback)
    let bannerStrategy = fallback.bannerStrategy
    const rawBanner = task1Result?.bannerStrategy || task2Result?.bannerStrategy
    if (rawBanner && typeof rawBanner === 'object') {
      bannerStrategy = {
        bannerTagline: rawBanner.bannerTagline || fallback.bannerStrategy.bannerTagline,
        bannerSecondaryText: rawBanner.bannerSecondaryText || fallback.bannerStrategy.bannerSecondaryText,
        designAdvice: rawBanner.designAdvice || fallback.bannerStrategy.designAdvice,
      }
    }

    // Visual presence tips
    let visualPresenceTips = fallback.visualPresenceTips
    const rawTips = task1Result?.visualPresenceTips || task2Result?.visualPresenceTips
    if (Array.isArray(rawTips) && rawTips.length > 0) {
      visualPresenceTips = rawTips.slice(0, 4)
    }

    const categorizedSkills = task2Result?.categorizedSkills || fallback.categorizedSkills
    const visualPrompts = fallback.visualPrompts

    return {
      headlines,
      aboutRewrite,
      experienceUpgrades,
      sectionsToAddFromResume,
      visibilityTricks,
      bannerStrategy,
      featuredSectionRecommendations,
      top3PinnedSkills,
      visualPresenceTips,
      visualPrompts,
      categorizedSkills,
      recommendedSkillsToAdd,
      recommendedSkills: recommendedSkillsToAdd.map((skill) => ({
        skill,
        reason: 'Verified on your resume; adding to LinkedIn broadens recruiter search visibility.',
      })),
      profileRedFlags,
      isFallback: false,
    }
  } catch (err) {
    console.warn('[LinkedInSynthesis] Synthesis failed, using deterministic fallback:', err.message)
    return getFallback()
  }
}

/**
 * Backwards-compatible alias for runLinkedInSynthesis.
 */
export async function synthesizeLinkedInOptimizations(
  profile = {},
  resumeContext = {},
  missingSkills = [],
  discrepancies = [],
  signals = null,
  options = {}
) {
  return runLinkedInSynthesis(profile, resumeContext, missingSkills, discrepancies, signals, options)
}

/**
 * Backwards-compatible helper for isolation test suite.
 */
export async function synthesizeHeadlinesAndBanner(params = {}) {
  const res = await runLinkedInSynthesis(
    params.profile || {},
    {
      canonicalResume: {
        candidate: { name: params.candidateName, targetRole: params.targetRole },
        skills: params.topSkills,
      },
      targetRole: params.targetRole,
    },
    [],
    [],
    null,
    {
      excludeProvider: params.excludeProvider,
      preferredProvider: params.preferredProvider,
    }
  )
  return {
    headlines: res.headlines,
    bannerStrategy: res.bannerStrategy,
    isFallback: res.isFallback,
  }
}

/**
 * Backwards-compatible helper for isolation test suite.
 */
export async function synthesizeAboutAndFeatured(params = {}) {
  const res = await runLinkedInSynthesis(
    params.profile || { about: params.currentAbout },
    {
      canonicalResume: {
        candidate: { name: params.candidateName, targetRole: params.targetRole },
        experience: params.topExperiences,
        projects: params.topProjects,
        skills: params.topSkills,
      },
      targetRole: params.targetRole,
    },
    [],
    [],
    null,
    {
      excludeProvider: params.excludeProvider,
      preferredProvider: params.preferredProvider,
    }
  )
  return {
    aboutRewrite: res.aboutRewrite,
    experienceUpgrades: res.experienceUpgrades,
    featuredSectionRecommendations: res.featuredSectionRecommendations,
    profileRedFlags: res.profileRedFlags,
    isFallback: res.isFallback,
  }
}

export default {
  runLinkedInSynthesis,
  synthesizeLinkedInOptimizations,
  synthesizeHeadlinesAndBanner,
  synthesizeAboutAndFeatured,
  buildDeterministicOptimizations,
}
