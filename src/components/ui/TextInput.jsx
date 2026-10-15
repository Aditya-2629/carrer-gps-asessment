import { CheckCircle } from '@phosphor-icons/react'

export default function TextInput({ value = '', onChange, error, step, onNext }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onNext?.()
  }

  const handleSuggestionClick = (item) => {
    // Strip trailing emoji for raw value or set cleanly
    const cleaned = item.replace(/\s+[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, '').trim()
    if (!value) {
      onChange(cleaned)
    } else if (!value.includes(cleaned)) {
      onChange(`${value}, ${cleaned}`)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        id={`text-input-${step.id}`}
        type={step.inputType || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={step.placeholder}
        className={`premium-input ${error ? 'error' : ''}`}
        autoComplete="off"
        aria-label={step.label}
        aria-invalid={!!error}
      />

      {step.name === 'linkedin' && value && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle size={14} weight="fill" />
          <span>Auto-detected from resume — editable if needed</span>
        </div>
      )}

      {step.suggestions && step.suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className="text-xs text-[var(--text-muted)] mr-1">Quick Suggestions:</span>
          {step.suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => handleSuggestionClick(sug)}
              className="text-xs px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] border border-[var(--border-default)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            >
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

