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
  high: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/80 dark:border-red-700/60 dark:text-red-300',
  medium: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/80 dark:border-amber-700/60 dark:text-amber-300',
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
  const discrepancies = (linkedinAgent.discrepancies || []).filter(Boolean)
  const droppedImpact = (linkedinAgent.droppedImpact || []).filter(Boolean)
  const missingSkills = (linkedinAgent.missingSkills || []).filter(Boolean)
  const missingSections = (linkedinAgent.missingSections || []).filter(Boolean)
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

      {/* ── 2. Visual Presence Status Indicators (Photo & Custom Banner) ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile Headshot Card */}
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Camera size={16} className="text-[#0a66c2]" />
              Profile Photo Audit
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                hasPhoto
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
              }`}
            >
              {hasPhoto ? 'Photo Active' : 'Missing (21x View Penalty)'}
            </span>
          </div>

          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                hasPhoto
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
              }`}
            >
              {hasPhoto ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} weight="fill" />}
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-[var(--text-primary)]">
                {hasPhoto ? 'Headshot Detected & Active' : 'High Priority: Upload Professional Headshot'}
              </h4>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {hasPhoto
                  ? 'Your profile features a public photo. High-contrast headshots receive significantly higher click-through in recruiter search results.'
                  : 'Profiles with a professional photo receive up to 21x more views and 36x more messages. A blank avatar suppresses recruiter outreach immediately.'}
              </p>
            </div>
          </div>
        </div>

        {/* Custom Cover Banner Card */}
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Image size={16} className="text-[#0a66c2]" />
              Cover Banner Audit
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                hasBanner
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              {hasBanner ? 'Custom Banner Active' : 'Default Gray Banner'}
            </span>
          </div>

          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                hasBanner
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
              }`}
            >
              {hasBanner ? <CheckCircle size={24} weight="fill" /> : <Palette size={24} weight="fill" />}
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-[var(--text-primary)]">
                {hasBanner ? 'Custom Cover Image Active' : 'Unbranded Visual Real Estate'}
              </h4>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {hasBanner
                  ? 'Custom background banner is configured, establishing visual branding above the fold.'
                  : 'Your profile still displays the default gray geometric banner. Use the Canva blueprint below to build an All-Star branded cover.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Canva Banner Blueprint & Visual Canvas Preview (One-Click Copy) ── */}
      {bannerStrategy && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 rounded-lg bg-[#0a66c2]/10 text-[#0a66c2] dark:text-sky-400">
                  <Palette size={18} weight="duotone" />
                </span>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Canva Banner Blueprint & Live Preview
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300/80 dark:border-sky-800/60 font-semibold">
                  1584 × 396 px
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Copy this pre-engineered copy directly into Canva for your custom LinkedIn background cover.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                handleCopy(
                  `${safeText(bannerStrategy.bannerTagline)}\n${safeText(bannerStrategy.bannerSecondaryText)}`,
                  'canva_banner'
                )
              }
              className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                copiedId === 'canva_banner'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0a66c2] hover:bg-[#004182] text-white'
              }`}
            >
              {copiedId === 'canva_banner' ? (
                <>
                  <Check size={14} weight="bold" /> Copied Banner Text!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy Banner Text
                </>
              )}
            </button>
          </div>

          {/* Visual Banner Canvas Mockup (4:1 Aspect Ratio Preview with Guaranteed White Contrast) */}
          <div className="relative w-full rounded-xl overflow-hidden shadow-md border border-slate-700/60 bg-gradient-to-r from-[#0b1728] via-[#0f2444] to-[#1e1b4b] p-5 sm:p-7 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] text-white">
            <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

            <div className="relative z-10 flex justify-end">
              <span className="text-[10px] uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-sky-200 border border-white/15 backdrop-blur-xs">
                LinkedIn Cover Canvas (1584 × 396)
              </span>
            </div>

            <div className="relative z-10 sm:pl-28 md:pl-36 space-y-1.5 py-2">
              <p className="text-sm sm:text-lg md:text-xl font-extrabold text-white tracking-tight leading-snug drop-shadow-sm">
                {safeText(bannerStrategy.bannerTagline)}
              </p>
              <p className="text-xs sm:text-sm font-medium text-sky-200 drop-shadow-xs">
                {safeText(bannerStrategy.bannerSecondaryText)}
              </p>
            </div>

            <div className="absolute -bottom-5 left-4 sm:left-6 w-14 sm:w-16 h-14 sm:h-16 rounded-full border-2 border-white/30 bg-slate-850/90 backdrop-blur-xs flex items-center justify-center text-[9px] text-slate-300 font-medium text-center leading-tight shadow-md">
              Avatar<br/>Zone
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                Primary Banner Tagline
              </span>
              <p className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                {safeText(bannerStrategy.bannerTagline)}
              </p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 block pt-1">
                Secondary Subtitle / Core Stack
              </span>
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                {safeText(bannerStrategy.bannerSecondaryText)}
              </p>
            </div>

            <div className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                  <Lightbulb size={12} weight="fill" /> Canva Design & Layout Advice
                </span>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-1.5">
                  {safeText(bannerStrategy.designAdvice)}
                </p>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] italic pt-2 border-t border-[var(--border-default)]">
                Tip: Leave the lower-left 30% area clear of text to prevent mobile avatar overlap.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Resume-vs-LinkedIn Missing Sections & Discrepancy Alert ────── */}
      {hasCrossDiscrepancies && (
        <div className="rounded-2xl border border-amber-300/90 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-700/60 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <span className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <ShieldWarning size={24} weight="duotone" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  Missing Sections & Cross-Platform Discrepancies
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 dark:bg-amber-900/70 dark:text-amber-200">
                  Recruiter Screening Alert
                </span>
              </div>
              <p className="text-xs text-amber-900/85 dark:text-amber-300/90 leading-relaxed">
                Differences between your verified resume and LinkedIn profile (e.g. omitted sections, title drift, timeline drift, or missing skills) are immediate friction points that recruiters notice in candidate screenings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {/* Missing Sections Cards */}
            {missingSections.map((sec, idx) => (
              <div
                key={sec.id || `missing_sec_${idx}`}
                className="bg-white/95 dark:bg-[#0c1425] border border-red-200/90 dark:border-red-900/60 rounded-xl p-4 space-y-2.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    {sec.type === 'missing_certifications' ? (
                      <Certificate size={15} className="text-red-600 dark:text-red-400" />
                    ) : sec.type === 'missing_projects' ? (
                      <FolderSimple size={15} className="text-red-600 dark:text-red-400" />
                    ) : (
                      <WarningCircle size={15} className="text-red-600 dark:text-red-400" />
                    )}
                    {safeText(sec.title)}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-100 text-red-900 dark:bg-red-900/70 dark:text-red-200">
                    Missing Section
                  </span>
                </div>

                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/70 rounded-lg p-2.5 font-mono text-[11px] border border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex gap-2 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">Resume:</span>
                    <span className="truncate">{safeText(sec.resumeClaim)}</span>
                  </div>
                  <div className="flex gap-2 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">LinkedIn:</span>
                    <span className="truncate text-red-700 dark:text-red-300 font-semibold">{safeText(sec.linkedinClaim)}</span>
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
                className="bg-white/95 dark:bg-[#0c1425] border border-amber-200/90 dark:border-amber-800/60 rounded-xl p-4 space-y-2.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    {disc.type === 'timeline_drift' ? (
                      <CalendarBlank size={15} className="text-amber-600 dark:text-amber-400" />
                    ) : disc.type === 'title_drift' ? (
                      <Briefcase size={15} className="text-amber-600 dark:text-amber-400" />
                    ) : (
                      <WarningCircle size={15} className="text-amber-600 dark:text-amber-400" />
                    )}
                    {safeText(disc.title)}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/70 dark:text-amber-200">
                    {safeText(disc.severity) || 'warning'}
                  </span>
                </div>

                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/70 rounded-lg p-2.5 font-mono text-[11px] border border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex gap-2 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">Resume:</span>
                    <span className="truncate">{safeText(disc.resumeClaim)}</span>
                  </div>
                  <div className="flex gap-2 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">LinkedIn:</span>
                    <span className="truncate text-amber-700 dark:text-amber-300 font-semibold">{safeText(disc.linkedinClaim)}</span>
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
                className="bg-white/95 dark:bg-[#0c1425] border border-amber-200/90 dark:border-amber-800/60 rounded-xl p-4 space-y-2 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <TrendDown size={15} className="text-amber-600 dark:text-amber-400" />
                  Omitted Resume Achievement ({safeText(drop.company) || 'Experience'})
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 rounded-lg p-2.5 text-emerald-950 dark:text-emerald-200 italic text-[11px]">
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

          {/* Story-Driven About Section Card (Obsidian Theme) */}
          {rawAbout && (
            <div className="rounded-2xl border border-slate-800 bg-[#0c1322] dark:bg-[#070b14] text-slate-100 p-5 sm:p-7 space-y-4 shadow-lg relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Story-Driven About Section Rewrite
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      {aboutWordCount} words · {aboutCharCount} chars (limit: 2,600)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Engineered for modern recruiter scan habits: The Hook → Quantified Proof → Next Role Call-to-Connect
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(fullAboutText, 'about_rewrite')}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    copiedId === 'about_rewrite'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
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

              <div className="space-y-4 bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 text-xs text-slate-200 leading-relaxed">
                {aboutIsString ? (
                  <p className="text-slate-100 whitespace-pre-wrap">{rawAbout}</p>
                ) : (
                  <>
                    {hookText && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">
                          Paragraph 1: The Hook (Technical Identity & Domain)
                        </span>
                        <p className="text-slate-100 font-medium whitespace-pre-wrap">
                          {hookText}
                        </p>
                      </div>
                    )}
                    {proofText && (
                      <div className="space-y-1 pt-2 border-t border-slate-800/70">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                          Paragraph 2: Quantified Proof & Architecture Scale
                        </span>
                        <p className="text-slate-300 whitespace-pre-wrap">
                          {proofText}
                        </p>
                      </div>
                    )}
                    {ctaText && (
                      <div className="space-y-1 pt-2 border-t border-slate-800/70">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400">
                          Paragraph 3: Next Role Focus & Call to Connect
                        </span>
                        <p className="text-slate-200 italic whitespace-pre-wrap">
                          {ctaText}
                        </p>
                      </div>
                    )}
                    {!hookText && !proofText && !ctaText && fallbackFullText && (
                      <p className="text-slate-100 whitespace-pre-wrap">
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
            <div className="bg-[var(--surface-card)] border border-amber-300/80 dark:border-amber-800/60 rounded-2xl p-5 space-y-3.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <PushPin size={16} weight="fill" className="text-amber-500" />
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
                          : 'bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100/70 border-amber-200 dark:border-amber-800/70 text-[var(--text-primary)]'
                      }`}
                      title="Click to copy pinned skill"
                    >
                      <div className="flex items-center gap-2">
                        <PushPin size={14} weight="fill" className={isCopied ? 'text-white' : 'text-amber-600 dark:text-amber-400'} />
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

          {/* ── Visual Presence Tips ───────────────────────────────────────── */}
          {visualPresenceTips.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3 shadow-xs">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={15} className="text-sky-500" />
                Visual Presence & Discoverability Tips
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {visualPresenceTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2"
                  >
                    <span className="text-[var(--primary)] font-bold shrink-0">#{idx + 1}</span>
                    <span>{safeText(tip)}</span>
                  </div>
                ))}
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
