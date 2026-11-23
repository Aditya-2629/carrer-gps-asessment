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
import { WarningCircle, ArrowLeft, FileText, LinkedinLogo, Compass, Check } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { api, normalizeReportData } from '../../lib/api'
import { navigateTo } from '../../lib/navigation'
import brandLogo from '../../assets/images/crafture-logo.jpg'
import CrafturePoseMascot from '../common/CrafturePoseMascot'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Module-level in-flight job map keyed by userId:
// Prevents React.StrictMode double-mounts from canceling or swallowing the job creation promise.
const inflightJobByUser = new Map()

// ── Agent pipeline model ─────────────────────────────────────────────────────
const AGENT_NODES = [
  { id: 'resume', label: 'Resume Agent', hint: 'Line-by-line audit + rewrites', icon: FileText, tone: '#10b981' },
  { id: 'linkedin', label: 'LinkedIn Agent', hint: 'Profile visibility audit', icon: LinkedinLogo, tone: '#0ea5e9' },
  { id: 'overall', label: 'Atlas', hint: 'Executive career narrative', icon: Compass, tone: '#6366f1' },
]

const CAREER_INSIGHTS = [
  {
    icon: '📊',
    stat: 'Quantified Impact',
    text: 'Top 10% engineering resumes quantify outcomes on ≥ 65% of bullet points, doubling recruiter callback rates.',
  },
  {
    icon: '⏱️',
    stat: '7.4s Recruiter Scan',
    text: 'Recruiters spend an average of 7.4 seconds on their initial scan. Clear title positioning and metrics are critical.',
  },
  {
    icon: '🔍',
    stat: 'LinkedIn SEO',
    text: 'Profiles with 5+ matching target role keywords in headlines and skills receive up to 3.8x more direct recruiter inMails.',
  },
  {
    icon: '🎯',
    stat: 'Executive Storytelling',
    text: 'Summaries structured with Target Role + 3 Core Technical Pillars increase screening pass-through rates by 40%.',
  },
  {
    icon: '📈',
    stat: 'Interview Funnel',
    text: 'Converting recruiter screens to final offers requires bridging technical architecture trade-offs with business ROI.',
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
    const normalized = normalizeReportData(report)
    setReportData(normalized)
    setPhase(PHASES.REPORT)
    navigateTo('/report')
    if (typeof window !== 'undefined' && window.location.pathname !== '/report') {
      window.history.pushState(null, '', '/report')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
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
    if (!userId) return

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
  if (errorMessage) {
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

  const latest = liveMessages[liveMessages.length - 1]?.text || 'Spinning up your agent team…'

  const agentScore = (
    (agentStates.resume === 'done' ? 35 : agentStates.resume === 'working' ? 20 : 0) +
    (agentStates.linkedin === 'done' ? 35 : agentStates.linkedin === 'working' ? 20 : 0) +
    (agentStates.overall === 'done' ? 25 : agentStates.overall === 'working' ? 15 : 0)
  )
  const timeBonus = Math.min(25, Math.floor(elapsedSecs * 0.8))
  const displayProgress = Math.min(95, Math.max(8, agentScore + timeBonus))

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      role="status"
      aria-live="polite"
      aria-label="Agents are analyzing your career assessment"
    >
      {/* Brand logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 text-center"
      >
        <div className="inline-flex items-center gap-3">
          <img
            src={brandLogo}
            alt="Crafture"
            className="w-10 h-10 rounded-xl object-cover border border-[var(--border-default)] shadow-sm"
          />
          <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-['Poppins']">
            Crafture <span className="text-[var(--primary)]">Career GPS</span>
          </span>
        </div>
      </motion.div>

      {/* ── Official Crafture Copilot Mascot (Live Synthesis State) ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-3 flex flex-col items-center justify-center"
      >
        <CrafturePoseMascot
          pose={displayProgress >= 100 ? 'thumbsup' : 'laptop'}
          size={124}
          animation={displayProgress >= 100 ? 'bounce' : 'working'}
          showShadow={true}
          interactive={false}
          priority
        />
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl sm:text-3xl font-bold mb-2 text-center text-[var(--text-primary)]"
        style={{ fontFamily: 'var(--font-head)' }}
      >
        Your agent team is working
      </motion.h2>
      <p className="text-xs text-[var(--text-tertiary)] mb-8 text-center">
        Three specialists. One report. Live progress, no black box.
      </p>

      {/* ── Progress Bar & Timer ── */}
      <div className="w-full max-w-xl mb-6">
        <div className="flex items-center justify-between text-xs font-mono mb-2 text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-primary)]">
            Analysis Progress <span className="tabular-nums text-[var(--primary)]">{displayProgress}%</span>
          </span>
          <span className="tabular-nums">Elapsed: {elapsedSecs}s</span>
        </div>
        <div className="w-full h-2 bg-[var(--surface-sunken)] rounded-full overflow-hidden border border-[var(--border-default)]">
          <motion.div
            className="h-full bg-[var(--primary)] rounded-full"
            initial={{ width: '8%' }}
            animate={{ width: `${displayProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ── Agent pipeline ── */}
      <div className="w-full max-w-xl space-y-3 mb-8">
        {AGENT_NODES.map((node, i) => {
          const state = agentStates[node.id]
          const isWorking = state === 'working'
          const isDone = state === 'done'
          const isError = state === 'error'
          const Icon = node.icon

          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, x: reduceMotion ? 0 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12, duration: 0.35 }}
              className={`flex items-center gap-4 bg-[var(--surface-card)] border rounded-2xl px-4 py-3.5 transition-all duration-300 ${
                isWorking ? 'border-[var(--primary)]/50 shadow-sm shadow-[var(--primary-ring)]' : isError ? 'border-red-400/50' : isDone ? 'border-emerald-400/40' : 'border-[var(--border-default)] opacity-70'
              }`}
            >
              {/* Avatar */}
              <div
                className={`relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors duration-300 ${
                  isDone ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' : isWorking ? 'bg-[var(--primary-subtle)] border-[var(--primary)]/40 text-[var(--primary)]' : 'bg-[var(--surface-base)] border-[var(--border-default)] text-[var(--text-muted)]'
                }`}
              >
                {isDone ? (
                  reduceMotion ? <Check size={20} weight="bold" /> : (
                    <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 16 }}>
                      <Check size={20} weight="bold" />
                    </motion.span>
                  )
                ) : (
                  <>
                    <Icon size={20} weight="fill" />
                    {isWorking && !reduceMotion && (
                      <motion.span
                        className="absolute inset-0 rounded-xl border-2 border-[var(--primary)]"
                        animate={{ opacity: [0.8, 0.15, 0.8] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Copy */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">{node.label}</span>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={state}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isDone ? 'text-emerald-500' : isWorking ? 'text-[var(--primary)]' : isError ? 'text-red-500' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {isDone ? 'Done' : isWorking ? 'Working…' : isError ? 'Failed' : 'Queued'}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 sm:truncate">{agentLogs[node.id] || node.hint}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ── Live Activity Feed ── */}
      <div className="w-full max-w-xl mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--primary)]" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
              Live Pipeline Activity
            </span>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
            {liveMessages.length} events logged
          </span>
        </div>
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl p-3 divide-y divide-[var(--border-default)]/40 shadow-2xs">
          {liveMessages.length === 0 ? (
            <div className="py-2 text-xs text-[var(--text-muted)] text-center font-mono">
              Connecting to live agent stream…
            </div>
          ) : (
            liveMessages.slice(-4).map((msg, idx) => {
              const agentKey = String(msg.agent || '').toLowerCase()
              const label =
                agentKey === 'resume'
                  ? 'Resume'
                  : agentKey === 'linkedin'
                  ? 'LinkedIn'
                  : agentKey === 'overall' || agentKey === 'atlas'
                  ? 'Atlas'
                  : 'System'
              const badgeCls =
                agentKey === 'resume'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : agentKey === 'linkedin'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                  : agentKey === 'overall' || agentKey === 'atlas'
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                  : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] border border-[var(--border-default)]'

              let timeStr = 'now'
              if (msg.at) {
                const d = new Date(msg.at)
                if (!isNaN(d.getTime())) {
                  timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                }
              }

              return (
                <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2.5 text-xs">
                  <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0 pt-0.5 tabular-nums">
                    {timeStr}
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${badgeCls}`}>
                    {label}
                  </span>
                  <span className="text-[var(--text-primary)] font-medium truncate flex-1">
                    {msg.text}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Rotating Career Insights ── */}
      <div className="w-full max-w-xl mb-6">
        <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center gap-3">
          <span className="text-xl select-none shrink-0">{currentInsight.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] mb-0.5">
              Career Intelligence • {currentInsight.stat}
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {currentInsight.text}
            </p>
          </div>
        </div>
      </div>

      {/* ── Shape-matched skeletons (the report, ghosted) ── */}
      <div className="w-full max-w-xl space-y-3" aria-hidden="true">
        {/* Ghost scorecard */}
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 flex items-center gap-5">
          <SkeletonRing done={agentStates.overall === 'done'} />
          <div className="flex-1 grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-shimmer h-9 rounded-xl" />
            ))}
          </div>
        </div>
        {/* Ghost audit rows */}
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-2.5">
          {[64, 92, 78, 85, 58].map((w, i) => (
            <div
              key={i}
              className={`skeleton-shimmer h-3.5 rounded-md ${i % 2 ? 'ml-6' : ''}`}
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>

      {/* Fine print */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 text-[11px] text-center text-[var(--text-tertiary)] max-w-xs"
      >
        You can keep this tab open — we'll redirect you the moment your report is ready.
      </motion.p>
    </div>
  )
}

/** Ghost score ring that fills in when Atlas completes. */
function SkeletonRing({ done }) {
  const R = 34
  const CIRC = 2 * Math.PI * R
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 84 84" className="w-20 h-20 -rotate-90">
        <circle cx="42" cy="42" r={R} fill="none" stroke="var(--border-default)" strokeWidth="7" />
        <motion.circle
          cx="42"
          cy="42"
          r={R}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: done ? CIRC * 0.35 : CIRC }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-extrabold tabular-nums ${done ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
          {done ? '✓' : '—'}
        </span>
      </div>
    </div>
  )
}
