/**
 * Assessment Personalization Agent (V1.0)
 *
 * Normalizes the candidate's 12-question interactive assessment responses
 * into rich, actionable intelligence and generates tailored directives for:
 *  - Resume Agent (Maya)
 *  - LinkedIn Agent (Liam / Sophia)
 *  - Atlas Report (Career GPS Synthesis)
 *  - AI Coach Chatbot (RAG Context Brief)
 */

export function evaluateAssessmentPersona({
  answers = {},
  semanticProfile = {},
  resumeContext = {},
} = {}) {
  const ans = { ...answers }

  // Helper: parse numbers from strings or quantitative objects
  const parseQty = (val, defaultVal = 0) => {
    if (val === null || val === undefined) return { raw: '0', perWeek: defaultVal, perMonth: Math.round(defaultVal * 4.33) }
    if (typeof val === 'number') {
      return { raw: String(val), perWeek: val, perMonth: Math.round(val * 4.33) }
    }
    if (typeof val === 'object' && val !== null) {
      const perW = typeof val.per_week === 'number' ? val.per_week : parseFloat(String(val.raw || 0).replace(/[^0-9.]/g, '')) || defaultVal
      const perM = typeof val.per_month === 'number' ? val.per_month : Math.round(perW * 4.33)
      return { raw: String(val.raw || perW), perWeek: perW, perMonth: perM }
    }
    const cleanNum = parseFloat(String(val).replace(/[^0-9.]/g, '')) || defaultVal
    return { raw: String(val), perWeek: cleanNum, perMonth: Math.round(cleanNum * 4.33) }
  }

  // 1. Work Authorization & Immigration Context
  const rawVisa = String(ans.visa || semanticProfile?.visa?.rawAnswer || '').trim()
  let visaCategory = 'Other'
  let requiresSponsorship = true
  let isStudentOrOpt = false
  let urgencyNote = 'Candidate requires clarity on US work authorization pathways and employer eligibility.'

  if (/CPT/i.test(rawVisa)) {
    visaCategory = 'CPT'
    isStudentOrOpt = true
    requiresSponsorship = true
    urgencyNote = 'F-1 Student CPT status; requires employer open to initial CPT employment and future H-1B sponsorship.'
  } else if (/Initial OPT|POST OPT/i.test(rawVisa)) {
    visaCategory = 'Initial OPT'
    isStudentOrOpt = true
    requiresSponsorship = true
    urgencyNote = '12-Month Initial OPT clock is ticking with strict 90-day unemployment limits; high-velocity callback conversion is critical.'
  } else if (/STEM OPT/i.test(rawVisa)) {
    visaCategory = 'STEM OPT'
    isStudentOrOpt = true
    requiresSponsorship = true
    urgencyNote = '24-Month STEM OPT runway requires E-Verify employer sponsors; applications must filter for verified sponsor tiers.'
  } else if (/H-?1B|H1/i.test(rawVisa)) {
    visaCategory = 'H-1B'
    requiresSponsorship = true
    urgencyNote = 'Currently on H-1B visa; looking for a clean H-1B change-of-employer transfer petition.'
  } else if (/H-?4|L-?2/i.test(rawVisa)) {
    visaCategory = 'H-4 / L-2 EAD'
    requiresSponsorship = false
    urgencyNote = 'Holds open employment authorization (EAD) with zero immediate lottery or sponsorship friction.'
  } else if (/Green Card|GC|Permanent/i.test(rawVisa)) {
    visaCategory = 'Green Card'
    requiresSponsorship = false
    urgencyNote = 'Permanent Resident (Green Card); unrestricted US employment authorization across enterprise and federal contractors.'
  } else if (/Citizen|USC/i.test(rawVisa)) {
    visaCategory = 'U.S. Citizen'
    requiresSponsorship = false
    urgencyNote = 'U.S. Citizen with zero visa sponsorship constraints and unrestricted employer access.'
  }

  // Representation Model
  const rawConsultancy = String(ans.consultancy || '').trim()
  const isC2C = /C2C/i.test(rawConsultancy)
  const isW2Agency = /W2/i.test(rawConsultancy)
  const isSolo = !isC2C && !isW2Agency

  // 2. Funnel Metrics & Search Velocity
  const apps = parseQty(ans.appsWeek || ans.applications_count, 25)
  const coldEmails = parseQty(ans.coldEmails || ans.outreach, 10)
  const screens = parseQty(ans.humanScreen || ans.recruiter_calls_count, 2)

  const appsPerWeek = apps.perWeek
  const appsPerMonth = apps.perMonth
  const coldOutreachPerWeek = coldEmails.perWeek
  const humanScreensPerMonth = screens.perMonth

  const conversionRatePct = appsPerMonth > 0
    ? Number(((humanScreensPerMonth / appsPerMonth) * 100).toFixed(1))
    : 0

  const rawSearchStyle = String(ans.searchStyle || '').trim()
  const isEasyApplyHeavy = /Easy Apply|Speed-Clicker/i.test(rawSearchStyle)
  const isTailoringResume = /Customizer|Tailoring/i.test(rawSearchStyle)
  const isPortalSniper = /Portal Sniper/i.test(rawSearchStyle)
  const isReferralHunter = /Referral Hunter/i.test(rawSearchStyle)

  // 3. Interview Bottlenecks & Drop-Off Points
  const rawFeedback = Array.isArray(ans.feedback) ? ans.feedback : [String(ans.feedback || '')]
  const feedbackStr = rawFeedback.join(' ')

  const hasATSBlackHole = /ATS Black Hole|Ghosted before/i.test(feedbackStr)
  const hasVisaGhosting = /Visa Wall|sponsorship/i.test(feedbackStr)
  const hasCodingAnxiety = /Coding Gauntlet|LeetCode|HackerRank|Live Coding/i.test(feedbackStr)
  const hasSystemDesignGap = /System Design|architecture|scaling/i.test(feedbackStr)
  const hasPostScreenGhosting = /Post-Interview Ghosting|vanish/i.test(feedbackStr)
  const hasFinalRoundDropoff = /Final Round Heartbreak|losing to/i.test(feedbackStr)

  let primaryDropoffStage = 'Top-of-Funnel Recruiter Screening'
  if (hasATSBlackHole || (conversionRatePct < 4 && appsPerMonth >= 30)) {
    primaryDropoffStage = 'ATS Automated Black Hole (Application-to-Screen Conversion <4%)'
  } else if (hasCodingAnxiety || hasSystemDesignGap) {
    primaryDropoffStage = 'Technical Assessment Gate (Freezing at Timed Coding or System Architecture)'
  } else if (hasVisaGhosting) {
    primaryDropoffStage = 'Immigration / Work Authorization Filter Gate'
  } else if (hasPostScreenGhosting) {
    primaryDropoffStage = 'Recruiter Screen to Hiring Manager Transition'
  } else if (hasFinalRoundDropoff) {
    primaryDropoffStage = 'Final Onsite to Formal Offer Conversion'
  }

  // 4. Sprint Bandwidth
  const bandwidth = parseQty(ans.hoursWeek, 15)
  const hoursPerWeek = bandwidth.perWeek
  let intensityTier = 'Targeted Active Search (15-24 hrs/week)'
  if (hoursPerWeek >= 25) {
    intensityTier = 'High-Intensity Full Sprint (25+ hrs/week)'
  } else if (hoursPerWeek < 12) {
    intensityTier = 'Focused Micro-Cadence (<12 hrs/week)'
  }

  // 5. Candidate Persona Synthesis
  let archetype = 'Disciplined Technical Hunter'
  let personaSummary = 'Navigating competitive market opportunities with targeted applications.'

  if (isStudentOrOpt && isEasyApplyHeavy) {
    archetype = 'F-1/OPT Hunter Trapped in High-Volume Easy Apply'
    personaSummary = 'Firing high-volume one-click applications while immigration timelines run down, creating low ATS response ceilings.'
  } else if (isStudentOrOpt) {
    archetype = 'F-1/OPT High-Runway Candidate Targeting Verified Sponsors'
    personaSummary = 'Navigating US tech hiring under visa sponsorship timelines, needing instant production authority to bypass student bias.'
  } else if (isC2C) {
    archetype = 'C2C Contractor Seeking Direct Enterprise Positioning'
    personaSummary = 'Transitioning from third-party vendor subcontracting to high-ownership, direct-hire enterprise engineering roles.'
  } else if (hasCodingAnxiety && hasSystemDesignGap) {
    archetype = 'Senior Builder Stalling at Technical Evaluation Gates'
    personaSummary = 'Possesses strong hands-on product engineering depth, but freezes under live whiteboard coding and scalable system design pressure.'
  } else if (hasATSBlackHole && isEasyApplyHeavy) {
    archetype = 'Volume Applier Facing Automated Algorithm Blindness'
    personaSummary = 'Submitting high weekly volume without customized keyword alignment, resulting in automated portal rejections before human review.'
  } else if (isReferralHunter) {
    archetype = 'High-Touch Referral & Network Navigator'
    personaSummary = 'Leveraging direct human outreach and engineering alumni to bypass cold portals and secure warm hiring manager interviews.'
  } else if (!requiresSponsorship && appsPerWeek >= 30) {
    archetype = 'Unrestricted High-Output Enterprise Candidate'
    personaSummary = 'US work authorized with strong weekly outbound volume, needing optimized recruiter branding to convert top-tier callbacks.'
  }

  // 6. Agent Directives
  // Directives for Resume Agent (Maya in modeC_hybrid.js)
  const resumeDirectives = []
  if (hasSystemDesignGap) {
    resumeDirectives.push('EMPHASIZE DISTRIBUTED SYSTEMS ARCHITECTURE: Emphasize concurrency, microservices decomposition, horizontal scaling, caching strategies, and latency/throughput metrics in bullet rewrites to eliminate system design doubts.')
  }
  if (hasCodingAnxiety) {
    resumeDirectives.push('DEMONSTRATE RIGOROUS CORE ENGINEERING: Highlight data structures, algorithmic optimizations, code quality, and automated test coverage in project and experience bullets to reassure technical hiring panels.')
  }
  if (isStudentOrOpt) {
    resumeDirectives.push('STRIP ACADEMIC & STUDENT BIAS: Ruthlessly eliminate amateur or academic phrasing (e.g. "course project", "learned React", "assisted professor"). Frame all engineering achievements with battle-tested production ownership.')
  }
  if (isC2C) {
    resumeDirectives.push('FRAME VENDOR WORK WITH DIRECT ENTERPRISE OWNERSHIP: Replace passive contractor phrasing ("supported client", "assigned to vendor team") with direct architectural leadership on core client deliverables.')
  }
  if (isEasyApplyHeavy || hasATSBlackHole) {
    resumeDirectives.push('MAXIMIZE TOP-OF-PAGE ATS DENSITY: Candidate is experiencing severe ATS filtering (<5% callbacks). Ensure standard section headers, frontload high-demand cloud and backend keywords in the first 2 bullets of every role, and eliminate parsing anomalies.')
  }
  if (resumeDirectives.length === 0) {
    resumeDirectives.push('STRENGTHEN BUSINESS OUTCOME QUANTIFICATION: Elevate technical achievements by pairing every tool with a concrete business impact metric (latency, revenue, user scale, cost efficiency).')
  }

  // Directives for LinkedIn Agent (Liam / Sophia in linkedinSynthesis.prompt.js)
  const linkedInDirectives = []
  if (requiresSponsorship) {
    linkedInDirectives.push(`OPTIMIZE FOR E-VERIFY TECH RECRUITERS: Candidate is on ${visaCategory}. Highlight skills that tech talent partners search for (e.g. distributed systems, cloud architecture) and avoid ambiguous visa disclosures on the public profile that trigger premature filtering.`)
  } else {
    linkedInDirectives.push('LEVERAGE WORK AUTHORIZATION ADVANTAGE: Candidate has unrestricted US work authorization. Craft positioning that appeals to enterprise, financial, and government contractor hiring managers.')
  }
  if (coldOutreachPerWeek < 8) {
    linkedInDirectives.push(`PROACTIVE OUTREACH PLAYBOOK: Candidate sends only ${coldOutreachPerWeek} cold outreach notes/week. Provide 2 punchy, high-response LinkedIn connection request and InMail templates tailored directly to engineering hiring managers.`)
  }
  if (isEasyApplyHeavy) {
    linkedInDirectives.push('PIVOT FROM EASY-APPLY TO INBOUND RECRUITER MAGNET: The candidate relies heavily on 1-click Easy Apply blasts. Focus the 220-character Headline and About section on keyword searchability so recruiters discover their profile directly via LinkedIn Recruiter.')
  }

  // Directives for Chatbot Agent (Atlas AI Coach in assessmentController.js)
  const targetRole = resumeContext?.targetRole || ans.targetRole || 'Software Professional'
  const candidateContextBrief = `Candidate is a ${targetRole} navigating the US tech market under ${visaCategory} status (${urgencyNote}). Top-of-funnel velocity: ${appsPerWeek} applications/week (~${appsPerMonth}/month) with ${coldOutreachPerWeek} direct networking messages/week, yielding ${humanScreensPerMonth} human recruiter screens/month (${conversionRatePct}% callback rate). Core search strategy: ${rawSearchStyle || 'Standard portal submissions'}. Primary pipeline bottleneck: ${primaryDropoffStage}. Candidate specifically reported drop-offs around: ${feedbackStr || 'Early recruiter screening'}. Dedicated weekly prep bandwidth: ${hoursPerWeek} hrs/week (${intensityTier}). When advising this candidate, ground every recommendation in their specific immigration constraints, conversion reality, and target role.`

  return {
    candidatePersona: {
      archetype,
      summary: personaSummary,
      confidence: 0.95,
    },
    workAuthContext: {
      visa: visaCategory,
      rawVisa,
      requiresSponsorship,
      isStudentOrOpt,
      isC2C,
      isW2Agency,
      isSolo,
      urgencyNote,
    },
    funnelMetrics: {
      appsPerWeek,
      appsPerMonth,
      coldOutreachPerWeek,
      humanScreensPerMonth,
      conversionRatePct,
      primaryDropoffStage,
      isEasyApplyHeavy,
      isTailoringResume,
      isPortalSniper,
      isReferralHunter,
    },
    interviewBottlenecks: {
      hasATSBlackHole,
      hasVisaGhosting,
      hasCodingAnxiety,
      hasSystemDesignGap,
      hasPostScreenGhosting,
      hasFinalRoundDropoff,
      rawDropoffs: rawFeedback,
    },
    sprintBandwidth: {
      hoursPerWeek,
      intensityTier,
    },
    agentDirectives: {
      forResumeAgent: resumeDirectives.join('\n'),
      forLinkedInAgent: linkedInDirectives.join('\n'),
      forChatbotAgent: candidateContextBrief,
    },
  }
}

export default { evaluateAssessmentPersona }
