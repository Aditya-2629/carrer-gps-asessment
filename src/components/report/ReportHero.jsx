import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Compass,
  Briefcase,
  IdentificationCard,
  Calendar,
  Sparkle,
  Warning,
  TrendUp,
  Robot,
} from '@phosphor-icons/react'

const CIRCUMFERENCE = 2 * Math.PI * 46 // r=46 -> 289

function getScoreColor(score) {
  if (score >= 75) return 'var(--emerald)'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function getScoreBadgeClass(score) {
  if (score >= 75) return 'bg-emerald-500/15 text-[var(--emerald)] border-emerald-500/30'
  if (score >= 50) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
  return 'bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30'
}

import useAppStore from '../../store/useAppStore'
import { decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'

export default function ReportHero({ reportData }) {
  const storeResumeAnalysis = useAppStore((s) => s.resumeAnalysis)
  const formData = useAppStore((s) => s.formData)
  const email = useAppStore((s) => s.email)

  const candidate = reportData?.resume_json || storeResumeAnalysis?.data?.canonicalResume || {}
  const resumeAgent = reportData?.resume_agent || storeResumeAnalysis?.data?.analysis || {}

  const rawName =
    resumeAgent?.candidateSnapshot?.name ||
    candidate?.candidate?.name ||
    candidate?.candidate_name ||
    candidate?.name ||
    reportData?.candidate_name ||
    formData?.name ||
    formData?.fullName ||
    storeResumeAnalysis?.data?.analysis?.candidateSnapshot?.name ||
    storeResumeAnalysis?.data?.canonicalResume?.candidate?.name ||
    (email ? email.split('@')[0] : '')

  const firstName = decodeHtmlEntities((typeof rawName === 'string' && rawName.trim())
    ? rawName.trim().split(' ')[0]
    : '')

  const targetRole = decodeHtmlEntities(
    resumeAgent?.candidateSnapshot?.targetRole ||
    candidate?.candidate?.targetRole ||
    candidate?.target_role ||
    reportData?.target_role ||
    formData?.targetRole ||
    formData?.target_role ||
    formData?.desiredRole ||
    formData?.role ||
    storeResumeAnalysis?.data?.analysis?.candidateSnapshot?.targetRole ||
    storeResumeAnalysis?.data?.canonicalResume?.candidate?.targetRole ||
    ''
  )

  const visaStatus = decodeHtmlEntities(
    candidate?.candidate?.visaStatus ||
    candidate?.visa_status ||
    reportData?.visa_status ||
    formData?.visaStatus ||
    formData?.visa_status ||
    formData?.workAuthorization ||
    formData?.work_authorization ||
    ''
  )

  const presentRole = decodeHtmlEntities(
    resumeAgent?.candidateSnapshot?.presentRole ||
    candidate?.candidate?.presentRole ||
    storeResumeAnalysis?.data?.analysis?.candidateSnapshot?.presentRole ||
    storeResumeAnalysis?.data?.canonicalResume?.candidate?.presentRole ||
    ''
  )

  const presentCompany = decodeHtmlEntities(
    resumeAgent?.candidateSnapshot?.presentCompany ||
    candidate?.candidate?.presentCompany ||
    storeResumeAnalysis?.data?.analysis?.candidateSnapshot?.presentCompany ||
    storeResumeAnalysis?.data?.canonicalResume?.candidate?.presentCompany ||
    ''
  )

  const rawPastRoles =
    resumeAgent?.candidateSnapshot?.pastRoles ||
    candidate?.candidate?.pastRoles ||
    storeResumeAnalysis?.data?.analysis?.candidateSnapshot?.pastRoles ||
    storeResumeAnalysis?.data?.canonicalResume?.candidate?.pastRoles ||
    []

  const pastRoles = Array.isArray(rawPastRoles)
    ? rawPastRoles.map((pr) => ({
        ...pr,
        role: decodeHtmlEntities(pr.role || ''),
        company: decodeHtmlEntities(pr.company || ''),
      }))
    : []

  const rawSkills = Array.isArray(candidate?.top_skills) && candidate.top_skills.length > 0
    ? candidate.top_skills
    : Array.isArray(candidate?.skills) && candidate.skills.length > 0
    ? candidate.skills
    : Array.isArray(resumeAgent?.canonicalResume?.skills) && resumeAgent.canonicalResume.skills.length > 0
    ? resumeAgent.canonicalResume.skills
    : []

  const skillsList = rawSkills.map((s) => {
    if (typeof s === 'string') return decodeHtmlEntities(s)
    if (typeof s === 'object' && s) return decodeHtmlEntities(s.name || s.skill || '')
    return decodeHtmlEntities(String(s || ''))
  }).filter(Boolean)

  const healthScore = Math.max(
    0,
    Number(
      reportData?.career_health_score ??
      resumeAgent?.dashboard?.score ??
      reportData?.score ??
      0
    ) || 45
  )

  const scoreLabel =
    typeof reportData?.score_label === 'string'
      ? reportData.score_label
      : resumeAgent?.dashboard?.gradeLabel || (healthScore >= 75 ? 'Strong' : healthScore >= 50 ? 'Developing' : 'Emerging')

  const reportDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Animated circular score counter
  const [displayedScore, setDisplayedScore] = useState(0)
  useEffect(() => {
    let start = 0
    const end = Math.min(100, Math.max(1, healthScore))
    const stepTime = Math.max(10, Math.floor(1200 / end))
    const timer = setInterval(() => {
      start += 1
      setDisplayedScore(start)
      if (start >= end) clearInterval(timer)
    }, stepTime)
    return () => clearInterval(timer)
  }, [healthScore])

  const strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(100, displayedScore)) / 100
  const scoreColor = getScoreColor(healthScore)

  // One-line diagnosis synthesis
  const rawStrength =
    resumeAgent?.strengths?.[0] ||
    reportData?.strengths?.[0] ||
    candidate?.strengths?.[0]

  const advantageText =
    typeof rawStrength === 'string'
      ? rawStrength
      : rawStrength?.title
      ? rawStrength.title
      : rawStrength?.description || rawStrength?.signal || 'verified engineering delivery'

  const cleanAdvantage = decodeHtmlEntities(String(advantageText || '').replace(/\.+$/, '').trim())
  const cleanCompany = decodeHtmlEntities(String(presentCompany || pastRoles[0]?.company || '').replace(/\.+$/, '').trim())

  const primaryIssue =
    reportData?.primary_bottleneck ||
    reportData?.critical_issues?.[0] ||
    resumeAgent?.issues?.[0] ||
    reportData?.issues?.[0]

  let rawBottleneck =
    typeof primaryIssue === 'string'
      ? primaryIssue
      : primaryIssue?.title || primaryIssue?.diagnosis || null

  const answers = reportData?.user_answers || reportData?.answers || formData || {}
  const hasValidLinkedin = Boolean(
    (answers.linkedin && typeof answers.linkedin === 'string' && answers.linkedin.trim().length > 3) ||
    (answers.linkedinUrl && typeof answers.linkedinUrl === 'string' && answers.linkedinUrl.trim().length > 3) ||
    (answers['linkedin-url'] && typeof answers['linkedin-url'] === 'string' && answers['linkedin-url'].trim().length > 3) ||
    (typeof answers.contact?.linkedin === 'string' && answers.contact.linkedin.trim().length > 3) ||
    (reportData?.linkedin_json && Object.keys(reportData.linkedin_json).length > 0) ||
    (reportData?.linkedin_agent?.dataAvailable === true) ||
    (reportData?.linkedin_agent?.inferredFromResume === true)
  )
  const isPhase3Or4 = Number(reportData?.phase?.id) >= 3 || /technical|final|offer/i.test(reportData?.phase?.name || reportData?.phase?.shortName || '')

  if ((hasValidLinkedin || isPhase3Or4) && /blank linkedin|blank profile|completely blank linkedin/i.test(String(rawBottleneck || ''))) {
    rawBottleneck = isPhase3Or4
      ? 'Technical Case-Study Depth & Architectural Tradeoff Articulation'
      : 'Top-of-Page ATS Keyword Alignment & Metric Gaps'
  }

  const cleanBottleneck = decodeHtmlEntities(String(rawBottleneck || 'Application & Targeting Alignment').replace(/\.+$/, '').trim())

  // Detection of corporate experience extraction gaps (e.g. PwC, Shure listed without bullets)
  const experiences = candidate?.experiences || candidate?.experience || resumeAgent?.canonicalResume?.experiences || []
  const totalWorkBullets = experiences.reduce(
    (sum, exp) => sum + (Array.isArray(exp.bullets) ? exp.bullets.length : (exp.bullet ? 1 : 0)),
    0
  )
  const missingCompanyNames = experiences
    .map((e) => e.company || e.role)
    .filter(Boolean)
    .slice(0, 3)
  const formattedCompanyNames = missingCompanyNames.length > 0 ? missingCompanyNames.join(' and ') : 'corporate'
  const hasExtractedExperienceGaps = experiences.length > 0 && totalWorkBullets === 0

  return (
    <section id="overview" className="relative pt-2 pb-6 print:pt-0 print:pb-2">
      {/* Soft Ambient Glow */}
      <div className="absolute -top-12 -left-12 w-80 h-80 bg-[var(--primary)]/5 rounded-full blur-3xl pointer-events-none print:hidden" />
      <div className="absolute top-10 right-0 w-80 h-80 bg-[var(--emerald)]/5 rounded-full blur-3xl pointer-events-none print:hidden" />

      {/* Main Hero Card Container (Page 1) */}
      <div className="rounded-3xl p-6 sm:p-9 print:p-5 bg-[var(--surface-card)] border border-[var(--border-default)] shadow-sm relative overflow-hidden print:border-none print:shadow-none break-inside-avoid page-break-inside-avoid">
        {/* Top Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 print:pb-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] border border-[var(--primary)]/25 flex items-center justify-center text-[var(--primary)]">
              <Compass size={18} weight="fill" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block font-mono">
                AI Career Intelligence
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Crafture Career GPS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)] flex items-center gap-1.5">
              <Calendar size={13} className="text-[var(--text-muted)]" />
              <span>{reportDate}</span>
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--emerald-bg)] border border-emerald-500/20 text-[var(--emerald)]">
              Confidential Analysis
            </span>
          </div>
        </div>

        {/* Hero Body Grid: Greeting + Diagnosis on Left, Circular Score on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 print:grid-cols-12 gap-8 print:gap-4 items-center pt-6 print:pt-3 break-inside-avoid page-break-inside-avoid">
          {/* Left Column: Personalized Greeting & Narrative */}
          <div className="lg:col-span-8 print:col-span-8 space-y-4 print:space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold text-[var(--primary)] border border-[var(--primary)]/20">
              <Robot size={15} weight="fill" />
              <span>Personal Career Coach Report</span>
            </div>

            <div className="space-y-2">
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.15]"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                {firstName ? `${firstName}, here's where your ` : `Here's where your `}
                <span className="text-[var(--primary)]">job search stands.</span>
              </h1>

              {/* Target, Present & Past Roles, Visa Badges */}
              {(targetRole || presentRole || pastRoles.length > 0 || visaStatus) && (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {targetRole && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)]">
                      <Briefcase size={14} className="text-[var(--primary)]" weight="bold" />
                      <span>Target: {targetRole}</span>
                    </span>
                  )}
                  {presentRole && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Briefcase size={14} weight="bold" />
                      <span>Current: {presentRole}{cleanCompany ? ` @ ${cleanCompany}` : ''}</span>
                    </span>
                  )}
                  {pastRoles.length > 0 && pastRoles[0]?.role && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                      <span>Prev: {pastRoles[0].role}{pastRoles[0].company ? ` @ ${pastRoles[0].company}` : ''}</span>
                    </span>
                  )}
                  {visaStatus && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <IdentificationCard size={14} weight="bold" />
                      <span>{visaStatus}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Coach One-Line Key Diagnosis Card */}
            {(cleanAdvantage || cleanBottleneck || hasExtractedExperienceGaps) && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2.5 break-inside-avoid page-break-inside-avoid">
                <div className="text-xs uppercase tracking-wider font-mono font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                  <Sparkle size={14} weight="fill" className="text-[var(--emerald)]" />
                  <span>Coach Executive Diagnosis</span>
                </div>
                <p className="text-base sm:text-lg leading-relaxed text-[var(--text-primary)] font-medium">
                  {hasExtractedExperienceGaps ? (
                    <>
                      &ldquo;Your primary bottleneck right now is that your{' '}
                      <strong className="text-red-500 dark:text-red-400 font-bold">
                        {formattedCompanyNames} work bullets failed ATS extraction due to non-standard layout formatting
                      </strong>
                      {' '}— convert to standard single-column reverse-chronological format to restore recruiter visibility.&rdquo;
                    </>
                  ) : (
                    <>
                      &ldquo;Your strongest advantage is your proven track record of{' '}
                      <strong className="text-[var(--emerald)] font-bold">{cleanAdvantage}</strong>
                      {cleanCompany ? ` at ${cleanCompany}` : ''}. Your primary bottleneck right now is{' '}
                      <strong className="text-red-500 dark:text-red-400 font-bold">
                        {cleanBottleneck}
                      </strong>
                      .&rdquo;
                    </>
                  )}
                </p>

                {/* Hidden Gem #1: 6-Second Human Recruiter Scan Verdict */}
                {(() => {
                  const concreteTechSkills = (skillsList || [])
                    .map(decodeHtmlEntities)
                    .filter((s) => {
                      if (!s || typeof s !== 'string') return false
                      const trimmed = s.trim()
                      if (trimmed.length > 25 || trimmed.split(/\s+/).length > 2) return false
                      if (/analysis|methodology|collaboration|management|waterfall|agile|scrum|leadership|communication|problem solving|process automation/i.test(trimmed)) return false
                      return true
                    })
                  const topTwoSkills = concreteTechSkills.length >= 2
                    ? concreteTechSkills.slice(0, 2).join(' and ')
                    : (skillsList.slice(0, 2).map(decodeHtmlEntities).join(' and ') || 'SQL and Python')

                  return (
                    <div className="mt-3 pt-3 border-t border-[var(--border-default)] text-xs text-[var(--text-secondary)] flex items-start gap-2 bg-[var(--surface-card)] p-3 rounded-xl">
                      <span className="text-amber-500 font-bold shrink-0">⏱️ 6-Second Recruiter Verdict:</span>
                      <span>
                        A recruiter scanning your profile immediately anchors on {presentCompany ? `your work at ${presentCompany}` : 'your recent experience'}, verified delivery in {topTwoSkills}; however, recruiter conversion risks stalling due to {hasExtractedExperienceGaps ? 'missing extracted bullets under verified employer roles' : (reportData?.linkedin_agent?.discrepancies?.[0]?.title ? String(reportData.linkedin_agent.discrepancies[0].title).toLowerCase() : 'missing keyword alignment with target boolean searches')}.
                      </span>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Right Column: Circular Progress Visualization */}
          <div className="lg:col-span-4 print:col-span-4 flex flex-col items-center justify-center p-6 print:p-3 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-center relative break-inside-avoid">
            <div className="relative w-44 h-44 print:w-32 print:h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
                {/* Background Ring Track */}
                <circle
                  cx="55"
                  cy="55"
                  r="46"
                  stroke="var(--border-default)"
                  strokeWidth="8"
                  fill="transparent"
                  className="opacity-70"
                />
                {/* Foreground Animated Ring */}
                <circle
                  cx="55"
                  cy="55"
                  r="46"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{
                    transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </svg>

              {/* Inside Score Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-5xl print:text-4xl font-black text-[var(--text-primary)] tabular-nums tracking-tight"
                  style={{ fontFamily: 'var(--font-head)' }}
                >
                  {displayedScore}
                </span>
                <span className="text-xs font-mono font-bold text-[var(--text-muted)] mt-0.5">
                  / 100
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <span className="text-xs font-mono uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                Career GPS Score
              </span>
              <span
                className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getScoreBadgeClass(
                  healthScore
                )}`}
              >
                {scoreLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Executive GPS Diagnostic Summary (Enclosed to start cleanly on Page 2) */}
      <div className="mt-6 p-6 print:p-4 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] print:border-none shadow-sm break-before-page page-break-before-always break-inside-avoid page-break-inside-avoid print:mt-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)]">
            Executive GPS Diagnostic Summary
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Current Phase */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] break-inside-avoid page-break-inside-avoid">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
              Current Phase
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                Phase {reportData?.phase?.id ?? 1}: {reportData?.phase?.shortName || reportData?.phase?.name || 'Top of Funnel'}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${reportData?.phase?.isProvisional ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                {reportData?.phase?.isProvisional ? 'Provisional' : (reportData?.phase?.confidence || 'High')}
              </span>
            </div>
          </div>

          {/* Primary Problem */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] break-inside-avoid page-break-inside-avoid">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block mb-1">
              Primary Root Cause
            </span>
            <p
              className="text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-2"
              title={cleanBottleneck}
            >
              {cleanBottleneck}
            </p>
          </div>

          {/* Secondary Problem */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] break-inside-avoid page-break-inside-avoid">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block mb-1">
              Secondary Root Cause
            </span>
            <p
              className="text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-2"
              title={reportData?.secondary_problem?.title || 'Over-reliance on Easy Apply job boards'}
            >
              {reportData?.secondary_problem?.title || 'Over-reliance on Easy Apply job boards'}
            </p>
          </div>

          {/* Strongest Area */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] break-inside-avoid page-break-inside-avoid">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block mb-1">
              Strongest Area
            </span>
            <p className="text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-2">
              {reportData?.strongest_area || 'Resume / Documents (18/25)'}
            </p>
          </div>

          {/* Next Best Action */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] break-inside-avoid page-break-inside-avoid">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] block mb-1">
              Next Best Action
            </span>
            <p
              className="text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-2"
              title={reportData?.next_best_action || 'Rewrite top 5 resume achievement bullets with hard numbers'}
            >
              {reportData?.next_best_action || 'Rewrite top 5 resume achievement bullets with hard numbers'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
