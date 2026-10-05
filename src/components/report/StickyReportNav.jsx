import { useState, useEffect } from 'react'
import {
  Compass,
  Gauge,
  Warning,
  Sparkle,
  TrendDown,
  ListChecks,
  Path,
  Article,
  ChartBar,
} from '@phosphor-icons/react'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Compass },
  { id: 'snapshot', label: 'Snapshot', icon: Gauge },
  { id: 'bottleneck', label: 'Bottleneck', icon: Warning, highlight: true },
  { id: 'strengths', label: 'Strengths', icon: Sparkle },
  { id: 'opportunities', label: 'Opportunities', icon: TrendDown },
  { id: 'funnel-risks', label: 'Funnel & Risks', icon: ChartBar },
  { id: 'priorities', label: 'Priorities', icon: ListChecks },
  { id: 'roadmap', label: 'Roadmap', icon: Path },
  { id: 'diagnosis', label: 'Deep Dive', icon: Article },
]

export default function StickyReportNav({ candidateName, targetRole }) {
  const safeName = typeof candidateName === 'string' ? candidateName : (typeof candidateName === 'object' ? (candidateName?.name || 'Candidate') : 'Candidate')
  const safeRole = typeof targetRole === 'string' ? targetRole : 'Target Role'
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180

      for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
        const item = NAV_ITEMS[i]
        const element = document.getElementById(item.id)
        if (element) {
          const top = element.offsetTop
          if (scrollPosition >= top) {
            setActiveSection(item.id)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id) => {
    setActiveSection(id)
    const element = document.getElementById(id)
    if (element) {
      const navOffset = 90
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: elementPosition - navOffset,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="sticky top-0 z-40 bg-[var(--surface-base)]/90 backdrop-blur-md border-b border-[var(--border-default)] transition-all duration-200 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Candidate Context Pill (Desktop only) */}
        <div className="hidden lg:flex items-center gap-2 pr-3 border-r border-[var(--border-default)] shrink-0 text-xs">
          <span className="font-bold text-[var(--text-primary)]">{safeName}</span>
          <span className="text-[var(--text-muted)]">•</span>
          <span className="text-[var(--text-secondary)] truncate max-w-[160px] font-medium">
            {safeRole}
          </span>
        </div>

        {/* Scrollable Navigation Chips */}
        <nav
          aria-label="Report section navigation"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full lg:w-auto"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id

            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : item.highlight
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/25'
                    : 'bg-[var(--surface-sunken)] hover:bg-[var(--surface-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-default)]'
                }`}
              >
                <Icon size={14} weight={isActive ? 'fill' : 'bold'} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
