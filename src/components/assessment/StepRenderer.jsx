import { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, RocketLaunch, WarningCircle, DiceThree, Sparkle } from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'
import PhoneInput from '../ui/PhoneInput'
import RadioGroup from '../ui/RadioGroup'
import CheckboxGroup from '../ui/CheckboxGroup'
import TextInput from '../ui/TextInput'
import LocationSearchInput from '../ui/LocationSearchInput'
import TextareaInput from '../ui/TextareaInput'
import FileUpload from '../ui/FileUpload'
import NumberNAInput from '../ui/NumberNAInput'
import QuantitativeInput from '../ui/QuantitativeInput'
import FunnelGridInput from '../ui/FunnelGridInput'
import TargetRoleInput from '../ui/TargetRoleInput'
import PresetOrNumberInput from '../ui/PresetOrNumberInput'
import FrustrationCustomInput from '../ui/FrustrationCustomInput'
import VisaLocationInput from '../ui/VisaLocationInput'
import OutreachReferralInput from '../ui/OutreachReferralInput'
import { getRandomAnswerForStep } from '../../lib/randomQuizFiller'
import { STEPS } from '../../lib/assessmentSteps'
import { normalizeLinkedInUrl } from '../../lib/linkedinUrlUtils'

export default function StepRenderer({ step, onNext, onBack, isFirst, isLast }) {
  const { formData, setFormData } = useAppStore()
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [randomRolling, setRandomRolling] = useState(false)
  const [activeReaction, setActiveReaction] = useState(null)

  const currentValue = formData[step.name]

  useEffect(() => {
    setActiveReaction(null)
  }, [step.id])

  const triggerError = useCallback((msg) => {
    setError(msg)
    setShaking(true)
    setTimeout(() => setShaking(false), 400)
  }, [])

  const handleValue = useCallback(
    (value) => {
      setFormData(step.name, value)
      setError('')

      // Synchronize backward-compatible keys
      if (step.name === 'funnel90d' && typeof value === 'object' && value !== null) {
        const screens = value.recruiterScreens ?? value.screens ?? 0
        const finals = value.finalRounds ?? value.finals ?? 0
        setFormData('interviews', screens)
        setFormData('humanScreen', screens)
        setFormData('recruiterScreens', screens)
        setFormData('assessments', value.assessments ?? 0)
        setFormData('aiInterviews', value.aiInterviews ?? 0)
        setFormData('technicalRounds', value.technicalRounds ?? 0)
        setFormData('finalRounds', finals)
        setFormData('offers', value.offers ?? 0)
        setFormData('joiningStatus', value.joiningStatus || 'No Offer Yet')
        setFormData('applications90d', value.applications90d ?? 60)
      } else if (step.name === 'apps30d') {
        const rawNum = parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0
        const weekly = Math.round(rawNum / 4.33)
        setFormData('appsWeek', weekly)
      } else if (step.name === 'visa' && typeof value === 'object' && value !== null) {
        if (value.visa) setFormData('visa', value.visa)
        if (value.location) setFormData('location', value.location)
      } else if (step.name === 'outreach' && typeof value === 'object' && value !== null) {
        if (value.outreach) setFormData('outreach', value.outreach)
        if (value.referralsMonth) setFormData('referralsMonth', value.referralsMonth)
      } else if (step.name === 'searchMethods') {
        let style = 'Speed-Clicker ⚡ — 80%+ LinkedIn \'Easy Apply\' & one-click blasts'
        if (Array.isArray(value)) {
          if (value.some((v) => v.includes('Referrals'))) {
            style = 'Referral Hunter 🤝 — DMing hiring managers, engineers & alumni before applying'
          } else if (value.some((v) => v.includes('Direct Recruiter'))) {
            style = 'The Customizer 🛠️ — Tailoring resume keywords for almost every job description'
          } else if (value.some((v) => v.includes('Company Career'))) {
            style = 'Portal Sniper 🎯 — Applying on direct company career portals with one master resume'
          }
        }
        setFormData('searchStyle', style)
      }

      if (step.reaction?.[value]) {
        setActiveReaction(step.reaction[value])
      }
    },
    [step, setFormData]
  )

  const handleRandomPick = useCallback(() => {
    setRandomRolling(true)
    const randomVal = getRandomAnswerForStep(step)
    handleValue(randomVal)
    setTimeout(() => {
      setRandomRolling(false)
    }, 250)
  }, [step, handleValue])

  const validate = useCallback(() => {
    const val = formData[step.name]
    if (step.required === false && (val === undefined || val === null || String(val).trim() === '')) {
      return true
    }

    if (step.type === 'funnel-grid') {
      return true
    }

    if (step.type === 'visa-location') {
      return true
    }

    if (step.type === 'outreach-referral') {
      return true
    }

    if (step.type === 'targetRole') {
      const target = val || formData.targetRole
      if (!target || !String(target).trim()) {
        triggerError('Please specify your target role.')
        return false
      }
      return true
    }

    if (step.type === 'frustration-custom') {
      const selected = typeof val === 'object' && val !== null ? val.selected : val
      if (!selected || !String(selected).trim()) {
        triggerError('Please select what you believe is your biggest problem.')
        return false
      }
      return true
    }

    if (val === undefined || val === null || val === '') {
      triggerError('This field is required.')
      return false
    }

    if (step.type === 'quantitative') {
      if (typeof val === 'object') {
        if (val.is_na) return true
        if (val.raw === undefined || val.raw === null || String(val.raw).trim() === '') {
          triggerError('Please enter a number or select N/A.')
          return false
        }
      } else if (String(val).trim() === '') {
        triggerError('Please enter a number or select N/A.')
        return false
      }
    }

    if (step.type === 'preset-or-number') {
      if (val === undefined || val === null || String(val).trim() === '') {
        triggerError('Please select a preset or enter a number.')
        return false
      }
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

    if (step.name === 'linkedin' || (step.type === 'input' && step.inputType === 'url')) {
      if (val && String(val).trim()) {
        const normalized = normalizeLinkedInUrl(String(val))
        if (normalized) {
          setFormData(step.name, normalized)
          return true
        }
        if (step.name !== 'linkedin') {
          try {
            new URL(String(val))
            return true
          } catch {
            try {
              new URL(`https://${String(val).trim()}`)
              setFormData(step.name, `https://${String(val).trim()}`)
              return true
            } catch {}
          }
        }
        triggerError('Please enter a valid LinkedIn URL (e.g. linkedin.com/in/username).')
        return false
      }
    }
    return true
  }, [formData, step, triggerError, setFormData, handleValue])

  const handleNext = useCallback(() => {
    if (!validate()) return

    // Step background scrape trigger: non-blocking LinkedIn scrape
    if (step.name === 'linkedin' && typeof formData.linkedin === 'string' && formData.linkedin.trim()) {
      const url = normalizeLinkedInUrl(formData.linkedin.trim()) || formData.linkedin.trim()
      window.__linkedinScrapePromise = api
        .scrapeLinkedInProfile(url)
        .then((res) => {
          if (res?.success && res?.profile) {
            useAppStore.getState().setFormData('linkedinData', res.profile)
            try {
              sessionStorage.setItem('craftureLinkedinScrape', JSON.stringify(res.profile))
            } catch (_e) {}
            return res.profile
          }
          return null
        })
        .catch(() => null)
    }

    onNext()
  }, [validate, onNext, step.name, formData.linkedin])

  return (
    <div className="quiz-card p-6 sm:p-8 relative">
      {/* Chapter & Journey Tracker */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {step.chapter && (
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              <span className="text-lg select-none">{step.icon || '🧭'}</span>
              <span>{step.chapter}</span>
            </div>
          )}
          {step.sceneTitle && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[11px] text-[var(--text-secondary)] font-medium border border-[var(--border-default)]">
              {step.sceneTitle}
            </span>
          )}
          {step.kicker && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[10px] text-[var(--primary)] font-mono border border-[var(--primary)]/20">
              {step.kicker}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Step badge */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--surface-strong)] border border-[var(--border-default)] text-[var(--text-muted)]"
            aria-label={step.isSetup ? `Setup ${step.id} of 2` : `Question ${step.questionNumber || step.id - 2} of 12`}
          >
            {step.isSetup ? `Setup ${step.id} of 2` : `Question ${step.questionNumber || step.id - 2} of 12`}
          </div>

          {/* Quick Random Choice */}
          <button
            type="button"
            onClick={handleRandomPick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] hover:bg-[var(--surface-strong)] transition-all cursor-pointer ${
              randomRolling ? 'scale-95 bg-[var(--surface-strong)] text-[var(--primary)]' : ''
            }`}
            title="Randomly pick an option for this question"
          >
            <DiceThree size={14} className={randomRolling ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Random Pick</span>
          </button>
        </div>
      </div>

      {/* Question Header */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <h2
          className="text-xl sm:text-2xl font-bold leading-snug mb-2 text-[var(--text-primary)]"
          style={{ letterSpacing: '-0.02em' }}
        >
          {step.label}
        </h2>

        {step.sublabel && (
          <p
            className="text-sm leading-relaxed text-[var(--text-muted)]"
            style={{ maxWidth: '58ch' }}
          >
            {step.sublabel}
          </p>
        )}

        {/* Interactive Micro Reaction */}
        <AnimatePresence>
          {(activeReaction || (step.reaction && step.reaction[currentValue])) && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="mt-3 px-3 py-1.5 rounded-full bg-[var(--primary-light)] border border-[var(--primary)]/30 text-xs font-semibold text-[var(--primary)] inline-flex items-center gap-2 shadow-sm"
            >
              <Sparkle size={14} weight="fill" className="text-[var(--primary)] shrink-0 animate-pulse" />
              <span>{activeReaction || step.reaction[currentValue]}</span>
            </motion.div>
          )}
        </AnimatePresence>
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
          />
        )}
        {step.type === 'checkbox' && (
          <CheckboxGroup value={currentValue} onChange={handleValue} error={error} step={step} />
        )}
        {step.type === 'targetRole' && (
          <TargetRoleInput value={currentValue} onChange={handleValue} error={error} onNext={handleNext} />
        )}
        {step.type === 'visa-location' && (
          <VisaLocationInput value={currentValue} onChange={handleValue} error={error} />
        )}
        {step.type === 'outreach-referral' && (
          <OutreachReferralInput value={currentValue} onChange={handleValue} error={error} />
        )}
        {step.type === 'funnel-grid' && (
          <FunnelGridInput value={currentValue} onChange={handleValue} error={error} />
        )}
        {step.type === 'preset-or-number' && (
          <PresetOrNumberInput
            value={currentValue}
            onChange={handleValue}
            presets={step.presets}
            unit={step.unit}
          />
        )}
        {step.type === 'frustration-custom' && (
          <FrustrationCustomInput
            value={currentValue}
            onChange={handleValue}
            options={step.options}
            optionIcons={step.optionIcons}
            error={error}
          />
        )}
        {(step.type === 'location' || step.name === 'location') && (
          <LocationSearchInput
            value={currentValue}
            onChange={handleValue}
            error={error}
            step={step}
            onNext={handleNext}
          />
        )}
        {step.type === 'input' && step.name !== 'location' && (
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
        {step.type === 'quantitative' && (
          <QuantitativeInput value={currentValue} onChange={handleValue} error={error} step={step} onNext={handleNext} />
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
            type="button"
            onClick={onBack}
            className="btn-ghost"
            id={`back-btn-${step.id}`}
            aria-label="Go to previous question"
          >
            <ArrowLeft size={15} weight="bold" />
            Back
          </button>
        )}

        <button
          type="button"
          onClick={handleNext}
          className="btn-primary flex-1"
          id={isLast ? `submit-btn-${step.id}` : `next-btn-${step.id}`}
        >
          {isLast ? (
            <>
              <span>Submit Assessment</span>
              <RocketLaunch size={16} weight="bold" />
            </>
          ) : (
            <>
              <span>Next</span>
              <ArrowRight size={15} weight="bold" />
            </>
          )}
        </button>
      </motion.div>
    </div>
  )
}
