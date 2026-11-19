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

/**
 * Builds deterministic fallback 7-day quick plan and 30/60/90 day milestone pathway.
 * Tailored dynamically to the candidate's targetRole, skills, and funnel friction.
 */
export function buildDeterministicActionPlan({
  targetRole = 'Software Engineer',
  verifiedSkills = [],
  missingSkills = [],
  bottleneck = {},
  funnelStages = {},
  answers = {},
  apps30d = 0,
  screens = 0,
  resumeJson = {},
  presentCompany = '',
} = {}) {
  const archetype = classifyRoleArchetype(targetRole)
  const skillsStr = verifiedSkills.slice(0, 4).join(', ') || archetype.mandatoryTools.slice(0, 3).join(', ') || 'core domain tools'

  // Extract Candidate-Specific Context
  const missingSkillsList = Array.isArray(missingSkills) && missingSkills.length > 0
    ? missingSkills.map((s) => (typeof s === 'string' ? s : s?.skill || s?.name || '')).filter(Boolean)
    : (Array.isArray(resumeJson?.missing_skills) ? resumeJson.missing_skills : ['Docker', 'AWS', 'PostgreSQL'])
  const missingSkillsStr = missingSkillsList.slice(0, 3).join(', ') || 'priority stack tools'

  const expList = Array.isArray(resumeJson?.experience)
    ? resumeJson.experience
    : (Array.isArray(resumeJson?.experiences) ? resumeJson.experiences : [])
  const latestRole = expList[0] || {}
  const rawCompany = presentCompany || latestRole.company || latestRole.employer || latestRole.companyName || 'your most recent role'
  const cleanCompany = String(rawCompany).split('|')[0].trim()

  // Extract Top Verified Win from Resume Bullets
  let topVerifiedWin = ''
  for (const e of expList) {
    const bullets = Array.isArray(e.bullets) ? e.bullets : (Array.isArray(e.bulletPoints) ? e.bulletPoints : [])
    for (const b of bullets) {
      const text = typeof b === 'string' ? b : b?.text || ''
      if (/\d+%?|\$\d+/i.test(text) && text.length > 20) {
        topVerifiedWin = text.replace(/^[•\-*▪–—·\s]+/, '').trim()
        break
      }
    }
    if (topVerifiedWin) break
  }
  if (!topVerifiedWin && expList[0]?.bullets?.[0]) {
    const b0 = expList[0].bullets[0]
    topVerifiedWin = (typeof b0 === 'string' ? b0 : b0?.text || '').replace(/^[•\-*▪–—·\s]+/, '').trim()
  }
  if (!topVerifiedWin) {
    topVerifiedWin = `architected core services for ${targetRole} driving 25%+ latency and throughput gains`
  }
  const winSummary = topVerifiedWin.length > 70 ? topVerifiedWin.slice(0, 70).replace(/\s+\S*$/, '') + '...' : topVerifiedWin

  // Real 30-Day Math
  const effectiveApps = Number(apps30d || answers.applicationsLast30Days || funnelStages.applications30d || Math.round(Number(funnelStages.applications90d || 45) / 3) || 15)
  const effectiveScreens = Number(screens || funnelStages.recruiterScreens || funnelStages.screens || answers.recruiterScreens || 0)
  const conversionRate = effectiveApps > 0 ? ((effectiveScreens / effectiveApps) * 100).toFixed(1) : '0.0'
  const dropOffGate = funnelStages.biggest_leak_stage || funnelStages.leak_title || bottleneck.title || 'Screening Callback Gate'

  // Ready-to-send 40-word Recruiter Outreach DM
  const outreachDm = `Hi [Name], saw you're leading engineering at [Company]. As a ${targetRole}, I recently ${winSummary.replace(/\.$/, '')}. Given your team's focus on scale, would love to connect and share notes.`

  const apps90d = Number(funnelStages.applications90d || 0)
  const techs = Number(funnelStages.technicalRounds || 0)

  const isAtsFriction = apps90d > 40 && effectiveScreens < 3
  const isScreenFriction = effectiveScreens >= 3 && techs <= 1
  const isTechFriction = techs >= 1

  let sevenDayQuickPlan = []

  if (isAtsFriction || (!isScreenFriction && !isTechFriction)) {
    sevenDayQuickPlan = [
      {
        day: 1,
        title: 'Missing Skill Integration & ATS Audit',
        action: `Cross-reference your resume against target ${targetRole} job descriptions to integrate verified evidence for your missing skills: ${missingSkillsStr}.`,
        deliverable: `Keyword Alignment Ledger mapping ${missingSkillsStr} into active role bullets.`,
        metricTarget: 'Zero unverified core skills across top 3 target job descriptions.',
      },
      {
        day: 2,
        title: `Google XYZ Overhaul for ${cleanCompany}`,
        action: `Restructure 4 achievement bullets at ${cleanCompany} into Accomplished [X] measured by [Y] by doing [Z] syntax with hard operational numbers.`,
        deliverable: `4 restructured bullets for ${cleanCompany} containing verified metrics ($ or %).`,
        metricTarget: `100% of ${cleanCompany} bullets contain verified quantitative outcomes.`,
      },
      {
        day: 3,
        title: `Layout & ATS Calibration for ${dropOffGate}`,
        action: `Export resume into clean single-column format with zero multi-column tables, eliminating parser drop-offs at the ${dropOffGate}.`,
        deliverable: 'Plain-text parseable ATS-compliant resume document.',
        metricTarget: 'Zero ATS parsing truncation errors across automated scanners.',
      },
      {
        day: 4,
        title: 'LinkedIn Recruiter SEO Alignment',
        action: `Update headline with 3 exact industry keywords for ${targetRole} and weave ${missingSkillsStr} naturally into About and Skills sections.`,
        deliverable: 'Updated 15-20 word searchable headline + 50 prioritized skills.',
        metricTarget: 'LinkedIn Search Appearance score lift within 7 days.',
      },
      {
        day: 5,
        title: 'Direct Hiring Manager Outreach Sprint',
        action: `Identify 10 engineering leaders actively hiring for ${targetRole} and send this ready-to-send 40-word DM: "${outreachDm}"`,
        deliverable: '10 personalized hiring manager DMs sent using the custom 40-word template.',
        metricTarget: 'At least 2 warm recruiter/hiring manager conversation replies.',
      },
      {
        day: 6,
        title: 'Flagship Architecture Blueprint & Defense Sheet',
        action: `Draft a 1-page architecture blueprint for your core technical work (${winSummary}), articulating failure modes and tradeoffs.`,
        deliverable: '1-page system architecture defense diagram with data flow and latency tradeoffs.',
        metricTarget: 'Verbalize trade-offs and latency recovery in under 3 minutes.',
      },
      {
        day: 7,
        title: `Funnel Calibration at ${dropOffGate}`,
        action: `Review response rates for submitted applications, audit profile views, and calibrate conversion targets at the ${dropOffGate}.`,
        deliverable: 'Weekly conversion report & 7-day outbound follow-up schedule.',
        metricTarget: 'Screen callback rate target >= 5.0%.',
      },
    ]
  } else if (isScreenFriction) {
    sevenDayQuickPlan = [
      {
        day: 1,
        title: '60-Second Verbal Elevator Pitch',
        action: `Script and rehearse a crisp 60-second verbal pitch highlighting your target positioning in ${targetRole} and proven win: ${winSummary}.`,
        deliverable: 'Recorded audio/video rehearsal of 60-second elevator story.',
        metricTarget: 'Under 75 words, 0 filler phrases, clearly states target level.',
      },
      {
        day: 2,
        title: 'Compensation & Leveling Alignment Sheet',
        action: `Benchmark total compensation bands on Levels.fyi for ${targetRole} to prevent screening disqualification.`,
        deliverable: '1-page market compensation cheat sheet with scripted salary response.',
        metricTarget: 'Definitive scripted answer ready for "What are your salary expectations?".',
      },
      {
        day: 3,
        title: `Top 5 STAR Stories from ${cleanCompany}`,
        action: `Draft 5 structured STAR stories based on ${cleanCompany} work, focusing on cross-functional alignment and technical trade-offs.`,
        deliverable: '5 STAR story cards with quantified business impact.',
        metricTarget: 'Every story articulates trade-off reasoning and measurable ROI.',
      },
      {
        day: 4,
        title: 'Recruiter Screening Mock Rehearsal',
        action: 'Execute a timed 15-minute mock recruiter phone screen focusing on conversational cadence and confident delivery.',
        deliverable: 'Self-evaluation score sheet against standard recruiter scorecard.',
        metricTarget: 'Pass >= 80% on standard recruiter qualification rubric.',
      },
      {
        day: 5,
        title: 'Direct Hiring Manager Outreach Sprint',
        action: `Directly message 8 engineering leads at target companies using this ready-to-send 40-word DM: "${outreachDm}"`,
        deliverable: '8 personalized outreach messages sent to hiring managers.',
        metricTarget: 'At least 1-2 direct hiring manager response touchpoints.',
      },
      {
        day: 6,
        title: 'Technical Scope & Scale Deep Dive',
        action: `Prepare concrete explanations for data volume, query latency, or throughput metrics handled in ${cleanCompany} work (${winSummary}).`,
        deliverable: 'System Scale & Complexity Reference Sheet.',
        metricTarget: 'Clear mastery of exact numbers, request rates, and SLA figures.',
      },
      {
        day: 7,
        title: 'Conversion Audit & Week 2 Strategy',
        action: 'Evaluate screen-to-technical conversion velocity and calibrate answers for upcoming phone screens.',
        deliverable: 'Updated screening answer ledger & interview schedule.',
        metricTarget: 'Screen-to-technical round conversion target >= 60%.',
      },
    ]
  } else {
    // Technical round focus
    sevenDayQuickPlan = [
      {
        day: 1,
        title: 'Core Technical Assessment Drill',
        action: `Complete 3 timed problem-solving sets covering algorithms and system design relevant to ${targetRole}.`,
        deliverable: 'Documented code solutions with time/space complexity analysis.',
        metricTarget: 'Complete each problem within 35 minutes with clean tests.',
      },
      {
        day: 2,
        title: 'Flagship Architecture Blueprint',
        action: `Draft a 1-page system architecture diagram for your flagship project (${winSummary}) outlining components, API contracts, and trade-offs.`,
        deliverable: '1-Page System Architecture Diagram (draw.io or Excalidraw).',
        metricTarget: 'Ready to present visually in under 3 minutes.',
      },
      {
        day: 3,
        title: 'Live Technical Verbalization Rehearsal',
        action: 'Conduct a recorded mock technical interview speaking your reasoning and trade-offs out loud before typing any code.',
        deliverable: 'Recorded 45-minute technical mock session with self-critique notes.',
        metricTarget: 'Zero long silent pauses (>15s) during live problem solving.',
      },
      {
        day: 4,
        title: `Failure Mode & Edge Case Defense for ${cleanCompany}`,
        action: `Document 3 critical production failure scenarios and debugging post-mortems from ${cleanCompany}, articulating root causes.`,
        deliverable: '3 Production Debugging / Incident Post-Mortem Cards.',
        metricTarget: 'Clear mastery of observability, metrics, and recovery steps.',
      },
      {
        day: 5,
        title: 'Direct Hiring Manager Outreach Sprint',
        action: `Send this 40-word outreach note to 8 engineering leaders: "${outreachDm}"`,
        deliverable: '8 personalized outreach messages sent to hiring managers.',
        metricTarget: 'At least 1-2 direct hiring manager response touchpoints.',
      },
      {
        day: 6,
        title: 'Peer / Senior Mock Interview',
        action: 'Schedule and execute a 60-minute mock technical screen with a senior engineer or mentor focusing on panel questions.',
        deliverable: 'Objective feedback rubric with targeted remediation items.',
        metricTarget: 'Panel pass score >= 75%.',
      },
      {
        day: 7,
        title: 'Panel Readiness Calibration',
        action: 'Synthesize all technical mock feedback into a final pre-interview checklist for upcoming loops.',
        deliverable: 'Pre-Interview Technical Readiness Checklist.',
        metricTarget: 'Technical round pass rate target >= 40%.',
      },
    ]
  }

  const milestonePathway = [
    {
      period: '30 Days',
      stage: 'Asset Calibration & Outbound Sourcing Engine',
      goal: `Transition from low-yield volume (${effectiveApps} monthly applications yielding ${effectiveScreens} screens at ${conversionRate}% callback) to targeted outreach, lifting conversion to >= 5.0% to reliably secure 3-5 recruiter screens monthly.`,
      actions: [
        `Deploy single-column Google XYZ resume embedding verified ${missingSkillsStr} to overcome ATS drop-offs at the ${dropOffGate}.`,
        `Deploy LinkedIn Sales Navigator to source 30 target companies actively hiring for ${targetRole}.`,
        `Submit 10 high-intent applications weekly directly via company ATS portals while multi-threading with the 40-word hiring manager outreach DM.`,
      ],
      deliverable: 'ATS-Calibrated Resume + 30 Target Account Outbound Tracker',
      successSignal: 'Screen callback rate >= 5.0% with 3-5 recruiter screens booked monthly.',
      active: true,
    },
    {
      period: '60 Days',
      stage: 'Recruiter Screen Mastery & Technical Loop Velocity',
      goal: 'Convert recruiter screens into live technical rounds and advance through panel assessments.',
      actions: [
        'Engage 10 engineering managers weekly using personalized 50-word LinkedIn InMails.',
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
        `Benchmark total compensation bands (Base, Bonus, Equity) on Levels.fyi and Blind for ${targetRole}.`,
        'Negotiate starting terms using competing interview timeline leverage and structured counter-offer scripts.',
      ],
      deliverable: 'Minimum 1 Formal Written Offer with Verified Compensation Package',
      successSignal: 'Signed target offer matching market compensation baseline.',
      isGoal: true,
      active: false,
    },
  ]

  return {
    sevenDayQuickPlan,
    milestonePathway,
  }
}

