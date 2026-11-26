import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { getMascotPose, preloadMascotAssets } from '../../assets/mascot'
import {
  useReportGuideStore,
  EMOTION_PALETTES,
  GUIDE_EMOTIONS,
  SECTION_INSIGHTS,
} from '../../store/useReportGuideStore'
import { ArrowRight, X, MessageSquare } from 'lucide-react'
import useAppStore from '../../store/useAppStore'

const ASSESSMENT_STEP_TIPS = {
  resume: {
    chip: 'Resume Calibration',
    text: "Drop the resume you're taking into battle — we scan keywords, tech stack & experience in milliseconds.",
    emotion: 'speaking',
  },
  linkedin: {
    chip: 'Digital Coordinates',
    text: 'Your public LinkedIn profile lets us cross-reference your ATS keywords against live recruiter search queries.',
    emotion: 'listening',
  },
  visa: {
    chip: 'Work Perimeter',
    text: 'Recruiters filter by location and authorization — answering honestly calibrates your real outbound market size.',
    emotion: 'thinking',
  },
  targetRole: {
    chip: 'Target Coordinates',
    text: 'Be specific with your target title — it calibrates tier-1 salary bands and experience benchmarks.',
    emotion: 'speaking',
  },
  apps30d: {
    chip: 'Outbound Velocity',
    text: 'Application volume sets your funnel baseline — 30 to 60 applications per month is the typical healthy sweet spot.',
    emotion: 'thinking',
  },
  targetedMatchPct: {
    chip: 'Targeting Precision',
    text: 'Applying only to roles with an 80%+ qualification match yields 4x higher recruiter screen conversions.',
    emotion: 'thinking',
  },
  searchMethods: {
    chip: 'Sourcing Mix',
    text: 'Multi-channel hunters who combine referrals and direct recruiter outreach land offers 2.8x faster.',
    emotion: 'celebrating',
  },
  consultancy: {
    chip: 'Search Architecture',
    text: 'Staffing agencies and third-party consultancies operate differently than direct in-house recruitment.',
    emotion: 'listening',
  },
  outreach: {
    chip: 'Warm Channels',
    text: 'Reaching out to hiring managers and team engineers skips automated ATS resume screening entirely.',
    emotion: 'speaking',
  },
  funnel90d: {
    chip: 'Funnel Leak Audit',
    text: 'Knowing your 90-day screens and interview stages pinpoints the exact leak in your hiring pipeline.',
    emotion: 'surprised',
  },
  DropOffStage: {
    chip: 'Root Bottleneck',
    text: 'Pinpointing where drop-offs happen separates resume problems from interview delivery problems.',
    emotion: 'thinking',
  },
  biggestChallenge: {
    chip: 'Primary Obstacle',
    text: 'Every candidate has one primary roadblock. Isolating it lets our action plan focus on high-ROI fixes.',
    emotion: 'speaking',
  },
  alreadyTried: {
    chip: 'Past Iterations',
    text: 'Knowing what did not move the needle prevents us from suggesting strategies you have already exhausted.',
    emotion: 'listening',
  },
  frustration: {
    chip: 'Core Frustration',
    text: 'Job searching in 2026 is exhausting. We use this to customize your personalized 7-day recovery roadmap.',
    emotion: 'celebrating',
  },
}

// Main report sections observed for curated executive beats
const OBSERVED_SECTION_IDS = [
  // Tab 1 (Overview & Action Plan)
  'overview-pulse',
  'overview-bottleneck',
  'top-priorities',
  'funnel-leak',
  'sprint-roadmap',
  'next-action',

  // Tab 2 (Resume Lab)
  'resume-scorecard',
  'resume-audit',
  'resume-summary',
  'resume-keywords',
  'resume-bullets',
  'resume-defense',

  // Tab 3 (LinkedIn Studio)
  'linkedin-scorecard',
  'linkedin-audit',
  'linkedin-headlines',
  'linkedin-about',
  'linkedin-skills',
  'linkedin-crafture-network',
]

