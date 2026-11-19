import useAppStore from '../../store/useAppStore'
import {
  WarningCircle,
  PaperPlaneTilt,
  PhoneCall,
  Code,
  UsersThree,
  Trophy,
  Cpu,
} from '@phosphor-icons/react'
import { useReportGuideStore, GUIDE_EMOTIONS } from '../../store/useReportGuideStore'
import { StageBars } from '../stage-bars'

export default function FunnelAndConversionSection({
  funnelData: _funnelData,
  rejectionData,
  riskData: _riskData,
  reportData: propReport = null,
}) {
  const { triggerGuide } = useReportGuideStore()
  const formData = useAppStore((s) => s.formData) || {}
  const storeReportData = useAppStore((s) => s.reportData)
  const reportData = propReport || storeReportData || {}
  const storeReport = reportData
  const answers = reportData?.user_answers || formData || {}

  // 1. Extract Candidate Real Numbers across all funnel dimensions (exact non-negative integers)
  const parseFunnelCount = (val, fallback = 0) => {
    if (typeof val === 'number' && !isNaN(val)) {
      return Math.max(0, Math.round(val))
    }
    if (!val) return fallback
    const cleaned = String(val).replace(/[^0-9]/g, '')
    const num = parseInt(cleaned, 10)
    if (isNaN(num)) return fallback
    return Math.max(0, Math.round(num))
  }

  const f90 = answers.funnel90d || {}
  const rawApps30d = answers.apps30d != null
    ? answers.apps30d
    : (answers.appsWeek != null
      ? Math.round(Number(answers.appsWeek) * 4.33)
      : (f90.applications90d != null ? f90.applications90d : (answers.applications_count != null ? answers.applications_count : 0)))
  const apps30d = parseFunnelCount(rawApps30d, 0)
  const totalAppsMonthly = apps30d > 0 ? apps30d : parseFunnelCount(f90.applications90d ?? answers.applications_count, 0)

  // Real counts strictly from inputs — no fake fallbacks or artificial minimums
  const screens = parseFunnelCount(f90.recruiterScreens ?? f90.screens ?? answers.interviews ?? answers.humanScreen ?? 0, 0)
  const assessments = parseFunnelCount(f90.assessments ?? 0, 0)
  const aiInterviews = parseFunnelCount(f90.aiInterviews ?? 0, 0)
  const combinedScreens = screens + assessments + aiInterviews
  const technicalRounds = parseFunnelCount(f90.technicalRounds ?? 0, 0)
  const finalRounds = parseFunnelCount(f90.finalRounds ?? f90.finals ?? 0, 0)
  const offers = parseFunnelCount(f90.offers ?? 0, 0)
  const joiningStatus = String(f90.joiningStatus || answers.joiningStatus || 'No Offer Yet')

  // 2. Conversion Velocity Rates
  const screenRate = totalAppsMonthly > 0 ? ((combinedScreens / totalAppsMonthly) * 100).toFixed(1) : '0.0'
  const techToFinalRate = technicalRounds > 0 ? ((finalRounds / technicalRounds) * 100).toFixed(0) : '0'
  const finalToOfferRate = finalRounds > 0 ? ((offers / finalRounds) * 100).toFixed(0) : '0'

  const numScreenRate = Number(screenRate)
  const screenRateColor = numScreenRate >= 5.0
    ? 'text-emerald-500'
    : numScreenRate >= 2.0
    ? 'text-amber-500'
    : 'text-rose-500'

  const numTechRate = Number(techToFinalRate)
  const techRateColor = numTechRate >= 40
    ? 'text-emerald-500'
    : numTechRate >= 25
    ? 'text-amber-500'
    : 'text-rose-500'

  const numOfferRate = Number(finalToOfferRate)
  const offerRateColor = numOfferRate >= 30
    ? 'text-emerald-500'
    : numOfferRate >= 15
    ? 'text-amber-500'
    : numOfferRate > 0
    ? 'text-rose-500'
    : 'text-[var(--text-muted)]'

  // 3. Drop-Off Gate Resolution
  const phaseId = Number(storeReport?.phase?.id ?? 1)

  // Funnel stages with quiet neutral slate ramp, highlighting ONLY the detected Drop-Off Gate in #F43F5E
  const FUNNEL_STAGES = [
    {
      id: 1,
      name: 'Applications',
      shortName: 'Apps',
      count: totalAppsMonthly,
      unit: 'sent / month',
      icon: PaperPlaneTilt,
      color: '#6366F1',
      isDropOffGate: phaseId === 1,
      dropOffLabel: 'Phase 1 Gate: Drop-off before recruiter screens',
    },
    {
      id: 2,
      name: 'Screens',
      shortName: 'Screens',
      count: screens,
      unit: 'recruiter calls',
      icon: PhoneCall,
      color: phaseId === 2 ? '#F43F5E' : '#94A3B8',
      isDropOffGate: phaseId === 2,
      dropOffLabel: 'Phase 2 Gate: Drop-off after recruiter screens',
    },
    {
      id: 3,
      name: 'Assessments',
      shortName: 'OAs',
      count: assessments + aiInterviews,
      unit: 'tests & video',
      icon: Cpu,
      color: (phaseId === 2 && (assessments > 0 || aiInterviews > 0)) ? '#F43F5E' : '#CBD5E1',
      isDropOffGate: phaseId === 2 && (assessments > 0 || aiInterviews > 0),
      dropOffLabel: 'OA / CodeSignal Assessment Drop-off',
    },
    {
      id: 4,
      name: 'Tech Panel',
      shortName: 'Tech',
      count: technicalRounds,
      unit: 'live panels',
      icon: Code,
      color: phaseId === 3 ? '#F43F5E' : '#94A3B8',
      isDropOffGate: phaseId === 3,
      dropOffLabel: 'Phase 3 Gate: Live coding / System design panel friction',
    },
    {
      id: 5,
      name: 'Final Round',
      shortName: 'Final',
      count: finalRounds,
      unit: 'onsite loops',
      icon: UsersThree,
      color: phaseId === 4 ? '#F43F5E' : '#CBD5E1',
      isDropOffGate: phaseId === 4,
      dropOffLabel: 'Phase 4 Gate: Final loop closing friction',
    },
    {
      id: 6,
      name: 'Offers',
      shortName: 'Offers',
      count: offers,
      unit: joiningStatus === 'No Offer Yet' ? 'offers' : joiningStatus,
      icon: Trophy,
      color: offers > 0 ? '#10B981' : (phaseId === 5 ? '#F43F5E' : '#94A3B8'),
      isDropOffGate: phaseId === 5,
      dropOffLabel: 'Phase 5 Gate: Offer verification & negotiation',
    },
  ]

  // Sankey Layout Geometry (6 columns across width 760)
  const sankeyCols = [40, 180, 320, 460, 600, 720]
  const sankeyYMid = 75

  return (
    <section id="funnel-sankey" className="space-y-6 break-before-page page-break-before-always">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[var(--border-default)] pb-4">
        <div>
          <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 block">
            Inside the hiring funnel
          </span>
          <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
            Monthly Funnel Outcomes &amp; Conversion Velocity
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
          Benchmarked against 1,000+ technical candidate pipelines in your target role
        </p>
      </div>

      {/* ── 1. SVG Sankey Pipeline Flow & Conversion Progression ── */}
      <div className="p-5 sm:p-6 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            Sankey Pipeline Flow &amp; Bottleneck Leak Gate
          </span>

          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)]">
            Detected Leak Point: <strong className="text-rose-600 dark:text-rose-400 font-semibold">Phase {phaseId}</strong>
          </span>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="flex sm:hidden items-center justify-end text-[11px] font-mono text-[var(--text-muted)]">
          <span>Swipe horizontally to inspect full funnel →</span>
        </div>

        {/* ── SVG Sankey Visualization ── */}
        <div className="w-full overflow-x-auto bg-[var(--surface-sunken)] p-4 rounded-xl border border-[var(--border-default)]">
          <svg viewBox="0 0 760 160" className="w-full min-w-[680px] h-[160px] select-none">
            <defs>
              {FUNNEL_STAGES.slice(0, 5).map((stg, i) => (
                <linearGradient key={`grad-${i}`} id={`sankey-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={stg.color} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={FUNNEL_STAGES[i + 1].color} stopOpacity="0.45" />
                </linearGradient>
              ))}
            </defs>

            {/* Connecting Bezier Flow Ribbons */}
            {FUNNEL_STAGES.slice(0, 5).map((stg, i) => {
              const nextStg = FUNNEL_STAGES[i + 1]
              const x0 = sankeyCols[i] + 18
              const x1 = sankeyCols[i + 1]
              const dx = (x1 - x0) * 0.5

              // Proportional thickness capped between 10 and 54
              const h0 = Math.max(10, Math.min(54, totalAppsMonthly > 0 ? (stg.count / totalAppsMonthly) * 54 : 14))
              const h1 = Math.max(10, Math.min(48, totalAppsMonthly > 0 ? (nextStg.count / totalAppsMonthly) * 48 : 10))

              const y0Top = sankeyYMid - h0 / 2
              const y0Bottom = sankeyYMid + h0 / 2
              const y1Top = sankeyYMid - h1 / 2
              const y1Bottom = sankeyYMid + h1 / 2

              const isLeakPath = stg.isDropOffGate

              return (
                <g key={`ribbon-${i}`}>
                  <path
                    d={`M ${x0} ${y0Top} C ${x0 + dx} ${y0Top}, ${x1 - dx} ${y1Top}, ${x1} ${y1Top} L ${x1} ${y1Bottom} C ${x1 - dx} ${y1Bottom}, ${x0 + dx} ${y0Bottom}, ${x0} ${y0Bottom} Z`}
                    fill={`url(#sankey-grad-${i})`}
                    className="transition-colors hover:opacity-80 cursor-pointer"
                    onClick={() => {
                      triggerGuide({
                        nodeId: 'funnel-sankey',
                        emotion: isLeakPath ? GUIDE_EMOTIONS.ALERT : GUIDE_EMOTIONS.INSPECT,
                        headline: `Transition ${stg.shortName} → ${nextStg.shortName}: ${stg.count.toLocaleString()} candidate events progressing to ${nextStg.count.toLocaleString()}.`,
                        metricChip: `Flow: ${stg.shortName} → ${nextStg.shortName}`,
                      })
                    }}
                  />

                  {/* Marker on Leak Ribbon */}
                  {isLeakPath && (
                    <circle
                      cx={(x0 + x1) / 2}
                      cy={sankeyYMid}
                      r="4"
                      fill="#F43F5E"
                    />
                  )}
                </g>
              )
            })}

            {/* Stage Nodes & Labels */}
            {FUNNEL_STAGES.map((stg, i) => {
              const x = sankeyCols[i]
              const isLeak = stg.isDropOffGate

              return (
                <g
                  key={`node-${stg.id}`}
                  className="cursor-pointer group"
                  onClick={() => {
                    triggerGuide({
                      nodeId: 'funnel-sankey',
                      emotion: isLeak ? GUIDE_EMOTIONS.ALERT : GUIDE_EMOTIONS.INSPECT,
                      headline: `${stg.name}: ${stg.count.toLocaleString()} recorded candidate events. ${stg.dropOffLabel}`,
                      metricChip: `${stg.name}: ${stg.count.toLocaleString()}`,
                    })
                  }}
                >
                  {/* Vertical Node Bar */}
                  <rect
                    x={x}
                    y={sankeyYMid - 30}
                    width={18}
                    height={60}
                    rx={6}
                    fill={isLeak ? '#F43F5E' : stg.color}
                    className="transition-colors group-hover:opacity-90"
                  />

                  {/* Top Count Badge */}
                  <text
                    x={x + 9}
                    y={sankeyYMid - 38}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-slate-900 dark:text-slate-100"
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="Fira Code, monospace"
                  >
                    {stg.count.toLocaleString()}
                  </text>

                  {/* Bottom Stage Name */}
                  <text
                    x={x + 9}
                    y={sankeyYMid + 46}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-slate-600 dark:text-slate-400"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {stg.shortName}
                  </text>

                  {/* Leak Gate Badge */}
                  {isLeak && (
                    <g transform={`translate(${x - 22}, ${sankeyYMid + 56})`}>
                      <rect width="62" height="16" rx="4" fill="currentColor" stroke="currentColor" className="text-rose-50 dark:text-rose-950/80 stroke-rose-200 dark:stroke-rose-800" strokeWidth="1" />
                      <text x="31" y="11" textAnchor="middle" fill="currentColor" className="text-rose-600 dark:text-rose-400" fontSize="8" fontWeight="600" fontFamily="Fira Code, monospace">
                        LEAK GATE
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* ── Active Leak Alert Banner ── */}
        {(() => {
          const activeGate = FUNNEL_STAGES.find((s) => s.isDropOffGate) || FUNNEL_STAGES[0]
          const leakTitle = storeReport?.phase?.shortName || activeGate.name
          const leakDiagnosis =
            rejectionData?.insight ||
            activeGate.dropOffLabel ||
            storeReport?.phase?.stuckDescription ||
            storeReport?.primary_bottleneck ||
            'Candidate pipeline experiences significant conversion friction at this stage.'
          return (
            <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3">
              <WarningCircle size={22} weight="fill" className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-400 inline-block" />
                  Primary Funnel Friction Leak: {leakTitle}
                </span>
                <p className="text-xs sm:text-sm text-[var(--text-primary)] font-medium leading-relaxed">
                  {leakDiagnosis}
                </p>
              </div>
            </div>
          )
        })()}

        {/* StageBars: Verified Pipeline Stage Progression */}
        <div className="pt-2">
          <StageBars
            title="Monthly Stage Progression"
            stages={[
              { id: 'apps', label: 'Applications' },
              { id: 'screens', label: 'Screens' },
              { id: 'tech', label: 'Tech Rounds' },
              { id: 'final', label: 'Final Loops' },
              { id: 'offers', label: 'Offers' },
            ]}
            periods={[
              {
                id: 'current',
                label: 'Candidate Funnel',
                values: [totalAppsMonthly, combinedScreens, technicalRounds, finalRounds, offers],
              },
            ]}
            value="current"
            className="w-full"
          />
        </div>

        {/* Two Horizontal Industry Benchmark Comparison Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 sm:p-5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Screen Callback Rate</span>
              <div className="flex items-center gap-1.5 font-mono tabular-nums">
                <span className={`font-semibold ${screenRateColor}`}>{screenRate}%</span>
                <span className="text-[var(--text-muted)]">/ 5.0% target</span>
              </div>
            </div>
            <div className="relative w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  numScreenRate >= 5 ? 'bg-emerald-500' : numScreenRate >= 2 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (numScreenRate / 5) * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
              <span>Top-quartile ATS threshold</span>
              <span className={`font-medium tabular-nums ${numScreenRate >= 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {numScreenRate >= 5
                  ? `+${(numScreenRate - 5).toFixed(1)}% above bar`
                  : `${(numScreenRate - 5).toFixed(1)}% below bar`}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Technical Pass Rate</span>
              <div className="flex items-center gap-1.5 font-mono tabular-nums">
                <span className={`font-semibold ${techRateColor}`}>{techToFinalRate}%</span>
                <span className="text-[var(--text-muted)]">/ 40% target</span>
              </div>
            </div>
            <div className="relative w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  numTechRate >= 40 ? 'bg-emerald-500' : numTechRate >= 25 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (numTechRate / 40) * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
              <span>Onsite qualification benchmark</span>
              <span className={`font-medium tabular-nums ${numTechRate >= 40 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {numTechRate >= 40
                  ? `+${(numTechRate - 40).toFixed(0)}% above bar`
                  : `${(numTechRate - 40).toFixed(0)}% below bar`}
              </span>
            </div>
          </div>
        </div>

        {/* 3-Pillar Conversion Velocity Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--border-default)]">
          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-mono font-medium text-[var(--text-muted)] block">
              Application → Screen conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-semibold font-mono tabular-nums ${screenRateColor}`}>
                {screenRate}%
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">Target: &gt;5.0%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-mono font-medium text-[var(--text-muted)] block">
              Technical → Final conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-semibold font-mono tabular-nums ${techRateColor}`}>
                {techToFinalRate}%
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">Target: &gt;40%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-mono font-medium text-[var(--text-muted)] block">
              Final round → Offer conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-semibold font-mono tabular-nums ${offerRateColor}`}>
                {finalToOfferRate}%
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">Target: &gt;30%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
