/**
 * LinkedIn Agent — V2.0 (Hybrid Deterministic-Audit + Generative-Optimizer)
 *
 * Full pipeline:
 * 1. Data Cleaning & Normalization (linkedinNormalizer.js)
 * 2. Deterministic Pre-Audit Engine (linkedinSignalEngine.js)
 * 3. Cross-Agent Discrepancy Engine (linkedinCrossAnalyzer.js)
 * 4. 100-Point Recruiter Rubric Scorecard (linkedinScorecard.js)
 * 5. Generative Optimizer: 1 LLM call for Headlines, About, Skills, & Red Flags (linkedinSynthesis.js)
 *
 * Zero breaking changes: Preserves contract shape (score, grade, grades, checks, issues)
 * so existing frontend components (ResumeScoreCard, LinkedInDeepDiagnosis) render without modification.
 */

import { normalizeLinkedInProfile } from './linkedinNormalizer.js'
import { extractLinkedInSignals } from './linkedinSignalEngine.js'
import { extractLinkedInActivitySignals } from './linkedinActivityEngine.js'
import {
  evaluateThoughtLeadershipAndSocialSeo,
  buildDeterministicThoughtLeadership,
} from './linkedinThoughtLeadershipEvaluator.js'
import { analyzeCrossAgentDiscrepancies } from './linkedinCrossAnalyzer.js'
import { computeLinkedInScorecard } from './linkedinScorecard.js'
import {
  synthesizeLinkedInOptimizations,
  buildDeterministicOptimizations,
} from './linkedinSynthesis.js'

export const LINKEDIN_AGENT_VERSION = '4.0.0'

/**
 * Builds the empty/no-data payload when profile is null or unparseable.
 */
function makeNoDataResult() {
  return {
    agent: 'linkedin',
    version: LINKEDIN_AGENT_VERSION,
    computedAt: new Date().toISOString(),
    dataAvailable: false,
    score: 0,
    grade: 'F',
    gradeLabel: 'No Data',
    grades: {},
    checks: [],
    issues: [],
    timelineMismatches: [],
    timelineWarnings: [],
    titleDrift: [],
    skillGaps: [],
    discrepancies: [],
    droppedImpact: [],
    missingSkills: [],
    missingSections: [],
    visualAudit: { hasPicture: false, hasBanner: false, issues: [] },
    activitySignals: null,
    thoughtLeadership: null,
    optimizations: null,
    summary: { fix: 0, warn: 0, pass: 0 },
  }
}

/**
 * Resolves the effective LinkedIn profile:
 * If a valid scraped or uploaded profile is provided, uses it.
 * If raw LinkedIn data is missing/invalid, infers profile foundations from verified resumeContext.
 *
 * @param {Object} rawProfile
 * @param {Object} resumeContext
 * @returns {Object} Normalized profile (isValid: true or false)
 */
