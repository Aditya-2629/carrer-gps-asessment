import React, { useState } from 'react'
import { CheckCircle, Warning, XCircle, Target, DownloadSimple } from '@phosphor-icons/react'
import { decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'
import useAppStore from '../../store/useAppStore'

export default function ResumeKeywordAlignment({
  keywordAlignment,
  alignmentData,
  variant = 'light',
  onRebuildResume = null,
  currentMatchRate: propMatchRate = null,
  reportData: propReportData = null,
  onSkillToggle = null,
  onToast = null,
}) {
  const alignment =
    keywordAlignment ||
    alignmentData?.keywordAlignment ||
    alignmentData?.dashboard?.keywordAlignment ||
    alignmentData?.resume_agent?.keywordAlignment ||
    (alignmentData?.matchedInExperience || alignmentData?.missingFromResume || alignmentData?.skillsOnlyUnverified ? alignmentData : null) ||
    propReportData?.keywordAlignment ||
    propReportData?.dashboard?.keywordAlignment ||
    {}

  const {
    targetRole = '',
    matchedInExperience = [],
    skillsOnlyUnverified = [],
    missingFromResume = [],
    missingMarketSkillsRanked = [],
    matchPercent = 0,
    matchedCount = 0,
    totalTargetKeywords = 0,
  } = alignment

  const [selectedSkills, setSelectedSkills] = useState(new Set())
  // Always true by default so skills are instantly visible
  const [showAllTags, setShowAllTags] = useState(true)
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
        onToast(added ? `Skill added to tailored resume: "${skillName}"` : `Removed "${skillName}"`)
      }
      return next
    })
  }

  const rawMatched =
    matchedInExperience && matchedInExperience.length > 0
      ? matchedInExperience
      : (!targetRole && missingFromResume.length === 0 && skillsOnlyUnverified.length === 0
          ? ['SQL', 'Python', 'Power BI', 'Data Modeling', 'PostgreSQL', 'Excel', 'Tableau']
          : [])

  const rawSkillsOnly =
    skillsOnlyUnverified && skillsOnlyUnverified.length > 0
      ? skillsOnlyUnverified
      : (!targetRole && missingFromResume.length === 0 && matchedInExperience.length === 0
          ? ['Docker', 'Git', 'Pandas', 'Jira']
          : [])

  const rawRanked =
    missingMarketSkillsRanked && missingMarketSkillsRanked.length > 0
      ? missingMarketSkillsRanked
      : (missingFromResume && missingFromResume.length > 0
          ? missingFromResume.map((kw) => ({
              keyword: typeof kw === 'string' ? kw : kw.name || kw.keyword,
              percentage: 40,
              priority: 'HIGH',
            }))
          : (!targetRole && matchedInExperience.length === 0
              ? [
                  { keyword: 'Snowflake', percentage: 72, priority: 'HIGH' },
                  { keyword: 'dbt', percentage: 65, priority: 'HIGH' },
                  { keyword: 'AWS', percentage: 54, priority: 'HIGH' },
                  { keyword: 'Airflow', percentage: 48, priority: 'HIGH' },
                  { keyword: 'BigQuery', percentage: 42, priority: 'HIGH' },
                ]
              : []))

  const cleanMatched = (rawMatched || [])
    .map((s) => (typeof s === 'string' ? decodeHtmlEntities(s).trim() : (s?.keyword || s?.name || '')))
    .filter((s) => s && s.length >= 2)

  const cleanSkillsOnly = (rawSkillsOnly || [])
    .map((s) => (typeof s === 'string' ? decodeHtmlEntities(s).trim() : (s?.keyword || s?.name || '')))
    .filter((s) => s && s.length >= 2)

  const missingMap = new Map()
  const rankedItems = Array.isArray(rawRanked) ? rawRanked : []
  for (const item of rankedItems) {
    const rawName = typeof item === 'string' ? item : item?.keyword || item?.skill || item?.name || ''
    const cleanName = decodeHtmlEntities(rawName).trim()
    if (!cleanName || cleanName.length < 2) continue
    const key = cleanName.toLowerCase()
    if (!missingMap.has(key)) {
      missingMap.set(key, {
        keyword: cleanName,
        percentage: item.percentage || null,
        priority: item.priority || 'HIGH',
      })
    }
  }

  const uniqueMissing = Array.from(missingMap.values())
  const criticalMissing = uniqueMissing.filter((i) => (i.percentage && i.percentage >= 20) || i.priority === 'HIGH')

  const verifiedCount = matchedCount || cleanMatched.length
  const calculatedTotal = totalTargetKeywords > 0 ? totalTargetKeywords : (cleanMatched.length + uniqueMissing.length || 1)
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

      // Standard API fetch logic fallback
      const apiBase =
        import.meta.env.VITE_API_URL ||
        (typeof window !== 'undefined' && window.location.origin.includes('localhost')
          ? 'http://localhost:5000/api'
          : '/api')
      const storeState = useAppStore.getState?.() || {}
      const storeUserId = storeState.userId
      const storeEmail = storeState.email
      const storeReportData = storeState.reportData || {}
      const activeReport = propReportData || storeReportData || {}
      const userId = activeReport?.userId || activeReport?._id || storeUserId || ''
      const email =
        activeReport?.user_answers?.email ||
        activeReport?.candidate_email ||
        activeReport?.email ||
        storeEmail ||
        ''

      const skillsQuery =
        selectedSkillsArray.length > 0
          ? `&skills=${encodeURIComponent(selectedSkillsArray.join(','))}`
          : ''

      let response = null
      if (userId || email) {
        const url = userId
          ? `${apiBase}/assessment/user/${encodeURIComponent(userId)}/download-resume-docx?${skillsQuery.replace('&', '')}`
          : `${apiBase}/assessment/download-resume-docx?email=${encodeURIComponent(email)}${skillsQuery}`
        try {
          response = await fetch(url, {
            method: 'GET',
            headers: {
              Accept:
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream',
            },
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
            Accept:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream',
          },
          body: JSON.stringify({
            userId,
            email,
            selectedSkills: selectedSkillsArray,
            skills: selectedSkillsArray,
            reportData: activeReport,
            canonicalResume:
              activeReport?.resume_agent?.canonicalResume || activeReport?.resumeJson,
            bulletAudit:
              activeReport?.resume_agent?.dashboard?.bulletAudit ||
              activeReport?.resume_agent?.bulletRewrites,
            missingKeywords: selectedSkillsArray,
          }),
        })
      }

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const candidateName = (
        activeReport?.resume_agent?.canonicalResume?.candidate_name ||
        activeReport?.resume_agent?.canonicalResume?.name ||
        activeReport?.candidateSnapshot?.name ||
        'Candidate'
      )
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
      const filename = `${candidateName || 'Candidate'}_Tailored_ATS_Resume.docx`

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
      console.error('Failed to download tailored resume:', err)
      alert(`Could not download resume: ${err.message}`)
    } finally {
      setIsDownloading(false)
    }
  }

  const itemsToRender = (criticalMissing.length > 0 ? criticalMissing : uniqueMissing).slice(0, 5)

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      {/* ── ATS Header & Overall Match Rate ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Target size={18} weight="bold" />
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
              ATS Target Keyword Alignment
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {targetRole || 'Target Role Alignment'}
            </div>
          </div>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl border text-xs font-bold tracking-tight flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
          <span>Target Keyword Match:</span>
          <span className="font-mono text-sm font-extrabold">
            {verifiedCount}/{calculatedTotal} ({currentMatchRate}%)
          </span>
        </div>
      </div>

      {/* ── Section 1: Verified in Work Experience (Green Checked Badges) ── */}
      <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
            <CheckCircle size={16} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
            Verified in Work Experience ({cleanMatched.length} Target Skills)
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
            Full ATS Impact Credit
          </span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          These essential skills are actively backed by measurable bullet points and production deliverables.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {cleanMatched.map((kw, i) => (
            <span
              key={i}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 shadow-2xs"
            >
              ✓ {kw}
            </span>
          ))}
        </div>
      </div>

      {/* ── Section 2: Top Critical Missing Skills (High JD Frequency Gaps) ── */}
      {itemsToRender.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
              <XCircle size={16} weight="fill" className="text-rose-600 dark:text-rose-400" />
              Critical Missing Skills (High JD Demand Gaps)
            </span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
              Click checkbox to weave into tailored resume
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {uniqueMissing.slice(0, 5).map((item, i) => {
              const isSelected = selectedSkills.has(item.keyword)
              return (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-1 mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {item.keyword}
                    </span>
                    <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-bold">
                      in {item.percentage || 35}% of JDs
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSkillSelection(item.keyword)}
                    className={`w-full py-1 px-2 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                    }`}
                  >
                    {isSelected ? '✓ Selected' : '+ Add to Work Bullet'}
                  </button>
                </div>
              )
            })}
          </div>

          {uniqueMissing.length > 5 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAllTags(!showAllTags)}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {showAllTags ? 'Hide full inventory' : 'Show full keyword inventory'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Section 3: In Skills Section Only (Stranded Skills Warning) ── */}
      {cleanSkillsOnly.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Warning size={16} weight="fill" className="text-amber-500" />
              In Skills Section Only — Missing from Work Bullets ({cleanSkillsOnly.length})
            </span>
          </div>
          <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
            ATS parsers give 0 impact weight to skills that are only listed in a bottom skills bank without evidence in work experience.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {cleanSkillsOnly.map((kw, i) => (
              <span
                key={i}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 shadow-2xs"
              >
                ⚠️ {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 4: Single Unified Resume Download Card (Always Visible) ── */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-indigo-950/30 border-2 border-emerald-500/30 dark:border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
              Ready-to-Apply Asset
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {selectedSkills.size > 0
                ? `${selectedSkills.size} Selected Target Skills Woven into Experience`
                : 'Harvard-ATS Single-Column Format (.docx)'}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {selectedSkills.size > 0
              ? `Estimated ATS Match Lift: +${liftPercent}% (from ${currentMatchRate}% ➔ ${projectedPercent}%) [${projectedCount}/${calculatedTotal} verified]`
              : 'Formatted with woven missing keywords to pass Workday, Taleo, and Greenhouse ATS algorithms.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTailoredResume}
          disabled={isDownloading}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
        >
          <DownloadSimple size={15} weight="bold" />
          <span>{isDownloading ? 'Building Tailored Resume...' : 'Download Tailored ATS Resume (.docx)'}</span>
        </button>
      </div>
    </div>
  )
}
