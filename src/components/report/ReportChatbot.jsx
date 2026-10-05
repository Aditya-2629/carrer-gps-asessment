import React, { useState, useRef, useEffect } from 'react'
import { Sparkle, X, PaperPlaneRight, SpinnerGap, ChatCircleDots } from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'

/**
 * ReportChatbot — "Ask Atlas" floating agent chat inside the main report.
 * Wired to POST /api/assessment/resume-talk (RAG + full profile context),
 * so answers reference the candidate's actual resume/LinkedIn/assessment data.
 */

const QUICK_QUESTIONS = [
  'What should I fix first this week?',
  'Why am I not getting interviews?',
  'How do I raise my resume score?',
  'Is my LinkedIn helping or hurting?',
]

export default function ReportChatbot() {
  const userId = useAppStore((s) => s.userId)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      text: "I'm Atlas — your career strategist. I've read your full assessment, resume diagnosis, and LinkedIn audit. Ask me anything specific.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: question }])
    setLoading(true)
    try {
      const res = await api.post('/assessment/resume-talk', { userId, question })
      setMessages((m) => [...m, { role: 'agent', text: res.data?.answer || 'Sorry — I could not generate an answer. Try again.' }])
    } catch (_e) {
      setMessages((m) => [...m, { role: 'agent', text: 'Something went wrong reaching the agent. Please try again in a moment.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-lg shadow-[var(--primary-ring)] transition-all cursor-pointer"
          aria-label="Open career chat"
        >
          <ChatCircleDots size={18} weight="fill" />
          Ask Atlas
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] sm:w-96 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: 'min(560px, 75vh)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--surface-card)]">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
                <Sparkle size={16} weight="fill" />
              </span>
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)]">Ask Atlas</div>
                <div className="text-[10px] text-[var(--text-muted)]">Knows your resume, LinkedIn & assessment</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[var(--surface-base)]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[var(--primary)] text-white rounded-br-md'
                      : 'bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-bl-md'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2">
                  <SpinnerGap size={14} className="animate-spin text-[var(--primary)]" />
                  <span className="text-[11px] text-[var(--text-muted)]">Atlas is thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-[var(--border-default)]">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--surface-base)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] border border-[var(--border-default)] rounded-full px-2.5 py-1.5 cursor-pointer transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-[var(--border-default)] flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask about your resume, LinkedIn, strategy…"
              className="flex-1 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white rounded-xl p-2.5 cursor-pointer"
              aria-label="Send message"
            >
              <PaperPlaneRight size={16} weight="fill" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
