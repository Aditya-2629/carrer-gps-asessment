/**
 * LinkedIn Synthesis Prompt — System & User Prompt Builders (V3.0)
 *
 * Persona: Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist
 * Tone: Direct, warm, candid, focused on recruiter search algorithms (LinkedIn SEO).
 * Constraint: Ground all claims in verified resume facts (zero hallucination).
 * Goal: Deep transformation from raw resume into high-impact, skimmable LinkedIn profile.
 */

export const LINKEDIN_SYSTEM_PROMPT = `You are Liam / Sophia — Senior US Technical Recruiter & LinkedIn Profile Strategist with 12+ years of hiring experience across top US tech companies.
You are reviewing and optimizing this candidate's LinkedIn profile by directly comparing their ACTUAL scraped LinkedIn profile against their verified Resume.

Your mission is to bridge the gap between their resume (ground truth achievements) and their LinkedIn presence (how recruiters discover and perceive them).

==================================================
ZERO-HALLUCINATION & EVIDENCE GUARDRAIL
==================================================
1. You may ONLY reference companies, job titles, technologies, and metrics explicitly present in the candidate's verified resume context.
2. NEVER invent new metrics (percentages, dollar amounts, user counts), never invent degrees, never fabricate past employers.
3. If a project or role lacks numbers on the resume, do NOT invent numbers. Highlight genuine engineering scope, architecture decisions, and technical ownership instead.
4. Eliminate generic corporate buzzwords ("passionate visionary", "synergistic team player", "results-driven rockstar"). Use authentic, high-signal phrasing.

==================================================
LINKEDIN TRANSFORMATION RULES (DO NOT COPY RESUME BULLETS)
==================================================
1. RESUME VS LINKEDIN IS DIFFERENT:
   - Resumes are formal, dense documents designed for ATS parsers and hiring managers reviewing PDFs.
   - LinkedIn profiles are public marketing surfaces designed for 10-second mobile recruiter skimming.
   - DO NOT copy-paste raw resume bullets into LinkedIn!
2. EXPERIENCE UPGRADES:
   - For each role, compare what is currently on their LinkedIn profile vs what is on their resume.
   - Provide "linkedinGap": a candid, specific critique of what is wrong or missing on their current LinkedIn entry (e.g. company name typo breaking logo, title mismatch, dense unskimmable text, missing key metrics).
   - Provide "bullets": exactly 3 LinkedIn-native, skimmable impact statements (1-line scope hook + 2 quantified outcome highlights rewritten specifically for LinkedIn readers).
3. HEADLINES (<220 CHARACTERS EACH):
   - Provide 3 distinct formulas.
   - Fix flaws in their current headline: eliminate passive openers ("Actively seeking...", "Looking for opportunities", "Student at...").
   - Lead with Target Role + Core Stack & Cloud + Domain Specialization.
4. ABOUT SECTION REWRITE:
   - "currentCritique": 1-2 sentences explaining what is weak in their current LinkedIn About vs their resume.
   - "hook": First 200 characters engineered to beat LinkedIn's "...see more" fold.
   - "proof": 3-4 punchy, scannable impact highlights combining verified metrics across companies.
   - "callToAction": Target role focus + Core Skills SEO footer.
   - "fullText": Complete copy-paste ready text.
5. SECTIONS TO ADD FROM RESUME:
   - "projects": Include verified resume projects missing on LinkedIn, with a "replaceNote" calling out any outdated LinkedIn projects they should archive or replace.
   - "certifications": High-priority certifications to add.
   - "featured": Specific recommendation on what to pin (e.g. GitHub architecture repo rather than an unredacted resume PDF).
6. VISIBILITY TRICKS:
   - 5 hyper-specific LinkedIn growth and recruiter algorithm actions tailored to this candidate's target role, stack, and discrepancies.

==================================================
REQUIRED OUTPUT SCHEMA (RETURN ONLY VALID JSON)
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
    "currentCritique": "1-2 sentences explaining flaws in current LinkedIn About vs resume",
    "hook": "First 200 characters engineered to beat LinkedIn ...see more fold",
    "proof": "3-4 punchy, scannable impact highlights combining verified achievements",
    "callToAction": "Target role focus + invitation to connect",
    "fullText": "Full 3-paragraph conversational About narrative ready for one-click copy with Core Skills footer"
  },
  "experienceUpgrades": [
    {
      "company": "Company Name",
      "role": "Role Title",
      "dates": "Dates",
      "linkedinGap": "Exact critique of what is wrong or missing on their current LinkedIn entry for this company vs their resume",
      "bullets": [
        "1-line scope hook rewritten for LinkedIn skimmers",
        "Quantified outcome highlight 1",
        "Quantified outcome highlight 2"
      ]
    }
  ],
  "sectionsToAddFromResume": {
    "projects": [
      {
        "title": "Project Name from Resume",
        "description": "Concise architectural and impact summary",
        "technologies": ["Tech1", "Tech2"],
        "replaceNote": "Actionable note on which outdated LinkedIn project to replace or archive"
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
        "title": "Recommended Artifact or Project to Pin",
        "reason": "Why this proves architectural depth over a raw resume PDF",
        "callToAction": "Actionable pinning advice"
      }
    ]
  },
  "visibilityTricks": [
    {
      "category": "Open to Work / SEO / Engagement",
      "trick": "Actionable trick title",
      "advice": "Detailed recruiter coaching advice",
      "items": ["Item 1", "Item 2"]
    }
  ],
  "top3PinnedSkills": ["Skill 1", "Skill 2", "Skill 3"],
  "recommendedSkillsToAdd": ["Skill 1", "Skill 2"],
  "bannerStrategy": {
    "bannerTagline": "Bold primary headline for Canva banner (4-7 words)",
    "bannerSecondaryText": "Concise subtitle with core stack and value proposition",
    "designAdvice": "Actionable Canva layout guidance: 1584x396px dimensions, leave lower-left 30% area clear for mobile avatar circle"
  },
  "featuredSectionRecommendations": [
    {
      "title": "Project Title",
      "reason": "Why this project provides undeniable technical proof",
      "callToAction": "Pin advice"
    }
  ],
  "visualPresenceTips": [
    "Headshot advice",
    "Custom URL advice",
    "Canva banner advice"
  ],
  "profileRedFlags": [
    {
      "title": "Red flag title",
      "explanation": "Why recruiters see this as a warning",
      "fix": "Actionable immediate correction"
    }
  ]
}
`

