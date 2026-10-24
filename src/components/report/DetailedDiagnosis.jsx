import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  LinkedinLogo,
  ShareNetwork,
  UserCheck,
  ShieldWarning,
  Sparkle,
  PaperPlaneRight,
  Brain,
  ChatCircleText,
  FileCode,
  Target,
  WarningOctagon,
  CheckCircle,
  ArrowSquareOut,
  Lightning,
} from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'

export default function DetailedDiagnosis({ reportData, initialTab = 'resume' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const resume = reportData?.resume_json || {}
  const userId = useAppStore((s) => s.userId)

  const [showRawJson, setShowRawJson] = useState(false)

  const rawCritique = resume.executive_ai_critique
  const critiqueText =
    typeof rawCritique === 'string'
      ? rawCritique
      : rawCritique?.critique || rawCritique?.summary || rawCritique?.text || ''

  // Interactive AI Q&A Text Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text:
        critiqueText ||
        'Hello! I am Atlas, your AI Career Strategist. Ask me anything about your resume, ATS keyword optimization, or how to fix your application conversion.',
    },
  ])
  const [inputQuery, setInputQuery] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
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
        const kwPart = missingKeywordsList.length > 0
          ? `integrate missing target keywords (${missingKeywordsList.slice(0, 3).join(', ')}) and `
          : ''
        aiReplyText = `Regarding "${q}": Based on your parsed resume, your ATS readability score is ${resume.ats_score || (missingKeywordsList.length === 0 ? 88 : 68)}/100. To boost your conversion, ${kwPart}rewrite your core achievement bullets using measurable revenue, speed, or throughput metrics.`
      }

      const aiMsg = { sender: 'ai', text: typeof aiReplyText === 'string' ? aiReplyText : JSON.stringify(aiReplyText) }
      setChatMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      console.error(err)
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'I encountered an error retrieving insights. Please try again.' },
      ])
    } finally {
      setIsAsking(false)
    }
  }

  const TABS = [
    { id: 'resume', label: 'Resume & ATS', icon: FileText },
    { id: 'linkedin', label: 'LinkedIn & Outreach', icon: LinkedinLogo },
    { id: 'jobsearch', label: 'Job Search & Velocity', icon: ShareNetwork },
    { id: 'interview', label: 'Interview Readiness', icon: UserCheck },
    { id: 'risks', label: 'Risk Matrix 2x2', icon: ShieldWarning },
  ]

  const rawTools =
    Array.isArray(reportData?.recommended_tools) && reportData.recommended_tools.length > 0
      ? reportData.recommended_tools
      : [
          { name: 'Jobscan', category: 'ATS Resume Scanner', url: 'https://jobscan.co', icon: '🎯' },
          { name: 'Teal HQ', category: 'Job Tracker', url: 'https://tealhq.com', icon: '📊' },
          { name: 'Otta', category: 'Smart Job Board', url: 'https://otta.com', icon: '💼' },
          { name: 'Lemlist', category: 'Cold Email Outreach', url: 'https://lemlist.com', icon: '📧' },
          { name: 'Levels.fyi', category: 'Salary Intelligence', url: 'https://levels.fyi', icon: '💰' },
        ]

  const recommendedTools = rawTools.map((t) => {
    const rawN = typeof t === 'string' ? t : t?.tool_name || t?.name || 'Career Tool'
    const name = typeof rawN === 'string' ? rawN : 'Career Tool'
    const rawC = typeof t === 'object' ? t?.category || t?.reason || 'Tool' : 'Tool'
    const category = typeof rawC === 'string' ? rawC : 'Tool'
    const url = typeof t === 'object' && typeof t?.url === 'string' ? t.url : `https://www.google.com/search?q=${encodeURIComponent(name)}`
    return { name, category, url, icon: typeof t?.icon === 'string' ? t.icon : '🛠️' }
  })

  const rawFacts =
    Array.isArray(reportData?.market_reality_check?.brutal_facts) && reportData.market_reality_check.brutal_facts.length > 0
      ? reportData.market_reality_check.brutal_facts
      : [
          'Modern ATS algorithms auto-reject up to 75% of resumes containing visual charts or layout anomalies.',
          'Average job postings get 350+ applications within 4 hours, making standard Easy Apply ineffective.',
          'Layoffs in senior tech roles mean you are competing directly with overqualified talent.',
        ]

  const realityFacts = rawFacts.map((f) => {
    if (typeof f === 'string') return f
    if (typeof f === 'object' && f) return f.fact || f.text || f.title || ''
    return String(f || '')
  })

  // Extracted Skills (dynamically resolved from resume_json or resume_agent)
  const rawSkills = Array.isArray(resume.top_skills) && resume.top_skills.length > 0
    ? resume.top_skills
    : Array.isArray(resume.skills) && resume.skills.length > 0
    ? resume.skills
    : Array.isArray(reportData?.resume_agent?.canonicalResume?.skills) && reportData.resume_agent.canonicalResume.skills.length > 0
    ? reportData.resume_agent.canonicalResume.skills
    : []

  const skillsList = rawSkills.map((s) => {
    if (typeof s === 'string') return s
    if (typeof s === 'object' && s) return s.name || s.skill || ''
    return String(s || '')
  }).filter(Boolean)

  // Real missing keywords without prefix/dummy fallbacks
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

  // 1) Target JD requirements that were not matched
  const targetJdGaps = (reportData?.resume_agent?.marketContext?.targetAlignment || [])
    .filter((t) => !t.matched)
    .map((t) => t.skill || t.requirement || '')
    .filter(Boolean)

  // 2) Market context gaps between JD/target role and candidate resume
  const marketGaps = (reportData?.resume_agent?.marketContext?.marketEvidenceGaps || [])
    .map((g) => g.skill || g.name || '')
    .filter(Boolean)

  // 3) Parsed missing ATS keywords from resume JSON (ignoring dummy placeholders)
  const parsedAtsKeywords = (Array.isArray(resume.missing_ats_keywords) ? resume.missing_ats_keywords : [])
    .map((kw) => (typeof kw === 'string' ? kw : kw?.name || kw?.keyword || ''))
    .filter((kw) => kw && !isPlaceholder(kw))

  // Combine and deduplicate
  const combinedMissing = Array.from(new Set([...targetJdGaps, ...marketGaps, ...parsedAtsKeywords])).slice(0, 8)
  const missingKeywordsList = combinedMissing

  const rawCritRisk = reportData?.risk_heatmap?.critical_risk
  const criticalRiskText =
    typeof rawCritRisk === 'string'
      ? rawCritRisk
      : rawCritRisk?.title || rawCritRisk?.name || rawCritRisk?.risk || 'Visa Sponsorship Timeline'

  return (
    <section id="diagnosis" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
            Deep-Dive Diagnostics
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Detailed Career Diagnosis
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Select any tab below to inspect detailed metrics, AI critique, and tools
        </p>
      </div>

      {/* Main Tabbed Container */}
      <div className="rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs overflow-hidden">
        {/* Tab Navigation Header */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-3 sm:p-4 bg-[var(--surface-sunken)]/60 border-b border-[var(--border-default)]">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs border border-[var(--border-default)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]/50'
                }`}
              >
                <Icon size={16} weight={isActive ? 'fill' : 'bold'} className={isActive ? 'text-[var(--primary)]' : ''} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content Panes */}
        <div className="p-6 sm:p-8">
          {/* TAB 1: RESUME & ATS */}
          {activeTab === 'resume' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* ATS Score Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
                <div>
                  <h4 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                    ATS Readability & Parser Index
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    How cleanly applicant tracking systems extract your contact, skills, and experience
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold uppercase text-[var(--text-muted)] block">Score</span>
                    <span className={`text-xs font-semibold ${missingKeywordsList.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {missingKeywordsList.length > 0 ? 'Needs Keyword Lift' : '✓ Keyword Coverage Clean'}
                    </span>
                  </div>
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center font-mono font-extrabold text-lg ${
                    missingKeywordsList.length > 0
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {resume.ats_score || (missingKeywordsList.length === 0 ? 88 : 68)}
                  </div>
                </div>
              </div>

              {/* Skills & Missing Keywords Chips */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Extracted Skills */}
                <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--emerald)] flex items-center gap-1.5">
                    <Target size={16} weight="bold" />
                    <span>Extracted Core Skills</span>
                  </span>
                  {skillsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {skillsList.map((s, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--emerald-bg)] text-[var(--emerald)] border border-emerald-500/20">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">
                      No explicit technical skills list extracted from document.
                    </p>
                  )}
                </div>

                {/* Missing Keywords */}
                <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
                  <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${missingKeywordsList.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--emerald)]'}`}>
                    {missingKeywordsList.length > 0 ? (
                      <WarningOctagon size={16} weight="bold" />
                    ) : (
                      <CheckCircle size={16} weight="fill" />
                    )}
                    <span>{missingKeywordsList.length > 0 ? 'Missing Critical ATS Keywords' : 'Keyword Coverage Status'}</span>
                  </span>
                  {missingKeywordsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {missingKeywordsList.map((kw, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
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

              {/* Executive AI Critique */}
              {critiqueText ? (
                <div className="p-5 rounded-2xl bg-[var(--primary-light)] border border-[var(--primary)]/25 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                    <Brain size={16} weight="fill" />
                    <span>Atlas AI Executive Resume Diagnosis</span>
                  </span>
                  <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                    {critiqueText}
                  </p>
                </div>
              ) : null}

              {/* Interactive AI Chat Assistant */}
              <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-4">
                <div className="flex items-center gap-2">
                  <ChatCircleText size={18} className="text-[var(--primary)]" weight="bold" />
                  <h4 className="text-sm font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                    Ask Atlas AI About Your Resume Context
                  </h4>
                </div>

                {/* Question Suggestion Chips */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAskAI('Why is my ATS score low and how do I fix it?')}
                    className="text-xs font-medium bg-[var(--surface-card)] hover:bg-[var(--surface-strong)] px-3 py-1 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    "Why is my ATS score low?"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAskAI('Which missing keywords should I prioritize adding?')}
                    className="text-xs font-medium bg-[var(--surface-card)] hover:bg-[var(--surface-strong)] px-3 py-1 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    "Which keywords should I add?"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAskAI('Give me an example of rewriting one of my bullet points using Google STAR method.')}
                    className="text-xs font-medium bg-[var(--surface-card)] hover:bg-[var(--surface-strong)] px-3 py-1 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    "Rewrite bullet point (STAR method)"
                  </button>
                </div>

                {/* Chat Stream Messages */}
                <div className="max-h-64 overflow-y-auto space-y-3 pr-2 border-t border-b border-[var(--border-default)] py-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className="text-[10px] text-[var(--text-muted)] mb-0.5">
                        {msg.sender === 'user' ? 'You' : 'Atlas AI Coach'}
                      </div>
                      <div
                        className={`max-w-[85%] text-xs sm:text-sm leading-relaxed p-3.5 rounded-xl font-medium ${
                          msg.sender === 'user'
                            ? 'bg-[var(--primary)] text-white rounded-br-none'
                            : 'bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-bl-none shadow-2xs'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isAsking && (
                    <div className="text-xs text-[var(--emerald)] font-medium italic">
                      Atlas AI is analyzing your resume data...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input box */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                    placeholder="Ask any question about your resume or strategy..."
                    className="flex-1 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl px-4 py-2 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAskAI()}
                    disabled={isAsking || !inputQuery.trim()}
                    className="btn-primary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Send</span>
                    <PaperPlaneRight size={14} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Raw JSON Schema Toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <FileCode size={14} />
                  <span>{showRawJson ? 'Hide Raw Resume JSON Schema' : 'Inspect Raw Converted Resume JSON Schema'}</span>
                </button>
                {showRawJson && (
                  <pre className="mt-3 p-4 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl text-[11px] font-mono text-[var(--emerald)] overflow-x-auto max-h-64">
                    {JSON.stringify(resume, null, 2)}
                  </pre>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: LINKEDIN & OUTREACH */}
          {activeTab === 'linkedin' && (() => {
            const liAgent = reportData?.linkedin_agent
            const liScore = liAgent?.score ?? reportData?.scores?.linkedin?.score ?? 60
            const liDiagnosis =
              liAgent?.issues?.[0]?.diagnosis ||
              reportData?.scores?.linkedin?.diagnosis ||
              'Your profile completeness is good, but your weekly search appearance rate is depressed due to missing secondary keyword clusters in your headline and about section.'
            const headlineTip =
              liAgent?.optimizations?.headlines?.[0]?.headline ||
              (liAgent?.missingSkills?.length > 0
                ? `Add "${liAgent.missingSkills.slice(0, 4).join(' | ')}" to your headline to trigger boolean recruiter searches.`
                : skillsList.length > 0
                ? `Feature "${skillsList.slice(0, 4).join(' | ')}" prominently in your headline.`
                : 'Craft a value-focused headline aligning with your target tech stack.')
            const outreachDiagnosis =
              reportData?.scores?.outreach?.diagnosis ||
              'Cold outreach volume is currently in the bottom quartile. Candidates targeting tech roles who send 5 personalized recruiter notes weekly experience a 4x higher interview invitation rate.'
            const outreachCadence =
              reportData?.semantic_profile?.coldEmails?.formattedAnswer ||
              reportData?.user_answers?.coldEmails ||
              '5 personalized connection requests per week with a 3-sentence value proposition.'

            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                        LinkedIn Positioning Score
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                        {liScore}/100
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {liDiagnosis}
                    </p>
                    <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] text-xs text-[var(--primary)] font-semibold leading-relaxed">
                      💡 Tip: {headlineTip}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
                    <h4 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                      Recruiter Outreach Cadence
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {outreachDiagnosis}
                    </p>
                    <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] text-xs text-[var(--emerald)] font-semibold">
                      ✓ Recommended Cadence: {outreachCadence}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })()}

          {/* TAB 3: JOB SEARCH & VELOCITY */}
          {activeTab === 'jobsearch' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Market Reality Facts */}
              <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
                <h4 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                  Market Reality Check & Verified Data
                </h4>
                <ul className="space-y-2 list-none pl-0 text-xs sm:text-sm text-[var(--text-secondary)]">
                  {realityFacts.map((fact, i) => (
                    <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Tool Stack */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Recommended Career Intelligence Stack
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recommendedTools.map((tool, i) => (
                    <a
                      key={i}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] hover:border-[var(--primary)] transition-all flex items-center justify-between group no-underline"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{tool.icon || '🛠️'}</span>
                        <div>
                          <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] block transition-colors">
                            {tool.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] block">
                            {tool.category}
                          </span>
                        </div>
                      </div>
                      <ArrowSquareOut size={14} className="text-[var(--text-muted)] group-hover:text-[var(--primary)]" />
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: INTERVIEW READINESS */}
          {activeTab === 'interview' && (() => {
            const interviewScore = reportData?.scores?.interview?.score ?? reportData?.semantic_profile?.assessScore?.rawAnswer ?? 50
            const interviewDiagnosis =
              reportData?.scores?.interview?.diagnosis ||
              'When explaining architectural choices, anchor every answer in business outcomes:'

            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
                  <h4 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                    Behavioral & Technical STAR Framework
                  </h4>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    Your mock interview score is <strong className="text-[var(--text-primary)] font-bold">{interviewScore}/100</strong>. {interviewDiagnosis}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)]">
                      <span className="text-xs font-bold text-[var(--primary)] block">Situation / Task</span>
                      <span className="text-[11px] text-[var(--text-muted)]">State the scale, throughput, or business constraint.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)]">
                      <span className="text-xs font-bold text-amber-500 block">Action</span>
                      <span className="text-[11px] text-[var(--text-muted)]">Highlight your specific engineering or leadership contribution.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)]">
                      <span className="text-xs font-bold text-[var(--emerald)] block">Result / Metrics</span>
                      <span className="text-[11px] text-[var(--text-muted)]">Quantify latency cuts, uptime, or cost savings achieved.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })()}

          {/* TAB 5: RISK MATRIX 2X2 */}
          {activeTab === 'risks' && (() => {
            const highImpactLowLikelihood =
              reportData?.risk_heatmap?.high_impact_low_likelihood ||
              reportData?.critical_issues?.[1]?.title ||
              'Recruiter Ghosting & Pipeline Freezes'
            const criticalRisk =
              reportData?.risk_heatmap?.critical_risk ||
              reportData?.critical_issues?.[0]?.title ||
              (reportData?.user_answers?.visa && !['US Citizen', 'Permanent Resident (Green Card)'].includes(reportData?.user_answers?.visa)
                ? 'Visa Sponsorship Timeline Constraints'
                : 'Application Volume vs Interview Conversion Gap')
            const lowImpactHighLikelihood =
              reportData?.risk_heatmap?.low_impact_high_likelihood ||
              reportData?.resume_agent?.dashboard?.checks?.find((c) => c.status === 'warn')?.name ||
              'ATS Parsing & Keyword Variance'
            const mitigationPlan =
              reportData?.risk_heatmap?.mitigation_plan || 'Market Macro Stability & Core Stack Demand'

            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-4">
                  <h4 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                    2x2 Risk Quadrant: Likelihood vs Business Impact
                  </h4>
                  <div className="grid grid-cols-2 gap-3 h-64 border-l-2 border-b-2 border-[var(--border-default)] pl-3 pb-3 text-xs">
                    <div className="p-3 rounded-xl bg-red-500/5 border border-dashed border-[var(--border-default)] flex flex-col justify-end">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">High Impact / Low Likelihood</span>
                      <span className="text-xs font-semibold text-red-500 mt-1">• {highImpactLowLikelihood}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-red-600 dark:text-red-400 font-bold uppercase">Critical Risk Zone</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/20 px-2 py-1 rounded w-fit">
                        + {criticalRisk}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-[var(--border-default)] flex items-end">
                      <span className="text-xs font-semibold text-[var(--emerald)]">✓ {mitigationPlan}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-center">
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase">Low Impact / High Likelihood</span>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">• {lowImpactHighLikelihood}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })()}
        </div>
      </div>
    </section>
  )
}
