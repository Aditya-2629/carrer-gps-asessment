import { useEffect, useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export default function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  pathColor = 'rgba(21, 128, 61, 0.16)',
  pathWidth = 1.5,
  pathOpacity = 0.2,
  gradientStartColor = '#15803D',
  gradientStopColor = '#22C55E',
  delay = 0,
  duration = 3,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  className = '',
}) {
  const id = useId()
  const [pathD, setPathD] = useState('')
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })
  const reduceMotion = useReducedMotion()

  const updatePath = () => {
    if (!containerRef?.current || !fromRef?.current || !toRef?.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const fromRect = fromRef.current.getBoundingClientRect()
    const toRect = toRef.current.getBoundingClientRect()

    const startX = fromRect.left - containerRect.left + fromRect.width / 2 + startXOffset
    const startY = fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset
    const endX = toRect.left - containerRect.left + toRect.width / 2 + endXOffset
    const endY = toRect.top - containerRect.top + toRect.height / 2 + endYOffset

    const controlY = startY - curvature
    const d = `M ${startX} ${startY} Q ${(startX + endX) / 2} ${controlY} ${endX} ${endY}`

    setPathD(d)
    setSvgDimensions({
      width: containerRect.width,
      height: containerRect.height,
    })
  }

  useEffect(() => {
    updatePath()
    const handleResize = () => updatePath()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset])

  if (!pathD) return null

  return (
    <svg
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none absolute left-0 top-0 transform-gpu ${className}`}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
      aria-hidden="true"
    >
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      {!reduceMotion && (
        <>
          <defs>
            <motion.linearGradient
              className="transform-gpu"
              id={id}
              gradientUnits="userSpaceOnUse"
              initial={{
                x1: '0%',
                x2: '0%',
                y1: '0%',
                y2: '0%',
              }}
              animate={{
                x1: reverse ? ['100%', '0%'] : ['0%', '100%'],
                x2: reverse ? ['90%', '-10%'] : ['0%', '100%'],
                y1: reverse ? ['100%', '0%'] : ['0%', '100%'],
                y2: reverse ? ['90%', '-10%'] : ['0%', '100%'],
              }}
              transition={{
                delay,
                duration,
                ease: [0.16, 1, 0.3, 1],
                repeat: Infinity,
                repeatDelay: 0.2,
              }}
            >
              <stop stopColor={gradientStartColor} stopOpacity="0" />
              <stop stopColor={gradientStartColor} />
              <stop offset="32.5%" stopColor={gradientStopColor} />
              <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
            </motion.linearGradient>
          </defs>
          <path
            d={pathD}
            stroke={`url(#${id})`}
            strokeWidth={pathWidth * 1.6}
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  )
}
