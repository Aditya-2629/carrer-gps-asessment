import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Target,
  ArrowsLeftRight,
  Cpu,
  CurrencyDollar,
  MagnifyingGlass,
  DownloadSimple,
  Trash,
  Eye,
  WarningCircle,
  ArrowsClockwise,
  SignOut,
  CaretRight,
  Check,
} from '@phosphor-icons/react'
import { TOKEN_KEY } from './AdminLogin.jsx'
import MarketTaxonomyStudio from '../../components/admin/MarketTaxonomyStudio.jsx'
import FallbackErrorTriageSection from '../../components/admin/FallbackErrorTriageSection.jsx'
import LlmCostAndQuotaCockpit from '../../components/admin/LlmCostAndQuotaCockpit.jsx'
import LeadPipelineView from '../../components/admin/LeadPipelineView.jsx'
import CandidateDossierModal from '../../components/admin/CandidateDossierModal.jsx'
import brandLogo from '../../assets/images/crafture-logo.jpg'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'http://localhost:5000/api'
    : '/api')

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
  if (v === null || v === undefined) {
    return <span className="text-[11px] text-slate-400 font-mono">—</span>
  }
  const color =
    v >= 85
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : v >= 70
      ? 'bg-teal-50 text-teal-700 border-teal-200'
      : v >= 55
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : v >= 40
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-rose-50 text-rose-700 border-rose-200'
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border tabular-nums ${color}`}>
      {v}
    </span>
  )
}

export default function AdminPanel({ onLogout }) {
  // 5 Canonical Master Tabs:
  // 'candidates' | 'market_taxonomy' | 'fallbacks_errors' | 'llm_telemetry' | 'lead_crm'
  const [currentTab, setCurrentTab] = useState('candidates')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const token = localStorage.getItem(TOKEN_KEY) || ''

  // Global Candidate Dossier Modal State
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)

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
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

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
        setSelectedUserIds([]) // reset selection on change
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

  const handleToggleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(users.map((u) => u.id))
    }
  }

  const handleToggleSelectUser = (id) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return
    setBulkDeleting(true)
    try {
      const { ok } = await api('/admin/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
      })
      if (ok) {
        setSelectedUserIds([])
        setConfirmBulkDelete(false)
        fetchUsers()
        fetchGlobalMetrics()
      }
    } catch (err) {
      alert(`Bulk delete error: ${err.message}`)
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* ── SLEEK EXECUTIVE LIGHT COLLAPSIBLE SIDEBAR ── */}
      <aside
        className={`${
          sidebarCollapsed ? 'md:w-20' : 'md:w-64'
        } w-full bg-white border-r border-slate-200/90 text-slate-600 flex flex-col justify-between shrink-0 transition-all duration-200 z-30 shadow-xs`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={brandLogo}
                alt="Crafture Logo"
                className="w-8 h-8 rounded-xl object-cover ring-2 ring-indigo-500/20 shadow-xs"
              />
              {!sidebarCollapsed && (
                <div>
                  <div className="font-black text-sm text-slate-900 tracking-tight leading-tight flex items-center gap-1.5 font-poppins">
                    <span>Crafture</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider font-mono">
                    Ops Cockpit
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <CaretRight
                size={14}
                className={`transition-transform duration-200 ${sidebarCollapsed ? '' : 'rotate-180'}`}
              />
            </button>
          </div>

          {/* Navigation Items (5 Canonical Tabs) */}
          <nav className="p-3 space-y-1 text-xs font-semibold">
            {/* Tab 1: Candidates & Users */}
            <button
              onClick={() => setCurrentTab('candidates')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'candidates'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users size={18} weight={currentTab === 'candidates' ? 'bold' : 'regular'} />
                {!sidebarCollapsed && <span>Candidates &amp; Users</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="text-[10px] text-slate-500 font-mono px-2 py-0.5 rounded-full bg-slate-100">
                  {total || globalStats?.totalLeads || 0}
                </span>
              )}
            </button>

            {/* Tab 2: Market & Skills Taxonomy Studio */}
            <button
              onClick={() => setCurrentTab('market_taxonomy')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'market_taxonomy'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Target size={18} weight={currentTab === 'market_taxonomy' ? 'bold' : 'regular'} />
                {!sidebarCollapsed && <span>Market Taxonomy Studio</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="text-[10px] text-slate-500 font-mono px-2 py-0.5 rounded-full bg-slate-100">
                  {engineSummary?.bucketSummary?.total ?? 16} bkt
                </span>
              )}
            </button>

            {/* Tab 3: Fallbacks & Error Triage */}
            <button
              onClick={() => setCurrentTab('fallbacks_errors')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'fallbacks_errors'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ArrowsLeftRight size={18} weight={currentTab === 'fallbacks_errors' ? 'bold' : 'regular'} />
                {!sidebarCollapsed && <span>Fallbacks &amp; Error Triage</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  SLA
                </span>
              )}
            </button>

            {/* Tab 4: LLM Cost & Quotas */}
            <button
              onClick={() => setCurrentTab('llm_telemetry')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'llm_telemetry'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Cpu size={18} weight={currentTab === 'llm_telemetry' ? 'bold' : 'regular'} />
                {!sidebarCollapsed && <span>LLM Costs &amp; Quotas</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                  ₹0.71
                </span>
              )}
            </button>

            {/* Tab 5: Lead Talent CRM Pipeline */}
            <button
              onClick={() => setCurrentTab('lead_crm')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'lead_crm'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CurrencyDollar size={18} weight={currentTab === 'lead_crm' ? 'bold' : 'regular'} />
                {!sidebarCollapsed && <span>Lead Talent CRM</span>}
              </div>
              {!sidebarCollapsed && globalStats?.coachingHotLeads > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                  {globalStats.coachingHotLeads} Hot
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Admin Online</span>
            </div>
          )}
          <button
            onClick={logout}
            title="Sign out of Admin Console"
            className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <SignOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT WORKSPACE ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Operations Pulse Bar */}
        <header className="bg-white/80 border-b border-slate-200/90 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight font-poppins">
                {currentTab === 'candidates' && 'Candidate Records & Verification Directory'}
                {currentTab === 'market_taxonomy' && 'Market Intelligence & Skills Taxonomy Studio'}
                {currentTab === 'fallbacks_errors' && 'Fallback Frequency & User Error Triage Studio'}
                {currentTab === 'llm_telemetry' && 'LLM Unit Economics, Token Quotas & Latency Cockpit'}
                {currentTab === 'lead_crm' && 'Talent Monetization & High-Converting Leads CRM'}
              </h1>
              <p className="text-[11px] text-slate-500">
                {currentTab === 'candidates' && 'Manage users, verification status, resume uploads, and cascade account deletions.'}
                {currentTab === 'market_taxonomy' && 'Zero-Syntax scrape launcher, skills frequency % sliders, and custom specialization linkage.'}
                {currentTab === 'fallbacks_errors' && 'Observe Jev-to-Gemini failovers, Apify quota circuits, and diagnose user drop-offs.'}
                {currentTab === 'llm_telemetry' && 'Track ₹0.71 unit cost, live SmartKeyPool statuses, and audit all LLM generation calls.'}
                {currentTab === 'lead_crm' && 'Intent scoring, Coaching Hot vs Recruiter Ready tiers, and 1-click outreach hooks.'}
              </p>
            </div>
          </div>

          {/* Pulse Status Badges */}
          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            {/* OpenRouter Jev 1.14 Pill */}
            <div className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 flex items-center gap-1.5 text-sky-800 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              <span>Jev 1.14: &lt;30ms</span>
            </div>

            {/* Apify Key Pool Pill */}
            <div className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 flex items-center gap-1.5 text-emerald-800 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Apify Pool: {engineSummary?.smartKeyPools?.apify?.keyCount ?? 1} Keys</span>
            </div>

            {/* MongoDB Connection Pill */}
            <div className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 flex items-center gap-1.5 text-indigo-800 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>MongoDB: Connected</span>
            </div>

            <button
              onClick={fetchGlobalMetrics}
              title="Refresh telemetry metrics"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowsClockwise size={14} />
            </button>
          </div>
        </header>

        {/* View Switcher Container */}
        <main className="p-6 flex-1 space-y-6">
          {/* TAB 1: CANDIDATES & USERS DIRECTORY */}
          {currentTab === 'candidates' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={filters.q}
                    onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                    placeholder="Search candidate email or resume name…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                  />
                </div>

                <select
                  value={filters.verified}
                  onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.value }))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-600"
                >
                  <option value="">All Verification</option>
                  <option value="true">Verified Only</option>
                  <option value="false">Unverified</option>
                </select>

                <select
                  value={filters.hasResume}
                  onChange={(e) => setFilters((f) => ({ ...f, hasResume: e.target.value }))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-600"
                >
                  <option value="">All Resumes</option>
                  <option value="true">Has Uploaded Resume</option>
                </select>

                <select
                  value={filters.sort}
                  onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-600"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="score_desc">Highest Career Health Score</option>
                </select>
              </div>

              {/* Bulk Action Bar */}
              {selectedUserIds.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                    <Trash size={16} />
                    <span>{selectedUserIds.length} candidate(s) selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedUserIds([])}
                      className="px-3 py-1 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Clear Selection
                    </button>
                    <button
                      onClick={() => setConfirmBulkDelete(true)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash size={14} weight="bold" />
                      <span>Delete Selected ({selectedUserIds.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Candidate Table */}
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={users.length > 0 && selectedUserIds.length === users.length}
                            onChange={handleToggleSelectAll}
                            className="rounded accent-indigo-600 cursor-pointer"
                            title="Select all on this page"
                          />
                        </th>
                        <th className="py-3 px-4 font-semibold">Candidate Email</th>
                        <th className="py-3 px-4 font-semibold">Created</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Resume File</th>
                        <th className="py-3 px-4 text-center font-semibold">Career Score</th>
                        <th className="py-3 px-4 text-center font-semibold">Resume Score</th>
                        <th className="py-3 px-4 text-center font-semibold">LinkedIn Score</th>
                        <th className="py-3 px-4 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-500">
                            <ArrowsClockwise size={24} className="animate-spin text-indigo-600 mx-auto mb-2" />
                            Loading candidate records...
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            No candidates match current filters.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr
                            key={u.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              selectedUserIds.includes(u.id) ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-3 w-8">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(u.id)}
                                onChange={() => handleToggleSelectUser(u.id)}
                                className="rounded accent-indigo-600 cursor-pointer"
                              />
                            </td>
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
                                <button
                                  type="button"
                                  onClick={() => setSelectedCandidateId(u.id)}
                                  title="Inspect God-Mode Dossier"
                                  className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                                >
                                  <Eye size={15} />
                                </button>
                                {u.hasResume && (
                                  <a
                                    href={`${API_BASE}/admin/users/${u.id}/resume`}
                                    title="Download original resume"
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                                  >
                                    <DownloadSimple size={15} />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete(u)}
                                  title="Delete User"
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
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
                  <span className="text-slate-500">
                    {total} users · page {page} of {pages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer font-semibold text-slate-600"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page >= pages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer font-semibold text-slate-600"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MARKET & SKILLS TAXONOMY STUDIO */}
          {currentTab === 'market_taxonomy' && <MarketTaxonomyStudio token={token} />}

          {/* TAB 3: FALLBACK FREQUENCY & USER ERROR TRIAGE STUDIO */}
          {currentTab === 'fallbacks_errors' && (
            <FallbackErrorTriageSection
              token={token}
              onSelectCandidate={(id) => setSelectedCandidateId(id)}
            />
          )}

          {/* TAB 4: DEEP LLM TELEMETRY, UNIT COSTING & QUOTA COCKPIT */}
          {currentTab === 'llm_telemetry' && <LlmCostAndQuotaCockpit token={token} />}

          {/* TAB 5: TALENT MONETIZATION & LEADS CRM */}
          {currentTab === 'lead_crm' && <LeadPipelineView token={token} />}
        </main>
      </div>

      {/* ── GLOBAL CANDIDATE DOSSIER MODAL (GOD MODE) ── */}
      {selectedCandidateId && (
        <CandidateDossierModal
          candidateId={selectedCandidateId}
          token={token}
          onClose={() => setSelectedCandidateId(null)}
        />
      )}

      {/* Single Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <WarningCircle size={20} weight="fill" />
              <span>Delete {confirmDelete.email}?</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This permanently deletes the candidate's account, uploaded resume, and generated reports with full cascade cleanup.
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

      {/* Bulk Delete Confirmation Modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <WarningCircle size={20} weight="fill" />
              <span>Bulk Delete {selectedUserIds.length} Candidate(s)?</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This permanently deletes the selected {selectedUserIds.length} candidates, uploaded resumes, agent runs, and generated reports with full cascade cleanup.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleting}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedUserIds.length} Users`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
