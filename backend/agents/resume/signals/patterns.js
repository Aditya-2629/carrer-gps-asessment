 /**
 * Deterministic Signal Patterns & Keyword Dictionaries — V2.5 Phase 1
 *
 * Centralized configuration for regex patterns and keyword matchers
 * used in deterministic pre-processing signals (BulletSignals, ContactMergeSignal, QuantificationRollup).
 */

// ── Quantifier Patterns ────────────────────────────────────────────────────────
// Matches %, numbers followed by x/X, "hours", "users", "$", or bare numbers >= 2 digits
export const QUANTIFIER_PATTERNS = [
  // Percentage matches (e.g., "35%", "94%")
  /\b\d+(?:\.\d+)?%/g,
  // Multipliers (e.g., "3x", "10X", "3.5x")
  /\b\d+(?:\.\d+)?[xX]\b/g,
  // Currency values (e.g., "$100k", "$50", "$")
  /\$\s*[\d,]+(?:\.\d+)?(?:[kKmMbB]|k|M|B)?/g,
  /\$/g,
  // Specific impact terms: hours, hrs, users (e.g., "50+ hours", "5,000+ users", standalone "hours", "users")
  /\b\d+[\d,]*\+?\s*(?:hours|hrs|users)\b/gi,
  /\b(?:hours|hrs|users)\b/gi,
  // Standalone numbers or numbers with common metric units (e.g., "850ms", "120ms", "50ms", "170", "50", "20+", "12k")
  /\b\d{2,}(?:,\d{3})*(?:\.\d+)?(?:\+)?(?:ms|s|sec|min|k|K|m|M|B)?\b/g,
  /\b\d+(?:\.\d+)?(?:ms|sec)\b/gi,
]

// ── Outcome Verbs ──────────────────────────────────────────────────────────────
// Matches reduc*, increas*, improv*, cut, eliminat*, achiev*, sav*, enabl*, cutting, and -ing forms
export const OUTCOME_VERBS_REGEX = /\b(reduc(?:e|ed|es|ing|tion|tions)?|increas(?:e|ed|es|ing)?|improv(?:e|ed|es|ing|ement|ements)?|cut(?:s|ting)?|eliminat(?:e|ed|es|ing|ion|ions)?|achiev(?:e|ed|es|ing|ement|ements)?|sav(?:e|ed|es|ing|ings)?|enabl(?:e|ed|es|ing)?)\b/i

// ── Contact Merge Detection Patterns ───────────────────────────────────────────
// Detects email, phone number, and professional URLs in summary_001
export const CONTACT_PATTERNS = {
  // Email address pattern
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
  // Phone number pattern (various US/international phone formats)
  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  // Professional URL or bare domain pattern (linkedin.com/, github.com/, or bare domains)
  url: /(?:linkedin\.com\/|github\.com\/|[a-zA-Z0-9-]+\.(?:com|org|io|dev|net|me|ai)\b)/i,
}

// ── Qualitative STAR / CAR Outcomes ───────────────────────────────────────────
// Matches purpose/result clauses demonstrating problem-solving or business value
export const QUALITATIVE_OUTCOME_REGEX =
  /\b(?:to retire|replacing|enforcing|eliminating|preventing|enabling|giving|ensuring|validating|improving|reducing|cutting|shortening|speeding up|lifting|raising|strengthening|simplifying|streamlining|modernizing|automating|securing|sustaining|achieving|delivering)\b/i

// ── Weak / Passive Opening Verbs ───────────────────────────────────────────────
export const WEAK_OPENER_REGEX =
  /^(?:Using|Utilizing|Utilized|Used|Worked on|Working on|Responsible for|Helped|Assisted|Supported|Contributed to|Involved in|Tasked with|Handled|Participated in|Partnering with|Partnered with|Collaborated with|Collaborating with)\b/i

// ── AI Buzzwords & Robotic Clichés ────────────────────────────────────────────
export const AI_BUZZWORDS_REGEX =
  /\b(?:synergized|synergistic|spearheaded cutting-edge|paradigm|holistic|leverage|leveraging|utilized|utilizing|seamlessly|testament to|poised to|dynamic environment|fast-paced environment|go-getter|thought leader|best-in-class|world-class|mission-critical|delved|tapestry|orchestrated a myriad)\b/i

