import React, { useState, useMemo } from 'react'
import {
  Lightning,
  Sparkle,
  ArrowsClockwise,
  Rocket,
  Check,
  WarningCircle,
  Database,
  SlidersHorizontal,
  Tag,
  Cpu,
  Globe,
} from '@phosphor-icons/react'

const PRESET_ROLES = [
  { id: 'data-analyst', label: 'Data Analyst', icon: '📊' },
  { id: 'software-engineer', label: 'Software Engineer', icon: '💻' },
  { id: 'product-manager', label: 'Product Manager', icon: '🚀' },
  { id: 'qa-engineer', label: 'QA Engineer', icon: '🧪' },
  { id: 'cloud-architect', label: 'Cloud Architect', icon: '☁️' },
  { id: 'devops-engineer', label: 'DevOps Engineer', icon: '⚙️' },
  { id: 'ai-ml-engineer', label: 'AI / ML Engineer', icon: '🤖' },
]

const EXPERIENCE_TIERS = [
  { id: '0-2', label: '0–2 yrs', sub: 'Entry / Assoc' },
  { id: '3-5', label: '3–5 yrs', sub: 'Mid-Level' },
  { id: '6-8', label: '6–8 yrs', sub: 'Senior / Lead' },
  { id: '8+', label: '8+ yrs', sub: 'Staff / Principal' },
]

const PRESET_SPECIALIZATIONS = [
  'Healthcare & EHR',
  'Fintech & Payments',
  'AWS & Cloud Infra',
  'React & Frontend',
  'Data & Snowflake',
  'Cybersecurity',
  'E-Commerce',
]

