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
      <div>
        <span className="text-xs font-mono font-bold text-[var(--primary)] uppercase tracking-wider block mb-1">
          06 CAREER RISK HEAT MAP
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
          <span className="text-red-500">{criticalRisk}</span> is your critical risk.
        </h2>
        <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1">
          Let's manage this risk proactively before it impacts your next final round.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
        {/* Left: 2x2 Risk Quadrant */}
        <div className="lg:col-span-7 quiz-card p-6 border border-[var(--border-default)] bg-[var(--surface-sunken)] relative">
          {/* Y-Axis Label */}
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-mono font-bold text-[var(--text-subtle)] uppercase tracking-widest pointer-events-none">
            IMPACT (LOW TO HIGH)
          </div>

          <div className="grid grid-cols-2 gap-3 h-64 relative border-l-2 border-b-2 border-[var(--border-default)] pl-4 pb-4">
            {/* Top-Left Quadrant */}
            <div className="border border-dashed border-[var(--border-default)] rounded-xl p-3 bg-red-500/5 relative flex flex-col justify-end gap-1">
              <span className="absolute top-3 right-3 text-[10px] font-mono text-[var(--text-subtle)] uppercase">High Impact / Low Likelihood</span>
              {highImpactLowLikelihood.map((risk, i) => (
                <div key={i} className="bg-red-500/20 text-red-400 text-[10px] font-semibold px-2 py-0.5 rounded border border-red-500/30 w-fit truncate max-w-full">
                  • {risk}
                </div>
              ))}
            </div>

            {/* Top-Right Quadrant (CRITICAL RISK ZONE) */}
            <div className="border border-red-500/30 rounded-xl p-3 bg-red-500/10 relative flex flex-col justify-between">
              <span className="text-[10px] font-mono text-red-500 font-bold uppercase">Critical Risk Zone</span>

              <motion.div
                whileHover={{ scale: 1.05 }}
                className="self-center bg-red-600 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg shadow-red-500/30 flex items-center gap-1.5 cursor-pointer animate-pulse text-center"
              >
                <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-xs">+ {criticalRisk}</span>
              </motion.div>
            </div>

            {/* Bottom-Left Quadrant */}
            <div className="border border-[var(--border-default)] rounded-xl p-3 bg-emerald-500/5 relative flex flex-wrap items-end justify-start gap-2">
               <div className="bg-emerald-500/20 text-[var(--emerald)] text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30">
                ✓ Market Macro
              </div>
            </div>

            {/* Bottom-Right Quadrant */}
            <div className="border border-amber-500/20 rounded-xl p-3 bg-amber-500/5 relative flex flex-col justify-center items-center gap-2">
              {lowImpactHighLikelihood.map((risk, i) => (
                <div key={i} className="bg-amber-500/20 text-amber-500 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-amber-500/30 truncate max-w-full">
                  + {risk}
                </div>
              ))}
            </div>
          </div>

          {/* X-Axis Label */}
          <div className="text-center mt-3 text-[10px] font-mono font-bold text-[var(--text-subtle)] uppercase tracking-widest">
            LIKELIHOOD (LOW TO HIGH)
          </div>
        </div>

        {/* Right: Risk Mitigation Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="quiz-card p-5 border border-red-500/30 bg-red-500/5 space-y-3">
            <div className="flex items-center gap-2.5 text-red-500">
              <ShieldWarning size={22} weight="fill" />
              <h4 className="font-bold text-sm text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                Primary Risk Mitigation Plan
              </h4>
            </div>

            <p className="text-xs text-[var(--text-primary)] leading-relaxed">
              {mitigationPlan}
            </p>
          </div>

          <div className="quiz-card p-4 border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
            <CheckCircle size={24} weight="fill" className="text-[var(--emerald)] shrink-0" />
            <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">
              "Let's manage this risk systematically before it costs you another target opportunity."
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
