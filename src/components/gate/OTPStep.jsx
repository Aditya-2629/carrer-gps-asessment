import { useRef, useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { SpinnerGap, ArrowLeft, ArrowRight, WarningCircle } from '@phosphor-icons/react'
import useAppStore, { GATE_STEPS, PHASES } from '../../store/useAppStore'
import { api } from '../../lib/api'

const OTP_LENGTH = 6

export default function OTPStep() {
  const { email, setGateStep, setUserId, setPhase } = useAppStore()
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [isError, setIsError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputsRef = useRef([])

  const mutation = useMutation({
    mutationFn: api.verifyOtp,
    onSuccess: (data) => {
      setUserId(data.userId)
      setPhase(PHASES.LOADING)
    },
    onError: () => {
      setIsError(true)
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    },
  })

  const handleChange = useCallback(
    (index, value) => {
      const digit = value.replace(/\D/g, '').slice(-1)
      const newOtp = [...otp]
      newOtp[index] = digit
      setOtp(newOtp)
      setIsError(false)

      if (digit && index < OTP_LENGTH - 1) {
        inputsRef.current[index + 1]?.focus()
      }

      // Auto-submit when all filled
      if (digit && index === OTP_LENGTH - 1) {
        const fullOtp = [...newOtp.slice(0, OTP_LENGTH - 1), digit].join('')
        if (fullOtp.length === OTP_LENGTH) {
          setTimeout(() => mutation.mutate({ email, otp: fullOtp }), 200)
        }
      }
    },
    [otp, email, mutation]
  )

  const handleKeyDown = useCallback(
    (index, e) => {
      if (e.key === 'Backspace') {
        if (otp[index]) {
          const newOtp = [...otp]
          newOtp[index] = ''
          setOtp(newOtp)
        } else if (index > 0) {
          inputsRef.current[index - 1]?.focus()
        }
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        inputsRef.current[index - 1]?.focus()
      }
      if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
        inputsRef.current[index + 1]?.focus()
      }
    },
    [otp]
  )

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
      if (pasted.length > 0) {
        const newOtp = [...Array(OTP_LENGTH).fill('')]
        pasted.split('').forEach((ch, i) => { newOtp[i] = ch })
        setOtp(newOtp)
        const nextFocus = Math.min(pasted.length, OTP_LENGTH - 1)
        inputsRef.current[nextFocus]?.focus()
        if (pasted.length === OTP_LENGTH) {
          setTimeout(() => mutation.mutate({ email, otp: pasted }), 200)
        }
      }
    },
    [email, mutation]
  )

  const filledCount = otp.filter(Boolean).length
  const canVerify = filledCount === OTP_LENGTH && !mutation.isPending

  const handleVerify = () => {
    if (canVerify) mutation.mutate({ email, otp: otp.join('') })
  }

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-xl font-bold mb-1"
          style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.95)' }}
        >
          Check your inbox
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>
          Enter the 6-digit code sent to{' '}
          <span style={{ color: '#10b981', fontWeight: 500 }}>{email}</span>
        </p>
      </div>

      <motion.div
        animate={shaking ? { x: [0, -8, 8, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {/* Label for OTP inputs */}
        <label className="sr-only">One-Time Password Verification Code</label>

        {/* OTP Boxes */}
        <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <motion.input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              id={`otp-input-${i}`}
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={1}
              value={digit}
              autoFocus={i === 0}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`otp-input ${digit ? 'filled' : ''} ${isError ? 'error' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              disabled={mutation.isPending}
              aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
            />
          ))}
        </div>

        {/* Error message */}
        <AnimatePresence>
          {isError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl text-sm flex items-center justify-center gap-2"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444',
              }}
              role="alert"
            >
              <WarningCircle size={16} weight="fill" />
              <span>Invalid code. Please try again.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          id="verify-otp-btn"
          onClick={handleVerify}
          className="btn-primary w-full"
          disabled={!canVerify}
        >
          {mutation.isPending ? (
            <>
              <SpinnerGap size={18} className="animate-spin" />
              <span>Verifying identity...</span>
            </>
          ) : (
            <>
              <span>Verify & Unlock Report</span>
              <ArrowRight size={16} weight="bold" />
            </>
          )}
        </button>
      </motion.div>

      <div className="mt-5 text-center">
        <button
          onClick={() => setGateStep(GATE_STEPS.EMAIL)}
          className="text-sm inline-flex items-center gap-1.5"
          style={{ color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ArrowLeft size={14} />
          <span>Use a different email</span>
        </button>
      </div>
    </div>
  )
}
