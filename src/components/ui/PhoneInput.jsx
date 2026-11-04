import React from 'react'

export default function PhoneInput({
  value = '',
  onChange,
  error,
  step = {},
  onNext,
  placeholder = '(555) 000-0000',
}) {
  // Strip leading country code (+1 or 1) and format for clean 10-digit input box display
  const cleanAndFormat = (val) => {
    if (!val) return ''
    let digits = String(val).replace(/\D/g, '')
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1)
    } else {
      digits = digits.slice(0, 10)
    }

    if (digits.length > 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length > 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else if (digits.length > 0) {
      return `(${digits}`
    }
    return ''
  }

  const handlePhoneChange = (e) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 10)

    // Auto-format as (XXX) XXX-XXXX
    let formatted = rawDigits
    if (rawDigits.length > 6) {
      formatted = `(${rawDigits.slice(0, 3)}) ${rawDigits.slice(3, 6)}-${rawDigits.slice(6)}`
    } else if (rawDigits.length > 3) {
      formatted = `(${rawDigits.slice(0, 3)}) ${rawDigits.slice(3)}`
    } else if (rawDigits.length > 0) {
      formatted = `(${rawDigits}`
    }

    // Emit standardized +1 format to parent
    onChange?.(rawDigits ? `+1 ${formatted}` : '')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onNext?.()
  }

  const displayValue = cleanAndFormat(value)

  return (
    <div className="flex items-center gap-2 mt-4 max-w-md">
      {/* Country Flag & Code Box */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-3 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold select-none shadow-xs shrink-0">
        <span className="text-lg leading-none" role="img" aria-label="United States Flag">
          🇺🇸
        </span>
        <span className="text-sm font-medium text-[var(--text-secondary)]">+1</span>
      </div>

      {/* Actual Phone Input */}
      <input
        id={`phone-input-${step?.id || 'phone'}`}
        type="tel"
        value={displayValue}
        onChange={handlePhoneChange}
        onKeyDown={handleKeyDown}
        placeholder={step?.placeholder || placeholder}
        className={`premium-input flex-1 px-4 py-3 border border-[var(--border-default)] rounded-xl text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${error ? 'error' : ''}`}
        autoComplete="tel"
        aria-label={step?.label || 'Phone Number'}
        aria-invalid={!!error}
      />
    </div>
  )
}
