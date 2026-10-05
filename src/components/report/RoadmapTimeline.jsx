import { motion } from 'framer-motion'
import {
  Check,
  Trophy,
  Target,
  Sparkle,
  Path,
  Flag,
} from '@phosphor-icons/react'

export default function RoadmapTimeline({ roadmapData, currentPhaseId = 2 }) {
  const safeData = Array.isArray(roadmapData) ? roadmapData : []

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

  // Structured 30 / 60 / 90 Day Milestones
  const PHASES = [
    {
      period: '30 DAYS',
      stage: 'Phase 1: Fix Positioning & Resume',
      goal: 'Eliminate ATS parser drop-offs and align technical positioning with your target role.',
      actions: [
        getTaskText(safeData[0]?.tasks?.[0], 'Rewrite top 5 achievement bullets using STAR/Google XYZ metrics.'),
        getTaskText(safeData[0]?.tasks?.[1], 'Optimize LinkedIn headline and summary for target role search keywords.'),
        getTaskText(safeData[0]?.tasks?.[2], 'Format resume for 100% clean ATS text extraction (standard single column).'),
      ],
      successSignal: 'ATS readability score > 80 and initial inbound recruiter views up 30%.',
      active: currentPhaseId <= 2,
    },
    {
      period: '60 DAYS',
      stage: 'Phase 2: Outreach Blitz & Network Velocity',
      goal: 'Bypass the high-volume public applicant pool through structured recruiter outreach.',
      actions: [
        getTaskText(safeData[1]?.tasks?.[0], 'Send 5 personalized connection requests to tech recruiters weekly.'),
        getTaskText(safeData[1]?.tasks?.[1], 'Request 2 informational interviews with alumni or peers at target firms.'),
        getTaskText(safeData[1]?.tasks?.[2], 'Apply to 15-20 highly targeted roles with customized keyword matching.'),
      ],
      successSignal: 'Consistent 2-3 recruiter phone screens scheduled per week.',
      active: currentPhaseId === 3,
    },
    {
      period: '90 DAYS',
      stage: 'Phase 3: Interview Mastery & Target Offer',
      goal: 'Convert recruiter screenings into technical final rounds and verified job offers.',
      actions: [
        getTaskText(safeData[2]?.tasks?.[0], 'Practice 3 mock behavioral interviews with structured STAR stories.'),
        getTaskText(safeData[2]?.tasks?.[1], 'Complete 5 system design or live coding practice sessions.'),
        getTaskText(safeData[3]?.tasks?.[0], 'Prepare salary negotiation benchmarks and counter-offer strategy.'),
      ],
      successSignal: 'Final round technical interviews and written target offer received.',
      isGoal: true,
      active: currentPhaseId >= 4,
    },
  ]

  return (
    <section id="roadmap" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
            Execution Timeline
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            30 / 60 / 90 Day Roadmap
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          A step-by-step pathway from your current positioning to a verified job offer
        </p>
      </div>

      {/* Visual Timeline Cards Grid */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs relative">
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
                  <h3
                    className="text-base font-bold text-[var(--text-primary)] tracking-tight"
                    style={{ fontFamily: 'var(--font-head)' }}
                  >
                    {p.stage}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    {p.goal}
                  </p>
                </div>

                {/* 3-4 Actions Maximum */}
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
    </section>
  )
}