/**
 * Dedicated Dynamic Action Plan Agent
 * Calls llmGateway.generate in parallel with report synthesis to return an exact,
 * AI-generated 7-Day Quick Plan and 30/60/90 Day Milestone Pathway tailored to candidate bottlenecks.
 */
export async function generateDynamicActionPlan({
  targetRole = 'Software Engineer',
  answers = {},
  resumeJson = {},
  verifiedSkills = [],
  missingSkills = [],
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
    bottleneck,
    funnelStages,
    answers,
    apps30d,
    screens,
    resumeJson,
    presentCompany,
  })

  const systemPrompt = `You are the Lead Career Strategist and Technical Recruiter at Career GPS.
Your task is to generate a highly actionable, candidate-specific 7-Day Rapid Triage Plan and a 30/60/90 Day Milestone Pathway.
Zero generic advice, zero corporate fluff.
CANDIDATE-SPECIFIC REQUIREMENTS:
1. Every daily item in the 7-day plan must have a distinct concrete action referencing the candidate's actual missing skills, weakest company/project context, and exact funnel drop-off gate (NO generic "audit 10 JDs" filler).
2. On Day 5 (outreach sprint), provide a ready-to-send 40-word recruiter outreach DM template tailored to the candidate's targetRole, recent company, and top verified win.
3. The 30-Day Milestone must reference the candidate's real application volume and screen conversion math (e.g. shifting from low-yield volume to high-intent screening conversions).
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
Verified Technical Skills: ${verifiedSkills.slice(0, 12).join(', ') || 'Core technical stack'}
Key Missing/Gapped Skills: ${missingSkillsList.slice(0, 6).join(', ') || 'Priority stack tools'}

OUTPUT JSON SCHEMA:
{
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
      maxTokens: 2800,
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
