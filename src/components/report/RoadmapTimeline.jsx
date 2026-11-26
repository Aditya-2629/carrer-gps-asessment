import { useState } from 'react'
import { Check, Trophy } from '@phosphor-icons/react'
import { classifyRoleArchetype } from '../../../backend/agents/core/roleArchetypeClassifier.js'
import CrafturePoseMascot from '../common/CrafturePoseMascot'

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

const DEFAULT_DAY_TAGS = [
  'ATS Keywords',
  'XYZ Metrics',
  'Formatting',
  'LinkedIn SEO',
  'Outbound Sourcing',
  'Portal Sprint',
  'Funnel Calibration',
]

function getFallbackSevenDayPlan(targetRole, topSkills, effectivePhaseId, funnelRates = {}) {
  const currentCallback = Number(funnelRates.appToScreenRate) || 0
  const currentScreenToTech = Number(funnelRates.screenToTechRate) || 0
  const targetCallbackRate = Math.min(25, Math.max(5, Math.ceil(currentCallback * 1.35)))
  const targetScreenToTech = Math.min(85, Math.max(40, Math.ceil(currentScreenToTech * 1.25)))
  if (effectivePhaseId === 1) {
    return [
      {
        day: 1,
        title: 'Target Keyword & Competency Audit',
        tag: 'ATS Keywords',
        action: `Audit current resume against top 10 target ${targetRole} job descriptions to isolate missing high-demand tools (${topSkills}).`,
        deliverable: '10-JD Keyword Frequency Matrix with priority missing tools highlighted.',
        metricTarget: '5-8 high-yield keywords identified',
      },
      {
        day: 2,
        title: 'Google XYZ Bullet Restructuring',
        tag: 'XYZ Metrics',
        action: 'Rewrite top 4 work experience bullets into Accomplished [X] as measured by [Y] by doing [Z] syntax with hard production numbers.',
        deliverable: '4 restructured bullets with verified production metrics.',
        metricTarget: '100% rewritten bullets quantified ($ or %)',
      },
      {
        day: 3,
        title: 'Single-Column ATS Layout Calibration',
        tag: 'Formatting',
        action: 'Export resume into clean single-column format with zero multi-column tables, text boxes, or graphical headers.',
        deliverable: 'Plain-text parseable ATS-compliant resume document.',
        metricTarget: 'Zero ATS parsing errors',
      },
      {
        day: 4,
        title: 'LinkedIn Recruiter SEO Alignment',
        tag: 'LinkedIn SEO',
        action: `Update headline with 3 exact industry keywords for ${targetRole} and weave ${topSkills} naturally into About and Skills sections.`,
        deliverable: 'Updated 15-20 word searchable headline + 50 prioritized skills.',
        metricTarget: 'Search appearance lift within 7 days',
      },
      {
        day: 5,
        title: 'Outbound Sourcing Account List',
        tag: 'Outbound Sourcing',
        action: 'Build a targeted list of 25 companies actively hiring in your domain using LinkedIn Search & Apollo.',
        deliverable: '25-Company target outreach tracker with verified manager names.',
        metricTarget: '25 engineering leads identified',
      },
      {
        day: 6,
        title: 'Tailored Portal Application Sprint',
        tag: 'Portal Sprint',
        action: 'Submit 10 customized applications directly via company ATS portals with tailored cover notes instead of Easy Apply blasts.',
        deliverable: '10 documented applications logged with timestamped URLs.',
        metricTarget: '10 direct ATS submissions',
      },
      {
        day: 7,
        title: 'Weekly Funnel Calibration & Review',
        tag: 'Funnel Calibration',
        action: 'Analyze Week 1 response rates, log profile views, and prepare follow-up touches for submitted applications.',
        deliverable: 'Weekly conversion report & 7-day outbound follow-up calendar.',
        metricTarget: `Screen callback rate target >= ${targetCallbackRate}%`,
      },
    ]
  } else if (effectivePhaseId === 2) {
    return [
      {
        day: 1,
        title: '60-Second Verbal Elevator Pitch',
        tag: 'Elevator Pitch',
        action: `Script and rehearse a crisp 60-second verbal pitch highlighting your target positioning in ${targetRole} and architectural scale.`,
        deliverable: 'Recorded audio/video rehearsal of 60-second elevator story.',
        metricTarget: '<75 words, zero filler phrases',
      },
      {
        day: 2,
        title: 'Compensation & Leveling Alignment Sheet',
        tag: 'Comp Defense',
        action: `Benchmark total compensation bands (base, bonus, equity) on Levels.fyi for ${targetRole} to prevent screening disqualification.`,
        deliverable: '1-page market compensation cheat sheet with scripted salary response.',
        metricTarget: 'Scripted compensation guardrail',
      },
      {
        day: 3,
        title: 'Top 5 Behavioral STAR Stories',
        tag: 'Behavioral STAR',
        action: 'Draft 5 structured STAR (Situation, Task, Action, Result) stories focusing on cross-functional alignment and system trade-offs.',
        deliverable: '5 STAR story cards with quantified business impact.',
        metricTarget: '5 verified STAR story cards',
      },
      {
        day: 4,
        title: 'Recruiter Screening Mock Rehearsal',
        tag: 'Screening Mock',
        action: 'Execute a timed 15-minute mock recruiter phone screen focusing on conversational cadence and confident delivery.',
        deliverable: 'Self-evaluation score sheet against standard recruiter scorecard.',
        metricTarget: 'Pass >= 80% on rubric',
      },
      {
        day: 5,
        title: 'Technical Scope & Scale Deep Dive',
        tag: 'Scale Defense',
        action: `Prepare concrete explanations for data volume, query latency, or throughput metrics handled in primary projects using ${topSkills}.`,
        deliverable: 'System scale & complexity reference sheet.',
        metricTarget: 'Clear mastery of request rates & SLAs',
      },
      {
        day: 6,
        title: 'Active Pipeline Multi-Threading',
        tag: 'Multi-Threading',
        action: 'Directly message 8 engineering leads at companies where you have open applications with a 50-word note on recent technical work.',
        deliverable: '8 personalized outreach messages sent to hiring managers.',
        metricTarget: '1-2 direct hiring manager responses',
      },
      {
        day: 7,
        title: 'Conversion Audit & Week 2 Strategy',
        tag: 'Conversion Audit',
        action: 'Evaluate screen-to-technical conversion velocity and calibrate answers for upcoming phone screens.',
        deliverable: 'Updated screening answer ledger & interview schedule.',
        metricTarget: 'Screen-to-tech conversion >= 60%',
      },
    ]
  } else {
    return [
      {
        day: 1,
        title: 'Core Technical Assessment Drill',
        tag: 'Technical Drill',
        action: `Complete 3 timed problem-solving sets covering core algorithms, system design, or data modeling relevant to ${targetRole}.`,
        deliverable: 'Documented code solutions with time/space complexity analysis.',
        metricTarget: 'Complete within 35 min with clean tests',
      },
      {
        day: 2,
        title: 'Primary Project Architecture Blueprint',
        tag: 'Architecture Blueprint',
        action: 'Draft a 1-page system architecture diagram for your flagship project outlining components, API contracts, and trade-offs.',
        deliverable: '1-page system architecture diagram (draw.io or Excalidraw).',
        metricTarget: 'Ready to present visually in <3 minutes',
      },
      {
        day: 3,
        title: 'Live Technical Verbalization Rehearsal',
        tag: 'Live Verbalization',
        action: 'Conduct a recorded mock technical interview speaking your reasoning and trade-offs out loud before typing any code.',
        deliverable: 'Recorded 45-minute technical mock session with self-critique notes.',
        metricTarget: 'Zero silent pauses (>15s) in live coding',
      },
      {
        day: 4,
        title: 'Failure Mode & Edge Case Defense',
        tag: 'Incident Defense',
        action: 'Document 3 critical production failure scenarios and debugging post-mortems you owned, articulating root causes.',
        deliverable: '3 production debugging / incident post-mortem cards.',
        metricTarget: 'Clear observability & recovery metrics',
      },
      {
        day: 5,
        title: 'Domain Deep-Dive Drill',
        tag: 'Domain Deep Dive',
        action: `Practice technical deep dives into ${topSkills}: latency optimization, caching strategies, and concurrency patterns.`,
        deliverable: 'Technical deep-dive notes on 5 core architectural trade-offs.',
        metricTarget: '>= 2 architectural trade-offs articulated',
      },
      {
        day: 6,
        title: 'Peer / Senior Mock Interview',
        tag: 'Panel Mock',
        action: 'Schedule and execute a 60-minute mock technical screen with a senior engineer or mentor focusing on panel questions.',
        deliverable: 'Objective feedback rubric with targeted remediation items.',
        metricTarget: 'Panel pass score >= 75%',
      },
      {
        day: 7,
        title: 'Panel Readiness Calibration',
        tag: 'Panel Readiness',
        action: 'Synthesize all technical mock feedback into a final pre-interview checklist for upcoming loops.',
        deliverable: 'Pre-interview technical readiness checklist.',
        metricTarget: `Technical round pass rate target >= ${targetScreenToTech}%`,
      },
    ]
  }
}

