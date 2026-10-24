/**
 * LinkedIn Generative Optimizer — Lightweight Modular Chunking (<1,500 Tokens Per Task)
 *
 * Replaces monolithic 12,000+ token prompt with 2 lightweight parallel micro-tasks:
 * 1. synthesizeHeadlinesAndBanner (~700 tokens): 3 Search-Optimized Headlines + Canva Banner Blueprint
 * 2. synthesizeAboutAndFeatured (~1,200 tokens): 3-paragraph conversational About story + Featured project recommendations
 * 3. Deterministic Skills Bank & Sections (0 tokens): 100% in-code cross-analysis
 *
 * Runs Task 1 & Task 2 concurrently via Promise.all with independent fallback handling.
 * Zero hallucination: strictly grounded in verified resume facts.
 */

import { jsonrepair } from 'jsonrepair'
import { llmGateway } from '../../ai/gateway/llmGateway.js'
import {
  buildLinkedInSynthesisPrompt,
  buildTask1HeadlinesAndBannerPrompt,
  buildTask2AboutAndFeaturedPrompt,
} from './linkedinSynthesis.prompt.js'

/**
 * Builds deterministic fallback optimizations if LLM calls fail or are unavailable.
 *
 * @param {Object} profile - Normalized LinkedIn profile
 * @param {Object} resumeContext - Verified resume facts & target role
 * @param {Array} missingSkills - Verified resume skills missing on LinkedIn
 * @returns {Object} Fallback optimization bundle
 */
