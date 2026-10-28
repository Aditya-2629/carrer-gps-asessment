import { useMemo } from 'react'
import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'
import {
  ArrowRight,
  WarningCircle,
  CheckCircle,
  PaperPlaneTilt,
  PhoneCall,
  Code,
  UsersThree,
  Trophy,
  ShieldCheck,
  Robot,
  Briefcase,
  IdentificationCard,
  Compass,
} from '@phosphor-icons/react'
import { extractQuantMetric, decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'

export default function FunnelAndConversionSection({ funnelData, rejectionData, riskData }) {
  const formData = useAppStore((s) => s.formData) || {}
  const storeReport = useAppStore((s) => s.reportData) || {}
  const answers = storeReport?.user_answers || formData || {}

  // 1. Extract Candidate Real Numbers across all 8 funnel dimensions
  const f90 = answers.funnel90d || {}
  const apps30d = extractQuantMetric(answers.apps30d ?? (answers.appsWeek ? answers.appsWeek * 4.33 : null), 20, 'month').rawNum
  const totalApps90d = Number(f90.applications90d || apps30d * 3 || 60)
  const screens = Number(f90.recruiterScreens ?? f90.screens ?? answers.interviews ?? answers.humanScreen ?? 0)
  const assessments = Number(f90.assessments ?? 0)
  const aiInterviews = Number(f90.aiInterviews ?? 0)
  const combinedScreens = screens + assessments + aiInterviews
  const technicalRounds = Number(f90.technicalRounds ?? f90.assessments ?? 0)
  const finalRounds = Number(f90.finalRounds ?? f90.finals ?? 0)
  const offers = Number(f90.offers ?? 0)
  const joiningStatus = String(f90.joiningStatus || answers.joiningStatus || 'No Offer Yet')

  // 2. Conversion Velocity Rates
  const screenRate = totalApps90d > 0 ? ((combinedScreens / totalApps90d) * 100).toFixed(1) : '0.0'
  const techToFinalRate = technicalRounds > 0 ? ((finalRounds / technicalRounds) * 100).toFixed(0) : '0'
  const finalToOfferRate = finalRounds > 0 ? ((offers / finalRounds) * 100).toFixed(0) : '0'

  // 3. Drop-Off Gate Resolution
  const phaseId = Number(storeReport?.phase?.id ?? 1)
  const phaseName = storeReport?.phase?.name ?? 'Application → Screening'

  const FUNNEL_STAGES = [
    {
      id: 1,
      name: 'Applications',
      count: totalApps90d,
      unit: 'sent (90d)',
      icon: PaperPlaneTilt,
      color: '#3b82f6',
      isDropOffGate: phaseId === 1,
      dropOffLabel: 'Phase 1 Gate: Drop-off before screens',
    },
    {
      id: 2,
      name: 'Recruiter Screens',
      count: screens,
      unit: 'recruiter calls',
      icon: PhoneCall,
      color: 'var(--primary)',
      isDropOffGate: phaseId === 2,
      dropOffLabel: 'Phase 2 Gate: Drop-off after screens',
    },
    {
      id: 3,
      name: 'OAs & AI Screens',
      count: assessments + aiInterviews,
      unit: 'coding tests & video',
      icon: Robot,
      color: '#06b6d4',
      isDropOffGate: phaseId === 2 && assessments > 0,
      dropOffLabel: 'OA / CodeSignal Assessment Drop-off',
    },
    {
      id: 4,
      name: 'Technical Rounds',
      count: technicalRounds,
      unit: 'live tech panels',
      icon: Code,
      color: '#8b5cf6',
      isDropOffGate: phaseId === 3,
      dropOffLabel: 'Phase 3 Gate: Live coding / System design stall',
    },
    {
      id: 5,
      name: 'Final Rounds',
      count: finalRounds,
      unit: 'manager / onsite',
      icon: UsersThree,
      color: '#ec4899',
      isDropOffGate: phaseId === 4,
      dropOffLabel: 'Phase 4 Gate: Final round closing gap',
    },
    {
      id: 6,
      name: 'Offers & Joining',
      count: offers,
      unit: joiningStatus === 'No Offer Yet' ? 'offers' : joiningStatus,
      icon: Trophy,
      color: 'var(--emerald)',
      isDropOffGate: phaseId === 5,
      dropOffLabel: 'Phase 5 Gate: Offer verification / onboarding block',
    },
  ]

  // 4. External SDLC & Consultancy Context Strip
  const ext = storeReport?.external_context || {}
  const sdlc = ext.sdlc_market_cycle || {
    title: 'Core Software & Engineering Wave',
    currentQuarter: 'Q4',
  }
  const visaText = decodeHtmlEntities(answers.visa || 'US Citizen / Green Card / GC-EAD')
  const expText = decodeHtmlEntities(answers.experience || 'Mid–Senior / 4–7 Yrs Experience')
  const consultancy = ext.consultancy_context || {
    mode: /C2C/i.test(answers.externalHelp) ? 'C2C Consultancy / Bench' : 'Solo Search',
    description: '100% self-directed application pipeline',
  }

  // 5. Verified Technical Skills (cleanly formatted in Title Case)
  const rawSkills =
    storeReport?.resume_agent?.canonicalResume?.skills ||
    storeReport?.resume_json?.top_skills ||
    storeReport?.resume_json?.skills ||
    []
  const formatTitleCase = (s) => {
    if (!s) return ''
    const str = typeof s === 'string' ? s : s?.name || ''
    const decoded = decodeHtmlEntities(str)
    return decoded
      .replace(/[_-]/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
  }
  const topSkills = (Array.isArray(rawSkills) ? rawSkills : [])
    .map(formatTitleCase)
    .filter(Boolean)
  const skillsDisplay = topSkills.slice(0, 3).join(', ')

  return (
    <section id="funnel-risks" className="space-y-6 break-before-page page-break-before-always">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[var(--border-default)] pb-4 break-inside-avoid page-break-inside-avoid">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
            Inside The Hiring Funnel
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            90-Day Funnel Outcomes & Conversion Velocity
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Benchmarked against 1,000+ technical candidate pipelines in your target role{skillsDisplay ? ` (${skillsDisplay})` : ''}
        </p>
      </div>

      {/* 1. Compact 90-Day 8-Stage Funnel & Conversion Bar */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs space-y-5 break-inside-avoid page-break-inside-avoid print-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            90-Day Stage Progression & Drop-Off Gate
          </span>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-muted)]">
            Active Stuck Point: <strong className="text-[var(--primary)]">Phase {phaseId}</strong>
          </span>
        </div>

        {/* Responsive Stage Progression Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {FUNNEL_STAGES.map((stg, idx) => {
            const Icon = stg.icon
            return (
              <div
                key={stg.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all relative ${
                  stg.isDropOffGate
                    ? 'bg-rose-500/10 border-rose-500/40 shadow-xs'
                    : 'bg-[var(--surface-sunken)] border-[var(--border-default)]'
                }`}
              >
                {stg.isDropOffGate && (
                  <span className="absolute -top-2.5 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-rose-600 text-white shadow-2xs">
                    Drop-off Gate
                  </span>
                )}

                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${stg.color}18`, color: stg.color }}
                  >
                    <Icon size={15} weight="bold" />
                  </div>
                  <span className="text-lg font-black font-mono text-[var(--text-primary)]">
                    {stg.count}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                    {stg.name}
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                    {stg.unit}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* 3-Pillar Conversion Velocity Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--border-default)]">
          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Application → Screen Conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black font-mono ${Number(screenRate) >= 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {screenRate}%
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">Target: &gt;5.0%</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Technical → Final Conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black font-mono ${Number(techToFinalRate) >= 40 ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>
                {techToFinalRate}%
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">Target: &gt;40%</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Final Round → Offer Conversion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black font-mono ${Number(finalToOfferRate) > 0 ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>
                {finalToOfferRate}%
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">Target: &gt;30%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Personalization Context Strip (SDLC Wave, Visa, Experience, Consultancy) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
          Strategic Market Perimeter & Sourcing Context
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* SDLC Market Wave */}
          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] block mb-1">
              SDLC Market Wave ({sdlc.currentQuarter || 'Q4'})
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">
              {sdlc.title}
            </p>
          </div>

          {/* Visa Status */}
          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#06b6d4] block mb-1">
              Work Authorization
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">
              {visaText}
            </p>
          </div>

          {/* Seniority Tier */}
          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b5cf6] block mb-1">
              Experience Level
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">
              {expText}
            </p>
          </div>

          {/* Consultancy Mode */}
          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block mb-1">
              Search Pipeline Model
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">
              {consultancy.mode}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
