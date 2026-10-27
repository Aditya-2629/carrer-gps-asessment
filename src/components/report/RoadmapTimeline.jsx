import { motion } from 'framer-motion'
import {
  Check,
  Trophy,
  Target,
  Sparkle,
  Path,
  Flag,
  Lightning,
  ArrowsClockwise,
  ArrowRight,
  CalendarCheck,
} from '@phosphor-icons/react'

export default function RoadmapTimeline({ roadmapData, currentPhaseId = 2, onNavigateSection, reportData }) {
  const safeData = Array.isArray(roadmapData) ? roadmapData : []
  const effectivePhaseId = Number(reportData?.phase?.id || reportData?.career_journey?.current_phase_id || currentPhaseId || 1)
  const targetRole = reportData?.user_answers?.targetRole || reportData?.target_role || 'Engineering Role'
  const visa = reportData?.user_answers?.visa || reportData?.user_answers?.visaStatus || ''
  const externalHelp = reportData?.user_answers?.externalHelp || ''
  const isVisaConstrained = Boolean(visa && !visa.includes('US Citizen') && !visa.includes('Green Card'))
  const isConsultancy = Boolean(externalHelp && (externalHelp.includes('C2C') || externalHelp.includes('Staffing') || externalHelp.includes('Agency')))
  const isDataRole = /data|analyst|analytics|bi\b|business intelligence|tableau|power bi|sql/i.test(targetRole)

  const getTaskText = (task, fallback) => {
    if (!task) return fallback
    if (typeof task === 'string') return task
    if (Array.isArray(task)) {
      const joined = task.map((t) => getTaskText(t, '')).filter(Boolean).join(' ')
      return joined || fallback
    }
    if (typeof task === 'object') {
      const val = task.task || task.title || task.description || task.name || task.text
      if (typeof val === 'string') return val
      if (typeof val === 'object' && val) return getTaskText(val, fallback)
    }
    return fallback
  }

  // 7-Day Quick-Win Sprint personalized by Phase
  let sprintDays12 = {
    title: 'Days 1–2: Document Fix',
    action: 'Rewrite Top 5 Resume Impact Bullets',
    detail: 'Incorporate dollar, scale, or percentage ROI metrics into every experience bullet.',
  }
  let sprintDays34 = {
    title: 'Days 3–4: Inbound Magnet',
    action: 'Optimize LinkedIn Headline & Skills',
    detail: 'Match target role boolean keywords so recruiters discover you directly in LinkedIn Recruiter.',
  }
  let sprintDays57 = {
    title: 'Days 5–7: Direct Pipeline',
    action: 'Send 5 Personalized Outbound Notes',
    detail: 'Reach out to 5 engineering hiring managers or alumni with customized 50-word elevator pitches.',
  }

  // 30 / 60 / 90 Day Milestones personalized by Phase
  let phase30 = {
    period: '30 DAYS',
    stage: 'Phase 1: Fix Positioning & Sourcing',
    goal: 'Eliminate ATS parser drop-offs and align technical positioning with your target role.',
    actions: [
      'Rewrite top 5 achievement bullets using STAR/Google XYZ metrics with hard numbers.',
      'Optimize LinkedIn headline and summary for target role search keywords.',
      'Format resume for 100% clean ATS text extraction (standard single column).',
    ],
    successSignal: 'ATS readability score > 80 and initial inbound recruiter views up 30%.',
    active: true,
  }

  let phase60 = {
    period: '60 DAYS',
    stage: 'Phase 2: Outreach Blitz & Network Velocity',
    goal: 'Bypass the high-volume public applicant pool through structured recruiter outreach.',
    actions: [
      'Send 5 personalized connection requests to tech recruiters weekly.',
      'Request 2 informational interviews with alumni or peers at target firms.',
      'Apply to 15-20 highly targeted roles with customized keyword matching.',
    ],
    successSignal: 'Consistent 2-3 recruiter phone screens scheduled per week.',
    active: false,
  }

  let phase90 = {
    period: '90 DAYS',
    stage: 'Phase 3: Interview Mastery & Target Offer',
    goal: 'Convert recruiter screenings into technical final rounds and verified job offers.',
    actions: [
      'Practice 3 mock behavioral interviews with structured STAR stories.',
      isDataRole
        ? 'Complete 5 SQL, BigQuery, and data modeling / visualization case study sessions.'
        : 'Complete 5 system design or live coding practice sessions.',
      'Prepare salary negotiation benchmarks and counter-offer strategy.',
    ],
    successSignal: 'Final round technical interviews and written target offer received.',
    isGoal: true,
    active: false,
  }

  if (effectivePhaseId === 6) {
    sprintDays12 = {
      title: 'Days 1–2: Resume Foundation',
      action: `Bullet Rewrites & ATS Formatting for ${targetRole}`,
      detail: 'Transform generic task descriptions into quantified achievements using Google XYZ format.',
    }
    sprintDays34 = {
      title: 'Days 3–4: Sourcing Setup',
      action: 'Set Up 3 Direct Job Portal Trackers',
      detail: 'Expand beyond Easy Apply to Dice, company ATS portals, and direct tech job boards.',
    }
    sprintDays57 = {
      title: 'Days 5–7: Application Habit',
      action: 'Submit First 10 High-Target Applications',
      detail: `Submit 10 meticulously matched applications for ${targetRole} with verified keyword alignment.`,
    }
    phase30 = {
      period: '30 DAYS',
      stage: 'Month 1: Foundation & Application Engine',
      goal: 'Establish a consistent 15-20 apps/week rhythm with an ATS-compliant resume and verified skills.',
      actions: [
        'Finalize 2 role-tailored resume versions highlighting production tooling.',
        'Establish automated alerts across direct company portals and job boards.',
        'Begin tracking application status, follow-up dates, and recruiter contact info.',
      ],
      successSignal: '15+ weekly applications submitted with >= 80% role keyword match.',
      active: true,
    }
    phase60.stage = 'Month 2: Inbound Visibility & Screenings'
    phase90.stage = 'Month 3: Technical Mastery & First Offers'
  } else if (effectivePhaseId === 1) {
    sprintDays12 = {
      title: 'Days 1–2: ATS Alignment',
      action: 'Keyword Optimization & Channel Overhaul',
      detail: 'Eliminate parser mismatches and diversify away from 100% Easy Apply dependency.',
    }
    sprintDays34 = {
      title: 'Days 3–4: Inbound Magnet',
      action: 'Deploy Search-Optimized LinkedIn Headline',
      detail: 'Align top 3 pinned skills and headline keywords with active recruiter search boolean queries.',
    }
    sprintDays57 = {
      title: 'Days 5–7: Warm Outreach Sprint',
      action: isConsultancy ? 'Engage 5 Verified Vendor Recruiters' : 'Message 5 Direct Hiring Managers',
      detail: isConsultancy
        ? 'Connect with tier-1 staffing account managers with clear rate expectations and skill matrix.'
        : 'Send 5 concise, 50-word outreach notes directly to engineering managers at target companies.',
    }
    phase30 = {
      period: '30 DAYS',
      stage: 'Month 1: Sourcing Velocity & Funnel Ignition',
      goal: 'Break through the initial ATS barrier and secure 3-5 recruiter screening calls weekly.',
      actions: [
        'Diversify sourcing: 40% Direct ATS, 30% Recruiter Outreach, 20% Referrals, 10% Easy Apply.',
        'Send 10 personalized LinkedIn connection notes weekly to engineering recruiters.',
        isVisaConstrained ? 'Target firms with active e-Verify and H-1B transfer filing histories.' : 'Identify 5 target companies with open headcount in your immediate tech stack.',
      ],
      successSignal: '3–5 first-round recruiter or vendor screening calls scheduled per week.',
      active: true,
    }
  } else if (effectivePhaseId === 2) {
    sprintDays12 = {
      title: 'Days 1–2: 60-Second Pitch',
      action: 'Master Your Elevator Pitch & Resume Story',
      detail: 'Craft a crisp, 60-second verbal intro aligning your background directly to recruiter screening rubrics.',
    }
    sprintDays34 = {
      title: 'Days 3–4: Assessment Prep',
      action: isDataRole ? 'SQL & Data Case Study Prep' : 'Online Coding / Video Screen Prep',
      detail: isDataRole
        ? 'Complete 3 timed SQL / BigQuery case studies and practice articulating metric logic & schema trade-offs.'
        : 'Complete 3 timed practice assessments and record your verbal explanation of data structures & API logic.',
    }
    sprintDays57 = {
      title: 'Days 5–7: Screening Conversion',
      action: 'Execute Mock Recruiter Calls',
      detail: 'Rehearse compensation framing, work authorization clarity, and clear project responsibility answers.',
    }
    phase30 = {
      period: '30 DAYS',
      stage: 'Month 1: Screening & Assessment Conversion',
      goal: 'Raise screening call to technical round conversion from <30% to >75%.',
      actions: [
        'Script and memorize concise answers for "Tell me about yourself" and project architecture.',
        isDataRole
          ? 'Complete 10 advanced SQL queries (window functions, CTEs) and business analytics case studies under 30-minute timers.'
          : 'Complete 10 LeetCode Medium/HackerRank coding assessments under 30-minute timers.',
        'Align salary and sponsorship communication upfront to prevent premature screening disqualification.',
      ],
      successSignal: 'At least 2 live technical rounds scheduled from every 3 recruiter screening calls.',
      active: true,
    }
    phase60.stage = isDataRole ? 'Month 2: Live SQL & Analytical Case Studies' : 'Month 2: Live Technical & Whiteboarding'
    phase90.stage = 'Month 3: Managerial Onsites & Offer Closing'
  } else if (effectivePhaseId === 3) {
    sprintDays12 = {
      title: 'Days 1–2: Architecture Storytelling',
      action: isDataRole ? 'Data Architecture & Metric Storytelling' : 'End-to-End System Deep Dive',
      detail: isDataRole
        ? 'Prepare business metric storytelling, data pipeline architecture, and Power BI/Tableau dashboard walkthroughs for your top 2 projects.'
        : 'Map out architecture diagrams, trade-offs, and failure recovery for your 2 strongest projects.',
    }
    sprintDays34 = {
      title: 'Days 3–4: Live Problem Solving',
      action: isDataRole ? 'Live SQL & Metric Problem-Solving' : 'Verbal Problem-Solving Practice',
      detail: isDataRole
        ? 'Practice verbalizing SQL schema decisions, ETL edge cases, and business KPI interpretations in real-time.'
        : 'Practice talking through complexity analysis, edge cases, and test assertions in real-time.',
    }
    sprintDays57 = {
      title: 'Days 5–7: STAR Behavioral Mocks',
      action: 'Structure 5 Key Conflict/Ownership Stories',
      detail: 'Use STAR framework to document challenges, system outages, and cross-functional leadership.',
    }
    phase30 = {
      period: '30 DAYS',
      stage: 'Month 1: Technical & System Mastery',
      goal: 'Overcome technical round drop-offs and consistently qualify for final rounds.',
      actions: [
        isDataRole
          ? 'Conduct 3 peer or senior mock technical interviews covering live SQL problem solving and business analytics case studies.'
          : 'Conduct 3 peer or senior mock technical interviews covering live problem solving and architecture.',
        isDataRole
          ? 'Prepare deep dive explanations for data modeling, ETL/ELT pipelines, query optimization, and business metric definitions.'
          : 'Prepare deep dive explanations for database choices, caching layers, and throughput trade-offs.',
        'Build structured STAR responses for the 5 most common technical leadership questions.',
      ],
      successSignal: '>= 60% of technical interviews advance to final / onsite round invitations.',
      active: true,
    }
    phase60.stage = 'Month 2: Managerial Alignment & Culture Fit'
    phase90.stage = 'Month 3: Offer Benchmarks & Closing Strategy'
  } else if (effectivePhaseId === 4) {
    sprintDays12 = {
      title: 'Days 1–2: Managerial Alignment',
      action: 'Culture & Executive Vision Alignment',
      detail: 'Research company OKRs, engineering culture, and executive challenges for your upcoming rounds.',
    }
    sprintDays34 = {
      title: 'Days 3–4: Closing Strategy',
      action: 'Prepare High-Impact Reverse Questions',
      detail: 'Formulate 4 strategic questions that position you as a consultative partner, not just a candidate.',
    }
    sprintDays57 = {
      title: 'Days 5–7: Offer Negotiation Prep',
      action: 'Compile Total Comp Benchmarks',
      detail: 'Benchmark base, bonus, and equity data (Levels.fyi/Blind) to prepare counter-offer leverage.',
    }
    phase30 = {
      period: '30 DAYS',
      stage: 'Month 1: Executive Rapport & Offer Closing',
      goal: 'Convert final round discussions into formal, written job offers with optimal compensation.',
      actions: [
        'Send tailored 2-hour post-interview follow-up notes addressing specific topics discussed.',
        'Align closely with hiring manager on immediate 90-day team impact and deliverables.',
        'Execute professional negotiation scripts to maximize starting offer terms.',
      ],
      successSignal: 'At least 1 written target offer received within 30 days.',
      active: true,
    }
  } else if (effectivePhaseId === 5) {
    sprintDays12 = {
      title: 'Days 1–2: Offer & Background Audit',
      action: 'Documentation & Date Verification',
      detail: 'Audit employment dates, reference letters, and W2/tax docs to prevent verification bottlenecks.',
    }
    sprintDays34 = {
      title: 'Days 3–4: Offer Evaluation',
      action: 'Evaluate Comp & Onboarding Timelines',
      detail: 'Resolve parallel offer decisions and align written start date with visa/notice period needs.',
    }
    sprintDays57 = {
      title: 'Days 5–7: HR Onboarding Clearance',
      action: 'Confirm Background Check Clearance',
      detail: 'Verify background check submission with HR recruiter and confirm official Day 1 onboarding logistics.',
    }
    phase30 = {
      period: '30 DAYS',
      stage: 'Month 1: Seamless Onboarding & Day 1 Launch',
      goal: 'Clear all background verification, contract conditions, and start Day 1 with high confidence.',
      actions: [
        'Coordinate with immigration attorney / HR for I-9 and visa verification clearance.',
        'Gather verified supervisor contacts for background verification references.',
        'Review the team tech stack and prepare your 30-day onboarding impact roadmap.',
      ],
      successSignal: '100% background clearance and smooth Day 1 company onboarding.',
      active: true,
    }
  }

  const PHASES = [phase30, phase60, phase90]

  return (
    <section id="roadmap" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
            Execution Timeline & Milestones
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Action Roadmap & Quick-Win Sprint
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          From immediate 7-day conversion quick-wins to your 90-day verified job offer
        </p>
      </div>

      {/* ── 7-Day Quick-Win Action Plan Card ── */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-[var(--primary-light)]/40 via-[var(--surface-card)] to-emerald-500/10 border-2 border-[var(--primary)]/40 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Lightning size={22} weight="fill" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] font-mono block">
                Immediate Execution Sprint
              </span>
              <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">
                7-Day Quick-Win Action Plan
              </h3>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[var(--primary)] text-white self-start md:self-auto">
            Days 1–7 • High ROI
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          {/* Day 1-2 */}
          <div className="p-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-default)] space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] font-mono block">
              {sprintDays12.title}
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {sprintDays12.action}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {sprintDays12.detail}
            </p>
          </div>

          {/* Day 3-4 */}
          <div className="p-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-default)] space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] font-mono block">
              {sprintDays34.title}
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {sprintDays34.action}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {sprintDays34.detail}
            </p>
          </div>

          {/* Day 5-7 */}
          <div className="p-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-default)] space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 font-mono block">
              {sprintDays57.title}
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {sprintDays57.action}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {sprintDays57.detail}
            </p>
          </div>
        </div>
      </div>

      {/* ── 30 / 60 / 90 Day Direction Cards Grid ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs relative">
        <div className="mb-4">
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--text-muted)] block">
            Longer-Term Strategic Progression
          </span>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            30 / 60 / 90 Day Direction
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {PHASES.map((p, idx) => (
            <motion.div
              key={p.period}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className={`p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-5 ${
                p.isGoal
                  ? 'bg-amber-500/5 border-amber-500/30 shadow-xs'
                  : p.active
                  ? 'bg-emerald-500/5 border-emerald-500/30 shadow-xs'
                  : 'bg-[var(--surface-sunken)] border-[var(--border-default)]'
              }`}
            >
              <div className="space-y-4">
                {/* Milestone Period Badge + Phase Tag */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full font-mono ${
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
                    <Trophy size={20} weight="fill" className="text-amber-500" />
                  ) : (
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
                      0{idx + 1}
                    </span>
                  )}
                </div>

                {/* Stage Title & Goal */}
                <div className="space-y-1">
                  <h4
                    className="text-base font-bold text-[var(--text-primary)] tracking-tight"
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

              {/* Success Signal Callout */}
              <div className="pt-3 border-t border-[var(--border-default)] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--emerald)] block">
                  Success Signal
                </span>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                  {p.successSignal}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Reassessment Loop Trigger Card ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <ArrowsClockwise size={20} weight="bold" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              Continuous Reassessment Loop
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              After completing your 7-Day Plan, log your new screening & interview numbers to recalculate your Hiring Phase.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onNavigateSection) onNavigateSection('funnel-risks')
            else document.getElementById('funnel-risks')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="btn-ghost shrink-0 text-xs font-bold py-2 px-4 border border-[var(--border-default)] rounded-xl hover:border-[var(--primary)] flex items-center gap-1.5 cursor-pointer"
        >
          <span>Update Funnel Numbers</span>
          <ArrowRight size={14} weight="bold" />
        </button>
      </div>
    </section>
  )
}
