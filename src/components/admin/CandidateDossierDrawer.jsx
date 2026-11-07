import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Sparkle,
  Check,
  WarningCircle,
  Copy,
  DownloadSimple,
  PencilSimple,
  ShieldCheck,
  Target,
  FileText,
  User,
  ArrowsClockwise,
  ArrowRight,
  Lightning,
  WhatsappLogo,
  EnvelopeSimple,
  SealCheck,
} from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')

export default function CandidateDossierDrawer({ candidateId, onClose, token }) {
  const [dossier, setDossier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('rewrites') // 'rewrites' | 'autopsy' | 'keywords'
  const [copiedKey, setCopiedKey] = useState('')
  const [editingBulletId, setEditingBulletId] = useState(null)
  const [overrideText, setOverrideText] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const copyToClipboard = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2500)
  }

  const loadDossier = useCallback(async () => {
    if (!candidateId) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${candidateId}/dossier`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setDossier(data)
      } else {
        showToast(data.message || 'Failed to load dossier')
      }
    } catch (err) {
      console.error('Failed to fetch candidate dossier:', err)
      showToast('Error loading candidate dossier.')
    } finally {
      setLoading(false)
    }
  }, [candidateId, token])

  useEffect(() => {
    loadDossier()
  }, [loadDossier])

  // Save manual bullet rewrite override
  const handleSaveOverride = async (bulletId) => {
    if (!overrideText.trim()) return
    setSavingOverride(true)
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${candidateId}/override-bullet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bulletId,
          overrideText: overrideText.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Bullet override saved live into candidate profile!')
        setEditingBulletId(null)
        setOverrideText('')
        loadDossier()
      } else {
        alert(data.message || 'Failed to save override')
      }
    } catch (err) {
      alert(`Error saving override: ${err.message}`)
    } finally {
      setSavingOverride(false)
    }
  }

  const c = dossier?.candidate || dossier?.lead || {}
  const autopsy = dossier?.autopsy || {}
  const bullets = dossier?.bulletTriage || dossier?.bullets || []
  const skills = dossier?.skillAlignment || {
    matched: dossier?.keywordAlignment?.allMatched || c.topMatchedSkills || c.matchedSkills || [],
    missing: dossier?.keywordAlignment?.allMissing || c.topMissingSkills || c.missingSkills || [],
  }
  const originalBullets = dossier?.originalBullets || []

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border-l border-slate-800 text-slate-100 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Toast */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2">
            <Check size={16} weight="bold" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Hero Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Score Ring */}
            <div className="relative w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg font-black text-white font-mono tabular-nums leading-none">
                {c.atsScore ?? '—'}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold mt-1">
                ATS
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white tracking-tight">
                  {c.name || 'Candidate Dossier'}
                </h2>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                    c.tier === 'COACHING_HOT'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {c.tier === 'COACHING_HOT' ? '🔥 Hot Coaching' : '🟢 Recruiter Ready'}
                </span>
                <span className="text-xs text-slate-400 font-mono">Stage: {c.stage || 'New'}</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                <span>{c.email}</span>
                {c.phone && <span>· {c.phone}</span>}
                <span className="text-indigo-400 font-semibold">· {c.targetRole}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('rewrites')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rewrites'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkle size={14} weight="fill" />
            <span>Bullet Rewrites Studio ({bullets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('autopsy')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'autopsy'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck size={14} weight="fill" />
            <span>Verification Autopsy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('keywords')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'keywords'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Target size={14} weight="fill" />
            <span>Target Keyword Matrix</span>
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <ArrowsClockwise size={20} className="animate-spin text-indigo-400" />
              <span>Loading candidate dossier & autopsy...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: BULLET REWRITES STUDIO */}
              {activeTab === 'rewrites' && (
                <div className="space-y-4">
                  {bullets.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      No triaged bullets found for this assessment run.
                    </div>
                  ) : (
                    bullets.map((b, idx) => {
                      const isEditing = editingBulletId === (b.bulletId || idx)
                      return (
                        <div
                          key={b.bulletId || idx}
                          className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono border ${
                                  b.status === 'Pass'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : b.status === 'Warn'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                }`}
                              >
                                {b.status || 'Fix'}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">{b.bulletId}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingBulletId(b.bulletId || idx)
                                setOverrideText(b.proposedRewrite || b.originalText || '')
                              }}
                              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                            >
                              <PencilSimple size={13} />
                              <span>Override</span>
                            </button>
                          </div>

                          {/* Original Bullet */}
                          <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1">
                              Original Candidate Bullet:
                            </span>
                            <p className="text-xs text-slate-300 leading-relaxed">{b.originalText}</p>
                            {b.issue && (
                              <div className="mt-2 text-[11px] text-rose-300/90 font-mono">
                                ⚠️ Issue: {b.issue}
                              </div>
                            )}
                          </div>

                          {/* Proposed Rewrite */}
                          <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-emerald-400">
                                Proposed Recruiter-Grade Rewrite:
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(b.proposedRewrite, `bullet_${idx}`)}
                                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-semibold"
                              >
                                <Copy size={12} />
                                <span>{copiedKey === `bullet_${idx}` ? 'Copied! ✨' : 'Copy'}</span>
                              </button>
                            </div>
                            <p className="text-xs text-slate-200 font-medium leading-relaxed">
                              {b.proposedRewrite || 'No rewrite proposed.'}
                            </p>
                          </div>

                          {/* Inline Edit Form */}
                          {isEditing && (
                            <div className="p-3 bg-slate-900 border border-indigo-500/40 rounded-xl space-y-2 animate-in fade-in">
                              <label className="text-[10px] font-bold uppercase text-indigo-300 block">
                                Custom Admin Override Text:
                              </label>
                              <textarea
                                rows={3}
                                value={overrideText}
                                onChange={(e) => setOverrideText(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingBulletId(null)}
                                  className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:bg-slate-800 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingOverride}
                                  onClick={() => handleSaveOverride(b.bulletId)}
                                  className="px-3.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-50"
                                >
                                  {savingOverride ? 'Saving...' : 'Save Override Live'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* TAB 2: VERIFICATION AUTOPSY */}
              {activeTab === 'autopsy' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <ShieldCheck size={16} />
                      <span>Resume vs. Scraped LinkedIn Cross-Examination</span>
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Flags discrepancies in job titles, employment dates, and omitted achievements between what the candidate submitted and their public profile.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Resume Claims */}
                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        📄 Resume File Claims
                      </span>
                      <div className="text-xs text-slate-300 font-mono">
                        <div>Role: {c.targetRole}</div>
                        <div>Report Score: {c.atsScore}/100</div>
                        <div>Quantification Density: {dossier?.quantification?.density ? `${Math.round(dossier.quantification.density * 100)}%` : '—'}</div>
                      </div>
                    </div>

                    {/* LinkedIn Profile */}
                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                      <span className="text-[10px] uppercase font-bold text-sky-400 block">
                        🔗 Scraped LinkedIn Data
                      </span>
                      <div className="text-xs text-slate-300 font-mono">
                        <div>URL: {c.linkedin || 'Not Provided'}</div>
                        <div>Headline: {autopsy.headline || 'Verified Profile Beacon'}</div>
                        <div>Cross-Match: {autopsy.isConsistent ? '🟢 Consistent' : '🟡 Divergence Flagged'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Discrepancy details */}
                  {autopsy.findings?.length > 0 && (
                    <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl space-y-2">
                      <span className="text-[10px] uppercase font-bold text-amber-400">
                        Discrepancy Flags:
                      </span>
                      <ul className="text-xs text-amber-200/90 list-disc pl-4 space-y-1">
                        {autopsy.findings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: KEYWORD ALIGNMENT MATRIX */}
              {activeTab === 'keywords' && (
                <div className="space-y-4">
                  {/* Verified Matches */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Verified Stack Matches ({skills.matched?.length || 0})
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.matched?.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                        >
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Missing Gaps */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                        Missing Market Keyword Gaps ({skills.missing?.length || 0})
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.missing?.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30"
                        >
                          ✕ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(c.hasResume || dossier?.hasOriginalResume) && (
              <a
                href={`${API_BASE}/admin/users/${c.id || candidateId}/resume`}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
                title="Download original file"
              >
                <DownloadSimple size={14} />
                <span>Original Resume</span>
              </a>
            )}

            <a
              href={`${API_BASE}/assessment/tailored-docx/${c.id || candidateId}`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              title="Download Harvard-compliant Tailored .docx"
            >
              <DownloadSimple size={14} weight="bold" />
              <span>Tailored .docx</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(dossier?.pitches?.email, 'footer_email')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <EnvelopeSimple size={14} />
              <span>{copiedKey === 'footer_email' ? 'Copied Pitch! ✨' : 'Email Pitch'}</span>
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(dossier?.pitches?.whatsapp, 'footer_wa')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-300 border border-emerald-700/50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <WhatsappLogo size={14} />
              <span>{copiedKey === 'footer_wa' ? 'Copied! ✨' : 'WhatsApp'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
