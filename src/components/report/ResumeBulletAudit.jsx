import React, { useState, useMemo } from 'react'
import {
  CaretDown,
  Briefcase,
  Folders,
  Sparkle,
  Copy,
  Check,
} from '@phosphor-icons/react'

/**
 * ResumeBulletAudit — unified actionable audit merging line-by-line verdicts
 * with deep recruiter diagnosis, root-cause titles, and ready-to-use rewrites.
 *
 * Features:
 * - Interactive filter tabs: [ All Bullets (N) ] | [ Needs Action (M) ] | [ Strong Bullets (K) ]
 * - Unified Actionable Cards for FIX & IMPROVE bullets with:
 *     * Specific Root-Cause Issue Title
 *     * Original Bullet Text
 *     * Recruiter Diagnosis ("Why It Matters")
 *     * Ready-to-Use Rewrite Box with [Copy Rewrite] button
 *     * Discovery questions to uncover real numbers
 * - Compact layout for GOOD bullets (prevents page bloat)
 * - Print-perfect: auto-expands all accordions and displays unabridged audit.
 */

const STATUS_STYLES = {
  fix: {
    chip: 'bg-rose-50 border-rose-200 text-rose-700 font-bold',
    label: 'FIX',
  },
  warn: {
    chip: 'bg-amber-50 border-amber-200 text-amber-700 font-bold',
    label: 'IMPROVE',
  },
  pass: {
    chip: 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold',
    label: 'GOOD',
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
  let count = 0
  let cleaned = text.replace(/(\s+(?:by|to|of|across|for|with|at|in|from))?\s*\[ADD:[^\]]*\]/gi, (match) => {
    count += 1
    if (count === 1) return match
    return ''
  })
  cleaned = cleaned.replace(/\](?=[A-Za-z0-9])/g, '] ')
  cleaned = cleaned.replace(/\s+\b(?:by|to|of|across|for|with|at|in|from)\s*([.,;])/gi, '$1')
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  return balanceParentheses(cleaned)
}

