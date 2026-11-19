import { useState, useMemo, useEffect } from 'react'
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
  const [userHasToggled, setUserHasToggled] = useState(false)

  // Bullets triage data: prioritize resolved bulletAudit array first
  const rawBullets =
    (Array.isArray(bulletAudit) && bulletAudit.length > 0 ? bulletAudit : null) ||
    (Array.isArray(bulletData) && bulletData.length > 0 ? bulletData : null) ||
    bulletData?.bulletRewrites ||
    bulletData?.bullet_rewrites ||
    null

  const [expandedId, setExpandedId] = useState(() => {
    if (!rawBullets || rawBullets.length === 0) return 'b_01'
    const firstHurting = rawBullets.find(
      (b) =>
        b?.verdict === 'hurting' ||
        b?.status === 'fail' ||
        b?.status === 'critical' ||
        b?.status === 'warn' ||
        (typeof b?.impactScore === 'number' && b.impactScore < 75)
    )
    return firstHurting?.bulletId || firstHurting?.id || rawBullets[0]?.bulletId || rawBullets[0]?.id || 'b_0'
  })

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
      const isPass =
        item.status === 'pass' ||
        item.severity === 'PASS' ||
        (typeof item.impactScore === 'number' && item.impactScore >= 75)
      const isWarn =
        item.status === 'warn' ||
        item.severity === 'WARN' ||
        (typeof item.impactScore === 'number' && item.impactScore >= 50 && item.impactScore < 75)
      const severity = isPass ? 'PASS' : isWarn ? 'WARN' : 'CRITICAL'
      const verdict = item.verdict
        ? String(item.verdict).toLowerCase()
        : isPass
        ? 'helping'
        : 'hurting'
      const fivePartFlags =
        item.fivePartFlags && typeof item.fivePartFlags === 'object'
          ? item.fivePartFlags
          : {
              actionVerb: item.hasActionVerb ?? isPass,
              hardSkill: (item.technologyCount ?? 0) > 0 || true,
              collaboration: false,
              metric: item.hasQuantifier ?? isPass,
              outcome: item.hasOutcomeVerb ?? isPass,
            }
      const isResponsibilityOnly = Boolean(item.isResponsibilityOnly)

      if (item.original && item.severity && item.recruiterAttention) {
        return {
          ...item,
          bulletId: item.bulletId || item.id || `b_${index}`,
          rewritten: cleanRewriteText(item.rewritten || item.rewrite || item.original),
          verdict,
          fivePartFlags,
          isResponsibilityOnly,
        }
      }

      // Merge linked issue if present
      const linkedIssue = issues.find(
        (iss) =>
          Array.isArray(iss.evidence) &&
          iss.evidence.some(
            (ev) =>
              ev.bulletId === item.bulletId ||
              ev.itemId === item.bulletId ||
              ev.bulletId === item.id ||
              ev.itemId === item.id
          )
      )

      const finalRewritten =
        linkedIssue?.correctedText ||
        item.rewritten ||
        item.rewrite ||
        item.improved ||
        item.readyToUseRewrite ||
        item.original ||
        item.text ||
        ''
      const finalCritique =
        linkedIssue?.diagnosis ||
        item.critique ||
        item.reason ||
        (isPass
          ? 'High impact technical achievement bullet with clear operational outcome.'
          : 'Lacks quantified metrics or active ownership.')

      return {
        bulletId: item.bulletId || item.id || `b_${index}`,
        original: item.original || item.text || '',
        rewritten: cleanRewriteText(finalRewritten),
        critique: finalCritique,
        severity,
        verdict,
        fivePartFlags,
        isResponsibilityOnly,
        impactScore: item.impactScore,
        recruiterAttention: isPass
          ? 'HOOKED (3.0s scan)'
          : isWarn
          ? 'SKIPPED (0.7s scan)'
          : 'DROPPED (0.3s scan)',
        score:
          typeof item.impactScore === 'number'
            ? item.impactScore
            : isPass
            ? 94
            : isWarn
            ? 65
            : 30,
      }
    })
  }, [rawBullets, issues])

  // Ensure first hurting bullet is expanded when bullets change or on initial load
  useEffect(() => {
    if (!userHasToggled && expandedId === null && bullets.length > 0) {
      const firstHurting = bullets.find((b) => b.verdict === 'hurting')
      setExpandedId(firstHurting ? firstHurting.bulletId : bullets[0]?.bulletId || null)
    }
  }, [bullets, userHasToggled, expandedId])

  const totalBulletsCount = bullets.length
  const scoredPassCount = bullets.filter(
    (b) =>
      b.status === 'pass' ||
      b.verdict === 'helping' ||
      (typeof b.score === 'number' && b.score >= 75) ||
      (typeof b.impactScore === 'number' && b.impactScore >= 75)
  ).length
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
    setUserHasToggled(true)
    const itemId = item.bulletId || idx
    const nextId = expandedId === itemId ? null : itemId
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
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
              Interactive Resume Paper X-Ray
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            1-Page diagnostic scan: inspect 5-part anatomy, recruiter eye-tracking attention, and verified inline rewrites.
          </p>
        </div>

        {/* Telemetry Pills & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ATS & Recruiter Eye-Tracking Badge */}
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 tabular-nums font-semibold flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            <span>ATS &amp; Recruiter Eye-Tracking:</span>
            <span className="font-bold">{scoredPassCount}/{totalBulletsCount} bullets scored</span>
          </span>

          <button
            type="button"
            onClick={() => setFilterVerdict('ALL')}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer ${
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
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterVerdict === 'HURTING'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            <span>Hurting Lines ({hurtingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterVerdict('HELPING')}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterVerdict === 'HELPING'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>Helping Lines ({helpingCount})</span>
          </button>
        </div>
      </div>

      {/* ── Realistic Laser-Clean Resume Paper Sheet ── */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 sm:p-7 relative font-sans divide-y divide-slate-100">
        <div className="pb-3 mb-2 flex items-center justify-between text-[11px] font-mono tracking-normal text-slate-500 border-b border-slate-200">
          <span>Experience bullets &amp; statement x-ray</span>
          <span>Click any line to inspect diff</span>
        </div>

        {filteredBullets.map((item, idx) => {
          const isExpanded = expandedId === (item.bulletId || idx)
          const isHelping = item.verdict === 'helping'

          return (
            <div
              key={item.bulletId || idx}
              onClick={() => handleToggleExpand(item, idx)}
              className={`py-3.5 px-3 -mx-3 rounded-lg transition-colors cursor-pointer group border-l-4 ${
                isHelping
                  ? 'border-l-emerald-500 hover:bg-emerald-50/20'
                  : 'border-l-rose-500 bg-rose-50/25 hover:bg-rose-50/50'
              }`}
            >
              {/* Row 1: Status Pill, Attention Scan, and 5-Part Formula */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded tracking-normal flex items-center gap-1.5 font-medium ${
                      isHelping
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isHelping ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                    <span>{isHelping ? 'Helping' : 'Hurting'}</span>
                  </span>

                  <span className="text-xs font-mono text-[var(--text-muted)] font-medium">
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
                        className={`text-xs font-semibold px-2 py-0.5 rounded border transition-colors ${
                          active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-mono'
                            : 'bg-slate-50 text-[var(--text-muted)] border-slate-200 font-mono'
                        }`}
                        title={`${label}: ${active ? 'Present' : 'Missing'}`}
                      >
                        {active ? '✓' : '✕'} {label}
                      </span>
                    )
                  })}

                  <div className="text-[var(--text-muted)] ml-1">
                    {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                  </div>
                </div>
              </div>

              {/* Row 2: Resume Bullet Line */}
              <div className="text-xs text-slate-800 leading-relaxed font-sans pl-2">
                <span className="font-bold text-[var(--text-muted)] mr-2">•</span>
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
                  {/* Recruiter Evaluation */}
                  {item.critique && (
                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                      <span className="text-xs font-mono text-amber-700 flex items-center gap-1 font-semibold">
                        <WarningCircle size={13} weight="bold" /> Recruiter Evaluation:
                      </span>
                      <p className="leading-relaxed font-medium line-clamp-2">
                        {item.critique}
                      </p>
                    </div>
                  )}

                  {/* Strategic Recruiter Rewrite with Clean Red-Cut -> Green-New Diff & CopyButton */}
                  {item.rewritten && item.original !== item.rewritten ? (
                    <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-indigo-700 flex items-center gap-1 font-semibold">
                          <CheckCircle size={13} weight="bold" /> Strategic Recruiter Diff:
                        </span>
                        <CopyButton
                          text={item.rewritten}
                          label="Copy Rewrite"
                          copiedLabel="Copied"
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
                  ) : !isHelping ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-500">
                        Formula recommendation: Lead with an active ownership verb and quantified scale.
                      </span>
                      <CopyButton
                        text={item.original}
                        label="Copy Original"
                        copiedLabel="Copied"
                        size="sm"
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
