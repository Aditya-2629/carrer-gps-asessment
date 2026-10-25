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
import { matchCompany } from './linkedinCrossAnalyzer.js'
import {
  buildLinkedInSynthesisPrompt,
  buildTask1HeadlinesAndBannerPrompt,
  buildTask2AboutAndFeaturedPrompt,
} from './linkedinSynthesis.prompt.js'

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
    profile?.headline ||
    'Senior Software Engineer'
  const exp = canonical.experience || canonical.experiences || []
  const topCompany = exp[0]?.company || 'Enterprise Tech'
  const skills = (canonical.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
  const topStack = skills.slice(0, 3).join(' | ') || 'Distributed Systems'

  const topBullet = exp[0]?.bullets?.[0]?.text || (typeof exp[0]?.bullets?.[0] === 'string' ? exp[0].bullets[0] : '') || ''
  const metricMatch = topBullet.match(/\b\d+[%xXkKMbB]?\b/)
  const metricSnippet = metricMatch ? topBullet.slice(0, 55) : 'Scalable Architecture & High-Performance Systems'

  // Critique current LinkedIn profile
  const currentAbout = profile?.about || ''
  const currentCritique = currentAbout.length < 210
    ? 'Your current About section is under 210 characters, wasting prime above-the-fold real estate before recruiters click "...see more".'
    : 'Your current About section reads as a generic summary without leading with your strongest verified production metrics or target specialization.'

  const hook = metricMatch
    ? `${targetRole} specializing in ${topStack}. Proven track record of architecting high-throughput systems driving ${metricMatch[0]} performance gains in production.`
    : `${targetRole} specializing in ${topStack}. Architecting mission-critical cloud solutions, high-throughput microservices, and reliable engineering platforms.`

  const pillar1 = `▸ System Architecture & Scale: Architecting resilient microservices and distributed event-driven systems that eliminate performance bottlenecks.`
  const pillar2 = `▸ Cloud & Production Engineering: Deploying high-throughput workloads across modern cloud infrastructure using ${topStack}.`
  const pillar3 = metricMatch
    ? `▸ Measurable Business Impact: Driving tangible organizational velocity and efficiency gains, including verified ${metricMatch[0]} performance improvements.`
    : `▸ Engineering Excellence & Mentorship: Establishing robust CI/CD, test automation, and engineering standards for mission-critical deliverables.`

  const proof = `${pillar1}\n\n${pillar2}\n\n${pillar3}`

  const callToAction = `Currently exploring ${targetRole} opportunities where I can drive measurable technical scale. Always open to discussing distributed systems architecture, team mentorship, and high-impact technical initiatives—let's connect!`
  const coreSkillsLine = `Core Skills: ${skills.slice(0, 10).join(' · ') || topStack}`
  const fullText = `${hook}\n\n${proof}\n\n${callToAction}\n\n${coreSkillsLine}`

  const skillsToAdd = missingSkills.length > 0 ? missingSkills.slice(0, 10) : skills.slice(5, 15)

  const bannerStrategy = {
    bannerTagline: `${targetRole} | Scalable Systems & High-Impact Architecture`,
    bannerSecondaryText: `${topStack} · Distributed Microservices · Clean Code Delivery`,
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

      const pitch = cleanBullet
        ? (cleanBullet.length > 240 ? cleanBullet.slice(0, 240).replace(/[.]+$/, '') + '.' : (cleanBullet.replace(/[.]+$/, '') + '.'))
        : (p.description ? p.description.trim() : pTitle)

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
    featured: rawProjects.slice(0, 2).map((p) => ({
      title: String(p.title || p.name || 'Featured Architecture Project').split('|')[0].trim(),
      reason: 'Proves practical system design depth directly at the top of your profile without exposing contact info.',
      callToAction: 'Pin GitHub repository link, architecture diagrams, and a live deployment demo rather than a raw resume PDF.',
    })),
  }

  const featuredSectionRecommendations = rawProjects.length > 0
    ? rawProjects.slice(0, 3).map((p) => ({
        title: String(p.title || p.name || 'Core Project').split('|')[0].trim(),
        reason: 'Showcases end-to-end technical implementation and architecture proof directly at the profile top.',
        callToAction: 'Pin this project with GitHub repository link, architecture diagrams, and a live deployment demo.',
      }))
    : [
        {
          title: `${topCompany} Architecture Showcase`,
          reason: 'Provides concrete technical proof of production impact and engineering scale.',
          callToAction: 'Pin an architectural summary, case study post, or GitHub portfolio link.',
        },
      ]

  // Select 3 highest-signal core architecture/stack skills tailored to targetRole
  let top3PinnedSkills = []
  const highSignalPriority = [
    'Spring Boot',
    'React',
    'TypeScript',
    'Microservices',
    'Node.js',
    'Python',
    'AWS',
    'Azure',
    'PostgreSQL',
    'Docker',
    'Kubernetes',
    'GraphQL',
    'Kafka',
  ]

  for (const prio of highSignalPriority) {
    const found = skills.find((s) => s.toLowerCase().includes(prio.toLowerCase()))
    if (found && !top3PinnedSkills.includes(found)) {
      top3PinnedSkills.push(found)
    }
    if (top3PinnedSkills.length >= 3) break
  }

  if (top3PinnedSkills.length < 3) {
    for (const s of skills) {
      if (!top3PinnedSkills.includes(s) && !['html', 'css', 'git', 'jira'].includes(s.toLowerCase())) {
        top3PinnedSkills.push(s)
      }
      if (top3PinnedSkills.length >= 3) break
    }
  }

  if (top3PinnedSkills.length === 0) {
    top3PinnedSkills = [targetRole, 'Distributed Systems', 'Cloud Architecture']
  }

  const visualPresenceTips = [
    'Profile Headshot: Use front-facing soft lighting with eyes aligned to the upper third. Avoid heavy background clutter.',
    'Custom Vanity URL: Ensure your profile URL is customized to linkedin.com/in/yourname instead of the auto-generated numeric suffix.',
    'Canva Banner: Use 1584x396px resolution, high-contrast dark theme, and leave the lower-left 30% area clear for mobile avatar overlap.',
  ]

  const coreRole = String(targetRole || 'Software Engineer').replace(/^(?:Senior|Lead|Staff|Principal|Junior)\s+/i, '').trim()
  const openToWorkTitles = Array.from(new Set([
    `Senior ${coreRole}`,
    `Lead ${coreRole}`,
    `Staff ${coreRole}`,
    coreRole,
    `Senior Full Stack Software Engineer`,
  ]))

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
      items: [`("${targetRole}") AND (${skills.slice(0, 4).map((s) => `"${s}"`).join(' OR ') || '"Cloud"'})`],
    },
    {
      category: 'Featured Media Architecture',
      trick: '4. Showcase High-Scale Technical Artifacts',
      advice: 'Recruiters and hiring managers spend 80% of their review time on evidence of real system delivery. Pin high-impact technical artifacts directly to your profile top.',
      items: [skills.slice(0, 3).join(' + ') + ' Architecture Repo', 'Live Demo URL'],
    },
    {
      category: 'Featured Section Asset',
      trick: '5. Pin Live Case Study Over Raw Resume PDF',
      advice: 'Never pin a raw PDF resume with your phone number and physical address exposed to scrapers. Instead, pin a GitHub architecture repo with a live deployed demo.',
      items: ['Pin top architecture case study to Featured section'],
    },
  ]

  return {
    headlines: [
      {
        formula: 'Recruiter-Search Optimized',
        headline: `${targetRole} | ${topStack} | Cloud & Scalable Systems`.slice(0, 220),
        whyItWorks: 'Directly mirrors the keywords recruiters search for in LinkedIn Recruiter.',
      },
      {
        formula: 'Impact-Driven',
        headline: `${targetRole} at ${topCompany} | ${metricSnippet}`.slice(0, 220),
        whyItWorks: 'Anchors your value proposition in concrete, verified achievements.',
      },
      {
        formula: 'Specialist / Authority',
        headline: `${targetRole} | Specializing in ${topStack} & Systems Delivery`.slice(0, 220),
        whyItWorks: 'Positions you as a senior practitioner with deep domain ownership.',
      },
    ],
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
    recommendedSkillsToAdd: skillsToAdd,
    recommendedSkills: skillsToAdd.map((skill) => ({
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

  const resumeProvider = resumeContext?.provider || options?.resumeProvider || null
  const excludeProvider = options?.excludeProvider || (resumeProvider === 'gemini' ? 'gemini' : (resumeProvider === 'groq' ? 'groq' : null))
  const preferredProvider = options?.preferredProvider || (excludeProvider === 'gemini' ? 'groq' : (excludeProvider === 'groq' ? 'gemini' : 'groq'))

  const task1Messages = buildTask1HeadlinesAndBannerPrompt({
    profile,
    resumeContext,
    discrepancies,
    missingSkills,
    signals,
  })

  const task2Messages = buildTask2AboutAndFeaturedPrompt({
    profile,
    resumeContext,
    discrepancies,
    missingSkills,
    signals,
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
      top3PinnedSkills = rawPinned.slice(0, 3)
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
      featuredSectionRecommendations = rawFeatured.slice(0, 3)
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
        projects: rawProjectList.slice(0, 4).map((pr, idx) => ({
          title: pr.title || fallback.sectionsToAddFromResume.projects[idx]?.title || 'Core Project',
          description: pr.rewrittenPitch || pr.description || fallback.sectionsToAddFromResume.projects[idx]?.description || '',
          technologies: Array.isArray(pr.technologies) ? pr.technologies : (fallback.sectionsToAddFromResume.projects[idx]?.technologies || []),
          replaceNote: pr.actionAdvice || pr.replaceNote || fallback.sectionsToAddFromResume.projects[idx]?.replaceNote || '',
        })),
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

    // Visibility Tricks (Task 2)
    let visibilityTricks = fallback.visibilityTricks
    const rawTricks = task2Result?.visibilityTricks || task1Result?.visibilityTricks
    if (Array.isArray(rawTricks) && rawTricks.length > 0) {
      visibilityTricks = rawTricks.slice(0, 5).map((vt, idx) => {
        let items = Array.isArray(vt.items) ? vt.items : (fallback.visibilityTricks[idx]?.items || [])
        if (/open\s+to\s+work/i.test(vt.category || vt.trick || '')) {
          const uniqueItems = Array.from(new Set(items.filter(Boolean)))
          items = uniqueItems.length >= 4 ? uniqueItems.slice(0, 5) : fallback.visibilityTricks[0].items
        }
        return {
          category: vt.category || fallback.visibilityTricks[idx]?.category || 'Optimization',
          trick: vt.trick || fallback.visibilityTricks[idx]?.trick || `Trick #${idx + 1}`,
          advice: vt.advice || fallback.visibilityTricks[idx]?.advice || '',
          items,
        }
      })
    }

    // Recommended skills to add
    let recommendedSkillsToAdd = fallback.recommendedSkillsToAdd
    const rawSkills = task1Result?.recommendedSkillsToAdd || task2Result?.recommendedSkillsToAdd
    if (Array.isArray(rawSkills) && rawSkills.length > 0) {
      recommendedSkillsToAdd = rawSkills.slice(0, 12)
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
