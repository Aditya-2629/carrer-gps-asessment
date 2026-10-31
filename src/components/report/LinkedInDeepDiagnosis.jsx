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

export function cleanTargetRoleTitle(prefix, baseRole) {
  if (!baseRole && !prefix) return 'Software Engineer'
  if (!baseRole) return String(prefix).trim()
  if (!prefix) {
    return String(baseRole)
      .replace(/^((?:senior|lead|principal|staff|junior|mid-level)\s+)(?:\1)+/i, '$1')
      .trim()
  }
  const clean = String(baseRole).replace(/^((?:senior|lead|principal|staff|junior|mid-level)\s+)+/i, '').trim()
  return `${String(prefix).trim()} ${clean}`.trim()
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

function isConcreteTechSkill(skill) {
  if (!skill || typeof skill !== 'string') return false
  const trimmed = skill.trim()
  if (trimmed.length === 0 || trimmed.length > 26) return false
  if (/\s+and\s+/i.test(trimmed)) return false

  const words = trimmed.split(/\s+/)
  if (words.length > 3) return false

  const KNOWN_TOOLS = new Set([
    'sql', 'python', 'r', 'power bi', 'tableau', 'snowflake', 'bigquery', 'looker', 'looker studio',
    'dbt', 'databricks', 'excel', 'postgresql', 'postgres', 'mysql', 'oracle', 'aws', 'azure', 'gcp',
    'docker', 'kubernetes', 'git', 'java', 'c++', 'c#', 'go', 'golang', 'typescript', 'javascript',
    'react', 'node.js', 'nodejs', 'kafka', 'spark', 'pyspark', 'hadoop', 'airflow', 'pandas', 'numpy',
    'scikit-learn', 'tensorflow', 'pytorch', 'redshift', 'mongodb', 'redis', 'graphql', 'rest apis',
    'fastapi', 'spring boot', 'langchain', 'langgraph', 'rag', 'chromadb', 'jira', 'confluence', 'linux',
    'salesforce', 'alteryx', 'ssis', 'ssrs', 'ssas', 'sap', 'teradata', 'spark sql', 'etl', 'elt'
  ])

  const lower = trimmed.toLowerCase()
  if (KNOWN_TOOLS.has(lower)) return true

  if (/^(sql|python|power\s+bi|tableau|snowflake|bigquery|looker|dbt|databricks|aws|azure|gcp|react|node|docker|kubernetes|kafka|spark|airflow|excel)/i.test(trimmed)) {
    return true
  }

  if (/analysis|investigation|reporting|management|strategy|methodology|definition|modelling|modeling|gathering/i.test(lower)) {
    return false
  }

  return words.length <= 2
}

function formatSkillName(skill) {
  if (!skill || typeof skill !== 'string') return ''
  const trimmed = skill.trim()
  const CANONICAL_CASING = {
    langgraph: 'LangGraph',
    langchain: 'LangChain',
    fastapi: 'FastAPI',
    chromadb: 'ChromaDB',
    'spring ai': 'Spring AI',
    'spring boot': 'Spring Boot',
    'next.js': 'Next.js',
    'power bi': 'Power BI',
    bigquery: 'BigQuery',
    'looker studio': 'Looker Studio',
    postgresql: 'PostgreSQL',
    mongodb: 'MongoDB',
    graphql: 'GraphQL',
    'rest apis': 'REST APIs',
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    sql: 'SQL',
    kpi: 'KPI',
    kpis: 'KPIs',
    bi: 'BI',
    aws: 'AWS',
    gcp: 'GCP',
    etl: 'ETL',
    elt: 'ELT',
    ai: 'AI',
    ml: 'ML',
    api: 'API',
    apis: 'APIs',
    rag: 'RAG',
    llm: 'LLM',
    llms: 'LLMs',
    db: 'DB',
    r: 'R',
    ui: 'UI',
    ux: 'UX',
    dbt: 'dbt',
  }

  const exactCanon = CANONICAL_CASING[trimmed.toLowerCase()]
  if (exactCanon) return exactCanon

  if (/[a-z][A-Z]/.test(trimmed)) {
    return trimmed
  }

  const ACRONYMS = {
    sql: 'SQL',
    kpi: 'KPI',
    kpis: 'KPIs',
    bi: 'BI',
    aws: 'AWS',
    gcp: 'GCP',
    etl: 'ETL',
    elt: 'ELT',
    ai: 'AI',
    ml: 'ML',
    api: 'API',
    apis: 'APIs',
    rag: 'RAG',
    llm: 'LLM',
    llms: 'LLMs',
    db: 'DB',
    r: 'R',
    ui: 'UI',
    ux: 'UX',
    dbt: 'dbt',
  }

  return trimmed
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase()
      if (ACRONYMS[lower]) return ACRONYMS[lower]
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function isValidSkill(skill) {
  if (!skill || typeof skill !== 'string') return false
  const trimmed = skill.trim()
  if (trimmed.length === 0 || trimmed.length > 35) return false
  const words = trimmed.split(/\s+/)
  if (words.length >= 4 && /\s+and\s+/i.test(trimmed)) return false
  return true
}

export default function LinkedInDeepDiagnosis({ linkedinAgent, reportData: propReportData }) {
  const theme = useAppStore((s) => s.theme)
  const resumeAnalysis = useAppStore((s) => s.resumeAnalysis)
  const storeReportData = useAppStore((s) => s.reportData)
  const reportData = propReportData || storeReportData
  const variant = theme === 'dark' ? 'dark' : 'light'
  const [copiedId, setCopiedId] = useState(null)

  const hasUserLinkedinUrl = Boolean(
    reportData?.user_answers?.linkedin ||
    reportData?.user_answers?.linkedinUrl ||
    reportData?.user_answers?.['linkedin-url'] ||
    reportData?.linkedin_json?.url ||
    linkedinAgent?.url
  )
  const isBlankProfile = !hasUserLinkedinUrl && !linkedinAgent?.dataAvailable && !linkedinAgent?.inferredFromResume

  const targetRole =
    reportData?.target_role ||
    reportData?.user_answers?.targetRole ||
    linkedinAgent?.targetRole ||
    reportData?.assessment_agent?.candidateProfile?.targetRole ||
    reportData?.resume_agent?.candidateSnapshot?.targetRole ||
    resumeAnalysis?.data?.analysis?.candidateSnapshot?.targetRole ||
    resumeAnalysis?.data?.canonicalResume?.candidate?.targetRole ||
    reportData?.resume_json?.target_role ||
    'Professional'

  const isSoftwareRole = /software|developer|engineer|backend|frontend|fullstack|sde|web|cloud|devops/i.test(targetRole)
  const isDataRole = /data|analytics|bi|machine learning|ml|ai|scientist/i.test(targetRole)

  const candidateSnap = reportData?.resume_agent?.candidateSnapshot || {}
  // Check candidateSnap.experienceLevel FIRST when resolving yoe (e.g. "3+ years" extracts 3, not 1 from "Junior–Mid / 1–3 Yrs Experience")
  const rawYoe = candidateSnap.experienceLevel ||
                 candidateSnap.experienceYears ||
                 candidateSnap.yearsExperience ||
                 reportData?.resume_json?.years_of_experience ||
                 reportData?.user_answers?.experience ||
                 ''

  let yoeNum = '3'
  const yoeStr = String(rawYoe).trim()
  const rangeMatch = yoeStr.match(/(\d+)\s*[–—-]\s*(\d+)/)
  if (rangeMatch) {
    yoeNum = rangeMatch[2] // Take upper number of the range (e.g. "1–3" -> 3)
  } else {
    const singleMatch = yoeStr.match(/(\d+)/)
    if (singleMatch) {
      yoeNum = singleMatch[1]
    }
  }
  const yoe = String(yoeNum).replace(/\++$/, '') || '3'

  // Extract actual candidate skills from canonical resume or resume_agent
  const candidateSkillsPool = (
    reportData?.resume_agent?.canonicalResume?.skills ||
    reportData?.resume_agent?.candidateSnapshot?.coreSkills ||
    reportData?.resume_json?.skills ||
    reportData?.resume_json?.top_skills ||
    reportData?.skills ||
    []
  ).map((s) => (typeof s === 'string' ? s.trim() : (s?.name || ''))).filter(Boolean)

  const cleanCandidateSkills = candidateSkillsPool.slice(0, 8).map(formatSkillName).filter(Boolean)

  // Role-aware fallbacks if candidate skills are empty
  const defaultSkills = isSoftwareRole
    ? ['Python', 'JavaScript', 'React', 'Node.js', 'AWS', 'Docker']
    : isDataRole
      ? ['SQL', 'Python', 'Power BI', 'Tableau', 'Excel']
      : ['Strategy', 'Project Management', 'Stakeholder Management', 'Process Optimization']

  const effectiveSkills = cleanCandidateSkills.length >= 3 ? cleanCandidateSkills : defaultSkills
  const coreSkillList = effectiveSkills.slice(0, 3)
  const skillsStr = coreSkillList.join(', ')

  const fallbackHeadline = isSoftwareRole
    ? `${targetRole} | ${skillsStr} | Scalable Systems & Cloud Architecture`
    : isDataRole
      ? `${targetRole} | ${skillsStr} | Enterprise Analytics & Data Strategy`
      : `${targetRole} | ${skillsStr} | Driving Operational Excellence`

  const fallbackAbout = isSoftwareRole
    ? `${targetRole} with ${yoe}+ years of experience building high-performance, scalable applications and distributed systems. Core stack: ${effectiveSkills.slice(0, 5).join(', ')}.`
    : isDataRole
      ? `${targetRole} with ${yoe}+ years of experience driving quantifiable impact through technology and analytics. Core competencies: ${effectiveSkills.slice(0, 5).join(', ')}.`
      : `${targetRole} with ${yoe}+ years of experience driving operational impact and cross-functional leadership. Core competencies: ${effectiveSkills.slice(0, 5).join(', ')}.`

  const headline = linkedinAgent?.optimizations?.headlines?.[0]?.headline || fallbackHeadline
  const aboutText = linkedinAgent?.optimizations?.aboutRewrite?.fullText ||
                    linkedinAgent?.optimizations?.aboutRewrite ||
                    fallbackAbout
  const pinnedSkills = linkedinAgent?.optimizations?.top3PinnedSkills?.length
    ? linkedinAgent.optimizations.top3PinnedSkills
    : coreSkillList

  const isVisualItem = (item) => {
    if (!item) return false
    const str = [item.id, item.type, item.section, item.title, item.name, item.diagnosis].filter(Boolean).join(' ').toLowerCase()
    return /visual_photo|visual_banner|profile photo|cover banner|headshot|avatar zone/i.test(str)
  }

  const missingSections = (linkedinAgent?.missingSections || []).filter(Boolean).filter((s) => !isVisualItem(s))
  
  // Track keys from missingSections to avoid duplicating in discrepancies
  const missingSectionKeys = new Set(
    missingSections.flatMap((s) => [s.title?.toLowerCase().trim(), s.id?.toLowerCase().trim()]).filter(Boolean)
  )

  const discrepancies = (linkedinAgent?.discrepancies || [])
    .filter(Boolean)
    .filter((d) => !isVisualItem(d))
    .filter((d) => {
      if (d.type === 'company_typo_unlinked_logo' || /company name typo/i.test(d.title || '')) {
        const rComp = String(d.resumeClaim || d.company || '')
          .replace(/\(.*?\)/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase()
        const lComp = String(d.linkedinClaim || '')
          .replace(/\(.*?\)/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase()
        if (!rComp || !lComp || rComp === lComp || lComp.includes(rComp) || rComp.includes(lComp)) return false
      }
      const titleKey = d.title?.toLowerCase().trim()
      const idKey = d.id?.toLowerCase().trim()
      if (titleKey && missingSectionKeys.has(titleKey)) return false
      if (idKey && missingSectionKeys.has(idKey)) return false
      return true
    })

  const droppedImpact = (linkedinAgent?.droppedImpact || []).filter(Boolean)
  const missingSkills = (linkedinAgent?.missingSkills || []).filter(Boolean)
  const rawOptimizations = linkedinAgent?.optimizations || linkedinAgent?.aiOptimizations || null

  const fallbackHeadlinesList = [
    {
      headline: headline,
      formula: 'Search-Optimized',
      whyItWorks: 'Positions primary role title first followed by high-frequency recruiter search keywords.',
    },
    {
      headline: isSoftwareRole
        ? `${targetRole} @ Scale | Delivering High-Availability Distributed Systems & Modern Cloud Infrastructure`
        : isDataRole
        ? `${targetRole} @ Scale | Delivering 40%+ Reporting Turnaround Efficiency & Modern BI Systems`
        : `${targetRole} @ Scale | Driving Operational Velocity & Strategic Execution`,
      formula: 'Impact-Driven',
      whyItWorks: 'Anchors on measurable operational velocity and architecture outcomes to differentiate from generic applicant pool.',
    },
    {
      headline: isSoftwareRole
        ? `Specialist in Cloud Architecture, Microservices & High-Throughput APIs`
        : isDataRole
        ? `Specialist in Enterprise Analytics, Scalable Data Pipelines & Executive Dashboards`
        : `Specialist in Strategic Operations, Cross-Functional Execution & Agile Delivery`,
      formula: 'Specialist',
      whyItWorks: 'Appeals to specialized hiring managers seeking deep domain expertise and reporting architecture.',
    },
  ]

  const fallbackRecommendedSkills = isSoftwareRole
    ? ['Docker', 'Kubernetes', 'CI/CD Pipelines', 'PostgreSQL', 'Microservices Architecture']
    : isDataRole
      ? ['BigQuery', 'Tableau', 'Snowflake', 'dbt', 'Data Modeling']
      : ['Cross-functional Leadership', 'Agile Methodologies', 'Strategic Planning', 'KPI Dashboards']

  const optimizations = rawOptimizations || {
    headlines: fallbackHeadlinesList,
    aboutRewrite: {
      hook: isSoftwareRole
        ? `${targetRole} with ${yoe}+ years of experience building high-performance, scalable applications and distributed systems.`
        : isDataRole
        ? `${targetRole} with ${yoe}+ years of experience transforming complex operational and enterprise datasets into decision-ready business intelligence pipelines.`
        : `${targetRole} with ${yoe}+ years of experience driving quantifiable impact and operational excellence.`,
      proof: isSoftwareRole
        ? `Proven track record of designing resilient cloud architectures, developing robust APIs, and optimizing CI/CD workflows. Core stack: ${skillsStr}, Docker, and AWS.`
        : isDataRole
        ? `Proven track record of optimizing reporting workflows, building self-service BI dashboards, and translating business requirements into technical metrics. Core stack: ${skillsStr}, BigQuery, and Data Modeling.`
        : `Proven track record of streamlining workflows, managing cross-functional initiatives, and delivering scalable business results. Core competencies: ${skillsStr}.`,
      callToAction: `Open to connecting with engineering leaders, technical directors, and talent acquisition teams regarding ${targetRole} opportunities.`,
      fullText: fallbackAbout,
    },
    top3PinnedSkills: pinnedSkills,
    recommendedSkillsToAdd: cleanCandidateSkills.length > 0 ? cleanCandidateSkills : fallbackRecommendedSkills,
  }

  const experienceUpgrades = (optimizations?.experienceUpgrades || []).filter(Boolean)
  const [showAllLinkedInRoles, setShowAllLinkedInRoles] = useState(false)
  const sectionsToAdd = optimizations?.sectionsToAddFromResume || null
  const visibilityTricks = (optimizations?.visibilityTricks || []).filter(Boolean)
  const featuredWork = (optimizations?.featuredSectionRecommendations || []).filter(Boolean)

  const top3PinnedSkills = (
    optimizations?.top3PinnedSkills?.length
      ? optimizations.top3PinnedSkills
      : pinnedSkills
  )
    .filter(Boolean)
    .filter(isValidSkill)
    .map(formatSkillName)
    .sort((a, b) => (isConcreteTechSkill(b) ? 1 : 0) - (isConcreteTechSkill(a) ? 1 : 0))

  const finalTop3PinnedSkills = top3PinnedSkills.length >= 3 ? top3PinnedSkills : pinnedSkills

  const pinnedLowerSet = new Set((finalTop3PinnedSkills || []).map((s) => s.toLowerCase().trim()))
  const rawRec = optimizations?.recommendedSkillsToAdd?.length
    ? optimizations.recommendedSkillsToAdd
    : (cleanCandidateSkills.length > 0 ? cleanCandidateSkills : missingSkills)

  const deduplicatedRecommended = (rawRec || [])
    .filter(Boolean)
    .filter(isValidSkill)
    .map(formatSkillName)
    .filter((s) => !pinnedLowerSet.has(s.toLowerCase().trim()))

  // If deduplication leaves fewer than 3 skills, backfill with high-demand role skills not in pinned list:
  const roleBackfill = isSoftwareRole
    ? ['Docker', 'Kubernetes', 'CI/CD Pipelines', 'PostgreSQL', 'Microservices Architecture', 'AWS']
    : isDataRole
      ? ['Tableau', 'Snowflake', 'BigQuery', 'Excel', 'Data Modeling', 'dbt']
      : ['Cross-functional Leadership', 'Agile Methodologies', 'Strategic Planning', 'KPI Dashboards', 'Stakeholder Management']

  for (const skill of roleBackfill) {
    if (deduplicatedRecommended.length >= 5) break
    if (!pinnedLowerSet.has(skill.toLowerCase()) && !deduplicatedRecommended.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      deduplicatedRecommended.push(skill)
    }
  }

  const recommendedSkills = deduplicatedRecommended.sort((a, b) => (isConcreteTechSkill(b) ? 1 : 0) - (isConcreteTechSkill(a) ? 1 : 0))

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

    // Filter out false positive discrepancies where resume and linkedin claims are virtually identical (e.g. "Tempus" vs "Tempus", "Tempus Labs" vs "Tempus")
    const normResume = String(item.resumeClaim || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const normLi = String(item.linkedinClaim || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (normResume && normLi && normResume.length > 2 && normLi.length > 2) {
      if (normResume === normLi) continue
      if ((item.type?.includes('company') || item.title?.toLowerCase().includes('company')) &&
          (normResume.includes(normLi) || normLi.includes(normResume))) {
        continue
      }
    }

    seenDiscTitles.add(key)
    topDiscrepancies.push(item)
    if (topDiscrepancies.length === 4) break
  }

  // ── Consolidated Featured & Projects Showcase (Single Source of Truth) ─
  const projectShowcaseMap = new Map()

  const parseProjectItem = (proj, defaultAction) => {
    const rawTitle = safeText(proj.title || proj.name || 'Core Project')
    const titleParts = rawTitle.split('|')
    const cleanTitle = titleParts[0].trim()
    const techFromTitle = titleParts.length > 1
      ? titleParts[1].split(/[,/]+/).map((t) => t.trim()).filter(Boolean)
      : []

    const existingTech = Array.isArray(proj.technologies)
      ? proj.technologies
      : Array.isArray(proj.skills)
      ? proj.skills
      : []
    const mergedTech = Array.from(new Set([...existingTech, ...techFromTitle]))

    let description = safeText(proj.description || proj.rewrittenPitch || proj.summary || proj.details || '')
    if ((!description || description.includes('Showcases end-to-end technical implementation')) && proj.reason && !proj.reason.includes('Showcases end-to-end technical implementation')) {
      description = safeText(proj.reason)
    }
    if ((!description || description.includes('Showcases end-to-end technical implementation')) && Array.isArray(proj.bullets) && proj.bullets.length > 0) {
      description = proj.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean).join(' ')
    }
    if (!description || description.includes('Showcases end-to-end technical implementation')) {
      const canonicalProjs =
        reportData?.resume_agent?.canonicalResume?.projects ||
        resumeAnalysis?.data?.canonicalResume?.projects ||
        reportData?.resume_agent?.projects ||
        []
      const match = canonicalProjs.find((cp) => (cp.title || cp.name || '').toLowerCase().includes(cleanTitle.toLowerCase().slice(0, 6)))
      if (match?.bullets?.length) {
        description = match.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).filter(Boolean).join(' ')
      } else if (match?.description) {
        description = match.description
      } else {
        const bulletAudit = reportData?.resume_agent?.dashboard?.bulletAudit || reportData?.resume_agent?.bulletAudit || []
        const projBullets = bulletAudit.filter((b) => b.section === 'Projects' && (b.company || b.project || b.title || '').toLowerCase().includes(cleanTitle.toLowerCase().slice(0, 6)))
        if (projBullets.length > 0) {
          description = projBullets.map((b) => b.rewrite || b.text).filter(Boolean).join(' ')
        }
      }
    }
    // Clean any broken legacy templates
    description = description
      .replace(/platform leveraging .*? to solve core distributed workflow bottlenecks/gi, 'engineered with high-reliability distributed architecture.')
      .trim()

    // 3. Synthesize a clean 1-sentence description if still empty
    if (!description) {
      const techStr = mergedTech.length > 0 ? ` leveraging ${mergedTech.slice(0, 4).join(', ')}` : ''
      description = `Engineered ${cleanTitle}${techStr} to drive high-impact operational efficiency and verifiable workflow outcomes.`
    }

    return {
      title: cleanTitle,
      description,
      technologies: mergedTech,
      actionNote: proj.replaceNote || proj.actionAdvice || proj.callToAction || defaultAction,
    }
  }

  if (Array.isArray(sectionsToAdd?.projects)) {
    sectionsToAdd.projects.forEach((proj) => {
      const parsed = parseProjectItem(proj, 'Pin to Featured section & add under LinkedIn Projects')
      const key = parsed.title.toLowerCase().trim()
      if (!key) return
      projectShowcaseMap.set(key, parsed)
    })
  }

  if (Array.isArray(featuredWork)) {
    featuredWork.forEach((fw) => {
      const parsed = parseProjectItem(fw, 'Pin to Featured section on LinkedIn')
      const key = parsed.title.toLowerCase().trim()
      if (!key) return
      if (projectShowcaseMap.has(key)) {
        const existing = projectShowcaseMap.get(key)
        if (!existing.description && parsed.description) existing.description = parsed.description
        if (parsed.actionNote && !existing.actionNote) existing.actionNote = parsed.actionNote
        if (parsed.technologies.length > 0) {
          existing.technologies = Array.from(new Set([...existing.technologies, ...parsed.technologies]))
        }
      } else {
        projectShowcaseMap.set(key, parsed)
      }
    })
  }

  const consolidatedProjects = Array.from(projectShowcaseMap.values()).map((p) => {
    if (!p.description || !p.description.trim()) {
      const techStr = p.technologies.length > 0 ? ` leveraging ${p.technologies.slice(0, 4).join(', ')}` : ''
      return {
        ...p,
        description: `Engineered ${p.title}${techStr} to drive high-impact operational efficiency and verifiable workflow outcomes.`,
      }
    }
    return p
  })
  const hasCertifications = Array.isArray(sectionsToAdd?.certifications) && sectionsToAdd.certifications.length > 0

  // ── Deterministic Role-Accurate Visibility Tricks (Guarantees Page 24 & Page 25 consistency)
  const resolvedTargetRole = targetRole || 'Data Analyst'
  const isDataAnalystRole = /data\s+analyst|business\s+intelligence|bi\s+analyst|analytics/i.test(resolvedTargetRole)

  const baseTitle = resolvedTargetRole.replace(/^(?:Senior|Lead|Staff|Principal|Junior|Associate|Mid-Level)\s+/i, '').trim() || resolvedTargetRole
  const otwTitles = isDataAnalystRole
    ? ['Data Analyst', 'Senior Data Analyst', 'Business Intelligence Analyst', 'Product Data Analyst', 'Analytics Specialist']
    : /data\s+scientist|machine\s+learning|ai\s+engineer|ml\s+engineer/i.test(resolvedTargetRole)
    ? [
        resolvedTargetRole,
        `Senior ${baseTitle}`,
        'Applied AI / ML Engineer',
        'Lead Data Scientist',
        `Staff ${baseTitle}`,
      ]
    : /data\s+engineer/i.test(resolvedTargetRole)
    ? ['Data Engineer', 'Senior Data Engineer', 'Lead Data Engineer', 'Analytics & BigQuery Data Engineer', 'Cloud Data Architect']
    : [
        resolvedTargetRole,
        `Senior ${baseTitle}`,
        `Lead ${baseTitle}`,
        `${baseTitle} II`,
        `Principal ${baseTitle}`,
      ]

  const cleanConcreteCandidateSkills = (
    Array.isArray(top3PinnedSkills) && top3PinnedSkills.length >= 3
      ? top3PinnedSkills
      : Array.isArray(pinnedSkills) && pinnedSkills.length >= 3
      ? pinnedSkills
      : Array.isArray(coreSkillList) && coreSkillList.length >= 3
      ? coreSkillList
      : []
  ).filter(isConcreteTechSkill)

  const top3SkillsForTricks = cleanConcreteCandidateSkills.length >= 3
    ? cleanConcreteCandidateSkills.slice(0, 3)
    : top3PinnedSkills.length >= 3
    ? top3PinnedSkills.slice(0, 3)
    : isDataAnalystRole
    ? ['SQL', 'Power BI', 'Python']
    : ['React', 'Node.js', 'TypeScript']

  const hardCandidateSkills = Array.from(new Set([
    ...top3SkillsForTricks,
    ...recommendedSkills.filter(isConcreteTechSkill),
  ])).filter(isConcreteTechSkill).slice(0, 4)

  const booleanRolePrefix = isDataAnalystRole
    ? '("Data Analyst" OR "Business Intelligence Analyst")'
    : `("${resolvedTargetRole}")`
  const booleanQueryStr = `${booleanRolePrefix} AND (${hardCandidateSkills.map((s) => `"${s}"`).join(' OR ')})`

  const enforcedVisibilityTricks = [
    {
      category: 'Open to Work Titles',
      trick: '1. Set 5 Exact Job Titles in "Open to Work"',
      advice: 'LinkedIn Recruiter search filters match candidate "Job Titles" strictly. Add these 5 exact titles to your private Open to Work preferences:',
      items: otwTitles,
    },
    {
      category: 'Top 3 Pinned Skills',
      trick: '2. Pin Your Top 3 Skills to the Top of Skills Section',
      advice: 'Recruiters see the first 3 pinned skills immediately on mobile and search cards. Pin these 3 core skills to maximize recruiter match score:',
      items: top3SkillsForTricks,
    },
    {
      category: 'Recruiter Boolean String',
      trick: '3. Optimize for Recruiter Boolean Search Strings',
      advice: 'Technical recruiters find candidates using exact boolean operators. Ensure your profile headline and about section match this search query:',
      items: [booleanQueryStr],
    },
    {
      category: 'Featured Media Architecture',
      trick: '4. Showcase High-Scale Technical Artifacts',
      advice: 'Recruiters and hiring managers spend 80% of their review time on evidence of real system delivery. Pin high-impact technical artifacts directly to your profile top.',
      items: [`${top3SkillsForTricks.join(' + ')} Portfolio & Case Study`, 'Live Demo URL'],
    },
  ]


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

  const rawScorecard = (linkedinAgent && typeof linkedinAgent.score === 'number' && linkedinAgent.dashboard)
    ? linkedinAgent.dashboard
    : (linkedinAgent && typeof linkedinAgent.score === 'number')
    ? linkedinAgent
    : null

  const topSkillStr = (top3SkillsForTricks && top3SkillsForTricks.length > 0)
    ? top3SkillsForTricks.join(', ')
    : (isDataAnalystRole ? 'SQL, Power BI, and Python' : 'React, TypeScript, and Node.js')

  const fallbackScorecard = {
    score: reportData?.score_breakdown?.linkedin?.score || 68,
    grade: reportData?.score_breakdown?.linkedin?.grade || 'C',
    gradeLabel: 'Developing',
    grades: {
      headline: { score: 68, grade: 'C', label: 'Headline SEO' },
      about: { score: 60, grade: 'C', label: 'About Story' },
      skills: { score: 70, grade: 'C', label: 'Pinned Skills' },
      network: { score: 65, grade: 'C', label: 'Social Reach' },
    },
    checks: [
      { id: 'li_headline', label: 'Headline Keyword Density', detail: 'Needs target role title + top 3 technical tools', status: 'warn' },
      { id: 'li_about', label: 'Story-Driven About Section', detail: 'Missing quantified hook and core stack keywords', status: 'fail' },
      { id: 'li_skills', label: 'Top 3 Pinned Technical Skills', detail: `Pin ${topSkillStr} to top of skills list`, status: 'fail' },
    ],
    summary: 'Profile is unlinked or blank, missing critical recruiter search indexing keywords and social proof.',
  }

  // Ensure grades includes numeric score values and checks uses { id, label, detail, status } (NOT { name })
  const effectiveScorecard = (() => {
    if (!rawScorecard) return fallbackScorecard

    const normalizedGrades = {}
    for (const [key, g] of Object.entries(rawScorecard.grades || {})) {
      if (!g) continue
      const gScore = typeof g.score === 'number' ? g.score : (g.grade === 'A' ? 90 : g.grade === 'B' ? 75 : g.grade === 'C' ? 60 : 45)
      normalizedGrades[key] = {
        ...g,
        label: g.label || key.toUpperCase(),
        score: gScore,
        grade: g.grade || (gScore >= 85 ? 'A' : gScore >= 70 ? 'B' : gScore >= 55 ? 'C' : 'D'),
      }
    }

    const normalizedChecks = Array.isArray(rawScorecard.checks) && rawScorecard.checks.length > 0
      ? rawScorecard.checks.map((c, i) => ({
          id: c.id || `li_chk_${i}`,
          label: c.label || c.name || c.title || 'Profile Check',
          detail: c.detail || c.description || c.reason || '',
          status: c.status || 'pass',
        }))
      : fallbackScorecard.checks

    return {
      ...rawScorecard,
      grades: Object.keys(normalizedGrades).length > 0 ? normalizedGrades : fallbackScorecard.grades,
      checks: normalizedChecks,
    }
  })()

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

      {/* Amber alert if blank/unlinked profile */}
      {isBlankProfile && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs space-y-1 mb-6">
          <div className="font-bold text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
            ⚠️ Blank / Unlinked LinkedIn Profile Detected (Primary Bottleneck)
          </div>
          <p>
            Your profile is currently missing or unlinked, which directly causes your Phase 1 recruiter screening drop-off.
            Copy and paste the pre-engineered headline, story-driven about section, and pinned skills below to activate your All-Star profile today.
          </p>
        </div>
      )}

      {/* ── 1. Scorecard at the top ────────────────────────────────────────── */}
      <ResumeScoreCard
        dashboard={effectiveScorecard}
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
                {(() => {
                  const renderRole = (item, idx) => {
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
                              <span className="text-[var(--text-secondary)]">
                                {safeText(item.linkedinGap).includes('is missing or unlinked on your LinkedIn profile')
                                  ? `LinkedIn Optimization Focus: Align vendor/client naming ('${safeText(item.company)}') with your LinkedIn experience entry and replace task-heavy descriptions with the quantified executive bullets below.`
                                  : safeText(item.linkedinGap)}
                              </span>
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
                  }

                  const primaryRole = experienceUpgrades[0]
                  const remainingRoles = experienceUpgrades.slice(1)

                  return (
                    <>
                      {primaryRole && renderRole(primaryRole, 0)}

                      {remainingRoles.length > 0 && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAllLinkedInRoles(!showAllLinkedInRoles)}
                            className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-card)] text-xs font-semibold text-[var(--primary)] flex items-center justify-center gap-2 transition-all cursor-pointer print:hidden"
                          >
                            {showAllLinkedInRoles ? (
                              <>Show Less (Display Latest Role Only)</>
                            ) : (
                              <>+ View LinkedIn Rewrites for {remainingRoles.length} Previous Role{remainingRoles.length > 1 ? 's' : ''}</>
                            )}
                          </button>
                          <div className={showAllLinkedInRoles ? 'space-y-4 pt-4' : 'hidden print:hidden'}>
                            {remainingRoles.map((item, relIdx) => renderRole(item, relIdx + 1))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ── Top 3 Pinned Skills Badges ─────────────────────────────────── */}
          {finalTop3PinnedSkills.length > 0 && (
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
                {finalTop3PinnedSkills.map((skill, idx) => {
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
                        className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] space-y-3 text-xs flex flex-col justify-between break-inside-avoid print-card"
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
                            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--primary-light)] border border-[var(--primary)]/20 text-[11px] text-[var(--text-primary)] break-inside-avoid">
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
              {enforcedVisibilityTricks.map((trick, idx) => (
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
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </section>
  )
}
