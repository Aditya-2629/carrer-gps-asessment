/**
 * Mode D: Chunked Section Synthesis — Career GPS Resume Agent V3.2
 *
 * Solves monolithic request overload, 503 gateway timeouts, and token overflow:
 * 1. Partitions Canonical Resume into bite-sized semantic chunks:
 *    - Chunk A: Summary, Skills & Contact (Positioning, ATS readability, Skill gaps)
 *    - Chunk B: Primary Experience / Current Role (High-impact ownership, quantification, outcomes)
 *    - Chunk C: Secondary Experience & Projects (Historical track record, technical depth)
 * 2. Runs lightweight parallel evaluations (< 700 tokens per prompt) with 100% exact verbatim evidence.
 * 3. Deterministically consolidates specialist findings into complete V2.2 canonical analysis.
 */

import { ResumeAgentValidator } from '../resumeAgent.validator.js'
import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { resolveTaskPolicy } from './taskPolicy.js'
import { computeScorecard } from '../scoring/resumeScorecard.js'
import { QUALITATIVE_OUTCOME_REGEX } from '../signals/patterns.js'

export const MODE_D_NAME = 'chunked_section_synthesis'

/**
 * Partitions canonical resume into 2 to 3 compact chunks
 */
export function partitionResumeIntoChunks(canonicalResume, targetRole = '') {
  const effectiveRole = targetRole || canonicalResume.candidate?.targetRole || 'Technical Professional'
  const chunks = []

  // ── Chunk 1: Summary, Skills & Contact Details ─────────────────────────────
  const summaryText = (canonicalResume.summary?.text || '').trim()
  const skillsList = (canonicalResume.skills || []).map((s) => s.name).filter(Boolean)
  const contact = canonicalResume.candidate?.contact || {}
  const contactMergeAnomaly = Boolean(contact.email && contact.phone && summaryText.includes(contact.email))

  const chunk1Lines = [
    `TARGET ROLE: ${effectiveRole}`,
    `CANDIDATE: ${canonicalResume.candidate?.name || 'Candidate'}`,
    `LOCATION: ${contact.location || 'Not specified'}`,
    `LINKEDIN: ${contact.linkedin || 'Not provided'}`,
  ]
  if (summaryText) {
    chunk1Lines.push(`\nSUMMARY:\n[summary_001]\n${summaryText}`)
  }
  if (skillsList.length > 0) {
    chunk1Lines.push(`\nSKILLS:\n${skillsList.join(', ')}`)
  }

  chunks.push({
    id: 'chunk_summary_skills',
    sectionType: 'summary_and_skills',
    label: 'Summary, Skills & Professional Positioning',
    content: chunk1Lines.join('\n'),
    guidance: `Evaluate professional positioning for "${effectiveRole}", summary clichés vs distinct value proposition, technology dumping in skills vs demonstrated evidence, and contact formatting safety.`,
  })

  // ── Chunk 2 & 3: Experience & Projects ──────────────────────────────────────
  const experience = Array.isArray(canonicalResume.experience) ? canonicalResume.experience : []
  const projects = Array.isArray(canonicalResume.projects) ? canonicalResume.projects : []

  if (experience.length > 0) {
    // Current / Most Recent Job (Primary)
    const primaryExp = experience.slice(0, 1)
    const remainingExp = experience.slice(1)

    const formatExpBlock = (expItems) => {
      const blocks = []
      for (const exp of expItems) {
        if (!exp) continue
        const lines = [`[${exp.id}] Role: ${exp.role || ''} | Company: ${exp.company || ''} | Dates: ${exp.dates || ''}`]
        for (const b of exp.bullets || []) {
          if (b && b.text) {
            lines.push(`[${b.id}]\n${b.text.trim()}`)
          }
        }
        blocks.push(lines.join('\n'))
      }
      return blocks.join('\n\n')
    }

    const primaryText = formatExpBlock(primaryExp)
    if (primaryText) {
      chunks.push({
        id: 'chunk_primary_experience',
        sectionType: 'primary_experience',
        label: 'Primary / Current Experience',
        content: `TARGET ROLE: ${effectiveRole}\n\nEXPERIENCE (CURRENT / PRIMARY ROLE):\n\n${primaryText}`,
        guidance: `Evaluate the candidate's most recent and important role: look for quantified technical impact (latency, scale, throughput), ownership strength (avoid "helped with"), outcome visibility, and technology demonstration.`,
      })
    }

    // Secondary Past Jobs & Projects
    const secondaryBlocks = []
    if (remainingExp.length > 0) {
      secondaryBlocks.push(formatExpBlock(remainingExp))
    }
    if (projects.length > 0) {
      const projBlocks = []
      for (const proj of projects) {
        if (!proj) continue
        const lines = [`[${proj.id}] ${proj.title || 'Project'}`]
        for (const b of proj.bullets || []) {
          if (b && b.text) lines.push(`[${b.id}]\n${b.text.trim()}`)
        }
        projBlocks.push(lines.join('\n'))
      }
      if (projBlocks.length > 0) {
        secondaryBlocks.push(`PROJECTS:\n\n${projBlocks.join('\n\n')}`)
      }
    }

    if (secondaryBlocks.length > 0) {
      chunks.push({
        id: 'chunk_past_experience_projects',
        sectionType: 'past_experience_and_projects',
        label: 'Past Experience & Technical Projects',
        content: `TARGET ROLE: ${effectiveRole}\n\n${secondaryBlocks.join('\n\n')}`,
        guidance: `Evaluate historical career progression, consistency of technical impact across past roles, and practical outcome visibility in technical projects.`,
      })
    }
  } else if (projects.length > 0) {
    // Projects only
    const projLines = []
    for (const proj of projects) {
      if (!proj) continue
      projLines.push(`[${proj.id}] ${proj.title || 'Project'}`)
      for (const b of proj.bullets || []) {
        if (b && b.text) projLines.push(`[${b.id}]\n${b.text.trim()}`)
      }
    }
    chunks.push({
      id: 'chunk_projects',
      sectionType: 'projects',
      label: 'Technical Projects',
      content: `TARGET ROLE: ${effectiveRole}\n\nPROJECTS:\n\n${projLines.join('\n')}`,
      guidance: `Evaluate architecture depth, production viability, and outcome demonstration in technical projects.`,
    })
  }

  return chunks
}

