import React from 'react'
import { motion } from 'framer-motion'
import {
  CalendarBlank,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Briefcase,
  CheckCircle,
  WhatsappLogo,
  Globe,
  UsersThree,
  LinkedinLogo,
  InstagramLogo,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { trackEvent } from '../../lib/posthog'
import strategySessionImg from '../../assets/images/career-gps-strategy-session.webp'
import { decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'
import CrafturePoseMascot from '../common/CrafturePoseMascot'
import { SpotlightCard, MagnetButton, ShimmerButton, BorderBeam, ShinyText } from '../motion'

function safeText(val, fallback = '') {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return val.text || val.statement || val.value || val.cta || fallback
  return fallback
}

export default function FinalNextAction({
  coachData,
  reportData,
  onBookCall,
  isTeaserLocked = false,
  bookingUrl = '',
  whatsappNumber = '',
  socialLinksConfig = null,
  healthScore = null,
}) {
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

  const bottleneckTitle = String(
    reportData?.primary_bottleneck?.title ||
    reportData?.primaryBottleneck?.title ||
    ''
  )
  const parsedBottleneckPhase = bottleneckTitle.match(/Phase\s*(\d+)/i)?.[1]
  const phaseId = Number(
    reportData?.primary_bottleneck?.phaseId ||
    reportData?.primary_bottleneck?.stageId ||
    parsedBottleneckPhase ||
    reportData?.funnel_stages?.bottleneckStageId ||
    reportData?.funnel_stages?.stateMachine?.stageNum ||
    reportData?.current_phase_id ||
    reportData?.phase?.id ||
    reportData?.career_journey?.current_phase_id ||
    1
  )
  const currentPhase = reportData?.phase || reportData?.career_journey?.current_phase || {}
  const phaseShort =
    (phaseId === 3 ? 'Technical Rounds' :
     phaseId === 4 ? 'Final Loops' :
     phaseId === 5 ? 'Offer Closing' :
     phaseId === 2 ? 'Recruiter Screens' :
     phaseId === 1 ? 'Pre-Screen Applications' : null) ||
    reportData?.funnel_stages?.stateMachine?.shortName ||
    currentPhase.shortName ||
    currentPhase.name ||
    'Positioning'

  const summaryCopy = phaseId >= 3
    ? `Work directly with an executive technical mentor to master system architecture defense, articulate complex engineering tradeoffs, and advance through technical panels live.`
    : `Work directly with an executive technical recruiter to calibrate your ${targetRole} positioning, rewrite your highest-leverage bullets, and implement your customized execution roadmap live.`

  return (
    <section id="next-action" className="pt-2 pb-0 print:pt-1 print:pb-0 break-inside-avoid page-break-inside-avoid">
      <SpotlightCard
        className="p-6 sm:p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] relative overflow-hidden shadow-xs"
        data-mascot-cue="Ready to break your pipeline deadlock? Work live 1-on-1 with an executive coach to overhaul your positioning."
        data-mascot-chip="Execution Bridge"
        data-mascot-emotion="coach"
      >
        <BorderBeam size={180} duration={8} colorFrom="#22C55E" colorTo="#15803D" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column (lg:col-span-7, left-aligned) */}
          <div className="lg:col-span-7 space-y-4 text-left">
            {/* Header Tag */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] text-xs font-mono tracking-normal text-[var(--text-muted)] border border-[var(--border-default)]">
              <ShinyText>Next Step • Live Execution Bridge</ShinyText>
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
              <MagnetButton
                as="div"
                className="w-full sm:w-auto"
              >
                <ShimmerButton
                  as="a"
                  href={bookingUrl || 'https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onBookCall}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-3 text-xs sm:text-sm no-underline"
                >
                  <CalendarBlank size={18} weight="bold" />
                  <span>Book Free 1-on-1 Strategy Call</span>
                  <ArrowRight size={14} weight="bold" />
                </ShimmerButton>
              </MagnetButton>

              {(() => {
                const rawScore =
                  healthScore ??
                  reportData?.career_health_score ??
                  reportData?.overallScore ??
                  72
                const cleanWa = String(
                  whatsappNumber || reportData?.whatsappCtaNumber || ''
                ).replace(/\D/g, '')
                const waMessage = `Hi Crafture team, I'm ${candidateName} targeting ${targetRole} (Career Health Score: ${rawScore}/100) and would like to unlock my complete Career GPS Report.`
                const waHref = cleanWa
                  ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(waMessage)}`
                  : `https://wa.me/?text=${encodeURIComponent(waMessage)}`
                return (
                  <MagnetButton
                    as="a"
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('whatsapp_cta_clicked', { source: 'final_next_action', targetRole })}
                    className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-md transition-colors duration-150 no-underline cursor-pointer"
                  >
                    <WhatsappLogo size={18} weight="fill" />
                    <span>Connect on WhatsApp</span>
                  </MagnetButton>
                )
              })()}
            </div>

            {(() => {
              const cfg = socialLinksConfig || reportData?.socialLinksConfig
              if (!cfg?.enabled) return null
              const showCommunity = Boolean(cfg.communityEnabled && String(cfg.communityUrl || '').trim())
              const rawItems = Array.isArray(cfg.items)
                ? cfg.items
                : cfg.items && typeof cfg.items === 'object'
                  ? Object.values(cfg.items)
                  : []
              const activeItems = rawItems.filter((i) => i?.enabled && String(i?.url || '').trim())
              if (!showCommunity && activeItems.length === 0) return null
              return (
                <div className="pt-4 mt-2 border-t border-[var(--border-default)]/70 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Join Community &amp; Connect with Crafture
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {showCommunity && (
                      <motion.a
                        href={cfg.communityUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -2 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                        className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-xs transition-colors no-underline cursor-pointer"
                      >
                        <UsersThree size={15} weight="fill" />
                        <span>{cfg.communityLabel || 'Join Our Community'}</span>
                        <ArrowRight size={13} weight="bold" />
                      </motion.a>
                    )}

                    {activeItems.map((item) => {
                      const lowerHint = `${item.iconType || ''} ${item.label || ''} ${item.url || ''}`.toLowerCase()
                      const resolvedType = lowerHint.includes('linkedin')
                        ? 'linkedin'
                        : lowerHint.includes('instagram')
                          ? 'instagram'
                          : lowerHint.includes('youtube') || lowerHint.includes('youtu.be')
                            ? 'youtube'
                            : 'website'
                      return (
                        <motion.a
                          key={item.key || item.label}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ y: -2 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                          className="group min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-emerald-400/60 text-xs font-semibold text-[var(--text-primary)] shadow-2xs transition-colors no-underline cursor-pointer"
                        >
                          {item.customLogoUrl ? (
                            <img src={item.customLogoUrl} alt="" className="w-4 h-4 rounded-xs object-contain" />
                          ) : resolvedType === 'linkedin' ? (
                            <LinkedinLogo size={15} weight="fill" className="text-[#0A66C2]" />
                          ) : resolvedType === 'instagram' ? (
                            <InstagramLogo size={15} weight="fill" className="text-[#E1306C]" />
                          ) : resolvedType === 'youtube' ? (
                            <YoutubeLogo size={15} weight="fill" className="text-[#DC2626]" />
                          ) : (
                            <Globe size={14} weight="bold" className="text-emerald-600" />
                          )}
                          <span>{item.label}</span>
                          <ArrowUpRight size={13} weight="bold" className="text-[var(--text-muted)] group-hover:text-emerald-600 transition-colors" />
                        </motion.a>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
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
            <div className="relative w-full max-w-xs dark:rounded-2xl dark:bg-[#102118] border border-emerald-500/10 dark:border-[#1B3326] dark:p-3 dark:shadow-sm">
              <img
                src={strategySessionImg}
                alt="1-on-1 Strategy Session"
                className="w-full h-auto object-contain mix-blend-multiply dark:mix-blend-normal [mask-image:linear-gradient(to_right,transparent_0%,black_18%,black_95%,transparent_100%)] dark:[mask-image:none]"
              />
            </div>
          </div>
        </div>
      </SpotlightCard>
    </section>
  )
}
