import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function RadioGroup({ value, onChange, onAutoAdvance, error, step }) {
  const [showOther, setShowOther] = useState(
    value && !step.options.slice(0, -1).includes(value) && step.hasOther
  )
  const [otherText, setOtherText] = useState(
    showOther ? value : ''
  )

  const mainOptions = step.hasOther
    ? step.options.filter((o) => o !== 'Other')
    : step.options

  const handleSelect = (option) => {
    if (option === 'Other') {
      setShowOther(true)
      onChange('Other')
      return
    }
    setShowOther(false)
    if (onAutoAdvance) {
      onAutoAdvance(option)
    } else {
      onChange(option)
    }
  }

  const handleOtherChange = (e) => {
    setOtherText(e.target.value)
    onChange(e.target.value)
  }

  const isScrollable = step.options.length > 6

  const gridContent = (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={step.label}>
      {mainOptions.map((option) => {
        const isSelected = value === option
        return (
          <button
            key={option}
            id={`radio-${step.name}-${option.replace(/\s+/g, '-')}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handleSelect(option)}
            className={`radio-option ${isSelected ? 'selected' : ''}`}
          >
            <div className={`radio-dot ${isSelected ? 'border-emerald-500' : ''}`} aria-hidden="true">
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    className="radio-dot-inner"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  />
                )}
              </AnimatePresence>
            </div>
            <span
              className="text-sm leading-snug text-left font-medium"
              style={{ color: isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)' }}
            >
              {option}
            </span>
          </button>
        )
      })}

      {/* Other option */}
      {step.hasOther && (
        <button
          key="Other"
          id={`radio-${step.name}-Other`}
          type="button"
          role="radio"
          aria-checked={showOther}
          onClick={() => handleSelect('Other')}
          className={`radio-option ${showOther ? 'selected' : ''}`}
        >
          <div className={`radio-dot`} aria-hidden="true">
            <AnimatePresence>
              {showOther && (
                <motion.div
                  className="radio-dot-inner"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                />
              )}
            </AnimatePresence>
          </div>
          <span
            className="text-sm font-medium"
            style={{ color: showOther ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)' }}
          >
            Other
          </span>
        </button>
      )}
    </div>
  )

  return (
    <div>
      {isScrollable ? (
        <div
          className="overflow-y-auto pr-1"
          style={{ maxHeight: '55vh' }}
        >
          {gridContent}
        </div>
      ) : (
        gridContent
      )}

      {/* Conditional "Other" text input */}
      <AnimatePresence>
        {showOther && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mt-3 overflow-hidden"
          >
            <input
              id={`other-input-${step.name}`}
              type="text"
              value={otherText}
              onChange={handleOtherChange}
              placeholder="Please specify..."
              className={`premium-input ${error ? 'error' : ''}`}
              autoFocus
              aria-label="Specify other option"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

