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
  ArrowsOutSimple,
  ArrowsInSimple,
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
 * Enhanced 1-Click Copyable Snippet Card for bullet rewrites, headlines, or cold outreach scripts
 * Displays header badge, character + word count, and smooth copy animation.
 */
function CopyableSnippetCard({ snippet }) {
  const [copied, setCopied] = useState(false)
  const trimmed = (snippet || '').trim()
  const charCount = trimmed.length
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0

  const handleCopy = (e) => {
    e.stopPropagation()
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(trimmed)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="my-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface-card)] border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 tracking-wider uppercase">
            Ready-to-Paste Template
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {charCount} chars • {wordCount} words
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] bg-[var(--surface-base)] px-2.5 py-1 rounded-lg border border-[var(--border-default)] cursor-pointer transition-all active:scale-95 shadow-2xs"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check size={13} weight="bold" className="text-emerald-500" />
              <span className="text-emerald-500 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} weight="bold" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 text-[11px] font-mono leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap select-all bg-[var(--surface-base)]">
        {trimmed}
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
          className="px-1.5 py-0.5 rounded bg-[var(--surface-base)] border border-[var(--border-default)] text-[11px] font-mono text-[var(--primary)]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    return token
  })
}

/**
 * Parses markdown text chunks into paragraphs, bullet lists, styled executive blockquotes, and copyable snippets
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
          <ul key={`ul-${elements.length}`} className="my-2 space-y-1.5 pl-1">
            {currentBulletList.map((item, liIdx) => (
              <li key={liIdx} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-primary)]">
                <span className="text-emerald-500 font-bold text-xs select-none mt-0.5">•</span>
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
          <div key={`num-${lineIdx}`} className="flex items-start gap-2 text-xs leading-relaxed my-1.5">
            <span className="font-bold text-[var(--primary)] text-xs select-none">{numMatch[1]}.</span>
            <div className="flex-1 text-[var(--text-primary)]">{renderInlineFormatting(numMatch[2])}</div>
          </div>
        )
        return
      }

      // Check executive blockquote (> text) with callout styling
      if (trimmed.startsWith('>')) {
        flushBulletList()
        const quoteContent = trimmed.replace(/^>\s*/, '')
        elements.push(
          <div
            key={`quote-${lineIdx}`}
            className="my-2.5 pl-3.5 pr-3 py-2 border-l-4 border-emerald-500 italic text-[var(--text-primary)] text-xs leading-relaxed bg-emerald-500/5 dark:bg-emerald-500/10 rounded-r-xl shadow-2xs"
          >
            {renderInlineFormatting(quoteContent)}
          </div>
        )
        return
      }

      // Regular paragraph
      flushBulletList()
      elements.push(
        <p key={`p-${lineIdx}`} className="my-1.5 text-xs leading-relaxed text-[var(--text-primary)]">
          {renderInlineFormatting(trimmed)}
        </p>
      )
    })

    flushBulletList()
    return <div key={`text-seg-${partIdx}`}>{elements}</div>
  })
}

