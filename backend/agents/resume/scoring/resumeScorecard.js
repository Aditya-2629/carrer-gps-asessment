/**
 * Resume Scorecard Engine — V3.1 (Phase: "The Magic Layer")
 *
 * Deterministic scoring — NO LLM call, runs in milliseconds. Fills the
 * `dashboard` field of the final analysis with the same kind of instant,
 * scannable verdict competitors show: a 0-100 Resume Health Score, per-category
 * letter grades, a pass/warn/fail checklist, and a per-bullet audit with
 * before→after rewrites.
 *
 * Input sources (all already computed by the pipeline):
 *  - analysis.issues / strengths (LLM synthesis, validated)
 *  - precomputedSignals (quantification rollup, bullet signals, contact merge)
 *  - usMarketSignals (non-US convention flags)
 *  - canonicalResume (bullets, certifications, page estimates)
 *  - validation warnings (fabrication/assumption warnings)
 *
 * Design rules:
 *  - Every score is explainable: each category grade derives from named facts.
 *  - A bullet is only marked "fix" when an issue cites it — we never invent problems.
 *  - Missing quantification alone never drops a bullet below "warn".
 */

export const SCORECARD_VERSION = 'resume-scorecard-v1'

const SEVERITY_PENALTY = { high: 14, medium: 8, low: 4 }

export const GRADE_BANDS = [
  { min: 85, grade: 'A', label: 'Excellent' },
  { min: 70, grade: 'B', label: 'Good' },
  { min: 55, grade: 'C', label: 'Needs Work' },
  { min: 40, grade: 'D', label: 'Weak' },
  { min: 0, grade: 'F', label: 'Critical' },
]

const CATEGORY_META = [
  { key: 'impact', label: 'Impact', weight: 0.26 },
  { key: 'positioning', label: 'Positioning', weight: 0.18 },
  { key: 'ats_readability', label: 'ATS Safety', weight: 0.16 },
  { key: 'credibility', label: 'Credibility', weight: 0.15 },
  { key: 'brevity', label: 'Brevity', weight: 0.14 },
  { key: 'us_market_alignment', label: 'US Alignment', weight: 0.11 },
]

