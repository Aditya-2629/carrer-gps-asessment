import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export default function BorderBeam({
  className = '',
  size = 140,
  duration = 7,
  borderWidth = 1.5,
  colorFrom = '#22C55E',
  colorTo = '#15803D',
  delay = 0,
}) {
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const updateSize = () => {
      if (el) {
        setDimensions({
          width: el.clientWidth,
          height: el.clientHeight,
        })
      }
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { width, height } = dimensions
  const perimeter = 2 * (width + height)
  const beamLength = Math.min(size, Math.max(60, perimeter * 0.35))
  const gradientId = useRef(`beam-gradient-${Math.random().toString(36).slice(2, 9)}`).current

  if (reduceMotion) {
    return (
      <div
        className={`pointer-events-none absolute inset-0 rounded-[inherit] border border-[#15803D]/40 dark:border-emerald-500/40 ${className}`}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}
      aria-hidden="true"
    >
      {perimeter > 0 && (
        <svg
          className="absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colorFrom} stopOpacity="1" />
              <stop offset="70%" stopColor={colorTo} stopOpacity="0.8" />
              <stop offset="100%" stopColor={colorTo} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.rect
            x={borderWidth / 2}
            y={borderWidth / 2}
            width={Math.max(0, width - borderWidth)}
            height={Math.max(0, height - borderWidth)}
            rx="14"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={borderWidth}
            strokeDasharray={`${beamLength} ${perimeter - beamLength}`}
            animate={{
              strokeDashoffset: [0, -perimeter],
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease: 'linear',
              delay,
            }}
          />
        </svg>
      )}
    </div>
  )
}
