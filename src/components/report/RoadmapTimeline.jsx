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

  const getPhaseActions = (phaseData, defaultActions) => {
    if (!phaseData) return defaultActions
    const rawList = Array.isArray(phaseData.tasks) && phaseData.tasks.length > 0
      ? phaseData.tasks
      : Array.isArray(phaseData.actions) && phaseData.actions.length > 0
      ? phaseData.actions
      : [phaseData.action, phaseData.description, phaseData.impact].filter(Boolean)

    if (rawList.length > 0) {
      return rawList.map((t, i) => getTaskText(t, defaultActions[i] || 'Complete key milestone objective.'))
    }
    return defaultActions
  }

  // Structured 30 / 60 / 90 Day Milestones
  const PHASES = [
    {
      period: '30 DAYS',
      stage: safeData[0]?.title || safeData[0]?.theme || 'Phase 1: Fix Positioning & Resume',
      goal: safeData[0]?.goal || 'Eliminate ATS parser drop-offs and align technical positioning with your target role.',
      actions: getPhaseActions(safeData[0], [
        'Rewrite top 5 achievement bullets using STAR/Google XYZ metrics with hard numbers.',
        'Optimize LinkedIn headline and summary for target role search keywords.',
        'Format resume for 100% clean ATS text extraction (standard single column).',
      ]),
      successSignal: safeData[0]?.successSignal || safeData[0]?.success_signal || 'ATS readability score > 80 and initial inbound recruiter views up 30%.',
      active: currentPhaseId <= 2,
    },
    {
      period: '60 DAYS',
      stage: safeData[1]?.title || safeData[1]?.theme || 'Phase 2: Outreach Blitz & Network Velocity',
      goal: safeData[1]?.goal || 'Bypass the high-volume public applicant pool through structured recruiter outreach.',
      actions: getPhaseActions(safeData[1], [
        'Send 5 personalized connection requests to tech recruiters weekly.',
        'Request 2 informational interviews with alumni or peers at target firms.',
        'Apply to 15-20 highly targeted roles with customized keyword matching.',
      ]),
      successSignal: safeData[1]?.successSignal || safeData[1]?.success_signal || 'Consistent 2-3 recruiter phone screens scheduled per week.',
      active: currentPhaseId === 3,
    },
    {
      period: '90 DAYS',
      stage: safeData[2]?.title || safeData[2]?.theme || 'Phase 3: Interview Mastery & Target Offer',
      goal: safeData[2]?.goal || 'Convert recruiter screenings into technical final rounds and verified job offers.',
      actions: getPhaseActions(safeData[2], [
        'Practice 3 mock behavioral interviews with structured STAR stories.',
        'Complete 5 system design or live coding practice sessions.',
        'Prepare salary negotiation benchmarks and counter-offer strategy.',
      ]),
      successSignal: safeData[2]?.successSignal || safeData[2]?.success_signal || 'Final round technical interviews and written target offer received.',
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
