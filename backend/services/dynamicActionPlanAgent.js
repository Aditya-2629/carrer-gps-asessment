import { llmGateway } from '../ai/gateway/llmGateway.js'
import { classifyRoleArchetype } from '../agents/core/roleArchetypeClassifier.js'

function safeParseJson(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return null
  try {
    return JSON.parse(rawContent)
  } catch (_e) {
    let clean = rawContent
      .replace(/^[\s\S]*?```json\s*/i, '')
      .replace(/```[\s\S]*$/, '')
      .trim()
    try {
      return JSON.parse(clean)
    } catch (_e2) {
      const match = rawContent.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          return JSON.parse(match[0])
        } catch (_e3) {}
      }
    }
  }
  return null
}

const ARCHETYPE_HIRING_TITLES = {
  DATA_ANALYTICS: ['Head of Data', 'Director of Analytics', 'Analytics Engineering Manager', 'VP of Analytics'],
  SOFTWARE_ENG: ['Engineering Manager', 'Director of Engineering', 'VP of Engineering', 'Head of Software'],
  AI_ML: ['Head of AI', 'Director of Machine Learning', 'VP of AI/ML', 'Lead AI Scientist'],
  PRODUCT_MGMT: ['VP of Product', 'Head of Product', 'Director of Product Management', 'Chief Product Officer'],
  DEVOPS_SRE: ['Director of Platform Engineering', 'Head of Infrastructure', 'VP of Cloud & DevOps', 'SRE Manager'],
  SALES_GTM: ['VP of Sales', 'Head of Revenue', 'Director of Business Development', 'Chief Commercial Officer'],
  FINANCE_BIZ: ['VP of Finance', 'Head of FP&A', 'Director of Strategic Finance', 'Chief Financial Officer'],
  HEALTHCARE_GEN: ['Clinical Director', 'VP of Clinical Operations', 'Director of Healthcare Services', 'Chief Nursing Officer'],
  GENERAL_PRO: ['VP of Operations', 'Director of Strategy & Operations', 'Head of Operations', 'Chief Operating Officer'],
}

const ARCHETYPE_TEAM_LABELS = {
  DATA_ANALYTICS: 'data & analytics',
  SOFTWARE_ENG: 'engineering',
  AI_ML: 'AI/ML initiatives',
  PRODUCT_MGMT: 'product',
  DEVOPS_SRE: 'platform & infrastructure',
  SALES_GTM: 'revenue & sales',
  FINANCE_BIZ: 'finance & strategy',
  HEALTHCARE_GEN: 'clinical operations',
  GENERAL_PRO: 'operations & strategy',
}

/**
 * Builds deterministic fallback 7-day quick plan, 30/60/90 day milestone pathway,
 * and recruiter diagnostics. Tailored dynamically to the candidate's targetRole,
 * skills, resume proof density, and funnel friction.
 */
