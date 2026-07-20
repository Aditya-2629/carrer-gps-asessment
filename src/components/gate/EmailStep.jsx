import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { EnvelopeSimple, SpinnerGap, ArrowRight, WarningCircle } from '@phosphor-icons/react'
import useAppStore, { GATE_STEPS } from '../../store/useAppStore'
import { api } from '../../lib/api'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export default function EmailStep() {
  const { setEmail, setGateStep } = useAppStore()
  const [shaking, setShaking] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: api.sendOtp,
    onSuccess: (data, variables) => {
      setEmail(variables.email)
      const setDevOtp = useAppStore.getState().setDevOtp
      if (data?.dev_otp) {
        setDevOtp(data.dev_otp)
      } else {
        setDevOtp('')
      }
      setGateStep(GATE_STEPS.OTP)
    },
    onError: () => {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    },
  })

  const onSubmit = (data) => mutation.mutate({ email: data.email })

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-xl font-bold mb-1.5"
          style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.95)' }}
        >
          Your Career GPS is ready!
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', lineHeight: '1.5' }}>
          Enter your email to unlock your personalized AI analysis.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <motion.div
          className={shaking ? 'shake' : ''}
          animate={shaking ? { x: [0, -8, 8, -6, 6, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-4 flex flex-col gap-2">
            <label
              htmlFor="email-input"
              className="text-xs font-semibold tracking-wider text-[rgba(255,255,255,0.5)] uppercase"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                {...register('email')}
                id="email-input"
                type="email"
                placeholder="you@example.com"
                autoFocus
                className={`premium-input ${errors.email ? 'error' : ''}`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </div>
            {errors.email && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                id="email-error"
                className="flex items-center gap-1.5 mt-1 text-sm"
                style={{ color: '#ef4444' }}
                role="alert"
              >
                <WarningCircle size={15} weight="fill" />
                <span>{errors.email.message}</span>
              </motion.div>
            )}
          </div>

          {mutation.isError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444',
              }}
              role="alert"
            >
              <WarningCircle size={16} weight="fill" />
              <span>{mutation.error?.message || 'Something went wrong. Please try again.'}</span>
            </motion.div>
          )}

          <button
            type="submit"
            id="send-otp-btn"
            className="btn-primary w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <SpinnerGap size={18} className="animate-spin" />
                <span>Sending secure code...</span>
              </>
            ) : (
              <>
                <span>Unlock Report</span>
                <ArrowRight size={16} weight="bold" />
              </>
            )}
          </button>
        </motion.div>
      </form>
    </div>
  )
}

