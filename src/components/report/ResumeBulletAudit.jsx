import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Copy,
  Check,
  CaretDown,
  CaretUp,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  LockKey,
} from '@phosphor-icons/react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useReportGuideStore, GUIDE_EMOTIONS } from '../../store/useReportGuideStore'
import { DiffReview } from '../diff-review'
import { CopyButton } from '../copy-button'
import TeaserLockBlock from '../TeaserLockBlock'

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
  isTeaserLocked = false,
  bookingUrl = '',
  onOpenUnlockModal,
}) {
  const { triggerGuide } = useReportGuideStore()
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [filterVerdict, setFilterVerdict] = useState('ALL') // 'ALL' | 'HURTING' | 'HELPING'
  const [userHasToggled, setUserHasToggled] = useState(false)
  const [bulletOverrides, setBulletOverrides] = useState({})
  const hoverTimeoutRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const [lockedId, setLockedId] = useState(null)

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

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

    const mapped = rawBullets.map((item, index) => {
      if (item?.locked) {
        return {
          locked: true,
          bulletId: item.bulletId || item.id || `locked_${index}`,
          verdict: 'hurting',
          severity: 'CRITICAL',
          fivePartFlags: {},
        }
      }
      const isPass =
        item.status === 'pass' ||
        item.severity === 'PASS' ||
        (typeof item.impactScore === 'number' && item.impactScore >= 75)
      const isWarn =
        item.status === 'warn' ||
        item.severity === 'WARN' ||
        (typeof item.impactScore === 'number' && item.impactScore >= 50 && item.impactScore < 75)

      const bId = item.bulletId || item.id || `b_${index}`
      const override = bulletOverrides[bId]

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

      const origText = String(item.original || item.originalText || item.text || item.bullet || '').trim()
      const rawRewritten =
        override?.rewritten ||
        linkedIssue?.correctedText ||
        item.correctedText ||
        item.rewrittenText ||
        item.rewritten ||
        item.rewrite ||
        item.improved ||
        item.upgrade ||
        item.readyToUseRewrite ||
        origText
      const cleanedRewritten = cleanRewriteText(rawRewritten)

      const hasRephrase = Boolean(cleanedRewritten && origText && cleanedRewritten.toLowerCase() !== origText.toLowerCase())
      const hasBulletIssues =
        (Array.isArray(item.issues) && item.issues.length > 0) ||
        (Array.isArray(item.missingParts) && item.missingParts.length > 0)

      // A bullet is Helping ONLY if its verdict/pass is helping AND it has NO rephrase/upgrade/issues
      const rawVerdictHelping = item.verdict ? String(item.verdict).toLowerCase() === 'helping' : isPass
      const verdict = rawVerdictHelping && !hasRephrase && !hasBulletIssues ? 'helping' : 'hurting'
      const severity = verdict === 'helping' ? 'PASS' : isWarn ? 'WARN' : 'CRITICAL'

      const fivePartFlags =
        item.fivePartFlags && typeof item.fivePartFlags === 'object'
          ? item.fivePartFlags
          : {
              actionVerb: item.hasActionVerb ?? (verdict === 'helping'),
              hardSkill: (item.technologyCount ?? 0) > 0 || true,
              collaboration: false,
              metric: item.hasQuantifier ?? (verdict === 'helping'),
              outcome: item.hasOutcomeVerb ?? (verdict === 'helping'),
            }
      const isResponsibilityOnly = Boolean(item.isResponsibilityOnly)

      let rawCritique =
        linkedIssue?.diagnosis ||
        item.critique ||
        item.diagnosis ||
        item.reason ||
        (Array.isArray(item.issues) && item.issues.length > 0 ? item.issues.join(' ') : '') ||
        (verdict === 'helping'
          ? 'High impact technical achievement bullet with clear operational outcome.'
          : 'Lacks quantified metrics or active ownership.')

      if (verdict === 'hurting' && /no defects found|clear,\s*specific/i.test(rawCritique)) {
        rawCritique = 'Lacks quantified business outcome and measurable impact — reads as a routine task rather than a distinctive achievement.'
      }

      if (item.original && item.severity && item.recruiterAttention) {
        return {
          ...item,
          bulletId: bId,
          original: origText,
          rewritten: cleanedRewritten,
          critique: rawCritique,
          evidenceStatus: override?.evidenceStatus || item.evidenceStatus || null,
          confirmedMetric: override?.confirmedMetric || item.confirmedMetric || null,
          whyItWorks: override?.whyItWorks || item.whyItWorks || '',
          severity,
          verdict,
          fivePartFlags,
          isResponsibilityOnly,
        }
      }

      return {
        bulletId: bId,
        original: origText,
        rewritten: cleanedRewritten,
        critique: rawCritique,
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
        recruiterAttention: verdict === 'helping'
          ? 'HOOKED (3.0s scan)'
          : isWarn
          ? 'SKIPPED (0.7s scan)'
          : 'DROPPED (0.3s scan)',
        score:
          typeof item.impactScore === 'number'
            ? item.impactScore
            : verdict === 'helping'
            ? 94
            : isWarn
            ? 65
            : 30,
      }
    })

    // Enforce 40% visible / 60% locked split on Hurting bullets if teaser is locked and server didn't already redact
    const alreadyHasServerLocks = mapped.some((b) => b.locked)
    if (isTeaserLocked && !alreadyHasServerLocks) {
      const hurtingIndices = []
      mapped.forEach((b, i) => {
        if (b.verdict === 'hurting') hurtingIndices.push(i)
      })
      const visibleCount = hurtingIndices.length > 0 ? Math.max(1, Math.ceil(hurtingIndices.length * 0.4)) : 0
      const visibleSet = new Set(hurtingIndices.slice(0, visibleCount))
      return mapped.map((b, i) => {
        if (b.verdict === 'helping' || visibleSet.has(i)) return b
        return {
          locked: true,
          bulletId: b.bulletId || `locked_${i}`,
          verdict: 'hurting',
          severity: 'CRITICAL',
          fivePartFlags: {},
        }
      })
    }

    return mapped
  }, [rawBullets, issues, bulletOverrides, isTeaserLocked])

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
    if (expandedId === itemId) {
      setExpandedId(null)
      setLockedId(null)
    } else {
      setExpandedId(itemId)
      setLockedId(itemId)
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

  const handleMouseEnter = (item, idx) => {
    if (typeof window === 'undefined') return
    const isHoverSupported = window.matchMedia('(hover: hover)').matches
    if (!isHoverSupported) return
    const itemId = item.bulletId || idx
    if (lockedId !== null && lockedId !== itemId) return
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setExpandedId(itemId)
      triggerGuide({
        nodeId: item.bulletId || `line_${idx}`,
        emotion: item.verdict === 'helping' ? GUIDE_EMOTIONS.VICTORY : GUIDE_EMOTIONS.ALERT,
        headline: item.verdict === 'helping'
          ? `Helping line: Strong technical action and verified scale.`
          : `Hurting line: ${item.critique || 'Lacks quantified metric or Google XYZ outcome structure.'}`,
        metricChip: item.verdict === 'helping' ? '🟢 Helping Bullet' : '🔴 Hurting Bullet',
      })
    }, 180)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
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

        {filteredBullets
          .filter((item) => !item.locked)
          .map((item, idx) => {
          const isExpanded = expandedId === (item.bulletId || idx)
          const isHelping = item.verdict === 'helping'

          return (
            <div
              key={item.bulletId || idx}
              onClick={() => handleToggleExpand(item, idx)}
              onMouseEnter={() => handleMouseEnter(item, idx)}
              onMouseLeave={handleMouseLeave}
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
                <div className="flex flex-wrap items-center gap-1">
                  {FIVE_PARTS.map(({ key, label }) => {
                    const active = Boolean(item.fivePartFlags?.[key])
                    return (
                      <span
                        key={key}
                        className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded border transition-colors ${
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
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mt-3.5 pt-3 border-t border-[var(--border-default)] space-y-3">
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

                      {/* Why This Rewrite Works & Strategic Recruiter Diff (Locked from Bullet #3 onwards when teaser is active) */}
                      <TeaserLockBlock
                        variant="inline-pill"
                        isLocked={isTeaserLocked && idx >= 2 && Boolean(item.rewritten && item.original !== item.rewritten)}
                        label="Unlock rewrite"
                        bookingUrl={bookingUrl}
                        onUnlock={onOpenUnlockModal}
                        contextLabel="Bullet Rewrite"
                      >
                        {/* Why This Rewrite Works (What was upgraded) */}
                        {(item.whyItWorks || item.why) && (
                          <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200 space-y-0.5 mb-3">
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
                                {item.metricSource === 'ai_calibrated' && item.evidenceStatus !== 'CANDIDATE_CONFIRMED' && item.evidenceStatus !== 'CALCULATED' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20" title="Verify this calibrated benchmark before your interview">
                                    Suggested benchmark — verify before interview
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
                      </TeaserLockBlock>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {(() => {
          const lockedHurting = filteredBullets.filter((b) => b.locked)
          if (lockedHurting.length === 0) return null
          return (
            <div className="pt-4 mt-2 relative">
              <div className="space-y-3 pointer-events-none select-none" aria-hidden="true">
                {lockedHurting.slice(0, 3).map((_, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)]/60 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-5 w-24 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                      <div className="flex gap-1.5">
                        <div className="h-5 w-14 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                        <div className="h-5 w-14 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-11/12 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                    <div className="h-4 w-3/4 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof onOpenUnlockModal === 'function') {
                      onOpenUnlockModal(`${lockedHurting.length} Hurting Bullet Audits & Rewrites`)
                      return
                    }
                    const el = document.getElementById('next-action')
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    else if (bookingUrl) window.open(bookingUrl, '_blank', 'noopener,noreferrer')
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-[var(--primary)] text-[var(--text-primary)] text-xs font-semibold shadow-sm transition-colors duration-150 cursor-pointer"
                >
                  <LockKey size={13} weight="bold" className="text-[var(--primary)]" />
                  <span>
                    Unlock remaining {lockedHurting.length} hurting bullet audit{lockedHurting.length === 1 ? '' : 's'} &amp; rewrites →
                  </span>
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
