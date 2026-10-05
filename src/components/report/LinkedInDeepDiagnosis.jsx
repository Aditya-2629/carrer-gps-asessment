import React from 'react'
import { LinkedinLogo, WarningCircle, ArrowRight } from '@phosphor-icons/react'
import ResumeScoreCard from './ResumeScoreCard.jsx'
import useAppStore from '../../store/useAppStore'

/**
 * LinkedInDeepDiagnosis — the LinkedIn Agent's section in the main report.
 * Reuses the same scorecard contract/components as the Resume Agent
 * (score + grades + checks), then lists the agent's coaching issues.
 * Renders nothing when no LinkedIn analysis exists.
 */

const severityChip = {
  high: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/80 dark:border-red-700/60 dark:text-red-300',
  medium: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/80 dark:border-amber-700/60 dark:text-amber-300',
  low: 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/80 dark:border-sky-700/60 dark:text-sky-300',
}

export default function LinkedInDeepDiagnosis({ linkedinAgent }) {
  const theme = useAppStore((s) => s.theme)
  if (!linkedinAgent?.dataAvailable) return null

  const variant = theme === 'dark' ? 'dark' : 'light'
  const issues = (linkedinAgent.issues || []).filter(Boolean)

  return (
    <section id="linkedin-ai" className="space-y-8 scroll-mt-28">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-sky-500 flex items-center"><LinkedinLogo size={20} weight="fill" /></span>
        <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">AI LinkedIn Deep Diagnosis</h2>
        <span className="flex-1 h-px bg-[var(--border-default)]" />
      </div>

      <ResumeScoreCard
        dashboard={linkedinAgent}
        variant={variant}
        title="LinkedIn Profile Score"
        scoreWord="LinkedIn profile"
      />

      {issues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <WarningCircle size={15} className="text-amber-500" /> Profile Fixes ({issues.length})
          </h3>
          {issues.map((iss, i) => (
            <div
              key={iss.id || i}
              className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-2.5 shadow-xs"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityChip[iss.severity] || severityChip.low}`}>
                  {iss.severity} · {String(iss.category || '').replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{iss.title}</span>
              </div>
              {iss.diagnosis && <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{iss.diagnosis}</p>}
              {iss.recommendation && (
                <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--primary-light)] border border-[var(--border-default)] rounded-xl p-3.5">
                  <ArrowRight size={12} className="inline mr-1.5 -mt-0.5 text-[var(--primary)]" />
                  {iss.recommendation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
