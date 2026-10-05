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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// ── Agent pipeline model ─────────────────────────────────────────────────────
const AGENT_NODES = [
  { id: 'resume', label: 'Resume Agent', hint: 'Line-by-line audit + rewrites', icon: FileText, tone: '#10b981' },
  { id: 'linkedin', label: 'LinkedIn Agent', hint: 'Profile visibility audit', icon: LinkedinLogo, tone: '#0ea5e9' },
  { id: 'overall', label: 'Atlas', hint: 'Executive career narrative', icon: Compass, tone: '#6366f1' },
]

function mapEventToState(stage) {
  // stage examples: agent_resume_agent_started / agent_resume_agent_done /
  // agent_resume_agent_error, agents_running, composing, report_ready
  const m = stage.match(/^agent_([a-z]+)_agent_(\w+)$/)
  if (m) return { agent: m[1], state: m[2] === 'done' ? 'done' : m[2] === 'error' ? 'error' : 'working' }
  if (stage === 'agents_running') return { agent: 'overall', state: 'working' }
  if (stage === 'composing') return { agent: 'overall', state: 'done' }
  return null
}

export default function AnalysisLoader() {
  const { userId, formData, setReportData, setPhase } = useAppStore()
  const [errorMessage, setErrorMessage] = useState(null)
  const [jobStarted, setJobStarted] = useState(false)
  const [agentStates, setAgentStates] = useState({ resume: 'idle', linkedin: 'idle', overall: 'idle' })
  const [liveMessages, setLiveMessages] = useState([])
  const hasTriggeredRef = useRef(false)
  const sourceRef = useRef(null)
  const reduceMotion = useReducedMotion()

  const handleReport = (report) => {
    setReportData(normalizeReportData(report))
    navigateTo('/report')
    setTimeout(() => setPhase(PHASES.REPORT), 500)
  }

  const applyEvent = (event) => {
    if (!event?.stage) return
    if (event.message) {
      setLiveMessages((m) => [...m.slice(-8), { text: event.message, stage: event.stage }])
    }
    const mapped = mapEventToState(event.stage)
    if (mapped) {
      setAgentStates((s) => ({ ...s, [mapped.agent]: mapped.state }))
    }
    if (event.stage === 'report_ready' && event.report) {
      handleReport(event.report)
    }
    if (event.stage === 'job_failed') {
      setErrorMessage(event.message || 'Report generation failed. Please try again.')
    }
  }

  // ── Start job + subscribe ──────────────────────────────────────────────────
  useEffect(() => {
    if (hasTriggeredRef.current) return
    if (!userId) return
    hasTriggeredRef.current = true

    let pollTimer = null
    let cancelled = false

    const startPolling = async (jobId) => {
      // Fallback when SSE is blocked (proxies, older browsers)
      pollTimer = setInterval(async () => {
        try {
          const job = await api.getReportJob(jobId)
          if (cancelled) return
          for (const ev of job.events || []) applyEvent(ev)
          if (job.status === 'done' && job.aiReport) handleReport(job.aiReport)
          if (job.status === 'failed') setErrorMessage(job.error || 'Generation failed.')
          if (job.status === 'done' || job.status === 'failed') clearInterval(pollTimer)
        } catch (_e) {
          /* keep polling */
        }
      }, 3000)
    }

    ;(async () => {
      try {
        const { jobId } = await api.startReportJob({ userId, formData })
        if (cancelled) return
        setJobStarted(true)

        // Subscribe via SSE (no auth headers needed — job id is the capability)
        const source = new EventSource(`${API_BASE}/report-jobs/${jobId}/stream`)
        sourceRef.current = source
        source.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data)
            applyEvent(event)
            if (event.stage === 'report_ready' || event.stage === 'job_failed') {
              source.close()
            }
          } catch (_e) {
            /* malformed frame — ignore */
          }
        }
        source.onerror = () => {
          // SSE dropped before completion → fall back to polling
          source.close()
          if (!cancelled) startPolling(jobId)
        }
      } catch (err) {
        setErrorMessage(err?.message || 'Failed to start report generation.')
      }
    })()

    return () => {
      cancelled = true
      if (pollTimer) clearInterval(pollTimer)
      sourceRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── Error panel (unchanged behavior) ───────────────────────────────────────
  if (errorMessage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-black/90">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass max-w-md w-full p-6 rounded-2xl border border-red-500/30 text-center space-y-4 shadow-2xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
            <WarningCircle size={32} weight="fill" />
          </div>
          <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-head)' }}>
            Processing Error
          </h3>
          <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 text-xs text-red-400 font-mono text-left leading-relaxed">
            {errorMessage}
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Please make sure your LinkedIn URL is public and valid, or re-upload a clear PDF/Word resume document.
          </p>
          <button
            onClick={() => setPhase(PHASES.ASSESSMENT)}
            className="w-full btn-primary text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} weight="bold" />
            <span>Go Back to Assessment & Fix Input</span>
          </button>
        </motion.div>
      </div>
    )
  }

  const latest = liveMessages[liveMessages.length - 1]?.text || 'Spinning up your agent team…'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      role="status"
      aria-live="polite"
      aria-label="Agents are analyzing your career assessment"
    >
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
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isDone ? 'text-emerald-500' : isWorking ? 'text-[var(--primary)]' : isError ? 'text-red-500' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {isDone ? 'Done' : isWorking ? 'Working…' : isError ? 'Failed' : 'Queued'}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{node.hint}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ── Live status ticker (real SSE messages) ── */}
      <div className="w-full max-w-xl h-6 mb-6 relative overflow-hidden" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.p
            key={latest}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="text-xs font-semibold absolute inset-0 flex items-center justify-center text-center text-[var(--primary)]"
          >
            {latest}
          </motion.p>
        </AnimatePresence>
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
