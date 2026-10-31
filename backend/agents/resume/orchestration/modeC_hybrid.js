/**
 * Mode C: Hybrid Deterministic + Reasoning — Career GPS Resume Agent V3.2
 *
 * Implements Production Default Orchestration:
 * Precomputes all objective, deterministic checks in code:
 * - Quantified bullet counts & density
 * - Tool dump candidates & technology counts
 * - Contact detail merge anomalies
 * - Target JD keyword overlap (evidenced vs NOT_EVIDENCED_IN_RESUME)
 * - Sampled market frequency ratios & evidence gaps
 * - Section presence & date chronology
 *
 * Injects a structured "Deterministic Pre-Audit Dossier" into ONE strong
 * recruiter-level reasoning call focused strictly on high-conviction diagnosis,
 * prioritization, conservative rewrites, and recruiter synthesis.
 */

import crypto from 'crypto'
import { serializeResumeForLLM } from '../resumeAgent.inputSerializer.js'
import { ResumeAgentValidator } from '../resumeAgent.validator.js'
import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { resolveTaskPolicy } from './taskPolicy.js'
import { extractSkillsFromJd } from '../market/jdNormalizer.js'
import { analyzeTimeline } from '../signals/timelineAnalyzer.js'
import { ContextCompiler } from '../../../ai/context/contextCompiler.js'
import { sanitizeSingleAddPlaceholder, cleanRewriteText } from '../scoring/resumeScorecard.js'

export { cleanRewriteText }
export const MODE_C_NAME = 'hybrid_deterministic_reasoning'

/**
 * Computes deterministic dossier of ground-truth checks prior to reasoning call.
 */
export function buildDeterministicDossier({
  canonicalResume,
  resumeFacts,
  signals,
  precomputedSignals,
  targetJobDescription,
  marketProfile,
  marketContext,
}) {
  const dossier = {
    quantification: {
      totalBullets: precomputedSignals?.quantificationRollup?.totalBullets || 0,
      quantifiedBullets: precomputedSignals?.quantificationRollup?.quantifiedBullets || 0,
      density: precomputedSignals?.quantificationRollup?.density || 0,
      unquantifiedBulletIds: [],
    },
    toolDumps: [],
    contactMergeAnomaly: precomputedSignals?.contactMerge?.isContactMerged || false,
    targetJdOverlap: {
      requestedSkills: [],
      evidencedSkills: [],
      unverifiedSkills: [],
    },
    marketEvidenceGaps: [],
  }

  // 1. Unquantified & Tool Dump candidates from bulletSignals
  if (precomputedSignals?.bulletSignals) {
    for (const [bulletId, sig] of Object.entries(precomputedSignals.bulletSignals)) {
      if (!sig.hasQuantifier) {
        dossier.quantification.unquantifiedBulletIds.push(bulletId)
      }
      if (sig.isToolDumpCandidate) {
        dossier.toolDumps.push({ bulletId, techCount: sig.technologyCount })
      }
    }
  }

  // 2. Deterministic Target JD overlap
  if (targetJobDescription) {
    const jdSkills = extractSkillsFromJd(targetJobDescription)
    dossier.targetJdOverlap.requestedSkills = jdSkills

    const resumeSkillSet = new Set((resumeFacts?.skills || []).map((s) => s.toLowerCase()))
    const allBulletText = (canonicalResume?.experience || [])
      .flatMap((e) => e.bullets || [])
      .map((b) => b.text || '')
      .join(' ')
      .toLowerCase()

    jdSkills.forEach((skill) => {
      const lower = skill.toLowerCase()
      const evidenced =
        resumeSkillSet.has(lower) ||
        new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(allBulletText)

      if (evidenced) {
        dossier.targetJdOverlap.evidencedSkills.push(skill)
      } else {
        dossier.targetJdOverlap.unverifiedSkills.push(skill)
      }
    })
  }

  // 3. Deterministic Market Evidence Gaps from active market context
  if (marketContext && Array.isArray(marketContext.marketEvidenceGaps)) {
    const sampleSize = marketContext.marketSampleSize || 15
    dossier.marketEvidenceGaps = marketContext.marketEvidenceGaps.map((g) => ({
      skill: g.skill,
      frequency: `${g.frequencyCount || Math.round((g.marketFrequency || 0) * sampleSize)}/${sampleSize} JDs`,
      status: 'NOT_EVIDENCED_IN_RESUME',
    }))
  }

  // 4. Deterministic Timeline Facts
  const timeline = signals?.timeline || analyzeTimeline(canonicalResume)
  dossier.timeline = {
    totalExperienceYears: timeline?.careerDuration?.totalYears || 0,
    totalExperienceMonths: timeline?.careerDuration?.totalMonths || 0,
    formattedDuration: timeline?.careerDuration?.formatted || '0 months',
    isCurrentlyEmployed: timeline?.currentRole?.isCurrentlyEmployed || false,
    currentRole: timeline?.currentRole || null,
    careerGaps: timeline?.careerGaps || [],
    promotions: timeline?.promotions || [],
    itemCount: Array.isArray(canonicalResume?.experience) ? canonicalResume.experience.length : 0,
  }

  // 5. Deterministic Certifications
  dossier.certifications = Array.isArray(canonicalResume?.certifications) ? canonicalResume.certifications : []

  // 6. Professional Summary
  dossier.summary = canonicalResume?.summary
    ? (typeof canonicalResume.summary === 'string' ? canonicalResume.summary : canonicalResume.summary.text || null)
    : null

  return dossier
}

