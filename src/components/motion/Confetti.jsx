import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import confetti from 'canvas-confetti'

export const CRAFTURE_CONFETTI_COLORS = [
  '#15803D', // Forest Green Primary
  '#22C55E', // Light Emerald
  '#10B981', // Crisp Teal-Emerald
  '#34D399', // Mint Accent
  '#FBBF24', // Amber Celebration Sparkle
]

const Confetti = forwardRef(function Confetti(
  {
    options = {},
    globalOptions = { resize: true, useWorker: true },
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
        ...globalOptions,
        resize: true,
      })
    }

    return () => {
      try {
        confettiInstanceRef.current?.reset()
      } catch (_e) {}
    }
  }, [globalOptions])

  const fire = useCallback(
    (opts = {}) => {
      const mergedOptions = {
        particleCount: 65,
        spread: 70,
        origin: { y: 0.6 },
        colors: CRAFTURE_CONFETTI_COLORS,
        disableForReducedMotion: true,
        ...options,
        ...opts,
      }

      if (confettiInstanceRef.current) {
        return confettiInstanceRef.current(mergedOptions)
      }
      return confetti(mergedOptions)
    },
    [options]
  )

  useImperativeHandle(
    ref,
    () => ({
      fire,
      reset: () => confettiInstanceRef.current?.reset(),
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
