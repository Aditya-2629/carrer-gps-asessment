import React from 'react'
import { ArrowRight, PencilSimple, Warning, CheckCircle } from '@phosphor-icons/react'

/**
 * ResumeBulletAudit — every bullet with a verdict chip and, where available,
 * the before → after rewrite. Reads `analysis.dashboard.bulletAudit`.
 * This is the "recruiter reads your resume line by line" view.
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
    <div className={`${cardBg} border ${s.rowBorder} rounded-xl p-4 space-y-2.5 print:break-inside-avoid`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${s.chip} print:break-inside-avoid`}>{st.label}</span>
          {bullet.category && (
            <span className={`text-[10px] font-mono uppercase ${light ? 'text-slate-400' : 'text-gray-500'}`}>{bullet.category.replace(/_/g, ' ')}</span>
          )}
        </div>
        <span className={`text-[10px] font-mono shrink-0 ${light ? 'text-slate-300' : 'text-gray-600'}`}>{bullet.bulletId}</span>
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
            <div className={`text-[9px] uppercase font-bold tracking-wider mb-1 ${light ? 'text-slate-400' : 'text-gray-600'}`}>Before</div>
            <div className={`text-[11px] line-through leading-snug ${light ? 'text-slate-400 decoration-slate-400' : 'text-gray-400 decoration-gray-600'}`}>{bullet.text}</div>
          </div>
          <ArrowRight size={16} className={`rotate-90 sm:rotate-0 mx-auto ${light ? 'text-indigo-500' : 'text-indigo-400'}`} />
          <div className={`border rounded-lg p-2.5 ${light ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-950/40 border-indigo-800/60'}`}>
            <div className={`text-[9px] uppercase font-bold tracking-wider mb-1 ${light ? 'text-indigo-500' : 'text-indigo-400'}`}>After</div>
            <div className={`text-[11px] font-medium leading-snug ${light ? 'text-indigo-900' : 'text-indigo-100'}`}>{bullet.rewrite}</div>
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

  const counts = {
    fix: bulletAudit.filter((b) => b.status === 'fix').length,
    warn: bulletAudit.filter((b) => b.status === 'warn').length,
    pass: bulletAudit.filter((b) => b.status === 'pass').length,
  }

  const labelColor = light ? 'text-slate-400' : 'text-gray-400'
  const groupName = light ? 'text-slate-900' : 'text-white'
  const badgeBg = light ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-gray-900 border-gray-800 text-gray-600'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-bold uppercase tracking-wider ${labelColor}`}>Line-by-Line Bullet Audit</h3>
        <div className={`flex items-center gap-2 text-[10px] font-mono ${labelColor}`}>
          <span className={light ? 'text-red-600' : 'text-red-400'}>{counts.fix} to fix</span>
          <span>·</span>
          <span className={light ? 'text-amber-600' : 'text-amber-400'}>{counts.warn} to improve</span>
          <span>·</span>
          <span className={light ? 'text-emerald-600' : 'text-emerald-400'}>{counts.pass} good</span>
        </div>
      </div>

      <div className="space-y-5">
        {groups.map((g, gi) => (
          <div key={`${g.itemName}_${gi}`} className="space-y-2.5 print:break-inside-avoid">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold ${groupName}`}>{g.itemName}</span>
              <span className={`text-[9px] uppercase tracking-wider border px-1.5 py-0.5 rounded ${badgeBg}`}>{g.section}</span>
            </div>
            {g.bullets.map((b) => (
              <BulletRow key={b.bulletId} bullet={b} light={light} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export { STATUS_STYLES }
