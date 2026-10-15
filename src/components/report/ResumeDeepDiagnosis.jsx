import React from 'react'
import {
  Sparkle,
  ListChecks,
  WarningCircle,
  ArrowRight,
  CheckCircle,
  ArrowSquareOut,
  User,
  ShieldCheck,
} from '@phosphor-icons/react'
import ResumeScoreCard from './ResumeScoreCard.jsx'
import ResumeBulletAudit from './ResumeBulletAudit.jsx'
import FeedbackThumbs from './FeedbackThumbs.jsx'
import useAppStore from '../../store/useAppStore'

/**
 * ResumeDeepDiagnosis — the Resume Specialist Agent's section inside the MAIN
 * Career GPS report.
 *
 * Renders:
 * - Deterministic Scorecard (0-100, letter grades, ATS checklist)
 * - Candidate profile snapshot & recruiter summary
 * - Verified Strengths ("What's Working")
 * - Line-by-line bullet audits with interactive dropdowns & rewrites
 * - Deep Diagnosis issues with severity tags and discovery questions
 * - Priority Actions ("Do These First")
 * - Direct link to open the print-first dedicated report (/resume-report)
 */

const severityChip = {
  high: 'bg-red-950/80 border-red-700/60 text-red-300',
  medium: 'bg-amber-950/80 border-amber-700/60 text-amber-300',
  low: 'bg-sky-950/80 border-sky-700/60 text-sky-300',
}

function SectionHeader({ icon, title, accent, onOpenReport }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-[var(--border-default)] pb-4">
      <div className="flex items-center gap-3">
        <span className={accent}>{icon}</span>
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">{title}</h2>
          <p className="text-xs text-[var(--text-muted)]">
            AI recruiter audit of your resume structure, impact metrics, and ATS compatibility.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenReport}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          title="Open the clean, print-ready standalone PDF diagnosis in a new window"
        >
          <span>Print / Full PDF Report</span>
          <ArrowSquareOut size={13} weight="bold" />
        </button>
      </div>
    </div>
  )
}

