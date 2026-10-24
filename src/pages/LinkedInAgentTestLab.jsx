import React, { useState, useEffect } from 'react'
import {
  LinkedinLogo,
  Flask,
  Play,
  Copy,
  Check,
  WarningCircle,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  ShieldCheck,
  Sparkle,
  Tag,
  Briefcase,
  CalendarBlank,
  TrendDown,
  Plus,
  TextT,
  ArrowRight,
  ArrowCounterClockwise,
  UploadSimple,
  Code,
  Globe,
  User,
  FileText,
  ListChecks,
  Eye,
  Info,
} from '@phosphor-icons/react'
import ResumeScoreCard, { GRADE_COLORS } from '../components/report/ResumeScoreCard.jsx'
import brandLogo from '../assets/images/crafture-logo.jpg'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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

// Pre-loaded high-signal engineering resume
const FIXTURE_RESUME = `Marcus Vance
marcus.vance@example.com | (555) 234-8901 | Seattle, WA | linkedin.com/in/marcusvance-demo

PROFESSIONAL SUMMARY
Senior Full Stack & Cloud Systems Engineer with 6 years of experience architecting high-throughput distributed systems in Go, TypeScript, and AWS. Proven track record leading infrastructure migrations, optimizing database latency, and mentoring engineering teams.

TECHNICAL SKILLS
Languages: Go, TypeScript, JavaScript, Python, SQL
Backend & Systems: Node.js, Express, gRPC, REST APIs, GraphQL, Kafka, Redis
Cloud & DevOps: AWS (ECS, Lambda, RDS, S3), Docker, Terraform, CI/CD, Kubernetes
Databases: PostgreSQL, DynamoDB, Redis

PROFESSIONAL EXPERIENCE
Senior Backend Engineer | CloudScale Networks | Seattle, WA
April 2022 – Present
• Designed and shipped an event-driven telemetry ingestion engine in Go and Kafka, scaling throughput from 5,000 to 45,000 events/second.
• Reduced PostgreSQL p99 query latency by 58% by restructuring composite B-tree indexes and implementing Redis read-aside caching.
• Automated multi-region AWS infrastructure using Terraform and GitHub Actions, cutting production deployment lead time from 4 hours to 18 minutes.
• Mentored 4 mid-level software engineers through structured weekly design reviews and system architecture teardowns.

Full Stack Software Engineer | Horizon Fintech | Austin, TX
July 2019 – March 2022
• Built real-time transaction reconciliation dashboard in React, TypeScript, and Node.js serving 250,000 monthly active retail users.
• Implemented idempotent Stripe payment webhook pipeline, eliminating double-charge incidents across $14M in annual billing volume.
• Architected tenant isolation protocols with PostgreSQL row-level security (RLS), achieving SOC2 Type II compliance approval.
• Authored comprehensive Jest and Cypress test suites, elevating code coverage from 61% to 89%.

EDUCATION
B.S. in Computer Science | University of Washington | 2015 – 2019`