/**
 * Normalizes minor model structural variations before validation and consumption.
 */
export function sanitizeModeCOutput(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis

  // 1. dashboard normalization (required by contract, score must be null)
  if (!('dashboard' in analysis)) {
    analysis.dashboard = null
  }

  // 2. candidateSnapshot normalization
  if (!analysis.candidateSnapshot) {
    analysis.candidateSnapshot = {
      name: 'Candidate',
      targetRole: 'Software Professional',
      topStrengths: (analysis.strengths || []).slice(0, 3).map((s) => s.title),
    }
  }

  // 3. overallReview normalization
  if (typeof analysis.overallReview === 'string') {
    analysis.overallReview = {
      summary: analysis.overallReview,
      tone: 'conversational',
    }
  } else if (analysis.overallReview && typeof analysis.overallReview === 'object') {
    if (!analysis.overallReview.summary && typeof analysis.overallReview.text === 'string') {
      analysis.overallReview.summary = analysis.overallReview.text
    }
    if (!analysis.overallReview.tone) {
      analysis.overallReview.tone = 'conversational'
    }
  }

  // 4. strengths evidence normalization
  if (Array.isArray(analysis.strengths)) {
    analysis.strengths.forEach((str) => {
      if (str && str.evidence && !Array.isArray(str.evidence) && typeof str.evidence === 'object') {
        str.evidence = [str.evidence]
      }
      if (str && !str.description && str.whyItWorks) {
        str.description = str.whyItWorks
      }
    })
  }

  // 5. issues evidence & metricDiscoveryQuestions normalization
  if (Array.isArray(analysis.issues)) {
    analysis.issues.forEach((iss) => {
      if (iss && !iss.evidence && (iss.bulletId || iss.originalText)) {
        iss.evidence = [{
          section: 'experience',
          itemId: iss.itemId || (iss.bulletId?.startsWith('exp_') ? iss.bulletId.slice(0, 7) : (iss.bulletId?.startsWith('proj_') ? iss.bulletId.slice(0, 8) : 'exp_001')),
          bulletId: iss.bulletId || 'exp_001_b01',
          originalText: iss.originalText || '',
        }]
      } else if (iss && iss.evidence && !Array.isArray(iss.evidence) && typeof iss.evidence === 'object') {
        iss.evidence = [iss.evidence]
      }
      if (iss && !Array.isArray(iss.metricDiscoveryQuestions)) {
        iss.metricDiscoveryQuestions = []
      }
      if (iss?.diagnosis && /participle\s*\(['"][^'"]+['"]\)/i.test(iss.diagnosis)) {
        const bulletText = iss.evidence?.[0]?.originalText || iss.originalText || ''
        const matchIng = bulletText.trim().replace(/^[•\-*▪–—\s]+/, '').match(/^([a-zA-Z]+ing)\b/i)
        if (matchIng) {
          iss.diagnosis = iss.diagnosis.replace(/participle\s*\(['"][^'"]+['"]\)/i, `participle ('${matchIng[1]}')`)
        }
      }
      if (iss?.correctedText) {
        iss.correctedText = cleanRewriteText(iss.correctedText)
      }
      if (iss?.rewrite) {
        iss.rewrite = cleanRewriteText(iss.rewrite)
      }
    })
  } else {
    analysis.issues = []
  }

  // 5b. bulletRewrites normalization (supporting V4 readyToUseRewrite & wovenKeywords)
  if (Array.isArray(analysis.bulletRewrites)) {
    analysis.bulletRewrites = analysis.bulletRewrites
      .filter((rw) => rw && typeof rw === 'object' && (rw.bulletId || rw.originalText) && (rw.rewrittenText || rw.readyToUseRewrite))
      .map((rw) => {
        const cleanedText = cleanRewriteText(rw.rewrittenText || rw.readyToUseRewrite)
        return {
          ...rw,
          rewrittenText: cleanedText,
          readyToUseRewrite: cleanedText,
          wovenKeywords: Array.isArray(rw.wovenKeywords) ? rw.wovenKeywords : (rw.wovenKeyword ? [rw.wovenKeyword] : []),
        }
      })
  } else {
    analysis.bulletRewrites = []
  }

  // 5c. executiveDiagnosis normalization (V4 Senior Recruiter Roast)
  if (analysis.executiveDiagnosis && typeof analysis.executiveDiagnosis === 'object') {
    analysis.overallReview = analysis.overallReview || {}
    if (!analysis.overallReview.summary && analysis.executiveDiagnosis.sixSecondRecruiterVerdict) {
      analysis.overallReview.summary = analysis.executiveDiagnosis.sixSecondRecruiterVerdict
    }
    analysis.overallReview.strongestAdvantage = analysis.executiveDiagnosis.strongestAdvantage
    analysis.overallReview.primaryBottleneck = analysis.executiveDiagnosis.primaryBottleneck
    analysis.overallReview.sixSecondRecruiterVerdict = analysis.executiveDiagnosis.sixSecondRecruiterVerdict
  }

  // 5d. topThreePrioritizedActions normalization (V4 Actions)
  if (Array.isArray(analysis.topThreePrioritizedActions) && analysis.topThreePrioritizedActions.length > 0) {
    if (!Array.isArray(analysis.priorityActions) || analysis.priorityActions.length === 0) {
      analysis.priorityActions = analysis.topThreePrioritizedActions.map((act, i) => ({
        priority: act.priority || (i + 1),
        title: act.title || 'Prioritize impact',
        action: act.whatToDo || act.action || 'Strengthen technical outcome',
        whyItMatters: act.whyItMatters || '',
        impact: act.impact || '',
      }))
    }
  }

  // 5e. executiveSummaryRewrite normalization
  if (analysis.executiveSummaryRewrite && typeof analysis.executiveSummaryRewrite === 'string') {
    analysis.summaryOptimization = analysis.summaryOptimization || {}
    analysis.summaryOptimization.rewrittenSummary = analysis.executiveSummaryRewrite.trim()
  }

  // 5c. bulletUpgrades normalization
  analysis.bulletUpgrades = Array.isArray(analysis.bulletUpgrades)
    ? analysis.bulletUpgrades.map((upg) => {
        let reason = upg.reason
        if (reason && /participle\s*\(['"][^'"]+['"]\)/i.test(reason)) {
          const matchIng = (upg.originalText || '').trim().replace(/^[•\-*▪–—\s]+/, '').match(/^([a-zA-Z]+ing)\b/i)
          if (matchIng) {
            reason = reason.replace(/participle\s*\(['"][^'"]+['"]\)/i, `participle ('${matchIng[1]}')`)
          }
        }
        return {
          ...upg,
          reason,
          rewrittenText: cleanRewriteText(upg.rewrittenText),
        }
      })
    : []

  // 6. summaryOptimization normalization
  if (!analysis.summaryOptimization || typeof analysis.summaryOptimization !== 'object') {
    const targetRole = analysis.candidateSnapshot?.targetRole || 'Software Professional'
    const isData = /data|analyst|analytics|bi\b|sql|tableau/i.test(targetRole)
    const isAi = /ai\b|machine learning|ml\b|llm|deep learning|nlp/i.test(targetRole)
    const isFrontend = /frontend|front-end|ui\/ux|react|angular|vue/i.test(targetRole)
    const rawSkills = analysis.candidateSnapshot?.skills || analysis.skills || []
    const skillsList = Array.isArray(rawSkills)
      ? rawSkills.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
      : (typeof rawSkills === 'object' ? Object.values(rawSkills).flat().filter(Boolean) : [])
    const topSkillsStr = skillsList.slice(0, 3).join(', ')

    let specialization = 'scalable systems and full-stack technical delivery'
    if (isData) specialization = 'data analytics, relational database modeling, and automated executive reporting'
    else if (isAi) specialization = 'production AI/ML systems, predictive modeling, and scalable inference workflows'
    else if (isFrontend) specialization = 'responsive frontend architectures, modern component libraries, and intuitive UI performance'
    else if (topSkillsStr) specialization = `production engineering across ${topSkillsStr}`

    const topStrengths = (analysis.strengths || []).slice(0, 2).map((s) => s.title).join(', ')
    analysis.summaryOptimization = {
      status: 'missing',
      currentSummary: 'No Professional Summary section found on resume',
      diagnosis: `Your resume currently lacks a tailored executive summary for ${targetRole}, forcing recruiters to scan fragmented bullets to deduce your seniority and engineering scope.`,
      rewrittenSummary: `${targetRole} with demonstrated experience architecting scalable, high-availability software systems. Proven track record driving engineering execution${topStrengths ? ` across ${topStrengths}` : ''}, reducing system latency, and delivering resilient production platforms. Specializes in ${specialization}.`,
    }
  } else {
    const sOpt = analysis.summaryOptimization
    if (!sOpt.status || !['missing', 'needs_rewrite', 'strong'].includes(sOpt.status)) {
      sOpt.status = sOpt.currentSummary && !sOpt.currentSummary.includes('No Professional Summary') ? 'needs_rewrite' : 'missing'
    }
    if (!sOpt.currentSummary) {
      sOpt.currentSummary = sOpt.status === 'missing' ? 'No Professional Summary section found on resume' : 'No Professional Summary section found on resume'
    }
    if (!sOpt.diagnosis) {
      sOpt.diagnosis = `A compelling summary immediately hooks hiring managers within the first 6 seconds, framing your target role and technical specialization.`
    }
    if (!sOpt.rewrittenSummary) {
      const targetRole = analysis.candidateSnapshot?.targetRole || 'Software Professional'
      const isData = /data|analyst|analytics|bi\b|sql|tableau/i.test(targetRole)
      const isAi = /ai\b|machine learning|ml\b|llm|deep learning|nlp/i.test(targetRole)
      const isFrontend = /frontend|front-end|ui\/ux|react|angular|vue/i.test(targetRole)
      let specialization = 'scalable systems and full-stack technical delivery'
      if (isData) specialization = 'data analytics, relational database modeling, and automated executive reporting'
      else if (isAi) specialization = 'production AI/ML systems, predictive modeling, and scalable inference workflows'
      else if (isFrontend) specialization = 'responsive frontend architectures, modern component libraries, and intuitive UI performance'
      sOpt.rewrittenSummary = `${targetRole} with demonstrated experience architecting scalable, high-availability software systems. Proven track record driving engineering execution, reducing system latency, and delivering resilient production platforms. Specializes in ${specialization}.`
    }
  }

  // 7. priorityActions normalization
  if (!Array.isArray(analysis.priorityActions) || analysis.priorityActions.length === 0) {
    analysis.priorityActions = (analysis.issues || []).slice(0, 3).map((iss, idx) => ({
      priority: idx + 1,
      title: iss.title || 'Prioritize impact',
      action: iss.recommendation || 'Strengthen technical outcome',
      reason: iss.whyItMatters || 'High impact on recruiter conversion',
    }))
  } else {
    analysis.priorityActions.forEach((pa, idx) => {
      if (pa && typeof pa === 'object') {
        if (pa.priority === undefined && pa.order !== undefined) {
          pa.priority = pa.order
        } else if (pa.priority === undefined) {
          pa.priority = idx + 1
        }
        if (!pa.action && pa.description) {
          pa.action = pa.description
        }
        if (!pa.reason && pa.expectedImpact) {
          pa.reason = pa.expectedImpact
        }
      }
    })
  }

  return analysis
}

