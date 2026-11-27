import React, { useState, useMemo } from 'react'
import { ShieldCheck, ChevronDown, ChevronUp, Check, Plus, Copy } from 'lucide-react'
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
  company = 'my organization',
  onToast = (msg) => console.log(msg),
  onSkillsChange = null,
}) {
  // Collapsed by default: no skill card open initially so Bullet Rewrites stays front and center
  const [expandedSkill, setExpandedSkill] = useState(null)
  const [copiedSkill, setCopiedSkill] = useState(null)

  // Combined pool of candidate selectable skills
  const availableSkills = useMemo(() => {
    const list = Array.isArray(initialSkillsOnly) && initialSkillsOnly.length > 0
      ? initialSkillsOnly
      : ['BigQuery', 'Looker', 'Databricks', 'Airflow', 'dbt', 'Snowflake', 'Docker']
    return Array.from(new Set(list))
  }, [initialSkillsOnly])

  const handleToggleSkill = (skill) => {
    if (expandedSkill?.toLowerCase() === skill.toLowerCase()) {
      setExpandedSkill(null)
    } else {
      setExpandedSkill(skill)
      onToast(`Expanded interview defense script for ${skill}`)
      if (typeof onSkillsChange === 'function') {
        onSkillsChange([skill])
      }
    }
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

  // Active card data for currently expanded skill
  const activeCard = useMemo(() => {
    if (!expandedSkill) return null
    const fromLedger = Array.isArray(interviewLedger)
      ? interviewLedger.find((l) => (l.keyword || l.skill || '').toLowerCase() === expandedSkill.toLowerCase())
      : null

    return {
      keyword: expandedSkill,
      skill: expandedSkill,
      company: fromLedger?.company || company,
      exactBullet: fromLedger?.exactBullet || fromLedger?.wovenBullet || fromLedger?.bulletText || getResumeSentence(expandedSkill, company),
      resumeSentence: fromLedger?.exactBullet || fromLedger?.wovenBullet || fromLedger?.bulletText || getResumeSentence(expandedSkill, company),
      interviewerQuestion: fromLedger?.interviewerQuestion || getInterviewerQuestion(expandedSkill, company),
      talkingScript: fromLedger?.talkingScript || fromLedger?.interviewTalkingScript || getTalkingScript(expandedSkill, targetRole, company),
      tradeOffJustification: fromLedger?.tradeOffJustification || getTradeOffJustification(expandedSkill),
    }
  }, [expandedSkill, interviewLedger, targetRole, company])

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 sm:p-6 shadow-xs space-y-5 break-inside-avoid">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-default)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
              Interview Defense &amp; Technical Talking Points
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Prepares you to defend unverified skills during recruiter screenings and live technical rounds.
          </p>
        </div>
        <span className="self-start sm:self-auto text-xs font-mono px-2.5 py-0.5 rounded-md bg-[var(--surface-sunken)] text-[var(--text-muted)] border border-[var(--border-default)]">
          {availableSkills.length} Target Skills Available
        </span>
      </div>

      {/* Interactive Skill Selector Bar (Chips Shown First) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span>Click any skill to inspect talking points:</span>
          </p>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {expandedSkill ? `Inspecting: ${expandedSkill}` : 'Collapsed by default'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableSkills.map((skill, idx) => {
            const isExpanded = expandedSkill?.toLowerCase() === skill.toLowerCase()
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggleSkill(skill)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isExpanded
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--border-default)] border border-[var(--border-default)]'
                }`}
              >
                <span>{skill}</span>
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Collapsed State Prompt or Expanded Card */}
      {!activeCard ? (
        <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--primary)] shrink-0" />
          <span>Click any skill chip above to expand word-for-word technical interview defense scripts and trade-off rationales.</span>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 dark:border-[#1B3326] bg-white dark:bg-[#0B1711] p-5 shadow-xs space-y-4 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1B3326] pb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-[#F0FDF4]">
                {activeCard.skill}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Verified in Experience
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--text-muted)]">{activeCard.company}</span>
              <button
                type="button"
                onClick={() => handleCopy(activeCard.talkingScript, activeCard.skill)}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border border-[var(--border-default)] bg-white dark:bg-[#102118] hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                {copiedSkill === activeCard.skill ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                )}
                <span>{copiedSkill === activeCard.skill ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* 1. How It Appears on Resume */}
          <div className="bg-[var(--surface-sunken)] rounded-lg p-3.5 border border-[var(--border-default)] space-y-1">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Tailored Resume Bullet:
            </span>
            <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">
              &quot;{activeCard.exactBullet || activeCard.resumeSentence}&quot;
            </p>
          </div>

          {/* 2. Expected Technical Interview Question */}
          {activeCard.interviewerQuestion && (
            <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-lg p-3.5 border border-amber-200/70 dark:border-amber-800/40 space-y-1">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider block">
                Target Interview Question:
              </span>
              <p className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                &quot;{activeCard.interviewerQuestion}&quot;
              </p>
            </div>
          )}

          {/* 3. Word-for-Word Verbal Defense Script */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-lg p-3.5 border border-emerald-200/70 dark:border-emerald-800/40 space-y-2">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
              Word-for-Word Technical Talking Script:
            </span>
            <p className="text-xs font-medium text-emerald-950 dark:text-emerald-100 leading-relaxed">
              &quot;{activeCard.talkingScript}&quot;
            </p>

            {activeCard.tradeOffJustification && (
              <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">
                  Engineering Trade-off / &quot;Why This Tool?&quot;:
                </span>
                <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-normal">
                  {activeCard.tradeOffJustification}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
