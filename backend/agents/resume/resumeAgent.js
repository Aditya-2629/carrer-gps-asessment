/**
 * Resume Agent V3
 * Evidence-first pipeline: Facts → Signals → Analyzers → Synthesis → Validation
 *
 * Full backward compatibility with V2.2 API contract.
 * Single LLM call (Synthesis Agent). All pre-processing is deterministic.
 */

import { DocumentParser } from '../../services/documentParser/index.js'
import { ResumeNormalizer } from './resumeAgent.normalizer.js'
import { ResumeAgentPrompt, PROMPT_VERSION as V2_PROMPT_VERSION } from './resumeAgent.prompt.js'
import { ResumeAgentValidator } from './resumeAgent.validator.js'
import { llmGateway } from '../../ai/gateway/llmGateway.js'
import { ResumeAgentTelemetry } from './resumeAgent.telemetry.js'
import {
  INPUT_SERIALIZER_VERSION,
  serializeResumeForLLM,
  computeHash,
} from './resumeAgent.inputSerializer.js'
import { generateResumeSignals } from './signals/signalEngine.js'
import { computePrecomputedSignals } from './signals/precomputedSignals.js'
import { PROMPT_VERSION } from './resumeAgent.prompt.js'

// ── V3 Pipeline Modules ───────────────────────────────────────────────────────
import {
  createResumeState,
  setCanonicalResume,
  setResumeFacts,
  setSignals,
  setPrecomputedSignals,
  setAnalyzerObservations,
  setSynthesisOutput,
  setValidation,
  setMetadata,
  extractFinalAnalysis,
} from './state/resumeState.js'
import { extractResumeFacts, formatCompactFactsSummary } from './facts/resumeFactExtractor.js'
import { normalizeFacts } from './facts/resumeFactNormalizer.js'
import { analyzePositioning } from './analyzers/positioningAnalyzer.js'
import { analyzeContent } from './analyzers/contentAnalyzer.js'
import { analyzeImpact } from './analyzers/impactAnalyzer.js'
import { analyzeTechnical } from './analyzers/technicalAnalyzer.js'
import { analyzeStructure } from './analyzers/structureAnalyzer.js'
import { analyzeEvidence, filterGroundedObservations } from './analyzers/evidenceAnalyzer.js'
import { buildSynthesisMessages, SYNTHESIS_PROMPT_VERSION } from './synthesis/resumeSynthesis.js'
import { validateAllRewrites } from './validation/rewriteValidator.js'
import { detectUnsupportedAssumptions } from './validation/assumptionValidator.js'
import { validateClaims } from './validation/claimValidator.js'
import { validateRecommendations } from './validation/recommendationValidator.js'
import { classifyAllEvidence, resolveEvidenceConsistency } from './classification/index.js'
import { formatCompactSignalSummary } from './signals/signalEngine.js'

