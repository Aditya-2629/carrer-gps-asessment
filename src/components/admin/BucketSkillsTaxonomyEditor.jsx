import React, { useState, useEffect, useCallback } from 'react'
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
} from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

export default function BucketSkillsTaxonomyEditor({ bucketKey, token, onClose }) {
  const [skills, setSkills] = useState([])
  const [sampleSize, setSampleSize] = useState(0)
  const [activeVersion, setActiveVersion] = useState(1)
  const [roleInfo, setRoleInfo] = useState({ roleName: '', specialization: '', experienceBucket: '' })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
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

  // Inline edit state
  const [editingSkillName, setEditingSkillName] = useState(null)
  const [editPercentage, setEditPercentage] = useState(50)
  const [editPriority, setEditPriority] = useState('HIGH')
  const [editPinned, setEditPinned] = useState(false)

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

  // Delete skill
  const handleDeleteSkill = async (skillName) => {
    if (!window.confirm(`Delete skill "${skillName}" from active bucket taxonomy?`)) return
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
        showToast(`Skill "${skillName}" removed.`)
      } else {
        alert(data.message || 'Failed to delete skill')
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
        showToast(data.message || 'Skill added successfully!')
        setShowAdd(false)
        setNewSkill({ name: '', percentage: 60, priority: 'HIGH', category: 'tools', isPinned: false })
        loadSkills()
      } else {
        alert(data.message || 'Failed to save skill')
      }
    } catch (err) {
      alert(`Error saving skill: ${err.message}`)
    } finally {
      setSavingSkill(false)
    }
  }

  // Save inline edit
  const handleSaveInlineEdit = async (skillName) => {
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${bucketKey}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: skillName,
          percentage: Number(editPercentage),
          priority: editPriority,
          isPinned: Boolean(editPinned),
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Skill "${skillName}" updated to ${editPercentage}%.`)
        setEditingSkillName(null)
        loadSkills()
      } else {
        alert(data.message || 'Failed to update skill')
      }
    } catch (err) {
      alert(`Error updating skill: ${err.message}`)
    }
  }

  // Toggle quick pin
  const handleTogglePin = async (skill) => {
    const nextPinned = !skill.isPinned
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
          priority: nextPinned ? 'CORE' : (skill.priority || 'HIGH'),
          isPinned: nextPinned,
        }),
      })
      const data = await res.json()
      if (data.success) {
        loadSkills()
      }
    } catch (err) {
      console.error('Error toggling pin:', err)
    }
  }

  // Filter skills by search query
  const filteredSkills = skills.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      s.name?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q) ||
      s.priority?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Toast */}
        {toastMsg && (
          <div className="bg-slate-900 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2">
            <Check size={15} className="text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-900">
                Skills Taxonomy Studio: <span className="text-indigo-600 font-mono">{bucketKey}</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                Active v{activeVersion}
              </span>
              {roleInfo.specialization && roleInfo.specialization !== 'general' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  Spec: {roleInfo.specialization}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live extracted market skills from {sampleSize} analyzed JDs. Add overrides, pin core competencies, or delete noisy tokens.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <Plus size={14} weight="bold" />
              <span>{showAdd ? 'Cancel' : 'Add Custom Skill'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Add Skill Form Drawer */}
        {showAdd && (
          <form
            onSubmit={handleAddSkill}
            className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end"
          >
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Skill Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Snowflake or Terraform"
                value={newSkill.name}
                onChange={(e) => setNewSkill((s) => ({ ...s, name: e.target.value }))}
                className="w-full bg-white px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Market % (1-100)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={newSkill.percentage}
                onChange={(e) => setNewSkill((s) => ({ ...s, percentage: e.target.value }))}
                className="w-full bg-white px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Priority Tier
              </label>
              <select
                value={newSkill.priority}
                onChange={(e) => setNewSkill((s) => ({ ...s, priority: e.target.value }))}
                className="w-full bg-white px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="CORE">CORE 📌</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="SPEC">SPEC 🎯</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={savingSkill}
                className="w-full py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {savingSkill ? 'Saving...' : 'Save Skill'}
              </button>
            </div>
          </form>
        )}

        {/* Search & Stats Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter skills by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="text-xs text-slate-400">
            Showing <span className="font-bold text-slate-700">{filteredSkills.length}</span> of{' '}
            <span className="font-bold text-slate-700">{skills.length}</span> skills
          </div>
        </div>

        {/* Skills Table */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <ArrowsClockwise size={16} className="animate-spin text-indigo-600" />
              <span>Loading extracted skills taxonomy...</span>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No skills found in this market bucket version. Run a scrape to extract live skills.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 pl-2">Pin</th>
                  <th className="py-2.5">Skill Name</th>
                  <th className="py-2.5">Occurrences</th>
                  <th className="py-2.5">Frequency %</th>
                  <th className="py-2.5">Priority</th>
                  <th className="py-2.5 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSkills.map((s, idx) => {
                  const isEditing = editingSkillName === s.name

                  return (
                    <tr
                      key={s.name || idx}
                      className={`hover:bg-slate-50 transition-colors ${
                        s.isPinned ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Pin */}
                      <td className="py-2.5 pl-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(s)}
                          title={s.isPinned ? 'Unpin skill' : 'Pin as Core Competency'}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            s.isPinned
                              ? 'text-amber-600 bg-amber-100/60'
                              : 'text-slate-300 hover:text-slate-500'
                          }`}
                        >
                          <PushPin size={13} weight={s.isPinned ? 'fill' : 'regular'} />
                        </button>
                      </td>

                      {/* Skill Name */}
                      <td className="py-2.5 font-bold text-slate-900">
                        <span>{s.name}</span>
                        {s.category && (
                          <span className="ml-1.5 text-[9px] uppercase font-semibold text-slate-400">
                            ({s.category})
                          </span>
                        )}
                      </td>

                      {/* Occurrences */}
                      <td className="py-2.5 text-slate-500 tabular-nums">
                        {s.count ?? s.frequency ?? Math.round(((s.percentage || 50) / 100) * (sampleSize || 35))} /{' '}
                        {sampleSize || 35} JDs
                      </td>

                      {/* Percentage */}
                      <td className="py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={editPercentage}
                              onChange={(e) => setEditPercentage(e.target.value)}
                              className="w-16 px-2 py-0.5 text-xs font-bold border border-indigo-400 rounded-lg focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-400">%</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  s.percentage >= 70
                                    ? 'bg-emerald-500'
                                    : s.percentage >= 45
                                    ? 'bg-indigo-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, s.percentage || 0)}%` }}
                              />
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border tabular-nums ${
                                s.percentage >= 70
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : s.percentage >= 45
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {s.percentage}%
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-2.5">
                        {isEditing ? (
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            className="text-[10px] font-bold border border-indigo-400 rounded-lg px-2 py-0.5"
                          >
                            <option value="CORE">CORE 📌</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="SPEC">SPEC 🎯</option>
                          </select>
                        ) : (
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                              s.isPinned || s.priority === 'CORE'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : s.priority === 'HIGH'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : s.priority === 'SPEC'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {s.isPinned ? 'CORE 📌' : (s.priority || 'HIGH')}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 text-right pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveInlineEdit(s.name)}
                                className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-2xs"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSkillName(null)}
                                className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSkillName(s.name)
                                  setEditPercentage(s.percentage || 50)
                                  setEditPriority(s.priority || 'HIGH')
                                  setEditPinned(Boolean(s.isPinned))
                                }}
                                title="Edit Percentage & Priority"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              >
                                <PencilSimple size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSkill(s.name)}
                                title="Delete Skill Token"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