function ActionableBulletCard({ bullet, matchedIssue, light }) {
  const isFix = bullet.status === 'fix'
  const badgeStyle = isFix
    ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
    : 'bg-amber-50 border-amber-200 text-amber-700 font-bold'
  const badgeLabel = isFix ? 'FIX' : 'IMPROVE'

  const issueTitle = balanceParentheses(
    matchedIssue?.title ||
    bullet.reasonTitle ||
    bullet.reason ||
    (isFix ? 'Critical Phrasing Issue' : 'Phrasing Improvement')
  )

  let diagnosis = balanceParentheses(matchedIssue?.diagnosis || bullet.reason)
  if (diagnosis && /participle\s*\(['"][^'"]+['"]\)/i.test(diagnosis)) {
    const rawBulletText = bullet.text || bullet.originalText || matchedIssue?.evidence?.[0]?.originalText || ''
    const matchIng = rawBulletText.trim().replace(/^[•\-*▪–—\s]+/, '').match(/^([a-zA-Z]+ing)\b/i)
    if (matchIng) {
      diagnosis = diagnosis.replace(/participle\s*\(['"][^'"]+['"]\)/i, `participle ('${matchIng[1]}')`)
    }
  }
  const whyItMatters = balanceParentheses(matchedIssue?.whyItMatters || null)
  const rawRewrite =
    bullet.rewrite ||
    matchedIssue?.correctedText ||
    matchedIssue?.rewrite ||
    null
  const rewriteText = cleanRewriteText(rawRewrite)

  const questions = Array.isArray(matchedIssue?.metricDiscoveryQuestions)
    ? matchedIssue.metricDiscoveryQuestions
    : []

  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    if (rewriteText) {
      navigator.clipboard.writeText(rewriteText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className={`bullet-card print-card border rounded-xl p-4 sm:p-5 space-y-3 print:break-inside-avoid ${
        light
          ? 'bg-white border-slate-200 shadow-2xs'
          : 'bg-[#0b1222] border-slate-800'
      }`}
    >
      {/* Top Row: Status Badge + Issue Title + Bullet ID */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${badgeStyle}`}>
            {badgeLabel}
          </span>
          <span className={`text-xs sm:text-sm font-bold ${light ? 'text-slate-900' : 'text-white'}`}>
            {issueTitle}
          </span>
          {bullet.category && (
            <span className={`text-[10px] font-mono uppercase ${light ? 'text-slate-400' : 'text-slate-500'}`}>
              · {bullet.category.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <span className={`text-[10px] font-mono shrink-0 ${light ? 'text-slate-400' : 'text-slate-500'}`}>
          {bullet.bulletId}
        </span>
      </div>

      {/* Original Bullet */}
      <div
        className={`text-xs sm:text-[13px] leading-relaxed rounded-lg p-3 border ${
          light
            ? 'bg-slate-50 border-slate-200/70 text-slate-700'
            : 'bg-slate-900/60 border-slate-800 text-slate-300'
        }`}
      >
        <span className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
          light ? 'text-slate-400' : 'text-slate-500'
        }`}>
          Original Phrasing
        </span>
        {bullet.text}
      </div>

      {/* Recruiter Diagnosis (Why It Matters) */}
      {(diagnosis || whyItMatters) && (
        <div
          className={`text-xs leading-relaxed rounded-lg p-3 space-y-1 border ${
            light
              ? 'bg-amber-50/60 border-amber-200/70 text-slate-700'
              : 'bg-amber-950/20 border-amber-800/40 text-amber-200/90'
          }`}
        >
          {diagnosis && (
            <p>
              <strong className={light ? 'text-amber-800' : 'text-amber-300'}>
                Recruiter Diagnosis:{' '}
              </strong>
              {diagnosis}
            </p>
          )}
          {whyItMatters && (
            <p className={light ? 'text-slate-600' : 'text-slate-400'}>
              <strong className={light ? 'text-slate-700' : 'text-slate-300'}>
                Why It Matters:{' '}
              </strong>
              {whyItMatters}
            </p>
          )}
        </div>
      )}

      {/* Ready-to-Use Rewrite Box */}
      {rewriteText && (
        <div
          className={`rounded-xl p-3.5 space-y-2 border ${
            light
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                light ? 'text-emerald-800' : 'text-emerald-300'
              }`}
            >
              <Sparkle size={13} weight="fill" className={light ? 'text-emerald-600' : 'text-emerald-400'} />
              Ready-to-Use Rewrite
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className={`no-print text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer border ${
                light
                  ? 'bg-white hover:bg-emerald-100 text-emerald-800 border-emerald-200 shadow-2xs'
                  : 'bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 border-emerald-700/60'
              }`}
            >
              {copied ? (
                <>
                  <Check size={12} weight="bold" className="text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} weight="bold" />
                  <span>Copy Rewrite</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs sm:text-[13px] font-medium leading-relaxed">
            {rewriteText}
          </p>
        </div>
      )}

      {/* Discovery Questions to Uncover Numbers */}
      {questions.length > 0 && (
        <div
          className={`rounded-lg p-2.5 border ${
            light
              ? 'bg-slate-50 border-slate-200/80'
              : 'bg-slate-900/50 border-slate-800'
          }`}
        >
          <div
            className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
              light ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Questions to Uncover Measurable Numbers:
          </div>
          <ul className="space-y-1">
            {questions.map((q, qi) => {
              const qText = typeof q === 'string' ? q : q?.question || String(q || '')
              return (
                <li
                  key={qi}
                  className={`text-[11px] flex items-start gap-1.5 ${
                    light ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  <span className="text-amber-500 font-bold shrink-0">?</span>
                  <span>{qText}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function CompactGoodBulletRow({ bullet, light }) {
  return (
    <div
      className={`bullet-card print-card flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-all ${
        light
          ? 'bg-emerald-50/20 border-emerald-100 text-slate-700'
          : 'bg-emerald-950/20 border-emerald-900/40 text-slate-300'
      }`}
    >
      <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 mt-0.5">
        GOOD
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-xs leading-relaxed">{bullet.text}</span>
      </div>
      <span className={`text-[10px] font-mono shrink-0 ${light ? 'text-slate-300' : 'text-slate-600'}`}>
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

  // Group bullets by role/project header
  const groups = useMemo(() => {
    const groupList = []
    const byName = new Map()
    for (const b of bulletAudit) {
      if (!byName.has(b.itemName)) {
        byName.set(b.itemName, [])
        groupList.push({ itemName: b.itemName, section: b.section, bullets: byName.get(b.itemName) })
      }
      byName.get(b.itemName).push(b)
    }
    return groupList
  }, [bulletAudit])

  // Filter tab state: 'all' | 'needs_action' | 'good'
  const [activeFilter, setActiveFilter] = useState('all')

  // Interactive accordion state: expand all or selective
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {}
    groups.forEach((g) => {
      // Default open all groups for seamless scanning
      initial[g.itemName] = true
    })
    return initial
  })

  const toggleGroup = (itemName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }))
  }

  const expandAll = () => {
    const all = {}
    groups.forEach((g) => {
      all[g.itemName] = true
    })
    setExpandedGroups(all)
  }

  const collapseAll = () => {
    const none = {}
    groups.forEach((g) => {
      none[g.itemName] = false
    })
    setExpandedGroups(none)
  }

  const allExpanded = groups.every((g) => expandedGroups[g.itemName])

  const counts = {
    fix: bulletAudit.filter((b) => b.status === 'fix').length,
    warn: bulletAudit.filter((b) => b.status === 'warn').length,
    pass: bulletAudit.filter((b) => b.status === 'pass').length,
  }
  const totalNeedsAction = counts.fix + counts.warn

  // State to toggle between compact 4-bullet executive view vs full 30-bullet audit
  const [showAllAuditedBullets, setShowAllAuditedBullets] = useState(false)

  // Top critical bullets (prioritize fix, then warn)
  const displayedBullets = useMemo(() => {
    const critical = bulletAudit.filter((b) => b.status === 'fix' || b.status === 'warn')
    return critical.length > 0 ? critical.slice(0, 4) : bulletAudit.slice(0, 4)
  }, [bulletAudit])
  const topCriticalBullets = displayedBullets

  const totalBullets = totalNeedsAction > 0 ? totalNeedsAction : bulletAudit.length
  const totalCount = Math.max(displayedBullets.length, totalBullets || 0)

  const labelColor = light ? 'text-slate-400' : 'text-gray-400'
  const groupName = light ? 'text-slate-900' : 'text-white'
  const badgeBg = light
    ? 'bg-slate-100 border-slate-200 text-slate-600'
    : 'bg-gray-900 border-gray-800 text-gray-400'
  const containerCardBg = light
    ? 'bg-white border-slate-200'
    : 'bg-[#0f172a] border-gray-800/80'

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${labelColor}`}>
            Top Critical Bullet Rewrites & Audit
          </h3>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Focusing on the highest-priority lines requiring hard quantified metrics and active verbs.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-[10px] font-mono ${labelColor}`}>
            <span className={light ? 'text-rose-600 font-bold' : 'text-rose-400 font-bold'}>
              {counts.fix} to fix
            </span>
            <span>·</span>
            <span className={light ? 'text-amber-600 font-bold' : 'text-amber-400 font-bold'}>
              {counts.warn} to improve
            </span>
            <span>·</span>
            <span className={light ? 'text-emerald-600 font-bold' : 'text-emerald-400 font-bold'}>
              {counts.pass} strong
            </span>
          </div>
        </div>
      </div>

      {/* Top Priority Bullets Expanded by Default */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkle size={14} weight="fill" />
            TOP {displayedBullets.length} PRIORITY BULLET REWRITES (EXPANDED)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {displayedBullets.length} of {totalCount} priority bullets
          </span>
        </div>

        <div className="space-y-3">
          {topCriticalBullets.map((bullet, idx) => (
            <ActionableBulletCard
              key={bullet.bulletId || idx}
              bullet={bullet}
              matchedIssue={issueMap.get(bullet.bulletId)}
              light={light}
            />
          ))}
        </div>
      </div>

      {/* Toggle Button to Expand / Collapse Remaining Bullets (Hidden from PDF when collapsed) */}
      <div className="pt-2 text-center print:hidden">
        <button
          type="button"
          onClick={() => setShowAllAuditedBullets((prev) => !prev)}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs inline-flex items-center gap-2 ${
            showAllAuditedBullets
              ? 'bg-slate-900 text-white border-slate-900'
              : 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white'
          }`}
        >
          {showAllAuditedBullets ? (
            <span>– Collapse Full Bullet Breakdown</span>
          ) : (
            <span>+ View All {bulletAudit.length} Audited Bullets ({counts.pass} Strong / Passed)</span>
          )}
        </button>
      </div>

      {/* Full Audited Bullets (Collapsed by default on Web and hidden from PDF when collapsed) */}
      <div className={showAllAuditedBullets ? 'space-y-4 pt-3 border-t border-slate-200/60' : 'hidden print:hidden'}>
        {/* Filter Tabs on Web */}
        <div className="no-print filter-tabs flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : light
                ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
          >
            All Bullets ({bulletAudit.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('needs_action')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              activeFilter === 'needs_action'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : light
                ? 'bg-white hover:bg-rose-50 text-rose-700 border-slate-200'
                : 'bg-slate-900 hover:bg-rose-950/50 text-rose-400 border-slate-800'
            }`}
          >
            Needs Action: Fix & Improve ({totalNeedsAction})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('good')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              activeFilter === 'good'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : light
                ? 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-200'
                : 'bg-slate-900 hover:bg-emerald-950/50 text-emerald-400 border-slate-800'
            }`}
          >
            Strong Bullets ({counts.pass})
          </button>
        </div>

        {/* Accordion / List of Experience Groups */}
        <div className="space-y-3.5">
          {groups.map((g, gi) => {
            const isExpanded = Boolean(expandedGroups[g.itemName])
            const isProject = g.section?.toLowerCase().includes('project')

          // Filter bullets for interactive display on screen; print CSS forces all visible
          const visibleBullets = g.bullets.filter((b) => {
            if (activeFilter === 'needs_action') return b.status === 'fix' || b.status === 'warn'
            if (activeFilter === 'good') return b.status === 'pass'
            return true
          })

          const gFix = g.bullets.filter((b) => b.status === 'fix').length
          const gWarn = g.bullets.filter((b) => b.status === 'warn').length
          const gPass = g.bullets.filter((b) => b.status === 'pass').length

          // In interactive mode, if this filter leaves 0 bullets, hide on web (still available in print)
          if (visibleBullets.length === 0 && activeFilter !== 'all') {
            return null
          }

          return (
            <div
              key={`${g.itemName}_${gi}`}
              className={`experience-group ${containerCardBg} border rounded-2xl overflow-hidden transition-all shadow-xs print:shadow-none print:break-inside-auto print:border-slate-300 print:mb-3`}
            >
              {/* Group Header Trigger */}
              <button
                type="button"
                onClick={() => toggleGroup(g.itemName)}
                className={`w-full p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                  light ? 'hover:bg-slate-50/80' : 'hover:bg-gray-800/40'
                }`}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isProject
                        ? light
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-purple-950/40 text-purple-400'
                        : light
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-indigo-950/40 text-indigo-400'
                    }`}
                  >
                    {isProject ? <Folders size={17} weight="duotone" /> : <Briefcase size={17} weight="duotone" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs sm:text-sm font-bold ${groupName} truncate`}>
                        {g.itemName}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider border px-2 py-0.5 rounded-full font-mono ${badgeBg}`}>
                        {g.section || 'EXPERIENCE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] mt-0.5 text-slate-500 flex-wrap">
                      <span>{g.bullets.length} {g.bullets.length === 1 ? 'bullet' : 'bullets'} audited</span>
                      <span>·</span>
                      {gFix > 0 && <span className="text-rose-600 font-semibold">{gFix} to fix</span>}
                      {gWarn > 0 && <span className="text-amber-600 font-semibold">{gWarn} to improve</span>}
                      {gPass > 0 && <span className="text-emerald-600 font-semibold">{gPass} strong</span>}
                    </div>
                  </div>
                </div>

                <div className="experience-dropdown-chevron shrink-0 text-slate-400 p-1">
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={`transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-indigo-600' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Group Body: Collapsible on web, FORCED EXPANDED in print */}
              <div
                className={`experience-dropdown-content px-4 pb-4 space-y-3 border-t ${
                  light ? 'border-slate-100' : 'border-gray-800/60'
                } ${isExpanded ? 'block' : 'hidden'} print:!block print:!pt-3`}
              >
                <div className="pt-3 space-y-3">
                  {visibleBullets.map((b) => {
                    const matchedIssue = issueMap.get(b.bulletId)
                    if (b.status === 'pass') {
                      return (
                        <CompactGoodBulletRow
                          key={b.bulletId}
                          bullet={b}
                          light={light}
                        />
                      )
                    }
                    return (
                      <ActionableBulletCard
                        key={b.bulletId}
                        bullet={b}
                        matchedIssue={matchedIssue}
                        light={light}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

export { STATUS_STYLES }
