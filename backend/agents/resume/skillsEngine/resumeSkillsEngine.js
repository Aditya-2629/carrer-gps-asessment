/**
 * Resume Skills Engine
 *
 * Distills and operationalizes core frameworks from ResumeSkills:
 * - resume-bullet-writer: Google X-Y-Z formula ("Accomplished [X] as measured by [Y] by doing [Z]"),
 *   STAR/CAR frameworks, categorized power verbs, duty-to-achievement conversion.
 * - resume-quantifier: 6-dimensional metric discovery (Money, Time, Percentages, Volume/Scale, Quality, Frequency).
 * - tech-resume-optimizer: Technical depth vs business impact, anti-tool-dumping, engineering ownership.
 * - resume-ats-optimizer: ATS readability, active verb starts, scannability, bullet length.
 *
 * Deterministic — NO LLM calls.
 */

// ── Categorized Power Verbs (from resume-bullet-writer & tech-resume-optimizer) ──
export const POWER_VERBS = {
  leadership: [
    'Led', 'Directed', 'Managed', 'Supervised', 'Coordinated',
    'Spearheaded', 'Orchestrated', 'Oversaw', 'Championed', 'Mentored',
  ],
  achievement: [
    'Achieved', 'Delivered', 'Exceeded', 'Surpassed', 'Attained',
    'Secured', 'Won', 'Earned', 'Captured', 'Clinched',
  ],
  growth: [
    'Grew', 'Increased', 'Boosted', 'Expanded', 'Scaled',
    'Elevated', 'Amplified', 'Maximized', 'Accelerated', 'Doubled',
  ],
  creation: [
    'Created', 'Developed', 'Designed', 'Built', 'Launched',
    'Pioneered', 'Established', 'Founded', 'Introduced', 'Architected',
    'Engineered', 'Authored', 'Constructed', 'Implemented',
  ],
  optimization: [
    'Streamlined', 'Optimized', 'Enhanced', 'Improved', 'Revitalized',
    'Transformed', 'Restructured', 'Modernized', 'Automated', 'Simplified',
    'Refactored', 'Consolidated', 'Standardized', 'Tuned',
  ],
  analysis: [
    'Analyzed', 'Assessed', 'Evaluated', 'Identified', 'Diagnosed',
    'Researched', 'Investigated', 'Examined', 'Audited', 'Forecasted',
    'Benchmarked', 'Mapped',
  ],
  problem_solving: [
    'Resolved', 'Solved', 'Troubleshot', 'Rectified', 'Debugged',
    'Eliminated', 'Reduced', 'Mitigated', 'Prevented', 'Corrected',
    'Remediated',
  ],
}

// Flat set of all power verbs for quick lookup (case-insensitive)
export const ALL_POWER_VERBS_SET = new Set(
  Object.values(POWER_VERBS).flatMap((list) => list.map((v) => v.toLowerCase()))
)

// ── Weak Duty Phrases & Passive Patterns (from resume-bullet-writer) ─────────
export const WEAK_DUTY_PATTERNS = [
  { pattern: /^(?:was\s+)?responsible\s+for\s+(?:the\s+)?/i, label: 'responsible for', suggestedVerbs: ['Led', 'Built', 'Managed', 'Architected'] },
  { pattern: /^(?:was\s+)?tasked\s+with\s+(?:the\s+)?/i, label: 'tasked with', suggestedVerbs: ['Engineered', 'Delivered', 'Executed'] },
  { pattern: /^(?:helped\s+(?:to\s+|with\s+)?|assisted\s+(?:in\s+|with\s+)?)/i, label: 'helped / assisted', suggestedVerbs: ['Collaborated on', 'Co-developed', 'Contributed to', 'Implemented'] },
  { pattern: /^participated\s+in\s+(?:the\s+)?/i, label: 'participated in', suggestedVerbs: ['Contributed to', 'Co-authored', 'Executed'] },
  { pattern: /^worked\s+on\s+(?:the\s+)?/i, label: 'worked on', suggestedVerbs: ['Engineered', 'Developed', 'Built', 'Designed'] },
  { pattern: /^handled\s+(?:the\s+)?/i, label: 'handled', suggestedVerbs: ['Resolved', 'Managed', 'Orchestrated'] },
  { pattern: /^served\s+as\s+(?:the\s+)?/i, label: 'served as', suggestedVerbs: ['Led', 'Acted as', 'Directed'] },
  { pattern: /^involved\s+in\s+(?:the\s+)?/i, label: 'involved in', suggestedVerbs: ['Drove', 'Engineered', 'Coordinated'] },
  { pattern: /^supported\s+(?:the\s+)?/i, label: 'supported', suggestedVerbs: ['Maintained', 'Enhanced', 'Facilitated'] },
]

