import React, { useState, useEffect, useCallback } from 'react'
import {
  Key,
  ShieldCheck,
  ArrowsClockwise,
  Plus,
  Check,
  WarningCircle,
  Cpu,
  Database,
  Lightning,
  Sparkle,
} from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

export default function KeyPoolTelemetryCard({ token }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState('apify')
  const [newKey, setNewKey] = useState('')
  const [injecting, setInjecting] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const fetchConfig = useCallback(async () => {
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
      console.error('Failed to load telemetry config:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleInjectKey = async (e) => {
    e.preventDefault()
    if (!newKey.trim()) return
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
          token: newKey.trim(),
          promote: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Injected & promoted ${selectedService.toUpperCase()} key live!`)
        setNewKey('')
        fetchConfig()
      } else {
        alert(data.message || 'Failed to inject key')
      }
    } catch (err) {
      alert(`Key injection error: ${err.message}`)
    } finally {
      setInjecting(false)
    }
  }

  const pools = config?.smartKeyPools || {}

  return (
    <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check size={16} weight="bold" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Key size={20} weight="fill" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              SmartKeyPool Telemetry &amp; Dynamic Injection
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live token quota health, automated fallback failover, and zero-restart hot-reloads.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchConfig}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <ArrowsClockwise size={16} />
        </button>
      </div>

      {/* Pools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Apify Key Pool */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Cpu size={15} className="text-amber-400" />
              <span>Apify Key Pool</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                pools.apify?.keyCount > 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}
            >
              {pools.apify?.keyCount > 0 ? 'Healthy' : 'Zero Keys'}
            </span>
          </div>

          <div className="text-2xl font-black text-white font-mono">
            {pools.apify?.keyCount ?? 0} <span className="text-xs text-slate-500 font-sans">Active Tokens</span>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1 font-mono pt-1 border-t border-slate-800/80">
            <div>Current Token: <span className="text-amber-400 font-bold">{pools.apify?.currentKeyMask || 'None'}</span></div>
            <div>Strategy: Round-Robin + Sticky Success</div>
          </div>
        </div>

        {/* Gemini Key Pool */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkle size={15} className="text-indigo-400" />
              <span>Gemini Key Pool</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                pools.gemini?.keyCount > 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}
            >
              {pools.gemini?.keyCount > 0 ? 'Healthy' : 'Zero Keys'}
            </span>
          </div>

          <div className="text-2xl font-black text-white font-mono">
            {pools.gemini?.keyCount ?? 0} <span className="text-xs text-slate-500 font-sans">Active Tokens</span>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1 font-mono pt-1 border-t border-slate-800/80">
            <div>Current Token: <span className="text-indigo-400 font-bold">{pools.gemini?.currentKeyMask || 'None'}</span></div>
            <div>Quota: Rate-Limit Auto Rotation</div>
          </div>
        </div>

        {/* OpenRouter System One Protocol */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Lightning size={15} className="text-sky-400" />
              <span>OpenRouter (Jev 1.14)</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase font-mono">
              Decisions API
            </span>
          </div>

          <div className="text-2xl font-black text-white font-mono">
            &lt;30ms <span className="text-xs text-slate-500 font-sans">P95 Latency</span>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1 font-mono pt-1 border-t border-slate-800/80">
            <div>Model: <span className="text-sky-300 font-bold">typesafe/jev-1.14</span></div>
            <div>Input: $0.042/1M · Output: FREE</div>
          </div>
        </div>
      </div>

      {/* 1-Click Key Injection Form */}
      <form onSubmit={handleInjectKey} className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Plus size={14} weight="bold" className="text-indigo-400" />
          <span>Hot-Inject New Token (Zero-Restart)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Service Target</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
            >
              <option value="apify">Apify Scraper</option>
              <option value="gemini">Gemini API</option>
              <option value="openrouter">OpenRouter API</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">API Token Key</label>
            <input
              type="password"
              required
              placeholder="Paste token (apify_api_... / AIzaSy... / sk-or-...)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={injecting}
              className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus size={14} weight="bold" />
              <span>{injecting ? 'Injecting...' : 'Hot-Inject & Promote'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

