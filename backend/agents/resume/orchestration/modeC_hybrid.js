/**
 * Mode C: Hybrid Deterministic + Reasoning — Career GPS Resume Agent V3.2
 *
 * Implements Production Default Orchestration:
 * Precomputes all objective, deterministic checks in code:
 * - Quantified bullet counts & density
 * - Tool dump candidates & technology counts
 * - Contact detail merge anomalies
 * - Target JD keyword overlap (evidenced vs NOT_EVIDENCED_IN_RESUME)
 * - Sampled market frequency ratios & evidence gaps
 * - Section presence & date chronology
 *
 * Injects a structured "Deterministic Pre-Audit Dossier" into ONE strong
 * recruiter-level reasoning call focused strictly on high-conviction diagnosis,
 * prioritization, full 5-part Google XYZ rewrites with calibrated metrics, and recruiter synthesis.
 */

import crypto from 'crypto'
import { serializeResumeForLLM } from '../resumeAgent.inputSerializer.js'
import { ResumeAgentValidator } from '../resumeAgent.validator.js'
import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { resolveTaskPolicy } from './taskPolicy.js'
import { extractSkillsFromJd } from '../market/jdNormalizer.js'
import { analyzeTimeline } from '../signals/timelineAnalyzer.js'
import { ContextCompiler } from '../../../ai/context/contextCompiler.js'
import { sanitizeSingleAddPlaceholder, cleanRewriteText, isLazySuffixAppend, buildFivePartPlaybookRewrite, isTrueQuantified, toPastTense, applyLightVerbFix, isWordForWordIdentical } from '../scoring/resumeScorecard.js'
import { toPresentTense } from '../signals/patterns.js'
import { synthesizeWhyItWorks } from '../../../utils/humanizeReportCopy.js'
import { getDynamicFewShotExamples } from '../../../services/promptExampleService.js'
import { IMPACT_POLICY_INSTRUCTIONS, normalizeMetricOpportunities, generateFallbackMetricOpportunities } from '../impact/impactContract.js'
import { replaceUnverifiedNumericTokens, buildBulletSourceTokens, buildSourceFactTokens } from '../validation/claimValidator.js'

export { cleanRewriteText, isLazySuffixAppend, buildFivePartPlaybookRewrite, isWordForWordIdentical }
export const MODE_C_NAME = 'hybrid_deterministic_reasoning'

export function generateDomainCalibratedSummary(targetRoleOrOptions, experiences = [], skills = [], missingSkills = [], currentSummary = '') {
  let targetRole = targetRoleOrOptions
  let yearsOfExperience = null
  if (targetRoleOrOptions && typeof targetRoleOrOptions === 'object' && !Array.isArray(targetRoleOrOptions)) {
    targetRole = targetRoleOrOptions.targetRole || targetRoleOrOptions.role
    experiences = targetRoleOrOptions.experiences || targetRoleOrOptions.experience || []
    skills = targetRoleOrOptions.skills || targetRoleOrOptions.skillsList || []
    missingSkills = targetRoleOrOptions.missingSkills || []
    currentSummary = targetRoleOrOptions.currentSummary || ''
    yearsOfExperience = targetRoleOrOptions.yearsOfExperience || targetRoleOrOptions.years_of_experience || null
  }

  const role = targetRole || (experiences[0]?.role) || 'Experienced Professional'
  const lowerRole = role.toLowerCase()
  const isHealthcare = /nurse|nursing|clinical|patient|hospital|physician|doctor|medical|healthcare|hipaa|ehr|epic\b|triage/i.test(lowerRole)
  const isFinance = /finance|financial|fp&a|accounting|accountant|audit|gaap|cpa\b|banking|treasury|controller|budget|p&l/i.test(lowerRole)
  const isSales = /sales|account\s+exec|quota|pipeline|bdr\b|sdr\b|business\s+dev|client\s+exec|commercial/i.test(lowerRole)
  const isData = /data|analyst|analytics|bi\b|business\s+intelligence|tableau|power\s*bi|snowflake|dbt|sql|bigquery|etl|data\s*warehouse|reporting/i.test(lowerRole)

  const skillsList = Array.isArray(skills) 
    ? skills 
    : (skills && typeof skills === 'object')
      ? Object.values(skills).flat()
      : []

  // Extract real tools from candidate's currentSummary and experiences if available
  const existingTools = []
  if (currentSummary && typeof currentSummary === 'string') {
    const techRegex = /\b(?:React|Angular|Vue|TypeScript|JavaScript|Node\.?js|Next\.?js|Java|Spring Boot|Python|Django|FastAPI|AWS|Azure|GCP|Docker|Kubernetes|SQL|PostgreSQL|MySQL|MongoDB|Redis|Kafka|GraphQL|REST|CI\/CD|Terraform|HTML5?|CSS3?|Tailwind|Jasmine|Karma|Jest|Cypress|WCAG|Microservices|RAG|Epic|EHR|EMR|HIPAA|SAP|ERP|Excel|Tableau|Power\s*BI|Snowflake|BigQuery|dbt|Salesforce|CRM|GAAP)\b/gi
    let m
    while ((m = techRegex.exec(currentSummary)) !== null) {
      existingTools.push(m[0])
    }
  }

  const experienceTools = []
  for (const exp of experiences) {
    for (const b of exp.bullets || []) {
      const text = typeof b === 'string' ? b : b?.text || ''
      const techRegex = /\b(?:Tableau|Power\s*BI|Snowflake|BigQuery|dbt|SQL|Python|Excel|R\b|Looker|Metabase|PostgreSQL|MySQL|Redshift|Airflow|Pandas|NumPy|ETL|SSIS|SSAS|Databricks|Spark|React|Angular|Vue|TypeScript|JavaScript|Node\.?js|Next\.?js|Java|Spring Boot|AWS|Azure|GCP|Docker|Kubernetes|Kafka)\b/gi
      let m
      while ((m = techRegex.exec(text)) !== null) {
        experienceTools.push(m[0])
      }
    }
  }

  const combinedSkills = Array.from(new Set([
    ...skillsList.map((s) => typeof s === 'string' ? s : s?.name || s?.skill || ''),
    ...existingTools,
    ...experienceTools,
  ])).filter(Boolean)

  const isDataCandidate = isData || combinedSkills.some((s) => /sql|tableau|power\s*bi|snowflake|bigquery|dbt|analytics|bi\b|data/i.test(String(s)))

  let defaultToolFallback = 'modern technical systems and operational best practices'
  if (isHealthcare) defaultToolFallback = 'patient care management, clinical protocols, and EHR systems'
  else if (isFinance) defaultToolFallback = 'financial modeling, GAAP compliance, and ERP systems'
  else if (isSales) defaultToolFallback = 'enterprise prospecting, pipeline management, and CRM platforms'
  else if (isDataCandidate) defaultToolFallback = 'SQL, business intelligence platforms, BigQuery/Snowflake data warehousing, and automated ETL pipelines'
  else defaultToolFallback = 'enterprise software architecture, system scalability, and cloud technologies'

  const topTools = combinedSkills.slice(0, 8).join(', ') || defaultToolFallback
  const primaryCompany = experiences[0]?.company || experiences[0]?.employer || ''

  // Look for any verified metric or project from experiences
  let topWin = ''
  for (const exp of experiences) {
    for (const b of exp.bullets || []) {
      const text = typeof b === 'string' ? b : b?.text || ''
      if (/\d+%?|\$\d+/i.test(text) && text.length > 25) {
        topWin = text.replace(/^[•\-*▪–—·\s]+/, '').trim()
        break
      }
    }
    if (topWin) break
  }

  const yoeFragment = yearsOfExperience ? ` with ${yearsOfExperience} of experience` : ''
  const sentence1 = `${role}${yoeFragment} specializing in ${topTools}.`
  let sentence2 = ''
  let sentence3 = ''

  if (isHealthcare) {
    sentence2 = topWin
      ? `Proven track record of clinical care excellence: ${topWin.replace(/\.$/, '')}.`
      : `Demonstrated track record of delivering compassionate, high-acuity patient care, maintaining stringent clinical compliance, and optimizing patient outcomes${primaryCompany ? ` at ${primaryCompany}` : ''}.`
    sentence3 = missingSkills && missingSkills.length > 0
      ? `Coordinates interdisciplinary patient care with a strong focus on clinical documentation, patient safety, and utilization of ${missingSkills.slice(0, 2).join(' and ')}.`
      : `Coordinates interdisciplinary care delivery with a strong commitment to patient safety, HIPAA regulatory adherence, and evidence-based clinical workflows.`
  } else if (isFinance) {
    sentence2 = topWin
      ? `Proven track record of financial modeling impact: ${topWin.replace(/\.$/, '')}.`
      : `Demonstrated track record of delivering rigorous financial modeling, optimizing variance analysis, and strengthening corporate reporting accuracy${primaryCompany ? ` at ${primaryCompany}` : ''}.`
    sentence3 = missingSkills && missingSkills.length > 0
      ? `Drives financial operational excellence with focus on GAAP compliance, budget forecasting, and integration of ${missingSkills.slice(0, 2).join(' and ')}.`
      : `Drives financial operational excellence with strong focus on budgeting accuracy, GAAP compliance, and strategic capital allocation.`
  } else if (isSales) {
    sentence2 = topWin
      ? `Proven track record of commercial quota attainment: ${topWin.replace(/\.$/, '')}.`
      : `Demonstrated track record of exceeding revenue quotas, accelerating enterprise pipeline velocity, and negotiating high-value customer contracts${primaryCompany ? ` at ${primaryCompany}` : ''}.`
    sentence3 = missingSkills && missingSkills.length > 0
      ? `Drives enterprise pipeline expansion with focus on consultative discovery, customer relationship management, and deployment of ${missingSkills.slice(0, 2).join(' and ')}.`
      : `Drives sustained commercial growth with strong focus on consultative solution selling, client relationship cultivation, and high-impact deal execution.`
  } else if (isDataCandidate) {
    sentence2 = topWin
      ? `Proven track record of data analytics delivery: ${topWin.replace(/\.$/, '')}.`
      : `Demonstrated track record of transforming raw data into high-leverage business intelligence, automating ETL pipelines, and optimizing analytical reporting${primaryCompany ? ` at ${primaryCompany}` : ''}.`
    sentence3 = missingSkills && missingSkills.length > 0
      ? `Drives data-informed decision-making with focus on data modeling integrity, query performance optimization, and integration of ${missingSkills.slice(0, 2).join(' and ')}.`
      : `Drives data-informed decision-making with strong focus on data modeling integrity, query performance optimization, and cross-functional reporting.`
  } else {
    sentence2 = topWin
      ? `Proven track record of engineering impact: ${topWin.replace(/\.$/, '')}.`
      : `Demonstrated track record of delivering resilient, high-availability architecture and modernizing production software${primaryCompany ? ` at ${primaryCompany}` : ''}.`
    sentence3 = missingSkills && missingSkills.length > 0
      ? `Drives end-to-end technical execution with focus on scalable system performance, code quality, and integration of ${missingSkills.slice(0, 2).join(' and ')}.`
      : `Drives end-to-end technical execution with strong focus on performance optimization, robust automated testing, and production scale.`
  }

  return `${sentence1} ${sentence2} ${sentence3}`.trim()
}

/**
 * Computes deterministic dossier of ground-truth checks prior to reasoning call.
 */
export function buildDeterministicDossier({
  canonicalResume,
  resumeFacts,
  signals,
  precomputedSignals,
  targetJobDescription,
  marketProfile,
  marketContext,
}) {
  const dossier = {
    quantification: {
      totalBullets: precomputedSignals?.quantificationRollup?.totalBullets || 0,
      quantifiedBullets: precomputedSignals?.quantificationRollup?.quantifiedBullets || 0,
      density: precomputedSignals?.quantificationRollup?.density || 0,
      unquantifiedBulletIds: [],
    },
    toolDumps: [],
    contactMergeAnomaly: precomputedSignals?.contactMerge?.isContactMerged || false,
    targetJdOverlap: {
      requestedSkills: [],
      evidencedSkills: [],
      unverifiedSkills: [],
    },
    marketEvidenceGaps: [],
  }

  // 1. Unquantified & Tool Dump candidates from bulletSignals
  if (precomputedSignals?.bulletSignals) {
    for (const [bulletId, sig] of Object.entries(precomputedSignals.bulletSignals)) {
      if (!sig.hasQuantifier) {
        dossier.quantification.unquantifiedBulletIds.push(bulletId)
      }
      if (sig.isToolDumpCandidate) {
        dossier.toolDumps.push({ bulletId, techCount: sig.technologyCount })
      }
    }
  }

  // 2. Deterministic Target JD overlap
  if (targetJobDescription) {
    const jdSkills = extractSkillsFromJd(targetJobDescription)
    dossier.targetJdOverlap.requestedSkills = jdSkills

    const resumeSkillSet = new Set((resumeFacts?.skills || []).map((s) => s.toLowerCase()))
    const allBulletText = (canonicalResume?.experience || [])
      .flatMap((e) => e.bullets || [])
      .map((b) => b.text || '')
      .join(' ')
      .toLowerCase()

    jdSkills.forEach((skill) => {
      const lower = skill.toLowerCase()
      const evidenced =
        resumeSkillSet.has(lower) ||
        new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(allBulletText)

      if (evidenced) {
        dossier.targetJdOverlap.evidencedSkills.push(skill)
      } else {
        dossier.targetJdOverlap.unverifiedSkills.push(skill)
      }
    })
  }

  // 3. Deterministic Market Evidence Gaps from active market context
  if (marketContext && Array.isArray(marketContext.marketEvidenceGaps)) {
    const sampleSize = marketContext.marketSampleSize || 15
    dossier.marketEvidenceGaps = marketContext.marketEvidenceGaps.map((g) => ({
      skill: g.skill,
      frequency: `${g.frequencyCount || Math.round((g.marketFrequency || 0) * sampleSize)}/${sampleSize} JDs`,
      status: 'NOT_EVIDENCED_IN_RESUME',
    }))
  }

  // 4. Deterministic Timeline Facts
  const timeline = signals?.timeline || analyzeTimeline(canonicalResume)
  const totalExpYrs = canonicalResume?.totalExperienceYears || timeline?.careerDuration?.totalYears || 0
  const floorYrs = Math.floor(totalExpYrs)
  const totalExpText = canonicalResume?.years_of_experience || (floorYrs >= 1 ? `${floorYrs}+ years` : `${timeline?.careerDuration?.totalMonths || 0} months`)
  dossier.timeline = {
    totalExperienceYears: totalExpYrs,
    yearsOfExperience: totalExpText,
    totalExperienceMonths: timeline?.careerDuration?.totalMonths || 0,
    formattedDuration: totalExpText || timeline?.careerDuration?.formatted || '0 months',
    isCurrentlyEmployed: timeline?.currentRole?.isCurrentlyEmployed || false,
    currentRole: timeline?.currentRole || null,
    careerGaps: timeline?.careerGaps || [],
    promotions: timeline?.promotions || [],
    itemCount: Array.isArray(canonicalResume?.experience) ? canonicalResume.experience.length : 0,
  }

  // 5. Deterministic Certifications
  dossier.certifications = Array.isArray(canonicalResume?.certifications) ? canonicalResume.certifications : []

  // 6. Professional Summary
  dossier.summary = canonicalResume?.summary
    ? (typeof canonicalResume.summary === 'string' ? canonicalResume.summary : canonicalResume.summary.text || null)
    : null

  return dossier
}

