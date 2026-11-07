import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  ShieldCheck,
  FileText,
  ChartBar,
  MagnifyingGlass,
  DownloadSimple,
  Trash,
  Eye,
  X,
  WarningCircle,
  ArrowsClockwise,
  CurrencyDollar,
  Target,
  Key,
  SlidersHorizontal,
  Kanban,
  SignOut,
  Sparkle,
  Lightning,
  CaretRight,
} from '@phosphor-icons/react'
import { TOKEN_KEY } from './AdminLogin.jsx'
import LeadPipelineView from '../../components/admin/LeadPipelineView.jsx'
import MarketBucketManager from '../../components/admin/MarketBucketManager.jsx'
import DynamicEngineManager from '../../components/admin/DynamicEngineManager.jsx'
import KeyPoolMonitor from '../../components/admin/KeyPoolMonitor.jsx'
import brandLogo from '../../assets/images/crafture-logo.jpg'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

// ─── API helper with 401 auto-logout ─────────────────────────────────────────
function useAdminApi(logout) {
  return useCallback(
    async (path, options = {}) => {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        logout()
        throw new Error('Session expired')
      }
      const ct = res.headers.get('content-type') || ''
      const data = ct.includes('json') ? await res.json() : await res.blob()
      return { ok: res.ok, data, res }
    },
    [logout]
  )
}

