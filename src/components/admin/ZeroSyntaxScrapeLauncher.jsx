import React, { useState } from 'react'
import {
  Lightning,
  Sparkle,
  ArrowsClockwise,
  Rocket,
  Check,
  WarningCircle,
  Database,
  SlidersHorizontal,
} from '@phosphor-icons/react'

export default function ZeroSyntaxScrapeLauncher({
  onScrapeTriggered,
  onScrapeAllTriggered,
  rolesList = [],
}) {
  const [role, setRole] = useState('Data Analyst')
  const [customRole, setCustomRole] = useState('')
  const [experience, setExperience] = useState('3-5')
  const [specialization, setSpecialization] = useState('')
  const [mode, setMode] = useState('fast_catch') // 'fast_catch' (35 JDs) | 'full' (60 JDs)
  const [launching, setLaunching] = useState(false)
  const [scrapingAll, setScrapingAll] = useState(false)
  const [scrapeAllProgress, setScrapeAllProgress] = useState(null) // { total, completed, current }

  const handleLaunch = async (e) => {
    e.preventDefault()
    const targetRole = role === 'CUSTOM' ? customRole.trim() : role
    if (!targetRole) return

    setLaunching(true)
    const roleKey = targetRole
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const bucketKey = `${roleKey}::${experience}`

    try {
      await onScrapeTriggered({
        roleName: targetRole,
        bucketKey,
        experienceBucket: experience,
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
    setScrapeAllProgress({ status: 'Enqueuing staggered refresh queue...' })
    try {
      if (onScrapeAllTriggered) {
        await onScrapeAllTriggered()
      }
      setScrapeAllProgress({ status: 'All active buckets queued successfully!' })
      setTimeout(() => setScrapeAllProgress(null), 5000)
    } catch (err) {
      setScrapeAllProgress({ error: err.message || 'Failed to trigger global refresh' })
    } finally {
      setScrapingAll(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Lightning size={18} weight="fill" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              Zero-Syntax Targeted Scrape Dispatcher
            </h3>
            <span className="text-[11px] text-slate-400">
              Pick role & experience without typing raw keys. Injects specialization into Apify & LLM automatically.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleScrapeAll}
            disabled={scrapingAll}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            title="Safe staggered refresh across all active buckets"
          >
            <Rocket size={14} className="text-amber-400" />
            <span>{scrapingAll ? 'Enqueuing...' : 'Scrape All Active Buckets'}</span>
          </button>
        </div>
      </div>

      {/* Progress banner for Scrape All */}
      {scrapeAllProgress && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center gap-2 font-semibold ${
            scrapeAllProgress.error
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 animate-in fade-in'
          }`}
        >
          {scrapeAllProgress.error ? (
            <WarningCircle size={16} className="text-rose-600" />
          ) : (
            <Check size={16} className="text-emerald-600" />
          )}
          <span>{scrapeAllProgress.error || scrapeAllProgress.status}</span>
        </div>
      )}

      {/* Dispatcher Form */}
      <form onSubmit={handleLaunch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Box 1: Role Selector */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Target Role Title
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="Data Analyst">Data Analyst</option>
            <option value="Software Engineer">Software Engineer</option>
            <option value="Product Manager">Product Manager</option>
            <option value="Sales Manager">Sales Manager</option>
            <option value="QA & Test Automation">QA Engineer / Automation</option>
            <option value="Cloud Architect">Cloud Architect</option>
            <option value="DevOps Engineer">DevOps Engineer</option>
            <option value="AI / Machine Learning Engineer">AI / ML Engineer</option>
            {rolesList
              .filter(
                (r) =>
                  ![
                    'Data Analyst',
                    'Software Engineer',
                    'Product Manager',
                    'Sales Manager',
                    'QA & Test Automation',
                    'Cloud Architect',
                    'DevOps Engineer',
                    'AI / Machine Learning Engineer',
                  ].includes(r)
              )
              .map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            <option value="CUSTOM">+ Custom Role...</option>
          </select>

          {role === 'CUSTOM' && (
            <input
              type="text"
              required
              placeholder="e.g. Cybersecurity Analyst"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          )}
        </div>

        {/* Box 2: Experience Tier List */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Experience Level
          </label>
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="0-2">0–2 Years (Entry / Associate)</option>
            <option value="3-5">3–5 Years (Mid-Level)</option>
            <option value="6-8">6–8 Years (Senior / Lead)</option>
            <option value="8+">8+ Years (Staff / Principal)</option>
          </select>
        </div>

        {/* Box 3: Specialization Focus */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Specialization Focus (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Healthcare, Fintech, AWS, React"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Box 4: Dispatch Action */}
        <div className="flex flex-col justify-end">
          <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold text-slate-500">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="scrapeMode"
                value="fast_catch"
                checked={mode === 'fast_catch'}
                onChange={() => setMode('fast_catch')}
                className="accent-indigo-600"
              />
              <span>Fast-Catch (35)</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="scrapeMode"
                value="full"
                checked={mode === 'full'}
                onChange={() => setMode('full')}
                className="accent-indigo-600"
              />
              <span>Full (60)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={launching}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Lightning size={15} weight="bold" />
            <span>{launching ? 'Scraping Live...' : '⚡ Launch Targeted Scrape'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
