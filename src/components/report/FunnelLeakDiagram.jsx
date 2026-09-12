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
      <div>
        <span className="text-xs font-mono font-bold text-[var(--primary)] uppercase tracking-wider block mb-1">
          04 WHERE AM I LOSING INTERVIEWS?
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
          <span className="text-red-500">{dropOffPct}% drop-off</span> at {leakStage}.
        </h2>
        <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1">
          That's a systemic problem, not a volume problem. Let's fix the leak.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
        {/* Left: Inverted Funnel Graphic */}
        <div className="lg:col-span-7 space-y-3 flex flex-col items-center">
          {FUNNEL_STAGES.map((item, idx) => (
            <motion.div
              key={item.stage}
              initial={{ scaleX: 0.8, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className={`${item.width} transition-all duration-300`}
            >
              <div
                className={`py-3 px-5 rounded-xl ${item.color} flex items-center justify-between text-white shadow-lg relative ${
                  item.isLeak ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-[var(--surface-base)]' : ''
                }`}
              >
                <span className="font-bold text-xs md:text-sm" style={{ fontFamily: 'var(--font-head)' }}>
                  {item.stage}
                </span>

                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm md:text-base font-mono">{item.count}</span>
                  <span className="text-[10px] text-white/80 font-mono">({item.pct})</span>

                  {item.isLeak && (
                    <span className="hidden sm:inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ml-2 animate-pulse">
                      <ArrowLeft size={12} weight="bold" /> BIGGEST LEAK
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right: Guide Advice Callout Bubble */}
        <div className="lg:col-span-5 quiz-card p-6 border border-[var(--border-default)] bg-[var(--surface-sunken)] space-y-4">
          <div className="flex items-center gap-3 text-[var(--primary)]">
            <ChatCircleText size={24} weight="fill" />
            <h4 className="font-bold text-sm text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
              Atlas Recruiter Diagnosis
            </h4>
          </div>

          <p className="text-xs md:text-sm text-[var(--text-primary)] leading-relaxed font-medium">
            {diagnosis}
          </p>
        </div>
      </div>
    </div>
  )
}
