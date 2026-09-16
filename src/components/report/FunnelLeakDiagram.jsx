import { motion } from 'framer-motion'
import { Warning, ChatCircleText, ArrowLeft } from '@phosphor-icons/react'

export default function FunnelLeakDiagram({ data }) {
  const safeData = data || {}
  const apps = safeData.applications_count || 100
  const calls = safeData.recruiter_calls_count || 5
  const interviews = safeData.interviews_count || 1
  const finals = safeData.final_rounds_count || 0
  const offers = safeData.offers_count || 0
  const leakStage = safeData.biggest_leak_stage || 'Recruiter Calls'
  const diagnosis = safeData.diagnosis_message || "Most candidates drop off right between Applications and Recruiter Calls. Fix the top of the funnel (resume formatting & ATS keywords), and every metric below instantly multiplies!"

  const calcPct = (val) => ((val / apps) * 100).toFixed(1) + '%'
  const calcWidth = (val) => Math.max((val / apps) * 100, 10).toFixed(1) + '%'

  const FUNNEL_STAGES = [
    { stage: 'Applications', count: apps, pct: '100%', color: 'bg-blue-600', width: 'w-full', isLeak: leakStage === 'Applications' },
    { stage: 'Recruiter Calls', count: calls, pct: calcPct(calls), color: 'bg-emerald-500', width: `w-[${calcWidth(calls)}]`, isLeak: leakStage === 'Recruiter Calls' },
    { stage: 'Tech Interviews', count: interviews, pct: calcPct(interviews), color: 'bg-amber-500', width: `w-[${calcWidth(interviews)}]`, isLeak: leakStage === 'Tech Interviews' },
    { stage: 'Final Round', count: finals, pct: calcPct(finals), color: 'bg-orange-500', width: `w-[${calcWidth(finals)}]`, isLeak: leakStage === 'Final Round' },
    { stage: 'Offers', count: offers, pct: calcPct(offers), color: 'bg-red-500', width: `w-[${calcWidth(offers)}]`, isLeak: leakStage === 'Offers' },
  ]

  // Find where the biggest drop is
  let dropOffPct = 0
  if (apps > 0) {
    if (leakStage === 'Recruiter Calls') dropOffPct = (((apps - calls) / apps) * 100).toFixed(1)
    else if (leakStage === 'Tech Interviews') dropOffPct = (((calls - interviews) / calls) * 100).toFixed(1)
    else dropOffPct = 90
  }

  return (
    <div className="quiz-card p-6 md:p-8 border border-[var(--border-default)] space-y-6">
      {/* Slide Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold uppercase tracking-wider text-[var(--primary)] border border-[var(--primary)]/20 shadow-2xs">
          <span>Slide 04</span>
          <span className="text-[var(--text-muted)]">•</span>
          <span>Funnel Analysis</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
          Where Am I Losing Interviews?
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
          <span className="text-red-500 font-bold">{dropOffPct}% drop-off</span> detected at {leakStage}. This is a conversion bottleneck, not a volume problem.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
        {/* Left: Inverted Funnel Graphic */}
        <div className="lg:col-span-7 space-y-3.5 flex flex-col items-center w-full">
          {FUNNEL_STAGES.map((item, idx) => (
            <motion.div
              key={item.stage}
              initial={{ scaleX: 0.8, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              style={{ width: idx === 0 ? '100%' : calcWidth(item.count) }}
              className="min-w-[45%] transition-all duration-300"
            >
              <div
                className={`py-3.5 px-5 rounded-xl ${item.color} flex items-center justify-between text-white shadow-md relative ${
                  item.isLeak ? 'ring-3 ring-red-400 ring-offset-2 ring-offset-[var(--surface-base)] shadow-red-500/20 shadow-lg' : ''
                }`}
              >
                <span className="font-bold text-sm md:text-base tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
                  {item.stage}
                </span>

                <div className="flex items-center gap-2.5">
                  <span className="font-extrabold text-base md:text-lg font-mono">{item.count}</span>
                  <span className="text-xs font-mono font-medium text-white/90">({item.pct})</span>

                  {item.isLeak && (
                    <span className="hidden sm:inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ml-2 animate-pulse shadow-sm">
                      <ArrowLeft size={14} weight="bold" /> BIGGEST LEAK
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right: Guide Advice Callout Bubble */}
        <div className="lg:col-span-5 quiz-card p-6 md:p-7 border border-[var(--border-default)] bg-[var(--surface-sunken)] space-y-3.5 shadow-xs">
          <div className="flex items-center gap-3 text-[var(--primary)]">
            <ChatCircleText size={26} weight="fill" />
            <h4 className="font-bold text-base text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
              Atlas Recruiter Diagnosis
            </h4>
          </div>

          <p className="text-sm md:text-base text-[var(--text-primary)] leading-relaxed font-medium">
            {diagnosis}
          </p>
        </div>
      </div>
    </div>
  )
}
