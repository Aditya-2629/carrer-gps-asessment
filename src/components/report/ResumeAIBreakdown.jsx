import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle,
  WarningOctagon,
  PaperPlaneRight,
  Brain,
  Sparkle,
  Target,
  FileCode,
  Article,
  ChatCircleText,
} from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'

// Fallback JSON if no resume was uploaded or if mock mode is used
const MOCK_RESUME_JSON = {
  candidate_name: 'Alex Mercer',
  target_role: 'Senior Full Stack Engineer',
  years_of_experience: '4.5 Years',
  contact: { email: 'alex.mercer@example.com', phone: '+1 (555) 234-5678', location: 'San Francisco, CA' },
  top_skills: [],
  missing_ats_keywords: [],
  ats_score: 85,
  strengths: [
    'Strong modern JavaScript/TypeScript framework ecosystem experience',
    'Demonstrated full-stack project deployment capabilities'
  ],
  red_flags: [
    'Bullets lack quantifiable metrics (e.g., %, $, team size, latency reduction)',
    'Non-standard layout elements may cause legacy ATS parsers to drop text'
  ],
  experience_summary: [
    'Engineered web dashboards used by over 50,000 active monthly users.',
    'Restructured backend API endpoints, improving load performance.'
  ],
  education: ['B.S. in Computer Science - State University'],
  executive_ai_critique: "Your resume shows strong technical capability, but in today's brutal IT market, ATS software auto-rejects up to 75% of profiles. Your bullet points describe responsibilities rather than business impact. Without hard dollar figures, speed percentages, and missing ATS keywords like STAR metrics and CI/CD pipelines, your application gets trapped in the ATS blackhole before a recruiter ever reads it."
}