export default function RoadmapTimeline({ roadmapData, currentPhaseId = 2, onNavigateSection: _onNavigateSection, reportData }) {
  const [activeView, setActiveView] = useState('7day')
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
      : getFallbackSevenDayPlan(targetRole, topSkills, effectivePhaseId, reportData?.funnel_stages?.rates || {})

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
    <section
      id="sprint-roadmap"
      data-mascot-cue="Action plan & milestone pathway: follow the 7-day tactical sprint and 30/60/90-day targets."
      data-mascot-chip="Action Plan"
      data-mascot-emotion="thinking"
      className="space-y-6"
    >
      {/* Section Header with Segmented View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[var(--border-default)] pb-4">
        <div className="flex items-center gap-3.5">
          <CrafturePoseMascot
            pose={activeView === '7day' ? 'clipboard' : 'roadmap'}
            size={74}
            animation="float"
            showShadow={false}
            className="shrink-0 hidden sm:inline-flex"
            alt={activeView === '7day' ? 'Action Plan Mascot' : 'Roadmap Mascot'}
          />
          <div>
            <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 block">
              Action roadmap &amp; milestones
            </span>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight"
              style={{ fontFamily: 'var(--font-head)' }}
            >
              Action Plan &amp; Milestone Pathway
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium mt-0.5">
              Calibrated to {targetRole} hiring expectations and conversion bottlenecks
            </p>
          </div>
        </div>

        {/* Clean Segmented Switcher (Screen View) */}
        <div className="inline-flex items-center gap-1 bg-[var(--surface-sunken)] p-1 rounded-xl border border-[var(--border-default)] shrink-0 print:hidden self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveView('7day')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeView === '7day'
                ? 'bg-[var(--surface-card)] text-indigo-700 dark:text-indigo-400 shadow-xs border border-indigo-200/60 dark:border-indigo-800/60'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            7-Day Quick Plan
          </button>
          <button
            type="button"
            onClick={() => setActiveView('pathway')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeView === 'pathway'
                ? 'bg-[var(--surface-card)] text-emerald-700 dark:text-emerald-400 shadow-xs border border-emerald-200/60 dark:border-emerald-800/60'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            30 / 60 / 90 Pathway
          </button>
        </div>
      </div>

      {/* ── 1. 7-Day Rapid Triage Plan (Compact 2-Column Checklist Grid) ── */}
      <div className={`space-y-4 ${activeView === '7day' ? 'block' : 'hidden print:block'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              7-Day Tactical Sprints (Immediate Bottleneck Remediation)
            </span>
          </div>
          <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300">
            Sprint Phase: Days 1–7
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sevenDayPlan.map((item, idx) => {
            if (item?.locked || reportData?.__teaserRedacted) {
              return (
                <div
                  key={`skel_${idx}`}
                  className={`p-3.5 sm:p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs space-y-2.5 ${
                    idx === 6 ? 'md:col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-5 w-16 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                    <div className="h-5 w-24 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                  </div>
                  <div className="h-4 w-3/4 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                  <div className="h-3.5 w-full bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                </div>
              )
            }
            const dayNum = item.day || idx + 1
            const dayTag = item.tag || item.skillOrChannel || DEFAULT_DAY_TAGS[idx] || 'Sprint Execution'
            const isFullWidthDay = idx === 6

            return (
              <div
                key={dayNum}
                className={`p-3.5 sm:p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs flex flex-col justify-between space-y-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors ${
                  isFullWidthDay ? 'md:col-span-2' : ''
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-indigo-800 dark:text-indigo-300 shrink-0">
                      DAY 0{dayNum}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-sunken)] px-2 py-0.5 rounded border border-[var(--border-default)] truncate max-w-[180px]">
                      {dayTag}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-[var(--text-primary)] leading-snug">
                    {item.title}
                  </h4>

                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-normal line-clamp-2">
                    {item.action}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-default)] text-xs font-mono">
                  {item.deliverable && (
                    <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                      <span className="text-[var(--text-muted)] font-sans">Artifact:</span>
                      <span className="text-[var(--text-secondary)] font-medium truncate">{item.deliverable}</span>
                    </div>
                  )}
                  {item.metricTarget && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[var(--text-muted)] font-sans">Target:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{item.metricTarget}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 2. 30 / 60 / 90 Day Milestone Pathway (Compact 3-Column Grid) ── */}
      <div className={`space-y-4 ${activeView === 'pathway' ? 'block' : 'hidden print:block print:mt-6'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              30 / 60 / 90 Day Compounding Milestones
            </span>
          </div>
          <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300">
            Pipeline Acceleration
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {aiMilestones.map((p, idx) => (
            <div
              key={p.period || idx}
              className={`p-4 sm:p-5 rounded-xl border flex flex-col justify-between space-y-4 transition-colors ${
                p.isGoal
                  ? 'bg-amber-500/5 border-amber-500/30 shadow-xs'
                  : p.active
                  ? 'bg-emerald-500/5 border-emerald-500/30 shadow-xs'
                  : 'bg-[var(--surface-card)] border-[var(--border-default)] shadow-xs'
              }`}
            >
              <div className="space-y-3">
                {/* Milestone Period Badge + Phase Index */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono px-2.5 py-1 rounded-md font-medium ${
                      p.isGoal
                        ? 'bg-amber-400 text-black'
                        : p.active
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-default)]'
                    }`}
                  >
                    {p.period}
                  </span>

                  {p.isGoal ? (
                    <Trophy size={16} weight="fill" className="text-amber-500" />
                  ) : (
                    <span className="text-xs font-mono font-semibold text-[var(--text-muted)] tabular-nums">
                      0{idx + 1}
                    </span>
                  )}
                </div>

                {/* Stage Title & Goal */}
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
                    {p.stage}
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium leading-relaxed">
                    {p.goal}
                  </p>
                </div>

                {/* Actions */}
                <ul className="space-y-1.5 list-none pl-0 text-[11px] font-medium text-[var(--text-primary)]">
                  {(p.actions || []).map((act, aIdx) => (
                    <li key={aIdx} className="flex items-start gap-2 leading-relaxed">
                      <Check
                        size={13}
                        weight="bold"
                        className={`shrink-0 mt-0.5 ${
                          p.active || p.isGoal ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]'
                        }`}
                      />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Deliverable & Success Signal Footers */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-default)] text-xs font-mono">
                {p.deliverable && (
                  <div className="space-y-0.5">
                    <span className="text-[var(--text-muted)] font-sans block text-xs">Key deliverable:</span>
                    <p className="text-[var(--text-secondary)] font-medium leading-tight">{p.deliverable}</p>
                  </div>
                )}
                {p.successSignal && (
                  <div className="space-y-0.5 pt-1">
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans block text-xs font-medium">Success signal:</span>
                    <p className="text-[var(--text-secondary)] font-medium leading-tight">{p.successSignal}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
