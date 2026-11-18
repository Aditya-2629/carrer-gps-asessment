import React, { useState } from 'react'
import {
  CalendarBlank,
  Clock,
  ArrowRight,
  DownloadSimple,
  ShieldCheck,
  Users,
  Briefcase,
  CheckCircle,
} from '@phosphor-icons/react'
import { downloadFullVisualReport } from '../../lib/downloadFullReport'

import { decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'

function safeText(val, fallback = '') {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return val.text || val.statement || val.value || val.cta || fallback
  return fallback
}

export default function FinalNextAction({ coachData, reportData, onBookCall }) {
  const rawTargetRole =
    reportData?.assessment_agent?.candidateProfile?.targetRole ||
    reportData?.user_answers?.targetRole ||
    reportData?.formData?.targetRole ||
    reportData?.resume_agent?.candidateSnapshot?.targetRole ||
    reportData?.resume_json?.target_role ||
    'Target Role'
  const targetRole = decodeHtmlEntities(rawTargetRole)

  const rawVisa =
    reportData?.user_answers?.visaStatus ||
    reportData?.user_answers?.workAuthorization ||
    reportData?.user_answers?.visa ||
    null
  const visaStatus = rawVisa ? decodeHtmlEntities(rawVisa) : null

  const criticalRisk =
    typeof reportData?.risk_heatmap?.critical_risk === 'string'
      ? reportData.risk_heatmap.critical_risk
      : reportData?.risk_heatmap?.critical_risk?.title || null

  const candidateName =
    reportData?.resume_agent?.candidateSnapshot?.name ||
    reportData?.user_answers?.fullName ||
    reportData?.user_answers?.name ||
    'Candidate'

  const ctaText = safeText(coachData?.cta_text, 'Book Free 1-on-1 Career Strategy Call')
  const [isDownloading, setIsDownloading] = useState(false)

  return (
    <section id="next-action" className="pt-2 pb-0 print:pt-1 print:pb-0 print-keep print-card break-inside-avoid page-break-inside-avoid">
      <div className="p-5 sm:p-6 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] relative overflow-hidden shadow-xs space-y-5 print-card break-inside-avoid page-break-inside-avoid print:p-4 print:space-y-2">
        <div className="relative z-10 max-w-3xl mx-auto space-y-5 print:space-y-3 text-center">
          {/* Header Tag */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] text-xs font-mono tracking-normal text-[var(--text-muted)] border border-[var(--border-default)]">
            <span>The Execution Bridge: Pipeline Conversion & Strategy</span>
          </div>

          {/* Core Headline */}
          <div className="space-y-2.5 print:space-y-1">
            <h2
              className="text-2xl sm:text-3xl print:text-xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-head)' }}
            >
              {reportData?.phase?.name && reportData?.primary_bottleneck?.title ? (
                <>
                  You're stuck in <span className="text-[var(--primary)]">{decodeHtmlEntities(reportData.phase.name)}</span> due to {decodeHtmlEntities(reportData.primary_bottleneck.title)}.
                  <br />
                  <span className="text-[var(--primary)]">Let's fix it live in a 1-on-1 Strategy Session.</span>
                </>
              ) : (
                <>
                  We've fixed your Resume & LinkedIn copy above.
                  <br />
                  <span className="text-[var(--primary)]">Now let's fix your Interview & Offer Pipeline.</span>
                </>
              )}
            </h2>
            <p className="text-xs sm:text-sm print:text-xs text-[var(--text-secondary)] font-medium max-w-2xl mx-auto leading-relaxed">
              Polished bullet points and optimized headlines alone won't solve cold application drop-offs, recruiter screening filters, or live interview conversion. Bypassing cold portals requires targeted referral execution.
            </p>
          </div>

          {/* Contextual Blocker Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center gap-1">
              <Briefcase size={13} className="text-[var(--primary)]" />
              Target: {targetRole} Direct Referral Pipeline Protocol
            </span>
            {visaStatus && (
              <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center gap-1">
                <ShieldCheck size={13} className="text-amber-500" />
                Auth: {visaStatus}
              </span>
            )}
          </div>

          {/* 3 Concrete Outcomes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:gap-3 text-left pt-2 print:pt-1">
            {/* Outcome 1 */}
            <div className="p-4 sm:p-5 print:p-3 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2 print:space-y-1 flex flex-col justify-between shadow-2xs break-inside-avoid">
              <div className="space-y-1.5 print:space-y-1">
                <div className="w-8 h-8 print:w-6 print:h-6 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center font-bold text-sm print:text-xs">
                  1
                </div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                  Direct Hiring Manager & Sponsor-Verified Pipeline
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Stop losing 95% of applications in cold ATS portals. Build an active outreach and internal referral engine targeted to your exact role and tier-1 companies.
                </p>
              </div>
              <div className="pt-2 border-t border-[var(--border-default)] text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle size={12} weight="fill" />
                <span>Bypasses Cold ATS Portals</span>
              </div>
            </div>

            {/* Outcome 2 */}
            <div className="p-4 sm:p-5 print:p-3 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2 print:space-y-1 flex flex-col justify-between shadow-2xs break-inside-avoid">
              <div className="space-y-1.5 print:space-y-1">
                <div className="w-8 h-8 print:w-6 print:h-6 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-bold text-sm print:text-xs">
                  2
                </div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                  Recruiter Screening & Background-Check Positioning
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Resolve vendor/client framing, visa/sponsorship friction, and academic timeline flags with certified scripts before recruiters silently filter you out.
                </p>
              </div>
              <div className="pt-2 border-t border-[var(--border-default)] text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <CheckCircle size={12} weight="fill" />
                <span>Eliminates Screening Friction</span>
              </div>
            </div>

            {/* Outcome 3 */}
            <div className="p-4 sm:p-5 print:p-3 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2 print:space-y-1 flex flex-col justify-between shadow-2xs break-inside-avoid">
              <div className="space-y-1.5 print:space-y-1">
                <div className="w-8 h-8 print:w-6 print:h-6 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center font-bold text-sm print:text-xs">
                  3
                </div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                  Live Technical & System Design Conversion Plan
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Turn initial recruiter screens into final-round offers with a tailored mock-interview, architectural storytelling, and compensation negotiation roadmap.
                </p>
              </div>
              <div className="pt-2 border-t border-[var(--border-default)] text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                <CheckCircle size={12} weight="fill" />
                <span>Maximized Offer Velocity</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onBookCall}
              className="btn-primary text-sm sm:text-base print:py-2.5 print:px-6 print:text-xs no-underline inline-flex items-center gap-2.5 shadow-md hover:scale-[1.02] transition-transform cursor-pointer"
            >
              <CalendarBlank size={20} weight="bold" />
              <span>{ctaText}</span>
            </a>

            <button
              type="button"
              disabled={isDownloading}
              onClick={async () => {
                setIsDownloading(true)
                try {
                  await downloadFullVisualReport(reportData, candidateName)
                } finally {
                  setIsDownloading(false)
                }
              }}
              className="print:hidden px-5 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] hover:bg-[var(--surface-sunken)] text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
            >
              <DownloadSimple size={16} weight="bold" />
              <span>{isDownloading ? 'Generating PDF...' : 'Download Full Report (PDF)'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
