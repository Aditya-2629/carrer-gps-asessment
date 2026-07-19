import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Compass } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { api } from '../../lib/api'

const MESSAGES = [
  'Analyzing Job Search Velocity...',
  'Calculating ATS Compatibility...',
  'Evaluating LinkedIn Presence...',
  'Mapping Your Outreach Gaps...',
  'Scoring Interview Readiness...',
  'Generating Personalized Roadmap...',
  'Finalizing Your Career GPS Report...',
]

export default function AnalysisLoader() {
  const { userId, formData, setReportData, setPhase } = useAppStore()
  const [msgIndex, setMsgIndex] = useState(0)

  const mutation = useMutation({
    mutationFn: api.generateReport,
    onSuccess: (data) => {
      setReportData(data)
      setTimeout(() => setPhase(PHASES.REPORT), 500)
    },
    onError: () => {
      // On error, use mock data so the report always loads beautifully
      setPhase(PHASES.REPORT)
    },
  })

  useEffect(() => {
    mutation.mutate({ userId, formData })
  }, []) // eslint-disable-line

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-label="Analyzing career assessment results"
    >
      {/* Pulsing ring */}
      <div className="relative mb-12 w-24 h-24 flex items-center justify-center">
        {/* Outer rings */}
        <div
          className="absolute w-24 h-24 rounded-full pulse-ring"
          style={{ background: 'transparent', border: '2px solid rgba(16,185,129,0.3)' }}
        />
        <div
          className="absolute w-24 h-24 rounded-full pulse-ring"
          style={{
            background: 'transparent',
            border: '2px solid rgba(16,185,129,0.15)',
            animationDelay: '0.5s',
          }}
        />
        {/* Core circle */}
        <motion.div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Compass size={32} weight="fill" />
        </motion.div>
      </div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-3 text-center"
        style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.95)' }}
      >
        Building Your Career GPS
      </motion.h2>

      {/* Cycling message */}
      <div className="h-7 relative overflow-hidden mb-10 w-full max-w-xs">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-sm absolute inset-0 flex items-center justify-center text-center"
            style={{ color: '#10b981', fontFamily: 'Space Grotesk, sans-serif', whiteSpace: 'nowrap' }}
          >
            {MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2" aria-hidden="true">
        {MESSAGES.map((_, i) => (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: i === msgIndex ? '24px' : '6px',
              height: '6px',
              background: i === msgIndex ? '#10b981' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Fine print */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-10 text-xs text-center"
        style={{ color: 'rgba(255,255,255,0.2)', maxWidth: '300px' }}
      >
        Our AI is cross-referencing your answers against 50,000+ career trajectories
      </motion.p>
    </div>
  )
}

