import { useState } from 'react'
import { motion } from 'framer-motion'
import { DownloadSimple } from '@phosphor-icons/react'
import { downloadFullVisualReport } from '../../lib/downloadFullReport'
import { COCKPIT_TABS } from './ReportDashboard'

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
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span className="font-mono tabular-nums">{healthScore}/100</span>
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
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right: Desktop Action (Download Report PDF) */}
        <div className="hidden lg:flex items-center shrink-0">
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] hover:opacity-90 disabled:opacity-60 text-white shadow-2xs transition-opacity flex items-center gap-1.5 cursor-pointer shrink-0"
            title={isTeaserLocked ? 'Download Preview Report (PDF)' : 'Download Full Visual Report (PDF)'}
          >
            <DownloadSimple size={13} weight="bold" />
            <span>{isDownloading ? 'Generating...' : isTeaserLocked ? 'Preview PDF' : 'Full Report'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
