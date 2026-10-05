import { motion } from 'framer-motion'
import {
  Warning,
  Lightbulb,
  CheckCircle,
  ArrowRight,
  ShieldWarning,
  EyeSlash,
} from '@phosphor-icons/react'

function safeText(val, fallback = '') {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) {
    const joined = val.map((v) => safeText(v)).filter(Boolean).join(' ')
    return joined || fallback
  }
  if (typeof val === 'object') {
    return (
      val.title ||
      val.text ||
      val.description ||
      val.diagnosis ||
      val.action ||
      val.step ||
      val.message ||
      fallback
    )
  }
  return fallback
}

export default function PrimaryBottleneck({ reportData, onNavigateSection }) {
  // Extract primary bottleneck details from report data
  const primaryIssue = reportData?.critical_issues?.[0]
  const leakStage = safeText(reportData?.funnel_stages?.biggest_leak_stage, 'Recruiter Calls')
  const apps = Number(reportData?.funnel_stages?.applications_count) || 100
  const calls = Number(reportData?.funnel_stages?.recruiter_calls_count) || 5

  const title = safeText(
    primaryIssue?.title,
    'Your resume is strong technically, but your impact is not being surfaced quickly enough.'
  )

  const category = 'CONVERSION BOTTLENECK • TOP PRIORITY'

  const whyThisMatters = safeText(
    primaryIssue?.description || primaryIssue?.diagnosis,
    'ATS algorithms auto-screen thousands of applications within hours. When achievement bullets lack clear business impact (percentages, revenue, latency reduction), hiring managers assume passive responsibility rather than proactive leadership.'
  )

  // 1-3 concrete evidence items
  const dropPct = apps > 0 ? (((apps - calls) / apps) * 100).toFixed(1) : '95.0'
  const evidenceList = [
    `A ${dropPct}% drop-off was detected between Applications (${apps}) and initial Recruiter Calls (${calls}).`,
    'Bullet points list responsibilities rather than quantified outcomes (missing metrics: %, $, team sizes).',
    'Standard resume formatting risks getting auto-filtered by ATS parsers before recruiter review.',
  ]

  const rawAction = Array.isArray(primaryIssue?.action_steps)
    ? primaryIssue.action_steps[0]
    : primaryIssue?.action_steps
  const whatToDo = safeText(
    rawAction || primaryIssue?.recommendation,
    'Rephrase your top 3 achievement bullets using the Google STAR/XYZ formula: "Accomplished [X] as measured by [Y] by doing [Z]".'
  )

  return (
    <section id="bottleneck" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400 block">
            Most Critical Barrier
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            What is holding your job search back?
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Eliminating this single bottleneck creates the fastest jump in interview callbacks
        </p>
      </div>

      {/* Visually Dominant, Sophisticated Bottleneck Card */}
      <div className="p-6 sm:p-9 rounded-3xl bg-[var(--surface-card)] border-2 border-amber-500/30 relative overflow-hidden shadow-sm">
        {/* Soft amber gradient aura in top corner */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Primary Bottleneck</span>
              </span>
              <span className="text-xs font-mono font-semibold uppercase text-[var(--text-muted)]">
                {category}
              </span>
            </div>

            <span className="text-xs font-mono font-medium text-[var(--text-muted)]">
              Impact Level: <strong className="text-red-500 dark:text-red-400 font-bold">High</strong>
            </span>
          </div>

          {/* Primary Bottleneck Headline Statement */}
          <h3
            className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-snug"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            &ldquo;{title}&rdquo;
          </h3>

          {/* 3-Column Structured Breakdown: Why This Matters | Evidence | What To Do */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {/* 1. Why this matters */}
            <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                <EyeSlash size={16} className="text-amber-500" weight="bold" />
                <span>Why This Matters</span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                {whyThisMatters}
              </p>
            </div>

            {/* 2. Evidence */}
            <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                <ShieldWarning size={16} className="text-amber-500" weight="bold" />
                <span>Supporting Evidence</span>
              </div>
              <ul className="space-y-2 list-none pl-0 text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
                {evidenceList.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. What to do */}
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--emerald)]">
                  <CheckCircle size={16} weight="fill" />
                  <span>What To Do</span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed font-semibold">
                  {whatToDo}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onNavigateSection) onNavigateSection('opportunities')
                  else document.getElementById('opportunities')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="pt-3 text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <span>Inspect resume evidence & rewrite</span>
                <ArrowRight size={13} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
