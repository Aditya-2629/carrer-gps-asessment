import React, { useState, useEffect } from 'react'
import {
  X,
  FileText,
  LinkedinLogo,
  ShieldCheck,
  WarningCircle,
  DownloadSimple,
  ArrowsClockwise,
  PencilSimple,
  Check,
  Sparkle,
  Target,
  ChartBar,
} from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

export default function CandidateDossierModal({ candidateId, onClose, token }) {
  const [activeTab, setActiveTab] = useState('autopsy') // 'autopsy' | 'rewrites' | 'alignment'
  const [loading, setLoading] = useState(true)
  const [dossier, setDossier] = useState(null)
  const [error, setError] = useState(null)
  const [editingBulletId, setEditingBulletId] = useState(null)
  const [overrideText, setOverrideText] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)
  const [actionSuccessMsg, setActionSuccessMsg] = useState('')

  useEffect(() => {
    if (!candidateId) return
    let isMounted = true
    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/admin/leads/${candidateId}/dossier`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          setDossier(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load candidate dossier.')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [candidateId, token])

  const handleSaveBulletOverride = async (bulletId) => {
    if (!overrideText.trim()) return
    setSavingOverride(true)
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${candidateId}/override-bullet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bulletId, newText: overrideText }),
      })
      if (!res.ok) throw new Error('Failed to save rewrite override')
      
      // Update local state
      setDossier((prev) => {
        if (!prev) return prev
        const updatedBullets = prev.bullets.map((b) =>
          b.bulletId === bulletId ? { ...b, proposedRewrite: overrideText, status: 'Pass' } : b
        )
        return { ...prev, bullets: updatedBullets }
      })
      setEditingBulletId(null)
      setActionSuccessMsg('Rewrite override saved to candidate profile!')
      setTimeout(() => setActionSuccessMsg(''), 4000)
    } catch (err) {
      alert(`Error saving override: ${err.message}`)
    } finally {
      setSavingOverride(false)
    }
  }

  const handleDownloadDocx = () => {
    const url = `${API_BASE}/assessment/user/${candidateId}/download-resume-docx`
    window.open(url, '_blank')
  }

  const handleDownloadOriginalResume = () => {
    const url = `${API_BASE}/admin/users/${candidateId}/resume`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const dUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = dUrl
        a.download = dossier?.resumeFileName || 'original_resume.pdf'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(dUrl)
        a.remove()
      })
      .catch(() => alert('Could not download original resume.'))
  }

  if (!candidateId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {dossier?.lead?.candidateName?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {dossier?.lead?.candidateName || 'Candidate Dossier'}
                </h2>
                {dossier?.lead?.leadTier === 'RECRUITER_READY' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    🟢 Recruiter Ready
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    🔴 Coaching Hot
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {dossier?.lead?.targetRole || 'Target Role'} · {dossier?.lead?.email} · Intent Score: <span className="font-bold text-indigo-600">{dossier?.lead?.intentScore ?? '—'}/100</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadDocx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <DownloadSimple size={14} weight="bold" />
              <span>Tailored ATS Word (.docx)</span>
            </button>
            {dossier?.hasOriginalResume && (
              <button
                onClick={handleDownloadOriginalResume}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                <FileText size={14} />
                <span>Original Resume</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-2 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-6 text-xs font-semibold bg-white">
          <button
            onClick={() => setActiveTab('autopsy')}
            className={`py-3.5 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'autopsy'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Tab 1: Verification Autopsy (Resume vs LinkedIn)</span>
            {dossier?.discrepancies?.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                {dossier.discrepancies.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('rewrites')}
            className={`py-3.5 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'rewrites'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkle size={16} />
            <span>Tab 2: Bullet Rewrites Studio (Jev Triage)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
              {dossier?.bullets?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('alignment')}
            className={`py-3.5 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'alignment'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Target size={16} />
            <span>Tab 3: Target Skill Alignment</span>
          </button>
        </div>

        {/* Action Success Toast */}
        {actionSuccessMsg && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check size={15} weight="bold" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <ArrowsClockwise size={32} className="animate-spin text-indigo-500 mb-3" />
              <p className="text-xs">Loading Candidate Dossier & Jev Intelligence...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          ) : (
            <>
              {/* TAB 1: VERIFICATION AUTOPSY */}
              {activeTab === 'autopsy' && (
                <div className="space-y-6">
                  {/* Discrepancies Alert */}
                  {dossier?.discrepancies?.length > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2 mb-2">
                        <WarningCircle size={16} weight="fill" className="text-amber-600" />
                        <span>Detected Profile Inconsistencies ({dossier.discrepancies.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {dossier.discrepancies.map((disc, dIdx) => (
                          <div key={dIdx} className="bg-white/80 rounded-xl p-3 border border-amber-100 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                              <span>{disc.title || disc.category || 'Discrepancy'}</span>
                              <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                {disc.severity || 'Medium'}
                              </span>
                            </div>
                            <p className="text-slate-600">{disc.diagnosis || disc.detail || disc.message || JSON.stringify(disc)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                      <ShieldCheck size={24} weight="fill" className="text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold text-emerald-900">Zero Critical Discrepancies</div>
                        <div className="text-xs text-emerald-700">Resume claims and LinkedIn profile history are 100% synchronized.</div>
                      </div>
                    </div>
                  )}

                  {/* Side-by-side Experience Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Resume Column */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider">
                        <FileText size={16} className="text-indigo-600" />
                        <span>Extracted Resume Document</span>
                      </div>
                      <div className="space-y-4">
                        {dossier?.resumeProfile?.experiences?.length > 0 ? (
                          dossier.resumeProfile.experiences.map((exp, eIdx) => (
                            <div key={eIdx} className="border-l-2 border-indigo-200 pl-3">
                              <div className="font-bold text-xs text-slate-900">{exp.role || exp.title || 'Role'}</div>
                              <div className="text-xs text-slate-500">{exp.company} · {exp.duration || exp.dates || 'Dates'}</div>
                              <ul className="mt-2 space-y-1">
                                {(exp.bullets || []).slice(0, 3).map((b, bIdx) => (
                                  <li key={bIdx} className="text-[11px] text-slate-600 leading-relaxed list-disc list-inside">
                                    {typeof b === 'string' ? b : b.text}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400">No experiences parsed from resume.</p>
                        )}
                      </div>
                    </div>

                    {/* LinkedIn Column */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                          <LinkedinLogo size={16} className="text-sky-600" weight="fill" />
                          <span>Scraped LinkedIn Profile</span>
                        </div>
                        {dossier?.linkedinProfile?.url && (
                          <a
                            href={dossier.linkedinProfile.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-sky-600 hover:underline font-medium"
                          >
                            Open Profile ↗
                          </a>
                        )}
                      </div>
                      <div className="space-y-4">
                        {dossier?.linkedinProfile?.experiences?.length > 0 ? (
                          dossier.linkedinProfile.experiences.map((exp, eIdx) => (
                            <div key={eIdx} className="border-l-2 border-sky-200 pl-3">
                              <div className="font-bold text-xs text-slate-900">{exp.title || exp.role || 'Role'}</div>
                              <div className="text-xs text-slate-500">{exp.companyName || exp.company} · {exp.dateRange || exp.dates || 'Dates'}</div>
                              {exp.description && (
                                <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed line-clamp-3">
                                  {exp.description}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                            No external LinkedIn scrape payload available for this candidate.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BULLET REWRITES STUDIO */}
              {activeTab === 'rewrites' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Jev System One Bullet Triager & Rewrites</h3>
                      <p className="text-xs text-slate-500">
                        Inspect weak issue flags, metric bolding, and override proposed AI rewrites before candidate exports.
                      </p>
                    </div>
                  </div>

                  {dossier?.bullets?.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                      No bullet audit records found for this candidate.
                    </div>
                  ) : (
                    dossier.bullets.map((b) => (
                      <div key={b.bulletId} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-slate-400">{b.bulletId} · {b.roleOrProject}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              b.status === 'Pass'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : b.status === 'Warn'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>

                        {/* Original Bullet */}
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Original Candidate Bullet:</div>
                          <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            {b.originalText}
                          </p>
                        </div>

                        {/* Issue Diagnosis */}
                        {b.issue && (
                          <div className="text-xs text-amber-800 bg-amber-50/70 p-2 rounded-xl border border-amber-100 flex items-start gap-1.5">
                            <WarningCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                            <span><strong>Diagnosis:</strong> {b.issue}</span>
                          </div>
                        )}

                        {/* Proposed Rewrite */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase font-bold text-indigo-600 flex items-center gap-1">
                              <Sparkle size={13} weight="fill" /> Proposed AI Rewrite:
                            </span>
                            {editingBulletId !== b.bulletId && (
                              <button
                                onClick={() => {
                                  setEditingBulletId(b.bulletId)
                                  setOverrideText(b.proposedRewrite || b.originalText)
                                }}
                                className="text-xs text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                              >
                                <PencilSimple size={13} /> Edit / Override
                              </button>
                            )}
                          </div>

                          {editingBulletId === b.bulletId ? (
                            <div className="space-y-2">
                              <textarea
                                value={overrideText}
                                onChange={(e) => setOverrideText(e.target.value)}
                                rows={3}
                                className="w-full text-xs p-2.5 rounded-xl border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingBulletId(null)}
                                  className="px-3 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveBulletOverride(b.bulletId)}
                                  disabled={savingOverride}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                                >
                                  {savingOverride ? 'Saving...' : 'Save Override'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-indigo-950 font-medium bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                              {b.proposedRewrite || 'No rewrite suggested.'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: TARGET SKILL ALIGNMENT */}
              {activeTab === 'alignment' && (
                <div className="space-y-6">
                  {/* Match Rate Overview */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="text-xs uppercase font-bold text-slate-400">Target Role Penetration</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        {dossier?.keywordAlignment?.targetRole || 'Software Professional'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-indigo-600 tabular-nums">
                        {dossier?.keywordAlignment?.matchRate ?? 70}%
                      </div>
                      <div className="text-[11px] text-slate-400">JD Corpus Alignment</div>
                    </div>
                  </div>

                  {/* Matched Skills */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-3">
                      <Check size={16} weight="bold" /> Matched Skills in Experience (Green)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {dossier?.keywordAlignment?.allMatched?.length > 0 ? (
                        dossier.keywordAlignment.allMatched.map((kw, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium"
                          >
                            {typeof kw === 'string' ? kw : kw.keyword || kw.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">None detected.</span>
                      )}
                    </div>
                  </div>

                  {/* Missing Skills */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5 mb-3">
                      <WarningCircle size={16} weight="bold" /> High-Frequency Missing Market Keywords (Red)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {dossier?.keywordAlignment?.allMissing?.length > 0 ? (
                        dossier.keywordAlignment.allMissing.map((kw, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-medium"
                          >
                            {typeof kw === 'string' ? kw : kw.keyword || kw.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">No major market gaps detected.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