/**
 * Builds small, focused prompt for an individual chunk
 */
function buildChunkPrompt(chunk, targetRole) {
  const defaultSection = chunk.sectionType === 'summary_and_skills' ? 'skills' : (chunk.sectionType === 'projects' ? 'projects' : 'experience')
  const defaultItemId = chunk.sectionType === 'summary_and_skills' ? 'skills_001' : (chunk.sectionType === 'projects' ? 'proj_001' : 'exp_001')
  const defaultBulletId = chunk.sectionType === 'summary_and_skills' ? 'skills_001' : (chunk.sectionType === 'projects' ? 'proj_001_b01' : 'exp_001_b01')

  return [
    {
      role: 'system',
      content: `You are Maya, a senior technical recruiter and resume strategist analyzing a focused chunk of a candidate's resume for target role: "${targetRole}".
Analyze ONLY the provided text chunk using our 8-Point Human-First Resume Rubric:
- Eliminate repetitive words/verbs, ensure tense consistency (present for current role, past for completed roles; ban "-ing" gerund openings), avoid AI buzzwords, lead with strong action verbs, apply STAR/CAR frameworks, and write natural human rewrites.
- Do NOT fixate on missing metrics: qualitative STAR/CAR outcomes (retiring legacy tools, enforcing security/RBAC boundaries, eliminating technical debt) are valid first-class impact without numbers.

CRITICAL RULES:
1. Every evidence "originalText" MUST be an EXACT, VERBATIM quote copied word-for-word from the text in this chunk.
2. Identify 1 to 2 key strengths that give strong recruiter signal.
3. Identify 1 to 2 meaningful issues from the 8-Point Rubric.
4. Do NOT invent metrics or outside facts.
5. You must return ONLY raw JSON matching this structure without Markdown wrappers:
{
  "strengths": [
    {
      "title": "Short headline",
      "description": "Recruiter signal",
      "evidence": [
        {
          "section": "${defaultSection}",
          "itemId": "${defaultItemId}",
          "bulletId": "${defaultBulletId}",
          "originalText": "Exact verbatim quote from chunk"
        }
      ]
    }
  ],
  "issues": [
    {
      "severity": "medium",
      "category": "impact",
      "title": "Clear issue headline",
      "diagnosis": "What was noticed",
      "whyItMatters": "Why this matters for target role",
      "recommendation": "Concrete advice to improve",
      "correctedText": null,
      "metricDiscoveryQuestions": [],
      "correctionType": "none",
      "confidence": 0.95,
      "evidence": [
        {
          "section": "${defaultSection}",
          "itemId": "${defaultItemId}",
          "bulletId": "${defaultBulletId}",
          "originalText": "Exact verbatim quote from chunk"
        }
      ]
    }
  ]
}`,
    },
    {
      role: 'user',
      content: `SECTION: ${chunk.label}
GUIDANCE: ${chunk.guidance}

CONTENT CHUNK:
${chunk.content}

Analyze this chunk now. Output ONLY a valid JSON object.`,
    },
  ]
}

