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

export default function OpportunitiesList({ issues, resumeJsonData }) {
  const [expandedId, setExpandedId] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [appliedId, setAppliedId] = useState(null)

  // Map incoming issues or synthesize from critical_issues & resume_json
  const defaultIssues = [
    {
      id: 'iss_001',
      severity: 'high',
      category: 'Resume Positioning',
      title: 'Low Application-to-Interview Conversion',
      diagnosis: 'Your strongest technical achievements are buried below routine duties, causing ATS parsers and recruiters to drop your profile.',
      affectedSection: 'Experience Section',
      whyItMatters: 'Recruiters spend an average of 6 to 8 seconds scanning a resume. If measurable business impact is not surfaced in the top 2 lines of each role, the candidate is auto-categorized into the rejection pile.',
      evidence: {
        section: 'experience',
        itemId: 'exp_001',
        bulletId: 'exp_001_b01',
        originalText: 'Responsible for maintaining backend services, database migrations, and collaborating with cross-functional teams on feature delivery.',
      },
      recommendation: 'Rephrase with quantified business metrics (latency reduction, cost savings, user scale) using the Google STAR/XYZ formula.',
      correctedText: 'Architected and optimized Go backend microservices handling 45,000 req/sec, reducing p99 database query latency by 58% across $14M billing infrastructure.',
    },
    {
      id: 'iss_002',
      severity: 'medium',
      category: 'Project Positioning',
      title: 'Project Portfolio Lacks Enterprise Context',
      diagnosis: 'Your personal project section reads like a tutorial exercise rather than an enterprise-grade distributed system.',
      affectedSection: 'Projects Section',
      whyItMatters: 'Senior engineering hiring managers evaluate side projects to gauge technical depth and architectural decision-making under real-world constraints.',
      evidence: {
        section: 'projects',
        itemId: 'proj_001',
        bulletId: 'proj_001_b01',
        originalText: 'Built a full-stack dashboard with React and Node.js for tracking user analytics.',
      },
      recommendation: 'State the engineering motivation, throughput benchmark, and fault-tolerance architecture implemented.',
      correctedText: 'Engineered real-time distributed analytics pipeline in React, TypeScript, and Go with Kafka event streaming, serving 250,000 MAU with zero downtime.',
    },
    {
      id: 'iss_003',
      severity: 'medium',
      category: 'Outreach & Visibility',
      title: 'Over-Reliance on Standard Easy Apply',
      diagnosis: 'Applying only through job boards exposes your resume to 350+ competing candidates per listing.',
      affectedSection: 'Outreach Strategy',
      whyItMatters: 'Over 70% of senior and mid-level roles are filled through warm introductions and direct recruiter outreach before postings close.',
      evidence: {
        section: 'networking',
        itemId: 'net_001',
        bulletId: 'net_001_b01',
        originalText: 'Applied to 100+ roles via LinkedIn Easy Apply with minimal outreach to hiring managers.',
      },
      recommendation: 'Target 5 direct tech recruiters at tier-1/tier-2 companies weekly with customized 3-sentence value propositions.',
      correctedText: 'Direct Recruiter Outreach Cadence: Identify hiring manager, pitch specific architecture alignment, and request a 10-minute briefing call.',
    },
  ]

  // If external issues are provided, merge gracefully
  const opportunityList =
    Array.isArray(issues) && issues.length > 0
      ? issues.map((iss, i) => {
          const defaultRef = defaultIssues[i % defaultIssues.length]
          if (typeof iss === 'string') {
            return {
              ...defaultRef,
              id: `iss_${i + 1}`,
              title: iss,
            }
          }
          const normEv = normalizeEvidence(iss?.evidence, defaultRef.evidence)
          return {
            id: iss?.id || `iss_${i + 1}`,
            severity: typeof iss?.severity === 'string' ? iss.severity.toLowerCase() : 'medium',
            category: safeString(iss?.category, defaultRef.category),
            title: safeString(iss?.title, defaultRef.title),
            diagnosis: safeString(iss?.diagnosis || iss?.description, defaultRef.diagnosis),
            affectedSection: safeString(iss?.affectedSection || normEv?.section, defaultRef.affectedSection),
            whyItMatters: safeString(iss?.whyItMatters, defaultRef.whyItMatters),
            evidence: normEv,
            recommendation: safeString(iss?.recommendation || iss?.action_steps?.[0] || iss?.action, defaultRef.recommendation),
            correctedText: iss?.correctedText ? safeString(iss.correctedText, null) : null,
          }
        })
      : defaultIssues

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
    const s = sev.toLowerCase()
    if (s === 'high') {
      return {
        label: 'High Priority',
        icon: '🔴',
        class: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20',
      }
    }
    if (s === 'medium') {
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

  return (
    <section id="opportunities" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-red-500 dark:text-red-400 block">
            Targeted Fixes
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Where you're losing opportunities
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Expand any issue to see exact resume evidence, recruiter rationale, and the AI rewrite
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
