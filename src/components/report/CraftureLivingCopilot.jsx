import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Mascot } from 'wobnimo/react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import {
  useReportGuideStore,
  EMOTION_TO_WOBNIMO,
  EMOTION_PALETTES,
  GUIDE_EMOTIONS,
  SECTION_INSIGHTS,
} from '../../store/useReportGuideStore'
import { crafturePerson } from '../../mascots/crafturePerson'
import { ArrowRight, X, Sparkles } from 'lucide-react'

// Main report sections observed for curated executive beats
const OBSERVED_SECTION_IDS = [
  'overview-pulse',
  'overview-bottleneck',
  'resume-scorecard',
  'resume-bullets',
  'linkedin-studio',
  'funnel-leak',
  'sprint-roadmap',
  'overview',
  'bottleneck',
  'resume-ai',
  'linkedin',
  'funnel',
  'roadmap',
]

export default function CraftureLivingCopilot() {
  const {
    emotion,
    mode,
    headline,
    metricChip,
    activeNodeId,
    isChatOpen,
    setMode,
    openChat,
    setActiveSection,
    triggerGuide,
    setEmotion,
  } = useReportGuideStore()

  const mascotContainerRef = useRef(null)
  const isCelebratingRef = useRef(false)
  const scrollDebounceTimerRef = useRef(null)

  const [cloudMinimized, setCloudMinimized] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [activeThought, setActiveThought] = useState(null)

  // Current fallback insight from store
  const storeInsight = useMemo(() => {
    return SECTION_INSIGHTS[activeNodeId] || SECTION_INSIGHTS['overview-pulse']
  }, [activeNodeId])

  // Resolve current active thought text, chip, and accent
  const currentChip = activeThought?.chip || metricChip || storeInsight?.chip || 'Crafture Guide'
  const currentThoughtText =
    activeThought?.text ||
    headline ||
    (mode === 'solution' ? storeInsight?.solution : storeInsight?.thought || storeInsight?.problem)

  const currentEmotion = activeThought?.emotion || emotion || 'idle'
  const wobnimoState = isCelebrating ? 'celebrating' : EMOTION_TO_WOBNIMO[currentEmotion] || 'idle'
  const currentPalette = EMOTION_PALETTES[currentEmotion] || EMOTION_PALETTES.idle
  const accentColor = currentPalette.shell || '#6366F1'

  // 1. Ronaldo "SIUUU!" Celebration Animation (Reserved strictly for genuine wins)
  const triggerSiuuu = useCallback((customMsg = null) => {
    if (!mascotContainerRef.current) return

    isCelebratingRef.current = true
    setIsCelebrating(true)
    setCloudMinimized(false)
    setEmotion('victory')

    setActiveThought({
      chip: 'SIUUU! 🚀',
      text: customMsg || 'SIUUU! Milestone achieved — pipeline momentum unlocked! 🏆',
      emotion: 'victory',
    })

    // Kill any active tweens on the mascot container
    gsap.killTweensOf(mascotContainerRef.current)

    const tl = gsap.timeline({
      onComplete: () => {
        setTimeout(() => {
          isCelebratingRef.current = false
          setIsCelebrating(false)
        }, 2500)
      },
    })

    // Step 1: Anticipation squash before the leap
    tl.to(mascotContainerRef.current, {
      scaleY: 0.78,
      scaleX: 1.15,
      y: 6,
      duration: 0.12,
      ease: 'power2.in',
    })
      // Step 2: High Leap Up (-85px)
      .to(mascotContainerRef.current, {
        y: -85,
        scaleY: 1.18,
        scaleX: 0.9,
        duration: 0.35,
        ease: 'power2.out',
      })
      // Step 3: Mid-air 360° Spin
      .to(
        mascotContainerRef.current,
        {
          rotationY: 360,
          duration: 0.42,
          ease: 'power1.inOut',
        },
        '-=0.25'
      )
      // Step 4: Power Squash Landing
      .to(mascotContainerRef.current, {
        y: 0,
        scaleY: 0.72,
        scaleX: 1.25,
        rotationY: 0,
        duration: 0.18,
        ease: 'power2.in',
      })
      // Step 5: Elastic rebound recovery into proud stance
      .to(mascotContainerRef.current, {
        scaleY: 1,
        scaleX: 1,
        duration: 0.45,
        ease: 'elastic.out(1.2, 0.4)',
      })
  }, [setEmotion])

  // Watch for external store victory triggers (e.g. from 7-day sprint checks)
  useEffect(() => {
    if (emotion === GUIDE_EMOTIONS.VICTORY && !isCelebratingRef.current) {
      triggerSiuuu()
    }
  }, [emotion, triggerSiuuu])

  // 2. Explicit Click Reactions: Genuine Win Clicks or data-guide-msg handlers
  useEffect(() => {
    const handleDocumentClick = (e) => {
      const target = e.target
      if (!target) return

      // Ignore clicks inside the living copilot container itself or chatbot
      if (
        mascotContainerRef.current?.contains(target) ||
        target.closest('#report-chatbot, .report-chatbot')
      ) {
        return
      }

      // Check for explicit data-guide-msg click
      const msgEl = target.closest('[data-guide-msg]')
      if (msgEl) {
        const msg = msgEl.getAttribute('data-guide-msg')
        if (msg) {
          setIsThinking(true)
          setCloudMinimized(false)
          setTimeout(() => {
            setIsThinking(false)
            setActiveThought({
              chip: 'Insight',
              text: msg,
              emotion: 'speaking',
            })
          }, 150)
          return
        }
      }

      // Check for genuine win clicks ONLY
      const winBtn = target.closest(
        'button, [role="button"], input[type="checkbox"], [data-trigger-win]'
      )
      if (!winBtn) return

      const btnText = `${winBtn.textContent || ''} ${winBtn.getAttribute('aria-label') || ''} ${winBtn.title || ''}`.toLowerCase()

      // Strict win triggers: Weave Skill, Copy Rewrite/Bullet/Summary, Sprint Check, Preset Apply
      const isGenuineWin =
        winBtn.hasAttribute('data-trigger-win') ||
        btnText.includes('weave') ||
        btnText.includes('copy rewrite') ||
        btnText.includes('copy bullet') ||
        btnText.includes('copy summary') ||
        btnText.includes('check in') ||
        btnText.includes('advance to next day') ||
        btnText.includes('apply preset') ||
        (btnText.includes('done') && Boolean(winBtn.closest('#action-sprint, #sprint-roadmap')))

      if (isGenuineWin) {
        triggerSiuuu()
      }
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [triggerSiuuu])

  // 3. Curated Scroll-Based Section Beats (IntersectionObserver with 500ms Debounce)
  useEffect(() => {
    const observerCallback = (entries) => {
      const visibleEntries = entries.filter((e) => e.isIntersecting)
      if (visibleEntries.length === 0) return

      // Sort by intersection ratio to find the primary focused section
      visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      const topTarget = visibleEntries[0].target
      const sectionId = topTarget.id
      if (!sectionId) return

      // Clear any pending scroll debounce timer
      if (scrollDebounceTimerRef.current) {
        clearTimeout(scrollDebounceTimerRef.current)
      }

      // 500ms calm debounce so fast scrolling never triggers erratic jumps
      scrollDebounceTimerRef.current = setTimeout(() => {
        if (isCelebratingRef.current) return

        const curated =
          SECTION_INSIGHTS[sectionId] ||
          SECTION_INSIGHTS[sectionId.replace('-leak', '')] ||
          SECTION_INSIGHTS[sectionId.replace('sprint-', '')] ||
          SECTION_INSIGHTS[sectionId.replace('overview-', '')]

        if (curated) {
          setIsThinking(true)
          setTimeout(() => {
            setIsThinking(false)
            setActiveThought({
              chip: curated.chip,
              text: mode === 'solution' ? curated.solution : curated.thought || curated.problem,
              emotion: curated.emotion || 'speaking',
            })
            setActiveSection(curated.id)
          }, 180)
        }
      }, 500)
    }

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-10% 0px -30% 0px',
      threshold: [0.15, 0.4, 0.7],
    })

    OBSERVED_SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => {
      observer.disconnect()
      if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current)
    }
  }, [mode, setActiveSection])

  // 4. Subtle, Dignified Cursor Gaze Tracking (<= 8deg tilt)
  const handleMouseMove = useCallback((e) => {
    if (!mascotContainerRef.current || isCelebratingRef.current) return
    const rect = mascotContainerRef.current.getBoundingClientRect()
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)

    gsap.to(mascotContainerRef.current, {
      rotationY: Math.max(-8, Math.min(8, dx * 8)),
      rotationX: Math.max(-6, Math.min(6, -dy * 6)),
      transformPerspective: 800,
      duration: 0.45,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  // Idle gentle breathing float
  useEffect(() => {
    if (!mascotContainerRef.current) return

    const tween = gsap.to(mascotContainerRef.current, {
      y: -5,
      duration: 2.4,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })

    return () => tween.kill()
  }, [])

  const handleLaunchChat = () => {
    const prompt =
      activeThought?.text || storeInsight?.chatPrompt || 'How can I fix my primary career bottleneck?'
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
    // If cloud is collapsed, clicking mascot restores the cloud
    if (cloudMinimized) {
      setCloudMinimized(false)
      return
    }
    handleLaunchChat()
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-40 pointer-events-none select-none print:hidden flex flex-col items-end"
      aria-label="Crafture Living Copilot Companion"
    >
      {/* ─── Animated Thinking Cloud (Only visible when chat is closed & cloud not minimized) ─── */}
      <AnimatePresence>
        {!isChatOpen && !cloudMinimized && (
          <motion.div
            key={`thought-cloud-${activeThought?.text || activeNodeId}`}
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.2 } }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="mb-1 w-[310px] sm:w-[330px] max-w-[340px] pointer-events-auto"
          >
            {/* Thought Bubbles / Rising Dots Trail (• -> ○ -> Cloud) */}
            <div className="flex flex-col items-end mr-12 mb-1 space-y-1">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.25, 1], opacity: 1 }}
                transition={{ delay: 0.04, duration: 0.28 }}
                className="w-2 h-2 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-2xs mr-3"
              />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.2, 1], opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.28 }}
                className="w-3 h-3 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xs mr-1"
              />
            </div>

            {/* Main Thought Cloud Card */}
            <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-4 shadow-xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden group">
              {/* Top Accent Line */}
              <div
                className="absolute top-0 left-0 right-0 h-1 transition-colors duration-400"
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
                    {currentChip}
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

                  {/* Clean Collapse (✕): Collapses only the cloud, keeping 3D mascot visible */}
                  <button
                    type="button"
                    onClick={() => setCloudMinimized(true)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label="Collapse thought cloud"
                    title="Collapse thought cloud"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Thought Body with Animated Transition */}
              <div className="min-h-[38px] flex items-center mb-3">
                {isThinking ? (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-[11px] font-mono text-slate-400 ml-1">Calibrating...</span>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                    {currentThoughtText}
                  </p>
                )}
              </div>

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
          title={isChatOpen ? 'Atlas Copilot Active' : cloudMinimized ? 'Click to restore thought cloud' : 'Click to consult Crafture Guide'}
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
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 text-[9px] font-bold font-mono tracking-tight shadow-md whitespace-nowrap pointer-events-none"
            >
              {cloudMinimized ? 'Expand Guide' : 'Ask Atlas'}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