export default function ReportChatbot() {
  const storeUserId = useAppStore((s) => s.userId)
  const reportData = useAppStore((s) => s.reportData)
  const formData = useAppStore((s) => s.formData)
  const email = useAppStore((s) => s.email)

  const effectiveUserId = useMemo(() => {
    return (
      storeUserId ||
      reportData?.userId ||
      reportData?._id ||
      reportData?.user_answers?.userId ||
      sessionStorage.getItem('career_gps_user_id') ||
      localStorage.getItem('career_gps_user_id') ||
      null
    )
  }, [storeUserId, reportData])

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
      reportData?.resume_json?.experiences?.[0]?.company ||
      'my latest company'
    )
  }, [reportData])

  const bottleneckTitle = useMemo(() => {
    return (
      reportData?.primary_bottleneck?.title ||
      reportData?.assessment_agent?.primaryBottleneck?.title ||
      reportData?.critical_issues?.[0]?.title ||
      'my #1 bottleneck'
    )
  }, [reportData])

  const overallScore = useMemo(() => {
    return reportData?.career_health_score || reportData?.gps_score || 72
  }, [reportData])

  const topSkill = useMemo(() => {
    const skills =
      reportData?.resume_agent?.verifiedSkills ||
      reportData?.resume_agent?.dashboard?.keywordAlignment?.matchedInExperience ||
      reportData?.resume_json?.skills ||
      []
    const first = Array.isArray(skills) ? skills[0] : ''
    return (typeof first === 'string' ? first : first?.name || '') || 'System Design'
  }, [reportData])

  // Dynamic initial greeting message
  const initialGreeting = useMemo(() => {
    return `Hey **${firstName}**! I'm **Atlas**, your Executive Career Partner. I've analyzed your **${targetRole}** profile (**${overallScore}/100**), verified your track record at **${latestCompany}**, and isolated your primary funnel choke point: **${bottleneckTitle}**.\n\nWhether you need Google XYZ bullet rewrites, a 50-word InMail to target hiring managers, or mock interview drills on **${topSkill}**, let's build your competitive edge. Where should we start?`
  }, [firstName, targetRole, overallScore, latestCompany, bottleneckTitle, topSkill])

  const [open, setOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
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
  const textareaRef = useRef(null)

  // Sync greeting when reportData updates
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'agent') {
        return [{ role: 'agent', text: initialGreeting, suggestCall: false }]
      }
      return prev
    })
  }, [initialGreeting])

  // Auto-scroll on new message, open, or token arrival
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, open, loading])

  // Auto-resize textarea based on input content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  // 5 Dynamic Contextual Action Chips
  const STARTER_CHIPS = useMemo(
    () => [
      {
        id: 'company-bullet',
        label: `✍️ Rewrite ${latestCompany} bullet`,
        prompt: `Rewrite my weakest bullet from ${latestCompany} using the Google XYZ formula with concrete architectural mechanisms and quantifiable impact.`,
      },
      {
        id: 'bottleneck',
        label: `🎯 Fix my #${bottleneckTitle}`,
        prompt: `How do I systematically resolve my primary bottleneck ("${bottleneckTitle}") to raise my callback rate this week?`,
      },
      {
        id: 'inmail',
        label: `📬 50-word InMail for ${targetRole}`,
        prompt: `Draft a high-converting, 50-75 word LinkedIn InMail to an Engineering Director hiring for a ${targetRole} role, referencing my recent work at ${latestCompany}.`,
      },
      {
        id: 'mock-interview',
        label: `🎤 Mock Interview on ${topSkill}`,
        prompt: `Run a tough, technical interview drill on ${topSkill} for a ${targetRole} interview. Ask 1 question and outline the ideal STAR architectural answer.`,
      },
      {
        id: 'salary-rails',
        label: `💰 Salary Negotiation Rails`,
        prompt: `What are the market compensation rails for a ${targetRole} in the US tech market, and how do I defend my top-of-band ask without getting screened out?`,
      },
    ],
    [latestCompany, bottleneckTitle, targetRole, topSkill]
  )

  const remainingChips = useMemo(
    () => STARTER_CHIPS.filter((chip) => !usedPrompts.has(chip.id)),
    [STARTER_CHIPS, usedPrompts]
  )

  // Real-Time Token Streaming Consumer via /api/assessment/chat-stream
  const send = useCallback(
    async (text) => {
      const question = (text ?? input).trim()
      if (!question || loading) return

      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      const nextUserMsg = { role: 'user', text: question }
      const updatedMessages = [...messages, nextUserMsg]
      setMessages(updatedMessages)
      setLoading(true)

      const historyPayload = updatedMessages.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }))

      // Prepare placeholder streaming agent message
      const placeholderAgentMsg = {
        role: 'agent',
        text: '',
        isStreaming: true,
        suggestCall: false,
      }
      setMessages([...updatedMessages, placeholderAgentMsg])

      let streamingCompleted = false
      let accumulatedText = ''

      try {
        // Attempt SSE token streaming from /api/assessment/chat-stream
        const response = await fetch('/api/assessment/chat-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: effectiveUserId,
            question,
            history: historyPayload,
          }),
        })

        if (!response.ok || !response.body) {
          throw new Error(`Streaming failed with status: ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith(':')) continue
            if (trimmed === 'data: [DONE]') {
              streamingCompleted = true
              break
            }
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6).trim()
              if (dataStr === '[DONE]') {
                streamingCompleted = true
                break
              }
              try {
                const parsed = JSON.parse(dataStr)
                if (parsed.token) {
                  accumulatedText += parsed.token
                  setMessages((prev) => {
                    const last = prev[prev.length - 1]
                    if (last && last.role === 'agent' && last.isStreaming) {
                      return [
                        ...prev.slice(0, -1),
                        { ...last, text: accumulatedText },
                      ]
                    }
                    return prev
                  })
                }
              } catch (_) {}
            }
          }
        }
        streamingCompleted = true
      } catch (streamErr) {
        console.warn('[ReportChatbot] Streaming connection failed, falling back to JSON API:', streamErr.message)
        // Fallback to non-streaming endpoint
        try {
          const res = await api.post('/assessment/resume-talk', {
            userId: effectiveUserId,
            question,
            history: historyPayload,
          })

          let rawAnswer = String(res.data?.answer || res.data?.reply || '').trim()
          accumulatedText = rawAnswer
          streamingCompleted = true
        } catch (_jsonErr) {
          accumulatedText = 'Atlas is momentarily reviewing candidate files. Please try again in a moment or book your 1-on-1 strategy call below!'
        }
      } finally {
        // Finalize agent message
        const shouldSuggestCall =
          /(\b(call|strategy session|book|coach|coaching|referral|mock|interview prep|negotiate|offer)\b)/i.test(
            question + ' ' + accumulatedText
          )

        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'agent') {
            return [
              ...prev.slice(0, -1),
              {
                role: 'agent',
                text: accumulatedText || 'Sorry — I could not generate an answer. Please try again.',
                isStreaming: false,
                suggestCall: shouldSuggestCall,
              },
            ]
          }
          return prev
        })
        setLoading(false)
      }
    },
    [input, loading, messages, effectiveUserId]
  )

  const handleStrategyCallCta = async () => {
    if (email) {
      try {
        await api.post('/assessment/book-call', { email })
      } catch (_e) {}
    }
    setOpen(false)
    scrollToSection('#final-cta')
  }

  return (
    <>
      {/* Floating Copilot Pill Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-gradient-to-r from-[var(--primary)] to-emerald-600 hover:from-[var(--primary-hover)] hover:to-emerald-500 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl shadow-[var(--primary-ring)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          aria-label="Open Atlas Copilot"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
          </span>
          <ChatCircleDots size={20} weight="fill" />
          <span>Ask Atlas Copilot</span>
          <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded-full">
            {overallScore}/100
          </span>
        </button>
      )}

      {/* Expandable Executive Workspace Drawer */}
      {open && (
        <div
          className={`fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out ${
            isExpanded
              ? 'w-[calc(100vw-2rem)] sm:w-[680px]'
              : 'w-[calc(100vw-2rem)] sm:w-[440px]'
          }`}
          style={{ height: 'min(680px, 85vh)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--surface-card)]">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20 shadow-2xs">
                <Sparkle size={18} weight="fill" />
              </span>
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Atlas Executive Partner</span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active Intelligence
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[280px]">
                  {targetRole} • Health Score {overallScore}/100
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Maximize / Minimize Workspace Toggle */}
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--surface-base)] cursor-pointer transition-colors"
                title={isExpanded ? 'Restore width' : 'Expand workspace'}
                aria-label={isExpanded ? 'Minimize width' : 'Expand width'}
              >
                {isExpanded ? <ArrowsInSimple size={17} /> : <ArrowsOutSimple size={17} />}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--surface-base)] cursor-pointer transition-colors"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages container */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 bg-[var(--surface-base)]/50"
          >
            {messages.map((m, i) => {
              const isAgent = m.role === 'agent'
              const showCallCta = isAgent && m.suggestCall === true

              return (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'max-w-[85%] bg-[var(--primary)] text-white px-4 py-2.5 rounded-2xl rounded-br-xs shadow-sm whitespace-pre-wrap'
                        : isExpanded
                        ? 'max-w-[94%] bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-primary)] px-4.5 py-3.5 rounded-2xl rounded-bl-xs shadow-xs'
                        : 'max-w-[90%] bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-primary)] px-4 py-3 rounded-2xl rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {/* Message Body */}
                    {isAgent ? (
                      <div>
                        {renderMessageContent(m.text)}
                        {m.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 bg-emerald-500 animate-pulse ml-1 align-middle"></span>
                        )}
                      </div>
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
                      <div className="mt-3.5 p-3 rounded-xl bg-gradient-to-br from-[var(--primary-light)] via-[var(--surface-card)] to-[var(--surface-base)] border border-[var(--primary)]/30 space-y-2 shadow-xs">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)]">
                          <CalendarBlank size={14} className="text-[var(--primary)]" weight="bold" />
                          <span>Want hands-on execution help for your {targetRole} search?</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleStrategyCallCta}
                          className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-[var(--primary)] to-emerald-600 hover:from-[var(--primary-hover)] hover:to-emerald-500 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <span>📅 Book Free 1-on-1 Strategy Call ➔</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {loading && !messages.some((m) => m.isStreaming && m.text.length > 0) && (
              <div className="flex justify-start">
                <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-2 shadow-xs">
                  <SpinnerGap size={14} className="animate-spin text-emerald-500" />
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">
                    Atlas is formulating your strategy…
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Horizontal scrollable quick-action chips bar */}
          {remainingChips.length > 0 && (
            <div
              className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 overflow-x-auto border-t border-[var(--border-default)] bg-[var(--surface-card)] shrink-0"
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

          {/* Chat input form with auto-resizing textarea */}
          <div className="p-3 border-t border-[var(--border-default)] bg-[var(--surface-card)] flex items-end gap-2 shrink-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask about your resume bullets, interview answers, InMails…"
              className="flex-1 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors resize-none max-h-[120px] leading-relaxed"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white rounded-xl p-2.5 cursor-pointer transition-all shadow-xs active:scale-95 flex items-center justify-center shrink-0 mb-0.5"
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
