import { motion, useReducedMotion } from 'framer-motion'

export default function AnimatedContent({
  children,
  distance = 14,
  direction = 'vertical', // 'vertical' | 'forward' | 'backward' | 'none'
  delay = 0,
  duration = 0.38,
  className = '',
  viewport = { once: true, amount: 0.1 },
  ...rest
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  let initialX = 0
  let initialY = 0

  if (direction === 'vertical') {
    initialY = distance
  } else if (direction === 'forward') {
    initialX = distance * 1.5
  } else if (direction === 'backward') {
    initialX = -distance * 1.5
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: initialY,
        x: initialX,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
        x: 0,
      }}
      viewport={viewport}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
