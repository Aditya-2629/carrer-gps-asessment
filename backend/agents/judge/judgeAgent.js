/**
 * Judge Agent — the quality gate (evaluator-optimizer pattern).
 *
 * Scores every generated report on a fixed rubric BEFORE it ships:
 *   tone (warm, connected) · specificity (evidence-cited) · safety
 *   (fabrication risk) · us_market_fit · structure
 * Output: 0–10 + subscores + actionable flags. A score below threshold
 * triggers ONE regeneration with the judge's notes (see reportGeneration).
 *
 * The judge uses a cheap, fast model — it runs on every report, so cost
 * matters. If the LLM is unavailable, a deterministic heuristic fallback
 * scores what it can (never blocks shipping).
 */

import { defineAgent, runAgentLifecycle, generateStructured, registerPrompt } from '../core/index.js'
import { generateContentWithFallback } from '../../utils/geminiClient.js'

export const JUDGE_AGENT = defineAgent({
  id: 'judge',
  name: 'Judge Agent',
  version: '1.0.0',
  purpose: 'assessment_report',
  persona: 'Quality auditor — ruthless about generic AI slop',
  retryPolicy: { maxAttempts: 1 },
})

const JUDGE_SYSTEM_PROMPT = `You are the Quality Auditor for Crafture's career diagnosis platform. You score generated career reports before they reach candidates. You are ruthless about generic AI writing, mathematical discrepancies, and fabricated claims.

Score the report across 7 Weighted Quality Dimensions (Total 100):
1. achievement_clarity (0–20): High-conviction action verbs, clear statement of what was accomplished; replaces vague duties with concrete engineering/operational ownership.
2. technical_business_impact (0–20): Measurable technical scale, system throughput, reliability, defect prevention, or financial/business impact.
3. specificity_action_mechanism (0–15): Cites exact tools, protocols, architectures, or technical implementation mechanisms (e.g. Docker, Kubernetes, indexing, Kafka, dbt, Redis, connection pools); zero hand-waving.
4. quantification_quality (0–15):
   - Rewards verified/confirmed metrics and honest qualitative outcomes.
   - HEAVILY PENALIZES unverified/invented percentages, fake scale claims, or repetitive canned suffixes (e.g., repeating "~20–35% latency" or "cutting p99 query latency by 32%").
   - Strong qualitative bullets without % MUST score high (>= 12/15) if technical/business impact is clear!
5. domain_role_relevance (0–15): Strictly level-appropriate and aligned with the candidate's target role and domain.
6. recruiter_readability (0–10): Scannable, 18–32 words, Google XYZ syntax, zero walls of text.
7. natural_human_writing (0–5): Sounds like a senior engineering peer; zero robotic AI buzzwords ("spearheaded", "leveraged", "synergistic", "cutting-edge", "results-driven", "passionate").

Scoring Guidelines:
- Total score >= 80 indicates high-quality, recruiter-grade work.
- Output MUST include both "totalScore" (0-100) and "score" (0-10, computed as totalScore / 10).
- flags: short actionable strings for what to fix (max 5). Empty array if totalScore >= 90.
- Return ONLY valid JSON.

JSON shape:
{
  "totalScore": number,
  "score": number,
  "dimensions": {
    "achievement_clarity": number,
    "technical_business_impact": number,
    "specificity_action_mechanism": number,
    "quantification_quality": number,
    "domain_role_relevance": number,
    "recruiter_readability": number,
    "natural_human_writing": number
  },
  "flags": ["..."],
  "summary": "one honest sentence"
}`

registerPrompt('judge-quality', 'judge-quality-v2', JUDGE_SYSTEM_PROMPT)

// ── Deterministic fallback ───────────────────────────────────────────────────

export const BANNED_AI_SLOP_REGEX = /\b(spearheaded|leveraged|synerg(y|istic)|cutting-edge|results-driven|passionate|pivotal|instrumental|testament to|proven track record|delved|thrives in fast-paced|seamlessly integrated)\b/i

const CANNED_SUFFIX_PATTERNS = [
  /cutting\s+p99\s+query\s+latency\s+by\s+32%/i,
  /reducing\s+retrieval\s+latency\s+by\s+32%/i,
  /supporting\s+500k\+\s+daily\s+transactions/i,
  /reducing\s+defect\s+leakage\s+by\s+40%/i,
  /from\s+14s\s+to\s+850ms/i,
]

