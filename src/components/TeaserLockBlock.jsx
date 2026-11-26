import { LockKey, CalendarBlank, WhatsappLogo } from '@phosphor-icons/react'

/**
 * TeaserLockBlock — reusable section-level teaser lock gate.
 *
 * Props:
 *   isLocked        {boolean}  — when false, renders children with zero wrapper overhead
 *   label           {string}   — lock card heading (e.g. "Bullet Rewrites Locked")
 *   ctaHeadline     {string}   — optional sub-headline in the lock card
 *   ctaButtonLabel  {string}   — Book Call button label
 *   bookingUrl      {string}   — href for Book Call button
 *   whatsappUrl     {string}   — full wa.me href
 *   heightClass     {string}   — Tailwind max-h class applied to blurred child container
 *   children        {ReactNode}
 */
export default function TeaserLockBlock({
  isLocked,
  label,
  ctaHeadline,
  ctaButtonLabel = 'Book Free 1:1 Strategy Call',
  bookingUrl = '',
  whatsappUrl = '',
  heightClass = 'max-h-[340px]',
  children,
}) {
  if (!isLocked) return children

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Blurred preview of children */}
      <div
        className={`${heightClass} overflow-hidden blur-[6px] select-none pointer-events-none opacity-65`}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--surface-base)]/70 to-[var(--surface-base)]/95 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-card)]/95 backdrop-blur-xl border border-[var(--border-default)] p-5 sm:p-6 text-center shadow-2xl space-y-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[var(--primary)] flex items-center justify-center mx-auto">
            <LockKey size={22} weight="fill" />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-snug">
              {label || 'Unlock Your Full Report'}
            </h3>
            {ctaHeadline && (
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {ctaHeadline}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-0.5">
            {bookingUrl && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold shadow-md transition-all no-underline cursor-pointer"
              >
                <CalendarBlank size={15} weight="bold" />
                <span>{ctaButtonLabel}</span>
              </a>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-all no-underline cursor-pointer"
              >
                <WhatsappLogo size={16} weight="fill" />
                <span>Connect on WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
