import React, { useState, useMemo } from 'react'
import { ShieldCheck, ChevronDown, Building2, MessageSquare, Check, Plus, Copy, Sparkles } from 'lucide-react'
import { getTalkingScript, getResumeSentence } from '../../../backend/agents/resume/market/interviewDefenseGenerator.js'

export { getTalkingScript, getResumeSentence }

export default function InterviewDefenseInteractive({
  initialSkillsOnly = [], // Skills in section but not in bullets
  targetRole = 'Data Analyst',
  company = 'PwC USA',
  onToast = (msg) => console.log(msg),
  onSkillsChange = null,
}) {
  // Active selected skills state (defaults to stranded skills)
  const [selectedSkills, setSelectedSkills] = useState(
    Array.isArray(initialSkillsOnly) && initialSkillsOnly.length > 0 ? initialSkillsOnly : ['SQL', 'Power BI']
  )

  // Progressive display limit: starts at 2, increases by 5
  const [visibleCount, setVisibleCount] = useState(2)
  const [copiedSkill, setCopiedSkill] = useState(null)

  // Toggle skill selection in real-time
  const toggleSkill = (skill) => {
    setSelectedSkills((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === skill.toLowerCase())
      let updated
      if (exists) {
        updated = prev.filter((s) => s.toLowerCase() !== skill.toLowerCase())
        onToast(`Removed "${skill}" from Interview Defense sheet`)
      } else {
        updated = [...prev, skill]
        onToast(`Skill updated in report successfully! Added "${skill}".`)
      }
      if (typeof onSkillsChange === 'function') {
        onSkillsChange(updated)
      }
      return updated
    })
  }

  const handleCopy = (text, skill) => {
    if (!text) return
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedSkill(skill)
      onToast(`Copied interview defense script for ${skill}!`)
      setTimeout(() => setCopiedSkill(null), 2500)
    }).catch(() => {
      setCopiedSkill(skill)
      setTimeout(() => setCopiedSkill(null), 2500)
    })
  }

  // Generate cards for currently selected skills
  const defenseCards = useMemo(() => {
    return selectedSkills.map((skill) => ({
      skill,
      company,
      resumeSentence: getResumeSentence(skill, company),
      talkingScript: getTalkingScript(skill, targetRole, company),
    }))
  }, [selectedSkills, targetRole, company])

  const visibleCards = defenseCards.slice(0, visibleCount)
  const remainingCount = Math.max(0, defenseCards.length - visibleCount)

  const handleViewMore = () => {
    setVisibleCount((prev) => prev + 5)
  }

  // Combined pool of candidate selectable skills
  const availableToggleSkills = useMemo(() => {
    const list = Array.isArray(initialSkillsOnly) && initialSkillsOnly.length > 0
      ? initialSkillsOnly
      : ['BigQuery', 'Looker', 'Databricks', 'Airflow', 'dbt', 'Snowflake', 'Docker']
    // Ensure all currently selected skills are also in the toggle list
    return Array.from(new Set([...list, ...selectedSkills]))
  }, [initialSkillsOnly, selectedSkills])

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 sm:p-6 shadow-xs space-y-6 break-inside-avoid">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-default)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
              Interview Defense & Technical Talking Points
            </h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Prepares you to defend stranded skills listed in your resume during recruiter screenings and live technical rounds.
          </p>
        </div>
        <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
          {selectedSkills.length} Active Target Skills
        </span>
      </div>

      {/* Interactive Skill Selector Bar */}
      <div>
        <p className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          Toggle Skills to Defend in Report:
        </p>
        <div className="flex flex-wrap gap-2">
          {availableToggleSkills.map((skill, idx) => {
            const isSelected = selectedSkills.some((s) => s.toLowerCase() === skill.toLowerCase())
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--border-default)] border border-[var(--border-default)]'
                }`}
              >
                {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {skill}
              </button>
            )
          })}
        </div>
      </div>

      {/* Progressive Defense Cards (2 initial, +5 on click) */}
      <div className="space-y-4">
        {visibleCards.length === 0 ? (
          <div className="p-4 rounded-xl border border-[var(--border-default)] text-center text-xs text-[var(--text-muted)]">
            Click any skill chip above to generate instant technical interview talking points.
          </div>
        ) : (
          visibleCards.map((item, idx) => {
            const isCopied = copiedSkill === item.skill
            return (
              <div
                key={idx}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-4 sm:p-5 transition-all hover:border-emerald-500/40 hover:shadow-xs space-y-3"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-[var(--text-primary)]">{item.skill}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Enhanced in Experience
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{item.company}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.talkingScript, item.skill)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-card)] hover:bg-emerald-500/10 hover:text-emerald-600 transition-all cursor-pointer"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-gray-400" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* How it appears on resume */}
                <div className="bg-[var(--surface-card)] rounded-lg border border-[var(--border-default)] p-3">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    How It Appears On Your Resume:
                  </span>
                  <p className="text-xs text-[var(--text-primary)] italic">
                    "{item.resumeSentence}"
                  </p>
                </div>

                {/* How to defend in interview */}
                <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/25 p-3">
                  <div className="flex items-center gap-1.5 mb-1 text-emerald-800 dark:text-emerald-300">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      How To Defend This In Your Interview:
                    </span>
                  </div>
                  <p className="text-xs text-emerald-950 dark:text-emerald-100 font-medium leading-relaxed">
                    {item.talkingScript}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Progressive "View More (+5)" Button */}
      {remainingCount > 0 && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={handleViewMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] text-xs font-bold text-[var(--text-primary)] shadow-2xs hover:bg-[var(--surface-sunken)] hover:border-[var(--border-hover)] transition-all cursor-pointer"
          >
            <span>View More Skills ({Math.min(5, remainingCount)} of {remainingCount} remaining)</span>
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          </button>
        </div>
      )}
    </div>
  )
}
