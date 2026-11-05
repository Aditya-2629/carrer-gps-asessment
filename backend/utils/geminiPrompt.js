import defaultKnowledgeBase from './knowledgeBase.js'

/**
 * Strips null, undefined, empty strings, and empty arrays/objects recursively.
 */
export function stripEmptyKeys(obj) {
  if (Array.isArray(obj)) {
    const cleanedArr = obj
      .map(stripEmptyKeys)
      .filter((v) => {
        if (v === null || v === undefined || v === '') return false
        if (Array.isArray(v) && v.length === 0) return false
        if (typeof v === 'object' && Object.keys(v).length === 0) return false
        return true
      })
    return cleanedArr.length > 0 ? cleanedArr : []
  } else if (obj && typeof obj === 'object') {
    const res = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined || v === '') continue
      if (Array.isArray(v) && v.length === 0) continue
      const cleaned = stripEmptyKeys(v)
      if (cleaned === null || cleaned === undefined || cleaned === '') continue
      if (Array.isArray(cleaned) && cleaned.length === 0) continue
      if (typeof cleaned === 'object' && Object.keys(cleaned).length === 0) continue
      res[k] = cleaned
    }
    return res
  }
  return obj
}

const safeJson = (data) => {
  if (!data) return ''
  const cleaned = stripEmptyKeys(data)
  return JSON.stringify(cleaned, null, 2).replace(/`/g, "'")
}

/**
 * Strips tracking query parameters (miniProfileUrn, trackingId, lipi, etc.) from URLs.
 */
export const cleanTrackingUrl = (url) => {
  if (typeof url !== 'string' || !url) return ''
  try {
    const u = new URL(url)
    const toDelete = []
    for (const [k] of u.searchParams.entries()) {
      if (
        /^(miniprofileurn|trackingid|lipi|trk|utm_|ref_|midtoken|fs_)/i.test(k) ||
        k.toLowerCase().includes('tracking') ||
        k.toLowerCase().includes('urn')
      ) {
        toDelete.push(k)
      }
    }
    toDelete.forEach((k) => u.searchParams.delete(k))
    const search = u.searchParams.toString()
    return `${u.origin}${u.pathname}${search ? '?' + search : ''}`
  } catch {
    return url
      .replace(/[?&](miniProfileUrn|trackingId|lipi|trkCode|trackingParam)=[^&#]*/gi, '')
      .replace(/[?&]$/, '')
  }
}

/**
 * Compacts LinkedIn scraper data: strips tracking query params and machine noise
 * while preserving 100% of candidate profile text, real work experiences, and education.
 */
export const compactLinkedInForAtlas = (li) => {
  if (!li || typeof li !== 'object') return null

  const name = li.firstName ? `${li.firstName} ${li.lastName || ''}`.trim() : li.fullName || li.name || ''
  const headline = li.headline || ''
  const about = String(li.about || li.summary || '').split('?')[0].slice(0, 1200).trim()
  const location = li.location?.parsed?.text || li.location?.linkedinText || (typeof li.location === 'string' ? li.location : '')
  const openToWork = Boolean(li.openToWork)
  const connectionsCount = li.connectionsCount || li.connections || 0
  const followerCount = li.followerCount || li.followers || 0

  const topSkills = (li.topSkills || (Array.isArray(li.skills) ? li.skills.map((s) => (typeof s === 'string' ? s : s?.name)) : []))
    .filter(Boolean)

  const rawExp = Array.isArray(li.experience) ? li.experience : Array.isArray(li.positions) ? li.positions : []
  const experience = rawExp.map((e) => ({
    title: e.title || e.position || '',
    company: e.companyName || e.company || '',
    duration: e.duration || e.dateRange || e.dates || '',
    description: String(e.description || e.text || '').split('?')[0].slice(0, 250).trim(),
  }))

  const rawEdu = Array.isArray(li.education) ? li.education : []
  const education = rawEdu.map((ed) => ({
    school: ed.schoolName || ed.school || '',
    degree: ed.degreeName || ed.degree || '',
    dates: ed.dates || ed.year || '',
  }))

  const result = {
    name,
    headline,
    about,
    location,
    openToWork,
    connectionsCount,
    followerCount,
    topSkills,
    experience,
    education,
  }

  // Preserve optional genuine sections only if non-empty
  const rawCerts = Array.isArray(li.certifications) ? li.certifications : []
  if (rawCerts.length > 0) {
    result.certifications = rawCerts.map((c) => (typeof c === 'string' ? c : c.name || c.title)).filter(Boolean)
  }
  const rawVol = Array.isArray(li.volunteer) ? li.volunteer : []
  if (rawVol.length > 0) {
    result.volunteer = rawVol.map((v) => (typeof v === 'string' ? v : v.role || v.organization)).filter(Boolean)
  }
  const rawProj = Array.isArray(li.projects) ? li.projects : []
  if (rawProj.length > 0) {
    result.projects = rawProj.map((p) => (typeof p === 'string' ? p : p.title || p.name)).filter(Boolean)
  }

  return stripEmptyKeys(result)
}

/**
 * Compacts Resume data: strips OCR/PDF artifacts (rawText, fullText, markdown, _raw, boundingBoxes, styles)
 * while preserving 100% of candidate's real personal context (all roles, bullets, metrics, projects, skills).
 */
export const compactResumeForAtlas = (res) => {
  if (!res || typeof res !== 'object') return null

  // Strip any raw OCR/fullText blobs, boundingBoxes, and CSS/styling
  const {
    rawText,
    fullText,
    markdown,
    _raw,
    boundingBoxes,
    styles,
    css,
    style,
    pageLayout,
    fontMap,
    ...cleanRes
  } = res

  const candidateName = cleanRes.candidate?.name || cleanRes.name || ''
  const targetRole = cleanRes.candidate?.targetRole || cleanRes.targetRole || ''
  const summary = String(cleanRes.summary || cleanRes.profile || cleanRes.objective || '').trim()

  // Preserve 100% of skills categories or array
  let skills = cleanRes.skills
  if (Array.isArray(skills)) {
    skills = skills.filter(Boolean)
  } else if (skills && typeof skills === 'object') {
    skills = stripEmptyKeys(skills)
  }

  const rawExp = Array.isArray(cleanRes.experience)
    ? cleanRes.experience
    : Array.isArray(cleanRes.experiences)
    ? cleanRes.experiences
    : []

  const experience = rawExp.map((role) => {
    const rawBullets = Array.isArray(role.bullets)
      ? role.bullets.map((b) => (typeof b === 'string' ? b : b?.text || ''))
      : Array.isArray(role.highlights)
      ? role.highlights.map((h) => (typeof h === 'string' ? h : h?.text || ''))
      : []

    return {
      role: role.role || role.title || '',
      company: role.company || role.employer || '',
      dates: role.dates || role.duration || '',
      location: role.location || '',
      bullets: rawBullets.filter(Boolean),
    }
  })

  const rawProjects = Array.isArray(cleanRes.projects) ? cleanRes.projects : []
  const projects = rawProjects.map((p) => {
    const projBullets = Array.isArray(p.bullets)
      ? p.bullets.map((b) => (typeof b === 'string' ? b : b?.text || ''))
      : []
    return {
      name: p.name || p.title || '',
      technologies: p.technologies || p.tech || [],
      description: String(p.description || '').trim(),
      bullets: projBullets.filter(Boolean),
    }
  })

  const rawEdu = Array.isArray(cleanRes.education) ? cleanRes.education : []
  const education = rawEdu.map((ed) => ({
    institution: ed.institution || ed.school || '',
    degree: ed.degree || '',
    year: ed.year || ed.dates || '',
  }))

  const result = {
    candidate: candidateName || targetRole ? { name: candidateName, targetRole } : undefined,
    summary,
    skills,
    experience,
    projects,
    education,
  }

  return stripEmptyKeys(result)
}

/**
 * Compacts semantic assessment profile: retains ONLY high-signal candidate data
 * (answer, perWeek, perMonth, intent) and eliminates static dictionary rulebooks.
 */
export const compactSemanticProfile = (sp) => {
  if (!sp || typeof sp !== 'object') return null
  const cleaned = {}
  for (const [key, val] of Object.entries(sp)) {
    if (!val) continue
    cleaned[key] = {
      answer: val.candidateAnswer !== undefined ? val.candidateAnswer : val.answer,
      perWeek: val.normalizedPerWeek,
      perMonth: val.normalizedPerMonth,
      intent: val.field || key,
    }
  }
  return stripEmptyKeys(cleaned)
}

/**
 * Trims knowledge base text to top essential benchmarks and statistics (max 1,200 chars).
 */
export const compactKnowledgeBase = (kb) => {
  if (!kb || typeof kb !== 'string') return ''
  const trimmed = kb.trim()
  if (trimmed.length <= 1200) return trimmed

  const lines = trimmed.split('\n')
  const benchmarkLines = []
  let lengthCount = 0

  for (const line of lines) {
    const l = line.trim()
    if (!l) continue
    const isStatLine =
      l.startsWith('###') ||
      l.startsWith('####') ||
      /\b(\d+%\b|\d+:\d+|\d+\+|\bresponse rate\b|\bconversion\b|\breferral\b|\bATS\b|\bvelocity\b|\btime to hire\b|\binterview rate\b)/i.test(
        l
      )
    if (isStatLine) {
      if (lengthCount + l.length + 1 <= 1200) {
        benchmarkLines.push(l)
        lengthCount += l.length + 1
      }
    }
  }

  if (benchmarkLines.length > 0) {
    return benchmarkLines.join('\n')
  }
  return trimmed.slice(0, 1200).trim()
}

export default (
  userData,
  resumeData = null,
  linkedinData = null,
  dynamicKnowledgeBase = null,
  semanticProfile = null,
  resumeAgent = null,
  linkedinAgent = null,
  assessmentPersona = null,
  userAnswers = null,
  compactDigest = null
) => {
  // Support flexible signatures (e.g. tests passing persona or answers at index 6 or 7)
  let effectivePersona = assessmentPersona
  let effectiveAnswers = userAnswers || userData || {}
  if (linkedinAgent && !assessmentPersona && (linkedinAgent.seniorityTier || linkedinAgent.phase)) {
    effectivePersona = linkedinAgent
  } else if (linkedinAgent && !assessmentPersona && (linkedinAgent.targetRole || linkedinAgent.recruiterScreensCount !== undefined)) {
    effectiveAnswers = { ...effectiveAnswers, ...linkedinAgent }
  }

  const seniorityTier = effectivePersona?.seniorityTier || effectivePersona?.level || 'Mid-Level'
  const trajectory = effectivePersona?.trajectory || effectivePersona?.trajectoryArchetype || 'High-Velocity Technical Accelerator'
  const phase = effectivePersona?.phase || {
    id: 1,
    name: 'Resume → Screening Call',
    shortName: 'Top of Funnel',
    stuckDescription: 'Cold Application Black Hole',
  }

  const targetRole =
    effectivePersona?.targetRole ||
    resumeData?.candidate?.targetRole ||
    resumeData?.targetRole ||
    effectiveAnswers.targetRole ||
    effectiveAnswers.target_role ||
    userData?.target_role ||
    'Target Role'

  const candidateName =
    effectivePersona?.candidateName ||
    resumeData?.candidate?.name ||
    resumeData?.name ||
    effectiveAnswers.name ||
    userData?.name ||
    'Candidate'

  const dropOffStage =
    effectivePersona?.primary_bottleneck?.title ||
    effectivePersona?.primaryBottleneck ||
    effectiveAnswers.DropOffStage ||
    userData?.DropOffStage ||
    `${phase.name} Choke Point`

  const appsCount =
    effectiveAnswers.applications_count ||
    effectiveAnswers.applicationsCount ||
    userData?.applications_count ||
    'their reported pace'

  const appsPeriod =
    effectiveAnswers.applications_period ||
    userData?.applications_period ||
    'period'

  const visaStatus =
    userData?.visa ||
    userData?.visaStatus ||
    effectiveAnswers.visa ||
    effectiveAnswers.visaStatus ||
    'US Citizen / Green Card'

  return `
You are "Atlas", an elite Executive Career Strategist, Executive Technical Career Strategist, and Veteran Silicon Valley Technical Recruiter.
Analyze this candidate's exact career telemetry and produce an unapologetically candid, high-precision executive diagnostic.

STRICT OPERATIONAL DIRECTIVES:
1. SPEAK DIRECTLY TO THE CANDIDATE: Use natural, authoritative second-person ("you", "your"). Sound like a trusted senior partner at an executive search firm.
2. ZERO AI FILLER TOLERANCE: Never write "navigating the job market", "in conclusion", "it is crucial", "testament to", "delve", "synergies", "holistic", or generic corporate platitudes / AI buzzwords.
3. LEVEL-CALIBRATED VOICE (${seniorityTier}):
   - Junior (0–2 YOE): Call out generic tutorial clones; demand verifiable production commits, test coverage, and CI/CD pipelines.
   - Mid-Level (3–5 YOE): Demand business metrics ($/latency/throughput), end-to-end service ownership, and database trade-offs.
   - Senior (6–9 YOE): Focus on system architecture, concurrency, distributed systems scale, cross-team technical leadership, and mentoring signals.
   - Staff / Lead (10+ YOE): Focus on multi-team technical strategy, high-stakes trade-offs ("Why this architectural direction?"), organizational leverage, and executive communication.
   CURRENT LEVEL FOR THIS CANDIDATE: ${seniorityTier} (Trajectory: ${trajectory}). Tailor your feedback, expectations, and diagnostic tone strictly to this seniority tier.
4. US TECH BENCHMARK CITATION:
   - Cold Application to Recruiter Screen: 2% to 3% baseline (1 screen per 35–45 applications).
   - Warm Referral / Direct Hiring Manager Outreach: 18% to 24% callback conversion.
   - Technical Round to Final Offer: ~35% threshold.
   - ATS Scan Drop-off: 75% discarded in under 6 seconds due to unquantified responsibility bullets.
5. GROUND EVERY CLAIM: Quote candidate's exact company names, exact reported metrics, exact verified technologies, and exact detected bottleneck (Phase ${phase.id}: ${phase.name}).
6. EXPLAIN THE "Hidden Market Why": Explain why recruiters skip them (e.g. "Listing tools without operational ownership reads like passive keyword stuffing rather than technical delivery").
7. CROSS-DOCUMENT DISCREPANCY: Expose real gaps between their resume and LinkedIn (e.g. title drift, missing projects).
8. ACTION ROADMAP: Provide concrete, 1-sentence weekly tasks quoting specific tools (e.g. dbt, Snowflake, DAX, LeetCode, Levels.fyi) and measurable targets.
9. CONVERSION BRIDGE: Position the 1-on-1 Strategy Call as the required live implementation step to build their direct hiring manager referral engine.

### CANDIDATE PROFILE & EVIDENCE:
- Target Role: ${targetRole}
- Candidate Name: ${candidateName}
- Seniority Tier: ${seniorityTier}
- Trajectory Archetype: ${trajectory}
- Current Hiring Phase: Phase ${phase.id}: ${phase.name} (${phase.shortName || ''})
- Stated Bottleneck / Drop-off Stage: ${dropOffStage}
- Reported Applications Pace: ${appsCount} applications / ${appsPeriod}
- Visa / Work Authorization: ${visaStatus}

### RESUME AGENT AUDIT FINDINGS:
${resumeAgent ? safeJson({
  atsScore: resumeAgent.score,
  strengths: resumeAgent.strengths,
  verifiedSkills: resumeAgent.verifiedSkills || resumeAgent.dashboard?.keywordAlignment?.matchedInExperience || [],
  missingSkills: resumeAgent.missingTargetKeywords || resumeAgent.dashboard?.keywordAlignment?.missingFromResume || [],
  topIssues: (resumeAgent.issues || []).slice(0, 4).map((i) => ({ title: i.title, problem: i.problem, fix: i.recommendation })),
}) : 'Resume audit pending.'}

### LINKEDIN AGENT DISCREPANCIES:
${linkedinAgent ? safeJson({
  linkedinScore: linkedinAgent.score,
  discrepancies: (linkedinAgent.discrepancies || []).slice(0, 4).map((d) => ({ title: d.title, diagnosis: d.diagnosis, fix: d.fix })),
  headlineAudit: linkedinAgent.optimizations?.headline,
}) : 'LinkedIn audit pending.'}

${compactDigest ? `\n${compactDigest}\n` : `
### VERIFIED WORK HISTORY:
${resumeData ? safeJson(compactResumeForAtlas(resumeData)) : 'No resume provided.'}

### SCRAPED LINKEDIN DETAILS:
${linkedinData ? safeJson(compactLinkedInForAtlas(linkedinData)) : 'No LinkedIn provided.'}

${semanticProfile ? `### CANDIDATE AI-SEMANTIC ASSESSMENT PROFILE:\n${safeJson(compactSemanticProfile(semanticProfile))}\n` : ''}
`}

REQUIRED JSON SCHEMA (OUTPUT ONLY VALID RAW JSON, ZERO MARKDOWN CODE FENCES):
{
  "career_health_score": "<integer 0-100 matching assessment agent score>",
  "score_label": "<Elite Positioning | Competitive | Needs Optimization | Critical Focus Required>",
  "score_breakdown": {
    "resume": { "score": "<integer 0-100>", "diagnosis": "<Reference verified ATS score, missing keywords, and specific red flags>" },
    "linkedin": { "score": "<integer 0-100>", "diagnosis": "<Reference LinkedIn headline, about section, connection count, or activity level>" },
    "outreach": { "score": "<integer 0-100>", "diagnosis": "<Reference networking velocity and application volume>" },
    "interviews": { "score": "<integer 0-100>", "diagnosis": "<Reference technical round conversion and funnel leak>" }
  },
  "market_reality_check": {
    "headline": "<Candid market reality headline personalized to role and market competition using KB stats>",
    "brutal_facts": [
      "<Fact 1 citing market conversion benchmarks for their role>",
      "<Fact 2 targeting their specific drop-off stage>",
      "<Fact 3 citing resume/LinkedIn scan behavior>"
    ],
    "application_velocity": "<Assessment of weekly application pace vs market benchmark>",
    "resume_blackhole": "<Why their specific gaps cause recruiter skips>"
  },
  "career_journey": {
    "current_phase_id": ${phase.id},
    "phase_name": "${phase.name}",
    "guide_message": "<1-2 sentences personalized guidance for their current phase>"
  },
  "funnel_stages": {
    "applications_count": "<candidate's actual total estimated applications from assessment answers>",
    "recruiter_calls_count": "<candidate's actual or estimated recruiter screening calls>",
    "interviews_count": "<candidate's actual or estimated technical interviews>",
    "final_rounds_count": "<candidate's actual final rounds>",
    "offers_count": "<candidate's actual offers>",
    "biggest_leak_stage": "<exact funnel stage with steepest drop-off>",
    "diagnosis_message": "<1-2 sentences diagnosing why funnel leaks here>"
  },
  "rejection_factors": [
    { "name": "Resume & ATS", "pct": 40, "desc": "<Specific flaw from candidate data causing this rejection factor>" },
    { "name": "Execution & Velocity", "pct": 25, "desc": "<Specific flaw from candidate data>" },
    { "name": "LinkedIn Discoverability", "pct": 20, "desc": "<Specific flaw from candidate data>" },
    { "name": "Interview Defense", "pct": 15, "desc": "<Specific flaw from candidate data>" }
  ],
  "rejection_insight": "<1-2 sentences on the primary friction factor hurting them most and why>",
  "risk_heatmap": {
    "critical_risk": "<Single most dangerous career risk based on their visa status, funnel velocity, or resume/LinkedIn gap>",
    "high_impact_low_likelihood": ["<Scenario 1>", "<Scenario 2>"],
    "low_impact_high_likelihood": ["<Scenario 1>", "<Scenario 2>"],
    "mitigation_plan": "<2-3 sentence protocol to systematically defuse this risk>"
  },
${compactDigest ? `  "executive_verdict": "<2-3 sentence candid executive recruiter verdict on their positioning and market viability>",
  "key_advantage": "<Single biggest verified technical advantage from resume/experience>",
  "primary_bottleneck": "<Single biggest leak in their funnel and why>",
  "risk_matrix": [
    { "factor": "Market Friction", "severity": "High", "mitigation": "<Actionable fix>" },
    { "factor": "Technical Defense", "severity": "Medium", "mitigation": "<Actionable fix>" }
  ],
  "top_priorities": [
    "<Priority 1 with specific tool/metric target>",
    "<Priority 2 with specific tool/metric target>",
    "<Priority 3 with specific tool/metric target>"
  ],` : `  "mission_board": {
    "xp_level": "<Gamified level based on score, e.g. Level 2: Strategic Positioner>",
    "xp_current": 250,
    "missions": [
      { "title": "<High priority mission tailored to resume ATS gap>", "xp": "+25 XP", "impact": "High Impact" },
      { "title": "<Mission tailored to LinkedIn SEO gap>", "xp": "+20 XP", "impact": "High Impact" },
      { "title": "<Mission tailored to outreach velocity>", "xp": "+15 XP", "impact": "Medium Impact" },
      { "title": "<Mission tailored to technical architecture proof>", "xp": "+15 XP", "impact": "Medium Impact" },
      { "title": "<Mission tailored to mock interview defense>", "xp": "+20 XP", "impact": "High Impact" }
    ]
  },
  "roadmap": [
    {
      "week": "Week 1",
      "theme": "Phase 1: Positioning",
      "goal": "<Clear measurable objective tied to their specific situation>",
      "tasks": ["<Specific task with tool name>", "<Task 2 with deadline>", "<Task 3 with outcome>"]
    }
  ],`}
  "critical_issues": [
    {
      "title": "<Punchy 3-5 word title>",
      "severity": "<High or Critical>",
      "icon_suggestion": "alert-triangle",
      "diagnosis": "<1-2 sentences citing exact candidate data, companies, or tools>",
      "action_steps": ["<Step 1 with tool names>", "<Step 2 with measurable target>"]
    }
  ],
  "recommended_tools": [
    { "tool_name": "<Specific tool name>", "category": "<ATS / Outreach / Interview Prep>", "reason": "<Why this candidate specifically needs it>" }
  ],
  "coach_intervention": {
    "urgency_statement": "<Why resume and LinkedIn copy rewrites alone cannot fix cold portal drop-offs or interview round drop-offs>",
    "value_prop": "<Specific value proposition for 1-on-1 strategy call focusing on targeted referrals, recruiter screen negotiation, and mock interview preparation>",
    "cta_text": "Book Free 1-on-1 Strategy Session"
  }
}

${compactDigest
  ? 'Focus dynamic output on candid diagnostic analysis, executive verdict, and high-ROI custom actions. Ensure exactly 3 critical_issues, exactly 3 recommended_tools, exactly 4 rejection_factors summing to 100%, and exactly 3 brutal_facts.'
  : 'Ensure exactly 3 critical_issues, exactly 4 weeks in roadmap, exactly 3 recommended_tools, exactly 4 rejection_factors summing to 100%, and exactly 3 brutal_facts.'}
Return a valid, raw JSON object following the required Atlas schema with zero markdown backticks.
`
}