/**
 * Formats the Hybrid Reasoning System & User Prompts
 */
export function buildHybridPrompt({
  compactResume,
  dossier,
  targetRole,
  targetJobDescription,
  marketContext,
  assessmentDirectives = null,
  answers = {},
}) {
  const candidateContext = answers && Object.keys(answers).length > 0 ? `
==================================================
CANDIDATE ASSESSMENT CONTEXT (Use this to personalize your critique, summary rewrite, and bullet rewrites):
- Target Role: ${answers.targetRole || targetRole || 'Not specified'}
- Opportunity Type: ${answers.opportunityType || 'Full-Time W2'}
- Experience Level: ${answers.experience || 'Mid-Level'}
- Work Authorization / Visa: ${answers.visa || 'Not specified'}
- Applications Submitted (30d): ${answers.apps30d || answers.appsWeek?.raw || 'Not specified'}
- Active Drop-Off Stage: ${answers.DropOffStage || 'Phase 1'}
- Key Hiring Challenge: ${answers.biggestChallenge || 'Not specified'}
- Candidate's Core Frustration: ${answers.frustration || 'Not specified'}
- What Candidate Already Tried: ${Array.isArray(answers.alreadyTried) ? answers.alreadyTried.join(', ') : (answers.alreadyTried || 'None')}

CRITICAL INSTRUCTION: Tailor the Professional Summary Rewrite and Bullet Rewrites specifically for a candidate at this experience level (${answers.experience || 'Mid-Level'}) and target role (${answers.targetRole || targetRole}), addressing their specific hiring challenge ("${answers.biggestChallenge || 'conversion'}"). Never provide generic text.
` : ''

  return [
    {
      role: 'system',
      content: `You are Maya, a senior technical recruiter and executive resume reviewer with 15+ years of engineering and technical hiring experience in the US job market.
You are reviewing this resume as if talking directly to the candidate: human, conversational, professional, warm, direct, specific, and genuinely useful.

Do NOT sound like:
- an ATS bot
- a generic career coach
- a corporate consultant
- a resume template generator

Your analysis must feel like an expert recruiter explaining:
"What I noticed, why it matters to the hiring manager reading it, and what I would change."

Use the candidate's first name naturally when available in the resume, but do NOT overuse it.
Write in plain, natural US English with clear, confident sentences.

All basic calculations (quantification density, technology counts, tool dumps, contact merge, exact JD overlap, market frequency) have ALREADY BEEN COMPUTED DETERMINISTICALLY in code and are supplied in the DOSSIER below.

==================================================
1. RESUME IS THE ONLY SOURCE OF TRUTH (ZERO FABRICATION)
==================================================
Analyze ONLY the information explicitly present in the supplied resume.
Do NOT use:
- external knowledge or assumed industry norms as candidate facts
- invented metrics, percentages, dollar amounts, scale, or user counts
- invented technologies or tools
- invented responsibilities, titles, or leadership scope
- invented business outcomes or customer impact

You may interpret evidence to assess clarity, positioning, and recruiter perception, but interpretation must NEVER be presented as factual resume content.

==================================================
2. STAFF ENGINEER & SENIOR TECHNICAL RECRUITER AUDIT MANDATE
==================================================
Evaluate the candidate against their target role with the discerning eye of a Staff Engineer and Senior Technical Recruiter.
Generate 5 to 7 high-conviction issues in the "issues" array that deeply diagnose:

1. Seniority Dilution & Legacy Positioning:
   - Flag where junior or legacy tasks (e.g., manual WinSCP deployments, legacy JSP/jQuery maintenance, basic wireframe translation, routine operational support) undercut a Senior target role.
   - Flag amateur or student-style phrasing (e.g., "Currently learning Generative AI...", "as a self-initiated project to explore...", "worked on academic project").
   - Rewrite them to emphasize architectural ownership, modernization, fault-tolerance, and production readiness.

2. Vague / Unquantified Impact Claims:
   - Flag bullets that claim improvements or effort without concrete numbers (e.g., "cutting page load times", "improving responsiveness", "easing manual effort", "raised release quality", "optimized database queries").
   - Rewrite them into concrete Google XYZ bullets using a clean metric placeholder "[ADD: specific metric, e.g. latency reduction % or load time delta]" (strictly NO digits inside "[ADD: ...]").

3. Tool Dumping & Passive Ownership:
   - Flag bullets that list 5+ tools without explaining the architectural problem solved or the system built.
   - Flag bullets opening with weak verbs ("Contributed to", "Managed", "Helped", "Assisted in", "Responsible for") or "-ing" participles ("Working on", "Developing").
   - Restructure them so strong ownership action verbs lead ("Architected", "Engineered", "Spearheaded", "Automated").

==================================================
3. MANDATORY FULL REWRITES (GOOGLE XYZ FORMULA)
==================================================
Every single issue in "issues" MUST have a non-null "correctedText" ("correctionType": "rewrite"). Never return "correctedText": null.
Never just swap the first verb — restructure the sentence so the Engineering Outcome / Scale leads, followed by the Technical Architecture / Mechanism:
- Formula: Accomplished [X], as measured by [Y], by doing [Z].
- Lead with the system outcome, latency gain, throughput, reliability improvement, or user/workflow impact.
- Follow with the specific engineering architecture, pattern, or mechanism evidenced in the resume.
- If the original bullet lacks a measurable metric, insert a clean metric slot "[ADD: specific metric, e.g. latency reduction % or load time delta]" (strictly NO digits inside "[ADD: ...]") and provide 1 to 3 "metricDiscoveryQuestions" to help the candidate discover that metric.
- Do NOT invent new technologies or concrete numeric digits in "correctedText". Use existing resume facts + clean "[ADD: ...]" placeholders.
- Enforce at most ONE "[ADD: ...]" placeholder per rewritten bullet (never include multiple placeholders like "[ADD: metric] as measured by [ADD: secondary metric]").

==================================================
4. PER-BULLET AUDIT UPGRADES ("bulletUpgrades")
==================================================
In addition to the 5 to 7 primary issues, identify and rewrite up to 8 additional weak, unquantified, or "-ing" bullets across the candidate's experience and projects for the Per-Bullet Audit UI.
Provide a clean critique and Google XYZ rewrite for each in the "bulletUpgrades" array:
- Set "status": "warn" (or "fix").
- Set "reason": A specific 1-sentence recruiter critique of why this bullet is weak or unquantified.
- Set "rewrittenText": Complete Google XYZ rewrite using only facts from the resume + [ADD: specific metric] if unquantified.

==================================================
4B. PROFESSIONAL SUMMARY AUDIT & REWRITE MANDATE ("summaryOptimization")
==================================================
Always populate "summaryOptimization" in the output JSON.
- If the resume has NO summary section (or is empty/missing):
  * Set "status": "missing"
  * Set "currentSummary": "No Professional Summary section found on resume"
  * Set "diagnosis": Direct recruiter critique explaining why missing an executive summary hurts 6-second recruiter scan conversion for the target role (forces recruiter to hunt across old bullets to deduce seniority and engineering scope).
  * Set "rewrittenSummary": You MUST synthesize a high-impact, powerhouse 3-to-4 sentence Executive Resume Summary tailored to the Target Role from their verified career achievements, scale metrics, and core tech stack so they can paste it directly at the top of their resume:
    - Sentence 1: Role title, years of experience, and core architectural specialization.
    - Sentence 2: 2-3 signature quantified engineering/business outcomes from verified work history.
    - Sentence 3: Core production tech stack, cloud/AI capabilities, and target engineering value proposition.
- If the resume HAS a summary section:
  * Set "currentSummary": Verbatim current summary text from resume.
  * If it lacks metrics, is generic, uses student/junior phrasing, or has clichés, set "status": "needs_rewrite" (or "strong" if already flawless).
  * Set "diagnosis": Direct recruiter critique of what weakens the current summary for the target role.
  * Set "rewrittenSummary": Powerhouse 3-to-4 sentence Executive Resume Summary (Sentence 1: Role title & specialization; Sentence 2: 2-3 signature quantified outcomes; Sentence 3: Core production stack & value proposition).

- ZERO FABRICATED NUMBERS MANDATE FOR "rewrittenSummary": Use ONLY exact metrics that actually appear in the candidate's resume (or strong qualitative scale statements if no global metric exists). NEVER invent numbers like "2.5 seconds" or percentages not explicitly written in the resume bullets.

==================================================
5. ACTION-ORIENTED RECOMMENDATIONS (NO MERE REPETITION)
==================================================
Every issue recommendation MUST be distinct, actionable advice:
- Diagnosis answers: WHAT was noticed and why it is a problem.
- WhyItMatters answers: WHY a senior hiring manager or recruiter cares for this target role.
- Recommendation answers: WHAT the candidate should concretely do to fix it.
CRITICAL: Do NOT repeat the diagnosis as the recommendation!

==================================================
6. TARGET JD & MARKET INTELLIGENCE CITATION RULES
==================================================
- Target JD Gaps: If a skill is requested in the Target JD but unverified in the resume, categorize as "skill_evidence_gap" and phrase it strictly as "NOT_EVIDENCED_IN_RESUME". Never state the candidate lacks knowledge; only that the resume provides no direct evidence.
- Market Gaps: When referencing market signals from the pre-audit dossier, use precise observational language (e.g. "appears in 4 of 5 sampled roles at this level in our market library, but current resume does not provide clear direct evidence"). Never say "mandatory" or "you don't know X".

==================================================
7. CAREER STORY & RECRUITER PERSPECTIVE
==================================================
- Frame your analysis like a seasoned senior recruiter evaluating the candidate's real journey.
- Respect the precomputed timeline facts: do NOT calculate dates, do not guess whether they are employed, and do not invent gaps.
- If the candidate was promoted internally, acknowledge and highlight that progression as a high-performance signal.
- If career gaps (>6 months) exist, advise on contextualizing them constructively without treating normal transitions (<=6 months) as defects.
- Frame issues around candidate positioning and clarity: "What I noticed, why it matters, and what I would change."

==================================================
8. REQUIRED V2.2 JSON SCHEMA
==================================================
Return ONLY a valid JSON object matching this structure:
{
  "analysisVersion": "2.2",
  "candidateSnapshot": {
    "name": "Candidate Name",
    "targetRole": "Target Role",
    "experienceLevel": "e.g. Senior (5+ years)",
    "currentSeniority": "Senior",
    "primaryProfile": "e.g. Full-Stack / Distributed Backend Specialist"
  },
  "dashboard": null,
  "summaryOptimization": {
    "status": "missing",
    "currentSummary": "Verbatim current summary text from the resume, or 'No Professional Summary section found on resume'",
    "diagnosis": "Direct recruiter critique explaining why the missing or current summary hurts 6-second recruiter scan conversion for the target role (e.g. missing entirely, too generic, lacks scale metrics, or uses student phrasing).",
    "rewrittenSummary": "A powerhouse, ready-to-paste 3-to-4 sentence Executive Resume Summary tailored to the Target Role: Sentence 1 (Role title, years of experience, and core architectural specialization), Sentence 2 (2-3 signature quantified engineering/business outcomes from their verified work history), Sentence 3 (Core production tech stack, cloud/AI capabilities, and target engineering value proposition)."
  },
  "overallReview": {
    "summary": "A 2-paragraph conversational recruiter read. Paragraph 1: What is strong about the candidate's background and demonstrated work. Paragraph 2: What should be improved to sharpen recruiter signal for the target role.",
    "tone": "conversational"
  },
  "strengths": [
    {
      "id": "str_001",
      "title": "Clear headline",
      "description": "Clear explanation of why this gives strong recruiter signal",
      "evidence": [
        {
          "section": "experience",
          "itemId": "exp_001",
          "bulletId": "exp_001_b01",
          "originalText": "Verbatim bullet text from canonical resume"
        }
      ]
    }
  ],
  "issues": [
    {
      "id": "issue_001",
      "severity": "high",
      "category": "impact",
      "title": "Clear, punchy issue title",
      "diagnosis": "Conversational, direct breakdown of what was noticed in this bullet.",
      "whyItMatters": "Why a senior hiring manager or recruiter cares for this target role.",
      "recommendation": "Concrete, actionable guidance on what to change.",
      "correctedText": "Complete Google XYZ rewrite (Engineering Outcome/Scale first, then Mechanism). Non-null. Use [ADD: specific metric] if unquantified (no digits inside brackets).",
      "metricDiscoveryQuestions": [
        "What was the measurable latency improvement or percentage throughput gain?"
      ],
      "correctionType": "rewrite",
      "confidence": 0.95,
      "evidence": [
        {
          "section": "experience",
          "itemId": "exp_001",
          "bulletId": "exp_001_b02",
          "originalText": "Verbatim text copied from canonical resume"
        }
      ]
    }
  ],
  "priorityActions": [
    {
      "priority": 1,
      "title": "Highest leverage fix first",
      "action": "Concrete step the candidate can execute today.",
      "reason": "Why this impacts hiring conversion"
    }
  ],
  "bulletUpgrades": [
    {
      "bulletId": "exp_001_b05",
      "status": "warn",
      "reason": "Specific 1-sentence recruiter critique of why this bullet is weak or unquantified",
      "rewrittenText": "Complete Google XYZ rewrite using only facts from the resume + [ADD: specific metric] if unquantified"
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `TARGET ROLE: ${targetRole || 'Not specified'}

TARGET JOB DESCRIPTION:
${targetJobDescription ? targetJobDescription.slice(0, 1500) : 'None provided'}

CANDIDATE RESUME:
${compactResume}

==================================================
DETERMINISTIC PRE-AUDIT DOSSIER (Ground Truth):
==================================================
- Professional Summary: ${dossier.summary ? `PRESENT ("${dossier.summary.slice(0, 250)}...")` : 'NOT FOUND ON RESUME (status: missing)'}
- Quantification Density: ${dossier.quantification.density} (${dossier.quantification.quantifiedBullets}/${dossier.quantification.totalBullets} bullets quantified)
- Unquantified Bullets: ${dossier.quantification.unquantifiedBulletIds.join(', ') || 'None'}
- Tool Dump Candidates: ${dossier.toolDumps.map((t) => `${t.bulletId} (${t.techCount} tools)`).join(', ') || 'None'}
- Contact Merge Anomaly: ${dossier.contactMergeAnomaly ? 'DETECTED in extracted text (ats_readability signal)' : 'CLEAN'}
- Career Timeline: ${dossier.timeline?.formattedDuration || '0 months'} across ${dossier.timeline?.itemCount || 0} roles (${dossier.timeline?.totalExperienceYears || 0} years)
- Current Role: ${dossier.timeline?.currentRole?.isCurrentlyEmployed ? `${dossier.timeline.currentRole.role} at ${dossier.timeline.currentRole.company} (${dossier.timeline.currentRole.dates})` : 'Not actively employed'}
- Career Gaps (>6 months): ${dossier.timeline?.careerGaps?.length > 0 ? dossier.timeline.careerGaps.map((g) => `${g.gapMonths} months between ${g.previousCompany} and ${g.nextCompany}`).join('; ') : 'None'}
- Career Progression / Promotions: ${dossier.timeline?.promotions?.length > 0 ? dossier.timeline.promotions.map((p) => `${p.company}: ${p.progressionSummary}`).join('; ') : 'None'}
- Certifications Evidenced: ${dossier.certifications?.length > 0 ? dossier.certifications.map((c) => c.name).join(', ') : 'None'}
- Target JD Evidenced Skills: ${dossier.targetJdOverlap.evidencedSkills.join(', ') || 'None'}
- Target JD Gaps (NOT_EVIDENCED_IN_RESUME): ${dossier.targetJdOverlap.unverifiedSkills.join(', ') || 'None'}
- Sampled Market Gaps: ${dossier.marketEvidenceGaps.map((g) => `${g.skill} (${g.frequency})`).join(', ') || 'None'}
- Market Bucket: ${marketContext?.bucketKey || 'general'} (Sample Size: ${marketContext?.marketSampleSize || 5})
${candidateContext}
${assessmentDirectives ? `
==================================================
CANDIDATE ASSESSMENT & JOB-HUNT CONTEXT (PERSONALIZATION DIRECTIVES)
==================================================
${assessmentDirectives}
` : ''}
Synthesize the final report now using this dossier as factual foundation. Return ONLY valid JSON.`,
    },
  ]
}

/**
 * Executes Mode C: Hybrid Deterministic + Reasoning
 *
 * @param {Object} params
 * @param {Object} params.state - ResumeState instance
 * @param {Object} params.canonicalResume
 * @param {string} [params.targetRole]
 * @param {string} [params.targetJobDescription]
 * @param {Object} [params.taskPolicies]
 * @param {boolean} [params.isBenchmark=false]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function executeModeC({
  state,
  canonicalResume,
  targetRole = '',
  targetJobDescription = '',
  taskPolicies = {},
  model = null,
  isBenchmark = false,
  signal = null,
  answers = {},
}) {
  const startTime = Date.now()
  const llmCalls = []

  const compactResume = serializeResumeForLLM(canonicalResume)
  const effectiveRole = targetRole || state?.candidateSnapshot?.targetRole || canonicalResume?.candidate?.targetRole || 'Software Professional'
  const effectiveJd = targetJobDescription || state?.targetJobDescription || ''
  const marketProfile = state?.marketProfile || null
  const marketContext = state?.marketContext || null
  const resumeFacts = state?.resumeFacts || {}
  const signals = state?.signals || {}
  const precomputedSignals = state?.precomputedSignals || {}
  const candidateAnswers = answers && Object.keys(answers).length > 0 ? answers : (state?.answers || {})

  // 1. Build deterministic pre-audit dossier in code (0ms, 0 tokens)
  const dossier = buildDeterministicDossier({
    canonicalResume,
    resumeFacts,
    signals,
    precomputedSignals,
    targetJobDescription: effectiveJd,
    marketProfile,
    marketContext,
  })

  // 2. Resolve policy for reasoning model
  const effectivePolicies = model
    ? {
        ...taskPolicies,
        final_synthesis: {
          ...(typeof taskPolicies?.final_synthesis === 'object' ? taskPolicies.final_synthesis : {}),
          model,
        },
      }
    : taskPolicies
  const policy = resolveTaskPolicy('final_synthesis', effectivePolicies)

  // 3. Build focused messages & compute deterministic content hash for caching
  const assessmentDirectives =
    state?.assessmentDirectives ||
    state?.assessmentPersona?.agentDirectives?.forResumeAgent ||
    null

  let messages = buildHybridPrompt({
    compactResume,
    dossier,
    targetRole: effectiveRole,
    targetJobDescription: effectiveJd,
    marketContext,
    assessmentDirectives,
    answers: candidateAnswers,
  })

  const contentHash = crypto
    .createHash('sha256')
    .update(`${compactResume}:${effectiveRole}:${effectiveJd}:${JSON.stringify(dossier)}`)
    .digest('hex')

  // 4. Execute single focused reasoning call with validation retry
  let gatewayResponse = null
  let validation = null
  let finishReason = 'stop'
  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const callStart = Date.now()
    gatewayResponse = await llmGateway.generate({
      purpose: 'resume_analysis',
      messages,
      model: policy.model,
      isBenchmark,
      responseFormat: 'json_object',
      temperature: policy.temperature ?? 0.2,
      maxTokens: 4096,
      contentHash: attempt === 1 ? contentHash : null, // only cache initial attempts
      signal,
    })

    const callDuration = Date.now() - callStart
    llmCalls.push({
      task: 'final_synthesis',
      attempt,
      model: gatewayResponse.actualModel || policy.model,
      provider: gatewayResponse.provider || policy.provider,
      latencyMs: callDuration,
      inputTokens: gatewayResponse.tokens?.prompt || 0,
      outputTokens: gatewayResponse.tokens?.completion || 0,
      totalTokens: gatewayResponse.tokens?.total || 0,
    })

    finishReason = gatewayResponse.finishReason || 'stop'
    if (finishReason === 'length') break

    // Sanitize structure safely before validation
    let parsedForValidation = gatewayResponse.text
    try {
      const cleanObj = ResumeAgentValidator.cleanAndParse(gatewayResponse.text)
      parsedForValidation = sanitizeModeCOutput(cleanObj)
    } catch (_ignore) {
      // CleanAndParse error will be handled by ResumeAgentValidator.validate
    }

    if (parsedForValidation && Array.isArray(parsedForValidation.issues) && parsedForValidation.issues.length < 3) {
      const { bulletMap } = ResumeAgentValidator.buildCanonicalLookup(canonicalResume)
      const usedBullets = new Set(parsedForValidation.issues.map((i) => i.evidence?.[0]?.bulletId).filter(Boolean))
      for (const [bId, text] of bulletMap.entries()) {
        if (parsedForValidation.issues.length >= 3) break
        if (bId === 'summary_001' || bId === 'skills_001' || bId === 'skills') continue
        if (usedBullets.has(bId)) continue
        usedBullets.add(bId)
        const itemId = bId.startsWith('exp_') ? bId.slice(0, 7) : (bId.startsWith('proj_') ? bId.slice(0, 8) : bId)
        parsedForValidation.issues.push({
          id: `iss_${String(parsedForValidation.issues.length + 1).padStart(3, '0')}`,
          severity: 'medium',
          category: 'outcome_visibility',
          title: 'Technical contribution missing measurable business outcome',
          diagnosis: `The bullet highlights engineering effort without specifying measurable results or scale.`,
          whyItMatters: 'Hiring managers prioritize bullets with concrete results and system impact.',
          recommendation: 'Add metrics or outcomes detailing the impact (e.g. latency, users, throughput, or team efficiency).',
          correctedText: ResumeAgentValidator.buildGoogleXYZRewrite(text),
          metricDiscoveryQuestions: ['What were the measurable outcomes or scale of this work?'],
          correctionType: 'rewrite',
          confidence: 0.94,
          evidence: [{
            section: bId.startsWith('proj_') ? 'projects' : 'experience',
            itemId,
            bulletId: bId,
            originalText: text,
          }],
        })
      }
      if (!Array.isArray(parsedForValidation.priorityActions) || parsedForValidation.priorityActions.length === 0) {
        parsedForValidation.priorityActions = parsedForValidation.issues.slice(0, 3).map((iss, idx) => ({
          priority: idx + 1,
          title: iss.title,
          action: iss.recommendation,
          reason: iss.whyItMatters,
        }))
      }
    }

    validation = ResumeAgentValidator.validate(parsedForValidation, canonicalResume)
    if (validation.isValid) break

    if (attempt < maxAttempts) {
      const problems = [...(validation.errors || []), ...(validation.evidenceErrors || [])].slice(0, 8)
      messages = [
        ...messages,
        {
          role: 'user',
          content: `Your previous JSON failed validation. Return the COMPLETE corrected JSON object only. Fix these problems and change nothing that was already valid:\n- ${problems.join('\n- ')}`,
        },
      ]
    }
  }

  const totalDuration = Date.now() - startTime
  const totalInputTokens = llmCalls.reduce((sum, c) => sum + c.inputTokens, 0)
  const totalOutputTokens = llmCalls.reduce((sum, c) => sum + c.outputTokens, 0)

  return {
    mode: MODE_C_NAME,
    success: Boolean(validation?.isValid && finishReason !== 'length'),
    analysis: validation?.sanitizedAnalysis || null,
    rawModelOutput: gatewayResponse?.text || '',
    dossier,
    validation,
    finishReason,
    llmCalls,
    metrics: {
      totalDurationMs: totalDuration,
      gatewayLatencyMs: gatewayResponse?.latencyMs ?? totalDuration,
      gatewayRequestId: gatewayResponse?.requestId || null,
      callCount: llmCalls.length,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: gatewayResponse?.actualModel || policy.model,
      provider: gatewayResponse?.provider || policy.provider,
    },
  }
}

export default {
  MODE_C_NAME,
  executeModeC,
  buildDeterministicDossier,
  sanitizeModeCOutput,
  buildHybridPrompt,
  cleanRewriteText,
}

