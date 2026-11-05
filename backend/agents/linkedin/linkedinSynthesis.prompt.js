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

export function safeExtractString(val) {
  if (!val) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) {
    return val.map(safeExtractString).filter(Boolean).join(' ').trim()
  }
  if (typeof val === 'object') {
    const raw = val.text || val.content || val.description || val.summary || val.paragraph || val.value || ''
    if (typeof raw === 'string') return raw.trim()
    if (raw && typeof raw === 'object') return safeExtractString(raw)
    return ''
  }
  return String(val).trim()
}

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
  answers = null,
} = {}) {
  const effectiveAnswers = answers || resumeContext?.answers || null
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
  const currentHeadline = typeof profile?.headline === 'string'
    ? profile.headline
    : (typeof profile?.headline?.text === 'string' ? profile.headline.text : 'None provided')
  const rawAbout = typeof profile?.about === 'string'
    ? profile.about
    : (typeof profile?.summary === 'string'
      ? profile.summary
      : (typeof profile?.about?.text === 'string' ? profile.about.text : 'Empty'))
  const currentAbout = (rawAbout || 'Empty').slice(0, 600)
  const currentSkills = (profile?.skills || profile?.topSkills || [])
    .slice(0, 25)
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.title || ''))
    .filter(Boolean)
    .join(', ') || 'None listed'

  const liExperiences = profile?.experiences || []
  const liExpSummary = liExperiences.slice(0, 6).map((e) => {
    const desc = safeExtractString(e?.description || e?.summary)
    const descNote = desc ? `Description present (${desc.slice(0, 140)}...)` : 'Description EMPTY'
    const roleTitle = typeof e?.title === 'string' ? e.title : (typeof e?.role === 'string' ? e.role : 'Role')
    const compName = typeof e?.company === 'string' ? e.company : (typeof e?.companyName === 'string' ? e.companyName : 'Company')
    const dates = typeof e?.duration === 'string' ? e.duration : (typeof e?.dates === 'string' ? e.dates : 'dates unlisted')
    return `- ${roleTitle} at ${compName} (${dates}) [${descNote}]`
  }).join('\n') || 'None listed'

  // Full Resume Experience (all roles, up to 4 roles x 6 bullets each)
  const resumeExperiences = canonical.experience || canonical.experiences || []
  const expSummary = resumeExperiences.slice(0, 4).map((exp) => {
    const bullets = (exp.bullets || []).slice(0, 6).map((b) => `  - ${typeof b === 'string' ? b : b?.text || ''}`).join('\n')
    const compName = typeof exp.company === 'string' ? exp.company : (exp.company?.name || 'Company')
    const roleTitle = typeof exp.role === 'string' ? exp.role : (exp.title || 'Role')
    return `${roleTitle} at ${compName} (${exp.dates || exp.duration || 'dates unlisted'}):\n${bullets || '  - Engineering scope and delivery'}`
  }).join('\n\n') || 'No resume experience provided; optimize based strictly on profile.'

  // Resume Projects (all projects with bullets)
  const projects = canonical.projects || []
  const projSummary = projects.slice(0, 4).map((p) => {
    const bullets = (p.bullets || []).slice(0, 4).map((b) => `  - ${typeof b === 'string' ? b : b?.text || ''}`).join('\n')
    const rawTech = p.techStack || p.technologies || p.tech || p.skills || ''
    const tech = Array.isArray(rawTech)
      ? rawTech.map((t) => (typeof t === 'string' ? t : t?.name || '')).filter(Boolean).join(', ')
      : (typeof rawTech === 'string' ? rawTech : '')
    return `${p.title || p.name || 'Core Project'} [Tech: ${tech || 'Core Stack'}]:\n${bullets || p.description || 'Project details'}`
  }).join('\n\n') || 'None explicitly listed'

  // Full Resume Skills (up to 35 skills)
  const resumeSkills = (canonical.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill))
    .filter(Boolean)
    .slice(0, 35)
    .join(', ') || 'None listed'

  // Resume Certifications
  const certSummary = (canonical.certifications || []).slice(0, 4).map((c) => {
    const certName = typeof c === 'string' ? c : (c?.name || c?.title || '')
    const certIssuer = typeof c === 'object' && (c?.issuer || c?.authority) ? ` (${c.issuer || c.authority})` : ''
    return certName ? `- ${certName}${certIssuer}` : null
  }).filter(Boolean).join('\n')

  // Cross-platform Discrepancies
  const discList = Array.isArray(discrepancies) ? discrepancies : (discrepancies?.discrepancies || [])
  const discSummary = discList.slice(0, 6).map((d) => `- [${d?.severity || 'warning'}] ${d?.title || 'Notice'}: ${d?.diagnosis || d?.explanation || ''}`).join('\n') || 'None detected'

  // Missing Skills
  const effectiveMissingSkills = (
    missingSkills.length > 0 ? missingSkills : (resumeContext?.missingSkills || discrepancies?.missingSkills || [])
  ).slice(0, 20).map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).join(', ') || 'None identified'

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
VERIFIED RESUME EVIDENCE & FACTS (GROUND TRUTH)
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