export default function ZeroSyntaxScrapeCockpit({
  onScrapeTriggered,
  onScrapeAllTriggered,
  rolesList = [],
}) {
  const [selectedRole, setSelectedRole] = useState('Data Analyst')
  const [customRole, setCustomRole] = useState('')
  const [isCustomRole, setIsCustomRole] = useState(false)
  const [selectedExp, setSelectedExp] = useState('3-5')
  const [specialization, setSpecialization] = useState('Healthcare & EHR')
  const [mode, setMode] = useState('fast_catch') // 'fast_catch' (35) | 'full' (60)
  const [launching, setLaunching] = useState(false)
  const [scrapingAll, setScrapingAll] = useState(false)
  const [scrapeAllStatus, setScrapeAllStatus] = useState(null)

  // Compute effective role title
  const activeRoleTitle = useMemo(() => {
    return isCustomRole ? customRole.trim() || 'Custom Professional' : selectedRole
  }, [isCustomRole, customRole, selectedRole])

  // Compute live search query preview
  const liveQueryPreview = useMemo(() => {
    let query = activeRoleTitle
    if (selectedExp === '6-8' || selectedExp === '8+') {
      if (!/senior|lead|principal|staff|director/i.test(query)) {
        query = `Senior ${query}`
      }
    } else if (selectedExp === '0-2') {
      if (!/junior|entry|associate|graduate/i.test(query)) {
        query = `Junior ${query}`
      }
    }
    if (specialization && specialization !== 'general' && !query.toLowerCase().includes(specialization.toLowerCase())) {
      query = `${query} ${specialization}`
    }
    const targetCount = mode === 'fast_catch' ? 35 : 60
    return {
      query: query.trim(),
      bucketKey: `${activeRoleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}::${selectedExp}`,
      targetCount,
    }
  }, [activeRoleTitle, selectedExp, specialization, mode])

  const handleLaunch = async (e) => {
    e?.preventDefault()
    if (!activeRoleTitle) return

    setLaunching(true)
    try {
      await onScrapeTriggered({
        roleName: activeRoleTitle,
        bucketKey: liveQueryPreview.bucketKey,
        experienceBucket: selectedExp,
        specialization: specialization.trim() || 'general',
        mode,
      })
    } finally {
      setLaunching(false)
    }
  }

  const handleScrapeAll = async () => {
    if (!window.confirm('Launch safe staggered scrape across ALL active market buckets with 3-minute intervals?')) {
      return
    }
    setScrapingAll(true)
    setScrapeAllStatus({ status: 'Enqueuing staggered refresh queue...' })
    try {
      if (onScrapeAllTriggered) {
        await onScrapeAllTriggered()
      }
      setScrapeAllStatus({ status: 'All active buckets queued successfully!' })
      setTimeout(() => setScrapeAllStatus(null), 5000)
    } catch (err) {
      setScrapeAllStatus({ error: err.message || 'Failed to trigger global refresh' })
    } finally {
      setScrapingAll(false)
    }
  }

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold shadow-inner">
            <Lightning size={20} weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white tracking-tight uppercase">
                Zero-Syntax Market Scrape Cockpit
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                Linear-Grade
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Visual selector dispatches directly to Apify & Gemini with zero manual regex or key syntax.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleScrapeAll}
            disabled={scrapingAll}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm hover:border-slate-600"
            title="Safe staggered refresh across all active buckets"
          >
            <Rocket size={14} className="text-amber-400" />
            <span>{scrapingAll ? 'Enqueuing Queue...' : 'Staggered Scrape All'}</span>
          </button>

          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
          >
            <Lightning size={14} weight="bold" />
            <span>{launching ? 'Scraping Live...' : 'Launch Targeted Scrape'}</span>
          </button>
        </div>
      </div>

      {/* Progress banner for Scrape All */}
      {scrapeAllStatus && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center gap-2 font-semibold ${
            scrapeAllStatus.error
              ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 animate-in fade-in'
          }`}
        >
          {scrapeAllStatus.error ? (
            <WarningCircle size={16} className="text-rose-400" />
          ) : (
            <Check size={16} className="text-emerald-400" />
          )}
          <span>{scrapeAllStatus.error || scrapeAllStatus.status}</span>
        </div>
      )}

      {/* Cockpit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (8 cols): Role, Exp, Spec */}
        <div className="lg:col-span-8 space-y-4">
          {/* Step 1: Target Role Chips */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              1. Select Target Role
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ROLES.map((r) => {
                const isActive = !isCustomRole && selectedRole === r.label
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setIsCustomRole(false)
                      setSelectedRole(r.label)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 ring-1 ring-indigo-400'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setIsCustomRole(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isCustomRole
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 ring-1 ring-indigo-400'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                }`}
              >
                <span>✨</span>
                <span>+ Custom Role</span>
              </button>
            </div>

            {isCustomRole && (
              <div className="mt-2.5">
                <input
                  type="text"
                  required
                  placeholder="Type any custom role (e.g. Quantitative Risk Analyst or ICU Nurse)..."
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="w-full bg-slate-900 border border-indigo-500/50 rounded-xl px-3.5 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Step 2: Experience Tier Segmented Control */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              2. Experience Level (Seniority Tier)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EXPERIENCE_TIERS.map((tier) => {
                const isActive = selectedExp === tier.id
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedExp(tier.id)}
                    className={`py-2 px-3 rounded-2xl text-center transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-inner'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-black">{tier.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{tier.sub}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 3: Specialization Tags */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              3. Specialization Focus (Domain & Tech Alignment)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_SPECIALIZATIONS.map((spec) => {
                const isActive = specialization === spec
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setSpecialization(spec)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white ring-1 ring-purple-400'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {spec}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              placeholder="Or type custom specialization (e.g. Kafka, React Native, Kubernetes)..."
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>

        {/* Right Column (4 cols): Live Query Generator Badge & Dispatcher */}
        <div className="lg:col-span-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">
              <Cpu size={14} />
              <span>Live Query Dispatch Radar</span>
            </div>

            {/* Terminal preview box */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Apify Query String</span>
                <span className="text-emerald-400 font-bold break-words">"{liveQueryPreview.query}"</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Bucket Key:</span>
                <span className="text-indigo-400 font-bold">{liveQueryPreview.bucketKey}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Actor Source:</span>
                <span className="text-slate-300">harvestapi (LinkedIn)</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Target Sample:</span>
                <span className="text-amber-400 font-bold">{liveQueryPreview.targetCount} Verified JDs</span>
              </div>
            </div>

            {/* Mode selection radio */}
            <div className="mt-3.5 flex items-center gap-3 text-xs font-semibold text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scrapeCockpitMode"
                  value="fast_catch"
                  checked={mode === 'fast_catch'}
                  onChange={() => setMode('fast_catch')}
                  className="accent-indigo-500"
                />
                <span>Fast-Catch (35)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scrapeCockpitMode"
                  value="full"
                  checked={mode === 'full'}
                  onChange={() => setMode('full')}
                  className="accent-indigo-500"
                />
                <span>Full Corpus (60)</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Lightning size={16} weight="bold" />
            <span>{launching ? 'Scraping Active Pipeline...' : '⚡ Launch Targeted Scrape'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