// ── Gerund Opener Regex ────────────────────────────────────────────────────────
export const GERUND_OPENER_REGEX = /^[•\-*▪–—\s]*([a-zA-Z]+ing)\b/i

// ── Common Irregular Past Tense Verbs ─────────────────────────────────────────
export const IRREGULAR_PAST_VERBS = new Set([
  'built', 'led', 'wrote', 'drove', 'oversaw', 'ran', 'held', 'made', 'cut', 'split',
  'set', 'sent', 'spent', 'spoke', 'chose', 'drew', 'grew', 'threw', 'flew', 'knew',
  'began', 'swam', 'sang', 'drank', 'found', 'wound', 'bound', 'ground', 'stood',
  'understood', 'struck', 'stuck', 'strung', 'hung', 'swung', 'dug', 'spun', 'won',
  'shot', 'met', 'fed', 'bled', 'bred', 'fled', 'sped', 'left', 'slept', 'swept',
  'wept', 'crept', 'lost', 'sold', 'bought', 'brought', 'caught', 'thought', 'taught',
])

// ── Common Present Tense Verbs for Engineering / Technical Resumes ────────────
export const COMMON_PRESENT_VERBS = new Set([
  'architect', 'automate', 'build', 'configure', 'coordinate', 'create', 'deliver',
  'deploy', 'design', 'develop', 'direct', 'drive', 'engineer', 'enforce', 'ensure',
  'establish', 'execute', 'guide', 'implement', 'integrate', 'lead', 'maintain',
  'manage', 'mentor', 'migrate', 'modernize', 'monitor', 'optimize', 'orchestrate',
  'oversee', 'perform', 'refactor', 'remediate', 'resolve', 'scale', 'secure',
  'spearhead', 'standardize', 'streamline', 'support', 'test', 'troubleshoot', 'write',
  'analyze', 'author', 'collaborate', 'conduct', 'construct', 'facilitate', 'partner'
])

/**
 * Normalizes an opening verb into a base stem for repetition tracking.
 */
export function getVerbStem(word = '') {
  if (!word) return ''
  const lower = word.toLowerCase().trim()
  const irregularMap = {
    built: 'build', building: 'build', builds: 'build', build: 'build',
    led: 'lead', leading: 'lead', leads: 'lead', lead: 'lead',
    wrote: 'write', writing: 'write', writes: 'write', write: 'write',
    drove: 'drive', driving: 'drive', drives: 'drive', drive: 'drive',
    oversaw: 'oversee', overseeing: 'oversee', oversees: 'oversee', oversee: 'oversee',
    ran: 'run', running: 'run', runs: 'run', run: 'run',
    held: 'hold', holding: 'hold', holds: 'hold', hold: 'hold',
    made: 'make', making: 'make', makes: 'make', make: 'make',
    cut: 'cut', cutting: 'cut', cuts: 'cut',
    split: 'split', splitting: 'split', splits: 'split',
    set: 'set', setting: 'set', sets: 'set',
    sent: 'send', sending: 'send', sends: 'send', send: 'send',
    spent: 'spend', spending: 'spend', spends: 'spend', spend: 'spend',
  }
  if (irregularMap[lower]) return irregularMap[lower]
  if (lower.endsWith('ing')) {
    const base = lower.slice(0, -3)
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1)
    }
    return base
  }
  if (lower.endsWith('ed')) {
    const base = lower.slice(0, -2)
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1)
    }
    return base
  }
  if (lower.endsWith('es')) return lower.slice(0, -2)
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1)
  return lower
}

/**
 * Converts a gerund (-ing) verb into either present tense or past tense.
 */
