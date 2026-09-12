export default function TextareaInput({ value = '', onChange, error, step, onNext }) {
  const handleSuggestionClick = (item) => {
    const cleaned = item.replace(/\s+[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, '').trim()
    if (!value) {
      onChange(cleaned)
    } else if (!value.includes(cleaned)) {
      onChange(`${value}; ${cleaned}`)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        id={`textarea-input-${step.id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={step.placeholder}
        rows={4}
        className={`premium-input ${error ? 'error' : ''}`}
        style={{ resize: 'vertical', lineHeight: '1.6' }}
        aria-label={step.label}
        aria-invalid={!!error}
      />

      {step.suggestions && step.suggestions.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-[var(--text-muted)]">Common Experience Starters:</span>
          <div className="flex flex-wrap gap-1.5">
            {step.suggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => handleSuggestionClick(sug)}
                className="text-xs px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] border border-[var(--border-default)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--text-secondary)] transition-colors cursor-pointer text-left"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

