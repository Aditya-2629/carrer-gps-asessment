import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from '@phosphor-icons/react'

const NA_VALUE = 'N/A'

export default function NumberNAInput({ value, onChange, error, step, onNext }) {
  const isNA = value === NA_VALUE
  const [inputVal, setInputVal] = useState(isNA ? '' : (value || ''))
  const [checked, setChecked] = useState(isNA)

  useEffect(() => {
    if (value === NA_VALUE) {
      setChecked(true)
      setInputVal('')
    } else if (value !== undefined && value !== '') {
      setChecked(false)
      setInputVal(value)
    }
  }, [value])

  const handleInputChange = (e) => {
    const v = e.target.value
    setInputVal(v)
    onChange(v)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onNext?.()
  }

  const handleNAToggle = () => {
    const next = !checked
    setChecked(next)
    if (next) {
      setInputVal('')
      onChange(NA_VALUE)
    } else {
      onChange('')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        id={`na-input-${step.id}`}
        type={step.inputType || 'text'}
        value={inputVal}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={step.placeholder}
        disabled={checked}
        className={`premium-input ${error ? 'error' : ''}`}
        min={step.inputType === 'number' ? 0 : undefined}
        aria-label={step.label}
        aria-invalid={!!error}
      />

      {/* N/A Toggle Checkbox Button */}
      <button
        type="button"
        id={`na-toggle-${step.id}`}
        onClick={handleNAToggle}
        className="na-toggle w-fit"
        aria-pressed={checked}
        aria-label={step.naLabel}
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150 flex-shrink-0"
          style={{
            background: checked ? '#10b981' : 'rgba(255,255,255,0.05)',
            border: checked ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <AnimatePresence>
            {checked && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                style={{ color: '#050505' }}
              >
                <Check size={12} weight="bold" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="text-sm" style={{ color: checked ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)' }}>
          {step.naLabel}
        </span>
      </button>
    </div>
  )
}

