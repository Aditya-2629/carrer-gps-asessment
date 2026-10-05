/**
 * Resume Agent Test & Benchmarking Service
 * Handles controlled single runs, A/B model comparisons, raw output capture,
 * deterministic input hashing, runtime prompt capture, and review package generation for manual evaluation.
 *
 * Implements strict error separation:
 * 1. PROVIDER_FAILURE: Model never produced output (rawModelOutput: null, validation: null)
 * 2. MODEL_OUTPUT_INVALID: Model returned output but JSON/root schema failed (rawModelOutput preserved, JSON: FAIL, Schema: FAIL, Evidence: NOT_EVALUATED)
 * 3. OUTPUT_VALIDATION_FAILURE: JSON/schema valid, but evidence or verification checks failed (JSON: PASS, Schema: PASS, Evidence: FAIL)
 * 4. SUCCESS: All stages passed
 */

import crypto from 'crypto'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { DocumentParser } from './documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { PROMPT_VERSION } from '../agents/resume/resumeAgent.prompt.js'
import { ANALYSIS_VERSION } from '../agents/resume/resumeAgent.schema.js'
import { getModel, isModelAllowedForData, listModelsForPurpose } from '../ai/config/modelRegistry.js'
import {
  INPUT_SERIALIZER_VERSION,
  serializeResumeForLLM,
  computeHash,
} from '../agents/resume/resumeAgent.inputSerializer.js'

export class ResumeAgentTestService {
  /**
   * Generates a deterministic SHA-256 hash of canonical resume data
   */
  static computeInputHash(canonicalResume) {
    const jsonString = JSON.stringify(canonicalResume)
    return crypto.createHash('sha256').update(jsonString).digest('hex').slice(0, 16)
  }

