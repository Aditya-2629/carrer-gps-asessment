import { TrendDown, SpeakerSlash, FileText, Warning, EyeClosed, LightningSlash, ShieldSlash } from '@phosphor-icons/react'

const ICON_MAP = {
  'alert-triangle': Warning,
  'zap-off': LightningSlash,
  'eye-off': EyeClosed,
  'shield-off': ShieldSlash,
  'trend-down': TrendDown,
  'speaker-slash': SpeakerSlash,
  'file-text': FileText,
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
            className="p-5 rounded-xl border"
            style={{
              background: sev.bg,
              borderColor: sev.border,
            }}
          >
            <div className="flex items-start gap-3.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${sev.color}12`, color: sev.color }}
              >
                <IconComponent size={16} weight="regular" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3
                    className="font-semibold text-base sm:text-lg text-[var(--text-primary)] tracking-tight"
                    style={{ fontFamily: 'var(--font-head)' }}
                  >
                    {issue.title}
                  </h3>
                  <span
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                    style={{
                      background: `${sev.color}15`,
                      color: sev.color,
                      border: `1px solid ${sev.color}30`,
                    }}
                  >
                    {sev.badge}
                  </span>
                </div>
                <p className="text-sm sm:text-base leading-relaxed text-[var(--text-secondary)] font-medium">
                  {issue.description}
                </p>
                {issue.action_steps && issue.action_steps.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-[var(--border-default)]">
                    <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Immediate Action Steps:</p>
                    <ul className="space-y-2.5 list-none pl-0">
                      {issue.action_steps.map((step, sIdx) => (
                        <li key={sIdx} className="text-sm text-[var(--text-primary)] font-medium flex items-start gap-2.5 leading-relaxed">
                          <span className="text-[var(--emerald)] font-bold shrink-0 mt-0.5 text-base">•</span>
                          <span>{step}</span>
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

