import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Mascot } from 'wobnimo/react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import {
  useReportGuideStore,
  EMOTION_TO_WOBNIMO,
  GUIDE_EMOTIONS,
  SECTION_INSIGHTS,
} from '../../store/useReportGuideStore'
import { crafturePerson } from '../../mascots/crafturePerson'
import { ArrowRight, X, Sparkles } from 'lucide-react'

const OBSERVED_SECTION_IDS = [
  'overview-pulse',
  'overview-bottleneck',
  'resume-scorecard',
  'resume-bullets',
  'linkedin-studio',
  'funnel-leak',
  'sprint-roadmap',
]

export default function CraftureLivingCopilot() {
  const {
    emotion,
    mode,
    headline,
    metricChip,
    activeNodeId,
    palette,
    isChatOpen,
    setMode,
    openChat,
    setActiveSection,
    triggerGuide,
  } = useReportGuideStore()

  const mascotContainerRef = useRef(null)
  const [isCloudDismissed, setIsCloudDismissed] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const currentInsight = useMemo(() => {
    return SECTION_INSIGHTS[activeNodeId] || SECTION_INSIGHTS['overview-pulse']
  }, [activeNodeId])

  const wobnimoState = EMOTION_TO_WOBNIMO[emotion] || 'idle'

  // 1. Intersection Observer across report sections for live scroll tracking
  useEffect(() => {
    const observerCallback = (entries) => {
      // Find the entry with the highest intersection ratio
      const visibleEntries = entries.filter((e) => e.isIntersecting)
      if (visibleEntries.length > 0) {
        visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const activeTarget = visibleEntries[0].target
        const sectionId = activeTarget.id
        if (sectionId && sectionId !== activeNodeId) {
          setActiveSection(sectionId)
          setIsCloudDismissed(false)
        }
      }
    }

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-15% 0px -40% 0px',
      threshold: [0.1, 0.3, 0.6],
    })

    OBSERVED_SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [activeNodeId, setActiveSection])

  // 2. Cursor Gaze-Tilt & GSAP subtle float
  const handleMouseMove = useCallback((e) => {
    if (!mascotContainerRef.current) return
    const rect = mascotContainerRef.current.getBoundingClientRect()
    const x = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)
    const y = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)

    gsap.to(mascotContainerRef.current, {
      rotationY: Math.max(-18, Math.min(18, x * 18)),
      rotationX: Math.max(-12, Math.min(12, -y * 14)),
      transformPerspective: 800,
      duration: 0.35,
      ease: 'power1.out',
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  // GSAP subtle bob and emotion bounce
  useEffect(() => {
    if (!mascotContainerRef.current) return

    const ctx = gsap.context(() => {
      if (emotion === GUIDE_EMOTIONS.VICTORY) {
        gsap.fromTo(
          mascotContainerRef.current,
          { y: 0 },
          { y: -16, duration: 0.28, yoyo: true, repeat: 3, ease: 'power2.out' }
        )
      } else if (emotion === GUIDE_EMOTIONS.ALERT) {
        gsap.fromTo(
          mascotContainerRef.current,
          { x: 0 },
          { x: -5, duration: 0.08, yoyo: true, repeat: 3, ease: 'power2.inOut' }
        )
      } else {
        // Idle gentle breathing float
        gsap.to(mascotContainerRef.current, {
          y: -5,
          duration: 2.2,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        })
      }
    }, mascotContainerRef)

    return () => ctx.revert()
  }, [emotion])

  const handleLaunchChat = () => {
    setHasInteracted(true)
    const prompt = currentInsight?.chatPrompt || 'How can I fix my primary career bottleneck?'
    triggerGuide({
      nodeId: activeNodeId,
      emotion: 'coach',
      headline: 'Atlas Copilot Active: Ready to assist.',
      autoSettleMs: 2000,
    })
    openChat(prompt)
  }

  const handleMascotClick = () => {
    if (isChatOpen) return
    handleLaunchChat()
  }

  const accentColor = palette?.shell || '#6366F1'

  // If chat is open, living copilot stays visible as an active floating companion
  return (
    <div
      className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 pointer-events-none flex flex-col items-end select-none print:hidden"
      aria-label="Crafture Living Copilot Companion"
    >
      {/* ─── Animated Thinking Cloud (Only visible when chat is closed & not dismissed) ─── */}
      <AnimatePresence>
        {!isChatOpen && !isCloudDismissed && (
          <motion.div
            key={`thought-cloud-${activeNodeId}`}
            initial={{ opacity: 0, scale: 0.88, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="mb-2 max-w-[310px] sm:max-w-[340px] pointer-events-auto"
          >
            {/* Thought Bubbles / Rising Dots Trail */}
            <div className="flex flex-col items-end mr-10 mb-1 space-y-1">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.05, duration: 0.3 }}
                className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs mr-3"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.12, duration: 0.3 }}
                className="w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs mr-1"
              />
            </div>

            {/* Main Thought Cloud Card */}
            <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-4 shadow-xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden group">
              {/* Top Accent Line */}
              <div
                className="absolute top-0 left-0 right-0 h-1 transition-colors duration-500"
                style={{ backgroundColor: accentColor }}
              />

              {/* Cloud Header: Chip + Micro-Toggle + Close */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-600 dark:text-slate-300">
                    {metricChip || currentInsight.chip}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Problem / Solution Micro-Toggle */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setMode('problem')}
                      className={`px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                        mode === 'problem'
                          ? 'bg-rose-500 text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Issue
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('solution')}
                      className={`px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                        mode === 'solution'
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Fix
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCloudDismissed(true)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label="Dismiss thought"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Thought Body */}
              <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed mb-3">
                {headline || (mode === 'solution' ? currentInsight.solution : currentInsight.problem)}
              </p>

              {/* Action Trigger */}
              <button
                type="button"
                onClick={handleLaunchChat}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-all cursor-pointer shadow-2xs group/btn"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-indigo-500 group-hover/btn:rotate-12 transition-transform" />
                  <span>Ask Atlas about this</span>
                </span>
                <ArrowRight size={13} className="group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Transparent Floating 3D Mascot Character ─── */}
      <div className="relative pointer-events-auto flex flex-col items-center">
        {/* Mascot Click Area with Hover Lift */}
        <div
          ref={mascotContainerRef}
          onClick={handleMascotClick}
          className="relative cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 group/mascot"
          title={isChatOpen ? 'Atlas Copilot Active' : 'Click to consult Crafture Guide'}
        >
          {/* Floor Ambient Drop Shadow */}
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-28 h-6 rounded-full pointer-events-none transition-all duration-300"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.22) 0%, rgba(15,23,42,0) 70%)',
            }}
          />

          {/* 3D SDF Mascot Canvas (Wobnimo) */}
          <Mascot
            character={crafturePerson}
            state={wobnimoState}
            style={{ width: 136, height: 136 }}
          />

          {/* Minimal Floating Indicator Badge on hover */}
          {!isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              whileHover={{ opacity: 1, y: 0 }}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 text-[9px] font-bold font-mono tracking-tight shadow-md whitespace-nowrap pointer-events-none"
            >
              Ask Atlas
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
