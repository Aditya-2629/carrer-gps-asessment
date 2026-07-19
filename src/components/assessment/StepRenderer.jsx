import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, RocketLaunch, WarningCircle } from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import PhoneInput from '../ui/PhoneInput'
import RadioGroup from '../ui/RadioGroup'
import CheckboxGroup from '../ui/CheckboxGroup'
import TextInput from '../ui/TextInput'
import TextareaInput from '../ui/TextareaInput'
import FileUpload from '../ui/FileUpload'
import NumberNAInput from '../ui/NumberNAInput'

export default function StepRenderer({ step, onNext, onBack, isFirst, isLast }) {
  const { formData, setFormData } = useAppStore()
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)

  const currentValue = formData[step.name]

  const triggerError = useCallback((msg) => {
    setError(msg)
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }, [])

  const handleValue = useCallback(
    (value) => {
      setFormData(step.name, value)
      setError('')
    },
    [step.name, setFormData]
  )

  const validate = useCallback(() => {
    if (!step.required) return true
    const val = formData[step.name]
    if (val === undefined || val === null || val === '') {
      triggerError('This field is required.')
      return false
    }
    if (Array.isArray(val) && val.length === 0) {
      triggerError('Please select at least one option.')
      return false
    }
    if (step.type === 'phone') {
      const digits = String(val).replace(/\D/g, '')
      if (digits.length < 10) {
        triggerError('Please enter a valid 10-digit phone number.')
        return false
      }
    }
    if (step.type === 'input' && step.inputType === 'url') {
      try { new URL(val) } catch {
        triggerError('Please enter a valid URL (e.g. https://linkedin.com/in/...).')
        return false
      }
    }
    return true
  }, [formData, step, triggerError])

  const handleNext = useCallback(() => {
    if (validate()) onNext()
  }, [validate, onNext])

  const handleAutoAdvance = useCallback(
    (value) => {
      setFormData(step.name, value)
      setError('')
      setTimeout(() => onNext(), 300)
    },
    [step.name, setFormData, onNext]
  )

  const isAutoAdvanceRadio = step.type === 'radio' && step.autoAdvance

  return (
    <div>
      {/* Question Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mb-7"
      >
        {/* Step badge */}
        <div
          className="inline-flex items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{
            background: 'rgba(16,185,129,0.09)',
            border: '1px solid rgba(16,185,129,0.18)',
            color: '#10b981',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
          aria-label={`Question ${step.id} of 31`}
        >
          {step.id} of 31
        </div>

        <h2
          className="text-2xl sm:text-[1.75rem] font-bold leading-tight mb-2.5"
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            letterSpacing: '-0.025em',
            color: 'rgba(255,255,255,0.94)',
          }}
        >
          {step.label}
        </h2>

        {step.sublabel && (
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.38)', maxWidth: '52ch' }}
          >
            {step.sublabel}
          </p>
        )}
      </motion.div>

      {/* Input */}
      <motion.div
        animate={shaking ? { x: [0, -5, 5, -4, 4, 0] } : {}}
        transition={{ duration: 0.38 }}
      >
        {step.type === 'phone' && (
          <PhoneInput value={currentValue} onChange={handleValue} error={error} step={step} onNext={handleNext} />
        )}
        {step.type === 'radio' && (
          <RadioGroup
            value={currentValue}
            onChange={handleValue}
            error={error}
            step={step}
            onAutoAdvance={step.autoAdvance ? handleAutoAdvance : null}
          />
        )}
        {step.type === 'checkbox' && (
          <CheckboxGroup value={currentValue} onChange={handleValue} error={error} step={step} />
        )}
        {step.type === 'input' && (
          <TextInput value={currentValue} onChange={handleValue} error={error} step={step} onNext={handleNext} />
        )}
        {step.type === 'textarea' && (
          <TextareaInput value={currentValue} onChange={handleValue} error={error} step={step} />
        )}
        {step.type === 'file' && (
          <FileUpload value={currentValue} onChange={handleValue} error={error} step={step} onNext={handleNext} />
        )}
        {step.type === 'input-na' && (
          <NumberNAInput value={currentValue} onChange={handleValue} error={error} step={step} onNext={handleNext} />
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2 mt-3"
              role="alert"
              aria-live="assertive"
            >
              <WarningCircle size={15} weight="fill" style={{ color: '#ef4444', flexShrink: 0 }} />
              <p className="text-sm" style={{ color: '#ef4444' }}>
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center gap-3 mt-8"
      >
        {!isFirst && (
          <button
            onClick={onBack}
            className="btn-ghost"
            id={`back-btn-${step.id}`}
            aria-label="Go to previous question"
          >
            <ArrowLeft size={15} weight="bold" />
            Back
          </button>
        )}

        {/* Only show Next for non-autoAdvance steps */}
        {!isAutoAdvanceRadio && (
          <button
            onClick={handleNext}
            className="btn-primary flex-1"
            id={`next-btn-${step.id}`}
          >
            {isLast ? (
              <>
                <span>Continue</span>
                <ArrowRight size={15} weight="bold" />
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight size={15} weight="bold" />
              </>
            )}
          </button>
        )}
      </motion.div>
    </div>
  )
}
