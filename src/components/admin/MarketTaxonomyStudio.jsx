import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  MagnifyingGlass,
  SlidersHorizontal,
  PushPin,
  Trash,
  Plus,
  ArrowsClockwise,
  Lightning,
  Sparkle,
  Check,
  WarningCircle,
  Database,
  ChartBar,
  Funnel,
  TrendUp,
  CaretRight,
  Target,
} from '@phosphor-icons/react'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'http://localhost:5000/api'
    : '/api')

const PRESET_ROLES = [
  'Data Analyst',
  'Software Engineer',
  'Product Manager',
  'QA Engineer',
  'Cloud Architect',
  'DevOps Engineer',
  'AI / ML Engineer',
  'Sales Manager',
  'Scrum Master',
]

const EXP_TIERS = [
  { id: '0-2', label: '0–2 yrs', sub: 'Entry / Assoc' },
  { id: '3-5', label: '3–5 yrs', sub: 'Mid-Level' },
  { id: '6-8', label: '6–8 yrs', sub: 'Senior / Lead' },
  { id: '8+', label: '8+ yrs', sub: 'Staff / Principal' },
]

export default function MarketTaxonomyStudio({ token }) {
  // Scrape Launcher state
  const [selectedRole, setSelectedRole] = useState('Data Analyst')
  const [customRole, setCustomRole] = useState('')
  const [isCustomRole, setIsCustomRole] = useState(false)
  const [selectedExp, setSelectedExp] = useState('3-5')
  const [specialization, setSpecialization] = useState('Healthcare & EHR')
  const [scraping, setScraping] = useState(false)
  const [scrapeAllRunning, setScrapeAllRunning] = useState(false)

  // Buckets & Skills CRUD state
  const [buckets, setBuckets] = useState([])
  const [activeBucketKey, setActiveBucketKey] = useState('data-analyst::3-5')
  const [skills, setSkills] = useState([])
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [toastMsg, setToastMsg] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSkill, setNewSkill] = useState({
    name: '',
    percentage: 60,
    priority: 'HIGH',
    category: 'tools',
    isPinned: false,
  })
  const [bucketToDelete, setBucketToDelete] = useState(null)
  const [deletingBucket, setDeletingBucket] = useState(false)
  const [sanitizing, setSanitizing] = useState(false)

  // Multi-select & Bulk Delete state
  const [selectedBuckets, setSelectedBuckets] = useState([])
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bucketFilterQuery, setBucketFilterQuery] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  // Active role string
  const activeRoleName = isCustomRole ? customRole.trim() || 'Software Engineer' : selectedRole

  // Live Query Preview
  const liveApifyQuery = useMemo(() => {
    const spec = specialization.trim()
    return spec && spec.toLowerCase() !== 'general'
      ? `${activeRoleName} ${spec}`
      : activeRoleName
  }, [activeRoleName, specialization])

  // Computed bucket key for current selector
  const computedSelectorKey = useMemo(() => {
    const slug = activeRoleName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    return `${slug}::${selectedExp}`
  }, [activeRoleName, selectedExp])

  // Load bucket list
  const loadBuckets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/market-library`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setBuckets(data.buckets || [])
        if (!activeBucketKey && data.buckets?.length > 0) {
          setActiveBucketKey(data.buckets[0].bucketKey)
        }
      }
    } catch (err) {
      console.error('Failed to load buckets:', err)
    }
  }, [token, activeBucketKey])

  // Load skills for active bucket
  const loadSkills = useCallback(async () => {
    if (!activeBucketKey) return
    setLoadingSkills(true)
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${activeBucketKey}/skills`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setSkills(data.skills || [])
      } else {
        setSkills([])
      }
    } catch (err) {
      console.error('Failed to load skills:', err)
      setSkills([])
    } finally {
      setLoadingSkills(false)
    }
  }, [activeBucketKey, token])

  useEffect(() => {
    loadBuckets()
  }, [loadBuckets])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  // 1-Click Launch Targeted Scrape
  const handleLaunchScrape = async () => {
    setScraping(true)
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/create-specialized`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roleName: activeRoleName,
          specialization,
          experienceBucket: selectedExp,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Targeted scrape dispatched for "${liveApifyQuery}"!`)
        loadBuckets()
        setActiveBucketKey(data.bucketKey || computedSelectorKey)
      } else {
        alert(data.message || 'Scrape launch failed')
      }
    } catch (err) {
      alert(`Error launching scrape: ${err.message}`)
    } finally {
      setScraping(false)
    }
  }

  // 1-Click Scrape All Buckets (Staggered Queue)
  const handleScrapeAll = async () => {
    setScrapeAllRunning(true)
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/scrape-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      showToast(data.message || 'Scrape all enqueued with safe staggered queue.')
      loadBuckets()
    } catch (err) {
      alert(`Scrape all error: ${err.message}`)
    } finally {
      setScrapeAllRunning(false)
    }
  }

  // Live Skill Percentage Update
  const handleUpdatePercentage = async (skillName, newPct) => {
    // Optimistic UI update
    setSkills((prev) =>
      prev.map((s) => (s.name === skillName ? { ...s, percentage: Number(newPct) } : s))
    )

    try {
      await fetch(`${API_BASE}/admin/market-library/${activeBucketKey}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: skillName,
          percentage: Number(newPct),
        }),
      })
    } catch (err) {
      console.error('Failed to update percentage:', err)
      loadSkills()
    }
  }

  // Toggle Pin Core
  const handleTogglePin = async (skill) => {
    const nextPinned = !skill.isPinned
    setSkills((prev) =>
      prev.map((s) =>
        s.name === skill.name
          ? { ...s, isPinned: nextPinned, priority: nextPinned ? 'CORE' : 'HIGH' }
          : s
      )
    )

    try {
      await fetch(`${API_BASE}/admin/market-library/${activeBucketKey}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: skill.name,
          percentage: skill.percentage,
          isPinned: nextPinned,
          priority: nextPinned ? 'CORE' : 'HIGH',
        }),
      })
      showToast(`Skill "${skill.name}" pin status updated.`)
    } catch (err) {
      console.error('Failed to toggle pin:', err)
      loadSkills()
    }
  }

  // Delete Single Skill
  const handleDeleteSkill = async (skillName) => {
    setSkills((prev) => prev.filter((s) => s.name !== skillName))
    try {
      const res = await fetch(
        `${API_BASE}/admin/market-library/${activeBucketKey}/skills/${encodeURIComponent(skillName)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      const data = await res.json()
      if (data.success) {
        showToast(`Skill "${skillName}" deleted.`)
      }
    } catch (err) {
      console.error('Failed to delete skill:', err)
      loadSkills()
    }
  }

  // Add Skill Modal Submission
  const handleAddSkillSubmit = async (e) => {
    e.preventDefault()
    if (!newSkill.name.trim()) return

    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${activeBucketKey}/skills`, {
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
        showToast(`Skill "${newSkill.name}" added!`)
        setShowAddModal(false)
        setNewSkill({ name: '', percentage: 60, priority: 'HIGH', category: 'tools', isPinned: false })
        loadSkills()
      } else {
        alert(data.message || 'Failed to add skill')
      }
    } catch (err) {
      alert(`Error adding skill: ${err.message}`)
    }
  }

  // Cascade Delete Bucket
  const handleConfirmCascadeDelete = async () => {
    if (!bucketToDelete) return
    setDeletingBucket(true)
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${bucketToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || `Bucket ${bucketToDelete} deleted.`)
        setBucketToDelete(null)
        loadBuckets()
        if (activeBucketKey === bucketToDelete) {
          setActiveBucketKey('data-analyst::3-5')
        }
      } else {
        alert(data.message || 'Failed to delete bucket')
      }
    } catch (err) {
      alert(`Error deleting bucket: ${err.message}`)
    } finally {
      setDeletingBucket(false)
    }
  }

  // Filtered Buckets
  const filteredBuckets = useMemo(() => {
    if (!bucketFilterQuery.trim()) return buckets
    const q = bucketFilterQuery.toLowerCase()
    return buckets.filter(
      (b) => b.bucketKey.toLowerCase().includes(q) || (b.roleName || '').toLowerCase().includes(q)
    )
  }, [buckets, bucketFilterQuery])

  // Bulk Cascade Delete Selected Buckets
  const handleBulkDeleteBuckets = async () => {
    if (selectedBuckets.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bucketKeys: selectedBuckets }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Successfully deleted ${data.deletedBucketsCount || selectedBuckets.length} bucket(s) and ${data.deletedVersionsCount || 0} snapshots!`)
        const remaining = buckets.filter((b) => !selectedBuckets.includes(b.bucketKey))
        setSelectedBuckets([])
        setConfirmBulkDelete(false)
        setBuckets(remaining)
        if (selectedBuckets.includes(activeBucketKey)) {
          setActiveBucketKey(remaining.length > 0 ? remaining[0].bucketKey : '')
        }
        loadBuckets()
      } else {
        alert(data.message || 'Failed to bulk delete buckets.')
      }
    } catch (err) {
      alert(`Error during bulk delete: ${err.message}`)
    } finally {
      setBulkDeleting(false)
    }
  }

  // 1-Click Auto-Sanitize & Re-Calculate Core
  const handleAutoSanitize = async () => {
    if (!activeBucketKey) return
    setSanitizing(true)
    try {
      const res = await fetch(`${API_BASE}/admin/market-library/${activeBucketKey}/re-sanitize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Taxonomy re-sanitized! ${data.coreSkillsCount || 0} Core skills identified across ${data.sampleSize} JDs.`)
        loadSkills()
        loadBuckets()
      } else {
        alert(data.message || 'Failed to re-sanitize taxonomy')
      }
    } catch (err) {
      alert(`Error re-sanitizing taxonomy: ${err.message}`)
    } finally {
      setSanitizing(false)
    }
  }

  // Active Competency Clusters calculation
  const activeClusters = useMemo(() => {
    const isSwe = activeBucketKey.includes('software') || activeBucketKey.includes('engineer') || activeBucketKey.includes('developer')
    const clusterDefs = isSwe
      ? [
          { name: 'Backend Systems Programming', defaultDemand: 90, tools: ['Go', 'Java', 'Python', 'TypeScript', 'C++', 'Rust'] },
          { name: 'Cloud Infrastructure & Containerization', defaultDemand: 85, tools: ['AWS', 'GCP', 'Docker', 'Kubernetes', 'Terraform'] },
          { name: 'Event Streaming & Async Messaging', defaultDemand: 65, tools: ['Apache Kafka', 'RabbitMQ', 'Redis', 'AWS SQS'] },
        ]
      : [
          { name: 'Data Visualization & BI', defaultDemand: 56, tools: ['Power BI', 'Tableau', 'Looker', 'Metabase', 'Qlik'] },
          { name: 'Relational Database & SQL', defaultDemand: 71, tools: ['SQL', 'PostgreSQL', 'MySQL', 'SQL Server', 'T-SQL'] },
          { name: 'Spreadsheet & Modeling', defaultDemand: 58, tools: ['Excel', 'Google Sheets', 'Power Query'] },
          { name: 'Analytical Programming', defaultDemand: 48, tools: ['Python', 'R', 'Pandas', 'NumPy'] },
          { name: 'Cloud Data Warehousing', defaultDemand: 50, tools: ['Snowflake', 'BigQuery', 'Amazon Redshift', 'dbt'] },
        ]

    return clusterDefs.map((c) => {
      const matched = skills.filter((s) =>
        c.tools.some((t) => t.toLowerCase() === (s.name || '').toLowerCase())
      )
      let demand = c.defaultDemand
      if (matched.length > 0) {
        const sorted = [...matched].sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
        demand = sorted[0].percentage || 0
        for (let i = 1; i < sorted.length; i++) {
          demand = Math.min(100, Math.round(demand + (sorted[i].percentage || 0) * 0.35))
        }
      }
      return {
        name: c.name,
        demand: `${demand || c.defaultDemand}% Core`,
        tools: c.tools.slice(0, 4).join(', '),
      }
    })
  }, [activeBucketKey, skills])

  // Filter skills
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      if (categoryFilter === 'PINNED' && !s.isPinned) return false
      if (categoryFilter !== 'ALL' && categoryFilter !== 'PINNED') {
        if (s.category?.toLowerCase() !== categoryFilter.toLowerCase()) return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)
      }
      return true
    })
  }, [skills, categoryFilter, searchQuery])

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── TOP ZERO-SYNTAX SCRAPE COCKPIT (Crafture Executive Light Canvas) ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight font-poppins">
                Zero-Syntax Market Scrape Cockpit
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                Linear-Grade
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visual selector dispatches directly to Apify &amp; Gemini with zero manual syntax or regex.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScrapeAll}
              disabled={scrapeAllRunning}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Safe staggered refresh across all active buckets"
            >
              <ArrowsClockwise size={14} className={scrapeAllRunning ? 'animate-spin text-indigo-600' : ''} />
              <span>{scrapeAllRunning ? 'Queue Active...' : 'Staggered Scrape All'}</span>
            </button>

            <button
              type="button"
              onClick={handleLaunchScrape}
              disabled={scraping}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Lightning size={14} weight="fill" />
              <span>{scraping ? 'Dispatching...' : 'Launch Targeted Scrape'}</span>
            </button>
          </div>
        </div>

        {/* 3 Step Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Box 1: Target Role Dropdown / Chips */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-poppins block">
              1. Target Role Title
            </span>
            <select
              value={isCustomRole ? 'CUSTOM' : selectedRole}
              onChange={(e) => {
                if (e.target.value === 'CUSTOM') {
                  setIsCustomRole(true)
                } else {
                  setIsCustomRole(false)
                  setSelectedRole(e.target.value)
                }
              }}
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              {PRESET_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="CUSTOM">+ Custom Role</option>
            </select>

            {isCustomRole && (
              <input
                type="text"
                placeholder="Type custom role title..."
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                className="w-full bg-white border border-indigo-200 text-slate-900 rounded-xl px-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>

          {/* Box 2: Experience Pills */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-poppins block">
              2. Experience Level Tier
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {EXP_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedExp(tier.id)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer flex flex-col ${
                    selectedExp === tier.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span>{tier.label}</span>
                  <span
                    className={`text-[9px] font-normal ${
                      selectedExp === tier.id ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {tier.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Box 3: Specialization Input */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-poppins block">
              3. Specialization Focus
            </span>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. Fintech, AWS, Healthcare, React"
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
            <div className="flex flex-wrap gap-1 pt-0.5">
              {['Fintech', 'AWS', 'Healthcare', 'React', 'Snowflake'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSpecialization(tag)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:border-indigo-400 cursor-pointer"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Query Preview Radar */}
        <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">Apify Actor Query:</span>
            <code className="text-emerald-400 font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              "{liveApifyQuery}"
            </code>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Bucket: <strong className="text-white">{computedSelectorKey}</strong></span>
            <span>·</span>
            <span>Target: 35 Verified JDs</span>
          </div>
        </div>
      </div>

      {/* ── CONFIGURED ROLE BUCKETS MULTI-SELECT & BULK CASCADE ACTION ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
        {/* Header Select All & Bulk Delete Action */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filteredBuckets.length > 0 && selectedBuckets.length === filteredBuckets.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedBuckets(filteredBuckets.map((b) => b.bucketKey))
                } else {
                  setSelectedBuckets([])
                }
              }}
              className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
              title="Select All Buckets"
            />
            <h4 className="text-xs font-bold text-slate-900 font-poppins">Configured Role Buckets</h4>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {filteredBuckets.length} total
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedBuckets.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
              >
                <Trash size={12} weight="bold" /> Delete ({selectedBuckets.length})
              </button>
            )}
            <input
              type="text"
              placeholder="Filter buckets..."
              value={bucketFilterQuery}
              onChange={(e) => setBucketFilterQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-36"
            />
          </div>
        </div>

        {/* Bucket Chips Grid with Multi-Select Checkboxes */}
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
          {filteredBuckets.length === 0 ? (
            <span className="text-xs text-slate-400 py-2">No matching buckets found.</span>
          ) : (
            filteredBuckets.map((b) => {
              const isSelected = selectedBuckets.includes(b.bucketKey)
              const isActive = activeBucketKey === b.bucketKey
              return (
                <div
                  key={b.bucketKey}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                    isActive
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                      : 'bg-slate-50 hover:bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation()
                      if (e.target.checked) {
                        setSelectedBuckets((prev) => [...prev, b.bucketKey])
                      } else {
                        setSelectedBuckets((prev) => prev.filter((k) => k !== b.bucketKey))
                      }
                    }}
                    className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveBucketKey(b.bucketKey)}
                    className="cursor-pointer text-left font-mono text-[11px] hover:text-indigo-600"
                  >
                    <span>{b.bucketKey}</span>
                    {b.jobCount > 0 && (
                      <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-600 font-sans font-semibold">
                        {b.jobCount} JDs
                      </span>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── SKILLS TAXONOMY CRUD STUDIO ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-poppins">
                Skills Frequency &amp; Market Alignment Studio
              </h3>
              <span className="text-xs text-indigo-600 font-mono font-bold">
                ({activeBucketKey})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag frequency percentages to calibrate ATS weights or pin mandatory core stack tools.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Bucket Switcher Dropdown */}
            <select
              value={activeBucketKey}
              onChange={(e) => setActiveBucketKey(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer max-w-[200px]"
            >
              {buckets.map((b) => (
                <option key={b.bucketKey} value={b.bucketKey}>
                  {b.bucketKey} ({b.roleName})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleAutoSanitize}
              disabled={sanitizing || !activeBucketKey}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              title="Purge cross-domain noise (eDiscovery, HPLC, Annotators), unify synonyms (SQL, Excel, BI), and anchor Core Required skills."
            >
              <Sparkle size={14} weight="bold" />
              <span>{sanitizing ? 'Purging Noise…' : 'Auto-Sanitize & Re-Calculate Core'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} weight="bold" />
              <span>Add Skill</span>
            </button>

            <button
              type="button"
              onClick={() => setBucketToDelete(activeBucketKey)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Cascade Delete Bucket & Versions"
            >
              <Trash size={16} />
            </button>
          </div>
        </div>

        {/* Competency Clusters Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkle size={16} className="text-indigo-600" weight="fill" />
              <h4 className="text-xs font-extrabold text-slate-900 font-poppins">
                Active Competency Clusters ("OR" Grouping)
              </h4>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {activeClusters.length} Core Clusters Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {activeClusters.map((c) => (
              <div key={c.name} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900 truncate" title={c.name}>{c.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    {c.demand}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono truncate" title={c.tools}>
                  Interchangeable: {c.tools}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Search & Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'PINNED', 'tools', 'languages', 'cloud', 'data'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer capitalize ${
                  categoryFilter === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'PINNED' ? '📌 Pinned Core' : cat}
              </button>
            ))}
          </div>

          <div className="relative w-56">
            <MagnifyingGlass size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter extracted skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Skills List with Drag Sliders */}
        {loadingSkills ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <ArrowsClockwise size={16} className="animate-spin text-indigo-600" />
            <span>Loading active market skills taxonomy...</span>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
            No skills found for this filter. Click "Add Skill" or launch a targeted scrape.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredSkills.map((skill) => (
              <div
                key={skill.name}
                className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-900 font-poppins truncate">
                      {skill.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-slate-200/70 text-slate-600">
                      {skill.category || 'tools'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePin(skill)}
                      title={skill.isPinned ? 'Unpin skill' : 'Pin as mandatory Core Skill'}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        skill.isPinned
                          ? 'bg-amber-100 text-amber-700'
                          : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                      }`}
                    >
                      <PushPin size={14} weight={skill.isPinned ? 'fill' : 'regular'} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(skill.name)}
                      title="Remove skill from taxonomy"
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>

                {/* Interactive Drag Percentage Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500">Market Penetration:</span>
                    <strong className="text-indigo-600">{skill.percentage || 50}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={skill.percentage || 50}
                    onChange={(e) => handleUpdatePercentage(skill.name, e.target.value)}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ADD SKILL MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h3 className="text-sm font-bold text-slate-900 font-poppins">Add Skill to Taxonomy</h3>
            <form onSubmit={handleAddSkillSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Skill Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Playwright, Snowflake, Kafka"
                  value={newSkill.name}
                  onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Initial Penetration % ({newSkill.percentage}%)
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={newSkill.percentage}
                  onChange={(e) => setNewSkill({ ...newSkill, percentage: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Category
                </label>
                <select
                  value={newSkill.category}
                  onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200"
                >
                  <option value="tools">Tools &amp; Platforms</option>
                  <option value="languages">Languages</option>
                  <option value="cloud">Cloud &amp; Infra</option>
                  <option value="data">Data &amp; Databases</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Save Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CASCADE DELETE BUCKET MODAL ── */}
      {bucketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <Trash size={18} />
              <span>Cascade Delete Bucket?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Permanently delete bucket <strong className="text-slate-900 font-mono">{bucketToDelete}</strong> and all historical version snapshots? This action is irreversible.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBucketToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingBucket}
                onClick={handleConfirmCascadeDelete}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer shadow-xs"
              >
                {deletingBucket ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK DELETE CONFIRMATION MODAL ── */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl">
                <Trash size={22} weight="bold" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-poppins">
                  Cascade Bulk Delete {selectedBuckets.length} Bucket(s)?
                </h3>
                <p className="text-xs text-slate-500">
                  This permanently removes the selected buckets and all their historical snapshots.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1 font-mono text-xs text-slate-700">
              {selectedBuckets.map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{k}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteBuckets}
                disabled={bulkDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : `Confirm Delete (${selectedBuckets.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