export function heuristicScore(digest) {
  const review = digest.review || ''
  const text = digest.text || ''
  const issues = digest.issues || []
  const rewrites = (digest.sampleRewrites || []).map((rw) => (typeof rw === 'string' ? rw : rw?.rewrittenText || rw?.rewrite || ''))
  const withEvidence = issues.filter((i) => i.evidence && String(i.evidence).length > 10).length
  const groundingRate = issues.length ? withEvidence / issues.length : 0

  const fillerRegex = /(in conclusion|it is crucial|delve|navigate the (job )?market|leverage synergies|testament to)/i
  const filler = fillerRegex.test(review) || fillerRegex.test(text)

  const hasAiSlop =
    BANNED_AI_SLOP_REGEX.test(review) ||
    BANNED_AI_SLOP_REGEX.test(text) ||
    issues.some(
      (i) =>
        BANNED_AI_SLOP_REGEX.test(i.whyItMatters || '') ||
        BANNED_AI_SLOP_REGEX.test(i.recommendation || '') ||
        BANNED_AI_SLOP_REGEX.test(i.title || '') ||
        BANNED_AI_SLOP_REGEX.test(i.evidence || '')
    )

  // 1. Achievement Clarity (0–20)
  let achievementClarity = 14
  if (issues.length >= 3) achievementClarity += 2
  if (issues.some((i) => (i.whyItMatters || '').includes('Deficit') || (i.recommendation || '').length > 20)) {
    achievementClarity += 3
  }
  if (rewrites.some((rw) => /^(?:architected|engineered|automated|orchestrated|spearheaded|optimized|reduced|built|delivered)\b/i.test(rw))) {
    achievementClarity += 1
  }
  achievementClarity = Math.max(5, Math.min(20, achievementClarity))

  // 2. Technical / Business Impact (0–20)
  let technicalImpact = 12 + Math.round(groundingRate * 5)
  if (rewrites.some((rw) => /availability|throughput|latency|bottleneck|downtime|defect|scale|reliability|security/i.test(rw))) {
    technicalImpact += 3
  }
  technicalImpact = Math.max(5, Math.min(20, technicalImpact))

  // 3. Specificity of Action & Mechanism (0–15)
  let specificity = 9
  const techPattern = /\b(docker|kubernetes|postgres|mysql|redis|kafka|snowflake|dbt|aws|gcp|azure|api|graphql|index|dag|react|python)\b/i
  if (techPattern.test(text) || rewrites.some((rw) => techPattern.test(rw))) {
    specificity += 4
  }
  if (groundingRate >= 0.8) specificity += 2
  specificity = Math.max(4, Math.min(15, specificity))

  // 4. Quantification Quality (0–15)
  // Reward honest qualitative outcomes or verified metrics; penalize unverified % or repetitive canned suffixes
  let quantification = 13
  const hasCannedSuffix = rewrites.some((rw) => CANNED_SUFFIX_PATTERNS.some((p) => p.test(rw)))
  const hasUnverifiedPercent = rewrites.some((rw) => /\b\d+(?:\.\d+)?%/i.test(rw) && !text.includes(rw.match(/\b\d+(?:\.\d+)?%/i)[0]))

  if (hasCannedSuffix) {
    quantification -= 6
  }
  if (hasUnverifiedPercent) {
    quantification -= 3
  }
  quantification = Math.max(2, Math.min(15, quantification))

  // 5. Domain & Role Relevance (0–15)
  let domainRelevance = 12
  if (digest.domain && text.toLowerCase().includes(digest.domain.toLowerCase())) {
    domainRelevance += 3
  }
  domainRelevance = Math.max(5, Math.min(15, domainRelevance))

  // 6. Recruiter Readability (0–10)
  let readability = 8
  const avgWordCount = rewrites.length
    ? rewrites.reduce((sum, rw) => sum + rw.split(/\s+/).length, 0) / rewrites.length
    : 24
  if (avgWordCount >= 18 && avgWordCount <= 34) {
    readability += 2
  } else if (avgWordCount > 45) {
    readability -= 3
  }
  readability = Math.max(2, Math.min(10, readability))

  // 7. Natural Human Writing (0–5)
  let naturalWriting = 5
  if (hasAiSlop) naturalWriting = Math.min(naturalWriting, 1)
  if (filler) naturalWriting = Math.min(naturalWriting, 2)
  naturalWriting = Math.max(0, Math.min(5, naturalWriting))

  const totalScore = Math.max(10, Math.min(100, Math.round(
    achievementClarity +
    technicalImpact +
    specificity +
    quantification +
    domainRelevance +
    readability +
    naturalWriting
  )))

  const score10 = Math.round((totalScore / 10) * 10) / 10

  const dimensions = {
    achievement_clarity: achievementClarity,
    technical_business_impact: technicalImpact,
    specificity_action_mechanism: specificity,
    quantification_quality: quantification,
    domain_role_relevance: domainRelevance,
    recruiter_readability: readability,
    natural_human_writing: naturalWriting,
  }

  const flags = [
    ...(issues.length === 0 ? ['Report has no diagnosable findings — regenerate'] : []),
    ...(filler ? ['Remove corporate filler phrases from narrative'] : []),
    ...(hasAiSlop
      ? ['Remove robotic AI buzzwords (spearheaded, leveraged, synergistic) and replace with grounded engineering verbs']
      : []),
    ...(hasCannedSuffix ? ['Remove repetitive canned metric suffixes from bullet rewrites'] : []),
    ...(groundingRate < 0.8 && issues.length > 0 ? ['Findings must cite the candidate’s actual words/evidence'] : []),
  ]

  return {
    totalScore,
    score: score10,
    dimensions,
    subscores: dimensions,
    flags,
    summary: `Deterministic 7-dimension quality score: ${totalScore}/100 (${score10}/10). Grounding ${(groundingRate * 100).toFixed(0)}%.`,
    fallback: true,
  }
}