// Mock LinkedIn Presets for rapid studio testing
const MOCK_PRESETS = {
  junior: {
    name: 'Junior Dev (Cross-Platform Mismatch)',
    description: 'Junior title & dates differ from senior resume; missing all cloud skills',
    data: {
      fullName: 'Marcus Vance',
      headline: 'Junior Web Developer | Looking for Opportunities',
      about: 'Recent computer science graduate eager to contribute and learn in a supportive web engineering team.',
      experiences: [
        {
          title: 'Junior Web Developer',
          company: 'CloudScale Networks',
          dates: '2023 – Present',
          description: 'Writing frontend components and fixing bugs.',
          isCurrent: true,
        },
      ],
      skills: ['JavaScript', 'HTML', 'CSS', 'React'],
      connectionsCount: 85,
      recommendationsCount: 0,
      hasPicture: false,
      hasBanner: false,
      certifications: [],
      projects: [],
      url: 'https://www.linkedin.com/in/marcus-vance-jr',
    },
  },
  senior: {
    name: 'Senior Eng (Well-Aligned)',
    description: 'Matching title, strong social proof (500+ conn, 3 recs), solid foundation',
    data: {
      fullName: 'Marcus Vance',
      headline: 'Senior Backend Engineer | Go, Kafka & AWS Distributed Systems',
      about:
        'Senior backend and cloud engineer with 6+ years specializing in distributed systems, event-driven architectures, and high-scale telemetry platforms. Passionate about system latency, resilience, and engineering mentorship.',
      experiences: [
        {
          title: 'Senior Backend Engineer',
          company: 'CloudScale Networks',
          dates: 'April 2022 – Present',
          description:
            'Architecting telemetry ingestion engines with Go and Kafka. Managing AWS infrastructure with Terraform.',
          isCurrent: true,
        },
        {
          title: 'Full Stack Software Engineer',
          company: 'Horizon Fintech',
          dates: 'July 2019 – March 2022',
          description: 'Built real-time transaction platforms in Node.js, React, and PostgreSQL.',
        },
      ],
      skills: ['Go', 'TypeScript', 'Node.js', 'Kafka', 'AWS', 'PostgreSQL', 'Docker'],
      connectionsCount: 500,
      recommendationsCount: 3,
      hasPicture: true,
      hasBanner: true,
      pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      bannerUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
      certifications: [{ name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services' }],
      projects: [{ title: 'CloudScale Telemetry Ingestion', description: 'Go & Kafka high throughput pipeline' }],
      url: 'https://www.linkedin.com/in/marcus-vance-dev',
    },
  },
  unconfigured: {
    name: 'Unconfigured Profile (Tests Resume Fallback)',
    description: 'Scrape failed / blank profile — tests 100% resume-inferred optimization',
    data: {
      fullName: 'Marcus Vance',
      headline: '',
      about: '',
      experiences: [],
      skills: [],
      connectionsCount: 15,
      recommendationsCount: 0,
      url: '',
    },
  },
}

const ROLE_PRESETS = [
  'Senior AI & Full Stack Engineer',
  'Senior Backend & Distributed Systems Engineer',
  'Cloud Infrastructure & DevOps Architect',
  'Staff Software Engineer',
  'Engineering Manager',
]

class LinkedInTestLabErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('LinkedInTestLab caught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b14] text-gray-200 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#0f172a] border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <WarningCircle size={36} weight="fill" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">LinkedIn Test Studio Error</h2>
              <p className="text-sm text-gray-400">
                An unexpected error occurred in the test studio console.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function LinkedInAgentTestLab() {
  return (
    <LinkedInTestLabErrorBoundary>
      <LinkedInAgentTestLabContent />
    </LinkedInTestLabErrorBoundary>
  )
}

function LinkedInAgentTestLabContent() {
  const [targetRole, setTargetRole] = useState('Senior Backend & Distributed Systems Engineer')
  const [linkedinTab, setLinkedinTab] = useState('mock') // 'mock' | 'url' | 'json'
  const [activeMockKey, setActiveMockKey] = useState('junior')
  const [liveUrl, setLiveUrl] = useState('')
  const [rawJsonText, setRawJsonText] = useState(
    JSON.stringify(MOCK_PRESETS.junior.data, null, 2)
  )

  const [resumeMode, setResumeMode] = useState('sample') // 'sample' | 'file'
  const [resumeText, setResumeText] = useState(FIXTURE_RESUME)
  const [resumeFile, setResumeFile] = useState(null)

  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [apifyConfigured, setApifyConfigured] = useState(false)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [latencyMs, setLatencyMs] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [activeViewTab, setActiveViewTab] = useState('diagnosis') // 'diagnosis' | 'json'

  // Fetch health and models on mount
  useEffect(() => {
    async function initStudio() {
      try {
        const res = await fetch(`${API_BASE}/linkedin-agent/test/health`)
        if (res.ok) {
          const data = await res.json()
          setApifyConfigured(Boolean(data.apifyConfigured))
          if (Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models)
            setSelectedModel(data.models[0].id)
          }
        }
      } catch (err) {
        console.warn('Could not fetch LinkedIn agent health:', err.message)
      }
    }
    initStudio()
  }, [])

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

  const handleSelectMock = (key) => {
    setActiveMockKey(key)
    setRawJsonText(JSON.stringify(MOCK_PRESETS[key].data, null, 2))
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setResumeFile(file)
      setResumeMode('file')
    }
  }

  const handleResetResume = () => {
    setResumeText(FIXTURE_RESUME)
    setResumeFile(null)
    setResumeMode('sample')
  }

  const handleRunEvaluation = async () => {
    setLoading(true)
    setErrorMsg(null)
    setResult(null)
    const startTime = Date.now()

    try {
      let activeProfileData = null
      if (linkedinTab === 'mock') {
        activeProfileData = MOCK_PRESETS[activeMockKey].data
      } else if (linkedinTab === 'json') {
        try {
          activeProfileData = JSON.parse(rawJsonText)
        } catch (jsonErr) {
          throw new Error(`Invalid LinkedIn JSON: ${jsonErr.message}`)
        }
      }

      let res
      if (resumeMode === 'file' && resumeFile) {
        const formData = new FormData()
        formData.append('resume', resumeFile)
        formData.append('targetRole', targetRole)
        if (selectedModel) formData.append('model', selectedModel)
        formData.append('runLlm', 'true')

        if (linkedinTab === 'url' && liveUrl.trim()) {
          formData.append('linkedinUrl', liveUrl.trim())
        } else if (activeProfileData) {
          formData.append('linkedinData', JSON.stringify(activeProfileData))
        }

        res = await fetch(`${API_BASE}/linkedin-agent/evaluate`, {
          method: 'POST',
          body: formData,
        })
      } else {
        const payload = {
          resumeText,
          targetRole,
          model: selectedModel || undefined,
          runLlm: true,
        }

        if (linkedinTab === 'url' && liveUrl.trim()) {
          payload.linkedinUrl = liveUrl.trim()
        } else if (activeProfileData) {
          payload.linkedinData = activeProfileData
        }

        res = await fetch(`${API_BASE}/linkedin-agent/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Evaluation failed.')
      }

      setResult(data)
      setLatencyMs(Date.now() - startTime)
    } catch (err) {
      console.error('LinkedIn evaluation error:', err)
      setErrorMsg(err.message || 'Error executing LinkedIn evaluation.')
    } finally {
      setLoading(false)
    }
  }

  const analysis = result?.analysis || null
  const optimizations =
    analysis?.optimizations ||
    analysis?.aiOptimizations ||
    result?.optimizations ||
    result?.aiOptimizations ||
    null
  const headlines = optimizations?.headlines || []
  const rawAbout = optimizations?.aboutRewrite || null
  const aboutIsString = typeof rawAbout === 'string'
  const hookText = safeText(rawAbout?.hook)
  const proofText = safeText(rawAbout?.proof)
  const ctaText = safeText(rawAbout?.callToAction)
  const fallbackFullText = safeText(rawAbout?.fullText)
  const fullAboutText = aboutIsString
    ? rawAbout
    : fallbackFullText || [hookText, proofText, ctaText].filter(Boolean).join('\n\n')
  const aboutWordCount = fullAboutText.trim()
    ? fullAboutText.trim().split(/\s+/).filter(Boolean).length
    : 0
  const aboutCharCount = fullAboutText.length

  const discrepancies = analysis?.discrepancies || result?.discrepancies || []
  const missingSkills = analysis?.missingSkills || result?.missingSkills || []
  const profileRedFlags = optimizations?.profileRedFlags || []

  return (
    <div className="min-h-screen bg-[#070b14] text-[#e2e8f0] p-4 sm:p-8 font-sans">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8 border-b border-gray-800/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <img
              src={brandLogo}
              alt="Crafture"
              className="w-7 h-7 rounded-lg object-cover border border-gray-700 shadow-sm"
            />
            <span className="text-xs uppercase tracking-widest font-mono text-[#0a66c2] font-bold flex items-center gap-1.5">
              <LinkedinLogo size={16} weight="fill" />
              CRAFTURE CAREER GPS • LINKEDIN AGENT TEST STUDIO V2.0
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            LinkedIn Profile Optimizer & Cross-Audit Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Live developer console to test recruiter SEO indexing, story-driven About rewrites,
            headline formulas, and Resume vs. LinkedIn discrepancy detection.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-3">
          <a
            href="/test-lab"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <Flask size={14} className="text-emerald-400" />
            <span>Resume Lab</span>
          </a>
          <a
            href="/report"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <Eye size={14} className="text-indigo-400" />
            <span>Report View</span>
          </a>
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold ${
              apifyConfigured
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                : 'bg-amber-950/60 text-amber-300 border-amber-800/70'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${apifyConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{apifyConfigured ? 'Apify Token: Active' : 'Apify: Fallback Mode'}</span>
          </span>
        </div>
      </div>

      {/* ── Error Banner ───────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="max-w-7xl mx-auto mb-6 p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
          <WarningCircle size={20} className="shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Evaluation Failed: </span>
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs text-red-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main 2-Column Test Studio Layout ───────────────────────────────── */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ═════════════════════════════════════════════════════════════════════
            LEFT COLUMN: Inputs & Controls (5 Cols)
           ═════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Target Role Card */}
          <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-sm space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Briefcase size={15} className="text-[#0a66c2]" />
                Target Engineering Role
              </span>
              <span className="text-[10px] text-gray-500 font-mono">Used for Recruiter SEO</span>
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full bg-[#070b14] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#0a66c2] transition-colors"
            />
            {/* Quick Preset Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ROLE_PRESETS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setTargetRole(role)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    targetRole === role
                      ? 'bg-[#0a66c2]/20 border-[#0a66c2] text-white font-semibold'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* 2. LinkedIn Profile Input (3 Tabs: Mock Preset, Live URL, Raw JSON) */}
          <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <LinkedinLogo size={16} className="text-[#0a66c2]" weight="fill" />
                LinkedIn Profile Source
              </label>
              <div className="flex rounded-lg bg-[#070b14] p-0.5 border border-gray-800 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setLinkedinTab('mock')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    linkedinTab === 'mock'
                      ? 'bg-[#0a66c2] text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Mock Preset
                </button>
                <button
                  type="button"
                  onClick={() => setLinkedinTab('url')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    linkedinTab === 'url'
                      ? 'bg-[#0a66c2] text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Live URL
                </button>
                <button
                  type="button"
                  onClick={() => setLinkedinTab('json')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    linkedinTab === 'json'
                      ? 'bg-[#0a66c2] text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Raw JSON
                </button>
              </div>
            </div>

            {/* Tab A: Mock Presets */}
            {linkedinTab === 'mock' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {Object.entries(MOCK_PRESETS).map(([key, preset]) => (
                    <div
                      key={key}
                      onClick={() => handleSelectMock(key)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        activeMockKey === key
                          ? 'bg-[#0a66c2]/10 border-[#0a66c2] text-white'
                          : 'bg-[#070b14] border-gray-800/80 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold mb-0.5">
                        <span className={activeMockKey === key ? 'text-white' : 'text-gray-300'}>
                          {preset.name}
                        </span>
                        {activeMockKey === key && (
                          <CheckCircle size={14} className="text-[#0a66c2]" weight="fill" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug">{preset.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab B: Live URL */}
            {linkedinTab === 'url' && (
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Globe size={16} />
                  </div>
                  <input
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/in/username"
                    className="w-full bg-[#070b14] border border-gray-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#0a66c2] transition-colors"
                  />
                </div>
                <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800 text-[11px] text-gray-400 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-300">
                    <Info size={14} className="text-[#0a66c2]" />
                    <span>Apify Cookieless Scraper</span>
                  </div>
                  <p className="text-gray-500">
                    If configured, Apify extracts public profile details. If the token is missing or
                    scraping fails, the studio gracefully falls back to resume-inferred optimization.
                  </p>
                </div>
              </div>
            )}

            {/* Tab C: Raw JSON Editor */}
            {linkedinTab === 'json' && (
              <div className="space-y-2">
                <textarea
                  rows={8}
                  value={rawJsonText}
                  onChange={(e) => setRawJsonText(e.target.value)}
                  className="w-full bg-[#070b14] border border-gray-800 rounded-xl p-3 text-[11px] font-mono text-gray-300 focus:outline-none focus:border-[#0a66c2] transition-colors"
                />
              </div>
            )}
          </div>

          {/* 3. Resume Input Card (Pre-loaded text + file upload) */}
          <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <FileText size={15} className="text-emerald-400" />
                Verified Resume Evidence
              </label>
              <div className="flex items-center gap-2">
                {resumeMode === 'file' && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300">
                    {resumeFile?.name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetResume}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Reset to Marcus Vance Tech Resume"
                >
                  <ArrowCounterClockwise size={13} />
                  <span>Reset Sample</span>
                </button>
              </div>
            </div>

            {/* Resume Text / File Area */}
            {resumeMode === 'sample' ? (
              <div className="relative">
                <textarea
                  rows={7}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="w-full bg-[#070b14] border border-gray-800 rounded-xl p-3 text-[11px] font-mono text-gray-300 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white cursor-pointer">
                    <UploadSimple size={14} className="text-emerald-400" />
                    <span>Or upload PDF/DOCX resume file</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#070b14] border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText size={20} className="text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-white">{resumeFile?.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {(resumeFile?.size / 1024).toFixed(1)} KB • Multipart Upload
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetResume}
                  className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* 4. AI Model Selection & Action Button */}
          <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Cpu size={15} className="text-indigo-400" />
                AI Model Engine
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#070b14] border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {models.length > 0 ? (
                  models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName || m.id} ({m.provider})
                    </option>
                  ))
                ) : (
                  <option value="">Default AI Model</option>
                )}
              </select>
            </div>

            {/* Run Button */}
            <button
              type="button"
              disabled={loading}
              onClick={handleRunEvaluation}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                loading
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  : 'bg-gradient-to-r from-[#0a66c2] to-indigo-600 hover:from-[#004182] hover:to-indigo-500 text-white shadow-indigo-900/30'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Auditing Profile & Synthesizing AI Optimizations...</span>
                </>
              ) : (
                <>
                  <Play size={16} weight="fill" />
                  <span>Run LinkedIn Evaluation & Cross-Audit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            RIGHT COLUMN: Live Results Studio (7 Cols)
           ═════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 space-y-6">
          {!result && !loading && (
            <div className="bg-[#0f172a] border border-dashed border-gray-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#0a66c2]/10 border border-[#0a66c2]/30 flex items-center justify-center mx-auto text-[#0a66c2]">
                <LinkedinLogo size={36} weight="fill" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Live Results Studio Ready</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Select a LinkedIn preset or live URL on the left and click{' '}
                  <span className="text-white font-medium">"Run LinkedIn Evaluation & Cross-Audit"</span>{' '}
                  to generate the 100-point recruiter scorecard and copy-ready optimizations.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap justify-center gap-2 text-[11px] text-gray-500">
                <span className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800">
                  🎯 3 Recruiter Headlines
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800">
                  📖 3-Paragraph About Rewrite
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800">
                  ⚠️ Cross-Platform Discrepancies
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800">
                  🏷️ Recruiter Skill Gaps
                </span>
              </div>
            </div>
          )}

          {loading && (
            <div className="bg-[#0f172a] border border-gray-800 rounded-3xl p-12 text-center space-y-6 animate-pulse">
              <div className="w-16 h-16 rounded-2xl bg-[#0a66c2]/20 border border-[#0a66c2]/40 flex items-center justify-center mx-auto text-[#0a66c2]">
                <Sparkle size={32} weight="fill" className="animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">Synthesizing Recruiter Strategy...</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Auditing recruiter search indexing, checking timeline alignment against resume facts,
                  and generating 3 headline strategies.
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0a66c2] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-6">
              {/* Status Header Bar */}
              <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-900 border border-gray-800 text-xs font-mono font-semibold text-emerald-400">
                    <Clock size={14} />
                    <span>{latencyMs ? `${latencyMs} ms` : 'Completed'}</span>
                  </span>
                  <span
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono font-semibold ${
                      result.inferredFromResume
                        ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                        : 'bg-sky-950/70 text-sky-300 border-sky-800'
                    }`}
                  >
                    <span>
                      {result.inferredFromResume ? 'Profile: Resume-Inferred' : 'Profile: Scraped / Provided'}
                    </span>
                  </span>
                </div>

                {/* View Tabs */}
                <div className="flex rounded-lg bg-[#070b14] p-0.5 border border-gray-800 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveViewTab('diagnosis')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      activeViewTab === 'diagnosis'
                        ? 'bg-[#0a66c2] text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Diagnosis & Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewTab('json')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      activeViewTab === 'json'
                        ? 'bg-[#0a66c2] text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>
              </div>

              {activeViewTab === 'diagnosis' && (
                <div className="space-y-6">
                  {/* 1. 100-Point Recruiter Rubric Scorecard */}
                  <ResumeScoreCard
                    dashboard={analysis}
                    candidateName={analysis?.profile?.fullName || 'Marcus Vance'}
                    variant="dark"
                    title="LinkedIn Recruiter Visibility Score"
                    scoreWord="LinkedIn profile"
                  />

                  {/* 2. Cross-Platform Discrepancy Alert Banner */}
                  {discrepancies.length > 0 && (
                    <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                        <WarningCircle size={18} weight="fill" />
                        <span>Cross-Platform Mismatch Detected</span>
                      </div>
                      <p className="text-xs text-amber-200/80">
                        Recruiters frequently cross-reference your resume against your LinkedIn profile.
                        The following discrepancies can trigger background-check flags or scrutiny:
                      </p>
                      <div className="space-y-2 pt-1">
                        {discrepancies.map((disc, idx) => (
                          <div
                            key={disc.id || idx}
                            className="p-3 rounded-xl bg-[#070b14]/80 border border-amber-500/20 text-xs space-y-1"
                          >
                            <div className="font-bold text-amber-300">{safeText(disc.title)}</div>
                            <div className="text-gray-300 text-[11px]">{safeText(disc.diagnosis)}</div>
                            {disc.recommendation && (
                              <div className="text-[11px] text-gray-400 italic">
                                Fix: {safeText(disc.recommendation)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Three AI Recruiter Headlines (1-Click Copy) */}
                  {headlines.length > 0 && (
                    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                            <Sparkle size={15} className="text-[#0a66c2]" weight="fill" />
                            Recruiter-Optimized Headlines (1-Click Copy)
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Select the formula matching your career strategy to test recruiter search indexing.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {headlines.map((hl, idx) => {
                          const isCopied = copiedId === `hl_${idx}`
                          const headlineText = typeof hl === 'string' ? hl : safeText(hl.headline || hl.text)
                          const whyItWorks = safeText(hl.whyItWorks)
                          const formulaLabel = safeText(hl.formula) || `Formula ${idx + 1}`

                          return (
                            <div
                              key={idx}
                              className="p-4 rounded-xl bg-[#070b14] border border-gray-800 hover:border-gray-700 transition-all space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#0a66c2]/10 border border-[#0a66c2]/30 text-[#0a66c2] font-bold">
                                  {formulaLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(headlineText, `hl_${idx}`)}
                                  className={`flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                    isCopied
                                      ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                                      : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                                  }`}
                                >
                                  {isCopied ? (
                                    <>
                                      <Check size={13} weight="bold" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={13} />
                                      <span>Copy Headline</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="text-xs font-bold text-white tracking-wide">
                                "{headlineText}"
                              </div>

                              {whyItWorks && (
                                <div className="text-[11px] text-gray-400 bg-gray-900/40 p-2.5 rounded-lg border border-gray-800/60 leading-relaxed">
                                  <span className="font-semibold text-gray-300">Why recruiters click: </span>
                                  <span>{whyItWorks}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4. Story-Driven 3-Paragraph About Section */}
                  {rawAbout && (
                    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                              <TextT size={15} className="text-[#0a66c2]" />
                              Story-Driven 3-Paragraph About Narrative
                            </h4>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-900 text-gray-400 border border-gray-800">
                              {aboutWordCount} words · {aboutCharCount} chars
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Hook → Quantified Proof from Resume → Call to Connect
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(fullAboutText, 'about_full')}
                          className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            copiedId === 'about_full'
                              ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}
                        >
                          {copiedId === 'about_full' ? (
                            <>
                              <Check size={13} weight="bold" />
                              <span>Copied Narrative!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy About Section</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-3">
                        {aboutIsString ? (
                          <div className="p-3.5 rounded-xl bg-[#070b14] border border-gray-800">
                            <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{rawAbout}</p>
                          </div>
                        ) : (
                          <>
                            {hookText && (
                              <div className="p-3.5 rounded-xl bg-[#070b14] border border-gray-800 space-y-1">
                                <div className="text-[10px] font-mono text-[#0a66c2] font-bold uppercase">
                                  Paragraph 1: The Hook (Identity & Specialty)
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{hookText}</p>
                              </div>
                            )}
                            {proofText && (
                              <div className="p-3.5 rounded-xl bg-[#070b14] border border-gray-800 space-y-1">
                                <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                                  Paragraph 2: Quantified Proof (Verified Resume Wins)
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{proofText}</p>
                              </div>
                            )}
                            {ctaText && (
                              <div className="p-3.5 rounded-xl bg-[#070b14] border border-gray-800 space-y-1">
                                <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase">
                                  Paragraph 3: Call to Connect (Vision & Next Role)
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                                  {ctaText}
                                </p>
                              </div>
                            )}
                            {!hookText && !proofText && !ctaText && fallbackFullText && (
                              <div className="p-3.5 rounded-xl bg-[#070b14] border border-gray-800">
                                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                                  {fallbackFullText}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. Missing Verified Skills from Resume */}
                  {missingSkills.length > 0 && (
                    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                          <Tag size={15} className="text-indigo-400" />
                          Recommended Skills to Add to LinkedIn
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Verified on your resume but missing from your LinkedIn skills section. Adding
                          these ensures recruiter boolean filters include your profile.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {missingSkills.map((skill, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-900 border border-gray-800 text-xs text-indigo-300 font-medium"
                          >
                            <Plus size={12} className="text-indigo-400" />
                            <span>{typeof skill === 'string' ? skill : safeText(skill?.skill || skill?.name || skill)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 6. Recruiter Profile Red Flags */}
                  {profileRedFlags.length > 0 && (
                    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                        <WarningCircle size={15} weight="fill" />
                        Recruiter Profile Warnings & Fixes
                      </h4>
                      <div className="space-y-2">
                        {profileRedFlags.map((flag, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[#070b14] border border-gray-800 text-xs space-y-1"
                          >
                            <div className="font-bold text-white">{safeText(flag.title)}</div>
                            <div className="text-[11px] text-gray-400">{safeText(flag.explanation)}</div>
                            {flag.fix && (
                              <div className="text-[11px] text-emerald-400 font-medium">
                                Immediate Fix: {safeText(flag.fix)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Raw JSON View */}
              {activeViewTab === 'json' && (
                <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-400">Complete API Output</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(result, null, 2), 'raw_json')}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
                    >
                      {copiedId === 'raw_json' ? (
                        <>
                          <Check size={12} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-[#070b14] border border-gray-800 text-[11px] font-mono text-gray-300 overflow-x-auto max-h-[600px] whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
