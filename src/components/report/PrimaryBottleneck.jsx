import { motion } from 'framer-motion'
import {
  Warning,
  Lightbulb,
  CheckCircle,
  ArrowRight,
  ShieldWarning,
  EyeSlash,
  Clock,
  Wrench,
  TrendUp,
  MapPin,
  Flag,
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
  const phase = reportData?.phase ?? {
    id: 1,
    name: 'Resume → Screening Call',
    shortName: 'Top of Funnel',
    stuckDescription: 'Not getting or getting very few recruiter screening calls.',
    metricGoal: 'Achieve >5% application-to-screen callback conversion.',
    confidence: 'High',
  }

  const primaryBottleneck = reportData?.primary_bottleneck ?? {
    title: reportData?.critical_issues?.[0]?.title || 'Top-of-Page ATS Filtering & Lack of Quantified Impact',
    whyItMatters: reportData?.critical_issues?.[0]?.whyItMatters || 'Recruiters scan applications in under 10 seconds. Generic task bullets without hard numbers trigger automated filtering.',
    evidence: reportData?.critical_issues?.[0]?.diagnosis || 'Achievement bullets lack hard numbers and Google XYZ outcome structure.',
  }

  const secondaryProblem = reportData?.secondary_problem ?? {
    title: 'Over-Reliance on Public Job Boards & Low Outreach Velocity',
    description: 'Submitting through standard Easy Apply boards produces low ATS conversion compared to direct recruiter outreach or referrals.',
  }

  // Top 3 Prioritized Actions
  const topActions = Array.isArray(reportData?.top_actions) && reportData.top_actions.length > 0
    ? reportData.top_actions.slice(0, 3)
    : [
        {
          title: 'Quantify Top 5 Resume Bullets',
          category: 'Resume Optimization',
          whyItMatters: 'Recruiters screen for business ROI and verifiable scale metrics within 6 seconds.',
          whatToDo: 'Rewrite your 5 most recent role bullets using Google XYZ formula (Accomplished [X], as measured by [Y], by doing [Z]).',
          resourceTool: 'Crafture STAR Bullet Rewriter',
          duration: '3–5 hours',
          successMetric: '100% of top role bullets contain verified hard numbers',
        },
        {
          title: 'Direct Hiring Manager & Referral Pipeline',
          category: 'Networking Velocity',
          whyItMatters: 'Employee referrals and direct messages convert to interviews at 4x the rate of cold portals.',
          whatToDo: 'Identify 5 engineering hiring managers or alumni at target companies weekly and send personalized 50-word notes.',
          resourceTool: 'LinkedIn InMail Framework',
          duration: '45 mins / day',
          successMetric: 'At least 2 warm replies received per week',
        },
        {
          title: 'Targeted Role & Boolean Keyword Alignment',
          category: 'ATS Safety',
          whyItMatters: 'ATS parsers and recruiters filter by exact role title and cloud tech stack keywords.',
          whatToDo: 'Align top 3 skills and headline with the exact target role titles matching your experience band.',
          resourceTool: 'Crafture Keyword Density Scanner',
          duration: '2 hours',
          successMetric: 'Target role appears in top 1/3 of resume and LinkedIn headline',
        },
      ]

  return (
    <section id="bottleneck" className="space-y-6">
      {/* Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400 block">
            6-Phase Root Cause Diagnosis
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Where & Why You Are Stuck
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Clear separation between your pipeline drop-off location and the underlying root cause
        </p>
      </div>

      {/* 2-Part Framework: WHERE YOU ARE STUCK vs WHY YOU ARE STUCK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* WHERE YOU ARE STUCK (Current Phase) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-[var(--surface-card)] border-2 border-[var(--primary)]/30 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold font-mono text-[var(--primary)] uppercase tracking-wider">
                <MapPin size={14} weight="fill" />
                Where You Are Stuck
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${phase.isProvisional ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                {phase.isProvisional ? 'Provisional' : `Confidence: ${phase.confidence || 'High'}`}
              </span>
            </div>

            <div>
              <span className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase block mb-1">
                Detected Hiring Phase
              </span>
              <h3
                className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight leading-tight"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                Phase {phase.id}: {phase.name}
              </h3>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {phase.stuckDescription || 'Pipeline stalls at this exact transition point.'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] font-mono block">
                Target Phase Metric Goal:
              </span>
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {phase.metricGoal || 'Achieve consistent progression to next interview round.'}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] mt-4">
            <span className="text-[11px] text-[var(--text-muted)] italic">
              Phase priority evaluated using deterministic 90-day funnel data.
            </span>
          </div>
        </div>

        {/* WHY YOU ARE STUCK (Primary & Secondary Root Cause) */}
        <div className="lg:col-span-7 p-6 sm:p-7 rounded-3xl bg-[var(--surface-card)] border-2 border-amber-500/30 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-xs font-bold font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <ShieldWarning size={14} weight="fill" />
                Why You Are Stuck (Root Cause)
              </span>
              <span className="text-xs font-mono font-bold text-red-500">
                Primary Friction
              </span>
            </div>

            {/* Primary Root Cause */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 font-mono block">
                1. Primary Root Cause
              </span>
              <h3
                className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight leading-snug"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                &ldquo;{primaryBottleneck.title}&rdquo;
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {primaryBottleneck.whyItMatters}
              </p>
            </div>

            {/* Secondary Root Cause */}
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 font-mono block">
                2. Secondary Root Cause
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                {secondaryProblem.title}
              </h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {secondaryProblem.description}
              </p>
            </div>
          </div>

          {/* Next Best Action Banner */}
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--emerald)] font-mono block">
                Immediate Next Best Action
              </span>
              <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                {reportData?.next_best_action || 'Rewrite top 5 resume achievement bullets with hard numbers'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onNavigateSection) onNavigateSection('resume-ai')
                else document.getElementById('resume-ai')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="shrink-0 text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Execute</span>
              <ArrowRight size={13} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {/* Top 3 Prioritized Actions Section */}
      <div className="space-y-3 pt-2 break-inside-avoid page-break-inside-avoid">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={18} weight="fill" className="text-[var(--primary)]" />
            <h3 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Top 3 Prioritized Actions
            </h3>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Ordered by immediate hiring ROI
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topActions.map((action, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-all flex flex-col justify-between shadow-xs space-y-4 break-inside-avoid page-break-inside-avoid print-card"
            >
              <div className="space-y-3">
                {/* Header: Priority Number + Category */}
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs font-black flex items-center justify-center font-mono">
                    #{idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-muted)] font-mono">
                    {action.category || 'Strategic Fix'}
                  </span>
                </div>

                {/* Action Title */}
                <h4 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-snug">
                  {action.title}
                </h4>

                {/* Why It Matters */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono block">
                    Why It Matters:
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {action.whyItMatters}
                  </p>
                </div>

                {/* Concrete What To Do */}
                <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] font-mono block">
                    What To Do:
                  </span>
                  <p className="text-xs font-medium text-[var(--text-primary)] leading-relaxed">
                    {action.whatToDo}
                  </p>
                </div>
              </div>

              {/* Action Metadata: Resource, Duration, Metric */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Wrench size={13} />
                    Tool:
                  </span>
                  <span className="font-semibold text-[var(--text-secondary)] truncate max-w-[160px]">
                    {action.resourceTool || 'Crafture Framework'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Clock size={13} />
                    Effort:
                  </span>
                  <span className="font-semibold text-[var(--text-secondary)] font-mono">
                    {action.duration || '2–4 hours'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <TrendUp size={13} />
                    Metric:
                  </span>
                  <span className="font-semibold text-emerald-500 truncate max-w-[160px]">
                    {action.successMetric || 'Measurable callback lift'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
