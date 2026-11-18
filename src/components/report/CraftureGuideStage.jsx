import { useState, useRef, useEffect, useCallback } from 'react'
import { Mascot } from 'wobnimo/react'
import gsap from 'gsap'
import {
  useReportGuideStore,
  EMOTION_TO_WOBNIMO,
  GUIDE_EMOTIONS,
  GUIDE_MODES,
} from '../../store/useReportGuideStore'
import { ArrowRight } from 'lucide-react'

const TOUR_NODES = [
  {
    id: 'primary-bottleneck',
    tab: 'overview',
    emotion: GUIDE_EMOTIONS.ALERT,
    headline: 'Critical Conversion Bottleneck: Application drop-off identified.',
    metricChip: 'System Alert',
  },
  {
    id: 'funnel-sankey',
    tab: 'funnel',
    emotion: GUIDE_EMOTIONS.INSPECT,
    headline: 'Pipeline Leak Analysis: Phase 3 technical screen pass rate is 14%.',
    metricChip: 'Funnel Leak',
  },
  {
    id: 'resume-audit',
    tab: 'resume',
    emotion: GUIDE_EMOTIONS.ALERT,
    headline: 'Resume Paper X-Ray: 5-part anatomy audit and hurting bullets flagged.',
    metricChip: 'Content Hurting',
  },
  {
    id: 'linkedin-studio',
    tab: 'linkedin',
    emotion: GUIDE_EMOTIONS.COACH,
    headline: 'Executive Narrative: Story-driven positioning crafted for leadership.',
    metricChip: 'Positioning',
  },
  {
    id: 'action-sprint',
    tab: 'funnel',
    emotion: GUIDE_EMOTIONS.VICTORY,
    headline: 'Action Roadmap: 30 / 60 / 90 day milestone pathway to offer conversion.',
    metricChip: 'Action Plan',
  },
]

export default function CraftureGuideStage({ onSelectTab, activeTab: _activeTab = 'overview' }) {
  const { emotion, mode, headline, metricChip, palette, setMode, triggerGuide } = useReportGuideStore()
  const stageRef = useRef(null)
  const characterRef = useRef(null)
  const [tourIdx, setTourIdx] = useState(0)

  const wobnimoState = EMOTION_TO_WOBNIMO[emotion] || 'idle'

  // GSAP anticipation dip and bounce on emotion change
  useEffect(() => {
    if (!characterRef.current) return

    const ctx = gsap.context(() => {
      if (emotion === GUIDE_EMOTIONS.MOVE) {
        gsap.to(characterRef.current, {
          scaleY: 0.92,
          y: 6,
          duration: 0.14,
          ease: 'power2.in',
        })
      } else {
        gsap.fromTo(
          characterRef.current,
          { scaleY: 0.92, y: 6 },
          {
            scaleY: 1,
            y: 0,
            duration: 0.5,
            ease: 'back.out(1.8)',
          }
        )
      }
    }, characterRef)

    return () => ctx.revert()
  }, [emotion])

  // Subtle cursor gaze-tilt on mouse move when idle
  const handleMouseMove = useCallback(
    (e) => {
      if (emotion !== GUIDE_EMOTIONS.IDLE || !characterRef.current || !stageRef.current) return
      const rect = stageRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5

      gsap.to(characterRef.current, {
        rotationY: x * 14,
        rotationX: -y * 10,
        transformPerspective: 600,
        duration: 0.4,
        ease: 'power1.out',
      })
    },
    [emotion]
  )

  const handleMouseLeave = useCallback(() => {
    if (!characterRef.current) return
    gsap.to(characterRef.current, {
      rotationY: 0,
      rotationX: 0,
      duration: 0.6,
      ease: 'power2.out',
    })
  }, [])

  const handleNextTourNode = () => {
    const nextIdx = (tourIdx + 1) % TOUR_NODES.length
    setTourIdx(nextIdx)
    const target = TOUR_NODES[nextIdx]

    if (onSelectTab && target.tab) {
      onSelectTab(target.tab)
    }

    triggerGuide({
      nodeId: target.id,
      emotion: target.emotion,
      headline: target.headline,
      metricChip: target.metricChip,
      autoSettleMs: 4500,
    })

    // Smooth scroll to target element if present
    setTimeout(() => {
      const el = document.getElementById(target.id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 120)
  }

  const emotionColor = palette?.shell || '#6366F1'

  return (
    <div
      ref={stageRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 relative overflow-hidden transition-colors duration-150"
    >
      {/* Top Hairline Active Indicator */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-colors duration-300"
        style={{ backgroundColor: emotionColor }}
      />

      {/* Stage Header & Problem/Solution Segmented Toggle */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{ backgroundColor: emotionColor }}
          />
          <span className="text-xs font-mono tracking-normal text-slate-600">
            Guide Companion
          </span>
        </div>

        {/* 1. Problem / 2. Solution Segmented Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setMode(GUIDE_MODES.PROBLEM)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              mode === GUIDE_MODES.PROBLEM
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            1. Problem
          </button>
          <button
            type="button"
            onClick={() => setMode(GUIDE_MODES.SOLUTION)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              mode === GUIDE_MODES.SOLUTION
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            2. Solution
          </button>
        </div>
      </div>

      {/* 3D Mascot WebGL2 Stage */}
      <div className="relative w-full aspect-square max-h-[220px] mx-auto flex items-center justify-center my-2">
        <div
          ref={characterRef}
          className="relative w-full h-full flex items-center justify-center cursor-pointer select-none"
          onClick={() => {
            triggerGuide({
              nodeId: null,
              emotion: GUIDE_EMOTIONS.VICTORY,
              headline: 'Diagnostic companion responsive and aligned with target role criteria.',
              metricChip: 'Live Calibrated',
            })
          }}
        >
          <Mascot
            character="volt"
            state={wobnimoState}
            palette={palette}
            interactive={true}
            onReady={() => setIsReady(true)}
            className="w-full h-full object-contain filter drop-shadow-md"
          />
        </div>
      </div>

      {/* Editorial Diagnostic Capsule */}
      <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors duration-300"
            style={{
              backgroundColor: `${emotionColor}10`,
              borderColor: `${emotionColor}30`,
              color: emotionColor,
            }}
          >
            {metricChip || 'Telemetry Active'}
          </span>

          <span className="text-[11px] font-mono text-slate-400 capitalize">
            State: {wobnimoState}
          </span>
        </div>

        <p className="text-xs text-slate-700 font-medium leading-relaxed">
          {headline}
        </p>
      </div>

      {/* Next Issue Tour Button */}
      <button
        type="button"
        onClick={handleNextTourNode}
        className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white rounded-xl shadow-xs transition-all hover:opacity-95 active:scale-[0.98]"
        style={{ backgroundColor: emotionColor }}
      >
        <span>Next Issue Tour</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
