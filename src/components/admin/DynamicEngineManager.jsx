import React, { useState, useEffect, useCallback } from 'react'
import {
  Gear,
  SlidersHorizontal,
  Key,
  Plus,
  ArrowsClockwise,
  Check,
  Lightning,
  Sparkle,
  Lock,
  Database,
  Cpu,
  ShieldCheck,
  WarningCircle,
  Play,
} from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

export default function DynamicEngineManager({ token }) {
  const [engineConfig, setEngineConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fastCatchSlider, setFastCatchSlider] = useState(35)
  const [backgroundSlider, setBackgroundSlider] = useState(50)
  const [savingSliders, setSavingSliders] = useState(false)

  // Custom Role Injection
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [creatingRole, setCreatingRole] = useState(false)

  // Key Injection
  const [selectedService, setSelectedService] = useState('apify')
  const [newToken, setNewToken] = useState('')
  const [injectingKey, setInjectingKey] = useState(false)

  // On-demand Scrape trigger
  const [targetBucketKey, setTargetBucketKey] = useState('')
  const [scrapeMode, setScrapeMode] = useState('fast_catch')
  const [triggeringScrape, setTriggeringScrape] = useState(false)

  // Toast
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4500)
  }

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/admin/engine/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setEngineConfig(data)
        setFastCatchSlider(data.scrapeTargets?.fastCatchTargetJds || 35)
        setBackgroundSlider(data.scrapeTargets?.backgroundTargetJds || 50)
      }
    } catch (err) {
      console.error('Failed to load engine config:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Save Scrape Slider Targets Live
  const handleSaveSliders = async () => {
    setSavingSliders(true)
    try {
      const res = await fetch(`${API_BASE}/admin/engine/scrape-slider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fastCatchTargetJds: fastCatchSlider,
          backgroundTargetJds: backgroundSlider,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to update sliders')
      showToast(`Scrape targets updated live: Fast-Catch (${fastCatchSlider} JDs), Background (${backgroundSlider} JDs)!`)
    } catch (err) {
      alert(`Error saving sliders: ${err.message}`)
    } finally {
      setSavingSliders(false)
    }
  }

  // Create New Dynamic Role across 4 experience tiers
  const handleCreateRole = async (e) => {
    e.preventDefault()
    if (!roleName.trim()) return
    setCreatingRole(true)
    try {
      const res = await fetch(`${API_BASE}/admin/engine/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roleName: roleName.trim(),
          specialization: specialization.trim() || 'general',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to create role')

      showToast(`Successfully initialized 4 MongoDB buckets for "${roleName}" (0-2, 3-5, 6-8, 8+)!`)
      setRoleName('')
      setSpecialization('')
      setShowRoleModal(false)
      loadConfig()
    } catch (err) {
      alert(`Error creating role: ${err.message}`)
    } finally {
      setCreatingRole(false)
    }
  }

  // Inject New Key into Active Pool
  const handleInjectKey = async (e) => {
    e.preventDefault()
    if (!newToken.trim()) return
    setInjectingKey(true)
    try {
      const res = await fetch(`${API_BASE}/admin/engine/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          service: selectedService,
          token: newToken.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Key injection failed')

      showToast(data.message || `Key successfully injected into ${selectedService} pool with primary priority!`)
      setNewToken('')
      loadConfig()
    } catch (err) {
      alert(`Error injecting key: ${err.message}`)
    } finally {
      setInjectingKey(false)
    }
  }

  // Trigger 1-Click Live Scrape on Bucket
  const handleTriggerScrape = async (e) => {
    e.preventDefault()
    if (!targetBucketKey.trim()) return
    setTriggeringScrape(true)
    try {
      const res = await fetch(`${API_BASE}/admin/engine/scrape/${encodeURIComponent(targetBucketKey.trim())}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: scrapeMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to trigger scrape')

      showToast(data.message || `Live scrape triggered on ${targetBucketKey}!`)
      setTargetBucketKey('')
    } catch (err) {
      alert(`Scrape error: ${err.message}`)
    } finally {
      setTriggeringScrape(false)
    }
  }

  const apifyPool = engineConfig?.keyPools?.apify
  const geminiPool = engineConfig?.keyPools?.gemini
  const openRouter = engineConfig?.keyPools?.openrouter

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP ROW: RUNTIME SLIDERS & ADD CUSTOM ROLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Runtime Scrape Sliders */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800">
              <SlidersHorizontal size={18} className="text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Zero-Restart Runtime Scrape Sliders
              </h3>
            </div>
            <button
              onClick={handleSaveSliders}
              disabled={savingSliders}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
            >
              {savingSliders ? 'Saving...' : 'Save Targets Live'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            {/* Slider 1: Fast-Catch Target */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lightning size={14} className="text-amber-500" weight="fill" />
                  Fast-Catch JD Target (Live Sync)
                </span>
                <span className="font-black text-indigo-600 tabular-nums text-sm">
                  {fastCatchSlider} JDs
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="60"
                step="5"
                value={fastCatchSlider}
                onChange={(e) => setFastCatchSlider(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>15 (Ultrafast)</span>
                <span>35 (Standard Default)</span>
                <span>60 JDs</span>
              </div>
            </div>

            {/* Slider 2: Background Deep Corpus */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Database size={14} className="text-sky-500" />
                  Background Corpus Target (Detached)
                </span>
                <span className="font-black text-indigo-600 tabular-nums text-sm">
                  {backgroundSlider} JDs
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                step="5"
                value={backgroundSlider}
                onChange={(e) => setBackgroundSlider(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>30 JDs</span>
                <span>50 (Recommended)</span>
                <span>100 (Max Depth)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Custom Role Injector */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-2">
              <Sparkle size={15} weight="fill" />
              <span>Universal Multi-Domain</span>
            </div>
            <h4 className="text-base font-bold text-white mb-1">Add Target Role On-The-Fly</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Dynamically initializes all 4 experience tiers (0-2, 3-5, 6-8, 8+) in MongoDB without touching code or restarting the server.
            </p>
          </div>

          <button
            onClick={() => setShowRoleModal(true)}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
          >
            <Plus size={16} weight="bold" />
            <span>Inject New Target Role</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC KEY INJECTION & TELEMETRY */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <Key size={18} className="text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              SmartKeyPool Live Token Health & Dynamic Key Injection
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Zero-Downtime Sticky Rotation</span>
        </div>

        {/* Key Injection Form */}
        <form onSubmit={handleInjectKey} className="flex flex-wrap items-center gap-3">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="apify">Apify SmartKeyPool</option>
            <option value="gemini">Gemini SmartKeyPool</option>
            <option value="openrouter">OpenRouter API Key</option>
          </select>

          <div className="relative flex-1 min-w-[260px]">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="Paste raw token (e.g. apify_api_XXXX or sk-or-v1-XXXX)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={injectingKey}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} weight="bold" />
            <span>{injectingKey ? 'Injecting...' : 'Inject Key Live'}</span>
          </button>
        </form>

        {/* KeyPools Telemetry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Apify */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Apify Scraper Tokens</span>
              <span className="text-xs font-bold text-amber-600 tabular-nums">
                {apifyPool?.count ?? 0} Keys
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
              <span>{apifyPool?.activeKeyMasked || 'None'}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>Cooldowns: {apifyPool?.cooldownCount ?? 0}</span>
              <span>Sticky Queue: Enabled</span>
            </div>
          </div>

          {/* OpenRouter */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">OpenRouter (Jev 1.14)</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  openRouter?.configured
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {openRouter?.configured ? 'CONNECTED' : 'MISSING'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
              {openRouter?.activeKeyMasked || 'Missing Key'}
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>Model: typesafe/jev-1.14</span>
              <span>API: /api/v1/decisions</span>
            </div>
          </div>

          {/* Gemini */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Gemini KeyPool</span>
              <span className="text-xs font-bold text-sky-600 tabular-nums">
                {geminiPool?.count ?? 0} Keys
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
              <span>{geminiPool?.activeKeyMasked || 'None'}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>Auto-failover on 429</span>
              <span>Synthesis Engine</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1-CLICK LIVE SCRAPE TRIGGER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <Play size={18} className="text-emerald-600" weight="fill" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              1-Click Live Bucket Scrape Trigger
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">On-Demand Replenishment</span>
        </div>

        <form onSubmit={handleTriggerScrape} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            required
            value={targetBucketKey}
            onChange={(e) => setTargetBucketKey(e.target.value)}
            placeholder="Enter bucket key (e.g. software-engineer::6-8 or data-analyst::3-5)..."
            className="flex-1 min-w-[260px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
          />

          <select
            value={scrapeMode}
            onChange={(e) => setScrapeMode(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 cursor-pointer"
          >
            <option value="fast_catch">Fast-Catch (Synchronous ~35 JDs)</option>
            <option value="full">Full Deep Background Scrape (~50-75 JDs)</option>
          </select>

          <button
            type="submit"
            disabled={triggeringScrape}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Play size={13} weight="fill" />
            <span>{triggeringScrape ? 'Starting Scrape...' : 'Trigger Scrape Now'}</span>
          </button>
        </form>
      </div>

      {/* ADD TARGET ROLE MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Inject New Target Role</h3>
              <p className="text-xs text-slate-500 mt-1">
                Creates all 4 experience tiers (0-2, 3-5, 6-8, 8+) in MongoDB instantly with zero downtime.
              </p>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Target Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Cloud Security Architect or AI Research Scientist"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Specialization / Domain (Optional)
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. AWS/GCP, LLMs, Healthcare, Fintech"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRole}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {creatingRole ? 'Creating Buckets...' : 'Create 4 Buckets'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

