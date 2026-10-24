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
export function resolveEffectiveProfile(rawProfile, resumeContext = {}) {
  let profile = normalizeLinkedInProfile(rawProfile)
  if (profile.isValid) {
    return profile
  }

  // Fallback: Infer profile structure from canonical resume & target role
  const canonical = resumeContext?.canonicalResume
  const targetRole =
    resumeContext?.targetRole ||
    canonical?.candidate?.targetRole ||
    ''
  const candidateName = canonical?.candidate?.name || ''
  const resumeExperiences = Array.isArray(canonical?.experience)
    ? canonical.experience
    : Array.isArray(canonical?.experiences)
    ? canonical.experiences
    : []
  const resumeSkills = (canonical?.skills || [])
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean)

  if (candidateName || targetRole || resumeExperiences.length > 0 || resumeSkills.length > 0) {
    const rawObj = rawProfile && typeof rawProfile === 'object' ? rawProfile : {}
    const rawUrl = rawObj.url || rawObj.linkedinUrl || rawObj.profileUrl || ''
    return {
      fullName: candidateName || 'Candidate',
      headline: '', // Missing on LinkedIn so optimizer generates recruiter-aligned headlines
      about: '',    // Missing on LinkedIn so optimizer generates 3-paragraph story
      experiences: resumeExperiences.map((exp) => ({
        title: exp.role || exp.title || 'Role Not Specified',
        company: exp.company || 'Company Not Specified',
        dates: exp.dates || '',
        description: Array.isArray(exp.bullets)
          ? exp.bullets.map((b) => (typeof b === 'string' ? b : b.text || '')).join('\n')
          : (exp.description || ''),
        location: exp.location || '',
        isCurrent: Boolean(exp.isCurrent || /present|current/i.test(exp.dates || '')),
      })),
      education: (canonical?.education || []).map((edu) => ({
        school: edu.institution || edu.school || '',
        degree: edu.degree || '',
        fieldOfStudy: edu.field || edu.major || '',
        dates: edu.dates || edu.year || '',
      })),
      certifications: canonical?.certifications || [],
      projects: canonical?.projects || [],
      skills: [], // Empty on profile so cross-analyzer suggests adding verified skills from resume
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
      profileSource: 'resume_inferred',
    }
  }

  return profile
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

  const targetRole =
    resumeContext?.targetRole ||
    resumeContext?.canonicalResume?.candidate?.targetRole ||
    ''

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
  resumeContext = {},
  runLlm = true,
  onProgress = null,
  excludeProvider = null,
  preferredProvider = null,
}) {
  const rawData = linkedinData || profile || null
  let normalized = normalizeLinkedInProfile(rawData)

  // If scraped/provided profile is missing or invalid, check if we can infer from resume context
  const hasResume = Boolean(
    resumeContext?.canonicalResume ||
    resumeContext?.targetRole ||
    resumeContext?.extractedFacts
  )

  if (!normalized.isValid) {
    if (hasResume) {
      normalized = resolveEffectiveProfile(rawData, resumeContext)
    }
    if (!normalized.isValid) {
      return makeNoDataResult()
    }
  }

  // 1. Run deterministic base (scorecard + cross-analysis)
  if (onProgress) {
    onProgress({
      stage: 'cross_audit',
      agent: 'linkedin',
      message: 'Cross-auditing resume claims against LinkedIn profile & detecting section omissions…',
    })
  }
  const baseResult = analyzeLinkedInProfile(normalized, resumeContext)
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

  return {
    ...baseResult,
    inferredFromResume: Boolean(normalized.inferredFromResume),
    optimizations,
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
