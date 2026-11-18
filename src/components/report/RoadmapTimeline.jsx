import {
  Check,
  Trophy,
  ArrowsClockwise,
  ArrowRight,
} from '@phosphor-icons/react'
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

export default function RoadmapTimeline({ roadmapData, currentPhaseId = 2, onNavigateSection, reportData }) {
  const effectivePhaseId = Number(reportData?.phase?.id || reportData?.career_journey?.current_phase_id || currentPhaseId || 1)
  const targetRole =
    reportData?.resume_agent?.candidateSnapshot?.targetRole ||
    reportData?.resume_json?.target_role ||
    reportData?.user_answers?.targetRole ||
    'Software Engineer'
  const visa = reportData?.user_answers?.visa || reportData?.user_answers?.visaStatus || ''
  const rawExternal = reportData?.user_answers?.externalHelp
  const helpString = Array.isArray(rawExternal) ? rawExternal.join(' ') : String(rawExternal || '')
  const isSponsorshipRequired = Boolean(visa && /opt|cpt|h-?1b|sponsor/i.test(visa))
  const archetype = classifyRoleArchetype(targetRole)
  const isDataRole = archetype.key === 'DATA_ANALYTICS'
  const topSkills = extractTopSkills(reportData, archetype.mandatoryTools.slice(0, 3).join(', '))

  // -------------------------------------------------------------
  // Dynamic 30-60-90 Day Milestone Pathway
  // -------------------------------------------------------------
  let phase30, phase60, phase90

  if (effectivePhaseId === 1) {
    // Phase 1: Top of Funnel Black Hole
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
    // Phase 2: Recruiter Screen Choke Point
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
  } else if (effectivePhaseId === 3) {
    // Phase 3: Technical Round Choke Point
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
  } else if (effectivePhaseId === 4) {
    // Phase 4: Final Round Offer Closing
    phase30 = {
      period: '30 Days',
      stage: 'Executive Alignment & Offer Negotiation Strategy',
      goal: 'Convert final-round loops into written offers and maximize total compensation leverage.',
      actions: [
        'Prepare 5 executive-level STAR stories demonstrating leadership, conflict resolution, and business impact.',
        `Benchmark total compensation packages on Levels.fyi for ${targetRole} to determine target bands.`,
        'Draft strategic reverse-interview questions to uncover team priorities, roadmap, and tech debt.',
      ],
      deliverable: 'Executive Interview Prep Dossier + Total Compensation Negotiation Matrix',
      successSignal: 'At least 1 formal written job offer received within 30 days.',
      active: true,
    }

    phase60 = {
      period: '60 Days',
      stage: 'Offer Finalization & Onboarding Clearance',
      goal: 'Resolve all employment conditions, background checks, and prepare for Day 1 onboarding.',
      actions: [
        'Assemble tax documents, reference contacts, and employment history for background verification.',
        isSponsorshipRequired
          ? 'Coordinate with immigration attorneys to initiate H-1B transfer / STEM OPT paperwork via USCIS Hub.'
          : 'Finalize employment contract terms, start date, and remote equipment logistics.',
        'Draft a 30-day team onboarding plan reviewing production architecture and key internal repos.',
      ],
      deliverable: 'Cleared Background Verification + 30-Day Onboarding Roadmap',
      successSignal: '100% background clearance and signed employment agreement.',
      active: false,
    }

    phase90 = {
      period: '90 Days',
      stage: 'Early Impact & Performance Acceleration',
      goal: 'Deliver first production feature and establish high credibility with manager and team.',
      actions: [
        'Ship first production pull request and complete first sprint cycle within 30 days of start.',
        'Establish weekly 1-on-1 cadence with engineering manager to align on 6-month promotion criteria.',
        'Document key workflow improvements or team tooling to demonstrate immediate engineering value.',
      ],
      deliverable: 'First Production Contribution + 90-Day Performance Review Alignment',
      successSignal: 'Strong first quarterly performance review and established team velocity.',
      isGoal: true,
      active: false,
    }
  } else {
    // Phase 5/Default
    phase30 = {
      period: '30 Days',
      stage: 'Foundation, Positioning & Asset Calibration',
      goal: 'Establish an ATS-compliant resume, verified online presence, and targeted application engine.',
      actions: [
        `Calibrate resume in single-column format using Google XYZ metrics with verified ${topSkills} keyword density.`,
        'Deploy LinkedIn Sales Navigator & Apollo to build an account list of 25 target US companies actively hiring.',
        isSponsorshipRequired
          ? 'Filter target employer lists via USCIS H-1B Employer Hub and E-Verify databases before submitting.'
          : 'Execute 15 targeted applications weekly directly through company ATS career portals rather than Easy Apply boards.',
      ],
      deliverable: 'ATS-Calibrated Resume + 25 Target Account Outbound Tracker',
      successSignal: '15+ weekly applications submitted with >= 80% role keyword match.',
      active: true,
    }

    phase60 = {
      period: '60 Days',
      stage: 'Recruiter Screening & Technical Interview Velocity',
      goal: 'Generate consistent weekly recruiter screenings and advance into live technical rounds.',
      actions: [
        'Script and rehearse a 60-second verbal elevator pitch highlighting verified architecture scale.',
        isDataRole
          ? `Complete 10 timed SQL and data analysis problem sets on StrataScratch / HackerRank in ${topSkills} to ensure assessment readiness.`
          : `Complete 10 timed problem-solving sets: ${archetype.dayAssessmentPrep}.`,
        'Engage 10 engineering managers weekly using personalized 50-word LinkedIn InMails.',
      ],
      deliverable: 'Active Pipeline of 3+ Scheduled Screens/Week',
      successSignal: 'Consistent conversion of >= 60% from recruiter screen to live technical round.',
      active: false,
    }

    phase90 = {
      period: '90 Days',
      stage: 'Final Round Onsites & Offer Closing',
      goal: 'Convert final round discussions into formal, written job offers with optimal compensation.',
      actions: [
        'Present technical case studies and executive vision to Director/VP stakeholders.',
        `Benchmark total compensation packages on Levels.fyi for ${targetRole} to prepare counter-offer leverage.`,
        'Execute structured negotiation scripts to maximize starting base salary and equity grant.',
      ],
      deliverable: 'Minimum 1 Formal Written Offer with Verified Compensation Package',
      successSignal: 'Signed written offer letter within target leveling band.',
      isGoal: true,
      active: false,
    }
  }

  // Merge dynamic custom roadmap tasks from reportData if present
  const atlasRoadmap = Array.isArray(roadmapData) && roadmapData.length > 0
    ? roadmapData
    : (Array.isArray(reportData?.roadmap) ? reportData.roadmap : [])

  if (atlasRoadmap.length > 0) {
    const extractAtlasTasks = (item) => {
      if (!item) return []
      if (Array.isArray(item.tasks)) return item.tasks.filter((t) => typeof t === 'string' && t.trim())
      if (Array.isArray(item.actions)) return item.actions.filter((t) => typeof t === 'string' && t.trim())
      return []
    }

    const m30Tasks = extractAtlasTasks(atlasRoadmap[0])
    if (m30Tasks.length > 0) {
      phase30.actions = [m30Tasks[0], ...phase30.actions.slice(1, 3)]
    }

    const m60Tasks = extractAtlasTasks(atlasRoadmap[1])
    if (m60Tasks.length > 0) {
      phase60.actions = [m60Tasks[0], ...phase60.actions.slice(1, 3)]
    }

    const m90Tasks = extractAtlasTasks(atlasRoadmap[2])
    if (m90Tasks.length > 0) {
      phase90.actions = [m90Tasks[0], ...phase90.actions.slice(1, 3)]
    }
  }

  const PHASES = [phase30, phase60, phase90]

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
            30 / 60 / 90 Day Milestone Pathway
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Targeted milestone execution calibrated to {targetRole} hiring expectations
        </p>
      </div>

      {/* ── 30 / 60 / 90 Day Direction Cards Grid ── */}
      <div className="p-5 sm:p-6 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {PHASES.map((p, idx) => (
            <div
              key={p.period}
              className={`p-5 sm:p-6 rounded-xl border flex flex-col justify-between space-y-5 transition-colors ${
                p.isGoal
                  ? 'bg-amber-500/5 border-amber-500/30 shadow-xs'
                  : p.active
                  ? 'bg-emerald-500/5 border-emerald-500/30 shadow-xs'
                  : 'bg-[var(--surface-sunken)] border-[var(--border-default)]'
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
                        ? 'bg-[var(--emerald)] text-white'
                        : 'bg-[var(--surface-card)] text-[var(--text-muted)] border border-[var(--border-default)]'
                    }`}
                  >
                    {p.period}
                  </span>

                  {p.isGoal ? (
                    <Trophy size={18} weight="fill" className="text-amber-500" />
                  ) : (
                    <span className="text-xs font-mono font-semibold text-[var(--text-muted)] tabular-nums">
                      0{idx + 1}
                    </span>
                  )}
                </div>

                {/* Stage Title & Goal */}
                <div className="space-y-1">
                  <h4
                    className="text-base font-semibold text-[var(--text-primary)] tracking-tight"
                    style={{ fontFamily: 'var(--font-head)' }}
                  >
                    {p.stage}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    {p.goal}
                  </p>
                </div>

                {/* Actions */}
                <ul className="space-y-2 list-none pl-0 text-xs font-medium text-[var(--text-primary)]">
                  {p.actions.map((act, aIdx) => (
                    <li key={aIdx} className="flex items-start gap-2 leading-relaxed">
                      <Check
                        size={14}
                        weight="bold"
                        className={`shrink-0 mt-0.5 ${
                          p.active || p.isGoal ? 'text-[var(--emerald)]' : 'text-[var(--text-muted)]'
                        }`}
                      />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Deliverable Callout */}
              {p.deliverable && (
                <div className="pt-3 border-t border-[var(--border-default)] space-y-1">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] font-medium block">
                    Key deliverable
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    {p.deliverable}
                  </p>
                </div>
              )}

              {/* Success Signal Callout */}
              <div className="pt-2 border-t border-[var(--border-default)] space-y-1">
                <span className="text-[10px] font-mono text-emerald-600 font-medium block">
                  Success signal
                </span>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                  {p.successSignal}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Continuous Reassessment Loop Trigger Card ── */}
      <div className="p-4 sm:p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <ArrowsClockwise size={18} weight="bold" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
              Continuous Reassessment Loop
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Log updated screening and interview metrics as you clear milestones to recalculate your funnel velocity.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onNavigateSection) onNavigateSection('funnel-sankey')
            else document.getElementById('funnel-sankey')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="btn-ghost shrink-0 text-xs font-semibold py-2 px-3.5 border border-[var(--border-default)] rounded-lg hover:border-[var(--primary)] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <span>Update Funnel Numbers</span>
          <ArrowRight size={13} weight="bold" />
        </button>
      </div>
    </section>
  )
}
