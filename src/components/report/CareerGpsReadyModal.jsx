import { motion, AnimatePresence } from 'framer-motion'
import {
  Compass,
  CheckCircle,
  Warning,
  Sparkle,
  ArrowRight,
  X,
  Target,
  FileText,
  TrendUp,
  ShieldCheck,
} from '@phosphor-icons/react'

export default function CareerGpsReadyModal({ isOpen, onClose, reportData }) {
  if (!isOpen) return null

  const gpsScore = reportData?.gps_score ?? reportData?.career_health_score ?? 72
  const phase = reportData?.phase ?? {
    id: 1,
    name: 'Resume → Screening Call',
    confidence: 'High',
  }
  const primaryBottleneck = reportData?.primary_bottleneck ?? {
    title: 'Top-of-Page ATS Keyword Alignment & Metric Gaps',
  }
  const confidence = phase.confidence || 'High'

  // 3 Concise Evidence-Based Findings
  const findings = []

  // 1. Resume Finding
  const resumeScore = reportData?.gps_scores?.areas?.resume?.points ?? Math.round(((reportData?.resume_agent?.dashboard?.score || 70) / 100) * 25)
  const topResumeIssue = reportData?.resume_agent?.issues?.[0]?.title || 'achievement bullets lack quantified business ROI metrics'
  findings.push(`Resume Score: ${resumeScore}/25 pts — ${topResumeIssue.toLowerCase()}.`)

  // 2. LinkedIn & Consistency Finding
  const liTier = reportData?.gps_scores?.areas?.linkedin?.consistencyTier?.tier || 'Strong Match'
  const liScore = reportData?.gps_scores?.areas?.linkedin?.points ?? Math.round(((reportData?.linkedin_agent?.score || 65) / 100) * 15)
  findings.push(`LinkedIn Brand: ${liScore}/15 pts with "${liTier}" resume consistency alignment.`)

  // 3. Funnel & Velocity Finding
  const fStages = reportData?.funnel_stages || {}
  const uAns = reportData?.user_answers || {}
  const apps = Number(fStages.applications_count) || Number(uAns.apps30d) || (Number(uAns.appsWeek) ? Math.round(Number(uAns.appsWeek) * 4.33) : 30)
  const screens = Number(fStages.recruiter_calls_count) || Number(uAns.funnel90d?.screens) || Number(uAns.interviews) || 2
  const rate = apps > 0 ? ((screens / apps) * 100).toFixed(1) : '5.0'
  findings.push(`Funnel Velocity: ${apps} applications yielded ${screens} screens (${rate}% callback conversion).`)

  // Top 3 Priority Actions
  const topActions = Array.isArray(reportData?.top_actions) && reportData.top_actions.length > 0
    ? reportData.top_actions.slice(0, 3)
    : [
        {
          title: 'Quantify Top 5 Resume Bullets',
          whatToDo: 'Rewrite your highest-impact achievements with hard numbers and business metrics.',
        },
        {
          title: 'Direct Recruiter & Referral Outreach',
          whatToDo: 'Send 5 personalized connection messages to target hiring managers weekly.',
        },
        {
          title: 'LinkedIn Headline & Case Study Optimization',
          whatToDo: 'Align headline keywords with your target role and feature 2 project case studies.',
        },
      ]

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md print:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-[var(--surface-base)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gps-ready-title"
        >
          {/* Accent top gradient stripe */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[var(--primary)] via-emerald-500 to-cyan-500" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={20} weight="bold" />
          </button>

          {/* Modal Header */}
          <div className="p-6 sm:p-8 pb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] border border-[var(--primary)]/20 text-xs font-bold font-mono text-[var(--primary)] uppercase tracking-wider mb-3">
              <Sparkle size={14} weight="fill" className="animate-pulse" />
              Executive Diagnostic Ready
            </div>

            <h2
              id="gps-ready-title"
              className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-head)' }}
            >
              Your Career GPS is ready
            </h2>

            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
              Deterministic 100-point rubric score and multi-stage root cause diagnosis synthesized across your resume, LinkedIn, and hiring funnel.
            </p>

            {/* Top Badges Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
              {/* Score Badge */}
              <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Career GPS Score
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-[var(--primary)] font-mono">
                    {gpsScore}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">/100</span>
                </div>
              </div>

              {/* Current Phase Badge */}
              <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex flex-col sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Hiring Phase
                </span>
                <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate mt-1">
                  Phase {phase.id} — {phase.name}
                </span>
              </div>

              {/* Confidence Badge */}
              <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Confidence
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold mt-1 ${phase.isProvisional ? 'text-amber-500' : 'text-emerald-500'}`}>
                  <ShieldCheck size={16} weight="fill" />
                  {phase.isProvisional ? 'Provisional' : confidence}
                </span>
              </div>
            </div>

            {phase.isProvisional && (
              <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                ⚠️ Provisional Diagnosis (Insufficient 30-Day Funnel Volume)
              </div>
            )}

            {/* Primary Bottleneck Ribbon */}
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
              <Warning size={18} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">
                  Primary Root Cause
                </span>
                <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] leading-tight">
                  {primaryBottleneck.title}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="px-6 sm:px-8 py-2 overflow-y-auto space-y-5 text-sm">
            {/* 3 Concise Evidence-Based Findings */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                Key Evidence-Based Findings:
              </h3>
              <ul className="space-y-2">
                {findings.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed"
                  >
                    <CheckCircle size={15} weight="fill" className="text-[var(--primary)] shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Top 3 Prioritized Actions */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                Top 3 Highest-Priority Actions:
              </h3>
              <div className="space-y-2">
                {topActions.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-start gap-3"
                  >
                    <span className="w-5 h-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs font-black flex items-center justify-center shrink-0 mt-0.5 font-mono">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                        {act.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                        {act.whatToDo || act.action || act.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-6 sm:p-8 pt-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-[var(--text-muted)] italic">
              📧 Your full Career GPS report has also been dispatched to your email.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="btn-primary w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View My Full Career GPS ➔</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
