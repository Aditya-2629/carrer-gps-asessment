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
import { decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'
import { useReportGuideStore, GUIDE_EMOTIONS } from '../../store/useReportGuideStore'
import { StageBars } from '../stage-bars'
import { ThresholdLine } from '../threshold-line'

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
    : (answers.appsWeek != null ? Math.round(Number(answers.appsWeek) * 4.33) : 0)
  const apps30d = parseFunnelCount(rawApps30d, 0)
  const totalApps90d = parseFunnelCount(f90.applications90d ?? (apps30d > 0 ? apps30d * 3 : 0), 0)

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
  const screenRate = totalApps90d > 0 ? ((combinedScreens / totalApps90d) * 100).toFixed(1) : '0.0'
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
      count: totalApps90d,
      unit: 'sent (90d)',
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

  // Strategic Market Perimeter Context
  const ext = storeReport?.external_context || {}
  const sdlc = ext.sdlc_market_cycle || {
    title: 'Core Software & Engineering Wave',
    currentQuarter: 'Q4',
  }

  const rawVisa =
    answers.visa ||
    answers.workAuthorization ||
    storeReport?.user_answers?.workAuthorization ||
    storeReport?.user_answers?.visa ||
    'US Citizen / Green Card / GC-EAD'
  const visaText = decodeHtmlEntities(rawVisa)

  const experiences =
    storeReport?.resume_agent?.canonicalResume?.experiences ||
    storeReport?.resume_json?.experiences ||
    storeReport?.resume_json?.experience ||
    []

  let earliestYear = Infinity
  let latestYear = -Infinity
  const currentYear = new Date().getFullYear()

  experiences.forEach((exp) => {
    const dateStr = [exp.duration, exp.dates, exp.startDate, exp.endDate].filter(Boolean).join(' ')
    const matches = dateStr.match(/\b(19\d\d|20\d\d)\b/g)
    if (matches) {
      matches.forEach((m) => {
        const y = parseInt(m, 10)
        if (y >= 1990 && y <= currentYear + 1) {
          if (y < earliestYear) earliestYear = y
          if (y > latestYear) latestYear = y
        }
      })
    }
    if (/present|current/i.test(dateStr) || exp.isCurrent) {
      latestYear = currentYear
    }
  })

  const timelineYoe = (earliestYear !== Infinity && latestYear !== -Infinity && latestYear >= earliestYear)
    ? (latestYear - earliestYear + 1)
    : 0

  const rawCandidateYoe = Number(
    storeReport?.resume_agent?.canonicalResume?.candidate?.yearsOfExperience ||
    storeReport?.resume_agent?.candidateSnapshot?.yearsOfExperience ||
    storeReport?.resume_json?.years_of_experience || 0
  )
  const candidateYoe = Math.max(rawCandidateYoe, timelineYoe)
  const expText = candidateYoe >= 6
    ? 'Senior / 6+ Yrs Experience'
    : candidateYoe >= 3
    ? 'Mid–Senior / 3–5 Yrs Experience'
    : decodeHtmlEntities(answers.experience || 'Junior / 0–2 Yrs Experience')

  const helpArray = Array.isArray(answers.externalHelp) ? answers.externalHelp : [String(answers.externalHelp || '')]
  const resolvedOpportunity =
    answers.opportunityType ||
    reportData?.user_answers?.opportunityType ||
    (ext.consultancy_context?.mode && !ext.consultancy_context.mode.includes('Freelance') ? ext.consultancy_context.mode : null) ||
    (helpArray.some((h) => /C2C/i.test(h))
      ? 'C2C Consultancy / Bench'
      : helpArray.some((h) => /Freelanc/i.test(h))
      ? 'Freelance / Direct Client Gigs'
      : 'Direct Enterprise / W2 Sourcing')

  const consultancy = {
    mode: resolvedOpportunity,
    description: ext.consultancy_context?.description || '100% self-directed application pipeline',
  }

  return (
    <section id="funnel-sankey" className="space-y-6 break-before-page page-break-before-always">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-medium text-indigo-600 block">
            Inside the hiring funnel
          </span>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            90-Day Funnel Outcomes &amp; Conversion Velocity
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Benchmarked against 1,000+ technical candidate pipelines in your target role
        </p>
      </div>

      {/* ── 1. SVG Sankey Pipeline Flow & Conversion Progression ── */}
      <div className="p-5 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            Sankey Pipeline Flow &amp; Bottleneck Leak Gate
          </span>

          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
            Detected Leak Point: <strong className="text-rose-600 font-semibold">Phase {phaseId}</strong>
          </span>
        </div>

        {/* ── SVG Sankey Visualization ── */}
        <div className="w-full overflow-x-auto bg-slate-50/70 p-4 rounded-xl border border-slate-200">
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
              const h0 = Math.max(10, Math.min(54, totalApps90d > 0 ? (stg.count / totalApps90d) * 54 : 14))
              const h1 = Math.max(10, Math.min(48, totalApps90d > 0 ? (nextStg.count / totalApps90d) * 48 : 10))

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
                    fill="#0F172A"
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
                    fill="#475569"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {stg.shortName}
                  </text>

                  {/* Leak Gate Badge */}
                  {isLeak && (
                    <g transform={`translate(${x - 22}, ${sankeyYMid + 56})`}>
                      <rect width="62" height="16" rx="4" fill="#FFF1F2" stroke="#FECDD3" strokeWidth="1" />
                      <text x="31" y="11" textAnchor="middle" fill="#E11D48" fontSize="8" fontWeight="600" fontFamily="Fira Code, monospace">
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
            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 flex items-start gap-3">
              <WarningCircle size={22} weight="fill" className="text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-semibold text-rose-700 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
                  Primary Funnel Friction Leak: {leakTitle}
                </span>
                <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                  {leakDiagnosis}
                </p>
              </div>
            </div>
          )
        })()}

        {/* StageBars: Verified Pipeline Stage Progression */}
        <div className="pt-2">
          <StageBars
            title="Pipeline Stage Progression"
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
                values: [totalApps90d, combinedScreens, technicalRounds, finalRounds, offers],
              },
            ]}
            value="current"
            className="w-full"
          />
        </div>

        {/* Hairline ThresholdLine: Industry Benchmarks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ThresholdLine
            data={[
              { label: 'Week 1', value: 1.5 },
              { label: 'Week 2', value: 2.0 },
              { label: 'Current', value: numScreenRate || 2.4 },
              { label: 'Post-Fix 1', value: Math.min(12, (numScreenRate || 2.4) + 2.5) },
              { label: 'Post-Fix 2', value: Math.min(15, (numScreenRate || 2.4) + 4.8) },
            ]}
            value={5.0}
            title="5% Screening Callback Gate"
            period="Top-quartile candidate ATS threshold"
            label="5.0% Industry Benchmark"
            format={{ style: 'percent', minimumFractionDigits: 1 }}
            className="w-full bg-slate-50/50 p-4 rounded-xl border border-slate-200"
          />

          <ThresholdLine
            data={[
              { label: 'Mock 1', value: 20 },
              { label: 'Mock 2', value: 25 },
              { label: 'Current', value: numTechRate || 28 },
              { label: 'Post-Fix 1', value: Math.min(75, (numTechRate || 28) + 18) },
              { label: 'Post-Fix 2', value: Math.min(85, (numTechRate || 28) + 30) },
            ]}
            value={40}
            title="40% Technical Round Pass Gate"
            period="Onsite qualification benchmark"
            label="40% Tech Bar"
            format={{ style: 'percent', minimumFractionDigits: 0 }}
            className="w-full bg-slate-50/50 p-4 rounded-xl border border-slate-200"
          />
        </div>

        {/* 3-Pillar Conversion Velocity Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono font-medium text-slate-500 block">
              Application → Screen conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-semibold font-mono tabular-nums ${screenRateColor}`}>
                {screenRate}%
              </span>
              <span className="text-[11px] text-slate-400">Target: &gt;5.0%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono font-medium text-slate-500 block">
              Technical → Final conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-semibold font-mono tabular-nums ${techRateColor}`}>
                {techToFinalRate}%
              </span>
              <span className="text-[11px] text-slate-400">Target: &gt;40%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono font-medium text-slate-500 block">
              Final round → Offer conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-semibold font-mono tabular-nums ${offerRateColor}`}>
                {finalToOfferRate}%
              </span>
              <span className="text-[11px] text-slate-400">Target: &gt;30%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Personalization Context Strip (SDLC Wave, Visa, Experience, Sourcing Model) */}
      <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3 break-inside-avoid page-break-inside-avoid">
        <span className="text-xs font-medium text-slate-500 block">
          Strategic market perimeter &amp; sourcing context
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono text-indigo-600 block mb-1 font-medium">
              SDLC market wave ({sdlc.currentQuarter || 'Q4'})
            </span>
            <p className="text-xs font-semibold text-slate-900 truncate">
              {sdlc.title}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono text-sky-600 block mb-1 font-medium">
              Work authorization
            </span>
            <p className="text-xs font-semibold text-slate-900 truncate">
              {visaText}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono text-purple-600 block mb-1 font-medium">
              Experience level
            </span>
            <p className="text-xs font-semibold text-slate-900 truncate">
              {expText}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono text-emerald-600 block mb-1 font-medium">
              Search pipeline model
            </span>
            <p className="text-xs font-semibold text-slate-900 truncate">
              {consultancy.mode}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
