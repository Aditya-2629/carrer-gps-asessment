import React, { useState, useEffect, useCallback } from 'react'
import {
  Books,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  Clock,
  Sparkle,
  Briefcase,
  Buildings,
  MapPin,
  CaretRight,
  CaretDown,
} from '@phosphor-icons/react'

export default function MarketLibrarySection({ api }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [refreshingBuckets, setRefreshingBuckets] = useState({})
  const [globalJob, setGlobalJob] = useState(null)
  const [selectedBucketKey, setSelectedBucketKey] = useState(null)
  const [bucketDetail, setBucketDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { ok, data: resData } = await api('/admin/market-library')
      if (ok) {
        setData(resData)
      } else {
        setError(resData?.message || 'Failed to load market library.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Poll for global job progress if running
  useEffect(() => {
    if (!globalJob?.jobId || globalJob.status === 'completed' || globalJob.status === 'failed') return

    const interval = setInterval(async () => {
      try {
        const { ok, data: resData } = await api(`/admin/market-library/refresh/${globalJob.jobId}`)
        if (ok && resData.job) {
          setGlobalJob(resData.job)
          if (resData.job.status === 'completed' || resData.job.status === 'failed') {
            setRefreshingAll(false)
            loadData()
          }
        }
      } catch (_e) {
        /* poll failed */
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [api, globalJob, loadData])

  const handleRefreshAll = async () => {
    try {
      setRefreshingAll(true)
      setError(null)
      const { ok, data: resData } = await api('/admin/market-library/refresh', {
        method: 'POST',
      })
      if (ok) {
        setGlobalJob({ jobId: resData.jobId, status: 'queued', progress: 0 })
      } else {
        setError(resData?.message || 'Failed to trigger global refresh.')
        setRefreshingAll(false)
      }
    } catch (err) {
      setError(err.message)
      setRefreshingAll(false)
    }
  }

  const handleRefreshSingle = async (bucketKey) => {
    try {
      setRefreshingBuckets((prev) => ({ ...prev, [bucketKey]: true }))
      const { ok } = await api(`/admin/market-library/refresh/${encodeURIComponent(bucketKey)}`, {
        method: 'POST',
      })
      if (ok) {
        setTimeout(() => {
          loadData()
          setRefreshingBuckets((prev) => ({ ...prev, [bucketKey]: false }))
        }, 3000)
      }
    } catch (err) {
      setRefreshingBuckets((prev) => ({ ...prev, [bucketKey]: false }))
    }
  }

  const handleSelectBucket = async (bucketKey) => {
    if (selectedBucketKey === bucketKey) {
      setSelectedBucketKey(null)
      setBucketDetail(null)
      return
    }

    setSelectedBucketKey(bucketKey)
    setDetailLoading(true)
    try {
      const { ok, data: resData } = await api(`/admin/market-library/${encodeURIComponent(bucketKey)}`)
      if (ok) {
        setBucketDetail(resData)
      }
    } catch (err) {
      console.warn('Failed to load bucket detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs animate-pulse">
        <div className="h-5 bg-slate-100 rounded w-48 mb-4"></div>
        <div className="h-20 bg-slate-50 rounded-xl"></div>
      </div>
    )
  }

  const buckets = data?.buckets || []

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
      {/* Header with Global Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Books size={20} weight="duotone" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Job Market Library</h3>
              <p className="text-xs text-slate-500">
                Deterministic Role × Experience JD Library (5 JDs per bucket with atomic version swaps)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Reload Buckets"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 cursor-pointer"
          >
            <ArrowsClockwise size={16} />
          </button>
          <button
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs cursor-pointer transition-all ${
              refreshingAll
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
            }`}
          >
            <ArrowsClockwise size={15} className={refreshingAll ? 'animate-spin' : ''} />
            {refreshingAll ? 'Refreshing Library…' : 'Update JD Library'}
          </button>
        </div>
      </div>

      {/* Progress alert if global refresh is running */}
      {globalJob && (globalJob.status === 'running' || globalJob.status === 'queued') && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-2">
              <Clock size={16} className="animate-spin text-indigo-600" />
              Global Refresh in Progress ({globalJob.status})
            </span>
            <span>{globalJob.progress || 0}%</span>
          </div>
          <div className="w-full bg-indigo-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${globalJob.progress || 5}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-indigo-700">
            Fetching candidate JDs through Apify, validating, and performing atomic swaps with concurrency limit.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-center gap-2">
          <WarningCircle size={16} weight="fill" /> {error}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Buckets</div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">{data?.totalBuckets ?? 0}</div>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Healthy (5 JDs)</div>
          <div className="text-xl font-extrabold text-emerald-800 tabular-nums mt-0.5">{data?.healthy ?? 0}</div>
        </div>
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Needs Refresh / Partial</div>
          <div className="text-xl font-extrabold text-amber-800 tabular-nums mt-0.5">{data?.needsRefresh ?? 0}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Full Refresh</div>
          <div className="text-xs font-semibold text-slate-700 truncate mt-1">
            {data?.lastFullRefresh ? new Date(data.lastFullRefresh).toLocaleDateString() : 'Never'}
          </div>
        </div>
      </div>

      {/* Buckets Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Role Taxonomy</th>
                <th className="px-3 py-3">Experience</th>
                <th className="px-3 py-3 text-center">Active JDs</th>
                <th className="px-3 py-3 text-center">Version</th>
                <th className="px-3 py-3">Last Updated</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buckets.map((b) => {
                const isSelected = selectedBucketKey === b.bucketKey
                const isItemRefreshing = refreshingBuckets[b.bucketKey] || b.status === 'refreshing'

                return (
                  <React.Fragment key={b.bucketKey}>
                    <tr
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                      onClick={() => handleSelectBucket(b.bucketKey)}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                        {isSelected ? <CaretDown size={13} /> : <CaretRight size={13} />}
                        <div>
                          <div>{b.roleName}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">{b.bucketKey}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 font-medium">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700">
                          {b.experienceBucket} yrs
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`font-bold tabular-nums px-2 py-0.5 rounded text-[11px] ${
                            b.jobCount >= 5
                              ? 'bg-emerald-50 text-emerald-700'
                              : b.jobCount > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {b.jobCount} / 5
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-[11px] font-bold text-slate-600">
                        {b.activeVersion > 0 ? `v${b.activeVersion}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-500 text-[11px]">
                        {b.lastSuccessfulRefreshAt
                          ? new Date(b.lastSuccessfulRefreshAt).toLocaleDateString()
                          : 'Pending'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                            b.status === 'healthy'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : b.status === 'refreshing'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : b.status === 'needs_refresh'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {b.status === 'healthy' && <CheckCircle size={10} weight="fill" />}
                          {b.status === 'refreshing' && <ArrowsClockwise size={10} className="animate-spin" />}
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleRefreshSingle(b.bucketKey)}
                          disabled={isItemRefreshing}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <ArrowsClockwise size={12} className={isItemRefreshing ? 'animate-spin' : ''} />
                          {isItemRefreshing ? 'Scraping…' : 'Refresh'}
                        </button>
                      </td>
                    </tr>

                    {/* Bucket Inspector Expansion */}
                    {isSelected && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="p-4 border-y border-slate-200">
                          {detailLoading ? (
                            <div className="py-4 text-center text-slate-400">Loading bucket details…</div>
                          ) : bucketDetail?.activeVersion ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                <h4 className="font-extrabold text-slate-800 flex items-center gap-2">
                                  <Sparkle size={15} className="text-indigo-600" />
                                  Active Snapshot v{bucketDetail.activeVersion.version} (Sample: {bucketDetail.activeVersion.jobs?.length} JDs)
                                </h4>
                                <span className="text-[11px] text-slate-400">
                                  Scraped with actor {bucketDetail.activeVersion.sourceMetadata?.actorId || 'Apify'}
                                </span>
                              </div>

                              {/* Market Profile Top Skills */}
                              {bucketDetail.activeVersion.marketProfile?.skills?.length > 0 && (
                                <div>
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                    Aggregated Skill Frequency
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {bucketDetail.activeVersion.marketProfile.skills.slice(0, 10).map((s) => (
                                      <span
                                        key={s.name}
                                        className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700 text-[11px] font-medium"
                                      >
                                        {s.name} <strong className="text-indigo-600 ml-1">{s.frequency}/5</strong>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Sampled JDs List */}
                              <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                  Sampled Market JDs ({bucketDetail.activeVersion.jobs?.length})
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {bucketDetail.activeVersion.jobs.map((job, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-white border border-slate-200 rounded-xl p-3 space-y-1 shadow-2xs"
                                    >
                                      <div className="font-bold text-slate-900 truncate">{job.title}</div>
                                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                                        <span className="flex items-center gap-1 truncate">
                                          <Buildings size={12} /> {job.company}
                                        </span>
                                        <span className="flex items-center gap-1 truncate">
                                          <MapPin size={12} /> {job.location}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                                        {job.description}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="py-4 text-center text-slate-500 text-xs">
                              No active version available yet. Click <strong>Refresh</strong> to scrape 5 fresh JDs.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
