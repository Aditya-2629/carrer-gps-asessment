import { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { IdentificationCard, Compass, Check } from '@phosphor-icons/react'

const VISA_OPTIONS = [
  'US Citizen / Green Card / GC-EAD',
  'F1 OPT / STEM OPT / CPT',
  'H-1B (Transfer / Cap)',
  'H4 EAD / L2 EAD',
  'Other / Outside US',
]

const LOCATION_OPTIONS = [
  'Nationwide (Open to Relocate Anywhere in US) ✈️',
  'Specific Metro / State Only 📍',
  'Remote Only 🌐',
]

export default function VisaLocationInput({ value, onChange, error }) {
  const { formData, setFormData } = useAppStore()

  const currentObj = typeof value === 'object' && value !== null ? value : {}
  const [selectedVisa, setSelectedVisa] = useState(currentObj.visa || formData.visa || 'US Citizen / Green Card / GC-EAD')
  const [selectedLoc, setSelectedLoc] = useState(currentObj.location || formData.location || 'Nationwide (Open to Relocate Anywhere in US) ✈️')

  useEffect(() => {
    if (typeof value === 'object' && value !== null) {
      if (value.visa) setSelectedVisa(value.visa)
      if (value.location) setSelectedLoc(value.location)
    }
  }, [value])

  const handleVisaSelect = (opt) => {
    setSelectedVisa(opt)
    setFormData('visa', opt)
    const combined = { visa: opt, location: selectedLoc }
    onChange(combined)
  }

  const handleLocSelect = (opt) => {
    setSelectedLoc(opt)
    setFormData('location', opt)
    const combined = { visa: selectedVisa, location: opt }
    onChange(combined)
  }

  return (
    <div className="space-y-6">
      {/* 1. Work Authorization */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
          <IdentificationCard size={15} className="text-[var(--primary)]" />
          1. Current Work Authorization / Visa Status
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VISA_OPTIONS.map((opt) => {
            const isSelected = selectedVisa === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleVisaSelect(opt)}
                className={`p-3 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm font-semibold'
                    : 'bg-[var(--surface-sunken)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)]/60 hover:bg-[var(--surface-base)]'
                }`}
              >
                <span>{opt}</span>
                {isSelected && <Check size={14} weight="bold" className="shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Search Perimeter & Location */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
          <Compass size={15} className="text-[var(--primary)]" />
          2. Search Perimeter & Relocation Flexibility
        </label>
        <div className="space-y-2">
          {LOCATION_OPTIONS.map((opt) => {
            const isSelected = selectedLoc === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleLocSelect(opt)}
                className={`w-full p-3 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm font-semibold'
                    : 'bg-[var(--surface-sunken)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)]/60 hover:bg-[var(--surface-base)]'
                }`}
              >
                <span>{opt}</span>
                {isSelected && <Check size={14} weight="bold" className="shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-muted)] italic">
        🔒 Note: Work authorization and location are strictly used to calibrate recruiter filtering & market cycle intelligence — they never penalize your 100-point Career GPS score.
      </p>
    </div>
  )
}
