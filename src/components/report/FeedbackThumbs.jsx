import React, { useState } from 'react'
import { ThumbsUp, ThumbsDown } from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'

/**
 * FeedbackThumbs — 👍/👎 on an agent finding (Phase E learning loop).
 * Fire-and-forget UX: optimistic state, silent failure (feedback must never
 * annoy the candidate). One rating per (user, agent, finding) — re-click
 * updates via upsert.
 */
export default function FeedbackThumbs({ agent, findingId, subtle = false }) {
  const userId = useAppStore((s) => s.userId)
  const [rating, setRating] = useState(null)
  const [sending, setSending] = useState(false)

  const send = async (value) => {
    if (sending || !userId || !findingId) return
    setSending(true)
    setRating(value)
    try {
      await api.sendFindingFeedback({ userId, agent, findingId, rating: value })
    } catch (_e) {
      /* silent — keep optimistic state */
    } finally {
      setSending(false)
    }
  }

  const base = subtle
    ? 'p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800'
    : 'p-1.5 rounded-lg border'
  const cls = (val) =>
    `${base} transition-colors cursor-pointer ${
      rating === val
        ? val === 'up'
          ? 'text-emerald-500 border-emerald-300 bg-emerald-50'
          : 'text-red-500 border-red-300 bg-red-50'
        : 'text-slate-300 hover:text-slate-500 border-transparent'
    }`

  return (
    <span className="inline-flex items-center gap-1" title="Was this finding useful?">
      <button type="button" onClick={() => send('up')} className={cls('up')} aria-label="Helpful">
        <ThumbsUp size={13} weight={rating === 'up' ? 'fill' : 'regular'} />
      </button>
      <button type="button" onClick={() => send('down')} className={cls('down')} aria-label="Not helpful">
        <ThumbsDown size={13} weight={rating === 'down' ? 'fill' : 'regular'} />
      </button>
    </span>
  )
}