export class ResumeAgent {
  /**
   * Main entry point to evaluate a candidate resume.
   *
   * @param {Object} params
   * @param {Buffer}  [params.buffer]                 - Binary file buffer (PDF/DOCX)
   * @param {string}  [params.mimeType]               - MIME type
   * @param {string}  [params.filename]               - Original filename
   * @param {string}  [params.resumeText]             - Direct text if uploaded as string
   * @param {string}  [params.targetRole]             - Target job role
   * @param {string}  [params.model]                  - Specific model from MODEL_REGISTRY
   * @param {string}  [params.inputMode='compact_text'] - 'compact_text' | 'canonical_json'
   * @param {boolean} [params.isSynthetic=false]
   * @param {boolean} [params.isBenchmark=false]
   * @param {boolean} [params.useV3Pipeline=true]     - Use V3 pipeline (default: true)
   * @param {Object}  [params.canonicalResumeOverride]
   * @param {Object}  [params.documentOverride]
   * @param {AbortSignal} [params.signal]
   * @returns {Promise<Object>}
   */
  static async evaluate({
    buffer = null,
    mimeType = '',
    filename = '',
    resumeText = '',
    targetRole = '',
    model = null,
    inputMode = 'compact_text',
    isSynthetic = false,
    isBenchmark = false,
    useV3Pipeline = true,
    canonicalResumeOverride = null,
    documentOverride = null,
    temperature = 0.2,
    topP = 0.9,
    signal = null,
  }) {
    const span = ResumeAgentTelemetry.createSpan({ targetRole, model: model || 'default' })
    let rawModelOutput = null

    try {
      // ── Step 1: Parse Document ─────────────────────────────────────────────
      let parsedDoc = documentOverride
      let canonicalResume = canonicalResumeOverride

      if (!parsedDoc) {
        parsedDoc = await DocumentParser.parse({
          buffer,
          mimeType,
          filename,
          text: resumeText,
        })
      }

      if (!parsedDoc.rawText || !parsedDoc.rawText.trim()) {
        throw new Error('Could not extract readable text from document. Scanned or empty document.')
      }

      // ── Step 2: Normalize → Canonical Resume ────────────────────────────────
      if (!canonicalResume) {
        canonicalResume = ResumeNormalizer.normalize(parsedDoc, targetRole)
      }

      const effectiveRole = targetRole || canonicalResume.candidate?.targetRole || 'Technical Professional'

      // ── Step 3: Compute Representations ─────────────────────────────────────
      const canonicalJsonText = JSON.stringify(canonicalResume, null, 2)
      const compactText = serializeResumeForLLM(canonicalResume, { targetRole: effectiveRole })

      const canonicalInputCharacters = canonicalJsonText.length
      const compactInputCharacters = compactText.length
      const canonicalEstimatedTokens = Math.round(canonicalInputCharacters / 4)
      const compactEstimatedTokens = Math.round(compactInputCharacters / 4)
      const canonicalInputHash = computeHash(canonicalResume)

      const isCompact = inputMode !== 'canonical_json'
      const llmInput = isCompact ? compactText : canonicalJsonText
      const llmInputHash = computeHash(llmInput)
      const inputSizeReductionPercent =
        canonicalInputCharacters > 0
          ? Number((((canonicalInputCharacters - compactInputCharacters) / canonicalInputCharacters) * 100).toFixed(1))
          : 0

      // ── Step 2.5: Deterministic Signal Engine (V2.3, preserved) ────────────
      const signals = generateResumeSignals(canonicalResume)

      // ── Step 2.6: Precomputed Deterministic Signals (V2.5 Phase 1) ─────────
      const precomputedSignals = computePrecomputedSignals(canonicalResume)

      // ── V3 Pipeline ──────────────────────────────────────────────────────────
      let state = null
      let messages = null
      let promptVersion = PROMPT_VERSION
      let evidenceClassifications = null

      if (useV3Pipeline) {
        // Initialize shared state
        state = createResumeState({
          documentId: canonicalInputHash,
          parserVersion: parsedDoc.parserVersion || 'v1',
        })
        setCanonicalResume(state, canonicalResume)
        state.compactResume = compactText

        // Step 3: Extract Resume Facts (deterministic)
        const rawFacts = extractResumeFacts(canonicalResume)
        const normalizedFacts = normalizeFacts(rawFacts.facts)
        const resumeFacts = { ...rawFacts, facts: normalizedFacts }
        setResumeFacts(state, resumeFacts)

        // Step 4: Attach Signals
        setSignals(state, signals)
        setPrecomputedSignals(state, precomputedSignals)

        // Set metadata for analyser access
        setMetadata(state, { targetRole: effectiveRole, model, isBenchmark, inputMode })

        // Step 5: Run Specialized Analyzers (deterministic)
        const posObs = analyzePositioning(resumeFacts, signals, canonicalResume)
        const cntObs = analyzeContent(resumeFacts, signals, canonicalResume)
        const impObs = analyzeImpact(resumeFacts, signals, canonicalResume)
        const tchObs = analyzeTechnical(resumeFacts, signals, canonicalResume)
        const strObs = analyzeStructure(resumeFacts, signals, canonicalResume)

        setAnalyzerObservations(state, 'positioning', posObs)
        setAnalyzerObservations(state, 'content', cntObs)
        setAnalyzerObservations(state, 'impact', impObs)
        setAnalyzerObservations(state, 'technical', tchObs)
        setAnalyzerObservations(state, 'structure', strObs)

        // Step 5.5: Evidence Gatekeeper
        const evidenceResult = analyzeEvidence(state.analyzerObservations, canonicalResume)
        setAnalyzerObservations(state, 'evidence', {
          version: evidenceResult.version,
          observations: [],
          groundingRate: evidenceResult.groundingRate,
          ungroundedCount: evidenceResult.ungroundedCount,
          totalObservations: evidenceResult.totalObservations,
          verifiedObservations: evidenceResult.verifiedObservations,
        })

        // Replace raw observations with grounded ones
        const grounded = filterGroundedObservations(evidenceResult.verifiedObservations)
        for (const [name, output] of Object.entries(grounded)) {
          if (name !== 'evidence') setAnalyzerObservations(state, name, output)
        }

        // Step 5.6: Evidence Classification Layer (V2.4)
        evidenceClassifications = classifyAllEvidence(resumeFacts, signals, canonicalResume)
        state.evidenceClassifications = evidenceClassifications

        // Step 6: Build Synthesis Messages (compact context only)
        messages = buildSynthesisMessages(state)
        promptVersion = SYNTHESIS_PROMPT_VERSION
      } else {
        // V2.2 legacy path (static import at top of file)
        messages = ResumeAgentPrompt.buildMessages(canonicalResume, targetRole, {
          inputMode,
          compactText,
          signals,
        })
        promptVersion = V2_PROMPT_VERSION
      }

      // ── Prompt Capture (test/dev mode) ───────────────────────────────────────
      const isTestMode = process.env.NODE_ENV !== 'production' || process.env.RESUME_AGENT_TEST_MODE === 'true'
      let promptCapture = null
      if (isTestMode) {
        const sysMsg = messages.find((m) => m.role === 'system')?.content || ''
        const userMsg = messages.find((m) => m.role === 'user')?.content || ''
        promptCapture = {
          version: promptVersion,
          pipelineVersion: useV3Pipeline ? 'v3' : 'v2',
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          inputMode,
          canonicalInputHash,
          llmInputHash,
          canonicalInputCharacters,
          compactInputCharacters,
          canonicalEstimatedTokens,
          compactEstimatedTokens,
          inputSizeReductionPercent,
          llmInput,
          compactText,
          canonicalJsonText,
          signals,
          precomputedSignals,
          resumeFacts: state?.resumeFacts || null,
          analyzerObservations: state?.analyzerObservations || null,
          evidenceClassifications: state?.evidenceClassifications || null,
          systemPrompt: sysMsg,
          userPrompt: userMsg,
          fullPrompt: messages.map((m) => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n'),
          capturedAt: new Date().toISOString(),
          generation: {
            temperature: 0.2,
            maxTokens: null, // set below
            reasoningMode: 'off',
            stream: false,
          },
        }
      }

      // Token budget — raised min to 6144 to prevent JSON truncation on complex resumes.
      // The synthesis prompt itself consumes ~3000 tokens; 4096 was leaving < 1000 for output.
      // 12000 cap is well within Groq (131K) and Gemini (1M) context limits.
      const scaledMaxTokens = Math.min(
        12000,
        Math.max(6144, Math.round(compactEstimatedTokens * 3))
      )
      if (promptCapture) promptCapture.generation.maxTokens = scaledMaxTokens

      // ── Step 7: LLM Synthesis Call ───────────────────────────────────────────
      const gatewayResponse = await llmGateway.generate({
        purpose: 'resume_analysis',
        messages,
        model,
        isSynthetic,
        isBenchmark,
        responseFormat: 'json_object',
        temperature,
        topP,
        maxTokens: scaledMaxTokens,
        signal,
      })

      rawModelOutput = gatewayResponse.text
      const finishReason = gatewayResponse.finishReason || 'stop'
      const gatewayMetadata = {
        provider: gatewayResponse.provider || 'groq',
        model: gatewayResponse.actualModel || model,
        latencyMs: gatewayResponse.latencyMs || 0,
        requestId: gatewayResponse.requestId,
        inputTokens: gatewayResponse.tokens?.prompt ?? null,
        outputTokens: gatewayResponse.tokens?.completion ?? null,
        finishReason,
        inputMode,
        inputSerializerVersion: INPUT_SERIALIZER_VERSION,
        promptVersion,
        pipelineVersion: useV3Pipeline ? 'v3' : 'v2',
      }

      // ── Truncation Guard ──────────────────────────────────────────────────────
      if (finishReason === 'length') {
        const telemetryRecord = span.finish({
          actualModel: gatewayResponse.actualModel,
          success: false,
          error: { code: 'MODEL_OUTPUT_INCOMPLETE', message: 'Model output incomplete.' },
          schemaValid: false,
          evidenceValidationValid: false,
          finishReason: 'length',
          inputMode,
        })

        return {
          success: false,
          status: 'MODEL_OUTPUT_INCOMPLETE',
          classification: 'MODEL_OUTPUT_INCOMPLETE',
          error: 'Model output incomplete (truncated due to token length limit).',
          code: 'MODEL_OUTPUT_INCOMPLETE',
          rawModelOutput,
          metadata: gatewayMetadata,
          canonicalResume,
          signals,
          state: state || null,
          document: parsedDoc,
          promptCapture,
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
          telemetry: telemetryRecord,
        }
      }

      // ── Step 8: Schema & Evidence Validation (existing V2.2 validator) ───────
      const validation = ResumeAgentValidator.validate(gatewayResponse.text, canonicalResume)

      if (!validation.isValid) {
        const errorSummary = [...(validation.errors || []), ...(validation.evidenceErrors || [])].join('; ')
        const isJsonError = (validation.errors || []).some((e) =>
          e.toLowerCase().includes('json') || e.toLowerCase().includes('parse')
        )
        const isEvidenceError = validation.evidenceErrors && validation.evidenceErrors.length > 0

        let failureClassification = 'SCHEMA_VALIDATION_ERROR'
        if (isJsonError) failureClassification = 'INVALID_JSON'
        else if (isEvidenceError) failureClassification = 'EVIDENCE_VALIDATION_ERROR'

        const telemetryRecord = span.finish({
          actualModel: gatewayResponse.actualModel,
          success: false,
          error: { code: failureClassification, message: errorSummary },
          schemaValid: validation.isSchemaValid ?? false,
          evidenceValidationValid: validation.isEvidenceValid ?? false,
          inputMode,
        })

        return {
          success: false,
          status: failureClassification,
          classification: failureClassification,
          error: `Resume analysis validation failed: ${errorSummary}`,
          code: failureClassification,
          rawModelOutput,
          metadata: gatewayMetadata,
          validationDetails: validation,
          canonicalResume,
          signals,
          state: state || null,
          document: parsedDoc,
          promptCapture,
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
          telemetry: telemetryRecord,
        }
      }

      // ── Step 9: V3 & V2.4 Additional Validation ─────────────────────────────
      let parsedAnalysis = validation.sanitizedAnalysis
      let v3Violations = []
      let v3Assumptions = []
      let v3RecommendationWarnings = []
      let v3ConsistencyResolutions = []

      if (useV3Pipeline) {
        // Rewrite safety
        const rewriteResult = validateAllRewrites(parsedAnalysis.issues || [], canonicalResume)
        v3Violations.push(...rewriteResult.violations)

        // Assumption detection
        v3Assumptions = detectUnsupportedAssumptions(parsedAnalysis)

        // Claim fabrication check
        const claimResult = validateClaims(parsedAnalysis, canonicalResume)
        v3Violations.push(...claimResult.violations)

        // Recommendation duplication check (§13, §14)
        const recResult = validateRecommendations(parsedAnalysis.issues || [])
        if (!recResult.valid) {
          v3RecommendationWarnings = recResult.violations
          validation.warnings.push(...recResult.warnings)
        }

        // Final Strength / Issue Consistency & Contradiction Resolution (§9, §17)
        const consistencyResult = resolveEvidenceConsistency(
          parsedAnalysis,
          evidenceClassifications?.byBulletId || {}
        )
        parsedAnalysis = consistencyResult.sanitizedAnalysis
        v3ConsistencyResolutions = consistencyResult.contradictions

        // Store in state
        if (state) {
          setSynthesisOutput(state, parsedAnalysis)
          setValidation(state, {
            schemaValid: validation.isSchemaValid,
            evidenceValid: validation.isEvidenceValid,
            unsupportedClaims: validation.unsupportedClaims || [],
            unsupportedAssumptions: v3Assumptions.map((a) => `[${a.location}] ${a.label}: "${a.match}"`),
            rewriteViolations: v3Violations,
            recommendationWarnings: v3RecommendationWarnings,
            consistencyResolutions: v3ConsistencyResolutions,
            errors: validation.errors || [],
            warnings: validation.warnings || [],
          })
          setMetadata(state, {
            provider: gatewayMetadata.provider,
            model: gatewayMetadata.model,
            latencyMs: gatewayMetadata.latencyMs,
            requestId: gatewayMetadata.requestId,
            inputTokens: gatewayMetadata.inputTokens,
            outputTokens: gatewayMetadata.outputTokens,
            finishReason,
            promptVersion,
          })
        }
      }

      // Embed metadata into analysis object safely
      const finalAnalysis = {
        ...parsedAnalysis,
        metadata: gatewayMetadata,
      }

      const hasClaimWarnings =
        (validation.unsupportedClaims && validation.unsupportedClaims.length > 0) ||
        (validation.unsupportedAssumptionWarnings && validation.unsupportedAssumptionWarnings.length > 0) ||
        (validation.placeholderWarnings && validation.placeholderWarnings.length > 0) ||
        (validation.fabricatedOutcomeWarnings && validation.fabricatedOutcomeWarnings.length > 0) ||
        v3Assumptions.length > 0

      const successClassification = hasClaimWarnings ? 'UNSUPPORTED_CLAIM_WARNING' : 'SUCCESS'

      const telemetryRecord = span.finish({
        actualModel: gatewayResponse.actualModel,
        success: true,
        schemaValid: true,
        evidenceValidationValid: validation.warnings.length === 0 && !hasClaimWarnings,
        issueCount: finalAnalysis.issues?.length || 0,
        promptTokens: gatewayResponse.tokens?.prompt,
        completionTokens: gatewayResponse.tokens?.completion,
        totalTokens: gatewayResponse.tokens?.total,
        inputMode,
        inputSerializerVersion: INPUT_SERIALIZER_VERSION,
        canonicalInputHash,
        llmInputHash,
        canonicalInputCharacters,
        compactInputCharacters,
        canonicalEstimatedTokens,
        compactEstimatedTokens,
        inputSizeReductionPercent,
      })

      return {
        success: true,
        status: successClassification,
        classification: successClassification,
        analysis: finalAnalysis,
        rawModelOutput,
        canonicalResume,
        signals,
        precomputedSignals,
        state: state || null,
        promptCapture,
        metadata: gatewayMetadata,
        validationDetails: {
          ...validation,
          v3RewriteViolations: v3Violations,
          v3UnsupportedAssumptions: v3Assumptions,
          v3RecommendationWarnings,
          v3ConsistencyResolutions,
          evidenceClassifications: isTestMode ? evidenceClassifications : undefined,
        },
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
        document: {
          type: parsedDoc.type,
          pageCount: parsedDoc.pageCount,
          confidence: parsedDoc.confidence,
          warnings: parsedDoc.warnings,
        },
        warnings: validation.warnings,
        telemetry: {
          requestId: gatewayResponse.requestId,
          provider: gatewayResponse.provider,
          model: gatewayResponse.actualModel,
          latencyMs: gatewayResponse.latencyMs,
          tokens: gatewayResponse.tokens,
          finishReason,
          inputMode,
          inputSerializerVersion: INPUT_SERIALIZER_VERSION,
          promptVersion,
          pipelineVersion: useV3Pipeline ? 'v3' : 'v2',
          canonicalInputHash,
          llmInputHash,
          canonicalInputCharacters,
          compactInputCharacters,
          canonicalEstimatedTokens,
          compactEstimatedTokens,
          inputSizeReductionPercent,
        },
      }
    } catch (err) {
      const telemetryRecord = span.finish({ success: false, error: err })

      return {
        success: false,
        status: 'PROVIDER_ERROR',
        classification: 'PROVIDER_ERROR',
        error: err.message || 'Resume Agent analysis failed.',
        code: err.code || 'PROVIDER_ERROR',
        statusCode: err.statusCode || 500,
        provider: err.provider || 'gateway',
        details: err.details || null,
        rawModelOutput,
        metadata: {
          provider: err.provider || 'gateway',
          model: model || 'unknown',
          latencyMs: telemetryRecord.latencyMs || 0,
          requestId: span.requestId,
          inputTokens: null,
          outputTokens: null,
          finishReason: 'error',
        },
        promptCapture: typeof promptCapture !== 'undefined' ? promptCapture : null,
        telemetry: {
          requestId: span.requestId,
          error: err.message,
          latencyMs: telemetryRecord.latencyMs,
        },
      }
    }
  }
}

export default ResumeAgent
