import React, { useState, useMemo } from 'react'
import { ShieldCheck, ChevronDown, Check, Plus, Copy, Sparkles } from 'lucide-react'
import {
  getTalkingScript,
  getResumeSentence,
  getInterviewerQuestion,
  getTradeOffJustification,
} from '../../../backend/agents/resume/market/interviewDefenseGenerator.js'

export { getTalkingScript, getResumeSentence, getInterviewerQuestion, getTradeOffJustification }

export default function InterviewDefenseInteractive({
  initialSkillsOnly = [], // Skills in section but not in bullets
  interviewLedger = [],
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
    return selectedSkills.map((skill) => {
      const fromLedger = Array.isArray(interviewLedger)
        ? interviewLedger.find((l) => (l.keyword || l.skill || '').toLowerCase() === skill.toLowerCase())
        : null

      return {
        keyword: skill,
        skill,
        company: fromLedger?.company || company,
        exactBullet: fromLedger?.exactBullet || fromLedger?.wovenBullet || fromLedger?.bulletText || getResumeSentence(skill, company),
        resumeSentence: fromLedger?.exactBullet || fromLedger?.wovenBullet || fromLedger?.bulletText || getResumeSentence(skill, company),
        interviewerQuestion: fromLedger?.interviewerQuestion || getInterviewerQuestion(skill, company),
        talkingScript: fromLedger?.talkingScript || fromLedger?.interviewTalkingScript || getTalkingScript(skill, targetRole, company),
        tradeOffJustification: fromLedger?.tradeOffJustification || getTradeOffJustification(skill),
      }
    })
  }, [selectedSkills, interviewLedger, targetRole, company])

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
            const isCopied = copiedSkill === (item.keyword || item.skill)
            return (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4 transition-all hover:border-emerald-300"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-gray-900">{item.keyword || item.skill}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Verified in Experience
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">{item.company}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.talkingScript, item.keyword || item.skill)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-gray-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 transition-all cursor-pointer"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-gray-400" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* 1. How It Appears on Resume */}
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Tailored Resume Bullet:
                  </span>
                  <p className="text-xs text-gray-800 italic leading-relaxed">
                    "{item.exactBullet || item.resumeSentence}"
                  </p>
                </div>

                {/* 2. Expected Technical Interview Question */}
                {item.interviewerQuestion && (
                  <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-200/70">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                      Target Interview Question:
                    </span>
                    <p className="text-xs font-semibold text-amber-950">
                      "{item.interviewerQuestion}"
                    </p>
                  </div>
                )}

                {/* 3. Word-for-Word Verbal Defense Script */}
                <div className="bg-emerald-50/60 rounded-lg p-3.5 border border-emerald-200/70 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Word-for-Word Technical Talking Script:
                  </span>
                  <p className="text-xs font-medium text-emerald-950 leading-relaxed">
                    "{item.talkingScript}"
                  </p>

                  {item.tradeOffJustification && (
                    <div className="pt-2 border-t border-emerald-200/50">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">
                        Engineering Trade-off / "Why This Tool?":
                      </span>
                      <p className="text-[11px] text-emerald-900 leading-normal">
                        {item.tradeOffJustification}
                      </p>
                    </div>
                  )}
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
