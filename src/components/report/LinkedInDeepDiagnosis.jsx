import React, { useState } from 'react'
import {
  LinkedinLogo,
  WarningCircle,
  ShieldWarning,
  ArrowRight,
  Copy,
  Check,
  Sparkle,
  Tag,
  Briefcase,
  CalendarBlank,
  Plus,
  TextT,
  PushPin,
  CheckCircle,
  Certificate,
  FolderSimple,
  Globe,
  Star,
} from '@phosphor-icons/react'
import ResumeScoreCard from './ResumeScoreCard.jsx'
import FeedbackThumbs from './FeedbackThumbs.jsx'
import useAppStore from '../../store/useAppStore'

const severityChip = {
  high: 'bg-red-500/10 text-red-600 border border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  low: 'bg-sky-500/10 text-sky-600 border border-sky-500/20',
}

const HEADLINE_FORMULA_LABELS = {
  0: 'Search-Optimized',
  1: 'Impact-Driven',
  2: 'Specialist',
}

// Defensive helper to prevent React runtime crash from rendering raw objects
const safeText = (val) => {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') {
    return (
      val.text ||
      val.content ||
      val.fullText ||
      val.paragraph ||
      val.diagnosis ||
      val.message ||
      val.title ||
      val.name ||
      val.skill ||
      ''
    )
  }
  return String(val)
}

