import React, { useState } from 'react'
import { CheckCircle, Warning, XCircle, Sparkle, Target, DownloadSimple } from '@phosphor-icons/react'
import { decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'
import useAppStore from '../../store/useAppStore'

export default function ResumeKeywordAlignment({
  keywordAlignment,
  variant = 'light',
  onRebuildResume = null,
  currentMatchRate: propMatchRate = null,
  reportData: propReportData = null,
  onSkillToggle = null,
  onToast = null,
}) {
  if (!keywordAlignment) return null

  const light = variant === 'light'
  const {
    targetRole = '',
    matchedInExperience = [],
    skillsOnlyUnverified = [],
    missingFromResume = [],
    missingMarketSkillsRanked = [],
    matchPercent = 0,
    matchedCount = 0,
    totalTargetKeywords = 0,
  } = keywordAlignment

  const [selectedSkills, setSelectedSkills] = useState(new Set())
  const [showAllTags, setShowAllTags] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const toggleSkillSelection = (skillName) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev)
      let added = false
      if (next.has(skillName)) {
        next.delete(skillName)
        added = false
      } else {
        next.add(skillName)
        added = true
      }
      if (typeof onSkillToggle === 'function') {
        onSkillToggle(skillName, added)
      } else if (typeof onToast === 'function') {
        onToast(added ? `Skill updated in report successfully! Added "${skillName}".` : `Removed "${skillName}" from selection`)
      }
      return next
    })
  }

  const cleanSkillsOnly = (skillsOnlyUnverified || [])
    .map((s) => (typeof s === 'string' ? decodeHtmlEntities(s).trim() : (s?.keyword || s?.name || '')))
    .filter((s) => s && !/&(?:amp|lt|gt|quot|#39);/i.test(s) && !/&amp/i.test(s) && s.split(/\s+/).filter(Boolean).length <= 3)

  const missingMap = new Map()
  const rankedItems = Array.isArray(missingMarketSkillsRanked) ? missingMarketSkillsRanked : []
  for (const item of rankedItems) {
    const rawName = typeof item === 'string' ? item : item?.keyword || item?.skill || item?.name || ''
    const cleanName = decodeHtmlEntities(rawName).trim()
    if (!cleanName || cleanName.length < 2 || cleanName.split(/\s+/).length > 4 || /&(?:amp|lt|gt|quot|#39);/i.test(cleanName)) continue
    const key = cleanName.toLowerCase()
    if (!missingMap.has(key)) {
      const pct = item.percentage != null ? item.percentage : null
      missingMap.set(key, {
        keyword: cleanName,
        percentage: pct,
        priority: item.priority || (pct >= 40 ? 'HIGH' : pct >= 20 ? 'MEDIUM' : 'LOW'),
        priorityColor: item.priorityColor || (pct >= 40 ? 'red' : pct >= 20 ? 'yellow' : 'grey'),
        category: item.category || 'Tech',
        badge: item.badge || (pct ? `${pct}% of JDs` : null),
        talkingScript: item.talkingScript || null,
      })
    }
  }

  const fallbackMissing = Array.isArray(missingFromResume) ? missingFromResume : []
  for (const item of fallbackMissing) {
    const rawName = typeof item === 'string' ? item : item?.keyword || item?.skill || item?.name || ''
    const cleanName = decodeHtmlEntities(rawName).trim()
    if (!cleanName || cleanName.length < 2 || cleanName.split(/\s+/).length > 4 || /&(?:amp|lt|gt|quot|#39);/i.test(cleanName)) continue
    const key = cleanName.toLowerCase()
    if (!missingMap.has(key)) {
      const pct = item?.percentage || null
      missingMap.set(key, {
        keyword: cleanName,
        percentage: pct,
        priority: item?.priority || (pct >= 40 ? 'HIGH' : pct >= 20 ? 'MEDIUM' : 'LOW'),
        priorityColor: item?.priorityColor || (pct >= 40 ? 'red' : pct >= 20 ? 'yellow' : 'grey'),
        category: item?.category || 'Tech',
        badge: item?.badge || (pct ? `${pct}% of JDs` : null),
        talkingScript: item?.talkingScript || null,
      })
    }
  }

  const uniqueMissing = Array.from(missingMap.values())
  const cleanMatched = (matchedInExperience || [])
    .map((s) => (typeof s === 'string' ? decodeHtmlEntities(s).trim() : (s?.keyword || s?.name || '')))
    .filter((s) => s && !/&(?:amp|lt|gt|quot|#39);/i.test(s) && !/&amp/i.test(s) && s.split(/\s+/).filter(Boolean).length <= 3)

  const highPriorityMissing = uniqueMissing.filter(
    (item) => item.priorityColor === 'red' || (item.percentage != null ? item.percentage >= 40 : item.priority === 'HIGH')
  )
  const mediumPriorityMissing = uniqueMissing.filter(
    (item) => !highPriorityMissing.includes(item) && (item.priorityColor === 'yellow' || (item.percentage != null ? item.percentage >= 20 : item.priority === 'MEDIUM'))
  )
  const lowPriorityMissing = uniqueMissing.filter(
    (item) => !highPriorityMissing.includes(item) && !mediumPriorityMissing.includes(item)
  )

  const verifiedCount = matchedCount || cleanMatched.length
  const calculatedTotal = totalTargetKeywords > 0 ? totalTargetKeywords : ((cleanMatched.length + uniqueMissing.length) || 1)
  const baseMatchPercent = Math.min(100, Math.round((verifiedCount / calculatedTotal) * 100))
  const currentMatchRate = propMatchRate != null ? propMatchRate : (matchPercent > 0 ? matchPercent : baseMatchPercent)

  const projectedCount = Math.min(calculatedTotal, verifiedCount + selectedSkills.size)
  const projectedPercent = Math.min(100, Math.round((projectedCount / calculatedTotal) * 100))
  const liftPercent = Math.max(0, projectedPercent - currentMatchRate)

  const handleDownloadTailoredResume = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const selectedSkillsArray = selectedSkills.size > 0 ? Array.from(selectedSkills) : cleanSkillsOnly

      if (typeof onRebuildResume === 'function') {
        await onRebuildResume(selectedSkillsArray)
        return
      }

      const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')
      const storeState = useAppStore.getState()
      const reportData = propReportData || storeState.reportData || storeState.assessmentReport
      const params = new URLSearchParams(window.location.search)

      const userId = reportData?.userId || reportData?._id || reportData?.user_answers?.userId || params.get('userId') || params.get('id') || storeState.userId || ''
      const email = reportData?.user_answers?.email || reportData?.candidate_email || reportData?.email || params.get('email') || storeState.email || ''

      const skillsParam = encodeURIComponent(selectedSkillsArray.join(','))
      let response = null

      if (userId || email) {
        const getUrl = userId
          ? `${apiBase}/assessment/user/${encodeURIComponent(userId)}/download-resume-docx?skills=${skillsParam}`
          : `${apiBase}/assessment/download-resume-docx?email=${encodeURIComponent(email)}&skills=${skillsParam}`
        try {
          response = await fetch(getUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream'
            }
          })
        } catch (_fetchErr) {
          response = null
        }
      }

      if (!response || !response.ok) {
        const postUrl = `${apiBase}/assessment/download-resume-docx`
        response = await fetch(postUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream'
          },
          body: JSON.stringify({
            userId,
            email,
            selectedSkills: selectedSkillsArray,
            skills: selectedSkillsArray,
            reportData,
            canonicalResume: reportData?.resume_agent?.canonicalResume || reportData?.resumeJson,
            bulletAudit: reportData?.resume_agent?.dashboard?.bulletAudit || reportData?.resume_agent?.bulletRewrites,
            missingKeywords: selectedSkillsArray,
          })
        })
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => null)
        throw new Error(errJson?.message || `Download failed with status ${response.status}`)
      }

      // Dynamically update on-screen report and interview defense sheet from response headers
      const ledgerHeader = response.headers.get('x-interview-ledger')
      const expHeader = response.headers.get('x-tailored-experiences')
      if (ledgerHeader) {
        try {
          const parsedLedger = JSON.parse(atob(ledgerHeader))
          let parsedExp = null
          if (expHeader) {
            try {
              parsedExp = JSON.parse(atob(expHeader))
            } catch (_) {}
          }
          const cur = useAppStore.getState().reportData || {}
          const updated = {
            ...cur,
            interviewLedger: parsedLedger,
            resume_agent: {
              ...(cur.resume_agent || {}),
              interviewLedger: parsedLedger,
              canonicalResume: {
                ...(cur.resume_agent?.canonicalResume || {}),
                ...(parsedExp ? { experiences: parsedExp } : {}),
              },
            },
          }
          useAppStore.getState().setReportData(updated)
        } catch (hErr) {
          console.warn('Could not parse updated ledger from headers:', hErr)
        }
      }

      const blob = await response.blob()
      if (blob.type && blob.type.includes('text/html')) {
        throw new Error('Server returned HTML instead of a Word document. Please ensure backend server is running.')
      }

      const disposition = response.headers.get('content-disposition') || ''
      let filename = ''
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].replace(/['"]/g, '').trim())
        }
      }

      if (!filename || !filename.toLowerCase().endsWith('.docx')) {
        const candidateName = (
          reportData?.resume_agent?.canonicalResume?.candidate_name ||
          reportData?.resume_agent?.canonicalResume?.name ||
          'Candidate'
        ).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
        filename = `${candidateName || 'Candidate'}_Tailored_ATS_Resume.docx`
      }

      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      if (document.body.contains(a)) {
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Error downloading tailored resume:', err)
      alert(`Could not download resume: ${err.message}`)
    } finally {
      setIsDownloading(false)
    }
  }

  const containerClasses = light
    ? 'bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:shadow-none print:border-slate-300 print:rounded-none'
    : 'bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl'

  const scorePillBg =
    currentMatchRate >= 75
      ? light
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
      : currentMatchRate >= 50
      ? light
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
      : light
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-rose-950/80 text-rose-300 border-rose-700/60'

  return (
    <div className={`${containerClasses} space-y-5 print:break-inside-avoid print:p-4 print:space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              light ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-950/60 text-indigo-400'
            }`}
          >
            <Target size={18} weight="bold" />
          </span>
          <div>
            <div className={`text-[10px] uppercase tracking-wider font-bold ${light ? 'text-slate-400' : 'text-slate-500'}`}>
              Target Alignment
            </div>
            <div className={`text-sm font-extrabold ${light ? 'text-slate-900' : 'text-white'}`}>
              {targetRole || 'Target Role Alignment'}
            </div>
          </div>
        </div>

        <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold tracking-tight flex items-center gap-2 ${scorePillBg}`}>
          <span>Target Keyword Match:</span>
          <span className="font-mono text-sm font-extrabold">
            {verifiedCount}/{calculatedTotal} ({currentMatchRate}%)
          </span>
        </div>
      </div>

      <div className="space-y-4 print:space-y-3">
        {/* Top 5 Critical Missing Skills Focus Card */}
        {uniqueMissing.length > 0 ? (
          <div className="p-4 rounded-xl border border-rose-500/25 bg-rose-500/5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <XCircle size={15} weight="fill" />
                Top {Math.min(5, uniqueMissing.length)} Critical Missing Skills (High JD Frequency)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Priority Gaps in Analyzed Job Postings
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {uniqueMissing.slice(0, 5).map((item, i) => {
                const isSelected = selectedSkills.has(item.keyword)
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-100 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/40 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-xs font-bold truncate" title={item.keyword}>
                          {item.keyword}
                        </span>
                      </div>
                      <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold mb-2">
                        {item.percentage ? `in ${item.percentage}% of JDs` : (item.badge || 'HIGH PRIORITY')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSkillSelection(item.keyword)}
                      className={`w-full py-1 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      {isSelected ? '✓ Added' : '+ Add to Work Bullet'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-800/50 flex items-center gap-2">
            <CheckCircle size={16} weight="fill" className="text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
              <strong>100% Core Keyword Coverage</strong> — All essential target skills detected in your resume.
            </span>
          </div>
        )}

        {/* Collapsible Full Keyword Inventory (Eliminates the 110-tag dump on web & print) */}
        <div className="pt-1 print:hidden">
          <button
            type="button"
            onClick={() => setShowAllTags(!showAllTags)}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
          >
            <span>
              {showAllTags ? '▲ Hide full keyword inventory' : `▼ Show full keyword inventory (${cleanMatched.length} verified, ${cleanSkillsOnly.length} skills-only)`}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {showAllTags ? 'Click to collapse' : 'Click to inspect all tags'}
            </span>
          </button>

          {showAllTags && (
            <div className="mt-4 space-y-4 animate-fadeIn">
              {/* Row 1: Verified in Experience tags */}
              <div className={`keyword-bucket keyword-row-group p-4 rounded-xl border ${light ? 'bg-emerald-50/40 border-emerald-200/80' : 'bg-emerald-950/20 border-emerald-800/40'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle size={15} weight="fill" className="text-emerald-600" />
                    Verified in Experience
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                    {cleanMatched.length} {cleanMatched.length === 1 ? 'skill' : 'skills'}
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed mb-2.5 ${light ? 'text-slate-600' : 'text-slate-400'}`}>
                  Core target skills proven through concrete accomplishments and deliverables in your work bullets.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cleanMatched.length > 0 ? (
                    cleanMatched.map((kw, i) => (
                      <span
                        key={i}
                        className={`text-[12px] px-2.5 py-1 rounded-lg font-medium border ${
                          light
                            ? 'bg-white text-emerald-800 border-emerald-200 shadow-2xs'
                            : 'bg-emerald-950/60 text-emerald-200 border-emerald-700/50'
                        }`}
                      >
                        ✓ {kw}
                      </span>
                    ))
                  ) : (
                    <span className={`text-xs italic ${light ? 'text-slate-400' : 'text-slate-500'}`}>
                      No experience keyword matches detected yet.
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: In Skills Section Only tags */}
              <div className={`keyword-bucket keyword-row-group p-4 rounded-xl border ${light ? 'bg-amber-50/40 border-amber-200/80' : 'bg-amber-950/20 border-amber-800/40'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Warning size={15} weight="fill" className="text-amber-500" />
                    In Skills Section Only — Add to a Work Bullet
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    {cleanSkillsOnly.length} {cleanSkillsOnly.length === 1 ? 'skill' : 'skills'}
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed mb-2.5 ${light ? 'text-amber-900/80' : 'text-amber-300/80'}`}>
                  Listed in your Skills section, but not demonstrated in your work history.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cleanSkillsOnly.length > 0 ? (
                    cleanSkillsOnly.map((kw, i) => (
                      <span
                        key={i}
                        className={`text-[12px] px-2.5 py-1 rounded-lg font-medium border ${
                          light
                            ? 'bg-white text-amber-900 border-amber-200 shadow-2xs'
                            : 'bg-amber-950/60 text-amber-200 border-amber-700/50'
                        }`}
                      >
                        ⚠️ {kw}
                      </span>
                    ))
                  ) : (
                    <span className={`text-xs italic ${light ? 'text-slate-400' : 'text-slate-500'}`}>
                      None. All listed skills are actively backed by work experience.
                    </span>
                  )}
                </div>
              </div>

              {/* Row 3: Remaining Missing Skills */}
              {uniqueMissing.length > 5 && (
                <div className={`keyword-bucket keyword-row-group p-4 rounded-xl border ${light ? 'bg-rose-50/40 border-rose-200/80' : 'bg-rose-950/20 border-rose-800/40'} space-y-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                      <XCircle size={15} weight="fill" className="text-rose-500" />
                      Additional Missing Market Skills ({uniqueMissing.length - 5})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueMissing.slice(5).map((item, i) => {
                      const isSelected = selectedSkills.has(item.keyword)
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleSkillSelection(item.keyword)}
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 hover:border-rose-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="pointer-events-none w-3 h-3 text-emerald-600 rounded"
                          />
                          <span>{item.keyword}</span>
                          {item.percentage && (
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold">
                              {item.percentage}%
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Single Unified Resume Download Card ── */}
      <div className="mt-5 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              Ready-to-Apply Asset
            </span>
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {selectedSkills.size > 0
                ? `${selectedSkills.size} Selected Target Skills Woven into Experience`
                : cleanSkillsOnly.length > 0
                ? `Auto-Weaving ${cleanSkillsOnly.length} Stranded Skills into Experience`
                : 'Harvard-ATS Single-Column Format (.docx)'}
            </span>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {selectedSkills.size > 0
              ? `Estimated ATS Match Lift: +${liftPercent}% (from ${currentMatchRate}% ➔ ${projectedPercent}%) [${projectedCount}/${calculatedTotal} keywords verified]`
              : cleanSkillsOnly.length > 0
              ? `Keywords from your Skills section (such as ${cleanSkillsOnly.slice(0, 3).join(', ')}) will be naturally backed by concrete experience bullets.`
              : 'Formatted to pass Workday, Taleo, and Greenhouse parsers with 100% extraction.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTailoredResume}
          disabled={isDownloading}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
        >
          <DownloadSimple size={15} weight="bold" />
          <span>{isDownloading ? 'Building Tailored Resume...' : 'Download Tailored ATS Resume (.docx)'}</span>
        </button>
      </div>
    </div>
  )
}
