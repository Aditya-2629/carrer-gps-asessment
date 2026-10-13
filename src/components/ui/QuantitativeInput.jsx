import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Calendar, CalendarDots, Sparkle } from '@phosphor-icons/react'

export default function QuantitativeInput({ value, onChange, error, step, onNext }) {
  // Parse incoming value into { raw, period, is_na }
  const parseVal = useCallback((v) => {
    if (v && typeof v === 'object') {
      return {
        raw: v.raw !== undefined && v.raw !== 'N/A' ? String(v.raw) : '',
        period: v.period && ['week', 'month'].includes(v.period) ? v.period : 'week',
        isNA: !!v.is_na || v.raw === 'N/A',
      }
    }
    if (v === 'N/A') {
      return { raw: '', period: 'week', isNA: true }
    }
    return {
      raw: v !== undefined && v !== null ? String(v) : '',
      period: 'week',
      isNA: false,
    }
  }, [])

  const initial = parseVal(value)
  const [rawVal, setRawVal] = useState(initial.raw)
  const [period, setPeriod] = useState(initial.period)
  const [isNA, setIsNA] = useState(initial.isNA)

  // Keep in sync with incoming store updates
  useEffect(() => {
    const parsed = parseVal(value)
    setRawVal(parsed.raw)
    setPeriod(parsed.period)
    setIsNA(parsed.isNA)
  }, [value, parseVal])

  // Helper to emit structured object
  const emitUpdate = (newRaw, newPeriod, newIsNA) => {
    if (newIsNA) {
      onChange({
        raw: 'N/A',
        period: 'na',
        per_week: null,
        per_month: null,
        formatted: 'N/A',
        is_na: true,
      })
      return
    }

    const cleaned = String(newRaw).replace(/[^0-9.]/g, '')
    const num = parseFloat(cleaned)
    const hasNum = !isNaN(num) && cleaned !== ''

    let perWeek = null
    let perMonth = null

    if (hasNum) {
      if (newPeriod === 'week') {
        perWeek = Math.round(num * 10) / 10
        perMonth = Math.round(num * 4.33)
      } else {
        perWeek = Math.round((num / 4.33) * 10) / 10
        perMonth = Math.round(num * 10) / 10
      }
    }

    onChange({
      raw: newRaw,
      period: newPeriod,
      per_week: perWeek,
      per_month: perMonth,
      formatted: newRaw ? `${newRaw}${step.unit ? ` ${step.unit}` : ''} per ${newPeriod}` : '',
      is_na: false,
    })
  }

  const handleNumberChange = (e) => {
    const val = e.target.value
    setRawVal(val)
    if (isNA) setIsNA(false)
    emitUpdate(val, period, false)
  }

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod)
    emitUpdate(rawVal, newPeriod, isNA)
  }

  const handlePresetClick = (preset) => {
    setIsNA(false)
    setRawVal(preset)
    emitUpdate(preset, period, false)
  }

  const handleNAToggle = () => {
    const nextNA = !isNA
    setIsNA(nextNA)
    if (nextNA) {
      setRawVal('')
      emitUpdate('', period, true)
    } else {
      emitUpdate(rawVal, period, false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onNext?.()
  }

  // Active presets based on period
  const activePresets = step.presets
    ? Array.isArray(step.presets)
      ? step.presets
      : step.presets[period] || step.presets.week || []
    : []

  // Normalized preview text
  const cleanedNum = parseFloat(String(rawVal).replace(/[^0-9.]/g, ''))
  const showConversion = !isNA && !isNaN(cleanedNum) && cleanedNum > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Timeframe Segmented Switcher */}
      <div className="flex items-center justify-between gap-3 p-1.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
        <span className="text-xs font-semibold text-[var(--text-secondary)] px-2 select-none">
          Cadence:
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handlePeriodChange('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
              period === 'week'
                ? 'bg-[var(--primary)] text-white shadow-sm ring-1 ring-[var(--primary)]/40'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)]'
            }`}
          >
            <Calendar size={14} weight={period === 'week' ? 'fill' : 'regular'} />
            <span>Per Week</span>
          </button>

          <button
            type="button"
            onClick={() => handlePeriodChange('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
              period === 'month'
                ? 'bg-[var(--primary)] text-white shadow-sm ring-1 ring-[var(--primary)]/40'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)]'
            }`}
          >
            <CalendarDots size={14} weight={period === 'month' ? 'fill' : 'regular'} />
            <span>Per Month</span>
          </button>
        </div>
      </div>

      {/* Main Numeric Input */}
      <div className="relative">
        <input
          id={`quant-input-${step.id}`}
          type={step.inputType || 'number'}
          value={rawVal}
          onChange={handleNumberChange}
          onKeyDown={handleKeyDown}
          placeholder={
            step.placeholder
              ? `${step.placeholder} (${step.unit ? `${step.unit} ` : ''}per ${period})`
              : `e.g., ${period === 'week' ? `15 ${step.unit ? `${step.unit} ` : ''}per week` : `60 ${step.unit ? `${step.unit} ` : ''}per month`}`
          }
          disabled={isNA}
          min={0}
          className={`premium-input ${step.unit ? 'pr-32' : 'pr-24'} ${error ? 'error' : ''}`}
          aria-label={step.label}
          aria-invalid={!!error}
        />

        {/* Units badge */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs font-semibold text-[var(--text-muted)] bg-[var(--surface-sunken)] px-2.5 py-1 rounded border border-[var(--border-default)]">
          {step.unit ? `${step.unit} / ${period}` : `/${period}`}
        </div>
      </div>

      {/* Normalized Intelligence Conversion Hint */}
      <AnimatePresence>
        {showConversion && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)]"
          >
            <Sparkle size={13} className="text-[var(--primary)] shrink-0" weight="fill" />
            <span>
              Normalized pace:{' '}
              <strong className="text-[var(--text-primary)]">
                {period === 'week'
                  ? `~${Math.round(cleanedNum * 4.33)} ${step.unit ? `${step.unit} ` : ''}/ month`
                  : `~${Math.round((cleanedNum / 4.33) * 10) / 10} ${step.unit ? `${step.unit} ` : ''}/ week`}
              </strong>{' '}
              (AI-calibrated)
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preset Buttons for the Selected Period */}
      {activePresets.length > 0 && !isNA && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)] mr-1">Quick Select:</span>
          {activePresets.map((p) => {
            const isSelected = String(rawVal) === String(p)
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetClick(p)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] font-semibold'
                    : 'bg-[var(--surface-sunken)] border-[var(--border-default)] hover:border-[var(--primary)] text-[var(--text-secondary)]'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>
      )}

      {/* Optional N/A Toggle */}
      {(step.hasNA || step.naLabel) && (
        <button
          type="button"
          id={`na-toggle-${step.id}`}
          onClick={handleNAToggle}
          className="na-toggle w-fit flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)] transition-all cursor-pointer"
          aria-pressed={isNA}
          aria-label={step.naLabel || 'Not Applicable'}
        >
          <div
            className={`w-4 h-4 rounded flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
              isNA
                ? 'bg-[var(--primary)] border border-[var(--primary)] text-white'
                : 'border border-[var(--border-strong)] bg-transparent'
            }`}
          >
            <AnimatePresence>
              {isNA && (
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
          <span
            className={`text-xs font-medium select-none ${
              isNA ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {step.naLabel || "Not Applicable / Don't Track"}
          </span>
        </button>
      )}
    </div>
  )
}