// ── Bloat / Filler Phrases to Eliminate (from resume-bullet-writer) ──────────
export const FILLER_PHRASES = [
  /\bas part of a team\b/gi,
  /\bworking closely with\b/gi,
  /\bin order to\b/gi,
  /\bduties included\b/gi,
  /\bresponsible for all aspects of\b/gi,
  /\bday-to-day\b/gi,
  /\bon a daily basis\b/gi,
]

// ── 6-Dimensional Metric Categories (from resume-quantifier) ─────────────────
export const METRIC_DIMENSIONS = {
  money: {
    label: 'Money (Revenue, Cost, Budget)',
    patterns: [
      /\$\s*[\d,]+(?:\.\d+)?(?:\s*(?:k|m|b|million|billion))?/gi,
      /\b(?:revenue|cost|budget|arr|mrr|savings?|profit|spend)\b/i,
    ],
    discoveryQuestions: [
      'What was the dollar value or budget associated with this project?',
      'Did this work reduce costs, save engineering hours, or increase revenue?',
    ],
  },
  time: {
    label: 'Time (Latency, Cycle Time, Duration)',
    patterns: [
      /\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|mins?|minutes?|hours?|hrs?|days?|weeks?|months?)\b/gi,
      /\b(?:latency|load\s*time|speedup|turnaround|cycle\s*time|delivery\s*time|faster|time-to-market)\b/i,
    ],
    discoveryQuestions: [
      'By how many milliseconds, seconds, or hours did this improve speed or turnaround?',
      'How much time did this save your team or users each week or month?',
    ],
  },
  percentage: {
    label: 'Percentage (Growth, Reduction, Accuracy)',
    patterns: [
      /\b\d+(?:\.\d+)?\s*%/g,
      /\b\d+(?:\.\d+)?x\b/gi,
    ],
    discoveryQuestions: [
      'What was the percentage improvement, growth rate, or reduction achieved?',
      'By what factor (e.g. 2x, 3x) did throughput, performance, or adoption scale?',
    ],
  },
  scale_volume: {
    label: 'Scale & Volume (Users, Requests, Data, Capacity)',
    patterns: [
      /\b\d+[\d,]*\+?\s*(?:users?|customers?|clients?|endpoints?|microservices?|records?|queries|requests|events|transactions?|concurrent)\b/gi,
      /\b(?:rps|qps|dau|mau|tps|gigabytes?|terabytes?|petabytes?|gb|tb|pb)\b/i,
    ],
    discoveryQuestions: [
      'How many daily/monthly users, transactions, or requests did this system support?',
      'What was the volume of data, records, or concurrent connections handled?',
    ],
  },
  quality: {
    label: 'Quality & Reliability (Uptime, Error Rate, Defect Reduction)',
    patterns: [
      /\b9\d(?:\.\d+)?%\s*(?:uptime|availability|sla)\b/gi,
      /\b(?:error\s*rate|defect\s*rate|uptime|availability|zero-downtime|sla|csat|nps|test\s*coverage)\b/i,
    ],
    discoveryQuestions: [
      'Did this improve system uptime, SLA adherence, or test coverage?',
      'By how much did error rates, bug reports, or customer-reported incidents drop?',
    ],
  },
  frequency: {
    label: 'Frequency & Cadence (Daily/Weekly Throughput, Releases)',
    patterns: [
      /\b\d+\+?\s*(?:per\s+(?:day|week|month|year|sprint)|daily|weekly|monthly|annually)\b/gi,
      /\b(?:daily|weekly|bi-weekly|monthly|sprint\s*cadence)\b/i,
    ],
    discoveryQuestions: [
      'How frequently was this executed, deployed, or monitored (e.g., daily, per sprint)?',
    ],
  },
}

/**
 * Analyzes a resume bullet against the ResumeSkills framework:
 * - Detects duty language vs active power verb
 * - Identifies filler words
 * - Identifies which of the 6 metric dimensions are present vs absent
 * - Generates targeted discovery prompts for missing impact
 *
 * @param {string} text - Raw bullet text
 * @returns {Object} Skill analysis details
 */