/**
 * Dedicated 7-dimension quality evaluator for a single bullet rewrite.
 * Ensures strong architectural/operational bullets without percentages score high (>= 80/100).
 *
 * @param {Object} params
 * @param {string} params.rewrite
 * @param {string} [params.originalText='']
 * @param {string} [params.targetRole='']
 * @param {string} [params.evidenceStatus='GROUNDED_QUALITATIVE']
 * @returns {{ totalScore: number, dimensions: Object, passesThreshold: boolean, flags: string[] }}
 */
export function judgeBulletRewrite({
  rewrite = '',
  originalText = '',
  targetRole = '',
  evidenceStatus = 'GROUNDED_QUALITATIVE',
  domain = '',
} = {}) {
  const rw = String(rewrite || '').trim()
  const orig = String(originalText || '').trim()
  const flags = []

  const cleanRole = (targetRole || '').toLowerCase()
  const cleanDomain = domain || (
    /nurse|clinical|patient|hospital|medical|healthcare/i.test(cleanRole) ? 'healthcare' :
    /finance|financial|fp&a|accounting|audit|budget/i.test(cleanRole) ? 'finance' :
    /sales|account\s+exec|pipeline|revenue|quota/i.test(cleanRole) ? 'sales' :
    /data\s+analyst|data\s+sci|analytics|bi\b/i.test(cleanRole) ? 'data' :
    /software|developer|engineer|devops|cloud|platform/i.test(cleanRole) ? 'software' :
    'general'
  )

  // 1. Achievement Clarity (0–20)
  let clarity = 15
  if (/^(?:architected|engineered|automated|orchestrated|spearheaded|optimized|reduced|built|delivered|hardened|standardized|coordinated|administered|reconciled|accelerated|synthesized|negotiated)\b/i.test(rw)) {
    clarity += 4
  } else if (/^(?:worked on|responsible for|helped|assisted|handled)\b/i.test(rw)) {
    clarity -= 5
    flags.push('Weak opening verb undercut seniority')
  }
  clarity = Math.max(5, Math.min(20, clarity))

  // 2. Technical / Business Impact (0–20)
  let impact = 15
  const impactPatterns = {
    healthcare: /patient\s+care|patient\s+safety|clinical|triage|wait\s+time|readmission|compliance|care\s+delivery|error\s+rate|turnaround|satisfaction|acuity|hipaa/i,
    finance: /cash\s+flow|margin|variance|ebitda|audit|gaap|budget|forecast|revenue|cost\s+reduction|p&l|balance\s+sheet|turnaround/i,
    sales: /quota|pipeline|win\s+rate|conversion|arr|mrr|acv|revenue|bookings|deal\s+size|retention|turnaround/i,
    data: /query\s+runtime|pipeline|freshness|adoption|reporting\s+turnaround|accuracy|latency|throughput/i,
    software: /availability|throughput|latency|reliability|defect|concurrency|security|zero-downtime|turnaround/i,
    general: /efficiency|turnaround|reliability|outcome|accuracy|quality|deliverable|throughput/i,
  }
  const impactRegex = impactPatterns[cleanDomain] || impactPatterns.general
  if (impactRegex.test(rw)) {
    impact += 4
  }
  impact = Math.max(5, Math.min(20, impact))

  // 3. Specificity of Action & Mechanism (0–15)
  let specificity = 12
  const mechanismPatterns = {
    healthcare: /\b(epic|ehr|emr|hipaa|triage|vitals|medication|protocol|acuity|telemetry|rounding|infusion|icu|ccu|care\s+plan)\b/i,
    finance: /\b(erp|sap|excel|financial\s+model|gaap|variance\s+analysis|p&l|hyperion|netsuite|reconciliation|dcf|general\s+ledger)\b/i,
    sales: /\b(salesforce|hubspot|crm|outreach|pipeline|discovery|prospecting|cold\s+call|cadence|lead\s+scoring|demo)\b/i,
    data: /\b(sql|tableau|power\s*bi|dbt|snowflake|etl|bigquery|python|pandas|r\b|looker|data\s+warehouse)\b/i,
    software: /\b(docker|kubernetes|postgres|sql|redis|kafka|snowflake|dbt|aws|gcp|azure|api|graphql|indexes|pipeline)\b/i,
    general: /\b(standardized|framework|protocol|methodology|pipeline|workflow|system|platform)\b/i,
  }
  const mechanismRegex = mechanismPatterns[cleanDomain] || mechanismPatterns.general
  if (mechanismRegex.test(rw)) {
    specificity += 3
  }
  specificity = Math.max(4, Math.min(15, specificity))

  // 4. Quantification Quality (0–15)
  let quant = 14
  if (evidenceStatus === 'VERIFIED' || evidenceStatus === 'CANDIDATE_CONFIRMED' || evidenceStatus === 'CALCULATED') {
    quant = 15
  } else if (evidenceStatus === 'GROUNDED_QUALITATIVE') {
    // Strong architectural/operational bullet without percentages scores high
    quant = 14
  } else if (evidenceStatus === 'UNVERIFIED') {
    quant = 5
    flags.push('Unverified numeric claim penalized')
  }
  if (CANNED_SUFFIX_PATTERNS.some((p) => p.test(rw))) {
    quant = Math.min(quant, 6)
    flags.push('Repetitive canned suffix detected')
  }

  // 5. Domain & Role Relevance (0–15)
  let relevance = 14
  if (targetRole && !rw.toLowerCase().includes(targetRole.toLowerCase().split(/\s+/)[0])) {
    relevance = 13
  }

  // 6. Recruiter Readability (0–10)
  let readability = 8
  const wordCount = rw.split(/\s+/).length
  if (wordCount >= 18 && wordCount <= 32) {
    readability = 10
  } else if (wordCount > 40) {
    readability = 5
    flags.push('Bullet exceeds recommended length (wall of text)')
  }

  // 7. Natural Human Writing (0–5)
  let humanWriting = 5
  if (BANNED_AI_SLOP_REGEX.test(rw)) {
    humanWriting = 1
    flags.push('Contains banned AI buzzwords')
  }

  const totalScore = Math.max(10, Math.min(100, Math.round(
    clarity + impact + specificity + quant + relevance + readability + humanWriting
  )))

  return {
    totalScore,
    dimensions: {
      achievement_clarity: clarity,
      technical_business_impact: impact,
      specificity_action_mechanism: specificity,
      quantification_quality: quant,
      domain_role_relevance: relevance,
      recruiter_readability: readability,
      natural_human_writing: humanWriting,
    },
    passesThreshold: totalScore >= 80,
    flags,
  }
}

