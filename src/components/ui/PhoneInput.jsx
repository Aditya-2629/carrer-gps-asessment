import { useState } from 'react'

export default function PhoneInput({ value = '', onChange, error, step, onNext }) {
  const [raw, setRaw] = useState(value.replace(step.prefix, '').trim())

  const formatPhone = (input) => {
    const digits = input.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const handleChange = (e) => {
    const formatted = formatPhone(e.target.value)
    setRaw(formatted)
    onChange(`${step.prefix} ${formatted}`)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onNext?.()
  }

  return (
    <div className="flex gap-2">
      <div
        className="flex items-center px-4 rounded-xl shrink-0 text-sm font-medium"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'Space Grotesk, sans-serif',
          minWidth: '60px',
        }}
      >
        {step.prefix}
      </div>
      <input
        id={`phone-input-${step.id}`}
        type="tel"
        value={raw}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={step.placeholder}
        className={`premium-input flex-1 ${error ? 'error' : ''}`}
        autoComplete="tel"
        aria-label={step.label}
        aria-invalid={!!error}
      />
    </div>
  )
}

