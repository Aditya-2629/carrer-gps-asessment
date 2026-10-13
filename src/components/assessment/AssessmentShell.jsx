import { AnimatePresence, motion } from 'framer-motion'
import { NavigationArrow, Lightning, FileText, DiceThree, Sun, Moon } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { STEPS, CHAPTERS } from '../../lib/assessmentSteps'
import StepRenderer from './StepRenderer'
import brandLogo from '../../assets/images/crafture-logo.jpg'
import { generateAllRandomAssessmentData } from '../../lib/randomQuizFiller'

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

const SAMPLE_TEST_DATA = {
  phone: '555-019-2834',
  visa: 'STEM OPT',
  relocate: 'Yes',
  location: 'New York, San Francisco, Remote',
  linkedin: 'https://www.linkedin.com/in/satyanadella',
  resumeVersions: '3',
  atsScore: '85%',
  customizeResume: 'Yes',
  employmentGap: 'No',
  metrics: 'Yes',
  linkedinOpt: 'Yes',
  linkedinCon: { raw: '25', period: 'week', per_week: 25, per_month: 108, formatted: '25 per week', is_na: false },
  coldEmails: { raw: '20', period: 'week', per_week: 20, per_month: 87, formatted: '20 per week', is_na: false },
  consultancy: 'No (Doing it all by myself — 100% Solo)',
  appsWeek: { raw: '30', period: 'week', per_week: 30, per_month: 130, formatted: '30 per week', is_na: false },
  easyApply: { raw: '5', period: 'week', per_week: 5, per_month: 22, formatted: '5 per week', is_na: false },
  aiScreen: { raw: '2', period: 'month', per_week: 0.5, per_month: 2, formatted: '2 per month', is_na: false },
  humanScreen: { raw: '3', period: 'month', per_week: 0.7, per_month: 3, formatted: '3 per month', is_na: false },
  assessments: { raw: '2', period: 'month', per_week: 0.5, per_month: 2, formatted: '2 per month', is_na: false },
  assessScore: '85%',
  assessType: ['Technical Assessment (Coding, SQL, System Design, Cloud, Cybersecurity)'],
  mockInterviews: 'Yes',
  codeInterviews: 'No',
  feedback: ['Rarely receive rejection emails or feedback'],
  hoursWeek: { raw: '20', period: 'week', per_week: 20, per_month: 87, formatted: '20 hours per week', is_na: false },
  biggestChallenge: 'Passing technical coding and recruiter ghosting',
  triedImprove: 'Rewrote resume with ATS keywords',
  aiTools: ['ATS Resume Keyword Matching Tool', 'AI Mock Interview Platform'],
  strategies: ['Resume customized for every Job Description', 'LinkedIn Profile Optimization'],
  investGuidance: 'Yes',
}

export default function AssessmentShell() {
  const { currentStep, direction, setCurrentStep, setPhase, setBulkFormData, theme, toggleTheme } = useAppStore()
  const step = STEPS[currentStep]
  const totalSteps = STEPS.length
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100)
  const activeChapter = CHAPTERS.find((c) => step.id >= c.range[0] && step.id <= c.range[1]) || CHAPTERS[0]

  const handleQuickAutofill = () => {
    setBulkFormData(SAMPLE_TEST_DATA)
    setCurrentStep(totalSteps - 1, 1)
  }

  const handleRandomFill = () => {
    const randomData = generateAllRandomAssessmentData()
    setBulkFormData(randomData)
    setCurrentStep(totalSteps - 1, 1)
  }

  const handleDirectReportView = () => {
    setPhase(PHASES.REPORT)
  }

  const goNext = () => {
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

          {/* Quick Actions & Testing Tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRandomFill}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--surface-strong)] border border-[var(--border-default)] text-[var(--primary)] hover:border-[var(--primary)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Fill all 31 questions with realistic randomized options and jump to end"
            >
              <DiceThree size={15} weight="bold" />
              <span className="hidden sm:inline">Random Fill</span>
            </button>

            <button
              onClick={handleQuickAutofill}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--surface-strong)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Autofill sample test data & jump to end"
            >
              <Lightning size={14} weight="fill" />
              <span className="hidden md:inline">Sample Fill</span>
            </button>

            <button
              onClick={handleDirectReportView}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--surface-strong)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Directly view report dashboard"
            >
              <FileText size={14} weight="bold" />
              <span className="hidden md:inline">Report</span>
            </button>

            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)] transition-all cursor-pointer"
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
        className="flex-1 flex flex-col items-center justify-center px-4 py-10 overflow-hidden"
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
    </div>
  )
}
