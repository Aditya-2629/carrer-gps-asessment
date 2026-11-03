import React, { useState } from 'react'
import { ShieldCheck, Copy, Check, Briefcase, Quotes, Sparkle } from '@phosphor-icons/react'

/**
 * InterviewDefenseSheet
 *
 * Technical Talking Points & Interview Defense Guide
 * Equips candidates with concrete, humanized talking points to confidently explain
 * every target skill added or enhanced on their resume during live recruiter and technical rounds.
 */
export default function InterviewDefenseSheet({ interviewLedger = [], variant = 'light' }) {
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

  const getPlacementBadge = (placement = '') => {
    const isNew = placement.toLowerCase().includes('synthesized') || placement.toLowerCase().includes('new')
    if (isNew) {
      return {
        label: 'Added to Experience',
        className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
      }
    }
    return {
      label: 'Enhanced in Experience',
      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    }
  }

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs break-inside-avoid page-break-inside-avoid">
      {/* Header & Goal Explanation */}
      <div className="space-y-3 border-b border-[var(--border-default)] pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck size={22} weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                  Interview Defense & Technical Talking Points
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                  <Sparkle size={11} weight="fill" />
                  {interviewLedger.length} Target {interviewLedger.length === 1 ? 'Skill' : 'Skills'} Ready to Defend
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Goal Explanation Box */}
        <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-primary)] font-semibold">Why this section exists: </strong>
          When we align your resume with high-demand skills to pass automated ATS filters, recruiters and technical interviewers may ask about these tools. Here is the exact technical context of where each skill appears on your resume and a 1-sentence talking point so you can confidently explain your experience during technical rounds without hesitation.
        </div>
      </div>

      {/* Defense Cards */}
      <div className="grid grid-cols-1 gap-4">
        {interviewLedger.map((item, idx) => {
          const isCopied = copiedIdx === idx
          const badge = getPlacementBadge(item.placement || '')

          return (
            <div
              key={idx}
              className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 sm:p-5 space-y-3.5 transition-all hover:border-[var(--border-hover)] break-inside-avoid page-break-inside-avoid"
            >
              {/* Meta row: Keyword + Placement + Company + Copy Action */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {item.keyword}
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.className}`}>
                    {badge.label}
                  </span>
                  {item.company && (
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <Briefcase size={12} weight="bold" />
                      {item.company}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(item.interviewTalkingScript || item.talkingScript, idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Copy talking point to clipboard"
                >
                  {isCopied ? (
                    <>
                      <Check size={13} weight="bold" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Talking Point</span>
                    </>
                  )}
                </button>
              </div>

              {/* Exact resume bullet */}
              {(item.exactBullet || item.bulletText || item.wovenBullet) && (
                <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-3 leading-relaxed">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    How It Appears on Your Resume
                  </span>
                  <p className="italic text-[var(--text-primary)]">
                    "{item.exactBullet || item.bulletText || item.wovenBullet}"
                  </p>
                </div>
              )}

              {/* Interview Talking Script */}
              {(item.interviewTalkingScript || item.talkingScript) && (
                <div className="flex items-start gap-2.5 text-xs text-[var(--text-primary)] bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                  <Quotes size={16} weight="fill" className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                      How to Defend This in Your Interview
                    </span>
                    <p className="leading-relaxed">
                      {item.interviewTalkingScript || item.talkingScript}
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