/**
 * Normalizes minor model structural variations before validation and consumption.
 */
export function sanitizeModeCOutput(analysis, state = {}) {
  if (!analysis || typeof analysis !== 'object') return analysis

  // 1. dashboard normalization (required by contract, score must be null)
  if (!('dashboard' in analysis)) {
    analysis.dashboard = null
  }

  // 2. candidateSnapshot normalization
  if (!analysis.candidateSnapshot) {
    analysis.candidateSnapshot = {
      name: 'Candidate',
      targetRole: 'Software Professional',
      topStrengths: (analysis.strengths || []).slice(0, 3).map((s) => s.title),
    }
  }

  const verifiedYoE = state.canonicalResume?.years_of_experience || state.dossier?.timeline?.yearsOfExperience || (state.canonicalResume?.totalExperienceYears ? `${Math.floor(state.canonicalResume.totalExperienceYears)}+ years` : null)
  if (verifiedYoE) {
    if (!analysis.candidateSnapshot.yearsOfExperience) {
      analysis.candidateSnapshot.yearsOfExperience = verifiedYoE
    }
    if (analysis.candidateSnapshot.experienceLevel && /5\+\s*years/i.test(analysis.candidateSnapshot.experienceLevel) && verifiedYoE !== '5+ years') {
      analysis.candidateSnapshot.experienceLevel = analysis.candidateSnapshot.experienceLevel.replace(/5\+\s*years/gi, verifiedYoE)
    }
  }

  // 3. overallReview normalization
  if (typeof analysis.overallReview === 'string') {
    analysis.overallReview = {
      summary: analysis.overallReview,
      tone: 'conversational',
    }
  } else if (analysis.overallReview && typeof analysis.overallReview === 'object') {
    if (!analysis.overallReview.summary && typeof analysis.overallReview.text === 'string') {
      analysis.overallReview.summary = analysis.overallReview.text
    }
    if (!analysis.overallReview.tone) {
      analysis.overallReview.tone = 'conversational'
    }
  }

  // 4. strengths evidence normalization
  if (Array.isArray(analysis.strengths)) {
    analysis.strengths.forEach((str) => {
      if (str && str.evidence && !Array.isArray(str.evidence) && typeof str.evidence === 'object') {
        str.evidence = [str.evidence]
      }
      if (str && !str.description && str.whyItWorks) {
        str.description = str.whyItWorks
      }
    })
  }

  // 5. issues evidence & metricDiscoveryQuestions normalization
  if (Array.isArray(analysis.issues)) {
    analysis.issues.forEach((iss) => {
      if (iss && !iss.evidence && (iss.bulletId || iss.originalText)) {
        iss.evidence = [{
          section: 'experience',
          itemId: iss.itemId || (iss.bulletId?.startsWith('exp_') ? iss.bulletId.slice(0, 7) : (iss.bulletId?.startsWith('proj_') ? iss.bulletId.slice(0, 8) : 'exp_001')),
          bulletId: iss.bulletId || 'exp_001_b01',
          originalText: iss.originalText || '',
        }]
      } else if (iss && iss.evidence && !Array.isArray(iss.evidence) && typeof iss.evidence === 'object') {
        iss.evidence = [iss.evidence]
      }
      if (iss && !Array.isArray(iss.metricDiscoveryQuestions)) {
        iss.metricDiscoveryQuestions = []
      }
      if (iss?.diagnosis && /participle\s*\(['"][^'"]+['"]\)/i.test(iss.diagnosis)) {
        const bulletText = iss.evidence?.[0]?.originalText || iss.originalText || ''
        const matchIng = bulletText.trim().replace(/^[•\-*▪–—\s]+/, '').match(/^([a-zA-Z]+ing)\b/i)
        if (matchIng) {
          iss.diagnosis = iss.diagnosis.replace(/participle\s*\(['"][^'"]+['"]\)/i, `participle ('${matchIng[1]}')`)
        }
      }
      const origText = iss.evidence?.[0]?.originalText || iss.originalText || ''
      const bulletId = iss.evidence?.[0]?.bulletId || iss.bulletId || 'exp_001_b01'
      const effectiveRole = analysis.candidateSnapshot?.targetRole || state.targetRole || ''
      const bulletSourceTokens = buildBulletSourceTokens(state.canonicalResume, bulletId, null, origText)
      if (iss?.correctedText) {
        iss.correctedText = cleanRewriteText(iss.correctedText)
        iss.correctedText = replaceUnverifiedNumericTokens(iss.correctedText, bulletSourceTokens, state.canonicalResume, {
          bulletId,
          sourceText: origText,
        })
      }
      if (iss?.rewrite) {
        iss.rewrite = cleanRewriteText(iss.rewrite)
        iss.rewrite = replaceUnverifiedNumericTokens(iss.rewrite, bulletSourceTokens, state.canonicalResume, {
          bulletId,
          sourceText: origText,
        })
      }
      iss.metricOpportunities = normalizeMetricOpportunities(
        iss.metricOpportunities || iss.discoveryOpportunities || generateFallbackMetricOpportunities(origText, effectiveRole)
      )
      const isOrigQuant = isTrueQuantified(origText)
      iss.metricSource = isOrigQuant ? 'resume_verified' : 'grounded_qualitative'
      iss.metricPrompt = !isOrigQuant ? 'Confirm real impact (e.g., hours saved/week or % turnaround gain)' : null
    })
  } else {
    analysis.issues = []
  }

  // 5b. bulletRewrites normalization (supporting V4 readyToUseRewrite & wovenKeywords)
  if (Array.isArray(analysis.bulletRewrites)) {
    const effectiveRole = analysis.candidateSnapshot?.targetRole || state.targetRole || ''
    analysis.bulletRewrites = analysis.bulletRewrites
      .filter((rw) => rw && typeof rw === 'object' && (rw.bulletId || rw.originalText || rw.original || rw.text) && (rw.rewrittenText || rw.readyToUseRewrite || rw.rewritten || rw.rewrite))
      .map((rw) => {
        const origText = rw.original || rw.originalText || rw.text || ''
        const bulletId = rw.bulletId || rw.id
        const bulletSourceTokens = buildBulletSourceTokens(state.canonicalResume, bulletId, null, origText)
        let cleanedText = cleanRewriteText(rw.rewrittenText || rw.readyToUseRewrite || rw.rewritten || rw.rewrite)
        cleanedText = replaceUnverifiedNumericTokens(cleanedText, bulletSourceTokens, state.canonicalResume, {
          bulletId,
          sourceText: origText,
        })
        const whyItWorks = rw.whyItWorks || rw.why || synthesizeWhyItWorks(origText, cleanedText)
        const metricOpps = normalizeMetricOpportunities(
          rw.metricOpportunities || rw.discoveryOpportunities || generateFallbackMetricOpportunities(origText, effectiveRole)
        )
        const isOrigQuant = isTrueQuantified(origText)
        const metricSource = isOrigQuant ? 'resume_verified' : 'grounded_qualitative'
        const metricPrompt = !isOrigQuant ? 'Confirm real impact (e.g., hours saved/week or % turnaround gain)' : null
        return {
          ...rw,
          original: origText,
          originalText: origText,
          rewritten: cleanedText,
          rewrittenText: cleanedText,
          readyToUseRewrite: cleanedText,
          critique: rw.critique || rw.reason || rw.diagnosis || '',
          whyItWorks,
          why: whyItWorks,
          metricSource,
          metricPrompt,
          metricOpportunities: metricOpps,
          fiveParts: rw.fiveParts || rw.fivePartFlags || null,
          impactScore: rw.impactScore || (rw.status === 'pass' ? 90 : 60),
          status: rw.status || 'warn',
          wovenKeywords: Array.isArray(rw.wovenKeywords) ? rw.wovenKeywords : (rw.wovenKeyword ? [rw.wovenKeyword] : []),
        }
      })
  } else {
    analysis.bulletRewrites = []
  }

  // Helper: Strip unrendered template variables like {{targetRole}}
  const cleanTokens = (str) => {
    if (!str || typeof str !== 'string') return str
    return str.replace(/\{\{[A-Za-z0-9_]+\}\}/g, '').trim()
  }

  // 5c. executiveDiagnosis normalization (V4 Senior Recruiter Roast)
  if (analysis.executiveDiagnosis && typeof analysis.executiveDiagnosis === 'object') {
    analysis.overallReview = analysis.overallReview || {}
    if (!analysis.overallReview.summary && analysis.executiveDiagnosis.sixSecondRecruiterVerdict) {
      analysis.overallReview.summary = cleanTokens(analysis.executiveDiagnosis.sixSecondRecruiterVerdict)
    }
    analysis.overallReview.strongestAdvantage = cleanTokens(analysis.executiveDiagnosis.strongestAdvantage)
    analysis.overallReview.primaryBottleneck = cleanTokens(analysis.executiveDiagnosis.primaryBottleneck)
    analysis.overallReview.sixSecondRecruiterVerdict = cleanTokens(analysis.executiveDiagnosis.sixSecondRecruiterVerdict)
  }

  // 5d. topThreePrioritizedActions normalization (V4 Actions)
  if (Array.isArray(analysis.topThreePrioritizedActions) && analysis.topThreePrioritizedActions.length > 0) {
    if (!Array.isArray(analysis.priorityActions) || analysis.priorityActions.length === 0) {
      analysis.priorityActions = analysis.topThreePrioritizedActions.map((act, i) => ({
        priority: act.priority || (i + 1),
        title: cleanTokens(act.title || 'Prioritize impact'),
        action: cleanTokens(act.whatToDo || act.action || 'Strengthen technical outcome'),
        whyItMatters: cleanTokens(act.whyItMatters || ''),
        impact: cleanTokens(act.impact || ''),
      }))
    }
  }

  // 5e. executiveSummaryRewrite normalization
  if (analysis.executiveSummaryRewrite && typeof analysis.executiveSummaryRewrite === 'string') {
    analysis.summaryOptimization = analysis.summaryOptimization || {}
    analysis.summaryOptimization.rewrittenSummary = cleanTokens(analysis.executiveSummaryRewrite)
  }

  // 5f. Companion Interview Talking Points & Keyword Transparency Ledger
  if (state.wovenBulletRewrites?.keywordTransparencyLedger) {
    analysis.keywordTransparencyLedger = state.wovenBulletRewrites.keywordTransparencyLedger
    analysis.interviewTalkingPoints = state.wovenBulletRewrites.interviewTalkingPoints
  } else if (state.keywordWeaverResults?.keywordTransparencyLedger) {
    analysis.keywordTransparencyLedger = state.keywordWeaverResults.keywordTransparencyLedger
    analysis.interviewTalkingPoints = state.keywordWeaverResults.interviewTalkingPoints
  }

  // 5c. bulletUpgrades normalization
  const effectiveRole = analysis.candidateSnapshot?.targetRole || state.targetRole || ''
  analysis.bulletUpgrades = Array.isArray(analysis.bulletUpgrades)
    ? analysis.bulletUpgrades.map((upg) => {
        let reason = upg.reason
        if (!reason || reason === 'Clear, specific, no defects found' || reason.startsWith('Clear, specific')) {
          reason = 'Lacks quantified business outcomes and mechanism specificity required for senior recruiter scan'
        }
        if (reason && /participle\s*\(['"][^'"]+['"]\)/i.test(reason)) {
          const matchIng = (upg.originalText || '').trim().replace(/^[•\-*▪–—\s]+/, '').match(/^([a-zA-Z]+ing)\b/i)
          if (matchIng) {
            reason = reason.replace(/participle\s*\(['"][^'"]+['"]\)/i, `participle ('${matchIng[1]}')`)
          }
        }
        let rwText = cleanRewriteText(upg.rewrittenText)
        const bulletSourceTokens = buildBulletSourceTokens(state.canonicalResume, upg.bulletId, null, upg.originalText)
        rwText = replaceUnverifiedNumericTokens(rwText, bulletSourceTokens, state.canonicalResume, {
          bulletId: upg.bulletId,
          sourceText: upg.originalText,
        })
        const metricOpps = normalizeMetricOpportunities(
          upg.metricOpportunities || upg.discoveryOpportunities || generateFallbackMetricOpportunities(upg.originalText, effectiveRole)
        )
        const isOrigQuant = isTrueQuantified(upg.originalText)
        const metricSource = isOrigQuant ? 'resume_verified' : 'grounded_qualitative'
        const metricPrompt = !isOrigQuant ? 'Confirm real impact (e.g., hours saved/week or % turnaround gain)' : null
        return {
          ...upg,
          reason,
          rewrittenText: rwText,
          metricSource,
          metricPrompt,
          metricOpportunities: metricOpps,
        }
      })
    : []

  // 6. summaryOptimization normalization
  const targetRole = analysis.candidateSnapshot?.targetRole || state.targetRole || 'Experienced Professional'
  const rawSkills = state.canonicalResume?.skills || state.resumeFacts?.skills || state.dossier?.targetJdOverlap?.evidencedSkills || analysis.candidateSnapshot?.skills || analysis.skills || []
  const skillsList = (Array.isArray(rawSkills) ? rawSkills : Object.values(rawSkills).flat())
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill || ''))
    .filter(Boolean)
  const experiences = state.canonicalResume?.experience || state.canonicalResume?.experiences || analysis.candidateSnapshot?.experiences || []
  const missingSkills = state.dossier?.targetJdOverlap?.unverifiedSkills || []

  if (!analysis.summaryOptimization || typeof analysis.summaryOptimization !== 'object') {
    analysis.summaryOptimization = {
      status: 'missing',
      currentSummary: 'No Professional Summary section found on resume',
      diagnosis: `Your resume currently lacks a tailored executive summary for ${targetRole}, forcing recruiters to scan fragmented bullets to deduce your seniority and operational scope.`,
      rewrittenSummary: generateDomainCalibratedSummary({ targetRole, experiences, skillsList, missingSkills, yearsOfExperience: verifiedYoE }),
    }
  } else {
    const sOpt = analysis.summaryOptimization
    if (!sOpt.status || !['missing', 'needs_rewrite', 'strong'].includes(sOpt.status)) {
      sOpt.status = sOpt.currentSummary && !sOpt.currentSummary.includes('No Professional Summary') ? 'needs_rewrite' : 'missing'
    }
    if (!sOpt.currentSummary) {
      sOpt.currentSummary = state.canonicalResume?.summary || 'No Professional Summary section found on resume'
    }
    if (!sOpt.diagnosis) {
      sOpt.diagnosis = `A compelling summary immediately hooks hiring managers within the first 6 seconds, framing your target role and core specializations.`
    }

    // Only use generateDomainCalibratedSummary if rewrittenSummary is completely missing or empty — never overwrite a valid LLM summary
    if (!sOpt.rewrittenSummary || typeof sOpt.rewrittenSummary !== 'string' || sOpt.rewrittenSummary.trim().length === 0) {
      sOpt.rewrittenSummary = generateDomainCalibratedSummary({ targetRole, experiences, skillsList, missingSkills, currentSummary: sOpt.currentSummary, yearsOfExperience: verifiedYoE })
    }
    if (sOpt.rewrittenSummary && verifiedYoE && verifiedYoE !== '5+ years') {
      sOpt.rewrittenSummary = sOpt.rewrittenSummary.replace(/\b5\+\s*years\b/gi, verifiedYoE)
    }
    if (sOpt.rewrittenSummary && typeof sOpt.rewrittenSummary === 'string') {
      const sourceTokens = buildSourceFactTokens(state.canonicalResume)
      sOpt.rewrittenSummary = replaceUnverifiedNumericTokens(
        sOpt.rewrittenSummary,
        sourceTokens,
        state.canonicalResume
      )
    }
  }

  // 7. priorityActions normalization
  if (!Array.isArray(analysis.priorityActions) || analysis.priorityActions.length === 0) {
    analysis.priorityActions = (analysis.issues || []).slice(0, 3).map((iss, idx) => ({
      priority: idx + 1,
      title: iss.title || 'Prioritize impact',
      action: iss.recommendation || 'Strengthen technical outcome',
      reason: iss.whyItMatters || 'High impact on recruiter conversion',
    }))
  } else {
    analysis.priorityActions.forEach((pa, idx) => {
      if (pa && typeof pa === 'object') {
        if (pa.priority === undefined && pa.order !== undefined) {
          pa.priority = pa.order
        } else if (pa.priority === undefined) {
          pa.priority = idx + 1
        }
        if (!pa.action && pa.description) {
          pa.action = pa.description
        }
        if (!pa.reason && pa.expectedImpact) {
          pa.reason = pa.expectedImpact
        }
      }
    })
  }

  // 8. bulletEvaluations normalization (5-Part Formula & Helping/Hurting Verdict)
  if (Array.isArray(analysis.bulletEvaluations)) {
    analysis.bulletEvaluations = analysis.bulletEvaluations
      .filter((be) => be && typeof be === 'object' && be.bulletId)
      .map((be) => {
        const rawVerdict = String(be.verdict || '').toLowerCase().trim()
        const isHurting = rawVerdict === 'hurting' || be.isResponsibilityOnly === true || (Array.isArray(be.missingElements) && be.missingElements.length >= 2)
        const verdict = isHurting ? 'hurting' : 'helping'
        const flags = be.fivePartFlags && typeof be.fivePartFlags === 'object' ? be.fivePartFlags : {}
        return {
          bulletId: String(be.bulletId).trim(),
          verdict,
          fivePartFlags: {
            actionVerb: Boolean(flags.actionVerb),
            hardSkill: Boolean(flags.hardSkill),
            collaboration: Boolean(flags.collaboration),
            metric: Boolean(flags.metric),
            outcome: Boolean(flags.outcome),
          },
          isResponsibilityOnly: Boolean(be.isResponsibilityOnly),
          missingElements: Array.isArray(be.missingElements) ? be.missingElements.map(String) : [],
        }
      })
  } else {
    analysis.bulletEvaluations = []
  }

  // 9. cutList normalization (Filler, outdated, and overflow items)
  if (Array.isArray(analysis.cutList)) {
    analysis.cutList = analysis.cutList
      .filter((cl) => cl && typeof cl === 'object' && (cl.originalText || cl.bulletId || cl.reason))
      .map((cl) => ({
        section: String(cl.section || 'experience').trim(),
        itemId: cl.itemId ? String(cl.itemId).trim() : null,
        bulletId: cl.bulletId ? String(cl.bulletId).trim() : null,
        originalText: cleanTokens(cl.originalText || ''),
        reason: cleanTokens(cl.reason || 'Prune low-value filler to preserve vertical space and recruiter focus'),
      }))
  } else {
    analysis.cutList = []
  }

  // 10. nearMissKeywords normalization (Literal ATS Keyword Mirroring)
  if (Array.isArray(analysis.nearMissKeywords)) {
    analysis.nearMissKeywords = analysis.nearMissKeywords
      .filter((nmk) => nmk && typeof nmk === 'object' && (nmk.resumePhrase || nmk.jdPhrase))
      .map((nmk) => ({
        resumePhrase: cleanTokens(nmk.resumePhrase || ''),
        jdPhrase: cleanTokens(nmk.jdPhrase || ''),
        bulletId: nmk.bulletId ? String(nmk.bulletId).trim() : null,
        reason: cleanTokens(nmk.reason || 'Exact JD keyword phrase required for ATS scanner matching'),
      }))
  } else {
    analysis.nearMissKeywords = []
  }

  return analysis
}

