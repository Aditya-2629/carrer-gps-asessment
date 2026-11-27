import { motion } from 'framer-motion'

export default function AnimatedContent({
  children,
  distance = 14,
  direction = 'vertical',
  delay = 0,
  duration = 0.38,
  className = '',
  viewport = { once: true, amount: 0.1 },
  ...rest
}) {
  const isVertical = direction === 'vertical'

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: isVertical ? distance : 0,
        x: isVertical ? 0 : distance,
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
