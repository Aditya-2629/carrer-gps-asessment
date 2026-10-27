import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Sparkle,
  X,
  PaperPlaneRight,
  SpinnerGap,
  ChatCircleDots,
  Copy,
  Check,
  CalendarBlank,
  ArrowRight,
} from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'

/**
 * Smoothly scrolls to a section by element id (supports `#final-cta`, `#next-action`, etc.)
 */
const scrollToSection = (href) => {
  const id = (href || '').replace('#', '')
  if (!id) return
  const el =
    document.getElementById(id) ||
    (id === 'final-cta' ? document.getElementById('next-action') : null) ||
    (id === 'next-action' ? document.getElementById('final-cta') : null)

  if (el) {
    const pos = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: pos - 90, behavior: 'smooth' })
  }
}

/**
 * 1-click Copyable Snippet Card for bullet rewrites, headlines, or cold outreach scripts
 */
function CopyableSnippetCard({ snippet }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e) => {
    e.stopPropagation()
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(snippet.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="my-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-card)] border-b border-[var(--border-default)]">
        <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
          Ready-to-Paste Template
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] bg-[var(--surface-base)] px-2 py-0.5 rounded border border-[var(--border-default)] cursor-pointer transition-all active:scale-95"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check size={12} weight="bold" className="text-emerald-500" />
              <span className="text-emerald-500 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} weight="bold" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 text-[11px] font-mono leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap select-all bg-[var(--surface-base)]">
        {snippet.trim()}
      </div>
    </div>
  )
}

/**
 * Formats inline bold (**text**) and code tokens (`code`) safely without raw asterisks
 */
function renderInlineFormatting(str) {
  if (!str) return null
  const tokens = str.split(/(\*\*.*?\*\*|`.*?`)/g)
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={i} className="font-bold text-[var(--text-primary)]">
          {token.slice(2, -2)}
        </strong>
      )
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-[var(--surface-base)] border border-[var(--border-default)] text-[11px] font-mono text-[var(--primary)]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    return token
  })
}

/**
 * Parses markdown text chunks into paragraphs, bullet lists, blockquotes, and copyable snippets
 */
function renderMessageContent(text) {
  if (!text) return null

  // Split out fenced code blocks (```...```)
  const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g
  const parts = text.split(codeBlockRegex)

  return parts.map((part, partIdx) => {
    // Odd index = matched code block content
    if (partIdx % 2 === 1) {
      return <CopyableSnippetCard key={`code-${partIdx}`} snippet={part} />
    }

    // Even index = regular markdown text chunk
    const lines = part.split('\n')
    const elements = []
    let currentBulletList = []

    const flushBulletList = () => {
      if (currentBulletList.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-1.5 space-y-1 pl-1">
            {currentBulletList.map((item, liIdx) => (
              <li key={liIdx} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-primary)]">
                <span className="text-[var(--primary)] font-bold text-xs select-none mt-0.5">•</span>
                <span className="flex-1">{renderInlineFormatting(item)}</span>
              </li>
            ))}
          </ul>
        )
        currentBulletList = []
      }
    }

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim()
      if (!trimmed) {
        flushBulletList()
        return
      }

      // Check bullet item (- item, * item, • item)
      const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/)
      if (bulletMatch) {
        currentBulletList.push(bulletMatch[1])
        return
      }

      // Check numbered item (1. item)
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
      if (numMatch) {
        flushBulletList()
        elements.push(
          <div key={`num-${lineIdx}`} className="flex items-start gap-2 text-xs leading-relaxed my-1">
            <span className="font-bold text-[var(--primary)] text-xs select-none">{numMatch[1]}.</span>
            <div className="flex-1 text-[var(--text-primary)]">{renderInlineFormatting(numMatch[2])}</div>
          </div>
        )
        return
      }

      // Check blockquote (> text)
      if (trimmed.startsWith('>')) {
        flushBulletList()
        const quoteContent = trimmed.replace(/^>\s*/, '')
        elements.push(
          <div
            key={`quote-${lineIdx}`}
            className="my-2 pl-3 border-l-2 border-[var(--primary)] italic text-[var(--text-secondary)] text-xs leading-relaxed bg-[var(--surface-base)]/50 py-1.5 pr-2.5 rounded-r"
          >
            {renderInlineFormatting(quoteContent)}
          </div>
        )
        return
      }

      // Regular paragraph
      flushBulletList()
      elements.push(
        <p key={`p-${lineIdx}`} className="my-1 text-xs leading-relaxed text-[var(--text-primary)]">
          {renderInlineFormatting(trimmed)}
        </p>
      )
    })

    flushBulletList()
    return <div key={`text-seg-${partIdx}`}>{elements}</div>
  })
}

