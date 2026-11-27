import React from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowsClockwise,
  CheckCircle,
} from '@phosphor-icons/react'
import { COCKPIT_TABS } from './ReportDashboard'

export default function ReportBottomNav({
  activeTab = 'overview',
  onTabChange,
  tabs = COCKPIT_TABS,
  onBookCall,
}) {
  const tabList = tabs && tabs.length > 0 ? tabs : [
    { id: 'overview', label: 'Overview & Action Plan', icon: '01' },
    { id: 'resume', label: 'Resume Lab', icon: '02' },
    { id: 'linkedin', label: 'LinkedIn Studio', icon: '03' },
  ]

  const currentIndex = tabList.findIndex((t) => t.id === activeTab)
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const currentTab = tabList[safeIndex]
  const prevTab = safeIndex > 0 ? tabList[safeIndex - 1] : null
  const nextTab = safeIndex < tabList.length - 1 ? tabList[safeIndex + 1] : null

  const handleNav = (tabId) => {
    if (onTabChange) onTabChange(tabId)
  }

  const handleScrollTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <nav
      aria-label="Bottom Report Navigation"
      className="print:hidden mt-12 mb-8 bg-white dark:bg-[#0B1711] border border-slate-200/90 dark:border-[#1B3326] rounded-xl p-5 sm:p-6 shadow-xs transition-colors"
    >
      {/* Top Meta Bar: Step Progress & Quick Scroll to Top */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-[#1B3326] text-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] dark:bg-emerald-400" />
            Section {safeIndex + 1} of {tabList.length}
          </span>
          <span className="hidden sm:inline font-semibold text-slate-700 dark:text-slate-200 font-mono text-xs">
            {currentTab?.icon} {currentTab?.label}
          </span>
        </div>

        {/* 5-Step Progress Bar Indicator */}
        <div className="hidden md:flex items-center gap-1.5 w-48 bg-slate-100 dark:bg-[#102118] p-1 rounded-full border border-slate-200/60 dark:border-[#1B3326]">
          {tabList.map((t, idx) => {
            const isDone = idx < safeIndex
            const isCurrent = idx === safeIndex
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleNav(t.id)}
                title={`Jump to ${t.label}`}
                className={`flex-1 h-2 rounded-full transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-[#15803D] ring-2 ring-emerald-500/30'
                    : isDone
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-slate-300 dark:bg-[#1B3326] hover:bg-slate-400'
                }`}
              />
            )
          })}
        </div>

        {/* 1-Click Scroll to Top */}
        <button
          type="button"
          onClick={handleScrollTop}
          className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#102118] border border-transparent hover:border-slate-200 dark:hover:border-[#1B3326] transition-all cursor-pointer"
        >
          <ArrowUp size={14} weight="bold" />
          <span className="hidden sm:inline">Back to Top</span>
        </button>
      </div>

      {/* Main Navigation Action Controls */}
      <div className="pt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
        {/* Previous Button */}
        {prevTab ? (
          <button
            type="button"
            onClick={() => handleNav(prevTab.id)}
            className="flex-1 max-w-full sm:max-w-xs flex items-center gap-3 p-3.5 rounded-xl border border-slate-200/90 dark:border-[#1B3326] bg-slate-50/70 dark:bg-[#102118]/80 hover:bg-white dark:hover:bg-[#102118] hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-xs transition-colors text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#1B3326] border border-slate-200 dark:border-[#1B3326] flex items-center justify-center text-slate-600 dark:text-slate-200 shrink-0 shadow-2xs">
              <ArrowLeft size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                Previous Section
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-xs text-[var(--text-muted)]">{prevTab.icon}</span>
                <span>{prevTab.label}</span>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex-1 max-w-full sm:max-w-xs p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-[#1B3326]/80 bg-slate-50/30 dark:bg-[#102118]/40 flex items-center gap-3 text-left opacity-60">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#102118] flex items-center justify-center text-slate-400 shrink-0">
              <CheckCircle size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-slate-400">
                Starting Section
              </div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                01. Overview & Pulse
              </div>
            </div>
          </div>
        )}

        {/* Center: Quick Section Switcher Pills */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-[#102118]/90 rounded-xl border border-slate-200/60 dark:border-[#1B3326] shrink-0">
          {tabList.map((tab, idx) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleNav(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#0B1711] text-[#15803D] dark:text-emerald-400 font-bold shadow-xs border border-emerald-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-[#102118]'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{idx + 1}. {tab.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Next Button */}
        {nextTab ? (
          <button
            type="button"
            onClick={() => handleNav(nextTab.id)}
            className="flex-1 max-w-full sm:max-w-xs flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--primary)] hover:opacity-95 text-white shadow-xs transition-opacity text-left group cursor-pointer ml-auto"
          >
            <div className="min-w-0 pl-1">
              <div className="text-[10px] font-mono text-emerald-100 flex items-center gap-1">
                <span>Next Section</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-white truncate flex items-center gap-1.5 mt-0.5">
                <span className="font-mono">{nextTab.icon}</span>
                <span>{nextTab.label}</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-white/15 dark:bg-white/10 flex items-center justify-center text-white group-hover:translate-x-1 transition-transform shrink-0">
              <ArrowRight size={16} weight="bold" />
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleNav('overview')}
            className="flex-1 max-w-full sm:max-w-xs flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors text-left group cursor-pointer ml-auto"
          >
            <div className="min-w-0 pl-1">
              <div className="text-[10px] font-mono text-emerald-100">
                Completed All 4 Sections
              </div>
              <div className="text-xs sm:text-sm font-semibold text-white truncate flex items-center gap-1.5 mt-0.5">
                <span className="font-mono">01</span>
                <span>Review From Overview</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-white/15 dark:bg-white/10 flex items-center justify-center text-white shrink-0">
              <ArrowsClockwise size={16} weight="bold" />
            </div>
          </button>
        )}
      </div>
    </nav>
  )
}

