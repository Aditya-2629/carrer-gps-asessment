import React, { useState } from 'react'
import { Check, Sparkle, CalendarBlank, ShieldCheck, ArrowRight } from '@phosphor-icons/react'

/**
 * Smoothly scrolls to section by id (#final-cta, #next-action)
 */
const scrollToSection = (href) => {
  const id = (href || '').replace('#', '')
  if (!id) return
  const el =
    document.getElementById(id) ||
    (id === 'final-cta' ? document.getElementById('next-action') : null) ||
    (id === 'next-action' ? document.getElementById('final-cta') : null)

  if (el) {
    const pos = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: pos - 90, behavior: 'smooth' })
  }
}

/**
 * ProgramPricingCard
 *
 * Interactive Comparison Card displaying Crafture's 3 official programs:
 * - Starter ($0 / Free Forever)
 * - Career GPS AI ($150/month)
 * - Elite AI + Human Consultant ($300/month) [Highlighted / Most Popular]
 */
export function ProgramPricingCard({ onBookCall }) {
  const [activeTier, setActiveTier] = useState('elite')

  const handleConsultationCta = (e) => {
    e?.preventDefault?.()
    if (typeof onBookCall === 'function') {
      onBookCall()
    }
    scrollToSection('#final-cta')
  }

  const PROGRAMS = [
    {
      id: 'starter',
      name: 'Starter Experience',
      tagline: 'Instant diagnostic clarity',
      price: '$0',
      period: 'Free Forever',
      badge: null,
      isHighlighted: false,
      features: [
        '100-Point Weighted Career Health Scorecard',
        'ATS Resume Audit & Formatting Verification',
        'LinkedIn Cross-Diagnosis & Headline SEO',
        'Primary Funnel Choke Point Isolation',
        '7-Day Rapid Triage Checklist',
      ],
    },
    {
      id: 'ai',
      name: 'Career GPS AI',
      tagline: 'Autonomous AI execution',
      price: '$150',
      period: '/ month',
      badge: 'Self-Directed',
      isHighlighted: false,
      features: [
        'Everything in Starter Experience',
        'Dynamic Target-Role Resume Tailoring',
        'Automated 50-Word InMail Generator',
        'Interactive AI Mock Interview Drills',
        'Weekly Application Velocity Tracking',
        'Cancel anytime with zero lock-in',
      ],
    },
    {
      id: 'elite',
      name: 'Elite AI + Dedicated Coach',
      tagline: 'High-touch executive placement',
      price: '$300',
      period: '/ month',
      badge: 'Most Popular',
      isHighlighted: true,
      features: [
        'Everything in Career GPS AI',
        'Dedicated U.S.-Based Executive Talent Consultant',
        'Bi-weekly 1-on-1 Strategic Coaching Calls',
        'Live Mock Behavioral & Technical Critiques',
        'Complete Handcrafted Resume & Story Overhaul',
        'Hands-on Offer Counter-Negotiation Representation',
        'Cancel anytime with 0% placement cut',
      ],
    },
  ]

  return (
    <div className="my-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-md overflow-hidden transition-all duration-200">
      {/* Header Banner */}
      <div className="px-4 py-3 bg-[var(--surface-subtle)] border-b border-[var(--border-default)] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
            <Sparkle size={13} weight="fill" />
            Crafture Career Programs & Transparent Pricing
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-medium">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>0% Placement Fees • No Salary Cuts</span>
        </div>
      </div>

      {/* Pricing Cards Grid (Responsive 1-col on mobile, 3-col on wider viewports) */}
      <div className="p-3.5 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {PROGRAMS.map((prog) => {
          const isSelected = activeTier === prog.id
          return (
            <div
              key={prog.id}
              onClick={() => setActiveTier(prog.id)}
              className={`relative rounded-xl p-3.5 transition-all cursor-pointer flex flex-col justify-between border ${
                prog.isHighlighted
                  ? 'border-indigo-500/50 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500/30'
                  : 'border-[var(--border-default)] bg-[var(--surface-base)] hover:border-indigo-400/40'
              }`}
            >
              {/* Badge */}
              {prog.badge && (
                <div className="absolute -top-2.5 right-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-indigo-600 px-2 py-0.5 rounded-full shadow-xs">
                    {prog.badge}
                  </span>
                </div>
              )}

              <div>
                <div className="text-xs font-bold text-[var(--text-primary)] mb-0.5">
                  {prog.name}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mb-2.5">
                  {prog.tagline}
                </div>

                {/* Price Display */}
                <div className="flex items-baseline gap-1 mb-3 pb-2.5 border-b border-[var(--border-default)]">
                  <span className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] font-mono">
                    {prog.price}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">
                    {prog.period}
                  </span>
                </div>

                {/* Features List */}
                <ul className="space-y-1.5 mb-3">
                  {prog.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">
                      <Check size={12} weight="bold" className="text-emerald-500 mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Trigger */}
              <div className="pt-2">
                {prog.id === 'elite' ? (
                  <button
                    type="button"
                    onClick={handleConsultationCta}
                    className="w-full py-2 px-3 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CalendarBlank size={13} weight="bold" />
                    <span>Book 1-on-1 Consultation</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTier(prog.id)}
                    className="w-full py-1.5 px-2.5 rounded-lg text-[11px] font-medium border border-[var(--border-default)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] transition-all cursor-pointer text-center"
                  >
                    {isSelected ? 'Selected' : 'View Details'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Disclaimer & Direct Anchor */}
      <div className="px-4 py-2.5 bg-[var(--surface-subtle)] border-t border-[var(--border-default)] flex items-center justify-between flex-wrap gap-2 text-[10px] text-[var(--text-muted)]">
        <span>Transparent flat pricing. Cancel anytime. Zero hidden placement cuts.</span>
        <button
          type="button"
          onClick={handleConsultationCta}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
        >
          <span>Schedule with Executive Consultant</span>
          <ArrowRight size={12} weight="bold" />
        </button>
      </div>
    </div>
  )
}

export default ProgramPricingCard
