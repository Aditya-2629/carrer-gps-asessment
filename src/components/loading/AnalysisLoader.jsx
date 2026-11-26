/**
 * AnalysisLoader v2 — the Phase C showpiece.
 *
 * Instead of a spinner with fake messages, the candidate watches their actual
 * agent team work (SSE-streamed, real progress): Resume Agent → LinkedIn Agent
 * → Atlas, each with a live status, above shape-matched skeletons of the
 * report sections that are about to fill in.
 *
 * Best practices applied (2026 AI loading-UX): feedback matched to wait time,
 * skeletons shaped like the incoming output, transparent "thinking" states,
 * perceived performance via motion (framer-motion), prefers-reduced-motion
 * respected.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { WarningCircle, ArrowLeft, FileText, LinkedinLogo, Compass, Check, Sparkle, ChartBar, Clock, MagnifyingGlass, Target, TrendUp } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { api, normalizeReportData } from '../../lib/api'
import { navigateTo } from '../../lib/navigation'
import brandLogo from '../../assets/images/crafture-logo.jpg'
import CraftureAnimatedMascot from '../common/CraftureAnimatedMascot'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Module-level in-flight job map keyed by userId:
// Prevents React.StrictMode double-mounts from canceling or swallowing the job creation promise.
const inflightJobByUser = new Map()

// ── Agent pipeline model ─────────────────────────────────────────────────────
const AGENT_NODES = [
  { id: 'resume', shortLabel: 'Resume & ATS', label: '1. Resume & ATS', hint: 'Auditing bullets & ATS parsing', icon: FileText },
  { id: 'linkedin', shortLabel: 'LinkedIn & JDs', label: '2. LinkedIn & Market JDs', hint: 'Benchmarking against live Market JDs', icon: LinkedinLogo },
  { id: 'overall', shortLabel: 'GPS Synthesis', label: '3. Career GPS Synthesis', hint: 'Building 30/60/90 roadmap', icon: Compass },
]

const CAREER_INSIGHTS = [
  {
    icon: ChartBar,
    stat: 'Quantified Impact',
    text: 'Top 10% engineering resumes quantify outcomes on >= 65% of bullets, doubling recruiter callback rates.',
  },
  {
    icon: Clock,
    stat: '7.4s Recruiter Scan',
    text: 'Recruiters spend 7.4s on initial resume scans — clear positioning and hard metrics win the first glance.',
  },
  {
    icon: MagnifyingGlass,
    stat: 'Market JD Alignment',
    text: 'Benchmarking bullets against live Market JDs surfaces the exact missing keywords ATS filters look for.',
  },
  {
    icon: Target,
    stat: 'LinkedIn SEO',
    text: 'Profiles with 5+ target role keywords in headlines and skills receive up to 3.8x more recruiter InMails.',
  },
  {
    icon: TrendUp,
    stat: 'Executive Storytelling',
    text: 'Bridging system architecture trade-offs with measurable business ROI accelerates final-round conversion.',
  },
]

function mapEventToState(stage, agent, message) {
  if (!stage) return null
  const s = String(stage).toLowerCase()
  const a = String(agent || '').toLowerCase()

  // Terminal report event: all agents complete
  if (s === 'report_ready') {
    return [
      { agent: 'resume', state: 'done' },
      { agent: 'linkedin', state: 'done' },
      { agent: 'overall', state: 'done' },
    ]
  }

  // Job failed event
  if (s === 'job_failed' || (s.includes('error') && (a === 'all' || !a))) {
    return [
      { agent: 'resume', state: 'error' },
      { agent: 'linkedin', state: 'error' },
      { agent: 'overall', state: 'error' },
    ]
  }

  // Multi-agent trigger events: start all 3 agents immediately in WORKING state
  if (s === 'agents_running' || s === 'preparing' || s === 'job_started' || a === 'all') {
    return [
      { agent: 'resume', state: 'working' },
      { agent: 'linkedin', state: 'working' },
      { agent: 'overall', state: 'working' },
    ]
  }

  // CRITICAL: apify_done is ONLY the background profile scrape completing.
  // It MUST NOT mark LinkedIn as 'done'; LinkedIn synthesis is still working.
  if (s === 'apify_done' || s === 'apify_started') {
    return { agent: 'linkedin', state: 'working' }
  }

  // Resolve target agent from agent parameter or stage name
  let targetAgent = null
  if (a === 'resume' || s.includes('resume')) targetAgent = 'resume'
  else if (a === 'linkedin' || s.includes('linkedin') || s.includes('apify') || s.includes('cross_audit')) targetAgent = 'linkedin'
  else if (a === 'overall' || a === 'atlas' || s.includes('overall') || s.includes('atlas') || s.includes('action_plan') || s.includes('composing')) targetAgent = 'overall'

  if (!targetAgent) {
    const m = stage.match(/^agent_([a-z]+)_agent_(\w+)$/)
    if (m) {
      targetAgent = m[1] === 'atlas' ? 'overall' : m[1]
      return { agent: targetAgent, state: m[2] === 'done' ? 'done' : m[2] === 'error' ? 'error' : 'working' }
    }
    return null
  }

  // Determine state for target agent
  if (s === 'agent_done' || s.endsWith('_done') || s.endsWith('_complete') || s === 'cache_hit') {
    return { agent: targetAgent, state: 'done' }
  }
  if (s === 'agent_error' || s.includes('failed') || s.includes('error')) {
    return { agent: targetAgent, state: 'error' }
  }
  return { agent: targetAgent, state: 'working' }
}

export default function AnalysisLoader() {
  const { userId, formData, setReportData, setPhase } = useAppStore()
  const [errorMessage, setErrorMessage] = useState(null)
  const [jobStarted, setJobStarted] = useState(false)
  const [agentStates, setAgentStates] = useState({ resume: 'working', linkedin: 'working', overall: 'working' })
  const [agentLogs, setAgentLogs] = useState({
    resume: 'Parsing structure & auditing bullet points…',
    linkedin: 'Auditing profile visibility & public records…',
    overall: 'Synthesizing 7-day recruiter playbook…',
  })
  const [liveMessages, setLiveMessages] = useState([])
  const [elapsedSecs, setElapsedSecs] = useState(0)
  const [insightIndex, setInsightIndex] = useState(0)
  const [isCompleteMorph, setIsCompleteMorph] = useState(false)
  const redirectedRef = useRef(false)
  const sourceRef = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSecs((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setInsightIndex((i) => (i + 1) % CAREER_INSIGHTS.length)
    }, 6500)
    return () => clearInterval(timer)
  }, [])

  const currentInsight = CAREER_INSIGHTS[insightIndex]

  const handleReport = (report) => {
    if (!report || redirectedRef.current) return
    redirectedRef.current = true
    if (userId) inflightJobByUser.delete(userId)
    setAgentStates({ resume: 'done', linkedin: 'done', overall: 'done' })
    setIsCompleteMorph(true)
    const normalized = normalizeReportData(report)
    setTimeout(() => {
      setReportData(normalized)
      setPhase(PHASES.REPORT)
      navigateTo('/report')
      if (typeof window !== 'undefined' && window.location.pathname !== '/report') {
        window.history.pushState(null, '', '/report')
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    }, reduceMotion ? 60 : 420)
  }

  const applyEvent = (event) => {
    if (!event?.stage) return
    const stage = event.stage
    const agent = event.agent
    const message = event.message || ''

    if (message) {
      setLiveMessages((m) => {
        const entry = {
          text: message,
          stage,
          agent: agent || 'all',
          at: event.at || new Date().toISOString(),
        }
        return [...m.slice(-11), entry]
      })
    }

    // Update per-agent live status logs
    if (agent && agent !== 'all' && message) {
      const normalizedAgent = (agent === 'atlas' ? 'overall' : agent).toLowerCase()
      if (['resume', 'linkedin', 'overall'].includes(normalizedAgent)) {
        setAgentLogs((prev) => ({ ...prev, [normalizedAgent]: message }))
      }
    } else if ((agent === 'all' || stage === 'agents_running' || stage === 'preparing') && message) {
      setAgentLogs((prev) => ({
        resume: prev.resume || message,
        linkedin: prev.linkedin || message,
        overall: prev.overall || message,
      }))
    }

    const updates = mapEventToState(stage, agent, message)
    if (updates) {
      if (Array.isArray(updates)) {
        setAgentStates((s) => {
          const next = { ...s }
          for (const u of updates) {
            if (next[u.agent] !== 'done' || u.state === 'done') {
              next[u.agent] = u.state
            }
          }
          return next
        })
      } else if (updates.agent) {
        setAgentStates((s) => {
          if (s[updates.agent] === 'done' && updates.state === 'working') return s
          return { ...s, [updates.agent]: updates.state }
        })
      }
    }

    if (stage === 'report_ready' && event.report) {
      handleReport(event.report)
    }
    if (stage === 'job_failed') {
      setErrorMessage(event.message || 'Report generation failed. Please try again.')
    }
  }

  // ── Start job + subscribe ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || window.location.search.includes('preview=true') || window.location.search.includes('mock=true')) return

    let pollTimer = null
    let active = true

    const userEmail = formData?.email || formData?.step1?.email || null

    let currentJobId = null

    const startPolling = (jobId) => {
      if (jobId) currentJobId = jobId
      if (pollTimer) return
      pollTimer = setInterval(async () => {
        if (!active || redirectedRef.current) {
          if (pollTimer) clearInterval(pollTimer)
          return
        }

        // 1. Check report-job status via poll endpoint
        if (currentJobId) {
          try {
            const job = await api.getReportJob(currentJobId)
            if (!active || redirectedRef.current) return
            for (const ev of job.events || []) applyEvent(ev)
            if (job.status === 'done' && job.aiReport) {
              handleReport(job.aiReport)
              if (pollTimer) clearInterval(pollTimer)
              return
            }
            if (job.status === 'failed') {
              setErrorMessage(job.error || 'Generation failed.')
              if (pollTimer) clearInterval(pollTimer)
              return
            }
          } catch (_e) {
            /* keep polling */
          }
        }

        // 2. Parallel fallback: check user's saved aiReport directly in MongoDB
        try {
          const savedReport = await api.getReport({ userId, email: userEmail })
          if (savedReport && active && !redirectedRef.current) {
            handleReport(savedReport)
            if (pollTimer) clearInterval(pollTimer)
            return
          }
        } catch (_e) {
          /* keep polling */
        }
      }, 2500)
    }

    // Start polling immediately in parallel with job creation / SSE
    startPolling(null)

    // Immediate check in case report was already generated previously or in background
    api
      .getReport({ userId, email: userEmail })
      .then((existingReport) => {
        if (existingReport && active && !redirectedRef.current) {
          handleReport(existingReport)
        }
      })
      .catch(() => {})

    // Share exact same in-flight job promise across React.StrictMode double-mounts
    let jobPromise = inflightJobByUser.get(userId)
    if (!jobPromise) {
      jobPromise = api.startReportJob({ userId, formData }).catch((err) => {
        inflightJobByUser.delete(userId)
        throw err
      })
      inflightJobByUser.set(userId, jobPromise)
    }

    jobPromise
      .then(({ jobId }) => {
        if (!active || redirectedRef.current) return
        setJobStarted(true)

        // Always call startPolling immediately in parallel with EventSource
        startPolling(jobId)

        // Subscribe via SSE
        const token = useAppStore.getState().sessionToken || localStorage.getItem('crafture_session_token') || ''
        const sseUrl = `${API_BASE}/report-jobs/${jobId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`
        const source = new EventSource(sseUrl)
        sourceRef.current = source

        source.onmessage = (e) => {
          if (!active || redirectedRef.current) return
          try {
            const event = JSON.parse(e.data)
            applyEvent(event)
            if (event.stage === 'report_ready' || event.stage === 'job_failed') {
              source.close()
            }
          } catch (_e) {
            /* malformed frame */
          }
        }

        source.onerror = () => {
          // Keep polling running even if SSE closes or fails
          source.close()
          if (active && !redirectedRef.current) {
            startPolling(jobId)
          }
        }
      })
      .catch((err) => {
        if (active && !redirectedRef.current) {
          setErrorMessage(err?.message || 'Failed to start report generation.')
        }
      })

    return () => {
      active = false
      if (pollTimer) clearInterval(pollTimer)
      sourceRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── Error panel ───────────────────────────────────────────────────────────
  if (errorMessage && !window.location.search.includes('preview=true') && !window.location.search.includes('mock=true')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--surface-base)] text-[var(--text-primary)]">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[var(--surface-card)] max-w-md w-full p-6 rounded-2xl border border-rose-500/30 text-center space-y-4 shadow-xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
            <WarningCircle size={32} weight="fill" />
          </div>
          <h3 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
            Processing Error
          </h3>
          <div className="bg-rose-500/5 p-4 rounded-xl border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 font-mono text-left leading-relaxed break-words">
            {errorMessage}
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Please make sure your LinkedIn URL is public and valid, or re-upload a clear PDF/Word resume document.
          </p>
          <button
            onClick={() => setPhase(PHASES.ASSESSMENT)}
            className="w-full btn-primary min-h-[44px] text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} weight="bold" />
            <span>Go Back to Assessment & Fix Input</span>
          </button>
        </motion.div>
      </div>
    )
  }

  const agentScore = (
    (agentStates.resume === 'done' ? 35 : agentStates.resume === 'working' ? 20 : 0) +
    (agentStates.linkedin === 'done' ? 35 : agentStates.linkedin === 'working' ? 20 : 0) +
    (agentStates.overall === 'done' ? 25 : agentStates.overall === 'working' ? 15 : 0)
  )
  const timeBonus = Math.min(25, Math.floor(elapsedSecs * 0.8))
  const displayProgress = isCompleteMorph ? 100 : Math.min(95, Math.max(8, agentScore + timeBonus))
  const mascotPose = isCompleteMorph
    ? 'thumbsup'
    : displayProgress >= 65
      ? 'chart'
      : displayProgress >= 35
        ? 'reading'
        : 'laptop'

  const doneCount = AGENT_NODES.filter((n) => agentStates[n.id] === 'done').length
  const trackPct = isCompleteMorph ? 100 : doneCount === 3 ? 100 : doneCount === 2 ? 72 : doneCount === 1 ? 40 : 14

  const latestMsg = liveMessages[liveMessages.length - 1]
  const activeNode = AGENT_NODES.find((n) => agentStates[n.id] === 'working') || AGENT_NODES[AGENT_NODES.length - 1]
  const activeStageSubtext = isCompleteMorph
    ? 'Report Ready — launching your Career GPS dashboard'
    : agentLogs[activeNode.id] || activeNode.hint
  const InsightIcon = currentInsight.icon

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-4 py-6 bg-gradient-to-b from-white via-slate-50/70 to-emerald-50/30"
      role="status"
      aria-live="polite"
      aria-label="Agents are analyzing your career assessment"
    >
      <div className="w-full max-w-lg flex flex-col items-center text-center">
        {/* Compact Brand Strip */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="inline-flex items-center gap-2.5 mb-4"
        >
          <img
            src={brandLogo}
            alt="Crafture"
            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs"
          />
          <span className="text-base font-bold tracking-tight text-[#0F172A] font-['Poppins']">
            Crafture <span className="text-[#15803D]">Career GPS</span>
          </span>
        </motion.div>

        {/* 1. Animated Mascot Hero Ring */}
        <div className="relative flex items-center justify-center mb-4">
          {/* Soft ambient glow */}
          <div
            className="absolute w-36 h-36 rounded-full blur-xl opacity-45 pointer-events-none"
            style={{
              background: isCompleteMorph
                ? 'radial-gradient(circle, rgba(21,128,61,0.32) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(21,128,61,0.18) 55%, transparent 75%)',
            }}
          />
          {/* Orbital SVG ring */}
          <motion.svg
            viewBox="0 0 140 140"
            className="w-32 h-32 sm:w-36 sm:h-36 pointer-events-none"
            animate={reduceMotion || isCompleteMorph ? {} : { rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          >
            <defs>
              <linearGradient id="loaderOrbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#15803D" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
            </defs>
            <circle
              cx="70"
              cy="70"
              r="64"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="2"
            />
            <circle
              cx="70"
              cy="70"
              r="64"
              fill="none"
              stroke="url(#loaderOrbitGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="110 295"
            />
          </motion.svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <CraftureAnimatedMascot
              pose={mascotPose}
              size={98}
              showShadow={false}
              interactive={false}
            />
          </div>
        </div>

        {/* Progress & Elapsed Pills */}
        <div className="inline-flex items-center gap-2 mb-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums border ${
              isCompleteMorph
                ? 'bg-emerald-50 text-[#15803D] border-emerald-200'
                : 'bg-white text-[#0F172A] border-slate-200 shadow-2xs'
            }`}
          >
            {isCompleteMorph ? '✓ 100% Complete' : `${displayProgress}% Complete`}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono tabular-nums bg-slate-100 text-slate-600 border border-slate-200">
            {elapsedSecs}s
          </span>
        </div>

        <h2
          className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight mb-1"
          style={{ fontFamily: 'var(--font-head)' }}
        >
          {isCompleteMorph ? 'Report Ready' : 'Building your Career GPS'}
        </h2>
        <p className="text-xs text-slate-500 mb-5 max-w-sm truncate">
          {activeStageSubtext}
        </p>

        {/* 2. Connected 3-Stage Pipeline Stepper */}
        <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs mb-4">
          <div className="relative flex items-start justify-between">
            {/* Background track */}
            <div className="absolute top-4 left-8 right-8 h-1 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#15803D] to-[#6366F1]"
                initial={{ width: '10%' }}
                animate={{ width: `${trackPct}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>

            {AGENT_NODES.map((node, idx) => {
              const state = isCompleteMorph ? 'done' : agentStates[node.id]
              const isDone = state === 'done'
              const isWorking = state === 'working'
              const Icon = node.icon

              return (
                <div key={node.id} className="relative z-10 flex-1 flex flex-col items-center px-1">
                  <div
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-200 ${
                      isDone
                        ? 'bg-[#15803D] border-[#15803D] text-white'
                        : isWorking
                          ? 'bg-white border-[#6366F1] text-[#6366F1]'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    {isDone ? (
                      <motion.span
                        initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                      >
                        <Check size={15} weight="bold" />
                      </motion.span>
                    ) : (
                      <>
                        <Icon size={15} weight="bold" />
                        {isWorking && !reduceMotion && (
                          <motion.span
                            className="absolute -inset-1 rounded-full border-2 border-[#6366F1]/50"
                            animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}
                      </>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-[11px] sm:text-xs font-semibold leading-tight ${
                      isDone ? 'text-[#15803D]' : isWorking ? 'text-[#0F172A]' : 'text-slate-400'
                    }`}
                  >
                    {idx + 1}. {node.shortLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. Live Activity / Insight Ticker (Single Frosted Card) */}
        <div className="w-full max-w-lg bg-white/85 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-xs min-h-[76px] flex items-center text-left">
          <AnimatePresence mode="wait">
            {latestMsg ? (
              <motion.div
                key={`evt-${liveMessages.length}-${latestMsg.stage}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="flex items-start gap-3 w-full"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-[#15803D] flex items-center justify-center shrink-0">
                  <Sparkle size={16} weight="fill" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#15803D] mb-0.5">
                    Live Pipeline Update
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-snug line-clamp-2">
                    {latestMsg.text}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`insight-${insightIndex}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="flex items-start gap-3 w-full"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-[#6366F1] flex items-center justify-center shrink-0">
                  <InsightIcon size={16} weight="bold" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#6366F1] mb-0.5">
                    Recruiter Intelligence • {currentInsight.stat}
                  </div>
                  <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                    {currentInsight.text}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          Keep this tab open — redirecting automatically when complete.
        </p>
      </div>
    </div>
  )
}
