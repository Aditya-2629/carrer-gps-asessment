import { useEffect, useRef, useState } from 'react'

const CIRCUMFERENCE = 2 * Math.PI * 54 // r=54

function getScoreColor(score) {
  if (score >= 75) return '#10b981'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Fair'
  if (score >= 35) return 'Needs Work'
  return 'Critical'
}

export default function HeroScore({ score, scoreLabel }) {
  const [displayed, setDisplayed] = useState(0)
  const [animated, setAnimated] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true)
      // Count up
      let start = 0
      const step = () => {
        start += 1
        setDisplayed(start)
        if (start < score) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 600)
    return () => clearTimeout(timer)
  }, [score])

  const offset = animated
    ? CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE
    : CIRCUMFERENCE
  const color = getScoreColor(score)

  return (
    <div
      className="glass p-8 rounded-2xl flex flex-col sm:flex-row items-center gap-8"
      ref={ref}
    >
      {/* SVG Ring */}
      <div className="relative shrink-0" aria-label={`Score indicator: ${score} out of 100`}>
        <svg width="140" height="140" viewBox="0 0 128 128" role="img" aria-label="Circular score chart">
          {/* Track */}
          <circle
            cx="64" cy="64" r="54"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
          />
          {/* Progress */}
          <circle
            cx="64" cy="64" r="54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 64 64)"
            className="ring-progress"
            style={{
              filter: `drop-shadow(0 0 8px ${color}60)`,
            }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-bold tabular-nums"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color }}
          >
            {displayed}
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>/ 100</span>
        </div>
      </div>

      {/* Text */}
      <div className="text-center sm:text-left">
        <div
          className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3"
          style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
        >
          {scoreLabel || getScoreLabel(score)}
        </div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.95)' }}
        >
          Career Health Score
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', maxWidth: '360px' }}>
          Based on your resume quality, networking activity, interview performance, and job search strategy — benchmarked against successful U.S. IT candidates.
        </p>
      </div>
    </div>
  )
}

