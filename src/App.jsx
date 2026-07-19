import { AnimatePresence, motion } from 'framer-motion'
import useAppStore, { PHASES } from './store/useAppStore'
import GatePhase from './components/gate/GatePhase'
import AssessmentShell from './components/assessment/AssessmentShell'
import AnalysisLoader from './components/loading/AnalysisLoader'
import ReportDashboard from './components/report/ReportDashboard'

const phaseVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
}

export default function App() {
  const phase = useAppStore((s) => s.phase)

  return (
    <div className="min-h-screen ambient-grid relative overflow-hidden">
      {/* Ambient blobs */}
      <div
        className="fixed top-0 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="fixed bottom-0 right-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

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
  )
}
