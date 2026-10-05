import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Compass,
  Briefcase,
  IdentificationCard,
  Calendar,
  Sparkle,
  Warning,
  TrendUp,
  Robot,
} from '@phosphor-icons/react'

const CIRCUMFERENCE = 2 * Math.PI * 46 // r=46 -> 289

function getScoreColor(score) {
  if (score >= 75) return 'var(--emerald)'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function getScoreBadgeClass(score) {
  if (score >= 75) return 'bg-emerald-500/15 text-[var(--emerald)] border-emerald-500/30'
  if (score >= 50) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
  return 'bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30'
}

export default function ReportHero({ reportData }) {
  const candidate = reportData?.resume_json || {}
  const rawName =
    typeof candidate.candidate_name === 'string' ? candidate.candidate_name :
    typeof candidate.name === 'string' ? candidate.name :
    typeof reportData?.candidate_name === 'string' ? reportData.candidate_name :
    typeof candidate.candidate_name === 'object' ? (candidate.candidate_name?.name || 'Candidate') :
    'Candidate'
  const firstName = (typeof rawName === 'string' ? rawName.trim().split(' ')[0] : 'Candidate') || 'Candidate'
  const targetRole =
    typeof candidate.target_role === 'string' ? candidate.target_role :
    typeof reportData?.target_role === 'string' ? reportData.target_role :
    'Senior Full Stack Engineer'
  const visaStatus =
    typeof candidate.visa_status === 'string' ? candidate.visa_status :
    typeof reportData?.visa_status === 'string' ? reportData.visa_status :
    'F-1 OPT (STEM Extension)'
  const healthScore = Math.max(0, Number(reportData?.career_health_score) || 41)
  const scoreLabel =
    typeof reportData?.score_label === 'string' ? reportData.score_label : 'Emerging'
  const reportDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Animated circular score counter
  const [displayedScore, setDisplayedScore] = useState(0)
  useEffect(() => {
    let start = 0
    const end = Math.min(100, Math.max(1, healthScore))
    const stepTime = Math.max(10, Math.floor(1200 / end))
    const timer = setInterval(() => {
      start += 1
      setDisplayedScore(start)
      if (start >= end) clearInterval(timer)
    }, stepTime)
    return () => clearInterval(timer)
  }, [healthScore])

  const strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(100, displayedScore)) / 100
  const scoreColor = getScoreColor(healthScore)

  // One-line diagnosis synthesis
  const rawStrength = candidate.strengths?.[0] || reportData?.strengths?.[0]
  const strongestAdvantage =
    typeof rawStrength === 'string' ? rawStrength :
    rawStrength?.title || rawStrength?.description || rawStrength?.signal ||
    'Technical Stack Execution & Modern Framework Experience'

  const primaryIssue = reportData?.critical_issues?.[0] || reportData?.issues?.[0]
  const biggestBottleneck =
    typeof primaryIssue === 'string' ? primaryIssue :
    primaryIssue?.title || primaryIssue?.diagnosis ||
    'Application-to-Interview Conversion Drop-off'

  return (
    <section id="overview" className="relative pt-2 pb-6">
      {/* Soft Ambient Glow */}
      <div className="absolute -top-12 -left-12 w-80 h-80 bg-[var(--primary)]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-0 w-80 h-80 bg-[var(--emerald)]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Hero Card Container */}
      <div className="rounded-3xl p-6 sm:p-9 bg-[var(--surface-card)] border border-[var(--border-default)] shadow-sm relative overflow-hidden">
        {/* Top Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] border border-[var(--primary)]/25 flex items-center justify-center text-[var(--primary)]">
              <Compass size={18} weight="fill" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block font-mono">
                AI Career Intelligence
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Crafture Career GPS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)] flex items-center gap-1.5">
              <Calendar size={13} className="text-[var(--text-muted)]" />
              <span>{reportDate}</span>
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--emerald-bg)] border border-emerald-500/20 text-[var(--emerald)]">
              Confidential Analysis
            </span>
          </div>
        </div>

        {/* Hero Body Grid: Greeting + Diagnosis on Left, Circular Score on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-6">
          {/* Left Column: Personalized Greeting & Narrative */}
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold text-[var(--primary)] border border-[var(--primary)]/20">
              <Robot size={15} weight="fill" />
              <span>Personal Career Coach Report</span>
            </div>

            <div className="space-y-2">
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.15]"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                {firstName}, here's where your{' '}
                <span className="text-[var(--primary)]">job search stands.</span>
              </h1>

              {/* Target Role & Visa Badges */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)]">
                  <Briefcase size={14} className="text-[var(--primary)]" weight="bold" />
                  <span>Target: {targetRole}</span>
                </span>
                {visaStatus && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <IdentificationCard size={14} weight="bold" />
                    <span>{visaStatus}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Coach One-Line Key Diagnosis Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2.5">
              <div className="text-xs uppercase tracking-wider font-mono font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                <Sparkle size={14} weight="fill" className="text-[var(--emerald)]" />
                <span>Coach Executive Diagnosis</span>
              </div>
              <p className="text-base sm:text-lg leading-relaxed text-[var(--text-primary)] font-medium">
                &ldquo;Your strongest advantage is{' '}
                <strong className="text-[var(--emerald)] font-bold">{strongestAdvantage}</strong>.
                Your biggest bottleneck right now is{' '}
                <strong className="text-red-500 dark:text-red-400 font-bold">
                  {biggestBottleneck}
                </strong>
                .&rdquo;
              </p>
            </div>
          </div>

          {/* Right Column: Circular Progress Visualization */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-center relative">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
                {/* Background Ring Track */}
                <circle
                  cx="55"
                  cy="55"
                  r="46"
                  stroke="var(--border-default)"
                  strokeWidth="8"
                  fill="transparent"
                  className="opacity-70"
                />
                {/* Foreground Animated Ring */}
                <circle
                  cx="55"
                  cy="55"
                  r="46"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{
                    transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </svg>

              {/* Inside Score Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-5xl font-black text-[var(--text-primary)] tabular-nums tracking-tight"
                  style={{ fontFamily: 'var(--font-head)' }}
                >
                  {displayedScore}
                </span>
                <span className="text-xs font-mono font-bold text-[var(--text-muted)] mt-0.5">
                  / 100
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <span className="text-xs font-mono uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                Career Health Index
              </span>
              <span
                className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getScoreBadgeClass(
                  healthScore
                )}`}
              >
                {scoreLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
