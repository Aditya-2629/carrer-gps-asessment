import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PaperPlaneTilt,
  PhoneCall,
  Code,
  Trophy,
  WarningCircle,
  CheckCircle,
  ArrowRight,
  Sparkle,
} from '@phosphor-icons/react'
import { CountUp, SpotlightCard } from '../motion'

/**
 * Mathematically generates an SVG path for a smooth, rounded trapezoid slice.
 */
function getTrapezoidPath(x0t, x1t, y0, x0b, x1b, y1, rt = 6, rb = 6) {
  const round = (n) => Math.round(n * 10) / 10
  const rTop = Math.min(rt, (x1t - x0t) / 4, (y1 - y0) / 4)
  const rBot = Math.min(rb, (x1b - x0b) / 4, (y1 - y0) / 4)
  const h = y1 - y0

  return [
    `M ${round(x0t + rTop)} ${round(y0)}`,
    `L ${round(x1t - rTop)} ${round(y0)}`,
    `Q ${round(x1t)} ${round(y0)} ${round(x1t - (x1t - x1b) * (rTop / h))} ${round(y0 + rTop)}`,
    `L ${round(x1b + (x1t - x1b) * (rBot / h))} ${round(y1 - rBot)}`,
    `Q ${round(x1b)} ${round(y1)} ${round(x1b - rBot)} ${round(y1)}`,
    `L ${round(x0b + rBot)} ${round(y1)}`,
    `Q ${round(x0b)} ${round(y1)} ${round(x0b - (x0b - x0t) * (rBot / h))} ${round(y1 - rBot)}`,
    `L ${round(x0t + (x0b - x0t) * (rTop / h))} ${round(y0 + rTop)}`,
    `Q ${round(x0t)} ${round(y0)} ${round(x0t + rTop)} ${round(y0)}`,
    'Z',
  ].join(' ')
}

/**
 * Computes monotonic descending boundary widths [W0, W1, W2, W3, W4]
 * with a visual floor width (>= 22% of MAX_W) so zero stages never collapse.
 */
function computeFunnelWidths(counts, maxW = 460, minW = 110) {
  const [c0, c1, c2, c3] = counts
  const baseApps = Math.max(1, c0 || 0)

  const w0 = maxW

  const getStageRatio = (count, idx) => {
    if (!c0 || c0 === 0) {
      return [1, 0.72, 0.48, 0.3][idx]
    }
    if (count <= 0) {
      // Step-down visual floor (22% to 26% of maxW) so zero stages look clean and readable
      return (minW / maxW) * [1, 0.9, 0.82][idx - 1]
    }
    const raw = count / baseApps
    const scaled = Math.pow(raw, 0.35)
    const floor = minW / maxW
    return Math.max(floor, floor + (1 - floor) * scaled * 0.85)
  }

  const rawW1 = maxW * getStageRatio(c1, 1)
  const rawW2 = maxW * getStageRatio(c2, 2)
  const rawW3 = maxW * getStageRatio(c3, 3)

  // Enforce monotonic downward taper with distinct visual steps
  const w1 = Math.max(minW + 60, Math.min(w0 - 32, rawW1))
  const w2 = Math.max(minW + 35, Math.min(w1 - 28, rawW2))
  const w3 = Math.max(minW + 15, Math.min(w2 - 24, rawW3))
  const w4 = Math.max(minW * 0.88, w3 - 22)

  return [w0, w1, w2, w3, w4]
}

