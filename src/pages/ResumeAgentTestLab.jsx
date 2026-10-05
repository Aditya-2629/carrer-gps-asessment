import React, { useState, useEffect } from 'react'
import {
  Flask,
  Play,
  GitDiff,
  Copy,
  Check,
  WarningCircle,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  ShieldCheck,
  Sparkle,
  Terminal,
  Sliders,
  Code,
  ListChecks,
  User,
  DownloadSimple,
  Eye,
  Info,
  ArrowRight,
  CaretRight,
  FileText,
} from '@phosphor-icons/react'
import ResumeScoreCard from '../components/report/ResumeScoreCard.jsx'
import ResumeBulletAudit from '../components/report/ResumeBulletAudit.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// High-fidelity synthetic test fixtures
const FIXTURE_STRONG = `Marcus Vance
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

TECHNICAL PROJECTS
Distributed Key-Value Store | Go, Raft Consensus, Docker
• Built distributed, fault-tolerant consensus engine implementing Raft leader election and log replication across 5 simulated nodes.
• Benchmarked cluster throughput achieving 12,000 writes/sec under randomized network partition simulations.

EDUCATION
B.S. in Computer Science | University of Washington | 2015 – 2019`

const FIXTURE_WEAK = `Jordan Miller
jordan.miller@example.com | (555) 789-0123 | Chicago, IL

SUMMARY
Hardworking software engineer looking to leverage my programming skills in a dynamic full stack development position. Responsible, detail-oriented team player with experience in multiple languages.

SKILLS
Java, C++, Python, HTML, CSS, JavaScript, React, MySQL, Git, Windows, Linux

EXPERIENCE
Software Developer | TechSolutions Inc. | Chicago, IL
June 2022 – Present
• Responsible for writing code for web applications using JavaScript and React.
• Assisted senior developers with backend bug fixing and routine database maintenance tasks.
• Worked with team members in daily agile standup meetings.
• Handled customer support tickets and investigated client issues in production.
• Built REST APIs and wrote documentation for team members.

Junior Web Developer | Apex Media Works | Chicago, IL
August 2021 – May 2022
• Created landing pages for clients using HTML, CSS, and basic JavaScript.
• Attended weekly project status meetings with project managers.
• Updated content and images on WordPress websites.
• Tested website links and browser compatibility across Chrome and Safari.

EDUCATION
B.A. in Information Systems | DePaul University | 2017 – 2021`

class TestLabErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('TestLabErrorBoundary caught error:', error, errorInfo)
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
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Test Lab Rendering Error</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                An error occurred while rendering the model evaluation output.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
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
            <div className="text-left">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-[11px] font-mono text-gray-500 hover:text-gray-300 underline cursor-pointer"
              >
                {this.state.showDetails ? 'Hide details' : 'Show details'}
              </button>
              {this.state.showDetails && (
                <pre className="mt-3 p-3 rounded-xl bg-black/60 border border-gray-800 text-[11px] font-mono text-red-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {this.state.error?.toString()}
                  {'\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              )}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function ResumeAgentTestLab() {
  return (
    <TestLabErrorBoundary>
      <ResumeAgentTestLabContent />
    </TestLabErrorBoundary>
  )
}

function ResumeAgentTestLabContent() {
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('openai/gpt-oss-120b')
  const [selectedCompareModels, setSelectedCompareModels] = useState([
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'gemini-3.6-flash',
  ])
  const [resumeText, setResumeText] = useState(FIXTURE_STRONG)
  const [targetRole, setTargetRole] = useState('Senior Full Stack & Cloud Systems Engineer')
  const [isSynthetic, setIsSynthetic] = useState(true)
  const [file, setFile] = useState(null)
  const [inputMode, setInputMode] = useState('compact_text') // 'compact_text' | 'canonical_json'

  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('single') // 'single' | 'compare'
  const [singleResult, setSingleResult] = useState(null)
  const [compareResult, setCompareResult] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  // Active view tab: 'human' | 'signals' | 'raw' | 'json' | 'prompt' | 'config' | 'telemetry'
  const [activeTab, setActiveTab] = useState('human')
  const [signalSubTab, setSignalSubTab] = useState('skills') // 'skills' | 'metrics' | 'timeline' | 'duplicates' | 'parser' | 'claims'

  // Prompt Modal state
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [promptModalTab, setPromptModalTab] = useState('system') // 'system' | 'user' | 'full'
  const [activePromptData, setActivePromptData] = useState(null)

  // Config Modal state
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [activeConfigData, setActiveConfigData] = useState(null)

  // Input Modal state (Section 18: [ VIEW LLM INPUT ])
  const [inputModalOpen, setInputModalOpen] = useState(false)
  const [activeInputData, setActiveInputData] = useState(null)

  // Compare active model for human inspection
  const [compareActiveModelIdx, setCompareActiveModelIdx] = useState(0)

  // Fetch candidate models on mount
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch(`${API_BASE}/resume-agent/test/models`)
        if (res.ok) {
          const data = await res.json()
          if (data.models && data.models.length > 0) {
            setModels(data.models)
            const defaultM = data.models.find((m) => m.id === 'openai/gpt-oss-120b') || data.models[0]
            setSelectedModel(defaultM.id)
            setSelectedCompareModels(
              data.models.filter((m) => ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'gemini-3.6-flash'].includes(m.id)).map((m) => m.id)
            )
          }
        }
      } catch (_e) {
        setModels([
          { id: 'openai/gpt-oss-120b', displayName: 'Groq GPT-OSS 120B (Primary)', provider: 'groq', configured: true },
          { id: 'openai/gpt-oss-20b', displayName: 'Groq GPT-OSS 20B (Fallback)', provider: 'groq', configured: true },
          { id: 'gemini-3.6-flash', displayName: 'Google Gemini 3.8 Flash', provider: 'gemini', configured: true },
        ])
      }
    }
    fetchModels()
  }, [])

  const copyToClipboard = (text, key) => {
    if (!text) return
    const textToCopy = typeof text === 'string' ? text : JSON.stringify(text, null, 2)
    navigator.clipboard.writeText(textToCopy)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2200)
  }

  const exportPromptToFile = (promptCapture, filename = 'resume-agent-prompt.txt') => {
    if (!promptCapture) return
    const content = `=== CAREER GPS RESUME AGENT PROMPT EXPORT ===\nVersion: ${promptCapture.version}\nCaptured: ${promptCapture.capturedAt}\n\n--- [SYSTEM PROMPT] ---\n${promptCapture.systemPrompt}\n\n--- [USER PROMPT] ---\n${promptCapture.userPrompt}\n`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  // Opens the polished /resume-report view for the current analysis
  const openFullReport = (result) => {
    const analysis = result?.parsedOutput
    if (!analysis) return
    const payload = {
      analysis,
      meta: {
        model: result.testRun?.actualModel || result.testRun?.requestedModel || result.model,
        analyzedAt: new Date().toISOString(),
      },
    }
    try {
      sessionStorage.setItem('craftureResumeReport', JSON.stringify(payload))
      window.open('/resume-report', '_blank')
    } catch (_e) {
      // sessionStorage full/unavailable — report page shows its empty state
    }
  }

  const handleRunSingle = async () => {
    setLoading(true)
    setErrorMsg(null)
    setMode('single')
    setSingleResult(null)
    setActiveTab('human')

    try {
      let res
      if (file) {
        const formData = new FormData()
        formData.append('resume', file)
        formData.append('targetRole', targetRole)
        formData.append('model', selectedModel)
        formData.append('inputMode', inputMode)
        formData.append('isSynthetic', String(isSynthetic))
        res = await fetch(`${API_BASE}/resume-agent/test/run`, {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await fetch(`${API_BASE}/resume-agent/test/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeText,
            targetRole,
            model: selectedModel,
            inputMode,
            isSynthetic,
          }),
        })
      }

      const data = await res.json()
      if (!res.ok && !data.rawModelOutput && !data.status) {
        setErrorMsg(data.error || 'Test run failed.')
      }
      setSingleResult(data)
    } catch (err) {
      setErrorMsg(err.message || 'Network error executing test run.')
    } finally {
      setLoading(false)
    }
  }

  const handleRunCompare = async () => {
    if (selectedCompareModels.length === 0) {
      setErrorMsg('Please select at least one model for comparison.')
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setMode('compare')
    setCompareResult(null)
    setCompareActiveModelIdx(0)
    setActiveTab('human')

    try {
      let res
      if (file) {
        const formData = new FormData()
        formData.append('resume', file)
        formData.append('targetRole', targetRole)
        formData.append('models', JSON.stringify(selectedCompareModels))
        formData.append('inputMode', inputMode)
        formData.append('isSynthetic', String(isSynthetic))
        res = await fetch(`${API_BASE}/resume-agent/test/compare`, {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await fetch(`${API_BASE}/resume-agent/test/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeText,
            targetRole,
            models: selectedCompareModels,
            inputMode,
            isSynthetic,
          }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Comparison run failed.')
      }
      setCompareResult(data)
    } catch (err) {
      setErrorMsg(err.message || 'Network error executing comparison.')
    } finally {
      setLoading(false)
    }
  }

  const toggleCompareModel = (id) => {
    setSelectedCompareModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  // Active result for the Inspector view (either single run or selected model from comparison)
  const currentInspectResult =
    mode === 'compare' && compareResult?.runs?.[compareActiveModelIdx]
      ? {
          ...compareResult.runs[compareActiveModelIdx],
          testRun: {
            runId: compareResult.comparisonRunId,
            requestedModel: compareResult.runs[compareActiveModelIdx].model,
            actualModel: compareResult.runs[compareActiveModelIdx].model,
            provider: compareResult.runs[compareActiveModelIdx].provider,
            promptVersion: 'resume-expert-v1',
            inputHash: compareResult.inputHash,
            targetRole,
            latencyMs: compareResult.runs[compareActiveModelIdx].latencyMs,
          },
        }
      : singleResult

  // Helper for rendering chip states
  const renderValidationChip = (label, state) => {
    let bg = 'bg-gray-800 text-gray-400 border-gray-700'
    let text = 'NOT EVALUATED'

    if (state === true || state === 'PASS') {
      bg = 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
      text = 'PASS'
    } else if (state === false || state === 'FAIL') {
      bg = 'bg-red-950/80 text-red-300 border-red-800'
      text = 'FAIL'
    } else if (state === 'BLOCKED') {
      bg = 'bg-amber-950/80 text-amber-300 border-amber-800'
      text = 'BLOCKED'
    }

    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold ${bg}`}>
        <span className="text-[10px] uppercase text-gray-400 font-sans tracking-wide">{label}:</span>
        <span>{text}</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-[#e2e8f0] p-4 sm:p-8 font-sans">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto mb-8 border-b border-gray-800/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flask size={22} weight="fill" className="text-emerald-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-emerald-400 font-bold">
              CAREER GPS • AI EVALUATION CONSOLE V1.2
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Resume Specialist Agent Test Lab
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Human-Readable Evaluation • Exact Runtime Prompt Inspection • Zero-Fallback Benchmark Isolation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs bg-gray-900 hover:bg-gray-800 border border-gray-800 px-3.5 py-2 rounded-lg text-gray-300 font-medium transition-colors"
          >
            ← Back to App
          </a>
          <span className="text-[11px] font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 px-3 py-1.5 rounded-lg font-bold">
            NODE_ENV: {import.meta.env.MODE || 'development'}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Test Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders size={18} className="text-indigo-400" /> Test Inputs & Setup
              </h2>
              <span className="text-[11px] font-mono text-gray-400">Isolated Benchmark Mode</span>
            </div>

            {/* Quick Fixtures */}
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 tracking-wider block mb-2">
                Load Fixture
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResumeText(FIXTURE_STRONG)
                    setTargetRole('Senior Full Stack & Cloud Systems Engineer')
                    setIsSynthetic(true)
                    setFile(null)
                  }}
                  className={`text-xs px-3 py-2 rounded-xl border text-left transition-all ${
                    resumeText === FIXTURE_STRONG && !file
                      ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 font-semibold'
                      : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkle size={14} className="text-indigo-400" /> Strong Senior (Marcus)
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Go, Kafka, AWS, Metrics</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResumeText(FIXTURE_WEAK)
                    setTargetRole('Junior Software Developer')
                    setIsSynthetic(true)
                    setFile(null)
                  }}
                  className={`text-xs px-3 py-2 rounded-xl border text-left transition-all ${
                    resumeText === FIXTURE_WEAK && !file
                      ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 font-semibold'
                      : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <WarningCircle size={14} className="text-amber-400" /> Junior General (Jordan)
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">No metrics, passive tone</div>
                </button>
              </div>
            </div>

            {/* Target Role Input */}
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 tracking-wider block mb-1.5">
                Target Role
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Full Stack Engineer"
                className="w-full bg-[#070b14] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Document Upload or Text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                  Resume Content
                </label>
                <span className="text-[10px] text-gray-500 font-mono">
                  {file ? file.name : `${resumeText.length} chars`}
                </span>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={8}
                  disabled={Boolean(file)}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste raw resume text here..."
                  className="w-full bg-[#070b14] border border-gray-800 rounded-xl p-3 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                />

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <span className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg hover:border-gray-700">
                      {file ? 'Change File' : 'Upload PDF / DOCX'}
                    </span>
                  </label>
                  {file && (
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Clear File
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Synthetic Data Guard */}
            <div className="bg-[#070b14] border border-gray-800/80 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-400" />
                <div>
                  <div className="text-xs font-bold text-white">Synthetic / Anonymized Data</div>
                  <div className="text-[10px] text-gray-400">Protects real candidate privacy during testing</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isSynthetic}
                onChange={(e) => setIsSynthetic(e.target.checked)}
                className="accent-emerald-500 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Single Model Selector */}
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 tracking-wider block mb-1.5">
                Model for Single Test
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#070b14] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName || m.id} ({m.provider}) {m.configured ? '✓' : '(No Key)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Representation Mode (Compact Text vs Canonical JSON) */}
            <div className="pt-2">
              <label className="text-xs uppercase font-bold text-gray-400 tracking-wider block mb-2 flex items-center justify-between">
                <span>Input Representation</span>
                <span className="text-[10px] text-emerald-400 font-normal">A/B Testing</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode('compact_text')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                    inputMode === 'compact_text'
                      ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-sm shadow-indigo-900/40'
                      : 'bg-[#070b14] border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                  }`}
                >
                  <span className="font-bold">Compact Text</span>
                  <span className="text-[10px] text-emerald-400 font-mono mt-0.5">Default (v1.4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMode('canonical_json')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                    inputMode === 'canonical_json'
                      ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-sm shadow-indigo-900/40'
                      : 'bg-[#070b14] border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                  }`}
                >
                  <span className="font-bold">Canonical JSON</span>
                  <span className="text-[10px] text-gray-400 font-mono mt-0.5">Baseline (v1.2)</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleRunSingle}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-indigo-950/40 cursor-pointer"
              >
                <Play size={16} weight="fill" />
                {loading && mode === 'single' ? 'Running Model...' : 'Run Single Model'}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleRunCompare}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                <GitDiff size={16} weight="bold" />
                {loading && mode === 'compare' ? 'Comparing Models...' : 'Compare 3 Models'}
              </button>
            </div>

            {/* Models Checked For Comparison */}
            <div className="pt-3 border-t border-gray-800/80">
              <label className="text-xs uppercase font-bold text-gray-400 tracking-wider block mb-2">
                Models Included in Comparison
              </label>
              <div className="space-y-2">
                {models.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2.5 text-xs text-gray-300 font-mono hover:text-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompareModels.includes(m.id)}
                      onChange={() => toggleCompareModel(m.id)}
                      className="accent-emerald-500 rounded w-3.5 h-3.5"
                    />
                    <span className="truncate">{m.id}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Evaluation Console (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {errorMsg && (
            <div className="bg-red-950/60 border border-red-800 text-red-300 p-4 rounded-2xl text-xs flex items-start gap-3 shadow-lg">
              <XCircle size={18} className="shrink-0 mt-0.5 text-red-400" />
              <div>
                <div className="font-bold">Execution Notice</div>
                <div>{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="bg-[#0f172a] border border-gray-800 rounded-2xl p-12 text-center text-gray-400 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mx-auto" />
              <div className="text-sm font-semibold text-white">
                {mode === 'single' ? `Executing ${selectedModel}...` : 'Running multi-model benchmark sequence...'}
              </div>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Validating output without automatic retries. Raw outputs and exact prompts will be captured upon completion.
              </p>
            </div>
          )}

          {/* Mode 2: Multi-Model Comparison Header Cards */}
          {compareResult && !loading && (
            <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <GitDiff size={20} className="text-emerald-400" />
                    Multi-Model Comparison Suite
                  </h3>
                  <div className="text-xs text-gray-400 mt-1">
                    Input Hash: <span className="font-mono text-indigo-300">{compareResult.inputHash}</span> (Normalized Exactly Once)
                  </div>
                </div>
                <span className="text-xs font-mono bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg text-gray-300">
                  {compareResult.runs?.length} Models Tested
                </span>
              </div>

              {/* Model Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {compareResult.runs?.map((run, idx) => {
                  const isSelected = compareActiveModelIdx === idx
                  return (
                    <div
                      key={run.model}
                      onClick={() => setCompareActiveModelIdx(idx)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/50'
                          : 'bg-[#070b14] border-gray-800/80 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-mono uppercase text-gray-400 font-bold">
                          {run.provider}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            run.status === 'success'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                              : run.status === 'provider_failure'
                              ? 'bg-red-950 text-red-400 border border-red-800/60'
                              : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-white font-mono truncate" title={run.model}>
                        {run.model.split('/').pop()}
                      </div>

                      <div className="text-[11px] text-gray-400 font-mono mt-1 flex items-center gap-1">
                        <Clock size={12} /> {run.latencyMs}ms
                      </div>

                      {/* Mini Action Links */}
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-gray-800/60 text-[10px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCompareActiveModelIdx(idx)
                            setActiveTab('human')
                          }}
                          className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-200"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveInputData({
                              inputSerializerVersion: run.inputSerializerVersion || 'compact-resume-v1',
                              inputMode: run.inputMode || 'compact_text',
                              canonicalInputHash: run.canonicalInputHash,
                              llmInputHash: run.llmInputHash,
                              canonicalInputCharacters: run.canonicalInputCharacters,
                              compactInputCharacters: run.compactInputCharacters,
                              canonicalEstimatedTokens: run.canonicalEstimatedTokens,
                              compactEstimatedTokens: run.compactEstimatedTokens,
                              inputSizeReductionPercent: run.inputSizeReductionPercent,
                              llmInput: run.llmInput || run.promptCapture?.llmInput || run.promptCapture?.userPrompt,
                            })
                            setInputModalOpen(true)
                          }}
                          className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-emerald-300"
                        >
                          Input
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActivePromptData(run.promptCapture)
                            setPromptModalOpen(true)
                          }}
                          className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-indigo-300"
                        >
                          Prompt
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(run.reviewExport?.text, `cmp_pkg_${run.model}`)
                          }}
                          className="bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 px-2 py-1 rounded font-bold"
                        >
                          {copiedKey === `cmp_pkg_${run.model}` ? 'Copied!' : 'Package'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Active Result Console View */}
          {currentInspectResult && !loading && (
            <div className="space-y-6">
              {/* TOP RESULT SUMMARY BAR */}
              <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <div className="text-[11px] font-mono text-gray-400 flex flex-wrap items-center gap-2">
                      <span>RUN: {currentInspectResult.testRun?.runId || 'N/A'}</span>
                      <span>•</span>
                      <span>HASH: {currentInspectResult.testRun?.inputHash || 'N/A'}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">{currentInspectResult.testRun?.promptVersion || 'resume-expert-v1'}</span>
                      <span>•</span>
                      <span className="text-indigo-400 font-semibold">{currentInspectResult.testRun?.inputSerializerVersion || 'compact-resume-v1'}</span>
                      <span>•</span>
                      <span className="text-amber-300 uppercase font-bold">{currentInspectResult.testRun?.inputMode || 'compact_text'}</span>
                      {currentInspectResult.testRun?.inputSizeReductionPercent != null && (
                        <React.Fragment key="input-size-reduction">
                          <span>•</span>
                          <span className="text-emerald-300 font-bold">-{currentInspectResult.testRun.inputSizeReductionPercent}% size</span>
                        </React.Fragment>
                      )}
                    </div>

                    <div className="text-xl font-extrabold text-white flex items-center gap-2 mt-1">
                      <Cpu size={22} className="text-indigo-400" />
                      <span>{currentInspectResult.testRun?.actualModel || currentInspectResult.testRun?.requestedModel || currentInspectResult.model}</span>
                      <span className="text-xs font-mono font-normal uppercase bg-gray-900 border border-gray-800 px-2.5 py-0.5 rounded text-gray-400">
                        {currentInspectResult.testRun?.provider || currentInspectResult.provider}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                      <div className="flex items-center gap-1.5 bg-[#070b14] px-3 py-1.5 rounded-lg border border-gray-800 text-gray-300">
                        <Clock size={16} className="text-indigo-400" />
                        <span>{currentInspectResult.testRun?.latencyMs || currentInspectResult.latencyMs || 0}ms</span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-[#070b14] px-3 py-1.5 rounded-lg border border-gray-800 text-gray-300 font-mono text-[11px]">
                        <span className="text-gray-500 font-sans uppercase font-bold text-[10px]">Finish:</span>
                        <span className={`font-bold ${
                          (currentInspectResult.finishReason || currentInspectResult.metadata?.finishReason) === 'length'
                            ? 'text-orange-400'
                            : 'text-emerald-400'
                        }`}>
                          {currentInspectResult.finishReason || currentInspectResult.metadata?.finishReason || 'stop'}
                        </span>
                      </div>

                      {(() => {
                        const classification =
                          currentInspectResult.classification ||
                          (currentInspectResult.status === 'success'
                            ? 'SUCCESS'
                            : currentInspectResult.status === 'provider_failure'
                            ? 'PROVIDER_ERROR'
                            : currentInspectResult.status === 'model_output_incomplete'
                            ? 'MODEL_OUTPUT_INCOMPLETE'
                            : currentInspectResult.status === 'model_output_invalid'
                            ? 'INVALID_JSON'
                            : currentInspectResult.status?.toUpperCase() || 'UNKNOWN')

                        const badgeStyles = {
                          SUCCESS: 'bg-emerald-950/80 border-emerald-800 text-emerald-300',
                          UNSUPPORTED_CLAIM_WARNING: 'bg-amber-950/80 border-amber-800 text-amber-300',
                          MODEL_OUTPUT_INCOMPLETE: 'bg-orange-950/80 border-orange-800 text-orange-300',
                          INVALID_JSON: 'bg-red-950/80 border-red-800 text-red-300',
                          SCHEMA_VALIDATION_ERROR: 'bg-red-950/80 border-red-800 text-red-300',
                          EVIDENCE_VALIDATION_ERROR: 'bg-rose-950/80 border-rose-800 text-rose-300',
                          PROVIDER_ERROR: 'bg-red-950/80 border-red-800 text-red-300',
                        }

                        const style = badgeStyles[classification] || 'bg-gray-900 border-gray-700 text-gray-300'

                        return (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold uppercase text-xs ${style}`}>
                            {classification === 'SUCCESS' ? (
                              <CheckCircle size={16} weight="fill" />
                            ) : classification === 'UNSUPPORTED_CLAIM_WARNING' || classification === 'MODEL_OUTPUT_INCOMPLETE' ? (
                              <WarningCircle size={16} weight="fill" />
                            ) : (
                              <XCircle size={16} weight="fill" />
                            )}
                            <span>{classification.replace(/_/g, ' ')}</span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                {/* Validation Status Chips (Semantic PASS / FAIL / NOT EVALUATED) */}
                <div className="flex flex-wrap items-center gap-2">
                  {renderValidationChip('JSON', currentInspectResult.validation?.jsonValid)}
                  {renderValidationChip('Schema', currentInspectResult.validation?.schemaValid)}
                  {renderValidationChip('Evidence', currentInspectResult.validation?.evidenceValid)}
                  {renderValidationChip('Fabrication', currentInspectResult.validation?.fabricationDetected === false ? 'PASS' : currentInspectResult.validation?.fabricationDetected === true ? 'FAIL' : null)}
                </div>

                {/* Top Action Buttons (View Prompt, View Config, View LLM Input, Copy Review Package) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePromptData(currentInspectResult.promptCapture)
                        setPromptModalOpen(true)
                      }}
                      className="text-xs bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-950/40 cursor-pointer"
                    >
                      <Eye size={16} weight="bold" />
                      VIEW PROMPT
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveInputData({
                          inputSerializerVersion: currentInspectResult.inputSerializerVersion || currentInspectResult.testRun?.inputSerializerVersion || 'compact-resume-v1',
                          inputMode: currentInspectResult.inputMode || currentInspectResult.testRun?.inputMode || 'compact_text',
                          canonicalInputHash: currentInspectResult.canonicalInputHash || currentInspectResult.testRun?.canonicalInputHash || currentInspectResult.testRun?.inputHash,
                          llmInputHash: currentInspectResult.llmInputHash || currentInspectResult.testRun?.llmInputHash || currentInspectResult.testRun?.inputHash,
                          canonicalInputCharacters: currentInspectResult.canonicalInputCharacters || currentInspectResult.testRun?.canonicalInputCharacters || currentInspectResult.inputSummary?.canonicalInputCharacters,
                          compactInputCharacters: currentInspectResult.compactInputCharacters || currentInspectResult.testRun?.compactInputCharacters || currentInspectResult.inputSummary?.compactInputCharacters,
                          canonicalEstimatedTokens: currentInspectResult.canonicalEstimatedTokens || currentInspectResult.testRun?.canonicalEstimatedTokens,
                          compactEstimatedTokens: currentInspectResult.compactEstimatedTokens || currentInspectResult.testRun?.compactEstimatedTokens,
                          inputSizeReductionPercent: currentInspectResult.inputSizeReductionPercent ?? currentInspectResult.testRun?.inputSizeReductionPercent,
                          sectionCounts: currentInspectResult.inputSummary?.sectionCounts || currentInspectResult.testRun?.sectionCounts || null,
                          llmInput: currentInspectResult.llmInput || currentInspectResult.promptCapture?.llmInput || currentInspectResult.promptCapture?.compactText || currentInspectResult.promptCapture?.userPrompt,
                        })
                        setInputModalOpen(true)
                      }}
                      className="text-xs bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-600/50 shadow-md shadow-emerald-950/30"
                    >
                      <FileText size={16} weight="bold" />
                      VIEW LLM INPUT
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveConfigData(currentInspectResult.configSnapshot)
                        setConfigModalOpen(true)
                      }}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-700"
                    >
                      <Sliders size={16} />
                      VIEW CONFIG
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openFullReport(currentInspectResult)}
                    className="text-xs bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-700/60 text-indigo-200 font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowRight size={16} weight="bold" />
                    OPEN FULL REPORT
                  </button>

                  {currentInspectResult.reviewExport && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(currentInspectResult.reviewExport.text, 'active_review_pkg')}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
                    >
                      {copiedKey === 'active_review_pkg' ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
                      {copiedKey === 'active_review_pkg' ? 'COPIED TO CLIPBOARD!' : 'COPY REVIEW PACKAGE'}
                    </button>
                  )}
                </div>
              </div>

              {/* NAVIGATION TABS */}
              <div className="flex items-center gap-2 border-b border-gray-800 pb-1 text-xs font-semibold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('human')}
                  className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
                    activeTab === 'human'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <User size={16} />
                  Human Review (Default)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('signals')}
                  className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
                    activeTab === 'signals'
                      ? 'bg-[#0f172a] text-white border-t-2 border-emerald-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Flask size={16} className="text-emerald-400" />
                  Resume Signals (V2.3)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('raw')}
                  className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
                    activeTab === 'raw'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Terminal size={16} />
                  Raw Output
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('json')}
                  className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
                    activeTab === 'json'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Code size={16} />
                  Parsed JSON
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('prompt')}
                  className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
                    activeTab === 'prompt'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText size={16} />
                  Exact Prompt
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('telemetry')}
                  className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
                    activeTab === 'telemetry'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Clock size={16} />
                  Telemetry
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('config')}
                  className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
                    activeTab === 'config'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Sliders size={16} />
                  Config Snapshot
                </button>
              </div>

              {/* TAB 1: HUMAN REVIEW VIEW */}
              {activeTab === 'human' && (
                <div className="space-y-6">
                  {/* Provider Failure Alert if model never responded */}
                  {currentInspectResult.status === 'provider_failure' && (
                    <div className="bg-red-950/40 border border-red-800 rounded-2xl p-6 space-y-3">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                        <XCircle size={22} weight="fill" />
                        PROVIDER GENERATION FAILURE
                      </div>
                      <p className="text-xs text-red-200">
                        The provider could not fulfill this request. No raw output was produced, and downstream schema or evidence evaluations were not executed.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-2">
                        <div className="bg-[#070b14] p-2 rounded-lg border border-red-900/50">
                          <span className="text-gray-500 block text-[10px]">Error Code</span>
                          <span className="text-red-300 font-bold">{currentInspectResult.error?.type || 'UNKNOWN'}</span>
                        </div>
                        <div className="bg-[#070b14] p-2 rounded-lg border border-red-900/50">
                          <span className="text-gray-500 block text-[10px]">HTTP Status</span>
                          <span className="text-red-300 font-bold">{currentInspectResult.error?.httpStatus || 500}</span>
                        </div>
                        <div className="bg-[#070b14] p-2 rounded-lg border border-red-900/50 col-span-2">
                          <span className="text-gray-500 block text-[10px]">Message</span>
                          <span className="text-red-300 truncate block">{currentInspectResult.error?.message}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* V3.1 Scorecard — instant verdict (deterministic, no LLM) */}
                  {currentInspectResult.parsedOutput?.dashboard && (
                    <ResumeScoreCard
                      dashboard={currentInspectResult.parsedOutput.dashboard}
                      candidateName={currentInspectResult.parsedOutput?.candidateSnapshot?.name}
                    />
                  )}

                  {/* Candidate Snapshot Card */}
                  {currentInspectResult.parsedOutput?.candidateSnapshot && (
                    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <User size={16} className="text-indigo-400" />
                        Candidate Snapshot
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Target Role</div>
                          <div className="text-xs font-bold text-white mt-0.5">
                            {currentInspectResult.parsedOutput.candidateSnapshot.targetRole || 'Senior Engineer'}
                          </div>
                        </div>

                        <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Experience Level</div>
                          <div className="text-xs font-bold text-white mt-0.5">
                            {currentInspectResult.parsedOutput.candidateSnapshot.experienceLevel || 'Senior'}
                          </div>
                        </div>

                        <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Primary Profile</div>
                          <div className="text-xs font-bold text-white mt-0.5">
                            {currentInspectResult.parsedOutput.candidateSnapshot.primaryProfile || 'Full Stack'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Overall Review Narrative */}
                  {currentInspectResult.parsedOutput?.overallReview && (
                    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-6 shadow-xl space-y-3">
                      <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <Sparkle size={16} weight="fill" />
                        Recruiter Overall Review
                      </h3>
                      <div className="text-sm text-gray-200 leading-relaxed space-y-3 whitespace-pre-line font-sans">
                        {typeof currentInspectResult.parsedOutput.overallReview === 'string'
                          ? currentInspectResult.parsedOutput.overallReview
                          : currentInspectResult.parsedOutput.overallReview?.summary ||
                            (typeof currentInspectResult.parsedOutput.overallReview === 'object'
                              ? JSON.stringify(currentInspectResult.parsedOutput.overallReview, null, 2)
                              : '')}
                      </div>
                    </div>
                  )}

                  {/* Strengths Section */}
                  {currentInspectResult.parsedOutput?.strengths && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle size={16} className="text-emerald-400" />
                        Key Candidate Strengths ({currentInspectResult.parsedOutput.strengths.filter(Boolean).length})
                      </h3>

                      <div className="grid grid-cols-1 gap-3">
                        {currentInspectResult.parsedOutput.strengths
                          .filter((s) => s && typeof s === 'object')
                          .map((str, idx) => {
                            const firstEv = Array.isArray(str.evidence) ? str.evidence[0] : str.evidence
                            const evId = firstEv?.bulletId || firstEv?.itemId || (Array.isArray(str.evidence) ? str.evidence.map(e => e?.bulletId).filter(Boolean).join(', ') : '') || str.id
                            const evText = typeof str.evidence === 'string'
                              ? str.evidence
                              : Array.isArray(str.evidence)
                              ? str.evidence.map(e => (typeof e === 'string' ? e : e?.originalText)).filter(Boolean).join(' ')
                              : str.evidence?.originalText || ''

                            return (
                              <div
                                key={str.id ? `strength_${str.id}` : `strength_${idx}`}
                                className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center text-xs font-mono">
                                        {idx + 1}
                                      </span>
                                      {typeof str.title === 'string' ? str.title : (str.title?.text || 'Strength')}
                                    </div>
                                    <p className="text-xs text-gray-300 mt-1">
                                      {typeof (str.signal || str.description) === 'string'
                                        ? (str.signal || str.description)
                                        : (str.description?.text || str.signal?.text || '')}
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-mono bg-gray-900 border border-gray-800 px-2.5 py-1 rounded text-gray-400 shrink-0">
                                    ID: {evId}
                                  </span>
                                </div>

                                {evText && (
                                  <div className="bg-[#070b14] border border-gray-800/80 rounded-xl p-3 text-xs">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                                      Source Evidence:
                                    </div>
                                    <div className="text-gray-300 italic font-mono text-[11px]">
                                      &ldquo;{evText}&rdquo;
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* V3.1 Line-by-Line Bullet Audit (before → after) */}
                  {currentInspectResult.parsedOutput?.dashboard?.bulletAudit?.length > 0 && (
                    <ResumeBulletAudit bulletAudit={currentInspectResult.parsedOutput.dashboard.bulletAudit} />
                  )}

                  {/* Issues Section (Clear 4-Part Evidence Visualization + Warnings) */}
                  {currentInspectResult.parsedOutput?.issues && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <WarningCircle size={16} className="text-amber-400" />
                          Identified Issues & Recruiter Recommendations ({currentInspectResult.parsedOutput.issues.filter(Boolean).length})
                        </h3>
                        <span className="text-[11px] text-gray-500">Separating Source vs Diagnosis vs Rewrite</span>
                      </div>

                      <div className="space-y-4">
                        {currentInspectResult.parsedOutput.issues
                          .filter((iss) => iss && typeof iss === 'object')
                          .map((iss, idx) => {
                            // Find any validation warnings relevant to this issue or bulletId
                            const relatedWarnings = (currentInspectResult.validation?.warnings || []).filter(
                              (w) =>
                                (iss.evidence?.bulletId && w.includes(iss.evidence.bulletId)) ||
                                (iss.evidence?.itemId && w.includes(iss.evidence.itemId)) ||
                                (iss.id && w.includes(iss.id))
                            )

                            return (
                              <div
                                key={iss.id ? `issue_${iss.id}` : `issue_${idx}`}
                                className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-4"
                              >
                                {/* Issue Header Badges */}
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border ${
                                        iss.severity === 'high'
                                          ? 'bg-red-950/80 border-red-800 text-red-300'
                                          : iss.severity === 'medium'
                                          ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                                          : 'bg-blue-950/80 border-blue-800 text-blue-300'
                                      }`}
                                    >
                                      {iss.severity} Priority
                                    </span>
                                    <span className="text-[10px] font-mono uppercase bg-gray-900 border border-gray-800 px-2 py-1 rounded text-gray-400">
                                      {iss.category || 'General'}
                                    </span>
                                    <span className="text-sm font-bold text-white">{iss.title}</span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400">
                                    {iss.confidence && (
                                      <span>Confidence: {(iss.confidence * 100).toFixed(0)}%</span>
                                    )}
                                    <span>•</span>
                                    <span className="capitalize">{iss.correctionType || 'rewrite'}</span>
                                  </div>
                                </div>

                                {/* Validation Warning Callout inside Card if flagged */}
                                {relatedWarnings.length > 0 && (
                                  <div className="bg-amber-950/60 border border-amber-700/80 rounded-xl p-3 text-xs text-amber-200 space-y-1">
                                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                                      <WarningCircle size={15} weight="fill" /> Validation Warning Flagged
                                    </div>
                                    {relatedWarnings.map((w, wIdx) => (
                                      <div key={`iss_warn_${idx}_${wIdx}`} className="font-mono text-[11px]">
                                        {w}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* PART 1: SOURCE EVIDENCE */}
                                <div className="bg-[#070b14] border border-gray-800/80 rounded-xl p-3.5 space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                                    <span>1. Source Evidence</span>
                                    <span className="font-mono text-indigo-400">
                                      {(Array.isArray(iss.evidence) ? iss.evidence[0]?.section : iss.evidence?.section) || 'section'} • {(Array.isArray(iss.evidence) ? iss.evidence[0]?.itemId : iss.evidence?.itemId) || 'item'} • {(Array.isArray(iss.evidence) ? iss.evidence.map(e => e?.bulletId).filter(Boolean).join(', ') : iss.evidence?.bulletId) || 'no-bullet'}
                                    </span>
                                  </div>
                                  <div className="text-xs font-mono text-gray-300 bg-gray-950 p-2.5 rounded-lg border border-gray-900 whitespace-pre-wrap">
                                    &ldquo;{typeof iss.evidence === 'string'
                                      ? iss.evidence
                                      : Array.isArray(iss.evidence)
                                      ? iss.evidence.map(e => (typeof e === 'string' ? e : e?.originalText)).filter(Boolean).join(' ')
                                      : iss.evidence?.originalText || '(No original text provided)'}&rdquo;
                                  </div>
                                </div>

                                {/* PART 2: MODEL DIAGNOSIS */}
                                <div className="space-y-1">
                                  <div className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">
                                    2. Model Diagnosis
                                  </div>
                                  <p className="text-xs text-gray-200 leading-relaxed">{iss.diagnosis}</p>
                                </div>

                                {/* PART 3: WHY IT MATTERS */}
                                {iss.whyItMatters && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                                      Why It Matters to a Hiring Manager
                                    </div>
                                    <p className="text-xs text-gray-300 leading-relaxed">{iss.whyItMatters}</p>
                                  </div>
                                )}

                                {/* PART 4: RECOMMENDATION */}
                                <div className="space-y-1">
                                  <div className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">
                                    3. Recruiter Recommendation
                                  </div>
                                  <p className="text-xs text-gray-200 leading-relaxed">{iss.recommendation}</p>
                                </div>

                                {/* PART 5: CORRECTED TEXT (IF AVAILABLE) */}
                                {iss.correctedText && (
                                  <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-xl p-3.5 space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-emerald-400 tracking-wider">
                                      <span>4. Actionable Rewrite / Corrected Text</span>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(iss.correctedText, `rewrite_${iss.id}`)}
                                        className="text-[10px] bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                                      >
                                        {copiedKey === `rewrite_${iss.id}` ? <Check size={12} /> : <Copy size={12} />}
                                        Copy Rewrite
                                      </button>
                                    </div>
                                    <div className="text-xs font-mono text-emerald-200 bg-[#070b14] p-3 rounded-lg border border-emerald-900/50 whitespace-pre-wrap">
                                      {iss.correctedText}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Priority Actions */}
                  {currentInspectResult.parsedOutput?.priorityActions && (
                    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <ListChecks size={18} className="text-indigo-400" />
                        Priority Action Checklist
                      </h3>

                      <div className="space-y-2">
                        {currentInspectResult.parsedOutput.priorityActions.map((act, actIdx) => (
                          <div
                            key={act.order ?? actIdx}
                            className="bg-[#070b14] border border-gray-800/80 rounded-xl p-3.5 flex items-start gap-3"
                          >
                            <span className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {act.order}
                            </span>
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white">{act.title}</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                                    act.impact === 'High'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : 'bg-gray-800 text-gray-300'
                                  }`}
                                >
                                  {act.impact} Impact
                                </span>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed">{act.action}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: RESUME SIGNALS (V2.3 DETERMINISTIC ENGINE) */}
              {activeTab === 'signals' && (() => {
                const signals = currentInspectResult.signals || currentInspectResult.promptCapture?.signals
                if (!signals) {
                  return (
                    <div className="bg-[#0f172a] border border-gray-800 rounded-2xl p-8 text-center text-gray-400 space-y-2">
                      <div className="text-sm font-bold text-gray-200">No Deterministic Signals Captured</div>
                      <p className="text-xs text-gray-500">Run a test evaluation to generate deterministic resume signals.</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-6">
                    {/* Signal Sub-tabs Header */}
                    <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Flask size={20} className="text-emerald-400" />
                        <div>
                          <h3 className="text-sm font-bold text-white">Deterministic Signal Engine V{signals.version || '1.0'}</h3>
                          <p className="text-[11px] text-gray-400">Pre-LLM deterministic observations • Objective evidence for recruiter reasoning</p>
                        </div>
                      </div>

                      {/* Sub-tab Navigation */}
                      <div className="flex flex-wrap items-center gap-1.5 bg-[#070b14] p-1.5 rounded-xl border border-gray-800 text-xs">
                        {[
                          { id: 'skills', label: 'Skills', count: signals.skills?.skills?.length || 0 },
                          { id: 'metrics', label: 'Metrics', count: signals.metrics?.metrics?.length || 0 },
                          { id: 'timeline', label: 'Timeline', count: signals.timeline?.overlaps?.length ? `${signals.timeline.overlaps.length} Overlaps` : 'Normal' },
                          { id: 'duplicates', label: 'Duplicates', count: signals.duplicates?.duplicates?.length || 0 },
                          { id: 'parser', label: 'Parser Quality', count: signals.parserQuality?.warnings?.length || 0 },
                          { id: 'claims', label: 'Claims', count: signals.claimEvidence?.claims?.length || 0 },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSignalSubTab(tab.id)}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                              signalSubTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono text-gray-300">
                              {tab.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SUB-TAB 1: SKILLS */}
                    {signalSubTab === 'skills' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-[#0f172a] border border-gray-800 p-4 rounded-xl">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Total Listed Skills</span>
                            <div className="text-xl font-bold text-white mt-1 font-mono">{signals.skills?.summary?.totalListed || 0}</div>
                          </div>
                          <div className="bg-[#0f172a] border border-emerald-900/40 p-4 rounded-xl">
                            <span className="text-[10px] text-emerald-400 uppercase font-bold">With Verifiable Evidence</span>
                            <div className="text-xl font-bold text-emerald-300 mt-1 font-mono">{signals.skills?.summary?.withEvidence || 0}</div>
                          </div>
                          <div className="bg-[#0f172a] border border-amber-900/40 p-4 rounded-xl">
                            <span className="text-[10px] text-amber-400 uppercase font-bold">Skill Evidence Gaps</span>
                            <div className="text-xl font-bold text-amber-300 mt-1 font-mono">{signals.skills?.summary?.evidenceGaps || 0}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(signals.skills?.skills || []).map((sk, idx) => (
                            <div
                              key={`skill_${sk.skill}_${idx}`}
                              className="bg-[#0f172a] border border-gray-800/90 rounded-xl p-4 space-y-2 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-white font-mono">{sk.skill}</span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${
                                    sk.status === 'evidenceFound'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/70'
                                      : 'bg-amber-950 text-amber-300 border border-amber-800/70'
                                  }`}
                                >
                                  {sk.status}
                                </span>
                              </div>

                              <div className="text-xs text-gray-400">
                                <span className="text-gray-500 font-semibold mr-1.5">Evidence:</span>
                                {sk.evidenceFound ? (
                                  <span className="font-mono text-indigo-300">
                                    Found in {sk.evidenceCount} place{sk.evidenceCount > 1 ? 's' : ''} ({sk.evidenceLocations.map((l) => l.bulletId).join(', ')})
                                  </span>
                                ) : (
                                  <span className="text-amber-400/80 font-mono text-[11px]">Not found in experience or projects</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 2: METRICS */}
                    {signalSubTab === 'metrics' && (
                      <div className="space-y-4">
                        <div className="bg-[#0f172a] border border-gray-800/90 rounded-xl p-4">
                          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">Metrics Breakdown By Category</span>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(signals.metrics?.summary?.byType || {}).map(([type, count]) => (
                              <span key={type} className="text-xs font-mono bg-gray-900 border border-gray-800 px-3 py-1 rounded-lg text-gray-300">
                                <span className="text-indigo-400 font-bold uppercase mr-1">{type}:</span>
                                <span>{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(signals.metrics?.metrics || []).map((m, idx) => (
                            <div
                              key={`metric_${idx}`}
                              className="bg-[#0f172a] border border-gray-800/90 rounded-xl p-4 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-base font-extrabold text-emerald-300 font-mono">{m.value}</span>
                                <span className="text-[10px] font-mono uppercase bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded">
                                  {m.type}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-gray-500">
                                Source ID: <span className="text-gray-300">{m.source?.bulletId || m.source?.itemId}</span>
                              </div>
                              <p className="text-xs text-gray-300 italic bg-[#070b14] p-2.5 rounded-lg border border-gray-800/80 font-mono text-[11px]">
                                &ldquo;{m.source?.originalText}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 3: TIMELINE */}
                    {signalSubTab === 'timeline' && (
                      <div className="space-y-4">
                        {signals.timeline?.overlaps?.length > 0 && (
                          <div className="bg-amber-950/40 border border-amber-800/70 rounded-xl p-4 space-y-2">
                            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                              <WarningCircle size={16} weight="fill" />
                              Concurrent Overlapping Periods Detected ({signals.timeline.overlaps.length})
                            </div>
                            <p className="text-xs text-amber-200/80">
                              Objective chronological overlap. Education and employment overlaps are completely legitimate observations.
                            </p>
                            <div className="space-y-2 pt-1">
                              {signals.timeline.overlaps.map((o, idx) => (
                                <div key={`ov_${idx}`} className="bg-[#070b14] p-3 rounded-lg border border-amber-900/40 text-xs font-mono text-gray-300">
                                  <span className="text-white font-bold">{o.titleA}</span> ({o.startA} – {o.endA}) overlaps with{' '}
                                  <span className="text-white font-bold">{o.titleB}</span> ({o.startB} – {o.endB})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 space-y-3">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Chronological Items ({signals.timeline?.items?.length || 0})</h4>
                          <div className="space-y-2">
                            {(signals.timeline?.items || []).map((it, idx) => (
                              <div key={`tl_${idx}`} className="bg-[#070b14] p-3 rounded-xl border border-gray-800 flex items-center justify-between text-xs font-mono">
                                <div>
                                  <span className="text-white font-bold">{it.title}</span>
                                  <span className="text-gray-500 ml-2">({it.section})</span>
                                </div>
                                <span className="text-indigo-400 font-bold">{it.start} – {it.end}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 4: DUPLICATES */}
                    {signalSubTab === 'duplicates' && (
                      <div className="space-y-3">
                        {signals.duplicates?.duplicates?.length === 0 ? (
                          <div className="bg-[#0f172a] border border-gray-800 rounded-2xl p-8 text-center text-gray-400 text-xs">
                            No duplicate or highly redundant bullet pairs detected.
                          </div>
                        ) : (
                          (signals.duplicates?.duplicates || []).map((d, idx) => (
                            <div key={`dup_${idx}`} className="bg-[#0f172a] border border-gray-800/90 rounded-xl p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-indigo-300 font-bold">{d.pair?.join(' vs ')}</span>
                                <span className="text-xs font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2.5 py-0.5 rounded">
                                  {Math.round(d.similarity * 100)}% Similarity
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-gray-300 pt-1">
                                <div className="bg-[#070b14] p-2.5 rounded-lg border border-gray-800/80">
                                  <span className="text-gray-500 block text-[10px] mb-1">{d.pair?.[0]}</span>
                                  &ldquo;{d.snippetA}...&rdquo;
                                </div>
                                <div className="bg-[#070b14] p-2.5 rounded-lg border border-gray-800/80">
                                  <span className="text-gray-500 block text-[10px] mb-1">{d.pair?.[1]}</span>
                                  &ldquo;{d.snippetB}...&rdquo;
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* SUB-TAB 5: PARSER QUALITY */}
                    {signalSubTab === 'parser' && (
                      <div className="space-y-3">
                        {signals.parserQuality?.warnings?.length === 0 ? (
                          <div className="bg-[#0f172a] border border-emerald-950/40 rounded-2xl p-8 text-center text-emerald-400 text-xs">
                            Clean Parse: No formatting or section anomalies detected.
                          </div>
                        ) : (
                          (signals.parserQuality?.warnings || []).map((w, idx) => (
                            <div key={`pw_${idx}`} className="bg-[#0f172a] border border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
                              <WarningCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white font-mono uppercase">{w.type}</span>
                                  <span className="text-[10px] font-mono bg-gray-900 border border-gray-800 px-2 py-0.5 rounded text-gray-400">
                                    {w.itemId}
                                  </span>
                                </div>
                                <p className="text-xs text-amber-200/90">{w.message}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* SUB-TAB 6: CLAIMS */}
                    {signalSubTab === 'claims' && (
                      <div className="space-y-3">
                        <div className="bg-[#0f172a] border border-gray-800/90 rounded-xl p-4">
                          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">Claim Types Identified</span>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(signals.claimEvidence?.summary?.byType || {}).map(([type, count]) => (
                              <span key={type} className="text-xs font-mono bg-gray-900 border border-gray-800 px-3 py-1 rounded-lg text-gray-300">
                                <span className="text-emerald-400 font-bold uppercase mr-1">{type}:</span>
                                <span>{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {(signals.claimEvidence?.claims || []).map((c, idx) => (
                            <div key={`claim_${idx}`} className="bg-[#0f172a] border border-gray-800/90 rounded-xl p-3.5 flex items-start justify-between gap-3">
                              <div className="space-y-1 flex-1">
                                <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded inline-block font-bold">
                                  {c.claimType} Claim
                                </span>
                                <p className="text-xs text-gray-200 font-mono mt-1">&ldquo;{c.text}&rdquo;</p>
                              </div>
                              <span className="text-[10px] font-mono bg-gray-900 border border-gray-800 px-2 py-1 rounded text-gray-400 shrink-0">
                                {c.bulletId}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* TAB 2: RAW MODEL OUTPUT */}
              {activeTab === 'raw' && (
                <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Terminal size={18} className="text-indigo-400" />
                        Exact Raw Model Output
                      </h3>
                      <p className="text-xs text-gray-400">Unmodified provider text payload before parsing</p>
                    </div>

                    {currentInspectResult.rawModelOutput && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(currentInspectResult.rawModelOutput, 'tab_raw')}
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-700"
                      >
                        {copiedKey === 'tab_raw' ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === 'tab_raw' ? 'Copied Raw!' : 'Copy Raw Output'}
                      </button>
                    )}
                  </div>

                  {currentInspectResult.rawModelOutput ? (
                    <pre className="bg-[#070b14] p-4 rounded-xl border border-gray-800 text-xs font-mono text-gray-200 max-h-[600px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {currentInspectResult.rawModelOutput}
                    </pre>
                  ) : (
                    <div className="bg-red-950/20 border border-red-800/60 rounded-xl p-8 text-center text-red-300 space-y-2">
                      <div className="font-bold text-sm">NO MODEL OUTPUT PRODUCED</div>
                      <div className="text-xs text-gray-400 max-w-md mx-auto">
                        The provider failed before generating a token stream. Reason: {currentInspectResult.error?.message || 'Upstream provider failure'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PARSED JSON */}
              {activeTab === 'json' && (
                <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Code size={18} className="text-emerald-400" />
                        Parsed JSON Analysis
                      </h3>
                      <p className="text-xs text-gray-400">Validated domain schema structure</p>
                    </div>

                    {currentInspectResult.parsedOutput && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(currentInspectResult.parsedOutput, 'tab_json')}
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-700"
                      >
                        {copiedKey === 'tab_json' ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === 'tab_json' ? 'Copied JSON!' : 'Copy JSON'}
                      </button>
                    )}
                  </div>

                  {currentInspectResult.parsedOutput ? (
                    <pre className="bg-[#070b14] p-4 rounded-xl border border-gray-800 text-xs font-mono text-emerald-300 max-h-[600px] overflow-y-auto leading-relaxed">
                      {JSON.stringify(currentInspectResult.parsedOutput, null, 2)}
                    </pre>
                  ) : (
                    <div className="bg-[#070b14] border border-gray-800 rounded-xl p-8 text-center text-gray-400 text-xs">
                      No parsed JSON output available for this run.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: EXACT RUNTIME PROMPT */}
              {activeTab === 'prompt' && (
                <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileText size={18} className="text-indigo-400" />
                        Exact Runtime Prompt Capture
                      </h3>
                      <p className="text-xs text-gray-400">Captured before gateway call • Version: resume-expert-v1</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(currentInspectResult.promptCapture?.fullPrompt, 'prompt_tab_full')}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedKey === 'prompt_tab_full' ? <Check size={14} /> : <Copy size={14} />}
                        Copy Full Prompt
                      </button>
                      <button
                        type="button"
                        onClick={() => exportPromptToFile(currentInspectResult.promptCapture)}
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-gray-700 cursor-pointer"
                      >
                        <DownloadSimple size={14} /> Export
                      </button>
                    </div>
                  </div>

                  {currentInspectResult.promptCapture ? (
                    <div className="space-y-4 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                          System Prompt:
                        </div>
                        <pre className="bg-[#070b14] p-3 rounded-xl border border-gray-800 font-mono text-gray-300 max-h-52 overflow-y-auto whitespace-pre-wrap">
                          {currentInspectResult.promptCapture.systemPrompt}
                        </pre>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                          User Prompt:
                        </div>
                        <pre className="bg-[#070b14] p-3 rounded-xl border border-gray-800 font-mono text-gray-300 max-h-64 overflow-y-auto whitespace-pre-wrap">
                          {currentInspectResult.promptCapture.userPrompt}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#070b14] border border-gray-800 rounded-xl p-8 text-center text-gray-400 text-xs">
                      No runtime prompt capture recorded for this execution.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: TELEMETRY TAB */}
              {activeTab === 'telemetry' && (
                <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-gray-800 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock size={18} className="text-indigo-400" />
                      Execution Telemetry & Tokens
                    </h3>
                    <p className="text-xs text-gray-400">Request latency vs provider generation time</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Total Request Latency</div>
                      <div className="text-base font-bold text-white font-mono mt-1">
                        {currentInspectResult.telemetry?.totalLatencyMs || currentInspectResult.latencyMs || 0} ms
                      </div>
                    </div>

                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Provider Latency</div>
                      <div className="text-base font-bold text-indigo-400 font-mono mt-1">
                        {currentInspectResult.telemetry?.providerLatencyMs || 0} ms
                      </div>
                    </div>

                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Input Tokens</div>
                      <div className="text-base font-bold text-gray-200 font-mono mt-1">
                        {currentInspectResult.telemetry?.inputTokens ?? 'N/A'}
                      </div>
                    </div>

                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Completion Tokens</div>
                      <div className="text-base font-bold text-emerald-400 font-mono mt-1">
                        {currentInspectResult.telemetry?.outputTokens ?? 'N/A'}
                      </div>
                    </div>
                  </div>

                  {currentInspectResult.telemetry?.reasoningTokens && (
                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800 text-xs flex items-center justify-between">
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Reasoning Tokens (Deep Reasoning):</span>
                      <span className="font-mono font-bold text-indigo-300">
                        {currentInspectResult.telemetry.reasoningTokens} tokens
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: CONFIG SNAPSHOT */}
              {activeTab === 'config' && (
                <div className="bg-[#0f172a] border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-gray-800 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sliders size={18} className="text-indigo-400" />
                      Runtime Generation Configuration
                    </h3>
                    <p className="text-xs text-gray-400">Settings and safety configuration used during generation</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Provider</div>
                      <div className="text-white font-bold mt-1">{currentInspectResult.configSnapshot?.provider || currentInspectResult.provider}</div>
                    </div>

                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Requested Model</div>
                      <div className="text-white font-bold mt-1 truncate">{currentInspectResult.configSnapshot?.requestedModel || currentInspectResult.model}</div>
                    </div>

                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Actual Model</div>
                      <div className="text-white font-bold mt-1 truncate">{currentInspectResult.configSnapshot?.actualModel || currentInspectResult.model}</div>
                    </div>

                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Temperature</div>
                      <div className="text-indigo-300 font-bold mt-1">{currentInspectResult.configSnapshot?.temperature ?? 0.2}</div>
                    </div>

                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Max Output Tokens</div>
                      <div className="text-indigo-300 font-bold mt-1">{currentInspectResult.configSnapshot?.maxTokens ?? 4096}</div>
                    </div>

                    <div className="bg-[#070b14] p-3 rounded-xl border border-gray-800">
                      <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Response Format</div>
                      <div className="text-emerald-300 font-bold mt-1">{currentInspectResult.configSnapshot?.responseFormat || 'json_object'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!singleResult && !compareResult && !loading && (
            <div className="bg-[#0f172a] border border-gray-800 border-dashed rounded-2xl p-16 text-center text-gray-500 space-y-3">
              <Flask size={44} className="mx-auto text-gray-600" />
              <div className="text-base font-semibold text-gray-300">Ready to Benchmark & Inspect</div>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                Select a synthetic candidate fixture or upload a document on the left, choose a model, and click &ldquo;Run Single Model&rdquo; or &ldquo;Compare 3 Models&rdquo; to launch the evaluation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: EXACT RUNTIME PROMPT INSPECTOR MODAL */}
      {promptModalOpen && activePromptData && (
        <div
          onClick={() => setPromptModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f172a] border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText size={20} className="text-indigo-400" />
                  Exact Runtime Prompt Inspector
                </h3>
                <div className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-3">
                  <span>Prompt: <strong className="text-emerald-400">{activePromptData.version || 'resume-expert-v1'}</strong></span>
                  <span>•</span>
                  <span>Serializer: <strong className="text-indigo-400">{activePromptData.inputSerializerVersion || 'compact-resume-v1'}</strong></span>
                  <span>•</span>
                  <span>Mode: <strong className="text-amber-400 uppercase font-mono">{activePromptData.inputMode || 'compact_text'}</strong></span>
                  {activePromptData.inputSizeReductionPercent != null && (
                    <>
                      <span>•</span>
                      <span>Reduction: <strong className="text-emerald-400 font-bold">{activePromptData.inputSizeReductionPercent}%</strong></span>
                    </>
                  )}
                  <span>•</span>
                  <span>Captured: {new Date(activePromptData.capturedAt).toLocaleTimeString()}</span>
                  <span>•</span>
                  <span>Temp: {activePromptData.generation?.temperature ?? 0.2}</span>
                  <span>•</span>
                  <span>Max Tokens: {activePromptData.generation?.maxTokens ?? 4096}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPromptModalOpen(false)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Sub-tabs */}
            <div className="px-5 pt-3 border-b border-gray-800 flex items-center justify-between bg-[#070b14]/50">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPromptModalTab('system')}
                  className={`px-3 py-2 rounded-t-lg transition-colors cursor-pointer ${
                    promptModalTab === 'system'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  SYSTEM PROMPT
                </button>
                <button
                  type="button"
                  onClick={() => setPromptModalTab('user')}
                  className={`px-3 py-2 rounded-t-lg transition-colors cursor-pointer ${
                    promptModalTab === 'user'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  USER PROMPT
                </button>
                <button
                  type="button"
                  onClick={() => setPromptModalTab('full')}
                  className={`px-3 py-2 rounded-t-lg transition-colors cursor-pointer ${
                    promptModalTab === 'full'
                      ? 'bg-[#0f172a] text-white border-t-2 border-indigo-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  FULL COMBINED REQUEST
                </button>
              </div>

              {/* Copy / Export Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    const text =
                      promptModalTab === 'system'
                        ? activePromptData.systemPrompt
                        : promptModalTab === 'user'
                        ? activePromptData.userPrompt
                        : activePromptData.fullPrompt
                    copyToClipboard(text, 'modal_prompt_copy_active')
                  }}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'modal_prompt_copy_active' ? <Check size={14} /> : <Copy size={14} />}
                  Copy
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(activePromptData.systemPrompt, 'modal_prompt_copy_sys')}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-gray-700 cursor-pointer"
                >
                  {copiedKey === 'modal_prompt_copy_sys' ? <Check size={14} /> : <Copy size={14} />}
                  Copy System
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(activePromptData.userPrompt, 'modal_prompt_copy_user')}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-gray-700 cursor-pointer"
                >
                  {copiedKey === 'modal_prompt_copy_user' ? <Check size={14} /> : <Copy size={14} />}
                  Copy User
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(activePromptData.fullPrompt, 'modal_prompt_copy_full')}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-indigo-300 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-gray-700 cursor-pointer"
                >
                  {copiedKey === 'modal_prompt_copy_full' ? <Check size={14} /> : <Copy size={14} />}
                  Copy Full Prompt
                </button>

                <button
                  type="button"
                  onClick={() => exportPromptToFile(activePromptData)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-gray-700 cursor-pointer"
                >
                  <DownloadSimple size={14} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 bg-[#070b14]">
              {promptModalTab === 'system' && (
                <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {activePromptData.systemPrompt}
                </pre>
              )}
              {promptModalTab === 'user' && (
                <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {activePromptData.userPrompt}
                </pre>
              )}
              {promptModalTab === 'full' && (
                <pre className="font-mono text-xs text-indigo-200 whitespace-pre-wrap leading-relaxed">
                  {activePromptData.fullPrompt}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIG INSPECTOR MODAL */}
      {configModalOpen && activeConfigData && (
        <div
          onClick={() => setConfigModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f172a] border border-gray-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders size={20} className="text-indigo-400" />
                Generation Configuration
              </h3>
              <button
                type="button"
                onClick={() => setConfigModalOpen(false)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 bg-[#070b14] text-xs font-mono">
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400 font-sans">Provider:</span>
                <span className="text-white font-bold">{activeConfigData.provider}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400 font-sans">Requested Model:</span>
                <span className="text-white font-bold">{activeConfigData.requestedModel}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400 font-sans">Actual Model:</span>
                <span className="text-white font-bold">{activeConfigData.actualModel}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400 font-sans">Temperature:</span>
                <span className="text-indigo-300 font-bold">{activeConfigData.temperature ?? 0.2}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400 font-sans">Max Output Tokens:</span>
                <span className="text-indigo-300 font-bold">{activeConfigData.maxTokens ?? 4096}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400 font-sans">Response Format:</span>
                <span className="text-emerald-300 font-bold">{activeConfigData.responseFormat || 'json_object'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400 font-sans">Streaming:</span>
                <span className="text-gray-300">false</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400 font-sans">Prompt Version:</span>
                <span className="text-emerald-400 font-bold">{activeConfigData.promptVersion || 'resume-expert-v1'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: INPUT INSPECTOR MODAL */}
      {inputModalOpen && activeInputData && (
        <div
          onClick={() => setInputModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f172a] border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText size={20} className="text-emerald-400" />
                  Exact LLM Input Inspector
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Inspect the precise serialized resume sent to the model (Serializer: {activeInputData.inputSerializerVersion})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeInputData.llmInput, 'llm_input_copy')}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedKey === 'llm_input_copy' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === 'llm_input_copy' ? 'Copied LLM Input!' : 'Copy LLM Input'}
                </button>
                <button
                  type="button"
                  onClick={() => setInputModalOpen(false)}
                  className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="p-4 bg-[#070b14]/70 border-b border-gray-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
              <div className="bg-[#0f172a] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Serializer</div>
                <div className="text-emerald-400 font-bold mt-0.5 truncate">{activeInputData.inputSerializerVersion}</div>
              </div>
              <div className="bg-[#0f172a] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Mode</div>
                <div className="text-amber-300 font-bold mt-0.5 uppercase truncate">{activeInputData.inputMode}</div>
              </div>
              <div className="bg-[#0f172a] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Canonical Hash</div>
                <div className="text-gray-200 mt-0.5 truncate">{activeInputData.canonicalInputHash || 'N/A'}</div>
              </div>
              <div className="bg-[#0f172a] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">LLM Input Hash</div>
                <div className="text-indigo-300 font-bold mt-0.5 truncate">{activeInputData.llmInputHash || 'N/A'}</div>
              </div>
              <div className="bg-[#0f172a] p-2.5 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-500 font-sans uppercase font-bold">Size Reduction</div>
                <div className="text-emerald-300 font-bold mt-0.5">
                  {activeInputData.inputSizeReductionPercent != null ? `-${activeInputData.inputSizeReductionPercent}%` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Character & Token Comparison Details */}
            <div className="px-5 py-2.5 bg-[#0a0f1d] border-b border-gray-800 flex flex-wrap items-center justify-between text-xs text-gray-400 gap-2">
              <div className="flex items-center gap-4">
                <span>Canonical Characters: <strong className="text-white font-mono">{activeInputData.canonicalInputCharacters ?? 'N/A'}</strong></span>
                <span>Compact Characters: <strong className="text-emerald-400 font-mono">{activeInputData.compactInputCharacters ?? 'N/A'}</strong></span>
              </div>
              <div className="flex items-center gap-4">
                <span>Est. Canonical Tokens: <strong className="text-white font-mono">{activeInputData.canonicalEstimatedTokens ?? 'N/A'}</strong></span>
                <span>Est. Compact Tokens: <strong className="text-emerald-400 font-mono">{activeInputData.compactEstimatedTokens ?? 'N/A'}</strong></span>
              </div>
              {activeInputData.sectionCounts && (
                <div className="flex items-center gap-3 text-[11px] font-mono text-gray-300">
                  <span>Exp: <strong className="text-emerald-400">{activeInputData.sectionCounts.experience}</strong></span>
                  <span>Proj: <strong className="text-indigo-400">{activeInputData.sectionCounts.projects}</strong></span>
                  <span>Edu: <strong className="text-amber-400">{activeInputData.sectionCounts.education}</strong></span>
                  <span>Skills: <strong className="text-sky-400">{activeInputData.sectionCounts.skills}</strong></span>
                </div>
              )}
            </div>

            {/* Modal Body: Serialized Resume */}
            <div className="p-5 overflow-y-auto flex-1 bg-[#070b14]">
              <pre className="font-mono text-xs text-emerald-100/90 whitespace-pre-wrap leading-relaxed">
                {activeInputData.llmInput || '(No serialized input available)'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