PRIORITY RESUME SKILLS MISSING ON LINKEDIN:
${effectiveMissingSkills}${effectiveAnswers && Object.keys(effectiveAnswers).length > 0 ? `

==================================================
CANDIDATE ASSESSMENT & SEARCH CONTEXT (QUESTIONNAIRE ANSWERS)
==================================================
- Target Role: ${effectiveAnswers.targetRole || targetRole || 'Not specified'}
- Opportunity Type: ${effectiveAnswers.opportunityType || 'Full-Time W2'}
- Experience Level: ${effectiveAnswers.experience || 'Mid-Level'}
- Work Authorization / Visa: ${effectiveAnswers.visa || 'Not specified'}
- Applications Submitted (30d): ${effectiveAnswers.apps30d || effectiveAnswers.appsWeek?.raw || 'Not specified'}
- Active Drop-Off Stage: ${effectiveAnswers.DropOffStage || 'Phase 1'}
- Key Hiring Challenge: ${effectiveAnswers.biggestChallenge || 'Not specified'}
- Candidate's Core Frustration: ${effectiveAnswers.frustration || 'Not specified'}
- What Candidate Already Tried: ${Array.isArray(effectiveAnswers.alreadyTried) ? effectiveAnswers.alreadyTried.join(', ') : (effectiveAnswers.alreadyTried || 'None')}

CRITICAL INSTRUCTION: Personalize the 3 Headline options, Story-Driven About section rewrite, and Featured Projects specifically for a candidate at this experience level (${effectiveAnswers.experience || 'Mid-Level'}) and target role (${effectiveAnswers.targetRole || targetRole}), addressing their specific hiring challenge ("${effectiveAnswers.biggestChallenge || 'conversion'}"). Ensure all copy is 100% aligned with their target market.` : ''}${effectiveDirectives ? `

==================================================
CANDIDATE ASSESSMENT & RECRUITER VISIBILITY CONTEXT
==================================================
${effectiveDirectives}` : ''}`
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TASK 1: HEADLINES, ABOUT STORY, PINNED SKILLS & RED FLAGS (maxTokens: 2048)
// ─────────────────────────────────────────────────────────────────────────────

export const TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT = `You are Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist with 12+ years of hiring experience.
Optimize this candidate's LinkedIn presence focusing on 3 concrete deliverables:
1. Search-Optimized Headline: Role Title + Top 4 Recruiter Search Keywords + Scope Hook (<220 chars).
2. Story-Driven About Section: 3-paragraph executive narrative in high-agency First-Person ("I") voice (Technical Identity & Obsession -> Quantified Architecture Pillars -> Where I'm Headed & Peer Invitation to Connect; NEVER copy-paste resume bullets, synthesize into 3 thematic domain pillars, NO trailing tag clouds).
3. Top 3 Pinned Skills & Recruiter Red Flags. Ground all claims 100% in verified resume facts (ZERO-HALLUCINATION GUARDRAIL: zero hallucination).

HEADLINE DELIVERABLES (<220 CHARACTERS EACH):
- 3 distinct formulas: "Recruiter-Search Optimized", "Impact-Driven", "Specialist / Authority".
- Format: Target Role | Top 4 Recruiter Search Keywords | Scope Hook / Scale Win.
- Avoid generic phrases like "Actively seeking" or "Open to work".
- In "whyItWorks", explain how this ranks in LinkedIn Recruiter boolean search and hooks hiring managers.

ABOUT SECTION HUMANIZED ARCHITECTURE (180–240 WORDS, 3 PARAGRAPHS):
- VOICE REQUIREMENT: Strict FIRST-PERSON ("I", "my") practitioner voice. NEVER write in the third-person (e.g. "Alex is an engineer with..."). Speak as a high-agency builder: "I spend most of my time thinking about...", "I build...", "My focus is...".
- PARAGRAPH 1 (Technical Identity & Engineering Obsession):
  * State the engineering problems you genuinely enjoy solving, total verified years of experience, core technical stack, and enterprise or high-scale domain.
  * ZERO corporate mission statements or generic buzzwords ("synergy", "spearheaded", "passionate coder").
- PARAGRAPH 2 (Architecture Proof & Engineering Pillars):
  * Synthesize 2–3 distinct technical pillars with verifiable operational scale (e.g., distributed state, high-throughput caching, latency reduction, reliability under load).
  * NEVER copy-paste raw resume bullets. Frame achievements through architectural decisions and technical mechanisms.
- PARAGRAPH 3 (Where I'm Headed & Engineering Philosophy):
  * Explicitly define the caliber and class of technical problems you want to own next.
  * Conclude with a warm peer-to-peer invitation to connect for engineering leaders, founders, and hiring teams.
- PURGE TRAILING KEYWORD LISTS: Strictly FORBID appending raw keyword lists or tag clouds at the bottom of the About section (e.g. "Core Competencies: React, Redux, Docker..."). Keywords must live naturally inside the narrative prose for LinkedIn SEO and human readability.
- "fullText": Complete copy-paste ready 3-paragraph executive narrative in first-person voice (180–240 words).

TOP 3 PINNED SKILLS & RED FLAGS:
- Top 3 highest-leverage verified skills visible in recruiter search cards.
- 3-4 candid recruiter red flags with actionable immediate fixes.

REQUIRED JSON SCHEMA (RETURN ONLY VALID JSON):
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
    "hook": "2-3 punchy first-person sentences establishing engineering obsession, stack, and scale (<210 chars)",
    "proof": "3 thematic domain pillars synthesizing career wins without raw resume bullets",
    "callToAction": "Forward-looking engineering focus + peer-to-peer invitation to connect (strictly NO trailing keyword lists or tag clouds)",
    "fullText": "Full 3-paragraph copy-paste ready LinkedIn About narrative in high-agency first-person voice (180–240 words)"
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
    answers: params.answers || resumeContext?.answers || null,
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
Generate high-converting LinkedIn Experience Upgrades, Featured Projects, Missing Sections, and Recruiter Visibility Tactics. Ground all claims 100% in verified resume facts (zero hallucination).

3-ROLE EXPERIENCE BULLET UPGRADES:
- Upgrade the candidate's top 3 work experience roles into metric-backed impact statements (4 bullets per role):
  * Bullet 1: Role Mandate: High-level overview of product ecosystem, team/system scope, and architectural transformation.
  * Bullets 2-4: Problem → Architecture → Business Outcome highlights leading with business bottlenecks and measurable impact.

FEATURED PROJECTS & SHOWCASES:
- Top 2-3 projects with live demo / GitHub repo pinning advice.
- "projectShowcases": 2-sentence pitch (Sentence 1: problem & architecture; Sentence 2: scale/benchmark achieved for targetRole).
- "sectionsToAddFromResume": Projects, certifications, and featured artifacts.

RECRUITER VISIBILITY TACTICS:
- 4 hyper-specific tactics: Open to Work Titles (5 titles), Recruiter Boolean Search string, Top 3 Pinned Skills strategy, Custom Vanity URL & conversion.

REQUIRED JSON SCHEMA (RETURN ONLY VALID JSON):
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
    answers: params.answers || resumeContext?.answers || null,
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
// 4. THOUGHT LEADERSHIP & SOCIAL SEO PROMPT BUILDERS (PHASE 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * System prompt for LinkedIn Thought Leadership & Social SEO Evaluator.
 * Persona: Liam / Sophia — Senior US Technical Recruiter & Personal Branding Strategist for Top Tier Tech Talent.
 */
export function buildThoughtLeadershipSystemPrompt() {
  return `You are a Senior US Technical Recruiter and Personal Branding Strategist for top-tier technical and functional talent.
Your mission is to evaluate a candidate's recent public LinkedIn posts, detect domain alignment vs. generic fluff, and generate 3 actionable, high-impact thought leadership blueprints.

PERSONA & TONE:
- Direct, candid, practical, zero corporate jargon, focused on building authentic technical authority.
- Grounded strictly in the candidate's verified background, target role, and concrete wins (ZERO HALLUCINATION).

CRITICAL EVALUATION RULES:
1. Distinguish Authentic Technical Authority vs Generic Platitudes:
   - "Observer" (0 posts / inactive): Candidate is invisible to hiring managers searching for domain authorities.
   - "Broadcaster" (High frequency, but generic reshares, motivational quotes, superficial AI hype): Lacks proof of hands-on expertise.
   - "Practitioner" (Shares specific architectural decisions, debugging teardowns, code/config nuances): Strong proof of engineering execution.
   - "Industry Voice" (High-substance breakdown of complex trade-offs, benchmarks, systems evolution): Top 1% talent brand.
2. Critique & Verdict:
   - Provide a 1-sentence punchy verdict and a 2-sentence actionable critique explaining what is missing and how to lift engagement.
3. Actionable Post Templates (Strictly 3 High-Converting Technical Archetypes):
   - Archetype 1: "The Production Post-Mortem & Silent Bug"
     * Anatomy: A subtle bug/edge-case that bypassed tests -> how it was diagnosed in production/staging -> the exact root cause mechanism -> the preventative policy/monitoring created.
   - Archetype 2: "The Tooling Trade-Off & Migration Reality"
     * Anatomy: Tool A vs Tool B -> why you chose the less hyped/uglier option -> 1 concrete benchmark or production constraint -> real-world operational caveat.
   - Archetype 3: "The Architecture Deep-Dive / Counter-Intuitive Lesson"
     * Anatomy: What 90% of tutorials teach -> why it breaks under concurrent load/scale -> the architectural counter-measure implemented.
   - ZERO-FLUFF RULE: Strictly forbid engagement bait or corporate platitudes ("Happy Monday!", "Always keep learning!", "Agree? Thoughts?"). Speak as an active hands-on practitioner.
   - CONCRETE TECHNOLOGY CITATION: Every template hook MUST cite at least 2 real technologies from the candidate's verified skills (e.g., PostgreSQL, Docker, Kafka, Redis, Node.js).
   - Every template MUST contain:
     * format: Must be one of: "The Production Post-Mortem & Silent Bug", "The Tooling Trade-Off & Migration Reality", "The Architecture Deep-Dive / Counter-Intuitive Lesson".
     * hook: A scroll-stopping opening hook (1-2 sentences) citing at least 2 concrete technologies without platitudes.
     * bodyOutline: A step-by-step 4-point technical outline.
     * callToAction: A technical practitioner question that invites senior peers to comment (never "Thoughts?").
     * targetHashtags: 3 relevant, non-spammy technical hashtags.
     * recommendedMedia: Suggested visual asset (e.g. architecture diagram, benchmark table, terminal diff, flamegraph).
4. Thirty-Day Content Calendar:
   - Exactly 4 weeks with weekly theme and goal.
5. Networking & Commenting Strategy:
   - targetAccountsToEngage, commentFormula, and weeklyCommentGoal.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this exact schema:
{
  "thoughtLeadershipAudit": {
    "tier": "Observer" | "Broadcaster" | "Practitioner" | "Industry Voice",
    "domainAlignmentScore": number,
    "substanceVsFluffScore": number,
    "verdict": "string",
    "identifiedThemes": ["string"],
    "missingDomainThemes": ["string"],
    "critique": "string"
  },
  "actionablePostTemplates": [
    {
      "format": "The Production Post-Mortem & Silent Bug",
      "hook": "string",
      "bodyOutline": "string",
      "callToAction": "string",
      "targetHashtags": ["string"],
      "recommendedMedia": "string"
    },
    {
      "format": "The Tooling Trade-Off & Migration Reality",
      "hook": "string",
      "bodyOutline": "string",
      "callToAction": "string",
      "targetHashtags": ["string"],
      "recommendedMedia": "string"
    },
    {
      "format": "The Architecture Deep-Dive / Counter-Intuitive Lesson",
      "hook": "string",
      "bodyOutline": "string",
      "callToAction": "string",
      "targetHashtags": ["string"],
      "recommendedMedia": "string"
    }
  ],
  "thirtyDayCalendar": [
    { "week": 1, "theme": "string", "goal": "string" },
    { "week": 2, "theme": "string", "goal": "string" },
    { "week": 3, "theme": "string", "goal": "string" },
    { "week": 4, "theme": "string", "goal": "string" }
  ],
  "networkingAndCommentStrategy": {
    "targetAccountsToEngage": "string",
    "commentFormula": "string",
    "weeklyCommentGoal": number
  }
}`
}

/**
 * Builds the compact user prompt context for Thought Leadership evaluation (< 1,200 tokens).
 */
export function buildThoughtLeadershipUserPrompt({
  targetRole = '',
  coreSkills = [],
  projects = [],
  activitySignals = {},
  recentPosts = [],
} = {}) {
  const roleText = targetRole || 'Technical Professional'
  const skillsText = (Array.isArray(coreSkills) ? coreSkills.slice(0, 8) : []).join(', ') || 'Domain Expertise'

  // Extract top 2 concrete achievements from projects or resume wins
  const cleanProjects = Array.isArray(projects) && projects.length > 0
    ? projects.slice(0, 2).map((p, idx) => {
        const title = typeof p === 'string' ? p : (p?.name || p?.title || `Project ${idx + 1}`)
        const rawDesc = typeof p === 'object'
          ? (p.description || (Array.isArray(p.bullets) ? p.bullets[0] : '') || '')
          : ''
        const desc = safeExtractString(rawDesc)
        return `- ${title}${desc ? `: ${desc.slice(0, 160)}` : ''}`
      }).join('\n')
    : 'Production delivery and domain execution'

  // Format activity metrics
  const recencyTier = activitySignals?.recencyTier || 'Unknown'
  const cadence = activitySignals?.weeklyPostingCadence ?? 0
  const avgLikes = activitySignals?.engagement?.avgLikes ?? 0
  const avgComments = activitySignals?.engagement?.avgComments ?? 0

  // Format up to 5 recent posts truncated to 240 chars each
  const postsBlock = Array.isArray(recentPosts) && recentPosts.length > 0
    ? recentPosts.slice(0, 5).map((p, idx) => {
        const text = safeExtractString(p.text || p.content || p.commentary || '').slice(0, 240)
        const likes = p.likesCount ?? p.engagement?.likes ?? 0
        const comments = p.commentsCount ?? p.engagement?.comments ?? 0
        return `Post ${idx + 1} (${likes} likes, ${comments} comments):\n"${text}"`
      }).join('\n\n')
    : 'No recent public posts available on LinkedIn.'

  return `CANDIDATE GROUND TRUTH:
Target Role: ${roleText}
Core Verified Skills: ${skillsText}
Verified Project Wins:
${cleanProjects}

ACTIVITY SIGNALS:
- Recency Tier: ${recencyTier}
- Weekly Posting Cadence: ${cadence} posts/week
- Avg Engagement: ${avgLikes} likes, ${avgComments} comments per post

SAMPLE RECENT POSTS (Top 5):
${postsBlock}

INSTRUCTIONS:
Evaluate this candidate's thought leadership and social SEO. Generate the exact JSON output adhering to the schema. Ensure all 3 actionable post templates reference the candidate's actual verified skills (${skillsText}) and concrete project wins. Return ONLY valid JSON.`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. LEGACY UNIFIED PROMPT (PRESERVED FOR BACKWARDS COMPATIBILITY)
// ─────────────────────────────────────────────────────────────────────────────

export const LINKEDIN_SYSTEM_PROMPT = `${TASK1_HEADLINES_ABOUT_SYSTEM_PROMPT}\n\n${TASK2_EXPERIENCE_VISIBILITY_SYSTEM_PROMPT}`
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
  buildThoughtLeadershipSystemPrompt,
  buildThoughtLeadershipUserPrompt,
  LINKEDIN_SYSTEM_PROMPT,
  LINKEDIN_SYNTHESIS_SYSTEM_PROMPT,
  buildLinkedInUserPrompt,
  buildLinkedInSynthesisPrompt,
}
