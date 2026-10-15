import React, { useState, useEffect } from 'react'
import { FileText, Sparkle, CheckCircle, WarningCircle, ArrowRight, Printer, ListChecks, ArrowLeft } from '@phosphor-icons/react'
import ResumeScoreCard from '../components/report/ResumeScoreCard.jsx'
import ResumeBulletAudit from '../components/report/ResumeBulletAudit.jsx'
import brandLogo from '../assets/images/crafture-logo.jpg'

const STORAGE_KEY = 'craftureResumeReport'

/**
 * ResumeReportPage — the full, polished, PRINT-FIRST diagnosis report.
 * Light professional theme (like competitor reports) so Print/Save-PDF
 * produces the complete, readable document.
 * Data: sessionStorage['craftureResumeReport']. Route: /resume-report
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
      <div className="min-h-screen bg-slate-100 text-slate-700 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center space-y-4">
          <img
            src={brandLogo}
            alt="Crafture"
            className="w-12 h-12 rounded-xl object-cover border border-slate-200 mx-auto shadow-sm"
          />
          <h1 className="text-lg font-bold text-slate-900">No Report Loaded</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
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
  const firstName = (snapshot.name || '').split(' ')[0]

  const analyzedAt = meta?.analyzedAt ? new Date(meta.analyzedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  const severityChip = {
    high: 'bg-red-50 border-red-200 text-red-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    low: 'bg-sky-50 border-sky-200 text-sky-700',
  }

  const SectionTitle = ({ num, icon, children, accent = 'text-indigo-500' }) => (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-mono font-bold text-slate-300 tracking-widest">{num}</span>
      <span className={`${accent} flex items-center`}>{icon}</span>
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">{children}</h2>
      <span className="flex-1 h-px bg-slate-200" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans print:bg-white">
      {/* Print styles: complete report, A4, clean page breaks, keep chip colors */}
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { background: #fff !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; }
          .print-section { break-inside: auto; }
          .print-break-before { break-before: page; page-break-before: always; }
          a { text-decoration: none; color: inherit; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-none space-y-8">
        {/* ── Report header ─────────────────────────────────────────── */}
        <header className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 print:shadow-none print:border-slate-300 print:rounded-none print:break-inside-avoid">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={brandLogo}
                alt="Crafture"
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 print:border-slate-300 shadow-sm"
              />
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-indigo-500 print:text-indigo-700">Crafture Career GPS</div>
                <div className="text-xs text-slate-400 font-medium">Resume Diagnosis Report</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print text-xs bg-slate-900 hover:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2"
            >
              <Printer size={14} weight="bold" /> Print / Save PDF
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{snapshot.name || 'Candidate'}</h1>
              <div className="text-sm text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-2">
                <span>Target: <strong className="font-semibold text-slate-800">{snapshot.targetRole || '—'}</strong></span>
                {snapshot.presentRole && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>Current: <strong className="font-semibold text-emerald-700">{snapshot.presentRole}{snapshot.presentCompany ? ` @ ${snapshot.presentCompany}` : ''}</strong></span>
                  </>
                )}
                {snapshot.pastRoles && snapshot.pastRoles.length > 0 && snapshot.pastRoles[0]?.role && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>Prev: <span className="font-medium text-slate-600">{snapshot.pastRoles[0].role}{snapshot.pastRoles[0].company ? ` @ ${snapshot.pastRoles[0].company}` : ''}</span></span>
                  </>
                )}
                {snapshot.experienceLevel && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{snapshot.experienceLevel}</span>
                  </>
                )}
              </div>
              {snapshot.primaryProfile && <p className="text-xs text-slate-400 mt-0.5">{snapshot.primaryProfile}</p>}
            </div>
            <div className="text-right text-[11px] text-slate-400 leading-relaxed">
              {analyzedAt && <div>Analyzed {analyzedAt}</div>}
              {meta?.model && <div className="font-mono text-[10px]">{meta.model}</div>}
              {dashboard?.grade && (
                <div className="mt-1 text-2xl font-extrabold text-slate-900">
                  {dashboard.score}<span className="text-sm text-slate-400 font-semibold">/100 · {dashboard.grade}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── 01 Scorecard ──────────────────────────────────────────── */}
        <section className="print-section">
          <SectionTitle num="01" icon={<ListChecks size={16} weight="bold" />}>Health Scorecard</SectionTitle>
          <ResumeScoreCard dashboard={dashboard} candidateName={firstName} variant="light" />
        </section>

        {/* ── 02 Recruiter's read ───────────────────────────────────── */}
        {analysis.overallReview && (
          <section className="print-section">
            <SectionTitle num="02" icon={<Sparkle size={16} weight="fill" />} accent="text-emerald-500">The Recruiter's Read</SectionTitle>
            <div className="print-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {typeof analysis.overallReview === 'string'
                  ? analysis.overallReview
                  : analysis.overallReview?.summary || ''}
              </div>
            </div>
          </section>
        )}

        {/* ── 03 What's working ─────────────────────────────────────── */}
        {strengths.length > 0 && (
          <section className="print-section">
            <SectionTitle num="03" icon={<CheckCircle size={16} weight="fill" />} accent="text-emerald-500">
              What's Working ({strengths.length})
            </SectionTitle>
            <div className="space-y-3">
              {strengths.map((s, i) => {
                const isObj = typeof s === 'object' && s !== null
                const title = isObj ? (s.title || 'Key Strength') : String(s || '')
                const desc = isObj ? (s.description || s.text || '') : ''
                return (
                  <div key={isObj ? s.id || i : i} className="print-card bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{title}</div>
                      {desc && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 04 Line-by-line audit ─────────────────────────────────── */}
        {dashboard?.bulletAudit?.length > 0 && (
          <section className={`print-section ${issues.length > 3 ? 'print-break-before' : ''}`}>
            <SectionTitle num="04" icon={<FileText size={16} weight="bold" />}>Line-by-Line Audit</SectionTitle>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <ResumeBulletAudit bulletAudit={dashboard.bulletAudit} variant="light" />
            </div>
          </section>
        )}

        {/* ── 05 Deep diagnosis ─────────────────────────────────────── */}
        {issues.length > 0 && (
          <section className="print-section print-break-before">
            <SectionTitle num="05" icon={<WarningCircle size={16} weight="fill" />} accent="text-amber-500">
              Deep Diagnosis ({issues.length})
            </SectionTitle>
            <div className="space-y-4">
              {issues.map((iss, i) => {
                const ev = Array.isArray(iss.evidence) ? iss.evidence[0] : iss.evidence
                const qs = Array.isArray(iss.metricDiscoveryQuestions) ? iss.metricDiscoveryQuestions : []
                return (
                  <div key={iss.id || i} className="print-card bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityChip[iss.severity] || severityChip.low}`}>
                        {iss.severity} · {String(iss.category || '').replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{iss.title}</span>
                    </div>
                    {iss.diagnosis && <p className="text-xs text-slate-600 leading-relaxed">{iss.diagnosis}</p>}
                    {iss.whyItMatters && (
                      <p className="text-xs text-slate-500 leading-relaxed">
                        <span className="font-bold uppercase text-[10px] text-slate-400">Why it matters — </span>
                        {iss.whyItMatters}
                      </p>
                    )}
                    {iss.recommendation && (
                      <p className="text-xs text-indigo-900 leading-relaxed bg-indigo-50 border border-indigo-100 rounded-xl p-3.5">
                        <ArrowRight size={12} className="inline mr-1.5 -mt-0.5 text-indigo-500" />
                        {iss.recommendation}
                      </p>
                    )}
                    {qs.length > 0 && (
                      <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5">
                        <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">
                          Go find your real numbers:
                        </div>
                        <ul className="space-y-1">
                          {qs.map((q, qi) => (
                            <li key={qi} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                              <span className="text-amber-500 font-bold">?</span> {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ev?.originalText && (
                      <div className="text-[11px] text-slate-400 italic border-l-2 border-slate-200 pl-3 leading-relaxed">
                        &ldquo;{ev.originalText}&rdquo;
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 06 Action plan ────────────────────────────────────────── */}
        {priorityActions.length > 0 && (
          <section className="print-section print-break-before">
            <SectionTitle num="06" icon={<ListChecks size={16} weight="bold" />}>Do These First</SectionTitle>
            <div className="print-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              {priorityActions.map((pa, i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {pa.priority || i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">{pa.title}</div>
                    {pa.action && <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{pa.action}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="pt-4 pb-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 print:mt-6">
          <span>Crafture Resume Agent · Deterministic scorecard + expert synthesis</span>
          <span>Not an ATS prediction · {analyzedAt}</span>
        </footer>

        <div className="no-print text-center pb-4">
          <a href="/test-lab" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
            <ArrowLeft size={12} /> Back to Test Lab
          </a>
        </div>
      </div>
    </div>
  )
}