export default function ResumeDeepDiagnosis({ resumeAgent }) {
  const theme = useAppStore((s) => s.theme)
  if (!resumeAgent?.dashboard && !resumeAgent?.issues?.length) return null

  const dashboard = resumeAgent.dashboard
  const issues = (resumeAgent.issues || []).filter(Boolean)
  const priorityActions = (resumeAgent.priorityActions || []).filter(Boolean)
  const strengths = (resumeAgent.strengths || []).filter(Boolean)
  const snapshot = resumeAgent.candidateSnapshot || {}
  const firstName = (snapshot.name || '').split(' ')[0]
  const variant = theme === 'dark' ? 'dark' : 'light'

  const handleOpenPrintReport = () => {
    try {
      sessionStorage.setItem(
        'craftureResumeReport',
        JSON.stringify({
          analysis: resumeAgent,
          meta: {
            analyzedAt: new Date().toISOString(),
          },
        })
      )
    } catch (_e) {}
    window.open('/resume-report', '_blank')
  }

  return (
    <section id="resume-ai" className="space-y-8 scroll-mt-28 print:space-y-6">
      <SectionHeader
        icon={<Sparkle size={22} weight="fill" className="text-indigo-400" />}
        title="AI Resume Deep Diagnosis & Rewrites"
        accent="text-indigo-400"
        onOpenReport={handleOpenPrintReport}
      />

      {/* Candidate Snapshot Meta Bar */}
      {(snapshot.name || snapshot.targetRole || snapshot.presentRole) && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-strong)] flex items-center justify-center text-[var(--primary)] border border-[var(--border-default)]">
              <User size={16} weight="bold" />
            </div>
            <div className="flex flex-wrap items-center gap-y-1">
              <span className="font-bold text-[var(--text-primary)]">{snapshot.name || 'Candidate'}</span>
              {snapshot.targetRole && (
                <span className="text-[var(--text-muted)] ml-2">· Target: <strong className="text-[var(--text-secondary)]">{snapshot.targetRole}</strong></span>
              )}
              {snapshot.presentRole && (
                <span className="text-[var(--text-muted)] ml-2">· Current: <strong className="text-emerald-600 dark:text-emerald-400">{snapshot.presentRole}{snapshot.presentCompany ? ` @ ${snapshot.presentCompany}` : ''}</strong></span>
              )}
              {snapshot.pastRoles && snapshot.pastRoles.length > 0 && snapshot.pastRoles[0]?.role && (
                <span className="text-[var(--text-muted)] ml-2">· Prev: <span className="text-[var(--text-secondary)]">{snapshot.pastRoles[0].role}{snapshot.pastRoles[0].company ? ` @ ${snapshot.pastRoles[0].company}` : ''}</span></span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {snapshot.linkedinUrl && (
              <a
                href={snapshot.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-full bg-[#0a66c2]/10 text-[#0a66c2] border border-[#0a66c2]/30 text-[10px] font-bold flex items-center gap-1 hover:underline"
              >
                LinkedIn Profile
              </a>
            )}
            {snapshot.experienceLevel && (
              <span className="px-2.5 py-1 rounded-full bg-[var(--surface-strong)] border border-[var(--border-default)] font-mono text-[10px] text-[var(--text-secondary)] font-semibold">
                {snapshot.experienceLevel}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
              <ShieldCheck size={12} weight="fill" />
              Recruiter-Verified
            </span>
          </div>
        </div>
      )}

      {/* Scorecard */}
      {dashboard && (
        <ResumeScoreCard dashboard={dashboard} candidateName={firstName} variant={variant} />
      )}

      {/* Two Column Grid: Recruiter's Read & What's Working */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overall review */}
        {(resumeAgent.overallReview?.summary || typeof resumeAgent.overallReview === 'string') && (
          <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Sparkle size={15} weight="fill" /> The Recruiter's Read
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                {typeof resumeAgent.overallReview === 'string'
                  ? resumeAgent.overallReview
                  : resumeAgent.overallReview?.summary}
              </p>
            </div>
          </div>
        )}

        {/* What's Working Strengths */}
        {strengths.length > 0 && (
          <div className="bg-[var(--surface-card)] border border-emerald-500/30 rounded-2xl p-6 space-y-3">
            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle size={16} weight="fill" /> What's Working on Your Resume ({strengths.length})
            </h3>
            <ul className="space-y-3">
              {strengths.map((str, i) => {
                const isObj = typeof str === 'object' && str !== null
                const title = isObj ? str.title : null
                const desc = isObj ? (str.description || str.text || '') : String(str || '')

                return (
                  <li key={isObj ? str.id || i : i} className="text-xs text-[var(--text-secondary)] flex items-start gap-2.5 leading-relaxed">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                    <div className="min-w-0">
                      {title && (
                        <strong className="font-semibold text-[var(--text-primary)] mr-1.5">
                          {title}{desc ? ' —' : ''}
                        </strong>
                      )}
                      <span>{desc || title}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Line-by-line bullet audit with interactive experience dropdowns */}
      {dashboard?.bulletAudit?.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6">
          <ResumeBulletAudit bulletAudit={dashboard.bulletAudit} variant={variant} />
        </div>
      )}

      {/* Deep issues */}
      {issues.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
              <WarningCircle size={15} className="text-amber-400" /> Deep ATS & Recruiter Diagnosis ({issues.length} Issues)
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {issues.map((iss, i) => {
              const qs = Array.isArray(iss.metricDiscoveryQuestions) ? iss.metricDiscoveryQuestions : []
              return (
                <div
                  key={iss.id || i}
                  className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityChip[iss.severity] || severityChip.low}`}>
                      {iss.severity} · {String(iss.category || '').replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{iss.title}</span>
                    <span className="ml-auto">
                      <FeedbackThumbs agent="resume" findingId={iss.id || `issue_${i}`} />
                    </span>
                  </div>

                  {iss.diagnosis && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {iss.diagnosis}
                    </p>
                  )}

                  {iss.recommendation && (
                    <div className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--primary-light)] border border-[var(--border-default)] rounded-xl p-3.5">
                      <div className="text-[10px] uppercase font-bold text-[var(--primary)] tracking-wider mb-1 flex items-center gap-1">
                        <ArrowRight size={12} /> Recommended Fix
                      </div>
                      <p>{iss.recommendation}</p>
                    </div>
                  )}

                  {qs.length > 0 && (
                    <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-3.5">
                      <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">
                        Clarifying Questions to Uncover Measurable Numbers:
                      </div>
                      <ul className="space-y-1">
                        {qs.map((q, qi) => {
                          const questionText = typeof q === 'string' ? q : (q?.question || q?.text || String(q || ''))
                          return (
                            <li key={qi} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                              <span className="text-amber-500 font-bold">?</span> {questionText}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Priority actions */}
      {priorityActions.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-6">
          <h3 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-2 mb-4">
            <ListChecks size={15} /> Priority Action Items — Do These First
          </h3>
          <div className="space-y-3">
            {priorityActions.map((pa, i) => {
              const isObj = typeof pa === 'object' && pa !== null
              const title = isObj ? pa.title : String(pa || '')
              const action = isObj
                ? (typeof pa.action === 'string' ? pa.action : (pa.action?.description || pa.action?.text || ''))
                : ''
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-base)] border border-[var(--border-default)]">
                  <span className="w-6 h-6 rounded-lg bg-[var(--primary-light)] border border-[var(--border-default)] text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {isObj ? pa.priority || i + 1 : i + 1}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{title}</div>
                    {action && (
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                        {action}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
