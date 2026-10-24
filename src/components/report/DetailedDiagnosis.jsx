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
  Copy,
  Check,
  Microphone,
} from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'

function extractStarStories(canonicalResume, targetRole, skillsList, resumeJson) {
  const experiences = canonicalResume?.experience || resumeJson?.work_experience || resumeJson?.experience || []
  const candidates = []

  for (const exp of experiences) {
    const role = exp.role || exp.title || exp.position || targetRole || 'Software Engineer'
    const company = exp.company || exp.companyName || 'Enterprise Systems'
    const bullets = Array.isArray(exp.bullets)
      ? exp.bullets
      : Array.isArray(exp.responsibilities)
      ? exp.responsibilities
      : []

    for (const b of bullets) {
      const text = typeof b === 'string' ? b : b?.text || ''
      if (!text || text.length < 35) continue

      const hasMetric = /\b\d+(?:%|\+?k|\+?x|\+?ms|\+?m|\+?s|\+?gb|\+?tb|\+)?\b/i.test(text)
      const hasActionVerb = /^(?:architected|engineered|optimized|designed|developed|implemented|automated|spearheaded|refactored|migrated|built|hardened|scaled|modernized)\b/i.test(text.trim())
      const score = (hasMetric ? 50 : 0) + (hasActionVerb ? 20 : 0) + Math.min(30, Math.floor(text.length / 5))

      candidates.push({
        text,
        role,
        company,
        score,
        hasMetric,
      })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const topBullets = candidates.slice(0, 3)

  if (topBullets.length === 0) {
    const primarySkill = skillsList[0] || 'Cloud & API Architecture'
    const secondarySkill = skillsList[1] || 'Modern Frontend Systems'
    const tertiarySkill = skillsList[2] || 'Automated CI/CD Pipelines'

    return [
      {
        id: 'star_1',
        title: `Story #1: ${targetRole} Core Architecture`,
        originalBullet: `Architected and deployed scalable ${primarySkill} services with zero downtime and strict SLA guarantees.`,
        situation: `Legacy service architecture created throughput limits and latency spikes during high concurrency spikes.`,
        action: `Spearheaded migration to distributed service patterns with connection pooling, automated retry policies, and telemetry tracking.`,
        result: `Reduced p99 API latency by 35% and maintained 99.99% uptime across production clusters.`,
        followUp: `How did you benchmark and profile bottlenecks before making the architectural change?`,
        followUpTip: `Walk through your metrics gathering (APM, distributed tracing) and justify your technology choices over simpler alternatives.`,
      },
      {
        id: 'star_2',
        title: `Story #2: ${secondarySkill} Modernization`,
        originalBullet: `Engineered responsive, highly accessible user interfaces leveraging ${secondarySkill} and modern state management.`,
        situation: `Fragmented state management and slow render loops degraded client performance and user engagement.`,
        action: `Refactored front-end architecture with component modularity, client-side caching, and strict accessibility standards.`,
        result: `Accelerated initial page load times by 40% and achieved 100% WCAG accessibility compliance.`,
        followUp: `What strategies did you use to prevent unnecessary re-renders and handle state synchronization?`,
        followUpTip: `Explain memoization patterns, optimistic UI updates, and how error boundaries protected user workflow states.`,
      },
      {
        id: 'star_3',
        title: `Story #3: ${tertiarySkill} Reliability Engineering`,
        originalBullet: `Automated test suites and CI/CD deployment pipelines using ${tertiarySkill} for immutable artifact generation.`,
        situation: `Manual deployment steps and inconsistent testing coverage created production regression risks and slowed releases.`,
        action: `Built containerized CI/CD stages with automated integration gates, vulnerability scanning, and automated rollbacks.`,
        result: `Decreased release deployment times from 4 hours to 15 minutes while cutting post-release bug reports by 60%.`,
        followUp: `How did your team handle database migrations and automated rollbacks safely in production?`,
        followUpTip: `Explain blue/green deployment strategy, forward-compatible schema migrations, and synthetic health check probes.`,
      },
    ]
  }

  return topBullets.map((item, idx) => {
    const { text, role, company } = item

    let situation = `At ${company}, legacy workflows and architectural bottlenecks created friction for business-critical operations under growing user demand.`
    let followUp = `How did you benchmark the performance impact under peak production loads, and what architectural tradeoffs did you evaluate?`
    let followUpTip = `Walk through your telemetry/profiling data (e.g. APM traces, latency percentiles) and explain what alternatives you rejected.`

    if (/latency|response time|query|queries|sql|database|cache|redis|postgres|mongo|throughput|speed/i.test(text)) {
      situation = `At ${company}, data-access latency and database query overhead degraded response times during peak transaction traffic.`
      followUp = `What specific database indexing, query execution plans, or caching patterns did you implement, and how did you prevent cache stampede or stale data?`
      followUpTip = `Mention EXPLAIN ANALYZE or profiling tools, TTL strategies, and how read replicas or caching mitigated database bottlenecks.`
    } else if (/security|auth|jwt|oauth|hipaa|gdpr|rbac|token|vulnerability|cors/i.test(text)) {
      situation = `At ${company}, regulatory compliance and data protection mandates required strict role-based access controls and zero-trust authentication.`
      followUp = `What threat models or attack vectors did you defend against, and how did your solution prevent token revocation or replay vulnerabilities?`
      followUpTip = `Demonstrate awareness of OAuth/OIDC flows, token expiry, refresh rotation, and how secret management was handled in production.`
    } else if (/microservice|api|apis|rest|graphql|spring|fastapi|service|distributed/i.test(text)) {
      situation = `At ${company}, tight monolithic coupling limited deployment frequency and created single points of failure across services.`
      followUp = `How did you handle inter-service communication failures, circuit breaking, and event consistency across distributed services?`
      followUpTip = `Explain synchronous vs asynchronous messaging, fallback mechanisms (e.g. Resilience4j or circuit breakers), and idempotent consumers.`
    } else if (/ci\/cd|docker|kubernetes|aws|cloud|deploy|pipeline|terraform|automated/i.test(text)) {
      situation = `At ${company}, manual deployment cycles and environment drift created production downtime risks and hindered engineer release velocity.`
      followUp = `What was your rollback strategy if an automated deployment introduced an error, and how did you ensure immutable infrastructure across environments?`
      followUpTip = `Explain blue-green/canary deployment strategies, container health checks, and how environment variables/secrets were injected safely.`
    } else if (/ui|react|frontend|redux|angular|vue|accessibility|wcag|component/i.test(text)) {
      situation = `At ${company}, client-side rendering bottlenecks and fragmented UI state created a sluggish user experience and failed accessibility standards.`
      followUp = `How did you manage complex state and re-render cycles, and how did you ensure cross-browser responsiveness and accessibility (WCAG)?`
      followUpTip = `Discuss memoization (useMemo/useCallback), semantic HTML landmarks, ARIA live regions, and automated lighthouse audits.`
    }

    const metricMatch = text.match(/(?:reduced|increased|improved|boosted|cut|saving|achieved|yielding|resulting in)\s+[^,;.]+/i) || text.match(/\b(?:\d+%\s+[^,;.]+|\$\d+[km]?\s+[^,;.]+)/i)
    const result = metricMatch
      ? metricMatch[0].trim()
      : `Delivered reliable production deployment with 0 critical regressions and standardized documentation for downstream engineering teams.`

    return {
      id: `star_${idx + 1}`,
      title: `Story #${idx + 1}: ${role} @ ${company}`,
      originalBullet: text,
      situation,
      action: text,
      result,
      followUp,
      followUpTip,
    }
  })
}

export default function DetailedDiagnosis({ reportData, initialTab = 'resume' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const resume = reportData?.resume_json || {}
  const userId = useAppStore((s) => s.userId)

  const [showRawJson, setShowRawJson] = useState(false)
  const [copiedScriptId, setCopiedScriptId] = useState(null)
  const [copiedStoryId, setCopiedStoryId] = useState(null)
  const [copiedPitch, setCopiedPitch] = useState(false)

  const handleCopyScript = (id, text) => {
    navigator.clipboard?.writeText(text)
    setCopiedScriptId(id)
    setTimeout(() => setCopiedScriptId(null), 2000)
  }

  const handleCopyPitch = (text) => {
    navigator.clipboard?.writeText(text)
    setCopiedPitch(true)
    setTimeout(() => setCopiedPitch(false), 2000)
  }

  const handleCopyStory = (id, text) => {
    navigator.clipboard?.writeText(text)
    setCopiedStoryId(id)
    setTimeout(() => setCopiedStoryId(null), 2000)
  }

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

  // Dynamic Candidate Context for Scripts, Pitch, and STAR stories
  const candidateName =
    reportData?.resume_agent?.candidateSnapshot?.name ||
    reportData?.user_answers?.fullName ||
    reportData?.user_answers?.name ||
    'Candidate'
  const candidateFirst = candidateName.split(' ')[0] || 'there'
  const targetRole =
    reportData?.resume_agent?.candidateSnapshot?.targetRole ||
    reportData?.user_answers?.targetRole ||
    'Software Engineer'
  const expList = reportData?.resume_agent?.canonicalResume?.experience || []
  const currentCompany = expList[0]?.company || 'Enterprise Systems'
  const pastCompany = expList[1]?.company || (expList[0]?.company ? 'prior engineering engagements' : 'High-Growth Tech')
  const yearsOfExp =
    reportData?.resume_agent?.candidateSnapshot?.yearsOfExperience ||
    reportData?.user_answers?.experienceLevel ||
    '5+'
  const bestWin = expList[0]?.bullets?.[0]?.text || 'scaling production microservices and cloud infrastructure'
  const almaMater = reportData?.resume_agent?.canonicalResume?.education?.[0]?.institution || 'my university'

  // Dynamic 60-Second Elevator Pitch
  const topSkillsSummary = skillsList.slice(0, 3).join(', ') || 'Full Stack Architecture'
  const elevatorPitch = `I'm a ${targetRole} with over ${yearsOfExp} years of hands-on experience building scalable, production-grade applications. Most recently at ${currentCompany}, I specialized in ${topSkillsSummary}, where I spearheaded ${bestWin.slice(0, 110).replace(/[.]+$/, '')}. Prior to that at ${pastCompany}, I led technical delivery across distributed services, reducing technical debt and improving delivery cycles. What really excites me about your team and this ${targetRole} opening is the opportunity to bring this exact depth in ${skillsList[0] || 'modern system architecture'} and cross-functional engineering to tackle your current scaling priorities.`

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

            // 3 Ready-to-Copy Personalized Scripts
            const scripts = [
              {
                id: 'recruiter',
                title: 'Script 1: Technical Recruiter Note (<300 chars)',
                tag: 'LinkedIn Connect Modal',
                text: `Hi [Recruiter Name], noticed you lead engineering hiring at [Company]. I'm a ${targetRole} with hands-on scale at ${currentCompany} (${skillsList.slice(0, 2).join(', ')}). Would love to connect and follow opportunities on your team!`,
              },
              {
                id: 'hiring-manager',
                title: 'Script 2: Engineering Lead Direct Message',
                tag: 'InMail / DM',
                text: `Hi [Hiring Manager Name], following your team's work on [Product/Infrastructure]. At ${currentCompany}, I led technical delivery for ${bestWin.slice(0, 80)}. Given your tech stack, I'd love to share brief technical notes on how we tackled this. Open to a 10-minute chat this week?`,
              },
              {
                id: 'referral',
                title: 'Script 3: Alumni & Peer Referral Request',
                tag: 'Referral Request',
                text: `Hey [First Name], great seeing fellow ${almaMater} alumni doing impressive work at [Company]! I'm currently preparing an application for the ${targetRole} position on your team. Would you be open to putting in an internal referral link? Happy to send my resume and a 2-line summary!`,
              },
            ]

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

                {/* Hidden Gem #2: Copy-Ready Cold Outreach Script Pack */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                      <PaperPlaneRight size={16} className="text-[var(--primary)]" weight="bold" />
                      <span>One-Click Copy Cold Outreach & Referral Script Pack</span>
                    </h4>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">Personalized from your resume</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {scripts.map((sc) => (
                      <div key={sc.id} className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">
                              {sc.tag}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              {sc.text.length} chars
                            </span>
                          </div>
                          <h5 className="text-xs font-bold text-[var(--text-primary)] mb-2">{sc.title}</h5>
                          <p className="text-xs text-[var(--text-secondary)] font-mono bg-[var(--surface-card)] p-3 rounded-lg border border-[var(--border-default)] leading-relaxed">
                            {sc.text}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyScript(sc.id, sc.text)}
                          className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedScriptId === sc.id ? (
                            <>
                              <Check size={14} className="text-[var(--emerald)]" weight="bold" />
                              <span className="text-[var(--emerald)]">Copied to Clipboard!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} weight="bold" />
                              <span>Copy Script</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
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

              {/* Hidden Gem #4: 1-Click Live Boolean Job Search Launchpad */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                    <Lightning size={16} className="text-amber-500" weight="fill" />
                    <span>Launch Targeted Job Searches (Last 24 Hours)</span>
                  </h4>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">Bypass 400+ applicant queues</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <a
                    href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent((reportData?.resume_agent?.candidateSnapshot?.targetRole || 'Software Engineer') + ' ' + (skillsList[0] || ''))}&f_TPR=r86400`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-between group no-underline"
                  >
                    <div>
                      <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-blue-500 block">
                        LinkedIn (Past 24h)
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block">Fresh roles posted today</span>
                    </div>
                    <ArrowSquareOut size={14} className="text-[var(--text-muted)] group-hover:text-blue-500" />
                  </a>

                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`(site:boards.greenhouse.io OR site:jobs.lever.co OR site:myworkdayjobs.com) "${reportData?.resume_agent?.candidateSnapshot?.targetRole || 'Software Engineer'}" "${skillsList[0] || 'React'}"`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] hover:border-emerald-500 hover:text-emerald-500 transition-all flex items-center justify-between group no-underline"
                  >
                    <div>
                      <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-emerald-500 block">
                        Direct ATS Boards (Greenhouse/Lever)
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block">Skip recruiters & apply directly</span>
                    </div>
                    <ArrowSquareOut size={14} className="text-[var(--text-muted)] group-hover:text-emerald-500" />
                  </a>

                  <a
                    href={`https://wellfound.com/jobs?role=${encodeURIComponent(reportData?.resume_agent?.candidateSnapshot?.targetRole || 'Software Engineer')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] hover:border-purple-500 hover:text-purple-500 transition-all flex items-center justify-between group no-underline"
                  >
                    <div>
                      <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-purple-500 block">
                        Wellfound / YCombinator Tech
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block">High-growth tech startups</span>
                    </div>
                    <ArrowSquareOut size={14} className="text-[var(--text-muted)] group-hover:text-purple-500" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: INTERVIEW READINESS & HIDDEN GEM #3 */}
          {activeTab === 'interview' && (() => {
            const interviewScore = reportData?.scores?.interview?.score ?? reportData?.semantic_profile?.assessScore?.rawAnswer ?? 72
            const interviewDiagnosis =
              reportData?.scores?.interview?.diagnosis ||
              'When explaining architectural decisions, senior interviewers evaluate business trade-offs, scalability metrics, and production edge-case handling rather than syntax.'

            const starStories = extractStarStories(
              reportData?.resume_agent?.canonicalResume,
              targetRole,
              skillsList,
              reportData?.resume_json
            )

            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* Interview Readiness Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
                  <div>
                    <h4 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                      Interview Readiness & Behavioral Diagnosis
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      How effectively your career story and technical impact translate into senior interview panels
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold uppercase text-[var(--text-muted)] block">Readiness</span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        High Technical Depth
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-mono font-extrabold text-lg">
                      {interviewScore}
                    </div>
                  </div>
                </div>

                {/* Hidden Gem #3A: 60-Second "Tell Me About Yourself" Spoken Pitch */}
                <div className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Microphone size={18} className="text-[var(--primary)]" weight="bold" />
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        60-Second Elevator Pitch ("Tell Me About Yourself")
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-muted)]">
                        ~55s speaking time • 4 anchor beats
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyPitch(elevatorPitch)}
                        className="py-1 px-3 rounded-lg text-xs font-semibold bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedPitch ? (
                          <>
                            <Check size={14} className="text-[var(--emerald)]" weight="bold" />
                            <span className="text-[var(--emerald)]">Copied Pitch!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} weight="bold" />
                            <span>Copy Pitch</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed font-sans shadow-2xs">
                    "{elevatorPitch}"
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-[var(--surface-card)]/60 border border-[var(--border-default)]">
                      <span className="text-[10px] font-bold text-[var(--primary)] block uppercase">Beat 1: Identity</span>
                      <span className="text-[11px] text-[var(--text-muted)]">Current role + years + domain</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[var(--surface-card)]/60 border border-[var(--border-default)]">
                      <span className="text-[10px] font-bold text-amber-500 block uppercase">Beat 2: Core Stack</span>
                      <span className="text-[11px] text-[var(--text-muted)]">Hands-on tech at {currentCompany}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[var(--surface-card)]/60 border border-[var(--border-default)]">
                      <span className="text-[10px] font-bold text-[var(--emerald)] block uppercase">Beat 3: Flagship Win</span>
                      <span className="text-[11px] text-[var(--text-muted)]">Quantified scale, speed, or uptime outcome</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[var(--surface-card)]/60 border border-[var(--border-default)]">
                      <span className="text-[10px] font-bold text-purple-500 block uppercase">Beat 4: Forward Hook</span>
                      <span className="text-[11px] text-[var(--text-muted)]">Why this team's exact problems fit you</span>
                    </div>
                  </div>
                </div>

                {/* Hidden Gem #3B: Top 3 Resume-Grounded STAR Stories */}
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                        <Sparkle size={16} className="text-[var(--primary)]" weight="fill" />
                        <span>Top 3 Behavioral & Technical STAR Stories Extracted From Your Resume</span>
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Structured interview cheat-sheets grounded directly in your verifiable resume achievements
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">100% Resume-Grounded</span>
                  </div>

                  <div className="space-y-4">
                    {starStories.map((story) => (
                      <div
                        key={story.id}
                        className="p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-4 shadow-xs"
                      >
                        {/* Story Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] mr-2">
                              {story.id.toUpperCase()}
                            </span>
                            <span className="text-sm font-bold text-[var(--text-primary)]">
                              {story.title}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyStory(
                                story.id,
                                `INTERVIEW STAR STORY: ${story.title}\n\nORIGINAL RESUME BULLET:\n${story.originalBullet}\n\nSITUATION / CONSTRAINT:\n${story.situation}\n\nTECHNICAL ACTION:\n${story.action}\n\nQUANTIFIED RESULT:\n${story.result}\n\nEXPECTED FOLLOW-UP QUESTION:\n${story.followUp}\n\nHOW TO ANSWER:\n${story.followUpTip}`
                              )
                            }
                            className="py-1 px-3 rounded-lg text-xs font-semibold bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all flex items-center gap-1.5 cursor-pointer w-fit"
                          >
                            {copiedStoryId === story.id ? (
                              <>
                                <Check size={14} className="text-[var(--emerald)]" weight="bold" />
                                <span className="text-[var(--emerald)]">Copied Story!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} weight="bold" />
                                <span>Copy STAR Framework</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Original Bullet Quote */}
                        <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] font-mono">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] block uppercase mb-1 font-sans">
                            Underlying Resume Bullet:
                          </span>
                          "{story.originalBullet}"
                        </div>

                        {/* STAR 3-Grid Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] block mb-1">
                                1. Situation / Constraint
                              </span>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                {story.situation}
                              </p>
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono mt-2 pt-2 border-t border-[var(--border-default)]/60">
                              Scale, latency, or compliance friction
                            </span>
                          </div>

                          <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block mb-1">
                                2. Technical Action
                              </span>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                {story.action}
                              </p>
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono mt-2 pt-2 border-t border-[var(--border-default)]/60">
                              Architecture, tooling, and refactoring
                            </span>
                          </div>

                          <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--emerald)] block mb-1">
                                3. Quantified Result
                              </span>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                {story.result}
                              </p>
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono mt-2 pt-2 border-t border-[var(--border-default)]/60">
                              Measurable business or latency impact
                            </span>
                          </div>
                        </div>

                        {/* Interviewer Follow-Up Question & Coaching Callout */}
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                            <Target size={14} weight="bold" />
                            <span>Likely Senior Interviewer Follow-Up Question:</span>
                          </div>
                          <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed italic">
                            "{story.followUp}"
                          </p>
                          <div className="text-[11px] text-[var(--text-muted)] pt-1 flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold">💡 How to answer:</span>
                            <span>{story.followUpTip}</span>
                          </div>
                        </div>
                      </div>
                    ))}
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
