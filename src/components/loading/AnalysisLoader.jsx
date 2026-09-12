import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Compass, WarningCircle, ArrowLeft } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { api } from '../../lib/api'

const MESSAGES = [
  'Analyzing Job Search Velocity...',
  'Scraping & Converting LinkedIn Profile...',
  'Parsing Resume into Structured JSON...',
  'Evaluating ATS Readability & Keywords...',
  'Mapping Your Outreach Gaps...',
  'Scoring Interview Readiness...',
  'Finalizing Your Career GPS Report...',
]

export default function AnalysisLoader() {
  const { userId, formData, setReportData, setPhase } = useAppStore()
  const [msgIndex, setMsgIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState(null)

  const mutation = useMutation({
    mutationFn: api.generateReport,
    onSuccess: (data) => {
      setReportData(data)
      setTimeout(() => setPhase(PHASES.REPORT), 500)
    },
    onError: (err) => {
      // Display strict toast error banner when LinkedIn scraping or Resume parsing fails
      setErrorMessage(err?.message || 'Failed to process assessment data. Please verify your inputs.')
    },
  })

  useEffect(() => {
    mutation.mutate({ userId, formData })
  }, []) // eslint-disable-line

  useEffect(() => {
    if (errorMessage) return
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [errorMessage])

  // Error Toast Modal / Alert UI
  if (errorMessage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-black/90">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass max-w-md w-full p-6 rounded-2xl border border-red-500/30 text-center space-y-4 shadow-2xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
            <WarningCircle size={32} weight="fill" />
          </div>

          <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-head)' }}>
            Processing Error
          </h3>

          <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 text-xs text-red-400 font-mono text-left leading-relaxed">
            {errorMessage}
          </div>

          <p className="text-xs text-white/60 leading-relaxed">
            Please make sure your LinkedIn URL is public and valid, or re-upload a clear PDF/Word resume document.
          </p>

          <button
            onClick={() => setPhase(PHASES.ASSESSMENT)}
            className="w-full btn-primary text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} weight="bold" />
            <span>Go Back to Assessment & Fix Input</span>
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-label="Analyzing career assessment results"
    >
      {/* Clean Compass / Loader */}
      <div className="relative mb-8 w-24 h-24 flex items-center justify-center">
        <div
          className="absolute w-24 h-24 rounded-full"
          style={{ border: '2px solid var(--border-default)' }}
        />
        <motion.div
          className="w-16 h-16 rounded-full flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary)] border border-[var(--border-strong)] shadow-sm"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          <Compass size={32} weight="fill" />
        </motion.div>
      </div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl sm:text-3xl font-bold mb-3 text-center text-[var(--text-primary)]"
        style={{ fontFamily: 'var(--font-head)' }}
      >
        Building Your Career GPS
      </motion.h2>

      {/* Cycling message */}
      <div className="h-7 relative overflow-hidden mb-8 w-full max-w-sm">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-semibold absolute inset-0 flex items-center justify-center text-center text-[var(--primary)]"
            style={{ fontFamily: 'var(--font-head)', whiteSpace: 'nowrap' }}
          >
            {MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress indicator */}
      <div className="flex gap-2" aria-hidden="true">
        {MESSAGES.map((_, i) => (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: i === msgIndex ? '24px' : '6px',
              height: '5px',
              background: i === msgIndex ? 'var(--primary)' : 'var(--border-default)',
              transition: 'all 0.25s ease',
            }}
          />
        ))}
      </div>

      {/* Fine print */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-xs text-center text-[var(--text-tertiary)] max-w-xs"
      >
        Cross-referencing your profile and responses against 50,000+ career trajectories
      </motion.p>
    </div>
  )
}
