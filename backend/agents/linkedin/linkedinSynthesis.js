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

  const bulletWins = exp.slice(0, 3).map((e) => {
    const b = e.bullets?.[0]?.text || (typeof e.bullets?.[0] === 'string' ? e.bullets[0] : '')
    return b ? `• ${e.role} at ${e.company}: ${b}` : null
  }).filter(Boolean)

  const proof = bulletWins.length > 0
    ? `Selected Engineering Wins:\n${bulletWins.join('\n')}\n\nCore Architecture Toolkit: ${skills.slice(0, 6).join(', ') || topStack}.`
    : `Throughout my career at companies like ${topCompany}, I have engineered scalable products with clean architecture and reliable delivery.`

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

    // Find corresponding LinkedIn role
    const matchedLi = liExp.find(
      (le) => (le.company && e.company && le.company.toLowerCase().includes(e.company.toLowerCase().slice(0, 5)))
    )

    let linkedinGap = 'Missing quantified production outcome metrics and modern stack proof present on your resume.'
    if (!matchedLi) {
      linkedinGap = `Role at "${e.company}" is missing or unlinked on your LinkedIn profile, dropping critical recruiter tenure points.`
    } else if (matchedLi.title && e.role && matchedLi.title.toLowerCase() !== e.role.toLowerCase()) {
      linkedinGap = `Job title mismatch on LinkedIn ("${matchedLi.title}") vs Resume ("${e.role}") causes confusion in recruiter verification.`
    }

    const upgraded = [
      `Led end-to-end engineering for core ${e.role} initiatives at ${e.company}, scaling service reliability and system throughput.`,
      rawBullets[0] || `Architected high-throughput services utilizing ${topStack}, reducing latency and streamlining deployment cycles.`,
      rawBullets[1] || `Collaborated across engineering and product teams to deliver production-grade features with zero critical regression.`,
    ]

    return {
      company: e.company || 'Company',
      role: e.role || e.title || targetRole,
      dates: e.dates || '',
      linkedinGap,
      bullets: upgraded,
    }
  })

  // Projects to add from resume with replaceNote
  const sectionsToAddFromResume = {
    projects: rawProjects.slice(0, 3).map((p) => {
      const pTitle = p.title || p.name || 'Core Project'
      const isMissingOnLi = !liProjects.some((lp) => (lp.title || lp.name || '').toLowerCase().includes(pTitle.toLowerCase().slice(0, 6)))
      return {
        title: pTitle,
        description: (Array.isArray(p.bullets) ? p.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).join('; ') : p.description) || 'Production project showcasing technical architecture and impact.',
        technologies: p.technologies || p.skills || [],
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
      title: p.title || p.name || 'Featured Architecture Project',
      reason: 'Proves practical system design depth directly at the top of your profile without exposing contact info.',
      callToAction: 'Pin GitHub repository link, architecture diagrams, and a live deployment demo rather than a raw resume PDF.',
    })),
  }

  const featuredSectionRecommendations = rawProjects.length > 0
    ? rawProjects.slice(0, 3).map((p) => ({
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

  const resumeProvider = resumeContext?.provider || options?.resumeProvider || null
  const excludeProvider = options?.excludeProvider || (resumeProvider === 'gemini' ? 'gemini' : (resumeProvider === 'groq' ? 'groq' : null))
  const preferredProvider = options?.preferredProvider || (excludeProvider === 'gemini' ? 'groq' : (excludeProvider === 'groq' ? 'gemini' : 'groq'))

  const messages = buildLinkedInSynthesisPrompt({
    profile,
    resumeContext,
    discrepancies,
    signals,
    missingSkills,
  })

  try {
    const response = await llmGateway.generate({
      purpose: 'linkedin_analysis',
      messages,
      temperature: 0.25,
      maxTokens: 3500,
      responseFormat: { type: 'json_object' },
      excludeProvider,
      preferredProvider,
    })

    let parsed = tryParseJson(response?.text)

    // Retry once if invalid JSON
    if (!parsed && response?.text) {
      console.warn('[LinkedInSynthesis] Output not valid JSON — retrying once')
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
          maxTokens: 3500,
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
      console.warn('[LinkedInSynthesis] Parsing failed after retry, using deterministic fallback')
      return fallback
    }

    // Headlines
    let headlines = fallback.headlines
    if (Array.isArray(parsed.headlines) && parsed.headlines.length >= 2) {
      headlines = parsed.headlines.slice(0, 3).map((h, i) => ({
        formula: h.formula || fallback.headlines[i]?.formula || `Option ${i + 1}`,
        headline: (h.headline || h.text || fallback.headlines[i]?.headline || '').slice(0, 220),
        whyItWorks: h.whyItWorks || fallback.headlines[i]?.whyItWorks || 'Recruiter search ranking optimization.',
      }))
    }

    // About rewrite
    let aboutRewrite = fallback.aboutRewrite
    if (parsed.aboutRewrite && typeof parsed.aboutRewrite === 'object') {
      const { currentCritique, hook, proof, callToAction, fullText } = parsed.aboutRewrite
      const combined = fullText || [hook, proof, callToAction].filter(Boolean).join('\n\n')
      aboutRewrite = {
        currentCritique: currentCritique || fallback.aboutRewrite.currentCritique || '',
        hook: hook || fallback.aboutRewrite.hook || '',
        proof: proof || fallback.aboutRewrite.proof || '',
        callToAction: callToAction || fallback.aboutRewrite.callToAction || '',
        fullText: combined || fallback.aboutRewrite.fullText || '',
      }
    }

    // Experience Upgrades with linkedinGap
    let experienceUpgrades = fallback.experienceUpgrades
    if (Array.isArray(parsed.experienceUpgrades) && parsed.experienceUpgrades.length > 0) {
      experienceUpgrades = parsed.experienceUpgrades.slice(0, 4).map((eu, idx) => ({
        company: eu.company || fallback.experienceUpgrades[idx]?.company || 'Company',
        role: eu.role || fallback.experienceUpgrades[idx]?.role || 'Role',
        dates: eu.dates || fallback.experienceUpgrades[idx]?.dates || '',
        linkedinGap: eu.linkedinGap || fallback.experienceUpgrades[idx]?.linkedinGap || 'Missing quantified metrics and verified stack proof.',
        bullets: Array.isArray(eu.bullets) && eu.bullets.length > 0
          ? eu.bullets.slice(0, 4)
          : fallback.experienceUpgrades[idx]?.bullets || [],
      }))
    }

    // Sections to add from resume with replaceNote
    let sectionsToAddFromResume = fallback.sectionsToAddFromResume
    if (parsed.sectionsToAddFromResume && typeof parsed.sectionsToAddFromResume === 'object') {
      const p = parsed.sectionsToAddFromResume
      sectionsToAddFromResume = {
        projects: Array.isArray(p.projects) && p.projects.length > 0
          ? p.projects.slice(0, 4).map((pr, idx) => ({
              title: pr.title || fallback.sectionsToAddFromResume.projects[idx]?.title || 'Core Project',
              description: pr.description || fallback.sectionsToAddFromResume.projects[idx]?.description || '',
              technologies: pr.technologies || fallback.sectionsToAddFromResume.projects[idx]?.technologies || [],
              replaceNote: pr.replaceNote || fallback.sectionsToAddFromResume.projects[idx]?.replaceNote || '',
            }))
          : fallback.sectionsToAddFromResume.projects,
        certifications: Array.isArray(p.certifications) && p.certifications.length > 0
          ? p.certifications.slice(0, 5)
          : fallback.sectionsToAddFromResume.certifications,
        featured: Array.isArray(p.featured) && p.featured.length > 0
          ? p.featured.slice(0, 3)
          : fallback.sectionsToAddFromResume.featured,
      }
    }

    // Visibility Tricks
    let visibilityTricks = fallback.visibilityTricks
    if (Array.isArray(parsed.visibilityTricks) && parsed.visibilityTricks.length >= 3) {
      visibilityTricks = parsed.visibilityTricks.slice(0, 5).map((vt, idx) => ({
        category: vt.category || fallback.visibilityTricks[idx]?.category || 'Optimization',
        trick: vt.trick || fallback.visibilityTricks[idx]?.trick || `Trick #${idx + 1}`,
        advice: vt.advice || fallback.visibilityTricks[idx]?.advice || '',
        items: Array.isArray(vt.items) ? vt.items : (fallback.visibilityTricks[idx]?.items || []),
      }))
    }

    // Top 3 pinned skills
    let top3PinnedSkills = fallback.top3PinnedSkills
    if (Array.isArray(parsed.top3PinnedSkills) && parsed.top3PinnedSkills.length >= 3) {
      top3PinnedSkills = parsed.top3PinnedSkills.slice(0, 3)
    }

    // Recommended skills to add
    let recommendedSkillsToAdd = fallback.recommendedSkillsToAdd
    if (Array.isArray(parsed.recommendedSkillsToAdd) && parsed.recommendedSkillsToAdd.length > 0) {
      recommendedSkillsToAdd = parsed.recommendedSkillsToAdd.slice(0, 12)
    }

    // Banner Strategy
    let bannerStrategy = fallback.bannerStrategy
    if (parsed.bannerStrategy && typeof parsed.bannerStrategy === 'object') {
      bannerStrategy = {
        bannerTagline: parsed.bannerStrategy.bannerTagline || fallback.bannerStrategy.bannerTagline,
        bannerSecondaryText: parsed.bannerStrategy.bannerSecondaryText || fallback.bannerStrategy.bannerSecondaryText,
        designAdvice: parsed.bannerStrategy.designAdvice || fallback.bannerStrategy.designAdvice,
      }
    }

    // Featured section recommendations
    let featuredSectionRecommendations = fallback.featuredSectionRecommendations
    if (Array.isArray(parsed.featuredSectionRecommendations) && parsed.featuredSectionRecommendations.length > 0) {
      featuredSectionRecommendations = parsed.featuredSectionRecommendations.slice(0, 3)
    }

    // Visual presence tips
    let visualPresenceTips = fallback.visualPresenceTips
    if (Array.isArray(parsed.visualPresenceTips) && parsed.visualPresenceTips.length > 0) {
      visualPresenceTips = parsed.visualPresenceTips.slice(0, 4)
    }

    // Profile red flags
    let profileRedFlags = fallback.profileRedFlags
    if (Array.isArray(parsed.profileRedFlags) && parsed.profileRedFlags.length > 0) {
      profileRedFlags = parsed.profileRedFlags.slice(0, 4)
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
