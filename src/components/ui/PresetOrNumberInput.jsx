import { useState, useEffect } from 'react'
import { parseRangeOrNumber } from '../../../backend/agents/assessment/assessmentAgent'

export { parseRangeOrNumber }

export default function PresetOrNumberInput({ value, onChange, presets = [], unit = '', placeholder = 'Enter number' }) {
  const [val, setVal] = useState(value !== undefined && value !== null ? String(value) : '')

  useEffect(() => {
    if (value !== undefined && value !== null && String(value) !== val) {
      setVal(String(value))
    }
  }, [value])

  const handleSelectPreset = (p) => {
    setVal(p)
    onChange(p)
  }

  const handleCustomInput = (text) => {
    setVal(text)
    onChange(text)
  }

  const isRangePreset = /[–—-]/.test(val)
  const customInputValue = isRangePreset ? '' : (val ? String(val).replace(/[^0-9]/g, '') : '')

  return (
    <div className="space-y-4">
      {/* Preset Chips */}
      <div>
        <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
          Select standard volume:
        </span>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const isSelected = val === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white shadow-sm font-bold scale-[1.02]'
                    : 'bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                }`}
              >
                {preset} {unit ? <span className="text-xs font-normal opacity-80">{unit}</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Or Custom Number */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
          Or enter exact number:
        </label>
        <div className="relative max-w-xs">
          <input
            type="number"
            min="0"
            max="10000"
            value={customInputValue}
            onChange={(e) => handleCustomInput(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none text-sm font-semibold transition-all shadow-xs"
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] font-medium">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
