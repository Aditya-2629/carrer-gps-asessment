/**
 * LinkedIn Agent Module Exports
 */

export {
  normalizeLinkedInProfile,
  sanitizeText,
  parseCount,
  normalizeSkills,
} from './linkedinNormalizer.js'

export { extractLinkedInSignals } from './linkedinSignalEngine.js'

export {
  extractLinkedInActivitySignals,
  FLUFF_PATTERNS,
} from './linkedinActivityEngine.js'

export {
  evaluateThoughtLeadershipAndSocialSeo,
  buildDeterministicThoughtLeadership,
} from './linkedinThoughtLeadershipEvaluator.js'

export { analyzeCrossAgentDiscrepancies } from './linkedinCrossAnalyzer.js'

export { computeLinkedInScorecard } from './linkedinScorecard.js'

export {
  LINKEDIN_SYSTEM_PROMPT,
  LINKEDIN_SYNTHESIS_SYSTEM_PROMPT,
  buildLinkedInUserPrompt,
  buildLinkedInSynthesisPrompt,
} from './linkedinSynthesis.prompt.js'

export {
  runLinkedInSynthesis,
  synthesizeLinkedInOptimizations,
  synthesizeHeadlinesAndBanner,
  synthesizeAboutAndFeatured,
  buildDeterministicOptimizations,
} from './linkedinSynthesis.js'

export {
  LinkedInAgent,
  evaluateLinkedIn,
  analyzeLinkedInProfile,
  calculateRecruiterSeoScore,
  generateOptimizedHeadlines,
  evaluateThoughtLeadership,
  LINKEDIN_AGENT_VERSION,
} from './linkedinAgent.js'

import { LinkedInAgent } from './linkedinAgent.js'
export default LinkedInAgent
