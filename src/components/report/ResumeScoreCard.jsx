import React, { useMemo } from 'react'
import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react'
import { NumberRoll } from '../number-roll'
import { CompareBars } from '../compare-bars'

/**
 * ResumeScoreCard — the instant verdict.
 * Score ring + per-category letter grades + pass/warn/fail checklist.
 * Reads `analysis.dashboard` produced by the deterministic scorecard engine.
 *
 * variant: 'light' (report page / print-first) | 'dark' (Test Lab console)
 */

const GRADE_COLORS = {
  A: { text: 'text-emerald-300', textLight: 'text-emerald-600', chipBgDark: 'bg-emerald-950/70', chipBgLight: 'bg-emerald-50', borderDark: 'border-emerald-700/60', borderLight: 'border-emerald-200', ring: '#10b981' },
  B: { text: 'text-teal-300', textLight: 'text-teal-600', chipBgDark: 'bg-teal-950/70', chipBgLight: 'bg-teal-50', borderDark: 'border-teal-700/60', borderLight: 'border-teal-200', ring: '#0d9488' },
  C: { text: 'text-amber-300', textLight: 'text-amber-600', chipBgDark: 'bg-amber-950/70', chipBgLight: 'bg-amber-50', borderDark: 'border-amber-700/60', borderLight: 'border-amber-200', ring: '#d97706' },
  D: { text: 'text-orange-300', textLight: 'text-orange-600', chipBgDark: 'bg-orange-950/70', chipBgLight: 'bg-orange-50', borderDark: 'border-orange-700/60', borderLight: 'border-orange-200', ring: '#ea580c' },
  F: { text: 'text-red-300', textLight: 'text-red-600', chipBgDark: 'bg-red-950/70', chipBgLight: 'bg-red-50', borderDark: 'border-red-700/60', borderLight: 'border-red-200', ring: '#dc2626' },
}

const CHECK_STYLE = {
  pass: {
    dark: <CheckCircle size={18} weight="fill" className="text-emerald-400" />,
    light: <CheckCircle size={18} weight="fill" className="text-emerald-500" />,
  },
  warn: {
    dark: <WarningCircle size={18} weight="fill" className="text-amber-400" />,
    light: <WarningCircle size={18} weight="fill" className="text-amber-500" />,
  },
  fail: {
    dark: <XCircle size={18} weight="fill" className="text-red-400" />,
    light: <XCircle size={18} weight="fill" className="text-red-500" />,
  },
}

