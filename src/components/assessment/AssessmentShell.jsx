import { AnimatePresence, motion } from 'framer-motion'
import { NavigationArrow } from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { STEPS } from '../../lib/assessmentSteps'
import StepRenderer from './StepRenderer'

const slideVariants = {
  enter: (dir) => ({
    x: dir > 0 ? '60%' : '-60%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 320, damping: 32 },
  },
  exit: (dir) => ({
    x: dir > 0 ? '-30%' : '30%',
    opacity: 0,
    transition: { duration: 0.18, ease: [0.55, 0, 1, 0.45] },
  }),
}

export default function AssessmentShell() {
  const { currentStep, direction, setCurrentStep, setPhase } = useAppStore()
  const step = STEPS[currentStep]
  const totalSteps = STEPS.length
  const progress = (currentStep / totalSteps) * 100

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
    <div className="min-h-[100dvh] flex flex-col">
      {/* Top bar */}
      <header
        role="banner"
        className="sticky top-0 z-50 px-4 py-3.5"
        style={{
          background: 'rgba(5,5,5,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {/* Brand mark */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
              aria-hidden="true"
            >
              <NavigationArrow size={14} weight="fill" style={{ color: '#10b981' }} />
            </div>
            <span
              className="text-sm font-semibold hidden sm:inline"
              style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.6)' }}
            >
              Career GPS
            </span>
          </div>

          {/* Progress */}
          <div className="flex-1">
            <div className="progress-track" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemax={totalSteps} aria-label="Assessment progress">
              <motion.div
                className="progress-fill"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
              />
            </div>
          </div>

          <span
            className="text-xs font-medium tabular-nums shrink-0"
            style={{ color: 'rgba(255,255,255,0.32)', fontFamily: 'Space Grotesk, sans-serif' }}
            aria-live="polite"
            aria-label={`Question ${currentStep + 1} of ${totalSteps}`}
          >
            {currentStep + 1} / {totalSteps}
          </span>
        </div>
      </header>

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
