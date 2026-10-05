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