export function buildDeterministicActionPlan({
  targetRole = 'Software Engineer',
  verifiedSkills = [],
  missingSkills = [],
  bulletAudit = [],
  signals = {},
  bottleneck = {},
  funnelStages = {},
  answers = {},
  apps30d = 0,
  screens = 0,
  resumeJson = {},
  presentCompany = '',
} = {}) {
  const archetype = classifyRoleArchetype(targetRole, verifiedSkills)

  // Candidate-Specific Verified Skills
  const verifiedSkillsList = (Array.isArray(verifiedSkills) ? verifiedSkills : [])
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill || s?.keyword || ''))
    .map((s) => s.trim())
    .filter(Boolean)
  const skillsStr = verifiedSkillsList.slice(0, 4).join(', ') || archetype.mandatoryTools.slice(0, 3).join(', ') || 'core domain tools'

  // Candidate-Specific Missing Skills
  const missingSkillsList = (Array.isArray(missingSkills) && missingSkills.length > 0 ? missingSkills : (Array.isArray(resumeJson?.missing_skills) ? resumeJson.missing_skills : []))
    .map((s) => (typeof s === 'string' ? s : s?.skill || s?.name || s?.keyword || ''))
    .map((s) => s.trim())
    .filter(Boolean)
  const fallbackMissing = archetype.mandatoryTools.filter((t) => !verifiedSkillsList.some((v) => t.toLowerCase().includes(v.toLowerCase()))).slice(0, 3)
  const finalMissingList = missingSkillsList.length > 0 ? missingSkillsList : (fallbackMissing.length > 0 ? fallbackMissing : ['System Architecture', 'CI/CD Automation', 'Scalability Metrics'])
  const missingSkillsStr = finalMissingList.slice(0, 3).join(', ')

  // Extract Experience and Company Context
  const expList = Array.isArray(resumeJson?.experience)
    ? resumeJson.experience
    : (Array.isArray(resumeJson?.experiences) ? resumeJson.experiences : [])
  const latestRole = expList[0] || {}
  const rawCompany = presentCompany || latestRole.company || latestRole.employer || latestRole.companyName || 'your most recent role'
  const cleanCompany = String(rawCompany).split('|')[0].trim() || 'your latest company'

  // Extract all bullets for quantification and win extraction
  const allBullets = []
  for (const e of expList) {
    const bList = Array.isArray(e.bullets) ? e.bullets : (Array.isArray(e.bulletPoints) ? e.bulletPoints : (Array.isArray(e.highlights) ? e.highlights : []))
    for (const b of bList) {
      const text = typeof b === 'string' ? b : b?.text || b?.bullet || ''
      if (text && text.trim()) allBullets.push(text.trim())
    }
  }

  // Calculate unquantified bullets count
  const auditList = Array.isArray(bulletAudit) ? bulletAudit : []
  let unquantifiedCount = 0
  let totalBullets = 0
  if (auditList.length > 0) {
    totalBullets = auditList.length
    unquantifiedCount = auditList.filter((b) => !b.hasQuantifier && !b.isQuantified).length
  } else {
    totalBullets = Math.max(1, allBullets.length)
    const quantifiedBullets = allBullets.filter((b) => /\d+[%kKmMbB]?|\$\d+/g.test(b)).length
    unquantifiedCount = Math.max(0, totalBullets - quantifiedBullets)
  }

  // Extract Top Verified Win from Resume Bullets
  let topVerifiedWin = ''
  for (const text of allBullets) {
    if (/\d+%?|\$\d+/i.test(text) && text.length > 20) {
      topVerifiedWin = text.replace(/^[•\-*▪–—·\s]+/, '').trim()
      break
    }
  }
  if (!topVerifiedWin && allBullets.length > 0) {
    topVerifiedWin = allBullets[0].replace(/^[•\-*▪–—·\s]+/, '').trim()
  }
  if (!topVerifiedWin) {
    topVerifiedWin = `architected core systems for ${targetRole} driving 25%+ efficiency and throughput gains`
  }
  const winSummary = topVerifiedWin.length > 70 ? topVerifiedWin.slice(0, 70).replace(/\s+\S*$/, '') + '...' : topVerifiedWin

  // Real Funnel Numbers
  const effectiveApps30d = Number(apps30d || answers.applicationsLast30Days || funnelStages.applications30d || Math.round(Number(funnelStages.applications90d || 45) / 3) || 15)
  const effectiveApps90d = Number(funnelStages.applications90d || answers.applications90d || effectiveApps30d * 3 || 45)
  const effectiveScreens = Number(screens || funnelStages.recruiterScreens || funnelStages.screens || answers.recruiterScreens || 0)
  const effectiveTechs = Number(funnelStages.technicalRounds || answers.technicalRounds || 0)
  const effectiveOffers = Number(funnelStages.offers || answers.offers || 0)
  const callbackRate = effectiveApps30d > 0 ? ((effectiveScreens / effectiveApps30d) * 100).toFixed(1) : '0.0'
  const dropOffGate = funnelStages.biggest_leak_stage || funnelStages.leak_title || bottleneck.title || 'Screening Callback Gate'

  // Contact Anomaly Detection
  const contactMerged = Boolean(signals?.contactMerge?.isContactMerged || signals?.isContactMerged)

  // Dynamic Boolean Search String
  const hiringTitles = ARCHETYPE_HIRING_TITLES[archetype.key] || ARCHETYPE_HIRING_TITLES.SOFTWARE_ENG
  const titleQuery = hiringTitles.slice(0, 3).map((t) => `"${t}"`).join(' OR ')
  const roleQuery = `"${targetRole}"`
  const topTwoSkills = verifiedSkillsList.slice(0, 2)
  const skillQuery = topTwoSkills.length > 0
    ? topTwoSkills.map((s) => `"${s}"`).join(' OR ')
    : `"${archetype.mandatoryTools[0]}"`
  const booleanSearchString = `(${titleQuery}) AND (${roleQuery}) AND (${skillQuery})`

  // Dynamic 3-Line Cold Outreach Script
  const archetypeTeamLabel = ARCHETYPE_TEAM_LABELS[archetype.key] || 'engineering'
  const topSkillSummary = topTwoSkills.join(' and ') || archetype.mandatoryTools[0]
  const coldOutreachScript = `Hi [Name], saw you're leading ${archetypeTeamLabel} at [Company]. At ${cleanCompany}, I recently ${winSummary.replace(/\.$/, '')} using ${topSkillSummary}. Given your team's scale, would love to connect and share notes if you are exploring talent in ${targetRole}.`

  // 6-Second Recruiter Verdict
  let recruiterVerdict = ''
  if (contactMerged) {
    recruiterVerdict = `P0 ATS Parser Anomaly: Contact information is merged directly into your summary/experience stream in the extracted resume text. Automated parsing engines at Workday, Greenhouse, and Taleo will fail to index your email and phone, leading to silent automated disqualification before human recruiters see your background. Re-anchor contact details in a strict single-column header.`
  } else if (effectiveApps90d >= 35 && effectiveScreens <= 2) {
    recruiterVerdict = `Top-of-Funnel Conversion Leak: Your volume of ${effectiveApps90d} applications is converting into only ${effectiveScreens} screens (${callbackRate}% callback vs 8-12% benchmark). Technical recruiters scan resumes in 6 seconds looking for verified ${targetRole} keywords and operational outcomes. Without quantified metrics in top bullets, automated ATS filters and screening coordinators pass over your profile.`
  } else if (effectiveScreens >= 3 && effectiveTechs <= 1) {
    recruiterVerdict = `Screen-to-Technical Clearance Leak: You are successfully booking initial recruiter phone screens (${effectiveScreens} screens) but dropping out before technical or panel evaluations (${effectiveTechs} passed). Hiring teams are not hearing deep hands-on architectural ownership or clear trade-off defense for ${targetRole} during the 15-minute qualification screen.`
  } else if (effectiveTechs >= 2 && effectiveOffers === 0) {
    recruiterVerdict = `Final-Round Closing Deficit: You are advancing through technical rounds (${effectiveTechs} cleared) but stalling at final decision loops without written offers. Final interview panels evaluate strategic business impact, executive communication, and leveling calibration rather than purely technical execution.`
  } else if (unquantifiedCount > 0 && totalBullets > 0 && (unquantifiedCount / totalBullets) >= 0.5) {
    recruiterVerdict = `Proof Density Deficit: ${unquantifiedCount} of your ${totalBullets} resume bullets describe passive job duties rather than verified operational outcomes. In a competitive ${targetRole} market, technical recruiters discard duty-based bullets within 6 seconds because they lack proof of scale, throughput, or business ROI.`
  } else {
    recruiterVerdict = `Market Positioning Calibration: In a competitive market for ${targetRole}, recruiters prioritize candidates with verified evidence in ${missingSkillsStr}. Bolstering quantified metrics and tailoring keywords to tier-1 job descriptions will lift your current ${callbackRate}% callback rate into the target >= 8.0% range.`
  }

  // 7-Day Quick Plan
  const day3Title = contactMerged
    ? 'P0 Contact Header & ATS Parser Safety Fix'
    : `Layout & ATS Calibration for ${dropOffGate}`
  const day3Action = contactMerged
    ? 'Isolate email, phone number, and LinkedIn URL into a clean, unstyled single-column top header to eliminate silent parser drop-offs across automated ATS engines.'
    : `Export resume into a clean single-column format with zero multi-column tables, eliminating parser drop-offs at the ${dropOffGate}.`
  const day3Deliverable = contactMerged
    ? 'ATS-verified single-column resume with cleanly parsed contact metadata.'
    : 'Plain-text parseable ATS-compliant resume document.'
  const day3Metric = 'Zero ATS contact parsing truncation errors across automated scanners.'

  const sevenDayQuickPlan = [
    {
      day: 1,
      title: 'Missing Skill Integration & ATS Audit',
      action: `Cross-reference your resume against target ${targetRole} job descriptions to integrate verified evidence for your missing skills: ${missingSkillsStr}.`,
      deliverable: `Keyword Alignment Ledger mapping ${missingSkillsStr} into active role bullets.`,
      metricTarget: 'Zero unverified core skills across top 3 target job descriptions.',
    },
    {
      day: 2,
      title: `Action-Verb & Metric Overhaul (${unquantifiedCount} Bullets)`,
      action: `Restructure ${Math.min(unquantifiedCount || 4, 4)} achievement bullets at ${cleanCompany} into Google XYZ syntax (Accomplished [X] measured by [Y] by doing [Z]) with hard operational numbers.`,
      deliverable: `${Math.min(unquantifiedCount || 4, 4)} restructured bullets for ${cleanCompany} containing verified metrics ($ or %).`,
      metricTarget: `100% of ${cleanCompany} bullets contain verified quantitative outcomes.`,
    },
    {
      day: 3,
      title: day3Title,
      action: day3Action,
      deliverable: day3Deliverable,
      metricTarget: day3Metric,
    },
    {
      day: 4,
      title: 'LinkedIn Recruiter SEO Alignment',
      action: `Deploy boolean search string (${booleanSearchString}). Update headline with 3 exact industry keywords for ${targetRole} and weave ${missingSkillsStr} naturally into About and Skills sections.`,
      deliverable: 'Updated 15-20 word searchable headline + 50 prioritized skills.',
      metricTarget: 'LinkedIn Search Appearance score lift within 7 days.',
    },
    {
      day: 5,
      title: 'Direct Hiring Manager Outreach Sprint',
      action: `Identify 10 hiring leaders (${hiringTitles.slice(0, 2).join(' or ')}) actively hiring for ${targetRole} and send this ready-to-send 3-line DM: "${coldOutreachScript}"`,
      deliverable: '10 personalized hiring manager DMs sent using the custom cold outreach script.',
      metricTarget: 'At least 2 warm recruiter/hiring manager conversation replies.',
    },
    {
      day: 6,
      title: `${archetype.label} Case Study & Defense Sheet`,
      action: `Draft a 1-page ${archetype.portfolioArtifact} covering your core work (${winSummary}), articulating failure modes and tradeoffs.`,
      deliverable: `1-page technical defense document (${archetype.dayAssessmentPrep}).`,
      metricTarget: 'Verbalize trade-offs and operational impact in under 3 minutes.',
    },
    {
      day: 7,
      title: `Funnel Calibration at ${dropOffGate}`,
      action: `Review response rates for submitted applications, audit profile views, and calibrate conversion targets at the ${dropOffGate}.`,
      deliverable: 'Weekly conversion report & 7-day outbound follow-up schedule.',
      metricTarget: 'Screen callback rate target >= 8.0%.',
    },
  ]

  const milestonePathway = [
    {
      period: '30 Days',
      stage: 'Asset Calibration & Outbound Sourcing Engine',
      goal: `Transition from low-yield volume (${effectiveApps30d} monthly applications yielding ${effectiveScreens} screens at ${callbackRate}% callback) to targeted outreach, lifting conversion to >= 8.0% to reliably secure 3-5 recruiter screens monthly.`,
      actions: [
        `Deploy single-column Google XYZ resume embedding verified ${missingSkillsStr} to overcome ATS drop-offs at the ${dropOffGate}.`,
        `Deploy LinkedIn Boolean search query (${booleanSearchString}) to source 30 target companies actively hiring for ${targetRole}.`,
        `Submit 10 high-intent applications weekly directly via company portals while multi-threading with the 3-line hiring manager outreach script.`,
      ],
      deliverable: 'ATS-Calibrated Resume + 30 Target Account Outbound Tracker',
      successSignal: 'Screen callback rate >= 8.0% with 3-5 recruiter screens booked monthly.',
      active: true,
    },
    {
      period: '60 Days',
      stage: 'Recruiter Screen Mastery & Technical Loop Velocity',
      goal: `Convert recruiter screens into live technical rounds (${archetype.interviewMechanism}) and advance through panel assessments.`,
      actions: [
        `Engage 10 ${hiringTitles[0]}s weekly using personalized outreach notes embedding your top wins.`,
        `Complete 15 timed practical problem sets and system architecture defense sessions in ${skillsStr}.`,
        'Conduct 2 weekly mock technical interviews focusing on verbalizing trade-offs out loud.',
      ],
      deliverable: 'Multi-Threaded Active Pipeline of 3+ Concurrent Technical Interview Loops',
      successSignal: 'Consistent conversion of >= 60% from recruiter screen to live technical round.',
      active: false,
    },
    {
      period: '90 Days',
      stage: 'Final Rounds, Offer Leverage & Negotiation',
      goal: 'Advance through onsite interview loops and secure a competitive, written job offer.',
      actions: [
        'Execute comprehensive system architecture and behavioral STAR interviews with hiring managers and directors.',
        `Benchmark total compensation bands (Base, Bonus, Equity) on Levels.fyi and market databases for ${targetRole}.`,
        'Negotiate starting terms using competing interview timeline leverage and structured counter-offer scripts.',
      ],
      deliverable: 'Minimum 1 Formal Written Offer with Verified Compensation Package',
      successSignal: 'Signed target offer matching market compensation baseline.',
      isGoal: true,
      active: false,
    },
  ]

  return {
    recruiterVerdict,
    sixSecondRecruiterVerdict: recruiterVerdict,
    booleanSearchString,
    coldOutreachScript,
    unquantifiedBulletsCount: unquantifiedCount,
    totalBulletsCount: totalBullets,
    missingSkillsPriority: finalMissingList.slice(0, 5),
    sevenDayQuickPlan,
    milestonePathway,
  }
}

