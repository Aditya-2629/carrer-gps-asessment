import React from 'react'
import { Sparkle, ListChecks, WarningCircle } from '@phosphor-icons/react'
import ResumeScoreCard from './ResumeScoreCard.jsx'
import ResumeBulletAudit from './ResumeBulletAudit.jsx'
import useAppStore from '../../store/useAppStore'

/**
 * ResumeDeepDiagnosis — the Resume Specialist Agent's section inside the MAIN
 * Career GPS report. Renders the deterministic scorecard (0-100, letter grades,
 * checklist), the line-by-line bullet audit with before→after rewrites, and
 * the deep-diagnosis issue cards from `reportData.resume_agent`.
 * Renders nothing when the analysis is absent (backward compatible).
 */

const severityChip = {
  high: 'bg-red-950/80 border-red-700/60 text-red-300',
  medium: 'bg-amber-950/80 border-amber-700/60 text-amber-300',
  low: 'bg-sky-950/80 border-sky-700/60 text-sky-300',
}

function SectionHeader({ icon, title, accent }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className={accent}>{icon}</span>
      <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
      <span className="flex-1 h-px bg-[var(--border-default)]" />
    </div>
  )
}

export default function ResumeDeepDiagnosis({ resumeAgent }) {
  const theme = useAppStore((s) => s.theme)
  if (!resumeAgent?.dashboard && !resumeAgent?.issues?.length) return null

  const dashboard = resumeAgent.dashboard
  const issues = (resumeAgent.issues || []).filter(Boolean)
  const priorityActions = (resumeAgent.priorityActions || []).filter(Boolean)
  const firstName = (resumeAgent.candidateSnapshot?.name || '').split(' ')[0]
  const variant = theme === 'dark' ? 'dark' : 'light'

  return (
    <section id="resume-deep-diagnosis" className="space-y-8 scroll-mt-24">
      <SectionHeader
        icon={<Sparkle size={20} weight="fill" className="text-indigo-400" />}
        title="AI Resume Deep Diagnosis"
        accent="text-indigo-400"
      />

      {/* Scorecard */}
      {dashboard && (
        <ResumeScoreCard dashboard={dashboard} candidateName={firstName} variant={variant} />
      )}

      {/* Overall review */}
      {resumeAgent.overallReview?.summary && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-6">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 mb-3">
            <Sparkle size={15} weight="fill" /> The Recruiter's Read
          </h3>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
            {resumeAgent.overallReview.summary}
          </p>
        </div>
      )}

      {/* Line-by-line audit */}
      {dashboard?.bulletAudit?.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5">
          <ResumeBulletAudit bulletAudit={dashboard.bulletAudit} variant={variant} />
        </div>
      )}

      {/* Deep issues */}
      {issues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <WarningCircle size={15} className="text-amber-400" /> Deep Diagnosis ({issues.length})
          </h3>
          {issues.map((iss, i) => {
            const qs = Array.isArray(iss.metricDiscoveryQuestions) ? iss.metricDiscoveryQuestions : []
            return (
              <div
                key={iss.id || i}
                className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityChip[iss.severity] || severityChip.low}`}>
                    {iss.severity} · {String(iss.category || '').replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{iss.title}</span>
                </div>
                {iss.diagnosis && <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{iss.diagnosis}</p>}
                {iss.recommendation && (
                  <p className="text-xs text-indigo-200 leading-relaxed bg-indigo-950/30 border border-indigo-900/50 rounded-xl p-3">
                    → {iss.recommendation}
                  </p>
                )}
                {qs.length > 0 && (
                  <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-3">
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                      Go find your real numbers:
                    </div>
                    <ul className="space-y-1">
                      {qs.map((q, qi) => (
                        <li key={qi} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">?</span> {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Priority actions */}
      {priorityActions.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-indigo-900/50 rounded-2xl p-6">
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2 mb-4">
            <ListChecks size={15} /> Do These First
          </h3>
          <div className="space-y-3">
            {priorityActions.map((pa, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                  {pa.priority || i + 1}
                </span>
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">{pa.title}</div>
                  {pa.action && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{pa.action}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
