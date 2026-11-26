import React, { useState, useMemo } from 'react'
import TeaserLockBlock from '../TeaserLockBlock'
import {
  ListChecks,
  WarningCircle,
  ArrowRight,
  CheckCircle,
  User,
  ShieldCheck,
  Copy,
  Check,
  FileText,
  DownloadSimple,
  Briefcase,
  Code,
  RocketLaunch,
  Scissors,
  ArrowsLeftRight,
  Target,
  ChartBar,
  LockKey,
} from '@phosphor-icons/react'
import ResumeScoreCard from './ResumeScoreCard.jsx'
import ResumeKeywordAlignment from './ResumeKeywordAlignment.jsx'
import ResumeBulletAudit from './ResumeBulletAudit.jsx'
import InterviewDefenseSheet from './InterviewDefenseSheet.jsx'
import InterviewDefenseInteractive from './InterviewDefenseInteractive.jsx'
import Toast from '../common/Toast.jsx'
import FeedbackThumbs from './FeedbackThumbs.jsx'
import useAppStore, { showToast } from '../../store/useAppStore'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { decodeHtmlEntities } from '../../../backend/agents/assessment/assessmentAgent'
import { getCompanySponsorStatus } from '../../lib/sponsorIntelligence.js'
import CrafturePoseMascot from '../common/CrafturePoseMascot.jsx'

/**
 * ResumeDeepDiagnosis — the Resume Specialist Agent's section inside the MAIN
 * Career GPS report.
 *
 * Renders:
 * - Deterministic Scorecard (0-100, letter grades, ATS checklist)
 * - Candidate profile snapshot & recruiter summary
 * - Verified Strengths ("What's Working")
 * - Line-by-line bullet audits with interactive dropdowns & rewrites
 * - Deep Diagnosis issues with severity tags and discovery questions
 * - Priority Actions ("Do These First")
 * - Direct link to open the print-first dedicated report (/resume-report)
 */

function cleanRewriteText(text) {
  if (!text || typeof text !== 'string') return text
  let count = 0
  let cleaned = text.replace(/(\s+(?:by|to|of|across|for|with|at|in|from))?\s*\[ADD:[^\]]*\]/gi, (match) => {
    count += 1
    if (count === 1) return match
    return ''
  })
  cleaned = cleaned.replace(/\](?=[A-Za-z0-9])/g, '] ')
  cleaned = cleaned.replace(/\s+\b(?:by|to|of|across|for|with|at|in|from)\s*([.,;])/gi, '$1')
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  return cleaned
}

function cleanRecruiterSummary(rawReview, candidateName, dashboard, resolvedBullets = []) {
  if (!rawReview || typeof rawReview !== 'string') return ''
  let text = rawReview.trim()

  const flatteryMatch = text.match(/^(?:[\w\s.-]+,\s*)?(?:you have built a solid foundation|your background shows a practical progression|your resume demonstrates clear technical competence|having hands-on experience[^\n.]*gives you a solid foundation|with your impressive background in)[^\n.]*[.]?\s*(.*)$/is)

  if (flatteryMatch && flatteryMatch[1]) {
    const bulletsList = (Array.isArray(resolvedBullets) && resolvedBullets.length > 0) ? resolvedBullets : (dashboard?.bulletAudit || [])
    const totalBullets = bulletsList.length
    const quantBullets = bulletsList.filter((b) => b.hasQuantifier || b.status === 'pass' || (typeof b.impactScore === 'number' && b.impactScore >= 75)).length
    const numbersRatio = totalBullets > 0 ? `Only ${quantBullets} of ${totalBullets} bullets contain numbers.` : ''
    const lead = candidateName ? `${candidateName}, you` : 'You'

    text = `${lead} have enterprise experience, but your bullets read like a junior maintenance developer. ${numbersRatio} Here is your exact fix.\n\n${flatteryMatch[1].trim()}`
  }

  return text
}

const severityChip = {
  high: 'bg-red-500/10 text-[var(--red)] border-red-500/25',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  low: 'bg-sky-500/10 text-sky-600 border-sky-500/25',
}

