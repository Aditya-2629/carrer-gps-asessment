import { motion } from 'framer-motion'
import { ChartPie, Lightbulb } from '@phosphor-icons/react'

export default function RejectionDonutChart({ factors, insight }) {
  // Fallback data
  const safeFactors = factors && factors.length > 0 ? factors : [
    { name: 'Resume', pct: 38, desc: 'ATS Parsing & Metrics Lack' },
    { name: 'Execution', pct: 22, desc: 'Application Method / Timing' },
    { name: 'LinkedIn', pct: 17, desc: 'Profile Incomplete / Low Activity' },
    { name: 'Interview', pct: 11, desc: 'Behavioral & STAR Structure' }
  ]

  const defaultInsight = insight || "Fixing your resume formatting and keyword density will have the biggest immediate impact on your overall callback rate."

  // Colors for the donut chart segments
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#a855f7']

  // Pre-calculate SVG offsets for the stacked circles
  // 2 * Math.PI * r (where r=38) ≈ 238
  let currentOffset = 0
  const totalCircumference = 238
  
  const factorsWithColors = safeFactors.map((f, i) => {
    const strokeDasharray = totalCircumference
    // Calculate the length of this segment
    const segmentLength = (f.pct / 100) * totalCircumference
    // The offset is the total circumference minus the segment length, 
    // but we also need to shift it based on previous segments.
    // SVG stroke-dashoffset draws backwards from 3 o'clock.
    const strokeDashoffset = totalCircumference - segmentLength + currentOffset
    
    currentOffset += segmentLength // move the start for the next segment

    return {
      ...f,
      color: COLORS[i % COLORS.length],
      strokeDasharray,
      strokeDashoffset
    }
  })

  // Find highest factor
  const topFactor = factorsWithColors.reduce((prev, current) => (prev.pct > current.pct) ? prev : current)

  return (
    <div className="quiz-card p-6 md:p-8 border border-[var(--border-default)] space-y-6">
      {/* Slide Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold uppercase tracking-wider text-[var(--primary)] border border-[var(--primary)]/20 shadow-2xs">
          <span>Slide 05</span>
          <span className="text-[var(--text-muted)]">•</span>
          <span>Rejection Diagnosis</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
          Why Am I Not Getting Hired?
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
          {topFactor.name} weaknesses cause <span className="text-red-500 font-bold">{topFactor.pct}% of your rejections</span>. This is the single highest-impact gap to eliminate.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
        {/* Left: Donut Visual & Legend */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 quiz-card border border-[var(--border-default)] bg-[var(--surface-sunken)]">
          <div className="relative w-48 h-48 flex items-center justify-center mb-4">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" stroke="var(--border-default)" strokeWidth="16" fill="transparent" />
              {/* Stacked Conic Segments */}
              {factorsWithColors.map((f, i) => (
                <circle
                  key={f.name}
                  cx="50"
                  cy="50"
                  r="38"
                  stroke={f.color}
                  strokeWidth="16"
                  strokeDasharray={f.strokeDasharray}
                  strokeDashoffset={f.strokeDashoffset}
                  fill="transparent"
                  className="transition-all duration-1000"
                />
              ))}
            </svg>
            <div className="absolute flex flex-col items-center text-center">
              <span className="text-4xl font-extrabold" style={{ color: topFactor.color, fontFamily: 'var(--font-head)' }}>
                {topFactor.pct}%
              </span>
              <span className="text-xs text-[var(--text-muted)] uppercase font-mono font-bold tracking-wider">{topFactor.name} IMPACT</span>
            </div>
          </div>
        </div>

        {/* Right: Detailed Legend */}
        <div className="lg:col-span-6 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {factorsWithColors.map((item) => (
              <div key={item.name} className="p-3.5 rounded-xl quiz-card border border-[var(--border-default)] bg-[var(--surface-card)] flex items-start gap-3 shadow-2xs">
                <div className="w-4 h-4 rounded-full shrink-0 mt-1" style={{ background: item.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                      {item.name}
                    </span>
                    <span className="text-sm font-extrabold font-mono" style={{ color: item.color }}>
                      {item.pct}%
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] block leading-relaxed mt-1 font-medium">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl quiz-card border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3.5 mt-4 shadow-2xs">
            <Lightbulb size={26} weight="fill" className="text-amber-500 shrink-0" />
            <p className="text-sm md:text-base text-[var(--text-primary)] leading-relaxed font-medium">
              "{defaultInsight}"
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