function ScoreRing({ score, grade, gradeLabel, light }) {
  const R = 56
  const CIRC = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, score)) / 100
  const color = (GRADE_COLORS[grade] || GRADE_COLORS.C).ring

  return (
    <div className="relative w-40 h-40 shrink-0 print:break-inside-avoid">
      <svg viewBox="0 0 140 140" className="w-40 h-40 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke={light ? '#e2e8f0' : '#1e293b'} strokeWidth="11" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <NumberRoll
          value={score}
          duration={850}
          className={`text-4xl font-semibold tabular-nums leading-none ${light ? 'text-[var(--text-primary)]' : 'text-white'}`}
        />
        <div className={`text-lg font-semibold mt-1 ${(GRADE_COLORS[grade] || GRADE_COLORS.C)[light ? 'textLight' : 'text']}`}>{grade}</div>
        <div className={`text-xs font-mono tracking-normal mt-0.5 ${light ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>{gradeLabel}</div>
      </div>
    </div>
  )
}

export default function ResumeScoreCard({
  id,
  dashboard,
  candidateName,
  variant = 'dark',
  title = 'Resume Health Score',
  scoreWord = 'resume',
  hideChecklist = false,
  ...rest
}) {
  const grades = dashboard?.grades
  const compareData = useMemo(() => {
    const rawImpact = grades?.impact?.score ?? 62
    const rawPos = grades?.positioning?.score ?? 68
    const rawAts = grades?.ats_readability?.score ?? 85
    const rawCred = grades?.credibility?.score ?? 70
    const rawBrev = grades?.brevity?.score ?? 74
    const rawUs = grades?.us_alignment?.score ?? 78

    return [
      { label: 'Impact', current: rawImpact, previous: Math.min(95, rawImpact + 26) },
      { label: 'Positioning', current: rawPos, previous: Math.min(96, rawPos + 22) },
      { label: 'ATS Safety', current: rawAts, previous: Math.min(100, rawAts + 10) },
      { label: 'Credibility', current: rawCred, previous: Math.min(98, rawCred + 20) },
      { label: 'Brevity', current: rawBrev, previous: Math.min(95, rawBrev + 18) },
      { label: 'US Alignment', current: rawUs, previous: Math.min(95, rawUs + 16) },
    ]
  }, [grades])

  if (!dashboard || typeof dashboard.score !== 'number') return null
  const light = variant === 'light'
  const { score, grade, gradeLabel, checks, summary } = dashboard
  const seenLabels = new Set()
  const entries = Object.entries(grades || {}).filter(([, g]) => {
    if (!g?.label || seenLabels.has(g.label)) return false
    seenLabels.add(g.label)
    return true
  })

  const cardBg = light ? 'bg-[var(--surface-card)] border-[var(--border-default)]' : 'bg-[#0f172a] border-gray-800/90'
  const headingText = light ? 'text-[var(--text-primary)]' : 'text-white'
  const subText = light ? 'text-[var(--text-muted)]' : 'text-gray-400'
  const labelColor = light ? 'text-[var(--text-muted)]' : 'text-gray-300'

  return (
    <div id={id} className={`${cardBg} border rounded-2xl shadow-sm overflow-hidden print:shadow-none print:break-inside-avoid`} {...rest}>
      {/* Header: score ring + grade chips */}
      <div className="p-6 flex flex-col sm:flex-row items-center gap-6 border-b border-[var(--border-default)]/70 print:break-inside-avoid">
        <ScoreRing score={score} grade={grade} gradeLabel={gradeLabel} light={light} />

        <div className="flex-1 min-w-0 space-y-3 w-full">
          <div>
            <div className={`text-xs font-mono tracking-normal font-medium ${labelColor}`}>{title}</div>
            <div className={`text-lg font-semibold ${headingText}`}>
              {candidateName ? `${candidateName}, your ${scoreWord} scores ` : `Your ${scoreWord} scores `}
              <span className={(GRADE_COLORS[grade] || GRADE_COLORS.C)[light ? 'textLight' : 'text']}>
                <NumberRoll value={score} duration={850} />/100
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {entries.map(([key, g]) => {
              const c = GRADE_COLORS[g.grade] || GRADE_COLORS.C
              const chipBg = light ? c.chipBgLight : c.chipBgDark
              const chipBorder = light ? c.borderLight : c.borderDark
              const gradeText = light ? c.textLight : c.text
              return (
                <div key={key} className={`${chipBg} ${chipBorder} border rounded-lg px-3 py-2 print:break-inside-avoid`} title={g.facts?.join('\n')}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono tracking-normal truncate ${light ? 'text-[var(--text-secondary)]' : 'text-gray-200'}`}>{g.label}</span>
                    <span className={`text-sm font-semibold tabular-nums ${gradeText}`}>{g.grade}</span>
                  </div>
                  <div className={`text-xs mt-0.5 tabular-nums ${subText}`}>{g.score}/100</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 6 Resume Pillars Split Compare Bars */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-default)]/70 bg-[var(--surface-sunken)] print:break-inside-avoid">
        <CompareBars
          data={compareData}
          title="6 Resume Pillars Split Benchmark"
          currentLabel="Current Resume"
          previousLabel="Target Benchmark"
          defaultCompared={true}
          summaryMode="average"
          maxScore={100}
          className="w-full [--plot:110px] @md:[--plot:125px]"
        />
      </div>

      {/* Checklist */}
      {!hideChecklist && (
        <div className="p-5 print:break-inside-avoid">
          <div className="flex items-center justify-between mb-3">
            <h4 className={`text-xs font-semibold ${labelColor}`}>
              {scoreWord?.toLowerCase().includes('linkedin') ? 'LinkedIn Checklist' : 'Resume Checklist'}
            </h4>
            <span className={`text-xs font-mono ${subText}`}>
              {summary?.checksPassed ?? checks?.filter((c) => c.status === 'pass').length}/{checks?.length ?? 0} passed
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
            {(checks || []).map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 py-1.5 print:break-inside-avoid">
                <span className="mt-0.5 shrink-0">{CHECK_STYLE[c.status]?.[light ? 'light' : 'dark'] || CHECK_STYLE.pass.dark}</span>
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${light ? 'text-[var(--text-primary)]' : 'text-gray-200'}`}>{c.label}</div>
                  <div className={`text-[11px] leading-snug ${light ? 'text-[var(--text-secondary)]' : 'text-gray-500'}`}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { GRADE_COLORS }
