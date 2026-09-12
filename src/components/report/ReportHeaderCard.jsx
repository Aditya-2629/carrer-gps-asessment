import { motion } from 'framer-motion'
import { User, Briefcase, IdentificationCard, Calendar, Robot, Compass } from '@phosphor-icons/react'

export default function ReportHeaderCard({ candidateData }) {
  const name = candidateData?.candidate_name || candidateData?.name || 'Arjun Mehta'
  const targetRole = candidateData?.target_role || 'Data Analyst / BI Analyst'
  const visaStatus = candidateData?.visa_status || 'F-1 OPT (STEM Extension)'
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
            <span>CAREER GPS™ CAREER INTELLIGENCE REPORT</span>
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
        <div className="md:col-span-5 quiz-card p-5 flex items-start gap-4 bg-[var(--primary-light)] border border-[var(--border-default)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/25 flex items-center justify-center shrink-0 text-[var(--primary)] shadow-sm">
            <Robot size={28} weight="fill" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--primary)] mb-1" style={{ fontFamily: 'var(--font-head)' }}>
              Hi {name.split(' ')[0]},
            </h4>
            <p className="text-xs text-[var(--text-primary)] leading-relaxed">
              I'm your <strong className="text-[var(--text-primary)] font-bold">Career GPS Guide</strong>. I'll walk with you through your entire job search journey and help you reach your goal!
            </p>
          </div>
        </div>

        {/* Right Profile Details Card */}
        <div className="md:col-span-7 quiz-card p-5 border border-[var(--border-default)] bg-[var(--surface-sunken)] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)]">
              <User size={18} className="text-[var(--emerald)] shrink-0" />
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] block uppercase font-medium">Candidate</span>
                <span className="font-semibold text-[var(--text-primary)]">{name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)]">
              <Briefcase size={18} className="text-[var(--emerald)] shrink-0" />
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] block uppercase font-medium">Target Role</span>
                <span className="font-semibold text-[var(--text-primary)]">{targetRole}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)]">
              <IdentificationCard size={18} className="text-[var(--emerald)] shrink-0" />
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] block uppercase font-medium">Visa Status</span>
                <span className="font-semibold text-amber-500">{visaStatus}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)]">
              <Calendar size={18} className="text-[var(--emerald)] shrink-0" />
              <div>
                <span className="text-[10px] text-[var(--text-subtle)] block uppercase font-medium">Report Date</span>
                <span className="font-semibold text-[var(--text-primary)]">{reportDate}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-[var(--text-subtle)] border-t border-[var(--border-default)]">
            <span>Prepared By: <strong className="text-[var(--emerald)]">Crafture Career GPS™ AI</strong></span>
            <span className="font-mono">ID: {Math.random().toString(36).substring(2, 9).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
