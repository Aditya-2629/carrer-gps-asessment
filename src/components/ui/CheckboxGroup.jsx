import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from '@phosphor-icons/react'

export default function CheckboxGroup({ value = [], onChange, error, step }) {
  const [showOther, setShowOther] = useState(false)
  const [otherText, setOtherText] = useState('')

  const selected = Array.isArray(value) ? value : []

  const mainOptions = step.hasOther
    ? step.options.filter((o) => o !== 'Other')
    : step.options

  const toggleOption = (option) => {
    const isSelected = selected.includes(option)
    let next
    if (isSelected) {
      next = selected.filter((s) => s !== option)
    } else {
      next = [...selected, option]
    }
    onChange(next)
  }

  const handleOtherToggle = () => {
    setShowOther((prev) => !prev)
    if (showOther) {
      setOtherText('')
      onChange(selected.filter((s) => s !== otherText && s !== 'Other' && !s.startsWith('Other:')))
    }
  }

  const handleOtherText = (e) => {
    const text = e.target.value
    setOtherText(text)
    const withoutOther = selected.filter((s) => !s.startsWith('Other:'))
    if (text) {
      onChange([...withoutOther, `Other: ${text}`])
    } else {
      onChange(withoutOther)
    }
  }

  const isScrollable = step.options.length > 6

  const content = (
    <div className="flex flex-col gap-2" role="group" aria-label={step.label}>
      {mainOptions.map((option) => {
        const isSelected = selected.includes(option)
        return (
          <button
            key={option}
            id={`checkbox-${step.name}-${option.slice(0, 20).replace(/\s+/g, '-')}`}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            onClick={() => toggleOption(option)}
            className={`checkbox-option ${isSelected ? 'selected' : ''}`}
          >
            <div className="checkbox-box" aria-hidden="true">
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    style={{ color: '#050505' }}
                  >
                    <Check size={10} weight="bold" />
                  </motion.div>
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

      {/* Other toggle */}
      {step.hasOther && (
        <button
          key="Other"
          id={`checkbox-${step.name}-Other`}
          type="button"
          role="checkbox"
          aria-checked={showOther}
          onClick={handleOtherToggle}
          className={`checkbox-option ${showOther ? 'selected' : ''}`}
        >
          <div className="checkbox-box" aria-hidden="true">
            <AnimatePresence>
              {showOther && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  style={{ color: '#050505' }}
                >
                  <Check size={10} weight="bold" />
                </motion.div>
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
        <div className="overflow-y-auto pr-1" style={{ maxHeight: '55vh' }}>
          {content}
        </div>
      ) : (
        content
      )}

      {/* Conditional Other input */}
      <AnimatePresence>
        {showOther && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3 overflow-hidden"
          >
            <input
              id={`other-text-${step.name}`}
              type="text"
              value={otherText}
              onChange={handleOtherText}
              placeholder="Please specify..."
              className={`premium-input ${error ? 'error' : ''}`}
              autoFocus
              aria-label="Specify other option text"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

