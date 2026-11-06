import React, { useState, useMemo } from 'react'
import {
  Sparkle,
  Copy,
  Check,
} from '@phosphor-icons/react'

/**
 * ResumeBulletAudit — Interactive, high-density bullet review workspace.
 * Features:
 * - Split-Pane Before/After Bullet Diff (Red original vs Green Google XYZ rewrite).
 * - 3 Segmented Filter Pills (Critical Fixes, Needs Impact Metrics, Strong Bullets, View All).
 * - Collapsible "Why Recruiters Skip" reason.
 * - Interactive Scale Metric selector chips.
 * - One-click clipboard copy with feedback.
 * - Preserves complete print view for PDF export.
 */

const STATUS_STYLES = {
  fix: {
    chip: 'bg-rose-50 border-rose-200 text-rose-700 font-bold',
    label: 'Critical Fix',
  },
  warn: {
    chip: 'bg-amber-50 border-amber-200 text-amber-700 font-bold',
    label: 'Improvement',
  },
  pass: {
    chip: 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold',
    label: 'Strong',
  },
}

export function balanceParentheses(str) {
  if (!str || typeof str !== 'string') return str
  const openCount = (str.match(/\(/g) || []).length
  const closeCount = (str.match(/\)/g) || []).length
  if (openCount > closeCount) {
    const diff = openCount - closeCount
    if (/\.\s*$/.test(str)) {
      return str.replace(/\.\s*$/, ')'.repeat(diff) + '.')
    }
    return str + ')'.repeat(diff)
  }
  return str
}

function cleanRewriteText(text) {
  if (!text || typeof text !== 'string') return text
  let cleaned = text
    .replace(/(\s+(?:by|to|of|across|for|with|at|in|from))?\s*\[ADD:[^\]]*\]/gi, '')
    .replace(/\[ADD:[^\]]*\]/gi, '')
    .replace(/\b(by|with|to|in|of|for|and|on|at|from)\s+\1\b/gi, '$1')
    .replace(/\](?=[A-Za-z0-9])/g, '] ')
    .replace(/\s+\b(?:by|to|of|across|for|with|at|in|from)\s*([.,;])/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return balanceParentheses(cleaned)
}

