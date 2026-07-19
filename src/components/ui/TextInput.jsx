export default function TextInput({ value = '', onChange, error, step, onNext }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onNext?.()
  }

  return (
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
  )
}

