import { Check, Trophy } from '@phosphor-icons/react'
import { classifyRoleArchetype } from '../../../backend/agents/core/roleArchetypeClassifier.js'

function extractTopSkills(reportData, fallback = 'Core Tech Stack') {
  const resumeAgent = reportData?.resume_agent
  const canonicalResume = resumeAgent?.canonicalResume
  const resumeJson = reportData?.resume_json

  const skillsSource =
    canonicalResume?.skills ||
    resumeJson?.skills ||
    resumeJson?.top_skills ||
    resumeAgent?.candidateSnapshot?.coreSkills ||
    []

  let skillsList = []

  if (Array.isArray(skillsSource)) {
    for (const item of skillsSource) {
      if (typeof item === 'string' && item.trim()) {
        skillsList.push(item.trim())
      } else if (item && typeof item === 'object') {
        if (typeof item.name === 'string') skillsList.push(item.name.trim())
        else if (typeof item.skill === 'string') skillsList.push(item.skill.trim())
        else if (Array.isArray(item.skills)) {
          skillsList.push(...item.skills.filter((s) => typeof s === 'string').map((s) => s.trim()))
        }
      }
    }
  } else if (typeof skillsSource === 'string') {
    skillsList = skillsSource.split(',').map((s) => s.trim()).filter(Boolean)
  }

  const unique = Array.from(new Set(skillsList.filter(Boolean))).slice(0, 3)
  if (unique.length > 0) {
    return unique.join(', ')
  }
  return fallback
}

