import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  X,
  LockKeyOpen,
  CalendarBlank,
  WhatsappLogo,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
} from '@phosphor-icons/react'
import { trackEvent } from '../lib/posthog'
import { SpotlightCard, MagnetButton } from './motion'

const DEFAULT_HEADLINE = '50% Preview — Unlock Your Complete Career GPS Report & Updated ATS Resume'
const DEFAULT_SUBTEXT =
  'Book your free 15-min strategy call or message us on WhatsApp to unlock all bullet rewrites, missing keywords, LinkedIn positioning & your updated ATS resume.'

export default function UnlockModal({
  isOpen,
  onClose,
  contextLabel = '',
  teaserSettings = {},
  candidateName = 'Candidate',
  targetRole = 'your target role',
  healthScore = 72,
  onBookCall,
}) {
  const dialogRef = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Sync native close (Esc, closedby="any", form method="dialog") with React state
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      if (isOpen && typeof onClose === 'function') {
        onClose()
      }
    }

    // Safari fallback for closedby="any" backdrop click
    let pressedOutside = false
    const isOutside = (e) => {
      const r = dialog.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }
    const handlePointerDown = (e) => {
      pressedOutside = isOutside(e)
    }
    const handlePointerUp = (e) => {
      if (pressedOutside && isOutside(e) && dialog.open) {
        dialog.close()
      }
      pressedOutside = false
    }

    dialog.addEventListener('close', handleClose)
    dialog.addEventListener('pointerdown', handlePointerDown)
    dialog.addEventListener('pointerup', handlePointerUp)
    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('pointerdown', handlePointerDown)
      dialog.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isOpen, onClose])

  const bookingUrl =
    teaserSettings?.bookingUrl ||
    teaserSettings?.callBookingUrl ||
    'https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe'
  const ctaHeadline = teaserSettings?.ctaHeadline || DEFAULT_HEADLINE
  const ctaSubtext = teaserSettings?.ctaSubtext || DEFAULT_SUBTEXT
  const ctaButtonLabel = teaserSettings?.ctaButtonLabel || 'Book Free 1:1 Strategy Call'

  const cleanWa = String(
    teaserSettings?.whatsappNumber || teaserSettings?.whatsappCtaNumber || ''
  ).replace(/\D/g, '')
  const waMessage = `Hi Crafture team, I'm ${candidateName || 'a candidate'} targeting ${
    targetRole || 'my next role'
  } (Career Health Score: ${healthScore ?? 72}/100) and would like to unlock my complete Career GPS Report.`
  const whatsappUrl = cleanWa
    ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(waMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(waMessage)}`

  const unlockItems = [
    'Remaining hurting bullet diagnostics & Google XYZ rewrites',
    'All hidden high-impact ATS keywords & skills gaps',
    'Full LinkedIn About rewrite, Headlines #2–#3 & Experience upgrades',
    'Complete 30-day execution roadmap & ATS-ready .docx resume',
  ]

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="unlock-modal-title"
      className="m-0 mt-auto sm:m-auto w-full sm:max-w-md max-w-none max-h-[90vh] overflow-y-auto bg-transparent p-0 border-0 outline-none"
    >
      {isOpen && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 380, damping: 30 }
          }
          className="w-full rounded-t-2xl sm:rounded-2xl bg-[var(--surface-raised)] border border-emerald-500/25 dark:border-emerald-400/25 shadow-2xl p-5 sm:p-6 pb-7 sm:pb-6 space-y-4 text-left"
        >
          {/* Top Bar: Preview Badge + X Close */}
          <div className="flex items-center justify-between gap-2">
           

            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close unlock dialog"
              className="w-9 h-9 rounded-lg flex items-center justify-center border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-colors duration-150 cursor-pointer shrink-0"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          {/* Optional context chip */}
          {contextLabel && (
            <div className="px-3 py-1.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-secondary)]">
              Selected: <span className="font-semibold text-[var(--text-primary)]">{contextLabel}</span>
            </div>
          )}

          {/* Dynamic Headline & FOMO Subtext */}
          <div className="space-y-1.5">
            <h1
              id="unlock-modal-title"
              className="text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-snug tracking-tight"
              style={{ fontFamily: 'var(--font-head)' }}
            >
              {ctaHeadline}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {ctaSubtext}
            </p>
          </div>

          {/* What You Unlock Mini-List */}
          <SpotlightCard className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2">
            <div className="text-xs font-bold text-[var(--text-primary)]">
              What you unlock for {targetRole || 'your target role'}:
            </div>
            <ul className="space-y-1.5">
              {unlockItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-[var(--text-secondary)] leading-snug">
                  <CheckCircle size={15} weight="fill" className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </SpotlightCard>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <MagnetButton
              as="a"
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (typeof onBookCall === 'function') onBookCall()
              }}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors duration-150 no-underline cursor-pointer"
            >
              <CalendarBlank size={17} weight="bold" />
              <span>{ctaButtonLabel}</span>
              <ArrowRight size={14} weight="bold" />
            </MagnetButton>

            <MagnetButton
              as="a"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('whatsapp_cta_clicked', { source: 'unlock_modal', targetRole })}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors duration-150 no-underline cursor-pointer"
            >
              <WhatsappLogo size={17} weight="fill" />
              <span>Connect on WhatsApp</span>
            </MagnetButton>
          </div>

          {/* Trust Footer */}
          <div className="pt-1 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
            <ShieldCheck size={14} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
            <span>100% Free • Instant Unlock After Call</span>
          </div>
        </motion.div>
      )}
    </dialog>
  )
}
