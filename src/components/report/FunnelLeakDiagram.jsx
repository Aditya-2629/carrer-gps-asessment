import { ChatCircleText } from '@phosphor-icons/react'
import TaperedFunnelDiagram from './TaperedFunnelDiagram'

export default function FunnelLeakDiagram({ data }) {
  const safeData = data || {}
  const apps = safeData.applications_count || 100
  const calls = safeData.recruiter_calls_count || 5
  const interviews = safeData.interviews_count || 1
  const offers = safeData.offers_count || 0
  const leakStage = safeData.biggest_leak_stage || 'Recruiter Calls'
  const diagnosis =
    safeData.diagnosis_message ||
    'Most candidates drop off right between Applications and Recruiter Calls. Fix top-of-funnel keyword density and quantified metrics to double screening invitations.'

  const screenRate = apps > 0 ? ((calls / apps) * 100).toFixed(1) : '0.0'
  const techRate = calls > 0 ? ((interviews / calls) * 100).toFixed(0) : '0'
  const offerRate = interviews > 0 ? ((offers / interviews) * 100).toFixed(0) : '0'

  return (
    <div className="quiz-card p-5 sm:p-7 border border-[var(--border-default)] space-y-6">
      {/* Executive Section Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] text-xs font-mono text-[var(--text-muted)] border border-[var(--border-default)] shadow-2xs">
          <span>Funnel Conversion Analysis</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
          Where Am I Losing Interviews?
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
          Primary friction detected at <span className="text-rose-600 dark:text-rose-400 font-semibold">{leakStage}</span>. This is a conversion bottleneck, not a volume problem.
        </p>
      </div>

      {/* Responsive Tapered Trapezoid SVG Funnel */}
      <TaperedFunnelDiagram
        applications={apps}
        screens={calls}
        technicalRounds={interviews}
        offers={offers}
        phaseId={leakStage === 'Applications' || leakStage === 'Recruiter Calls' ? 1 : 3}
        screenRate={screenRate}
        techRate={techRate}
        offerRate={offerRate}
        leakTitle={leakStage}
        leakDiagnosis={diagnosis}
      />

      {/* Recruiter Diagnosis Box */}
      <div className="p-4 sm:p-5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] flex items-start gap-3 shadow-xs">
        <ChatCircleText size={24} weight="fill" className="text-[#15803D] dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-[var(--text-primary)]">
            Atlas Recruiter Diagnosis
          </h4>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
            {diagnosis}
          </p>
        </div>
      </div>
    </div>
  )
}