/**
 * Formats the Hybrid Reasoning System & User Prompts
 */
export function buildHybridPrompt({
  compactResume,
  dossier,
  targetRole,
  targetJobDescription,
  marketContext,
  assessmentDirectives = null,
  answers = {},
  fewShotBlock = '',
}) {
  const candidateContext = answers && Object.keys(answers).length > 0 ? `
==================================================
CANDIDATE ASSESSMENT CONTEXT (Use this to personalize your critique, summary rewrite, and bullet rewrites):
- Target Role: ${answers.targetRole || targetRole || 'Not specified'}
- Opportunity Type: ${answers.opportunityType || 'Full-Time W2'}
- Experience Level: ${answers.experience || 'Mid-Level'}
- Work Authorization / Visa: ${answers.visa || 'Not specified'}
- Applications Submitted (30d): ${answers.apps30d || answers.appsWeek?.raw || 'Not specified'}
- Active Drop-Off Stage: ${answers.DropOffStage || 'Phase 1'}
- Key Hiring Challenge: ${answers.biggestChallenge || 'Not specified'}
- Candidate's Core Frustration: ${answers.frustration || 'Not specified'}
- What Candidate Already Tried: ${Array.isArray(answers.alreadyTried) ? answers.alreadyTried.join(', ') : (answers.alreadyTried || 'None')}

CRITICAL INSTRUCTION: Tailor the Professional Summary Rewrite and Bullet Rewrites specifically for a candidate at this experience level (${answers.experience || 'Mid-Level'}) and target role (${answers.targetRole || targetRole}), addressing their specific hiring challenge ("${answers.biggestChallenge || 'conversion'}"). Never provide generic text.
` : ''

  return [
    {
      role: 'system',
      content: `You are Maya, a senior technical recruiter and executive resume reviewer with 15+ years of engineering and technical hiring experience in the US job market.
You are reviewing this resume as if talking directly to the candidate: human, conversational, professional, warm, direct, specific, and genuinely useful.

Do NOT sound like:
- an ATS bot
- a generic career coach
- a corporate consultant
- a resume template generator

Your analysis must feel like an expert recruiter explaining:
"What I noticed, why it matters to the hiring manager reading it, and what I would change."

Use the candidate's first name naturally when available in the resume, but do NOT overuse it.
Write in plain, natural US English with clear, confident sentences.

All basic calculations (quantification density, technology counts, tool dumps, contact merge, exact JD overlap, market frequency) have ALREADY BEEN COMPUTED DETERMINISTICALLY in code and are supplied in the DOSSIER below.

==================================================
1. RESUME IS THE ONLY SOURCE OF TRUTH (ZERO FABRICATION)
==================================================
Analyze ONLY the information explicitly present in the supplied resume.
Do NOT use:
- external knowledge or assumed industry norms as candidate facts
- invented metrics, percentages, dollar amounts, scale, or user counts
- invented technologies or tools
- invented responsibilities, titles, or leadership scope
- invented business outcomes or customer impact

You may interpret evidence to assess clarity, positioning, and recruiter perception, but interpretation must NEVER be presented as factual resume content.

==================================================
2. STAFF ENGINEER & SENIOR TECHNICAL RECRUITER AUDIT MANDATE
==================================================
Evaluate the candidate against their target role with the discerning eye of a Staff Engineer and Senior Technical Recruiter.
Generate 5 to 7 high-conviction issues in the "issues" array that deeply diagnose:

1. Seniority Dilution & Legacy Positioning:
   - Flag where junior or legacy tasks (e.g., manual WinSCP deployments, legacy JSP/jQuery maintenance, basic wireframe translation, routine operational support) undercut a Senior target role.
   - Flag amateur or student-style phrasing (e.g., "Currently learning Generative AI...", "as a self-initiated project to explore...", "worked on academic project").
   - Rewrite them to emphasize architectural ownership, modernization, fault-tolerance, and production readiness.

2. Vague / Unquantified Impact & Seniority Upgrade:
   - Flag bullets that undercut senior positioning or lack tangible operational impact.
   - Rewrite them into punchy, executive-grade engineering bullets following the Google XYZ standard:
     "Accomplished [X], evidenced by [Y], by executing [Z]."
   - CRITICAL 5-PART RESUME PLAYBOOK MANDATE (18–32 WORDS, ZERO PLACEHOLDERS):
     * ZERO INVENTED NUMBERS MANDATE: Strictly PROHIBIT inventing synthetic percentages (e.g. 22%, 18%, 35%, 24%), hours saved (e.g. 15+ hours), uptime (e.g. 99.9%), or user counts not explicitly stated in the source resume bullet. Any unverified number is considered a hallucination and is strictly banned.
     * SELECTIVE INJECTION RULE: PRESERVE verified metrics verbatim! If a candidate bullet already contains a verified metric (e.g. 25%, 30+ queries, $2M, 3x, 100,000+ users, 2.5 seconds), PRESERVE that exact metric and outcome! Do NOT inject a synthetic metric on top of it — only tighten its action verb, technical mechanism, and structure.
     * GROUNDED QUALITATIVE REWRITES FOR UNQUANTIFIED BULLETS: When the original bullet lacks numbers, focus the rewrite entirely on verified tools, concrete technical mechanisms, architectural scope, and honest qualitative outcomes (e.g., system reliability, modularity, automated testing, zero-downtime releases) WITHOUT fabricating synthetic numbers.
     * PER-RESUME METRIC DIVERSITY & ANTI-REPETITION GUARD:
        - NO REPEATED OPENING VERBS: Never start more than 2 bullets across the entire resume with the same action verb (e.g., maximum 2 bullets starting with "Architected", 2 with "Engineered", 2 with "Automated", etc.). Vary opening verbs naturally across strong, domain-appropriate action verbs (e.g., Architected, Engineered, Developed, Built, Spearheaded, Automated, Optimized, Streamlined, Designed, Orchestrated, Scaled, Deployed, Standardized, Modernized; or in Present tense: Lead, Architect, Build, Automate, Optimize, Streamline, Design, Orchestrate, Scale, Deploy, Standardize, Modernize).
        - VARIED SENTENCE STRUCTURE: Do NOT use a rigid formula or identical grammatical pattern on consecutive bullets. Vary openings and clause orders naturally across the resume (e.g., some bullets lead with decisive action verb + technical mechanism, while others lead with delivered business outcome or system deliverable + technical architecture; 16–28 words).
        - UNIQUE DELIVERABLES & OUTCOMES: Every rewrite must deliver a distinct technical deliverable or qualitative outcome. Never repeat identical outcome phrases across two different bullets.
        - Integrate the outcome naturally inside the sentence (never append as generic trailing boilerplate). Match the outcome strictly to what that specific bullet does (QA -> test coverage/regression, UI -> Lighthouse/accessibility/FCP, Security -> CVE/auth, DB -> query p95/throughput, Data -> hours saved/accuracy, AI -> retrieval/inference, etc.).
     * NEVER output bracketed placeholders like "[ADD: ...]", "[insert metric]", or "<metric>".
     * STRICT BAN ON LAZY SUFFIX APPENDS: NEVER take the candidate's existing bullet and merely append 'by [doing X]' or ', using [Y]' to the end while leaving the original weak opening intact.
     * Any rewrite where the first 35 characters match the original bullet (e.g. rewrite.toLowerCase().startsWith(original.toLowerCase().slice(0, 35))) is STRICTLY FORBIDDEN and will be rejected.
     * When the original bullet lacks numbers, rewrite using verified tools, architecture, and honest qualitative outcomes without fabricating synthetic numbers.
     * The rewrite MUST be 100% complete, fluent, and ready to be used as-is by the candidate.

3. Tool Dumping & Passive Ownership:
   - Flag bullets that list 5+ tools without explaining the architectural problem solved or the system built.
   - Flag bullets opening with weak verbs ("Contributed to", "Managed", "Helped", "Assisted in", "Responsible for", "Utilized", "Worked on") or "-ing" participles ("Working on", "Developing").
   - Restructure them from scratch so strong ownership action verbs lead ("Architected", "Engineered", "Spearheaded", "Automated", "Reduced", "Led", "Optimized").

==================================================
3. MANDATORY FULL REWRITES (THE 5-PART RESUME PLAYBOOK FORMULA)
==================================================
Every single issue in "issues" MUST have a non-null "correctedText" ("correctionType": "rewrite"). Never return "correctedText": null.
BAN COSMETIC SWAPS & LAZY SUFFIX APPENDS:
- Strictly forbid rewrites that only replace action verbs without injecting measurable scale, system throughput, or architectural mechanisms.
- Strictly forbid lazy suffix appends where the first 35 characters match the original bullet. Every rewrite must be re-engineered from the ground up!

All rewrites across "issues[].correctedText", "bulletUpgrades[].rewrittenText", and "summaryOptimization.rewrittenSummary" MUST follow the Recruiter Impact Formula (18–32 words):
[Strong Action Verb] + [Relevant Hard Skill/Scope] + [Grounded Impact / Operational Mechanism] + [Business Outcome]

- Part 1 (Strong Action Verb): Lead with a high-conviction action verb (e.g. Architected, Engineered, Automated, Reduced, Led, Spearheaded, Optimized). Replace weak openers ("Worked on", "Helped with", "Responsible for", "Utilized", "Assisted in", "Tasked with") and "-ing" participles.
- Part 2 (Relevant Hard Skill/Scope): Weave verified tools, systems, or frameworks naturally into the technical mechanism (e.g. Docker, Kubernetes, PostgreSQL, Kafka, React 19, Snowflake, dbt, AWS, BigQuery, Tableau). Zero keyword stuffing.
- Part 3 (Scale / Collaboration — STRICTLY OPTIONAL): Include cross-functional collaboration ("partnering with...", "collaborating with...") ONLY if the original bullet explicitly involves cross-functional teams, clients, stakeholders, or leadership. NEVER force "collaborating with DBA/SRE squads" onto solo technical, SQL, ETL, or coding bullets where no collaboration is mentioned in the original resume!
- Part 4 (Grounded Impact / Operational Mechanism): If the candidate's source bullet includes verified numbers, preserve or sharpen them. If the original bullet lacks numbers, focus on the concrete technical mechanism and system stability WITHOUT fabricating unverified numbers or percentages. Zero [ADD: ...] or bracketed placeholders.
- Part 5 (Business Outcome): Explicitly state the delivered business or system impact (e.g. "eliminating release bottlenecks", "preventing production defect escapes", "sustaining zero-downtime rollouts").

CRITICAL SEPARATION IN issues[].diagnosis:
In every issue diagnosis, you MUST explicitly separate:
1. Candidate Activity (Responsibility/Task): What the candidate did on a task/duty level.
2. Outcome Deficit (What was built/achieved): The missing scale, technical mechanism, or measurable result that recruiters require for senior positioning.
Structure diagnosis like:
"Candidate Activity (Task): [Task/duty described]. Outcome Deficit: [Missing scale, technical mechanism, or measurable result], causing hiring managers to perceive this as passive routine duty rather than high-impact engineering ownership."

DOMAIN ARCHETYPE ENFORCEMENT:
1. Data & Business Analyst: Star-schema dimensional modeling, dbt test assertions, eliminating cross-system reporting discrepancies, and executive dashboard adoption.
   Example: "Eliminated cross-system reporting discrepancies and accelerated weekly executive decision cycles by architecting automated star-schema data models on Snowflake and dbt, delivering self-service Power BI dashboards used across 1,500+ SKUs."
2. Software / Backend Engineer: endpoint latency reduction, distributed event streaming, concurrency, API contract safety, and zero-downtime deployment.
   Example: "Engineered high-concurrency microservices processing enterprise transaction volume with continuous uptime by transitioning synchronous monolith endpoints into event-driven Kafka pipelines backed by Redis caching."
3. Generative AI & ML Engineer: RAG retrieval precision, token latency, hallucination reduction, context window caching, and tool-calling agent reliability.
   Example: "Reduced LLM hallucination rates and achieved sub-second query retrieval across extensive document corpora by architecting a production RAG pipeline using FastMCP agents, LangChain, and vector embeddings with automated prompt-injection guardrails."
4. DevOps & Cloud Platform Engineer: CI/CD deployment velocity, infrastructure-as-code automation, multi-stage Docker builds, Kubernetes cluster orchestration, and zero-downtime rollouts.
   Example: "Accelerated deployment lead time while sustaining high service availability by orchestrating multi-stage Docker container builds, automated Terraform infrastructure, and blue-green Kubernetes deployments."
- SECURITY & COMPLIANCE NON-ABSURDITY: For security/vulnerability/sanitization bullets, anchor ONLY on eliminating high-severity CVEs, zero-day threat prevention, and achieving 100% security audit compliance (SOC2/HIPAA/PCI-DSS). NEVER claim security sanitization or input validation increased processing speed, system throughput, or execution latency.

${IMPACT_POLICY_INSTRUCTIONS}

==================================================
4. LLM SEMANTIC AUDIT MANDATE (bulletEvaluations, cutList, nearMissKeywords)
==================================================
You must perform an exhaustive semantic audit across the candidate resume and output 3 top-level arrays:

1. "bulletEvaluations":
Evaluate EVERY experience and project bullet in the supplied resume:
- "bulletId": String matching the canonical bullet ID (e.g. "exp_001_b01", "proj_001_b01").
- "verdict": "helping" | "hurting" (STRICT BINARY VERDICT — NO NEUTRAL).
  * "helping": Demonstrates proactive engineering ownership, concrete technical mechanism, and quantified or measurable outcome.
  * "hurting": Weak duty/task phrasing, missing metric/outcome, tool dump, or pure responsibility description without business impact.
- "fivePartFlags": Object with boolean flags for each part of the 5-part formula:
  {
    "actionVerb": boolean (true if starts with strong active verb; false if weak or -ing),
    "hardSkill": boolean (true if mentions concrete technical skills or tools),
    "collaboration": boolean (true if mentions team, stakeholder, or leadership context),
    "metric": boolean (true if contains hard numbers, percentages, time savings, or scale),
    "outcome": boolean (true if delivers clear business or system achievement)
  }
- "isResponsibilityOnly": boolean (true if bullet only lists a job duty or task without tangible outcome or ownership).
- "missingElements": Array of missing parts from the 5-part formula (e.g. ["metric", "collaboration"]).

2. "cutList":
Flag lines, bullets, or sections that actively hurt the resume, waste valuable vertical space, or violate 1-page discipline (<8 YOE):
- Items to cut: Generic meeting/task filler (e.g. "Attended daily agile standups and sprint planning", "Wrote clean code and fixed bugs"), outdated >5-year irrelevant legacy projects, full street addresses (privacy/space leak), or obsolete references ("References available upon request").
- Format: Array of objects:
  {
    "section": "experience" | "projects" | "summary" | "education" | "skills",
    "itemId": "exp_001",
    "bulletId": "exp_001_b04" (or null if entire item),
    "originalText": "Exact verbatim text from candidate resume",
    "reason": "Clear explanation of why this should be pruned or cut to preserve page space and recruiter focus"
  }
- If no items qualify for cut, return empty array [].

3. "nearMissKeywords" & Literal ATS Keyword Mirroring:
Compare candidate resume phrasing against TARGET JOB DESCRIPTION and marketEvidenceGaps to identify semantic synonyms that ATS filters fail to match:
- E.g., candidate wrote "large-scale systems" or "distributed web apps" while JD demands "distributed systems".
- Format: Array of objects:
  {
    "resumePhrase": "large-scale systems",
    "jdPhrase": "distributed systems",
    "bulletId": "exp_001_b01" (or null),
    "reason": "ATS scanners look for the exact JD keyword phrase 'distributed systems' rather than generic synonyms."
  }
- LITERAL ATS KEYWORD MIRRORING MANDATE: In "issues[].correctedText" and "bulletUpgrades[].rewrittenText", mirror the exact "jdPhrase" directly inside the rewrite rather than using a loose synonym or appending it awkwardly at the end.

==================================================
5. PER-BULLET AUDIT UPGRADES ("bulletUpgrades")
==================================================
In addition to the 5 to 7 primary issues, systematically audit and rewrite EVERY weak, unquantified, passive, or responsibility-only bullet point across the candidate's experience and flagship projects (do NOT cap at 8 — every unquantified or weak bullet in the resume must receive a Google XYZ rewrite in "bulletUpgrades").
Provide a clean critique and Google XYZ rewrite for each in the "bulletUpgrades" array:
- Set "status": "warn" (or "fix").
- Set "reason": A specific 1-sentence recruiter critique of why this bullet is weak or unquantified.
- Set "rewrittenText": Complete Google XYZ rewrite (18–32 words) with strong action verb, verified skills, and concrete qualitative or verified outcome. STRICTLY NO invented numbers (zero 22%, 18%, 35%, 15+ hrs), NO lazy suffix appends, and NO [ADD: ...] placeholders.

==================================================
6. PROFESSIONAL SUMMARY AUDIT & REWRITE MANDATE ("summaryOptimization")
==================================================
Always populate "summaryOptimization" in the output JSON.
MANDATORY TECH STACK RETENTION: summaryOptimization.rewrittenSummary MUST retain the candidate's actual verified stack (e.g. React, TypeScript, Next.js, Java Spring Boot, AWS/Azure, WCAG 2.1 AA, RAG) in 3 crisp executive sentences. NEVER replace a stack-rich summary with generic fluff like "specializing in scalable architecture, technical execution, and robust workflow automation".
STRICT BAN ON GENERIC BUZZWORDS & BOILERPLATE: Strictly forbid generic filler phrases such as "proven expertise in engineering scalable architectures", "results-driven professional", "demonstrated track record of success", or "seeking to leverage skills".
GROUNDING MANDATE: Every sentence in "rewrittenSummary" must be anchored directly in the candidate's ACTUAL parsed tech stack (from dossier.skills), concrete domain systems (from experience bullets), and top missing market keywords (from dossier.targetJdOverlap / marketContext).
ANTI-REPETITION MANDATE: Strictly FORBID copy-pasting the exact wording, sentences, or metrics of individual bulletRewrites into rewrittenSummary. The summary synthesizes the high-altitude career-level arc: total domain specialization, architectural scope, and 1-2 broad headline outcomes. Individual bullet rewrites carry granular implementation proof.
- If the resume has NO summary section (or is empty/missing):
  * Set "status": "missing"
  * Set "currentSummary": "No Professional Summary section found on resume"
  * Set "diagnosis": Direct recruiter critique explaining why missing an executive summary hurts 6-second recruiter scan conversion for the target role (forces recruiter to hunt across old bullets to deduce seniority and engineering scope).
  * Set "rewrittenSummary": You MUST synthesize a high-impact, ready-to-use 3-to-4 sentence Executive Resume Summary tailored to the Target Role from their verified career achievements, scale metrics, and core tech stack so they can paste it directly at the top of their resume:
    - Sentence 1: Role title, years of experience, and core architectural specialization.
    - Sentence 2: 2-3 signature quantified engineering/business outcomes from verified work history.
    - Sentence 3: Core production tech stack, cloud/AI capabilities, and target engineering value proposition.
- If the resume HAS a summary section:
  * Set "currentSummary": Verbatim current summary text from resume.
  * If it lacks metrics, is generic, uses student/junior phrasing, or has clichés, set "status": "needs_rewrite" (or "strong" if already flawless).
  * Set "diagnosis": Direct recruiter critique of what weakens the current summary for the target role.
  * Set "rewrittenSummary": High-impact 3-to-4 sentence Executive Resume Summary (Sentence 1: Role title & specialization; Sentence 2: 2-3 signature quantified outcomes; Sentence 3: Core production stack & value proposition).

- ZERO FABRICATED NUMBERS MANDATE FOR "rewrittenSummary": Use ONLY exact metrics that actually appear in the candidate's resume (or strong qualitative scale statements if no global metric exists). NEVER invent numbers like "2.5 seconds" or percentages not explicitly written in the resume bullets.

==================================================
7. ACTION-ORIENTED RECOMMENDATIONS (NO MERE REPETITION)
==================================================
Every issue recommendation MUST be distinct, actionable advice:
- Diagnosis answers: WHAT was noticed and why it is a problem.
- WhyItMatters answers: WHY a senior hiring manager or recruiter cares for this target role.
- Recommendation answers: WHAT the candidate should concretely do to fix it.
CRITICAL: Do NOT repeat the diagnosis as the recommendation!

==================================================
8. TARGET JD & MARKET INTELLIGENCE CITATION RULES
==================================================
- Target JD Gaps: If a skill is requested in the Target JD but unverified in the resume, categorize as "skill_evidence_gap" and phrase it strictly as "NOT_EVIDENCED_IN_RESUME". Never state the candidate lacks knowledge; only that the resume provides no direct evidence.
- Market Gaps: When referencing market signals from the pre-audit dossier, use precise observational language (e.g. "appears in 4 of 5 sampled roles at this level in our market library, but current resume does not provide clear direct evidence"). Never say "mandatory" or "you don't know X".

==================================================
9. CAREER STORY & RECRUITER PERSPECTIVE
==================================================
- Frame your analysis like a seasoned senior recruiter evaluating the candidate's real journey.
- Respect the precomputed timeline facts: do NOT calculate dates, do not guess whether they are employed, and do not invent gaps.
- If the candidate was promoted internally, acknowledge and highlight that progression as a high-performance signal.
- If career gaps (>6 months) exist, advise on contextualizing them constructively without treating normal transitions (<=6 months) as defects.
- Frame issues around candidate positioning and clarity: "What I noticed, why it matters, and what I would change."

==================================================
10. REQUIRED V2.2 JSON SCHEMA
==================================================
Return ONLY a valid JSON object matching this structure:
{
  "analysisVersion": "2.2",
  "candidateSnapshot": {
    "name": "Candidate Name",
    "targetRole": "Target Role",
    "experienceLevel": "${dossier?.timeline?.yearsOfExperience ? `e.g. Senior (${dossier.timeline.yearsOfExperience})` : 'e.g. Senior (8+ years)'}",
    "currentSeniority": "Senior",
    "primaryProfile": "e.g. Full-Stack / Distributed Backend Specialist"
  },
  "dashboard": null,
  "summaryOptimization": {
    "status": "missing",
    "currentSummary": "Verbatim current summary text from the resume, or 'No Professional Summary section found on resume'",
    "diagnosis": "Direct recruiter critique explaining why the missing or current summary hurts 6-second recruiter scan conversion for the target role (e.g. missing entirely, too generic, lacks scale metrics, or uses student phrasing).",
    "rewrittenSummary": "A powerhouse, ready-to-paste 3-to-4 sentence Executive Resume Summary tailored to the Target Role: Sentence 1 (Role title, years of experience, and core architectural specialization), Sentence 2 (2-3 signature quantified engineering/business outcomes from their verified work history), Sentence 3 (Core production tech stack, cloud/AI capabilities, and target engineering value proposition)."
  },
  "overallReview": {
    "summary": "A 2-paragraph conversational recruiter read. Paragraph 1: What is strong about the candidate's background and demonstrated work. Paragraph 2: What should be improved to sharpen recruiter signal for the target role.",
    "tone": "conversational"
  },
  "strengths": [
    {
      "id": "str_001",
      "title": "Clear headline",
      "description": "Clear explanation of why this gives strong recruiter signal",
      "evidence": [
        {
          "section": "experience",
          "itemId": "exp_001",
          "bulletId": "exp_001_b01",
          "originalText": "Verbatim bullet text from canonical resume"
        }
      ]
    }
  ],
  "issues": [
    {
      "id": "issue_001",
      "severity": "high",
      "category": "impact",
      "title": "Clear, punchy issue title",
      "diagnosis": "Candidate Activity (Task): Built and maintained API endpoints. Outcome Deficit: Lacks technical scale, throughput, or business outcome, reading as routine duty rather than engineering ownership.",
      "whyItMatters": "Why a senior hiring manager or recruiter cares for this target role.",
      "recommendation": "Concrete, actionable guidance on what to change.",
      "correctedText": "Complete humanized 5-part rewrite using resume facts and natural operational outcomes. STRICTLY NO [ADD: ...] or bracketed placeholders.",
      "metricDiscoveryQuestions": [
        "What was the measurable latency improvement or percentage throughput gain?"
      ],
      "metricOpportunities": [
        {
          "label": "API p95 Latency",
          "question": "Roughly how much faster did endpoint responses become after optimization?",
          "unitHint": "ms or %"
        }
      ],
      "correctionType": "rewrite",
      "confidence": 0.95,
      "evidence": [
        {
          "section": "experience",
          "itemId": "exp_001",
          "bulletId": "exp_001_b02",
          "originalText": "Verbatim text copied from canonical resume"
        }
      ]
    }
  ],
  "priorityActions": [
    {
      "priority": 1,
      "title": "Highest leverage fix first",
      "action": "Concrete step the candidate can execute today.",
      "reason": "Why this impacts hiring conversion"
    }
  ],
  "bulletUpgrades": [
    {
      "bulletId": "exp_001_b05",
      "status": "warn",
      "reason": "Specific 1-sentence recruiter critique of why this bullet is weak or unquantified",
      "rewrittenText": "Complete humanized 5-part rewrite using resume facts and natural operational outcomes. STRICTLY NO [ADD: ...] or bracketed placeholders.",
      "metricOpportunities": [
        {
          "label": "Test Coverage Gain",
          "question": "By what percentage did automated test coverage increase across the codebase?",
          "unitHint": "%"
        }
      ]
    }
  ],
  "bulletEvaluations": [
    {
      "bulletId": "exp_001_b01",
      "verdict": "helping",
      "fivePartFlags": {
        "actionVerb": true,
        "hardSkill": true,
        "collaboration": true,
        "metric": true,
        "outcome": true
      },
      "isResponsibilityOnly": false,
      "missingElements": []
    }
  ],
  "cutList": [
    {
      "section": "experience",
      "itemId": "exp_001",
      "bulletId": "exp_001_b04",
      "originalText": "Attended daily standup meetings and contributed to sprint planning sessions.",
      "reason": "Generic meeting attendance filler that consumes prime resume real estate without signaling technical ability."
    }
  ],
  "nearMissKeywords": [
    {
      "resumePhrase": "large-scale systems",
      "jdPhrase": "distributed systems",
      "bulletId": "exp_001_b01",
      "reason": "ATS scanners look for the exact JD keyword 'distributed systems' rather than generic synonyms."
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `TARGET ROLE: ${targetRole || 'Not specified'}

TARGET JOB DESCRIPTION:
${targetJobDescription ? targetJobDescription.slice(0, 5000) : 'None provided'}

CANDIDATE RESUME:
${compactResume}

==================================================
DETERMINISTIC PRE-AUDIT DOSSIER (Ground Truth):
==================================================
- Professional Summary: ${dossier.summary ? `PRESENT ("${dossier.summary.slice(0, 250)}...")` : 'NOT FOUND ON RESUME (status: missing)'}
- Quantification Density: ${dossier.quantification.density} (${dossier.quantification.quantifiedBullets}/${dossier.quantification.totalBullets} bullets quantified)
- Unquantified Bullets: ${dossier.quantification.unquantifiedBulletIds.join(', ') || 'None'}
- Tool Dump Candidates: ${dossier.toolDumps.map((t) => `${t.bulletId} (${t.techCount} tools)`).join(', ') || 'None'}
- Contact Merge Anomaly: ${dossier.contactMergeAnomaly ? 'DETECTED in extracted text (ats_readability signal)' : 'CLEAN'}
- Career Timeline: ${dossier.timeline?.yearsOfExperience || dossier.timeline?.formattedDuration || '0 months'} across ${dossier.timeline?.itemCount || 0} roles (${dossier.timeline?.totalExperienceYears || 0} years)
- Current Role: ${dossier.timeline?.currentRole?.isCurrentlyEmployed ? `${dossier.timeline.currentRole.role} at ${dossier.timeline.currentRole.company} (${dossier.timeline.currentRole.dates})` : 'Not actively employed'}
- Career Gaps (>6 months): ${dossier.timeline?.careerGaps?.length > 0 ? dossier.timeline.careerGaps.map((g) => `${g.gapMonths} months between ${g.previousCompany} and ${g.nextCompany}`).join('; ') : 'None'}
- Career Progression / Promotions: ${dossier.timeline?.promotions?.length > 0 ? dossier.timeline.promotions.map((p) => `${p.company}: ${p.progressionSummary}`).join('; ') : 'None'}
- Certifications Evidenced: ${dossier.certifications?.length > 0 ? dossier.certifications.map((c) => c.name).join(', ') : 'None'}
- Target JD Evidenced Skills: ${dossier.targetJdOverlap.evidencedSkills.join(', ') || 'None'}
- Target JD Gaps (NOT_EVIDENCED_IN_RESUME): ${dossier.targetJdOverlap.unverifiedSkills.join(', ') || 'None'}
- Sampled Market Gaps: ${dossier.marketEvidenceGaps.map((g) => `${g.skill} (${g.frequency})`).join(', ') || 'None'}
- Market Bucket: ${marketContext?.bucketKey || 'general'} (Sample Size: ${marketContext?.marketSampleSize || 5})
${candidateContext}
${assessmentDirectives ? `
==================================================
CANDIDATE ASSESSMENT & JOB-HUNT CONTEXT (PERSONALIZATION DIRECTIVES)
==================================================
${assessmentDirectives}
` : ''}
${fewShotBlock ? `
==================================================
VETTED FEW-SHOT EXAMPLES (From Upvoted Recruiter Rewrites)
==================================================
${fewShotBlock}
` : ''}
Synthesize the final report now using this dossier as factual foundation. Return ONLY valid JSON.`,
    },
  ]
}


export function normalizeVerbLemma(word) {
  if (!word || typeof word !== 'string') return ''
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!clean) return ''

  const irregulars = {
    built: 'build', build: 'build',
    led: 'lead', lead: 'lead',
    ran: 'run', run: 'run',
    drove: 'drive', drive: 'drive',
    wrote: 'write', write: 'write',
    made: 'make', make: 'make',
    kept: 'keep', keep: 'keep',
    took: 'take', take: 'take',
    grew: 'grow', grow: 'grow',
    set: 'set',
    cut: 'cut',
    met: 'meet', meet: 'meet',
    held: 'hold', hold: 'hold',
    sent: 'send', send: 'send',
    spent: 'spend', spend: 'spend',
    spoke: 'speak', speak: 'speak',
    chose: 'choose', choose: 'choose',
    won: 'win', win: 'win',
    taught: 'teach', teach: 'teach',
    brought: 'bring', bring: 'bring',
    bought: 'buy', buy: 'buy',
  }
  if (irregulars[clean]) return irregulars[clean]

  const present = toPresentTense(clean)
  if (present && typeof present === 'string') {
    const pClean = present.toLowerCase().replace(/[^a-z]/g, '')
    if (irregulars[pClean]) return irregulars[pClean]
    if (pClean && pClean !== clean) return pClean
  }

  if (clean.endsWith('ing') && clean.length > 5) {
    let stem = clean.slice(0, -3)
    if (stem[stem.length - 1] === stem[stem.length - 2]) stem = stem.slice(0, -1)
    else if (!stem.endsWith('e')) stem = stem + 'e'
    return stem
  }
  if (clean.endsWith('ed') && clean.length > 4) {
    let stem = clean.slice(0, -2)
    if (stem[stem.length - 1] === stem[stem.length - 2]) stem = stem.slice(0, -1)
    return stem
  }
  if (clean.endsWith('es') && clean.length > 4) {
    return clean.slice(0, -2)
  }
  if (clean.endsWith('s') && clean.length > 3 && !clean.endsWith('ss')) {
    return clean.slice(0, -1)
  }

  return clean
}

export function getOpeningVerb(text) {
  if (!text || typeof text !== 'string') return null
  const cleaned = text.replace(/^[\s*•\-–—\d.)\]>]+/, '').trim()
  if (!cleaned) return null

  const tokens = cleaned.split(/\s+/)
  for (let i = 0; i < Math.min(tokens.length, 4); i++) {
    const rawWord = tokens[i].replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '')
    if (!rawWord) continue
    const lower = rawWord.toLowerCase()
    if (lower.endsWith('ly') && lower.length > 4) continue
    if (['in', 'on', 'at', 'by', 'for', 'with', 'as', 'to', 'the', 'a', 'an', 'and'].includes(lower)) continue

    return {
      raw: rawWord,
      lemma: normalizeVerbLemma(rawWord),
      index: i,
    }
  }

  const fallback = tokens[0]?.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '') || ''
  return {
    raw: fallback,
    lemma: normalizeVerbLemma(fallback),
    index: 0,
  }
}

export function extractMetricTokens(text) {
  if (!text || typeof text !== 'string') return []
  const tokens = []

  let stripped = text.replace(/\b(?:19[7-9]\d|20[0-3]\d)\b/g, ' ')
  stripped = stripped.replace(/\b(?:python|react|angular|vue|node|java|oauth|http|soc|iso|wcag|tier|level|phase|step|part)\s*v?[\d.]+\b/gi, ' ')
  stripped = stripped.replace(/\b[A-Z]{1,3}\d\b/g, ' ')

  const percentMatches = stripped.match(/\b\d+(?:\.\d+)?%/g) || []
  percentMatches.forEach((m) => tokens.push(m.toLowerCase().trim()))

  const multiplierMatches = stripped.match(/\b\d+(?:\.\d+)?[xX]\b/g) || []
  multiplierMatches.forEach((m) => tokens.push(m.toLowerCase().trim()))

  const currencyMatches = stripped.match(/\$\s*[\d,]+(?:\.\d+)?(?:[kKmMbB]|k|M|B)?\b/g) || []
  currencyMatches.forEach((m) => tokens.push(m.replace(/\s+/g, '').toLowerCase().trim()))

  const timeMatches = stripped.match(/\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|secs?|mins?|minutes?|hours?|hrs?|days?|weeks?|months?)\b/gi) || []
  timeMatches.forEach((m) => tokens.push(m.toLowerCase().replace(/\s+/g, ' ').trim()))

  const scaleMatches = stripped.match(/\b\d[\d,]*(?:\.\d+)?\+?\s*(?:k\b|M\b|B\b|users\b|queries\b|records\b|requests\b|qps\b|tps\b|endpoints?\b|tickets?\b|pipelines?\b|nodes?\b|containers?\b|vulnerabilities\b|cves?\b|skus?\b)/gi) || []
  scaleMatches.forEach((m) => tokens.push(m.toLowerCase().replace(/\s+/g, ' ').trim()))

  const plusMatches = stripped.match(/\b\d[\d,]*\+(?!\w)/g) || []
  plusMatches.forEach((m) => tokens.push(m.toLowerCase().trim()))

  return Array.from(new Set(tokens))
}

export function extract5Grams(text) {
  if (!text || typeof text !== 'string') return []
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)

  if (words.length < 5) return []
  const ngrams = []
  for (let i = 0; i <= words.length - 5; i++) {
    ngrams.push(words.slice(i, i + 5).join(' '))
  }
  return ngrams
}

export function detectBulletRepetitions(bullets = []) {
  const verbUsage = new Map()
  const metricUsage = new Map()
  const ngramUsage = new Map()
  const bulletLookup = new Map()

  for (const b of bullets) {
    bulletLookup.set(b.bulletId, b)
    const rwText = (b.rewrittenText || '').trim()
    const origText = (b.originalText || '').trim()
    if (!rwText) continue

    const opening = getOpeningVerb(rwText)
    if (opening && opening.lemma) {
      if (!verbUsage.has(opening.lemma)) verbUsage.set(opening.lemma, [])
      verbUsage.get(opening.lemma).push({
        bulletId: b.bulletId,
        rawVerb: opening.raw,
        lemma: opening.lemma,
      })
    }

    const origMetrics = new Set(extractMetricTokens(origText))
    const rwMetrics = extractMetricTokens(rwText)
    for (const m of rwMetrics) {
      const originalHadIt = origMetrics.has(m)
      if (!metricUsage.has(m)) metricUsage.set(m, [])
      metricUsage.get(m).push({
        bulletId: b.bulletId,
        originalHadIt,
      })
    }

    const ngrams = extract5Grams(rwText)
    const seenInBullet = new Set()
    for (const ng of ngrams) {
      if (seenInBullet.has(ng)) continue
      seenInBullet.add(ng)
      if (!ngramUsage.has(ng)) ngramUsage.set(ng, [])
      ngramUsage.get(ng).push(b.bulletId)
    }
  }

  const collidingVerbs = new Map()
  for (const [lemma, occurrences] of verbUsage.entries()) {
    if (occurrences.length > 2) {
      collidingVerbs.set(lemma, {
        total: occurrences.length,
        allowed: occurrences.slice(0, 2).map((o) => o.bulletId),
        violators: occurrences.slice(2).map((o) => o.bulletId),
      })
    }
  }

  const collidingMetrics = new Map()
  for (const [metric, occurrences] of metricUsage.entries()) {
    if (occurrences.length > 1) {
      const aiOccurrences = occurrences.filter((o) => !o.originalHadIt)
      if (aiOccurrences.length > 0) {
        const kept = occurrences[0].bulletId
        const violators = occurrences.slice(1).filter((o) => !o.originalHadIt).map((o) => o.bulletId)
        if (violators.length > 0) {
          collidingMetrics.set(metric, { kept, violators })
        }
      }
    }
  }

  const collidingPhrases = new Map()
  for (const [phrase, bIds] of ngramUsage.entries()) {
    if (bIds.length > 1) {
      collidingPhrases.set(phrase, {
        kept: bIds[0],
        violators: bIds.slice(1),
      })
    }
  }

  const repairTargetsMap = new Map()

  for (const [lemma, info] of collidingVerbs.entries()) {
    for (const bId of info.violators) {
      if (!repairTargetsMap.has(bId)) {
        const b = bulletLookup.get(bId)
        repairTargetsMap.set(bId, {
          bulletId: bId,
          originalText: b?.originalText || '',
          currentRewrittenText: b?.rewrittenText || '',
          company: b?.company || '',
          tense: b?.tense || (b?.isCurrentRole ? 'PRESENT' : 'PAST'),
          forbiddenVerbs: new Set(),
          forbiddenMetrics: new Set(),
          forbiddenPhrases: new Set(),
          reasons: [],
        })
      }
      const target = repairTargetsMap.get(bId)
      target.forbiddenVerbs.add(lemma)
      target.reasons.push(`Opening verb '${lemma}' used > 2 times across resume`)
    }
  }

  for (const [metric, info] of collidingMetrics.entries()) {
    for (const bId of info.violators) {
      if (!repairTargetsMap.has(bId)) {
        const b = bulletLookup.get(bId)
        repairTargetsMap.set(bId, {
          bulletId: bId,
          originalText: b?.originalText || '',
          currentRewrittenText: b?.rewrittenText || '',
          company: b?.company || '',
          tense: b?.tense || (b?.isCurrentRole ? 'PRESENT' : 'PAST'),
          forbiddenVerbs: new Set(),
          forbiddenMetrics: new Set(),
          forbiddenPhrases: new Set(),
          reasons: [],
        })
      }
      const target = repairTargetsMap.get(bId)
      target.forbiddenMetrics.add(metric)
      target.reasons.push(`Metric '${metric}' duplicated across bullets`)
    }
  }

  for (const [phrase, info] of collidingPhrases.entries()) {
    for (const bId of info.violators) {
      if (!repairTargetsMap.has(bId)) {
        const b = bulletLookup.get(bId)
        repairTargetsMap.set(bId, {
          bulletId: bId,
          originalText: b?.originalText || '',
          currentRewrittenText: b?.rewrittenText || '',
          company: b?.company || '',
          tense: b?.tense || (b?.isCurrentRole ? 'PRESENT' : 'PAST'),
          forbiddenVerbs: new Set(),
          forbiddenMetrics: new Set(),
          forbiddenPhrases: new Set(),
          reasons: [],
        })
      }
      const target = repairTargetsMap.get(bId)
      target.forbiddenPhrases.add(phrase)
      target.reasons.push(`Boilerplate phrase '${phrase}' repeated across bullets`)
    }
  }

  const allUsedVerbs = Array.from(verbUsage.keys())
  const allUsedMetrics = Array.from(metricUsage.keys())

  const repairTargets = Array.from(repairTargetsMap.values()).map((t) => ({
    ...t,
    forbiddenVerbs: Array.from(new Set([
      ...t.forbiddenVerbs,
      ...allUsedVerbs.filter((v) => (verbUsage.get(v)?.length || 0) >= 2),
    ])),
    forbiddenMetrics: Array.from(new Set([...t.forbiddenMetrics, ...allUsedMetrics])),
    forbiddenPhrases: Array.from(t.forbiddenPhrases),
  }))

  return {
    hasRepetitions: repairTargets.length > 0,
    repairTargets,
    verbUsage,
    metricUsage,
    collidingVerbs,
    collidingMetrics,
    collidingPhrases,
  }
}

export function syncRepairedBullet(parsedForValidation, bulletId, newRewrittenText, critique = null, whyItWorks = null) {
  if (!parsedForValidation || !bulletId || !newRewrittenText) return
  const cleaned = cleanRewriteText(newRewrittenText)

  if (Array.isArray(parsedForValidation.bulletUpgrades)) {
    const upg = parsedForValidation.bulletUpgrades.find((u) => u.bulletId === bulletId)
    if (upg) {
      upg.rewrittenText = cleaned
      if (critique) {
        upg.critique = critique
        upg.reason = critique
      }
      if (whyItWorks) upg.whyItWorks = whyItWorks
    }
  }

  if (Array.isArray(parsedForValidation.bulletRewrites)) {
    const rw = parsedForValidation.bulletRewrites.find((r) => r.bulletId === bulletId)
    if (rw) {
      rw.rewrittenText = cleaned
      rw.readyToUseRewrite = cleaned
      rw.rewritten = cleaned
      if (critique) rw.critique = critique
      if (whyItWorks) {
        rw.whyItWorks = whyItWorks
        rw.why = whyItWorks
      }
    }
  }

  if (Array.isArray(parsedForValidation.issues)) {
    for (const iss of parsedForValidation.issues) {
      const matchBullet = (Array.isArray(iss.evidence) && iss.evidence.some((e) => e.bulletId === bulletId)) || iss.bulletId === bulletId
      if (matchBullet) {
        iss.correctedText = cleaned
        iss.rewrite = cleaned
      }
    }
  }
}

export function applyDeterministicRepetitionSafetyNet(parsedForValidation, canonicalResume, bulletContextMap = new Map()) {
  if (!parsedForValidation || typeof parsedForValidation !== 'object') return

  const { bulletMap } = ResumeAgentValidator.buildCanonicalLookup(canonicalResume)

  const PAST_VERBS_POOL = [
    'Architected', 'Engineered', 'Built', 'Automated', 'Spearheaded',
    'Optimized', 'Streamlined', 'Designed', 'Orchestrated', 'Scaled',
    'Deployed', 'Standardized', 'Modernized', 'Constructed', 'Directed',
    'Overhauled', 'Accelerated', 'Synthesized', 'Formulated', 'Instituted',
    'Centralized', 'Programmed', 'Integrated', 'Refactored', 'Expanded',
  ]

  const PRESENT_VERBS_POOL = [
    'Architect', 'Engineer', 'Build', 'Automate', 'Spearhead',
    'Optimize', 'Streamline', 'Design', 'Orchestrate', 'Scale',
    'Deploy', 'Standardize', 'Modernize', 'Construct', 'Direct',
    'Overhaul', 'Accelerate', 'Synthesize', 'Formulate', 'Institute',
    'Centralize', 'Program', 'Integrate', 'Refactor', 'Expand',
  ]

  const lemmaCounts = new Map()
  const allBullets = []

  for (const [bId, text] of bulletMap.entries()) {
    if (bId === 'summary_001' || bId === 'skills_001' || bId === 'skills') continue
    let currentRw = ''
    const upg = (parsedForValidation.bulletUpgrades || []).find((u) => u.bulletId === bId)
    if (upg?.rewrittenText) currentRw = upg.rewrittenText
    if (!currentRw) {
      const rw = (parsedForValidation.bulletRewrites || []).find((r) => r.bulletId === bId)
      if (rw?.rewrittenText || rw?.readyToUseRewrite) currentRw = rw.rewrittenText || rw.readyToUseRewrite
    }
    if (!currentRw) {
      const iss = (parsedForValidation.issues || []).find((i) => i.evidence?.[0]?.bulletId === bId)
      if (iss?.correctedText) currentRw = iss.correctedText
    }

    if (!currentRw) continue

    const ctx = bulletContextMap.get(bId) || bulletContextMap.get(text.trim()) || { isCurrentRole: false, tense: 'PAST' }
    const opening = getOpeningVerb(currentRw)
    allBullets.push({
      bulletId: bId,
      originalText: text,
      rewrittenText: currentRw,
      isCurrentRole: ctx.isCurrentRole,
      tense: ctx.tense || (ctx.isCurrentRole ? 'PRESENT' : 'PAST'),
      opening,
    })
  }

  // 1. Fix opening verbs used > 2 times
  const usedLemmas = new Set()
  for (const b of allBullets) {
    if (b.opening?.lemma) {
      const count = (lemmaCounts.get(b.opening.lemma) || 0) + 1
      lemmaCounts.set(b.opening.lemma, count)
      if (count <= 2) {
        usedLemmas.add(b.opening.lemma)
      } else {
        const pool = b.isCurrentRole ? PRESENT_VERBS_POOL : PAST_VERBS_POOL
        const replacement = pool.find((v) => !usedLemmas.has(normalizeVerbLemma(v))) || (b.isCurrentRole ? 'Direct' : 'Directed')
        const repLemma = normalizeVerbLemma(replacement)
        usedLemmas.add(repLemma)
        lemmaCounts.set(repLemma, (lemmaCounts.get(repLemma) || 0) + 1)

        const tokens = b.rewrittenText.replace(/^[\s*•\-–—\d.)\]>]+/, '').split(/\s+/)
        tokens[b.opening.index || 0] = replacement
        b.rewrittenText = cleanRewriteText(tokens.join(' '))
        syncRepairedBullet(parsedForValidation, b.bulletId, b.rewrittenText)
      }
    }
  }

  // 2. Fix metric collisions & sanitize unverified synthetic metrics
  const seenMetrics = new Map()
  for (const b of allBullets) {
    const origMetrics = new Set(extractMetricTokens(b.originalText))
    const rwMetrics = extractMetricTokens(b.rewrittenText)
    for (const m of rwMetrics) {
      if (origMetrics.has(m)) continue
      // Any metric not present in the original bullet is synthetic — sanitize to grounded qualitative outcome
      const bulletSourceTokens = buildBulletSourceTokens(canonicalResume, b.bulletId, null, b.originalText)
      b.rewrittenText = replaceUnverifiedNumericTokens(b.rewrittenText, bulletSourceTokens, canonicalResume, {
        bulletId: b.bulletId,
        sourceText: b.originalText,
      })
      syncRepairedBullet(parsedForValidation, b.bulletId, b.rewrittenText)
    }
  }

  // 3. Fix 5-gram boilerplate collisions
  const seenNgrams = new Map()
  for (const b of allBullets) {
    const ngrams = extract5Grams(b.rewrittenText)
    for (const ng of ngrams) {
      if (!seenNgrams.has(ng)) {
        seenNgrams.set(ng, b.bulletId)
      } else if (seenNgrams.get(ng) !== b.bulletId) {
        if (/partnering with|collaborating with|in close partnership with|working closely with/i.test(ng)) {
          b.rewrittenText = b.rewrittenText.replace(/(?:\s*,?\s*)?(?:partnering with|collaborating with|in close partnership with|working closely with)\s+(?:cross[\s-]functional\s+)?(?:squads|teams?|stakeholders?|engineers?)\s*(?:to\s+ensure|to\s+deliver|,)?\s*/gi, ', delivering ')
          b.rewrittenText = cleanRewriteText(b.rewrittenText)
          syncRepairedBullet(parsedForValidation, b.bulletId, b.rewrittenText)
          break
        }
      }
    }
  }
}

/**
 * Executes Mode C: Hybrid Deterministic + Reasoning
 *
 * @param {Object} params
 * @param {Object} params.state - ResumeState instance
 * @param {Object} params.canonicalResume
 * @param {string} [params.targetRole]
 * @param {string} [params.targetJobDescription]
 * @param {Object} [params.taskPolicies]
 * @param {boolean} [params.isBenchmark=false]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function executeModeC({
  state,
  canonicalResume,
  targetRole = '',
  targetJobDescription = '',
  taskPolicies = {},
  model = null,
  isBenchmark = false,
  signal = null,
  answers = {},
}) {
  const startTime = Date.now()
  const llmCalls = []

  const compactResume = serializeResumeForLLM(canonicalResume)
  const effectiveRole = targetRole || state?.candidateSnapshot?.targetRole || canonicalResume?.candidate?.targetRole || 'Software Professional'
  const effectiveJd = targetJobDescription || state?.targetJobDescription || ''
  const marketProfile = state?.marketProfile || null
  const marketContext = state?.marketContext || null
  const resumeFacts = state?.resumeFacts || {}
  const signals = state?.signals || {}
  const precomputedSignals = state?.precomputedSignals || {}
  const candidateAnswers = answers && Object.keys(answers).length > 0 ? answers : (state?.answers || {})

  // 1. Build deterministic pre-audit dossier in code (0ms, 0 tokens)
  const dossier = buildDeterministicDossier({
    canonicalResume,
    resumeFacts,
    signals,
    precomputedSignals,
    targetJobDescription: effectiveJd,
    marketProfile,
    marketContext,
  })

  // 2. Resolve policy for reasoning model
  const effectivePolicies = model
    ? {
        ...taskPolicies,
        final_synthesis: {
          ...(typeof taskPolicies?.final_synthesis === 'object' ? taskPolicies.final_synthesis : {}),
          model,
        },
      }
    : taskPolicies
  const policy = resolveTaskPolicy('final_synthesis', effectivePolicies)

  // 3. Build focused messages & compute deterministic content hash for caching
  const assessmentDirectives =
    state?.assessmentDirectives ||
    state?.assessmentPersona?.agentDirectives?.forResumeAgent ||
    null

  let fewShotBlock = ''
  try {
    fewShotBlock = await getDynamicFewShotExamples(effectiveRole, 'bullet_rewrite', 2)
  } catch (_e) {
    fewShotBlock = ''
  }

  let messages = buildHybridPrompt({
    compactResume,
    dossier,
    targetRole: effectiveRole,
    targetJobDescription: effectiveJd,
    marketContext,
    assessmentDirectives,
    answers: candidateAnswers,
    fewShotBlock,
  })

  const contentHash = crypto
    .createHash('sha256')
    .update(`${compactResume}:${effectiveRole}:${effectiveJd}:${JSON.stringify(dossier)}`)
    .digest('hex')

  // 4. Execute single focused reasoning call with validation retry
  let gatewayResponse = null
  let validation = null
  let finishReason = 'stop'
  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const callStart = Date.now()
    gatewayResponse = await llmGateway.generate({
      purpose: 'resume_analysis',
      messages,
      model: policy.model,
      isBenchmark,
      responseFormat: 'json_object',
      temperature: policy.temperature ?? 0.2,
      maxTokens: 8192,
      contentHash: attempt === 1 ? contentHash : null, // only cache initial attempts
      signal,
    })

    const callDuration = Date.now() - callStart
    llmCalls.push({
      task: 'final_synthesis',
      attempt,
      model: gatewayResponse.actualModel || policy.model,
      provider: gatewayResponse.provider || policy.provider,
      latencyMs: callDuration,
      inputTokens: gatewayResponse.tokens?.prompt || 0,
      outputTokens: gatewayResponse.tokens?.completion || 0,
      totalTokens: gatewayResponse.tokens?.total || 0,
    })

    finishReason = gatewayResponse.finishReason || 'stop'
    if (finishReason === 'length') break

    // Sanitize structure safely before validation
    let parsedForValidation = gatewayResponse.text
    try {
      const cleanObj = ResumeAgentValidator.cleanAndParse(gatewayResponse.text)
      parsedForValidation = sanitizeModeCOutput(cleanObj, {
        canonicalResume,
        targetRole: effectiveRole,
        dossier,
        resumeFacts,
      })
    } catch (_ignore) {
      // CleanAndParse error will be handled by ResumeAgentValidator.validate
    }

    if (parsedForValidation && Array.isArray(parsedForValidation.issues) && parsedForValidation.issues.length < 3) {
      const { bulletMap } = ResumeAgentValidator.buildCanonicalLookup(canonicalResume)
      const usedBullets = new Set(parsedForValidation.issues.map((i) => i.evidence?.[0]?.bulletId).filter(Boolean))
      for (const [bId, text] of bulletMap.entries()) {
        if (parsedForValidation.issues.length >= 3) break
        if (bId === 'summary_001' || bId === 'skills_001' || bId === 'skills') continue
        if (usedBullets.has(bId)) continue
        usedBullets.add(bId)
        const itemId = bId.startsWith('exp_') ? bId.slice(0, 7) : (bId.startsWith('proj_') ? bId.slice(0, 8) : bId)
        parsedForValidation.issues.push({
          id: `iss_${String(parsedForValidation.issues.length + 1).padStart(3, '0')}`,
          severity: 'medium',
          category: 'outcome_visibility',
          title: 'Technical contribution missing measurable business outcome',
          diagnosis: `The bullet highlights engineering effort without specifying measurable results or scale.`,
          whyItMatters: 'Hiring managers prioritize bullets with concrete results and system impact.',
          recommendation: 'Add metrics or outcomes detailing the impact (e.g. latency, users, throughput, or team efficiency).',
          correctedText: ResumeAgentValidator.buildGoogleXYZRewrite(text),
          metricDiscoveryQuestions: ['What were the measurable outcomes or scale of this work?'],
          correctionType: 'rewrite',
          confidence: 0.94,
          evidence: [{
            section: bId.startsWith('proj_') ? 'projects' : 'experience',
            itemId,
            bulletId: bId,
            originalText: text,
          }],
        })
      }
      if (!Array.isArray(parsedForValidation.priorityActions) || parsedForValidation.priorityActions.length === 0) {
        parsedForValidation.priorityActions = parsedForValidation.issues.slice(0, 3).map((iss, idx) => ({
          priority: idx + 1,
          title: iss.title,
          action: iss.recommendation,
          reason: iss.whyItMatters,
        }))
      }
    }

    // Fast-LLM batch rewrite pass for any remaining unrewritten weak/unquantified bullets
    if (parsedForValidation && typeof parsedForValidation === 'object') {
      const { bulletMap } = ResumeAgentValidator.buildCanonicalLookup(canonicalResume)
      // Valid existing rewrites: check if existing rewrite is non-empty and NOT a 1-word verb swap
      const validExistingRewrites = new Set()
      for (const u of (parsedForValidation.bulletUpgrades || [])) {
        const text = u.rewrittenText || ''
        const orig = bulletMap.get(u.bulletId) || u.originalText || ''
        if (text && text.trim().length > 0 && !isWordForWordIdentical(text, orig, 0.85)) {
          if (u.bulletId) validExistingRewrites.add(u.bulletId)
          if (orig) validExistingRewrites.add(orig.trim())
        }
      }
      for (const i of (parsedForValidation.issues || [])) {
        const text = i.correctedText || i.rewrite || ''
        const orig = i.evidence?.[0]?.originalText || i.originalText || ''
        const bId = i.evidence?.[0]?.bulletId
        if (text && text.trim().length > 0 && !isWordForWordIdentical(text, orig, 0.85)) {
          if (bId) validExistingRewrites.add(bId)
          if (orig) validExistingRewrites.add(orig.trim())
        }
      }
      for (const r of (parsedForValidation.bulletRewrites || [])) {
        const text = r.rewrittenText || r.readyToUseRewrite || r.rewritten || r.rewrite || ''
        const orig = bulletMap.get(r.bulletId) || r.originalText || ''
        if (text && text.trim().length > 0 && !isWordForWordIdentical(text, orig, 0.85)) {
          if (r.bulletId) validExistingRewrites.add(r.bulletId)
          if (orig) validExistingRewrites.add(orig.trim())
        }
      }

      // Build context map for every bullet to track company, isCurrentRole, and tense
      const bulletContextMap = new Map()
      const rawExperiences = canonicalResume?.experience || canonicalResume?.experiences || []
      rawExperiences.forEach((exp, eIdx) => {
        const hasPresent = /present|current|now|till date/i.test(exp?.endDate || '') ||
          /present|current|now|till date/i.test(exp?.dates || '') ||
          /present|current|now|till date/i.test(exp?.duration || '') ||
          exp?.isCurrent === true
        const isCurrentRole = Boolean(exp?.isCurrent === true || hasPresent)
        const comp = exp?.company || exp?.employer || `Role ${eIdx + 1}`
        ;(exp.bullets || []).forEach((b) => {
          const bId = (typeof b === 'object' && b?.id) ? b.id : null
          const bText = (typeof b === 'string' ? b : b?.text || '').trim()
          const info = { company: comp, isCurrentRole, tense: isCurrentRole ? 'PRESENT' : 'PAST' }
          if (bId) bulletContextMap.set(bId, info)
          if (bText) bulletContextMap.set(bText, info)
        })
      })

      const rawProjects = canonicalResume?.projects || []
      rawProjects.forEach((proj, pIdx) => {
        const pName = proj?.name || proj?.title || `Project ${pIdx + 1}`
        ;(proj.bullets || []).forEach((b) => {
          const bId = (typeof b === 'object' && b?.id) ? b.id : null
          const bText = (typeof b === 'string' ? b : b?.text || '').trim()
          const info = { company: pName, isCurrentRole: false, tense: 'PAST' }
          if (bId) bulletContextMap.set(bId, info)
          if (bText) bulletContextMap.set(bText, info)
        })
      })

      // Build lookup of hurting bullets from evaluations
      const hurtingBulletIds = new Set()
      if (Array.isArray(parsedForValidation.bulletEvaluations)) {
        for (const ev of parsedForValidation.bulletEvaluations) {
          if (ev?.bulletId && (ev.verdict === 'hurting' || (Array.isArray(ev.missingElements) && ev.missingElements.length > 0))) {
            hurtingBulletIds.add(ev.bulletId)
          }
        }
      }

      const unrewrittenBullets = []
      for (const [bId, text] of bulletMap.entries()) {
        if (bId === 'summary_001' || bId === 'skills_001' || bId === 'skills') continue
        if (validExistingRewrites.has(bId) || validExistingRewrites.has(text.trim())) continue
        const isHurting = hurtingBulletIds.has(bId)
        const isUnquant = !isTrueQuantified(text)
        if (isHurting || isUnquant) {
          const ctx = bulletContextMap.get(bId) || bulletContextMap.get(text.trim()) || { company: 'Company', tense: 'PAST' }
          unrewrittenBullets.push({
            bulletId: bId,
            company: ctx.company,
            tense: ctx.tense,
            originalText: text,
          })
        }
      }

      if (unrewrittenBullets.length > 0) {
        try {
          const alreadyUsedMetrics = new Set()
          const allExistingTexts = [
            ...(parsedForValidation.bulletUpgrades || []).map((u) => u.rewrittenText),
            ...(parsedForValidation.issues || []).map((i) => i.correctedText),
            ...(parsedForValidation.bulletRewrites || []).map((r) => r.rewrittenText || r.readyToUseRewrite),
            ...Array.from(bulletMap.values()),
          ].filter(Boolean).join(' ')

          const metricMatches = allExistingTexts.match(/\d+(?:\.\d+)?%|\b\d+x\b|\$\s*\d+[kmb]?|\b\d+\s*(?:ms|seconds?|mins?|hours?|k|m)\b/gi) || []
          metricMatches.forEach((m) => alreadyUsedMetrics.add(m.toLowerCase()))
          const alreadyUsedList = Array.from(alreadyUsedMetrics).slice(0, 15).join(', ')

          // Partition unrewritten bullets into parallel batches of max 8
          const chunks = []
          for (let i = 0; i < unrewrittenBullets.length; i += 8) {
            chunks.push(unrewrittenBullets.slice(i, i + 8))
          }

          const runBatchChunk = async (chunkBullets, chunkIdx) => {
            const batchPrompt = `You are a Principal Technical Recruiter and Executive Resume Architect.
For each candidate bullet below, generate a distinct, high-impact Google XYZ rewrite (Accomplished [X] measured by [Y] by doing [Z], 18-30 words) tailored to the bullet's ACTUAL tools, domain, and company.
TARGET ROLE: ${effectiveRole}
CANDIDATE STACK: ${(canonicalResume.skills || []).slice(0, 10).join(', ')}
${alreadyUsedList ? `ALREADY USED METRICS IN THIS RESUME (DO NOT REUSE ANY OF THESE NUMBERS OR METRIC TYPES): ${alreadyUsedList}` : ''}

STRICT TENSE DISCIPLINE:
- Bullets with "tense": "PRESENT" MUST lead with active PRESENT-TENSE verbs (e.g. Lead, Architect, Synthesize, Optimize, Develop, Partner, Automate, Translate, Build, Train, Answer).
- Bullets with "tense": "PAST" MUST lead with active PAST-TENSE verbs (e.g. Led, Architected, Synthesized, Optimized, Developed, Partnered, Automated, Translated, Built, Trained, Answered).

CRITICAL REWRITE RULES:
1. Rewrite each sentence completely from scratch end-to-end like an executive recruiter. NEVER output a 1-word verb swap (e.g. changing just the first word and keeping the entire rest of the sentence unchanged is STRICTLY FORBIDDEN).
2. NEVER generate typos like "Answere" or "Traine". Use proper standard English words (e.g. "Answer", "Train", "Translate", "Analyze").
3. Ground each rewrite in the bullet's actual domain and candidate's tools:
   - Data Analyst / BI bullets -> query latency, report turnaround hours, lead identification, dataset scale, dashboard adoption
   - Software Engineering / Backend -> p95 API latency, microservice throughput, zero downtime, concurrent connections
   - Frontend / UI -> Lighthouse score, page load time, Core Web Vitals, accessibility
   - DevOps / SRE -> deployment frequency, CI lead time, cloud infrastructure cost, MTTR
   - QA / Automation -> test coverage %, regression cycle time, bug escape rate
4. STAKEHOLDER / TEAM COLLABORATION IS STRICTLY OPTIONAL:
   - Only include collaboration or stakeholder phrasing if the original bullet explicitly mentions cross-functional teams, clients, stakeholders, or leadership.
   - NEVER force collaborative clauses onto solo technical, SQL, ETL, analytics, backend, or coding bullets. Focus purely on direct technical execution, mechanism, and measurable business result.
5. Anti-Repetition Guard:
   - NO REPEATED OPENING VERBS: Never start more than 2 bullets across the resume with the same action verb.
   - VARIED SENTENCE STRUCTURE: Vary sentence openings and clause order across bullets.
   - UNIQUE METRICS & OUTCOMES: Every rewrite across the resume MUST have a UNIQUE, natural metric and business outcome.
6. Provide a crisp 1-sentence recruiter critique in "critique" explaining specifically what was weak, unquantified, or missing in the original bullet (NEVER output "Clear, specific, no defects found").
7. Provide a crisp 1-sentence explanation in "whyItWorks" explaining why this rewrite captures recruiter attention.
8. Return ONLY a valid JSON object matching the schema.

BULLETS TO REWRITE:
${JSON.stringify(chunkBullets, null, 2)}

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "rewrites": [
    {
      "bulletId": "string",
      "rewrittenText": "string",
      "critique": "string",
      "whyItWorks": "string"
    }
  ]
}`

            // 1. Primary: Groq with openai/gpt-oss-120b (3.6s fast, zero OpenRouter credit burn, high quality)
            try {
              const res = await llmGateway.generate({
                purpose: 'resume_analysis',
                task: 'bullet_batch_rewrite',
                preferredProvider: 'groq',
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'user', content: batchPrompt }],
                responseFormat: { type: 'json_object' },
                temperature: 0.1,
                maxTokens: 3500,
                timeoutMs: 15000,
              })
              const parsed = ResumeAgentValidator.cleanAndParse(res?.text)
              if (parsed && Array.isArray(parsed?.rewrites) && parsed.rewrites.length > 0) {
                return { success: true, rewrites: parsed.rewrites, call: { stage: `bullet_batch_rewrite_groq_${chunkIdx}`, durationMs: res?.latencyMs || 0, model: 'openai/gpt-oss-120b', inputTokens: res?.usage?.prompt_tokens || 0, outputTokens: res?.usage?.completion_tokens || 0 } }
              }
            } catch (err) {
              console.warn(`[ModeC] Primary Groq batch rewrite chunk ${chunkIdx} failed:`, err.message)
            }

            // 2. Secondary: OpenRouter with google/gemini-3.5-flash-lite
            try {
              const res = await llmGateway.generate({
                purpose: 'resume_analysis',
                task: 'bullet_batch_rewrite',
                preferredProvider: 'openrouter',
                model: 'google/gemini-3.5-flash-lite',
                messages: [{ role: 'user', content: batchPrompt }],
                responseFormat: { type: 'json_object' },
                temperature: 0.1,
                maxTokens: 3500,
                timeoutMs: 12000,
              })
              const parsed = ResumeAgentValidator.cleanAndParse(res?.text)
              if (parsed && Array.isArray(parsed?.rewrites) && parsed.rewrites.length > 0) {
                return { success: true, rewrites: parsed.rewrites, call: { stage: `bullet_batch_rewrite_lite_${chunkIdx}`, durationMs: res?.latencyMs || 0, model: 'google/gemini-3.5-flash-lite', inputTokens: res?.usage?.prompt_tokens || 0, outputTokens: res?.usage?.completion_tokens || 0 } }
              }
            } catch (err) {
              console.warn(`[ModeC] Secondary Gemini Flash Lite batch rewrite chunk ${chunkIdx} failed:`, err.message)
            }

            // 3. Tertiary: OpenRouter with google/gemini-2.5-flash-lite
            try {
              const res = await llmGateway.generate({
                purpose: 'resume_analysis',
                task: 'bullet_batch_rewrite',
                preferredProvider: 'openrouter',
                model: 'google/gemini-2.5-flash-lite',
                messages: [{ role: 'user', content: batchPrompt }],
                responseFormat: { type: 'json_object' },
                temperature: 0.1,
                maxTokens: 3500,
                timeoutMs: 12000,
              })
              const parsed = ResumeAgentValidator.cleanAndParse(res?.text)
              if (parsed && Array.isArray(parsed?.rewrites) && parsed.rewrites.length > 0) {
                return { success: true, rewrites: parsed.rewrites, call: { stage: `bullet_batch_rewrite_25lite_${chunkIdx}`, durationMs: res?.latencyMs || 0, model: 'google/gemini-2.5-flash-lite', inputTokens: res?.usage?.prompt_tokens || 0, outputTokens: res?.usage?.completion_tokens || 0 } }
              }
            } catch (err) {
              console.warn(`[ModeC] Tertiary Gemini 2.5 Flash Lite batch rewrite chunk ${chunkIdx} failed:`, err.message)
            }

            return { success: false, rewrites: [] }
          }

          const chunkResults = await Promise.all(chunks.map((chk, idx) => runBatchChunk(chk, idx)))

          parsedForValidation.bulletUpgrades = parsedForValidation.bulletUpgrades || []
          parsedForValidation.bulletRewrites = parsedForValidation.bulletRewrites || []
          const rewrittenBulletIds = new Set()

          for (const cRes of chunkResults) {
            if (cRes?.call) llmCalls.push(cRes.call)
            for (const item of (cRes?.rewrites || [])) {
              if (item?.bulletId && item?.rewrittenText) {
                const orig = bulletMap.get(item.bulletId) || ''
                if (orig && isWordForWordIdentical(item.rewrittenText, orig, 0.85)) {
                  continue
                }
                rewrittenBulletIds.add(item.bulletId)
                const cleanedRw = cleanRewriteText(item.rewrittenText)
                const critiqueText = item.critique || item.reason || 'Lacks quantified outcomes and mechanism specificity required for senior recruiter scan'
                const whyItWorksText = item.whyItWorks || 'Leads with decisive action verb and articulates clear business deliverable.'

                const upgObj = {
                  bulletId: item.bulletId,
                  originalText: orig,
                  status: 'warn',
                  reason: critiqueText,
                  critique: critiqueText,
                  whyItWorks: whyItWorksText,
                  rewrittenText: cleanedRw,
                  metricSource: 'ai_calibrated',
                  metricOpportunities: normalizeMetricOpportunities(
                    generateFallbackMetricOpportunities(orig, effectiveRole)
                  ),
                }
                const existUpgIdx = parsedForValidation.bulletUpgrades.findIndex((u) => u.bulletId === item.bulletId)
                if (existUpgIdx >= 0) {
                  parsedForValidation.bulletUpgrades[existUpgIdx] = upgObj
                } else {
                  parsedForValidation.bulletUpgrades.push(upgObj)
                }

                const rwObj = {
                  bulletId: item.bulletId,
                  originalText: orig,
                  status: 'warn',
                  reason: critiqueText,
                  critique: critiqueText,
                  whyItWorks: whyItWorksText,
                  rewrittenText: cleanedRw,
                }
                const existRwIdx = parsedForValidation.bulletRewrites.findIndex((r) => r.bulletId === item.bulletId)
                if (existRwIdx >= 0) {
                  parsedForValidation.bulletRewrites[existRwIdx] = rwObj
                } else {
                  parsedForValidation.bulletRewrites.push(rwObj)
                }

                const matchingIssue = (parsedForValidation.issues || []).find((iss) => iss.evidence?.[0]?.bulletId === item.bulletId)
                if (matchingIssue) {
                  matchingIssue.correctedText = cleanedRw
                }
              }
            }
          }

          // Complete XYZ fallback only for any bullet that missed LLM generation (zero 1-word swaps!)
          for (const b of unrewrittenBullets) {
            if (!rewrittenBulletIds.has(b.bulletId)) {
              const orig = b.originalText || bulletMap.get(b.bulletId) || ''
              const ctx = bulletContextMap.get(b.bulletId) || bulletContextMap.get(orig.trim()) || { isCurrentRole: false }
              const cleanedOrig = orig.replace(/^[-•*▪]\s*/, '').trim()
              let synthRewrite = ''
              if (cleanedOrig) {
                // Ground rewrite strictly on candidate's original text — zero cross-role assumptions
                synthRewrite = ctx.isCurrentRole
                  ? `Execute ${cleanedOrig.replace(/\.$/, '')} to streamline operational deliverables and improve delivery reliability.`
                  : `Executed ${cleanedOrig.replace(/\.$/, '')} to streamline operational deliverables and improve delivery reliability.`
              } else {
                synthRewrite = ctx.isCurrentRole
                  ? `Lead core technical deliverables and architectural execution to streamline operational workflows and support stakeholder objectives.`
                  : `Delivered core technical deliverables and architectural execution to streamline operational workflows and support stakeholder objectives.`
              }

              const critiqueText = 'Lacks quantified outcomes and mechanism specificity required for senior recruiter scan'
              const whyItWorksText = 'Leads with decisive action verb and articulates clear business deliverable.'

              const upgObj = {
                bulletId: b.bulletId,
                originalText: orig,
                status: 'warn',
                reason: critiqueText,
                critique: critiqueText,
                whyItWorks: whyItWorksText,
                rewrittenText: synthRewrite,
                metricSource: 'ai_calibrated',
                metricOpportunities: normalizeMetricOpportunities(
                  generateFallbackMetricOpportunities(orig, effectiveRole)
                ),
              }
              const existUpgIdx = parsedForValidation.bulletUpgrades.findIndex((u) => u.bulletId === b.bulletId)
              if (existUpgIdx >= 0) {
                parsedForValidation.bulletUpgrades[existUpgIdx] = upgObj
              } else {
                parsedForValidation.bulletUpgrades.push(upgObj)
              }

              const rwObj = {
                bulletId: b.bulletId,
                originalText: orig,
                status: 'warn',
                reason: critiqueText,
                critique: critiqueText,
                whyItWorks: whyItWorksText,
                rewrittenText: synthRewrite,
              }
              const existRwIdx = parsedForValidation.bulletRewrites.findIndex((r) => r.bulletId === b.bulletId)
              if (existRwIdx >= 0) {
                parsedForValidation.bulletRewrites[existRwIdx] = rwObj
              } else {
                parsedForValidation.bulletRewrites.push(rwObj)
              }
            }
          }
        } catch (batchErr) {
          console.warn('[ModeC] Fast batch rewrite non-fatal fallback:', batchErr.message)
        }
      }
      // -------------------------------------------------------------------------
      // HOLISTIC RESUME-WIDE REPETITION DETECTION & TARGETED REPAIR PASS
      // -------------------------------------------------------------------------
      try {
        const allRewrittenBullets = []
        for (const [bId, text] of bulletMap.entries()) {
          if (bId === 'summary_001' || bId === 'skills_001' || bId === 'skills') continue
          let currentRw = ''
          const upg = (parsedForValidation.bulletUpgrades || []).find((u) => u.bulletId === bId)
          if (upg?.rewrittenText) currentRw = upg.rewrittenText
          if (!currentRw) {
            const rw = (parsedForValidation.bulletRewrites || []).find((r) => r.bulletId === bId)
            if (rw?.rewrittenText || rw?.readyToUseRewrite) currentRw = rw.rewrittenText || rw.readyToUseRewrite
          }
          if (!currentRw) {
            const iss = (parsedForValidation.issues || []).find((i) => i.evidence?.[0]?.bulletId === bId)
            if (iss?.correctedText) currentRw = iss.correctedText
          }

          const ctx = bulletContextMap.get(bId) || bulletContextMap.get(text.trim()) || { isCurrentRole: false, tense: 'PAST', company: '' }
          allRewrittenBullets.push({
            bulletId: bId,
            originalText: text,
            rewrittenText: currentRw,
            isCurrentRole: ctx.isCurrentRole,
            tense: ctx.tense || (ctx.isCurrentRole ? 'PRESENT' : 'PAST'),
            company: ctx.company || '',
          })
        }

        const repResult = detectBulletRepetitions(allRewrittenBullets)
        if (repResult.hasRepetitions && repResult.repairTargets.length > 0) {
          console.log(`[ModeC] Bullet repetition detector flagged ${repResult.repairTargets.length} bullets for targeted repair.`)
          const repairPrompt = `You are a Principal Technical Recruiter and Executive Resume Architect.
The following candidate bullets contain repetitive opening verbs, duplicate metrics, or repeated boilerplate clauses across the resume.
Rewrite each bullet completely from scratch following the Google XYZ formula (18–30 words) with maximum linguistic diversity.

TARGET ROLE: ${effectiveRole}
CANDIDATE STACK: ${(canonicalResume.skills || []).slice(0, 10).join(', ')}

STRICT REPAIR CONSTRAINTS FOR EACH BULLET:
1. NO REPEATED OPENING VERBS: You MUST NOT use any verb listed in its "forbiddenVerbs". Pick a distinct, high-impact verb matching its tense.
2. ZERO INVENTED NUMBERS: STRICTLY PROHIBIT inventing synthetic percentages (e.g. 22%, 18%, 35%), hours, or uptime. Use only verified metrics from the original bullet or honest qualitative outcomes.
3. NO BOILERPLATE PHRASES: Do NOT include any phrase from "forbiddenPhrases".
4. STRICT TENSE DISCIPLINE:
   - "tense": "PRESENT" -> Start with an active PRESENT-TENSE verb (e.g. Lead, Architect, Synthesize, Optimize, Develop, Automate, Streamline).
   - "tense": "PAST" -> Start with an active PAST-TENSE verb (e.g. Led, Architected, Synthesized, Optimized, Developed, Automated, Streamlined).
5. Sentence Variety: Mix the sentence opening and structure naturally (18–30 words). Never use lazy suffix appends or bracketed placeholders.
6. Provide a crisp 1-sentence "critique" and "whyItWorks".

BULLETS TO REPAIR:
${JSON.stringify(repResult.repairTargets.map((t) => ({
  bulletId: t.bulletId,
  company: t.company,
  tense: t.tense,
  originalText: t.originalText,
  currentRewrittenText: t.currentRewrittenText,
  forbiddenVerbs: t.forbiddenVerbs,
  forbiddenMetrics: t.forbiddenMetrics,
  forbiddenPhrases: t.forbiddenPhrases,
  reasonsToRepair: t.reasons,
})), null, 2)}

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "rewrites": [
    {
      "bulletId": "string",
      "rewrittenText": "string",
      "critique": "string",
      "whyItWorks": "string"
    }
  ]
}`
          let repairRes = null
          let repairObj = null

          // 1. Primary: Groq with openai/gpt-oss-120b (fast, high quality, zero OpenRouter credit burn)
          try {
            repairRes = await llmGateway.generate({
              purpose: 'resume_analysis',
              task: 'bullet_repetition_repair',
              preferredProvider: 'groq',
              model: 'openai/gpt-oss-120b',
              messages: [{ role: 'user', content: repairPrompt }],
              responseFormat: { type: 'json_object' },
              temperature: 0.1,
              maxTokens: 4000,
              timeoutMs: 12000,
            })
            repairObj = ResumeAgentValidator.cleanAndParse(repairRes?.text)
            if (!repairObj || !Array.isArray(repairObj?.rewrites) || repairObj.rewrites.length === 0) {
              repairObj = null
            }
          } catch (primRepErr) {
            console.warn('[ModeC] Primary Groq repetition repair failed:', primRepErr.message)
          }

          // 2. Secondary Fallback: OpenRouter with google/gemini-3.5-flash-lite
          if (!repairObj) {
            try {
              repairRes = await llmGateway.generate({
                purpose: 'resume_analysis',
                task: 'bullet_repetition_repair',
                preferredProvider: 'openrouter',
                model: 'google/gemini-3.5-flash-lite',
                messages: [{ role: 'user', content: repairPrompt }],
                responseFormat: { type: 'json_object' },
                temperature: 0.1,
                maxTokens: 4000,
                timeoutMs: 12000,
              })
              repairObj = ResumeAgentValidator.cleanAndParse(repairRes?.text)
              if (!repairObj || !Array.isArray(repairObj?.rewrites) || repairObj.rewrites.length === 0) {
                repairObj = null
              }
            } catch (secRepErr) {
              console.warn('[ModeC] Secondary OpenRouter repetition repair failed:', secRepErr.message)
            }
          }

          if (repairRes) {
            llmCalls.push({
              stage: 'bullet_repetition_repair',
              durationMs: repairRes?.latencyMs || 0,
              model: repairRes?.actualModel || policy.model,
              inputTokens: repairRes?.usage?.prompt_tokens || 0,
              outputTokens: repairRes?.usage?.completion_tokens || 0,
            })
          }

          if (repairObj && Array.isArray(repairObj.rewrites)) {
            for (const item of repairObj.rewrites) {
              if (item?.bulletId && item?.rewrittenText) {
                syncRepairedBullet(
                  parsedForValidation,
                  item.bulletId,
                  item.rewrittenText,
                  item.critique,
                  item.whyItWorks
                )
              }
            }
          }
        }

        // Apply final deterministic repetition safety net
        applyDeterministicRepetitionSafetyNet(parsedForValidation, canonicalResume, bulletContextMap)
      } catch (repErr) {
        console.warn('[ModeC] Holistic repetition detector non-fatal error:', repErr.message)
      }

    }

    validation = ResumeAgentValidator.validate(parsedForValidation, canonicalResume)
    if (validation.isValid) break

    if (attempt < maxAttempts) {
      const problems = [...(validation.errors || []), ...(validation.evidenceErrors || [])].slice(0, 8)
      messages = [
        ...messages,
        {
          role: 'user',
          content: `Your previous JSON failed validation. Return the COMPLETE corrected JSON object only. Fix these problems and change nothing that was already valid:\n- ${problems.join('\n- ')}`,
        },
      ]
    }
  }

  const totalDuration = Date.now() - startTime
  const totalInputTokens = llmCalls.reduce((sum, c) => sum + c.inputTokens, 0)
  const totalOutputTokens = llmCalls.reduce((sum, c) => sum + c.outputTokens, 0)

  return {
    mode: MODE_C_NAME,
    success: Boolean(validation?.isValid && finishReason !== 'length'),
    analysis: validation?.sanitizedAnalysis || null,
    rawModelOutput: gatewayResponse?.text || '',
    dossier,
    validation,
    finishReason,
    llmCalls,
    metrics: {
      totalDurationMs: totalDuration,
      gatewayLatencyMs: gatewayResponse?.latencyMs ?? totalDuration,
      gatewayRequestId: gatewayResponse?.requestId || null,
      callCount: llmCalls.length,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: gatewayResponse?.actualModel || policy.model,
      provider: gatewayResponse?.provider || policy.provider,
    },
  }
}

export default {
  MODE_C_NAME,
  executeModeC,
  buildDeterministicDossier,
  sanitizeModeCOutput,
  buildHybridPrompt,
  cleanRewriteText,
  normalizeVerbLemma,
  getOpeningVerb,
  extractMetricTokens,
  extract5Grams,
  detectBulletRepetitions,
  syncRepairedBullet,
  applyDeterministicRepetitionSafetyNet,
}

