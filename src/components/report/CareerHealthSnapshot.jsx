import { motion } from 'framer-motion'
import {
  FileText,
  Target,
  ShareNetwork,
  UserCheck,
  ArrowRight,
} from '@phosphor-icons/react'

function safeText(val, fallback = '') {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return val.text || val.diagnosis || val.summary || fallback
  return fallback
}

export default function CareerHealthSnapshot({ scores, resumeAgent, resumeJson, reportData, onNavigateSection }) {
  // Extract or compute the 4 core dimensions
  // 1. Impact (Resume / Projects)
  const dynResume = Number(
    scores?.resume?.score ??
    scores?.resume ??
    resumeAgent?.dashboard?.score ??
    resumeJson?.ats_score ??
    reportData?.resume_agent?.dashboard?.score ??
    reportData?.resume_json?.ats_score
  )
  const resumeScore = !isNaN(dynResume) && dynResume > 0 ? dynResume : 34
  const resumeDiag = safeText(
    scores?.resume?.diagnosis ||
    resumeAgent?.dashboard?.summary ||
    resumeAgent?.overallReview?.summary ||
    resumeJson?.executive_ai_critique,
    'Lacks quantified metrics and business ROI figures.'
  )

  // 2. Positioning (ATS & LinkedIn)
  const dynPositioning = Number(
    scores?.linkedin?.score ??
    scores?.linkedin ??
    scores?.positioning?.score ??
    scores?.positioning ??
    resumeJson?.ats_score ??
    reportData?.linkedin_agent?.score
  )
  const linkedinScore = !isNaN(dynPositioning) && dynPositioning > 0 ? dynPositioning : 38
  const linkedinDiag = safeText(
    scores?.linkedin?.diagnosis ||
    reportData?.linkedin_agent?.summary ||
    scores?.positioning?.diagnosis,
    'Decent completeness but low recruiter keyword density.'
  )

  // 3. Job Search (Outreach & Application Velocity)
  const outreachScore = Number(scores?.outreach?.score ?? scores?.outreach) || 22
  const outreachDiag = safeText(scores?.outreach?.diagnosis, 'Outreach volume is low, relying mostly on standard Easy Apply.')

  // 4. Interview Readiness
  const interviewScore = Number(scores?.interview?.score ?? scores?.interviews?.score ?? scores?.interview ?? scores?.interviews) || 42
  const interviewDiag = safeText(scores?.interview?.diagnosis || scores?.interviews?.diagnosis, 'Good technical answers, needs STAR behavioral structure.')

  const METRICS = [
    {
      id: 'impact',
      label: 'Resume Impact',
      score: resumeScore,
      icon: FileText,
      explanation: resumeDiag,
      targetSection: 'opportunities',
      color: resumeScore >= 60 ? 'emerald' : resumeScore >= 40 ? 'amber' : 'rose',
    },
    {
      id: 'positioning',
      label: 'ATS & Positioning',
      score: linkedinScore,
      icon: Target,
      explanation: linkedinDiag,
      targetSection: 'diagnosis',
      tab: 'resume',
      color: linkedinScore >= 60 ? 'emerald' : linkedinScore >= 40 ? 'amber' : 'rose',
    },
    {
      id: 'job-search',
      label: 'Job Search Velocity',
      score: outreachScore,
      icon: ShareNetwork,
      explanation: outreachDiag,
      targetSection: 'funnel-risks',
      color: outreachScore >= 60 ? 'emerald' : outreachScore >= 40 ? 'amber' : 'rose',
    },
    {
      id: 'interview',
      label: 'Interview Readiness',
      score: interviewScore,
      icon: UserCheck,
      explanation: interviewDiag,
      targetSection: 'diagnosis',
      tab: 'interview',
      color: interviewScore >= 60 ? 'emerald' : interviewScore >= 40 ? 'amber' : 'rose',
    },
  ]

  const getStatusBadge = (score) => {
    if (score >= 70) return { label: 'Strong', class: 'bg-emerald-500/10 text-[var(--emerald)] border-emerald-500/20' }
    if (score >= 50) return { label: 'Fair', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' }
    if (score >= 35) return { label: 'Needs Work', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
    return { label: 'Critical Gap', class: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20' }
  }

  const handleClick = (metric) => {
    if (onNavigateSection) {
      onNavigateSection(metric.targetSection, metric.tab)
    } else {
      const el = document.getElementById(metric.targetSection)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section id="snapshot" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
            Health Snapshot
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Career Health Diagnostics
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          4 calibrated dimensions evaluated across your resume & activity
        </p>
      </div>

      {/* 4-Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m) => {
          const Icon = m.icon
          const status = getStatusBadge(m.score)

          return (
            <motion.div
              key={m.id}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              onClick={() => handleClick(m)}
              className="group p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-[var(--border-hover)] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Card Top: Icon & Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                    <Icon size={20} weight="bold" />
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${status.class}`}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Dimension Title & Score */}
                <div className="flex items-baseline justify-between pt-1">
                  <h3
                    className="text-base font-bold text-[var(--text-primary)] tracking-tight"
                    style={{ fontFamily: 'var(--font-head)' }}
                  >
                    {m.label}
                  </h3>
                  <span className="font-mono text-sm font-extrabold text-[var(--text-primary)]">
                    {m.score}
                    <span className="text-[10px] text-[var(--text-muted)] font-medium">/100</span>
                  </span>
                </div>

                {/* Mini Progress Bar */}
                <div className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-full overflow-hidden border border-[var(--border-default)]/60">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      m.score >= 60
                        ? 'bg-[var(--emerald)]'
                        : m.score >= 40
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.max(m.score, 6)}%` }}
                  />
                </div>

                {/* One-Line Explanation */}
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed line-clamp-2">
                  {m.explanation}
                </p>
              </div>

              {/* Action Hint */}
              <div className="pt-3 mt-3 border-t border-[var(--border-default)] flex items-center justify-between text-[11px] text-[var(--text-muted)] group-hover:text-[var(--primary)] font-semibold transition-colors">
                <span>View diagnosis</span>
                <ArrowRight size={13} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
