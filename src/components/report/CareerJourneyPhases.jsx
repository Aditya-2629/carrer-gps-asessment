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
        <div>
          <span className="text-xs font-mono font-bold text-[var(--primary)] uppercase tracking-wider block mb-1">
            02 WHERE AM I IN MY CAREER JOURNEY?
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
            Every journey has phases. <span className="text-[var(--primary)]">You are here.</span>
          </h2>
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
                <span className="mt-3 text-xs md:text-sm font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                  {phase.name}
                </span>

                {/* Status Label */}
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                    isCurrent
                      ? 'bg-amber-500 text-white font-bold'
                      : isCompleted
                      ? 'text-[var(--emerald)] bg-[var(--emerald-bg)]'
                      : 'text-[var(--text-subtle)] bg-[var(--surface-sunken)]'
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
      <div className="quiz-card p-4 border border-amber-500/30 bg-amber-500/5 flex items-center gap-3.5 max-w-2xl mx-auto">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-500">
          <ChatCircleDots size={24} weight="fill" />
        </div>
        <p className="text-xs md:text-sm text-[var(--text-primary)] leading-relaxed font-medium">
          {guideMessage}
        </p>
      </div>
    </div>
  )
}
