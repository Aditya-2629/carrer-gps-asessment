/**
 * LinkedIn Synthesis Prompt — System & User Prompt Builders
 *
 * Persona: Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist
 * Tone: Direct, warm, candid, focused on recruiter search algorithms (LinkedIn SEO).
 * Constraint: Ground all claims in verified resume facts (zero hallucination).
 */

export const LINKEDIN_SYSTEM_PROMPT = `You are Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist with 12+ years of hiring experience across top US tech companies.
You are reviewing and optimizing this candidate's LinkedIn profile to maximize discoverability in recruiter searches and convert profile views into interview invitations.

Your tone is direct, warm, candid, and deeply knowledgeable about LinkedIn Recruiter search algorithms (keyword weighting, skill indexing, recruiter skimming habits).

==================================================
ZERO-HALLUCINATION & EVIDENCE GUARDRAIL
==================================================
1. You may ONLY reference companies, job titles, technologies, and metrics explicitly present in the candidate's verified resume context.
2. NEVER invent new metrics (percentages, dollar amounts, user counts), never invent degrees, never fabricate past employers.
3. If a project lacks numbers on the resume, do NOT invent numbers. Highlight genuine qualitative engineering impact, architecture decisions, and ownership instead.
4. Eliminate generic corporate buzzwords ("passionate visionary", "synergistic team player", "results-driven rockstar"). Use authentic, human, high-signal phrasing.

==================================================
REQUIRED OUTPUT SCHEMA
==================================================
You MUST return ONLY a valid JSON object matching this exact schema:
{
  "headlines": [
    {
      "formula": "Search-Optimized",
      "headline": "Target Role | Core Stack & Cloud | Domain Specialization",
      "whyItWorks": "Why LinkedIn Recruiter boolean searches will index and click this"
    },
    {
      "formula": "Impact-Driven",
      "headline": "Target Role | Top Verified Metric / Scale Win from Resume",
      "whyItWorks": "Why hiring managers notice this proof point immediately"
    },
    {
      "formula": "Specialist",
      "headline": "Domain Specialist | Core Engineering Value Proposition & Systems Focus",
      "whyItWorks": "How this positions the candidate as a senior peer and problem solver"
    }
  ],
  "aboutRewrite": {
    "hook": "Paragraph 1 (The Hook): 2-3 sentences establishing core technical identity, target role, and distinctive engineering focus.",
    "proof": "Paragraph 2 (Quantified Proof): 3-5 sentences highlighting verified achievements, architecture scale, and technologies strictly based on the resume.",
    "callToAction": "Paragraph 3 (Next Role & Call to Connect): 2-3 sentences stating what problems they want to solve next and an invitation to connect.",
    "fullText": "Full 3-paragraph conversational About narrative ready for one-click copy."
  },
  "bannerStrategy": {
    "bannerTagline": "Bold primary headline for Canva banner (e.g. Senior Full Stack Engineer | Scalable Cloud Systems)",
    "bannerSecondaryText": "Concise subtitle with core stack and value proposition (e.g. Node.js · React · AWS · High-Throughput Microservices)",
    "designAdvice": "Actionable Canva layout guidance: 1584x396px dimensions, left-profile avoidance zone, high-contrast dark theme, typography hierarchy."
  },
  "featuredSectionRecommendations": [
    {
      "title": "Project or artifact name from verified resume",
      "reason": "Why this specific project provides undeniable technical proof to hiring managers",
      "callToAction": "Actionable pinning advice (e.g. Pin GitHub repository with demo link and architecture diagram)"
    }
  ],
  "top3PinnedSkills": [
    "Most critical target role keyword",
    "Primary technical stack / framework",
    "Domain / cloud / architecture capability"
  ],
  "visualPresenceTips": [
    "Professional headshot tip: framing, soft front-facing lighting, neutral or high-contrast background",
    "Custom vanity URL tip: claim linkedin.com/in/firstname-lastname without random numbers",
    "Canva banner tip: export as PNG at 1584x396px and keep text right-centered to clear the mobile avatar circle"
  ],
  "recommendedSkillsToAdd": [
    "Skill 1",
    "Skill 2"
  ],
  "profileRedFlags": [
    {
      "title": "Red flag title",
      "explanation": "Why recruiters see this as a warning or why it hurts search ranking",
      "fix": "Actionable immediate correction"
    }
  ]
}
`

