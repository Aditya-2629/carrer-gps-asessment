import React, { useState } from 'react'
import {
  ArrowRight,
  PencilSimple,
  Warning,
  CheckCircle,
  CaretDown,
  Briefcase,
  Folders,
} from '@phosphor-icons/react'

/**
 * ResumeBulletAudit — every bullet with a verdict chip and, where available,
 * the before → after rewrite. Reads `analysis.dashboard.bulletAudit`.
 *
 * Feature: Each experience / project is displayed as an interactive dropdown / accordion.
 * PRINT-FIRST: On window.print / PDF export, all dropdowns are ALWAYS forced open so
 * the complete unabridged report is captured in the printout.
 *
 * variant: 'light' (report page / print-first) | 'dark' (Test Lab console)
 */

const STATUS_STYLES = {
  fix: {
    dark: { chip: 'bg-red-950/80 border-red-700/60 text-red-300', rowBorder: 'border-red-900/40', icon: <PencilSimple size={14} weight="fill" className="text-red-400" /> },
    light: { chip: 'bg-red-50 border-red-200 text-red-700', rowBorder: 'border-red-200', icon: <PencilSimple size={14} weight="fill" className="text-red-500" /> },
    label: 'FIX',
  },
  warn: {
    dark: { chip: 'bg-amber-950/80 border-amber-700/60 text-amber-300', rowBorder: 'border-amber-900/40', icon: <Warning size={14} weight="fill" className="text-amber-400" /> },
    light: { chip: 'bg-amber-50 border-amber-200 text-amber-700', rowBorder: 'border-amber-200', icon: <Warning size={14} weight="fill" className="text-amber-500" /> },
    label: 'IMPROVE',
  },
  pass: {
    dark: { chip: 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300', rowBorder: 'border-emerald-900/40', icon: <CheckCircle size={14} weight="fill" className="text-emerald-400" /> },
    light: { chip: 'bg-emerald-50 border-emerald-200 text-emerald-700', rowBorder: 'border-emerald-200', icon: <CheckCircle size={14} weight="fill" className="text-emerald-500" /> },
    label: 'GOOD',
  },
}

function BulletRow({ bullet, light }) {
  const s = STATUS_STYLES[bullet.status]?.[light ? 'light' : 'dark'] || STATUS_STYLES.pass[light ? 'light' : 'dark']
  const st = STATUS_STYLES[bullet.status] || STATUS_STYLES.pass
  const textColor = light ? 'text-slate-700' : 'text-gray-300'
  const cardBg = light ? 'bg-slate-50' : 'bg-[#070b14]'

  return (
    <div className={`${cardBg} border ${s.rowBorder} rounded-xl p-4 space-y-2.5 print:break-inside-avoid print:bg-white print:border-slate-200`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${s.chip} print:break-inside-avoid`}>
            {st.label}
          </span>
          {bullet.category && (
            <span className={`text-[10px] font-mono uppercase ${light ? 'text-slate-400' : 'text-gray-500'}`}>
              {bullet.category.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <span className={`text-[10px] font-mono shrink-0 ${light ? 'text-slate-300' : 'text-gray-600'}`}>
          {bullet.bulletId}
        </span>
      </div>

      <p className={`text-xs leading-relaxed ${textColor}`}>{bullet.text}</p>

      {bullet.status !== 'pass' && bullet.reason && (
        <div className={`flex items-start gap-2 text-[11px] ${light ? 'text-slate-500' : 'text-gray-400'}`}>
          {s.icon}
          <span className="leading-snug">{bullet.reason}</span>
        </div>
      )}

      {bullet.rewrite && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2 pt-1 print:break-inside-avoid">
          <div className={`border rounded-lg p-2.5 ${light ? 'bg-white border-slate-200' : 'bg-gray-900/60 border-gray-800'}`}>
            <div className={`text-[9px] uppercase font-bold tracking-wider mb-1 ${light ? 'text-slate-400' : 'text-gray-600'}`}>
              Original
            </div>
            <div className={`text-[11px] line-through leading-snug ${light ? 'text-slate-400 decoration-slate-400' : 'text-gray-400 decoration-gray-600'}`}>
              {bullet.text}
            </div>
          </div>
          <ArrowRight size={16} className={`rotate-90 sm:rotate-0 mx-auto ${light ? 'text-indigo-500' : 'text-indigo-400'} print:text-indigo-600`} />
          <div className={`border rounded-lg p-2.5 ${light ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-950/40 border-indigo-800/60'} print:bg-indigo-50/50 print:border-indigo-200`}>
            <div className={`text-[9px] uppercase font-bold tracking-wider mb-1 ${light ? 'text-indigo-500' : 'text-indigo-400'} print:text-indigo-700`}>
              Recruiter Rewrite
            </div>
            <div className={`text-[11px] font-medium leading-snug ${light ? 'text-indigo-900' : 'text-indigo-100'} print:text-indigo-950`}>
              {bullet.rewrite}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResumeBulletAudit({ bulletAudit, variant = 'dark' }) {
  if (!Array.isArray(bulletAudit) || bulletAudit.length === 0) return null
  const light = variant === 'light'

  // Group bullets by their role/project header
  const groups = []
  const byName = new Map()
  for (const b of bulletAudit) {
    if (!byName.has(b.itemName)) {
      byName.set(b.itemName, [])
      groups.push({ itemName: b.itemName, section: b.section, bullets: byName.get(b.itemName) })
    }
    byName.get(b.itemName).push(b)
  }

  // Interactive accordion state: track which experience group keys are expanded
  // Initial state: expand all groups so user has immediate context, or toggle individually
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {}
    groups.forEach((g, i) => {
      // Default: keep the first 2 groups open, or any group that has a "fix" status
      const hasFix = g.bullets.some((b) => b.status === 'fix')
      initial[g.itemName] = i < 2 || hasFix
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

  const labelColor = light ? 'text-slate-400' : 'text-gray-400'
  const groupName = light ? 'text-slate-900' : 'text-white'
  const badgeBg = light ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-gray-900 border-gray-800 text-gray-400'
  const containerCardBg = light ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-gray-800/80'

  return (
    <div className="space-y-4">
      {/* Print CSS ensuring every single experience dropdown is 100% expanded when printed */}
      <style>{`
        @media print {
          .experience-dropdown-content {
            display: block !important;
            max-height: none !important;
            opacity: 1 !important;
            visibility: visible !important;
          }
          .experience-dropdown-chevron {
            display: none !important;
          }
          .experience-dropdown-controls {
            display: none !important;
          }
        }
      `}</style>

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/60 pb-3">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${labelColor}`}>
            Experience & Project Bullet Audit ({groups.length} Entries)
          </h3>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Click any experience dropdown to inspect or collapse bullet rewrites.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-[10px] font-mono ${labelColor}`}>
            <span className={light ? 'text-red-600 font-bold' : 'text-red-400 font-bold'}>{counts.fix} to fix</span>
            <span>·</span>
            <span className={light ? 'text-amber-600 font-bold' : 'text-amber-400 font-bold'}>{counts.warn} to improve</span>
            <span>·</span>
            <span className={light ? 'text-emerald-600 font-bold' : 'text-emerald-400 font-bold'}>{counts.pass} good</span>
          </div>

          <div className="experience-dropdown-controls flex items-center gap-1.5 ml-2 border-l border-slate-200/80 pl-3">
            <button
              type="button"
              onClick={allExpanded ? collapseAll : expandAll}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                light
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
              }`}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>
      </div>

      {/* Accordion / Dropdown List of Experiences */}
      <div className="space-y-3.5">
        {groups.map((g, gi) => {
          const isExpanded = Boolean(expandedGroups[g.itemName])
          const gFix = g.bullets.filter((b) => b.status === 'fix').length
          const gWarn = g.bullets.filter((b) => b.status === 'warn').length
          const gPass = g.bullets.filter((b) => b.status === 'pass').length
          const isProject = g.section?.toLowerCase().includes('project')

          return (
            <div
              key={`${g.itemName}_${gi}`}
              className={`${containerCardBg} border rounded-2xl overflow-hidden transition-all shadow-xs print:shadow-none print:break-inside-avoid print:border-slate-300`}
            >
              {/* Dropdown Header Trigger */}
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
                        ? light ? 'bg-purple-50 text-purple-600' : 'bg-purple-950/40 text-purple-400'
                        : light ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-950/40 text-indigo-400'
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

                    <div className="flex items-center gap-2 text-[10px] mt-0.5 text-[var(--text-muted)] flex-wrap">
                      <span>{g.bullets.length} {g.bullets.length === 1 ? 'bullet' : 'bullets'} audited</span>
                      <span>·</span>
                      {gFix > 0 && (
                        <span className="text-red-500 font-semibold">{gFix} to fix</span>
                      )}
                      {gWarn > 0 && (
                        <span className="text-amber-500 font-semibold">{gWarn} to improve</span>
                      )}
                      {gPass > 0 && (
                        <span className="text-emerald-500 font-semibold">{gPass} strong</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="experience-dropdown-chevron shrink-0 text-slate-400 p-1">
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[var(--primary)]' : ''}`}
                  />
                </div>
              </button>

              {/* Dropdown Body — Collapsible in browser, FORCED EXPANDED in print */}
              <div
                className={`experience-dropdown-content px-4 pb-4 space-y-2.5 border-t ${
                  light ? 'border-slate-100' : 'border-gray-800/60'
                } ${isExpanded ? 'block' : 'hidden'} print:!block print:!pt-3`}
              >
                <div className="pt-3 space-y-2.5">
                  {g.bullets.map((b) => (
                    <BulletRow key={b.bulletId} bullet={b} light={light} />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { STATUS_STYLES }
