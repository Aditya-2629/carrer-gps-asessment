/**
 * Resume Agent V3
 * Evidence-first pipeline: Facts → Signals → Analyzers → Synthesis → Validation
 *
 * Full backward compatibility with V2.2 API contract.
 * Single LLM call (Synthesis Agent). All pre-processing is deterministic.
 */

import { DocumentParser } from '../../services/documentParser/index.js'
import { DeterministicChunker, ContextBudgetExceededError } from './chunking/deterministicChunker.js'
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
import { classifyDomain } from './market/domainClassifier.js'
import { detectUsMarketSignals } from './market/usMarketSignals.js'
import { resolveMarketBucket } from './market/marketBucketResolver.js'
import { getMarketDataForBucket } from './market/marketJdRetriever.js'
import { evaluateMarketEvidence, isMarketLanguageSafe } from './market/marketEvidence.js'
import { setMarketContext } from './state/resumeState.js'
import { computeScorecard } from './scoring/resumeScorecard.js'
import { RESUME_AGENT } from '../core/agentContract.js'
import { runAgentLifecycle } from '../core/BaseAgent.js'
import { generateStructured } from '../core/structuredOutput.js'
import { registerPrompt } from '../core/promptRegistry.js'
import { SYNTHESIS_SYSTEM_PROMPT } from './synthesis/resumeSynthesis.prompt.js'
import { runOrchestratedSynthesis } from './orchestration/orchestrationRunner.js'

