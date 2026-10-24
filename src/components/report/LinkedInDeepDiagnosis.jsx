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
  TrendDown,
  Plus,
  TextT,
  Camera,
  Image,
  PushPin,
  CheckCircle,
  Palette,
  Certificate,
  FolderSimple,
  Lightbulb,
  Globe,
  Star,
} from '@phosphor-icons/react'
import ResumeScoreCard from './ResumeScoreCard.jsx'
import FeedbackThumbs from './FeedbackThumbs.jsx'
import useAppStore from '../../store/useAppStore'

const severityChip = {
  high: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/80 dark:border-rose-700/60 dark:text-rose-300',
  medium: 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
  low: 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/80 dark:border-sky-700/60 dark:text-sky-300',
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
  const [copiedId, setCopiedId] = useState(null)

  if (!linkedinAgent || linkedinAgent.dataAvailable === false) {
    return null
  }

  const variant = theme === 'dark' ? 'dark' : 'light'
  const issues = (linkedinAgent.issues || []).filter(Boolean)
  const isVisualItem = (item) => {
    if (!item) return false
    const str = [item.id, item.type, item.section, item.title, item.name, item.diagnosis].filter(Boolean).join(' ').toLowerCase()
    return /visual_photo|visual_banner|profile photo|cover banner|headshot|avatar zone/i.test(str)
  }
  const discrepancies = (linkedinAgent.discrepancies || []).filter(Boolean).filter((d) => !isVisualItem(d))
  const droppedImpact = (linkedinAgent.droppedImpact || []).filter(Boolean)
  const missingSkills = (linkedinAgent.missingSkills || []).filter(Boolean)
  const missingSections = (linkedinAgent.missingSections || []).filter(Boolean).filter((s) => !isVisualItem(s))
  const optimizations = linkedinAgent.optimizations || linkedinAgent.aiOptimizations || null

  const visualAudit = linkedinAgent.visualAudit || {
    hasPicture: Boolean(linkedinAgent.hasPicture || linkedinAgent.pictureUrl),
    hasBanner: Boolean(linkedinAgent.hasBanner || linkedinAgent.bannerUrl),
    pictureUrl: linkedinAgent.pictureUrl || null,
    bannerUrl: linkedinAgent.bannerUrl || null,
    issues: [],
  }

  const hasPhoto = Boolean(visualAudit.hasPicture && (visualAudit.pictureUrl || visualAudit.hasPicture !== false))
  const hasBanner = Boolean(visualAudit.hasBanner && (visualAudit.bannerUrl || visualAudit.hasBanner !== false))

  const bannerStrategy = optimizations?.bannerStrategy || {
    bannerTagline: safeText(optimizations?.headlines?.[0]?.headline) || 'Senior Full Stack Engineer | Distributed Systems & Cloud',
    bannerSecondaryText: 'Core Architecture · Scalable Microservices · Production High-Impact Delivery',
    designAdvice: 'Design a clean 1584x396px canvas in Canva. Keep key text in the center-right to avoid the circular profile avatar on mobile. Use dark background with bold typography.',
  }

  const featuredWork = (optimizations?.featuredSectionRecommendations || []).filter(Boolean)
  const experienceUpgrades = (optimizations?.experienceUpgrades || []).filter(Boolean)
  const sectionsToAdd = optimizations?.sectionsToAddFromResume || null
  const visibilityTricks = (optimizations?.visibilityTricks || []).filter(Boolean)

  const top3PinnedSkills = (
    optimizations?.top3PinnedSkills?.length
      ? optimizations.top3PinnedSkills
      : missingSkills.slice(0, 3)
  ).filter(Boolean)

  const visualPresenceTips = (optimizations?.visualPresenceTips || []).filter(Boolean)

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

  const hasCrossDiscrepancies =
    discrepancies.length > 0 || droppedImpact.length > 0 || missingSkills.length > 0 || missingSections.length > 0

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

      {/* ── 4. Resume-vs-LinkedIn Missing Sections & Discrepancy Alert ────── */}
      {hasCrossDiscrepancies && (
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
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                  Recruiter Screening Alert
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Differences between your verified resume and LinkedIn profile (e.g. omitted sections, title drift, timeline drift, or missing skills) are immediate friction points that recruiters notice in candidate screenings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {/* Missing Sections Cards */}
            {missingSections.map((sec, idx) => (
              <div
                key={sec.id || `missing_sec_${idx}`}
                className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-2.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    {sec.type === 'missing_certifications' ? (
                      <Certificate size={15} className="text-rose-600 dark:text-rose-400" />
                    ) : sec.type === 'missing_projects' ? (
                      <FolderSimple size={15} className="text-rose-600 dark:text-rose-400" />
                    ) : (
                      <WarningCircle size={15} className="text-rose-600 dark:text-rose-400" />
                    )}
                    {safeText(sec.title)}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                    Missing Section
                  </span>
                </div>

                <div className="space-y-1.5 bg-[var(--surface-card)] rounded-lg p-2.5 font-mono text-[11px] border border-[var(--border-default)]">
                  <div className="flex gap-2 text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)] shrink-0">Resume:</span>
                    <span className="truncate">{safeText(sec.resumeClaim)}</span>
                  </div>
                  <div className="flex gap-2 text-[var(--text-secondary)]">
                    <span className="font-semibold text-rose-600 dark:text-rose-400 shrink-0">LinkedIn:</span>
                    <span className="truncate text-rose-600 dark:text-rose-400 font-semibold">{safeText(sec.linkedinClaim)}</span>
                  </div>
                </div>

                {sec.diagnosis && (
                  <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(sec.diagnosis)}</p>
                )}
                {sec.recommendation && (
                  <p className="text-xs text-[var(--text-primary)] font-medium pt-1.5 border-t border-[var(--border-default)]">
                    <ArrowRight size={12} className="inline mr-1 text-[var(--primary)]" />
                    {safeText(sec.recommendation)}
                  </p>
                )}
              </div>
            ))}

            {/* Cross-Discrepancies Cards */}
            {discrepancies.map((disc, idx) => (
              <div
                key={disc.id || idx}
                className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-2.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    {disc.type === 'timeline_drift' ? (
                      <CalendarBlank size={15} className="text-[#0a66c2]" />
                    ) : disc.type === 'title_drift' ? (
                      <Briefcase size={15} className="text-[#0a66c2]" />
                    ) : (
                      <WarningCircle size={15} className="text-rose-600 dark:text-rose-400" />
                    )}
                    {safeText(disc.title)}
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    disc.severity === 'high'
                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                      : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}>
                    {safeText(disc.severity) || 'warning'}
                  </span>
                </div>

                <div className="space-y-1.5 bg-[var(--surface-card)] rounded-lg p-2.5 font-mono text-[11px] border border-[var(--border-default)]">
                  <div className="flex gap-2 text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)] shrink-0">Resume:</span>
                    <span className="truncate">{safeText(disc.resumeClaim)}</span>
                  </div>
                  <div className="flex gap-2 text-[var(--text-secondary)]">
                    <span className="font-semibold text-rose-600 dark:text-rose-400 shrink-0">LinkedIn:</span>
                    <span className="truncate text-rose-600 dark:text-rose-400 font-semibold">{safeText(disc.linkedinClaim)}</span>
                  </div>
                </div>

                {disc.diagnosis && (
                  <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(disc.diagnosis)}</p>
                )}
                {disc.recommendation && (
                  <p className="text-xs text-[var(--text-primary)] font-medium pt-1.5 border-t border-[var(--border-default)]">
                    <ArrowRight size={12} className="inline mr-1 text-[var(--primary)]" />
                    {safeText(disc.recommendation)}
                  </p>
                )}
              </div>
            ))}

            {droppedImpact.map((drop, idx) => (
              <div
                key={drop.id || idx}
                className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-2 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <TrendDown size={15} className="text-[#0a66c2]" />
                  Omitted Resume Achievement ({safeText(drop.company) || 'Experience'})
                </div>
                <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-2.5 text-emerald-700 dark:text-emerald-400 italic text-[11px]">
                  "{safeText(drop.sampleResumeProof)}"
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(drop.diagnosis)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. AI Optimization Suite ───────────────────────────────────────── */}
      {optimizations && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
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
                  <TextT size={14} className="text-sky-500" />
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
                      className="flex flex-col justify-between bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-4 shadow-xs hover:border-sky-500/50 hover:shadow-sm transition-all"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60">
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
                            : 'bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60'
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
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] p-5 sm:p-7 space-y-4 shadow-xs">
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
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#0a66c2]">
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
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
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
                    <Briefcase size={15} className="text-sky-500" />
                    High-Impact Experience Bullet Rewrites ({experienceUpgrades.length} Roles)
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Pre-engineered with hard metrics, action verbs, and verified technical scope from your resume.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full">
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
                          <span className="p-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
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
                                : 'bg-[var(--surface-card)] hover:bg-sky-50 dark:hover:bg-sky-950/50 text-[var(--text-primary)] border border-[var(--border-default)]'
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
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-200">
                          <WarningCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" weight="fill" />
                          <div>
                            <span className="font-bold">LinkedIn Gap / Critique: </span>
                            <span>{safeText(item.linkedinGap)}</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {bullets.map((b, bIdx) => {
                          const bText = typeof b === 'string' ? b : safeText(b)
                          const copyBulletKey = `bullet_${idx}_${bIdx}`
                          const isBulletCopied = copiedId === copyBulletKey

                          return (
                            <div
                              key={bIdx}
                              className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] leading-relaxed group"
                            >
                              <div className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" weight="fill" />
                                <span>{bText}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(bText, copyBulletKey)}
                                className={`shrink-0 p-1 rounded-md transition-colors ${
                                  isBulletCopied
                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
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
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                        isCopied
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'border-[var(--primary)]/25 bg-[var(--primary-light)] hover:bg-[var(--primary-light)]/80 text-[var(--text-primary)]'
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
                  <Tag size={14} className="text-sky-500" />
                  Missing Skills to Add ({recommendedSkills.length} Verified Resume Skills)
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-[var(--surface-sunken)] hover:bg-sky-50 dark:hover:bg-sky-950/60 text-[var(--text-primary)] border border-[var(--border-default)] hover:border-sky-300 dark:hover:border-sky-700'
                      }`}
                      title="Click to copy skill name"
                    >
                      {isCopied ? (
                        <Check size={13} weight="bold" />
                      ) : (
                        <Plus size={13} weight="bold" className="text-sky-600 dark:text-sky-400" />
                      )}
                      <span>{skillName}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Featured Work Recommendations ──────────────────────────────── */}
          {featuredWork.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Star size={16} weight="fill" className="text-amber-500" />
                  Featured Section Blueprint (Pin to Profile Top)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Projects that provide instant architectural credibility
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {featuredWork.map((proj, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2 text-xs flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <FolderSimple size={15} className="text-[#0a66c2]" />
                        {safeText(proj.title)}
                      </span>
                      <p className="text-[var(--text-secondary)] leading-relaxed">
                        {safeText(proj.reason)}
                      </p>
                    </div>
                    {proj.callToAction && (
                      <p className="text-[11px] text-[var(--primary)] font-medium pt-2 border-t border-[var(--border-default)]">
                        <ArrowRight size={11} className="inline mr-1" />
                        {safeText(proj.callToAction)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Sections to Add From Resume (Projects, Certifications, Featured) ── */}
          {sectionsToAdd && (sectionsToAdd.projects?.length > 0 || sectionsToAdd.certifications?.length > 0 || sectionsToAdd.featured?.length > 0) && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <FolderSimple size={15} className="text-emerald-500" />
                    Verified Resume Sections to Add to LinkedIn
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    These verified achievements from your resume were not found on your LinkedIn profile. Add them to rank higher for recruiter keyword searches.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Projects */}
                {Array.isArray(sectionsToAdd.projects) && sectionsToAdd.projects.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <FolderSimple size={14} className="text-sky-500" />
                      Projects Section ({sectionsToAdd.projects.length})
                    </span>
                    <div className="space-y-2.5">
                      {sectionsToAdd.projects.map((proj, pIdx) => {
                        const copyProjKey = `add_proj_${pIdx}`
                        const isCopied = copiedId === copyProjKey
                        const projText = `${safeText(proj.title)}\n${safeText(proj.description)}${proj.technologies?.length ? `\nSkills: ${proj.technologies.join(', ')}` : ''}`

                        return (
                          <div
                            key={pIdx}
                            className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2 text-xs flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-[var(--text-primary)]">{safeText(proj.title)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(projText, copyProjKey)}
                                  className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                                    isCopied ? 'bg-emerald-600 text-white' : 'bg-[var(--surface-card)] text-sky-600 dark:text-sky-400 border border-[var(--border-default)]'
                                  }`}
                                >
                                  {isCopied ? <Check size={11} weight="bold" /> : <Copy size={11} />}
                                  {isCopied ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(proj.description)}</p>
                              {proj.replaceNote && (
                                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-800 dark:text-sky-300 mt-1.5">
                                  <ArrowRight size={13} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                                  <span><strong className="font-semibold">Action: </strong>{safeText(proj.replaceNote)}</span>
                                </div>
                              )}
                            </div>
                            {Array.isArray(proj.technologies) && proj.technologies.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {proj.technologies.map((t, tIdx) => (
                                  <span key={tIdx} className="text-[10px] px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
                                    {safeText(t)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {Array.isArray(sectionsToAdd.certifications) && sectionsToAdd.certifications.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Certificate size={14} className="text-amber-500" />
                      Licenses & Certifications ({sectionsToAdd.certifications.length})
                    </span>
                    <div className="space-y-2.5">
                      {sectionsToAdd.certifications.map((cert, cIdx) => {
                        const copyCertKey = `add_cert_${cIdx}`
                        const isCopied = copiedId === copyCertKey
                        const certText = `${safeText(cert.name)} - ${safeText(cert.issuer || cert.authority)}${cert.date ? ` (${safeText(cert.date)})` : ''}`

                        return (
                          <div
                            key={cIdx}
                            className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-1.5 text-xs flex items-center justify-between gap-3"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-[var(--text-primary)]">{safeText(cert.name)}</span>
                              <p className="text-[var(--text-secondary)]">
                                {safeText(cert.issuer || cert.authority)} {cert.date ? `· ${safeText(cert.date)}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(certText, copyCertKey)}
                              className={`shrink-0 text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                                isCopied ? 'bg-emerald-600 text-white' : 'bg-[var(--surface-card)] text-amber-700 dark:text-amber-400 border border-[var(--border-default)]'
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
            </div>
          )}

          {/* ── Recruiter Visibility & Search Ranking Playbook ─────────────────── */}
          {visibilityTricks.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Globe size={15} className="text-sky-500" />
                    Recruiter Visibility & Search Ranking Playbook
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Specific settings and search algorithm triggers that boost your profile to the top 5% of candidate queries.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibilityTricks.map((trick, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2.5 text-xs flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--text-primary)]">{safeText(trick.trick || trick.category)}</span>
                        {trick.category && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                            {safeText(trick.category)}
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--text-secondary)] leading-relaxed">{safeText(trick.advice)}</p>
                    </div>

                    {Array.isArray(trick.items) && trick.items.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[var(--border-default)]">
                        {trick.items.map((it, itIdx) => {
                          const itemText = safeText(it)
                          const copyTrickKey = `trick_${idx}_${itIdx}`
                          const isCopied = copiedId === copyTrickKey

                          return (
                            <button
                              key={itIdx}
                              type="button"
                              onClick={() => handleCopy(itemText, copyTrickKey)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[var(--surface-card)] hover:bg-sky-50 dark:hover:bg-sky-950/60 text-[var(--text-primary)] border border-[var(--border-default)]'
                              }`}
                              title="Click to copy"
                            >
                              {isCopied ? <Check size={11} weight="bold" /> : <Copy size={11} className="opacity-60" />}
                              <span>{itemText}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 6. Profile Fixes & Recommendations ─────────────────────────────── */}
      {issues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <WarningCircle size={15} className="text-amber-500" /> Profile Fixes & Recommendations ({issues.length})
          </h3>
          {issues.map((iss, i) => (
            <div
              key={iss.id || i}
              className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-2.5 shadow-xs"
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
                <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--primary-light)] border border-[var(--border-default)] rounded-xl p-3.5">
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