  /**
   * Generates a formatted review export text block suitable for copying into ChatGPT/manual review.
   * Matches Section 13 contract.
   */
  static generateReviewExport({
    runId,
    model,
    provider,
    targetRole,
    promptVersion = PROMPT_VERSION,
    inputSerializerVersion = INPUT_SERIALIZER_VERSION,
    inputMode = 'compact_text',
    inputHash,
    canonicalInputHash,
    llmInputHash,
    canonicalInputCharacters,
    compactInputCharacters,
    inputSizeReductionPercent,
    latencyMs,
    status = 'success',
    rawModelOutput,
    parsedOutput,
    validation,
    providerError = null,
  }) {
    const cHash = canonicalInputHash || inputHash
    const lHash = llmInputHash || inputHash
    const charsInfo = canonicalInputCharacters != null
      ? `\nInput Chars: Canonical: ${canonicalInputCharacters} | Compact: ${compactInputCharacters}${inputSizeReductionPercent != null ? ` (${inputSizeReductionPercent}% reduction)` : ''}`
      : ''

    const header = `=== CAREER GPS RESUME AGENT TEST ===\n\nRun ID: ${runId}\nProvider: ${provider}\nModel: ${model}\nTarget Role: ${targetRole || 'Not specified'}\nPrompt Version: ${promptVersion}\nInput Serializer: ${inputSerializerVersion}\nInput Mode: ${inputMode}\nCanonical Input Hash: ${cHash}\nLLM Input Hash: ${lHash}${charsInfo}\nLatency: ${latencyMs}ms\nStatus: ${status.toUpperCase()}`

    if (providerError) {
      const errorBlock = `--- PROVIDER ERROR ---\nType: ${providerError.type || providerError.code || 'UNKNOWN'}\nHTTP Status: ${providerError.httpStatus || 500}\nMessage: ${providerError.message || 'Provider request failed'}`
      return {
        header,
        text: `${header}\n\n${errorBlock}\n`,
      }
    }

    const jsonStr = validation?.jsonValid === null ? 'NOT_EVALUATED' : validation?.jsonValid ? 'PASS' : 'FAIL'
    const schemaStr = validation?.schemaValid === null ? 'NOT_EVALUATED' : validation?.schemaValid ? 'PASS' : 'FAIL'
    const evidenceStr = validation?.evidenceValid === null ? 'NOT_EVALUATED' : validation?.evidenceValid ? 'PASS' : 'FAIL'
    const fabStr = validation?.fabricationDetected === null ? 'NOT_EVALUATED' : validation?.fabricationDetected ? 'DETECTED' : 'NONE'

    let claimsBlock = ''
    if (validation?.unsupportedClaims?.length > 0) {
      claimsBlock = `\nUnsupported Claims (${validation.unsupportedClaims.length}):\n` +
        validation.unsupportedClaims
          .map((c) => `  - [${c.field}] "${c.claim}" (Evidence: ${c.evidenceIds?.join(', ') || 'N/A'})`)
          .join('\n')
    }

    const validationSummary = `--- VALIDATION ---\nJSON: ${jsonStr}\nSchema: ${schemaStr}\nEvidence: ${evidenceStr}\nFabrication: ${fabStr}${claimsBlock}${
      validation?.errors?.length > 0 ? `\nErrors: ${validation.errors.join('; ')}` : ''
    }`

    let humanReadableSections = ''
    if (parsedOutput) {
      // Overall Review
      const rawReview = parsedOutput.overallReview
      const reviewText = typeof rawReview === 'string' ? rawReview : rawReview?.summary || (rawReview ? JSON.stringify(rawReview) : '(No overall review provided)')
      const overallSection = `--- OVERALL REVIEW ---\n${reviewText}`

      // Strengths
      let strengthsText = '(None)'
      if (Array.isArray(parsedOutput.strengths) && parsedOutput.strengths.length > 0) {
        strengthsText = parsedOutput.strengths
          .filter((s) => s && typeof s === 'object')
          .map((s, idx) => {
            const firstEv = Array.isArray(s.evidence) ? s.evidence[0] : s.evidence
            const evText = firstEv?.originalText || (Array.isArray(s.evidence) ? s.evidence.map(e => e?.originalText).filter(Boolean).join(' ') : 'N/A')
            const evId = firstEv?.bulletId || firstEv?.itemId || s.id || 'N/A'
            return `${idx + 1}. ${s.title || 'Strength'}\n   Signal: ${s.signal || s.description || 'N/A'}\n   Evidence: "${evText}" (ID: ${evId})`
          })
          .join('\n\n')
      }
      const strengthsSection = `--- STRENGTHS ---\n${strengthsText}`

      // Issues
      let issuesText = '(None)'
      if (Array.isArray(parsedOutput.issues) && parsedOutput.issues.length > 0) {
        issuesText = parsedOutput.issues
          .filter((iss) => iss && typeof iss === 'object')
          .map((iss, idx) => {
            const firstEv = Array.isArray(iss.evidence) ? iss.evidence[0] : iss.evidence
            const evText = typeof iss.evidence === 'string' ? iss.evidence : (firstEv?.originalText || (Array.isArray(iss.evidence) ? iss.evidence.map(e => e?.originalText).filter(Boolean).join(' ') : 'N/A'))
            const evId = firstEv?.bulletId || firstEv?.itemId || (Array.isArray(iss.evidence) ? iss.evidence.map(e => e?.bulletId).filter(Boolean).join(', ') : 'N/A')
            return `Issue ${idx + 1}:\nSeverity: ${iss.severity || 'medium'}\nTitle: ${iss.title || 'Issue'}\nEvidence: "${evText}" (${evId})\nDiagnosis: ${iss.diagnosis || 'N/A'}\nWhy it matters: ${iss.whyItMatters || 'N/A'}\nRecommendation: ${iss.recommendation || 'N/A'}\nCorrected text: ${iss.correctedText || 'None'}`
          })
          .join('\n\n')
      }
      const issuesSection = `--- ISSUES ---\n${issuesText}`

      // Priority Actions
      let actionsText = '(None)'
      if (Array.isArray(parsedOutput.priorityActions) && parsedOutput.priorityActions.length > 0) {
        actionsText = parsedOutput.priorityActions
          .map((p) => `${p.order || 1}. [${p.impact || 'Medium'} Impact] ${p.title || 'Action'}: ${p.action || ''}`)
          .join('\n')
      }
      const prioritySection = `--- PRIORITY ACTIONS ---\n${actionsText}`

      humanReadableSections = `\n\n${overallSection}\n\n${strengthsSection}\n\n${issuesSection}\n\n${prioritySection}`
    }

    const rawBlock = `--- RAW MODEL OUTPUT ---\n${rawModelOutput || '(No raw output produced)'}`
    const fullExportText = `${header}\n\n${validationSummary}${humanReadableSections}\n\n${rawBlock}\n`

    return {
      header,
      text: fullExportText,
    }
  }