// Phase A (kernel): the synthesis prompt lives in the registry so every run
// is traceable to exact prompt text via hash.
registerPrompt('resume-synthesis', SYNTHESIS_PROMPT_VERSION, SYNTHESIS_SYSTEM_PROMPT)

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
    targetJobDescription = '',
    experienceLevel = '',
    marketContextOverride = null,
    model = null,
    orchestrationMode = process.env.RESUME_AGENT_ORCHESTRATION_MODE || 'chunked_section_synthesis',
    taskPolicies = {},
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

      // ── Step 1.5: Deterministic Chunking & Deduplication ───────────────────
      const chunkResult = DeterministicChunker.process(parsedDoc, {
        safeTokenBudget: 32000,
        maxSectionChars: 16000,
      })
      parsedDoc = chunkResult.parsedDoc

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

        // Step 5.7: Domain Profile + US-Market Signals (V3.1)
        // Deterministic classification of the candidate's professional domain
        // (IT vs non-IT) and detection of non-US resume conventions, injected
        // as context blocks by the synthesis builder.
        const domainProfile = classifyDomain(canonicalResume)
        state.domainProfile = domainProfile

        const usMarketSignals = detectUsMarketSignals({
          resumeText: compactText,
          pageCount: typeof parsedDoc.pageCount === 'number' ? parsedDoc.pageCount : null,
          location: canonicalResume.candidate?.contact?.location || null,
        })
        state.usMarketSignals = usMarketSignals

        // Step 5.8: Market Intelligence Layer (V3 Market-Aware Analysis)
        // Resolves canonical Role × Experience bucket, retrieves 5 market JDs or triggers background refresh,
        // and evaluates comparative evidence without overriding candidate's target JD.
        const bucketResolution = resolveMarketBucket({
          targetRole: effectiveRole,
          targetJobDescription,
          canonicalResume,
          resumeText: compactText,
        })

        let marketData = marketContextOverride
        if (!marketData) {
          try {
            marketData = await getMarketDataForBucket(bucketResolution.bucketKey, { autoRefresh: true })
          } catch (marketErr) {
            console.warn('[ResumeAgent] Market lookup failed (non-fatal):', marketErr.message)
            marketData = { status: 'unavailable', bucketKey: bucketResolution.bucketKey, reason: marketErr.message }
          }
        }

        const marketEvidence = evaluateMarketEvidence({
          canonicalResume,
          targetJobDescription,
          marketProfile: marketData?.marketProfile || null,
        })

        const marketContext = {
          status: marketData?.status || 'unavailable',
          role: bucketResolution.roleName,
          roleKey: bucketResolution.roleKey,
          experienceBucket: bucketResolution.experienceBucket,
          bucketKey: bucketResolution.bucketKey,
          candidateExperienceYears: bucketResolution.candidateExperienceYears,
          jdExperienceRequirement: bucketResolution.jdExperienceRequirement,
          marketSampleSize: marketData?.sampleSize || 0,
          marketVersion: marketData?.version || 0,
          targetAlignment: marketEvidence.targetAlignment || [],
          marketEvidenceGaps: marketEvidence.marketEvidenceGaps || [],
          marketStrengths: marketEvidence.marketStrengths || [],
          marketSignals: marketData?.marketProfile?.skills?.slice(0, 5) || [],
          confidence: bucketResolution.confidence,
          method: bucketResolution.method,
        }

        setMarketContext(state, marketContext)
        state.targetJobDescription = targetJobDescription
        state.marketProfile = marketData?.marketProfile || null

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
          domainProfile: state?.domainProfile || null,
          usMarketSignals: state?.usMarketSignals || null,
          marketContext: state?.marketContext || null,
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

      // ── Steps 7+8 (Phase A kernel): bounded validate→retry synthesis ────────
      // Policy comes from the agent contract: up to N attempts with validation
      // errors injected as a repair note between attempts. Truncation is fatal
      // (retrying with the same budget cannot fix it) and falls through to the
      // truncation guard below.
      let gatewayResponse = null
      let validation = null
      let finishReason = 'stop'
      const maxSynthesisAttempts = Math.max(1, RESUME_AGENT.retryPolicy.maxAttempts)

      if (
        useV3Pipeline &&
        (orchestrationMode === 'chunked_section_synthesis' ||
          orchestrationMode === 'specialized_parallel_agents' ||
          orchestrationMode === 'hybrid_deterministic_reasoning' ||
          orchestrationMode === 'baseline_single_synthesis')
      ) {
        const orchResult = await runOrchestratedSynthesis({
          mode: orchestrationMode,
          state,
          canonicalResume,
          targetRole: effectiveRole,
          targetJobDescription,
          taskPolicies,
          model,
          isBenchmark,
          signal,
        })
        if (!orchResult.success && orchResult.finishReason === 'error') {
          const providerErr = new Error(orchResult.validation?.errors?.[0] || 'Orchestration LLM call failed')
          providerErr.code = 'PROVIDER_ERROR'
          providerErr.provider = orchResult.metrics?.provider || 'groq'
          throw providerErr
        }
        rawModelOutput = orchResult.rawModelOutput
        validation = orchResult.validation || ResumeAgentValidator.validate(rawModelOutput, canonicalResume)
        finishReason = orchResult.finishReason || 'stop'
        gatewayResponse = {
          text: rawModelOutput,
          actualModel: orchResult.metrics?.model || model,
          provider: orchResult.metrics?.provider || 'groq',
          latencyMs: orchResult.metrics?.gatewayLatencyMs ?? orchResult.metrics?.totalDurationMs ?? 0,
          requestId: orchResult.metrics?.gatewayRequestId || `orch_${Date.now()}`,
          tokens: {
            prompt: orchResult.metrics?.inputTokens || 0,
            completion: orchResult.metrics?.outputTokens || 0,
            total: orchResult.metrics?.totalTokens || 0,
          },
          finishReason,
        }
      } else {
        for (let attempt = 1; attempt <= maxSynthesisAttempts; attempt++) {
          gatewayResponse = await llmGateway.generate({
            purpose: RESUME_AGENT.purpose,
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
          finishReason = gatewayResponse.finishReason || 'stop'
          if (promptCapture) promptCapture.generation.attempt = attempt

          if (finishReason === 'length') break // fatal

          validation = ResumeAgentValidator.validate(gatewayResponse.text, canonicalResume)
          if (validation.isValid) break

          if (attempt < maxSynthesisAttempts) {
            const problems = [...(validation.errors || []), ...(validation.evidenceErrors || [])].slice(0, 8)
            console.warn(`[ResumeAgent] Synthesis attempt ${attempt} failed validation — retrying with repair note`)
            messages = [
              ...messages,
              {
                role: 'user',
                content: `Your previous JSON failed validation. Return the COMPLETE corrected JSON object only. Fix these problems and change nothing that was already valid:\n- ${problems.join('\n- ')}`,
              },
            ]
          }
        }
      }

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
        synthesisAttempts: maxSynthesisAttempts,
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

      // ── Step 8: Evidence Validation & Safe Recovery ─────────────────────────
      // If validation failed strictly because of evidence errors on a subset of issues,
      // attempt safe recovery: prune the ungrounded issues if at least 3 valid issues remain.
      if (
        validation &&
        validation.isSchemaValid &&
        !validation.isEvidenceValid &&
        Array.isArray(validation.sanitizedAnalysis?.issues)
      ) {
        const failingIndices = new Set()
        for (const err of validation.evidenceErrors || []) {
          const match = err.match(/^issues\[(\d+)\]/)
          if (match) failingIndices.add(parseInt(match[1], 10))
        }
        if (failingIndices.size > 0 && validation.sanitizedAnalysis.issues.length - failingIndices.size >= 3) {
          const recoveredIssues = validation.sanitizedAnalysis.issues.filter((_, idx) => !failingIndices.has(idx))
          console.warn(
            `[ResumeAgent] Safe recovery applied: pruned ${failingIndices.size} ungrounded issues; ${recoveredIssues.length} valid issues retained.`
          )
          const recoveredAnalysis = {
            ...validation.sanitizedAnalysis,
            issues: recoveredIssues,
          }
          const revalidated = ResumeAgentValidator.validate(recoveredAnalysis, canonicalResume)
          if (revalidated.isValid) {
            validation = revalidated
            validation.warnings.push(
              `Safe recovery applied: pruned ${failingIndices.size} issues with invalid evidence; ${recoveredIssues.length} verified issues retained.`
            )
          }
        }
      }

      if (!validation || !validation.isValid || !validation.isEvidenceValid) {
        const errorSummary = [...(validation?.errors || []), ...(validation?.evidenceErrors || [])].join('; ')
        const isJsonError = (validation?.errors || []).some((e) =>
          e.toLowerCase().includes('json') || e.toLowerCase().includes('parse')
        )
        const isEvidenceError =
          !validation?.isEvidenceValid || (validation?.evidenceErrors && validation.evidenceErrors.length > 0)

        let failureClassification = 'SCHEMA_VALIDATION_ERROR'
        if (isJsonError) failureClassification = 'INVALID_JSON'
        else if (isEvidenceError) failureClassification = 'EVIDENCE_VALIDATION_ERROR'

        const telemetryRecord = span.finish({
          actualModel: gatewayResponse.actualModel,
          success: false,
          error: { code: failureClassification, message: errorSummary },
          schemaValid: validation?.isSchemaValid ?? false,
          evidenceValidationValid: false,
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

        // If claim violations were detected, attempt safe recovery
        if (v3Violations.length > 0) {
          // 1. Sanitize recommendations that contain hypothetical metric examples in parentheses e.g. (e.g. 35%)
          for (const iss of parsedAnalysis.issues || []) {
            if (iss.recommendation && /\(e\.g\.?[^)]*\d+[^)]*\)/i.test(iss.recommendation)) {
              iss.recommendation = iss.recommendation.replace(/\s*\(e\.g\.?[^)]*\d+[^)]*\)/gi, '').trim()
            }
            if (iss.correctedText) {
              const textViolations = validateClaims({ issues: [{ ...iss, diagnosis: '', recommendation: '' }] }, canonicalResume)
              if (textViolations.violations && textViolations.violations.length > 0) {
                const evText = ResumeAgentValidator.getEvidenceText(iss.evidence)
                iss.correctedText = ResumeAgentValidator.buildGoogleXYZRewrite(evText || iss.title)
                iss.correctionType = 'rewrite'
              }
            }
          }

          // Re-sync priorityActions action text with sanitized recommendations
          if (Array.isArray(parsedAnalysis.priorityActions)) {
            parsedAnalysis.priorityActions = parsedAnalysis.issues.slice(0, 3).map((iss, idx) => ({
              priority: idx + 1,
              title: iss.title,
              action: iss.recommendation,
              reason: iss.whyItMatters,
            }))
          }

          // Re-validate claims after sanitization
          const recheck = validateClaims(parsedAnalysis, canonicalResume)
          v3Violations = recheck.violations || []

          // If any issues STILL violate claims, prune them if >= 3 remain
          if (v3Violations.length > 0) {
            const violatingIssueIds = new Set()
            for (const v of v3Violations) {
              const m = typeof v === 'string' ? v.match(/\[(iss_\d+|issue_\d+)/i) : null
              if (m) violatingIssueIds.add(m[1].toLowerCase())
              else if (typeof v.issueIndex === 'number') violatingIssueIds.add(`iss_${String(v.issueIndex + 1).padStart(3, '0')}`)
            }

            if (violatingIssueIds.size > 0 && parsedAnalysis.issues.length - violatingIssueIds.size >= 3) {
              parsedAnalysis.issues = parsedAnalysis.issues.filter(
                (iss) => !violatingIssueIds.has((iss.id || '').toLowerCase())
              )
              const finalCheck = validateClaims(parsedAnalysis, canonicalResume)
              v3Violations = finalCheck.violations || []
              validation.warnings.push(
                `Safe recovery applied: pruned ${violatingIssueIds.size} issues with claim violations; ${parsedAnalysis.issues.length} verified issues retained.`
              )
            }
          }
        }

        // Hard gate on remaining v3Violations:
        if (v3Violations.length > 0) {
          const violationSummary = v3Violations.map((v) => v.message || v.claim || JSON.stringify(v)).join('; ')
          const failureClassification = 'EVIDENCE_VALIDATION_ERROR'
          const telemetryRecord = span.finish({
            actualModel: gatewayResponse.actualModel,
            success: false,
            error: { code: failureClassification, message: `Evidence claim validation failed: ${violationSummary}` },
            schemaValid: Boolean(validation.isSchemaValid),
            evidenceValidationValid: false,
            inputMode,
          })
          return {
            success: false,
            status: failureClassification,
            classification: failureClassification,
            error: `Resume analysis evidence claim validation failed: ${violationSummary}`,
            code: failureClassification,
            rawModelOutput,
            metadata: gatewayMetadata,
            validationDetails: {
              ...validation,
              v3RewriteViolations: v3Violations,
            },
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
      // V3.1: deterministic Scorecard Engine fills `dashboard` (previously null).
      // Computed AFTER all LLM-output validation, so it reflects the final,
      // sanitized issue set. Zero LLM cost — runs in milliseconds.
      let dashboard = null
      try {
        dashboard = computeScorecard({
          analysis: parsedAnalysis,
          canonicalResume,
          precomputedSignals,
          usMarketSignals: state?.usMarketSignals || null,
          validation,
          pageCount: typeof parsedDoc.pageCount === 'number' ? parsedDoc.pageCount : null,
        })
      } catch (scoreErr) {
        console.warn('[ResumeAgent] Scorecard computation failed:', scoreErr.message)
      }

      const activeMarketContext = state?.marketContext || null

      const finalAnalysis = {
        ...parsedAnalysis,
        candidateSnapshot: {
          ...(parsedAnalysis.candidateSnapshot || {}),
          name: parsedAnalysis.candidateSnapshot?.name || canonicalResume.candidate?.name || '',
          targetRole: parsedAnalysis.candidateSnapshot?.targetRole || canonicalResume.candidate?.targetRole || effectiveRole || '',
          experienceLevel: parsedAnalysis.candidateSnapshot?.experienceLevel || (canonicalResume.experience?.length ? `${Math.max(1, canonicalResume.experience.length * 2)}+ years` : ''),
          presentRole: canonicalResume.candidate?.presentRole || '',
          presentCompany: canonicalResume.candidate?.presentCompany || '',
          pastRoles: canonicalResume.candidate?.pastRoles || [],
          allRoles: canonicalResume.candidate?.allRoles || [],
          linkedinUrl: canonicalResume.candidate?.contact?.linkedin || '',
        },
        dashboard,
        ...(activeMarketContext ? { marketContext: activeMarketContext } : {}),
        metadata: {
          ...gatewayMetadata,
          agentVersion: '3.2.0',
          marketProfileVersion: state?.marketProfile?.version || 'none',
          marketBucketVersion: activeMarketContext?.marketVersion || 0,
        },
      }

      const hasClaimWarnings =
        (validation.unsupportedClaims && validation.unsupportedClaims.length > 0) ||
        (validation.unsupportedAssumptionWarnings && validation.unsupportedAssumptionWarnings.length > 0) ||
        (validation.placeholderWarnings && validation.placeholderWarnings.length > 0) ||
        (validation.fabricatedOutcomeWarnings && validation.fabricatedOutcomeWarnings.length > 0) ||
        v3Assumptions.length > 0

      const successClassification = hasClaimWarnings ? 'UNSUPPORTED_CLAIM_WARNING' : 'SUCCESS'
      const isEvidenceGenuinelyValid = Boolean(validation.isEvidenceValid && v3Violations.length === 0)

      const telemetryRecord = span.finish({
        actualModel: gatewayResponse.actualModel,
        success: true,
        schemaValid: Boolean(validation.isSchemaValid),
        evidenceValidationValid: isEvidenceGenuinelyValid,
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
        marketContext: activeMarketContext,
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
      const sanitizedMsg = (err.message || 'Resume Agent analysis failed.')
        .replace(/gsk_[a-zA-Z0-9_-]{8,}/gi, 'gsk_***')
        .replace(/AIza[a-zA-Z0-9_-]{8,}/gi, 'AIza***')
        .replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer ***')

      const telemetryRecord = span.finish({ success: false, error: { ...err, message: sanitizedMsg } })
      const isBudgetExceeded = err instanceof ContextBudgetExceededError || err.code === 'CONTEXT_BUDGET_EXCEEDED'
      const statusClassification = isBudgetExceeded ? 'CONTEXT_BUDGET_EXCEEDED' : 'PROVIDER_ERROR'

      return {
        success: false,
        status: statusClassification,
        classification: statusClassification,
        error: sanitizedMsg,
        code: err.code || (isBudgetExceeded ? 'CONTEXT_BUDGET_EXCEEDED' : 'PROVIDER_ERROR'),
        statusCode: err.statusCode || (isBudgetExceeded ? 413 : 500),
        provider: err.provider || 'gateway',
        details: err.details || (isBudgetExceeded ? { estimatedTokens: err.estimatedTokens, safeTokenBudget: err.safeTokenBudget } : null),
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