/**
 * Dedicated Dynamic Action Plan Agent
 * Calls llmGateway.generate in parallel with report synthesis to return an exact,
 * AI-generated 7-Day Quick Plan, 30/60/90 Day Milestone Pathway, and Recruiter Verdict
 * tailored to candidate bottlenecks.
 */
export async function generateDynamicActionPlan({
  targetRole = 'Software Engineer',
  answers = {},
  resumeJson = {},
  verifiedSkills = [],
  missingSkills = [],
  bulletAudit = [],
  signals = {},
  bottleneck = {},
  funnelStages = {},
  options = {},
} = {}) {
  const startTime = Date.now()
  const presentCompany = options.presentCompany || resumeJson?.experience?.[0]?.company || resumeJson?.experiences?.[0]?.company || 'Recent Role'
  const apps30d = Number(answers.applicationsLast30Days || Math.round((funnelStages.applications90d || 0) / 3) || 0)
  const screens = Number(funnelStages.recruiterScreens || funnelStages.screens || answers.recruiterScreens || 0)
  const missingSkillsList = (Array.isArray(missingSkills) && missingSkills.length > 0 ? missingSkills : (Array.isArray(options.missingSkills) ? options.missingSkills : []))
    .map((s) => (typeof s === 'string' ? s : s?.skill || s?.name || ''))
    .filter(Boolean)

  const fallback = buildDeterministicActionPlan({
    targetRole,
    verifiedSkills,
    missingSkills: missingSkillsList,
    bulletAudit,
    signals,
    bottleneck,
    funnelStages,
    answers,
    apps30d,
    screens,
    resumeJson,
    presentCompany,
  })

  const systemPrompt = `You are the Lead Career Strategist and Technical Recruiter at Career GPS.
Your task is to generate a highly actionable, candidate-specific 7-Day Rapid Triage Plan, a 30/60/90 Day Milestone Pathway, and an executive 6-Second Recruiter Verdict.
Zero generic advice, zero corporate fluff.
CANDIDATE-SPECIFIC REQUIREMENTS:
1. recruiterVerdict: Synthesize an executive 2-3 sentence recruiter diagnostic explaining why the candidate is getting screened out or stalled, directly addressing their funnel numbers and unquantified bullets.
2. booleanSearchString: Provide an exact LinkedIn boolean query targeting relevant hiring managers for ${targetRole} combined with candidate core skills.
3. coldOutreachScript: A ready-to-send 3-line outreach DM (under 45 words) tailored to candidate's targetRole, recent company, and top win.
4. sevenDayQuickPlan: 7 days of concrete tasks referencing actual missing skills, weakest company/project context, and exact drop-off gate.
5. milestonePathway: 30, 60, and 90-day connected milestones referencing real application volume and screen conversion math.
Respond in STRICT JSON format matching the schema provided.`

  const userPrompt = `CANDIDATE CONTEXT:
Target Role: ${targetRole}
Recent Company Context: ${presentCompany}
Identified Bottleneck: ${bottleneck.title || 'Screening & ATS Alignment'} (${bottleneck.diagnosis || 'Candidate applications experience drop-offs before recruiter phone screens.'})
Funnel Metrics:
- 30-Day Application Volume: ${apps30d}
- 90-Day Applications Submitted: ${funnelStages.applications90d || 0}
- Recruiter Screens: ${screens}
- Technical Rounds: ${funnelStages.technicalRounds || 0}
- Final Loops: ${funnelStages.finalRounds || 0}
- Written Offers: ${funnelStages.offers || 0}
Unquantified Resume Bullets: ${fallback.unquantifiedBulletsCount} of ${fallback.totalBulletsCount}
Contact Merge Anomaly: ${Boolean(signals?.contactMerge?.isContactMerged)}
Verified Technical Skills: ${verifiedSkills.slice(0, 12).join(', ') || 'Core technical stack'}
Key Missing/Gapped Skills: ${fallback.missingSkillsPriority.join(', ') || 'Priority stack tools'}

OUTPUT JSON SCHEMA:
{
  "recruiterVerdict": "2-3 crisp sentences diagnosing the candidate's exact screening bottleneck based on funnel numbers and unquantified bullets",
  "booleanSearchString": "LinkedIn boolean query targeting hiring managers (e.g. (\\"Engineering Manager\\" OR \\"Director of Engineering\\") AND (\\"Software Engineer\\") AND (\\"Python\\" OR \\"AWS\\"))",
  "coldOutreachScript": "Under 45-word 3-line DM referencing recent company and top achievement",
  "sevenDayQuickPlan": [
    {
      "day": 1,
      "title": "Short punchy day title (e.g. Target Keyword & Competency Audit)",
      "action": "Concrete 1-2 sentence actionable task for today",
      "deliverable": "Tangible artifact produced today",
      "metricTarget": "Measurable benchmark or quantifiable goal"
    },
    ... Day 2 through Day 7
  ],
  "milestonePathway": [
    {
      "period": "30 Days",
      "stage": "Stage Name",
      "goal": "Core 30-day objective",
      "actions": [
        "Concrete tactical action 1",
        "Concrete tactical action 2",
        "Concrete tactical action 3"
      ],
      "deliverable": "Tangible 30-day deliverable",
      "successSignal": "Measurable threshold signal",
      "active": true
    },
    {
      "period": "60 Days",
      "stage": "Stage Name",
      "goal": "Core 60-day objective",
      "actions": [
        "Concrete tactical action 1",
        "Concrete tactical action 2",
        "Concrete tactical action 3"
      ],
      "deliverable": "Tangible 60-day deliverable",
      "successSignal": "Measurable threshold signal",
      "active": false
    },
    {
      "period": "90 Days",
      "stage": "Stage Name",
      "goal": "Core 90-day objective",
      "actions": [
        "Concrete tactical action 1",
        "Concrete tactical action 2",
        "Concrete tactical action 3"
      ],
      "deliverable": "Tangible 90-day deliverable",
      "successSignal": "Measurable threshold signal",
      "isGoal": true,
      "active": false
    }
  ]
}`

  try {
    const response = await llmGateway.generate({
      purpose: 'dynamic_action_plan',
      task: 'action_plan_generation',
      preferredProvider: options.preferredProvider || 'openrouter',
      model: options.model || 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.2,
      maxTokens: 3000,
      timeoutMs: options.timeoutMs || 8000,
    })

    const rawText = response?.text || response?.content || '{}'
    const parsed = safeParseJson(rawText)

    if (
      parsed &&
      Array.isArray(parsed.sevenDayQuickPlan) &&
      parsed.sevenDayQuickPlan.length >= 5 &&
      Array.isArray(parsed.milestonePathway) &&
      parsed.milestonePathway.length >= 3
    ) {
      console.log(`[DynamicActionPlanAgent] ✔ Generated dynamic AI action plan in ${Date.now() - startTime}ms`)
      return {
        recruiterVerdict: parsed.recruiterVerdict || parsed.sixSecondRecruiterVerdict || fallback.recruiterVerdict,
        sixSecondRecruiterVerdict: parsed.sixSecondRecruiterVerdict || parsed.recruiterVerdict || fallback.sixSecondRecruiterVerdict,
        booleanSearchString: parsed.booleanSearchString || fallback.booleanSearchString,
        coldOutreachScript: parsed.coldOutreachScript || fallback.coldOutreachScript,
        unquantifiedBulletsCount: fallback.unquantifiedBulletsCount,
        totalBulletsCount: fallback.totalBulletsCount,
        missingSkillsPriority: fallback.missingSkillsPriority,
        sevenDayQuickPlan: parsed.sevenDayQuickPlan.slice(0, 7),
        milestonePathway: parsed.milestonePathway.slice(0, 3),
        isDynamic: true,
      }
    }
  } catch (err) {
    console.warn('[DynamicActionPlanAgent] LLM generation non-fatal fallback:', err.message)
  }

  return {
    ...fallback,
    isDynamic: false,
  }
}

export default {
  generateDynamicActionPlan,
  buildDeterministicActionPlan,
}