export default function ReportChatbot() {
  const userId = useAppStore((s) => s.userId)
  const reportData = useAppStore((s) => s.reportData)
  const formData = useAppStore((s) => s.formData)
  const email = useAppStore((s) => s.email)

  // Dynamic context extraction
  const firstName = useMemo(() => {
    const raw =
      reportData?.resume_agent?.canonicalResume?.contact?.name ||
      formData?.name ||
      'there'
    return String(raw).trim().split(' ')[0]
  }, [reportData, formData])

  const targetRole = useMemo(() => {
    return (
      reportData?.assessment_agent?.candidateProfile?.targetRole ||
      formData?.targetRole ||
      reportData?.resume_json?.target_role ||
      'your target role'
    )
  }, [reportData, formData])

  const latestCompany = useMemo(() => {
    return (
      reportData?.resume_agent?.canonicalResume?.experience?.[0]?.company ||
      'my latest company'
    )
  }, [reportData])

  const bottleneckTitle = useMemo(() => {
    return (
      reportData?.assessment_agent?.primaryBottleneck?.title ||
      reportData?.critical_issues?.[0]?.title ||
      'my #1 bottleneck'
    )
  }, [reportData])

  const overallScore = useMemo(() => {
    return reportData?.career_health_score || 65
  }, [reportData])

  // Dynamic initial greeting message
  const initialGreeting = useMemo(() => {
    return `Hey **${firstName}**! I'm **Atlas**, your personal career strategist. I've audited your **${targetRole}** profile (**${overallScore}/100**), your resume bullets, and your LinkedIn. Your #1 priority right now is **${bottleneckTitle}**. What should we tackle first?`
  }, [firstName, targetRole, overallScore, bottleneckTitle])

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      text: initialGreeting,
      suggestCall: false,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [usedPrompts, setUsedPrompts] = useState(new Set())
  const scrollRef = useRef(null)

  // Sync greeting when reportData loads/updates
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'agent') {
        return [{ role: 'agent', text: initialGreeting, suggestCall: false }]
      }
      return prev
    })
  }, [initialGreeting])

  // Auto-scroll on new messages, opening, or loading state
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, open, loading])

  // 5 Dynamic Role-Specific Starter Chips
  const STARTER_CHIPS = useMemo(
    () => [
      {
        id: 'bottleneck',
        label: '🎯 Fix my #1 bottleneck',
        prompt: `How do I fix my primary bottleneck ("${bottleneckTitle}") this week?`,
      },
      {
        id: 'bullet',
        label: `✍️ Rewrite ${latestCompany} bullet`,
        prompt: `Rewrite my weakest resume bullet at ${latestCompany} with stronger impact metrics.`,
      },
      {
        id: 'cold-dm',
        label: `📬 Cold DM for ${targetRole}`,
        prompt: `Write a high-converting LinkedIn cold DM to a Hiring Manager for a ${targetRole} role using my top achievements.`,
      },
      {
        id: 'interview',
        label: '🎤 Mock Interview Question',
        prompt: `Ask me 1 tough interview question for a ${targetRole} role based on my resume and show me a strong STAR answer.`,
      },
      {
        id: 'plan',
        label: '🚀 My 7-Day Action Plan',
        prompt: 'Give me a concrete 7-day execution checklist based on my report diagnosis.',
      },
    ],
    [bottleneckTitle, latestCompany, targetRole]
  )

  const remainingChips = useMemo(
    () => STARTER_CHIPS.filter((chip) => !usedPrompts.has(chip.id)),
    [STARTER_CHIPS, usedPrompts]
  )

  const send = useCallback(
    async (text) => {
      const question = (text ?? input).trim()
      if (!question || loading) return

      setInput('')
      const nextUserMsg = { role: 'user', text: question }
      const updatedMessages = [...messages, nextUserMsg]
      setMessages(updatedMessages)
      setLoading(true)

      try {
        const historyPayload = updatedMessages.slice(-6).map((m) => ({
          role: m.role,
          text: m.text,
        }))

        const res = await api.post('/assessment/resume-talk', {
          userId,
          question,
          history: historyPayload,
        })

        setMessages((prev) => [
          ...prev,
          {
            role: 'agent',
            text: res.data?.answer || 'Sorry — I could not generate an answer. Please try again.',
            routedIntent: res.data?.routedIntent || null,
            sectionLink: res.data?.sectionLink || null,
            suggestCall: Boolean(res.data?.suggestCall),
          },
        ])
      } catch (_e) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'agent',
            text: 'Something went wrong reaching the agent. Please try again in a moment.',
            suggestCall: false,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [input, loading, messages, userId]
  )

  const handleStrategyCallCta = async () => {
    if (email) {
      try {
        await api.post('/assessment/book-call', { email })
      } catch (_e) {
        // non-fatal
      }
    }
    setOpen(false)
    scrollToSection('#final-cta')
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl shadow-[var(--primary-ring)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          aria-label="Open career chat"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <ChatCircleDots size={18} weight="fill" />
          <span>Ask Atlas</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ height: 'min(590px, 80vh)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--surface-card)]">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20 shadow-2xs">
                <Sparkle size={16} weight="fill" />
              </span>
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <span>Ask Atlas</span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[240px]">
                  Knows your {targetRole} profile & resume
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--surface-base)] cursor-pointer transition-colors"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages container */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 bg-[var(--surface-base)]/50"
          >
            {messages.map((m, i) => {
              const isAgent = m.role === 'agent'
              const showCallCta = isAgent && m.suggestCall === true

              return (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[var(--primary)] text-white px-3.5 py-2.5 rounded-2xl rounded-br-xs shadow-sm whitespace-pre-wrap'
                        : 'bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-primary)] px-4 py-3 rounded-2xl rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {/* Message Body */}
                    {isAgent ? (
                      <div>{renderMessageContent(m.text)}</div>
                    ) : (
                      <div>{m.text}</div>
                    )}

                    {/* Section Anchor Deep-Link */}
                    {isAgent && m.routedIntent && m.sectionLink && (
                      <button
                        type="button"
                        onClick={() => scrollToSection(m.sectionLink)}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] bg-[var(--primary-light)] px-2.5 py-1 rounded-lg border border-[var(--primary)]/20 cursor-pointer transition-colors"
                      >
                        <span>↳ View {m.routedIntent} in report</span>
                        <ArrowRight size={10} weight="bold" />
                      </button>
                    )}

                    {/* Contextual 1-on-1 Strategy Call Callout */}
                    {showCallCta && (
                      <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-[var(--primary-light)] via-[var(--surface-card)] to-[var(--surface-base)] border border-[var(--primary)]/30 space-y-2 shadow-xs">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)]">
                          <CalendarBlank size={14} className="text-[var(--primary)]" weight="bold" />
                          <span>Want hands-on help executing this for your {targetRole} search?</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleStrategyCallCta}
                          className="w-full flex items-center justify-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-[11px] py-1.5 px-3 rounded-lg shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <span>📅 Book Free 1-on-1 Strategy Call ➔</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-2 shadow-xs">
                  <SpinnerGap size={14} className="animate-spin text-[var(--primary)]" />
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">Atlas is analyzing…</span>
                </div>
              </div>
            )}
          </div>

          {/* Horizontal scrollable quick-action chips bar */}
          {remainingChips.length > 0 && (
            <div
              className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 overflow-x-auto border-t border-[var(--border-default)] bg-[var(--surface-card)]"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {remainingChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setUsedPrompts((prev) => new Set(prev).add(chip.id))
                    send(chip.prompt)
                  }}
                  disabled={loading}
                  className="shrink-0 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] bg-[var(--surface-base)] hover:bg-[var(--primary-light)] border border-[var(--border-default)] hover:border-[var(--primary)]/30 rounded-full px-2.5 py-1 cursor-pointer transition-all shadow-2xs active:scale-95 disabled:opacity-40"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Chat input form */}
          <div className="p-3 border-t border-[var(--border-default)] bg-[var(--surface-card)] flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask about your resume, LinkedIn, strategy…"
              className="flex-1 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white rounded-xl p-2.5 cursor-pointer transition-all shadow-xs active:scale-95 flex items-center justify-center shrink-0"
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
