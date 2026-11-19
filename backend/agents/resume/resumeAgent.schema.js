/**
 * Resume Agent Schema Definitions and JSON Schemas
 * Standardizes canonical resume representation and agent analysis contract.
 */

export const ANALYSIS_VERSION = '2.2'

export const ISSUE_SEVERITIES = ['high', 'medium', 'low']

export const ISSUE_CATEGORIES = [
  'impact',
  'clarity',
  'positioning',
  'structure',
  'credibility',
  'outcome_visibility',
  'repetition',
  'ats_readability',
  'ownership_clarity',
  'skill_evidence_gap',
  'us_market_alignment',
]

export const CORRECTION_TYPES = [
  'rewrite',
  'trim',
  'clarification',
  'restructure',
  'none',
]

/**
 * Expected shape of an individual issue
 */
export const ISSUE_CONTRACT = {
  id: 'iss_001',
  severity: 'high', // 'high' | 'medium' | 'low'
  category: 'impact',
  title: 'Short descriptive title',
  evidence: {
    section: 'experience', // 'experience' | 'projects' | 'summary' | 'education'
    itemId: 'exp_001',
    bulletId: 'exp_001_b01',
    originalText: 'Exact verbatim text from candidate resume',
  },
  diagnosis: 'What is happening in this section',
  whyItMatters: 'Why a recruiter or hiring manager cares',
  recommendation: 'Clear, actionable advice on how to improve',
  correctedText: null, // String only if safe rewrite from existing evidence; otherwise null
  // V3.1: 1-3 targeted questions that help the candidate DISCOVER their real
  // metric (drawn from the domain playbook). Required when the issue concerns
  // missing quantification/impact; omit or use [] otherwise.
  metricDiscoveryQuestions: [],
  correctionType: 'rewrite', // 'rewrite' | 'trim' | 'clarification' | 'restructure' | 'none'
  confidence: 0.95,
}

/**
 * Required top-level analysis shape
 */
export const REQUIRED_ANALYSIS_FIELDS = [
  'analysisVersion',
  'candidateSnapshot',
  'dashboard',
  'overallReview',
  'strengths',
  'issues',
  'priorityActions',
]

/**
 * Expected shape of an individual bullet evaluation (Phase 1/2 contract)
 * Supports 5-part anatomy scoring (actionVerb, hardSkill, collaboration, metric, outcome)
 * and helping vs hurting verdicts.
 */
export const BULLET_EVALUATION_CONTRACT = {
  bulletId: 'exp_001_b01',
  verdict: 'helping', // 'helping' | 'hurting'
  fivePartFlags: {
    actionVerb: true,
    hardSkill: true,
    collaboration: false,
    metric: true,
    outcome: true,
  },
  isResponsibilityOnly: false,
  missingElements: [],
}

/**
 * Expected shape of a cut list item
 * For filler lines, outdated >5yr irrelevant projects, or 1-page overflow bloat.
 */
export const CUT_LIST_ITEM_CONTRACT = {
  section: 'experience', // 'experience' | 'projects' | 'summary' | 'education' | 'skills'
  itemId: 'exp_001',
  bulletId: null, // string | null
  originalText: 'Exact verbatim text from candidate resume',
  reason: 'Explanation of why this line should be pruned or cut',
}

/**
 * Expected shape of a near-miss keyword item
 * For literal ATS keyword mirroring (e.g., "large-scale systems" -> "distributed systems").
 */
export const NEAR_MISS_KEYWORD_CONTRACT = {
  resumePhrase: 'large-scale systems',
  jdPhrase: 'distributed systems',
  bulletId: 'exp_001_b01', // string | null
  reason: 'ATS scanner matches exact synonym required by target job description',
}
