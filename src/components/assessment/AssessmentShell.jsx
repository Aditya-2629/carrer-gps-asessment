import { AnimatePresence, motion } from 'framer-motion'
import { Sun, Moon } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { STEPS, CHAPTERS } from '../../lib/assessmentSteps'
import StepRenderer from './StepRenderer'
import CraftureLivingCopilot from '../report/CraftureLivingCopilot'
import brandLogo from '../../assets/images/crafture-logo.jpg'
import { api } from '../../lib/api'

const slideVariants = {
  enter: (dir) => ({
    x: dir > 0 ? '50%' : '-50%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: (dir) => ({
    x: dir > 0 ? '-30%' : '30%',
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeOut' },
  }),
}

export default function AssessmentShell() {
  const { currentStep, direction, setCurrentStep, setPhase, formData, theme, toggleTheme } = useAppStore()
  const step = STEPS[currentStep]
  const totalSteps = STEPS.length
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100)
  const activeChapter = CHAPTERS.find((c) => step.id >= c.range[0] && step.id <= c.range[1]) || CHAPTERS[0]

  const goNext = () => {
    // Scrape LinkedIn profile via Apify (0 LLM calls) when user advances from LinkedIn question
    if (step.name === 'linkedin') {
      const linkedinUrl = useAppStore.getState().formData?.linkedin || formData?.linkedin
      if (linkedinUrl && typeof window !== 'undefined') {
        if (window.__linkedinScrapeInProgress !== linkedinUrl && !window.__linkedinScrapePromise) {
          window.__linkedinScrapeInProgress = linkedinUrl
          window.__linkedinScrapePromise = api
            .scrapeLinkedInProfile(linkedinUrl)
            .then((res) => {
              window.__linkedinScrapeInProgress = null
              if (res?.profile) {
                useAppStore.getState().setFormData('linkedinData', res.profile)
                try {
                  sessionStorage.setItem('craftureLinkedinScrape', JSON.stringify(res.profile))
                } catch (_e) {}
              }
              return res?.profile || null
            })
            .catch(() => {
              window.__linkedinScrapeInProgress = null
              return null
            })
        }
      }
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1, 1)
    } else {
      setPhase(PHASES.GATE)
    }
  }

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1, -1)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--surface-base)] text-[var(--text-primary)]">
      {/* Top Header Bar */}
      <header
        role="banner"
        className="sticky top-0 z-50 px-4 py-3 bg-[var(--surface-muted)] border-b border-[var(--border-default)] shadow-sm"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Brand mark */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={brandLogo}
              alt="Career GPS"
              className="w-8 h-8 rounded-lg object-cover border border-[var(--border-default)]"
            />
            <span className="font-['Poppins'] font-bold text-base tracking-tight hidden sm:inline text-[var(--text-primary)]">
              Career <span className="text-[var(--primary)]">GPS</span>
            </span>
          </div>

          {/* Actions & Theme */}
          <div className="flex items-center gap-2">
            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)] transition-all cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Quiz mode' : 'Switch to Dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
            </button>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-24 sm:w-36 hidden sm:block">
              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={currentStep + 1}
                aria-valuemax={totalSteps}
                aria-label="Assessment progress"
              >
                <motion.div
                  className="progress-fill"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

            <span
              className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-md bg-[var(--surface-strong)] border border-[var(--border-default)] text-[var(--text-primary)]"
              aria-live="polite"
              aria-label={`Question ${currentStep + 1} of ${totalSteps}`}
            >
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
        </div>
      </header>

      {/* Career GPS Waypoint Route Strip */}
      <nav
        aria-label="Career GPS Route Chapters"
        className="bg-[var(--surface-sunken)] border-b border-[var(--border-default)] px-4 py-2"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Chapter Waypoints (Desktop & Tablet) */}
          <div className="hidden md:flex items-center gap-1.5 flex-1">
            {CHAPTERS.map((ch, idx) => {
              const isCompleted = step.id > ch.range[1]
              const isCurrent = step.id >= ch.range[0] && step.id <= ch.range[1]
              return (
                <div key={ch.id} className="flex items-center gap-1.5 flex-1 last:flex-none">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all select-none ${
                      isCurrent
                        ? 'bg-[var(--primary)] text-white shadow-sm ring-1 ring-[var(--primary)]/40'
                        : isCompleted
                        ? 'bg-[var(--emerald)]/15 text-[var(--emerald)] border border-[var(--emerald)]/30'
                        : 'text-[var(--text-muted)] opacity-60'
                    }`}
                  >
                    <span>{isCompleted ? '✓' : ch.icon}</span>
                    <span className="truncate">{ch.title}</span>
                  </div>
                  {idx < CHAPTERS.length - 1 && (
                    <div
                      className={`h-[2px] flex-1 transition-colors ${
                        isCompleted ? 'bg-[var(--emerald)]/40' : 'bg-[var(--border-default)]'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Mobile Compact Chapter Indicator */}
          <div className="md:hidden flex items-center justify-between w-full text-xs">
            <div className="flex items-center gap-2">
              <span className="text-sm">{activeChapter.icon}</span>
              <span className="font-bold text-[var(--text-primary)]">
                Ch {activeChapter.number}: {activeChapter.title}
              </span>
            </div>
            <span className="text-[var(--text-muted)] font-mono font-semibold">
              Step {currentStep + 1} / {totalSteps} ({progress}%)
            </span>
          </div>
        </div>
      </nav>

      {/* Step content */}
      <main
        id="main-content"
        className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 pt-6 pb-32 sm:py-10 overflow-x-clip"
      >
        <div className="w-full max-w-xl relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <StepRenderer
                step={step}
                onNext={goNext}
                onBack={goBack}
                isFirst={currentStep === 0}
                isLast={currentStep === totalSteps - 1}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* 3D Living Copilot Companion (Assessment Guidance Mode) */}
      <CraftureLivingCopilot context="assessment" currentStep={currentStep} step={step} />
    </div>
  )
}
