import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CaretDown,
  CaretUp,
  Copy,
  Check,
  Warning,
  Sparkle,
  ArrowRight,
  Article,
  Tag,
} from '@phosphor-icons/react'

function safeString(val, fallback = '') {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return val.text || val.title || val.description || val.diagnosis || val.action || fallback
  return fallback
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
  return cleaned
}

function normalizeEvidence(ev, fallback) {
  if (!ev) return fallback
  if (typeof ev === 'string') {
    return { section: 'resume', itemId: 'item', bulletId: 'bullet', originalText: ev }
  }
  if (Array.isArray(ev)) {
    if (ev.length === 0) return fallback
    const first = ev[0] || {}
    const originalText = ev.map((e) => (typeof e === 'string' ? e : e?.originalText || '')).filter(Boolean).join(' ')
    const bulletId = ev.map((e) => e?.bulletId).filter(Boolean).join(', ')
    return {
      section: first.section || 'resume',
      itemId: first.itemId || 'item',
      bulletId: bulletId || 'bullet',
      originalText: originalText || fallback?.originalText || '',
    }
  }
  return {
    section: ev.section || 'resume',
    itemId: ev.itemId || 'item',
    bulletId: ev.bulletId || 'bullet',
    originalText: typeof ev.originalText === 'string' ? ev.originalText : (ev.originalText?.text || fallback?.originalText || ''),
  }
}

