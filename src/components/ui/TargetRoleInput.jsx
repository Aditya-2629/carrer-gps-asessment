import { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { Briefcase, Sparkle } from '@phosphor-icons/react'

const SUGGESTED_ROLES = [
  'Full Stack Software Engineer',
  'Frontend Engineer',
  'Backend / Cloud Engineer',
  'Data Analyst / Analytics Engineer',
  'Data Scientist / AI Engineer',
  'DevOps / SRE / Platform Engineer',
  'Mobile Engineer (iOS / Android)',
  'Product / Engineering Manager',
]

const EXPERIENCE_LEVELS = [
  'Entry-Level / 0–1 Yr US Experience 🌱',
  'Junior–Mid / 1–3 Yrs Experience ⚡',
  'Mid–Senior / 4–7 Yrs Experience 🚀',
  'Senior / Lead / 8+ Yrs Experience 🏆',
]

export default function TargetRoleInput({ value, onChange, error, onNext }) {
  const { formData, setFormData, resumeAnalysis } = useAppStore()

  // Pre-fill from resume if detected
  const detectedTarget =
    formData.targetRole ||
    resumeAnalysis?.data?.canonicalResume?.candidate?.targetRole ||
    resumeAnalysis?.data?.analysis?.candidateSnapshot?.targetRole ||
    ''

  const [roleText, setRoleText] = useState(value || detectedTarget || '')
  const [selectedExp, setSelectedExp] = useState(formData.experience || '2–4 yrs (Mid-Level)')

  useEffect(() => {
    if (value && value !== roleText) {
      setRoleText(value)
    } else if (!roleText && detectedTarget) {
      setRoleText(detectedTarget)
      onChange(detectedTarget)
    }
  }, [value, detectedTarget])

  const handleRoleChange = (newVal) => {
    setRoleText(newVal)
    onChange(newVal)
  }

  const handleExpChange = (exp) => {
    setSelectedExp(exp)
    setFormData('experience', exp)
  }

  return (
    <div className="space-y-5">
      {/* Target Role Input */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
          Target Role or Title
        </label>
        <div className="relative">
          <input
            type="text"
            value={roleText}
            onChange={(e) => handleRoleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onNext?.()
              }
            }}
            placeholder="e.g. Senior Full Stack Engineer"
            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none text-base font-medium transition-all shadow-xs"
          />
          {detectedTarget && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-[var(--primary-light)] text-[10px] font-semibold text-[var(--primary)] flex items-center gap-1">
              <Sparkle size={12} weight="fill" />
              Resume Detected
            </span>
          )}
        </div>
      </div>

      {/* Suggested Chips */}
      <div>
        <span className="block text-[11px] font-semibold text-[var(--text-muted)] mb-2">
          Or tap a common role title:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_ROLES.map((role) => {
            const isMatch = roleText.toLowerCase() === role.toLowerCase()
            return (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleChange(role)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isMatch
                    ? 'bg-[var(--primary)] text-white shadow-xs font-semibold'
                    : 'bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                }`}
              >
                {role}
              </button>
            )
          })}
        </div>
      </div>

      {/* Experience Level */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
          Total Tech Experience Level
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EXPERIENCE_LEVELS.map((exp) => {
            const isSelected = selectedExp === exp
            return (
              <button
                key={exp}
                type="button"
                onClick={() => handleExpChange(exp)}
                className={`p-2.5 rounded-xl text-center text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary-light)] border-2 border-[var(--primary)] text-[var(--primary)] font-bold shadow-xs'
                    : 'bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                }`}
              >
                {exp}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
