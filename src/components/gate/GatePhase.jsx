import { AnimatePresence, motion } from 'framer-motion'
import useAppStore, { GATE_STEPS } from '../../store/useAppStore'
import EmailStep from './EmailStep'
import OTPStep from './OTPStep'
import brandLogo from '../../assets/images/crafture-logo.jpg'

export default function GatePhase() {
  const gateStep = useAppStore((s) => s.gateStep)

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12">
      {/* Brand logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 text-center"
      >
        <div className="inline-flex items-center gap-3">
          <img
            src={brandLogo}
            alt="Career GPS"
            className="w-10 h-10 rounded-xl object-cover border border-[var(--border-default)] shadow-sm"
          />
          <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-['Poppins']">
            Career <span className="text-[var(--primary)]">GPS™</span>
          </span>
        </div>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <div className="quiz-card p-8">
          <AnimatePresence mode="wait">
            {gateStep === GATE_STEPS.EMAIL ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <EmailStep />
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <OTPStep />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Trust signal */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-xs text-center text-[var(--text-tertiary)]"
      >
        Your data is encrypted and never sold. Unsubscribe anytime.
      </motion.p>
    </div>
  )
}
