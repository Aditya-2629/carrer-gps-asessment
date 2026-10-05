import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  ShieldCheck,
  FileText,
  ChartBar,
  CalendarBlank,
  MagnifyingGlass,
  DownloadSimple,
  Trash,
  Eye,
  X,
  WarningCircle,
  ArrowLeft,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import { TOKEN_KEY } from './AdminLogin.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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
    v >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : v >= 70 ? 'bg-teal-50 text-teal-700 border-teal-200'
    : v >= 55 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : v >= 40 ? 'bg-orange-50 text-orange-700 border-orange-200'
    : 'bg-red-50 text-red-700 border-red-200'
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded border tabular-nums ${color}`}>{v}</span>
}

// ─── Stats cards ─────────────────────────────────────────────────────────────
function StatsRow({ stats }) {
  if (!stats) return null
  const cards = [
    { icon: <Users size={18} className="text-indigo-500" />, label: 'Total Users', value: stats.totalUsers, sub: `+${stats.newThisWeek} this week` },
    { icon: <ShieldCheck size={18} className="text-emerald-500" />, label: 'Verified', value: stats.verifiedUsers, sub: `${stats.totalUsers ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0}% of total` },
    { icon: <FileText size={18} className="text-sky-500" />, label: 'Resumes on File', value: stats.withResume, sub: `+${stats.newToday} today` },
    { icon: <ChartBar size={18} className="text-violet-500" />, label: 'Reports Generated', value: stats.withReport, sub: `avg career ${stats.avgCareerScore ?? '—'}` },
    { icon: <ChartBar size={18} className="text-teal-500" />, label: 'Avg Resume Score', value: stats.avgResumeScore ?? '—', sub: 'Resume Agent' },
    { icon: <ChartBar size={18} className="text-amber-500" />, label: 'Avg LinkedIn Score', value: stats.avgLinkedinScore ?? '—', sub: 'LinkedIn Agent' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">{c.icon}<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</span></div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{c.value}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter bar ──────────────────────────────────────────────────────────────
const EMPTY_FILTERS = { q: '', verified: '', hasResume: '', hasReport: '', hasLinkedIn: '', from: '', to: '', sort: 'newest' }

function FilterBar({ filters, setFilters, onExport, exporting }) {
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const selectCls = 'bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q}
            onChange={set('q')}
            placeholder="Search by email or resume file…"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select value={filters.verified} onChange={set('verified')} className={selectCls}>
          <option value="">All verification</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
        <select value={filters.hasResume} onChange={set('hasResume')} className={selectCls}>
          <option value="">Resume: any</option>
          <option value="true">Has resume</option>
          <option value="false">No resume</option>
        </select>
        <select value={filters.hasReport} onChange={set('hasReport')} className={selectCls}>
          <option value="">Report: any</option>
          <option value="true">Has report</option>
          <option value="false">No report</option>
        </select>
        <select value={filters.hasLinkedIn} onChange={set('hasLinkedIn')} className={selectCls}>
          <option value="">LinkedIn: any</option>
          <option value="true">LinkedIn provided</option>
        </select>
        <input type="date" value={filters.from} onChange={set('from')} className={selectCls} title="From date" />
        <input type="date" value={filters.to} onChange={set('to')} className={selectCls} title="To date" />
        <select value={filters.sort} onChange={set('sort')} className={selectCls}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="score_desc">Highest career score</option>
          <option value="email">Email A–Z</option>
        </select>

        <button
          type="button"
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-2 cursor-pointer"
        >
          <ArrowsClockwise size={13} /> Reset
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="ml-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer"
        >
          <DownloadSimple size={15} weight="bold" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
    </div>
  )
}

// ─── Detail drawer ───────────────────────────────────────────────────────────
function DetailDrawer({ userId, api, onClose }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [showAnswers, setShowAnswers] = useState(false)

  useEffect(() => {
    let alive = true
    api(`/admin/users/${userId}`)
      .then(({ ok, data }) => {
        if (!alive) return
        if (ok) setUser(data.user)
        else setError(data.message || 'Failed to load.')
      })
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [userId, api])

  const meta = user?.aiReport
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-slate-50 h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 truncate">{user?.email || 'Loading…'}</h3>
            <p className="text-[11px] text-slate-400">
              {user ? `Joined ${new Date(user.createdAt).toLocaleDateString()} · ${user.isVerified ? 'Verified' : 'Unverified'}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20} /></button>
        </div>

        {error && <div className="m-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs flex items-center gap-2"><WarningCircle size={16} /> {error}</div>}

        {user && (
          <div className="p-6 space-y-5">
            {/* Score cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Career', v: user.careerScore },
                { label: 'Resume', v: user.resumeScore },
                { label: 'LinkedIn', v: user.linkedinScore },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{s.v ?? '—'}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Profile facts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2.5 text-xs">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Profile</h4>
              {[
                ['Target role', user.targetRole],
                ['Primary profile', user.primaryProfile],
                ['Resume file', user.resumeName],
                ['LinkedIn', user.linkedinUrl],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-slate-400 font-semibold shrink-0">{k}</span>
                  <span className="text-slate-700 text-right break-all">{v || '—'}</span>
                </div>
              ))}
            </div>

            {/* Downloads */}
            <div className="flex gap-2">
              <a
                href={`${API_BASE}/admin/users/${userId}/resume`}
                className="flex-1 text-center bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold py-2.5 rounded-xl"
              >
                ⭳ Resume File
              </a>
              <a
                href={`${API_BASE}/admin/users/${userId}/report`}
                className="flex-1 text-center bg-white border border-slate-200 hover:border-slate-400 text-slate-800 text-xs font-bold py-2.5 rounded-xl"
              >
                ⭳ Report JSON
              </a>
            </div>

            {/* Assessment answers */}
            {user.answers && Object.keys(user.answers).length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <button onClick={() => setShowAnswers((s) => !s)} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 cursor-pointer w-full text-left">
                  Assessment Answers ({Object.keys(user.answers).length}) {showAnswers ? '▾' : '▸'}
                </button>
                {showAnswers && (
                  <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                    {Object.entries(user.answers).map(([k, v]) => (
                      <div key={k} className="text-[11px] border-b border-slate-100 pb-1.5">
                        <span className="font-mono text-slate-400">{k}:</span>{' '}
                        <span className="text-slate-700">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Agent highlights */}
            {meta?.resume_agent?.dashboard && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Resume Agent Findings</h4>
                <div className="space-y-2">
                  {(meta.resume_agent.issues || []).slice(0, 5).map((i, idx) => (
                    <div key={idx} className="text-[11px] text-slate-600 flex gap-2">
                      <span className={`shrink-0 font-bold uppercase text-[9px] px-1.5 rounded ${i.severity === 'high' ? 'bg-red-50 text-red-600' : i.severity === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>{i.severity}</span>
                      <span className="truncate">{i.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Agent analytics (Phase E) ───────────────────────────────────────────────
function AgentAnalytics({ api }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    api('/admin/agents')
      .then(({ ok, data }) => (ok ? setData(data) : setError(data.message)))
      .catch((e) => setError(e.message))
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs">{error}</div>
  if (!data) return <div className="bg-white border border-slate-200 rounded-2xl p-6 text-xs text-slate-400">Loading agent analytics…</div>
  if (!data.agents?.length)
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-xs text-slate-400">
        No agent runs in the last 30 days yet. Generate a report to populate this.
      </div>
    )

  const agentNames = { resume: 'Resume Agent', linkedin: 'LinkedIn Agent', judge: 'Judge Agent', overall: 'Atlas (Overall)' }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Agent Analytics — last {data.windowDays} days · {data.feedbackTotal} candidate ratings
        </h3>
        <button onClick={load} className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer">↻ Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {data.agents.map((a) => (
          <div key={a.agent} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">{agentNames[a.agent] || a.agent}</span>
              <span className="text-[10px] font-mono text-slate-400">{a.runs} runs</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-base font-extrabold text-slate-900 tabular-nums">{a.successRate ?? '—'}%</div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Success</div>
              </div>
              <div>
                <div className="text-base font-extrabold text-slate-900 tabular-nums">{a.cacheRate ?? '—'}%</div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Cached</div>
              </div>
              <div>
                <div className="text-base font-extrabold text-slate-900 tabular-nums">
                  {a.avgJudgeScore ?? '—'}
                </div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Judge /10</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-500 border-t border-slate-100 pt-2">
              <span>p50: <b className="text-slate-700 tabular-nums">{a.p50LatencyMs != null ? (a.p50LatencyMs / 1000).toFixed(1) + 's' : '—'}</b></span>
              <span>p95: <b className="text-slate-700 tabular-nums">{a.p95LatencyMs != null ? (a.p95LatencyMs / 1000).toFixed(1) + 's' : '—'}</b></span>
              <span>tok in: <b className="text-slate-700 tabular-nums">{a.inputTokens?.toLocaleString() || '—'}</b></span>
              <span>tok out: <b className="text-slate-700 tabular-nums">{a.outputTokens?.toLocaleString() || '—'}</b></span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Candidate rating</span>
              <span className="text-xs font-bold">
                <span className="text-emerald-600">👍 {a.thumbsUp}</span>{' '}
                <span className="text-red-500">👎 {a.thumbsDown}</span>{' '}
                {a.acceptanceRate !== null && <span className="text-slate-400 font-mono text-[10px]">({a.acceptanceRate}%)</span>}
              </span>
            </div>

            {a.models?.length > 0 && (
              <div className="text-[9px] font-mono text-slate-300 truncate" title={a.models.join(', ')}>{a.models.join(', ')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function AdminPanel({ onLogout }) {
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [debounced, setDebounced] = useState(EMPTY_FILTERS)
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    onLogout()
  }, [onLogout])
  const api = useAdminApi(logout)

  // Debounce filters → query string
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(filters)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [filters])

  const queryString = useCallback(
    (extra = {}) => {
      const params = new URLSearchParams()
      Object.entries(debounced).forEach(([k, v]) => v && params.set(k, v))
      Object.entries(extra).forEach(([k, v]) => params.set(k, v))
      return params.toString()
    },
    [debounced]
  )

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { ok, data } = await api(`/admin/users?${queryString({ page, limit: 20 })}`)
      if (ok) {
        setUsers(data.users)
        setTotal(data.total)
        setPages(data.pages)
      } else setError(data.message || 'Failed to load users.')
    } catch (e) {
      if (e.message !== 'Session expired') setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [api, queryString, page])

  useEffect(() => {
    api('/admin/stats')
      .then(({ ok, data }) => ok && setStats(data.stats))
      .catch(() => {})
  }, [api])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleExport = async () => {
    setExporting(true)
    try {
      const { res } = await api(`/admin/users/export.csv?${queryString()}`)
      const blob = res instanceof Response ? await res.blob() : res.data
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crafture_users_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async (id) => {
    await api(`/admin/users/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    setDetailId(null)
    loadUsers()
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold">C</span>
            <div>
              <div className="text-sm font-extrabold text-slate-900 leading-tight">Crafture Admin Console</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">User & Agent Operations</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-lg text-slate-600 font-medium">← App</a>
            <button onClick={logout} className="text-xs bg-slate-900 hover:bg-slate-700 text-white font-bold px-3.5 py-2 rounded-lg cursor-pointer">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <StatsRow stats={stats} />

        <AgentAnalytics api={api} />

        <FilterBar filters={filters} setFilters={setFilters} onExport={handleExport} exporting={exporting} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs flex items-center gap-2">
            <WarningCircle size={16} weight="fill" /> {error}
          </div>
        )}

        {/* Users table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Email', 'Joined', 'Status', 'Resume', 'Career', 'Resume AI', 'LinkedIn AI', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-400">Loading users…</td></tr>
                )}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-400">No users match these filters.</td></tr>
                )}
                {!loading && users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {u.isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate" title={u.resumeName || ''}>
                      {u.resumeName ? <span className="text-slate-700">{u.resumeName}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">{scoreChip(u.careerScore)}</td>
                    <td className="px-4 py-3">{scoreChip(u.resumeScore)}</td>
                    <td className="px-4 py-3">{scoreChip(u.linkedinScore)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setDetailId(u.id)} title="View details" className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 cursor-pointer"><Eye size={15} weight="bold" /></button>
                        {u.hasResume && (
                          <a href={`${API_BASE}/admin/users/${u.id}/resume`} title="Download resume" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><DownloadSimple size={15} /></a>
                        )}
                        <button onClick={() => setConfirmDelete(u)} title="Delete user" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 cursor-pointer"><Trash size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs">
            <span className="text-slate-400">{total} users · page {page} of {pages}</span>
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
      </main>

      {/* Detail drawer */}
      {detailId && <DetailDrawer userId={detailId} api={api} onClose={() => setDetailId(null)} />}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <WarningCircle size={18} weight="fill" /> Delete {confirmDelete.email}?
            </div>
            <p className="text-xs text-slate-500">This permanently removes the user, their resume, and their report. This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white cursor-pointer">Delete permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
