/**
 * LinkedIn Synthesis Prompt — Smart 2-Call Chunked Prompt Builders (V4.0)
 *
 * Implements "Smart Output Chunking" (Full Compact Input + Split Output Calls under 3,500 tokens each)
 *
 * Persona: Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist
 * Tone: Direct, warm, candid, focused on recruiter search algorithms (LinkedIn SEO).
 * Constraint: Ground all claims in verified resume facts (zero hallucination).
 * Goal: Deep transformation from raw resume into high-impact, skimmable LinkedIn presence.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. SHARED COMPACT CANDIDATE CONTEXT BUILDER (~900-1,100 tokens, 100% context)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the compact candidate context combining the candidate's actual scraped LinkedIn profile
 * and their verified Resume ground truth into ~900-1,100 tokens without cutting skills or roles.
 *
 * @param {Object} params
 * @param {Object} [params.profile] - Scraped or normalized LinkedIn profile
 * @param {Object} [params.resumeContext] - Canonical resume context & target role
 * @param {Array}  [params.discrepancies] - Cross-platform discrepancy findings
 * @param {Array}  [params.missingSkills] - Resume skills detected missing on LinkedIn
 * @param {Object} [params.signals] - Deterministic pre-audit signals
 * @returns {string} Compact serialized candidate context
 */
