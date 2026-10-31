import React, { useState } from 'react'
import { ShieldCheck, Copy, Check, Briefcase, Quotes, Sparkle } from '@phosphor-icons/react'

/**
 * InterviewDefenseSheet
 *
 * Companion ledger for all high-value keywords woven into the candidate's ATS resume.
 * Equips candidates with defensible technical talking points for live recruiter and
 * technical screening rounds.
 */
export default function InterviewDefenseSheet({ interviewLedger = [], variant = 'dark' }) {
  const [copiedIdx, setCopiedIdx] = useState(null)

  if (!Array.isArray(interviewLedger) || interviewLedger.length === 0) {
    return null
  }

  const handleCopy = (text, idx) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => {
        setCopiedIdx(null)
      }, 2000)
    }).catch(() => {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedIdx(idx)
      setTimeout(() => {
        setCopiedIdx(null)
      }, 2000)
    })
  }

  const getPlacementBadgeStyle = (placement = '') => {
    if (placement.includes('Event') || placement.includes('Architecture')) {
      return 'bg-purple-500/10 text-purple-400 border-purple-500/25'
    }
    if (placement.includes('Production') || placement.includes('Quality')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
    }
    return 'bg-sky-500/10 text-sky-400 border-sky-500/25'
  }

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-default)] pb-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck size={22} weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                ATS Keyword Defense & Interview Cheat Sheet
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                <Sparkle size={11} weight="fill" />
                {interviewLedger.length} Woven {interviewLedger.length === 1 ? 'Keyword' : 'Keywords'} Defended
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Every keyword woven into your tailored ATS resume comes with an architectural talking point to confidently defend it in live technical rounds.
            </p>
          </div>
        </div>
      </div>

      {/* Ledger Cards */}
      <div className="grid grid-cols-1 gap-4">
        {interviewLedger.map((item, idx) => {
          const isCopied = copiedIdx === idx
          const placementStyle = getPlacementBadgeStyle(item.placement)

          return (
            <div
              key={idx}
              className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 sm:p-5 space-y-3.5 transition-all hover:border-[var(--border-hover)]"
            >
              {/* Meta row: Keyword + Placement + Company + Copy Action */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {item.keyword}
                  </span>
                  {item.placement && (
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${placementStyle}`}>
                      {item.placement}
                    </span>
                  )}
                  {item.company && (
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <Briefcase size={12} weight="bold" />
                      {item.company}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(item.interviewTalkingScript, idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Copy talking point to clipboard"
                >
                  {isCopied ? (
                    <>
                      <Check size={13} weight="bold" />
                      <span>Copied Script!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
              </div>

              {/* Exact woven bullet */}
              {(item.exactBullet || item.bulletText) && (
                <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-3 leading-relaxed">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Woven Resume Bullet
                  </span>
                  <p className="italic">
                    "{item.exactBullet || item.bulletText}"
                  </p>
                </div>
              )}

              {/* Interview Talking Script */}
              {item.interviewTalkingScript && (
                <div className="flex items-start gap-2.5 text-xs text-[var(--text-primary)] bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                  <Quotes size={16} weight="fill" className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Live Interview Talking Script
                    </span>
                    <p className="leading-relaxed">
                      {item.interviewTalkingScript}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