// ── Compact report digest for the judge ──────────────────────────────────────

/**
 * Builds a unified digest from the FULL report bundle. The Atlas narrative and
 * the Resume Agent speak different shapes (critical_issues vs issues) — the
 * judge must see both.
 */
function buildDigest(aiReport) {
  const r = aiReport || {}

  // Atlas narrative shape
  const atlasIssues = (r.critical_issues || []).filter(Boolean).map((i) => ({
    title: i.title,
    whyItMatters: i.whyItMatters || i.diagnosis || '',
    recommendation: Array.isArray(i.action_steps) ? i.action_steps.join('; ') : i.recommendation || '',
    evidence: i.evidence?.originalText || i.evidence || '',
    severity: String(i.severity || '').toLowerCase(),
    category: i.category || 'atlas',
    correctedText: i.correctedText || '',
  }))

  // Resume Agent shape
  const agentIssues = (r.resume_agent?.issues || []).filter(Boolean).map((i) => ({
    title: i.title,
    whyItMatters: i.whyItMatters || '',
    recommendation: i.recommendation || '',
    evidence: (Array.isArray(i.evidence) ? i.evidence[0] : i.evidence)?.originalText || '',
    severity: i.severity || '',
    category: i.category || '',
    correctedText: i.correctedText || '',
  }))

  // LinkedIn Agent shape (V2.0 audit findings & cross-agent discrepancies)
  const linkedinIssues = (r.linkedin_agent?.issues || []).filter(Boolean).map((i) => ({
    title: i.title,
    whyItMatters: i.whyItMatters || i.detail || '',
    recommendation: i.recommendation || '',
    evidence: (Array.isArray(i.evidence) ? i.evidence[0] : (typeof i.evidence === 'string' ? i.evidence : i.diagnosis || i.detail || '')) || '',
    severity: i.severity || 'medium',
    category: i.category || 'linkedin',
    correctedText: '',
  }))

  const linkedinDiscrepancies = (r.linkedin_agent?.discrepancies || []).filter(Boolean).map((d) => ({
    title: d.title || d.type || 'Cross-Agent Discrepancy',
    whyItMatters: d.detail || '',
    recommendation: d.recommendation || '',
    evidence: d.evidence || d.resumeClaim || d.linkedinClaim || d.detail || '',
    severity: d.severity || 'medium',
    category: 'discrepancy',
    correctedText: '',
  }))

  const rawIssues = (Array.isArray(r.issues) ? r.issues : []).filter(Boolean).map((i) => ({
    title: i.title || 'Issue',
    whyItMatters: i.whyItMatters || i.diagnosis || '',
    recommendation: i.recommendation || (Array.isArray(i.action_steps) ? i.action_steps.join('; ') : ''),
    evidence: (typeof i.evidence === 'object' ? i.evidence?.originalText : i.evidence) || '',
    severity: i.severity || 'medium',
    category: i.category || 'general',
    correctedText: i.correctedText || '',
  }))

  const review =
    r.executive_verdict ||
    r.review ||
    r.summary ||
    r.resume_agent?.overallReview?.summary ||
    [r.coach_intervention?.urgency_statement, r.coach_intervention?.value_prop].filter(Boolean).join(' ') ||
    r.market_reality_check?.headline ||
    (typeof r.primary_bottleneck === 'string' ? r.primary_bottleneck : r.primary_bottleneck?.diagnosis || '') ||
    ''

  const issues = [...atlasIssues, ...agentIssues, ...linkedinIssues, ...linkedinDiscrepancies, ...rawIssues]
  const rewrites = [
    ...issues.map((i) => i.correctedText).filter(Boolean),
    ...(r.linkedin_agent?.optimizations?.headlines || []).slice(0, 2),
    ...(r.linkedin_agent?.optimizations?.headlineOptions || []).map((h) => h.text || h).slice(0, 2),
  ].filter(Boolean).slice(0, 4)

  const domain =
    r.resume_agent?.candidateSnapshot?.primaryProfile ||
    r.resume_json?.target_role ||
    ''
  const scores = [
    r.dashboard ? `resume score ${r.dashboard.score}/${r.dashboard.grade}` : (r.resume_agent?.dashboard ? `resume score ${r.resume_agent.dashboard.score}/${r.resume_agent.dashboard.grade}` : null),
    r.linkedin_agent?.dataAvailable && typeof r.linkedin_agent.score === 'number' ? `linkedin score ${r.linkedin_agent.score}/${r.linkedin_agent.grade || ''}` : null,
    r.career_health_score ? `career health ${r.career_health_score}` : null,
  ].filter(Boolean).join(' | ') || 'no scorecard'

  const market = r.market_reality_check
    ? `market headline: ${r.market_reality_check.headline || ''}\nbrutal facts: ${(r.market_reality_check.brutal_facts || []).slice(0, 2).join(' | ')}`
    : ''

  return {
    review,
    issues,
    text: [
      `OVERALL NARRATIVE:\n${review.slice(0, 900)}`,
      `SCORES: ${scores}${r.judge ? '' : ''}`,
      market && `MARKET REALITY CHECK:\n${market.slice(0, 300)}`,
      domain && `CANDIDATE DOMAIN: ${domain}`,
      `FINDINGS (${issues.length}):`,
      ...issues
        .slice(0, 12)
        .map(
          (i, idx) =>
            `${idx + 1}. [${i.severity || '?'}/${i.category || '?'}] ${i.title}\n   why: ${String(i.whyItMatters).slice(0, 150)}\n   next step: ${String(i.recommendation).slice(0, 150)}`
        ),
      rewrites.length ? `SAMPLE REWRITES:\n${rewrites.map((rw) => `- ${rw}`).join('\n')}` : 'SAMPLE REWRITES: none',
    ]
      .filter(Boolean)
      .join('\n\n'),
  }
}

