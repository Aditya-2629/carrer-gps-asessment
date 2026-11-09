import React from 'react'
import { ShieldCheck, Target, Sparkle, Lightning, ChartLineUp, UserCheck } from '@phosphor-icons/react'

export default function ReportHero({ reportData, user }) {
  const rawScores =
    reportData?.heroScore ||
    (typeof reportData?.career_health_score === 'object' && reportData?.career_health_score !== null
      ? reportData.career_health_score
      : null)

  const scores = {
    overall:
      typeof rawScores?.overall === 'number'
        ? rawScores.overall
        : typeof reportData?.career_health_score === 'number'
        ? reportData.career_health_score
        : Number(reportData?.score) || 72,
    marketAlignment: rawScores?.marketAlignment ?? 75,
    impactAndMetrics: rawScores?.impactAndMetrics ?? 58,
    atsCompatibility: rawScores?.atsCompatibility ?? 85,
  }

  const role =
    user?.targetRole ||
    reportData?.targetRole ||
    reportData?.target_role ||
    reportData?.resume_agent?.candidateSnapshot?.targetRole ||
    reportData?.resume_json?.target_role ||
    'Senior Professional'

  const overall = scores.overall || 72

  // Dynamic Ring Stroke Color
  const ringColor =
    overall >= 80 ? 'text-emerald-500' : overall >= 60 ? 'text-indigo-600' : 'text-amber-500'

  const strokeDashoffset = 283 - (283 * overall) / 100

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              Executive ATS Diagnostic
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              Calibrated for {role}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Career Health & Market Fit Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Real-time alignment analysis benchmarking your resume and LinkedIn presence against current hiring demand, recruiter keyword density, and quantifiable business impact.
          </p>
        </div>

        {/* Circular Tremor Score Ring */}
        <div className="flex items-center gap-5 shrink-0 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                className="text-slate-200 dark:text-slate-800 stroke-current"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                className={`${ringColor} stroke-current transition-all duration-1000 ease-out`}
                strokeWidth="8"
                strokeDasharray="283"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">{overall}</span>
              <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500">Index</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {overall >= 80 ? 'Interview Ready 🎯' : overall >= 60 ? 'Competitive with Optimization ⚡' : 'High Rejection Risk ⚠️'}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[160px] leading-snug">
              {overall >= 80 ? 'Passing top 10% ATS recruiter filters.' : 'Lacks critical quantifiable metrics or stack coverage.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Tremor-Style Executive Micro-Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Market Alignment</span>
            <Target size={15} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
            {scores.marketAlignment || 75}%
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Core competency cluster match</p>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Quantified Metrics</span>
            <ChartLineUp size={15} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
            {scores.impactAndMetrics || 58}%
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Bullets with revenue/$ scale</p>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">ATS Format Health</span>
            <ShieldCheck size={15} className="text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
            {scores.atsCompatibility || 85}%
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Parser cleanliness & structure</p>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Recruiter Search</span>
            <UserCheck size={15} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
            {reportData?.recruiterSeo?.seoScore || reportData?.linkedin_agent?.recruiterSeo?.seoScore || 64}/100
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">LinkedIn Boolean search visibility</p>
        </div>
      </div>
    </div>
  )
}
