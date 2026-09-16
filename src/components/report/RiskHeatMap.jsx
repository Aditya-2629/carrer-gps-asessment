import { motion } from 'framer-motion'
import { ShieldWarning, CheckCircle } from '@phosphor-icons/react'

export default function RiskHeatMap({ data }) {
  const safeData = data || {}
  const criticalRisk = safeData.critical_risk || "Visa Sponsorship Timeline"
  const mitigationPlan = safeData.mitigation_plan || "Target employers with verified e-Verify certification and explicit H-1B sponsorship history to prevent late-stage interview dropouts."
  const highImpactLowLikelihood = safeData.high_impact_low_likelihood || ["Recruiter Ghosting"]
  const lowImpactHighLikelihood = safeData.low_impact_high_likelihood || ["ATS Parsing Errors", "Interview Nervousness"]

  return (
    <div className="quiz-card p-6 md:p-8 border border-[var(--border-default)] space-y-6">
      {/* Slide Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold uppercase tracking-wider text-[var(--primary)] border border-[var(--primary)]/20 shadow-2xs">
          <span>Slide 06</span>
          <span className="text-[var(--text-muted)]">•</span>
          <span>Risk Assessment</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
          What Are My Biggest Job Search Risks?
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
          <span className="text-red-500 font-bold">{criticalRisk}</span> is your critical risk item. Address it proactively before final round stages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
        {/* Left: 2x2 Risk Quadrant */}
        <div className="lg:col-span-7 quiz-card p-6 border border-[var(--border-default)] bg-[var(--surface-sunken)] relative">
          {/* Y-Axis Label */}
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest pointer-events-none">
            IMPACT (LOW TO HIGH)
          </div>

          <div className="grid grid-cols-2 gap-3.5 h-72 relative border-l-2 border-b-2 border-[var(--border-default)] pl-4 pb-4">
            {/* Top-Left Quadrant */}
            <div className="border border-dashed border-[var(--border-default)] rounded-xl p-3 bg-red-500/5 relative flex flex-col justify-end gap-1.5">
              <span className="absolute top-3 right-3 text-xs font-mono font-semibold text-[var(--text-muted)] uppercase">High Impact / Low Likelihood</span>
              {highImpactLowLikelihood.map((risk, i) => (
                <div key={i} className="bg-red-500/20 text-red-500 dark:text-red-400 text-xs font-semibold px-2.5 py-1 rounded-md border border-red-500/30 w-fit truncate max-w-full">
                  • {risk}
                </div>
              ))}
            </div>

            {/* Top-Right Quadrant (CRITICAL RISK ZONE) */}
            <div className="border border-red-500/40 rounded-xl p-3.5 bg-red-500/10 relative flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-mono text-red-500 font-bold uppercase tracking-wider">Critical Risk Zone</span>

              <motion.div
                whileHover={{ scale: 1.05 }}
                className="self-center bg-red-600 text-white font-bold text-sm px-4 py-2 rounded-full shadow-lg shadow-red-500/30 flex items-center gap-2 cursor-pointer animate-pulse text-center"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-xs">+ {criticalRisk}</span>
              </motion.div>
            </div>

            {/* Bottom-Left Quadrant */}
            <div className="border border-[var(--border-default)] rounded-xl p-3 bg-emerald-500/5 relative flex flex-wrap items-end justify-start gap-2">
               <div className="bg-emerald-500/20 text-[var(--emerald)] text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500/30">
                ✓ Market Macro
              </div>
            </div>

            {/* Bottom-Right Quadrant */}
            <div className="border border-amber-500/20 rounded-xl p-3 bg-amber-500/5 relative flex flex-col justify-center items-center gap-2">
              {lowImpactHighLikelihood.map((risk, i) => (
                <div key={i} className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold px-3 py-1 rounded-full border border-amber-500/30 truncate max-w-full">
                  + {risk}
                </div>
              ))}
            </div>
          </div>

          {/* X-Axis Label */}
          <div className="text-center mt-3 text-xs font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest">
            LIKELIHOOD (LOW TO HIGH)
          </div>
        </div>

        {/* Right: Risk Mitigation Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="quiz-card p-6 border border-red-500/30 bg-red-500/5 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-3 text-red-500">
              <ShieldWarning size={24} weight="fill" />
              <h4 className="font-bold text-base text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                Primary Risk Mitigation Plan
              </h4>
            </div>

            <p className="text-sm md:text-base text-[var(--text-primary)] leading-relaxed font-medium">
              {mitigationPlan}
            </p>
          </div>

          <div className="quiz-card p-5 border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3.5 shadow-xs">
            <CheckCircle size={26} weight="fill" className="text-[var(--emerald)] shrink-0" />
            <p className="text-sm md:text-base text-[var(--text-primary)] font-medium leading-relaxed">
              "Let's manage this risk systematically before it costs you another target opportunity."
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