export function inferProfileFromResume(rawProfile, resumeContext = {}) {
  const canonical =
    resumeContext?.canonicalResume ||
    resumeContext?.resumeJson ||
    resumeContext?.resumeAgent?.canonicalResume ||
    resumeContext

  const candidateSnap = resumeContext?.candidateSnapshot || resumeContext?.resumeAgent?.candidateSnapshot || {}

  const candidateName =
    canonical?.candidate?.name ||
    canonical?.candidate_name ||
    canonical?.name ||
    candidateSnap.name ||
    resumeContext?.candidateName ||
    ''

  const rawTargetRole =
    resumeContext?.targetRole ||
    canonical?.candidate?.targetRole ||
    canonical?.candidate_name_target_role ||
    canonical?.target_role ||
    canonical?.targetRole ||
    candidateSnap.targetRole ||
    ''
  const targetRole = (
    typeof rawTargetRole === 'string'
      ? rawTargetRole
      : (rawTargetRole?.title || rawTargetRole?.value || rawTargetRole?.label || rawTargetRole?.name || rawTargetRole?.targetRole || String(rawTargetRole || ''))
  ).trim()

  const resumeExperiences = Array.isArray(canonical?.experience)
    ? canonical.experience
    : Array.isArray(canonical?.experiences)
    ? canonical.experiences
    : []

  const rawSkills =
    canonical?.skills ||
    canonical?.top_skills ||
    canonical?.technical_skills ||
    candidateSnap.coreSkills ||
    candidateSnap.topSkills ||
    []

  const resumeSkills = (Array.isArray(rawSkills) ? rawSkills : [])
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill))
    .filter(Boolean)

  const resumeEducation = Array.isArray(canonical?.education)
    ? canonical.education
    : Array.isArray(canonical?.educations)
    ? canonical.educations
    : []

  const resumeCerts = Array.isArray(canonical?.certifications)
    ? canonical.certifications
    : Array.isArray(canonical?.licensesAndCertifications)
    ? canonical.licensesAndCertifications
    : []

  const resumeProjects = Array.isArray(canonical?.projects)
    ? canonical.projects
    : Array.isArray(canonical?.featuredProjects)
    ? canonical.featuredProjects
    : []

  const rawObj = rawProfile && typeof rawProfile === 'object' ? rawProfile : {}
  const rawUrl = rawObj.url || rawObj.linkedinUrl || rawObj.profileUrl || ''

  const headline = `${targetRole || 'Professional'} | ${resumeSkills.slice(0, 4).join(' · ')}`
  const about =
    canonical?.summary?.text ||
    (typeof canonical?.summary === 'string' ? canonical.summary : '') ||
    canonical?.professional_summary ||
    canonical?.executive_ai_critique ||
    ''

  return {
    fullName: candidateName || 'Candidate',
    headline,
    about,
    experiences: resumeExperiences.map((exp) => ({
      title: exp.role || exp.title || exp.position || 'Role Not Specified',
      company: exp.company || exp.companyName || 'Company Not Specified',
      dates: exp.dates || exp.duration || exp.dateRange || '',
      description: Array.isArray(exp.bullets)
        ? exp.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).join('\n')
        : (exp.description || ''),
      location: exp.location || '',
      isCurrent: Boolean(exp.isCurrent || /present|current/i.test(exp.dates || exp.duration || '')),
    })),
    education: resumeEducation.map((edu) => ({
      school: edu.institution || edu.school || edu.university || '',
      degree: edu.degree || '',
      fieldOfStudy: edu.field || edu.fieldOfStudy || edu.major || '',
      dates: edu.dates || edu.year || '',
    })),
    certifications: resumeCerts,
    projects: resumeProjects,
    skills: resumeSkills,
    connectionsCount: null,
    recommendationsCount: null,
    pictureUrl: '',
    bannerUrl: '',
    hasPicture: false,
    hasBanner: false,
    url: rawUrl,
    hasCustomUrl: Boolean(rawUrl && /linkedin\.com\/in\/[^/]+/i.test(rawUrl)),
    isValid: true,
    inferredFromResume: true,
    isPrivateProfile: true,
    apifyQuotaFallback: true,
    profileSource: 'resume_inferred',
  }
}

export function resolveEffectiveProfile(rawProfile, resumeContext = {}) {
  let profile = normalizeLinkedInProfile(rawProfile)
  const isPoisonedOrPrivate =
    !profile.isValid ||
    (profile.fullName === 'Not Specified' && (!profile.experiences || profile.experiences.length === 0))

  if (profile.isValid && !isPoisonedOrPrivate && !profile.inferredFromResume) {
    return profile
  }

  // Profile is private or unscraped: infer clean baseline from verified resume
  const inferred = inferProfileFromResume(rawProfile, resumeContext)
  inferred.inferredFromResume = true
  inferred.isPrivateProfile = true
  return inferred
}

/**
 * Deterministic analysis of the candidate's scraped LinkedIn profile and resume context.
 * Can be run synchronously or used as the deterministic base for LLM synthesis.
 *
 * @param {Object} rawProfile - scraped or raw LinkedIn profile data
 * @param {Object} [resumeContext] - { canonicalResume, extractedFacts, targetRole }
 * @returns {Object} Canonical LinkedIn Agent report
 */
