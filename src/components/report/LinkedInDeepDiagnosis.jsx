import React, { useState, useMemo } from 'react'
import {
  LinkedinLogo,
  WarningCircle,
  ShieldWarning,
  ArrowRight,
  Copy,
  Check,
  Tag,
  Briefcase,
  CalendarBlank,
  Plus,
  TextT,
  PushPin,
  CheckCircle,
  Certificate,
  FolderSimple,
  Globe,
  Star,
  Users,
  MapPin,
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  Article,
  ChatCircleText,
  Sparkle,
  Camera,
  EnvelopeSimple,
  Lightning,
} from '@phosphor-icons/react'
import ResumeScoreCard from './ResumeScoreCard.jsx'
import FeedbackThumbs from './FeedbackThumbs.jsx'
import useAppStore from '../../store/useAppStore'

const severityChip = {
  high: 'bg-red-500/10 text-red-600 border border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  low: 'bg-sky-500/10 text-sky-600 border border-sky-500/20',
}

const HEADLINE_FORMULA_LABELS = {
  0: 'Proof & Milestone First',
  1: 'Curiosity & Problem Solver',
  2: 'Specialist Authority',
}

export function cleanTargetRoleTitle(prefix, baseRole) {
  if (!baseRole && !prefix) return 'Software Engineer'
  if (!baseRole) return String(prefix).trim()
  if (!prefix) {
    return String(baseRole)
      .replace(/^((?:senior|lead|principal|staff|junior|mid-level)\s+)(?:\1)+/i, '$1')
      .trim()
  }
  const clean = String(baseRole).replace(/^((?:senior|lead|principal|staff|junior|mid-level)\s+)+/i, '').trim()
  return `${String(prefix).trim()} ${clean}`.trim()
}

// Defensive helper to prevent React runtime crash from rendering raw objects
const safeText = (val) => {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') {
    return (
      val.text ||
      val.content ||
      val.fullText ||
      val.paragraph ||
      val.diagnosis ||
      val.message ||
      val.title ||
      val.name ||
      val.skill ||
      ''
    )
  }
  return String(val)
}

function isConcreteTechSkill(skill) {
  if (!skill || typeof skill !== 'string') return false
  const trimmed = skill.trim()
  if (trimmed.length === 0 || trimmed.length > 26) return false
  if (/\s+and\s+/i.test(trimmed)) return false

  const words = trimmed.split(/\s+/)
  if (words.length > 3) return false

  const KNOWN_TOOLS = new Set([
    'sql', 'python', 'r', 'power bi', 'tableau', 'snowflake', 'bigquery', 'looker', 'looker studio',
    'dbt', 'databricks', 'excel', 'postgresql', 'postgres', 'mysql', 'oracle', 'aws', 'azure', 'gcp',
    'docker', 'kubernetes', 'git', 'java', 'c++', 'c#', 'go', 'golang', 'typescript', 'javascript',
    'react', 'node.js', 'nodejs', 'kafka', 'spark', 'pyspark', 'hadoop', 'airflow', 'pandas', 'numpy',
    'scikit-learn', 'tensorflow', 'pytorch', 'redshift', 'mongodb', 'redis', 'graphql', 'rest apis',
    'fastapi', 'spring boot', 'langchain', 'langgraph', 'rag', 'chromadb', 'jira', 'confluence', 'linux',
    'salesforce', 'alteryx', 'ssis', 'ssrs', 'ssas', 'sap', 'teradata', 'spark sql', 'etl', 'elt'
  ])

  const lower = trimmed.toLowerCase()
  if (KNOWN_TOOLS.has(lower)) return true

  if (/^(sql|python|power\s+bi|tableau|snowflake|bigquery|looker|dbt|databricks|aws|azure|gcp|react|node|docker|kubernetes|kafka|spark|airflow|excel)/i.test(trimmed)) {
    return true
  }

  if (/analysis|investigation|reporting|management|strategy|methodology|definition|modelling|modeling|gathering/i.test(lower)) {
    return false
  }

  return words.length <= 2
}

