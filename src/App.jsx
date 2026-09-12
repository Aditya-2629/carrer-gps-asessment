import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore, { PHASES } from './store/useAppStore'
import GatePhase from './components/gate/GatePhase'
import AssessmentShell from './components/assessment/AssessmentShell'
import AnalysisLoader from './components/loading/AnalysisLoader'
import ReportDashboard from './components/report/ReportDashboard'
import KnowledgeBaseManager from './components/admin/KnowledgeBaseManager'

const phaseVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
}

export default function App() {
  const phase = useAppStore((s) => s.phase)
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname)
    }

    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  // Check if current route is the special unlinked knowledge base route
  const isKnowledgeBaseRoute = [
    '/admin/knowledge-base',
    '/knowledge-base',
    '/admin/kb',
    '/kb',
  ].includes(pathname.toLowerCase())

  if (isKnowledgeBaseRoute) {
    return <KnowledgeBaseManager />
  }

  return (
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
  )
}
