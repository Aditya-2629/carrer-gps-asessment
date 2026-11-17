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
    isChatOpen,
    setMode,
    openChat,
    setActiveSection,
    triggerGuide,
    setEmotion,
  } = useReportGuideStore()

  const wrapperRef = useRef(null)
  const mascotContainerRef = useRef(null)
  const idleTimerRef = useRef(null)
  const lastHoverTimeRef = useRef(0)
  const thinkingTimerRef = useRef(null)
  const isCelebratingRef = useRef(false)

  const [isCloudDismissed, setIsCloudDismissed] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [activeThought, setActiveThought] = useState(null)

  // Default dock position: bottom-right inside viewport
  const getDefaultDock = useCallback(() => {
    if (typeof window === 'undefined') return { x: 800, y: 600 }
    return {
      x: Math.max(16, window.innerWidth - 240),
      y: Math.max(80, window.innerHeight - 250),
    }
  }, [])

  // Current fallback insight from store
  const storeInsight = useMemo(() => {
    return SECTION_INSIGHTS[activeNodeId] || SECTION_INSIGHTS['overview-pulse']
  }, [activeNodeId])

  // Resolve current active thought text, chip, and accent
  const currentChip = activeThought?.chip || metricChip || storeInsight?.chip || 'Crafture Guide'
  const currentThoughtText =
    activeThought?.text ||
    headline ||
    (mode === 'solution' ? storeInsight?.solution : storeInsight?.problem)

  const currentEmotion = activeThought?.emotion || emotion || 'idle'
  const wobnimoState = isCelebrating ? 'celebrating' : EMOTION_TO_WOBNIMO[currentEmotion] || 'idle'
  const currentPalette = EMOTION_PALETTES[currentEmotion] || EMOTION_PALETTES.idle
  const accentColor = currentPalette.shell || '#6366F1'

  // Smooth GSAP Roaming Helper
  const moveTo = useCallback((targetX, targetY, duration = 0.55) => {
    if (!wrapperRef.current) return
    gsap.to(wrapperRef.current, {
      x: targetX,
      y: targetY,
      duration,
      ease: 'power3.out',
      overwrite: 'auto',
    })
  }, [])

  // Return to default dock helper
  const returnToDefaultDock = useCallback(
    (duration = 0.75) => {
      const dock = getDefaultDock()
      moveTo(dock.x, dock.y, duration)
    },
    [getDefaultDock, moveTo]
  )

  // 1. Initialize mascot at default dock on mount and handle window resize
  useEffect(() => {
    const dock = getDefaultDock()
    if (wrapperRef.current) {
      gsap.set(wrapperRef.current, { x: dock.x, y: dock.y })
    }

    const handleResize = () => {
      returnToDefaultDock(0.4)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [getDefaultDock, returnToDefaultDock])

  // 2. Ronaldo "SIUUU!" Celebration Animation
  const playRonaldoSiuuu = useCallback(() => {
    if (!mascotContainerRef.current) return

    isCelebratingRef.current = true
    setIsCelebrating(true)
    setIsCloudDismissed(false)
    setEmotion('victory')

    setActiveThought({
      chip: 'SIUUU! 🚀',
      text: 'SIUUU! Milestone achieved — pipeline momentum unlocked! 🏆',
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
      playRonaldoSiuuu()
    }
  }, [emotion, playRonaldoSiuuu])

  // 3. Screen-Wide Click Listener for Celebration Triggers (Copy, Weave, Checkbox, Simulate)
  useEffect(() => {
    const handleDocumentClick = (e) => {
      const btn = e.target.closest(
        'button, [role="button"], input[type="checkbox"], [data-trigger-win]'
      )
      if (!btn) return

      const text = `${btn.textContent || ''} ${btn.getAttribute('aria-label') || ''} ${btn.className || ''}`.toLowerCase()
      const isWinTrigger =
        text.includes('copy') ||
        text.includes('copied') ||
        text.includes('weave') ||
        text.includes('check in') ||
        text.includes('advance to next day') ||
        text.includes('lock in') ||
        text.includes('simulate') ||
        text.includes('done') ||
        btn.type === 'checkbox' ||
        btn.hasAttribute('data-trigger-win')

      if (isWinTrigger) {
        playRonaldoSiuuu()
      }
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [playRonaldoSiuuu])

  // 4. Smart Screen-Wide Hover Listener (document.addEventListener('mouseover', ...))
  useEffect(() => {
    const handleMouseOver = (e) => {
      if (isCelebratingRef.current) return

      const now = Date.now()
      if (now - lastHoverTimeRef.current < 220) return
      lastHoverTimeRef.current = now

      const target = e.target
      if (!target) return

      // Ignore mascot itself or chatbot drawer
      if (
        wrapperRef.current?.contains(target) ||
        target.closest('#report-chatbot, .report-chatbot')
      ) {
        return
      }

      // Find closest meaningful card or row
      const card = target.closest(
        '[data-guide-msg], section, [class*="rounded-2xl"], [class*="rounded-xl"], [class*="rounded-3xl"], tr, li'
      )
      if (!card) return

      // Ignore huge root wrappers
      if (card.offsetWidth > window.innerWidth * 0.96 && card.offsetHeight > window.innerHeight * 0.9) {
        return
      }

      const rect = card.getBoundingClientRect()
      if (rect.width < 80 || rect.height < 40) return

      // Compute safe coordinates beside the card
      const MASCOT_WIDTH = 230
      const MASCOT_HEIGHT = 250
      const PADDING = 16

      let targetX = rect.right + PADDING
      let targetY = rect.top + Math.min(30, rect.height * 0.15)

      // If it overflows right edge of screen, place on left of card
      if (targetX + MASCOT_WIDTH > window.innerWidth - PADDING) {
        targetX = rect.left - MASCOT_WIDTH - PADDING
      }

      // If it still overflows left or right, dock neatly to the right gutter of viewport
      if (targetX < PADDING || targetX + MASCOT_WIDTH > window.innerWidth - PADDING) {
        targetX = window.innerWidth - MASCOT_WIDTH - PADDING
      }

      // Clamp coordinates securely inside viewport
      targetX = Math.max(PADDING, Math.min(targetX, window.innerWidth - MASCOT_WIDTH - PADDING))
      targetY = Math.max(75, Math.min(targetY, window.innerHeight - MASCOT_HEIGHT - PADDING))

      // Nudge if too close to mouse cursor
      const distToCursorX = Math.abs(e.clientX - (targetX + MASCOT_WIDTH / 2))
      const distToCursorY = Math.abs(e.clientY - (targetY + MASCOT_HEIGHT / 2))
      if (distToCursorX < 90 && distToCursorY < 90) {
        if (e.clientX > window.innerWidth / 2) {
          targetX = Math.max(PADDING, targetX - 110)
        } else {
          targetX = Math.min(window.innerWidth - MASCOT_WIDTH - PADDING, targetX + 110)
        }
      }

      // Glide smoothly to target coordinates
      moveTo(targetX, targetY, 0.55)

      // Reset idle timer to dock after 3.8s of no card interactions
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        if (!isCelebratingRef.current) {
          returnToDefaultDock(0.75)
        }
      }, 3800)

      // Derive smart insight from card content
      const explicitMsg = card.getAttribute('data-guide-msg')
      const headingEl = card.querySelector(
        'h1, h2, h3, h4, h5, [class*="font-bold"], [class*="font-black"], th'
      )
      const headingText = headingEl
        ? headingEl.textContent.trim().replace(/\s+/g, ' ').slice(0, 38)
        : ''
      const cardText = card.textContent || ''

      let derivedEmotion = 'thinking'
      let derivedThought = ''
      let derivedChip = 'Diagnostic'

      if (explicitMsg) {
        derivedThought = explicitMsg
        derivedEmotion = 'thinking'
        derivedChip = 'Inspection'
      } else if (
        /27\/100|Grade F|Dropped|Stuck|Phase [123]|0%|Dormant|Critical|Missing|Hurting|Leak/i.test(
          cardText
        )
      ) {
        derivedEmotion = 'listening'
        derivedThought = `⚠️ Bottleneck spotted in ${headingText || 'this section'} — click to see the fix.`
        derivedChip = 'Bottleneck Alert'
      } else if (
        /Stranded|4\.4%|Benchmark|Checklist|Skills|58%|Warning|Compare|Triage/i.test(cardText)
      ) {
        derivedEmotion = 'thinking'
        derivedThought = `🤔 Inspecting ${headingText || 'this metric'} — optimizing this lifts your callback rate.`
        derivedChip = 'Metric Analysis'
      } else if (/93|100|Hooked|Verified|Strong|Pass|Offers/i.test(cardText)) {
        derivedEmotion = 'celebrating'
        derivedThought = `✨ Strong signal in ${headingText || 'this section'}!`
        derivedChip = 'High Performance'
      } else if (headingText) {
        derivedEmotion = 'thinking'
        derivedThought = `💡 Reviewing ${headingText} — click to ask Atlas.`
        derivedChip = 'Section Guide'
      } else {
        return // Skip non-descriptive elements
      }

      // Animate Thinking Cloud: brief 220ms thinking indicator before revealing
      setIsThinking(true)
      setIsCloudDismissed(false)
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current)
      thinkingTimerRef.current = setTimeout(() => {
        setIsThinking(false)
        setActiveThought({
          chip: derivedChip,
          text: derivedThought,
          emotion: derivedEmotion,
        })
      }, 220)
    }

    document.addEventListener('mouseover', handleMouseOver, true)
    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current)
    }
  }, [moveTo, returnToDefaultDock])

  // 5. Section Scroll Tracking (IntersectionObserver fallback)
  useEffect(() => {
    const observerCallback = (entries) => {
      const visibleEntries = entries.filter((e) => e.isIntersecting)
      if (visibleEntries.length > 0) {
        visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const activeTarget = visibleEntries[0].target
        const sectionId = activeTarget.id
        if (sectionId && sectionId !== activeNodeId) {
          setActiveSection(sectionId)
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

  // 6. Subtle Cursor Gaze/Tilt on Pointermove
  const handleMouseMove = useCallback(
    (e) => {
      if (!mascotContainerRef.current || isCelebratingRef.current) return
      const rect = mascotContainerRef.current.getBoundingClientRect()
      const dx = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)
      const dy = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)

      gsap.to(mascotContainerRef.current, {
        rotationY: Math.max(-18, Math.min(18, dx * 18)),
        rotationX: Math.max(-12, Math.min(12, -dy * 14)),
        transformPerspective: 800,
        duration: 0.3,
        ease: 'power1.out',
        overwrite: 'auto',
      })
    },
    []
  )

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  // Idle gentle breathing float
  useEffect(() => {
    if (!mascotContainerRef.current) return

    const tween = gsap.to(mascotContainerRef.current, {
      y: -5,
      duration: 2.2,
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
    handleLaunchChat()
  }

  return (
    <div
      ref={wrapperRef}
      className="fixed top-0 left-0 z-50 pointer-events-none select-none print:hidden flex flex-col items-end will-change-transform"
      style={{
        transform: `translate3d(${getDefaultDock().x}px, ${getDefaultDock().y}px, 0)`,
      }}
      aria-label="Crafture Living Copilot Companion"
    >
      {/* ─── Animated Thinking Cloud (Only visible when chat is closed & not dismissed) ─── */}
      <AnimatePresence>
        {!isChatOpen && !isCloudDismissed && (
          <motion.div
            key={`thought-cloud-${activeThought?.text || activeNodeId}`}
            initial={{ opacity: 0, scale: 0.88, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="mb-1 max-w-[310px] sm:max-w-[340px] pointer-events-auto"
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

              {/* Thought Body with Animated Transition */}
              <div className="min-h-[38px] flex items-center mb-3">
                {isThinking ? (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-[11px] font-mono text-slate-400 ml-1">Analyzing...</span>
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
