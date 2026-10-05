import React from 'react'
import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react'

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
        <div className={`text-4xl font-extrabold tabular-nums leading-none ${light ? 'text-slate-900' : 'text-white'}`}>{score}</div>
        <div className={`text-lg font-extrabold mt-1 ${(GRADE_COLORS[grade] || GRADE_COLORS.C)[light ? 'textLight' : 'text']}`}>{grade}</div>
        <div className={`text-[10px] uppercase tracking-widest mt-0.5 ${light ? 'text-slate-400' : 'text-gray-500'}`}>{gradeLabel}</div>
      </div>
    </div>
  )
}

export default function ResumeScoreCard({ dashboard, candidateName, variant = 'dark' }) {
  if (!dashboard || typeof dashboard.score !== 'number') return null
  const light = variant === 'light'
  const { score, grade, gradeLabel, grades, checks, summary } = dashboard
  const entries = Object.entries(grades || {})

  const cardBg = light ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-gray-800/90'
  const headingText = light ? 'text-slate-900' : 'text-white'
  const subText = light ? 'text-slate-500' : 'text-gray-500'
  const labelColor = light ? 'text-slate-400' : 'text-gray-400'

  return (
    <div className={`${cardBg} border rounded-2xl shadow-sm overflow-hidden print:shadow-none print:break-inside-avoid`}>
      {/* Header: score ring + grade chips */}
      <div className="p-6 flex flex-col sm:flex-row items-center gap-6 border-b border-slate-200/70 print:break-inside-avoid">
        <ScoreRing score={score} grade={grade} gradeLabel={gradeLabel} light={light} />

        <div className="flex-1 min-w-0 space-y-3 w-full">
          <div>
            <div className={`text-[11px] uppercase tracking-widest font-bold ${labelColor}`}>Resume Health Score</div>
            <div className={`text-lg font-bold ${headingText}`}>
              {candidateName ? `${candidateName}, your resume scores ` : 'Your resume scores '}
              <span className={(GRADE_COLORS[grade] || GRADE_COLORS.C)[light ? 'textLight' : 'text']}>
                {score}/100
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
                <div key={key} className={`${chipBg} ${chipBorder} border rounded-xl px-3 py-2 print:break-inside-avoid`} title={g.facts?.join('\n')}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wide truncate ${light ? 'text-slate-600' : 'text-gray-300'}`}>{g.label}</span>
                    <span className={`text-sm font-extrabold ${gradeText}`}>{g.grade}</span>
                  </div>
                  <div className={`text-[10px] mt-0.5 tabular-nums ${subText}`}>{g.score}/100</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="p-5 print:break-inside-avoid">
        <div className="flex items-center justify-between mb-3">
          <h4 className={`text-xs font-bold uppercase tracking-wider ${labelColor}`}>Resume Checklist</h4>
          <span className={`text-[11px] font-mono ${subText}`}>
            {summary?.checksPassed ?? checks?.filter((c) => c.status === 'pass').length}/{checks?.length ?? 0} passed
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
          {(checks || []).map((c) => (
            <div key={c.id} className="flex items-start gap-2.5 py-1.5 print:break-inside-avoid">
              <span className="mt-0.5 shrink-0">{CHECK_STYLE[c.status]?.[light ? 'light' : 'dark'] || CHECK_STYLE.pass.dark}</span>
              <div className="min-w-0">
                <div className={`text-xs font-semibold ${light ? 'text-slate-800' : 'text-gray-200'}`}>{c.label}</div>
                <div className={`text-[11px] leading-snug ${light ? 'text-slate-500' : 'text-gray-500'}`}>{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { GRADE_COLORS }
