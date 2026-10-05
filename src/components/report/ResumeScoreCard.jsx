import React from 'react'
import { CheckCircle, WarningCircle, XCircle, Check, Minus } from '@phosphor-icons/react'

/**
 * ResumeScoreCard — the instant verdict.
 * Score ring + per-category letter grades + pass/warn/fail checklist.
 * Reads `analysis.dashboard` produced by the deterministic scorecard engine.
 */

const GRADE_COLORS = {
  A: { text: 'text-emerald-300', bg: 'bg-emerald-950/70', border: 'border-emerald-700/60', ring: '#34d399' },
  B: { text: 'text-teal-300', bg: 'bg-teal-950/70', border: 'border-teal-700/60', ring: '#2dd4bf' },
  C: { text: 'text-amber-300', bg: 'bg-amber-950/70', border: 'border-amber-700/60', ring: '#fbbf24' },
  D: { text: 'text-orange-300', bg: 'bg-orange-950/70', border: 'border-orange-700/60', ring: '#fb923c' },
  F: { text: 'text-red-300', bg: 'bg-red-950/70', border: 'border-red-700/60', ring: '#f87171' },
}

const CHECK_ICONS = {
  pass: { icon: <CheckCircle size={18} weight="fill" className="text-emerald-400" />, label: 'PASS' },
  warn: { icon: <WarningCircle size={18} weight="fill" className="text-amber-400" />, label: 'FIX SUGGESTED' },
  fail: { icon: <XCircle size={18} weight="fill" className="text-red-400" />, label: 'FIX NEEDED' },
}

function ScoreRing({ score, grade, gradeLabel }) {
  const R = 56
  const CIRC = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, score)) / 100
  const color = (GRADE_COLORS[grade] || GRADE_COLORS.C).ring

  return (
    <div className="relative w-40 h-40 shrink-0">
      <svg viewBox="0 0 140 140" className="w-40 h-40 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#1e293b" strokeWidth="11" />
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
        <div className="text-4xl font-extrabold text-white tabular-nums leading-none">{score}</div>
        <div className={`text-lg font-extrabold mt-1 ${GRADE_COLORS[grade]?.text || 'text-gray-300'}`}>{grade}</div>
        <div className="text-[10px] uppercase tracking-widest text-gray-500 mt-0.5">{gradeLabel}</div>
      </div>
    </div>
  )
}

export default function ResumeScoreCard({ dashboard, candidateName }) {
  if (!dashboard || typeof dashboard.score !== 'number') return null

  const { score, grade, gradeLabel, grades, checks, summary } = dashboard
  const entries = Object.entries(grades || {})

  return (
    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header: score ring + grade chips */}
      <div className="p-6 flex flex-col sm:flex-row items-center gap-6 border-b border-gray-800/80">
        <ScoreRing score={score} grade={grade} gradeLabel={gradeLabel} />

        <div className="flex-1 min-w-0 space-y-3 w-full">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-gray-500 font-bold">Resume Health Score</div>
            <div className="text-lg font-bold text-white">
              {candidateName ? `${candidateName}, your resume scores ` : 'Your resume scores '}
              <span className={GRADE_COLORS[grade]?.text}>{score}/100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {entries.map(([key, g]) => {
              const c = GRADE_COLORS[g.grade] || GRADE_COLORS.C
              return (
                <div key={key} className={`${c.bg} ${c.border} border rounded-xl px-3 py-2`} title={g.facts?.join('\n')}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide truncate">{g.label}</span>
                    <span className={`text-sm font-extrabold ${c.text}`}>{g.grade}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5 tabular-nums">{g.score}/100</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resume Checklist</h4>
          <span className="text-[11px] font-mono text-gray-500">
            {summary?.checksPassed ?? checks?.filter((c) => c.status === 'pass').length}/{checks?.length ?? 0} passed
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
          {(checks || []).map((c) => {
            const ic = CHECK_ICONS[c.status] || CHECK_ICONS.pass
            return (
              <div key={c.id} className="flex items-start gap-2.5 py-1.5">
                <span className="mt-0.5 shrink-0">{ic.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-200">{c.label}</div>
                  <div className="text-[11px] text-gray-500 leading-snug">{c.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { GRADE_COLORS, CHECK_ICONS }
