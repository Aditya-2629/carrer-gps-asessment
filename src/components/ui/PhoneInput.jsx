import React, { useMemo } from 'react'

const COUNTRY_HINTS = [
  { code: '971', flag: '🇦🇪', label: 'UAE' },
  { code: '91', flag: '🇮🇳', label: 'India' },
  { code: '44', flag: '🇬🇧', label: 'UK' },
  { code: '61', flag: '🇦🇺', label: 'Australia' },
  { code: '65', flag: '🇸🇬', label: 'Singapore' },
  { code: '49', flag: '🇩🇪', label: 'Germany' },
  { code: '33', flag: '🇫🇷', label: 'France' },
  { code: '1', flag: '🇺🇸', label: 'US / Canada' },
]

function parseCountryAndLocal(val) {
  if (!val) return { countryCode: '1', flag: '🇺🇸', label: 'US / Canada', local: '', hasExplicitCode: false }
  const strVal = String(val).trim()
  if (strVal === 'N/A' || strVal.toLowerCase() === 'undefined' || strVal.toLowerCase() === 'null') {
    return { countryCode: '1', flag: '🇺🇸', label: 'US / Canada', local: '', hasExplicitCode: false }
  }

  const digits = strVal.replace(/\D/g, '')
  if (!digits) return { countryCode: '1', flag: '🇺🇸', label: 'US / Canada', local: '', hasExplicitCode: false }

  if (strVal.startsWith('+') || strVal.startsWith('00')) {
    const cleanDigits = strVal.startsWith('00') ? digits.slice(2) : digits
    for (const c of COUNTRY_HINTS) {
      if (cleanDigits.startsWith(c.code)) {
        return {
          countryCode: c.code,
          flag: c.flag,
          label: c.label,
          local: cleanDigits.slice(c.code.length, 15),
          hasExplicitCode: true,
        }
      }
    }
    const ccMatch = strVal.match(/^\+(\d{1,3})[\s.-]*(.*)$/)
    if (ccMatch) {
      return {
        countryCode: ccMatch[1],
        flag: '🌐',
        label: `Country +${ccMatch[1]}`,
        local: ccMatch[2].replace(/\D/g, '').slice(0, 12),
        hasExplicitCode: true,
      }
    }
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return { countryCode: '1', flag: '🇺🇸', label: 'US / Canada', local: digits.slice(1), hasExplicitCode: true }
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return { countryCode: '91', flag: '🇮🇳', label: 'India', local: digits.slice(2), hasExplicitCode: true }
  }

  return { countryCode: '1', flag: '🇺🇸', label: 'US / Canada', local: digits.slice(0, 12), hasExplicitCode: false }
}

function formatLocalNumber(countryCode, localDigits) {
  if (!localDigits) return ''
  if (countryCode === '1') {
    if (localDigits.length > 6) {
      return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6, 10)}`
    }
    if (localDigits.length > 3) {
      return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3)}`
    }
    return `(${localDigits}`
  }
  if (countryCode === '91' && localDigits.length > 5) {
    return `${localDigits.slice(0, 5)} ${localDigits.slice(5, 10)}`
  }
  return localDigits
}

export default function PhoneInput({
  value = '',
  onChange,
  error,
  step = {},
  onNext,
  placeholder = '(555) 000-0000',
}) {
  const parsed = useMemo(() => parseCountryAndLocal(value), [value])
  const displayValue = useMemo(
    () => formatLocalNumber(parsed.countryCode, parsed.local),
    [parsed.countryCode, parsed.local]
  )

  const handlePhoneChange = (e) => {
    const raw = e.target.value
    // Allow pasting or typing a full international number with '+'
    if (raw.trim().startsWith('+')) {
      const nextParsed = parseCountryAndLocal(raw)
      const formatted = formatLocalNumber(nextParsed.countryCode, nextParsed.local)
      onChange?.(nextParsed.local ? `+${nextParsed.countryCode} ${formatted}` : `+${nextParsed.countryCode}`)
      return
    }

    const maxLocal = parsed.countryCode === '1' ? 10 : 12
    const localDigits = raw.replace(/\D/g, '').slice(0, maxLocal)
    if (!localDigits) {
      onChange?.('')
      return
    }
    const formatted = formatLocalNumber(parsed.countryCode, localDigits)
    onChange?.(`+${parsed.countryCode} ${formatted}`)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onNext?.()
  }

  return (
    <div className="flex items-center gap-2 mt-4 w-full max-w-md">
      {/* Dynamic Country Flag & Code Box */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-3 min-h-[44px] bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold select-none shadow-xs shrink-0">
        <span className="text-lg leading-none" role="img" aria-label={parsed.label}>
          {parsed.flag}
        </span>
        <span className="text-sm font-medium text-[var(--text-secondary)]">+{parsed.countryCode}</span>
      </div>

      {/* Actual Phone Input */}
      <input
        id={`phone-input-${step?.id || 'phone'}`}
        type="tel"
        value={displayValue}
        onChange={handlePhoneChange}
        onKeyDown={handleKeyDown}
        placeholder={step?.placeholder || placeholder}
        className={`premium-input flex-1 min-w-0 px-4 py-3 min-h-[44px] border border-[var(--border-default)] rounded-xl text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${error ? 'error' : ''}`}
        autoComplete="tel"
        aria-label={step?.label || 'Phone Number'}
        aria-invalid={!!error}
      />
    </div>
  )
}
