import { motion } from 'framer-motion'
import { FileText, LinkedinLogo, MagnifyingGlass, Code, UserCheck, Lightning, Target, Briefcase, ChatCircleText } from '@phosphor-icons/react'

export default function MissionBoard({ data }) {
  const safeData = data || {}
  const xpLevel = safeData.xp_level || "Level 4: Career Explorer"
  const xpCurrent = safeData.xp_current || 410
  const xpGoal = 1000
  const xpPct = Math.min((xpCurrent / xpGoal) * 100, 100).toFixed(0)
  
  const missions = safeData.missions || [
    { title: 'Rebuild Resume', xp: '+18 XP', impact: 'High Impact' },
    { title: 'Optimize LinkedIn', xp: '+12 XP', impact: 'High Impact' },
    { title: 'Fix ATS Issues', xp: '+15 XP', impact: 'High Impact' },
    { title: 'Add 2 Projects', xp: '+10 XP', impact: 'Medium Impact' },
    { title: '3 Mock Interviews', xp: '+15 XP', impact: 'High Impact' },
  ]

  // Map keywords to Phosphor icons and colors
  const getIconConfig = (title) => {
    const t = title.toLowerCase()
    if (t.includes('resume') || t.includes('cv')) return { icon: FileText, color: 'text-blue-400', border: 'border-blue-500/30' }
    if (t.includes('linkedin') || t.includes('profile')) return { icon: LinkedinLogo, color: 'text-sky-400', border: 'border-sky-500/30' }
    if (t.includes('ats') || t.includes('search')) return { icon: MagnifyingGlass, color: 'text-amber-400', border: 'border-amber-500/30' }
    if (t.includes('interview') || t.includes('mock')) return { icon: UserCheck, color: 'text-emerald-400', border: 'border-emerald-500/30' }
    if (t.includes('project') || t.includes('code')) return { icon: Code, color: 'text-purple-400', border: 'border-purple-500/30' }
    if (t.includes('network') || t.includes('outreach')) return { icon: ChatCircleText, color: 'text-pink-400', border: 'border-pink-500/30' }
    if (t.includes('apply') || t.includes('job')) return { icon: Briefcase, color: 'text-orange-400', border: 'border-orange-500/30' }
    
    return { icon: Target, color: 'text-emerald-400', border: 'border-emerald-500/30' } // default
  }

  return (
    <div className="quiz-card p-6 md:p-8 border border-[var(--border-default)] space-y-6">
      {/* Slide Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono font-bold text-[var(--primary)] uppercase tracking-wider block mb-1">
            07 TOP PRIORITIES (YOUR MISSION BOARD)
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
            Complete these missions to unlock the <span className="text-[var(--emerald)]">next phase.</span>
          </h2>
        </div>
      </div>

      {/* Mission Action Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 pt-2">
        {missions.map((m, idx) => {
          const { icon: Icon, color, border } = getIconConfig(m.title)
          return (
            <motion.div
              key={idx}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className={`quiz-card p-4 border ${border} bg-[var(--surface-sunken)] flex flex-col items-center text-center space-y-3 shadow-sm`}
            >
              <div className={`w-12 h-12 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] flex items-center justify-center ${color}`}>
                <Icon size={26} weight="fill" />
              </div>

              <h4 className="text-xs font-bold text-[var(--text-primary)] leading-snug" style={{ fontFamily: 'var(--font-head)' }}>
                {m.title}
              </h4>

              <div className="space-y-1 w-full pt-1 border-t border-[var(--border-default)] mt-auto">
                <span className="text-xs font-extrabold font-mono text-[var(--emerald)] block">{m.xp}</span>
                <span className="text-[10px] text-[var(--text-subtle)] block font-medium uppercase tracking-wider">{m.impact}</span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Gamified Level Progress Bar at Bottom */}
      <div className="quiz-card p-5 border border-[var(--border-default)] bg-[var(--surface-sunken)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)] shrink-0">
            <Lightning size={24} weight="fill" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-[var(--text-subtle)] uppercase block">YOUR CAREER LEVEL</span>
            <span className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
              {xpLevel}
            </span>
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex-1 max-w-md w-full space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[var(--text-muted)]">XP Progress</span>
            <span className="text-[var(--emerald)] font-bold">{xpCurrent} / {xpGoal} XP</span>
          </div>
          <div className="h-3 bg-[var(--surface-card)] rounded-full overflow-hidden border border-[var(--border-default)]">
            <div 
              className="h-full bg-[var(--emerald)] rounded-full transition-all duration-1000" 
              style={{ width: `${xpPct}%` }} 
            />
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-[10px] text-[var(--text-subtle)] block uppercase font-mono">NEXT LEVEL</span>
          <span className="font-semibold text-[var(--text-primary)]">{(xpGoal - xpCurrent > 0) ? `${xpGoal - xpCurrent} XP to go` : 'Max Level'}</span>
        </div>
      </div>
    </div>
  )
}
