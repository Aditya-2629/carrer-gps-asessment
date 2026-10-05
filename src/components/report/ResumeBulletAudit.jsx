import React from 'react'
import { ArrowRight, PencilSimple, Warning, CheckCircle } from '@phosphor-icons/react'

/**
 * ResumeBulletAudit — every bullet with a verdict chip and, where available,
 * the before → after rewrite. Reads `analysis.dashboard.bulletAudit`.
 * This is the "recruiter reads your resume line by line" view.
 */

const STATUS_STYLES = {
  fix: {
    chip: 'bg-red-950/80 border-red-700/60 text-red-300',
    label: 'FIX',
    rowBorder: 'border-red-900/40',
    icon: <PencilSimple size={14} weight="fill" className="text-red-400" />,
  },
  warn: {
    chip: 'bg-amber-950/80 border-amber-700/60 text-amber-300',
    label: 'IMPROVE',
    rowBorder: 'border-amber-900/40',
    icon: <Warning size={14} weight="fill" className="text-amber-400" />,
  },
  pass: {
    chip: 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300',
    label: 'GOOD',
    rowBorder: 'border-emerald-900/40',
    icon: <CheckCircle size={14} weight="fill" className="text-emerald-400" />,
  },
}

function BulletRow({ bullet }) {
  const s = STATUS_STYLES[bullet.status] || STATUS_STYLES.pass
  return (
    <div className={`bg-[#070b14] border ${s.rowBorder} rounded-xl p-4 space-y-2.5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${s.chip}`}>{s.label}</span>
          {bullet.category && (
            <span className="text-[10px] font-mono text-gray-500 uppercase">{bullet.category.replace(/_/g, ' ')}</span>
          )}
        </div>
        <span className="text-[10px] font-mono text-gray-600 shrink-0">{bullet.bulletId}</span>
      </div>

      <p className="text-xs text-gray-300 leading-relaxed">{bullet.text}</p>

      {bullet.status !== 'pass' && bullet.reason && (
        <div className="flex items-start gap-2 text-[11px] text-gray-400">
          {s.icon}
          <span className="leading-snug">{bullet.reason}</span>
        </div>
      )}

      {bullet.rewrite && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2 pt-1">
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-gray-600 tracking-wider mb-1">Before</div>
            <div className="text-[11px] text-gray-400 line-through decoration-gray-600 leading-snug">{bullet.text}</div>
          </div>
          <ArrowRight size={16} className="text-indigo-400 rotate-90 sm:rotate-0 mx-auto" />
          <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-lg p-2.5">
            <div className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider mb-1">After</div>
            <div className="text-[11px] text-indigo-100 font-medium leading-snug">{bullet.rewrite}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResumeBulletAudit({ bulletAudit }) {
  if (!Array.isArray(bulletAudit) || bulletAudit.length === 0) return null

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Line-by-Line Bullet Audit</h3>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-red-400">{counts.fix} to fix</span>
          <span className="text-gray-600">·</span>
          <span className="text-amber-400">{counts.warn} to improve</span>
          <span className="text-gray-600">·</span>
          <span className="text-emerald-400">{counts.pass} good</span>
        </div>
      </div>

      <div className="space-y-5">
        {groups.map((g, gi) => (
          <div key={`${g.itemName}_${gi}`} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white">{g.itemName}</span>
              <span className="text-[9px] uppercase tracking-wider text-gray-600 bg-gray-900 border border-gray-800 px-1.5 py-0.5 rounded">
                {g.section}
              </span>
            </div>
            {g.bullets.map((b) => (
              <BulletRow key={b.bulletId} bullet={b} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export { STATUS_STYLES }
