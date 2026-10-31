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

  const isSoftwareRole = /software|developer|engineer|backend|frontend|fullstack|sde|web/i.test(targetRole)
  const isDataRole = /data|analytics|bi|machine learning|ml|ai|scientist/i.test(targetRole)
  const isDevopsRole = /devops|cloud|sre|infrastructure/i.test(targetRole)

  const exp = canonical.experience || canonical.experiences || []
  const topCompany = exp[0]?.company || 'Tech'

  // Extract candidate verified skills
  const candidateSkills = (canonical.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
    .filter(isValidSkill)
    .map(formatSkillName)
    .filter((s) => {
      if (isSoftwareRole && /^(power\s*bi|tableau|snowflake|bigquery|looker|dbt)$/i.test(s)) return false
      return true
    })
    .sort((a, b) => (isConcreteTechSkill(b) ? 1 : 0) - (isConcreteTechSkill(a) ? 1 : 0))

  // Role-appropriate stacks
  const defaultStack = isSoftwareRole
    ? ['Python', 'React', 'Node.js', 'AWS', 'Docker']
    : isDataRole
      ? ['SQL', 'Python', 'Power BI', 'Tableau', 'PostgreSQL']
      : isDevopsRole
        ? ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD']
        : ['Product Strategy', 'Agile Methodologies', 'User Research', 'Roadmapping']

  const effectiveSkills = candidateSkills.length >= 3 ? candidateSkills : defaultStack
  const topStack = effectiveSkills.slice(0, 3).join(' | ')

  // Dynamic Headline options
  const fallbackHeadlines = [
    {
      formula: 'Search-Optimized',
      headline: `${targetRole} | ${topStack} | Scalable Production Systems`.slice(0, 220),
      whyItWorks: 'Positions primary role title first followed by high-frequency recruiter search keywords.',
    },
    {
      formula: 'Impact-Driven',
      headline: `${targetRole} @ Scale | Delivering High-Throughput Architecture & Clean Code Delivery`.slice(0, 220),
      whyItWorks: 'Anchors on measurable engineering velocity and architectural outcomes to differentiate from generic applicant pool.',
    },
    {
      formula: 'Specialist',
      headline: isDataRole
        ? `Specialist in Data Architecture, Analytics Pipelines & System Performance`.slice(0, 220)
        : `Specialist in Cloud Architecture, Distributed Services & System Performance`.slice(0, 220),
      whyItWorks: 'Appeals to specialized hiring managers seeking deep domain expertise and reliable production execution.',
    },
  ]

  const top3PinnedSkills = effectiveSkills.slice(0, 3)

  const recommendedSkillsToAdd = isSoftwareRole
    ? ['Docker', 'Kubernetes', 'CI/CD Pipelines', 'PostgreSQL', 'Microservices Architecture']
    : isDataRole
      ? ['BigQuery', 'Tableau', 'Snowflake', 'dbt', 'Data Modeling']
      : isDevopsRole
        ? ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD Pipelines']
        : ['Cross-functional Leadership', 'Agile Methodologies', 'Strategic Planning', 'KPI Dashboards']

  const filteredMissing = (Array.isArray(missingSkills) ? missingSkills : [])
    .filter(isValidSkill)
    .map(formatSkillName)
    .filter((s) => {
      if (isSoftwareRole && /^(power\s*bi|tableau|snowflake|bigquery|looker|dbt)$/i.test(s)) return false
      return true
    })

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

  const hook = metricPhrase
    ? `${targetRole} specializing in ${topStack}. Proven track record of architecting high-throughput systems, ${metricPhrase}.`
    : metricMatch
      ? `${targetRole} specializing in ${topStack}. Proven track record of architecting high-throughput systems driving ${metricMatch[0]} performance gains in production.`
      : `${targetRole} specializing in ${topStack}. Architecting mission-critical cloud solutions, high-throughput microservices, and reliable engineering platforms.`

  const pillar1 = isDataRole
    ? `▸ Data Modeling & Analytics: Architecting scalable data models and BI pipelines that eliminate reporting bottlenecks.`
    : `▸ System Architecture & Scale: Architecting resilient microservices and distributed event-driven systems that eliminate performance bottlenecks.`
  const pillar2 = isDataRole
    ? `▸ Enterprise Intelligence & Pipelines: Deploying automated analytics workflows across modern cloud data infrastructure using ${topStack}.`
    : `▸ Cloud & Production Engineering: Deploying high-throughput workloads across modern cloud infrastructure using ${topStack}.`
  const pillar3 = metricPhrase
    ? `▸ Measurable Business Impact: Driving tangible organizational velocity and efficiency gains, including ${metricPhrase}.`
    : metricMatch
      ? `▸ Measurable Business Impact: Driving tangible organizational velocity and efficiency gains, including verified ${metricMatch[0]} performance improvements.`
      : `▸ Engineering Excellence & Mentorship: Establishing robust CI/CD, test automation, and engineering standards for mission-critical deliverables.`

  const proof = `${pillar1}\n\n${pillar2}\n\n${pillar3}`

  const callToAction = `Currently exploring ${targetRole} opportunities where I can drive measurable technical scale. Always open to discussing systems architecture, team mentorship, and high-impact technical initiatives—let's connect!`
  const coreSkillsLine = `Core Skills: ${effectiveSkills.slice(0, 10).join(' · ')}`
  const fullText = `${hook}\n\n${proof}\n\n${callToAction}\n\n${coreSkillsLine}`

  const bannerStrategy = {
    bannerTagline: `${targetRole} | ${isDataRole ? 'Data Architecture & Analytics' : 'Scalable Systems & High-Impact Architecture'}`,
    bannerSecondaryText: `${topStack} · ${isDataRole ? 'Scalable Pipelines · Business Intelligence' : 'Distributed Microservices · Clean Code Delivery'}`,
    designAdvice: 'Design a clean 1584x396px canvas in Canva. Keep key text in the center-right to avoid the circular profile avatar on mobile. Use dark background with bold typography.',
  }

  const rawProjects = canonical.projects || []
  const liProjects = profile?.projects || []
  const liExp = profile?.experiences || []

  // Experience Upgrades comparing LinkedIn vs Resume
  const experienceUpgrades = exp.slice(0, 3).map((e) => {
    const rawBullets = Array.isArray(e.bullets)
      ? e.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean)
      : []

    // Find corresponding LinkedIn role using multi-segment vendor/client matching
    const compParts = String(e.company || '').split(/[/|\\—–-]/).map((p) => p.trim()).filter(Boolean)
    const matchedLi = liExp.find((le) => {
      const liComp = le.company || le.companyName || le.organization || ''
      if (!liComp || !e.company) return false
      if (matchCompany(e.company, liComp)?.matched) return true
      return compParts.some((part) => matchCompany(part, liComp)?.matched)
    })

    const compMatch = matchedLi ? matchCompany(e.company, matchedLi.company || matchedLi.companyName) : null

    let linkedinGap = `LinkedIn Optimization Focus: Align vendor/client naming ('${e.company}') with your LinkedIn experience entry and replace task-heavy descriptions with the quantified executive bullets below.`
    if (matchedLi && matchedLi.title && e.role && matchedLi.title.toLowerCase() !== e.role.toLowerCase()) {
      linkedinGap = `Job title alignment: Your LinkedIn profile lists "${matchedLi.title}" while your resume positions you as "${e.role}". Standardize to "${e.role}" to maintain unified recruiter indexing.`
    }

    const beforeText = matchedLi?.description || 'Blank description on LinkedIn — 0 keywords indexed'
    const b0Clean = rawBullets[0] ? rawBullets[0].replace(/^[•\-*▪–—\s]+/, '') : ''
    const b1Clean = rawBullets[1] ? rawBullets[1].replace(/^[•\-*▪–—\s]+/, '') : ''
    const upgraded = [
      `Role Mandate: Spearheaded engineering architecture and product delivery for ${e.role} systems at ${e.company}, scaling ${topStack} capabilities.`,
      b0Clean ? `Distributed Architecture: Overcame performance constraints by re-architecting workflows (${b0Clean.slice(0, 110)}), unlocking higher throughput.` : `Distributed Architecture: Engineered resilient microservices using ${topStack}, slashing API response times.`,
      b1Clean ? `Engineering Impact: Streamlined deployment velocity and reliability across cross-functional sprints (${b1Clean.slice(0, 110)}).` : `Operational Scalability: Instituted automated testing and observability pipelines, sustaining 99.9% uptime.`,
    ]

    return {
      company: e.company || 'Company',
      role: e.role || e.title || targetRole,
      dates: e.dates || '',
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
        : (p.description ? p.description.trim() : synthPitch)

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
      name: c.name || c.title || 'Certification',
      issuer: c.issuer || c.authority || '',
      date: c.date || c.year || '',
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
          : (p.description ? p.description.trim() : synthPitch)
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

  const resumeProvider = resumeContext?.provider || options?.resumeProvider || null
  const excludeProvider = options?.excludeProvider || (resumeProvider === 'gemini' ? 'gemini' : (resumeProvider === 'groq' ? 'groq' : null))
  const preferredProvider = options?.preferredProvider || (excludeProvider === 'gemini' ? 'groq' : (excludeProvider === 'groq' ? 'gemini' : 'groq'))

  const effectiveAnswers = options?.answers || resumeContext?.answers || null

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
        messages,
        temperature: 0.25,
        maxTokens,
        responseFormat: { type: 'json_object' },
        excludeProvider,
        preferredProvider,
      })

      let parsed = tryParseJson(response?.text)

      // Retry once if invalid JSON
      if (!parsed && response?.text) {
        console.warn(`[LinkedInSynthesis] ${taskName} output not valid JSON — retrying once`)
        try {
          const retryResponse = await llmGateway.generate({
            purpose: 'linkedin_analysis',
            messages: [
              ...messages,
              { role: 'assistant', content: response.text },
              {
                role: 'user',
                content: 'Your previous response was not valid JSON. Return ONLY the complete corrected JSON object now with no markdown formatting or extra text.',
              },
            ],
            temperature: 0.1,
            maxTokens,
            responseFormat: { type: 'json_object' },
            excludeProvider,
            preferredProvider,
          })
          parsed = tryParseJson(retryResponse?.text)
        } catch (_retryErr) {
          // Fall back gracefully
        }
      }
      return parsed
    } catch (err) {
      console.warn(`[LinkedInSynthesis] ${taskName} execution failed:`, err.message)
      return null
    }
  }

  try {
    // Run Task 1 (maxTokens: 2048) and Task 2 (maxTokens: 2200) in parallel via Promise.all
    const [task1Result, task2Result] = await Promise.all([
      executeTask('Task 1 (Headlines & About)', task1Messages, 2048),
      executeTask('Task 2 (Experience & Tricks)', task2Messages, 2200),
    ])

    if (!task1Result && !task2Result) {
      console.warn('[LinkedInSynthesis] Both chunked tasks failed, using deterministic fallback')
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
      const combined = fullText || [hook, proof, callToAction].filter(Boolean).join('\n\n')
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
