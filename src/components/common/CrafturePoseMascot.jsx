import React, { forwardRef, useImperativeHandle, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { getMascotPose } from '../../assets/mascot'
import { X } from 'lucide-react'

// Preset sizes in pixels (width/height bounding box)
const SIZE_PRESETS = {
  xs: 48,
  sm: 72,
  md: 112,
  lg: 160,
  xl: 220,
  '2xl': 280,
}

// Bounding box dimensions mapped to presets
function resolveDimensions(size) {
  if (typeof size === 'number') return { width: size, height: size }
  if (typeof size === 'string' && SIZE_PRESETS[size]) {
    const dim = SIZE_PRESETS[size]
    return { width: dim, height: dim }
  }
  return { width: 112, height: 112 }
}

/**
 * CrafturePoseMascot
 *
 * 60fps Framer Motion + GSAP-compatible animated 3D character component
 * featuring the official Forest-Green suited Crafture Career GPS Mascot.
 */
const CrafturePoseMascot = forwardRef(function CrafturePoseMascot(
  {
    pose = 'wave',
    size = 'md',
    animation = 'float',
    bubble = null,
    bubbleChip = null,
    bubblePosition = 'top',
    bubbleVariant = 'emerald',
    showShadow = true,
    interactive = true,
    onClick,
    onDoubleClick,
    className = '',
    imgClassName = '',
    style = {},
    alt = 'Crafture Career GPS Mascot',
    priority = false,
  },
  forwardedRef
) {
  const containerRef = useRef(null)
  const [bubbleDismissed, setBubbleDismissed] = useState(false)
  const reduceMotion = useReducedMotion()

  // Expose the container DOM element so parent GSAP choreographies (like Siuuu) can tween it
  useImperativeHandle(forwardedRef, () => containerRef.current)

  const resolvedSrc = useMemo(() => getMascotPose(pose), [pose])
  const { width, height } = useMemo(() => resolveDimensions(size), [size])

  // Float & shadow animation configurations
  const isFloating = animation === 'float' && !reduceMotion
  const isWorking = animation === 'working' && !reduceMotion
  const isBouncing = animation === 'bounce' && !reduceMotion
  const isNodding = animation === 'nod' && !reduceMotion
  const isLeaning = animation === 'lean' && !reduceMotion

  // Floating variants
  const charMotionProps = useMemo(() => {
    if (reduceMotion) return {}

    if (isFloating) {
      return {
        animate: {
          y: [0, -7, 0],
          rotate: [0, 0.5, -0.5, 0],
        },
        transition: {
          duration: 3.2,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }
    }

    if (isWorking) {
      return {
        animate: {
          y: [0, -2, 0],
          rotate: [0, 0.4, 0, -0.4, 0],
        },
        transition: {
          duration: 1.8,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }
    }

    if (isBouncing) {
      return {
        animate: {
          y: [0, -10, 0],
          scaleY: [1, 1.05, 0.97, 1],
        },
        transition: {
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }
    }

    if (isNodding) {
      return {
        animate: {
          rotateX: [0, 10, 0, 8, 0],
          y: [0, 2, 0, 2, 0],
        },
        transition: {
          duration: 1.6,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }
    }

    if (isLeaning) {
      return {
        animate: {
          rotate: [0, -3, 0],
          scale: [1, 1.03, 1],
        },
        transition: {
          duration: 2.4,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }
    }

    return {}
  }, [reduceMotion, isFloating, isWorking, isBouncing, isNodding, isLeaning])

  // Floor Shadow inverse scale/opacity variant (shadow softens as character rises)
  const shadowMotionProps = useMemo(() => {
    if (reduceMotion || !isFloating) return {}

    return {
      animate: {
        scale: [1, 0.88, 1],
        opacity: [0.24, 0.12, 0.24],
      },
      transition: {
        duration: 3.2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    }
  }, [reduceMotion, isFloating])

  // Speech bubble position classes
  const bubblePositionClass = useMemo(() => {
    switch (bubblePosition) {
      case 'right':
        return 'left-full ml-3 top-1/2 -translate-y-1/2'
      case 'left':
        return 'right-full mr-3 top-1/2 -translate-y-1/2'
      case 'bottom':
        return 'top-full mt-2 left-1/2 -translate-x-1/2'
      case 'top':
      default:
        return 'bottom-full mb-2 left-1/2 -translate-x-1/2'
    }
  }, [bubblePosition])

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex flex-col items-center select-none ${
        interactive ? 'cursor-pointer' : ''
      } ${className}`}
      style={{ width, ...style }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick(e)
        }
      }}
    >
      {/* ── Optional Speech Bubble Callout ── */}
      <AnimatePresence>
        {bubble && !bubbleDismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: bubblePosition === 'top' ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            className={`absolute z-30 min-w-[180px] max-w-[260px] p-3 rounded-2xl shadow-xl border backdrop-blur-md pointer-events-auto ${bubblePositionClass} ${
              bubbleVariant === 'slate'
                ? 'bg-slate-900/95 text-white border-slate-700/80 shadow-slate-950/40'
                : bubbleVariant === 'indigo' || bubbleVariant === 'emerald' || bubbleVariant === 'forest'
                ? 'bg-[#0B1A13]/95 text-white border-emerald-500/40 shadow-emerald-950/50'
                : 'bg-white/95 dark:bg-[#0B1711]/95 text-slate-800 dark:text-[#F0FDF4] border-slate-200/90 dark:border-[#1B3326] shadow-slate-900/10'
            }`}
          >
            {/* Bubble Header */}
            {bubbleChip && (
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {bubbleChip}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setBubbleDismissed(true)
                  }}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Dismiss message"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {/* Bubble Content */}
            <div className="text-xs font-medium leading-relaxed">{bubble}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Character Figure with 60fps Motion ── */}
      <motion.div
        className="relative z-10 w-full flex items-center justify-center will-change-transform"
        style={{ height }}
        whileHover={interactive && !reduceMotion ? { scale: 1.04, y: -2 } : undefined}
        whileTap={interactive && !reduceMotion ? { scale: 0.96 } : undefined}
        {...charMotionProps}
      >
        <img
          src={resolvedSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`w-full h-full object-contain pointer-events-none drop-shadow-sm transition-opacity duration-200 ${imgClassName}`}
          style={{
            maxWidth: width,
            maxHeight: height,
          }}
        />
      </motion.div>

      {/* ── Floor Drop Shadow ── */}
      {showShadow && (
        <div
          className="relative w-full flex items-center justify-center -mt-2 pointer-events-none z-0"
          style={{ height: Math.max(12, Math.round(height * 0.12)) }}
        >
          <motion.div
            className="rounded-full bg-slate-950 will-change-transform"
            style={{
              width: Math.round(width * 0.65),
              height: Math.max(6, Math.round(height * 0.08)),
              filter: `blur(${Math.max(2, Math.round(width * 0.04))}px)`,
              opacity: 0.22,
            }}
            {...shadowMotionProps}
          />
        </div>
      )}
    </div>
  )
})

export default CrafturePoseMascot

