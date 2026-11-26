import { useRef, useState, useCallback, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { SpinnerGap, ArrowLeft, ArrowRight, WarningCircle } from '@phosphor-icons/react'
import useAppStore, { GATE_STEPS, PHASES, showToast } from '../../store/useAppStore'
import { api } from '../../lib/api'
import { navigateTo } from '../../lib/navigation'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { trackAnalytics } from '../../lib/analytics'
import { trackEvent, identifyCandidate } from '../../lib/posthog'

const OTP_LENGTH = 6

export default function OTPStep() {
  const { email, setGateStep, setUserId, setPhase, setReportData, setSessionToken } = useAppStore()
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [isError, setIsError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(30)
  const [isResending, setIsResending] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [popKey, setPopKey] = useState(Array(OTP_LENGTH).fill(0))
  const [isCascadePaste, setIsCascadePaste] = useState(false)
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState(false)
  const inputsRef = useRef([])

  useEffect(() => {
    trackAnalytics({ currentPhase: 'gate', currentStep: 'otp', abandonedDraft: { email } })
  }, [email])

  // 30s countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return
    setIsResending(true)
    try {
      const res = await api.resendOtp({ email })
      if (res?.dev_otp) {
        useAppStore.getState().setDevOtp?.(res.dev_otp)
      }
      showToast('Verification code resent to your email.', 'success')
      setResendCooldown(30)
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Failed to resend verification code. Please try again shortly.'), 'error')
    } finally {
      setIsResending(false)
    }
  }

  const mutation = useMutation({
    mutationFn: api.verifyOtp,
    onSuccess: (data) => {
      identifyCandidate(email)
      trackEvent('assessment_submitted', { userId: data.userId, email })
      setIsError(false)
      setIsVerifiedSuccess(true)
      setUserId(data.userId)
      if (data.sessionToken) {
        setSessionToken(data.sessionToken)
      }
      setReportData(null)
      setTimeout(() => {
        setPhase(PHASES.LOADING)
        navigateTo('/loading')
      }, 720)
    },
    onError: (err) => {
      setIsError(true)
      setShaking(true)
      setTimeout(() => {
        setShaking(false)
        setOtp(Array(OTP_LENGTH).fill(''))
        setFocusedIndex(0)
        inputsRef.current[0]?.focus()
      }, 450)
      showToast(getFriendlyErrorMessage(err, 'Invalid verification code. Please check your inbox or code and try again.'), 'error')
    },
  })

  const handleChange = useCallback(
    (index, value) => {
      const clean = value.replace(/\D/g, '')
      if (clean.length > 1) {
        // Handle autofill / multi-char input cleanly
        const digits = clean.slice(0, OTP_LENGTH).split('')
        const nextOtp = Array(OTP_LENGTH).fill('')
        digits.forEach((d, idx) => { nextOtp[idx] = d })
        setIsCascadePaste(true)
        setOtp(nextOtp)
        setIsError(false)
        const nextFocus = Math.min(digits.length, OTP_LENGTH - 1)
        inputsRef.current[nextFocus]?.focus()
        if (digits.length === OTP_LENGTH) {
          setTimeout(() => mutation.mutate({ email, otp: digits.join('') }), 260)
        }
        return
      }

      const digit = clean.slice(-1)
      const newOtp = [...otp]
      newOtp[index] = digit
      setIsCascadePaste(false)
      setOtp(newOtp)
      setIsError(false)
      if (digit) {
        setPopKey((prev) => prev.map((k, idx) => (idx === index ? k + 1 : k)))
      }

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
        setIsCascadePaste(true)
        setIsError(false)
        setOtp(newOtp)
        const nextFocus = Math.min(pasted.length, OTP_LENGTH - 1)
        inputsRef.current[nextFocus]?.focus()
        if (pasted.length === OTP_LENGTH) {
          setTimeout(() => mutation.mutate({ email, otp: pasted }), 260)
        }
      }
    },
    [email, mutation]
  )

  const filledCount = otp.filter(Boolean).length
  const canVerify = filledCount === OTP_LENGTH && !mutation.isPending && !isVerifiedSuccess

  const handleVerify = () => {
    if (canVerify) mutation.mutate({ email, otp: otp.join('') })
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-7 shadow-xs">
      <div className="mb-6">
        <h2
          className="text-2xl font-bold mb-1 text-[#0F172A]"
          style={{ fontFamily: 'var(--font-head)' }}
        >
          Check your inbox
        </h2>
        <p className="text-slate-600 text-sm" style={{ fontFamily: 'var(--font-body)' }}>
          Enter the 6-digit code sent to{' '}
          <span className="text-[#15803D] font-semibold break-all">{email}</span>
        </p>
      </div>

      <motion.div
        animate={shaking ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.36, ease: 'easeInOut' }}
      >
        {/* Label for OTP inputs */}
        <label className="sr-only">One-Time Password Verification Code</label>

        {/* OTP Boxes / Success Morph Stage */}
        <div className="relative min-h-[76px] flex items-center justify-center mb-5" onPaste={handlePaste}>
          <AnimatePresence mode="wait">
            {isVerifiedSuccess ? (
              <motion.div
                key="otp-verified-badge"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className="flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-[#15803D] flex items-center justify-center shadow-md">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <motion.path
                      d="M5 13l4 4L19 7"
                      stroke="#FFFFFF"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.38, ease: 'easeOut', delay: 0.08 }}
                    />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-[#15803D]">
                  Verified. You&apos;re all set.
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="otp-boxes-row"
                exit={{ opacity: 0, scale: 0.75, transition: { duration: 0.16 } }}
                className="flex gap-1.5 sm:gap-2.5 justify-center w-full"
              >
                {otp.map((digit, i) => {
                  const isActive = focusedIndex === i && !mutation.isPending
                  return (
                    <motion.div
                      key={`${i}-${popKey[i]}`}
                      initial={
                        isCascadePaste && digit
                          ? { scale: 0.85, opacity: 0.6 }
                          : popKey[i] > 0
                            ? { scale: 1.06 }
                            : { opacity: 0, y: 8 }
                      }
                      animate={
                        mutation.isPending
                          ? { opacity: [1, 0.55, 1], scale: 1, y: 0 }
                          : { opacity: 1, scale: 1, y: 0 }
                      }
                      transition={
                        mutation.isPending
                          ? { duration: 0.9, repeat: Infinity, delay: i * 0.08 }
                          : isCascadePaste
                            ? { type: 'spring', stiffness: 460, damping: 24, delay: i * 0.035 }
                            : { type: 'spring', stiffness: 460, damping: 24 }
                      }
                    >
                      <input
                        ref={(el) => (inputsRef.current[i] = el)}
                        id={`otp-input-${i}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        pattern="\d*"
                        maxLength={i === 0 ? 6 : 1}
                        value={digit}
                        autoFocus={i === 0}
                        onFocus={() => setFocusedIndex(i)}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        disabled={mutation.isPending || isVerifiedSuccess}
                        aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                        className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold rounded-xl bg-white text-[#0F172A] border outline-none transition-all duration-150 ${
                          isError
                            ? 'border-[#F43F5E] shadow-[0_0_0_3px_rgba(244,63,94,0.16)]'
                            : isActive
                              ? 'border-[#15803D] ring-2 ring-[#15803D]/20'
                              : digit
                                ? 'border-[#15803D]/60 bg-emerald-50/30'
                                : 'border-[#E2E8F0] hover:border-slate-300'
                        }`}
                      />
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status / Resend Countdown */}
        <div className="flex justify-center mb-5 min-h-[44px] items-center">
          {mutation.isPending ? (
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#15803D]">
              <SpinnerGap size={15} className="animate-spin" />
              <span>Verifying...</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <span>Didn&apos;t receive the code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isResending || isVerifiedSuccess}
                className={`py-2 px-1.5 font-semibold transition-colors bg-transparent border-0 ${
                  resendCooldown > 0 || isResending
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-[#15803D] hover:underline cursor-pointer'
                }`}
              >
                {isResending
                  ? 'Sending...'
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Code'}
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        <AnimatePresence>
          {isError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl text-sm flex items-center justify-center gap-2 bg-rose-50 border border-rose-200 text-[#F43F5E]"
              role="alert"
            >
              <WarningCircle size={16} weight="fill" />
              <span>That code isn&apos;t right. Try again.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          id="verify-otp-btn"
          onClick={handleVerify}
          className="w-full min-h-[44px] rounded-xl bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          disabled={!canVerify}
        >
          {mutation.isPending ? (
            <>
              <SpinnerGap size={18} className="animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <span>Verify &amp; Unlock Report</span>
              <ArrowRight size={16} weight="bold" />
            </>
          )}
        </button>
      </motion.div>

      <div className="mt-4 text-center">
        <button
          onClick={() => setGateStep(GATE_STEPS.EMAIL)}
          disabled={mutation.isPending || isVerifiedSuccess}
          className="min-h-[44px] px-3 text-sm inline-flex items-center gap-1.5 text-slate-500 hover:text-[#0F172A] transition-colors cursor-pointer bg-transparent border-0"
        >
          <ArrowLeft size={14} />
          <span>Use a different email</span>
        </button>
      </div>
    </div>
  )
}
