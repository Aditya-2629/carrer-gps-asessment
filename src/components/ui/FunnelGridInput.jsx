import { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { parseRangeOrNumber } from '../../../backend/agents/assessment/assessmentAgent'
import {
  PhoneCall,
  Code,
  UsersThree,
  Trophy,
  PaperPlaneTilt,
  Robot,
  CheckCircle,
  Clock,
} from '@phosphor-icons/react'

const NUMERIC_STAGES = [
  {
    key: 'applications90d',
    label: 'Total Applications (90d)',
    sublabel: 'Estimated total jobs applied in 90 days',
    icon: PaperPlaneTilt,
    color: '#3b82f6',
    presets: [15, 45, 90, 180, 300],
    defaultFallback: 60,
  },
  {
    key: 'recruiterScreens',
    label: 'Recruiter / Vendor Screens',
    sublabel: 'Initial HR, talent acquisition, or vendor calls',
    icon: PhoneCall,
    color: 'var(--primary)',
    presets: [0, 1, 3, 5, 10, 15],
    defaultFallback: 2,
  },
  {
    key: 'assessments',
    label: 'Online Coding / Take-Homes',
    sublabel: 'HackerRank, CodeSignal, or OA tests',
    icon: Code,
    color: '#06b6d4',
    presets: [0, 1, 2, 5, 10],
    defaultFallback: 1,
  },
  {
    key: 'aiInterviews',
    label: 'AI / Video Screens',
    sublabel: 'HireVue or one-way recorded AI screenings',
    icon: Robot,
    color: '#6366f1',
    presets: [0, 1, 2, 5, 10],
    defaultFallback: 0,
  },
  {
    key: 'technicalRounds',
    label: 'Live Technical Interviews',
    sublabel: 'System design, live coding, or architecture rounds',
    icon: Code,
    color: '#8b5cf6',
    presets: [0, 1, 2, 4, 8],
    defaultFallback: 1,
  },
  {
    key: 'finalRounds',
    label: 'Final / Managerial Rounds',
    sublabel: 'Hiring manager, director, or onsite panel rounds',
    icon: UsersThree,
    color: '#ec4899',
    presets: [0, 1, 2, 3, 5],
    defaultFallback: 0,
  },
  {
    key: 'offers',
    label: 'Job Offers Received',
    sublabel: 'Formal written or verbal offers',
    icon: Trophy,
    color: 'var(--emerald)',
    presets: [0, 1, 2, 3],
    defaultFallback: 0,
  },
]

const JOINING_STATUS_OPTIONS = [
  'No Offer Yet',
  'Offer Received — Evaluating / Onboarding Smoothly',
  'Offer Delayed / Background / Joining Blocked',
]

export default function FunnelGridInput({ value, onChange, error }) {
  const { formData } = useAppStore()

  // Calculate default applications90d based on apps30d if available
  const apps30dNum = parseRangeOrNumber(formData.apps30d, 20)
  const default90dApps = apps30dNum * 3

  const currentObj = typeof value === 'object' && value !== null ? value : {}
  const [funnelData, setFunnelData] = useState({
    applications90d: currentObj.applications90d ?? default90dApps,
    recruiterScreens: currentObj.recruiterScreens ?? currentObj.screens ?? 0,
    assessments: currentObj.assessments ?? 0,
    aiInterviews: currentObj.aiInterviews ?? 0,
    technicalRounds: currentObj.technicalRounds ?? 0,
    finalRounds: currentObj.finalRounds ?? currentObj.finals ?? 0,
    offers: currentObj.offers ?? 0,
    joiningStatus: currentObj.joiningStatus || 'No Offer Yet',
  })

  useEffect(() => {
    if (typeof value === 'object' && value !== null) {
      setFunnelData((prev) => ({
        ...prev,
        ...value,
        recruiterScreens: value.recruiterScreens ?? value.screens ?? prev.recruiterScreens,
        finalRounds: value.finalRounds ?? value.finals ?? prev.finalRounds,
      }))
    }
  }, [value])

  const handleNumericChange = (key, rawVal) => {
    const num = Math.max(0, parseInt(rawVal, 10) || 0)
    const updated = {
      ...funnelData,
      [key]: num,
      // Keep backward-compatible keys aligned
      screens: key === 'recruiterScreens' ? num : (funnelData.recruiterScreens ?? 0),
      finals: key === 'finalRounds' ? num : (funnelData.finalRounds ?? 0),
    }
    setFunnelData(updated)
    onChange(updated)
  }

  const handleStatusChange = (status) => {
    const updated = {
      ...funnelData,
      joiningStatus: status,
    }
    setFunnelData(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-5">
      {/* 7 Counter Stages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        {NUMERIC_STAGES.map((stg) => {
          const Icon = stg.icon
          const count = funnelData[stg.key] ?? 0
          return (
            <div
              key={stg.key}
              className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-all flex flex-col justify-between shadow-xs"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${stg.color}18`, color: stg.color }}
                  >
                    <Icon size={17} weight="bold" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-[var(--text-primary)] leading-snug">
                      {stg.label}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] leading-tight">
                      {stg.sublabel}
                    </p>
                  </div>
                </div>

                <input
                  type="number"
                  min="0"
                  max="9999"
                  value={count}
                  onChange={(e) => handleNumericChange(stg.key, e.target.value)}
                  className="w-16 px-2 py-1.5 text-center font-bold font-mono text-sm rounded-lg bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] focus:outline-none shrink-0"
                  aria-label={`${stg.label} count`}
                />
              </div>

              {/* Presets Row */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--border-subtle)]/60">
                <span className="text-[11px] text-[var(--text-muted)] font-mono mr-1">Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {stg.presets.map((preset) => {
                    const isSelected = count === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleNumericChange(stg.key, preset)}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors font-medium font-mono cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--primary)] text-white font-bold'
                            : 'bg-[var(--surface-base)] border border-[var(--border-default)] hover:border-[var(--primary)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {preset}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 8. Offer & Joining Status */}
      <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
          <Clock size={15} className="text-amber-500" />
          8. Current Offer & Joining Status
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {JOINING_STATUS_OPTIONS.map((status) => {
            const isSelected = funnelData.joiningStatus === status
            return (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusChange(status)}
                className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs font-semibold'
                    : 'bg-[var(--surface-base)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)]/60'
                }`}
              >
                <span className="leading-tight">{status}</span>
                {isSelected && <CheckCircle size={14} weight="fill" className="shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-muted)] text-center italic">
        📊 Tip: Even ballpark estimates allow our 6-Phase Engine to calculate your exact drop-off conversion rate.
      </p>
    </div>
  )
}
