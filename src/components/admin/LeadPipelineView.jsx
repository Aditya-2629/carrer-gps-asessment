import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  MagnifyingGlass,
  DownloadSimple,
  Copy,
  Check,
  Eye,
  ArrowsClockwise,
  Kanban,
  Table as TableIcon,
  Sparkle,
  PhoneCall,
  CalendarCheck,
  CheckCircle,
  CurrencyDollar,
  Fire,
  UserCheck,
  TrendUp,
} from '@phosphor-icons/react'
import CandidateDossierModal from './CandidateDossierModal'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

const STAGES = [
  { id: 'new', label: 'New Leads', icon: '📥', color: 'border-slate-300 bg-slate-50' },
  { id: 'contacted', label: 'Contacted', icon: '💬', color: 'border-amber-300 bg-amber-50/40' },
  { id: 'scheduled', label: 'Call Scheduled', icon: '📅', color: 'border-indigo-300 bg-indigo-50/40' },
  { id: 'converted', label: 'Converted', icon: '🚀', color: 'border-emerald-300 bg-emerald-50/40' },
  { id: 'placed', label: 'Placed', icon: '🏆', color: 'border-purple-300 bg-purple-50/40' },
]

export default function LeadPipelineView({ token }) {
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' | 'table'
  const [leads, setLeads] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('ALL') // 'ALL' | 'COACHING_HOT' | 'RECRUITER_READY'
  const [stageFilter, setStageFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('intent_desc')
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const [updatingStageId, setUpdatingStageId] = useState(null)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  // Load Lead Stats & Leads
  const fetchLeadData = useCallback(async () => {
    try {
      setLoading(true)
      const [leadsRes, statsRes] = await Promise.all([
        fetch(
          `${API_BASE}/admin/leads?tier=${tierFilter}&stage=${stageFilter}&q=${encodeURIComponent(
            searchQuery
          )}&sort=${sortBy}&limit=100`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        fetch(`${API_BASE}/admin/leads/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const leadsJson = await leadsRes.json()
      const statsJson = await statsRes.json()

      if (leadsJson.success) setLeads(leadsJson.leads || [])
      if (statsJson.success) setStats(statsJson)
    } catch (err) {
      console.error('Failed to load lead data:', err)
    } finally {
      setLoading(false)
    }
  }, [token, tierFilter, stageFilter, searchQuery, sortBy])

  useEffect(() => {
    fetchLeadData()
  }, [fetchLeadData])

  // Change stage for a candidate
  const handleStageChange = async (candidateId, newStage) => {
    setUpdatingStageId(candidateId)
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${candidateId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage: newStage }),
      })
      if (!res.ok) throw new Error('Stage update failed')

      // Update in local state
      setLeads((prev) =>
        prev.map((l) => (l.userId === candidateId ? { ...l, leadStage: newStage } : l))
      )
      showToast(`Candidate stage moved to "${newStage}"`)
      // Refresh stats
      fetch(`${API_BASE}/admin/leads/stats`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setStats(data)
        })
        .catch(() => {})
    } catch (err) {
      alert(`Error updating stage: ${err.message}`)
    } finally {
      setUpdatingStageId(null)
    }
  }

  // Copy outreach pitch to clipboard
  const handleCopyPitch = (lead, type = 'email') => {
    const textToCopy = type === 'whatsapp' ? lead.whatsappPitch : lead.personalizedPitch
    if (!textToCopy) return
    navigator.clipboard.writeText(textToCopy)
    showToast(`Copied ${type === 'whatsapp' ? 'WhatsApp hook' : 'personalized pitch'} for ${lead.candidateName}!`)
  }

  // Export CSV
  const handleExportCsv = () => {
    const url = `${API_BASE}/admin/leads/export.csv`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `career_gps_leads_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        a.remove()
      })
      .catch(() => alert('Failed to export leads CSV.'))
  }

  // Group leads by stage for Kanban view
  const leadsByStage = useMemo(() => {
    const map = { new: [], contacted: [], scheduled: [], converted: [], placed: [] }
    leads.forEach((l) => {
      const st = l.leadStage || 'new'
      if (map[st]) map[st].push(l)
      else map.new.push(l)
    })
    return map
  }, [leads])

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP METRIC RIBBON */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Coaching Hot */}
        <div className="bg-white border border-rose-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Fire size={24} weight="fill" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coaching Hot Leads</div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {stats?.coachingHotLeads ?? 0}
            </div>
            <div className="text-[10px] text-rose-600 font-semibold mt-0.5">Resume Rewrite & Coaching</div>
          </div>
        </div>

        {/* Metric 2: Recruiter Ready */}
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={24} weight="fill" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recruiter-Ready Talent</div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {stats?.recruiterReadyLeads ?? 0}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">High Score (&ge;78) For Direct Placement</div>
          </div>
        </div>

        {/* Metric 3: Pipeline Conversions */}
        <div className="bg-white border border-indigo-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendUp size={24} weight="bold" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pipeline Conversion</div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {stats?.conversionRate ?? '0.0%'}
            </div>
            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Booked & Placed Rate</div>
          </div>
        </div>

        {/* Metric 4: Avg Intent Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkle size={24} weight="fill" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Intent Score</div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {stats?.avgIntentScore ?? 0}<span className="text-xs font-normal text-slate-400">/100</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Pain & Recency Index</div>
          </div>
        </div>
      </div>

      {/* FILTER & VIEW CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name or email…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Tier Selector */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer focus:outline-none"
          >
            <option value="ALL">All Monetization Tiers</option>
            <option value="COACHING_HOT">🔴 Coaching Hot Leads</option>
            <option value="RECRUITER_READY">🟢 Recruiter-Ready Talent</option>
          </select>

          {/* Stage Selector */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer focus:outline-none"
          >
            <option value="ALL">All Stages</option>
            <option value="new">New Leads</option>
            <option value="contacted">Contacted</option>
            <option value="scheduled">Call Scheduled</option>
            <option value="converted">Converted</option>
            <option value="placed">Placed</option>
          </select>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer focus:outline-none"
          >
            <option value="intent_desc">Highest Intent First</option>
            <option value="score_desc">Highest ATS Score</option>
            <option value="score_asc">Lowest ATS Score (Highest Pain)</option>
            <option value="newest">Most Recent</option>
          </select>
        </div>

        {/* View Toggle & Export */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Kanban size={14} />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <DownloadSimple size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* PIPELINE VIEWS */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400">
          <ArrowsClockwise size={32} className="animate-spin text-indigo-500 mb-2" />
          <p className="text-xs">Loading Talent Monetization Pipeline...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
          No candidates match current filters.
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {STAGES.map((col) => {
            const colLeads = leadsByStage[col.id] || []
            return (
              <div key={col.id} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 flex flex-col min-h-[500px]">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <span>{col.icon}</span>
                    <span>{col.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                    {colLeads.length}
                  </span>
                </div>

                {/* Candidate Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[75vh] pr-0.5">
                  {colLeads.map((lead) => (
                    <div
                      key={lead.userId}
                      className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow space-y-2.5"
                    >
                      {/* Name & Tier */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="font-bold text-xs text-slate-900 leading-tight">
                            {lead.candidateName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{lead.targetRole}</div>
                        </div>
                        {lead.leadTier === 'RECRUITER_READY' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            Ready
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                            Hot
                          </span>
                        )}
                      </div>

                      {/* Scores Ribbon */}
                      <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">ATS Score</span>
                          <span className="font-bold text-slate-800 tabular-nums">
                            {lead.overallScore ?? '—'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase">Intent</span>
                          <span className="font-bold text-indigo-600 tabular-nums">
                            {lead.intentScore}/100
                          </span>
                        </div>
                      </div>

                      {/* Top Missing Skills Chips */}
                      {lead.topMissingSkills?.length > 0 && (
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Key Gaps:</div>
                          <div className="flex flex-wrap gap-1">
                            {lead.topMissingSkills.slice(0, 3).map((sk, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-100 font-medium"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 1-Click Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                        <div className="flex items-center gap-1">
                          {/* Copy Pitch Button */}
                          <button
                            onClick={() => handleCopyPitch(lead, 'email')}
                            title="Copy Email Outreach Script"
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                          >
                            <Copy size={13} weight="bold" />
                          </button>
                          {/* WhatsApp Hook */}
                          <button
                            onClick={() => handleCopyPitch(lead, 'whatsapp')}
                            title="Copy WhatsApp Hook"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer text-[10px] font-bold"
                          >
                            WA
                          </button>
                          {/* Inspect Dossier */}
                          <button
                            onClick={() => setSelectedCandidateId(lead.userId)}
                            title="Open Candidate Dossier (God Mode)"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          >
                            <Eye size={13} />
                          </button>
                        </div>

                        {/* Move Stage Selector */}
                        <select
                          value={lead.leadStage || 'new'}
                          onChange={(e) => handleStageChange(lead.userId, e.target.value)}
                          disabled={updatingStageId === lead.userId}
                          className="text-[10px] bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 cursor-pointer focus:outline-none"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="converted">Converted</option>
                          <option value="placed">Placed</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Target Role</th>
                  <th className="py-3 px-4 text-center">ATS Score</th>
                  <th className="py-3 px-4 text-center">Intent Score</th>
                  <th className="py-3 px-4">Monetization Tier</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Key Gaps</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.userId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{lead.candidateName}</div>
                      <div className="text-[10px] font-normal text-slate-400">{lead.email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{lead.targetRole}</td>
                    <td className="py-3 px-4 text-center font-bold tabular-nums">
                      {lead.overallScore !== null ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            lead.overallScore >= 78
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {lead.overallScore}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-indigo-600 tabular-nums">
                      {lead.intentScore}/100
                    </td>
                    <td className="py-3 px-4">
                      {lead.leadTier === 'RECRUITER_READY' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Recruiter Ready
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Coaching Hot
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={lead.leadStage || 'new'}
                        onChange={(e) => handleStageChange(lead.userId, e.target.value)}
                        className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 cursor-pointer"
                      >
                        <option value="new">New Leads</option>
                        <option value="contacted">Contacted</option>
                        <option value="scheduled">Call Scheduled</option>
                        <option value="converted">Converted</option>
                        <option value="placed">Placed</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {lead.topMissingSkills?.slice(0, 3).map((sk, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-100"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleCopyPitch(lead, 'email')}
                          title="Copy Personalized Pitch"
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Copy size={13} /> Pitch
                        </button>
                        <button
                          onClick={() => setSelectedCandidateId(lead.userId)}
                          title="View Candidate Dossier"
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye size={13} /> Dossier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GOD MODE DOSSIER MODAL */}
      {selectedCandidateId && (
        <CandidateDossierModal
          candidateId={selectedCandidateId}
          onClose={() => setSelectedCandidateId(null)}
          token={token}
        />
      )}
    </div>
  )
}

