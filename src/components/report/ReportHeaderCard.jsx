import { motion } from 'framer-motion'
import { User, Briefcase, IdentificationCard, Calendar, Robot, Compass } from '@phosphor-icons/react'

export default function ReportHeaderCard({ candidateData }) {
  const name = candidateData?.candidate_name || candidateData?.name || candidateData?.candidate?.name || ''
  const targetRole = candidateData?.target_role || candidateData?.candidate?.targetRole || ''
  const visaStatus = candidateData?.visa_status || candidateData?.candidate?.visaStatus || ''
  const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="quiz-card p-6 md:p-8 relative overflow-hidden border border-[var(--border-default)]">
      {/* Background Accent Glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-[var(--emerald)]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--border-default)]">
        <div>
          <div className="flex items-center gap-2 text-[var(--primary)] font-bold text-xs uppercase tracking-widest mb-1">
            <Compass size={16} weight="fill" />
            <span>CAREER GPS CAREER INTELLIGENCE REPORT</span>
          </div>
          <h1
            className="text-2xl md:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Your job search, <span className="text-[var(--primary)] underline decoration-[var(--primary)]/50">diagnosed.</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            What's working, what's not, and exactly what to fix.
          </p>
        </div>

        <div className="text-right hidden md:block">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--emerald-bg)] border border-[var(--border-default)] text-[var(--emerald)]">
            CONFIDENTIAL • PAGE 1 OF 8
          </span>
        </div>
      </div>

      {/* Main Grid: Guide Speech Callout + Candidate Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6 items-stretch">
        {/* Left Guide Intro */}
        <div className="md:col-span-5 quiz-card p-6 flex items-start gap-4 bg-[var(--primary-light)] border border-[var(--border-default)]">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/25 flex items-center justify-center shrink-0 text-[var(--primary)] shadow-sm">
            <Robot size={32} weight="fill" />
          </div>
          <div>
            <h4 className="text-base font-bold text-[var(--primary)] mb-1.5" style={{ fontFamily: 'var(--font-head)' }}>
              Hi {name.split(' ')[0]},
            </h4>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              I'm your <strong className="text-[var(--text-primary)] font-bold">Career GPS Guide</strong>. I'll walk with you through your entire job search journey and help you reach your target offer!
            </p>
          </div>
        </div>

        {/* Right Profile Details Card */}
        <div className="md:col-span-7 quiz-card p-6 border border-[var(--border-default)] bg-[var(--surface-sunken)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs">
              <User size={22} className="text-[var(--emerald)] shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-[var(--text-muted)] block uppercase font-semibold tracking-wider">Candidate</span>
                <span className="font-bold text-sm sm:text-base text-[var(--text-primary)] truncate block">{name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs">
              <Briefcase size={22} className="text-[var(--emerald)] shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-[var(--text-muted)] block uppercase font-semibold tracking-wider">Target Role</span>
                <span className="font-bold text-sm sm:text-base text-[var(--text-primary)] truncate block">{targetRole}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs">
              <IdentificationCard size={22} className="text-amber-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-[var(--text-muted)] block uppercase font-semibold tracking-wider">Visa Status</span>
                <span className="font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400 truncate block">{visaStatus}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs">
              <Calendar size={22} className="text-[var(--emerald)] shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-[var(--text-muted)] block uppercase font-semibold tracking-wider">Report Date</span>
                <span className="font-bold text-sm sm:text-base text-[var(--text-primary)] truncate block">{reportDate}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-default)]">
            <span>Prepared By: <strong className="text-[var(--emerald)] font-semibold">Crafture Career GPS AI</strong></span>
            <span className="font-mono font-medium">ID: {Math.random().toString(36).substring(2, 9).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
