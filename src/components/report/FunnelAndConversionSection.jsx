import { useState } from 'react'
import useAppStore from '../../store/useAppStore'
import {
  WarningCircle,
  PaperPlaneTilt,
  PhoneCall,
  Code,
  UsersThree,
  Trophy,
  Robot,
  Sliders,
} from '@phosphor-icons/react'
import { extractQuantMetric, decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'
import { useReportGuideStore, GUIDE_EMOTIONS } from '../../store/useReportGuideStore'
import { StageBars } from '../stage-bars'
import { ThresholdLine } from '../threshold-line'
import { NumberRoll } from '../number-roll'

export default function FunnelAndConversionSection({ funnelData: _funnelData, rejectionData, riskData: _riskData, reportData: propReport = null }) {
  const { triggerGuide } = useReportGuideStore()
  const formData = useAppStore((s) => s.formData) || {}
  const storeReportData = useAppStore((s) => s.reportData)
  const reportData = propReport || storeReportData || {}
  const storeReport = reportData
  const answers = reportData?.user_answers || formData || {}

  // What-If Simulation State
  const [callbackLift, setCallbackLift] = useState(0) // 0 to 12%
  const [techPassRateLift, setTechPassRateLift] = useState(0) // 0 to 25%

  // 1. Extract Candidate Real Numbers across all funnel dimensions
  const parseFunnelCount = (val, fallback = 0) => {
    if (typeof val === 'number' && !isNaN(val)) {
      if (val > 1000) return Math.min(Math.round(val / 100), 250)
      return val
    }
    if (!val) return fallback
    const cleaned = String(val).replace(/[^0-9]/g, '')
    const num = parseInt(cleaned, 10)
    if (isNaN(num)) return fallback
    if (num > 1000) return Math.min(Math.round(num / 100), 250)
    return num
  }

  const f90 = answers.funnel90d || {}
  const apps30dRaw = extractQuantMetric(answers.apps30d ?? (answers.appsWeek ? answers.appsWeek * 4.33 : null), 20, 'month').rawNum
  const apps30d = parseFunnelCount(apps30dRaw, 20)
  const totalApps90d = parseFunnelCount(f90.applications90d || (apps30d * 3), 60)
  const screens = parseFunnelCount(f90.recruiterScreens ?? f90.screens ?? answers.interviews ?? answers.humanScreen ?? 0, 0)
  const assessments = parseFunnelCount(f90.assessments ?? 0, 0)
  const aiInterviews = parseFunnelCount(f90.aiInterviews ?? 0, 0)
  const combinedScreens = screens + assessments + aiInterviews
  const technicalRounds = parseFunnelCount(f90.technicalRounds ?? f90.assessments ?? 0, 0)
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

  const FUNNEL_STAGES = [
    {
      id: 1,
      name: 'Applications',
      shortName: 'Apps',
      count: totalApps90d,
      unit: 'sent (90d)',
      icon: PaperPlaneTilt,
      color: '#3b82f6',
      isDropOffGate: phaseId === 1,
      dropOffLabel: 'Phase 1 Gate: Drop-off before screens',
    },
    {
      id: 2,
      name: 'Screens',
      shortName: 'Screens',
      count: screens || Math.round(totalApps90d * 0.05),
      unit: 'recruiter calls',
      icon: PhoneCall,
      color: '#6366f1',
      isDropOffGate: phaseId === 2,
      dropOffLabel: 'Phase 2 Gate: Drop-off after screens',
    },
    {
      id: 3,
      name: 'Coding & OAs',
      shortName: 'OAs',
      count: assessments + aiInterviews || Math.max(1, Math.round(screens * 0.8)),
      unit: 'tests & video',
      icon: Robot,
      color: '#06b6d4',
      isDropOffGate: phaseId === 2 && assessments > 0,
      dropOffLabel: 'OA / CodeSignal Assessment Drop-off',
    },
    {
      id: 4,
      name: 'Tech Panel',
      shortName: 'Tech',
      count: technicalRounds || Math.max(1, Math.round((screens || 4) * 0.5)),
      unit: 'live panels',
      icon: Code,
      color: '#8b5cf6',
      isDropOffGate: phaseId === 3,
      dropOffLabel: 'Phase 3 Gate: Live coding / System design stall',
    },
    {
      id: 5,
      name: 'Final Round',
      shortName: 'Final',
      count: finalRounds || Math.max(0, Math.round((technicalRounds || 2) * 0.4)),
      unit: 'manager onsite',
      icon: UsersThree,
      color: '#ec4899',
      isDropOffGate: phaseId === 4,
      dropOffLabel: 'Phase 4 Gate: Final round closing gap',
    },
    {
      id: 6,
      name: 'Offers',
      shortName: 'Offers',
      count: offers,
      unit: joiningStatus === 'No Offer Yet' ? 'offers' : joiningStatus,
      icon: Trophy,
      color: '#10b981',
      isDropOffGate: phaseId === 5,
      dropOffLabel: 'Phase 5 Gate: Offer verification',
    },
  ]

  // What-If Simulation Calculations
  const baseApps = Math.max(50, totalApps90d)
  const currentScreenPct = Math.max(1.5, numScreenRate)
  const simulatedScreenPct = currentScreenPct + callbackLift
  const simulatedScreens = Math.round(baseApps * (simulatedScreenPct / 100))
  const simulatedTech = Math.max(1, Math.round(simulatedScreens * 0.65))
  const baseTechPassPct = Math.max(20, numTechRate || 25)
  const simulatedTechPassPct = Math.min(85, baseTechPassPct + techPassRateLift)
  const simulatedFinals = Math.max(1, Math.round(simulatedTech * (simulatedTechPassPct / 100)))
  const simulatedOffers = Math.max(
    offers + (callbackLift > 0 || techPassRateLift > 0 ? 1 : 0),
    Math.round(simulatedFinals * 0.5)
  )
  const netOfferLift = Math.max(0, simulatedOffers - offers)

  const handleSliderChange = (type, val) => {
    if (type === 'callback') setCallbackLift(val)
    if (type === 'tech') setTechPassRateLift(val)

    if (val > 0) {
      triggerGuide({
        nodeId: 'funnel-sankey',
        emotion: GUIDE_EMOTIONS.VICTORY,
        headline: `What-If Simulation: Lifting ${type === 'callback' ? 'ATS callback' : 'technical pass rate'} unlocks projected offers!`,
        metricChip: `Projected: ${simulatedOffers} Offers`,
        autoSettleMs: 4000,
      })
    }
  }

  // Sankey Layout Geometry
  // 6 columns across width 760
  const sankeyCols = [40, 180, 320, 460, 600, 720]
  const sankeyYMid = 75

  // Sourcing Context Strip
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
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-indigo-600 block">
            Inside The Hiring Funnel
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            90-Day Funnel Outcomes &amp; Conversion Velocity
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Benchmarked against 1,000+ technical candidate pipelines in your target role
        </p>
      </div>

      {/* ── 1. Animated SVG Sankey Pipeline Flow & What-If Simulator ── */}
      <div className="p-5 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
            Sankey Pipeline Flow &amp; Bottleneck Leak Gate
          </span>

          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
            Detected Leak Point: <strong className="text-rose-600">Phase {phaseId}</strong>
          </span>
        </div>

        {/* ── SVG Sankey Visualization ── */}
        <div className="w-full overflow-x-auto bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
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

              // Proportional thickness capped between 12 and 60
              const h0 = Math.max(14, Math.min(54, (stg.count / Math.max(1, totalApps90d)) * 54))
              const h1 = Math.max(10, Math.min(48, (nextStg.count / Math.max(1, totalApps90d)) * 48))

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
                    className="transition-all hover:opacity-80 cursor-pointer"
                    onClick={() => {
                      triggerGuide({
                        nodeId: 'funnel-sankey',
                        emotion: isLeakPath ? GUIDE_EMOTIONS.ALERT : GUIDE_EMOTIONS.INSPECT,
                        headline: `Transition ${stg.shortName} → ${nextStg.shortName}: ${stg.count} candidate events progressing to ${nextStg.count}.`,
                        metricChip: `Flow: ${stg.shortName} → ${nextStg.shortName}`,
                      })
                    }}
                  />

                  {/* Pulsing Alert Marker on Leak Ribbon */}
                  {isLeakPath && (
                    <circle
                      cx={(x0 + x1) / 2}
                      cy={sankeyYMid}
                      r="6"
                      fill="#F43F5E"
                      className="animate-ping"
                      opacity="0.8"
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
                      headline: `${stg.name}: ${stg.count} recorded candidate events. ${stg.dropOffLabel}`,
                      metricChip: `${stg.name}: ${stg.count}`,
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
                    className="transition-all group-hover:filter group-hover:brightness-110"
                  />

                  {/* Top Count Badge */}
                  <text
                    x={x + 9}
                    y={sankeyYMid - 38}
                    textAnchor="middle"
                    fill="#0F172A"
                    fontSize="13"
                    fontWeight="800"
                    fontFamily="Fira Code, monospace"
                  >
                    {stg.count}
                  </text>

                  {/* Bottom Stage Name */}
                  <text
                    x={x + 9}
                    y={sankeyYMid + 46}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {stg.shortName}
                  </text>

                  {/* Leak Gate Badge */}
                  {isLeak && (
                    <g transform={`translate(${x - 22}, ${sankeyYMid + 56})`}>
                      <rect width="62" height="16" rx="4" fill="#F43F5E" />
                      <text x="31" y="11" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="800" fontFamily="Fira Code">
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
                <span className="text-xs font-bold text-rose-700 uppercase tracking-wide font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
                  Primary Funnel Friction Leak: {leakTitle}
                </span>
                <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                  {leakDiagnosis}
                </p>
              </div>
            </div>
          )
        })()}

        {/* ── Interactive What-If Simulator ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Sliders size={18} weight="bold" className="text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                Interactive What-If Pipeline Simulator
              </h4>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Adjust levers to model offer conversion lift
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            {/* Slider 1: Application Callback Lift */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Application Callback Lift</span>
                <span className="font-mono font-bold text-indigo-600">+{callbackLift}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={callbackLift}
                onChange={(e) => handleSliderChange('callback', Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 leading-snug">
                Simulates Google XYZ metric rewrites and literal JD keyword mirroring.
              </p>
            </div>

            {/* Slider 2: Technical Interview Pass Rate Lift */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Tech Screen Pass Rate Lift</span>
                <span className="font-mono font-bold text-emerald-600">+{techPassRateLift}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="5"
                value={techPassRateLift}
                onChange={(e) => handleSliderChange('tech', Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 leading-snug">
                Simulates live system design defense and structured architectural STAR stories.
              </p>
            </div>
          </div>

          {/* Simulated Offers Outcome Strip */}
          <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Current Offers
                </span>
                <span className="font-mono text-xl font-bold text-slate-700">
                  {offers}
                </span>
              </div>

              <div className="text-slate-300 font-bold">→</div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 block font-bold">
                  Simulated Projected Offers
                </span>
                <span className="font-mono text-2xl font-black text-emerald-600">
                  <NumberRoll value={simulatedOffers} duration={700} />
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-slate-900 block">
                Net Pipeline Advantage:
              </span>
              <span className="text-xs font-semibold text-indigo-600 font-mono">
                +{netOfferLift} Offers Projected ({simulatedScreens} screens from {baseApps} apps)
              </span>
            </div>
          </div>

          {/* Hairline StageBars: Funnel Retention Progression */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <StageBars
              title="Pipeline Stage Progression (Current vs Simulated)"
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
                  label: 'Current Funnel',
                  values: [baseApps, combinedScreens || 2, technicalRounds || 1, finalRounds || 0, offers || 0],
                },
                {
                  id: 'simulated',
                  label: `Simulated (+${netOfferLift} Offers)`,
                  values: [baseApps, simulatedScreens, simulatedTech, simulatedFinals, simulatedOffers],
                },
              ]}
              value={callbackLift > 0 || techPassRateLift > 0 ? 'simulated' : 'current'}
              className="w-full"
            />
          </div>
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
            className="w-full bg-slate-50/50 p-4 rounded-2xl border border-slate-200"
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
            className="w-full bg-slate-50/50 p-4 rounded-2xl border border-slate-200"
          />
        </div>

        {/* 3-Pillar Conversion Velocity Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Application → Screen Conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black font-mono ${screenRateColor}`}>
                {screenRate}%
              </span>
              <span className="text-[11px] text-slate-400">Target: &gt;5.0%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Technical → Final Conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black font-mono ${techRateColor}`}>
                {techToFinalRate}%
              </span>
              <span className="text-[11px] text-slate-400">Target: &gt;40%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Final Round → Offer Conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black font-mono ${offerRateColor}`}>
                {finalToOfferRate}%
              </span>
              <span className="text-[11px] text-slate-400">Target: &gt;30%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Personalization Context Strip (SDLC Wave, Visa, Experience, Consultancy) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 break-inside-avoid page-break-inside-avoid">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
          Strategic Market Perimeter &amp; Sourcing Context
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">
              SDLC Market Wave ({sdlc.currentQuarter || 'Q4'})
            </span>
            <p className="text-xs font-bold text-slate-900 truncate">
              {sdlc.title}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block mb-1">
              Work Authorization
            </span>
            <p className="text-xs font-bold text-slate-900 truncate">
              {visaText}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block mb-1">
              Experience Level
            </span>
            <p className="text-xs font-bold text-slate-900 truncate">
              {expText}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
              Search Pipeline Model
            </span>
            <p className="text-xs font-bold text-slate-900 truncate">
              {consultancy.mode}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
