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
    { id: 'overview', label: 'Overview & Pulse', icon: '🎯', badge: null },
    { id: 'resume', label: 'Resume Lab', icon: '📄', badge: 'ATS' },
    { id: 'linkedin', label: 'LinkedIn Studio', icon: '💼', badge: 'SEO' },
    { id: 'funnel', label: 'Funnel & Risks', icon: '⚡', badge: 'Velocity' },
    { id: 'roadmap', label: '7-Day Sprint & CTA', icon: '🚀', badge: 'Plan' },
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
      className="print:hidden mt-12 mb-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-lg shadow-slate-200/40 dark:shadow-none transition-all"
    >
      {/* Top Meta Bar: Step Progress & Quick Scroll to Top */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
            Section {safeIndex + 1} of {tabList.length}
          </span>
          <span className="hidden sm:inline font-bold text-slate-700 dark:text-slate-200">
            {currentTab?.icon} {currentTab?.label}
          </span>
        </div>

        {/* 5-Step Progress Bar Indicator */}
        <div className="hidden md:flex items-center gap-1.5 w-48 bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200/60 dark:border-slate-700">
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
                    ? 'bg-indigo-600 ring-2 ring-indigo-500/30'
                    : isDone
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
              />
            )
          })}
        </div>

        {/* 1-Click Scroll to Top */}
        <button
          type="button"
          onClick={handleScrollTop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
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
            className="flex-1 max-w-full sm:max-w-xs flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-200 group-hover:-translate-x-1 transition-transform shrink-0 shadow-2xs">
              <ArrowLeft size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Previous Section
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5 mt-0.5">
                <span>{prevTab.icon}</span>
                <span>{prevTab.label}</span>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex-1 max-w-full sm:max-w-xs p-3.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-800/20 flex items-center gap-3 text-left opacity-60">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
              <CheckCircle size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Starting Section
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">
                1. Overview & Pulse
              </div>
            </div>
          </div>
        )}

        {/* Center: Quick Section Switcher Pills */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shrink-0">
          {tabList.map((tab, idx) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleNav(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs border border-indigo-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/50'
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
            className="flex-1 max-w-full sm:max-w-xs flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30 transition-all text-left group cursor-pointer ml-auto"
          >
            <div className="min-w-0 pl-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-200 flex items-center gap-1">
                <span>Next Section</span>
                {nextTab.badge && (
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full font-bold bg-white/20 text-white">
                    {nextTab.badge}
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5 mt-0.5">
                <span>{nextTab.icon}</span>
                <span>{nextTab.label}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white group-hover:translate-x-1.5 transition-transform shrink-0">
              <ArrowRight size={18} weight="bold" />
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleNav('overview')}
            className="flex-1 max-w-full sm:max-w-xs flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all text-left group cursor-pointer ml-auto"
          >
            <div className="min-w-0 pl-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                Completed All 5 Sections
              </div>
              <div className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5 mt-0.5">
                <span>🎯</span>
                <span>Review From Overview</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white group-hover:rotate-180 transition-transform duration-300 shrink-0">
              <ArrowsClockwise size={18} weight="bold" />
            </div>
          </button>
        )}
      </div>
    </nav>
  )
}

