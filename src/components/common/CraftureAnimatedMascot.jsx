import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { getMascotPose, preloadMascotAssets } from '../../assets/mascot'

/**
 * CraftureAnimatedMascot
 *
 * Official studio-grade Forest Green Mascot component integrating all 14 transparent WebP poses:
 * wave, thinking, reading, laptop, chart, clipboard, roadmap, thumbsup, angry, happy, sad, shocked, idle, working.
 *
 * Features:
 * - Locked 148px × 148px (mobile 112px × 112px) stage
 * - Tight radial-gradient elliptical floor shadow underneath
 * - Smooth 0.18s Framer Motion crossfade between poses
 * - Subtle desktop 3D cursor tilt (perspective: 700px)
 */
const CraftureAnimatedMascot = forwardRef(function CraftureAnimatedMascot(
  {
    pose = 'wave',
    className = '',
    imgClassName = '',
    style = {},
    showShadow = true,
    interactive = true,
    scaleOnHover = true,
    isCelebrating = false,
    onClick,
    onDoubleClick,
    onMouseEnter,
    onMouseLeave,
    alt = 'Crafture Executive Mascot',
    size, // optional custom dimension override (number or string)
  },
  forwardedRef
) {
  const containerRef = useRef(null)
  const [isInternalHovered, setIsInternalHovered] = useState(false)

  // Expose container DOM element to forwarded ref for parent GSAP/timeline animations
  useImperativeHandle(forwardedRef, () => containerRef.current)

  // Preload all 14 WebP assets for instant, zero-flicker transitions
  useEffect(() => {
    preloadMascotAssets()
  }, [])

  // Resolve pose source from dictionary
  const resolvedSrc = useMemo(() => getMascotPose(pose), [pose])

  // Desktop 3D cursor tilt tracking (700px perspective)
  useEffect(() => {
    if (!interactive || !containerRef.current) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const rotYTo = gsap.quickTo(containerRef.current, 'rotationY', {
      duration: 0.45,
      ease: 'power3.out',
    })
    const rotXTo = gsap.quickTo(containerRef.current, 'rotationX', {
      duration: 0.45,
      ease: 'power3.out',
    })
    const xTo = gsap.quickTo(containerRef.current, 'x', {
      duration: 0.45,
      ease: 'power3.out',
    })
    const yTo = gsap.quickTo(containerRef.current, 'y', {
      duration: 0.45,
      ease: 'power3.out',
    })

    gsap.set(containerRef.current, { transformPerspective: 700 })

    const handleMouseMove = (e) => {
      if (window.innerWidth < 640 || !containerRef.current || isCelebrating) return
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = (e.clientX - centerX) / (window.innerWidth / 2)
      const dy = (e.clientY - centerY) / (window.innerHeight / 2)
      const clampedX = Math.max(-1, Math.min(1, dx))
      const clampedY = Math.max(-1, Math.min(1, dy))

      rotYTo(clampedX * 10)
      rotXTo(-clampedY * 8)
      xTo(clampedX * 4)
      yTo(clampedY * 4)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [interactive, isCelebrating])

  const stageDimensions = size
    ? typeof size === 'number'
      ? { width: size, height: size }
      : { width: size, height: size }
    : {}

  const handleMouseEnter = (e) => {
    setIsInternalHovered(true)
    if (onMouseEnter) onMouseEnter(e)
  }

  const handleMouseLeave = (e) => {
    setIsInternalHovered(false)
    if (onMouseLeave) onMouseLeave(e)
  }

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ ...stageDimensions, ...style }}
      className={`relative flex items-center justify-center select-none ${
        size ? '' : 'w-[112px] h-[112px] sm:w-[148px] sm:h-[148px]'
      } ${className}`}
    >
      {/* Tight radial-gradient elliptical floor shadow */}
      {showShadow && (
        <div
          className="absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 w-16 sm:w-24 h-2.5 sm:h-3.5 rounded-full pointer-events-none transition-all duration-300"
          style={{
            transform: `translateX(-50%) scale(${
              isCelebrating ? 0.65 : isInternalHovered ? 1.08 : 1
            })`,
            opacity: isCelebrating ? 0.15 : isInternalHovered ? 0.45 : 0.35,
            background:
              'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.32) 0%, rgba(15, 23, 42, 0.12) 48%, transparent 72%)',
          }}
        />
      )}

      {/* Smooth 0.18s Framer Motion crossfade layer with spring hover */}
      <motion.div
        className="relative w-full h-full flex items-center justify-center will-change-transform"
        animate={{
          scale: scaleOnHover && isInternalHovered && !isCelebrating ? 1.06 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 25,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={resolvedSrc}
            src={resolvedSrc}
            alt={alt}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`w-full h-full object-contain filter drop-shadow-sm select-none pointer-events-none ${imgClassName}`}
            loading="eager"
            decoding="async"
          />
        </AnimatePresence>
      </motion.div>
    </div>
  )
})

export default CraftureAnimatedMascot
