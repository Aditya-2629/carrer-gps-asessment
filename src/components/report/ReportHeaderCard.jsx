import { User, Briefcase, IdentificationCard, Calendar, Compass } from '@phosphor-icons/react'

export default function ReportHeaderCard({ candidateData }) {
  const name = candidateData?.candidate_name || candidateData?.name || candidateData?.candidate?.name || ''
  const targetRole = candidateData?.target_role || candidateData?.candidate?.targetRole || ''
  const visaStatus = candidateData?.visa_status || candidateData?.candidate?.visaStatus || ''
  const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="quiz-card p-5 sm:p-6 relative overflow-hidden border border-[var(--border-default)] rounded-xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--border-default)]">
        <div>
          <div className="flex items-center gap-2 text-[var(--primary)] text-xs font-mono tracking-normal mb-1">
            <Compass size={15} weight="bold" />
            <span>Career GPS Diagnostic Dossier</span>
          </div>
          <h1
            className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Career diagnostic and audit report
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Evaluation of your resume, profile positioning, and pipeline conversion rates.
          </p>
        </div>

        <div className="text-right hidden md:block">
          <span className="px-2.5 py-1 rounded-md text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            Evaluation Dossier • {reportDate}
          </span>
        </div>
      </div>

      {/* Main Grid: Guide Speech Callout + Candidate Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-5 items-stretch">
        {/* Left Guide Intro */}
        <div className="md:col-span-5 quiz-card p-5 flex items-start gap-3.5 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] flex items-center justify-center shrink-0 text-[var(--primary)] shadow-xs">
            <Compass size={20} weight="bold" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
              {name || 'Candidate'} — {targetRole || 'Software Engineer'}
            </h4>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Diagnostic assessment based on submitted resume, role specialization criteria, and pipeline conversion benchmarks.
            </p>
          </div>
        </div>

        {/* Right Profile Details Card */}
        <div className="md:col-span-7 quiz-card p-5 border border-[var(--border-default)] bg-[var(--surface-sunken)] space-y-4 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs">
              <User size={18} className="text-[var(--text-muted)] shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-[var(--text-muted)] block font-medium">Candidate</span>
                <span className="font-semibold text-sm text-[var(--text-primary)] truncate block">{name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs">
              <Briefcase size={18} className="text-[var(--text-muted)] shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-[var(--text-muted)] block font-medium">Target Role</span>
                <span className="font-semibold text-sm text-[var(--text-primary)] truncate block">{targetRole}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs">
              <IdentificationCard size={18} className="text-[var(--text-muted)] shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-[var(--text-muted)] block font-medium">Visa Status</span>
                <span className="font-semibold text-sm text-[var(--text-primary)] truncate block">{visaStatus}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs">
              <Calendar size={18} className="text-[var(--text-muted)] shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-[var(--text-muted)] block font-medium">Assessment Date</span>
                <span className="font-semibold text-sm text-[var(--text-primary)] truncate block">{reportDate}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-default)]">
            <span>Prepared By: <span className="text-[var(--text-primary)] font-medium">Crafture Career GPS</span></span>
            <span className="font-mono text-xs tabular-nums">Ref: {name ? name.substring(0, 3).toUpperCase() : 'CAD'}-2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
