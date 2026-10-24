import React, { useState, useEffect } from 'react'
import { FileText, Sparkle, CheckCircle, Printer, ListChecks, ArrowLeft, Target, Briefcase } from '@phosphor-icons/react'
import ResumeScoreCard from '../components/report/ResumeScoreCard.jsx'
import ResumeKeywordAlignment from '../components/report/ResumeKeywordAlignment.jsx'
import ResumeBulletAudit from '../components/report/ResumeBulletAudit.jsx'
import brandLogo from '../assets/images/crafture-logo.jpg'

const STORAGE_KEY = 'craftureResumeReport'

/**
 * ResumeReportPage — Competitor-Grade Executive Resume Diagnosis Report.
 *
 * Designed for both instant on-screen scanning and print-perfect PDF export
 * (Zero blank pages, zero clipped scrollbars, zero redundant filler).
 *
 * Data source: sessionStorage['craftureResumeReport']. Route: /resume-report
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

  const handlePrint = () => {
    window.print()
  }

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
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all shadow-xs"
          >
            Go to Test Lab →
          </a>
        </div>
      </div>
    )
  }

  const { analysis, meta } = payload
  const dashboard = analysis.dashboard
  const keywordAlignment = dashboard?.keywordAlignment || analysis.keywordAlignment || null
  const snapshot = analysis.candidateSnapshot || {}
  const strengths = (analysis.strengths || []).filter(Boolean)
  const issues = (analysis.issues || []).filter(Boolean)
  const priorityActions = (analysis.priorityActions || []).filter(Boolean)
  const firstName = (snapshot.name || '').split(' ')[0]

  const analyzedAt = meta?.analyzedAt
    ? new Date(meta.analyzedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const SectionTitle = ({ num, icon, children, accent = 'text-indigo-500' }) => (
    <div className="section-header flex items-center gap-3 mb-3.5 print:mb-2.5">
      <span className="text-[10px] font-mono font-bold text-slate-400 tracking-widest">{num}</span>
      <span className={`${accent} flex items-center`}>{icon}</span>
      <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-600">{children}</h2>
      <span className="flex-1 h-px bg-slate-200" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans print:bg-white">
      {/* Bulletproof Print / PDF Engine Styles */}
      <style>{`
        @page {
          size: letter portrait;
          margin: 12mm 14mm;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 10.5pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          button,
          .filter-tabs,
          .collapse-toggle,
          .experience-dropdown-chevron,
          .experience-dropdown-controls {
            display: none !important;
          }
          /* Never allow scrollbars or clipped containers in print */
          * {
            overflow: visible !important;
            max-height: none !important;
          }
          /* Force expand all accordions in print */
          .experience-dropdown-content,
          .accordion-content {
            display: block !important;
            max-height: none !important;
            opacity: 1 !important;
            visibility: visible !important;
          }
          /* Allow large sections and experience groups to flow across pages naturally */
          .report-container,
          .report-section,
          .print-section,
          .experience-group,
          .experience-bullets-list,
          .scorecard-section {
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-bottom: 14px !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-color: #cbd5e1 !important;
          }
          /* Keep section & company headers attached to their first item */
          h1, h2, h3, .section-header, .experience-group-header, .section-title {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
          /* Prevent individual small leaf cards from splitting mid-sentence */
          .bullet-card,
          .strength-card,
          .keyword-bucket,
          .keyword-row-group,
          .checklist-item,
          .print-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 8px !important;
            box-shadow: none !important;
            border-color: #cbd5e1 !important;
          }
          a {
            text-decoration: none !important;
            color: inherit !important;
          }
        }
      `}</style>

      <div className="report-container max-w-4xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-none space-y-6 print:space-y-4">
        {/* ── Top Hero Banner (Clean 2-Column, No Clutter, No Raw Model Identifiers) ── */}
        <header className="print-card bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-7 print:shadow-none print:border-slate-300 print:rounded-none">
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <img
                src={brandLogo}
                alt="Crafture"
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 print:border-slate-300 shadow-2xs"
              />
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-indigo-600 print:text-indigo-800">
                  Crafture Career GPS
                </div>
                <div className="text-xs text-slate-500 font-medium">Executive Resume Diagnosis</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="no-print text-xs bg-slate-900 hover:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Printer size={15} weight="bold" /> Print / Save PDF
              </button>
            </div>
          </div>

          {/* Clean 2-Column Hero Details */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            {/* Left Column: Candidate Name, Target Role Pill, Timeline */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {snapshot.name || 'Candidate'}
              </h1>

              {snapshot.targetRole && (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                    <Target size={13} weight="bold" />
                    Target Role: {snapshot.targetRole}
                  </span>
                </div>
              )}

              {/* Compact Role Timeline Row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                {snapshot.presentRole && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase size={13} className="text-slate-400" />
                    <span className="text-slate-400 font-medium">Current:</span>
                    <strong className="font-semibold text-slate-800">
                      {snapshot.presentRole}
                      {snapshot.presentCompany ? ` @ ${snapshot.presentCompany}` : ''}
                    </strong>
                  </span>
                )}
                {snapshot.pastRoles && snapshot.pastRoles.length > 0 && snapshot.pastRoles[0]?.role && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-400 font-medium">Previous:</span>
                      <strong className="font-semibold text-slate-700">
                        {snapshot.pastRoles[0].role}
                        {snapshot.pastRoles[0].company ? ` @ ${snapshot.pastRoles[0].company}` : ''}
                      </strong>
                    </span>
                  </>
                )}
                {snapshot.experienceLevel && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500 font-medium">{snapshot.experienceLevel}</span>
                  </>
                )}
              </div>
            </div>

            {/* Right Column: Score, Grade, Analyzed Date */}
            <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-1.5 shrink-0">
              {dashboard?.score !== undefined && (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {dashboard.score}
                  </span>
                  <span className="text-sm font-bold text-slate-400">/ 100</span>
                  {dashboard.grade && (
                    <span className="ml-1 px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-slate-900 text-white">
                      Grade {dashboard.grade}
                    </span>
                  )}
                </div>
              )}
              <div className="text-[11px] text-slate-400">
                Analyzed {analyzedAt}
              </div>
            </div>
          </div>
        </header>

        {/* ── 01 Health Scorecard ────────────────────────────────────── */}
        <section className="print-section">
          <SectionTitle num="01" icon={<ListChecks size={16} weight="bold" />}>
            Health Scorecard
          </SectionTitle>
          <ResumeScoreCard dashboard={dashboard} candidateName={firstName} variant="light" />
        </section>

        {/* ── Top 3 Priority Fixes Callout Box (Do These First) ───────── */}
        {priorityActions.length > 0 && (
          <section className="print-section">
            <div className="print-card bg-amber-50/70 border border-amber-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0">
                    ⚡
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                    Top 3 Priority Fixes (Do These First)
                  </h3>
                </div>
                <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
                  Immediate Impact
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {priorityActions.slice(0, 3).map((pa, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-amber-200/80 rounded-xl p-3.5 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-black shrink-0">
                        {pa.priority || idx + 1}
                      </span>
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {pa.title}
                      </div>
                    </div>
                    {pa.action && (
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {typeof pa.action === 'string'
                          ? pa.action
                          : pa.action?.description || pa.action?.text || ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 02 Keyword & JD Alignment (Horizontal Rows, Zero Scrollbars) ── */}
        {keywordAlignment && (
          <section className="print-section">
            <SectionTitle num="02" icon={<Target size={16} weight="bold" />}>
              Keyword & JD Alignment
            </SectionTitle>
            <ResumeKeywordAlignment keywordAlignment={keywordAlignment} variant="light" />
          </section>
        )}

        {/* ── 03 The Recruiter's Read ───────────────────────────────── */}
        {analysis.overallReview && (
          <section className="print-section">
            <SectionTitle num={keywordAlignment ? '03' : '02'} icon={<Sparkle size={16} weight="fill" />} accent="text-emerald-500">
              The Recruiter's Read
            </SectionTitle>
            <div className="print-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {typeof analysis.overallReview === 'string'
                  ? analysis.overallReview
                  : analysis.overallReview?.summary || ''}
              </div>
            </div>
          </section>
        )}

        {/* ── 04 What's Working ─────────────────────────────────────── */}
        {strengths.length > 0 && (
          <section className="print-section">
            <SectionTitle num={keywordAlignment ? '04' : '03'} icon={<CheckCircle size={16} weight="fill" />} accent="text-emerald-500">
              What's Working ({strengths.length})
            </SectionTitle>
            <div className="space-y-2.5">
              {strengths.map((s, i) => {
                const isObj = typeof s === 'object' && s !== null
                const title = isObj ? (s.title || 'Key Strength') : String(s || '')
                const desc = isObj ? (s.description || s.text || '') : ''
                return (
                  <div
                    key={isObj ? s.id || i : i}
                    className="strength-card print-card bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-start gap-3"
                  >
                    <span className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      ✓
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900">{title}</div>
                      {desc && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 05 Line-by-Line Audit (Unified: Diagnostics + Rewrites + Filter Tabs) ── */}
        {dashboard?.bulletAudit?.length > 0 && (
          <section className="print-section">
            <SectionTitle num={keywordAlignment ? '05' : '04'} icon={<FileText size={16} weight="bold" />}>
              Line-by-Line Audit
            </SectionTitle>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 print:p-0 print:border-none print:shadow-none">
              <ResumeBulletAudit
                bulletAudit={dashboard.bulletAudit}
                issues={issues}
                variant="light"
              />
            </div>
          </section>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="pt-4 pb-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 print:mt-4">
          <span>Crafture Career GPS · Deterministic Scorecard & Strategic Recruiter Diagnosis</span>
          <span>Verified against ATS parsing & hiring team standards · {analyzedAt}</span>
        </footer>

        <div className="no-print text-center pb-4">
          <a
            href="/test-lab"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium"
          >
            <ArrowLeft size={12} /> Back to Test Lab
          </a>
        </div>
      </div>
    </div>
  )
}
