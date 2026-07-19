export default function TextareaInput({ value = '', onChange, error, step, onNext }) {
  return (
    <textarea
      id={`textarea-input-${step.id}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={step.placeholder}
      rows={5}
      className={`premium-input ${error ? 'error' : ''}`}
      style={{ resize: 'vertical', lineHeight: '1.6' }}
      aria-label={step.label}
      aria-invalid={!!error}
    />
  )
}

