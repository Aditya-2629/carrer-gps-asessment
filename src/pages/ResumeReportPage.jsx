import React, { useState, useEffect } from 'react'
import {
  FileText,
  Sparkle,
  CheckCircle,
  WarningCircle,
  ArrowRight,
  Printer,
  User,
  ListChecks,
} from '@phosphor-icons/react'
import ResumeScoreCard from '../components/report/ResumeScoreCard.jsx'
import ResumeBulletAudit from '../components/report/ResumeBulletAudit.jsx'

const STORAGE_KEY = 'craftureResumeReport'

/**
 * ResumeReportPage — the full, polished diagnosis report.
 * Data source: sessionStorage['craftureResumeReport'] (set by the Test Lab
 * "Open Full Report" action, or any future caller that POSTs an evaluate run).
 * Route: /resume-report
 */
export default function ResumeReportPage() {
  const [payload, setPayload] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setPayload(JSON.parse(raw))
    } catch (_e) {
      setPayload(null)
    }
    setLoaded(true)
  }, [])

  if (!loaded) return null

  if (!payload?.analysis) {
    return (
      <div className="min-h-screen bg-[#070b14] text-gray-200 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#0f172a] border border-gray-800 rounded-3xl p-8 text-center space-y-4">
          <FileText size={36} className="text-indigo-400 mx-auto" />
          <h1 className="text-lg font-bold text-white">No Report Loaded</h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            Run a resume analysis in the Test Lab and click &ldquo;Open Full Report&rdquo; to view the polished
            diagnosis report here.
          </p>
          <a
            href="/test-lab"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl"
          >
            Go to Test Lab →
          </a>
        </div>
      </div>
    )
  }

  const { analysis, meta } = payload
  const dashboard = analysis.dashboard
  const snapshot = analysis.candidateSnapshot || {}
  const strengths = (analysis.strengths || []).filter(Boolean)
  const issues = (analysis.issues || []).filter(Boolean)
  const priorityActions = (analysis.priorityActions || []).filter(Boolean)

  const severityStyles = {
    high: 'bg-red-950/80 border-red-700/60 text-red-300',
    medium: 'bg-amber-950/80 border-amber-700/60 text-amber-300',
    low: 'bg-sky-950/80 border-sky-700/60 text-sky-300',
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-[#e2e8f0] p-4 sm:p-8 font-sans print:bg-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 pb-5 print:border-gray-300">
          <div>
            <div className="text-[11px] uppercase tracking-widest font-mono text-indigo-400 font-bold mb-1.5">
              Crafture Resume Diagnosis Report
            </div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5 print:text-black">
              <User size={24} className="text-indigo-400" />
              {snapshot.name || 'Candidate'}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Target: <span className="text-gray-200 font-semibold">{snapshot.targetRole || '—'}</span>
              {snapshot.experienceLevel && <> · {snapshot.experienceLevel}</>}
              {snapshot.primaryProfile && <> · {snapshot.primaryProfile}</>}
            </p>
            {meta?.model && (
              <p className="text-[10px] font-mono text-gray-600 mt-1.5">
                Analyzed {meta.analyzedAt || 'recently'} · {meta.model} · {analysis.analysisVersion || '2.2'} contract
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="text-xs bg-gray-900 hover:bg-gray-800 border border-gray-800 px-3.5 py-2 rounded-lg text-gray-300 font-medium print:hidden"
          >
            <Printer size={14} className="inline mr-1.5 -mt-0.5" /> Print / Save PDF
          </button>
        </div>

        {/* Scorecard */}
        <ResumeScoreCard dashboard={dashboard} candidateName={snapshot.name} />

        {/* Overall review */}
        {analysis.overallReview && (
          <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-6 shadow-xl print:bg-white print:border-gray-300">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Sparkle size={16} weight="fill" /> The Recruiter's Read
            </h3>
            <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-line print:text-black">
              {typeof analysis.overallReview === 'string'
                ? analysis.overallReview
                : analysis.overallReview?.summary || ''}
            </div>
          </div>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-400" /> What's Working ({strengths.length})
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {strengths.map((s, i) => (
                <div key={s.id || i} className="bg-[#0f172a] border border-emerald-900/40 rounded-2xl p-5 print:bg-white print:border-gray-300">
                  <div className="text-sm font-bold text-white flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center text-xs font-mono shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {s.title}
                  </div>
                  <p className="text-xs text-gray-300 mt-2 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bullet audit */}
        {dashboard?.bulletAudit && <ResumeBulletAudit bulletAudit={dashboard.bulletAudit} />}

        {/* Issues */}
        {issues.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <WarningCircle size={16} className="text-amber-400" /> Deep Diagnosis ({issues.length})
            </h3>
            {issues.map((iss, i) => {
              const ev = Array.isArray(iss.evidence) ? iss.evidence[0] : iss.evidence
              const qs = Array.isArray(iss.metricDiscoveryQuestions) ? iss.metricDiscoveryQuestions : []
              return (
                <div key={iss.id || i} className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 space-y-3 shadow-xl print:bg-white print:border-gray-300">
                  <div className="flex flex-wrap items-center gap-2 border-b border-gray-800/80 pb-3 print:border-gray-200">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityStyles[iss.severity] || severityStyles.low}`}>
                      {iss.severity}
                    </span>
                    <span className="text-xs font-bold text-white">{iss.title}</span>
                  </div>
                  {iss.diagnosis && <p className="text-xs text-gray-300 leading-relaxed">{iss.diagnosis}</p>}
                  {iss.whyItMatters && (
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <span className="text-gray-500 font-bold uppercase text-[10px]">Why it matters: </span>
                      {iss.whyItMatters}
                    </p>
                  )}
                  {iss.recommendation && (
                    <p className="text-xs text-indigo-200 leading-relaxed bg-indigo-950/30 border border-indigo-900/50 rounded-xl p-3">
                      <ArrowRight size={12} className="inline mr-1 -mt-0.5 text-indigo-400" />
                      {iss.recommendation}
                    </p>
                  )}
                  {qs.length > 0 && (
                    <div className="bg-[#070b14] border border-gray-800 rounded-xl p-3">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                        Go find your real numbers:
                      </div>
                      <ul className="space-y-1">
                        {qs.map((q, qi) => (
                          <li key={qi} className="text-[11px] text-gray-300 flex items-start gap-1.5">
                            <span className="text-amber-500">?</span> {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {ev?.originalText && (
                    <div className="text-[11px] text-gray-500 italic font-mono border-l-2 border-gray-700 pl-3">
                      &ldquo;{ev.originalText}&rdquo;
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Priority actions */}
        {priorityActions.length > 0 && (
          <div className="bg-[#0f172a] border border-indigo-900/50 rounded-2xl p-6 shadow-xl print:bg-white print:border-gray-300">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <ListChecks size={16} /> Do These First
            </h3>
            <div className="space-y-3">
              {priorityActions.map((pa, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {pa.priority || i + 1}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white">{pa.title}</div>
                    {pa.action && <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{pa.action}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-600 pb-4">
          Generated by Crafture Resume Agent · Deterministic scorecard + expert synthesis · Not an ATS prediction
        </p>
      </div>
    </div>
  )
}
