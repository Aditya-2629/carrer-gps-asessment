import { LockKey } from '@phosphor-icons/react'

function scrollToStrategyCall(bookingUrl) {
  const target = typeof document !== 'undefined' ? document.getElementById('next-action') : null
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  if (bookingUrl && typeof window !== 'undefined') {
    window.open(bookingUrl, '_blank', 'noopener,noreferrer')
  }
}

/**
 * TeaserLockBlock — Editorial, high-curiosity 50% Teaser Gate.
 *
 * Variants:
 *  - "fade" (default): Shows top ~50% clearly, masks bottom half with CSS linear-gradient
 *    and places ONE minimal frosted-glass pill below the masked area.
 *  - "inline-pill": Gently blurs ONLY the wrapped rewrite box (`blur-[4.5px]`) with a
 *    subtle right-aligned `Unlock rewrite` chip, keeping diagnostics 100% readable.
 *  - "chip-fade": Softly fades remaining items and appends a sleek `+N more unlocked on call` badge.
 */
export default function TeaserLockBlock({
  isLocked,
  variant = 'fade',
  label,
  lockedCount = 0,
  bookingUrl = '',
  heightClass = 'max-h-[340px]',
  className = '',
  children,
}) {
  if (!isLocked) return children

  if (variant === 'inline-pill') {
    return (
      <div className={`relative rounded-xl ${className}`}>
        <div
          className="blur-[4.5px] select-none pointer-events-none opacity-80"
          aria-hidden="true"
        >
          {children}
        </div>
        <div className="absolute inset-0 flex items-start justify-end p-2.5 pointer-events-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              scrollToStrategyCall(bookingUrl)
            }}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-card)]/95 backdrop-blur-sm border border-[var(--border-default)] hover:border-[var(--primary)] text-[var(--text-primary)] text-xs font-semibold shadow-xs transition-colors duration-150 cursor-pointer"
          >
            <LockKey size={12} weight="bold" className="text-[var(--primary)]" />
            <span>{label || 'Unlock rewrite'}</span>
          </button>
        </div>
      </div>
    )
  }

  if (variant === 'chip-fade') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="relative overflow-clip">
          <div
            className="opacity-45 blur-[2px] select-none pointer-events-none"
            style={{ maskImage: 'linear-gradient(to top, transparent 0%, black 80%)' }}
            aria-hidden="true"
          >
            {children}
          </div>
          <div className="mt-2 flex items-center justify-start">
            <button
              type="button"
              onClick={() => scrollToStrategyCall(bookingUrl)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-[var(--primary)] text-[var(--text-primary)] text-xs font-semibold shadow-2xs transition-colors duration-150 cursor-pointer"
            >
              <LockKey size={12} weight="bold" className="text-[var(--primary)]" />
              <span>
                {label || `+${lockedCount} more unlocked on call`}
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Default: variant="fade"
  return (
    <div className={`relative ${className}`}>
      <div
        className={`${heightClass} overflow-clip pointer-events-none select-none`}
        style={{
          maskImage: 'linear-gradient(to top, transparent 0%, rgba(0, 0, 0, 0.22) 28%, black 68%)',
        }}
        aria-hidden="true"
      >
        {children}
      </div>

      <div className="-mt-6 relative z-10 flex justify-center pb-1">
        <button
          type="button"
          onClick={() => scrollToStrategyCall(bookingUrl)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-card)]/90 backdrop-blur-md border border-[var(--border-default)] hover:border-[var(--primary)] text-[var(--text-primary)] text-xs font-semibold shadow-sm transition-colors duration-150 cursor-pointer"
        >
          <LockKey size={14} weight="bold" className="text-[var(--primary)]" />
          <span>{label || 'Unlock full rewrite in your free 15-min call →'}</span>
        </button>
      </div>
    </div>
  )
}