export function analyzeLinkedInProfile(rawProfile, resumeContext = {}) {
  const profile = normalizeLinkedInProfile(rawProfile)
  if (!profile.isValid) {
    return makeNoDataResult()
  }

  const rawTargetRole =
    resumeContext?.targetRole ||
    resumeContext?.canonicalResume?.candidate?.targetRole ||
    ''
  const targetRole = (
    typeof rawTargetRole === 'string'
      ? rawTargetRole
      : (rawTargetRole?.title || rawTargetRole?.value || rawTargetRole?.label || rawTargetRole?.name || rawTargetRole?.targetRole || String(rawTargetRole || ''))
  ).trim()

  const signals = extractLinkedInSignals(profile, resumeContext)
  const crossAnalysis = analyzeCrossAgentDiscrepancies(profile, resumeContext, signals)
  const scorecard = computeLinkedInScorecard(signals, crossAnalysis, targetRole)

  return {
    agent: 'linkedin',
    version: LINKEDIN_AGENT_VERSION,
    computedAt: new Date().toISOString(),
    dataAvailable: true,
    inferredFromResume: Boolean(profile.inferredFromResume),
    score: scorecard.score,
    grade: scorecard.grade,
    gradeLabel: scorecard.gradeLabel,
    grades: scorecard.grades,
    checks: scorecard.checks,
    issues: scorecard.issues,
    timelineMismatches: crossAnalysis.timelineMismatches,
    timelineWarnings: crossAnalysis.timelineWarnings || crossAnalysis.timelineMismatches || [],
    titleDrift: crossAnalysis.titleDrift,
    skillGaps: crossAnalysis.skillGaps,
    discrepancies: crossAnalysis.discrepancies,
    droppedImpact: crossAnalysis.droppedImpact,
    missingSkills: crossAnalysis.missingSkills,
    missingSections: crossAnalysis.missingSections || [],
    visualAudit: crossAnalysis.visualAudit || { hasPicture: false, hasBanner: false, issues: [] },
    activitySignals: null,
    thoughtLeadership: null,
    optimizations: null,
    summary: {
      ...scorecard.summary,
      discrepanciesTotal: crossAnalysis.summary.total,
    },
  }
}

/**
 * Full hybrid evaluation pipeline: deterministic audit + cross-analysis + generative synthesis.
 *
 * @param {Object} params
 * @param {Object} [params.linkedinData] - scraped or raw LinkedIn data
 * @param {Object} [params.profile] - alternative alias for linkedinData
 * @param {Object} [params.resumeContext] - { canonicalResume, extractedFacts, targetRole }
 * @param {boolean} [params.runLlm=true] - whether to run LLM synthesis
 * @returns {Promise<Object>} Complete LinkedIn analysis bundle
 */
