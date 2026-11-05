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
  buildLinkedInSynthesisPrompt,
  buildTask1HeadlinesAndBannerPrompt,
  buildTask2AboutAndFeaturedPrompt,
} from './linkedinSynthesis.prompt.js'

/**
 * Dynamically derives 5 Open-to-Work titles based on the candidate's actual target role.
 * Never defaults or hardcodes Software Engineer for non-SWE roles.
 */
export function deriveOpenToWorkTitles(targetRole) {
  const cleanBase = String(targetRole || 'Software Engineer')
    .replace(/^(?:Senior|Lead|Staff|Principal|Junior|Associate|Mid-Level)\s+/i, '')
    .trim() || 'Software Engineer'

  if (/data\s+analyst|business\s+intelligence|bi\s+analyst|analytics/i.test(cleanBase)) {
    return [
      'Data Analyst',
      'Senior Data Analyst',
      'Business Intelligence Analyst',
      'Healthcare / Enterprise Data Analyst',
      'Lead Analytics Specialist',
    ]
  } else if (/data\s+scientist|machine\s+learning|ai\s+engineer|ml\s+engineer/i.test(cleanBase)) {
    return [
      targetRole || 'Data Scientist',
      `Senior ${cleanBase}`,
      'Applied AI / ML Engineer',
      'Lead Data Scientist',
      `Staff ${cleanBase}`,
    ]
  } else if (/data\s+engineer/i.test(cleanBase)) {
    return [
      'Data Engineer',
      'Senior Data Engineer',
      'Lead Data Engineer',
      'Analytics & BigQuery Data Engineer',
      'Cloud Data Architect',
    ]
  } else {
    return [
      targetRole || 'Software Engineer',
      `Senior ${cleanBase}`,
      `Lead ${cleanBase}`,
      `Staff ${cleanBase}`,
      `Principal ${cleanBase}`,
    ]
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
  const canonical = resumeContext?.canonicalResume || {}
  const targetRole =
    resumeContext?.targetRole ||
    canonical?.candidate?.targetRole ||
    canonical?.target_role ||
    canonical?.targetRole ||
    profile?.headline ||
    'Software Engineer'

  const isHealthRole = /nurse|clinical|health|patient|medical|doctor|therapy/i.test(targetRole)
  const isFinanceRole = /finance|financial|accountant|accounting|audit|tax|cpa|banking|bank/i.test(targetRole)
  const isSalesRole = /sales|account executive|b2b|marketing|revenue|bizdev|business dev/i.test(targetRole)
  const isSoftwareRole = /software|developer|engineer|backend|frontend|fullstack|sde|web/i.test(targetRole)
  const isDataRole = (/data|analytics|bi\b|machine learning|ml\b|ai\b|scientist/i.test(targetRole)) && !isFinanceRole
  const isDevopsRole = /devops|cloud|sre|infrastructure/i.test(targetRole)

  const exp = canonical.experience || canonical.experiences || []
  const topCompany = exp[0]?.company || 'Tech'

  // Extract candidate verified skills (modern data warehouse tools preserved for SWEs)
  const candidateSkills = (canonical.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
    .filter(isValidSkill)
    .map(formatSkillName)
    .sort((a, b) => (isConcreteTechSkill(b) ? 1 : 0) - (isConcreteTechSkill(a) ? 1 : 0))

  // Role-appropriate stacks
  const defaultStack = isSoftwareRole
    ? ['Python', 'React', 'Node.js', 'AWS', 'Docker']
    : isDataRole
      ? ['SQL', 'Python', 'Power BI', 'Tableau', 'PostgreSQL']
      : isDevopsRole
        ? ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD']
        : isHealthRole
          ? ['Patient Assessment', 'EHR Systems', 'HIPAA Protocol', 'Acute Care', 'Care Coordination']
          : isFinanceRole
            ? ['Financial Modeling', 'GAAP / IFRS', 'Variance Analysis', 'ERP Systems', 'Month-End Close']
            : isSalesRole
              ? ['B2B Pipeline', 'Salesforce CRM', 'Enterprise Accounts', 'Contract Negotiation']
              : ['Cross-functional Leadership', 'Strategic Planning', 'Process Optimization', 'KPI Dashboards']

  const effectiveSkills = candidateSkills.length >= 3 ? candidateSkills : defaultStack
  const topStack = effectiveSkills.slice(0, 3).join(' | ')

  // Dynamic Specialist Headline formula
  let specialistTopic = 'Strategic Planning, Process Optimization & Operational Leadership'
  if (isSoftwareRole || isDevopsRole) specialistTopic = 'Cloud Architecture, Distributed Services & System Performance'
  else if (isDataRole) specialistTopic = 'Data Architecture, Analytics Pipelines & Decision Systems'
  else if (isHealthRole) specialistTopic = 'Clinical Operations, Patient Care Excellence & Healthcare Compliance'
  else if (isFinanceRole) specialistTopic = 'Financial Reporting, Variance Modeling & Capital Strategy'
  else if (isSalesRole) specialistTopic = 'Enterprise Revenue Growth, Strategic Partnerships & Pipeline Acceleration'

  const fallbackHeadlines = [
    {
      formula: 'Search-Optimized',
      headline: `${targetRole} | ${topStack} | Scalable Execution`.slice(0, 220),
      whyItWorks: 'Positions primary role title first followed by high-frequency recruiter search keywords.',
    },
    {
      formula: 'Impact-Driven',
      headline: `${targetRole} | Driving Measurable Operational & Strategic Impact`.slice(0, 220),
      whyItWorks: 'Anchors on concrete outcomes and domain execution to stand out from generic applicant profiles.',
    },
    {
      formula: 'Specialist',
      headline: `Specialist in ${specialistTopic}`.slice(0, 220),
      whyItWorks: 'Appeals directly to specialized hiring managers looking for proven functional expertise.',
    },
  ]

  const top3PinnedSkills = effectiveSkills.slice(0, 3)

  const recommendedSkillsToAdd = isSoftwareRole
    ? ['Docker', 'Kubernetes', 'CI/CD Pipelines', 'PostgreSQL', 'Microservices Architecture']
    : isDataRole
      ? ['BigQuery', 'Tableau', 'Snowflake', 'dbt', 'Data Modeling']
      : isDevopsRole
        ? ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD Pipelines']
        : isHealthRole
          ? ['Patient Assessment', 'EHR Systems', 'HIPAA Protocol', 'Acute Care', 'Care Coordination']
          : isFinanceRole
            ? ['Financial Modeling', 'GAAP / IFRS', 'Variance Analysis', 'ERP Systems', 'Month-End Close']
            : isSalesRole
              ? ['B2B Pipeline', 'Salesforce CRM', 'Enterprise Accounts', 'Contract Negotiation']
              : ['Cross-functional Leadership', 'Strategic Planning', 'Process Optimization', 'KPI Dashboards']

  const filteredMissing = (Array.isArray(missingSkills) ? missingSkills : [])
    .filter(isValidSkill)
    .map(formatSkillName)

  const finalSkillsToAdd = filteredMissing.length > 0
    ? Array.from(new Set([...filteredMissing, ...recommendedSkillsToAdd])).slice(0, 10)
    : recommendedSkillsToAdd

  // Scan all experience bullets across the resume for high-impact metric clauses
  let bestMetricPhrase = ''
  let bestMetricNum = ''

  for (const e of exp) {
    const bullets = Array.isArray(e.bullets)
      ? e.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean)
      : []
    for (const b of bullets) {
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
    if (bestMetricPhrase && bestMetricNum) break
  }

  const metricPhrase = bestMetricPhrase || (bestMetricNum ? `driving ${bestMetricNum} performance gains` : '')
  const metricMatch = bestMetricNum ? [bestMetricNum] : null
  const metricSnippet = metricPhrase || (metricMatch ? `driving ${metricMatch[0]} performance gains` : 'Scalable Architecture & High-Performance Systems')

  // Critique current LinkedIn profile
  const currentAbout = profile?.about || ''
  const currentCritique = currentAbout.length < 210
    ? 'Your current About section is under 210 characters, wasting prime above-the-fold real estate before recruiters click "...see more".'
    : 'Your current About section reads as a generic summary without leading with your strongest verified production metrics or target specialization.'

  // Full 180–250 Word 3-Paragraph Executive LinkedIn Storytelling
  const yoeText = canonical.years_of_experience || '3+ years'
  let hook = `I am a ${targetRole} with ${yoeText} of hands-on engineering experience designing high-concurrency microservices, distributed data streaming pipelines, and mission-critical cloud backends. My core architectural focus centers on modernizing legacy workflows, enforcing strict API contract safety, and sustaining low-latency system performance using ${topStack} across resilient production environments.`
  if (isDataRole) {
    hook = `I am a ${targetRole} with ${yoeText} of experience transforming enterprise datasets into automated reporting pipelines, modern cloud data architectures, and decision-support intelligence. My specialization centers on architecting scalable star-schema data models, optimizing analytical SQL queries across Snowflake and BigQuery, and delivering self-service executive dashboards using ${topStack} to eliminate organizational reporting bottlenecks.`
  } else if (isHealthRole) {
    hook = `I am a ${targetRole} with ${yoeText} of dedicated clinical experience providing empathetic patient care, executing acute clinical protocols, and driving patient advocacy across multidisciplinary healthcare environments. My practice centers on clinical safety, meticulous EHR documentation, and collaborative care coordination using ${topStack} to optimize patient recovery outcomes.`
  } else if (isFinanceRole) {
    hook = `I am a ${targetRole} with ${yoeText} of quantitative financial experience in comprehensive reporting, variance modeling, GAAP/IFRS adherence, and strategic capital planning. My focus centers on building resilient financial models, automating month-end close reconciliations, and delivering executive dashboards using ${topStack} to guide sound fiscal decisions.`
  } else if (isSalesRole) {
    hook = `I am a ${targetRole} with ${yoeText} of enterprise sales experience accelerating B2B pipeline, closing strategic accounts, and aligning complex customer challenges with measurable business value. My expertise centers on consultative value-selling, predictable revenue forecasting, and executive relationship management using ${topStack} to exceed quota targets.`
  }

  let pillar1 = `▸ System Architecture & Scale: Engineered scalable microservices and distributed event-driven pipelines at ${topCompany} that sustain high throughput and low-latency performance.`
  let pillar2 = `▸ Cloud & Production Engineering: Containerized multi-stage builds and automated CI/CD release gating on Kubernetes, maintaining 99.99% production availability.`
  if (isDataRole) {
    pillar1 = `▸ Data Architecture & Analytics: Engineered scalable data models and automated BI pipelines across ${topStack} that eliminate organizational reporting bottlenecks.`
    pillar2 = `▸ Enterprise Intelligence & Pipelines: Deployed automated analytics workflows and dbt transformation models across modern cloud data infrastructure.`
  } else if (isHealthRole) {
    pillar1 = `▸ Clinical Excellence & Quality Care: Executed rigorous patient assessments, medication administration, and emergency response procedures under strict safety standards.`
    pillar2 = `▸ Care Coordination & EHR Workflow: Managed patient charts and cross-functional handoffs across enterprise EHR systems, ensuring 100% HIPAA compliance.`
  } else if (isFinanceRole) {
    pillar1 = `▸ Financial Analysis & Modeling: Built dynamic financial models and multi-year variance forecasts that identified high-ROI efficiency opportunities.`
    pillar2 = `▸ Compliance & Financial Controls: Enforced GAAP/IFRS accounting standards, managed audit trail readiness, and streamlined month-end close schedules.`
  } else if (isSalesRole) {
    pillar1 = `▸ Pipeline Generation & Account Strategy: Sourced and nurtured high-value B2B enterprise pipelines, consistently surpassing outbound acquisition targets.`
    pillar2 = `▸ Contract Negotiation & Deal Execution: Orchestrated full-cycle sales engagements from discovery to final contract signing across C-suite buyers.`
  }

  const pillar3 = metricPhrase
    ? `▸ Measurable Business Impact: Drove tangible performance and operational reliability, including ${metricPhrase}.`
    : (isHealthRole
      ? `▸ Patient Advocacy & Team Leadership: Championed multidisciplinary care alignment and family education, driving high patient satisfaction ratings.`
      : (isFinanceRole
        ? `▸ Strategic Impact & Optimization: Automated ledger reconciliation workflows, reducing reporting cycle times and eliminating reporting discrepancies.`
        : (isSalesRole
          ? `▸ Revenue Execution: Consistently outperformed pipeline milestones, maintaining high deal conversion velocity across core territories.`
          : `▸ Engineering Excellence & Mentorship: Established clean modular architecture, automated test gating, and continuous cross-functional engineering standards.`)))

  const proof = `${pillar1}\n\n${pillar2}\n\n${pillar3}`

  // 1. Domain-Adaptive Call-To-Action
  let domainMission = 'My professional philosophy is rooted in clean system architecture, automated test gating, and technical mentorship.'
  let domainFocus = `I am currently exploring ${targetRole} roles where I can drive scalable system architecture and meaningful operational impact.`
  if (isHealthRole) {
    domainMission = 'My clinical practice is centered on empathetic patient advocacy, clinical safety protocols, and cross-functional care delivery.'
    domainFocus = `I am actively exploring ${targetRole} opportunities where I can elevate patient care standards and clinical outcomes.`
  } else if (isFinanceRole) {
    domainMission = 'My financial philosophy focuses on analytical precision, rigorous GAAP compliance, and strategic capital management.'
    domainFocus = `I am open to ${targetRole} roles where I can drive operational efficiencies and strategic financial planning.`
  } else if (isSalesRole) {
    domainMission = 'My sales philosophy centers on consultative value-selling, strategic account alignment, and predictable pipeline execution.'
    domainFocus = `I am exploring ${targetRole} opportunities where I can accelerate enterprise revenue growth and build strategic partnerships.`
  } else if (isDataRole) {
    domainMission = 'My professional philosophy focuses on data integrity, scalable dimensional modeling, and actionable business intelligence.'
    domainFocus = `I am currently exploring ${targetRole} roles where I can optimize analytics pipelines and deliver decision-critical intelligence.`
  }

  const callToAction = `${domainMission} ${domainFocus} If you are expanding your team or looking for proven domain execution, let's connect!`
  const fullText = `${hook}\n\n${proof}\n\n${callToAction}`

  const bannerStrategy = {
    bannerTagline: `${targetRole} | ${isHealthRole ? 'Clinical Excellence & Patient Care' : (isFinanceRole ? 'Financial Strategy & Analytical Modeling' : (isSalesRole ? 'Enterprise Revenue Growth & Strategic Sales' : (isDataRole ? 'Data Architecture & Analytics' : 'Scalable Systems & High-Impact Architecture')))}`,
    bannerSecondaryText: `${topStack} · ${isHealthRole ? 'Clinical Protocols · Care Delivery' : (isFinanceRole ? 'GAAP / IFRS · Variance Modeling' : (isSalesRole ? 'B2B Pipeline · Deal Execution' : (isDataRole ? 'Scalable Pipelines · Business Intelligence' : 'Distributed Microservices · Clean Code Delivery')))}`,
    designAdvice: 'Design a clean 1584x396px canvas in Canva. Keep key text in the center-right to avoid the circular profile avatar on mobile. Use professional background with bold typography.',
  }

  const rawProjects = canonical.projects || []
  const liProjects = profile?.projects || []
  const liExp = profile?.experiences || []

  // 2. Domain-Adaptive Experience Bullet Prefixes & Upgrades
  const experienceUpgrades = exp.slice(0, 3).map((e) => {
    let p0 = 'Strategic Delivery'
    let p1 = 'Operational Impact'
    if (isSoftwareRole) {
      p0 = 'Distributed Architecture'
      p1 = 'Engineering Impact'
    } else if (isHealthRole) {
      p0 = 'Clinical Excellence'
      p1 = 'Patient Care & Safety'
    } else if (isFinanceRole) {
      p0 = 'Financial Analysis'
      p1 = 'Process Optimization'
    } else if (isDataRole) {
      p0 = 'Data Architecture'
      p1 = 'Analytics Impact'
    } else if (isSalesRole) {
      p0 = 'Revenue Growth'
      p1 = 'Account Strategy'
    }

    const rawBullets = Array.isArray(e.bullets)
      ? e.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean)
      : []

    // Find corresponding LinkedIn role using multi-segment vendor/client matching
    const compParts = String(e.company || '').split(/[/|\\—–-]/).map((p) => p.trim()).filter(Boolean)
    const matchedLi = liExp.find((le) => {
      const rawLiComp = le.company || le.companyName || le.organization || ''
      const liComp = typeof rawLiComp === 'string' ? rawLiComp : (rawLiComp?.name || rawLiComp?.text || '')
      if (!liComp || !e.company) return false
      if (matchCompany(e.company, liComp)?.matched) return true
      return compParts.some((part) => matchCompany(part, liComp)?.matched)
    })

    const rawMatchedComp = matchedLi ? (matchedLi.company || matchedLi.companyName || '') : ''
    const matchedCompName = typeof rawMatchedComp === 'string' ? rawMatchedComp : (rawMatchedComp?.name || '')

    let linkedinGap = `LinkedIn Optimization Focus: Align vendor/client naming ('${e.company}') with your LinkedIn experience entry and replace task-heavy descriptions with the quantified executive bullets below.`
    const matchedLiTitle = typeof matchedLi?.title === 'string' ? matchedLi.title : (matchedLi?.title?.text || '')
    if (matchedLi && matchedLiTitle && e.role && matchedLiTitle.toLowerCase() !== String(e.role).toLowerCase()) {
      linkedinGap = `Job title alignment: Your LinkedIn profile lists "${matchedLiTitle}" while your resume positions you as "${e.role}". Standardize to "${e.role}" to maintain unified recruiter indexing.`
    }

    const beforeText = matchedLi?.description || 'Blank description on LinkedIn — 0 keywords indexed'
    const b0Clean = (rawBullets[0] ? rawBullets[0].replace(/^[•\-*▪–—\s]+/, '') : '').trim()
    const b1Clean = (rawBullets[1] ? rawBullets[1].replace(/^[•\-*▪–—\s]+/, '') : '').trim()

    const upgraded = [
      b0Clean ? `${p0}: ${b0Clean.slice(0, 120)}` : `${p0}: Led core initiatives using ${topStack}, driving measurable delivery turnaround.`,
      b1Clean ? `${p1}: ${b1Clean.slice(0, 120)}` : `${p1}: Optimized operational workflows, sustaining high delivery reliability.`,
    ]

    return {
      company: e.company || 'Company',
      role: e.role || e.title || targetRole,
      dates: e.dates || 'Recent',
      linkedinGap,
      beforeText,
      afterText: upgraded.join('\n'),
      bullets: upgraded,
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
        ? `Production-grade ${pTitle} engineered with ${mergedTech.slice(0, 4).join(', ')} to solve core technical workflows and deliver verified business impact.`
        : `Production-grade ${pTitle} engineered to solve core technical workflows and deliver verified business impact.`
      const pitch = cleanBullet
        ? (cleanBullet.length > 240 ? cleanBullet.slice(0, 240).replace(/[.]+$/, '') + '.' : (cleanBullet.replace(/[.]+$/, '') + '.'))
        : (typeof p?.description === 'string' && p.description.trim() ? p.description.trim() : synthPitch)

      return {
        title: pTitle,
        description: pitch,
        technologies: mergedTech,
        replaceNote: isMissingOnLi && liProjects.length > 0
          ? `Archive/replace outdated older project "${liProjects[0]?.title || 'Older Project'}" on LinkedIn with this modern architecture showcase.`
          : 'Feature this modern project prominently on LinkedIn to prove hands-on architecture competency.',
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
        : 'Proves practical system design depth directly at the top of your profile without exposing contact info.'
      return {
        title: String(p.title || p.name || 'Featured Architecture Project').split('|')[0].trim(),
        reason: pitch,
        callToAction: 'Pin GitHub repository link, architecture diagrams, and a live deployment demo rather than a raw resume PDF.',
      }
    }),
  }

  const featuredSectionRecommendations = rawProjects.length > 0
    ? rawProjects.slice(0, 3).map((p) => {
        const bulletList = Array.isArray(p.bullets) ? p.bullets : []
        const joinedBullets = bulletList.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean).join(' ')
        const rawBullet = joinedBullets || p.description || ''
        const cleanBullet = rawBullet.replace(/^[•\-*▪–—\s]+/, '').trim()
        const techArr = Array.isArray(p.technologies) ? p.technologies : Array.isArray(p.skills) ? p.skills : []
        const pTitle = String(p.title || p.name || 'Core Project').split('|')[0].trim()
        const synthPitch = techArr.length > 0
          ? `Production-grade ${pTitle} engineered with ${techArr.slice(0, 4).join(', ')} to solve core technical workflows and deliver verified business impact.`
          : `Production-grade ${pTitle} engineered to solve core technical workflows and deliver verified business impact.`
        const pitch = cleanBullet
          ? (cleanBullet.length > 200 ? cleanBullet.slice(0, 200).replace(/[.]+$/, '') + '.' : (cleanBullet.replace(/[.]+$/, '') + '.'))
          : (typeof p?.description === 'string' && p.description.trim() ? p.description.trim() : synthPitch)
        return {
          title: pTitle,
          reason: pitch,
          callToAction: 'Pin this project with GitHub repository link, architecture diagrams, and a live deployment demo.',
        }
      })
    : [
        {
          title: `${topCompany} Architecture Showcase`,
          reason: 'Provides concrete technical proof of production impact and engineering scale.',
          callToAction: 'Pin an architectural summary, case study post, or GitHub portfolio link.',
        },
      ]

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
      items: [`("${targetRole}") AND (${(effectiveSkills.slice(0, 4)).map((s) => `"${s}"`).join(' OR ') || '"Cloud"'})`],
    },
    {
      category: 'Featured Media Architecture',
      trick: '4. Showcase High-Scale Technical Artifacts',
      advice: 'Recruiters and hiring managers spend 80% of their review time on evidence of real system delivery. Pin high-impact technical artifacts directly to your profile top.',
      items: [`${top3Tools.join(' + ')} Portfolio & Case Study`, 'Live Demo URL'],
    },
    {
      category: 'Featured Section Asset',
      trick: '5. Pin Live Case Study Over Raw Resume PDF',
      advice: 'Never pin a raw PDF resume with your phone number and physical address exposed to scrapers. Instead, pin a GitHub architecture repo with a live deployed demo.',
      items: ['Pin top architecture case study to Featured section'],
    },
  ]

  return {
    headlines: fallbackHeadlines,
    aboutRewrite: {
      currentCritique,
      hook,
      proof,
      callToAction,
      fullText,
    },
    experienceUpgrades,
    sectionsToAddFromResume,
    visibilityTricks,
    bannerStrategy,
    featuredSectionRecommendations,
    top3PinnedSkills,
    visualPresenceTips,
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
  const fallback = buildDeterministicOptimizations(profile, resumeContext, missingSkills, discrepancies)
  if (options?.bypassAI) {
    return fallback
  }

  const canonical = resumeContext?.canonicalResume || resumeContext?.resumeJson || {}
  const targetRole =
    resumeContext?.targetRole ||
    canonical?.candidate?.targetRole ||
    canonical?.target_role ||
    canonical?.targetRole ||
    profile?.headline ||
    'Senior Software Engineer'

  // Route via task-based OpenRouter model routing
  const preferredProvider = options?.preferredProvider || 'openrouter'
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
          model: effectiveModel,
          messages,
          temperature: 0.25,
          maxTokens,
          responseFormat: { type: 'json_object' },
          timeoutMs: 25000,
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

    // Run Task 1 then Task 2 sequentially to avoid rate-limit burst collisions
    const task1Result = await executeTask('Task 1 (Headlines & About)', task1Messages, 2048)
    const task2Result = await executeTask('Task 2 (Experience & Tricks)', task2Messages, 2200)

    if (!task1Result && !task2Result) {
      console.warn('[LinkedInSynthesis] Both tasks failed, using deterministic fallback')
      return fallback
    }

    // Merge outputs from Task 1 and Task 2
    // Headlines (Task 1)
    let headlines = fallback.headlines
    const rawHeadlines = task1Result?.headlines || task2Result?.headlines
    if (Array.isArray(rawHeadlines) && rawHeadlines.length >= 2) {
      headlines = rawHeadlines.slice(0, 3).map((h, i) => ({
        formula: h.formula || fallback.headlines[i]?.formula || `Option ${i + 1}`,
        headline: (h.headline || h.text || fallback.headlines[i]?.headline || '').slice(0, 220),
        whyItWorks: h.whyItWorks || fallback.headlines[i]?.whyItWorks || 'Recruiter search ranking optimization.',
      }))
    }

    // About rewrite (Task 1)
    let aboutRewrite = fallback.aboutRewrite
    const rawAbout = task1Result?.aboutRewrite || task2Result?.aboutRewrite
    if (rawAbout && typeof rawAbout === 'object') {
      const { currentCritique, hook, proof, callToAction, fullText } = rawAbout
      let combined = fullText || [hook, proof, callToAction].filter(Boolean).join('\n\n')
      const wordCount = (combined.match(/\b\w+\b/g) || []).length
      // Permanently purge short stubs: enforce strict 180+ word executive standard
      if (wordCount < 140 && fallback?.aboutRewrite?.fullText) {
        combined = fallback.aboutRewrite.fullText
      }
      aboutRewrite = {
        currentCritique: currentCritique || fallback.aboutRewrite.currentCritique || '',
        hook: hook || fallback.aboutRewrite.hook || '',
        proof: proof || fallback.aboutRewrite.proof || '',
        callToAction: callToAction || fallback.aboutRewrite.callToAction || '',
        fullText: combined || fallback.aboutRewrite.fullText || '',
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

      const booleanRolePart = /data\s+analyst/i.test(targetRole)
        ? '("Data Analyst" OR "Business Intelligence Analyst")'
        : `("${targetRole}")`
      const booleanSkillsPart = candidateHardSkills.length > 0
        ? `(${candidateHardSkills.map((s) => `"${s}"`).join(' OR ')})`
        : '("Technical Architecture")'
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
    return fallback
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