// ── Judge execution ──────────────────────────────────────────────────────────

async function executeJudge(aiReport) {
  const digest = buildDigest(aiReport)

  // Default to fast deterministic heuristic immediately in production (0ms latency, 0 API quota burned)
  // unless process.env.ENABLE_LLM_JUDGE === 'true'
  if (process.env.ENABLE_LLM_JUDGE !== 'true') {
    return heuristicScore(digest)
  }

  try {
    const { text } = await generateStructured({
      contractId: JUDGE_AGENT.id,
      purpose: JUDGE_AGENT.purpose,
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: `Judge this generated career report:\n\n${digest.text}` },
      ],
      maxAttempts: 1,
      generation: {
        temperature: 0.1,
        maxTokens: 1500,
        preferredProvider: 'groq',
        model: 'openai/gpt-oss-120b',
        responseFormat: 'json_object',
      },
      validate: (raw) => {
        try {
          const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
          const s = typeof parsed.totalScore === 'number' ? parsed.totalScore : parsed.score
          if (typeof s !== 'number' || s < 0) {
            return { valid: false, errors: ['score must be a valid number'] }
          }
          return { valid: true, errors: [] }
        } catch (e) {
          return { valid: false, errors: [`invalid JSON: ${e.message}`] }
        }
      },
    })

    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    const totalScore = typeof parsed.totalScore === 'number'
      ? Math.round(parsed.totalScore)
      : (typeof parsed.score === 'number' && parsed.score <= 10 ? Math.round(parsed.score * 10) : 75)
    const score10 = typeof parsed.score === 'number' && parsed.score <= 10
      ? parsed.score
      : Math.round((totalScore / 10) * 10) / 10

    const dimensions = parsed.dimensions || parsed.subscores || {}
    return {
      totalScore,
      score: score10,
      dimensions,
      subscores: dimensions,
      flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 5) : [],
      summary: parsed.summary || '',
      fallback: false,
    }
  } catch (e) {
    console.warn('[JudgeAgent] LLM judge unavailable, using heuristic fallback:', e.message)
    return heuristicScore(digest)
  }
}

/**
 * Public API: judge a full report bundle.
 * Returns { success, result: { totalScore, score, dimensions, subscores, flags, summary, fallback }, telemetry }.
 */
export function judgeReport(aiReport) {
  return runAgentLifecycle({
    contract: JUDGE_AGENT,
    params: aiReport,
    hooks: {
      validateInput: (report) => {
        if (!report || typeof report !== 'object') throw new Error('Judge requires a report object')
        return report
      },
      execute: (report) => executeJudge(report),
    },
  })
}

export default { judgeReport, judgeBulletRewrite, JUDGE_AGENT }
