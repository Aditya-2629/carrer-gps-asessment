import { TrendDown, SpeakerSlash, FileText, Warning, EyeClosed, LightningSlash, ShieldSlash } from '@phosphor-icons/react'

const ICON_MAP = {
  'alert-triangle': Warning,
  'zap-off': LightningSlash,
  'eye-off': EyeClosed,
  'shield-off': ShieldSlash,
  '📈': TrendDown,
  '🔇': SpeakerSlash,
  '📄': FileText,
}

const SEVERITY = {
  high: { color: '#ef4444', bg: 'rgba(239,68,68,0.04)', border: 'rgba(239,68,68,0.18)', badge: 'High Priority' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.18)', badge: 'Medium Priority' },
  low: { color: '#10b981', bg: 'rgba(16,185,129,0.04)', border: 'rgba(16,185,129,0.18)', badge: 'Low Priority' },
  High: { color: '#ef4444', bg: 'rgba(239,68,68,0.04)', border: 'rgba(239,68,68,0.18)', badge: 'High Priority' },
  Medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.18)', badge: 'Medium Priority' },
  Low: { color: '#10b981', bg: 'rgba(16,185,129,0.04)', border: 'rgba(16,185,129,0.18)', badge: 'Low Priority' },
}

export default function CriticalIssues({ issues }) {
  return (
    <div className="flex flex-col gap-4">
      {issues.map((issue) => {
        const sev = SEVERITY[issue.severity] || SEVERITY.medium
        const IconComponent = ICON_MAP[issue.icon] || Warning

        return (
          <div
            key={issue.id}
            className="p-5 rounded-2xl border"
            style={{
              background: sev.bg,
              borderColor: sev.border,
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${sev.color}12`, color: sev.color }}
              >
                <IconComponent size={20} weight="bold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h3
                    className="font-semibold text-sm"
                    style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.95)' }}
                  >
                    {issue.title}
                  </h3>
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded"
                    style={{
                      background: `${sev.color}15`,
                      color: sev.color,
                      border: `1px solid ${sev.color}25`,
                    }}
                  >
                    {sev.badge}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {issue.description}
                </p>
                {issue.action_steps && issue.action_steps.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-white/5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 mb-2">Immediate Fixes:</p>
                    <ul className="space-y-2 list-none pl-0">
                      {issue.action_steps.map((step, sIdx) => (
                        <li key={sIdx} className="text-xs text-white/60 flex items-start gap-2">
                          <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