export async function evaluateLinkedIn({
  linkedinData = null,
  profile = null,
  activityData = null,
  resumeContext = {},
  answers = null,
  runLlm = true,
  onProgress = null,
  excludeProvider = null,
  preferredProvider = null,
  options = {},
}) {
  const effectiveAnswers = answers || resumeContext?.answers || null
  const rawData = linkedinData || profile || null
  let normalized = normalizeLinkedInProfile(rawData)

  // If scraped/provided profile is missing, poisoned, or invalid, infer from resume context
  const hasResume = Boolean(
    resumeContext?.canonicalResume ||
    resumeContext?.resumeJson ||
    resumeContext?.resumeAgent?.canonicalResume ||
    resumeContext?.targetRole ||
    resumeContext?.extractedFacts ||
    resumeContext?.candidateSnapshot
  )

  const isPoisonedOrEmpty =
    !normalized.isValid ||
    (normalized.fullName === 'Not Specified' && (!normalized.experiences || normalized.experiences.length === 0))

  if (isPoisonedOrEmpty) {
    if (hasResume) {
      normalized = resolveEffectiveProfile(rawData, resumeContext)
    }
    if (!normalized.isValid) {
      return makeNoDataResult()
    }
  }

  // Extract candidate ground truth for signals & thought leadership
  const rawTargetRole =
    resumeContext?.targetRole ||
    resumeContext?.canonicalResume?.candidate?.targetRole ||
    normalized?.headline ||
    ''
  const targetRole = (
    typeof rawTargetRole === 'string'
      ? rawTargetRole
      : (rawTargetRole?.title || rawTargetRole?.value || rawTargetRole?.label || rawTargetRole?.name || rawTargetRole?.targetRole || String(rawTargetRole || ''))
  ).trim()

  const canonical = resumeContext?.canonicalResume || {}
  const rawSkills = canonical?.skills || canonical?.top_skills || canonical?.technical_skills || []
  const coreSkills = (Array.isArray(rawSkills) ? rawSkills : [])
    .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill))
    .filter(Boolean)
  const resumeProjects = Array.isArray(canonical?.projects)
    ? canonical.projects
    : Array.isArray(canonical?.featuredProjects)
    ? canonical.featuredProjects
    : []

  // Extract deterministic activity signals (Phase 2)
  const activitySignals = extractLinkedInActivitySignals(activityData, targetRole, coreSkills)

  // 1. Run deterministic base (scorecard + cross-analysis)
  if (onProgress) {
    onProgress({
      stage: 'cross_audit',
      agent: 'linkedin',
      message: 'Cross-auditing resume claims against LinkedIn profile & detecting section omissions…',
    })
  }
  let baseResult
  try {
    baseResult = analyzeLinkedInProfile(normalized, resumeContext)
  } catch (baseErr) {
    console.warn('[LinkedInAgent] analyzeLinkedInProfile encountered error, generating fallback base:', baseErr.message)
    baseResult = makeNoDataResult()
  }
  if (!baseResult.dataAvailable) return baseResult

  // 2. Run generative optimizer if requested
  let optimizations = null
  if (runLlm) {
    if (onProgress) {
      onProgress({
        stage: 'llm_synthesis',
        agent: 'linkedin',
        message: 'Synthesizing All-Star headlines, 3-paragraph story, and Canva blueprint…',
      })
    }
    try {
      const signals = extractLinkedInSignals(normalized, resumeContext)
      optimizations = await synthesizeLinkedInOptimizations(
        normalized,
        resumeContext,
        baseResult.missingSkills || [],
        baseResult.discrepancies || [],
        signals,
        {
          excludeProvider: excludeProvider || resumeContext?.excludeProvider,
          preferredProvider: preferredProvider || resumeContext?.preferredProvider,
          answers: effectiveAnswers,
        }
      )
    } catch (synthErr) {
      console.warn('[LinkedInAgent] Generative synthesis encountered error, falling back to deterministic:', synthErr.message)
      optimizations = buildDeterministicOptimizations(
        normalized,
        resumeContext,
        baseResult.missingSkills || []
      )
    }
  }

  // 3. Evaluate Thought Leadership & Social SEO (Phase 3)
  let thoughtLeadership = null
  if (onProgress) {
    onProgress({
      stage: 'thought_leadership',
      agent: 'linkedin',
      message: 'Evaluating thought leadership authority, cadence velocity, and social SEO blueprints…',
    })
  }

  try {
    thoughtLeadership = await evaluateThoughtLeadershipAndSocialSeo({
      activitySignals,
      posts: Array.isArray(activityData?.posts) ? activityData.posts : [],
      resumeContext,
      options: {
        runLlm,
        preferredProvider: preferredProvider || resumeContext?.preferredProvider,
        excludeProvider: excludeProvider || resumeContext?.excludeProvider,
        ...options,
      },
    })
  } catch (tlErr) {
    console.warn('[LinkedInAgent] Thought leadership evaluation failed:', tlErr.message)
    thoughtLeadership = buildDeterministicThoughtLeadership(
      targetRole,
      coreSkills,
      resumeProjects,
      activitySignals?.isGhostProfile
    )
  }

  return {
    ...baseResult,
    inferredFromResume: Boolean(normalized.inferredFromResume),
    activitySignals,
    thoughtLeadership,
    optimizations: {
      ...(optimizations || {}),
      thoughtLeadership,
    },
  }
}

export class LinkedInAgent {
  static evaluate(params) {
    return evaluateLinkedIn(params)
  }
  static analyze(profile, resumeContext) {
    return analyzeLinkedInProfile(profile, resumeContext)
  }
}

export default {
  LinkedInAgent,
  evaluateLinkedIn,
  analyzeLinkedInProfile,
  LINKEDIN_AGENT_VERSION,
}
