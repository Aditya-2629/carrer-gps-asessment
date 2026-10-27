import { useEffect, useState } from 'react'
import useAppStore, { VALID_FORM_KEYS } from '../store/useAppStore'
import {
  FileText,
  Printer,
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  XCircle,
  ShieldCheck,
  Target,
  Sparkle,
  TrendUp,
  Briefcase,
  GraduationCap,
} from '@phosphor-icons/react'

export default function FullCareerReportPage() {
  const [report, setReport] = useState(() => {
    try {
      const stored = sessionStorage.getItem('craftureFullReport')
      if (stored) return JSON.parse(stored)
    } catch (_e) {}
    return null
  })

  const storeReportData = useAppStore((s) => s.reportData)

  useEffect(() => {
    if (!report && storeReportData) {
      setReport(storeReportData)
    }
  }, [report, storeReportData])

  useEffect(() => {
    // Check if ?print=true is in URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('print') === 'true' && report) {
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [report])

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
        <h2 className="text-xl font-bold mb-2">No Report Found in Session</h2>
        <p className="text-sm text-slate-500 mb-4">Please generate or open a report from your dashboard first.</p>
        <button
          onClick={() => (window.location.href = '/')}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  const resumeAgent = report.resume_agent || null
  const linkedinAgent = report.linkedin_agent || null
  const candidateName =
    resumeAgent?.candidateSnapshot?.name ||
    report.user_answers?.fullName ||
    report.user_answers?.name ||
    'Candidate'
  const targetRole =
    resumeAgent?.candidateSnapshot?.targetRole ||
    report.user_answers?.targetRole ||
    report.user_answers?.target_role ||
    'Senior Software Engineer'

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans p-4 sm:p-8 print:p-0">
      {/* Non-printed Floating Controls */}
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 shadow-sm"
        >
          <ArrowLeft size={14} weight="bold" />
          <span>Back to Interactive Dashboard</span>
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-md"
        >
          <Printer size={16} weight="bold" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Main Standardized Printable Sheet */}
      <div className="max-w-5xl mx-auto bg-white border border-slate-200 print:border-none shadow-xl print:shadow-none p-8 sm:p-12 print:p-0 rounded-xl print:rounded-none">
        {/* Document Header */}
        <div className="bg-slate-900 text-white p-6 rounded-lg mb-8 print:rounded-none">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
                <ShieldCheck size={16} weight="fill" />
                <span>Crafture Career GPS • Executive Intelligence Report</span>
              </div>
              <h1 className="text-2xl font-bold">{candidateName}</h1>
              <p className="text-sm text-slate-300 mt-0.5">
                Target Role: <span className="font-semibold text-white">{targetRole}</span> • Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-lg text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Career GPS Score</span>
              <span className="text-2xl font-extrabold text-emerald-400">
                {report.career_health_score ?? report.gps_score ?? 65}/100
              </span>
              <span className="text-xs text-slate-300 block font-medium">
                {report.phase?.name ? `Phase ${report.phase.id}: ${report.phase.name}` : (report.score_label ?? 'Competitive')}
              </span>
              {report.phase?.isProvisional && (
                <span className="inline-block mt-1 text-[10px] font-bold text-amber-300 bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-500/40">
                  Provisional Diagnosis
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 1. 6-Area Weighted Scorecard */}
        <section className="mb-8 break-inside-avoid">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Target size={18} className="text-emerald-600" weight="bold" />
              <span>1. 6-Dimension Career Health Snapshot (100-Point Rubric)</span>
            </h2>
            {report.phase && (
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Detected: Phase {report.phase.id} ({report.phase.confidence || 'Active'} Confidence)
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Resume</span>
              <span className="text-lg font-bold text-slate-900">
                {report.scores?.resume?.score ?? 18}/25
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">Grade: {report.scores?.resume?.grade || 'B'}</span>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">LinkedIn</span>
              <span className="text-lg font-bold text-slate-900">
                {report.scores?.linkedin?.score ?? 10}/15
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">Grade: {report.scores?.linkedin?.grade || 'B'}</span>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Job Search</span>
              <span className="text-lg font-bold text-slate-900">
                {report.scores?.jobSearch?.score ?? 14}/20
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">Grade: {report.scores?.jobSearch?.grade || 'B'}</span>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Networking</span>
              <span className="text-lg font-bold text-slate-900">
                {report.scores?.networking?.score ?? 8}/15
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">Grade: {report.scores?.networking?.grade || 'C'}</span>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Hiring Funnel</span>
              <span className="text-lg font-bold text-slate-900">
                {report.scores?.hiringFunnel?.score ?? 12}/20
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">Grade: {report.scores?.hiringFunnel?.grade || 'C'}</span>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Readiness</span>
              <span className="text-lg font-bold text-slate-900">
                {report.scores?.careerReadiness?.score ?? 4}/5
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">Grade: {report.scores?.careerReadiness?.grade || 'A'}</span>
            </div>
          </div>

          {/* Primary Bottleneck */}
          <div className="border border-amber-300 bg-amber-50/70 p-4 rounded-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
              Primary Bottleneck: {report.primary_bottleneck?.title || report.critical_issues?.[0]?.title || 'Positioning Alignment'}
            </h3>
            <p className="text-xs text-amber-950 leading-relaxed">
              {report.primary_bottleneck?.diagnosis || report.critical_issues?.[0]?.diagnosis || 'Candidate applications are dropping before technical screening.'}
            </p>
          </div>
        </section>

        {/* 2. Top Priorities & 90-Day Execution Roadmap */}
        <section className="mb-8 break-inside-avoid">
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <Sparkle size={18} className="text-emerald-600" weight="bold" />
            <span>2. Top Priorities & 90-Day Roadmap</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {(report.critical_issues || []).slice(0, 3).map((item, idx) => (
              <div key={idx} className="border border-slate-200 bg-slate-50 p-4 rounded-lg">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block mb-1">
                  Priority #{idx + 1} ({item.severity || 'HIGH'})
                </span>
                <h4 className="text-xs font-bold text-slate-900 mb-1">{item.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">{item.diagnosis}</p>
                {item.action_steps?.[0] && (
                  <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                    Fix: {item.action_steps[0]}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Roadmap Weeks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(report.roadmap || []).slice(0, 3).map((phase, idx) => (
              <div key={idx} className="border border-slate-200 bg-white p-4 rounded-lg">
                <span className="text-xs font-bold text-emerald-700 uppercase block mb-1">
                  Phase {idx + 1} ({phase.week || `Month ${idx + 1}`})
                </span>
                <h5 className="text-xs font-bold text-slate-900 mb-2">{phase.theme || phase.goal}</h5>
                <ul className="text-xs text-slate-600 space-y-1">
                  {(phase.tasks || []).slice(0, 3).map((t, tIdx) => (
                    <li key={tIdx} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{typeof t === 'string' ? t : t.task || t.action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Resume Deep Diagnosis & Line-by-Line Rewrites */}
        <section className="mb-8 break-inside-avoid">
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <FileText size={18} className="text-emerald-600" weight="bold" />
            <span>3. AI Resume Deep Diagnosis & Line-by-Line Rewrites</span>
          </h2>
          {Boolean(typeof resumeAgent?.overallReview === 'string' ? resumeAgent.overallReview : (resumeAgent?.overallReview?.summary || resumeAgent?.overallReview?.text)) && (
            <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 leading-relaxed">
              {typeof resumeAgent.overallReview === 'string' ? resumeAgent.overallReview : (resumeAgent.overallReview.summary || resumeAgent.overallReview.text)}
            </p>
          )}

          {/* Expanded Bullet Rewrites */}
          <div className="space-y-3">
            {(resumeAgent?.bulletAudit || []).filter((b) => b.needsRewrite || b.rewrittenText).slice(0, 6).map((b, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-200 rounded-lg p-3 bg-white">
                <div className="bg-red-50/60 border border-red-200 p-3 rounded">
                  <span className="text-[10px] font-bold text-red-700 uppercase block mb-1">
                    Original Bullet ({b.company || 'Experience'})
                  </span>
                  <p className="text-xs text-red-950 leading-relaxed">{b.originalText}</p>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
                    Recruiter STAR/XYZ Rewrite
                  </span>
                  <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                    {b.rewrittenText || b.originalText}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. LinkedIn Deep Diagnosis & Cross-Channel Discrepancies */}
        <section className="mb-8 break-inside-avoid">
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <Briefcase size={18} className="text-emerald-600" weight="bold" />
            <span>4. LinkedIn All-Star Audit & Cross-Channel Discrepancies</span>
          </h2>
          <div className="space-y-2 mb-4">
            {(linkedinAgent?.discrepancies || []).slice(0, 5).map((d, idx) => (
              <div key={idx} className="border border-slate-200 bg-slate-50 p-3 rounded-lg flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${d.severity === 'high' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                    {d.severity || 'Medium'} Severity
                  </span>
                  <span className="text-xs font-bold text-slate-900">{d.title}</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  <strong>Resume:</strong> {d.resumeClaim || 'N/A'} • <strong>LinkedIn:</strong> {d.linkedinClaim || 'N/A'}
                </div>
                <div className="text-xs text-emerald-800 font-medium mt-1">
                  <strong>Recommended Action:</strong> {d.recommendation || d.fix}
                </div>
              </div>
            ))}
          </div>

          {/* Headline & About Rewrite Preview */}
          {linkedinAgent?.optimizations?.headlines?.[0] && (
            <div className="border border-slate-200 bg-sky-50/50 p-4 rounded-lg mb-3">
              <span className="text-[10px] font-bold text-sky-800 uppercase block mb-1">Search-Optimized 220-Char Headline</span>
              <p className="text-xs font-bold text-slate-900">
                {linkedinAgent.optimizations.headlines[0].headline || linkedinAgent.optimizations.headlines[0]}
              </p>
            </div>
          )}
        </section>

        {/* 5. Complete Candidate Answers Table */}
        <section className="break-inside-avoid">
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <GraduationCap size={18} className="text-emerald-600" weight="bold" />
            <span>5. Candidate Assessment Profile & Verified Answers</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(report.user_answers || {})
              .filter(([k]) => VALID_FORM_KEYS.has(k) && !['linkedinData', 'resume', 'precomputedResumeJson'].includes(k))
              .map(([k, v]) => {
                let formattedVal = ''
                if (v == null) formattedVal = ''
                else if (Array.isArray(v)) formattedVal = v.filter(Boolean).join(', ')
                else if (typeof v === 'object') {
                  const raw = String(v.raw ?? v.value ?? '').trim()
                  const period = String(v.period ?? '').trim()
                  formattedVal = raw ? (period ? `${raw} per ${period}` : raw) : (v.formatted || '')
                } else {
                  formattedVal = String(v).trim()
                }
                if (formattedVal === 'per' || formattedVal === 'undefined' || formattedVal === 'null') formattedVal = ''
                return [k, formattedVal]
              })
              .filter(([_, formattedVal]) => Boolean(formattedVal))
              .map(([k, formattedVal], idx) => {
                const formattedKey = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                return (
                  <div key={idx} className="border border-slate-200 bg-slate-50 px-3 py-2 rounded text-xs flex justify-between items-center gap-2">
                    <span className="font-semibold text-slate-700">{formattedKey}:</span>
                    <span className="text-slate-900 font-medium truncate max-w-[220px]">{formattedVal}</span>
                  </div>
                )
              })}
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
          Crafture Career GPS • Executive Career Intelligence Report • All Rights Reserved
        </div>
      </div>
    </div>
  )
}
