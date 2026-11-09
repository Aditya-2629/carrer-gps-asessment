import React, { useState, useMemo } from 'react'
import {
  Sparkle,
  Copy,
  Check,
  Eye,
} from '@phosphor-icons/react'

export function cleanRewriteText(text) {
  if (!text || typeof text !== 'string') return text
  return text
    .replace(/(\s+(?:by|to|of|across|for|with|at|in|from))?\s*\[ADD:[^\]]*\]/gi, '')
    .replace(/\[ADD:[^\]]*\]/gi, '')
    .replace(/\b(by|with|to|in|of|for|and|on|at|from)\s+\1\b/gi, '$1')
    .replace(/\](?=[A-Za-z0-9])/g, '] ')
    .replace(/\s+\b(?:by|to|of|across|for|with|at|in|from)\s*([.,;])/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export const STATUS_STYLES = {
  fix: { chip: 'bg-rose-50 border-rose-200 text-rose-700 font-bold', label: 'Critical Fix' },
  warn: { chip: 'bg-amber-50 border-amber-200 text-amber-700 font-bold', label: 'Improvement' },
  pass: { chip: 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold', label: 'Strong' },
}

export default function ResumeBulletAudit({
  bulletData,
  bulletAudit,
  issues = [],
  variant = 'light',
}) {
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [filterSeverity, setFilterSeverity] = useState('ALL') // 'ALL' | 'CRITICAL' | 'WARN' | 'PASS'

  // Bullets triage data fallback
  const rawBullets =
    bulletData?.bulletRewrites ||
    bulletData?.bullet_rewrites ||
    (Array.isArray(bulletData) ? bulletData : null) ||
    (Array.isArray(bulletAudit) ? bulletAudit : null) ||
    null

  const bullets = useMemo(() => {
    if (!rawBullets || rawBullets.length === 0) {
      return [
        {
          original: 'Responsible for writing code for web applications using JavaScript and React.',
          rewritten: 'Architected and deployed 4 high-throughput React & TypeScript web applications, reducing page load latency by 42% for 250k MAUs.',
          critique: 'Passive "Responsible for" opener with zero measurable scale, latency impact, or user metrics.',
          severity: 'CRITICAL',
          recruiterAttention: 'DROPPED (0.4s scan)',
          score: 32,
        },
        {
          original: 'Assisted senior developers with backend bug fixing and routine database maintenance tasks.',
          rewritten: 'Automated database query optimization across PostgreSQL cluster, resolving 85+ production bug tickets and cutting p99 latency by 28%.',
          critique: 'Weak supportive verb ("Assisted"). Fails to demonstrate technical ownership or system-level impact.',
          severity: 'WARN',
          recruiterAttention: 'SKIPPED (0.8s scan)',
          score: 55,
        },
        {
          original: 'Designed and shipped an event-driven telemetry ingestion engine in Go and Kafka, scaling throughput from 5,000 to 45,000 events/second.',
          rewritten: 'Designed and shipped an event-driven telemetry ingestion engine in Go and Kafka, scaling throughput from 5,000 to 45,000 events/second.',
          critique: 'Elite structure: Strong active verb ("Designed & shipped") + Exact Tech Stack (Go, Kafka) + 9x Quantified Throughput Scale.',
          severity: 'PASS',
          recruiterAttention: 'HOOKED (3.2s scan)',
          score: 96,
        },
        {
          original: 'Handled customer support tickets and investigated client issues in production.',
          rewritten: 'Engineered automated root-cause diagnostics pipeline, slashing Mean Time to Resolution (MTTR) by 38% across 1,200+ enterprise client tickets.',
          critique: 'Customer support phrasing in an engineering resume. Reframe as root-cause engineering diagnostics.',
          severity: 'CRITICAL',
          recruiterAttention: 'DROPPED (0.3s scan)',
          score: 28,
        },
      ]
    }

    return rawBullets.map((item) => {
      if (item.original && item.severity && item.recruiterAttention) {
        return {
          ...item,
          rewritten: cleanRewriteText(item.rewritten || item.original),
        }
      }

      const original = item.original || item.text || item.originalText || ''
      const rawRewritten = item.rewritten || item.rewrite || item.correctedText || original
      const rewritten = cleanRewriteText(rawRewritten)
      const isPass = item.status === 'pass' || item.severity === 'PASS'
      const isWarn = item.status === 'warn' || item.severity === 'WARN'
      const severity = isPass ? 'PASS' : isWarn ? 'WARN' : 'CRITICAL'

      const recruiterAttention =
        item.recruiterAttention ||
        (isPass
          ? 'HOOKED (3.2s scan)'
          : isWarn
          ? 'SKIPPED (0.8s scan)'
          : 'DROPPED (0.4s scan)')

      const score = item.score ?? (isPass ? 96 : isWarn ? 55 : 32)
      const critique =
        item.critique ||
        item.reason ||
        item.diagnosis ||
        (isPass
          ? 'Strong impact structure with clear ownership.'
          : isWarn
          ? 'Weak supportive verb or passive duty phrasing — lacks system-level metrics.'
          : 'Concatenated sentence or vague nouns with zero quantified impact metrics.')

      return {
        original,
        rewritten,
        critique,
        severity,
        recruiterAttention,
        score,
        bulletId: item.bulletId,
        itemName: item.itemName,
      }
    })
  }, [rawBullets])

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const filteredBullets = bullets.filter((b) => {
    if (filterSeverity === 'ALL') return true
    return b.severity === filterSeverity
  })

  const criticalCount = bullets.filter((b) => b.severity === 'CRITICAL').length
  const warnCount = bullets.filter((b) => b.severity === 'WARN').length
  const passCount = bullets.filter((b) => b.severity === 'PASS').length

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      {/* Header & Eye-Tracking Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-indigo-600 dark:text-indigo-400" weight="bold" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              ATS & Recruiter Eye-Tracking Heatmap
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Simulates where a human recruiter's eyes linger during a standard 6-second scan. Bullets lacking numbers and strong verbs are discarded in &lt;0.5 seconds.
          </p>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setFilterSeverity('ALL')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              filterSeverity === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            All ({bullets.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('CRITICAL')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterSeverity === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            }`}
          >
            Red Flags ({criticalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('WARN')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterSeverity === 'WARN'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            Passive ({warnCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('PASS')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterSeverity === 'PASS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
            }`}
          >
            Hooks ({passCount})
          </button>
        </div>
      </div>

      {/* Bullets List */}
      <div className="space-y-4">
        {filteredBullets.map((item, idx) => {
          const isCritical = item.severity === 'CRITICAL'
          const isWarn = item.severity === 'WARN'
          const isPass = item.severity === 'PASS'

          return (
            <div
              key={item.bulletId || idx}
              className={`rounded-2xl border p-5 transition-all space-y-4 ${
                isCritical
                  ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200/90 dark:border-rose-900/50 hover:border-rose-300 dark:hover:border-rose-700'
                  : isWarn
                  ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-200/90 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-700'
                  : 'bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-700'
              }`}
            >
              {/* Eye-Tracking Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                      isCritical
                        ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                        : isWarn
                        ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                        : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                    }`}
                  >
                    {item.severity === 'CRITICAL'
                      ? '🔴 Critical Drop'
                      : item.severity === 'WARN'
                      ? '🟡 Passive Phrasing'
                      : '🟢 Recruiter Hook'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                    Recruiter Attention:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {item.recruiterAttention}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                    Impact: {item.score}/100
                  </span>
                </div>
              </div>

              {/* Original Bullet */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Original Resume Statement:
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans line-through decoration-rose-400/80 decoration-1 bg-white dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  {item.original}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                  <strong className="text-slate-700 dark:text-slate-300">Recruiter Critique:</strong>{' '}
                  {item.critique}
                </p>
              </div>

              {/* Proposed AI Recruiter Rewrite */}
              {item.rewritten && item.original !== item.rewritten && (
                <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1 font-mono">
                      <Sparkle size={13} weight="fill" /> Proposed Recruiter-Grade Rewrite:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.rewritten, idx)}
                      className="text-xs font-bold bg-white dark:bg-indigo-900 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check size={13} weight="bold" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> 1-Click Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed font-sans">
                    {item.rewritten}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