export function analyzeBulletSkills(text) {
  if (!text || typeof text !== 'string') {
    return {
      hasDutyVerb: false,
      dutyMatch: null,
      startsWithPowerVerb: false,
      firstWord: '',
      suggestedPowerVerbs: [],
      fillerWordsFound: [],
      detectedMetricDimensions: [],
      missingMetricDimensions: Object.keys(METRIC_DIMENSIONS),
      metricDiscoveryQuestions: [],
      isOverlyLong: false,
      length: 0,
      xyzReady: false,
    }
  }

  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()
  const words = trimmed.split(/\s+/)
  const firstWord = words[0]?.replace(/[^a-zA-Z]/g, '').toLowerCase() || ''

  // 1. Duty Verb Check
  let dutyMatch = null
  for (const item of WEAK_DUTY_PATTERNS) {
    if (item.pattern.test(trimmed)) {
      dutyMatch = item
      break
    }
  }

  // 2. Power Verb Check
  const startsWithPowerVerb = ALL_POWER_VERBS_SET.has(firstWord)
  const suggestedPowerVerbs = dutyMatch ? dutyMatch.suggestedVerbs : []

  // 3. Filler Phrases
  const fillerWordsFound = []
  for (const regex of FILLER_PHRASES) {
    regex.lastIndex = 0
    const m = regex.exec(trimmed)
    if (m) {
      fillerWordsFound.push(m[0])
    }
  }

  // 4. Metric Dimensions Detection
  const detectedMetricDimensions = []
  for (const [dimKey, dimData] of Object.entries(METRIC_DIMENSIONS)) {
    const isPresent = dimData.patterns.some((pat) => {
      pat.lastIndex = 0
      return pat.test(trimmed)
    })
    if (isPresent) {
      detectedMetricDimensions.push(dimKey)
    }
  }

  const missingMetricDimensions = Object.keys(METRIC_DIMENSIONS).filter(
    (dim) => !detectedMetricDimensions.includes(dim)
  )

  // 5. Build targeted discovery questions
  const metricDiscoveryQuestions = []
  // Prioritize scale/volume and time/latency for engineering bullets
  if (missingMetricDimensions.includes('time')) {
    metricDiscoveryQuestions.push(...METRIC_DIMENSIONS.time.discoveryQuestions.slice(0, 1))
  }
  if (missingMetricDimensions.includes('scale_volume')) {
    metricDiscoveryQuestions.push(...METRIC_DIMENSIONS.scale_volume.discoveryQuestions.slice(0, 1))
  }
  if (missingMetricDimensions.includes('percentage') && detectedMetricDimensions.length === 0) {
    metricDiscoveryQuestions.push(...METRIC_DIMENSIONS.percentage.discoveryQuestions.slice(0, 1))
  }

  const isOverlyLong = trimmed.length > 220 || words.length > 35
  const xyzReady = startsWithPowerVerb && detectedMetricDimensions.length > 0 && !dutyMatch

  return {
    hasDutyVerb: !!dutyMatch,
    dutyMatch: dutyMatch?.label || null,
    startsWithPowerVerb,
    firstWord,
    suggestedPowerVerbs,
    fillerWordsFound,
    detectedMetricDimensions,
    missingMetricDimensions,
    metricDiscoveryQuestions,
    isOverlyLong,
    length: trimmed.length,
    wordCount: words.length,
    xyzReady,
  }
}

/**
 * Formats a compact skill guidance block for the LLM synthesis user prompt.
 * Pinpoints bullets with duty verbs or high optimization potential.
 *
 * @param {Array<{id: string, text: string}>} bullets
 * @returns {string} Compact prompt block
 */
export function formatSkillGuidanceForPrompt(bullets) {
  if (!Array.isArray(bullets) || bullets.length === 0) return ''

  const highPriorityOpportunities = []

  for (const b of bullets) {
    if (!b?.id || !b?.text) continue
    const skillAnalysis = analyzeBulletSkills(b.text)

    if (skillAnalysis.hasDutyVerb || skillAnalysis.fillerWordsFound.length > 0 || (skillAnalysis.detectedMetricDimensions.length === 0 && skillAnalysis.wordCount > 15)) {
      const parts = []
      if (skillAnalysis.hasDutyVerb) {
        parts.push(`uses duty phrase "${skillAnalysis.dutyMatch}" -> suggest power verbs: ${skillAnalysis.suggestedPowerVerbs.join(', ')}`)
      }
      if (skillAnalysis.fillerWordsFound.length > 0) {
        parts.push(`contains filler: "${skillAnalysis.fillerWordsFound.join(', ')}"`)
      }
      if (skillAnalysis.detectedMetricDimensions.length === 0) {
        parts.push(`unquantified -> discovery prompt: "${skillAnalysis.metricDiscoveryQuestions[0] || 'What was the scale or performance result?'}"`)
      }
      highPriorityOpportunities.push(`- [${b.id}]: ${parts.join('; ')}`)
    }
  }

  if (highPriorityOpportunities.length === 0) return ''

  const lines = [
    '## RESUME SKILL FRAMEWORK GUIDANCE (Google X-Y-Z & Metric Discovery)',
    'Use these transformation signals to sharpen issue recommendations and correctedText rewrites:',
    ...highPriorityOpportunities.slice(0, 8),
  ]

  return lines.join('\n')
}

export default {
  POWER_VERBS,
  ALL_POWER_VERBS_SET,
  WEAK_DUTY_PATTERNS,
  FILLER_PHRASES,
  METRIC_DIMENSIONS,
  analyzeBulletSkills,
  formatSkillGuidanceForPrompt,
}
