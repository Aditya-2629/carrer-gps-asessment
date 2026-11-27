import { useState, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export default function MagnetButton({
  children,
  className = '',
  strength = 0.22,
  maxDistance = 6,
  as = 'button',
  href,
  onClick,
  type = 'button',
  ...rest
}) {
  const ref = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const shouldReduceMotion = useReducedMotion()

  const handleMouseMove = (e) => {
    if (shouldReduceMotion || !ref.current) return
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    const centerX = left + width / 2
    const centerY = top + height / 2

    const dx = Math.max(-maxDistance, Math.min(maxDistance, (e.clientX - centerX) * strength))
    const dy = Math.max(-maxDistance, Math.min(maxDistance, (e.clientY - centerY) * strength))

    setPosition({ x: dx, y: dy })
  }

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }

  const MotionComponent = as === 'a' ? motion.a : motion.button

  return (
    <MotionComponent
      ref={ref}
      href={href}
      type={as === 'button' ? type : undefined}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 360, damping: 24, mass: 0.5 }}
      className={`relative inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      {...rest}
    >
      {children}
    </MotionComponent>
  )
}
