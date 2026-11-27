import { useState } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { DownloadSimple } from '@phosphor-icons/react'
import { downloadFullVisualReport } from '../../lib/downloadFullReport'
import { COCKPIT_TABS } from './ReportDashboard'
import { CountUp, MagnetButton } from '../motion'

export default function StickyReportNav({
  activeTab = 'overview',
  onTabChange,
  candidateName = '',
  targetRole = '',
  healthScore = 72,
  reportData,
  isTeaserLocked = false,
  pdfExtras = {},
}) {
  const [isDownloading, setIsDownloading] = useState(false)
  const safeName = typeof candidateName === 'string' ? candidateName.trim() : (candidateName?.name || '')
  const safeRole = typeof targetRole === 'string' ? targetRole.trim() : ''

  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })

  const handleDownloadPdf = async () => {
    setIsDownloading(true)
    try {
      const mergedPayload = { ...(reportData || {}), ...(pdfExtras || {}) }
      await downloadFullVisualReport(mergedPayload, safeName, { isTeaserLocked })
    } finally {
      setIsDownloading(false)
    }
  }

  const tabs = COCKPIT_TABS || [
    { id: 'overview', label: 'Overview & Action Plan', icon: '01' },
    { id: 'resume', label: 'Resume Lab', icon: '02' },
    { id: 'linkedin', label: 'LinkedIn Studio', icon: '03' },
  ]

  return (
    <div className="sticky top-0 z-40 bg-[var(--surface-base)]/95 backdrop-blur-md border-b border-[var(--border-default)] transition-all duration-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 sm:py-2 flex flex-col lg:flex-row items-center justify-between gap-1.5 lg:gap-3">
        {/* Row 1 for < lg: Candidate Score on Left, Actions on Right */}
        <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start gap-2 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            {/* Health Score Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-sunken)] border border-[var(--border-default)] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] dark:bg-emerald-400" />
              <span className="font-mono tabular-nums inline-flex items-center">
                <CountUp to={healthScore} duration={0.9} />
                <span>/100</span>
              </span>
            </div>

            {safeName && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-[var(--text-primary)] truncate max-w-[120px]">{safeName}</span>
                {safeRole && (
                  <span className="text-[var(--text-muted)] hidden xl:inline truncate max-w-[110px] font-medium">
                    • {safeRole}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action button on mobile/tablet */}
          <div className="flex lg:hidden items-center shrink-0">
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadPdf}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] hover:opacity-90 disabled:opacity-60 text-white shadow-2xs transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
              title={isTeaserLocked ? 'Download Preview Report (PDF)' : 'Download Full Visual Report (PDF)'}
            >
              <DownloadSimple size={12} weight="bold" />
              <span>{isDownloading ? '...' : 'PDF'}</span>
            </button>
          </div>
        </div>

        {/* Center: Sleek 5-Tab Segmented Pill Bar with Overflow Protection */}
        <div className="w-full lg:w-auto lg:flex-1 min-w-0 flex justify-start sm:justify-center overflow-x-auto no-scrollbar py-0.5">
          <nav
            aria-label="Executive Cockpit Navigation"
            className="inline-flex items-center gap-0.5 sm:gap-1 bg-[var(--surface-sunken)] p-1 rounded-xl border border-[var(--border-default)] shrink-0 w-full sm:w-auto justify-between sm:justify-center"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange && onTabChange(tab.id)}
                  className={`cockpit-pill relative flex items-center gap-1 sm:gap-1.5 min-h-[40px] px-2.5 sm:px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-150 shrink-0 ${
                    isActive
                      ? 'active text-[#15803D] dark:text-emerald-300 font-bold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]/60'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="reportTabPill"
                      className="absolute inset-0 bg-white dark:bg-[#0B1711] rounded-lg shadow-xs border border-[#15803D]/25 dark:border-emerald-500/35"
                      transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10 text-xs">{tab.icon}</span>
                  <span className="relative z-10">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right: Desktop Action (Download Report PDF) */}
        <div className="hidden lg:flex items-center shrink-0">
          <MagnetButton
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] hover:opacity-90 disabled:opacity-60 text-white shadow-2xs transition-opacity flex items-center gap-1.5 cursor-pointer shrink-0"
            title={isTeaserLocked ? 'Download Preview Report (PDF)' : 'Download Full Visual Report (PDF)'}
          >
            <DownloadSimple size={13} weight="bold" />
            <span>{isDownloading ? 'Generating...' : isTeaserLocked ? 'Preview PDF' : 'Full Report'}</span>
          </MagnetButton>
        </div>
      </div>

      {/* 2px Forest-Green Hairline Reading Progress Bar */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#15803D] via-[#22C55E] to-[#10B981] origin-left pointer-events-none"
        style={{ scaleX }}
      />
    </div>
  )
}
