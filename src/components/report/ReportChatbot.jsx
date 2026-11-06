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
import DiffSnippetCard from './DiffSnippetCard'
import ProgramPricingCard from './ProgramPricingCard'

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
 * Detects if a text block contains a bullet rewrite with Original Bullet and Optimized Google XYZ Bullet
 */
function tryParseBulletDiff(text) {
  if (!text) return null

  // Format 1: Explicit :::diff ... :::
  const diffTagMatch = text.match(/:::diff\s*([\s\S]*?)\s*:::/i)
  if (diffTagMatch) {
    const raw = diffTagMatch[1]
    const beforeMatch = raw.match(/before:\s*["']?([\s\S]*?)["']?(?=\nafter:|$)/i)
    const afterMatch = raw.match(/after:\s*["']?([\s\S]*?)["']?(?=\n(?:scoreBefore|keywords|impact|:::)|$)/i)
    const kwMatch = raw.match(/keywords:\s*(.*?)(?=\n|$)/i)
    const impactMatch = raw.match(/impact:\s*(.*?)(?=\n|$)/i)
    return {
      before: beforeMatch ? beforeMatch[1].trim() : '',
      after: afterMatch ? afterMatch[1].trim() : '',
      keywords: kwMatch ? kwMatch[1].split(',').map((k) => k.trim()).filter(Boolean) : [],
      metricImpact: impactMatch ? impactMatch[1].trim() : '',
      fullMatch: diffTagMatch[0],
    }
  }

  // Format 2: Agent synthesis format with Original Bullet and Optimized Google XYZ Bullet
  const hasOriginal = /(?:\*\*Original Bullet\*\*|Original Bullet:)/i.test(text)
  const hasOptimized = /(?:\*\*Optimized (?:Google )?XYZ Bullet\*\*|Optimized Bullet:)/i.test(text)

  if (hasOriginal && hasOptimized) {
    const beforeMatch = text.match(/(?:\*\*Original Bullet\*\*|Original Bullet:)\s*[:\n-]*\s*([^\n*#]+)/i)
    const codeBlockMatch = text.match(/(?:\*\*Optimized (?:Google )?XYZ Bullet\*\*|Optimized Bullet:)\s*[:\n-]*\s*```(?:text)?\s*([\s\S]*?)```/i)
    const plainAfterMatch = text.match(/(?:\*\*Optimized (?:Google )?XYZ Bullet\*\*|Optimized Bullet:)\s*[:\n-]*\s*([^\n*#]+)/i)
    const kwMatch = text.match(/(?:\*\*Weaved Market Keywords\*\*|Weaved Market Keywords:)\s*[:\n-]*\s*([^\n*#]+)/i)
    const impactMatch = text.match(/(?:\*\*Impact Metric Calibration\*\*|Impact Metric Calibration:)\s*[:\n-]*\s*([^\n*#]+)/i)

    const before = beforeMatch ? beforeMatch[1].trim() : ''
    const after = codeBlockMatch ? codeBlockMatch[1].trim() : (plainAfterMatch ? plainAfterMatch[1].trim() : '')

    if (after) {
      const keywords = kwMatch
        ? kwMatch[1].split(/[,•;]+/).map((k) => k.replace(/^[*-]\s*/, '').trim()).filter(Boolean)
        : []
      const metricImpact = impactMatch ? impactMatch[1].trim() : ''

      return {
        before,
        after,
        keywords,
        metricImpact,
        scoreBefore: 42,
        scoreAfter: 88,
      }
    }
  }

  return null
}

/**
 * Detects if a text contains Crafture program comparison or pricing triggers
 */
function hasProgramPricingTrigger(text) {
  if (!text) return false
  if (/:::programs/i.test(text)) return true
  const mentionsPricing =
    /(?:CRAFTURE (?:OFFICIAL )?PROGRAMS|PROGRAMS & PRICING|\$150\/month|\$300\/month|Starter Experience.*Free Forever)/i.test(
      text
    )
  return mentionsPricing
}

/**
 * Renders markdown table lines into clean responsive HTML tables
 */
function renderMarkdownTable(tableLines, key) {
  if (!tableLines || tableLines.length < 2) return null
  const parseRow = (line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())

  const headerCells = parseRow(tableLines[0])
  const dataRows = tableLines.slice(2).map(parseRow)

  return (
    <div key={key} className="overflow-x-auto my-3 rounded-xl border border-[var(--border-default)] shadow-2xs">
      <table className="min-w-full text-xs text-left">
        <thead className="bg-[var(--surface-card)] border-b border-[var(--border-default)]">
          <tr>
            {headerCells.map((h, i) => (
              <th key={i} className="px-3 py-2 font-bold text-[var(--text-primary)]">
                {renderInlineFormatting(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-default)] bg-[var(--surface-base)]">
          {dataRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-[var(--surface-card)]/50 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">
                  {renderInlineFormatting(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Parses markdown text chunks into paragraphs, bullet lists, styled executive blockquotes,
 * tables, diff snippet cards, and copyable snippets.
 */
function renderMessageContent(text, options = {}) {
  if (!text) return null
  const { onBookCall } = options

  // 1. Detect Bullet Diff
  const diffData = tryParseBulletDiff(text)

  // 2. Detect Program Pricing Trigger
  const showProgramsCard = hasProgramPricingTrigger(text)

  // Clean custom tags from text before parsing
  let cleanText = text
  if (diffData?.fullMatch) {
    cleanText = cleanText.replace(diffData.fullMatch, '').trim()
  }
  cleanText = cleanText.replace(/:::programs\s*:::/gi, '').trim()

  // Split out fenced code blocks (```...```)
  const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g
  const parts = cleanText.split(codeBlockRegex)

  const renderedContent = parts.map((part, partIdx) => {
    // Odd index = matched code block content
    if (partIdx % 2 === 1) {
      return <CopyableSnippetCard key={`code-${partIdx}`} snippet={part} />
    }

    // Even index = regular markdown text chunk
    const lines = part.split('\n')
    const elements = []
    let currentBulletList = []
    let currentTableLines = []

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

    const flushTable = () => {
      if (currentTableLines.length >= 2) {
        elements.push(renderMarkdownTable(currentTableLines, `table-${elements.length}`))
        currentTableLines = []
      } else if (currentTableLines.length > 0) {
        currentTableLines.forEach((tLine, tIdx) => {
          elements.push(
            <p key={`p-t-${elements.length}-${tIdx}`} className="my-1.5 text-xs leading-relaxed text-[var(--text-primary)]">
              {renderInlineFormatting(tLine)}
            </p>
          )
        })
        currentTableLines = []
      }
    }

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim()
      if (!trimmed) {
        flushBulletList()
        flushTable()
        return
      }

      // Check table row (| col | col |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushBulletList()
        currentTableLines.push(trimmed)
        return
      } else if (currentTableLines.length > 0) {
        flushTable()
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
    flushTable()
    return <div key={`text-seg-${partIdx}`}>{elements}</div>
  })

  return (
    <div className="space-y-2">
      {/* If diffData detected, show DiffSnippetCard at top */}
      {diffData && (
        <DiffSnippetCard
          before={diffData.before}
          after={diffData.after}
          scoreBefore={diffData.scoreBefore || 42}
          scoreAfter={diffData.scoreAfter || 88}
          keywords={diffData.keywords}
          metricImpact={diffData.metricImpact}
        />
      )}

      {/* Render text parts */}
      {renderedContent}

      {/* If program pricing triggered, render ProgramPricingCard */}
      {showProgramsCard && (
        <ProgramPricingCard onBookCall={onBookCall} />
      )}
    </div>
  )
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
    const rawName =
      reportData?.resume_agent?.candidateSnapshot?.name ||
      reportData?.resume_json?.candidate?.name ||
      reportData?.resume_json?.candidate_name ||
      reportData?.resume_json?.name ||
      reportData?.candidate_name ||
      reportData?.resume_agent?.canonicalResume?.candidate?.name ||
      formData?.name ||
      formData?.fullName ||
      ''

    if (typeof rawName === 'string' && rawName.trim()) {
      const clean = rawName.trim().replace(/^(mr|ms|mrs|dr)\.?\s+/i, '')
      return clean.split(/\s+/)[0]
    }
    return 'there'
  }, [reportData, formData])

  const targetRole = useMemo(() => {
    return (
      reportData?.assessment_agent?.candidateProfile?.targetRole ||
      formData?.targetRole ||
      reportData?.resume_json?.target_role ||
      reportData?.target_role ||
      'your target role'
    )
  }, [reportData, formData])

  const { latestCompany, shortCompany } = useMemo(() => {
    const experiences =
      reportData?.resume_agent?.canonicalResume?.experiences ||
      reportData?.resume_agent?.canonicalResume?.experience ||
      reportData?.resume_json?.experiences ||
      reportData?.resume_json?.experience ||
      []

    const rawComp =
      reportData?.resume_agent?.candidateSnapshot?.presentCompany ||
      experiences[0]?.company ||
      experiences[0]?.employer ||
      reportData?.present_company ||
      ''

    const full = typeof rawComp === 'string' ? rawComp.trim() : ''
    // For chip labels, pick the primary brand before slashes or dashes (e.g. "Collabera / Bank of America" -> "Collabera")
    const short = full ? full.split(/[\/\-–|]/)[0].trim() : ''

    return {
      latestCompany: full,
      shortCompany: short
    }
  }, [reportData])

  const bottleneckTitle = useMemo(() => {
    const raw =
      reportData?.primary_bottleneck?.title ||
      reportData?.primary_bottleneck ||
      reportData?.assessment_agent?.primaryBottleneck?.title ||
      reportData?.critical_issues?.[0]?.title ||
      ''
    return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Application & Targeting Alignment'
  }, [reportData])

  const overallScore = useMemo(() => {
    return reportData?.career_health_score || reportData?.gps_score || 72
  }, [reportData])

  const topSkill = useMemo(() => {
    const skills =
      reportData?.resume_agent?.canonicalResume?.skills ||
      reportData?.resume_json?.top_skills ||
      reportData?.resume_json?.skills ||
      []
    if (skills.length > 0) {
      const first = skills[0]
      return typeof first === 'string' ? first : first?.name || 'System Architecture'
    }
    return 'System Architecture'
  }, [reportData])

  // Dynamic initial greeting message
  const initialGreeting = useMemo(() => {
    const companyClause = latestCompany
      ? `verified your track record at **${latestCompany}**`
      : `verified your professional experience`

    return `Hey **${firstName}**! I'm **Atlas from Crafture, your Career GPS Partner**. We've analyzed your **${targetRole}** profile (**${overallScore}/100**), ${companyClause}, and isolated your primary funnel choke point: **${bottleneckTitle}**.\n\nWhether you need Google XYZ bullet rewrites, our 6-Phase Framework roadmap, or 1-on-1 coaching details, we're here to build your competitive edge. Where should we start?`
  }, [firstName, targetRole, overallScore, latestCompany, bottleneckTitle])

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
  const [followUpChips, setFollowUpChips] = useState([])
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const isUserScrolledUp = useRef(false)

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 60
  }

  // Sync greeting when reportData updates
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'agent') {
        return [{ role: 'agent', text: initialGreeting, suggestCall: false }]
      }
      return prev
    })
  }, [initialGreeting])

  // Auto-scroll on new message, open, or token arrival (unless user manually scrolled up)
  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUp.current) {
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

  // 6 Dynamic Crafture Contextual Action Chips
  const STARTER_CHIPS = useMemo(
    () => [
      {
        id: 'bottleneck',
        label: `🎯 Fix "${bottleneckTitle.slice(0, 20)}${bottleneckTitle.length > 20 ? '...' : ''}"`,
        prompt: `How do we fix my primary choke point ("${bottleneckTitle}") using the Crafture 6-Phase Career GPS Framework?`,
      },
      {
        id: 'bullet',
        label: shortCompany ? `✍️ Rewrite ${shortCompany} bullet` : '✍️ Rewrite top impact bullet',
        prompt: latestCompany
          ? `Rewrite my weakest resume bullet at ${latestCompany} with stronger Google XYZ impact metrics.`
          : 'Rewrite my weakest resume bullet with stronger Google XYZ impact metrics.',
      },
      {
        id: 'interview',
        label: `🎤 Mock Interview on ${topSkill.slice(0, 18)}`,
        prompt: `Ask me 1 tough interview question for a ${targetRole} role focusing on ${topSkill} and show me a strong STAR answer with architectural trade-offs.`,
      },
      {
        id: 'pricing',
        label: '💼 Programs & Pricing',
        prompt: "What are Crafture's official programs and pricing options ($0 Starter, $150 AI, $300 Elite)?",
      },
      {
        id: 'visa',
        label: '🛂 Visa & Work Auth Guidance',
        prompt: "What is Crafture's strategic guidance for F-1 OPT / STEM OPT and H-1B visa sponsorship job searches?",
      },
      {
        id: 'plan',
        label: '🚀 7-Day Rapid Triage',
        prompt: 'Give me a concrete 7-day daily execution checklist based on my report diagnosis.',
      },
    ],
    [bottleneckTitle, latestCompany, shortCompany, targetRole, topSkill]
  )

  const remainingChips = useMemo(() => {
    const followUpIds = new Set(followUpChips.map((c) => c.id))
    const unusedStarters = STARTER_CHIPS.filter(
      (chip) => !usedPrompts.has(chip.id) && !followUpIds.has(chip.id)
    )
    return [...followUpChips, ...unusedStarters].slice(0, 6)
  }, [followUpChips, STARTER_CHIPS, usedPrompts])

  // Real-Time Token Streaming Consumer via /api/assessment/chat-stream
  const send = useCallback(
    async (text) => {
      const question = (text ?? input).trim()
      if (!question || loading) return

      setInput('')
      isUserScrolledUp.current = false
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      // Dynamic Contextual Follow-Up Suggestions Lifecycle
      const q = question.toLowerCase()
      if (/bullet|rewrite|impact|quantif|xyz/i.test(q)) {
        setFollowUpChips([
          {
            id: 'rewrite-another',
            label: '✍️ Rewrite another bullet',
            prompt: 'Show me my second weakest resume bullet point and rewrite it with Google XYZ metrics.',
          },
          {
            id: 'mock-drill',
            label: '🎤 Practice interview question for this experience',
            prompt: 'Ask me 1 tough interview question about this accomplishment and show me how to answer with STAR.',
          },
        ])
      } else if (/interview|star|behavioral|mock|question|answer/i.test(q)) {
        setFollowUpChips([
          {
            id: 'add-7day',
            label: '🚀 Add to my 7-day plan',
            prompt: 'How do I incorporate this interview defense into my daily 7-day prep schedule?',
          },
          {
            id: 'live-consult',
            label: '📅 Practice live with a human coach',
            prompt: "How do I schedule a live 1-on-1 mock interview with Crafture's executive coach?",
          },
        ])
      } else if (/pricing|program|cost|\$150|\$300|starter|elite/i.test(q)) {
        setFollowUpChips([
          {
            id: 'book-consult',
            label: '📅 Book 1-on-1 Consultation',
            prompt: 'How do I book a consultation to discuss the Elite program?',
          },
          {
            id: 'choke-fix',
            label: `🎯 Fix "${bottleneckTitle.slice(0, 18)}..."`,
            prompt: `How do we fix my primary choke point ("${bottleneckTitle}") using the Crafture 6-Phase Career GPS Framework?`,
          },
        ])
      } else if (/choke|bottleneck|stuck|phase/i.test(q)) {
        setFollowUpChips([
          {
            id: 'rewrite-bullet-choke',
            label: '✍️ Rewrite top impact bullet',
            prompt: 'Rewrite my weakest resume bullet with stronger Google XYZ impact metrics.',
          },
          {
            id: 'plan-choke',
            label: '🚀 7-Day Rapid Triage',
            prompt: 'Give me a concrete 7-day daily execution checklist based on my report diagnosis.',
          },
        ])
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
              break
            }
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6).trim()
              if (dataStr === '[DONE]') {
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
          <span>Ask Crafture Copilot</span>
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
                  <span>Atlas • Crafture Career GPS</span>
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
            onScroll={handleScroll}
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
                        {renderMessageContent(m.text, { onBookCall: handleStrategyCallCta })}
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
