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
  bottleneck = {},
  funnelStages = {},
  answers = {},
} = {}) {
  const archetype = classifyRoleArchetype(targetRole)
  const skillsStr = verifiedSkills.slice(0, 4).join(', ') || archetype.mandatoryTools.slice(0, 3).join(', ') || 'core domain tools'
  const apps90d = Number(funnelStages.applications90d || 0)
  const screens = Number(funnelStages.recruiterScreens || funnelStages.screens || 0)
  const techs = Number(funnelStages.technicalRounds || 0)

  const isAtsFriction = apps90d > 40 && screens < 3
  const isScreenFriction = screens >= 3 && techs <= 1
  const isTechFriction = techs >= 1

  let sevenDayQuickPlan = []

  if (isAtsFriction || (!isScreenFriction && !isTechFriction)) {
    sevenDayQuickPlan = [
      {
        day: 1,
        title: 'Target Keyword & Competency Audit',
        action: `Audit current resume against top 10 target ${targetRole} job descriptions to isolate missing high-demand tools (${skillsStr}).`,
        deliverable: '10-JD Keyword Frequency Matrix with priority missing tools highlighted.',
        metricTarget: 'Identify 5-8 high-yield technical keywords to weave into experience.',
      },
      {
        day: 2,
        title: 'Google XYZ Bullet Restructuring',
        action: 'Rewrite top 4 work experience bullets into Accomplished [X] as measured by [Y] by doing [Z] syntax with hard production numbers.',
        deliverable: '4 restructured high-impact bullets with verified production metrics.',
        metricTarget: '100% of rewritten bullets contain quantified scope ($ or %).',
      },
      {
        day: 3,
        title: 'Single-Column ATS Layout Calibration',
        action: 'Export resume into clean single-column format with zero multi-column tables, text boxes, or graphical headers.',
        deliverable: 'Plain-text parseable ATS-compliant resume document.',
        metricTarget: 'Zero ATS parsing truncation errors.',
      },
      {
        day: 4,
        title: 'LinkedIn Recruiter SEO Alignment',
        action: `Update headline with 3 exact industry keywords for ${targetRole} and weave ${skillsStr} naturally into About and Skills sections.`,
        deliverable: 'Updated 15-20 word searchable headline + 50 prioritized skills.',
        metricTarget: 'LinkedIn Search Appearance score lift within 7 days.',
      },
      {
        day: 5,
        title: 'Outbound Sourcing Account List',
        action: 'Build a targeted list of 25 companies actively hiring in your domain using LinkedIn Search & Apollo.',
        deliverable: '25-Company Target Outreach Tracker with verified hiring manager names.',
        metricTarget: '25 direct engineering manager / lead recruiter profiles identified.',
      },
      {
        day: 6,
        title: 'Tailored Portal Application Sprint',
        action: 'Submit 10 customized applications directly via company ATS portals with tailored cover notes instead of Easy Apply blasts.',
        deliverable: '10 documented applications logged with timestamped URLs.',
        metricTarget: '10 high-intent applications submitted directly to ATS.',
      },
      {
        day: 7,
        title: 'Weekly Funnel Calibration & Review',
        action: 'Analyze Week 1 response rates, log profile views, and prepare follow-up touches for submitted applications.',
        deliverable: 'Weekly conversion report & 7-day outbound follow-up calendar.',
        metricTarget: 'Screen callback rate target >= 5.0%.',
      },
    ]
  } else if (isScreenFriction) {
    sevenDayQuickPlan = [
      {
        day: 1,
        title: '60-Second Verbal Elevator Pitch',
        action: `Script and rehearse a crisp 60-second verbal pitch highlighting your target positioning in ${targetRole} and architectural scale.`,
        deliverable: 'Recorded audio/video rehearsal of 60-second elevator story.',
        metricTarget: 'Under 75 words, 0 filler phrases, clearly states target level.',
      },
      {
        day: 2,
        title: 'Compensation & Leveling Alignment Sheet',
        action: `Benchmark total compensation bands (base, bonus, equity) on Levels.fyi for ${targetRole} to prevent screening disqualification.`,
        deliverable: '1-page market compensation cheat sheet with scripted salary response.',
        metricTarget: 'Definitive scripted answer ready for "What are your salary expectations?".',
      },
      {
        day: 3,
        title: 'Top 5 Behavioral STAR Stories',
        action: 'Draft 5 structured STAR (Situation, Task, Action, Result) stories focusing on cross-functional alignment and system trade-offs.',
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
        title: 'Technical Scope & Scale Deep Dive',
        action: `Prepare concrete explanations for data volume, query latency, or throughput metrics handled in primary projects using ${skillsStr}.`,
        deliverable: 'System Scale & Complexity Reference Sheet.',
        metricTarget: 'Clear mastery of exact numbers, request rates, and SLA figures.',
      },
      {
        day: 6,
        title: 'Active Pipeline Multi-Threading',
        action: 'Directly message 8 engineering leads at companies where you have open applications with a 50-word note on recent technical work.',
        deliverable: '8 personalized outreach messages sent to hiring managers.',
        metricTarget: 'At least 1-2 direct hiring manager response touchpoints.',
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
    sevenDayQuickPlan = [
      {
        day: 1,
        title: 'Core Technical Assessment Drill',
        action: `Complete 3 timed problem-solving sets covering core algorithms, system design, or data modeling relevant to ${targetRole}.`,
        deliverable: 'Documented code solutions with time/space complexity analysis.',
        metricTarget: 'Complete each problem within 35 minutes with clean tests.',
      },
      {
        day: 2,
        title: 'Primary Project Architecture Blueprint',
        action: 'Draft a 1-page system architecture diagram for your flagship project outlining components, API contracts, and trade-offs.',
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
        title: 'Failure Mode & Edge Case Defense',
        action: 'Document 3 critical production failure scenarios and debugging post-mortems you owned, articulating root causes.',
        deliverable: '3 Production Debugging / Incident Post-Mortem Cards.',
        metricTarget: 'Clear mastery of observability, metrics, and recovery steps.',
      },
      {
        day: 5,
        title: 'Domain Deep-Dive Drill',
        action: `Practice technical deep dives into ${skillsStr}: latency optimization, caching strategies, and concurrency patterns.`,
        deliverable: 'Technical Deep-Dive Notes on 5 core architectural trade-offs.',
        metricTarget: 'Articulate at least 2 trade-offs for every architectural choice.',
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
      goal: `Overcome ATS keyword drop-offs and generate consistent recruiter screen velocity for ${targetRole}.`,
      actions: [
        `Calibrate resume in single-column format using Google XYZ metrics with verified ${skillsStr} keyword density.`,
        'Deploy LinkedIn Sales Navigator & Apollo to build an account list of 30 target US companies actively hiring.',
        'Execute 15 targeted applications weekly directly through company ATS career portals rather than Easy Apply boards.',
      ],
      deliverable: 'ATS-Calibrated Resume + 30 Target Account Outbound Tracker',
      successSignal: 'Screening callback rate >= 10% with 2-4 recruiter screens booked weekly.',
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
  bottleneck = {},
  funnelStages = {},
  options = {},
} = {}) {
  const startTime = Date.now()
  const fallback = buildDeterministicActionPlan({
    targetRole,
    verifiedSkills,
    bottleneck,
    funnelStages,
    answers,
  })

  const systemPrompt = `You are the Lead Career Strategist and Technical Recruiter at Career GPS.
Your task is to generate a highly actionable, candidate-specific 7-Day Rapid Triage Plan and a 30/60/90 Day Milestone Pathway.
Zero generic advice, zero corporate fluff.
Every daily item in the 7-day plan must have a distinct concrete action, an exact tangible deliverable, and a measurable metric target.
Every milestone in the 30/60/90 day pathway must address the candidate's biggest funnel leaks and skill evidence gaps.
Respond in STRICT JSON format matching the schema provided.`

  const userPrompt = `CANDIDATE CONTEXT:
Target Role: ${targetRole}
Identified Bottleneck: ${bottleneck.title || 'Screening & ATS Alignment'} (${bottleneck.diagnosis || 'Candidate applications experience drop-offs before recruiter phone screens.'})
Funnel Metrics (90-Day):
- Applications Submitted: ${funnelStages.applications90d || 0}
- Recruiter Screens: ${funnelStages.recruiterScreens || 0}
- Technical Rounds: ${funnelStages.technicalRounds || 0}
- Final Loops: ${funnelStages.finalRounds || 0}
- Written Offers: ${funnelStages.offers || 0}
Verified Technical Skills: ${verifiedSkills.slice(0, 12).join(', ') || 'Core technical stack'}

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
      maxTokens: 2500,
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