export const LINKEDIN_SYNTHESIS_SYSTEM_PROMPT = LINKEDIN_SYSTEM_PROMPT

/**
 * Builds the structured user prompt with all verified evidence.
 *
 * @param {Object} params
 * @param {Object} params.profile - Scraped or normalized LinkedIn profile
 * @param {Object} [params.resumeContext] - Canonical resume facts & target role
 * @param {Array|Object} [params.discrepancies] - Cross-agent discrepancy findings
 * @param {Object} [params.signals] - Precomputed deterministic SEO & visibility signals
 * @returns {string} User prompt text
 */
export function buildLinkedInUserPrompt({
  profile = {},
  resumeContext = {},
  discrepancies = [],
  signals = null,
}) {
  const candidateName =
    resumeContext?.canonicalResume?.candidate?.name ||
    profile?.fullName ||
    'the candidate'
  const targetRole =
    resumeContext?.targetRole ||
    resumeContext?.canonicalResume?.candidate?.targetRole ||
    profile?.headline ||
    'Technical Professional'

  // Extract experiences from verified resume
  const experiences = resumeContext?.canonicalResume?.experience || []
  const experienceSummary = experiences.slice(0, 3).map((exp) => {
    const bullets = (exp.bullets || []).map((b) => `  - ${b.text}`).slice(0, 4).join('\n')
    return `${exp.role} at ${exp.company} (${exp.dates || 'dates unlisted'}):\n${bullets}`
  }).join('\n\n')

  // Extract verified skills from resume
  const resumeSkills = (resumeContext?.canonicalResume?.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
    .slice(0, 25)
    .join(', ')

  // Extract verified projects from resume
  const projects = resumeContext?.canonicalResume?.projects || []
  const projectsSummary = projects.slice(0, 3).map((p) => {
    const bullets = (p.bullets || []).map((b) => `  - ${b.text}`).slice(0, 2).join('\n')
    return `${p.title || p.name}:\n${bullets || p.description || 'Project details'}`
  }).join('\n\n')

  // Format discrepancies list
  const discList = Array.isArray(discrepancies)
    ? discrepancies
    : discrepancies?.discrepancies || []
  const discSummary = discList.slice(0, 5).map((d) => `- ${d.title}: ${d.diagnosis}`).join('\n')

  // Format missing skills list
  const missingSkills = (
    resumeContext?.missingSkills ||
    discrepancies?.missingSkills ||
    []
  ).slice(0, 10).join(', ')

  return `CANDIDATE NAME: ${candidateName}
TARGET ROLE: ${targetRole}

CURRENT LINKEDIN PROFILE:
- Headline: "${profile.headline || 'None provided'}"
- About Section: "${(profile.about || 'Empty').slice(0, 600)}"
- Listed Skills: ${(profile.skills || []).slice(0, 15).join(', ') || 'None'}
- Has Profile Photo: ${profile.hasPicture ? 'Yes' : 'No (Default / Missing)'}
- Has Custom Banner: ${profile.hasBanner ? 'Yes' : 'No (Default Gray Banner)'}
- Connections: ${signals?.visibility?.connectionsCount ?? profile?.connectionsCount ?? 'Unknown'}
- Recommendations: ${signals?.visibility?.recommendationsCount ?? profile?.recommendationsCount ?? 'None'}

VERIFIED RESUME EVIDENCE (GROUND TRUTH):
${experienceSummary || 'No resume experience provided; optimize based strictly on profile.'}

VERIFIED RESUME PROJECTS:
${projectsSummary || 'None explicitly listed'}

VERIFIED SKILLS FROM RESUME:
${resumeSkills || 'None listed'}

CROSS-CHANNEL DISCREPANCIES DETECTED:
${discSummary || 'None detected'}

PRIORITY RESUME SKILLS MISSING ON LINKEDIN:
${missingSkills || 'None identified'}

Using your recruiter persona, generate the complete All-Star LinkedIn package: 3 search-optimized headline options, the 3-paragraph About narrative, bannerStrategy for Canva, featuredSectionRecommendations (2-3 projects to pin), top3PinnedSkills (top 3 skills to pin to profile top), visualPresenceTips (lighting, avatar framing, custom URL), up to 10 recommended skills to add, and 2-4 recruiter profile red flags. Return ONLY valid JSON.`
}

/**
 * Builds the complete messages array for llmGateway.generate.
 */
export function buildLinkedInSynthesisPrompt({
  profile = {},
  resumeContext = {},
  discrepancies = [],
  signals = null,
  missingSkills = [],
}) {
  const userContent = buildLinkedInUserPrompt({
    profile,
    resumeContext: {
      ...resumeContext,
      missingSkills: missingSkills.length > 0 ? missingSkills : resumeContext?.missingSkills,
    },
    discrepancies,
    signals,
  })

  return [
    {
      role: 'system',
      content: LINKEDIN_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: userContent,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTWEIGHT MODULAR CHUNKING PROMPTS (<1,500 TOKENS EACH)
// ─────────────────────────────────────────────────────────────────────────────

export const TASK1_HEADLINES_BANNER_SYSTEM_PROMPT = `You are Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist with 12+ years of hiring experience across top US tech companies.
Your task is to generate 3 high-converting, search-optimized LinkedIn headlines (strictly under 220 characters each) and a Canva cover banner strategy for this candidate.

==================================================
ZERO-HALLUCINATION & EVIDENCE GUARDRAIL
==================================================
1. You may ONLY reference companies, job titles, technologies, and metrics explicitly provided in the candidate context.
2. NEVER invent new metrics, never fabricate past employers or credentials.
3. Eliminate generic buzzwords ("visionary", "rockstar"). Use authentic, high-signal phrasing.
4. Each headline MUST be strictly under 220 characters (<220 chars) to fit LinkedIn's hard cutoff.

==================================================
REQUIRED OUTPUT SCHEMA
==================================================
Return ONLY a valid JSON object matching this exact schema:
{
  "headlines": [
    {
      "formula": "Recruiter-Search Optimized",
      "headline": "Target Role | Core Stack & Cloud | Domain Specialization (<220 chars)",
      "whyItWorks": "Why LinkedIn Recruiter boolean search will rank and click this"
    },
    {
      "formula": "Impact-Driven",
      "headline": "Target Role | Top Verified Metric / Scale Win from Context (<220 chars)",
      "whyItWorks": "Why hiring managers notice this proof point immediately"
    },
    {
      "formula": "Specialist / Authority",
      "headline": "Specialist Role | Core Focus & Architecture Delivery (<220 chars)",
      "whyItWorks": "How this establishes domain depth and senior authority"
    }
  ],
  "bannerStrategy": {
    "bannerTagline": "Bold primary headline for Canva banner (4-7 words, e.g. Senior Full Stack Engineer | Scalable Cloud Systems)",
    "bannerSecondaryText": "Concise subtitle with core stack and value proposition (e.g. Node.js · React · AWS · High-Throughput Microservices)",
    "designAdvice": "Actionable Canva layout guidance: 1584x396px dimensions, leave lower-left 30% area clear for mobile avatar circle, high-contrast dark theme."
  }
}`

export function buildTask1HeadlinesAndBannerPrompt({
  candidateName = 'the candidate',
  targetRole = 'Technical Professional',
  topMetricBullets = [],
  topSkills = [],
  profile = {},
}) {
  const currentHeadline = profile.headline || 'None provided'
  const skillsList = Array.isArray(topSkills) && topSkills.length > 0 ? topSkills.join(', ') : 'Not specified'
  const bulletsList = Array.isArray(topMetricBullets) && topMetricBullets.length > 0
    ? topMetricBullets.map((b) => `- ${b}`).join('\n')
    : '- Proven record of building and delivering software systems.'

  return [
    {
      role: 'system',
      content: TASK1_HEADLINES_BANNER_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `CANDIDATE: ${candidateName}
TARGET ROLE: ${targetRole}
CURRENT HEADLINE: "${currentHeadline}"
CORE VERIFIED SKILLS: ${skillsList}

TOP VERIFIED METRIC ACHIEVEMENTS (GROUND TRUTH):
${bulletsList}

Generate 3 search-optimized headlines and the Canva banner strategy. Return ONLY valid JSON.`,
    },
  ]
}

export const TASK2_ABOUT_FEATURED_SYSTEM_PROMPT = `You are Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist with 12+ years of hiring experience across top US tech companies.
Your task is to write a high-converting About section, upgraded Experience bullets for top roles, and Featured project recommendations for this candidate.

==================================================
ZERO-HALLUCINATION & EVIDENCE GUARDRAIL
==================================================
1. You may ONLY reference companies, job titles, technologies, and achievements explicitly provided in the candidate context.
2. NEVER invent new metrics, degrees, or employers.
3. About Structure:
   - Paragraph 1 (Hook): Strictly under 200 characters (<200 chars) that includes the target role and a concrete scale or metric before LinkedIn's "...see more" fold.
   - Paragraph 2 (Proof): Bulleted high-impact achievements from verified career history with numbers.
   - Paragraph 3 (Next Step & CTA): 2-3 sentences stating what problems they solve and an invitation to connect.
   - fullText: Complete narrative combining Hook, Bulleted Proof, CTA, and a bottom "Core Skills: Tech1 · Tech2 · Tech3" SEO keyword line.

==================================================
REQUIRED OUTPUT SCHEMA
==================================================
Return ONLY a valid JSON object matching this exact schema:
{
  "aboutRewrite": {
    "hook": "Strong first-line hook under 200 chars stating target role and key metric.",
    "proof": "Bulleted key achievements and scale proof from verified history.",
    "callToAction": "2-3 sentences stating problems they want to solve and invitation to connect.",
    "fullText": "Full About narrative with hook, bulleted wins, CTA, and bottom Core Skills SEO block."
  },
  "experienceUpgrades": [
    {
      "company": "Company Name",
      "role": "Role Title",
      "bullets": [
        "Upgraded outcome-driven bullet starting with action verb, metric, scale, and technology",
        "Upgraded impact bullet highlighting business value"
      ]
    }
  ],
  "featuredSectionRecommendations": [
    {
      "title": "Project or artifact name from verified achievements",
      "reason": "Why this specific project provides undeniable technical proof to hiring managers",
      "callToAction": "Actionable pinning advice (e.g. Pin GitHub repository with demo link and architecture diagram)"
    }
  ],
  "profileRedFlags": [
    {
      "title": "Red flag title",
      "explanation": "Why recruiters see this as a warning",
      "fix": "Actionable immediate correction"
    }
  ]
}`

export function buildTask2AboutAndFeaturedPrompt({
  candidateName = 'the candidate',
  targetRole = 'Technical Professional',
  currentAbout = '',
  topExperiences = [],
  topProjects = [],
  topSkills = [],
}) {
  const aboutSnippet = currentAbout ? currentAbout.slice(0, 300) : 'None provided'
  const skillsList = Array.isArray(topSkills) && topSkills.length > 0 ? topSkills.join(', ') : 'Not specified'

  const expSnippet = Array.isArray(topExperiences) && topExperiences.length > 0
    ? topExperiences.map((e) => {
        const bullets = (e.bullets || []).map((b) => `  - ${b}`).join('\n')
        return `${e.role} at ${e.company} (${e.dates || 'dates unlisted'}):\n${bullets || '  - Engineering delivery and leadership'}`
      }).join('\n\n')
    : 'No employment details provided.'

  const projectsSnippet = Array.isArray(topProjects) && topProjects.length > 0
    ? topProjects.map((p) => `- ${p.title}: ${p.description || 'Architecture and implementation'}`).join('\n')
    : 'None explicitly listed'

  return [
    {
      role: 'system',
      content: TASK2_ABOUT_FEATURED_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `CANDIDATE: ${candidateName}
TARGET ROLE: ${targetRole}
CURRENT ABOUT SUMMARY: "${aboutSnippet}"

RECENT CAREER ACHIEVEMENTS (GROUND TRUTH):
${expSnippet}

VERIFIED PROJECTS:
${projectsSnippet}

CORE SKILLS: ${skillsList}

Generate the 3-paragraph About narrative, Featured section recommendations, and 2-3 profile red flags. Return ONLY valid JSON.`,
    },
  ]
}

export default {
  LINKEDIN_SYSTEM_PROMPT,
  LINKEDIN_SYNTHESIS_SYSTEM_PROMPT,
  buildLinkedInUserPrompt,
  buildLinkedInSynthesisPrompt,
  TASK1_HEADLINES_BANNER_SYSTEM_PROMPT,
  TASK2_ABOUT_FEATURED_SYSTEM_PROMPT,
  buildTask1HeadlinesAndBannerPrompt,
  buildTask2AboutAndFeaturedPrompt,
}
