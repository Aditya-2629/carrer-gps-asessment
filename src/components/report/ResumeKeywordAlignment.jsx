import React from 'react'
import { CheckCircle, Warning, XCircle, Sparkle, Target } from '@phosphor-icons/react'

/**
 * ResumeKeywordAlignment
 *
 * Renders the 3-bucket keyword and JD alignment analysis using 3 clean,
 * full-width horizontal pill rows (flex-wrap: wrap).
 *
 * 1. ✓ Verified in Experience (Green Pills)
 * 2. ⚠️ In Skills Section Only — Add to a Work Bullet (Amber Pills, max 8 items)
 * 3. ✕ Missing Target Keywords (Rose Pills, max 8 items) or 100% Coverage Banner
 *
 * Completely eliminates vertical scrollbars (overflow-y: auto) and max-height constraints
 * so pills wrap naturally on screen and in Print / Save PDF.
 *
 * Supports variant="light" (Report page / print) and variant="dark" (Test Lab console).
 */
export default function ResumeKeywordAlignment({ keywordAlignment, variant = 'light' }) {
  if (!keywordAlignment) return null

  const light = variant === 'light'
  const {
    targetRole = '',
    matchedInExperience = [],
    skillsOnlyUnverified = [],
    missingFromResume = [],
    matchPercent = 0,
    matchedCount = 0,
    totalTargetKeywords = 0,
  } = keywordAlignment

  // Cap unverified and missing skills to max 8 items for a clean executive layout
  const MAX_SKILLS_SHOWN = 8
  const displayedSkillsOnly = skillsOnlyUnverified.slice(0, MAX_SKILLS_SHOWN)
  const remainingSkillsOnly = skillsOnlyUnverified.length - displayedSkillsOnly.length

  const displayedMissing = missingFromResume.slice(0, MAX_SKILLS_SHOWN)
  const remainingMissing = missingFromResume.length - displayedMissing.length

  const containerClasses = light
    ? 'bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:shadow-none print:border-slate-300 print:rounded-none'
    : 'bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl'

  const scorePillBg =
    matchPercent >= 75
      ? light
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
      : matchPercent >= 50
      ? light
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
      : light
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-rose-950/80 text-rose-300 border-rose-700/60'

  return (
    <div className={`${containerClasses} space-y-5 print:break-inside-avoid print:p-4 print:space-y-4`}>
      {/* Header with Role and Match Pill */}
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
            <div
              className={`text-[10px] uppercase tracking-wider font-bold ${
                light ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
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
            {matchedCount}/{totalTargetKeywords} ({matchPercent}%)
          </span>
        </div>
      </div>

      {/* 3 Full-Width Horizontal Rows (Zero Scrollbars, flex-wrap) */}
      <div className="space-y-4 print:space-y-3">
        {/* Row 1: Verified in Experience (Green Pills) */}
        <div
          className={`keyword-bucket keyword-row-group p-4 rounded-xl border ${
            light ? 'bg-emerald-50/40 border-emerald-200/80' : 'bg-emerald-950/20 border-emerald-800/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle size={15} weight="fill" className="text-emerald-600" />
              Verified in Experience
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              {matchedInExperience.length} {matchedInExperience.length === 1 ? 'skill' : 'skills'}
            </span>
          </div>
          <p className={`text-[11px] leading-relaxed mb-2.5 ${light ? 'text-slate-600' : 'text-slate-400'}`}>
            Core target skills proven through concrete accomplishments and deliverables in your work bullets.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matchedInExperience.length > 0 ? (
              matchedInExperience.map((kw, i) => (
                <span
                  key={i}
                  className={`text-[12.5px] px-2.5 py-1 rounded-lg font-medium border ${
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

        {/* Row 2: In Skills Section Only — Add to a Work Bullet (Amber Pills) */}
        <div
          className={`keyword-bucket keyword-row-group p-4 rounded-xl border ${
            light ? 'bg-amber-50/40 border-amber-200/80' : 'bg-amber-950/20 border-amber-800/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
              <Warning size={15} weight="fill" className="text-amber-500" />
              In Skills Section Only — Add to a Work Bullet
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
              {skillsOnlyUnverified.length} {skillsOnlyUnverified.length === 1 ? 'skill' : 'skills'}
            </span>
          </div>
          <p className={`text-[11px] leading-relaxed mb-2.5 ${light ? 'text-amber-900/80' : 'text-amber-300/80'}`}>
            Listed in your Skills section, but not demonstrated in your work history. Add these to at least 1 bullet to prove hands-on application.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {displayedSkillsOnly.length > 0 ? (
              <>
                {displayedSkillsOnly.map((kw, i) => (
                  <span
                    key={i}
                    className={`text-[12.5px] px-2.5 py-1 rounded-lg font-medium border ${
                      light
                        ? 'bg-white text-amber-900 border-amber-200 shadow-2xs'
                        : 'bg-amber-950/60 text-amber-200 border-amber-700/50'
                    }`}
                  >
                    ⚠️ {kw}
                  </span>
                ))}
                {remainingSkillsOnly > 0 && (
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium border border-dashed ${
                      light
                        ? 'bg-amber-100/50 text-amber-800 border-amber-300'
                        : 'bg-amber-950/40 text-amber-300 border-amber-700/40'
                    }`}
                  >
                    +{remainingSkillsOnly} more
                  </span>
                )}
              </>
            ) : (
              <span className={`text-xs italic ${light ? 'text-slate-400' : 'text-slate-500'}`}>
                None. All listed skills are actively backed by work experience.
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Missing Target Keywords (Rose Pills or 100% Banner) */}
        <div
          className={`keyword-bucket keyword-row-group p-4 rounded-xl border ${
            missingFromResume.length === 0
              ? light
                ? 'bg-emerald-50/40 border-emerald-200/80'
                : 'bg-emerald-950/20 border-emerald-900/30'
              : light
              ? 'bg-rose-50/40 border-rose-200/80'
              : 'bg-rose-950/20 border-rose-800/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <span
              className={`flex items-center gap-1.5 text-xs font-bold ${
                missingFromResume.length === 0
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-rose-800 dark:text-rose-300'
              }`}
            >
              {missingFromResume.length === 0 ? (
                <CheckCircle size={15} weight="fill" className="text-emerald-600" />
              ) : (
                <XCircle size={15} weight="fill" className="text-rose-500" />
              )}
              {missingFromResume.length === 0 ? 'Target Keyword Coverage' : 'Missing Target Keywords'}
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                missingFromResume.length === 0
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
              }`}
            >
              {missingFromResume.length === 0 ? '100% Covered' : `${missingFromResume.length} missing`}
            </span>
          </div>

          {missingFromResume.length === 0 ? (
            <div
              className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                light
                  ? 'bg-white border-emerald-200 text-emerald-900'
                  : 'bg-emerald-950/50 border-emerald-800/60 text-emerald-200'
              }`}
            >
              <Sparkle size={15} weight="fill" className="text-emerald-600 shrink-0" />
              <span>
                <strong>100% Core Keyword Coverage</strong> — All essential target keywords detected on your resume.
              </span>
            </div>
          ) : (
            <>
              <p className={`text-[11px] leading-relaxed mb-2.5 ${light ? 'text-slate-600' : 'text-slate-400'}`}>
                High-priority market keywords standard for {targetRole || 'this role'} not found anywhere on your resume.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {displayedMissing.map((kw, i) => (
                  <span
                    key={i}
                    className={`text-[12.5px] px-2.5 py-1 rounded-lg font-medium border ${
                      light
                        ? 'bg-white text-rose-700 border-rose-200 shadow-2xs'
                        : 'bg-rose-950/60 text-rose-200 border-rose-700/50'
                    }`}
                  >
                    + {kw}
                  </span>
                ))}
                {remainingMissing > 0 && (
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium border border-dashed ${
                      light
                        ? 'bg-rose-100/50 text-rose-800 border-rose-300'
                        : 'bg-rose-950/40 text-rose-300 border-rose-700/40'
                    }`}
                  >
                    +{remainingMissing} more
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
