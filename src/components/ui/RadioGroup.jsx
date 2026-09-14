import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function RadioGroup({ value, onChange, error, step }) {
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
    onChange(option)
  }

  const handleOtherChange = (e) => {
    setOtherText(e.target.value)
    onChange(e.target.value)
  }

  // Creative Interactivity: Number Key Shortcuts (1, 2, 3...)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      const num = parseInt(e.key, 10)
      if (!isNaN(num) && num >= 1 && num <= mainOptions.length) {
        e.preventDefault()
        handleSelect(mainOptions[num - 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mainOptions])

  const isScrollable = step.options.length > 6

  const isBinary = mainOptions.length === 2
  const gridClass = isBinary
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
    : 'flex flex-col gap-2.5'

  const gridContent = (
    <div className={gridClass} role="radiogroup" aria-label={step.label}>
      {mainOptions.map((option, idx) => {
        const isSelected = value === option
        const icon = step.optionIcons?.[option]
        return (
          <button
            key={option}
            id={`radio-${step.name}-${option.replace(/\s+/g, '-')}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handleSelect(option)}
            className={`radio-option group ${isSelected ? 'selected' : ''} ${
              isBinary ? 'p-5 sm:p-6 flex-row sm:flex-col sm:items-start justify-start text-left' : ''
            }`}
          >
            <div className="flex items-center gap-3 w-full">
              <div className="radio-dot" aria-hidden="true">
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      className="radio-dot-inner"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    />
                  )}
                </AnimatePresence>
              </div>

              {icon && (
                <span className="text-xl sm:text-2xl select-none" aria-hidden="true">
                  {icon}
                </span>
              )}

              <span
                className="text-sm sm:text-base leading-snug text-left font-semibold text-[var(--text-primary)] flex-1"
              >
                {option}
              </span>

              {idx < 9 && (
                <span className="key-hint" aria-hidden="true">
                  {idx + 1}
                </span>
              )}
            </div>
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
          <div className="flex items-center gap-3 w-full">
            <div className="radio-dot" aria-hidden="true">
              <AnimatePresence>
                {showOther && (
                  <motion.div
                    className="radio-dot-inner"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  />
                )}
              </AnimatePresence>
            </div>
            <span className="text-xl sm:text-2xl select-none" aria-hidden="true">
              🌐
            </span>
            <span className="text-sm sm:text-base font-semibold text-[var(--text-primary)] flex-1">
              Other
            </span>
          </div>
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