function getFallbackSevenDayPlan(targetRole, topSkills, effectivePhaseId) {
  if (effectivePhaseId === 1) {
    return [
      {
        day: 1,
        title: 'Target Keyword & Competency Audit',
        action: `Audit current resume against top 10 target ${targetRole} job descriptions to isolate missing high-demand tools (${topSkills}).`,
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
        action: `Update headline with 3 exact industry keywords for ${targetRole} and weave ${topSkills} naturally into About and Skills sections.`,
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
  } else if (effectivePhaseId === 2) {
    return [
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
        action: `Prepare concrete explanations for data volume, query latency, or throughput metrics handled in primary projects using ${topSkills}.`,
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
    return [
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
        action: `Practice technical deep dives into ${topSkills}: latency optimization, caching strategies, and concurrency patterns.`,
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
}

export default function RoadmapTimeline({ roadmapData, currentPhaseId = 2, onNavigateSection: _onNavigateSection, reportData }) {
  const effectivePhaseId = Number(reportData?.phase?.id || reportData?.career_journey?.current_phase_id || currentPhaseId || 1)
  const targetRole =
    reportData?.resume_agent?.candidateSnapshot?.targetRole ||
    reportData?.resume_json?.target_role ||
    reportData?.user_answers?.targetRole ||
    'Software Engineer'
  const visa = reportData?.user_answers?.visa || reportData?.user_answers?.visaStatus || ''
  const isSponsorshipRequired = Boolean(visa && /opt|cpt|h-?1b|sponsor/i.test(visa))
  const archetype = classifyRoleArchetype(targetRole)
  const isDataRole = archetype.key === 'DATA_ANALYTICS'
  const topSkills = extractTopSkills(reportData, archetype.mandatoryTools.slice(0, 3).join(', '))

  // -------------------------------------------------------------
  // Dynamic 7-Day Quick Plan
  // -------------------------------------------------------------
  const sevenDayPlan =
    (Array.isArray(reportData?.sevenDayQuickPlan) && reportData.sevenDayQuickPlan.length > 0)
      ? reportData.sevenDayQuickPlan
      : (Array.isArray(reportData?.action_plan?.sevenDayQuickPlan) && reportData.action_plan.sevenDayQuickPlan.length > 0)
      ? reportData.action_plan.sevenDayQuickPlan
      : getFallbackSevenDayPlan(targetRole, topSkills, effectivePhaseId)

  // -------------------------------------------------------------
  // Dynamic 30-60-90 Day Milestone Pathway
  // -------------------------------------------------------------
  let phase30, phase60, phase90

  if (effectivePhaseId === 1) {
    phase30 = {
      period: '30 Days',
      stage: 'Asset Calibration & Outbound Sourcing Engine',
      goal: 'Overcome ATS keyword drop-offs and generate consistent top-of-funnel interview volume.',
      actions: [
        isDataRole
          ? 'Rewrite experience achievements in Google XYZ format highlighting SQL, Snowflake/BigQuery, Power BI/Tableau, and automated ETL outcomes.'
          : `Calibrate resume in single-column format using Google XYZ metrics with verified ${topSkills} keyword density.`,
        'Deploy LinkedIn Sales Navigator & Apollo to build an account list of 30 target US companies actively hiring.',
        isSponsorshipRequired
          ? 'Filter target employer lists via USCIS H-1B Employer Hub and E-Verify databases before submitting.'
          : 'Execute 15 targeted applications weekly directly through company ATS career portals rather than Easy Apply boards.',
      ],
      deliverable: 'ATS-Calibrated Resume + 30 Target Account Outbound Tracker',
      successSignal: 'Screening callback rate >= 10% with 2-4 recruiter screens booked weekly.',
      active: true,
    }

    phase60 = {
      period: '60 Days',
      stage: 'Recruiter Pipeline Velocity & Multi-Threading',
      goal: 'Convert top-of-funnel inbound interest into active technical interviews across multiple companies.',
      actions: [
        'Engage 10 engineering managers and internal recruiters weekly using personalized 50-word LinkedIn InMails.',
        isDataRole
          ? 'Conduct 5 live analytical case studies covering dimensional modeling, star schemas, DAX, and SQL window functions.'
          : `Complete 15 timed practical problem sets: ${archetype.dayAssessmentPrep}.`,
        'Conduct 2 weekly informational interviews with alumni and senior engineers at target tech companies.',
      ],
      deliverable: 'Multi-Threaded Active Pipeline of 4+ Concurrent Interview Loops',
      successSignal: 'Consistent conversion of >= 60% from recruiter screen to live technical round.',
      active: false,
    }

    phase90 = {
      period: '90 Days',
      stage: 'Final Rounds, Offer Leverage & Closing',
      goal: 'Advance through onsite interview loops and secure a competitive, written job offer.',
      actions: [
        isDataRole
          ? 'Complete 10 business problem-solving case studies and portfolio walkthroughs in SQL, Python, and Tableau/Power BI.'
          : 'Execute comprehensive system architecture and behavioral STAR interviews with hiring managers and directors.',
        `Benchmark total compensation bands (Base, Bonus, Equity) on Levels.fyi and Blind for ${targetRole}.`,
        'Negotiate starting terms using competing interview timeline leverage and structured counter-offer scripts.',
      ],
      deliverable: 'Minimum 1 Formal Written Offer with Verified Compensation Package',
      successSignal: 'Signed target offer matching market compensation baseline.',
      isGoal: true,
      active: false,
    }
  } else if (effectivePhaseId === 2) {
    phase30 = {
      period: '30 Days',
      stage: 'Recruiter Screen Mastery & Assessment Clearance',
      goal: 'Elevate recruiter screen pass rate from <30% to >75% and clear automated technical assessments.',
      actions: [
        isDataRole
          ? 'Rewrite experience achievements in Google XYZ format highlighting SQL, Snowflake/BigQuery, Power BI/Tableau, and automated ETL outcomes.'
          : `Script and rehearse a 60-second verbal elevator pitch highlighting verified ${topSkills} and architecture scale.`,
        isDataRole
          ? 'Drill 10 timed SQL and data analysis assessments covering window functions and aggregate metrics.'
          : `Drill 10 timed ${archetype.label} domain assessments: ${archetype.dayAssessmentPrep}.`,
        `Align compensation expectations upfront using Levels.fyi data for ${targetRole} to prevent screening mismatch.`,
      ],
      deliverable: 'Recorded Elevator Pitch + Recruiter Screening Rubric Answer Sheet',
      successSignal: '>= 75% of recruiter phone screens advance to live technical interview rounds.',
      active: true,
    }

    phase60 = {
      period: '60 Days',
      stage: isDataRole ? 'Live Analytical Case Studies & Dimensional Defense' : 'Live Technical Problem Solving & Architecture Defense',
      goal: isDataRole ? 'Consistently clear analytical screens and SQL/BI technical deep dives.' : 'Consistently clear live coding rounds and technical deep dives.',
      actions: [
        isDataRole
          ? 'Conduct 5 live analytical case studies covering dimensional modeling, star schemas, DAX, and SQL window functions.'
          : `Conduct 5 mock interviews focusing on verbalizing reasoning out loud: ${archetype.interviewMechanism}.`,
        isDataRole
          ? 'Prepare a 1-page data model diagram for your primary project detailing star schemas, grain, and ETL pipeline cadence.'
          : 'Prepare a 1-page architecture diagram for your primary project detailing database trade-offs and caching.',
        'Rehearse project ownership responses to clearly delineate individual contributions from team scope.',
      ],
      deliverable: isDataRole ? '1-Page Project Dimensional Model Blueprint + 5 Validated STAR Analytical Stories' : '1-Page Project System Architecture Blueprint + 5 Validated STAR Technical Stories',
      successSignal: 'Advance to final/onsite stage in >= 50% of technical interview loops.',
      active: false,
    }

    phase90 = {
      period: '90 Days',
      stage: 'Final Round Onsites & Offer Negotiation',
      goal: 'Convert final-round loops into competitive written offers with full compensation leverage.',
      actions: [
        isDataRole
          ? 'Complete 10 business problem-solving case studies and portfolio walkthroughs in SQL, Python, and Tableau/Power BI.'
          : 'Present technical case studies and executive vision to Director/VP stakeholders.',
        'Benchmark total compensation packages on Levels.fyi and prepare multi-offer leverage tactics.',
        'Execute structured negotiation scripts to maximize starting base salary and equity grant.',
      ],
      deliverable: 'Minimum 1 Signed Offer with Competitive Total Compensation',
      successSignal: 'Signed written offer letter within target leveling band.',
      isGoal: true,
      active: false,
    }
  } else {
    phase30 = {
      period: '30 Days',
      stage: isDataRole ? 'Live Analytical Problem Solving & SQL Defense' : 'Live Technical Problem Solving & System Architecture',
      goal: isDataRole ? 'Overcome analytical round drop-offs by mastering live SQL verbalization and data grain trade-offs.' : 'Overcome technical drop-offs by mastering live coding verbalization and system trade-offs.',
      actions: [
        isDataRole
          ? 'Conduct 4 mock interviews on StrataScratch/Pramp verbalizing query optimization, partitioning, and indexing trade-offs.'
          : `Conduct 4 mock interviews verbalizing trade-offs and reasoning out loud: ${archetype.interviewMechanism}.`,
        isDataRole
          ? `Draft data architecture one-pagers showing warehouse modeling, ETL pipelines, and BI reporting grain using ${topSkills}.`
          : `Draft system architecture one-pagers showing latency, caching, and database trade-offs using ${topSkills}.`,
        'Prepare 5 behavioral STAR stories focusing on system outages, complex bugs, and engineering trade-offs.',
      ],
      deliverable: isDataRole ? 'Data Architecture One-Pager + Live SQL Problem-Solving Rubric' : 'System Architecture One-Pager + Live Coding Communication Rubric',
      successSignal: 'Technical round pass rate >= 65% advancing into final round onsites.',
      active: true,
    }

    phase60 = {
      period: '60 Days',
      stage: 'Final Round Onsite Mastery & Stakeholder Alignment',
      goal: 'Deliver high-impact final rounds with engineering directors and cross-functional partners.',
      actions: [
        'Rehearse system design discussions for distributed systems (scaling, rate limiting, and failure modes).',
        'Prepare 5 strategic questions for engineering executives regarding technical debt and product roadmap.',
        'Expand parallel outbound pipelines via Apollo and LinkedIn Sales Navigator to ensure multi-offer closing leverage.',
      ],
      deliverable: 'Executive Q&A Matrix + Active Multi-Threaded Onsite Pipeline',
      successSignal: 'Multiple final round onsites completed across concurrent companies.',
      active: false,
    }

    phase90 = {
      period: '90 Days',
      stage: 'Offer Closing, Total Comp Benchmarking & Sign-Off',
      goal: 'Secure top-of-market compensation and finalize employment verification.',
      actions: [
        'Benchmark competing offers on Levels.fyi and Blind to establish counter-offer leverage.',
        'Negotiate base salary, sign-on bonus, and equity vesting schedule using proven recruiter scripts.',
        'Finalize background check verification, reference checks, and Day 1 onboarding clearance.',
      ],
      deliverable: 'Formal Written Job Offer with Maximized Total Compensation Package',
      successSignal: 'Accepted offer letter meeting or exceeding target compensation benchmark.',
      isGoal: true,
      active: false,
    }
  }

  const defaultPhases = [phase30, phase60, phase90]
  const aiMilestones =
    (Array.isArray(reportData?.milestonePathway) && reportData.milestonePathway.length >= 3)
      ? reportData.milestonePathway
      : (Array.isArray(reportData?.action_plan?.milestonePathway) && reportData.action_plan.milestonePathway.length >= 3)
      ? reportData.action_plan.milestonePathway
      : (Array.isArray(roadmapData) && roadmapData.length >= 3)
      ? roadmapData
      : defaultPhases

  return (
    <section id="roadmap" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-medium text-indigo-600 block">
            Action roadmap &amp; milestones
          </span>
          <h2
            className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            7-Day Quick Plan &amp; 30 / 60 / 90 Day Milestone Pathway
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Targeted execution calibrated to {targetRole} hiring expectations
        </p>
      </div>

      {/* ── 1. 7-Day Rapid Triage Plan ── */}
      <div className="p-5 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              7-Day Rapid Triage Plan
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Tactical daily sprints to immediately unblock pipeline friction and clear automated screening gates
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 shrink-0 self-start sm:self-auto">
            Sprint Phase: Days 1–7
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {sevenDayPlan.map((item, idx) => (
            <div
              key={item.day || idx + 1}
              className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/90 flex flex-col justify-between space-y-2.5 hover:border-slate-300 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100/70 text-indigo-800 border border-indigo-200">
                    DAY 0{item.day || idx + 1}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                  {item.action}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[10px] font-mono">
                {item.deliverable && (
                  <div>
                    <span className="text-slate-400 block font-sans text-[9px]">Deliverable:</span>
                    <span className="text-slate-700 font-medium block leading-tight">{item.deliverable}</span>
                  </div>
                )}
                {item.metricTarget && (
                  <div className="pt-1">
                    <span className="text-slate-400 block font-sans text-[9px]">Target:</span>
                    <span className="text-emerald-600 font-semibold block leading-tight tabular-nums">{item.metricTarget}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. 30 / 60 / 90 Day Direction Cards Grid ── */}
      <div className="p-5 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            30 / 60 / 90 Day Milestone Pathway
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Progressive compounding milestones calibrated to {targetRole} hiring expectations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {aiMilestones.map((p, idx) => (
            <div
              key={p.period || idx}
              className={`p-5 sm:p-6 rounded-xl border flex flex-col justify-between space-y-5 transition-colors ${
                p.isGoal
                  ? 'bg-amber-500/5 border-amber-500/30 shadow-xs'
                  : p.active
                  ? 'bg-emerald-500/5 border-emerald-500/30 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <div className="space-y-4">
                {/* Milestone Period Badge + Phase Index */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono px-2.5 py-1 rounded-md font-medium ${
                      p.isGoal
                        ? 'bg-amber-400 text-black'
                        : p.active
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {p.period}
                  </span>

                  {p.isGoal ? (
                    <Trophy size={18} weight="fill" className="text-amber-500" />
                  ) : (
                    <span className="text-xs font-mono font-semibold text-slate-400 tabular-nums">
                      0{idx + 1}
                    </span>
                  )}
                </div>

                {/* Stage Title & Goal */}
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-slate-900 tracking-tight">
                    {p.stage}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {p.goal}
                  </p>
                </div>

                {/* Actions */}
                <ul className="space-y-2 list-none pl-0 text-xs font-medium text-slate-800">
                  {(p.actions || []).map((act, aIdx) => (
                    <li key={aIdx} className="flex items-start gap-2 leading-relaxed">
                      <Check
                        size={14}
                        weight="bold"
                        className={`shrink-0 mt-0.5 ${
                          p.active || p.isGoal ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Deliverable Callout */}
              {p.deliverable && (
                <div className="pt-3 border-t border-slate-200 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 font-medium block">
                    Key deliverable
                  </span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {p.deliverable}
                  </p>
                </div>
              )}

              {/* Success Signal Callout */}
              {p.successSignal && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <span className="text-[10px] font-mono text-emerald-600 font-medium block">
                    Success signal
                  </span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {p.successSignal}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