export function buildCompactCandidateContext({
  profile = {},
  resumeContext = {},
  discrepancies = [],
  missingSkills = [],
  signals = null,
  assessmentPersona = null,
  assessmentDirectives = null,
} = {}) {
  const effectiveDirectives =
    assessmentDirectives ||
    assessmentPersona?.agentDirectives?.forLinkedInAgent ||
    resumeContext?.assessmentPersona?.agentDirectives?.forLinkedInAgent ||
    resumeContext?.agentDirectives?.forLinkedInAgent ||
    null

  const canonical = resumeContext?.canonicalResume || {}
  const candidateName =
    canonical?.candidate?.name ||
    profile?.fullName ||
    'Candidate'
  const targetRole =
    resumeContext?.targetRole ||
    canonical?.candidate?.targetRole ||
    profile?.headline ||
    'Technical Professional'

  // Current LinkedIn Profile Details
  const currentHeadline = profile?.headline || 'None provided'
  const currentAbout = (profile?.about || 'Empty').slice(0, 600)
  const currentSkills = (profile?.skills || profile?.topSkills || []).slice(0, 25).join(', ') || 'None listed'

  const liExperiences = profile?.experiences || []
  const liExpSummary = liExperiences.slice(0, 6).map((e) => {
    const desc = (e.description || e.summary || '').trim()
    const descNote = desc ? `Description present (${desc.slice(0, 140)}...)` : 'Description EMPTY'
    return `- ${e.title || e.role || 'Role'} at ${e.company || 'Company'} (${e.duration || e.dates || 'dates unlisted'}) [${descNote}]`
  }).join('\n') || 'None listed'

  // Full Resume Experience (all roles, up to 4 roles x 6 bullets each)
  const resumeExperiences = canonical.experience || canonical.experiences || []
  const expSummary = resumeExperiences.slice(0, 4).map((exp) => {
    const bullets = (exp.bullets || []).slice(0, 6).map((b) => `  - ${typeof b === 'string' ? b : b.text}`).join('\n')
    return `${exp.role || exp.title} at ${exp.company} (${exp.dates || 'dates unlisted'}):\n${bullets || '  - Engineering scope and delivery'}`
  }).join('\n\n') || 'No resume experience provided; optimize based strictly on profile.'

  // Resume Projects (all projects with bullets)
  const projects = canonical.projects || []
  const projSummary = projects.slice(0, 4).map((p) => {
    const bullets = (p.bullets || []).slice(0, 4).map((b) => `  - ${typeof b === 'string' ? b : b.text}`).join('\n')
    const tech = (p.technologies || p.skills || []).join(', ')
    return `${p.title || p.name} [Tech: ${tech || 'Core Stack'}]:\n${bullets || p.description || 'Project details'}`
  }).join('\n\n') || 'None explicitly listed'

  // Full Resume Skills (up to 35 skills)
  const resumeSkills = (canonical.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
    .slice(0, 35)
    .join(', ') || 'None listed'

  // Resume Certifications
  const certSummary = (canonical.certifications || []).slice(0, 4).map((c) => {
    return `- ${c.name || c.title} (${c.issuer || c.authority || ''})`
  }).join('\n')

  // Cross-platform Discrepancies
  const discList = Array.isArray(discrepancies) ? discrepancies : (discrepancies?.discrepancies || [])
  const discSummary = discList.slice(0, 6).map((d) => `- [${d.severity || 'warning'}] ${d.title}: ${d.diagnosis || d.explanation}`).join('\n') || 'None detected'

  // Missing Skills
  const effectiveMissingSkills = (
    missingSkills.length > 0 ? missingSkills : (resumeContext?.missingSkills || discrepancies?.missingSkills || [])
  ).slice(0, 20).join(', ') || 'None identified'

  return `CANDIDATE NAME: ${candidateName}
TARGET ROLE: ${targetRole}

==================================================
ACTUAL SCRAPED LINKEDIN PROFILE
==================================================
- Headline: "${currentHeadline}"
- About Summary: "${currentAbout}"
- Current Listed Skills (up to 25): ${currentSkills}
- Current LinkedIn Experience Entries:
${liExpSummary}
- Has Custom Vanity URL: ${profile?.hasCustomUrl ? 'Yes' : 'No'}
- Has Custom Banner: ${profile?.hasBanner ? 'Yes' : 'No'}

==================================================
VERIFIED RESUME FACTS (GROUND TRUTH)
==================================================
RESUME EXPERIENCES (UP TO 4 ROLES X 6 BULLETS):
${expSummary}

RESUME PROJECTS:
${projSummary}

VERIFIED SKILLS FROM RESUME (UP TO 35):
${resumeSkills}
${certSummary ? `\nRESUME CERTIFICATIONS:\n${certSummary}` : ''}

==================================================
CROSS-PLATFORM GAPS & DISCREPANCIES
==================================================
DETECTED DISCREPANCIES:
${discSummary}

VERIFIED RESUME SKILLS MISSING ON LINKEDIN:
${effectiveMissingSkills}${effectiveDirectives ? `

==================================================
CANDIDATE ASSESSMENT & RECRUITER VISIBILITY CONTEXT
==================================================
${effectiveDirectives}` : ''}`
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TASK 1: HEADLINES, ABOUT STORY, PINNED SKILLS & RED FLAGS (maxTokens: 2048)
// ─────────────────────────────────────────────────────────────────────────────

export const TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT = `You are Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist with 12+ years of hiring experience.
You are reviewing and optimizing this candidate's LinkedIn presence against their verified Resume ground truth.

==================================================
GUARDRAILS & DIRECTIVES
==================================================
1. Ground all claims in verified resume facts (zero hallucination).
2. Never invent past employers, degrees, technologies, or numeric metrics.
3. Eliminate generic buzzwords ("passionate visionary", "synergistic team player", "results-driven rockstar").

==================================================
TASK 1 SCOPE: HEADLINES, ABOUT STORY, PINNED SKILLS & RED FLAGS
==================================================
1. HEADLINES (<220 CHARACTERS EACH):
   - Generate 3 distinct, high-converting headlines tailored to the candidate's targetRole:
     * "Recruiter-Search Optimized": Target Role | Core Stack & Cloud Keywords | Domain Specialization
     * "Impact-Driven": Target Role | Top Verified Metric or Scale Win from Resume
     * "Specialist / Authority": Specialist Role | Core Focus & Architecture Delivery
   - STRICTLY avoid desperate phrases like "Actively seeking...", "Looking for opportunities", or "Open to work" (which lowers perceived candidate value and wastes algorithmic headline space).
   - In "whyItWorks", explain specifically how this headline ranks in LinkedIn Recruiter boolean search algorithms and hooks hiring managers.

2. ABOUT REWRITE (FIRST-PERSON EXECUTIVE STORY & 3 THEMATIC PILLARS — NEVER COPY RESUME BULLETS):
   - CRITICAL RULE FOR aboutRewrite: NEVER copy-paste resume bullets or list role-by-role resume points inside the LinkedIn About section! A LinkedIn About section must read like a compelling, first-person executive story and architectural thesis — completely distinct from the Experience section below it.
   - Structure aboutRewrite into 3 cohesive prose/pillar sections:
     1. "hook" (Paragraph 1 — The Architectural Hook): 2-3 punchy first-person sentences establishing who you are, the scale of systems you design, and the core engineering problems you solve (e.g., turning complex LLM workflows and legacy monoliths into sub-second, event-driven production systems). Engineered to beat the desktop & mobile "...see more" fold (<210 chars).
     2. "proof" (Paragraph 2 — 3 Core Engineering Pillars, NOT raw resume bullets): Synthesize the candidate's career into 3 thematic domain pillars (for example: "▸ Production AI & Agentic Systems: ...", "▸ Cloud-Native & Serverless Scale: ...", "▸ Enterprise Data & Reliability Engineering: ..."), weaving their verified metrics and architectural wins naturally into those 3 strategic pillars without repeating their resume bullet phrasing.
     3. "callToAction" (Paragraph 3 — What I'm Solving Next + Core Specialties): 2-3 warm, confident sentences on the exact engineering challenges and roles they are targeting next, followed by a "Core Specialties:" keyword line for LinkedIn Recruiter SEO.
   - "fullText": Complete copy-paste ready 3-paragraph executive narrative merging hook, proof, and callToAction.

3. TOP 3 PINNED SKILLS:
   - Identify the top 3 highest-leverage skills from the candidate's verified stack to pin to the very top of their LinkedIn Skills section (the 3 visible to recruiters in search results and mobile cards).

4. PROFILE RED FLAGS:
   - Identify 3-4 specific, candid recruiter red flags comparing their current LinkedIn profile against their resume and targetRole.
   - For each flag: provide "title", "explanation" (why recruiters consider this a red flag), and "fix" (exact actionable correction).

==================================================
REQUIRED JSON SCHEMA (RETURN ONLY VALID JSON)
==================================================
{
  "headlines": [
    {
      "formula": "Recruiter-Search Optimized",
      "headline": "Target Role | Core Stack & Cloud | Domain Specialization (<220 chars)",
      "whyItWorks": "Why LinkedIn Recruiter boolean search will rank and click this"
    },
    {
      "formula": "Impact-Driven",
      "headline": "Target Role | Top Verified Metric / Scale Win (<220 chars)",
      "whyItWorks": "Why hiring managers notice this proof point immediately"
    },
    {
      "formula": "Specialist / Authority",
      "headline": "Specialist Role | Core Focus & Architecture Delivery (<220 chars)",
      "whyItWorks": "How this establishes domain depth and senior authority"
    }
  ],
  "aboutRewrite": {
    "hook": "2-3 punchy first-person sentences establishing architectural identity and scale (<210 chars)",
    "proof": "3 thematic domain pillars (▸ Pillar 1: ... \\n▸ Pillar 2: ... \\n▸ Pillar 3: ...) synthesizing career wins without raw resume bullets",
    "callToAction": "Forward-looking engineering focus + invitation to connect + Core Specialties: keyword line",
    "fullText": "Full 3-paragraph copy-paste ready LinkedIn About narrative"
  },
  "top3PinnedSkills": ["Skill 1", "Skill 2", "Skill 3"],
  "profileRedFlags": [
    {
      "title": "Red flag title",
      "explanation": "Why recruiters see this as a warning",
      "fix": "Actionable immediate correction"
    }
  ]
}`

export const TASK1_HEADLINES_BANNER_SYSTEM_PROMPT = TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT
export const TASK1_SYSTEM_PROMPT = TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT

/**
 * Builds the messages payload for Task 1: Headlines, About Story, Pinned Skills & Red Flags.
 */
export function buildTask1HeadlinesAndBannerPrompt(params = {}) {
  const profile = params.profile || {
    fullName: params.candidateName,
    headline: params.targetRole,
    about: params.currentAbout,
    skills: params.topSkills,
  }
  const resumeContext = params.resumeContext || {
    canonicalResume: {
      candidate: { name: params.candidateName, targetRole: params.targetRole },
      experience: params.topExperiences,
      projects: params.topProjects,
      skills: params.topSkills,
    },
    targetRole: params.targetRole,
  }
  const discrepancies = params.discrepancies || []
  const missingSkills = params.missingSkills || []
  const signals = params.signals || null

  const contextText = buildCompactCandidateContext({
    profile,
    resumeContext,
    discrepancies,
    missingSkills,
    signals,
  })

  const userContent = `${contextText}

Analyze this candidate's profile against their resume for Task 1 (Headlines, About Story, Top 3 Pinned Skills, Profile Red Flags). Return ONLY the valid JSON object matching the Task 1 schema.`

  return [
    {
      role: 'system',
      content: TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: userContent,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TASK 2: EXPERIENCE UPGRADES, FEATURED, SECTIONS & TRICKS (maxTokens: 2200)
// ─────────────────────────────────────────────────────────────────────────────

export const TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT = `You are Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist with 12+ years of hiring experience.
You are generating LinkedIn Experience Upgrades, Featured Projects, Missing Sections, and Recruiter Visibility Tactics.
All claims and technical skills MUST be grounded 100% in verified resume facts (zero hallucination).

==================================================
TASK 2 SCOPE & DIRECTIVES (DO NOT COPY RESUME BULLETS)
==================================================
1. EXPERIENCE UPGRADES (TOP 3 WORK EXPERIENCE ROLES):
   - Upgrade the candidate's top 3 work experience roles ([{ company, role, dates, bullets }]).
   - CRITICAL RULE FOR experienceUpgrades: Do NOT copy resume bullets word-for-word or just swap the first verb! On LinkedIn, recruiters read Experience differently than a resume. For each role, rewrite the content into a LinkedIn Executive Role Showcase:
     * Bullet 1 (Role Mandate:): A high-level 1-2 sentence overview of the product ecosystem, team/system scope, and core architectural transformation owned in that role.
     * Bullets 2 to 4: Rewritten Problem → Architecture → Business Outcome highlights written specifically for LinkedIn skimmability (e.g., leading with the business bottleneck solved and measurable impact before naming the internal tools).
     * Total exactly 4 bullets per role.

2. FEATURED SECTION RECOMMENDATIONS:
   - Identify top 2-3 projects or case studies from their resume ([{ title, reason, callToAction }]).
   - Provide actionable instructions on what to pin in LinkedIn Featured (GitHub repo link, live demo, or architecture diagram post over a raw resume PDF).

3. SECTIONS TO ADD FROM RESUME & PROJECT SHOWCASES:
   - "projectShowcases": Array of [{ title, rewrittenPitch, actionAdvice, technologies }].
     * CRITICAL RULE: NEVER copy the raw resume bullet! Rewrite each resume project into a 2-sentence LinkedIn Project Pitch:
       - Sentence 1: What real-world problem the project solves and its system architecture.
       - Sentence 2: Technical scale/benchmark achieved and why it matters for targetRole.
     * "actionAdvice": Actionable note on which outdated LinkedIn project to replace or how to feature it prominently.
   - "sectionsToAddFromResume":
     * "projects": Array of [{ title, description, technologies, replaceNote }] where "description" is the 2-sentence rewritten pitch.
     * "certifications": Array of [{ name, issuer, date }] verified from resume.
     * "featured": Array of [{ title, description }] to highlight prominently.

4. VISIBILITY TRICKS (4 HYPER-SPECIFIC RECRUITER TACTICS — NO PHOTO/BANNER ITEMS):
   - Provide 4 hyper-specific LinkedIn Recruiter search & conversion tactics tailored to this candidate's targetRole and tech stack ([{ category, trick, advice, items }]):
     1. Category: "Open to Work Titles" — Exact 5 Open-to-Work Job Titles to set in private recruiter preferences.
     2. Category: "Recruiter Boolean Search" — Exact Recruiter Boolean Search String to match.
     3. Category: "Top 3 Pinned Skills Strategy" — Endorsement and pinning strategy for their top 3 core skills.
     4. Category: "Custom Vanity URL & Featured Conversion" — Custom URL setup and pinning GitHub demo over raw resume PDF.

==================================================
REQUIRED JSON SCHEMA (RETURN ONLY VALID JSON)
==================================================
{
  "experienceUpgrades": [
    {
      "company": "Company Name",
      "role": "Role Title",
      "dates": "Dates",
      "bullets": [
        "Role Mandate: High-level 1-2 sentence overview of product ecosystem, team/system scope, and architectural transformation",
        "Problem → Architecture → Business Outcome highlight 1 (lead with bottleneck and measurable impact)",
        "Problem → Architecture → Business Outcome highlight 2 (lead with bottleneck and measurable impact)",
        "Problem → Architecture → Business Outcome highlight 3 (lead with bottleneck and measurable impact)"
      ]
    }
  ],
  "projectShowcases": [
    {
      "title": "Project Title",
      "rewrittenPitch": "2-sentence LinkedIn Project Pitch (Sentence 1: problem solved & architecture; Sentence 2: scale/benchmark achieved for targetRole)",
      "actionAdvice": "Actionable note on replacing outdated projects or featuring on profile",
      "technologies": ["Tech1", "Tech2"]
    }
  ],
  "featuredSectionRecommendations": [
    {
      "title": "Project Title",
      "reason": "Why this project provides undeniable technical proof",
      "callToAction": "Actionable pinning advice"
    }
  ],
  "sectionsToAddFromResume": {
    "projects": [
      {
        "title": "Project Name",
        "description": "2-sentence LinkedIn Project Pitch (Sentence 1: problem solved & architecture; Sentence 2: scale/benchmark achieved)",
        "technologies": ["Tech1", "Tech2"],
        "replaceNote": "Actionable note on which outdated LinkedIn project to replace or feature"
      }
    ],
    "certifications": [
      {
        "name": "Certification Name",
        "issuer": "Issuing Organization",
        "date": "Year / Date"
      }
    ],
    "featured": [
      {
        "title": "Recommended Artifact to Pin",
        "description": "Why this proves engineering capability"
      }
    ]
  },
  "visibilityTricks": [
    {
      "category": "Open to Work Titles",
      "trick": "1. Set 5 Exact Job Titles in Open to Work",
      "advice": "Recruiter search filter matching advice",
      "items": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]
    },
    {
      "category": "Recruiter Boolean Search",
      "trick": "2. Optimize for Recruiter Boolean Search Strings",
      "advice": "How recruiters query candidate profiles",
      "items": ["(\\"Target Role\\") AND (\\"Skill 1\\" OR \\"Skill 2\\")"]
    },
    {
      "category": "Top 3 Pinned Skills Strategy",
      "trick": "3. Pin and Endorse Top 3 Verified Skills",
      "advice": "Endorsement and visibility advice",
      "items": ["Skill 1", "Skill 2", "Skill 3"]
    },
    {
      "category": "Custom Vanity URL & Featured Conversion",
      "trick": "4. Custom Profile URL & Live Demo Pinning",
      "advice": "Conversion and anti-scraping advice",
      "items": ["Custom vanity URL", "Pin GitHub repo / live demo over raw PDF"]
    }
  ]
}`

export const TASK2_ABOUT_FEATURED_SYSTEM_PROMPT = TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT
export const TASK2_SYSTEM_PROMPT = TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT

/**
 * Builds the messages payload for Task 2: Experience Upgrades, Featured Projects, Missing Sections & Visibility Tricks.
 */
export function buildTask2AboutAndFeaturedPrompt(params = {}) {
  const experiences = Array.isArray(params.topExperiences) ? params.topExperiences.slice(0, 4) : []
  const profile = params.profile || {
    fullName: params.candidateName,
    headline: params.targetRole,
    about: params.currentAbout,
    skills: params.topSkills,
    experiences: experiences,
  }
  const resumeContext = params.resumeContext || {
    canonicalResume: {
      candidate: { name: params.candidateName, targetRole: params.targetRole },
      experience: experiences,
      projects: Array.isArray(params.topProjects) ? params.topProjects.slice(0, 4) : [],
      skills: params.topSkills,
    },
    targetRole: params.targetRole,
  }
  const discrepancies = params.discrepancies || []
  const missingSkills = params.missingSkills || []
  const signals = params.signals || null

  const contextText = buildCompactCandidateContext({
    profile,
    resumeContext,
    discrepancies,
    missingSkills,
    signals,
  })

  const userContent = `${contextText}

Analyze this candidate's profile against their resume for Task 2 (Experience Upgrades, Featured Projects, Missing Sections, Recruiter Visibility Tricks). Return ONLY the valid JSON object matching the Task 2 schema.`

  return [
    {
      role: 'system',
      content: TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: userContent,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LEGACY UNIFIED PROMPT (PRESERVED FOR BACKWARDS COMPATIBILITY)
// ─────────────────────────────────────────────────────────────────────────────

export const LINKEDIN_SYSTEM_PROMPT = TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT
export const LINKEDIN_SYNTHESIS_SYSTEM_PROMPT = LINKEDIN_SYSTEM_PROMPT

export function buildLinkedInUserPrompt(params = {}) {
  return buildCompactCandidateContext(params)
}

export function buildLinkedInSynthesisPrompt(params = {}) {
  return buildTask1HeadlinesAndBannerPrompt(params)
}

export default {
  buildCompactCandidateContext,
  TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT,
  TASK1_HEADLINES_BANNER_SYSTEM_PROMPT,
  TASK1_SYSTEM_PROMPT,
  buildTask1HeadlinesAndBannerPrompt,
  TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT,
  TASK2_ABOUT_FEATURED_SYSTEM_PROMPT,
  TASK2_SYSTEM_PROMPT,
  buildTask2AboutAndFeaturedPrompt,
  LINKEDIN_SYSTEM_PROMPT,
  LINKEDIN_SYNTHESIS_SYSTEM_PROMPT,
  buildLinkedInUserPrompt,
  buildLinkedInSynthesisPrompt,
}