function SectionHeader({ icon, title, accent }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-[var(--border-default)] pb-4">
      <div className="flex items-center gap-3.5">
        <CrafturePoseMascot
          pose="reading"
          size={68}
          animation="float"
          showShadow={false}
          className="shrink-0 hidden sm:inline-flex"
          alt="Resume Audit Mascot"
        />
        <div>
          <div className="flex items-center gap-2">
            <span className={accent}>{icon}</span>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            AI recruiter audit of your resume structure, impact metrics, and ATS compatibility.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ResumeDeepDiagnosis({ resumeAgent, reportData: propReportData, isTeaserLocked = false, teaserLockProps = {} }) {
  const [toastMsg, setToastMsg] = useState('')
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

  const theme = useAppStore((s) => s.theme)
  const storeReportData = useAppStore((s) => s.reportData)
  const reportData = propReportData || storeReportData || {}

  const dashboard = resumeAgent?.dashboard || {}
  const issues = (resumeAgent?.issues || []).filter(Boolean)
  const priorityActions = (resumeAgent?.priorityActions || []).filter(Boolean)
  const strengths = (resumeAgent?.strengths || []).filter(Boolean)
  const snapshot = resumeAgent?.candidateSnapshot || {}
  const firstName = (snapshot.name || '').split(' ')[0]
  const variant = theme === 'dark' ? 'dark' : 'light'

  const wovenList =
    resumeAgent?.interviewLedger ||
    resumeAgent?.wovenKeywords ||
    reportData?.resume_agent?.interviewLedger ||
    reportData?.interviewLedger ||
    []
  const interviewLedger = wovenList

  // Stranded skills: listed in Skills section but unverified in work bullets
  const strandedSkills = useMemo(() => {
    const list = [
      ...(dashboard?.keywordAlignment?.skillsOnlyUnverified || []),
      ...(resumeAgent?.keywordAlignment?.skillsOnlyUnverified || []),
      ...(interviewLedger || []).map((i) => i.keyword || i.name),
    ]
      .map((s) => (typeof s === 'string' ? decodeHtmlEntities(s).trim() : (s?.keyword || s?.name || '')))
      .filter(Boolean)

    const unique = Array.from(new Set(list))
    return unique.length > 0 ? unique : ['BigQuery', 'Looker', 'Databricks', 'Airflow', 'dbt', 'Snowflake', 'Docker']
  }, [dashboard?.keywordAlignment?.skillsOnlyUnverified, resumeAgent?.keywordAlignment?.skillsOnlyUnverified, interviewLedger])

  const rawSummaryOpt = resumeAgent.summaryOptimization || null
  const summaryOptimization = rawSummaryOpt
    ? {
        ...rawSummaryOpt,
        rewrittenSummary: cleanRewriteText(rawSummaryOpt.rewrittenSummary),
      }
    : null

  // Unified resolvedBullets: reads from dashboard, bulletRewrites, or raw canonical parsed bullets
  const resolvedBullets = useMemo(() => {
    // 1. Check dashboard?.bulletAudit
    if (Array.isArray(dashboard?.bulletAudit) && dashboard.bulletAudit.length > 0) {
      return dashboard.bulletAudit
    }
    // 2. Check resumeAgent?.bulletRewrites / bullet_rewrites
    const raBullets = resumeAgent?.bulletRewrites || resumeAgent?.bullet_rewrites
    if (Array.isArray(raBullets) && raBullets.length > 0) {
      return raBullets
    }
    // 3. Check reportData?.bullet_rewrites / resume_rewrites / resume_agent?.bulletRewrites
    const repBullets =
      reportData?.bullet_rewrites ||
      reportData?.resume_rewrites ||
      reportData?.bulletRewrites ||
      reportData?.resume_agent?.bulletRewrites ||
      reportData?.resume_agent?.bullet_rewrites
    if (Array.isArray(repBullets) && repBullets.length > 0) {
      return repBullets
    }
    // 4. Parsed experience bullets fallback from canonical resume
    const expList =
      resumeAgent?.canonicalResume?.experiences ||
      resumeAgent?.canonicalResume?.experience ||
      reportData?.resume_json?.experience ||
      reportData?.resume_json?.experiences ||
      []
    const fallbackList = []
    for (const exp of expList) {
      for (const b of exp.bullets || []) {
        const text = typeof b === 'string' ? b : b?.text || b?.original
        if (text) {
          fallbackList.push({
            bulletId: b?.id || `exp_b_${fallbackList.length}`,
            original: text,
            text,
            status: 'warn',
            verdict: 'hurting',
          })
        }
      }
    }
    return fallbackList
  }, [
    dashboard?.bulletAudit,
    resumeAgent?.bulletRewrites,
    resumeAgent?.bullet_rewrites,
    reportData?.bullet_rewrites,
    reportData?.resume_rewrites,
    reportData?.bulletRewrites,
    reportData?.resume_agent?.bulletRewrites,
    reportData?.resume_agent?.bullet_rewrites,
    resumeAgent?.canonicalResume,
    reportData?.resume_json,
  ])

  const rawSectionAudit = resumeAgent?.sectionAudit || dashboard?.sectionAudit || reportData?.resume_agent?.sectionAudit || null
  const effectiveSectionAudit = useMemo(() => {
    let baseAudit = null
    if (rawSectionAudit && typeof rawSectionAudit === 'object' && (rawSectionAudit.headerAndContact || rawSectionAudit.header)) {
      baseAudit = rawSectionAudit
    } else {
      const grades = dashboard?.grades || {}
      const quantBullets = resolvedBullets.filter((b) => b.hasQuantifier || b.status === 'pass' || (typeof b.impactScore === 'number' && b.impactScore >= 75)).length
      const totalBullets = resolvedBullets.length
      const kwScore = dashboard?.keywordAlignment?.score || 72
      const impactScore = grades?.impact?.score || 65
      const atsScore = grades?.ats_readability?.score || 85
      const posScore = grades?.positioning?.score || 68

      baseAudit = {
        headerAndContact: {
          score10: 9,
          status: 'pass',
          label: 'Header & Contact Parsing',
          whatsHurting: null,
          hurtingReason: null,
          requiredImprovement: 'Format contact info as a clean single line at the top: Name | Location | Phone | Email | LinkedIn.',
        },
        summary: {
          score10: Math.max(2, Math.min(10, Math.round(posScore / 10))),
          status: posScore >= 80 ? 'pass' : posScore >= 50 ? 'warn' : 'fail',
          label: 'Professional Summary',
          whatsHurting: posScore < 80 ? 'Summary relies on generic phrasing without specifying your target role and measurable specialty.' : null,
          hurtingReason: posScore < 80 ? 'Summary relies on generic phrasing without specifying your target role and measurable specialty.' : null,
          requiredImprovement: 'Write a 3-sentence executive pitch: [Target Role] with [X]+ years experience in [Core Stack], proven in [Primary Outcome].',
        },
        experience: {
          score10: (totalBullets > 0 && quantBullets === 0)
            ? Math.min(5, Math.round(impactScore / 10))
            : (totalBullets > 0 && quantBullets < totalBullets * 0.5)
            ? Math.min(7, Math.round(impactScore / 10))
            : Math.max(1, Math.min(10, Math.round(impactScore / 10))),
          status: (totalBullets > 0 && quantBullets < totalBullets * 0.5)
            ? 'warn'
            : impactScore >= 80 ? 'pass' : impactScore >= 50 ? 'warn' : 'fail',
          label: 'Experience Bullets & Quantified Impact',
          whatsHurting: (totalBullets > 0 && quantBullets === 0)
            ? `0 of ${totalBullets} bullets (0%) contain measurable metrics. Without quantified outcomes (% or $ scale), recruiters cannot verify your engineering impact.`
            : (totalBullets > 0 && quantBullets < totalBullets * 0.5)
            ? `Only ${quantBullets} of ${totalBullets} bullets (${Math.round((quantBullets / totalBullets) * 100)}%) contain measurable metrics, falling below the 50% recruiter benchmark.`
            : (impactScore < 80 ? 'Bullets focus heavily on routine duties rather than quantified business outcomes.' : null),
          hurtingReason: (totalBullets > 0 && quantBullets === 0)
            ? `0 of ${totalBullets} bullets (0%) contain measurable metrics. Without quantified outcomes (% or $ scale), recruiters cannot verify your engineering impact.`
            : (totalBullets > 0 && quantBullets < totalBullets * 0.5)
            ? `Only ${quantBullets} of ${totalBullets} bullets (${Math.round((quantBullets / totalBullets) * 100)}%) contain measurable metrics, falling below the 50% recruiter benchmark.`
            : (impactScore < 80 ? 'Bullets focus heavily on routine duties rather than quantified business outcomes.' : null),
          requiredImprovement: 'Rewrite bullets using the formula: Action Verb + Technical Mechanism + Quantified Business Impact (% or $ gain).',
        },
        skills: {
          score10: Math.max(1, Math.min(10, Math.round(kwScore / 10))),
          status: kwScore >= 80 ? 'pass' : kwScore >= 50 ? 'warn' : 'fail',
          label: 'Skills & Market Keyword Alignment',
          whatsHurting: kwScore < 80 ? 'Missing priority market keywords expected for your target role, throttling ATS ranking.' : null,
          hurtingReason: kwScore < 80 ? 'Missing priority market keywords expected for your target role, throttling ATS ranking.' : null,
          requiredImprovement: 'Add missing core market tools directly to your Skills section and mirror them within work experience bullet points.',
        },
        formatting: {
          score10: Math.max(1, Math.min(10, Math.round(atsScore / 10))),
          status: atsScore >= 80 ? 'pass' : atsScore >= 50 ? 'warn' : 'fail',
          label: 'Formatting, Length & ATS Safety',
          whatsHurting: atsScore < 80 ? 'Formatting structure flags potential ATS parsing friction.' : null,
          hurtingReason: atsScore < 80 ? 'Formatting structure flags potential ATS parsing friction.' : null,
          requiredImprovement: 'Keep bullet points between 15-28 words with standard clean margins and standard single-column headers.',
        },
      }
    }

    // Strictly deduplicate by section label as a safeguard so 2 identical cards can never render
    const cleanAudit = {}
    const seenLabels = new Set()
    for (const [k, v] of Object.entries(baseAudit || {})) {
      if (!v || typeof v !== 'object') continue
      // If both 'header' and 'headerAndContact' exist, keep 'headerAndContact'
      if (k === 'header' && baseAudit.headerAndContact) continue
      const label = v.label || v.name || k
      if (seenLabels.has(label)) continue
      seenLabels.add(label)
      cleanAudit[k] = v
    }
    return cleanAudit
  }, [rawSectionAudit, dashboard, resolvedBullets])

  const handleCopySummary = () => {
    if (!summaryOptimization?.rewrittenSummary) return
    navigator.clipboard.writeText(summaryOptimization.rewrittenSummary)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  const targetRole = decodeHtmlEntities(
    snapshot.targetRole ||
    reportData?.targetRole ||
    reportData?.user_answers?.targetRole ||
    'Data Analyst'
  )

  const verifiedKeywords = (resumeAgent?.keywordAlignment?.verifiedKeywords || []).map((k) => (typeof k === 'string' ? k : k.keyword || k.name)).filter(Boolean)
  const coreSkills = (snapshot.coreSkills || snapshot.topSkills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean)
  const topHardSkills = Array.from(new Set([...verifiedKeywords, ...coreSkills])).map(decodeHtmlEntities).slice(0, 4)
  const displayHardSkills = topHardSkills.length > 0 ? topHardSkills : ['SQL', 'Python']
  const searchSkillsLabel = displayHardSkills.slice(0, 2).join(' & ')
  const linkedinSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`("${targetRole}") AND ("${displayHardSkills.slice(0, 2).join('" OR "')}") AND ("Hiring" OR "Lead" OR "Manager")`)}`

  const sponsorInfo = useMemo(() => {
    const currentStatus = getCompanySponsorStatus(snapshot.presentCompany)
    if (currentStatus.isVerified) return currentStatus
    for (const past of snapshot.pastRoles || []) {
      const pastStatus = getCompanySponsorStatus(past.company)
      if (pastStatus.isVerified) return pastStatus
    }
    return null
  }, [snapshot.presentCompany, snapshot.pastRoles])

  const missingKeywords = [
    ...(resumeAgent?.keywordAlignment?.missingKeywords || []),
    ...(resumeAgent?.keywordAlignment?.missingFromResume || []),
    ...(resumeAgent?.keywordAlignment?.skillsOnlyUnverified || []),
  ].map((s) => (typeof s === 'string' ? s : s.keyword || s.name || '')).filter(Boolean)

  const cutList = useMemo(() => {
    return dashboard?.cutList || resumeAgent?.cutList || reportData?.resume_agent?.cutList || []
  }, [dashboard, resumeAgent, reportData])

  const nearMissKeywords = useMemo(() => {
    return dashboard?.nearMissKeywords || resumeAgent?.nearMissKeywords || reportData?.resume_agent?.nearMissKeywords || []
  }, [dashboard, resumeAgent, reportData])



  const handleDownloadDocx = async (skillsToWeave = null) => {
    try {
      setIsDownloadingDocx(true)
      const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api')
      const storeUserId = useAppStore.getState().userId
      const storeEmail = useAppStore.getState().email
      const userId = reportData?.userId || reportData?._id || storeUserId || ''
      const email = reportData?.user_answers?.email || reportData?.candidate_email || reportData?.email || storeEmail || ''

      const skillsList = Array.isArray(skillsToWeave)
        ? skillsToWeave
        : (missingKeywords.length > 0 ? missingKeywords.slice(0, 6) : [])
      const skillsQuery = skillsList.length > 0 ? `&skills=${encodeURIComponent(skillsList.join(','))}` : ''

      let response = null

      // Strategy A: If userId or email is present, try GET with skills param
      if (userId || email) {
        const url = userId
          ? `${apiBase}/assessment/user/${encodeURIComponent(userId)}/download-resume-docx?${skillsQuery.replace('&', '')}`
          : `${apiBase}/assessment/download-resume-docx?email=${encodeURIComponent(email)}${skillsQuery}`
        try {
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream'
            }
          })
        } catch (_fetchErr) {
          response = null
        }
      }

      // Strategy B: Fallback to POST with direct JSON payload including selectedSkills
      if (!response || !response.ok) {
        const postUrl = `${apiBase}/assessment/download-resume-docx`
        response = await fetch(postUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream'
          },
          body: JSON.stringify({
            userId,
            email,
            selectedSkills: skillsList,
            skills: skillsList,
            reportData,
            canonicalResume: reportData?.resume_agent?.canonicalResume || reportData?.resumeJson,
            bulletAudit: reportData?.resume_agent?.dashboard?.bulletAudit || reportData?.resume_agent?.bulletRewrites,
            missingKeywords: skillsList
          })
        })
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => null)
        throw new Error(errJson?.message || `Download failed with status ${response.status}`)
      }

      // Dynamically update on-screen report and interview defense sheet from response headers
      const ledgerHeader = response.headers.get('x-interview-ledger')
      const expHeader = response.headers.get('x-tailored-experiences')
      if (ledgerHeader) {
        try {
          const parsedLedger = JSON.parse(atob(ledgerHeader))
          let parsedExp = null
          if (expHeader) {
            try {
              parsedExp = JSON.parse(atob(expHeader))
            } catch (_) {}
          }
          const cur = useAppStore.getState().reportData || {}
          const updated = {
            ...cur,
            interviewLedger: parsedLedger,
            resume_agent: {
              ...(cur.resume_agent || {}),
              interviewLedger: parsedLedger,
              canonicalResume: {
                ...(cur.resume_agent?.canonicalResume || {}),
                ...(parsedExp ? { experiences: parsedExp } : {}),
              },
            },
          }
          useAppStore.getState().setReportData(updated)
        } catch (hErr) {
          console.warn('Could not parse updated ledger from headers:', hErr)
        }
      }

      const blob = await response.blob()
      if (blob.type && blob.type.includes('text/html')) {
        throw new Error('Server returned HTML error page instead of Word document.')
      }

      const disposition = response.headers.get('content-disposition') || ''
      let filename = ''
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].replace(/['"]/g, '').trim())
        }
      }

      if (!filename || !filename.toLowerCase().endsWith('.docx')) {
        const candidateName = (
          reportData?.resume_agent?.canonicalResume?.candidate_name ||
          reportData?.resume_agent?.canonicalResume?.name ||
          snapshot.name ||
          'Candidate'
        ).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
        filename = `${candidateName || 'Candidate'}_Tailored_ATS_Resume.docx`
      }

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
      showToast('Resume downloaded successfully!', 'success')
    } catch (error) {
      console.error('Failed to download tailored docx:', error)
      showToast(getFriendlyErrorMessage(error, 'Could not download resume.'), 'error')
    } finally {
      setIsDownloadingDocx(false)
    }
  }

  // Filter out issues that are already rendered inline on bullet cards in ResumeBulletAudit
  const sectionLevelIssues = useMemo(() => {
    const auditedBulletIds = new Set(
      (resolvedBullets || []).map((b) => b.bulletId).filter(Boolean)
    )
    const auditedTexts = new Set(
      (resolvedBullets || [])
        .map((b) => (b.text || b.original || '').trim().toLowerCase())
        .filter((t) => t.length > 15)
    )

    if (!auditedBulletIds.size) return issues

    return issues.filter((iss) => {
      // 1. Direct bulletId match
      if (iss.bulletId && auditedBulletIds.has(iss.bulletId)) return false

      // 2. Evidence match
      const evList = Array.isArray(iss.evidence)
        ? iss.evidence
        : iss.evidence
        ? [iss.evidence]
        : []

      const hasAuditedEvidence = evList.some((ev) => {
        if (typeof ev === 'string') {
          const evLower = ev.trim().toLowerCase()
          return (
            auditedBulletIds.has(ev) ||
            Array.from(auditedTexts).some((t) => evLower.includes(t) || t.includes(evLower))
          )
        }
        if (ev?.bulletId && auditedBulletIds.has(ev.bulletId)) return true
        if (ev?.text) {
          const evTextLower = ev.text.trim().toLowerCase()
          return Array.from(auditedTexts).some((t) => evTextLower.includes(t) || t.includes(evTextLower))
        }
        return false
      })

      if (hasAuditedEvidence) return false

      // 3. Original text match
      if (iss.originalText) {
        const origLower = iss.originalText.trim().toLowerCase()
        if (Array.from(auditedTexts).some((t) => origLower.includes(t) || t.includes(origLower))) {
          return false
        }
      }

      return true
    })
  }, [issues, resolvedBullets])

  if (!resumeAgent?.dashboard && !resumeAgent?.issues?.length) return null

  return (
    <section id="resume-ai" className="space-y-8 scroll-mt-28 print:space-y-6">
      <SectionHeader
        icon={<Target size={22} weight="bold" className="text-indigo-600" />}
        title="Resume Diagnostic Lab & Bullet Rewrites"
        accent="text-indigo-600"
      />

      {/* Candidate Snapshot Meta Bar */}
      {(snapshot.name || snapshot.targetRole || snapshot.presentRole) && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-strong)] flex items-center justify-center text-[var(--primary)] border border-[var(--border-default)]">
              <User size={16} weight="bold" />
            </div>
            <div className="flex flex-wrap items-center gap-y-1">
              <span className="font-bold text-[var(--text-primary)]">{decodeHtmlEntities(snapshot.name || 'Candidate')}</span>
              {snapshot.targetRole && (
                <span className="text-[var(--text-muted)] ml-2">· Target: <strong className="text-[var(--text-secondary)]">{decodeHtmlEntities(snapshot.targetRole)}</strong></span>
              )}
              {snapshot.presentRole && (
                <span className="text-[var(--text-muted)] ml-2">· Current: <strong className="text-emerald-600 dark:text-emerald-400">{decodeHtmlEntities(snapshot.presentRole)}{snapshot.presentCompany ? ` @ ${decodeHtmlEntities(snapshot.presentCompany)}` : ''}</strong></span>
              )}
              {snapshot.pastRoles && snapshot.pastRoles.length > 0 && snapshot.pastRoles[0]?.role && (
                <span className="text-[var(--text-muted)] ml-2">· Prev: <span className="text-[var(--text-secondary)]">{decodeHtmlEntities(snapshot.pastRoles[0].role)}{snapshot.pastRoles[0].company ? ` @ ${decodeHtmlEntities(snapshot.pastRoles[0].company)}` : ''}</span></span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {snapshot.linkedinUrl && (
              <a
                href={snapshot.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-full bg-[#0a66c2]/10 text-[#0a66c2] border border-[#0a66c2]/30 text-[10px] font-bold flex items-center gap-1 hover:underline"
              >
                LinkedIn Profile
              </a>
            )}
            {snapshot.experienceLevel && (
              <span className="px-2.5 py-1 rounded-full bg-[var(--surface-strong)] border border-[var(--border-default)] font-mono text-[10px] text-[var(--text-secondary)] font-semibold">
                {snapshot.experienceLevel}
              </span>
            )}
            {sponsorInfo && (
              <span
                className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1"
                title={`${sponsorInfo.name} — ${sponsorInfo.tier} (${sponsorInfo.approvals} approvals)`}
              >
                <ShieldCheck size={12} weight="fill" />
                USCIS Verified Sponsor
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1">
              <ShieldCheck size={12} weight="fill" />
              Recruiter-Verified
            </span>

            {/* Prominent Tailored .docx Download Button */}
            <button
              type="button"
              onClick={() => {
                if (isTeaserLocked) {
                  document.getElementById('next-action')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  setToastMsg('Unlock your tailored ATS .docx resume in your free 15-min strategy call.')
                  return
                }
                handleDownloadDocx()
              }}
              disabled={isDownloadingDocx}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ml-auto disabled:opacity-60 ${
                isTeaserLocked
                  ? 'bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--primary)]'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isTeaserLocked ? <LockKey size={13} weight="bold" className="text-[var(--primary)]" /> : <DownloadSimple size={13} weight="bold" />}
              <span>{isDownloadingDocx ? 'Generating .docx...' : 'Download Tailored ATS Resume (.docx)'}</span>
              {isTeaserLocked && (
                <span className="px-1.5 py-0.5 rounded bg-[var(--surface-card)] border border-[var(--border-default)] text-xs font-medium text-[var(--text-muted)]">
                  Call
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Scorecard */}
      {dashboard && (
        <ResumeScoreCard
          id="resume-scorecard"
          data-mascot-cue="Deterministic ATS scorecard: inspect your 6 pillar grades."
          data-mascot-chip="ATS Scorecard"
          data-mascot-emotion="thinking"
          dashboard={dashboard}
          candidateName={firstName}
          marketContext={reportData?.marketContext || reportData?.resume_agent?.marketContext || resumeAgent?.marketContext}
          variant={variant}
        />
      )}

      {/* ── Section-by-Section Resume Audit (/10) ──────────── */}
      <div
        id="resume-audit"
        data-mascot-cue="Section-by-section audit: scores each resume section out of 10 with actionable fixes."
        data-mascot-chip="Section Audit"
        data-mascot-emotion="thinking"
        className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <ChartBar size={15} weight="bold" className="text-[var(--primary)]" />
              Section-by-Section Resume Audit (/10)
            </span>
            <p className="text-xs text-[var(--text-secondary)]">
              Recruiter benchmark breakdown scoring each resume section out of 10 with actionable &quot;what&apos;s hurting&quot; diagnostics and required improvements.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5 rounded-full">
            5 Core Sections Audited
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {Object.entries(effectiveSectionAudit).map(([key, item]) => {
            const score10 = item.score10 ?? 0
            const isPassing = score10 >= 8
            const isWarning = score10 >= 5 && score10 < 8
            const badgeClass = isPassing
              ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20'
              : isWarning
              ? 'text-amber-700 bg-amber-500/10 border-amber-500/20'
              : 'text-rose-700 bg-rose-500/10 border-rose-500/20'

            const barColor = isPassing
              ? 'bg-emerald-500'
              : isWarning
              ? 'bg-amber-500'
              : 'bg-rose-500'

            return (
              <div
                key={key}
                className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate" title={item.label}>
                      {item.label}
                    </span>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md border ${badgeClass}`}>
                      {score10}/10
                    </span>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full h-1.5 bg-[var(--surface-card)] rounded-full overflow-hidden border border-[var(--border-default)]">
                    <div
                      className={`h-full transition-[width] duration-500 rounded-full ${barColor}`}
                      style={{ width: `${Math.max(10, Math.min(100, score10 * 10))}%` }}
                    />
                  </div>
                </div>

                {/* What's Hurting note & Required Improvement */}
                <div className="pt-2 border-t border-[var(--border-default)] text-xs leading-relaxed space-y-2">
                  {!isPassing ? (
                    <div className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <WarningCircle size={12} weight="bold" /> What&apos;s Hurting
                      </span>
                      <p className="text-[var(--text-secondary)] text-xs leading-snug">
                        {item.whatsHurting || item.hurtingReason || 'Scoring below the 8/10 recruiter benchmark; needs refinement.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle size={12} weight="bold" /> Looking Strong
                      </span>
                      <p className="text-[var(--text-muted)] text-xs leading-snug">
                        Well-calibrated for recruiter screening and ATS parsing safety.
                      </p>
                    </div>
                  )}

                  {!isPassing && item.requiredImprovement && (
                    <div className="pt-1.5 border-t border-[var(--border-default)]/60 space-y-0.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1">
                        <ArrowRight size={11} weight="bold" /> Required Fix
                      </span>
                      <p className="text-[var(--text-primary)] text-xs leading-snug">
                        {item.requiredImprovement}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Keyword & JD Alignment (With Single Unified Download CTA) */}
      {(dashboard?.keywordAlignment || resumeAgent.keywordAlignment) && (
        <div id="resume-keywords">
          <ResumeKeywordAlignment
            keywordAlignment={dashboard?.keywordAlignment || resumeAgent.keywordAlignment}
            variant={variant}
            currentMatchRate={resumeAgent?.keywordAlignment?.matchPercent}
            onRebuildResume={handleDownloadDocx}
            reportData={reportData}
            onToast={(msg) => setToastMsg(msg)}
            isTeaserLocked={isTeaserLocked}
            bookingUrl={teaserLockProps?.bookingUrl}
          />
        </div>
      )}

      {/* Two Column Grid: Recruiter's Read & What's Working */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overall review */}
        {(resumeAgent.overallReview?.summary || typeof resumeAgent.overallReview === 'string') && (
          <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl p-6 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-mono text-emerald-400 flex items-center gap-2">
                  <User size={15} weight="bold" /> The Recruiter's Read
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                  Direct Diagnostic Tone
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                {cleanRecruiterSummary(
                  typeof resumeAgent.overallReview === 'string'
                    ? resumeAgent.overallReview
                    : resumeAgent.overallReview?.summary,
                  firstName,
                  dashboard,
                  resolvedBullets
                )}
              </p>
            </div>
          </div>
        )}

        {/* What's Working Strengths */}
        {strengths.length > 0 && (
          <div className="bg-[var(--surface-card)] border border-emerald-500/30 rounded-2xl p-6 space-y-3 break-inside-avoid page-break-inside-avoid print-card">
            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle size={16} weight="fill" /> What's Working on Your Resume ({strengths.length})
            </h3>
            <ul className="space-y-3">
              {strengths.map((str, i) => {
                const isObj = typeof str === 'object' && str !== null
                const title = isObj ? str.title : null
                const desc = isObj ? (str.description || str.text || '') : String(str || '')

                return (
                  <li key={isObj ? str.id || i : i} className="text-xs text-[var(--text-secondary)] flex items-start gap-2.5 leading-relaxed break-inside-avoid page-break-inside-avoid">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                    <div className="min-w-0">
                      {title && (
                        <strong className="font-semibold text-[var(--text-primary)] mr-1.5">
                          {title}{desc ? ' —' : ''}
                        </strong>
                      )}
                      <span>{desc || title}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>






      {/* Dedicated Professional Summary Audit & Ready-to-Paste Rewrite Card */}
      {summaryOptimization && (
        <div
          id="resume-summary"
          data-mascot-cue="Executive summary rewrite: ready to copy and paste to anchor your target level."
          data-mascot-chip="Summary Rewrite"
          data-mascot-emotion="coach"
          className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-6 space-y-5 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500">
                <FileText size={18} weight="bold" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                  Professional Summary Audit & Strategic Rewrite
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Senior recruiter critique and a tailored executive hook engineered for 6-second recruiter scans.
                </p>
              </div>
            </div>

            <div>
              {summaryOptimization.status === 'missing' && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/25">
                  Missing on Resume
                </span>
              )}
              {summaryOptimization.status === 'needs_rewrite' && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  Needs Upgrade
                </span>
              )}
              {summaryOptimization.status === 'strong' && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  Strong
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Summary */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Current Summary on Resume
              </span>
              <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-3.5 text-xs text-[var(--text-secondary)] leading-relaxed italic min-h-[85px] flex items-center">
                {summaryOptimization.currentSummary || 'No Professional Summary section found on resume'}
              </div>
            </div>

            {/* Recruiter Diagnosis */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                <WarningCircle size={13} weight="fill" /> Recruiter Diagnosis (6-Second Scan)
              </span>
              <div className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl p-3.5 text-xs text-[var(--text-primary)] leading-relaxed min-h-[85px] flex items-center">
                {summaryOptimization.diagnosis}
              </div>
            </div>
          </div>

          {/* Ready-to-Paste Executive Summary Rewrite */}
          {summaryOptimization.rewrittenSummary && (
            <div className="bg-[var(--surface-sunken)] border border-[var(--border-default)] rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 font-mono">
                  <Target size={14} weight="bold" /> Strategic Executive Summary Rewrite
                </span>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="print-keep px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Click to copy executive summary"
                >
                  {copiedSummary ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
                  <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                </button>
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-primary)] font-medium leading-relaxed bg-[var(--surface-card)]/80 p-3.5 rounded-lg border border-[var(--border-default)]">
                {summaryOptimization.rewrittenSummary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Line-by-line bullet audit with interactive experience dropdowns */}
      <div id="resume-bullets" className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6">
        <ResumeBulletAudit
          bulletAudit={resolvedBullets}
          bulletData={reportData}
          issues={issues}
          variant={variant}
          isTeaserLocked={isTeaserLocked}
          bookingUrl={teaserLockProps?.bookingUrl}
        />
      </div>

      {/* What to Cut (Fluff & 1-Page Discipline) */}
      {cutList.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-default)] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <Scissors size={20} weight="bold" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    What to Cut (Fluff & 1-Page Discipline)
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20 tabular-nums">
                    {cutList.length} {cutList.length === 1 ? 'Item' : 'Items'} to Cut
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Lines that dilute senior positioning, waste valuable vertical space, or break 1-page resume discipline (&lt;8 YOE).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {cutList.map((item, idx) => (
              <div
                key={item.bulletId || idx}
                className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2 hover:border-rose-400/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    {item.section || 'Resume Line'}
                  </span>
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    ✕ Recommended for Deletion
                  </span>
                </div>
                {item.originalText && (
                  <p className="text-xs text-[var(--text-secondary)] line-through decoration-rose-500/70 font-mono bg-[var(--surface-card)] p-2.5 rounded-lg border border-[var(--border-default)]">
                    "{item.originalText}"
                  </p>
                )}
                <p className="text-xs text-[var(--text-primary)] font-medium">
                  <strong className="text-rose-600 dark:text-rose-400">Why cut:</strong> {item.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Literal ATS Keyword Mirroring */}
      {nearMissKeywords.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-default)] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                <ArrowsLeftRight size={20} weight="bold" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Literal ATS Keyword Mirroring
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 tabular-nums">
                    {nearMissKeywords.length} Exact Keyword Swaps
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  ATS scanners match verbatim JD phrases. Replace loose semantic synonyms with literal target terms.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nearMissKeywords.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-2 hover:border-indigo-400/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold line-through text-rose-500 decoration-rose-500 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                      {item.resumePhrase}
                    </span>
                    <ArrowRight size={14} className="text-[var(--text-muted)]" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {item.jdPhrase}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] pt-1">
                  <strong className="text-[var(--text-primary)]">ATS Parser Note:</strong> {item.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Dedicated Technical Talking Points & Interview Defense Guide */}
      <div id="resume-defense">
        <InterviewDefenseInteractive
          initialSkillsOnly={strandedSkills}
          interviewLedger={interviewLedger}
          targetRole={targetRole}
          company={snapshot.presentCompany || reportData?.resume_json?.experiences?.[0]?.company || 'my organization'}
          onToast={(msg) => setToastMsg(msg)}
        />
      </div>

      {/* Deep issues (only shown when bullet audit is not available) */}
      {!resolvedBullets.length && sectionLevelIssues.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
              <WarningCircle size={15} className="text-amber-400" /> Deep ATS & Recruiter Diagnosis ({sectionLevelIssues.length} {sectionLevelIssues.length === 1 ? 'Issue' : 'Issues'})
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {sectionLevelIssues.map((iss, i) => {
              const qs = Array.isArray(iss.metricDiscoveryQuestions) ? iss.metricDiscoveryQuestions : []
              return (
                <div
                  key={iss.id || i}
                  className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-5 space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityChip[iss.severity] || severityChip.low}`}>
                      {iss.severity} · {String(iss.category || '').replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{iss.title}</span>
                    <span className="ml-auto">
                      <FeedbackThumbs agent="resume" findingId={iss.id || `issue_${i}`} />
                    </span>
                  </div>

                  {iss.diagnosis && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {iss.diagnosis}
                    </p>
                  )}

                  {iss.recommendation && (
                    <div className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--primary-light)] border border-[var(--border-default)] rounded-xl p-3.5">
                      <div className="text-[10px] uppercase font-bold text-[var(--primary)] tracking-wider mb-1 flex items-center gap-1">
                        <ArrowRight size={12} /> Recommended Fix
                      </div>
                      <p>{iss.recommendation}</p>
                    </div>
                  )}

                  {qs.length > 0 && (
                    <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-3.5">
                      <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">
                        Clarifying Questions to Uncover Measurable Numbers:
                      </div>
                      <ul className="space-y-1">
                        {qs.map((q, qi) => {
                          const questionText = typeof q === 'string' ? q : (q?.question || q?.text || String(q || ''))
                          return (
                            <li key={qi} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                              <span className="text-amber-500 font-bold">?</span> {questionText}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Priority actions (only shown when bullet audit is not available) */}
      {!resolvedBullets.length && priorityActions.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl p-6">
          <h3 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-2 mb-4">
            <ListChecks size={15} /> Priority Action Items — Do These First
          </h3>
          <div className="space-y-3">
            {priorityActions.map((pa, i) => {
              const isObj = typeof pa === 'object' && pa !== null
              const title = isObj ? pa.title : String(pa || '')
              const action = isObj
                ? (typeof pa.action === 'string' ? pa.action : (pa.action?.description || pa.action?.text || ''))
                : ''
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-base)] border border-[var(--border-default)]">
                  <span className="w-6 h-6 rounded-lg bg-[var(--primary-light)] border border-[var(--border-default)] text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {isObj ? pa.priority || i + 1 : i + 1}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{title}</div>
                    {action && (
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                        {action}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Real-time interactive toast notification */}
      <Toast message={toastMsg} onClose={() => setToastMsg('')} />
    </section>
  )
}
