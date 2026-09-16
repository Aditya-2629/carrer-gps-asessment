import { motion } from 'framer-motion'
import { CheckCircle, MapPin, Binoculars, Target, Trophy, ChatCircleDots } from '@phosphor-icons/react'

export default function CareerJourneyPhases({ data }) {
  const currentPhaseId = data?.current_phase_id || 2
  const guideMessage = data?.guide_message || "We're in the Positioning phase. Before we move forward to Visibility & Interviews, we need to fix the key gaps holding you back."

  const BASE_PHASES = [
    { id: 1, name: 'Foundation', icon: CheckCircle },
    { id: 2, name: 'Positioning', icon: MapPin },
    { id: 3, name: 'Visibility', icon: Binoculars },
    { id: 4, name: 'Conversion', icon: Target },
    { id: 5, name: 'Offer', icon: Trophy },
  ]

  const phases = BASE_PHASES.map((p) => {
    let status = 'next'
    let label = 'Next'
    if (p.id < currentPhaseId) {
      status = 'completed'
      label = 'Complete'
    } else if (p.id === currentPhaseId) {
      status = 'current'
      label = 'You are here'
    } else if (p.id === 5) {
      status = 'goal'
      label = 'Your Goal'
    }
    return { ...p, status, label }
  })

  return (
    <div className="quiz-card p-6 md:p-8 border border-[var(--border-default)] space-y-6">
      {/* Slide Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold uppercase tracking-wider text-[var(--primary)] border border-[var(--primary)]/20 shadow-2xs">
            <span>Slide 02</span>
            <span className="text-[var(--text-muted)]">•</span>
            <span>Journey Tracker</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
            Where Am I In My Career Journey?
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
            Every job search has distinct phases. <span className="text-[var(--primary)] font-bold">You are currently in Positioning.</span>
          </p>
        </div>
      </div>

      {/* Visual Pipeline Trail */}
      <div className="py-6 px-2">
        <div className="relative flex items-center justify-between max-w-4xl mx-auto">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-8 right-8 h-1 bg-[var(--border-default)] -translate-y-1/2 -z-0">
            <div
              className="h-full bg-[var(--emerald)] transition-all duration-1000"
              style={{ width: `${(currentPhaseId - 1) * 25}%` }}
            />
          </div>

          {phases.map((phase) => {
            const Icon = phase.icon
            const isCurrent = phase.status === 'current'
            const isCompleted = phase.status === 'completed'
            const isGoal = phase.status === 'goal'

            return (
              <div key={phase.id} className="relative z-10 flex flex-col items-center group">
                {/* Milestone Badge Sign */}
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                    isCurrent
                      ? 'bg-amber-500/20 border-amber-400 text-amber-500 shadow-lg shadow-amber-500/10 ring-4 ring-amber-400/20'
                      : isCompleted
                      ? 'bg-emerald-500/20 border-emerald-500 text-[var(--emerald)]'
                      : isGoal
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                      : 'bg-[var(--surface-sunken)] border-[var(--border-default)] text-[var(--text-subtle)]'
                  }`}
                >
                  <Icon size={28} weight={isCurrent || isCompleted ? 'fill' : 'bold'} />
                </motion.div>

                {/* Milestone Name */}
                <span className="mt-3 text-sm md:text-base font-bold text-[var(--text-primary)] tracking-tight text-center" style={{ fontFamily: 'var(--font-head)' }}>
                  {phase.name}
                </span>

                {/* Status Label */}
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5 shadow-2xs ${
                    isCurrent
                      ? 'bg-amber-500 text-white font-bold'
                      : isCompleted
                      ? 'text-[var(--emerald)] bg-[var(--emerald-bg)] border border-[var(--emerald)]/20'
                      : 'text-[var(--text-muted)] bg-[var(--surface-sunken)] border border-[var(--border-default)]'
                  }`}
                >
                  {phase.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Guide Speech Callout Bubble */}
      <div className="quiz-card p-5 border border-amber-500/30 bg-amber-500/5 flex items-center gap-4 max-w-2xl mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-500">
          <ChatCircleDots size={28} weight="fill" />
        </div>
        <p className="text-sm md:text-base text-[var(--text-primary)] leading-relaxed font-medium">
          {guideMessage}
        </p>
      </div>
    </div>
  )
}
