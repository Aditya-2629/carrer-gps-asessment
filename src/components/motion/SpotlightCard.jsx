import { useState, useRef, useEffect } from 'react'

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(21, 128, 61, 0.14)',
  spotlightColorDark = 'rgba(34, 197, 94, 0.18)',
  spotlightSize = 340,
  onClick,
  ...rest
}) {
  const divRef = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    // Check if device supports hover / is not a primary touch device
    if (typeof window !== 'undefined' && window.matchMedia) {
      const hasTouch = window.matchMedia('(hover: none)').matches
      setIsTouchDevice(hasTouch)
    }
  }, [])

  const handleMouseMove = (e) => {
    if (isTouchDevice || !divRef.current) return
    const rect = divRef.current.getBoundingClientRect()
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleMouseEnter = () => {
    if (!isTouchDevice) setOpacity(1)
  }

  const handleMouseLeave = () => {
    setOpacity(0)
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
      {...rest}
    >
      {/* Dynamic Cursor Spotlight Radial Overlay */}
      {!isTouchDevice && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-10 hidden sm:block"
          style={{
            opacity,
            background: `radial-gradient(${spotlightSize}px circle at ${position.x}px ${position.y}px, var(--spotlight-color, ${spotlightColor}), transparent 80%)`,
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