// Section to Choreography Mapping
const SECTION_TO_REACTION = {
  // 1. welcome_wave
  'overview-pulse': 'welcome_wave',

  // 2. alarm_double_take
  'overview-bottleneck': 'alarm_double_take',
  'funnel-leak': 'alarm_double_take',

  // 3. confident_nod
  'top-priorities': 'confident_nod',
  'sprint-roadmap': 'confident_nod',

  // 4. inspector_lean
  'resume-scorecard': 'inspector_lean',
  'resume-audit': 'inspector_lean',

  // 5. deep_think_rock
  'resume-summary': 'deep_think_rock',
  'resume-bullets': 'deep_think_rock',

  // 6. lightbulb_pop
  'resume-keywords': 'lightbulb_pop',
  'resume-defense': 'lightbulb_pop',

  // 7. swagger_bounce
  'linkedin-headlines': 'swagger_bounce',
  'linkedin-about': 'swagger_bounce',
  'linkedin-skills': 'swagger_bounce',
  'linkedin-crafture-network': 'swagger_bounce',
  'linkedin-scorecard': 'swagger_bounce',
  'linkedin-audit': 'swagger_bounce',

  // 8. call_invite_wave
  'next-action': 'call_invite_wave',
}

export default function CraftureLivingCopilot({
  activeTab = 'overview',
  context = 'report',
  currentStep = 0,
  step = null,
}) {
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

  const resumeAnalysis = useAppStore((s) => s.resumeAnalysis)
  const reportData = useAppStore((s) => s.reportData)
  const isAssessment = context === 'assessment'
  const prevResumeStatusRef = useRef(null)

  const mascotContainerRef = useRef(null)
  const isCelebratingRef = useRef(false)
  const scrollDebounceTimerRef = useRef(null)

  const [cloudMinimized, setCloudMinimized] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [activeThought, setActiveThought] = useState(null)
  const [isAsleep, setIsAsleep] = useState(false)
  const [isStageHovered, setIsStageHovered] = useState(false)

  // Preload all animated clips and pose assets for 0ms zero-flicker switching
  useEffect(() => {
    preloadMascotAssets()
  }, [])

  const isChoreographingRef = useRef(false)
  const choreoTimerRef = useRef(null)
  const inactivityTimerRef = useRef(null)

  // 15s Inactivity Sleep Tracker
  useEffect(() => {
    const resetInactivity = () => {
      setIsAsleep(false)
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
      inactivityTimerRef.current = setTimeout(() => {
        if (!isCelebratingRef.current && !isChatOpen) {
          setIsAsleep(true)
        }
      }, 15000)
    }

    resetInactivity()

    const events = ['mousemove', 'scroll', 'keydown', 'click', 'touchstart']
    events.forEach((ev) => window.addEventListener(ev, resetInactivity, { passive: true }))

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      events.forEach((ev) => window.removeEventListener(ev, resetInactivity))
    }
  }, [isChatOpen])

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
  const currentPalette = EMOTION_PALETTES[currentEmotion] || EMOTION_PALETTES.idle
  const accentColor = currentPalette.shell || '#6366F1'

  // Map state and active context directly to 14 WebP Mascot poses
  const activePose = useMemo(() => {
    if (isCelebrating) return 'thumbsup'

    // ── 1. Assessment Mode Context Mapping ──
    if (isAssessment) {
      const stepName = step?.name || (currentStep === 0 ? 'resume' : currentStep === 1 ? 'linkedin' : '')
      const resumeStatus = resumeAnalysis?.status

      if (stepName === 'resume' || currentStep === 0) {
        if (resumeStatus === 'completed') return 'happy'
        if (resumeStatus === 'error') return 'shocked'
        if (resumeStatus === 'analyzing') return 'reading'
        return 'reading'
      }

      if (stepName === 'apps30d' || stepName === 'funnel90d' || stepName === 'targetedMatchPct') {
        return 'chart'
      }

      if (stepName === 'linkedin') {
        return 'laptop'
      }

      // Diagnostic quiz questions
      if (
        stepName === 'targetRole' ||
        stepName === 'visa' ||
        stepName === 'DropOffStage' ||
        stepName === 'biggestChallenge' ||
        stepName === 'searchMethods' ||
        stepName === 'alreadyTried' ||
        stepName === 'consultancy' ||
        stepName === 'outreach'
      ) {
        return 'thinking'
      }

      return 'wave'
    }

    // ── 2. Report Mode Context Mapping ──
    const overallScore = reportData?.overall_score ?? reportData?.career_health_score ?? null
    const isCriticalLowScore = typeof overallScore === 'number' && overallScore < 50

    // Next Action / Strategy Call
    if (activeNodeId === 'next-action') {
      return overallScore && overallScore >= 75 ? 'happy' : 'thumbsup'
    }

    // Critical low-score alert
    if (isCriticalLowScore && (activeNodeId === 'overview-bottleneck' || currentEmotion === 'alert')) {
      return 'sad'
    }

    // Action Plan / Roadmap
    if (
      activeNodeId === 'sprint-roadmap' ||
      activeNodeId === 'top-priorities' ||
      activeNodeId === 'mission-board' ||
      activeNodeId?.includes('roadmap')
    ) {
      return 'roadmap'
    }

    // Resume Lab
    if (
      activeTab === 'resume' ||
      activeNodeId?.startsWith('resume-')
    ) {
      return 'clipboard'
    }

    // LinkedIn Studio
    if (
      activeTab === 'linkedin' ||
      activeNodeId?.startsWith('linkedin-')
    ) {
      return 'wave'
    }

    // Overview & Funnel
    if (
      activeTab === 'overview' ||
      activeNodeId === 'overview-pulse' ||
      activeNodeId === 'overview-bottleneck' ||
      activeNodeId === 'funnel-leak' ||
      activeNodeId === 'funnel-sankey' ||
      activeNodeId?.startsWith('funnel-')
    ) {
      return 'chart'
    }

    // Emotion fallbacks
    if (currentEmotion === 'victory' || currentEmotion === 'celebrating') return 'happy'
    if (currentEmotion === 'alert') return isCriticalLowScore ? 'sad' : 'angry'
    if (currentEmotion === 'surprised') return 'shocked'
    if (currentEmotion === 'sad') return 'sad'
    if (currentEmotion === 'thinking') return 'thinking'
    if (currentEmotion === 'listening') return 'clipboard'
    if (currentEmotion === 'speaking') return 'wave'

    return 'wave'
  }, [
    isCelebrating,
    isAssessment,
    step?.name,
    currentStep,
    resumeAnalysis?.status,
    activeNodeId,
    activeTab,
    currentEmotion,
    reportData,
  ])

  // Hover reaction: temporarily switch to wave (report) or point (assessment) on hover
  const currentMascotPose = useMemo(() => {
    if (isCelebrating) return 'thumbsup'
    if (isStageHovered) {
      return isAssessment ? 'point' : 'wave'
    }
    return activePose
  }, [isCelebrating, isStageHovered, isAssessment, activePose])

  const resolvedMascotSrc = useMemo(() => {
    return getMascotPose(currentMascotPose)
  }, [currentMascotPose])

  // 1. Ronaldo "SIUUU!" Celebration Animation (Reserved strictly for genuine wins)
  const triggerSiuuu = useCallback((customMsg = null) => {
    if (!mascotContainerRef.current) return

    isCelebratingRef.current = true
    setIsCelebrating(true)
    setCloudMinimized(false)
    setEmotion('victory')

    setActiveThought({
      chip: 'Milestone',
      text: customMsg || 'Milestone achieved: pipeline progress recorded.',
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

  // Assessment Mode: Step-aware guidance, tips, and live validation reactions
  useEffect(() => {
    if (!isAssessment) return

    const stepName = step?.name || (currentStep === 0 ? 'resume' : currentStep === 1 ? 'linkedin' : '')
    const resumeStatus = resumeAnalysis?.status

    if (stepName === 'resume' || currentStep === 0) {
      if (resumeStatus === 'completed') {
        setActiveThought({
          chip: 'Resume Calibrated 🎯',
          text: 'Tech stack, contact details, and role history successfully extracted! You can proceed.',
          emotion: 'victory',
        })
        if (prevResumeStatusRef.current !== 'completed') {
          triggerSiuuu('Resume calibrated: tech stack & experience extracted!')
        }
      } else if (resumeStatus === 'error') {
        setActiveThought({
          chip: 'Verification Failed ⚠️',
          text: resumeAnalysis?.error || 'Document does not look like a resume. Please upload a PDF or .docx file.',
          emotion: 'surprised',
        })
        if (mascotContainerRef.current && prevResumeStatusRef.current !== 'error') {
          gsap.timeline()
            .to(mascotContainerRef.current, { x: -7, rotation: -4, duration: 0.09, ease: 'power2.inOut' })
            .to(mascotContainerRef.current, { x: 7, rotation: 4, duration: 0.1, ease: 'power2.inOut' })
            .to(mascotContainerRef.current, { x: -5, rotation: -2, duration: 0.09, ease: 'power2.inOut' })
            .to(mascotContainerRef.current, { x: 0, rotation: 0, duration: 0.1, ease: 'power2.out' })
        }
      } else if (resumeStatus === 'analyzing') {
        setActiveThought({
          chip: 'Analyzing Resume...',
          text: 'Scanning text, tech stack, and contact links in real time...',
          emotion: 'thinking',
        })
      } else {
        const def = ASSESSMENT_STEP_TIPS.resume
        setActiveThought({
          chip: def.chip,
          text: def.text,
          emotion: def.emotion,
        })
      }
      prevResumeStatusRef.current = resumeStatus
      return
    }

    prevResumeStatusRef.current = resumeStatus
    const tip = ASSESSMENT_STEP_TIPS[stepName] || {
      chip: 'Step Guidance',
      text: step?.sublabel || 'Answer honestly to calibrate your personalized Career GPS benchmarks.',
      emotion: 'speaking',
    }

    setActiveThought({
      chip: tip.chip,
      text: tip.text,
      emotion: tip.emotion,
    })
  }, [isAssessment, step?.name, step?.sublabel, currentStep, resumeAnalysis?.status, resumeAnalysis?.error, triggerSiuuu])

  // 2. Explicit Click Reactions: Genuine Win Clicks or data-guide-msg handlers (Report Mode only)
  useEffect(() => {
    if (isAssessment) return

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
        'button, [role="button"], a, input[type="checkbox"], [data-trigger-win]'
      )
      if (!winBtn) return

      const btnText = `${winBtn.textContent || ''} ${winBtn.getAttribute('aria-label') || ''} ${winBtn.title || ''}`.toLowerCase()

      const isGenuineWin =
        winBtn.hasAttribute('data-trigger-win') ||
        btnText.includes('copy rewrite') ||
        btnText.includes('copy summary') ||
        btnText.includes('copy headline') ||
        btnText.includes('copy bullet') ||
        btnText.includes('weave') ||
        btnText.includes('download full report') ||
        btnText.includes('book free 1-on-1') ||
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

  const lastAnimatedCategoryRef = useRef(null)

  // Trigger Section Reaction with Tween Isolation and QuickTo Pause
  const triggerSectionReaction = useCallback((sectionId) => {
    if (!mascotContainerRef.current || isCelebratingRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const reactionKey = SECTION_TO_REACTION[sectionId] || 'welcome_wave'
    if (lastAnimatedCategoryRef.current === reactionKey) return
    lastAnimatedCategoryRef.current = reactionKey

    // Clean Isolation: Kill previous section-reaction tweens
    gsap.killTweensOf(mascotContainerRef.current)

    // Pause quickTo cursor gaze for 550ms
    isChoreographingRef.current = true
    if (choreoTimerRef.current) clearTimeout(choreoTimerRef.current)
    choreoTimerRef.current = setTimeout(() => {
      isChoreographingRef.current = false
    }, 550)

    switch (reactionKey) {
      case 'welcome_wave':
        // overview-pulse: Gentle welcome bow + double-tilt
        gsap.timeline()
          .to(mascotContainerRef.current, { y: -4, rotation: -6, duration: 0.22, ease: 'power2.out' })
          .to(mascotContainerRef.current, { rotation: 6, duration: 0.2, ease: 'power1.inOut' })
          .to(mascotContainerRef.current, { y: 0, rotation: -3, duration: 0.18, ease: 'power1.inOut' })
          .to(mascotContainerRef.current, { rotation: 0, duration: 0.15, ease: 'power2.out' })
        break

      case 'alarm_double_take':
        // overview-bottleneck & funnel-leak: Crisp alert shake
        gsap.timeline()
          .to(mascotContainerRef.current, { x: -7, rotation: -4, duration: 0.09, ease: 'power2.inOut' })
          .to(mascotContainerRef.current, { x: 7, rotation: 4, duration: 0.1, ease: 'power2.inOut' })
          .to(mascotContainerRef.current, { x: -5, rotation: -2, duration: 0.09, ease: 'power2.inOut' })
          .to(mascotContainerRef.current, { x: 5, rotation: 2, duration: 0.08, ease: 'power2.inOut' })
          .to(mascotContainerRef.current, { x: 0, rotation: 0, duration: 0.1, ease: 'power2.out' })
        break

      case 'confident_nod':
        // top-priorities & sprint-roadmap: Double executive nod
        gsap.timeline()
          .to(mascotContainerRef.current, { rotationX: 14, y: 3, duration: 0.16, ease: 'power2.out' })
          .to(mascotContainerRef.current, { rotationX: 0, y: 0, duration: 0.14, ease: 'power2.in' })
          .to(mascotContainerRef.current, { rotationX: 12, y: 2, duration: 0.14, ease: 'power2.out' })
          .to(mascotContainerRef.current, { rotationX: 0, y: 0, duration: 0.14, ease: 'power2.in' })
        break

      case 'inspector_lean':
        // resume-scorecard & resume-audit: Forward zoom-in inspect
        gsap.timeline()
          .to(mascotContainerRef.current, { scale: 1.08, rotationY: -12, y: -4, duration: 0.32, ease: 'power2.out' })
          .to(mascotContainerRef.current, { scale: 1, rotationY: 0, y: 0, duration: 0.35, ease: 'power2.inOut', delay: 1.1 })
        break

      case 'deep_think_rock':
        // resume-summary & resume-bullets: Thoughtful tilt & subtle float
        gsap.timeline()
          .to(mascotContainerRef.current, { rotation: -6, y: -5, duration: 0.3, ease: 'power2.out' })
          .to(mascotContainerRef.current, { rotation: 0, y: 0, duration: 0.35, ease: 'power2.inOut', delay: 1.1 })
        break

      case 'lightbulb_pop':
        // resume-keywords & resume-defense: Crisp upward "aha" pop
        gsap.timeline()
          .to(mascotContainerRef.current, { y: -11, scale: 1.09, duration: 0.22, ease: 'power2.out' })
          .to(mascotContainerRef.current, { y: 0, scale: 1, duration: 0.28, ease: 'bounce.out' })
        break

      case 'swagger_bounce':
        // linkedin-headlines, linkedin-about, linkedin-crafture-network, etc.: Confident double-hop + side turn
        gsap.timeline()
          .to(mascotContainerRef.current, { y: -9, rotationY: 14, duration: 0.2, ease: 'power2.out' })
          .to(mascotContainerRef.current, { y: 0, duration: 0.16, ease: 'power2.in' })
          .to(mascotContainerRef.current, { y: -5, rotationY: 0, duration: 0.14, ease: 'power2.out' })
          .to(mascotContainerRef.current, { y: 0, duration: 0.18, ease: 'bounce.out' })
        break

      case 'call_invite_wave':
        // next-action: Warm welcoming wave-tilt
        gsap.timeline()
          .to(mascotContainerRef.current, { y: -6, rotation: -9, duration: 0.22, ease: 'power2.out' })
          .to(mascotContainerRef.current, { rotation: 7, duration: 0.18, ease: 'power1.inOut' })
          .to(mascotContainerRef.current, { rotation: -4, duration: 0.15, ease: 'power1.inOut' })
          .to(mascotContainerRef.current, { y: 0, rotation: 0, duration: 0.2, ease: 'power2.out' })
        break

      default:
        break
    }
  }, [])

  // 3. Curated Scroll-Based Section Beats (IntersectionObserver with 500ms Debounce)
  useEffect(() => {
    if (isAssessment) return

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
          triggerSectionReaction(sectionId)
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

    let observer = null
    const timer = setTimeout(() => {
      observer = new IntersectionObserver(observerCallback, {
        root: null,
        rootMargin: '-20% 0px -40% 0px',
        threshold: [0.05, 0.1, 0.25],
      })

      OBSERVED_SECTION_IDS.forEach((id) => {
        const el = document.getElementById(id)
        if (el) observer.observe(el)
      })
    }, 140)

    return () => {
      clearTimeout(timer)
      if (observer) observer.disconnect()
      if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current)
    }
  }, [activeTab, mode, setActiveSection, triggerSectionReaction])

  // 4. Subtle, Smooth Cursor Gaze Tracking via gsap.quickTo (Respects prefers-reduced-motion)
  useEffect(() => {
    if (!mascotContainerRef.current) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const rotYTo = gsap.quickTo(mascotContainerRef.current, 'rotationY', {
      duration: 0.45,
      ease: 'power3.out',
    })
    const rotXTo = gsap.quickTo(mascotContainerRef.current, 'rotationX', {
      duration: 0.45,
      ease: 'power3.out',
    })
    const xTo = gsap.quickTo(mascotContainerRef.current, 'x', {
      duration: 0.45,
      ease: 'power3.out',
    })
    const yTo = gsap.quickTo(mascotContainerRef.current, 'y', {
      duration: 0.45,
      ease: 'power3.out',
    })

    gsap.set(mascotContainerRef.current, { transformPerspective: 700 })

    const handleMouseMove = (e) => {
      if (window.innerWidth < 640 || !mascotContainerRef.current || isCelebratingRef.current || isChoreographingRef.current || isAsleep) return

      const rect = mascotContainerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const dx = (e.clientX - centerX) / (window.innerWidth / 2)
      const dy = (e.clientY - centerY) / (window.innerHeight / 2)

      const clampedX = Math.max(-1, Math.min(1, dx))
      const clampedY = Math.max(-1, Math.min(1, dy))

      rotYTo(clampedX * 10)
      rotXTo(-clampedY * 8)
      xTo(clampedX * 4)
      yTo(clampedY * 4)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isAsleep])

  // 5. Purposeful [data-mascot-cue] Hover Reactions (350ms Debounced, Zero Spam)
  const hoverTimerRef = useRef(null)
  const revertTimerRef = useRef(null)

  useEffect(() => {
    const handleMouseOver = (e) => {
      const cueEl = e.target.closest('[data-mascot-cue]')
      if (!cueEl) return

      if (revertTimerRef.current) {
        clearTimeout(revertTimerRef.current)
        revertTimerRef.current = null
      }

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }

      hoverTimerRef.current = setTimeout(() => {
        if (cloudMinimized || isCelebratingRef.current) return

        const chip = cueEl.dataset.mascotChip || 'Focus Finding'
        const cue = cueEl.dataset.mascotCue || ''
        const emotion = cueEl.dataset.mascotEmotion || 'thinking'

        if (cue) {
          setIsThinking(true)
          setTimeout(() => {
            setIsThinking(false)
            setActiveThought({
              chip,
              text: cue,
              emotion,
            })
          }, 150)
        }
      }, 350)
    }

    const handleMouseOut = (e) => {
      const cueEl = e.target.closest('[data-mascot-cue]')
      if (!cueEl) return

      if (e.relatedTarget && cueEl.contains(e.relatedTarget)) return

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }

      revertTimerRef.current = setTimeout(() => {
        if (isCelebratingRef.current) return
        setActiveThought(null)
      }, 450)
    }

    document.addEventListener('mouseover', handleMouseOver, true)
    document.addEventListener('mouseout', handleMouseOut, true)

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true)
      document.removeEventListener('mouseout', handleMouseOut, true)
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current)
    }
  }, [cloudMinimized])

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

  // Tactile Clicks: Single-click (open cloud or toggle mode), Double-click (celebrate)
  const clickTimeoutRef = useRef(null)

  const handleMascotClick = (e) => {
    e.stopPropagation()
    if (isCelebratingRef.current) return

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
      triggerSiuuu('Milestone unlocked: celebratory surge!')
      return
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null
      // Direct click/tap opens Atlas Chatbot
      handleLaunchChat()
    }, 240)
  }

  const handleMascotDoubleClick = (e) => {
    e.stopPropagation()
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
    triggerSiuuu('Milestone unlocked: copilot energized!')
  }

  return (
    <div
      className={`fixed ${isAssessment ? 'bottom-16 right-3 sm:bottom-6 sm:right-6' : 'bottom-16 right-3 sm:bottom-20 sm:right-6'} z-40 pointer-events-none select-none print:hidden flex flex-col items-end max-w-[calc(100vw-1.5rem)]`}
      aria-label="Crafture Living Copilot Companion"
    >
      {/* ─── Studio-Grade Forest Green Mascot (Locked 148px x 148px / mobile 112px x 112px) ─── */}
      <div className="relative pointer-events-auto flex flex-col items-center origin-bottom-right">
        {/* Mascot Click Area & Locked Stage */}
        <div
          ref={mascotContainerRef}
          onClick={handleMascotClick}
          onDoubleClick={handleMascotDoubleClick}
          onMouseEnter={() => setIsStageHovered(true)}
          onMouseLeave={() => setIsStageHovered(false)}
          className="relative w-[112px] h-[112px] sm:w-[148px] sm:h-[148px] flex items-center justify-center cursor-pointer select-none group/mascot"
          title="Click to chat with Atlas"
        >
          {/* Tight radial-gradient elliptical floor shadow underneath */}
          <div
            className="absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 w-16 sm:w-24 h-2.5 sm:h-3.5 rounded-full pointer-events-none transition-all duration-300"
            style={{
              transform: `translateX(-50%) scale(${
                isCelebrating ? 0.65 : isStageHovered ? 1.08 : 1
              })`,
              opacity: isCelebrating ? 0.15 : isStageHovered ? 0.45 : 0.35,
              background:
                'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.32) 0%, rgba(15, 23, 42, 0.12) 48%, transparent 72%)',
            }}
          />

          {/* Interactive Studio Mascot with Spring Scale on Hover and 0.18s crossfade */}
          <motion.div
            className="relative w-full h-full flex items-center justify-center will-change-transform"
            animate={{
              scale: isStageHovered && !isCelebrating ? 1.06 : 1,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={resolvedMascotSrc}
                src={resolvedMascotSrc}
                alt="Crafture Executive Mascot"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="w-full h-full object-contain filter drop-shadow-sm select-none pointer-events-none"
                loading="eager"
                decoding="async"
              />
            </AnimatePresence>
          </motion.div>

          {/* Minimal Floating Indicator Badge on hover */}
          {!isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              whileHover={{ opacity: 1, y: 0 }}
              className="absolute -bottom-1 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 px-2.5 py-0.5 rounded-md bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 text-xs font-mono tracking-tight shadow-md whitespace-nowrap pointer-events-none z-20"
            >
              {isAsleep ? 'Paused — scroll or hover to wake' : 'Consult Atlas'}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