export default function LinkedInDeepDiagnosis({ linkedinAgent }) {
  const theme = useAppStore((s) => s.theme)
  const variant = theme === 'dark' ? 'dark' : 'light'
  const [copiedId, setCopiedId] = useState(null)

  if (!linkedinAgent || linkedinAgent.dataAvailable === false) {
    return null
  }

  const isVisualItem = (item) => {
    if (!item) return false
    const str = [item.id, item.type, item.section, item.title, item.name, item.diagnosis].filter(Boolean).join(' ').toLowerCase()
    return /visual_photo|visual_banner|profile photo|cover banner|headshot|avatar zone/i.test(str)
  }

  const missingSections = (linkedinAgent.missingSections || []).filter(Boolean).filter((s) => !isVisualItem(s))
  
  // Track keys from missingSections to avoid duplicating in discrepancies
  const missingSectionKeys = new Set(
    missingSections.flatMap((s) => [s.title?.toLowerCase().trim(), s.id?.toLowerCase().trim()]).filter(Boolean)
  )

  const discrepancies = (linkedinAgent.discrepancies || [])
    .filter(Boolean)
    .filter((d) => !isVisualItem(d))
    .filter((d) => {
      const titleKey = d.title?.toLowerCase().trim()
      const idKey = d.id?.toLowerCase().trim()
      if (titleKey && missingSectionKeys.has(titleKey)) return false
      if (idKey && missingSectionKeys.has(idKey)) return false
      return true
    })

  const droppedImpact = (linkedinAgent.droppedImpact || []).filter(Boolean)
  const missingSkills = (linkedinAgent.missingSkills || []).filter(Boolean)
  const optimizations = linkedinAgent.optimizations || linkedinAgent.aiOptimizations || null

  const experienceUpgrades = (optimizations?.experienceUpgrades || []).filter(Boolean)
  const sectionsToAdd = optimizations?.sectionsToAddFromResume || null
  const visibilityTricks = (optimizations?.visibilityTricks || []).filter(Boolean)
  const featuredWork = (optimizations?.featuredSectionRecommendations || []).filter(Boolean)

  const top3PinnedSkills = (
    optimizations?.top3PinnedSkills?.length
      ? optimizations.top3PinnedSkills
      : missingSkills.slice(0, 3)
  ).filter(Boolean)

  const recommendedSkills = (
    optimizations?.recommendedSkillsToAdd?.length
      ? optimizations.recommendedSkillsToAdd
      : missingSkills
  ).filter(Boolean)

  const handleCopy = (text, id) => {
    if (!text) return
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    }
    setCopiedId(id)
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr))
    }, 2000)
  }

  // ── Combine & Cap Cross-Platform Discrepancies to Top 4 ────────────────
  const allDiscrepancyCandidates = [
    ...missingSections.map((sec) => ({
      id: sec.id || `ms_${sec.title}`,
      title: sec.title,
      type: sec.type || 'missing_section',
      badge: 'Missing Section',
      severity: 'high',
      resumeClaim: sec.resumeClaim || 'Present on verified resume',
      linkedinClaim: sec.linkedinClaim || 'Not Listed on LinkedIn',
      diagnosis: sec.diagnosis,
      recommendation: sec.recommendation,
    })),
    ...discrepancies.map((disc) => ({
      id: disc.id || `disc_${disc.title}`,
      title: disc.title,
      type: disc.type || 'discrepancy',
      badge: disc.type === 'timeline_drift' ? 'Timeline Drift' : disc.type === 'title_drift' ? 'Title Drift' : 'Discrepancy',
      severity: disc.severity || 'medium',
      resumeClaim: disc.resumeClaim || 'Resume Record',
      linkedinClaim: disc.linkedinClaim || 'LinkedIn Record',
      diagnosis: disc.diagnosis,
      recommendation: disc.recommendation,
    })),
    ...droppedImpact.map((drop, idx) => ({
      id: drop.id || `drop_${idx}`,
      title: `Omitted Achievement: ${drop.company || 'Experience'}`,
      type: 'dropped_impact',
      badge: 'Omitted Achievement',
      severity: 'medium',
      resumeClaim: drop.sampleResumeProof,
      linkedinClaim: 'Omitted from profile',
      diagnosis: drop.diagnosis,
      recommendation: drop.recommendation,
    })),
  ]

  const seenDiscTitles = new Set()
  const topDiscrepancies = []
  for (const item of allDiscrepancyCandidates) {
    const key = (item.title || item.id || '').toLowerCase().trim()
    if (!key || seenDiscTitles.has(key)) continue
    seenDiscTitles.add(key)
    topDiscrepancies.push(item)
    if (topDiscrepancies.length === 4) break
  }

  // ── Consolidated Featured & Projects Showcase (Single Source of Truth) ─
  const projectShowcaseMap = new Map()

  if (Array.isArray(sectionsToAdd?.projects)) {
    sectionsToAdd.projects.forEach((proj) => {
      const key = (proj.title || '').toLowerCase().trim()
      if (!key) return
      projectShowcaseMap.set(key, {
        title: proj.title,
        description: proj.description,
        technologies: Array.isArray(proj.technologies) ? proj.technologies : [],
        actionNote: proj.replaceNote || 'Pin to Featured section & add under LinkedIn Projects',
      })
    })
  }

  if (Array.isArray(featuredWork)) {
    featuredWork.forEach((fw) => {
      const key = (fw.title || '').toLowerCase().trim()
      if (!key) return
      if (projectShowcaseMap.has(key)) {
        const existing = projectShowcaseMap.get(key)
        if (!existing.description && fw.reason) existing.description = fw.reason
        if (fw.callToAction && !existing.actionNote) existing.actionNote = fw.callToAction
      } else {
        projectShowcaseMap.set(key, {
          title: fw.title,
          description: fw.reason,
          technologies: [],
          actionNote: fw.callToAction || 'Pin to Featured section on LinkedIn',
        })
      }
    })
  }

  const consolidatedProjects = Array.from(projectShowcaseMap.values())
  const hasCertifications = Array.isArray(sectionsToAdd?.certifications) && sectionsToAdd.certifications.length > 0

  // ── Track Seen Titles for Bottom Issues Deduplication ───────────────────
  const seenDiagnosisTitles = new Set([
    ...missingSections.map((s) => s.title?.toLowerCase().trim()).filter(Boolean),
    ...discrepancies.map((d) => d.title?.toLowerCase().trim()).filter(Boolean),
    ...topDiscrepancies.map((d) => d.title?.toLowerCase().trim()).filter(Boolean),
  ])

  const remainingIssues = (linkedinAgent.issues || []).filter(Boolean).filter((iss) => {
    const titleKey = (iss.title || iss.name || '').toLowerCase().trim()
    if (!titleKey || seenDiagnosisTitles.has(titleKey)) return false
    return true
  })

  // Calculate About section statistics safely
  const rawAbout = optimizations?.aboutRewrite || null
  const aboutIsString = typeof rawAbout === 'string'
  const hookText = safeText(rawAbout?.hook)
  const proofText = safeText(rawAbout?.proof)
  const ctaText = safeText(rawAbout?.callToAction)
  const fallbackFullText = safeText(rawAbout?.fullText)

  const fullAboutText = aboutIsString
    ? rawAbout
    : fallbackFullText || [hookText, proofText, ctaText].filter(Boolean).join('\n\n')

  const aboutWordCount = fullAboutText.trim()
    ? fullAboutText.trim().split(/\s+/).filter(Boolean).length
    : 0
  const aboutCharCount = fullAboutText.length

  return (
    <section id="linkedin-ai" className="space-y-8 scroll-mt-28">
      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[#0a66c2] flex items-center">
          <LinkedinLogo size={26} weight="fill" />
        </span>
        <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
          AI All-Star LinkedIn Profile Diagnosis & Optimizer
        </h2>
        <span className="flex-1 h-px bg-[var(--border-default)]" />
      </div>

      {/* ── 1. Scorecard at the top ────────────────────────────────────────── */}
      <ResumeScoreCard
        dashboard={linkedinAgent}
        variant={variant}
        title="LinkedIn Profile Score"
        scoreWord="LinkedIn profile"
      />

      {/* ── 2. Resume-vs-LinkedIn Missing Sections & Discrepancies (Top 4 Compact Grid) ── */}
      {topDiscrepancies.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-start gap-3.5 border-b border-[var(--border-default)] pb-4">
            <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0 mt-0.5">
              <ShieldWarning size={24} weight="duotone" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Missing Sections & Cross-Platform Discrepancies
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                  Top Recruiter Screening Flags
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Differences between your verified resume and LinkedIn profile (e.g. omitted sections, title drift, timeline drift, or missing skills) are immediate friction points that recruiters notice in candidate screenings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {topDiscrepancies.map((item, idx) => (
              <div
                key={item.id || idx}
                className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-3 text-xs shadow-2xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5 truncate">
                      {item.type === 'timeline_drift' ? (
                        <CalendarBlank size={15} className="text-[#0a66c2] shrink-0" />
                      ) : item.type === 'title_drift' ? (
                        <Briefcase size={15} className="text-[#0a66c2] shrink-0" />
                      ) : item.type === 'missing_section' ? (
                        <FolderSimple size={15} className="text-amber-500 shrink-0" />
                      ) : (
                        <WarningCircle size={15} className="text-amber-500 shrink-0" />
                      )}
                      <span className="truncate">{safeText(item.title)}</span>
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md shrink-0 border ${
                        item.severity === 'high'
                          ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>

                  {/* Clean 1-Line Comparison Pill */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] text-xs overflow-hidden">
                    <span className="font-semibold text-[var(--text-primary)] shrink-0">Resume:</span>
                    <span className="truncate text-[var(--text-secondary)]">{safeText(item.resumeClaim)}</span>
                    <span className="text-[var(--text-muted)] shrink-0 font-medium">vs.</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400 shrink-0">LinkedIn:</span>
                    <span className="truncate text-rose-600 dark:text-rose-400 font-medium">{safeText(item.linkedinClaim)}</span>
                  </div>

                  {item.diagnosis && (
                    <p className="text-[var(--text-secondary)] leading-relaxed pt-0.5">{safeText(item.diagnosis)}</p>
                  )}
                </div>

                {item.recommendation && (
                  <p className="text-xs text-[var(--text-primary)] font-medium pt-2 border-t border-[var(--border-default)]">
                    <ArrowRight size={12} className="inline mr-1 text-[var(--primary)]" />
                    {safeText(item.recommendation)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. AI Optimization Suite ───────────────────────────────────────── */}
      {optimizations && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-[var(--primary-light)] text-[var(--primary)]">
              <Sparkle size={18} weight="fill" />
            </span>
            <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
              Action-Oriented All-Star Optimization Suite
            </h3>
          </div>

          {/* 3 Interactive Headline Options (One-Click Copy) */}
          {Array.isArray(optimizations.headlines) && optimizations.headlines.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <TextT size={14} className="text-[var(--primary)]" />
                  Targeted Headline Selector (One-Click Copy)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Recruiter SEO & Impact Formats
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {optimizations.headlines.map((item, idx) => {
                  const copyKey = `headline_${idx}`
                  const isCopied = copiedId === copyKey
                  const headlineText = typeof item === 'string' ? item : safeText(item?.headline || item?.text)
                  const whyItWorks = safeText(item?.whyItWorks)
                  const label =
                    HEADLINE_FORMULA_LABELS[idx] ||
                    safeText(item?.formula) ||
                    `Option ${idx + 1}`

                  return (
                    <div
                      key={idx}
                      className="flex flex-col justify-between bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-4 shadow-xs hover:border-[var(--primary)]/40 hover:shadow-sm transition-all"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                            {label}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                          {headlineText}
                        </p>
                        {whyItWorks && (
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-1 border-t border-[var(--border-default)]">
                            <span className="font-medium text-[var(--text-primary)]">Why recruiters click: </span>
                            {whyItWorks}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(headlineText, copyKey)}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-default)]'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check size={14} weight="bold" /> Copied Headline!
                          </>
                        ) : (
                          <>
                            <Copy size={14} /> Copy Headline
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Story-Driven About Section Card */}
          {rawAbout && (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      Story-Driven About Section Rewrite
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-default)] font-semibold">
                      {aboutWordCount} words · {aboutCharCount} chars (limit: 2,600)
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Engineered for modern recruiter scan habits: The Hook → Quantified Proof → Next Role Call-to-Connect
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(fullAboutText, 'about_rewrite')}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    copiedId === 'about_rewrite'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#0a66c2] hover:bg-[#004182] text-white'
                  }`}
                >
                  {copiedId === 'about_rewrite' ? (
                    <>
                      <Check size={14} weight="bold" /> Copied Full About Section!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy Full About Section
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-4 bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-5 text-xs text-[var(--text-secondary)] leading-relaxed">
                {aboutIsString ? (
                  <p className="text-[var(--text-primary)] whitespace-pre-wrap">{rawAbout}</p>
                ) : (
                  <>
                    {hookText && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--primary)]">
                          Paragraph 1: The Hook (Technical Identity & Domain)
                        </span>
                        <p className="text-[var(--text-primary)] font-medium whitespace-pre-wrap">
                          {hookText}
                        </p>
                      </div>
                    )}
                    {proofText && (
                      <div className="space-y-1 pt-2 border-t border-[var(--border-default)]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                          Paragraph 2: Quantified Proof & Architecture Scale
                        </span>
                        <p className="text-[var(--text-secondary)] whitespace-pre-wrap">
                          {proofText}
                        </p>
                      </div>
                    )}
                    {ctaText && (
                      <div className="space-y-1 pt-2 border-t border-[var(--border-default)]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-primary)]">
                          Paragraph 3: Next Role Focus & Call to Connect
                        </span>
                        <p className="text-[var(--text-secondary)] italic whitespace-pre-wrap">
                          {ctaText}
                        </p>
                      </div>
                    )}
                    {!hookText && !proofText && !ctaText && fallbackFullText && (
                      <p className="text-[var(--text-primary)] whitespace-pre-wrap">
                        {fallbackFullText}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Experience Bullet Upgrades (Outcome & Metrics Driven) ──────────── */}
          {experienceUpgrades.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase size={15} className="text-[var(--primary)]" />
                    High-Impact Experience Bullet Rewrites ({experienceUpgrades.length} Roles)
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Pre-engineered with hard metrics, action verbs, and verified technical scope from your resume.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Ready to Paste
                </span>
              </div>

              <div className="space-y-4">
                {experienceUpgrades.map((item, idx) => {
                  const bullets = (item.bullets || []).filter(Boolean)
                  const allBulletsText = bullets.map((b) => (typeof b === 'string' ? `• ${b}` : `• ${safeText(b)}`)).join('\n')
                  const copyRoleKey = `role_exp_${idx}`
                  const isRoleCopied = copiedId === copyRoleKey

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-md bg-[var(--primary-light)] text-[var(--primary)]">
                            <Briefcase size={14} />
                          </span>
                          <span className="text-sm font-bold text-[var(--text-primary)]">
                            {safeText(item.role)} <span className="font-normal text-[var(--text-muted)]">at</span> {safeText(item.company)}
                          </span>
                        </div>

                        {bullets.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleCopy(allBulletsText, copyRoleKey)}
                            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isRoleCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                            }`}
                          >
                            {isRoleCopied ? (
                              <>
                                <Check size={13} weight="bold" /> Copied Bullets!
                              </>
                            ) : (
                              <>
                                <Copy size={13} /> Copy All Bullets
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {item.linkedinGap && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--surface-card)] border border-amber-500/30 text-xs text-[var(--text-primary)]">
                          <WarningCircle size={15} className="text-amber-500 shrink-0 mt-0.5" weight="fill" />
                          <div>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">LinkedIn Gap / Alignment: </span>
                            <span className="text-[var(--text-secondary)]">{safeText(item.linkedinGap)}</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {bullets.map((b, bIdx) => {
                          const rawText = typeof b === 'string' ? b : safeText(b)
                          const cleanText = rawText.replace(/\*\*/g, '')
                          const isMandate = /^Role Mandate:\s*/i.test(cleanText)
                          const mandateRemainder = isMandate ? cleanText.replace(/^Role Mandate:\s*/i, '') : cleanText
                          const copyBulletKey = `bullet_${idx}_${bIdx}`
                          const isBulletCopied = copiedId === copyBulletKey

                          return (
                            <div
                              key={bIdx}
                              className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] leading-relaxed group"
                            >
                              <div className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" weight="fill" />
                                <span>
                                  {isMandate ? (
                                    <>
                                      <strong className="font-bold text-[var(--text-primary)]">Role Mandate: </strong>
                                      {mandateRemainder}
                                    </>
                                  ) : (
                                    cleanText
                                  )}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(cleanText, copyBulletKey)}
                                className={`shrink-0 p-1 rounded-md transition-colors ${
                                  isBulletCopied
                                    ? 'text-emerald-600 bg-emerald-500/10'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]'
                                }`}
                                title="Copy bullet"
                              >
                                {isBulletCopied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Top 3 Pinned Skills Badges ─────────────────────────────────── */}
          {top3PinnedSkills.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <PushPin size={16} weight="fill" className="text-[var(--primary)]" />
                  Top 3 Pinned Skills (Profile Anchor)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Pin these 3 to the top of your LinkedIn Skills section
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top3PinnedSkills.map((skill, idx) => {
                  const copyKey = `pinned_${idx}`
                  const isCopied = copiedId === copyKey
                  const skillName = safeText(skill)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleCopy(skillName, copyKey)}
                      className={`print-keep p-3.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                        isCopied
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'border-[var(--primary)]/20 bg-[var(--primary-light)] hover:bg-[var(--primary-light)]/80 text-[var(--text-primary)]'
                      }`}
                      title="Click to copy pinned skill"
                    >
                      <div className="flex items-center gap-2">
                        <PushPin size={14} weight="fill" className={isCopied ? 'text-white' : 'text-[var(--primary)]'} />
                        <span className="text-xs font-bold">{skillName}</span>
                      </div>
                      {isCopied ? <Check size={14} weight="bold" /> : <Copy size={13} className="opacity-60" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Missing Skills Chips (Add to LinkedIn Skills Bank) */}
          {recommendedSkills.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={14} className="text-[var(--primary)]" />
                  Recommended Skills to Add ({recommendedSkills.length} Verified Resume Skills)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Click any chip to copy into LinkedIn skills bank
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {recommendedSkills.map((skill, idx) => {
                  const copyKey = `skill_${idx}`
                  const isCopied = copiedId === copyKey
                  const skillName = safeText(skill)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleCopy(skillName, copyKey)}
                      className={`print-keep px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-default)]'
                      }`}
                      title="Click to copy skill name"
                    >
                      {isCopied ? (
                        <Check size={13} weight="bold" />
                      ) : (
                        <Plus size={13} weight="bold" className="text-[var(--primary)]" />
                      )}
                      <span>{skillName}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Single Consolidated: Featured & Projects Showcase (Add to LinkedIn) ── */}
          {(consolidatedProjects.length > 0 || hasCertifications) && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Star size={16} weight="fill" className="text-amber-500" />
                    Featured & Projects Showcase (Add to LinkedIn)
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Verified projects from your resume to pin to the top of your profile and add to your LinkedIn Projects section for recruiter visibility.
                  </p>
                </div>
              </div>

              {consolidatedProjects.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {consolidatedProjects.map((proj, pIdx) => {
                    const copyProjKey = `showcase_proj_${pIdx}`
                    const isCopied = copiedId === copyProjKey
                    const projCopyText = `${safeText(proj.title)}\n${safeText(proj.description)}${proj.technologies?.length ? `\nSkills: ${proj.technologies.join(', ')}` : ''}`

                    return (
                      <div
                        key={pIdx}
                        className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3 text-xs flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1.5">
                              <FolderSimple size={15} className="text-[#0a66c2] shrink-0" />
                              {safeText(proj.title)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(projCopyText, copyProjKey)}
                              className={`print-keep text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                              }`}
                            >
                              {isCopied ? <Check size={11} weight="bold" /> : <Copy size={11} />}
                              {isCopied ? 'Copied' : 'Copy'}
                            </button>
                          </div>

                          <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(proj.description)}</p>

                          {proj.actionNote && (
                            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--primary-light)] border border-[var(--primary)]/20 text-[11px] text-[var(--text-primary)]">
                              <ArrowRight size={13} className="text-[var(--primary)] shrink-0 mt-0.5" />
                              <span>
                                <strong className="font-semibold text-[var(--primary)]">Action: </strong>
                                {safeText(proj.actionNote)}
                              </span>
                            </div>
                          )}
                        </div>

                        {Array.isArray(proj.technologies) && proj.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--border-default)]">
                            {proj.technologies.map((t, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--border-default)]"
                              >
                                {safeText(t)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Verified Licenses & Certifications (if present) */}
              {hasCertifications && (
                <div className="pt-4 border-t border-[var(--border-default)] space-y-3">
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Certificate size={15} className="text-amber-500" />
                    Verified Licenses & Certifications to Add ({sectionsToAdd.certifications.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sectionsToAdd.certifications.map((cert, cIdx) => {
                      const copyCertKey = `add_cert_${cIdx}`
                      const isCopied = copiedId === copyCertKey
                      const certText = `${safeText(cert.name)} - ${safeText(cert.issuer || cert.authority)}${cert.date ? ` (${safeText(cert.date)})` : ''}`

                      return (
                        <div
                          key={cIdx}
                          className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold text-[var(--text-primary)] truncate block">{safeText(cert.name)}</span>
                            <p className="text-[var(--text-secondary)] text-[11px] truncate">
                              {safeText(cert.issuer || cert.authority)} {cert.date ? `· ${safeText(cert.date)}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(certText, copyCertKey)}
                            className={`print-keep shrink-0 text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                            }`}
                          >
                            {isCopied ? <Check size={11} weight="bold" /> : <Copy size={11} />}
                            {isCopied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Recruiter Visibility & Search Ranking Playbook (2x2 Grid) ────── */}
          {visibilityTricks.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Globe size={15} className="text-[var(--primary)]" />
                    Recruiter Visibility & Search Ranking Playbook
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Targeted configuration and search algorithm triggers that boost your profile to the top 5% of candidate queries.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibilityTricks.slice(0, 4).map((trick, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2.5 text-xs flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--text-primary)]">{safeText(trick.trick || trick.category)}</span>
                        {trick.category && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                            {safeText(trick.category)}
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(trick.advice)}</p>
                    </div>

                    {(() => {
                      const trickItems = Array.isArray(trick.items)
                        ? trick.items
                        : Array.isArray(trick.examples)
                        ? trick.examples
                        : trick.query
                        ? [trick.query]
                        : []

                      return trickItems.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[var(--border-default)]">
                          {trickItems.map((it, itIdx) => {
                            const itemText = safeText(it)
                            const copyTrickKey = `trick_${idx}_${itIdx}`
                            const isCopied = copiedId === copyTrickKey

                            return (
                              <button
                                key={itIdx}
                                type="button"
                                onClick={() => handleCopy(itemText, copyTrickKey)}
                                className={`print-keep px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                  isCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[var(--surface-card)] hover:bg-[var(--surface-card)]/80 text-[var(--text-primary)] border border-[var(--border-default)]'
                                }`}
                                title="Click to copy"
                              >
                                {isCopied ? <Check size={11} weight="bold" /> : <Copy size={11} className="opacity-60" />}
                                <span>{itemText}</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : null
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Profile Fixes & Recommendations (Only shown if any unique unhandled items exist) ── */}
      {remainingIssues.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <WarningCircle size={15} className="text-amber-500" /> Profile Fixes & Recommendations ({remainingIssues.length})
          </h3>
          {remainingIssues.map((iss, i) => (
            <div
              key={iss.id || i}
              className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-2.5 shadow-xs"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityChip[iss.severity] || severityChip.low}`}>
                  {safeText(iss.severity)} · {String(safeText(iss.category) || '').replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{safeText(iss.title)}</span>
                <span className="ml-auto">
                  <FeedbackThumbs agent="linkedin" findingId={iss.id || `li_issue_${i}`} />
                </span>
              </div>
              {iss.diagnosis && <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{safeText(iss.diagnosis)}</p>}
              {iss.recommendation && (
                <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-3">
                  <ArrowRight size={12} className="inline mr-1.5 -mt-0.5 text-[var(--primary)]" />
                  {safeText(iss.recommendation)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
