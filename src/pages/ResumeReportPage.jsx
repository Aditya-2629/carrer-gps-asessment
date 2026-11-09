import React, { useState, useEffect } from 'react'
import {
  FileText,
  Printer,
  ArrowLeft,
  Sparkle,
  DownloadSimple,
  CheckCircle,
} from '@phosphor-icons/react'
import ReportHero from '../components/report/ReportHero.jsx'
import ResumeKeywordAlignment from '../components/report/ResumeKeywordAlignment.jsx'
import ResumeBulletAudit from '../components/report/ResumeBulletAudit.jsx'
import brandLogo from '../assets/images/crafture-logo.jpg'

const STORAGE_KEY = 'craftureResumeReport'

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

  const handlePrintPdf = () => {
    window.print()
  }

  if (!loaded) return null

  const reportData = payload?.analysis || payload || {}
  const user = payload?.user || {}

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* ─── Sticky Non-Print Action Bar (Hidden in PDF) ──────────────────── */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/test-lab"
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="Return to Lab"
            >
              <ArrowLeft size={18} />
            </a>
            <img
              src={brandLogo}
              alt="Crafture"
              className="w-8 h-8 rounded-xl object-cover border border-slate-200 shadow-xs"
            />
            <div>
              <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                Career GPS
              </span>
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                Official Diagnostic Report
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer size={15} weight="bold" /> Download Executive PDF
            </button>
          </div>
        </div>
      </header>

      {/* ─── Printable Document Canvas (Pixel-Perfect A4) ──────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Printable Official Cover Header (Appears only on PDF) */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Candidate ATS Diagnostic & Career Assessment Report
              </h1>
              <p className="text-xs text-slate-600 font-mono mt-0.5">
                Benchmark Target: {user?.targetRole || 'Senior Professional'} · Generated via Career GPS Executive Engine
              </p>
            </div>
            <div className="text-right text-xs font-mono text-slate-500">
              Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* SECTION 1: Tremor-Style Executive Hero & Score Ring */}
        <ReportHero reportData={reportData} user={user} />

        {/* SECTION 2: Competency Clusters Progress Bars ("OR" Grouping) */}
        <ResumeKeywordAlignment alignmentData={reportData} />

        {/* SECTION 3: ResumeMatcher-Style ATS Recruiter Eye-Tracking Heatmap */}
        <ResumeBulletAudit bulletData={reportData} />

        {/* Official Printable Footer */}
        <div className="pt-6 border-t border-slate-200 text-center text-xs text-slate-400 font-mono">
          Career GPS Assessment Engine · Confidential Diagnostic Report for Candidate & Hiring Partners
        </div>
      </main>
    </div>
  )
}
