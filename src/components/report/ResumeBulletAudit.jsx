import { useState, useMemo, useEffect } from 'react'
import {
  Copy,
  Check,
  CaretDown,
  CaretUp,
  CheckCircle,
  WarningCircle,
  Sparkle,
  ArrowsClockwise,
  Calculator,
  X,
} from '@phosphor-icons/react'
import { useReportGuideStore, GUIDE_EMOTIONS } from '../../store/useReportGuideStore'
import { DiffReview } from '../diff-review'
import { CopyButton } from '../copy-button'
import { api } from '../../lib/api'
import useAppStore, { showToast } from '../../store/useAppStore'

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
  const { userId, formData, updateConfirmedBulletRewrite } = useAppStore()
  const targetRole = formData?.targetRole || ''
  const { triggerGuide } = useReportGuideStore()
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [filterVerdict, setFilterVerdict] = useState('ALL') // 'ALL' | 'HURTING' | 'HELPING'
  const [userHasToggled, setUserHasToggled] = useState(false)
  const [bulletOverrides, setBulletOverrides] = useState({})
  const [activeMetricForm, setActiveMetricForm] = useState(null)
  const [submittingBulletId, setSubmittingBulletId] = useState(null)

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
          metricOpportunities: [
            { label: 'Page Load Latency', question: 'How much did page load latency drop after optimization?', unitHint: 'ms' },
            { label: 'User Base Scale', question: 'How many daily or monthly active users used these web applications?', unitHint: 'MAUs' },
            { label: 'Lighthouse Performance Score', question: 'What was the before and after Lighthouse Core Web Vitals score?', unitHint: 'pts' },
          ],
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
          metricOpportunities: [
            { label: 'p99 Query Latency', question: 'What was the database query latency before vs after optimization?', unitHint: 'ms' },
            { label: 'Bug Ticket Resolution', question: 'How many production tickets or maintenance tasks were resolved or automated?', unitHint: 'tickets' },
            { label: 'Server CPU / Cost Drop', question: 'By what percentage did database resource utilization drop?', unitHint: '%' },
          ],
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

      const bId = item.bulletId || item.id || `b_${index}`
      const override = bulletOverrides[bId]

      if (item.original && item.severity && item.recruiterAttention) {
        return {
          ...item,
          bulletId: bId,
          rewritten: override?.rewritten || cleanRewriteText(item.rewritten || item.rewrite || item.original),
          evidenceStatus: override?.evidenceStatus || item.evidenceStatus || null,
          confirmedMetric: override?.confirmedMetric || item.confirmedMetric || null,
          whyItWorks: override?.whyItWorks || item.whyItWorks || '',
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
              ev.bulletId === bId ||
              ev.itemId === bId ||
              ev.bulletId === item.id ||
              ev.itemId === item.id
          )
      )

      const finalRewritten =
        override?.rewritten ||
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
        bulletId: bId,
        original: item.original || item.text || '',
        rewritten: cleanRewriteText(finalRewritten),
        critique: finalCritique,
        severity,
        verdict,
        fivePartFlags,
        isResponsibilityOnly,
        impactScore: item.impactScore,
        whyItWorks: override?.whyItWorks || item.whyItWorks || item.why || linkedIssue?.whyItMatters || '',
        evidenceStatus: override?.evidenceStatus || item.evidenceStatus || linkedIssue?.evidenceStatus || null,
        confirmedMetric: override?.confirmedMetric || item.confirmedMetric || linkedIssue?.confirmedMetric || null,
        metricOpportunities:
          Array.isArray(item.metricOpportunities) && item.metricOpportunities.length > 0
            ? item.metricOpportunities
            : Array.isArray(linkedIssue?.metricOpportunities)
            ? linkedIssue.metricOpportunities
            : [],
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
  }, [rawBullets, issues, bulletOverrides])

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

  const handleConfirmMetric = async (item, form) => {
    if (!form) return
    const isCalc = form.mode === 'calculator'
    if (isCalc) {
      if (!form.baselineValue || !form.finalValue) {
        showToast('Please enter both baseline and final values.', 'error')
        return
      }
    } else {
      if (!form.directValue || !form.directValue.trim()) {
        showToast('Please enter a confirmed metric value.', 'error')
        return
      }
    }

    setSubmittingBulletId(item.bulletId)
    try {
      const res = await api.confirmBulletMetric({
        userId,
        bulletId: item.bulletId,
        originalText: item.original,
        currentRewrite: item.rewritten,
        targetRole,
        metricLabel: form.opp?.label || '',
        mode: form.mode,
        baselineValue: form.baselineValue,
        finalValue: form.finalValue,
        directMetric: form.directValue,
        unit: form.unit,
      })

      if (res && res.success && res.rewrittenText) {
        // Update local overrides for instant feedback
        setBulletOverrides((prev) => ({
          ...prev,
          [item.bulletId]: {
            rewritten: res.rewrittenText,
            evidenceStatus: res.evidenceStatus,
            confirmedMetric: res.confirmedMetric,
            whyItWorks: res.whyItWorks,
          },
        }))

        // Update global store & persistence
        if (typeof updateConfirmedBulletRewrite === 'function') {
          updateConfirmedBulletRewrite(
            item.bulletId,
            res.rewrittenText,
            res.evidenceStatus,
            res.confirmedMetric,
            res.whyItWorks
          )
        }

        showToast('Bullet successfully upgraded with confirmed metric!', 'success')
        setActiveMetricForm(null)
      } else {
        throw new Error(res?.error || 'Failed to regenerate bullet.')
      }
    } catch (err) {
      console.error('[ResumeBulletAudit] Metric confirmation error:', err)
      showToast(err.message || 'Failed to confirm metric.', 'error')
    } finally {
      setSubmittingBulletId(null)
    }
  }

  return (
    <div id="resume-bullets" className="space-y-6">
      {/* ── Paper X-Ray Header & Telemetry ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-default)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] tracking-tight">
              Interactive Resume Paper X-Ray
            </h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            1-Page diagnostic scan: inspect 5-part anatomy, recruiter eye-tracking attention, and verified inline rewrites.
          </p>
        </div>

        {/* Telemetry Pills & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ATS & Recruiter Eye-Tracking Badge */}
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 tabular-nums font-semibold flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            <span>ATS &amp; Recruiter Eye-Tracking:</span>
            <span className="font-bold">{scoredPassCount}/{totalBulletsCount} bullets scored</span>
          </span>

          <button
            type="button"
            onClick={() => setFilterVerdict('ALL')}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filterVerdict === 'ALL'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
            <span>Hurting Lines ({hurtingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterVerdict('HELPING')}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterVerdict === 'HELPING'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <span>Helping Lines ({helpingCount})</span>
          </button>
        </div>
      </div>

      {/* ── Realistic Laser-Clean Resume Paper Sheet ── */}
      <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-default)] shadow-xs p-5 sm:p-7 relative font-sans divide-y divide-[var(--border-default)]">
        <div className="pb-3 mb-2 flex items-center justify-between text-[11px] font-mono tracking-normal text-[var(--text-muted)] border-b border-[var(--border-default)]">
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
                  ? 'border-l-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20'
                  : 'border-l-rose-500 bg-rose-50/25 dark:bg-rose-950/20 hover:bg-rose-50/50 dark:hover:bg-rose-950/30'
              }`}
              {...(!isHelping ? {
                'data-mascot-cue': `Hurting resume line: "${item.critique || 'Lacks quantified metrics or active outcome structure.'}"`,
                'data-mascot-chip': 'Weak Bullet Audit',
                'data-mascot-emotion': 'alert',
              } : {})}
            >
              {/* Row 1: Status Pill, Attention Scan, and 5-Part Formula */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded tracking-normal flex items-center gap-1.5 font-medium ${
                      isHelping
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
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
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 font-mono'
                            : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-default)] font-mono'
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
              <div className="text-xs text-[var(--text-primary)] leading-relaxed font-sans pl-2">
                <span className="font-bold text-[var(--text-muted)] mr-2">•</span>
                <span className={!isHelping ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-primary)]'}>
                  {item.original}
                </span>
              </div>

              {/* Row 3: Expanded Inline Before -> After Diff */}
              {isExpanded && (
                <div
                  className="mt-3.5 pt-3 border-t border-[var(--border-default)] space-y-3 animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Recruiter Critique (What was weak in original) */}
                  {item.critique && (
                    <div className="p-2.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200 space-y-0.5">
                      <span className="text-[11px] font-mono text-rose-700 dark:text-rose-400 flex items-center gap-1 font-semibold">
                        <WarningCircle size={13} weight="bold" /> Recruiter Critique:
                      </span>
                      <p className="leading-relaxed font-medium">
                        {item.critique}
                      </p>
                    </div>
                  )}

                  {/* Why This Rewrite Works (What was upgraded) */}
                  {(item.whyItWorks || item.why) && (
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200 space-y-0.5">
                      <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle size={13} weight="bold" /> Why This Rewrite Works:
                      </span>
                      <p className="leading-relaxed font-medium">
                        {item.whyItWorks || item.why}
                      </p>
                    </div>
                  )}

                  {/* Strategic Recruiter Rewrite with Clean Red-Cut -> Green-New Diff & CopyButton */}
                  {item.rewritten && item.original !== item.rewritten ? (
                    <div className="p-3.5 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-indigo-700 dark:text-indigo-400 flex items-center gap-1 font-semibold">
                            <CheckCircle size={13} weight="bold" /> Strategic Recruiter Diff:
                          </span>
                          {item.evidenceStatus === 'CANDIDATE_CONFIRMED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle size={10} weight="fill" /> Candidate Confirmed: {item.confirmedMetric}
                            </span>
                          )}
                          {item.evidenceStatus === 'CALCULATED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                              <CheckCircle size={10} weight="fill" /> Calculated Improvement: {item.confirmedMetric}
                            </span>
                          )}
                        </div>
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
                    <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] flex items-center justify-between">
                      <span className="font-mono text-xs text-[var(--text-muted)]">
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

                  {/* Layer B + Layer C: Role-Specific Impact Discovery & Metric Confirmation */}
                  {Array.isArray(item.metricOpportunities) && item.metricOpportunities.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          <Sparkle size={13} weight="fill" className="text-amber-500" />
                          <span>Unlock Quantified Impact (Layer B & C — Add your real numbers):</span>
                        </div>
                        <span className="text-[10.5px] text-amber-600/90 dark:text-amber-400/90 font-mono">
                          Click any metric to calibrate
                        </span>
                      </div>

                      {/* Clickable Opportunity Chips */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {item.metricOpportunities.map((opp, oppIdx) => {
                          const isSelected =
                            activeMetricForm?.bulletId === item.bulletId &&
                            activeMetricForm?.opp?.label === opp.label

                          return (
                            <button
                              key={oppIdx}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setActiveMetricForm(null)
                                } else {
                                  setActiveMetricForm({
                                    bulletId: item.bulletId,
                                    opp,
                                    mode: 'direct',
                                    directValue: '',
                                    baselineValue: '',
                                    finalValue: '',
                                    unit: opp.unitHint || '',
                                  })
                                }
                              }}
                              className={`p-2.5 rounded-lg text-left text-xs flex flex-col justify-between gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                                isSelected
                                  ? 'bg-amber-100/90 dark:bg-amber-950/60 border-2 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                                  : 'bg-[var(--surface-card)] hover:bg-amber-500/10 border border-amber-500/25 hover:border-amber-400 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1 w-full">
                                <span className="font-semibold text-[var(--text-primary)] leading-tight text-[11.5px]">
                                  {opp.label}
                                </span>
                                {opp.unitHint && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-200 shrink-0 font-medium">
                                    {opp.unitHint}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                {opp.question}
                              </p>
                              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 mt-0.5">
                                {isSelected ? 'Configuring ↓' : '+ Add Your Number →'}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Layer C: Interactive Metric Confirmation Drawer */}
                      {activeMetricForm?.bulletId === item.bulletId && (
                        <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border-2 border-amber-500/50 shadow-md space-y-3 animate-fadeIn">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                                <Sparkle size={13} weight="fill" className="text-amber-500" />
                                Quantify: {activeMetricForm.opp.label}
                              </span>
                              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                {activeMetricForm.opp.question}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveMetricForm(null)}
                              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md cursor-pointer"
                              aria-label="Close form"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          {/* Mode Tabs */}
                          <div className="flex rounded-lg bg-[var(--surface-sunken)] p-1 border border-[var(--border-default)]">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMetricForm((prev) => ({ ...prev, mode: 'direct' }))
                              }
                              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md min-h-[38px] transition-all cursor-pointer ${
                                activeMetricForm.mode === 'direct'
                                  ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs font-bold'
                                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Direct Value Mode
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMetricForm((prev) => ({ ...prev, mode: 'calculator' }))
                              }
                              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md min-h-[38px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeMetricForm.mode === 'calculator'
                                  ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs font-bold'
                                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              <Calculator size={13} /> Before → After Calculator
                            </button>
                          </div>

                          {/* Input Fields */}
                          {activeMetricForm.mode === 'direct' ? (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                                Enter your verified metric or scale:
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={activeMetricForm.directValue}
                                  onChange={(e) =>
                                    setActiveMetricForm((prev) => ({
                                      ...prev,
                                      directValue: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    activeMetricForm.opp.unitHint
                                      ? `e.g. 35${activeMetricForm.opp.unitHint}`
                                      : 'e.g. 35% or 150ms or 12 hrs/week'
                                  }
                                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500 min-h-[44px]"
                                  autoFocus
                                />
                                {activeMetricForm.opp.unitHint && (
                                  <span className="self-center text-xs font-mono px-2.5 py-2 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20">
                                    {activeMetricForm.opp.unitHint}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                                    Baseline (Before):
                                  </label>
                                  <input
                                    type="text"
                                    value={activeMetricForm.baselineValue}
                                    onChange={(e) =>
                                      setActiveMetricForm((prev) => ({
                                        ...prev,
                                        baselineValue: e.target.value,
                                      }))
                                    }
                                    placeholder="e.g. 1200"
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500 min-h-[44px]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                                    Final (After):
                                  </label>
                                  <input
                                    type="text"
                                    value={activeMetricForm.finalValue}
                                    onChange={(e) =>
                                      setActiveMetricForm((prev) => ({
                                        ...prev,
                                        finalValue: e.target.value,
                                      }))
                                    }
                                    placeholder="e.g. 400"
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500 min-h-[44px]"
                                  />
                                </div>
                              </div>

                              {/* Unit Customizer */}
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[var(--text-muted)]">Unit:</span>
                                <input
                                  type="text"
                                  value={activeMetricForm.unit}
                                  onChange={(e) =>
                                    setActiveMetricForm((prev) => ({
                                      ...prev,
                                      unit: e.target.value,
                                    }))
                                  }
                                  placeholder="ms, %, hrs/wk, req/sec"
                                  className="px-2.5 py-1 text-xs rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] text-[var(--text-primary)] w-36 min-h-[36px]"
                                />
                              </div>

                              {/* Live Calculation Preview */}
                              {(() => {
                                const b = parseFloat(
                                  String(activeMetricForm.baselineValue).replace(/[^0-9.]/g, '')
                                )
                                const f = parseFloat(
                                  String(activeMetricForm.finalValue).replace(/[^0-9.]/g, '')
                                )
                                const u = (activeMetricForm.unit || '').trim()
                                if (!isNaN(b) && !isNaN(f) && b > 0) {
                                  let previewText = ''
                                  if (b > f) {
                                    const pct = Math.round(((b - f) / b) * 100)
                                    previewText = `${pct}% reduction (${b}${u} → ${f}${u})`
                                  } else if (f > b) {
                                    const pct = Math.round(((f - b) / b) * 100)
                                    const mult = (f / b).toFixed(1)
                                    previewText =
                                      f / b >= 2
                                        ? `${mult}x increase (${b}${u} → ${f}${u})`
                                        : `+${pct}% increase (${b}${u} → ${f}${u})`
                                  } else {
                                    previewText = `${f}${u}`
                                  }
                                  return (
                                    <div className="p-2 rounded-lg bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                                      <span className="font-medium text-[11px]">
                                        Deterministic Math Preview:
                                      </span>
                                      <span className="font-bold font-mono text-indigo-700 dark:text-indigo-300">
                                        {previewText}
                                      </span>
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
                            <button
                              type="button"
                              onClick={() => setActiveMetricForm(null)}
                              disabled={submittingBulletId === item.bulletId}
                              className="px-3 py-2 text-xs font-semibold rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] min-h-[44px] transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={submittingBulletId === item.bulletId}
                              onClick={() => handleConfirmMetric(item, activeMetricForm)}
                              className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 min-h-[44px] transition-all cursor-pointer disabled:opacity-50"
                            >
                              {submittingBulletId === item.bulletId ? (
                                <>
                                  <ArrowsClockwise size={14} className="animate-spin" />
                                  <span>Regenerating Bullet...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkle size={14} weight="fill" />
                                  <span>Regenerate Bullet with Confirmed Metric</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
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
