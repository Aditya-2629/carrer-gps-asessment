import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  Plus,
  Trash,
  PencilSimple,
  Check,
  WarningCircle,
  PushPin,
  MagnifyingGlass,
  SlidersHorizontal,
  Sparkle,
  ArrowsClockwise,
  Sliders,
  Tag,
  Funnel,
} from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

const CATEGORY_TABS = [
  { id: 'all', label: 'All Skills' },
  { id: 'tools', label: 'Tools & Platforms' },
  { id: 'languages', label: 'Languages' },
  { id: 'cloud', label: 'Cloud & Infra' },
  { id: 'data', label: 'Data & Databases' },
  { id: 'core', label: 'Pinned Core 📌' },
]

export default function VisualTaxonomyStudio({ bucketKey, token, onClose }) {
  const [skills, setSkills] = useState([])
  const [sampleSize, setSampleSize] = useState(0)
  const [activeVersion, setActiveVersion] = useState(1)
  const [roleInfo, setRoleInfo] = useState({ roleName: '', specialization: '', experienceBucket: '' })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [toastMsg, setToastMsg] = useState('')

  // Add skill state
  const [showAdd, setShowAdd] = useState(false)
  const [newSkill, setNewSkill] = useState({
    name: '',
    percentage: 60,
    priority: 'HIGH',
    category: 'tools',
    isPinned: false,
  })
  const [savingSkill, setSavingSkill] = useState(false)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const loadSkills = useCallback(async () => {
    if (!bucketKey) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${bucketKey}/skills`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setSkills(data.skills || [])
        setSampleSize(data.sampleSize || 0)
        setActiveVersion(data.version || 1)
        setRoleInfo({
          roleName: data.roleName || '',
          specialization: data.specialization || 'general',
          experienceBucket: data.experienceBucket || '',
        })
      }
    } catch (err) {
      console.error('Failed to load bucket skills taxonomy:', err)
      showToast('Failed to load skills taxonomy.')
    } finally {
      setLoading(false)
    }
  }, [bucketKey, token])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  // Update skill percentage slider live
  const handleSliderChange = async (skillName, newPct) => {
    const targetSkill = skills.find((s) => s.name?.toLowerCase() === skillName.toLowerCase())
    if (!targetSkill) return

    // Optimistic UI update
    setSkills((prev) =>
      prev.map((s) =>
        s.name?.toLowerCase() === skillName.toLowerCase()
          ? { ...s, percentage: newPct, count: Math.round((newPct / 100) * (sampleSize || 35)) }
          : s
      )
    )

    try {
      await fetch(`${API_BASE}/admin/market-library/${bucketKey}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: skillName,
          percentage: Number(newPct),
          priority: targetSkill.priority || 'HIGH',
          isPinned: Boolean(targetSkill.isPinned),
          category: targetSkill.category || 'tools',
        }),
      })
    } catch (err) {
      console.error('Failed to persist slider change:', err)
    }
  }

  // Toggle quick pin
  const handleTogglePin = async (skill) => {
    const nextPinned = !skill.isPinned
    setSkills((prev) => {
      const updated = prev.map((s) =>
        s.name?.toLowerCase() === skill.name?.toLowerCase()
          ? { ...s, isPinned: nextPinned, priority: nextPinned ? 'CORE' : 'HIGH' }
          : s
      )
      return updated.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.percentage - a.percentage)
    })

    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${bucketKey}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: skill.name,
          percentage: skill.percentage,
          priority: nextPinned ? 'CORE' : 'HIGH',
          isPinned: nextPinned,
          category: skill.category || 'tools',
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(nextPinned ? `Pinned "${skill.name}" to Core Competencies!` : `Unpinned "${skill.name}".`)
      }
    } catch (err) {
      console.error('Error toggling pin:', err)
    }
  }

  // Delete skill token
  const handleDeleteSkill = async (skillName) => {
    if (!window.confirm(`Delete skill token "${skillName}" from active bucket?`)) return
    try {
      const res = await fetch(
        `${API_BASE}/admin/market-library/${bucketKey}/skills/${encodeURIComponent(skillName)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      const data = await res.json()
      if (data.success) {
        setSkills((prev) => prev.filter((s) => s.name?.toLowerCase() !== skillName.toLowerCase()))
        showToast(`Skill "${skillName}" deleted from market bucket.`)
      }
    } catch (err) {
      alert(`Error deleting skill: ${err.message}`)
    }
  }

  // Add new skill
  const handleAddSkill = async (e) => {
    e.preventDefault()
    if (!newSkill.name.trim()) return
    setSavingSkill(true)
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${bucketKey}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newSkill,
          name: newSkill.name.trim(),
          percentage: Number(newSkill.percentage),
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Manual skill "${newSkill.name.trim()}" saved!`)
        setShowAdd(false)
        setNewSkill({ name: '', percentage: 60, priority: 'HIGH', category: 'tools', isPinned: false })
        loadSkills()
      }
    } catch (err) {
      alert(`Error saving skill: ${err.message}`)
    } finally {
      setSavingSkill(false)
    }
  }

  // Filter skills
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category?.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      if (activeCategory === 'core') return Boolean(s.isPinned || s.priority === 'CORE')
      if (activeCategory === 'tools') return s.category === 'tools' || /tool|platform|library|framework/i.test(s.category || '')
      if (activeCategory === 'languages') return /language|script|code/i.test(s.category || '')
      if (activeCategory === 'cloud') return /cloud|infra|devops|aws|azure/i.test(s.category || '')
      if (activeCategory === 'data') return /data|sql|database|storage|warehouse/i.test(s.category || '')

      return true
    })
  }, [skills, searchQuery, activeCategory])

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Toast */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-1">
            <Check size={16} weight="bold" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Studio Header */}
        <div className="p-6 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                <Sliders size={18} weight="bold" />
              </div>
              <h3 className="text-base font-black text-white tracking-tight">
                Visual Market Skills Studio: <span className="text-indigo-400 font-mono">{bucketKey}</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                Active v{activeVersion}
              </span>
              {roleInfo.specialization && roleInfo.specialization !== 'general' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Spec: {roleInfo.specialization}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Interactive market skill taxonomy from {sampleSize} live JDs. Drag sliders to adjust penetration weight, pin core must-haves, or purge noisy tokens.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(!showAdd)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
            >
              <Plus size={14} weight="bold" />
              <span>{showAdd ? 'Cancel' : '+ Add Manual Skill'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Add Skill Drawer */}
        {showAdd && (
          <form
            onSubmit={handleAddSkill}
            className="p-5 bg-slate-950/80 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end animate-in slide-in-from-top-2"
          >
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Skill Token Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Snowflake or Apache Kafka"
                value={newSkill.name}
                onChange={(e) => setNewSkill((s) => ({ ...s, name: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Market Frequency % ({newSkill.percentage}%)
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={newSkill.percentage}
                onChange={(e) => setNewSkill((s) => ({ ...s, percentage: Number(e.target.value) }))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Category
              </label>
              <select
                value={newSkill.category}
                onChange={(e) => setNewSkill((s) => ({ ...s, category: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-300 focus:outline-none"
              >
                <option value="tools">Tools & Platforms</option>
                <option value="languages">Languages</option>
                <option value="cloud">Cloud & Infra</option>
                <option value="databases">Databases & Storage</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={savingSkill}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {savingSkill ? 'Injecting...' : 'Save into Taxonomy'}
              </button>
            </div>
          </form>
        )}

        {/* Toolbar: Category tabs + Search */}
        <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_TABS.map((cat) => {
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <MagnifyingGlass size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search skills by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Interactive Skills Grid */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <ArrowsClockwise size={18} className="animate-spin text-indigo-400" />
              <span>Loading visual skills taxonomy matrix...</span>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              No skills match the current search or category filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSkills.map((s, idx) => {
                const count = s.count ?? s.frequency ?? Math.round(((s.percentage || 50) / 100) * (sampleSize || 35))
                const isPinned = Boolean(s.isPinned || s.priority === 'CORE')

                return (
                  <div
                    key={s.name || idx}
                    className={`bg-slate-900/90 border rounded-2xl p-4 transition-all flex flex-col justify-between space-y-3 ${
                      isPinned
                        ? 'border-amber-500/50 bg-gradient-to-r from-amber-950/20 to-slate-900 shadow-md shadow-amber-500/5'
                        : 'border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Skill Name, Pin, Category, Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(s)}
                          title={isPinned ? 'Unpin skill' : 'Pin as Core Competency'}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isPinned
                              ? 'text-amber-400 bg-amber-500/20'
                              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <PushPin size={14} weight={isPinned ? 'fill' : 'regular'} />
                        </button>

                        <div>
                          <span className="font-bold text-sm text-white">{s.name}</span>
                          {s.category && (
                            <span className="ml-2 text-[10px] uppercase font-bold text-slate-500">
                              {s.category}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPinned && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            CORE 📌
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSkill(s.name)}
                          title="Purge Noise Token"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Occurrence Badge & Percentage Slider */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400">
                          {count} of {sampleSize || 35} JDs
                        </span>
                        <span className="font-mono font-bold text-sm text-indigo-400 tabular-nums">
                          {s.percentage}%
                        </span>
                      </div>

                      {/* Interactive percentage range slider */}
                      <div className="relative pt-1">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={s.percentage || 50}
                          onChange={(e) => handleSliderChange(s.name, parseInt(e.target.value, 10))}
                          className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Bottom Status Ribbon */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Priority: <strong className="text-slate-200">{s.priority || 'HIGH'}</strong></span>
                      <span className="font-mono">Weight: {s.percentage >= 70 ? '🟢 Critical' : s.percentage >= 40 ? '🔵 High' : '⚪ Secondary'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

