import React, { useState } from 'react'
import {
  CalendarBlank,
  ArrowRight,
  DownloadSimple,
  ShieldCheck,
  Briefcase,
  CheckCircle,
} from '@phosphor-icons/react'
import { downloadFullVisualReport } from '../../lib/downloadFullReport'
import strategySessionImg from '../../assets/images/career-gps-strategy-session.webp'
import { decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'
import CrafturePoseMascot from '../common/CrafturePoseMascot'

function safeText(val, fallback = '') {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return val.text || val.statement || val.value || val.cta || fallback
  return fallback
}

export default function FinalNextAction({ coachData, reportData, onBookCall, isTeaserLocked = false }) {
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

  const candidateName =
    reportData?.resume_agent?.candidateSnapshot?.name ||
    reportData?.user_answers?.fullName ||
    reportData?.user_answers?.name ||
    'Candidate'

  const phaseId = Number(
    reportData?.funnel_stages?.bottleneckStageId ||
    reportData?.funnel_stages?.stateMachine?.stageNum ||
    reportData?.current_phase_id ||
    reportData?.phase?.id ||
    reportData?.career_journey?.current_phase_id ||
    1
  )
  const currentPhase = reportData?.phase || reportData?.career_journey?.current_phase || {}
  const phaseShort =
    reportData?.funnel_stages?.stateMachine?.shortName ||
    currentPhase.shortName ||
    currentPhase.name ||
    (phaseId === 1
      ? 'Pre-Screen Applications'
      : phaseId === 2
      ? 'Recruiter Screens'
      : phaseId === 3
      ? 'Technical Panels'
      : phaseId === 4
      ? 'Final Loops'
      : 'Offer Closing')

  const summaryCopy = phaseId >= 3
    ? `Work directly with an executive technical mentor to master system architecture defense, articulate complex engineering tradeoffs, and advance through technical panels live.`
    : `Work directly with an executive technical recruiter to calibrate your ${targetRole} positioning, rewrite your highest-leverage bullets, and implement your customized execution roadmap live.`

  const [isDownloading, setIsDownloading] = useState(false)

  return (
    <section id="next-action" className="pt-2 pb-0 print:pt-1 print:pb-0 break-inside-avoid page-break-inside-avoid">
      <div
        className="p-6 sm:p-8 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] relative overflow-hidden shadow-xs"
        data-mascot-cue="Ready to break your pipeline deadlock? Work live 1-on-1 with an executive coach to overhaul your positioning."
        data-mascot-chip="Execution Bridge"
        data-mascot-emotion="coach"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column (lg:col-span-7, left-aligned) */}
          <div className="lg:col-span-7 space-y-4 text-left">
            {/* Header Tag */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] text-xs font-mono tracking-normal text-[var(--text-muted)] border border-[var(--border-default)]">
              <span>Next Step • Live Execution Bridge</span>
            </div>

            {/* Core Headline */}
            <div className="space-y-2">
              <h2
                className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                Stuck at Phase {phaseId} ({phaseShort})?{' '}
                <span className="text-[var(--primary)]">Fix It Live in a 1-on-1 Strategy Session.</span>
              </h2>

              {/* Concise 2-line summary */}
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                {summaryCopy}
              </p>
            </div>

            {/* Contextual Blocker Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center gap-1.5">
                <Briefcase size={13} className="text-[var(--primary)]" />
                Target: {targetRole}
              </span>
              {visaStatus && (
                <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-amber-500" />
                  Auth: {visaStatus}
                </span>
              )}
            </div>

            {/* Compact 3-Item Checklist Pillars */}
            <div className="space-y-2 py-1">
              <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <CheckCircle size={15} weight="fill" className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[var(--text-primary)] font-semibold">Direct Referral Engine:</strong> Target verified engineering managers directly to bypass 95% cold portal ATS drop-offs.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <CheckCircle size={15} weight="fill" className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[var(--text-primary)] font-semibold">Recruiter Gatekeeper Defense:</strong> Eliminate screening friction around leveling, framing, and sponsorship before your calls.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <CheckCircle size={15} weight="fill" className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[var(--text-primary)] font-semibold">Offer Conversion Mastery:</strong> Rehearse system architecture defense, behavioral STAR stories, and compensation leverage.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href="https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe"
                target="_blank"
                rel="noopener noreferrer"
                onClick={onBookCall}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all no-underline cursor-pointer"
              >
                <CalendarBlank size={18} weight="bold" />
                <span>Book Free 1-on-1 Strategy Call</span>
                <ArrowRight size={14} weight="bold" />
              </a>

              {!isTeaserLocked && (
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
                  className="print:hidden w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] border border-[var(--border-default)] text-xs sm:text-sm font-semibold text-[var(--text-primary)] shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  <DownloadSimple size={18} weight="bold" />
                  <span>{isDownloading ? 'Generating PDF...' : 'Download Full Report (PDF)'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column (lg:col-span-5) - Seamless illustration with Mascot Celebration */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row items-center justify-end gap-4">
            <CrafturePoseMascot
              pose="thumbsup"
              size={120}
              animation="bounce"
              showShadow={true}
              className="shrink-0"
              alt="Celebration Mascot"
            />
            <div className="relative w-full max-w-xs dark:rounded-2xl dark:bg-slate-100/95 dark:p-3 dark:shadow-sm">
              <img
                src={strategySessionImg}
                alt="1-on-1 Strategy Session"
                className="w-full h-auto object-contain mix-blend-multiply dark:mix-blend-normal [mask-image:linear-gradient(to_right,transparent_0%,black_18%,black_95%,transparent_100%)] dark:[mask-image:none]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
