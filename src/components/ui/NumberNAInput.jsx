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

  const handlePresetClick = (preset) => {
    setChecked(false)
    setInputVal(preset)
    onChange(preset)
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

      {/* Preset shortcuts */}
      {step.presets && step.presets.length > 0 && !checked && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)] mr-1">Quick Select:</span>
          {step.presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePresetClick(p)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                inputVal === p
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] font-semibold'
                  : 'bg-[var(--surface-sunken)] border-[var(--border-default)] hover:border-[var(--primary)] text-[var(--text-secondary)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* N/A Toggle Checkbox Button */}
      <button
        type="button"
        id={`na-toggle-${step.id}`}
        onClick={handleNAToggle}
        className="na-toggle w-fit flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)] transition-all cursor-pointer"
        aria-pressed={checked}
        aria-label={step.naLabel}
      >
        <div
          className={`w-4 h-4 rounded flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
            checked
              ? 'bg-[var(--primary)] border border-[var(--primary)] text-white'
              : 'border border-[var(--border-strong)] bg-transparent'
          }`}
        >
          <AnimatePresence>
            {checked && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check size={11} weight="bold" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className={`text-xs font-medium select-none ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
          {step.naLabel}
        </span>
      </button>
    </div>
  )
}

