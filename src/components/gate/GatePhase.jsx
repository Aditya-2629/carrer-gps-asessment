import { AnimatePresence, motion } from 'framer-motion'
import { NavigationArrow } from '@phosphor-icons/react'
import useAppStore, { GATE_STEPS } from '../../store/useAppStore'
import EmailStep from './EmailStep'
import OTPStep from './OTPStep'

export default function GatePhase() {
  const gateStep = useAppStore((s) => s.gateStep)

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12">
      {/* Brand logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 text-center"
      >
        <div className="inline-flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}
            aria-hidden="true"
          >
            <NavigationArrow
              size={15}
              weight="fill"
              style={{ color: '#10b981' }}
            />
          </div>
          <span
            className="text-base font-semibold tracking-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.6)' }}
          >
            Career GPS
          </span>
        </div>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <div className="glass p-8 emerald-glow">
          <AnimatePresence mode="wait">
            {gateStep === GATE_STEPS.EMAIL ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
              >
                <EmailStep />
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
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
        transition={{ delay: 0.3 }}
        className="mt-8 text-xs text-center"
        style={{ color: 'rgba(255,255,255,0.22)' }}
      >
        Your data is encrypted and never sold. Unsubscribe anytime.
      </motion.p>
    </div>
  )
}
