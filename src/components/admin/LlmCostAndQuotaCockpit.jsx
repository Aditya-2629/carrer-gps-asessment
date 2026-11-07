import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CurrencyDollar,
  ChartBar,
  Lightning,
  Cpu,
  Key,
  ArrowsClockwise,
  MagnifyingGlass,
  Funnel,
  WarningCircle,
  CheckCircle,
  Hourglass,
  Check,
  TrendUp,
  Sparkle,
} from '@phosphor-icons/react'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'http://localhost:5000/api'
    : '/api')

export default function LlmCostAndQuotaCockpit({ token }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modelFilter, setModelFilter] = useState('ALL')
  const [agentFilter, setAgentFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/telemetry/llm-calls-and-quotas`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) {
        setData(json)
      } else {
        showToast(json.message || 'Failed to load telemetry')
      }
    } catch (err) {
      console.error('Failed to load LLM telemetry:', err)
      showToast('Error loading LLM telemetry.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summary = data?.summary || {}
  const costByModel = data?.costByModel || []
  const detailedCalls = data?.detailedCalls || []
  const keyPools = data?.keyPools || {}

  // Filtered detailed calls
  const filteredCalls = useMemo(() => {
    return detailedCalls.filter((c) => {
      if (modelFilter !== 'ALL' && !c.model.toLowerCase().includes(modelFilter.toLowerCase())) {
        return false
      }
      if (agentFilter !== 'ALL' && c.agent?.toLowerCase() !== agentFilter.toLowerCase()) {
        return false
      }
      if (search) {
        const q = search.toLowerCase()
        const matches =
          c.id?.toLowerCase().includes(q) ||
          c.stage?.toLowerCase().includes(q) ||
          c.model?.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [detailedCalls, modelFilter, agentFilter, search])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white tracking-tight">
              Deep LLM Telemetry, Unit Costing &amp; SmartKeyPool Quota Cockpit
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              Live Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time tracking of token burn, USD/INR unit economics, latency distribution, and SmartKeyPool provider quotas.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <ArrowsClockwise size={14} className={loading ? 'animate-spin text-indigo-400' : ''} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* ── TOP METRIC RIBBON ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Live Assessment Spend */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <span>Live Run Unit Cost</span>
            <CurrencyDollar size={18} weight="fill" className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight flex items-baseline gap-2">
            <span>{summary.avgCostPerRunInr || '₹0.71'}</span>
            <span className="text-xs text-slate-400 font-normal">(${summary.avgCostPerRunUsd || 0.0082})</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Ultra-lean micro-batch costing across complete 6-Phase assessment.
          </div>
        </div>

        {/* Metric 2: Total Tokens Burned */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-400 uppercase tracking-wider">
            <span>Total Tokens Burned</span>
            <Cpu size={18} weight="fill" className="text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {(summary.totalTokensBurned || 0).toLocaleString()} <span className="text-xs text-slate-400 font-normal">tok</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-2">
            <span>In: {(summary.inputTokens || 0).toLocaleString()}</span>
            <span>·</span>
            <span>Out: {(summary.outputTokens || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Metric 3: Latency Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-sky-400 uppercase tracking-wider">
            <span>Latency Distribution</span>
            <Hourglass size={18} weight="fill" className="text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight flex items-baseline gap-2">
            <span>P50: {summary.p50LatencySec || '2.4s'}</span>
            <span className="text-xs text-amber-400 font-bold">P95: {summary.p95LatencySec || '5.6s'}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Measured from incoming candidate query to response flush.
          </div>
        </div>

        {/* Metric 4: Total Calls Logged */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-purple-400 uppercase tracking-wider">
            <span>Audit Trail Depth</span>
            <ChartBar size={18} weight="fill" className="text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {summary.totalCallsLogged || 0} <span className="text-xs text-slate-400 font-normal">runs logged</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Total Spend: <strong className="text-white">${summary.totalSpendUsd || 0}</strong> ({summary.totalSpendInr ? `₹${summary.totalSpendInr}` : '—'})
          </div>
        </div>
      </div>

      {/* ── SECTION: SMARTKEYPOOL LIVE QUOTA GAUGES ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              SmartKeyPool Live Provider Quota Gauges
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Active Rotation: Apify Pool ({keyPools.apify?.totalKeys || 0} Keys) · OpenRouter Priority
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Apify Keys */}
          {(keyPools.apify?.keys || []).map((k) => (
            <div
              key={k.keyId}
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-mono">
                  Apify Key ({k.endingWith})
                </span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border font-mono uppercase ${
                    k.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                  }`}
                >
                  {k.status}
                </span>
              </div>

              {/* Progress Gauge */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Monthly Usage:</span>
                  <span
                    className={`font-mono font-bold ${
                      k.percentageUsed >= 100 ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {k.quotaEstimate}
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      k.percentageUsed >= 100
                        ? 'bg-rose-500'
                        : k.percentageUsed >= 70
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${k.percentageUsed}%` }}
                  />
                </div>
              </div>

              {k.warning ? (
                <div className="p-2 bg-rose-950/30 border border-rose-900/40 rounded-xl text-[10px] text-rose-300 font-medium">
                  ⚠️ {k.warning}
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 font-mono">
                  Plan: {k.monthlyPlan} · Healthy
                </div>
              )}
            </div>
          ))}

          {/* OpenRouter Main */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono">
                OpenRouter Main ({keyPools.openRouter?.activeKey || '...0021'})
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono uppercase">
                CONNECTED
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Balance Status:</span>
                <span className="font-mono font-bold text-emerald-400">
                  Remaining: {keyPools.openRouter?.estimatedRemaining || '$42.50'}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${keyPools.openRouter?.percentageUsed || 28}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-400 font-mono truncate" title="Active Models">
              Models: {(keyPools.openRouter?.models || []).join(', ')}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION: COST BY MODEL DISTRIBUTION ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <TrendUp size={18} className="text-indigo-400" />
          <span>Operational Spend by Model &amp; Provider</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {costByModel.map((m) => (
            <div
              key={m.model}
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold text-white font-mono truncate" title={m.model}>
                  {m.model}
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400">
                  ${m.usd} <span className="text-[10px] text-slate-500">({m.inr ? `₹${m.inr}` : ''})</span>
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Tokens: {m.tokens.toLocaleString()}</span>
                  <span className="font-mono font-bold text-indigo-400">{m.percentageOfSpend}% of spend</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{ width: `${m.percentageOfSpend}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION: GRANULAR LLM CALL AUDIT TABLE ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Detailed LLM Call Audit Trail ({filteredCalls.length} of {detailedCalls.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Exact invocation records with latency, token consumption, and dollar/rupee unit expenses.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-48">
              <MagnifyingGlass size={13} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stage, model, ID..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Agents</option>
              <option value="resume">Resume Agent</option>
              <option value="linkedin">LinkedIn Agent</option>
              <option value="judge">Judge / Overall</option>
            </select>

            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Models</option>
              <option value="gemini">Gemini Models</option>
              <option value="jev">Jev 1.14</option>
              <option value="llama">Llama 3.3</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Request ID</th>
                <th className="py-2.5 px-3">Stage / Purpose</th>
                <th className="py-2.5 px-3">Model Used</th>
                <th className="py-2.5 px-3 text-right">Tokens</th>
                <th className="py-2.5 px-3 text-right">Latency</th>
                <th className="py-2.5 px-3 text-right">Cost ($ / ₹)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    No LLM calls matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredCalls.slice(0, 30).map((call) => (
                  <tr key={call.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-indigo-400 font-bold truncate max-w-[120px]" title={call.id}>
                      {call.id.slice(-8)}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium max-w-[180px] truncate" title={call.stage}>
                      {call.stage}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
                        {call.model.split('/')[1] || call.model}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                      {call.totalTokens.toLocaleString()} <span className="text-[10px] text-slate-500">tok</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-300">
                      {call.latencySec}s
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">
                      ${call.costUsd} <span className="text-[10px] text-slate-500">(₹{call.costInr})</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase font-mono ${
                          call.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {call.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
