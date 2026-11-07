import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Kanban,
  CurrencyDollar,
  Flame,
  CheckCircle,
  PhoneCall,
  CalendarCheck,
  Trophy,
  WhatsappLogo,
  EnvelopeSimple,
  ArrowsClockwise,
  ArrowRight,
  Eye,
  MagnifyingGlass,
  Funnel,
  Sparkle,
  Copy,
  Check,
  WarningCircle,
  DownloadSimple,
} from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

const STAGES = [
  { id: 'New', label: 'New Hot Leads', icon: '🔥', color: 'rose', border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  { id: 'Contacted', label: 'Contacted / Review', icon: '💬', color: 'amber', border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { id: 'Call Scheduled', label: 'Call Scheduled', icon: '📅', color: 'indigo', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
  { id: 'Placed', label: 'Converted / Placed', icon: '💰', color: 'emerald', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
]

export default function InteractiveLeadKanban({ token, onSelectCandidate }) {
  const [leads, setLeads] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('ALL') // 'ALL' | 'COACHING_HOT' | 'RECRUITER_READY'
  const [copiedKey, setCopiedKey] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [actionMsg, setActionMsg] = useState('')

  const showToast = (msg) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 3500)
  }

  const copyPitch = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2500)
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [leadsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/leads`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/admin/leads/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const leadsData = await leadsRes.json()
      const statsData = await statsRes.json()

      if (leadsData.success) setLeads(leadsData.leads || [])
      if (statsData.success) setStats(statsData)
    } catch (err) {
      console.error('Failed to load leads data:', err)
      showToast('Error loading leads.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Move candidate to another stage
  const handleMoveStage = async (candidateId, nextStage) => {
    setUpdatingId(candidateId)
    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) =>
        (l.id === candidateId || l.userId === candidateId)
          ? { ...l, pipelineStage: nextStage, leadStage: nextStage }
          : l
      )
    )

    try {
      const res = await fetch(`${API_BASE}/admin/leads/${candidateId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pipelineStage: nextStage }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Moved to "${nextStage}"!`)
      } else {
        alert(data.message || 'Failed to update stage')
        fetchData()
      }
    } catch (err) {
      console.error('Stage update error:', err)
      fetchData()
    } finally {
      setUpdatingId(null)
    }
  }

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const name = l.candidateName || l.name || ''
      const matchesSearch =
        !search ||
        l.email?.toLowerCase().includes(search.toLowerCase()) ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        l.targetRole?.toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      const tier = l.tier || l.leadTier
      if (tierFilter === 'COACHING_HOT') return tier === 'COACHING_HOT'
      if (tierFilter === 'RECRUITER_READY') return tier === 'RECRUITER_READY'

      return true
    })
  }, [leads, search, tierFilter])

  // Group by stage
  const columns = useMemo(() => {
    const map = {
      New: [],
      Contacted: [],
      'Call Scheduled': [],
      Placed: [],
    }

    filteredLeads.forEach((lead) => {
      let st = lead.pipelineStage || lead.leadStage || 'New'
      if (st === 'Converted') st = 'Placed'
      if (!map[st]) st = 'New'
      map[st].push(lead)
    })

    return map
  }, [filteredLeads])

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Top Operations Ribbon (Linear/Stripe Metrics Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Coaching Hot Leads */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-rose-400 uppercase tracking-wider">
            <span>Coaching Hot Leads</span>
            <Flame size={18} weight="fill" className="text-rose-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight">
            {stats?.coachingHotLeads ?? '0'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Score &lt;70 with high intent $\to$ $150–$300/mo coaching pipeline.
          </div>
        </div>

        {/* Metric 2: Recruiter Ready Talent */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <span>Recruiter Ready Pool</span>
            <CheckCircle size={18} weight="fill" className="text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight">
            {stats?.recruiterReadyLeads ?? '0'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Score &gt;78 with verified skills for placement monetizing.
          </div>
        </div>

        {/* Metric 3: Pipeline Conversion */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-400 uppercase tracking-wider">
            <span>Pipeline Conversion</span>
            <Trophy size={18} weight="fill" className="text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight">
            {stats?.pipelineConversion ?? '0%'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Scheduled calls &amp; placed candidates across total leads.
          </div>
        </div>

        {/* Metric 4: Avg Intent Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider">
            <span>Avg Lead Intent</span>
            <Sparkle size={18} weight="fill" className="text-amber-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight">
            {stats?.avgIntentScore ? `${stats.avgIntentScore}/100` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Urgency calculated from gap density, recency, and profile completeness.
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Tier Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setTierFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tierFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Candidates ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('COACHING_HOT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              tierFilter === 'COACHING_HOT'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-800 text-rose-400 hover:bg-slate-700'
            }`}
          >
            <Flame size={14} weight="fill" />
            <span>Coaching Hot ({stats?.coachingHotLeads ?? 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('RECRUITER_READY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              tierFilter === 'RECRUITER_READY'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
            }`}
          >
            <CheckCircle size={14} weight="fill" />
            <span>Recruiter Ready ({stats?.recruiterReadyLeads ?? 0})</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <MagnifyingGlass size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search candidate, role, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <a
            href={`${API_BASE}/admin/leads/export.csv`}
            download="leads_pipeline.csv"
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <DownloadSimple size={14} />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* 4-Column Interactive Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {STAGES.map((col) => {
          const colLeads = columns[col.id] || []

          return (
            <div
              key={col.id}
              className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 flex flex-col space-y-3 min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-base">{col.icon}</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    {col.label}
                  </h4>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${col.bg} ${col.text} ${col.border}`}
                >
                  {colLeads.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colLeads.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-slate-800/80 rounded-2xl flex items-center justify-center text-xs text-slate-600 font-medium">
                    No candidates in this stage
                  </div>
                ) : (
                  colLeads.map((cand) => {
                    const candId = cand.id || cand.userId
                    const initials = (cand.candidateName || cand.name || cand.email || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)

                    return (
                      <div
                        key={candId}
                        className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 shadow-md transition-all group"
                      >
                        {/* Candidate Card Top: Avatar, Role, ATS Score */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                              {initials}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white leading-tight">
                                {cand.candidateName || cand.name || cand.email.split('@')[0]}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                {cand.targetRole || 'Professional'}
                              </div>
                            </div>
                          </div>

                          {/* ATS Score Chip */}
                          <div
                            className={`px-2 py-0.5 rounded-lg font-mono font-bold text-[11px] border tabular-nums ${
                              cand.atsScore >= 80
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : cand.atsScore >= 65
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}
                            title="Candidate ATS Health Score"
                          >
                            {cand.atsScore ?? cand.overallScore ?? '—'}
                          </div>
                        </div>

                        {/* Intent Urgency & Missing Skills Tag */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Intent Score:</span>
                            <span
                              className={`font-mono font-bold ${
                                cand.intentScore >= 85 ? 'text-rose-400' : 'text-slate-300'
                              }`}
                            >
                              {cand.intentScore}/100
                            </span>
                          </div>

                          {/* Missing market skills pills */}
                          {cand.missingSkills?.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {cand.missingSkills.slice(0, 3).map((sk) => (
                                <span
                                  key={sk}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40"
                                >
                                  ✕ {sk}
                                </span>
                              ))}
                              {cand.missingSkills.length > 3 && (
                                <span className="text-[9px] text-slate-500 font-mono self-center">
                                  +{cand.missingSkills.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 1-Click Outreach Pitch Copy Buttons */}
                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => copyPitch(cand.whatsappPitch || cand.pitches?.whatsapp, `wa_${candId}`)}
                            title="Copy high-converting WhatsApp message hook"
                            className="py-1 px-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <WhatsappLogo size={12} weight="fill" />
                            <span>{copiedKey === `wa_${candId}` ? 'Copied! ✨' : 'WhatsApp'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => copyPitch(cand.personalizedPitch || cand.pitches?.email, `em_${candId}`)}
                            title="Copy personalized executive email pitch"
                            className="py-1 px-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-800/40 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <EnvelopeSimple size={12} weight="fill" />
                            <span>{copiedKey === `em_${candId}` ? 'Copied! ✨' : 'Email'}</span>
                          </button>
                        </div>

                        {/* Card Bottom: Quick Stage Advance & God-Mode Dossier Drawer Trigger */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => onSelectCandidate && onSelectCandidate(candId)}
                            className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye size={13} />
                            <span>Dossier</span>
                          </button>

                          {/* Quick stage advance selector */}
                          <select
                            value={col.id}
                            disabled={updatingId === candId}
                            onChange={(e) => handleMoveStage(candId, e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2 py-0.5 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="New">Move: New 🔥</option>
                            <option value="Contacted">Move: Contacted 💬</option>
                            <option value="Call Scheduled">Move: Scheduled 📅</option>
                            <option value="Placed">Move: Won 💰</option>
                          </select>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