export default function ResumeAIBreakdown({ resumeJsonData }) {
  const resume = resumeJsonData || MOCK_RESUME_JSON
  const userId = useAppStore((s) => s.userId)

  const [showRawJson, setShowRawJson] = useState(false)

  const placeholderPatterns = [
    /^keyword\d+$/i,
    /quantified roi metrics/i,
    /star achievement bullets/i,
    /ci\/cd automation/i,
    /kubernetes orchestration/i,
  ]
  const isPlaceholder = (kw) => {
    if (!kw || typeof kw !== 'string') return true
    return placeholderPatterns.some((pattern) => pattern.test(kw.trim()))
  }

  const missingKeywords = (Array.isArray(resume.missing_ats_keywords) ? resume.missing_ats_keywords : [])
    .map((kw) => (typeof kw === 'string' ? kw : kw?.name || kw?.keyword || ''))
    .filter((kw) => kw && !isPlaceholder(kw))

  // Interactive AI Q&A Text Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: resume.executive_ai_critique || 'Hello! I am Atlas, your AI Career Strategist. Ask me anything about your resume, ATS keyword optimization, or how to fix your application conversion.'
    }
  ])
  const [inputQuery, setInputQuery] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    // Scroll chat stream to bottom when new messages arrive
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleAskAI = async (queryText) => {
    const q = queryText || inputQuery
    if (!q.trim() || isAsking) return

    const userMsg = { sender: 'user', text: q }
    setChatMessages((prev) => [...prev, userMsg])
    setInputQuery('')
    setIsAsking(true)

    try {
      let aiReplyText = ''
      if (userId) {
        const res = await api.askResumeAI({ userId, question: q })
        aiReplyText = res.answer
      } else {
        // Fallback local mock AI response
        const kwMention = missingKeywords.length > 0
          ? `immediately integrate missing keywords (${missingKeywords.slice(0, 2).join(', ')}) and `
          : `ensure achievement metrics are clearly quantified, and `
        aiReplyText = `Regarding "${q}": Based on your parsed resume JSON, your ATS readability score is ${resume.ats_score}/100. To boost your conversion, ${kwMention}rewrite bullet points using measurable revenue/efficiency metrics.`
      }

      const aiMsg = { sender: 'ai', text: aiReplyText }
      setChatMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      console.error(err)
      setChatMessages((prev) => [...prev, { sender: 'ai', text: 'I encountered an error retrieving insights. Please try again.' }])
    } finally {
      setIsAsking(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 75) return '#10b981' // Green
    if (score >= 55) return '#f59e0b' // Amber
    return '#ef4444' // Red
  }

  return (
    <div className="quiz-card p-6 sm:p-8 border border-[var(--border-default)] space-y-8">
      {/* Top Header & Resume Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-default)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkle size={18} weight="fill" className="text-[var(--emerald)] animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-bold text-[var(--primary)]">
              AI Converted Resume Analysis & Context
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
            {resume.candidate_name || 'Candidate Resume Breakdown'}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 font-medium">
            Target Role: <span className="text-[var(--text-primary)] font-bold">{resume.target_role}</span> • Experience: <span className="text-[var(--text-primary)] font-bold">{resume.years_of_experience}</span>
          </p>
        </div>

        {/* ATS Readability Gauge Badge */}
        <div className="flex items-center gap-3.5 bg-[var(--surface-sunken)] p-3.5 rounded-xl border border-[var(--border-default)] shrink-0 shadow-2xs">
          <div className="text-right">
            <div className="text-xs uppercase font-bold text-[var(--text-muted)] tracking-wider">ATS Readability</div>
            <div className="text-xs text-[var(--text-secondary)] font-medium">Parser Index</div>
          </div>
          <div
            className="w-13 h-13 rounded-xl flex items-center justify-center font-extrabold text-xl shadow-xs"
            style={{
              background: `rgba(${resume.ats_score < 60 ? '239,68,68' : resume.ats_score < 75 ? '245,158,11' : '16,185,129'}, 0.15)`,
              color: getScoreColor(resume.ats_score),
              border: `1px solid ${getScoreColor(resume.ats_score)}`
            }}
          >
            {resume.ats_score}
          </div>
        </div>
      </div>

      {/* Atlas AI Resume Context & Executive Critique */}
      <div className="bg-[var(--primary-light)] border border-[var(--primary)]/30 p-6 rounded-xl space-y-3.5 shadow-2xs">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)] shrink-0">
            <Article size={20} weight="bold" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
              Atlas AI Executive Resume Diagnosis
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">Comprehensive contextual feedback on your uploaded resume</p>
          </div>
        </div>

        <div className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed bg-[var(--surface-card)] p-5 rounded-xl border border-[var(--border-default)] space-y-2 font-medium">
          <p className="font-sans leading-relaxed">{resume.executive_ai_critique}</p>
        </div>
      </div>

      {/* Grid: Extracted Skills & Missing ATS Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Extracted Core Skills */}
        <div className="bg-[var(--surface-sunken)] p-6 rounded-xl border border-[var(--border-default)] space-y-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-[var(--emerald)] font-bold text-xs uppercase tracking-wider">
            <Target size={18} />
            <span>Extracted Technical Skills (JSON Schema)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(resume.top_skills || []).map((skill, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-[var(--emerald-bg)] text-[var(--emerald)] border border-emerald-500/20 shadow-2xs"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Missing Critical ATS Keywords */}
        <div className="bg-[var(--surface-sunken)] p-6 rounded-xl border border-[var(--border-default)] space-y-3.5 shadow-2xs">
          <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${missingKeywords.length > 0 ? 'text-amber-500' : 'text-[var(--emerald)]'}`}>
            {missingKeywords.length > 0 ? <WarningOctagon size={18} /> : <CheckCircle size={18} weight="fill" />}
            <span>{missingKeywords.length > 0 ? 'Missing Critical ATS Keywords' : 'Keyword Coverage Status'}</span>
          </div>
          {missingKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {missingKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs"
                >
                  + {kw}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-[var(--emerald)] flex items-center justify-center shrink-0">
                <CheckCircle size={20} weight="fill" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  No Critical Keyword Gaps Found
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Your resume cleanly covers the key technical terminology expected for this role.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Strengths & Red Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--emerald)] flex items-center gap-2">
            <CheckCircle size={18} weight="fill" />
            <span>Key Resume Strengths</span>
          </h4>
          <ul className="space-y-2.5 text-sm text-[var(--text-primary)] list-none pl-0 font-medium">
            {(resume.strengths || []).map((item, idx) => {
              const text = typeof item === 'string' ? item : (item?.description || item?.title || item?.text || '')
              return (
                <li key={idx} className="bg-[var(--surface-sunken)] p-3.5 rounded-xl border border-[var(--border-default)] leading-relaxed flex items-start gap-2.5">
                  <span className="text-[var(--emerald)] font-bold mt-0.5">•</span>
                  <div>
                    {typeof item === 'object' && item?.title && item?.description ? (
                      <>
                        <strong className="text-[var(--text-primary)] block mb-0.5">{item.title}</strong>
                        <span className="text-[var(--text-secondary)]">{item.description}</span>
                      </>
                    ) : (
                      <span>{text}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Red Flags */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-2">
            <WarningOctagon size={18} weight="fill" />
            <span>ATS Red Flags & Structural Weaknesses</span>
          </h4>
          <ul className="space-y-2.5 text-sm text-[var(--text-primary)] list-none pl-0 font-medium">
            {(resume.red_flags || []).map((item, idx) => {
              const text = typeof item === 'string' ? item : (item?.description || item?.title || item?.text || '')
              return (
                <li key={idx} className="bg-red-500/5 p-3.5 rounded-xl border border-red-500/15 leading-relaxed flex items-start gap-2.5">
                  <span className="text-red-500 font-bold mt-0.5">•</span>
                  <div>
                    {typeof item === 'object' && item?.title && item?.description ? (
                      <>
                        <strong className="text-red-400 block mb-0.5">{item.title}</strong>
                        <span className="text-[var(--text-secondary)]">{item.description}</span>
                      </>
                    ) : (
                      <span>{text}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Experience Highlights extracted from JSON */}
      {resume.experience_summary && resume.experience_summary.length > 0 && (
        <div className="bg-[var(--surface-sunken)] p-6 rounded-xl border border-[var(--border-default)] space-y-3.5 shadow-2xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Parsed Experience & Achievement Context
          </h4>
          <div className="space-y-2.5">
            {resume.experience_summary.map((exp, i) => (
              <div key={i} className="text-sm text-[var(--text-primary)] bg-[var(--surface-card)] p-3.5 rounded-xl border border-[var(--border-default)] leading-relaxed font-medium">
                <span className="text-[var(--emerald)] font-bold mr-2">▸</span>
                {exp}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive AI Text Chat Assistant (Talk on Resume) */}
      <div className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-6 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Brain size={22} className="text-[var(--primary)]" />
          <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
            Interactive AI Assistant — Ask Questions About Your Resume
          </h3>
        </div>

        {/* Preset Question Chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleAskAI('Why is my ATS score low and how do I fix it?')}
            className="text-xs sm:text-sm font-medium bg-[var(--surface-muted)] hover:bg-[var(--surface-strong)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            "Why is my ATS score low?"
          </button>
          <button
            onClick={() => handleAskAI('Which missing keywords should I prioritize adding?')}
            className="text-xs sm:text-sm font-medium bg-[var(--surface-muted)] hover:bg-[var(--surface-strong)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            "Which keywords should I add?"
          </button>
          <button
            onClick={() => handleAskAI('Give me an example of rewriting one of my bullet points using Google STAR method.')}
            className="text-xs sm:text-sm font-medium bg-[var(--surface-muted)] hover:bg-[var(--surface-strong)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            "Rewrite a bullet point (STAR method)"
          </button>
        </div>

        {/* Chat Stream */}
        <div className="max-h-72 overflow-y-auto space-y-3.5 pr-2 border-t border-b border-[var(--border-default)] py-4">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1 font-medium">
                {msg.sender === 'user' ? 'You' : (
                  <>
                    <ChatCircleText size={14} className="text-[var(--emerald)]" />
                    <span>Atlas AI Recruiter</span>
                  </>
                )}
              </div>
              <div
                className={`max-w-[88%] text-sm leading-relaxed p-4 rounded-xl font-medium ${
                  msg.sender === 'user'
                    ? 'bg-[var(--primary)] text-white rounded-br-none shadow-sm'
                    : 'bg-[var(--surface-card)] text-[var(--text-primary)] rounded-bl-none border border-[var(--border-default)] font-sans shadow-2xs'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isAsking && (
            <div className="text-sm text-[var(--emerald)] font-medium italic flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--emerald)] animate-ping" />
              Atlas AI is analyzing your resume JSON context...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Question Input */}
        <div className="flex gap-2.5">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
            placeholder="Ask AI anything about your resume context..."
            className="flex-1 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] shadow-2xs"
          />
          <button
            onClick={() => handleAskAI()}
            disabled={isAsking || !inputQuery.trim()}
            className="btn-primary text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <span>Send</span>
            <PaperPlaneRight size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Raw JSON Accordion View Toggle */}
      <div className="pt-2">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <FileCode size={14} />
          <span>{showRawJson ? 'Hide Raw Converted JSON' : 'Inspect Raw Converted Resume JSON Schema'}</span>
        </button>

        {showRawJson && (
          <pre className="mt-3 p-4 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl text-[11px] text-[var(--emerald)] font-mono overflow-x-auto max-h-72">
            {JSON.stringify(resume, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
