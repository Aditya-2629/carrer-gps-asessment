import { motion } from 'framer-motion'
import { DownloadSimple, ArrowsClockwise } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { COCKPIT_TABS } from './ReportDashboard'

export default function StickyReportNav({
  activeTab = 'overview',
  onTabChange,
  candidateName = '',
  targetRole = '',
  healthScore = 72,
  reportData,
}) {
  const safeName = typeof candidateName === 'string' ? candidateName.trim() : (candidateName?.name || '')
  const safeRole = typeof targetRole === 'string' ? targetRole.trim() : ''

  const handleDownloadPdf = async () => {
    try {
      const userId = reportData?.userId || reportData?._id || reportData?.user_answers?.userId || useAppStore.getState().userId || ''
      const email = reportData?.user_answers?.email || reportData?.candidate_email || reportData?.email || useAppStore.getState().email || ''
      const params = new URLSearchParams()
      if (userId) params.append('userId', userId)
      if (email) params.append('email', email)
      const url = `${import.meta.env.VITE_API_URL || '/api'}/assessment/report-pdf?${params.toString()}`
      window.open(url, '_blank')
    } catch (_e) {
      sessionStorage.setItem('craftureFullReport', JSON.stringify(reportData))
      const userId = reportData?.userId || reportData?._id || ''
      const email = reportData?.user_answers?.email || reportData?.candidate_email || ''
      window.open(`/full-report?id=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&print=true`, '_blank')
    }
  }

  const handleRetest = () => {
    useAppStore.getState().setPhase(PHASES.ASSESSMENT)
  }

  const tabs = COCKPIT_TABS || [
    { id: 'overview', label: 'Overview & Pulse', icon: '🎯', badge: null },
    { id: 'resume', label: 'Resume Lab', icon: '📄', badge: 'ATS' },
    { id: 'linkedin', label: 'LinkedIn Studio', icon: '💼', badge: 'SEO' },
    { id: 'funnel', label: 'Funnel & Risks', icon: '⚡', badge: 'Velocity' },
    { id: 'roadmap', label: '7-Day Sprint & CTA', icon: '🚀', badge: 'Plan' },
  ]

  return (
    <div className="sticky top-0 z-40 bg-[var(--surface-base)]/90 backdrop-blur-md border-b border-[var(--border-default)] transition-all duration-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        {/* Left: Candidate Context & Score Pill */}
        <div className="flex items-center gap-2.5 shrink-0">
          {safeName && (
            <div className="hidden md:flex items-center gap-2 pr-2.5 border-r border-[var(--border-default)] text-xs">
              <span className="font-bold text-[var(--text-primary)] truncate max-w-[140px]">{safeName}</span>
              {safeRole && (
                <>
                  <span className="text-[var(--text-muted)]">•</span>
                  <span className="text-[var(--text-secondary)] truncate max-w-[130px] font-medium">
                    {safeRole}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Health Score Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/10 border border-teal-500/25 text-teal-600 dark:text-teal-400">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            <span>{healthScore}/100</span>
          </div>
        </div>

        {/* Center: Sleek 5-Tab Segmented Pill Bar */}
        <nav
          aria-label="Executive Cockpit Navigation"
          className="flex items-center gap-1 bg-[var(--surface-sunken)] p-1 rounded-xl border border-[var(--border-default)] overflow-x-auto no-scrollbar"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange && onTabChange(tab.id)}
                className={`cockpit-pill relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'active text-teal-600 dark:text-teal-300 font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]/60'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="cockpit-active-tab"
                    className="absolute inset-0 bg-[var(--surface-card)] rounded-lg shadow-xs border border-teal-500/20"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10 text-xs">{tab.icon}</span>
                <span className="relative z-10">{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`relative z-10 text-[9px] uppercase px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                        : 'bg-[var(--border-default)] text-[var(--text-muted)]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Right: Actions (Download PDF + Retest) */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
            title="Download PDF Report"
          >
            <DownloadSimple size={13} weight="bold" />
            <span className="hidden lg:inline">PDF</span>
          </button>
          <button
            type="button"
            onClick={handleRetest}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1 cursor-pointer"
            title="Retest"
          >
            <ArrowsClockwise size={13} weight="bold" />
            <span className="hidden lg:inline">Retest</span>
          </button>
        </div>
      </div>
    </div>
  )
}