  /**
   * Run a single model against a resume in benchmark mode (zero silent fallback).
   */
  static async runSingleTest({
    buffer = null,
    mimeType = '',
    filename = '',
    resumeText = '',
    targetRole = '',
    model,
    inputMode = 'compact_text',
    isSynthetic = false,
    signal = null,
  }) {
    if (!model) {
      throw new Error('In test mode, "model" parameter is strictly required.')
    }

    const modelMeta = getModel(model)
    if (!modelMeta) {
      throw new Error(`Model "${model}" is not registered in MODEL_REGISTRY.`)
    }

    // Data-safety gating
    const privacyCheck = isModelAllowedForData(model, isSynthetic)
    if (!privacyCheck.allowed) {
      const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      return {
        success: false,
        status: 'blocked',
        testRun: {
          runId,
          timestamp: new Date().toISOString(),
          provider: modelMeta.provider,
          requestedModel: model,
          actualModel: model,
          targetRole,
          promptVersion: PROMPT_VERSION,
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          inputMode,
          analysisVersion: ANALYSIS_VERSION,
          latencyMs: 0,
        },
        rawModelOutput: null,
        parsedOutput: null,
        validation: {
          jsonValid: null,
          schemaValid: null,
          evidenceValid: null,
          fabricationDetected: null,
          errors: [privacyCheck.reason],
        },
        error: {
          type: 'DATA_PRIVACY_ERROR',
          httpStatus: 422,
          message: privacyCheck.reason,
        },
      }
    }

    const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const startTime = Date.now()

    // 1. Parse document
    const parsedDoc = await DocumentParser.parse({
      buffer,
      mimeType,
      filename,
      text: resumeText,
    })

    // 2. Normalize canonical resume & compute input hashes and token estimates
    const canonicalResume = ResumeNormalizer.normalize(parsedDoc, targetRole)
    const effectiveRole = targetRole || canonicalResume.candidate?.targetRole || 'Technical Professional'
    const canonicalJsonText = JSON.stringify(canonicalResume, null, 2)
    const compactText = serializeResumeForLLM(canonicalResume, { targetRole: effectiveRole })

    const canonicalInputCharacters = canonicalJsonText.length
    const compactInputCharacters = compactText.length
    const canonicalEstimatedTokens = Math.round(canonicalInputCharacters / 4)
    const compactEstimatedTokens = Math.round(compactInputCharacters / 4)
    const canonicalInputHash = this.computeInputHash(canonicalResume)

    const isCompact = inputMode !== 'canonical_json'
    const llmInput = isCompact ? compactText : canonicalJsonText
    const llmInputHash = computeHash(llmInput)
    const inputSizeReductionPercent =
      canonicalInputCharacters > 0
        ? Number((((canonicalInputCharacters - compactInputCharacters) / canonicalInputCharacters) * 100).toFixed(1))
        : 0

    const sectionCounts = {
      experience: Array.isArray(canonicalResume?.experience) ? canonicalResume.experience.length : 0,
      projects: Array.isArray(canonicalResume?.projects) ? canonicalResume.projects.length : 0,
      education: Array.isArray(canonicalResume?.education) ? canonicalResume.education.length : 0,
      skills: Array.isArray(canonicalResume?.skills) ? canonicalResume.skills.length : 0,
      summary: canonicalResume?.summary?.text ? 1 : 0,
    }

    const inputSummary = {
      inputType: parsedDoc.type,
      pageCount: parsedDoc.pageCount,
      extractionConfidence: parsedDoc.confidence,
      resumeCharacterCount: parsedDoc.rawText?.length || 0,
      sectionCounts,
      inputMode,
      inputSerializerVersion: INPUT_SERIALIZER_VERSION,
      canonicalInputHash,
      llmInputHash,
      canonicalInputCharacters,
      compactInputCharacters,
      canonicalEstimatedTokens,
      compactEstimatedTokens,
      inputSizeReductionPercent,
    }

    // 3. Execute Resume Agent strictly in benchmark mode (NO fallback)
    const evalResult = await ResumeAgent.evaluate({
      resumeText: parsedDoc.rawText,
      targetRole,
      model,
      inputMode,
      isSynthetic,
      isBenchmark: true,
      documentOverride: parsedDoc,
      canonicalResumeOverride: canonicalResume,
      signal,
    })

    const latencyMs = Date.now() - startTime
    const rawModelOutput = evalResult.rawModelOutput || null

    const promptCapture = evalResult.promptCapture || null
    const configSnapshot = {
      provider: evalResult.telemetry?.provider || modelMeta.provider,
      requestedModel: model,
      actualModel: evalResult.telemetry?.model || model,
      temperature: 0.2,
      maxTokens: 4096,
      reasoningMode: 'off',
      stream: false,
      responseFormat: 'json_object',
      promptVersion: PROMPT_VERSION,
    }

    // --- ERROR CLASSIFICATION ---
    // A. PROVIDER FAILURE: Model never produced output
    if (!evalResult.success && rawModelOutput === null) {
      const providerErrorObj = {
        type: evalResult.code || 'PROVIDER_FAILURE',
        httpStatus: evalResult.statusCode || 500,
        message: evalResult.error || 'Provider request failed',
      }

      const reviewExport = this.generateReviewExport({
        runId,
        model,
        provider: evalResult.provider || modelMeta.provider,
        targetRole,
        promptVersion: PROMPT_VERSION,
        inputSerializerVersion: INPUT_SERIALIZER_VERSION,
        inputMode,
        inputHash: canonicalInputHash,
        canonicalInputHash,
        llmInputHash,
        canonicalInputCharacters,
        compactInputCharacters,
        inputSizeReductionPercent,
        latencyMs,
        status: 'provider_failure',
        rawModelOutput: null,
        parsedOutput: null,
        validation: null,
        providerError: providerErrorObj,
      })

      return {
        success: false,
        status: 'provider_failure',
        testRun: {
          runId,
          timestamp: new Date().toISOString(),
          provider: evalResult.provider || modelMeta.provider,
          requestedModel: model,
          actualModel: model,
          promptVersion: PROMPT_VERSION,
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          inputMode,
          inputHash: canonicalInputHash,
          canonicalInputHash,
          llmInputHash,
          canonicalInputCharacters,
          compactInputCharacters,
          canonicalEstimatedTokens,
          compactEstimatedTokens,
          inputSizeReductionPercent,
          latencyMs,
        },
        inputSummary,
        rawModelOutput: null,
        parsedOutput: null,
        validation: {
          jsonValid: null,
          schemaValid: null,
          evidenceValid: null,
          fabricationDetected: null,
          errors: [evalResult.error],
        },
        error: providerErrorObj,
        promptCapture,
        configSnapshot,
        reviewExport,
        inputMode,
        inputSerializerVersion: INPUT_SERIALIZER_VERSION,
        canonicalInputHash,
        llmInputHash,
        canonicalInputCharacters,
        compactInputCharacters,
        canonicalEstimatedTokens,
        compactEstimatedTokens,
        inputSizeReductionPercent,
        llmInput,
        telemetry: {
          inputTokens: null,
          outputTokens: null,
          providerLatencyMs: latencyMs,
          totalLatencyMs: latencyMs,
          inputMode,
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          canonicalInputHash,
          llmInputHash,
          canonicalInputCharacters,
          compactInputCharacters,
          canonicalEstimatedTokens,
          compactEstimatedTokens,
          inputSizeReductionPercent,
        },
      }
    }

    // B. MODEL GENERATED OUTPUT — Evaluate JSON, Schema, Evidence
    const parsedOutput = evalResult.success ? evalResult.analysis : null
    const valDetails = evalResult.validationDetails || {}
    const warnings = evalResult.warnings || valDetails.warnings || []
    const valErrors = valDetails.errors || (evalResult.success ? [] : [evalResult.error])
    const unsupportedClaims = valDetails.unsupportedClaims || []
    const traceabilityWarnings = valDetails.traceabilityWarnings || []
    const placeholderWarnings = valDetails.placeholderWarnings || []

    let status = 'success'
    let jsonValid = Boolean(parsedOutput)
    let schemaValid = evalResult.success
    let evidenceValid = evalResult.success && warnings.length === 0 && unsupportedClaims.length === 0
    let fabricationDetected =
      unsupportedClaims.length > 0 ||
      warnings.some(
        (w) =>
          w.toLowerCase().includes('invent') ||
          w.toLowerCase().includes('hallucinat') ||
          w.toLowerCase().includes('unsupported')
      )

    const classification = evalResult.classification || (evalResult.success ? 'SUCCESS' : 'SCHEMA_VALIDATION_ERROR')
    status = evalResult.status || (evalResult.success ? 'success' : 'failed')

    if (!evalResult.success) {
      if (evalResult.code === 'MODEL_OUTPUT_INCOMPLETE' || classification === 'MODEL_OUTPUT_INCOMPLETE') {
        status = 'model_output_incomplete'
        jsonValid = false
        schemaValid = false
        evidenceValid = null
        fabricationDetected = null
      } else {
        const isJsonParseFailure = valErrors.some(
          (e) => e.toLowerCase().includes('json') || e.toLowerCase().includes('parse') || e.toLowerCase().includes('empty')
        )

        if (isJsonParseFailure || !parsedOutput) {
          status = 'model_output_invalid'
          jsonValid = false
          schemaValid = false
          evidenceValid = null
          fabricationDetected = null
        } else {
          status = 'output_validation_failure'
          jsonValid = true
          schemaValid = false
          evidenceValid = false
        }
      }
    }

    const validation = {
      jsonValid,
      schemaValid,
      evidenceValid,
      fabricationDetected,
      unsupportedClaims,
      unsupportedAssumptionWarnings: valDetails.unsupportedAssumptionWarnings || [],
      traceabilityWarnings,
      placeholderWarnings,
      fabricatedOutcomeWarnings: valDetails.fabricatedOutcomeWarnings || [],
      errors: valErrors,
      evidenceErrors: valDetails.evidenceErrors || [],
      warnings,
    }

    const reviewExport = this.generateReviewExport({
      runId,
      model,
      provider: modelMeta.provider,
      targetRole,
      promptVersion: PROMPT_VERSION,
      inputSerializerVersion: INPUT_SERIALIZER_VERSION,
      inputMode,
      inputHash: canonicalInputHash,
      canonicalInputHash,
      llmInputHash,
      canonicalInputCharacters,
      compactInputCharacters,
      inputSizeReductionPercent,
      latencyMs,
      status,
      rawModelOutput,
      parsedOutput,
      validation,
    })

    return {
      success: evalResult.success,
      status,
      classification,
      finishReason: evalResult.metadata?.finishReason || evalResult.telemetry?.finishReason || 'stop',
      metadata: evalResult.metadata || {
        provider: modelMeta.provider,
        model,
        latencyMs,
        finishReason: 'stop',
      },
      testRun: {
        runId,
        timestamp: new Date().toISOString(),
        provider: modelMeta.provider,
        requestedModel: model,
        actualModel: evalResult.telemetry?.model || model,
        targetRole,
        promptVersion: PROMPT_VERSION,
        analysisVersion: ANALYSIS_VERSION,
        inputSerializerVersion: INPUT_SERIALIZER_VERSION,
        inputMode,
        inputHash: canonicalInputHash,
        canonicalInputHash,
        llmInputHash,
        canonicalInputCharacters,
        compactInputCharacters,
        canonicalEstimatedTokens,
        compactEstimatedTokens,
        inputSizeReductionPercent,
        latencyMs,
      },
      inputSummary,
      rawModelOutput,
      parsedOutput,
      validation,
      promptCapture,
      configSnapshot,
      reviewExport,
      signals: evalResult.signals || null,
      inputMode,
      inputSerializerVersion: INPUT_SERIALIZER_VERSION,
      canonicalInputHash,
      llmInputHash,
      canonicalInputCharacters,
      compactInputCharacters,
      canonicalEstimatedTokens,
      compactEstimatedTokens,
      inputSizeReductionPercent,
      llmInput,
      telemetry: {
        inputTokens: evalResult.telemetry?.tokens?.prompt ?? null,
        outputTokens: evalResult.telemetry?.tokens?.completion ?? null,
        reasoningTokens: evalResult.telemetry?.tokens?.reasoning ?? null,
        providerLatencyMs: evalResult.telemetry?.latencyMs ?? latencyMs,
        totalLatencyMs: latencyMs,
        inputMode,
        inputSerializerVersion: INPUT_SERIALIZER_VERSION,
        canonicalInputHash,
        llmInputHash,
        canonicalInputCharacters,
        compactInputCharacters,
        canonicalEstimatedTokens,
        compactEstimatedTokens,
        inputSizeReductionPercent,
      },
      ...(!evalResult.success && status !== 'provider_failure'
        ? {
            error: {
              type: status === 'model_output_invalid' ? 'MODEL_OUTPUT_INVALID' : 'OUTPUT_VALIDATION_FAILURE',
              httpStatus: 422,
              message: evalResult.error,
            },
          }
        : {}),
    }
  }

