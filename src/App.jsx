import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore, { PHASES } from './store/useAppStore'
import GatePhase from './components/gate/GatePhase'
import AssessmentShell from './components/assessment/AssessmentShell'
import AnalysisLoader from './components/loading/AnalysisLoader'
import ReportDashboard from './components/report/ReportDashboard'
import { GlobalToast } from './components/common/Toast'
import { trackAnalytics } from './lib/analytics'

const phaseVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
}

export default function App() {
  const phase = useAppStore((s) => s.phase)
  const reportData = useAppStore((s) => s.reportData)
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname)
    }

    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  // Send initial landing visitor heartbeat & keepalive every 30s
  useEffect(() => {
    const ping = () => {
      const fd = useAppStore.getState().formData || {}
      trackAnalytics({
        currentPhase: phase === PHASES.GATE ? 'landing' : String(phase || 'landing').toLowerCase(),
        currentStep: phase === PHASES.GATE ? 'landing' : undefined,
        abandonedDraft: {
          name: fd.name || fd.fullName || '',
          email: fd.email || '',
          phone: fd.phone || '',
          linkedin: fd.linkedin || '',
          targetRole: fd.targetRole || '',
        },
      })
    }
    ping()
    const timer = setInterval(ping, 30000)
    return () => clearInterval(timer)
  }, [phase])

  // Public Report Route (supports /report, /report/:id, /report-preview, /career-gps-report)
  const reportIdMatch = pathname.match(/^\/report\/([^/]+)\/?$/i)
  const sharedReportId = reportIdMatch ? reportIdMatch[1] : null
  const isReportRoute =
    Boolean(sharedReportId) ||
    [
      '/report',
      '/report-preview',
      '/career-gps-report',
    ].includes(pathname.toLowerCase()) ||
    window.location.search.includes('phase=report') ||
    phase === PHASES.REPORT

  if (isReportRoute) {
    return (
      <>
        <GlobalToast />
        <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] relative transition-colors duration-150">
          <ReportDashboard sharedReportId={sharedReportId} />
        </div>
      </>
    )
  }

  // Public Loading Route
  const isLoadingRoute = ['/loading', '/analysis-loading'].includes(pathname.toLowerCase())
  if (isLoadingRoute) {
    return (
      <>
        <GlobalToast />
        <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] relative transition-colors duration-150">
          <AnalysisLoader />
        </div>
      </>
    )
  }

  // Standard Public Assessment & Gate Phases
  return (
    <>
      <GlobalToast />
      <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] relative transition-colors duration-150">
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {phase === PHASES.GATE && (
              <motion.div key="gate" {...phaseVariants}>
                <GatePhase />
              </motion.div>
            )}
            {phase === PHASES.ASSESSMENT && (
              <motion.div key="assessment" {...phaseVariants}>
                <AssessmentShell />
              </motion.div>
            )}
            {phase === PHASES.LOADING && (
              <motion.div key="loading" {...phaseVariants}>
                <AnalysisLoader />
              </motion.div>
            )}
            {phase === PHASES.REPORT && (
              <motion.div key="report" {...phaseVariants}>
                <ReportDashboard />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
