import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowsClockwise,
  WarningCircle,
  CheckCircle,
  Lightning,
  ShieldCheck,
  ArrowsLeftRight,
  Database,
  Key,
  Flame,
  ArrowRight,
  Cpu,
  Sparkle,
  Hourglass,
  Check,
} from '@phosphor-icons/react'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'http://localhost:5000/api'
    : '/api')

export default function FallbackAndErrorStudio({ token }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [purging, setPurging] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/telemetry/fallbacks-and-errors`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) {
        setData(json)
      } else {
        showToast(json.message || 'Failed to load telemetry')
      }
    } catch (err) {
      console.error('Error fetching fallback analytics:', err)
      showToast('Error loading telemetry data.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handlePurgeCooldowns = async () => {
    setPurging(true)
    try {
      const res = await fetch(`${API_BASE}/admin/telemetry/purge-cooldowns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) {
        showToast(json.message)
        fetchData()
      } else {
        alert(json.message || 'Failed to purge cooldowns')
      }
    } catch (err) {
      alert(`Error purging cooldowns: ${err.message}`)
    } finally {
      setPurging(false)
    }
  }

  const bottlenecks = data?.userBottlenecks || {}
  const totalAudited = bottlenecks.totalUsersAudited || 1

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header & Fast Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white tracking-tight">
              Fallback Frequency &amp; User Error Triage Studio
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
              Live Observability
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time monitoring of automated model failovers, provider quota health, and candidate pipeline drop-off bottlenecks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin text-indigo-400' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handlePurgeCooldowns}
            disabled={purging}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Instantly clear cooldown penalties on exhausted keys to re-test them"
          >
            <Lightning size={14} weight="fill" />
            <span>{purging ? 'Purging...' : 'Purge Cooldowns & Revive Keys'}</span>
          </button>
        </div>
      </div>

      {/* ── CARD 1: ACTIVE FALLBACK TRIGGERS ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowsLeftRight size={18} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Automated Fallback Architecture &amp; SLA Preservation
            </h3>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Zero-Downtime Guarantee Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(data?.fallbackTriggers || []).map((fb) => (
            <div
              key={fb.id}
              className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase font-mono ${
                    fb.status === 'ACTIVE_HEALTHY_FALLBACK'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {fb.status}
                </span>
                <span className="text-xs font-mono font-bold text-sky-400" title="Success SLA Hit Rate">
                  {fb.hitRate} Hit Rate
                </span>
              </div>

              {/* Path Visual */}
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs font-mono font-semibold">
                <span className="text-rose-400 truncate max-w-[120px]" title={fb.from}>
                  {fb.from.split('/')[1] || fb.from}
                </span>
                <ArrowRight size={14} className="text-slate-500 shrink-0" />
                <span className="text-emerald-400 truncate max-w-[120px]" title={fb.to}>
                  {fb.to.split('/')[1] || fb.to}
                </span>
              </div>

              <div className="text-[11px] text-slate-300 leading-relaxed">
                {fb.reason}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Protocol: {fb.protocol}</span>
                <span className="text-amber-300 font-bold">{fb.latencyDelta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CARD 2: TOP FAILING ENDPOINTS & SMARTKEYPOOL HEALTH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <WarningCircle size={18} className="text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Top Failing Endpoints &amp; Key Limits
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            SmartKeyPool automatically penalizes exhausted keys, applies cooldowns, and switches to fallback keys.
          </p>

          <div className="space-y-3">
            {(data?.topFailingEndpoints || []).map((ep, i) => (
              <div
                key={i}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{ep.name}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                        ep.severity === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : ep.severity === 'LOW'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {ep.severity}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Key / Target: <code className="text-indigo-300 font-mono">{ep.failingKey}</code>
                  </div>
                  <div className="text-[11px] text-rose-400/90 font-mono font-medium">
                    {ep.errorType}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Mitigation: {ep.impact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CARD 3: USER-FACING ERROR & BOTTLENECK TRIAGE ── */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Frequent User Errors &amp; Drop-Off Bottlenecks
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Breakdown of candidate blockers across the last 30 days ({bottlenecks.totalUsersAudited || 0} total candidates).
          </p>

          <div className="space-y-3.5 pt-1">
            {/* Missing LinkedIn */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Missing LinkedIn Profile URL (Cross-Audit Blindspot)</span>
                <span className="font-mono font-bold text-amber-400">{bottlenecks.missingLinkedIn || 0} candidates</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((bottlenecks.missingLinkedIn || 0) / totalAudited) * 100))}%` }}
                />
              </div>
            </div>

            {/* Unverified OTP */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Unverified OTP (Abandoned Sign-In)</span>
                <span className="font-mono font-bold text-rose-400">{bottlenecks.unverifiedOtp || 0} candidates</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((bottlenecks.unverifiedOtp || 0) / totalAudited) * 100))}%` }}
                />
              </div>
            </div>

            {/* Corrupt / Scanned PDF */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Corrupt / Scanned PDF (Needs OCR Engine)</span>
                <span className="font-mono font-bold text-indigo-400">{bottlenecks.corruptOrScannedPdf || 0} files</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((bottlenecks.corruptOrScannedPdf || 0) / totalAudited) * 100))}%` }}
                />
              </div>
            </div>

            {/* Missing Resume */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Candidate Upload Abandoned (No Resume Uploaded)</span>
                <span className="font-mono font-bold text-slate-400">{bottlenecks.missingResume || 0} candidates</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-slate-700 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((bottlenecks.missingResume || 0) / totalAudited) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARD 4: ERROR BREAKDOWN AUDIT ── */}
      {data?.errorBreakdown?.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Agent Execution Failure Frequency ({data.totalFailedRuns} Events)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Error Code / Diagnostic Message</th>
                  <th className="py-2.5 px-3 text-right">Occurrences</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.errorBreakdown.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 font-mono">
                    <td className="py-2 px-3 text-rose-300 max-w-md truncate" title={item.error}>
                      {item.error}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-white">{item.count}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
