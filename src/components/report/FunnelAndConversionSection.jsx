import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowDown,
  Warning,
  ChatCircleText,
  ShieldWarning,
  CheckCircle,
  CaretDown,
  CaretUp,
  FileText,
  Clock,
  LinkedinLogo,
  UserCheck,
  ShieldCheck,
  TrendDown,
} from '@phosphor-icons/react'

export default function FunnelAndConversionSection({ funnelData, rejectionData, riskData }) {
  const safeFunnel = funnelData || {}
  const apps = Number(safeFunnel.applications_count) || 100
  const calls = Number(safeFunnel.recruiter_calls_count) || 5
  const interviews = Number(safeFunnel.interviews_count) || 1
  const finals = Number(safeFunnel.final_rounds_count) || 0
  const offers = Number(safeFunnel.offers_count) || 0
  const leakStage = typeof safeFunnel.biggest_leak_stage === 'string'
    ? safeFunnel.biggest_leak_stage
    : safeFunnel.biggest_leak_stage?.stage || 'Recruiter Calls'
  const diagnosis = typeof safeFunnel.diagnosis_message === 'string'
    ? safeFunnel.diagnosis_message
    : safeFunnel.diagnosis_message?.text ||
      'Most candidates drop off right between Applications and Recruiter Calls. Fix top-of-funnel keyword density and quantified metrics to double screening invitations.'

  const calcPct = (val) => {
    const num = Number(val) || 0
    return ((num / apps) * 100).toFixed(1) + '%'
  }

  const STAGES = [
    { name: 'Applications', count: apps, pct: '100%', isLeak: leakStage === 'Applications' },
    { name: 'Responses', count: calls, pct: calcPct(calls), isLeak: leakStage === 'Recruiter Calls' },
    { name: 'Interviews', count: interviews, pct: calcPct(interviews), isLeak: leakStage === 'Tech Interviews' },
    { name: 'Final Rounds', count: finals, pct: calcPct(finals), isLeak: leakStage === 'Final Round' },
    { name: 'Offers', count: offers, pct: calcPct(offers), isLeak: leakStage === 'Offers' },
  ]

  const getSafeRiskTitle = (val) => {
    if (!val) return 'Visa Sponsorship Timeline'
    if (typeof val === 'string') return val
    if (Array.isArray(val)) return typeof val[0] === 'string' ? val[0] : val[0]?.title || val[0]?.name || 'Visa Sponsorship Timeline'
    return val.title || val.name || val.risk || 'Visa Sponsorship Timeline'
  }

  // Rejection reasons from existing rejection_factors
  const rawFactors =
    Array.isArray(rejectionData?.factors) && rejectionData.factors.length > 0
      ? rejectionData.factors
      : [
          { name: 'Resume Impact & ATS Keywords', pct: 38, desc: 'ATS parser drop-offs & achievement bullets lacking quantifiable metrics.' },
          { name: 'Application Strategy & Timing', pct: 22, desc: 'Late submissions on public boards facing 300+ competing applicants.' },
          { name: 'LinkedIn Profile Optimization', pct: 17, desc: 'Incomplete headline keywords and low weekly outbound networking activity.' },
          { name: 'Interview Behavioral Stories', pct: 11, desc: 'Unstructured responses to leadership and scenario questions (STAR gap).' },
        ]

  const safeFactors = rawFactors.map((f) => ({
    name: typeof f === 'string' ? f : typeof f?.name === 'string' ? f.name : typeof f?.title === 'string' ? f.title : 'Factor',
    pct: typeof f === 'object' && f?.pct !== undefined ? Number(f.pct) || 25 : 25,
    desc: typeof f === 'object' ? (typeof f?.desc === 'string' ? f.desc : typeof f?.description === 'string' ? f.description : '') : '',
  }))

  const [expandedReason, setExpandedReason] = useState(null)
  const toggleReason = (idx) => {
    setExpandedReason(expandedReason === idx ? null : idx)
  }

  // Risk Radar items
  const criticalRisk = getSafeRiskTitle(riskData?.critical_risk)
  const mitigationPlan =
    (typeof riskData?.mitigation_plan === 'string' && riskData.mitigation_plan) ||
    riskData?.mitigation_plan?.text ||
    'Target employers with verified e-Verify certification and explicit H-1B sponsorship history to prevent late-stage interview dropouts.'

  const RADAR_ITEMS = [
    {
      title: criticalRisk,
      category: 'Immigration & Timeline',
      status: 'Active Focus',
      statusColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      desc: 'Verify e-Verify and historical sponsorship before advancing to round 3.',
    },
    {
      title: 'Recruiter Ghosting',
      category: 'Pipeline Risk',
      status: 'Controlled',
      statusColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      desc: 'Follow a strict 5-day post-interview follow-up template to maintain momentum.',
    },
    {
      title: 'ATS Parser Compatibility',
      category: 'Resume Formatting',
      status: 'In Progress',
      statusColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      desc: 'Remove tables and non-standard symbols to ensure 100% text extraction.',
    },
    {
      title: 'Market Competition Density',
      category: 'Macro Environment',
      status: 'Monitored',
      statusColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      desc: 'Focus on niche skill combinations (e.g. Go + Kafka or TypeScript + AWS).',
    },
  ]

  return (
    <section id="funnel-risks" className="space-y-8">
      {/* 1. Job Search Funnel Journey */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
              Conversion Pipeline
            </span>
            <h2
              className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
              style={{ fontFamily: 'var(--font-head)' }}
            >
              Job Search Funnel Journey
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
            Where applications convert or drop off across each stage
          </p>
        </div>

        {/* Funnel Visualization Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs space-y-6">
          {/* Desktop Horizontal Journey / Mobile Vertical Journey */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            {STAGES.map((s, idx) => (
              <div key={s.name} className="relative flex flex-col items-center text-center">
                <div
                  className={`w-full p-4 rounded-2xl border transition-all ${
                    s.isLeak
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-xs ring-2 ring-amber-500/20'
                      : 'bg-[var(--surface-sunken)] border-[var(--border-default)]'
                  }`}
                >
                  <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    {s.name}
                  </div>
                  <div className="text-2xl font-black font-mono text-[var(--text-primary)]">
                    {s.count}
                  </div>
                  <div className="text-xs font-mono font-bold mt-1 text-[var(--primary)]">
                    {s.pct}
                  </div>

                  {s.isLeak && (
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-white inline-block">
                      Biggest Leak
                    </div>
                  )}
                </div>

                {/* Arrow connector between stages */}
                {idx < STAGES.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-[var(--surface-card)] border border-[var(--border-default)] items-center justify-center text-[var(--text-muted)]">
                    <ArrowRight size={12} weight="bold" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Biggest Drop-off Callout */}
          <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/25 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <TrendDown size={20} weight="bold" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Biggest Drop-off Identified: {leakStage} (95% drop)
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-primary)] font-medium leading-relaxed">
                {diagnosis}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. "Why aren't interviews converting?" + Risk Radar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Why Aren't Interviews Converting? (Diagnosis Panel) */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
              Root Cause Analysis
            </span>
            <h3
              className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight"
              style={{ fontFamily: 'var(--font-head)' }}
            >
              Why aren't interviews converting?
            </h3>
          </div>

          <div className="space-y-2.5">
            {safeFactors.map((f, i) => {
              const isExpanded = expandedReason === i
              return (
                <div
                  key={f.name}
                  className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] overflow-hidden shadow-2xs"
                >
                  <div
                    onClick={() => toggleReason(i)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--surface-sunken)]/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center justify-center text-xs font-mono font-bold text-[var(--text-primary)] shrink-0">
                        {f.pct}%
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-[var(--text-primary)] block truncate" style={{ fontFamily: 'var(--font-head)' }}>
                          {f.name}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] block truncate">
                          {f.desc}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label="Toggle details"
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 shrink-0"
                    >
                      {isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 pt-1 border-t border-[var(--border-default)] text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--surface-sunken)]/40"
                      >
                        <p className="font-medium">{f.desc}</p>
                        <p className="mt-2 text-xs font-semibold text-[var(--primary)]">
                          💡 Coach Recommendation: Prioritize rewriting top bullet points with metrics to eliminate this {f.pct}% conversion friction.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Risk Radar */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400 block">
              Risk Radar
            </span>
            <h3
              className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight"
              style={{ fontFamily: 'var(--font-head)' }}
            >
              Pipeline Risk Assessment
            </h3>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] space-y-3.5 shadow-xs">
            {RADAR_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate" style={{ fontFamily: 'var(--font-head)' }}>
                    {item.title}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${item.statusColor}`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}

            {/* Mitigation Callout */}
            <div className="pt-2 text-xs text-[var(--text-muted)] font-medium flex items-start gap-2">
              <ShieldCheck size={16} className="text-[var(--emerald)] shrink-0 mt-0.5" weight="bold" />
              <span>{mitigationPlan}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