export function normalizeGerundVerb(word = '', isPresent = true) {
  if (!word) return ''
  const lower = word.toLowerCase().trim()
  const gerundToPresent = {
    remediating: 'Remediate',
    designing: 'Design',
    building: 'Build',
    leading: 'Lead',
    refactoring: 'Refactor',
    developing: 'Develop',
    implementing: 'Implement',
    creating: 'Create',
    architecting: 'Architect',
    automating: 'Automate',
    authoring: 'Author',
    prototyping: 'Prototype',
    partnering: 'Partner',
    collaborating: 'Collaborate',
    applying: 'Apply',
    securing: 'Secure',
    configuring: 'Configure',
    orchestrating: 'Orchestrate',
    optimizing: 'Optimize',
    hardening: 'Harden',
    driving: 'Drive',
    spearheading: 'Spearhead',
    migrating: 'Migrate',
    establishing: 'Establish',
    integrating: 'Integrate',
    deploying: 'Deploy',
    conducting: 'Conduct',
    analyzing: 'Analyze',
    directing: 'Direct',
    managing: 'Manage',
    scaling: 'Scale',
    testing: 'Test',
    monitoring: 'Monitor',
    maintaining: 'Maintain',
  }
  const gerundToPast = {
    remediating: 'Remediated',
    designing: 'Designed',
    building: 'Built',
    leading: 'Led',
    refactoring: 'Refactored',
    developing: 'Developed',
    implementing: 'Implemented',
    creating: 'Created',
    architecting: 'Architected',
    automating: 'Automated',
    authoring: 'Authored',
    prototyping: 'Prototyped',
    partnering: 'Partnered',
    collaborating: 'Collaborated',
    applying: 'Applied',
    securing: 'Secured',
    configuring: 'Configured',
    orchestrating: 'Orchestrated',
    optimizing: 'Optimized',
    hardening: 'Hardened',
    driving: 'Drove',
    spearheading: 'Spearheaded',
    migrating: 'Migrated',
    establishing: 'Established',
    integrating: 'Integrated',
    deploying: 'Deployed',
    conducting: 'Conducted',
    analyzing: 'Analyzed',
    directing: 'Directed',
    managing: 'Managed',
    scaling: 'Scaled',
    testing: 'Tested',
    monitoring: 'Monitored',
    maintaining: 'Maintained',
  }

  if (isPresent) {
    if (gerundToPresent[lower]) return gerundToPresent[lower]
    if (lower.endsWith('ing')) {
      let stem = lower.slice(0, -3)
      if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
        stem = stem.slice(0, -1)
      } else if (!stem.endsWith('e') && !['act', 'adapt', 'adopt', 'affect', 'affirm', 'align', 'audit', 'author', 'boost', 'build', 'chart', 'check', 'clean', 'clear', 'coach', 'craft', 'cross', 'draft', 'drill', 'earn', 'form', 'gain', 'grow', 'guide', 'help', 'hold', 'hunt', 'join', 'launch', 'lead', 'learn', 'lift', 'link', 'load', 'lock', 'mark', 'meet', 'mend', 'mind', 'mold', 'mount', 'open', 'pack', 'pass', 'pick', 'plan', 'post', 'pull', 'push', 'rank', 'read', 'reap', 'root', 'run', 'scan', 'seek', 'sell', 'send', 'set', 'ship', 'show', 'shut', 'sign', 'sink', 'skip', 'sort', 'span', 'spin', 'spur', 'stem', 'step', 'stop', 'swap', 'team', 'tend', 'test', 'track', 'trim', 'turn', 'vet', 'view', 'warn', 'wash', 'win', 'work'].includes(stem)) {
        stem = stem + 'e'
      }
      return stem.charAt(0).toUpperCase() + stem.slice(1)
    }
  } else {
    if (gerundToPast[lower]) return gerundToPast[lower]
    const pres = normalizeGerundVerb(word, true)
    if (pres.endsWith('e')) return pres + 'd'
    return pres + 'ed'
  }
  return word
}

export default {
  QUANTIFIER_PATTERNS,
  OUTCOME_VERBS_REGEX,
  CONTACT_PATTERNS,
  QUALITATIVE_OUTCOME_REGEX,
  WEAK_OPENER_REGEX,
  AI_BUZZWORDS_REGEX,
  GERUND_OPENER_REGEX,
  IRREGULAR_PAST_VERBS,
  COMMON_PRESENT_VERBS,
  getVerbStem,
  normalizeGerundVerb,
}