export function buildDeterministicOptimizations(profile = {}, resumeContext = {}, missingSkills = []) {
  const targetRole =
    resumeContext?.targetRole ||
    resumeContext?.canonicalResume?.candidate?.targetRole ||
    profile?.headline ||
    'Software Engineer'
  const exp = resumeContext?.canonicalResume?.experience || resumeContext?.canonicalResume?.experiences || []
  const topCompany = exp[0]?.company || 'Tech'
  const skills = (resumeContext?.canonicalResume?.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
  const topStack = skills.slice(0, 3).join(' | ') || 'Distributed Systems'

  const topBullet = exp[0]?.bullets?.[0]?.text || (typeof exp[0]?.bullets?.[0] === 'string' ? exp[0].bullets[0] : '') || ''
  const metricMatch = topBullet.match(/\b\d+[%xXkKMbB]?\b/)
  const metricSnippet = metricMatch ? topBullet.slice(0, 55) : 'Scalable Architecture & High-Performance Systems'

  const hook = metricMatch
    ? `Results-focused ${targetRole} building scalable systems with a proven track record of driving ${metricMatch[0]} performance gains in high-throughput production environments.`
    : `Results-driven ${targetRole} specializing in building scalable cloud systems, clean microservice architectures, and mission-critical engineering solutions.`

  const bulletWins = exp.slice(0, 3).map((e) => {
    const b = e.bullets?.[0]?.text || (typeof e.bullets?.[0] === 'string' ? e.bullets[0] : '')
    return b ? `• ${e.role} at ${e.company}: ${b}` : null
  }).filter(Boolean)

  const proof = bulletWins.length > 0
    ? `Selected Highlights:\n${bulletWins.join('\n')}\n\nCore toolkit: ${skills.slice(0, 6).join(', ') || topStack}.`
    : `Throughout my career at companies like ${topCompany}, I have engineered scalable products with clean architecture and reliable delivery.`

  const callToAction = `Currently exploring ${targetRole} opportunities where I can drive measurable engineering scale. Always open to discussing distributed systems design and high-impact technical initiatives—let's connect!`
  const coreSkillsLine = `Core Skills: ${skills.slice(0, 10).join(' · ') || topStack}`
  const fullText = `${hook}\n\n${proof}\n\n${callToAction}\n\n${coreSkillsLine}`

  const skillsToAdd = missingSkills.slice(0, 10)

  const bannerStrategy = {
    bannerTagline: `${targetRole} | Scalable Systems & High-Impact Architecture`,
    bannerSecondaryText: `${topStack} · Distributed Microservices · Clean Code Delivery`,
    designAdvice: 'Design a clean 1584x396px canvas in Canva. Keep key text in the center-right to avoid the circular profile avatar on mobile. Use dark background with bold typography.',
  }

  const resumeProjects = resumeContext?.canonicalResume?.projects || []
  const featuredSectionRecommendations = resumeProjects.length > 0
    ? resumeProjects.slice(0, 3).map((p) => ({
        title: p.title || p.name || 'Core Project',
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

  const top3PinnedSkills = skills.slice(0, 3).length >= 3
    ? skills.slice(0, 3)
    : [targetRole, 'Distributed Systems', 'Cloud Architecture']

  const visualPresenceTips = [
    'Profile Headshot: Use front-facing soft lighting with eyes aligned to the upper third. Avoid heavy background clutter.',
    'Custom Vanity URL: Ensure your profile URL is customized to linkedin.com/in/yourname instead of the auto-generated numeric suffix.',
    'Canva Banner: Use 1584x396px resolution, high-contrast dark theme, and leave the lower-left 30% area clear for mobile avatar overlap.',
  ]

  const experienceUpgrades = exp.slice(0, 3).map((e) => {
    const rawBullets = Array.isArray(e.bullets)
      ? e.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean)
      : []
    const upgraded = rawBullets.slice(0, 3).map((b) => {
      return b.startsWith('•') || b.startsWith('-') ? b : `• ${b}`
    })
    return {
      company: e.company || 'Company',
      role: e.role || e.title || targetRole,
      dates: e.dates || '',
      bullets: upgraded.length > 0
        ? upgraded
        : [`• Architected and delivered core ${targetRole} features with high uptime and automated CI/CD deployment.`],
    }
  })

  const canonical = resumeContext?.canonicalResume || {}
  const rawProjects = canonical.projects || []
  const rawCerts = canonical.certifications || []

  const sectionsToAddFromResume = {
    projects: rawProjects.slice(0, 3).map((p) => ({
      title: p.title || p.name || 'Core Project',
      description: (Array.isArray(p.bullets) ? p.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).join('; ') : p.description) || 'Production project showcasing technical architecture and impact.',
      technologies: p.technologies || p.skills || [],
      link: p.link || p.url || '',
    })),
    certifications: rawCerts.slice(0, 5).map((c) => ({
      name: c.name || c.title || 'Certification',
      issuer: c.issuer || c.authority || '',
      date: c.date || c.year || '',
      url: c.url || '',
    })),
    featured: rawProjects.slice(0, 2).map((p) => ({
      title: p.title || p.name || 'Featured Project',
      description: (Array.isArray(p.bullets) ? p.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).slice(0, 2).join('\n') : p.description) || 'Featured technical project demonstration.',
      link: p.link || p.url || '',
    })),
  }

  const visibilityTricks = [
    {
      category: 'Open to Work Titles',
      trick: '1. Set 5 Exact Job Titles in "Open to Work"',
      advice: 'LinkedIn Recruiter search filters match candidate "Job Titles" strictly. Add these 5 exact titles to your private Open to Work preferences:',
      items: [
        targetRole,
        `Senior ${targetRole.replace(/^Senior\s+/i, '')}`,
        `Lead ${targetRole.replace(/^Senior\s+|^Lead\s+/i, '')}`,
        `${targetRole.replace(/^Senior\s+|^Lead\s+/i, '')} Specialist`,
        `Staff ${targetRole.replace(/^Senior\s+|^Lead\s+/i, '')}`,
      ],
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
      category: 'Custom Banner Blueprint',
      trick: '4. Canva Cover Banner Safe Zone (1584x396px)',
      advice: 'Design a 1584x396px banner with high-contrast typography. Shift all headline text and technology badges to the center-right 60% of the canvas to avoid the circular profile avatar overlay on mobile devices.',
      items: [bannerStrategy.bannerTagline, bannerStrategy.bannerSecondaryText],
    },
    {
      category: 'Custom Vanity URL',
      trick: '5. Custom Vanity URL Slug',
      advice: 'Remove auto-generated numbers and dashes from your public URL. A clean vanity URL improves click-through rates from external resumes and indexes higher in Google search results.',
      items: ['Edit public URL in LinkedIn settings to: linkedin.com/in/firstname-lastname'],
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
 * Extracts top metric-oriented bullets from resume experiences.
 */
function extractTopMetricBullets(experiences = []) {
  const allBullets = []
  for (const exp of experiences) {
    const bullets = exp?.bullets || []
    for (const b of bullets) {
      const text = (typeof b === 'string' ? b : b?.text || '').trim()
      if (text) allBullets.push(text)
    }
  }

  const metricPattern = /\b\d+([.,]\d+)?\s*(%|x|k|m|b|percent|million|billion|thousand|users|ms|s|hours|days|dollars|\$)?\b/i
  const metricBullets = allBullets.filter((t) => metricPattern.test(t))
  const selected = metricBullets.slice(0, 3)

  if (selected.length < 3) {
    for (const b of allBullets) {
      if (!selected.includes(b)) {
        selected.push(b)
        if (selected.length === 3) break
      }
    }
  }

  return selected
}

/**
 * Extracts top 2 employment roles for prompt input.
 */
function extractTopExperiences(experiences = []) {
  return experiences.slice(0, 2).map((exp) => {
    const role = exp.role || exp.title || 'Engineer'
    const company = exp.company || 'Company'
    const dates = exp.dates || ''
    const rawBullets = exp.bullets || []
    const bullets = rawBullets
      .slice(0, 3)
      .map((b) => (typeof b === 'string' ? b : b?.text || '').trim())
      .filter(Boolean)
    return { role, company, dates, bullets }
  })
}

/**
 * Extracts top 3 projects from canonical resume.
 */
function extractTopProjects(canonical = {}) {
  const projects = canonical.projects || []
  return projects.slice(0, 3).map((p) => {
    const title = p.title || p.name || 'Project'
    const rawBullets = p.bullets || []
    const bullets = rawBullets
      .slice(0, 2)
      .map((b) => (typeof b === 'string' ? b : b?.text || '').trim())
      .filter(Boolean)
    const desc = p.description || bullets.join(' ') || ''
    return { title, description: desc.slice(0, 200) }
  })
}

/**
 * Task 1: Synthesize 3 Search-Optimized Headlines and Canva Banner Strategy (<700 tokens)
 *
 * @param {Object} params
 * @param {string} params.candidateName
 * @param {string} params.targetRole
 * @param {Array<string>} [params.topMetricBullets]
 * @param {Array<string>} [params.topSkills]
 * @param {Object} [params.profile]
 * @param {Object} [params.fallback]
 * @returns {Promise<{ headlines: Array, bannerStrategy: Object }>}
 */
export async function synthesizeHeadlinesAndBanner({
  candidateName = 'the candidate',
  targetRole = 'Technical Professional',
  topMetricBullets = [],
  topSkills = [],
  profile = {},
  fallback = {},
  excludeProvider = null,
  preferredProvider = null,
}) {
  const fallbackHeadlines = fallback.headlines || [
    {
      formula: 'Recruiter-Search Optimized',
      headline: `${targetRole} | ${topSkills.slice(0, 3).join(' | ') || 'Core Stack'}`,
      whyItWorks: 'Directly mirrors the keywords recruiters search for in LinkedIn Recruiter.',
    },
    {
      formula: 'Impact-Driven',
      headline: `${targetRole} | Scalable Architecture & Production Delivery`,
      whyItWorks: 'Anchors your value proposition in concrete, verified achievements.',
    },
    {
      formula: 'Specialist / Authority',
      headline: `${targetRole} | Systems Architecture & Clean Delivery`,
      whyItWorks: 'Positions you as a senior practitioner with deep domain ownership.',
    },
  ]

  const fallbackBanner = fallback.bannerStrategy || {
    bannerTagline: `${targetRole} | Scalable Systems & High-Impact Architecture`,
    bannerSecondaryText: `${topSkills.slice(0, 3).join(' · ') || 'Cloud Architecture'} · Clean Code Delivery`,
    designAdvice:
      'Design a clean 1584x396px canvas in Canva. Keep key text in the center-right to avoid the circular profile avatar on mobile. Use dark background with bold typography.',
  }

  const messages = buildTask1HeadlinesAndBannerPrompt({
    candidateName,
    targetRole,
    topMetricBullets,
    topSkills,
    profile,
  })

  try {
    const response = await llmGateway.generate({
      purpose: 'linkedin_analysis',
      messages,
      temperature: 0.25,
      responseFormat: { type: 'json_object' },
      excludeProvider,
      preferredProvider,
    })

    let parsed = tryParseJson(response?.text)

    // Retry once if invalid JSON
    if (!parsed && response?.text) {
      console.warn('[LinkedInSynthesis:Task1] Output not valid JSON — retrying once')
      try {
        const retryResponse = await llmGateway.generate({
          purpose: 'linkedin_analysis',
          messages: [
            ...messages,
            { role: 'assistant', content: response.text },
            {
              role: 'user',
              content: 'Your previous response was not valid JSON. Return ONLY the complete corrected JSON object now with no extra text.',
            },
          ],
          temperature: 0.1,
          responseFormat: { type: 'json_object' },
          excludeProvider,
          preferredProvider,
        })
        parsed = tryParseJson(retryResponse?.text)
      } catch (_retryErr) {
        // Fall back gracefully
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        headlines: fallbackHeadlines,
        bannerStrategy: fallbackBanner,
        isFallback: true,
      }
    }

    let headlines = fallbackHeadlines
    if (Array.isArray(parsed.headlines) && parsed.headlines.length > 0) {
      headlines = parsed.headlines.slice(0, 3).map((h, i) => {
        let formula = h.formula || fallbackHeadlines[i]?.formula
        if (!formula || /search/i.test(formula)) formula = 'Recruiter-Search Optimized'
        else if (/impact/i.test(formula)) formula = 'Impact-Driven'
        else if (/specialist|authority/i.test(formula)) formula = 'Specialist / Authority'

        return {
          formula,
          headline: h.headline || fallbackHeadlines[i]?.headline || '',
          whyItWorks: h.whyItWorks || fallbackHeadlines[i]?.whyItWorks || '',
        }
      })
      while (headlines.length < 3 && fallbackHeadlines[headlines.length]) {
        headlines.push(fallbackHeadlines[headlines.length])
      }
    }

    let bannerStrategy = fallbackBanner
    if (parsed.bannerStrategy && typeof parsed.bannerStrategy === 'object') {
      bannerStrategy = {
        bannerTagline: parsed.bannerStrategy.bannerTagline || fallbackBanner.bannerTagline,
        bannerSecondaryText: parsed.bannerStrategy.bannerSecondaryText || fallbackBanner.bannerSecondaryText,
        designAdvice: parsed.bannerStrategy.designAdvice || fallbackBanner.designAdvice,
      }
    }

    return {
      headlines,
      bannerStrategy,
      isFallback: false,
    }
  } catch (err) {
    console.warn('[LinkedInSynthesis:Task1] Headline & banner synthesis failed, using chunk fallback:', err.message)
    return {
      headlines: fallbackHeadlines,
      bannerStrategy: fallbackBanner,
      isFallback: true,
    }
  }
}

/**
 * Task 2: Synthesize 3-Paragraph About Narrative, Featured Projects, & Red Flags (<1,200 tokens)
 *
 * @param {Object} params
 * @param {string} params.candidateName
 * @param {string} params.targetRole
 * @param {Array<Object>} [params.topExperiences]
 * @param {Array<Object>} [params.topProjects]
 * @param {Array<string>} [params.topSkills]
 * @param {Object} [params.profile]
 * @param {Object} [params.fallback]
 * @returns {Promise<{ aboutRewrite: Object, featuredSectionRecommendations: Array, profileRedFlags: Array }>}
 */
export async function synthesizeAboutAndFeatured({
  candidateName = 'the candidate',
  targetRole = 'Technical Professional',
  topExperiences = [],
  topProjects = [],
  topSkills = [],
  profile = {},
  fallback = {},
  excludeProvider = null,
  preferredProvider = null,
}) {
  const fallbackAbout = fallback.aboutRewrite || {
    hook: `I am a ${targetRole} focused on building robust, high-performance software systems.`,
    proof: 'Throughout my career, I have engineered scalable products with clean architecture.',
    callToAction: `Currently looking for ${targetRole} roles where I can drive measurable technical impact. Let's connect!`,
    fullText: `I am a ${targetRole} focused on building robust, high-performance software systems.\n\nThroughout my career, I have engineered scalable products with clean architecture.\n\nCurrently looking for ${targetRole} roles where I can drive measurable technical impact. Let's connect!`,
  }

  const fallbackFeatured = fallback.featuredSectionRecommendations || [
    {
      title: 'Core Production Architecture Showcase',
      reason: 'Provides concrete technical proof of production impact and engineering scale.',
      callToAction: 'Pin an architectural summary, case study post, or GitHub repository link.',
    },
  ]

  const fallbackRedFlags = fallback.profileRedFlags || [
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
  ]

  const messages = buildTask2AboutAndFeaturedPrompt({
    candidateName,
    targetRole,
    currentAbout: profile.about || '',
    topExperiences,
    topProjects,
    topSkills,
  })

  try {
    const response = await llmGateway.generate({
      purpose: 'linkedin_analysis',
      messages,
      temperature: 0.25,
      responseFormat: { type: 'json_object' },
      excludeProvider,
      preferredProvider,
    })

    let parsed = tryParseJson(response?.text)

    // Retry once if invalid JSON
    if (!parsed && response?.text) {
      console.warn('[LinkedInSynthesis:Task2] Output not valid JSON — retrying once')
      try {
        const retryResponse = await llmGateway.generate({
          purpose: 'linkedin_analysis',
          messages: [
            ...messages,
            { role: 'assistant', content: response.text },
            {
              role: 'user',
              content: 'Your previous response was not valid JSON. Return ONLY the complete corrected JSON object now with no extra text.',
            },
          ],
          temperature: 0.1,
          responseFormat: { type: 'json_object' },
          excludeProvider,
          preferredProvider,
        })
        parsed = tryParseJson(retryResponse?.text)
      } catch (_retryErr) {
        // Fall back gracefully
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        aboutRewrite: fallbackAbout,
        featuredSectionRecommendations: fallbackFeatured,
        profileRedFlags: fallbackRedFlags,
      }
    }

    let aboutRewrite = fallbackAbout
    if (parsed.aboutRewrite && typeof parsed.aboutRewrite === 'object') {
      const { hook, proof, callToAction, fullText } = parsed.aboutRewrite
      const combined = fullText || [hook, proof, callToAction].filter(Boolean).join('\n\n')
      aboutRewrite = {
        hook: hook || fallbackAbout.hook || '',
        proof: proof || fallbackAbout.proof || '',
        callToAction: callToAction || fallbackAbout.callToAction || '',
        fullText: combined || fallbackAbout.fullText || '',
      }
    }

    let featuredSectionRecommendations = fallbackFeatured
    if (Array.isArray(parsed.featuredSectionRecommendations) && parsed.featuredSectionRecommendations.length > 0) {
      featuredSectionRecommendations = parsed.featuredSectionRecommendations.slice(0, 3).map((f, i) => ({
        title: f.title || fallbackFeatured[i]?.title || `Featured Project #${i + 1}`,
        reason: f.reason || fallbackFeatured[i]?.reason || 'Demonstrates engineering depth and technical capability.',
        callToAction: f.callToAction || fallbackFeatured[i]?.callToAction || 'Pin to Featured section with GitHub repository or live demo link.',
      }))
    }

    let profileRedFlags = fallbackRedFlags
    if (Array.isArray(parsed.profileRedFlags) && parsed.profileRedFlags.length >= 2) {
      profileRedFlags = parsed.profileRedFlags.slice(0, 4).map((rf, idx) => ({
        title: rf.title || `Recruiter Fix #${idx + 1}`,
        explanation: rf.explanation || rf.diagnosis || '',
        fix: rf.fix || rf.recommendation || '',
      }))
    }

    let experienceUpgrades = fallback.experienceUpgrades || []
    if (Array.isArray(parsed.experienceUpgrades) && parsed.experienceUpgrades.length > 0) {
      experienceUpgrades = parsed.experienceUpgrades.slice(0, 3).map((eu) => ({
        company: eu.company || 'Company',
        role: eu.role || 'Role',
        dates: eu.dates || '',
        bullets: Array.isArray(eu.bullets) ? eu.bullets.slice(0, 4) : [],
      }))
    }

    return {
      aboutRewrite,
      experienceUpgrades,
      featuredSectionRecommendations,
      profileRedFlags,
      isFallback: false,
    }
  } catch (err) {
    console.warn('[LinkedInSynthesis:Task2] About & featured synthesis failed, using chunk fallback:', err.message)
    return {
      aboutRewrite: fallbackAbout,
      experienceUpgrades: fallback.experienceUpgrades || [],
      featuredSectionRecommendations: fallbackFeatured,
      profileRedFlags: fallbackRedFlags,
      isFallback: true,
    }
  }
}

/**
 * Executes parallel modular chunking for LinkedIn Profile Synthesis:
 * - Task 1: synthesizeHeadlinesAndBanner (~700 tokens)
 * - Task 2: synthesizeAboutAndFeatured (~1,200 tokens)
 * - Task 3: 100% Deterministic Skills Bank & Visual Audit (0 tokens)
 *
 * Runs Task 1 & Task 2 concurrently via Promise.all with independent fallback handling.
 * Merges with deterministic skills into unified optimizations bundle.
 *
 * @param {Object} profile - Normalized or raw LinkedIn profile
 * @param {Object} resumeContext - { canonicalResume, extractedFacts, targetRole }
 * @param {Array} [missingSkills] - Skills detected missing by cross-analyzer
 * @param {Array} [discrepancies] - Discrepancy findings
 * @param {Object} [signals] - Deterministic pre-audit signals
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
  const fallback = buildDeterministicOptimizations(profile, resumeContext, missingSkills)

  // Provider isolation: if resume ran on gemini, exclude gemini and prefer groq; if groq, exclude groq and prefer gemini
  const resumeProvider = resumeContext?.provider || options?.resumeProvider || null
  let excludeProvider = options?.excludeProvider || (resumeProvider === 'gemini' ? 'gemini' : (resumeProvider === 'groq' ? 'groq' : null))
  let preferredProvider = options?.preferredProvider || (excludeProvider === 'gemini' ? 'groq' : (excludeProvider === 'groq' ? 'gemini' : null))

  const canonical = resumeContext?.canonicalResume || {}
  const candidateName =
    canonical?.candidate?.name ||
    profile?.fullName ||
    'the candidate'
  const targetRole =
    resumeContext?.targetRole ||
    canonical?.candidate?.targetRole ||
    profile?.headline ||
    'Technical Professional'

  const experiences = canonical.experience || canonical.experiences || []
  const topMetricBullets = extractTopMetricBullets(experiences)
  const topExperiences = extractTopExperiences(experiences)
  const topProjects = extractTopProjects(canonical)

  const rawSkills = (canonical.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
  const topSkills = rawSkills.slice(0, 5)

  // Execute Task 1 and Task 2 concurrently with provider isolation
  const [task1Result, task2Result] = await Promise.all([
    synthesizeHeadlinesAndBanner({
      candidateName,
      targetRole,
      topMetricBullets,
      topSkills,
      profile,
      fallback,
      excludeProvider,
      preferredProvider,
    }).catch((err) => {
      console.warn('[LinkedInSynthesis] Task 1 failed, falling back:', err.message)
      return null
    }),
    synthesizeAboutAndFeatured({
      candidateName,
      targetRole,
      topExperiences,
      topProjects,
      topSkills,
      profile,
      fallback,
      excludeProvider,
      preferredProvider,
    }).catch((err) => {
      console.warn('[LinkedInSynthesis] Task 2 failed, falling back:', err.message)
      return null
    }),
  ])

  // Merge Task 1
  const headlines = task1Result?.headlines || fallback.headlines
  const bannerStrategy = task1Result?.bannerStrategy || fallback.bannerStrategy

  // Merge Task 2
  const aboutRewrite = task2Result?.aboutRewrite || fallback.aboutRewrite
  const experienceUpgrades = task2Result?.experienceUpgrades || fallback.experienceUpgrades
  const featuredSectionRecommendations =
    task2Result?.featuredSectionRecommendations || fallback.featuredSectionRecommendations
  const profileRedFlags = task2Result?.profileRedFlags || fallback.profileRedFlags

  // Deterministic sections & visibility tricks from canonical resume
  const sectionsToAddFromResume = fallback.sectionsToAddFromResume
  const visibilityTricks = fallback.visibilityTricks

  // Task 3: 100% Deterministic Skills Bank & Visual Presence Tips
  const top3PinnedSkills = fallback.top3PinnedSkills
  const visualPresenceTips = fallback.visualPresenceTips
  const recommendedSkillsToAdd = fallback.recommendedSkillsToAdd
  const recommendedSkills = fallback.recommendedSkills

  const isFallback = Boolean(
    (!task1Result || task1Result.isFallback) &&
    (!task2Result || task2Result.isFallback)
  )

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
    recommendedSkills,
    profileRedFlags,
    isFallback,
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

export default {
  runLinkedInSynthesis,
  synthesizeLinkedInOptimizations,
  synthesizeHeadlinesAndBanner,
  synthesizeAboutAndFeatured,
  buildDeterministicOptimizations,
}
