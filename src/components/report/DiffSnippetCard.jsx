import React, { useState } from 'react'
import { Copy, Check, ArrowRight, Sparkle } from '@phosphor-icons/react'

/**
 * DiffSnippetCard
 *
 * Interactive Before/After Comparison Card for Resume Bullets:
 * - Visual color separation: Original (rose/amber) vs Optimized Google XYZ (emerald).
 * - Score delta visualization: e.g. 42 ➔ 88 (+46 pts).
 * - 1-Click "Copy Optimized Bullet" action with 2-second confirmation.
 * - Word & character count metrics with keyword pill tags.
 */
export function DiffSnippetCard({
  before = '',
  after = '',
  scoreBefore = 42,
  scoreAfter = 88,
  keywords = [],
  metricImpact = '',
}) {
  const [copied, setCopied] = useState(false)

  const cleanBefore = (before || '').trim()
  const cleanAfter = (after || '').trim()
  const charCount = cleanAfter.length
  const wordCount = cleanAfter ? cleanAfter.split(/\s+/).filter(Boolean).length : 0
  const scoreDelta = Math.max(0, scoreAfter - scoreBefore)

  const handleCopy = (e) => {
    e.stopPropagation()
    if (navigator?.clipboard?.writeText && cleanAfter) {
      navigator.clipboard.writeText(cleanAfter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Highlight weaved keywords within the optimized bullet if keywords are provided
  const renderOptimizedText = () => {
    if (!keywords || keywords.length === 0) {
      return cleanAfter
    }
    // Create regex matching any of the keyword terms
    const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean)
    if (escaped.length === 0) return cleanAfter

    const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
    const parts = cleanAfter.split(regex)

    return parts.map((part, i) => {
      const isMatch = keywords.some((k) => k.toLowerCase() === part.toLowerCase())
      if (isMatch) {
        return (
          <mark
            key={i}
            className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold px-1 py-0.5 rounded border border-emerald-500/30"
          >
            {part}
          </mark>
        )
      }
      return part
    })
  }

  return (
    <div className="my-3.5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sm overflow-hidden transition-all duration-200">
      {/* Card Header: Optimization Badge & Score Delta */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--surface-subtle)] border-b border-[var(--border-default)] gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <Sparkle size={12} weight="fill" />
            Google XYZ Bullet Optimization
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono font-bold">
          <span className="text-rose-500 dark:text-rose-400">{scoreBefore}</span>
          <ArrowRight size={12} className="text-[var(--text-muted)]" />
          <span className="text-emerald-600 dark:text-emerald-400">{scoreAfter}</span>
          <span className="text-emerald-500 text-[10px] font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 ml-0.5">
            +{scoreDelta} pts
          </span>
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        {/* Row 1: Original Draft (Before) */}
        {cleanBefore && (
          <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                Original Draft (Vague Scope / Passive Duty)
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-muted)] line-through decoration-rose-400/50 italic">
              "{cleanBefore}"
            </p>
          </div>
        )}

        {/* Row 2: Optimized Google XYZ Bullet (After) */}
        <div className="p-3.5 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Optimized Google XYZ (Action + Scale + Outcome)
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {charCount} chars • {wordCount} words
            </span>
          </div>

          <div className="text-xs sm:text-[13px] font-mono leading-relaxed text-[var(--text-primary)] select-all whitespace-pre-wrap">
            {renderOptimizedText()}
          </div>

          {/* Metric calibration note if present */}
          {metricImpact && (
            <div className="mt-2 text-[11px] text-[var(--text-secondary)] italic border-t border-emerald-500/20 pt-2 flex items-start gap-1.5">
              <span className="text-emerald-500 font-bold not-italic">Impact:</span>
              <span>{metricImpact}</span>
            </div>
          )}
        </div>

        {/* Weaved Target Keywords Pills */}
        {keywords && keywords.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] font-medium text-[var(--text-muted)]">Weaved market tools:</span>
            {keywords.map((kw, i) => (
              <span
                key={i}
                className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"
              >
                ✓ {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer: 1-Click Copy Action */}
      <div className="px-3.5 py-2.5 bg-[var(--surface-subtle)] border-t border-[var(--border-default)] flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)]">
          Ready to paste into your resume
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-3 py-1.5 rounded-lg shadow-sm cursor-pointer transition-all"
        >
          {copied ? (
            <>
              <Check size={14} weight="bold" />
              <span>Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy size={14} weight="bold" />
              <span>Copy Optimized Bullet</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default DiffSnippetCard
