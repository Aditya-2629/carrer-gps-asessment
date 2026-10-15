import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ListChecks,
  ArrowRight,
  Sparkle,
  Lightning,
  CheckCircle,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react'

export default function TopPriorities({ missionBoardData, resumeAgent, reportData, onNavigateSection }) {
  const [showAll, setShowAll] = useState(false)

  const DEFAULT_PRIORITIES = [
    {
      num: '01',
      title: 'ATS Resume Overhaul & Achievement Bullets',
      why: 'Applications without quantified metrics get filtered out before human recruiter review.',
      action: 'Rewrite top experience bullets with quantified metrics and measurable outcomes.',
      expectedDirection: 'Immediate increase in initial recruiter screening calls within 14 days.',
      targetSection: 'opportunities',
      impact: 'Highest Impact',
    },
    {
      num: '02',
      title: 'Targeted Recruiter & Hiring Manager Outreach',
      why: 'Proactive outreach bypasses high-volume job board queues and secures direct conversations.',
      action: 'Identify and send concise, value-focused messages to relevant recruiters weekly.',
      expectedDirection: 'Faster initial screening and direct interview scheduling.',
      targetSection: 'diagnosis',
      tab: 'linkedin',
      impact: 'High Impact',
    },
    {
      num: '03',
      title: 'Align Profile Keywords for Inbound Search',
      why: 'Corporate recruiters search daily using specific skill and title filters.',
      action: 'Update headline, summary, and core skills to align with target role requirements.',
      expectedDirection: 'Higher appearance in relevant recruiter searches.',
      targetSection: 'diagnosis',
      tab: 'linkedin',
      impact: 'High Impact',
    },
  ]

  const agentActions = Array.isArray(resumeAgent?.priorityActions) && resumeAgent.priorityActions.length > 0
    ? resumeAgent.priorityActions.filter(Boolean).map((pa, i) => {
        const isObj = typeof pa === 'object' && pa !== null
        return {
          num: String(isObj ? (pa.priority || i + 1) : i + 1).padStart(2, '0'),
          title: isObj ? pa.title : String(pa || ''),
          why: isObj ? (pa.reason || 'Surfaced as a top priority in your recruiter audit.') : 'High-impact resume action item.',
          action: isObj ? (typeof pa.action === 'string' ? pa.action : pa.action?.description || pa.action?.text || '') : '',
          expectedDirection: 'Directly addresses identified resume bottleneck.',
          targetSection: 'resume-ai',
          impact: i === 0 ? 'Highest Impact' : 'High Impact',
        }
      })
    : (Array.isArray(resumeAgent?.issues) && resumeAgent.issues.length > 0
        ? resumeAgent.issues.slice(0, 3).map((iss, i) => ({
            num: String(i + 1).padStart(2, '0'),
            title: iss.title || `Resolve ${iss.category ? String(iss.category).replace(/_/g, ' ') : 'Resume Gap'}`,
            why: iss.whyItMatters || iss.diagnosis || 'High-priority gap surfaced in resume recruiter review.',
            action: iss.recommendation || (Array.isArray(iss.action_steps) ? iss.action_steps[0] : iss.action_steps) || 'Apply recruiter recommended rewrite.',
            expectedDirection: 'Directly improves resume ATS readability and callback conversion.',
            targetSection: 'opportunities',
            impact: i === 0 ? 'Highest Impact' : 'High Impact',
          }))
        : (Array.isArray(reportData?.critical_issues) && reportData.critical_issues.length > 0
            ? reportData.critical_issues.slice(0, 3).map((iss, i) => ({
                num: String(i + 1).padStart(2, '0'),
                title: typeof iss === 'string' ? iss : iss.title || 'Critical Issue Resolution',
                why: typeof iss === 'object' ? iss.description || iss.diagnosis || 'Critical pipeline bottleneck.' : 'Critical pipeline bottleneck.',
                action: typeof iss === 'object' && iss.action_steps ? (Array.isArray(iss.action_steps) ? iss.action_steps[0] : iss.action_steps) : 'Implement high-impact fix.',
                expectedDirection: 'Eliminates active job search bottleneck.',
                targetSection: 'opportunities',
                impact: i === 0 ? 'Highest Impact' : 'High Impact',
              }))
            : []))

  const PRIORITIES = agentActions.length > 0 ? agentActions.slice(0, 3) : DEFAULT_PRIORITIES

  // Extra missions from missionBoardData if user wants to see all
  const rawMissions = Array.isArray(missionBoardData?.missions) ? missionBoardData.missions : [
    { title: 'Add 2 Enterprise Side Projects', xp: '+10 XP', impact: 'Medium Impact' },
    { title: '3 Mock Behavioral & System Interviews', xp: '+15 XP', impact: 'High Impact' },
  ]

  const extraMissions = rawMissions.map((m) => {
    if (typeof m === 'string') return { title: m, xp: '+10 XP', impact: 'Medium Impact' }
    return {
      title: typeof m?.title === 'string' ? m.title : (m?.title?.text || m?.mission || 'Strategic Task'),
      xp: typeof m?.xp === 'string' ? m.xp : '+10 XP',
      impact: typeof m?.impact === 'string' ? m.impact : 'Medium Impact',
    }
  })

  const rawXpLevel = missionBoardData?.xp_level
  const xpLevel = typeof rawXpLevel === 'string' ? rawXpLevel : 'Level 4: Career Explorer'
  const xpCurrent = Number(missionBoardData?.xp_current) || 410
  const xpGoal = 1000

  const handleActionClick = (item) => {
    if (onNavigateSection) {
      onNavigateSection(item.targetSection, item.tab)
    } else {
      const el = document.getElementById(item.targetSection)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section id="priorities" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
            Immediate Focus
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            What should you fix first?
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Focus exclusively on these top 3 high-leverage moves before applying to new listings
        </p>
      </div>

      {/* 3 Priority Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PRIORITIES.map((p) => (
          <motion.div
            key={p.num}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-[var(--primary)]/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3.5">
              {/* Card Header: Number + Impact Badge */}
              <div className="flex items-center justify-between">
                <span
                  className="text-2xl font-black font-mono text-[var(--primary)]"
                  style={{ fontFamily: 'var(--font-head)' }}
                >
                  {p.num}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                  {p.impact}
                </span>
              </div>

              {/* Title */}
              <h3
                className="text-base font-bold text-[var(--text-primary)] tracking-tight leading-snug"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                {p.title}
              </h3>

              {/* Structured 3 Sentences: Why | Action | Expected Direction */}
              <div className="space-y-2 text-xs leading-relaxed font-medium">
                <div>
                  <strong className="text-[var(--text-primary)] font-bold">Why: </strong>
                  <span className="text-[var(--text-secondary)]">{p.why}</span>
                </div>
                <div>
                  <strong className="text-[var(--primary)] font-bold">Action: </strong>
                  <span className="text-[var(--text-primary)] font-semibold">{p.action}</span>
                </div>
                <div>
                  <strong className="text-[var(--emerald)] font-bold">Expected direction: </strong>
                  <span className="text-[var(--text-secondary)]">{p.expectedDirection}</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-3 border-t border-[var(--border-default)]">
              <button
                type="button"
                onClick={() => handleActionClick(p)}
                className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <span>View action</span>
                <ArrowRight size={13} weight="bold" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Expandable "View all recommendations" (Gamified Missions & XP) */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-strong)] px-4 py-2 rounded-full border border-[var(--border-default)] transition-colors cursor-pointer"
        >
          <span>{showAll ? 'Hide additional recommendations' : 'View all recommendations & level progress'}</span>
          {showAll ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
        </button>

        <AnimatePresence>
          {showAll && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-left space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
                <div>
                  <span className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase block">
                    Career XP Level
                  </span>
                  <span className="text-base font-bold text-[var(--text-primary)]">
                    {xpLevel}
                  </span>
                </div>
                <div className="text-xs font-mono font-semibold text-[var(--emerald)]">
                  {xpCurrent} / {xpGoal} XP to next milestone
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {extraMissions.map((m, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{m.title}</span>
                    <span className="font-mono font-bold text-[var(--emerald)]">{m.xp}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
