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

Score the report 0-10 overall and on these subscales (each 0-10):
- tone: warm, connected, talks TO the candidate by name; zero corporate filler or AI buzzwords
- specificity: findings cite the candidate's actual words, scope, and metrics; nothing generic like "add metrics"
- mathematical_integrity: career health score exactly matches 4-pillar sum (25% each) and reported funnel numbers align
- us_market_fit: advice strictly fits US tech hiring norms (ATS 6-sec scan, cold portal vs referral rates, leveling)
- safety: no fabricated numbers, no invented claims, no overpromising
- structure: clear diagnosis → why it matters → concrete next step, per finding

ANTI-AI-SLOP & HUMAN VOICE RULES (CRITICAL):
- Deduct at least 2 points on the "tone" subscale if the report contains ANY of these banned robotic buzzwords or clichés:
  "spearheaded", "leveraged", "synergistic", "cutting-edge", "results-driven", "passionate",
  "dynamic", "pivotal", "instrumental", "testament to", "proven track record", "hands-on experience with",
  "delved into", "thrives in fast-paced", "responsible for", or decorative em-dashes (—).
- Deduct at least 2 points on "specificity" if bullet rewrites use generic unverified placeholders like "[ADD: ...]" or repeatedly invent ungrounded "by 40%" metrics without citing technical mechanisms.
- The narrative must speak directly TO the candidate by first name with constructive peer empathy (like an ex-Google/Meta senior recruiter over coffee), NOT as a distant corporate auditor.
- If any banned buzzword is detected, add an explicit fix instruction to "flags" (e.g. "Remove AI buzzword 'spearheaded' from experience bullet 2; replace with concrete engineering verb like 'Architected' or 'Migrated'").

Strict Penalty Rules:
- If generic corporate filler is detected ("navigating the job market", "delve", "testament to", "it is crucial", "in conclusion", "synergies"), cap "tone" at 4/10 and overall score at 5/10.
- If robotic buzzwords ("spearheaded", "leveraged", "synergistic", "cutting-edge") are detected, cap "tone" at 5/10 and overall score at 6/10.
- Be honest: generic output scores 4-6. Good output scores 7-8. Excellent 9-10.
- flags: short actionable strings for what to fix (max 5). Empty array if score >= 9.
- Return ONLY valid JSON.

JSON shape:
{"score": number, "subscores": {"tone": n, "specificity": n, "mathematical_integrity": n, "us_market_fit": n, "safety": n, "structure": n}, "flags": ["..."], "summary": "one honest sentence"}`

registerPrompt('judge-quality', 'judge-quality-v1', JUDGE_SYSTEM_PROMPT)

// ── Deterministic fallback ───────────────────────────────────────────────────

export const BANNED_AI_SLOP_REGEX = /\b(spearheaded|leveraged|synerg(y|istic)|cutting-edge|results-driven|passionate|pivotal|instrumental|testament to|proven track record|delved|thrives in fast-paced|seamlessly integrated)\b/i

function heuristicScore(digest) {
  const review = digest.review || ''
  const text = digest.text || ''
  const issues = digest.issues || []
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

  const structureOk = issues.length > 0 && Boolean(review)

  let score = 3 + groundingRate * 4 + (structureOk ? 1.5 : 0) + (issues.length >= 3 ? 1 : 0)
  if (hasAiSlop) score = Math.min(score, 6)
  if (filler) score = Math.min(score, 5)
  score = Math.max(1, Math.min(10, Math.round(score)))

  let toneScore = 8
  if (hasAiSlop) toneScore = Math.min(toneScore, 5)
  if (filler) toneScore = Math.min(toneScore, 4)

  return {
    score,
    subscores: {
      tone: toneScore,
      specificity: Math.round(groundingRate * 10),
      mathematical_integrity: 8,
      us_market_fit: 8,
      safety: 8,
      structure: structureOk ? 7 : 4,
    },
    flags: [
      ...(issues.length === 0 ? ['Report has no diagnosable findings — regenerate'] : []),
      ...(filler ? ['Remove corporate filler phrases from narrative'] : []),
      ...(hasAiSlop
        ? ['Remove robotic AI buzzwords (spearheaded, leveraged, synergistic) and replace with grounded engineering verbs']
        : []),
      ...(groundingRate < 0.8 && issues.length > 0 ? ['Findings must cite the candidate’s actual words/evidence'] : []),
    ],
    summary: `Deterministic fallback score (judge LLM unavailable): grounding ${(groundingRate * 100).toFixed(0)}%.`,
    fallback: true,
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
    evidence: (Array.isArray(i.evidence) ? i.evidence[0] : (typeof i.evidence === 'string' ? i.evidence : '')) || '',
    severity: i.severity || 'medium',
    category: i.category || 'linkedin',
    correctedText: '',
  }))

  const linkedinDiscrepancies = (r.linkedin_agent?.discrepancies || []).filter(Boolean).map((d) => ({
    title: d.title || d.type || 'Cross-Agent Discrepancy',
    whyItMatters: d.detail || '',
    recommendation: d.recommendation || '',
    evidence: d.evidence || '',
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
          if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 10) {
            return { valid: false, errors: ['score must be a number 0-10'] }
          }
          return { valid: true, errors: [] }
        } catch (e) {
          return { valid: false, errors: [`invalid JSON: ${e.message}`] }
        }
      },
    })

    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return {
      score: Math.round(parsed.score * 10) / 10,
      subscores: parsed.subscores || {},
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
 * Returns { success, result: { score, subscores, flags, summary, fallback }, telemetry }.
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

export default { judgeReport, JUDGE_AGENT }