export default function TaperedFunnelDiagram({
  applications = 0,
  screens = 0,
  technicalRounds = 0,
  offers = 0,
  phaseId = 1,
  screenRate = '0.0',
  techRate = '0',
  offerRate = '0',
  leakTitle = '',
  leakDiagnosis = '',
}) {
  const containerRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(null)

  // Trigger smooth entrance animation when scrolled into view (threshold 0.1)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 4 Core Funnel Stages strictly mapped to Forest-Green gradient scale
  const STAGES = useMemo(() => {
    const numScreenRate = Number(screenRate) || 0
    const numTechRate = Number(techRate) || 0
    const numOfferRate = Number(offerRate) || 0

    return [
      {
        id: 'applications',
        index: 0,
        name: 'Applications',
        shortName: 'Apps',
        count: applications,
        unit: 'sent / month',
        icon: PaperPlaneTilt,
        stepLabel: '100% baseline',
        conversionNote: 'Outbound applications volume',
        targetLabel: '30–60 apps / mo recommended',
        color: '#15803D', // Stage 1: Forest Green
        gradient: ['#15803D', '#166534'],
        isBottleneck: phaseId === 1 && numScreenRate < 5.0,
        diagnosis:
          'Top of funnel volume. Increasing keyword alignment and targeted applications multiplies all downstream interviews.',
      },
      {
        id: 'screens',
        index: 1,
        name: 'Recruiter Screens',
        shortName: 'Screens',
        count: screens,
        unit: 'recruiter calls',
        icon: PhoneCall,
        stepLabel: `${screenRate}% callback`,
        conversionNote: `Callback rate from applications (${screens}/${applications.toLocaleString()})`,
        targetLabel: 'Target: ≥ 5.0% ATS bar',
        targetNum: 5.0,
        color: '#16A34A', // Stage 2: Vibrant Green
        gradient: ['#16A34A', '#15803D'],
        isBottleneck: phaseId === 1 || (phaseId === 2 && numScreenRate < 5.0),
        diagnosis:
          'Initial recruiter phone & video screens. A callback rate below 5.0% points to ATS keyword misses or generic headline positioning.',
      },
      {
        id: 'tech',
        index: 2,
        name: 'Tech Rounds',
        shortName: 'Tech Panels',
        count: technicalRounds,
        unit: 'live panels',
        icon: Code,
        stepLabel: `${techRate}% pass rate`,
        conversionNote: `Panel pass rate (${technicalRounds} rounds reached)`,
        targetLabel: 'Target: ≥ 40% panel pass',
        targetNum: 40,
        color: '#10B981', // Stage 3: Emerald
        gradient: ['#10B981', '#059669'],
        isBottleneck: phaseId === 3,
        diagnosis:
          'Live coding, system design & technical assessments. Below 40% indicates interview defense script or architectural storytelling gaps.',
      },
      {
        id: 'offers',
        index: 3,
        name: 'Job Offers',
        shortName: 'Offers',
        count: offers,
        unit: 'written offers',
        icon: Trophy,
        stepLabel: `${offerRate}% offer rate`,
        conversionNote: `Final-to-offer rate (${offers} offer${offers === 1 ? '' : 's'})`,
        targetLabel: 'Target: ≥ 30% closing',
        targetNum: 30,
        color: '#0D9488', // Stage 4: Teal-Emerald
        gradient: ['#0D9488', '#0F766E'],
        isBottleneck: phaseId === 4 || phaseId === 5,
        diagnosis:
          'Final loops to formal offer letters. Below 30% indicates executive closing friction, culture fit nuances, or negotiation stalls.',
      },
    ]
  }, [applications, screens, technicalRounds, offers, phaseId, screenRate, techRate, offerRate])

  // SVG Geometry Dimensions
  const SVG_W = 520
  const SVG_H = 264
  const CX = SVG_W / 2
  const STAGE_H = 54
  const GAP = 4
  const Y_OFFSET = 16

  const counts = [applications, screens, technicalRounds, offers]
  const widths = useMemo(() => computeFunnelWidths(counts, 460, 114), [counts])

  // Active or hovered stage for tooltip
  const activeStage = hoveredIdx !== null ? STAGES[hoveredIdx] : null

  return (
    <div ref={containerRef} className="w-full max-w-full overflow-x-hidden space-y-6">
      {/* ── Main Tapered Funnel Canvas & Tooltip Container ── */}
      <div className="relative w-full max-w-xl mx-auto px-1 sm:px-4 py-2">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto select-none overflow-visible drop-shadow-xs"
          role="img"
          aria-label="Tapered Candidate Hiring Funnel Diagram"
        >
          <defs>
            {/* Linear Gradients matching Crafture Forest-Green Scale */}
            {STAGES.map((s, i) => (
              <linearGradient
                key={`grad-${s.id}`}
                id={`funnel-gradient-${i}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={s.gradient[0]} />
                <stop offset="100%" stopColor={s.gradient[1]} />
              </linearGradient>
            ))}

            {/* Glowing filter for Bottleneck stage */}
            <filter id="bottleneck-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#F43F5E" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Connected Trapezoid Segments */}
          {STAGES.map((stage, i) => {
            const y0 = Y_OFFSET + i * (STAGE_H + GAP)
            const y1 = y0 + STAGE_H
            const wTop = widths[i]
            const wBot = widths[i + 1]

            const x0t = CX - wTop / 2
            const x1t = CX + wTop / 2
            const x0b = CX - wBot / 2
            const x1b = CX + wBot / 2

            // Top slice has rounded top corners (rx=9), bottom slice has rounded bottom corners (rx=9)
            const rTop = i === 0 ? 9 : 4
            const rBot = i === 3 ? 9 : 4

            const pathD = getTrapezoidPath(x0t, x1t, y0, x0b, x1b, y1, rTop, rBot)
            const isHovered = hoveredIdx === i
            const isBottleneck = stage.isBottleneck

            return (
              <g
                key={`slice-${stage.id}`}
                className="cursor-pointer transition-transform duration-200"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(hoveredIdx === i ? null : i)}
              >
                {/* Trapezoid Path */}
                <motion.path
                  d={pathD}
                  fill={`url(#funnel-gradient-${i})`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={
                    isVisible
                      ? {
                          opacity: hoveredIdx !== null && !isHovered ? 0.72 : 1,
                          scale: isHovered ? 1.015 : 1,
                        }
                      : { opacity: 0, scale: 0.95 }
                  }
                  transition={{
                    duration: 0.45,
                    delay: i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  stroke={isBottleneck ? '#F43F5E' : isHovered ? '#FFFFFF' : 'rgba(255,255,255,0.18)'}
                  strokeWidth={isBottleneck ? 2.5 : isHovered ? 1.5 : 1}
                  filter={isBottleneck ? 'url(#bottleneck-glow)' : undefined}
                  className="transition-all"
                />

                {/* Inner Bold Count (Centered Tabular-Nums) */}
                <text
                  x={CX}
                  y={(y0 + y1) / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  className="font-mono font-extrabold text-base sm:text-lg select-none pointer-events-none tracking-tight"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.45)' }}
                >
                  {stage.count.toLocaleString()}
                </text>

                {/* Subtle Bottleneck indicator flag inside SVG */}
                {isBottleneck && (
                  <g transform={`translate(${CX + wBot / 2 - 28}, ${(y0 + y1) / 2 - 10})`}>
                    <circle cx="10" cy="10" r="7" fill="#F43F5E" />
                    <text
                      x="10"
                      y="14"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="9"
                      fontWeight="bold"
                      className="font-mono select-none pointer-events-none"
                    >
                      !
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {/* ── Interactive Floating Tooltip on Hover / Tap ── */}
        <AnimatePresence>
          {activeStage && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="absolute left-1/2 -translate-x-1/2 bottom-2 z-20 w-[92%] sm:w-80 p-3.5 rounded-xl bg-slate-900/95 dark:bg-[#050C08]/95 text-white border border-slate-700/80 dark:border-[#1B3326] shadow-xl backdrop-blur-md pointer-events-none"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeStage.color }}
                  />
                  <span className="font-bold text-xs sm:text-sm text-[#F0FDF4]">
                    {activeStage.name}
                  </span>
                </div>
                <span className="font-mono text-xs font-semibold tabular-nums text-emerald-400">
                  {activeStage.count.toLocaleString()} {activeStage.unit}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Conversion rate:</span>
                  <span className="font-mono font-bold text-white">{activeStage.stepLabel}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Benchmark:</span>
                  <span className="font-mono text-emerald-300">{activeStage.targetLabel}</span>
                </div>
                <p className="text-[11px] text-slate-300/90 leading-relaxed pt-1.5 border-t border-white/10 mt-1">
                  {activeStage.diagnosis}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Responsive 4-Stage Breakdown Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {STAGES.map((stg) => {
          const isSelected = hoveredIdx === stg.index
          const Icon = stg.icon

          return (
            <SpotlightCard
              key={`metric-card-${stg.id}`}
              onMouseEnter={() => setHoveredIdx(stg.index)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx(hoveredIdx === stg.index ? null : stg.index)}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                stg.isBottleneck
                  ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-400/40'
                  : isSelected
                  ? 'bg-emerald-50/60 dark:bg-[#102118] border-emerald-500/50 dark:border-emerald-500/40 shadow-xs'
                  : 'bg-white dark:bg-[#0B1711] border-slate-200 dark:border-[#1B3326] hover:border-emerald-300 dark:hover:border-emerald-700/60'
              }`}
            >
              {/* Top Header: Dot + Icon + Stage Name */}
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: stg.color }}
                  />
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {stg.name}
                  </span>
                </div>
                {stg.isBottleneck ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                    <WarningCircle size={12} weight="fill" />
                    Bottleneck
                  </span>
                ) : (
                  <Icon size={14} className="text-[var(--text-muted)] shrink-0" />
                )}
              </div>

              {/* Bold Stage Count */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl sm:text-2xl font-mono font-extrabold tabular-nums text-slate-900 dark:text-[#F0FDF4]">
                  <CountUp to={stg.count} duration={1} />
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  {stg.stepLabel}
                </span>
              </div>

              {/* Target Comparison Tag */}
              <p className="text-[11px] text-[var(--text-muted)] dark:text-[#94B4A2] mt-1.5 truncate">
                {stg.targetLabel}
              </p>
            </SpotlightCard>
          )
        })}
      </div>
    </div>
  )
}
