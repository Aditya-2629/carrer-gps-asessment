import { forwardRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const ShimmerButton = forwardRef(function ShimmerButton(
  {
    children,
    as: Component = 'button',
    className = '',
    shimmerColor = 'rgba(255, 255, 255, 0.28)',
    shimmerDuration = 3,
    disabled = false,
    onClick,
    ...props
  },
  ref
) {
  const reduceMotion = useReducedMotion()
  const MotionComponent = Component === 'a' ? motion.a : motion.button

  return (
    <MotionComponent
      ref={ref}
      whileHover={disabled || reduceMotion ? {} : { scale: 1.02 }}
      whileTap={disabled || reduceMotion ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-semibold text-sm transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg ${className}`}
      {...props}
    >
      {/* Moving Shimmer Reflection */}
      {!reduceMotion && !disabled && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full"
          animate={{
            transform: ['translateX(-100%)', 'translateX(200%)'],
          }}
          transition={{
            duration: shimmerDuration,
            repeat: Infinity,
            repeatDelay: 1.2,
            ease: [0.4, 0, 0.2, 1],
          }}
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${shimmerColor} 50%, transparent 100%)`,
            width: '100%',
          }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </MotionComponent>
  )
})

export default ShimmerButton