const scoreChip = (v) => {
  if (v === null || v === undefined) return <span className="text-[11px] text-slate-300 font-mono">—</span>
  const color =
    v >= 85
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : v >= 70
      ? 'bg-teal-50 text-teal-700 border-teal-200'
      : v >= 55
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : v >= 40
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-red-50 text-red-700 border-red-200'
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded border tabular-nums ${color}`}>{v}</span>
}

export default function AdminPanel({ onLogout }) {
  const [currentTab, setCurrentTab] = useState('lead_crm') // 'lead_crm' | 'candidates' | 'market_buckets' | 'dynamic_engine'
  const token = localStorage.getItem(TOKEN_KEY) || ''

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    if (onLogout) onLogout()
  }, [onLogout])

  const api = useAdminApi(logout)

  // Global telemetry stats for top ribbon
  const [globalStats, setGlobalStats] = useState(null)
  const [engineSummary, setEngineSummary] = useState(null)

  const fetchGlobalMetrics = useCallback(async () => {
    try {
      const [statsRes, engineRes] = await Promise.all([
        api('/admin/leads/stats'),
        api('/admin/engine/config'),
      ])
      if (statsRes.ok) setGlobalStats(statsRes.data)
      if (engineRes.ok) setEngineSummary(engineRes.data)
    } catch (_err) {
      // session expired handled in useAdminApi
    }
  }, [api])

  useEffect(() => {
    fetchGlobalMetrics()
  }, [fetchGlobalMetrics])

  // ── Candidate Directory State ─────────────────────────────────────────────
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ q: '', verified: '', hasResume: '', sort: 'newest' })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (filters.q) params.set('q', filters.q)
      if (filters.verified) params.set('verified', filters.verified)
      if (filters.hasResume) params.set('hasResume', filters.hasResume)
      if (filters.sort) params.set('sort', filters.sort)

      const { ok, data } = await api(`/admin/users?${params.toString()}`)
      if (ok) {
        setUsers(data.users || [])
        setTotal(data.total || 0)
        setPages(data.pages || 1)
      }
    } catch (_err) {
    } finally {
      setLoading(false)
    }
  }, [api, page, filters])

  useEffect(() => {
    if (currentTab === 'candidates') {
      fetchUsers()
    }
  }, [currentTab, fetchUsers])

  const handleDeleteUser = async (userId) => {
    try {
      const { ok } = await api(`/admin/users/${userId}`, { method: 'DELETE' })
      if (ok) {
        setConfirmDelete(null)
        fetchUsers()
        fetchGlobalMetrics()
      }
    } catch (err) {
      alert(`Delete error: ${err.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800 antialiased">
      {/* ── SIDEBAR NAVIGATION ── */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
            <img src={brandLogo} alt="Crafture Logo" className="w-9 h-9 rounded-xl object-cover ring-1 ring-white/10" />
            <div>
              <div className="font-extrabold text-white text-sm tracking-tight">Crafture GPS</div>
              <div className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
                Command Center
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => setCurrentTab('lead_crm')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'lead_crm'
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CurrencyDollar size={18} weight={currentTab === 'lead_crm' ? 'bold' : 'regular'} />
                <span>Leads CRM Pipeline</span>
              </div>
              {globalStats?.coachingHotLeads > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {globalStats.coachingHotLeads} Hot
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('candidates')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'candidates'
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users size={18} weight={currentTab === 'candidates' ? 'bold' : 'regular'} />
                <span>Candidate Directory</span>
              </div>
              <span className="text-[10px] text-slate-500 tabular-nums">
                {globalStats?.totalLeads ?? '—'}
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('market_buckets')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'market_buckets'
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Target size={18} weight={currentTab === 'market_buckets' ? 'bold' : 'regular'} />
                <span>Market JD Buckets</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {engineSummary?.bucketSummary?.total ?? 16} bkt
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('dynamic_engine')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'dynamic_engine'
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal size={18} weight={currentTab === 'dynamic_engine' ? 'bold' : 'regular'} />
                <span>Dynamic Engine & Keys</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50" />
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Admin Authenticated</span>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <SignOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {currentTab === 'lead_crm' && <CurrencyDollar size={20} className="text-indigo-600" weight="bold" />}
              {currentTab === 'candidates' && <Users size={20} className="text-indigo-600" weight="bold" />}
              {currentTab === 'market_engine' && <Target size={20} className="text-indigo-600" weight="bold" />}
              {currentTab === 'key_pools' && <Key size={20} className="text-indigo-600" weight="bold" />}
              <span>
                {currentTab === 'lead_crm' && 'Talent Monetization Pipeline & Outreach CRM'}
                {currentTab === 'candidates' && 'Candidate Records & Raw Submissions'}
                {currentTab === 'market_engine' && 'Dynamic Market Intelligence & Scrape Sliders'}
                {currentTab === 'key_pools' && 'SmartKeyPool & AI Model Gateway Telemetry'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Career GPS Enterprise AI Recruitment Command Center & Ops Engine
            </p>
          </div>

          {/* Real-time Telemetry Badges */}
          <div className="flex items-center gap-2.5 text-xs">
            {/* Live Spend Badge */}
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-1.5 font-bold flex items-center gap-1.5 shadow-2xs">
              <Lightning size={14} weight="fill" className="text-emerald-600" />
              <span>Live Spend: $0.87 / User</span>
            </div>

            {/* Active Buckets Badge */}
            <div className="bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-3 py-1.5 font-medium flex items-center gap-1.5">
              <span className="font-bold text-indigo-600 tabular-nums">
                {engineSummary?.bucketSummary?.total ?? 16}
              </span>
              <span>Active Buckets</span>
            </div>

            {/* Total Leads Badge */}
            <div className="bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-3 py-1.5 font-medium flex items-center gap-1.5">
              <span className="font-bold text-slate-900 tabular-nums">
                {globalStats?.totalLeads ?? 0}
              </span>
              <span>Total Leads</span>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchGlobalMetrics}
              title="Refresh Global Telemetry"
              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            >
              <ArrowsClockwise size={15} />
            </button>
          </div>
        </header>

        {/* View Switcher Container */}
        <main className="p-6 flex-1 space-y-6">
          {/* VIEW 1: TALENT MONETIZATION CRM */}
          {currentTab === 'lead_crm' && <LeadPipelineView token={token} />}

          {/* VIEW 2: CANDIDATE DIRECTORY (RAW USERS TABLE) */}
          {currentTab === 'candidates' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={filters.q}
                    onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                    placeholder="Search candidate email or resume name…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={filters.verified}
                  onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.value }))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 cursor-pointer"
                >
                  <option value="">All Verification</option>
                  <option value="true">Verified Only</option>
                  <option value="false">Unverified</option>
                </select>

                <select
                  value={filters.hasResume}
                  onChange={(e) => setFilters((f) => ({ ...f, hasResume: e.target.value }))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 cursor-pointer"
                >
                  <option value="">All Resumes</option>
                  <option value="true">Has Uploaded Resume</option>
                </select>

                <select
                  value={filters.sort}
                  onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="score_desc">Highest Career Health Score</option>
                </select>
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Candidate Email</th>
                        <th className="py-3 px-4">Created</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Resume File</th>
                        <th className="py-3 px-4 text-center">Career Score</th>
                        <th className="py-3 px-4 text-center">Resume Score</th>
                        <th className="py-3 px-4 text-center">LinkedIn Score</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <ArrowsClockwise size={24} className="animate-spin text-indigo-500 mx-auto mb-2" />
                            Loading candidate records...
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            No candidates match current filters.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-900">{u.email}</td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  u.isVerified
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {u.isVerified ? 'Verified' : 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 max-w-[150px] truncate" title={u.resumeName || ''}>
                              {u.resumeName || '—'}
                            </td>
                            <td className="py-3 px-4 text-center">{scoreChip(u.careerScore)}</td>
                            <td className="py-3 px-4 text-center">{scoreChip(u.resumeScore)}</td>
                            <td className="py-3 px-4 text-center">{scoreChip(u.linkedinScore)}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {u.hasResume && (
                                  <a
                                    href={`${API_BASE}/admin/users/${u.id}/resume`}
                                    title="Download original resume"
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                                  >
                                    <DownloadSimple size={15} />
                                  </a>
                                )}
                                <button
                                  onClick={() => setConfirmDelete(u)}
                                  title="Delete User"
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors cursor-pointer"
                                >
                                  <Trash size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400">
                    {total} users · page {page} of {pages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer font-semibold"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page >= pages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer font-semibold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: MARKET JD BUCKETS */}
          {currentTab === 'market_buckets' && <MarketBucketManager token={token} />}

          {/* VIEW 4: DYNAMIC ENGINE & KEY POOLS */}
          {currentTab === 'dynamic_engine' && <DynamicEngineManager token={token} />}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <WarningCircle size={20} weight="fill" />
              <span>Delete {confirmDelete.email}?</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This permanently deletes the candidate's account, uploaded resume, and generated reports.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(confirmDelete.id)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
