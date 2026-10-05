import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useAppStore, { PHASES } from './store/useAppStore'
import GatePhase from './components/gate/GatePhase'
import AssessmentShell from './components/assessment/AssessmentShell'
import AnalysisLoader from './components/loading/AnalysisLoader'
import ReportDashboard from './components/report/ReportDashboard'
import KnowledgeBaseManager from './components/admin/KnowledgeBaseManager'
import ResumeAgentTestLab from './pages/ResumeAgentTestLab'
import ResumeReportPage from './pages/ResumeReportPage'
import AdminPanel from './pages/admin/AdminPanel.jsx'
import AdminLogin from './pages/admin/AdminLogin.jsx'

const phaseVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
}

function AdminRoute() {
  const [authed, setAuthed] = useState(() => Boolean(localStorage.getItem('craftureAdminToken')))
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />
  return <AdminPanel onLogout={() => setAuthed(false)} />
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

  // Admin console route: token-gated login panel
  const isAdminRoute = ['/admin', '/admin-panel'].includes(pathname.toLowerCase())
  if (isAdminRoute) {
    return <AdminRoute />
  }

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

  // Check if current route is the development-only resume test lab
  const isTestLabRoute = [
    '/test-lab',
    '/admin/test-lab',
    '/resume-test',
    '/resume-lab',
  ].includes(pathname.toLowerCase())

  if (isTestLabRoute) {
    return <ResumeAgentTestLab />
  }

  // Check if the polished resume diagnosis report is requested
  const isResumeReportRoute = ['/resume-report', '/resume-diagnosis'].includes(pathname.toLowerCase())
  if (isResumeReportRoute) {
    return <ResumeReportPage />
  }

  // Check if direct report preview route is requested
  const isReportRoute = [
    '/report',
    '/report-preview',
    '/career-gps-report',
  ].includes(pathname.toLowerCase()) || window.location.search.includes('phase=report')

  if (isReportRoute) {
    return (
      <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] relative transition-colors duration-150">
        <ReportDashboard />
      </div>
    )
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
