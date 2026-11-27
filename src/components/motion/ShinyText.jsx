import { motion, useReducedMotion } from 'framer-motion'

export default function ShinyText({
  children,
  className = '',
  speed = 3.5,
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <span className={`font-semibold ${className}`}>{children}</span>
  }

  return (
    <motion.span
      className={`relative inline-block bg-[linear-gradient(110deg,#15803D_35%,#86EFAC_50%,#15803D_65%)] dark:bg-[linear-gradient(110deg,#22C55E_35%,#F0FDF4_50%,#22C55E_65%)] bg-[length:250%_100%] bg-clip-text text-transparent ${className}`}
      animate={{
        backgroundPosition: ['200% 0', '-200% 0'],
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {children}
    </motion.span>
  )
}