  /**
   * Run the same resume against multiple models in parallel/sequence.
   * Guarantees identical canonical input, target role, and prompt across all runs.
   * Runs in strict benchmark mode (no fallback).
   */
  static async runComparisonTest({
    buffer = null,
    mimeType = '',
    filename = '',
    resumeText = '',
    targetRole = '',
    models = [],
    inputMode = 'compact_text',
    isSynthetic = false,
    signal = null,
  }) {
    if (!Array.isArray(models) || models.length === 0) {
      throw new Error('Comparison test requires a non-empty array of "models".')
    }

    const comparisonRunId = `cmp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

    // 1. Parse document ONCE
    const parsedDoc = await DocumentParser.parse({
      buffer,
      mimeType,
      filename,
      text: resumeText,
    })

    if (!parsedDoc.rawText || !parsedDoc.rawText.trim()) {
      throw new Error('Could not extract text from resume. Document is empty or unreadable.')
    }

    // 2. Normalize canonical resume ONCE & compute canonical input hash and representations
    const canonicalResume = ResumeNormalizer.normalize(parsedDoc, targetRole)
    const effectiveRole = targetRole || canonicalResume.candidate?.targetRole || 'Technical Professional'
    const canonicalJsonText = JSON.stringify(canonicalResume, null, 2)
    const compactText = serializeResumeForLLM(canonicalResume, { targetRole: effectiveRole })

    const canonicalInputCharacters = canonicalJsonText.length
    const compactInputCharacters = compactText.length
    const canonicalEstimatedTokens = Math.round(canonicalInputCharacters / 4)
    const compactEstimatedTokens = Math.round(compactInputCharacters / 4)
    const canonicalInputHash = this.computeInputHash(canonicalResume)

    const isCompact = inputMode !== 'canonical_json'
    const llmInput = isCompact ? compactText : canonicalJsonText
    const llmInputHash = computeHash(llmInput)
    const inputSizeReductionPercent =
      canonicalInputCharacters > 0
        ? Number((((canonicalInputCharacters - compactInputCharacters) / canonicalInputCharacters) * 100).toFixed(1))
        : 0

    const inputSummary = {
      inputType: parsedDoc.type,
      pageCount: parsedDoc.pageCount,
      extractionConfidence: parsedDoc.confidence,
      resumeCharacterCount: parsedDoc.rawText.length,
      inputMode,
      inputSerializerVersion: INPUT_SERIALIZER_VERSION,
      canonicalInputHash,
      llmInputHash,
      canonicalInputCharacters,
      compactInputCharacters,
      canonicalEstimatedTokens,
      compactEstimatedTokens,
      inputSizeReductionPercent,
    }

    // 3. Execute each model independently with identical input and prompt
    const runs = []

    for (const modelId of models) {
      const modelMeta = getModel(modelId)
      const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
      const startTime = Date.now()

      // Model-level data privacy check
      const privacyCheck = isModelAllowedForData(modelId, isSynthetic)
      if (!privacyCheck.allowed) {
        runs.push({
          model: modelId,
          provider: modelMeta?.provider || 'unknown',
          status: 'blocked',
          inputMode,
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          canonicalInputHash,
          llmInputHash,
          canonicalInputCharacters,
          compactInputCharacters,
          canonicalEstimatedTokens,
          compactEstimatedTokens,
          inputSizeReductionPercent,
          llmInput,
          error: {
            type: 'DATA_PRIVACY_ERROR',
            message: privacyCheck.reason,
          },
          latencyMs: 0,
          rawModelOutput: null,
          parsedOutput: null,
          promptCapture: null,
          configSnapshot: {
            provider: modelMeta?.provider || 'unknown',
            requestedModel: modelId,
            actualModel: modelId,
            promptVersion: PROMPT_VERSION,
            inputSerializerVersion: INPUT_SERIALIZER_VERSION,
            inputMode,
          },
          validation: {
            jsonValid: null,
            schemaValid: null,
            evidenceValid: null,
            fabricationDetected: null,
            errors: [privacyCheck.reason],
          },
          reviewExport: {
            header: `Model: ${modelId} | BLOCKED: ${privacyCheck.reason}`,
            text: `Model: ${modelId} is blocked for real personal data. Use synthetic data to test.`,
          },
        })
        continue
      }

      try {
        const evalResult = await ResumeAgent.evaluate({
          resumeText: parsedDoc.rawText,
          targetRole,
          model: modelId,
          inputMode,
          isSynthetic,
          isBenchmark: true, // Strict benchmark isolation
          documentOverride: parsedDoc,
          canonicalResumeOverride: canonicalResume,
          signal,
        })

        const latencyMs = Date.now() - startTime
        const rawModelOutput = evalResult.rawModelOutput || null

        const promptCapture = evalResult.promptCapture || null
        const configSnapshot = {
          provider: evalResult.telemetry?.provider || modelMeta?.provider || 'unknown',
          requestedModel: modelId,
          actualModel: evalResult.telemetry?.model || modelId,
          temperature: 0.2,
          maxTokens: 4096,
          reasoningMode: 'off',
          stream: false,
          responseFormat: 'json_object',
          promptVersion: PROMPT_VERSION,
        }

        if (!evalResult.success && rawModelOutput === null) {
          // Provider failure
          const providerErrorObj = {
            type: evalResult.code || 'PROVIDER_FAILURE',
            httpStatus: evalResult.statusCode || 500,
            message: evalResult.error || 'Provider request failed',
          }

          const reviewExport = this.generateReviewExport({
            runId,
            model: modelId,
            provider: evalResult.provider || modelMeta?.provider || 'unknown',
            targetRole,
            promptVersion: PROMPT_VERSION,
            inputSerializerVersion: INPUT_SERIALIZER_VERSION,
            inputMode,
            inputHash: canonicalInputHash,
            canonicalInputHash,
            llmInputHash,
            canonicalInputCharacters,
            compactInputCharacters,
            inputSizeReductionPercent,
            latencyMs,
            status: 'provider_failure',
            rawModelOutput: null,
            parsedOutput: null,
            validation: null,
            providerError: providerErrorObj,
          })

          runs.push({
            model: modelId,
            provider: evalResult.provider || modelMeta?.provider || 'unknown',
            status: 'provider_failure',
            latencyMs,
            inputMode,
            inputSerializerVersion: INPUT_SERIALIZER_VERSION,
            canonicalInputHash,
            llmInputHash,
            canonicalInputCharacters,
            compactInputCharacters,
            canonicalEstimatedTokens,
            compactEstimatedTokens,
            inputSizeReductionPercent,
            llmInput,
            rawModelOutput: null,
            parsedOutput: null,
            promptCapture,
            configSnapshot,
            validation: {
              jsonValid: null,
              schemaValid: null,
              evidenceValid: null,
              fabricationDetected: null,
              errors: [evalResult.error],
            },
            telemetry: {
              inputTokens: null,
              outputTokens: null,
              providerLatencyMs: latencyMs,
              totalLatencyMs: latencyMs,
              inputMode,
              inputSerializerVersion: INPUT_SERIALIZER_VERSION,
              canonicalInputHash,
              llmInputHash,
              canonicalInputCharacters,
              compactInputCharacters,
              canonicalEstimatedTokens,
              compactEstimatedTokens,
              inputSizeReductionPercent,
            },
            reviewExport,
            error: providerErrorObj,
          })
          continue
        }

        const parsedOutput = evalResult.success ? evalResult.analysis : null
        const valDetails = evalResult.validationDetails || {}
        const warnings = evalResult.warnings || valDetails.warnings || []
        const valErrors = valDetails.errors || (evalResult.success ? [] : [evalResult.error])

        let status = 'success'
        let jsonValid = Boolean(parsedOutput)
        let schemaValid = evalResult.success
        let evidenceValid = evalResult.success && warnings.length === 0
        let fabricationDetected = warnings.some(
          (w) => w.toLowerCase().includes('invent') || w.toLowerCase().includes('hallucinat')
        )

        if (!evalResult.success) {
          const isJsonParseFailure = valErrors.some(
            (e) => e.toLowerCase().includes('json') || e.toLowerCase().includes('parse') || e.toLowerCase().includes('empty')
          )
          if (isJsonParseFailure || !parsedOutput) {
            status = 'model_output_invalid'
            jsonValid = false
            schemaValid = false
            evidenceValid = null
            fabricationDetected = null
          } else {
            status = 'output_validation_failure'
            jsonValid = true
            schemaValid = false
            evidenceValid = false
          }
        }

        const validation = {
          jsonValid,
          schemaValid,
          evidenceValid,
          fabricationDetected,
          errors: valErrors,
          warnings,
        }

        const reviewExport = this.generateReviewExport({
          runId,
          model: modelId,
          provider: modelMeta?.provider || 'unknown',
          targetRole,
          promptVersion: PROMPT_VERSION,
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          inputMode,
          inputHash: canonicalInputHash,
          canonicalInputHash,
          llmInputHash,
          canonicalInputCharacters,
          compactInputCharacters,
          inputSizeReductionPercent,
          latencyMs,
          status,
          rawModelOutput,
          parsedOutput,
          validation,
        })

        runs.push({
          model: modelId,
          provider: modelMeta?.provider || 'unknown',
          status,
          latencyMs,
          inputMode,
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          canonicalInputHash,
          llmInputHash,
          canonicalInputCharacters,
          compactInputCharacters,
          canonicalEstimatedTokens,
          compactEstimatedTokens,
          inputSizeReductionPercent,
          llmInput,
          rawModelOutput,
          parsedOutput,
          promptCapture,
          configSnapshot,
          signals: evalResult.signals || null,
          validation,
          telemetry: {
            inputTokens: evalResult.telemetry?.tokens?.prompt ?? null,
            outputTokens: evalResult.telemetry?.tokens?.completion ?? null,
            reasoningTokens: evalResult.telemetry?.tokens?.reasoning ?? null,
            providerLatencyMs: evalResult.telemetry?.latencyMs ?? latencyMs,
            totalLatencyMs: latencyMs,
            inputMode,
            inputSerializerVersion: INPUT_SERIALIZER_VERSION,
            canonicalInputHash,
            llmInputHash,
            canonicalInputCharacters,
            compactInputCharacters,
            canonicalEstimatedTokens,
            compactEstimatedTokens,
            inputSizeReductionPercent,
          },
          reviewExport,
          error: evalResult.success ? null : { message: evalResult.error },
        })
      } catch (err) {
        const latencyMs = Date.now() - startTime
        runs.push({
          model: modelId,
          provider: modelMeta?.provider || 'unknown',
          status: 'provider_failure',
          latencyMs,
          inputMode,
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          canonicalInputHash,
          llmInputHash,
          canonicalInputCharacters,
          compactInputCharacters,
          canonicalEstimatedTokens,
          compactEstimatedTokens,
          inputSizeReductionPercent,
          llmInput,
          rawModelOutput: null,
          parsedOutput: null,
          promptCapture: null,
          configSnapshot: {
            provider: modelMeta?.provider || 'unknown',
            requestedModel: modelId,
            actualModel: modelId,
            promptVersion: PROMPT_VERSION,
            inputSerializerVersion: INPUT_SERIALIZER_VERSION,
            inputMode,
          },
          validation: {
            jsonValid: null,
            schemaValid: null,
            evidenceValid: null,
            fabricationDetected: null,
            errors: [err.message],
          },
          telemetry: {
            inputTokens: null,
            outputTokens: null,
            providerLatencyMs: latencyMs,
            totalLatencyMs: latencyMs,
            inputMode,
            inputSerializerVersion: INPUT_SERIALIZER_VERSION,
            canonicalInputHash,
            llmInputHash,
            canonicalInputCharacters,
            compactInputCharacters,
            canonicalEstimatedTokens,
            compactEstimatedTokens,
            inputSizeReductionPercent,
          },
          reviewExport: {
            header: `Model: ${modelId} | PROVIDER_FAILURE`,
            text: `Execution failed: ${err.message}`,
          },
          error: {
            type: 'PROVIDER_FAILURE',
            message: err.message,
          },
        })
      }
    }

    return {
      success: true,
      comparisonRunId,
      inputHash: canonicalInputHash,
      canonicalInputHash,
      llmInputHash,
      inputMode,
      inputSerializerVersion: INPUT_SERIALIZER_VERSION,
      canonicalInputCharacters,
      compactInputCharacters,
      canonicalEstimatedTokens,
      compactEstimatedTokens,
      inputSizeReductionPercent,
      llmInput,
      testInput: {
        targetRole,
        isSynthetic,
        modelsRequested: models,
        inputMode,
        inputSummary,
      },
      runs,
    }
  }

  /**
   * Health status for test service
   */
  static getHealth() {
    const models = listModelsForPurpose('resume_analysis')
    return {
      success: true,
      service: 'resume-agent-test',
      gatewayAvailable: true,
      registeredModels: models.length,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    }
  }
}

export default ResumeAgentTestService
