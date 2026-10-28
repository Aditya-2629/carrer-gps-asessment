import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Target,
  ShareNetwork,
  UsersThree,
  Funnel,
  RocketLaunch,
  CaretDown,
  CaretUp,
  CheckCircle,
  WarningCircle,
  ShieldCheck,
} from '@phosphor-icons/react'
import { computeCareerGpsScore } from '../../../backend/agents/assessment/assessmentAgent'

export default function CareerHealthSnapshot({ reportData, onNavigateSection }) {
  const [expandedArea, setExpandedArea] = useState(null)

  // Resolve V2 6-Area Weighted Scores
  const computedScores = reportData?.gps_scores?.areas || (() => {
    try {
      const res = computeCareerGpsScore({
        answers: reportData?.user_answers || {},
        resumeAgent: reportData?.resume_agent,
        linkedinAgent: reportData?.linkedin_agent,
      })
      return res.areas
    } catch (_e) {
      return null
    }
  })()

  const resumeArea = computedScores?.resume || {
    points: Math.round(((reportData?.resume_agent?.dashboard?.score || 70) / 100) * 25),
    maxPoints: 25,
    title: 'Resume / Career Documents',
    percentage: 70,
    checks: [],
  }

  const isLinkedInUnlinked = !reportData?.linkedin_agent || reportData?.linkedin_agent?.dataAvailable === false

  const rawTier = isLinkedInUnlinked
    ? 'Unverified (Unlinked)'
    : (reportData?.linkedin_agent?.consistencyTier ||
       reportData?.assessment_agent?.scores?.linkedin?.consistencyTier ||
       reportData?.gps_scores?.linkedin?.consistencyTier ||
       computedScores?.linkedin?.consistencyTier ||
       'Strong Match')

  const consistencyTier = typeof rawTier === 'object' ? (rawTier?.badge || rawTier?.tier || 'Strong Match') : String(rawTier || 'Strong Match')

  const linkedinArea = computedScores?.linkedin || {
    points: Math.round(((reportData?.linkedin_agent?.score || 65) / 100) * 15),
    maxPoints: 15,
    title: 'LinkedIn / Professional Brand',
    percentage: 65,
    consistencyTier,
    checks: [],
  }

  const jobSearchArea = computedScores?.jobSearch || {
    points: 14,
    maxPoints: 20,
    title: 'Job Search & Application Strategy',
    percentage: 70,
    checks: [],
  }

  const networkingArea = computedScores?.networking || {
    points: 9,
    maxPoints: 15,
    title: 'Networking & Referral Velocity',
    percentage: 60,
    checks: [],
  }

  const hiringFunnelArea = computedScores?.hiringFunnel || {
    points: 13,
    maxPoints: 20,
    title: 'Interview & Hiring Funnel',
    percentage: 65,
    checks: [],
  }

  const careerReadinessArea = computedScores?.careerReadiness || {
    points: 4,
    maxPoints: 5,
    title: 'Career Readiness & Execution',
    percentage: 80,
    checks: [],
  }

  const AREA_CARDS = [
    {
      id: 'resume',
      title: 'Resume / Career Documents',
      points: resumeArea.points,
      maxPoints: 25,
      percentage: Math.round((resumeArea.points / 25) * 100),
      icon: FileText,
      color: resumeArea.points >= 18 ? 'var(--emerald)' : resumeArea.points >= 13 ? '#f59e0b' : '#ef4444',
      badgeClass: resumeArea.points >= 18 ? 'bg-emerald-500/10 text-[var(--emerald)] border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      explanation: 'Evaluates target-role keyword alignment, Google XYZ impact quantification, ATS readability, and section completeness.',
      targetSection: 'resume-ai',
      checks: resumeArea.checks || [],
    },
    {
      id: 'linkedin',
      title: 'LinkedIn / Professional Brand',
      points: linkedinArea.points,
      maxPoints: 15,
      percentage: Math.round((linkedinArea.points / 15) * 100),
      icon: Target,
      color: linkedinArea.points >= 11 ? 'var(--emerald)' : linkedinArea.points >= 8 ? '#f59e0b' : '#ef4444',
      badgeClass: linkedinArea.points >= 11 ? 'bg-emerald-500/10 text-[var(--emerald)] border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      consistencyTier,
      explanation: 'Evaluates headline keyword searchability, proof of work, recruiter indexing, and cross-document timeline consistency.',
      targetSection: 'linkedin-ai',
      checks: linkedinArea.checks || [],
    },
    {
      id: 'jobSearch',
      title: 'Job Search & Application Strategy',
      points: jobSearchArea.points,
      maxPoints: 20,
      percentage: Math.round((jobSearchArea.points / 20) * 100),
      icon: ShareNetwork,
      color: jobSearchArea.points >= 15 ? 'var(--emerald)' : jobSearchArea.points >= 10 ? '#f59e0b' : '#ef4444',
      badgeClass: jobSearchArea.points >= 15 ? 'bg-emerald-500/10 text-[var(--emerald)] border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      explanation: 'Evaluates application match percentage, multi-channel sourcing, company research, and sustainable outbound pace.',
      targetSection: 'funnel-risks',
      checks: jobSearchArea.checks || [],
    },
    {
      id: 'networking',
      title: 'Networking & Referral Velocity',
      points: networkingArea.points,
      maxPoints: 15,
      percentage: Math.round((networkingArea.points / 15) * 100),
      icon: UsersThree,
      color: networkingArea.points >= 11 ? 'var(--emerald)' : networkingArea.points >= 7 ? '#f59e0b' : '#ef4444',
      badgeClass: networkingArea.points >= 11 ? 'bg-emerald-500/10 text-[var(--emerald)] border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      explanation: 'Evaluates proactive recruiter outreach, warm referral requests, and regular hiring manager follow-up habits.',
      targetSection: 'funnel-risks',
      checks: networkingArea.checks || [],
    },
    {
      id: 'hiringFunnel',
      title: 'Interview & Hiring Funnel',
      points: hiringFunnelArea.points,
      maxPoints: 20,
      percentage: Math.round((hiringFunnelArea.points / 20) * 100),
      icon: Funnel,
      color: hiringFunnelArea.points >= 15 ? 'var(--emerald)' : hiringFunnelArea.points >= 10 ? '#f59e0b' : '#ef4444',
      badgeClass: hiringFunnelArea.points >= 15 ? 'bg-emerald-500/10 text-[var(--emerald)] border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      explanation: 'Measures conversion rates across Application → Screen, Screen → Technical, and Technical → Final Offer stages.',
      targetSection: 'funnel-risks',
      checks: hiringFunnelArea.checks || [],
    },
    {
      id: 'careerReadiness',
      title: 'Career Readiness & Execution',
      points: careerReadinessArea.points,
      maxPoints: 5,
      percentage: Math.round((careerReadinessArea.points / 5) * 100),
      icon: RocketLaunch,
      color: careerReadinessArea.points >= 4 ? 'var(--emerald)' : careerReadinessArea.points >= 3 ? '#f59e0b' : '#ef4444',
      badgeClass: careerReadinessArea.points >= 4 ? 'bg-emerald-500/10 text-[var(--emerald)] border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      explanation: 'Assesses career target clarity, interview rehearsal commitment, and proactive strategy adaptability.',
      targetSection: 'roadmap',
      checks: careerReadinessArea.checks || [],
    },
  ]

  const toggleExpand = (id) => {
    setExpandedArea((prev) => (prev === id ? null : id))
  }

  return (
    <section id="snapshot" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
            100-Point Weighted Scoring Rubric
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            6 Weighted Career GPS Areas
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Deterministic point allocation across your documents, sourcing channels, and interview conversion
        </p>
      </div>

      {/* 6-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AREA_CARDS.map((card) => {
          const Icon = card.icon
          const isExpanded = expandedArea === card.id
          const hasChecks = Array.isArray(card.checks) && card.checks.length > 0

          return (
            <div
              key={card.id}
              className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-all flex flex-col justify-between shadow-xs break-inside-avoid page-break-inside-avoid"
            >
              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-[var(--border-default)]"
                      style={{ backgroundColor: `${card.color}15`, color: card.color }}
                    >
                      <Icon size={18} weight="bold" />
                    </div>
                    <span className="text-xs font-bold font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      Area Scorecard
                    </span>
                  </div>

                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${card.badgeClass}`}>
                    {card.percentage}%
                  </span>
                </div>

                {/* Title & Points */}
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-snug">
                    {card.title}
                  </h3>
                  <div className="flex items-baseline gap-1 shrink-0 ml-2">
                    <span className="text-lg font-black text-[var(--text-primary)] font-mono">
                      {card.points}
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
                      /{card.maxPoints} pts
                    </span>
                  </div>
                </div>

                {/* 4-Tier Consistency Badge for LinkedIn */}
                {card.id === 'linkedin' && (
                  <div className={`mb-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                    card.consistencyTier?.includes('Unverified')
                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400'
                  }`}>
                    <ShieldCheck size={14} weight="fill" />
                    <span className="font-semibold text-xs">Consistency: {card.consistencyTier || 'Strong Match'}</span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[var(--surface-sunken)] rounded-full overflow-hidden mb-3 border border-[var(--border-subtle)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(5, card.percentage))}%`,
                      backgroundColor: card.color,
                    }}
                  />
                </div>

                {/* Plain-English Explanation */}
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                  {card.explanation}
                </p>
              </div>

              {/* Sub-check Accordion Toggle */}
              <div className="pt-3 border-t border-[var(--border-subtle)] mt-2">
                {hasChecks && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(card.id)}
                    className="w-full flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors py-1 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide sub-checks' : `View ${card.checks.length} sub-checks`}</span>
                    {isExpanded ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
                  </button>
                )}

                <AnimatePresence>
                  {isExpanded && hasChecks && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-1.5 pt-2 text-[11px] overflow-hidden"
                    >
                      {card.checks.map((chk, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center justify-between py-1 px-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                        >
                          <span className="truncate mr-2">{chk.name}</span>
                          <span className="font-mono font-bold shrink-0 text-[var(--text-primary)]">
                            {chk.points}/{chk.max} pt
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
