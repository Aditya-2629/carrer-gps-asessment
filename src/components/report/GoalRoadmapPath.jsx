import { motion } from 'framer-motion'
import { Trophy, Check, Star } from '@phosphor-icons/react'

export default function GoalRoadmapPath({ data, currentPhaseId = 2 }) {
  const safeData = data || []
  
  // Fallback if data is missing or incomplete
  const getStepData = (index, defaultTitle, defaultItems) => {
    if (safeData[index]) {
      return {
        step: safeData[index].title || safeData[index].theme || defaultTitle,
        items: safeData[index].tasks || defaultItems,
      }
    }
    return { step: defaultTitle, items: defaultItems }
  }

  const ROADMAP_STEPS = [
    {
      ...getStepData(0, 'Positioning', ['Resume Optimization', 'ATS Keyword Alignment', 'LinkedIn Setup']),
      active: currentPhaseId === 1 || currentPhaseId === 2,
      badge: 'Phase 1',
    },
    {
      ...getStepData(1, 'Visibility', ['Targeted Networking', 'Cold Outreach', 'Employee Referrals']),
      active: currentPhaseId === 3,
      badge: 'Phase 2',
    },
    {
      ...getStepData(2, 'Conversion', ['Technical Interviews', 'STAR Story Prep', 'Follow-up Cadence']),
      active: currentPhaseId === 4,
      badge: 'Phase 3',
    },
    {
      ...getStepData(3, 'Offer & Success', ['Official Job Offer', 'Onboarding Strategy', 'Career Advancement']),
      active: currentPhaseId === 5,
      badge: 'Your Goal 🏆',
      isGoal: true,
    },
  ]

  const pct = Math.min((currentPhaseId / 5) * 100, 100).toFixed(0)

  return (
    <div className="quiz-card p-6 md:p-8 border border-[var(--border-default)] space-y-6">
      {/* Slide Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold uppercase tracking-wider text-[var(--primary)] border border-[var(--primary)]/20 shadow-2xs">
          <span>Slide 08</span>
          <span className="text-[var(--text-muted)]">•</span>
          <span>Milestone Roadmap</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
          What Is My Step-By-Step Roadmap To The Offer?
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
          Follow this calibrated execution path to reach your target role and verified offer.
        </p>
      </div>

      {/* 4 Step Horizontal Pathway */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {ROADMAP_STEPS.map((s, idx) => (
          <motion.div
            key={idx}
            whileHover={{ y: -4 }}
            className={`quiz-card p-5 border transition-all duration-300 flex flex-col justify-between ${
              s.isGoal
                ? 'border-amber-400/50 bg-amber-500/5 shadow-md'
                : s.active
                ? 'border-emerald-500/50 bg-emerald-500/5 shadow-md'
                : 'border-[var(--border-default)] bg-[var(--surface-sunken)]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    s.isGoal
                      ? 'bg-amber-400 text-black font-bold shadow-2xs'
                      : s.active
                      ? 'bg-[var(--emerald)] text-white shadow-2xs'
                      : 'bg-[var(--surface-card)] text-[var(--text-muted)] border border-[var(--border-default)]'
                  }`}
                >
                  {s.badge}
                </span>

                {s.isGoal ? (
                  <Trophy size={24} weight="fill" className="text-amber-500" />
                ) : (
                  <span className="text-xs font-mono font-bold text-[var(--text-muted)]">0{idx + 1}</span>
                )}
              </div>

              <h4 className="text-lg font-bold text-[var(--text-primary)] mb-3.5 tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
                {s.step}
              </h4>

              <ul className="space-y-2.5 text-sm text-[var(--text-primary)] list-none pl-0 font-medium">
                {(s.items || []).slice(0, 4).map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                    <Check size={16} className={`${s.active || s.isGoal ? 'text-[var(--emerald)]' : 'text-[var(--text-muted)]'} shrink-0 mt-1`} weight="bold" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 pt-3 border-t border-[var(--border-default)] text-xs font-semibold text-[var(--text-muted)] text-center uppercase tracking-wider">
              {s.isGoal ? '🏆 Target Destination' : s.active ? '📍 Active Phase' : 'Next Milestone'}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom Encouragement Star Banner */}
      <div className="quiz-card p-5 border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3.5 shadow-xs">
        <Star size={26} weight="fill" className="text-amber-500 shrink-0" />
        <p className="text-sm md:text-base text-[var(--text-primary)] font-medium leading-relaxed">
          "You're <strong className="text-[var(--emerald)] font-bold">{pct}% ready today</strong>. Complete the missions, follow the roadmap, and let's get you to your offer!"
        </p>
      </div>
    </div>
  )
}
