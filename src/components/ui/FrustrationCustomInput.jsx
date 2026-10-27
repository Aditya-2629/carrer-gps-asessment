import { useState, useEffect } from 'react'

export default function FrustrationCustomInput({ value, onChange, options = [], optionIcons = {}, error }) {
  const currentVal = typeof value === 'object' && value !== null ? (value.selected || '') : (typeof value === 'string' ? value : '')
  const currentNote = typeof value === 'object' && value !== null ? (value.note || '') : ''

  const [selected, setSelected] = useState(currentVal)
  const [note, setNote] = useState(currentNote)

  useEffect(() => {
    if (typeof value === 'object' && value !== null) {
      setSelected(value.selected || '')
      setNote(value.note || '')
    } else if (typeof value === 'string') {
      setSelected(value)
    }
  }, [value])

  const handleSelect = (opt) => {
    setSelected(opt)
    onChange(note ? { selected: opt, note } : opt)
  }

  const handleNoteChange = (text) => {
    setNote(text)
    onChange(text ? { selected, note: text } : selected)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {options.map((option) => {
          const isSelected = selected === option
          const icon = optionIcons[option] || '🎯'
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                isSelected
                  ? 'bg-[var(--primary-light)] border-2 border-[var(--primary)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'bg-[var(--surface-sunken)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl shrink-0 select-none">{icon}</span>
                <span className="text-sm sm:text-base leading-snug">{option}</span>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary)]'
                    : 'border-[var(--border-default)]'
                }`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Optional Custom Note */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
          Optional: Add any specific context, frustration, or detail in your own words:
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="e.g. I have 4 years in backend Go/Python, but my resume is getting rejected for AWS roles..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none text-xs sm:text-sm font-normal resize-none"
        />
      </div>
    </div>
  )
}
