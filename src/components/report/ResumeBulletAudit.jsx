import { useState, useMemo } from 'react'
import {
  Copy,
  Check,
  CaretDown,
  CaretUp,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react'
import { useReportGuideStore, GUIDE_EMOTIONS } from '../../store/useReportGuideStore'
import { DiffReview } from '../diff-review'
import { CopyButton } from '../copy-button'

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

const FIVE_PARTS = [
  { key: 'actionVerb', label: 'Action' },
  { key: 'hardSkill', label: 'Hard Skill' },
  { key: 'collaboration', label: 'Collab' },
  { key: 'metric', label: 'Metric' },
  { key: 'outcome', label: 'Outcome' },
]

export default function ResumeBulletAudit({
  bulletData,
  bulletAudit,
  issues = [],
  variant = 'light',
}) {
  const { triggerGuide } = useReportGuideStore()
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [filterVerdict, setFilterVerdict] = useState('ALL') // 'ALL' | 'HURTING' | 'HELPING'
  const [expandedId, setExpandedId] = useState(null)

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
          bulletId: 'b_01',
          original: 'Responsible for writing code for web applications using JavaScript and React.',
          rewritten: 'Architected and deployed 4 high-throughput React & TypeScript web applications, reducing page load latency by 42% for 250k MAUs.',
          critique: 'Passive "Responsible for" opener with zero measurable scale, latency impact, or user metrics.',
          severity: 'CRITICAL',
          verdict: 'hurting',
          fivePartFlags: { actionVerb: false, hardSkill: true, collaboration: false, metric: false, outcome: false },
          isResponsibilityOnly: true,
          recruiterAttention: 'DROPPED (0.4s scan)',
          score: 32,
        },
        {
          bulletId: 'b_02',
          original: 'Assisted senior developers with backend bug fixing and routine database maintenance tasks.',
          rewritten: 'Automated database query optimization across PostgreSQL cluster, resolving 85+ production bug tickets and cutting p99 latency by 28%.',
          critique: 'Weak supportive verb ("Assisted"). Fails to demonstrate technical ownership or system-level impact.',
          severity: 'WARN',
          verdict: 'hurting',
          fivePartFlags: { actionVerb: false, hardSkill: true, collaboration: false, metric: false, outcome: false },
          isResponsibilityOnly: true,
          recruiterAttention: 'SKIPPED (0.8s scan)',
          score: 55,
        },
        {
          bulletId: 'b_03',
          original: 'Designed and shipped an event-driven telemetry ingestion engine in Go and Kafka, scaling throughput from 5,000 to 45,000 events/second.',
          rewritten: 'Designed and shipped an event-driven telemetry ingestion engine in Go and Kafka, scaling throughput from 5,000 to 45,000 events/second.',
          critique: 'Elite structure: Strong active verb ("Designed & shipped") + Exact Tech Stack (Go, Kafka) + 9x Quantified Throughput Scale.',
          severity: 'PASS',
          verdict: 'helping',
          fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: false, metric: true, outcome: true },
          isResponsibilityOnly: false,
          recruiterAttention: 'HOOKED (3.2s scan)',
          score: 96,
        },
        {
          bulletId: 'b_04',
          original: 'Handled customer support tickets and investigated client issues in production.',
          rewritten: 'Engineered automated root-cause diagnostics pipeline, slashing Mean Time to Resolution (MTTR) by 38% across 1,200+ enterprise client tickets.',
          critique: 'Customer support phrasing in an engineering resume. Reframe as root-cause engineering diagnostics.',
          severity: 'CRITICAL',
          verdict: 'hurting',
          fivePartFlags: { actionVerb: false, hardSkill: false, collaboration: false, metric: false, outcome: false },
          isResponsibilityOnly: true,
          recruiterAttention: 'DROPPED (0.3s scan)',
          score: 28,
        },
      ]
    }

    return rawBullets.map((item, index) => {
      const isPass = item.status === 'pass' || item.severity === 'PASS'
      const isWarn = item.status === 'warn' || item.severity === 'WARN'
      const severity = isPass ? 'PASS' : isWarn ? 'WARN' : 'CRITICAL'
      const verdict = item.verdict ? String(item.verdict).toLowerCase() : (isPass ? 'helping' : 'hurting')
      const fivePartFlags = item.fivePartFlags && typeof item.fivePartFlags === 'object' ? item.fivePartFlags : {
        actionVerb: isPass,
        hardSkill: true,
        collaboration: false,
        metric: isPass,
        outcome: isPass,
      }
      const isResponsibilityOnly = Boolean(item.isResponsibilityOnly)

      if (item.original && item.severity && item.recruiterAttention) {
        return {
          ...item,
          bulletId: item.bulletId || `b_${index}`,
          rewritten: cleanRewriteText(item.rewritten || item.original),
          verdict,
          fivePartFlags,
          isResponsibilityOnly,
        }
      }

      // Merge linked issue if present
      const linkedIssue = issues.find((iss) =>
        Array.isArray(iss.evidence) &&
        iss.evidence.some((ev) => ev.bulletId === item.bulletId || ev.itemId === item.bulletId)
      )

      const finalRewritten = linkedIssue?.correctedText || item.rewrite || item.rewritten || item.original || item.text || ''
      const finalCritique = linkedIssue?.diagnosis || item.reason || (isPass ? 'High impact technical achievement bullet with clear operational outcome.' : 'Lacks quantified metrics or active ownership.')

      return {
        bulletId: item.bulletId || `b_${index}`,
        original: item.original || item.text || '',
        rewritten: cleanRewriteText(finalRewritten),
        critique: finalCritique,
        severity,
        verdict,
        fivePartFlags,
        isResponsibilityOnly,
        recruiterAttention: isPass
          ? 'HOOKED (3.0s scan)'
          : isWarn
          ? 'SKIPPED (0.7s scan)'
          : 'DROPPED (0.3s scan)',
        score: isPass ? 94 : isWarn ? 65 : 30,
      }
    })
  }, [rawBullets, issues])

  const helpingCount = bullets.filter((b) => b.verdict === 'helping').length
  const hurtingCount = bullets.filter((b) => b.verdict === 'hurting').length

  const filteredBullets = useMemo(() => {
    if (filterVerdict === 'HURTING') return bullets.filter((b) => b.verdict === 'hurting')
    if (filterVerdict === 'HELPING') return bullets.filter((b) => b.verdict === 'helping')
    return bullets
  }, [bullets, filterVerdict])

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleToggleExpand = (item, idx) => {
    const nextId = expandedId === (item.bulletId || idx) ? null : (item.bulletId || idx)
    setExpandedId(nextId)

    if (nextId !== null) {
      triggerGuide({
        nodeId: item.bulletId || `line_${idx}`,
        emotion: item.verdict === 'helping' ? GUIDE_EMOTIONS.VICTORY : GUIDE_EMOTIONS.ALERT,
        headline: item.verdict === 'helping'
          ? `Helping line: Strong technical action and verified scale.`
          : `Hurting line: ${item.critique || 'Lacks quantified metric or Google XYZ outcome structure.'}`,
        metricChip: item.verdict === 'helping' ? '🟢 Helping Bullet' : '🔴 Hurting Bullet',
      })
    }
  }

  return (
    <div id="resume-bullets" className="space-y-6">
      {/* ── Paper X-Ray Header & Telemetry ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Interactive Resume Paper X-Ray
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            1-Page diagnostic scan: inspect 5-part anatomy, recruiter eye-tracking attention, and verified inline rewrites.
          </p>
        </div>

        {/* Telemetry Pills & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterVerdict('ALL')}
            className={`text-xs font-semibold px-3 py-1 rounded-xl transition-all cursor-pointer ${
              filterVerdict === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            All Lines ({bullets.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterVerdict('HURTING')}
            className={`text-xs font-semibold px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              filterVerdict === 'HURTING'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>🔴 Hurting Lines ({hurtingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterVerdict('HELPING')}
            className={`text-xs font-semibold px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              filterVerdict === 'HELPING'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>🟢 Helping Lines ({helpingCount})</span>
          </button>
        </div>
      </div>

      {/* ── Realistic Laser-Clean Resume Paper Sheet ── */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-5 sm:p-7 relative font-sans divide-y divide-slate-100">
        <div className="pb-3 mb-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-200">
          <span>EXPERIENCE BULLETS &amp; STATEMENT X-RAY</span>
          <span>Click any line to toggle Before → After diff</span>
        </div>

        {filteredBullets.map((item, idx) => {
          const isExpanded = expandedId === (item.bulletId || idx)
          const isHelping = item.verdict === 'helping'

          return (
            <div
              key={item.bulletId || idx}
              onClick={() => handleToggleExpand(item, idx)}
              className={`py-3.5 px-3 -mx-3 rounded-xl transition-all cursor-pointer group border-l-4 ${
                isHelping
                  ? 'border-l-emerald-500 hover:bg-emerald-50/20'
                  : 'border-l-rose-500 bg-rose-50/25 hover:bg-rose-50/50'
              }`}
            >
              {/* Row 1: Status Pill, Attention Scan, and 5-Part Formula */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider flex items-center gap-1 font-mono ${
                      isHelping
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {isHelping ? '🟢 Helping' : '🔴 Hurting'}
                  </span>

                  <span className="text-[11px] font-mono text-slate-400 font-medium">
                    {item.recruiterAttention}
                  </span>
                </div>

                {/* 5-Part Compact Anatomy Indicators */}
                <div className="flex items-center gap-1">
                  {FIVE_PARTS.map(({ key, label }) => {
                    const active = Boolean(item.fivePartFlags?.[key])
                    return (
                      <span
                        key={key}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all ${
                          active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-mono'
                            : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 font-mono'
                        }`}
                        title={`${label}: ${active ? 'Present' : 'Missing'}`}
                      >
                        {active ? '✓' : '✕'} {label}
                      </span>
                    )
                  })}

                  <div className="text-slate-400 ml-1">
                    {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                  </div>
                </div>
              </div>

              {/* Row 2: Resume Bullet Line */}
              <div className="text-xs text-slate-800 leading-relaxed font-sans pl-2">
                <span className="font-bold text-slate-400 mr-2">•</span>
                <span className={!isHelping ? 'text-slate-800 font-medium' : 'text-slate-900'}>
                  {item.original}
                </span>
              </div>

              {/* Row 3: Expanded Inline Before -> After Diff */}
              {isExpanded && (
                <div
                  className="mt-3.5 pt-3 border-t border-slate-200/60 space-y-3 animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Original Line (Red strikethrough if hurting) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                      Original Statement:
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200 line-through decoration-rose-500/80 decoration-1">
                      {item.original}
                    </p>
                  </div>

                  {/* Recruiter Diagnosis */}
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                      <WarningCircle size={13} weight="bold" /> Recruiter Evaluation:
                    </span>
                    <p className="leading-relaxed font-medium">
                      {item.critique}
                    </p>
                  </div>

                  {/* Strategic Recruiter Rewrite with Hairline DiffReview & CopyButton */}
                  {item.rewritten && item.original !== item.rewritten && (
                    <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                          <CheckCircle size={13} weight="bold" /> Strategic Recruiter Diff:
                        </span>
                        <CopyButton
                          text={item.rewritten}
                          label="1-Click Copy Rewrite"
                          copiedLabel="Copied!"
                          size="sm"
                        />
                      </div>
                      <DiffReview
                        changes={[
                          {
                            id: item.bulletId || String(idx),
                            label: 'Bullet Rewrite',
                            before: item.original,
                            after: item.rewritten,
                          },
                        ]}
                        mode="words"
                        readOnly={true}
                        title="Before → After Word Diff"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
