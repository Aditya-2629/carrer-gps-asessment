import { motion } from 'framer-motion'

export default function BlurText({
  text = '',
  delay = 0.05,
  className = '',
  animateBy = 'words',
  once = true,
  as: Component = 'span',
}) {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('')

  return (
    <Component className={`inline-block ${className}`}>
      {elements.map((el, index) => (
        <motion.span
          key={index}
          initial={{ filter: 'blur(10px)', opacity: 0, y: 10 }}
          whileInView={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          viewport={{ once, amount: 0.1 }}
          transition={{
            duration: 0.45,
            delay: index * delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block"
        >
          {el}
          {animateBy === 'words' && index < elements.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </Component>
  )
}
