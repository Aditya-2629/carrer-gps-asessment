import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Target,
  SlidersHorizontal,
  Plus,
  ArrowsClockwise,
  Check,
  Lightning,
  Sparkle,
  WarningCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  Trash,
  PencilSimple,
  PushPin,
} from '@phosphor-icons/react'
import ZeroSyntaxScrapeCockpit from './ZeroSyntaxScrapeCockpit.jsx'
import VisualTaxonomyStudio from './VisualTaxonomyStudio.jsx'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

export default function MarketBucketManager({ token }) {
  const [buckets, setBuckets] = useState([])
  const [engineConfig, setEngineConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fastCatchSlider, setFastCatchSlider] = useState(35)
  const [backgroundSlider, setBackgroundSlider] = useState(50)
  const [savingSliders, setSavingSliders] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newSpecialization, setNewSpecialization] = useState('')
  const [creatingRole, setCreatingRole] = useState(false)
  const [showAddRoleModal, setShowAddRoleModal] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [scrapingBucketKey, setScrapingBucketKey] = useState(null)
  const [selectedBucketForSkills, setSelectedBucketForSkills] = useState(null)
  const [bucketToDelete, setBucketToDelete] = useState(null)

  const showToast = (msg) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 4000)
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [bucketsRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/admin/market-library`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/admin/engine/config`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const bucketsData = await bucketsRes.json()
      const configData = await configRes.json()

      if (bucketsData.success) {
        setBuckets(bucketsData.buckets || [])
      }
      if (configData.success) {
        setEngineConfig(configData)
        setFastCatchSlider(configData.scrapeTargets?.fastCatchTargetJds || 35)
        setBackgroundSlider(configData.scrapeTargets?.backgroundTargetJds || 50)
      }
    } catch (err) {
      console.error('Failed to load market buckets:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Save Scrape Slider Targets Live
  const handleSaveSliders = async () => {
    setSavingSliders(true)
    try {
      const res = await fetch(`${API_BASE}/admin/engine/scrape-slider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fastCatchTargetJds: fastCatchSlider,
          backgroundTargetJds: backgroundSlider,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to update sliders')
      showToast(`Scrape targets updated live: Fast-Catch (${fastCatchSlider}), Background (${backgroundSlider})!`)
    } catch (err) {
      alert(`Error saving sliders: ${err.message}`)
    } finally {
      setSavingSliders(false)
    }
  }

  // Create New Dynamic Target Role
  const handleCreateRole = async (e) => {
    e.preventDefault()
    if (!newRoleName.trim()) return
    setCreatingRole(true)
    try {
      const res = await fetch(`${API_BASE}/admin/engine/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roleName: newRoleName.trim(),
          specialization: newSpecialization.trim() || 'general',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to create role')

      showToast(`Created 4 experience tier buckets for "${newRoleName}"!`)
      setNewRoleName('')
      setNewSpecialization('')
      setShowAddRoleModal(false)
      loadData()
    } catch (err) {
      alert(`Error creating role: ${err.message}`)
    } finally {
      setCreatingRole(false)
    }
  }

  // Trigger Scrape on Single Bucket
  const handleTriggerScrape = async (bucketKey, mode = 'fast_catch') => {
    setScrapingBucketKey(bucketKey)
    try {
      const res = await fetch(`${API_BASE}/admin/engine/scrape/${bucketKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to trigger scrape')
      showToast(data.message || `Scrape initiated for ${bucketKey}`)
      // Update local bucket status
      setBuckets((prev) =>
        prev.map((b) => (b.bucketKey === bucketKey ? { ...b, status: 'refreshing' } : b))
      )
    } catch (err) {
      alert(`Scrape error: ${err.message}`)
    } finally {
      setScrapingBucketKey(null)
    }
  }

  // Cascade Delete Bucket and Versions
  const handleDeleteBucketCascade = (bucketKey) => {
    setBucketToDelete(bucketKey)
  }

  const confirmDeleteBucket = async (bucketKey) => {
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${bucketKey}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to delete bucket')
      showToast(data.message || `Bucket ${bucketKey} deleted.`)
      setBuckets((prev) => prev.filter((b) => b.bucketKey !== bucketKey))
      setBucketToDelete(null)
    } catch (err) {
      alert(`Error deleting bucket: ${err.message}`)
    }
  }

  // Targeted Scrape Dispatcher
  const handleZeroSyntaxScrape = async ({ roleName, bucketKey, experienceBucket, specialization, mode }) => {
    setScrapingBucketKey(bucketKey)
    try {
      // If bucket does not exist yet, ensure the 4 experience tiers are created
      const exists = buckets.some((b) => b.bucketKey === bucketKey)
      if (!exists) {
        await fetch(`${API_BASE}/admin/engine/roles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            roleName,
            specialization,
          }),
        })
      }

      // Dispatch targeted scrape
      const res = await fetch(`${API_BASE}/admin/engine/scrape/${bucketKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode, specialization }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to dispatch scrape')
      showToast(data.message || `Targeted scrape initiated for ${bucketKey}`)
      loadData()
    } catch (err) {
      alert(`Error dispatching targeted scrape: ${err.message}`)
    } finally {
      setScrapingBucketKey(null)
    }
  }

  // Staggered Refresh for All Active Buckets
  const handleScrapeAll = async () => {
    const res = await fetch(`${API_BASE}/admin/market-library/scrape-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Failed to refresh all buckets')
    showToast(data.message || 'Staggered scrape enqueued for all active buckets.')
    loadData()
  }

  const uniqueRoles = useMemo(() => {
    return Array.from(new Set(buckets.map((b) => b.roleName).filter(Boolean)))
  }, [buckets])

  return (
    <div className="space-y-6">
      {/* Toast */}
      {actionMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* ZERO-SYNTAX DYNAMIC SCRAPE COCKPIT */}
      <ZeroSyntaxScrapeCockpit
        onScrapeTriggered={handleZeroSyntaxScrape}
        onScrapeAllTriggered={handleScrapeAll}
        rolesList={uniqueRoles}
      />

      {/* TOP CONTROLS: SLIDERS & ADD ROLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sliders Card */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Zero-Restart Live Scrape Sliders
              </h3>
            </div>
            <button
              onClick={handleSaveSliders}
              disabled={savingSliders}
              className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-2xs transition-colors"
            >
              {savingSliders ? 'Saving...' : 'Save Targets Live'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            {/* Slider 1: Fast-Catch Target */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Lightning size={14} className="text-amber-500" /> Fast-Catch Target JDs
                </span>
                <span className="font-black text-indigo-600 tabular-nums text-sm">
                  {fastCatchSlider} JDs
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="75"
                step="5"
                value={fastCatchSlider}
                onChange={(e) => setFastCatchSlider(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>15 (Ultra-Fast)</span>
                <span>35 (Standard)</span>
                <span>75 (Maximum)</span>
              </div>
            </div>

            {/* Slider 2: Background Target */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Database size={14} className="text-sky-500" /> Background Deep Corpus
                </span>
                <span className="font-black text-indigo-600 tabular-nums text-sm">
                  {backgroundSlider} JDs
                </span>
              </div>
              <input
                type="range"
                min="25"
                max="100"
                step="5"
                value={backgroundSlider}
                onChange={(e) => setBackgroundSlider(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>25 JDs</span>
                <span>50 (Recommended)</span>
                <span>100 JDs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Add Role CTA Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkle size={16} weight="fill" />
              <span>Universal Multi-Domain</span>
            </div>
            <h4 className="text-base font-bold text-white mb-1">Inject New Target Role</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Dynamically initialize all 4 experience tiers (0-2, 3-5, 6-8, 8+) in MongoDB instantly with zero downtime.
            </p>
          </div>

          <button
            onClick={() => setShowAddRoleModal(true)}
            className="mt-4 w-full py-2 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
          >
            <Plus size={15} weight="bold" />
            <span>Add Custom Role Buckets</span>
          </button>
        </div>
      </div>

      {/* LIVE BUCKETS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Target size={16} className="text-indigo-600" />
              <span>Live Role × Experience Buckets ({buckets.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Active Apify scrape archives, version history, and on-demand replenishment triggers.
            </p>
          </div>

          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs flex items-center gap-1 cursor-pointer"
          >
            <ArrowsClockwise size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <ArrowsClockwise size={28} className="animate-spin text-indigo-500 mb-2" />
            <p className="text-xs">Loading Live Role Buckets...</p>
          </div>
        ) : buckets.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
            No market buckets found. Use "Add Custom Role" above to create your first bucket!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {buckets.map((b) => (
              <div
                key={b.bucketKey}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Header: Role & Exp */}
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <div>
                      <div className="font-bold text-xs text-slate-900 leading-tight">
                        {b.roleName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Exp: <span className="text-indigo-600 font-bold">{b.experienceBucket} yrs</span>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        b.status === 'healthy'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : b.status === 'refreshing'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse'
                          : b.status === 'needs_refresh'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  {/* Metrics */}
                  <div className="bg-slate-50 p-2 rounded-xl text-[11px] flex items-center justify-between border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">JDs Parsed</span>
                      <span className="font-bold text-slate-900 tabular-nums">{b.jobCount || 0}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Active Version</span>
                      <span className="font-bold text-indigo-600 font-mono">v{b.activeVersion || 1}</span>
                    </div>
                  </div>
                </div>

                {/* 1-Click Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleTriggerScrape(b.bucketKey, 'fast_catch')}
                    disabled={scrapingBucketKey === b.bucketKey}
                    title="Run Fast-Catch (35 JDs)"
                    className="flex-1 min-w-[65px] py-1.5 px-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Lightning size={13} weight="fill" />
                    <span>Fast</span>
                  </button>
                  <button
                    onClick={() => handleTriggerScrape(b.bucketKey, 'full')}
                    disabled={scrapingBucketKey === b.bucketKey}
                    title="Enqueue Full Background Refresh"
                    className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Database size={13} />
                  </button>
                  <button
                    onClick={() => setSelectedBucketForSkills(b.bucketKey)}
                    title="Inspect & Edit Skills Taxonomy"
                    className="py-1.5 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <PushPin size={12} weight="fill" />
                    <span>Skills</span>
                  </button>
                  <button
                    onClick={() => handleDeleteBucketCascade(b.bucketKey)}
                    title="Cascade Delete Bucket & Versions"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD CUSTOM ROLE MODAL */}
      {showAddRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Inject New Target Role</h3>
              <p className="text-xs text-slate-500 mt-1">
                Creates 4 experience tier buckets (0-2, 3-5, 6-8, 8+) ready for live scraping.
              </p>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Target Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Cloud Security Architect or ICU Nurse"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Specialization / Domain (Optional)
                </label>
                <input
                  type="text"
                  value={newSpecialization}
                  onChange={(e) => setNewSpecialization(e.target.value)}
                  placeholder="e.g. AWS/GCP, Healthcare, Fintech"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRole}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {creatingRole ? 'Creating Buckets...' : 'Create 4 Buckets'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CASCADE DELETE CONFIRMATION MODAL */}
      {bucketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-white">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <Trash size={18} />
              <span>Delete Bucket &amp; Snapshots?</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Permanently delete bucket <strong className="text-slate-200">{bucketToDelete}</strong> and all historical version snapshots? This action is irreversible.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBucketToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteBucket(bucketToDelete)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-sm"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISUAL SKILLS TAXONOMY STUDIO MODAL */}
      {selectedBucketForSkills && (
        <VisualTaxonomyStudio
          bucketKey={selectedBucketForSkills}
          token={token}
          onClose={() => {
            setSelectedBucketForSkills(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