export const LINKEDIN_SYNTHESIS_SYSTEM_PROMPT = LINKEDIN_SYSTEM_PROMPT

/**
 * Builds the structured user prompt with all verified evidence comparing LinkedIn vs Resume.
 */
export function buildLinkedInUserPrompt({
  profile = {},
  resumeContext = {},
  discrepancies = [],
  signals = null,
  missingSkills = [],
}) {
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

  // Extract experiences from verified resume
  const experiences = canonical.experience || canonical.experiences || []
  const experienceSummary = experiences.slice(0, 4).map((exp) => {
    const bullets = (exp.bullets || []).map((b) => `  - ${typeof b === 'string' ? b : b.text}`).slice(0, 5).join('\n')
    return `${exp.role || exp.title} at ${exp.company} (${exp.dates || 'dates unlisted'}):\n${bullets || '  - Engineering scope and delivery'}`
  }).join('\n\n')

  // Extract verified skills from resume
  const resumeSkills = (canonical.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)
    .slice(0, 30)
    .join(', ')

  // Extract verified projects from resume
  const projects = canonical.projects || []
  const projectsSummary = projects.slice(0, 4).map((p) => {
    const bullets = (p.bullets || []).map((b) => `  - ${typeof b === 'string' ? b : b.text}`).slice(0, 3).join('\n')
    const tech = (p.technologies || p.skills || []).join(', ')
    return `${p.title || p.name} [Tech: ${tech || 'Core Stack'}]:\n${bullets || p.description || 'Project details'}`
  }).join('\n\n')

  // Extract education from verified resume
  const eduSummary = (canonical.education || []).slice(0, 3).map((ed) => {
    return `- ${ed.degree} in ${ed.major || ed.field || ''} at ${ed.institution || ed.school} (${ed.graduationYear || ed.dates || ''})`
  }).join('\n')

  // Extract certifications from verified resume
  const certSummary = (canonical.certifications || []).slice(0, 4).map((c) => {
    return `- ${c.name || c.title} (${c.issuer || c.authority || ''})`
  }).join('\n')

  // Current LinkedIn profile sections
  const liExpSummary = (profile.experiences || []).slice(0, 4).map((e) => {
    return `- ${e.title || e.role} at ${e.company} (${e.duration || e.dates || 'dates unlisted'}): ${(e.description || e.summary || 'No description provided').slice(0, 250)}`
  }).join('\n')

  const liProjSummary = (profile.projects || []).slice(0, 4).map((p) => {
    return `- ${p.title || p.name}: ${(p.description || 'No description').slice(0, 180)}`
  }).join('\n')

  const liEduSummary = (profile.education || []).slice(0, 3).map((ed) => {
    return `- ${ed.degree || 'Degree'} at ${ed.school || ed.institution} (${ed.years || ed.date || ''})`
  }).join('\n')

  // Format discrepancies list
  const discList = Array.isArray(discrepancies)
    ? discrepancies
    : discrepancies?.discrepancies || []
  const discSummary = discList.slice(0, 8).map((d) => `- [${d.severity || 'warning'}] ${d.title}: ${d.diagnosis || d.explanation}`).join('\n')

  // Format missing skills list
  const missingSkillsList = (
    missingSkills.length > 0 ? missingSkills : (resumeContext?.missingSkills || discrepancies?.missingSkills || [])
  ).slice(0, 15).join(', ')

  return `CANDIDATE NAME: ${candidateName}
TARGET ROLE: ${targetRole}

==================================================
ACTUAL SCRAPED LINKEDIN PROFILE
==================================================
- Headline: "${profile.headline || 'None provided'}"
- About Summary: "${(profile.about || 'Empty').slice(0, 600)}"
- Listed Skills: ${(profile.skills || profile.topSkills || []).slice(0, 20).join(', ') || 'None listed'}
- Listed Experiences on LinkedIn:
${liExpSummary || 'None listed'}
- Listed Projects on LinkedIn:
${liProjSummary || 'None listed'}
- Listed Education on LinkedIn:
${liEduSummary || 'None listed'}
- Has Profile Photo: ${profile.hasPicture ? 'Yes' : 'No (Default Avatar / Missing)'}
- Has Custom Banner: ${profile.hasBanner ? 'Yes' : 'No (Default Gray Banner)'}
- Connections Count: ${signals?.visibility?.connectionsCount ?? profile?.connectionsCount ?? 'Unknown'}
- Recommendations Count: ${signals?.visibility?.recommendationsCount ?? profile?.recommendationsCount ?? 0}

==================================================
VERIFIED RESUME EVIDENCE (GROUND TRUTH)
==================================================
RESUME EXPERIENCES:
${experienceSummary || 'No resume experience provided; optimize based strictly on profile.'}

RESUME PROJECTS:
${projectsSummary || 'None explicitly listed'}

RESUME EDUCATION:
${eduSummary || 'None listed'}

RESUME CERTIFICATIONS:
${certSummary || 'None listed'}

VERIFIED SKILLS FROM RESUME:
${resumeSkills || 'None listed'}

==================================================
CROSS-ANALYZER FINDINGS (DISCREPANCIES & GAPS)
==================================================
DETECTED DISCREPANCIES:
${discSummary || 'None detected'}

PRIORITY RESUME SKILLS MISSING ON LINKEDIN:
${missingSkillsList || 'None identified'}

Analyze the concrete differences between the candidate's actual scraped LinkedIn profile and their verified Resume. Generate the complete All-Star LinkedIn package using the required JSON schema. Return ONLY valid JSON.`
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
    resumeContext,
    discrepancies,
    signals,
    missingSkills,
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
// BACKWARDS-COMPATIBILITY EXPORTS FOR ISOLATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

export const TASK1_HEADLINES_BANNER_SYSTEM_PROMPT = LINKEDIN_SYSTEM_PROMPT
export const TASK2_ABOUT_FEATURED_SYSTEM_PROMPT = LINKEDIN_SYSTEM_PROMPT

export function buildTask1HeadlinesAndBannerPrompt(params = {}) {
  return buildLinkedInSynthesisPrompt({
    profile: params.profile || {},
    resumeContext: {
      canonicalResume: {
        candidate: { name: params.candidateName, targetRole: params.targetRole },
        skills: params.topSkills,
      },
      targetRole: params.targetRole,
    },
  })
}

export function buildTask2AboutAndFeaturedPrompt(params = {}) {
  return buildLinkedInSynthesisPrompt({
    profile: {
      about: params.currentAbout,
    },
    resumeContext: {
      canonicalResume: {
        candidate: { name: params.candidateName, targetRole: params.targetRole },
        experience: params.topExperiences,
        projects: params.topProjects,
        skills: params.topSkills,
      },
      targetRole: params.targetRole,
    },
  })
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
