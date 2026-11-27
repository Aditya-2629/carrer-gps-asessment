import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import confetti from 'canvas-confetti'

export const CRAFTURE_CONFETTI_COLORS = [
  '#15803D', // Forest Green Primary
  '#22C55E', // Light Emerald
  '#10B981', // Crisp Teal-Emerald
  '#34D399', // Mint Accent
  '#FBBF24', // Amber Celebration Sparkle
]

const DEFAULT_GLOBAL_OPTIONS = { resize: true, useWorker: false }

/**
 * Direct celebration burst helper that fires onto document.body with Crafture branding.
 */
export function fireConfetti(opts = {}) {
  const mergedOptions = {
    particleCount: 65,
    spread: 70,
    origin: { y: 0.6 },
    colors: CRAFTURE_CONFETTI_COLORS,
    disableForReducedMotion: true,
    zIndex: 9999,
    ...opts,
  }
  return confetti(mergedOptions)
}

const Confetti = forwardRef(function Confetti(
  {
    options = {},
    globalOptions = DEFAULT_GLOBAL_OPTIONS,
    manualstart = true,
    className = 'pointer-events-none fixed inset-0 z-50 w-full h-full',
    ...rest
  },
  ref
) {
  const canvasRef = useRef(null)
  const confettiInstanceRef = useRef(null)

  useEffect(() => {
    if (canvasRef.current) {
      confettiInstanceRef.current = confetti.create(canvasRef.current, {
        ...DEFAULT_GLOBAL_OPTIONS,
        ...globalOptions,
      })
    }
    // Intentionally no unmount reset: allows active celebratory particles to finish falling gracefully
  }, [globalOptions])

  const fire = useCallback(
    (opts = {}) => {
      const mergedOptions = {
        particleCount: 65,
        spread: 70,
        origin: { y: 0.6 },
        colors: CRAFTURE_CONFETTI_COLORS,
        disableForReducedMotion: true,
        zIndex: 9999,
        ...options,
        ...opts,
      }

      // Fire via canvas-confetti directly on document.body so particles persist smoothly across screen/route unmounts
      return confetti(mergedOptions)
    },
    [options]
  )

  useImperativeHandle(
    ref,
    () => ({
      fire,
      reset: () => {
        try {
          confettiInstanceRef.current?.reset()
          confetti.reset()
        } catch (_e) {}
      },
    }),
    [fire]
  )

  useEffect(() => {
    if (!manualstart) {
      fire()
    }
  }, [manualstart, fire])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      {...rest}
    />
  )
})

export default Confetti
