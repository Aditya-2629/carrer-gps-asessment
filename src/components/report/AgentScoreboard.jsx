import React from 'react'
import { Compass, FileText, LinkedinLogo, CaretRight } from '@phosphor-icons/react'

/**
 * AgentScoreboard — makes the multi-agent architecture visible.
 * One card per analysis agent (Assessment/Atlas, Resume, LinkedIn) with its
 * live score; each card jumps to that agent's full diagnosis section.
 * Cards only render when their agent has data (backward compatible).
 */

function MiniRing({ score, grade }) {
  const R = 26
  const CIRC = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, score)) / 100
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#0d9488' : score >= 55 ? '#d97706' : score >= 40 ? '#ea580c' : '#dc2626'
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--border-default)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-extrabold text-[var(--text-primary)] tabular-nums leading-none">{score}</span>
        <span className="text-[9px] font-bold mt-0.5" style={{ color }}>{grade}</span>
      </div>
    </div>
  )
}

const scrollTo = (id) => {
  const el = document.getElementById(id)
  if (el) {
    const pos = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: pos - 90, behavior: 'smooth' })
  }
}

export default function AgentScoreboard({ reportData }) {
  const careerScore = typeof reportData?.career_health_score === 'number' ? reportData.career_health_score : null
  const resumeDash = reportData?.resume_agent?.dashboard
  const linkedin = reportData?.linkedin_agent

  const agents = [
    careerScore !== null && {
      id: 'snapshot',
      name: 'Assessment Agent',
      desc: 'Career health across 31 strategy signals',
      icon: <Compass size={20} weight="fill" className="text-[var(--primary)]" />,
      score: careerScore,
      grade: careerScore >= 85 ? 'A' : careerScore >= 70 ? 'B' : careerScore >= 55 ? 'C' : careerScore >= 40 ? 'D' : 'F',
      cta: 'View snapshot',
    },
    resumeDash && {
      id: 'resume-ai',
      name: 'Resume Agent',
      desc: 'Line-by-line resume audit + rewrites',
      icon: <FileText size={20} weight="fill" className="text-emerald-500" />,
      score: resumeDash.score,
      grade: resumeDash.grade,
      cta: 'View diagnosis',
    },
    linkedin?.dataAvailable && {
      id: 'linkedin-ai',
      name: 'LinkedIn Agent',
      desc: 'Profile visibility & branding audit',
      icon: <LinkedinLogo size={20} weight="fill" className="text-sky-500" />,
      score: linkedin.score,
      grade: linkedin.grade,
      cta: 'View diagnosis',
    },
  ].filter(Boolean)

  if (agents.length === 0) return null

  return (
    <section id="agent-team" className="scroll-mt-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--primary)] mb-1">
            Multi-Agent Analysis
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] font-['Poppins']">
            Three specialists reviewed your career
          </h2>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${agents.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => scrollTo(a.id)}
            className="text-left bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-[var(--primary)]/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <MiniRing score={a.score} grade={a.grade} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {a.icon}
                  <span className="text-sm font-bold text-[var(--text-primary)]">{a.name}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-snug">{a.desc}</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] mt-2 group-hover:gap-2 transition-all">
                  {a.cta} <CaretRight size={12} weight="bold" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
