import { CalendarBlank, Clock, Sparkle, ArrowRight, Printer } from '@phosphor-icons/react'

function safeText(val, fallback = '') {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return val.text || val.statement || val.value || val.cta || fallback
  return fallback
}

export default function FinalNextAction({ coachData, onBookCall }) {
  const urgency = safeText(
    coachData?.urgency_statement,
    'Self-guided job searches currently average 6–9 months in this market.'
  )
  const valueProp = safeText(
    coachData?.value_prop,
    'Working directly with our senior talent partner eliminates ATS blind spots and matches you to unlisted direct recruiter pipelines.'
  )
  const ctaText = safeText(coachData?.cta_text, 'Book Free 1-on-1 Strategy Call')

  return (
    <section id="next-action" className="pt-4 pb-8">
      <div className="p-8 sm:p-11 rounded-3xl bg-[var(--surface-card)] border-2 border-[var(--primary)]/30 relative overflow-hidden shadow-lg text-center space-y-6">
        {/* Soft Indigo Gradient Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--primary)]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold uppercase tracking-wider text-[var(--primary)] border border-[var(--primary)]/25">
            <Sparkle size={14} weight="fill" />
            <span>Recommended Next Move</span>
          </div>

          <div className="space-y-2">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-head)' }}
            >
              Your next best move
            </h2>
            <p className="text-base sm:text-lg font-bold text-[var(--primary)]">
              Rewrite your resume's top 5 achievement bullets using quantified STAR metrics.
            </p>
          </div>

          {/* Why & Estimated Effort Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-1">
            <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Why this move first
              </span>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                Directly resolves your 95% funnel drop-off between applications and recruiter calls.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block flex items-center gap-1">
                <Clock size={12} />
                <span>Estimated Effort</span>
              </span>
              <p className="text-xs sm:text-sm text-[var(--text-primary)] font-bold">
                30 – 45 minutes of focused editing
              </p>
            </div>
          </div>

          {/* Urgency & Coach Value Prop */}
          <div className="space-y-1.5 text-xs sm:text-sm text-[var(--text-muted)] font-medium">
            <p className="text-[var(--text-secondary)]">{urgency}</p>
            <p>{valueProp}</p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onBookCall}
              className="btn-primary text-sm sm:text-base px-8 py-3.5 no-underline inline-flex items-center gap-2.5 shadow-md hover:scale-[1.02] transition-transform cursor-pointer"
            >
              <CalendarBlank size={20} weight="bold" />
              <span>{ctaText}</span>
            </a>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] hover:bg-[var(--surface-sunken)] text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <Printer size={16} />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
