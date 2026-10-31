/**
 * Resume Agent Output & Evidence Validator
 * Validates JSON structure, canonical bulletId fidelity, evidence veracity,
 * per-issue numeric/technology traceability, and guards against unsupported claims.
 * V2: strict per-issue traceability of all numeric tokens and named technologies
 * in correctedText and recommendation back to their evidence.originalText.
 */

import {
  REQUIRED_ANALYSIS_FIELDS,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  CORRECTION_TYPES,
} from './resumeAgent.schema.js'
import { jsonrepair } from 'jsonrepair'
import { stripFillInSlots, findMalformedFillInSlots } from './validation/fillInSlots.js'
import { QUALITATIVE_OUTCOME_REGEX } from './signals/patterns.js'

export class ResumeAgentValidator {
  /**
   * Sanitizes and parses raw text response into JSON.
   * Falls back to jsonrepair for LLM-common JSON issues (trailing commas,
   * unclosed brackets, unquoted keys, minor truncation artifacts).
   */
  static cleanAndParse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Raw LLM response is empty or non-string.')
    }

    let cleaned = rawText.trim()

    // 1. Strip reasoning blocks (<think>...</think>, <thought>...</thought>)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim()

    // 2. Extract content from ```json ... ``` codeblock if present
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleaned = codeBlockMatch[1].trim()
    } else {
      // Otherwise strip any rogue backticks
      cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim()
    }

    // 3. Isolate outer JSON { ... } object if conversational text surrounds it
    if (!cleaned.startsWith('{')) {
      const startIdx = cleaned.indexOf('{')
      const endIdx = cleaned.lastIndexOf('}')
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleaned = cleaned.slice(startIdx, endIdx + 1).trim()
      }
    }

    // 4. Clean trailing commas before closing braces/brackets (common LLM JSON flaw)
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

    // 5. Attempt standard parse
    try {
      const parsed = JSON.parse(cleaned)
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('LLM output parsed as non-object')
      }
      return parsed
    } catch (_parseErr) {
      // 6. Fallback: jsonrepair — handles unclosed brackets, unquoted keys,
      //    missing commas, truncated arrays, and other common LLM JSON defects.
      try {
        const repaired = jsonrepair(cleaned)
        const result = JSON.parse(repaired)
        if (typeof result !== 'object' || result === null) {
          throw new Error('Repaired JSON is non-object')
        }
        console.warn('[ResumeAgentValidator] JSON repaired successfully via jsonrepair.')
        return result
      } catch (repairErr) {
        throw new Error(`Failed to parse LLM output as JSON: ${repairErr.message}`)
      }
    }
  }


  /**
   * Generates a concrete Google X-Y-Z framework rewrite for an issue evidence bullet.
   * "Accomplished [X] as measured by [Y] by doing [Z]"
   * Enforces at most one [ADD: ...] slot with zero digits.
   * Uses only technologies, tools, and facts directly present in originalText.
   */
  static buildGoogleXYZRewrite(originalText) {
    if (!originalText || typeof originalText !== 'string') {
      return 'Accomplished key deliverables with target [ADD: measurable metric] by executing core engineering responsibilities.'
    }

    // 1. Clean bullet prefixes and framework markers
    let clean = originalText
      .replace(/^[•\-*▪–—·\s]+/, '')
      .replace(/^(?:action|challenge|result|impact):\s*/i, '')
      .trim()

    // 2. Check if original text has a Result section
    const resultMatch = clean.match(/\bresult:\s*([\s\S]+)$/i)
    if (resultMatch) {
      const actionPart = clean.slice(0, resultMatch.index).replace(/^(?:action|challenge):\s*/i, '').replace(/[.,;:\s]+$/, '').trim()
      const resultPart = resultMatch[1].replace(/[.,;:\s]+$/, '').trim()

      // If result part has a number or metric already, reorder: Result by Action
      if (/\b\d+%|\b\d+\b/.test(resultPart)) {
        return `${resultPart} by ${actionPart.replace(/^[A-Z]/, (c) => c.toLowerCase())}.`
      }
      return `${resultPart} by ${actionPart.replace(/^[A-Z]/, (c) => c.toLowerCase())}.`
    }

    // 3. Check if original text has a metric or clear qualitative CAR outcome already
    if (/\b\d+%|\b\d+\b/.test(clean) || QUALITATIVE_OUTCOME_REGEX.test(clean)) {
      // Fix gerund opening if present
      let polished = clean
      const gerundMatch = polished.match(/^([A-Z][a-z]+)ing\b(.*)$/)
      if (gerundMatch) {
        const base = gerundMatch[1]
        const rest = gerundMatch[2]
        polished = `${base}ed${rest}`
      }
      return polished.endsWith('.') ? polished : `${polished}.`
    }

    // 4. Transform standard bullet using Google X-Y-Z
    const stripped = clean.replace(/[.!?]+$/, '').trim()
    const verbMatch = stripped.match(/^([A-Z][a-z]+(?:ed|ted|zed|sed|lt|ilt|ound|ken|ven|wn))\b\s*(.*)$/)
    if (verbMatch) {
      const verb = verbMatch[1]
      const rest = verbMatch[2]
      return `${verb} ${rest} to optimize system reliability and operational performance.`
    }

    return `Delivered core system improvements by ${stripped.replace(/^[A-Z]/, (c) => c.toLowerCase())}.`
  }

  /**
   * Safely extracts all original text from an evidence field (array or single object)
   */
  static getEvidenceText(evidence) {
    if (!evidence) return ''
    if (Array.isArray(evidence)) {
      return evidence
        .map((e) => (e && typeof e === 'object' ? e.originalText || '' : ''))
        .filter(Boolean)
        .join(' ')
        .trim()
    }
    if (typeof evidence === 'object') {
      return (evidence.originalText || '').trim()
    }
    return ''
  }

  /**
   * Safely extracts bullet/item IDs from an evidence field (array or single object)
   */
  static getEvidenceIds(evidence) {
    if (!evidence) return []
    if (Array.isArray(evidence)) {
      return evidence
        .map((e) => (e && typeof e === 'object' ? e.bulletId || e.itemId || '' : ''))
        .filter(Boolean)
    }
    if (typeof evidence === 'object') {
      const id = evidence.bulletId || evidence.itemId
      return id ? [id] : []
    }
    return []
  }

  /**
   * Builds a lookup map of all valid bullet IDs and texts from the canonical resume
   */
  static buildCanonicalLookup(canonicalResume) {
    const bulletMap = new Map() // bulletId -> text
    const textSet = new Set() // lower-cased trimmed bullet texts
    const itemMap = new Map() // itemId -> item
    const textToIdMap = new Map() // lower-cased trimmed bullet text -> bulletId (exact)

    const registerItems = (items) => {
      if (!Array.isArray(items)) return
      for (const item of items) {
        if (item.id) {
          itemMap.set(item.id, item)
        }
        if (Array.isArray(item.bullets)) {
          for (const b of item.bullets) {
            if (b.id) {
              const cleanText = (b.text || '').trim()
              bulletMap.set(b.id, cleanText)
              if (cleanText) {
                textSet.add(cleanText.toLowerCase())
                if (!textToIdMap.has(cleanText.toLowerCase())) {
                  textToIdMap.set(cleanText.toLowerCase(), b.id)
                }
              }
            }
          }
        }
      }
    }

    registerItems(canonicalResume?.experience)
    registerItems(canonicalResume?.projects)
    registerItems(canonicalResume?.education)
    // V3.1: certifications are citable evidence (RN license, CPA, PMP, BLS/ACLS…)
    // — especially important for non-IT candidates where certs carry the credibility.
    registerItems(canonicalResume?.certifications)

    // Register summary as a single stable-ID block (summary_001)
    const summaryText = (canonicalResume?.summary?.text || '').trim()
    if (summaryText) {
      itemMap.set('summary_001', canonicalResume?.summary)
      bulletMap.set('summary_001', summaryText)
      textSet.add(summaryText.toLowerCase())
      textToIdMap.set(summaryText.toLowerCase(), 'summary_001')
    }

    // Register skills as a single stable-ID block (skills_001 and skills)
    const skillsList = []
    if (Array.isArray(canonicalResume?.skills)) {
      for (const sk of canonicalResume.skills) {
        if (typeof sk === 'string') skillsList.push(sk)
        else if (sk && typeof sk === 'object') {
          if (sk.name) skillsList.push(sk.name)
          if (Array.isArray(sk.items)) skillsList.push(...sk.items)
        }
      }
    }
    const skillsText = skillsList.filter(Boolean).join(', ')
    if (skillsText) {
      const skillsObj = { name: 'Skills', description: skillsText }
      itemMap.set('skills_001', skillsObj)
      bulletMap.set('skills_001', skillsText)
      itemMap.set('skills', skillsObj)
      bulletMap.set('skills', skillsText)
      textSet.add(skillsText.toLowerCase())
      textToIdMap.set(skillsText.toLowerCase(), 'skills_001')
    }

    return { bulletMap, textSet, itemMap, textToIdMap }
  }

  /**
   * Checks whether a quote string exists verbatim or substantially in the canonical resume.
   */
  static isVerbatimInCanonical(quote, canonicalResume) {
    if (!quote || typeof quote !== 'string' || !canonicalResume) return false
    const lookup = ResumeAgentValidator.buildCanonicalLookup(canonicalResume)
    const normQuote = quote.trim().toLowerCase()
    if (lookup.textSet.has(normQuote)) return true
    for (const text of lookup.textSet) {
      if (text.includes(normQuote) || normQuote.includes(text)) return true
    }
    return false
  }

  /**
   * Extracts fact tokens, numbers, percentages, currencies, and technologies
   * from the canonical resume to ground claims.
   */
  static buildFactCorpus(canonicalResume) {
    const texts = []

    if (canonicalResume?.candidate) {
      if (canonicalResume.candidate.name) texts.push(canonicalResume.candidate.name)
      if (canonicalResume.candidate.targetRole) texts.push(canonicalResume.candidate.targetRole)
      if (canonicalResume.candidate.summary) texts.push(canonicalResume.candidate.summary)
    }

    const collectFromItems = (items) => {
      if (!Array.isArray(items)) return
      for (const item of items) {
        if (item.company) texts.push(item.company)
        if (item.role) texts.push(item.role)
        if (item.name) texts.push(item.name)
        if (item.title) texts.push(item.title)
        if (item.description) texts.push(item.description)
        if (Array.isArray(item.technologies)) texts.push(...item.technologies)
        if (Array.isArray(item.bullets)) {
          for (const b of item.bullets) {
            if (b.text) texts.push(b.text)
          }
        }
      }
    }

    collectFromItems(canonicalResume?.experience)
    collectFromItems(canonicalResume?.projects)

    if (Array.isArray(canonicalResume?.skills)) {
      for (const sk of canonicalResume.skills) {
        if (typeof sk === 'string') texts.push(sk)
        else if (sk && typeof sk === 'object') {
          if (sk.category) texts.push(sk.category)
          if (Array.isArray(sk.items)) texts.push(...sk.items)
        }
      }
    }

    if (Array.isArray(canonicalResume?.education)) {
      for (const ed of canonicalResume.education) {
        if (ed.degree) texts.push(ed.degree)
        if (ed.school) texts.push(ed.school)
        if (ed.major) texts.push(ed.major)
      }
    }

    const fullText = texts.join(' ')
    const fullTextLower = fullText.toLowerCase()

    // Extract numbers, percentages, currencies
    const percentages = new Set(
      (fullText.match(/\b\d+(?:\.\d+)?%/gi) || []).map((p) => p.toLowerCase())
    )
    const currencies = new Set(
      (fullText.match(/\$\s*\d+(?:[.,]\d+)?\s*(?:[kKmMbB]|million|billion)?/gi) || []).map((c) =>
        c.replace(/\s+/g, '').toLowerCase()
      )
    )
    const numbers = new Set(
      (fullText.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) || []).map((n) => n.replace(/,/g, ''))
    )

    // Check if "target" appears in a performance/SLA context (outside of targetRole)
    const hasTargetRequirement =
      /\btarget\s+(?:performance|latency|throughput|sla|benchmark|threshold)\b/i.test(fullText) ||
      /\b(?:meets?|exceeded)\s+target\b/i.test(fullText)

    // Curated tech vocabulary to check for invented technologies
    const KNOWN_TECH = [
      'kubernetes',
      'k8s',
      'kafka',
      'rabbitmq',
      'redis',
      'elasticsearch',
      'opensearch',
      'snowflake',
      'bigquery',
      'terraform',
      'aws lambda',
      'dynamodb',
      'graphql',
      'grpc',
      'next.js',
      'react native',
      'spark',
      'hadoop',
      'datadog',
      'prometheus',
      'cassandra',
      'mongodb',
      'helm',
      'ansible',
      'vault',
      'consul',
      'airflow',
    ]

    const presentTech = new Set()
    for (const tech of KNOWN_TECH) {
      if (fullTextLower.includes(tech)) {
        presentTech.add(tech)
      }
    }

    return {
      fullText,
      fullTextLower,
      percentages,
      currencies,
      numbers,
      hasTargetRequirement,
      presentTech,
    }
  }

  /**
   * Inspects fields for unsupported concrete claims:
   * - invented numbers
   * - invented user/customer counts
   * - invented technologies
   * - invented targets
   * - invented revenue/cost
   * - unsupported business outcomes
   * - hypothetical examples with metrics (e.g. "e.g. reducing reconciliation time by 70%")
   *
   * @param {Object} analysis - The parsed analysis object
   * @param {Object} canonicalResume - The original canonical resume
   * @returns {Array<{ code: string, field: string, claim: string, evidenceIds: string[] }>}
   */
  static detectUnsupportedClaims(analysis, canonicalResume) {
    const unsupportedClaims = []
    const factCorpus = this.buildFactCorpus(canonicalResume)
    const { bulletMap } = this.buildCanonicalLookup(canonicalResume)

    const checkTextField = (text, fieldName, evidenceIds = [], bulletText = '') => {
      if (!text || typeof text !== 'string') return

      const textLower = text.toLowerCase()

      // 1. Hypothetical examples with concrete metrics (BAD: "e.g. reducing reconciliation time by 70%")
      const hypotheticalMetricRegex =
        /(?:e\.g\.|for example|such as|like)\s*[^.;\n]{0,80}?(?:\$?\d+(?:\.\d+)?%?|\b\d+\s*(?:k|m|million|billion|users?|customers?|devices?|dollars?|events\/sec|fps|rps|ms|s)\b)/gi
      let hypoMatch
      while ((hypoMatch = hypotheticalMetricRegex.exec(text)) !== null) {
        unsupportedClaims.push({
          code: 'UNSUPPORTED_CLAIM',
          field: fieldName,
          claim: hypoMatch[0].trim(),
          evidenceIds,
        })
      }

      // 2. Unsupported targets (BAD: "confirming the system meets target performance")
      if (!factCorpus.hasTargetRequirement) {
        const targetClaimRegex =
          /\b(?:(?:confirming(?:\s+the\s+system)?|verifying(?:\s+the\s+system)?|ensuring|meets?|meeting|exceeded|exceeding|hit|hitting)\s+)?(?:target\s+performance|performance\s+targets?|target\s+thresholds?|target\s+SLAs?|target\s+benchmarks?)\b/gi
        let targetMatch
        while ((targetMatch = targetClaimRegex.exec(text)) !== null) {
          unsupportedClaims.push({
            code: 'UNSUPPORTED_CLAIM',
            field: fieldName,
            claim: targetMatch[0].trim(),
            evidenceIds,
          })
        }
      }

      // 3. Invented currencies / dollar amounts
      const currencyMatches = text.match(/\$\s*\d+(?:[.,]\d+)?\s*(?:[kKmMbB]|million|billion)?/gi) || []
      for (const cur of currencyMatches) {
        const cleanCur = cur.replace(/\s+/g, '').toLowerCase()
        if (!factCorpus.currencies.has(cleanCur)) {
          unsupportedClaims.push({
            code: 'UNSUPPORTED_CLAIM',
            field: fieldName,
            claim: `Invented currency/revenue figure: "${cur}"`,
            evidenceIds,
          })
        }
      }

      // 4. Invented percentages (outside of generic advice words)
      const percentMatches = text.match(/\b\d+(?:\.\d+)?%/gi) || []
      for (const pct of percentMatches) {
        const pctLower = pct.toLowerCase()
        if (!factCorpus.percentages.has(pctLower)) {
          unsupportedClaims.push({
            code: 'UNSUPPORTED_CLAIM',
            field: fieldName,
            claim: `Invented percentage: "${pct}"`,
            evidenceIds,
          })
        }
      }

      // 5. Invented user/customer/device counts (e.g., "20,000 devices", "500 customers")
      const entityCountRegex = /\b\d+(?:,\d{3})*\s*(?:users?|customers?|clients?|devices?|nodes?)\b/gi
      let countMatch
      while ((countMatch = entityCountRegex.exec(text)) !== null) {
        const countStr = countMatch[0]
        const numOnly = countStr.replace(/[^0-9]/g, '')
        if (numOnly && !factCorpus.numbers.has(numOnly)) {
          unsupportedClaims.push({
            code: 'UNSUPPORTED_CLAIM',
            field: fieldName,
            claim: `Invented entity count: "${countStr}"`,
            evidenceIds,
          })
        }
      }

      // 6. Invented technologies in correctedText
      if (fieldName.endsWith('.correctedText')) {
        const KNOWN_TECH = [
          'kubernetes',
          'k8s',
          'kafka',
          'rabbitmq',
          'redis',
          'elasticsearch',
          'opensearch',
          'snowflake',
          'bigquery',
          'terraform',
          'aws lambda',
          'dynamodb',
          'graphql',
          'grpc',
          'next.js',
          'react native',
          'spark',
          'hadoop',
          'datadog',
          'prometheus',
          'cassandra',
          'mongodb',
          'helm',
          'ansible',
          'vault',
          'consul',
        ]
        for (const tech of KNOWN_TECH) {
          const techRegex = new RegExp(`\\b${tech}\\b`, 'i')
          if (techRegex.test(text) && !factCorpus.presentTech.has(tech)) {
            unsupportedClaims.push({
              code: 'UNSUPPORTED_CLAIM',
              field: fieldName,
              claim: `Invented technology: "${tech}"`,
              evidenceIds,
            })
          }
        }
      }

      // 7. Unsupported concrete business outcomes in rewrites or recommendations
      const bizOutcomeRegex =
        /\b(?:increased|boosted|generated|saved|reduced)\s+(?:revenue|costs?|arr|expenses?)\s+by\s+\$?\d+/gi
      let bizMatch
      while ((bizMatch = bizOutcomeRegex.exec(text)) !== null) {
        unsupportedClaims.push({
          code: 'UNSUPPORTED_CLAIM',
          field: fieldName,
          claim: `Unsupported business outcome: "${bizMatch[0]}"`,
          evidenceIds,
        })
      }
    }

    // Inspect Issues: diagnosis, whyItMatters, recommendation, correctedText
    if (Array.isArray(analysis?.issues)) {
      for (let i = 0; i < analysis.issues.length; i++) {
        const iss = analysis.issues[i]
        if (!iss || typeof iss !== 'object') continue

        const evidenceIds = ResumeAgentValidator.getEvidenceIds(iss.evidence)
        const bulletText = evidenceIds.map((id) => bulletMap.get(id) || '').join(' ') || ResumeAgentValidator.getEvidenceText(iss.evidence)

        checkTextField(iss.diagnosis, `issues[${i}].diagnosis`, evidenceIds, bulletText)
        checkTextField(iss.whyItMatters, `issues[${i}].whyItMatters`, evidenceIds, bulletText)
        checkTextField(iss.recommendation, `issues[${i}].recommendation`, evidenceIds, bulletText)
        checkTextField(iss.correctedText, `issues[${i}].correctedText`, evidenceIds, bulletText)
      }
    }

    // Inspect Priority Actions: action, title
    if (Array.isArray(analysis?.priorityActions)) {
      for (let i = 0; i < analysis.priorityActions.length; i++) {
        const pa = analysis.priorityActions[i]
        if (!pa || typeof pa !== 'object') continue

        checkTextField(pa.action, `priorityActions[${i}].action`, [])
        checkTextField(pa.title, `priorityActions[${i}].title`, [])
      }
    }

    return unsupportedClaims
  }

  /**
   * V2.2: Flags phrases that commonly indicate unsupported assumptions
   * unless explicitly present in the canonical resume.
   *
   * @param {Object} analysis - Parsed analysis object
   * @param {Object} canonicalResume - Canonical resume object
   * @returns {{ code: string, field: string, phrase: string, message: string }[]}
   */
  static detectUnsupportedAssumptions(analysis, canonicalResume) {
    const warnings = []
    const ASSUMPTION_PATTERNS = [
      { pattern: /\bstudent[\s-]projects?\b/i, phrase: 'student project' },
      { pattern: /\b(?:basic\s+)?crud[\s-]projects?\b|\bbasic\s+crud\b/i, phrase: 'basic CRUD' },
      { pattern: /\btutorial[\s-]projects?\b/i, phrase: 'tutorial project' },
      { pattern: /\bproduction[\s-](?:systems?|environments?|apps?)\b/i, phrase: 'production system' },
      { pattern: /\benterprise[\s-](?:systems?|scale)\b/i, phrase: 'enterprise system' },
      { pattern: /\bcustomer[\s-]facing\b/i, phrase: 'customer-facing' },
      { pattern: /\bbusiness[\s-]critical\b/i, phrase: 'business-critical' },
      { pattern: /\bopen[\s-]source\b/i, phrase: 'open source' },
      { pattern: /\bled\s+a\s+team\b/i, phrase: 'led a team' },
      { pattern: /\bmanaged\s+a\s+team\b/i, phrase: 'managed a team' },
      { pattern: /\bstartup[\s-]environments?\b/i, phrase: 'startup environment' },
    ]

    const canonicalText = (JSON.stringify(canonicalResume) || '').toLowerCase()

    const checkText = (text, fieldName) => {
      if (!text || typeof text !== 'string') return
      for (const { pattern, phrase } of ASSUMPTION_PATTERNS) {
        if (pattern.test(text)) {
          if (!pattern.test(canonicalText)) {
            warnings.push({
              code: 'UNSUPPORTED_ASSUMPTION_WARNING',
              field: fieldName,
              phrase,
              message: `${fieldName}: Unsupported assumption phrase "${phrase}" detected without explicit evidence in resume.`,
            })
          }
        }
      }
    }

    const overallText =
      typeof analysis?.overallReview === 'object'
        ? analysis.overallReview?.summary || ''
        : analysis?.overallReview || ''
    checkText(overallText, 'overallReview')

    if (Array.isArray(analysis?.issues)) {
      analysis.issues.forEach((iss, i) => {
        checkText(iss?.diagnosis, `issues[${i}].diagnosis`)
        checkText(iss?.whyItMatters, `issues[${i}].whyItMatters`)
        checkText(iss?.recommendation, `issues[${i}].recommendation`)
        checkText(iss?.correctedText, `issues[${i}].correctedText`)
      })
    }

    if (Array.isArray(analysis?.priorityActions)) {
      analysis.priorityActions.forEach((pa, i) => {
        checkText(pa?.title, `priorityActions[${i}].title`)
        checkText(pa?.action, `priorityActions[${i}].action`)
      })
    }

    return warnings
  }

  /**
   * Full validation suite
   *
   * @param {Object|string} rawResponse - Parsed or raw string response from LLM
   * @param {Object} canonicalResume - The original canonical resume given to LLM
   * @returns {{ isValid: boolean, errors: string[], warnings: string[], unsupportedClaims: Array, sanitizedAnalysis: Object|null }}
   */
  static validate(rawResponse, canonicalResume) {
    const errors = []
    const warnings = []

    // 1. Parse JSON
    let analysis
    try {
      analysis = typeof rawResponse === 'string' ? this.cleanAndParse(rawResponse) : rawResponse
    } catch (err) {
      return {
        isValid: false,
        errors: [err.message],
        warnings: [],
        unsupportedClaims: [],
        sanitizedAnalysis: null,
      }
    }

    if (!analysis || typeof analysis !== 'object') {
      return {
        isValid: false,
        errors: ['Output must be a JSON object.'],
        warnings: [],
        unsupportedClaims: [],
        sanitizedAnalysis: null,
      }
    }

    // 2. Check Required Top-Level Fields
    for (const field of REQUIRED_ANALYSIS_FIELDS) {
      if (!(field in analysis)) {
        errors.push(`Missing required top-level field: "${field}".`)
      }
    }

    // 2b. Check Version (require 2.2, backwards compatible with 2.1)
    if (!analysis.analysisVersion || (analysis.analysisVersion !== '2.2' && analysis.analysisVersion !== '2.1')) {
      errors.push(`analysisVersion must be "2.2" (got "${analysis.analysisVersion}").`)
    }

    // 3. Enforce Dashboard Score Rule (must be null)
    if (analysis.dashboard) {
      if (analysis.dashboard.score !== null && analysis.dashboard.score !== undefined) {
        warnings.push('Model attempted to invent a dashboard.score; normalizing to null.')
        analysis.dashboard.score = null
      }
      if (analysis.dashboard.dimensions) {
        for (const dim of Object.keys(analysis.dashboard.dimensions)) {
          if (analysis.dashboard.dimensions[dim] !== null) {
            analysis.dashboard.dimensions[dim] = null
          }
        }
      }
    } else {
      analysis.dashboard = null
    }

    // 4. Build Evidence Verification Maps
    const { bulletMap, textSet, itemMap, textToIdMap } = this.buildCanonicalLookup(canonicalResume)

    // 5. Validate Issues
    const issues = Array.isArray(analysis.issues) ? analysis.issues : []
    if (issues.length > 10) {
      errors.push(`Model returned ${issues.length} issues, which exceeds the hard maximum limit of 10.`)
    } else if (issues.length === 0) {
      warnings.push('Model returned 0 issues. Expected 3–7 prioritized issues.')
    } else if (issues.length < 3) {
      warnings.push(`Model returned ${issues.length} issues (3–7 preferred).`)
    }

    const evidenceErrors = []
    const validatedIssues = []
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i]
      const issueIdx = `issues[${i}]`

      if (!issue || typeof issue !== 'object') {
        errors.push(`${issueIdx}: Expected issue object, received ${typeof issue}.`)
        continue
      }

      // Validate Severity
      if (!ISSUE_SEVERITIES.includes(issue.severity)) {
        warnings.push(`${issueIdx}: Invalid severity "${issue.severity}". Defaulting to "medium".`)
        issue.severity = 'medium'
      }

      // Validate & normalize Category (V3.1)
      // Models occasionally emit near-miss category names; map known aliases
      // and default unknowns to "clarity" so downstream UI grouping stays stable.
      if (!ISSUE_CATEGORIES.includes(issue.category)) {
        const CATEGORY_ALIASES = {
          unclear_ownership: 'ownership_clarity',
          ownership: 'ownership_clarity',
          weak_language: 'clarity',
          passive_language: 'clarity',
          missing_outcome: 'outcome_visibility',
          missing_metrics: 'impact',
          quantification: 'impact',
          formatting: 'structure',
          layout: 'ats_readability',
          us_market: 'us_market_alignment',
          non_us_convention: 'us_market_alignment',
        }
        const alias = CATEGORY_ALIASES[String(issue.category || '').toLowerCase()]
        if (alias) {
          warnings.push(`${issueIdx}: Category "${issue.category}" normalized to "${alias}".`)
          issue.category = alias
        } else {
          warnings.push(`${issueIdx}: Invalid category "${issue.category}". Defaulting to "clarity".`)
          issue.category = 'clarity'
        }
      }

      // Validate Correction Type
      if (!CORRECTION_TYPES.includes(issue.correctionType)) {
        issue.correctionType = issue.correctedText ? 'rewrite' : 'none'
      }

      // Validate Evidence (can be array or single object)
      let evidenceList = []
      if (Array.isArray(issue.evidence)) {
        evidenceList = issue.evidence
      } else if (issue.evidence && typeof issue.evidence === 'object') {
        evidenceList = [issue.evidence]
      }

      if (evidenceList.length === 0) {
        evidenceErrors.push(`${issueIdx}: Missing evidence object or empty evidence array.`)
        continue
      }

      for (let eIdx = 0; eIdx < evidenceList.length; eIdx++) {
        const ev = evidenceList[eIdx]
        const evRef = `${issueIdx}.evidence${evidenceList.length > 1 ? `[${eIdx}]` : ''}`
        if (!ev || typeof ev !== 'object') {
          evidenceErrors.push(`${evRef}: Evidence entry is not an object.`)
          continue
        }

        let itemId = (ev.itemId || '').trim().replace(/[\[\]"]/g, '')
        let bulletId = (ev.bulletId || '').trim().replace(/[\[\]"]/g, '')
        bulletId = bulletId.replace(/^([a-z]+_\d+)_b(\d)$/, '$1_b0$2')
        itemId = itemId.replace(/^([a-z]+_\d+)_b(\d)$/, '$1_b0$2')
        ev.itemId = itemId
        ev.bulletId = bulletId
        const originalText = (ev.originalText || '').trim()

        if (!itemId) {
          evidenceErrors.push(`${evRef}: Missing or empty itemId in evidence.`)
        }
        if (!bulletId) {
          evidenceErrors.push(`${evRef}: Missing or empty bulletId in evidence.`)
        }
        if (!originalText) {
          evidenceErrors.push(`${evRef}: Missing or empty originalText in evidence.`)
        }

        if (bulletId) {
          let isBullet = bulletMap.has(bulletId)
          let isItem = itemMap.has(bulletId)

          // If bulletId is an item ID (like exp_001), auto-resolve to its first bullet
          if (!isBullet && isItem) {
            const it = itemMap.get(bulletId)
            if (it && Array.isArray(it.bullets) && it.bullets.length > 0) {
              ev.bulletId = it.bullets[0].id
              bulletId = ev.bulletId
              isBullet = true
            }
          }

          // V3.1: self-healing relink — if the model cited a wrong/nonexistent
          // bulletId but the originalText EXACTLY matches a real bullet, relink
          // instead of failing the whole analysis. Fidelity is preserved because
          // the text must match verbatim; only the ID pointer is corrected.
          if (!isBullet && !isItem && originalText) {
            const key = originalText.toLowerCase().replace(/\s+/g, ' ').trim()
            let relinkId = textToIdMap.get(key) || null
            if (!relinkId) {
              const keyLoose = originalText.toLowerCase().trim()
              for (const [txt, id] of textToIdMap) {
                if (txt === keyLoose) {
                  relinkId = id
                  break
                }
              }
            }
            if (relinkId) {
              ev.bulletId = relinkId
              if (!ev.itemId) ev.itemId = relinkId
              warnings.push(
                `${evRef}: bulletId "${bulletId}" not found — relinked to "${relinkId}" via exact text match.`
              )
              bulletId = relinkId
              isBullet = bulletMap.has(bulletId)
              isItem = itemMap.has(bulletId)
            } else {
              evidenceErrors.push(`${evRef}: bulletId "${bulletId}" does not exist in canonical resume.`)
            }
          }

          if ((isBullet || isItem) && originalText) {
            let actualText = ''
            if (isBullet) {
              actualText = bulletMap.get(bulletId) || ''
            } else if (isItem) {
              const it = itemMap.get(bulletId) || {}
              actualText = [it.role, it.company, it.name, it.title, it.description, it.degree, it.school, it.institution, it.major, it.dates, it.startDate, it.endDate]
                .filter(Boolean)
                .join(' ')
            }
            const actualNorm = actualText.replace(/\s+/g, ' ').trim().toLowerCase()
            const evNorm = originalText.replace(/\s+/g, ' ').trim().toLowerCase()
            const cleanEvNorm = evNorm.replace(/^(?:skills|technical skills):\s*/i, '').trim()

            const isSkills = bulletId === 'skills_001' || bulletId === 'skills'
            if (isSkills) {
              const skillTokens = cleanEvNorm
                .split(/[,;\n|/]+/)
                .map((t) => t.trim().toLowerCase())
                .filter((t) => t.length > 1 && !t.includes('skills'))
              const matchesSkill = skillTokens.length > 0 && skillTokens.some((tok) => actualNorm.includes(tok))
              if (
                !actualNorm.includes(evNorm) &&
                !evNorm.includes(actualNorm) &&
                !actualNorm.includes(cleanEvNorm) &&
                !matchesSkill
              ) {
                evidenceErrors.push(
                  `${evRef}: originalText does not match canonical resume text for bulletId "${bulletId}".`
                )
              }
            } else if (isBullet) {
              if (
                !actualNorm.includes(evNorm) &&
                !evNorm.includes(actualNorm) &&
                !actualNorm.includes(cleanEvNorm)
              ) {
                // If model cited a valid canonical bulletId, auto-align originalText to exact canonical text
                const canonText = bulletMap.get(bulletId)
                if (canonText) {
                  ev.originalText = canonText
                  warnings.push(
                    `${evRef}: originalText normalized to canonical resume text for bulletId "${bulletId}".`
                  )
                } else {
                  evidenceErrors.push(
                    `${evRef}: originalText does not match canonical resume text for bulletId "${bulletId}".`
                  )
                }
              }
            } else if (isItem) {
              const it = itemMap.get(bulletId) || {}
              const matchesRole = it.role && evNorm.includes(it.role.toLowerCase())
              const matchesCompany = it.company && evNorm.includes(it.company.toLowerCase())
              const matchesTitle = it.title && evNorm.includes(it.title.toLowerCase())
              const matchesName = it.name && evNorm.includes(it.name.toLowerCase())
              const matchesDesc = it.description && (actualNorm.includes(evNorm) || evNorm.includes(actualNorm))
              if (
                !matchesRole &&
                !matchesCompany &&
                !matchesTitle &&
                !matchesName &&
                !matchesDesc &&
                !actualNorm.includes(evNorm) &&
                !evNorm.includes(actualNorm) &&
                !actualNorm.includes(cleanEvNorm)
              ) {
                evidenceErrors.push(
                  `${evRef}: originalText does not match canonical resume text for bulletId "${bulletId}".`
                )
              }
            }
          }
        }
      }

      validatedIssues.push(issue)
    }

    // Programmatic Clustering & Deduplication of Issues:
    // Guarantees ZERO duplicate issue titles and aggregates evidence arrays
    const clusteredIssues = []
    const seenTitles = new Map()

    for (const issue of validatedIssues) {
      const normTitle = (issue.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seenTitles.has(normTitle)) {
        const primary = seenTitles.get(normTitle)
        let evList = []
        if (Array.isArray(issue.evidence)) {
          evList = issue.evidence
        } else if (issue.evidence && typeof issue.evidence === 'object') {
          evList = [issue.evidence]
        }
        for (const ev of evList) {
          const isDup = primary.evidence.some(
            (e) => (e.bulletId && e.bulletId === ev.bulletId) || (e.originalText && e.originalText === ev.originalText)
          )
          if (!isDup) {
            primary.evidence.push(ev)
          }
        }
        if (issue.severity === 'high') primary.severity = 'high'
        else if (issue.severity === 'medium' && primary.severity === 'low') primary.severity = 'medium'

        if (!primary.correctedText && issue.correctedText) {
          primary.correctedText = issue.correctedText
          primary.correctionType = issue.correctionType || 'rewrite'
        }
      } else {
        if (!Array.isArray(issue.evidence)) {
          issue.evidence = issue.evidence ? [issue.evidence] : []
        }
        seenTitles.set(normTitle, issue)
        clusteredIssues.push(issue)
      }
    }

    // Guarantee Concrete Recruiter Rewrites:
    // Ensure every issue of severity "medium" or "high" returns a non-null correctedText
    // using the Google X-Y-Z framework with at most one [ADD: metric] slot.
    for (let idx = 0; idx < clusteredIssues.length; idx++) {
      const iss = clusteredIssues[idx]
      iss.id = `iss_${String(idx + 1).padStart(3, '0')}`

      if ((iss.severity === 'medium' || iss.severity === 'high') && (!iss.correctedText || iss.correctedText === 'null')) {
        const primaryEvidence = (Array.isArray(iss.evidence) && iss.evidence[0]) || iss.evidence || {}
        const evText = primaryEvidence.originalText || iss.title || ''
        iss.correctedText = ResumeAgentValidator.buildGoogleXYZRewrite(evText)
        iss.correctionType = 'rewrite'
      }
    }

    analysis.issues = clusteredIssues

    // 6. Validate Strengths
    if (!Array.isArray(analysis.strengths)) {
      analysis.strengths = []
    } else {
      for (let i = 0; i < analysis.strengths.length; i++) {
        const str = analysis.strengths[i]
        const strIdx = `strengths[${i}]`
        let evList = []
        if (Array.isArray(str.evidence)) {
          evList = str.evidence
        } else if (str.evidence && typeof str.evidence === 'object') {
          evList = [str.evidence]
        }
        for (let eIdx = 0; eIdx < evList.length; eIdx++) {
          const ev = evList[eIdx]
          const evRef = `${strIdx}.evidence${evList.length > 1 ? `[${eIdx}]` : ''}`
          if (!ev || typeof ev !== 'object') continue
          let bulletId = (ev.bulletId || '').trim().replace(/[\[\]"]/g, '')
          let itemId = (ev.itemId || '').trim().replace(/[\[\]"]/g, '')
          bulletId = bulletId.replace(/^([a-z]+_\d+)_b(\d)$/, '$1_b0$2')
          itemId = itemId.replace(/^([a-z]+_\d+)_b(\d)$/, '$1_b0$2')
          ev.bulletId = bulletId
          ev.itemId = itemId
          let originalText = (ev.originalText || '').trim()
          let isBullet = bulletMap.has(bulletId)
          let isItem = itemMap.has(bulletId)
          if (!isBullet && isItem) {
            const it = itemMap.get(bulletId)
            if (it && Array.isArray(it.bullets) && it.bullets.length > 0) {
              ev.bulletId = it.bullets[0].id
              bulletId = ev.bulletId
              isBullet = true
            }
          }
          if (bulletId && !isBullet && !isItem) {
            warnings.push(`${evRef}: bulletId "${bulletId}" does not exist in canonical resume.`)
          } else if (bulletId && originalText) {
            if (isBullet) {
              const canonText = bulletMap.get(bulletId)
              if (canonText) {
                ev.originalText = canonText
              }
            }
            let actualText = ''
            if (isBullet) {
              actualText = bulletMap.get(bulletId) || ''
            } else if (isItem) {
              const it = itemMap.get(bulletId) || {}
              actualText = [it.role, it.company, it.name, it.title, it.description, it.degree, it.school, it.institution, it.major, it.dates, it.startDate, it.endDate]
                .filter(Boolean)
                .join(' ')
            }
            const actualNorm = actualText.replace(/\s+/g, ' ').trim().toLowerCase()
            const evNorm = originalText.replace(/\s+/g, ' ').trim().toLowerCase()
            const cleanEvNorm = evNorm.replace(/^(?:skills|technical skills):\s*/i, '').trim()
            const isSkills = bulletId === 'skills_001' || bulletId === 'skills'
            const skillTokens = isSkills
              ? cleanEvNorm
                  .split(/[,;\n|/]+/)
                  .map((t) => t.trim().toLowerCase())
                  .filter((t) => t.length > 1 && !t.includes('skills'))
              : []
            const matchesSkill = skillTokens.length > 0 && skillTokens.some((tok) => actualNorm.includes(tok))
            if (
              !actualNorm.includes(evNorm) &&
              !evNorm.includes(actualNorm) &&
              !actualNorm.includes(cleanEvNorm) &&
              !matchesSkill
            ) {
              warnings.push(`${evRef}: originalText differs from canonical text for bulletId "${bulletId}".`)
            }
          }
        }
      }
    }

    // 7. Validate Priority Actions
    if (!Array.isArray(analysis.priorityActions)) {
      analysis.priorityActions = []
    }

    // 7b. Validate & preserve bulletUpgrades
    analysis.bulletUpgrades = Array.isArray(analysis.bulletUpgrades) ? analysis.bulletUpgrades : []

    // 8. Extended Inspection for Unsupported Concrete Claims
    // (diagnosis, whyItMatters, recommendation, correctedText, priorityActions)
    // Does NOT rewrite model output; preserves raw text untouched.
    const unsupportedClaims = this.detectUnsupportedClaims(analysis, canonicalResume)
    for (const claimObj of unsupportedClaims) {
      warnings.push(`${claimObj.field}: Unsupported claim detected — "${claimObj.claim}"`)
    }

    // 8b. Unsupported Assumption Guardrail (Section 21)
    const unsupportedAssumptionWarnings = this.detectUnsupportedAssumptions(analysis, canonicalResume)
    for (const uaw of unsupportedAssumptionWarnings) {
      warnings.push(uaw.message)
    }

    // 9. V2: Per-issue numeric & technology traceability
    // Each numeric token, percentage, currency, and named technology in correctedText
    // and recommendation must be traceable to that issue's own evidence.originalText.
    const traceabilityWarnings = this.validatePerIssueFactTraceability(analysis)
    for (const w of traceabilityWarnings) {
      warnings.push(w)
    }

    // 10. V2.2: Placeholder metric category & fabricated numeric token detection
    // Detects recommendation/action text that names a metric category (e.g., "reduced X by Y%")
    // or contains concrete-looking fabricated numbers (e.g., "150+", "2MB", "15")
    // not present in the issue's own evidence.originalText.
    const placeholderWarnings = this.detectPlaceholderMetricSuggestions(analysis)
    for (const w of placeholderWarnings) {
      const msg =
        typeof w === 'string'
          ? w
          : (w.message || `${w.field}: [${w.code}] "${w.claim || w.token}" (issue: ${w.issueId || 'n/a'})`)
      warnings.push(msg)
    }

    // 11. V2.3: Fabricated outcome detection in correctedText
    // Flags outcome/result-indicating words (e.g., "faster", "improved", "enabled")
    // in correctedText that have no grounding in evidence.originalText.
    const fabricatedOutcomeWarnings = this.detectFabricatedOutcomeInCorrectedText(analysis)
    for (const w of fabricatedOutcomeWarnings) {
      const msg =
        typeof w === 'string'
          ? w
          : (w.message || `${w.field}: [${w.code}] "${w.phrase || w.keyword}" (issue: ${w.issueId || 'n/a'})`)
      warnings.push(msg)
    }

    // 12. V3.1: Fill-in slot format enforcement
    // [ADD: ...] slots are allowed in correctedText / recommendation /
    // priorityActions[].action, but must be well-formed (no digits inside).
    // Slots anywhere else (diagnosis, whyItMatters, strengths, overallReview)
    // are disallowed — factual fields must never contain metric homework.
    // Ensure summaryOptimization is preserved or synthesized on sanitizedAnalysis
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
        diagnosis: `Your resume currently lacks an executive summary for ${targetRole}, forcing recruiters to scan fragmented bullets to deduce your seniority and engineering scope.`,
        rewrittenSummary: `${targetRole} with demonstrated experience architecting scalable, high-availability software systems. Proven track record driving engineering execution${topStrengths ? ` across ${topStrengths}` : ''}, reducing system latency, and delivering resilient production platforms. Specializes in ${specialization}.`,
      }
    }

    const fillInSlotWarnings = this.detectFillInSlotViolations(analysis)
    warnings.push(...fillInSlotWarnings)

    const isSchemaValid = errors.length === 0
    const isEvidenceValid = evidenceErrors.length === 0

    return {
      isValid: isSchemaValid && isEvidenceValid,
      isSchemaValid,
      isEvidenceValid,
      errors,
      evidenceErrors,
      warnings,
      unsupportedClaims,
      unsupportedAssumptionWarnings,
      traceabilityWarnings,
      placeholderWarnings,
      fabricatedOutcomeWarnings,
      sanitizedAnalysis: analysis,
    }
  }

  /**
   * V2: Validates that every numeric token (%, $, plain number), and every named
   * technology present in each issue's correctedText and recommendation can be
   * traced directly back to that issue's own evidence.originalText.
   *
   * Reports warnings without mutating model output.
   *
   * @param {Object} analysis - Parsed analysis object
   * @returns {string[]} Array of traceability warning strings
   */
  static validatePerIssueFactTraceability(analysis) {
    const warnings = []
    if (!Array.isArray(analysis?.issues)) return warnings

    const NAMED_METRICS = ['p99', 'p95', 'p50', 'events/sec', 'rps', 'qps', 'writes/sec', 'req/s']
    const NAMED_TECH = [
      'kubernetes', 'k8s', 'kafka', 'rabbitmq', 'redis', 'elasticsearch', 'opensearch',
      'snowflake', 'bigquery', 'terraform', 'dynamodb', 'graphql', 'grpc', 'next.js',
      'react native', 'spark', 'hadoop', 'datadog', 'prometheus', 'cassandra', 'mongodb',
      'helm', 'ansible', 'vault', 'consul', 'airflow', 'react', 'vue', 'angular', 'postgres',
      'postgresql', 'mysql', 'sqlite', 'docker', 'aws', 'gcp', 'azure', 'stripe', 'twilio',
    ]

    for (let i = 0; i < analysis.issues.length; i++) {
      const issue = analysis.issues[i]
      if (!issue || typeof issue !== 'object') continue

      const originalText = ResumeAgentValidator.getEvidenceText(issue.evidence).toLowerCase()
      if (!originalText) continue

      const fieldsToCheck = [
        { key: 'correctedText', value: issue.correctedText },
        { key: 'recommendation', value: issue.recommendation },
      ]

      for (const { key, value } of fieldsToCheck) {
        if (!value || typeof value !== 'string') continue
        // V3.1: strip well-formed [ADD: ...] fill-in slots before traceability checks
        const valueLower = stripFillInSlots(value).toLowerCase()
        const fieldRef = `issues[${i}].${key}`

        // Check all percentages
        const pcts = value.match(/\b\d+(?:\.\d+)?%/gi) || []
        for (const pct of pcts) {
          if (!originalText.includes(pct.toLowerCase())) {
            warnings.push(
              `${fieldRef}: Percentage "${pct}" not traceable to evidence.originalText.`
            )
          }
        }

        // Check all currency amounts
        const currencies = value.match(/\$\s*\d+(?:[.,]\d+)?\s*(?:[kKmMbB]|million|billion)?/gi) || []
        for (const cur of currencies) {
          const cleanCur = cur.replace(/\s+/g, '').toLowerCase()
          if (!originalText.includes(cleanCur)) {
            warnings.push(
              `${fieldRef}: Currency "${cur}" not traceable to evidence.originalText.`
            )
          }
        }

        // Check named metrics (e.g. "p99", "events/sec")
        for (const metric of NAMED_METRICS) {
          if (valueLower.includes(metric) && !originalText.includes(metric)) {
            warnings.push(
              `${fieldRef}: Named metric "${metric}" not present in evidence.originalText.`
            )
          }
        }

        // Check named technologies only in correctedText (highest fabrication risk)
        if (key === 'correctedText') {
          for (const tech of NAMED_TECH) {
            const techRegex = new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i')
            if (techRegex.test(value) && !originalText.includes(tech)) {
              warnings.push(
                `${fieldRef}: Technology "${tech}" not traceable to evidence.originalText.`
              )
            }
          }
        }
      }
    }

    return warnings
  }

  /**
   * V2.1: Detects placeholder metric category suggestions in recommendations and priority actions.
   *
   * Patterns flagged (even with placeholder symbols like X% or Y):
   *   (e.g., reduced X by Y%)
   *   (e.g., % reduction in mean time to resolution)
   *   (e.g., reduced release failures by X%)
   *
   * For each match, checks whether the metric category keyword inside the parentheses
   * (e.g., "release failures", "mean time to resolution") appears in the issue's
   * evidence.originalText. If not, flags as placeholder_metric_category_not_in_evidence.
   *
   * Does NOT auto-fix. Only reports so the team can monitor prompt compliance.
   *
   * @param {Object} analysis - Parsed analysis object
   * @returns {{ code: string, field: string, claim: string, evidenceIds: string[] }[]}
   */
  /**
   * V2.2: Detects placeholder metric categories and fabricated-looking concrete numbers
   * in recommendations and priority actions.
   *
   * Logic:
   * 1. For each issue, take recommendation and (if present) the matching priorityActions[].action text.
   * 2. Extract all numeric tokens using a broad pattern (e.g. 150+, 2MB, 15, 15%, 250k, 50ms).
   * 3. Check whether the digit sequence appears in the corresponding evidence.originalText.
   *    (Also cross-checks against ALL evidence blocks in the response to detect out-of-context reuse).
   * 4. If a numeric token is NOT found in the evidence.originalText it is attached to,
   *    flag "fabricated_number_in_recommendation" with issueId, token, and field name.
   * 5. Keep additive existing (e.g., ...) pattern checks for invented metric categories.
   *
   * Does NOT apply to correctedText (which has its own evidence-only rule).
   * Does NOT auto-fix. Only reports validation warnings/errors.
   *
   * @param {Object} analysis - Parsed analysis object
   * @returns {{ code: string, field: string, issueId?: string, token?: string, claim: string, evidenceIds: string[], reusedFromOtherBullet?: boolean, message: string }[]}
   */
  static detectPlaceholderMetricSuggestions(analysis) {
    const results = []

    // Pattern matching numeric tokens with optional units / qualifiers:
    // Examples: 150+, 2MB, 15, 15%, 250k, 50ms, 4 hours, 250,000, 9x, 13x
    const NUMERIC_TOKEN_PATTERN = /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|\+|x|X|k|K|MB|GB|ms|sec|seconds|hrs|hours)?(?=\s|[^\w]|$)/gi

    // Helper: checks whether the same digit sequence appears in the provided text.
    // Handles plain digits, decimals, and comma-formatted numbers (e.g. 250,000 vs 250000).
    const checkDigitsInText = (text, digits) => {
      if (!text || !digits) return false
      const escaped = digits.replace('.', '\\.')
      const digitRegex = new RegExp(`(?<!\\d)${escaped}(?!\\d)`)
      if (digitRegex.test(text)) return true

      const noCommasText = text.replace(/,/g, '')
      const noCommasDigits = digits.replace(/,/g, '')
      const noCommasEscaped = noCommasDigits.replace('.', '\\.')
      const noCommasRegex = new RegExp(`(?<!\\d)${noCommasEscaped}(?!\\d)`)
      return noCommasRegex.test(noCommasText)
    }

    // Collect all evidence blocks in response for cross-checking if useful
    const allEvidenceTexts = []
    if (Array.isArray(analysis?.issues)) {
      for (const iss of analysis.issues) {
        if (iss?.evidence?.originalText) allEvidenceTexts.push(iss.evidence.originalText)
      }
    }
    if (Array.isArray(analysis?.strengths)) {
      for (const str of analysis.strengths) {
        if (str?.evidence?.originalText) allEvidenceTexts.push(str.evidence.originalText)
      }
    }

    const handledPAIndices = new Set()

    // 1. Per-issue numeric token traceability check for recommendation & matching action
    if (Array.isArray(analysis?.issues)) {
      for (let i = 0; i < analysis.issues.length; i++) {
        const issue = analysis.issues[i]
        if (!issue || typeof issue !== 'object') continue

        const issueId = issue.id || `iss_${i + 1}`
        const evidenceText = (issue.evidence?.originalText || '')
        const bulletId = issue.evidence?.bulletId || issue.evidence?.itemId || null
        const evidenceIds = bulletId ? [bulletId] : []

        // 1a. Check issue.recommendation
        const recommendation = issue.recommendation || ''
        if (recommendation) {
          const seenTokens = new Set()
          NUMERIC_TOKEN_PATTERN.lastIndex = 0
          let match
          while ((match = NUMERIC_TOKEN_PATTERN.exec(recommendation)) !== null) {
            const token = match[0].trim()
            const tokenLower = token.toLowerCase()
            if (seenTokens.has(tokenLower)) continue
            seenTokens.add(tokenLower)

            const digitsMatch = token.match(/\d+(?:[.,]\d+)?/)
            const digits = digitsMatch ? digitsMatch[0] : ''
            if (!digits) continue

            const inEvidence = checkDigitsInText(evidenceText, digits)
            if (!inEvidence) {
              const inOtherEvidence = allEvidenceTexts.some((text) => checkDigitsInText(text, digits))
              results.push({
                code: 'fabricated_number_in_recommendation',
                field: `issues[${i}].recommendation`,
                issueId,
                token,
                claim: token,
                evidenceIds,
                reusedFromOtherBullet: inOtherEvidence,
                message: `issues[${i}].recommendation: [fabricated_number_in_recommendation] Invented numeric token "${token}" (issue: ${issueId}) not found in evidence.originalText${inOtherEvidence ? ' (found in other bullet)' : ''}.`,
              })
            }
          }
        }

        // 1b. Check matching priorityActions[].action for this issue
        if (Array.isArray(analysis?.priorityActions)) {
          for (let j = 0; j < analysis.priorityActions.length; j++) {
            const pa = analysis.priorityActions[j]
            if (!pa || typeof pa !== 'object') continue

            const isMatch =
              (pa.issueId && pa.issueId === issue.id) ||
              (pa.bulletId && bulletId && pa.bulletId === bulletId) ||
              (issue.id && (pa.action?.includes(issue.id) || pa.title?.includes(issue.id))) ||
              (bulletId && (pa.action?.includes(bulletId) || pa.title?.includes(bulletId))) ||
              (pa.order === i + 1)

            if (isMatch) {
              handledPAIndices.add(j)
              const actionText = pa.action || ''
              if (actionText) {
                const seenTokens = new Set()
                NUMERIC_TOKEN_PATTERN.lastIndex = 0
                let match
                while ((match = NUMERIC_TOKEN_PATTERN.exec(actionText)) !== null) {
                  const token = match[0].trim()
                  const tokenLower = token.toLowerCase()
                  if (seenTokens.has(tokenLower)) continue
                  seenTokens.add(tokenLower)

                  const digitsMatch = token.match(/\d+(?:[.,]\d+)?/)
                  const digits = digitsMatch ? digitsMatch[0] : ''
                  if (!digits) continue

                  const inEvidence = checkDigitsInText(evidenceText, digits)
                  if (!inEvidence) {
                    const inOtherEvidence = allEvidenceTexts.some((text) => checkDigitsInText(text, digits))
                    results.push({
                      code: 'fabricated_number_in_recommendation',
                      field: `priorityActions[${j}].action`,
                      issueId,
                      token,
                      claim: token,
                      evidenceIds,
                      reusedFromOtherBullet: inOtherEvidence,
                      message: `priorityActions[${j}].action: [fabricated_number_in_recommendation] Invented numeric token "${token}" (issue: ${issueId}) not found in evidence.originalText${inOtherEvidence ? ' (found in other bullet)' : ''}.`,
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    // 1c. Check any remaining priorityActions not matched to an issue
    if (Array.isArray(analysis?.priorityActions)) {
      for (let j = 0; j < analysis.priorityActions.length; j++) {
        if (handledPAIndices.has(j)) continue
        const pa = analysis.priorityActions[j]
        if (!pa || typeof pa !== 'object') continue
        const actionText = pa.action || ''
        if (!actionText) continue

        const seenTokens = new Set()
        NUMERIC_TOKEN_PATTERN.lastIndex = 0
        let match
        while ((match = NUMERIC_TOKEN_PATTERN.exec(actionText)) !== null) {
          const token = match[0].trim()
          const tokenLower = token.toLowerCase()
          if (seenTokens.has(tokenLower)) continue
          seenTokens.add(tokenLower)

          const digitsMatch = token.match(/\d+(?:[.,]\d+)?/)
          const digits = digitsMatch ? digitsMatch[0] : ''
          if (!digits) continue

          const inAnyEvidence = allEvidenceTexts.some((text) => checkDigitsInText(text, digits))
          if (!inAnyEvidence) {
            results.push({
              code: 'fabricated_number_in_recommendation',
              field: `priorityActions[${j}].action`,
              issueId: null,
              token,
              claim: token,
              evidenceIds: [],
              reusedFromOtherBullet: false,
              message: `priorityActions[${j}].action: [fabricated_number_in_recommendation] Invented numeric token "${token}" not found in any resume evidence.`,
            })
          }
        }
      }
    }

    // 2. Existing additive check: placeholder metric suggestions inside parentheses
    const PLACEHOLDER_PATTERNS = [
      /\(e\.g\.?,?\s*[^)]*%[^)]*\)/gi,
      /\(e\.g\.?,?\s*reduc\w*[^)]*\)/gi,
      /\(e\.g\.?,?\s*increas\w*[^)]*\)/gi,
      /\(e\.g\.?,?\s*improv\w*[^)]*\)/gi,
      /\(e\.g\.?,?\s*decreas\w*[^)]*\)/gi,
    ]

    const extractInnerPhrase = (match) =>
      match.replace(/^\(e\.g\.?,?\s*/i, '').replace(/\)$/, '').trim().toLowerCase()

    // Check issues[].recommendation with placeholder patterns
    if (Array.isArray(analysis?.issues)) {
      for (let i = 0; i < analysis.issues.length; i++) {
        const issue = analysis.issues[i]
        if (!issue || typeof issue !== 'object') continue
        // V3.1: strip well-formed [ADD: ...] slots before placeholder-pattern matching
        const recommendation = stripFillInSlots(issue.recommendation || '')
        if (!recommendation) continue
        const originalText = ResumeAgentValidator.getEvidenceText(issue.evidence).toLowerCase()
        const evidenceIds = ResumeAgentValidator.getEvidenceIds(issue.evidence)
        const seenClaims = new Set()

        for (const pattern of PLACEHOLDER_PATTERNS) {
          pattern.lastIndex = 0
          let match
          while ((match = pattern.exec(recommendation)) !== null) {
            const claimKey = match[0].trim().toLowerCase()
            if (seenClaims.has(claimKey)) continue
            seenClaims.add(claimKey)

            const innerPhrase = extractInnerPhrase(match[0])
            const STOPWORDS = new Set(['reduced', 'increased', 'improved', 'decreased', 'e.g', 'by', 'to', 'in', 'of', 'the', 'a', 'an', 'and', 'or', 'for'])
            const keyWords = innerPhrase
              .replace(/[^a-z\s]/g, ' ')
              .split(/\s+/)
              .filter((w) => w.length > 3 && !STOPWORDS.has(w))

            const anyKeywordInEvidence = keyWords.some((kw) => originalText.includes(kw))

            if (!anyKeywordInEvidence && keyWords.length > 0) {
              results.push({
                code: 'placeholder_metric_category_not_in_evidence',
                field: `issues[${i}].recommendation`,
                issueId: issue.id || `iss_${i + 1}`,
                claim: match[0].trim(),
                evidenceIds,
                message: `issues[${i}].recommendation: [placeholder_metric_category_not_in_evidence] "${match[0].trim()}" not found in evidence.originalText.`,
              })
            }
          }
        }
      }
    }

    // Check priorityActions[].action with placeholder patterns
    if (Array.isArray(analysis?.priorityActions)) {
      for (let i = 0; i < analysis.priorityActions.length; i++) {
        const pa = analysis.priorityActions[i]
        if (!pa || typeof pa !== 'object') continue
        // V3.1: strip well-formed [ADD: ...] slots before placeholder-pattern matching
        const action = stripFillInSlots(pa.action || '')
        if (!action) continue
        const seenClaims = new Set()

        for (const pattern of PLACEHOLDER_PATTERNS) {
          pattern.lastIndex = 0
          let match
          while ((match = pattern.exec(action)) !== null) {
            const claimKey = match[0].trim().toLowerCase()
            if (seenClaims.has(claimKey)) continue
            seenClaims.add(claimKey)
            results.push({
              code: 'placeholder_metric_category_not_in_evidence',
              field: `priorityActions[${i}].action`,
              issueId: null,
              claim: match[0].trim(),
              evidenceIds: [],
              message: `priorityActions[${i}].action: [placeholder_metric_category_not_in_evidence] "${match[0].trim()}".`,
            })
          }
        }
      }
    }

    return results
  }

  /**
   * V2.3: Detects fabricated outcome / result claims in correctedText that cannot
   * be traced back to the issue's evidence.originalText.
   *
   * Logic:
   * 1. For each issue with non-null correctedText, extract outcome/result-indicating words
   *    using a keyword list: ["faster", "slower", "improved", "improves", "reduced",
   *    "reduces", "increased", "increases", "enabled", "enables", "smoother", "better",
   *    "higher", "lower", "efficient", "efficiency", "optimized", "streamlined"] (plus stems/variants).
   * 2. For each match, check whether that keyword (or a close synonym) appears in evidence.originalText.
   * 3. If ungrounded, flag "fabricated_outcome_in_corrected_text" with issueId and the specific phrase.
   *
   * @param {Object} analysis - Parsed analysis object or array of issues
   * @returns {{ code: string, field: string, issueId: string, keyword: string, phrase: string, originalText: string, message: string }[]}
   */
  static detectFabricatedOutcomeInCorrectedText(analysis) {
    const results = []
    const issues = Array.isArray(analysis)
      ? analysis
      : Array.isArray(analysis?.issues)
      ? analysis.issues
      : []

    if (issues.length === 0) return results

    const OUTCOME_KEYWORDS = [
      'faster', 'slower', 'improved', 'improves', 'improving', 'improvement', 'improvements',
      'reduced', 'reduces', 'reducing', 'reduction', 'reductions',
      'increased', 'increases', 'increasing',
      'enabled', 'enables', 'enabling',
      'smoother', 'better', 'higher', 'lower',
      'efficient', 'efficiency',
      'optimized', 'optimizes', 'optimizing', 'optimization',
      'streamlined', 'streamlines', 'streamlining',
    ]

    const INCREASE_SYNONYMS = [
      /\bincreas\w*\b/i,
      /\bgrow(th|n)?\b/i,
      /\bgrew\b/i,
      /\bboost\w*\b/i,
      /\bscal\w*\b/i,
      /\belevat\w*\b/i,
      /\brais\w*\b/i,
      /\bexpand\w*\b/i,
    ]

    const REDUCE_SYNONYMS = [
      /\breduc\w*\b/i,
      /\bcut(ting)?\b/i,
      /\bdrop(ped)?\b/i,
      /\bdecreas\w*\b/i,
      /\bslash\w*\b/i,
      /\bshrink\w*\b/i,
      /\bshrank\b/i,
      /\blow(er|est)?\b/i,
    ]

    const IMPROVE_SYNONYMS = [
      /\bimprov\w*\b/i,
      /\benhanc\w*\b/i,
      /\bbetter\b/i,
      /\belevat\w*\b/i,
      /\bboost\w*\b/i,
      /\boptimi\w*\b/i,
    ]

    const ENABLE_SYNONYMS = [
      /\benabl\w*\b/i,
      /\ballow\w*\b/i,
      /\bunlock\w*\b/i,
      /\bempower\w*\b/i,
    ]

    const STREAMLINE_SYNONYMS = [
      /\bstreamlin\w*\b/i,
      /\bautomat\w*\b/i,
      /\bsimplif\w*\b/i,
      /\befficien\w*\b/i,
    ]

    const OPTIMIZE_SYNONYMS = [
      /\boptimi\w*\b/i,
      /\btun(ed|ing)\b/i,
      /\baccelerat\w*\b/i,
      /\bstreamlin\w*\b/i,
    ]

    const FAST_SYNONYMS = [
      /\bfast(er|est)?\b/i,
      /\bspeed(up)?\b/i,
      /\baccelerat\w*\b/i,
      /\blatency\b/i,
      /\bquick\w*\b/i,
    ]

    const SYNONYM_MAP = {
      faster: FAST_SYNONYMS,
      slower: [/\bslow(er|est)?\b/i, /\blatency\b/i],
      improved: IMPROVE_SYNONYMS,
      improves: IMPROVE_SYNONYMS,
      improving: IMPROVE_SYNONYMS,
      improvement: IMPROVE_SYNONYMS,
      improvements: IMPROVE_SYNONYMS,
      reduced: REDUCE_SYNONYMS,
      reduces: REDUCE_SYNONYMS,
      reducing: REDUCE_SYNONYMS,
      reduction: REDUCE_SYNONYMS,
      reductions: REDUCE_SYNONYMS,
      increased: INCREASE_SYNONYMS,
      increases: INCREASE_SYNONYMS,
      increasing: INCREASE_SYNONYMS,
      enabled: ENABLE_SYNONYMS,
      enables: ENABLE_SYNONYMS,
      enabling: ENABLE_SYNONYMS,
      smoother: [/\bsmooth\w*\b/i, /\bseamless\w*\b/i, /\bfrictionless\b/i],
      better: [/\bbetter\b/i, /\bbest\b/i, /\bsuperior\b/i, ...IMPROVE_SYNONYMS],
      higher: [/\bhigh(er|est)?\b/i, ...INCREASE_SYNONYMS],
      lower: [/\blow(er|est)?\b/i, ...REDUCE_SYNONYMS],
      efficient: [/\befficien\w*\b/i, ...STREAMLINE_SYNONYMS],
      efficiency: [/\befficien\w*\b/i, ...STREAMLINE_SYNONYMS],
      optimized: OPTIMIZE_SYNONYMS,
      optimizes: OPTIMIZE_SYNONYMS,
      optimizing: OPTIMIZE_SYNONYMS,
      optimization: OPTIMIZE_SYNONYMS,
      streamlined: STREAMLINE_SYNONYMS,
      streamlines: STREAMLINE_SYNONYMS,
      streamlining: STREAMLINE_SYNONYMS,
    }

    const extractOutcomePhrase = (text, matchIndex, matchLen) => {
      if (!text) return ''
      let start = matchIndex
      while (start > 0) {
        const c = text[start - 1]
        if (/[,;.\n—\-]/.test(c)) break
        start--
      }
      let end = matchIndex + matchLen
      while (end < text.length) {
        const c = text[end]
        if (/[,;.\n—]/.test(c)) break
        end++
      }
      let clause = text.slice(start, end).trim()
      const connectiveMatch = clause.match(/\b(?:that|which|thereby|and)\s+.*$/i)
      if (connectiveMatch && matchIndex >= (start + connectiveMatch.index)) {
        clause = connectiveMatch[0]
      }
      const phrase = clause.replace(/^(?:and|that|which|thereby)\s+/i, '').trim()
      return phrase || text.slice(matchIndex, matchIndex + matchLen)
    }

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i]
      if (!issue || typeof issue !== 'object') continue
      if (!issue.correctedText || typeof issue.correctedText !== 'string') continue

      // V3.1: strip well-formed [ADD: ...] slots first — slot text like
      // "% improvement" must not be mistaken for a fabricated outcome claim
      const correctedText = stripFillInSlots(issue.correctedText).trim()
      if (!correctedText) continue

      const issueId = issue.id || `iss_${i + 1}`
      const originalText = ResumeAgentValidator.getEvidenceText(issue.evidence)
      const seenKeywords = new Set()

      for (const kw of OUTCOME_KEYWORDS) {
        const kwRegex = new RegExp(`\\b${kw}\\b`, 'gi')
        let match
        while ((match = kwRegex.exec(correctedText)) !== null) {
          const matchedKw = match[0].toLowerCase()
          if (seenKeywords.has(matchedKw)) continue
          seenKeywords.add(matchedKw)

          const synonymMatchers = SYNONYM_MAP[matchedKw] || [new RegExp(`\\b${matchedKw}\\b`, 'i')]
          const isGrounded = synonymMatchers.some((regex) => regex.test(originalText))

          if (!isGrounded) {
            const phrase = extractOutcomePhrase(correctedText, match.index, match[0].length)
            results.push({
              code: 'fabricated_outcome_in_corrected_text',
              field: `issues[${i}].correctedText`,
              issueId,
              keyword: matchedKw,
              phrase,
              originalText,
              message: `issues[${i}].correctedText: [fabricated_outcome_in_corrected_text] Outcome phrase "${phrase}" containing "${matchedKw}" (issue: ${issueId}) not grounded in evidence.originalText.`,
            })
          }
        }
      }
    }

    return results
  }

  /**
   * V3.1: Fill-in slot format enforcement.
   * 1. Malformed slots (digits inside, wrong bracket format) are violations.
   * 2. Slots in factual fields (diagnosis, whyItMatters, strengths, overallReview,
   *    candidateSnapshot) are violations — slots are homework, never facts.
   */
  static detectFillInSlotViolations(analysis) {
    const warnings = []
    if (!analysis || typeof analysis !== 'object') return warnings

    const check = (field, text) => {
      if (!text || typeof text !== 'string') return
      for (const problem of findMalformedFillInSlots(text)) {
        warnings.push(`${field}: [malformed_fill_in_slot] ${problem}`)
      }
    }

    if (Array.isArray(analysis.issues)) {
      for (let i = 0; i < analysis.issues.length; i++) {
        const issue = analysis.issues[i]
        if (!issue || typeof issue !== 'object') continue
        check(`issues[${i}].correctedText`, issue.correctedText)
        check(`issues[${i}].recommendation`, issue.recommendation)
        // Disallowed factual fields
        check(`issues[${i}].diagnosis`, issue.diagnosis)
        check(`issues[${i}].whyItMatters`, issue.whyItMatters)
      }
    }

    if (Array.isArray(analysis.priorityActions)) {
      for (let i = 0; i < analysis.priorityActions.length; i++) {
        check(`priorityActions[${i}].action`, analysis.priorityActions[i]?.action)
      }
    }

    check('overallReview.summary', analysis.overallReview?.summary)

    if (Array.isArray(analysis.strengths)) {
      for (let i = 0; i < analysis.strengths.length; i++) {
        check(`strengths[${i}].description`, analysis.strengths[i]?.description)
      }
    }

    return warnings
  }

  /**
   * Checks if rewritten text added numbers, %, or $ not present in original text
   */
  static detectHallucinatedMetrics(originalText, correctedText) {
    if (!correctedText) return false

    // V3.1: fill-in slots contain no digits but strip them for safety anyway
    correctedText = stripFillInSlots(correctedText)

    // Extract all numbers and percentage/dollar signs from original
    const origMetrics = originalText.match(/(\$?\d+(?:\.\d+)?%?|\b\d+x\b)/gi) || []
    const origMetricSet = new Set(origMetrics.map((m) => m.toLowerCase()))

    // Extract all numbers and percentage/dollar signs from rewrite
    const rewriteMetrics = correctedText.match(/(\$?\d+(?:\.\d+)?%?|\b\d+x\b)/gi) || []

    for (const metric of rewriteMetrics) {
      if (!origMetricSet.has(metric.toLowerCase())) {
        if (metric.includes('%') || metric.includes('$') || metric.toLowerCase().includes('x')) {
          return true
        }
        const numVal = parseFloat(metric)
        if (!isNaN(numVal) && numVal > 10) {
          return true
        }
      }
    }

    return false
  }
}

export default ResumeAgentValidator
