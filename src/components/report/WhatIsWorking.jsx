import { motion } from 'framer-motion'
import {
  Sparkle,
  CheckCircle,
  Lightning,
  ShieldCheck,
  Cpu,
  ChartLineUp,
  Star,
} from '@phosphor-icons/react'

const ICONS = [Cpu, Lightning, ShieldCheck, ChartLineUp, Sparkle, Star]

export default function WhatIsWorking({ resumeJsonData, resumeAgent, reportData }) {
  // Collect actual strengths from the resume agent or report payload
  const agentStrengths = Array.isArray(resumeAgent?.strengths) ? resumeAgent.strengths : []
  const reportStrengths = Array.isArray(reportData?.strengths) ? reportData.strengths : []
  const jsonStrengths = Array.isArray(resumeJsonData?.strengths) ? resumeJsonData.strengths : []

  const rawStrengths = agentStrengths.length > 0
    ? agentStrengths
    : reportStrengths.length > 0
    ? reportStrengths
    : jsonStrengths

  // Transform strengths dynamically
  let strengthsList = rawStrengths
    .filter(Boolean)
    .map((str, idx) => {
      const isObj = typeof str === 'object' && str !== null
      const title = isObj ? str.title : (typeof str === 'string' ? str : '')
      const explanation = isObj
        ? (str.description || str.text || '')
        : ''
      const evList = isObj && Array.isArray(str.evidence) ? str.evidence : []
      const evText = evList[0]?.originalText || ''

      return {
        id: isObj ? str.id || `str_${idx}` : `str_${idx}`,
        title: title || 'Demonstrated Capability',
        explanation: explanation || evText || title,
        metricBadge: isObj && str.category ? String(str.category).replace(/_/g, ' ') : 'Verified Strength',
        highlightTag: evText ? 'Evidence in Resume' : 'Recruiter Validated',
        icon: ICONS[idx % ICONS.length],
      }
    })
    .filter((s) => s.title || s.explanation)

  // Fallback 1: Derive from passing ATS checklist items from Resume Agent
  if (strengthsList.length === 0 && Array.isArray(resumeAgent?.dashboard?.checks)) {
    const passedChecks = resumeAgent.dashboard.checks.filter((c) => c.status === 'pass')
    for (const c of passedChecks) {
      strengthsList.push({
        id: `check_${c.id}`,
        title: c.label || 'Recruiter Quality Standard Met',
        explanation: c.detail || 'Verified passing standard on ATS and recruiter audit.',
        metricBadge: 'ATS Audit Passed',
        highlightTag: 'Recruiter Validated',
        icon: ShieldCheck,
      })
    }
  }

  // Fallback 2: If still empty, derive from resume experience/skills
  if (strengthsList.length === 0 && resumeJsonData) {
    const experience = Array.isArray(resumeJsonData.experience) ? resumeJsonData.experience : []
    const skills = Array.isArray(resumeJsonData.skills) || Array.isArray(resumeJsonData.top_skills)
      ? (resumeJsonData.skills || resumeJsonData.top_skills)
      : []

    if (experience.length > 0) {
      const topRole = experience[0]
      const roleTitle = topRole.title || topRole.role || topRole.name
      const company = topRole.company || topRole.organization
      const topBullet = Array.isArray(topRole.bullets) ? topRole.bullets[0]?.text || topRole.bullets[0] : ''

      if (roleTitle || topBullet) {
        strengthsList.push({
          id: 'exp_str_1',
          title: roleTitle ? `Proven Experience as ${roleTitle}` : 'Core Experience Track Record',
          explanation: topBullet || (company ? `Demonstrated track record at ${company}.` : 'Demonstrated work experience.'),
          metricBadge: 'Experience Asset',
          highlightTag: 'Documented in Resume',
          icon: ShieldCheck,
        })
      }
    }

    if (skills.length > 0) {
      const skillSample = skills.slice(0, 6).map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).join(', ')
      if (skillSample) {
        strengthsList.push({
          id: 'skill_str_1',
          title: 'Demonstrated Technical & Domain Skills',
          explanation: `Demonstrated competency across ${skillSample}.`,
          metricBadge: 'Core Capability',
          highlightTag: 'Resume Documented',
          icon: Cpu,
        })
      }
    }
  }

  // If there are no verified strengths found at all, return null so we don't display hardcoded fake data
  if (strengthsList.length === 0) {
    return null
  }

  // Render up to 3 verified items
  const displayItems = strengthsList.slice(0, 3)

  return (
    <section id="strengths" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--emerald)] block">
            Competitive Foundation
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            What is already working
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Lead with these verified assets in phone screens and networking conversations
        </p>
      </div>

      {/* Dynamic Strengths Cards Grid */}
      <div className={`grid grid-cols-1 ${displayItems.length === 1 ? 'md:grid-cols-1' : displayItems.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 items-start`}>
        {displayItems.map((item) => {
          const Icon = item.icon

          return (
            <motion.div
              key={item.id}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="p-5 rounded-2xl bg-[var(--surface-card)] border border-emerald-500/20 bg-emerald-500/[0.02] shadow-xs flex flex-col justify-between space-y-4 h-full"
            >
              <div className="space-y-3">
                {/* Header Icon + Metric Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-[var(--emerald)]">
                    <Icon size={20} weight="fill" />
                  </div>
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-[var(--emerald)] border border-emerald-500/20">
                    {item.metricBadge}
                  </span>
                </div>

                {/* Strength Title */}
                <h3
                  className="text-base font-bold text-[var(--text-primary)] tracking-tight"
                  style={{ fontFamily: 'var(--font-head)' }}
                >
                  {item.title}
                </h3>

                {/* One-Line Explanation */}
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                  {item.explanation}
                </p>
              </div>

              {/* Supporting Signal Tag */}
              <div className="pt-2 border-t border-[var(--border-default)] flex items-center gap-1.5 text-[11px] font-semibold text-[var(--emerald)]">
                <CheckCircle size={14} weight="fill" />
                <span>{item.highlightTag}</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