const gradeFor = (score) => GRADE_BANDS.find((b) => score >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const round = (v) => Math.round(v)

const ISSUE_CATEGORY_MAP = {
  impact: 'impact',
  outcome_visibility: 'impact',
  positioning: 'positioning',
  clarity: 'positioning',
  ownership_clarity: 'positioning',
  structure: 'ats_readability',
  ats_readability: 'ats_readability',
  repetition: 'ats_readability',
  credibility: 'credibility',
  skill_evidence_gap: 'credibility',
  us_market_alignment: 'us_market_alignment',
  brevity: 'brevity',
}

/**
 * Words per bullet, averaged — used for the brevity category.
 */
function bulletLengthStats(canonicalResume) {
  const lengths = []
  for (const section of [canonicalResume?.experience, canonicalResume?.projects]) {
    for (const item of section || []) {
      for (const b of item.bullets || []) {
        if (b?.text) lengths.push(b.text.trim().split(/\s+/).length)
      }
    }
  }
  if (lengths.length === 0) return { avg: 0, over35: 0, total: 0 }
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length
  return { avg: Number(avg.toFixed(1)), over35: lengths.filter((l) => l > 35).length, total: lengths.length }
}

/**
 * Computes the full scorecard. Pure function.
 */
export function computeScorecard({ analysis, canonicalResume, precomputedSignals, usMarketSignals, validation, pageCount = null }) {
  const issues = Array.isArray(analysis?.issues) ? analysis.issues.filter(Boolean) : []
  const strengths = Array.isArray(analysis?.strengths) ? analysis.strengths.filter(Boolean) : []
  const flags = usMarketSignals?.flags || {}
  const usObs = usMarketSignals?.observations || []
  const quant = precomputedSignals?.quantification || {}
  const bulletSignalsList = precomputedSignals?.bulletSignalsList || []
  const contactMerge = precomputedSignals?.contactMerge || {}

  // ── 1. Category scores ─────────────────────────────────────────────────────
  const categoryPenalties = {}
  for (const meta of CATEGORY_META) categoryPenalties[meta.key] = 0

  for (const issue of issues) {
    const key = ISSUE_CATEGORY_MAP[issue.category]
    if (key && categoryPenalties[key] !== undefined) {
      categoryPenalties[key] += SEVERITY_PENALTY[issue.severity] || SEVERITY_PENALTY.low
    }
  }

  const scores = {}

  // Impact: issues + quantification bonus + strength bonus
  scores.impact = clamp(
    100 - categoryPenalties.impact + (quant.density || 0) * 12 + Math.min(strengths.length, 4) * 2,
    5,
    100
  )

  // Positioning
  scores.positioning = clamp(100 - categoryPenalties.positioning, 5, 100)

  // ATS safety: issues + contact-merge structural signal
  const contactPenalty = contactMerge.isContactMerged ? 8 : 0
  scores.ats_readability = clamp(100 - categoryPenalties.ats_readability - contactPenalty, 5, 100)

  // Credibility: issues + fabrication/assumption warnings
  const fabricationWarnings = (validation?.warnings || []).filter(
    (w) => /fabricated|unsupported|assumption|placeholder/i.test(String(w))
  ).length
  scores.credibility = clamp(100 - categoryPenalties.credibility - Math.min(fabricationWarnings * 4, 20), 5, 100)

  // Brevity: bullet length stats + brevity issues + page count
  const len = bulletLengthStats(canonicalResume)
  let brevity = 100 - categoryPenalties.brevity
  if (len.avg > 30) brevity -= Math.min((len.avg - 30) * 1.5, 20)
  if (len.over35 > 0) brevity -= Math.min(len.over35 * 3, 12)
  if (typeof pageCount === 'number' && pageCount > 2) brevity -= 15
  scores.brevity = clamp(brevity, 5, 100)

  // US alignment: from deterministic signal observations (high=25, med=12, low=6)
  let usScore = 100
  for (const obs of usObs) {
    usScore -= obs.weight === 'high' ? 25 : obs.weight === 'medium' ? 12 : 6
  }
  scores.us_market_alignment = clamp(usScore, 5, 100)

  // ── 2. Overall weighted score ──────────────────────────────────────────────
  let overall = 0
  for (const meta of CATEGORY_META) {
    overall += scores[meta.key] * meta.weight
  }
  // A resume can't be "A Excellent" while any category is failing — cap the
  // overall so the worst category drags the verdict down visibly.
  const worstCategory = Math.min(...CATEGORY_META.map((m) => scores[m.key]))
  overall = Math.min(overall, worstCategory + 38)
  const score = round(overall)
  const { grade, label } = gradeFor(score)

  const grades = {}
  for (const meta of CATEGORY_META) {
    const g = gradeFor(round(scores[meta.key]))
    grades[meta.key] = {
      label: meta.label,
      score: round(scores[meta.key]),
      grade: g.grade,
      gradeLabel: g.label,
      facts: factLines(meta.key, { quant, len, usObs, flags, categoryPenalties, fabricationWarnings, contactMerge }),
    }
  }

  // ── 3. Checklist (pass/warn/fail rows) ─────────────────────────────────────
  const checks = buildChecks({ issues, quant, bulletSignalsList, contactMerge, flags, len, pageCount, canonicalResume })

  // ── 4. Bullet audit ────────────────────────────────────────────────────────
  const bulletAudit = buildBulletAudit({ analysis, canonicalResume, bulletSignalsList })

  return {
    version: SCORECARD_VERSION,
    computedAt: new Date().toISOString(),
    score,
    grade,
    gradeLabel: label,
    grades,
    checks,
    bulletAudit,
    summary: {
      fix: bulletAudit.filter((b) => b.status === 'fix').length,
      warn: bulletAudit.filter((b) => b.status === 'warn').length,
      pass: bulletAudit.filter((b) => b.status === 'pass').length,
      checksPassed: checks.filter((c) => c.status === 'pass').length,
      checksTotal: checks.length,
      strengths: strengths.length,
      issues: issues.length,
    },
  }
}

/**
 * One-line factual basis per category grade (shown as tooltip/subtext in UI).
 */
function factLines(key, ctx) {
  const { quant, len, usObs, flags, categoryPenalties, fabricationWarnings, contactMerge } = ctx
  switch (key) {
    case 'impact':
      return [
        `${quant.quantifiedBullets ?? '?'} of ${quant.totalBullets ?? '?'} bullets include a hard number`,
        `Impact issues: ${categoryPenalties.impact > 0 ? 'yes' : 'none'}`,
      ]
    case 'positioning':
      return [`Positioning/ownership issues: ${categoryPenalties.positioning > 0 ? 'yes' : 'none'}`]
    case 'ats_readability':
      return [
        contactMerge.isContactMerged ? 'Contact details merged with summary text' : 'Contact header parses cleanly',
        `ATS issues: ${categoryPenalties.ats_readability > 0 ? 'yes' : 'none'}`,
      ]
    case 'credibility':
      return [
        `Fabrication/assumption warnings: ${fabricationWarnings}`,
        `Skill evidence issues: ${categoryPenalties.credibility > 0 ? 'yes' : 'none'}`,
      ]
    case 'brevity':
      return [
        `Average bullet length: ${len.avg} words`,
        len.over35 > 0 ? `${len.over35} bullets over 35 words` : 'All bullets within length',
      ]
    case 'us_market_alignment':
      return [
        usObs.length === 0 ? 'No non-US conventions detected' : `${usObs.length} non-US convention signal(s) detected`,
        flags.personalDetailsDetected ? 'Personal details present' : 'No personal details',
      ]
    default:
      return []
  }
}

/**
 * Builds the Rezi-style pass/warn/fail checklist.
 */
function buildChecks({ issues, quant, bulletSignalsList, contactMerge, flags, len, pageCount, canonicalResume }) {
  const checks = []
  const hasIssue = (cat, minSeverity = 'low') =>
    issues.some((i) => i.category === cat && (SEVERITY_PENALTY[i.severity] || 0) >= SEVERITY_PENALTY[minSeverity])

  // 1. Quantified achievements
  const density = quant.density || 0
  checks.push({
    id: 'quantified_evidence',
    label: 'Quantified achievements',
    status: density >= 0.4 ? 'pass' : density >= 0.2 ? 'warn' : 'fail',
    detail: `${quant.quantifiedBullets ?? 0} of ${quant.totalBullets ?? 0} bullets include a hard number`,
    category: 'impact',
  })

  // 2. Outcome verbs & qualitative CAR outcomes
  const withOutcome = bulletSignalsList.filter((b) => b.hasOutcomeVerb !== false || b.hasQualitativeOutcome === true).length
  const outcomeShare = bulletSignalsList.length > 0 ? withOutcome / bulletSignalsList.length : 1
  checks.push({
    id: 'outcome_verbs',
    label: 'Bullets lead with outcome or action verbs',
    status: outcomeShare >= 0.7 ? 'pass' : outcomeShare >= 0.4 ? 'warn' : 'fail',
    detail: `${withOutcome} of ${bulletSignalsList.length} bullets show a clear action/outcome verb or CAR result`,
    category: 'impact',
  })

  // 3. Tool-dump bullets
  const toolDumps = bulletSignalsList.filter((b) => b.isToolDumpCandidate).length
  checks.push({
    id: 'no_tool_dump',
    label: 'No tool-dump bullets',
    status: toolDumps === 0 ? 'pass' : toolDumps <= 2 ? 'warn' : 'fail',
    detail: toolDumps === 0 ? 'Every bullet explains the work, not just the stack' : `${toolDumps} bullet(s) read as a tool list`,
    category: 'impact',
  })

  // 4. Contact header
  checks.push({
    id: 'contact_header',
    label: 'Contact details parse cleanly',
    status: contactMerge.isContactMerged ? 'warn' : 'pass',
    detail: contactMerge.isContactMerged
      ? 'Contact info sits alongside other text — check ATS parsing'
      : 'Email/phone/location are separate and machine-readable',
    category: 'ats_readability',
  })

  // 5-7. US market conventions
  checks.push({
    id: 'no_personal_details',
    label: 'No personal details (US norm)',
    status: flags.personalDetailsDetected ? 'fail' : 'pass',
    detail: flags.personalDetailsDetected
      ? 'US resumes omit DOB, marital status, nationality, photos'
      : 'Nothing a US recruiter would expect removed',
    category: 'us_market_alignment',
  })
  checks.push({
    id: 'no_declaration',
    label: 'No declaration/signature block',
    status: flags.declarationBlockDetected ? 'warn' : 'pass',
    detail: flags.declarationBlockDetected ? 'Common abroad, unused on US resumes' : 'None found',
    category: 'us_market_alignment',
  })
  checks.push({
    id: 'no_objective_section',
    label: 'Uses a summary, not an Objective',
    status: flags.objectiveSectionDetected ? 'warn' : 'pass',
    detail: flags.objectiveSectionDetected ? 'Objective sections are dated for the US market' : 'No Objective section found',
    category: 'us_market_alignment',
  })

  // 8. Skill evidence
  const skillGaps = issues.filter((i) => i.category === 'skill_evidence_gap').length
  checks.push({
    id: 'skill_evidence',
    label: 'Skills backed by evidence',
    status: skillGaps === 0 ? 'pass' : 'warn',
    detail: skillGaps === 0 ? 'Listed skills appear in your experience or projects' : `${skillGaps} skill evidence gap(s) flagged`,
    category: 'credibility',
  })

  // 9. Bullet length
  checks.push({
    id: 'bullet_length',
    label: 'Bullet length (1-2 lines)',
    status: len.avg <= 30 && len.over35 === 0 ? 'pass' : len.avg <= 35 ? 'warn' : 'fail',
    detail: `Average ${len.avg} words${len.over35 > 0 ? `, ${len.over35} over 35` : ''}`,
    category: 'brevity',
  })

  // 10. Page count
  if (typeof pageCount === 'number' && pageCount > 0) {
    checks.push({
      id: 'page_count',
      label: '1-2 page length',
      status: pageCount <= 2 ? 'pass' : 'warn',
      detail: `Parsed document is approximately ${pageCount} page(s)`,
      category: 'brevity',
    })
  }

  // 11. Certifications present
  const certCount = (canonicalResume?.certifications || []).length
  checks.push({
    id: 'certifications',
    label: 'Certifications / licenses included',
    status: certCount > 0 ? 'pass' : 'warn',
    detail: certCount > 0 ? `${certCount} certification(s) found` : 'No certifications listed — add any you hold',
    category: 'credibility',
  })

  // 12. Duplicate content
  const repIssues = issues.filter((i) => i.category === 'repetition').length
  checks.push({
    id: 'no_repetition',
    label: 'No repeated achievements',
    status: repIssues === 0 ? 'pass' : 'warn',
    detail: repIssues === 0 ? 'Each bullet carries distinct content' : `${repIssues} repetition issue(s) flagged`,
    category: 'impact',
  })

  return checks
}

/**
 * Builds the per-bullet audit: every experience/project bullet gets a status,
 * a one-line reason, and the before→after rewrite when an issue cites it.
 */
function buildBulletAudit({ analysis, canonicalResume, bulletSignalsList }) {
  const issues = Array.isArray(analysis?.issues) ? analysis.issues.filter(Boolean) : []

  // Map bulletId → worst issue affecting it
  const sevRank = { high: 3, medium: 2, low: 1 }
  const issueByBullet = new Map()
  for (const issue of issues) {
    const evList = Array.isArray(issue.evidence) ? issue.evidence : [issue.evidence].filter(Boolean)
    for (const ev of evList) {
      if (!ev?.bulletId) continue
      const existing = issueByBullet.get(ev.bulletId)
      if (!existing || (sevRank[issue.severity] || 0) > (sevRank[existing.severity] || 0)) {
        issueByBullet.set(ev.bulletId, issue)
      }
    }
  }

  const signalByBullet = new Map()
  for (const sig of bulletSignalsList || []) {
    if (sig?.bulletId) signalByBullet.set(sig.bulletId, sig)
  }

  const audit = []
  const isDateLike = (s) => !s || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(s.trim())
  const sections = [
    { key: 'experience', label: 'Experience', items: canonicalResume?.experience || [], nameFields: ['company', 'role'] },
    { key: 'projects', label: 'Projects', items: canonicalResume?.projects || [], nameFields: ['name', 'title'] },
  ]

  for (const section of sections) {
    for (const item of section.items) {
      let itemName = section.label
      for (const field of section.nameFields) {
        if (item?.[field] && !isDateLike(item[field])) {
          itemName = item[field]
          break
        }
      }
      const isCurrentRole = item?.isCurrent === true || /present|current|now/i.test(item?.endDate || '') || /present|current|now/i.test(item?.dates || '')

      for (const b of item.bullets || []) {
        if (!b?.id || !b?.text) continue
        const sig = signalByBullet.get(b.id)
        const issue = issueByBullet.get(b.id)

        let status = 'pass'
        let reason = 'Clear, specific, no defects found'

        if (issue) {
          status = issue.severity === 'low' ? 'warn' : 'fix'
          reason = issue.title || issue.diagnosis?.slice(0, 90) || 'Flagged by analysis'
        } else if (sig?.isToolDumpCandidate) {
          status = 'warn'
          reason = 'Lists multiple technologies without demonstrating the concrete system built or delivered'
        } else if (sig?.weakVerbIssue) {
          status = 'warn'
          reason = `Opens with weak/supporting phrasing ('${sig.weakVerbMatch}') — start with a strong ownership action verb (e.g., Architected, Engineered, Automated, Spearheaded)`
        } else if (sig?.tenseIssue === 'gerund_opening') {
          status = 'warn'
          reason = `Starts with an '-ing' participle ('${sig.openingWord}') — use a direct ${isCurrentRole ? 'present-tense verb (e.g., Design, Secure, Lead)' : 'past-tense action verb (e.g., Designed, Secured, Led)'}`
        } else if (sig?.tenseIssue === 'wrong_tense') {
          status = 'warn'
          reason = `Past role uses present-tense verb ('${sig.openingWord}') — switch to past tense for completed roles`
        } else if (sig?.repetitiveVerbIssue) {
          status = 'warn'
          reason = `Repeats opening verb '${sig.openingWord}' (used ${sig.openingVerbCount}x) — vary your action verbs to keep each bullet distinct`
        } else if (sig?.buzzwordIssue) {
          status = 'warn'
          reason = `Contains generic/AI-sounding buzzword ('${sig.buzzwordMatch}') — replace with plain, authentic human phrasing`
        } else if (sig && sig.hasQuantifier === false && sig.hasQualitativeOutcome === false && sig.hasOutcomeVerb === false) {
          status = 'warn'
          reason = 'Describes the task/tools but omits the result — add the CAR outcome (what problem this solved, what improved, or measurable scope)'
        } else {
          status = 'pass'
          reason = 'Clear, specific, no defects found'
        }

        audit.push({
          bulletId: b.id,
          section: section.key,
          itemName,
          text: b.text,
          status,
          reason,
          rewrite: issue?.correctedText || null,
          issueId: issue?.id || null,
          category: issue?.category || null,
        })
      }
    }
  }

  return audit
}

export default { computeScorecard, SCORECARD_VERSION, GRADE_BANDS }
