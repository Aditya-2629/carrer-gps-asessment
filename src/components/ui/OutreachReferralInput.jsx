import { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { PaperPlaneTilt, UsersThree, Check } from '@phosphor-icons/react'

const OUTREACH_PRESETS = ['0', '1–5', '6–15', '15–30', '30+']
const REFERRAL_PRESETS = ['0', '1–3', '4–10', '10+']

export default function OutreachReferralInput({ value, onChange, error }) {
  const { formData, setFormData } = useAppStore()

  const currentObj = typeof value === 'object' && value !== null ? value : {}
  const [outreach, setOutreach] = useState(currentObj.outreach || formData.outreach || '6–15')
  const [referrals, setReferrals] = useState(currentObj.referralsMonth || formData.referralsMonth || '1–3')

  useEffect(() => {
    if (typeof value === 'object' && value !== null) {
      if (value.outreach) setOutreach(value.outreach)
      if (value.referralsMonth) setReferrals(value.referralsMonth)
    }
  }, [value])

  const handleOutreachSelect = (preset) => {
    setOutreach(preset)
    setFormData('outreach', preset)
    onChange({ outreach: preset, referralsMonth: referrals })
  }

  const handleReferralSelect = (preset) => {
    setReferrals(preset)
    setFormData('referralsMonth', preset)
    onChange({ outreach, referralsMonth: preset })
  }

  return (
    <div className="space-y-6">
      {/* 1. Weekly Personalized Outreach Messages */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <PaperPlaneTilt size={15} className="text-[var(--primary)]" />
            1. Personalized Messages Sent (Per Week)
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-normal">To recruiters & hiring managers</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {OUTREACH_PRESETS.map((preset) => {
            const isSelected = outreach === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleOutreachSelect(preset)}
                className={`p-3 rounded-xl border text-center text-xs font-bold font-mono transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                    : 'bg-[var(--surface-sunken)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)]/60 hover:bg-[var(--surface-base)]'
                }`}
              >
                {preset}
                <span className="block text-[10px] font-normal text-[var(--text-muted)] mt-0.5 opacity-80">
                  msg/wk
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Monthly Referral Requests */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <UsersThree size={15} className="text-[#8b5cf6]" />
            2. Warm Referrals / Introductions Requested (Per Month)
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-normal">Internal employee referrals</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REFERRAL_PRESETS.map((preset) => {
            const isSelected = referrals === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleReferralSelect(preset)}
                className={`p-3 rounded-xl border text-center text-xs font-bold font-mono transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#8b5cf6] text-white border-[#8b5cf6] shadow-sm'
                    : 'bg-[var(--surface-sunken)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[#8b5cf6]/60 hover:bg-[var(--surface-base)]'
                }`}
              >
                {preset}
                <span className="block text-[10px] font-normal text-[var(--text-muted)] mt-0.5 opacity-80">
                  refs/mo
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-muted)] italic">
        💡 Note: Employee referrals convert to final rounds at 4x the rate of cold job board submissions.
      </p>
    </div>
  )
}
