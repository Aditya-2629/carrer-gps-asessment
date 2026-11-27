import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

export default function CountUp({
  to = 0,
  from = 0,
  duration = 1.2,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.1 })
  const [value, setValue] = useState(from)

  useEffect(() => {
    if (!isInView) return

    let startTime = null
    let animationFrameId = null
    const startVal = Number(from) || 0
    const endVal = Number(to) || 0
    const diff = endVal - startVal
    const durationMs = duration * 1000

    const updateCounter = (currentTime) => {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / durationMs, 1)

      // Smooth cubic-out easing: 1 - Math.pow(1 - progress, 3)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentVal = startVal + diff * easeOut

      setValue(currentVal)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCounter)
      } else {
        setValue(endVal)
      }
    }

    animationFrameId = requestAnimationFrame(updateCounter)

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [isInView, to, from, duration])

  const formatted =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString()

  return (
    <span ref={ref} className={`tabular-nums font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