function formatSkillName(skill) {
  if (!skill || typeof skill !== 'string') return ''
  const trimmed = skill.trim()
  const CANONICAL_CASING = {
    langgraph: 'LangGraph',
    langchain: 'LangChain',
    fastapi: 'FastAPI',
    chromadb: 'ChromaDB',
    'spring ai': 'Spring AI',
    'spring boot': 'Spring Boot',
    'next.js': 'Next.js',
    'power bi': 'Power BI',
    bigquery: 'BigQuery',
    'looker studio': 'Looker Studio',
    postgresql: 'PostgreSQL',
    mongodb: 'MongoDB',
    graphql: 'GraphQL',
    'rest apis': 'REST APIs',
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    sql: 'SQL',
    kpi: 'KPI',
    kpis: 'KPIs',
    bi: 'BI',
    aws: 'AWS',
    gcp: 'GCP',
    etl: 'ETL',
    elt: 'ELT',
    ai: 'AI',
    ml: 'ML',
    api: 'API',
    apis: 'APIs',
    rag: 'RAG',
    llm: 'LLM',
    llms: 'LLMs',
    db: 'DB',
    r: 'R',
    ui: 'UI',
    ux: 'UX',
    dbt: 'dbt',
  }

  const exactCanon = CANONICAL_CASING[trimmed.toLowerCase()]
  if (exactCanon) return exactCanon

  if (/[a-z][A-Z]/.test(trimmed)) {
    return trimmed
  }

  const ACRONYMS = {
    sql: 'SQL',
    kpi: 'KPI',
    kpis: 'KPIs',
    bi: 'BI',
    aws: 'AWS',
    gcp: 'GCP',
    etl: 'ETL',
    elt: 'ELT',
    ai: 'AI',
    ml: 'ML',
    api: 'API',
    apis: 'APIs',
    rag: 'RAG',
    llm: 'LLM',
    llms: 'LLMs',
    db: 'DB',
    r: 'R',
    ui: 'UI',
    ux: 'UX',
    dbt: 'dbt',
  }

  return trimmed
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase()
      if (ACRONYMS[lower]) return ACRONYMS[lower]
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function isValidSkill(skill) {
  if (!skill || typeof skill !== 'string') return false
  const trimmed = skill.trim()
  if (trimmed.length === 0 || trimmed.length > 35) return false
  const words = trimmed.split(/\s+/)
  if (words.length >= 4 && /\s+and\s+/i.test(trimmed)) return false
  return true
}

function LiveScrapedProfileSnapshot({ profileData, activitySignals, rawPosts = [] }) {
  const [isBioExpanded, setIsBioExpanded] = useState(false)
  if (!profileData || typeof profileData !== 'object') return null

  const fullName =
    profileData.fullName ||
    profileData.name ||
    [profileData.firstName, profileData.lastName].filter(Boolean).join(' ') ||
    'LinkedIn Member'
  const headline = (profileData.headline || '').trim()
  const pictureUrl = profileData.pictureUrl || profileData.avatar || profileData.photoUrl || profileData.profilePicture || ''
  const url = profileData.url || profileData.linkedinUrl || ''
  const connections = profileData.connectionsCount || profileData.connections || '500+'
  const location = typeof profileData.location === 'string'
    ? profileData.location
    : (profileData.location?.name || profileData.location?.text || 'Not Specified')
  const experiencesCount = (profileData.experiences || profileData.positions || []).length
  const postsCount = rawPosts.length || activitySignals?.postsAnalyzedCount || activitySignals?.postCount || (profileData.publicPosts?.length ?? profileData.posts?.length ?? 0)
  const about = (profileData.about || profileData.summary || '').trim()

  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'LI'

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 sm:p-6 space-y-4 shadow-xs">
      {/* Top row: Avatar + Name + Live Badge + Verified URL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full border-2 border-[#0a66c2]/30 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            {pictureUrl ? (
              <img
                src={pictureUrl}
                alt={fullName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.innerText = initials
                  }
                }}
              />
            ) : (
              <span className="font-bold text-[#0a66c2] text-lg">{initials}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{fullName}</h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ✓ Verified Profile Signal
              </span>
            </div>
            {url && (
              <a
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0a66c2] hover:underline inline-flex items-center gap-1 mt-0.5 break-all"
              >
                {url}
                <ArrowSquareOut size={13} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Sunken Headline Container */}
      {headline && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-[var(--border-default)] p-3.5 space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">
            Current Live Headline
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] italic leading-relaxed">
            "{headline}"
          </p>
        </div>
      )}

      {/* 4-Column Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted,#f8fafc)] dark:bg-slate-900/40 p-3">
          <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5 font-medium">
            <Users size={14} className="text-[#0a66c2]" />
            Connections
          </div>
          <div className="text-sm font-bold text-[var(--text-primary)] mt-1">
            {connections}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted,#f8fafc)] dark:bg-slate-900/40 p-3">
          <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5 font-medium">
            <MapPin size={14} className="text-[#0a66c2]" />
            Location
          </div>
          <div className="text-sm font-bold text-[var(--text-primary)] mt-1 truncate" title={location}>
            {location}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted,#f8fafc)] dark:bg-slate-900/40 p-3">
          <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5 font-medium">
            <Briefcase size={14} className="text-[#0a66c2]" />
            Roles Scraped
          </div>
          <div className="text-sm font-bold text-[var(--text-primary)] mt-1">
            {experiencesCount} Experience{experiencesCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted,#f8fafc)] dark:bg-slate-900/40 p-3">
          <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5 font-medium">
            <Article size={14} className="text-[#0a66c2]" />
            Public Posts Analyzed
          </div>
          <div className="text-sm font-bold text-[var(--text-primary)] mt-1">
            {postsCount} Public Post{postsCount === 1 ? '' : 's'} Analyzed
          </div>
        </div>
      </div>

      {/* Collapsible About Bio */}
      {about && about !== 'Not Specified' && (
        <div className="rounded-xl border border-[var(--border-default)] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Current Live About Section
            </span>
            <button
              type="button"
              onClick={() => setIsBioExpanded(!isBioExpanded)}
              className="text-xs text-[#0a66c2] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
            >
              {isBioExpanded ? 'Hide Scraped Bio' : 'View Scraped Bio'}
              {isBioExpanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
            </button>
          </div>
          {isBioExpanded && (
            <p className="text-xs text-[var(--text-secondary)] whitespace-pre-line leading-relaxed pt-2 border-t border-[var(--border-default)]">
              {about}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function LinkedInDeepDiagnosis({ linkedinAgent, reportData: propReportData }) {
  const theme = useAppStore((s) => s.theme)
  const resumeAnalysis = useAppStore((s) => s.resumeAnalysis)
  const storeReportData = useAppStore((s) => s.reportData)
  const reportData = propReportData || storeReportData
  const variant = theme === 'dark' ? 'dark' : 'light'
  const [copiedId, setCopiedId] = useState(null)

  const activitySignals = linkedinAgent?.activitySignals || reportData?.linkedin_agent?.activitySignals || reportData?.linkedin_activity_signals || null
  const rawPosts = reportData?.linkedin_activity_data?.posts || linkedinAgent?.activitySignals?.posts || activitySignals?.posts || []
  const actualPostsCount = rawPosts.length || linkedinAgent?.activitySignals?.postsAnalyzedCount || activitySignals?.postCount || 0

  const profileData = useMemo(() => {
    let p = reportData?.linkedin_json || reportData?.user_answers?.linkedinData || linkedinAgent?.scrapedProfile || null
    if (typeof p === 'string') {
      try {
        p = JSON.parse(p)
      } catch {
        p = null
      }
    }
    return p
  }, [reportData, linkedinAgent])

  const hasUserLinkedinUrl = Boolean(
    reportData?.user_answers?.linkedin ||
    reportData?.user_answers?.linkedinUrl ||
    reportData?.user_answers?.['linkedin-url'] ||
    reportData?.linkedin_json?.url ||
    linkedinAgent?.url
  )
  const isBlankProfile = !hasUserLinkedinUrl && !linkedinAgent?.dataAvailable && !linkedinAgent?.inferredFromResume

  // Extract actual candidate skills from canonical resume or resume_agent first
  const candidateSkillsPool = (
    reportData?.resume_agent?.canonicalResume?.skills ||
    reportData?.resume_agent?.candidateSnapshot?.coreSkills ||
    resumeAnalysis?.data?.canonicalResume?.skills ||
    resumeAnalysis?.data?.analysis?.candidateSnapshot?.coreSkills ||
    reportData?.resume_json?.skills ||
    reportData?.resume_json?.top_skills ||
    reportData?.skills ||
    []
  ).map((s) => (typeof s === 'string' ? s.trim() : (s?.name || ''))).filter(Boolean)

  const poolStr = candidateSkillsPool.join(' ').toLowerCase()
  const hasStrongDataSkills = /\b(?:sql|statistical analysis|hypothesis|a\/b testing|ab testing|tableau|power bi|pandas|bigquery|snowflake|dbt|bi|kpi|analytics|data modeling)\b/i.test(poolStr)
  const hasBackendFrameworks = /\b(?:react|angular|vue|django|flask|spring boot|express|kubernetes|docker|microservices)\b/i.test(poolStr)

  const GENERIC_ROLE_TITLES = new Set([
    'software professional',
    'technical professional',
    'professional',
    'candidate',
    'senior professional',
    'engineering professional',
  ])

  const isConcreteRole = (r) => {
    if (!r) return false
    const s = (typeof r === 'string' ? r : (r?.title || r?.name || r?.targetRole || r?.rawAnswer || r?.value || '')).trim()
    return s.length >= 3 && !GENERIC_ROLE_TITLES.has(s.toLowerCase())
  }

  const roleCandidates = [
    reportData?.resume_agent?.candidateSnapshot?.targetRole,
    resumeAnalysis?.data?.analysis?.candidateSnapshot?.targetRole,
    resumeAnalysis?.data?.canonicalResume?.candidate?.targetRole,
    reportData?.user_answers?.targetRole,
    linkedinAgent?.targetRole,
    reportData?.assessment_agent?.candidateProfile?.targetRole,
    reportData?.target_role,
    reportData?.resume_json?.target_role,
  ]

  let resolvedTarget = roleCandidates.find(isConcreteRole) || reportData?.target_role || 'Software Engineer'
  if (typeof resolvedTarget === 'object') {
    resolvedTarget = resolvedTarget?.rawAnswer || resolvedTarget?.value || resolvedTarget?.title || 'Software Engineer'
  }
  let targetRole = String(resolvedTarget || 'Software Engineer').trim()

  let isSoftwareRole = /software|developer|engineer|backend|frontend|fullstack|sde|web|cloud|devops/i.test(targetRole)
  let isDataRole = /data|analytics|bi|machine learning|ml|ai|scientist/i.test(targetRole)

  // Domain Override: If candidate has strong data skills and lacks backend web frameworks,
  // ensure isDataRole is true, isSoftwareRole is false, and generic/mismatched roles become 'Data Analyst'
  if (hasStrongDataSkills && !hasBackendFrameworks) {
    isDataRole = true
    isSoftwareRole = false
    if (!/data|analytics|bi|analyst/i.test(targetRole)) {
      targetRole = 'Data Analyst'
    }
  }

  const candidateSnap = reportData?.resume_agent?.candidateSnapshot || {}
  // Check candidateSnap.experienceLevel FIRST when resolving yoe (e.g. "3+ years" extracts 3, not 1 from "Junior–Mid / 1–3 Yrs Experience")
  const rawYoe = candidateSnap.experienceLevel ||
                 candidateSnap.experienceYears ||
                 candidateSnap.yearsExperience ||
                 reportData?.resume_json?.years_of_experience ||
                 reportData?.user_answers?.experience ||
                 ''

  let yoeNum = '3'
  const yoeStr = String(rawYoe).trim()
  const rangeMatch = yoeStr.match(/(\d+)\s*[–—-]\s*(\d+)/)
  if (rangeMatch) {
    yoeNum = rangeMatch[2] // Take upper number of the range (e.g. "1–3" -> 3)
  } else {
    const singleMatch = yoeStr.match(/(\d+)/)
    if (singleMatch) {
      yoeNum = singleMatch[1]
    }
  }
  const yoe = String(yoeNum).replace(/\++$/, '') || '3'

  const cleanCandidateSkills = candidateSkillsPool.slice(0, 8).map(formatSkillName).filter(Boolean)

  // Role-aware fallbacks if candidate skills are empty
  const defaultSkills = isSoftwareRole
    ? ['Python', 'JavaScript', 'React', 'Node.js', 'AWS', 'Docker']
    : isDataRole
      ? ['SQL', 'Python', 'Power BI', 'Tableau', 'Excel']
      : ['Strategy', 'Project Management', 'Stakeholder Management', 'Process Optimization']

  const effectiveSkills = cleanCandidateSkills.length >= 3 ? cleanCandidateSkills : defaultSkills
  const coreSkillList = effectiveSkills.slice(0, 3)
  const skillsStr = coreSkillList.join(', ')

  const fallbackHeadline = isSoftwareRole
    ? `${targetRole} | ${skillsStr} | Scalable Systems & Cloud Architecture`
    : isDataRole
      ? `${targetRole} | ${skillsStr} | Enterprise Analytics & Data Strategy`
      : `${targetRole} | ${skillsStr} | Driving Operational Excellence`

  // 4-Part Video Copywriting Framework for LinkedIn About (900–1,500 chars / 160–250 words)
  const richFallbackHook = isSoftwareRole
    ? `Over the past ${yoe}+ years, I have architected high-concurrency microservices, cloud backends, and distributed data pipelines sustaining 99.99% uptime. As a ${targetRole}, I translate complex engineering challenges into low-latency, scalable production solutions.`
    : isDataRole
    ? `Over the past ${yoe}+ years, I have transformed enterprise datasets into automated reporting pipelines, modern cloud data architectures, and executive decision intelligence. As a ${targetRole}, I specialize in building star schemas and optimizing analytical queries across Snowflake and BigQuery to eliminate reporting bottlenecks.`
    : `Over the past ${yoe}+ years, I have orchestrated high-stakes cross-functional programs, modernizing operational workflows and driving measurable efficiency. As a ${targetRole}, I bridge technical execution with business strategy to accelerate organizational velocity.`

  const richFallbackAudience = isSoftwareRole
    ? `I partner with engineering teams and product leaders that need to modernize legacy architectures, enforce strict API contract safety, and sustain low-latency system performance under heavy user loads.`
    : isDataRole
    ? `I partner with enterprise leadership, product managers, and analytics teams seeking to eliminate data silos, automate ETL ingestion, and deliver trusted self-service dashboards for executive decision-making.`
    : `I partner with organizational leadership and operational units looking to streamline cross-departmental execution, eliminate process waste, and establish clear KPI accountability.`

  const richFallbackApproach = isSoftwareRole
    ? `My methodology combines clean system design with automated test coverage and containerized CI/CD delivery. I work primarily with ${skillsStr || 'React, TypeScript, Node.js, and AWS'}, focusing on high-reliability cloud services that scale predictably without regressions.`
    : isDataRole
    ? `My methodology pairs dimensional data modeling with automated query optimization and rigorous validation. I work primarily with ${skillsStr || 'SQL, Power BI, Python, and Tableau'}, enabling stakeholders to uncover growth levers with zero reporting delay.`
    : `My leadership methodology centers on transparency, agile frameworks, and data-informed decision making. I leverage ${skillsStr || 'agile methodologies and executive alignment'} to foster high-agency teams and repeatable project delivery.`

  const richFallbackProof = richFallbackApproach
  const richFallbackCta = `If you are scaling high-impact initiatives or looking for proven ${targetRole} expertise, let's connect!`
  const richFallbackAbout = `${richFallbackHook}\n\n${richFallbackAudience}\n\n${richFallbackApproach}\n\n${richFallbackCta}`
  const fallbackAbout = richFallbackAbout

  const headline = linkedinAgent?.optimizations?.headlines?.[0]?.headline || fallbackHeadline
  const aboutText = linkedinAgent?.optimizations?.aboutRewrite?.fullText ||
                    linkedinAgent?.optimizations?.aboutRewrite ||
                    fallbackAbout
  const pinnedSkills = linkedinAgent?.optimizations?.top3PinnedSkills?.length
    ? linkedinAgent.optimizations.top3PinnedSkills
    : coreSkillList

  const recruiterSeo = useMemo(() => {
    if (linkedinAgent?.recruiterSeo) return linkedinAgent.recruiterSeo
    if (reportData?.linkedin_agent?.recruiterSeo) return reportData.linkedin_agent.recruiterSeo
    if (reportData?.recruiterSeo) return reportData.recruiterSeo

    // Client-side deterministic evaluation fallback
    const liveHeadline = (profileData?.headline || headline || '').trim()
    const liveAbout = (profileData?.about || profileData?.summary || '').trim()
    const headlineLower = liveHeadline.toLowerCase()

    let score = 100
    const penalties = []

    if (/\b(aspiring|seeking|looking for|open to work|fresher|entry[\s-]level|actively looking)\b/i.test(headlineLower)) {
      score -= 21
      penalties.push({
        rule: 'WEAK_INTENT_KEYWORD',
        impact: '-21 pts',
        critique: 'Recruiter search algorithms prioritize active practitioners, not "aspiring" titles.',
      })
    }

    if (targetRole && !headlineLower.includes(targetRole.toLowerCase())) {
      score -= 22
      penalties.push({
        rule: 'MISSING_EXACT_ROLE_TITLE',
        impact: '-22 pts',
        critique: `Your headline does not contain exact keyword "${targetRole}", burying you in recruiter boolean queries.`,
      })
    }

    if (!liveHeadline.includes('|') && !liveHeadline.includes('•') && !liveHeadline.includes('–')) {
      score -= 15
      penalties.push({
        rule: 'UNSTRUCTURED_HEADLINE',
        impact: '-15 pts',
        critique: 'Headline lacks structured separator syntax (Role | Core Stack | Impact Metric).',
      })
    }

    if (!liveAbout || liveAbout.length < 100) {
      score -= 15
      penalties.push({
        rule: 'INSUFFICIENT_ABOUT_LENGTH',
        impact: '-15 pts',
        critique: 'About section is too brief (<150 characters) to pass recruiter semantic search filters.',
      })
    }

    const finalScore = Math.max(25, Math.min(score, 100))
    return {
      seoScore: finalScore,
      status: finalScore >= 80 ? 'RECRUITER_MAGNET' : finalScore >= 60 ? 'AVERAGE_VISIBILITY' : 'SEARCH_INVISIBLE',
      penalties,
    }
  }, [linkedinAgent, reportData, profileData, headline, targetRole])

  const isVisualItem = (item) => {
    if (!item) return false
    const str = [item.id, item.type, item.section, item.title, item.name, item.diagnosis].filter(Boolean).join(' ').toLowerCase()
    return /visual_photo|visual_banner|profile photo|cover banner|headshot|avatar zone/i.test(str)
  }

  const missingSections = (linkedinAgent?.missingSections || []).filter(Boolean).filter((s) => !isVisualItem(s))
  
  // Track keys from missingSections to avoid duplicating in discrepancies
  const missingSectionKeys = new Set(
    missingSections.flatMap((s) => [s.title?.toLowerCase().trim(), s.id?.toLowerCase().trim()]).filter(Boolean)
  )

  const discrepancies = (linkedinAgent?.discrepancies || [])
    .filter(Boolean)
    .filter((d) => !isVisualItem(d))
    .filter((d) => {
      if (d.type === 'company_typo_unlinked_logo' || /company name typo/i.test(d.title || '')) {
        const rComp = String(d.resumeClaim || d.company || '')
          .replace(/\(.*?\)/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase()
        const lComp = String(d.linkedinClaim || '')
          .replace(/\(.*?\)/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase()
        if (!rComp || !lComp || rComp === lComp || lComp.includes(rComp) || rComp.includes(lComp)) return false
      }
      const titleKey = d.title?.toLowerCase().trim()
      const idKey = d.id?.toLowerCase().trim()
      if (titleKey && missingSectionKeys.has(titleKey)) return false
      if (idKey && missingSectionKeys.has(idKey)) return false
      return true
    })

  const droppedImpact = (linkedinAgent?.droppedImpact || []).filter(Boolean)
  const missingSkills = (linkedinAgent?.missingSkills || []).filter(Boolean)
  const rawOptimizations = linkedinAgent?.optimizations || linkedinAgent?.aiOptimizations || null

  const fallbackHeadlinesList = [
    {
      headline: headline,
      formula: 'Search-Optimized',
      whyItWorks: 'Positions primary role title first followed by high-frequency recruiter search keywords.',
    },
    {
      headline: isSoftwareRole
        ? `${targetRole} @ Scale | Delivering High-Availability Distributed Systems & Modern Cloud Infrastructure`
        : isDataRole
        ? `${targetRole} @ Scale | Delivering 40%+ Reporting Turnaround Efficiency & Modern BI Systems`
        : `${targetRole} @ Scale | Driving Operational Velocity & Strategic Execution`,
      formula: 'Impact-Driven',
      whyItWorks: 'Anchors on measurable operational velocity and architecture outcomes to differentiate from generic applicant pool.',
    },
    {
      headline: isSoftwareRole
        ? `Specialist in Cloud Architecture, Microservices & High-Throughput APIs`
        : isDataRole
        ? `Specialist in Enterprise Analytics, Scalable Data Pipelines & Executive Dashboards`
        : `Specialist in Strategic Operations, Cross-Functional Execution & Agile Delivery`,
      formula: 'Specialist',
      whyItWorks: 'Appeals to specialized hiring managers seeking deep domain expertise and reporting architecture.',
    },
  ]

  const fallbackRecommendedSkills = cleanCandidateSkills.length > 0
    ? cleanCandidateSkills
    : missingSkills.length > 0
    ? missingSkills.map((m) => (typeof m === 'string' ? m : m.skill || m.name)).filter(Boolean)
    : coreSkillList.length > 0
    ? coreSkillList
    : defaultSkills

  const optimizations = rawOptimizations || {
    headlines: fallbackHeadlinesList,
    aboutRewrite: {
      hook: richFallbackHook,
      audienceAndProblem: richFallbackAudience,
      approachAndSkills: richFallbackApproach,
      callToAction: richFallbackCta,
      fullText: richFallbackAbout,
    },
    top3PinnedSkills: pinnedSkills,
    recommendedSkillsToAdd: fallbackRecommendedSkills,
  }

  const experienceUpgrades = (optimizations?.experienceUpgrades || []).filter(Boolean)
  const [showAllLinkedInRoles, setShowAllLinkedInRoles] = useState(false)
  const sectionsToAdd = optimizations?.sectionsToAddFromResume || null
  const visibilityTricks = (optimizations?.visibilityTricks || []).filter(Boolean)
  const featuredWork = (optimizations?.featuredSectionRecommendations || []).filter(Boolean)

  const top3PinnedSkills = (
    optimizations?.top3PinnedSkills?.length
      ? optimizations.top3PinnedSkills
      : pinnedSkills
  )
    .filter(Boolean)
    .filter(isValidSkill)
    .map(formatSkillName)
    .sort((a, b) => (isConcreteTechSkill(b) ? 1 : 0) - (isConcreteTechSkill(a) ? 1 : 0))

  const finalTop3PinnedSkills = top3PinnedSkills.length >= 3 ? top3PinnedSkills : pinnedSkills

  const pinnedLowerSet = new Set((finalTop3PinnedSkills || []).map((s) => s.toLowerCase().trim()))
  const rawRec = optimizations?.recommendedSkillsToAdd?.length
    ? optimizations.recommendedSkillsToAdd
    : (cleanCandidateSkills.length > 0 ? cleanCandidateSkills : missingSkills)

  const deduplicatedRecommended = (rawRec || [])
    .filter(Boolean)
    .filter(isValidSkill)
    .map(formatSkillName)
    .filter((s) => !pinnedLowerSet.has(s.toLowerCase().trim()))

  // If deduplication leaves fewer than 3 skills, backfill strictly from coreSkillList and missingSkills:
  const roleBackfill = [
    ...coreSkillList,
    ...(missingSkills || []).map((m) => (typeof m === 'string' ? m : m.skill || m.name)).filter(Boolean),
  ]

  for (const skill of roleBackfill) {
    if (deduplicatedRecommended.length >= 5) break
    const formatted = formatSkillName(skill)
    if (formatted && isValidSkill(formatted) && !pinnedLowerSet.has(formatted.toLowerCase()) && !deduplicatedRecommended.some((s) => s.toLowerCase() === formatted.toLowerCase())) {
      deduplicatedRecommended.push(formatted)
    }
  }

  const recommendedSkills = deduplicatedRecommended.sort((a, b) => (isConcreteTechSkill(b) ? 1 : 0) - (isConcreteTechSkill(a) ? 1 : 0))

  const sectionAudit = linkedinAgent?.sectionAudit || linkedinAgent?.dashboard?.sectionAudit || reportData?.linkedin_agent?.sectionAudit || null
  const visualPrompts = optimizations?.visualPrompts || linkedinAgent?.visualPrompts || null
  const networkingRecommendation =
    optimizations?.networkingRecommendation ||
    linkedinAgent?.networkingRecommendation ||
    linkedinAgent?.activitySignals?.networkingRecommendation ||
    null
  const categorizedSkills =
    optimizations?.categorizedSkills ||
    linkedinAgent?.categorizedSkills ||
    linkedinAgent?.optimizations?.categorizedSkills ||
    null

  const effectiveSectionAudit = useMemo(() => {
    if (sectionAudit && typeof sectionAudit === 'object' && sectionAudit.headline) {
      return sectionAudit
    }
    const hlLen = (linkedinAgent?.signals?.headline?.text || '').length
    const abLen = (linkedinAgent?.signals?.about?.text || '').length
    const skCount = linkedinAgent?.signals?.completeness?.skillsCount || 0
    const ftCount = linkedinAgent?.signals?.featured?.count || 0
    const connCount = linkedinAgent?.signals?.visibility?.connectionsCount || 0

    return {
      headline: {
        score10: hlLen > 20 && hlLen <= 120 ? 8 : (hlLen > 120 ? 6 : 2),
        status: hlLen > 20 && hlLen <= 120 ? 'pass' : (hlLen > 120 ? 'warn' : 'fail'),
        label: 'Headline',
        hurtingReason: hlLen > 120 ? 'Headline exceeds 120 chars causing mobile truncation.' : (hlLen <= 20 ? 'Headline is too short or missing target role.' : null),
      },
      about: {
        score10: abLen >= 600 ? 9 : (abLen >= 150 ? 6 : 2),
        status: abLen >= 600 ? 'pass' : (abLen >= 150 ? 'warn' : 'fail'),
        label: 'About Section',
        hurtingReason: abLen < 150 ? 'About section is too brief (< 150 chars).' : (abLen < 600 ? 'About section lacks quantified depth and clear CTA.' : null),
      },
      featured: {
        score10: ftCount >= 2 ? 10 : (ftCount === 1 ? 6 : 0),
        status: ftCount >= 2 ? 'pass' : (ftCount === 1 ? 'warn' : 'fail'),
        label: 'Featured Section',
        hurtingReason: ftCount === 0 ? 'Featured section is empty without visual case studies.' : null,
      },
      skills: {
        score10: skCount >= 50 ? 10 : (skCount >= 15 ? 7 : 3),
        status: skCount >= 50 ? 'pass' : (skCount >= 15 ? 'warn' : 'fail'),
        label: 'Skills Bank',
        hurtingReason: skCount < 15 ? `Only ${skCount} skills listed (severely throttles recruiter filter matching).` : (skCount < 50 ? `Underutilized 50-skill cap (${skCount}/50 skills).` : null),
      },
      activityAndNetworking: {
        score10: connCount >= 500 ? 9 : (connCount >= 200 ? 6 : 3),
        status: connCount >= 500 ? 'pass' : (connCount >= 200 ? 'warn' : 'fail'),
        label: 'Activity & Networking',
        hurtingReason: connCount < 500 ? 'Under 500 connections limits your 2nd and 3rd-degree recruiter reach.' : null,
      },
    }
  }, [sectionAudit, linkedinAgent])

  const effectiveVisualPrompts = useMemo(() => {
    if (visualPrompts && visualPrompts.profilePicturePrompt && visualPrompts.coverBannerPrompt) {
      return visualPrompts
    }
    const role = targetRole || 'Target Role'
    const skillsList = coreSkillList.slice(0, 4).join(', ') || 'Domain Specialization'
    return {
      profilePicturePrompt: `Professional studio headshot of a candidate targeting ${role}. Maintain candidate's authentic facial features, natural hairstyle, and confident approachable expression. Upgrade styling to a modern tailored blazer / smart professional business attire in neutral tones (navy, charcoal, or dark graphite). Soft studio butterfly lighting with gentle fill, crisp focus on the eyes, head-and-shoulders composition. Clean, minimalist defocused architectural or neutral matte gradient background with zero clutter. 8k resolution, cinematic commercial photography style.`,
      coverBannerPrompt: `Design a high-converting, professional LinkedIn Cover Banner (1584x396 px) for a ${role} with 6 core visual elements:
1. Main Authority Headline: "${role} | ${skillsList}"
2. Proof / Primary Metric Hook: "Proven delivery and measurable outcomes in enterprise systems"
3. 3-4 Core Value Pillars: ${coreSkillList.slice(0, 4).map((s) => `• ${s}`).join(' ')}
4. Target Audience / Specialty: Solving complex domain challenges for engineering and enterprise teams
5. Soft CTA: "Let's Connect & Collaborate"
6. Layout & Color Direction: Clean executive layout, high-contrast dark slate / deep navy base with subtle Electric Indigo accents. Keep the lower-left 30% area completely clear to prevent overlap with the mobile/desktop circular profile photo.`,
      bannerShowcaseOptions: [
        {
          style: 'Minimalist Dark Slate',
          colorPalette: 'Deep Charcoal (#111827), Electric Indigo (#6366F1), Crisp White typography',
          layout: 'Headline on the top-right, 3 value pill badges horizontally centered, clean negative space on the left for avatar.',
        },
        {
          style: 'Executive Clean Studio',
          colorPalette: 'Soft Matte Gray (#F8FAFC), Navy (#0F172A), Slate Blue accent',
          layout: 'Structured split layout: Bold role title and metric callout on the right, subtle architectural grid background.',
        },
        {
          style: 'Modern Technical Dossier',
          colorPalette: 'Deep Onyx (#090D16), Cyber Teal / Indigo gradient hairline border, mono-spaced pill badges',
          layout: 'Terminal-inspired crisp typography highlighting core skills and scale outcomes, optimized for maximum recruiter glance value.',
        },
      ],
    }
  }, [visualPrompts, targetRole, coreSkillList])

  const showOutFox = Boolean(
    networkingRecommendation?.isRecommended ||
    effectiveSectionAudit?.activityAndNetworking?.score10 <= 6 ||
    linkedinAgent?.activitySignals?.isGhostProfile
  )

  const handleCopy = (text, id) => {
    if (!text) return
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    }
    setCopiedId(id)
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr))
    }, 2000)
  }

  // ── Combine & Cap Cross-Platform Discrepancies to Top 4 ────────────────
  const allDiscrepancyCandidates = [
    ...missingSections.map((sec) => ({
      id: sec.id || `ms_${sec.title}`,
      title: sec.title,
      type: sec.type || 'missing_section',
      badge: 'Missing Section',
      severity: 'high',
      resumeClaim: sec.resumeClaim || 'Present on verified resume',
      linkedinClaim: sec.linkedinClaim || 'Not Listed on LinkedIn',
      diagnosis: sec.diagnosis,
      recommendation: sec.recommendation,
    })),
    ...discrepancies.map((disc) => ({
      id: disc.id || `disc_${disc.title}`,
      title: disc.title,
      type: disc.type || 'discrepancy',
      badge: disc.type === 'timeline_drift' ? 'Timeline Drift' : disc.type === 'title_drift' ? 'Title Drift' : 'Discrepancy',
      severity: disc.severity || 'medium',
      resumeClaim: disc.resumeClaim || 'Resume Record',
      linkedinClaim: disc.linkedinClaim || 'LinkedIn Record',
      diagnosis: disc.diagnosis,
      recommendation: disc.recommendation,
    })),
    ...droppedImpact.map((drop, idx) => ({
      id: drop.id || `drop_${idx}`,
      title: `Omitted Achievement: ${drop.company || 'Experience'}`,
      type: 'dropped_impact',
      badge: 'Omitted Achievement',
      severity: 'medium',
      resumeClaim: drop.sampleResumeProof,
      linkedinClaim: 'Omitted from profile',
      diagnosis: drop.diagnosis,
      recommendation: drop.recommendation,
    })),
  ]

  const seenDiscTitles = new Set()
  const topDiscrepancies = []
  for (const item of allDiscrepancyCandidates) {
    const key = (item.title || item.id || '').toLowerCase().trim()
    if (!key || seenDiscTitles.has(key)) continue

    // Filter out false positive discrepancies where resume and linkedin claims are virtually identical (e.g. "Tempus" vs "Tempus", "Tempus Labs" vs "Tempus")
    const normResume = String(item.resumeClaim || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const normLi = String(item.linkedinClaim || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (normResume && normLi && normResume.length > 2 && normLi.length > 2) {
      if (normResume === normLi) continue
      if ((item.type?.includes('company') || item.title?.toLowerCase().includes('company')) &&
          (normResume.includes(normLi) || normLi.includes(normResume))) {
        continue
      }
    }

    seenDiscTitles.add(key)
    topDiscrepancies.push(item)
    if (topDiscrepancies.length === 4) break
  }

  // ── Consolidated Featured & Projects Showcase (Single Source of Truth) ─
  const projectShowcaseMap = new Map()

  const parseProjectItem = (proj, defaultAction) => {
    const rawTitle = safeText(proj.title || proj.name || 'Core Project')
    const titleParts = rawTitle.split('|')
    const cleanTitle = titleParts[0].trim()
    const techFromTitle = titleParts.length > 1
      ? titleParts[1].split(/[,/]+/).map((t) => t.trim()).filter(Boolean)
      : []

    const existingTech = Array.isArray(proj.technologies)
      ? proj.technologies
      : Array.isArray(proj.skills)
      ? proj.skills
      : []
    const mergedTech = Array.from(new Set([...existingTech, ...techFromTitle]))

    let description = safeText(proj.description || proj.rewrittenPitch || proj.summary || proj.details || '')
    if ((!description || description.includes('Showcases end-to-end technical implementation')) && proj.reason && !proj.reason.includes('Showcases end-to-end technical implementation')) {
      description = safeText(proj.reason)
    }
    if ((!description || description.includes('Showcases end-to-end technical implementation')) && Array.isArray(proj.bullets) && proj.bullets.length > 0) {
      description = proj.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean).join(' ')
    }
    if (!description || description.includes('Showcases end-to-end technical implementation')) {
      const canonicalProjs =
        reportData?.resume_agent?.canonicalResume?.projects ||
        resumeAnalysis?.data?.canonicalResume?.projects ||
        reportData?.resume_agent?.projects ||
        []
      const match = canonicalProjs.find((cp) => (cp.title || cp.name || '').toLowerCase().includes(cleanTitle.toLowerCase().slice(0, 6)))
      if (match?.bullets?.length) {
        description = match.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean).join(' ')
      } else if (match?.description) {
        description = match.description
      } else {
        const bulletAudit = reportData?.resume_agent?.dashboard?.bulletAudit || reportData?.resume_agent?.bulletAudit || []
        const projBullets = bulletAudit.filter((b) => b.section === 'Projects' && (b.company || b.project || b.title || '').toLowerCase().includes(cleanTitle.toLowerCase().slice(0, 6)))
        if (projBullets.length > 0) {
          description = projBullets.map((b) => b.rewrite || b.text).filter(Boolean).join(' ')
        }
      }
    }
    // Clean any broken legacy templates
    description = description
      .replace(/platform leveraging .*? to solve core distributed workflow bottlenecks/gi, 'engineered with high-reliability distributed architecture.')
      .trim()

    // 3. Synthesize a clean 1-sentence description if still empty
    if (!description) {
      const techStr = mergedTech.length > 0 ? ` leveraging ${mergedTech.slice(0, 4).join(', ')}` : ''
      description = `Engineered ${cleanTitle}${techStr} to drive high-impact operational efficiency and verifiable workflow outcomes.`
    }

    return {
      title: cleanTitle,
      description,
      technologies: mergedTech,
      actionNote: proj.replaceNote || proj.actionAdvice || proj.callToAction || defaultAction,
    }
  }

  // 1. Fuzzy Project Deduplication
  const getProjectFuzzyKey = (title = '') => {
    return String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/data/g, '')
      .slice(0, 24)
  }

  if (Array.isArray(sectionsToAdd?.projects)) {
    sectionsToAdd.projects.forEach((proj) => {
      const parsed = parseProjectItem(proj, 'Pin to Featured section & add under LinkedIn Projects')
      const fKey = getProjectFuzzyKey(parsed.title)
      if (!fKey) return
      projectShowcaseMap.set(fKey, parsed)
    })
  }

  if (Array.isArray(featuredWork)) {
    featuredWork.forEach((fw) => {
      const parsed = parseProjectItem(fw, 'Pin to Featured section on LinkedIn')
      const fKey = getProjectFuzzyKey(parsed.title)
      if (!fKey) return
      if (projectShowcaseMap.has(fKey)) {
        const existing = projectShowcaseMap.get(fKey)
        if (!existing.description && parsed.description) existing.description = parsed.description
        if (parsed.actionNote && !existing.actionNote) existing.actionNote = parsed.actionNote
        if (parsed.technologies.length > 0) {
          existing.technologies = Array.from(new Set([...existing.technologies, ...parsed.technologies]))
        }
      } else {
        projectShowcaseMap.set(fKey, parsed)
      }
    })
  }

  const consolidatedProjects = Array.from(projectShowcaseMap.values()).map((p) => {
    if (!p.description || !p.description.trim()) {
      const techStr = p.technologies.length > 0 ? ` leveraging ${p.technologies.slice(0, 4).join(', ')}` : ''
      return {
        ...p,
        description: `Engineered ${p.title}${techStr} to drive high-impact operational efficiency and verifiable workflow outcomes.`,
      }
    }
    return p
  })

  // 2. Filter False Certifications (Drop tool dumps, comma-separated stacks, and projects)
  const rawCertList = Array.isArray(sectionsToAdd?.certifications) ? sectionsToAdd.certifications : []
  const filteredCertifications = rawCertList.filter((cert) => {
    const certName = safeText(cert.name || cert.title || '').trim()
    const certIssuer = safeText(cert.issuer || cert.authority || '').trim()
    if (!certName || certName.length < 3) return false
    if (certName.includes(',') || certName.includes('/') || certName.includes('|')) return false
    if (Array.from(projectShowcaseMap.values()).some((p) => p.title.toLowerCase().includes(certName.toLowerCase().slice(0, 15)))) return false
    if (/self-certified/i.test(certIssuer) && /pipeline|engineering|methodology|gathering|cloud/i.test(certName)) return false
    return true
  })
  const hasCertifications = filteredCertifications.length > 0

  // ── Deterministic Role-Accurate Visibility Tricks (Guarantees Page 24 & Page 25 consistency)
  const resolvedTargetRole = targetRole || 'Data Analyst'
  const isDataAnalystRole = /data\s+analyst|business\s+intelligence|bi\s+analyst|analytics/i.test(resolvedTargetRole)

  const baseTitle = resolvedTargetRole.replace(/^(?:Senior|Lead|Staff|Principal|Junior|Associate|Mid-Level)\s+/i, '').trim() || resolvedTargetRole
  const otwTitles = isDataAnalystRole
    ? ['Data Analyst', 'Senior Data Analyst', 'Business Intelligence Analyst', 'Product Data Analyst', 'Analytics Specialist']
    : /data\s+scientist|machine\s+learning|ai\s+engineer|ml\s+engineer/i.test(resolvedTargetRole)
    ? [
        resolvedTargetRole,
        `Senior ${baseTitle}`,
        'Applied AI / ML Engineer',
        'Lead Data Scientist',
        `Staff ${baseTitle}`,
      ]
    : /data\s+engineer/i.test(resolvedTargetRole)
    ? ['Data Engineer', 'Senior Data Engineer', 'Lead Data Engineer', 'Analytics & BigQuery Data Engineer', 'Cloud Data Architect']
    : [
        resolvedTargetRole,
        `Senior ${baseTitle}`,
        `Lead ${baseTitle}`,
        `${baseTitle} II`,
        `Principal ${baseTitle}`,
      ]

  const cleanConcreteCandidateSkills = (
    Array.isArray(top3PinnedSkills) && top3PinnedSkills.length >= 3
      ? top3PinnedSkills
      : Array.isArray(pinnedSkills) && pinnedSkills.length >= 3
      ? pinnedSkills
      : Array.isArray(coreSkillList) && coreSkillList.length >= 3
      ? coreSkillList
      : []
  ).filter(isConcreteTechSkill)

  const top3SkillsForTricks = cleanConcreteCandidateSkills.length >= 3
    ? cleanConcreteCandidateSkills.slice(0, 3)
    : top3PinnedSkills.length >= 3
    ? top3PinnedSkills.slice(0, 3)
    : isDataAnalystRole
    ? ['SQL', 'Power BI', 'Python']
    : ['React', 'Node.js', 'TypeScript']

  const hardCandidateSkills = Array.from(new Set([
    ...top3SkillsForTricks,
    ...recommendedSkills.filter(isConcreteTechSkill),
  ])).filter(isConcreteTechSkill).slice(0, 4)

  const booleanRolePrefix = isDataAnalystRole
    ? '("Data Analyst" OR "Business Intelligence Analyst")'
    : `("${resolvedTargetRole}")`
  const booleanQueryStr = `${booleanRolePrefix} AND (${hardCandidateSkills.map((s) => `"${s}"`).join(' OR ')})`

  const enforcedVisibilityTricks = [
    {
      category: 'Open to Work Titles',
      trick: '1. Set 5 Exact Job Titles in "Open to Work"',
      advice: 'LinkedIn Recruiter search filters match candidate "Job Titles" strictly. Add these 5 exact titles to your private Open to Work preferences:',
      items: otwTitles,
    },
    {
      category: 'Top 3 Pinned Skills',
      trick: '2. Pin Your Top 3 Skills to the Top of Skills Section',
      advice: 'Recruiters see the first 3 pinned skills immediately on mobile and search cards. Pin these 3 core skills to maximize recruiter match score:',
      items: top3SkillsForTricks,
    },
    {
      category: 'Recruiter Boolean String',
      trick: '3. Optimize for Recruiter Boolean Search Strings',
      advice: 'Technical recruiters find candidates using exact boolean operators. Ensure your profile headline and about section match this search query:',
      items: [booleanQueryStr],
    },
    {
      category: 'Featured Media Architecture',
      trick: '4. Showcase High-Scale Technical Artifacts',
      advice: 'Recruiters and hiring managers spend 80% of their review time on evidence of real system delivery. Pin high-impact technical artifacts directly to your profile top.',
      items: [`${top3SkillsForTricks.join(' + ')} Portfolio & Case Study`, 'Live Demo URL'],
    },
  ]


  // Calculate About section statistics safely & apply Auto-Enrichment Guard
  const rawAbout = optimizations?.aboutRewrite || null
  const aboutIsString = typeof rawAbout === 'string'
  let hookText = safeText(rawAbout?.hook)
  let audienceText = safeText(rawAbout?.audienceAndProblem)
  let approachText = safeText(rawAbout?.approachAndSkills)
  let ctaText = safeText(rawAbout?.closingCta || rawAbout?.callToAction)
  let fallbackFullText = safeText(rawAbout?.fullText)

  const initialCombined = aboutIsString ? rawAbout : (fallbackFullText || [hookText, audienceText, approachText, ctaText].filter(Boolean).join('\n\n'))
  const initialWords = initialCombined.trim() ? initialCombined.trim().split(/\s+/).filter(Boolean).length : 0

  if (!aboutIsString) {
    if (!hookText) hookText = richFallbackHook
    if (!audienceText) audienceText = richFallbackAudience
    if (!approachText) approachText = richFallbackApproach
    if (!ctaText) ctaText = richFallbackCta
    if (!fallbackFullText) {
      fallbackFullText = `${hookText}\n\n${audienceText}\n\n${approachText}\n\n${ctaText}`
    }
  } else if (aboutIsString && initialWords < 40) {
    fallbackFullText = richFallbackAbout
  }

  const fullAboutText = (aboutIsString && initialWords >= 40)
    ? rawAbout
    : (fallbackFullText || [hookText, audienceText, approachText, ctaText].filter(Boolean).join('\n\n'))

  const aboutWordCount = fullAboutText.trim()
    ? fullAboutText.trim().split(/\s+/).filter(Boolean).length
    : 0
  const aboutCharCount = fullAboutText.length

  const rawScorecard = (linkedinAgent && typeof linkedinAgent.score === 'number' && linkedinAgent.dashboard)
    ? linkedinAgent.dashboard
    : (linkedinAgent && typeof linkedinAgent.score === 'number')
    ? linkedinAgent
    : null

  const topSkillStr = (top3SkillsForTricks && top3SkillsForTricks.length > 0)
    ? top3SkillsForTricks.join(', ')
    : (isDataAnalystRole ? 'SQL, Power BI, and Python' : 'React, TypeScript, and Node.js')

  const fallbackScorecard = {
    score: reportData?.score_breakdown?.linkedin?.score || 68,
    grade: reportData?.score_breakdown?.linkedin?.grade || 'C',
    gradeLabel: 'Developing',
    grades: {
      headline: { score: 68, grade: 'C', label: 'Headline SEO' },
      about: { score: 60, grade: 'C', label: 'About Story' },
      skills: { score: 70, grade: 'C', label: 'Pinned Skills' },
      network: { score: 65, grade: 'C', label: 'Social Reach' },
    },
    checks: [
      { id: 'li_headline', label: 'Headline Keyword Density', detail: 'Needs target role title + top 3 technical tools', status: 'warn' },
      { id: 'li_about', label: 'Story-Driven About Section', detail: 'Missing quantified hook and core stack keywords', status: 'fail' },
      { id: 'li_skills', label: 'Top 3 Pinned Technical Skills', detail: `Pin ${topSkillStr} to top of skills list`, status: 'fail' },
    ],
    summary: 'Profile is unlinked or blank, missing critical recruiter search indexing keywords and social proof.',
  }

  // Ensure grades includes numeric score values and checks uses { id, label, detail, status } (NOT { name })
  const effectiveScorecard = (() => {
    if (!rawScorecard) return fallbackScorecard

    const normalizedGrades = {}
    for (const [key, g] of Object.entries(rawScorecard.grades || {})) {
      if (!g) continue
      const gScore = typeof g.score === 'number' ? g.score : (g.grade === 'A' ? 90 : g.grade === 'B' ? 75 : g.grade === 'C' ? 60 : 45)
      normalizedGrades[key] = {
        ...g,
        label: g.label || key.toUpperCase(),
        score: gScore,
        grade: g.grade || (gScore >= 85 ? 'A' : gScore >= 70 ? 'B' : gScore >= 55 ? 'C' : 'D'),
      }
    }

    const normalizedChecks = Array.isArray(rawScorecard.checks) && rawScorecard.checks.length > 0
      ? rawScorecard.checks.map((c, i) => ({
          id: c.id || `li_chk_${i}`,
          label: c.label || c.name || c.title || 'Profile Check',
          detail: c.detail || c.description || c.reason || '',
          status: c.status || 'pass',
        }))
      : fallbackScorecard.checks

    return {
      ...rawScorecard,
      grades: Object.keys(normalizedGrades).length > 0 ? normalizedGrades : fallbackScorecard.grades,
      checks: normalizedChecks,
    }
  })()

  // ── Extract Dynamic Candidate Context for Thought Leadership Synthesis ──
  const candidateProjects = consolidatedProjects.length > 0 
    ? consolidatedProjects 
    : (reportData?.resume_agent?.canonicalResume?.projects || [])
  const topCandidateProject = candidateProjects[0] || {
    title: `${resolvedTargetRole} Implementation`,
    description: 'Streamlined data and architecture workflows to increase team velocity and data reliability.',
  }
  const secondCandidateProject = candidateProjects[1] || {
    title: 'Automated Metric Reporting',
    description: 'Built high-impact dashboards and automated verification checks.',
  }
  const primaryTechTags = (top3SkillsForTricks && top3SkillsForTricks.length > 0)
    ? top3SkillsForTricks
    : ['Analytics', 'Cloud', 'DataStrategy']
  const hashTagsString = primaryTechTags.map(t => `#${t.replace(/[^a-zA-Z0-9]/g, '')}`).join(' ') + ` #${resolvedTargetRole.replace(/[^a-zA-Z0-9]/g, '')}`

  const dynamicActivityPosts = [
    {
      badge: 'Architecture Case Study',
      title: `How We Solved Pipeline Latency in ${topCandidateProject.title}`,
      content: `Most reporting and technical bottlenecks aren't query issues—they are architectural governance issues.\n\nIn our recent project (${topCandidateProject.title}):\n${topCandidateProject.description}\n\nKey Engineering Moves:\n1. Re-architected core workflows to eliminate unvalidated ad-hoc transformations.\n2. Implemented automated pre-ingestion checks for data consistency and integrity.\n3. Aligned business metrics with cross-functional stakeholders.\n\nResult: Accelerated delivery cycles and verifiable operational confidence.\n\nWhat architecture pattern do you rely on most in ${resolvedTargetRole} workflows?\n\n${hashTagsString}`,
    },
    {
      badge: 'Technical Best Practice',
      title: `3 Operational Rules for Scalable ${resolvedTargetRole} Workflows`,
      content: `Early in my career, manual scripts and reactive fixes were common for quick stakeholder answers. But as systems scale, that approach breaks down fast.\n\nHere are 3 rules our team enforces to keep systems reliable:\n\n• Version-controlled definitions over one-off ad-hoc queries.\n• Automated reconciliation and error-handling before leadership reviews.\n• Unified domain terminology so engineering, operations, and leadership speak the exact same language.\n\n${secondCandidateProject.title ? `Applied directly in ${secondCandidateProject.title} to guarantee audit readiness.` : 'Reliability is built through architecture, not luck.'}\n\nHow does your team enforce operational consistency?\n\n${hashTagsString}`,
    },
    {
      badge: 'Leadership & Domain Insight',
      title: `The #1 Skill That Actually Moves the Needle in ${resolvedTargetRole}`,
      content: `After years driving technical deliverables across high-stakes domains, here is my biggest takeaway:\n\nThe most impactful technical professional isn't the one who builds the most complex architecture.\n\nIt's the one who translates technical execution into clear, high-conviction decisions for stakeholders who need reliable outcomes.\n\nFocus on verifiable business impact, not just execution.\n\n#Leadership #EngineeringExcellence ${hashTagsString}`,
    },
  ]

  return (
    <section id="linkedin-ai" className="space-y-8 scroll-mt-28">
      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[#0a66c2] flex items-center">
          <LinkedinLogo size={26} weight="fill" />
        </span>
        <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
          Executive LinkedIn Diagnostic & Optimization Studio
        </h2>
        <span className="flex-1 h-px bg-[var(--border-default)]" />
      </div>

      {/* Amber alert if blank/unlinked profile */}
      {isBlankProfile && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs space-y-1 mb-6">
          <div className="font-bold text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
            ⚠️ Blank / Unlinked LinkedIn Profile Detected (Primary Bottleneck)
          </div>
          <p>
            Your profile is currently missing or unlinked, which directly causes your Phase 1 recruiter screening drop-off.
            Copy and paste the pre-engineered headline, story-driven about section, and pinned skills below to activate your All-Star profile today.
          </p>
        </div>
      )}

      {/* ── 0. Live Scraped Profile Snapshot (if profile data is available) ────── */}
      <LiveScrapedProfileSnapshot profileData={profileData} activitySignals={activitySignals} rawPosts={rawPosts} />

      {/* ── 0B. Live Scraped Recent Activity & Posts Feed ──────────────────────── */}
      {rawPosts.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 mb-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Recent Public LinkedIn Activity ({rawPosts.length} Posts Analyzed)
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-default)]">
              Verified Public Feed
            </span>
          </div>
          <div className="space-y-2.5">
            {rawPosts.slice(0, 4).map((post, pIdx) => (
              <div key={pIdx} className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium">
                  <span>Post #{pIdx + 1} {post.postedAt?.postedAgoShort ? `· ${post.postedAt.postedAgoShort}` : ''}</span>
                  <span className="flex items-center gap-2">
                    <span>👍 {post.engagement?.likes || 0}</span>
                    <span>💬 {post.engagement?.comments || 0}</span>
                  </span>
                </div>
                <p className="text-[var(--text-primary)] leading-relaxed line-clamp-3">
                  "{typeof post.content === 'string' ? post.content : (post.content?.text || '')}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 1. Scorecard at the top ────────────────────────────────────────── */}
      <ResumeScoreCard
        dashboard={effectiveScorecard}
        variant={variant}
        title="LinkedIn Profile Score"
        scoreWord="LinkedIn profile"
        hideChecklist={true}
      />

      {/* ── 1B. Section-by-Section /10 Audit (Shraddha Playbook) ──────────── */}
      <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkle size={15} weight="fill" className="text-[var(--primary)]" />
              Section-by-Section LinkedIn Audit (/10)
            </span>
            <p className="text-xs text-[var(--text-secondary)]">
              Recruiter benchmark breakdown scoring each profile section out of 10 with actionable "what's hurting" diagnostics.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5 rounded-full">
            5 Core Sections Audited
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {Object.entries(effectiveSectionAudit).map(([key, item]) => {
            const score10 = item.score10 ?? 0
            const isPassing = score10 >= 9
            const isWarning = score10 >= 6 && score10 < 9
            const badgeClass = isPassing
              ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20'
              : isWarning
              ? 'text-amber-700 bg-amber-500/10 border-amber-500/20'
              : 'text-rose-700 bg-rose-500/10 border-rose-500/20'

            const barColor = isPassing
              ? 'bg-emerald-500'
              : isWarning
              ? 'bg-amber-500'
              : 'bg-rose-500'

            return (
              <div
                key={key}
                className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {item.label}
                    </span>
                    <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-md border ${badgeClass}`}>
                      {score10}/10
                    </span>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full h-1.5 bg-[var(--surface-card)] rounded-full overflow-hidden border border-[var(--border-default)]">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${barColor}`}
                      style={{ width: `${Math.max(10, Math.min(100, score10 * 10))}%` }}
                    />
                  </div>
                </div>

                {/* What's Hurting note */}
                <div className="pt-2 border-t border-[var(--border-default)] text-[11px] leading-relaxed">
                  {item.hurtingReason ? (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <WarningCircle size={12} weight="bold" /> What's Hurting
                      </span>
                      <p className="text-[var(--text-secondary)] text-[11px] leading-snug">
                        {item.hurtingReason}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle size={12} weight="bold" /> Looking Strong
                      </span>
                      <p className="text-[var(--text-muted)] text-[11px] leading-snug">
                        Well-calibrated for recruiter search indexing and candidate ranking.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 1C. Gentle Crafture OutFox Recommendation (When Activity Is Hurting) ── */}
      {showOutFox && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-3.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
                <Lightning size={16} weight="fill" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Automate Your LinkedIn Reach With Crafture OutFox
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Safe, executive-grade networking automation to stay visible to hiring managers daily.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
              Networking Velocity
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3">
            <p className="text-xs text-[var(--text-primary)] leading-relaxed">
              <strong className="text-amber-600 dark:text-amber-400 font-semibold">Activity Bottleneck: </strong>
              {networkingRecommendation?.bottleneck || 'Low posting, commenting, and connection activity is limiting your visibility to hiring managers.'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              If staying consistent with daily networking, commenting, and connection limits is difficult, contact the Crafture team to get access to <strong className="text-[var(--text-primary)] font-semibold">OutFox</strong> — our automated LinkedIn networking agent that helps you utilize your daily LinkedIn limits safely and get noticed by hiring managers.
            </p>

            <div className="pt-1">
              <a
                href="mailto:aditya@crafture.in?subject=OutFox%20Access%20Inquiry%20-%20Career%20GPS"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 transition-all shadow-xs cursor-pointer"
              >
                <EnvelopeSimple size={14} weight="bold" />
                Inquire About OutFox Access
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── 1D. Profile Picture & Cover Banner Upgrade Prompts ── */}
      <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Camera size={16} weight="fill" className="text-[var(--primary)]" />
              Profile Picture & Cover Banner Upgrade Prompts
            </span>
            <p className="text-xs text-[var(--text-secondary)]">
              Pre-filled generative prompts grounded in your target role and verified resume achievements.
            </p>
          </div>
        </div>

        {/* Note on image quality grading */}
        <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-primary)] font-semibold">Visual Audit Policy: </strong>
          We don&apos;t visually grade image quality — if you feel your profile picture or banner isn&apos;t strong enough, copy these pre-filled prompts to generate a studio-grade upgrade.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Studio Headshot Prompt */}
          <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Camera size={14} className="text-[var(--primary)]" /> Studio Headshot Prompt
                </span>
                <span className="text-[10px] font-mono uppercase bg-[var(--primary-light)] text-[var(--primary)] px-2 py-0.5 rounded border border-[var(--primary)]/20">
                  Midjourney / DALL-E
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] font-mono bg-[var(--surface-card)] p-3 rounded-lg border border-[var(--border-default)] leading-relaxed select-all">
                {effectiveVisualPrompts.profilePicturePrompt}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(effectiveVisualPrompts.profilePicturePrompt, 'copy_pfp_prompt')}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                copiedId === 'copy_pfp_prompt'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
              }`}
            >
              {copiedId === 'copy_pfp_prompt' ? (
                <><Check size={13} weight="bold" /> Copied Headshot Prompt</>
              ) : (
                <><Copy size={13} /> Copy Studio Headshot Prompt</>
              )}
            </button>
          </div>

          {/* Cover Banner Prompt */}
          <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Sparkle size={14} className="text-amber-500" /> 6-Element Cover Banner Prompt (1584x396 px)
                </span>
                <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded border border-amber-500/20">
                  Canva / AI Banner
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] font-mono bg-[var(--surface-card)] p-3 rounded-lg border border-[var(--border-default)] leading-relaxed select-all whitespace-pre-line max-h-48 overflow-y-auto">
                {effectiveVisualPrompts.coverBannerPrompt}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(effectiveVisualPrompts.coverBannerPrompt, 'copy_banner_prompt')}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                copiedId === 'copy_banner_prompt'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
              }`}
            >
              {copiedId === 'copy_banner_prompt' ? (
                <><Check size={13} weight="bold" /> Copied Banner Prompt</>
              ) : (
                <><Copy size={13} /> Copy Cover Banner Prompt</>
              )}
            </button>
          </div>
        </div>

        {/* 3 Banner Layout Showcase Directions */}
        {effectiveVisualPrompts.bannerShowcaseOptions?.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-[var(--border-default)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Recommended Banner Style Directions:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {effectiveVisualPrompts.bannerShowcaseOptions.map((opt, oIdx) => (
                <div
                  key={oIdx}
                  className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[var(--text-primary)]">{opt.style}</span>
                  </div>
                  <p className="text-[11px] text-[var(--primary)] font-mono">{opt.colorPalette}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{opt.layout}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 1B. Recruiter SEO Scorecard ────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                in
              </span>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                LinkedIn Recruiter Search Visibility
              </h4>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              How easily corporate recruiters and hiring managers find your profile in inbound searches.
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {recruiterSeo?.seoScore || 58}/100
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                (recruiterSeo?.seoScore || 58) >= 80
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
              }`}
            >
              {recruiterSeo?.status || 'AVERAGE_VISIBILITY'}
            </span>
          </div>
        </div>

        {/* Penalties and Insights Breakdown */}
        {recruiterSeo?.penalties?.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Visibility Factors &amp; Algorithmic Penalties:
            </span>
            <div className="space-y-1.5">
              {recruiterSeo.penalties.map((pen, pIdx) => (
                <div
                  key={pIdx}
                  className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-bold text-rose-700 dark:text-rose-400 font-mono text-[10px]">
                      {pen.rule}
                    </span>
                    <p className="text-[var(--text-secondary)] text-[11px]">{pen.critique}</p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-rose-600 shrink-0">
                    {pen.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Resume-vs-LinkedIn Missing Sections & Discrepancies (Top 4 Compact Grid) ── */}
      {topDiscrepancies.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-start gap-3.5 border-b border-[var(--border-default)] pb-4">
            <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0 mt-0.5">
              <ShieldWarning size={24} weight="duotone" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Missing Sections & Cross-Platform Discrepancies
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                  Top Recruiter Screening Flags
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Differences between your verified resume and LinkedIn profile (e.g. omitted sections, title drift, timeline drift, or missing skills) are immediate friction points that recruiters notice in candidate screenings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {topDiscrepancies.map((item, idx) => (
              <div
                key={item.id || idx}
                className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-3 text-xs shadow-2xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-[var(--text-primary)] flex items-start gap-1.5 leading-snug">
                      {item.type === 'timeline_drift' ? (
                        <CalendarBlank size={15} className="text-[#0a66c2] shrink-0 mt-0.5" />
                      ) : item.type === 'title_drift' ? (
                        <Briefcase size={15} className="text-[#0a66c2] shrink-0 mt-0.5" />
                      ) : item.type === 'missing_section' ? (
                        <FolderSimple size={15} className="text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <WarningCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <span className="break-words">{safeText(item.title)}</span>
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md shrink-0 border ${
                        item.severity === 'high'
                          ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>

                  {/* Clean 2-Column Comparison Box (Zero Truncation, Natural Word-Wrapping) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] text-xs leading-relaxed">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5 text-[11px] uppercase tracking-wider">Resume:</span>
                      <span className="text-[var(--text-secondary)] break-words">{safeText(item.resumeClaim)}</span>
                    </div>
                    <div className="min-w-0 pt-1.5 sm:pt-0 sm:pl-2.5 sm:border-l border-[var(--border-default)]">
                      <span className="font-bold text-rose-600 dark:text-rose-400 block mb-0.5 text-[11px] uppercase tracking-wider">LinkedIn:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-medium break-words">{safeText(item.linkedinClaim)}</span>
                    </div>
                  </div>

                  {item.diagnosis && (
                    <p className="text-[var(--text-secondary)] leading-relaxed pt-0.5">{safeText(item.diagnosis)}</p>
                  )}
                </div>

                {item.recommendation && (
                  <p className="text-xs text-[var(--text-primary)] font-medium pt-2 border-t border-[var(--border-default)]">
                    <ArrowRight size={12} className="inline mr-1 text-[var(--primary)]" />
                    {safeText(item.recommendation)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 2.5 Recent Activity, Posts & Content Strategy ── */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] pb-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shrink-0 mt-0.5">
              <ChatCircleText size={24} weight="duotone" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Public Activity, Posts &amp; Thought Leadership Audit
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20">
                  Activity Score: 40/100 · Grade D (Dormant)
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                LinkedIn&apos;s recruiter search algorithm ranks active creators up to 4x higher than dormant profiles. While historical interactions were analyzed, your profile lacks recent original architecture insights.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)]">
            Public Posts &amp; Comments Analyzed
          </span>
        </div>

        {/* 3 Metric Diagnosis Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-1">
            <div className="text-[10px] font-mono text-slate-400">Activity Cadence</div>
            <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              Dormant (&gt;60 Days Inactive)
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">No original technical posts published recently. Recruiter visibility decays after 30 days of inactivity.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-1">
            <div className="text-[10px] font-mono text-slate-400">Interaction Style</div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Low-Signal Reactions
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">Past activity consists primarily of company updates and reactions rather than original domain commentary.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-1">
            <div className="text-[10px] font-mono text-slate-400">Recruiter Conversion Impact</div>
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              +50 Score Lift Opportunity
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">Publishing 1 high-value project case study per month moves your Activity score from 40/100 to 90/100.</p>
          </div>
        </div>

        {/* 3 Ready-to-Publish Thought Leadership Post Templates */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-1.5">
              <Article size={14} className="text-amber-500" />
              3 Pre-Engineered Thought Leadership Posts (1-Click Copy)
            </span>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              Calibrated to {resolvedTargetRole} Domain Authority
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dynamicActivityPosts.map((post, pIdx) => {
              const copyKey = `post_template_${pIdx}`
              const isCopied = copiedId === copyKey
              return (
                <div
                  key={pIdx}
                  className="flex flex-col justify-between bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-3 shadow-2xs hover:border-[var(--primary)]/40 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                        {post.badge}
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-[var(--text-primary)]">
                      {post.title}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] whitespace-pre-line leading-relaxed font-mono bg-[var(--surface-card)] p-3 rounded-lg border border-[var(--border-default)] max-h-48 overflow-y-auto">
                      {post.content}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(post.content, copyKey)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={13} weight="bold" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copy Post to Publish
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 3. AI Optimization Suite ───────────────────────────────────────── */}
      {optimizations && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-[var(--primary-light)] text-[var(--primary)]">
              <CheckCircle size={16} weight="bold" />
            </span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              Action-Oriented All-Star Optimization Suite
            </h3>
          </div>

          {/* 3 Interactive Headline Options (One-Click Copy) */}
          {Array.isArray(optimizations.headlines) && optimizations.headlines.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <TextT size={14} className="text-[var(--primary)]" />
                  Recruiter-Searchable Headlines (3 Options)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Grounded in verified resume + target role (15–20 words)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {optimizations.headlines.map((item, idx) => {
                  const copyKey = `headline_${idx}`
                  const isCopied = copiedId === copyKey
                  const headlineText = typeof item === 'string' ? item : safeText(item?.headline || item?.text)
                  const whyItWorks = safeText(item?.whyItWorks)
                  const label =
                    HEADLINE_FORMULA_LABELS[idx] ||
                    safeText(item?.formula) ||
                    `Option ${idx + 1}`

                  return (
                    <div
                      key={idx}
                      className="flex flex-col justify-between bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-4 shadow-xs hover:border-[var(--primary)]/40 hover:shadow-sm transition-all"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                            {label}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                          {headlineText}
                        </p>
                        {whyItWorks && (
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-1 border-t border-[var(--border-default)]">
                            <span className="font-medium text-[var(--text-primary)]">Why recruiters click: </span>
                            {whyItWorks}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(headlineText, copyKey)}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-default)]'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check size={14} weight="bold" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={14} /> Copy Headline
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Story-Driven About Section Card */}
          {rawAbout && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      Story-Driven About Section Rewrite
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-default)] font-medium tabular-nums">
                      {aboutWordCount} words · {aboutCharCount} chars (limit: 2,600)
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Structured using the 4-part video copywriting framework: Credibility Hook → Target Audience &amp; Problem → Approach &amp; Skills → Natural Closing CTA
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(fullAboutText, 'about_rewrite')}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                    copiedId === 'about_rewrite'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#0a66c2] hover:bg-[#004182] text-white'
                  }`}
                >
                  {copiedId === 'about_rewrite' ? (
                    <>
                      <Check size={14} weight="bold" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy Full About Section
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-4 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-5 text-xs text-[var(--text-secondary)] leading-relaxed">
                {aboutIsString ? (
                  <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{rawAbout}</p>
                ) : (
                  <>
                    {hookText && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--primary)]">
                          Part 1: Credibility &amp; Measurable Outcome Hook
                        </span>
                        <p className="text-[var(--text-primary)] font-medium whitespace-pre-wrap leading-relaxed">
                          {hookText}
                        </p>
                      </div>
                    )}
                    {audienceText && (
                      <div className="space-y-1 pt-2.5 border-t border-[var(--border-default)]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                          Part 2: Target Audience &amp; Core Problem Solved
                        </span>
                        <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                          {audienceText}
                        </p>
                      </div>
                    )}
                    {approachText && (
                      <div className="space-y-1 pt-2.5 border-t border-[var(--border-default)]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                          Part 3: Approach, Experience &amp; Key Skills
                        </span>
                        <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                          {approachText}
                        </p>
                      </div>
                    )}
                    {ctaText && (
                      <div className="space-y-1 pt-2.5 border-t border-[var(--border-default)]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                          Part 4: Simple, Natural Closing CTA
                        </span>
                        <p className="text-[var(--text-primary)] italic whitespace-pre-wrap leading-relaxed">
                          {ctaText}
                        </p>
                      </div>
                    )}
                    {!hookText && !approachText && !ctaText && fallbackFullText && (
                      <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                        {fallbackFullText}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Experience Bullet Upgrades (Outcome & Metrics Driven) ──────────── */}
          {experienceUpgrades.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase size={15} className="text-[var(--primary)]" />
                    High-Impact Experience Bullet Rewrites ({experienceUpgrades.length} Roles)
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Pre-engineered with hard metrics, action verbs, and verified technical scope from your resume.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Ready to Paste
                </span>
              </div>

              <div className="space-y-4">
                {(() => {
                  const renderRole = (item, idx) => {
                    const bullets = (item.bullets || []).filter(Boolean)
                    const allBulletsText = bullets.map((b) => (typeof b === 'string' ? `• ${b}` : `• ${safeText(b)}`)).join('\n')
                    const copyRoleKey = `role_exp_${idx}`
                    const isRoleCopied = copiedId === copyRoleKey

                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-md bg-[var(--primary-light)] text-[var(--primary)]">
                              <Briefcase size={14} />
                            </span>
                            <span className="text-sm font-bold text-[var(--text-primary)]">
                              {safeText(item.role)} <span className="font-normal text-[var(--text-muted)]">at</span> {safeText(item.company)}
                            </span>
                          </div>

                          {bullets.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleCopy(allBulletsText, copyRoleKey)}
                              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isRoleCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                              }`}
                            >
                              {isRoleCopied ? (
                                <>
                                  <Check size={13} weight="bold" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={13} /> Copy All Bullets
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {item.linkedinGap && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--surface-card)] border border-amber-500/30 text-xs text-[var(--text-primary)]">
                            <WarningCircle size={15} className="text-amber-500 shrink-0 mt-0.5" weight="fill" />
                            <div>
                              <span className="font-semibold text-amber-600 dark:text-amber-400">LinkedIn Gap / Alignment: </span>
                              <span className="text-[var(--text-secondary)]">
                                {safeText(item.linkedinGap).includes('is missing or unlinked on your LinkedIn profile')
                                  ? `LinkedIn Optimization Focus: Align vendor/client naming ('${safeText(item.company)}') with your LinkedIn experience entry and replace task-heavy descriptions with the quantified executive bullets below.`
                                  : safeText(item.linkedinGap)}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          {bullets.map((b, bIdx) => {
                            const rawText = typeof b === 'string' ? b : safeText(b)
                            const cleanText = rawText.replace(/\*\*/g, '')
                            const isMandate = /^Role Mandate:\s*/i.test(cleanText)
                            const mandateRemainder = isMandate ? cleanText.replace(/^Role Mandate:\s*/i, '') : cleanText
                            const copyBulletKey = `bullet_${idx}_${bIdx}`
                            const isBulletCopied = copiedId === copyBulletKey

                            return (
                              <div
                                key={bIdx}
                                className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] leading-relaxed group"
                              >
                                <div className="flex items-start gap-2">
                                  <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" weight="fill" />
                                  <span>
                                    {isMandate ? (
                                      <>
                                        <strong className="font-bold text-[var(--text-primary)]">Role Mandate: </strong>
                                        {mandateRemainder}
                                      </>
                                    ) : (
                                      cleanText
                                    )}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(cleanText, copyBulletKey)}
                                  className={`shrink-0 p-1 rounded-md transition-colors ${
                                    isBulletCopied
                                      ? 'text-emerald-600 bg-emerald-500/10'
                                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]'
                                  }`}
                                  title="Copy bullet"
                                >
                                  {isBulletCopied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  const primaryRole = experienceUpgrades[0]
                  const remainingRoles = experienceUpgrades.slice(1)

                  return (
                    <>
                      {primaryRole && renderRole(primaryRole, 0)}

                      {remainingRoles.length > 0 && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAllLinkedInRoles(!showAllLinkedInRoles)}
                            className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] text-xs font-semibold text-[var(--primary)] flex items-center justify-center gap-2 transition-all cursor-pointer print:hidden"
                          >
                            {showAllLinkedInRoles ? (
                              <>Show Less (Display Latest Role Only)</>
                            ) : (
                              <>+ View LinkedIn Rewrites for {remainingRoles.length} Previous Role{remainingRoles.length > 1 ? 's' : ''}</>
                            )}
                          </button>
                          <div className={showAllLinkedInRoles ? 'space-y-4 pt-4' : 'hidden print:hidden'}>
                            {remainingRoles.map((item, relIdx) => renderRole(item, relIdx + 1))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ── Unified: Skills & Recruiter SEO Bank (50+ Target) ── */}
          <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={16} weight="fill" className="text-[var(--primary)]" />
                  Skills &amp; Recruiter SEO Bank (50+ Target)
                </span>
                <p className="text-xs text-[var(--text-secondary)]">
                  Recruiter search algorithms index candidates by exact skill-slot matches. Pin your top 3 anchors, add missing verified skills, and utilize all 50 slots.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5 rounded-full">
                50-Skill Maximum Capacity
              </span>
            </div>

            {/* A. Top 3 Pinned Skills (Profile Anchors) */}
            {finalTop3PinnedSkills.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <PushPin size={14} weight="fill" className="text-[var(--primary)]" />
                    Top 3 Pinned Skills (Profile Anchors)
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Pin these 3 to the top of your LinkedIn Skills section
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {finalTop3PinnedSkills.map((skill, idx) => {
                    const copyKey = `pinned_${idx}`
                    const isCopied = copiedId === copyKey
                    const skillName = safeText(skill)
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleCopy(skillName, copyKey)}
                        className={`print-keep p-3.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                          isCopied
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'border-[var(--primary)]/20 bg-[var(--primary-light)] hover:bg-[var(--primary-light)]/80 text-[var(--text-primary)]'
                        }`}
                        title="Click to copy pinned skill"
                      >
                        <div className="flex items-center gap-2">
                          <PushPin size={14} weight="fill" className={isCopied ? 'text-white' : 'text-[var(--primary)]'} />
                          <span className="text-xs font-bold">{skillName}</span>
                        </div>
                        {isCopied ? <Check size={14} weight="bold" /> : <Copy size={13} className="opacity-60" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* B. Recommended Skills to Add (Verified from Resume) */}
            {recommendedSkills.length > 0 && (
              <div className="space-y-2.5 pt-3 border-t border-[var(--border-default)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Plus size={14} weight="bold" className="text-[var(--primary)]" />
                    Recommended Priority Additions ({recommendedSkills.length} Verified Resume Skills)
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Click any chip to copy into LinkedIn skills bank
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {recommendedSkills.map((skill, idx) => {
                    const copyKey = `skill_${idx}`
                    const isCopied = copiedId === copyKey
                    const skillName = safeText(skill)
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleCopy(skillName, copyKey)}
                        className={`print-keep px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-default)]'
                        }`}
                        title="Click to copy skill name"
                      >
                        {isCopied ? (
                          <Check size={13} weight="bold" />
                        ) : (
                          <Plus size={13} weight="bold" className="text-[var(--primary)]" />
                        )}
                        <span>{skillName}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* C. 50+ Categorized Skills Bank (Core, Tools, Industry, Transferable) */}
            {categorizedSkills && (
              <div className="space-y-3 pt-3 border-t border-[var(--border-default)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Tag size={14} className="text-indigo-600 dark:text-indigo-400" />
                    Categorized 50-Skill Recruiter Bank
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {categorizedSkills.totalCount || 40}+ curated skills across 4 buckets
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {[
                    { label: 'Tools & Platforms', items: categorizedSkills.toolsAndPlatforms || [] },
                    { label: 'Core Functional', items: categorizedSkills.coreFunctional || [] },
                    { label: 'Industry & Standards', items: categorizedSkills.industrySpecific || [] },
                    { label: 'Transferable & Leadership', items: categorizedSkills.transferable || [] },
                  ].filter((b) => b.items.length > 0).map((bucket, bIdx) => (
                    <div key={bIdx} className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          {bucket.label}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                          {bucket.items.length} skills
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {bucket.items.map((sk, skIdx) => {
                          const copyKey = `cat_sk_${bIdx}_${skIdx}`
                          const isCopied = copiedId === copyKey
                          const skText = safeText(sk)
                          return (
                            <button
                              key={skIdx}
                              type="button"
                              onClick={() => handleCopy(skText, copyKey)}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer border ${
                                isCopied
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border-[var(--border-default)]'
                              }`}
                              title="Click to copy skill"
                            >
                              {skText}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Single Consolidated: Featured & Projects Showcase (Add to LinkedIn) ── */}
          {(consolidatedProjects.length > 0 || hasCertifications) && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Star size={16} weight="fill" className="text-amber-500" />
                    Featured & Projects Showcase (Add to LinkedIn)
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Verified projects from your resume to pin to the top of your profile and add to your LinkedIn Projects section for recruiter visibility.
                  </p>
                </div>
              </div>

              {consolidatedProjects.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {consolidatedProjects.map((proj, pIdx) => {
                    const copyProjKey = `showcase_proj_${pIdx}`
                    const isCopied = copiedId === copyProjKey
                    const projCopyText = `${safeText(proj.title)}\n${safeText(proj.description)}${proj.technologies?.length ? `\nSkills: ${proj.technologies.join(', ')}` : ''}`

                    return (
                      <div
                        key={pIdx}
                        className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3 text-xs flex flex-col justify-between break-inside-avoid print-card"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1.5">
                              <FolderSimple size={15} className="text-[#0a66c2] shrink-0" />
                              {safeText(proj.title)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(projCopyText, copyProjKey)}
                              className={`print-keep text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                                isCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                              }`}
                            >
                              {isCopied ? <Check size={11} weight="bold" /> : <Copy size={11} />}
                              {isCopied ? 'Copied' : 'Copy'}
                            </button>
                          </div>

                          <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(proj.description)}</p>

                          {proj.actionNote && (
                            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--primary-light)] border border-[var(--primary)]/20 text-[11px] text-[var(--text-primary)] break-inside-avoid">
                              <ArrowRight size={13} className="text-[var(--primary)] shrink-0 mt-0.5" />
                              <span>
                                <strong className="font-semibold text-[var(--primary)]">Action: </strong>
                                {safeText(proj.actionNote)}
                              </span>
                            </div>
                          )}
                        </div>

                        {Array.isArray(proj.technologies) && proj.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--border-default)]">
                            {proj.technologies.map((t, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--border-default)]"
                              >
                                {safeText(t)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Verified Licenses & Certifications (if present) */}
              {hasCertifications && (
                <div className="pt-4 border-t border-[var(--border-default)] space-y-3">
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Certificate size={15} className="text-amber-500" />
                    Verified Licenses & Certifications to Add ({filteredCertifications.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredCertifications.map((cert, cIdx) => {
                      const copyCertKey = `add_cert_${cIdx}`
                      const isCopied = copiedId === copyCertKey
                      const certText = `${safeText(cert.name)} - ${safeText(cert.issuer || cert.authority)}${cert.date ? ` (${safeText(cert.date)})` : ''}`

                      return (
                        <div
                          key={cIdx}
                          className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold text-[var(--text-primary)] truncate block">{safeText(cert.name)}</span>
                            <p className="text-[var(--text-secondary)] text-[11px] truncate">
                              {safeText(cert.issuer || cert.authority)} {cert.date ? `· ${safeText(cert.date)}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(certText, copyCertKey)}
                            className={`print-keep shrink-0 text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                            }`}
                          >
                            {isCopied ? <Check size={11} weight="bold" /> : <Copy size={11} />}
                            {isCopied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Recruiter Visibility & Search Ranking Playbook (2x2 Grid) ────── */}
          <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={15} className="text-[var(--primary)]" />
                  Recruiter Visibility & Search Ranking Playbook
                </span>
                <p className="text-xs text-[var(--text-secondary)]">
                  Targeted configuration and search algorithm triggers that boost your profile to the top 5% of candidate queries.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enforcedVisibilityTricks.map((trick, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2.5 text-xs flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[var(--text-primary)]">{safeText(trick.trick || trick.category)}</span>
                      {trick.category && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                          {safeText(trick.category)}
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(trick.advice)}</p>
                  </div>

                  {Array.isArray(trick.items) && trick.items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[var(--border-default)]">
                      {trick.items.map((it, itIdx) => {
                        const itemText = safeText(it)
                        const copyTrickKey = `trick_${idx}_${itIdx}`
                        const isCopied = copiedId === copyTrickKey

                        return (
                          <button
                            key={itIdx}
                            type="button"
                            onClick={() => handleCopy(itemText, copyTrickKey)}
                            className={`print-keep px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                            }`}
                            title="Click to copy"
                          >
                            {isCopied ? <Check size={11} weight="bold" /> : <Copy size={11} className="opacity-60" />}
                            <span>{itemText}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </section>
  )
}