export default function OpportunitiesList({ issues, resumeJsonData, resumeAgent }) {
  const [expandedId, setExpandedId] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [appliedId, setAppliedId] = useState(null)

  // Prioritize explicit strategic / pipeline issues if passed; otherwise fall back to resumeAgent issues
  const rawList = Array.isArray(issues) && issues.length > 0
    ? issues
    : (Array.isArray(resumeAgent?.issues) ? resumeAgent.issues : [])

  const isStrategicPipeline = Array.isArray(issues) && issues.length > 0 && issues !== resumeAgent?.issues

  // Deduplicate by title or id
  const seen = new Set()
  const uniqueIssues = rawList.filter((iss) => {
    const key = (typeof iss === 'string' ? iss : iss?.id || iss?.title || '').trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  // If issues are provided, map them cleanly with dynamic values
  const opportunityList =
    uniqueIssues.length > 0
      ? uniqueIssues.map((iss, i) => {
          if (typeof iss === 'string') {
            return {
              id: `iss_${i + 1}`,
              severity: 'medium',
              category: 'Resume Strategy',
              title: iss,
              diagnosis: 'Surfaced during recruiter review of your application materials.',
              affectedSection: 'Resume',
              whyItMatters: 'Addressing this opportunity helps avoid premature filtering in competitive hiring pipelines.',
              evidence: null,
              recommendation: 'Refine this area based on target industry benchmarks.',
              correctedText: null,
            }
          }

          const normEv = iss?.evidence ? normalizeEvidence(iss.evidence, null) : null
          const rawCategory = iss?.category ? String(iss.category).replace(/_/g, ' ') : 'Resume Strategy'

          return {
            id: iss?.id || `iss_${i + 1}`,
            severity: typeof iss?.severity === 'string' ? iss.severity.toLowerCase() : 'medium',
            category: rawCategory,
            title: safeString(iss?.title, `Priority Opportunity #${i + 1}`),
            diagnosis: safeString(iss?.diagnosis || iss?.description, 'Identified during technical and ATS recruiter diagnosis.'),
            affectedSection: safeString(iss?.affectedSection || normEv?.section, 'Resume Document'),
            whyItMatters: safeString(iss?.whyItMatters, 'Optimizing this directly increases recruiter conversion and ATS pass rates.'),
            evidence: normEv,
            recommendation: safeString(iss?.recommendation || iss?.action_steps?.[0] || iss?.action, 'Apply the recommended recruiter rewrite or clarification.'),
            correctedText: iss?.correctedText ? cleanRewriteText(safeString(iss.correctedText, null)) : null,
          }
        })
      : []

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleApply = (id) => {
    setAppliedId(id)
    setTimeout(() => setAppliedId(null), 2500)
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const getSeverityBadge = (sev) => {
    const s = (sev || '').toLowerCase()
    if (s === 'critical' || s === 'high' || s === 'fix') {
      return {
        label: s === 'critical' ? 'Critical Priority' : 'High Priority',
        icon: '🔴',
        class: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20',
      }
    }
    if (s === 'medium' || s === 'warn' || s === 'warning') {
      return {
        label: 'Medium Priority',
        icon: '🟠',
        class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      }
    }
    return {
      label: 'Low Priority',
      icon: '🟢',
      class: 'bg-emerald-500/10 text-[var(--emerald)] border-emerald-500/20',
    }
  }

  if (opportunityList.length === 0) {
    return null
  }

  return (
    <section id="opportunities" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-red-500 dark:text-red-400 block">
            {isStrategicPipeline ? 'Pipeline Risk Diagnosis' : 'Targeted Fixes'}
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            {isStrategicPipeline ? 'Strategic Pipeline & Cross-Channel Bottlenecks' : "Where you're losing opportunities"}
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          {isStrategicPipeline
            ? 'Critical screening bottlenecks identified across your application funnel and cross-channel sync'
            : 'Expand any issue to see exact resume evidence, recruiter rationale, and the AI rewrite'}
        </p>
      </div>

      {/* Prioritized Opportunity Accordion List */}
      <div className="space-y-3">
        {opportunityList.map((item, idx) => {
          const isExpanded = expandedId === item.id
          const sev = getSeverityBadge(item.severity)

          return (
            <div
              key={item.id}
              className={`rounded-2xl transition-all duration-200 border overflow-hidden ${
                isExpanded
                  ? 'bg-[var(--surface-card)] border-[var(--primary)]/40 shadow-md ring-1 ring-[var(--primary)]/10'
                  : 'bg-[var(--surface-card)] border-[var(--border-default)] hover:border-[var(--border-hover)] hover:shadow-xs'
              }`}
            >
              {/* Collapsed Header Row (Always Visible) */}
              <div
                onClick={() => toggleExpand(item.id)}
                className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  {/* Severity indicator */}
                  <span className="text-base shrink-0 mt-0.5 sm:mt-0" title={sev.label}>
                    {sev.icon}
                  </span>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className="text-base font-bold text-[var(--text-primary)] tracking-tight truncate"
                        style={{ fontFamily: 'var(--font-head)' }}
                      >
                        {item.title}
                      </h3>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${sev.class}`}
                      >
                        {sev.label}
                      </span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-muted)]">
                        {item.category}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium line-clamp-1">
                      {item.diagnosis}
                    </p>
                  </div>
                </div>

                {/* Right side: Affected section + toggle button */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-[var(--text-muted)] bg-[var(--surface-sunken)] px-2.5 py-1 rounded-lg border border-[var(--border-default)]">
                    <Article size={12} />
                    <span>{item.affectedSection}</span>
                  </span>

                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    className="p-1.5 rounded-lg text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="hidden sm:inline">{isExpanded ? 'Collapse' : 'View details'}</span>
                    {isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
                  </button>
                </div>
              </div>

              {/* Expanded Details Drawer (Progressive Disclosure) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="border-t border-[var(--border-default)] bg-[var(--surface-sunken)]/60 px-5 sm:px-7 py-6 space-y-6"
                  >
                    {/* Part 1: Why This Matters */}
                    <div className="space-y-1.5">
                      <div className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                        <Sparkle size={14} weight="fill" />
                        <span>Why This Matters to Recruiters</span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                        {item.whyItMatters}
                      </p>
                    </div>

                    {/* Part 2: Evidence from Your Resume (With Stable IDs) */}
                    {item.evidence && (
                      <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
                            Evidence from your resume
                          </span>
                          <span className="font-mono text-[10px] text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary)]/20">
                            {item.evidence.section || 'section'} • {item.evidence.itemId || 'item'} • {item.evidence.bulletId || 'bullet'}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--surface-sunken)] border-l-4 border-amber-400 text-xs sm:text-sm font-sans text-[var(--text-primary)] leading-relaxed italic">
                          &ldquo;{item.evidence.originalText}&rdquo;
                        </div>
                      </div>
                    )}

                    {/* Part 3: Recommended Action */}
                    <div className="space-y-1.5">
                      <div className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--text-muted)]">
                        Recommended Action
                      </div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                        {item.recommendation}
                      </p>
                    </div>

                    {/* Part 4: Before vs After Suggested Rewrite */}
                    {item.correctedText && (
                      <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--emerald)] flex items-center gap-1.5">
                            <Check size={15} weight="bold" />
                            <span>Suggested Rewrite (STAR & ATS Optimized)</span>
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(item.correctedText, item.id)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--surface-card)] hover:bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              {copiedKey === item.id ? (
                                <>
                                  <Check size={13} className="text-[var(--emerald)]" weight="bold" />
                                  <span className="text-[var(--emerald)]">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copy Rewrite</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApply(item.id)}
                              className="px-2.5 py-1 rounded-md text-xs font-bold bg-[var(--emerald)] text-white hover:bg-emerald-600 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              {appliedId === item.id ? (
                                <span>Applied to Draft ✓</span>
                              ) : (
                                <span>Apply Suggestion</span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Diff highlight text */}
                        <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-emerald-500/30 text-xs sm:text-sm font-sans text-[var(--text-primary)] leading-relaxed font-medium shadow-2xs">
                          {item.correctedText}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}