function ActionableBulletCard({ bullet, matchedIssue, light }) {
  const isFix = bullet.status === 'fix'

  const issueTitle = balanceParentheses(
    matchedIssue?.title ||
    bullet.reasonTitle ||
    bullet.reason ||
    (isFix ? 'Critical Phrasing Issue' : 'Phrasing Improvement')
  )

  let diagnosis = balanceParentheses(matchedIssue?.diagnosis || bullet.reason)
  const rawBulletText = bullet.text || bullet.originalText || matchedIssue?.evidence?.[0]?.originalText || ''
  const matchIng = rawBulletText.trim().replace(/^[•\-*▪–—\s]+/, '').match(/^([a-zA-Z]+ing)\b/i)
  if (matchIng && diagnosis && /participle/i.test(diagnosis)) {
    const actualGerund = matchIng[1].charAt(0).toUpperCase() + matchIng[1].slice(1)
    diagnosis = diagnosis.replace(/(?:action\s+)?participle\s*(?:\(\s*['"‘’“”][^'"‘’“”]+['"‘’“”]\s*\)|['"‘’“”][^'"‘’“”]+['"‘’“”])/gi, `participle ('${actualGerund}')`)
  }
  const whyItMatters = balanceParentheses(matchedIssue?.whyItMatters || null)
  const rawRewrite =
    bullet.rewrite ||
    matchedIssue?.correctedText ||
    matchedIssue?.rewrite ||
    null
  const activeRewrite = cleanRewriteText(rawRewrite)

  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    const textToCopy = activeRewrite || bullet.text
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bullet-card print-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1222] p-4 sm:p-5 space-y-3.5 shadow-xs print:break-inside-avoid">
      {/* Header: Status Pill + Issue Title + Bullet ID */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${isFix ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {isFix ? 'Critical Fix' : 'Improvement'}
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
            {issueTitle}
          </span>
          {bullet.itemName && (
            <span className="text-[10px] font-mono text-slate-400">
              · {bullet.itemName}
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-slate-400 shrink-0">{bullet.bulletId}</span>
      </div>

      {/* Split-Pane Grid: Left = Before, Right = After */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        {/* Left: Original (Before) */}
        <div className="rounded-xl p-3.5 bg-rose-500/5 border border-rose-500/20 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Original Phrasing (Before)
            </span>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {bullet.text}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-rose-500/15 text-[11px] text-rose-700 dark:text-rose-300 font-medium">
            ⚠️ Flaw: {diagnosis || 'Lacks quantified metric and active engineering ownership.'}
          </div>
        </div>

        {/* Right: Recruiter Rewrite (After) */}
        <div className="rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Recruiter Google XYZ (After)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 transition-all flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={11} weight="bold" />
                    <span>✓ Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} weight="bold" />
                    <span>📋 Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs leading-relaxed font-semibold text-slate-900 dark:text-emerald-100">
              {activeRewrite || bullet.text}
            </p>
          </div>
        </div>
      </div>

      {/* Collapsible "Why Recruiters Skip" Bar */}
      {whyItMatters && (
        <details className="group text-xs text-slate-500 dark:text-slate-400 pt-1">
          <summary className="cursor-pointer font-bold text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline list-none flex items-center gap-1">
            <span>💡 Why recruiters skip this bullet (Tap to expand)</span>
          </summary>
          <p className="mt-2 pl-2 border-l-2 border-indigo-400 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
            {whyItMatters}
          </p>
        </details>
      )}
    </div>
  )
}

function CompactGoodBulletRow({ bullet, light }) {
  return (
    <div
      className={`bullet-card print-card flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
        light
          ? 'bg-emerald-50/20 border-emerald-100 text-slate-700'
          : 'bg-emerald-950/20 border-emerald-900/40 text-slate-300'
      }`}
    >
      <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 mt-0.5">
        GOOD
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-xs leading-relaxed">{bullet.text}</span>
        {bullet.itemName && (
          <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
            {bullet.itemName} {bullet.section ? `• ${bullet.section}` : ''}
          </span>
        )}
      </div>
      <span className="text-[10px] font-mono shrink-0 text-slate-400">
        {bullet.bulletId}
      </span>
    </div>
  )
}

export default function ResumeBulletAudit({ bulletAudit, issues = [], variant = 'dark' }) {
  if (!Array.isArray(bulletAudit) || bulletAudit.length === 0) return null
  const light = variant === 'light'

  // Map issues by bulletId for instant, rich diagnosis pairing
  const issueMap = useMemo(() => {
    const map = new Map()
    if (Array.isArray(issues)) {
      issues.forEach((iss) => {
        if (!iss) return
        const evList = Array.isArray(iss.evidence)
          ? iss.evidence
          : iss.evidence
          ? [iss.evidence]
          : []
        evList.forEach((ev) => {
          if (ev?.bulletId) {
            map.set(ev.bulletId, iss)
          }
        })
      })
    }
    return map
  }, [issues])

  // Filter tab state: default to 'fix' so candidate sees only critical rewrites
  const [activeFilter, setActiveFilter] = useState('fix')

  const fixCount = bulletAudit.filter((b) => b.status === 'fix').length
  const warnCount = bulletAudit.filter((b) => b.status === 'warn').length
  const passCount = bulletAudit.filter((b) => b.status === 'pass').length

  const filteredBullets = useMemo(() => {
    if (activeFilter === 'fix') return bulletAudit.filter((b) => b.status === 'fix')
    if (activeFilter === 'warn') return bulletAudit.filter((b) => b.status === 'warn')
    if (activeFilter === 'pass') return bulletAudit.filter((b) => b.status === 'pass')
    return bulletAudit
  }, [bulletAudit, activeFilter])

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Actionable Bullet Audit & Side-by-Side Diff
          </h3>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Compare original draft lines with recruiter-calibrated rewrites calibrated to Google's XYZ formula.
          </div>
        </div>

        {/* 3-Pill Filter Controls */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveFilter('fix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'fix'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🔴 Critical Fixes</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{fixCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('warn')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'warn'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🟡 Needs Impact Metrics</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{warnCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('pass')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'pass'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🟢 Strong Bullets</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{passCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeFilter === 'all'
                ? 'underline font-bold text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            View All ({bulletAudit.length})
          </button>
        </div>
      </div>

      {/* Screen View: Filtered Bullets */}
      <div className="space-y-3 print:hidden">
        {filteredBullets.length > 0 ? (
          filteredBullets.map((bullet, idx) => {
            const matchedIssue = issueMap.get(bullet.bulletId)
            if (bullet.status === 'pass') {
              return (
                <CompactGoodBulletRow
                  key={bullet.bulletId || idx}
                  bullet={bullet}
                  light={light}
                />
              )
            }
            return (
              <ActionableBulletCard
                key={bullet.bulletId || idx}
                bullet={bullet}
                matchedIssue={matchedIssue}
                light={light}
              />
            )
          })
        ) : (
          <div className="p-8 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <p className="text-xs font-semibold text-slate-500">
              No bullets in this category. Select another filter pill above.
            </p>
          </div>
        )}
      </div>

      {/* Print View: All Bullets Rendered Sequentially for PDF */}
      <div className="hidden print:block print:space-y-3">
        {bulletAudit.map((bullet, idx) => {
          const matchedIssue = issueMap.get(bullet.bulletId)
          if (bullet.status === 'pass') {
            return (
              <CompactGoodBulletRow
                key={bullet.bulletId || idx}
                bullet={bullet}
                light={light}
              />
            )
          }
          return (
            <ActionableBulletCard
              key={bullet.bulletId || idx}
              bullet={bullet}
              matchedIssue={matchedIssue}
              light={light}
            />
          )
        })}
      </div>
    </div>
  )
}

export { STATUS_STYLES }
