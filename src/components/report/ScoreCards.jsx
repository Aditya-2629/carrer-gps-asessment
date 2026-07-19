import { FileText, LinkedinLogo, PaperPlaneTilt, Microphone, ChartBar } from '@phosphor-icons/react'

const SCORE_META = {
  resume: { label: 'Resume', icon: FileText, desc: 'ATS optimization, impact metrics, formatting' },
  linkedin: { label: 'LinkedIn', icon: LinkedinLogo, desc: 'Profile completeness, keywords, activity' },
  outreach: { label: 'Outreach', icon: PaperPlaneTilt, desc: 'Cold email, networking, referral strategy' },
  interview: { label: 'Interview', icon: Microphone, desc: 'Prep quality, mock practice, feedback' },
}

function getBar(score) {
  if (score >= 75) return { color: '#10b981', bg: 'rgba(16,185,129,0.12)' }
  if (score >= 50) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
  return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }
}

export default function ScoreCards({ scores }) {
  return (
    <div>
      <h2
        className="text-xl font-bold mb-5 flex items-center gap-2.5"
        style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.9)' }}
      >
        <ChartBar size={20} className="text-emerald-500" />
        <span>Score Breakdown</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(scores).map(([key, scoreVal]) => {
          const score = typeof scoreVal === 'object' ? scoreVal.score : scoreVal
          const diagnosis = typeof scoreVal === 'object' ? scoreVal.diagnosis : null
          const meta = SCORE_META[key]
          if (!meta) return null
          const Icon = meta.icon
          const { color, bg } = getBar(score)
          return (
            <div
              key={key}
              className="glass p-5 rounded-2xl"
              style={{ background: bg }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Icon size={18} className="text-white/70 shrink-0" />
                  <span
                    className="font-semibold text-sm"
                    style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.9)' }}
                  >
                    {meta.label}
                  </span>
                </div>
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ fontFamily: 'Space Grotesk, sans-serif', color }}
                >
                  {score}
                </span>
              </div>
              {/* Bar */}
              <div className="progress-track mb-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${score}%`,
                    background: color,
                    transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                    height: '6px',
                  }}
                />
              </div>
              <p className="text-xs leading-relaxed font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {diagnosis || meta.desc}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}


