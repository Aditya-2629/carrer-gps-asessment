import { motion } from 'framer-motion'
import { Star, ShieldWarning } from '@phosphor-icons/react'

const DEFAULT_METRICS = [
  { name: 'Resume', score: 34, target: 80, key: 'resume' },
  { name: 'ATS Compatibility', score: 28, target: 85, key: 'ats' },
  { name: 'LinkedIn', score: 38, target: 75, key: 'linkedin' },
  { name: 'Projects Portfolio', score: 30, target: 75, key: 'portfolio' },
  { name: 'Networking', score: 22, target: 70, key: 'networking' },
  { name: 'Communication', score: 50, target: 75, key: 'communication' },
  { name: 'Recruiter Visibility', score: 35, target: 80, key: 'visibility' },
  { name: 'Interview Readiness', score: 42, target: 75, key: 'interview' },
  { name: 'Technical Skills', score: 68, target: 80, key: 'tech_skills', highlight: true },
  { name: 'Market Readiness', score: 39, target: 75, key: 'market' },
]

export default function CareerHealthBreakdown({ healthScore = 41, scoreLabel = 'Emerging', scores }) {
  const metrics = DEFAULT_METRICS.map((m) => {
    if (scores && scores[m.key] && typeof scores[m.key].score === 'number') {
      return { ...m, score: scores[m.key].score }
    }
    return m
  })

  return (
    <div className="quiz-card p-6 md:p-8 border border-[var(--border-default)] space-y-6">
      {/* Slide Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono font-bold text-[var(--primary)] uppercase tracking-wider block mb-1">
            03 CAREER HEALTH DASHBOARD
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
            Bar = your current score | <span className="text-[var(--text-muted)]">Tick line = competitive target</span>
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Gauge Circle */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 quiz-card border border-[var(--border-default)] bg-[var(--surface-sunken)] text-center">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Circle SVG Progress */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="var(--border-default)" strokeWidth="10" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="var(--primary)"
                strokeWidth="10"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * healthScore) / 100}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-extrabold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                {healthScore}
              </span>
              <span className="text-xs text-[var(--text-subtle)] font-mono">/100</span>
            </div>
          </div>

          <span className="mt-4 text-xs font-mono uppercase tracking-wider text-[var(--text-subtle)]">CAREER HEALTH</span>
          <span className="mt-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/30 text-amber-500">
            {scoreLabel}
          </span>
        </div>

        {/* Right: 10 Parameter Bars */}
        <div className="lg:col-span-8 space-y-2.5">
          {metrics.map((item) => (
            <div key={item.name} className="flex items-center gap-3 text-xs">
              <span className="w-36 text-[var(--text-primary)] truncate font-medium">{item.name}</span>

              {/* Progress Bar Container */}
              <div className="flex-1 h-3.5 bg-[var(--surface-sunken)] rounded-full overflow-hidden relative border border-[var(--border-default)]">
                {/* Target Marker Tick Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[var(--text-muted)] z-10"
                  style={{ left: `${item.target}%` }}
                  title={`Target: ${item.target}`}
                />

                {/* Score Bar */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.score}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    item.highlight
                      ? 'bg-[var(--emerald)] shadow-lg shadow-emerald-500/20'
                      : item.score >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500/80'
                  }`}
                />
              </div>

              <span className="w-8 text-right font-mono font-bold text-[var(--text-primary)]">{item.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Insight Box */}
      <div className="quiz-card p-4 border border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3">
        <Star size={20} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs md:text-sm text-[var(--text-primary)] leading-relaxed font-medium">
          <strong className="text-[var(--emerald)]">Technical Skills ({metrics.find((m) => m.highlight)?.score || 68})</strong> is your greatest strength. But Networking, ATS Compatibility, and Portfolio details are currently pulling your overall score down.
        </p>
      </div>
    </div>
  )
}
