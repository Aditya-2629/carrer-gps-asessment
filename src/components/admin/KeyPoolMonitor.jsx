import React, { useState, useEffect, useCallback } from 'react'
import {
  Key,
  ShieldCheck,
  Lightning,
  Sparkle,
  ArrowsClockwise,
  Plus,
  Check,
  WarningCircle,
  Cpu,
  Lock,
} from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

export default function KeyPoolMonitor({ token }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState('apify')
  const [newToken, setNewToken] = useState('')
  const [injecting, setInjecting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const showToast = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/admin/engine/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setConfig(data)
      }
    } catch (err) {
      console.error('Failed to load key pool config:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleInjectKey = async (e) => {
    e.preventDefault()
    if (!newToken.trim()) return
    setInjecting(true)
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

      showToast(data.message || `Successfully injected ${selectedService} key with primary priority!`)
      setNewToken('')
      loadConfig()
    } catch (err) {
      alert(`Error injecting key: ${err.message}`)
    } finally {
      setInjecting(false)
    }
  }

  const apifyPool = config?.keyPools?.apify
  const geminiPool = config?.keyPools?.gemini
  const openRouter = config?.keyPools?.openrouter

  return (
    <div className="space-y-6">
      {/* Toast */}
      {successMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TOP INJECTION CARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <Key size={18} className="text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Zero-Restart Dynamic Key Injector (Sticky Promotion)
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Real-time In-Memory KeyPool</span>
        </div>

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
              placeholder="Paste raw API token (e.g. apify_api_XXXX or sk-or-v1-XXXX)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={injecting}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} weight="bold" />
            <span>{injecting ? 'Injecting...' : 'Inject Key Live'}</span>
          </button>
        </form>
        <p className="text-[11px] text-slate-400">
          Injected tokens immediately become the active primary key for all subsequent background scrapes and LLM calls. No server reboot required.
        </p>
      </div>

      {/* KEY POOLS TELEMETRY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Apify KeyPool */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Apify SmartKeyPool</h4>
                  <div className="text-[10px] text-slate-400">Live LinkedIn Job Scraping</div>
                </div>
              </div>
              <span className="text-xs font-black text-amber-600 tabular-nums">
                {apifyPool?.count ?? 0} Keys
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400">Active Primary Token:</div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-mono text-xs text-slate-800 flex items-center justify-between">
                <span>{apifyPool?.activeKeyMasked || 'None Configured'}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  PRIMARY
                </span>
              </div>

              {apifyPool?.keys?.length > 1 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Queue Order:</div>
                  {apifyPool.keys.slice(1).map((k) => (
                    <div key={k.index} className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
                      <span>{k.masked}</span>
                      <span className="text-[9px] text-slate-400">Backup #{k.index}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Cooldowns:</span>
            <span className="font-bold text-slate-700">{apifyPool?.cooldownCount ?? 0} keys</span>
          </div>
        </div>

        {/* Card 2: OpenRouter & Jev Decision Engine */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  OR
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">OpenRouter & Jev Engine</h4>
                  <div className="text-[10px] text-slate-400">System One Decisions API</div>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  openRouter?.configured
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {openRouter?.configured ? 'CONNECTED' : 'MISSING'}
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Active Gateway Key:</div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-mono text-xs text-slate-800">
                  {openRouter?.activeKeyMasked || 'Missing OPENROUTER_API_KEY'}
                </div>
              </div>

              <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 space-y-1">
                <div className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
                  <Cpu size={13} /> Active Decision Model:
                </div>
                <div className="text-xs font-mono font-bold text-indigo-700">typesafe/jev-1.14</div>
                <div className="text-[10px] text-indigo-500">Fast gatekeeper via /api/v1/decisions endpoint</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Decision Latency:</span>
            <span className="font-bold text-emerald-600">&lt;25ms avg</span>
          </div>
        </div>

        {/* Card 3: Gemini SmartKeyPool */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                  G
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Gemini KeyPool</h4>
                  <div className="text-[10px] text-slate-400">Synthesis & Deep Audit</div>
                </div>
              </div>
              <span className="text-xs font-black text-sky-600 tabular-nums">
                {geminiPool?.count ?? 0} Keys
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400">Primary Key:</div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-mono text-xs text-slate-800 flex items-center justify-between">
                <span>{geminiPool?.activeKeyMasked || 'None Configured'}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  PRIMARY
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Quota Rotation:</span>
            <span className="font-bold text-slate-700">Automatic on 429</span>
          </div>
        </div>
      </div>
    </div>
  )
}