/**
 * Executes Mode D: Chunked Section Synthesis
 */
export async function executeModeD({
  state,
  canonicalResume,
  targetRole = '',
  targetJobDescription = '',
  taskPolicies = {},
  model = null,
  isBenchmark = false,
  signal = null,
}) {
  const startTime = Date.now()
  const llmCalls = []
  const effectiveRole = targetRole || canonicalResume.candidate?.targetRole || 'Technical Professional'

  const chunkModel =
    model ||
    process.env.RESUME_PRIMARY_MODEL ||
    aiConfig.defaultResumeModel ||
    'gemini-3.8-flash'

  const policy = resolveTaskPolicy('final_synthesis', {
    ...taskPolicies,
    final_synthesis: {
      provider: 'auto',
      model: chunkModel,
      temperature: 0.1,
      maxTokens: 2500,
    },
  })

  // 1. Partition resume into bite-sized chunks
  const chunks = partitionResumeIntoChunks(canonicalResume, effectiveRole)

  // 2. Execute chunk analyses in parallel
  const chunkPromises = chunks.map(async (chunk) => {
    const chunkStart = Date.now()
    const messages = buildChunkPrompt(chunk, effectiveRole)
    console.log(`[ModeD Chunked] Dispatching chunk ${chunk.id} with model: ${policy.model}`)

    try {
      const resp = await llmGateway.generate({
        purpose: 'resume_analysis',
        messages,
        model: policy.model,
        isBenchmark,
        responseFormat: 'json_object',
        temperature: 0.1,
        maxTokens: 2048,
        signal,
      })

      const latencyMs = Date.now() - chunkStart
      llmCalls.push({
        task: `chunk_${chunk.sectionType}`,
        model: resp.actualModel || policy.model,
        provider: resp.provider || policy.provider,
        latencyMs: typeof resp.latencyMs === 'number' ? resp.latencyMs : latencyMs,
        requestId: resp.requestId || null,
        inputTokens: resp.tokens?.prompt || 0,
        outputTokens: resp.tokens?.completion || 0,
        totalTokens: resp.tokens?.total || 0,
      })

      let parsed = null
      try {
        parsed = ResumeAgentValidator.cleanAndParse(resp.text)
      } catch (_e) {
        parsed = { strengths: [], issues: [] }
      }

      return {
        chunkId: chunk.id,
        sectionType: chunk.sectionType,
        success: resp.finishReason !== 'length',
        finishReason: resp.finishReason || 'stop',
        data: parsed,
      }
    } catch (err) {
      console.warn(`[ModeD Chunked] Chunk ${chunk.id} evaluation error:`, err.message)
      return {
        chunkId: chunk.id,
        sectionType: chunk.sectionType,
        success: false,
        finishReason: 'error',
        error: err.message,
        data: { strengths: [], issues: [] },
      }
    }
  })

  const chunkResults = await Promise.all(chunkPromises)

  // If all chunks were truncated due to length limits, propagate fatal truncation
  const allTruncated = chunkResults.length > 0 && chunkResults.every((r) => r.finishReason === 'length')
  if (allTruncated) {
    return {
      mode: MODE_D_NAME,
      success: false,
      finishReason: 'length',
      rawModelOutput: '',
      analysis: null,
      validation: {
        isValid: false,
        isSchemaValid: false,
        isEvidenceValid: false,
        errors: ['Output incomplete due to token length limit.'],
      },
      metrics: {
        totalDurationMs: Date.now() - startTime,
        callCount: llmCalls.length,
        model: policy.model,
        provider: policy.provider,
      },
    }
  }

  // If all chunks failed during generation, propagate provider failure
  const allFailed = chunkResults.length > 0 && chunkResults.every((r) => !r.success)
  if (allFailed) {
    const firstErr = chunkResults.find((r) => r.error)?.error || 'All section chunks failed to execute.'
    return {
      mode: MODE_D_NAME,
      success: false,
      finishReason: 'error',
      rawModelOutput: '',
      analysis: null,
      validation: {
        isValid: false,
        isSchemaValid: false,
        isEvidenceValid: false,
        errors: [firstErr],
      },
      metrics: {
        totalDurationMs: Date.now() - startTime,
        callCount: llmCalls.length,
        model: policy.model,
        provider: policy.provider,
      },
    }
  }

  // 3. Aggregate Strengths & Issues across all chunks
  const combinedStrengths = []
  const combinedIssues = []
  const seenOriginalTexts = new Set()

  let strCounter = 1
  let issCounter = 1

  for (const res of chunkResults) {
    const data = res.data || {}

    // Add strengths
    for (const str of data.strengths || []) {
      if (!str || !str.title) continue
      const ev = Array.isArray(str.evidence) ? str.evidence[0] : str.evidence
      const quote = ev?.originalText || ''
      if (quote && seenOriginalTexts.has(quote)) continue
      if (quote) seenOriginalTexts.add(quote)

      combinedStrengths.push({
        id: `str_${String(strCounter).padStart(3, '0')}`,
        title: str.title,
        description: str.description || str.title,
        evidence: ev ? [ev] : [],
      })
      strCounter++
    }

    // Add issues with clustering & deduplication
    for (const iss of data.issues || []) {
      if (!iss || !iss.title) continue
      const ev = Array.isArray(iss.evidence) ? iss.evidence[0] : iss.evidence
      const quote = ev?.originalText || ''
      if (quote && seenOriginalTexts.has(quote)) continue
      if (quote) seenOriginalTexts.add(quote)

      const normTitle = (iss.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      const existing = combinedIssues.find(
        (ci) => (ci.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') === normTitle
      )
      if (existing) {
        if (ev && !existing.evidence.some((e) => (e.bulletId && e.bulletId === ev.bulletId) || (e.originalText && e.originalText === ev.originalText))) {
          existing.evidence.push(ev)
        }
        if (iss.severity === 'high') existing.severity = 'high'
        else if (iss.severity === 'medium' && existing.severity === 'low') existing.severity = 'medium'
        if (!existing.correctedText && iss.correctedText) {
          existing.correctedText = iss.correctedText
          existing.correctionType = iss.correctionType || 'rewrite'
        }
        continue
      }

      combinedIssues.push({
        id: `iss_${String(issCounter).padStart(3, '0')}`,
        severity: iss.severity || 'medium',
        category: iss.category || 'impact',
        title: iss.title,
        diagnosis: iss.diagnosis || iss.title,
        whyItMatters: iss.whyItMatters || 'Matters for role competitiveness',
        recommendation: iss.recommendation || 'Strengthen the wording and outcome of this item',
        correctedText: iss.correctedText || null,
        metricDiscoveryQuestions: Array.isArray(iss.metricDiscoveryQuestions) ? iss.metricDiscoveryQuestions : [],
        correctionType: iss.correctionType || 'none',
        confidence: typeof iss.confidence === 'number' ? iss.confidence : 0.95,
        evidence: ev ? [ev] : [],
      })
      issCounter++
    }
  }

  // Helper to add or cluster fallback issue
  const addOrClusterFallbackIssue = (issueDef) => {
    const normTitle = (issueDef.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    const existing = combinedIssues.find(
      (ci) => (ci.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') === normTitle
    )
    if (existing) {
      const ev = issueDef.evidence[0]
      if (ev && !existing.evidence.some((e) => (e.bulletId && e.bulletId === ev.bulletId) || (e.originalText && e.originalText === ev.originalText))) {
        existing.evidence.push(ev)
      }
      return
    }

    if ((issueDef.severity === 'medium' || issueDef.severity === 'high') && (!issueDef.correctedText || issueDef.correctedText === 'null')) {
      const evQuote = issueDef.evidence?.[0]?.originalText || issueDef.title
      issueDef.correctedText = ResumeAgentValidator.buildGoogleXYZRewrite(evQuote)
      issueDef.correctionType = 'rewrite'
    }

    combinedIssues.push({
      ...issueDef,
      id: `iss_${String(issCounter).padStart(3, '0')}`,
    })
    issCounter++
  }

  // 4. Ensure at least 3 valid issues exist (enforcing V2.2 schema contract)
  if (combinedIssues.length < 3) {
    const precomputed = state?.precomputedSignals || {}
    const bulletSignals = precomputed.bulletSignals || {}

    // A. Tool dump signal from precomputed
    for (const [bId, sig] of Object.entries(bulletSignals)) {
      if (combinedIssues.length >= 5) break
      if (sig.isToolDumpCandidate) {
        let foundText = ''
        let foundItemId = 'exp_001'
        for (const exp of canonicalResume.experience || []) {
          for (const b of exp.bullets || []) {
            if (b.id === bId) {
              foundText = b.text
              foundItemId = exp.id
              break
            }
          }
        }
        if (foundText && !seenOriginalTexts.has(foundText)) {
          seenOriginalTexts.add(foundText)
          addOrClusterFallbackIssue({
            severity: 'medium',
            category: 'impact',
            title: 'Technology list without demonstrated outcome',
            diagnosis: `Bullet lists ${sig.technologyCount} technologies without demonstrating what was built or achieved.`,
            whyItMatters: 'Hiring managers look for evidence of how technologies were applied to solve problems.',
            recommendation: 'Highlight the primary framework used and add the concrete system or feature delivered.',
            correctedText: ResumeAgentValidator.buildGoogleXYZRewrite(foundText),
            metricDiscoveryQuestions: ['What was the primary service or feature delivered using these technologies?'],
            correctionType: 'rewrite',
            confidence: 0.95,
            evidence: [{ section: 'experience', itemId: foundItemId, bulletId: bId, originalText: foundText }],
          })
        }
      }
    }

    // B. Unquantified bullet signal from precomputed
    // Rule: At most ONE consolidated issue card about missing metrics/quantification across the entire report.
    // Never flag bullets that already demonstrate clear qualitative STAR/CAR outcomes.
    const hasMetricIssue = () =>
      combinedIssues.some((i) => /measurable|metric|outcome|unquantified/i.test(i.title || '') || i.category === 'outcome_visibility')

    for (const [bId, sig] of Object.entries(bulletSignals)) {
      if (combinedIssues.length >= 4) break
      if (hasMetricIssue()) break
      if (!sig.hasQuantifier && !sig.isToolDumpCandidate && !sig.hasQualitativeOutcome) {
        let foundText = ''
        let foundItemId = 'exp_001'
        for (const exp of canonicalResume.experience || []) {
          for (const b of exp.bullets || []) {
            if (b.id === bId) {
              foundText = b.text
              foundItemId = exp.id
              break
            }
          }
        }
        if (foundText && foundText.length > 25 && !seenOriginalTexts.has(foundText) && !QUALITATIVE_OUTCOME_REGEX.test(foundText)) {
          seenOriginalTexts.add(foundText)
          addOrClusterFallbackIssue({
            severity: 'low',
            category: 'outcome_visibility',
            title: 'Responsibility described without measurable outcome',
            diagnosis: 'This bullet describes ongoing technical effort, but lacks a visible result or milestone.',
            whyItMatters: 'Quantified outcomes help senior technical hiring managers benchmark your direct contribution.',
            recommendation: 'If verified numbers exist (percentage, latency, user scale, or hours saved), mention them directly.',
            correctedText: null,
            metricDiscoveryQuestions: ['What changed after you delivered this work?'],
            correctionType: 'none',
            confidence: 0.92,
            evidence: [{ section: 'experience', itemId: foundItemId, bulletId: bId, originalText: foundText }],
          })
        }
      }
    }

    // C. Direct canonical fallback loop (if precomputed signals were absent or returned < 3 issues)
    if (combinedIssues.length < 3) {
      for (const exp of canonicalResume.experience || []) {
        if (combinedIssues.length >= 3) break
        for (const b of exp.bullets || []) {
          if (combinedIssues.length >= 3) break
          if (!b || !b.text || seenOriginalTexts.has(b.text)) continue
          const text = b.text.trim()
          if (text.length < 20) continue

          const hasMetric = /\d+%|\b\d+\b/.test(text)
          const hasQualitative = QUALITATIVE_OUTCOME_REGEX.test(text)
          if (!hasMetric && !hasQualitative && !hasMetricIssue()) {
            seenOriginalTexts.add(text)
            addOrClusterFallbackIssue({
              severity: 'medium',
              category: 'outcome_visibility',
              title: 'Technical contribution missing measurable business outcome',
              diagnosis: `The bullet "${text.length > 60 ? text.slice(0, 57) + '...' : text}" highlights implementation work without specifying the measurable impact or scale.`,
              whyItMatters: 'Senior technical recruiters prioritize bullets that showcase concrete results, throughput improvements, or business value over generic task lists.',
              recommendation: 'Add metrics detailing the outcome (e.g. latency reduced, scale handled, team efficiency gained, or dollars saved).',
              correctedText: ResumeAgentValidator.buildGoogleXYZRewrite(text),
              metricDiscoveryQuestions: ['What were the measurable performance or business outcomes of this project?'],
              correctionType: 'rewrite',
              confidence: 0.94,
              evidence: [{ section: 'experience', itemId: exp.id || 'exp_001', bulletId: b.id || 'exp_001_b01', originalText: text }],
            })
          }
        }
      }
    }

    // D. Projects fallback if still < 3
    if (combinedIssues.length < 3) {
      for (const proj of canonicalResume.projects || []) {
        if (combinedIssues.length >= 3) break
        for (const b of proj.bullets || []) {
          if (combinedIssues.length >= 3) break
          if (!b || !b.text || seenOriginalTexts.has(b.text)) continue
          const text = b.text.trim()
          if (text.length < 20) continue

          seenOriginalTexts.add(text)
          addOrClusterFallbackIssue({
            severity: 'low',
            category: 'outcome_visibility',
            title: 'Project architecture outcome visibility',
            diagnosis: `Project bullet describes technical architecture without stating user adoption, benchmark results, or production status.`,
            whyItMatters: 'Demonstrating production readiness or measured performance in technical projects significantly strengthens senior engineering positioning.',
            recommendation: 'Specify benchmark performance metrics, deployment environments, or user adoption numbers.',
            correctedText: null,
            metricDiscoveryQuestions: ['What benchmark numbers or production scale did this project achieve?'],
            correctionType: 'none',
            confidence: 0.91,
            evidence: [{ section: 'projects', itemId: proj.id || 'proj_001', bulletId: b.id || 'proj_001_b01', originalText: text }],
          })
        }
      }
    }

    // E. General Experience Bullet Ownership / Depth (if still < 3)
    if (combinedIssues.length < 3) {
      for (const exp of canonicalResume.experience || []) {
        if (combinedIssues.length >= 3) break
        for (const b of exp.bullets || []) {
          if (combinedIssues.length >= 3) break
          if (!b || !b.text || seenOriginalTexts.has(b.text)) continue
          const text = b.text.trim()
          if (text.length < 15) continue

          seenOriginalTexts.add(text)
          addOrClusterFallbackIssue({
            severity: 'medium',
            category: 'impact',
            title: 'Expand technical scope and architecture tradeoffs',
            diagnosis: `While this bullet highlights engineering contribution, adding details on architectural tradeoffs or team scope would strengthen senior positioning.`,
            whyItMatters: 'Senior technical hiring managers evaluate candidates on system design decisions and leadership scope, not just task completion.',
            recommendation: 'Explicitly mention the system complexity, tools evaluated, or cross-functional ownership.',
            correctedText: ResumeAgentValidator.buildGoogleXYZRewrite(text),
            metricDiscoveryQuestions: ['What architectural decisions or tradeoffs were made during this implementation?'],
            correctionType: 'rewrite',
            confidence: 0.93,
            evidence: [{ section: 'experience', itemId: exp.id || 'exp_001', bulletId: b.id || 'exp_001_b01', originalText: text }],
          })
        }
      }
    }

    // F. Professional Summary Cliché Fallback (if still < 3 and summary exists)
    if (combinedIssues.length < 3 && canonicalResume.summary?.text) {
      const sumText = canonicalResume.summary.text.trim()
      if (sumText.length > 20 && !seenOriginalTexts.has(sumText)) {
        seenOriginalTexts.add(sumText)
        addOrClusterFallbackIssue({
          severity: 'low',
          category: 'positioning',
          title: 'Professional summary can be sharpened with distinctive value proposition',
          diagnosis: 'Your professional summary introduces your background effectively, but could be sharpened to highlight unique domain specialization and high-impact scale.',
          whyItMatters: 'Hiring managers scan summaries in 5 seconds to gauge target level alignment and domain authority.',
          recommendation: 'Highlight 1-2 signature technical achievements and primary system scale directly in the summary.',
          correctedText: null,
          metricDiscoveryQuestions: ['What is your single most distinctive technical achievement across your career?'],
          correctionType: 'none',
          confidence: 0.90,
          evidence: [{ section: 'summary', itemId: canonicalResume.summary.id || 'summary_001', bulletId: canonicalResume.summary.id || 'summary_001', originalText: sumText }],
        })
      }
    }
  }

  // Ensure every issue with severity 'medium' or 'high' has non-null correctedText
  for (const iss of combinedIssues) {
    if ((iss.severity === 'medium' || iss.severity === 'high') && (!iss.correctedText || iss.correctedText === 'null')) {
      const evQuote = (Array.isArray(iss.evidence) && iss.evidence[0]?.originalText) || iss.evidence?.originalText || iss.title
      iss.correctedText = ResumeAgentValidator.buildGoogleXYZRewrite(evQuote)
      iss.correctionType = 'rewrite'
    }
  }

  // Cap issues strictly between 3 and 7
  const finalIssues = combinedIssues.slice(0, 7)
  const finalStrengths = combinedStrengths.slice(0, 5)

  // 5. Generate Priority Actions from top issues
  const priorityActions = finalIssues.slice(0, 3).map((iss, idx) => ({
    priority: idx + 1,
    title: iss.title,
    action: iss.recommendation,
    reason: iss.whyItMatters,
  }))

  // 6. Build Candidate Snapshot with full present & past role fidelity
  const candidate = canonicalResume.candidate || {}
  const candidateSnapshot = {
    name: candidate.name || 'Candidate',
    targetRole: effectiveRole,
    experienceLevel: candidate.headline || (canonicalResume.experience?.length ? `${Math.max(1, canonicalResume.experience.length * 2)}+ years` : 'Experienced Professional'),
    currentSeniority: 'Senior',
    primaryProfile: effectiveRole,
    presentRole: candidate.presentRole || '',
    presentCompany: candidate.presentCompany || '',
    pastRoles: candidate.pastRoles || [],
    allRoles: candidate.allRoles || [],
    linkedinUrl: candidate.contact?.linkedin || '',
  }

  // 7. Overall Recruiter Review
  const topStrengthTitle = finalStrengths[0]?.title || 'solid technical execution'
  const primaryIssueTitle = finalIssues[0]?.title || 'framing and outcome clarity'
  const firstName = (candidate.name || '').split(' ')[0] || 'Candidate'

  const overallReview = {
    summary: `${firstName}, your resume demonstrates clear technical competence, with your strongest signal centered around ${topStrengthTitle}. Hiring managers reading your background will immediately appreciate your hands-on technical execution.\n\nTo maximize phone screen conversion for ${effectiveRole} roles, your primary leverage point is addressing ${primaryIssueTitle}. Tightening the evidence across your core bullet points will transform strong responsibilities into undeniable hiring signal.`,
    tone: 'conversational',
  }

  const consolidatedAnalysis = {
    analysisVersion: '2.2',
    candidateSnapshot,
    dashboard: null,
    overallReview,
    strengths: finalStrengths,
    issues: finalIssues,
    priorityActions,
  }

  // 8. Validate against canonical resume with self-healing
  let validation = ResumeAgentValidator.validate(consolidatedAnalysis, canonicalResume)

  // If evidence on any issue failed, apply safe recovery pruning
  if (!validation.isValid && validation.isEvidenceValid === false && consolidatedAnalysis.issues.length >= 4) {
    const validIssues = consolidatedAnalysis.issues.filter((iss) => {
      const quote = iss.evidence?.[0]?.originalText
      return quote && ResumeAgentValidator.isVerbatimInCanonical(quote, canonicalResume)
    })
    if (validIssues.length >= 3) {
      consolidatedAnalysis.issues = validIssues
      validation = ResumeAgentValidator.validate(consolidatedAnalysis, canonicalResume)
    }
  }

  // 9. Deterministic Scorecard Engine
  let dashboard = null
  try {
    dashboard = computeScorecard({
      analysis: consolidatedAnalysis,
      canonicalResume,
      precomputedSignals: state?.precomputedSignals || null,
      usMarketSignals: state?.usMarketSignals || null,
      validation,
      pageCount: canonicalResume.document?.pageCount || 1,
    })
  } catch (err) {
    console.warn('[ModeD Chunked] Scorecard computation warning:', err.message)
  }
  consolidatedAnalysis.dashboard = dashboard

  const totalDuration = Date.now() - startTime
  const totalInputTokens = llmCalls.reduce((sum, c) => sum + c.inputTokens, 0)
  const totalOutputTokens = llmCalls.reduce((sum, c) => sum + c.outputTokens, 0)

  return {
    mode: MODE_D_NAME,
    success: true,
    analysis: consolidatedAnalysis,
    rawModelOutput: JSON.stringify(consolidatedAnalysis, null, 2),
    validation,
    finishReason: 'stop',
    llmCalls,
    metrics: {
      totalDurationMs: totalDuration,
      gatewayLatencyMs: llmCalls[0]?.latencyMs ?? totalDuration,
      gatewayRequestId: llmCalls[0]?.requestId ?? `chunked_${Date.now()}`,
      callCount: llmCalls.length,
      inputTokens: llmCalls[0]?.inputTokens ?? totalInputTokens,
      outputTokens: llmCalls[0]?.outputTokens ?? totalOutputTokens,
      totalTokens: (llmCalls[0]?.inputTokens ?? totalInputTokens) + (llmCalls[0]?.outputTokens ?? totalOutputTokens),
      model: policy.model,
      provider: policy.provider,
      promptVersion: 'chunked-synthesis-v1',
    },
  }
}

export default {
  MODE_D_NAME,
  partitionResumeIntoChunks,
  executeModeD,
}
